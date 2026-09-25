import { prepareCreatorMediaIntake } from './media-intake.mjs';
import {
  formatNumber,
  localizedAttribute,
  localizedMessage,
  localizedText,
  t,
} from '../i18n/index.mjs';

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);
const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp)$/i;
const VIDEO_EXTENSIONS = /\.(?:mp4|webm)$/i;

function classify(file) {
  if (IMAGE_TYPES.has(file.type) || (!file.type && IMAGE_EXTENSIONS.test(file.name)))
    return 'image';
  if (VIDEO_TYPES.has(file.type) || (!file.type && VIDEO_EXTENSIONS.test(file.name)))
    return 'video';
  throw new TypeError(
    t('errors:creator.unsupportedMediaFile', {
      file: file.name || t('interface:creator.thisFile'),
    }),
  );
}

function option(document, value, label) {
  const item = document.createElement('option');
  item.value = value;
  localizedText(item, label);
  return item;
}

function control(document, type, label) {
  const wrapper = document.createElement('label');
  localizedText(wrapper, label);
  const input = document.createElement('input');
  input.type = type;
  wrapper.append(input);
  return { wrapper, input };
}

function seconds(value) {
  return t('common:format.seconds', {
    value: formatNumber(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  });
}

/**
 * Review controller for mixed creator media. It only records exact choices and
 * produces a prepared media dependency closure. Campaign assembly and approval
 * remain separate so changing any choice can invalidate the enclosing review.
 */
export function createCreatorMediaReviewController({
  document,
  nodes,
  prepareIntake = prepareCreatorMediaIntake,
  createObjectURL = (blob) => URL.createObjectURL(blob),
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
  onPrepared = () => {},
  onChange = () => {},
} = {}) {
  if (!document?.createElement || !nodes?.surface || !nodes?.list || !nodes?.status)
    throw new TypeError(t('errors:creator.mediaReviewNodes'));
  let sources = [],
    prepared = null,
    running = null,
    aborter = null,
    dirty = false,
    lastError = null,
    renderURLs = [];
  const pairing = new Map(),
    posterTimes = new Map(),
    playbackRanges = new Map();

  const releaseURLs = () => {
    for (const url of renderURLs) revokeObjectURL(url);
    renderURLs = [];
  };
  const snapshot = () => ({
    sources: sources.map((source) => ({
      name: source.name,
      kind: source.kind,
      blob: source.blob,
    })),
    prepared,
    running: !!running,
    dirty,
    error: lastError,
    ready:
      !!prepared &&
      !dirty &&
      prepared.items.length > 0 &&
      prepared.items.every((item) => item.errors.length === 0),
    choices: {
      pairing: new Map(pairing),
      posterTimes: new Map(posterTimes),
      playbackRanges: new Map(playbackRanges),
    },
  });
  const notify = () => onChange(snapshot());
  const invalidate = () => {
    dirty = true;
    render();
  };

  function imageLabel(item) {
    return `${item.name} · ${item.assetSha256.slice(0, 10)}`;
  }

  function renderPosterCandidates(card, item, detail, assets) {
    if (!detail?.posterCandidates.length) return;
    const heading = document.createElement('h4');
    localizedText(heading, () => t('interface:creator.posterFrame'));
    const candidates = document.createElement('div');
    candidates.className = 'creator-poster-candidates';
    for (const candidate of detail.posterCandidates) {
      const label = document.createElement('label');
      label.className = 'creator-poster-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `poster-${item.assetSha256}`;
      radio.value = String(candidate.capture.requestedTime);
      radio.checked = candidate.sha256 === detail.selectedPosterSha256;
      radio.disabled = !!running;
      radio.onchange = () => {
        if (!radio.checked) return;
        posterTimes.set(item.assetSha256, candidate.capture.requestedTime);
        invalidate();
      };
      const asset = assets.get(candidate.sha256);
      if (asset) {
        const image = document.createElement('img');
        const url = createObjectURL(asset.blob);
        renderURLs.push(url);
        image.src = url;
        localizedAttribute(image, 'alt', () =>
          t('interface:creator.frameRequestedAt', {
            time: seconds(candidate.capture.requestedTime),
          }),
        );
        label.append(image);
      }
      const text = document.createElement('span');
      localizedText(text, () =>
        t('interface:creator.posterTiming', {
          requested: seconds(candidate.capture.requestedTime),
          playhead: seconds(candidate.capture.playheadTime),
        }),
      );
      label.append(radio, text);
      candidates.append(label);
    }
    const custom = control(
      document,
      'number',
      localizedMessage('interface:creator.captureAnotherTime'),
    );
    custom.input.min = '0';
    custom.input.max = String(detail.video.durationSeconds);
    custom.input.step = '0.01';
    custom.input.value = String(
      posterTimes.get(item.assetSha256) ??
        detail.posterCandidates.find(
          (candidate) => candidate.sha256 === detail.selectedPosterSha256,
        )?.capture.requestedTime ??
        detail.video.durationSeconds * 0.5,
    );
    custom.input.disabled = !!running;
    custom.input.onchange = () => {
      posterTimes.set(item.assetSha256, Number(custom.input.value));
      invalidate();
    };
    card.append(heading, candidates, custom.wrapper);
  }

  function renderRange(card, item, detail) {
    if (!detail) return;
    const fields = document.createElement('div');
    fields.className = 'creator-playback-range';
    const selected = playbackRanges.get(item.assetSha256) ?? detail.playbackRange;
    const start = control(document, 'number', localizedMessage('interface:creator.playbackBegins'));
    const end = control(document, 'number', localizedMessage('interface:creator.playbackEnds'));
    for (const field of [start.input, end.input]) {
      field.min = '0';
      field.max = String(detail.video.durationSeconds);
      field.step = '0.01';
      field.disabled = !!running;
    }
    start.input.value = String(selected.startSeconds);
    end.input.value = String(selected.endSeconds);
    const update = () => {
      playbackRanges.set(item.assetSha256, {
        startSeconds: Number(start.input.value),
        endSeconds: Number(end.input.value),
        retainsCompleteOriginal: true,
      });
      invalidate();
    };
    start.input.onchange = update;
    end.input.onchange = update;
    const note = document.createElement('p');
    note.className = 'muted';
    localizedText(note, () => t('interface:creator.playbackRangeHelp'));
    fields.append(start.wrapper, end.wrapper, note);
    card.append(fields);
  }

  function renderVideo(item, images, assets) {
    const card = document.createElement('article');
    card.className = `creator-media-card${item.errors.length ? ' creator-media-card-error' : ''}`;
    const title = document.createElement('h3');
    title.textContent = item.name;
    const facts = document.createElement('p');
    facts.className = 'muted';
    localizedText(facts, () =>
      item.video
        ? t('interface:creator.videoFacts', {
            width: item.video.video.width,
            height: item.video.video.height,
            duration: seconds(item.video.video.durationSeconds),
          })
        : t('interface:creator.videoIdentity', {
            identity:
              item.assetSha256?.slice(0, 12) ?? t('interface:creator.identityUnavailable'),
          }),
    );
    const pairLabel = document.createElement('label');
    localizedText(pairLabel, () => t('interface:creator.revealPoster'));
    const pair = document.createElement('select');
    const unresolved = item.pairing?.status === 'ambiguous' && !pairing.has(item.assetSha256);
    if (unresolved)
      pair.append(
        option(document, '', localizedMessage('interface:creator.chooseMatchingImage')),
      );
    pair.append(
      option(
        document,
        '__frame__',
        localizedMessage('interface:creator.captureFrameFromVideo'),
      ),
    );
    for (const image of images) pair.append(option(document, image.assetSha256, imageLabel(image)));
    const currentPair = pairing.has(item.assetSha256)
      ? pairing.get(item.assetSha256)
      : (item.video?.selectedPairingAssetSha256 ??
        (item.pairing?.status === 'suggested' ? item.pairing.candidateAssetSha256s[0] : null));
    pair.value = unresolved ? '' : (currentPair ?? '__frame__');
    pair.disabled = !!running;
    pair.onchange = () => {
      if (!pair.value) pairing.delete(item.assetSha256);
      else pairing.set(item.assetSha256, pair.value === '__frame__' ? null : pair.value);
      invalidate();
    };
    pairLabel.append(pair);
    card.append(title, facts, pairLabel);
    if (item.errors.length) {
      const errors = document.createElement('p');
      errors.className = 'error';
      errors.setAttribute('role', 'status');
      errors.textContent = item.errors.map((error) => error.message).join(' ');
      card.append(errors);
    }
    renderPosterCandidates(card, item, item.video, assets);
    renderRange(card, item, item.video);
    return card;
  }

  function render() {
    releaseURLs();
    nodes.surface.hidden = !sources.length;
    const items = prepared?.items ?? [];
    const images = items.filter((item) => item.kind === 'image' && item.assetSha256);
    const assets = new Map((prepared?.assets ?? []).map((asset) => [asset.sha256, asset]));
    nodes.list.replaceChildren(
      ...items
        .filter((item) => item.kind === 'video')
        .map((item) => renderVideo(item, images, assets)),
    );
    const videoCount = sources.filter((source) => source.kind === 'video').length;
    const imageCount = sources.length - videoCount;
    const errors = items.reduce((total, item) => total + item.errors.length, 0);
    localizedText(nodes.status, () =>
      running
        ? t('interface:creator.inspectingMedia')
        : lastError
          ? lastError
          : !prepared
            ? t('interface:creator.mediaSelected', {
                images: t('common:counts.images', { count: imageCount }),
                videos: t('common:counts.videos', { count: videoCount }),
              })
            : dirty
              ? t('interface:creator.mediaChoicesChanged')
              : errors
                ? t('interface:creator.mediaChoicesNeedAttention', { count: errors })
                : videoCount
                  ? t('interface:creator.victoryStoriesVerified', { count: videoCount })
                  : t('interface:creator.imagesVerified', { count: imageCount }),
    );
    if (nodes.apply) {
      nodes.apply.disabled = !!running || !sources.length || (!dirty && !!prepared);
      localizedText(nodes.apply, () =>
        t(
          prepared
            ? 'interface:creator.applyMediaChoices'
            : 'interface:creator.inspectMedia',
        ),
      );
    }
    if (nodes.cancel) nodes.cancel.hidden = !running;
    if (nodes.intake) nodes.intake.disabled = !!running;
    notify();
  }

  function setFiles(files) {
    aborter?.abort();
    sources = [...files].map((file) => ({
      name: file.name,
      kind: classify(file),
      blob: file,
    }));
    prepared = null;
    dirty = true;
    lastError = null;
    pairing.clear();
    posterTimes.clear();
    playbackRanges.clear();
    render();
    return snapshot();
  }

  async function prepare() {
    if (running || !sources.length) return prepared;
    aborter = new AbortController();
    lastError = null;
    const task = prepareIntake(sources, {
      signal: aborter.signal,
      pairingFor: ({ assetSha256 }) => pairing.get(assetSha256),
      posterTimeFor: ({ video, assetSha256 }) =>
        posterTimes.get(assetSha256) ?? video.durationSeconds * 0.5,
      playbackRangeFor: ({ video, assetSha256 }) =>
        playbackRanges.get(assetSha256) ?? {
          startSeconds: 0,
          endSeconds: video.durationSeconds,
          retainsCompleteOriginal: true,
        },
    });
    running = task;
    render();
    try {
      prepared = await task;
      dirty = false;
      for (const item of prepared.items) {
        if (!item.video) continue;
        posterTimes.set(
          item.assetSha256,
          item.video.posterCandidates.find(
            (candidate) => candidate.sha256 === item.video.selectedPosterSha256,
          )?.capture.requestedTime ?? item.video.video.durationSeconds * 0.5,
        );
        playbackRanges.set(item.assetSha256, item.video.playbackRange);
      }
      onPrepared(prepared);
      return prepared;
    } catch (error) {
      lastError =
        error?.name === 'AbortError'
          ? t('interface:creator.mediaInspectionCancelled')
          : error?.message || t('interface:creator.mediaInspectionFailed');
      throw error;
    } finally {
      if (running === task) running = null;
      aborter = null;
      render();
    }
  }

  nodes.apply &&
    (nodes.apply.onclick = () => {
      void prepare().catch(() => {});
    });
  nodes.cancel && (nodes.cancel.onclick = () => aborter?.abort());
  if (nodes.intake) {
    nodes.intake.multiple = true;
    nodes.intake.accept = 'image/png,image/jpeg,image/webp,video/mp4,video/webm';
    nodes.intake.onchange = () => setFiles(nodes.intake.files ?? []);
  }
  if (nodes.drop) {
    nodes.drop.ondragover = (event) => {
      event.preventDefault();
      nodes.drop.classList.add('dragging');
    };
    nodes.drop.ondragleave = () => nodes.drop.classList.remove('dragging');
    nodes.drop.ondrop = (event) => {
      event.preventDefault();
      nodes.drop.classList.remove('dragging');
      if (!running) setFiles(event.dataTransfer?.files ?? []);
    };
  }
  render();
  return Object.freeze({
    setFiles,
    prepare,
    cancel: () => aborter?.abort(),
    snapshot,
    destroy() {
      aborter?.abort();
      releaseURLs();
      if (nodes.intake) nodes.intake.onchange = null;
      if (nodes.drop) {
        nodes.drop.ondragover = null;
        nodes.drop.ondragleave = null;
        nodes.drop.ondrop = null;
      }
    },
  });
}
