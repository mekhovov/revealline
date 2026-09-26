import { boundedJSON } from '../../game/data-json.mjs';
import { validateEditionRuntimeCatalog } from '../../game/editions/model.mjs';
import {
  DRAFT_FORMAT,
  declaredJSONPaths,
  validateStudioData,
  validateStudioDraft,
  validateStudioReport,
  studioPreviewURL,
  studioSelection,
} from './model.mjs';
import { verifyStudioPreview } from './preview.mjs';

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
const readJSON = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const response = await fetch(url, { signal });
  if (!response.ok)
    throw new Error(
      'Source file is unavailable. Import a complete draft or save the file in its declared workspace path.',
    );
  return boundedJSON(await response.text());
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
  previewController = null;
const editorBuffers = new Map();
const selected = () => studioSelection(catalog, editionId);
const selectedCampaign = () => catalog.campaigns.find((campaign) => campaign.id === campaignId);
function invalidatePreview() {
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
  const data = await readJSON(new URL(path, rootURL), { signal });
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
function showStep(index) {
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
  document.querySelector(`[data-panel="${step}"] h2`)?.focus();
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
async function exportDraft() {
  if (editorBuffers.size)
    throw new Error('Apply your JSON editor changes before exporting the source draft.');
  status('Collecting every declared source file and validating the draft…');
  const paths = declaredJSONPaths(catalog);
  await Promise.all(paths.map((path) => readSource(path)));
  const packet = {
    format: DRAFT_FORMAT,
    catalog,
    files: paths.map((path) => ({ path, data: files.get(path) })),
  };
  const checked = validateStudioDraft(packet);
  files = checked.files;
  download(`${editionId}-draft.json`, {
    ...packet,
    files: [...files].map(([path, data]) => ({ path, data })),
  });
  $('draft-state').textContent = 'Source exported';
  status(
    'Source packet exported. Import it into a new workspace, compile the selected edition, then import its report here.',
  );
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
    previewController?.abort();
    editorBuffers.set('catalog', $('catalog-json').value);
    $('draft-state').textContent = 'Unapplied JSON edits';
  };
  for (const key of ['theme', 'presets', 'campaign', 'learning'])
    $(`${key}-json`).oninput = () => {
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
  $('import-draft').onchange = guarded(async () => {
    const file = $('import-draft').files[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) throw new Error('The source packet exceeds 16 MB.');
    const input = boundedJSON(await file.text(), {
      maxBytes: 16 * 1024 * 1024,
      maxNodes: 400000,
      maxArray: 8192,
    });
    if (input.format === DRAFT_FORMAT) {
      const draft = validateStudioDraft(input);
      editorBuffers.clear();
      files = draft.files;
      await applyCatalog(draft.catalog, 'Complete source draft imported.');
    } else {
      const checked = validateEditionRuntimeCatalog(input);
      editorBuffers.clear();
      files = new Map();
      await applyCatalog(
        checked,
        'Catalog imported. Source JSON is loaded from its declared workspace paths.',
      );
    }
    $('import-draft').value = '';
  });
  $('import-report').onchange = guarded(async () => {
    const file = $('import-report').files[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) throw new Error('The compiler report exceeds 4 MB.');
    const checked = validateStudioReport(await file.text());
    if (checked.editionId !== editionId)
      throw new Error('Select the edition named by this report before importing it.');
    if (checked.previewURL) studioPreviewURL(checked, location.href);
    invalidatePreview();
    report = checked;
    renderReport();
    $('import-report').value = '';
    status(
      'Compiler report imported but not yet verified. Verify the artifact in step 06; human review remains pending.',
    );
  });
  showStep(0);
}
main().catch((error) => {
  status(`Could not open the studio: ${error.message}`, true);
  $('export-draft').disabled = true;
});
