import { localizedText, localizedMessage, t } from '../i18n/index.mjs';
import { openVideoPosterSource } from '../video-poster.mjs';
import { downloadCreatorFile } from './download.mjs';
import { createInstalledTeamCampaignStore } from './team-installed.mjs';
import { exportCreatorTeamMediaCampaign, prepareCreatorTeamMediaCampaign } from './team-media.mjs';
import { prepareCreatorTeamPicture } from './team-picture.mjs';
import {
  CREATOR_TEAM_TEMPLATES,
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
} from './team.mjs';

const $ = (id) => document.getElementById(id);
const store = createInstalledTeamCampaignStore();
let controller = null;
let gameplay = null;
let reviewed = null;
let approved = null;
let installationReview = null;
let rows = [];
let busy = false;
const previewURLs = new Set();

const formatBytes = (bytes) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(bytes / 1024 / 1024);

function status(value, error = false) {
  localizedText($('status'), value);
  $('status').classList.toggle('error', error);
}

function releasePreviews() {
  for (const url of previewURLs) URL.revokeObjectURL(url);
  previewURLs.clear();
}

function controls() {
  for (const node of document.querySelectorAll('button, input, select, textarea'))
    node.disabled =
      node.id === 'cancel'
        ? !busy
        : busy ||
          (node.id === 'install'
            ? !approved || !installationReview?.enoughManagedSpace
            : node.id === 'download'
              ? !approved
              : false);
  $('cancel').hidden = !busy;
  $('approve').disabled = busy || !reviewed;
}

function invalidateReview(
  message = localizedMessage('interface:creator.teamStudio.reviewInvalidated'),
) {
  reviewed = null;
  approved = null;
  installationReview = null;
  releasePreviews();
  $('approval-panel').hidden = true;
  $('play').hidden = true;
  controls();
  if (gameplay) status(message);
}

function fail(error) {
  if (error?.name === 'AbortError')
    status(localizedMessage('interface:creator.teamStudio.cancelled'));
  else
    status(
      localizedMessage('interface:creator.teamStudio.failed', { error: error?.message ?? error }),
      true,
    );
}

async function operation(work) {
  if (busy) return;
  busy = true;
  controller = new AbortController();
  controls();
  try {
    await work(controller.signal);
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
    controller = null;
    controls();
  }
}

function input(labelKey, type, attributes = {}) {
  const label = document.createElement('label');
  const caption = document.createElement('span');
  caption.dataset.i18n = labelKey;
  localizedText(caption, () => t(labelKey));
  const node = document.createElement('input');
  node.type = type;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  label.append(caption, node);
  return { label, node };
}

