import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createDemoDirector } from '../demo-director.mjs';
import { prepareBotPlayer } from '../demo-bot-player.mjs';
import { planDemoMacro } from '../demo-bot.mjs';
import { prepareReplayPlayer } from '../replay-player.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { demoLoadingClock, settleDemoLoading } from './helpers/demo-loading-clock.mjs';

function adapter() {
  let phase = 'paused',
    disposals = 0,
    ticks = 0;
  return {
    get phase() {
      return phase;
    },
    get disposals() {
      return disposals;
    },
    get ticks() {
      return ticks;
    },
    state: { tick: 0 },
    play() {
      phase = 'playing';
    },
    pause() {
      phase = 'paused';
    },
    advance() {
      ticks++;
      return { phase, events: [{ type: 'observed' }] };
    },
    finish() {
      phase = 'complete';
    },
    dispose() {
      disposals++;
    },
  };
}
const sources = [
  { id: 'advanced', levelId: 'three' },
  { id: 'easy-replay', levelId: 'one', approachable: true },
  { id: 'easy-bot', levelId: 'one' },
  { id: 'middle', levelId: 'two' },
];
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { resolve, promise };
};

test('rotation begins approachable and avoids consecutive same-level replay/bot scenes', async () => {
  const made = [];
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async () => {
      const value = adapter();
      made.push(value);
      return value;
    },
  });
  assert.equal(await director.start(), true);
  assert.equal(director.source.id, 'easy-replay');
  const sequence = [director.source.levelId];
  for (let i = 0; i < 15; i++) {
    await director.next();
    sequence.push(director.source.levelId);
  }
  assert.ok(sequence.every((level, i) => !i || level !== sequence[i - 1]));
  assert.ok(made.slice(0, -1).every((value) => value.disposals === 1));
  director.dispose();
  assert.equal(made.at(-1).disposals, 1);
});

test('failed sources are skipped once for this director session', async () => {
  const seen = [];
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async (source) => {
      seen.push(source.id);
      if (source.id === 'easy-replay') throw new Error('Stale replay');
      return adapter();
    },
  });
  await director.start();
  for (let i = 0; i < 8; i++) await director.next();
  assert.equal(seen.filter((id) => id === 'easy-replay').length, 1);
  assert.deepEqual(director.failedSourceIds, ['easy-replay']);
  director.dispose();
});

test('late cancelled preparation cannot replace a newer player and releases its ownership', async () => {
  const gate = deferred(),
    late = adapter(),
    current = adapter();
  let count = 0,
    oldSignal;
  const director = createDemoDirector({
    sources,
    prepare: async (_, { signal }) => {
      if (count++ === 0) {
        oldSignal = signal;
        await gate.promise;
        return late;
      }
      return current;
    },
  });
  const original = director.start();
  await director.next();
  assert.equal(oldSignal.aborted, true);
  assert.equal(await original, false, 'Cancellation settles before the old loader returns.');
  assert.equal(late.disposals, 0);
  gate.resolve();
  await settleDemoLoading();
  assert.equal(director.player, current);
  assert.equal(late.disposals, 1);
  director.dispose();
});

test('suspension cancels loading and requires an explicit play gesture after lifecycle return', async () => {
  const gate = deferred(),
    late = adapter(),
    current = adapter();
  let count = 0;
  const director = createDemoDirector({
    sources,
    prepare: async () => {
      if (count++ === 0) {
        await gate.promise;
        return late;
      }
      return current;
    },
  });
  const original = director.start();
  director.suspend();
  assert.equal(await original, false, 'Suspension does not await an uncooperative loader.');
  gate.resolve();
  await settleDemoLoading();
  assert.equal(director.phase, 'paused');
  assert.equal(director.player, null);
  assert.equal(late.disposals, 1);
  director.advance(2);
  assert.equal(current.ticks, 0);
  await director.play();
  director.advance(0.02);
  assert.equal(current.ticks, 1);
  director.suspend();
  director.advance(10);
  assert.equal(current.ticks, 1);
  assert.equal(director.phase, 'paused');
  director.dispose();
});

test('completion remains available for a host-owned dwell, pause survives asynchronous load', async () => {
  const gate = deferred(),
    player = adapter();
  const director = createDemoDirector({
    sources,
    prepare: async () => {
      await gate.promise;
      return player;
    },
  });
  const ready = director.start();
  director.pause();
  gate.resolve();
  await ready;
  assert.equal(director.phase, 'paused');
  assert.equal(player.phase, 'paused');
  await director.play();
  player.finish();
  director.advance(0.02);
  assert.equal(director.phase, 'complete');
  assert.equal(director.player, player);
  director.dispose();
});

