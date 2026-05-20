const DB_NAME = "pkg-fs";
const STORE = "handles";
const KEY = "current";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSavedHandle(): Promise<FileSystemFileHandle | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () =>
        resolve((req.result as FileSystemFileHandle | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("getSavedHandle failed", e);
    return null;
  }
}

export async function setSavedHandle(
  handle: FileSystemFileHandle | null,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      if (handle) store.put(handle, KEY);
      else store.delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("setSavedHandle failed", e);
  }
}
