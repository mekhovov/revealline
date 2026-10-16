const DEFAULT_MAX_ITEMS = 50;
const DEFAULT_MANAGED_BYTES = 256 * 1024 * 1024;
const DEFAULT_PACKAGE_BYTES = 24 * 1024 * 1024;

const collator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
  usage: 'sort',
});

export function naturalFileOrder(files) {
  return [...files]
    .map((file, inputIndex) => ({ file, inputIndex }))
    .sort(
      (left, right) =>
        collator.compare(left.file.name, right.file.name) || left.inputIndex - right.inputIndex,
    )
    .map(({ file }) => file);
}

function titleFor(file) {
  return file.name.replace(/\.[^.]+$/, '').slice(0, 160) || t('interface:creator.untitledPicture');
}

function messageFor(error) {
  return error?.name === 'AbortError'
    ? t('interface:creator.preparationCancelled')
    : error?.message || t('interface:creator.picturePreparationFailed');
}

function defaultCapacity(items) {
  const estimatedBytes = items.reduce(
    (total, item) => total + (item.result?.estimatedBytes ?? Math.ceil(item.file.size * 1.15)),
    0,
  );
  const stagingBytes = estimatedBytes * 2;
  const average = Math.max(1, Math.ceil(stagingBytes / Math.max(1, items.length)));
  const averagePackItem = Math.max(1, Math.ceil(estimatedBytes / Math.max(1, items.length)));
  return {
    estimatedBytes,
    stagingBytes,
    limitBytes: DEFAULT_MANAGED_BYTES,
    packageLimitBytes: DEFAULT_PACKAGE_BYTES,
    fits: estimatedBytes <= DEFAULT_PACKAGE_BYTES && stagingBytes <= DEFAULT_MANAGED_BYTES,
    maxItemsPerPack: Math.max(
      1,
      Math.min(
        Math.floor(DEFAULT_PACKAGE_BYTES / averagePackItem),
        Math.floor(DEFAULT_MANAGED_BYTES / average),
      ),
    ),
  };
}

