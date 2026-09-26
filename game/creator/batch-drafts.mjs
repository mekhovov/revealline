import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import {
  hydrateStoredStillMedia,
  prepareRetainedStillByteEdit,
  storedStillHashes,
} from '../media-storage-record.mjs';
import { creatorAbort, creatorSHA256, ownCreatorBlob } from './bytes.mjs';
import { CREATOR_IMAGE_LIMITS } from './image.mjs';

const FORMAT = 'revealline-creator-batch-draft.v1';
const MAX_METADATA_BYTES = 512 * 1024;
const HEAD_PREFIX = 'creator.batch-draft.';
const SOURCE_PREFIX = 'creator.batch-source.';
const prepared = new WeakSet();
const hashes = new WeakMap();

const validDraftId = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]{0,59}$/.test(value);
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const safeText = (value, max, { empty = true } = {}) =>
  typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0);
const headPrefix = (draftId) => `${HEAD_PREFIX}${draftId}.`;
const sourcePrefix = (draftId) => `${SOURCE_PREFIX}${draftId}.`;
const sourceReference = (draftId, sha256) => `${sourcePrefix(draftId)}${sha256.slice(0, 32)}`;

function validateSettings(value) {
  exactKeys(
    value,
    ['collectionName', 'pacing', 'fit', 'creatorCredit', 'pictureCredit', 'license'],
    'batch draft settings',
  );
  required(safeText(value.collectionName, 160, { empty: false }), 'Name this campaign.');
  required(
    ['balanced', 'gentle-first', 'steady', 'surprise'].includes(value.pacing),
    'Choose a supported campaign pace.',
  );
  required(['contain', 'cover'].includes(value.fit), 'Choose a supported picture fitting.');
  for (const key of ['creatorCredit', 'pictureCredit', 'license'])
    required(safeText(value[key], 512), 'Batch credits must be bounded text.');
  return value;
}

function validateDocument(value) {
  const copy = boundedJSON(value, {
    maxBytes: MAX_METADATA_BYTES,
    maxNodes: 4096,
    maxDepth: 8,
    maxArray: 64,
    maxString: 1024,
  });
  exactKeys(copy, ['format', 'draftId', 'seed', 'settings', 'items'], 'batch draft');
  required(copy.format === FORMAT && validDraftId(copy.draftId), 'Invalid creator batch draft.');
  required(
    Number.isSafeInteger(copy.seed) && copy.seed >= 0 && copy.seed <= 0xffffffff,
    'Invalid creator batch generation seed.',
  );
  validateSettings(copy.settings);
  required(Array.isArray(copy.items) && copy.items.length <= 50, 'Invalid batch item count.');
  const ids = new Set();
  for (const item of copy.items) {
    exactKeys(
      item,
      [
        'id',
        'fileName',
        'mime',
        'bytes',
        'lastModified',
        'sourceSha256',
        'title',
        'included',
        'status',
        'error',
        'generation',
      ],
      'batch draft item',
    );
    required(
      typeof item.id === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(item.id) && !ids.has(item.id),
      'Invalid or duplicate batch item id.',
    );
    ids.add(item.id);
    required(
      safeText(item.fileName, 255, { empty: false }) && !/[\\/\0]/u.test(item.fileName),
      'Invalid batch source filename.',
    );
    required(safeText(item.mime, 100), 'Invalid batch source media type.');
    required(
      Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <= CREATOR_IMAGE_LIMITS.sourceBytes &&
        Number.isSafeInteger(item.lastModified) &&
        item.lastModified >= 0 &&
        validHash(item.sourceSha256),
      'Invalid batch source identity.',
    );
    required(safeText(item.title, 160, { empty: false }), 'Invalid batch item title.');
    required(typeof item.included === 'boolean', 'Invalid batch inclusion choice.');
    required(
      ['queued', 'preparing', 'ready', 'error', 'cancelled', 'excluded'].includes(item.status),
      'Invalid batch item status.',
    );
    required(safeText(item.error, 512), 'Invalid batch item error.');
    required(
      Number.isSafeInteger(item.generation) && item.generation >= 0 && item.generation <= 100000,
      'Invalid batch generation revision.',
    );
  }
  return copy;
}

