import { readWardrobe, importGarment } from './store.js';
import {
  JOURNAL_RULES,
  WEATHER,
  MOODS,
  validDate,
  validateNote,
  selectPieces,
  type Entry,
  type Piece,
  type Recognition,
  type JournalState,
} from './journal-model.js';
import { entries as storage, readDraft, saveDraft } from './journal-storage.js';
import { compose, composeArtwork, loadImage, canvas } from './journal-renderer.js';
function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`缺少界面节点${id}`);
  return node as T;
}
const history = element('history'),
  editor = element('editor'),
  result = element('result');
const time = element<HTMLInputElement>('record-time'),
  note = element<HTMLTextAreaElement>('note'),
  consent = element<HTMLInputElement>('recognize');
const loading = element<HTMLDialogElement>('loading');
let photo = '',
  sourceName = '',
  weather = '',
  mood = '';
let original: Blob | undefined,
  recognition: Recognition | null = null,
  current: Entry | undefined,
  editId: string | null = null;
let entries: Entry[] = [],
  busy = false,
  saved = true,
  restoring = true,
  controller: AbortController | undefined;
let manualPieces: Piece[] = [];
let artwork = '',
  artworkModel = '';
let artworkVersion = 3;
const mode = element<HTMLSelectElement>('journal-mode');
let serviceStatus: { configured: boolean; message: string } | undefined;
let artworkStatus: { configured: boolean; message: string } | undefined;
function refreshService() {
  const ai = mode.value === 'ai-paper';
  const status = ai ? artworkStatus : undefined;
  element('manual-panel').hidden = ai;
  element('generate').textContent = ai ? '确认，生成AI剪贴手账' : '生成本机拼贴';
  consent.closest<HTMLElement>('.consent')!.hidden = !ai;
  if (!ai) void openManual();
  consent.disabled = !status?.configured;
  element('consent-label').textContent = ai
    ? '我同意将本次照片发送至阿里云百炼生成一张AI剪贴手账，并消耗图像模型额度。AI可能重绘细节。'
    : '我同意将本次照片发送至阿里云百炼识别可见衣物，并消耗识别模型额度。不勾选只在本机排版。';
}
mode.onchange = () => {
  consent.checked = false;
  refreshService();
  persistDraft();
};
function state(value: JournalState, message: string) {
  document.body.dataset.state = value;
  element('loading-phase').textContent = message;
}
function showError(value: unknown) {
  const message = value instanceof Error ? value.message : '操作失败，请重试。';
  element('error').textContent = message;
  if (!result.hidden) element('result-note').textContent = message;
  if (!history.hidden) element('history-status').textContent = message;
}
function screen(name: 'history' | 'editor' | 'result') {
  history.hidden = name !== 'history';
  editor.hidden = name !== 'editor';
  result.hidden = name !== 'result';
  window.scrollTo(0, 0);
}
function setPhoto() {
  const image = element<HTMLImageElement>('photo-preview');
  if (photo) image.src = photo;
  else image.removeAttribute('src');
  image.hidden = !photo;
  element<HTMLInputElement>('photo').required = !photo;
}
function refreshOptions() {
  for (const id of ['weather', 'mood'])
    for (const button of element(id).children)
      button.setAttribute(
        'aria-pressed',
        String(button.textContent === (id === 'weather' ? weather : mood)),
      );
  element('note-count').textContent = `${Array.from(note.value).length}/300字`;
}
function persistDraft() {
  if (restoring) return;
  void saveDraft({
    sourceImage: photo,
    manualPieces,
    artwork,
    artworkModel,
    artworkVersion,
    mode: mode.value === 'ai-paper' ? 'ai-paper' : 'standard',
    ...(original ? { sourceOriginal: original } : {}),
    sourceName,
    date: time.value,
    weatherId: WEATHER.find((v) => v.emoji === weather)?.id ?? null,
    moodId: MOODS.find((v) => v.emoji === mood)?.id ?? null,
    note: note.value,
    editId,
    recognition,
    updatedAt: new Date().toISOString(),
  }).catch(showError);
}
function resetDate() {
  const now = new Date();
  time.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
for (const [id, values] of [
  ['weather', WEATHER],
  ['mood', MOODS],
] as const) {
  for (const option of values) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.emoji;
    button.title = option.label;
    button.setAttribute('aria-label', option.label);
    button.setAttribute('aria-pressed', 'false');
    button.onclick = () => {
      if (busy) return;
      const value = button.getAttribute('aria-pressed') === 'true' ? '' : option.emoji;
      if (id === 'weather') weather = value;
      else mood = value;
      refreshOptions();
      persistDraft();
    };
    element(id).append(button);
  }
}
element('new-record').onclick = () => screen('editor');
function journalBack() {
  if (busy) return;
  if (!editor.hidden) { persistDraft(); screen('history'); }
  else if (!result.hidden) element('result-back').click();
  else if (window.parent !== window) window.parent.postMessage({type:'ootrip:journal-exit'},location.origin);
}
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source === window.parent && event.origin === location.origin && event.data?.type === 'ootrip:journal-back') journalBack();
});
element('result-back').onclick = () => {
  if (!saved && !window.confirm('这张预览尚未保存，确认返回？原照片和文字草稿仍保留。')) return;
  render();
  screen('history');
};
async function choose(input: HTMLInputElement) {
  const file = input.files?.[0];
  if (!file || busy) return;
  busy = true;
  state('uploading', '正在处理本机照片…');
  element<HTMLButtonElement>('generate').disabled = true;
  try {
    const normalized = await importGarment(file, '穿搭照片', '上衣');
    photo = normalized.image;
    original = file;
    sourceName = file.name;
    recognition = null;
    artwork = '';
    artworkModel = '';
    consent.checked = false;
    setPhoto();
    persistDraft();
    state('ready', '照片已就绪');
    element('error').textContent = '';
  } catch (value) {
    state('failed', '照片处理失败');
    showError(value);
  } finally {
    busy = false;
    input.value = '';
    element<HTMLButtonElement>('generate').disabled = false;
  }
}
for (const id of ['photo']) {
  const input = element<HTMLInputElement>(id);
  input.onchange = () => void choose(input);
}
element('remove-photo').onclick = () => {
  if (busy) return;
  photo = '';
  original = undefined;
  recognition = null;
  artwork = '';
  artworkModel = '';
  sourceName = '';
  consent.checked = false;
  setPhoto();
  persistDraft();
  state('idle', '请选择照片');
};
let draftTimer: number | undefined;
element('rotate-photo').onclick = () => {
  if (!photo || busy) return;
  busy = true;
  void loadImage(photo)
    .then((image) => {
      const { target, ctx } = canvas(image.height, image.width);
      ctx.translate(target.width / 2, target.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      photo = target.toDataURL('image/jpeg', 0.9);
      recognition = null;
      artwork = '';
      artworkModel = '';
      consent.checked = false;
      setPhoto();
      persistDraft();
    })
    .catch(showError)
    .finally(() => {
      busy = false;
    });
};
note.oninput = () => {
  refreshOptions();
  window.clearTimeout(draftTimer);
  draftTimer = window.setTimeout(persistDraft, 250);
};
time.onchange = persistDraft;
function showResult(entry: Entry) {
  current = entry;
  element('new-artwork').hidden = entry.mode !== 'ai-paper';
  element('regenerate').textContent =
    entry.mode === 'ai-paper' ? '调整文字排版（不调用AI）' : '换一种排版';
  element<HTMLImageElement>('scrapbook').src = entry.image;
  element('full-note').textContent = entry.note;
  element('full-note').hidden = !entry.note;
  element('result-note').textContent =
    (entry.mode === 'ai-paper'
      ? 'AI剪贴手账：参考原照片生成，人物及衣物细节可能重绘，非精确抠图。'
      : entry.pieces.some((piece) => piece.extraction === 'manual')
        ? '手动拼贴：使用原照片与自行选择的单品图片，不调用AI，未自动抠图。'
        : entry.recognized
          ? '单品来自识别区域裁片，可能带有背景；尚非精确抠图。'
          : '本机纸艺拼贴：使用真实照片，没有发送AI。') +
    (entry.noteOutsideImage ? ' 文字较长，完整保留在图片下方及记录中，未截断。' : '');
  const button = element<HTMLButtonElement>('save-entry');
  button.disabled = saved;
  button.textContent = saved ? '已保存到手账' : '确认保存到手账';
  screen('result');
}
async function generate(localOnly = false) {
  if (busy) return;
  if (!photo || !validDate(time.value)) {
    showError(new Error('请先选择照片和有效日期。'));
    return;
  }
  try {
    validateNote(note.value);
  } catch (value) {
    showError(value);
    return;
  }
  const aiArtwork = !localOnly && mode.value === 'ai-paper';
  if (aiArtwork && !artwork && !consent.checked) {
    showError(new Error('请先勾选本次AI图像处理同意，或选择本机手账。'));
    return;
  }
  if (aiArtwork && !artwork && !artworkStatus?.configured) {
    showError(new Error(artworkStatus?.message ?? '正在检查图像服务，请稍后再试。'));
    return;
  }
  busy = true;
  controller = new AbortController();
  const active = controller;
  const snapshot = { time: time.value, weather, mood, note: note.value };
  const source = photo;
  const submit = element<HTMLButtonElement>('generate');
  submit.disabled = true;
  element('error').textContent = '';
  loading.showModal();
  persistDraft();
  try {
    let analysis = localOnly || aiArtwork ? null : recognition;
    if (aiArtwork && !artwork) {
      state('recognizing', 'AI正在制作人物与单品剪贴，通常需要等待，暂不重复点击…');
      const response = await fetch('/journal/artwork', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lucy-experiment':
            document.querySelector<HTMLMetaElement>('meta[name=lucy-experiment]')?.content ?? '',
        },
        body: JSON.stringify({ image: source, consent: true, requestId: crypto.randomUUID() }),
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(250000)]),
      });
      const data = (await response.json()) as { image?: string; model?: string; message?: string };
      if (!response.ok || !data.image?.startsWith('data:image/png;base64,'))
        throw new Error(data.message ?? 'AI手账结果无效，未自动重试。');
      artwork = data.image;
      artworkModel = data.model ?? 'qwen-image-2.0';
      artworkVersion = 4;
      persistDraft();
    }
    if (!localOnly && !aiArtwork && consent.checked && !analysis) {
      state('recognizing', '正在请求衣物识别…');
      const response = await fetch('/journal/recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-lucy-experiment':
            document.querySelector<HTMLMetaElement>('meta[name=lucy-experiment]')?.content ?? '',
        },
        body: JSON.stringify({ image: source, consent: true }),
        signal: AbortSignal.any([active.signal, AbortSignal.timeout(50000)]),
      });
      const data = (await response.json()) as Recognition & { message?: string };
      if (!response.ok) throw new Error(data.message ?? '识别失败，可选择下方本机手账继续。');
      analysis = { items: data.items, ...(data.person ? { person: data.person } : {}) };
      recognition = analysis;
      persistDraft();
    }
    active.signal.throwIfAborted();
    state('composing', '正在整理真实照片与单品区域…');
    const pieces: Piece[] = localOnly ? [...manualPieces] : [];
    if (analysis) {
      const image = await loadImage(source);
      for (const item of selectPieces(analysis.items)) {
        const [x1, y1, x2, y2] = item.box;
        const w = ((x2 - x1) * image.width) / 1000,
          h = ((y2 - y1) * image.height) / 1000;
        const scale = Math.min(1, 320 / Math.max(w, h));
        const { target, ctx } = canvas(
          Math.max(1, Math.round(w * scale)),
          Math.max(1, Math.round(h * scale)),
        );
        ctx.drawImage(
          image,
          (x1 * image.width) / 1000,
          (y1 * image.height) / 1000,
          w,
          h,
          0,
          0,
          target.width,
          target.height,
        );
        pieces.push({
          name: item.name,
          image: target.toDataURL('image/jpeg', 0.9),
          width: target.width,
          height: target.height,
          box: item.box,
          extraction: 'region-crop',
          ...(item.confidence != null ? { confidence: item.confidence } : {}),
        });
      }
    }
    for (const piece of pieces) {
      if (piece.extraction === 'manual') {
        const image = await loadImage(piece.image);
        piece.width = image.width;
        piece.height = image.height;
      }
    }
    state('rendering', '正在绘制纸张、照片与个人记录…');
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const rendered = aiArtwork
      ? await composeArtwork(artwork, snapshot, 0, artworkVersion >= 4)
      : await compose(source, pieces, snapshot);
    active.signal.throwIfAborted();
    const now = new Date().toISOString();
    const entry: Entry = {
      id: editId ?? crypto.randomUUID(),
      ...snapshot,
      ...rendered,
      pieces,
      manualPieces: [...manualPieces],
      recognized: analysis !== null,
      schemaVersion: 2,
      sourceImage: source,
      ...(original ? { sourceOriginal: original } : {}),
      sourceName,
      recognition: analysis,
      weatherId: WEATHER.find((v) => v.emoji === weather)?.id ?? null,
      moodId: MOODS.find((v) => v.emoji === mood)?.id ?? null,
      mode: aiArtwork ? 'ai-paper' : 'standard',
      ...(aiArtwork ? { artwork, artworkModel, artworkVersion } : {}),
      layoutVersion: rendered.layout.version,
      renderVersion: aiArtwork ? rendered.layout.version : JOURNAL_RULES.renderVersion,
      createdAt: entries.find((v) => v.id === editId)?.createdAt ?? now,
      updatedAt: now,
      status: 'completed',
    };
    saved = false;
    showResult(entry);
    state('completed', '预览完成，确认后保存记录');
  } catch (value) {
    state('failed', '生成未完成');
    showError(value);
  } finally {
    loading.close();
    busy = false;
    submit.disabled = false;
  }
}
element<HTMLFormElement>('record-form').onsubmit = (event) => {
  event.preventDefault();
  void generate(mode.value !== 'ai-paper');
};
const cancel = () =>
  controller?.abort(new Error('已取消本地等待；已发送的识别可能仍完成，不自动重试。'));
