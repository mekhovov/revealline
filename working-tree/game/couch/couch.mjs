import { mountPresentationPage } from '../presentation/page.mjs';
import { createCouchShell } from './couch-shell.mjs';
import { createBoardFootprints } from './board-footprint.mjs';
import { readVersusSoloReturnToken } from '../mode-return-v2.mjs';
import { prepareCouchChapter } from './couch-chapter.mjs';
import { createCouchInstalledChapters } from './couch-installed-chapters.mjs';
import { createCouchStaticPictures } from './couch-static-pictures.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';
import { onNativeInactive } from '../platform.mjs';
import { createDuel, stepDuel, pauseDuel, resumeDuel } from '../multiplayer.mjs';
import { FIXED_DT, releaseInputs } from '../core/index.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { attachControllerReading } from '../ui/controller-reading.mjs';
import { readingInputPrompt } from '../ui/reading-input-prompt.mjs';
import { nextInputModality } from '../input-presentation.mjs';
import { BoardPainter, boardPaintSizeForLevel } from '../ui/render.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { Soundscape, DEFAULT_TRACKS } from '../ui/audio.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { attachMenuStyleControls } from '../ui/menu-style-controls.mjs';
import { attachPreferenceRestoration } from '../ui/preference-restoration.mjs';
import { settingsTabOwnsKey } from '../ui/settings-panels.mjs';
import { attachPublishedAudio } from '../ui/published-audio.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { createCharacterPresentations } from '../character-presentations.mjs';
import { emptyProgress, unlockedBodies } from '../progress.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
const $ = (id) => document.getElementById(id);
const unclaimedFocus = (element) =>
  !element || element === document.body || element === document.documentElement;
// Capture before attached() can hide a deliberately chosen loader recovery link.
let initialFocusPending =
  unclaimedFocus(document.activeElement) && !document.hidden && document.hasFocus?.() !== false;
const initialFocusChoice = (event) => {
  if (!unclaimedFocus(event.target)) initialFocusPending = false;
};
const initialFocusLost = () => {
  initialFocusPending = false;
};
const initialVisibility = () => {
  if (document.hidden) initialFocusLost();
};
const audioMaster = createAudioMaster();
const audioPreferences = createAudioPreferences({
  audioMaster,
  window,
  getStorage: () => localStorage,
  onWarning: (message) => {
    $('race-audio-status').textContent = message;
  },
});
const renderMasterPreferences = ({ muted, volume }) => {
  $('race-audio').textContent = muted ? 'Unmute sound' : 'Mute sound';
  $('race-quick-sound').textContent = muted ? 'Sound: off' : 'Sound: on';
  $('race-quick-sound').setAttribute('aria-pressed', String(!muted));
  $('race-master-volume').value = volume;
};
const stopMasterView = audioMaster.subscribe(renderMasterPreferences);
const audioRestoration = attachPreferenceRestoration({
  window,
  getSnapshot: () => audioMaster.snapshot(),
  render: renderMasterPreferences,
});
$('race-audio').onclick = () => audioPreferences.setMuted(!audioMaster.snapshot().muted);
$('race-quick-sound').onclick = () => audioPreferences.setMuted(!audioMaster.snapshot().muted);
$('race-master-volume').onchange = () =>
  audioPreferences.setVolume(Number($('race-master-volume').value));
const displayPreferences = createDisplayPreferences({
  window,
  matchMedia,
  getStorage: () => localStorage,
  onWarning: (message) => {
    $('race-display-status').textContent = message;
  },
});
const renderDisplayPreferences = (state) => {
  document.body.dataset.textFace = state.textFace;
  document.body.dataset.textSize = state.textSize;
  document.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
  $('race-text-face').value = state.textFace;
  $('race-text-size').value = state.textSize;
  $('race-reduced').checked = state.reducedEffects;
  $('race-system-reduction').textContent =
    state.effectiveReducedEffects && !state.reducedEffects
      ? 'System reduced motion is active. Your saved Reduced effects choice is unchanged.'
      : '';
};
const stopDisplayView = displayPreferences.subscribe(renderDisplayPreferences);
const displayRestoration = attachPreferenceRestoration({
  window,
  getSnapshot: () => displayPreferences.snapshot(),
  render: renderDisplayPreferences,
});
const menuStyle = attachMenuStyleControls({
  document,
  window,
  getStorage: () => localStorage,
  prefix: 'race-',
});
$('race-text-face').onchange = () =>
  displayPreferences.set({ textFace: $('race-text-face').value });