function renderLevels() {
  const host = $('team-levels');
  host.replaceChildren();
  rows = gameplay.pack.levels.map((level, index) => {
    const selection = gameplay.provenance.levels[index];
    const template = CREATOR_TEAM_TEMPLATES.find(({ id }) => id === selection.templateId);
    const card = document.createElement('article');
    card.className = 'team-level-card';
    const heading = document.createElement('h3');
    heading.textContent = level.name;
    const objective = document.createElement('p');
    objective.textContent = template.objective;
    const picture = input('interface:creator.teamStudio.rewardPicture', 'file', {
      accept: 'image/png,image/jpeg,image/webp',
      required: '',
    });
    const fitLabel = document.createElement('label');
    const fitCaption = document.createElement('span');
    localizedText(fitCaption, () => t('interface:creator.pictureFitting'));
    const fit = document.createElement('select');
    for (const [value, key] of [
      ['contain', 'interface:creator.fitWholePicture'],
      ['cover', 'interface:creator.fillBoardCropEdges'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      localizedText(option, () => t(key));
      fit.append(option);
    }
    fitLabel.append(fitCaption, fit);
    const alt = input('interface:pictureDescription', 'text', { maxlength: '512' });
    alt.node.value = level.name;
    const video = input('interface:creator.teamStudio.victoryVideo', 'file', {
      accept: 'video/mp4,video/webm',
    });
    const story = input('interface:creator.teamStudio.storyDescription', 'text', {
      maxlength: '512',
    });
    story.node.value = t('interface:creator.teamStudio.defaultStoryDescription');
    const range = document.createElement('div');
    range.className = 'controls';
    const start = input('interface:creator.teamStudio.startSeconds', 'number', {
      min: '0',
      step: '0.01',
      placeholder: '0',
    });
    const end = input('interface:creator.teamStudio.endSeconds', 'number', {
      min: '0',
      step: '0.01',
    });
    range.append(start.label, end.label);
    const videoHelp = document.createElement('p');
    videoHelp.className = 'muted';
    localizedText(videoHelp, () => t('interface:creator.teamStudio.optionalVideoHelp'));
    card.append(
      heading,
      objective,
      picture.label,
      fitLabel,
      alt.label,
      video.label,
      story.label,
      range,
      videoHelp,
    );
    host.append(card);
    const row = {
      level,
      template,
      card,
      picture: picture.node,
      fit,
      alt: alt.node,
      video: video.node,
      story: story.node,
      start: start.node,
      end: end.node,
    };
    for (const node of [row.picture, row.fit, row.alt, row.video, row.story, row.start, row.end])
      node.addEventListener('change', () => invalidateReview());
    return row;
  });
  $('media-panel').hidden = false;
}

async function generate(signal) {
  invalidateReview();
  gameplay = null;
  $('media-panel').hidden = true;
  const seed = Number($('seed').value);
  status(localizedMessage('interface:creator.teamStudio.verifying'));
  const generated = generateCreatorTeamCampaign({
    id: $('campaign-id').value.trim(),
    name: $('campaign-name').value.trim(),
    seed,
  });
  gameplay = await prepareCreatorTeamCampaign(generated.pack, generated.provenance, { signal });
  renderLevels();
  status(
    localizedMessage('interface:creator.teamStudio.verified', {
      levels: gameplay.pack.levels.length,
      routes: gameplay.evidence.length,
    }),
  );
}

function addAsset(assets, sha256, blob) {
  const previous = assets.get(sha256);
  if (previous && previous.size !== blob.size)
    throw new Error(t('errors:creator.teamStudio.hashCollision'));
  assets.set(sha256, blob);
}

async function review(signal) {
  if (!gameplay) throw new Error(t('errors:creator.teamStudio.generateFirst'));
  invalidateReview(localizedMessage('interface:creator.teamStudio.preparing'));
  const bindings = [];
  const assets = new Map();
  const cards = [];
  for (const [index, row] of rows.entries()) {
    const pictureFile = row.picture.files?.[0];
    if (!pictureFile)
      throw new Error(t('errors:creator.teamStudio.pictureRequired', { level: row.level.name }));
    status(
      localizedMessage('interface:creator.teamStudio.preparingLevel', {
        current: index + 1,
        total: rows.length,
      }),
    );
    const picture = await prepareCreatorTeamPicture(
      pictureFile,
      { alt: row.alt.value, fit: row.fit.value },
      { signal },
    );
    addAsset(assets, picture.sha256, picture.blob);
    const binding = { levelId: row.level.id, pictureSha256: picture.sha256 };
    let videoInfo = null;
    const videoFile = row.video.files?.[0];
    if (videoFile) {
      const inspected = await openVideoPosterSource(videoFile, { signal });
      try {
        videoInfo = inspected.info;
        if (!row.start.value) row.start.value = '0';
        if (!row.end.value) row.end.value = String(videoInfo.durationSeconds);
        binding.story = {
          videoSha256: videoInfo.sha256,
          startSeconds: Number(row.start.value),
          endSeconds: Number(row.end.value),
          description: row.story.value.trim(),
        };
        addAsset(assets, videoInfo.sha256, inspected.original);
      } finally {
        inspected.dispose();
      }
    }
    bindings.push(binding);
    cards.push({ row, picture, videoInfo, binding });
  }
  reviewed = await prepareCreatorTeamMediaCampaign(
    gameplay,
    bindings,
    [...assets].map(([sha256, blob]) => ({ sha256, blob })),
    {
      signal,
      credits: {
        creator: $('creator-credit').value.trim(),
        media: $('media-credit').value.trim(),
        license: $('license').value.trim(),
      },
    },
  );
  installationReview = await store.reviewInstall(reviewed, { signal });
  renderReview(cards, installationReview);
  $('approval-panel').hidden = false;
  status(localizedMessage('interface:creator.teamStudio.reviewReady'));
}

function renderReview(cards, installation) {
  releasePreviews();
  const host = $('review-cards');
  host.replaceChildren();
  for (const { row, picture, videoInfo, binding } of cards) {
    const card = document.createElement('article');
    card.className = 'team-review-card';
    const image = document.createElement('img');
    const url = URL.createObjectURL(picture.blob);
    previewURLs.add(url);
    image.src = url;
    image.alt = picture.alt;
    const heading = document.createElement('h3');
    heading.textContent = row.level.name;
    const detail = document.createElement('p');
    detail.textContent = videoInfo
      ? t('interface:creator.teamStudio.reviewWithVideo', {
          width: picture.width,
          height: picture.height,
          start: binding.story.startSeconds,
          end: binding.story.endSeconds,
          duration: videoInfo.durationSeconds,
        })
      : t('interface:creator.teamStudio.reviewPictureOnly', {
          width: picture.width,
          height: picture.height,
        });
    card.append(image, heading, detail);
    host.append(card);
  }
  localizedText(
    $('package-summary'),
    localizedMessage('interface:creator.teamStudio.packageSummary', {
      size: formatBytes(reviewed.bytes),
      assets: reviewed.manifest.assets.length,
      staging: formatBytes(installation.stagingBytes),
      used: formatBytes(installation.usedBytes),
      limit: formatBytes(installation.limitBytes),
      storage: t(
        installation.enoughManagedSpace
          ? 'interface:creator.teamStudio.storageReady'
          : 'interface:creator.teamStudio.storageFull',
      ),
    }),
  );
}

$('generate').onclick = () => operation(generate);
$('cancel').onclick = () => controller?.abort();
$('review').onclick = () => operation(review);
$('approve').onclick = () => {
  if (!reviewed) return;
  approved = reviewed;
  controls();
  status(localizedMessage('interface:creator.teamStudio.approved'));
};
$('install').onclick = () =>
  operation(async (signal) => {
    const result = await store.install(approved, { signal });
    $('play').hidden = false;
    status(
      localizedMessage(
        result.alreadyInstalled
          ? 'interface:creator.teamStudio.alreadyInstalled'
          : 'interface:creator.teamStudio.installed',
        { edition: result.editionId.slice(0, 12) },
      ),
    );
  });
$('download').onclick = () => {
  if (!approved) return;
  downloadCreatorFile(exportCreatorTeamMediaCampaign(approved), `${approved.pack.id}.rlteammedia`);
};

for (const id of [
  'campaign-name',
  'campaign-id',
  'seed',
  'creator-credit',
  'media-credit',
  'license',
])
  $(id).addEventListener('change', () => {
    if (['campaign-name', 'campaign-id', 'seed'].includes(id)) {
      gameplay = null;
      $('media-panel').hidden = true;
    }
    invalidateReview();
  });

window.addEventListener('beforeunload', releasePreviews);
controls();
