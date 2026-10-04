import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTOR_DECODED_BYTES,
  COMPACT_ACTOR_DECODED_BYTES,
  createActorArtPool,
  pageActorArtPool,
} from '../presentation/actor-art-pool.mjs';
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

test('replacement owners wait for a retired decode and then share one fresh generation', async () => {
  const pool = createActorArtPool({ limit: 4096 }),
    firstOwner = new AbortController();
  let finish,
    loads = 0,
    staleCloses = 0,
    freshCloses = 0;
  const source = {
    key: 'reinstalled-actor',
    width: 32,
    height: 32,
    load: () => {
      loads++;
      if (loads === 1)
        return new Promise((resolve) => {
          finish = resolve;
        });
      return { width: 32, height: 32, close: () => freshCloses++ };
    },
  };
  const first = pool.acquire({ ...source, signal: firstOwner.signal }),
    cancelled = assert.rejects(first, { name: 'AbortError' });
  await Promise.resolve();
  firstOwner.abort();
  const left = pool.acquire(source),
    right = pool.acquire(source);
  await Promise.resolve();
  assert.equal(loads, 1, 'The retired decoder still owns the entire available budget.');
  assert.equal(pool.stats().reservedBytes, 4096);
  assert.equal(pool.stats().leases, 0, 'Waiting owners cannot resurrect an aborted codec.');
  finish({ width: 32, height: 32, close: () => staleCloses++ });
  await cancelled;
  const [a, b] = await Promise.all([left, right]);
  assert.equal(loads, 2);
  assert.equal(staleCloses, 1);
  assert.strictEqual(a.image, b.image);
  assert.equal(pool.stats().reservedBytes, 4096);
  a.release();
  assert.equal(freshCloses, 0);
  b.release();
  assert.equal(freshCloses, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('cancelling a replacement wait is immediate and never starts another decoder', async () => {
  const pool = createActorArtPool({ limit: 4096 }),
    old = new AbortController(),
    replacement = new AbortController();
  let rejectDecode,
    replacementLoads = 0;
  const first = pool.acquire({
      key: 'same-actor',
      width: 32,
      height: 32,
      signal: old.signal,
      load: () =>
        new Promise((resolve, reject) => {
          rejectDecode = reject;
        }),
    }),
    firstRejected = assert.rejects(first, { name: 'AbortError' });
  await Promise.resolve();
  old.abort();
  const waiting = pool.acquire({
    key: 'same-actor',
    width: 32,
    height: 32,
    signal: replacement.signal,
    load: () => replacementLoads++,
  });
  replacement.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(replacementLoads, 0);
  assert.equal(pool.stats().reservedBytes, 4096);
  rejectDecode(new Error('Retired codec failed'));
  await firstRejected;
  // Caller cancellation is already complete; let the failed codec retire its
  // separately owned reservation before testing a fresh allocation.
  for (let step = 0; step < 4; step++) await Promise.resolve();
  assert.equal(pool.stats().reservedBytes, 0);
  const repaired = await pool.acquire({
    key: 'same-actor',
    width: 32,
    height: 32,
    load: () => ({ width: 32, height: 32 }),
  });
  repaired.release();
  assert.equal(pool.stats().reservedBytes, 0);
});

test('cancelled callers settle immediately while an uninterruptible codec remains accounted', async () => {
  const pool = createActorArtPool({ limit: 4096 }),
    owner = new AbortController();
  let finish,
    closed = 0;
  const pending = pool.acquire({
      key: 'slow-codec',
      width: 32,
      height: 32,
      signal: owner.signal,
      load: () => new Promise((resolve) => (finish = resolve)),
    }),
    cancelled = assert.rejects(pending, { name: 'AbortError' });
  await Promise.resolve();
  owner.abort();
  await cancelled;
  assert.equal(pool.stats().leases, 0);
  assert.equal(pool.stats().reservedBytes, 4096);
  assert.equal(closed, 0);
  await assert.rejects(
    pool.acquire({ key: 'other', width: 1, height: 1, load: () => ({ width: 1, height: 1 }) }),
    /decoded byte budget/,
  );
  finish({ width: 32, height: 32, close: () => closed++ });
  for (let step = 0; step < 4; step++) await Promise.resolve();
  assert.equal(closed, 1);
  assert.equal(pool.stats().reservedBytes, 0);
});

test('one board can leave a pending shared codec immediately without cancelling the remaining board', async () => {
  const pool = createActorArtPool({ limit: 4096 }),
    left = new AbortController();
  let finish, decodeSignal;
  const resource = {
    key: 'two-boards',
    width: 32,
    height: 32,
    load(signal) {
      decodeSignal = signal;
      return new Promise((resolve) => (finish = resolve));
    },
  };
  const first = pool.acquire({ ...resource, signal: left.signal }),
    cancelled = assert.rejects(first, { name: 'AbortError' }),
    second = pool.acquire(resource);
  await Promise.resolve();
  left.abort();
  await cancelled;
  assert.equal(decodeSignal.aborted, false);
  assert.equal(pool.stats().leases, 1);
  assert.equal(pool.stats().reservedBytes, 4096);
  finish({ width: 32, height: 32 });
  const lease = await second;
  lease.release();
  assert.equal(pool.stats().reservedBytes, 0);
});

test('page budget selection preserves exact 64/32 MiB limits and shares only within its document', async () => {
  for (const [defaultView, expected] of [
    [
      { navigator: { deviceMemory: 8 }, matchMedia: () => ({ matches: false }) },
      ACTOR_DECODED_BYTES,
    ],
    [
      { navigator: { deviceMemory: 4 }, matchMedia: () => ({ matches: false }) },
      COMPACT_ACTOR_DECODED_BYTES,
    ],
    [
      { navigator: { deviceMemory: 8 }, matchMedia: () => ({ matches: true }) },
      COMPACT_ACTOR_DECODED_BYTES,
    ],
    [undefined, COMPACT_ACTOR_DECODED_BYTES],
  ]) {
    const document = { defaultView },
      pool = pageActorArtPool(document),
      height = expected / (1024 * 4);
    assert.strictEqual(pageActorArtPool(document), pool);
    assert.notStrictEqual(pageActorArtPool({ defaultView }), pool);
    assert.equal(pool.stats().limit, expected);
    const full = await pool.acquire({
      key: 'full-capacity',
      width: 1024,
      height,
      load: () => ({ width: 1024, height }),
    });
    await assert.rejects(
      pool.acquire({ key: 'one-extra-pixel', width: 1, height: 1, load() {} }),
      /decoded byte budget/,
    );
    full.release();
    assert.equal(pool.stats().reservedBytes, 0);
  }
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