$('race-text-size').onchange = () =>
  displayPreferences.set({ textSize: $('race-text-size').value });
$('race-reduced').onchange = () =>
  displayPreferences.set({ reducedEffects: $('race-reduced').checked });
globalThis.RevealLineToolLaunch?.attached();
document.documentElement.dataset.toolState = 'loading';
const bootStatus = createOperationStatus($('boot-status'));
const bootDisplay = bootStatus.begin({ message: 'Preparing both boards…', stage: 'reading' });
let bootFailed = false;
let bootFinished = false;
function finishBoot() {
  if (bootFinished) return;
  bootFinished = true;
  document.querySelectorAll('[data-boot-inert]').forEach((element) => {
    element.inert = false;
    element.removeAttribute('aria-busy');
  });
  if (!bootFailed) {
    bootDisplay.clear();
    $('boot-return').hidden = true;
  }
}

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
// Cosmetic menu choice follows this same accepted release; it owns no board lease.
presentationPage.ready.then((snapshot) => menuStyle.setPresentation(snapshot)).catch(() => {});
let featured, installed, staticPictures, publishedAudio, publishedPlayer, boardFootprints;
const releaseArtwork = (event) => {
  if (event.persisted) return;
  stopMasterView();
  stopDisplayView();
  audioRestoration.dispose();
  displayRestoration.dispose();
  displayPreferences.dispose();
  menuStyle.dispose();
  audioPreferences.dispose();
  artworkLifetime.abort();
  publishedAudio?.close();
  publishedPlayer?.dispose();
  audioMaster.dispose();
  presentationPage.close();
  presentationFeedback.dispose();
  featured?.dispose();
  installed?.dispose();
  staticPictures?.dispose();
  boardFootprints?.dispose();
  window.removeEventListener('pagehide', releaseArtwork);
};
window.addEventListener('pagehide', releaseArtwork);
const json = async (url) => {
  const r = await fetch(url, { signal: artworkLifetime.signal });
  if (!r.ok) throw new Error(`Could not load ${url}`);
  return r.json();
};
try {
  document.addEventListener('focusin', initialFocusChoice, true);
  document.addEventListener('visibilitychange', initialVisibility);
  window.addEventListener('blur', initialFocusLost);
  window.addEventListener('pagehide', initialFocusLost);
  const [campaign, registry, themes, presets] = await Promise.all([
    json('../content/campaign.json'),
    json('../content/classes.json'),
    json('../content/themes.json'),
    json('../../authoring/motion-lab/presets.json'),
  ]);
  const characterPresentations = createCharacterPresentations(presets);
  const baseEntry = {
    campaign: { ...campaign, classRecipes: registry },
    classRecipes: registry,
    themes: themes.themes,
    visualOverrides: {},
    levelVisuals: [],
    music: [],
    sourcePackId: null,
  };
  const maps = campaign.levels.map((level) => ({
    key: level.id,
    chapter: campaign.title,
    level,
    classes: registry,
    themes: themes.themes,
    visualOverrides: {},
    defaultThemeId: level.themeId || campaign.themeId,
    track: null,
    pictureEntry: baseEntry,
    authoredBackground: null,
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
        pictureEntry: featured.resolved,
        authoredBackground:
          featured.resolved.levelVisuals.find((v) => v.levelId === level.id)?.visualOverrides
            ?.background ||
          featured.resolved.visualOverrides.background ||
          null,
      })),
    );
  }
  const shippedMaps = [...maps];
  staticPictures = createCouchStaticPictures({
    entries: [baseEntry, ...(featured ? [featured.resolved] : [])],
    presentationPage,
  });
  let installedStatus = 'Installed chapters have not been checked.';
  try {
    const channel = document.querySelector('meta[name="revealline-offline"]')
      ? `release-${(await json('../build-info.json')).version}`
      : 'dev';
    installed = createCouchInstalledChapters({
      channel,
      registeredEntries: [baseEntry],
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
  const sound = new Soundscape({ persistentMusic: true, audioMaster });
  sound.configure({ master: 1 });
  const musicElement = document.createElement('audio');
  if (typeof musicElement.play === 'function') {
    publishedPlayer = createSoundtrackPlayer({
      audioMaster,
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
  const touchPads = [...document.querySelectorAll('.race-pad')];
  boardFootprints = createBoardFootprints([0, 1].map((i) => $(`race-canvas-${i}`)));
  let boardLayoutKey = null;
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
    raceSequence = 0,
    roundRecipe = null,
    nextAttempt = null,
    preparedFocusMatch = null,
    startIntentEpoch = 0,
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
  let menuRouter, navigation, shell, reading;
  let readingModality = 'pointer';
  const readingPrompt = ({ scrollable }) =>
    readingInputPrompt({
      modality: readingModality,
      scrollable,
      controls: { confirm: 'South', back: 'East' },
    });
  function setReadingModality(modality) {
    if (readingModality === modality) return;
    readingModality = modality;
    reading?.refresh();
    navigation?.refreshReadingHint();
  }
  $('race-tap').checked = matchMedia('(pointer: coarse)').matches;

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
    const foreground = () => !document.hidden && document.hasFocus(),
      startedHere = document.activeElement === origin && foreground(),
      scope = shell.scope();
    let moved = false,
      shifting = false,
      pendingTarget = null;
    const observe = (event) => {
      if (!shifting && ![origin, document.body, document.documentElement].includes(event.target))
        moved = true;
    };
    const hidden = () => {
      if (!foreground()) moved = true;
    };
    const blurred = () => {
      moved = true;
    };
    const owns = (current) =>
      current &&
      !disposed &&
      startedHere &&
      !moved &&
      foreground() &&
      shell.scope() === scope &&
      [origin, pendingTarget, document.body, document.documentElement].includes(
        document.activeElement,
      );
    const available = (target) =>
      target?.isConnected &&
      !target.disabled &&
      !target.closest('[hidden],[inert]') &&
      target.getClientRects().length > 0;
    document.addEventListener('focusin', observe);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', blurred);
    const close = () => {
      document.removeEventListener('focusin', observe);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', blurred);
    };
    const restore = (target, current, { retain = false } = {}) => {
      if (!retain) close();
      try {
        if (owns(current) && available(target)) target.focus({ preventScroll: true });
      } catch (error) {
        close();
        throw error;
      }
    };
    restore.close = close;
    restore.pending = (target, current) => {
      if (!owns(current) || !available(target)) return;
      // This transfer belongs to the action, not to a new user choice. Later
      // navigation or foreground loss still relinquishes completion focus.
      pendingTarget = target;
      shifting = true;
      try {
        target.focus({ preventScroll: true });
      } finally {
        shifting = false;
      }
    };
    restore.current = owns;
    return restore;
  }
  function cancelContent() {
    if (!contentBusy) return;
    preparationDisplay?.finish({ state: 'cancelled', message: '' });
    preparationDisplay = null;
    contentController?.abort();
    const retainedResult = match?.status === 'finished' && nextAttempt?.previous === match;
    if (retainedResult) {
      nextAttempt.lease?.cancel();
      installed?.cancel();
    } else {
      installed?.clear();
      backdrop = null;
    }
    staticPictures.cancel();
    contentBusy = false;
    contentReady = retainedResult;
    contentError = retainedResult
      ? 'Next picture loading cancelled. Results are kept. Choose Next when you are ready.'
      : 'Picture loading cancelled. Retry when you are ready.';
    if (installedStatus === 'Checking installed chapters…')
      installedStatus = 'Installed chapter check cancelled. Refresh when ready.';
    $('race-message').textContent = contentError;
    updateMenu();
  }
  $('race-picture-cancel').onclick = () => {
    const restoreFocus = actionFocus($('race-picture-cancel'));
    cancelContent();
    restoreFocus(
      match.status === 'finished' ? $('race-start') : $('race-chapter-retry'),
      !!contentError,
    );
  };
  function prepare() {
    nextAttempt?.lease?.cancel();
    nextAttempt = null;
    preparedFocusMatch = null;
    preparationStatus.clear();
    preparationDisplay = null;
    contentController?.abort();
    installed?.clear();
    staticPictures.cancel();
    contentController = new AbortController();
    contentScope = shell?.scope() || 'main';
    contentError = null;
    contentBusy = false;
    contentReady = false;
    clear({ resetDirection: true });
    const entry = maps.find((m) => m.key === $('race-level').value);
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
    roundRecipe = {
      entry,
      theme,
      classId,
      turnPolicy: $('race-turn').value,
      seconds: Number($('race-time').value),
    };
    match = createRound(roundRecipe);
    generation = ++raceSequence;
    paintRound(roundRecipe);
    finished = false;
    $('race-start').textContent = 'Start round ↗';
    return loadPreparedPicture(entry);
  }
  function createRound(recipe) {
    return createDuel(
      recipe.entry.level,
      {
        seed: 2026,
        turnPolicy: recipe.turnPolicy,
        classId: recipe.classId,
        classRecipes: recipe.entry.classes,
      },
      { seconds: recipe.seconds },
    );
  }
  function paintRound(recipe) {
    const { entry, theme, classId } = recipe,
      level = entry.level,
      { width, height } = boardPaintSizeForLevel(level);
    for (const player of [0, 1]) {
      const canvas = $(`race-canvas-${player}`);
      canvas.width = width;
      canvas.height = height;
    }
    boardFootprints.refresh();
    sound.reset();
    sound.setTrack(entry.track || DEFAULT_TRACKS[0], { atBoundary: true });
    publishedPlayer?.setAuthoredTrack(entry.track || DEFAULT_TRACKS[0]);
    publishedPlayer?.setContext({ themeId: theme.id });
    painters.forEach((p) => {
      p.setLook(theme, bodyFor(theme, classId), entry.visualOverrides);
      p.setLevel?.(level, { seed: 2026 });
      p.skipCelebration?.();
    });
  }
  function loadPreparedPicture(entry) {
    contentReady = false;
    contentBusy = true;
    contentError = null;
    const staticEntry = shippedMaps.includes(entry),
      owner = staticEntry ? staticPictures : installed,
      message = staticEntry
        ? 'Checking this map and preparing the same picture for both boards…'
        : 'Checking this chapter and loading its original picture…';
    $('race-message').textContent = message;
    updateMenu();
    const selectedRun = match,
      ticket = generation,
      controller = contentController;
    const current = () =>
      !disposed && !controller.signal.aborted && match === selectedRun && ticket === generation;
    const display = preparationStatus.begin({
      message,
      stage: 'verifying',
      isCurrent: current,
    });
    preparationDisplay = display;
    return (async () => {
      try {
        const image = await owner.select(entry, {
          themeId: theme.id,
          raceId: ticket,
          signal: controller.signal,
          onStatus: (status) => display.update(status),
        });
        if (disposed || controller.signal.aborted || match !== selectedRun || ticket !== generation)
          return false;
        backdrop = image;
        contentReady = true;
        $('race-message').textContent = [
          staticEntry ? featuredStatus : '',
          image?.notice,
          'Both boards use the same map, class, seed and prepared picture. Start when you are ready.',
        ]
          .filter(Boolean)
          .join(' ');
        display.finish({ message: '' });
        return true;
      } catch (error) {
        if (disposed || controller.signal.aborted || match !== selectedRun || ticket !== generation)
          return false;
        contentError = `This ${staticEntry ? 'map picture' : 'chapter'} could not load: ${error.message}`;
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
  async function prepareNext() {
    if (!nextAttempt || nextAttempt.previous !== match || nextAttempt.recipe !== roundRecipe) {
      nextAttempt = {
        previous: match,
        previousGeneration: generation,
        recipe: roundRecipe,
        match: createRound(roundRecipe),
        raceId: ++raceSequence,
        resetWins: won.some((n) => n >= 2),
        lease: null,
      };
    }
    const restoreFocus = actionFocus($('race-start')),
      attempt = nextAttempt,
      { entry } = attempt.recipe,
      isStatic = shippedMaps.includes(entry),
      owner = isStatic ? staticPictures : installed;
    contentController?.abort();
    const controller = new AbortController();
    contentController = controller;
    contentScope = shell.scope();
    contentBusy = true;
    contentError = null;
    const current = () =>
      !disposed &&
      !controller.signal.aborted &&
      contentController === controller &&
      nextAttempt === attempt &&
      roundRecipe === attempt.recipe &&
      match === attempt.previous &&
      generation === attempt.previousGeneration;
    const display = preparationStatus.begin({
      message: 'Preparing the next picture. Your completed Results are kept until it is ready…',
      stage: 'verifying',
      isCurrent: current,
    });
    preparationDisplay = display;
    updateMenu();
    restoreFocus.pending($('race-picture-cancel'), current());
    let lease = null,
      prepared = null;
    try {
      lease = await owner.stage(entry, {
        themeId: attempt.recipe.theme.id,
        raceId: attempt.raceId,
        signal: controller.signal,
        onStatus: (status) => display.update(status),
      });
      if (!current()) return null;
      attempt.lease = lease;
      await lease.confirm({ onStatus: (status) => display.update(status) });
      if (!current()) return null;
      const retirePrevious = lease.commit();
      // Publish only plain references before cleanup can call back into the page.
      match = attempt.match;
      preparedFocusMatch = match;
      backdrop = lease.picture;
      generation = attempt.raceId;
      finished = false;
      if (attempt.resetWins) won = [0, 0];
      nextAttempt = null;
      retirePrevious();
      if (
        disposed ||
        controller.signal.aborted ||
        controller !== contentController ||
        match !== attempt.match
      )
        return null;
      clear({ resetDirection: true });
      paintRound(attempt.recipe);
      $('race-start').textContent = 'Start round ↗';
      $('race-message').textContent = [
        lease.picture?.notice,
        'Both boards use the prepared next picture. Start when you are ready.',
      ]
        .filter(Boolean)
        .join(' ');
      contentReady = true;
      display.finish({ message: '' });
      prepared = {
        match,
        controller,
        isStatic,
        ownsAction: () => restoreFocus.current(true),
        releaseFocus: restoreFocus.close,
      };
      return prepared;
    } catch (error) {
      if (current()) {
        contentError =
          'The next picture could not be prepared. Results are kept. Choose Next to retry.';
        $('race-message').textContent = contentError;
        display.finish({ state: 'error', message: '' });
        console.warn('Next picture preparation failed.', error);
      }
      return null;
    } finally {
      lease?.cancel();
      if (attempt.lease === lease) attempt.lease = null;
      if (!disposed && controller === contentController && !controller.signal.aborted) {
        contentBusy = false;
        updateMenu();
      }
      restoreFocus(
        $('race-start'),
        !disposed && controller === contentController && !controller.signal.aborted,
        { retain: !!prepared },
      );
    }
  }
  function pause() {
    // Suspend and controller-loss paths also pass here. Picture preparation
    // may finish, but an interrupted gesture no longer authorizes a start.
    startIntentEpoch++;
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
      document.hidden ||
      !document.hasFocus() ||
      match.status === 'running' ||
      shell.scope() !== 'main'
    )
      return;
    const intent = ++startIntentEpoch,
      ownsStartIntent = () =>
        !disposed && intent === startIntentEpoch && !document.hidden && document.hasFocus();
    let nextConfirmed = false,
      nextFocus = null;
    if (match.status === 'finished') {
      const prepared = await prepareNext();
      // Preparation may finish after blur, but only the original foreground
      // shipped Next gesture may start it. Installed chapters keep fresh Start.
      if (
        !prepared ||
        !prepared.isStatic ||
        !prepared.ownsAction() ||
        !ownsStartIntent() ||
        match !== prepared.match ||
        contentController !== prepared.controller ||
        prepared.controller.signal.aborted ||
        shell.scope() !== 'main'
      ) {
        prepared?.releaseFocus();
        return;
      }
      nextFocus = prepared;
      nextConfirmed = true;
    }
    const entry = maps.find((row) => row.key === selectedMapKey),
      selectedRun = match,
      ticket = generation;
    if (match.status === 'ready' && !nextConfirmed) {
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
        const confirmation = (shippedMaps.includes(entry) ? staticPictures : installed).confirm(
          entry,
          {
            raceId: ticket,
            signal: controller.signal,
            onStatus: (status) => display.update(status),
          },
        );
        if (confirmation?.then) {
          restoreFocus.pending(
            $('race-picture-cancel'),
            ownsStartIntent() && controller === contentController && !controller.signal.aborted,
          );
          await confirmation;
        }
        if (
          !ownsStartIntent() ||
          controller !== contentController ||
          controller.signal.aborted ||
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
          controller === contentController &&
          !controller.signal.aborted
        ) {
          contentReady = false;
          contentError = shippedMaps.includes(entry)
            ? `The prepared picture could not be confirmed. Retry or choose a new setup: ${error.message}`
            : `Refresh installed chapters in Race setup before starting: ${error.message}`;
          $('race-message').textContent = contentError;
          display.finish({ state: 'error', message: '' });
        }
        return;
      } finally {
        if (
          !disposed &&
          match === selectedRun &&
          ticket === generation &&
          controller === contentController &&
          !controller.signal.aborted
        ) {
          if (!contentError) display.finish({ message: '' });
          contentBusy = false;
          updateMenu();
        }
        restoreFocus(
          $('race-chapter-retry'),
          contentError &&
            ownsStartIntent() &&
            match === selectedRun &&
            ticket === generation &&
            controller === contentController &&
            !controller.signal.aborted,
        );
      }
    }
    try {
      if (!contentReady || disposed) return;
      clear();
      if (!ownsStartIntent() || (nextFocus && !nextFocus.ownsAction())) return;
      resumeDuel(match, { preserveContinuation: true });
      neutralResumeTick = true;
      if (publishedPlayer) {
        (publishedPlayer.snapshot().track
          ? publishedPlayer.resume()
          : publishedPlayer.play()
        ).catch(() => {});
      } else sound.enable().catch(() => {});
      $('race-message').textContent = 'Make your line count. First clear wins.';
      updateMenu();
      input.focus();
    } finally {
      nextFocus?.releaseFocus();
    }
  };

  $('race-chapter-retry').onclick = async () => {
    if (disposed || contentBusy || match.status !== 'ready') return;
    const restoreFocus = actionFocus($('race-chapter-retry'));
    preparationStatus.clear();
    contentController?.abort();
    contentController = new AbortController();
    contentScope = shell.scope();
    const entry = maps.find((row) => row.key === selectedMapKey);
    // Retry the same untouched attempt and picture choice; only setup changes
    // establish a new race identity and may resolve a new assignment.
    const controller = contentController,
      ready = loadPreparedPicture(entry);
    restoreFocus.pending(
      $('race-picture-cancel'),
      controller === contentController && !controller.signal.aborted,
    );
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
      return prepare();
    };
  $('race-theme').onchange = () => {
    if (match?.status !== 'ready' || disposed) return;
    return prepare();
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
  let soloReturnStorage;
  try {
    soloReturnStorage = sessionStorage;
  } catch {
    /* The fixed Solo title route remains available. */
  }
  shell = createCouchShell({
    coarse: matchMedia('(pointer: coarse)').matches,
    getDepartureState: () => ({ match, generation }),
    onLeaveRequest: pause,
    getSoloReturnToken: () =>
      readVersusSoloReturnToken({ href: location.href, storage: soloReturnStorage }),
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
  function refreshBoardLayout() {
    // Observer-capable hosts receive the actual arena content box. The fallback
    // must also notice cue visibility/copy changes that can wrap above a board.
    const layoutKey = JSON.stringify([
      $('race-boards').hidden,
      ...touchPads.map((pad) => pad.hidden),
      document.body.dataset.textSize,
      document.body.dataset.textFace,
      ...(boardFootprints.observesResize
        ? []
        : [0, 1].flatMap((i) => [
            $(`racer-encounter-${i}`).hidden,
            $(`racer-encounter-title-${i}`).textContent,
            $(`racer-encounter-instruction-${i}`).textContent,
          ])),
    ]);
    if (layoutKey !== boardLayoutKey) {
      boardLayoutKey = layoutKey;
      boardFootprints.refresh();
    }
  }
  function updateMenu() {
    if (!match || disposed) return;
    const running = match.status === 'running';
    $('race-message').hidden = contentBusy;
    $('race-installed-status').hidden = contentBusy;
    $('race-start').disabled = running || contentBusy || !contentReady;
    $('race-chapter-retry').hidden = !contentError || match.status !== 'ready';
    $('race-chapter-retry').disabled = contentBusy;
    $('race-picture-cancel').hidden = !contentBusy;
    $('race-installed-refresh').disabled = match.status !== 'ready' || contentBusy || !installed;
    $('race-installed-status').textContent = [featuredStatus, installedStatus]
      .filter(Boolean)
      .join(' ');
    $('race-pause').disabled = !running;
    $('race-menu-release').hidden = running || !menuOwner;
    $('race-menu-release').disabled = running || !menuOwner;
    const entry = maps.find((m) => m.key === selectedMapKey);
    // The transaction's first Ready update belongs to its retained action
    // lease, including an update reentered from prior-image cleanup.
    const focusTransition = match !== preparedFocusMatch;
    preparedFocusMatch = null;
    shell?.update({
      match,
      won,
      contentBusy,
      focusTransition,
      summary: `${entry.chapter} · ${entry.level.name} · ${mode(entry.level)} · ${theme.name} · ${$('race-turn').value === 'grid-center' ? 'Grid-center turns' : 'Immediate turns'} · ${Number($('race-time').value)} seconds`,
    });
    // Reconcile deliberate layout transitions immediately, including browsers
    // without ResizeObserver. Ordinary frames only compare cheap state values.
    refreshBoardLayout();
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
    'race-picture-cancel',
    'race-installed-refresh',
    'race-focus',
    'race-options',
    'race-quick-sound',
    'race-settings-tab-controls',
    'race-settings-tab-audio',
    'race-settings-tab-display',
    'race-settings-tab-data',
    'race-data-read',
    'race-data-reading-done',
    'race-data-reading',
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
    'race-text-face',
    'race-text-size',
    'race-menu-palette',
    'race-menu-ornaments',
    'race-audio',
    'race-master-volume',
    'race-menu-release',
    'race-options-back',
    'race-help-back',
    'race-help-read',
    'race-help-reading-done',
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
    nativeReadingScroll: true,
    ownsKeyboardEvent: (event) => settingsTabOwnsKey(event, $('race-options-panel')),
    accept: (element) => menuIds.has(element.id),
    getControlLabels: () => ({ directions: 'D-pad / left stick', confirm: 'South', back: 'East' }),
    getReadingPrompt: readingPrompt,
    onNativeInput: (event) => setReadingModality(nextInputModality(readingModality, event)),
    onBack: () => shell.back(),
    onMenu: () => shell.back(),
    onHint: (message, context) => {
      if (
        context?.kind === 'reading' &&
        ['race-help-reading', 'race-data-reading'].includes(context.regionId)
      ) {
        menuHint = '';
        const hint = $(`${context.regionId}-hint`);
        if (hint.textContent !== message) hint.textContent = message;
      } else menuHint = message;
      updateMenu();
    },
    onReadingChange: (state) => reading?.changed(state),
  });
  reading = attachControllerReading({
    getNavigation: () => navigation,
    getScope: couchScope,
    getReadingPrompt: readingPrompt,
    revealOnResize: true,
    surfaceDefinitions: [
      ['race-help-reading', 'race-help-read', 'Couch controls', 'race-help-unit'],
      ['race-data-reading', 'race-data-read', 'Versus game data', 'race-data-unit'],
    ],
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
    if (result.status.code === 'joined' || Object.values(result.ui).some(Boolean))
      setReadingModality('controller');
    const released = !menuOwner && result.disconnected;
    menuOwner = result.assigned;
    menuGate =
      menuOwner && ['joined', 'waiting-neutral'].includes(result.status.code)
        ? 'Release controller buttons and the movement stick to continue.'
        : '';
    if (result.disconnected) {
      shell.cancelDeparture();
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
      shell.cancelDeparture();
      clear();
      updateMenu();
      return;
    }
    if (menuOwner && result.status.code === 'joined') {
      menuScope = scope;
      focusPrimaryAction();
    } else if (scope !== menuScope) {
      menuScope = scope;
      // Native input can already own a reader in this screen before the next
      // controller poll. Sync retires stale scopes without clearing that newer owner.
      navigation.sync();
    } else {
      navigation.handle(result.ui);
    }
    updateMenu();
  }
  function suspend() {
    if (disposed) return;
    shell?.cancelDeparture();
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
    reading.destroy();
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
            reduced: displayPreferences.snapshot().effectiveReducedEffects,
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
    }
    // Both cues must settle before fallback measurement and either board draw.
    refreshBoardLayout();
    for (let i = 0; i < 2; i++) {
      const run = match.runs[i];
      painters[i].draw(contexts[i], run, Math.min(dt, 0.1), {
        displayCSSWidth: boardFootprints.width(i),
        textFace: displayPreferences.snapshot().textFace,
        paused: match.status !== 'running',
        reduced: displayPreferences.snapshot().effectiveReducedEffects,
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
  const initialPreparation = prepare(),
    initialMatch = match,
    initialGeneration = generation;
  frameId = requestAnimationFrame(frame);
  // Install the usable lobby before waiting for its required picture. Cancel
  // and Back stay reachable; only Start waits for this exact preparation.
  finishBoot();
  document.documentElement.dataset.toolState = 'ready';
  const initialReady = await initialPreparation;
  const start = $('race-start');
  if (
    initialFocusPending &&
    initialReady &&
    !disposed &&
    !artworkLifetime.signal.aborted &&
    match === initialMatch &&
    generation === initialGeneration &&
    match.status === 'ready' &&
    contentReady &&
    !contentBusy &&
    shell.scope() === 'main' &&
    unclaimedFocus(document.activeElement) &&
    !document.hidden &&
    document.hasFocus?.() !== false &&
    start.isConnected &&
    !start.disabled &&
    !start.closest('[hidden],[inert],[aria-hidden="true"]') &&
    start.getClientRects().length > 0 &&
    document.defaultView?.getComputedStyle(start)?.visibility !== 'hidden'
  )
    start.focus({ preventScroll: true });
} catch (error) {
  document.documentElement.dataset.toolState = 'error';
  bootFailed = true;
  bootDisplay.finish({ state: 'error', message: `The race could not load: ${error.message}` });
  releaseArtwork({ persisted: false });
  $('race-start').disabled = true;
  $('race-message').textContent = `The race could not load: ${error.message}`;
} finally {
  initialFocusPending = false;
  document.removeEventListener('focusin', initialFocusChoice, true);
  document.removeEventListener('visibilitychange', initialVisibility);
  window.removeEventListener('blur', initialFocusLost);
  window.removeEventListener('pagehide', initialFocusLost);
  finishBoot();
}
