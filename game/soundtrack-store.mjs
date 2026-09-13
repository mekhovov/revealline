import { MANAGED_MEDIA_DATABASE } from './managed-media-store.mjs';
import { createSoundtrackStore as createLegacySoundtrackStore } from './soundtrack-store-legacy.mjs';

export const SOUNDTRACK_DATABASE = MANAGED_MEDIA_DATABASE;
/** Compatible P3 adapter. A supplied manager remains owned by its shared host. */
export function createSoundtrackStore({
  managedStore,
  indexedDB = globalThis.indexedDB,
  estimate = () => globalThis.navigator?.storage?.estimate?.(),
} = {}) {
  if (!managedStore) return createLegacySoundtrackStore({ indexedDB, estimate });
  const manager = managedStore;
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
      // The explicitly supplied manager remains owned by its host.
    },
  });
}
