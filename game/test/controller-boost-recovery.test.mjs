import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  recordInput,
  verifyReplay,
} from '../replay.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachInput, gamepadCommand } from '../ui/input.mjs';
import {
  cancelControllerToggleBoost,
  controllerBoostAfterRecovery,
} from '../ui/controller-boost-host.mjs';

// Only browser event targets are substituted. Input composition, controller
// ownership, recovery, fixed steps and recorded-command verification are real.
class Target {
  constructor() {
    this.listeners = new Map();
    this.attributes = new Map();
    this.captures = new Set();
    this.classList = { toggle() {} };
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }
  emit(type, values = {}) {
    const event = {
      target: this,
      key: '',
      code: '',
      repeat: false,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...values,
    };
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  closest() {
    return null;
  }
  focus() {}
  setAttribute(key, value) {
    this.attributes.set(key, value);
  }
  setPointerCapture(id) {
    this.captures.add(id);
  }
  hasPointerCapture(id) {
    return this.captures.has(id);
  }
  releasePointerCapture(id) {
    this.captures.delete(id);
    this.emit('lostpointercapture', { pointerId: id });
  }
}

const causes = {
  failure: { classId: 'scout', event: 'player.failed', lives: 2 },
  shield: { classId: 'interceptor', event: 'shield.absorbed', lives: 3 },
  impact: { classId: 'impact', event: 'craft.redeployed', lives: 3 },
};
function sourceFor(kind) {
  return {
    version: 'xonix-level.v1',
    id: 'boost-recovery',
    revision: '1',
    width: 48,
    height: 36,
    spawn: { x: 6.5, y: 0.5 },
    goal: { coverage: 1 },
    enemies: [
      {
        id: 'contact',
        type: 'bouncer',
        x: kind === 'impact' ? 38.5 : 6.5,
        y: kind === 'impact' ? 28.5 : 1.5,
        vx: 0,
        vy: 0,
      },
    ],
    rules: { respawnSeconds: 0.1, graceSeconds: 1 },
  };
}
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`);

function fixture(t, { kind = 'failure', turnPolicy = 'immediate', boostMode = 'toggle' } = {}) {
  const saved = new Map(
    ['window', 'document', 'navigator'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const win = new Target(),
    arena = new Target(),
    boost = new Target(),
    stop = new Target(),
    level = sourceFor(kind),
    options = { classId: causes[kind].classId, turnPolicy },
    run = createRun(level, options),
    recorder = createRecorder(level, options, 'controller-boost-recovery-test'),
    pad = {
      index: 0,
      id: 'Recovery fixture',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    },
    counters = { hardware: 0, input: 0, canonical: 0, clear: 0, local: 0 };
  let frame = null,
    active = true,
    clock = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      querySelectorAll: () => [],
      querySelector: (selector) =>
        ({ '#boost-button': boost, '#stop-button': stop })[selector] || null,
    },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      getGamepads() {
        assert.fail('Injected input must not poll hardware independently.');
      },
    },
  });
  const controller = createControllerRouter({
    ...(boostMode === 'default' ? {} : { boostMode }),
    readPads: () => {
      counters.hardware++;
      return [pad];
    },
    eventTarget: win,
  });
  const realInput = attachInput({
    arena,
    active: () => active,
    tapMode: () => true,
    onClear: () => {
      counters.clear++;
      cancelControllerToggleBoost(controller, frame);
    },
    readControllerCommand: () => {
      counters.canonical++;
      return frame?.flight;
    },
  });
  const input = {
    ...realInput,
    poll() {
      counters.input++;
      return realInput.poll();
    },
    localBoostActive() {
      counters.local++;
      return realInput.localBoostActive();
    },
  };
  t.after(() => {
    realInput.destroy();
    controller.destroy();
    for (const [key, descriptor] of saved)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
  });
  const sample = (scope = 'flight') => {
    frame = controller.sample({
      scope,
      timeMs: ++clock,
      toggleBoostEligible: run.status === 'running',
    });
    return frame;
  };
  const press = (...indices) => {
    pad.buttons.forEach((button, index) => {
      button.pressed = indices.includes(index);
      button.value = button.pressed ? 1 : 0;
    });
  };
  const join = (scope = 'flight') => {
    press();
    sample(scope);
    input.poll();
    press(0);
    assert.equal(sample(scope).status.code, 'joined');
    input.poll();
    press();
    sample(scope);
    input.poll();
  };
  const tick = (controls) => {
    const command = Object.freeze({ ...controls });
    const beforeStatus = run.status;
    stepRun(run, command, FIXED_DT);
    const next = controllerBoostAfterRecovery({
      beforeStatus,
      run,
      controller,
      input,
      frame,
      controls,
    });
    recordInput(recorder, command);
    return { command, next, beforeStatus, events: [...run.events] };
  };
  const warmup = () => {
    if (kind !== 'impact') return;
    press(13);
    sample();
    const controls = input.poll();
    for (let index = 0; index < 12; index++) tick(controls);
    assert.equal(run.status, 'running');
    assert.equal(run.player.cutting, true, 'Impact must abandon a real live cut.');
    assert.ok(run.trail.length > 0);
    press();
    sample();
    input.poll();
  };
  return {
    run,
    level,
    options,
    recorder,
    controller,
    input,
    counters,
    pad,
    win,
    arena,
    boost,
    stop,
    sample,
    press,
    join,
    tick,
    warmup,
    setActive(value) {
      active = value;
    },
    get frame() {
      return frame;
    },
    local(kind) {
      if (kind === 'keyboard')
        win.emit('keydown', { target: arena, code: 'ShiftLeft', key: 'Shift' });
      if (kind === 'touch') {
        boost.emit('pointerdown', { pointerId: 7, button: 0 });
        boost.emit('pointerup', { pointerId: 7, button: 0 });
      }
    },
  };
}

function beginBoostFrame(f, kind, local = 'none') {
  f.local(local);
  f.press(13, 5, ...(kind === 'failure' ? [] : [0]));
  f.sample();
  const controls = Object.freeze(f.input.poll());
  assert.equal(controls.boost, true);
  assert.equal(controls.direction, 'down');
  return controls;
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  for (const [kind, expected] of Object.entries(causes)) {
    for (const local of ['none', 'keyboard', 'touch']) {
      test(`${turnPolicy}: ${kind} cancels Toggle within one frame and preserves ${local} Boost`, (t) => {
        const f = fixture(t, { kind, turnPolicy });
        f.join();
        f.warmup();
        const startTick = f.run.tick,
          startTime = f.run.time,
          beforeFrame = { ...f.counters },
          original = beginBoostFrame(f, kind, local),
          afterPoll = { ...f.counters },
          results = [];
        let controls = original,
          accumulator = 0.25;
        while (accumulator + 1e-9 >= FIXED_DT) {
          const result = f.tick(controls);
          results.push(result);
          controls = result.next;
          accumulator -= FIXED_DT;
        }
        assert.equal(f.counters.hardware, beforeFrame.hardware + 1);
        assert.equal(f.counters.input, beforeFrame.input + 1);
        assert.equal(f.counters.canonical, beforeFrame.canonical + 1);
        assert.equal(f.counters.hardware, afterPoll.hardware);
        assert.equal(f.counters.input, afterPoll.input);
        assert.equal(f.counters.local, afterPoll.local + 1);
        assert.equal(f.counters.clear, afterPoll.clear, 'Recovery must not globally clear input.');
        assert.equal(results.length, 30);
        assert.equal(f.run.tick - startTick, 30);
        near(f.run.time - startTime, 0.25);
        near(accumulator, 0);
        const recovery = results.findIndex((result) =>
          result.events.some((event) => event.type === expected.event),
        );
        const returned = results.findIndex((result) =>
          result.events.some((event) => event.type === 'player.respawned'),
        );
        assert.ok(recovery >= 0 && returned > recovery && returned < 29);
        assert.equal(results[recovery].command.boost, true);
        assert.equal(original.boost, true, 'Never mutate the recovery-causing sampled command.');
        for (const result of results.slice(recovery + 1)) {
          assert.equal(result.command.boost, local !== 'none');
          assert.equal(result.command.direction, original.direction);
          assert.equal(result.command.action, original.action);
          assert.equal(result.command.pickup, original.pickup);
        }
        assert.equal(f.run.status, 'running');
        assert.equal(f.run.lives, expected.lives);
        assert.deepEqual(f.controller.boostState(), { mode: 'toggle', latched: false });
        assert.equal(f.frame.flight.boost, false);
        assert.equal(f.input.localBoostActive(), local !== 'none');
        const replay = exportReplay(f.recorder, f.run);
        assert.equal(verifyReplay(replay).match, true);
        const recorded = replay.segments.flatMap((segment) =>
          Array.from({ length: segment.ticks }, () => segment.input),
        );
        assert.deepEqual(
          recorded.slice(startTick).map((command) => command.boost),
          results.map((result) => result.command.boost),
        );
        assert.equal(replay.releaseAfter, false);
        assert.ok(replay.segments.every((segment) => !segment.releaseBefore));
        // Recovery ending in this render frame cannot turn a held button back on.
        assert.equal(f.sample().flight.boost, false);
        assert.equal(f.input.poll().boost, local !== 'none');
        f.press();
        assert.equal(f.sample().flight.boost, false);
        f.input.poll();
        f.press(5);
        assert.equal(f.sample().flight.boost, true);
      });
    }

    test(`${turnPolicy}: default Hold ${kind} matches the legacy command oracle through recovery`, (t) => {
      const f = fixture(t, { kind, turnPolicy, boostMode: 'default' });
      f.join();
      f.warmup();
      const oracle = createRun(f.level, f.options);
      for (const segment of f.recorder.segments)
        for (let index = 0; index < segment.ticks; index++)
          stepRun(oracle, segment.input, FIXED_DT);
      const controls = beginBoostFrame(f, kind),
        legacy = gamepadCommand(f.pad),
        oracleCommand = {
          direction: legacy.direction,
          boost: legacy.boost,
          action: legacy.action,
          pickup: legacy.pickup,
        },
        before = { ...f.counters },
        events = [];
      assert.deepEqual(controls, oracleCommand);
      for (let index = 0; index < 30; index++) {
        const result = f.tick(controls);
        events.push(...result.events);
        assert.equal(result.next, controls, 'Hold recovery must retain the exact controls object.');
        stepRun(oracle, oracleCommand, FIXED_DT);
        assert.deepEqual(authoritativeCheckpoint(f.run), authoritativeCheckpoint(oracle));
      }
      assert.ok(events.some((event) => event.type === expected.event));
      assert.ok(events.some((event) => event.type === 'player.respawned'));
      assert.equal(f.run.status, 'running');
      assert.equal(f.frame.flight.boost, true);
      assert.deepEqual(f.controller.boostState(), { mode: 'hold', latched: false });
      assert.deepEqual(
        f.counters,
        before,
        'Hold host hook must not poll, clear or read local state.',
      );
      assert.equal(verifyReplay(exportReplay(f.recorder, f.run)).match, true);
    });
  }

  test(`${turnPolicy}: presses made during real impact recovery do not queue a later Toggle`, (t) => {
    const f = fixture(t, { kind: 'impact', turnPolicy });
    f.join();
    f.warmup();
    const result = f.tick(beginBoostFrame(f, 'impact'));
    assert.equal(f.run.status, 'respawning');
    assert.equal(result.next.boost, false);
    f.press();
    assert.equal(f.sample().flight.boost, false);
    f.input.poll();
    f.press(5);
    assert.equal(f.sample().flight.boost, false);
    const controls = f.input.poll();
    for (let index = 0; index < 15; index++) f.tick(controls);
    assert.equal(f.run.status, 'running');
    assert.equal(
      f.sample().flight.boost,
      false,
      'A held recovery press cannot activate on return.',
    );
    f.input.poll();
    f.press();
    f.sample();
    f.input.poll();
    f.press(5);
    assert.equal(f.sample().flight.boost, true);
  });
}

test('real input clears cancel a Toggle without recursive clears or starving Ready join', (t) => {
  const f = fixture(t);
  f.setActive(false);
  f.join('ready');
  assert.equal(f.counters.clear, 3, 'One local clear per inactive poll, without recursion.');
  f.press(0);
  assert.equal(f.sample('ready').ui.confirm, true);
  f.input.poll();
  f.press();
  f.setActive(true);
  f.sample('flight');
  f.input.poll();
  f.press(5);
  f.sample();
  assert.equal(f.input.poll().boost, true);
  const reads = f.counters.hardware,
    beforeClear = f.counters.clear;
  f.stop.emit('click');
  assert.equal(f.counters.clear, beforeClear + 1);
  assert.equal(f.counters.hardware, reads);
  assert.equal(f.frame.flight.boost, false);
  assert.deepEqual(f.controller.boostState(), { mode: 'toggle', latched: false });
  f.press();
  f.sample();
  assert.equal(f.input.poll().boost, false);
  f.press(5);
  assert.equal(f.sample().flight.boost, true, 'Stop does not cause a latched-neutral deadlock.');
  assert.equal(f.input.poll().boost, true);
});
