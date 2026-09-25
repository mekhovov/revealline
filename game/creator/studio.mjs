import { CREATOR_TEMPLATES, generateCreatorProject } from './templates.mjs';
import { prepareCreatorImage } from './image.mjs';
import {
  prepareCreatorBundle,
  importCreatorBundle,
  approveCreatorBundle,
  exportCreatorBundle,
} from './bundle.mjs';
import {
  createCreatorStore,
  reviewCreatorInstallation,
  installPreparedCreatorBundle,
  installedCreatorManifests,
  loadInstalledCreatorBundle,
} from './installed.mjs';
import {
  prepareCreatorSource,
  exportCreatorSource,
  importCreatorSource,
  createCreatorDraftBackend,
  requireCreatorEditableProject,
} from './drafts.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { createContentDraftBackend } from '../content-design/drafts.mjs';
import { downloadCreatorFile } from './download.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { createBatchCreatorController } from './batch-ui.mjs';
import { prepareReviewedCreatorBundle } from './batch-bundle.mjs';
import { createCreatorMediaReviewController } from './media-review.mjs';
import { prepareCreatorMediaCampaign } from './media-campaign.mjs';
import {
  formatNumber,
  localizedMessage,
  localizedText,
  onLocaleChange,
  t,
} from '../i18n/index.mjs';

const $ = (id) => document.getElementById(id),
  store = createCreatorStore(),
  backend = createCreatorDraftBackend(store);
const status = (message, error = false) => {
  localizedText($('status'), message);
  $('status').classList.toggle('error', error);
};
const fail = (error) =>
  status(
    error.name === 'AbortError'
      ? localizedMessage('interface:creator.cancelledDraftAvailable')
      : error.message,
    error.name !== 'AbortError',
  );
