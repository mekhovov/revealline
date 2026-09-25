import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { hydrateStoredStillMedia, prepareRetainedStillBytes } from '../media-storage-record.mjs';
import { creatorAbort, creatorSHA256, ownCreatorBlob } from './bytes.mjs';
import { t } from '../i18n/index.mjs';

const FORMAT = 'revealline-creator-source.v1',
  MAGIC = new TextEncoder().encode('RLCSB1\r\n');
const MAX_MANIFEST = 2 * 1024 * 1024,
  MAX_ASSET_BYTES = 4 * 1024 * 1024,
  MAX_ASSETS = 100,
  MAX_BYTES = MAX_MANIFEST + MAX_ASSETS * MAX_ASSET_BYTES + 12;
const prepared = new WeakSet();
const draftId = (id) => typeof id === 'string' && /^[a-z][a-z0-9-]{0,59}$/.test(id);
const hashValid = (hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
const own = (value) =>
  boundedJSON(value, { maxBytes: MAX_MANIFEST, maxNodes: 100000, maxDepth: 26, maxArray: 4096 });
/** Keep editable gameplay (including invalid geometry), while requiring a
 * bounded creator graph that can reopen without silently dropping batch items. */
export function requireCreatorEditableProject(project) {
  required(
    project?.format === 'ContentProjectV1' &&
      stableId(project.id) &&
      typeof project.name === 'string' &&
      project.name.length <= 160 &&
      Array.isArray(project.packs) &&
      project.packs.length === 1 &&
      Array.isArray(project.campaigns) &&
      project.campaigns.length >= 1 &&
      project.campaigns.length <= 12 &&
      Array.isArray(project.missions) &&
      project.missions.length >= 1 &&
      project.missions.length <= 50 &&
      Array.isArray(project.assets) &&
      project.assets.length >= 1 &&
      project.assets.length <= 50 &&
      project.missions.every(
        (mission) =>
          mission &&
          typeof mission === 'object' &&
          typeof mission.name === 'string' &&
          mission.name.length <= 160 &&
          mission.presentation &&
          typeof mission.presentation === 'object',
      ) &&
      project.assets.every(
        (asset) =>
          asset &&
          typeof asset === 'object' &&
          typeof asset.alt === 'string' &&
          asset.alt.length <= 512,
      ),
    t('errors:creator.draftStructure'),
  );
}
const originalHashes = (source) =>
  source === null ? [] : Array.isArray(source) ? source : [source];
function document(source) {
  const value = own(source);
  exactKeys(
    value,
    ['format', 'draftId', 'content', 'editing', 'originalSha256', 'assets'],
    t('interface:creator.label.creatorSource'),
  );
  required(
    value.format === FORMAT && draftId(value.draftId),
    t('errors:creator.invalidDraftIdentity'),
  );
  exactKeys(
    value.content,
    ['project', 'packId', 'themes', 'provenance', 'credits'],
    t('interface:creator.label.draftContent'),
  );
  requireCreatorEditableProject(value.content.project);
  const missionCount = value.content.project.missions.length;
  required(
    (missionCount === 1 && !Array.isArray(value.content.provenance)) ||
      (Array.isArray(value.content.provenance) && value.content.provenance.length === missionCount),
    t('errors:creator.generationRecordRequired'),
  );
  exactKeys(
    value.content.credits,
    ['creator', 'picture', 'license'],
    t('interface:creator.label.sourceCredits'),
  );
  required(
    ['creator', 'picture', 'license'].every(
      (key) =>
        typeof value.content.credits[key] === 'string' && value.content.credits[key].length <= 512,
    ),
    t('errors:creator.sourceCreditsBounded'),
  );
  exactKeys(value.editing, ['fit'], t('interface:creator.label.editingInformation'));
  required(
    ['contain', 'cover'].includes(value.editing.fit) &&
      originalHashes(value.originalSha256).length <= 50 &&
      originalHashes(value.originalSha256).every(hashValid),
    t('errors:creator.invalidSourcePicture'),
  );
  required(
    Array.isArray(value.assets) && value.assets.length >= 1 && value.assets.length <= MAX_ASSETS,
    t('errors:creator.sourcePicturesRequired'),
  );
  let previous = '';
  for (const item of value.assets) {
    exactKeys(item, ['sha256', 'bytes'], t('interface:creator.label.sourceAsset'));
    required(
      hashValid(item.sha256) &&
        item.sha256 > previous &&
        Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <= MAX_ASSET_BYTES,
      t('errors:creator.invalidSourceAssetInventory'),
    );
    previous = item.sha256;
  }
  const wanted = new Set([
    ...(value.content.project.assets ?? []).map((a) => a.sha256),
    ...originalHashes(value.originalSha256),
  ]);
  required(
    wanted.size === value.assets.length && value.assets.every((a) => wanted.has(a.sha256)),
    t('errors:creator.sourceAssetsMismatch'),
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
    Array.isArray(assets) && assets.length >= 1 && assets.length <= MAX_ASSETS,
    t('errors:creator.onlySourcePictures'),
  );
  const owned = assets
    .map(({ sha256, blob }) =>
      Object.freeze({
        sha256,
        blob: ownCreatorBlob(blob, MAX_ASSET_BYTES, t('interface:creator.label.sourcePicture')),
      }),
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
      t('errors:creator.sourcePictureHashMismatch'),
    );
    creatorAbort(signal);
  }
  const result = Object.freeze({ document: record, assets: Object.freeze(owned) });
  prepared.add(result);
  return result;
}
export function exportCreatorSource(source) {
  required(prepared.has(source), t('errors:creator.prepareSourceBeforeDownload'));
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
  const blob = ownCreatorBlob(file, MAX_BYTES, t('interface:creator.label.sourceBackup'));
  required(blob.size >= 12, t('errors:creator.truncatedSourceBackup'));
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  required(
    MAGIC.every((b, i) => b === header[i]),
    t('errors:creator.chooseSourceBackup'),
  );
  const size = new DataView(header.buffer).getUint32(8, false);
  required(
    size > 0 && size <= MAX_MANIFEST && size + 12 <= blob.size,
    t('errors:creator.invalidSourceMetadataLength'),
  );
  const record = document(
    new TextDecoder('utf-8', { fatal: true }).decode(await blob.slice(12, 12 + size).arrayBuffer()),
  );
  let offset = size + 12;
  const assets = record.assets.map((a) => {
    required(offset + a.bytes <= blob.size, t('errors:creator.sourcePictureBytesMissing'));
    const result = { sha256: a.sha256, blob: blob.slice(offset, offset + a.bytes) };
    offset += a.bytes;
    return result;
  });
  required(offset === blob.size, t('errors:creator.sourceTrailingBytes'));
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
        t('errors:creator.invalidCheckpointRevision'),
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
      required(draftId(id), t('errors:creator.invalidDraftId'));
      const snapshot = await store.readDomainMetadata('media', { signal });
      const current = references(snapshot, id)[0];
      if (!current) return null;
      const blob = await store.readSelectedBlob(current.sha256, { signal, maxBytes: MAX_MANIFEST });
      required(blob, t('errors:creator.checkpointMetadataMissing'));
      const bytes = await blob.arrayBuffer();
      required(
        (await creatorSHA256(bytes)) === current.sha256,
        t('errors:creator.checkpointIntegrityFailed'),
      );
      const record = document(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      required(record.draftId === id, t('errors:creator.checkpointWrongProject'));
      const assets = [];
      for (const asset of record.assets)
        assets.push({
          sha256: asset.sha256,
          blob: await store.readSelectedBlob(asset.sha256, { signal, maxBytes: MAX_ASSET_BYTES }),
        });
      return {
        revision: current.revision,
        source: await prepareCreatorSource(record, assets, { signal }),
      };
    },
    async save(source, expectedRevision, { signal } = {}) {
      required(prepared.has(source), t('errors:creator.prepareExactCheckpoint'));
      const snapshot = await store.readDomain('media', { signal });
      const previous = references(snapshot, source.document.draftId)[0]?.revision ?? null;
      if (previous !== expectedRevision) {
        const error = new Error(t('errors:creator.newerDraftExists'));
        error.code = 'draft-conflict';
        throw error;
      }
      const revision = (previous ?? 0) + 1;
      required(revision <= 50, t('errors:creator.checkpointLimitReached'));
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
