import { attachCouchMusicHost } from './couch-music-host.mjs';
import { prepareTeamMusicContext } from './couch-music-context.mjs';
import { attachPublishedAudio } from '../ui/published-audio.mjs';
import { mountModeChoices } from '../ui/mode-choice.mjs';
import {
  createCoop,
  startCoop,
  pauseCoop,
  resumeCoop,
  releaseCoopInputs,
  stepCoop,
  FIXED_DT,
} from '../coop/core.mjs';
import { COOP_PLAYTEST_CONFIGURATIONS } from '../coop/relay-yard.mjs';
import {
  COOP_STARTER_PACK,
  readCoopPack,
  coopGoalText,
  coopPackDestination,
} from '../coop/library.mjs';
import { COOP_PACK_MAX_BYTES } from '../coop/recipes.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { createCoopPainter } from './coop-view.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';
import { createCoopPresentation } from './coop-presentation.mjs';
import {
  COOP_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
} from './coop-picture-bindings.mjs';
import { decodeCoopPicture } from './coop-picture-image.mjs';
import { createCoopPresentationImport } from './coop-import-source.mjs';
import { COOP_PRESENTATION_MIME } from '../coop/presentation-envelope.mjs';
import { coopFailureFeedback, coopRetryFeedback, coopRoamerCaption } from './coop-feedback.mjs';
import { coopArenaGuidance } from './coop-briefing.mjs';
import { coopGroundName } from './coop-ground.mjs';
import { terrainTransitionCaption } from '../ui/terrain-feedback.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { attachControllerReading } from '../ui/controller-reading.mjs';
import { readingInputPrompt } from '../ui/reading-input-prompt.mjs';
import { nextInputModality } from '../input-presentation.mjs';
import { onNativeInactive, exportJSONFile } from '../platform.mjs';
import { createCoopCommandBatch, COOP_INPUT_CAPABILITIES } from '../coop/input-policy.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { attachMenuStyleControls } from '../ui/menu-style-controls.mjs';
import { attachPreferenceRestoration } from '../ui/preference-restoration.mjs';
import { attachSettingsPanels, settingsTabOwnsKey } from '../ui/settings-panels.mjs';

import { createTeamArenaPreference } from './team-arena-preference.mjs';
import { attachTeamDiscovery } from './team-discovery.mjs';

import { teamReturnHref } from '../mode-return.mjs';

const $ = (id) => document.getElementById(id);
const unclaimedFocus = (element) =>
  !element || element === document.body || element === document.documentElement;
// Capture before attached() can hide a deliberately focused loader recovery link.
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
globalThis.RevealLineToolLaunch?.attached();
document.documentElement.dataset.toolState = 'loading';
const bootStatus = createOperationStatus($('coop-boot'));
const bootDisplay = bootStatus.begin({ message: 'Preparing the Team arena…', stage: 'preparing' });
const names = ['Sunflower', 'Skyline'];
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function picturePreparationText({ stage, status }, destination = null) {
  // The owning catch publishes recovery after the operation has failed. Reader
  // messages can contain diagnostics and must never become live-region text.
  if (status === 'error' || stage === 'error') return null;
  // A forwarded reader stage is not the lease's authenticated ready status.
  if (status === 'ready')
    return destination
      ? `${destination} ready. Starting together…`
      : 'Team picture ready. Start remains a separate action.';
  const action =
    stage === 'downloading' ? 'Loading' : stage === 'verifying' ? 'Checking' : 'Preparing';
  return destination
    ? `${action} ${destination} artwork… Your result stays available.`
    : `${action} the Team picture…`;
}

