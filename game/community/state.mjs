import { boundedJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';

export const COMMUNITY_STATE_KEY = 'revealline.community.library.v1';
const empty = () => ({
  format: 'revealline-community-library.v1',
  editions: [],
});
const validate = (source) => {
  const value = boundedJSON(source ?? empty(), {
    maxBytes: 256 * 1024,
    maxNodes: 4096,
    maxDepth: 8,
  });
  required(
    value?.format === 'revealline-community-library.v1' && Array.isArray(value.editions),
    'Community library state is invalid.',
  );
  const ids = new Set();
  for (const item of value.editions) {
    exactKeys(
      item,
      [
        'editionId',
        'collectionId',
        'creatorEditionId',
        'slug',
        'version',
        'packageSha256',
        'installation',
        'installedAt',
        'family',
        'runtimeIdentity',
      ],
      'community library edition',
    );
    required(
      /^ed_[a-f0-9]{64}$/u.test(item.editionId) &&
        (item.collectionId === null || /^co_[a-f0-9]{64}$/u.test(item.collectionId)) &&
        /^[a-f0-9]{64}$/u.test(item.creatorEditionId) &&
        /^[a-f0-9]{64}$/u.test(item.packageSha256) &&
        typeof item.slug === 'string' &&
        item.slug.length <= 64 &&
        typeof item.version === 'string' &&
        item.version.length <= 64 &&
        ['staged', 'installed', 'offloading', 'offloaded'].includes(item.installation) &&
        (item.installedAt === null ||
          (typeof item.installedAt === 'string' &&
            Number.isFinite(Date.parse(item.installedAt)))) &&
        !ids.has(item.editionId),
      'Community library identity is invalid.',
    );
    required(
      item.family === undefined ||
        ['creator', 'classic', 'team', 'fpv', 'overflight', 'overflight-hunt'].includes(
          item.family,
        ),
      'Unknown installed content family.',
    );
    required(
      !['classic', 'overflight', 'overflight-hunt'].includes(item.family) ||
        /^[a-f0-9]{16}$/.test(item.runtimeIdentity),
      'Native content identity is invalid.',
    );
    required(
      item.family !== 'team' || /^[a-f0-9]{64}$/.test(item.runtimeIdentity),
      'Team runtime identity is invalid.',
    );
    required(
      item.family !== 'fpv' || stableId(item.runtimeIdentity),
      'FPV project identity is invalid.',
    );
    ids.add(item.editionId);
  }
  return structuredClone(value);
};

/** Migrate the old localStorage journal once, without deleting recovery bytes.
 * Every later mutation merges in the existing transactional profile database. */
export function createCommunityStateStore({
  storage = globalThis.localStorage,
  indexedDB = globalThis.indexedDB,
} = {}) {
  const backend = createProfileRecordBackend({
    key: COMMUNITY_STATE_KEY,
    empty: () => {
      const raw = storage?.getItem(COMMUNITY_STATE_KEY);
      return validate(raw ?? empty());
    },
    validate,
    indexedDB,
  });
  let opening = null;
  const ready = () => {
    if (!opening)
      opening = backend
        .update((state) => state)
        .catch((error) => {
          opening = null;
          throw error;
        });
    return opening;
  };
  return Object.freeze({
    async read() {
      await ready();
      return backend.read();
    },
    async update(mutate) {
      await ready();
      return backend.update(mutate);
    },
    close: () => backend.close(),
  });
}

export function createMemoryCommunityStateStore() {
  let value = empty();
  return Object.freeze({
    read: () => structuredClone(value),
    update: (mutate) => (value = validate(mutate(structuredClone(value)))),
    // Retained for fixtures which seed complete historical journal snapshots.
    write: (next) => (value = validate(next)),
  });
}
