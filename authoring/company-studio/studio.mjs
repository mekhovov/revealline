import { rewardPresentationItems } from '../../game/rewards/audio-groups.mjs';
import { mountRewardAudioGroup } from '../../game/ui/reward-audio-group.mjs';
import { mountRewardKnowledge } from '../../game/ui/reward-knowledge.mjs';
import { getLocale, localizedText, t } from '../../game/i18n/index.mjs';
import { createLessonEditor } from './lesson-editor.mjs';
import { createStudioLessonSidecar, validateStudioLessonRevisions } from './lesson-authoring.mjs';
import { mountRewardMedia } from '../../game/ui/reward-media.mjs';
import { mountRewardQr } from '../../game/ui/reward-qr.mjs';
import { acquireStudioRewardAudio } from '../../game/studio/reward-audio.mjs';
import { campaignLocalizationSha256 } from '../../game/editions/localization.mjs';
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
  withStudioCampaignHero,
  withStudioAppearanceDefault,
  withStudioAppearanceTheme,
  listStudioAppearanceThemes,
  findStudioAppearanceTheme,
} from './model.mjs';
import { verifyStudioPreview } from './preview.mjs';
import { readStudioJSON } from './source-reader.mjs';
import { createStudioReviewContext } from './review-model.mjs';
import { createStudioReviewPane } from './review-pane.mjs';
import {
  createStudioReward,
  previewStudioReward,
  rebindStudioRewardLocalization,
} from './reward-editor.mjs';
import { discoveryCosmeticContext } from '../../game/content-design/discovery-cosmetics.mjs';
import { mountLocalRewardCosmeticPreview } from '../../game/studio/reward-cosmetic-preview.mjs';
import { createDiscoveryEditor } from '../../game/studio/discovery-editor.mjs';
import { createRewardPrintPreview } from '../../game/studio/reward-print-preview.mjs';
import { mountDiscoveryExploration } from '../../game/ui/discovery-exploration.mjs';
import { loadRewardImage } from '../../game/ui/reward-image.mjs';
import { createCompanyOperation } from './operation.mjs';
import { attachCompanyReader } from './reading.mjs';
import { getThemeFamily } from '../../game/presentation/theme-system.mjs';
import { loadThemePreview } from '../../game/presentation/theme-preview.mjs';

const $ = (id) => document.getElementById(id);
const labels = [
  'Identity',
  'Artwork',
  'Actors & atmosphere',
  'Campaigns',
  'Learning & rewards',
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
  localizedText($('status'), message);
  $('status').dataset.error = String(error);
};
const appearanceCopy = (key, values = {}) => t(`tools:studio.appearance.${key}`, values);
const appearanceThemeName = (family) =>
  t(`interface:workshop.theme.${family.id}`, { defaultValue: family.name });
