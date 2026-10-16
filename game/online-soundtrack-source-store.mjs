import { createManagedMediaStore } from './managed-media-store.mjs';

/** Independent preferences generation, sharing the existing DB5 storage budget. */
export function createOnlineSoundtrackSourceStore({
  indexedDB = globalThis.indexedDB,
  estimate,
} = {}) {
  const manager = createManagedMediaStore({ indexedDB, estimate, soundtrackCatalogue: true });
  return Object.freeze({
    read: (options) => manager.readOnlineSoundtrackSources(options),
    commit: (sources, options) => manager.commitOnlineSoundtrackSources(sources, options),
    close: () => manager.close(),
    dispose: () => manager.close(),
  });
}
