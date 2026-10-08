import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightClock,
  createOverflightInputGate,
  OVERFLIGHT_STEP_SECONDS,
  createOverflightRendererOwner,
  createOverflightContextGuard,
  overflightPreviewRequest,
  createOverflightReviewPlayback,
  createOverflightKeyboardState,
  createOverflightJSONPages,
} from '../overflight/host-loop.mjs';
import { createOverflightAudio, overflightMusicContext } from '../overflight/audio.mjs';
import { emptySoundtrackLibrary, resolveSoundtrackSelection } from '../soundtrack.mjs';
import {
  createOverflightRun,
  startOverflight,
  pauseOverflight,
  resumeOverflight,
} from '../overflight/core.mjs';
import { DEFAULT_OVERFLIGHT_PROJECT, compileOverflightProject } from '../overflight/project.mjs';
import { OVERFLIGHT_COPY } from '../overflight/copy.mjs';
import { createOverflightReviewRecorder } from '../overflight/review-recorder.mjs';

test('one fixed clock scales every simulation system and keeps paused time out of the run', () => {
  const clock = createOverflightClock();
  const observed = [];
  clock.advance(0, true, (dt) => observed.push(dt));
  for (let frame = 1; frame <= 60; frame++)
    clock.advance((frame * 1000) / 60, true, (dt) => observed.push(dt));
  assert.equal(observed.length, 60);
  assert.ok(observed.every((dt) => dt === OVERFLIGHT_STEP_SECONDS));
  clock.advance(7000, false, () => assert.fail('pause stepped'));
  clock.advance(7017, true, (dt) => observed.push(dt));
  assert.equal(observed.length, 61);
  clock.slowResume(8000);
  let scaled = 0;
  for (let frame = 1; frame <= 45; frame++)
    clock.advance(8000 + (frame * 1000) / 60, true, () => scaled++);
  assert.equal(scaled, 28);
  assert.ok(Math.abs(scaled / 60 + clock.stats().accumulator - 0.46875) < 1e-9);
});

test('an upgrade stops catch-up on that exact step and a hitch never requests automatic pause', () => {
  const clock = createOverflightClock();
  clock.advance(0, true, () => {});
  let steps = 0;
  clock.advance(1000, true, () => {
    steps++;
    return false;
  });
  assert.equal(steps, 1);
  assert.equal(clock.stats().accumulator, 0);
  assert.ok(clock.stats().droppedSeconds >= 0.75);
  clock.advance(1017, true, () => steps++);
  assert.equal(steps, 2);
});

test('modal and controller inputs stay blocked until a physical neutral observation', () => {
  const gate = createOverflightInputGate();
  assert.deepEqual(gate.sample({ x: 1, boost: true, neutral: false }), {
    x: 0,
    y: 0,
    boost: false,
  });
  assert.deepEqual(gate.sample({ neutral: true }), { x: 0, y: 0, boost: false });
  const direction = gate.sample({ x: 1, y: 1, boost: true, neutral: false });
  assert.ok(Math.abs(Math.hypot(direction.x, direction.y) - 1) < 1e-10);
  assert.equal(direction.boost, true);
  gate.release();
  assert.equal(gate.sample({ x: 1, neutral: false }).x, 0);
});

test('keyboard focus loss forgets missed keyup but rejects repeats until a fresh press', () => {
  const keyboard = createOverflightKeyboardState(),
    gate = createOverflightInputGate();
  keyboard.press('KeyW');
  keyboard.press('Space');
  assert.equal(keyboard.size, 2);
  keyboard.clear();
  gate.release();
  keyboard.press('KeyW', true);
  keyboard.press('Space', true);
  assert.equal(keyboard.size, 0);
  gate.sample({ neutral: keyboard.size === 0 });
  keyboard.press('KeyD');
  assert.equal(gate.sample({ x: keyboard.has('KeyD') ? 1 : 0 }).x, 1);
  keyboard.release('KeyD');
  assert.equal(keyboard.size, 0);
});

test('raw measurement pages stay bounded and reconstruct the complete untruncated receipt', () => {
  const snapshot = {
    frames: Array.from({ length: 2000 }, (_, tick) => ({ tick, milliseconds: 1000 / 60 })),
  };
  const pages = createOverflightJSONPages(snapshot, 4096);
  const chunks = Array.from({ length: pages.count }, (_, index) => pages.page(index));
  assert.ok(chunks.every((chunk) => chunk.length <= 4096));
  assert.deepEqual(JSON.parse(chunks.join('')), snapshot);
  assert.equal(chunks.join(''), pages.json);
  assert.throws(() => pages.page(pages.count), RangeError);
});

