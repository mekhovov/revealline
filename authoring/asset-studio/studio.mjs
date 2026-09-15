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
const $ = (id) => document.getElementById(id);
const node = (tag, value = '', className = '') => {
  const el = document.createElement(tag);
  el.textContent = value;
  el.className = className;
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
    if (
      !value &&
      document.hasFocus() &&
      [document.body, $('cancel-studio-operation')].includes(document.activeElement) &&
      operationFocus?.isConnected &&
      !operationFocus.disabled
    )
      operationFocus.focus();
  },
});
const status = (message, kind = '') => operations.message(message, kind);
const report = (error) => status(error.message || String(error), 'error');
const audioMaster = createAudioMaster();
const audioPreferences = createAudioPreferences({
  audioMaster,
  window,
  getStorage: () => localStorage,
  onWarning: (message) => {
    $('studio-audio-status').textContent = message;
  },
});
const stopMasterView = audioMaster.subscribe(({ muted, volume }) => {
  $('studio-audio-mute').textContent = muted ? 'Unmute sound' : 'Mute sound';
  $('studio-audio-mute').setAttribute('aria-pressed', String(!muted));
  $('studio-master-volume').value = volume;
});
$('studio-audio-mute').onclick = () => audioPreferences.setMuted(!audioMaster.snapshot().muted);
$('studio-master-volume').onchange = () =>
  audioPreferences.setVolume(Number($('studio-master-volume').value));
