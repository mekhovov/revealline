import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  bindDiagnosticsJob,
  diagnosticsConfiguration,
  diagnosticsMatrix,
  diagnosticsOwnerClosed,
  diagnosticsReadback,
  DIAGNOSTICS_SOURCE,
  runDiagnosticsCohort,
  validateDiagnosticsPlan,
} from './solo-remote-diagnostics.mjs';
import { diagnosticsSchedule } from './solo-diagnostics-analysis.mjs';
import { observerArguments } from './qualify-solo-diagnostics.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const MiB = 1024 ** 2;
async function manifest() {
  const paths = [
    'scripts/solo-remote-diagnostics.mjs',
    'scripts/run-solo-remote-correctness.mjs',
    'scripts/qualify-solo-diagnostics.mjs',
    'scripts/solo-diagnostics-analysis.mjs',
    'scripts/observe-solo-performance.mjs',
    'scripts/solo-observation-lifecycle.mjs',
    'scripts/serve-production-preview.mjs',
    'scripts/game-cli.mjs',
    'scripts/solo-remote-archive.py',
    'scripts/verify-solo-build.mjs',
  ];
  const refs = await Promise.all(
    paths.map(async (path) => {
      const bytes = await readFile(join(repository, path));
      return { path, bytes: bytes.length, sha256: sha(bytes) };
    }),
  );
  // Synthetic unit-test archive identity, never written as an executable release.
  return {
    format: 'SoloHostedDiagnosticsManifestV1',
    status: 'reviewed-app-diagnostics-only',
    repository: 'mekhovov/revealline',
    candidate: {
      revision: DIAGNOSTICS_SOURCE,
      tree: '71f7e4cb3b0a39c1d281635774371a693794dd22',
      inner: { bytes: 1, sha256: '0'.repeat(64) },
    },
    baseline: {
      revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
      tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
    },
    node: '22.13.1',
    playwright: '1.62.1',
    performanceExclusion: true,
    automaticRetries: 0,
    automaticPhaseContinuation: false,
    maxParallel: 1,
    setupTimeoutMs: 2400000,
    helperTimeoutMs: 5100000,
    evidenceBytes: 512 * MiB,
    rowEvidenceBytes: 128 * MiB,
    observation: {
      pairs: 10,
      seed: 1544,
      activeMs: 30000,
      armTimeoutMs: 360000,
      timerTimeoutMs: 180000,
      cpuRate: 1,
      reportBytes: 4 * MiB,
      timerBytes: MiB,
      analysisBytes: 16 * MiB,
      overheadLimit: 0.05,
      profile: 'fresh profile',
      fixtureAccess: 'server',
      hitchJournal: false,
      cpuProfile: false,
      heap: false,
      screenshots: false,
      crossOriginIsolationOverride: false,
    },
    release: {
      scope: 'app-diagnostics-overhead-only',
      candidateRevision: DIAGNOSTICS_SOURCE,
      onceOnlyBefore: DIAGNOSTICS_SOURCE,
      firstEightAllCorrectnessPassed: false,
      gameplayPerformanceQualification: false,
      hitchJournalOverheadQualification: false,
      priorProofInspected: true,
      noUnclosedOwners: true,
      allPriorPlannedJobsClosed: true,
    },
    adapterInputs: refs.slice(0, 1),
    frozenTools: refs.slice(1),
  };
}
const closed = () => ({
  status: 'closed',
  exitCode: 0,
  signal: null,
  forcedCleanup: false,
  cleanupUnconfirmed: false,
  violation: null,
  survivors: [],
  ambiguous: [],
});
async function temporary(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'solo-diagnostics-adapter-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('separate engine jobs freeze one exact 10-pair cohort with the original bounds', async () => {
  const input = await manifest();
  assert.deepEqual(diagnosticsMatrix(input), {
    include: ['chromium', 'webkit'].map((engine) => ({
      engine,
      jobMinutes: 130,
      stepMinutes: 88,
      outerSeconds: 5220,
    })),
  });
  for (const engine of ['chromium', 'webkit']) {
    const plan = bindDiagnosticsJob(input, engine);
    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0].timeoutMs, 1800000);
    assert.equal(plan.engine, engine);
    assert.equal(plan.candidate.revision, DIAGNOSTICS_SOURCE);
  }
  assert.equal(input.engine, undefined);
  for (const mutate of [
    (p) => (p.observation.pairs = 9),
    (p) => p.observation.seed++,
    (p) => p.observation.activeMs++,
    (p) => (p.observation.overheadLimit = 0.06),
    (p) => (p.observation.hitchJournal = true),
    (p) => (p.observation.crossOriginIsolationOverride = true),
    (p) => (p.observation.cpuRate = 2),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.automaticRetries = 1),
    (p) => (p.candidate.revision = '1'.repeat(40)),
    (p) => p.frozenTools.pop(),
  ]) {
    const plan = bindDiagnosticsJob(input, 'chromium');
    mutate(plan);
    assert.throws(() => validateDiagnosticsPlan(plan));
  }
});

