import test from 'node:test';
import assert from 'node:assert/strict';
import { attachDemoClock } from '../ui/demo-clock.mjs';

function harness({ hidden = false, frames = true, messages = true, advance, state } = {}) {
  const doc = new EventTarget();
  doc.hidden = hidden;
  doc.hasFocus = () => false;
  let time = 0,
    serial = 0,
    audio = 0,
    closedPorts = 0;
  const tasks = new Map(),
    queued = [],
    advances = [],
    paints = [];
  const playback = state ?? { phase: 'playing' };
  const add = (kind, fn, delay = null) => {
    const id = ++serial;
    tasks.set(id, { kind, fn, delay });
    return id;
  };
  class Channel {
    constructor() {
      this.port1 = { onmessage: null, close: () => closedPorts++ };
      this.port2 = {
        close: () => closedPorts++,
        postMessage: (data) => queued.push(() => this.port1.onmessage?.({ data })),
      };
    }
  }
  const clock = attachDemoClock({
    document: doc,
    window: {},
    now: () => time,
    requestFrame: frames ? (fn) => add('frame', fn) : undefined,
    cancelFrame: (id) => tasks.delete(id),
    setTimer: (fn, delay) => add('timer', fn, delay),
    clearTimer: (id) => tasks.delete(id),
    MessageChannelClass: messages ? Channel : undefined,
    getPlaybackState: () => playback,
    advance: (seconds, meta) => {
      advances.push({ seconds, ...meta });
      advance?.(seconds, meta, playback);
    },
    paint: (seconds) => paints.push(seconds),
    updateAudio: () => audio++,
  });
  return {
    clock,
    doc,
    playback,
    tasks,
    queued,
    advances,
    paints,
    get audio() {
      return audio;
    },
    get closedPorts() {
      return closedPorts;
    },
    elapse(ms) {
      time += ms;
    },
    wake(ms = 16, kind) {
      time += ms;
      assert.ok(tasks.size >= 1 && tasks.size <= 2, 'Only one ordinary wake owns the clock.');
      assert.ok([...tasks.values()].filter((task) => task.kind === 'frame').length <= 1);
      assert.ok([...tasks.values()].filter((task) => task.kind === 'timer').length <= 1);
      const selected = kind
        ? [...tasks].find(([, task]) => task.kind === kind)
        : tasks.entries().next().value;
      assert.ok(selected, `A pending ${kind ?? 'ordinary'} wake is required.`);
      const [id, task] = selected;
      tasks.delete(id);
      task.fn();
      return task;
    },
    drain() {
      let count = 0;
      while (queued.length) {
        assert.ok(++count <= 8, 'A catch-up burst must be finite.');
        queued.shift()();
      }
      return count;
    },
  };
}

test('visible spectator clock ignores focus, keeps one owner and emits fresh ordinary frames', () => {
  const h = harness();
  h.clock.start();
  h.clock.start();
  assert.equal(h.tasks.values().next().value.kind, 'frame');
  assert.equal(h.tasks.size, 2, 'The same visible wake also owns a bounded timer fallback.');
  h.wake(16);
  assert.deepEqual(h.advances, [{ seconds: 0.016, fresh: true }]);
  assert.equal(h.paints.length, 1);
  assert.equal(h.audio, 1);
  h.clock.destroy();
  assert.equal(h.tasks.size, 0);
});

test('withheld visible RAF cannot stop spectator simulation, recap rotation, audio or painting', () => {
  let simulation = 0,
    sceneTime = 0,
    scenes = 0;
  const h = harness({
    advance: (seconds, _meta, state) => {
      simulation += seconds;
      sceneTime += seconds;
      if (state.phase === 'playing' && sceneTime >= 2) {
        sceneTime = 0;
        state.phase = 'complete';
      } else if (state.phase === 'complete' && sceneTime >= 0.5) {
        sceneTime = 0;
        scenes++;
        state.phase = 'playing';
      }
    },
  });
  h.clock.start();
  const staleFrame = [...h.tasks.values()].find((task) => task.kind === 'frame').fn;
  assert.equal(h.doc.hidden, false);
  assert.equal(h.doc.hasFocus(), false);
  // Deliver timers alone for longer than the historical apparent stall. This
  // reproduces the scheduling boundary, not its unproven physical cause.
  for (let elapsed = 0; elapsed < 160000; elapsed += 250) h.wake(250, 'timer');
  assert.equal(simulation, 160);
  assert.equal(scenes, 64);
  assert.equal(h.audio, 640);
  assert.equal(h.paints.length, 640);
  assert.ok(h.advances.every(({ seconds, fresh }) => seconds === 0.25 && !fresh));
  staleFrame();
  assert.equal(h.advances.length, 640, 'A delayed RAF cannot replay the admitted elapsed time.');
  h.wake(16, 'frame');
  assert.deepEqual(h.advances.at(-1), { seconds: 0.016, fresh: true });
  h.clock.destroy();
  assert.equal(h.tasks.size, 0);
});