function mib(bytes) {
  return t('common:format.mebibytes', {
    value: formatNumber(bytes / 1048576, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  });
}

function button(document, label, className = '') {
  const control = document.createElement('button');
  control.type = 'button';
  localizedText(control, label);
  control.className = className;
  return control;
}

/**
 * DOM controller for the Phase 2 batch review surface. The preparation and
 * approval functions are deliberately injected: this module owns interaction
 * state while the batch compiler owns projects, hashes and package bytes.
 */
export function createBatchCreatorController({
  document,
  nodes,
  prepareItem,
  approveBatch = null,
  capacityFor = defaultCapacity,
  onChange = () => {},
  onSplit = () => {},
  makeId = (index) => `picture-${index + 1}`,
  createObjectURL = (blob) => URL.createObjectURL(blob),
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
  maxItems = DEFAULT_MAX_ITEMS,
}) {
  if (typeof prepareItem !== 'function')
    throw new TypeError(t('errors:creator.prepareItemFunction'));
  let items = [],
    running = null,
    controller = null,
    renderURLs = [],
    capacity = defaultCapacity([]),
    progress = { complete: 0, total: 0 },
    sequence = 0;

  const settings = () => ({
    collectionName: nodes.collectionName.value.trim(),
    pacing: nodes.pacing.value,
    fit: nodes.fit.value,
    creatorCredit: nodes.creatorCredit?.value ?? '',
    pictureCredit: nodes.pictureCredit?.value ?? '',
    license: nodes.license?.value ?? '',
  });
  const included = () => items.filter((item) => item.included);
  const ready = () => included().length > 0 && included().every((item) => item.status === 'ready');
  const snapshot = () => ({
    items: items.map((item) => ({ ...item })),
    included: included().length,
    ready: ready(),
    running: !!running,
    progress: { ...progress },
    capacity: { ...capacity },
    settings: settings(),
  });

  function notify() {
    onChange(snapshot());
  }

  function releaseURLs() {
    for (const url of renderURLs) revokeObjectURL(url);
    renderURLs = [];
  }

  function focusAfterRender(previous, controls) {
    if (!previous?.itemId || !previous.action) return;
    const exact = controls.get(`${previous.itemId}:${previous.action}`);
    if (exact && !exact.disabled) exact.focus();
  }

  function renderCard(item, index, controls) {
    const card = document.createElement('article');
    card.className = `batch-card batch-card-${item.status}`;
    card.dataset.itemId = item.id;

    const media = document.createElement('div');
    media.className = 'batch-card-media';
    if (item.result?.thumbnail) {
      const image = document.createElement('img');
      const url = createObjectURL(item.result.thumbnail);
      renderURLs.push(url);
      image.src = url;
      image.alt = item.result.alt || '';
      media.append(image);
    } else {
      localizedText(media, () =>
        item.status === 'error' ? t('interface:creator.needsAttention') : formatNumber(index + 1),
      );
    }

    const body = document.createElement('div');
    body.className = 'batch-card-body';
    const heading = document.createElement('h3');
    localizedText(heading, () =>
      t('interface:creator.numberedTitle', { number: index + 1, title: item.title }),
    );
    const titleLabel = document.createElement('label');
    localizedText(titleLabel, () => t('interface:creator.levelTitle'));
    const title = document.createElement('input');
    title.value = item.title;
    title.maxLength = 160;
    title.disabled = !!running;
    title.dataset.itemId = item.id;
    title.dataset.batchAction = 'title';
    title.onchange = () => setTitle(item.id, title.value);
    titleLabel.append(title);
    const filename = document.createElement('p');
    filename.className = 'muted batch-filename';
    filename.textContent = item.file.name;
    const result = document.createElement('p');
    result.className = item.status === 'error' ? 'error' : 'batch-result';
    result.setAttribute('role', 'status');
    localizedText(result, () =>
      item.status === 'ready'
        ? item.result.validation
        : item.status === 'preparing'
          ? t('interface:creator.preparingImageLevel')
          : item.status === 'error'
            ? item.error
            : item.status === 'cancelled'
              ? t('interface:creator.itemCancelled')
              : item.included
                ? t('interface:creator.waitingToGenerate')
                : t('interface:creator.excludedFromApproval'),
    );
    body.append(heading, titleLabel, filename, result);

    if (item.result?.templateLabel) {
      const template = document.createElement('p');
      template.className = 'muted';
      localizedText(template, item.result.templateLabel);
      body.append(template);
    }

    const actions = document.createElement('div');
    actions.className = 'batch-card-actions';
    const up = button(document, localizedMessage('common:controls.moveUp'), 'secondary');
    const down = button(document, localizedMessage('common:controls.moveDown'), 'secondary');
    const regenerate = button(document, localizedMessage('common:actions.regenerate'), 'secondary');
    const remove = button(document, localizedMessage('common:actions.remove'), 'secondary');
    const includeLabel = document.createElement('label');
    includeLabel.className = 'batch-include';
    const include = document.createElement('input');
    include.type = 'checkbox';
    include.checked = item.included;
    include.disabled = !!running;
    includeLabel.append(include);
    const includeText = document.createElement('span');
    localizedText(includeText, () => t('interface:creator.includeInCampaign'));
    includeLabel.append(includeText);
    up.disabled = !!running || index === 0;
    down.disabled = !!running || index === items.length - 1;
    regenerate.disabled = !!running || !item.included;
    remove.disabled = !!running;
    for (const [action, control] of [
      ['title', title],
      ['up', up],
      ['down', down],
      ['regenerate', regenerate],
      ['remove', remove],
      ['include', include],
    ]) {
      control.dataset.itemId = item.id;
      control.dataset.batchAction = action;
      controls.set(`${item.id}:${action}`, control);
    }
    up.onclick = () => move(item.id, -1);
    down.onclick = () => move(item.id, 1);
    regenerate.onclick = () => regenerateItem(item.id);
    remove.onclick = () => removeItem(item.id);
    include.onchange = () => setIncluded(item.id, include.checked);
    actions.append(up, down, regenerate, remove, includeLabel);
    body.append(actions);
    card.append(media, body);
    return card;
  }

  function render() {
    const previous = {
      itemId: document.activeElement?.dataset?.itemId,
      action: document.activeElement?.dataset?.batchAction,
    };
    releaseURLs();
    const controls = new Map();
    nodes.list.replaceChildren(...items.map((item, index) => renderCard(item, index, controls)));
    nodes.surface.hidden = items.length < 2;
    nodes.progress.max = Math.max(1, progress.total);
    nodes.progress.value = progress.complete;
    nodes.progress.hidden = !running;
    localizedText(nodes.progressLabel, () =>
      running
        ? t('interface:creator.preparingProgress', {
            current: Math.min(progress.complete + 1, progress.total),
            total: progress.total,
          })
        : items.length
          ? t('interface:creator.picturesSelected', {
              count: items.length,
              included: included().length,
            })
          : t('interface:creator.noPicturesSelected'),
    );
    const failed = included().filter((item) => item.status === 'error').length;
    const waiting = included().filter((item) => item.status !== 'ready').length;
    capacity = capacityFor(included());
    localizedText(nodes.readiness, () =>
      ready()
        ? t('interface:creator.levelsReady', { count: included().length })
        : failed
          ? t('interface:creator.includedNeedAttention', { count: failed })
          : t('interface:creator.includedNeedGeneration', { count: waiting }),
    );
    nodes.approve.disabled = !!running || !ready() || !capacity.fits || !approveBatch;
    const approvalTitle = approveBatch
      ? capacity.fits
        ? ''
        : t('interface:creator.acceptSplitBeforeApproval')
      : t('interface:creator.compilerEnablesApproval');
    localizedAttribute(nodes.approve, 'title', () =>
      approveBatch
        ? capacity.fits
          ? ''
          : t('interface:creator.acceptSplitBeforeApproval')
        : t('interface:creator.compilerEnablesApproval'),
    );
    nodes.approve.title = approvalTitle;
    nodes.cancel.hidden = !running;
    nodes.generate.disabled =
      !!running || !items.some((item) => item.included && item.status !== 'ready');
    nodes.removeExcluded.hidden = !items.some((item) => !item.included);
    if (items.length > 1)
      for (const control of [
        nodes.intake,
        nodes.collectionName,
        nodes.pacing,
        nodes.fit,
        nodes.creatorCredit,
        nodes.pictureCredit,
        nodes.license,
      ])
        if (control) control.disabled = !!running;

    localizedText(nodes.capacity, () =>
      capacity.fits
        ? t('interface:creator.capacityFits', {
            estimate: mib(capacity.estimatedBytes),
            packageLimit: mib(capacity.packageLimitBytes ?? capacity.limitBytes),
            staging: mib(capacity.stagingBytes),
            storageLimit: mib(capacity.limitBytes),
          })
        : t('interface:creator.capacityExceeded', {
            estimate: mib(capacity.estimatedBytes),
            packageLimit: mib(capacity.packageLimitBytes ?? capacity.limitBytes),
            staging: mib(capacity.stagingBytes),
            storageLimit: mib(capacity.limitBytes),
          }),
    );
    nodes.capacity.classList.toggle('error', !capacity.fits);
    nodes.split.hidden = capacity.fits || included().length < 2;
    nodes.split.disabled = !!running || !ready();
    focusAfterRender(previous, controls);
    notify();
  }

  function resetItem(item) {
    item.status = item.included ? 'queued' : 'excluded';
    item.result = null;
    item.error = '';
  }

  function setFiles(files) {
    cancel();
    const ordered = naturalFileOrder(files);
    items = ordered.slice(0, maxItems).map((file, index) => ({
      id: makeId(sequence++),
      file,
      title: titleFor(file),
      included: true,
      status: 'queued',
      result: null,
      error: '',
      generation: 0,
    }));
    progress = { complete: 0, total: items.length };
    render();
    if (ordered.length > maxItems)
      localizedText(
        nodes.progressLabel,
        localizedMessage('interface:creator.batchLimitExceeded', {
          added: items.length,
          omitted: ordered.length - maxItems,
          limit: maxItems,
        }),
      );
    return snapshot();
  }

  function restore(state) {
    cancel();
    if (!state || !Array.isArray(state.items) || !state.settings)
      throw new TypeError(t('errors:creator.invalidCheckpointRevision'));
    for (const [key, node] of [
      ['collectionName', nodes.collectionName],
      ['pacing', nodes.pacing],
      ['fit', nodes.fit],
      ['creatorCredit', nodes.creatorCredit],
      ['pictureCredit', nodes.pictureCredit],
      ['license', nodes.license],
    ])
      if (node && typeof state.settings[key] === 'string') node.value = state.settings[key];
    items = state.items.slice(0, maxItems).map((item) => ({
      id: item.id,
      file: item.file,
      title: item.title,
      included: !!item.included,
      status: item.included ? item.status : 'excluded',
      result: null,
      error: item.error || '',
      generation: item.generation,
    }));
    progress = { complete: 0, total: items.length };
    sequence = Math.max(sequence, items.length);
    render();
    return snapshot();
  }

  function move(id, delta) {
    if (running) return;
    const from = items.findIndex((item) => item.id === id);
    const to = Math.max(0, Math.min(items.length - 1, from + delta));
    if (from < 0 || from === to) return;
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    render();
  }

  function setIncluded(id, value) {
    if (running) return;
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    item.included = !!value;
    item.status = item.included
      ? item.result
        ? 'ready'
        : item.error
          ? 'error'
          : 'queued'
      : 'excluded';
    render();
  }

  function setTitle(id, value) {
    if (running) return;
    const item = items.find((candidate) => candidate.id === id);
    const title = String(value).trim().slice(0, 160);
    if (!item || !title || item.title === title) return render();
    item.title = title;
    resetItem(item);
    render();
  }

  function removeItem(id) {
    if (running) return;
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    items.splice(index, 1);
    render();
    const target = nodes.list.children[Math.min(index, items.length - 1)];
    target?.querySelector('button:not(:disabled),input:not(:disabled)')?.focus();
  }

  async function prepare(itemsToPrepare) {
    if (running || !itemsToPrepare.length) return;
    controller = new AbortController();
    progress = { complete: 0, total: itemsToPrepare.length };
    const task = (async () => {
      for (const item of itemsToPrepare) {
        if (controller.signal.aborted) break;
        item.status = 'preparing';
        item.error = '';
        render();
        try {
          item.result = await prepareItem(item, {
            signal: controller.signal,
            index: items.indexOf(item),
            total: items.length,
            generation: item.generation,
            settings: settings(),
          });
          item.status = 'ready';
        } catch (error) {
          item.result = null;
          item.error = messageFor(error);
          item.status = error?.name === 'AbortError' ? 'cancelled' : 'error';
          if (error?.name === 'AbortError') break;
        } finally {
          progress.complete++;
          render();
        }
      }
    })();
    running = task;
    render();
    try {
      await task;
    } finally {
      if (running === task) running = null;
      controller = null;
      for (const item of items) if (item.status === 'preparing') item.status = 'cancelled';
      render();
    }
  }

  function generate() {
    return prepare(items.filter((item) => item.included && item.status !== 'ready'));
  }

  function resume(itemIds) {
    const wanted = new Set(itemIds);
    return prepare(
      items.filter((item) => item.included && item.status !== 'ready' && wanted.has(item.id)),
    );
  }

  async function regenerateItem(id) {
    if (running) return;
    const item = items.find((candidate) => candidate.id === id);
    if (!item || !item.included) return;
    item.generation++;
    resetItem(item);
    render();
    await prepare([item]);
  }

  function cancel() {
    controller?.abort();
  }

  function removeExcluded() {
    if (running) return;
    items = items.filter((item) => item.included);
    render();
  }

  function split() {
    if (running || !ready()) return [];
    const selected = included();
    const size = Math.max(1, capacity.maxItemsPerPack);
    const chunks = [];
    for (let index = 0; index < selected.length; index += size)
      chunks.push(selected.slice(index, index + size));
    onSplit(chunks, settings());
    return chunks;
  }

  nodes.generate.onclick = () => generate();
  nodes.cancel.onclick = () => cancel();
  nodes.removeExcluded.onclick = () => removeExcluded();
  nodes.split.onclick = () => split();
  nodes.approve.onclick = async () => {
    if (!approveBatch || !ready() || running) return;
    await approveBatch(included(), settings());
  };
  const invalidateSettings = () => {
    for (const item of items) if (item.included) resetItem(item);
    render();
  };
  nodes.pacing.addEventListener('change', invalidateSettings);
  nodes.fit.addEventListener('change', invalidateSettings);
  for (const control of [
    nodes.collectionName,
    nodes.creatorCredit,
    nodes.pictureCredit,
    nodes.license,
  ])
    control?.addEventListener('input', invalidateSettings);

  render();
  return Object.freeze({
    setFiles,
    restore,
    generate,
    resume,
    cancel,
    move,
    setTitle,
    setIncluded,
    removeItem,
    removeExcluded,
    regenerateItem,
    split,
    snapshot,
    includedResults: () => included().map((item) => ({ item, result: item.result })),
    destroy() {
      cancel();
      releaseURLs();
    },
  });
}
import {
  formatNumber,
  localizedAttribute,
  localizedMessage,
  localizedText,
  t,
} from '../i18n/index.mjs';
