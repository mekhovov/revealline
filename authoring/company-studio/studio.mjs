import { boundedJSON } from '../../game/data-json.mjs';
import { validateEditionRuntimeCatalog } from '../../game/editions/model.mjs';
import {
  DRAFT_FORMAT,
  declaredJSONPaths,
  validateStudioData,
  validateStudioDraft,
  validateStudioHistory,
  validateStudioReport,
  studioPreviewURL,
  studioSelection,
} from './model.mjs';
import { verifyStudioPreview } from './preview.mjs';
import { readStudioJSON } from './source-reader.mjs';
import { createStudioReviewContext } from './review-model.mjs';
import { createStudioReviewPane } from './review-pane.mjs';
import { createCompanyOperation } from './operation.mjs';
import { attachCompanyReader } from './reading.mjs';

const $ = (id) => document.getElementById(id);
const labels = [
  'Identity',
  'Artwork',
  'Actors & atmosphere',
  'Campaigns',
  'Learning',
  'Whole-game preview',
  'Validate & export',
];
const rootURL = new URL('../../', import.meta.url);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const status = (message, error = false) => {
  $('status').textContent = message;
  $('status').dataset.error = String(error);
};
const guarded =
  (handler) =>
  async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      if (error.name === 'AbortError') return;
      status(error.message, true);
    }
  };
