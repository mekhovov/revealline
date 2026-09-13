import { boundedJSON, canonicalJSON, exactKeys, required } from './data-json.mjs';
import { MEDIA_LIMITS, freezeMedia } from './media-library.mjs';
import {
  hydrateStoredStillMedia,
  createStoredStillIdentityCatalog,
} from './media-storage-record.mjs';
import { validateVictoryStory, prepareVictoryStory } from './victory-story.mjs';

export const STORY_STORAGE_FORMAT = 'revealline-story-storage.v1';
const preparations = new WeakSet();
const nativeSize = Object.getOwnPropertyDescriptor(Blob.prototype, 'size').get;
const key = (story) => JSON.stringify([story.id, story.revision]);
export const emptyStoredStories = () =>
  freezeMedia({ format: STORY_STORAGE_FORMAT, stories: [], originals: [] });
export const storedStoryHashes = (document) => new Set(document.originals);

/** Separate opt-in history. Availability can change; identities never disappear.
 * The retained still owner catalog, not today's installed pack/assignment, is authority.
 */
export function validateStoredStories(source, stillSource) {
  const value = boundedJSON(source, {
    maxBytes: MEDIA_LIMITS.metadataBytes,
    maxNodes: 100000,
    maxDepth: 16,
    maxArray: 512,
    maxString: 2048,
  });
  exactKeys(value, ['format', 'stories', 'originals'], 'stored stories');
  required(
    value.format === STORY_STORAGE_FORMAT &&
      Array.isArray(value.stories) &&
      Array.isArray(value.originals),
    'Unsupported stored stories.',
  );
  const still = hydrateStoredStillMedia(stillSource),
    identityCatalog = createStoredStillIdentityCatalog(still),
    ids = new Set(),
    sources = new Map();
  value.stories = value.stories.map((source) => {
    const story = validateVictoryStory(source, { library: still.library, identityCatalog });
    required(!ids.has(key(story)), 'Duplicate story revision.');
    ids.add(key(story));
    const prior = sources.get(story.source.sha256);
    required(
      !prior || canonicalJSON(prior) === canonicalJSON(story.source),
      'One video hash has conflicting inspected facts.',
    );
    sources.set(story.source.sha256, story.source);
    return story;
  });
  const available = new Set();
  let bytes = 0;
  for (const hash of value.originals) {
    required(
      typeof hash === 'string' && sources.has(hash) && !available.has(hash),
      'Unknown or duplicate story original.',
    );
    available.add(hash);
    bytes += sources.get(hash).bytes;
  }
  required(bytes <= 256 * 1024 * 1024, 'Story inventory exceeds the shared managed budget.');
  return freezeMedia(value);
}
export function assertStoredStoryTransition(current, next, still) {
  const old = validateStoredStories(current, still),
    safe = validateStoredStories(next, still),
    retained = new Map(safe.stories.map((story) => [key(story), story]));
  for (const story of old.stories)
    required(
      canonicalJSON(retained.get(key(story)) ?? null) === canonicalJSON(story),
      'Immutable story revisions cannot change or be removed.',
    );
}

/** Own a complete bounded original table without claiming decoded-video authority. */
export function ownStoryOriginals(sourceAssets, originals) {
  originals = boundedJSON(originals, {
    maxBytes: 65536,
    maxArray: 512,
    maxNodes: 600,
    maxString: 64,
  });
  required(
    Array.isArray(originals) &&
      originals.every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash)) &&
      new Set(originals).size === originals.length,
    'Invalid story original reference table.',
  );
  required(
    Array.isArray(sourceAssets) &&
      Object.getPrototypeOf(sourceAssets) === Array.prototype &&
      sourceAssets.length <= 512,
    'Invalid story original table.',
  );
  const fields = Object.getOwnPropertyDescriptors(sourceAssets),
    owned = [],
    seen = new Set();
  required(
    Reflect.ownKeys(fields).length === sourceAssets.length + 1,
    'Story originals require a dense owned array.',
  );
  let total = 0;
  for (let i = 0; i < sourceAssets.length; i++) {
    const entry = fields[i];
    required(
      entry?.enumerable &&
        Object.hasOwn(entry, 'value') &&
        entry.value &&
        Object.getPrototypeOf(entry.value) === Object.prototype,
      'Story original must be an owned entry.',
    );
    const d = Object.getOwnPropertyDescriptors(entry.value);
    required(
      Reflect.ownKeys(d).length === 2 &&
        ['sha256', 'blob'].every((k) => d[k]?.enumerable && Object.hasOwn(d[k], 'value')),
      'Story original needs own hash and native Blob.',
    );
    const hash = d.sha256.value,
      blob = d.blob.value,
      bytes = nativeSize.call(blob);
    required(
      originals.includes(hash) && !seen.has(hash) && bytes > 0 && bytes <= 64 * 1024 * 1024,
      'Unknown/duplicate story original or source byte budget exceeded.',
    );
    total += bytes;
    required(total <= 256 * 1024 * 1024, 'Story originals exceed the shared budget.');
    seen.add(hash);
    owned.push({ sha256: hash, blob: Blob.prototype.slice.call(blob, 0, bytes) });
  }
  required(seen.size === originals.length, 'Restore every available story original before saving.');
  return Object.freeze(owned.map(Object.freeze));
}

/** Complete original inventory prepared through the real owned-video inspector.
 * JSON facts or a shape-compatible fake are never codec/hash authority.
 */
export async function prepareStoredStories(document, sourceAssets, { still, ...options } = {}) {
  const safe = validateStoredStories(document, still),
    context = hydrateStoredStillMedia(still),
    identityCatalog = createStoredStillIdentityCatalog(context),
    owned = ownStoryOriginals(sourceAssets, safe.originals);
  // Snapshot all caller-controlled input before the first decoder/hash await.
  const assets = [];
  for (const item of owned) {
    const descriptor = safe.stories.find((story) => story.source.sha256 === item.sha256),
      prepared = await prepareVictoryStory(
        { descriptor, blob: item.blob, library: context.library, identityCatalog },
        options,
      );
    assets.push(Object.freeze({ sha256: item.sha256, blob: prepared.original }));
  }
  if (options.signal?.aborted) throw new DOMException('Story storage cancelled.', 'AbortError');
  const result = Object.freeze({ library: safe, assets: Object.freeze(assets) });
  preparations.add(result);
  return result;
}
export const isPreparedStoredStories = (value) => preparations.has(value);
