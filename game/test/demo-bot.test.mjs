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
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';

const pack = JSON.parse(
  await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
);
const maps = pack.campaigns[0].levels
  .slice(0, 2)
  .map((level) => applyGameplayTuning(level, resolveGameplayTuning('standard')));
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
  assert.deepEqual(BOT_LIMITS, { candidates: 16, candidateTicks: 1200, totalTicks: 12000 });
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
    assert.equal(supportsDemoBot(level, options('immediate', 4)), false);
  }
  assert.equal(supportsDemoBot(pack.campaigns[0].levels[0], options()), false);
  assert.equal(
    supportsDemoBot(
      applyGameplayTuning(pack.campaigns[0].levels[0], resolveGameplayTuning('gentle')),
      options(),
    ),
    false,
  );
  assert.equal(supportsDemoBot(pack.campaigns[0].levels[2]), false);
});

for (const level of maps)
  for (const policy of ['immediate', 'grid-center']) {
    test(`${level.id}/${policy}: three qualified seeds make useful varied scenes within 60 seconds and exact recordings`, (t) => {
      const signatures = new Set();
      for (const seed of [1, 2, 3]) {
        const setup = options(policy, seed),
          state = createRun(level, setup),
          recorder = createRecorder(level, setup, 'autoplay-regression');
        let bends = 0,
          decisions = 0,
          stopped = true,
          captures = 0,
          maxPlanningMs = 0,
          endReason = null;
        while (state.status === 'running' && state.tick < 7200) {
          const before = authoritativeCheckpoint(state);
          const started = performance.now();
          const macro = planDemoMacro(state, { plannerSeed: seed, decision: decisions++ });
          maxPlanningMs = Math.max(maxPlanningMs, performance.now() - started);
          assert.deepEqual(
            authoritativeCheckpoint(state),
            before,
            'Lookahead never mutates the live run.',
          );
          if (!macro.ok) {
            assert.equal(macro.reason, 'no-safe-macro');
            assert.ok(macro.examined <= BOT_LIMITS.candidates);
            assert.ok(macro.simulatedTicks <= BOT_LIMITS.totalTicks);
            assert.equal(state.player.cutting, false);
            assert.equal(state.player.speed, 0);
            endReason = macro.reason;
            break;
          }
          assert.ok(macro.metrics.examined <= BOT_LIMITS.candidates);
          assert.ok(macro.metrics.simulatedTicks <= BOT_LIMITS.totalTicks);
          assert.ok(macro.metrics.ticks <= BOT_LIMITS.candidateTicks);
          execution: for (const segment of macro.segments)
            for (let tick = 0; tick < segment.ticks; tick++) {
              if (state.tick === 7200) break execution;
              assert.equal(state.status, 'running');
              if (segment.input.direction === null)
                assert.equal(stopped, true, 'Neutral input only follows a natural capture stop.');
              else stopped = false;
              const wasCutting = state.player.cutting,
                priorDirection = state.player.direction;
              stepRun(state, segment.input, FIXED_DT);
              if (wasCutting && priorDirection !== state.player.direction) bends++;
              if (state.events.some((event) => event.type === 'capture.stopped')) {
                stopped = true;
                captures++;
              }
              recordInput(recorder, segment.input);
              assert.equal(state.classic.livesLost, 0);
            }
          if (state.tick === macro.endTick)
            assert.equal(authoritativeCheckpoint(state).hash, macro.endHash);
        }
        assert.ok(
          state.status === 'won' ||
            (state.status === 'running' && (state.tick === 7200 || endReason === 'no-safe-macro')),
        );
        assert.ok(bends >= 2, 'A scene includes a real multi-turn capture.');
        assert.ok(captures >= 2, 'A scene demonstrates repeated completed captures.');
        assert.ok(state.coverage >= 0.2, 'A scene makes substantial real map progress.');
        const recording = exportReplay(recorder, state);
        assert.equal(verifyReplay(recording).match, true);
        signatures.add(JSON.stringify(recording.segments));
        t.diagnostic(
          JSON.stringify({
            seed,
            ticks: state.tick,
            status: state.status,
            coverage: state.coverage,
            captures,
            bends,
            endReason,
            maxPlanningMs: Math.round(maxPlanningMs),
          }),
        );
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
      assert.ok(player.maxAdvanceSeconds > 0, 'A settled plan or terminal macro permits progress.');
      player.advance(player.maxAdvanceSeconds);
    }
    assert.equal(player.phase, 'complete', player.error);
    assert.ok(
      player.state.status === 'won' ||
        player.state.tick === 7200 ||
        player.completionReason === 'no-safe-macro',
    );
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
  assert.throws(() => player.exportRecording(), { name: 'AbortError' });
  await assert.rejects(player.forkForPractice(), { name: 'AbortError' });
});

class DeferredMacroWorker {
  static instance;
  constructor() {
    DeferredMacroWorker.instance = this;
    this.callbacks = new Set();
  }
  addEventListener(type, fn) {
    if (type === 'message') this.callbacks.add(fn);
  }
  removeEventListener(type, fn) {
    this.callbacks.delete(fn);
  }
  postMessage(data) {
    if (data.decision === 0) {
      this.first = planDemoMacro(data.state, data);
      queueMicrotask(() => this.deliver(data, this.first));
    } else this.pending = data;
  }
  deliver(data, result) {
    for (const fn of this.callbacks) fn({ data: { id: data.id, result } });
  }
  release(stale = false) {
    const data = this.pending;
    this.pending = null;
    this.deliver(data, stale ? this.first : planDemoMacro(data.state, data));
  }
  terminate() {
    this.stopped = true;
  }
}

function advanceToPendingBoundary(player) {
  player.play();
  player.advance(FIXED_DT / 2);
  for (let count = 0; player.maxAdvanceSeconds > 0; count++) {
    assert.ok(count < 50, 'At most one bounded macro may be consumed.');
    player.advance(player.maxAdvanceSeconds);
  }
  assert.equal(player.phase, 'playing');
  assert.equal(player.state.tick, DeferredMacroWorker.instance.first.endTick - 1);
  assert.equal(player.state.classic.livesLost, 0);
}

test('background advancement budget waits before a pending boundary, preserves fractional time and exact replay', async () => {
  const player = await prepareBotPlayer(maps[0], options(), { WorkerClass: DeferredMacroWorker });
  try {
    assert.equal(player.maxAdvanceSeconds, 0, 'A paused player exposes no gameplay budget.');
    advanceToPendingBoundary(player);
    const before = authoritativeCheckpoint(player.state);
    assert.equal(verifyReplay(player.exportRecording()).match, true);
    player.advance(player.maxAdvanceSeconds);
    assert.deepEqual(authoritativeCheckpoint(player.state), before);
    DeferredMacroWorker.instance.release();
    await player.planning;
    assert.ok(player.maxAdvanceSeconds > 0 && player.maxAdvanceSeconds <= FIXED_DT);
    player.advance(player.maxAdvanceSeconds);
    assert.equal(player.state.tick, DeferredMacroWorker.instance.first.endTick);
    assert.equal(player.phase, 'playing');
    assert.equal(verifyReplay(player.exportRecording()).match, true);
  } finally {
    player.dispose();
  }
  assert.equal(player.maxAdvanceSeconds, 0);
});

test('background budget releases a rejected stale result to the unchanged fault boundary', async () => {
  const player = await prepareBotPlayer(maps[0], options(), { WorkerClass: DeferredMacroWorker });
  try {
    advanceToPendingBoundary(player);
    DeferredMacroWorker.instance.release(true);
    await player.planning;
    assert.ok(player.maxAdvanceSeconds > 0);
    player.advance(player.maxAdvanceSeconds);
    assert.equal(player.phase, 'error');
    assert.match(player.error, /another state/);
    assert.equal(player.errorCode, 'autoplay-fault');
    assert.equal(verifyReplay(player.exportRecording()).match, true);
    assert.equal(DeferredMacroWorker.instance.stopped, true);
  } finally {
    player.dispose();
  }
});

test('background budget never bypasses the existing planning watchdog', async () => {
  const player = await prepareBotPlayer(maps[0], options(), {
    WorkerClass: DeferredMacroWorker,
    watchdogMs: 5,
  });
  try {
    advanceToPendingBoundary(player);
    await player.planning;
    assert.ok(player.maxAdvanceSeconds > 0);
    player.advance(player.maxAdvanceSeconds);
    assert.equal(player.phase, 'error');
    assert.match(player.error, /deadline/);
    assert.equal(player.errorCode, 'autoplay-fault');
    assert.equal(verifyReplay(player.exportRecording()).match, true);
    assert.equal(DeferredMacroWorker.instance.stopped, true);
  } finally {
    player.dispose();
  }
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
    assert.equal(player.phase, 'complete');
    assert.equal(player.error, null);
    assert.equal(player.completionReason, 'no-safe-macro');
    assert.equal(player.advance(0).reason, 'no-safe-macro');
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

test('a stale future plan remains a fault, not a successful exhaustion handoff', async () => {
  class StaleWorker {
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
      this.first ??= planDemoMacro(data.state, data);
      queueMicrotask(() => {
        for (const fn of this.callbacks) fn({ data: { id: data.id, result: this.first } });
      });
    }
    terminate() {}
  }
  const player = await prepareBotPlayer(maps[0], options(), { WorkerClass: StaleWorker });
  try {
    await player.planning;
    player.play();
    while (player.phase === 'playing') player.advance(0.25);
    assert.equal(player.phase, 'error');
    assert.equal(player.errorCode, 'autoplay-fault');
    assert.equal(player.completionReason, null);
    assert.match(player.error, /another state/);
    assert.equal(player.state.player.cutting, false);
    assert.equal(player.state.player.speed, 0);
    assert.equal(verifyReplay(player.exportRecording()).match, true);
    const frozen = authoritativeCheckpoint(player.state);
    player.advance(1);
    assert.deepEqual(authoritativeCheckpoint(player.state), frozen);
  } finally {
    player.dispose();
  }
});
