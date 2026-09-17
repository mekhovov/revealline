import test from 'node:test';
import assert from 'node:assert/strict';
import { startPreviewMotion } from '../../authoring/asset-studio/preview-motion.mjs';

function fixture({ reduced = false, system = false } = {}) {
  let now = 0,
    nextId = 0,
    state = { effectiveReducedEffects: reduced };
  const frames = new Map(),
    subscribers = new Set(),
    mediaListeners = new Set();
  const media = {
    matches: system,
    addEventListener: (kind, fn) => mediaListeners.add(fn),
    removeEventListener: (kind, fn) => mediaListeners.delete(fn),
  };
  const host = {
    performance: { now: () => now },
    requestAnimationFrame(fn) {
      frames.set(++nextId, fn);
      return nextId;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    matchMedia: () => media,
  };
  const preferences = {
    snapshot: () => state,
    subscribe(fn) {
      subscribers.add(fn);
      fn(state);
      return () => subscribers.delete(fn);
    },
  };
  const update = (value) => {
    state = { ...state, ...value };
    for (const fn of [...subscribers]) fn(state);
  };
  const setSystem = (value) => {
    media.matches = value;
    for (const fn of [...mediaListeners]) fn();
  };
  const advance = (ms) => {
    now += ms;
    const pending = [...frames.values()];
    frames.clear();
    for (const fn of pending) fn(now);
  };
  return { host, preferences, update, setSystem, advance, frames, subscribers, mediaListeners };
}

function mount(f, motion = 'playing', options = {}) {
  const draws = [],
    cleanups = [];
  const dispose = startPreviewMotion({
    own: (fn) => cleanups.push(fn),
    draw: (dt, reduced) => draws.push({ dt, reduced }),
    motion,
    preferences: f.preferences,
    window: f.host,
    ...options,
  });
  return { draws, dispose, cleanups };
}

test('live reduction pauses preview frames and resumes a retained Playing choice without a time jump', () => {
  const f = fixture(),
    view = mount(f);
  assert.deepEqual(view.draws, [{ dt: 0, reduced: false }]);
  assert.equal(f.frames.size, 1);
  f.advance(20);
  assert.equal(view.draws.at(-1).dt, 0.02);
  f.update({ effectiveReducedEffects: true });
  assert.deepEqual(view.draws.at(-1), { dt: 0, reduced: true });
  assert.equal(f.frames.size, 0);
  f.advance(60000);
  f.update({ effectiveReducedEffects: false });
  assert.deepEqual(view.draws.at(-1), { dt: 0, reduced: false });
  assert.equal(f.frames.size, 1);
  f.advance(20);
  assert.equal(view.draws.at(-1).dt, 0.02);
  view.dispose();
});

test('Paused inspection remains paused through both cap transitions and redraws essential state', () => {
  const f = fixture(),
    view = mount(f, 'paused');
  f.update({ effectiveReducedEffects: true });
  f.update({ effectiveReducedEffects: false });
  assert.deepEqual(view.draws, [
    { dt: 0, reduced: false },
    { dt: 0, reduced: true },
    { dt: 0, reduced: false },
  ]);
  assert.equal(f.frames.size, 0);
  view.dispose();
});

test('local Reduced inspection keeps its own cap when shared reduction is released', () => {
  const f = fixture(),
    view = mount(f, 'reduced');
  f.update({ effectiveReducedEffects: true });
  f.update({ effectiveReducedEffects: false });
  assert.deepEqual(view.draws, [{ dt: 0, reduced: true }]);
  assert.equal(f.frames.size, 0);
  view.dispose();
});

test('text-only preference updates preserve the pending frame and animation clock', () => {
  const f = fixture(),
    view = mount(f);
  const frame = [...f.frames.entries()];
  f.update({ textSize: 'large', textFace: 'plain' });
  assert.deepEqual([...f.frames.entries()], frame);
  assert.equal(view.draws.length, 1);
  f.advance(30);
  assert.equal(view.draws.at(-1).dt, 0.03);
  view.dispose();
});

test('retiring a preview cancels its frame, removes its observer and fences an already queued callback', () => {
  const f = fixture(),
    view = mount(f),
    late = [...f.frames.values()][0];
  view.cleanups[0]();
  view.dispose();
  f.update({ effectiveReducedEffects: true });
  late(50);
  assert.equal(f.frames.size, 0);
  assert.equal(f.subscribers.size, 0);
  assert.equal(view.draws.length, 1);
});

test('an already retired owner never subscribes or paints', () => {
  const f = fixture(),
    view = mount(f, 'playing', { own: (dispose) => dispose() });
  assert.equal(f.subscribers.size, 0);
  assert.equal(f.frames.size, 0);
  assert.equal(view.draws.length, 0);
});

test('standalone callers observe live system reduction and release the media listener on cleanup', () => {
  const f = fixture(),
    view = mount(f, 'playing', { preferences: null });
  assert.equal(f.mediaListeners.size, 1);
  f.setSystem(true);
  assert.deepEqual(view.draws.at(-1), { dt: 0, reduced: true });
  assert.equal(f.frames.size, 0);
  f.setSystem(false);
  assert.equal(f.frames.size, 1);
  view.dispose();
  assert.equal(f.mediaListeners.size, 0);
  assert.equal(f.frames.size, 0);
});

test('a synchronous initial draw can retire its owner without leaving the just-created subscription', () => {
  const f = fixture();
  let cleanup,
    paints = 0;
  mount(f, 'playing', {
    own: (fn) => {
      cleanup = fn;
    },
    draw: () => {
      paints++;
      cleanup();
    },
  });
  assert.equal(paints, 1);
  assert.equal(f.subscribers.size, 0);
  assert.equal(f.frames.size, 0);
});

test('a cap change during drawing cannot queue an obsolete frame alongside its replacement', () => {
  const f = fixture(),
    draws = [];
  const view = mount(f, 'playing', {
    draw: (dt, reduced) => {
      draws.push({ dt, reduced });
      if (dt > 0) f.update({ effectiveReducedEffects: true });
    },
  });
  f.advance(20);
  assert.deepEqual(draws.at(-1), { dt: 0, reduced: true });
  assert.equal(f.frames.size, 0);
  f.update({ effectiveReducedEffects: false });
  assert.equal(f.frames.size, 1);
  view.dispose();
});

test('unavailable system-query capability retains local playback and its cleanup', () => {
  const f = fixture();
  f.host.matchMedia = () => {
    throw new Error('Unavailable');
  };
  const view = mount(f, 'playing', { preferences: null });
  assert.equal(f.frames.size, 1);
  assert.deepEqual(view.draws, [{ dt: 0, reduced: false }]);
  view.dispose();
  assert.equal(f.frames.size, 0);
});

test('a queued callback from before a cap transition cannot replace or consume the resumed frame', () => {
  const f = fixture(),
    view = mount(f),
    stale = [...f.frames.values()][0];
  f.update({ effectiveReducedEffects: true });
  f.update({ effectiveReducedEffects: false });
  const replacement = [...f.frames.entries()],
    count = view.draws.length;
  stale(1000);
  assert.deepEqual([...f.frames.entries()], replacement);
  assert.equal(view.draws.length, count);
  f.advance(20);
  assert.equal(view.draws.at(-1).dt, 0.02);
  view.dispose();
});

test('a preview starting under an effective cap never queues animation until that cap is released', () => {
  const f = fixture({ reduced: true }),
    view = mount(f);
  assert.deepEqual(view.draws, [{ dt: 0, reduced: true }]);
  assert.equal(f.frames.size, 0);
  f.advance(30000);
  f.update({ effectiveReducedEffects: false });
  assert.deepEqual(view.draws.at(-1), { dt: 0, reduced: false });
  assert.equal(f.frames.size, 1);
  view.dispose();
});
