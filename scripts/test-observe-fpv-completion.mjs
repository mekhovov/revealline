import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  FPV_COMPLETION_PROTOCOL,
  validateFPVCompletionPlan,
  loadFPVCompletionArtifact,
  captureFPVCompletionTrace,
  analyzeFPVCompletionTrace,
  finishFPVCompletionProcedure,
  closeFPVCompletionResources,
  summarizeFPVCompletionFrames,
  observeFPVCompletion,
} from './observe-fpv-completion.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const plan = () => ({
  format: 'revealline-fpv-completion-plan.v1',
  caseId: 'test-only',
  protocol: FPV_COMPLETION_PROTOCOL.id,
  deviceLabel: 'Synthetic unit fixture, no browser evidence',
  quietWindow: 'No measurement performed',
  bundle: '.',
  envelopeSha256: 'a'.repeat(64),
  sourceRevision: 'b'.repeat(40),
  sourceTree: 'c'.repeat(40),
  packageRevision: 'd'.repeat(64),
  trace: 'cpu',
});
const temporary = async (t) => {
  const folder = await mkdtemp(path.join(tmpdir(), 'fpv-completion-test-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
};

test('plan fixes the protocol and bounds every external choice instead of accepting arbitrary input scripts', () => {
  assert.deepEqual(validateFPVCompletionPlan(plan()), plan());
  for (const change of [
    { protocol: 'another-flight' },
    { sourceTree: 'HEAD' },
    { envelopeSha256: '' },
    { trace: 'gpu' },
    { quietWindow: '' },
    { caseId: '../overwrite' },
    { bundle: 'a'.repeat(4097) },
    { script: 'inject progress' },
  ])
    assert.throws(() => validateFPVCompletionPlan({ ...plan(), ...change }));
  assert.throws(() => validateFPVCompletionPlan(' '.repeat(65537)));
});

test('artifact source and envelope pins are checked before reading any selected original', async (t) => {
  const directory = await temporary(t);
  const envelope = Buffer.from(
    JSON.stringify({ sourceRevision: 'e'.repeat(40), sourceTree: 'c'.repeat(40), packages: [] }),
  );
  await writeFile(path.join(directory, 'optional-packages.json'), envelope);
  await assert.rejects(loadFPVCompletionArtifact(plan(), { base: directory }), /Envelope differs/);
  await assert.rejects(
    loadFPVCompletionArtifact({ ...plan(), envelopeSha256: hash(envelope) }, { base: directory }),
    /Envelope source differs/,
  );
});

test('an existing evidence directory is never overwritten, including a failed prior attempt', async (t) => {
  const directory = await temporary(t),
    file = path.join(directory, 'plan.json');
  await writeFile(file, JSON.stringify(plan()));
  await writeFile(path.join(directory, 'observation.json'), 'prior rejected sample');
  await assert.rejects(
    observeFPVCompletion({
      planFile: file,
      playwrightModule: '/unavailable.mjs',
      output: directory,
    }),
    { code: 'EEXIST' },
  );
  assert.equal(
    await readFile(path.join(directory, 'observation.json'), 'utf8'),
    'prior rejected sample',
  );
});

test('failed admission retains exact plan and observer authority pins without launching a browser', async (t) => {
  const directory = await temporary(t),
    file = path.join(directory, 'plan.json'),
    output = path.join(directory, 'rejected');
  await writeFile(file, JSON.stringify(plan()));
  await writeFile(path.join(directory, 'optional-packages.json'), '{}');
  const report = await observeFPVCompletion({
    planFile: file,
    playwrightModule: '/must-not-be-imported.mjs',
    output,
  });
  assert.equal(report.completed, false);
  assert.equal(report.qualified, false);
  assert.equal(report.functionalStatus, 'not-started');
  assert.match(report.failure, /Envelope differs/);
  assert.equal(report.instrumentation.length, 6);
  assert(
    report.instrumentation.every((item) => item.bytes > 0 && /^[a-f0-9]{64}$/.test(item.sha256)),
  );
  assert.equal(report.instrumentation[0].path, 'scripts/observe-fpv-completion.mjs');
  assert.deepEqual(report.cleanup.operations, []);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'observation.json'))), report);
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'plan.json'))), plan());
});

