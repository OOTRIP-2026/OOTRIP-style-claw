import {
  REALTIME_CATEGORIES,
  realtimeCategory,
  type RealtimeGarment,
} from '../../../miniprogram/wardrobe/realtime.js';
export {
  REALTIME_CATEGORIES,
  realtimeCategory,
  selectRealtimeGarment,
} from '../../../miniprogram/wardrobe/realtime.js';
export type Garment = RealtimeGarment;
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ootrip-html-demo-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('garments', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('浏览器衣橱无法打开，请关闭无痕模式后重试。'));
  });
}
export async function readWardrobe(): Promise<Garment[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('garments').objectStore('garments').getAll();
      request.onsuccess = () =>
        resolve(
          (request.result as Garment[]).filter(
            (item) =>
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              REALTIME_CATEGORIES.includes(item.category) &&
              /^data:image\/(png|jpeg|webp);base64,/.test(item.image),
          ),
        );
      request.onerror = () => reject(new Error('浏览器衣橱读取失败。'));
    });
  } finally {
    db.close();
  }
}
export async function saveGarments(items: readonly Garment[], remove = false) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('garments', 'readwrite');
      const store = transaction.objectStore('garments');
      for (const item of items) {
        if (remove) store.delete(item.id);
        else store.put(item);
      }
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(new Error('浏览器存储空间不足，未保存本次衣物。'));
      transaction.onerror = () => reject(new Error('浏览器衣橱保存失败。'));
    });
  } finally {
    db.close();
  }
}
export async function importGarment(
  blob: Blob,
  name: string,
  category: string,
  preserveAlpha = false,
): Promise<Garment> {
  const normalized = realtimeCategory(category);
  if (
    !normalized ||
    !['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) ||
    !blob.size ||
    blob.size > 5 * 1024 * 1024
  )
    throw new Error('请选择5MiB以内的PNG、JPEG或WebP衣物图片。');
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 25_000_000)
      throw new Error('图片像素过大，请缩小后上传。');
    const ratio = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法创建预览。');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      id: crypto.randomUUID(),
      name: name.replace(/\.[^.]+$/, '').slice(0, 100),
      category: normalized,
      image: canvas.toDataURL(preserveAlpha ? 'image/png' : 'image/jpeg', 0.9),
      purchased: true,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function referenceImage(selected: readonly Garment[]): Promise<string> {
  if (!selected.length || selected.length > 7) throw new Error('请先选择衣物。');
  if (selected.length === 1) return selected[0]!.image;
  const images = await Promise.all(
    selected.map(async (item) => {
      const image = new Image();
      image.src = item.image;
      await image.decode();
      return image;
    }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('参考图准备失败。');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 1024, 1024);
  const columns = selected.length <= 4 ? 2 : 3,
    rows = Math.ceil(selected.length / columns);
  images.forEach((image, index) => {
    const w = 1024 / columns,
      h = 1024 / rows,
      ratio = Math.min((w - 32) / image.naturalWidth, (h - 48) / image.naturalHeight);
    context.drawImage(
      image,
      (index % columns) * w + (w - image.naturalWidth * ratio) / 2,
      Math.floor(index / columns) * h + 16,
      image.naturalWidth * ratio,
      image.naturalHeight * ratio,
    );
    context.fillStyle = '#333';
    context.font = '18px sans-serif';
    context.fillText(
      selected[index]!.category,
      (index % columns) * w + 16,
      Math.floor(index / columns) * h + h - 12,
    );
  });
  return canvas.toDataURL('image/jpeg', 0.9);
}
