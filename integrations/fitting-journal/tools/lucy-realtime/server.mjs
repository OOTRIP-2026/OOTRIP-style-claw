import Fastify from 'fastify';
import { randomBytes } from 'node:crypto';
import { access, mkdir, open } from 'node:fs/promises';
import { dirname } from 'node:path';

export const LUCY_MODEL = 'lucy-vton-3.6';
export const EXPERIMENT_ORIGIN = 'http://127.0.0.1:3100';
export const SESSION_SECONDS = 30;

class LucyTokenError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function tokenFailure(error) {
  if (error instanceof LucyTokenError) return { code: error.code, message: error.message };
  const timedOut = ['TimeoutError', 'AbortError'].includes(error?.name);
  return timedOut
    ? { code: 'TOKEN_TIMEOUT', message: '连接Decart凭证接口超时。请核对电脑网络或代理设置。' }
    : {
        code: 'TOKEN_NETWORK',
        message:
          '无法连接Decart凭证接口。浏览器可访问不代表Node后端网络可访问，请核对网络或代理设置。',
      };
}

// No SDK retries, no image/video storage, no provider error bodies in output.
export async function mintLucyToken(apiKey, transport = fetch) {
  const response = await transport('https://api.decart.ai/v1/client/tokens', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      expiresIn: 60,
      allowedModels: [LUCY_MODEL],
      allowedOrigins: [EXPERIMENT_ORIGIN],
      constraints: { realtime: { maxSessionDuration: SESSION_SECONDS } },
    }),
  });
  if (!response.ok) {
    const code = `TOKEN_HTTP_${response.status}`;
    const message = [401, 403].includes(response.status)
      ? `Decart凭证接口拒绝授权（HTTP ${response.status}），请检查密钥有效性及权限。`
      : response.status === 429
        ? 'Decart凭证接口限流（HTTP 429），本次未自动重试。'
        : `Decart凭证接口返回HTTP ${response.status}，本次未自动重试。`;
    throw new LucyTokenError(code, message);
  }
  const result = await response.json();
  const mismatches = [];
  if (typeof result.apiKey !== 'string' || !result.apiKey.trim() || result.apiKey === apiKey)
    mismatches.push('apiKey');
  if (typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)))
    mismatches.push('expiresAt');
  // Echo fields are optional in CreateTokenResponse. The request always sets the limits.
  const duration = result.constraints?.realtime?.maxSessionDuration;
  if (duration !== undefined && duration !== SESSION_SECONDS) mismatches.push('maxSessionDuration');
  const models = result.permissions?.models;
  if (models != null && (!Array.isArray(models) || !models.includes(LUCY_MODEL)))
    mismatches.push('models');
  const origins = result.permissions?.origins;
  if (origins != null && (!Array.isArray(origins) || !origins.includes(EXPERIMENT_ORIGIN)))
    mismatches.push('origins');
  if (mismatches.length) {
    throw new LucyTokenError(
      'TOKEN_CONSTRAINTS_UNCONFIRMED',
      `TOKEN_CONSTRAINTS_UNCONFIRMED：Decart响应不兼容的字段：${mismatches.join('、')}。未开始视频。`,
    );
  }
  return { apiKey: result.apiKey, expiresAt: result.expiresAt };
}

