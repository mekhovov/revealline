import { t, localizedText, localizedMessage } from '../../game/i18n/index.mjs';
import { createStudioDownload } from './download.mjs';
import { isTeamPreviewScenarioAvailable } from './team-preview-fixture.mjs';
import {
  addTeamPresentationSlots,
  needsTeamPresentationSlots,
} from '../../game/presentation/team-anchor-upgrade.mjs';
globalThis.RevealLineToolLaunch?.attached();
import { createDefaultThemeBundle } from '../../game/presentation/catalog.mjs';
import {
  FORMATS,
  LIMITS,
  resolvePresentation,
  validateThemeBundle,
  presentationCoverage,
  presentationGeometryControls,
} from '../../game/presentation/model.mjs';
import {
  hashPresentationBytes,
  verifyThemeAssets,
  exportThemeBundle,
  importThemeBundle,
} from '../../game/presentation/bundle.mjs';
import {
  reviseStudioTheme,
  replaceStudioCollection,
  adoptStudioBundle,
  generateAssetPrompt,
  nextAssetRevision,
  studioSlotHistory,
} from '../../game/presentation/studio-session.mjs';
import { createStudioStore } from '../../game/presentation/studio-store.mjs';
import { loadPublishedStudio } from '../../game/presentation/published-studio.mjs';
import { inspectImageDataUrl } from '../../game/content.mjs';
import { centerCrop, checkedCrop, pixelBounds, matchingSlots } from './helpers.mjs';
import { drawAssetPreview } from './preview.mjs';
import { mountSpritePanel } from './sprite-panel.mjs';
import { createStudioOperations } from './operation.mjs';
import { createOperationStatus } from '../../game/ui/operation-status.mjs';
import { createAudioMaster } from '../../game/ui/audio-master.mjs';
import { createAudioPreferences } from '../../game/audio-preferences.mjs';
import { attachPreferenceRestoration } from '../../game/ui/preference-restoration.mjs';
import { mountInterfacePreferences } from './interface-preferences.mjs';
import { mountStudioGuide } from './guide.mjs';
import { attachStudioAuditionLifecycle } from './audition-lifecycle.mjs';
import { createStudioViewMemory, resolveStudioView } from './view-memory.mjs';
const $ = (id) => document.getElementById(id);
const node = (tag, value = '', className = '', hostRole = null) => {
  const el = document.createElement(tag);
  localizedText(el, () =>value);
  el.className = className;
  if (hostRole) el.dataset.studioHost = hostRole;
  return el;
};
const ref = (asset) => ({ id: asset.id, revision: asset.revision });
const store = createStudioStore();
let working = { document: createDefaultThemeBundle(), assets: new Map() },
  saved = working,
  generation = 0,
  storageReady = false;
let selected = working.document.slots[0].id,
  pending = null,
  undo = [],
  redo = [],
  promptAction = 'variation';
const collectionSlots = new Set();
const viewMemory = createStudioViewMemory(() => window.history);
const pendingViewRestore = viewMemory.read();
let initialWorkspaceLoad = true,
  restoredView = false;
function rememberView() {
  if (!initialWorkspaceLoad) viewMemory.write(selected, filters());
}
function restoreView() {
  if (!initialWorkspaceLoad || !pendingViewRestore) return;
  const view = resolveStudioView(
    pendingViewRestore,
    working.document.slots.map((slot) => slot.id),
    Object.fromEntries(
      ['screen', 'state', 'kind', 'quality'].map((key) => [
        key,
        [...$(`filter-${key}`).querySelectorAll('option')].map((option) => option.value),
      ]),
    ),
  );
  if (!view) return;
  if (view.selected) selected = view.selected;
  for (const [key, value] of Object.entries(view.filters))
    $(key === 'query' ? 'filter-search' : `filter-${key}`).value = value;
  restoredView = !!view.selected;
}
let previewGeneration = 0;
const currentSlot = () => working.document.slots.find((slot) => slot.id === selected);
const resolved = () => resolvePresentation(working.document);
// Static controls stay disabled until this host owns their handlers and lock.
document.querySelectorAll('[data-studio-startup-disabled]').forEach((control) => {
  control.disabled = false;
  control.removeAttribute('data-studio-startup-disabled');
});
let operationFocus = null;
const operations = createStudioOperations({
  target: $('studio-status'),
  cancelButton: $('cancel-studio-operation'),
  setBusy(value) {
    if (value) operationFocus = document.activeElement;
    // Escape and preview observation controls stay outside these mutation regions.
    document
      .querySelectorAll(
        '.workspace-actions,.workspace-state,.inventory,#replacement-panel,#sprite-panel,#token-form,#asset-history,#review-panel',
      )
      .forEach((el) => {
        el.inert = value;
        el.setAttribute('aria-busy', String(value));
      });
    // A successful Stage consumes its prepared draft and disables its opener.
    // Preserve the ordinary return owner on errors; only a consumed Stage
    // advances to the next available authoring action.
    const returnTarget =
      operationFocus === $('stage-asset') && operationFocus.disabled
        ? $('save-workspace')
        : operationFocus;
    if (
      !value &&
      document.hasFocus() &&
      [document.body, $('cancel-studio-operation')].includes(document.activeElement) &&
      returnTarget?.isConnected &&
      !returnTarget.disabled
    )
      returnTarget.focus();
  },
});
const status = (message, kind = '') => operations.message(message, kind);
const report = (error) => status(error.message || String(error), 'error');
const interfacePreferences = mountInterfacePreferences({
  document,
  window,
  getStorage: () => localStorage,
});
const studioGuide = mountStudioGuide({ document });
const audioMaster = createAudioMaster();
const audioPreferences = createAudioPreferences({
  audioMaster,
  window,
  getStorage: () => localStorage,
  onWarning: (message) => {
    localizedText($('studio-audio-status'), () =>message);
  },
});
const renderMasterPreferences = ({ muted, volume }) => {
  localizedText($('studio-audio-mute'), () =>muted ? t("tools:unmuteSound") : t("tools:muteSound"));
  $('studio-master-volume').value = volume;
};
const stopMasterView = audioMaster.subscribe(renderMasterPreferences);
const audioRestoration = attachPreferenceRestoration({
  window,
  getSnapshot: () => audioMaster.snapshot(),
  render: renderMasterPreferences,
});
$('studio-audio-mute').onclick = () => audioPreferences.setMuted(!audioMaster.snapshot().muted);
$('studio-master-volume').onchange = () =>
  audioPreferences.setVolume(Number($('studio-master-volume').value));
