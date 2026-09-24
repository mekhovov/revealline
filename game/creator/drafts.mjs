import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { hydrateStoredStillMedia, prepareRetainedStillBytes } from '../media-storage-record.mjs';
import { creatorAbort, creatorSHA256, ownCreatorBlob } from './bytes.mjs';

const FORMAT = 'revealline-creator-source.v1',
  MAGIC = new TextEncoder().encode('RLCSB1\r\n');
const MAX_MANIFEST = 2 * 1024 * 1024,
  MAX_BYTES = MAX_MANIFEST + 8 * 1024 * 1024 + 12;
const prepared = new WeakSet();
const draftId = (id) => typeof id === 'string' && /^[a-z][a-z0-9-]{0,59}$/.test(id);
const hashValid = (hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
const own = (value) =>
  boundedJSON(value, { maxBytes: MAX_MANIFEST, maxNodes: 100000, maxDepth: 26, maxArray: 4096 });
/** Keep editable gameplay (including invalid geometry), but require the source
 * structure this single-picture UI can safely reopen without dropping items. */
export function requireCreatorEditableProject(project) {
  required(
    project?.format === 'ContentProjectV1' &&
      stableId(project.id) &&
      typeof project.name === 'string' &&
      project.name.length <= 160 &&
      ['packs', 'campaigns', 'missions', 'assets'].every(
        (key) =>
          Array.isArray(project[key]) &&
          project[key].length === 1 &&
          project[key][0] &&
          typeof project[key][0] === 'object',
      ) &&
      typeof project.missions[0].name === 'string' &&
      project.missions[0].name.length <= 160 &&
      project.missions[0].presentation &&
      typeof project.missions[0].presentation === 'object' &&
      typeof project.assets[0].alt === 'string' &&
      project.assets[0].alt.length <= 512,
    'This creator draft needs one pack, campaign, mission and picture. Keep other structures in Advanced Studio.',
  );
}
function document(source) {
  const value = own(source);
  exactKeys(
    value,
    ['format', 'draftId', 'content', 'editing', 'originalSha256', 'assets'],
    'creator source',
  );
  required(value.format === FORMAT && draftId(value.draftId), 'Invalid creator draft identity.');
  exactKeys(
    value.content,
    ['project', 'packId', 'themes', 'provenance', 'credits'],
    'creator draft content',
  );
  requireCreatorEditableProject(value.content.project);
  exactKeys(value.content.credits, ['creator', 'picture', 'license'], 'source credits');
  required(
    ['creator', 'picture', 'license'].every(
      (key) =>
        typeof value.content.credits[key] === 'string' && value.content.credits[key].length <= 512,
    ),
    'Source credits need bounded text.',
  );
  exactKeys(value.editing, ['fit'], 'creator editing information');
  required(
    ['contain', 'cover'].includes(value.editing.fit) &&
      (value.originalSha256 === null || hashValid(value.originalSha256)),
    'Invalid source picture or fitting information.',
  );
  required(
    Array.isArray(value.assets) && value.assets.length >= 1 && value.assets.length <= 2,
    'Source backup needs its runtime picture and optional original.',
  );
  let previous = '';
  for (const item of value.assets) {
    exactKeys(item, ['sha256', 'bytes'], 'source asset');
    required(
      hashValid(item.sha256) &&
        item.sha256 > previous &&
        Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <= 4 * 1024 * 1024,
      'Invalid source asset inventory.',
    );
    previous = item.sha256;
  }
  const wanted = new Set([
    ...(value.content.project.assets ?? []).map((a) => a.sha256),
    ...(value.originalSha256 ? [value.originalSha256] : []),
  ]);
  required(
    wanted.size === value.assets.length && value.assets.every((a) => wanted.has(a.sha256)),
    'Source backup contains missing or unrelated assets.',
  );
  return freezeDesign(value);
}
export async function prepareCreatorSource(
  { draftId: id, content, editing, originalSha256 = null },
  assets,
  { signal } = {},
) {
  creatorAbort(signal);
  required(
    Array.isArray(assets) && assets.length >= 1 && assets.length <= 2,
    'Provide only this source project’s pictures.',
  );
  const owned = assets
    .map(({ sha256, blob }) =>
      Object.freeze({ sha256, blob: ownCreatorBlob(blob, 4 * 1024 * 1024, 'Source picture') }),
    )
    .sort((a, b) => a.sha256.localeCompare(b.sha256));
  const record = document({
    format: FORMAT,
    draftId: id,
    content,
    editing,
    originalSha256,
    assets: owned.map((a) => ({ sha256: a.sha256, bytes: a.blob.size })),
  });
  for (const asset of owned) {
    required(
      (await creatorSHA256(await asset.blob.arrayBuffer())) === asset.sha256,
      'Source picture hash differs from its bytes.',
    );
    creatorAbort(signal);
  }
  const result = Object.freeze({ document: record, assets: Object.freeze(owned) });
  prepared.add(result);
  return result;
}
export function exportCreatorSource(source) {
  required(prepared.has(source), 'Prepare this source backup before downloading it.');
  const metadata = new TextEncoder().encode(canonicalJSON(source.document));
  const header = new Uint8Array(12);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, metadata.length, false);
  return new Blob([header, metadata, ...source.assets.map((a) => a.blob)], {
    type: 'application/vnd.revealline.source',
  });
}
export async function importCreatorSource(file, { signal } = {}) {
  creatorAbort(signal);
  const blob = ownCreatorBlob(file, MAX_BYTES, 'Source backup');
  required(blob.size >= 12, 'Truncated source backup.');
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  required(
    MAGIC.every((b, i) => b === header[i]),
    'Choose a creator .rlsource backup.',
  );
  const size = new DataView(header.buffer).getUint32(8, false);
  required(
    size > 0 && size <= MAX_MANIFEST && size + 12 <= blob.size,
    'Invalid source metadata length.',
  );
  const record = document(
    new TextDecoder('utf-8', { fatal: true }).decode(await blob.slice(12, 12 + size).arrayBuffer()),
  );
  let offset = size + 12;
  const assets = record.assets.map((a) => {
    required(offset + a.bytes <= blob.size, 'Source backup is missing picture bytes.');
    const result = { sha256: a.sha256, blob: blob.slice(offset, offset + a.bytes) };
    offset += a.bytes;
    return result;
  });
  required(offset === blob.size, 'Source backup contains trailing bytes.');
  return prepareCreatorSource(record, assets, { signal });
}