test('visible stalls skip spectator time and repeated completed scenes keep rotating without input', async () => {
  const made = [];
  const director = createDemoDirector({
    sources,
    random: () => 0,
    prepare: async () => {
      const player = adapter();
      made.push(player);
      return player;
    },
  });
  await director.start();
  let previous = null;
  for (let scene = 0; scene < 40; scene++) {
    const player = director.player;
    assert.notEqual(director.source.levelId, previous);
    previous = director.source.levelId;
    assert.equal(director.advance(5).reason, 'spectator-frame-skipped');
    assert.equal(player.ticks, 0, 'A long visible stall never fast-forwards the scene.');
    assert.equal(director.phase, 'playing');
    director.advance(0.016);
    assert.equal(player.ticks, 1);
    player.finish();
    director.advance(0.016);
    assert.equal(director.phase, 'complete');
    await director.next();
    assert.equal(director.phase, 'playing');
  }
  director.pause();
  await director.next({ play: true });
  assert.equal(director.phase, 'playing', 'Explicit Next resumes a scene selected from the menu.');
  director.suspend();
  director.advance(0.016);
  assert.equal(director.phase, 'paused', 'Explicit lifecycle suspension still requires resume.');
  director.dispose();
  assert.ok(made.every((player) => player.disposals === 1));
});

test('empty or wholly unavailable rotation has a stable terminal state', async () => {
  const director = createDemoDirector({
    sources,
    prepare: async () => {
      throw Error('Missing');
    },
  });
  assert.equal(await director.start(), false);
  assert.equal(director.phase, 'unavailable');
  assert.equal(director.failedSourceIds.length, sources.length);
  director.dispose();
  assert.equal(await director.start(), false);
});

test('source exceptions during playback skip only that source and preserve next-source ownership', async () => {
  let count = 0;
  const changes = [];
  const director = createDemoDirector({
    sources,
    random: () => 0,
    onChange: (event) => changes.push(event.phase),
    prepare: async () => {
      const value = adapter();
      if (!count++)
        value.advance = () => {
          throw Error('Broken');
        };
      return value;
    },
  });
  await director.start();
  assert.equal(director.advance(0.02).reason, 'source-error');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(director.phase, 'playing');
  assert.notEqual(director.source.id, 'easy-replay');
  assert.deepEqual(director.failedSourceIds, ['easy-replay']);
  assert.ok(changes.includes('loading'));
  director.dispose();
});

const mixedSources = [
  { id: 'first-bot', kind: 'bot', levelId: 'one', approachable: true },
  { id: 'other-bot', kind: 'bot', levelId: 'two' },
  { id: 'reviewed', kind: 'replay', levelId: 'three' },
];

test('expected bot exhaustion keeps the useful final board then selects a replay without quarantine', async () => {
  const seen = [];
  const director = createDemoDirector({
    sources: mixedSources,
    random: () => 0,
    prepare: async (source) => {
      seen.push(source.id);
      const value = adapter();
      if (source.kind === 'bot')
        value.advance = () => ({ phase: 'complete', reason: 'no-safe-macro', events: [] });
      return value;
    },
  });
  await director.start();
  const shown = director.player;
  assert.equal(director.advance(0.02).reason, 'no-safe-macro');
  assert.equal(director.phase, 'complete');
  assert.equal(director.player, shown);
  assert.equal(shown.disposals, 0);
  assert.deepEqual(director.failedSourceIds, []);
  await director.next();
  assert.equal(director.source.kind, 'replay');
  assert.deepEqual(seen, ['first-bot', 'reviewed']);
  await director.next();
  assert.equal(director.source.kind, 'bot', 'normal rotation resumes after the replay');
  director.dispose();
});

test('a worker fault quarantines that bot and immediately falls back to a replay, never another bot', async () => {
  const director = createDemoDirector({
    sources: mixedSources,
    random: () => 0,
    prepare: async (source) => {
      const value = adapter();
      if (source.id === 'first-bot')
        value.advance = () => ({ phase: 'error', reason: 'autoplay-fallback' });
      return value;
    },
  });
  await director.start();
  assert.equal(director.advance(0.02).reason, 'source-error');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(director.source.id, 'reviewed');
  assert.deepEqual(director.failedSourceIds, ['first-bot']);
  director.dispose();
});

