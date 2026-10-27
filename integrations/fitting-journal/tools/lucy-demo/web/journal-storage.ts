import type { Entry, JournalDraft } from './journal-model.js';
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('ootrip-journal-v1', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('entries'))
        db.createObjectStore('entries', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(new Error('手账存储无法打开，请使用普通浏览模式。'));
    request.onblocked = () => reject(new Error('请关闭其他旧版手账窗口后重试。'));
  });
}
export async function entries(entry?: Entry, remove?: string): Promise<Entry[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('entries', entry || remove ? 'readwrite' : 'readonly');
      const store = tx.objectStore('entries');
      if (entry) store.put(entry);
      if (remove) store.delete(remove);
      const read = store.getAll();
      tx.oncomplete = () => resolve(read.result as Entry[]);
      tx.onabort = tx.onerror = () =>
        reject(new Error('手账保存失败，可能空间不足；预览仍保留，可先下载再重试。'));
    });
  } finally {
    db.close();
  }
}
export async function readDraft(): Promise<JournalDraft | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction('drafts').objectStore('drafts').get('current');
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(new Error('草稿读取失败。'));
    });
  } finally {
    db.close();
  }
}
let writes: Promise<void> = Promise.resolve();
export function saveDraft(value: JournalDraft | null): Promise<void> {
  const task = async () => {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite');
        const store = tx.objectStore('drafts');
        if (value) store.put(value, 'current');
        else store.delete('current');
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(new Error('草稿未能保存，请保持本页打开。'));
      });
    } finally {
      db.close();
    }
  };
  writes = writes.catch(() => undefined).then(task);
  return writes;
}
