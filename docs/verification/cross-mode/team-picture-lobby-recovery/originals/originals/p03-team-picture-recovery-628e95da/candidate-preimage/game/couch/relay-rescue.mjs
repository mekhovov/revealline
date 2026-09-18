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
import { RELAY_YARD, COOP_PLAYTEST_CONFIGURATIONS } from '../coop/relay-yard.mjs';
import { COOP_STARTER_PACK, readCoopPack, coopGoalText } from '../coop/library.mjs';
import { COOP_PACK_MAX_BYTES } from '../coop/recipes.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { createCoopPainter } from './coop-view.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';
import { createCoopPresentation } from './coop-presentation.mjs';
import { COOP_PICTURE_BINDINGS } from './coop-picture-bindings.mjs';
import { decodeCoopPicture } from './coop-picture-image.mjs';
import { coopFailureFeedback, coopRetryFeedback } from './coop-feedback.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { attachControllerReading } from '../ui/controller-reading.mjs';
import { readingInputPrompt } from '../ui/reading-input-prompt.mjs';
import { nextInputModality } from '../input-presentation.mjs';
import { onNativeInactive } from '../platform.mjs';
import { createCoopCommandBatch, COOP_INPUT_CAPABILITIES } from '../coop/input-policy.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { attachMenuStyleControls } from '../ui/menu-style-controls.mjs';
import { attachPreferenceRestoration } from '../ui/preference-restoration.mjs';
import { attachSettingsPanels, settingsTabOwnsKey } from '../ui/settings-panels.mjs';

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