const auditionLifecycle = attachStudioAuditionLifecycle({
  document,
  isAudition: () => currentSlot()?.group === 'audio',
  stop: () => {
    previewGeneration++;
    for (const id of ['current-preview', 'draft-preview']) $(id).previewCleanup?.();
  },
  restore: () => void refreshPreviews(),
});
const operation = (label, fn) => operations.run(label, fn);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && operations.cancel()) event.preventDefault();
});
function requireSettled(allowPixels = false) {
  if (!allowPixels && sprite.hasEdits())
    throw new Error(
      t("tools:prepareTheEditedSpriteOrDiscardPixelEditsBeforeChanging"),
    );
  if (pending)
    throw new Error(
      t("tools:validateAndStageThePreparedSlotOrDiscardItBefore"),
    );
}
function stage(
  document,
  assets = working.assets,
  message = t("tools:changeStagedSaveALocalRevisionOrExportToKeep"),
) {
  undo.push(working);
  if (undo.length > 40) undo.shift();
  redo = [];
  working = { document, assets };
  refresh();
  status(message, 'success');
}
function discardPreparation() {
  pending?.bitmap?.close();
  pending = null;
  $('asset-upload').value = '';
  localizedText($('upload-summary'), () =>t("tools:noReplacementSelected"));
  $('image-preparation').hidden = true;
  $('geometry-panel').hidden = true;
  $('stage-asset').disabled = true;
  $('discard-asset').disabled = true;
}
function selectSlot(id) {
  requireSettled();
  selected = id;
  sprite.reset();
  refresh();
  rememberView();
}
function filters() {
  return {
    query: $('filter-search').value,
    screen: $('filter-screen').value,
    state: $('filter-state').value,
    kind: $('filter-kind').value,
    quality: $('filter-quality').value,
  };
}
function refreshInventory() {
  const view = resolved(),
    rows = matchingSlots(working.document.slots, view, filters());
  localizedText($('slot-count'), () =>`${rows.length} / ${working.document.slots.length}`);
  const coverage = presentationCoverage(working.document);
  localizedText($('coverage-summary'), () =>`${coverage.counts.missing} missing · ${coverage.counts.source} source · ${coverage.counts.produced} produced · ${coverage.counts.reviewed} reviewed. Readiness is evidence based.`);
  const list = document.createDocumentFragment();
  for (const slot of rows) {
    const asset = view.assets[slot.id],
      stage = asset?.quality.stage || 'missing';
    const row = node('div', '', `asset-row${slot.id === selected ? ' selected' : ''}`);
    row.setAttribute('role', 'listitem');
    const check = document.createElement('input');
    check.dataset.studioHost = 'control';
    check.type = 'checkbox';
    check.checked = collectionSlots.has(slot.id);
    check.setAttribute('aria-label', `Include ${slot.label} in collection`);
    check.onchange = () => {
      check.checked ? collectionSlots.add(slot.id) : collectionSlots.delete(slot.id);
      updateCollectionCount();
      refreshPrompt();
    };
    const button = node('button', '', '', 'control');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(slot.id === selected));
    button.append(
      node('strong', slot.label, '', 'control'),
      node('small', `${slot.id} · ${stage}`, `stage-${stage}`, 'secondary'),
    );
    button.onclick = () => {
      const restoreFocus = document.hasFocus() && document.activeElement === button;
      try {
        selectSlot(slot.id);
        if (document.hasFocus()) {
          if (matchMedia('(max-width: 700px)').matches) $('inspector').focus();
          else if (restoreFocus)
            $('asset-list').querySelector('button[aria-pressed="true"]')?.focus();
        }
      } catch (error) {
        report(error);
      }
    };
    row.append(check, button);
    list.append(row);
  }
  $('asset-list').replaceChildren(list);
  $('empty-inventory').hidden = rows.length !== 0;
}
function updateCollectionCount() {
  localizedText($('collection-count'), () =>`${collectionSlots.size} slots selected`);
}
function refresh() {
  if (!working.document.slots.some((slot) => slot.id === selected))
    selected = working.document.slots[0].id;
  $('add-team-anchors').disabled = !needsTeamPresentationSlots(working.document);
  const view = resolved();
  const themes = [...new Map(working.document.themes.map((theme) => [theme.id, theme])).values()];
  $('filter-theme').replaceChildren(
    ...themes.map((theme) => {
      const option = node('option', theme.name);
      option.value = theme.id;
      return option;
    }),
  );
  $('filter-theme').value = view.theme.id;
  localizedText($('workspace-summary'), () =>`Theme ${view.theme.name} · document r${working.document.revision} · local save ${generation || 'none'}${working !== saved ? ' · unsaved changes' : ''}${view.collection ? ` · ${view.collection.id}` : ''}`);
  $('undo-draft').disabled = !undo.length;
  $('redo-draft').disabled = !redo.length;
  $('reset-draft').disabled = working === saved;
  refreshInventory();
  refreshInspector();
  refreshTokens();
  updateCollectionCount();
}
function refreshInspector() {
  const slot = currentSlot(),
    view = resolved(),
    asset = view.assets[slot.id];
  localizedText($('slot-id'), () =>slot.id);
  localizedText($('slot-title'), () =>slot.label);
  localizedText($('slot-quality'), () =>asset?.quality.stage || 'missing');
  const priorState = $('preview-state').value;
  $('preview-state').replaceChildren(
    ...slot.states.map((state) => {
      const option = node('option', state);
      option.value = state;
      return option;
    }),
  );
  if (slot.states.includes(priorState)) $('preview-state').value = priorState;
  localizedText($('slot-description'), () =>asset?.description || t("tools:noAssetBoundToThisSlot"));
  const facts = [
    [
      t("tools:frame"),
      slot.dimensions
        ? `${slot.dimensions.width} × ${slot.dimensions.height} px`
        : t("tools:scalableMedia"),
    ],
    [t("tools:accepted"), slot.kinds.join(', ')],
    [t("tools:budget"), `${Math.round(slot.budget.maxBytes / 1024)} KiB`],
    [t("tools:alpha"), slot.alpha],
    [t("tools:sampling"), slot.sampling],
    [t("tools:required"), slot.required ? t("tools:yes") : t("tools:optionalThemeOwner")],
  ];
  $('slot-facts').replaceChildren(
    ...facts.map(([key, value]) => {
      const wrapper = node('div');
      wrapper.append(node('dt', key, '', 'secondary'), node('dd', value, '', 'secondary'));
      return wrapper;
    }),
  );
  $('slot-usage').replaceChildren(
    ...slot.screens.map((screen) => node('span', screen, '', 'secondary')),
    ...slot.states.map((state) => node('span', `:${state}`, '', 'secondary')),
  );
  $('slot-requirements').replaceChildren(
    ...slot.requirements.map((requirement) => node('li', requirement, '', 'body')),
  );
  localizedText($('slot-contract'), () =>JSON.stringify(
    { ...slot, currentAsset: asset ? `${asset.id}@${asset.revision}` : null },
    null,
    2,
  ));
  const editable =
    slot.kinds.includes('image') &&
    slot.dimensions &&
    Math.max(slot.dimensions.width, slot.dimensions.height) <= 128;
  $('new-sprite').disabled = !editable;
  $('edit-current').disabled = !editable || asset?.kind !== 'image';
  $('edit-geometry').disabled = asset?.kind !== 'image';
  $('asset-upload').accept = slot.kinds
    .flatMap((kind) =>
      kind === 'image'
        ? ['image/png', 'image/jpeg', 'image/webp']
        : kind === 'font'
          ? ['.woff2', '.ttf', '.otf']
          : kind === 'audio'
            ? ['audio/wav', 'audio/ogg', 'audio/mpeg']
            : [],
    )
    .join(',');
  $('asset-upload').disabled = !slot.kinds.some((kind) =>
    ['image', 'audio', 'font'].includes(kind),
  );
  if (!pending) {
    $('asset-description').value = slot.label;
    $('asset-creator').value = '';
    $('asset-source').value = '';
    $('asset-license').value = '';
    $('asset-prompt').value = '';
  }
  sprite.setPalette(slot.palette);
  refreshPrompt();
  refreshHistory();
  refreshPreviews();
}
async function refreshPreviews() {
  const fieldContext = $('preview-mode').value === 'context',
    teamContext = fieldContext && $('preview-field-mode').value === 'team';
  $('preview-field-mode').disabled = !fieldContext;
  $('preview-team-arena').disabled = !teamContext;
  $('preview-team-scenario').disabled = !teamContext;
  const arena = $('preview-team-arena').value,
    scenario = $('preview-team-scenario');
  for (const option of scenario.options)
    option.disabled = !isTeamPreviewScenarioAvailable(arena, option.value);
  if (!isTeamPreviewScenarioAvailable(arena, scenario.value)) scenario.value = 'initial';
  const requestedPreview = ++previewGeneration;
  const slot = currentSlot(),
    current = resolvePresentation(saved.document),
    view = resolved();
  const candidate = pending?.candidate || view.assets[slot.id],
    map = new Map(working.assets);
  if (pending?.candidateBlob) map.set(candidate.file.sha256, pending.candidateBlob);
  const options = {
    audioMaster,
    motionPreferences: interfacePreferences.motion,
    mode: $('preview-mode').value,
    fieldMode: $('preview-field-mode').value,
    teamArena: $('preview-team-arena').value,
    teamScenario: $('preview-team-scenario').value,
    background: $('preview-background').value,
    geometry: $('preview-geometry').checked,
    motion: $('preview-motion').value,
    state: $('preview-state').value,
  };
  await Promise.allSettled(
    [
      ['current', current.assets[slot.id], current, saved.assets],
      ['draft', candidate, view, map],
    ].map(([id, asset, presentation, bytes]) =>
      drawAssetPreview($(`${id}-preview`), slot, asset, presentation, bytes, {
        ...options,
        statusTarget: $(`${id}-preview-status`),
        cancelButton: $(`${id}-preview-cancel`),
        label: id === 'current' ? t("tools:savedPreview") : t("tools:draftPreview"),
        isCurrent: () => requestedPreview === previewGeneration,
      }),
    ),
  );
}

