import {
  loadOptionalCatalog,
  prepareOptionalCatalog,
  verifyOptionalInstalled,
} from '../optional-chapters.mjs';
import { PACK_LIMITS } from '../packs.mjs';
import { EXTERNAL_CHAPTER_LIMITS } from '../external-chapter.mjs';
import { required } from '../data-json.mjs';
import {
  browseWorlds,
  installedWorldMode,
  legacyWorldMode,
  WORLD_THEMES,
} from './worlds-browser.mjs';

/** Native optional content browser. The host alone owns installation and flight selection. */
export function attachOptionalChaptersPanel({
  document: doc = globalThis.document,
  getLibrary,
  getUsage = () => null,
  sourceChapter = null,
  sourceChapters = sourceChapter ? [sourceChapter] : [],
  loadCatalog = loadOptionalCatalog,
  install,
  choose,
  chooseInstalled,
  matchMedia = globalThis.matchMedia,
  onOpen = () => {},
  onClose = () => {},
  onChosen = () => {},
  onRead = ({ region }) => region.focus(),
  onManage = () => {},
} = {}) {
  required(
    Array.isArray(sourceChapters) &&
      sourceChapters.length <= EXTERNAL_CHAPTER_LIMITS.catalogChoices,
    'Too many trusted world choices.',
  );
  let catalog = null,
    disposed = false,
    generation = 0,
    pending = null,
    pendingFocus = null,
    busy = false,
    page = 0,
    pinned = null;
  const compact = matchMedia?.('(max-width: 900px), (max-aspect-ratio: 3/2)');
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
      'Browse original-picture chapters by theme and mode. Arcade uses continuous steering and contact pickups; Tactical chapters use equipment and route choices.',
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
  actions.append(read, reload, manage, back);
  const filters = node('div'),
    pager = node('div'),
    pageStatus = node('p', 'page'),
    operationStatus = node('p', 'operation'),
    taskStatus = node('div');
  filters.className = 'optional-worlds-filters';
  pager.className = 'optional-worlds-pager';
  operationStatus.setAttribute('role', 'status');
  taskStatus.className = 'optional-worlds-task';
  taskStatus.append(status, cancel);
  const select = (id, label, options) => {
    const wrapper = node('label', null, label),
      control = node('select', id);
    for (const [value, text] of options) {
      const option = node('option', null, text);
      option.value = value;
      control.append(option);
    }
    control.value = '';
    wrapper.append(control);
    filters.append(wrapper);
    return control;
  };
  const themeFilter = select('theme', 'Theme', [
      ['', 'All themes'],
      ...WORLD_THEMES,
      ['other', 'Other themes'],
    ]),
    modeFilter = select('mode', 'Mode', [
      ['', 'All modes'],
      ['Arcade', 'Arcade'],
      ['Tactical', 'Tactical'],
      ['Other', 'Other / mixed'],
    ]),
    previous = action('previous', 'Previous page', () => movePage(-1)),
    nextPage = action('next', 'Next page', () => movePage(1));
  pageStatus.setAttribute('role', 'status');
  pageStatus.setAttribute('aria-live', 'polite');
  pager.append(previous, pageStatus, nextPage);
  themeFilter.onchange = modeFilter.onchange = () => {
    page = 0;
    if (!busy) pinned = null;
    refreshView();
  };
  dialog.append(
    top,
    summary,
    filters,
    pager,
    operationStatus,
    taskStatus,
    cards,
    capacity,
    actions,
  );
  doc.body.append(dialog);
  const rows = new Map(),
    installedRows = new Map(),
    matches = new WeakMap();
  const sourceRows = sourceChapters.map((chapter) => {
    const prefix =
      chapter.controlId || (chapter === sourceChapter ? 'source' : `source-${chapter.id}`);
    const card = node('section', prefix === 'source' ? 'source-pilot' : `${prefix}-card`);
    card.className = `optional-world-card world-${chapter.themeId || 'other'}`;
    const heading = node('h3', null, chapter.name);
    const detail = node(
      'p',
      null,
      chapter.description || 'Three maps with original reward pictures.',
    );
    const metadata = node(
      'p',
      null,
      `${chapter.mode || 'Optional chapter'} · ${chapter.levels ?? 3} original pictures`,
    );
    const recovery = node('details', `${prefix}-recovery`),
      recoverySummary = node('summary', `${prefix}-recovery-summary`, 'Restore from files'),
      recoveryNote = node(
        'p',
        `${prefix}-recovery-note`,
        `${chapter.sourceOnly === false ? 'Restore this chapter’s matching gameplay and original picture files.' : 'Source candidate: choose its generated pack.json and media.rlmedia pair.'} ${chapter.backupSupported ? 'Game-data backup keeps its descriptor; keep .rlmedia originals separately. Removal is not supported yet.' : 'Backups and removal are not supported yet.'} This does not migrate another edition. Installation keeps your current flight; Choose changes the mission.`,
      );
    recovery.className = 'optional-world-recovery';
    recovery.append(recoverySummary);
    recovery.addEventListener('toggle', () => {
      if (
        !disposed &&
        dialog.open &&
        !recovery.open &&
        doc.activeElement !== recoverySummary &&
        recovery.contains(doc.activeElement)
      )
        recoverySummary.focus();
    });
    const file = (id, label, accept) => {
      const wrapper = node('label', null, label),
        input = node('input', `${prefix}-${id}`);
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => cancelPending();
      wrapper.append(input);
      recovery.append(wrapper);
      return input;
    };
    card.append(heading, metadata, detail);
    const pack = file('pack', 'Gameplay file (.json)', '.json,application/json');
    const media = file(
      'media',
      'Exact picture originals (.rlmedia)',
      '.rlmedia,application/octet-stream',
    );
    const state = node('p', `${prefix}-state`);
    const row = {
      key: `source:${chapter.id}`,
      chapter,
      card,
      pack,
      media,
      state,
      result: { status: 'checking' },
    };
    row.install = action(`${prefix}-install`, 'Install / recover exact pair', () =>
      run(
        async (signal, current) => {
          const packFile = pack.files?.[0],
            mediaFile = media.files?.[0];
          if (!packFile || !mediaFile)
            throw new Error('Choose both exact chapter files before installing.');
          status.textContent = 'Checking gameplay and original pictures…';
          await chapter.install({ pack: packFile, media: mediaFile }, { signal });
          if (!current()) return;
          const next = await chapter.inspect({ signal });
          if (current()) {
            row.result = next;
            status.textContent =
              'Exact original pair committed. Your paused flight is kept. Choose the chapter separately; reload after recovery to restore the saved profile.';
          }
        },
        { origin: row.install, next: row.choose, fallback: recoverySummary },
      ),
    );
    row.choose = action(`${prefix}-choose`, 'Choose chapter', () =>
      run(
        async (signal, current) => {
          await chapter.choose({ signal });
          if (current()) {
            close(false);
            onChosen();
          }
        },
        { origin: row.choose, fallback: recoverySummary },
      ),
    );
    if (chapter.download) {
      row.download = action(
        `${prefix}-download`,
        `Download & install · ${(chapter.bytes / 1048576).toFixed(1)} MiB`,
        () =>
          run(
            async (signal, current) => {
              status.textContent = `Downloading and checking ${chapter.name}…`;
              await chapter.download({ signal });
              if (!current()) return;
              const next = await chapter.inspect({ signal });
              if (current()) {
                row.result = next;
                status.textContent =
                  'Exact original pair committed. Your paused flight is kept. Choose the chapter separately.';
              }
            },
            { origin: row.download, next: row.choose, fallback: recoverySummary },
          ),
      );
      card.append(row.download);
    }
    recovery.append(row.install, recoveryNote);
    card.append(row.choose, state, recovery);
    return row;
  });
  async function inspectSource(signal, current) {
    if (!sourceRows.length) return;
    if (current()) status.textContent = 'Checking installed pictures…';
    for (const row of sourceRows) {
      if (!current()) return;
      let next;
      try {
        next = await row.chapter.inspect({ signal });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        next = { status: 'unavailable', message: error.message };
      }
      if (current()) row.result = next;
    }
  }
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
    const usage = getUsage();
    const bytes = usage ? usage.packBytes + usage.indexBytes : measuredBytes;
    capacity.textContent = `Installed packs: ${(bytes / 1048576).toFixed(1)} / ${PACK_LIMITS.libraryBytes / 1048576} MiB · ${library.packs.length} / ${PACK_LIMITS.installed} packs. Space is shared with your other chapters. Nothing is removed automatically.`;
    for (const [id, row] of rows) {
      const item = catalog?.packs.find((entry) => entry.id === id),
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
    for (const row of sourceRows) {
      const sourceState = row.result;
      row.install.disabled = busy || sourceState.status === 'installed';
      if (row.download) row.download.disabled = row.install.disabled;
      row.choose.disabled = busy || sourceState.status !== 'installed';
      row.pack.disabled = row.media.disabled = busy;
      row.state.textContent =
        sourceState.status === 'installed'
          ? 'Installed · ready to choose'
          : sourceState.status === 'absent'
            ? 'Not installed'
            : sourceState.message ||
              `Stored state: ${sourceState.status}. Recover the exact files before choosing.`;
    }
    for (const row of installedRows.values())
      row.choose.disabled = busy || !library.packs.includes(row.pack);
    reload.disabled = busy;
    manage.disabled = busy;
    cancel.hidden = !busy;
    dialog.setAttribute('aria-busy', String(busy));
    refreshView();
  }
  const themeFor = (id) => (WORLD_THEMES.some(([value]) => value === id) ? id : 'other');
  function allRows() {
    return [
      ...[...rows.values()].map((row) => ({
        ...row,
        themeId: themeFor(row.item.themeId),
        mode: legacyWorldMode(row.item.id),
      })),
      ...sourceRows.map((row) => ({
        ...row,
        themeId: themeFor(row.chapter.themeId),
        mode: ['Arcade', 'Tactical'].includes(row.chapter.mode) ? row.chapter.mode : 'Other',
      })),
      ...[...installedRows.values()].map((row) => ({
        ...row,
        themeIds: row.pack.themes?.map((theme) => themeFor(theme.id)) ?? ['other'],
        mode: installedWorldMode(row.pack),
      })),
    ];
  }
  function refreshView() {
    const entries = allRows();
    const view = browseWorlds(entries, {
      theme: themeFilter.value,
      mode: modeFilter.value,
      page,
      size: compact?.matches ? 2 : 4,
      pinned,
    });
    page = view.page;
    for (const row of entries) {
      row.card.hidden = !view.visible.includes(row.key);
      row.card.classList.toggle('optional-world-current', row.key === view.pinned);
    }
    pageStatus.textContent = `Page ${view.page + 1} of ${view.pages} · ${view.total} ${view.total === 1 ? 'chapter' : 'chapters'}`;
    previous.disabled = view.page === 0;
    nextPage.disabled = view.page === view.pages - 1;
    const held = entries.find((entry) => entry.key === view.pinned);
    operationStatus.hidden = !held;
    operationStatus.textContent = held
      ? `${busy ? 'Working on' : 'Current chapter'}: ${held.chapter?.name ?? held.item?.name ?? held.pack.name}. Kept visible while you browse.`
      : '';
  }
  function movePage(delta) {
    const origin = doc.activeElement;
    if (!busy) pinned = null;
    page = Math.max(0, page + delta);
    refreshView();
    repairViewFocus(origin);
  }
  function repairViewFocus(active) {
    if (!dialog.open) return;
    const hiddenCard = cards.contains(active) && active.closest('[hidden]');
    const disabledPager = (active === previous || active === nextPage) && active.disabled;
    if (!hiddenCard && !disabledPager) return;
    const candidates = disabledPager
      ? [previous, nextPage, themeFilter, topBack]
      : [themeFilter, topBack];
    candidates.find((control) => !control.disabled && !control.closest('[hidden]'))?.focus();
  }
  function resized() {
    const active = doc.activeElement;
    refreshView();
    repairViewFocus(active);
  }
  compact?.addEventListener?.('change', resized);
  function render() {
    const items = catalog?.packs ?? [];
    for (const [id, row] of rows)
      if (!items.some((item) => item.id === id)) {
        row.card.remove();
        rows.delete(id);
      }
    for (const item of items) {
      let row = rows.get(item.id);
      if (!row) {
        const card = node('section');
        card.className = `optional-world-card world-${item.themeId}`;
        const heading = node('h3', null, item.name),
          detail = node(
            'p',
            null,
            `${legacyWorldMode(item.id)} · ${item.levels} original pictures`,
          ),
          description = node('p', `description-${item.id}`, item.description),
          state = node('p');
        row = { key: `legacy:${item.id}`, item, card, heading, detail, description, state };
        row.install = action(`install-${item.id}`, 'Install', () => installItem(row.item));
        row.choose = action(`choose-${item.id}`, 'Choose chapter', () => chooseItem(row.item));
        card.append(heading, detail, description, state, row.install, row.choose);
        rows.set(item.id, row);
      }
      row.item = item;
      row.heading.textContent = item.name;
      row.description.textContent = item.description;
      cards.append(row.card);
    }
    for (const row of sourceRows) cards.append(row.card);
    const other = chooseInstalled
      ? getLibrary().packs.filter(
          (pack) => !rows.has(pack.id) && !sourceRows.some((row) => row.chapter.id === pack.id),
        )
      : [];
    for (const [id, row] of installedRows)
      if (!other.includes(row.pack)) {
        row.card.remove();
        installedRows.delete(id);
      }
    for (const pack of other) {
      let row = installedRows.get(pack.id);
      if (!row) {
        const card = node('section', `installed-${pack.id}`);
        card.className = 'optional-world-card';
        row = { key: `installed:${pack.id}`, pack, card };
        row.choose = action(`installed-choose-${pack.id}`, 'Choose installed chapter', () =>
          run(
            async (signal, current) => {
              const selected = await chooseInstalled(pack, { signal });
              if (current() && selected !== false) {
                close(false);
                onChosen();
              }
            },
            { origin: row.choose },
          ),
        );
        card.append(
          node('h3', null, pack.name),
          node(
            'p',
            null,
            `${installedWorldMode(pack)} · installed on this device. Open the Mission brief for its rules and equipment.`,
          ),
          row.choose,
        );
        installedRows.set(pack.id, row);
      }
      cards.append(row.card);
    }
    refresh();
  }
  const movedFocus = (event) => {
    if (pendingFocus && ![pendingFocus.origin, cancel, doc.body, dialog].includes(event.target))
      pendingFocus.moved = true;
  };
  doc.addEventListener('focusin', movedFocus);
  function returnFocus(plan, succeeded = false, cancelled = false) {
    if (disposed || !dialog.open || (!cancelled && (!plan || plan.moved))) return;
    if (![doc.body, dialog, plan?.origin, cancel].includes(doc.activeElement)) return;
    for (const candidate of [
      succeeded ? plan?.next : null,
      plan?.origin,
      plan?.fallback,
      reload,
      topBack,
    ]) {
      if (
        candidate?.isConnected &&
        !candidate.disabled &&
        !candidate.closest('[hidden],[inert],[aria-hidden="true"]') &&
        (typeof candidate.getClientRects !== 'function' || candidate.getClientRects().length)
      ) {
        candidate.focus();
        break;
      }
    }
  }
  function cancelPending({ restoreFocus = true } = {}) {
    const wasBusy = busy;
    const focusPlan = pendingFocus,
      fromCancel = doc.activeElement === cancel;
    pendingFocus = null;
    ++generation;
    pending?.abort();
    pending = null;
    busy = false;
    if (wasBusy)
      status.textContent =
        'Pending download cancelled. Completed installs remain available; your flight is kept.';
    refresh();
    if (restoreFocus && wasBusy) returnFocus(focusPlan, false, fromCancel);
  }
  async function run(fn, { origin = doc.activeElement, next = null, fallback = null } = {}) {
    if (disposed || busy || !dialog.open) return;
    const ticket = ++generation,
      controller = new AbortController();
    const focusPlan =
      origin !== doc.body && doc.activeElement === origin && dialog.contains(origin)
        ? { origin, next, fallback, moved: false }
        : null;
    let succeeded = false;
    pendingFocus = focusPlan;
    pending = controller;
    busy = true;
    const held = allRows().find((row) => row.card.contains(origin));
    if (held) pinned = held.key;
    refresh();
    const current = () => !disposed && dialog.open && ticket === generation;
    try {
      await fn(controller.signal, current);
      succeeded = true;
    } catch (error) {
      if (current())
        status.textContent =
          error?.name === 'AbortError'
            ? 'Download cancelled. Your installed chapters are kept.'
            : `${error.message || error} Nothing was removed. Use Refresh or Install to retry.`;
    } finally {
      if (current()) {
        pending = null;
        pendingFocus = null;
        busy = false;
        refresh();
        returnFocus(focusPlan, succeeded);
      }
    }
  }
  async function reloadCatalog() {
    return run(async (signal, current) => {
      status.textContent = 'Checking installed chapters…';
      if (catalog) await inspectInstalled(signal, catalog);
      await inspectSource(signal, current);
      if (!current()) return;
      refresh();
      status.textContent = 'Reading the optional chapter list…';
      let next = catalog,
        failure = null;
      try {
        next = prepareOptionalCatalog(await loadCatalog({ signal }));
      } catch (error) {
        if (signal.aborted) throw error;
        failure = error;
      }
      if (!current()) return;
      if (next) await inspectInstalled(signal, next);
      if (!current()) return;
      catalog = next;
      render();
      status.textContent = failure
        ? `Online list unavailable: ${failure.message || failure}. Installed and previously loaded chapters remain available. Refresh to retry.`
        : 'Installation keeps your current flight. Choose chapter changes the selected mission.';
    });
  }
  async function installItem(item) {
    await run(
      async (signal, current) => {
        status.textContent = `Downloading and checking ${item.name}…`;
        await install(item, { signal });
        await inspectInstalled(signal);
        if (current()) {
          refresh();
          status.textContent = `${item.name} installed. Your paused flight is kept. Choose chapter when ready to change missions.`;
        }
      },
      { origin: rows.get(item.id)?.install, next: rows.get(item.id)?.choose },
    );
  }
  async function chooseItem(item) {
    if (busy || disposed || !installed(item)) return;
    await run(
      async (signal, current) => {
        const result = await choose(item, { signal });
        if (!current()) return;
        if (result !== false) {
          close(false);
          onChosen();
        }
      },
      { origin: rows.get(item.id)?.choose },
    );
  }
  async function open() {
    if (disposed) return;
    onOpen();
    if (!dialog.open) dialog.showModal();
    render();
    topBack.focus();
    if (!catalog) await reloadCatalog();
    else
      await run(async (signal, current) => {
        if (sourceRows.length) status.textContent = 'Checking installed pictures…';
        if (catalog) await inspectInstalled(signal);
        await inspectSource(signal, current);
        if (!current()) return;
        refresh();
        if (sourceRows.length)
          status.textContent =
            'Choose a world to install. Installation keeps your current flight; Choose chapter changes the selected mission.';
      });
  }
  function close(notify = true) {
    if (!dialog.open) return;
    cancelPending({ restoreFocus: false });
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
    pendingFocus = null;
    doc.removeEventListener('focusin', movedFocus);
    compact?.removeEventListener?.('change', resized);
    if (dialog.open) dialog.close();
    dialog.remove();
  }
  render();
  return Object.freeze({ open, close, refresh, dispose });
}
