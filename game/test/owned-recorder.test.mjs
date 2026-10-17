import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  createOwnedRecorder,
  adoptOwnedRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  exportReplayAsync,
  verifyReplay,
} from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = CLASSES;
const level = campaign.levels[0];
const options = { seed: 1, turnPolicy: 'immediate', classId: 'scout', classRecipes: CLASSES };
function flight(owned = true) {
  return {
    run: createRun(level, options),
    recorder: (owned ? createOwnedRecorder : createRecorder)(level, options, 'owned-test'),
  };
}
function step(f, direction) {
  const input = { direction };
  stepRun(f.run, input, FIXED_DT);
  recordInput(f.recorder, input);
}
function capture(f) {
  let work, release;
  const expected = exportReplay(f.recorder, f.run);
  const promise = exportReplayAsync(f.recorder, f.run, {
    scheduleChunk: (fn) => {
      work = fn;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  return {
    expected,
    promise,
    finish() {
      work();
      release();
    },
  };
}
for (const count of [0, 1, 4096])
  test(`private ${count}-segment capture preserves its prefix and tail through later input`, async () => {
    const f = flight();
    for (let i = 0; i < count; i++) step(f, i % 2 ? 'left' : 'right');
    assert.equal(f.recorder.segmentCount, count);
    const first = capture(f);
    if (count) step(f, count % 2 ? 'right' : 'left'); // Extend the captured tail.
    const second = capture(f);
    releaseInputs(f.run);
    recordRelease(f.recorder);
    step(f, 'right'); // Append with releaseBefore.
    const third = capture(f);
    step(f, 'left');
    releaseInputs(f.run);
    recordRelease(f.recorder);
    for (const pending of [third, first, second]) {
      pending.finish();
      const result = await pending.promise;
      assert.equal(JSON.stringify(result), JSON.stringify(pending.expected));
      assert.equal(verifyReplay(result).match, true);
    }
    assert.equal(verifyReplay(exportReplay(f.recorder, f.run)).match, true);
  });

test('capture and first resumed input do not inspect or copy the private segment prefix', async (t) => {
  const f = flight();
  for (let i = 0; i < 4096; i++) step(f, i % 2 ? 'left' : 'right');
  const expected = exportReplay(f.recorder, f.run);
  let segments = 0,
    segmentArrays = 0,
    prefixTraversals = 0;
  const slice = Array.prototype.slice,
    iterator = Array.prototype[Symbol.iterator];
  for (const [method, original] of [
    ['slice', slice],
    [Symbol.iterator, iterator],
  ]) {
    const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, method);
    t.after(() => Object.defineProperty(Array.prototype, method, descriptor));
    Object.defineProperty(Array.prototype, method, {
      ...descriptor,
      value: function (...args) {
        if (this[0]?.releaseBefore !== undefined && this[0]?.input) prefixTraversals++;
        return Reflect.apply(original, this, args);
      },
    });
  }
  const original = Object.getOwnPropertyDescriptors;
  t.mock.method(Object, 'getOwnPropertyDescriptors', (value) => {
    if (value && Object.hasOwn(value, 'releaseBefore') && Object.hasOwn(value, 'input')) segments++;
    if (Array.isArray(value) && value[0]?.releaseBefore !== undefined) segmentArrays++;
    return original(value);
  });
  let work;
  const pending = exportReplayAsync(f.recorder, f.run, {
    scheduleChunk: (fn) =>
      new Promise((resolve) => {
        work = () => {
          fn();
          resolve();
        };
      }),
  });
  assert.equal(segments, 0);
  assert.equal(segmentArrays, 0);
  assert.equal(prefixTraversals, 0);
  step(f, 'left');
  assert.equal(segments, 0, 'same-direction first input cannot clone the captured prefix');
  step(f, 'right');
  assert.equal(segments, 0, 'new-direction input only appends');
  assert.equal(prefixTraversals, 0, 'neither capture nor resumed input slices/spreads the prefix');
  work();
  assert.deepEqual(await pending, expected);
  assert.equal(segments, 4096, 'one final defensive export traverses each captured segment');
  assert.equal(segmentArrays, 1);
});

test('public/default recorders remain mutable and are copied before asynchronous admission', async () => {
  const f = flight(false);
  step(f, 'right');
  const pending = capture(f);
  f.recorder.segments[0].input.direction = 'left';
  f.recorder.options.seed = 5;
  f.recorder.build = 'caller mutation';
  pending.finish();
  assert.deepEqual(await pending.promise, pending.expected);
  assert.equal(f.recorder.build, 'caller mutation');
});

test('owned handles expose only scalars and defensive restoration adoption is idempotent', async () => {
  const f = flight(false);
  step(f, 'right');
  step(f, 'left');
  const expected = exportReplay(f.recorder, f.run),
    original = f.recorder;
  f.recorder = adoptOwnedRecorder(original);
  assert.equal(adoptOwnedRecorder(f.recorder), f.recorder);
  assert.deepEqual(Object.keys(f.recorder), ['ticks', 'segmentCount']);
  assert.equal(Object.isFrozen(f.recorder), true);
  assert.equal(f.recorder.segments, undefined);
  assert.equal(f.recorder.level, undefined);
  assert.throws(() => {
    f.recorder.ticks = 77;
  }, TypeError);
  original.segments[0].input.direction = 'down';
  original.level.name = 'caller mutation';
  original.options.seed = 8;
  original.ticks = 100;
  assert.deepEqual(exportReplay(f.recorder, f.run), expected);
  assert.equal(recordRelease(f.recorder), f.recorder);
  releaseInputs(f.run);
  assert.equal(recordInput(f.recorder, { direction: 'right' }), f.recorder);
  stepRun(f.run, { direction: 'right' }, FIXED_DT);
  assert.equal(verifyReplay(exportReplay(f.recorder, f.run)).match, true);
  assert.throws(
    () =>
      adoptOwnedRecorder({
        ...original,
        segments: [{ ticks: 1, input: { direction: { nested: true } }, releaseBefore: false }],
        ticks: 1,
      }),
    /segment/,
  );
});

test('owned required save, real restore, and re-adoption preserve exact public replay bytes', async () => {
  const f = flight();
  for (let i = 0; i < 20; i++) step(f, i % 2 ? 'left' : 'right');
  const key = campaignKey(campaign);
  const session = suspendSession({
    ...f,
    campaignKey: key,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'owned-restore',
    savedAt: '2026-10-17T00:00:00.000Z',
    continuation: { direction: 'left' },
  });
  const restored = await restoreSession(JSON.stringify(session), { campaign, campaignKey: key });
  const before = exportReplay(restored.recorder, restored.run);
  restored.recorder = adoptOwnedRecorder(restored.recorder);
  assert.equal(
    JSON.stringify(exportReplay(restored.recorder, restored.run)),
    JSON.stringify(before),
  );
  assert.equal(
    JSON.stringify(await exportReplayAsync(restored.recorder, restored.run)),
    JSON.stringify(before),
  );
  step(restored, 'left');
  assert.equal(verifyReplay(exportReplay(restored.recorder, restored.run)).match, true);
});

test('owned asynchronous capture retains run projection, cancellation and exact-once admission guards', async () => {
  const f = flight();
  step(f, 'right');
  const pending = capture(f);
  f.run.enemies[0].x += 1;
  f.run.level.name = 'mutated run';
  pending.finish();
  assert.deepEqual(await pending.promise, pending.expected);
  const valid = flight(),
    controller = new AbortController();
  let late;
  const rejected = exportReplayAsync(valid.recorder, valid.run, {
    signal: controller.signal,
    scheduleChunk: (fn) => {
      late = fn;
      controller.abort();
      fn();
    },
  });
  await assert.rejects(rejected, { name: 'AbortError' });
  assert.throws(late, /exactly once/);
  await assert.rejects(
    exportReplayAsync(valid.recorder, valid.run, { scheduleChunk: () => {} }),
    /did not invoke/,
  );
  await assert.rejects(
    exportReplayAsync(valid.recorder, valid.run, {
      scheduleChunk: (fn) => {
        fn();
        try {
          fn();
        } catch {}
      },
    }),
    /exactly once/,
  );
  recordInput(valid.recorder, {});
  await assert.rejects(
    exportReplayAsync(valid.recorder, valid.run, { scheduleChunk: (fn) => fn() }),
    /tick count differs/,
  );
});