function refreshPrompt() {
  const view = resolved(),
    slot = currentSlot();
  if (!view.assets[slot.id]) {
    $('generated-prompt').value = slot.prompt;
    return;
  }
  let prompt = generateAssetPrompt(slot, view, promptAction);
  if (promptAction === 'collection') {
    const ids = collectionSlots.size ? [...collectionSlots] : [slot.id, ...slot.dependencies];
    prompt +=
      `\n\nATOMIC COLLECTION MEMBERS (${ids.length}):\n` +
      ids
        .map((id) => {
          const item = working.document.slots.find((s) => s.id === id);
          const current = view.assets[id];
          return JSON.stringify({
            id: item.id,
            dimensions: item.dimensions,
            geometry: current?.geometry ?? item.geometry,
            currentRevision: current ? ref(current) : null,
            currentProductionBrief: current?.provenance.prompt ?? item.prompt,
            requirements: item.requirements,
            budget: item.budget,
          });
        })
        .join('\n');
  }
  $('generated-prompt').value = prompt;
}
function refreshHistory() {
  const asset = resolved().assets[selected],
    history = studioSlotHistory(working.document, selected);
  $('asset-history').replaceChildren(
    ...history.map(({ asset: item, bindable }) => {
      const row = node('div', '', 'history-row'),
        copy = node('div');
      copy.append(
        node('strong', `${item.id}@${item.revision}`, '', 'technical'),
        node(
          'p',
          `${item.kind} · ${item.quality.stage} · ${item.provenance.creator} · ${item.provenance.license}`,
          '',
          'secondary',
        ),
      );
      row.append(copy);
      if (item.file) {
        const downloadButton = node('button', localizedMessage("tools:downloadFile"), '', 'control');
        downloadButton.type = 'button';
        downloadButton.onclick = () =>
          download(
            working.assets.get(item.file.sha256),
            `${item.id}-${item.revision}.${extension(item.file.mime)}`,
          );
        row.append(downloadButton);
      }
      if (!bindable) {
        row.append(
          node('p', localizedMessage("tools:sourceOriginalPrepareItBeforeBindingToThisSlot"), '', 'secondary'),
        );
        return row;
      }
      const button = node('button', localizedMessage("tools:bindThisRevision"), '', 'control');
      button.type = 'button';
      button.disabled = item.id === asset?.id && item.revision === asset?.revision;
      button.onclick = () =>
        operation(t("tools:preparingWorkspaceChange"), () => {
          requireSettled();
          stage(
            reviseStudioTheme(working.document, { bindings: { [selected]: ref(item) } }),
            working.assets,
            t("tools:earlierAssetBoundInANewImmutableThemeRevision"),
          );
        });
      row.append(button);
      return row;
    }),
  );
}
const numberRanges = {
  textSize: [16, 32, 1],
  displaySize: [32, 96, 1],
  spaceUnit: [2, 8, 1],
  borderWidth: [1, 4, 1],
  cornerSize: [0, 16, 1],
  motionScale: [0, 1, 0.1],
};
function refreshTokens() {
  $('token-fields').replaceChildren(
    ...Object.entries(resolved().tokens).map(([key, value]) => {
      const label = node('label', key, '', 'control'),
        input = document.createElement('input');
      input.dataset.studioHost = 'control';
      input.name = key;
      input.value = value;
      if (typeof value === 'number') {
        input.type = 'number';
        const range = numberRanges[key];
        [input.min, input.max, input.step] = range;
      } else input.type = /^#[a-f0-9]{6}$/i.test(value) ? 'color' : 'text';
      label.append(input);
      return label;
    }),
  );
}
function extension(mime) {
  return (
    {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'font/woff2': 'woff2',
      'font/ttf': 'ttf',
      'font/otf': 'otf',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
    }[mime] || 'bin'
  );
}
function fileMime(file) {
  const ext = file.name?.split('.').pop().toLowerCase();
  return (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      otf: 'font/otf',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
      mp3: 'audio/mpeg',
    }[ext] || file.type
  );
}
const preparedDownload = createStudioDownload({ document, target: $('prepared-download') });
function download(blob, filename) {
  if (!blob) {
    report(new Error(t("tools:fileBytesAreUnavailable")));
    return;
  }
  preparedDownload.offer(blob, filename);
}
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) preparedDownload.dispose();
});

