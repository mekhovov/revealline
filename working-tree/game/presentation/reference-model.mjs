/** Local P04 prototype. Explicit v2 boundary; legacy v1 remains unchanged. */
import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../data-json.mjs';
import {
  FORMATS,
  LIMITS,
  freezePresentation,
  validateThemeBundle,
  validateAssetSlotSpec,
  validateAssetRevision,
  validatePresentationTheme,
  validateAssetCollection,
  validatePresentationReferences,
  resolvePresentationRecords,
} from './model.mjs';
import { hashPresentationBytes } from './bundle.mjs';

export const REFERENCE_FORMAT = 'revealline-theme-bundle.v2';
export const REFERENCE_ASSET = 'revealline-asset-revision.v2';
export const referenceKey = (record) => `${record.id}@${record.revision}`;
export const referenceOf = ({ id, revision }) => ({ id, revision });
export const checkReferenceAbort = (signal) => {
  if (signal?.aborted) throw new DOMException('Theme operation cancelled.', 'AbortError');
};
const own = (value) =>
  boundedJSON(value, {
    maxBytes: LIMITS.manifestBytes,
    maxNodes: 100000,
    maxArray: 2048,
    maxDepth: 18,
    maxString: 8192,
  });
const keys = (value, fields, label) => {
  exactKeys(value, fields, label);
  required(
    fields.every((key) => Object.hasOwn(value, key)),
    `${label} is missing fields.`,
  );
};
const ref = (value) => {
  keys(value, ['id', 'revision'], 'reference');
  required(
    stableId(value.id) && Number.isSafeInteger(value.revision) && value.revision > 0,
    'Invalid reference.',
  );
};
export const provenanceContent = ({ creator, source, license, prompt }) => ({
  creator,
  source,
  license,
  prompt,
});
export const provenanceDigest = (provenance) =>
  hashPresentationBytes(new TextEncoder().encode(canonicalJSON(provenanceContent(provenance))));

/** Validate saved-history progression without async work inside an IDB transaction.
 * Both inputs must already have passed their explicit format validators. */
export function assertReferencedHistory(document, previous, { multiple = false } = {}) {
  required(
    document.id === previous.id && document.revision >= previous.revision,
    'Saving must retain the same studio document and history.',
  );
  if (document.revision === previous.revision) {
    required(
      canonicalJSON(document) === canonicalJSON(previous),
      'A changed studio document must advance its revision.',
    );
    return;
  }
  required(
    multiple || document.revision === previous.revision + 1,
    'A transition must advance the same bundle exactly once.',
  );
  for (const field of ['slots', 'assets', 'themes', 'collections']) {
    const old = new Map(previous[field].map((row) => [referenceKey(row), row]));
    const next = new Map(document[field].map((row) => [referenceKey(row), row]));
    for (const [key, row] of old)
      required(
        canonicalJSON(next.get(key)) === canonicalJSON(row),
        `Immutable ${field} history changed.`,
      );
    const newest = new Map();
    for (const row of previous[field])
      newest.set(row.id, Math.max(newest.get(row.id) ?? 0, row.revision));
    for (const row of [...document[field]].sort((a, b) => a.revision - b.revision)) {
      if (old.has(referenceKey(row))) continue;
      required(
        row.revision === (newest.get(row.id) ?? 0) + 1,
        `New ${field} revisions must retain their complete history.`,
      );
      if (multiple) newest.set(row.id, row.revision);
    }
  }
}

function effectiveAsset(row, index) {
  if (row.format === FORMATS.asset) return row;
  const target = index.get(referenceKey(row.provenance.anchor));
  required(
    target?.format === FORMATS.asset,
    'Reference anchor must be an existing direct inline v1 asset.',
  );
  return {
    ...row,
    format: FORMATS.asset,
    provenance: { ...provenanceContent(target.provenance), parent: row.provenance.parent },
  };
}

