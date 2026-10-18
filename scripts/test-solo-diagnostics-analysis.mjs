import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  analyzeDiagnostics,
  diagnosticsSchedule,
  DIAGNOSTICS_FORMAT,
} from './solo-diagnostics-analysis.mjs';
import {
  analyzeDirectory,
  diagnosticsArguments,
  observerArguments,
} from './qualify-solo-diagnostics.mjs';
import { createObservationStop } from './solo-observation-lifecycle.mjs';

const revision = '1'.repeat(40);

test('a stop signal wakes a long active wait without a browser call and preserves the first cause', async () => {
  const stop = createObservationStop();
  const pending = stop.wait(60000);
  stop.request('SIGTERM');
  assert.equal(await pending, false);
  assert.equal(stop.requested, true);
  assert.equal(stop.interruption.signal, 'SIGTERM');
  const original = stop.interruption;
  stop.request('SIGINT');
  assert.strictEqual(stop.interruption, original);
  assert.throws(() => stop.throwIfRequested(), /interrupted by SIGTERM/);
  assert.equal(await stop.wait(60000), false, 'Further waits must not delay partial export.');
});

test('normal observation waits complete and malformed durations are rejected', async () => {
  const stop = createObservationStop();
  assert.equal(await stop.wait(0), true);
  assert.equal(stop.interruption, null);
  assert.doesNotThrow(() => stop.throwIfRequested());
  await assert.rejects(stop.wait(NaN), /Invalid/);
});
function evidence(ratios = Array(10).fill(1.01), { offMs = 1, quantum = 0.001 } = {}) {
  const configuration = diagnosticsArguments(
    'http://127.0.0.1:8776/game/?journey=opening',
    '/tmp/diagnostics-test',
    [`--source-revision=${revision}`, `--pairs=${ratios.length}`, '--server-fixture-access'],
  );
  const executions = diagnosticsSchedule(ratios.length, configuration.seed).map((row) => ({
    ...row,
    status: 'complete',
    exitCode: 0,
    signal: null,
    report: `${row.order}.json`,
    log: `${row.order}.log`,
  }));
  const manifest = {
    format: DIAGNOSTICS_FORMAT,
    configuration,
    executions,
    timerResolution: {
      status: 'observed',
      minimumPositiveStepMs: quantum,
      positiveSteps: 100,
      browser: 'chromium 155',
    },
  };
  const reports = executions.map((execution) => {
    const work = execution.diagnostics ? offMs * ratios[execution.pair] : offMs;
    const recent = Array.from({ length: 200 }, () => [work, 1]).flat();
    return [
      {
        status: 'observed',
        sourceRevision: revision,
        requestedActiveMs: configuration.durationMs,
        address: configuration.address + `&performance=${Number(execution.diagnostics)}`,
        diagnostics: execution.diagnostics,
        independentWorkProbe: true,
        qualityProbe: true,
        cpuRate: 1,
        browser: 'chromium 155',
        host: { arch: 'arm64', osRelease: '25.6', initialLoad: [1], finalLoad: [1] },
        viewport: { width: 1280, height: 800 },
        audio: 'default preferences',
        httpCache: 'controlled by browser and server headers',
        profile: configuration.profile,
        fixtureAccess: false,
        serverFixtureAccess: true,
        inputs: configuration.inputs,
        firstActiveAt: 3000,
        launchAt: 2800,
        beforePause: { flight: 'running' },
        errors: [],
        failedResponses: [],
        failure: null,
        application: execution.diagnostics
          ? {
              enabled: true,
              sourceRevision: revision,
              interruptions: { count: 0 },
              failures: { count: 0 },
              quality: { tier: 'full' },
              baselineMs: 16.67,
              cadenceCalibration: { status: 'measured-before-play', samples: 30, required: 30 },
            }
          : undefined,
        external: {
          names: ['briefing', 'running', 'paused'],
          width: 7,
          totals: [0, 0, 0, 0, 0, 0, 0, 200, 30000, 16.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          workProbe: {
            width: 3,
            count: 200,
            totals: [0, 0, 0, 200, work * 200, work, 0, 0, 0],
            recent,
          },
          qualityProbe: {
            dropped: 0,
            samples: [
              { label: 'before-start', at: 2500, flight: 'briefing', quality: 'full' },
              { label: 'active-start', at: 3000, flight: 'running', quality: 'full' },
              ...Array.from({ length: 120 }, (_, i) => ({
                label: 'active',
                at: 3000 + (i + 1) * 250,
                flight: 'running',
                quality: 'full',
              })),
              { label: 'before-pause', at: 33001, flight: 'running', quality: 'full' },
            ],
          },
        },
      },
    ];
  });
  return { manifest, reports };
}

test('predeclared schedule balances adjacent pair orientation and is reproducible', () => {
  const schedule = diagnosticsSchedule();
  assert.deepEqual(schedule, diagnosticsSchedule(10, 1544));
  assert.equal(schedule.length, 20);
  assert.equal(schedule.filter((row, i) => i % 2 === 0 && row.diagnostics).length, 5);
  for (let i = 0; i < schedule.length; i += 4)
    assert.deepEqual(
      schedule.slice(i, i + 4).map((row) => row.diagnostics),
      [
        schedule[i].diagnostics,
        !schedule[i].diagnostics,
        !schedule[i].diagnostics,
        schedule[i].diagnostics,
      ],
    );
  const odd = diagnosticsSchedule(3, 17);
  assert.equal(odd.length, 6);
  assert.equal(new Set(odd.map((row) => row.pair)).size, 3);
  assert.throws(() => diagnosticsSchedule(2), /3–30/);
  assert.throws(() => diagnosticsSchedule(31), /3–30/);
});

test('unchanged observer receives one matched arm and explicit server cache/access ownership', () => {
  const configuration = diagnosticsArguments('http://127.0.0.1/game/?journey=opening', '/tmp/new', [
    `--source-revision=${revision}`,
    '--server-fixture-access',
    '--warm',
  ]);
  const args = observerArguments(configuration, { report: '0.json', diagnostics: false });
  assert(args.includes('--server-fixture-access'));
  assert(!args.includes('--fixture-access'));
  assert(args.includes('--diagnostics=0'));
  assert(args.includes('--runs=1'));
  assert(args.includes('--work-probe'));
  assert(args.includes('--input-probe'));
  assert(args.includes('--warm'));
  assert.throws(
    () =>
      diagnosticsArguments(configuration.address, '/tmp/new', [
        `--source-revision=${revision}`,
        '--fixture-access',
        '--server-fixture-access',
      ]),
    /one access fixture/,
  );
  assert.throws(
    () =>
      diagnosticsArguments(configuration.address, '/tmp/new', [
        `--source-revision=${revision}`,
        '--diagnostics=0',
      ]),
    /Invalid/,
  );
  assert.throws(
    () =>
      diagnosticsArguments(configuration.address, '/tmp/new', [
        `--source-revision=${revision}`,
        '--browser=webkit',
        '--cpu=4',
      ]),
    /Invalid/,
  );
});

test('complete low-noise equivalent pairs pass only with an upper uncertainty bound under 5%', () => {
  const { manifest, reports } = evidence();
  const before = JSON.stringify(reports);
  const result = analyzeDiagnostics(manifest, reports);
  assert.equal(result.status, 'pass');
  assert.equal(result.completePairs, 10);
  assert.equal(result.limit, 0.05);
  assert.ok(Math.abs(result.interval.geometricRelativeDifference - 0.01) < 1e-12);
  assert(result.adjustedInterval.upper95 < 0.05);
  assert.equal(result.observations.length, 20);
  assert(result.observations.every((row) => row.rawRunningWorkMs.length === 200));
  assert.equal(JSON.stringify(reports), before, 'Original raw records must not be changed.');
});

test('noisy point estimates below 5% remain unresolved; clearly excessive overhead fails', () => {
  const noisy = evidence([0.8, 1.2, 0.85, 1.15, 0.9, 1.1, 0.8, 1.2, 0.9, 1.1]);
  const result = analyzeDiagnostics(noisy.manifest, noisy.reports);
  assert(result.interval.geometricRelativeDifference < 0.05);
  assert(result.adjustedInterval.upper95 > 0.05);
  assert.equal(result.status, 'unresolved');
  const excessive = evidence(Array(10).fill(1.2));
  assert.equal(analyzeDiagnostics(excessive.manifest, excessive.reports).status, 'fail');
});

test('timer quantization cannot masquerade as a precise zero-variance pass', () => {
  const coarse = evidence(Array(10).fill(1), { offMs: 2, quantum: 0.1 });
  const result = analyzeDiagnostics(coarse.manifest, coarse.reports);
  assert.equal(result.interval.upper95, 0);
  assert(result.adjustedInterval.upper95 > 0.05);
  assert.equal(result.status, 'unresolved');
  coarse.manifest.timerResolution = null;
  assert.equal(analyzeDiagnostics(coarse.manifest, coarse.reports).status, 'unresolved');
});

test('a final full quality tier cannot hide an earlier adaptive reduction or missing off-arm evidence', () => {
  const sample = evidence();
  const off = sample.reports.find((report) => !report[0].diagnostics)[0];
  off.external.qualityProbe.samples[20].quality = 'reduced';
  let result = analyzeDiagnostics(sample.manifest, sample.reports);
  assert(result.interval.upper95 < 0.05, 'The p95 comparison alone would pass.');
  assert.equal(result.noAdaptationWitness.status, 'unresolved');
  assert.equal(result.status, 'unresolved');
  delete off.external.qualityProbe;
  result = analyzeDiagnostics(sample.manifest, sample.reports);
  assert.equal(result.status, 'unresolved');
});

test('an unpainted ready scene requires the first full active witness before adaptation can begin', () => {
  const sample = evidence();
  sample.reports[0][0].external.qualityProbe.samples[0].quality = null;
  let result = analyzeDiagnostics(sample.manifest, sample.reports);
  assert.equal(result.status, 'pass');
  assert.equal(result.observations[0].qualityWitness.initialPaint, 'not-observed-before-start');
  sample.reports[0][0].external.qualityProbe.samples[1].at += 1000;
  result = analyzeDiagnostics(sample.manifest, sample.reports);
  assert.equal(result.status, 'unresolved');
});

for (const [name, mutate] of [
  [
    'failed status without a redundant failure string',
    ({ reports }) => {
      reports[0][0].status = 'failed';
    },
  ],
  [
    'retained interruption without a redundant failure string',
    ({ reports }) => {
      reports[0][0].interruption = { signal: 'SIGTERM' };
    },
  ],
  [
    'interruption cleanup failure',
    ({ reports }) => {
      reports[0][0].interruptionCleanupFailure = 'page closed';
    },
  ],
  [
    'application diagnostics unexpectedly present in off arm',
    ({ reports }) => {
      reports.find((report) => !report[0].diagnostics)[0].application = { enabled: true };
    },
  ],
  [
    'quality sample gap',
    ({ reports }) => {
      reports[0][0].external.qualityProbe.samples.splice(2, 8);
    },
  ],
  [
    'quality sample truncation',
    ({ reports }) => {
      reports[0][0].external.qualityProbe.dropped = 1;
    },
  ],
  [
    'missing quality boundary',
    ({ reports }) => {
      reports[0][0].external.qualityProbe.samples.pop();
    },
  ],
  [
    'malformed quality sample',
    ({ reports }) => {
      reports[0][0].external.qualityProbe.samples[2] = null;
    },
  ],
  [
    'malformed phase metadata',
    ({ reports }) => {
      reports[0][0].external.names = {};
    },
  ],
  [
    'missing report',
    ({ reports }) => {
      reports[0] = null;
    },
  ],
  [
    'malformed report',
    ({ reports }) => {
      reports[0] = [];
    },
  ],
  [
    'failed observer',
    ({ reports }) => {
      reports[0][0].failure = 'Timed out';
    },
  ],
  [
    'unobserved pass',
    ({ reports }) => {
      reports[0][0].status = 'not-observed';
    },
  ],
  [
    'process timeout',
    ({ manifest }) => {
      manifest.executions[0].status = 'timed-out';
    },
  ],
  [
    'process exit failure',
    ({ manifest }) => {
      manifest.executions[0].exitCode = 1;
    },
  ],
  [
    'browser error',
    ({ reports }) => {
      reports[0][0].errors.push('page exception');
    },
  ],
  [
    'HTTP failure',
    ({ reports }) => {
      reports[0][0].failedResponses.push({ status: 404 });
    },
  ],
  [
    'interrupted active workload',
    ({ reports }) => {
      reports[0][0].beforePause.flight = 'paused';
    },
  ],
  [
    'short active window',
    ({ reports }) => {
      reports[0][0].external.totals[8] = 29000;
    },
  ],
  [
    'work ring censoring',
    ({ reports }) => {
      const work = reports[0][0].external.workProbe;
      work.count = 5001;
      work.totals[3] = 5001;
      work.recent = Array.from({ length: 5000 }, () => [10, 1]).flat();
    },
  ],
  [
    'missing raw work sample',
    ({ reports }) => {
      reports[0][0].external.workProbe.recent.splice(0, 2);
    },
  ],
  [
    'invalid raw work sample',
    ({ reports }) => {
      reports[0][0].external.workProbe.recent[0] = NaN;
    },
  ],
  [
    'zero denominator',
    ({ reports }) => {
      const work = reports.find((report) => !report[0].diagnostics)[0].external.workProbe;
      work.recent = work.recent.map((value, i) => (i % 2 ? value : 0));
    },
  ],
  [
    'source mismatch',
    ({ reports }) => {
      reports[0][0].sourceRevision = '2'.repeat(40);
    },
  ],
  [
    'browser version mismatch',
    ({ reports }) => {
      reports[0][0].browser = 'chromium 156';
    },
  ],
  [
    'server fixture mismatch',
    ({ reports }) => {
      reports[0][0].serverFixtureAccess = false;
    },
  ],
  [
    'on/off flag mismatch',
    ({ reports }) => {
      reports[0][0].diagnostics = !reports[0][0].diagnostics;
    },
  ],
  [
    'changed predeclared order',
    ({ manifest }) => {
      manifest.executions.reverse();
    },
  ],
  [
    'extra unplanned run',
    ({ manifest, reports }) => {
      manifest.executions.push(manifest.executions[0]);
      reports.push(reports[0]);
    },
  ],
])
  test(`${name} retains the original pair inventory and prevents a gate pass`, () => {
    const sample = evidence();
    mutate(sample);
    const result = analyzeDiagnostics(sample.manifest, sample.reports);
    assert.equal(result.status, 'unresolved');
    assert.equal(result.plannedPairs, 10);
    assert.equal(result.pairs.length, 10);
    assert.equal(result.observations.length, 20);
    assert(result.reasons.length > 0);
  });

test('analysis preserves missing/invalid files and detects changed raw report bytes', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'solo-diagnostics-analysis-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { manifest, reports } = evidence([1, 1, 1]);
  for (let i = 0; i < reports.length; i++) {
    const bytes = JSON.stringify(reports[i]);
    manifest.executions[i].reportSha256 = createHash('sha256').update(bytes).digest('hex');
    if (i !== 0)
      await writeFile(join(directory, manifest.executions[i].report), i === 1 ? '{broken' : bytes);
  }
  await writeFile(
    join(directory, manifest.executions[2].report),
    JSON.stringify(reports[2], null, 2),
  );
  await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
  const result = await analyzeDirectory(directory);
  assert.equal(result.status, 'unresolved');
  assert(result.observations[0].readFailure);
  assert(result.observations[1].readFailure);
  assert.equal(result.observations[2].status, 'report-hash-mismatch');
  assert.equal(result.observations.length, 6);
});