async function fileMetadata(blob, dimensions, task) {
  task.update(t("tools:readingAssetBytesForVerification"), 'reading');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  task.update(t("tools:hashingTheOriginalAssetBytes"), 'verifying');
  const sha256 = await hashPresentationBytes(bytes);
  task.check();
  return {
    sha256,
    bytes: blob.size,
    mime: blob.type,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
}
async function decodeImage(blob, task) {
  task.update(t("tools:readingTheImageHeader"), 'reading');
  const dataURL = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => task.signal.removeEventListener('abort', cancel);
    const cancel = () => {
      reader.abort();
      cleanup();
      reject(new DOMException(t("tools:imageReadCancelled"), 'AbortError'));
    };
    reader.onload = () => {
      cleanup();
      resolve(reader.result);
    };
    reader.onerror = () => {
      cleanup();
      reject(reader.error);
    };
    task.signal.addEventListener('abort', cancel, { once: true });
    reader.readAsDataURL(blob);
  });
  task.update(t("tools:validatingImageDimensions"), 'verifying');
  const info = inspectImageDataUrl(dataURL);
  if (!info.valid) throw new Error(info.errors.join(' '));
  if (
    info.width > LIMITS.imageSide ||
    info.height > LIMITS.imageSide ||
    info.width * info.height > LIMITS.imagePixels
  )
    throw new Error(
      `Studio images must fit ${LIMITS.imageSide} px per side and ${LIMITS.imagePixels.toLocaleString()} total pixels. Resize externally, retaining your original.`,
    );
  task.update(t("tools:decodingTheOriginalImage"), 'decoding');
  const bitmap = await createImageBitmap(blob);
  try {
    task.check();
    if (bitmap.width !== info.width || bitmap.height !== info.height)
      throw new Error(t("tools:decodedImageDimensionsDoNotMatchItsHeader"));
    return bitmap;
  } catch (error) {
    bitmap.close();
    throw error;
  }
}
function imageGeometry(canvas, slot = null) {
  const measured = pixelBounds(
    canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height),
  );
  return {
    frame: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    pivot: { x: 0.5, y: 0.5 },
    occupiedBounds: measured.occupiedBounds,
    rotorAnchors: structuredClone(slot?.geometry?.rotorAnchors || []),
    nineSlice: structuredClone(slot?.geometry?.nineSlice || null),
  };
}
function imageCanvas(bitmap) {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return canvas;
}
async function startUpload(file, fromSprite = false, task) {
  requireSettled(fromSprite);
  const slot = currentSlot(),
    mime = fileMime(file),
    kind = mime.split('/')[0];
  if (!slot.kinds.includes(kind))
    throw new Error(`This slot accepts ${slot.kinds.join(', ')}. Choose an appropriate file.`);
  if (file.size > LIMITS.assetBytes)
    throw new Error(t("tools:theOriginalExceedsThe4MibAssetBudget"));
  const blob = new Blob([file], { type: mime });
  const revision = nextAssetRevision(working.document, slot.id);
  const record = {
    format: FORMATS.asset,
    ...revision,
    kind,
    description: slot.label,
    provenance: {
      creator: t("tools:pendingCreator"),
      source: file.name || 'Local pixel editor',
      license: t("tools:pendingRightsDeclaration"),
      prompt: '',
      parent: null,
    },
    file: null,
    recipe: null,
    geometry: null,
    quality: { stage: 'produced', evidence: [] },
  };
  let bitmap = null;
  let adopted = false;
  try {
    bitmap = kind === 'image' ? await decodeImage(blob, task) : null;
    record.file = await fileMetadata(blob, bitmap, task);
    record.geometry = bitmap ? imageGeometry(imageCanvas(bitmap)) : null;
    const original = bitmap
      ? {
          ...structuredClone(record),
          id: `${revision.id}.source`,
          description: `${slot.label} original source`,
        }
      : null;
    const preparation = {
      blob,
      bitmap,
      original,
      candidate: bitmap ? null : record,
      candidateBlob: bitmap ? null : blob,
      template: record,
    };
    const crop = bitmap
      ? centerCrop(bitmap.width, bitmap.height, slot.dimensions.width, slot.dimensions.height)
      : null;
    if (bitmap) Object.assign(preparation, await cropCandidate(preparation, slot, crop, task));
    task.check();
    pending = preparation;
    adopted = true;
    if (fromSprite) sprite.acceptSnapshot();
    $('discard-asset').disabled = false;
    $('asset-source').value = file.name || t("tools:localPixelEditor");
    $('asset-description').value = slot.label;
    localizedText($('upload-summary'), () =>`${file.name || t("tools:localSprite")} · ${Math.ceil(blob.size / 1024)} KiB${bitmap ? ` · ${bitmap.width} × ${bitmap.height} px original` : ''}`);
    $('image-preparation').hidden = !bitmap;
    if (crop) setCrop(crop);
    populateGeometry();
    $('stage-asset').disabled = false;
    refreshPreviews();
    status(
      t("tools:replacementPreparedCheckGeometryAndEnterActualCreatorSourceAnd"),
    );
  } finally {
    if (!adopted) bitmap?.close();
  }
}

