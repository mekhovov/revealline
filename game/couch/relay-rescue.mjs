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
import { coopFailureFeedback, coopRetryFeedback } from './coop-feedback.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { onNativeInactive } from '../platform.mjs';
import { createCoopCommandBatch, COOP_INPUT_CAPABILITIES } from '../coop/input-policy.mjs';
import { createOperationStatus } from '../ui/operation-status.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { createAudioPreferences } from '../audio-preferences.mjs';

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
  $('coop-race').setAttribute(
    'href',
    teamReturnHref({ href: location.href, storage: returnStorage }),
  );
  $('coop-race').textContent = fromSolo ? 'Back to Solo' : 'Race mode ↗';
  const audioMaster = createAudioMaster();
  const audioPreferences = createAudioPreferences({
    audioMaster,
    window,
    getStorage: () => localStorage,
    onWarning: (message) => {
      $('coop-audio-status').textContent = message;
    },
  });
  const stopMasterView = audioMaster.subscribe(({ muted, volume }) => {
    $('coop-audio').textContent = muted ? 'Unmute sound' : 'Mute sound';
    $('coop-audio').setAttribute('aria-pressed', String(!muted));
    $('coop-master-volume').value = volume;
  });
  $('coop-audio').onclick = () => audioPreferences.setMuted(!audioMaster.snapshot().muted);
  $('coop-master-volume').onchange = () =>
    audioPreferences.setVolume(Number($('coop-master-volume').value));
  const closeAudio = () => {
    stopMasterView();
    audioPreferences.dispose();
    audioMaster.dispose();
  };
  const painter = createCoopPainter($('coop-canvas'));
  const batch = createCoopCommandBatch();
  let loopStopped = false;
  let run = null,
    accumulator = 0,
    last = null,
    framePads = [],
    frame = null,
    disposed = false;
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
  let menuHint = '';
  const touchQuery = matchMedia('(any-pointer: coarse)');
  const tools = $('coop-tools');
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
    const destination = $(paused ? 'coop-pause-tools' : 'coop-lobby-tools');
    if (tools.parentNode !== destination) destination.append(tools);
    tools.hidden = running();
    if (tools.hidden) {
      $('coop-help').open = false;
      $('coop-options').open = false;
    }
    showTouch();
  }
  function back() {
    if (importDisplay) {
      stopWaiting();
      return;
    }
    const details =
      document.activeElement?.closest('details') || tools.querySelector('details[open]');
    if (details?.open && tools.contains(details)) {
      details.open = false;
      details.querySelector('summary')?.focus({ preventScroll: true });
    } else if (run?.status === 'paused') $('coop-resume').focus({ preventScroll: true });
    else if (run) lobby();
    else $('coop-race').click();
  }
  const running = () => run?.status === 'running';
  const scope = () => (running() ? 'flight' : run ? `coop-${run.status}` : 'coop-lobby');
  const primary = () =>
    !run
      ? $('coop-start')
      : run.status === 'paused' && !loopStopped
        ? $('coop-resume')
        : $('coop-retry');
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
    getRoot: () => (run ? $('coop-overlay') : $('coop-app')),
    accept: (element) => !element.closest('.race-pad'),
    getDefaultFocus: primary,
    keyboard: true,
    onBack: back,
    onMenu: () => {
      if (run?.status === 'paused') back();
    },
    onHint: (message) => {
      menuHint = message;
    },
  });
  function clear() {
    input.clear();
    batch.release();
    router.clear();
    navigation.clear();
    if (run) releaseCoopInputs(run);
    accumulator = 0;
  }
  function message(text) {
    if ($('coop-message').textContent !== text) $('coop-message').textContent = text;
  }
  function overlay() {
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
    primary().focus({ preventScroll: true });
  }
  function render() {
    if (!run) return;
    painter.paint(run, { reduced: $('coop-reduced').checked });
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
  function start() {
    cancelImport();
    importRequest++;
    $('coop-pack-file').value = '';
    const experiment = selectedConfiguration();
    clear();
    knockdowns = [null, null];
    const level = selectedLevel();
    run = createCoop(level, {
      seed: 17,
      difficulty: $('coop-difficulty').value,
      jointCuts: experiment.jointCuts,
      assistCaptures: experiment.assistCaptures,
      advancedCooperation: experiment.advancedCooperation,
    });
    startCoop(run);
    document.body.classList.add('playing');
    $('coop-menu').hidden = true;
    $('coop-play').hidden = false;
    $('coop-stage').textContent = level.name.toUpperCase();
    $('coop-progress').max = level.goal.coverage ? level.goal.coverage * 100 : 100;
    message(
      experiment.jointCuts
        ? 'Watch the Hunter warnings. Cover a crossing or join after the charge passes.'
        : 'Comparison: head meetings do not join lines. Find a route back to safe ground.',
    );
    overlay();
    render();
    input.focus();
    if (loopStopped) {
      loopStopped = false;
      last = null;
    }
  }
  function pause() {
    if (!running()) return;
    pauseCoop(run);
    clear();
    overlay();
    render();
  }
  function resume() {
    if (run?.status !== 'paused' || loopStopped) return;
    clear();
    resumeCoop(run);
    last = null;
    overlay();
    input.focus();
    message('Choose fresh directions when you are ready.');
  }
  function lobby() {
    cancelImport();
    importRequest++;
    clear();
    run = null;
    document.body.classList.remove('playing');
    $('coop-play').hidden = true;
    $('coop-menu').hidden = false;
    showPackStatus();
    placeTools(false);
    $('coop-start').focus({ preventScroll: true });
  }
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
      loopStopped = true;
      if (running()) {
        pauseCoop(run);
        clear();
      }
      overlay();
      $('coop-resume').hidden = true;
      $('coop-overlay-title').textContent = 'The arena needs a fresh start';
      $('coop-overlay-copy').textContent = 'Retry resets this attempt. Your setup stays the same.';
      $('coop-retry').focus({ preventScroll: true });
      $('coop-boot').textContent = `Arena stopped: ${error.message}`;
      message(`Arena stopped: ${error.message}. Return to setup to retry.`);
      console.error(error);
    }
    frame = requestAnimationFrame(update);
  }
  $('coop-start').onclick = start;
  $('coop-retry').onclick = start;
  $('coop-resume').onclick = resume;
  $('coop-pause').onclick = pause;
  $('coop-lobby').onclick = lobby;
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
    if (!file || run) return;
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
      if (!document.hidden && document.hasFocus() && document.activeElement === origin)
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
    cancelImport();
    importRequest++;
    showPack(COOP_STARTER_PACK, RELAY_YARD.id);
    $('coop-start').focus({ preventScroll: true });
  };
  $('coop-level').onchange = setupNote;
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
  $('coop-help-read').onclick = () =>
    navigation.beginReading({
      region: $('coop-help-reading'),
      origin: $('coop-help-read'),
      label: 'Relay Rescue controls',
    });
  placeTools(false);
  $('coop-reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('coop-reduced').onchange = () => {
    if (running()) input.focus();
  };
  let unsubscribeNative = () => {};
  onNativeInactive(pause)
    .then((unsubscribe) => {
      if (disposed) unsubscribe();
      else unsubscribeNative = unsubscribe;
    })
    .catch((error) => console.error('Native lifecycle unavailable:', error));
  const dispose = () => {
    closeAudio();
    importRequest++;
    disposed = true;
    packStatus.dispose();
    packPicker.removeEventListener('toggle', pickerToggled);
    cancelAnimationFrame(frame);
    clear();
    input.destroy();
    router.destroy();
    navigation.destroy();
    touchQuery.removeEventListener?.('change', touchChanged);
    unsubscribeNative();
  };
  window.addEventListener('pagehide', (event) => {
    cancelImport();
    pause();
    if (!event.persisted) closeAudio();
  });
  window.addEventListener('pageshow', () => {
    last = null;
  });
  $('coop-start').disabled = false;
  $('coop-start').textContent = 'Start together →';
  bootDisplay.finish({ message: 'Two players · one screen · a shared victory' });
  document.documentElement.dataset.toolState = 'ready';
  if (
    initialFocusPending &&
    unclaimedFocus(document.activeElement) &&
    !document.hidden &&
    document.hasFocus?.() !== false
  )
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