const mib = (bytes) =>
  t('common:format.mebibytes', {
    value: formatNumber(bytes / 1048576, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  });
const params = new URLSearchParams(location.search);
const id = params.get('draft') ?? `creation-${crypto.randomUUID()}`;
const draft = { id, revision: null, source: null, saved: null, running: null };
let sourceFile = null,
  image = null,
  content = null,
  prepared = null,
  approval = null,
  installReview = null,
  controller = null,
  busy = true,
  pictureURL = null,
  batchMode = false,
  batchSource = null,
  mediaMode = false,
  mediaSource = null,
  sourceVersion = 0,
  saveTimer = null;
const batchSeed = crypto.getRandomValues(new Uint32Array(1))[0];
let themes = [];
try {
  const themesResponse = await fetch('../content-design/themes.json');
  if (themesResponse.ok) themes = (await themesResponse.json()).themes;
} catch {
  status(localizedMessage('interface:creator.themesUnavailable'), true);
}
if (!params.has('draft')) {
  params.set('draft', id);
  history.replaceState(null, '', `?${params}`);
}
// Multi-file intake is enabled only because this adapter revalidates the exact
// one-mission preparations displayed on every review card.
const batchApprovalAdapter = { approve: approveReviewedBatch };
const batchEnabled = !!batchApprovalAdapter;
const defaultFields = new Map([
  ['name', 'interface:creator.defaultCollectionName'],
  ['mission-title', 'interface:creator.defaultLevelTitle'],
  ['description', 'interface:creator.defaultPictureDescription'],
  ['creator-credit', 'interface:creator.defaultCreatorCredit'],
  ['picture-credit', 'interface:creator.defaultPictureCredit'],
  ['license', 'interface:creator.defaultLicense'],
]);
const localizedDefaults = new Map();
const defaultOwned = new Set(defaultFields.keys());
function refreshDefaultFields() {
  for (const [field, key] of defaultFields) {
    if (!defaultOwned.has(field)) continue;
    const next = t(key);
    const previous = localizedDefaults.get(field);
    if (previous === undefined || $(field).value === previous) $(field).value = next;
    localizedDefaults.set(field, next);
  }
}
for (const field of defaultFields.keys())
  $(field).addEventListener('input', () => defaultOwned.delete(field));
onLocaleChange(refreshDefaultFields);
refreshDefaultFields();

function controls() {
  $('edits').hidden = !content || batchMode || mediaMode;
  $('generate').disabled = busy || mediaMode || (!sourceFile && !content);
  $('approve').disabled = busy || !prepared;
  $('approve').hidden = batchMode && !!approval;
  $('install').disabled = busy || !installReview?.enoughManagedSpace;
  $('download').disabled = busy || !approval;
  $('backup').disabled = busy || !content || mediaMode;
  $('save').disabled = busy || !content || mediaMode;
  $('cancel').hidden = !busy;
  for (const key of ['image', 'import']) $(key).disabled = busy;
  for (const key of ['advanced', 'load-advanced', 'regenerate']) $(key).disabled = busy || !content;
  for (const key of [
    'name',
    'mission-title',
    'description',
    'creator-credit',
    'picture-credit',
    'license',
  ])
    $(key).disabled = busy || mediaMode;
  $('fit').disabled = busy || mediaMode || (!!content && !sourceFile);
}

const batch = createBatchCreatorController({
  document,
  nodes: {
    surface: $('batch-review'),
    list: $('batch-list'),
    progress: $('batch-progress'),
    progressLabel: $('batch-progress-label'),
    readiness: $('batch-readiness'),
    capacity: $('batch-capacity'),
    generate: $('batch-generate'),
    cancel: $('batch-cancel'),
    removeExcluded: $('batch-remove-excluded'),
    split: $('batch-split'),
    approve: $('batch-approve'),
    intake: $('image'),
    pacing: $('pacing'),
    collectionName: $('name'),
    fit: $('fit'),
    creatorCredit: $('creator-credit'),
    pictureCredit: $('picture-credit'),
    license: $('license'),
  },
  prepareItem: async (item, context) => {
    const preparedImage = await prepareCreatorImage(
      item.file,
      { alt: item.title, fit: context.settings.fit },
      { signal: context.signal },
    );
    const seed = (batchSeed + context.index + context.generation * 65537) >>> 0;
    const families = CREATOR_TEMPLATES.map(({ id: templateId }) => templateId);
    const templateId =
      context.settings.pacing === 'gentle-first' && context.index < Math.ceil(context.total / 3)
        ? families[0]
        : context.settings.pacing === 'steady'
          ? families[2]
          : context.settings.pacing === 'balanced'
            ? families[(seed + context.index) % families.length]
            : undefined;
    const generated = generateCreatorProject({
      id: `${id}-${item.id}`,
      name: context.settings.collectionName,
      seed,
      ...(templateId ? { templateId } : {}),
    });
    const itemProject = structuredClone(generated.project);
    const missionId = item.id;
    const mapId = `${item.id}-map`;
    const assetId = `${item.id}-asset`;
    itemProject.maps[0].id = mapId;
    itemProject.missions[0].id = missionId;
    itemProject.missions[0].map.id = mapId;
    itemProject.campaigns[0].missionIds = [missionId];
    const itemContent = {
      project: itemProject,
      packId: 'collection',
      themes: themes.filter(
        (theme) => theme.id === generated.project.missions[0].presentation.themeId,
      ),
      provenance: { ...generated.provenance, missionId },
      credits: {
        creator: context.settings.creatorCredit,
        picture: context.settings.pictureCredit,
        license: context.settings.license,
      },
    };
    const asset = structuredClone(preparedImage.asset);
    asset.id = assetId;
    itemContent.project.assets = [asset];
    itemContent.project.missions[0].name = item.title;
    itemContent.project.missions[0].presentation.backgroundAssetId = assetId;
    const generatedMission = itemContent.project.missions[0];
    const generatedMap = itemContent.project.maps[0];
    const enemies = generatedMission.actors.length;
    const walls = generatedMap.walls.length;
    const foundations = generatedMap.foundations.length;
    const terrain = generatedMap.terrain.length;
    const itemPack = await prepareCreatorBundle(
      itemContent,
      [{ sha256: preparedImage.runtime.sha256, blob: preparedImage.runtime.blob }],
      { signal: context.signal },
    );
    return {
      image: preparedImage,
      prepared: itemPack,
      thumbnail: preparedImage.thumbnail.blob,
      alt: item.title,
      estimatedBytes: itemPack.bytes,
      validation: itemPack.review.validation,
      templateLabel: () =>
        t('interface:creator.templateSummary', {
          template: generated.provenance.templateId,
          variant: generated.provenance.variantId,
          enemies: t('common:counts.enemies', { count: enemies }),
          walls: t('common:counts.walls', { count: walls }),
          foundations: t('common:counts.safeIslands', { count: foundations }),
          terrain: t('common:counts.terrainZones', { count: terrain }),
        }),
    };
  },
  approveBatch: batchApprovalAdapter?.approve,
  onChange: () => {
    $('batch-split-results').replaceChildren();
    $('batch-split-results').hidden = true;
  },
  onSplit: (chunks, settings) => {
    localizedText($('batch-capacity'), () =>
      t('interface:creator.acceptedParts', {
        count: chunks.length,
        parts: chunks
          .map((chunk, index) =>
            t('interface:creator.partSummary', {
              number: index + 1,
              count: chunk.length,
            }),
          )
          .join(', '),
      }),
    );
    const results = $('batch-split-results');
    const explanation = document.createElement('p');
    localizedText(explanation, () => t('interface:creator.splitReviewHelp'));
    results.replaceChildren(explanation);
    for (const [index, chunk] of chunks.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'secondary';
      localizedText(button, () =>
        t('interface:creator.reviewPart', { current: index + 1, total: chunks.length }),
      );
      button.onclick = () =>
        approveReviewedBatch(chunk, {
          ...settings,
          collectionName: `${settings.collectionName} · Part ${index + 1} of ${chunks.length}`,
        });
      results.append(button);
    }
    results.hidden = false;
  },
});
const mediaReview = createCreatorMediaReviewController({
  document,
  nodes: {
    surface: $('media-review'),
    list: $('media-list'),
    status: $('media-status'),
    apply: $('media-apply'),
    cancel: $('media-cancel'),
  },
  onPrepared: (reviewed) => {
    if (reviewed.items.some((item) => item.errors.length)) {
      status(localizedMessage('interface:creator.resolveMediaChoices'), true);
      return;
    }
    void operation(async (signal) => {
      invalidate();
      status(localizedMessage('interface:creator.generatingReviewedMedia'));
      const result = await prepareCreatorMediaCampaign(
        reviewed,
        {
          draftId: id,
          collectionName: $('name').value,
          seed: batchSeed,
          themes,
          credits: {
            creator: $('creator-credit').value,
            picture: $('picture-credit').value,
            license: $('license').value,
          },
        },
        { signal },
      );
      prepared = result.prepared;
      mediaSource = result;
      const { compatibility: _compatibility, ...selected } = prepared.manifest.content;
      content = structuredClone(selected);
      batchMode = false;
      mediaMode = true;
      sourceFile = image = null;
      localizedText(
        $('save-status'),
        localizedMessage('interface:creator.videoSourcesSessionOnly'),
      );
      showReview(prepared);
      status(
        localizedMessage('interface:creator.mediaLevelsGenerated', {
          count: content.project.missions.length,
        }),
      );
    });
  },
});
function invalidate() {
  prepared = approval = installReview = null;
  $('review').hidden = true;
  $('approved').hidden = true;
  $('play').hidden = true;
  controls();
}
function readLabels() {
  if (!content) return;
  const project = content.project;
  project.name = $('name').value;
  project.campaigns[0].name = project.packs[0].name = project.name;
  project.missions[0].name = $('mission-title').value;
  if (project.assets?.[0]) project.assets[0].alt = $('description').value;
  content.credits = {
    creator: $('creator-credit').value,
    picture: $('picture-credit').value,
    license: $('license').value,
  };
}
function fillLabels() {
  defaultOwned.clear();
  $('name').value = content.project.name;
  $('mission-title').value = content.project.missions[0].name;
  $('description').value =
    content.project.assets[0]?.alt ?? t('interface:creator.defaultPictureDescription');
  $('creator-credit').value = content.credits.creator;
  $('picture-credit').value = content.credits.picture;
  $('license').value = content.credits.license;
}
function currentAssets() {
  if (mediaSource) return mediaSource.sourceAssets;
  if (batchSource) return batchSource.sourceAssets;
  const all = [
    ...(image
      ? [image.runtime]
      : (draft.source?.assets.filter((a) =>
          content.project.assets.some((pin) => pin.sha256 === a.sha256),
        ) ?? [])),
  ];
  if (image?.original) all.push(image.original);
  else {
    const originals = draft.source?.document.originalSha256;
    for (const sha256 of originals === null || originals === undefined
      ? []
      : Array.isArray(originals)
        ? originals
        : [originals])
      all.push(draft.source.assets.find((a) => a.sha256 === sha256));
  }
  return [
    ...new Map(
      all.filter(Boolean).map((a) => [a.sha256, { sha256: a.sha256, blob: a.blob }]),
    ).values(),
  ];
}
async function sourceSnapshot() {
  return prepareCreatorSource(
    {
      draftId: id,
      content: structuredClone(content),
      editing: { fit: $('fit').value },
      originalSha256:
        batchSource?.originalSha256 ??
        image?.original?.sha256 ??
        draft.source?.document.originalSha256 ??
        null,
    },
    currentAssets(),
  );
}
async function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!content) return;
  const version = ++sourceVersion;
  const source = await sourceSnapshot();
  if (version !== sourceVersion) return;
  draft.source = source;
  if (draft.saved && canonicalJSON(draft.saved.document) === canonicalJSON(source.document))
    draft.source = draft.saved;
  if (draft.running) return draft.running;
  const running = (async () => {
    try {
      while (draft.source !== draft.saved) {
        const next = draft.source;
        const result = await backend.save(next, draft.revision);
        draft.revision = result.revision;
        draft.saved = next;
      }
      localizedText(
        $('save-status'),
        localizedMessage('interface:creator.savedCheckpoint', { revision: draft.revision }),
      );
    } catch (error) {
      localizedText(
        $('save-status'),
        localizedMessage('interface:creator.sessionOnlyBackupAvailable', {
          error: error.message,
        }),
      );
    }
  })();
  // A duplicate checkpoint can finish synchronously. Assign first and clear
  // after awaiting so a completed promise cannot masquerade as an active save.
  draft.running = running;
  try {
    await running;
  } finally {
    if (draft.running === running) draft.running = null;
  }
}
async function operation(action) {
  if (busy) return;
  busy = true;
  controller = new AbortController();
  controls();
  try {
    await action(controller.signal);
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    controller = null;
    controls();
  }
}
function showReview(pack) {
  const project = pack.manifest.content.project;
  const provenances = Array.isArray(pack.manifest.content.provenance)
    ? pack.manifest.content.provenance
    : [pack.manifest.content.provenance];
  const provenance = provenances[0];
  const mission = project.missions.find(({ id: missionId }) => missionId === provenance.missionId);
  const picture = project.assets.find(
    ({ id: assetId }) => assetId === mission?.presentation.backgroundAssetId,
  );
  const runtime = pack.assets.find(({ sha256 }) => sha256 === picture?.sha256);
  if (!mission || !picture || !runtime)
    throw new Error(t('errors:creator.firstMissionPictureMissing'));
  if (pictureURL) URL.revokeObjectURL(pictureURL);
  pictureURL = URL.createObjectURL(runtime.blob);
  $('picture').src = pictureURL;
  $('picture').alt = picture.alt;
  localizedText($('picture-caption'), () =>
    project.missions.length === 1
      ? mission.name
      : t('interface:creator.firstOfLevels', {
          mission: mission.name,
          count: project.missions.length,
        }),
  );
  const preview = prepareContentPreview(project, provenance.missionId);
  paintContentMap($('map').getContext('2d'), preview, { width: 720, showCapture: false });
  const template = CREATOR_TEMPLATES.find(({ id }) => id === provenance.templateId);
  const map = project.maps.find(
    ({ id: mapId, revision }) => mapId === mission.map.id && revision === mission.map.revision,
  );
  const enemies = mission.actors.length;
  const walls = map?.walls.length ?? 0;
  const foundations = map?.foundations.length ?? 0;
  const terrain = map?.terrain.length ?? 0;
  localizedText($('map-caption'), () =>
    t('interface:creator.mapSummary', {
      template: template?.name ?? t('interface:creator.verifiedCrossing'),
      enemies: t('common:counts.enemies', { count: enemies }),
      walls: t('common:counts.walls', { count: walls }),
      foundations: t('common:counts.safeIslands', { count: foundations }),
      terrain: t('common:counts.terrainZones', { count: terrain }),
      evidence: t('interface:creator.routeEvidence', { count: provenances.length }),
    }),
  );
  $('validation').textContent = pack.review.validation;
  const storyCount = pack.manifest.content.media?.stories.length ?? 0;
  localizedText($('package-size'), () =>
    t('interface:creator.packageSummary', {
      size: mib(pack.bytes),
      derivatives: t('common:counts.pngDerivatives', { count: project.assets.length }),
      videos: storyCount ? t('interface:creator.withVictoryVideos', { count: storyCount }) : '',
    }),
  );
  $('review').hidden = false;
}
async function generate(signal) {
  invalidate();
  status(localizedMessage('interface:creator.preparingPictureRoute'));
  if (sourceFile)
    image = await prepareCreatorImage(
      sourceFile,
      { alt: $('description').value, fit: $('fit').value },
      { signal },
    );
  if (!content) {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const generated = generateCreatorProject({ id, name: $('name').value, seed });
    content = {
      project: structuredClone(generated.project),
      packId: 'collection',
      themes: themes.filter(
        (theme) => theme.id === generated.project.missions[0].presentation.themeId,
      ),
      provenance: generated.provenance,
      credits: {},
    };
  }
  if (image) {
    content.project.assets = [structuredClone(image.asset)];
    content.project.missions[0].presentation.backgroundAssetId = image.asset.id;
  }
  readLabels();
  await saveDraft();
  prepared = await prepareCreatorBundle(content, currentAssets(), { signal });
  showReview(prepared);
  status(localizedMessage('interface:creator.levelReadyForReview'));
}
function choose(file) {
  if (!file) return;
  batchMode = false;
  batchSource = null;
  mediaMode = false;
  mediaSource = null;
  sourceFile = file;
  defaultOwned.delete('mission-title');
  invalidate();
  $('mission-title').value =
    file.name.replace(/\.[^.]+$/, '').slice(0, 160) || t('interface:creator.defaultLevelTitle');
  $('fit').disabled = false;
  status(
    localizedMessage('interface:creator.fileSelected', {
      file: file.name,
    }),
  );
}