async function sourceHash(blob, signal) {
  let pending = hashes.get(blob);
  if (!pending) {
    pending = blob.arrayBuffer().then((bytes) => creatorSHA256(bytes));
    hashes.set(blob, pending);
  }
  const result = await pending;
  creatorAbort(signal);
  return result;
}

/** Capture exact selected bytes plus the user-visible review state. Generated
 * packs are intentionally rebuilt from these deterministic inputs on reopen. */
export async function prepareCreatorBatchDraft(draftId, snapshot, { signal } = {}) {
  required(validDraftId(draftId), 'Invalid creator batch draft id.');
  required(snapshot && typeof snapshot === 'object', 'Invalid creator batch review.');
  const settings = validateSettings(structuredClone(snapshot.settings));
  required(Array.isArray(snapshot.items) && snapshot.items.length <= 50, 'Invalid batch review.');
  const assets = new Map();
  const items = [];
  for (const item of snapshot.items) {
    creatorAbort(signal);
    const source = ownCreatorBlob(item.file, CREATOR_IMAGE_LIMITS.sourceBytes, 'Source picture');
    const sourceSha256 = await sourceHash(item.file, signal);
    if (!assets.has(sourceSha256)) assets.set(sourceSha256, { sha256: sourceSha256, blob: source });
    items.push({
      id: item.id,
      fileName: item.file.name,
      mime: item.file.type || '',
      bytes: source.size,
      lastModified:
        Number.isSafeInteger(item.file.lastModified) && item.file.lastModified >= 0
          ? item.file.lastModified
          : 0,
      sourceSha256,
      title: item.title,
      included: !!item.included,
      status: item.status,
      error: String(item.error || '').slice(0, 512),
      generation: item.generation,
    });
  }
  const checkpoint = Object.freeze({
    document: validateDocument({ format: FORMAT, draftId, seed: snapshot.seed, settings, items }),
    assets: Object.freeze([...assets.values()]),
  });
  prepared.add(checkpoint);
  return checkpoint;
}

function namedSource(blob, item) {
  if (typeof File === 'function')
    return new File([blob], item.fileName, {
      type: item.mime,
      lastModified: item.lastModified,
    });
  const source = blob.slice(0, blob.size, item.mime);
  Object.defineProperties(source, {
    name: { value: item.fileName, enumerable: true },
    lastModified: { value: item.lastModified, enumerable: true },
  });
  return source;
}

export function reopenCreatorBatchDraft(checkpoint) {
  required(prepared.has(checkpoint), 'Prepare the exact creator batch checkpoint first.');
  const assets = new Map(checkpoint.assets.map((asset) => [asset.sha256, asset.blob]));
  const resumeItemIds = [];
  const items = checkpoint.document.items.map((item) => {
    const blob = assets.get(item.sourceSha256);
    required(blob && blob.size === item.bytes, `${item.fileName} source bytes are missing.`);
    if (item.included && ['ready', 'preparing'].includes(item.status)) resumeItemIds.push(item.id);
    return {
      id: item.id,
      file: namedSource(blob, item),
      title: item.title,
      included: item.included,
      status:
        item.included && ['ready', 'preparing'].includes(item.status)
          ? 'queued'
          : item.included
            ? item.status
            : 'excluded',
      result: null,
      error: item.error,
      generation: item.generation,
    };
  });
  return Object.freeze({
    seed: checkpoint.document.seed,
    settings: structuredClone(checkpoint.document.settings),
    items,
    resumeItemIds: Object.freeze(resumeItemIds),
  });
}

function references(snapshot, draftId) {
  const prefix = headPrefix(draftId);
  return hydrateStoredStillMedia(snapshot.library)
    .legacy.items.filter((item) => item.id.startsWith(prefix))
    .map((item) => {
      const revision = Number(item.id.slice(prefix.length));
      required(
        Number.isSafeInteger(revision) && revision >= 1,
        'Invalid batch checkpoint revision.',
      );
      return { ...item, revision };
    })
    .sort((left, right) => right.revision - left.revision);
}

/** One retained head per draft provides optimistic stale-writer protection
 * without exhausting a fixed checkpoint count during a 50-item generation. */
