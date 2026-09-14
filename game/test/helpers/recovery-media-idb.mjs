import { managedIndexedDB } from './managed-idb.mjs';

/** Small transactional model with enforced readonly recovery access and finite queries. */
export async function recoveryMediaFixture(
  entries = {},
  { version = 4, absent = false, extraStore = null } = {},
) {
  const model = managedIndexedDB(),
    opens = [],
    reads = [],
    controls = {};
  const names = [
    'metadata',
    'audio',
    'mediaRecords',
    'mediaBlobs',
    'managedState',
    'reservations',
    ...(version >= 4 ? ['storyRecords'] : []),
    ...(extraStore ? [extraStore] : []),
  ];
  async function seed(values) {
    await new Promise((resolve, reject) => {
      const request = model.indexedDB.open('revealline-soundtrack-v1', version);
      request.onupgradeneeded = () => {
        for (const name of names) request.result.createObjectStore(name);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result,
          tx = db.transaction(names, 'readwrite');
        for (const [name, rows] of Object.entries(values))
          for (const [key, value] of rows) tx.objectStore(name).put(value, key);
        tx.onabort = () => reject(tx.error);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }
  if (!absent) await seed(entries);
  const before = model.contents();
  model.allPuts.length = 0;
  function bounded(request, count) {
    const output = {};
    Object.defineProperties(output, {
      result: { get: () => request.result.slice(0, count) },
      error: { get: () => request.error },
    });
    request.onsuccess = () => output.onsuccess?.();
    request.onerror = () => output.onerror?.();
    return output;
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
        controls.versionchange = fn;
      },
      transaction(stores, mode) {
        if (mode !== 'readonly')
          throw new Error('Recovery attempted a writable media transaction.');
        const tx = db.transaction(stores, mode),
          get = tx.objectStore;
        tx.objectStore = (name) => {
          const store = get(name);
          return Object.fromEntries(
            ['get', 'getAll', 'getAllKeys'].map((method) => [
              method,
              (...args) => {
                reads.push([name, method, ...args]);
                controls.onRead?.(name, method, args);
                if (method === 'get') return store.get(...args);
                if (!Number.isInteger(args[1]) || args[1] < 1)
                  throw new Error('An unbounded media query was attempted.');
                return bounded(store[method](), args[1]);
              },
            ]),
          );
        };
        return tx;
      },
    };
  }
  const indexedDB = {
    open(name, requestedVersion) {
      opens.push({ name, requestedVersion });
      controls.onOpen?.(opens.length);
      if (name !== 'revealline-soundtrack-v1') throw new Error('Unexpected media database.');
      const request = model.indexedDB.open(name, requestedVersion),
        output = {};
      Object.defineProperties(output, {
        result: { get: () => (request.result ? database(request.result) : null) },
        transaction: { get: () => request.transaction },
        error: { get: () => request.error },
      });
      request.onupgradeneeded = (event) => output.onupgradeneeded?.(event);
      request.onerror = () => {
        controls.beforeError?.();
        output.onerror?.();
      };
      request.onblocked = () => output.onblocked?.();
      request.onsuccess = () => {
        if (controls.holdSuccess) controls.release = () => output.onsuccess?.();
        else output.onsuccess?.();
      };
      return output;
    },
  };
  return { indexedDB, model, before, opens, reads, controls, seed };
}
