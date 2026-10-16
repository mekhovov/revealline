import { createClassicSnakeCommunityLibrary } from '../snake/classic-community.mjs';

/** Exact receipts and native content ownership share one atomic profile record.
 * Historical split records migrate through the native adapter without touching progress. */
export function createCommunityClassicInstalled({ indexedDB = globalThis.indexedDB } = {}) {
  const native = createClassicSnakeCommunityLibrary({ indexedDB });
  return Object.freeze({
    install: (inspected) => native.installEdition(inspected),
    storage: (hash) => native.editionStorage(hash),
    list: () => native.editions(),
    export: (hash) => native.exportEdition(hash),
    reviewOffload: (hash) => native.reviewEditionOffload(hash),
    offload: (review) => native.offloadEdition(review),
    close: () => native.close(),
  });
}
