import {
  createCoop,
  startCoop,
  pauseCoop,
  resumeCoop,
  releaseCoopInputs,
  stepCoop,
  FIXED_DT,
} from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD, COOP_PLAYTEST_CONFIGURATIONS } from '../coop/relay-yard.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { createCoopPainter } from './coop-view.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { onNativeInactive } from '../platform.mjs';
import { createCoopCommandBatch, COOP_INPUT_CAPABILITIES } from '../coop/input-policy.mjs';

const $ = (id) => document.getElementById(id);
const names = ['Sunflower', 'Skyline'];
const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function bootCoop() {
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
  let menuHint = '';
  const running = () => run?.status === 'running';
  const scope = () => (running() ? 'flight' : run ? `coop-${run.status}` : 'coop-lobby');
  const primary = () =>
    !run
      ? $('coop-start')
      : run.status === 'paused' && !loopStopped
        ? $('coop-resume')
        : $('coop-retry');
  const input = attachCouchInput({
    ...COOP_INPUT_CAPABILITIES,
    arena: $('coop-canvas'),
    active: running,
    continuousSteering: () => true,
    getGamepads: () => framePads,
    onPause: () => pause(),
    onPads: (count) => {
      const text = `${count} controller${count === 1 ? '' : 's'} connected${menuHint ? ` · ${menuHint}` : ''}`;
      if ($('coop-pads').textContent !== text) $('coop-pads').textContent = text;
    },
  });
  const router = createControllerRouter({ readPads: () => framePads });
  const navigation = attachControllerNavigation({
    getScope: scope,
    getRoot: () => (run ? $('coop-overlay') : $('coop-menu')),
    getDefaultFocus: primary,
    keyboard: true,
    onBack: () => {
      if (run?.status === 'paused') resume();
    },
    onMenu: () => {
      if (run?.status === 'paused') resume();
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
    $('coop-pause').disabled = !running();
    if (!show) return;
    const won = run.status === 'won',
      lost = run.status === 'lost';
    $('coop-resume').hidden = won || lost;
    $('coop-overlay-kicker').textContent = won
      ? 'A WORLD YOU REVEALED TOGETHER'
      : lost
        ? 'ONE MORE SHARED PLAN'
        : 'TAKE A BREATH';
    $('coop-overlay-title').textContent = won
      ? 'You brought it home.'
      : lost
        ? 'Your next route starts here.'
        : 'Both players paused';
    $('coop-overlay-copy').textContent = won
      ? `${(run.coverage * 100).toFixed(1)}% revealed together in ${clock(run.time)}. Try another route or compare individual cuts.`
      : lost
        ? `You revealed ${(run.coverage * 100).toFixed(1)}%. Agree on a shorter exposed route, save Support for the warning, or move closer for a rescue.`
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
    const stronghold = run.strongholds?.[0];
    $('coop-objective').textContent = stronghold
      ? stronghold.defeated
        ? 'Stronghold secured together'
        : stronghold.shielded
          ? `Capture the shield anchors · ${stronghold.anchors.filter((anchor) => anchor.captured).length} / 2 secured`
          : 'Shield down · make a new cut that captures the exposed core'
      : 'Reveal 65% together';
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
    const experiment =
      COOP_PLAYTEST_CONFIGURATIONS.find((item) => item.id === $('coop-experiment').value) ||
      COOP_PLAYTEST_CONFIGURATIONS[0];
    clear();
    const level = $('coop-level').value === RELAY_YARD.id ? RELAY_YARD : FIRST_CONNECTION;
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
        ? 'Try a cut from opposite edges. Agree on a meeting point first.'
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
    clear();
    run = null;
    document.body.classList.remove('playing');
    $('coop-play').hidden = true;
    $('coop-menu').hidden = false;
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
        input.clearPlayer(event.player);
        batch.release(event.player);
        message(
          `${names[event.player]} needs a rescue. Hold Support nearby${run.config.advancedCooperation ? ' or capture 2% new territory' : ''}.`,
        );
      }
      if (event.type === 'player.revived') {
        input.clearPlayer(event.player);
        batch.release(event.player);
        message(`${names[event.player]} is back. Choose a fresh direction.`);
      }
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
    const stronghold = $('coop-level').value === RELAY_YARD.id;
    $('coop-stronghold-help').hidden = !stronghold;
    $('coop-menu-goal').textContent = stronghold
      ? 'Capture both anchors, then the exposed core'
      : 'Reveal 65% of the field';
    $('coop-briefing-title').textContent = stronghold
      ? 'TAKE THE STRONGHOLD TOGETHER'
      : 'YOUR FIRST CONNECTION';
    $('coop-setup-note').textContent =
      $('coop-experiment').value === 'full'
        ? 'Captures recharge both players’ Support and can rescue a downed partner.'
        : 'Comparison: Support refills on its timer. Rescue by holding Support nearby. Captures do not speed either up.';
  }
  $('coop-level').onchange = setupNote;
  $('coop-experiment').onchange = setupNote;
  setupNote();
  $('coop-touch').checked = matchMedia('(pointer: coarse)').matches;
  const showTouch = () =>
    document.querySelectorAll('.race-pad').forEach((pad) => {
      pad.hidden = !$('coop-touch').checked;
    });
  $('coop-touch').onchange = () => {
    input.clearPhysical();
    showTouch();
    if (running()) input.focus();
  };
  showTouch();
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
    disposed = true;
    cancelAnimationFrame(frame);
    clear();
    input.destroy();
    router.destroy();
    navigation.destroy();
    unsubscribeNative();
  };
  window.addEventListener('pagehide', () => pause());
  window.addEventListener('pageshow', () => {
    last = null;
  });
  $('coop-start').disabled = false;
  $('coop-start').textContent = 'Start together →';
  $('coop-boot').textContent = 'Two players · one screen · a shared victory';
  frame = requestAnimationFrame(update);
  return { dispose };
}

try {
  bootCoop();
} catch (error) {
  $('coop-boot').textContent = `Could not start Relay Rescue: ${error.message}`;
  console.error(error);
}
