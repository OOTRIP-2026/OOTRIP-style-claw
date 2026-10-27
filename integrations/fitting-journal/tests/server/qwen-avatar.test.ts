import { describe, expect, it, vi } from 'vitest';
import { avatarSettings, avatarImageUrl, generateAvatar } from '../../server/src/ai/qwen-avatar.js';

const settings = { apiKey: 'test-only-not-a-key', model: 'qwen-image-2.0' as const };
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const official = 'https://dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com/result.png?Expires=123';
function envelope(url = official, finish = 'stop') {
  return {
    request_id: 'request-test',
    output: { choices: [{ finish_reason: finish, message: { content: [{ image: url }] } }] },
  };
}
describe('avatar generation adapter without real calls', () => {
  it('requires independent image-model free-stop confirmation and expiry', () => {
    const env = {
      DASHSCOPE_API_KEY: settings.apiKey,
      QWEN_FREE_ONLY_CONFIRMED: 'true',
      AVATAR_FREE_QUOTA_EXPIRES: '2026-12-24',
    };
    expect(() => avatarSettings(env, new Date('2026-10-17'))).toThrow('独立确认');
    expect(
      avatarSettings({ ...env, AVATAR_FREE_ONLY_CONFIRMED: 'true' }, new Date('2026-10-17')),
    ).toEqual(settings);
    expect(() =>
      avatarSettings({ ...env, AVATAR_FREE_ONLY_CONFIRMED: 'true' }, new Date('2026-12-24')),
    ).toThrow('到期');
  });
  it('rejects unsafe image destinations and incomplete results', () => {
    expect(avatarImageUrl(envelope())).toBe(official);
    const accelerated = 'https://dashscope-0484.oss-accelerate.aliyuncs.com/result.png?Expires=123';
    expect(avatarImageUrl(envelope(accelerated))).toBe(accelerated);
    for (const url of [
      'http://127.0.0.1/a.png',
      'https://evil.example/a.png',
      'https://dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com.evil.example/a.png',
      'https://user:pass@dashscope-result-hz.oss-cn-hangzhou.aliyuncs.com/a.png',
      'https://dashscope-0484.oss-accelerate.aliyuncs.com.evil.example/a.png',
      'https://other-bucket.oss-accelerate.aliyuncs.com/a.png',
      'http://dashscope-0484.oss-accelerate.aliyuncs.com/a.png',
      'https://user:pass@dashscope-0484.oss-accelerate.aliyuncs.com/a.png',
      'https://dashscope-0484.oss-accelerate.aliyuncs.com:8443/a.png',
    ])
      expect(() => avatarImageUrl(envelope(url))).toThrow('拦截');
    expect(() => avatarImageUrl(envelope(official, 'length'))).toThrow('结构');
  });
  it('reports only a rejected hostname and never downloads or leaks its signed URL', async () => {
    const url =
      'https://private-user:private-pass@unexpected.example/private-photo.png?Signature=private-signature#private-fragment';
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope(url))));
    let diagnostic = '';
    try {
      await generateAvatar(png, settings, transport);
    } catch (error) {
      diagnostic = error instanceof Error ? error.message : '';
    }
    expect(diagnostic).toContain('返回域名：unexpected.example');
    expect(diagnostic).toContain('地址结构');
    for (const secret of [
      'private-user',
      'private-pass',
      'private-photo',
      'Signature',
      'private-signature',
      'private-fragment',
    ])
      expect(diagnostic).not.toContain(secret);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('sends one image edit and downloads without forwarding credentials', async () => {
    const image = Buffer.alloc(33);
    png.copy(image);
    image.write('IHDR', 12);
    image.writeUInt32BE(768, 16);
    image.writeUInt32BE(1152, 20);
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            envelope('https://dashscope-0484.oss-accelerate.aliyuncs.com/result.png?Expires=123'),
          ),
        ),
      )
      .mockResolvedValueOnce(new Response(image));
    const result = await generateAvatar(png, settings, transport);
    expect(result.image).toEqual(image);
    expect(result.requestId).toBe('request-test');
    const request = JSON.parse(String(transport.mock.calls[0]?.[1]?.body)) as {
      model: string;
      parameters: { n: number };
    };
    expect(request.model).toBe('qwen-image-2.0');
    expect(request.parameters.n).toBe(1);
    expect(transport.mock.calls[1]?.[1]?.headers).toBeUndefined();
    expect(transport.mock.calls[1]?.[1]?.redirect).toBe('error');
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('rejects bad input before any call and stops on quota failure without leaking bodies', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('private upstream detail', { status: 403 }));
    await expect(generateAvatar(Buffer.from('bad'), settings, transport)).rejects.toThrow('文件头');
    expect(transport).not.toHaveBeenCalled();
    await expect(generateAvatar(png, settings, transport)).rejects.toThrow('HTTP 403');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('does not regenerate if image download fails', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(envelope())))
      .mockResolvedValueOnce(new Response('', { status: 500 }));
    await expect(generateAvatar(png, settings, transport)).rejects.toMatchObject({
      code: 'DOWNLOAD',
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