const operation = (label, fn) => operations.run(label, fn);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && operations.cancel()) event.preventDefault();
});
function requireSettled(allowPixels = false) {
  if (!allowPixels && sprite.hasEdits())
    throw new Error(
      'Prepare the edited sprite, or discard pixel edits, before changing workspace revisions.',
    );
  if (pending)
    throw new Error(
      'Validate and stage the prepared slot, or discard it, before changing workspace revisions.',
    );
}
function stage(
  document,
  assets = working.assets,
  message = 'Change staged. Save a local revision or export to keep it.',
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
  $('upload-summary').textContent = 'No replacement selected.';
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
  $('slot-count').textContent = `${rows.length} / ${working.document.slots.length}`;
  const coverage = presentationCoverage(working.document);
  $('coverage-summary').textContent =
    `${coverage.counts.missing} missing · ${coverage.counts.source} source · ${coverage.counts.produced} produced · ${coverage.counts.reviewed} reviewed. Readiness is evidence based.`;
  const list = document.createDocumentFragment();
  for (const slot of rows) {
    const asset = view.assets[slot.id],
      stage = asset?.quality.stage || 'missing';
    const row = node('div', '', `asset-row${slot.id === selected ? ' selected' : ''}`);
    row.setAttribute('role', 'listitem');
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = collectionSlots.has(slot.id);
    check.setAttribute('aria-label', `Include ${slot.label} in collection`);
    check.onchange = () => {
      check.checked ? collectionSlots.add(slot.id) : collectionSlots.delete(slot.id);
      updateCollectionCount();
      refreshPrompt();
    };
    const button = node('button');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(slot.id === selected));
    button.append(
      node('strong', slot.label),
      node('small', `${slot.id} · ${stage}`, `stage-${stage}`),
    );
    button.onclick = () => {
      try {
        selectSlot(slot.id);
        if (matchMedia('(max-width: 700px)').matches) $('inspector').focus();
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
  $('collection-count').textContent = `${collectionSlots.size} slots selected`;
}
function refresh() {
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
  $('workspace-summary').textContent =
    `Theme ${view.theme.name} · document r${working.document.revision} · local save ${generation || 'none'}${working !== saved ? ' · unsaved changes' : ''}${view.collection ? ` · ${view.collection.id}` : ''}`;
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
  $('slot-id').textContent = slot.id;
  $('slot-title').textContent = slot.label;
  $('slot-quality').textContent = asset?.quality.stage || 'missing';
  const priorState = $('preview-state').value;
  $('preview-state').replaceChildren(
    ...slot.states.map((state) => {
      const option = node('option', state);
      option.value = state;
      return option;
    }),
  );
  if (slot.states.includes(priorState)) $('preview-state').value = priorState;
  $('slot-description').textContent = asset?.description || 'No asset bound to this slot.';
  const facts = [
    [
      'Frame',
      slot.dimensions
        ? `${slot.dimensions.width} × ${slot.dimensions.height} px`
        : 'Scalable / media',
    ],
    ['Accepted', slot.kinds.join(', ')],
    ['Budget', `${Math.round(slot.budget.maxBytes / 1024)} KiB`],
    ['Alpha', slot.alpha],
    ['Sampling', slot.sampling],
    ['Required', slot.required ? 'Yes' : 'Optional theme owner'],
  ];
  $('slot-facts').replaceChildren(
    ...facts.map(([key, value]) => {
      const wrapper = node('div');
      wrapper.append(node('dt', key), node('dd', value));
      return wrapper;
    }),
  );
  $('slot-usage').replaceChildren(
    ...slot.screens.map((screen) => node('span', screen)),
    ...slot.states.map((state) => node('span', `:${state}`)),
  );
  $('slot-requirements').replaceChildren(
    ...slot.requirements.map((requirement) => node('li', requirement)),
  );
  $('slot-contract').textContent = JSON.stringify(
    { ...slot, currentAsset: asset ? `${asset.id}@${asset.revision}` : null },
    null,
    2,
  );
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
  const requestedPreview = ++previewGeneration;
  const slot = currentSlot(),
    current = resolvePresentation(saved.document),
    view = resolved();
  const candidate = pending?.candidate || view.assets[slot.id],
    map = new Map(working.assets);
  if (pending?.candidateBlob) map.set(candidate.file.sha256, pending.candidateBlob);
  const options = {
    audioMaster,
    mode: $('preview-mode').value,
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
        label: id === 'current' ? 'Saved preview' : 'Draft preview',
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
    related = new Set([
      asset?.id,
      `${selected}.default`,
      `${selected}.custom`,
      `${selected}.custom.source`,
    ]);
  const history = working.document.assets.filter((item) => related.has(item.id)).reverse();
  $('asset-history').replaceChildren(
    ...history.map((item) => {
      const row = node('div', '', 'history-row'),
        copy = node('div');
      copy.append(
        node('strong', `${item.id}@${item.revision}`),
        node(
          'p',
          `${item.kind} · ${item.quality.stage} · ${item.provenance.creator} · ${item.provenance.license}`,
        ),
      );
      row.append(copy);
      if (item.file) {
        const downloadButton = node('button', 'Download file');
        downloadButton.type = 'button';
        downloadButton.onclick = () =>
          download(
            working.assets.get(item.file.sha256),
            `${item.id}-${item.revision}.${extension(item.file.mime)}`,
          );
        row.append(downloadButton);
      }
      const button = node('button', 'Bind this revision');
      button.type = 'button';
      button.disabled = item.id === asset?.id && item.revision === asset?.revision;
      button.onclick = () =>
        operation('Preparing workspace change…', () => {
          requireSettled();
          stage(
            reviseStudioTheme(working.document, { bindings: { [selected]: ref(item) } }),
            working.assets,
            'Earlier asset bound in a new immutable theme revision.',
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
      const label = node('label', key),
        input = document.createElement('input');
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
function download(blob, filename) {
  if (!blob) {
    report(new Error('File bytes are unavailable.'));
    return;
  }
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function fileMetadata(blob, dimensions, task) {
  task.update('Reading asset bytes for verification…', 'reading');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  task.update('Hashing the original asset bytes…', 'verifying');
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
  task.update('Reading the image header…', 'reading');
  const dataURL = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => task.signal.removeEventListener('abort', cancel);
    const cancel = () => {
      reader.abort();
      cleanup();
      reject(new DOMException('Image read cancelled.', 'AbortError'));
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
  task.update('Validating image dimensions…', 'verifying');
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
  task.update('Decoding the original image…', 'decoding');
  const bitmap = await createImageBitmap(blob);
  try {
    task.check();
    if (bitmap.width !== info.width || bitmap.height !== info.height)
      throw new Error('Decoded image dimensions do not match its header.');
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
    throw new Error('The original exceeds the 4 MiB asset budget.');
  const blob = new Blob([file], { type: mime });
  const revision = nextAssetRevision(working.document, slot.id);
  const record = {
    format: FORMATS.asset,
    ...revision,
    kind,
    description: slot.label,
    provenance: {
      creator: 'Pending creator',
      source: file.name || 'Local pixel editor',
      license: 'Pending rights declaration',
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
    $('asset-source').value = file.name || 'Local pixel editor';
    $('asset-description').value = slot.label;
    $('upload-summary').textContent =
      `${file.name || 'Local sprite'} · ${Math.ceil(blob.size / 1024)} KiB${bitmap ? ` · ${bitmap.width} × ${bitmap.height} px original` : ''}`;
    $('image-preparation').hidden = !bitmap;
    if (crop) setCrop(crop);
    populateGeometry();
    $('stage-asset').disabled = false;
    refreshPreviews();
    status(
      'Replacement prepared. Check geometry and enter actual creator, source, and rights before staging.',
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
  task.update('Encoding the crop at the slot frame size…', 'encoding');
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
  if (!blob) throw new Error('The browser could not encode this crop.');
  const asset = structuredClone(preparation.template);
  asset.file = await fileMetadata(blob, canvas, task);
  asset.geometry = imageGeometry(canvas, slot);
  asset.provenance.parent = ref(preparation.original);
  return { candidate: asset, candidateBlob: blob };
}
async function prepareCrop(task) {
  if (!pending?.bitmap) throw new Error('Choose an image first.');
  const preparation = pending;
  const candidate = await cropCandidate(preparation, currentSlot(), getCrop(), task);
  task.check();
  Object.assign(preparation, candidate);
  populateGeometry();
  $('stage-asset').disabled = false;
  drawSource();
  refreshPreviews();
  status(
    'Derivative prepared. Check geometry and enter actual creator, source, and rights before staging.',
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
  $('geometry-usage').textContent = controls.pivot
    ? 'The pivot places this artwork around its unchanged gameplay center. Rotor hubs and panel slices are editable only where the renderer supports them.'
    : 'This interface or picture slot uses centered placement. Crop the source to change its composition; unsupported anchors and slices stay locked.';
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
  if (!pending?.candidate) throw new Error('Prepare an image crop or choose media first.');
  const asset = structuredClone(pending.candidate);
  if (asset.geometry) asset.geometry = editedGeometry();
  if (!geometryOnly) {
    for (const id of ['asset-creator', 'asset-source', 'asset-license'])
      if (!$(id).value.trim()) {
        $(id).focus();
        throw new Error('Enter the actual creator, source, and license / rights statement.');
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
    status('Geometry checked and applied to the draft preview.');
    return;
  }
  if (asset.kind === 'image') {
    task.update('Decoding and checking transparency…', 'decoding');
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
      throw new Error('This slot requires transparency; the candidate is fully opaque.');
    if (currentSlot().alpha === 'opaque' && measured.transparent)
      throw new Error('This slot requires a fully opaque image.');
    if (!measured.occupiedBounds)
      throw new Error('The candidate is entirely transparent. Paint or import a visible asset.');
  }
  if (asset.kind === 'font') {
    task.update('Reading and decoding the candidate font…', 'decoding');
    const fontBytes = await pending.candidateBlob.arrayBuffer();
    task.check();
    await new FontFace('RLStudioValidation', fontBytes).load();
  }
  task.update('Verifying original bytes and replacement history…', 'verifying');
  const verified = await verifyThemeAssets(next, bytes, { signal: task.signal });
  task.check();
  discardPreparation();
  stage(
    next,
    verified,
    'Replacement validated and staged. The original source and earlier revisions remain in the bundle.',
  );
}
const editGeometry = node('button', 'Edit current raster metadata');
editGeometry.type = 'button';
editGeometry.id = 'edit-geometry';
$('asset-upload-label').after(editGeometry);
editGeometry.onclick = () =>
  operation('Preparing workspace change…', () => {
    requireSettled();
    const asset = resolved().assets[selected];
    if (asset.kind !== 'image') throw new Error('Choose a raster asset first.');
    const candidate = {
      ...structuredClone(asset),
      ...nextAssetRevision(working.document, selected),
      provenance: { ...structuredClone(asset.provenance), parent: ref(asset) },
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
    $('upload-summary').textContent = 'Editing metadata; existing bytes remain unchanged.';
  });
const sprite = mountSpritePanel({
  onError: report,
  runOperation: operation,
  onPrepare: (blob, task) =>
    startUpload(new File([blob], 'local-sprite.png', { type: 'image/png' }), true, task),
});
const discardPixels = node('button', 'Discard pixel edits');
discardPixels.type = 'button';
$('edit-current').after(discardPixels);
discardPixels.onclick = () => {
  sprite.reset();
  status('Pixel editor cleared. Prepared and staged assets are unchanged.');
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
  operation('Decoding the current sprite…', async (task) => {
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
    status('Current raster loaded in the pixel editor.');
  });
$('asset-upload').onchange = () => {
  const file = $('asset-upload').files[0];
  if (file) operation('Reading replacement file…', (task) => startUpload(file, false, task));
};
$('prepare-crop').onclick = () => operation('Preparing crop derivative…', prepareCrop);
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
  operation('Checking preview geometry…', (task) => validatePending(true, task));
$('stage-asset').onclick = () =>
  operation('Validating replacement…', (task) => validatePending(false, task));
$('discard-asset').onclick = () => {
  discardPreparation();
  refreshInspector();
  status('Prepared slot discarded. Staged workspace revisions are unchanged.');
};
$('token-form').onsubmit = (event) => {
  event.preventDefault();
  operation('Preparing workspace change…', () => {
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
  $(id).addEventListener(id === 'filter-search' ? 'input' : 'change', refreshInventory),
);
$('filter-theme').onchange = () =>
  operation('Preparing workspace change…', () => {
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
  operation('Preparing workspace change…', () => {
    requireSettled();
    if (!collectionSlots.size) throw new Error('Select at least one slot to build a collection.');
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
      'Collection staged atomically. Every selected slot has a valid binding.',
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
  const lease = promptStatus.begin({ message: 'Copying the complete prompt…' });
  try {
    await navigator.clipboard.writeText($('generated-prompt').value);
    lease.finish({ message: 'Complete prompt copied.' });
  } catch {
    if (request !== copyRequest) return;
    if (document.hasFocus() && document.activeElement === button) {
      $('generated-prompt').focus();
      $('generated-prompt').select();
    }
    lease.finish({
      message: 'Clipboard unavailable. Select the full prompt and press Ctrl/Cmd+C.',
      state: 'error',
    });
  }
};
$('undo-draft').onclick = () =>
  operation('Preparing workspace change…', () => {
    requireSettled();
    if (!undo.length) return;
    redo.push(working);
    working = undo.pop();
    refresh();
    status('Draft change undone. Saved history is intact.');
  });
$('redo-draft').onclick = () =>
  operation('Preparing workspace change…', () => {
    requireSettled();
    if (!redo.length) return;
    undo.push(working);
    working = redo.pop();
    refresh();
    status('Draft change restored.');
  });
$('reset-draft').onclick = () =>
  operation('Preparing workspace change…', () => {
    requireSettled();
    working = saved;
    undo = [];
    redo = [];
    sprite.reset();
    refresh();
    status('Returned to the last saved workspace.');
  });
$('record-review').onclick = () =>
  operation('Preparing workspace change…', () => {
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
      throw new Error('Record the concrete review checks before marking this asset reviewed.');
    const current = resolved().assets[selected];
    if (!current) throw new Error('Bind an asset before reviewing it.');
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
      'Review evidence recorded in a new immutable revision.',
    );
    $('review-evidence').value = '';
  });
$('save-workspace').onclick = () =>
  operation('Preparing a local revision…', async (task) => {
    requireSettled();
    if (!storageReady)
      throw new Error(
        'Local storage has not loaded successfully. Export your work, then use Reload saved to retry.',
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
    status('Local revision saved atomically. Player saves are untouched.', 'success');
  });
$('export-workspace').onclick = () =>
  operation('Verifying original bytes for export…', async (task) => {
    requireSettled();
    const bundle = await exportThemeBundle(working.document, working.assets, {
      signal: task.signal,
    });
    task.check();
    download(bundle, `revealline-${resolved().theme.id}-r${working.document.revision}.rltheme`);
    status('Theme download requested with all source files and immutable revisions.', 'success');
  });
$('import-workspace').onchange = () => {
  const file = $('import-workspace').files[0];
  if (!file) return;
  $('import-workspace').value = '';
  operation('Reading and validating the imported bundle…', async (task) => {
    requireSettled();
    const incoming = await importThemeBundle(file, { signal: task.signal });
    task.update('Verifying merged assets and immutable revisions…', 'verifying');
    const next = adoptStudioBundle(working.document, incoming.document),
      merged = new Map([...working.assets, ...incoming.assets]);
    const bytes = await verifyThemeAssets(next, merged, { signal: task.signal });
    task.check();
    stage(
      next,
      bytes,
      'Verified collection staged atomically. Current and imported source files are retained. Save to persist.',
    );
  });
};
async function loadWorkspace(task) {
  requireSettled();
  if (working !== saved)
    throw new Error('Export or save the staged workspace, or Reset to saved, before reloading.');
  const result = await store.load();
  task.check();
  if (!result) task.update('Loading and verifying the current release collection…', 'downloading');
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
  if (!working.document.slots.some((slot) => slot.id === selected))
    selected = working.document.slots[0].id;
  sprite.reset();
  refresh();
  status(
    result
      ? 'Saved studio workspace loaded.'
      : published
        ? 'Current release assets loaded. Changes stay in this local studio.'
        : 'Source registry loaded. A compiled release collection is not present.',
  );
}
$('reload-workspace').onclick = () => operation('Loading saved Studio workspace…', loadWorkspace);
$('load-release').onclick = () =>
  operation('Loading and verifying the release collection…', async (task) => {
    requireSettled();
    const published = await loadPublishedStudio({ signal: task.signal });
    task.update('Verifying merged release assets…', 'verifying');
    if (!published) throw new Error('This source checkout has no compiled release collection.');
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
      'Release collection staged. Existing local history is retained; save or undo this change.',
    );
  });
window.addEventListener('pagehide', (event) => {
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
    stopMasterView();
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
operation('Loading saved Studio workspace…', loadWorkspace);
