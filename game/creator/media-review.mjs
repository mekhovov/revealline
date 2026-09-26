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
const MEDIA_BUNDLE_LIMIT_BYTES = 256 * 1024 * 1024;
const MEDIA_BUNDLE_OVERHEAD_BYTES = 1024 * 1024;
const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

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

function button(document, label) {
  const result = document.createElement('button');
  result.type = 'button';
  result.className = 'secondary';
  localizedText(result, label);
  return result;
}

function defaultCapacity(sources, prepared) {
  const selectedBytes = sources.reduce((total, source) => total + source.blob.size, 0);
  const preparedBytes = (prepared?.assets ?? []).reduce(
    (total, asset) => total + asset.blob.size,
    0,
  );
  const estimatedBytes = Math.max(selectedBytes, preparedBytes) + MEDIA_BUNDLE_OVERHEAD_BYTES;
  return Object.freeze({
    estimatedBytes,
    stagingBytes: estimatedBytes * 2,
    limitBytes: MEDIA_BUNDLE_LIMIT_BYTES,
    fits: estimatedBytes <= MEDIA_BUNDLE_LIMIT_BYTES,
    maxPayloadBytes: MEDIA_BUNDLE_LIMIT_BYTES - MEDIA_BUNDLE_OVERHEAD_BYTES,
  });
}

