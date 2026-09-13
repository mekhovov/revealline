import { createManagedMediaStore } from './managed-media-store.mjs';
import {
  hydrateStoredStillMedia,
  prepareStoredStillMedia,
  verifyStoredStillAssets,
} from './media-storage-record.mjs';

/** Explicit v3 adoption. A supplied shared manager must also be v3; the host
 * must use that same manager for its soundtrack adapter. No host opts in yet.
 */
export function createStillMediaStore({ managedStore, decodeImage, ...options } = {}) {
  const manager = managedStore ?? createManagedMediaStore({ ...options, richStillMedia: true });
  if (manager.richStillMedia !== true)
    throw new TypeError('Still media requires the shared v3 manager.');
  let closed = false;
  const check = () => {
    if (closed) throw new Error('Still media store is closed.');
  };
  return Object.freeze({
    async read({ signal } = {}) {
      check();
      const saved = await manager.readDomain('media', { signal });
      const document = hydrateStoredStillMedia(saved.library);
      const assets = await verifyStoredStillAssets(document, saved.assets, { decodeImage, signal });
      check();
      return Object.freeze({ generation: saved.generation, document, assets });
    },
    async prepare(library, assets, options = {}) {
      check();
      const prepared = await prepareStoredStillMedia(library, assets, { decodeImage, ...options });
      check();
      return prepared;
    },
    async commit(prepared, options) {
      check();
      return manager.commitDomain('media', prepared, options);
    },
    async readBlob(hash, options) {
      check();
      return manager.readBlob(hash, options);
    },
    close() {
      closed = true;
      if (!managedStore) manager.close();
    },
  });
}