function traceClient(rows, { readFailure, hang = false, closeFailure = false } = {}) {
  const client = new EventEmitter();
  const calls = [];
  client.send = async (name) => {
    calls.push(name);
    if (name === 'Tracing.end') {
      queueMicrotask(() => client.emit('Tracing.tracingComplete', { stream: 'trace-handle' }));
      return {};
    }
    if (name === 'IO.close') {
      if (closeFailure) throw Error('close failed');
      return {};
    }
    if (hang) return new Promise(() => {});
    if (readFailure) throw readFailure;
    return rows.shift();
  };
  return { client, calls };
}

test('trace overflow retains exactly the bounded prefix, closes the stream and is visibly nonpassing', async () => {
  const { client, calls } = traceClient([
    { data: 'abcd', eof: false },
    { data: Buffer.from('efgh').toString('base64'), base64Encoded: true, eof: true },
  ]);
  const saved = new Map();
  const result = await captureFPVCompletionTrace(
    client,
    async (name, bytes) => saved.set(name, bytes),
    { maxBytes: 6 },
  );
  assert.equal(result.status, 'failed');
  assert.equal(result.qualified, false);
  assert.match(result.error, /byte limit/);
  assert.equal(saved.has('trace.json'), false);
  assert.equal(saved.get('trace.json.partial').toString(), 'abcdef');
  assert.deepEqual(result.file, {
    path: 'trace.json.partial',
    bytes: 6,
    sha256: hash(Buffer.from('abcdef')),
  });
  assert.equal(result.streamClosed, true);
  assert.equal(calls.at(-1), 'IO.close');
  assert.equal(client.listenerCount('Tracing.tracingComplete'), 0);
});

test('complete traces preserve bytes; timeout and close failure stay separate capture failures', async () => {
  for (const mode of ['complete', 'timeout', 'close']) {
    const { client, calls } = traceClient([{ data: '{"traceEvents":[]}', eof: true }], {
      hang: mode === 'timeout',
      closeFailure: mode === 'close',
    });
    const saved = new Map();
    const result = await captureFPVCompletionTrace(
      client,
      async (name, bytes) => saved.set(name, bytes),
      { timeoutMs: 20 },
    );
    assert.equal(result.status, mode === 'complete' ? 'complete' : 'failed');
    assert(calls.includes('IO.close'));
    if (mode === 'complete') assert.equal(saved.get('trace.json').toString(), '{"traceEvents":[]}');
    if (mode === 'timeout') assert.match(result.error, /timed out/);
    if (mode === 'close') assert.match(result.closeError, /close failed/);
  }
});

test('capture failure never suppresses actual Retry/export/reload, and those follow the passive window', async () => {
  for (const throws of [false, true]) {
    const steps = [];
    const result = await finishFPVCompletionProcedure({
      attempt: async () => {
        steps.push('ordinary-win');
        return { accepted: true };
      },
      passive: async () => {
        steps.push('post-save-passive');
        return { start: 1, end: 1001 };
      },
      trace: async () => {
        steps.push('trace-end');
        if (throws) throw Error('trace write failed');
        return { status: 'failed', error: 'over limit' };
      },
      functional: async () => {
        steps.push('Retry-proof-reload');
        return { proofUnchangedAfterReload: true };
      },
    });
    assert.deepEqual(steps, [
      'ordinary-win',
      'post-save-passive',
      'trace-end',
      'Retry-proof-reload',
    ]);
    assert.equal(result.procedureComplete, true);
    assert.equal(result.functionalStatus, 'complete');
    assert.equal(result.trace.status, 'failed');
  }
});

test('route failure is retained without Retry or additional attempts; passive failure still allows independent functional check', async () => {
  for (const won of [true, false]) {
    const steps = [];
    const result = await finishFPVCompletionProcedure({
      attempt: async () => {
        steps.push('one-attempt');
        return { accepted: won };
      },
      passive: async () => {
        throw Error('passive observation failed');
      },
      trace: async () => {
        steps.push('trace-end');
        return { status: 'complete' };
      },
      functional: async () => {
        steps.push('functional');
        return {};
      },
    });
    assert.equal(result.procedureComplete, false);
    assert.match(result.failure, won ? /passive observation failed/ : /did not complete/);
    assert.deepEqual(
      steps,
      won ? ['one-attempt', 'trace-end', 'functional'] : ['one-attempt', 'trace-end'],
    );
    assert.equal(result.functionalStatus, won ? 'complete' : 'failed');
  }
});

