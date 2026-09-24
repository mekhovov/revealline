import { boundedJSON, exactKeys, required } from '../data-json.mjs';

export const COMMUNITY_STATE_KEY = 'revealline.community.library.v1';
const empty = () => ({
  format: 'revealline-community-library.v1',
  editions: [],
});
const validate = (source) => {
  const value = source ?? empty();
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
        ['staged', 'installed'].includes(item.installation) &&
        (item.installedAt === null ||
          (typeof item.installedAt === 'string' &&
            Number.isFinite(Date.parse(item.installedAt)))) &&
        !ids.has(item.editionId),
      'Community library identity is invalid.',
    );
    ids.add(item.editionId);
  }
  return structuredClone(value);
};

export function createCommunityStateStore({ storage = globalThis.localStorage } = {}) {
  return Object.freeze({
    read() {
      const raw = storage?.getItem(COMMUNITY_STATE_KEY);
      return validate(
        raw
          ? boundedJSON(raw, {
              maxBytes: 256 * 1024,
              maxNodes: 4096,
              maxDepth: 8,
            })
          : empty(),
      );
    },
    write(value) {
      const safe = validate(value);
      required(storage?.setItem, 'Community library storage is unavailable.');
      storage.setItem(COMMUNITY_STATE_KEY, JSON.stringify(safe));
      return safe;
    },
  });
}

export function createMemoryCommunityStateStore() {
  let value = empty();
  return Object.freeze({
    read: () => structuredClone(value),
    write: (next) => (value = validate(next)),
  });
}