export function bootCoop({
  candidateJourney = null,
  candidateProgress = null,
  candidatePreferences = null,
  candidateCardPresenter = undefined,
  candidateCaptureTeaching = null,
  candidateDifficulty = 'standard',
  candidateNotice = '',
} = {}) {
  // Entry links select a code-owned destination, never a supplied URL or referrer.
  // Older/direct links and ambiguous contexts retain the existing Versus return.
  const returns = new URL(location.href).searchParams.getAll('return');
  const fromSolo = returns.length === 1 && returns[0] === 'solo';
  let returnStorage;
  try {
    returnStorage = sessionStorage;
  } catch {
    /* Fixed title fallback remains available. */
  }
  const returnHref = () => teamReturnHref({ href: location.href, storage: returnStorage });
  $('coop-race').setAttribute('href', returnHref());
  $('coop-race').textContent = fromSolo ? 'Back to Solo' : 'Race mode ↗';
  $('coop-solo').setAttribute('href', fromSolo ? returnHref() : '../');
  const arenaPreference = createTeamArenaPreference({
    pack: COOP_STARTER_PACK,
    getStorage: () => localStorage,
    onWarning: (message) => {
      $('coop-selection-status').textContent = message;
      $('coop-selection-status').hidden = !message;
    },
  });
  let lastBuiltInArena = arenaPreference.current();
  const audioMaster = createAudioMaster();
  const audioPreferences = createAudioPreferences({
    audioMaster,
    window,
    getStorage: () => localStorage,
    onWarning: (message) => {
      $('coop-audio-status').textContent = message;
    },
  });
  const renderMasterPreferences = ({ muted, volume }) => {
    $('coop-audio').textContent = muted ? 'Unmute sound' : 'Mute sound';
    $('coop-quick-sound').textContent = muted ? 'Sound: off' : 'Sound: on';
    $('coop-quick-sound').setAttribute('aria-pressed', String(!muted));
    $('coop-master-volume').value = volume;
  };
  const stopMasterView = audioMaster.subscribe(renderMasterPreferences);
  const audioRestoration = attachPreferenceRestoration({
    window,
    getSnapshot: () => audioMaster.snapshot(),
    render: renderMasterPreferences,
  });
  const toggleSound = () => audioPreferences.setMuted(!audioMaster.snapshot().muted);
  $('coop-audio').onclick = toggleSound;
  $('coop-quick-sound').onclick = toggleSound;
  $('coop-master-volume').onchange = () =>
    audioPreferences.setVolume(Number($('coop-master-volume').value));
  const closeAudio = () => {
    musicPublished?.close();
    music?.dispose();
    $('coop-audio').onclick = null;
    $('coop-quick-sound').onclick = null;
    $('coop-master-volume').onchange = null;
    stopMasterView();
    audioRestoration.dispose();
    audioPreferences.dispose();
    audioMaster.dispose();
  };
  let prepareDisplayReveal,
    displayLayoutVersion = 0;
  const displayPreferences = createDisplayPreferences({
    window,
    matchMedia,
    getStorage: () => localStorage,
    onWarning: (message) => {
      $('coop-display-status').textContent = message;
    },
  });
  const renderDisplayPreferences = (state) => {
    document.body.dataset.textFace = state.textFace;
    document.body.dataset.textSize = state.textSize;
    document.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
    $('coop-text-face').value = state.textFace;
    $('coop-text-size').value = state.textSize;
    $('coop-reduced').checked = state.reducedEffects;
    $('coop-system-reduction').textContent =
      state.effectiveReducedEffects && !state.reducedEffects
        ? 'System reduced motion is active. Your saved Reduced effects choice is unchanged.'
        : '';
  };
  const stopDisplayView = displayPreferences.subscribe((state) => {
    const reveal = prepareDisplayReveal?.(++displayLayoutVersion);
    renderDisplayPreferences(state);
    reveal?.();
  });
  const displayRestoration = attachPreferenceRestoration({
    window,
    getSnapshot: () => displayPreferences.snapshot(),
    render: renderDisplayPreferences,
  });
  const menuStyle = attachMenuStyleControls({
    document,
    window,
    getStorage: () => localStorage,
    prefix: 'coop-',
  });
  $('coop-text-face').onchange = () =>
    displayPreferences.set({ textFace: $('coop-text-face').value });
  $('coop-text-size').onchange = () =>
    displayPreferences.set({ textSize: $('coop-text-size').value });
  const closeDisplay = () => {
    stopDisplayView();
    displayRestoration.dispose();
    displayPreferences.dispose();
    menuStyle.dispose();
  };
  const painter = createCoopPainter($('coop-canvas'));
  const presentationPage = mountPresentationPage({ document, window });
  presentationPage.bindPainter(painter);
  void presentationPage.ready.then((snapshot) => {
    if (!disposed && snapshot) menuStyle.setPresentation(snapshot);
  });
  const batch = createCoopCommandBatch();
  let loopStopped = false;
  let run = null,
    attemptLevel = null,
    attemptPack = null,
    accumulator = 0,
    last = null,
    framePads = [],
    frame = null,
    disposed = false,
    generation = 0,
    departure = null;
  const departureDialog = $('coop-discard-dialog');
  const settingsDialog = $('coop-options');
  const earnedDialog = $('coop-earned-picture');
  const earnedCanvas = $('coop-earned-picture-canvas');
  let earnedOwner = null;
  let music = null,
    musicPublished = null,
    musicSelection = null;
  let settingsOwner = null,
    settingsVisit = 0,
    settingsPanels = null;
  let acceptedPicture = null,
    pictureSelection = null,
    pictureOperation = null,
    pictureSequence = 0,
    nextOperation = null,
    startPermitted = true;
  let automaticRetry = null;
  let journeySkip = null;
  let candidatePresetIntent = 0;
  let candidatePreferenceRestoration = null;
  const foreground = () => !document.hidden && document.hasFocus?.() !== false;
  let inactive = !foreground();
  let previousPads = new Map();
  let pack = COOP_STARTER_PACK;
  let packArtworkSource = null;
  let discovery = null,
    discoveryOperation = null,
    discoveryStarted = null,
    discoveryPreviewSequence = 0,
    localDiscoveryPack = null,
    localDiscoveryRevision = 0;
  const discoveryRows = (sourcePack, artworkSource, prefix) =>
    sourcePack.levels.map((level) =>
      Object.freeze({
        key: `${prefix}/${level.id}`,
        title: level.name,
        packName: sourcePack.name,
        sourceLabel: sourcePack === COOP_STARTER_PACK ? 'Starter arena' : 'Local pack · this visit',
        goal: coopGoalText(level),
        levelId: level.id,
        level,
        pack: sourcePack,
        artworkSource,
      }),
    );
  const starterDiscoveryRows = discoveryRows(COOP_STARTER_PACK, null, 'starter');
  const candidateDiscoveryRows =
    candidateJourney?.rows.map((row) =>
      Object.freeze({
        key: row.key,
        title: row.level.name,
        packName: row.pack.name,
        sourceLabel: 'Team Journey · geometry test · not human validated',
        goal: coopGoalText(row.level),
        levelId: row.level.id,
        level: row.level,
        pack: row.pack,
        artworkSource: null,
        journeyRow: row,
      }),
    ) ?? [];
  const currentDiscoveryRows = () => [
    ...candidateDiscoveryRows.filter(
      (row) =>
        row.journeyRow.difficulty ===
        (acceptedPicture?.journeyRow?.difficulty ??
          selectedCandidateRow()?.difficulty ??
          candidateDifficulty),
    ),
    ...starterDiscoveryRows,
    ...(localDiscoveryPack?.rows ?? []),
  ];
  const artworkImports = createCoopPresentationImport();
  let importRequest = 0;
  const packStatus = createOperationStatus($('coop-pack-status'), { isCurrent: () => !disposed });
  const packPicker = $('coop-pack-file').closest('details');
  let importDisplay = null,
    importOperation = null,
    importDraft = null,
    importAdopting = null;
  function importControls() {
    if (disposed) return;
    const finishing = artworkImports.pending();
    $('coop-pack-file').disabled = finishing;
    $('coop-pack-retry').disabled = finishing;
  }
  function cancelImport({ forget = false } = {}) {
    const operation = importOperation;
    // Invalidate before abort, status, or focus callbacks can reenter the host.
    importOperation = null;
    importDisplay = null;
    importRequest++;
    const artworkDraft = importDraft?.kind === 'artwork' ? importDraft : null;
    if (artworkDraft && (operation || forget)) {
      artworkImports.cancel();
      if (artworkDraft.selection !== pictureSelection) artworkDraft.selection?.lease.dispose();
      artworkDraft.pack = null;
      artworkDraft.artworkSource = null;
      artworkDraft.selection = null;
      artworkDraft.cancelledRequest = importRequest;
    }
    if (operation) {
      operation.controller.abort();
      operation.focus.finish(null, false);
      operation.display.finish({
        state: 'detached',
        message: artworkDraft
          ? artworkImports.pending()
            ? 'Finishing cancelled artwork validation… The selected pack is unchanged.'
            : 'Artwork import cancelled. The selected pack is unchanged. Retry pack when ready.'
          : 'Stopped waiting. The selected pack is unchanged. Retry pack when ready.',
      });
    }
    if (forget && importDraft) {
      const draft = importDraft;
      importDraft = null;
      if (draft.selection !== pictureSelection) draft.selection?.lease.dispose();
    }
    $('coop-pack-cancel').hidden = true;
    $('coop-pack-retry').hidden = !importDraft;
    $('coop-pack-file').value = '';
    importControls();
    if (operation) pictureUI();
  }
  let knockdowns = [null, null];
  const selectedLevel = () =>
    pack.levels.find((level) => level.id === $('coop-level').value) || pack.levels[0];
  const selectedConfiguration = () =>
    COOP_PLAYTEST_CONFIGURATIONS.find((item) => item.id === $('coop-experiment').value) ||
    COOP_PLAYTEST_CONFIGURATIONS[0];
  let menuHint = '',
    reading = null,
    readingModality = 'pointer';
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
    navigation.refreshReadingHint();
  }
  const touchQuery = matchMedia('(any-pointer: coarse)');
  const tools = $('coop-tools');
  const modeChoices = $('coop-mode-actions');
  mountModeChoices({
    root: modeChoices,
    current: 'team',
    actions: { solo: $('coop-solo'), versus: $('coop-versus') },
  });
  let assignedSlots = [null, null];
  let input;
  const touchPads = [...document.querySelectorAll('.race-pad')];
  function showTouch() {
    const mode = $('coop-touch').value;
    for (const pad of touchPads) {
      const player = Number(pad.dataset.player);
      const visible =
        running() &&
        (mode === 'on' ||
          (mode === 'auto' && touchQuery.matches && assignedSlots[player] === null));
      if (!pad.hidden && !visible) input?.clearPhysical(player);
      pad.hidden = !visible;
      pad.closest('.control-card').dataset.touchVisible = String(visible);
    }
    const visible = touchPads.some((pad) => !pad.hidden);
    $('coop-controls').hidden = !visible;
    document.body.dataset.coopTouch = visible ? 'visible' : 'hidden';
  }
  function placeTools(paused) {
    const modeDestination = $(paused ? 'coop-pause-modes' : 'coop-lobby-modes');
    if (modeChoices.parentNode !== modeDestination) modeDestination.append(modeChoices);
    modeChoices.hidden = running();
    const destination = $(paused ? 'coop-pause-tools' : 'coop-lobby-tools');
    if (tools.parentNode !== destination) destination.append(tools);
    tools.hidden = running();
    if (tools.hidden) {
      $('coop-help').open = false;
    }
    showTouch();
  }
  function back() {
    if (music?.root()) {
      music.back();
      return;
    }
    if (settingsDialog.open) {
      closeSettings();
      return;
    }
    if (earnedDialog.open) {
      closeEarnedPicture();
      return;
    }
    if (departure) {
      cancelDeparture();
      return;
    }
    if (discovery?.isOpen()) {
      discovery.back();
      return;
    }
    if (nextOperation) {
      cancelNext({ restore: true });
      return;
    }
    if (pictureOperation) {
      cancelPicture();
      return;
    }
    if (importDisplay) {
      stopWaiting();
      return;
    }
    const details =
      document.activeElement?.closest('details') || tools.querySelector('details[open]');
    if (details?.open && tools.contains(details)) {
      details.open = false;
      details.querySelector('summary')?.focus({ preventScroll: true });
    } else if (run?.status === 'paused') primary().focus({ preventScroll: true });
    else if (run) lobby();
    else $('coop-race').click();
  }
  const running = () => run?.status === 'running';
  const scope = () =>
    music?.root()
      ? 'coop-music-library'
      : settingsDialog.open
        ? `coop-settings:${settingsPanels?.selected() || 'display'}`
        : earnedDialog.open
          ? 'coop-earned-picture'
          : departure
            ? 'coop-discard'
            : discovery?.isOpen()
              ? 'coop-discovery'
              : running()
                ? 'flight'
                : run
                  ? `coop-${run.status}`
                  : 'coop-lobby';
  const primary = () =>
    music?.root()
      ? music.primary()
      : settingsDialog.open
        ? settingsPanels?.primary() || $('coop-settings-close')
        : earnedDialog.open
          ? $('coop-picture-return')
          : departure
            ? $('coop-discard-stay')
            : discovery?.isOpen()
              ? discovery.primary()
              : nextOperation
                ? $('coop-next-cancel')
                : importOperation
                  ? $('coop-pack-cancel')
                  : pictureOperation
                    ? $('coop-picture-cancel')
                    : !run && pictureSelection?.state !== 'ready'
                      ? $('coop-picture-retry')
                      : !run
                        ? $('coop-start')
                        : run.status === 'paused' && !loopStopped
                          ? $('coop-resume')
                          : run.status === 'won' && !loopStopped
                            ? teamDestination()?.next
                              ? $('coop-next')
                              : $('coop-discovery-paused')
                            : $('coop-retry');
  // Preference updates can reflow a focused select beyond the Settings scroller
  // without a window resize. Keep only that current action visible, never focus
  // it again or resume. Initial display application runs before this owner exists.
  prepareDisplayReveal = (revision) => {
    const target = document.activeElement,
      panel = settingsDialog,
      attempt = run,
      epoch = generation,
      owner = settingsOwner;
    const current = () =>
      !disposed &&
      foreground() &&
      run === attempt &&
      generation === epoch &&
      settingsOwner === owner &&
      displayLayoutVersion === revision &&
      !departure &&
      !panel.hidden &&
      panel.open &&
      panel.contains(target) &&
      document.activeElement === target;
    if (!current() || !visibleAction(target) || !current()) return null;
    return () => {
      if (!current() || !visibleAction(target) || !current()) return;
      const rect = target.getBoundingClientRect(),
        bounds = panel.getBoundingClientRect(),
        width = document.documentElement.clientWidth || window.innerWidth,
        height = document.documentElement.clientHeight || window.innerHeight,
        left = Math.max(0, bounds.left + panel.clientLeft) + 8,
        top = Math.max(0, bounds.top + panel.clientTop) + 8,
        right = Math.min(width, bounds.left + panel.clientLeft + panel.clientWidth) - 8,
        bottom = Math.min(height, bounds.top + panel.clientTop + panel.clientHeight) - 8;
      if (
        ![rect.left, rect.top, rect.right, rect.bottom, left, top, right, bottom].every(
          Number.isFinite,
        ) ||
        rect.width <= 0 ||
        rect.height <= 0 ||
        right <= left ||
        bottom <= top ||
        (rect.left >= left && rect.right <= right && rect.top >= top && rect.bottom <= bottom)
      )
        return;
      // Layout/style reads can publish a newer action. Recheck ownership after
      // the last such read and leave its focus, scroll and game status alone.
      if (!current() || !visibleAction(target) || !current()) return;
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    };
  };
  input = attachCouchInput({
    ...COOP_INPUT_CAPABILITIES,
    arena: $('coop-canvas'),
    active: running,
    continuousSteering: () => true,
    getGamepads: () => framePads,
    onPause: () => pause(),
    onPads: (count, slots) => {
      assignedSlots = slots;
      showTouch();
      const text = `${count} controller${count === 1 ? '' : 's'} connected${menuHint ? ` · ${menuHint}` : ''}`;
      if ($('coop-pads').textContent !== text) $('coop-pads').textContent = text;
    },
  });
  const router = createControllerRouter({ readPads: () => framePads });
  const navigation = attachControllerNavigation({
    getScope: scope,
    getRoot: () =>
      music?.root() ||
      (settingsDialog.open
        ? settingsDialog
        : earnedDialog.open
          ? earnedDialog
          : departure
            ? departureDialog
            : discovery?.isOpen()
              ? $('coop-discovery-dialog')
              : run
                ? $('coop-overlay')
                : $('coop-app')),
    accept: (element) => !element.closest('.race-pad'),
    getDefaultFocus: primary,
    keyboard: true,
    ownsKeyboardEvent: (event) => !music?.root() && settingsTabOwnsKey(event, settingsDialog),
    nativeReadingScroll: true,
    getReadingPrompt: readingPrompt,
    onNativeInput: (event) => setReadingModality(nextInputModality(readingModality, event)),
    onBack: back,
    onMenu: () => {
      if (
        music?.root() ||
        settingsDialog.open ||
        earnedDialog.open ||
        departure ||
        discovery?.isOpen() ||
        nextOperation ||
        run?.status === 'paused'
      )
        back();
    },
    onHint: (message, context) => {
      if (
        context?.kind === 'reading' &&
        ['coop-help-reading', 'coop-data-reading'].includes(context.regionId)
      ) {
        menuHint = '';
        const hint = $(`${context.regionId}-hint`);
        if (hint.textContent !== message) hint.textContent = message;
      } else menuHint = message;
    },
    onReadingChange: (state) => reading?.changed(state),
  });
  reading = attachControllerReading({
    getNavigation: () => navigation,
    getScope: scope,
    getReadingPrompt: readingPrompt,
    revealOnResize: true,
    surfaceDefinitions: [
      ['coop-help-reading', 'coop-help-read', 'Relay Rescue controls', 'coop-help-unit'],
      ['coop-data-reading', 'coop-data-read', 'Team game data', 'coop-data-unit'],
    ],
  });
  let revealingPauseResize = false;
  function revealPausedAction(event) {
    if (revealingPauseResize || event.target !== window) return;
    revealingPauseResize = true;
    try {
      const target = document.activeElement,
        panel = $('coop-overlay'),
        attempt = run,
        epoch = generation,
        visit = settingsVisit;
      const current = () =>
        !disposed &&
        !inactive &&
        foreground() &&
        run === attempt &&
        run?.status === 'paused' &&
        generation === epoch &&
        settingsVisit === visit &&
        !settingsDialog.open &&
        !earnedDialog.open &&
        !departure &&
        !panel.hidden &&
        panel.contains(target) &&
        document.activeElement === target;
      // Resize owns no opener or future focus. The reading adapter owns its
      // separate text region; only the current paused action is considered here.
      if (
        !current() ||
        !target?.matches('button,a[href],select,input,textarea,summary') ||
        !visibleAction(target) ||
        !current()
      )
        return;
      const rect = target.getBoundingClientRect(),
        bounds = panel.getBoundingClientRect(),
        width = document.documentElement.clientWidth || window.innerWidth,
        height = document.documentElement.clientHeight || window.innerHeight,
        left = Math.max(0, bounds.left + panel.clientLeft) + 8,
        top = Math.max(0, bounds.top + panel.clientTop) + 8,
        right = Math.min(width, bounds.left + panel.clientLeft + panel.clientWidth) - 8,
        bottom = Math.min(height, bounds.top + panel.clientTop + panel.clientHeight) - 8;
      if (
        ![rect.left, rect.top, rect.right, rect.bottom, left, top, right, bottom].every(
          Number.isFinite,
        ) ||
        rect.width <= 0 ||
        rect.height <= 0 ||
        right <= left ||
        bottom <= top ||
        (rect.left >= left && rect.right <= right && rect.top >= top && rect.bottom <= bottom)
      )
        return;
      // Match the overlay's existing 8px scroll-padding. Recheck after the final
      // style read: a newer focus, dialog, attempt or lifecycle vetoes this reveal.
      if (!current() || !visibleAction(target) || !current()) return;
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    } finally {
      revealingPauseResize = false;
    }
  }
  window.addEventListener('resize', revealPausedAction);
  function clear() {
    input.clear();
    batch.release();
    router.clear();
    navigation.clear();
    if (run) releaseCoopInputs(run);
    accumulator = 0;
  }
  settingsPanels = attachSettingsPanels({
    root: settingsDialog,
    document,
    beforeSelect: () => clear(),
  });
  const settingsCurrent = (owner) =>
    !disposed &&
    settingsOwner === owner &&
    settingsVisit === owner.visit &&
    run === owner.run &&
    generation === owner.generation &&
    foreground();
  music = attachCouchMusicHost({
    document,
    root: $('coop-settings-panel-audio'),
    prefix: 'coop',
    audioMaster,
    audioPreferences,
    canOpen: () => !!settingsOwner && settingsDialog.open && settingsCurrent(settingsOwner),
    getOwner: () => settingsOwner,
    onOpen: () => clear(),
    onClose: () => clear(),
  });
  if (music) {
    musicPublished = attachPublishedAudio({
      sound: music.sound,
      ready: presentationPage.ready,
      getHost: () => presentationPage,
      cues: false,
      allowMusic: () =>
        !acceptedPicture?.artworkSource && (acceptedPicture?.request.themeId ?? 'fpv') === 'fpv',
    });
    musicPublished.setPlayer(music.player);
  }
  function acceptMusic(selection, { play = false } = {}) {
    if (!music || !selection || acceptedPicture !== selection || !run || loopStopped || disposed)
      return;
    if (musicSelection !== selection) {
      musicSelection = selection;
      if (selection.musicContext) music.setContext(selection.musicContext);
      else {
        music.contextPending(selection.request.themeId, selection.musicError || undefined);
        void selection.musicReady?.then((context) => {
          if (disposed || musicSelection !== selection || acceptedPicture !== selection) return;
          if (context) music.setContext(context);
          else
            music.contextPending(
              selection.request.themeId,
              selection.musicError ||
                'Exact mission music assignments are unavailable. Global and theme playlists remain available.',
            );
        });
      }
    }
    if (play) void music.start();
  }
  function openSettings() {
    cancelNext();
    const opener = $('coop-settings-open');
    if (
      disposed ||
      departure ||
      settingsDialog.open ||
      earnedDialog.open ||
      !foreground() ||
      !visibleAction(opener)
    )
      return;
    discovery?.close({ restore: false });
    const owner = { opener, run, generation, visit: ++settingsVisit, restore: true };
    settingsOwner = owner;
    // Lobby preparation stays owned by its existing operation; opening Settings
    // must not call pause(), which also cancels that preparation.
    if (running()) pause({ focus: false });
    else clear();
    if (!settingsCurrent(owner) || !visibleAction(opener)) {
      if (settingsOwner === owner) settingsOwner = null;
      return;
    }
    settingsDialog.showModal();
    const active = document.activeElement;
    if (
      settingsCurrent(owner) &&
      settingsDialog.open &&
      (unclaimedFocus(active) ||
        active === opener ||
        active === settingsDialog ||
        active === $('coop-settings-close'))
    ) {
      const target = settingsPanels.primary();
      if (visibleAction(target) && settingsCurrent(owner) && document.activeElement === active)
        target.focus({ preventScroll: true });
    }
  }
  function closeSettings({ restore = true } = {}) {
    if (!settingsDialog.open) return;
    if (settingsOwner) settingsOwner.restore = restore && foreground();
    settingsDialog.close();
  }
  const settingsClosed = () => {
    // A queued close from an earlier visit has no authority over a reopened one.
    if (settingsDialog.open) return;
    const owner = settingsOwner;
    if (!owner) return;
    const restore = owner.restore && settingsCurrent(owner);
    settingsOwner = null;
    const closedVisit = ++settingsVisit;
    const currentReturn = () =>
      !disposed &&
      !settingsDialog.open &&
      !settingsOwner &&
      settingsVisit === closedVisit &&
      run === owner.run &&
      generation === owner.generation &&
      foreground();
    navigation.clear();
    router.clear();
    if (!restore || !currentReturn() || !visibleAction(owner.opener) || !currentReturn()) return;
    const active = document.activeElement;
    if (active !== owner.opener && (unclaimedFocus(active) || settingsDialog.contains(active)))
      owner.opener.focus({ preventScroll: true });
  };
  const cancelSettings = (event) => {
    event.preventDefault();
    closeSettings();
  };
  const settingsKeydown = (event) => {
    // Keep the native cancel default away from the window flight Escape hook.
    // Document capture still gives an active controller editor first refusal.
    if (event.key === 'Escape') event.stopPropagation();
  };
  $('coop-settings-open').onclick = openSettings;
  $('coop-settings-close').onclick = () => closeSettings();
  settingsDialog.addEventListener('cancel', cancelSettings);
  settingsDialog.addEventListener('close', settingsClosed);
  settingsDialog.addEventListener('keydown', settingsKeydown);
  const earnedCurrent = (owner) =>
    !disposed &&
    earnedOwner === owner &&
    run === owner.run &&
    generation === owner.generation &&
    acceptedPicture === owner.picture &&
    foreground();
  function openEarnedPicture() {
    cancelNext();
    const opener = $('coop-view-picture');
    if (
      disposed ||
      inactive ||
      !foreground() ||
      settingsDialog.open ||
      earnedDialog.open ||
      departure ||
      loopStopped ||
      run?.status !== 'won' ||
      !acceptedPicture?.binding?.image ||
      !visibleAction(opener)
    )
      return;
    discovery?.close({ restore: false });
    const owner = { run, generation, picture: acceptedPicture, opener, restore: true };
    earnedOwner = owner;
    try {
      // Borrow the exact accepted original; no decoder, lease or award is created.
      const context = earnedCanvas.getContext('2d');
      if (!context) throw new Error('Picture canvas unavailable');
      earnedCanvas.width = 1152;
      earnedCanvas.height = 576;
      context.imageSmoothingEnabled = false;
      context.drawImage(owner.picture.binding.image, 0, 0, 1152, 576);
      if (!earnedCurrent(owner)) return;
      $('coop-earned-picture-title').textContent = `${run.level.name} · Your shared picture`;
      navigation.clear();
      router.clear();
      earnedDialog.showModal();
      const active = document.activeElement;
      if (
        earnedCurrent(owner) &&
        earnedDialog.open &&
        (unclaimedFocus(active) ||
          active === opener ||
          active === earnedDialog ||
          active === $('coop-picture-return'))
      )
        $('coop-picture-return').focus({ preventScroll: true });
    } catch {
      if (earnedOwner === owner) {
        earnedOwner = null;
        earnedCanvas.width = earnedCanvas.height = 0;
        message('Picture view unavailable. Your earned result is unchanged.');
      }
    }
  }
  function closeEarnedPicture({ restore = true } = {}) {
    if (!earnedDialog.open) return;
    if (earnedOwner) earnedOwner.restore = restore && foreground();
    earnedDialog.close();
  }
  const earnedClosed = () => {
    if (earnedDialog.open) return;
    const owner = earnedOwner;
    if (!owner) return;
    const restore = owner.restore && earnedCurrent(owner);
    earnedOwner = null;
    earnedCanvas.width = earnedCanvas.height = 0;
    navigation.clear();
    router.clear();
    const active = document.activeElement;
    if (
      restore &&
      !disposed &&
      !earnedDialog.open &&
      !earnedOwner &&
      run === owner.run &&
      generation === owner.generation &&
      foreground() &&
      visibleAction(owner.opener) &&
      (unclaimedFocus(active) || earnedDialog.contains(active))
    ) {
      owner.opener.focus({ preventScroll: true });
      if (document.activeElement === owner.opener)
        owner.opener.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
  };
  const earnedCancelled = (event) => {
    event.preventDefault();
    closeEarnedPicture();
  };
  $('coop-view-picture').onclick = openEarnedPicture;
  $('coop-picture-return').onclick = () => closeEarnedPicture();
  earnedDialog.addEventListener('close', earnedClosed);
  earnedDialog.addEventListener('cancel', earnedCancelled);
  earnedDialog.addEventListener('keydown', settingsKeydown);
  function message(text) {
    if ($('coop-message').textContent !== text) $('coop-message').textContent = text;
  }
  function overlay({ focus = true } = {}) {
    const show = run && !running();
    $('coop-overlay').hidden = !show;
    placeTools(Boolean(show));
    $('coop-pause').disabled = !running();
    difficultyControls();
    const skipDestination = journeyNavigation();
    $('coop-journey-skip').hidden = !running() || !skipDestination?.next;
    $('coop-journey-skip-confirm').hidden =
      !['paused', 'lost'].includes(run?.status) || !skipDestination?.next || loopStopped;
    $('coop-journey-skip-confirm').textContent =
      journeySkip?.run === run && journeySkip.generation === generation
        ? 'Confirm skip'
        : 'Skip mission';
    discoveryControls();
    if (!show) return;
    const won = run.status === 'won',
      lost = run.status === 'lost';
    const destination = won && !loopStopped ? teamDestination() : null;
    $('coop-next').hidden = !destination?.next;
    $('coop-next').textContent = destination?.next
      ? `Next: ${destination.next.name}`
      : 'Next arena';
    $('coop-lobby').textContent = 'Change setup';
    $('coop-resume').hidden = won || lost;
    $('coop-view-picture').hidden = !won || loopStopped || !acceptedPicture?.binding?.image;
    $('coop-overlay-kicker').textContent = won
      ? 'A WORLD YOU REVEALED TOGETHER'
      : lost
        ? 'ONE MORE SHARED PLAN'
        : 'PAUSED';
    $('coop-overlay-title').textContent = won
      ? 'You brought it home.'
      : lost
        ? 'Your next route starts here.'
        : 'Both players paused';
    const completionCopy = destination?.journey
      ? 'Team Journey test complete. Browse a mission, replay, or leave whenever you are ready.'
      : 'Pack complete. Browse Team arenas to choose your next challenge, or retry this one.';
    $('coop-overlay-copy').textContent = won
      ? `${(run.coverage * 100).toFixed(1)}% revealed together in ${clock(run.time)}. ${run.team.jointCuts} Joint Cuts, ${run.team.rescues} rescues and ${run.team.interceptions} intercepted sparks. ${destination?.next ? `Next arena: ${destination.next.name}.` : destination?.final ? completionCopy : 'Browse Team arenas or retry this challenge.'}`
      : lost
        ? coopRetryFeedback(run, knockdowns.filter(Boolean))
        : 'Release your controls, then choose Resume together.';
    if (focus) primary().focus({ preventScroll: true });
  }
  function render() {
    if (!run) return;
    painter.paint(run, {
      reduced: displayPreferences.snapshot().effectiveReducedEffects,
      textFace: displayPreferences.snapshot().textFace,
      picture: acceptedPicture?.binding ?? null,
    });
    const coverage = run.coverage * 100;
    $('coop-coverage').textContent = `${coverage.toFixed(1)}%`;
    $('coop-progress').value = coverage;
    $('coop-reserves').textContent =
      `${run.team.reserves} reserve${run.team.reserves === 1 ? '' : 's'}`;
    $('coop-clock').textContent = clock(run.time);
    const strongholds = run.strongholds.filter((item) => run.level.goal.cores?.includes(item.id));
    const stronghold = strongholds.find((item) => !item.defeated);
    $('coop-objective').textContent = stronghold
      ? `${strongholds.length > 1 ? `${strongholds.filter((item) => item.defeated).length} / ${strongholds.length} secured · Relay ${run.strongholds.indexOf(stronghold) + 1} · ` : ''}${stronghold.shielded ? `Capture the shield anchors · ${stronghold.anchors.filter((anchor) => anchor.captured).length} / 2 secured` : 'Shield down · capture the exposed core in a new cut'}`
      : strongholds.length
        ? 'Strongholds secured together'
        : coopGoalText(run.level);
    const groundName = coopGroundName(run.level);
    for (const player of run.players) {
      $('coop-state-' + player.id).textContent =
        player.status === 'downed'
          ? run.team.reserves === 0
            ? 'Down · free rescue available'
            : `Rescue · ${Math.max(0, Math.ceil(player.downedUntil - run.time))}s`
          : player.cutting
            ? 'Line exposed'
            : player.graceUntil > run.time
              ? `Recovery shield · ${groundName} only`
              : `On ${groundName}`;
      const recharge = Math.max(0, (player.support?.readyAt || 0) - run.time);
      $('coop-charge-' + player.id).textContent =
        player.status === 'downed'
          ? 'Crawl to your partner'
          : player.rescue
            ? 'Hold Support · rescuing'
            : recharge > 0
              ? `Support · ${recharge.toFixed(1)}s`
              : 'Support ready';
      $('coop-support-' + player.id).textContent = player.rescue
        ? `Rescuing partner · ${Math.min(100, Math.floor((run.time - player.rescue.startedAt) * 100))}%`
        : player.status === 'downed'
          ? `Crawl along ${groundName} toward your partner`
          : recharge > 0
            ? `Support recharging · ${recharge.toFixed(1)}s`
            : 'Support ready · tap to cover, hold nearby to rescue';
    }
  }
  // This focus lifetime is local to one picture action. Native disabling may
  // move its opener to BODY; a later deliberate choice or loss of foreground
  // permanently vetoes the completion handoff.
  function pictureFocus(origin, initial = false, selectionCurrent = null) {
    let moved = inactive || !foreground(),
      retired = false,
      pending = null,
      handoff = null;
    const beforeScope = scope(),
      selection = pictureSelection,
      attempt = run,
      epoch = generation,
      visit = settingsVisit;
    const started =
      document.activeElement === origin &&
      (visibleAction(origin) || (initial && unclaimedFocus(origin)));
    const observe = (event) => {
      if (
        !unclaimedFocus(event.target) &&
        event.target !== origin &&
        event.target !== pending &&
        event.target !== handoff
      )
        moved = true;
    };
    const lost = () => {
      moved = true;
    };
    const hidden = () => {
      if (document.hidden) lost();
    };
    document.addEventListener('focusin', observe);
    document.addEventListener('pointerdown', lost, true);
    document.addEventListener('keydown', lost, true);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('blur', lost);
    window.addEventListener('pagehide', lost);
    const owns = () =>
      !retired &&
      !disposed &&
      !inactive &&
      started &&
      !moved &&
      foreground() &&
      (selectionCurrent ? selectionCurrent() : pictureSelection === selection) &&
      run === attempt &&
      generation === epoch &&
      settingsVisit === visit &&
      scope() === beforeScope &&
      (document.activeElement === origin ||
        document.activeElement === pending ||
        document.activeElement === handoff ||
        unclaimedFocus(document.activeElement));
    const close = () => {
      retired = true;
      document.removeEventListener('focusin', observe);
      document.removeEventListener('pointerdown', lost, true);
      document.removeEventListener('keydown', lost, true);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', lost);
      window.removeEventListener('pagehide', lost);
    };
    const direct = (target, remember = false) => {
      try {
        if (!owns() || !visibleAction(target) || !owns()) return;
        if (remember) pending = target;
        handoff = target;
        if (document.activeElement !== target) target.focus({ preventScroll: true });
        const focused = () => owns() && document.activeElement === target;
        if (!focused() || !visibleAction(target) || !focused()) return;
        const rect = target.getBoundingClientRect(),
          width = document.documentElement.clientWidth || window.innerWidth,
          height = document.documentElement.clientHeight || window.innerHeight;
        if (
          ![rect.left, rect.top, rect.right, rect.bottom, width, height].every(Number.isFinite) ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          width <= 16 ||
          height <= 16 ||
          (rect.left >= 8 && rect.top >= 8 && rect.right <= width - 8 && rect.bottom <= height - 8)
        )
          return;
        if (!focused() || !visibleAction(target) || !focused()) return;
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      } catch {
        // A browser focus/reveal failure must not prevent the picture reader
        // from starting or strand its existing Cancel/Retry operation.
        close();
      } finally {
        handoff = null;
      }
    };
    return {
      pending(target) {
        direct(target, true);
      },
      finish(target, current = true) {
        if (typeof target === 'function') {
          // Successful navigation retains its existing focus/scroll contract.
          const allowed = current && owns();
          close();
          if (allowed) target();
          return;
        }
        try {
          if (current) direct(target);
        } finally {
          close();
        }
      },
    };
  }
  let previewBinding = null,
    previewState = 'preparing',
    pictureMessage = '';
  function clearPicturePreview() {
    previewBinding = null;
    const canvas = $('coop-preview-canvas');
    canvas.hidden = true;
    // Reset pixels without obtaining a second image or releasing the shared lease.
    // Preview failure must not interrupt the original lease's terminal cleanup.
    try {
      canvas.width = 576;
      return true;
    } catch {
      return false;
    }
  }
  function picturePreview({ retry = false } = {}) {
    if (run) return;
    const selection = pictureSelection,
      binding = selection?.state === 'ready' ? selection.binding : null,
      canvas = $('coop-preview-canvas'),
      message = $('coop-preview-message'),
      level = selection?.pack.levels.find((level) => level.id === selection.levelId),
      name = level?.name;
    $('coop-preview-caption').textContent =
      level?.journeyDifficulty && !selection.artworkSource
        ? `${name} geometry test. Preview scenery is not authored mission artwork. Win to reveal the full picture; scenery does not mark obstacles.`
        : name
          ? `${name} preview. Win to reveal the full picture. Scenery does not mark obstacles.`
          : 'Selected arena preview. Win to reveal the full picture. Scenery does not mark obstacles.';
    if (binding && previewBinding === binding && !retry) return;
    const cleared = clearPicturePreview();
    message.hidden = false;
    if (binding) {
      previewBinding = binding;
      try {
        if (!cleared) throw new Error('Preview canvas unavailable.');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Preview canvas unavailable.');
        context.imageSmoothingEnabled = false;
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'source-over';
        context.drawImage(binding.image, 0, 0, canvas.width, canvas.height);
        // One-cell border teaser only. The full original remains an earned reward.
        context.fillStyle = '#000';
        context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);
        canvas.hidden = false;
        message.hidden = true;
        previewState = 'ready';
      } catch {
        previewState = 'unavailable';
        message.textContent = 'Artwork preview unavailable.';
      }
    } else {
      previewState = selection?.state ?? 'empty';
      if (previewState === 'ready') previewState = 'procedural';
      message.textContent =
        previewState === 'procedural'
          ? 'Procedural arena · no picture preview.'
          : previewState === 'preparing'
            ? 'Preparing artwork…'
            : 'No artwork ready.';
    }
    $('coop-picture-preview').dataset.state = previewState;
  }
  function pictureUI(messageText) {
    picturePreview();
    const busy = Boolean(pictureOperation),
      ready = pictureSelection?.state === 'ready',
      retryPreview = !run && ready && previewState === 'unavailable';
    $('coop-start').disabled =
      !startPermitted || !ready || busy || Boolean(importOperation || importAdopting);
    $('coop-picture-cancel').hidden = !busy;
    $('coop-picture-retry').hidden = busy || (ready && !retryPreview);
    $('coop-picture-retry').textContent = retryPreview ? 'Retry preview' : 'Retry picture';
    $('coop-picture-status').dataset.state = busy
      ? 'preparing'
      : (pictureSelection?.state ?? 'cancelled');
    if (messageText) pictureMessage = messageText;
    $('coop-picture-status').textContent = retryPreview
      ? `${pictureMessage} Artwork preview unavailable. Retry preview or Start with the prepared picture.`
      : pictureMessage;
    discoveryControls();
  }
  function retirePicture() {
    const operation = pictureOperation;
    pictureOperation = null;
    operation?.controller.abort();
    operation?.focus.finish(null, false);
    if (pictureSelection && pictureSelection !== acceptedPicture) pictureSelection.lease?.dispose();
    pictureSelection = null;
    clearPicturePreview();
  }
  function cancelPicture({ restore = true } = {}) {
    const operation = pictureOperation;
    if (!operation) return;
    // Explicit Cancel creates fresh focus intent, including after prior Tab.
    const focus = restore ? pictureFocus(document.activeElement) : null;
    pictureOperation = null;
    operation.controller.abort();
    operation.focus.finish(null, false);
    pictureSelection.state = 'cancelled';
    pictureUI('Picture loading cancelled. Retry picture when you are ready.');
    focus?.finish($('coop-picture-retry'));
  }
  function newPictureSelection(recipe, sourcePack, pinnedPack = sourcePack, artworkSource = null) {
    // Only code-owned exact recipes join this route. An imported pack with the
    // same IDs (or even the same bytes) keeps its independent local ordering.
    const journeyRow =
      candidateJourney?.rows.find(
        (row) =>
          row.pack === sourcePack &&
          row.difficulty === recipe.options.difficulty &&
          JSON.stringify(row.level) === JSON.stringify(recipe.level),
      ) ?? null;
    const selection = {
      sourcePack,
      journeyRow,
      artworkSource,
      pack: structuredClone(pinnedPack),
      levelId: recipe.level.id,
      request: {
        pack: structuredClone(pinnedPack),
        levelId: recipe.level.id,
        themeId: artworkSource?.receipt.theme.id ?? 'fpv',
        attemptId: `team-${++pictureSequence}`,
        ...(artworkSource ? { artworkSource } : {}),
      },
      lease: createCoopPresentation({
        bindings: COOP_PICTURE_BINDINGS,
        historicalImportPolicy: COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
        getSnapshot: presentationPage.current,
        readPicture: presentationPage.readPicture,
        decodeImage: decodeCoopPicture,
      }),
      binding: null,
      state: 'new',
    };
    if (music) {
      const level = structuredClone(recipe.level);
      selection.musicReady = Promise.resolve()
        .then(() =>
          prepareTeamMusicContext({
            pack: selection.pack,
            level,
            themeId: selection.request.themeId,
          }),
        )
        .then(
          (context) => {
            selection.musicContext = context;
            return context;
          },
          (error) => {
            selection.musicError = `Exact mission music assignments: ${error.message}. Global and theme playlists remain available.`;
            return null;
          },
        );
    }
    return selection;
  }
  function preparePicture({
    retry = false,
    origin = document.activeElement,
    initial = false,
  } = {}) {
    if (disposed || departure || importDisplay || running()) return Promise.resolve();
    if (importAdopting) {
      // A synchronous setup callback can reset the pack while adoption unwinds.
      // Do not prepare against its tentative owner; keep only the newer intent.
      const request = importRequest,
        selectedPack = pack,
        levelId = $('coop-level').value;
      return Promise.resolve().then(() => {
        if (request !== importRequest || pack !== selectedPack || $('coop-level').value !== levelId)
          return;
        return preparePicture({ retry, origin, initial });
      });
    }
    if (!retry || !pictureSelection) {
      retirePicture();
      const sourcePack = run ? (acceptedPicture?.journeyRow?.pack ?? attemptPack) : pack;
      pictureSelection = newPictureSelection(
        currentRecipe(),
        sourcePack,
        sourcePack,
        run ? (acceptedPicture?.artworkSource ?? null) : packArtworkSource,
      );
    }
    const selection = pictureSelection;
    if (pictureOperation) return pictureOperation.promise;
    const focus = pictureFocus(origin, initial),
      controller = new AbortController();
    const operation = { selection, controller, focus, run, generation };
    pictureOperation = operation;
    selection.state = 'preparing';
    const current = () =>
      !disposed &&
      pictureOperation === operation &&
      pictureSelection === selection &&
      !controller.signal.aborted &&
      run === operation.run &&
      generation === operation.generation;
    pictureUI('Preparing the exact Team picture…');
    focus.pending($('coop-picture-cancel'));
    operation.promise = (async () => {
      try {
        const snapshot = await (retry ? presentationPage.retry() : presentationPage.ready);
        // The original ready observer already handles first load. A recovered
        // shared page also updates global appearance, even after picture Cancel.
        if (retry && !disposed && snapshot && snapshot === presentationPage.current())
          menuStyle.setPresentation(snapshot);
        if (!current()) return;
        const binding = await selection.lease.select({
          ...selection.request,
          signal: controller.signal,
          onStatus: (status) => {
            if (!current()) return;
            const text = picturePreparationText(status);
            if (text) pictureUI(text);
          },
        });
        if (!current()) return;
        selection.binding = binding;
        selection.state = 'ready';
        pictureOperation = null;
        pictureUI('Team picture ready. Start remains a separate action.');
        focus.finish(run ? $('coop-retry') : () => navigation.focusAvailable());
      } catch (error) {
        if (!current()) return;
        try {
          console.error('Team picture preparation failed.', error);
        } catch {}
        if (!current()) return;
        selection.state = 'error';
        pictureOperation = null;
        pictureUI('Team picture unavailable. Retry picture or choose another arena.');
        focus.finish($('coop-picture-retry'));
      } finally {
        focus.finish(null, false);
      }
    })();
    return operation.promise;
  }
  $('coop-picture-cancel').onclick = () => cancelPicture();
  $('coop-picture-retry').onclick = () => {
    if (!run && pictureSelection?.state === 'ready' && previewState === 'unavailable') {
      const focus = pictureFocus($('coop-picture-retry'));
      picturePreview({ retry: true });
      pictureUI();
      focus.finish(
        previewState === 'ready' ? () => navigation.focusAvailable() : $('coop-picture-retry'),
      );
      return;
    }
    return preparePicture({ retry: true });
  };
  // Follow the accepted content snapshot. Imports retain their own order and
  // recipes even when IDs match built-ins or a source catalogue later changes.
  function journeyNavigation() {
    if (
      acceptedPicture?.state !== 'ready' ||
      acceptedPicture.pack !== attemptPack ||
      acceptedPicture.levelId !== attemptLevel?.id ||
      !candidateJourney?.owns(acceptedPicture.journeyRow)
    )
      return null;
    const row = acceptedPicture.journeyRow;
    if (JSON.stringify(row.level) !== JSON.stringify(attemptLevel)) return null;
    const destination = candidateJourney.destination(row);
    return {
      ...destination,
      journey: true,
      row,
      nextRow: destination.next,
      next: destination.next?.level ?? null,
    };
  }
  function teamDestination() {
    if (
      run?.status !== 'won' ||
      acceptedPicture?.state !== 'ready' ||
      acceptedPicture.pack !== attemptPack ||
      acceptedPicture.levelId !== attemptLevel?.id
    )
      return null;
    if (candidateJourney?.owns(acceptedPicture.journeyRow)) return journeyNavigation();
    return coopPackDestination(attemptPack, attemptLevel);
  }
  function nextStatus(text) {
    const owner = nextOperation,
      attempt = run,
      epoch = generation;
    const current = () =>
      !disposed && nextOperation === owner && run === attempt && generation === epoch;
    if (!current()) return;
    $('coop-next-status').textContent = text;
    if (!current()) return;
    $('coop-next-status').hidden = !text;
    if (!current()) return;
    $('coop-next-cancel').hidden = !owner;
    if (current()) $('coop-next').setAttribute('aria-busy', String(Boolean(owner)));
  }
  function cancelNext({ restore = false, announce = true } = {}) {
    const operation = nextOperation;
    if (!operation) return;
    // Invalidate before abort/release/native-focus callbacks can reenter.
    nextOperation = null;
    operation.detach();
    try {
      if (announce && !disposed)
        nextStatus(
          operation.skipped
            ? 'Skip cancelled. Your attempt and picture are still here.'
            : 'Next arena cancelled. Your result and picture are still here.',
        );
    } finally {
      operation.controller.abort();
      operation.selection.lease?.dispose();
    }
    if (
      disposed ||
      !announce ||
      nextOperation ||
      run !== operation.run ||
      generation !== operation.generation ||
      acceptedPicture !== operation.picture ||
      settingsVisit !== operation.settingsVisit ||
      settingsDialog.open ||
      earnedDialog.open ||
      departure
    )
      return;
    if (restore && run === operation.run && generation === operation.generation && foreground())
      operation.action.focus({ preventScroll: true });
  }
  async function nextArena({ skipRow = null } = {}) {
    const navigation = skipRow ? journeyNavigation() : teamDestination(),
      destination = navigation?.next;
    if (
      !destination ||
      disposed ||
      inactive ||
      !foreground() ||
      loopStopped ||
      nextOperation ||
      discovery?.isOpen() ||
      settingsDialog.open ||
      earnedDialog.open ||
      departure ||
      (skipRow && (navigation.row !== skipRow || !['paused', 'lost'].includes(run?.status)))
    )
      return;
    const recipe = { level: structuredClone(destination), options: currentRecipe().options };
    const selection = newPictureSelection(
      recipe,
      navigation.nextRow?.pack ?? acceptedPicture.sourcePack,
      navigation.nextRow?.pack ?? attemptPack,
      navigation.nextRow ? null : acceptedPicture.artworkSource,
    );
    const rememberBuiltIn = selection.sourcePack === COOP_STARTER_PACK;
    const operation = {
      run,
      generation,
      picture: acceptedPicture,
      pack: attemptPack,
      settingsVisit,
      selection,
      skipped: skipRow,
      action: $(skipRow ? 'coop-journey-skip-confirm' : 'coop-next'),
      status: run.status,
      controller: new AbortController(),
      detach: () => {},
    };
    const current = () =>
      nextOperation === operation &&
      !disposed &&
      !inactive &&
      foreground() &&
      run === operation.run &&
      generation === operation.generation &&
      acceptedPicture === operation.picture &&
      attemptPack === operation.pack &&
      run.status === operation.status &&
      !loopStopped &&
      !settingsDialog.open &&
      !earnedDialog.open &&
      !departure &&
      !operation.controller.signal.aborted;
    let rolledBack = false,
      adoptedGeneration = null;
    const adopted = (candidate) =>
      !disposed &&
      run === candidate &&
      generation === adoptedGeneration &&
      acceptedPicture === selection &&
      settingsVisit === operation.settingsVisit &&
      running() &&
      !inactive &&
      foreground() &&
      !settingsDialog.open &&
      !earnedDialog.open &&
      !departure;
    nextOperation = operation;
    const focusChanged = (event) => {
      if (event.target !== operation.action && event.target !== $('coop-next-cancel')) cancelNext();
    };
    document.addEventListener('focusin', focusChanged);
    operation.detach = () => document.removeEventListener('focusin', focusChanged);
    try {
      nextStatus(
        `Preparing ${destination.name}… Your ${skipRow ? 'attempt' : 'result'} stays available.`,
      );
      if (!current()) return;
      $('coop-next-cancel').focus({ preventScroll: true });
      await presentationPage.ready;
      if (!current()) return;
      selection.binding = await selection.lease.select({
        ...selection.request,
        signal: operation.controller.signal,
        onStatus: (status) => {
          if (!current()) return;
          const text = picturePreparationText(status, destination.name);
          if (text) nextStatus(text);
        },
      });
      if (!current()) return;
      selection.binding = selection.lease.confirm(selection.request);
      selection.state = 'ready';
      const candidate = createCoop(structuredClone(recipe.level), recipe.options);
      startCoop(candidate);
      if (!current()) return;
      // First paint is tested while the completed attempt still owns its image.
      painter.paint(candidate, {
        reduced: displayPreferences.snapshot().effectiveReducedEffects,
        textFace: displayPreferences.snapshot().textFace,
        picture: selection.binding,
      });
      if (!current()) {
        if (!disposed && run === operation.run) render();
        return;
      }
      clear();
      if (!current()) return;
      const previous = {
        run,
        level: attemptLevel,
        pack: attemptPack,
        setupPack: pack,
        artworkSource: packArtworkSource,
        picture: acceptedPicture,
        selection: pictureSelection,
        knockdowns,
        last,
        accumulator,
        arena: $('coop-level').value,
        difficulty: $('coop-difficulty').value,
        configuration: $('coop-experiment').value,
        lastBuiltInArena,
      };
      // No callbacks between the final check and reference publication.
      run = candidate;
      attemptLevel = recipe.level;
      attemptPack = selection.pack;
      acceptedPicture = pictureSelection = selection;
      adoptedGeneration = ++generation;
      nextOperation = null;
      operation.detach();
      knockdowns = [null, null];
      last = null;
      accumulator = 0;
      try {
        if (rememberBuiltIn) lastBuiltInArena = destination.id;
        if (navigation.nextRow) {
          packArtworkSource = null;
          showPack(navigation.nextRow.pack, destination.id, () => adopted(candidate));
          if (!adopted(candidate)) return;
        }
        $('coop-level').value = destination.id;
        $('coop-difficulty').value = candidate.difficulty;
        const configuration = COOP_PLAYTEST_CONFIGURATIONS.find((item) =>
          ['jointCuts', 'assistCaptures', 'advancedCooperation'].every(
            (key) => item[key] === candidate.config[key],
          ),
        );
        if (configuration) $('coop-experiment').value = configuration.id;
        nextStatus('');
        $('coop-stage').textContent = candidate.level.name.toUpperCase();
        $('coop-progress').max = candidate.level.goal.coverage
          ? candidate.level.goal.coverage * 100
          : 100;
        overlay({ focus: false });
        render();
        if (!adopted(candidate)) return;
        setupNote({ level: attemptLevel, experiment: candidate.config });
      } catch (error) {
        if (adopted(candidate) && settingsVisit === operation.settingsVisit) {
          rolledBack = true;
          run = previous.run;
          attemptLevel = previous.level;
          attemptPack = previous.pack;
          acceptedPicture = previous.picture;
          pictureSelection = previous.selection;
          knockdowns = previous.knockdowns;
          last = previous.last;
          accumulator = previous.accumulator;
          generation++;
          lastBuiltInArena = previous.lastBuiltInArena;
          if (navigation.nextRow) {
            packArtworkSource = previous.artworkSource;
            const epoch = generation;
            showPack(
              previous.setupPack,
              previous.arena,
              () =>
                run === previous.run &&
                generation === epoch &&
                acceptedPicture === previous.picture,
            );
            if (
              run !== previous.run ||
              generation !== epoch ||
              acceptedPicture !== previous.picture
            )
              return;
          }
          $('coop-level').value = previous.arena;
          $('coop-difficulty').value = previous.difficulty;
          $('coop-experiment').value = previous.configuration;
          setupNote({ level: attemptLevel, experiment: run.config });
          $('coop-stage').textContent = run.level.name.toUpperCase();
          $('coop-progress').max = run.level.goal.coverage ? run.level.goal.coverage * 100 : 100;
          overlay({ focus: false });
        }
        throw error;
      }
      if (adopted(candidate) && rememberBuiltIn) arenaPreference.choose(destination.id);
      if (acceptedPicture !== previous.picture && pictureSelection !== previous.picture)
        previous.picture.lease?.dispose();
      if (!adopted(candidate)) return;
      candidateProgress?.started(selection.journeyRow, candidate, { skipped: skipRow });
      if (!adopted(candidate)) return;
      message(`${destination.name}. Choose fresh directions when you are ready.`);
      input.focus();
    } catch (error) {
      const failed = nextOperation === operation;
      const recovery = {
        owner: nextOperation,
        generation,
        settingsVisit,
        focus: document.activeElement,
      };
      const ownsRecovery = () =>
        !disposed &&
        !operation.controller.signal.aborted &&
        nextOperation === recovery.owner &&
        generation === recovery.generation &&
        run === operation.run &&
        acceptedPicture === operation.picture &&
        attemptPack === operation.pack &&
        settingsVisit === recovery.settingsVisit &&
        document.activeElement === recovery.focus;
      if (!(failed || rolledBack) || !ownsRecovery()) return;
      // Logging is an external callback: Cancel or a newer action must remain
      // authoritative when it returns, including after an adoption rollback.
      try {
        console.error('Team next arena preparation failed.', error);
      } catch {}
      if (!ownsRecovery()) return;
      if (failed) {
        nextOperation = null;
        operation.detach();
      }
      // A cancelled/stale completion must not overwrite a newer action/status.
      if (
        (failed || rolledBack) &&
        !disposed &&
        run === operation.run &&
        acceptedPicture === operation.picture &&
        !nextOperation
      ) {
        nextStatus(
          `Could not start ${destination.name}. Your ${skipRow ? 'attempt' : 'result'} is unchanged. ${skipRow ? 'Choose Skip again when ready.' : 'Try Next again.'}`,
        );
        try {
          render();
        } catch {
          /* The retained result still offers recovery. */
        }
        if (
          !nextOperation &&
          run === operation.run &&
          acceptedPicture === operation.picture &&
          foreground() &&
          !settingsDialog.open &&
          !earnedDialog.open
        )
          operation.action.focus({ preventScroll: true });
      }
    } finally {
      if (nextOperation === operation) cancelNext();
      operation.detach();
      if (acceptedPicture !== selection && pictureSelection !== selection)
        selection.lease?.dispose();
      if (
        adoptedGeneration !== null &&
        acceptedPicture !== operation.picture &&
        pictureSelection !== operation.picture
      )
        operation.picture.lease?.dispose();
    }
  }
  $('coop-next').onclick = () => void nextArena();
  $('coop-next-cancel').onclick = () => cancelNext({ restore: true });

  function cancelJourneySkip() {
    if (!journeySkip) return;
    journeySkip = null;
    if (!disposed) overlay({ focus: false });
  }
  function skipJourney() {
    const destination = journeyNavigation();
    if (
      !destination?.next ||
      disposed ||
      inactive ||
      !foreground() ||
      loopStopped ||
      nextOperation ||
      discovery?.isOpen() ||
      settingsDialog.open ||
      earnedDialog.open ||
      departure ||
      !['running', 'paused', 'lost'].includes(run?.status)
    )
      return;
    if (
      journeySkip?.run === run &&
      journeySkip.generation === generation &&
      journeySkip.picture === acceptedPicture
    ) {
      const row = journeySkip.row;
      journeySkip = null;
      $('coop-journey-skip-confirm').textContent = 'Skip mission';
      void nextArena({ skipRow: row });
      return;
    }
    const attempt = run,
      epoch = generation;
    pause({ focus: false });
    if (
      disposed ||
      run !== attempt ||
      generation !== epoch ||
      !foreground() ||
      inactive ||
      settingsDialog.open ||
      earnedDialog.open ||
      departure ||
      discovery?.isOpen()
    )
      return;
    journeySkip = { run, generation, picture: acceptedPicture, row: destination.row };
    $('coop-journey-skip-confirm').textContent = 'Confirm skip';
    $('coop-overlay-copy').textContent =
      `Skip to ${destination.next.name}? No clear is awarded. You can return through Browse Team arenas.`;
    $('coop-journey-skip-confirm').focus({ preventScroll: true });
  }
  const skipFocusChanged = (event) => {
    if (event.target !== $('coop-journey-skip-confirm')) cancelJourneySkip();
  };
  document.addEventListener('focusin', skipFocusChanged);
  $('coop-journey-skip').onclick = skipJourney;
  $('coop-journey-skip-confirm').onclick = skipJourney;

  function canOpenDiscovery() {
    return (
      !disposed &&
      !inactive &&
      foreground() &&
      !running() &&
      !departure &&
      !settingsDialog.open &&
      !earnedDialog.open &&
      !nextOperation &&
      !pictureOperation &&
      !importOperation &&
      !importAdopting &&
      !artworkImports.pending() &&
      !discoveryOperation
    );
  }
  function discoveryControls() {
    for (const id of ['coop-discovery-open', 'coop-discovery-paused']) {
      const button = $(id);
      if (button) button.disabled = !canOpenDiscovery();
    }
  }
  function cancelDiscoveryPreparation(operation = discoveryOperation) {
    if (!operation || operation.cancelled) return;
    operation.cancelled = true;
    if (discoveryOperation === operation) discoveryOperation = null;
    operation.detach();
    if (departure?.kind === 'discovery' && departure.operation === operation)
      closeDeparture(departure, { restore: false });
    operation.controller.abort();
    if (operation.selection !== acceptedPicture && operation.selection !== pictureSelection)
      operation.selection.lease.dispose();
    discoveryControls();
  }
  async function prepareDiscoveryPreview(row, { signal, isCurrent, onStatus = () => {} }) {
    const aborted = () => new DOMException('Team preview is no longer current.', 'AbortError');
    if (!currentDiscoveryRows().includes(row) || signal.aborted || !isCurrent()) throw aborted();
    const owner = {
      run,
      generation,
      picture: acceptedPicture,
      selection: pictureSelection,
      pack,
      artworkSource: packArtworkSource,
      localPack: localDiscoveryPack,
      settingsVisit,
      importRequest,
      loopStopped,
      level: $('coop-level').value,
      difficulty: $('coop-difficulty').value,
      configuration: $('coop-experiment').value,
    };
    const request = {
      pack: structuredClone(row.pack),
      levelId: row.levelId,
      themeId: row.artworkSource?.receipt.theme.id ?? 'fpv',
      attemptId: `team-preview-${++discoveryPreviewSequence}`,
      ...(row.artworkSource ? { artworkSource: row.artworkSource } : {}),
    };
    let released = false,
      snapshot = null;
    const check = () => {
      if (
        released ||
        signal.aborted ||
        !isCurrent() ||
        disposed ||
        inactive ||
        !foreground() ||
        running() ||
        !discovery?.isOpen() ||
        !currentDiscoveryRows().includes(row) ||
        row.level.id !== row.levelId ||
        !row.pack.levels.includes(row.level) ||
        run !== owner.run ||
        generation !== owner.generation ||
        acceptedPicture !== owner.picture ||
        pictureSelection !== owner.selection ||
        pack !== owner.pack ||
        packArtworkSource !== owner.artworkSource ||
        localDiscoveryPack !== owner.localPack ||
        settingsVisit !== owner.settingsVisit ||
        importRequest !== owner.importRequest ||
        loopStopped !== owner.loopStopped ||
        $('coop-level').value !== owner.level ||
        $('coop-difficulty').value !== owner.difficulty ||
        $('coop-experiment').value !== owner.configuration ||
        settingsDialog.open ||
        earnedDialog.open ||
        departure ||
        discoveryOperation ||
        nextOperation ||
        pictureOperation ||
        importOperation ||
        importAdopting ||
        released ||
        signal.aborted
      )
        throw aborted();
    };
    const lease = createCoopPresentation({
      bindings: COOP_PICTURE_BINDINGS,
      historicalImportPolicy: COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
      getSnapshot() {
        check();
        const current = presentationPage.current();
        check();
        if (current !== snapshot) throw aborted();
        return current;
      },
      readPicture: presentationPage.readPicture,
      decodeImage: decodeCoopPicture,
    });
    const release = () => {
      if (released) return;
      released = true;
      signal.removeEventListener('abort', release);
      // This preview owns its decoder only. The current attempt and the opaque
      // imported source retain their separate owners throughout browsing.
      lease.dispose();
    };
    const confirm = () => {
      try {
        check();
        // Revalidate the live row as well as the captured request: matching IDs
        // cannot authorize a changed pack or an expired local artwork owner.
        const binding = lease.confirm({ ...request, pack: row.pack, signal });
        check();
        return binding.image;
      } catch (error) {
        release();
        throw error;
      }
    };
    signal.addEventListener('abort', release, { once: true });
    try {
      check();
      await presentationPage.ready;
      check();
      snapshot = presentationPage.current();
      check();
      await lease.select({
        ...request,
        signal,
        onStatus(status) {
          try {
            check();
          } catch {
            return;
          }
          const text = picturePreparationText(status);
          if (text) onStatus(text);
        },
      });
      const image = confirm();
      return Object.freeze({ image, confirm, release });
    } catch (error) {
      release();
      throw error;
    }
  }
  async function activateDiscovery(row, { signal, isCurrent, onStatus, opener }) {
    if (!canOpenDiscovery() || !currentDiscoveryRows().includes(row))
      throw new DOMException('Arena selection is no longer current.', 'AbortError');
    const recipe = {
      level: structuredClone(row.level),
      options: {
        ...currentRecipe().options,
        ...(row.journeyRow ? { difficulty: row.journeyRow.difficulty } : {}),
      },
    };
    const selection = newPictureSelection(recipe, row.pack, row.pack, row.artworkSource);
    const previous = {
      run,
      generation,
      level: attemptLevel,
      attemptPack,
      picture: acceptedPicture,
      selection: pictureSelection,
      pack,
      artworkSource: packArtworkSource,
      localPack: localDiscoveryPack,
      settingsVisit,
      importRequest,
      loopStopped,
      knockdowns,
      last,
      accumulator,
      lastBuiltInArena,
      pictureMessage,
      arena: $('coop-level').value,
      difficulty: $('coop-difficulty').value,
      configuration: $('coop-experiment').value,
      menuHidden: $('coop-menu').hidden,
      playHidden: $('coop-play').hidden,
      playing: document.body.classList.contains('playing'),
    };
    const operation = {
      selection,
      controller: new AbortController(),
      cancelled: false,
      detach: () => {},
    };
    let candidate = null,
      publishedGeneration = null,
      completed = false;
    const current = () =>
      discoveryOperation === operation &&
      !operation.cancelled &&
      !disposed &&
      !inactive &&
      foreground() &&
      !signal.aborted &&
      !operation.controller.signal.aborted &&
      isCurrent() &&
      currentDiscoveryRows().includes(row) &&
      run === previous.run &&
      generation === previous.generation &&
      attemptLevel === previous.level &&
      attemptPack === previous.attemptPack &&
      acceptedPicture === previous.picture &&
      pictureSelection === previous.selection &&
      pack === previous.pack &&
      packArtworkSource === previous.artworkSource &&
      localDiscoveryPack === previous.localPack &&
      settingsVisit === previous.settingsVisit &&
      importRequest === previous.importRequest &&
      loopStopped === previous.loopStopped &&
      $('coop-level').value === previous.arena &&
      $('coop-difficulty').value === previous.difficulty &&
      $('coop-experiment').value === previous.configuration &&
      !settingsDialog.open &&
      !earnedDialog.open &&
      !pictureOperation &&
      !importOperation &&
      !importAdopting &&
      !nextOperation &&
      (!departure || (departure.kind === 'discovery' && departure.operation === operation));
    const check = () => {
      if (!current())
        throw new DOMException(
          'Arena preparation cancelled. Your current arena is kept.',
          'AbortError',
        );
    };
    const abort = () => cancelDiscoveryPreparation(operation);
    const moved = (event) => {
      if (
        ![
          opener,
          $('coop-discovery-dialog'),
          $('coop-discovery-cancel'),
          document.body,
          document.documentElement,
        ].includes(event.target) &&
        !(
          departure?.kind === 'discovery' &&
          departure.operation === operation &&
          departureDialog.contains(event.target)
        )
      )
        abort();
    };
    operation.detach = () => {
      signal.removeEventListener('abort', abort);
      document.removeEventListener('focusin', moved);
    };
    discoveryOperation = operation;
    signal.addEventListener('abort', abort, { once: true });
    document.addEventListener('focusin', moved);
    if (signal.aborted) abort();
    const ownsPublished = () =>
      !disposed &&
      run === candidate &&
      generation === publishedGeneration &&
      acceptedPicture === selection &&
      pictureSelection === selection;
    const accepted = () =>
      ownsPublished() &&
      discoveryOperation === operation &&
      !operation.cancelled &&
      !signal.aborted &&
      isCurrent() &&
      !inactive &&
      foreground() &&
      settingsVisit === previous.settingsVisit &&
      !settingsDialog.open &&
      !earnedDialog.open &&
      !departure &&
      pack === row.pack &&
      packArtworkSource === row.artworkSource &&
      running();
    const rollback = () => {
      if (!ownsPublished()) return;
      run = previous.run;
      attemptLevel = previous.level;
      attemptPack = previous.attemptPack;
      acceptedPicture = previous.picture;
      pictureSelection = previous.selection;
      pack = previous.pack;
      packArtworkSource = previous.artworkSource;
      loopStopped = previous.loopStopped;
      knockdowns = previous.knockdowns;
      last = previous.last;
      accumulator = previous.accumulator;
      lastBuiltInArena = previous.lastBuiltInArena;
      const epoch = ++generation;
      const owns = () => !disposed && generation === epoch && run === previous.run;
      $('coop-difficulty').value = previous.difficulty;
      $('coop-experiment').value = previous.configuration;
      showPack(previous.pack, previous.arena, owns);
      if (!owns()) return;
      document.body.classList.toggle('playing', previous.playing);
      $('coop-menu').hidden = previous.menuHidden;
      $('coop-play').hidden = previous.playHidden;
      pictureUI(previous.pictureMessage);
      if (!owns()) return;
      if (run) {
        $('coop-stage').textContent = run.level.name.toUpperCase();
        $('coop-progress').max = run.level.goal.coverage ? run.level.goal.coverage * 100 : 100;
      }
      overlay({ focus: false });
    };
    try {
      check();
      onStatus(`Preparing ${row.title}… Your current arena stays available.`);
      check();
      await presentationPage.ready;
      check();
      selection.binding = await selection.lease.select({
        ...selection.request,
        signal: operation.controller.signal,
        onStatus: (status) => {
          if (!current()) return;
          const text = picturePreparationText(status);
          if (text) onStatus(`${text} Your current arena stays available.`);
        },
      });
      check();
      selection.binding = selection.lease.confirm(selection.request);
      selection.state = 'ready';
      candidate = createCoop(structuredClone(recipe.level), recipe.options);
      startCoop(candidate);
      check();
      if (previous.run?.status === 'paused') {
        const replace = await new Promise((resolve) => {
          const ticket = {
            kind: 'discovery',
            opener,
            run,
            generation,
            operation,
            resolve,
            current,
          };
          departure = ticket;
          $('coop-discard-title').textContent = 'Start another Team arena?';
          $('coop-discard-copy').textContent =
            `Stay keeps this attempt and its picture. Replace & play starts ${row.title} together. This unfinished attempt is not saved; replacing it loses its current territory, not previously recorded mission clears.`;
          $('coop-discard-confirm').textContent = 'Replace & play';
          try {
            departureDialog.showModal();
            $('coop-discard-stay').focus({ preventScroll: true });
            if (!current()) closeDeparture(ticket, { restore: false });
          } catch (error) {
            closeDeparture(ticket, { restore: false });
            throw error;
          }
        });
        check();
        if (!replace) {
          onStatus('Your Team attempt is kept. Choose Play when you are ready.');
          return false;
        }
      }
      check();
      selection.binding = selection.lease.confirm(selection.request);
      painter.paint(candidate, {
        reduced: displayPreferences.snapshot().effectiveReducedEffects,
        textFace: displayPreferences.snapshot().textFace,
        picture: selection.binding,
      });
      check();
      clear();
      check();
      // Publish the validated core, exact picture and setup together. No callbacks
      // run between the last guard and these reference assignments.
      run = candidate;
      attemptLevel = recipe.level;
      attemptPack = selection.pack;
      acceptedPicture = pictureSelection = selection;
      pack = row.pack;
      packArtworkSource = row.artworkSource;
      publishedGeneration = ++generation;
      loopStopped = false;
      knockdowns = [null, null];
      last = null;
      accumulator = 0;
      if (row.pack === COOP_STARTER_PACK) lastBuiltInArena = row.levelId;
      try {
        $('coop-difficulty').value = candidate.difficulty;
        const configuration = COOP_PLAYTEST_CONFIGURATIONS.find((item) =>
          ['jointCuts', 'assistCaptures', 'advancedCooperation'].every(
            (key) => item[key] === candidate.config[key],
          ),
        );
        if (configuration) $('coop-experiment').value = configuration.id;
        showPack(row.pack, row.levelId, accepted);
        if (!accepted()) throw new DOMException('Arena activation changed.', 'AbortError');
        document.body.classList.add('playing');
        $('coop-menu').hidden = true;
        $('coop-play').hidden = false;
        $('coop-stage').textContent = candidate.level.name.toUpperCase();
        $('coop-progress').max = candidate.level.goal.coverage
          ? candidate.level.goal.coverage * 100
          : 100;
        pictureUI('Team picture ready.');
        overlay({ focus: false });
        render();
        if (!accepted()) throw new DOMException('Arena activation changed.', 'AbortError');
        setupNote({ level: attemptLevel, experiment: candidate.config });
        message(`${row.title}. Choose fresh directions when you are ready.`);
        if (!accepted()) throw new DOMException('Arena activation changed.', 'AbortError');
      } catch (error) {
        rollback();
        throw error;
      }
      completed = true;
      discoveryOperation = null;
      operation.detach();
      discoveryStarted = {
        run: candidate,
        generation: publishedGeneration,
        picture: selection,
        sourcePack: row.pack,
        levelId: row.levelId,
      };
      for (const old of new Set([previous.picture, previous.selection]))
        if (old && old !== acceptedPicture && old !== pictureSelection) old.lease?.dispose();
      if (run === candidate && running() && foreground() && !disposed)
        candidateProgress?.started(selection.journeyRow, candidate);
      return run === candidate && running() && foreground() && !disposed;
    } finally {
      if (discoveryOperation === operation) discoveryOperation = null;
      operation.detach();
      if (departure?.kind === 'discovery' && departure.operation === operation)
        closeDeparture(departure, { restore: false });
      if (acceptedPicture !== selection && pictureSelection !== selection)
        selection.lease.dispose();
      if (!completed && !disposed && run === previous.run && acceptedPicture === previous.picture) {
        try {
          render();
        } catch {
          /* Keep the retained recovery surface available. */
        }
      }
      discoveryControls();
    }
  }
  discovery = attachTeamDiscovery({
    document,
    dialog: $('coop-discovery-dialog'),
    list: $('coop-discovery-list'),
    status: $('coop-discovery-status'),
    back: $('coop-discovery-back'),
    cancel: $('coop-discovery-cancel'),
    search: $('coop-discovery-search'),
    campaign: $('coop-discovery-campaign'),
    getEntries: currentDiscoveryRows,
    presentCard: candidateCardPresenter,
    canOpen: canOpenDiscovery,
    activate: activateDiscovery,
    preparePreview: prepareDiscoveryPreview,
    preview: {
      panel: $('coop-discovery-preview'),
      canvas: $('coop-discovery-preview-canvas'),
      title: $('coop-discovery-preview-title'),
      status: $('coop-discovery-preview-status'),
      retry: $('coop-discovery-preview-retry'),
    },
    onViewChange: () => clear(),
    onOpen() {
      discoveryStarted = null;
      clear();
      discoveryControls();
    },
    onClose() {
      cancelDiscoveryPreparation();
      const started = discoveryStarted;
      discoveryStarted = null;
      clear();
      const stillCurrent = () =>
        Boolean(started) &&
        !disposed &&
        foreground() &&
        !inactive &&
        run === started.run &&
        generation === started.generation &&
        acceptedPicture === started.picture &&
        running() &&
        !discovery.isOpen() &&
        !settingsDialog.open &&
        !earnedDialog.open &&
        !departure;
      const focus = document.activeElement;
      if (
        stillCurrent() &&
        started.sourcePack === COOP_STARTER_PACK &&
        pack === COOP_STARTER_PACK &&
        arenaPreference.current() !== started.levelId
      )
        arenaPreference.choose(started.levelId);
      if (stillCurrent() && document.activeElement === focus) input.focus();
      discoveryControls();
    },
  });
  $('coop-discovery-open').onclick = () => discovery.open($('coop-discovery-open'));
  $('coop-discovery-paused').onclick = () => discovery.open($('coop-discovery-paused'));

  function currentRecipe() {
    if (run)
      return {
        level: structuredClone(attemptLevel),
        options: { seed: run.seed, difficulty: run.difficulty, ...run.config },
      };
    const experiment = selectedConfiguration();
    const level = selectedLevel();
    return {
      level,
      options: {
        seed: 17,
        difficulty: level.journeyDifficulty ?? $('coop-difficulty').value,
        jointCuts: experiment.jointCuts,
        assistCaptures: experiment.assistCaptures,
        advancedCooperation: experiment.advancedCooperation,
      },
    };
  }
  function start(recipe = currentRecipe(), prepared = null) {
    cancelJourneySkip();
    cancelAutomaticRetry();
    cancelNext();
    nextStatus('');
    if (
      disposed ||
      inactive ||
      departure ||
      discovery?.isOpen() ||
      earnedDialog.open ||
      pictureOperation ||
      importOperation ||
      importAdopting ||
      (!run && !startPermitted) ||
      !foreground()
    )
      return;
    const selection = run ? acceptedPicture : pictureSelection;
    if (!selection || selection.state !== 'ready') return;
    if (selection.levelId !== recipe.level.id) return;
    // Confirmation rechecks exact snapshot/asset identity before changing either
    // the core or its accepted image. Same-attempt Retry reuses that exact lease.
    const binding = selection.lease?.confirm(selection.request) ?? null;
    // Validate a fresh core before releasing the old reference. A failed retry
    // must leave the paused/stopped attempt available on this page.
    // The core's live level shares enemy objects with its mutable threat state.
    // Keep the validated starting level separately for an exact fresh Retry.
    const startingLevel = structuredClone(recipe.level);
    const next = prepared || createCoop(startingLevel, recipe.options);
    const rememberVisibleArena =
      !run && pack === COOP_STARTER_PACK && arenaPreference.current() !== startingLevel.id;
    cancelImport({ forget: true });
    $('coop-pack-file').value = '';
    clear();
    knockdowns = [null, null];
    const level = next.level;
    run = next;
    attemptLevel = startingLevel;
    attemptPack = selection.pack;
    const previousPicture = acceptedPicture;
    acceptedPicture = selection;
    acceptedPicture.binding = binding;
    if (pictureSelection && pictureSelection !== selection) retirePicture();
    pictureSelection = selection;
    if (previousPicture && previousPicture !== selection) previousPicture.lease?.dispose();
    pictureUI(
      binding
        ? 'Team picture is ready for this attempt.'
        : 'Procedural Team arena is ready for this attempt.',
    );
    generation++;
    startCoop(run);
    document.body.classList.add('playing');
    $('coop-menu').hidden = true;
    $('coop-play').hidden = false;
    $('coop-stage').textContent = level.name.toUpperCase();
    $('coop-progress').max = level.goal.coverage ? level.goal.coverage * 100 : 100;
    const guidance = coopArenaGuidance(run.level, run.config);
    supportGuidance(guidance);
    message(guidance.startMessage);
    overlay();
    try {
      render();
    } catch (error) {
      stopArena(error);
      return;
    }
    if (rememberVisibleArena && !disposed && run === next && running() && foreground())
      arenaPreference.choose(startingLevel.id);
    if (!disposed && run === next && running() && foreground())
      acceptMusic(selection, { play: true });
    if (!disposed && run === next && running() && foreground())
      candidateProgress?.started(selection.journeyRow, next);
    if (disposed || run !== next || !running() || !foreground()) return;
    input.focus();
    if (loopStopped) {
      loopStopped = false;
      last = null;
    }
  }
  function pause({ focus = true } = {}) {
    discovery?.cancel();
    cancelAutomaticRetry();
    cancelNext();
    cancelPicture({ restore: false });
    if (!running()) return;
    pauseCoop(run);
    clear();
    overlay({ focus });
    try {
      render();
    } catch (error) {
      stopArena(error, { focus });
    }
  }
  function stopArena(error, { focus = true } = {}) {
    discovery?.cancel();
    cancelAutomaticRetry();
    cancelNext();
    // Never repaint while handling a painter failure. Any destructive decision
    // is cancelled before showing the stopped attempt's recovery actions.
    loopStopped = true;
    music?.suspend();
    closeEarnedPicture({ restore: false });
    cancelPicture({ restore: false });
    if (running()) pauseCoop(run);
    clear();
    cancelDeparture({ restore: false });
    overlay({ focus: false });
    $('coop-resume').hidden = true;
    $('coop-overlay-title').textContent = 'The arena needs a fresh start';
    $('coop-overlay-copy').textContent =
      'This attempt is stopped and cannot resume. Retry resets it; Change setup keeps your setup choices.';
    if (focus && !document.hidden && document.hasFocus?.() !== false)
      primary().focus({ preventScroll: true });
    $('coop-boot').textContent = `Arena stopped: ${error.message}`;
    message(`Arena stopped: ${error.message}. Choose Retry or Change setup.`);
    console.error(error);
  }
  function resume() {
    if (
      disposed ||
      inactive ||
      !foreground() ||
      departure ||
      discovery?.isOpen() ||
      settingsDialog.open ||
      run?.status !== 'paused' ||
      loopStopped
    )
      return;
    cancelPicture({ restore: false });
    clear();
    resumeCoop(run);
    if (music) void music.start();
    last = null;
    overlay();
    input.focus();
    message('Choose fresh directions when you are ready.');
  }
  // This synchronous handoff owns only the return from an attempt to its lobby.
  // Do not let focus/layout callbacks revive it after a newer action or lifecycle.
  function lobbyFocus() {
    const origin = document.activeElement,
      epoch = generation + 1,
      visit = settingsVisit;
    let target = null,
      moved = inactive || !foreground();
    const lose = () => {
      moved = true;
    };
    const focusChanged = (event) => {
      if (!unclaimedFocus(event.target) && event.target !== origin && event.target !== target)
        lose();
    };
    const blurred = (event) => {
      if (event.target === window) lose();
    };
    const hidden = () => {
      if (document.hidden) lose();
    };
    const observers = [
      [document, 'focusin', focusChanged],
      [document, 'keydown', lose],
      [document, 'pointerdown', lose],
      [document, 'visibilitychange', hidden],
      [window, 'blur', blurred],
      [window, 'pagehide', lose],
    ];
    for (const [node, type, callback] of observers) node.addEventListener(type, callback, true);
    const current = () =>
      !moved &&
      !disposed &&
      !inactive &&
      foreground() &&
      !run &&
      generation === epoch &&
      settingsVisit === visit &&
      !settingsDialog.open &&
      !departure &&
      !$('coop-menu').hidden;
    return {
      finish() {
        target = primary();
        const owns = () =>
          current() &&
          primary() === target &&
          (document.activeElement === origin ||
            document.activeElement === target ||
            unclaimedFocus(document.activeElement));
        if (!owns() || !visibleAction(target) || !owns()) return;
        if (document.activeElement !== target) target.focus({ preventScroll: true });
        const focused = () =>
          current() && primary() === target && document.activeElement === target;
        if (!focused() || !visibleAction(target) || !focused()) return;
        const rect = target.getBoundingClientRect(),
          width = document.documentElement.clientWidth || window.innerWidth,
          height = document.documentElement.clientHeight || window.innerHeight;
        if (
          ![rect.left, rect.top, rect.right, rect.bottom, width, height].every(Number.isFinite) ||
          rect.width <= 0 ||
          rect.height <= 0 ||
          width <= 16 ||
          height <= 16 ||
          (rect.left >= 8 && rect.top >= 8 && rect.right <= width - 8 && rect.bottom <= height - 8)
        )
          return;
        if (!focused() || !visibleAction(target) || !focused()) return;
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      },
      cancel() {
        for (const [node, type, callback] of observers)
          node.removeEventListener(type, callback, true);
      },
    };
  }
  function lobby() {
    discovery?.close({ restore: false });
    cancelNext();
    nextStatus('');
    if (disposed || departure) return;
    const focus = lobbyFocus();
    try {
      cancelImport({ forget: true });
      clear();
      const retainedPicture = acceptedPicture;
      retirePicture();
      acceptedPicture = null;
      run = null;
      attemptLevel = null;
      attemptPack = null;
      generation++;
      document.body.classList.remove('playing');
      $('coop-play').hidden = true;
      $('coop-menu').hidden = false;
      showPackStatus();
      difficultyControls();
      placeTools(false);
      if (
        retainedPicture?.sourcePack === pack &&
        retainedPicture.artworkSource === packArtworkSource &&
        retainedPicture.levelId === selectedLevel().id
      ) {
        pictureSelection = retainedPicture;
        pictureUI('Team picture ready. Start remains a separate action.');
      } else {
        retainedPicture?.lease?.dispose();
        void preparePicture();
      }
      focus.finish();
    } finally {
      focus.cancel();
    }
  }
  const unfinished = () => run && ['running', 'paused'].includes(run.status);
  const departureLabels = {
    setup: 'Discard and change setup',
    retry: 'Discard and retry',
    return: 'Discard and leave',
    home: 'Discard and leave',
    versus: 'Discard and go to Versus',
  };
  function visibleAction(element) {
    return (
      element?.isConnected &&
      !element.disabled &&
      !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
      element.getClientRects().length > 0 &&
      document.defaultView?.getComputedStyle(element)?.visibility !== 'hidden'
    );
  }
  function closeDeparture(ticket, { restore = true } = {}) {
    if (!ticket || departure !== ticket) return;
    departure = null;
    if (departureDialog.open) departureDialog.close();
    navigation.clear();
    if (ticket.kind === 'discovery') {
      const resolve = ticket.resolve;
      ticket.resolve = null;
      resolve?.(false);
      return;
    }
    if (restore && !disposed && !document.hidden && document.hasFocus?.() !== false) {
      // Header links are outside the paused navigation root. Return to its safe
      // primary instead of leaving keyboard focus outside the active panel.
      const origin = $('coop-overlay').contains(ticket.opener) ? ticket.opener : primary();
      (visibleAction(origin) ? origin : primary()).focus({ preventScroll: true });
    }
  }
  function cancelDeparture(options) {
    closeDeparture(departure, options);
  }
  function requestDeparture(kind, opener) {
    discovery?.close({ restore: false });
    cancelNext();
    if (
      disposed ||
      departure ||
      settingsDialog.open ||
      earnedDialog.open ||
      pictureOperation ||
      !Object.hasOwn(departureLabels, kind)
    )
      return;
    if (!unfinished()) {
      if (kind === 'setup') lobby();
      else if (kind === 'retry') {
        try {
          start();
        } catch (error) {
          pictureUI(`Team attempt unchanged: ${error.message}`);
        }
      }
      return;
    }
    const ticket = { kind, opener, run, generation, recipe: currentRecipe() };
    departure = ticket;
    pause();
    if (departure !== ticket) return; // A paint fault cancelled this decision.
    // Already-paused and faulted attempts also shed stale UI/flight input.
    clear();
    $('coop-discard-title').textContent = 'Discard this Team attempt?';
    $('coop-discard-copy').textContent =
      `This unfinished attempt is not saved; discarding it loses its current territory, not previously recorded mission clears. ${
        loopStopped
          ? 'Stay keeps this stopped attempt on screen. It cannot resume after the arena error.'
          : 'Stay keeps both players paused. Resume together remains a separate action.'
      } ${
        kind === 'retry'
          ? 'Discard and retry starts this same arena again from the beginning.'
          : kind === 'setup'
            ? 'Discard and change setup clears this attempt without starting another.'
            : 'Discard and leave returns to the linked mode and loses this Team attempt.'
      }`;
    $('coop-discard-confirm').textContent = departureLabels[kind];
    try {
      departureDialog.showModal();
      $('coop-discard-stay').focus({ preventScroll: true });
    } catch (error) {
      closeDeparture(ticket);
      message(
        `Could not open the confirmation. The Team attempt stays ${loopStopped ? 'stopped' : 'paused'}: ${error.message}`,
      );
    }
  }
  $('coop-discard-stay').onclick = () => cancelDeparture();
  $('coop-discard-confirm').onclick = () => {
    const ticket = departure;
    if (!ticket || disposed || ticket.run !== run || ticket.generation !== generation) return;
    if (document.hidden || document.hasFocus?.() === false) {
      cancelDeparture({ restore: false });
      return;
    }
    if (ticket.kind === 'discovery') {
      const resolve = ticket.resolve;
      ticket.resolve = null;
      const accepted = ticket.current();
      closeDeparture(ticket, { restore: false });
      resolve?.(accepted && ticket.current());
      return;
    }
    // Keep creation/validation failure inside the old attempt's confirmation.
    let prepared;
    try {
      if (ticket.kind === 'retry') {
        prepared = createCoop(ticket.recipe.level, ticket.recipe.options);
      }
      const destination =
        ticket.kind === 'return'
          ? new URL(returnHref(), location.href).href
          : ticket.kind === 'home'
            ? new URL('../', location.href).href
            : ticket.kind === 'versus'
              ? new URL('./', location.href).href
              : null;
      closeDeparture(ticket, { restore: false });
      if (ticket.kind === 'setup') lobby();
      else if (ticket.kind === 'retry') start(ticket.recipe, prepared);
      else location.assign(destination);
    } catch (error) {
      message(`The Team attempt could not be replaced: ${error.message}`);
      if (departure === ticket)
        $('coop-discard-copy').textContent =
          `The Team attempt is still here and is not saved. ${error.message} Stay keeps it on screen.`;
      else primary().focus({ preventScroll: true });
    }
  };
  departureDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancelDeparture();
  });
  departureDialog.addEventListener('close', () => {
    if (!departureDialog.open) cancelDeparture();
  });
  departureDialog.addEventListener('keydown', (event) => {
    // Native cancel owns Escape here. The window flight listener would prevent
    // that default even while paused; keep this exception local to the dialog.
    if (event.key === 'Escape') event.stopPropagation();
  });
  for (const [id, kind] of [
    ['coop-race', 'return'],
    ['coop-home', 'home'],
    ['coop-solo', fromSolo ? 'return' : 'home'],
    ['coop-versus', 'versus'],
  ])
    $(id).addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        (event.button !== undefined && event.button !== 0)
      )
        return;
      cancelNext();
      $(id).setAttribute(
        'href',
        kind === 'return' ? returnHref() : kind === 'versus' ? './' : '../',
      );
      if (departure || pictureOperation) {
        event.preventDefault();
        return;
      }
      if (!unfinished()) return;
      event.preventDefault();
      requestDeparture(kind, $(id));
    });
  function cancelAutomaticRetry() {
    if (!automaticRetry) return;
    automaticRetry = null;
    if (run?.status === 'lost')
      $('coop-overlay-copy').textContent = coopRetryFeedback(run, knockdowns.filter(Boolean));
  }
  const retryFocusChanged = () => {
    if (document.activeElement !== $('coop-retry')) cancelAutomaticRetry();
  };
  document.addEventListener('focusin', retryFocusChanged);
  const suspend = () => {
    if (disposed) return;
    cancelJourneySkip();
    music?.suspend();
    discovery?.cancel();
    cancelDiscoveryPreparation();
    cancelAutomaticRetry();
    if (settingsOwner) settingsOwner.restore = false;
    inactive = true;
    cancelImport();
    pause({ focus: false });
    cancelDeparture({ restore: false });
    // Losing foreground also retires menu ownership while already paused.
    // A reader or held menu repeat must not outlive this lifecycle boundary.
    clear();
    framePads = [];
    last = null;
  };
  const returned = () => {
    if (disposed || !foreground()) return;
    inactive = false;
    last = null;
    if (music && !loopStopped) void music.resume();
    discoveryControls();
  };
  const hidden = () => {
    if (document.hidden) suspend();
    else returned();
  };
  window.addEventListener('blur', suspend);
  window.addEventListener('focus', returned);
  document.addEventListener('visibilitychange', hidden);
  function events() {
    const captureTeaching = candidateCaptureTeaching?.(
      acceptedPicture?.journeyRow,
      run,
      run.events,
    );
    for (const event of run.events) {
      if (event.type === 'cells.claimed' && captureTeaching) message(captureTeaching);
      if (event.type === 'cells.claimed' && run.terrain) {
        const caption = terrainTransitionCaption(run, event);
        if (caption) message(caption);
      }
      if (event.type === 'cut.closed') {
        input.clearPlayer(event.player);
        batch.release(event.player);
      }
      const roamerCaption = coopRoamerCaption(event);
      if (roamerCaption) message(roamerCaption);
      if (event.type === 'cut.joint')
        message(
          captureTeaching
            ? `Joint Cut! ${captureTeaching}`
            : 'Joint Cut! Both lines are banked. Choose your next route together.',
        );
      if (event.type === 'player.downed') {
        knockdowns[event.player] = event;
        input.clearPlayer(event.player);
        batch.release(event.player);
        message(
          `${coopFailureFeedback(run, event).cause} ${names[event.player]} needs a rescue. Hold Support nearby${run.config.advancedCooperation ? ' or capture 2% new territory' : ''}.`,
        );
      }
      if (event.type === 'player.revived') {
        knockdowns[event.player] = null;
        input.clearPlayer(event.player);
        batch.release(event.player);
        message(
          `${names[event.player]} is back.${event.reason === 'reserve' ? ' One team reserve used.' : ''} Choose a fresh direction.`,
        );
      }
      if (event.type === 'team.recovery')
        message('Both craft are back. One team reserve used. Choose fresh directions together.');
      if (event.type === 'shield.disabled')
        message('Both anchors secured! Now capture the exposed core in a new cut.');
      if (event.type === 'core.defeated')
        message('Stronghold defeated! Its emitter and travelling sparks are gone.');
      if (event.type === 'support.pulse') {
        if (event.interceptedImpacts?.length)
          message(`${names[event.player]} intercepted a travelling spark.`);
        else if (event.slowedEnemies?.length)
          message(`${names[event.player]} slowed the pressure. There is room to finish a cut.`);
      }
      if (event.type === 'rescue.completed') {
        input.clearPlayer(event.player);
        batch.release(event.player);
        message(
          `${names[event.player]} rescued their partner. Both craft are ready for a fresh direction.`,
        );
      }
      if (event.type === 'rescue.cancelled' && event.requiresFreshSteering) {
        input.clearPlayer(event.player);
        batch.release(event.player);
        message('Rescue interrupted. Choose a fresh direction or hold Support nearby again.');
      }
    }
  }
  function update(now) {
    if (disposed) return;
    if (inactive || !foreground()) {
      if (!inactive) suspend();
      frame = requestAnimationFrame(update);
      return;
    }
    try {
      acceptMusic(acceptedPicture);
      if (!loopStopped)
        music?.update(running(), { family: acceptedPicture?.request.themeId ?? 'fpv' });
      try {
        framePads = [...(navigator.getGamepads?.() || [])];
      } catch {
        framePads = [];
      }
      const signatures = new Map(
        framePads
          .filter((pad) => pad?.connected)
          .map((pad) => [
            pad.index,
            `${pad.id}:${pad.mapping}:${pad.buttons?.length}:${pad.axes?.length}`,
          ]),
      );
      if ([...previousPads].some(([index, signature]) => signatures.get(index) !== signature)) {
        pause();
        clear();
      }
      previousPads = signatures;
      input.poll();
      const routed = router.sample({ scope: scope(), timeMs: now });
      if (!running()) {
        if (routed.status.code === 'joined' || Object.values(routed.ui).some(Boolean))
          setReadingModality('controller');
        if (routed.status.code === 'joined') navigation.engage();
        navigation.handle(routed.ui);
      }
      if (automaticRetry) {
        const ticket = automaticRetry;
        if (
          run !== ticket.run ||
          generation !== ticket.generation ||
          acceptedPicture !== ticket.picture ||
          attemptPack !== ticket.pack ||
          run.status !== 'lost' ||
          loopStopped ||
          settingsVisit !== ticket.settingsVisit ||
          settingsDialog.open ||
          earnedDialog.open ||
          departure ||
          document.activeElement !== $('coop-retry')
        )
          cancelAutomaticRetry();
        else if (now >= ticket.at) {
          cancelAutomaticRetry();
          start(currentRecipe());
          if (run !== ticket.run && running())
            message(`${ticket.cause} New attempt; choose fresh directions together.`);
        }
      }
      const elapsed = last === null ? 0 : (now - last) / 1000;
      last = now;
      if (running() && elapsed > 0.25) pause();
      if (running()) {
        accumulator += elapsed;
        while (accumulator + 1e-9 >= FIXED_DT && running()) {
          const commands = batch.consume(input.consume());
          stepCoop(run, commands, FIXED_DT);
          accumulator -= FIXED_DT;
          events();
          if (!running()) {
            const finishedAttempt = run,
              epoch = generation;
            if (run.status === 'won') candidateProgress?.complete(run);
            if (disposed || run !== finishedAttempt || generation !== epoch) break;
            clear();
            overlay();
            if (run.status === 'lost' && run.level.journeyDifficulty && !loopStopped) {
              const failure = knockdowns.find(Boolean);
              automaticRetry = {
                run,
                generation,
                picture: acceptedPicture,
                pack: attemptPack,
                settingsVisit,
                at: now + 700,
                cause: failure
                  ? coopFailureFeedback(run, failure).cause
                  : 'The team ran out of reserves.',
              };
              $('coop-overlay-copy').textContent +=
                ' A fresh attempt starts shortly. Choose another action to stay here.';
            }
          }
        }
      }
      if (!loopStopped) render();
    } catch (error) {
      stopArena(error);
    }
    frame = requestAnimationFrame(update);
  }
  $('coop-start').onclick = () => requestDeparture('retry', $('coop-start'));
  $('coop-retry').onclick = () => requestDeparture('retry', $('coop-retry'));
  $('coop-resume').onclick = resume;
  $('coop-pause').onclick = pause;
  $('coop-lobby').onclick = () => requestDeparture('setup', $('coop-lobby'));
  function supportGuidance(guidance) {
    $('coop-support-help').textContent = guidance.supportText;
    $('coop-help-support').textContent =
      `${guidance.supportText} A downed player can crawl along ${guidance.groundName} to meet their partner.`;
  }
  function selectedCandidateRow() {
    const level = selectedLevel();
    return candidateJourney?.rows.find((row) => row.pack === pack && row.level === level) ?? null;
  }
  function difficultyControls(level = selectedLevel()) {
    // Compiled Journey packs are immutable preset editions. Changing this menu
    // selects a newly compiled owned edition, never re-projects imported bytes.
    $('coop-difficulty').disabled =
      Boolean(level.journeyDifficulty) &&
      (Boolean(run) || !candidatePreferences || !selectedCandidateRow());
    if (level.journeyDifficulty) $('coop-difficulty').value = level.journeyDifficulty;
  }
  function setupNote({ level = selectedLevel(), experiment = selectedConfiguration() } = {}) {
    difficultyControls(level);
    const guidance = coopArenaGuidance(level, experiment);
    $('coop-closure-help').textContent =
      `Draw a short loop back to ${guidance.groundName} to claim it. Banking stops your craft; steer again for your next cut.`;
    $('coop-intro').textContent = experiment.jointCuts
      ? 'Start with a small loop. Cover each other, then meet to join a larger cut.'
      : `Start with small loops. Cover each other and return to ${guidance.groundName} to bank each line.`;
    $('coop-cut-title').textContent = experiment.jointCuts
      ? 'Join when ready.'
      : 'Bring each line home.';
    $('coop-cut-help').textContent = experiment.jointCuts
      ? 'Steer both moving heads together to bank a shared cut. Crossing an old part of a partner’s line is harmless.'
      : `Return to ${guidance.groundName} to bank your cut. Crossing a partner’s line is harmless; meeting their head does not join your lines.`;
    $('coop-threat-title').textContent = guidance.threatTitle;
    $('coop-threat-help').textContent = guidance.threatText;
    supportGuidance(guidance);
    $('coop-stronghold-help').hidden = !guidance.showStrongholds;
    $('coop-stronghold-title').textContent = guidance.strongholdTitle;
    $('coop-stronghold-copy').textContent = guidance.strongholdText;
    $('coop-menu-goal').textContent = coopGoalText(level);
    $('coop-briefing-title').textContent = guidance.briefingTitle;
    $('coop-stage').textContent = level.name.toUpperCase();
    $('coop-level-note').textContent = guidance.levelNote;
    $('coop-setup-note').textContent = experiment.advancedCooperation
      ? 'Captures recharge both players’ Support and can rescue a downed partner.'
      : 'Comparison: Support refills on its timer. Rescue by holding Support nearby. Captures do not speed either up.';
  }
  function showPackStatus() {
    const candidate = candidateJourney?.rows.some((row) => row.pack === pack);
    const label = `${pack.name} · ${pack.levels.length} levels${packArtworkSource ? ' · Local artwork' : ''}${candidate ? ' · Geometry test · not human validated' : ''}`;
    packStatus.begin({ message: label }).finish({ message: label });
  }
  function showPack(next, preferred = next.levels[0].id, isCurrent = () => true) {
    if (disposed || !isCurrent()) return;
    pack = next;
    const owns = () => !disposed && pack === next && isCurrent();
    $('coop-level').replaceChildren(
      ...pack.levels.map((level) => {
        const option = document.createElement('option');
        option.value = level.id;
        option.textContent = `${level.name} · ${level.goal.cores ? 'stronghold' : 'territory'} challenge`;
        return option;
      }),
    );
    if (!owns()) return;
    $('coop-level').value = preferred;
    if (!owns()) return;
    showPackStatus();
    if (!owns()) return;
    $('coop-pack-reset').hidden = pack === COOP_STARTER_PACK;
    if (owns()) setupNote();
  }
  async function prepareImport(draft, { retry = false, origin = document.activeElement } = {}) {
    if (
      disposed ||
      inactive ||
      !foreground() ||
      run ||
      pictureOperation ||
      departure ||
      importOperation ||
      importAdopting ||
      artworkImports.pending() ||
      importDraft !== draft
    )
      return;
    const request = ++importRequest,
      controller = new AbortController(),
      focus = pictureFocus(
        origin,
        false,
        () => importDraft === draft || pictureSelection === draft.selection,
      );
    const current = () =>
      !disposed &&
      request === importRequest &&
      importOperation === operation &&
      importDraft === draft &&
      !run &&
      !controller.signal.aborted;
    const display = packStatus.begin({
      message: draft.pack
        ? 'Preparing the imported Team picture…'
        : 'Reading the selected Team pack…',
      stage: draft.pack ? 'preparing' : 'reading',
    });
    const operation = { draft, controller, focus, display };
    importOperation = operation;
    importDisplay = display;
    let committed = false;
    $('coop-pack-cancel').hidden = false;
    $('coop-pack-retry').hidden = true;
    try {
      pictureUI();
      if (!draft.pack) {
        if (draft.kind === 'artwork') {
          display.update({ message: 'Checking the Team artwork bundle…', stage: 'verifying' });
          if (!current()) return;
          let source;
          try {
            const preparation = artworkImports.prepare(draft.file, {
              signal: controller.signal,
              onProgress: ({ stage, index, total }) => {
                if (!current()) return;
                display.update({
                  message:
                    stage === 'checking-picture'
                      ? `Checking local artwork ${index + 1} of ${total}…`
                      : stage === 'ready'
                        ? 'Local artwork validated. Preparing the selected arena…'
                        : 'Checking Team arenas and artwork…',
                  stage: 'verifying',
                });
              },
            });
            importControls();
            source = await preparation;
          } finally {
            importControls();
          }
          if (!current()) return;
          draft.artworkSource = source;
          draft.pack = source.pack;
        } else {
          if (draft.file.size > COOP_PACK_MAX_BYTES)
            throw new TypeError('Choose a co-op pack smaller than 1 MiB.');
          const source = await draft.file.text();
          if (!current()) return;
          display.update({ message: 'Checking Team arenas and rules…', stage: 'verifying' });
          if (!current()) return;
          draft.pack = readCoopPack(source);
        }
        if (!packPicker.open) {
          cancelImport();
          return;
        }
        draft.selection = newPictureSelection(
          { level: draft.pack.levels[0] },
          draft.pack,
          draft.pack,
          draft.artworkSource,
        );
      }
      display.update({
        message: 'Preparing the imported Team picture… The selected pack stays available.',
        stage: 'preparing',
      });
      if (!current()) return;
      const snapshot = await (retry ? presentationPage.retry() : presentationPage.ready);
      if (retry && !disposed && snapshot && snapshot === presentationPage.current())
        menuStyle.setPresentation(snapshot);
      if (!current()) return;
      const selection = draft.selection;
      const binding = await selection.lease.select({
        ...selection.request,
        signal: controller.signal,
        onStatus: (status) => {
          if (!current()) return;
          const text = picturePreparationText(status);
          if (text)
            display.update({
              message: `${text} The selected pack is unchanged.`,
              stage: 'preparing',
            });
        },
      });
      if (!current()) return;
      if (!packPicker.open) {
        cancelImport();
        return;
      }
      selection.lease.confirm(selection.request);
      const previous = {
        pack,
        artworkSource: packArtworkSource,
        selection: pictureSelection,
        level: $('coop-level').value,
        message: pictureMessage,
        difficulty: $('coop-difficulty').value,
      };
      const proposedPack = draft.pack,
        proposedArtwork = draft.artworkSource;
      selection.binding = binding;
      selection.state = 'preparing';
      const rollback = () => {
        if (
          committed ||
          pictureSelection !== selection ||
          pack !== proposedPack ||
          packArtworkSource !== proposedArtwork ||
          run ||
          disposed
        )
          return;
        pictureSelection = previous.selection;
        packArtworkSource = previous.artworkSource;
        $('coop-difficulty').value = previous.difficulty;
        showPack(previous.pack, previous.level);
        pictureUI(previous.message);
      };
      // Publish the validated pack and prepared image together. Keep the previous
      // image alive until the new setup has rendered successfully. No Start can
      // use the tentative selection, including from a reentrant DOM callback.
      const ownsCommitted = () =>
        committed &&
        !disposed &&
        request === importRequest &&
        !run &&
        !importOperation &&
        !importDraft &&
        pictureSelection === selection &&
        pack === proposedPack &&
        packArtworkSource === proposedArtwork;
      pictureSelection = selection;
      importAdopting = operation;
      try {
        packArtworkSource = draft.artworkSource;
        showPack(draft.pack, undefined, current);
        if (!current()) {
          rollback();
          return;
        }
        selection.state = 'ready';
        pictureUI(
          draft.artworkSource
            ? 'Local artwork ready. Start remains a separate action.'
            : 'Imported Team picture ready. Start remains a separate action.',
        );
        if (!current()) {
          rollback();
          return;
        }
        if ($('coop-level').value !== selection.levelId)
          throw new Error('The selected arena changed during import. Retry the pack.');
        // Commit and relinquish the old operation without callbacks between
        // them. Once the old source is retired, rollback is no longer valid.
        if (draft.artworkSource) artworkImports.commit(draft.artworkSource);
        else artworkImports.retire(localDiscoveryPack?.artworkSource ?? previous.artworkSource);
        localDiscoveryPack = {
          pack: draft.pack,
          artworkSource: draft.artworkSource,
          rows: discoveryRows(draft.pack, draft.artworkSource, `local-${++localDiscoveryRevision}`),
        };
        committed = true;
        importOperation = null;
        importDisplay = null;
        importDraft = null;
        importAdopting = null;
      } catch (error) {
        rollback();
        throw error;
      } finally {
        if (importAdopting === operation) importAdopting = null;
        // Reset or disposal can replace the tentative setup inside a host
        // callback. The previous image then has no visible owner to retire it.
        if (
          !current() &&
          pictureSelection !== previous.selection &&
          acceptedPicture !== previous.selection
        )
          previous.selection?.lease?.dispose();
        if (
          (importDraft !== draft || draft.selection !== selection) &&
          pictureSelection !== selection &&
          acceptedPicture !== selection
        )
          selection.lease.dispose();
        // Cancellation restores a usable previous setup after the synchronous
        // Start guard is released. A successful adoption renders below instead.
        if (!committed && !disposed && pictureSelection === previous.selection) pictureUI();
      }
      if (!ownsCommitted()) return;
      $('coop-pack-cancel').hidden = true;
      $('coop-pack-retry').hidden = true;
      $('coop-pack-file').value = '';
      if (!ownsCommitted()) return;
      pictureUI();
      if (ownsCommitted()) focus.finish($('coop-start'));
    } catch (error) {
      if (!current()) return;
      importOperation = null;
      importDisplay = null;
      packStatus.begin({ message: 'Team pack unavailable.' }).finish({
        state: 'error',
        message: `Pack unchanged: ${error.message}. Retry pack or choose another file.`,
      });
      $('coop-pack-cancel').hidden = true;
      $('coop-pack-retry').hidden = false;
      pictureUI();
      focus.finish($('coop-pack-retry'));
    } finally {
      focus.finish(null, false);
      if (request === importRequest) $('coop-pack-file').value = '';
      importControls();
      if (
        !disposed &&
        draft.kind === 'artwork' &&
        !artworkImports.pending() &&
        importDraft === draft &&
        draft.cancelledRequest === importRequest &&
        !importOperation
      )
        packStatus.begin({ message: 'Artwork import cancelled.' }).finish({
          state: 'detached',
          message:
            'Artwork import cancelled. The selected pack is unchanged. Retry pack when ready.',
        });
    }
  }
  $('coop-pack-file').onchange = () => {
    if (artworkImports.pending()) {
      $('coop-pack-file').value = '';
      return;
    }
    const file = $('coop-pack-file').files?.[0];
    cancelImport({ forget: true });
    if (!file || run || pictureOperation || departure || disposed) return;
    const kind =
      file.type === COOP_PRESENTATION_MIME || /\.rlteam$/i.test(file.name ?? '')
        ? 'artwork'
        : 'json';
    const draft = { file, kind, pack: null, artworkSource: null, selection: null };
    importDraft = draft;
    $('coop-pack-cancel').textContent = kind === 'artwork' ? 'Cancel import' : 'Stop waiting';
    return importAdopting
      ? Promise.resolve().then(() => prepareImport(draft))
      : prepareImport(draft);
  };
  $('coop-pack-retry').onclick = () => {
    if (importDraft && !artworkImports.pending())
      return prepareImport(importDraft, { retry: true });
  };
  function stopWaiting() {
    cancelImport();
    $('coop-pack-file').value = '';
    $(artworkImports.pending() ? 'coop-level' : 'coop-pack-file').focus({ preventScroll: true });
  }
  $('coop-pack-cancel').onclick = stopWaiting;
  const pickerToggled = () => {
    if (!packPicker.open) cancelImport();
  };
  packPicker.addEventListener('toggle', pickerToggled);
  $('coop-pack-reset').onclick = () => {
    if (run || departure || pictureOperation || disposed) return;
    cancelImport({ forget: true });
    const previousArtwork = artworkImports.current();
    localDiscoveryPack = null;
    packArtworkSource = null;
    showPack(COOP_STARTER_PACK, lastBuiltInArena);
    void preparePicture();
    artworkImports.retire(previousArtwork);
  };
  $('coop-level').onchange = () => {
    if (run || departure || disposed) return;
    cancelImport({ forget: true });
    if (pack === COOP_STARTER_PACK) {
      lastBuiltInArena = selectedLevel().id;
      arenaPreference.choose(lastBuiltInArena);
    }
    setupNote();
    return preparePicture();
  };
  $('coop-experiment').onchange = setupNote;
  $('coop-difficulty').onchange = () => {
    const previous = selectedCandidateRow(),
      requested = $('coop-difficulty').value;
    if (!previous || !candidatePreferences || run || departure || disposed || !foreground()) {
      difficultyControls();
      return;
    }
    const row = candidateJourney.row(previous.mission, requested);
    if (!row) {
      difficultyControls();
      return;
    }
    const ticket = ++candidatePresetIntent,
      previousPack = pack;
    const current = () =>
      !disposed && !run && !departure && foreground() && ticket === candidatePresetIntent;
    cancelImport({ forget: true });
    if (!current() || pack !== previousPack) return;
    candidateDifficulty = requested;
    candidatePreferences.choose(requested);
    if (!current() || pack !== previousPack) return;
    // Retire the old preset before publishing new setup. Reentrant Start must
    // never pair a new compiled level with the previous edition's image lease.
    retirePicture();
    if (!current() || pack !== previousPack) return;
    pictureUI('Preparing the selected Journey difficulty…');
    if (!current() || pack !== previousPack) return;
    packArtworkSource = null;
    showPack(row.pack, row.level.id, current);
    if (!current() || pack !== row.pack) return;
    return preparePicture();
  };
  // The classic entry owns intent before the select becomes interactive.
  // Without that evidence, retain native setup rather than override a choice.
  const earlySelection = globalThis.RevealLineTeamEntry?.take();
  const validArena = (id) => COOP_STARTER_PACK.levels.some((level) => level.id === id);
  if (!earlySelection || earlySelection.claimed) {
    const selected = earlySelection?.changed ? earlySelection.value : $('coop-level').value;
    lastBuiltInArena = validArena(selected) ? selected : COOP_STARTER_PACK.levels[0].id;
    if (earlySelection?.changed && validArena(selected)) arenaPreference.choose(selected);
  }
  // Keep the existing option nodes and an already-correct native value while a
  // player may have the platform's selector open during module preparation.
  if (candidateJourney && !earlySelection?.claimed) {
    const first = candidateJourney.catalog.missions.find((mission) =>
      candidateJourney.isCore(mission.id),
    );
    const row =
      candidateProgress?.initial(candidateDifficulty) ??
      candidateJourney.row(first, candidateDifficulty);
    showPack(row.pack, row.level.id);
  } else if ($('coop-level').value !== lastBuiltInArena) $('coop-level').value = lastBuiltInArena;
  showPackStatus();
  setupNote();
  $('coop-touch').value = 'auto';
  $('coop-touch').onchange = () => {
    input.clearPhysical();
    showTouch();
    if (running()) input.focus();
  };
  const touchChanged = () => showTouch();
  touchQuery.addEventListener?.('change', touchChanged);
  placeTools(false);
  $('coop-reduced').onchange = () => {
    displayPreferences.set({ reducedEffects: $('coop-reduced').checked });
    if (running()) input.focus();
  };
  let unsubscribeNative = () => {};
  onNativeInactive(suspend)
    .then((unsubscribe) => {
      if (disposed) unsubscribe();
      else unsubscribeNative = unsubscribe;
    })
    .catch((error) => console.error('Native lifecycle unavailable:', error));
  const dispose = () => {
    if (disposed) return;
    discoveryStarted = null;
    discovery?.dispose();
    cancelDiscoveryPreparation();
    $('coop-discovery-open').onclick = null;
    $('coop-discovery-paused').onclick = null;
    automaticRetry = null;
    document.removeEventListener('focusin', retryFocusChanged);
    cancelNext({ announce: false });
    $('coop-next').onclick = null;
    $('coop-next-cancel').onclick = null;
    $('coop-journey-skip').onclick = null;
    $('coop-journey-skip-confirm').onclick = null;
    document.removeEventListener('focusin', skipFocusChanged);
    // Retire dialog callbacks before native close or preference disposal can
    // reenter. No terminal cleanup restores focus or resumes the attempt.
    settingsOwner = null;
    settingsVisit++;
    earnedOwner = null;
    $('coop-view-picture').onclick = null;
    $('coop-picture-return').onclick = null;
    earnedDialog.removeEventListener('close', earnedClosed);
    earnedDialog.removeEventListener('cancel', earnedCancelled);
    earnedDialog.removeEventListener('keydown', settingsKeydown);
    if (earnedDialog.open) earnedDialog.close();
    earnedCanvas.width = earnedCanvas.height = 0;
    $('coop-settings-open').onclick = null;
    $('coop-settings-close').onclick = null;
    settingsDialog.removeEventListener('cancel', cancelSettings);
    settingsDialog.removeEventListener('close', settingsClosed);
    settingsDialog.removeEventListener('keydown', settingsKeydown);
    settingsPanels.destroy();
    if (settingsDialog.open) settingsDialog.close();
    // The shared page may already have retired its painter snapshot. Stop the
    // core without repainting during terminal cleanup. BFCache uses suspend.
    if (running()) pauseCoop(run);
    cancelImport({ forget: true });
    cancelDeparture({ restore: false });
    retirePicture();
    acceptedPicture?.lease?.dispose();
    acceptedPicture = null;
    artworkImports.dispose();
    packArtworkSource = null;
    localDiscoveryPack = null;
    presentationPage.close();
    closeAudio();
    closeDisplay();
    arenaPreference.dispose();
    candidateProgress?.dispose();
    candidatePreferences?.dispose();
    candidatePreferenceRestoration?.dispose();
    importRequest++;
    disposed = true;
    packStatus.dispose();
    packPicker.removeEventListener('toggle', pickerToggled);
    cancelAnimationFrame(frame);
    clear();
    input.destroy();
    router.destroy();
    reading.destroy();
    navigation.destroy();
    touchQuery.removeEventListener?.('change', touchChanged);
    window.removeEventListener('resize', revealPausedAction);
    window.removeEventListener('blur', suspend);
    window.removeEventListener('focus', returned);
    window.removeEventListener('pageshow', returned);
    document.removeEventListener('visibilitychange', hidden);
    unsubscribeNative();
  };
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      dispose();
      return;
    }
    cancelImport();
    suspend();
  });
  window.addEventListener('pageshow', returned);
  function attachJourneyRecovery(owner, prefix, label, filename) {
    let exportSequence = 0;
    owner?.subscribe(({ ready = true, durable, error }) => {
      if (disposed) return;
      const notice = $(prefix),
        focus = document.activeElement,
        ownedFocus = !notice.hidden && notice.contains(focus),
        attempt = run,
        epoch = generation;
      notice.hidden = !ready || durable || !error;
      if (disposed) return;
      $(`${prefix}-message`).textContent = error
        ? `${label} is session-only. Retry saving or export before closing. ${error}`
        : '';
      if (
        ownedFocus &&
        notice.hidden &&
        !disposed &&
        foreground() &&
        !running() &&
        run === attempt &&
        generation === epoch &&
        (document.activeElement === focus || unclaimedFocus(document.activeElement))
      ) {
        const target = primary();
        if (visibleAction(target)) target.focus({ preventScroll: true });
      }
    });
    $(`${prefix}-retry`).onclick = () => {
      if (!disposed) {
        exportSequence++;
        void owner?.retry();
      }
    };
    $(`${prefix}-export`).onclick = async () => {
      if (disposed || !owner) return;
      const ticket = ++exportSequence;
      try {
        const result = await exportJSONFile(JSON.parse(owner.export()), filename);
        if (!disposed && ticket === exportSequence && !$(prefix).hidden)
          $(`${prefix}-message`).textContent = `${label} is session-only. ${result.message}`;
      } catch (error) {
        if (!disposed && ticket === exportSequence && !$(prefix).hidden)
          $(`${prefix}-message`).textContent =
            `Export failed: ${error.message}. Your session choice or progress is still here.`;
      }
    };
  }
  attachJourneyRecovery(
    candidateProgress,
    'coop-journey-save',
    'Team Journey progress',
    'revealline-journey-progress.json',
  );
  attachJourneyRecovery(
    candidatePreferences,
    'coop-journey-preferences',
    'Journey difficulty',
    'revealline-journey-difficulty.json',
  );
  candidatePreferenceRestoration = candidatePreferences
    ? attachPreferenceRestoration({
        window,
        getSnapshot: () => (run ? attemptLevel : selectedLevel()),
        render: (level) => {
          if (!disposed) difficultyControls(level);
        },
      })
    : null;
  $('coop-start').disabled = false;
  $('coop-start').textContent = 'Start together →';
  bootDisplay.finish({
    message: candidateJourney
      ? `Team Journey geometry test · twelve missions · human validation and original artwork pending. ${candidatePreferences ? '' : candidateNotice}`.trim()
      : 'Two players · one screen · a shared victory',
  });
  document.documentElement.dataset.toolState = 'ready';
  startPermitted = !$('coop-start').disabled;
  void preparePicture({
    initial: initialFocusPending,
    origin: initialFocusPending ? document.activeElement : null,
  });
  if (initialFocusPending && unclaimedFocus(document.activeElement) && foreground())
    navigation.focusAvailable();
  initialFocusPending = false;
  frame = requestAnimationFrame(update);
  return { dispose };
}

try {
  document.addEventListener('focusin', initialFocusChoice, true);
  document.addEventListener('visibilitychange', initialVisibility);
  window.addEventListener('blur', initialFocusLost);
  const journeyRequests = new URL(location.href).searchParams.getAll('journey');
  let candidateEntry;
  if (journeyRequests.length === 1 && journeyRequests[0] === 'team-greybox') {
    const { createTeamGreyboxEntry } = await import('../content-design/team-entry.mjs');
    candidateEntry = await createTeamGreyboxEntry();
  }
  bootCoop(candidateEntry);
} catch (error) {
  document.documentElement.dataset.toolState = 'error';
  bootDisplay.finish({ state: 'error', message: `Could not start Relay Rescue: ${error.message}` });
  console.error(error);
} finally {
  initialFocusPending = false;
  document.removeEventListener('focusin', initialFocusChoice, true);
  document.removeEventListener('visibilitychange', initialVisibility);
  window.removeEventListener('blur', initialFocusLost);
}
