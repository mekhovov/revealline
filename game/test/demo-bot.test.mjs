import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Worker } from 'node:worker_threads';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { BOT_LIMITS, planDemoMacro, supportsDemoBot, LIVE_BOT_LEVEL_IDS } from '../demo-bot.mjs';
import { prepareBotPlayer } from '../demo-bot-player.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
);
const maps = pack.campaigns[0].levels.slice(0, 2);
const options = (turnPolicy = 'immediate', seed = 1) => ({
  turnPolicy,
  seed,
  classId: 'scout',
  classRecipes: pack.classRecipes,
});

// Browser Worker shape backed by actual isolated Node worker threads. The entry
// point and message protocol are exactly the ones shipped to the browser.
class ThreadWorker {
  static owners = 0;
  constructor(url) {
    this.listeners = new Map();
    this.worker = new Worker(
      new URL(
        `data:text/javascript,${encodeURIComponent(`
      import { parentPort } from 'node:worker_threads';
      globalThis.postMessage = data => parentPort.postMessage(data);
      globalThis.addEventListener = (type, fn) => parentPort.on(type, data => fn({data}));
      await import(${JSON.stringify(url.href)});
    `)}`,
      ),
      { type: 'module' },
    );
    ThreadWorker.owners++;
  }
  addEventListener(type, listener) {
    const wrapper = type === 'message' ? (data) => listener({ data }) : listener;
    this.listeners.set(listener, [type, wrapper]);
    this.worker.on(type, wrapper);
  }
  removeEventListener(type, listener) {
    const entry = this.listeners.get(listener);
    if (entry) this.worker.off(type, entry[1]);
    this.listeners.delete(listener);
  }
  postMessage(data) {
    this.worker.postMessage(data);
  }
  terminate() {
    if (this.stopped) return;
    this.stopped = true;
    ThreadWorker.owners--;
    this.worker.terminate();
  }
}

test('live whitelist pins actual standard maps, rules and roster while allowing translated names', () => {
  assert.deepEqual(
    LIVE_BOT_LEVEL_IDS,
    maps.map((m) => m.id),
  );
  for (const level of maps) {
    assert.equal(supportsDemoBot(level, options()), true);
    assert.equal(supportsDemoBot({ ...level, name: 'Localized title' }, options()), true);
    assert.equal(
      supportsDemoBot({ ...level, rules: { ...level.rules, moveSpeed: 20 } }, options()),
      false,
    );
    assert.equal(supportsDemoBot(level, { ...options(), classRecipes: [] }), false);
  }
  assert.equal(supportsDemoBot(pack.campaigns[0].levels[2]), false);
});

for (const level of maps)
  for (const policy of ['immediate', 'grid-center']) {
    test(`${level.id}/${policy}: three qualified seeds make varied bent, legal complete wins and exact recordings`, () => {
      const signatures = new Set();
      for (const seed of [1, 2, 3]) {
        const setup = options(policy, seed),
          state = createRun(level, setup),
          recorder = createRecorder(level, setup, 'autoplay-regression');
        let bends = 0,
          decisions = 0;
        while (state.status === 'running' && state.tick < 7200) {
          const before = authoritativeCheckpoint(state);
          const macro = planDemoMacro(state, { plannerSeed: seed, decision: decisions++ });
          assert.equal(macro.ok, true, `${seed}/${decisions}: ${macro.reason}`);
          assert.deepEqual(
            authoritativeCheckpoint(state),
            before,
            'Lookahead never mutates the live run.',
          );
          assert.ok(macro.metrics.examined <= BOT_LIMITS.candidates);
          assert.ok(macro.metrics.simulatedTicks <= BOT_LIMITS.totalTicks);
          assert.ok(macro.metrics.ticks <= BOT_LIMITS.candidateTicks);
          bends += macro.metrics.bends;
          for (const segment of macro.segments)
            for (let tick = 0; tick < segment.ticks; tick++) {
              assert.equal(state.status, 'running');
              stepRun(state, segment.input, FIXED_DT);
              recordInput(recorder, segment.input);
              assert.equal(state.classic.livesLost, 0);
            }
          assert.equal(authoritativeCheckpoint(state).hash, macro.endHash);
        }
        assert.equal(state.status, 'won');
        assert.ok(bends >= 2, 'A scene includes a real multi-turn capture.');
        const recording = exportReplay(recorder, state);
        assert.equal(verifyReplay(recording).match, true);
        signatures.add(JSON.stringify(recording.segments));
      }
      assert.equal(signatures.size, 3, 'Planner seeds produce actual route variety.');
    });
  }

