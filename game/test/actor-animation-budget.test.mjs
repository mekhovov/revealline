import test from 'node:test';
import assert from 'node:assert/strict';
import { createActorArtPool } from '../presentation/actor-art-pool.mjs';
import {
  createSoldierAnimation,
  validateActorAnimation,
  sampleActorAnimation,
} from '../presentation/actor-animation.mjs';

test('paired boards share a decode; final release disposes its memory', async () => {
  const pool = createActorArtPool({ limit: 4096 });
  let decoded = 0,
    closed = 0;
  const source = {
    key: 'one',
    width: 32,
    height: 32,
    load: async () => {
      decoded++;
      return { width: 32, height: 32, close: () => closed++ };
    },
  };
  const [left, right] = await Promise.all([pool.acquire(source), pool.acquire(source)]);
  assert.equal(decoded, 1);
  assert.equal(pool.stats().decodedBytes, 4096);
  left.release();
  assert.equal(closed, 0);
  right.release();
  assert.equal(closed, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('pending decodes reserve capacity and late cancelled images are closed', async () => {
  const pool = createActorArtPool({ limit: 4096 });
  const controller = new AbortController();
  let finish,
    closed = 0;
  const pending = pool.acquire({
    key: 'pending',
    width: 32,
    height: 32,
    signal: controller.signal,
    load: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await Promise.resolve();
  await assert.rejects(
    pool.acquire({ key: 'other', width: 1, height: 1, load: () => {} }),
    /decoded byte budget/,
  );
  controller.abort();
  assert.equal(pool.stats().reservedBytes, 4096);
  finish({ width: 32, height: 32, close: () => closed++ });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(closed, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('one cancelled board does not abort the other owner', async () => {
  const pool = createActorArtPool({ limit: 4096 });
  const left = new AbortController();
  let finish, decodeSignal;
  const source = {
    key: 'pair',
    width: 32,
    height: 32,
    load: (signal) => {
      decodeSignal = signal;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  };
  const a = pool.acquire({ ...source, signal: left.signal });
  const b = pool.acquire(source);
  await Promise.resolve();
  left.abort();
  assert.equal(decodeSignal.aborted, false);
  finish({ width: 32, height: 32 });
  await assert.rejects(a, { name: 'AbortError' });
  const lease = await b;
  lease.release();
  assert.equal(pool.stats().reservedBytes, 0);
});

test('animation round-trips data, freezes effects and rejects gameplay fields', () => {
  const source = createSoldierAnimation('runner-review', ['helmet', 'torso', 'boots']);
  const copy = validateActorAnimation(JSON.stringify(source));
  assert.deepEqual(copy, source);
  assert.equal(sampleActorAnimation(copy, { clip: 'move', timeMs: 230 }).stride, 2);
  assert.equal(
    sampleActorAnimation(copy, { clip: 'move', timeMs: 230, reducedEffects: true }).stride,
    0,
  );
  assert.throws(() => validateActorAnimation({ ...source, damage: 25 }));
  assert.throws(() =>
    validateActorAnimation({ ...source, clips: { ...source.clips, execute: 'alert(1)' } }),
  );
  assert.throws(() => validateActorAnimation({ ...source, parts: ['custom-script'] }));
});