export function bootCoop() {
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
  let settingsOwner = null,
    settingsVisit = 0,
    settingsPanels = null;
  let acceptedPicture = null,
    pictureSelection = null,
    pictureOperation = null,
    pictureSequence = 0,
    startPermitted = true;
  const foreground = () => !document.hidden && document.hasFocus?.() !== false;
  let inactive = !foreground();
  let previousPads = new Map();
  let pack = COOP_STARTER_PACK;
  let importRequest = 0;
  const packStatus = createOperationStatus($('coop-pack-status'), { isCurrent: () => !disposed });
  const packPicker = $('coop-pack-file').closest('details');
  let importDisplay = null;
  function cancelImport() {
    if (!importDisplay) return;
    importDisplay.finish({
      state: 'detached',
      message: 'Stopped waiting. The selected pack is unchanged.',
    });
    importDisplay = null;
    importRequest++;
    $('coop-pack-cancel').hidden = true;
    $('coop-pack-file').value = '';
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
    if (settingsDialog.open) {
      closeSettings();
      return;
    }
    if (departure) {
      cancelDeparture();
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
    settingsDialog.open
      ? `coop-settings:${settingsPanels?.selected() || 'display'}`
      : departure
        ? 'coop-discard'
        : running()
          ? 'flight'
          : run
            ? `coop-${run.status}`
            : 'coop-lobby';
  const primary = () =>
    settingsDialog.open
      ? settingsPanels?.primary() || $('coop-settings-close')
      : departure
        ? $('coop-discard-stay')
        : pictureOperation
          ? $('coop-picture-cancel')
          : !run && pictureSelection?.state !== 'ready'
            ? $('coop-picture-retry')
            : !run
              ? $('coop-start')
              : run.status === 'paused' && !loopStopped
                ? $('coop-resume')
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
      settingsDialog.open
        ? settingsDialog
        : departure
          ? departureDialog
          : run
            ? $('coop-overlay')
            : $('coop-app'),
    accept: (element) => !element.closest('.race-pad'),
    getDefaultFocus: primary,
    keyboard: true,
    ownsKeyboardEvent: (event) => settingsTabOwnsKey(event, settingsDialog),
    nativeReadingScroll: true,
    getReadingPrompt: readingPrompt,
    onNativeInput: (event) => setReadingModality(nextInputModality(readingModality, event)),
    onBack: back,
    onMenu: () => {
      if (settingsDialog.open || departure || run?.status === 'paused') back();
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
  function openSettings() {
    const opener = $('coop-settings-open');
    if (disposed || departure || settingsDialog.open || !foreground() || !visibleAction(opener))
      return;
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
  function message(text) {
    if ($('coop-message').textContent !== text) $('coop-message').textContent = text;
  }
  function overlay({ focus = true } = {}) {
    const show = run && !running();
    $('coop-overlay').hidden = !show;
    placeTools(Boolean(show));
    $('coop-pause').disabled = !running();
    if (!show) return;
    const won = run.status === 'won',
      lost = run.status === 'lost';
    $('coop-resume').hidden = won || lost;
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
    $('coop-overlay-copy').textContent = won
      ? `${(run.coverage * 100).toFixed(1)}% revealed together in ${clock(run.time)}. ${run.team.jointCuts} Joint Cuts, ${run.team.rescues} rescues and ${run.team.interceptions} intercepted sparks. Try another level or a harder challenge.`
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
    for (const player of run.players) {
      $('coop-state-' + player.id).textContent =
        player.status === 'downed'
          ? run.team.reserves === 0
            ? 'Down · free rescue available'
            : `Rescue · ${Math.max(0, Math.ceil(player.downedUntil - run.time))}s`
          : player.cutting
            ? 'Line exposed'
            : player.graceUntil > run.time
              ? 'Recovery shield · safe ground only'
              : 'On safe ground';
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
          ? 'Crawl along safe ground toward your partner'
          : recharge > 0
            ? `Support recharging · ${recharge.toFixed(1)}s`
            : 'Support ready · tap to cover, hold nearby to rescue';
    }
  }
  // This focus lifetime is local to one picture action. Native disabling may
  // move its opener to BODY; a later deliberate choice or loss of foreground
  // permanently vetoes the completion handoff.
  function pictureFocus(origin, initial = false) {
    let moved = false,
      shifting = false,
      pending = null;
    const beforeScope = scope();
    const started =
      document.activeElement === origin &&
      (visibleAction(origin) || (initial && unclaimedFocus(origin)));
    const observe = (event) => {
      if (!shifting && !unclaimedFocus(event.target) && event.target !== origin) moved = true;
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
    const owns = () =>
      !disposed &&
      started &&
      !moved &&
      foreground() &&
      scope() === beforeScope &&
      (document.activeElement === origin ||
        document.activeElement === pending ||
        unclaimedFocus(document.activeElement));
    const close = () => {
      document.removeEventListener('focusin', observe);
      document.removeEventListener('pointerdown', lost, true);
      document.removeEventListener('keydown', lost, true);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('blur', lost);
    };
    return {
      pending(target) {
        if (!owns() || !visibleAction(target)) return;
        pending = target;
        shifting = true;
        try {
          target.focus({ preventScroll: true });
        } finally {
          shifting = false;
        }
      },
      finish(target, current = true) {
        close();
        if (!current || !owns()) return;
        if (typeof target === 'function') target();
        else if (visibleAction(target)) target.focus({ preventScroll: true });
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
      name = selection?.pack.levels.find((level) => level.id === selection.levelId)?.name;
    $('coop-preview-caption').textContent = name
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
    $('coop-start').disabled = !startPermitted || !ready || busy;
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
  function newPictureSelection(recipe, sourcePack) {
    return {
      sourcePack,
      pack: structuredClone(sourcePack),
      levelId: recipe.level.id,
      request: {
        pack: structuredClone(sourcePack),
        levelId: recipe.level.id,
        themeId: 'fpv',
        attemptId: `team-${++pictureSequence}`,
      },
      lease:
        sourcePack.id === COOP_STARTER_PACK.id
          ? createCoopPresentation({
              bindings: COOP_PICTURE_BINDINGS,
              getSnapshot: presentationPage.current,
              readPicture: presentationPage.readPicture,
              decodeImage: decodeCoopPicture,
            })
          : null,
      binding: null,
      state: 'new',
    };
  }
  function preparePicture({
    retry = false,
    origin = document.activeElement,
    initial = false,
  } = {}) {
    if (disposed || departure || importDisplay || running()) return Promise.resolve();
    if (!retry || !pictureSelection) {
      retirePicture();
      pictureSelection = newPictureSelection(currentRecipe(), run ? attemptPack : pack);
    }
    const selection = pictureSelection;
    if (pictureOperation) return pictureOperation.promise;
    // Other imported namespaces retain the explicitly named legacy procedural
    // path. The starter namespace always requires the closed exact binding.
    if (!selection.lease) {
      selection.state = 'ready';
      pictureUI('Imported Team pack · procedural arena. Start remains a separate action.');
      return Promise.resolve();
    }
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
        await presentationPage.ready;
        if (!current()) return;
        const binding = await selection.lease.select({
          ...selection.request,
          signal: controller.signal,
          onStatus: (status) => {
            if (current()) pictureUI(status.message);
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
        selection.state = 'error';
        pictureOperation = null;
        pictureUI(
          `Team picture unavailable: ${error.message} Retry picture or choose another arena.`,
        );
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
  function currentRecipe() {
    if (run)
      return {
        level: structuredClone(attemptLevel),
        options: { seed: run.seed, difficulty: run.difficulty, ...run.config },
      };
    const experiment = selectedConfiguration();
    return {
      level: selectedLevel(),
      options: {
        seed: 17,
        difficulty: $('coop-difficulty').value,
        jointCuts: experiment.jointCuts,
        assistCaptures: experiment.assistCaptures,
        advancedCooperation: experiment.advancedCooperation,
      },
    };
  }
  function start(recipe = currentRecipe(), prepared = null) {
    if (
      disposed ||
      inactive ||
      departure ||
      pictureOperation ||
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
    cancelImport();
    importRequest++;
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
    pictureUI();
    generation++;
    startCoop(run);
    document.body.classList.add('playing');
    $('coop-menu').hidden = true;
    $('coop-play').hidden = false;
    $('coop-stage').textContent = level.name.toUpperCase();
    $('coop-progress').max = level.goal.coverage ? level.goal.coverage * 100 : 100;
    message(
      run.config.jointCuts
        ? 'Watch the Hunter warnings. Cover a crossing or join after the charge passes.'
        : 'Comparison: head meetings do not join lines. Find a route back to safe ground.',
    );
    overlay();
    try {
      render();
    } catch (error) {
      stopArena(error);
      return;
    }
    input.focus();
    if (loopStopped) {
      loopStopped = false;
      last = null;
    }
  }
  function pause({ focus = true } = {}) {
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
    // Never repaint while handling a painter failure. Any destructive decision
    // is cancelled before showing the stopped attempt's recovery actions.
    loopStopped = true;
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
      settingsDialog.open ||
      run?.status !== 'paused' ||
      loopStopped
    )
      return;
    cancelPicture({ restore: false });
    clear();
    resumeCoop(run);
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
    if (disposed || departure) return;
    const focus = lobbyFocus();
    try {
      cancelImport();
      importRequest++;
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
      placeTools(false);
      if (retainedPicture?.sourcePack === pack && retainedPicture.levelId === selectedLevel().id) {
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
    if (
      disposed ||
      departure ||
      settingsDialog.open ||
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
      `Team progress is only kept on this page; this attempt is not saved. ${
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
  const suspend = () => {
    if (disposed) return;
    if (settingsOwner) settingsOwner.restore = false;
    inactive = true;
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
  };
  const hidden = () => {
    if (document.hidden) suspend();
    else returned();
  };
  window.addEventListener('blur', suspend);
  window.addEventListener('focus', returned);
  document.addEventListener('visibilitychange', hidden);
  function events() {
    for (const event of run.events) {
      if (event.type === 'cut.closed') {
        input.clearPlayer(event.player);
        batch.release(event.player);
      }
      if (event.type === 'cut.joint')
        message('Joint Cut! Both lines are safe. Choose your next route together.');
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
            clear();
            overlay();
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
  function setupNote() {
    const level = selectedLevel();
    const experiment = selectedConfiguration();
    const stronghold = Boolean(level.goal.cores);
    $('coop-intro').textContent = experiment.jointCuts
      ? 'Start with a small loop. Cover each other, then meet to join a larger cut.'
      : 'Start with small loops. Cover each other and return to safe ground to bank each line.';
    $('coop-cut-title').textContent = experiment.jointCuts
      ? 'Join when ready.'
      : 'Bring each line home.';
    $('coop-cut-help').textContent = experiment.jointCuts
      ? 'Steer both moving heads together to bank a shared cut. Crossing an old part of a partner’s line is harmless.'
      : 'Return to safe ground to bank your cut. Crossing a partner’s line is harmless; meeting their head does not join your lines.';
    $('coop-stronghold-help').hidden = !stronghold;
    $('coop-menu-goal').textContent = coopGoalText(level);
    $('coop-briefing-title').textContent = stronghold
      ? 'TAKE THE STRONGHOLD TOGETHER'
      : 'MAKE YOUR COMMON GROUND';
    $('coop-stage').textContent = level.name.toUpperCase();
    $('coop-level-note').textContent =
      pack !== COOP_STARTER_PACK
        ? stronghold
          ? 'Plan routes to the anchors, then make a later cut through each exposed core.'
          : 'Create safe routes together. Use the revealed ground to launch your next cut.'
        : stronghold
          ? 'One open field. Bait a Hunter, cover the crossing, then take the anchors together.'
          : 'Both halves are contested. Create safe routes in small steps, then coordinate a larger cut.';
    $('coop-setup-note').textContent = experiment.advancedCooperation
      ? 'Captures recharge both players’ Support and can rescue a downed partner.'
      : 'Comparison: Support refills on its timer. Rescue by holding Support nearby. Captures do not speed either up.';
  }
  function showPackStatus() {
    packStatus
      .begin({ message: `${pack.name} · ${pack.levels.length} levels` })
      .finish({ message: `${pack.name} · ${pack.levels.length} levels` });
  }
  function showPack(next, preferred = next.levels[0].id) {
    pack = next;
    $('coop-level').replaceChildren(
      ...pack.levels.map((level) => {
        const option = document.createElement('option');
        option.value = level.id;
        option.textContent = `${level.name} · ${level.goal.cores ? 'stronghold' : 'territory'} challenge`;
        return option;
      }),
    );
    $('coop-level').value = preferred;
    showPackStatus();
    $('coop-pack-reset').hidden = pack === COOP_STARTER_PACK;
    setupNote();
  }
  $('coop-pack-file').onchange = async () => {
    const file = $('coop-pack-file').files?.[0];
    cancelImport();
    const request = ++importRequest;
    if (!file || run || pictureOperation || departure || disposed) return;
    const origin = document.activeElement;
    const current = () => !disposed && request === importRequest && !run;
    const display = packStatus.begin({
      message: 'Reading the selected Team pack…',
      stage: 'reading',
      isCurrent: current,
    });
    importDisplay = display;
    $('coop-pack-cancel').hidden = false;
    try {
      if (file.size > COOP_PACK_MAX_BYTES)
        throw new TypeError('Choose a co-op pack smaller than 1 MiB.');
      const source = await file.text();
      if (!current()) return;
      if (!packPicker.open) {
        cancelImport();
        return;
      }
      display.update({ message: 'Checking Team arenas and rules…', stage: 'verifying' });
      const next = readCoopPack(source);
      if (!current()) return;
      showPack(next);
      importDisplay = null;
      await preparePicture({ origin });
      if (
        current() &&
        !document.hidden &&
        document.hasFocus() &&
        document.activeElement === origin &&
        visibleAction($('coop-start'))
      )
        $('coop-start').focus({ preventScroll: true });
    } catch (error) {
      if (current())
        display.finish({ state: 'error', message: `Pack unchanged: ${error.message}` });
    } finally {
      if (request === importRequest) {
        importDisplay = null;
        $('coop-pack-cancel').hidden = true;
        $('coop-pack-file').value = '';
      }
    }
  };
  function stopWaiting() {
    cancelImport();
    $('coop-pack-file').value = '';
    $('coop-pack-file').focus({ preventScroll: true });
  }
  $('coop-pack-cancel').onclick = stopWaiting;
  const pickerToggled = () => {
    if (!packPicker.open) cancelImport();
  };
  packPicker.addEventListener('toggle', pickerToggled);
  $('coop-pack-reset').onclick = () => {
    if (run || departure || pictureOperation || disposed) return;
    cancelImport();
    importRequest++;
    showPack(COOP_STARTER_PACK, RELAY_YARD.id);
    void preparePicture();
  };
  $('coop-level').onchange = () => {
    if (run || departure || importDisplay) return;
    setupNote();
    return preparePicture();
  };
  $('coop-experiment').onchange = setupNote;
  showPack(COOP_STARTER_PACK, RELAY_YARD.id);
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
    // Retire dialog callbacks before native close or preference disposal can
    // reenter. No terminal cleanup restores focus or resumes the attempt.
    settingsOwner = null;
    settingsVisit++;
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
    cancelImport();
    cancelDeparture({ restore: false });
    retirePicture();
    acceptedPicture?.lease?.dispose();
    acceptedPicture = null;
    presentationPage.close();
    closeAudio();
    closeDisplay();
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
  $('coop-start').disabled = false;
  $('coop-start').textContent = 'Start together →';
  bootDisplay.finish({ message: 'Two players · one screen · a shared victory' });
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
  bootCoop();
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
