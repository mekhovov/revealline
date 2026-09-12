export const FILE_FIXTURE = Object.freeze({
  format: 'revealline-ios-file-check.v1',
  message: 'Local file transfer works.',
});
export function capabilities(env = globalThis) {
  return {
    href: env.location?.href ?? null,
    origin: env.location?.origin ?? null,
    secureContext: env.isSecureContext === true,
    platform: env.Capacitor?.getPlatform?.() ?? 'browser-or-unidentified',
    webLocks: typeof env.navigator?.locks?.request === 'function',
    indexedDB: typeof env.indexedDB?.open === 'function',
    structuredClone: typeof env.structuredClone === 'function',
    webCrypto: typeof env.crypto?.subtle?.digest === 'function',
    serviceWorker: !!env.navigator?.serviceWorker,
    gamepadAPI: typeof env.navigator?.getGamepads === 'function',
    pointerEvents: typeof env.PointerEvent === 'function',
    webAudio: typeof (env.AudioContext ?? env.webkitAudioContext) === 'function',
    fullscreen: typeof env.document?.documentElement?.requestFullscreen === 'function',
    webShare: typeof env.navigator?.share === 'function',
  };
}
const bounded = async (operation) => {
  let timer;
  try {
    return await Promise.race([
      operation(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Probe timed out.')), 5000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
const resultOf = async (operation) => {
  try {
    await bounded(operation);
    return { passed: true };
  } catch (error) {
    return { passed: false, error: String(error.message ?? error).slice(0, 400) };
  }
};
const requestResult = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
    request.onblocked = () => reject(new Error('IndexedDB request was blocked.'));
  });
async function indexedDBRoundtrip(indexedDB, id) {
  if (!indexedDB) throw new Error('IndexedDB is unavailable.');
  let db;
  try {
    const opening = indexedDB.open(id, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('probe');
    db = await requestResult(opening);
    await new Promise((resolve, reject) => {
      const tx = db.transaction('probe', 'readwrite');
      tx.objectStore('probe').put(FILE_FIXTURE, 'fixture');
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'));
    });
    db.close();
    db = await requestResult(indexedDB.open(id, 1));
    const read = await requestResult(db.transaction('probe').objectStore('probe').get('fixture'));
    if (read?.format !== FILE_FIXTURE.format || read?.message !== FILE_FIXTURE.message)
      throw new Error('IndexedDB reopened value does not match.');
  } finally {
    db?.close();
    await requestResult(indexedDB.deleteDatabase(id));
  }
}
/** Explicit scratch probes only; no game storage keys are accessed. */
export async function probeRuntime(env = globalThis) {
  const id = `revealline.ios-diagnostics.v1.${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const report = capabilities(env);
  report.localStorageRoundtrip = await resultOf(async () => {
    const store = env.localStorage;
    if (!store) throw new Error('Local storage is unavailable.');
    try {
      store.setItem(id, 'fixture');
      if (store.getItem(id) !== 'fixture') throw new Error('Local storage value does not match.');
    } finally {
      store.removeItem(id);
    }
  });
  report.webLockExclusion = await resultOf(async () => {
    if (!env.navigator?.locks?.request) throw new Error('Web Locks are unavailable.');
    await env.navigator.locks.request(id, { ifAvailable: true }, async (lock) => {
      if (!lock) throw new Error('Fresh scratch lock was unavailable.');
      await env.navigator.locks.request(id, { ifAvailable: true }, (contender) => {
        if (contender) throw new Error('Exclusive lock allowed a concurrent holder.');
      });
    });
    await env.navigator.locks.request(id, { ifAvailable: true }, (lock) => {
      if (!lock) throw new Error('Scratch lock did not release.');
    });
  });
  report.indexedDBRoundtrip = await resultOf(() => indexedDBRoundtrip(env.indexedDB, id));
  report.note =
    'Successful tiny probes do not establish long-term storage durability, file exports, physical controls or release readiness.';
  return report;
}
