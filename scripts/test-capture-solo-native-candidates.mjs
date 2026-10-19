import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRun, stepRun, releaseInputs, FIXED_DT, CLASSES } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplay,
} from '../game/replay.mjs';
import { demoDescriptor, demoInputTraceIdentity } from '../game/demo-catalog.mjs';
import {
  aggregateSoloAvailability,
  assertSoloSourceBinding,
  captureSoloInputTrace,
  runSoloCandidateWorker,
} from './capture-solo-native-candidates.mjs';

function fixture({ release = false, incomplete = false, noCapture = false } = {}) {
  const level = {
    version: 'xonix-level.v1',
    id: 'native-capture-test',
    revision: '1',
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    goal: { coverage: 0.4 },
    enemies: [{ id: 'anchor', type: 'bouncer', x: 39.5, y: 25.5, vx: 0, vy: 0 }],
    rules: { moveSpeed: 5, ...(noCapture ? { timeLimitSeconds: 1 } : {}) },
  };
  const options = { seed: 123, classId: 'scout', turnPolicy: 'immediate', classRecipes: CLASSES };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'native-test');
  const input = noCapture ? {} : { direction: 'down' };
  for (let tick = 0; tick < (incomplete ? 30 : 1200) && run.status === 'running'; tick++) {
    if (release && tick === 100) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  if (release) {
    releaseInputs(run);
    recordRelease(recorder);
  }
  const replay = exportReplay(recorder, run);
  const entry = {
    campaign: { id: 'native-capture-owner', revision: '1', levels: [level], classRecipes: CLASSES },
    classRecipes: CLASSES,
  };
  return {
    replay,
    entry,
    descriptor: demoDescriptor(replay, entry, { id: 'solo-qualified-test' }),
  };
}

class FakeWorker extends EventEmitter {
  terminations = 0;
  unrefs = 0;
  async terminate() {
    this.terminations++;
    return 0;
  }
  unref() {
    this.unrefs++;
  }
}
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('native capture replays a complete real cut and retains five-second diagnostic identity', () => {
  const { replay, entry, descriptor } = fixture();
  assert.equal(replay.summary.status, 'won');
  assert.ok(replay.ticks > 600);
  const before = structuredClone(replay);
  const result = captureSoloInputTrace(replay, descriptor, entry);
  assert.deepEqual(replay, before);
  assert.equal(result.classification, 'same-input-variant-candidate');
  assert.equal(result.automaticallyAdmitted, false);
  assert.deepEqual(result.replay, replay);
  assert.equal(verifyReplay(result.replay).match, true);
  assert.ok(result.metrics.captures > 0 && result.metrics.capturedCells > 0);
  assert.equal(result.metrics.diagnostics.checkpoints[0].tick, 600);
  assert.equal(result.metrics.diagnostics.inputTraceIdentity, demoInputTraceIdentity(replay));
});

test('native source binding rejects changed authored content and catalog identity', () => {
  const { replay, entry, descriptor } = fixture();
  const changed = structuredClone(entry);
  changed.campaign.levels[0].goal.coverage = 0.5;
  assert.throws(
    () => assertSoloSourceBinding(replay, descriptor, changed),
    /installed level|catalog/,
  );
  assert.throws(
    () =>
      assertSoloSourceBinding(replay, { ...descriptor, inputTraceIdentity: '0'.repeat(16) }, entry),
    /inputTraceIdentity/,
  );
});

test('releaseBefore and a genuine final release survive same-trace authoring exactly', () => {
  const { replay, entry, descriptor } = fixture({ release: true });
  assert.ok(replay.segments.some((segment) => segment.releaseBefore));
  assert.equal(replay.releaseAfter, true);
  const result = captureSoloInputTrace(replay, descriptor, entry);
  assert.equal(result.classification, 'same-input-variant-candidate');
  assert.deepEqual(result.replay.segments, replay.segments);
  assert.equal(result.replay.releaseAfter, true);
  assert.equal(result.inputTraceIdentity, descriptor.inputTraceIdentity);
});

test('a trace that reaches its natural terminal early is an independent prefix, never same-trace', () => {
  const { replay, entry } = fixture();
  // Model a structurally valid input trace whose foreign runtime needed seven
  // more commands. The candidate must reconstruct its own genuine result.
  const longer = structuredClone(replay);
  longer.ticks += 7;
  longer.segments.at(-1).ticks += 7;
  longer.releaseAfter = true;
  const descriptor = demoDescriptor(longer, entry, { id: 'solo-qualified-longer' });
  const result = captureSoloInputTrace(longer, descriptor, entry);
  assert.equal(result.classification, 'independent-performance-candidate');
  assert.equal(result.consumedTrace, 'prefix');
  assert.equal(result.consumedTicks, replay.ticks);
  assert.equal(result.sourceTicks, replay.ticks + 7);
  assert.equal(
    result.replay.releaseAfter,
    false,
    'A release after unconsumed commands is not invented',
  );
  assert.notEqual(result.inputTraceIdentity, descriptor.inputTraceIdentity);
  assert.equal(verifyReplay(result.replay).match, true);
});

test('unfinished traces and natural terminal runs without captures remain unqualified', () => {
  const unfinished = fixture({ incomplete: true });
  assert.equal(unfinished.replay.summary.status, 'running');
  assert.throws(
    () => captureSoloInputTrace(unfinished.replay, unfinished.descriptor, unfinished.entry),
    /before a natural terminal outcome/,
  );
  const idle = fixture({ noCapture: true });
  assert.equal(idle.replay.summary.status, 'lost');
  assert.throws(
    () => captureSoloInputTrace(idle.replay, idle.descriptor, idle.entry),
    /meaningful captures/,
  );
});