test('observer commands differ only by declared mode and report path; no intrusive flags', async () => {
  const plan = bindDiagnosticsJob(await manifest(), 'webkit');
  const config = diagnosticsConfiguration(
    { plan },
    'http://127.0.0.1:9000/game/?journey=opening',
    '/tmp/new',
  );
  const off = observerArguments(config, { diagnostics: false, report: 'off.json' });
  const on = observerArguments(config, { diagnostics: true, report: 'on.json' });
  assert.deepEqual(
    on.map((x) =>
      x.replace('on.json', 'arm.json').replace('--diagnostics=1', '--diagnostics=MODE'),
    ),
    off.map((x) =>
      x.replace('off.json', 'arm.json').replace('--diagnostics=0', '--diagnostics=MODE'),
    ),
  );
  for (const flag of [
    '--runs=1',
    '--duration=30000',
    '--cpu=1',
    '--input-probe',
    '--work-probe',
    '--quality-probe',
    '--server-fixture-access',
  ])
    assert(on.includes(flag));
  assert(!on.some((x) => /^--(hitch|cpu-profile|heap|warm|fixture-access)/.test(x)));
});

test('owner assessment rejects incomplete, forced, failed, ambiguous and surviving owners', () => {
  assert(diagnosticsOwnerClosed(closed()));
  for (const change of [
    { status: 'running' },
    { exitCode: 1 },
    { signal: 'SIGTERM' },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { violation: 'RSS cap' },
    { survivors: [12] },
    { ambiguous: [13] },
    { survivors: undefined },
  ])
    assert.equal(diagnosticsOwnerClosed({ ...closed(), ...change }), false);
});

test('bounded binary readback rejects symlinks, oversized and malformed reports', async (t) => {
  const dir = await temporary(t);
  const path = join(dir, 'report.json'),
    bytes = Buffer.from('{ "ordered": true }\n');
  await writeFile(path, bytes);
  assert.deepEqual(await diagnosticsReadback(path, 100), {
    value: { ordered: true },
    identity: { bytes: bytes.length, sha256: sha(bytes) },
  });
  await assert.rejects(diagnosticsReadback(path, 1));
  await symlink(path, join(dir, 'alias.json'));
  await assert.rejects(diagnosticsReadback(join(dir, 'alias.json'), 100));
  await writeFile(path, 'invalid');
  await assert.rejects(diagnosticsReadback(path, 100));
});

test('timer-only child closes its provider before writing a fresh report and refuses overwrite', async (t) => {
  const dir = await temporary(t);
  const module = join(dir, 'fake-playwright.mjs');
  const output = join(dir, 'timer.json');
  const closure = join(dir, 'closed.json');
  await writeFile(
    module,
    `
    import { writeFile } from 'node:fs/promises';
    export const chromium = { async launch(options) {
      let address;
      return {
        version: () => 'unit-browser',
        async newPage() { return {
          async goto(value) { address = value; },
          async evaluate() { return { address, crossOriginIsolated: false, userAgent: 'unit',
            minimumPositiveStepMs: 0.1, maximumPositiveStepMs: 1, positiveSteps: 100, iterations: 200 }; },
        }; },
        async close() { await writeFile(process.env.TIMER_CLOSE_RECEIPT, JSON.stringify({ closed: true, options })); },
      };
    } };
  `,
  );
  const args = [
    join(repository, 'scripts/qualify-solo-diagnostics.mjs'),
    'timer-probe',
    'http://127.0.0.1:9000/game/?journey=opening',
    output,
    `--source-revision=${DIAGNOSTICS_SOURCE}`,
  ];
  const options = {
    env: { ...process.env, PLAYWRIGHT_MODULE: module, TIMER_CLOSE_RECEIPT: closure },
    timeout: 5000,
    maxBuffer: MiB,
  };
  await promisify(execFile)(process.execPath, args, options);
  assert.equal(JSON.parse(await readFile(closure)).closed, true);
  const original = await readFile(output);
  const report = JSON.parse(original);
  assert.equal(report.status, 'observed');
  assert.equal(report.browser, 'chromium unit-browser');
  assert.equal(report.crossOriginIsolated, false);
  await assert.rejects(promisify(execFile)(process.execPath, args, options), /EEXIST/);
  assert((await readFile(output)).equals(original));
});

