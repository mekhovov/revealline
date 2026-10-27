import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  hostedArguments,
  hostedJobs,
  validateHostedResult,
  runHostedChild,
} from './qualify-shared-demo-hosted-browser.mjs';

const modes = ['sim', 'snake', 'solo', 'survival'];
const mixedJob = hostedJobs('matrix').find((job) => job.id === 'mixed-chromium');
function mixedReport() {
  return {
    complete: true,
    started: 'start',
    finished: 'finish',
    engine: 'chromium',
    errors: [],
    browserCloseCompleted: true,
    previewClosed: true,
    checks: [
      ...['native-playback', 'live-localization', 'takeover-and-return'].flatMap((type) =>
        modes.map((mode) => ({ type, mode })),
      ),
      { type: 'pause' },
      { type: 'return-and-persistence' },
      { type: 'narrow-controls' },
      { type: 'browser-freeze-resume-and-paused-intent' },
      ...Array.from({ length: 12 }, (_, cycle) => ({ type: 'scene-retirement', cycle })),
    ],
  };
}

test('hosted plan covers every engine and the complete11+9 existing job scopes without retries', () => {
  const matrix = hostedJobs('matrix'),
    additional = hostedJobs('additional'),
    offline = hostedJobs('offline');
  assert.equal(matrix.length, 11);
  assert.equal(additional.length, 9);
  assert.equal(offline.length, 1);
  assert.equal(new Set([...matrix, ...additional, ...offline].map((job) => job.id)).size, 21);
  for (const engine of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.filter((job) => job.engine === engine && job.kind === 'mixed').length, 1);
    assert.equal(
      matrix.filter((job) => job.engine === engine && job.kind === 'restoration').length,
      1,
    );
    assert.equal(
      matrix.filter((job) => job.engine === engine && job.kind === 'sim-fresh').length,
      1,
    );
    assert.equal(
      additional.filter((job) => job.engine === engine && job.kind === 'survival-fresh').length,
      1,
    );
    assert.deepEqual(
      additional
        .filter((job) => job.engine === engine && job.kind === 'reviewed-solo')
        .map((job) => job.clipID)
        .sort(),
      ['first-signal-right', 'hidden-frequency-search'],
    );
  }
  assert.ok(
    [...matrix, ...additional, ...offline].every((job) => job.seconds > 0 && job.seconds <= 540),
  );
  assert.throws(() => hostedJobs('all'));
});

test('partial, error-bearing and unclosed browser results cannot satisfy the hosted gate', () => {
  assert.equal(validateHostedResult(mixedReport(), mixedJob).checks, 28);
  for (const mutate of [
    (r) => {
      r.complete = false;
    },
    (r) => {
      r.errors = [''];
    },
    (r) => {
      r.browserCloseCompleted = false;
    },
    (r) => {
      r.previewClosed = false;
    },
    (r) => {
      r.failure = 'timeout';
    },
    (r) => {
      r.checks = [];
    },
    (r) => {
      r.checks = r.checks.filter((row) => row.type !== 'takeover-and-return');
    },
  ]) {
    const result = mixedReport();
    mutate(result);
    assert.throws(() => validateHostedResult(result, mixedJob));
  }
});

test('unequal mode coverage and lost lifecycle observations cannot be hidden by complete=true', () => {
  const repeated = mixedReport();
  repeated.checks.find((row) => row.type === 'native-playback' && row.mode === 'sim').mode = 'solo';
  assert.throws(() => validateHostedResult(repeated, mixedJob));
  const lifecycle = mixedReport();
  lifecycle.checks = lifecycle.checks.filter(
    (row) => row.type !== 'browser-freeze-resume-and-paused-intent',
  );
  assert.throws(() => validateHostedResult(lifecycle, mixedJob));
  const short = mixedReport();
  short.checks.pop();
  assert.throws(() => validateHostedResult(short, mixedJob));
});

