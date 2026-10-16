import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { setImmediate as tick } from 'node:timers/promises';
import { createMP3Inspector } from '../ui/mp3-inspector.mjs';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
import { inspectMP3 } from '../mp3.mjs';
import { silenceBytes } from './helpers/soundtrack-fixtures.mjs';

function realWorker() {
  const module = new URL('../mp3-inspection-worker.mjs', import.meta.url).href;
  const code = `import { parentPort } from 'node:worker_threads';
    globalThis.addEventListener = (type, callback) => parentPort.on(type, data => callback({ data }));
    globalThis.postMessage = data => parentPort.postMessage(data);
    await import(${JSON.stringify(module)});`;
  const worker = new Worker(new URL(`data:text/javascript,${encodeURIComponent(code)}`));
  const listeners = new Map();
  return {
    postMessage: (value) => worker.postMessage(value),
    terminate: () => worker.terminate(),
    addEventListener(type, callback) {
      const listener = type === 'message' ? (data) => callback({ data }) : callback;
      if (type === 'message') listeners.set(callback, listener);
      worker.on(type, listener);
    },
    removeEventListener(type, callback) {
      worker.off(type, type === 'message' ? listeners.get(callback) : callback);
      if (type === 'message') listeners.delete(callback);
    },
  };
}

test('static worker returns the same complete MP3 validation and rejects malformed originals', async (t) => {
  const inspector = createMP3Inspector({ createWorker: realWorker });
  t.after(() => inspector.close());
  const blob = new Blob([silenceBytes]);
  assert.deepEqual(await inspector.inspect(blob), await inspectMP3(blob));
  await assert.rejects(
    inspector.inspect(new Blob(['junk', silenceBytes])),
    /malformed|Unsupported/,
  );
  await assert.rejects(inspector.inspect(blob.slice(0, -1)), /Truncated/);
});

test('unavailable worker defers fallback until a safe phase and respects cancellation', async (t) => {
  const preparation = createMediaPreparation();
  preparation.setPhase('playing');
  let scans = 0;
  const inspector = createMP3Inspector({
    preparation,
    createWorker() {
      throw new Error('CSP blocked');
    },
    inspect: async (_source, { scheduleScan }) => scheduleScan(() => ++scans),
  });
  t.after(() => inspector.close());
  const controller = new AbortController();
  const cancelled = inspector.inspect(new Blob([silenceBytes]), { signal: controller.signal });
  const rejection = assert.rejects(cancelled, { name: 'AbortError' });
  await tick();
  assert.equal(scans, 0);
  controller.abort();
  await rejection;
  const waiting = inspector.inspect(new Blob([silenceBytes]));
  await tick();
  assert.equal(scans, 0);
  preparation.setPhase('paused');
  assert.equal(await waiting, 1);
});

test('fallback rechecks its safe phase after Blob materialization and before hashing', async (t) => {
  const blob = new Blob([silenceBytes]);
  const expected = await inspectMP3(blob);
  const preparation = createMediaPreparation();
  preparation.setPhase('preparing');
  let releaseRead, readStarted;
  const ready = new Promise((resolve) => (readStarted = resolve));
  const blocked = new Promise((resolve) => (releaseRead = resolve));
  const originalRead = Blob.prototype.arrayBuffer;
  t.mock.method(Blob.prototype, 'arrayBuffer', async function () {
    readStarted();
    await blocked;
    return originalRead.call(this);
  });
  const stages = [];
  const inspector = createMP3Inspector({
    preparation,
    createWorker() {
      throw new Error('CSP blocked');
    },
    inspect: (source, options) =>
      inspectMP3(source, {
        ...options,
        scheduleScan: (work) =>
          options
            .scheduleScan(() => {
              stages.push(preparation.snapshot().phase);
              return work();
            })
            .then((value) => {
              if (stages.length === 2) preparation.setPhase('playing');
              return value;
            }),
      }),
  });
  t.after(() => inspector.close());
  const result = inspector.inspect(blob);
  await ready;
  preparation.setPhase('playing');
  releaseRead();
  await tick();
  assert.deepEqual(stages, ['preparing']);
  assert.equal(preparation.snapshot().queued, 1);
  assert.equal(preparation.snapshot().active.main, 0);
  preparation.setPhase('paused');
  await tick();
  assert.deepEqual(stages, ['preparing', 'paused']);
  assert.equal(preparation.snapshot().queued, 1);
  assert.equal(preparation.snapshot().active.main, 0);
  preparation.setPhase('paused');
  assert.deepEqual(await result, expected);
  assert.deepEqual(stages, ['preparing', 'paused', 'paused']);
});

test('cancelling an active worker terminates its work and a later request creates a fresh worker', async (t) => {
  let terminations = 0,
    creations = 0;
  const inspector = createMP3Inspector({
    createWorker() {
      creations++;
      if (creations > 1) return realWorker();
      return {
        postMessage() {},
        addEventListener() {},
        removeEventListener() {},
        terminate() {
          terminations++;
        },
      };
    },
  });
  t.after(() => inspector.close());
  const controller = new AbortController();
  const cancelled = inspector.inspect(new Blob([silenceBytes]), { signal: controller.signal });
  const rejection = assert.rejects(cancelled, { name: 'AbortError' });
  await tick();
  controller.abort();
  await rejection;
  assert.equal(terminations, 1);
  assert.deepEqual(
    await inspector.inspect(new Blob([silenceBytes])),
    await inspectMP3(new Blob([silenceBytes])),
  );
  assert.equal(creations, 2);
});