test('cleanup attempts every owned resource and cannot report completion after one close fails', async () => {
  const sequence = [];
  const result = await closeFPVCompletionResources([
    [
      'browser',
      async () => {
        sequence.push('browser');
        throw Error('browser close failed');
      },
    ],
    [
      'server',
      async () => {
        sequence.push('server');
      },
    ],
    [
      'temporary-site',
      async () => {
        sequence.push('site');
      },
    ],
  ]);
  assert.deepEqual(sequence, ['browser', 'server', 'site']);
  assert.equal(result.completed, false);
  assert.equal(result.operations[0].closed, false);
  assert.equal(result.operations[2].closed, true);
});

function traceFixture(name = 'ThreadControllerImpl::RunTask') {
  const event = (name, ts, rest = {}) => ({ name, pid: 1, tid: 2, ts, ...rest });
  return {
    traceEvents: [
      event('thread_name', 0, { ph: 'M', args: { name: 'CrRendererMain' } }),
      ...Object.entries({
        start: 100000,
        visible: 200000,
        accepted: 210000,
        'passive-start': 220000,
        'passive-end': 1220000,
        end: 1230000,
      }).map(([name, ts]) => event(`fpv-completion:${name}`, ts, { ph: 'R' })),
      event(name, 50000, { ph: 'X', dur: 80000 }), // Entire slow boundary task must remain.
      event(name, 199000, { ph: 'X', dur: 12000 }),
      event(name, 221000, { ph: 'X', dur: 1000 }),
      event(name, 1221000, { ph: 'X', dur: 1000 }),
    ],
  };
}
const analyze = (trace) => analyzeFPVCompletionTrace(Buffer.from(JSON.stringify(trace)));

test('task analysis retains full slow boundary intervals, accepts both actual Chrome task names and never claims exclusive cost', () => {
  for (const name of ['RunTask', 'ThreadControllerImpl::RunTask']) {
    const result = analyze(traceFixture(name));
    assert.equal(result.taskName, name);
    assert.equal(result.qualified, false);
    assert.deepEqual(result.windows.whole.over50, [
      { startUs: 50000, durationMs: 80, overlapMs: 30, fullyInsideWindow: false },
    ]);
    assert.equal(result.windows.passive.maximumMs, 1);
    assert.equal(result.windows.completion.maximumMs, 12);
    assert.match(result.limitation, /Inclusive/);
  }
});

test('task analysis rejects ambiguous renderers/markers/task families, missing task coverage and malformed intervals', () => {
  for (const change of [
    (events) => events.push({ ...events[1] }),
    (events) => {
      events[2].tid = 3;
    },
    (events) => {
      events[4].ts = 0;
    },
    (events) => {
      events[5].ts = 300000;
    },
    (events) => events.push({ name: 'RunTask', pid: 1, tid: 2, ts: 300000, dur: 1, ph: 'X' }),
    (events) => {
      events.at(-1).dur = -1;
    },
    (events) => {
      events.at(-1).ts = 221050;
    },
    (events) => events.splice(9, 1),
  ]) {
    const trace = traceFixture();
    change(trace.traceEvents);
    assert.throws(() => analyze(trace));
  }
  const acceptedBeforePaint = traceFixture();
  acceptedBeforePaint.traceEvents.find((item) => item.name === 'fpv-completion:accepted').ts =
    190000;
  assert.equal(analyze(acceptedBeforePaint).status, 'analyzed');
});

test('frame summary retains slow samples and marks visibility/focus loss rather than filtering them away', () => {
  const frames = [0, 16, 32, 332, 348].map((at) => ({
    at,
    raf: at,
    visibility: 'visible',
    focused: true,
    snapshot: { position: { y: 1400 }, status: at < 332 ? 'active' : 'complete' },
  }));
  frames[2].focused = false;
  const result = summarizeFPVCompletionFrames(
    { frames, keys: [{ trusted: true }], longTasks: [{ startTime: 40, duration: 290 }] },
    { start: 330, end: 350 },
  );
  assert.equal(result.whole.maximumMs, 300);
  assert.equal(result.active.maximumMs, 300);
  assert.equal(result.passive.maximumMs, 16);
  assert.equal(result.allFramesFocused, false);
  assert.equal(result.longTasks.length, 1);
});