function chooseFiles(files) {
  const selected = [...files];
  if (!selected.length) return;
  const includesVideo = selected.some(
    (file) =>
      ['video/mp4', 'video/webm'].includes(file.type) ||
      (!file.type && /\.(?:mp4|webm)$/i.test(file.name)),
  );
  if (includesVideo) {
    controller?.abort();
    batch.setFiles([]);
    $('batch-options').hidden = true;
    batchMode = false;
    batchSource = null;
    mediaMode = true;
    mediaSource = null;
    sourceFile = image = content = prepared = approval = installReview = null;
    $('review').hidden = true;
    $('approved').hidden = true;
    $('edits').hidden = true;
    $('play').hidden = true;
    const review = mediaReview.setFiles(selected);
    status(
      localizedMessage('interface:creator.mediaFilesSelected', {
        count: review.sources.length,
      }),
    );
    controls();
    return;
  }
  mediaReview.setFiles([]);
  mediaMode = false;
  mediaSource = null;
  if (selected.length > 1 && !batchEnabled)
    return status(localizedMessage('interface:creator.batchUnavailable'), true);
  if (selected.length === 1) {
    batch.setFiles([]);
    $('batch-options').hidden = true;
    choose(selected[0]);
    return;
  }
  controller?.abort();
  batchMode = true;
  batchSource = null;
  sourceFile = image = content = prepared = approval = installReview = null;
  $('review').hidden = true;
  $('approved').hidden = true;
  $('edits').hidden = true;
  $('play').hidden = true;
  $('batch-options').hidden = false;
  const selectedBatch = batch.setFiles(selected);
  status(
    localizedMessage('interface:creator.batchSelected', {
      count: selectedBatch.items.length,
    }),
  );
  controls();
}
async function approveReviewedBatch(items, settings) {
  return operation(async (signal) => {
    invalidate();
    status(localizedMessage('interface:creator.assemblingCampaign'));
    const result = await prepareReviewedCreatorBundle(
      items,
      {
        draftId: id,
        collectionName: settings.collectionName,
        creatorCredit: settings.creatorCredit,
        pictureCredit: settings.pictureCredit,
        license: settings.license,
      },
      { signal },
    );
    prepared = result.prepared;
    batchSource = result;
    mediaSource = null;
    const { compatibility: _compatibility, ...selected } = prepared.manifest.content;
    content = structuredClone(selected);
    batchMode = true;
    mediaMode = false;
    sourceFile = image = null;
    fillLabels();
    await saveDraft();
    showReview(prepared);
    approval = approveCreatorBundle(prepared);
    $('approved').hidden = false;
    try {
      installReview = await reviewCreatorInstallation(store, prepared, approval, { signal });
      const review = installReview;
      localizedText($('storage-review'), () =>
        t('interface:creator.storageReview', {
          pack: mib(review.packageBytes),
          staging: mib(review.stagingBytes),
          used: mib(review.usedBytes),
          limit: mib(review.limitBytes),
          status: t(
            review.enoughManagedSpace
              ? 'interface:creator.readyToInstall'
              : 'interface:creator.storageFullDownload',
          ),
        }),
      );
    } catch (error) {
      localizedText(
        $('storage-review'),
        localizedMessage('interface:creator.installStorageUnavailable', {
          error: error.message,
        }),
      );
    }
    status(
      localizedMessage('interface:creator.reviewedLevelsApproved', {
        count: content.project.missions.length,
      }),
    );
  });
}
async function openPrepared(pack) {
  const { compatibility: _compatibility, ...selected } = pack.manifest.content;
  content = structuredClone(selected);
  batchMode = content.project.missions.length > 1;
  batchSource = null;
  mediaMode = !!content.media;
  mediaSource = null;
  sourceFile = image = null;
  if (mediaMode) {
    draft.source = null;
    $('fit').value = 'contain';
    $('fit').disabled = true;
    fillLabels();
    invalidate();
    prepared = pack;
    showReview(pack);
    localizedText(
      $('save-status'),
      localizedMessage('interface:creator.videoCampaignSessionVerified'),
    );
    status(localizedMessage('interface:creator.mediaPackVerified'));
    return;
  }
  draft.source = await prepareCreatorSource(
    { draftId: id, content, editing: { fit: 'contain' }, originalSha256: null },
    pack.assets,
  );
  $('fit').value = 'contain';
  $('fit').disabled = true;
  fillLabels();
  invalidate();
  prepared = pack;
  showReview(pack);
  await saveDraft();
  status(localizedMessage('interface:creator.picturePackVerified'));
}
async function openSource(source) {
  content = structuredClone(source.document.content);
  batchMode = content.project.missions.length > 1;
  batchSource = null;
  mediaMode = !!content.media;
  mediaSource = null;
  draft.source = source;
  image = null;
  sourceFile = Array.isArray(source.document.originalSha256)
    ? null
    : (source.assets.find((a) => a.sha256 === source.document.originalSha256)?.blob ?? null);
  $('fit').value = source.document.editing.fit;
  $('fit').disabled = !sourceFile;
  fillLabels();
  invalidate();
  status(localizedMessage('interface:creator.sourceDraftRestored'));
}
async function listInstalled() {
  const list = $('installed-list');
  list.replaceChildren();
  try {
    const manifests = await installedCreatorManifests(store);
    if (!manifests.length) localizedText(list, () => t('interface:creator.noCampaignsInstalled'));
    for (const manifest of manifests) {
      const row = document.createElement('div');
      row.className = 'installed-item';
      const title = document.createElement('h3');
      title.textContent = manifest.content.project.name;
      const edition = document.createElement('p');
      edition.className = 'muted';
      const missions = manifest.content.project.missions.length;
      localizedText(edition, () =>
        t('interface:creator.installedEdition', {
          edition: manifest.editionId.slice(0, 12),
          missions: t('common:counts.missions', { count: missions }),
        }),
      );
      const play = document.createElement('a');
      play.href = `./player.html?edition=${manifest.editionId}`;
      localizedText(play, () => t('interface:creator.playCampaign'));
      const edit = document.createElement('button');
      edit.className = 'secondary';
      localizedText(edit, () => t('interface:creator.openEditableSource'));
      edit.onclick = () =>
        operation(async (signal) =>
          openPrepared(await loadInstalledCreatorBundle(store, manifest.editionId, { signal })),
        );
      row.append(title, edition, play, document.createTextNode(' '), edit);
      list.append(row);
    }
  } catch (error) {
    localizedText(
      list,
      localizedMessage('interface:creator.libraryUnavailable', { error: error.message }),
    );
  }
}
$('image').onchange = () => chooseFiles($('image').files);
$('drop').ondragover = (event) => {
  event.preventDefault();
  $('drop').classList.add('dragging');
};
$('drop').ondragleave = () => $('drop').classList.remove('dragging');
$('drop').ondrop = (event) => {
  event.preventDefault();
  $('drop').classList.remove('dragging');
  if (busy) return;
  chooseFiles(event.dataTransfer.files);
};
for (const key of [
  'name',
  'mission-title',
  'description',
  'fit',
  'creator-credit',
  'picture-credit',
  'license',
])
  $(key).oninput = () => {
    controller?.abort();
    invalidate();
    readLabels();
    if (content) {
      clearTimeout(saveTimer);
      localizedText($('save-status'), localizedMessage('interface:creator.savingDraftChanges'));
      saveTimer = setTimeout(() => {
        void saveDraft().catch(fail);
      }, 500);
    }
    status(localizedMessage('interface:creator.draftChangesPending'));
  };
