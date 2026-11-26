import type { MediaItem } from '../types/media';

const DB_NAME = 'KalaVaultLocalArchive';
const DB_VERSION = 1;
const STORE_NAME = 'libraryState';
const STATE_KEY = 'primaryVault';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLibraryLocally(items: MediaItem[]): Promise<void> {
  try {
    // Only persist non-blob-URL metadata (or full demo items) so reloads stay reliable
    const serializable = items.filter((item) => !item.src.startsWith('blob:'));
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(serializable, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful no-op if storage quota or private mode blocks IndexedDB
  }
}

export async function loadLibraryLocally(): Promise<MediaItem[] | null> {
  try {
    const db = await openDb();
    return await new Promise<MediaItem[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
      req.onsuccess = () => {
        const res = req.result;
        resolve(Array.isArray(res) && res.length > 0 ? res : null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearLocalLibrary(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