export async function validateReferencedBundle(
  source,
  { previous = null, expectedRevision, signal } = {},
) {
  checkReferenceAbort(signal);
  const value = own(source); // Structural/encoded limits run before any hash resolution.
  keys(
    value,
    ['format', 'id', 'revision', 'slots', 'assets', 'themes', 'collections', 'selection'],
    'reference bundle',
  );
  required(
    value.format === REFERENCE_FORMAT &&
      stableId(value.id) &&
      Number.isSafeInteger(value.revision) &&
      value.revision > 0,
    'Invalid v2 reference bundle.',
  );
  const groups = [
    ['slots', LIMITS.slots, validateAssetSlotSpec],
    ['assets', LIMITS.assets, null],
    ['themes', LIMITS.themes, validatePresentationTheme],
    ['collections', LIMITS.collections, validateAssetCollection],
  ];
  for (const [name, limit, validate] of groups) {
    required(Array.isArray(value[name]) && value[name].length <= limit, `Invalid ${name} count.`);
    const seen = new Set();
    for (const row of value[name]) {
      if (validate) validate(row);
      else {
        keys(
          row,
          [
            'format',
            'id',
            'revision',
            'kind',
            'description',
            'provenance',
            'file',
            'recipe',
            'geometry',
            'quality',
          ],
          'asset revision',
        );
        required(
          stableId(row.id) && Number.isSafeInteger(row.revision) && row.revision > 0,
          'Invalid asset identity.',
        );
      }
      required(!seen.has(referenceKey(row)), `Duplicate ${name} identity.`);
      seen.add(referenceKey(row));
    }
  }
  required(
    value.slots.length > 0 && new Set(value.slots.map((row) => row.id)).size === value.slots.length,
    'Slots require unique stable IDs.',
  );
  keys(value.selection, ['base', 'theme', 'collection'], 'selection');
  ref(value.selection.base);
  ref(value.selection.theme);
  if (value.selection.collection !== null) ref(value.selection.collection);
  const index = new Map(value.assets.map((row) => [referenceKey(row), row]));
  const hashes = new Map();
  // Inline anchors are schema checked before any reference can consume them.
  for (const row of value.assets) if (row.format === FORMATS.asset) validateAssetRevision(row);
  for (const row of value.assets) {
    checkReferenceAbort(signal);
    if (row.format === FORMATS.asset) continue;
    required(row.format === REFERENCE_ASSET, 'Unsupported asset revision format.');
    keys(row.provenance, ['anchor', 'parent'], 'reference provenance');
    keys(row.provenance.anchor, ['id', 'revision', 'sha256'], 'provenance anchor');
    const anchor = row.provenance.anchor;
    ref({ id: anchor.id, revision: anchor.revision });
    required(/^[a-f0-9]{64}$/.test(anchor.sha256), 'Invalid provenance anchor hash.');
    if (row.provenance.parent !== null) ref(row.provenance.parent);
    const target = index.get(referenceKey(anchor));
    required(
      target?.format === FORMATS.asset,
      'Reference anchor must be an existing direct inline v1 asset.',
    );
    if (!hashes.has(referenceKey(anchor)))
      hashes.set(referenceKey(anchor), await provenanceDigest(target.provenance));
    checkReferenceAbort(signal);
    required(
      hashes.get(referenceKey(anchor)) === anchor.sha256,
      'Provenance anchor hash mismatch.',
    );
    validateAssetRevision(effectiveAsset(row, index));
  }
  // Same legacy graph/geometry/file-fact checks, with encoded rows retained.
  validatePresentationReferences(value);
  if (previous) {
    const old =
      previous.format === FORMATS.bundle
        ? validateThemeBundle(previous)
        : await validateReferencedBundle(previous, { signal });
    required(
      expectedRevision === undefined || expectedRevision === old.revision,
      'Stale expected revision.',
    );
    assertReferencedHistory(value, old);
  } else
    required(
      expectedRevision === undefined || expectedRevision === value.revision,
      'Stale expected revision.',
    );
  checkReferenceAbort(signal);
  return freezePresentation(value);
}

export async function migrateThemeReferences(source, options = {}) {
  const legacy = validateThemeBundle(source);
  return validateReferencedBundle(
    { ...structuredClone(legacy), format: REFERENCE_FORMAT, revision: legacy.revision + 1 },
    { ...options, previous: legacy, expectedRevision: legacy.revision },
  );
}

export async function resolveReferencedPresentation(source, options = {}) {
  const value = await validateReferencedBundle(source, { signal: options.signal });
  const selection = {};
  for (const key of ['themeId', 'collectionId'])
    if (options[key] !== undefined) selection[key] = options[key];
  const selected = resolvePresentationRecords(value, selection);
  const index = new Map(value.assets.map((row) => [referenceKey(row), row]));
  const assets = Object.fromEntries(
    Object.entries(selected.assets).map(([slot, row]) => [slot, effectiveAsset(row, index)]),
  );
  return freezePresentation(own({ ...selected, assets }));
}

/** Own and schema-check a single effective revision without expanding history. */
export async function readReferencedAsset(source, target) {
  return (await openReferencedAssets(source)).get(target);
}
/** Keeps encoded history and resolves one bounded revision at a time. */
export async function openReferencedAssets(source, options = {}) {
  const document = await validateReferencedBundle(source, options);
  const index = new Map(document.assets.map((row) => [referenceKey(row), row]));
  return Object.freeze({
    document,
    get(target) {
      const row = index.get(referenceKey(target));
      required(row, 'Missing asset revision.');
      return validateAssetRevision(effectiveAsset(row, index));
    },
  });
}

export async function encodeReferencedRevision(source, input) {
  const row = validateAssetRevision(input),
    content = canonicalJSON(provenanceContent(row.provenance));
  const anchor = source.assets.find(
    (record) =>
      record.format === FORMATS.asset &&
      canonicalJSON(provenanceContent(record.provenance)) === content,
  );
  if (!anchor) return row;
  return {
    ...row,
    format: REFERENCE_ASSET,
    provenance: {
      anchor: { ...referenceOf(anchor), sha256: await provenanceDigest(anchor.provenance) },
      parent: row.provenance.parent,
    },
  };
}
