// Large image packs belong in IndexedDB, away from small localStorage profiles.
let database;
async function openDatabase() {
  if (!globalThis.indexedDB) throw new Error('This browser does not provide an asset database.');
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        database = null;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      database = null;
      reject(request.error);
    };
    request.onblocked = () => {
      database = null;
      reject(new Error('Close older game tabs to update the asset database.'));
    };
  });
  return database;
}
export async function readAssetStore(key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('assets').objectStore('assets').get(key);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}
export async function writeAssetStore(key, value, { signal, beforeWrite } = {}) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('assets', 'readwrite');
    let failure;
    const clean = () => signal?.removeEventListener('abort', cancel);
    const fail = (error) => {
      failure = error;
      try {
        transaction.abort();
      } catch {}
    };
    const cancel = () => fail(new DOMException('Asset storage was cancelled.', 'AbortError'));
    transaction.oncomplete = () => {
      clean();
      resolve();
    };
    transaction.onerror = () => {
      failure ??= transaction.error;
    };
    transaction.onabort = () => {
      clean();
      reject(failure || transaction.error || new Error('Asset storage was cancelled.'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
    const commit = (stored) => {
      try {
        if (signal?.aborted) return cancel();
        beforeWrite?.(stored);
        if (signal?.aborted) return cancel();
        transaction.objectStore('assets').put(value, key);
      } catch (error) {
        fail(error);
      }
    };
    if (beforeWrite) {
      // Opt-in writers compare the actual transaction snapshot, after database
      // opening/queueing, rather than a read performed before either await.
      const request = transaction.objectStore('assets').get(key);
      request.onsuccess = () => commit(request.result ?? null);
    } else commit();
  });
}
