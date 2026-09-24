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
  return file.name.replace(/\.[^.]+$/, '').slice(0, 160) || 'Untitled picture';
}

function messageFor(error) {
  return error?.name === 'AbortError'
    ? 'Preparation cancelled. Generate again when you are ready.'
    : error?.message || 'This picture could not be prepared.';
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
  return `${(bytes / 1048576).toFixed(2)} MiB`;
}

function button(document, label, className = '') {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = label;
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
  if (typeof prepareItem !== 'function') throw new TypeError('prepareItem must be a function.');
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
      media.textContent = item.status === 'error' ? 'Needs attention' : `${index + 1}`;
    }

    const body = document.createElement('div');
    body.className = 'batch-card-body';
    const heading = document.createElement('h3');
    heading.textContent = `${index + 1}. ${item.title}`;
    const titleLabel = document.createElement('label');
    titleLabel.textContent = 'Level title';
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
    result.textContent =
      item.status === 'ready'
        ? item.result.validation
        : item.status === 'preparing'
          ? 'Preparing image and verifying level…'
          : item.status === 'error'
            ? item.error
            : item.status === 'cancelled'
              ? 'Cancelled. This item remains in the draft.'
              : item.included
                ? 'Waiting to generate.'
                : 'Excluded from approval.';
    body.append(heading, titleLabel, filename, result);

    if (item.result?.templateLabel) {
      const template = document.createElement('p');
      template.className = 'muted';
      template.textContent = item.result.templateLabel;
      body.append(template);
    }

    const actions = document.createElement('div');
    actions.className = 'batch-card-actions';
    const up = button(document, 'Move up', 'secondary');
    const down = button(document, 'Move down', 'secondary');
    const regenerate = button(document, 'Regenerate', 'secondary');
    const remove = button(document, 'Remove', 'secondary');
    const includeLabel = document.createElement('label');
    includeLabel.className = 'batch-include';
    const include = document.createElement('input');
    include.type = 'checkbox';
    include.checked = item.included;
    include.disabled = !!running;
    includeLabel.append(include);
    const includeText = document.createElement('span');
    includeText.textContent = 'Include in campaign';
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
    nodes.progressLabel.textContent = running
      ? `Preparing ${Math.min(progress.complete + 1, progress.total)} of ${progress.total}.`
      : items.length
        ? `${items.length} pictures selected; ${included().length} included.`
        : 'No pictures selected.';
    const failed = included().filter((item) => item.status === 'error').length;
    const waiting = included().filter((item) => item.status !== 'ready').length;
    capacity = capacityFor(included());
    nodes.readiness.textContent = ready()
      ? `${included().length} levels passed preparation and are ready for one approval.`
      : failed
        ? `${failed} included item${failed === 1 ? '' : 's'} need attention. Regenerate or exclude them before approval.`
        : `${waiting} included item${waiting === 1 ? '' : 's'} still need generation.`;
    nodes.approve.disabled = !!running || !ready() || !capacity.fits || !approveBatch;
    nodes.approve.title = approveBatch
      ? capacity.fits
        ? ''
        : 'Review and accept an explicit package split before approval.'
      : 'The batch compiler will enable approval after it assembles the reviewed items.';
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

    nodes.capacity.textContent = capacity.fits
      ? `Estimated pack ${mib(capacity.estimatedBytes)} of ${mib(capacity.packageLimitBytes ?? capacity.limitBytes)}; staging needs about ${mib(capacity.stagingBytes)} of ${mib(capacity.limitBytes)} available managed storage.`
      : `This selection estimates ${mib(capacity.estimatedBytes)} for a ${mib(capacity.packageLimitBytes ?? capacity.limitBytes)} pack limit and ${mib(capacity.stagingBytes)} of ${mib(capacity.limitBytes)} managed staging space. Split the campaign or remove pictures before approval.`;
    nodes.capacity.classList.toggle('error', !capacity.fits);
    nodes.split.hidden = capacity.fits || included().length < 2;
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
      nodes.progressLabel.textContent = `${items.length} pictures added. ${ordered.length - maxItems} exceeded the ${maxItems}-item batch limit and were not added.`;
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
    generate,
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