test('planning is deterministic and declines an exposed cut without changing it', () => {
  const state = createRun(maps[0], options());
  const first = planDemoMacro(state, { plannerSeed: 3 });
  const second = planDemoMacro(state, { plannerSeed: 3 });
  assert.deepEqual(second, first);
  stepRun(state, { direction: 'down' }, FIXED_DT * 10);
  const before = authoritativeCheckpoint(state);
  assert.equal(planDemoMacro(state).reason, 'unsafe-planning-boundary');
  assert.deepEqual(authoritativeCheckpoint(state), before);
});

test('actual Worker player records frame-independent live inputs, pauses exactly, forks and resets', async () => {
  const player = await prepareBotPlayer(maps[0], options('grid-center'), {
    WorkerClass: ThreadWorker,
    watchdogMs: 5000,
  });
  try {
    assert.equal(player.phase, 'paused');
    assert.equal(player.state.tick, 0);
    await player.planning;
    player.play();
    for (let i = 0; i < 6; i++) player.advance(1 / 60);
    assert.equal(player.state.tick, 12);
    const paused = authoritativeCheckpoint(player.state);
    player.pause();
    player.advance(5);
    assert.deepEqual(authoritativeCheckpoint(player.state), paused);
    const fork = await player.forkForPractice();
    assert.equal(fork.origin.source, 'autoplay');
    assert.deepEqual(authoritativeCheckpoint(fork.run), paused);
    stepRun(fork.run, { direction: null });
    assert.deepEqual(authoritativeCheckpoint(player.state), paused);
    player.play();
    while (player.phase === 'playing') {
      await player.planning;
      player.advance(0.25);
    }
    assert.equal(player.phase, 'complete', player.error);
    assert.equal(player.state.status, 'won');
    assert.equal(verifyReplay(player.exportRecording()).match, true);
    const exported = player.exportRecording();
    exported.level.id = 'caller-edit';
    assert.equal(player.exportRecording().level.id, maps[0].id);
    await player.reset();
    assert.equal(player.state.tick, 0);
    assert.equal(player.phase, 'paused');
    player.play();
    const report = player.advance(1);
    assert.equal(report.reason, 'frame-gap');
    assert.equal(player.state.tick, 0);
  } finally {
    player.dispose();
  }
  assert.equal(ThreadWorker.owners, 0);
});

class SilentWorker {
  static owners = 0;
  constructor() {
    SilentWorker.owners++;
  }
  addEventListener() {}
  removeEventListener() {}
  postMessage() {}
  terminate() {
    if (!this.stopped) {
      this.stopped = true;
      SilentWorker.owners--;
    }
  }
}
test('missing Worker, abort and planning watchdog fail closed and release every worker', async () => {
  await assert.rejects(prepareBotPlayer(maps[0], options(), { WorkerClass: null }), /Web Worker/);
  await assert.rejects(
    prepareBotPlayer(maps[0], options(), { WorkerClass: SilentWorker, watchdogMs: 5 }),
    /deadline/,
  );
  assert.equal(SilentWorker.owners, 0);
  const abort = new AbortController();
  const pending = prepareBotPlayer(maps[0], options(), {
    WorkerClass: SilentWorker,
    signal: abort.signal,
  });
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(SilentWorker.owners, 0);
});

test('future search exhaustion ends only after the current safe macro, never runs an old heading', async () => {
  class OneMacroWorker {
    constructor() {
      this.callbacks = new Set();
    }
    addEventListener(type, fn) {
      if (type === 'message') this.callbacks.add(fn);
    }
    removeEventListener(type, fn) {
      this.callbacks.delete(fn);
    }
    postMessage(data) {
      const result =
        data.decision === 0
          ? planDemoMacro(data.state, data)
          : { ok: false, reason: 'no-safe-macro' };
      queueMicrotask(() => {
        for (const fn of this.callbacks) fn({ data: { id: data.id, result } });
      });
    }
    terminate() {}
  }
  const player = await prepareBotPlayer(maps[0], options(), { WorkerClass: OneMacroWorker });
  try {
    await player.planning;
    player.play();
    while (player.phase === 'playing') player.advance(0.25);
    assert.equal(player.phase, 'error');
    assert.match(player.error, /no-safe-macro/);
    assert.equal(player.state.player.cutting, false);
    assert.equal(player.state.classic.livesLost, 0);
    const before = authoritativeCheckpoint(player.state);
    player.advance(0.25);
    assert.deepEqual(authoritativeCheckpoint(player.state), before);
    assert.equal(verifyReplay(player.exportRecording()).match, true);
  } finally {
    player.dispose();
  }
});