function references(snapshot, id) {
  const prefix = `creator.draft.${id}.`;
  return hydrateStoredStillMedia(snapshot.library)
    .legacy.items.filter((r) => r.id.startsWith(prefix))
    .map((r) => {
      const revision = Number(r.id.slice(prefix.length));
      required(
        Number.isSafeInteger(revision) && revision >= 1 && revision <= 50,
        'Invalid draft checkpoint revision.',
      );
      return { ...r, revision };
    })
    .sort((a, b) => b.revision - a.revision);
}
/** Same immutable-checkpoint and compare-head conventions as Content Studio.
 * The complete source checkpoint, originals and head reference share the managed
 * media transaction. Opening Advanced Studio is an explicit source-copy action. */
export function createCreatorDraftBackend(store) {
  return Object.freeze({
    async read(id, { signal } = {}) {
      required(draftId(id), 'Invalid creator draft ID.');
      const snapshot = await store.readDomainMetadata('media', { signal });
      const current = references(snapshot, id)[0];
      if (!current) return null;
      const blob = await store.readSelectedBlob(current.sha256, { signal, maxBytes: MAX_MANIFEST });
      required(blob, 'Draft checkpoint metadata is missing. Restore a source backup.');
      const bytes = await blob.arrayBuffer();
      required(
        (await creatorSHA256(bytes)) === current.sha256,
        'Draft checkpoint metadata failed its integrity check.',
      );
      const record = document(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      required(record.draftId === id, 'Draft checkpoint belongs to another project.');
      const assets = [];
      for (const asset of record.assets)
        assets.push({
          sha256: asset.sha256,
          blob: await store.readSelectedBlob(asset.sha256, { signal, maxBytes: 4 * 1024 * 1024 }),
        });
      return {
        revision: current.revision,
        source: await prepareCreatorSource(record, assets, { signal }),
      };
    },
    async save(source, expectedRevision, { signal } = {}) {
      required(prepared.has(source), 'Prepare the exact source checkpoint first.');
      const snapshot = await store.readDomain('media', { signal });
      const previous = references(snapshot, source.document.draftId)[0]?.revision ?? null;
      if (previous !== expectedRevision) {
        const error = new Error('A newer draft exists. Reload it or save a separate project copy.');
        error.code = 'draft-conflict';
        throw error;
      }
      const revision = (previous ?? 0) + 1;
      required(
        revision <= 50,
        'This draft has 50 retained checkpoints. Download a source backup and start a new draft copy.',
      );
      const blob = new Blob([canonicalJSON(source.document)], { type: 'application/json' });
      const sha256 = await creatorSHA256(await blob.arrayBuffer());
      const additions = [
        { id: `creator.draft.${source.document.draftId}.${revision}`, sha256 },
        ...source.assets.map((a) => ({ id: `creator.asset.${a.sha256}`, sha256: a.sha256 })),
      ];
      const assets = new Map(snapshot.assets.map((a) => [a.sha256, a]));
      assets.set(sha256, { sha256, blob });
      for (const a of source.assets) assets.set(a.sha256, a);
      const update = await prepareRetainedStillBytes(
        snapshot.library,
        additions,
        [...assets.values()],
        { signal },
      );
      await store.commitDomain('media', update, {
        signal,
        expectedGeneration: snapshot.generation,
      });
      return { revision, source };
    },
  });
}