function setCrop(crop) {
  for (const [key, value] of Object.entries(crop)) $(`crop-${key}`).value = value;
  drawSource();
}
function getCrop() {
  return checkedCrop(
    Object.fromEntries(
      ['x', 'y', 'width', 'height'].map((key) => [key, Number($(`crop-${key}`).value)]),
    ),
    pending.bitmap.width,
    pending.bitmap.height,
  );
}
function drawSource() {
  if (!pending?.bitmap) return;
  const bitmap = pending.bitmap,
    canvas = $('source-image');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  try {
    const crop = getCrop();
    ctx.strokeStyle = '#f4bf62';
    ctx.lineWidth = Math.max(1, bitmap.width / 300);
    ctx.strokeRect(crop.x, crop.y, crop.width, crop.height);
  } catch {
    /* Keep the source visible while a numeric field is incomplete. */
  }
}
async function cropCandidate(preparation, slot, crop, task) {
  task.update(t("tools:encodingTheCropAtTheSlotFrameSize"), 'encoding');
  const canvas = document.createElement('canvas');
  canvas.width = slot.dimensions.width;
  canvas.height = slot.dimensions.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = slot.sampling !== 'nearest';
  ctx.drawImage(
    preparation.bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  task.check();
  if (!blob) throw new Error(t("tools:theBrowserCouldNotEncodeThisCrop"));
  const asset = structuredClone(preparation.template);
  asset.file = await fileMetadata(blob, canvas, task);
  asset.geometry = imageGeometry(canvas, slot);
  asset.provenance.parent = ref(preparation.original);
  return { candidate: asset, candidateBlob: blob, preparedCrop: { ...crop } };
}
async function prepareCrop(task) {
  if (!pending?.bitmap) throw new Error(t("tools:chooseAnImageFirst"));
  const preparation = pending;
  const candidate = await cropCandidate(preparation, currentSlot(), getCrop(), task);
  task.check();
  Object.assign(preparation, candidate);
  populateGeometry();
  $('stage-asset').disabled = false;
  drawSource();
  refreshPreviews();
  status(
    t("tools:derivativePreparedCheckGeometryAndEnterActualCreatorSourceAnd"),
  );
}

function populateGeometry() {
  const geometry = pending?.candidate?.geometry;
  $('geometry-panel').hidden = !geometry;
  if (!geometry) return;
  const controls = presentationGeometryControls(currentSlot());
  $('pivot-x').disabled = $('pivot-y').disabled = !controls.pivot;
  $('rotor-anchors').disabled = !controls.rotors;
  $('nine-slice').disabled = !controls.nineSlice;
  localizedText($('geometry-usage'), () =>controls.pivot
    ? t("tools:thePivotPlacesThisArtworkAroundItsUnchangedGameplayCenter")
    : t("tools:thisInterfaceOrPictureSlotUsesCenteredPlacementCropThe"));
  $('pivot-x').value = geometry.pivot.x;
  $('pivot-y').value = geometry.pivot.y;
  $('rotor-anchors').value = JSON.stringify(geometry.rotorAnchors, null, 2);
  $('nine-slice').value = JSON.stringify(geometry.nineSlice);
}
function editedGeometry() {
  const current = pending.candidate.geometry;
  return {
    ...structuredClone(current),
    pivot: { x: Number($('pivot-x').value), y: Number($('pivot-y').value) },
    rotorAnchors: JSON.parse($('rotor-anchors').value),
    nineSlice: JSON.parse($('nine-slice').value),
  };
}
async function validatePending(geometryOnly = false, task) {
  if (!pending?.candidate) throw new Error(t("tools:prepareAnImageCropOrChooseMediaFirst"));
  if (pending.bitmap) {
    const crop = getCrop();
    if (Object.keys(crop).some((key) => crop[key] !== pending.preparedCrop?.[key]))
      throw new Error(
        t("tools:theCropHasChangedPrepareDerivativeBeforeApplyingGeometryOr"),
      );
  }
  const asset = structuredClone(pending.candidate);
  if (asset.geometry) asset.geometry = editedGeometry();
  if (!geometryOnly) {
    for (const id of ['asset-creator', 'asset-source', 'asset-license'])
      if (!$(id).value.trim()) {
        $(id).focus();
        throw new Error(t("tools:enterTheActualCreatorSourceAndLicenseRightsStatement"));
      }
    asset.description = $('asset-description').value.trim() || currentSlot().label;
    asset.provenance = {
      ...asset.provenance,
      creator: $('asset-creator').value.trim(),
      source: $('asset-source').value.trim(),
      license: $('asset-license').value.trim(),
      prompt: $('asset-prompt').value,
    };
  }
  const original = pending.original
    ? { ...structuredClone(pending.original), provenance: { ...asset.provenance, parent: null } }
    : null;
  const assets = original ? [original, asset] : [asset],
    bytes = new Map(working.assets);
  if (original) bytes.set(original.file.sha256, pending.blob);
  bytes.set(asset.file.sha256, pending.candidateBlob);
  const next = reviseStudioTheme(working.document, {
    assets,
    bindings: { [selected]: ref(asset) },
  });
  if (geometryOnly) {
    pending.candidate = asset;
    refreshPreviews();
    status(t("tools:geometryCheckedAndAppliedToTheDraftPreview"));
    return;
  }
  if (asset.kind === 'image') {
    task.update(t("tools:decodingAndCheckingTransparency"), 'decoding');
    const bitmap = await createImageBitmap(pending.candidateBlob),
      frame = asset.geometry.frame,
      canvas = document.createElement('canvas');
    if (task.signal.aborted) {
      bitmap.close();
      task.check();
    }
    task.check();
    canvas.width = frame.width;
    canvas.height = frame.height;
    const context = canvas.getContext('2d');
    context.drawImage(
      bitmap,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height,
    );
    const measured = pixelBounds(context.getImageData(0, 0, frame.width, frame.height));
    bitmap.close();
    if (currentSlot().alpha === 'required' && !measured.transparent)
      throw new Error(t("tools:thisSlotRequiresTransparencyTheCandidateIsFullyOpaque"));
    if (currentSlot().alpha === 'opaque' && measured.transparent)
      throw new Error(t("tools:thisSlotRequiresAFullyOpaqueImage"));
    if (!measured.occupiedBounds)
      throw new Error(t("tools:theCandidateIsEntirelyTransparentPaintOrImportAVisible"));
  }
  if (asset.kind === 'font') {
    task.update(t("tools:readingAndDecodingTheCandidateFont"), 'decoding');
    const fontBytes = await pending.candidateBlob.arrayBuffer();
    task.check();
    await new FontFace(t("tools:rlstudiovalidation"), fontBytes).load();
  }
  task.update(t("tools:verifyingOriginalBytesAndReplacementHistory"), 'verifying');
  const verified = await verifyThemeAssets(next, bytes, { signal: task.signal });
  task.check();
  discardPreparation();
  stage(
    next,
    verified,
    t("tools:replacementValidatedAndStagedTheOriginalSourceAndEarlierRevisions"),
  );
}
const editGeometry = node('button', localizedMessage("tools:editCurrentRasterMetadata"), '', 'control');
editGeometry.type = 'button';
editGeometry.id = 'edit-geometry';
$('asset-upload-label').after(editGeometry);
editGeometry.onclick = () =>
  operation(t("tools:preparingWorkspaceChange"), () => {
    requireSettled();
    const asset = resolved().assets[selected];
    if (asset.kind !== 'image') throw new Error(t("tools:chooseARasterAssetFirst"));
    const candidate = {
      ...structuredClone(asset),
      ...nextAssetRevision(working.document, selected),
      provenance: { ...structuredClone(asset.provenance), parent: ref(asset) },
      quality: { stage: 'produced', evidence: [] },
    };
    pending = {
      candidate,
      candidateBlob: working.assets.get(asset.file.sha256),
      original: null,
      bitmap: null,
    };
    $('asset-description').value = asset.description;
    $('asset-creator').value = asset.provenance.creator;
    $('asset-source').value = asset.provenance.source;
    $('asset-license').value = asset.provenance.license;
    $('asset-prompt').value = asset.provenance.prompt;
    populateGeometry();
    $('discard-asset').disabled = false;
    $('stage-asset').disabled = false;
    localizedText($('upload-summary'), () =>t("tools:editingMetadataExistingBytesRemainUnchanged"));
  });
const sprite = mountSpritePanel({
  onError: report,
  runOperation: operation,
  onPrepare: (blob, task) =>
    startUpload(new File([blob], 'local-sprite.png', { type: 'image/png' }), true, task),
});
const discardPixels = node('button', localizedMessage("tools:discardPixelEdits"), '', 'control');
discardPixels.type = 'button';
$('edit-current').after(discardPixels);
discardPixels.onclick = () => {
  sprite.reset();
  status(t("tools:pixelEditorClearedPreparedAndStagedAssetsAreUnchanged"));
};
$('new-sprite').onclick = () => {
  try {
    requireSettled();
    const { width, height } = currentSlot().dimensions;
    sprite.open(width, height);
  } catch (error) {
    report(error);
  }
};
$('edit-current').onclick = () =>
  operation(t("tools:decodingTheCurrentSprite"), async (task) => {
    requireSettled();
    const asset = resolved().assets[selected],
      bitmap = await createImageBitmap(working.assets.get(asset.file.sha256)),
      frame = asset.geometry.frame;
    if (task.signal.aborted) {
      bitmap.close();
      task.check();
    }
    task.check();
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      bitmap,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height,
    );
    bitmap.close();
    sprite.open(frame.width, frame.height, ctx.getImageData(0, 0, frame.width, frame.height).data);
    status(t("tools:currentRasterLoadedInThePixelEditor"));
  });