test('the real bot watchdog adopts a verified reviewed replay and cannot revive from a late Worker reply', async (t) => {
  const pack = JSON.parse(
    await readFile(new URL('../content/packs/fpv-arcade-r5.json', import.meta.url)),
  );
  const level = applyGameplayTuning(
    pack.campaigns[0].levels.find((level) => level.id.endsWith('courtyard-exits')),
    resolveGameplayTuning('standard'),
  );
  const recording = JSON.parse(
    await readFile(new URL('../demo-data/first-signal-left.replay.json', import.meta.url)),
  );
  // Verify the actual frozen recording before replacing wall timers with a clock.
  const reviewed = await prepareReplayPlayer(recording);
  let worker, bot;
  class StalledWorker {
    callbacks = new Set();
    constructor() {
      worker = this;
    }
    addEventListener(type, callback) {
      if (type === 'message') this.callbacks.add(callback);
    }
    removeEventListener(type, callback) {
      this.callbacks.delete(callback);
    }
    postMessage(data) {
      if (data.decision === 0) {
        this.first = planDemoMacro(data.state, data);
        queueMicrotask(() => {
          for (const callback of this.callbacks)
            callback({ data: { id: data.id, result: this.first } });
        });
      } else {
        this.pending = data;
        this.lateCallbacks = [...this.callbacks];
      }
    }
    terminate() {
      this.stopped = true;
    }
  }
  const attempted = [];
  const director = createDemoDirector({
    sources: [
      { id: 'stalled-bot', kind: 'bot', levelId: level.id, approachable: true },
      { id: 'reviewed', kind: 'replay', levelId: recording.level.id },
      { id: 'other-bot', kind: 'bot', levelId: 'other' },
    ],
    random: () => 0,
    prepare: async (source, { signal }) => {
      attempted.push(source.id);
      if (source.id === 'reviewed') return reviewed;
      assert.equal(source.id, 'stalled-bot');
      bot = await prepareBotPlayer(
        level,
        { seed: 2, turnPolicy: 'immediate', classId: 'scout', classRecipes: pack.classRecipes },
        { signal, WorkerClass: StalledWorker },
      );
      return bot;
    },
  });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    assert.equal(await director.start(), true);
    for (let count = 0; bot.maxAdvanceSeconds > 0; count++) {
      assert.ok(count < 50, 'Only the prepared macro is consumed.');
      director.advance(bot.maxAdvanceSeconds);
    }
    assert.equal(bot.state.tick, worker.first.endTick - 1);
    t.mock.timers.tick(999);
    await settleDemoLoading();
    assert.equal(director.phase, 'playing');
    assert.equal(bot.maxAdvanceSeconds, 0);
    t.mock.timers.tick(1);
    await bot.planning;
    assert.equal(director.advance(bot.maxAdvanceSeconds).reason, 'source-error');
    await settleDemoLoading();
    assert.equal(director.player, reviewed);
    assert.equal(director.phase, 'playing');
    assert.deepEqual(director.failedSourceIds, ['stalled-bot']);
    assert.deepEqual(attempted, ['stalled-bot', 'reviewed']);
    assert.match(bot.error, /planning deadline/);
    assert.equal(worker.stopped, true);
    assert.equal(worker.callbacks.size, 0);
    const checkpoint = authoritativeCheckpoint(reviewed.state);
    const replayTick = reviewed.state.tick;
    // Deliver to even the removed callback, as if a message was already queued.
    for (const callback of worker.lateCallbacks)
      callback({ data: { id: worker.pending.id, result: worker.first } });
    await settleDemoLoading();
    assert.equal(director.player, reviewed);
    assert.equal(director.phase, 'playing');
    assert.deepEqual(authoritativeCheckpoint(reviewed.state), checkpoint);
    assert.equal(bot.phase, 'error');
    director.advance(0.25);
    assert.ok(reviewed.state.tick > replayTick);
  } finally {
    director.dispose();
    reviewed.dispose();
    t.mock.timers.reset();
  }
});