const format = (value) => JSON.stringify(value, null, 2);
const download = (filename, value) => {
  const url = URL.createObjectURL(new Blob([`${format(value)}\n`], { type: 'application/json' }));
  const link = node('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const readJSON = async (url, { signal, originalText = false } = {}) => {
  return readStudioJSON(url, { signal, originalText });
};
let catalog,
  registeredCatalog,
  registeredRuntimeAssets,
  editionId,
  campaignId,
  files = new Map(),
  step = 0,
  revision = 0,
  loadGeneration = 0,
  report = null,
  previewController = null,
  missionReview = null,
  operation = null,
  lastExport = null;
const editorBuffers = new Map();
const selected = () => studioSelection(catalog, editionId);
const selectedCampaign = () => catalog.campaigns.find((campaign) => campaign.id === campaignId);
function invalidatePreview() {
  missionReview?.invalidate();
  previewController?.abort();
  previewController = null;
  report = null;
  $('open-preview').disabled = true;
  $('preview-frame').hidden = true;
  $('preview-frame').removeAttribute('src');
  $('preview-new-tab').hidden = true;
  $('report-checks').hidden = true;
  $('delivery-report').replaceChildren(
    node('p', 'No current compiler report. Compile the applied draft and import its report.'),
  );
  $('preview-note').textContent =
    'Compile this applied draft and import its report to open a whole-game preview.';
}
function changed(message) {
  revision++;
  invalidatePreview();
  $('draft-state').textContent = editorBuffers.size ? 'Unapplied JSON edits' : 'Applied draft';
  status(message);
}
async function readSource(path, { signal } = {}) {
  signal?.throwIfAborted();
  if (files.has(path)) return files.get(path);
  const owner = files,
    ticket = revision;
  const originalText = catalog.editions.some((edition) =>
    (edition.presentationHistory ?? []).some((record) => record.path === path),
  );
  const data = await readJSON(new URL(path, rootURL), { signal, originalText });
  signal?.throwIfAborted();
  if (files === owner && revision === ticket && !files.has(path)) files.set(path, data);
  return data;
}
function chooseOptions(select, items, value, none = false) {
  select.replaceChildren();
  if (none) {
    const option = node('option', typeof none === 'string' ? none : 'No image');
    option.value = '';
    select.append(option);
  }
  for (const item of items) {
    const option = node('option', item.name ?? item.id);
    option.value = item.id;
    select.append(option);
  }
  select.value = value ?? '';
}
const stepTargets = [
  'brand-name',
  'logo-asset',
  'theme-json',
  'campaign-select',
  'learning-campaign-select',
  'import-report',
  'export-draft-bottom',
];
function showStep(index, { focus = true } = {}) {
  step = Math.max(0, Math.min(6, index));
  for (const panel of document.querySelectorAll('[data-panel]'))
    panel.hidden = Number(panel.dataset.panel) !== step;
  for (const button of document.querySelectorAll('[data-step]'))
    if (Number(button.dataset.step) === step) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  $('previous-step').disabled = step === 0;
  $('next-step').hidden = step === 6;
  $('next-step').textContent = `Next: ${labels[step + 1] ?? ''} →`;
  $('step-position').textContent = `Step ${step + 1} of 7`;
  if (step !== 5) {
    previewController?.abort();
    previewController = null;
    $('preview-frame').hidden = true;
    $('preview-frame').removeAttribute('src');
  }
  if (focus && !document.hidden && document.hasFocus?.() !== false) $(stepTargets[step])?.focus();
}
function renderCatalog() {
  const { edition, brand, campaigns, assets } = selected();
  if (!campaigns.some((campaign) => campaign.id === campaignId))
    campaignId = edition.entryCampaignId;
  chooseOptions($('edition-select'), catalog.editions, editionId);
  $('draft-label').textContent = `${brand.name} / ${edition.name}`;
  $('brand-name').value = brand.name;
  $('edition-name').value = edition.name;
  $('audience').value = edition.audience;
  $('revision').value = edition.revision;
  $('description').value = brand.description;
  const references = $('brand-sources');
  references.replaceChildren(node('h3', 'Brand references'));
  if (!brand.sources?.length)
    references.append(
      node(
        'p',
        'No source references recorded yet. Add official or licensed sources in the catalog before review.',
      ),
    );
  for (const source of brand.sources ?? []) {
    const link = node('a', `${source.title} (${source.kind})`);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    references.append(link);
  }
  $('identity-ids').textContent =
    `Brand: ${brand.id} · Edition: ${edition.id} · Theme: ${brand.themeId}`;
  $('catalog-json').value = editorBuffers.get('catalog') ?? format(catalog);
  const images = catalog.assets.filter(
    (asset) => brand.assetIds.includes(asset.id) && /\.(png|jpe?g|webp|svg)$/i.test(asset.path),
  );
  chooseOptions($('logo-asset'), images, brand.logoAssetId, true);
  chooseOptions($('hero-asset'), images, brand.heroAssetId, true);
  chooseOptions(
    $('icon-asset'),
    images.filter((asset) => asset.derivative?.width === 512),
    brand.iconAssetId,
    'No install icon',
  );
  chooseOptions(
    $('font-asset'),
    catalog.assets.filter(
      (asset) => brand.assetIds.includes(asset.id) && /\.(ttf|otf|woff2?)$/i.test(asset.path),
    ),
    brand.fontAssetId,
    'System font',
  );
  $('asset-grid').replaceChildren();
  for (const asset of assets) {
    const card = node('article', undefined, 'asset-card');
    if (/\.(png|jpe?g|webp|svg)$/i.test(asset.path)) {
      const image = node('img');
      image.src = new URL(asset.path, rootURL).href;
      image.alt = asset.id;
      image.loading = 'lazy';
      card.append(image);
    }
    card.append(
      node('h3', asset.id),
      node('p', asset.path),
      node('p', `${asset.bytes.toLocaleString()} bytes · ${asset.publication}`),
      node('code', asset.sha256),
      node(
        'span',
        asset.approved ? 'Media admitted for compilation' : 'Media admission pending',
        'pill',
      ),
    );
    if (asset.dependencies.length)
      card.append(node('p', `Required assets: ${asset.dependencies.join(', ')}`));
    if (asset.derivative)
      card.append(
        node(
          'p',
          `Derivative: ${asset.derivative.width} × ${asset.derivative.height} · source SHA-256 ${asset.derivative.sourceSha256}`,
        ),
      );
    $('asset-grid').append(card);
  }
  const choices = $('campaign-choices');
  choices.replaceChildren(node('legend', 'Included campaigns'));
  for (const campaign of catalog.campaigns.filter((item) => item.brandId === brand.id)) {
    const label = node('label', undefined, 'check'),
      input = node('input');
    input.type = 'checkbox';
    input.value = campaign.id;
    input.checked = edition.campaignIds.includes(campaign.id);
    label.append(input, node('span', campaign.name));
    choices.append(label);
  }
  chooseOptions(
    $('entry-campaign'),
    catalog.campaigns.filter((item) => item.brandId === brand.id),
    edition.entryCampaignId,
  );
  chooseOptions($('campaign-select'), campaigns, campaignId);
  chooseOptions($('learning-campaign-select'), campaigns, campaignId);
  const registered = registeredCatalog.editions.some((item) => item.id === editionId);
  $('source-preview').hidden = !registered;
  if (registered) {
    const url = new URL('game/company.html', rootURL);
    url.searchParams.set('edition', editionId);
    $('source-preview').href = url.href;
  }
  const name = `${edition.id}-source`,
    output = `${edition.id}-preview`;
  $('compile-commands').textContent =
    `node scripts/company-studio.mjs import-draft --file ${edition.id}-draft.json --workspace .cache/${name}\n\nnode scripts/company-studio.mjs validate --workspace .cache/${name} --edition ${edition.id}\n\nnode scripts/company-studio.mjs preview --workspace .cache/${name} --edition ${edition.id} --out dist/company-previews/${output}\n\n# Import dist/company-previews/${output}.report.json in step 06`;
}
async function renderDocuments() {
  const ticket = ++loadGeneration,
    { edition } = selected(),
    campaign = selectedCampaign();
  const paths = [
    edition.boot?.themes,
    edition.boot?.presets,
    campaign.sourcePath,
    ...(campaign.lessonPath ? [campaign.lessonPath] : []),
  ].filter(Boolean);
  await Promise.all(paths.map((path) => readSource(path)));
  if (ticket !== loadGeneration) return;
  paintDocuments(edition, campaign);
}
function paintDocuments(edition, campaign) {
  for (const [key, path] of [
    ['theme', edition.boot?.themes],
    ['presets', edition.boot?.presets],
    ['campaign', campaign.sourcePath],
    ['learning', campaign.lessonPath],
  ]) {
    $(`${key}-path`).textContent = path ?? 'This adventure campaign has no lesson file.';
    $(`${key}-json`).value = path ? (editorBuffers.get(path) ?? format(files.get(path))) : '';
    $(`${key}-json`).dataset.sourcePath = path ?? '';
    $(`${key}-json`).disabled = !path;
    $(`apply-${key}`).disabled = !path;
  }
  const project = files.get(campaign.sourcePath);
  $('campaign-summary').textContent =
    `${project.missions?.length ?? 0} missions · ${project.maps?.length ?? 0} authored maps. Compiling validates rules; route proof is a separate check.`;
  const lessons = campaign.lessonPath ? files.get(campaign.lessonPath) : [];
  $('learning-summary').textContent = Array.isArray(lessons)
    ? `${lessons.length} assignments. ${lessons.filter((lesson) => lesson.kind === 'reflection').length} unscored reflections.`
    : 'Apply a bounded lesson array to validate these records.';
}
async function applyCatalog(input, message) {
  catalog = validateEditionRuntimeCatalog(input);
  if (!catalog.editions.some((edition) => edition.id === editionId))
    editionId = catalog.defaultEditionId;
  changed(message);
  renderCatalog();
  await renderDocuments();
}
async function applyFile(key) {
  const { edition } = selected(),
    campaign = selectedCampaign();
  const path = {
    theme: edition.boot?.themes,
    presets: edition.boot?.presets,
    campaign: campaign.sourcePath,
    learning: campaign.lessonPath,
  }[key];
  const data = validateStudioData(path, $(`${key}-json`).value, catalog, files);
  files.set(path, data);
  editorBuffers.delete(path);
  changed(`Applied and validated ${path}. Compile the draft to review it in the whole game.`);
  await renderDocuments();
}
function renderReport() {
  $('report-checks').hidden = false;
  $('report-checks').replaceChildren(node('h3', 'Imported compiler report — verification pending'));
  const checks = node('ul');
  for (const check of report.checks)
    checks.append(node('li', `${check.status.toUpperCase()}: ${check.detail}`));
  $('report-checks').append(checks);
  const delivery = $('delivery-report');
  delivery.replaceChildren(node('h3', report.name));
  const metrics = node('div', undefined, 'metrics');
  for (const [key, label] of [
    ['campaigns', 'Campaigns'],
    ['missions', 'Missions'],
    ['lessons', 'Lessons'],
    ['assets', 'Assets'],
    ['runtimeFiles', 'Runtime files'],
    ['runtimeBytes', 'Runtime bytes'],
  ]) {
    const value = node('div');
    value.append(node('strong', report.summary[key].toLocaleString()), node('span', label));
    metrics.append(value);
  }
  delivery.append(metrics);
  const exclusions = node('details');
  exclusions.append(node('summary', 'Excluded content'));
  for (const [key, ids] of Object.entries(report.excluded))
    exclusions.append(node('p', `${key}: ${ids.join(', ') || 'none'}`));
  delivery.append(exclusions);
  const admitted = node('details');
  admitted.append(
    node('summary', `${report.admittedPaths.length} admitted paths`),
    node('pre', report.admittedPaths.join('\n')),
  );
  delivery.append(admitted);
  $('open-preview').disabled =
    !report.previewURL || report.checks.some((check) => check.status === 'failed');
  $('preview-note').textContent =
    `Report received for ${report.name}. Opening the preview verifies its complete file inventory and selected source against this applied draft. This is a consistency check, not publication or human approval.`;
}
function operationContext() {
  return {
    catalog,
    files,
    signature: JSON.stringify([
      editionId,
      campaignId,
      step,
      revision,
      report,
      [...editorBuffers],
      [...document.querySelectorAll('input,select,textarea')]
        .filter((field) => !field.closest('#company-operation') && field.type !== 'file')
        .map((field) => [field.id, field.value, field.checked]),
    ]),
  };
}
async function completePacket(sourceCatalog, sourceFiles, signal) {
  const paths = declaredJSONPaths(sourceCatalog),
    prepared = new Map(sourceFiles);
  await Promise.all(
    paths.map(async (path) => {
      if (prepared.has(path)) return;
      const originalText = sourceCatalog.editions.some((edition) =>
        (edition.presentationHistory ?? []).some((record) => record.path === path),
      );
      const data = await readJSON(new URL(path, rootURL), { signal, originalText });
      signal.throwIfAborted();
      prepared.set(path, data);
    }),
  );
  signal.throwIfAborted();
  const checked = validateStudioDraft({
    format: DRAFT_FORMAT,
    catalog: sourceCatalog,
    files: paths.map((path) => ({ path, data: prepared.get(path) })),
  });
  await validateStudioHistory(checked.catalog, checked.files, { signal });
  signal.throwIfAborted();
  return checked;
}
async function prepareIncoming(text, signal) {
  signal.throwIfAborted();
  const input = boundedJSON(text, {
    maxBytes: 16 * 1024 * 1024,
    maxNodes: 400000,
    maxArray: 8192,
    maxString: 4 * 1024 * 1024,
  });
  if (input.format === DRAFT_FORMAT) {
    const checked = validateStudioDraft(input);
    await validateStudioHistory(checked.catalog, checked.files, { signal });
    signal.throwIfAborted();
    return checked;
  }
  return completePacket(validateEditionRuntimeCatalog(input), new Map(), signal);
}
function replaceDraft(checked, preferredEdition) {
  ++loadGeneration;
  catalog = checked.catalog;
  files = checked.files;
  editorBuffers.clear();
  editionId = catalog.editions.some((edition) => edition.id === preferredEdition)
    ? preferredEdition
    : catalog.defaultEditionId;
  campaignId = null;
  changed('Validated source replaced the current tab draft. Nothing was saved persistently.');
  renderCatalog();
  paintDocuments(selected().edition, selectedCampaign());
  showStep(0, { focus: false });
}
async function exportDraft() {
  if (editorBuffers.size)
    throw new Error('Apply your JSON editor changes before exporting the source draft.');
  const sourceCatalog = catalog,
    sourceFiles = new Map(files),
    sourceEdition = editionId;
  await operation.run({
    label: 'Prepare source export',
    prepare: (signal) => completePacket(sourceCatalog, sourceFiles, signal),
    commit(checked) {
      const packet = {
        format: DRAFT_FORMAT,
        catalog: checked.catalog,
        files: [...checked.files].map(([path, data]) => ({ path, data })),
      };
      const text = `${format(packet)}\n`;
      download(`${sourceEdition}-draft.json`, packet);
      lastExport = Object.freeze({ editionId: sourceEdition, text });
      $('reopen-export').disabled = false;
      $('draft-state').textContent = 'Source download requested';
      status(
        'Source download requested. The validated packet can be reopened in this tab; it is not a persistent save. Compile it in a separate workspace for artifact verification.',
      );
    },
  });
}
async function reopenExport() {
  const snapshot = lastExport;
  if (!snapshot) return;
  await operation.run({
    label: 'Reopen last exported draft',
    replacement: true,
    prepare: (signal) => prepareIncoming(snapshot.text, signal),
    commit: (checked) => replaceDraft(checked, snapshot.editionId),
    successFocus: () => $('brand-name'),
  });
}
async function openPreview() {
  if (editorBuffers.size)
    throw new Error(
      'Apply your JSON editor changes and compile the updated draft before opening a preview.',
    );
  if (!report) throw new Error('Import a compiler report first.');
  if (step !== 5) throw new Error('Open the Whole-game preview step before verification.');
  previewController?.abort();
  const controller = new AbortController();
  previewController = controller;
  const activeReport = report,
    ticket = revision;
  const selection = selected();
  const paths = [
    ...new Set([
      ...Object.values(selection.edition.boot ?? {}),
      ...(selection.edition.presentationHistory ?? []).map((record) => record.path),
      ...selection.campaigns.flatMap((campaign) => [
        campaign.sourcePath,
        ...(campaign.lessonPath ? [campaign.lessonPath] : []),
      ]),
    ]),
  ];
  status('Loading selected draft sources before artifact verification…');
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    await Promise.all(paths.map((path) => readSource(path, { signal: controller.signal })));
    controller.signal.throwIfAborted();
    const verified = await verifyStudioPreview({
      catalog,
      editionId,
      files,
      report: activeReport,
      baseURL: location.href,
      runtimeAssets: registeredRuntimeAssets,
      signal: controller.signal,
      onProgress: (completed, total) => {
        if (!controller.signal.aborted && previewController === controller && step === 5)
          status(`Verifying compiled files: ${completed} of ${total}…`);
      },
    });
    controller.signal.throwIfAborted();
    if (previewController !== controller || step !== 5)
      throw new DOMException('Preview verification no longer owns this step.', 'AbortError');
    if (ticket !== revision || report !== activeReport || editorBuffers.size)
      throw new Error(
        'The draft or report changed during verification. Open the current report again.',
      );
    missionReview?.adopt(
      createStudioReviewContext({ catalog, editionId, files, report: activeReport }),
    );
    $('preview-frame').src = verified.url.href;
    $('preview-frame').hidden = false;
    $('preview-new-tab').href = verified.url.href;
    $('preview-new-tab').hidden = false;
    $('report-checks').querySelector('h3').textContent =
      'Compiler report — artifact consistency verified';
    $('preview-note').textContent =
      `${verified.verifiedFiles} artifact files verified against the report. Selected source matches the applied draft after normal theme selection. Human and publication reviews remain separate.`;
    status(
      'Verified the complete artifact inventory and applied source. The preview runs the whole company game; this does not approve artwork or human playtesting.',
    );
  } catch (error) {
    if (controller.signal.aborted && previewController === controller)
      status(
        'Preview verification was cancelled or exceeded one minute. Retry the current report.',
        true,
      );
    throw error;
  } finally {
    clearTimeout(timeout);
    if (previewController === controller) previewController = null;
  }
}

