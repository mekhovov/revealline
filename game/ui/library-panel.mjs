import { prepareBackup, exportBackup, MAX_BACKUP_BYTES } from '../backup.mjs';
import { importLibrary, exportLibrary, libraryCapacity } from '../library.mjs';
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
const status = (id, error) =>
  ($(id).textContent = error instanceof Error ? error.message : String(error));
const fileText = async (file, max = 32 * 1024 * 1024) => {
  if (!file) throw new Error('Choose a JSON file.');
  if (file.size > max) throw new Error('This file exceeds the import budget.');
  return file.text();
};

export function attachLibraryPanel(api) {
  let galleryPopulation = 0,
    viewBackdrop = null;
  const releaseViewBackdrop = () => {
    viewBackdrop?.release();
    viewBackdrop = null;
  };
  let transferPanel = null;
  let attemptExport = null;
  let previousLibrary = null,
    previousBackup = null,
    busy = false,
    view = null,
    viewReady = false,
    galleryFrame = 0,
    viewGeneration = 0,
    returnToCollection = true;
  let galleryPage = 0,
    scorePage = 0,
    galleryReturn = null;
  const galleryCards = new Map();
  const gallerySealSlots = new Map();
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
    api.pause();
    for (const id of ['scores', 'saves', 'packs', 'challenges'])
      $(`library-${id}`).hidden = id !== panel;
    refresh();
    if (!$('library-dialog').open) $('library-dialog').showModal();
  }
  function paginate(id, page, total, size, change) {
    const pages = Math.max(1, Math.ceil(total / size)),
      nav = $(id);
    const hadPagerFocus = [...nav.querySelectorAll('button')].includes(document.activeElement);
    nav.replaceChildren();
    if (id === 'gallery-pages') {
      nav.hidden = pages <= 1;
      if (nav.hidden) {
        if (hadPagerFocus && $('collection-dialog').open)
          $('gallery-search').focus({ preventScroll: true });
        return;
      }
    }
    const previous = button('Previous', () => change(page - 1)),
      next = button('Next', () => change(page + 1)),
      label = document.createElement('span');
    previous.disabled = page === 0;
    next.disabled = page >= pages - 1;
    label.textContent = `${total} entries · page ${page + 1} of ${pages}`;
    nav.append(previous, label, next);
  }
  function renderScores() {
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
    paginate('score-pages', scorePage, matches.length, 10, (p) => {
      scorePage = p;
      renderScores();
    });
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
    $('installed-packs').replaceChildren();
    for (const pack of api.get().packs.packs) {
      const row = document.createElement('article');
      const title = document.createElement('strong');
      title.textContent = `${pack.name} · ${pack.version}`;
      const p = document.createElement('p');
      p.textContent = pack.description;
      row.append(title, p);
      for (const source of pack.campaigns)
        row.append(
          button(`Play ${source.title || source.name || source.id}`, () => {
            api.select(
              api.catalog().find((c) => c.sourcePackId === pack.id && c.campaign.id === source.id),
            );
            $('library-dialog').close();
            api.focusMission?.();
          }),
        );
      row.append(
        button('Remove from device', () =>
          task('pack-status', async () => {
            await api.setPacks(removePack(api.get().packs, pack.id));
            refresh();
            status(
              'pack-status',
              'Pack removed. Player records and earned uploaded originals are preserved. Reinstall its exact pack to play again or view pack-embedded artwork.',
            );
          }),
        ),
      );
      $('installed-packs').append(row);
    }
    if (attemptExport) {
      for (const control of $('library-dialog').querySelectorAll('button,input,select,textarea'))
        control.disabled =
          control !== $('cancel-attempt-export') || attemptExport.phase !== 'verifying';
    }
  }
  $('library-dialog').addEventListener('cancel', (e) => {
    if (cancelAttemptExport() || busy) e.preventDefault();
  });
  $('library-dialog').addEventListener('close', () => {
    if (!$('library-dialog').open) endAttemptExport(false);
  });
  globalThis.addEventListener?.('pagehide', () => endAttemptExport(false));

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
    if (restoreFocus && $('library-dialog').open && !document.hidden) {
      const target = $('export-session').disabled ? $('export-library') : $('export-session');
      target.focus({ preventScroll: true });
    }
  }
  function cancelAttemptExport() {
    if (!attemptExport || attemptExport.phase !== 'verifying') return false;
    endAttemptExport(true);
    status('save-status', 'Export cancelled. The previous copy is unchanged.');
    return true;
  }
  $('cancel-attempt-export').onclick = cancelAttemptExport;

  async function exportAttempt() {
    if (busy || !$('library-dialog').open) return;
    const source = api.attemptExportSource();
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
    $('cancel-attempt-export').hidden = false;
    $('cancel-attempt-export').disabled = false;
    $('cancel-attempt-export').focus({ preventScroll: true });
    status(
      'save-status',
      `Checking the ${source.source === 'stored' ? 'saved' : 'current'} attempt…`,
    );
    try {
      const prepared = await api.prepareAttemptFile({
        signal: operation.controller.signal,
        onProgress: ({ ticks, total }) => {
          if (currentAttemptExport(operation))
            status('save-status', `Checking flight inputs: ${ticks} / ${total} ticks…`);
        },
      });
      if (!currentAttemptExport(operation)) return;
      const text = JSON.stringify(prepared.session, null, 2);
      prepared.assertCurrent();
      if (!currentAttemptExport(operation)) return;
      operation.phase = 'download';
      $('cancel-attempt-export').hidden = true;
      $('cancel-attempt-export').disabled = true;
      $('save-json').value = text;
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
  async function task(id, fn) {
    if (busy) return;
    busy = true;
    const controls = [...$('library-dialog').querySelectorAll('button,input,select,textarea')].map(
      (element) => ({ element, disabled: element.disabled }),
    );
    for (const { element } of controls) element.disabled = true;
    status(id, 'Checking…');
    try {
      await fn();
    } catch (e) {
      status(id, e);
    } finally {
      busy = false;
      for (const { element, disabled } of controls)
        if (element.isConnected) element.disabled = disabled;
      refresh();
    }
  }
  async function install(candidate) {
    await task('pack-status', async () => {
      const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      const before = api.get().packs;
      let next;
      if (parsed.format === 'xonix-pack-library.v1') next = await importPackLibrary(parsed);
      else {
        const prepared = await preparePack(parsed, { library: before });
        next = installPack(before, prepared.pack);
      }
      if (api.get().packs !== before)
        throw new Error('Installed content changed; prepare this pack again.');
      await api.setPacks(next);
      refresh();
      status(
        'pack-status',
        'Validated and installed. Choose Play above or use the Campaign selector.',
      );
    });
  }
  async function importSave(candidate) {
    await task('save-status', async () => {
      if (
        typeof candidate === 'string' &&
        new TextEncoder().encode(candidate).byteLength > MAX_BACKUP_BYTES
      )
        throw new Error('This backup exceeds the import budget.');
      const parsed = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
      if (['xonix-backup.v1', 'xonix-backup.v2'].includes(parsed.format)) {
        const prepared = await prepareBackup(parsed, await backupOptions());
        const applied = await applyPrepared(prepared);
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
        await api.restore(parsed);
        $('library-dialog').close();
        return;
      }
      const next = importLibrary(parsed, { campaigns: executionEntries().map((c) => c.campaign) });
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
    });
  }
  async function applyPrepared(prepared) {
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
    const applied = await api.applyBackup(prepared);
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
    applyPrepared,
  });
  $('library-button').onclick = () => open();
  for (const b of document.querySelectorAll('[data-library-panel]'))
    b.onclick = () => open(b.dataset.libraryPanel);
  $('export-backup').onclick = () =>
    task('save-status', async () => {
      const options = await backupOptions();
      const text = await exportBackup(await backupContents(), options);
      $('save-json').value = text;
      const exported = await downloadJSON(JSON.parse(text), 'revealline-complete-backup.json');
      status(
        'save-status',
        `Game data prepared: player library, installed chapters and saved flight. Restore picture originals from .rlmedia before this file. Stories need .rlstory and custom music needs .rlsound. ${exported.message} ${api.sessionNote?.() || ''}`,
      );
    });
  $('undo-backup').onclick = () =>
    task('save-status', async () => {
      if (!previousBackup) return;
      await api.applyBackup(previousBackup);
      previousBackup = null;
      previousLibrary = null;
      $('undo-backup').disabled = true;
      $('undo-library').disabled = true;
      refresh();
      status('save-status', 'Previous collection, packs and saved flight restored.');
    });
  $('export-library').onclick = () =>
    task('save-status', async () => {
      const text = exportLibrary(api.get().library);
      $('save-json').value = text;
      const exported = await downloadJSON(JSON.parse(text), 'revealline-player-library.json');
      status(
        'save-status',
        `Library prepared. ${exported.message} Keep packs and attempt files alongside it.`,
      );
    });
  $('import-save').onclick = () => importSave($('save-json').value);
  $('save-file').onchange = () => {
    const file = $('save-file').files[0];
    $('save-file').value = '';
    if (!file) return;
    return task('save-status', async () => {
      const text = await fileText(file, MAX_BACKUP_BYTES);
      busy = false;
      await importSave(text);
    });
  };
  $('undo-library').onclick = () => {
    if (previousLibrary) {
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
    task('save-status', async () => {
      await api.restore(api.saved());
      $('library-dialog').close();
    });
  $('export-session').onclick = exportAttempt;
  $('install-pack').onclick = () => install($('pack-json').value);
  $('pack-file').onchange = () => {
    const file = $('pack-file').files[0];
    $('pack-file').value = '';
    if (!file) return;
    return task('pack-status', async () => {
      const text = await fileText(file, 64 * 1024 * 1024);
      busy = false;
      await install(text);
    });
  };
  $('export-packs').onclick = () =>
    task('pack-status', async () => {
      await api.assertExternalBackupSupported?.({ kind: 'packs' });
      const text = exportPackLibrary(api.get().packs);
      $('pack-json').value = text;
      const exported = await downloadJSON(JSON.parse(text), 'revealline-expansion-packs.json');
      status(
        'pack-status',
        `Installed packs prepared with their original embedded images. ${exported.message}`,
      );
    });
  $('challenge-date').value = new Date().toISOString().slice(0, 10);
  $('launch-challenge').onclick = () => {
    try {
      const c = challengeCampaign(
        $('challenge-date').value,
        $('challenge-kind').value,
        api.base().classRecipes,
      );
      api.select({ ...api.base(), campaign: c, activity: 'challenge' });
      $('library-dialog').close();
      api.focusMission?.();
    } catch (e) {
      status('challenge-status', e);
    }
  };
  fetch('content/packs/index.json')
    .then((r) => {
      if (!r.ok) throw new Error('Example packs could not load.');
      return r.json();
    })
    .then((index) => {
      for (const pack of index.packs) {
        $('builtin-packs').append(
          button(`Install ${pack.id.replaceAll('-', ' ')}`, async () => {
            await task('pack-status', async () => {
              const r = await fetch(`content/packs/${pack.path}`);
              if (!r.ok) throw new Error('Example pack is unavailable.');
              const data = await r.json();
              busy = false;
              await install(data);
            });
          }),
        );
      }
    })
    .catch((e) => status('pack-status', e));

  async function drawPicture(canvas, picture, accept = () => true) {
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
        backdrop = await acquirePresentationImage({
          pin: picture.receipt.presentationPin,
          metadata: picture.media.metadata,
          store: picture.media.store,
        });
        args.image = backdrop.image;
        args.fit = backdrop.fit;
      } else if (picture.visualOverrides.background) {
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
  function populateGallery() {
    const generation = ++galleryPopulation,
      library = api.get().library;
    if (
      library.pictureReceipts?.some((receipt) => receipt.presentationPin.kind === 'still') &&
      api.pictureMedia
    ) {
      return api.pictureMedia().then(
        (media) => {
          if (generation === galleryPopulation && library === api.get().library)
            renderGallery(media);
        },
        (error) => {
          if (generation === galleryPopulation && library === api.get().library)
            renderGallery({ error });
        },
      );
    }
    renderGallery(null);
  }
  $('collection-dialog').addEventListener('close', () => {
    if (!$('collection-dialog').open) galleryPopulation++;
  });
  function renderGallery(media) {
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
      if (picture)
        drawPicture(canvas, picture).catch(() => {
          copy.textContent =
            picture.receipt?.presentationPin.kind === 'still'
              ? 'Original picture unavailable. Restore its .rlmedia originals.'
              : 'Picture could not decode. Reinstall its pack.';
        });
    }
    if (!items.length)
      $('gallery-grid').textContent = api.get().library.gallery.length
        ? 'No pictures match this search.'
        : 'A picture is waiting behind your first completed mission.';
    paginate('gallery-pages', galleryPage, items.length, 12, (p) => {
      galleryPage = p;
      populateGallery();
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
    $('gallery-view-dialog').setAttribute('aria-busy', String(loading));
  }
  async function openPicture(picture, { variants = [picture], switching = false } = {}) {
    if (
      !picture ||
      (switching
        ? !$('gallery-view-dialog').open || !viewVariants.includes(picture)
        : !$('collection-dialog').open || $('gallery-view-dialog').open)
    )
      return;
    if (!switching)
      galleryReturn = {
        key: picture.item.key,
        page: galleryPage,
        query: $('gallery-search').value,
      };
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
    $('gallery-view-meta').textContent = `${meta} · Loading picture…`;
    refreshPictureMasteries(picture, api.get().library.masteries);
    // Keep Collection and its original opener underneath this child picture.
    if (!switching) $('gallery-view-dialog').showModal();
    try {
      const drawn = await drawPicture($('gallery-canvas'), picture, current);
      if (drawn && current()) {
        pictureReady(true);
        $('gallery-view-meta').textContent = meta;
      }
    } catch (e) {
      if (current()) {
        pictureReady(false);
        $('gallery-view-meta').textContent =
          `${meta} · Picture could not load. Restore its originals or exact pack, then reopen this view. ${e instanceof Error ? e.message : ''}`;
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
        $('gallery-view-meta').textContent =
          'Archived picture · reinstall its exact pack before replaying.';
        return;
      }
      returnToCollection = false;
      api.select(installed.entry, {
        levelId: view.level.id,
        themeId: view.theme.id,
        seed: view.item.seed ?? 1,
        ...(installed.difficulty ? { difficulty: installed.difficulty } : {}),
      });
      $('gallery-view-dialog').close();
      if ($('collection-dialog').open) $('collection-dialog').close();
      api.focusMission?.();
    }
  };
  $('gallery-animate').onclick = async () => {
    if (!view || !viewReady || view.celebratable === false || !$('gallery-view-dialog').open)
      return;
    const picture = view,
      generation = ++viewGeneration;
    cancelAnimationFrame(galleryFrame);
    try {
      const visuals = { ...picture.visualOverrides };
      if (viewBackdrop) delete visuals.background;
      await galleryPainter.setLook(picture.theme, picture.theme.player, visuals);
      if (!viewBackdrop && picture.visualOverrides.background && !galleryPainter.images.background)
        throw new Error('The picture artwork is unavailable for celebration.');
    } catch (e) {
      if (generation === viewGeneration && view === picture && $('gallery-view-dialog').open)
        $('gallery-view-meta').textContent =
          `${pictureMeta(picture)} · Celebration could not start. The completed picture is still available. ${e instanceof Error ? e.message : ''}`;
      return;
    }
    if (generation !== viewGeneration || view !== picture || !$('gallery-view-dialog').open) return;
    $('gallery-view-meta').textContent = pictureMeta(picture);
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
      const pending = populateGallery(),
        returnPopulation = galleryPopulation;
      const finishReturn = () => {
        if (
          returnPopulation !== galleryPopulation ||
          closingGeneration !== viewGeneration ||
          $('gallery-view-dialog').open ||
          !$('collection-dialog').open
        )
          return;
        // populateGallery replaces every card. Resolve the current node by the
        // stable picture key instead of keeping a detached originating button.
        const target = [
          galleryCards.get(origin?.key),
          ...galleryCards.values(),
          $('gallery-search'),
          ...$('collection-dialog').querySelectorAll('button'),
        ].find((element) => element?.isConnected && !element.disabled && !element.hidden);
        target?.focus();
      };
      if (pending?.then) pending.then(finishReturn);
      else finishReturn();
    }
  });
  return { open, refresh, populateGallery, refreshMasteries, cancelAttemptExport };
}