function observation(configuration, diagnostics, browser) {
  const work = diagnostics ? 1.01 : 1;
  return [
    {
      status: 'observed',
      sourceRevision: DIAGNOSTICS_SOURCE,
      requestedActiveMs: 30000,
      address: configuration.address + `&performance=${Number(diagnostics)}`,
      diagnostics,
      independentWorkProbe: true,
      qualityProbe: true,
      cpuRate: 1,
      browser,
      host: { arch: 'x64', osRelease: 'unit-host', initialLoad: [1], finalLoad: [1] },
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
      ...(diagnostics
        ? {
            application: {
              enabled: true,
              sourceRevision: DIAGNOSTICS_SOURCE,
              interruptions: { count: 0 },
              failures: { count: 0 },
              quality: { tier: 'full' },
            },
          }
        : {}),
      external: {
        names: ['briefing', 'running', 'paused'],
        width: 7,
        totals: [0, 0, 0, 0, 0, 0, 0, 200, 30000, 16.7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        workProbe: {
          width: 3,
          count: 200,
          totals: [0, 0, 0, 200, work * 200, work, 0, 0, 0],
          recent: Array.from({ length: 200 }, () => [work, 1]).flat(),
        },
        qualityProbe: {
          dropped: 0,
          samples: [
            { label: 'before-start', at: 2500, flight: 'briefing', quality: 'full' },
            { label: 'active-start', at: 3000, flight: 'running', quality: 'full' },
            ...Array.from({ length: 120 }, (_, i) => ({
              label: 'active',
              at: 3250 + i * 250,
              flight: 'running',
              quality: 'full',
            })),
            { label: 'before-pause', at: 33001, flight: 'running', quality: 'full' },
          ],
        },
      },
    },
  ];
}

async function cohort(t, change = {}) {
  const dir = await temporary(t);
  const plan = bindDiagnosticsJob(await manifest(), 'chromium');
  const url = 'http://127.0.0.1:9000/game/?journey=opening';
  const config = diagnosticsConfiguration({ plan }, url, dir);
  const row = structuredClone(plan.rows[0]),
    calls = [];
  const browser = 'chromium 151.0.7922.34';
  let elapsed = 0;
  const ctx = {
    plan,
    repository,
    here: join(repository, 'scripts'),
    cleanEnv: {},
    modeState: {},
    report: {},
    inspect: async () => {
      elapsed += change.elapsedPerInspect ?? 0;
    },
    evidenceSize: async () => 0,
    digest: async (path) => {
      const bytes = await readFile(path);
      return { bytes: bytes.length, sha256: sha(bytes) };
    },
    run: async (id, argv, timeout, options) => {
      calls.push({ id, argv, timeout, options });
      assert(timeout > 0 && timeout <= (id.endsWith('-timer') ? 180000 : 360000));
      assert.equal(options.env.TMPDIR, dir);
      const planned = JSON.parse(await readFile(join(dir, 'manifest.json')));
      assert.equal(planned.executions.length, 20, 'Full inventory exists before first child');
      if (id.endsWith('-timer')) {
        await writeFile(
          join(dir, 'timer.json'),
          JSON.stringify({
            status: 'observed',
            address: url,
            crossOriginIsolated: false,
            userAgent: 'unit-browser',
            browser,
            minimumPositiveStepMs: change.quantum ?? 0.001,
            positiveSteps: 100,
          }),
        );
      } else {
        const order = Number(id.split('-').at(-1));
        if (change.throwOwner === order) throw Error('Unclosed owner; remaining rows withheld');
        const data = observation(config, diagnosticsSchedule()[order].diagnostics, browser);
        change.raw?.(data, order);
        await writeFile(argv[3], JSON.stringify(data));
        elapsed += change.elapsedPerArm ?? 1;
      }
      return { ...closed(), ...(change.command?.(id) ?? {}) };
    },
  };
  await runDiagnosticsCohort(ctx, row, dir, dir, url, () => elapsed);
  return {
    row,
    calls,
    manifest: JSON.parse(await readFile(join(dir, 'manifest.json'))),
    analysis: JSON.parse(await readFile(join(dir, 'analysis.json'))),
  };
}

test('all20 separately owned arms retain exact schedule/raw hashes and unchanged pass analysis', async (t) => {
  const result = await cohort(t);
  assert.equal(result.calls.length, 21);
  assert.equal(result.row.status, 'passed');
  assert.equal(result.row.appDiagnosticsOverhead, 'pass');
  assert.equal(result.row.hitchJournalOverhead, 'not-measured');
  assert.equal(result.analysis.limit, 0.05);
  assert.equal(result.analysis.completePairs, 10);
  assert.deepEqual(
    result.manifest.executions.map(({ order, pair, diagnostics }) => ({
      order,
      pair,
      diagnostics,
    })),
    diagnosticsSchedule(10, 1544),
  );
  assert(result.manifest.executions.every((x) => x.reportSha256 && x.command.status === 'closed'));
});

test('safe failed arm stays in all20 inventory and prevents pass without replacement', async (t) => {
  const result = await cohort(t, {
    raw: (rows, order) => {
      if (order === 4) rows[0].status = 'failed';
    },
  });
  assert.equal(result.calls.length, 21);
  assert.equal(result.row.status, 'failed');
  assert.equal(result.analysis.status, 'unresolved');
  assert.equal(result.analysis.observations.length, 20);
  assert.equal(result.analysis.completePairs, 9);
});

test('failed timer ownership retains the probe and leaves all20 arms unobserved', async (t) => {
  const result = await cohort(t, { command: () => ({ forcedCleanup: true }) });
  assert.equal(result.calls.length, 1);
  assert.equal(result.row.status, 'failed');
  assert.match(result.row.cohortFailure, /Timer child/);
  assert(result.row.timerReadback.sha256);
  assert(result.manifest.executions.every((x) => x.status === 'not-observed'));
  assert.equal(result.analysis.observations.length, 20);
});

test('unsafe owner closes admission; all remaining arms stay explicitly unobserved', async (t) => {
  const result = await cohort(t, { throwOwner: 2 });
  assert.equal(result.calls.length, 4);
  assert.equal(result.row.status, 'failed');
  assert.match(result.row.cohortFailure, /owner/i);
  assert.equal(result.manifest.executions[2].status, 'failed');
  assert(result.manifest.executions.slice(3).every((x) => x.status === 'not-observed'));
  assert.equal(result.analysis.observations.length, 20);
});

test('cohort deadline cannot become20 independent360s allowances', async (t) => {
  const result = await cohort(t, { elapsedPerArm: 400000 });
  assert.equal(result.calls.length, 6);
  assert.equal(result.calls.at(-1).timeout, 200000);
  assert.match(result.row.cohortFailure, /cohort deadline/);
  assert(result.manifest.executions.slice(5).every((x) => x.status === 'not-observed'));
  assert.equal(result.analysis.plannedPairs, 10);
});

test('deadline crossed during async inspection does not admit a zero-budget native child', async (t) => {
  const result = await cohort(t, { elapsedPerInspect: 1800000 });
  assert.equal(result.calls.length, 0);
  assert.match(result.row.cohortFailure, /deadline before child admission/);
  assert(result.manifest.executions.every((x) => x.status === 'not-observed'));
  assert.equal(result.analysis.status, 'unresolved');
});

test('normal coarse timer uncertainty stays unresolved at the original5% limit', async (t) => {
  const result = await cohort(t, { quantum: 0.1 });
  assert.equal(result.calls.length, 21);
  assert.equal(result.analysis.completePairs, 10);
  assert.equal(result.analysis.status, 'unresolved');
  assert.equal(result.analysis.limit, 0.05);
});
