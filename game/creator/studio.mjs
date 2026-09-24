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

const $ = (id) => document.getElementById(id),
  store = createCreatorStore(),
  backend = createCreatorDraftBackend(store);
const status = (message, error = false) => {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
};
const fail = (error) =>
  status(
    error.name === 'AbortError'
      ? 'Cancelled. Your current draft is still available.'
      : error.message,
    error.name !== 'AbortError',
  );
const mib = (bytes) => `${(bytes / 1048576).toFixed(2)} MiB`;
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
  sourceVersion = 0,
  saveTimer = null;
const batchSeed = crypto.getRandomValues(new Uint32Array(1))[0];
let themes = [];
try {
  const themesResponse = await fetch('../content-design/themes.json');
  if (themesResponse.ok) themes = (await themesResponse.json()).themes;
} catch {
  status(
    'Presentation themes are unavailable. Reconnect and reload to generate a new level.',
    true,
  );
}
if (!params.has('draft')) {
  params.set('draft', id);
  history.replaceState(null, '', `?${params}`);
}
// Phase 2 integration replaces this null with the batch core's exact-byte
// assembly/approval adapter. Until then, production intake remains single-file
// so the page cannot lead a creator into a flow that cannot finish.
const batchApprovalAdapter = null;
const batchEnabled = !!batchApprovalAdapter;

function controls() {
  $('edits').hidden = !content;
  $('generate').disabled = busy || (!sourceFile && !content);
  $('approve').disabled = busy || !prepared;
  $('install').disabled = busy || !installReview?.enoughManagedSpace;
  $('download').disabled = busy || !approval;
  $('backup').disabled = busy || !content;
  $('save').disabled = busy || !content;
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
    $(key).disabled = busy;
  $('fit').disabled = busy || (!!content && !sourceFile);
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
    const generated = generateCreatorProject({
      id: `${id}-picture-${context.index + 1}`,
      name: context.settings.collectionName,
      seed,
    });
    const itemContent = {
      project: structuredClone(generated.project),
      packId: 'collection',
      themes: themes.filter(
        (theme) => theme.id === generated.project.missions[0].presentation.themeId,
      ),
      provenance: generated.provenance,
      credits: {
        creator: context.settings.creatorCredit,
        picture: context.settings.pictureCredit,
        license: context.settings.license,
      },
    };
    itemContent.project.assets = [structuredClone(preparedImage.asset)];
    itemContent.project.missions[0].name = item.title;
    itemContent.project.missions[0].presentation.backgroundAssetId = preparedImage.asset.id;
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
      templateLabel: `${generated.provenance.templateId} · ${generated.provenance.variantId} · verified Solo route evidence`,
    };
  },
  approveBatch: batchApprovalAdapter?.approve,
  onSplit: (chunks) => {
    $('batch-capacity').textContent =
      `Suggested ${chunks.length} packs: ${chunks.map((chunk, index) => `part ${index + 1} (${chunk.length})`).join(', ')}. The batch compiler will preserve this reviewed grouping during export.`;
  },
});
function invalidate() {
  prepared = approval = installReview = null;
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
  $('name').value = content.project.name;
  $('mission-title').value = content.project.missions[0].name;
  $('description').value = content.project.assets[0]?.alt ?? 'My reveal picture';
  $('creator-credit').value = content.credits.creator;
  $('picture-credit').value = content.credits.picture;
  $('license').value = content.credits.license;
}
function currentAssets() {
  const all = [
    ...(image
      ? [image.runtime]
      : (draft.source?.assets.filter((a) =>
          content.project.assets.some((pin) => pin.sha256 === a.sha256),
        ) ?? [])),
  ];
  if (image?.original) all.push(image.original);
  else if (draft.source?.document.originalSha256)
    all.push(draft.source.assets.find((a) => a.sha256 === draft.source.document.originalSha256));
  return [...new Map(all.map((a) => [a.sha256, { sha256: a.sha256, blob: a.blob }])).values()];
}
async function sourceSnapshot() {
  return prepareCreatorSource(
    {
      draftId: id,
      content: structuredClone(content),
      editing: { fit: $('fit').value },
      originalSha256: image?.original?.sha256 ?? draft.source?.document.originalSha256 ?? null,
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
      $('save-status').textContent = `Saved locally · checkpoint ${draft.revision}.`;
    } catch (error) {
      $('save-status').textContent =
        `Session only: ${error.message} Your source backup remains downloadable.`;
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
  if (pictureURL) URL.revokeObjectURL(pictureURL);
  pictureURL = URL.createObjectURL(pack.assets[0].blob);
  $('picture').src = pictureURL;
  $('picture').alt = pack.review.picture.alt;
  const project = pack.manifest.content.project;
  const provenance = pack.manifest.content.provenance;
  const mission = project.missions[0];
  $('picture-caption').textContent = mission.name;
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
  $('map-caption').textContent =
    `${template?.name ?? 'Verified crossing'} · 72 × 36 cells · Solo · ${enemies} ${enemies === 1 ? 'enemy' : 'enemies'} · ${walls} wall${walls === 1 ? '' : 's'} · ${foundations} safe island${foundations === 1 ? '' : 's'} · ${terrain} terrain zone${terrain === 1 ? '' : 's'} · verified completion route.`;
  $('validation').textContent = pack.review.validation;
  $('package-size').textContent =
    `${mib(pack.bytes)} portable pack. Includes one PNG derivative. Source originals and player progress are excluded.`;
  $('review').hidden = false;
}
async function generate(signal) {
  invalidate();
  status('Preparing your picture and verifying the generated route…');
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
  status(
    'Your level is ready for review. Check the picture, title, map and credits before approving.',
  );
}
function choose(file) {
  if (!file) return;
  sourceFile = file;
  invalidate();
  $('mission-title').value = file.name.replace(/\.[^.]+$/, '').slice(0, 160) || 'First picture';
  $('fit').disabled = false;
  status(`${file.name} selected. Generate to prepare its picture and level.`);
}

function chooseFiles(files) {
  const selected = [...files];
  if (!selected.length) return;
  if (selected.length > 1 && !batchEnabled)
    return status(
      'This build supports one picture at a time. Batch review will appear when campaign assembly is available.',
      true,
    );
  if (selected.length === 1) {
    batch.setFiles([]);
    $('batch-options').hidden = true;
    choose(selected[0]);
    return;
  }
  controller?.abort();
  sourceFile = image = content = prepared = approval = installReview = null;
  $('review').hidden = true;
  $('approved').hidden = true;
  $('edits').hidden = true;
  $('play').hidden = true;
  $('batch-options').hidden = false;
  const selectedBatch = batch.setFiles(selected);
  status(
    `${selectedBatch.items.length} pictures selected in natural filename order. Review the order, then generate the included levels.`,
  );
  controls();
}
async function openPrepared(pack) {
  const { compatibility: _compatibility, ...selected } = pack.manifest.content;
  content = structuredClone(selected);
  sourceFile = image = null;
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
  status(
    'Pack verified. Review this exact picture and level before installing. Select a new source picture to change fitting.',
  );
}
async function openSource(source) {
  content = structuredClone(source.document.content);
  draft.source = source;
  image = null;
  sourceFile = source.assets.find((a) => a.sha256 === source.document.originalSha256)?.blob ?? null;
  $('fit').value = source.document.editing.fit;
  $('fit').disabled = !sourceFile;
  fillLabels();
  invalidate();
  status('Source draft restored. Generate and review again before approving.');
}
async function listInstalled() {
  const list = $('installed-list');
  list.replaceChildren();
  try {
    const manifests = await installedCreatorManifests(store);
    if (!manifests.length) list.textContent = 'No creator campaigns installed yet.';
    for (const manifest of manifests) {
      const row = document.createElement('div');
      row.className = 'installed-item';
      const title = document.createElement('h3');
      title.textContent = manifest.content.project.name;
      const edition = document.createElement('p');
      edition.className = 'muted';
      edition.textContent = `Edition ${manifest.editionId.slice(0, 12)} · one Solo mission`;
      const play = document.createElement('a');
      play.href = `./player.html?edition=${manifest.editionId}`;
      play.textContent = 'Play campaign →';
      const edit = document.createElement('button');
      edit.className = 'secondary';
      edit.textContent = 'Open editable source';
      edit.onclick = () =>
        operation(async (signal) =>
          openPrepared(await loadInstalledCreatorBundle(store, manifest.editionId, { signal })),
        );
      row.append(title, edition, play, document.createTextNode(' '), edit);
      list.append(row);
    }
  } catch (error) {
    list.textContent = `Library unavailable: ${error.message}`;
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
      $('save-status').textContent = 'Saving draft changes…';
      saveTimer = setTimeout(() => {
        void saveDraft().catch(fail);
      }, 500);
    }
    status('Changes are in your draft. Generate and review the updated level before approving.');
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
      $('storage-review').textContent =
        `Pack: ${mib(installReview.packageBytes)}. Required staging space: ${mib(installReview.stagingBytes)}. Managed storage: ${mib(installReview.usedBytes)} of ${mib(installReview.limitBytes)}. ${installReview.enoughManagedSpace ? 'Ready to install.' : 'Download the pack to keep your work; storage is full.'}`;
    } catch (error) {
      $('storage-review').textContent =
        `Installation storage is unavailable: ${error.message} You can still download your pack.`;
    }
    status('Approved. Install locally or download the portable pack.');
  });
