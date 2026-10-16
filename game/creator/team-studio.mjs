import { localizedText, localizedMessage, t } from '../i18n/index.mjs';
import { openVideoPosterSource } from '../video-poster.mjs';
import { downloadCreatorFile } from './download.mjs';
import { createInstalledTeamCampaignStore } from './team-installed.mjs';
import {
  creatorTeamMediaForLevel,
  exportCreatorTeamMediaCampaign,
  prepareCreatorTeamMediaCampaign,
} from './team-media.mjs';
import { creatorAbort } from './bytes.mjs';
import { runCreatorOperation } from './operation.mjs';
import { attachCreatorReviewReading } from './review-reading.mjs';
import { focusCreatorInstalledPlay } from './player-menu-focus.mjs';
import { mountAuthoringInputHost } from '../ui/authoring-input-host.mjs';
import { prepareCreatorTeamPicture } from './team-picture.mjs';
import {
  CREATOR_TEAM_TEMPLATES,
  generateCreatorTeamCampaign,
  prepareCreatorTeamCampaign,
} from './team.mjs';

/** One local owner for Team form work. The shared input host remains the only
 * keyboard/controller router; installed packages retain their verified media. */
export function mountTeamCreatorStudio({
  document,
  window = document.defaultView,
  store = createInstalledTeamCampaignStore(),
  inputHost = mountAuthoringInputHost({ document, window }),
  services = {},
} = {}) {
  const {
    prepareGameplay = prepareCreatorTeamCampaign,
    generateGameplay = generateCreatorTeamCampaign,
    preparePicture = prepareCreatorTeamPicture,
    prepareMedia = prepareCreatorTeamMediaCampaign,
    inspectVideo = openVideoPosterSource,
    mediaForLevel = creatorTeamMediaForLevel,
    exportMedia = exportCreatorTeamMediaCampaign,
    download = downloadCreatorFile,
  } = services;
  const $ = (id) => document.getElementById(id);
  const form = $('team-creator-form');
  let controller = null;
  let gameplay = null;
  let reviewed = null;
  let approved = null;
  let installationReview = null;
  let rows = [];
  let busy = false;
  let destroyed = false;
  const previewURLs = new Set();
  const restoredFields = new Map();
  const publicValue = (node) =>
    restoredFields.get(node) === node.value ? node.value : node.value.trim();

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

  function setupMatches() {
    return (
      gameplay &&
      $('campaign-id').value === gameplay.pack.id &&
      $('campaign-name').value === gameplay.pack.name &&
      Number($('seed').value) === gameplay.provenance.generationSeed
    );
  }

  function controls() {
    for (const node of form.querySelectorAll('button, input, select, textarea'))
      node.disabled = node.id === 'cancel' ? !busy : busy;
    $('cancel').hidden = !busy;
    $('review').disabled = busy || !setupMatches();
    $('approve').disabled = busy || !reviewed;
    $('install').disabled = busy || !approved || !installationReview?.enoughManagedSpace;
    $('download').disabled = busy || !approved;
    for (const row of rows) {
      const retained = row.retained?.picture && !row.picture.files?.[0];
      row.fit.disabled = row.alt.disabled = busy || !!retained;
    }
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
    $('team-play-help').hidden = true;
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

  async function operation(work, opener, { onSuccessFocus = null } = {}) {
    if (busy || destroyed) return;
    return runCreatorOperation(work, {
      document,
      window,
      cancel: $('cancel'),
      opener,
      onStart(value) {
        controller = value;
        busy = true;
        controls();
      },
      onFinish() {
        busy = false;
        controller = null;
        controls();
      },
      onError: fail,
      onSuccessFocus,
    });
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

  function renderLevels(retainedMedia = null) {
    const host = $('team-levels');
    host.replaceChildren();
    rows = gameplay.pack.levels.map((level, index) => {
      const retained = retainedMedia ? mediaForLevel(retainedMedia, level.id) : null;
      const selection = gameplay.provenance.levels[index];
      const template = CREATOR_TEAM_TEMPLATES.find(({ id }) => id === selection.templateId);
      const card = document.createElement('article');
      card.className = 'team-level-card';
      const heading = document.createElement('h3');
      localizedText(heading, () => displayLevelName(level, template));
      const objective = document.createElement('p');
      localizedText(objective, () =>
        t(`interface:creator.teamStudio.templates.${template.id}.objective`),
      );
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
      videoHelp.hidden = !!retained?.story;
      localizedText(videoHelp, () => t('interface:creator.teamStudio.optionalVideoHelp'));
      const retainedHelp = document.createElement('p');
      retainedHelp.className = 'muted';
      retainedHelp.hidden = !retained;
      localizedText(retainedHelp, () => t('interface:creator.teamStudio.retainedMediaHelp'));
      card.append(
        heading,
        retainedHelp,
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
        retained,
        card,
        picture: picture.node,
        fit,
        alt: alt.node,
        video: video.node,
        story: story.node,
        start: start.node,
        end: end.node,
      };
      for (const [name, node] of Object.entries(row))
        if (['picture', 'fit', 'alt', 'video', 'story', 'start', 'end'].includes(name)) {
          node.id = `team-${name}-${index}`;
          node.addEventListener('input', () => invalidateReview());
          node.addEventListener('change', () => invalidateReview());
        }
      if (retained) row.picture.required = false;
      if (retained?.story) {
        row.start.value = String(retained.story.descriptor.startSeconds);
        row.end.value = String(retained.story.descriptor.endSeconds);
        row.story.value = retained.story.descriptor.description;
        restoredFields.set(row.story, row.story.value);
      }
      return row;
    });
    $('media-panel').hidden = false;
  }

  function displayLevelName(level, template) {
    // Serialized template names and provenance remain unchanged.
    return level.name === `${gameplay.pack.name} · ${template.name}`
      ? `${gameplay.pack.name} · ${t(`interface:creator.teamStudio.templates.${template.id}.name`)}`
      : level.name;
  }

  async function generate(signal) {
    const seed = Number($('seed').value);
    status(localizedMessage('interface:creator.teamStudio.verifying'));
    const generated = generateGameplay({
      id: $('campaign-id').value.trim(),
      name: $('campaign-name').value.trim(),
      seed,
    });
    const next = await prepareGameplay(generated.pack, generated.provenance, { signal });
    creatorAbort(signal);
    // Replace the current editable draft only after successful verification.
    invalidateReview();
    gameplay = next;
    restoredFields.clear();
    $('campaign-id').value = gameplay.pack.id;
    $('campaign-name').value = gameplay.pack.name;
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
    if (!setupMatches()) throw new Error(t('errors:creator.teamStudio.generateFirst'));
    invalidateReview(localizedMessage('interface:creator.teamStudio.preparing'));
    const bindings = [];
    const assets = new Map();
    const cards = [];
    for (const [index, row] of rows.entries()) {
      const pictureFile = row.picture.files?.[0];
      if (!pictureFile && !row.retained?.picture)
        throw new Error(t('errors:creator.teamStudio.pictureRequired', { level: row.level.name }));
      status(
        localizedMessage('interface:creator.teamStudio.preparingLevel', {
          current: index + 1,
          total: rows.length,
        }),
      );
      const picture = pictureFile
        ? await preparePicture(pictureFile, { alt: row.alt.value, fit: row.fit.value }, { signal })
        : {
            ...row.retained.picture.descriptor,
            blob: row.retained.picture.blob,
            alt: row.level.name,
          };
      addAsset(assets, picture.sha256, picture.blob);
      const binding = { levelId: row.level.id, pictureSha256: picture.sha256 };
      let videoInfo = null;
      const videoFile = row.video.files?.[0];
      if (videoFile) {
        const inspected = await inspectVideo(videoFile, { signal });
        try {
          videoInfo = inspected.info;
          if (!row.start.value) row.start.value = '0';
          if (!row.end.value) row.end.value = String(videoInfo.durationSeconds);
          binding.story = {
            videoSha256: videoInfo.sha256,
            startSeconds: Number(row.start.value),
            endSeconds: Number(row.end.value),
            description: publicValue(row.story),
          };
          addAsset(assets, videoInfo.sha256, inspected.original);
        } finally {
          inspected.dispose();
        }
      }
      if (!videoFile && row.retained?.story) {
        const saved = row.retained.story;
        videoInfo = saved.descriptor.video;
        binding.story = {
          videoSha256: videoInfo.sha256,
          startSeconds: Number(row.start.value),
          endSeconds: Number(row.end.value),
          description: publicValue(row.story),
        };
        addAsset(assets, videoInfo.sha256, saved.blob);
      }
      bindings.push(binding);
      cards.push({ row, picture, videoInfo, binding });
    }
    const candidate = await prepareMedia(
      gameplay,
      bindings,
      [...assets].map(([sha256, blob]) => ({ sha256, blob })),
      {
        signal,
        credits: {
          creator: publicValue($('creator-credit')),
          media: publicValue($('media-credit')),
          license: publicValue($('license')),
        },
      },
    );
    creatorAbort(signal);
    // Storage availability must not block review, approval or a portable export.
    let installation = null;
    try {
      installation = await store.reviewInstall(candidate, { signal });
    } catch (error) {
      if (signal.aborted || error?.name === 'AbortError') throw error;
    }
    creatorAbort(signal);
    reviewed = candidate;
    installationReview = installation;
    renderReview(cards, installation);
    $('approval-panel').hidden = false;
    status(localizedMessage('interface:creator.teamStudio.reviewReady'));
  }

  function renderReview(cards, installation) {
    const packageSize = formatBytes(reviewed.bytes),
      assetCount = reviewed.manifest.assets.length;
    releasePreviews();
    const host = $('review-cards');
    host.replaceChildren();
    for (const [index, { row, picture, videoInfo, binding }] of cards.entries()) {
      const card = document.createElement('article');
      card.className = 'team-review-card';
      const image = document.createElement('img');
      const url = URL.createObjectURL(picture.blob);
      previewURLs.add(url);
      image.src = url;
      image.alt = picture.alt;
      const heading = document.createElement('h3');
      localizedText(heading, () => displayLevelName(row.level, row.template));
      const detail = document.createElement('p');
      localizedText(detail, () =>
        videoInfo
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
            }),
      );
      attachCreatorReviewReading({
        card,
        heading,
        content: [image, detail],
        index,
        navigation: inputHost.navigation,
      });
      host.append(card);
    }
    if (!installation) {
      localizedText(
        $('package-summary'),
        localizedMessage('interface:creator.teamStudio.portableSummary', {
          size: packageSize,
          assets: assetCount,
        }),
      );
      return;
    }
    localizedText($('package-summary'), () =>
      t('interface:creator.teamStudio.packageSummary', {
        size: packageSize,
        assets: assetCount,
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

  async function refreshInstalled(signal) {
    const inventory = await store.inventory({ signal });
    creatorAbort(signal);
    const host = $('team-installed-list');
    host.replaceChildren();
    for (const edition of inventory.editions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.teamEdition = edition.editionId;
      localizedText(button, () =>
        t('interface:creator.teamStudio.openInstalled', {
          name: edition.pack.name,
          edition: edition.editionId.slice(0, 12),
        }),
      );
      button.onclick = () =>
        operation((signal) => reopenInstalled(edition.editionId, signal), button);
      host.append(button);
    }
    localizedText($('team-installed-status'), () =>
      t(
        inventory.editions.length
          ? 'interface:creator.teamStudio.installedHelp'
          : 'interface:creator.teamStudio.noInstalled',
      ),
    );
  }

  async function reopenInstalled(editionId, signal) {
    const loaded = await store.load(editionId, { signal });
    creatorAbort(signal);
    if (!loaded.media) throw new Error(t('interface:creator.teamStudio.noInstalledMedia'));
    invalidateReview();
    gameplay = loaded.prepared;
    restoredFields.clear();
    $('campaign-id').value = gameplay.pack.id;
    $('campaign-name').value = gameplay.pack.name;
    $('seed').value = String(gameplay.provenance.generationSeed);
    for (const [id, key] of [
      ['creator-credit', 'creator'],
      ['media-credit', 'media'],
      ['license', 'license'],
    ]) {
      $(id).value = loaded.media.manifest.credits[key];
      restoredFields.set($(id), $(id).value);
    }
    renderLevels(loaded.media);
    status(localizedMessage('interface:creator.teamStudio.reopened', { name: gameplay.pack.name }));
  }

  $('generate').onclick = () => operation(generate, $('generate'));
  $('cancel').onclick = () => controller?.abort();
  $('review').onclick = () => operation(review, $('review'));
  $('refresh-installed').onclick = () => operation(refreshInstalled, $('refresh-installed'));
  $('approve').onclick = () => {
    if (!reviewed || busy) return;
    approved = reviewed;
    controls();
    status(localizedMessage('interface:creator.teamStudio.approved'));
  };
  $('install').onclick = () =>
    operation(
      async (signal) => {
        if (!approved) return;
        const result = await store.install(approved, { signal });
        creatorAbort(signal);
        $('play').hidden = false;
        $('team-play-help').hidden = false;
        localizedText(
          $('team-play-help'),
          localizedMessage('interface:creator.teamStudio.playHelp', {
            name: approved.pack.name,
          }),
        );
        status(
          localizedMessage(
            result.alreadyInstalled
              ? 'interface:creator.teamStudio.alreadyInstalled'
              : 'interface:creator.teamStudio.installed',
            { edition: result.editionId.slice(0, 12) },
          ),
        );
      },
      $('install'),
      {
        onSuccessFocus: ({ opener, ownedFocus }) =>
          focusCreatorInstalledPlay({
            document,
            opener,
            ownedFocus,
            play: $('play'),
            wasFocused: true,
          }),
      },
    );
  $('download').onclick = () => {
    if (!approved || busy) return;
    try {
      download(exportMedia(approved), `${approved.pack.id}.rlteammedia`);
    } catch (error) {
      fail(error);
    }
  };

  for (const id of [
    'campaign-name',
    'campaign-id',
    'seed',
    'creator-credit',
    'media-credit',
    'license',
  ])
    for (const type of ['input', 'change']) $(id).addEventListener(type, () => invalidateReview());
  const abort = () => controller?.abort();
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    abort();
    releasePreviews();
    store.close?.();
    window.removeEventListener('pagehide', abort);
    window.removeEventListener('beforeunload', abort);
  };
  window.addEventListener('pagehide', abort);
  window.addEventListener('beforeunload', abort);
  controls();
  return { destroy };
}

if (globalThis.document?.getElementById('team-creator-form'))
  mountTeamCreatorStudio({ document: globalThis.document });