$('generate').onclick = () => operation(generate);
$('regenerate').onclick = () =>
  operation(async (signal) => {
    const created = generateCreatorProject({
      id: content.project.id,
      name: $('name').value,
      seed: (content.provenance.generationSeed + 1) >>> 0,
    });
    const assets = content.project.assets;
    content.project = structuredClone(created.project);
    content.project.assets = assets;
    content.project.missions[0].presentation.backgroundAssetId = assets[0].id;
    content.provenance = created.provenance;
    await generate(signal);
  });
$('cancel').onclick = () => controller?.abort();
$('approve').onclick = () =>
  operation(async (signal) => {
    await draft.running;
    approval = approveCreatorBundle(prepared);
    $('approved').hidden = false;
    try {
      installReview = await reviewCreatorInstallation(store, prepared, approval, { signal });
      const review = installReview;
      localizedText($('storage-review'), () =>
        t('interface:creator.storageReview', {
          pack: mib(review.packageBytes),
          staging: mib(review.stagingBytes),
          used: mib(review.usedBytes),
          limit: mib(review.limitBytes),
          status: t(
            review.enoughManagedSpace
              ? 'interface:creator.readyToInstall'
              : 'interface:creator.storageFullDownload',
          ),
        }),
      );
    } catch (error) {
      localizedText(
        $('storage-review'),
        localizedMessage('interface:creator.installStorageUnavailable', {
          error: error.message,
        }),
      );
    }
    status(localizedMessage('interface:creator.approvedInstallOrDownload'));
  });
