import { captureOperationFocus } from './operation-focus.mjs';
import { createOperationStatus } from './operation-status.mjs';
import { attachSessionOriginalsExport } from './session-originals-export.mjs';
import { attachBackupSetPanel } from './backup-set-panel.mjs';
import { prepareBackup, exportBackup, MAX_BACKUP_BYTES } from '../backup.mjs';
import { importLibrary, exportLibrary, libraryCapacity, campaignKey } from '../library.mjs';
import { canonicalJSON } from '../data-json.mjs';
import {
  preparePack,
  installPack,
  removePack,
  importPackLibrary,
  exportPackLibrary,
} from '../packs.mjs';
import { downloadJSON } from '../content.mjs';
import { BoardPainter, boardPaintSizeForLevel } from './render.mjs';
import { createRun } from '../core/index.mjs';
import { challengeCampaign } from '../challenges.mjs';
import { attachProfileTransferPanel } from './profile-transfer-panel.mjs';
import { masteryFor, pictureMasteries } from './mastery-view.mjs';
import { expandDifficultyCampaigns } from '../campaign-contexts.mjs';
import { createGalleryDifficultyResolver } from '../gallery-difficulty.mjs';
import { collectionResultLabels } from '../collection-results.mjs';
import { resolveEarnedPicture } from './earned-picture.mjs';
import { resolveStoryReceipts } from '../story-receipts.mjs';
import { acquirePresentationImage } from './presentation-image.mjs';
const $ = (id) => document.getElementById(id);
const button = (label, fn) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'button secondary';
  b.textContent = label;
  b.onclick = fn;
  return b;
};
const presenters = new WeakMap();
const status = (id, value, state = 'ready') => {
  const target = $(id),
    message = value instanceof Error ? value.message : String(value);
  let presenter = presenters.get(target);
  if (!presenter) {
    presenter = createOperationStatus(target);
    presenters.set(target, presenter);
  }
  const lease = presenter.begin({ message });
  if (state !== 'busy') lease.finish({ message, state: value instanceof Error ? 'error' : state });
  return lease;
};
const fileText = async (file, max = 32 * 1024 * 1024) => {
  if (!file) throw new Error('Choose a JSON file.');
  if (file.size > max) throw new Error('This file exceeds the import budget.');
  return file.text();
};

