import { horizontalScroll } from './horizontal-scroll.js';
import {
  REALTIME_CATEGORIES,
  readWardrobe,
  saveGarments,
  importGarment,
  selectRealtimeGarment,
  referenceImage,
  type Garment,
} from './store.js';
import { portraitRegion } from './portrait.js';
import { TOTAL_CONNECTION_MS, CONNECTION_WAIT_MS, TRY_ON_PROMPT, firstFrameDeadline } from './session-policy.js';
export {};
type SessionWindow = Window & {
  runLucy?: (input: { stream: MediaStream; image: string; prompt: string; nonce: string }) => void;
};
function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('页面组件缺失。');
  return node as T;
}
const camera = element<HTMLVideoElement>('camera'),
  output = element<HTMLDivElement>('output');
const preview = element<HTMLButtonElement>('preview'),
  start = element<HTMLButtonElement>('start'),
  stop = element<HTMLButtonElement>('stop'),
  capture = element<HTMLButtonElement>('capture');
const upload = element<HTMLButtonElement>('upload'),
  files = element<HTMLInputElement>('files'),
  consent = element<HTMLInputElement>('consent');
const status = element<HTMLParagraphElement>('status'),
  quota = element<HTMLElement>('quota');
const nonce =
  document.querySelector<HTMLMetaElement>('meta[name="lucy-experiment"]')?.content ?? '';
let wardrobe: Garment[] = [],
  selected: Garment[] = [],
  category = '上衣';
let stream: MediaStream | null = null,
  frame: HTMLIFrameElement | null = null;
let busy = false,
  running = false,
  available = false,
  firstFrame = false,
  generation = 0;
let deadline = 0,
  timeout = 0,
  interval = 0;
const help = element<HTMLDialogElement>('help');
const wardrobeToggle = element<HTMLButtonElement>('toggle-wardrobe');
wardrobeToggle.onclick = () => {
  const collapsed = (element('wardrobe-panel').hidden = !element('wardrobe-panel').hidden);
  document.querySelector('.workspace')?.classList.toggle('wardrobe-collapsed', collapsed);
  wardrobeToggle.setAttribute('aria-expanded', String(!collapsed));
  wardrobeToggle.textContent = collapsed ? '‹ 展开选衣' : '收起选衣 ›';
};
element('open-help').onclick = () => help.showModal();
element('close-help').onclick = () => help.close();