$('install').onclick = () =>
  operation(async (signal) => {
    await installPreparedCreatorBundle(store, prepared, approval, installReview, { signal });
    $('play').href = `./player.html?edition=${prepared.editionId}`;
    $('play').hidden = false;
    installReview = null;
    status(localizedMessage('interface:creator.campaignInstalled'));
    await listInstalled();
  });
$('download').onclick = () => {
  try {
    downloadCreatorFile(exportCreatorBundle(prepared, approval), `${content.project.id}.rlpack`);
  } catch (error) {
    fail(error);
  }
};
$('backup').onclick = async () => {
  try {
    downloadCreatorFile(exportCreatorSource(await sourceSnapshot()), `${id}.rlsource`);
  } catch (error) {
    fail(error);
  }
};
$('save').onclick = () => {
  void saveDraft().catch(fail);
};
$('import').onchange = () =>
  operation(async (signal) => {
    const file = $('import').files[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.rlsource')) {
      await openSource(await importCreatorSource(file, { signal }));
      await saveDraft();
    } else await openPrepared(await importCreatorBundle(file, { signal }));
  });
const advancedId = `advanced-${id}`;
$('advanced').onclick = () =>
  operation(async () => {
    await saveDraft();
    const drafts = createContentDraftBackend();
    const checkpoint = await drafts.read(advancedId);
    if (!checkpoint)
      await drafts.save({ ...structuredClone(content.project), id: advancedId }, null);
    location.href = `../studio/?project=${advancedId}&creator-draft=${id}`;
  });
