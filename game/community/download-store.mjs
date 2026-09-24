import { required } from '../data-json.mjs';

const CACHE = 'revealline-community-packages-v1';
const key = (editionId) => `https://community.invalid/packages/${editionId}.rlpack`;

export function createCommunityDownloadStore({ cacheStorage = globalThis.caches } = {}) {
  required(cacheStorage?.open, 'Offline package storage is unavailable.');
  return Object.freeze({
    async get(editionId) {
      const response = await (await cacheStorage.open(CACHE)).match(key(editionId));
      return response ? response.blob() : null;
    },
    async put(editionId, blob) {
      const cache = await cacheStorage.open(CACHE);
      await cache.put(
        key(editionId),
        new Response(blob, {
          headers: { 'content-type': 'application/vnd.revealline.rlpack' },
        }),
      );
    },
    async remove(editionId) {
      return (await cacheStorage.open(CACHE)).delete(key(editionId));
    },
  });
}

export function createMemoryCommunityDownloadStore() {
  const packages = new Map();
  return Object.freeze({
    get: async (id) => packages.get(id) ?? null,
    put: async (id, blob) => packages.set(id, blob.slice()),
    remove: async (id) => packages.delete(id),
  });
}