function mib(bytes) {
  return t('common:format.mebibytes', {
    value: formatNumber(bytes / 1048576, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
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
  onSplit = () => {},
  capacityFor = defaultCapacity,
} = {}) {
  if (!document?.createElement || !nodes?.surface || !nodes?.list || !nodes?.status)
    throw new TypeError(t('errors:creator.mediaReviewNodes'));
  let sources = [],
    prepared = null,
    running = null,
    aborter = null,
    dirty = false,
    lastError = null,
    renderURLs = [],
    sequence = 0,
    capacity = defaultCapacity([], null);
  const pairing = new Map(),
    posterTimes = new Map(),
    playbackRanges = new Map();

  const releaseURLs = () => {
    for (const url of renderURLs) revokeObjectURL(url);
    renderURLs = [];
  };
  const snapshot = () => ({
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.kind,
      blob: source.blob,
      included: source.included,
      item: source.item,
    })),
    prepared,
    running: !!running,
    dirty,
    error: lastError,
    ready:
      !!prepared &&
      !dirty &&
      sources.some((source) => source.included) &&
      sources
        .filter((source) => source.included)
        .every((source) => source.item && !source.item.errors.length) &&
      capacity.fits,
    capacity: { ...capacity },
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

  function renderVideo(card, item, images, assets) {
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
            identity: item.assetSha256?.slice(0, 12) ?? t('interface:creator.identityUnavailable'),
          }),
    );
    const pairLabel = document.createElement('label');
    localizedText(pairLabel, () => t('interface:creator.revealPoster'));
    const pair = document.createElement('select');
    const unresolved = item.pairing?.status === 'ambiguous' && !pairing.has(item.assetSha256);
    if (unresolved)
      pair.append(option(document, '', localizedMessage('interface:creator.chooseMatchingImage')));
    pair.append(
      option(document, '__frame__', localizedMessage('interface:creator.captureFrameFromVideo')),
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
    card.append(facts, pairLabel);
    renderPosterCandidates(card, item, item.video, assets);
    renderRange(card, item, item.video);
  }

  function renderSourceCard(source, index, images, assets, controls) {
    const item = source.item;
    const card = document.createElement('article');
    card.className = `creator-media-card${item?.errors.length ? ' creator-media-card-error' : ''}${source.included ? '' : ' creator-media-card-excluded'}`;
    card.dataset.itemId = source.id;
    const heading = document.createElement('h3');
    localizedText(heading, () =>
      t('interface:creator.numberedTitle', { number: index + 1, title: source.name }),
    );
    const identity = document.createElement('p');
    identity.className = 'muted';
    localizedText(identity, () =>
      t('interface:creator.mediaItemIdentity', {
        kind: t(
          source.kind === 'video'
            ? 'interface:creator.videoMediaKind'
            : 'interface:creator.imageMediaKind',
        ),
        identity: item?.assetSha256?.slice(0, 12) ?? t('interface:creator.identityUnavailable'),
      }),
    );
    card.append(heading, identity);

    const poster =
      item?.kind === 'image'
        ? item.poster
        : item?.video?.posterCandidates.find(
            (candidate) => candidate.sha256 === item.video.selectedPosterSha256,
          );
    const posterAsset = poster ? assets.get(poster.sha256) : null;
    if (posterAsset) {
      const image = document.createElement('img');
      image.className = 'creator-media-poster';
      const url = createObjectURL(posterAsset.blob);
      renderURLs.push(url);
      image.src = url;
      image.alt = source.name;
      card.append(image);
    }

    if (source.kind === 'video' && item) renderVideo(card, item, images, assets);
    const result = document.createElement('p');
    result.setAttribute('role', 'status');
    if (item?.errors.length) {
      result.className = 'error';
      result.textContent = item.errors.map((error) => error.message).join(' ');
    } else
      localizedText(result, () =>
        !source.included
          ? t('interface:creator.excludedFromApproval')
          : item
            ? source.kind === 'video'
              ? t('interface:creator.videoStoryReady')
              : t('interface:creator.imageLevelMediaReady')
            : t('interface:creator.waitingForMediaInspection'),
      );
    card.append(result);

    const actions = document.createElement('div');
    actions.className = 'batch-card-actions';
    const up = button(document, localizedMessage('common:controls.moveUp'));
    const down = button(document, localizedMessage('common:controls.moveDown'));
    const includeLabel = document.createElement('label');
    includeLabel.className = 'batch-include';
    const include = document.createElement('input');
    include.type = 'checkbox';
    include.checked = source.included;
    include.disabled = !!running;
    const includeText = document.createElement('span');
    localizedText(includeText, () => t('interface:creator.includeInCampaign'));
    includeLabel.append(include, includeText);
    up.disabled = !!running || index === 0;
    down.disabled = !!running || index === sources.length - 1;
    up.dataset.itemId = down.dataset.itemId = include.dataset.itemId = source.id;
    up.dataset.mediaAction = 'up';
    down.dataset.mediaAction = 'down';
    include.dataset.mediaAction = 'include';
    controls.set(`${source.id}:up`, up);
    controls.set(`${source.id}:down`, down);
    controls.set(`${source.id}:include`, include);
    up.onclick = () => move(source.id, -1);
    down.onclick = () => move(source.id, 1);
    include.onchange = () => setIncluded(source.id, include.checked);
    actions.append(up, down, includeLabel);
    card.append(actions);
    return card;
  }

  function render() {
    const previous = {
      itemId: document.activeElement?.dataset?.itemId,
      action: document.activeElement?.dataset?.mediaAction,
    };
    releaseURLs();
    nodes.surface.hidden = !sources.length;
    const items = sources.map((source) => source.item).filter(Boolean);
    const images = items.filter((item) => item.kind === 'image' && item.assetSha256);
    const assets = new Map((prepared?.assets ?? []).map((asset) => [asset.sha256, asset]));
    const controls = new Map();
    nodes.list.replaceChildren(
      ...sources.map((source, index) => renderSourceCard(source, index, images, assets, controls)),
    );
    const included = sources.filter((source) => source.included);
    const videoCount = included.filter((source) => source.kind === 'video').length;
    const imageCount = included.length - videoCount;
    const errors = included.reduce((total, source) => total + (source.item?.errors.length ?? 0), 0);
    capacity = capacityFor(included, dirty ? null : prepared);
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
      nodes.apply.disabled = !!running || !included.length || (!dirty && !!prepared);
      localizedText(nodes.apply, () =>
        t(prepared ? 'interface:creator.applyMediaChoices' : 'interface:creator.inspectMedia'),
      );
    }
    if (nodes.cancel) nodes.cancel.hidden = !running;
    if (nodes.intake) nodes.intake.disabled = !!running;
    if (nodes.removeExcluded)
      nodes.removeExcluded.hidden = !sources.some((source) => !source.included);
    if (nodes.split) {
      nodes.split.hidden = capacity.fits || included.length < 2;
      nodes.split.disabled = !!running;
    }
    if (nodes.capacity) {
      localizedText(nodes.capacity, () =>
        capacity.fits
          ? t('interface:creator.mediaCapacityFits', {
              estimate: mib(capacity.estimatedBytes),
              limit: mib(capacity.limitBytes),
              staging: mib(capacity.stagingBytes),
            })
          : t('interface:creator.mediaCapacityExceeded', {
              estimate: mib(capacity.estimatedBytes),
              limit: mib(capacity.limitBytes),
              staging: mib(capacity.stagingBytes),
            }),
      );
      nodes.capacity.classList.toggle('error', !capacity.fits);
    }
    const restore = controls.get(`${previous.itemId}:${previous.action}`);
    if (restore && !restore.disabled) restore.focus();
    notify();
  }

  function setFiles(files) {
    aborter?.abort();
    sources = [...files]
      .map((file, inputIndex) => ({ file, inputIndex, kind: classify(file) }))
      .sort(
        (left, right) =>
          natural.compare(left.file.name, right.file.name) || left.inputIndex - right.inputIndex,
      )
      .map(({ file, kind }) => ({
        id: `media-${++sequence}`,
        name: file.name,
        kind,
        blob: file,
        included: true,
        item: null,
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

  function move(id, delta) {
    if (running) return;
    const from = sources.findIndex((source) => source.id === id);
    const to = Math.max(0, Math.min(sources.length - 1, from + delta));
    if (from < 0 || from === to) return;
    const [source] = sources.splice(from, 1);
    sources.splice(to, 0, source);
    invalidate();
  }

  function setIncluded(id, value) {
    if (running) return;
    const source = sources.find((candidate) => candidate.id === id);
    if (!source || source.included === !!value) return;
    source.included = !!value;
    invalidate();
  }

  function removeExcluded() {
    if (running) return;
    sources = sources.filter((source) => source.included);
    invalidate();
  }

  function split() {
    const included = sources.filter((source) => source.included);
    if (capacity.fits || included.length < 2) return [];
    const limit = capacity.maxPayloadBytes ?? capacity.limitBytes;
    const chunks = [];
    let chunk = [],
      bytes = 0;
    for (const source of included) {
      if (chunk.length && bytes + source.blob.size > limit) {
        chunks.push(chunk);
        chunk = [];
        bytes = 0;
      }
      chunk.push(source);
      bytes += source.blob.size;
    }
    if (chunk.length) chunks.push(chunk);
    onSplit(chunks.map((part) => part.map((source) => source.blob)));
    return chunks;
  }

  async function prepare() {
    const included = sources.filter((source) => source.included);
    if (running || !included.length) return prepared;
    aborter = new AbortController();
    lastError = null;
    const task = prepareIntake(
      included.map(({ name, kind, blob }) => ({ name, kind, blob })),
      {
        signal: aborter.signal,
        preserveOrder: true,
        pairingFor: ({ assetSha256 }) => pairing.get(assetSha256),
        posterTimeFor: ({ video, assetSha256 }) =>
          posterTimes.get(assetSha256) ?? video.durationSeconds * 0.5,
        playbackRangeFor: ({ video, assetSha256 }) =>
          playbackRanges.get(assetSha256) ?? {
            startSeconds: 0,
            endSeconds: video.durationSeconds,
            retainsCompleteOriginal: true,
          },
      },
    );
    running = task;
    render();
    try {
      prepared = await task;
      dirty = false;
      for (const source of sources) if (source.included) source.item = null;
      for (const item of prepared.items) {
        const source =
          included.find(
            (candidate) =>
              !candidate.item && candidate.name === item.name && candidate.kind === item.kind,
          ) ?? included[item.index];
        if (source) source.item = item;
        if (!item.video) continue;
        posterTimes.set(
          item.assetSha256,
          item.video.posterCandidates.find(
            (candidate) => candidate.sha256 === item.video.selectedPosterSha256,
          )?.capture.requestedTime ?? item.video.video.durationSeconds * 0.5,
        );
        playbackRanges.set(item.assetSha256, item.video.playbackRange);
      }
      capacity = capacityFor(included, prepared);
      if (prepared.items.some((item) => item.errors.length) || capacity.fits) onPrepared(prepared);
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
  nodes.removeExcluded && (nodes.removeExcluded.onclick = removeExcluded);
  nodes.split && (nodes.split.onclick = split);
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
    move,
    setIncluded,
    removeExcluded,
    split,
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
