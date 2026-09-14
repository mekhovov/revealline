import { boundedJSON, exactKeys, required } from './data-json.mjs';
import { MEDIA_LIMITS, freezeMedia } from './media-library.mjs';
import {
  STILL_STORAGE_FORMAT,
  validateStoredStillMedia,
  hydrateStoredStillMedia,
  storedStillHashes,
  assertStoredStillTransition,
} from './media-storage-record.mjs';

// Pure proposed metadata only. No current manager/reader writes this format yet.
export const STILL_RESIDENCY_FORMAT = 'revealline-still-storage.v2';
const MAX_CHANGED_ORIGINALS = 3;
const own = (source) =>
  boundedJSON(source, {
    maxBytes: MEDIA_LIMITS.metadataBytes,
    maxNodes: 100000,
    maxDepth: 24,
    maxArray: 4096,
    maxString: 65536,
  });
const history = (source) =>
  validateStoredStillMedia({
    format: STILL_STORAGE_FORMAT,
    owners: source.owners,
    library: source.library,
    legacy: source.legacy,
  });

/** Validate identity and declared residency, never the presence of original bytes. */
export function validateStillResidency(source) {
  const value = own(source);
  exactKeys(value, ['format', 'owners', 'library', 'legacy', 'originals'], 'still residency');
  required(value.format === STILL_RESIDENCY_FORMAT, 'Unsupported still residency format.');
  const identity = history(value),
    known = storedStillHashes(identity),
    originals = new Set();
  required(
    Array.isArray(value.originals) && value.originals.length <= MEDIA_LIMITS.assets,
    'Still residency needs a bounded original hash array.',
  );
  for (const hash of value.originals) {
    required(
      typeof hash === 'string' && known.has(hash) && !originals.has(hash),
      'Unknown or duplicate resident still original.',
    );
    originals.add(hash);
  }
  required(
    identity.legacy.items.every((item) => originals.has(item.sha256)),
    'Retained legacy original references cannot be detached.',
  );
  return freezeMedia({
    ...identity,
    format: STILL_RESIDENCY_FORMAT,
    originals: [...originals].sort(),
  });
}

/** Explicit metadata migration: every previous reference remains required resident. */
export function upgradeStillResidency(source) {
  const value = own(source);
  if (value.format === STILL_RESIDENCY_FORMAT) return validateStillResidency(value);
  required(
    value.format === STILL_STORAGE_FORMAT || value.format === 'revealline-managed-bytes.v1',
    'Unsupported still residency source format.',
  );
  const previous = hydrateStoredStillMedia(value);
  return validateStillResidency({
    ...previous,
    format: STILL_RESIDENCY_FORMAT,
    originals: [...storedStillHashes(previous)].sort(),
  });
}

/** Identity-only projection for receipt validation, never a downgrade/write operation. */
export function stillResidencyIdentityDocument(source) {
  return history(validateStillResidency(source));
}
export function residentStillHashes(source) {
  return new Set(validateStillResidency(source).originals);
}

/** Ordinary imports may append history/residency, but cannot offload old originals. */
export function assertRetainedStillResidency(previous, next) {
  const before = validateStillResidency(previous),
    after = validateStillResidency(next);
  assertStoredStillTransition(history(before), history(after));
  const retained = new Set(after.originals);
  required(
    before.originals.every((hash) => retained.has(hash)),
    'Ordinary still edits cannot detach resident originals.',
  );
  return after;
}

function changeOriginals(source, hashes, attach) {
  const value = validateStillResidency(source);
  required(Array.isArray(hashes), 'Choose original hashes as an array.');
  const selected = boundedJSON(hashes, {
    maxBytes: 4096,
    maxNodes: 8,
    maxDepth: 2,
    maxArray: MAX_CHANGED_ORIGINALS,
    maxString: 64,
  });
  required(
    selected.length > 0 && new Set(selected).size === selected.length,
    'Choose one to three distinct original hashes.',
  );
  const rich = new Set(value.library.assets.map((asset) => asset.sha256)),
    legacy = new Set(value.legacy.items.map((item) => item.sha256)),
    originals = new Set(value.originals);
  for (const hash of selected) {
    required(
      typeof hash === 'string' && rich.has(hash) && !legacy.has(hash),
      'Only known rich still originals without legacy references can change residency.',
    );
    required(
      attach ? !originals.has(hash) : originals.has(hash),
      attach ? 'Still original is already resident.' : 'Still original is already detached.',
    );
    if (attach) originals.add(hash);
    else originals.delete(hash);
  }
  return validateStillResidency({ ...value, originals: [...originals].sort() });
}

/** Metadata proposal only; later manager must authenticate user/chapter/transaction authority. */
export const detachStillOriginals = (source, hashes) => changeOriginals(source, hashes, false);
/** Metadata proposal only; later manager must verify exact incoming bytes before committing. */
export const reattachStillOriginals = (source, hashes) => changeOriginals(source, hashes, true);
