import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../data-json.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { hydrateStoredStillMedia, prepareRetainedStillBytes } from '../media-storage-record.mjs';
import { VIDEO_POSTER_LIMITS } from '../video-poster.mjs';
import { creatorAbort, creatorSHA256, ownCreatorBlob } from './bytes.mjs';
import { validateCreatorStoryBindings } from './media-bundle.mjs';
import { validateCreatorPlaybackRange } from './media-intake.mjs';
import { t } from '../i18n/index.mjs';

const LEGACY_FORMAT = 'revealline-creator-source.v1',
  FORMAT = 'revealline-creator-source.v2',
  LEGACY_MAGIC = new TextEncoder().encode('RLCSB1\r\n'),
  MAGIC = new TextEncoder().encode('RLCSB2\r\n');
const MAX_MANIFEST = 2 * 1024 * 1024,
  MAX_ASSET_BYTES = 4 * 1024 * 1024,
  LEGACY_MAX_ASSETS = 100,
  MAX_ASSETS = 200,
  MAX_BYTES = 512 * 1024 * 1024;
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

function mediaEditingFromContent(content) {
  const stories = new Map((content.media?.stories ?? []).map((story) => [story.missionId, story]));
  return {
    format: 'revealline-creator-media-editing.v1',
    items: content.project.missions.map((mission) => {
      const picture = content.project.assets.find(
          (asset) => asset.id === mission.presentation.backgroundAssetId,
        ),
        story = stories.get(mission.id);
      required(picture, 'A media draft mission is missing its reviewed poster.');
      if (!story)
        return {
          name: mission.name,
          kind: 'image',
          source: null,
          posterSha256: picture.sha256,
        };
      return {
        name: mission.name,
        kind: 'video',
        source: {
          sha256: story.video.sha256,
          bytes: story.video.bytes,
          mime: story.video.mime,
        },
        posterSha256: story.poster.sha256,
        pairedImageSha256:
          story.poster.origin.kind === 'supplied-image'
            ? story.poster.origin.sourceImageSha256
            : null,
        posterRequestedTime:
          story.poster.origin.kind === 'captured-frame' ? story.poster.capture.requestedTime : null,
        playbackRange: story.playbackRange,
      };
    }),
  };
}

function validateMediaEditing(source, content) {
  const value = own(source);
  exactKeys(value, ['format', 'items'], 'creator media editing information');
  required(
    value.format === 'revealline-creator-media-editing.v1' &&
      Array.isArray(value.items) &&
      value.items.length >= 1 &&
      value.items.length <= 100,
    'Creator media editing information is invalid.',
  );
  const stories = new Map(content.media.stories.map((story) => [story.video.sha256, story]));
  for (const item of value.items) {
    const common = ['name', 'kind', 'source', 'posterSha256'];
    exactKeys(
      item,
      item.kind === 'video'
        ? [...common, 'pairedImageSha256', 'posterRequestedTime', 'playbackRange']
        : common,
      'creator media editing item',
    );
    required(
      typeof item.name === 'string' &&
        item.name.length > 0 &&
        item.name.length <= 255 &&
        ['image', 'video'].includes(item.kind) &&
        hashValid(item.posterSha256),
      'Creator media editing item is invalid.',
    );
    if (item.source !== null) {
      exactKeys(item.source, ['sha256', 'bytes', 'mime'], 'creator media source');
      required(
        hashValid(item.source.sha256) &&
          Number.isSafeInteger(item.source.bytes) &&
          item.source.bytes > 0 &&
          item.source.bytes <=
            (item.kind === 'video' ? VIDEO_POSTER_LIMITS.sourceBytes : MAX_ASSET_BYTES) &&
          (item.kind === 'video'
            ? ['video/mp4', 'video/webm'].includes(item.source.mime)
            : ['image/png', 'image/jpeg', 'image/webp'].includes(item.source.mime)),
        'Creator media source identity is invalid.',
      );
    } else required(item.kind === 'image', 'A private video source cannot be omitted.');
    if (item.kind === 'video') {
      const story = stories.get(item.source.sha256);
      required(
        story &&
          story.poster.sha256 === item.posterSha256 &&
          (item.pairedImageSha256 === null || hashValid(item.pairedImageSha256)) &&
          (item.posterRequestedTime === null || Number.isFinite(item.posterRequestedTime)),
        'Creator video choices differ from the reviewed campaign.',
      );
      validateCreatorPlaybackRange(story.video, item.playbackRange);
      required(
        canonicalJSON(story.playbackRange) === canonicalJSON(item.playbackRange),
        'Creator playback range differs from the reviewed campaign.',
      );
      if (story.poster.origin.kind === 'supplied-image')
        required(
          item.pairedImageSha256 === story.poster.origin.sourceImageSha256 &&
            item.posterRequestedTime === null,
          'Creator poster pairing differs from the reviewed campaign.',
        );
      else
        required(
          item.pairedImageSha256 === null &&
            item.posterRequestedTime === story.poster.capture.requestedTime,
          'Creator captured poster choice differs from the reviewed campaign.',
        );
    }
  }
  required(
    [...stories.keys()].every((sha256) =>
      value.items.some((item) => item.kind === 'video' && item.source.sha256 === sha256),
    ),
    'Creator media editing information is missing a reviewed video.',
  );
  return value;
}