$('asset-upload').onchange = () => {
  const file = $('asset-upload').files[0];
  if (file) operation(t("tools:readingReplacementFile"), (task) => startUpload(file, false, task));
};
$('prepare-crop').onclick = () => operation(t("tools:preparingCropDerivative"), prepareCrop);
$('fit-crop').onclick = () => {
  if (pending?.bitmap)
    setCrop(
      centerCrop(
        pending.bitmap.width,
        pending.bitmap.height,
        currentSlot().dimensions.width,
        currentSlot().dimensions.height,
      ),
    );
};
['x', 'y', 'width', 'height'].forEach((key) => ($(`crop-${key}`).oninput = drawSource));
$('download-original').onclick = () =>
  download(pending?.blob, `original-${selected}.${extension(pending?.blob?.type)}`);
$('apply-geometry').onclick = () =>
  operation(t("tools:checkingPreviewGeometry"), (task) => validatePending(true, task));
$('stage-asset').onclick = () =>
  operation(t("tools:validatingReplacement"), (task) => validatePending(false, task));
$('discard-asset').onclick = () => {
  discardPreparation();
  refreshInspector();
  status(t("tools:preparedSlotDiscardedStagedWorkspaceRevisionsAreUnchanged"));
};
$('token-form').onsubmit = (event) => {
  event.preventDefault();
  operation(t("tools:preparingWorkspaceChange"), () => {
    requireSettled();
    const tokens = Object.fromEntries(
      [...new FormData(event.currentTarget)].map(([key, value]) => [
        key,
        key in numberRanges ? Number(value) : value,
      ]),
    );
    stage(reviseStudioTheme(working.document, { tokens }));
  });
};
['filter-search', 'filter-screen', 'filter-state', 'filter-kind', 'filter-quality'].forEach((id) =>
  $(id).addEventListener(id === 'filter-search' ? 'input' : 'change', () => {
    refreshInventory();
    rememberView();
  }),
);
$('filter-theme').onchange = () =>
  operation(t("tools:preparingWorkspaceChange"), () => {
    try {
      requireSettled();
      const previous = working.document,
        next = structuredClone(previous),
        theme = next.themes.filter((t) => t.id === $('filter-theme').value).at(-1);
      next.selection.theme = ref(theme);
      next.selection.collection = null;
      next.revision++;
      stage(validateThemeBundle(next, { previous, expectedRevision: previous.revision }));
    } finally {
      $('filter-theme').value = resolved().theme.id;
    }
  });
