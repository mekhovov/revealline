import { boundedJSON, canonicalJSON, required } from './data-json.mjs';
import { PACK_LIMITS } from './packs.mjs';
import { abortExternalChapter } from './external-chapter.mjs';

const own = (v) =>
  boundedJSON(v, {
    maxBytes: PACK_LIMITS.libraryBytes * 3 + 1024 * 1024,
    maxString: PACK_LIMITS.libraryBytes,
    maxNodes: 900000,
    maxDepth: 28,
    maxArray: 4096,
  });
/** Same existing asset DB/store. Pointer/index/journal publish in one native transaction.
 * No schema addition, profile/session write, media DB access or runtime adoption.
 */
export function createExternalChapterPointerStore({
  indexedDB = globalThis.indexedDB,
  profileKey,
  packsKey,
} = {}) {
  required(
    typeof profileKey === 'string' &&
      /^revealline\.library\.(?:dev|release-v?(?:0|[1-9]\d{0,4})\.(?:0|[1-9]\d{0,4})\.(?:0|[1-9]\d{0,4}))\.v1$/.test(
        profileKey,
      ),
    'Use an exact supported profile channel.',
  );
  required(
    packsKey === profileKey.replace('revealline.library.', 'revealline.packs.'),
    'Pack channel must match the profile channel.',
  );
  required(typeof indexedDB?.open === 'function', 'IndexedDB is required for chapter publication.');
  const keys = Object.freeze({
    profileKey,
    packsKey,
    writerKey: `${profileKey}.writer`,
    lockKey: `${profileKey}.backup-lock`,
    backupJournalKey: `${profileKey}.backup-journal`,
    journalKey: `${profileKey}.external-chapter-journal.v1`,
    indexKey: `${profileKey}.external-chapter-index.v1`,
  });
  let closed = false;
  async function open(signal) {
    abortExternalChapter(signal);
    required(!closed, 'Chapter pointer store is closed.');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('revealline-assets-v1', 1);
      let done = false;
      const finish = (error, db) => {
        if (done) {
          db?.close();
          return;
        }
        done = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
        if (error) reject(error);
        else resolve(db);
      };
      const cancel = () =>
        finish(new DOMException('Chapter database open cancelled.', 'AbortError'));
      const timer = setTimeout(() => finish(new Error('Chapter database open timed out.')), 15000);
      signal?.addEventListener('abort', cancel, { once: true });
      request.onupgradeneeded = () => {
        if (done || closed || signal?.aborted) {
          request.transaction.abort();
          return;
        }
        request.result.createObjectStore('assets');
      };
      request.onsuccess = () => {
        if (closed || signal?.aborted) {
          request.result.close();
          cancel();
          return;
        }
        finish(null, request.result);
      };
      request.onerror = () => finish(request.error ?? new Error('Chapter database open failed.'));
      request.onblocked = () => finish(new Error('Chapter database is blocked; close older tabs.'));
      if (signal?.aborted) cancel();
    });
  }
  async function transaction(expected, next, { signal, guard = () => {} } = {}) {
    // Snapshot caller objects before the asynchronous database boundary.
    expected = expected === undefined ? undefined : own(expected);
    next = next === undefined ? undefined : own(next);
    const db = await open(signal);
    try {
      abortExternalChapter(signal);
      required(!closed, 'Chapter pointer store is closed.');
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('assets', expected === undefined ? 'readonly' : 'readwrite'),
          store = tx.objectStore('assets');
        let left = 4,
          failure,
          result;
        const values = {},
          names = {
            packs: keys.packsKey,
            journal: keys.journalKey,
            backup: keys.backupJournalKey,
            index: keys.indexKey,
          };
        const fail = (error) => {
          failure = error;
          try {
            tx.abort();
          } catch {}
        };
        const cancel = () =>
          fail(new DOMException('Chapter pointer transaction cancelled.', 'AbortError'));
        signal?.addEventListener('abort', cancel, { once: true });
        tx.onabort = () => {
          signal?.removeEventListener('abort', cancel);
          reject(failure ?? tx.error ?? new Error('Chapter pointer transaction failed.'));
        };
        tx.onerror = () => {
          failure ??= tx.error;
        };
        tx.oncomplete = () => {
          signal?.removeEventListener('abort', cancel);
          resolve(result);
        };
        for (const [key, name] of Object.entries(names)) {
          const request = store.get(name);
          request.onsuccess = () => {
            try {
              values[key] = request.result === undefined ? null : request.result;
              if (--left) return;
              guard();
              abortExternalChapter(signal);
              required(!closed, 'Chapter pointer store is closed.');
              required(values.backup === null, 'Recover the existing backup journal first.');
              result = own({ packs: values.packs, journal: values.journal, index: values.index });
              if (expected === undefined) return;
              required(
                canonicalJSON(result) === canonicalJSON(expected),
                'Chapter pointer or journal changed; recovery review is required.',
              );
              required(
                next &&
                  Object.keys(next).length === 3 &&
                  Object.hasOwn(next, 'packs') &&
                  Object.hasOwn(next, 'journal') &&
                  Object.hasOwn(next, 'index'),
                'Invalid chapter pointer update.',
              );
              if (canonicalJSON(next.packs) !== canonicalJSON(result.packs))
                store.put(next.packs, keys.packsKey);
              if (canonicalJSON(next.index) !== canonicalJSON(result.index))
                store.put(next.index, keys.indexKey);
              store.put(next.journal, keys.journalKey);
              result = next;
            } catch (error) {
              fail(error);
            }
          };
        }
        if (signal?.aborted) cancel();
      });
    } finally {
      db.close();
    }
  }
  return Object.freeze({
    keys,
    snapshot: (options) => transaction(undefined, undefined, options),
    compareAndSwap: transaction,
    close() {
      closed = true;
    },
  });
}
