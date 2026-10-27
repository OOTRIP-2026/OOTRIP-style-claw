import Fastify from 'fastify';
import { expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  registerJournalArtwork,
  journalImageSettings,
  JOURNAL_ART_PROMPT,
} from '../../tools/lucy-demo/journal-artwork.js';
const env = {
  DASHSCOPE_API_KEY: 'fake-key',
  JOURNAL_IMAGE_FREE_ONLY_CONFIRMED: 'true',
  JOURNAL_IMAGE_FREE_QUOTA_EXPIRES: '2099-12-31',
};
const image = 'data:image/jpeg;base64,/9j/AA==';
const payload = () => ({ image, consent: true, requestId: randomUUID() });
function png() {
  const b = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b);
  b.write('IHDR', 12);
  b.writeUInt32BE(1200, 16);
  b.writeUInt32BE(1600, 20);
  return b;
}
function envelope(
  url = 'https://dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com/art.png?private=token',
) {
  return {
    output: { choices: [{ finish_reason: 'stop', message: { content: [{ image: url }] } }] },
  };
}
it('requires image-model quota declaration, not only recognition quota', () => {
  expect(() =>
    journalImageSettings({
      ...env,
      JOURNAL_IMAGE_FREE_ONLY_CONFIRMED: undefined,
      QWEN_FREE_ONLY_CONFIRMED: 'true',
    }),
  ).toThrow();
  expect(journalImageSettings(env).settings.model).toBe('qwen-image-2.0');
  expect(() =>
    journalImageSettings({ ...env, DASHSCOPE_WORKSPACE_ID: 'evil.example/path' }),
  ).toThrow();
  expect(
    journalImageSettings({ ...env, DASHSCOPE_WORKSPACE_ID: 'workspace-123' }).endpoint,
  ).toContain('workspace-123.cn-beijing.maas.aliyuncs.com');
});
it('status, absent consent, malformed request and unconfigured service never call provider', async () => {
  const transport = vi.fn();
  const app = Fastify();
  registerJournalArtwork(app, {}, transport);
  try {
    expect((await app.inject('/journal/artwork/status')).json().configured).toBe(false);
    for (const body of [
      { ...payload(), consent: false },
      { ...payload(), requestId: 'bad' },
    ])
      expect(
        (await app.inject({ method: 'POST', url: '/journal/artwork', payload: body })).statusCode,
      ).toBe(400);
    expect(
      (await app.inject({ method: 'POST', url: '/journal/artwork', payload: payload() }))
        .statusCode,
    ).toBe(503);
    expect(transport).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
it('makes one image generation, preserves source input and downloads without credentials; duplicate does not mint', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(envelope())))
    .mockResolvedValueOnce(new Response(png()));
  const app = Fastify();
  registerJournalArtwork(app, env, transport);
  try {
    const body = payload();
    const response = await app.inject({ method: 'POST', url: '/journal/artwork', payload: body });
    expect(response.statusCode).toBe(200);
    expect(response.json().mode).toBe('ai-paper');
    expect(response.body).not.toContain('fake-key');
    const sent = JSON.parse(String(transport.mock.calls[0]![1]!.body));
    expect(sent.parameters).toMatchObject({ n: 1, size: '1200*1600', prompt_extend: false });
    expect(sent.input.messages[0].content[0].image).toBe(image);
    expect(sent.input.messages[0].content[1].text).toBe(JOURNAL_ART_PROMPT);
    expect(sent.input.messages[0].content[1].text).not.toContain('统一穿不透明深灰色');
    expect(transport.mock.calls[1]![1]?.headers).toBeUndefined();
    expect(
      (await app.inject({ method: 'POST', url: '/journal/artwork', payload: body })).statusCode,
    ).toBe(409);
    expect(transport).toHaveBeenCalledTimes(2);
  } finally {
    await app.close();
  }
});
it('reserves failed request, never retries or leaks provider errors', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('private-provider-error', { status: 429 }));
  const app = Fastify();
  registerJournalArtwork(app, env, transport);
  try {
    const body = payload();
    const response = await app.inject({ method: 'POST', url: '/journal/artwork', payload: body });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('private-provider-error');
    expect(
      (await app.inject({ method: 'POST', url: '/journal/artwork', payload: body })).statusCode,
    ).toBe(409);
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
it('blocks concurrent generation and arbitrary result URLs', async () => {
  let finish!: (r: Response) => void;
  const transport = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise((r) => {
        finish = r;
      }),
  );
  const app = Fastify();
  registerJournalArtwork(app, env, transport);
  try {
    const first = app.inject({ method: 'POST', url: '/journal/artwork', payload: payload() });
    const responsePromise = first.then((r) => r);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
    expect(
      (await app.inject({ method: 'POST', url: '/journal/artwork', payload: payload() }))
        .statusCode,
    ).toBe(409);
    finish(new Response(JSON.stringify(envelope('http://127.0.0.1/private'))));
    expect((await responsePromise).statusCode).toBe(502);
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