test('reviewed proof must actually terminate with progress at a published candidate boundary', () => {
  const job = hostedJobs('additional').find((row) => row.kind === 'reviewed-solo');
  const head = 'a'.repeat(40),
    base = 'b'.repeat(40);
  const result = {
    complete: true,
    started: 'start',
    finished: 'finish',
    engine: job.engine,
    sourceRevision: head,
    mainRevision: base,
    browserVersion: 'observed',
    failures: [],
    variants: [],
    performances: [],
    required: 1,
    runtime: [
      {
        id: job.clipID,
        ok: true,
        outcome: 'lost',
        tick: 600,
        captures: 1,
        capturedCells: 48,
        themes: 1,
      },
    ],
  };
  const options = { head, base, candidates: [{ ticks: 600, outcome: 'lost' }] };
  assert.equal(validateHostedResult(result, job, options).terminalAndMeaningfulProgress, true);
  for (const change of [
    { tick: 599 },
    { outcome: 'running' },
    { captures: 0 },
    { capturedCells: 0 },
    { id: 'unrequested' },
  ]) {
    const corrupt = structuredClone(result);
    Object.assign(corrupt.runtime[0], change);
    assert.throws(() => validateHostedResult(corrupt, job, options));
  }
  const generated = structuredClone(result);
  generated.variants.push({ id: job.clipID });
  assert.throws(() => validateHostedResult(generated, job, options));
});

test('hosted CLI rejects duplicate authority, unknown flags, source URLs and unbounded phases', () => {
  const values = [
    '--head=' + 'a'.repeat(40),
    '--base=' + 'b'.repeat(40),
    '--fingerprint=' + 'c'.repeat(64),
    '--emitted-preview=.cache/capture',
    '--report=.cache/run.json',
    '--runtime=/tmp/runtime/index.mjs',
    '--phase=matrix',
  ];
  assert.equal(hostedArguments(values).phase, 'matrix');
  for (const extra of ['--head=' + 'd'.repeat(40), '--url=http://127.0.0.1:9999', '--retry=1'])
    assert.throws(() => hostedArguments([...values, extra]));
  assert.throws(() =>
    hostedArguments(values.map((value) => (value === '--phase=matrix' ? '--phase=all' : value))),
  );
});

test('real child nonzero exit is preserved for strict result validation', async () => {
  assert.deepEqual(
    await runHostedChild(['--input-type=module', '-e', 'process.exitCode=23'], { timeoutMs: 3000 }),
    { code: 23, signal: null },
  );
});

async function interruptedChild(kind) {
  let child;
  const controller = new AbortController();
  const launch = (...args) => {
    child = spawn(...args);
    return child;
  };
  let alarm;
  try {
    if (kind === 'abort')
      alarm = setTimeout(() => controller.abort(new Error('guard cancellation')), 100);
    await assert.rejects(
      runHostedChild(['--input-type=module', '-e', 'setInterval(()=>{},1000)'], {
        timeoutMs: kind === 'timeout' ? 100 : 3000,
        signal: controller.signal,
        spawnChild: launch,
      }),
      kind === 'timeout' ? /Child exceeded/ : /guard cancellation/,
    );
    assert.equal(
      child.exitCode,
      null,
      'The phase runner leaves exact descendant retirement to its outer owner.',
    );
  } finally {
    clearTimeout(alarm);
    if (child && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close');
      child.kill('SIGKILL');
      await closed;
    }
  }
}

test('child deadline fails promptly and retains the spawned identity for outer cleanup', () =>
  interruptedChild('timeout'));
test('cancellation fails promptly and cannot turn an unfinished child into success', () =>
  interruptedChild('abort'));

test('actual-worker offline evidence cannot pass with unretired storage or changed bindings', () => {
  const job = hostedJobs('offline')[0],
    head = 'a'.repeat(40);
  const report = {
    complete: true,
    started: 'start',
    finished: 'finish',
    errors: [],
    browserCloseCompleted: true,
    source: { expectedHead: head },
    serverClosed: true,
    bindingsStable: true,
    profile: { removed: true },
    localSession: { removed: true },
    checks: Array.from({ length: 11 }, (_, i) => ({ label: String(i) })),
  };
  assert.equal(validateHostedResult(report, job, { head }).checks, 11);
  for (const mutate of [
    (r) => {
      r.profile.removed = false;
    },
    (r) => {
      r.localSession.removed = false;
    },
    (r) => {
      r.bindingsStable = false;
    },
    (r) => {
      r.serverClosed = false;
    },
    (r) => {
      r.source.expectedHead = 'b'.repeat(40);
    },
  ]) {
    const failed = structuredClone(report);
    mutate(failed);
    assert.throws(() => validateHostedResult(failed, job, { head }));
  }
});