test('an independent qualifier rejection cannot be replaced by a captured outcome', () => {
  const { replay, entry, descriptor } = fixture();
  const rejection = new Error('Independent verifier rejected this exact proof');
  assert.throws(
    () =>
      captureSoloInputTrace(replay, descriptor, entry, {
        qualify() {
          throw rejection;
        },
      }),
    (error) => error === rejection,
  );
});

test(
  'worker success requires normal exit after its single result and removes owned listeners',
  { timeout: 5000 },
  async () => {
    const worker = new FakeWorker();
    let settled = false;
    const pending = runSoloCandidateWorker(
      { id: 'source' },
      { createWorker: () => worker, timeoutMs: 1000 },
    ).then((result) => {
      settled = true;
      return result;
    });
    worker.emit('message', { id: 'source', strictUsable: true });
    await flush();
    assert.equal(settled, false);
    worker.emit('exit', 0);
    assert.deepEqual(await pending, { id: 'source', strictUsable: true });
    assert.equal(worker.terminations, 0);
    assert.equal(worker.unrefs, 1);
    assert.equal(worker.listenerCount('message'), 0);
    assert.equal(worker.listenerCount('exit'), 0);
  },
);

test(
  'worker duplicate results and abnormal exit are rejected even after a useful message',
  { timeout: 5000 },
  async () => {
    for (const kind of ['duplicate', 'abnormal']) {
      const worker = new FakeWorker();
      const pending = runSoloCandidateWorker({}, { createWorker: () => worker, timeoutMs: 1000 });
      worker.emit('message', { strictUsable: true });
      if (kind === 'duplicate') worker.emit('message', { strictUsable: true });
      else worker.emit('exit', 9);
      await assert.rejects(pending, kind === 'duplicate' ? /multiple results/ : /exited 9/);
      assert.equal(worker.unrefs, 1);
      assert.equal(worker.terminations, kind === 'duplicate' ? 1 : 0);
    }
  },
);

test(
  'worker timeout awaits termination and cannot turn a late result into success',
  { timeout: 5000 },
  async () => {
    const worker = new FakeWorker();
    let finishTermination;
    worker.terminate = () => {
      worker.terminations++;
      return new Promise((resolve) => {
        finishTermination = resolve;
      });
    };
    let settled = false;
    const pending = runSoloCandidateWorker(
      {},
      { createWorker: () => worker, timeoutMs: 5, cleanupMs: 1000 },
    );
    const failure = assert.rejects(pending, /timed out/).then(() => {
      settled = true;
    });
    while (!finishTermination) await flush();
    worker.emit('message', { strictUsable: true });
    await flush();
    assert.equal(settled, false);
    finishTermination(0);
    await failure;
    assert.equal(worker.terminations, 1);
    assert.equal(worker.unrefs, 1);
  },
);

test(
  'pre-aborted requests create no worker, and live abort retains its original reason',
  { timeout: 5000 },
  async () => {
    const already = new AbortController(),
      reason = new Error('Caller cancelled');
    already.abort(reason);
    await assert.rejects(
      runSoloCandidateWorker(
        {},
        {
          signal: already.signal,
          createWorker() {
            throw Error('must not construct');
          },
        },
      ),
      (error) => error === reason,
    );
    const controller = new AbortController(),
      worker = new FakeWorker();
    const pending = runSoloCandidateWorker(
      {},
      { signal: controller.signal, createWorker: () => worker, timeoutMs: 1000 },
    );
    controller.abort(reason);
    await assert.rejects(pending, (error) => error === reason);
    assert.equal(worker.terminations, 1);
    assert.equal(worker.unrefs, 1);
  },
);

test('failed owned-worker cleanup is explicit, fatal and bounded', { timeout: 5000 }, async () => {
  const worker = new FakeWorker();
  worker.terminate = () => {
    worker.terminations++;
    return new Promise(() => {});
  };
  await assert.rejects(
    runSoloCandidateWorker({}, { createWorker: () => worker, timeoutMs: 5, cleanupMs: 5 }),
    (error) =>
      error.code === 'worker-cleanup-failed' &&
      /cleanup/.test(error.message) &&
      /timed out/.test(error.message),
  );
  assert.equal(worker.terminations, 1);
  assert.equal(worker.unrefs, 1);
  assert.equal(worker.listenerCount('message'), 0);
  assert.equal(worker.listenerCount('exit'), 0);
});

test('inventory grouping retains reviewed identifiers and multiple clips for one required entry', () => {
  const entries = [{ id: 'required-a' }, { id: 'required-b' }, { id: 'required-c' }];
  const sources = [
    { id: 'reviewed-left', requiredEntry: 'required-a', strictUsable: false },
    { id: 'reviewed-right', requiredEntry: 'required-a', strictUsable: true },
    { id: 'required-b', requiredEntry: 'required-b', strictUsable: false },
  ];
  assert.deepEqual(aggregateSoloAvailability(entries, sources), {
    missingEntries: ['required-c'],
    unusableEntries: ['required-b', 'required-c'],
    unusableSources: ['reviewed-left', 'required-b'],
  });
  assert.equal(sources.length, 3);
  assert.throws(() => aggregateSoloAvailability(entries, [...sources, sources[0]]));
  assert.throws(() =>
    aggregateSoloAvailability(entries, [{ id: 'unknown', requiredEntry: 'unknown' }]),
  );
});
