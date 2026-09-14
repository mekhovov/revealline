import { managedIndexedDB } from './managed-idb.mjs';

/** Existing transactional model with exact-key presence and bounded-key request adapters. */
export async function profileAssetFixture(entries = [], { version = 1, absent = false } = {}) {
  const model = managedIndexedDB(),
    opens = [],
    reads = [];
  if (!absent)
    await new Promise((resolve, reject) => {
      const open = model.indexedDB.open('revealline-assets-v1', version);
      open.onupgradeneeded = () => open.result.createObjectStore('assets');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('assets', 'readwrite');
        for (const [key, value] of entries) tx.objectStore('assets').put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onabort = () => reject(tx.error);
      };
    });
  const before = model.contents();
  model.allPuts.length = 0;
  function mapped(request, transform) {
    const out = {};
    Object.defineProperties(out, {
      result: { get: () => transform(request.result) },
      error: { get: () => request.error },
    });
    request.onsuccess = () => out.onsuccess?.();
    request.onerror = () => out.onerror?.();
    return out;
  }
  function database(db) {
    return {
      get version() {
        return db.version;
      },
      get objectStoreNames() {
        return db.objectStoreNames;
      },
      close: () => db.close(),
      set onversionchange(fn) {
        db.onversionchange = fn;
      },
      transaction(name, mode) {
        if (mode !== 'readonly') throw new Error('Recovery must not write an asset transaction.');
        const tx = db.transaction(name, mode),
          getStore = tx.objectStore;
        tx.objectStore = (storeName) => {
          const store = getStore(storeName);
          return {
            get(key) {
              reads.push(['get', key]);
              return store.get(key);
            },
            count(key) {
              reads.push(['count', key]);
              return mapped(store.getAllKeys(), (keys) => keys.filter((k) => k === key).length);
            },
            getAllKeys(query, count) {
              reads.push(['keys', query, count]);
              return mapped(store.getAllKeys(), (keys) => keys.slice(0, count));
            },
          };
        };
        return tx;
      },
    };
  }
  const controls = { beforeError: null, holdSuccess: false, release: null };
  const indexedDB = {
    open(name, requestedVersion) {
      opens.push({ name, requestedVersion });
      if (name !== 'revealline-assets-v1') throw new Error('Shared media must not be opened.');
      const request = model.indexedDB.open(name, requestedVersion),
        out = {};
      Object.defineProperties(out, {
        result: { get: () => (request.result ? database(request.result) : null) },
        error: { get: () => request.error },
        transaction: { get: () => request.transaction },
      });
      request.onupgradeneeded = (event) => out.onupgradeneeded?.(event);
      request.onerror = () => {
        controls.beforeError?.();
        out.onerror?.();
      };
      request.onblocked = () => out.onblocked?.();
      request.onsuccess = () => {
        if (controls.holdSuccess) controls.release = () => out.onsuccess?.();
        else out.onsuccess?.();
      };
      return out;
    },
  };
  return { model, indexedDB, opens, reads, before, controls };
}
