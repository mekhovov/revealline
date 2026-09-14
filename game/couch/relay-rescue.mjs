import {
  createCoop,
  startCoop,
  pauseCoop,
  resumeCoop,
  releaseCoopInputs,
  stepCoop,
  FIXED_DT,
} from '../coop/core.mjs';
import { FIRST_CONNECTION, COOP_EXPERIMENTS } from '../coop/first-connection.mjs';
import { attachCouchInput } from './couch-input.mjs';
import { createCoopPainter } from './coop-view.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { onNativeInactive } from '../platform.mjs';
import { createCoopCommandBatch } from '../coop/input-policy.mjs';

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
        ? `You reached ${(run.coverage * 100).toFixed(1)}%. Watch where the enemies committed, then choose a meeting point with a safer approach.`
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
    for (const player of run.players) {
      $('coop-state-' + player.id).textContent =
        player.status === 'downed'
          ? 'Awaiting recovery'
          : player.cutting
            ? 'Line exposed'
            : 'On safe ground';
    }
  }
  function start() {
    const experiment =
      COOP_EXPERIMENTS.find((item) => item.id === $('coop-experiment').value) ||
      COOP_EXPERIMENTS[0];
    clear();
    run = createCoop(FIRST_CONNECTION, {
      seed: 17,
      difficulty: $('coop-difficulty').value,
      jointCuts: experiment.jointCuts,
      assistCaptures: experiment.assistCaptures,
    });
    startCoop(run);
    $('coop-menu').hidden = true;
    $('coop-play').hidden = false;
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
        message(`${names[event.player]} was hit. Their partner can keep the current cut going.`);
      }
      if (event.type === 'player.revived') {
        input.clearPlayer(event.player);
        batch.release(event.player);
        message(`${names[event.player]} is back. Choose a fresh direction.`);
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
  $('coop-touch').checked = matchMedia('(pointer: coarse)').matches;
  const showTouch = () =>
    document.querySelectorAll('.race-pad').forEach((pad) => {
      pad.hidden = !$('coop-touch').checked;
    });
  $('coop-touch').onchange = () => {
    input.clearPhysical();
    showTouch();
  };
  showTouch();
  $('coop-reduced').checked = matchMedia('(prefers-reduced-motion: reduce)').matches;
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
