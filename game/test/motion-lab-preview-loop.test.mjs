import test from 'node:test';
import assert from 'node:assert/strict';
import { Events } from './helpers/couch-dom.mjs';
import { createPreviewLoop } from '../../authoring/motion-lab/preview-loop.mjs';

function fixture(onFrame = () => {}) {
  const host = new Events(),
    doc = new Events(),
    frames = new Map(),
    cancelled = [],
    steps = [],
    interruptions = [];
  let id = 0,
    disposals = 0;
  host.requestAnimationFrame = (fn) => {
    frames.set(++id, fn);
    return id;
  };
  host.cancelAnimationFrame = (id) => {
    cancelled.push(frames.get(id));
    frames.delete(id);
  };
  const loop = createPreviewLoop({
    window: host,
    document: doc,
    onFrame: (time, dt) => {
      steps.push([time, dt]);
      onFrame(loop);
    },
    onInterrupt: (reason) => interruptions.push(reason),
    onDispose: () => disposals++,
  });
  const tick = (time) => {
    assert.equal(frames.size, 1);
    const [key, fn] = frames.entries().next().value;
    frames.delete(key);
    fn(time);
  };
  return {
    host,
    doc,
    frames,
    cancelled,
    steps,
    interruptions,
    loop,
    tick,
    get disposals() {
      return disposals;
    },
  };
}

test('Motion loop owns one request, clamps/reset clocks and fences a cancelled callback after a new run', () => {
  const h = fixture();
  h.loop.setRunning(true);
  assert.equal(h.frames.size, 0);
  h.loop.setReady();
  h.loop.setReady();
  h.loop.setRunning(true);
  assert.equal(h.frames.size, 1);
  h.tick(100);
  h.tick(1100);
  assert.deepEqual(h.steps, [
    [100, 0],
    [1100, 0.25],
  ]);
  h.loop.setRunning(false);
  const stale = h.cancelled.at(-1);
  assert.equal(h.frames.size, 0);
  h.loop.setRunning(true);
  const request = [...h.frames.keys()][0];
  stale(2000);
  assert.deepEqual([...h.frames.keys()], [request]);
  h.tick(5000);
  assert.deepEqual(h.steps.at(-1), [5000, 0]);
  h.tick(4990);
  assert.deepEqual(h.steps.at(-1), [4990, 0]);
  h.loop.dispose();
  h.loop.dispose();
  assert.equal(h.frames.size, 0);
  assert.equal(h.disposals, 1);
});

test('Motion loop respects reentrant interruption and cached restore requires an explicit running action', () => {
  const h = fixture((loop) => loop.setRunning(false));
  h.loop.setReady();
  h.loop.setRunning(true);
  h.tick(0);
  assert.equal(h.frames.size, 0);
  h.loop.setRunning(true);
  h.host.emit('pagehide', { persisted: true });
  h.host.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(h.loop.interrupted, true);
  assert.equal(h.loop.disposed, false);
  h.doc.hidden = true;
  h.loop.setRunning(true);
  assert.equal(h.frames.size, 0);
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  assert.equal(h.frames.size, 0);
  h.loop.setRunning(true);
  assert.equal(h.frames.size, 1);
  h.host.emit('pagehide', { persisted: false });
  h.host.emit('pageshow', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(h.loop.disposed, true);
  assert.equal(h.disposals, 1);
});