[
  'preview-mode',
  'preview-field-mode',
  'preview-team-arena',
  'preview-team-scenario',
  'preview-background',
  'preview-geometry',
  'preview-motion',
  'preview-state',
].forEach((id) => ($(id).onchange = refreshPreviews));
$('select-required').onclick = () => {
  working.document.slots
    .filter((slot) => slot.required)
    .forEach((slot) => collectionSlots.add(slot.id));
  refreshInventory();
  updateCollectionCount();
  refreshPrompt();
};
$('clear-collection').onclick = () => {
  collectionSlots.clear();
  refreshInventory();
  updateCollectionCount();
  refreshPrompt();
};
$('stage-collection').onclick = () =>
  operation(t("tools:preparingWorkspaceChange"), () => {
    requireSettled();
    if (!collectionSlots.size) throw new Error(t("tools:selectAtLeastOneSlotToBuildACollection"));
    const view = resolved(),
      requiredSlots = [...collectionSlots];
    const bindings = Object.fromEntries(
      requiredSlots.map((id) => {
        if (!view.bindings[id]) throw new Error(`Collection has no binding for ${id}.`);
        return [id, view.bindings[id]];
      }),
    );
    stage(
      replaceStudioCollection(working.document, {
        id: $('collection-id').value.trim(),
        name: $('collection-name').value.trim(),
        requiredSlots,
        bindings,
      }),
      working.assets,
      t("tools:collectionStagedAtomicallyEverySelectedSlotHasAValidBinding"),
    );
  });
for (const button of document.querySelectorAll('[data-prompt-action]'))
  button.onclick = () => {
    promptAction = button.dataset.promptAction;
    refreshPrompt();
    copyRequest++;
    const message = `${button.textContent} brief ready.`;
    promptStatus.begin({ message }).finish({ message });
  };
const promptStatus = createOperationStatus($('prompt-status'));
let copyRequest = 0;
$('copy-generated-prompt').onclick = async () => {
  const request = ++copyRequest;
  const button = $('copy-generated-prompt');
  const lease = promptStatus.begin({ message: t("tools:copyingTheCompletePrompt") });
  try {
    await navigator.clipboard.writeText($('generated-prompt').value);
    lease.finish({ message: t("tools:completePromptCopied") });
  } catch {
    if (request !== copyRequest) return;
    if (document.hasFocus() && document.activeElement === button) {
      $('generated-prompt').focus();
      $('generated-prompt').select();
    }
    lease.finish({
      message: t("tools:clipboardUnavailableSelectTheFullPromptAndPressCtrlCmd"),
      state: 'error',
    });
  }
};
$('add-team-anchors').onclick = () =>
  operation(t("tools:addingEditableTeamPresentation"), () => {
    requireSettled();
    stage(
      addTeamPresentationSlots(working.document),
      working.assets,
      t("tools:teamPresentationSlotsAddedToThisDraftChooseCouchTeam"),
    );
  });
$('undo-draft').onclick = () =>
  operation(t("tools:preparingWorkspaceChange"), () => {
    requireSettled();
    if (!undo.length) return;
    redo.push(working);
    working = undo.pop();
    refresh();
    status(t("tools:draftChangeUndoneSavedHistoryIsIntact"));
  });
$('redo-draft').onclick = () =>
  operation(t("tools:preparingWorkspaceChange"), () => {
    requireSettled();
    if (!redo.length) return;
    undo.push(working);
    working = redo.pop();
    refresh();
    status(t("tools:draftChangeRestored"));
  });
$('reset-draft').onclick = () =>
  operation(t("tools:preparingWorkspaceChange"), () => {
    requireSettled();
    working = saved;
    undo = [];
    redo = [];
    sprite.reset();
    refresh();
    status(t("tools:returnedToTheLastSavedWorkspace"));
  });