export function createCreatorBatchDraftBackend(store) {
  return Object.freeze({
    async read(draftId, { signal } = {}) {
      required(validDraftId(draftId), 'Invalid creator batch draft id.');
      const snapshot = await store.readDomainMetadata('media', { signal });
      const current = references(snapshot, draftId)[0];
      if (!current) return null;
      const blob = await store.readSelectedBlob(current.sha256, {
        signal,
        maxBytes: MAX_METADATA_BYTES,
      });
      required(blob, 'Creator batch checkpoint metadata is missing.');
      const bytes = await blob.arrayBuffer();
      required(
        (await creatorSHA256(bytes)) === current.sha256,
        'Creator batch checkpoint failed its integrity check.',
      );
      const document = validateDocument(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      required(document.draftId === draftId, 'Creator batch checkpoint belongs to another draft.');
      const assets = [];
      for (const sha256 of new Set(document.items.map((item) => item.sourceSha256))) {
        const source = await store.readSelectedBlob(sha256, {
          signal,
          maxBytes: CREATOR_IMAGE_LIMITS.sourceBytes,
        });
        required(source, 'Creator batch source bytes are missing.');
        const sourceBytes = await source.arrayBuffer();
        required(
          (await creatorSHA256(sourceBytes)) === sha256,
          'Creator batch source failed its integrity check.',
        );
        assets.push({ sha256, blob: source });
      }
      const checkpoint = Object.freeze({ document, assets: Object.freeze(assets) });
      prepared.add(checkpoint);
      return Object.freeze({ revision: current.revision, checkpoint });
    },
    async save(checkpoint, expectedRevision, { signal } = {}) {
      required(prepared.has(checkpoint), 'Prepare the exact creator batch checkpoint first.');
      const { draftId } = checkpoint.document;
      const snapshot = await store.readDomain('media', { signal });
      const oldHeads = references(snapshot, draftId);
      const previous = oldHeads[0]?.revision ?? null;
      if (previous !== expectedRevision) {
        const error = new Error('A newer creator batch draft exists in another tab.');
        error.code = 'draft-conflict';
        throw error;
      }
      const revision = (previous ?? 0) + 1;
      const metadata = new Blob([canonicalJSON(checkpoint.document)], { type: 'application/json' });
      const metadataHash = await creatorSHA256(await metadata.arrayBuffer());
      creatorAbort(signal);
      const additions = [
        { id: `${headPrefix(draftId)}${revision}`, sha256: metadataHash },
        ...checkpoint.assets.map((asset) => ({
          id: sourceReference(draftId, asset.sha256),
          sha256: asset.sha256,
        })),
      ];
      const old = hydrateStoredStillMedia(snapshot.library);
      const additionsById = new Map(additions.map((item) => [item.id, item.sha256]));
      for (const item of old.legacy.items) {
        const replacement = additionsById.get(item.id);
        required(
          replacement === undefined || replacement === item.sha256,
          'Creator batch source hash prefix collision.',
        );
      }
      const removals = old.legacy.items.filter(
        (item) =>
          (item.id.startsWith(headPrefix(draftId)) || item.id.startsWith(sourcePrefix(draftId))) &&
          !additionsById.has(item.id),
      );
      const projected = {
        ...old,
        legacy: {
          ...old.legacy,
          items: [
            ...old.legacy.items.filter((item) => !removals.some(({ id }) => id === item.id)),
            ...additions,
          ],
        },
      };
      const wanted = storedStillHashes(projected);
      const assets = new Map(snapshot.assets.map((asset) => [asset.sha256, asset]));
      assets.set(metadataHash, { sha256: metadataHash, blob: metadata });
      for (const asset of checkpoint.assets) assets.set(asset.sha256, asset);
      const update = await prepareRetainedStillByteEdit(
        snapshot.library,
        { add: additions, remove: removals },
        [...assets.values()].filter((asset) => wanted.has(asset.sha256)),
        { signal },
      );
      await store.commitDomain('media', update, {
        signal,
        expectedGeneration: snapshot.generation,
      });
      return Object.freeze({ revision, checkpoint });
    },
  });
}