loading.addEventListener('cancel', cancel);
element('cancel-generation').onclick = cancel;
window.addEventListener('pagehide', cancel);
element('save-entry').onclick = () => {
  if (!current || busy || saved) return;
  busy = true;
  state('saving', '正在保存到当前浏览器…');
  const button = element<HTMLButtonElement>('save-entry');
  button.disabled = true;
  button.textContent = '正在保存…';
  void storage(current)
    .then(async (values) => {
      entries = values;
      saved = true;
      button.textContent = '已保存到手账';
      window.clearTimeout(draftTimer);
      await saveDraft(null);
      manualPieces = [];
      renderManual();
      photo = '';
      original = undefined;
      recognition = null;
      artwork = '';
      artworkModel = '';
      note.value = '';
      weather = '';
      mood = '';
      editId = null;
      setPhoto();
      refreshOptions();
      resetDate();
      render();
      state('completed', '已保存');
    })
    .catch((value) => {
      showError(value);
      button.textContent = saved ? '记录已保存，草稿清理失败' : '重试保存';
    })
    .finally(() => {
      busy = false;
      button.disabled = saved;
    });
};
element('edit-entry').onclick = () => {
  if (!current || busy) return;
  manualPieces = (current.manualPieces ?? []).map((piece) => ({ ...piece }));
  renderManual();
  photo = current.sourceImage ?? '';
  original = current.sourceOriginal;
  sourceName = current.sourceName ?? '';
  time.value = current.time.slice(0, 10);
  weather = current.weather;
  mood = current.mood;
  note.value = current.note;
  recognition = current.recognition ?? null;
  artwork = current.artwork ?? '';
  artworkModel = current.artworkModel ?? '';
  artworkVersion = current.artworkVersion ?? 3;
  mode.value = current.mode ?? 'standard';
  refreshService();
  editId = current.id;
  consent.checked = false;
  setPhoto();
  refreshOptions();
  screen('editor');
  persistDraft();
  if (!photo) showError(new Error('旧记录未保存原照片，请重新上传后编辑。'));
  else element('error').textContent = recognition ? '沿用该照片已有的识别结果，不重复发送AI。' : '';
};
element('regenerate').onclick = () => {
  if (busy) return;
  if (!current?.sourceImage) {
    showError(new Error('旧记录请先编辑并补充原照片。'));
    return;
  }
  busy = true;
  const entry = current;
  void (
    entry.mode === 'ai-paper' && entry.artwork
      ? composeArtwork(
          entry.artwork,
          entry,
          (entry.layout?.variant ?? 0) + 1,
          (entry.artworkVersion ?? 3) >= 4,
        )
      : compose(current.sourceImage, entry.pieces, entry, (entry.layout?.variant ?? 0) + 1)
  )
    .then((rendered) => {
      saved = false;
      showResult({ ...entry, ...rendered, updatedAt: new Date().toISOString() });
    })
    .catch(showError)
    .finally(() => {
      busy = false;
    });
};
function download() {
  if (!current) return;
  const link = document.createElement('a');
  link.href = current.image;
  link.download = `OOTRIP-${current.time.slice(0, 10)}.png`;
  link.click();
}
element('download').onclick = download;
element('share').onclick = () => {
  if (!current) return;
  const entry = current;
  void (async () => {
    const blob = await (await fetch(entry.image)).blob();
    const file = new File([blob], `OOTRIP-${entry.time.slice(0, 10)}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '我的穿衣手账' });
      } catch (value) {
        if (!(value instanceof DOMException && value.name === 'AbortError')) showError(value);
      }
    } else {
      download();
      element('result-note').textContent =
        '当前浏览器不支持直接分享，已提供图片下载，请从相册或下载目录分享。';
    }
  })().catch(showError);
};
resetDate();
state('idle', '请选择照片');
void storage()
  .then((values) => {
    entries = values;
    render();
  })
  .catch(showError);
void readDraft()
  .then((draft) => {
    if (draft) {
      manualPieces = draft.manualPieces ?? [];
      renderManual();
      photo = draft.sourceImage;
      original = draft.sourceOriginal;
      sourceName = draft.sourceName;
      time.value = draft.date;
      weather = WEATHER.find((v) => v.id === draft.weatherId)?.emoji ?? '';
      mood = MOODS.find((v) => v.id === draft.moodId)?.emoji ?? '';
      note.value = draft.note;
      editId = draft.editId;
      recognition = draft.recognition;
      artwork = draft.artwork ?? '';
      artworkModel = draft.artworkModel ?? '';
      artworkVersion = draft.artworkVersion ?? 3;
      mode.value = draft.mode ?? 'ai-paper';
      refreshService();
      setPhoto();
      refreshOptions();
      element('history-status').textContent = '已恢复未完成草稿，点击记录今天穿搭继续。';
    }
  })
  .catch(showError)
  .finally(() => {
    restoring = false;
  });
void fetch('/journal/status')
  .then((response) => response.json())
  .then((data: { configured: boolean; message: string }) => {
    serviceStatus = data;
    refreshService();
  })
  .catch(() => {
    serviceStatus = { configured: false, message: '识别服务不可用，仍可制作本机手账。' };
    refreshService();
  });
function render() {
  const list = element('records');
  list.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const star = document.createElement('span');
    star.textContent = '✧';
    empty.append(star, document.createTextNode('还没有记录，留住今天的第一套穿搭吧。'));
    list.append(empty);
    return;
  }
  let month = '';
  for (const entry of [...entries].sort((a, b) => b.time.localeCompare(a.time))) {
    const date = new Date(`${entry.time.slice(0, 10)}T00:00:00`);
    const group = `${date.getFullYear()}年${date.getMonth() + 1}月`;
    if (group !== month) {
      const title = document.createElement('h2');
      title.className = 'month';
      title.textContent = group;
      list.append(title);
      month = group;
    }
    const row = document.createElement('article');
    row.className = 'record';
    const dateBox = document.createElement('div');
    dateBox.className = 'date';
    const day = document.createElement('strong');
    day.textContent = String(date.getDate());
    const weekday = document.createElement('small');
    weekday.textContent = `周${'日一二三四五六'[date.getDay()]}`;
    const emojis = document.createElement('div');
    emojis.className = 'emojis';
    for (const value of [entry.weather, entry.mood].filter(Boolean)) {
      const badge = document.createElement('span');
      badge.textContent = value;
      emojis.append(badge);
    }
    dateBox.append(day, weekday, emojis);
    const pieces = document.createElement('div');
    pieces.className = 'pieces';
    if (entry.pieces.length)
      for (const piece of entry.pieces) {
        const image = document.createElement('img');
        image.src = piece.image;
        image.alt = piece.name;
        image.title = `${piece.name}（${piece.extraction === 'manual' ? '手动选择' : '识别区域裁片'}）`;
        pieces.append(image);
      }
    else {
      const image = document.createElement('img');
      image.src = entry.image;
      image.alt = '手账封面，未识别单品';
      pieces.append(image);
      const label = document.createElement('small');
      label.textContent =
        entry.mode === 'ai-paper'
          ? 'AI剪贴手账'
          : entry.recognized
            ? '未检测到可见衣物'
            : '本机拼贴 · 未识别衣物';
      pieces.append(label);
    }
    const actions = document.createElement('div');
    actions.className = 'record-actions';
    const open = document.createElement('button');
    open.textContent = '查看';
    open.onclick = () => {
      saved = true;
      showResult(entry);
    };
    const remove = document.createElement('button');
    remove.textContent = '删除';
    remove.onclick = () => {
      if (!window.confirm('删除这条手账和本机图片？已下载的图片不受影响。')) return;
      void storage(undefined, entry.id)
        .then((values) => {
          entries = values;
          render();
        })
        .catch(showError);
    };
    actions.append(open, remove);
    row.append(dateBox, pieces, actions);
    list.append(row);
  }
}

void fetch('/journal/artwork/status')
  .then((response) => response.json())
  .then((data: { configured: boolean; message: string }) => {
    artworkStatus = data;
    refreshService();
  })
  .catch(() => {
    artworkStatus = { configured: false, message: '图像服务暂不可用，请重启HTML服务后再试。' };
    refreshService();
  });
element('new-artwork').onclick = () => {
  if (busy || !current) return;
  element('edit-entry').click();
  artwork = '';
  artworkModel = '';
  consent.checked = false;
  persistDraft();
  element('error').textContent = '下次生成会重新调用图像模型并消耗额度，请勾选本次同意后确认。';
};

function renderManual() {
  const list = element('manual-selected');
  list.replaceChildren();
  manualPieces.forEach((piece, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    const image = document.createElement('img');
    image.src = piece.image;
    image.alt = piece.name;
    button.append(image, document.createTextNode(piece.name + ' ×移除'));
    button.onclick = () => {
      if (busy) return;
      manualPieces.splice(index, 1);
      renderManual();
      persistDraft();
    };
    list.append(button);
  });
  for (const button of element('manual-wardrobe').querySelectorAll('button'))
    button.setAttribute(
      'aria-pressed',
      String(manualPieces.some((p) => p.image === button.dataset.image)),
    );
}
function addManual(piece: Piece) {
  if (manualPieces.some((p) => p.image === piece.image)) return;
  if (manualPieces.length >= JOURNAL_RULES.maxItems) throw new Error('最多选择4件，请先移除一件。');
  manualPieces.push({ ...piece, extraction: 'manual' });
  renderManual();
  persistDraft();
}
async function openManual() {
  const panel = element('manual-panel');
  panel.hidden = false;
  const list = element('manual-wardrobe');
  list.replaceChildren();
  try {
    const garments = await readWardrobe();
    for (const garment of garments) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.image = garment.image;
      const image = document.createElement('img');
      image.src = garment.image;
      image.alt = garment.name;
      button.append(image, document.createTextNode(garment.name));
      button.onclick = () => {
        if (busy) return;
        try {
          const index = manualPieces.findIndex((p) => p.image === garment.image);
          if (index >= 0) manualPieces.splice(index, 1);
          else addManual({ name: garment.name, image: garment.image, category: garment.category });
          renderManual();
          persistDraft();
        } catch (error) {
          manualError(error);
        }
      };
      list.append(button);
    }
    element('manual-message').textContent = garments.length
      ? '点击衣物选择或取消。'
      : '当前浏览器衣橱为空，可以直接上传单品，也可以只用原照片排版。';
    renderManual();
  } catch (error) {
    manualError(error);
  }
}
function manualError(error: unknown) {
  element('manual-message').textContent =
    error instanceof Error ? error.message : '单品处理失败，请重试。';
}
element('supplement').onclick = () => {
  if (busy || !current) return;
  element('edit-entry').click();
  mode.value = 'standard';
  consent.checked = false;
  refreshService();
  persistDraft();
  element('manual-panel').scrollIntoView({ block: 'start', behavior: 'smooth' });
};
element<HTMLInputElement>('manual-upload').onchange = async () => {
  const input = element<HTMLInputElement>('manual-upload');
  if (busy) return;
  busy = true;
  try {
    for (const file of Array.from(input.files ?? [])) {
      if (manualPieces.length >= JOURNAL_RULES.maxItems)
        throw new Error('已保留前4件单品；最多选择4件。');
      const garment = await importGarment(file, file.name, '上衣', true);
      const image = await loadImage(garment.image);
      addManual({
        name: garment.name,
        image: garment.image,
        width: image.width,
        height: image.height,
      });
    }
    element('manual-message').textContent = '已添加并选中，点击“生成本机拼贴”即可制作。';
  } catch (error) {
    manualError(error);
  } finally {
    busy = false;
    input.value = '';
  }
};