$('load-advanced').onclick = () =>
  operation(async () => {
    const checkpoint = await createContentDraftBackend().read(advancedId);
    if (!checkpoint) throw new Error(t('errors:creator.saveAdvancedCheckpointFirst'));
    requireCreatorEditableProject(checkpoint.project);
    const next = { ...content, project: checkpoint.project };
    // Validate source dependencies before replacing the current editable draft.
    await prepareCreatorSource(
      {
        draftId: id,
        content: next,
        editing: { fit: $('fit').value },
        originalSha256: image?.original?.sha256 ?? draft.source?.document.originalSha256 ?? null,
      },
      currentAssets(),
    );
    content = next;
    invalidate();
    fillLabels();
    await saveDraft();
    status(localizedMessage('interface:creator.studioEditsLoaded'));
  });
window.addEventListener('beforeunload', (event) => {
  if (saveTimer || draft.running || (draft.source && draft.source !== draft.saved)) {
    event.preventDefault();
    event.returnValue = '';
  }
});
window.addEventListener('pagehide', () => {
  controller?.abort();
  batch.destroy();
  mediaReview.destroy();
  if (pictureURL) URL.revokeObjectURL(pictureURL);
  store.close();
});
try {
  const saved = await backend.read(id);
  if (saved) {
    draft.revision = saved.revision;
    await openSource(saved.source);
    draft.saved = draft.source;
    localizedText(
      $('save-status'),
      localizedMessage('interface:creator.restoredCheckpoint', { revision: saved.revision }),
    );
  }
} catch (error) {
  localizedText(
    $('save-status'),
    localizedMessage('interface:creator.draftStorageUnavailable', {
      error: error.message,
    }),
  );
}
controls();
await listInstalled();
busy = false;
$('image').multiple = batchEnabled;
if (batchEnabled) {
  localizedText($('choose-title'), () => t('interface:creator.chooseMediaHeading'));
  localizedText($('intake-help'), () => t('interface:creator.dropMediaHelp'));
  status(localizedMessage('interface:creator.chooseMediaToBegin'));
}
controls();