$('record-review').onclick = () =>
  operation(t("tools:preparingWorkspaceChange"), () => {
    requireSettled();
    const evidence = [
      ...new Set(
        $('review-evidence')
          .value.split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ];
    if (!evidence.length)
      throw new Error(t("tools:recordTheConcreteReviewChecksBeforeMarkingThisAssetReviewed"));
    const current = resolved().assets[selected];
    if (!current) throw new Error(t("tools:bindAnAssetBeforeReviewingIt"));
    const asset = {
      ...structuredClone(current),
      ...nextAssetRevision(working.document, selected),
      provenance: { ...structuredClone(current.provenance), parent: ref(current) },
      quality: { stage: 'reviewed', evidence },
    };
    stage(
      reviseStudioTheme(working.document, {
        assets: [asset],
        bindings: { [selected]: ref(asset) },
      }),
      working.assets,
      t("tools:reviewEvidenceRecordedInANewImmutableRevision"),
    );
    $('review-evidence').value = '';
  });
$('save-workspace').onclick = () =>
  operation(t("tools:preparingALocalRevision"), async (task) => {
    requireSettled();
    if (!storageReady)
      throw new Error(
        t("tools:localStorageHasNotLoadedSuccessfullyExportYourWorkThen"),
      );
    task.commit();
    const result = await store.save(working.document, working.assets, {
      expectedGeneration: generation,
    });
    task.check();
    generation = result.generation;
    working = { document: result.document, assets: result.assets };
    saved = working;
    undo = [];
    redo = [];
    refresh();
    status(t("tools:localRevisionSavedAtomicallyPlayerSavesAreUntouched"), 'success');
  });
$('export-workspace').onclick = () =>
  operation(t("tools:verifyingOriginalBytesForExport"), async (task) => {
    requireSettled();
    const bundle = await exportThemeBundle(working.document, working.assets, {
      signal: task.signal,
    });
    task.check();
    download(bundle, `revealline-${resolved().theme.id}-r${working.document.revision}.rltheme`);
    status(t("tools:themeDownloadRequestedWithAllSourceFilesAndImmutableRevisions"), 'success');
  });
$('import-workspace').onchange = () => {
  const file = $('import-workspace').files[0];
  if (!file) return;
  $('import-workspace').value = '';
  operation(t("tools:readingAndValidatingTheImportedBundle"), async (task) => {
    requireSettled();
    const incoming = await importThemeBundle(file, { signal: task.signal });
    task.update(t("tools:verifyingMergedAssetsAndImmutableRevisions"), 'verifying');
    const next = adoptStudioBundle(working.document, incoming.document),
      merged = new Map([...working.assets, ...incoming.assets]);
    const bytes = await verifyThemeAssets(next, merged, { signal: task.signal });
    task.check();
    stage(
      next,
      bytes,
      t("tools:verifiedCollectionStagedAtomicallyCurrentAndImportedSourceFilesAre"),
    );
  });
};
async function loadWorkspace(task) {
  requireSettled();
  if (working !== saved)
    throw new Error(t("tools:exportOrSaveTheStagedWorkspaceOrResetToSaved"));
  const result = await store.load();
  task.check();
  if (!result) task.update(t("tools:loadingAndVerifyingTheCurrentReleaseCollection"), 'downloading');
  const published = result ? null : await loadPublishedStudio({ signal: task.signal });
  task.check();
  storageReady = true;
  generation = result?.generation || 0;
  working = result
    ? { document: result.document, assets: result.assets }
    : (published ?? { document: createDefaultThemeBundle(), assets: new Map() });
  saved = working;
  undo = [];
  redo = [];
  restoreView();
  if (!working.document.slots.some((slot) => slot.id === selected))
    selected = working.document.slots[0].id;
  sprite.reset();
  refresh();
  status(
    result
      ? t("tools:savedStudioWorkspaceLoaded")
      : published
        ? t("tools:currentReleaseAssetsLoadedChangesStayInThisLocalStudio")
        : t("tools:sourceRegistryLoadedACompiledReleaseCollectionIsNotPresent"),
  );
}
$('reload-workspace').onclick = () => operation(t("tools:loadingSavedStudioWorkspace"), loadWorkspace);
$('load-release').onclick = () =>
  operation(t("tools:loadingAndVerifyingTheReleaseCollection"), async (task) => {
    requireSettled();
    const published = await loadPublishedStudio({ signal: task.signal });
    task.update(t("tools:verifyingMergedReleaseAssets"), 'verifying');
    if (!published) throw new Error(t("tools:thisSourceCheckoutHasNoCompiledReleaseCollection"));
    const next = adoptStudioBundle(working.document, published.document);
    const assets = await verifyThemeAssets(
      next,
      new Map([...working.assets, ...published.assets]),
      { signal: task.signal },
    );
    task.check();
    stage(
      next,
      assets,
      t("tools:releaseCollectionStagedExistingLocalHistoryIsRetainedSaveOr"),
    );
  });
window.addEventListener('pagehide', (event) => {
  rememberView();
  copyRequest++;
  if (event.persisted) {
    operations.cancel();
    promptStatus.clear();
  } else {
    operations.dispose();
    promptStatus.dispose();
    pending?.bitmap?.close();
  }
  for (const id of ['current-preview', 'draft-preview']) $(id).previewCleanup?.();
  if (!event.persisted) {
    auditionLifecycle.dispose();
    studioGuide.dispose();
    interfacePreferences.dispose();
    stopMasterView();
    audioRestoration.dispose();
    audioPreferences.dispose();
    audioMaster.dispose();
  }
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) refreshPreviews();
});
window.addEventListener('beforeunload', (event) => {
  if (working !== saved || pending || sprite.hasEdits()) {
    event.preventDefault();
    event.returnValue = '';
  }
});
for (const [id, values] of [
  ['filter-screen', working.document.slots.flatMap((s) => s.screens)],
  ['filter-state', working.document.slots.flatMap((s) => s.states)],
])
  $(id).append(
    ...[...new Set(values)].sort().map((value) => {
      const option = node('option', value);
      option.value = value;
      return option;
    }),
  );
refresh();
operation(t("tools:loadingSavedStudioWorkspace"), loadWorkspace).then(() => {
  initialWorkspaceLoad = false;
  if (
    restoredView &&
    !operations.busy &&
    document.hasFocus() &&
    document.activeElement === document.body
  ) {
    const target = matchMedia('(max-width: 700px)').matches
      ? $('inspector')
      : $('asset-list').querySelector('button[aria-pressed="true"]') || $('inspector');
    target.focus();
  }
});
