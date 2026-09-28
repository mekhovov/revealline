import { contentText } from '../i18n/content.mjs';
import { localizedText, t, localizedOption } from '../i18n/index.mjs';
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
import { createCharacterPresentations } from '../character-presentations.mjs';
import { emptyProgress, unlockedBodies } from '../progress.mjs';
const $ = (id) => document.getElementById(id);
const artworkLifetime = new AbortController();
let featured, installed;
const releaseArtwork = (event) => {
  if (event.persisted) return;
  artworkLifetime.abort();
  featured?.dispose();
  installed?.dispose();
  window.removeEventListener('pagehide', releaseArtwork);
};
window.addEventListener('pagehide', releaseArtwork);
const json = async (url) => {
  const r = await fetch(url, { signal: artworkLifetime.signal });
  if (!r.ok) throw new Error(t("gameplay:couldNotLoad", { value1: url }));
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
  featured = await prepareCouchChapter(await json('../content/packs/fpv-arcade-r5.json'), {
    signal: artworkLifetime.signal,
  });
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
  const shippedMaps = [...maps];
  let installedStatus = t("interface:installedChaptersHaveNotBeenChecked");
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
    const rows = await installed.refresh({ signal: artworkLifetime.signal });
    maps.push(...rows);
    installedStatus = rows.length
      ? t("gameplay:installedMapsAvailableChooseAMapToCheckItsOriginal", { value1: rows.length })
      : t("interface:noInstalledChaptersInThisProfileInstallChaptersInSolo");
  } catch (error) {
    installedStatus = t("gameplay:installedChaptersUnavailable", { value1: error.message });
  }
  if (artworkLifetime.signal.aborted)
    throw new DOMException(t("interface:couchArtworkLoadingCancelled"), 'AbortError');
  const mode = (level) => (arcadeActionCapabilities(level).manualAbility ? t("interface:tactical") : t("interface:arcade"));
  function showMaps() {
    $('race-level').replaceChildren(
      ...maps.map((m) => localizedOption(() => `${m.chapter} · ${contentText(m.level, 'name')} · ${mode(m.level)}`, m.key)),
    );
  }
  showMaps();
  $('race-level').value = maps[0].key;
  for (const t of themes.themes) $('race-theme').append(localizedOption(() => t.name, t.id));
  for (const c of registry) $('race-class').append(localizedOption(() => c.label, c.id));
  const painters = [new BoardPainter(presets), new BoardPainter(presets)];
  const sound = new Soundscape({ persistentMusic: true });
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
      t("interface:releaseControlsThenPressAFaceButtonOrMenuTo"),
    menuScope = null,
    inactive = false,
    disposed = false,
    frameId = null,
    stopNative = () => {};
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
    contentController?.abort();
    installed?.clear();
    backdrop = null;
    contentBusy = false;
    contentReady = false;
    contentError = t("interface:pictureLoadingCancelledRetryWhenYouAreReady");
    if (installedStatus === 'Checking installed chapters…')
      installedStatus = t("interface:installedChapterCheckCancelledRefreshWhenReady");
    localizedText($('race-message'), () =>contentError);
    updateMenu();
  }
  function prepare() {
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
    $('race-class').replaceChildren(...entry.classes.map((c) => localizedOption(() => c.label, c.id)));
    $('race-class').value = classId;
    const themeId =
      selectedMapKey !== entry.key && entry.defaultThemeId
        ? entry.defaultThemeId
        : $('race-theme').value;
    selectedMapKey = entry.key;
    backdrop = entry.backdrop || null;
    theme = entry.themes.find((t) => t.id === themeId) || entry.themes[0];
    $('race-theme').replaceChildren(...entry.themes.map((t) => localizedOption(() => t.name, t.id)));
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
    painters.forEach((p) => {
      p.setLook(theme, bodyFor(theme, $('race-class').value), entry.visualOverrides);
      p.setLevel?.(level, { seed: 2026 });
      p.skipCelebration?.();
    });
    finished = false;
    localizedText($('race-start'), () =>t("interface:startRound2"));
    contentReady = shippedMaps.includes(entry);
    contentBusy = !contentReady;
    localizedText($('race-message'), () =>contentReady
      ? t("interface:bothBoardsUseTheSameMapClassAndSeedReady")
      : t("interface:checkingThisChapterAndLoadingItsOriginalPicture"));
    updateMenu();
    if (contentReady) return Promise.resolve(true);
    const selectedRun = match,
      ticket = generation,
      controller = contentController;
    return (async () => {
      try {
        const image = await installed.select(entry, {
          themeId: theme.id,
          raceId: ticket,
          signal: controller.signal,
        });
        if (disposed || controller.signal.aborted || match !== selectedRun || ticket !== generation)
          return false;
        backdrop = image;
        contentReady = true;
        localizedText($('race-message'), () =>t("interface:originalPictureReadyForBothBoardsStartWhenYouAre"));
        return true;
      } catch (error) {
        if (disposed || controller.signal.aborted || match !== selectedRun || ticket !== generation)
          return false;
        contentError = t("gameplay:thisChapterCouldNotLoad", { value1: error.message });
        localizedText($('race-message'), () =>contentError);
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
      localizedText($('race-start'), () =>t("interface:resumeRound"));
      localizedText($('race-message'), () =>t("interface:bothPlayersArePausedResumeWhenEveryoneIsReady"));
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
      updateMenu();
      try {
        await installed.confirm(entry, { raceId: ticket, signal: contentController.signal });
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
          contentError = t("gameplay:refreshInstalledChaptersInRaceSetupBeforeStarting", { value1: error.message });
          localizedText($('race-message'), () =>contentError);
        }
        return;
      } finally {
        if (!disposed && match === selectedRun && ticket === generation) {
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
    sound.resume().catch(() => {});
    localizedText($('race-message'), () =>t("interface:makeYourLineCountFirstClearWins"));
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
    installedStatus = t("interface:checkingInstalledChapters");
    updateMenu();
    try {
      const rows = await installed.refresh({ signal: controller.signal });
      if (disposed || controller.signal.aborted || controller !== contentController) return;
      maps.splice(0, maps.length, ...shippedMaps, ...rows);
      // Preserve a missing selection as unavailable; never silently switch its owner.
      if (!maps.some((row) => row.key === oldKey)) maps.push(oldEntry);
      showMaps();
      $('race-level').value = oldKey;
      installedStatus = rows.length
        ? t("gameplay:installedMapsAvailable", { value1: rows.length })
        : t("interface:noInstalledChaptersInstallThemInSoloMoreWorldsThen");
      const ready = prepare();
      focusController = contentController;
      await ready;
    } catch (error) {
      if (disposed || controller.signal.aborted || controller !== contentController) return;
      contentError = t("gameplay:installedChaptersUnavailable", { value1: error.message });
      installedStatus = contentError;
      localizedText($('race-message'), () =>contentError);
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
        localizedText($('race-message'), () =>t("gameplay:appLifecycleAdapterUnavailable", { value1: error.message }));
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
      const on = await sound.toggle();
      if (disposed) return;
      localizedText($('race-audio'), () =>on ? t("interface:muteMusic") : t("interface:enableMusic2"));
    } catch (e) {
      if (!disposed) localizedText($('race-menu-status'), () =>e.message);
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
      const message = t("gameplay:standardControllerAssignedKeyboardAndTouchRemainAvailableEscapePauses", { value1: count, value2: count === 1 ? '' : 's', value3: slots.map((slot, i) => t("gameplay:player", { value1: i + 1, value2: slot === null ? 'keyboard/touch' : t("gameplay:padSlot", { value1: slot }) })).join(' · ') });
      if ($('race-pad-status').textContent !== message) localizedText($('race-pad-status'), () =>message);
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
      if (typeof navigator.getGamepads !== 'function') throw new Error(t("interface:gamepadApiUnavailable"));
      const pads = navigator.getGamepads();
      const count = Number.isInteger(pads?.length) ? Math.max(0, Math.min(32, pads.length)) : 0;
      framePads = Array.from({ length: count }, (_, i) => pads[i] || null);
    } catch (error) {
      frameReadError = error || new Error(t("interface:controllerReadFailed"));
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
    menuHint = t("interface:chooseThePrimaryActionWithSouthWhenEveryoneIsReady");
    updateMenu();
  }
  function updateMenu() {
    if (!match || disposed) return;
    const running = match.status === 'running';
    $('race-start').disabled = running || contentBusy || !contentReady;
    $('race-chapter-retry').hidden = !contentError || match.status !== 'ready';
    $('race-chapter-retry').disabled = contentBusy;
    $('race-installed-refresh').disabled = match.status !== 'ready' || contentBusy || !installed;
    localizedText($('race-installed-status'), () =>installedStatus);
    $('race-pause').disabled = !running;
    $('race-menu-release').hidden = running || !menuOwner;
    $('race-menu-release').disabled = running || !menuOwner;
    const entry = maps.find((m) => m.key === selectedMapKey);
    shell?.update({
      match,
      won,
      contentBusy,
      summary: t("gameplay:seconds", { value1: entry.chapter, value2: contentText(entry.level, 'name'), value3: mode(entry.level), value4: contentText(theme, 'name'), value5: $('race-turn').value === 'grid-center' ? t("interface:gridCenterTurns") : t("interface:immediateTurns"), value6: Number($('race-time').value) }),
    });
    const owner = menuOwner ? slots.indexOf(menuOwner.index) : -1;
    const text = running
      ? shell.controllerHint()
      : t("gameplay:keyboardAndTouchRemainAvailable", { value1: owner >= 0 ? t("gameplay:playerControllerHasTheMenuSouthSelectsEastCancelsMenu", { value1: owner + 1 }) : menuStatus, value2: menuGate ? ` ${menuGate}` : '', value3: menuHint ? ` ${menuHint}` : '' });
    if ($('race-menu-status').textContent !== text) localizedText($('race-menu-status'), () =>text);
  }
  menuRouter = createControllerRouter({ readPads: readAssignedMenuPads });
  const menuIds = new Set([
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
    getControlLabels: () => ({ directions: t("interface:dPadLeftStick"), confirm: t("interface:south"), back: t("interface:east") }),
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
      label: t("interface:couchControls"),
    });
  $('race-menu-release').onclick = () => {
    if (match.status === 'running' || !menuOwner) return;
    menuRouter.invalidate();
    menuOwner = null;
    clear();
    menuStatus =
      t("interface:menuControllerReleasedReleaseControlsThenPressAFaceButton");
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
        ? t("interface:releaseControllerButtonsAndTheMovementStickToContinue")
        : '';
    if (result.disconnected) {
      clear();
      if (!released) menuStatus = result.status.message;
      updateMenu();
      return;
    }
    menuStatus = frameReadError
      ? t("interface:controllerAccessIsUnavailable")
      : !framePads.some((pad) => pad?.connected && pad.mapping === 'standard') &&
          framePads.some((pad) => pad?.connected)
        ? t("interface:thisControllerHasNoStandardMapping")
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
        match.winner === 0 ? t("interface:sunflower2") : match.winner === 1 ? t("interface:skyline2") : t("interface:bothPlayers");
      localizedText($('race-message'), () =>`${match.winner === null ? t("interface:draw") : t("gameplay:winsTheRound", { value1: name })}. ${match.reason}.${won.some((n) => n >= 2) ? t("gameplay:winsTheMatch", { value1: name }) : ''}`);
      localizedText($('race-start'), () =>won.some((n) => n >= 2)
        ? t("interface:playAnotherMatch")
        : t("interface:nextRound"));
      painters.forEach((p, i) => {
        if (match.runs[i].status === 'won')
          p.startCelebration?.({
            levelId: match.runs[i].levelId,
            seed: 2026,
            reduced: $('race-reduced').checked,
          });
      });
    }
    localizedText($('series-score'), () =>`${won[0]} : ${won[1]}`);
    const left = Math.max(0, Math.ceil((match.limitTicks - match.tick) / 120));
    localizedText($('race-clock'), () =>`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    for (let i = 0; i < 2; i++) {
      const run = match.runs[i];
      localizedText($(`racer-stats-${i}`), () =>t("gameplay:livesPoints", { value1: (run.coverage * 100).toFixed(1), value2: run.lives, value3: run.score }));
      localizedText($(`racer-state-${i}`), () =>match.status === 'running' ? run.status : match.status);
      const cue = encounterView(run),
        group = $(`racer-encounter-${i}`),
        title = $(`racer-encounter-title-${i}`),
        instruction = $(`racer-encounter-instruction-${i}`);
      group.hidden = !cue;
      if (cue) {
        const context =
          match.status === 'paused'
            ? ("" + t("interface:paused2") + " ")
            : match.status === 'ready'
              ? ("" + t("interface:ready") + " ")
              : match.status === 'finished'
                ? ("" + t("interface:roundEnded") + " ")
                : '';
        const heading = `${context}${contentText(cue, 'title')}`;
        const copy =
          match.status === 'finished' && !['won', 'lost'].includes(run.status)
            ? t("gameplay:frozenAtRoundEndLiveLineNewCells", { value1: cue.cutCells, value2: cue.min })
            : cue.instruction;
        // The run owns this clock. Keep paused/finished cues and avoid rewriting unchanged text.
        if (title.textContent !== heading) localizedText(title, () =>heading);
        if (instruction.textContent !== copy) localizedText(instruction, () =>copy);
        group.dataset.phase = cue.phase;
      } else {
        localizedText(title, () =>'');
        localizedText(instruction, () =>'');
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
    sound.update(
      match.status === 'running',
      theme,
      match.runs.find((r) => !['won', 'lost'].includes(r.status)) || match.runs[0],
    );
    updateMenu();
    frameId = requestAnimationFrame(frame);
  }
  prepare();
  frameId = requestAnimationFrame(frame);
} catch (error) {
  releaseArtwork({ persisted: false });
  $('race-start').disabled = true;
  localizedText($('race-message'), () =>t("gameplay:theRaceCouldNotLoad", { value1: error.message }));
} finally {
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  $('boot-status').hidden = true;
}