async function main() {
  missionReview = createStudioReviewPane({ documentRef: document, download, status });
  operation = createCompanyOperation({
    document,
    getContext: operationContext,
    onCancel: () =>
      status('Operation cancelled. The current draft and unapplied changes are unchanged.'),
  });
  registeredCatalog = validateEditionRuntimeCatalog(
    await readJSON(new URL('game/editions/catalog.json', rootURL)),
  );
  registeredRuntimeAssets = await readJSON(new URL('game/editions/runtime-assets.json', rootURL));
  catalog = registeredCatalog;
  editionId = catalog.defaultEditionId;
  renderCatalog();
  await renderDocuments();
  status('Registered source loaded. Choose a step to shape the next edition.');
  for (const button of document.querySelectorAll('[data-step]'))
    button.onclick = () => showStep(Number(button.dataset.step));
  $('previous-step').onclick = () => showStep(step - 1);
  $('next-step').onclick = () => showStep(step + 1);
  $('edition-select').onchange = guarded(async () => {
    editionId = $('edition-select').value;
    revision++;
    invalidatePreview();
    renderCatalog();
    await renderDocuments();
    status('Selected edition loaded. Applied edits in other source files are retained.');
  });
  for (const id of ['campaign-select', 'learning-campaign-select'])
    $(id).onchange = guarded(async () => {
      campaignId = $(id).value;
      renderCatalog();
      await renderDocuments();
    });
  $('identity-form').onsubmit = guarded(async (event) => {
    event.preventDefault();
    const draft = structuredClone(catalog),
      edition = draft.editions.find((item) => item.id === editionId),
      brand = draft.brands.find((item) => item.id === edition.brandId);
    edition.name = $('edition-name').value.trim();
    edition.audience = $('audience').value.trim();
    edition.revision = Number($('revision').value);
    brand.name = $('brand-name').value.trim();
    brand.description = $('description').value.trim();
    await applyCatalog(draft, 'Identity applied to the source draft.');
  });
  $('art-form').onsubmit = guarded(async (event) => {
    event.preventDefault();
    const draft = structuredClone(catalog),
      brand = draft.brands.find((item) => item.id === selected().brand.id);
    brand.logoAssetId = $('logo-asset').value || null;
    brand.heroAssetId = $('hero-asset').value || null;
    brand.iconAssetId = $('icon-asset').value || null;
    brand.fontAssetId = $('font-asset').value || null;
    await applyCatalog(draft, 'Artwork roles applied. Media bytes remain pinned by the catalog.');
  });
  $('campaign-form').onsubmit = guarded(async (event) => {
    event.preventDefault();
    const draft = structuredClone(catalog),
      edition = draft.editions.find((item) => item.id === editionId);
    edition.campaignIds = [...$('campaign-choices').querySelectorAll('input')]
      .filter((input) => input.checked)
      .map((input) => input.value);
    edition.entryCampaignId = $('entry-campaign').value;
    await applyCatalog(draft, 'Campaign selection applied to this audience edition.');
  });
  $('apply-catalog').onclick = guarded(() => {
    const checked = validateEditionRuntimeCatalog($('catalog-json').value);
    editorBuffers.delete('catalog');
    return applyCatalog(checked, 'Catalog validated and applied.');
  });
  $('catalog-json').oninput = () => {
    missionReview?.invalidate();
    previewController?.abort();
    editorBuffers.set('catalog', $('catalog-json').value);
    $('draft-state').textContent = 'Unapplied JSON edits';
  };
  for (const key of ['theme', 'presets', 'campaign', 'learning'])
    $(`${key}-json`).oninput = () => {
      missionReview?.invalidate();
      previewController?.abort();
      const editor = $(`${key}-json`);
      if (editor.dataset.sourcePath) editorBuffers.set(editor.dataset.sourcePath, editor.value);
      $('draft-state').textContent = 'Unapplied JSON edits';
    };
  for (const key of ['theme', 'presets', 'campaign', 'learning'])
    $(`apply-${key}`).onclick = guarded(() => applyFile(key));
  $('export-draft').onclick = guarded(exportDraft);
  $('export-draft-bottom').onclick = guarded(exportDraft);
  $('open-preview').onclick = guarded(openPreview);
  $('reopen-export').onclick = guarded(reopenExport);
  $('import-draft').onchange = guarded(async () => {
    const file = $('import-draft').files[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) throw new Error('The source packet exceeds 16 MB.');
    const preferredEdition = editionId;
    await operation.run({
      label: 'Validate imported source',
      replacement: true,
      prepare: async (signal) => prepareIncoming(await file.text(), signal),
      commit: (checked) => {
        replaceDraft(checked, preferredEdition);
        $('import-draft').value = '';
      },
      successFocus: () => $('brand-name'),
    });
  });
  $('import-report').onchange = guarded(async () => {
    const file = $('import-report').files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) throw new Error('The compiler report exceeds 4 MB.');
    const expectedEdition = editionId;
    await operation.run({
      label: 'Read compiler report',
      prepare: async (signal) => {
        const checked = validateStudioReport(await file.text());
        signal.throwIfAborted();
        if (checked.editionId !== expectedEdition)
          throw new Error('Select the edition named by this report before importing it.');
        if (checked.previewURL) studioPreviewURL(checked, location.href);
        return checked;
      },
      commit(checked) {
        invalidatePreview();
        report = checked;
        renderReport();
        $('import-report').value = '';
        status(
          'Compiler report imported but not yet verified. Verify the artifact in step 06; human review remains pending.',
        );
      },
    });
  });
  for (const [id, region, label] of [
    ['company-read-artwork', 'asset-grid', 'Artwork provenance'],
    ['company-read-commands', 'compile-commands', 'Compiler commands'],
    ['company-read-report', 'report-checks', 'Unverified compiler report'],
  ])
    attachCompanyReader({ document, id, region: $(region), label });
  showStep(0);
}
main().catch((error) => {
  status(`Could not open the studio: ${error.message}`, true);
  $('export-draft').disabled = true;
});