$('install').onclick = () =>
  operation(async (signal) => {
    await installPreparedCreatorBundle(store, prepared, approval, installReview, { signal });
    $('play').href = `./player.html?edition=${prepared.editionId}`;
    $('play').hidden = false;
    installReview = null;
    status('Campaign installed. Open it to play and earn your picture.');
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
    if (!checkpoint) throw new Error('Save a checkpoint in Advanced Studio first.');
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
    status(
      'Studio edits loaded into this draft. Generate to verify them; changed gameplay may need regeneration.',
    );
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
  if (pictureURL) URL.revokeObjectURL(pictureURL);
  store.close();
});
try {
  const saved = await backend.read(id);
  if (saved) {
    draft.revision = saved.revision;
    await openSource(saved.source);
    draft.saved = draft.source;
    $('save-status').textContent = `Restored local checkpoint ${saved.revision}.`;
  }
} catch (error) {
  $('save-status').textContent =
    `Draft storage unavailable: ${error.message} Creation and downloadable backups remain available.`;
}
controls();
await listInstalled();
busy = false;
$('image').multiple = batchEnabled;
if (batchEnabled) {
  $('choose-title').textContent = '1. Choose your pictures';
  $('intake-help').textContent =
    'Or drop pictures here. Each can be up to 4 MiB and 16 megapixels. Files start in natural filename order; you can rearrange them before approval.';
  status('Choose one or more PNG, JPEG or WebP pictures to begin.');
}
controls();
