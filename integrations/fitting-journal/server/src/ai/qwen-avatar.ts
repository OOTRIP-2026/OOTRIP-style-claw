import { imageMime, VisionError } from './qwen-garment.js';

export interface AvatarSettings {
  apiKey: string;
  model: 'qwen-image-2.0';
}
export function avatarSettings(
  env: Record<string, string | undefined>,
  now = new Date(),
): AvatarSettings {
  const key = env['DASHSCOPE_API_KEY']?.trim();
  if (!key) throw new VisionError('NOT_CONFIGURED', '请在本机配置北京地域密钥，不发送到聊天。');
  if (env['AVATAR_FREE_ONLY_CONFIRMED'] !== 'true')
    throw new VisionError(
      'FREE_STOP_UNCONFIRMED',
      '请先开启图像模型免费额度用完即停，再设置独立确认项。',
    );
  const expiry = env['AVATAR_FREE_QUOTA_EXPIRES'];
  const deadline = new Date(`${expiry ?? ''}T00:00:00Z`);
  if (
    !expiry ||
    !/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
    !Number.isFinite(deadline.getTime()) ||
    deadline.toISOString().slice(0, 10) !== expiry ||
    now >= deadline
  )
    throw new VisionError('QUOTA_EXPIRED', '图像模型免费额度日期无效或已到期，停止调用。');
  return { apiKey: key, model: 'qwen-image-2.0' };
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function avatarImageUrl(body: unknown): string {
  const output = object(body) ? body['output'] : undefined;
  const choices = object(output) ? output['choices'] : undefined;
  const choice: unknown = Array.isArray(choices) && choices.length === 1 ? choices[0] : undefined;
  const message =
    object(choice) && choice['finish_reason'] === 'stop' ? choice['message'] : undefined;
  const content = object(message) ? message['content'] : undefined;
  const item: unknown = Array.isArray(content) && content.length === 1 ? content[0] : undefined;
  const raw = object(item) ? item['image'] : undefined;
  if (typeof raw !== 'string' || raw.length > 8192)
    throw new VisionError('INVALID_RESULT', '图像结果结构不完整，未当作成功。');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new VisionError('RESULT_URL', '结果地址无效。');
  }
  // Only the official result bucket pattern, never arbitrary URLs or redirected hosts.
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !(
      /^dashscope-result-[a-z0-9-]+\.oss-cn-[a-z0-9-]+\.aliyuncs\.com$/.test(url.hostname) ||
      url.hostname === 'dashscope-0484.oss-accelerate.aliyuncs.com'
    )
  ) {
    // Never include the signed path, query, credentials or original URL in diagnostics.
    const host =
      url.hostname.length <= 253 && /^[a-z0-9.-]+$/.test(url.hostname)
        ? url.hostname
        : '非标准DNS主机';
    const reason =
      url.protocol !== 'https:' || url.username || url.password || url.port || url.hash
        ? '协议或地址结构不符合要求'
        : '域名未获允许';
    throw new VisionError(
      'RESULT_URL',
      `结果下载已拦截：${reason}。返回域名：${host}。请只反馈此提示，不提供完整链接；可能已消耗额度，请勿连续生成。`,
    );
  }
  return url.href;
}
async function boundedBody(response: Response, max: number): Promise<Buffer> {
  if (!response.body) throw new VisionError('INVALID_RESULT', '响应为空。');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > max) throw new VisionError('RESULT_SIZE', '返回内容超过大小限制，已停止。');
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function generateAvatar(
  bytes: Buffer,
  settings: AvatarSettings,
  transport: typeof fetch = fetch,
) {
  return generateReferenceImage(
    bytes,
    settings,
    {
      prompt:
        '将图中已授权成年人物制作成换装预览底图。保持原人物面貌、自然体型和肤色，不瘦身不美化，不改变身份。正面完整站立，双臂略离身体，双腿自然分开，头顶和双脚完整可见。统一穿不透明深灰色贴身短袖上衣及及膝骑行短裤，赤脚，无首饰、鞋袜、包、外套。简单浅灰色纯色背景。保留自然人体比例，不生成裸体、内衣或透视服装。仅作二维搭配预览，不作尺码模拟。',
      size: '768*1152',
    },
    transport,
  );
}
export async function generateReferenceImage(
  bytes: Buffer,
  settings: AvatarSettings,
  options: { prompt: string; size: string; endpoint?: string; referenceImages?: Buffer[]; negativePrompt?: string },
  transport: typeof fetch = fetch,
): Promise<{ image: Buffer; elapsedMs: number; requestId: string | null }> {
  const mime = imageMime(bytes);
  const references = options.referenceImages ?? [];
  if (references.length > 2) throw new VisionError('INVALID_INPUT', '最多支持三张输入图片。');
  const referenceContent = references.map(image => ({image: `data:${imageMime(image)};base64,${image.toString('base64')}`}));
  const started = Date.now();
  let response: Response;
  try {
    response = await transport(
      options.endpoint ??
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(180000),
        headers: { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { image: `data:${mime};base64,${bytes.toString('base64')}` },
                  ...referenceContent,
                  {
                    text: options.prompt,
                  },
                ],
              },
            ],
          },
          parameters: { n: 1, size: options.size, prompt_extend: false, watermark: false,
            ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}) },
        }),
      },
    );
  } catch {
    throw new VisionError('NETWORK', '图像服务连接失败或超时，可能已消耗额度；不自动重试。');
  }
  if (!response.ok)
    throw new VisionError(
      'UPSTREAM',
      `图像服务返回HTTP ${response.status}，请核对权限或免费额度；不自动重试。`,
    );
  let body: unknown;
  try {
    body = JSON.parse((await boundedBody(response, 256 * 1024)).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof VisionError) throw error;
    throw new VisionError('INVALID_RESULT', '图像服务返回不可解析的结果。');
  }
  const url = avatarImageUrl(body);
  let image: Buffer;
  try {
    // Do not forward the API key to the result bucket.
    const download = await transport(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(60000),
    });
    if (!download.ok) throw new Error('download');
    image = await boundedBody(download, 15 * 1024 * 1024);
  } catch {
    throw new VisionError(
      'DOWNLOAD',
      '图像可能已生成，但下载失败；请勿重新生成或连续重试，先反馈错误。',
    );
  }
  if (
    image.length < 33 ||
    !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    image.toString('ascii', 12, 16) !== 'IHDR' ||
    image.readUInt32BE(16) < 32 ||
    image.readUInt32BE(20) < 32 ||
    image.readUInt32BE(16) > 2048 ||
    image.readUInt32BE(20) > 2048
  )
    throw new VisionError('IMAGE_RESULT', '返回文件不是支持尺寸的PNG；尚未验证图片可解码或外观。');
  const requestId = object(body) ? body['request_id'] : undefined;
  return {
    image,
    elapsedMs: Date.now() - started,
    requestId:
      typeof requestId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(requestId) ? requestId : null,
  };
}
