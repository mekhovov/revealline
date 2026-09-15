import { mountPresentationPage } from '../presentation/page.mjs';
import { createCouchShell } from './couch-shell.mjs';
import { prepareCouchChapter } from './couch-chapter.mjs';
import { createCouchInstalledChapters } from './couch-installed-chapters.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { onNativeInactive } from '../platform.mjs';
import { createDuel, stepDuel, pauseDuel, resumeDuel } from '../multiplayer.mjs';
import { FIXED_DT, releaseInputs } from '../core/index.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { BoardPainter, boardPaintSizeForLevel } from '../ui/render.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { Soundscape, DEFAULT_TRACKS } from '../ui/audio.mjs';
import { attachPublishedAudio } from '../ui/published-audio.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { createCharacterPresentations } from '../character-presentations.mjs';
import { emptyProgress, unlockedBodies } from '../progress.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
const $ = (id) => document.getElementById(id);
globalThis.RevealLineToolLaunch?.attached();
document.documentElement.dataset.toolState = 'loading';
const bootStatus = createOperationStatus($('boot-status'));
const bootDisplay = bootStatus.begin({ message: 'Preparing both boards…', stage: 'reading' });
let bootFailed = false;
const artworkLifetime = new AbortController();
const presentationFeedback = createOperationStatus($('race-presentation-status'));
let presentationOperation = null;
const presentationPage = mountPresentationPage({
  onStatus(status) {
    if (status.status === 'preparing') {
      if (!presentationOperation) presentationOperation = presentationFeedback.begin(status);
      else presentationOperation.update(status);
    } else {
      presentationOperation?.finish({
        state: status.status === 'error' ? 'error' : 'ready',
        message:
          status.status === 'error'
            ? 'Release artwork is unavailable; the current look is kept.'
            : '',
      });
      presentationOperation = null;
    }
  },
});
let featured, installed, publishedAudio, publishedPlayer;
const releaseArtwork = (event) => {
  if (event.persisted) return;
  artworkLifetime.abort();
  publishedAudio?.close();
  publishedPlayer?.dispose();
  presentationPage.close();
  presentationFeedback.dispose();
  featured?.dispose();
  installed?.dispose();
  window.removeEventListener('pagehide', releaseArtwork);
};
window.addEventListener('pagehide', releaseArtwork);
const json = async (url) => {
  const r = await fetch(url, { signal: artworkLifetime.signal });
  if (!r.ok) throw new Error(`Could not load ${url}`);
  return r.json();
};
try {
  const [campaign, registry, themes, presets] = await Promise.all([
    json('../content/campaign.json'),
    json('../content/classes.json'),
    json('../content/themes.json'),
    json('../../authoring/motion-lab/presets.json'),
  ]);
  const characterPresentations = createCharacterPresentations(presets);
  const maps = campaign.levels.map((level) => ({
    key: level.id,
    chapter: campaign.title,
    level,
    classes: registry,
    themes: themes.themes,
    visualOverrides: {},
    defaultThemeId: level.themeId || campaign.themeId,
    track: null,
  }));
  let featuredSource,
    featuredStatus = '';
  try {
    bootDisplay.update({ message: 'Loading the featured chapter…', stage: 'downloading' });
    featuredSource = await json('../content/packs/fpv-arcade-r5.json');
  } catch (error) {
    if (artworkLifetime.signal.aborted || error.name === 'AbortError') throw error;
    featuredStatus =
      'Featured Pressure Lines download unavailable. Base maps and checked installed maps remain available.';
  }
  if (featuredSource !== undefined) {
    bootDisplay.update({
      message: 'Checking featured maps and original pictures…',
      stage: 'verifying',
    });
    featured = await prepareCouchChapter(featuredSource, { signal: artworkLifetime.signal });
    const featuredCampaign = featured.resolved.campaign;
    maps.unshift(
      ...featuredCampaign.levels.map((level) => ({
        key: `shipped/${featured.pack.id}/${featuredCampaign.id}/${level.id}`,
        chapter: featuredCampaign.title,
        level,
        classes: featured.resolved.classRecipes,
        themes: featured.resolved.themes,
        defaultThemeId: level.themeId || featuredCampaign.themeId,
        track:
          featured.resolved.music.find(
            (track) => track.id === (level.musicId || featuredCampaign.musicId),
          ) || null,
        // The one decoded original below is shared by both boards, not reloaded by each painter.
        visualOverrides: Object.fromEntries(
          Object.entries({
            ...featured.resolved.visualOverrides,
            ...featured.resolved.levelVisuals.find((v) => v.levelId === level.id)?.visualOverrides,
          }).filter(([role]) => role !== 'background'),
        ),
        backdrop: featured.backdrop(level.id),
      })),
    );
  }
  const shippedMaps = [...maps];
  let installedStatus = 'Installed chapters have not been checked.';
  try {
    const channel = document.querySelector('meta[name="revealline-offline"]')
      ? `release-${(await json('../build-info.json')).version}`
      : 'dev';
    installed = createCouchInstalledChapters({
      channel,
      registeredEntries: [
        {
          campaign: { ...campaign, classRecipes: registry },
          classRecipes: registry,
          themes: themes.themes,
          visualOverrides: {},
          levelVisuals: [],
          music: [],
          sourcePackId: null,
        },
      ],
    });
    bootDisplay.update({
      message: 'Checking installed chapters and pictures…',
      stage: 'verifying',
    });
    const rows = await installed.refresh({
      signal: artworkLifetime.signal,
      onStatus: (status) => bootDisplay.update(status),
    });
    maps.push(...rows);
    installedStatus = rows.length
      ? `${rows.length} installed maps available. Choose a map to check its original.`
      : 'No installed chapters in this profile. Install chapters in solo More worlds, then refresh.';
  } catch (error) {
    installedStatus = `Installed chapters unavailable: ${error.message}`;
  }
  if (artworkLifetime.signal.aborted)
    throw new DOMException('Couch artwork loading cancelled.', 'AbortError');
  const mode = (level) => (arcadeActionCapabilities(level).manualAbility ? 'Tactical' : 'Arcade');
  function showMaps() {
    $('race-level').replaceChildren(
      ...maps.map((m) => new Option(`${m.chapter} · ${m.level.name} · ${mode(m.level)}`, m.key)),
    );
  }
  showMaps();
  $('race-level').value = maps[0].key;
  for (const t of themes.themes) $('race-theme').append(new Option(t.name, t.id));
  for (const c of registry) $('race-class').append(new Option(c.label, c.id));
  const painters = [new BoardPainter(presets), new BoardPainter(presets)];
  for (const painter of painters) presentationPage.bindPainter(painter);
  const sound = new Soundscape({ persistentMusic: true });
  const musicElement = document.createElement('audio');
  if (typeof musicElement.play === 'function') {
    publishedPlayer = createSoundtrackPlayer({
      soundscape: sound,
      audioElement: musicElement,
      readAsset: async () => {
        throw new Error('Couch does not read custom music storage.');
      },
    });
  }
  publishedAudio = attachPublishedAudio({
    sound,
    ready: presentationPage.ready,
    getHost: () => presentationPage,
    allowMusic: () =>
      (theme?.id === 'fpv' || theme?.family === 'fpv') && !selectedMapKey?.startsWith('installed/'),
  });
  publishedAudio.setPlayer(publishedPlayer);
  let neutralResumeTick = false;
  const freeBodies = characterPresentations.availableBodies(
    unlockedBodies(emptyProgress(campaign), campaign),
  );
  function bodyFor(theme, classId) {
    const candidate = characterPresentations.recommendedBody(theme, classId);
    return Object.hasOwn(presets.characters, candidate) && freeBodies.has(candidate)
      ? candidate
      : freeBodies.has(theme.player)
        ? theme.player
        : 'neutral-marker';
  }
  let selectedMapKey = null;
  const contexts = [0, 1].map((i) => $(`race-canvas-${i}`).getContext('2d'));
  let match,
    theme,
    backdrop = null,
    contentReady = true,
    contentBusy = false,
    contentError = null,
    contentController = null,
    contentScope = null,
    accumulator = 0,
    last = 0,
    won = [0, 0],
    finished = false,
    generation = 0,
    framePads = [],
    frameReadError = null,
    padDescriptors = new Map(),
    slots = [null, null],
    assignmentsChanged = false,
    pendingPadLoss = false,
    menuOwner = null,
    menuHint = '',
    menuGate = '',
    menuStatus =
      'Release controls, then press a face button or Menu to choose the menu controller.',
    menuScope = null,
    inactive = false,
    disposed = false,
    frameId = null,
    stopNative = () => {};
  const preparationStatus = createOperationStatus($('race-preparation'), {
    isCurrent: () => !disposed,
  });
  let preparationDisplay = null;
  let menuRouter, navigation, shell;
  $('race-tap').checked = matchMedia('(pointer: coarse)').matches;
  $('race-reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clear({ resetDirection = false } = {}) {
    if (resetDirection) input.clear();
    else input.clearPhysical();
    accumulator = 0;
    menuRouter?.clear();
    navigation?.clear();
    if (match?.status === 'running') menuScope = 'flight';
    menuHint = '';
  }
  function actionFocus(origin) {
    const startedHere = document.activeElement === origin,
      scope = shell.scope();
    let moved = false;
    const observe = (event) => {
      if (![origin, document.body, document.documentElement].includes(event.target)) moved = true;
    };
    document.addEventListener('focusin', observe);
    return (target, current) => {
      document.removeEventListener('focusin', observe);
      if (
        current &&
        !disposed &&
        startedHere &&
        !moved &&
        shell.scope() === scope &&
        !target.disabled &&
        !target.closest('[hidden],[inert]')
      )
        target.focus({ preventScroll: true });
    };
  }
  function cancelContent() {
    if (!contentBusy) return;
    preparationDisplay?.finish({ state: 'cancelled', message: '' });
    preparationDisplay = null;
    contentController?.abort();
    installed?.clear();
    backdrop = null;
    contentBusy = false;
    contentReady = false;
    contentError = 'Picture loading cancelled. Retry when you are ready.';
    if (installedStatus === 'Checking installed chapters…')
      installedStatus = 'Installed chapter check cancelled. Refresh when ready.';
    $('race-message').textContent = contentError;
    updateMenu();
  }
  function prepare() {
    preparationStatus.clear();
    preparationDisplay = null;
    contentController?.abort();
    installed?.clear();
    contentController = new AbortController();
    contentScope = shell?.scope() || 'main';
    contentError = null;
    contentBusy = false;
    contentReady = false;
    clear({ resetDirection: true });
    const entry = maps.find((m) => m.key === $('race-level').value),
      level = entry.level;
    const classId = entry.classes.some((c) => c.id === $('race-class').value)
      ? $('race-class').value
      : entry.classes[0].id;
    $('race-class').replaceChildren(...entry.classes.map((c) => new Option(c.label, c.id)));
    $('race-class').value = classId;
    const themeId =
      selectedMapKey !== entry.key && entry.defaultThemeId
        ? entry.defaultThemeId
        : $('race-theme').value;
    selectedMapKey = entry.key;
    backdrop = entry.backdrop || null;
    theme = entry.themes.find((t) => t.id === themeId) || entry.themes[0];
    $('race-theme').replaceChildren(...entry.themes.map((t) => new Option(t.name, t.id)));
    $('race-theme').value = theme.id;
    match = createDuel(
      level,
      { seed: 2026, turnPolicy: $('race-turn').value, classId, classRecipes: entry.classes },
      { seconds: Number($('race-time').value) },
    );
    generation++;
    const { width, height } = boardPaintSizeForLevel(level);
    for (const player of [0, 1]) {
      const canvas = $(`race-canvas-${player}`);
      canvas.width = width;
      canvas.height = height;
      canvas.style.setProperty('--board-ratio', `${width} / ${height}`);
    }
    sound.reset();
    sound.setTrack(entry.track || DEFAULT_TRACKS[0], { atBoundary: true });
    publishedPlayer?.setAuthoredTrack(entry.track || DEFAULT_TRACKS[0]);
    publishedPlayer?.setContext({ themeId: theme.id });
    painters.forEach((p) => {
      p.setLook(theme, bodyFor(theme, $('race-class').value), entry.visualOverrides);
      p.setLevel?.(level, { seed: 2026 });
      p.skipCelebration?.();
    });
    finished = false;
    $('race-start').textContent = 'Start round ↗';
    contentReady = shippedMaps.includes(entry);
    contentBusy = !contentReady;
    $('race-message').textContent = contentReady
      ? [featuredStatus, 'Both boards use the same map, class and seed. Ready when you are.']
          .filter(Boolean)
          .join(' ')
      : 'Checking this chapter and loading its original picture…';
    updateMenu();
    if (contentReady) return Promise.resolve(true);
    const selectedRun = match,
      ticket = generation,
      controller = contentController;
    const current = () =>
      !disposed && !controller.signal.aborted && match === selectedRun && ticket === generation;
    const display = preparationStatus.begin({
      message: 'Checking this chapter and loading its original picture…',
      stage: 'verifying',
      isCurrent: current,
    });
    preparationDisplay = display;
    return (async () => {
      try {
        const image = await installed.select(entry, {
          themeId: theme.id,
          raceId: ticket,
          signal: controller.signal,
          onStatus: (status) => display.update(status),
        });
        if (disposed || controller.signal.aborted || match !== selectedRun || ticket !== generation)
          return false;
        backdrop = image;
        contentReady = true;
        $('race-message').textContent =
          'Original picture ready for both boards. Start when you are ready.';
        display.finish({ message: '' });
        return true;
      } catch (error) {
        if (disposed || controller.signal.aborted || match !== selectedRun || ticket !== generation)
          return false;
        contentError = `This chapter could not load: ${error.message}`;
        $('race-message').textContent = contentError;
        display.finish({ state: 'error', message: '' });
        return false;
      } finally {
        if (!disposed && controller === contentController && !controller.signal.aborted) {
          contentBusy = false;
          updateMenu();
        }
      }
    })();
  }
  function pause() {
    sound.pause();
    if (!match || match.status === 'finished') return;
    pauseDuel(match, { preserveContinuation: true });
    clear();
    if (match.status === 'paused') {
      $('race-start').textContent = 'Resume round →';
      $('race-message').textContent = 'Both players are paused. Resume when everyone is ready.';
    }
    updateMenu();
  }
  $('race-start').onclick = async () => {
    if (
      disposed ||
      contentBusy ||
      !contentReady ||
      match.status === 'running' ||
      shell.scope() !== 'main'
    )
      return;
    if (match.status === 'finished') {
      if (won.some((n) => n >= 2)) won = [0, 0];
      // A fresh installed round first loads its original, then awaits a new Start.
      const ready = prepare();
      if (contentBusy) {
        await ready;
        return;
      }
    }
    const entry = maps.find((row) => row.key === selectedMapKey),
      selectedRun = match,
      ticket = generation;
    if (match.status === 'ready' && !shippedMaps.includes(entry)) {
      const restoreFocus = actionFocus($('race-start'));
      contentBusy = true;
      const controller = contentController;
      const display = preparationStatus.begin({
        message: 'Confirming the prepared picture before starting…',
        stage: 'verifying',
        isCurrent: () =>
          !disposed &&
          !controller.signal.aborted &&
          controller === contentController &&
          match === selectedRun &&
          ticket === generation,
      });
      preparationDisplay = display;
      updateMenu();
      try {
        await installed.confirm(entry, {
          raceId: ticket,
          signal: controller.signal,
          onStatus: (status) => display.update(status),
        });
        if (
          disposed ||
          contentController.signal.aborted ||
          match !== selectedRun ||
          ticket !== generation ||
          shell.scope() !== 'main'
        )
          return;
      } catch (error) {
        if (
          !disposed &&
          match === selectedRun &&
          ticket === generation &&
          !contentController.signal.aborted
        ) {
          contentReady = false;
          contentError = `Refresh installed chapters in Race setup before starting: ${error.message}`;
          $('race-message').textContent = contentError;
          display.finish({ state: 'error', message: '' });
        }
        return;
      } finally {
        if (!disposed && match === selectedRun && ticket === generation) {
          if (!contentError) display.finish({ message: '' });
          contentBusy = false;
          updateMenu();
        }
        restoreFocus(
          $('race-chapter-retry'),
          contentError && match === selectedRun && ticket === generation,
        );
      }
    }
    if (!contentReady || disposed) return;
    clear();
    resumeDuel(match, { preserveContinuation: true });
    neutralResumeTick = true;
    if (publishedPlayer && sound.enabled) publishedPlayer.resume().catch(() => {});
    else sound.resume().catch(() => {});
    $('race-message').textContent = 'Make your line count. First clear wins.';
    updateMenu();
    input.focus();
  };
  $('race-chapter-retry').onclick = async () => {
    if (disposed || contentBusy || match.status !== 'ready') return;
    const restoreFocus = actionFocus($('race-chapter-retry'));
    const ready = prepare(),
      controller = contentController;
    try {
      return await ready;
    } finally {
      restoreFocus(
        contentReady ? $('race-start') : $('race-chapter-retry'),
        controller === contentController && !controller.signal.aborted,
      );
    }
  };
  $('race-installed-refresh').onclick = async () => {
    if (disposed || contentBusy || match.status !== 'ready' || !installed) return;
    const restoreFocus = actionFocus($('race-installed-refresh'));
    contentController?.abort();
    contentController = new AbortController();
    let focusController = contentController;
    const controller = contentController,
      oldKey = selectedMapKey,
      oldEntry = maps.find((row) => row.key === oldKey);
    contentBusy = true;
    contentReady = false;
    contentScope = shell.scope();
    if (!shippedMaps.includes(oldEntry)) backdrop = null;
    installedStatus = 'Checking installed chapters…';
    const display = preparationStatus.begin({
      message: installedStatus,
      stage: 'verifying',
      isCurrent: () => !disposed && !controller.signal.aborted && controller === contentController,
    });
    preparationDisplay = display;
    updateMenu();
    try {
      const rows = await installed.refresh({
        signal: controller.signal,
        onStatus: (status) => display.update(status),
      });
      if (disposed || controller.signal.aborted || controller !== contentController) return;
      maps.splice(0, maps.length, ...shippedMaps, ...rows);
      // Preserve a missing selection as unavailable; never silently switch its owner.
      if (!maps.some((row) => row.key === oldKey)) maps.push(oldEntry);
      showMaps();
      $('race-level').value = oldKey;
      installedStatus = rows.length
        ? `${rows.length} installed maps available.`
        : 'No installed chapters. Install them in solo More worlds, then refresh.';
      const ready = prepare();
      focusController = contentController;
      await ready;
    } catch (error) {
      if (disposed || controller.signal.aborted || controller !== contentController) return;
      contentError = `Installed chapters unavailable: ${error.message}`;
      installedStatus = contentError;
      $('race-message').textContent = contentError;
      display.finish({ state: 'error', message: '' });
    } finally {
      if (!disposed && controller === contentController && !controller.signal.aborted) {
        contentBusy = false;
        updateMenu();
      }
      restoreFocus(
        $('race-installed-refresh'),
        focusController === contentController && !focusController.signal.aborted,
      );
    }
  };
  $('race-pause').onclick = () => {
    if (shell.scope() === 'review') shell.back();
    else pause();
  };
  onNativeInactive(suspend)
    .then((stop) => {
      if (disposed) stop();
      else stopNative = stop;
    })
    .catch((error) => {
      if (!disposed)
        $('race-message').textContent = `App lifecycle adapter unavailable: ${error.message}`;
    });
  for (const id of ['race-level', 'race-class', 'race-turn', 'race-time'])
    $(id).onchange = () => {
      if (match?.status !== 'ready' || disposed) return;
      won = [0, 0];
      prepare();
    };
  $('race-theme').onchange = () => {
    if (match?.status !== 'ready' || disposed) return;
    prepare();
  };
  $('race-audio').onclick = async () => {
    try {
      let on;
      if (publishedPlayer) {
        if (sound.enabled) {
          publishedPlayer.pause();
          on = sound.disable();
        } else {
          await publishedPlayer.play();
          on = sound.enabled;
        }
      } else on = await sound.toggle();
      if (disposed) return;
      $('race-audio').textContent = on ? 'Mute music ♫' : 'Enable music ♫';
    } catch (e) {
      if (!disposed) $('race-menu-status').textContent = e.message;
    }
  };
  $('race-tap').onchange = clear;
  const input = attachCouchInput({
    continuousSteering: () => true,
    getGamepads: readCachedPads,
    active: () => match?.status === 'running',
    tapMode: () => $('race-tap').checked,
    onPause: pause,
    onAcceptedInput: (player, source) => shell?.observe(player, source),
    onStop: (player) => {
      if (match) releaseInputs(match.runs[player]);
    },
    onPads: (count, nextSlots) => {
      assignmentsChanged = nextSlots.some((slot, i) => slot !== slots[i]);
      slots = [...nextSlots];
      const message = `${count} standard controller${count === 1 ? '' : 's'} assigned · ${slots.map((slot, i) => `Player ${i + 1}: ${slot === null ? 'keyboard/touch' : `pad slot ${slot}`}`).join(' · ')}. Keyboard and touch remain available. Escape pauses both boards.`;
      if ($('race-pad-status').textContent !== message) $('race-pad-status').textContent = message;
    },
  });
  shell = createCouchShell({
    coarse: matchMedia('(pointer: coarse)').matches,
    onTransition: ({ to, back = false } = {}) => {
      clear();
      if (back || to !== contentScope) cancelContent();
    },
    onNewMatch: () => {
      if (match?.status === 'running' || disposed) return;
      won = [0, 0];
      prepare();
      contentScope = 'setup';
    },
  });
  function couchScope() {
    return match?.status === 'running'
      ? 'flight'
      : `couch:${match?.status || 'loading'}:${generation}:${shell?.scope() || 'main'}`;
  }
  function readCachedPads() {
    if (frameReadError) throw frameReadError;
    return framePads;
  }
  function readAssignedMenuPads() {
    // Keep sparse browser positions. The router also receives the physical index.
    return readCachedPads().map((pad) => (slots.includes(pad?.index) ? pad : null));
  }
  function capturePads() {
    framePads = [];
    frameReadError = null;
    try {
      if (typeof navigator.getGamepads !== 'function') throw new Error('Gamepad API unavailable');
      const pads = navigator.getGamepads();
      const count = Number.isInteger(pads?.length) ? Math.max(0, Math.min(32, pads.length)) : 0;
      framePads = Array.from({ length: count }, (_, i) => pads[i] || null);
    } catch (error) {
      frameReadError = error || new Error('Controller read failed');
    }
    const next = new Map();
    for (const pad of framePads) {
      if (!pad?.connected || pad.mapping !== 'standard') continue;
      next.set(
        pad.index,
        JSON.stringify([
          typeof pad.id === 'string' ? pad.id.slice(0, 512) : '',
          pad.mapping,
          pad.buttons?.length ?? 0,
          pad.axes?.length ?? 0,
        ]),
      );
    }
    for (const index of slots) {
      if (
        index === null ||
        !padDescriptors.has(index) ||
        next.get(index) === padDescriptors.get(index)
      )
        continue;
      // Couch flight allocation is index-based. A changed descriptor is a new
      // device even if a disconnect event was missed between animation frames.
      menuRouter.disconnect(index);
      pendingPadLoss = true;
      pause();
      clear();
    }
    padDescriptors = next;
  }
  function focusPrimaryAction() {
    if (!match || match.status === 'running' || disposed) return;
    shell.focus();
    navigation.engage();
    menuHint = 'Choose the primary action with South when everyone is ready.';
    updateMenu();
  }
  function updateMenu() {
    if (!match || disposed) return;
    const running = match.status === 'running';
    $('race-message').hidden = contentBusy;
    $('race-installed-status').hidden = contentBusy;
    $('race-start').disabled = running || contentBusy || !contentReady;
    $('race-chapter-retry').hidden = !contentError || match.status !== 'ready';
    $('race-chapter-retry').disabled = contentBusy;
    $('race-installed-refresh').disabled = match.status !== 'ready' || contentBusy || !installed;
    $('race-installed-status').textContent = [featuredStatus, installedStatus]
      .filter(Boolean)
      .join(' ');
    $('race-pause').disabled = !running;
    $('race-menu-release').hidden = running || !menuOwner;
    $('race-menu-release').disabled = running || !menuOwner;
    const entry = maps.find((m) => m.key === selectedMapKey);
    shell?.update({
      match,
      won,
      contentBusy,
      summary: `${entry.chapter} · ${entry.level.name} · ${mode(entry.level)} · ${theme.name} · ${$('race-turn').value === 'grid-center' ? 'Grid-center turns' : 'Immediate turns'} · ${Number($('race-time').value)} seconds`,
    });
    const owner = menuOwner ? slots.indexOf(menuOwner.index) : -1;
    const text = running
      ? shell.controllerHint()
      : `${owner >= 0 ? `Player ${owner + 1} controller has the menu. South selects; East cancels; Menu goes back.` : menuStatus}${menuGate ? ` ${menuGate}` : ''}${menuHint ? ` ${menuHint}` : ''} Keyboard and touch remain available.`;
    if ($('race-menu-status').textContent !== text) $('race-menu-status').textContent = text;
  }
  menuRouter = createControllerRouter({ readPads: readAssignedMenuPads });
  const menuIds = new Set([
    'race-coop',
    'race-start',
    'race-chapter-retry',
    'race-installed-refresh',
    'race-focus',
    'race-options',
    'race-help',
    'race-solo-return',
    'race-level',
    'race-theme',
    'race-class',
    'race-turn',
    'race-time',
    'race-setup-back',
    'race-touch-0',
    'race-touch-1',
    'race-tap',
    'race-reduced',
    'race-audio',
    'race-menu-release',
    'race-options-back',
    'race-help-back',
    'race-help-read',
    'race-help-reading',
    'race-review',
    'race-pause',
    'race-confirm-back',
    'race-confirm-reset',
    'race-leave-back',
    'race-leave',
  ]);
  navigation = attachControllerNavigation({
    getScope: couchScope,
    getRoot: () => shell.root(),
    getDefaultFocus: () => shell.primary(),
    keyboard: true,
    accept: (element) => menuIds.has(element.id),
    getControlLabels: () => ({ directions: 'D-pad / left stick', confirm: 'South', back: 'East' }),
    onBack: () => shell.back(),
    onMenu: () => shell.back(),
    onHint: (message) => {
      menuHint = message;
      updateMenu();
    },
  });
  $('race-help-read').onclick = () =>
    navigation.beginReading({
      region: $('race-help-reading'),
      origin: $('race-help-read'),
      label: 'Couch controls',
    });
  $('race-menu-release').onclick = () => {
    if (match.status === 'running' || !menuOwner) return;
    menuRouter.invalidate();
    menuOwner = null;
    clear();
    menuStatus =
      'Menu controller released. Release controls, then press a face button or Menu to join.';
    updateMenu();
    shell.focus();
  };
  function sampleMenu(now) {
    const scope = couchScope();
    // Even Ready can lose or reassign a pad without changing the duel status.
    // Clear before sampling so that this frame cannot claim a new menu owner.
    if (assignmentsChanged || pendingPadLoss) menuRouter.clear();
    const result = menuRouter.sample({ scope, timeMs: now });
    const released = !menuOwner && result.disconnected;
    menuOwner = result.assigned;
    menuGate =
      menuOwner && ['joined', 'waiting-neutral'].includes(result.status.code)
        ? 'Release controller buttons and the movement stick to continue.'
        : '';
    if (result.disconnected) {
      clear();
      if (!released) menuStatus = result.status.message;
      updateMenu();
      return;
    }
    menuStatus = frameReadError
      ? 'Controller access is unavailable.'
      : !framePads.some((pad) => pad?.connected && pad.mapping === 'standard') &&
          framePads.some((pad) => pad?.connected)
        ? 'This controller has no standard mapping.'
        : result.status.message;
    if (assignmentsChanged || pendingPadLoss) {
      clear();
      updateMenu();
      return;
    }
    if (menuOwner && result.status.code === 'joined') {
      menuScope = scope;
      focusPrimaryAction();
    } else if (scope !== menuScope) {
      menuScope = scope;
      navigation.clear();
      navigation.sync();
    } else {
      navigation.handle(result.ui);
    }
    updateMenu();
  }
  function suspend() {
    if (disposed) return;
    pause();
    sound.suspend();
    publishedPlayer?.suspend();
    clear();
    framePads = [];
    frameReadError = null;
    last = 0;
    inactive = true;
  }
  const hidden = () => {
    if (document.hidden) suspend();
  };
  const nativeMenuInput = () => {
    if (!disposed && match?.status !== 'running') {
      // Relinquishing DOM focus alone does not stop the router's held repeats.
      // Preserve native focus until a fresh neutral-and-press controller gesture.
      menuRouter.clear();
      menuHint = '';
    }
  };
  const disconnected = (event) => {
    if (slots.includes(event.gamepad?.index)) {
      menuRouter.disconnect(event.gamepad.index);
      pendingPadLoss = true;
      suspend();
    }
  };
  const pagehide = (event) => {
    suspend();
    if (event.persisted) return;
    contentController?.abort();
    disposed = true;
    preparationStatus.dispose();
    input.destroy();
    menuRouter.destroy();
    navigation.destroy();
    shell.destroy();
    stopNative();
    cancelAnimationFrame(frameId);
    window.removeEventListener('blur', suspend);
    window.removeEventListener('gamepaddisconnected', disconnected);
    window.removeEventListener('pagehide', pagehide);
    document.removeEventListener('visibilitychange', hidden);
    document.removeEventListener('pointerdown', nativeMenuInput, true);
    document.removeEventListener('keydown', nativeMenuInput, true);
  };
  window.addEventListener('blur', suspend);
  window.addEventListener('gamepaddisconnected', disconnected);
  window.addEventListener('pagehide', pagehide);
  document.addEventListener('visibilitychange', hidden);
  document.addEventListener('pointerdown', nativeMenuInput, true);
  document.addEventListener('keydown', nativeMenuInput, true);
  function frame(now) {
    if (disposed) return;
    const available = !document.hidden && document.hasFocus();
    if (!available && !inactive) suspend();
    if (available && inactive) {
      inactive = false;
      last = 0;
    }
    const dt = last ? Math.max(0, (now - last) / 1000) : 0;
    last = now;
    const wasRunning = match.status === 'running';
    if (available) {
      assignmentsChanged = false;
      capturePads();
      input.poll();
      if (!wasRunning) sampleMenu(now);
      pendingPadLoss = false;
    }
    if (available && wasRunning && match.status === 'running') {
      if (dt > 0.25) pause();
      else {
        accumulator += dt;
        while (accumulator + 1e-9 >= FIXED_DT && match.status === 'running') {
          const before = match.runs.map((r) => r.tick);
          const beforeStatus = match.runs.map((r) => r.status);
          const commands = input
            .consume()
            .map((command, i) =>
              beforeStatus[i] === 'respawning'
                ? { direction: null, boost: false, action: false, pickup: false }
                : neutralResumeTick
                  ? { ...command, boost: false, action: false, pickup: false }
                  : command,
            );
          stepDuel(match, commands);
          neutralResumeTick = false;
          for (let i = 0; i < 2; i++)
            if (
              beforeStatus[i] === 'respawning' ||
              match.runs[i].status === 'respawning' ||
              match.runs[i].events.some((event) => event.type === 'capture.stopped')
            )
              input.clearPlayer(i);
          accumulator -= FIXED_DT;
          for (let i = 0; i < 2; i++)
            if (match.runs[i].tick !== before[i]) {
              painters[i].effectsFor(match.runs[i].events, match.runs[i]);
              for (const event of match.runs[i].events) sound.event(event);
            }
        }
      }
    }
    if (match.status === 'finished' && !finished) {
      finished = true;
      clear();
      if (match.winner !== null) won[match.winner]++;
      const name =
        match.winner === 0 ? 'Sunflower' : match.winner === 1 ? 'Skyline' : 'Both players';
      $('race-message').textContent =
        `${match.winner === null ? 'Draw' : `${name} wins the round`}. ${match.reason}.${won.some((n) => n >= 2) ? ` ${name} wins the match!` : ''}`;
      $('race-start').textContent = won.some((n) => n >= 2)
        ? 'Play another match ↗'
        : 'Next round ↗';
      painters.forEach((p, i) => {
        if (match.runs[i].status === 'won')
          p.startCelebration?.({
            levelId: match.runs[i].levelId,
            seed: 2026,
            reduced: $('race-reduced').checked,
          });
      });
    }
    $('series-score').textContent = `${won[0]} : ${won[1]}`;
    const left = Math.max(0, Math.ceil((match.limitTicks - match.tick) / 120));
    $('race-clock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    for (let i = 0; i < 2; i++) {
      const run = match.runs[i];
      $(`racer-stats-${i}`).textContent =
        `${(run.coverage * 100).toFixed(1)}% · ${run.lives} lives · ${run.score} points`;
      $(`racer-state-${i}`).textContent = match.status === 'running' ? run.status : match.status;
      const cue = encounterView(run),
        group = $(`racer-encounter-${i}`),
        title = $(`racer-encounter-title-${i}`),
        instruction = $(`racer-encounter-instruction-${i}`);
      group.hidden = !cue;
      if (cue) {
        const context =
          match.status === 'paused'
            ? 'PAUSED · '
            : match.status === 'ready'
              ? 'READY · '
              : match.status === 'finished'
                ? 'ROUND ENDED · '
                : '';
        const heading = `${context}${cue.title}`;
        const copy =
          match.status === 'finished' && !['won', 'lost'].includes(run.status)
            ? `Frozen at round end. Live line ${cue.cutCells} / ${cue.min} new cells.`
            : cue.instruction;
        // The run owns this clock. Keep paused/finished cues and avoid rewriting unchanged text.
        if (title.textContent !== heading) title.textContent = heading;
        if (instruction.textContent !== copy) instruction.textContent = copy;
        group.dataset.phase = cue.phase;
      } else {
        title.textContent = '';
        instruction.textContent = '';
        delete group.dataset.phase;
      }
      painters[i].draw(contexts[i], run, Math.min(dt, 0.1), {
        paused: match.status !== 'running',
        reduced: $('race-reduced').checked,
        fullReveal: run.status === 'won',
        celebrationPaused: document.hidden,
        backdrop,
      });
    }
    (publishedPlayer || sound).update(
      match.status === 'running',
      theme,
      match.runs.find((r) => !['won', 'lost'].includes(r.status)) || match.runs[0],
    );
    updateMenu();
    frameId = requestAnimationFrame(frame);
  }
  const initialPreparation = prepare();
  frameId = requestAnimationFrame(frame);
  await initialPreparation;
  document.documentElement.dataset.toolState = contentReady ? 'ready' : 'error';
} catch (error) {
  document.documentElement.dataset.toolState = 'error';
  bootFailed = true;
  bootDisplay.finish({ state: 'error', message: `The race could not load: ${error.message}` });
  releaseArtwork({ persisted: false });
  $('race-start').disabled = true;
  $('race-message').textContent = `The race could not load: ${error.message}`;
} finally {
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  if (!bootFailed) {
    bootDisplay.clear();
    $('boot-return').hidden = true;
  }
}
