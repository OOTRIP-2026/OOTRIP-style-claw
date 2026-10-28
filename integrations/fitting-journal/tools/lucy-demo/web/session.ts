import { TOTAL_CONNECTION_MS } from './session-policy.js';
import { createDecartClient, models } from '@decartai/sdk';
import {
  portraitCrop,
  portraitRegion,
  fitRegion,
  TRANSPORT_WIDTH,
  TRANSPORT_HEIGHT,
} from './portrait.js';

type SessionInput = { stream: MediaStream; image: string; prompt: string; nonce: string };
type SessionWindow = Window & { runLucy?: (input: SessionInput) => void };
const send = (type: string, message?: string) => {
  window.parent.postMessage({ type, message }, window.location.origin);
};

(window as SessionWindow).runLucy = (input) => {
  // The whole iframe is removed by its parent on timeout/cancel, including pending connects.
  delete (window as SessionWindow).runLucy;
  let stream = new MediaStream(input.stream.getVideoTracks());
  const source = document.createElement('video');
  source.muted = true;
  source.playsInline = true;
  source.srcObject = stream;
  const canvas = document.createElement('canvas');
  canvas.width = TRANSPORT_WIDTH;
  canvas.height = TRANSPORT_HEIGHT;
  const context = canvas.getContext('2d');
  let drawing = 0;
  let lastDraw = -Infinity;
  window.addEventListener(
    'pagehide',
    () => {
      cancelAnimationFrame(drawing);
      source.pause();
      source.srcObject = null;
      if (stream !== input.stream) stream.getTracks().forEach((track) => track.stop());
    },
    { once: true },
  );
  const video = document.querySelector('video');
  // Decode only the portrait region padded into the known landscape transport.
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  if (video) {
    video.style.objectFit = 'fill';
    video.style.display = 'block';
    video.style.position = 'absolute';
  }
  const layout = () => {
    if (!video?.videoWidth) return;
    const fitted = fitRegion(
      portraitRegion(video.videoWidth, video.videoHeight),
      video.videoWidth,
      video.videoHeight,
      window.innerWidth,
      window.innerHeight,
    );
    for (const key of ['width', 'height', 'left', 'top'] as const)
      video.style[key] = `${fitted[key]}px`;
  };
  video?.addEventListener('loadedmetadata', layout);
  video?.addEventListener('resize', layout);
  window.addEventListener('resize', layout);
  let credentialRequested = false;
  const client = createDecartClient({
    telemetry: false,
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    apiKeyProvider: async () => {
      // retries:0 does not disable reconnects after a drop. Never supply a second credential.
      if (credentialRequested) throw new Error('本批不允许自动重连。');
      credentialRequested = true;
      send('phase', '正在申请短期凭证（尚未连接视频）');
      const response = await fetch('/experiment/token', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', 'x-lucy-experiment': input.nonce },
        body: JSON.stringify({ consent: true, seconds: TOTAL_CONNECTION_MS / 1000 }),
      });
      const body = (await response.json()) as { apiKey?: string; message?: string };
      if (!response.ok || typeof body.apiKey !== 'string') {
        send('failure', body.message ?? '短期凭证申请失败，本批不重试。');
        throw new Error('TOKEN_UNAVAILABLE');
      }
      send('dial');
      return body.apiKey;
    },
  });
  void (async () => {
    try {
      if (!context || typeof canvas.captureStream !== 'function')
        throw new Error('PORTRAIT_UNAVAILABLE');
      await source.play();
      const draw = (timestamp: number) => {
        if (source.videoWidth && timestamp - lastDraw >= 1000 / 30) {
          const crop = portraitCrop(source.videoWidth, source.videoHeight);
          const region = portraitRegion(TRANSPORT_WIDTH, TRANSPORT_HEIGHT);
          context.fillStyle = '#18271f';
          context.fillRect(0, 0, TRANSPORT_WIDTH, TRANSPORT_HEIGHT);
          context.drawImage(
            source,
            crop.x,
            crop.y,
            crop.width,
            crop.height,
            region.x,
            region.y,
            region.width,
            region.height,
          );
          lastDraw = timestamp;
        }
        drawing = requestAnimationFrame(draw);
      };
      draw(performance.now());
      stream = canvas.captureStream(30);
      const realtime = await client.realtime.connect(stream, {
        model: models.realtime('lucy-vton-3.6'),
        retries: 0,
        capacityRetryBudgetMs: 0,
        mirror: false,
        initialState: {
          image: input.image,
          prompt: { text: input.prompt, enhance: false },
        },
        onConnectionChange: (state) => {
          if (state === 'connecting') send('phase', '正在建立Lucy连接');
          if (state === 'connected') send('phase', 'Lucy连接已建立，等待视频');
          if (state === 'generating') send('phase', 'Lucy正在生成视频');
          if (state === 'reconnecting' || state === 'disconnected') {
            send('ended', '实时连接已断开，已结束本次实验，不自动重连。');
          }
        },
        onRemoteStream: (remote) => {
          if (!video) return;
          send('phase', '收到远端视频流，等待浏览器显示首帧');
          video.srcObject = remote;
          // A stream/playing event alone does not prove a decoded frame was presented.
          video.requestVideoFrameCallback(() => send('playing'));
          void video.play().catch(() => send('failure', '试穿视频未能播放，已结束本次实验。'));
        },
      });
      realtime.on('error', () => send('failure', 'Lucy处理出错，已结束本次实验。'));
      realtime.on('sessionEnded', () => send('ended', 'Lucy已结束会话，摄像头即将关闭。'));
      window.addEventListener('pagehide', () => realtime.disconnect(), { once: true });
    } catch {
      send('failure', '实时连接未完成，已关闭摄像头。本批不重试，请反馈页面提示及额度变化。');
    }
  })();
};