for (const winner of ['frame', 'timer']) {
  test(`${winner} wins the visible wake once and retires its queued sibling`, () => {
    const h = harness();
    h.clock.start();
    const stale = [...h.tasks.values()].find((task) => task.kind !== winner).fn;
    h.wake(winner === 'frame' ? 16 : 250, winner);
    const before = { advances: h.advances.length, paints: h.paints.length, audio: h.audio };
    stale();
    assert.deepEqual(
      { advances: h.advances.length, paints: h.paints.length, audio: h.audio },
      before,
    );
    assert.equal(h.tasks.size, 2, 'Only the next visible wake remains.');
    h.clock.destroy();
    assert.equal(h.tasks.size, 0);
  });
}

test('visible timer recovery preserves explicit pause and pumps audio without stale effects', () => {
  const h = harness();
  h.clock.start();
  h.wake(250, 'timer');
  assert.equal(h.advances[0].fresh, false, 'Recovery cannot trigger a burst of old game effects.');
  h.playback.phase = 'paused';
  h.clock.reset();
  for (let wake = 0; wake < 4; wake++) h.wake(1000, 'timer');
  assert.equal(h.advances.length, 1);
  assert.equal(h.audio, 5);
  assert.equal(h.paints.length, 5);
  h.playback.phase = 'playing';
  h.clock.reset();
  h.wake(16, 'frame');
  assert.deepEqual(h.advances.at(-1), { seconds: 0.016, fresh: true });
  h.clock.destroy();
  assert.equal(h.tasks.size, 0);
});

for (const boundary of ['reset', 'visibilitychange', 'freeze', 'stop', 'destroy']) {
  test(`${boundary} invalidates both pending visible callbacks`, () => {
    const h = harness();
    h.clock.start();
    const stale = [...h.tasks.values()].map((task) => task.fn);
    h.elapse(60000);
    if (boundary === 'visibilitychange') {
      h.doc.hidden = true;
      h.doc.dispatchEvent(new Event(boundary));
    } else h.clock[boundary]();
    for (const callback of stale) callback();
    assert.equal(h.advances.length, 0);
    assert.equal(h.audio, 0);
    assert.equal(h.paints.length, 0);
    assert.equal(h.tasks.size, boundary === 'reset' ? 2 : boundary === 'visibilitychange' ? 1 : 0);
    if (boundary === 'visibilitychange') {
      h.wake(50);
      assert.equal(h.paints.length, 0, 'The fallback cannot paint after the page becomes hidden.');
      assert.deepEqual(h.advances, [{ seconds: 0.05, fresh: true }]);
    } else if (boundary === 'freeze') {
      h.clock.resume();
      h.wake(16, 'frame');
      assert.deepEqual(h.advances, [{ seconds: 0.016, fresh: true }]);
    }
    h.clock.destroy();
    assert.equal(h.tasks.size, 0);
  });
}

for (const delay of [1000, 60000]) {
  test(`${delay}ms hidden delay admits at most two seconds with one quarter-second per task`, () => {
    const h = harness({ hidden: true });
    h.clock.start();
    assert.equal(h.tasks.values().next().value.delay, 50);
    h.wake(delay);
    assert.deepEqual(h.advances, [{ seconds: 0.25, fresh: false }]);
    assert.equal(h.tasks.size, 0);
    h.drain();
    assert.equal(
      h.advances.reduce((sum, event) => sum + event.seconds, 0),
      Math.min(2, delay / 1000),
    );
    assert.ok(h.advances.every((event) => event.seconds <= 0.25 && !event.fresh));
    assert.equal(h.paints.length, 0);
    assert.equal(h.tasks.values().next().value.delay, 50);
    h.clock.destroy();
    assert.equal(h.closedPorts, 2);
  });
}

test('visibility switches invalidate stale RAF and message callbacks without double stepping', () => {
  const h = harness();
  h.clock.start();
  const staleFrame = h.tasks.values().next().value.fn;
  h.doc.hidden = true;
  h.doc.dispatchEvent(new Event('visibilitychange'));
  staleFrame();
  assert.equal(h.advances.length, 0);
  h.wake(1000);
  const staleMessage = h.queued.shift();
  h.doc.hidden = false;
  h.doc.dispatchEvent(new Event('visibilitychange'));
  staleMessage();
  h.wake(16);
  assert.equal(h.advances.length, 2);
  assert.deepEqual(h.advances.at(-1), { seconds: 0.016, fresh: true });
  assert.equal(h.tasks.values().next().value.kind, 'frame');
  h.clock.destroy();
});

test('explicit pause stops catch-up while audio and visible painting continue until close', () => {
  const h = harness({
    advance: (_seconds, _meta, state) => {
      state.phase = 'paused';
    },
  });
  h.clock.start();
  h.wake(1000);
  h.drain();
  assert.equal(h.advances.length, 1);
  h.wake(1000);
  assert.equal(h.advances.length, 1);
  assert.equal(h.audio, 2);
  assert.equal(h.paints.length, 2);
  h.doc.hidden = true;
  h.doc.dispatchEvent(new Event('visibilitychange'));
  h.wake(60000);
  assert.equal(h.audio, 3);
  assert.equal(h.advances.length, 1, 'Backgrounding never overrides explicit pause.');
  h.clock.stop();
  assert.equal(h.tasks.size, 0);
  h.clock.destroy();
});