test('no safe first macro falls back without quarantine; missing replay leaves a stable unavailable state', async () => {
  for (const candidates of [mixedSources, mixedSources.filter((source) => source.kind === 'bot')]) {
    const seen = [];
    const director = createDemoDirector({
      sources: candidates,
      random: () => 0,
      prepare: async (source) => {
        seen.push(source.id);
        if (source.kind === 'bot')
          throw Object.assign(Error('No safe macro'), { code: 'no-safe-macro' });
        return adapter();
      },
    });
    await director.start();
    assert.deepEqual(director.failedSourceIds, []);
    assert.ok(!seen.includes('other-bot'));
    assert.equal(director.phase, candidates.length === 3 ? 'playing' : 'unavailable');
    director.dispose();
  }
});

test('preparation deadline quarantines a hung bot, falls back to replay and preserves explicit Pause', async () => {
  const clock = demoLoadingClock(),
    gate = deferred(),
    late = adapter(),
    replay = adapter();
  let abandonedSignal;
  const seen = [];
  const director = createDemoDirector({
    sources: mixedSources,
    random: () => 0,
    loading: clock.options,
    prepare: (source, { signal }) => {
      seen.push(source.id);
      if (source.kind === 'bot') {
        abandonedSignal = signal;
        return gate.promise;
      }
      return replay;
    },
  });
  const pending = director.start();
  director.pause();
  clock.advance(15000);
  assert.equal(await pending, true);
  assert.equal(abandonedSignal.aborted, true);
  assert.deepEqual(seen, ['first-bot', 'reviewed']);
  assert.deepEqual(director.failedSourceIds, ['first-bot']);
  assert.equal(director.phase, 'paused');
  assert.equal(replay.phase, 'paused');
  assert.equal(clock.pending, 0);
  gate.resolve(late);
  await settleDemoLoading();
  assert.equal(late.disposals, 1);
  assert.equal(director.player, replay);
  await director.play();
  assert.equal(director.phase, 'playing');
  director.dispose();
  clock.advance(30000);
  assert.equal(late.disposals, 1);
  assert.equal(replay.disposals, 1);
});

test('Next cancels a preparation which never returns and retains only its newer owner', async () => {
  const clock = demoLoadingClock(),
    current = adapter();
  let calls = 0,
    oldSignal;
  const director = createDemoDirector({
    sources,
    loading: clock.options,
    prepare: (_, { signal }) => {
      if (!calls++) {
        oldSignal = signal;
        return new Promise(() => {});
      }
      return current;
    },
  });
  const abandoned = director.start();
  const replacement = director.next();
  assert.equal(await abandoned, false);
  assert.equal(await replacement, true);
  assert.equal(oldSignal.aborted, true);
  assert.equal(director.player, current);
  assert.equal(clock.pending, 0);
  clock.advance(30000);
  assert.equal(director.player, current);
  assert.deepEqual(director.failedSourceIds, []);
  director.dispose();
  assert.equal(current.disposals, 1);
});

test('dispose settles preparation immediately and disposes its ignored-abort late adapter once', async () => {
  const clock = demoLoadingClock(),
    gate = deferred(),
    late = adapter();
  let signal;
  const director = createDemoDirector({
    sources,
    loading: clock.options,
    prepare: (_, options) => {
      signal = options.signal;
      return gate.promise;
    },
  });
  const pending = director.start();
  director.dispose();
  assert.equal(await pending, false);
  assert.equal(signal.aborted, true);
  assert.equal(director.phase, 'disposed');
  assert.equal(clock.pending, 0);
  gate.resolve(late);
  await settleDemoLoading();
  director.dispose();
  assert.equal(late.disposals, 1);
  assert.equal(director.player, null);
});

test('wholly timed-out recordings end unavailable after one bounded attempt per source', async () => {
  const clock = demoLoadingClock();
  const attempted = [];
  const director = createDemoDirector({
    sources: [
      { id: 'one', levelId: 'one', kind: 'replay' },
      { id: 'two', levelId: 'two', kind: 'replay' },
    ],
    random: () => 0,
    loading: clock.options,
    prepare: (source, { signal }) => {
      attempted.push({ id: source.id, signal });
      return new Promise(() => {});
    },
  });
  const pending = director.start();
  clock.advance(15000);
  await settleDemoLoading();
  assert.equal(director.phase, 'loading');
  assert.equal(attempted.length, 2);
  clock.advance(15000);
  assert.equal(await pending, false);
  assert.equal(director.phase, 'unavailable');
  assert.deepEqual(director.failedSourceIds, ['one', 'two']);
  assert.ok(attempted.every(({ signal }) => signal.aborted));
  assert.equal(clock.pending, 0);
  director.dispose();
});
