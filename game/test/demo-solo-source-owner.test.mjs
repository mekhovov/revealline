import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoloDemoSourceOwner } from '../demo-modes/solo-source-owner.mjs';

const nativePlayer = () => {
  let phase = 'paused',
    disposals = 0;
  return Object.freeze({
    get phase() {
      return phase;
    },
    get disposals() {
      return disposals;
    },
    play() {
      phase = 'playing';
    },
    dispose() {
      disposals++;
      phase = 'disposed';
    },
  });
};

test('lazy entry ownership preserves frozen live getters and releases once on disposal or cancellation', () => {
  const level = { id: 'metadata' };
  const owner = createSoloDemoSourceOwner(level);
  const controller = new AbortController();
  const native = nativePlayer();
  const entry = { campaign: {} };
  const player = owner.adopt(native, {
    entry,
    level: { id: 'prepared' },
    signals: [controller.signal, controller.signal],
  });
  assert.ok(Object.isFrozen(player));
  assert.equal(owner.entry, entry);
  player.play();
  assert.equal(player.phase, 'playing');
  controller.abort();
  assert.equal(player.phase, 'disposed');
  assert.equal(owner.entry, null);
  assert.equal(owner.level, level);
  player.dispose();
  assert.equal(native.disposals, 1);
});

test('a retired earlier lease cannot erase the currently owned entry', () => {
  const owner = createSoloDemoSourceOwner({ id: 'metadata' });
  const old = owner.adopt(nativePlayer(), { entry: { id: 'old' }, level: {} });
  const entry = { id: 'new' };
  const current = owner.adopt(nativePlayer(), { entry, level: {} });
  old.dispose();
  assert.equal(owner.entry, entry);
  current.dispose();
  assert.equal(owner.entry, null);
});

test('already cancelled admission disposes the native player before retaining its entry', () => {
  const owner = createSoloDemoSourceOwner({ id: 'metadata' });
  const controller = new AbortController();
  controller.abort();
  const native = nativePlayer();
  assert.throws(() => owner.adopt(native, { entry: {}, level: {}, signals: [controller.signal] }), {
    name: 'AbortError',
  });
  assert.equal(native.disposals, 1);
  assert.equal(owner.entry, null);
});

test('abort owns asynchronous retirement and repeated disposal preserves its exact result', async () => {
  const owner = createSoloDemoSourceOwner({ id: 'metadata' });
  const controller = new AbortController();
  let reject,
    calls = 0;
  const pending = new Promise((_resolve, fail) => {
    reject = fail;
  });
  const player = owner.adopt(
    Object.freeze({
      dispose() {
        calls++;
        return pending;
      },
    }),
    {
      entry: {},
      level: {},
      signals: [controller.signal],
    },
  );
  controller.abort();
  const failure = Error('Native retirement failed');
  reject(failure);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(player.dispose(), pending);
  await assert.rejects(player.dispose(), (error) => error === failure);
  assert.equal(calls, 1);
  assert.equal(owner.entry, null);
});

test('repeated disposal retains synchronous native cleanup failure without throwing from abort', () => {
  const owner = createSoloDemoSourceOwner({ id: 'metadata' });
  const controller = new AbortController();
  const failure = Error('Native retirement failed');
  const player = owner.adopt(
    Object.freeze({
      dispose() {
        throw failure;
      },
    }),
    {
      entry: {},
      level: {},
      signals: [controller.signal],
    },
  );
  controller.abort();
  assert.throws(
    () => player.dispose(),
    (error) => error === failure,
  );
  assert.throws(
    () => player.dispose(),
    (error) => error === failure,
  );
  assert.equal(owner.entry, null);
});