function expectedMediaAssets(content, editing) {
  const facts = new Map();
  const add = (sha256, fact) => {
    const previous = facts.get(sha256);
    if (previous)
      required(
        previous.bytes === fact.bytes && previous.mime === fact.mime,
        'One private source hash cannot describe different bytes.',
      );
    else facts.set(sha256, fact);
  };
  for (const asset of content.project.assets)
    add(asset.sha256, { bytes: asset.bytes, mime: 'image/png', kind: 'poster' });
  for (const story of content.media.stories)
    add(story.video.sha256, {
      bytes: story.video.bytes,
      mime: story.video.mime,
      kind: 'victory-video-original',
    });
  for (const item of editing.items) {
    if (!item.source) continue;
    add(item.source.sha256, {
      bytes: item.source.bytes,
      mime: item.source.mime,
      kind: item.kind === 'video' ? 'victory-video-original' : 'source-image-original',
    });
  }
  return facts;
}

function document(source) {
  const value = own(source);
  exactKeys(
    value,
    ['format', 'draftId', 'content', 'editing', 'originalSha256', 'assets'],
    t('interface:creator.label.creatorSource'),
  );
  required(
    [LEGACY_FORMAT, FORMAT].includes(value.format) && draftId(value.draftId),
    t('errors:creator.invalidDraftIdentity'),
  );
  const media = Object.hasOwn(value.content, 'media');
  exactKeys(
    value.content,
    ['project', 'packId', 'themes', 'provenance', 'credits', ...(media ? ['media'] : [])],
    t('interface:creator.label.draftContent'),
  );
  required(
    (value.format === FORMAT) === media,
    'Media drafts require the current private source format.',
  );
  requireCreatorEditableProject(value.content.project);
  if (media) validateCreatorStoryBindings(value.content.media, { project: value.content.project });
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
  exactKeys(
    value.editing,
    ['fit', ...(media ? ['media'] : [])],
    t('interface:creator.label.editingInformation'),
  );
  required(
    ['contain', 'cover'].includes(value.editing.fit) &&
      originalHashes(value.originalSha256).length <= 50 &&
      originalHashes(value.originalSha256).every(hashValid),
    t('errors:creator.invalidSourcePicture'),
  );
  const mediaEditing = media ? validateMediaEditing(value.editing.media, value.content) : null;
  required(
    Array.isArray(value.assets) &&
      value.assets.length >= 1 &&
      value.assets.length <= (media ? MAX_ASSETS : LEGACY_MAX_ASSETS),
    t('errors:creator.sourcePicturesRequired'),
  );
  let previous = '';
  for (const item of value.assets) {
    exactKeys(
      item,
      ['sha256', 'bytes', ...(media ? ['mime', 'kind'] : [])],
      t('interface:creator.label.sourceAsset'),
    );
    required(
      hashValid(item.sha256) &&
        item.sha256 > previous &&
        Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <=
          (item.kind === 'victory-video-original'
            ? VIDEO_POSTER_LIMITS.sourceBytes
            : MAX_ASSET_BYTES),
      t('errors:creator.invalidSourceAssetInventory'),
    );
    if (media)
      required(
        ['poster', 'victory-video-original', 'source-image-original'].includes(item.kind) &&
          (item.kind === 'victory-video-original'
            ? ['video/mp4', 'video/webm'].includes(item.mime)
            : ['image/png', 'image/jpeg', 'image/webp'].includes(item.mime)),
        'Private media source inventory has an unsupported type.',
      );
    previous = item.sha256;
  }
  const expected = media
    ? expectedMediaAssets(value.content, mediaEditing)
    : new Map([
        ...(value.content.project.assets ?? []).map((a) => [a.sha256, null]),
        ...originalHashes(value.originalSha256).map((sha256) => [sha256, null]),
      ]);
  const wanted = new Set(expected.keys());
  required(
    wanted.size === value.assets.length &&
      value.assets.every((a) => {
        if (!wanted.has(a.sha256)) return false;
        const fact = expected.get(a.sha256);
        return !fact || (a.bytes === fact.bytes && a.mime === fact.mime && a.kind === fact.kind);
      }),
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
  const media = Object.hasOwn(content, 'media'),
    selectedEditing = media
      ? { fit: editing.fit, media: editing.media ?? mediaEditingFromContent(content) }
      : { fit: editing.fit };
  required(
    Array.isArray(assets) && assets.length >= 1 && assets.length <= MAX_ASSETS,
    t('errors:creator.onlySourcePictures'),
  );
  const editingRecord = media ? validateMediaEditing(selectedEditing.media, content) : null,
    expected = media ? expectedMediaAssets(content, editingRecord) : null;
  const owned = assets
    .map(({ sha256, blob }) => {
      const fact = expected?.get(sha256),
        limit =
          fact?.kind === 'victory-video-original'
            ? VIDEO_POSTER_LIMITS.sourceBytes
            : MAX_ASSET_BYTES;
      return Object.freeze({
        sha256,
        blob: ownCreatorBlob(blob, limit, t('interface:creator.label.sourcePicture')),
        ...(fact ? { mime: fact.mime, kind: fact.kind } : {}),
      });
    })
    .sort((a, b) => a.sha256.localeCompare(b.sha256));
  const record = document({
    format: media ? FORMAT : LEGACY_FORMAT,
    draftId: id,
    content,
    editing: selectedEditing,
    originalSha256,
    assets: owned.map((a) => ({
      sha256: a.sha256,
      bytes: a.blob.size,
      ...(media ? { mime: a.mime, kind: a.kind } : {}),
    })),
  });
  for (const asset of owned) {
    required(
      (await creatorSHA256(await asset.blob.arrayBuffer())) === asset.sha256,
      t('errors:creator.sourcePictureHashMismatch'),
    );
    creatorAbort(signal);
  }
  required(
    12 +
      new TextEncoder().encode(canonicalJSON(record)).length +
      owned.reduce((sum, asset) => sum + asset.blob.size, 0) <=
      MAX_BYTES,
    'Private creator source backup exceeds its byte budget.',
  );
  const result = Object.freeze({ document: record, assets: Object.freeze(owned) });
  prepared.add(result);
  return result;
}
export function exportCreatorSource(source) {
  required(prepared.has(source), t('errors:creator.prepareSourceBeforeDownload'));
  const metadata = new TextEncoder().encode(canonicalJSON(source.document));
  const header = new Uint8Array(12);
  header.set(source.document.format === FORMAT ? MAGIC : LEGACY_MAGIC);
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
  const current = MAGIC.every((b, i) => b === header[i]),
    legacy = LEGACY_MAGIC.every((b, i) => b === header[i]);
  required(current || legacy, t('errors:creator.chooseSourceBackup'));
  const size = new DataView(header.buffer).getUint32(8, false);
  required(
    size > 0 && size <= MAX_MANIFEST && size + 12 <= blob.size,
    t('errors:creator.invalidSourceMetadataLength'),
  );
  const record = document(
    new TextDecoder('utf-8', { fatal: true }).decode(await blob.slice(12, 12 + size).arrayBuffer()),
  );
  required(
    (current && record.format === FORMAT) || (legacy && record.format === LEGACY_FORMAT),
    t('errors:creator.chooseSourceBackup'),
  );
  let offset = size + 12;
  const assets = record.assets.map((a) => {
    required(offset + a.bytes <= blob.size, t('errors:creator.sourcePictureBytesMissing'));
    const result = {
      sha256: a.sha256,
      blob: blob.slice(offset, offset + a.bytes, a.mime ?? ''),
    };
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
          blob: await store.readSelectedBlob(asset.sha256, {
            signal,
            maxBytes:
              asset.kind === 'victory-video-original'
                ? VIDEO_POSTER_LIMITS.sourceBytes
                : MAX_ASSET_BYTES,
          }),
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
      for (const a of source.assets) assets.set(a.sha256, { sha256: a.sha256, blob: a.blob });
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
