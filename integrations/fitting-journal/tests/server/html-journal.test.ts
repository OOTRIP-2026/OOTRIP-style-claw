import Fastify from 'fastify';
import { expect, it, vi } from 'vitest';
import { parseJournalItems, registerJournal } from '../../tools/lucy-demo/journal-server.js';
const environment = {
  DASHSCOPE_API_KEY: 'fake-key',
  QWEN_FREE_ONLY_CONFIRMED: 'true',
  QWEN_FREE_QUOTA_EXPIRES: '2099-12-31',
};
const image = 'data:image/jpeg;base64,/9j/AA==';
it('rejects invalid or reversed clothing regions rather than inventing thumbnails', () => {
  expect(parseJournalItems({ items: [] })).toEqual([]);
  expect(parseJournalItems({ items: [{ name: '白上衣', box: [10, 20, 500, 700] }] })).toHaveLength(
    1,
  );
  for (const box of [
    [100, 20, 10, 700],
    [0, 0, 1001, 500],
    [0, 0, NaN, 500],
    [1, 1, 1, 1],
  ])
    expect(() => parseJournalItems({ items: [{ name: '衣物', box }] })).toThrow();
});
it('status, missing consent and missing configuration never send the photo', async () => {
  const transport = vi.fn();
  const app = Fastify();
  registerJournal(app, {}, transport);
  try {
    expect((await app.inject('/journal/status')).json().configured).toBe(false);
    expect(
      (await app.inject({ method: 'POST', url: '/journal/recognize', payload: { image } }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/journal/recognize',
          payload: { image, consent: true },
        })
      ).statusCode,
    ).toBe(503);
    expect(transport).not.toHaveBeenCalled();
  } finally {
    await app.close();
  }
});
it('sends one photo with bounded timeout, validates output and never leaks credentials', async () => {
  const transport = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ items: [{ name: '上衣', box: [0, 0, 500, 600] }] }),
              },
            },
          ],
        }),
      ),
  );
  const app = Fastify();
  registerJournal(app, environment, transport);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/journal/recognize',
      payload: { image, consent: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().items).toHaveLength(1);
    expect(response.body).not.toContain('fake-key');
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
it('upstream failure returns a safe error with no retry or provider body', async () => {
  const transport = vi.fn(async () => new Response('private provider body', { status: 429 }));
  const app = Fastify();
  registerJournal(app, environment, transport);
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/journal/recognize',
      payload: { image, consent: true },
    });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain('private');
    expect(transport).toHaveBeenCalledTimes(1);
  } finally {
    await app.close();
  }
});
