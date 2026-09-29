import { validateThemeBundle } from './model.mjs';
import { verifyThemeAssets } from './bundle.mjs';
import { canonicalJSON } from '../data-json.mjs';

// Deliberately independent of player, soundtrack and original-media databases.
export const STUDIO_DATABASE = 'revealline-presentation-studio-v1';
const KEY = 'workspace';
const closedError = () => new Error('This studio connection is closed.');
function verifySavedHistory(document, current) {
  if (!current) return;
  if (!Number.isSafeInteger(current.generation) || current.generation < 1)
    throw new Error('The stored studio revision is invalid.');
  const previous = validateThemeBundle(current.document);
  if (document.id !== previous.id || document.revision < previous.revision)
    throw new Error('Saving must retain the same studio document and its immutable history.');
  if (document.revision === previous.revision) {
    if (canonicalJSON(document) !== canonicalJSON(previous))
      throw new Error('A changed studio document must advance its revision.');
    return;
  }
  // Several unsaved actions may be committed together. Keep every saved record
  // and require a contiguous run of new revisions, rather than only one action.
  for (const field of ['slots', 'assets', 'themes', 'collections']) {
    const old = new Map(previous[field].map((row) => [`${row.id}@${row.revision}`, row]));
    const next = new Map(document[field].map((row) => [`${row.id}@${row.revision}`, row]));
    for (const [key, row] of old)
      if (canonicalJSON(next.get(key)) !== canonicalJSON(row))
        throw new Error(`Immutable ${field} history changed.`);
    const newest = new Map();
    for (const row of previous[field])
      newest.set(row.id, Math.max(newest.get(row.id) ?? 0, row.revision));
    for (const row of [...document[field]].sort((a, b) => a.revision - b.revision)) {
      if (old.has(`${row.id}@${row.revision}`)) continue;
      if (row.revision !== (newest.get(row.id) ?? 0) + 1)
        throw new Error(`New ${field} revisions must retain their complete history.`);
      newest.set(row.id, row.revision);
    }
  }
}
export function createStudioRecordConnection({
  indexedDB = globalThis.indexedDB,
  cancelPendingWrites = false,
} = {}) {
  let connection = null;
  let closed = false;
  const pendingWrites = new Set();
  async function database() {
    if (closed) throw closedError();
    if (!indexedDB)
      throw new Error(
        'Local studio storage is unavailable. Export a theme bundle to keep your work.',
      );
    if (!connection) {
      const owner = { db: null, promise: null, reject: null, abandoned: false };
      connection = owner;
      owner.promise = new Promise((resolve, reject) => {
        const rejectOpen = (error) => {
          owner.abandoned = true;
          if (connection === owner) connection = null;
          reject(error);
        };
        owner.reject = rejectOpen;
        let request;
        try {
          request = indexedDB.open(STUDIO_DATABASE, 1);
        } catch (error) {
          rejectOpen(error);
          return;
        }
        request.onupgradeneeded = () => {
          if (closed || owner.abandoned || connection !== owner) request.transaction.abort();
          else request.result.createObjectStore('drafts');
        };
        request.onerror = () => {
          rejectOpen(request.error);
        };
        request.onblocked = () => {
          rejectOpen(new Error('Close the other asset studio tab and retry.'));
        };
        request.onsuccess = () => {
          const db = request.result;
          if (closed || owner.abandoned || connection !== owner) {
            db.close();
            rejectOpen(closedError());
            return;
          }
          owner.db = db;
          db.onversionchange = () => {
            db.close();
            if (connection === owner) connection = null;
          };
          db.onclose = () => {
            if (connection === owner) connection = null;
          };
          resolve({ db, owner });
        };
      });
      return owner.promise;
    }
    return connection.promise;
  }
  async function transaction(mode, operation, { signal } = {}) {
    const { db, owner } = await database();
    if (closed) throw closedError();
    return new Promise((resolve, reject) => {
      let result, failure;
      let tx;
      const cancellable = cancelPendingWrites && mode === 'readwrite';
      try {
        tx = db.transaction('drafts', mode);
      } catch (error) {
        if (connection === owner) connection = null;
        db.close();
        reject(error);
        return;
      }
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        if (cancellable) {
          pendingWrites.delete(cancel);
          signal?.removeEventListener('abort', onSignalAbort);
        }
        callback(value);
      };
      const cancel = (error) => {
        if (settled) return;
        try {
          tx.abort();
          failure = error;
        } catch (abortError) {
          // Commit can finish before its complete event is delivered. Await
          // that event; do not report a rollback that did not happen.
          if (abortError.name !== 'InvalidStateError') throw abortError;
        }
      };
      const onSignalAbort = () =>
        cancel(new DOMException('Theme operation cancelled.', 'AbortError'));
      tx.oncomplete = () => finish(resolve, result);
      tx.onerror = () => finish(reject, failure ?? tx.error ?? new Error('Studio storage failed.'));
      tx.onabort = () =>
        finish(reject, failure ?? tx.error ?? new Error('Studio storage was cancelled.'));
      if (cancellable) {
        pendingWrites.add(cancel);
        signal?.addEventListener('abort', onSignalAbort, { once: true });
        if (signal?.aborted) {
          onSignalAbort();
          return;
        }
      }
      const store = tx.objectStore('drafts');
      const request = store.get(KEY);
      request.onsuccess = () => {
        try {
          result = operation(store, request.result ?? null);
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
    });
  }
  return Object.freeze({
    transaction,
    async close() {
      closed = true;
      for (const cancel of pendingWrites) cancel(closedError());
      const owner = connection;
      connection = null;
      if (owner) {
        owner.reject(closedError());
        owner.db?.close();
      }
    },
  });
}
/** Legacy v1 boundary; storage transport is shared without relaxing validation. */
export function createStudioStore({ indexedDB = globalThis.indexedDB } = {}) {
  const connection = createStudioRecordConnection({ indexedDB });
  const transaction = (...args) => connection.transaction(...args);
  return Object.freeze({
    async load() {
      const record = await transaction('readonly', (_store, value) => value);
      if (!record) return null;
      if (!Number.isSafeInteger(record.generation) || record.generation < 1)
        throw new Error('The stored studio revision is invalid.');
      const document = validateThemeBundle(record.document);
      const assets = await verifyThemeAssets(document, record.assets);
      return { generation: record.generation, document, assets };
    },
    async save(source, sourceAssets, { expectedGeneration = 0 } = {}) {
      if (
        !Number.isSafeInteger(expectedGeneration) ||
        expectedGeneration < 0 ||
        expectedGeneration === Number.MAX_SAFE_INTEGER
      )
        throw new Error('Invalid expected studio generation.');
      // Verification owns all bytes before opening the short atomic transaction.
      const document = validateThemeBundle(source);
      const assets = await verifyThemeAssets(document, sourceAssets);
      return transaction('readwrite', (store, current) => {
        if ((current?.generation ?? 0) !== expectedGeneration)
          throw new Error('This draft changed in another tab. Reload the studio before saving.');
        verifySavedHistory(document, current);
        const generation = expectedGeneration + 1;
        store.put({ generation, document, assets }, KEY);
        return { generation, document, assets };
      });
    },
    close: connection.close,
  });
}
