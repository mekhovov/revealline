import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bindDiagnosticsJob,
  validateDiagnosticsPlan,
  diagnosticsMatrix,
  journalCostArguments,
  runDiagnosticsCohort,
  FINAL_DIAGNOSTICS_COHORT,
} from './solo-remote-diagnostics.mjs';
import { JOURNAL_COST_RECIPE } from './solo-journal-cost-analysis.mjs';
const MiB = 1024 ** 2;
function manifest() {
  const paths = [
    'run-solo-remote-correctness',
    'qualify-solo-diagnostics',
    'solo-diagnostics-analysis',
    'observe-solo-performance',
    'solo-observation-lifecycle',
    'serve-production-preview',
    'game-cli',
    'verify-solo-build',
    'qualify-solo-runtime',
    'solo-qualification-journal-cost',
    'solo-qualification-hitch-journal',
    'solo-journal-cost-analysis',
    'solo-remote-sustained',
    'solo-qualification',
    'solo-qualification-audio',
    'solo-qualification-native-replay',
    'solo-qualification-export',
    'solo-qualification-cpu-profile',
    'solo-qualification-replay-identity',
    'solo-qualification-browser-context',
    'solo-qualification-cadence',
    'solo-qualification-observation',
  ].map((name) => `scripts/${name}.mjs`);
  paths.push('scripts/solo-remote-archive.py');
  const ref = (path) => ({ path, bytes: 1, sha256: '0'.repeat(64) });
  return {
    format: 'SoloHostedDiagnosticsManifestV1',
    probe: 'journal-hook-cost-v1',
    status: 'reviewed-journal-hook-cost-only',
    repository: 'mekhovov/revealline',
    candidate: {
      revision: 'cce49c81d82b79aefc24898f32eeebc609e569fb',
      tree: '71f7e4cb3b0a39c1d281635774371a693794dd22',
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
      armTimeoutMs: 240000,
      timerTimeoutMs: 180000,
      cpuRate: 1,
      reportBytes: 4 * MiB,
      timerBytes: MiB,
      analysisBytes: 16 * MiB,
      overheadLimit: 0.05,
      profile: 'fresh profile',
      fixtureAccess: 'server',
      hitchJournal: 'matched-on-off',
      cpuProfile: false,
      heap: false,
      screenshots: false,
      crossOriginIsolationOverride: false,
    },
    recipe: { ...JOURNAL_COST_RECIPE },
    release: {
      scope: 'journal-hook-cost-only',
      candidateRevision: 'cce49c81d82b79aefc24898f32eeebc609e569fb',
      onceOnlyBefore: 'cce49c81d82b79aefc24898f32eeebc609e569fb',
      firstEightAllCorrectnessPassed: false,
      gameplayPerformanceQualification: false,
      hitchJournalOverheadQualification: false,
      fullJournalOverheadQualification: false,
      measurementScope: 'synchronous-hook-envelope-only',
      priorProofInspected: true,
      noUnclosedOwners: true,
      allPriorPlannedJobsClosed: true,
    },
    adapterInputs: [ref('scripts/solo-remote-diagnostics.mjs')],
    frozenTools: paths.map(ref),
  };
}
test('held journal subtype fixes source, unchanged10pairs, recipe, envelopes and both engines', () => {
  const f = manifest();
  const matrix = diagnosticsMatrix(f);
  assert.equal(matrix.include.length, 2);
  for (const engine of ['chromium', 'webkit']) {
    const plan = bindDiagnosticsJob(f, engine);
    assert.equal(plan.rows[0].kind, 'journal-hook-cost-overhead');
    assert.equal(plan.rows[0].timeoutMs, 1800000);
    assert.equal(plan.observation.pairs, 10);
  }
});
test('successor journal admission keeps the full original recipe, pairs and limited scope', () => {
  const legacy = manifest();
  const current = manifest();
  current.sourceCohort = FINAL_DIAGNOSTICS_COHORT;
  current.runtimeRevision = '32abd322afd8243e4537ce4784e2f78ee45ecbec';
  current.candidate.revision = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
  current.candidate.tree = '6b13627e324f695b6ee8d9f2dee2eeeb7217c332';
  Object.assign(current.release, {
    sourceCohort: current.sourceCohort,
    candidateRevision: current.candidate.revision,
    onceOnlyBefore: current.candidate.revision,
  });
  assert.deepEqual(diagnosticsMatrix(current), diagnosticsMatrix(legacy));
  for (const engine of ['chromium', 'webkit']) {
    const plan = bindDiagnosticsJob(current, engine);
    assert.deepEqual(plan.observation, legacy.observation);
    assert.deepEqual(plan.recipe, legacy.recipe);
    assert.equal(plan.release.fullJournalOverheadQualification, false);
    assert.equal(plan.release.measurementScope, 'synchronous-hook-envelope-only');
    for (const mutate of [
      (p) => (p.release.fullJournalOverheadQualification = true),
      (p) => (p.release.measurementScope = 'all-browser-work'),
      (p) => (p.observation.hitchJournal = false),
      (p) => (p.observation.overheadLimit = 0.1),
      (p) => (p.recipe.bytes += 1),
    ]) {
      const changed = structuredClone(plan);
      mutate(changed);
      assert.throws(() => validateDiagnosticsPlan(changed));
    }
  }
});
test('journal subtype rejects widened sources, budgets, recipe, flags and missing helper closure', () => {
  for (const mutate of [
    (p) => {
      p.candidate.revision = 'a'.repeat(40);
    },
    (p) => {
      p.probe = 'anything';
    },
    (p) => {
      p.observation.pairs = 3;
    },
    (p) => {
      p.observation.overheadLimit = 0.1;
    },
    (p) => {
      p.observation.armTimeoutMs = 360000;
    },
    (p) => {
      p.rowEvidenceBytes++;
    },
    (p) => {
      p.recipe.bytes++;
    },
    (p) => {
      p.recipe.sha256 = 'a'.repeat(64);
    },
    (p) => {
      p.observation.cpuProfile = true;
    },
    (p) => {
      p.release.fullJournalOverheadQualification = true;
    },
    (p) => {
      p.release.gameplayPerformanceQualification = true;
    },
    (p) => {
      p.frozenTools = p.frozenTools.filter(
        (r) => !r.path.endsWith('solo-qualification-journal-cost.mjs'),
      );
    },
  ]) {
    const plan = bindDiagnosticsJob(manifest(), 'chromium');
    mutate(plan);
    assert.throws(() => validateDiagnosticsPlan(plan));
  }
});
test('matched commands differ only byjournal flag and public output path, never app diagnostics or workload', () => {
  const ctx = {
    plan: bindDiagnosticsJob(manifest(), 'webkit'),
    here: '/tools',
    modeState: { recipePath: '/owned/scenario.json' },
  };
  const off = journalCostArguments(
    ctx,
    { diagnostics: false },
    'http://localhost/game/',
    '/owned/off.json',
  );
  const on = journalCostArguments(
    ctx,
    { diagnostics: true },
    'http://localhost/game/',
    '/owned/on.json',
  );
  assert.deepEqual(
    on.filter((x) => x !== '--hitch-journal').map((x) => x.replace('/on.json', '/arm.json')),
    off.map((x) => x.replace('/off.json', '/arm.json')),
  );
  for (const flag of [
    '--work-probe',
    '--journal-cost-probe',
    '--cadence=settled120',
    '--cpu=1',
    '--context=persistent',
  ])
    assert(on.includes(flag));
  assert(
    !on.some(
      (x) =>
        x.startsWith('--cpu-profile') ||
        x.startsWith('--memory-profile') ||
        x.startsWith('--audio-proof'),
    ),
  );
});

