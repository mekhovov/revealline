import { validateThemeBundle } from './model.mjs';
import { verifyThemeAssets } from './bundle.mjs';

// Deliberately independent of player, soundtrack and original-media databases.
export const STUDIO_DATABASE = 'revealline-presentation-studio-v1';
const KEY = 'workspace';
export function createStudioStore({ indexedDB = globalThis.indexedDB } = {}) {
  let connection = null;
  let closed = false;
  async function database() {
    if (closed) throw new Error('This studio connection is closed.');
    if (!indexedDB)
      throw new Error(
        'Local studio storage is unavailable. Export a theme bundle to keep your work.',
      );
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open(STUDIO_DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('drafts');
        request.onerror = () => {
          connection = null;
          reject(request.error);
        };
        request.onblocked = () => {
          connection = null;
          reject(new Error('Close the other asset studio tab and retry.'));
        };
        request.onsuccess = () => {
          const db = request.result;
          if (closed) {
            db.close();
            reject(new Error('This studio connection is closed.'));
            return;
          }
          db.onversionchange = () => {
            db.close();
            connection = null;
          };
          db.onclose = () => {
            connection = null;
          };
          resolve(db);
        };
      });
    }
    return connection;
  }
  async function transaction(mode, operation) {
    const db = await database();
    return new Promise((resolve, reject) => {
      let result, failure;
      let tx;
      try {
        tx = db.transaction('drafts', mode);
      } catch (error) {
        connection = null;
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('Studio storage failed.'));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Studio storage was cancelled.'));
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
      if (!Number.isSafeInteger(expectedGeneration) || expectedGeneration < 0)
        throw new Error('Invalid expected studio generation.');
      // Verification owns all bytes before opening the short atomic transaction.
      const document = validateThemeBundle(source);
      const assets = await verifyThemeAssets(document, sourceAssets);
      return transaction('readwrite', (store, current) => {
        if ((current?.generation ?? 0) !== expectedGeneration)
          throw new Error('This draft changed in another tab. Reload the studio before saving.');
        const generation = expectedGeneration + 1;
        store.put({ generation, document, assets }, KEY);
        return { generation, document, assets };
      });
    },
    async close() {
      closed = true;
      if (connection) (await connection).close();
      connection = null;
    },
  });
}
