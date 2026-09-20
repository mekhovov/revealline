import {
  loadOptionalCatalog,
  prepareOptionalCatalog,
  verifyOptionalInstalled,
} from '../optional-chapters.mjs';
import { PACK_LIMITS } from '../packs.mjs';
import { EXTERNAL_CHAPTER_LIMITS } from '../external-chapter.mjs';
import { required } from '../data-json.mjs';
import { createOperationStatus } from './operation-status.mjs';
import {
  browseWorlds,
  installedWorldMode,
  legacyWorldMode,
  WORLD_THEMES,
} from './worlds-browser.mjs';

/** Native optional content browser. The host alone owns installation and attempt selection. */
export function attachOptionalChaptersPanel({
  document: doc = globalThis.document,
  heading = 'More worlds',
  backLabel = 'Back to main menu',
  attemptLabel = 'flight',
  showManage = true,
  getLibrary,
  getUsage = () => null,
  sourceChapter = null,
  sourceChapters = sourceChapter ? [sourceChapter] : [],
  loadCatalog = loadOptionalCatalog,
  refreshLibrary = null,
  install,
  choose,
  chooseInstalled,
  play,
  playInstalled,
  onPlayActivation = () => {},
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
    launchGeneration = 0,
    pending = null,
    pendingFocus = null,
    pendingStatus = null,
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
  const title = node('h2', 'title', heading),
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
  summary.setAttribute(
    'aria-label',
    heading === 'More worlds' ? 'About optional worlds' : `About ${heading}`,
  );
  cards.className = 'optional-worlds-cards';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const presentation = createOperationStatus(status, { isCurrent: () => !disposed && dialog.open });
  const reload = action('reload', 'Refresh available worlds', () => reloadCatalog()),
    manage = action('manage', 'Manage packs & backups', () => {
      close(false);
      onManage();
    }),
    read = action(
      'read',
      heading === 'More worlds' ? 'Read about worlds' : `Read about ${heading}`,
      () => onRead({ region: summary, origin: read, label: heading }),
    ),
    cancel = action('cancel', 'Cancel operation', cancelPending),
    back = action('back', backLabel, () => close()),
    topBack = action('top-back', 'Back', () => close()),
    top = node('div'),
    actions = node('div');
  top.className = 'optional-worlds-top';
  topBack.setAttribute('aria-label', backLabel);
  top.append(title, topBack);
  actions.className = 'optional-worlds-actions';
  actions.append(read, reload, ...(showManage ? [manage] : []), back);
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
    previous = action('previous', 'Previous', () => movePage(-1)),
    nextPage = action('next', 'Next', () => movePage(1));
  previous.setAttribute('aria-label', 'Previous page');
  nextPage.setAttribute('aria-label', 'Next page');
  pageStatus.setAttribute('role', 'status');
  pageStatus.setAttribute('aria-live', 'polite');
  pager.append(previous, pageStatus, nextPage);
  themeFilter.onchange = modeFilter.onchange = () => {
    ++launchGeneration;
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
  const pageEvents =
    typeof doc.defaultView?.addEventListener === 'function'
      ? doc.defaultView
      : (globalThis.window ?? globalThis);
  const retireLaunch = () => {
    ++launchGeneration;
    if (pendingFocus) pendingFocus.moved = true;
  };
  const pageBlur = (event) => {
    if (!event.target || event.target === pageEvents) retireLaunch();
  };
  const pageVisibility = () => {
    if (doc.hidden) retireLaunch();
  };
  pageEvents.addEventListener?.('blur', pageBlur);
  pageEvents.addEventListener?.('pagehide', retireLaunch);
  doc.addEventListener('visibilitychange', pageVisibility);
  function choiceLaunch(opener, current, playing = false) {
    const epoch = ++launchGeneration;
    let selected = false;
    const isCurrent = () =>
      !selected &&
      current() &&
      epoch === launchGeneration &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      opener.isConnected &&
      (busy || !opener.disabled) &&
      !opener.closest('[hidden],[inert],[aria-hidden="true"]');
    const complete = () => {
      if (!isCurrent()) return false;
      selected = true;
      close(false);
      onChosen();
      return true;
    };
    return {
      opener,
      isCurrent,
      onCancelled({ dialog: decision }) {
        if (!isCurrent() || decision?.open) return false;
        const operation = generation;
        const ownsReturnFocus = (element) =>
          [doc.body, dialog, opener, cancel, decision].includes(element) ||
          decision?.contains(element);
        const restore = ownsReturnFocus(doc.activeElement);
        // Stay is a new, explicit return request. Release this outer operation
        // now, even if the aborted save callback has not settled yet. Its old
        // finally cannot restore focus or clear a subsequent operation.
        cancelPending({ restoreFocus: false });
        const returned = () =>
          !disposed &&
          dialog.open &&
          generation === operation + 1 &&
          epoch === launchGeneration &&
          !doc.hidden &&
          doc.hasFocus?.() !== false;
        if (playing && returned()) {
          const message = `Your ${attemptLabel} is kept paused. Choose Play when ready to change chapters.`;
          presentation.begin({ message, stage: 'ready', isCurrent: returned }).finish({ message });
        }
        if (
          restore &&
          returned() &&
          ownsReturnFocus(doc.activeElement) &&
          opener.isConnected &&
          !opener.disabled &&
          !opener.closest('[hidden],[inert],[aria-hidden="true"]') &&
          (typeof opener.getClientRects !== 'function' || opener.getClientRects().length)
        )
          opener.focus();
        return true;
      },
      onSelected: () => !playing && complete(),
      onStarted: () => playing && complete(),
    };
  }
  function playLaunch(opener, current, signal) {
    const launch = choiceLaunch(opener, current, true);
    onPlayActivation({ launch, signal });
    return launch;
  }
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
        `${chapter.sourceOnly === false ? 'Restore this chapter’s matching gameplay and original picture files.' : 'Source candidate: choose its generated pack.json and media.rlmedia pair.'} ${chapter.backupSupported ? 'Game-data backup keeps its descriptor; keep .rlmedia originals separately. Removal is not supported yet.' : 'Backups and removal are not supported yet.'} This does not migrate another edition. Installation keeps your current ${attemptLabel}; ${chapter.play ? 'Play prepares and starts the chapter' : 'Choose changes the mission'}.`,
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
        async (signal, current, report) => {
          const packFile = pack.files?.[0],
            mediaFile = media.files?.[0];
          if (!packFile || !mediaFile)
            throw new Error('Choose both exact chapter files before installing.');
          report('Checking gameplay and original pictures…', 'verifying');
          await chapter.install({ pack: packFile, media: mediaFile }, { signal, onStatus: report });
          if (!current()) return;
          report('Checking the installed original pair…', 'verifying');
          const next = await chapter.inspect({ signal });
          if (current()) {
            row.result = next;
            report(
              `Exact original pair committed. Your paused ${attemptLabel} is kept. ${chapter.play ? 'Use Play when ready' : 'Choose the chapter separately'}; reload after recovery to restore the saved profile.`,
            );
          }
        },
        { origin: row.install, next: row.choose, fallback: recoverySummary },
      ),
    );
    const canPlay = typeof chapter.play === 'function';
    if (canPlay && chapter.download) {
      row.download = row.choose = action(`${prefix}-download`, 'Download & play', () =>
        playSource(row, recoverySummary),
      );
      card.append(row.download);
    } else {
      row.choose = action(`${prefix}-choose`, canPlay ? 'Play' : 'Choose chapter', () =>
        canPlay
          ? playSource(row, recoverySummary)
          : run(
              async (signal, current, report) => {
                report(`Preparing ${chapter.name}…`, 'preparing');
                const launch = choiceLaunch(row.choose, current);
                const selected = await chapter.choose({ signal, onStatus: report, launch });
                if (selected !== false) launch.onSelected();
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
              async (signal, current, report) => {
                report(`Downloading and checking ${chapter.name}…`, 'downloading');
                await chapter.download({ signal, onStatus: report });
                if (!current()) return;
                report('Checking the installed original pair…', 'verifying');
                const next = await chapter.inspect({ signal });
                if (current()) {
                  row.result = next;
                  report(
                    `Exact original pair committed. Your paused ${attemptLabel} is kept. Choose the chapter separately.`,
                  );
                }
              },
              { origin: row.download, next: row.choose, fallback: recoverySummary },
            ),
        );
        card.append(row.download);
      }
      card.append(row.choose);
    }
    row.review = node('div', `${prefix}-picture-review`);
    row.review.hidden = true;
    row.review.setAttribute('role', 'group');
    row.review.setAttribute('aria-label', 'Keep existing picture choices');
    row.reviewText = node('p', `${prefix}-picture-review-text`);
    row.confirm = action(`${prefix}-picture-confirm`, 'Install originals; keep my pictures', () => {
      const choice = row.pictureReview;
      if (!choice || busy) return;
      return run(
        async (signal, current, report) => {
          report('Installing originals while keeping your picture choices…', 'saving');
          if (choice.files)
            await chapter.install(choice.files, {
              signal,
              onStatus: report,
              pictureReview: choice.error,
            });
          else await chapter.download({ signal, onStatus: report, pictureReview: choice.error });
          if (!current()) return;
          report('Originals installed; checking chapter readiness…', 'verifying');
          try {
            const next = await chapter.inspect({ signal });
            if (!current()) return;
            row.result = next;
          } catch (error) {
            throw new Error(
              `The originals were installed and your picture choices kept. Refresh before playing. ${error.message}`,
            );
          }
          if (current())
            report(
              `Originals installed. Your picture choices and paused ${attemptLabel} are kept. ${chapter.play ? 'Use Play' : 'Choose the chapter separately'} when ready.`,
            );
        },
        { origin: row.confirm, next: row.choose, fallback: recoverySummary },
      );
    });
    row.dismiss = action(`${prefix}-picture-cancel`, 'Cancel picture review', () => {
      const origin = row.pictureReview?.origin;
      discardPictureReviews();
      refresh();
      const message = `Installation cancelled. Your pictures and paused ${attemptLabel} are unchanged.`;
      presentation.begin({ message }).finish({ message, state: 'cancelled' });
      if (dialog.open) (origin && !origin.disabled ? origin : row.choose).focus();
    });
    row.review.append(row.reviewText, row.confirm, row.dismiss);
    card.append(row.review);
    recovery.append(row.install, recoveryNote);
    card.append(state, recovery);
    return row;
  });
  async function inspectSource(signal, current, report) {
    if (!sourceRows.length) return;
    let completed = 0;
    report('Checking installed pictures…', 'verifying', {
      completed,
      total: sourceRows.length,
      unit: 'chapters',
    });
    for (const row of sourceRows) {
      if (!current()) return;
      let next;
      try {
        next = await row.chapter.inspect({ signal });
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        next = { status: 'unavailable', message: error.message };
      }
      if (current()) {
        row.result = next;
        report('Checking installed pictures…', 'verifying', {
          completed: ++completed,
          total: sourceRows.length,
          unit: 'chapters',
        });
      }
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
      row.install.disabled = busy || (!!existing && !(play && available));
      row.install.textContent =
        play && available
          ? 'Play'
          : available
            ? 'Installed on this device'
            : conflict
              ? 'Different edition installed'
              : existing
                ? 'Checking installed edition…'
                : `${play ? 'Download & play' : 'Install'} · ${(item.bytes / 1048576).toFixed(1)} MiB`;
      if (!play) row.choose.disabled = busy || !available;
      row.state.textContent = available
        ? 'Installed · available without another download'
        : conflict
          ? showManage
            ? 'This ID contains different artwork/content. Use Manage packs & backups before installing this original.'
            : 'This ID contains different artwork/content. Keep the installed edition or choose another chapter.'
          : `Optional download · choose ${play ? 'Download & play' : 'Install'} when connected`;
    }
    for (const row of sourceRows) {
      const sourceState = row.result;
      row.review.hidden = !row.pictureReview;
      row.confirm.disabled = row.dismiss.disabled = busy;
      row.install.disabled = busy || sourceState.status === 'installed';
      if (row.chapter.play) {
        row.choose.disabled = busy || (sourceState.status !== 'installed' && !row.download);
        row.choose.textContent =
          sourceState.status === 'installed'
            ? 'Play'
            : row.download
              ? `Download & play · ${(row.chapter.bytes / 1048576).toFixed(1)} MiB`
              : 'Play';
      } else {
        if (row.download) row.download.disabled = row.install.disabled;
        row.choose.disabled = busy || sourceState.status !== 'installed';
      }
      row.pack.disabled = row.media.disabled = busy;
      row.state.textContent =
        sourceState.status === 'installed'
          ? `Installed · ready to ${row.chapter.play ? 'play' : 'choose'}`
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
      ? `${busy ? 'Working on' : 'Chapter in view'}: ${held.chapter?.name ?? held.item?.name ?? held.pack.name}. Kept visible while you browse.`
      : '';
  }
  function movePage(delta) {
    ++launchGeneration;
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
        row.install = action(`install-${item.id}`, play ? 'Download & play' : 'Install', () =>
          play ? playItem(row.item, row.install) : installItem(row.item),
        );
        row.choose = play
          ? row.install
          : action(`choose-${item.id}`, 'Choose chapter', () => chooseItem(row.item));
        card.append(heading, detail, description, state, row.install);
        if (!play) card.append(row.choose);
        rows.set(item.id, row);
      }
      row.item = item;
      row.heading.textContent = item.name;
      row.description.textContent = item.description;
      cards.append(row.card);
    }
    for (const row of sourceRows) cards.append(row.card);
    const other =
      chooseInstalled || playInstalled
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
        row.choose = action(
          `installed-choose-${pack.id}`,
          playInstalled ? 'Play' : 'Choose installed chapter',
          () =>
            run(
              async (signal, current, report) => {
                report(`Preparing ${pack.name}…`, 'preparing');
                const launch = playInstalled
                  ? playLaunch(row.choose, current, signal)
                  : choiceLaunch(row.choose, current);
                if (!launch.isCurrent()) return;
                required(
                  getLibrary().packs.includes(pack),
                  'This installed chapter has changed. Refresh before playing.',
                );
                const selected = await (playInstalled || chooseInstalled)(pack, {
                  signal,
                  onStatus: report,
                  launch,
                });
                if (!playInstalled && selected !== false) launch.onSelected();
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
    if (
      disposed ||
      !dialog.open ||
      doc.hidden ||
      doc.hasFocus?.() === false ||
      (!cancelled && (!plan || plan.moved))
    )
      return;
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
  function discardPictureReviews() {
    for (const row of sourceRows) row.pictureReview = null;
  }
  function cancelPending({ restoreFocus = true } = {}) {
    discardPictureReviews();
    const wasBusy = busy;
    const focusPlan = pendingFocus,
      fromCancel = doc.activeElement === cancel;
    pendingFocus = null;
    if (wasBusy)
      pendingStatus?.finish({
        state: 'cancelled',
        message: `Cancellation requested. Completed installs remain available; your ${attemptLabel} is kept.`,
      });
    pendingStatus = null;
    ++generation;
    pending?.abort();
    pending = null;
    busy = false;
    refresh();
    if (restoreFocus && wasBusy) returnFocus(focusPlan, false, fromCancel);
  }
  async function run(fn, { origin = doc.activeElement, next = null, fallback = null } = {}) {
    if (disposed || busy || !dialog.open) return;
    const reviewFiles = sourceRows.find((row) => row.confirm === origin)?.pictureReview?.files;
    discardPictureReviews();
    const ticket = ++generation,
      controller = new AbortController();
    const focusPlan =
      origin !== doc.body && doc.activeElement === origin && dialog.contains(origin)
        ? { origin, next, fallback, moved: false }
        : null;
    let succeeded = false,
      finalMessage = 'Checking the selected chapter…',
      outcome = 'ready';
    pendingFocus = focusPlan;
    pending = controller;
    busy = true;
    const held = allRows().find((row) => row.card.contains(origin));
    const sourceRow = sourceRows.find((row) => row.card.contains(origin));
    if (held) pinned = held.key;
    const current = () => !disposed && dialog.open && ticket === generation;
    refresh();
    // The initiating action becomes disabled. Keep its keyboard/controller
    // focus on the visible cancellation action without reclaiming moved focus.
    if (
      current() &&
      focusPlan &&
      !focusPlan.moved &&
      focusPlan.origin.disabled &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      [focusPlan.origin, doc.body, dialog].includes(doc.activeElement) &&
      cancel.isConnected &&
      !cancel.disabled &&
      !cancel.closest('[hidden],[inert],[aria-hidden="true"]') &&
      (typeof cancel.getClientRects !== 'function' || cancel.getClientRects().length)
    )
      cancel.focus();
    const display = presentation.begin({
      message: finalMessage,
      stage: 'checking',
      isCurrent: current,
    });
    pendingStatus = display;
    const report = (value, stage = 'checking', progress = null) => {
      if (!current()) return;
      const update = typeof value === 'string' ? { message: value, stage, progress } : value;
      finalMessage = update.message ?? finalMessage;
      display.update(update);
    };
    try {
      await fn(controller.signal, current, report);
      succeeded = true;
    } catch (error) {
      if (current()) {
        const reviewable =
          sourceRow &&
          error?.name === 'RetainedPictureAssignmentConflict' &&
          Array.isArray(error.conflicts) &&
          error.conflicts.length > 0;
        if (reviewable) {
          sourceRow.pictureReview = {
            error,
            origin:
              origin === sourceRow.confirm
                ? reviewFiles
                  ? sourceRow.install
                  : sourceRow.download
                : origin,
            files:
              origin === sourceRow.install
                ? { pack: sourceRow.pack.files?.[0], media: sourceRow.media.files?.[0] }
                : (reviewFiles ?? null),
          };
          sourceRow.reviewText.textContent =
            `${sourceRow.chapter.name}: ${error.conflicts.length} existing picture choice${error.conflicts.length === 1 ? '' : 's'} will be kept. The chapter uses its authored originals; your saved and earned pictures stay unchanged. ` +
            error.conflicts
              .map(
                (entry) =>
                  `${entry.levelName ?? entry.identity.levelId.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase())}: ${entry.retained ? 'your selected picture' : 'your default picture'}`,
              )
              .join('; ');
          if (focusPlan) focusPlan.next = sourceRow.dismiss;
          succeeded = true;
          report(
            'Review your existing picture choices. Confirm installation or Cancel; your current flight is kept.',
          );
        } else {
          outcome = error?.name === 'AbortError' ? 'cancelled' : 'error';
          report(
            error?.name === 'AbortError'
              ? `Operation cancelled. Completed installs remain available; your ${attemptLabel} is kept.`
              : `${error.message || error} Completed installs remain available. ${play || playInstalled || sourceRows.some((row) => row.chapter.play) ? 'Use Play or Refresh to retry.' : 'Use Refresh or Install to retry.'}`,
          );
        }
      }
    } finally {
      if (current()) {
        display.finish({ message: finalMessage, state: outcome });
        pendingStatus = null;
        pending = null;
        pendingFocus = null;
        busy = false;
        refresh();
        returnFocus(focusPlan, succeeded);
      }
    }
  }
  async function reloadCatalog() {
    return run(async (signal, current, report) => {
      report('Checking installed chapters…', 'verifying');
      if (refreshLibrary) {
        await refreshLibrary({ signal, onStatus: report });
        if (!current()) return;
      }
      if (catalog) await inspectInstalled(signal, catalog);
      await inspectSource(signal, current, report);
      if (!current()) return;
      refresh();
      report('Reading the optional chapter list…', 'reading');
      let next = catalog,
        failure = null;
      try {
        next = prepareOptionalCatalog(await loadCatalog({ signal }));
      } catch (error) {
        if (signal.aborted) throw error;
        failure = error;
      }
      if (!current()) return;
      if (next) {
        report('Checking installed chapters…', 'verifying');
        await inspectInstalled(signal, next);
      }
      if (!current()) return;
      catalog = next;
      render();
      report(
        failure
          ? `Online list unavailable: ${failure.message || failure}. Installed and previously loaded chapters remain available. Refresh to retry.`
          : play || playInstalled || sourceRows.some((row) => row.chapter.play)
            ? `Play prepares your selected chapter. You can cancel and keep your current ${attemptLabel}.`
            : `Installation keeps your current ${attemptLabel}. Choose chapter changes the selected mission.`,
      );
    });
  }
  async function playSource(row, fallback) {
    const { chapter } = row;
    await run(
      async (signal, current, report) => {
        const launch = playLaunch(row.choose, current, signal);
        if (!launch.isCurrent()) return;
        if (row.result.status !== 'installed') {
          required(
            typeof chapter.download === 'function',
            'Restore the exact chapter files before playing.',
          );
          report(`Downloading and checking ${chapter.name}…`, 'downloading');
          await chapter.download({ signal, onStatus: report });
          if (!current()) return;
        }
        report('Checking the installed original pair…', 'verifying');
        const next = await chapter.inspect({ signal });
        if (!current()) return;
        row.result = next;
        required(
          next.status === 'installed',
          next.message || 'The chapter needs repair before playing.',
        );
        if (!launch.isCurrent()) {
          report(
            `${chapter.name} installed. Choose Play when ready; your ${attemptLabel} is kept.`,
          );
          return;
        }
        report(`Preparing ${chapter.name}…`, 'preparing');
        await chapter.play({ signal, onStatus: report, launch });
      },
      { origin: row.choose, fallback },
    );
  }
  async function playItem(item, opener) {
    await run(
      async (signal, current, report) => {
        const launch = playLaunch(opener, current, signal);
        if (!launch.isCurrent()) return;
        if (!installed(item)) {
          required(
            !getLibrary().packs.some((pack) => pack.id === item.id),
            showManage
              ? 'A different edition is installed. Manage it before downloading this original.'
              : 'A different edition is installed. Keep it or choose another chapter.',
          );
          report(`Downloading and checking ${item.name}…`, 'downloading');
          await install(item, { signal, onStatus: report });
          if (!current()) return;
        }
        report('Checking the installed chapter…', 'verifying');
        const pack = getLibrary().packs.find((candidate) => candidate.id === item.id);
        required(pack, 'The chapter is not installed. Download it before playing.');
        await verifyOptionalInstalled(pack, item, { signal });
        if (!current()) return;
        required(
          getLibrary().packs.includes(pack),
          'This installed chapter has changed. Refresh before playing.',
        );
        if (!matches.has(pack)) matches.set(pack, new Map());
        matches.get(pack).set(item.normalizedSha256, true);
        if (!launch.isCurrent()) {
          report(`${item.name} installed. Choose Play when ready; your ${attemptLabel} is kept.`);
          return;
        }
        report(`Preparing ${item.name}…`, 'preparing');
        await play(item, { signal, onStatus: report, launch });
      },
      { origin: opener },
    );
  }
  async function installItem(item) {
    await run(
      async (signal, current, report) => {
        report(`Downloading and checking ${item.name}…`, 'downloading');
        await install(item, { signal, onStatus: report });
        report('Checking the installed chapter…', 'verifying');
        await inspectInstalled(signal);
        if (current()) {
          refresh();
          report(
            `${item.name} installed. Your paused ${attemptLabel} is kept. Choose chapter when ready to change missions.`,
          );
        }
      },
      { origin: rows.get(item.id)?.install, next: rows.get(item.id)?.choose },
    );
  }
  async function chooseItem(item) {
    if (busy || disposed || !installed(item)) return;
    await run(
      async (signal, current, report) => {
        report(`Preparing ${item.name}…`, 'preparing');
        const launch = choiceLaunch(rows.get(item.id).choose, current);
        const result = await choose(item, { signal, onStatus: report, launch });
        if (result !== false) launch.onSelected();
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
      await run(async (signal, current, report) => {
        report('Checking installed chapters and pictures…', 'verifying');
        if (refreshLibrary) {
          await refreshLibrary({ signal, onStatus: report });
          if (!current()) return;
        }
        if (catalog) await inspectInstalled(signal);
        await inspectSource(signal, current, report);
        if (!current()) return;
        refresh();
        report(
          play || playInstalled || sourceRows.some((row) => row.chapter.play)
            ? `Choose Play or Download & play. You can cancel preparation and keep your current ${attemptLabel}.`
            : `Choose a world to install. Installation keeps your current ${attemptLabel}; Choose chapter changes the selected mission.`,
        );
      });
  }
  function close(notify = true) {
    if (!dialog.open) return;
    retireLaunch();
    cancelPending({ restoreFocus: false });
    dialog.close();
    if (notify) onClose();
  }
  const escape = (event) => {
    if (event.target !== dialog) return;
    event.preventDefault();
    close();
  };
  dialog.addEventListener('cancel', escape);
  dialog.addEventListener('close', () => {
    if (!dialog.open) {
      retireLaunch();
      cancelPending({ restoreFocus: false });
    }
  });
  function dispose() {
    if (disposed) return;
    disposed = true;
    discardPictureReviews();
    presentation.dispose();
    pendingStatus = null;
    ++generation;
    pending?.abort();
    pending = null;
    pendingFocus = null;
    retireLaunch();
    pageEvents.removeEventListener?.('blur', pageBlur);
    pageEvents.removeEventListener?.('pagehide', retireLaunch);
    doc.removeEventListener('visibilitychange', pageVisibility);
    doc.removeEventListener('focusin', movedFocus);
    compact?.removeEventListener?.('change', resized);
    if (dialog.open) dialog.close();
    dialog.remove();
  }
  render();
  return Object.freeze({
    open,
    close,
    cancel({ restoreFocus = false } = {}) {
      if (!disposed && busy) cancelPending({ restoreFocus });
    },
    refresh,
    dispose,
  });
}