test('loading and freeze discard debt; resume preserves paused intent and resets timestamps', () => {
  const h = harness({ hidden: true });
  h.clock.start();
  h.wake(1000);
  h.playback.phase = 'loading';
  h.drain();
  h.wake(60000);
  h.playback.phase = 'playing';
  h.wake(50);
  assert.equal(h.advances.length, 1, 'Loading duration cannot become gameplay time.');
  h.wake(50);
  assert.equal(h.advances.at(-1).seconds, 0.05);
  const oldWake = h.tasks.values().next().value.fn;
  h.doc.dispatchEvent(new Event('freeze'));
  h.elapse(60000);
  oldWake();
  assert.equal(h.tasks.size, 0);
  h.playback.phase = 'paused';
  h.doc.dispatchEvent(new Event('resume'));
  h.wake(50);
  assert.equal(h.advances.length, 2);
  h.playback.phase = 'playing';
  h.clock.reset();
  h.wake(50);
  assert.equal(h.advances.at(-1).seconds, 0.05);
  h.clock.destroy();
});

test('planner budget reserves a boundary without polling or spinning and cannot bank unlimited debt', () => {
  const h = harness({
    hidden: true,
    state: { phase: 'playing', maxAdvanceSeconds: 0.01 },
    advance: (_seconds, _meta, state) => {
      state.maxAdvanceSeconds = 0;
    },
  });
  h.clock.start();
  h.wake(60000);
  assert.equal(h.advances.length, 1);
  assert.equal(h.advances[0].seconds, 0.01);
  assert.equal(h.queued.length, 0);
  h.wake(60000);
  assert.equal(h.advances.length, 1);
  h.playback.maxAdvanceSeconds = 0.2;
  h.wake(50);
  assert.equal(h.advances.at(-1).seconds, 0.2);
  assert.equal(h.advances.at(-1).fresh, false);
  h.clock.destroy();
});

test('fallback timer works without RAF or MessageChannel and stale work cannot survive destroy', () => {
  const h = harness({ frames: false, messages: false });
  h.clock.start();
  assert.equal(h.tasks.values().next().value.delay, 16);
  h.wake(1000);
  assert.equal(h.tasks.values().next().value.delay, 0);
  const stale = h.tasks.values().next().value.fn;
  h.clock.destroy();
  stale();
  h.clock.start();
  h.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.advances.length, 1);
  assert.equal(h.tasks.size, 0);
});

test('close during an advance cancels the remaining burst and does not schedule another owner', () => {
  const h = harness({ advance: () => h.clock.stop() });
  h.clock.start();
  h.wake(60000);
  h.drain();
  assert.equal(h.advances.length, 1);
  assert.equal(h.tasks.size, 0);
  assert.equal(h.paints.length, 0);
  h.clock.destroy();
});

test('clock samples never move its elapsed origin backward', () => {
  const h = harness();
  h.clock.start();
  h.wake(100);
  h.wake(-50);
  h.wake(70);
  assert.deepEqual(
    h.advances.map(({ seconds }) => seconds),
    [0.1, 0.02],
  );
  h.clock.destroy();
});

test('two accelerated hours rotate hidden scenes across focus, pause and freeze generations', () => {
  let simulation = 0,
    sceneTime = 0,
    scenes = 0;
  const h = harness({
    hidden: true,
    advance: (seconds, _meta, state) => {
      simulation += seconds;
      sceneTime += seconds;
      if (state.phase === 'playing' && sceneTime >= 12) {
        sceneTime = 0;
        state.phase = 'complete';
      } else if (state.phase === 'complete' && sceneTime >= 4) {
        sceneTime = 0;
        scenes++;
        state.phase = 'playing';
      }
    },
  });
  h.clock.start();
  for (let iteration = 0; simulation < 7200; iteration++) {
    assert.ok(iteration < 8000);
    if (iteration % 100 === 0) {
      h.doc.hidden = !h.doc.hidden;
      h.doc.dispatchEvent(new Event('visibilitychange'));
      h.clock.freeze();
      h.elapse(60000);
      h.clock.resume();
    }
    if (iteration % 150 === 0) {
      const phase = h.playback.phase,
        before = simulation;
      h.playback.phase = 'paused';
      h.clock.reset();
      h.wake(60000);
      h.drain();
      assert.equal(simulation, before);
      h.playback.phase = phase;
      h.clock.reset();
    }
    h.wake(1000);
    h.drain();
  }
  assert.equal(simulation, 7200);
  assert.equal(scenes, 450);
  assert.ok(h.advances.every(({ seconds }) => seconds <= 0.25));
  h.clock.destroy();
  assert.equal(h.tasks.size, 0);
  assert.equal(h.closedPorts, 2);
});