export function createLucyExperiment({
  apiKey,
  gatePath,
  assets,
  mint = mintLucyToken,
  batchNumber = 1,
  budget,
}) {
  const app = Fastify({ logger: false, bodyLimit: 1024 });
  const pageNonce = randomBytes(32).toString('hex');

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.header('Permissions-Policy', 'camera=(self), microphone=()');
    if (
      request.headers.host !== '127.0.0.1:3100' ||
      (request.headers.origin && request.headers.origin !== EXPERIMENT_ORIGIN) ||
      (request.headers['sec-fetch-site'] === 'cross-site' && !(request.method === 'GET' && request.url.split('?')[0] === '/app/index.html' && request.headers['sec-fetch-mode'] === 'navigate' && request.headers['sec-fetch-dest'] === 'document'))
    ) {
      return reply.code(403).send({ message: '请从电脑本机实验地址打开。' });
    }
    if (
      request.method === 'POST' &&
      (request.headers.origin !== EXPERIMENT_ORIGIN ||
        request.headers['x-lucy-experiment'] !== pageNonce)
    ) {
      return reply.code(403).send({ message: '本次操作来源无效，请重新打开实验页。' });
    }
  });
  app.setErrorHandler((_error, _request, reply) => {
    void reply.code(500).send({ message: '实验服务未能完成操作，未自动重试。' });
  });

  app.get('/', async (_request, reply) => {
    return reply
      .type('text/html; charset=utf-8')
      .send(
        assets.shell
          ? assets.shell.replace('__SCREEN__', '/fitting-screen')
          : assets.html.replace('__NONCE__', pageNonce),
      );
  });
  if (assets.shell) {
    app.get('/fitting-screen', async (_request, reply) =>
      reply.type('text/html; charset=utf-8').send(assets.html.replace('__NONCE__', pageNonce)),
    );
    app.get('/journal-screen', async (_request, reply) =>
      reply.type('text/html; charset=utf-8').send(assets.journal.replace('__NONCE__', pageNonce)),
    );
  }
  if (assets.journal) {
    app.get('/journal', async (_request, reply) =>
      reply
        .type('text/html; charset=utf-8')
        .send(
          assets.shell
            ? assets.shell.replace('__SCREEN__', '/journal-screen')
            : assets.journal.replace('__NONCE__', pageNonce),
        ),
    );
  }
  app.get('/client.js', async (_request, reply) => {
    return reply.type('text/javascript; charset=utf-8').send(assets.javascript);
  });
  app.get('/session.html', async (_request, reply) => {
    return reply
      .type('text/html; charset=utf-8')
      .send(
        '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>实时试衣视频</title>' +
          '<style>html,body{margin:0;height:100%;background:#18271f}video{width:100%;height:100%;object-fit:contain}</style>' +
          '</head><body><video autoplay muted playsinline></video>' +
          '<script type="module" src="/session.js"></script></body></html>',
      );
  });
  app.get('/session.js', async (_request, reply) => {
    return reply.type('text/javascript; charset=utf-8').send(assets.session);
  });
  // esbuild preserves new URL('./frame-metadata-worker.js', import.meta.url) in the SDK.
  // After bundling /session.js the worker is resolved at this exact same-origin URL.
  app.get('/frame-metadata-worker.js', async (_request, reply) => {
    return reply.type('text/javascript; charset=utf-8').send(assets.worker);
  });
  app.get('/style.css', async (_request, reply) => {
    return reply.type('text/css; charset=utf-8').send(assets.css);
  });
  app.get('/experiment/status', async () => {
    if (budget) {
      const testBudget = budget.status();
      return {
        configured: Boolean(apiKey?.trim()),
        available: testBudget.remaining > 0,
        seconds: SESSION_SECONDS,
        testBudget,
      };
    }
    let available = false;
    try {
      await access(gatePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      available = true;
    }
    return { configured: Boolean(apiKey?.trim()), available, seconds: SESSION_SECONDS };
  });
  app.post('/experiment/token', async (request, reply) => {
    if (
      request.body?.consent !== true ||
      request.body?.seconds !== SESSION_SECONDS ||
      Object.keys(request.body).some((key) => !['consent', 'seconds'].includes(key))
    ) {
      return reply
        .code(400)
        .send({ message: '请明确同意本次总连接最多30秒的视频与衣物图片处理。' });
    }
    if (!apiKey?.trim()) {
      return reply.code(503).send({ message: '未配置 DECART_API_KEY，请保存.env后重启实验服务。' });
    }

    // Reserve BEFORE contacting Decart. Failure/unknown outcome stays reserved across restarts.
    if (budget) {
      try {
        await budget.reserve();
      } catch (error) {
        if (error.message !== 'ATTEMPT_USED') throw error;
        return reply.code(409).send({ message: '本批10次测试机会已用完，不自动新增。' });
      }
    } else {
      await mkdir(dirname(gatePath), { recursive: true });
      let reservation;
      try {
        reservation = await open(gatePath, 'wx');
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        return reply
          .code(409)
          .send({ message: '本批的一次申请已使用，请反馈结果后再安排下一批。' });
      }
      try {
        await reservation.writeFile(
          JSON.stringify({
            batch: batchNumber,
            reservedAt: new Date().toISOString(),
            seconds: SESSION_SECONDS,
          }),
        );
        await reservation.sync();
      } finally {
        await reservation.close();
      }
    }

    try {
      const token = await mint(apiKey);
      return {
        ...token,
        model: LUCY_MODEL,
        seconds: SESSION_SECONDS,
        ...(budget ? { testBudget: budget.status() } : {}),
      };
    } catch (error) {
      const failure = tokenFailure(error);
      return reply.code(502).send({
        code: failure.code,
        message: `${failure.message} 本批申请已使用；本机摄像头预览仍可使用。`,
      });
    }
  });
  return app;
}
