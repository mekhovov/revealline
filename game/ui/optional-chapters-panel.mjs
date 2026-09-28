import { contentText } from '../i18n/content.mjs';
import { localizedMessage, localizedText, t, localizedAttribute } from '../i18n/index.mjs';
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
    t("interface:tooManyTrustedWorldChoices"),
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
    localizedText(el, () =>text);
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
  const title = node('h2', 'title', localizedMessage("interface:moreWorlds")),
    summary = node(
      'p',
      'summary',
      localizedMessage("interface:browseOriginalPictureChaptersByThemeAndModeArcadeUses"),
    ),
    capacity = node('p', 'capacity'),
    cards = node('div', 'cards'),
    status = node('p', 'status');
  summary.tabIndex = 0;
  summary.setAttribute('data-game-reading', '');
  summary.setAttribute('role', 'region');
  localizedAttribute(summary, "aria-label", () => t("interface:aboutOptionalWorlds"));
  cards.className = 'optional-worlds-cards';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const reload = action('reload', t("interface:refreshAvailableWorlds"), () => reloadCatalog()),
    manage = action('manage', t("interface:managePacksBackups"), () => {
      close(false);
      onManage();
    }),
    read = action('read', t("interface:readAboutWorlds"), () =>
      onRead({ region: summary, origin: read, label: t("interface:moreWorlds") }),
    ),
    cancel = action('cancel', t("interface:cancelDownload"), cancelPending),
    back = action('back', t("interface:backToMainMenu"), () => close()),
    topBack = action('top-back', t("common:actions.back"), () => close()),
    top = node('div'),
    actions = node('div');
  top.className = 'optional-worlds-top';
  localizedAttribute(topBack, "aria-label", () => t("interface:backToMainMenu"));
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
  const themeFilter = select('theme', t("interface:theme"), [
      ['', t("interface:allThemes")],
      ...WORLD_THEMES,
      ['other', t("interface:otherThemes")],
    ]),
    modeFilter = select('mode', t("interface:mode"), [
      ['', t("interface:allModes")],
      [t("interface:arcade"), t("interface:arcade")],
      [t("interface:tactical"), t("interface:tactical")],
      [t("interface:other"), t("interface:otherMixed")],
    ]),
    previous = action('previous', t("common:actions.previous"), () => movePage(-1)),
    nextPage = action('next', t("common:actions.next"), () => movePage(1));
  localizedAttribute(previous, "aria-label", () => t("interface:previousPage"));
  localizedAttribute(nextPage, "aria-label", () => t("interface:nextPage"));
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
    const heading = node('h3', null, contentText(chapter, 'name'));
    const detail = node(
      'p',
      null,
      contentText(chapter, 'description') || t("interface:threeMapsWithOriginalRewardPictures"),
    );
    const metadata = node(
      'p',
      null,
      t("gameplay:originalPictures", { value1: chapter.mode || t("interface:optionalChapter"), value2: chapter.levels ?? 3 }),
    );
    const recovery = node('details', `${prefix}-recovery`),
      recoverySummary = node('summary', `${prefix}-recovery-summary`, localizedMessage("interface:restoreFromFiles")),
      recoveryNote = node(
        'p',
        `${prefix}-recovery-note`,
        t("gameplay:thisDoesNotMigrateAnotherEditionInstallationKeepsYourCurrent", { value1: chapter.sourceOnly === false ? t("interface:restoreThisChapterSMatchingGameplayAndOriginalPictureFiles") : t("interface:sourceCandidateChooseItsGeneratedPackJsonAndMediaRlmedia"), value2: chapter.backupSupported ? t("interface:gameDataBackupKeepsItsDescriptorKeepRlmediaOriginalsSeparately") : t("interface:backupsAndRemovalAreNotSupportedYet") }),
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
    const pack = file('pack', t("interface:gameplayFileJson"), '.json,application/json');
    const media = file(
      'media',
      t("interface:exactPictureOriginalsRlmedia"),
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
    row.install = action(`${prefix}-install`, t("interface:installRecoverExactPair"), () =>
      run(
        async (signal, current) => {
          const packFile = pack.files?.[0],
            mediaFile = media.files?.[0];
          if (!packFile || !mediaFile)
            throw new Error(t("interface:chooseBothExactChapterFilesBeforeInstalling"));
          localizedText(status, () =>t("interface:checkingGameplayAndOriginalPictures"));
          await chapter.install({ pack: packFile, media: mediaFile }, { signal });
          if (!current()) return;
          const next = await chapter.inspect({ signal });
          if (current()) {
            row.result = next;
            localizedText(status, () =>t("interface:exactOriginalPairCommittedYourPausedFlightIsKeptChoose"));
          }
        },
        { origin: row.install, next: row.choose, fallback: recoverySummary },
      ),
    );
    row.choose = action(`${prefix}-choose`, t("interface:chooseChapter"), () =>
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
        t("gameplay:downloadInstallMib", { value1: (chapter.bytes / 1048576).toFixed(1) }),
        () =>
          run(
            async (signal, current) => {
              localizedText(status, () =>t("gameplay:downloadingAndChecking", { value1: contentText(chapter, 'name') }));
              await chapter.download({ signal });
              if (!current()) return;
              const next = await chapter.inspect({ signal });
              if (current()) {
                row.result = next;
                localizedText(status, () =>t("interface:exactOriginalPairCommittedYourPausedFlightIsKeptChoose2"));
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
    if (current()) localizedText(status, () =>t("interface:checkingInstalledPictures"));
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
    localizedText(capacity, () =>t("gameplay:installedPacksMibPacksSpaceIsSharedWithYourOther", { value1: (bytes / 1048576).toFixed(1), value2: PACK_LIMITS.libraryBytes / 1048576, value3: library.packs.length, value4: PACK_LIMITS.installed }));
    for (const [id, row] of rows) {
      const item = catalog?.packs.find((entry) => entry.id === id),
        available = installed(item);
      const existing = library.packs.find((pack) => pack.id === id);
      const conflict = existing && matches.get(existing)?.get(item.normalizedSha256) === false;
      row.install.disabled = busy || !!existing;
      localizedText(row.install, () =>available
        ? t("interface:installedOnThisDevice")
        : conflict
          ? t("interface:differentEditionInstalled")
          : existing
            ? t("interface:checkingInstalledEdition")
            : t("gameplay:installMib", { value1: (item.bytes / 1048576).toFixed(1) }));
      row.choose.disabled = busy || !available;
      localizedText(row.state, () =>available
        ? t("interface:installedAvailableWithoutAnotherDownload")
        : conflict
          ? t("interface:thisIdContainsDifferentArtworkContentUseManagePacksBackups")
          : t("interface:optionalDownloadChooseInstallWhenConnected"));
    }
    for (const row of sourceRows) {
      const sourceState = row.result;
      row.install.disabled = busy || sourceState.status === 'installed';
      if (row.download) row.download.disabled = row.install.disabled;
      row.choose.disabled = busy || sourceState.status !== 'installed';
      row.pack.disabled = row.media.disabled = busy;
      localizedText(row.state, () =>sourceState.status === 'installed'
          ? t("interface:installedReadyToChoose")
          : sourceState.status === 'absent'
            ? t("interface:notInstalled")
            : sourceState.message ||
              t("gameplay:storedStateRecoverTheExactFilesBeforeChoosing", { value1: sourceState.status }));
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
        mode: ['Arcade', 'Tactical'].includes(row.chapter.mode) ? row.chapter.mode : t("interface:other"),
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
    localizedText(pageStatus, () =>t("gameplay:pageOf", { value1: view.page + 1, value2: view.pages, value3: view.total, value4: view.total === 1 ? 'chapter' : 'chapters' }));
    previous.disabled = view.page === 0;
    nextPage.disabled = view.page === view.pages - 1;
    const held = entries.find((entry) => entry.key === view.pinned);
    operationStatus.hidden = !held;
    localizedText(operationStatus, () =>held
      ? t("gameplay:keptVisibleWhileYouBrowse", { value1: busy ? t("interface:workingOn") : t("interface:currentChapter"), value2: contentText(held.chapter, 'name') ?? contentText(held.item, 'name') ?? contentText(held.pack, 'name') })
      : '');
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
            t("gameplay:originalPictures", { value1: legacyWorldMode(item.id), value2: item.levels }),
          ),
          description = node('p', `description-${item.id}`, contentText(item, 'description')),
          state = node('p');
        row = { key: `legacy:${item.id}`, item, card, heading, detail, description, state };
        row.install = action(`install-${item.id}`, t("interface:install"), () => installItem(row.item));
        row.choose = action(`choose-${item.id}`, t("interface:chooseChapter"), () => chooseItem(row.item));
        card.append(heading, detail, description, state, row.install, row.choose);
        rows.set(item.id, row);
      }
      row.item = item;
      localizedText(row.heading, () =>item.name);
      localizedText(contentText(row, 'description'), () =>contentText(item, 'description'));
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
        row.choose = action(`installed-choose-${pack.id}`, t("interface:chooseInstalledChapter"), () =>
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
          node('h3', null, contentText(pack, 'name')),
          node(
            'p',
            null,
            t("gameplay:installedOnThisDeviceOpenTheMissionBriefForIts", { value1: installedWorldMode(pack) }),
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
      localizedText(status, () =>t("interface:pendingDownloadCancelledCompletedInstallsRemainAvailableYourFlightIs"));
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
        localizedText(status, () =>error?.name === 'AbortError'
            ? t("interface:downloadCancelledYourInstalledChaptersAreKept")
            : t("gameplay:nothingWasRemovedUseRefreshOrInstallToRetry", { value1: error.message || error }));
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
      localizedText(status, () =>t("interface:checkingInstalledChapters"));
      if (catalog) await inspectInstalled(signal, catalog);
      await inspectSource(signal, current);
      if (!current()) return;
      refresh();
      localizedText(status, () =>t("interface:readingTheOptionalChapterList"));
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
      localizedText(status, () =>failure
        ? t("gameplay:onlineListUnavailableInstalledAndPreviouslyLoadedChaptersRemainAvailable", { value1: failure.message || failure })
        : t("interface:installationKeepsYourCurrentFlightChooseChapterChangesTheSelected"));
    });
  }
  async function installItem(item) {
    await run(
      async (signal, current) => {
        localizedText(status, () =>t("gameplay:downloadingAndChecking", { value1: item.name }));
        await install(item, { signal });
        await inspectInstalled(signal);
        if (current()) {
          refresh();
          localizedText(status, () =>t("gameplay:installedYourPausedFlightIsKeptChooseChapterWhenReady", { value1: item.name }));
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
        if (sourceRows.length) localizedText(status, () =>t("interface:checkingInstalledPictures"));
        if (catalog) await inspectInstalled(signal);
        await inspectSource(signal, current);
        if (!current()) return;
        refresh();
        if (sourceRows.length)
          localizedText(status, () =>t("interface:chooseAWorldToInstallInstallationKeepsYourCurrentFlight"));
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