const appearanceError = (key) => {
  const error = new Error(appearanceCopy(key));
  error.localizedMessage = () => appearanceCopy(key);
  return error;
};
const guarded =
  (handler) =>
  async (...args) => {
    try {
      await handler(...args);
    } catch (error) {
      if (error.name === 'AbortError') return;
      status(error.localizedMessage ?? error.message, true);
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
  lastExport = null,
  pendingAppearanceCandidate = null;
const editorBuffers = new Map();
let rewardPreviewExplorations = [];
function disposeRewardPreviews() {
  rewardPreviewExplorations.forEach((viewer) => viewer.dispose());
  rewardPreviewExplorations = [];
}
const selected = () => studioSelection(catalog, editionId);
const selectedCampaign = () => catalog.campaigns.find((campaign) => campaign.id === campaignId);
const lessonEditor = createLessonEditor({
  container: $('lesson-editor'),
  getCampaign: selectedCampaign,
  getProject: () => files.get(selectedCampaign().sourcePath),
  getLessons: () => $('learning-json').value,
  setLessons(value) {
    $('learning-json').value = format(value);
    $('learning-json').oninput?.();
  },
  getLocale,
});
const discoveryEditor = createDiscoveryEditor({
  document,
  getCosmeticSource: () => ({ catalog, editionId, files }),
  getSource: () => files.get(selectedCampaign().sourcePath),
  getMission: () =>
    files
      .get(selectedCampaign().sourcePath)
      ?.missions.find((item) => item.id === $('discovery-mission').value),
  getRewards: () => files.get(selectedCampaign().rewardPath) ?? [],
  applyRewards: async (candidate) => {
    const campaign = selectedCampaign(),
      previousCatalog = catalog,
      previousFiles = files,
      nextFiles = new Map(files),
      nextCatalog = structuredClone(catalog);
    for (const path of [campaign.sourcePath, campaign.rewardPath, campaign.localizationPath].filter(
      Boolean,
    ))
      if (editorBuffers.has(path))
        throw new Error('Apply or discard pending campaign, reward and language edits first.');
    if (!campaign.rewardPath) throw new Error('Add an explicit reward sidecar first.');
    nextFiles.set(campaign.sourcePath, candidate.source);
    nextFiles.set(campaign.rewardPath, candidate.rewards);
    if (campaign.localizationPath) {
      const localized = await rebindStudioRewardLocalization({
        localization: files.get(campaign.localizationPath),
        source: candidate.source,
        descriptor: campaign,
      });
      nextFiles.set(campaign.localizationPath, localized.localization);
      nextCatalog.campaigns.find((row) => row.id === campaign.id).localizationSha256 =
        localized.sha256;
    }
    for (const edition of nextCatalog.editions.filter((row) =>
      row.campaignIds.includes(campaign.id),
    ))
      edition.revision++;
    const checkedCatalog = validateEditionRuntimeCatalog(nextCatalog);
    validateStudioData(campaign.sourcePath, candidate.source, checkedCatalog, nextFiles);
    validateStudioData(campaign.rewardPath, candidate.rewards, checkedCatalog, nextFiles);
    if (
      catalog !== previousCatalog ||
      files !== previousFiles ||
      selectedCampaign().id !== campaign.id
    )
      throw new Error('The authoring context changed. Review the atlas again before applying it.');
    files = nextFiles;
    catalog = checkedCatalog;
    changed(
      'Applied a new discovery revision. Review its explicit reward requirements; gameplay is unchanged.',
    );
    renderCatalog();
    await renderDocuments();
    return true;
  },
  apply: async (candidate) => {
    const campaign = selectedCampaign(),
      previousCatalog = catalog,
      previousFiles = files,
      previousRevision = revision,
      previousLoadGeneration = loadGeneration,
      previousEditionId = editionId,
      nextFiles = new Map(files),
      nextCatalog = structuredClone(catalog),
      path = campaign.sourcePath;
    const changedPaths = ['catalog', path, campaign.localizationPath].filter(Boolean);
    for (const file of changedPaths)
      if (editorBuffers.has(file))
        throw new Error(
          'Apply or discard pending campaign and language JSON before editing discovery design.',
        );
    nextFiles.set(path, candidate);
    if (campaign.localizationPath) {
      const rebound = await rebindStudioRewardLocalization({
        localization: files.get(campaign.localizationPath),
        source: candidate,
        descriptor: campaign,
      });
      nextFiles.set(campaign.localizationPath, rebound.localization);
      nextCatalog.campaigns.find((item) => item.id === campaign.id).localizationSha256 =
        rebound.sha256;
    }
    for (const edition of nextCatalog.editions.filter((item) =>
      item.campaignIds.includes(campaign.id),
    ))
      edition.revision++;
    const checked = validateEditionRuntimeCatalog(nextCatalog);
    validateStudioData(path, candidate, checked, nextFiles);
    if (
      catalog !== previousCatalog ||
      files !== previousFiles ||
      revision !== previousRevision ||
      loadGeneration !== previousLoadGeneration ||
      editionId !== previousEditionId ||
      changedPaths.some((file) => editorBuffers.has(file)) ||
      selectedCampaign().id !== campaign.id
    )
      throw new Error('The authoring context changed. Review discovery design before applying it.');
    files = nextFiles;
    catalog = checked;
    $('campaign-json').value = format(candidate);
    changed(
      'Applied discovery design. Export the project and reward sidecar together in the source draft.',
    );
    renderCatalog();
    return true;
  },
});
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
  renderAppearanceDefaults(brand);
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
function renderAppearanceDefaults(brand) {
  let panel = $('community-appearance-defaults');
  if (!panel) {
    panel = node('section', undefined, 'panel');
    panel.id = 'community-appearance-defaults';
    panel.setAttribute('aria-labelledby', 'community-appearance-heading');
    panel.setAttribute('aria-describedby', 'community-appearance-help');
    $('theme-path').parentElement.before(panel);
  }
  const heading = node('h3'),
    help = node('p');
  heading.id = 'community-appearance-heading';
  help.id = 'community-appearance-help';
  localizedText(heading, () => appearanceCopy('title'));
  localizedText(help, () => appearanceCopy('help'));
  panel.replaceChildren(heading, help);
  const availableThemes = [...listStudioAppearanceThemes(catalog)];
  if (
    pendingAppearanceCandidate &&
    !availableThemes.some(
      (family) =>
        family.id === pendingAppearanceCandidate.family.id &&
        family.revision === pendingAppearanceCandidate.family.revision,
    )
  )
    availableThemes.push(pendingAppearanceCandidate.family);
  if (pendingAppearanceCandidate) {
    const note = node('p', undefined, 'note'),
      candidate = pendingAppearanceCandidate,
      included = !!findStudioAppearanceTheme(
        catalog,
        candidate.family.id,
        candidate.family.revision,
      );
    note.id = 'community-appearance-candidate';
    localizedText(note, () =>
      appearanceCopy(included ? 'candidateIncluded' : 'candidateScope', {
        name: candidate.family.name,
        revision: candidate.family.revision,
        arcade: candidate.family.arcade
          ? `${candidate.family.arcade.id}@${candidate.family.arcade.revision}`
          : appearanceCopy('authored'),
        sim: candidate.family.sim
          ? `${candidate.family.sim.id}@${candidate.family.sim.revision}`
          : appearanceCopy('authored'),
      }),
    );
    panel.append(note);
  }
  for (const [scope, owner] of [
    ['community', brand],
    ['campaign', selectedCampaign()],
  ]) {
    const row = node('div', undefined, 'button-row'),
      label = node('label'),
      caption = node('span'),
      select = node('select');
    localizedText(caption, () => appearanceCopy(`${scope}.label`, { name: owner.name }));
    caption.id = `appearance-label-${scope}`;
    label.append(caption);
    select.id = `appearance-default-${scope}`;
    select.setAttribute('aria-labelledby', caption.id);
    const inherited = node('option');
    localizedText(inherited, () => appearanceCopy(`${scope}.inherit`));
    inherited.value = '';
    select.append(inherited);
    for (const family of availableThemes) {
      const option = node('option');
      localizedText(option, () =>
        appearanceCopy('retained', {
          name: appearanceThemeName(family),
          revision: family.revision,
        }),
      );
      option.value = `${family.id}@${family.revision}`;
      select.append(option);
    }
    if (owner.appearanceDefault) {
      const pin = owner.appearanceDefault,
        value = `${pin.familyId}@${pin.revision}`;
      if (![...select.options].some((option) => option.value === value)) {
        const retained = findStudioAppearanceTheme(catalog, pin.familyId, pin.revision),
          option = node('option');
        localizedText(option, () =>
          retained
            ? appearanceCopy('retained', {
                name: appearanceThemeName(retained),
                revision: pin.revision,
              })
            : appearanceCopy('unavailable', { name: pin.familyId, revision: pin.revision }),
        );
        option.value = value;
        select.append(option);
      }
      select.value = value;
    }
    label.append(select);
    const apply = node('button');
    localizedText(apply, () => appearanceCopy(`${scope}.apply`));
    apply.type = 'button';
    apply.id = `apply-appearance-${scope}`;
    apply.onclick = guarded(async () => {
      if (editorBuffers.has('catalog')) throw appearanceError('pendingCatalog');
      const [familyId, revision] = select.value.split('@');
      const appearanceDefault = familyId ? { familyId, revision } : null;
      const candidate =
        pendingAppearanceCandidate?.family.id === familyId &&
        pendingAppearanceCandidate.family.revision === revision
          ? pendingAppearanceCandidate
          : null;
      if (
        appearanceDefault &&
        !candidate &&
        !findStudioAppearanceTheme(catalog, familyId, revision)
      )
        throw appearanceError('chooseAvailable');
      const source = candidate ? withStudioAppearanceTheme(catalog, candidate) : catalog;
      const next = withStudioAppearanceDefault(source, { scope, id: owner.id, appearanceDefault });
      catalog = next;
      changed(() => appearanceCopy(`${scope}.applied`));
      renderCatalog();
      $(apply.id)?.focus({ preventScroll: true });
    });
    row.append(label, apply);
    panel.append(row);
  }
}
async function renderDocuments() {
  disposeRewardPreviews();
  const ticket = ++loadGeneration,
    { edition } = selected(),
    campaign = selectedCampaign();
  const paths = [
    edition.boot?.themes,
    edition.boot?.presets,
    campaign.sourcePath,
    ...(campaign.lessonPath ? [campaign.lessonPath] : []),
    ...(campaign.rewardPath ? [campaign.rewardPath] : []),
    ...(campaign.localizationPath ? [campaign.localizationPath] : []),
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
    ['rewards', campaign.rewardPath],
    ['localization', campaign.localizationPath],
  ]) {
    $(`${key}-path`).textContent =
      path ??
      (key === 'rewards'
        ? 'This campaign has no reward sidecar yet.'
        : 'This adventure campaign has no lesson file.');
    $(`${key}-json`).value = path ? (editorBuffers.get(path) ?? format(files.get(path))) : '';
    $(`${key}-json`).dataset.sourcePath = path ?? '';
    $(`${key}-json`).disabled = !path;
    $(`apply-${key}`).disabled = !path;
  }
  chooseOptions(
    $('campaign-hero-asset'),
    catalog.assets.filter(
      (asset) => campaign.assetIds.includes(asset.id) && /\.(?:png|jpe?g|webp)$/i.test(asset.path),
    ),
    campaign.heroAssetId,
    true,
  );
  renderCampaignHero();
  const project = files.get(campaign.sourcePath);
  chooseOptions(
    $('discovery-mission'),
    project.missions ?? [],
    project.missions.some((item) => item.id === $('discovery-mission').value)
      ? $('discovery-mission').value
      : project.missions[0]?.id,
  );
  discoveryEditor.sync();
  lessonEditor.sync();
  $('create-learning').hidden = !!campaign.lessonPath;
  $('campaign-summary').textContent =
    `${project.missions?.length ?? 0} missions · ${project.maps?.length ?? 0} authored maps. Compiling validates rules; route proof is a separate check.`;
  const lessons = campaign.lessonPath ? files.get(campaign.lessonPath) : [];
  $('learning-summary').textContent = Array.isArray(lessons)
    ? `${lessons.length} assignments. ${lessons.filter((lesson) => lesson.kind === 'reflection').length} unscored reflections.`
    : 'Apply a bounded lesson array to validate these records.';
  $('create-rewards').hidden = !!campaign.rewardPath;
  $('reward-builder').disabled = !campaign.rewardPath;
  chooseOptions($('reward-mission'), project.missions ?? [], '', 'Choose a mission…');
  $('reward-rule').value = '';
  $('reward-mission').disabled = true;
  $('reward-missions').replaceChildren(
    ...project.missions.map((mission) => {
      const label = node('label');
      const input = node('input');
      input.type = 'checkbox';
      input.value = mission.id;
      label.append(input, node('span', mission.name));
      return label;
    }),
  );
  $('reward-missions').disabled = true;
  $('reward-learning').replaceChildren(
    ...(lessons ?? []).map((lesson) => {
      const label = node('label'),
        input = node('input');
      input.type = 'checkbox';
      input.value = lesson.id;
      label.append(
        input,
        node('span', `${lesson.title} · ${lesson.revision}/${lesson.fixtureRevision}`),
      );
      return label;
    }),
  );
  $('reward-learning').disabled = !lessons?.length;
  $('reward-mastery').replaceChildren(
    ...project.missions.map((mission) => {
      const label = node('label'),
        input = node('input');
      input.type = 'checkbox';
      input.value = mission.id;
      label.append(input, node('span', mission.name));
      return label;
    }),
  );
  const rewards = campaign.rewardPath ? files.get(campaign.rewardPath) : [];
  $('rewards-summary').textContent =
    `${rewards.length} declared rewards. Requirements are explicit; preview grants no progress.`;
  chooseOptions(
    $('reward-preview-select'),
    rewards.map((reward) => ({
      id: reward.id,
      name: reward.locales.en.title,
    })),
    rewards[0]?.id,
  );
  $('preview-reward').disabled = !campaign.rewardPath;
  $('reward-preview').replaceChildren(
    node('p', 'Preview uses synthetic evidence only; it never earns player progress.'),
  );
}
function renderCampaignHero() {
  const campaign = selectedCampaign(),
    image = $('campaign-hero-preview');
  const asset = catalog.assets.find(
    (item) => item.id === $('campaign-hero-asset').value && campaign.assetIds.includes(item.id),
  );
  image.hidden = !asset;
  image.alt = asset
    ? t('tools:studio.campaignArtwork.alt', { name: campaign.name, defaultValue: campaign.name })
    : '';
  if (asset) image.src = new URL(asset.path, rootURL).href;
  else image.removeAttribute('src');
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
    rewards: campaign.rewardPath,
    localization: campaign.localizationPath,
  }[key];
  const data = validateStudioData(path, $(`${key}-json`).value, catalog, files);
  if (key === 'learning') {
    const previous = files.get(path) ?? [];
    validateStudioLessonRevisions(previous, data);
    if (format(previous) !== format(data)) {
      const nextFiles = new Map(files).set(path, data),
        draft = structuredClone(catalog);
      // A lesson edit cannot quietly invalidate an already-pinned reward requirement.
      for (const descriptor of catalog.campaigns.filter((item) => item.rewardPath))
        if (nextFiles.has(descriptor.rewardPath))
          validateStudioData(
            descriptor.rewardPath,
            nextFiles.get(descriptor.rewardPath),
            catalog,
            nextFiles,
          );
      for (const edition of draft.editions.filter((item) => item.campaignIds.includes(campaign.id)))
        edition.revision++;
      catalog = validateEditionRuntimeCatalog(draft);
      renderCatalog();
    }
  }
  if (key === 'localization') {
    const previous = files.get(path);
    if (previous && format(previous) !== format(data) && previous.revision === data.revision)
      throw new Error('Give changed localization a new revision before applying it.');
    const owner = {
      catalog,
      files,
      revision,
      loadGeneration,
      editionId,
      campaignId,
      text: $('localization-json').value,
    };
    const localizationSha256 = await campaignLocalizationSha256(data);
    if (
      catalog !== owner.catalog ||
      files !== owner.files ||
      revision !== owner.revision ||
      loadGeneration !== owner.loadGeneration ||
      editionId !== owner.editionId ||
      campaignId !== owner.campaignId ||
      $('localization-json').value !== owner.text
    )
      throw new Error(
        'The draft changed while localization was being verified. Apply the current edits again.',
      );
    const draft = structuredClone(catalog);
    draft.campaigns.find((item) => item.id === campaign.id).localizationSha256 = localizationSha256;
    for (const edition of draft.editions.filter((item) => item.campaignIds.includes(campaign.id)))
      edition.revision++;
    catalog = validateEditionRuntimeCatalog(draft);
    renderCatalog();
  }
  files.set(path, data);
  editorBuffers.delete(path);
  changed(`Applied and validated ${path}. Compile the draft to review it in the whole game.`);
  await renderDocuments();
}
async function createRewardSidecar() {
  const campaign = selectedCampaign();
  if (campaign.rewardPath) return;
  const path = campaign.sourcePath.replace(/\.json$/, '.rewards.json');
  if (declaredJSONPaths(catalog).includes(path))
    throw new Error('This reward path is already declared.');
  const draft = structuredClone(catalog);
  draft.campaigns.find((entry) => entry.id === campaign.id).rewardPath = path;
  const checked = validateEditionRuntimeCatalog(draft);
  // Publish catalog and source together only after the catalog is valid.
  files.set(path, []);
  await applyCatalog(
    checked,
    'Empty reward sidecar added. Choose a completion rule and author its reward before export.',
  );
}
async function createLessonSidecar() {
  if (editorBuffers.has('catalog'))
    throw new Error('Apply or discard pending catalog JSON before adding lessons.');
  const next = createStudioLessonSidecar(catalog, selectedCampaign().id);
  files.set(next.path, next.lessons);
  await applyCatalog(
    next.catalog,
    'Lesson sidecar added. Author the objective, evidence, decisions and sources, then apply the lesson draft.',
  );
}
function addRewardDraft() {
  const campaign = selectedCampaign();
  if (!campaign.rewardPath) throw new Error('Add a reward sidecar first.');
  const rewards = validateStudioData(campaign.rewardPath, $('rewards-json').value, catalog, files);
  let ordinal = rewards.length + 1;
  while (rewards.some((reward) => reward.id === `${campaign.id}-reward-${ordinal}`)) ordinal++;
  const reward = createStudioReward({
    campaign,
    source: files.get(campaign.sourcePath),
    rule: $('reward-rule').value,
    missionId: $('reward-mission').value,
    missionIds: [...$('reward-missions').querySelectorAll('input')]
      .filter((item) => item.checked)
      .map((item) => item.value),
    lessons: campaign.lessonPath ? files.get(campaign.lessonPath) : [],
    masteryMissionIds: [...$('reward-mastery').querySelectorAll('input')]
      .filter((item) => item.checked)
      .map((item) => item.value),
    learningIds: [...$('reward-learning').querySelectorAll('input')]
      .filter((item) => item.checked)
      .map((item) => item.value),
    id: `${campaign.id}-reward-${ordinal}`,
    locales: Object.fromEntries(
      ['en', 'uk'].map((locale) => [
        locale,
        {
          title: $(`reward-title-${locale}`).value.trim(),
          teaser: $(`reward-teaser-${locale}`).value.trim(),
          paragraph: $(`reward-paragraph-${locale}`).value.trim(),
        },
      ]),
    ),
  });
  const next = [...rewards, reward];
  const text = format(next);
  $('rewards-json').value = text;
  editorBuffers.set(campaign.rewardPath, text);
  changed(
    'Reward added to JSON draft. Review its explicit requirements and sources, then validate and apply.',
  );
  chooseOptions(
    $('reward-preview-select'),
    next.map((item) => ({ id: item.id, name: item.locales.en.title })),
    reward.id,
  );
}
function previewRewardDraft() {
  disposeRewardPreviews();
  const campaign = selectedCampaign();
  const rewards = validateStudioData(campaign.rewardPath, $('rewards-json').value, catalog, files);
  const reward = rewards.find((item) => item.id === $('reward-preview-select').value) ?? rewards[0];
  if (!reward) throw new Error('Author a reward before previewing it.');
  chooseOptions(
    $('reward-preview-select'),
    rewards.map((item) => ({ id: item.id, name: item.locales.en.title })),
    reward.id,
  );
  const progress = previewStudioReward(reward, {
    edition: selected().edition,
    state: $('reward-preview-state').value,
  });
  const locale = $('reward-preview-locale').value;
  const panel = $('reward-preview');
  const previewText = (key, values = {}) =>
    t(`interface:completionRewards.${key}`, { ...values, lng: locale });
  const resourceLink = (label, url) => {
    const link = node('a', label);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  };
  panel.replaceChildren(
    node('h3', reward.locales[locale].title),
    node('p', reward.locales[locale].teaser),
    node(
      'strong',
      `${progress.completed}/${progress.total} requirements · ${progress.eligible ? 'Eligible preview' : 'Locked preview'}`,
    ),
    node('p', `Missing missions: ${progress.missingMissionIds.join(', ') || 'None'}`),
    node(
      'p',
      t('tools:studio.discovery.missingLearning', {
        lessons:
          progress.learning
            .filter((item) => !item.complete)
            .map((item) => item.lessonId)
            .join(', ') || '—',
        lng: locale,
      }),
    ),
  );
  if (progress.eligible) {
    const printStatus = node('p');
    printStatus.setAttribute('role', 'status');
    const printPreview = createRewardPrintPreview({
      document,
      getReward: () => reward,
      getLocale: () => locale,
      onSaved() {
        printStatus.textContent = t('tools:studio.discovery.printPreviewSaved', { lng: locale });
      },
      onError(error) {
        printStatus.textContent = error.message;
      },
    });
    rewardPreviewExplorations.push(printPreview);
    panel.append(printPreview.button, printStatus);
    for (const item of rewardPresentationItems(reward)) {
      const payload = item.kind === 'audio-group' ? item.group : item.payload;
      panel.append(node('h4', payload.locales[locale].title));
      if (payload.type === 'knowledge') {
        rewardPreviewExplorations.push(mountRewardKnowledge({ container: panel, payload, locale }));
      } else if (payload.type === 'image') {
        const asset = catalog.assets.find(
          (item) => item.id === payload.asset.assetId && item.sha256 === payload.asset.sha256,
        );
        if (asset) {
          const image = node('img');
          image.src = new URL(asset.path, rootURL).href;
          image.alt = payload.locales[locale].alt;
          image.loading = 'lazy';
          panel.append(image);
        }
      } else if (payload.type === 'cosmetic') {
        rewardPreviewExplorations.push(
          mountLocalRewardCosmeticPreview({
            container: panel,
            payload,
            locale,
            context: discoveryCosmeticContext({ catalog, editionId, files }),
          }),
        );
      } else if (item.kind === 'audio-group' || ['audio', 'video'].includes(payload.type)) {
        const section = node('section');
        panel.append(section);
        const audioOwner = acquireStudioRewardAudio(document);
        const mount = item.kind === 'audio-group' ? mountRewardAudioGroup : mountRewardMedia;
        const viewer = mount({
          container: section,
          ...(item.kind === 'audio-group'
            ? { group: item.group, payloads: item.payloads }
            : { payload }),
          locale,
          audioMaster: audioOwner.master,
          musicDucker: { acquire: () => () => {} },
          provider: {
            editionId,
            rootURL,
            catalog,
            currentCatalog: catalog,
            bootstrap: { catalog, selection: selected() },
          },
        });
        rewardPreviewExplorations.push({
          dispose() {
            viewer.dispose();
            audioOwner.release();
          },
        });
      } else if (payload.type === 'exploration') {
        const section = node('section');
        panel.append(section);
        const urls = new Set(),
          provider = {
            editionId,
            rootURL,
            catalog,
            currentCatalog: catalog,
            bootstrap: { catalog, selection: selected() },
          };
        let closed = false;
        const viewer = mountDiscoveryExploration({
          container: section,
          payload,
          locale,
          loadImage: (image, container, { signal }) =>
            loadRewardImage({
              container,
              image,
              locale,
              provider,
              signal,
              urls,
              isCurrent: () => !closed,
              missingLabel: previewText('missingMedia'),
            }),
        });
        rewardPreviewExplorations.push({
          dispose() {
            closed = true;
            viewer.dispose();
            urls.forEach((url) => URL.revokeObjectURL(url));
            urls.clear();
          },
        });
      } else if (payload.type === 'url') {
        panel.append(
          node('p', payload.url),
          resourceLink(previewText('openResource'), payload.url),
        );
        if (payload.qr)
          rewardPreviewExplorations.push(mountRewardQr({ container: panel, payload, locale }));
      } else if (payload.type === 'public-code') {
        panel.append(
          node('p', payload.issuer),
          node('code', payload.code),
          node('p', payload.locales[locale].terms),
        );
        if (payload.expiresOn)
          panel.append(node('p', previewText('expires', { date: payload.expiresOn })));
        if (payload.termsUrl) panel.append(resourceLink(previewText('terms'), payload.termsUrl));
        panel.append(node('p', previewText('publicCode')));
      } else
        panel.append(
          node('p', `Payload: ${payload.type}. Review its full fields in the JSON draft.`),
        );
    }
  }
  panel.append(
    node(
      'p',
      'Synthetic preview only. Nothing was added to a player profile or reward collection.',
    ),
  );
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
    ...(report.summary.rewards === undefined ? [] : [['rewards', 'Rewards']]),
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
        ...(campaign.rewardPath ? [campaign.rewardPath] : []),
        ...(campaign.localizationPath ? [campaign.localizationPath] : []),
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
    // A departed or superseded verification no longer owns any visible status.
    if (previewController !== controller) return;
    if (controller.signal.aborted)
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
  const appearanceRequest = new URL(location.href).searchParams;
  let appearanceHandoffFailed = false;
  if (appearanceRequest.has('appearanceCandidate')) {
    try {
      pendingAppearanceCandidate = loadThemePreview(
        window.sessionStorage,
        appearanceRequest.get('appearanceCandidate'),
      );
    } catch {
      appearanceHandoffFailed = true;
    }
  }
  renderCatalog();
  await renderDocuments();
  status('Registered source loaded. Choose a step to shape the next edition.');
  const requestedFamily =
    pendingAppearanceCandidate?.family ??
    getThemeFamily(
      appearanceRequest.get('appearanceFamily'),
      appearanceRequest.get('appearanceRevision') ?? undefined,
    );
  if (requestedFamily) {
    for (const scope of ['community', 'campaign'])
      $(`appearance-default-${scope}`).value = `${requestedFamily.id}@${requestedFamily.revision}`;
    status(() => appearanceCopy('review', { name: appearanceThemeName(requestedFamily) }));
  } else if (appearanceHandoffFailed) status(() => appearanceCopy('handoffUnavailable'), true);
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
  $('campaign-hero-asset').onchange = renderCampaignHero;
  $('campaign-art-form').onsubmit = guarded(async (event) => {
    event.preventDefault();
    if (editorBuffers.has('catalog'))
      throw new Error('Apply or discard pending catalog JSON before assigning campaign artwork.');
    await applyCatalog(
      withStudioCampaignHero(catalog, selectedCampaign().id, $('campaign-hero-asset').value),
      t('tools:studio.campaignArtwork.applied'),
    );
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
  for (const key of ['theme', 'presets', 'campaign', 'learning', 'rewards', 'localization'])
    $(`${key}-json`).oninput = () => {
      missionReview?.invalidate();
      previewController?.abort();
      const editor = $(`${key}-json`);
      if (editor.dataset.sourcePath) editorBuffers.set(editor.dataset.sourcePath, editor.value);
      $('draft-state').textContent = 'Unapplied JSON edits';
    };
  for (const key of ['theme', 'presets', 'campaign', 'learning', 'rewards', 'localization'])
    $(`apply-${key}`).onclick = guarded(() => applyFile(key));
  $('preview-localization').onclick = guarded(() => {
    const campaign = selectedCampaign();
    if (!campaign.localizationPath) return;
    const data = validateStudioData(
      campaign.localizationPath,
      $('localization-json').value,
      catalog,
      files,
    );
    $('localization-preview').textContent = data.records
      .map((row) =>
        Object.entries(row.fields)
          .map(([field, locales]) => `${row.id} · ${field}\nEN: ${locales.en}\nUK: ${locales.uk}`)
          .join('\n\n'),
      )
      .join('\n\n');
  });
  $('create-rewards').onclick = guarded(createRewardSidecar);
  $('create-learning').onclick = guarded(createLessonSidecar);
  $('learning-json').onchange = () => lessonEditor.sync();
  window.addEventListener('pagehide', (event) => {
    // Retire ownership before aborting: late success or rejection cannot repaint.
    const pendingPreview = previewController;
    previewController = null;
    pendingPreview?.abort();
    discoveryEditor.suspend();
    if (event.persisted) lessonEditor.suspend();
    else {
      discoveryEditor.dispose();
      lessonEditor.dispose();
    }
  });
  $('add-reward').onclick = guarded(addRewardDraft);
  $('preview-reward').onclick = guarded(previewRewardDraft);
  $('reward-rule').onchange = () => {
    $('reward-mission').disabled = $('reward-rule').value !== 'mission-win';
    $('reward-missions').disabled = $('reward-rule').value !== 'selected-missions';
  };
  $('discovery-mission').onchange = () => discoveryEditor.sync();
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
  showStep(requestedFamily ? 2 : 0);
}
main().catch((error) => {
  status(`Could not open the studio: ${error.message}`, true);
  $('export-draft').disabled = true;
});
