import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDirector } from '../demo-director.mjs';

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
  gate.resolve();
  assert.equal(await original, false);
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
  gate.resolve();
  await original;
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