test('the shared audio adapter emits bounded semantic cues once per tick', () => {
  const heard = [];
  const sound = { encounter: (...args) => heard.push(args), feedbackDirector: { reset() {} } };
  const audio = createOverflightAudio(sound);
  const run = {
    tick: 4,
    player: { x: 100 },
    events: [{ type: 'impact', x: 120 }, { type: 'impact', x: 130 }, { type: 'pickup' }],
  };
  audio.update(run);
  audio.update(run);
  assert.deepEqual(
    heard.map(([cue]) => cue),
    ['impact', 'supply'],
  );
  run.tick++;
  audio.update(run);
  assert.equal(heard.length, 4);
});

test('native Overflight interface has matching English and Ukrainian coverage', () => {
  assert.deepEqual(Object.keys(OVERFLIGHT_COPY.en).sort(), Object.keys(OVERFLIGHT_COPY.uk).sort());
  assert.ok(
    Object.values(OVERFLIGHT_COPY.uk).every(
      (value) => typeof value === 'string' && value.length > 0,
    ),
  );
});

test('the 750 ms resume ramp integrates exactly at different display cadences', () => {
  const measure = (cadence) => {
    const clock = createOverflightClock();
    clock.slowResume(0);
    let total = 0;
    for (const now of cadence)
      clock.advance(now, true, (dt) => {
        total += dt;
      });
    return total + clock.stats().accumulator;
  };
  assert.ok(Math.abs(measure([10]) - 0.00255) < 1e-10);
  assert.ok(Math.abs(measure([250, 500, 750]) - 0.46875) < 1e-10);
  const split = Array.from({ length: 180 }, (_, index) => ((index + 1) * 1000) / 120);
  const coarse = Array.from({ length: 6 }, (_, index) => (index + 1) * 250);
  assert.ok(Math.abs(measure(split) - measure(coarse)) < 1e-10);
  assert.ok(Math.abs(measure(coarse) - 1.21875) < 1e-10);
});

test('ten retries keep one renderer and context restoration requires explicit resume', async () => {
  const owner = createOverflightRendererOwner();
  const compiled = compileOverflightProject(DEFAULT_OVERFLIGHT_PROJECT);
  let run,
    creations = 0,
    destructions = 0;
  const renderer = {
    present() {},
    async destroy() {
      destructions++;
    },
  };
  const create = async () => {
    creations++;
    return renderer;
  };
  const gate = createOverflightInputGate();
  const guard = createOverflightContextGuard({
    pause: () => pauseOverflight(run),
    release: () => gate.release(),
  });
  for (let retry = 0; retry < 10; retry++) {
    assert.equal(await owner.acquire('same-frozen-appearance', create), renderer);
    run = createOverflightRun(compiled);
    startOverflight(run);
    guard.lose();
    assert.equal(run.phase, 'paused');
    assert.equal(guard.blocked(), true);
    guard.restore();
    assert.equal(guard.blocked(), false);
    assert.equal(run.phase, 'paused');
    assert.equal(gate.sample({ x: 1 }).x, 0);
    resumeOverflight(run);
    assert.equal(run.phase, 'playing');
  }
  assert.equal(creations, 1);
  assert.equal(destructions, 0);
  await owner.dispose();
  assert.equal(destructions, 1);
});

test('appearance replacement retires the old atlas first and teardown retires a pending renderer', async () => {
  const owner = createOverflightRendererOwner();
  const events = [];
  await owner.acquire('first', async () => ({ destroy: async () => events.push('destroy-first') }));
  await owner.acquire('second', async () => {
    events.push('create-second');
    return { destroy: async () => events.push('destroy-second') };
  });
  assert.deepEqual(events, ['destroy-first', 'create-second']);
  let resolve;
  const pending = owner.acquire(
    'third',
    () =>
      new Promise((accept) => {
        resolve = accept;
      }),
  );
  await new Promise((accept) => setImmediate(accept));
  const disposal = owner.dispose();
  resolve({ destroy: async () => events.push('destroy-third') });
  await assert.rejects(pending, /closed/);
  await disposal;
  assert.deepEqual(events, ['destroy-first', 'create-second', 'destroy-second', 'destroy-third']);
});