export function attachLibraryPanel(api) {
  // Presentation only: the existing task/attempt/backup owner still controls
  // status text, leases, disabled state, cancellation, and focus restoration.
  const feedbackRail = (() => {
    const rail = $('library-operation-rail'),
      message = $('library-operation-message'),
      controls = $('library-operation-controls'),
      dialog = $('library-dialog');
    let placements = [];
    let cancelIds = [];
    let layoutPending = false;
    const keepFocusVisible = () => {
      if (rail.hidden || !dialog.open) return;
      const area = dialog.getBoundingClientRect(),
        feedback = rail.getBoundingClientRect(),
        focused = document.activeElement;
      const top = feedback.bottom + 8;
      dialog.style.scrollPaddingBlockStart = `${Math.max(0, top - area.top)}px`;
      if (
        !focused ||
        !dialog.contains(focused) ||
        rail.contains(focused) ||
        focused.disabled ||
        !focused.getClientRects().length ||
        document.hidden ||
        document.hasFocus?.() === false
      )
        return;
      const target = focused.getBoundingClientRect();
      if (focused.hasAttribute('data-close')) {
        // Close lives before the rail. It must remain reachable above it.
        dialog.style.scrollPaddingBlockStart = '0px';
        if (target.top < area.top || target.bottom > area.bottom)
          focused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      } else if (target.top < top) dialog.scrollTop += target.top - top;
      else if (target.bottom > area.bottom - 8)
        // A tall editor may not fit below feedback. Keep its beginning visible
        // rather than hiding it again while trying to reveal its lower edge.
        dialog.scrollTop += Math.min(target.bottom - (area.bottom - 8), target.top - top);
    };
    const scheduleLayout = () => {
      if (layoutPending || typeof requestAnimationFrame !== 'function') return;
      layoutPending = true;
      requestAnimationFrame(() => {
        layoutPending = false;
        keepFocusVisible();
      });
    };
    dialog.addEventListener('focusin', scheduleLayout);
    globalThis.addEventListener?.('resize', scheduleLayout);
    if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleLayout).observe(rail);
    const clear = (id = null) => {
      if (id && rail.dataset.statusId !== id) return;
      for (const { element, placeholder } of placements) {
        placeholder.after(element);
        placeholder.remove();
      }
      placements = [];
      cancelIds = [];
      rail.hidden = true;
      delete rail.dataset.statusId;
      dialog.style.scrollPaddingBlockStart = '0px';
    };
    const present = (id, nextCancelIds = []) => {
      if (
        rail.dataset.statusId === id &&
        cancelIds.length === nextCancelIds.length &&
        cancelIds.every((value, index) => value === nextCancelIds[index])
      )
        return;
      const focused = document.activeElement;
      const moving = [$(id), ...nextCancelIds.map($)];
      const movedFocus = [...placements.map(({ element }) => element), ...moving].some((element) =>
        element?.contains(focused),
      );
      clear();
      const mount = (element, destination) => {
        if (!element || element.parentNode === destination) return;
        const placeholder = document.createElement('span');
        placeholder.hidden = true;
        element.after(placeholder);
        element.remove();
        placements.push({ element, placeholder });
        destination.append(element);
      };
      mount($(id), message);
      for (const cancelId of nextCancelIds) mount($(cancelId), controls);
      cancelIds = [...nextCancelIds];
      rail.dataset.statusId = id;
      rail.hidden = false;
      scheduleLayout();
      if (
        movedFocus &&
        focused?.isConnected &&
        !focused.disabled &&
        focused.getClientRects().length &&
        $('library-dialog').open &&
        !document.hidden &&
        document.hasFocus?.() !== false
      )
        focused.focus({ preventScroll: true });
    };
    return { present, clear };
  })();
  let galleryPopulation = 0,
    viewBackdrop = null;
  const releaseViewBackdrop = () => {
    viewBackdrop?.release();
    viewBackdrop = null;
  };
  let transferPanel = null;
  let attemptExport = null;
  let libraryTask = null;
  let libraryTaskGeneration = 0;
  let backupSetPanel = null;
  let sessionOriginals = null;
  let clearBackupFeedbackOnSettle = false;
  let previousLibrary = null,
    previousBackup = null,
    busy = false,
    view = null,
    viewReady = false,
    galleryFrame = 0,
    viewGeneration = 0,
    returnToCollection = true,
    launchGeneration = 0;
  let galleryPage = 0,
    scorePage = 0,
    galleryReturn = null,
    galleryReturnFocus = null,
    collectionReturn = null,
    collectionVisit = 0;
  const galleryCards = new Map();
  const gallerySealSlots = new Map();
  const pagers = new Map();
  const installedRows = new Map();
  let installedRenderGeneration = 0;
  let pictureSealsSignature = null,
    viewVariants = [],
    catalogSource = null,
    difficultyResolver = null;
  const executionEntries = () => api.executionCatalog?.() ?? api.catalog?.() ?? [];
  function difficulties() {
    const entries = executionEntries();
    if (
      !catalogSource ||
      catalogSource.length !== entries.length ||
      entries.some((entry, index) => entry !== catalogSource[index])
    ) {
      catalogSource = [...entries];
      difficultyResolver = createGalleryDifficultyResolver(entries);
    }
    return difficultyResolver;
  }
  const pictureMeta = (picture) =>
    `${picture.theme.name} · ${picture.label} · ${collectionResultLabels(picture.item, api.get().library).detail}`;
  const storyButton = document.createElement('button');
  storyButton.id = 'gallery-story';
  storyButton.type = 'button';
  storyButton.className = 'button secondary';
  storyButton.textContent = 'Play earned story';
  storyButton.hidden = true;
  if (api.openStory) $('gallery-view-dialog').querySelector('.overlay-actions').append(storyButton);
  const earnedStory = (picture) => {
    const library = api.get().library,
      story = library.storyReceipts?.find((row) => row.galleryKey === picture?.item.key);
    if (!story?.storyPin || !picture.receipt) return null;
    // The resolved picture already establishes exact execution→retained owner authority.
    resolveEarnedPicture({
      item: picture.item,
      receipt: picture.receipt,
      metadata: picture.media?.metadata,
      entries: executionEntries(),
    });
    return resolveStoryReceipts([story], [picture.receipt], [picture.item])[0].storyPin;
  };
  storyButton.onclick = () => {
    if (!view || !viewReady || !$('gallery-view-dialog').open || !api.openStory) return;
    try {
      const pin = earnedStory(view),
        source = $('gallery-canvas'),
        picture = view,
        backdrop = viewBackdrop;
      if (!pin) return;
      if (!backdrop) throw new Error('Restore this earned story’s exact picture before playing.');
      cancelAnimationFrame(galleryFrame);
      void api
        .openStory({
          pin,
          title: picture.level.name,
          drawPoster(canvas) {
            canvas.width = source.width;
            canvas.height = source.height;
            galleryPainter.drawGallery(canvas.getContext('2d'), {
              theme: picture.theme,
              level: picture.level,
              seed: picture.item.seed,
              width: canvas.width,
              height: canvas.height,
              image: backdrop.image,
              fit: backdrop.fit,
            });
          },
        })
        .catch((error) => status('gallery-view-meta', error));
    } catch (error) {
      status('gallery-view-meta', error);
    }
  };
  const galleryPainter = new BoardPainter(api.get().presets);
  const reducedEffects = () =>
    (typeof api.getReducedEffects === 'function'
      ? api.getReducedEffects()
      : api.get().library.preferences.reducedEffects) === true;
  function open(panel = 'scores') {
    launchGeneration++;
    const invalidatedBackup = backupSetPanel?.invalidate();
    if (libraryTask)
      feedbackRail.present(
        libraryTask.id,
        libraryTask.id === 'transfer-status' ? ['transfer-cancel'] : [],
      );
    else if (attemptExport) feedbackRail.present('save-status', ['cancel-attempt-export']);
    else if (invalidatedBackup && busy) {
      // Cancellation still joins its pending read. Keep feedback visible while
      // that owner holds the lock, then discard its navigated-away terminal.
      clearBackupFeedbackOnSettle = true;
      feedbackRail.present('backup-set-status', ['cancel-backup-set']);
    } else feedbackRail.clear();
    api.pause();
    for (const id of ['scores', 'saves', 'packs', 'challenges'])
      $(`library-${id}`).hidden = id !== panel;
    refresh();
    if (!$('library-dialog').open) $('library-dialog').showModal();
  }
  // Launch ownership is separate from import/export operation ownership. A
  // delayed decision may close only the exact Library visit or picture it opened.
  const launchForeground = () => !document.hidden && document.hasFocus?.() !== false;
  const retireLaunch = () => {
    launchGeneration++;
  };
  // This epoch retires launch intent only. Existing picture/media and P01
  // import/export operations retain their own independent lifetime.
  const pageEvents = globalThis.window ?? globalThis;
  pageEvents.addEventListener?.('blur', retireLaunch);
  pageEvents.addEventListener?.('pagehide', retireLaunch);
  document.addEventListener?.('visibilitychange', () => {
    if (document.hidden) retireLaunch();
  });
  function libraryLaunchCurrent(panel, opener, generation) {
    return (
      launchForeground() &&
      generation === launchGeneration &&
      $('library-dialog').open &&
      !$(`library-${panel}`).hidden &&
      opener.isConnected &&
      !opener.disabled
    );
  }
  async function launch(descriptor, { opener, isCurrent, close, entry, options, statusId }) {
    const onSelected = () => {
      if (!isCurrent()) return;
      close();
      api.focusMission?.();
    };
    try {
      if (!isCurrent()) return false;
      if (api.requestLaunch)
        return await api.requestLaunch(descriptor, { opener, isCurrent, onSelected });
      // Optional injection preserves standalone panel callers and their existing
      // selection contract. The Solo host always supplies its checked decision.
      api.select(entry, options);
      onSelected();
      return true;
    } catch (error) {
      if (isCurrent()) status(statusId, error);
      return false;
    }
  }
  $('library-dialog').addEventListener('close', () => {
    if (!$('library-dialog').open) launchGeneration++;
  });
  function pagerFor(id) {
    let pager = pagers.get(id);
    if (!pager) {
      pager = {
        nav: $(id),
        search: $(id === 'gallery-pages' ? 'gallery-search' : 'score-search'),
        label: document.createElement('span'),
        page: 0,
        change: null,
        pending: null,
      };
      const activate = (control, offset) => {
        if (control.disabled || !control.isConnected || pager.nav.hidden) return;
        return pager.change?.(pager.page + offset, control);
      };
      pager.previous = button('Previous', () => activate(pager.previous, -1));
      pager.next = button('Next', () => activate(pager.next, 1));
      pagers.set(id, pager);
    }
    return pager;
  }
  function beginPagerFocus(id, requestedOpener) {
    const pager = pagerFor(id),
      previous = pager.pending,
      focused = document.activeElement,
      opener = [pager.previous, pager.next].includes(focused) ? focused : null,
      owner = { pager, focus: null, current: null, ticket: null };
    pager.pending = owner;
    if (previous && !(opener && requestedOpener === opener)) {
      // Transfer the same lease, including its retired state. Superseding an
      // automatic read neither loses live intent nor captures new permission.
      owner.focus = previous.focus;
      owner.ticket = previous.ticket;
      previous.focus = null;
      previous.ticket = null;
      if (owner.ticket) owner.ticket.owner = owner;
      return owner;
    }
    previous?.focus?.cancel();
    if (opener) {
      const ticket = { owner };
      owner.ticket = ticket;
      owner.focus = captureOperationFocus(opener, {
        document,
        reveal: true,
        resolveTarget: () => {
          const currentOwner = ticket.owner;
          if (pager.pending !== currentOwner || !currentOwner.current?.()) return null;
          // Reading the current model may synchronously start another render.
          if (ticket.owner !== currentOwner || pager.pending !== currentOwner) return null;
          const opposite = opener === pager.previous ? pager.next : pager.previous;
          return (
            [opener, opposite].find(
              (control) => !pager.nav.hidden && control.isConnected && !control.disabled,
            ) ?? pager.search
          );
        },
      });
    }
    return owner;
  }
  function endPagerFocus(owner, current = null) {
    try {
      owner.current = current;
      if (owner.pager.pending === owner && current?.()) owner.focus?.restore();
    } finally {
      owner.focus?.cancel();
      if (owner.pager.pending === owner) owner.pager.pending = null;
    }
  }
  function paginate(id, page, total, size, change) {
    const pages = Math.max(1, Math.ceil(total / size)),
      pager = pagerFor(id),
      { nav, previous, next, label } = pager;
    pager.page = page;
    pager.change = change;
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    label.textContent = `${total} entries · page ${page + 1} of ${pages}`;
    if (id === 'gallery-pages') {
      nav.hidden = pages <= 1;
      if (nav.hidden) {
        nav.replaceChildren();
        return;
      }
    }
    // Updating an existing pager must not detach its focused native control.
    if (!nav.contains(previous)) nav.append(previous, label, next);
  }
  function renderScores(opener) {
    const owner = beginPagerFocus('score-pages', opener);
    let library = null;
    try {
      library = renderScorePage();
    } finally {
      endPagerFocus(owner, library ? () => library === api.get().library : null);
    }
  }
  function renderScorePage() {
    const { library } = api.get();
    const resolver = difficulties();
    $('scoreboard').replaceChildren();
    const groups = Map.groupBy
      ? Map.groupBy(library.scores, (s) => s.boardId)
      : library.scores.reduce(
          (m, s) => m.set(s.boardId, [...(m.get(s.boardId) || []), s]),
          new Map(),
        );
    const query = $('score-search').value.toLowerCase().trim(),
      matches = [...groups.values()].filter((entries) =>
        `${entries[0].levelName} ${entries[0].classRoute.join(' ')} ${resolver.label(entries[0].campaignKey)}`
          .toLowerCase()
          .includes(query),
      );
    scorePage = Math.min(scorePage, Math.max(0, Math.ceil(matches.length / 10) - 1));
    for (const entries of matches.slice(scorePage * 10, scorePage * 10 + 10)) {
      const group = document.createElement('section'),
        title = document.createElement('h3'),
        copy = document.createElement('p');
      title.textContent = entries[0].levelName;
      copy.className = 'micro-note';
      copy.textContent = `${resolver.label(entries[0].campaignKey)} · ${entries[0].classRoute.join(' → ')} · ${entries[0].turnPolicy} · seed ${entries[0].seed}`;
      group.append(title, copy);
      const list = document.createElement('ol');
      for (const entry of [...entries].sort((a, b) => b.score - a.score || a.time - b.time)) {
        const li = document.createElement('li');
        li.textContent = `${entry.score.toLocaleString()} points · ${entry.time.toFixed(2)}s · ${entry.medal} · ${entry.completedAt.slice(0, 10)}`;
        list.append(li);
      }
      group.append(list);
      $('scoreboard').append(group);
    }
    if (!matches.length)
      $('scoreboard').textContent = library.scores.length
        ? 'No scores match this search.'
        : 'Your first completed flight will appear here.';
    paginate('score-pages', scorePage, matches.length, 10, (p, opener) => {
      scorePage = p;
      renderScores(opener);
    });
    return library;
  }
  $('score-search').oninput = () => {
    scorePage = 0;
    renderScores();
  };
  $('gallery-search').oninput = () => {
    galleryPage = 0;
    populateGallery();
  };
  function refresh() {
    sessionOriginals?.refresh();
    backupSetPanel?.checkCurrent();
    transferPanel?.refresh();
    renderScores();
    $('undo-library').disabled = !previousLibrary;
    $('undo-backup').disabled = !previousBackup;
    const usage = libraryCapacity(api.get().library);
    $('library-capacity').textContent =
      `${usage.gallery} / ${usage.maxGallery} pictures · ${usage.masteries} / ${usage.maxMasteries} equipment seals · ${usage.campaigns} / ${usage.maxCampaigns} campaigns · ${usage.percent.toFixed(1)}% of profile budget. Old pictures are preserved; export archives before reaching capacity.`;
    const saved = api.saved();
    $('suspended-status').textContent = saved
      ? `Saved flight: ${saved.replay?.level?.name || 'Unknown'} · ${difficulties().label(saved.campaignKey)} · ${typeof saved.savedAt === 'string' ? saved.savedAt.replace('T', ' ').slice(0, 19) : 'Date unavailable'}`
      : 'No suspended attempt. Use Save & pause during a flight.';
    $('resume-save').disabled = !saved;
    const exportSource = api.attemptExportSource();
    $('export-session').textContent = exportSource.label;
    $('export-session').disabled = busy || exportSource.source === null;
    $('attempt-export-source').textContent = exportSource.reason;
    installedRenderGeneration++;
    installedRows.clear();
    $('installed-packs').replaceChildren();
    for (const pack of api.get().packs.packs) {
      const row = document.createElement('article'),
        plays = [];
      row.dataset.packId = pack.id;
      row.dataset.packVersion = pack.version;
      const title = document.createElement('strong');
      title.textContent = `${pack.name} · ${pack.version}`;
      const p = document.createElement('p');
      p.textContent = pack.description;
      row.append(title, p);
      for (const source of pack.campaigns) {
        const play = button(`Play ${source.title || source.name || source.id}`, () => {
          const entry = api
              .catalog()
              .find((c) => c.sourcePackId === pack.id && c.campaign.id === source.id),
            generation = launchGeneration;
          if (!entry) {
            status('pack-status', new Error('That installed campaign is unavailable.'));
            return;
          }
          return launch(
            { kind: 'library-installed', id: campaignKey(entry.campaign) },
            {
              opener: play,
              isCurrent: () => libraryLaunchCurrent('packs', play, generation),
              close: () => $('library-dialog').close(),
              entry,
              statusId: 'pack-status',
            },
          );
        });
        play.dataset.packAction = 'play';
        play.dataset.campaignId = source.id;
        plays.push(play);
        row.append(play);
      }
      const remove = button('Remove from device', () => {
        const focusReturn = packRemovalFocus(pack);
        return task(
          'pack-status',
          async (operation) => {
            operation.commit('Removing the installed pack…');
            await api.setPacks(removePack(api.get().packs, pack.id));
            operation.check();
            refresh();
            status(
              'pack-status',
              'Pack removed. Player records and earned uploaded originals are preserved. Reinstall its exact pack to play again or view pack-embedded artwork.',
            );
          },
          undefined,
          focusReturn,
        );
      });
      remove.dataset.packAction = 'remove';
      row.append(remove);
      installedRows.set(pack.id, { pack, row, plays, remove });
      $('installed-packs').append(row);
    }
    if (libraryTask) {
      for (const control of $('library-dialog').querySelectorAll('button,input,select,textarea'))
        if (!control.hasAttribute('data-close'))
          control.disabled = control !== $('library-operation-cancel');
    }
    if (attemptExport) {
      for (const control of $('library-dialog').querySelectorAll('button,input,select,textarea'))
        control.disabled = control !== $('cancel-attempt-export') || !!attemptExport.detached;
    }
  }
  function packRemovalFocus(pack) {
    const visit = launchGeneration,
      order = api.get().packs.packs.map(({ id, version }) => ({ id, version })),
      index = order.findIndex((item) => item.id === pack.id && item.version === pack.version),
      valid = index >= 0 && installedRows.get(pack.id)?.pack === pack,
      neighbors = [...order.slice(index + 1), ...order.slice(0, index).reverse()];
    let settled = null,
      taskGeneration = -1,
      generation = -1;
    const current = () =>
      valid &&
      !libraryTask &&
      libraryTaskGeneration === taskGeneration &&
      visit === launchGeneration &&
      $('library-dialog').open &&
      !$('library-packs').hidden &&
      api.get().packs === settled &&
      installedRenderGeneration === generation;
    return {
      beforeRefresh() {
        settled = api.get().packs;
        taskGeneration = libraryTaskGeneration;
      },
      afterRefresh() {
        generation = installedRenderGeneration;
      },
      resolve() {
        if (!current()) return null;
        const remaining = settled.packs.find((item) => item.id === pack.id);
        let target = $('library-dialog').querySelector('[data-library-panel="packs"]');
        if (remaining?.version === pack.version) {
          const row = installedRows.get(pack.id);
          if (row?.pack === remaining) target = row.remove;
        } else if (!remaining) {
          for (const item of neighbors) {
            const row = installedRows.get(item.id);
            if (row?.pack.version === item.version && row.plays[0]) {
              target = row.plays[0];
              break;
            }
          }
        }
        return current() ? target : null;
      },
    };
  }
  $('library-dialog').addEventListener('cancel', (e) => {
    if (e.target !== $('library-dialog')) return;
    if (cancelAttemptExport() || busy) e.preventDefault();
  });
  $('library-dialog').addEventListener('close', () => {
    if (!$('library-dialog').open) {
      endAttemptExport(false);
      cancelLibraryTask(false);
      sessionOriginals?.invalidate();
      feedbackRail.clear();
    }
  });
  globalThis.addEventListener?.('pagehide', () => {
    endAttemptExport(false);
    cancelLibraryTask(false);
  });

  function currentAttemptExport(operation) {
    return (
      attemptExport === operation &&
      !operation.controller.signal.aborted &&
      $('library-dialog').open
    );
  }
  function endAttemptExport(restoreFocus) {
    const operation = attemptExport;
    if (!operation) return;
    attemptExport = null;
    operation.controller.abort();
    busy = false;
    for (const { element, disabled } of operation.controls)
      if (element.isConnected) element.disabled = disabled;
    $('cancel-attempt-export').hidden = true;
    $('cancel-attempt-export').disabled = true;
    refresh();
    if (
      restoreFocus &&
      $('library-dialog').open &&
      !document.hidden &&
      document.hasFocus?.() !== false
    ) {
      const target = $('export-session').disabled ? $('export-library') : $('export-session');
      target.focus({ preventScroll: true });
    }
  }
  function cancelAttemptExport() {
    if (backupSetPanel?.cancel()) return true;
    if (libraryTask) return cancelLibraryTask();
    if (!attemptExport) return false;
    if (attemptExport.phase === 'download') {
      attemptExport.detached = true;
      status(
        'save-status',
        'Stopped waiting. The requested download is still finishing; the verified copy remains available below.',
        'detached',
      );
      $('cancel-attempt-export').hidden = true;
      $('cancel-attempt-export').disabled = true;
      return true;
    }
    endAttemptExport(true);
    status('save-status', 'Export cancelled. The previous copy is unchanged.');
    return true;
  }
  $('cancel-attempt-export').onclick = cancelAttemptExport;
  $('library-operation-cancel').onclick = () => cancelLibraryTask();

  async function exportAttempt() {
    if (busy || !$('library-dialog').open) return;
    const source = api.attemptExportSource();
    feedbackRail.present('save-status', ['cancel-attempt-export']);
    if (source.source === null) {
      status('save-status', source.reason);
      return;
    }
    const operation = {
      controller: new AbortController(),
      phase: 'verifying',
      controls: [...$('library-dialog').querySelectorAll('button,input,select,textarea')].map(
        (element) => ({ element, disabled: element.disabled }),
      ),
    };
    attemptExport = operation;
    busy = true;
    for (const { element } of operation.controls) element.disabled = true;
    $('cancel-attempt-export').textContent = 'Cancel export';
    $('cancel-attempt-export').hidden = false;
    $('cancel-attempt-export').disabled = false;
    $('cancel-attempt-export').focus({ preventScroll: true });
    status(
      'save-status',
      `Checking the ${source.source === 'stored' ? 'saved' : 'current'} attempt…`,
      'busy',
    );
    try {
      const prepared = await api.prepareAttemptFile({
        signal: operation.controller.signal,
        onProgress: ({ ticks, total }) => {
          if (currentAttemptExport(operation))
            status('save-status', 'Checking flight inputs…', 'busy').update({
              progress: total > 0 ? { completed: ticks, total, unit: 'ticks' } : null,
            });
        },
      });
      if (!currentAttemptExport(operation)) return;
      const text = JSON.stringify(prepared.session, null, 2);
      prepared.assertCurrent();
      if (!currentAttemptExport(operation)) return;
      operation.phase = 'download';
      $('cancel-attempt-export').textContent = 'Stop waiting';
      $('save-json').value = text;
      status('save-status', 'Preparing the verified attempt download…', 'busy');
      const exported = await downloadJSON(prepared.session, 'revealline-suspended-flight.json');
      if (!currentAttemptExport(operation)) return;
      const session = prepared.session;
      status(
        'save-status',
        `${prepared.source === 'stored' ? 'Saved' : 'Current'} attempt prepared: ${session.replay.level.name} · ${difficulties().label(session.campaignKey)} · ${session.savedAt.replace('T', ' ').slice(0, 19)}. ${prepared.context === 'replay-only' ? 'Replay verified; the exact matching campaign is still required to resume. ' : ''}${exported.message}`,
      );
    } catch (error) {
      if (currentAttemptExport(operation)) status('save-status', error);
    } finally {
      if (attemptExport === operation) endAttemptExport(true);
    }
  }
  async function backupOptions() {
    await api.assertExternalBackupSupported?.({ kind: 'backup' });
    let media = null;
    try {
      media = api.pictureMedia ? await api.pictureMedia() : null;
    } catch {
      /* Game-data backup remains available without unrelated original media. */
    }
    return {
      ...(api.backupPreparation ?? {}),
      ...(api.resolveMediaIdentityCatalog
        ? { resolveMediaIdentityCatalog: api.resolveMediaIdentityCatalog(media?.metadata ?? null) }
        : {}),
      campaigns: [api.base().campaign],
      expandCampaigns: expandDifficultyCampaigns,
      resolveCampaign: (key) => {
        const match = /^route-(\d{4}-\d\d-\d\d)-(daily|calm|expert)\//.exec(key);
        if (!match) return null;
        return challengeCampaign(match[1], match[2], api.base().classRecipes);
      },
    };
  }
  async function backupContents() {
    if (api.backupSnapshot) return api.backupSnapshot();
    const { library, packs } = api.get();
    return { library, packs, session: api.currentSession() };
  }
  function releaseTask(owner, restoreFocus = true) {
    if (libraryTask !== owner) return;
    owner.focusReturn?.beforeRefresh();
    libraryTask = null;
    busy = false;
    for (const { element, disabled } of owner.controls)
      if (element.isConnected) element.disabled = disabled;
    const cancel = $('library-operation-cancel');
    cancel.hidden = true;
    cancel.disabled = true;
    refresh();
    owner.focusReturn?.afterRefresh();
    if (restoreFocus && !owner.detached) owner.focus.restore();
    else owner.focus.cancel();
  }
  function cancelLibraryTask(restoreFocus = true) {
    const owner = libraryTask;
    if (!owner) return false;
    if (owner.committing) {
      owner.detached = true;
      owner.focus.cancel();
      status(
        owner.id,
        'Stopped waiting. This operation is still finishing; Library changes remain locked until its result is known.',
        'detached',
      );
      $('library-operation-cancel').hidden = true;
    } else {
      // An actual focused Cancel is a new decision, separate from automatic
      // completion after the user has deliberately tabbed elsewhere.
      if (restoreFocus && document.activeElement === $('library-operation-cancel')) {
        owner.focus.cancel();
        owner.focus = captureOperationFocus($('library-operation-cancel'), {
          restoreTo: owner.opener,
        });
      }
      owner.controller.abort();
      status(
        owner.id,
        'Cancelled. The current collection and saved flight are unchanged.',
        'cancelled',
      );
      releaseTask(owner, restoreFocus);
    }
    return true;
  }
  async function task(id, fn, label = 'Preparing Library operation…', focusReturn = null) {
    if (busy) return;
    libraryTaskGeneration++;
    const owner = {
      id,
      controller: new AbortController(),
      committing: false,
      detached: false,
      opener: document.activeElement,
      focusReturn,
      controls: [...$('library-dialog').querySelectorAll('button,input,select,textarea')].map(
        (element) => ({ element, disabled: element.disabled }),
      ),
    };
    owner.focus = captureOperationFocus(owner.opener, {
      owned: [$('library-operation-cancel')],
      resolveTarget: focusReturn?.resolve,
    });
    libraryTask = owner;
    busy = true;
    feedbackRail.present(id, id === 'transfer-status' ? ['transfer-cancel'] : []);
    status(id, label, 'busy');
    for (const { element } of owner.controls)
      if (!element.hasAttribute('data-close')) element.disabled = true;
    const cancel = $('library-operation-cancel');
    cancel.textContent = 'Cancel operation';
    cancel.hidden = false;
    cancel.disabled = false;
    const check = () => {
      if (libraryTask !== owner || owner.controller.signal.aborted)
        throw new DOMException('Library operation cancelled.', 'AbortError');
    };
    const context = {
      controller: owner.controller,
      signal: owner.controller.signal,
      check,
      phase(message) {
        check();
        if (!owner.detached) status(id, message, 'busy');
      },
      commit(message) {
        check();
        owner.committing = true;
        status(id, message, 'busy');
        cancel.textContent = 'Stop waiting';
      },
    };
    try {
      await fn(context);
      check();
      if (['busy', 'detached'].includes($(id).dataset.state))
        status(id, 'Library operation complete.');
    } catch (error) {
      if (libraryTask === owner)
        status(
          id,
          error.name === 'AbortError' ? 'Cancelled. The current collection is unchanged.' : error,
          error.name === 'AbortError' ? 'cancelled' : 'error',
        );
    } finally {
      releaseTask(owner);
    }
  }
  async function install(candidate, context = null) {
    const work = async (operation) => {
      operation.phase('Validating pack content and original images…');
      const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      const before = api.get().packs;
      let next;
      if (parsed.format === 'xonix-pack-library.v1')
        next = await importPackLibrary(parsed, { signal: operation.signal });
      else {
        const prepared = await preparePack(parsed, { library: before, signal: operation.signal });
        next = installPack(before, prepared.pack);
      }
      operation.check();
      if (api.get().packs !== before)
        throw new Error('Installed content changed; prepare this pack again.');
      operation.commit('Saving the verified installed pack…');
      await api.setPacks(next);
      operation.check();
      refresh();
      status(
        'pack-status',
        'Validated and installed. Choose Play above or use the Campaign selector.',
      );
    };
    return context ? work(context) : task('pack-status', work, 'Validating the selected pack…');
  }
  async function importSave(candidate, context = null) {
    const work = async (operation) => {
      operation.phase('Reading and validating imported game data…');
      if (
        typeof candidate === 'string' &&
        new TextEncoder().encode(candidate).byteLength > MAX_BACKUP_BYTES
      )
        throw new Error('This backup exceeds the import budget.');
      const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      if (['xonix-backup.v1', 'xonix-backup.v2'].includes(parsed.format)) {
        const options = await backupOptions();
        operation.check();
        const prepared = await prepareBackup(parsed, { ...options, signal: operation.signal });
        operation.check();
        const applied = await applyPrepared(prepared, operation);
        status(
          'save-status',
          `Game data restored. ${prepared.session ? 'Your saved flight is ready to load.' : 'This backup has no saved flight.'} ${applied.undo ? 'Undo restores the previous collection, packs and saved flight.' : 'The previous data could not form a verified backup, so Undo is unavailable.'} ${applied.warning || ''}`,
        );
        return;
      }
      if (
        ['xonix-session.v1', 'xonix-session.v2', 'xonix-session.v3', 'xonix-session.v4'].includes(
          parsed.format,
        )
      ) {
        operation.commit('Restoring the verified saved flight…');
        await api.restore(parsed);
        operation.check();
        $('library-dialog').close();
        api.focusMission?.();
        return;
      }
      const next = importLibrary(parsed, { campaigns: executionEntries().map((c) => c.campaign) });
      operation.commit('Saving the imported player library…');
      api.beforeProfileReplacement?.();
      previousLibrary = api.get().library;
      const result = api.setLibrary(next);
      $('undo-library').disabled = false;
      refresh();
      status(
        'save-status',
        result.ok
          ? 'Player library loaded. Previous library is available with Undo.'
          : result.warning,
      );
    };
    return context ? work(context) : task('save-status', work, 'Validating imported game data…');
  }
  async function applyPrepared(prepared, operation) {
    operation?.phase('Preparing an undo copy of the current collection…');
    api.beforeProfileReplacement?.();
    let old = null;
    try {
      if (api.canSnapshotBackup()) {
        const options = await backupOptions();
        const contents = await backupContents();
        old = await prepareBackup(
          {
            format: Object.hasOwn(contents, 'externalChapters')
              ? 'xonix-backup.v2'
              : 'xonix-backup.v1',
            ...contents,
          },
          options,
        );
      }
    } catch {}
    operation?.check();
    operation?.commit('Saving the verified collection and saved flight…');
    const applied = await api.applyBackup(prepared);
    operation?.check();
    previousBackup = old;
    previousLibrary = null;
    refresh();
    return { ...applied, undo: old !== null };
  }
  transferPanel = attachProfileTransferPanel({
    api,
    container: $('library-saves'),
    backupOptions,
    task,
    setStatus: (message, state) => status('transfer-status', message, state),
    applyPrepared,
  });
  $('library-button').onclick = () => open();
  for (const b of document.querySelectorAll('[data-library-panel]'))
    b.onclick = () => open(b.dataset.libraryPanel);
  if (api.backupSet && $('backup-set'))
    backupSetPanel = attachBackupSetPanel({
      document,
      dialog: $('library-dialog'),
      root: $('backup-set'),
      source: {
        ...api.backupSet,
        readGame: async (options) => ({
          contents: await api.backupSet.readContents(options),
          options: await backupOptions(),
        }),
      },
      busy: () => busy,
      setBusy: (value) => {
        busy = value;
        if (!value && clearBackupFeedbackOnSettle) {
          clearBackupFeedbackOnSettle = false;
          feedbackRail.clear('backup-set-status');
        }
      },
      refresh,
      presentFeedback: () => feedbackRail.present('backup-set-status', ['cancel-backup-set']),
    });
  sessionOriginals =
    api.sessionPictures && $('session-originals')
      ? attachSessionOriginalsExport({
          registry: api.sessionPictures,
          root: $('session-originals'),
          note: $('session-originals-note'),
          prepare: $('prepare-session-originals'),
          download: $('download-session-originals'),
          task: (work) => task('save-status', work, 'Preparing session-only picture originals…'),
          setStatus: (message) => status('save-status', message),
        })
      : null;
  $('export-backup').onclick = () =>
    task('save-status', async (operation) => {
      operation.phase('Reading saved game data and original references…');
      const options = await backupOptions();
      operation.check();
      const contents = await backupContents();
      operation.phase('Verifying the game-data backup…');
      const text = await exportBackup(contents, { ...options, signal: operation.signal });
      operation.check();
      $('save-json').value = text;
      operation.commit('Preparing the requested download…');
      const exported = await downloadJSON(JSON.parse(text), 'revealline-complete-backup.json');
      status(
        'save-status',
        `Game data prepared: player library, installed chapters and saved flight. Restore picture originals from .rlmedia before this file. Stories need .rlstory and custom music needs .rlsound. ${exported.message} ${api.sessionNote?.() || ''}`,
      );
    });
  $('undo-backup').onclick = () =>
    task('save-status', async (operation) => {
      if (!previousBackup) return;
      operation.commit('Restoring the previous collection and saved flight…');
      await api.applyBackup(previousBackup);
      operation.check();
      previousBackup = null;
      previousLibrary = null;
      $('undo-backup').disabled = true;
      $('undo-library').disabled = true;
      refresh();
      status('save-status', 'Previous collection, packs and saved flight restored.');
    });
  $('export-library').onclick = () =>
    task('save-status', async (operation) => {
      const text = exportLibrary(api.get().library);
      $('save-json').value = text;
      operation.commit('Preparing the requested download…');
      const exported = await downloadJSON(JSON.parse(text), 'revealline-player-library.json');
      status(
        'save-status',
        `Library prepared. ${exported.message} Keep packs and attempt files alongside it. ${api.sessionNote?.() || ''}`,
      );
    });
  $('import-save').onclick = () => importSave($('save-json').value);
  $('save-file').onchange = () => {
    const file = $('save-file').files[0];
    $('save-file').value = '';
    if (!file) return;
    return task('save-status', async (operation) => {
      operation.phase('Reading the selected game-data file…');
      const text = await fileText(file, MAX_BACKUP_BYTES);
      operation.check();
      await importSave(text, operation);
    });
  };
  $('undo-library').onclick = () => {
    if (previousLibrary) {
      feedbackRail.present('save-status');
      const result = api.setLibrary(previousLibrary);
      if (result.ok) previousLibrary = null;
      $('undo-library').disabled = true;
      refresh();
      status(
        'save-status',
        result.ok
          ? 'Previous player library restored.'
          : `Previous library is active for this session. ${result.warning}`,
      );
    }
  };
  $('resume-save').onclick = () =>
    task('save-status', async (operation) => {
      operation.commit('Preparing the saved flight to resume paused…');
      await api.restore(api.saved());
      operation.check();
      $('library-dialog').close();
      api.focusMission?.();
    });
  $('export-session').onclick = exportAttempt;
  $('install-pack').onclick = () => install($('pack-json').value);
  $('pack-file').onchange = () => {
    const file = $('pack-file').files[0];
    $('pack-file').value = '';
    if (!file) return;
    return task('pack-status', async (operation) => {
      operation.phase('Reading the selected pack file…');
      const text = await fileText(file, 64 * 1024 * 1024);
      operation.check();
      await install(text, operation);
    });
  };
  $('export-packs').onclick = () =>
    task('pack-status', async (operation) => {
      operation.phase('Checking installed packs for export…');
      await api.assertExternalBackupSupported?.({ kind: 'packs' });
      operation.check();
      const text = exportPackLibrary(api.get().packs);
      $('pack-json').value = text;
      operation.commit('Preparing the requested download…');
      const exported = await downloadJSON(JSON.parse(text), 'revealline-expansion-packs.json');
      status(
        'pack-status',
        `Installed packs prepared with their original embedded images. ${exported.message}`,
      );
    });
  $('challenge-date').value = new Date().toISOString().slice(0, 10);
  $('launch-challenge').onclick = () => {
    try {
      const date = $('challenge-date').value,
        kind = $('challenge-kind').value,
        c = challengeCampaign(date, kind, api.base().classRecipes),
        opener = $('launch-challenge'),
        generation = launchGeneration;
      return launch(
        { kind: 'library-challenge', id: c.id },
        {
          opener,
          isCurrent: () =>
            libraryLaunchCurrent('challenges', opener, generation) &&
            $('challenge-date').value === date &&
            $('challenge-kind').value === kind,
          close: () => $('library-dialog').close(),
          entry: { ...api.base(), campaign: c, activity: 'challenge' },
          statusId: 'challenge-status',
        },
      );
    } catch (e) {
      status('challenge-status', e);
    }
  };
  const exampleStatus = document.createElement('p');
  $('builtin-packs').append(exampleStatus);
  const examples = createOperationStatus(exampleStatus);
  const examplesLease = examples.begin({ message: 'Loading example packs…' });
  fetch('content/packs/index.json')
    .then((r) => {
      if (!r.ok) throw new Error('Example packs could not load.');
      return r.json();
    })
    .then((index) => {
      examplesLease.finish({ message: '' });
      for (const pack of index.packs) {
        $('builtin-packs').append(
          button(`Install ${pack.id.replaceAll('-', ' ')}`, async () => {
            await task('pack-status', async (operation) => {
              operation.phase('Downloading the example pack…');
              const r = await fetch(`content/packs/${pack.path}`, { signal: operation.signal });
              if (!r.ok) throw new Error('Example pack is unavailable.');
              const data = await r.json();
              operation.check();
              await install(data, operation);
            });
          }),
        );
      }
    })
    .catch((e) => examplesLease.finish({ message: e.message, state: 'error' }));

  async function drawPicture(canvas, picture, accept = () => true, onPhase = () => {}) {
    const size = boardPaintSizeForLevel(picture.level);
    const width = canvas === $('gallery-canvas') ? size.width : 320;
    const height = (width * size.height) / size.width;
    const stage = document.createElement('canvas');
    stage.width = width;
    stage.height = height;
    const args = {
      theme: picture.theme,
      level: picture.level,
      seed: picture.item.seed ?? 1,
      width,
      height,
    };
    let backdrop = null,
      retained = false;
    try {
      if (picture.mediaError) throw picture.mediaError;
      if (picture.receipt?.presentationPin.kind === 'still') {
        if (!picture.media) throw new Error('Restore the original picture media before viewing.');
        onPhase('Reading and decoding the exact earned original…');
        backdrop = await (picture.media.acquire ?? acquirePresentationImage)({
          pin: picture.receipt.presentationPin,
          metadata: picture.media.metadata,
          store: picture.media.store,
        });
        args.image = backdrop.image;
        args.fit = backdrop.fit;
      } else if (picture.visualOverrides.background) {
        onPhase('Decoding the exact picture artwork…');
        const image = new Image();
        image.src = picture.visualOverrides.background.dataUrl;
        await image.decode();
        args.image = image;
        args.fit = picture.visualOverrides.background.fit;
      }
      if (!accept() || !canvas.isConnected) return false;
      galleryPainter.drawGallery(stage.getContext('2d'), args);
      if (!accept() || !canvas.isConnected) return false;
      // Only a complete successful staged draw may replace the visible picture.
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      canvas.style.aspectRatio = `${size.width} / ${size.height}`;
      canvas.getContext('2d').drawImage(stage, 0, 0);
      if (canvas === $('gallery-canvas')) {
        releaseViewBackdrop();
        viewBackdrop = backdrop;
        retained = true;
      }
      return true;
    } finally {
      if (!retained) backdrop?.release();
    }
  }
  function sealsFor(item, picture, records) {
    const catalog = api.getMasteryCatalog?.();
    return pictureMasteries(
      records,
      item,
      picture ? masteryFor(item.campaignKey, item.levelId, catalog) : null,
      picture?.entry.classRecipes ?? picture?.entry.campaign.classRecipes,
      catalog,
    );
  }
  function refreshPictureMasteries(picture, records) {
    const seals = sealsFor(picture.item, picture, records);
    const rows = seals.map(
      (seal) =>
        `◇ ${seal.name} · ${seal.route} · ${seal.steering} · seed ${seal.seed} · ${seal.earnedAt.slice(0, 10)}`,
    );
    const signature = JSON.stringify([picture.item.key, rows]);
    const list = $('gallery-view-masteries');
    if (signature !== pictureSealsSignature) {
      list.replaceChildren(
        ...rows.map((text) => {
          const row = document.createElement('li');
          row.textContent = text;
          return row;
        }),
      );
      pictureSealsSignature = signature;
    }
    list.hidden = seals.length === 0;
  }
  /** A late verified seal must not replace a focused card or reopen its picture. */
  function refreshMasteries() {
    const records = api.get().library.masteries;
    for (const { item, picture, slot } of gallerySealSlots.values()) {
      if (!slot.isConnected) continue;
      const seals = records?.length ? sealsFor(item, picture, records) : [];
      const text = seals.length
        ? `◇ ${[...new Set(seals.map((seal) => seal.name))].join(' · ')}`
        : '';
      if (slot.textContent !== text) slot.textContent = text;
      slot.hidden = seals.length === 0;
    }
    if (view && $('gallery-view-dialog').open) refreshPictureMasteries(view, records);
  }
  function populateGallery(opener) {
    const owner = beginPagerFocus('gallery-pages', opener),
      generation = ++galleryPopulation,
      library = api.get().library;
    const current = () => {
      const actual = api.get().library;
      return (
        generation === galleryPopulation && library === actual && owner.pager.pending === owner
      );
    };
    const complete = (media) => {
      let rendered = false;
      try {
        if (current()) {
          renderGallery(media);
          rendered = true;
        }
      } finally {
        endPagerFocus(owner, rendered ? current : null);
      }
    };
    try {
      if (
        library.pictureReceipts?.some((receipt) => receipt.presentationPin.kind === 'still') &&
        api.pictureMedia
      ) {
        status('gallery-load-status', 'Reading earned-picture original metadata…', 'busy');
        return api.pictureMedia().then(complete, (error) => complete({ error }));
      }
      complete(null);
    } catch (error) {
      endPagerFocus(owner);
      throw error;
    }
  }
  function retireCollectionReturn() {
    collectionReturn?.focus?.cancel();
    collectionReturn = null;
  }
  function refreshCollectionReturn() {
    if ($('library-dialog').open || !$('collection-dialog').open) return;
    retireCollectionReturn();
    const records = $('collection-records'),
      library = api.get().library,
      visit = collectionVisit,
      launch = launchGeneration,
      owner = { focus: null };
    let population;
    collectionReturn = owner;
    const current = () => {
      const actual = api.get().library;
      return (
        collectionReturn === owner &&
        visit === collectionVisit &&
        launch === launchGeneration &&
        library === actual &&
        population === galleryPopulation &&
        $('collection-dialog').open &&
        !$('library-dialog').open
      );
    };
    // Native close restores this exact persistent opener before its close event.
    // New Search/Close focus or BODY cannot become records-return permission.
    if (document.activeElement === records)
      owner.focus = captureOperationFocus(records, {
        document,
        reveal: true,
        resolveTarget: () => (current() ? records : null),
      });
    const retire = () => {
      owner.focus?.cancel();
      if (collectionReturn === owner) collectionReturn = null;
    };
    const finish = () => {
      try {
        if (current()) owner.focus?.restore();
      } finally {
        retire();
      }
    };
    try {
      api.prepareCollectionProgress?.();
      // Pin the next population before publication, including synchronous reads.
      population = galleryPopulation + 1;
      const pending = populateGallery();
      if (pending?.then) pending.then(finish, retire);
      else finish();
    } catch (error) {
      retire();
      throw error;
    }
  }
  $('library-dialog').addEventListener('close', refreshCollectionReturn);
  $('collection-dialog').addEventListener('beforetoggle', () => {
    collectionVisit++;
    retireCollectionReturn();
  });
  $('collection-dialog').addEventListener('close', () => {
    if (!$('collection-dialog').open) {
      collectionVisit++;
      retireCollectionReturn();
      galleryPopulation++;
      galleryReturnFocus?.cancel();
      galleryReturnFocus = null;
    }
  });
  function renderGallery(media) {
    const population = galleryPopulation;
    status(
      'gallery-load-status',
      media?.error
        ? 'Some original metadata is unavailable; restore the exact picture originals to view them.'
        : '',
      media?.error ? 'error' : 'ready',
    );
    galleryCards.clear();
    gallerySealSlots.clear();
    $('gallery-grid').replaceChildren();
    const resolver = difficulties();
    const library = api.get().library;
    const receipts = new Map(
      (library.pictureReceipts ?? []).map((receipt) => [receipt.galleryKey, receipt]),
    );
    const resolve = (item) => {
      const receipt = receipts.get(item.key),
        installed = resolver.picture(item);
      if (!receipt) return installed;
      try {
        if (media?.error && receipt.presentationPin.kind === 'still') throw media.error;
        const picture = resolveEarnedPicture({
          item,
          receipt,
          metadata: media?.metadata,
          entries: executionEntries(),
        });
        return picture ? { ...picture, media } : null;
      } catch (error) {
        return installed ? { ...installed, receipt, mediaError: error } : null;
      }
    };
    const query = $('gallery-search').value.toLowerCase().trim(),
      items = resolver
        .group(library.gallery)
        .map((group) => ({
          ...group,
          variants: (group.variants.length
            ? group.variants.map((picture) => picture.item)
            : [group.item]
          )
            .map(resolve)
            .filter(Boolean),
        }))
        .filter((group) =>
          `${group.item.levelName} ${group.item.themeId} ${group.variants.map((picture) => `${picture.theme.name} ${resolver.label(picture.item.campaignKey)}`).join(' ')} ${group.variants.length ? '' : 'archived difficulty unavailable'}`
            .toLowerCase()
            .includes(query),
        );
    galleryPage = Math.min(galleryPage, Math.max(0, Math.ceil(items.length / 12) - 1));
    for (const group of items.slice(galleryPage * 12, galleryPage * 12 + 12)) {
      const item = group.item,
        picture = group.variants[0] ?? null;
      const card = document.createElement('button');
      card.className = 'gallery-card';
      card.type = 'button';
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      canvas.setAttribute('aria-hidden', 'true');
      const title = document.createElement('strong');
      title.textContent = item.levelName;
      const copy = document.createElement('span');
      const otherDifficulties = [...new Set(group.variants.map((variant) => variant.label))].filter(
        (label) => label !== picture?.label,
      );
      copy.textContent = picture
        ? `${picture.theme.name} · ${picture.label} · ${collectionResultLabels(item, api.get().library).card}${otherDifficulties.length ? ` · Also earned: ${otherDifficulties.join(' + ')}` : ''}`
        : receipts.get(item.key)?.presentationPin.kind === 'still'
          ? 'Original picture unavailable · restore its .rlmedia originals'
          : 'Archived picture · reinstall its exact pack to view';
      const seal = document.createElement('span');
      seal.className = 'mastery-note';
      seal.hidden = true;
      card.append(canvas, title, copy, seal);
      gallerySealSlots.set(item.key, { item, picture, slot: seal });
      card.disabled = !picture;
      card.onclick = () => openPicture(picture, { variants: group.variants });
      $('gallery-grid').append(card);
      galleryCards.set(item.key, card);
      for (const variant of group.variants) galleryCards.set(variant.item.key, card);
      if (picture) {
        const pictureState = document.createElement('span');
        pictureState.className = 'gallery-picture-state';
        pictureState.textContent = 'Loading picture…';
        card.append(pictureState);
        card.dataset.pictureState = 'loading';
        drawPicture(canvas, picture, () => card.isConnected && population === galleryPopulation)
          .then((drawn) => {
            if (!card.isConnected) return;
            if (drawn) {
              card.dataset.pictureState = 'ready';
              pictureState.textContent = '';
              pictureState.hidden = true;
            }
          })
          .catch(() => {
            if (!card.isConnected) return;
            card.dataset.pictureState = 'unavailable';
            pictureState.textContent =
              picture.receipt?.presentationPin.kind === 'still'
                ? 'Original picture unavailable. Restore its .rlmedia originals.'
                : 'Picture could not decode. Reinstall its pack.';
          });
      }
    }
    if (!items.length)
      $('gallery-grid').textContent = api.get().library.gallery.length
        ? 'No pictures match this search.'
        : 'A picture is waiting behind your first completed mission.';
    paginate('gallery-pages', galleryPage, items.length, 12, (p, opener) => {
      galleryPage = p;
      return populateGallery(opener);
    });
    refreshMasteries();
  }
  function pictureReady(ready, loading = false) {
    viewReady = ready;
    $('gallery-canvas').style.visibility = ready ? '' : 'hidden';
    $('gallery-canvas').setAttribute('aria-hidden', String(!ready));
    $('gallery-animate').disabled = !ready || view?.celebratable === false;
    $('gallery-replay').disabled = !ready || view?.replayable === false;
    storyButton.hidden =
      !ready ||
      !api.openStory ||
      !api
        .get()
        .library.storyReceipts?.some(
          (row) => row.galleryKey === view?.item.key && row.storyPin !== null,
        );
    $('gallery-canvas').setAttribute('aria-busy', String(loading));
  }
  async function openPicture(picture, { variants = [picture], switching = false } = {}) {
    if (
      !picture ||
      (switching
        ? !$('gallery-view-dialog').open || !viewVariants.includes(picture)
        : !$('collection-dialog').open || $('gallery-view-dialog').open)
    )
      return;
    if (!switching) {
      galleryReturnFocus?.cancel();
      galleryReturnFocus = null;
      galleryReturn = {
        key: picture.item.key,
        card: galleryCards.get(picture.item.key),
        page: galleryPage,
        query: $('gallery-search').value,
      };
    }
    const generation = ++viewGeneration;
    cancelAnimationFrame(galleryFrame);
    returnToCollection = true;
    if (view !== picture) releaseViewBackdrop();
    view = picture;
    if (!switching) {
      viewVariants = variants;
      $('gallery-difficulty').replaceChildren(
        ...variants.map((variant) => {
          const option = document.createElement('option');
          option.value = variant.difficulty ?? '';
          option.textContent = variant.label;
          return option;
        }),
      );
    }
    $('gallery-difficulty-field').hidden = viewVariants.length < 2;
    $('gallery-difficulty').disabled = viewVariants.length < 2;
    $('gallery-difficulty').value = picture.difficulty ?? '';
    pictureReady(false, true);
    const meta = pictureMeta(picture);
    const current = () =>
      generation === viewGeneration && view === picture && $('gallery-view-dialog').open;
    $('gallery-view-title').textContent = picture.level.name;
    $('gallery-view-meta').setAttribute('role', 'status');
    status('gallery-view-meta', `${meta} · Loading picture…`, 'busy');
    refreshPictureMasteries(picture, api.get().library.masteries);
    // Keep Collection and its original opener underneath this child picture.
    if (!switching) $('gallery-view-dialog').showModal();
    try {
      const drawn = await drawPicture($('gallery-canvas'), picture, current, (message) => {
        if (current()) status('gallery-view-meta', `${meta} · ${message}`, 'busy');
      });
      if (drawn && current()) {
        pictureReady(true);
        status('gallery-view-meta', meta);
      }
    } catch (e) {
      if (current()) {
        pictureReady(false);
        status(
          'gallery-view-meta',
          `${meta} · Picture could not load. Restore its originals or exact pack, then reopen this view. ${e instanceof Error ? e.message : ''}`,
          'error',
        );
      }
    }
  }
  $('gallery-difficulty').onchange = () => {
    if (!$('gallery-view-dialog').open) return;
    const selected = viewVariants.find(
      (picture) => picture.difficulty === $('gallery-difficulty').value,
    );
    if (selected && selected !== view) return openPicture(selected, { switching: true });
  };
  $('gallery-replay').onclick = () => {
    if (view && viewReady && $('gallery-view-dialog').open) {
      const installed = difficulties().picture(view.item);
      if (!installed) {
        pictureReady(false);
        status(
          'gallery-view-meta',
          'Archived picture · reinstall its exact pack before replaying.',
          'error',
        );
        return;
      }
      const picture = view,
        generation = viewGeneration,
        launchEpoch = launchGeneration,
        recordIdentity = canonicalJSON(picture.item);
      return launch(
        { kind: 'library-picture', id: picture.item.key, recordIdentity },
        {
          opener: $('gallery-replay'),
          isCurrent: () =>
            launchForeground() &&
            launchEpoch === launchGeneration &&
            view === picture &&
            generation === viewGeneration &&
            viewReady &&
            $('gallery-view-dialog').open &&
            canonicalJSON(picture.item) === recordIdentity,
          close: () => {
            returnToCollection = false;
            $('gallery-view-dialog').close();
            if ($('collection-dialog').open) $('collection-dialog').close();
          },
          entry: installed.entry,
          options: {
            levelId: picture.level.id,
            themeId: picture.theme.id,
            seed: picture.item.seed ?? 1,
            ...(installed.difficulty ? { difficulty: installed.difficulty } : {}),
          },
          statusId: 'gallery-view-meta',
        },
      );
    }
  };
  $('gallery-animate').onclick = async () => {
    if (!view || !viewReady || view.celebratable === false || !$('gallery-view-dialog').open)
      return;
    const picture = view,
      generation = ++viewGeneration;
    cancelAnimationFrame(galleryFrame);
    status('gallery-view-meta', `${pictureMeta(picture)} · Preparing celebration artwork…`, 'busy');
    try {
      const visuals = { ...picture.visualOverrides };
      if (viewBackdrop) delete visuals.background;
      await galleryPainter.setLook(picture.theme, picture.theme.player, visuals);
      if (!viewBackdrop && picture.visualOverrides.background && !galleryPainter.images.background)
        throw new Error('The picture artwork is unavailable for celebration.');
    } catch (e) {
      if (generation === viewGeneration && view === picture && $('gallery-view-dialog').open)
        status(
          'gallery-view-meta',
          `${pictureMeta(picture)} · Celebration could not start. The completed picture is still available. ${e instanceof Error ? e.message : ''}`,
          'error',
        );
      return;
    }
    if (generation !== viewGeneration || view !== picture || !$('gallery-view-dialog').open) return;
    status('gallery-view-meta', pictureMeta(picture));
    galleryPainter.setLevel?.(picture.level, { seed: picture.item.seed ?? 1 });
    galleryPainter.startCelebration?.({
      levelId: picture.level.id,
      seed: picture.item.seed ?? 1,
      reduced: reducedEffects(),
    });
    // The gallery owns a presentation-only completed view; it never enters progression.
    const state = createRun(picture.level, {
      seed: picture.item.seed ?? 1,
      classRecipes: picture.entry.classRecipes,
      classId: picture.entry.classRecipes[0].id,
    });
    state.status = 'won';
    let last = null;
    const frame = (now) => {
      if (!$('gallery-view-dialog').open || generation !== viewGeneration || view !== picture)
        return;
      // Use one clock: the first finite frame establishes its own baseline.
      let dt = 0;
      if (Number.isFinite(now)) {
        if (last !== null) dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
        last = last === null ? now : Math.max(last, now);
      }
      galleryPainter.draw($('gallery-canvas').getContext('2d'), state, dt, {
        paused: true,
        fullReveal: true,
        reduced: reducedEffects(),
        celebrationPaused: document.hidden,
        backdrop: viewBackdrop,
      });
      if (galleryPainter.celebrationStatus?.active) galleryFrame = requestAnimationFrame(frame);
    };
    galleryFrame = requestAnimationFrame(frame);
  };
  $('gallery-view-dialog').addEventListener('close', () => {
    // A queued close from an earlier view must not disturb a newly opened picture.
    if ($('gallery-view-dialog').open) return;
    cancelAnimationFrame(galleryFrame);
    const closingGeneration = ++viewGeneration;
    releaseViewBackdrop();
    view = null;
    viewVariants = [];
    $('gallery-difficulty-field').hidden = true;
    $('gallery-difficulty').disabled = true;
    pictureReady(false);
    const origin = galleryReturn;
    galleryReturn = null;
    if (returnToCollection) {
      if (origin) {
        galleryPage = origin.page;
        $('gallery-search').value = origin.query;
      }
      // Restore the scope synchronously. Late media reads may refresh this open
      // Collection, but must never reopen it after the player navigates away.
      if (!$('collection-dialog').open) $('collection-dialog').showModal();
      const library = api.get().library;
      let returnPopulation;
      const currentReturn = () =>
        returnPopulation === galleryPopulation &&
        closingGeneration === viewGeneration &&
        library === api.get().library &&
        !$('gallery-view-dialog').open &&
        $('collection-dialog').open;
      galleryReturnFocus?.cancel();
      // Native close restores the original card before this queued listener.
      // A newer Search/Close choice or an already detached BODY origin cannot
      // become this picture's focus intent. Capture before cards are rebuilt.
      const focus =
        origin?.card && document.activeElement === origin.card
          ? captureOperationFocus(origin.card, {
              resolveTarget: () =>
                currentReturn()
                  ? [
                      galleryCards.get(origin.key),
                      ...galleryCards.values(),
                      $('gallery-search'),
                      ...$('collection-dialog').querySelectorAll('button'),
                    ].find(
                      (element) => element?.isConnected && !element.disabled && !element.hidden,
                    )
                  : null,
            })
          : null;
      galleryReturnFocus = focus;
      const retireReturn = () => {
        focus?.cancel();
        if (galleryReturnFocus === focus) galleryReturnFocus = null;
      };
      const finishReturn = () => {
        try {
          if (galleryReturnFocus === focus && currentReturn()) focus?.restore();
        } finally {
          retireReturn();
        }
      };
      try {
        const pending = populateGallery();
        returnPopulation = galleryPopulation;
        if (pending?.then) pending.then(finishReturn, retireReturn);
        else finishReturn();
      } catch (error) {
        retireReturn();
        throw error;
      }
    }
  });
  return {
    open,
    refresh,
    populateGallery,
    refreshMasteries,
    cancelAttemptExport,
    dispose: () => sessionOriginals?.dispose(),
  };
}
