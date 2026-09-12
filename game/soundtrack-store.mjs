import { createManagedMediaStore, MANAGED_MEDIA_DATABASE } from './managed-media-store.mjs';

export const SOUNDTRACK_DATABASE = MANAGED_MEDIA_DATABASE;
/** Compatible P3 adapter. A supplied manager remains owned by its shared host. */
export function createSoundtrackStore({
  managedStore,
  indexedDB = globalThis.indexedDB,
  estimate = () => globalThis.navigator?.storage?.estimate?.(),
} = {}) {
  const manager = managedStore ?? createManagedMediaStore({ indexedDB, estimate });
  let closed = false;
  const check = () => {
    if (closed) throw new Error('Soundtrack store is closed.');
  };
  return Object.freeze({
    async read(options) {
      check();
      return manager.readDomain('audio', options);
    },
    async commit(prepared, options) {
      check();
      return manager.commitDomain('audio', prepared, options);
    },
    close() {
      closed = true;
      if (!managedStore) manager.close();
    },
  });
}