test('native music context is accepted by the shared soundtrack schema', () => {
  const context = overflightMusicContext(DEFAULT_OVERFLIGHT_PROJECT, {
    familyId: 'industrial-workshop',
  });
  assert.doesNotThrow(() => resolveSoundtrackSelection(emptySoundtrackLibrary(), context));
  assert.equal(context.mapKey, DEFAULT_OVERFLIGHT_PROJECT.id);
});

test('Studio project messages require the exact same-origin embedding parent', () => {
  const window = {},
    parent = {},
    origin = 'https://game.example';
  const scope = { window, parent, origin };
  const data = {
    type: 'overflight:preview',
    version: 1,
    requestId: 3,
    project: DEFAULT_OVERFLIGHT_PROJECT,
  };
  const accepted = { source: parent, origin, data };
  assert.equal(overflightPreviewRequest(accepted, scope), data);
  for (const event of [
    { ...accepted, source: {} },
    { ...accepted, origin: 'https://unrelated.example' },
    { ...accepted, data: { ...data, version: 2 } },
    { ...accepted, data: { ...data, requestId: { unsafe: true } } },
  ])
    assert.equal(overflightPreviewRequest(event, scope), null);
  assert.equal(
    overflightPreviewRequest({ ...accepted, source: window }, { ...scope, parent: window }),
    null,
  );
});

test('an accepted evolution has one audio cue even when no simulation tick elapsed', () => {
  const heard = [];
  const audio = createOverflightAudio({
    encounter: (type) => heard.push(type),
    publishedCue: (type) => heard.push(type),
    feedbackDirector: { reset() {} },
  });
  const run = {
    tick: 120,
    phase: 'upgrade',
    progression: { choices: 2, rerolls: 1 },
    player: { x: 0 },
    events: [{ type: 'upgrade-ready' }],
  };
  audio.update(run);
  run.phase = 'playing';
  run.progression.choices++;
  run.events = [{ type: 'upgrade' }, { type: 'evolution' }];
  audio.update(run);
  audio.update(run);
  assert.deepEqual(heard, ['confirm', 'objective']);
});

test('a failed renderer is replaced on Retry while healthy retries retain their owner', async () => {
  const owner = createOverflightRendererOwner();
  let creations = 0,
    destructions = 0;
  const create = async () => ({
    instance: ++creations,
    destroy: async () => {
      destructions++;
    },
  });
  const first = await owner.acquire('accepted-art', create);
  assert.equal(await owner.acquire('accepted-art', create), first);
  owner.invalidate();
  const recovered = await owner.acquire('accepted-art', create);
  assert.notEqual(recovered, first);
  assert.equal(creations, 2);
  assert.equal(destructions, 1);
  assert.equal(await owner.acquire('accepted-art', create), recovered);
  await owner.dispose();
  assert.equal(destructions, 2);
});

test('explicit review playback uses ordinary input at 10 Hz while the host keeps fixed 60 Hz steps', () => {
  const sampled = [];
  const review = createOverflightReviewPlayback({
    build: 'fan',
    pilot(run, route) {
      sampled.push({ tick: run.tick, route });
      return { x: 0.5, y: -0.25, boost: false };
    },
    selectCard() {
      assert.fail('no earned upgrade was presented');
    },
  });
  const clock = createOverflightClock();
  const run = { tick: 0 };
  const step = (dt) => {
    assert.equal(dt, 1 / 60);
    assert.deepEqual(review.input(run, { x: 1 }), { x: 0.5, y: -0.25, boost: false });
    run.tick++;
  };
  clock.advance(0, true, step);
  for (let frame = 1; frame <= 120; frame++) clock.advance((frame * 1000) / 120, true, step);
  assert.equal(run.tick, 60);
  assert.deepEqual(
    sampled.map(({ tick }) => tick),
    [0, 6, 12, 18, 24, 30, 36, 42, 48, 54],
  );
  assert.ok(sampled.every(({ route }) => route === 'tight'));
  review.reset();
  review.input({ tick: 0 });
  assert.equal(sampled.at(-1).tick, 0);
});