test('new cohort retains all20 owned reports and incomplete journal readback without a false pass', async (t) => {
  const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-journal-cost-cohort-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = manifest();
  input.candidate.inner = { bytes: 1, sha256: '0'.repeat(64) }; // Synthetic test-only package.
  const digest = async (path) => {
    const bytes = await readFile(path);
    return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  };
  for (const ref of [...input.adapterInputs, ...input.frozenTools])
    Object.assign(ref, await digest(join(repository, ref.path)));
  const plan = bindDiagnosticsJob(input, 'chromium'),
    row = { ...plan.rows[0] },
    calls = [];
  const url = 'http://127.0.0.1:9000/game/?journey=opening';
  const closed = {
    status: 'closed',
    exitCode: 0,
    signal: null,
    forcedCleanup: false,
    cleanupUnconfirmed: false,
    violation: null,
    survivors: [],
    ambiguous: [],
  };
  const ctx = {
    plan,
    repository,
    here: join(repository, 'scripts'),
    cleanEnv: {},
    modeState: { recipePath: join(repository, input.recipe.path) },
    report: {},
    inspect: async () => {},
    evidenceSize: async () => 0,
    digest,
    run: async (id, argv, timeout) => {
      calls.push({ id, argv, timeout });
      const stored = JSON.parse(await readFile(join(dir, 'manifest.json')));
      assert.equal(stored.executions.length, 20);
      if (id.endsWith('-timer'))
        await writeFile(
          join(dir, 'timer.json'),
          JSON.stringify({
            status: 'observed',
            address: url,
            crossOriginIsolated: false,
            userAgent: 'unit',
            browser: 'chromium 151',
            minimumPositiveStepMs: 0.001,
            positiveSteps: 100,
          }),
        );
      else {
        assert(timeout > 0 && timeout <= 240000);
        assert(argv.includes('--journal-cost-probe'));
        const data = { environment: { browserVersion: '151' } };
        await writeFile(argv[4], JSON.stringify(data));
      }
      return { ...closed };
    },
  };
  await runDiagnosticsCohort(ctx, row, dir, dir, url, () => 0);
  const stored = JSON.parse(await readFile(join(dir, 'manifest.json'))),
    analysis = JSON.parse(await readFile(join(dir, 'analysis.json')));
  assert.equal(calls.length, 21);
  assert.equal(analysis.observations.length, 20);
  assert.equal(row.status, 'failed');
  assert.equal(row.synchronousJournalHookOverhead, 'unresolved');
  assert.equal(row.appDiagnosticsOverhead, 'not-measured');
  assert.equal(row.hitchJournalOverhead, 'not-measured');
  assert.equal(
    stored.observerSha256,
    plan.frozenTools.find((x) => x.path.endsWith('/qualify-solo-runtime.mjs')).sha256,
  );
  assert.equal(stored.observerLifecycleSha256, undefined);
  assert(stored.journalCostProbeSha256 && stored.hitchJournalSha256);
  assert(stored.executions.every((x) => x.command.status === 'closed' && x.reportSha256));
  assert(
    stored.executions
      .filter((x) => x.diagnostics)
      .every((x) => x.journalReadback.status === 'invalid-evidence'),
  );
  assert(stored.executions.filter((x) => !x.diagnostics).every((x) => !x.journalReadback));
  assert(
    calls
      .slice(1)
      .every(
        (call, index) =>
          call.argv.includes('--hitch-journal') === stored.executions[index].diagnostics,
      ),
  );
});