function controls() {
  preview.disabled = busy || running || !!stream;
  upload.disabled = busy || running;
  files.disabled = busy || running;
  start.disabled = busy || running;
  stop.disabled = !stream && !busy && !running;
  capture.disabled = !firstFrame || !running;
  consent.disabled = busy || running;
  element<HTMLButtonElement>('clear-selection').disabled = busy || running;
  document
    .querySelectorAll<HTMLButtonElement>(
      '#categories button, .garment button, .selected-item button',
    )
    .forEach((button) => {
      button.disabled = busy || running;
    });
}
function image(item: Garment) {
  const node = new Image();
  node.src = item.image;
  node.alt = item.name;
  return node;
}
function message(text: string) {
  status.textContent = text;
}
function invalidateLook() {
  consent.checked = false;
}
function render() {
  element('closet-count').textContent = `${wardrobe.length} 件单品`;
  element('category-name').textContent = category;
  element('selection-count').textContent = String(selected.length);
  element('look-name').textContent = selected.length
    ? selected.map((item) => item.category).join(' / ')
    : '自然呼吸，轻松出发。';
  const categories = element('categories');
  categories.replaceChildren();
  for (const name of REALTIME_CATEGORIES) {
    const button = document.createElement('button');
    button.textContent = name;
    button.className = name === category ? 'active' : '';
    button.setAttribute('aria-pressed', String(name === category));
    button.onclick = () => {
      if (running || busy) return;
      category = name;
      render();
    };
    categories.append(button);
  }
  const gallery = element('gallery');
  gallery.replaceChildren();
  for (const item of wardrobe.filter((entry) => entry.category === category)) {
    const wrapper = document.createElement('div');
    wrapper.className = 'garment';
    const tile = document.createElement('button'),
      label = document.createElement('p'),
      remove = document.createElement('button');
    const checked = selected.some((entry) => entry.id === item.id);
    tile.className = `garment-tile${checked ? ' selected' : ''}`;
    tile.setAttribute('aria-pressed', String(checked));
    tile.setAttribute('aria-label', `选择${item.name}`);
    tile.append(image(item));
    tile.onclick = () => {
      if (busy || running) return;
      selected = selectRealtimeGarment(selected, item);
      invalidateLook();
      render();
      message('衣物已选好；同类自动替换，套装与上衣、裤子、内搭互斥。');
    };
    label.className = 'garment-label';
    label.textContent = item.name;
    remove.className = 'delete';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `从浏览器衣橱删除${item.name}`);
    remove.onclick = () => {
      if (busy || running || !window.confirm(`从浏览器衣橱删除“${item.name}”？`)) return;
      busy = true;
      controls();
      void saveGarments([item], true)
        .then(() => {
          wardrobe = wardrobe.filter((entry) => entry.id !== item.id);
          selected = selected.filter((entry) => entry.id !== item.id);
          invalidateLook();
        })
        .catch(() => message('删除失败，衣物已保留。'))
        .finally(() => {
          busy = false;
          render();
        });
    };
    wrapper.append(tile, label);
    if (!item.id.startsWith('saved-outfit-')) wrapper.append(remove);
    gallery.append(wrapper);
  }
  if (!gallery.children.length) {
    const empty = document.createElement('div');
    empty.className = 'gallery-empty';
    const icon = document.createElement('strong');
    icon.textContent = '＋';
    const caption = document.createElement('p');
    caption.textContent = `还没有${category}，点击上传添加`;
    empty.append(icon, caption);
    gallery.append(empty);
  }
  const selection = element('selected');
  selection.replaceChildren();
  for (const item of selected) {
    const wrapper = document.createElement('div');
    wrapper.className = 'selected-item';
    const label = document.createElement('span');
    label.textContent = item.category;
    const remove = document.createElement('button');
    remove.textContent = '×';
    remove.setAttribute('aria-label', `取消${item.name}`);
    remove.onclick = () => {
      if (busy || running) return;
      selected = selected.filter((entry) => entry.id !== item.id);
      invalidateLook();
      render();
    };
    wrapper.append(image(item), label, remove);
    selection.append(wrapper);
  }
  if (!selected.length) {
    const empty = document.createElement('p');
    empty.textContent = '从右侧衣橱选择，或直接上传喜欢的衣物。';
    selection.append(empty);
  }
  controls();
}
async function configuration() {
  try {
    const response = await fetch('/experiment/status', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as {
      configured: boolean;
      available: boolean;
      testBudget?: { remaining: number; limit: number };
    };
    available = data.configured && data.available;
    quota.textContent = !data.configured
      ? '尚未配置 Decart 密钥，本机摄像头与选衣仍可演示。'
      : data.testBudget?.remaining === 0
        ? `实时试衣测试次数已用完（${data.testBudget.limit}/${data.testBudget.limit}），需配置新的可用额度后才能继续；本机相机仍可使用。`
        : data.testBudget
        ? `现有测试批次剩余 ${data.testBudget.remaining} / ${data.testBudget.limit} 次 · 打开相机不消耗额度`
        : '服务已连接';
    element('status-dot').classList.toggle('ready', available);
  } catch {
    available = false;
    quota.textContent = '试穿服务未连接，请检查演示服务窗口。';
  }
  controls();
}
function finish(text: string, refresh = true) {
  generation++;
  window.clearTimeout(timeout);
  window.clearInterval(interval);
  timeout = 0;
  interval = 0;
  deadline = 0;
  frame?.remove();
  frame = null;
  output.replaceChildren();
  output.hidden = true;
  const previous = stream;
  stream = null;
  previous?.getTracks().forEach((track) => track.stop());
  camera.srcObject = null;
  camera.hidden = true;
  camera.classList.remove('inset-camera');
  busy = false;
  running = false;
  firstFrame = false;
  consent.checked = false;
  element('empty-camera').hidden = false;
  element('mirror-copy').hidden = false;
  element('view-label').textContent = '试衣镜已关闭';
  element('countdown').textContent = 'LIVE FITTING';
  message(text);
  controls();
  if (refresh) void configuration();
}
function deadlineReached() {
  finish(
    firstFrame
      ? '本次试穿已到时并关闭相机，可以选择下一套。'
      : '本次连接已到时，尚未显示首帧；未自动重试。',
  );
}
upload.onclick = () => files.click();
files.onchange = () => {
  if (busy || running || !files.files?.length) return;
  const chosen = [...files.files].slice(0, 30),
    chosenCategory = category,
    version = generation;
  files.value = '';
  busy = true;
  controls();
  message('正在本机准备衣物图片…');
  void (async () => {
    let successes = 0,
      failures = 0;
    for (const file of chosen) {
      try {
        const item = await importGarment(file, file.name, chosenCategory);
        if (version !== generation) return;
        await saveGarments([item]);
        if (version !== generation) return;
        wardrobe.push(item);
        selected = selectRealtimeGarment(selected, item);
        successes++;
      } catch {
        failures++;
      }
    }
    if (version !== generation) return;
    busy = false;
    invalidateLook();
    render();
    message(
      `已添加${successes}件${chosenCategory}，${failures ? `${failures}件无法读取或保存。` : '最后一件已选中，可点击缩略图切换。'}`,
    );
  })();
};
element('clear-selection').onclick = () => {
  if (running || busy) return;
  selected = [];
  invalidateLook();
  render();
};
preview.onclick = () => {
  if (running || busy || stream) return;
  const version = ++generation;
  busy = true;
  controls();
  message('正在打开电脑摄像头，不调用AI…');
  void (async () => {
    try {
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error();
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      if (version !== generation) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = next;
      camera.srcObject = next;
      camera.hidden = false;
      camera.classList.remove('inset-camera');
      await camera.play();
      if (version !== generation) return;
      next.getVideoTracks().forEach((track) =>
        track.addEventListener('ended', () => {
          if (stream === next) finish('摄像头已停止，连接已关闭。');
        }),
      );
      busy = false;
      element('empty-camera').hidden = true;
      element('mirror-copy').hidden = true;
      element('view-label').textContent = '本机摄像头预览 · 未调用AI';
      message('相机已就绪，让身体完整入镜，确认选衣后开始。');
      controls();
    } catch {
      if (version === generation)
        finish('相机未能打开，请允许Chrome摄像头权限并关闭其他占用相机的应用。');
    }
  })();
};
start.onclick = () => {
  if (busy || running) return;
  const reason = !selected.length
    ? '请先上传或选择试穿衣物。'
    : !stream
      ? '请先开启摄像头预览。'
      : !available
        ? quota.textContent || '实时试衣服务暂不可用，请检查服务连接。'
        : !consent.checked
          ? '请先勾选本次处理与额度消耗同意。'
          : '';
  if (reason) {
    message(reason);
    return;
  }
  const currentStream = stream!;
  const version = ++generation;
  busy = true;
  running = true;
  firstFrame = false;
  controls();
  message('正在准备所选衣物和实时视频连接…');
  timeout = window.setTimeout(() => finish('准备连接超时，已关闭摄像头；未自动重试。'), 20000);
  void (async () => {
    try {
      const reference = await referenceImage([...selected]);
      if (version !== generation) return;
      const session = document.createElement('iframe');
      session.title = 'Lucy实时试穿画面';
      session.src = '/session.html';
      frame = session;
      session.addEventListener(
        'load',
        () => {
          if (version !== generation || frame !== session) return;
          const target = session.contentWindow as SessionWindow | null;
          if (!target?.runLucy) {
            finish('实时视频模块加载失败，请刷新页面。');
            return;
          }
          target.runLucy({
            stream: currentStream,
            image: reference,
            nonce,
            prompt: TRY_ON_PROMPT,
          });
        },
        { once: true },
      );
      output.replaceChildren(session);
      output.hidden = false;
      camera.classList.add('inset-camera');
      element('view-label').textContent = '正在连接Lucy · 本机取景见小窗';
    } catch {
      if (version === generation) finish('衣物参考图无法准备，请重新选择图片。');
    }
  })();
};
window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
  const data = event.data as { type?: string; message?: string } | null;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'phase' && typeof data.message === 'string') message(data.message);
  else if (data.type === 'dial' && !deadline) {
    deadline = performance.now() + TOTAL_CONNECTION_MS;
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => finish('等待试穿画面超时，已结束连接；未自动重试。'), CONNECTION_WAIT_MS);
    interval = window.setInterval(() => {
      element('countdown').textContent =
        `${Math.max(0, Math.ceil((deadline - performance.now()) / 1000))}s REMAINING`;
    }, 100);
    void configuration();
  } else if (data.type === 'playing') {
    if (!firstFrame) {
      firstFrame = true;
      deadline = firstFrameDeadline(
        deadline || performance.now() + TOTAL_CONNECTION_MS,
        performance.now(),
      );
      window.clearTimeout(timeout);
      timeout = window.setTimeout(deadlineReached, Math.max(0, deadline - performance.now()));
    }
    element('view-label').textContent = 'LUCY · AI实时试穿';
    message('实时试穿中，可轻微转身；到时自动结束。');
    controls();
  } else if (data.type === 'failure' || data.type === 'ended')
    finish(typeof data.message === 'string' ? data.message : '本次连接已结束，未自动重试。');
});
stop.onclick = () => finish('已主动结束，摄像头已关闭。');
capture.onclick = () => {
  if (!running || !firstFrame) return;
  try {
    const video = frame?.contentDocument?.querySelector('video');
    if (!video?.videoWidth) throw new Error();
    const canvas = document.createElement('canvas');
    const region = portraitRegion(video.videoWidth, video.videoHeight);
    const cropWidth = region.width;
    const cropHeight = region.height;
    canvas.width = Math.max(1, Math.round(cropWidth));
    canvas.height = Math.max(1, Math.round(cropHeight));
    const context = canvas.getContext('2d');
    if (!context) throw new Error();
    context.drawImage(
      video,
      region.x,
      region.y,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const link = document.createElement('a');
    link.download = `OOTRIP-试穿-${Date.now()}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
    message('已按你的操作下载当前试穿画面。');
  } catch {
    message('当前画面尚不能保存，请等待试穿视频显示后重试。');
  }
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (busy || running || stream))
    finish('页面已切到后台，已结束并关闭摄像头。');
});
window.addEventListener('pagehide', () => finish('页面已关闭。', false));
window.addEventListener('offline', () => {
  if (stream || running) finish('网络已断开，已关闭摄像头，不自动重连。', false);
});
void readWardrobe()
  .then((items) => {
    wardrobe = items;
    render();
  })
  .catch(() => {
    render();
    message('浏览器衣橱无法读取，请使用普通浏览窗口后重试。');
  });
render();
void configuration();

window.addEventListener('message', (event: MessageEvent) => { if (event.source === window.parent && event.origin === location.origin && event.data?.type === 'ootrip:module-close') finish('已返回衣橱，摄像头已关闭。', false); });

element('categories').addEventListener('click',()=>document.querySelector('.wardrobe')?.classList.add('show-items'));
const categoryBack=document.createElement('button');categoryBack.className='quiet';categoryBack.textContent='‹ 分类';categoryBack.onclick=()=>document.querySelector('.wardrobe')?.classList.remove('show-items');document.querySelector('.gallery-top')?.prepend(categoryBack);

const selectedPanel=document.querySelector('.selection');if(selectedPanel)document.querySelector('.control-bar')?.prepend(selectedPanel);

horizontalScroll(document.getElementById('selected')!);