test('review upgrades show legally rerolled offers for 1.5 visible seconds and never count hidden time', () => {
  let selections = 0;
  const run = {
    phase: 'upgrade',
    progression: { choices: 0, rerolls: 1 },
    offers: [{ id: 'first' }],
  };
  const review = createOverflightReviewPlayback({
    build: 'echo',
    pilot() {},
    selectCard(state, build) {
      assert.equal(build, 'echo');
      selections++;
      state.progression.rerolls--;
      state.offers = [{ id: 'rerolled' }];
      return state.offers[0];
    },
  });
  assert.equal(review.upgrade(run, 0, false), null);
  assert.equal(selections, 0);
  assert.deepEqual(review.upgrade(run, 10, true), { selectedId: 'rerolled', choiceId: null });
  assert.equal(review.upgrade(run, 510, true).choiceId, null);
  assert.equal(review.upgrade(run, 600, false), null);
  assert.equal(review.upgrade(run, 10000, true).choiceId, null);
  assert.equal(review.upgrade(run, 10999, true).choiceId, null);
  assert.equal(review.upgrade(run, 11000, true).choiceId, 'rerolled');
  assert.equal(selections, 1);
  assert.equal(run.progression.choices, 0, 'the host alone applies the returned legal choice');
  run.phase = 'playing';
  assert.equal(review.upgrade(run, 12000, true), null);
});

test('ordinary manual play never invokes review input or automatic upgrade selection', () => {
  const review = createOverflightReviewPlayback({
    build: null,
    pilot() {
      assert.fail('manual play invoked the pilot');
    },
    selectCard() {
      assert.fail('manual play automatically selected a card');
    },
  });
  const manual = { x: -0.4, y: 0.7, boost: true };
  assert.equal(review.input({ tick: 0 }, manual), manual);
  assert.equal(review.upgrade({ phase: 'upgrade' }, 10000, true), null);
});

function recorderHarness() {
  const timers = new Map(),
    revoked = [],
    captured = [],
    instances = [];
  let timerId = 0,
    stoppedTracks = 0;
  class MediaRecorder {
    static isTypeSupported(type) {
      return type.startsWith('video/webm');
    }
    constructor(stream, options) {
      this.mimeType = options.mimeType;
      this.state = 'inactive';
      instances.push(this);
    }
    start(interval) {
      this.state = 'recording';
      this.interval = interval;
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  const environment = {
    MediaRecorder,
    Blob,
    setTimeout(fn, milliseconds) {
      timers.set(++timerId, { fn, milliseconds });
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    URL: {
      createObjectURL(blob) {
        captured.push(blob);
        return `blob:review-${captured.length}`;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      },
    },
  };
  const canvas = {
    captureStream(rate) {
      assert.equal(rate, 30);
      let stopped = false;
      return {
        getTracks: () => [
          {
            stop() {
              if (!stopped) stoppedTracks++;
              stopped = true;
            },
          },
        ],
      };
    },
  };
  return {
    environment,
    canvas,
    timers,
    revoked,
    captured,
    instances,
    stopped: () => stoppedTracks,
  };
}

test('review capture is silent, bounded to 20 seconds, and releases tracks, timers and previous URLs', () => {
  const h = recorderHarness();
  const recorder = createOverflightReviewRecorder({ window: h.environment });
  assert.equal(recorder.record(h.canvas), true);
  assert.equal(h.instances[0].interval, 250);
  assert.equal(recorder.record(h.canvas), false, 'only one capture can be active');
  h.instances[0].ondataavailable({ data: new Blob(['battlefield'], { type: 'video/webm' }) });
  const timer = [...h.timers.values()][0];
  assert.equal(timer.milliseconds, 20000);
  timer.fn();
  assert.equal(recorder.snapshot().phase, 'ready');
  assert.equal(h.stopped(), 1);
  assert.equal(h.timers.size, 0);
  assert.equal(h.captured[0].size, 11);
  recorder.record(h.canvas);
  assert.deepEqual(h.revoked, ['blob:review-1']);
  recorder.dispose();
  assert.equal(h.stopped(), 2);
  assert.equal(h.timers.size, 0);
  assert.equal(recorder.record(h.canvas), false);
});

test('oversize and unsupported review capture fail without retaining chunks or active tracks', () => {
  const h = recorderHarness();
  const recorder = createOverflightReviewRecorder({ window: h.environment });
  assert.equal(recorder.record({}), false);
  assert.equal(recorder.snapshot().phase, 'unsupported');
  recorder.record(h.canvas);
  h.instances[0].ondataavailable({ data: new Blob([new Uint8Array(16 * 1024 * 1024 + 1)]) });
  assert.equal(recorder.snapshot().phase, 'tooLarge');
  assert.equal(h.captured.length, 0);
  assert.equal(h.stopped(), 1);
  assert.equal(h.timers.size, 0);
  recorder.dispose();
});
