import {
  loadOptionalCatalog,
  prepareOptionalCatalog,
  verifyOptionalInstalled,
} from '../optional-chapters.mjs';
import { PACK_LIMITS } from '../packs.mjs';

/** Native optional content browser. The host alone owns installation and flight selection. */
export function attachOptionalChaptersPanel({
  document: doc = globalThis.document,
  getLibrary,
  loadCatalog = loadOptionalCatalog,
  install,
  choose,
  onOpen = () => {},
  onClose = () => {},
  onChosen = () => {},
  onRead = ({ region }) => region.focus(),
  onManage = () => {},
} = {}) {
  let catalog = null,
    disposed = false,
    generation = 0,
    pending = null,
    busy = false;
  const node = (tag, id, text = '') => {
    const el = doc.createElement(tag);
    if (id) el.id = `optional-worlds-${id}`;
    el.textContent = text;
    return el;
  };
  const action = (id, label, fn) => {
    const el = node('button', id, label);
    el.type = 'button';
    el.className = 'button secondary';
    el.onclick = fn;
    return el;
  };
  const dialog = node('dialog', 'dialog');
  dialog.className = 'optional-worlds-dialog';
  dialog.setAttribute('aria-labelledby', 'optional-worlds-title');
  const title = node('h2', 'title', 'More worlds'),
    summary = node(
      'p',
      'summary',
      'Four original picture collections over the same three proven Pressure Lines layouts. Separate progress; existing music. Steer continuously, collect contact pickups and watch for warned hunters.',
    ),
    capacity = node('p', 'capacity'),
    cards = node('div', 'cards'),
    status = node('p', 'status');
  summary.tabIndex = 0;
  summary.setAttribute('data-game-reading', '');
  summary.setAttribute('role', 'region');
  summary.setAttribute('aria-label', 'About optional worlds');
  cards.className = 'optional-worlds-cards';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const reload = action('reload', 'Refresh available worlds', () => reloadCatalog()),
    manage = action('manage', 'Manage packs & backups', () => {
      close(false);
      onManage();
    }),
    read = action('read', 'Read about worlds', () =>
      onRead({ region: summary, origin: read, label: 'More worlds' }),
    ),
    cancel = action('cancel', 'Cancel download', cancelPending),
    back = action('back', 'Back to main menu', () => close()),
    topBack = action('top-back', 'Back', () => close()),
    top = node('div'),
    actions = node('div');
  top.className = 'optional-worlds-top';
  topBack.setAttribute('aria-label', 'Back to main menu');
  top.append(title, topBack);
  actions.className = 'optional-worlds-actions';
  actions.append(read, reload, manage, cancel, back);
  dialog.append(top, summary, capacity, cards, status, actions);
  doc.body.append(dialog);
  const rows = new Map(),
    matches = new WeakMap();
  let measuredLibrary = null,
    measuredBytes = 0;
  function installed(item) {
    const pack = getLibrary().packs.find((candidate) => candidate.id === item.id);
    return !!pack && matches.get(pack)?.get(item.normalizedSha256) === true;
  }
  async function inspectInstalled(signal, candidate = catalog) {
    for (const item of candidate.packs) {
      const pack = getLibrary().packs.find((candidate) => candidate.id === item.id);
      if (!pack) continue;
      if (!matches.has(pack)) matches.set(pack, new Map());
      try {
        await verifyOptionalInstalled(pack, item, { signal });
        matches.get(pack).set(item.normalizedSha256, true);
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        matches.get(pack).set(item.normalizedSha256, false);
      }
    }
  }
  function refresh() {
    const library = getLibrary();
    if (library !== measuredLibrary) {
      measuredLibrary = library;
      measuredBytes = new TextEncoder().encode(JSON.stringify(library)).length;
    }
    const bytes = measuredBytes;
    capacity.textContent = `Installed packs: ${(bytes / 1048576).toFixed(1)} / ${PACK_LIMITS.libraryBytes / 1048576} MiB · ${library.packs.length} / ${PACK_LIMITS.installed} packs. Space is shared with your other chapters. Nothing is removed automatically.`;
    for (const [id, row] of rows) {
      const item = catalog.packs.find((entry) => entry.id === id),
        available = installed(item);
      const existing = library.packs.find((pack) => pack.id === id);
      const conflict = existing && matches.get(existing)?.get(item.normalizedSha256) === false;
      row.install.disabled = busy || !!existing;
      row.install.textContent = available
        ? 'Installed on this device'
        : conflict
          ? 'Different edition installed'
          : existing
            ? 'Checking installed edition…'
            : `Install · ${(item.bytes / 1048576).toFixed(1)} MiB`;
      row.choose.disabled = busy || !available;
      row.state.textContent = available
        ? 'Installed · available without another download'
        : conflict
          ? 'This ID contains different artwork/content. Use Manage packs & backups before installing this original.'
          : 'Optional download · choose Install when connected';
    }
    reload.disabled = busy;
    manage.disabled = busy;
    cancel.hidden = !busy;
    dialog.setAttribute('aria-busy', String(busy));
  }
  function render() {
    rows.clear();
    cards.replaceChildren();
    for (const item of catalog.packs) {
      const card = node('section');
      card.className = `optional-world-card world-${item.themeId}`;
      const heading = node('h3', null, item.name),
        detail = node('p', null, `${item.levels} original pictures · separate progress`),
        state = node('p');
      const installButton = action(`install-${item.id}`, 'Install', () => installItem(item)),
        chooseButton = action(`choose-${item.id}`, 'Choose chapter', () => chooseItem(item));
      card.append(heading, detail, state, installButton, chooseButton);
      cards.append(card);
      rows.set(item.id, { install: installButton, choose: chooseButton, state });
    }
    refresh();
  }
  function cancelPending() {
    const wasBusy = busy;
    ++generation;
    pending?.abort();
    pending = null;
    busy = false;
    if (wasBusy)
      status.textContent =
        'Pending download cancelled. Completed installs remain available; your flight is kept.';
    refresh();
  }
  async function run(fn) {
    if (disposed || busy || !dialog.open) return;
    const ticket = ++generation,
      controller = new AbortController();
    pending = controller;
    busy = true;
    refresh();
    const current = () => !disposed && dialog.open && ticket === generation;
    try {
      await fn(controller.signal, current);
    } catch (error) {
      if (current())
        status.textContent =
          error?.name === 'AbortError'
            ? 'Download cancelled. Your installed chapters are kept.'
            : `${error.message || error} Nothing was removed. Use Refresh or Install to retry.`;
    } finally {
      if (current()) {
        pending = null;
        busy = false;
        refresh();
      }
    }
  }
  async function reloadCatalog() {
    return run(async (signal, current) => {
      status.textContent = 'Reading the optional chapter list…';
      const next = prepareOptionalCatalog(await loadCatalog({ signal }));
      if (!current()) return;
      await inspectInstalled(signal, next);
      if (!current()) return;
      catalog = next;
      render();
      status.textContent =
        'Choose a world to install. Installation keeps your current flight; Choose chapter changes the selected mission.';
    });
  }
  async function installItem(item) {
    await run(async (signal, current) => {
      status.textContent = `Downloading and checking ${item.name}…`;
      await install(item, { signal });
      await inspectInstalled(signal);
      if (current()) {
        refresh();
        status.textContent = `${item.name} installed. Your paused flight is kept. Choose chapter when ready to change missions.`;
      }
    });
    if (dialog.open && !busy && installed(item)) rows.get(item.id)?.choose.focus();
  }
  async function chooseItem(item) {
    if (busy || disposed || !installed(item)) return;
    const ticket = generation,
      controller = new AbortController();
    pending = controller;
    busy = true;
    refresh();
    try {
      const result = await choose(item, { signal: controller.signal });
      if (disposed || ticket !== generation || !dialog.open) return;
      if (result !== false) {
        close(false);
        onChosen();
      }
    } catch (error) {
      if (!disposed && ticket === generation && dialog.open)
        status.textContent = error.message || String(error);
    } finally {
      if (ticket === generation) {
        busy = false;
        pending = null;
        refresh();
      }
    }
  }
  async function open() {
    if (disposed) return;
    onOpen();
    if (!dialog.open) dialog.showModal();
    refresh();
    topBack.focus();
    if (!catalog) await reloadCatalog();
    else
      await run(async (signal) => {
        await inspectInstalled(signal);
        refresh();
      });
  }
  function close(notify = true) {
    if (!dialog.open) return;
    cancelPending();
    dialog.close();
    if (notify) onClose();
  }
  const escape = (event) => {
    event.preventDefault();
    close();
  };
  dialog.addEventListener('cancel', escape);
  dialog.addEventListener('close', () => {
    if (!dialog.open && pending) cancelPending();
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    ++generation;
    pending?.abort();
    pending = null;
    if (dialog.open) dialog.close();
    dialog.remove();
  }
  refresh();
  return Object.freeze({ open, close, refresh, dispose });
}
