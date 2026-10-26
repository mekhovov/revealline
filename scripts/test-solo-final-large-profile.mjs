import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  LARGE_PROFILE_COHORT,
  LARGE_PROFILE_PHASE,
  bindSupplementalJob,
  prepareSupplementalMode,
  supplementalArguments,
  supplementalAssessment,
  supplementalMatrix,
  validateSupplementalPlan,
  validateSupplementalScenario,
} from './solo-remote-supplemental.mjs';
import { validateQualification } from './solo-qualification.mjs';

const root = new URL('../', import.meta.url);
const read = async (path) => JSON.parse(await readFile(new URL(path, root)));
const original = await read('docs/performance/solo-remote-current-retry-plan.json');
const digest = (bytes) => ({
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
});
function manifest() {
  const plan = structuredClone(original);
  // Synthetic candidate archive metadata is declaration-test data only.
  Object.assign(plan, {
    phase: 'large-profile',
    sourceCohort: LARGE_PROFILE_COHORT,
    runtimeRevision: '32abd322afd8243e4537ce4784e2f78ee45ecbec',
    repetitions: [1, 2, 3],
    candidate: {
      revision: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
      tree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
      run: 1,
      artifact: 2,
      outer: { bytes: 100, sha256: 'a'.repeat(64) },
      inner: { bytes: 90, sha256: 'b'.repeat(64) },
      manifestSHA256: 'c'.repeat(64),
    },
    phases: { 'large-profile': structuredClone(LARGE_PROFILE_PHASE) },
  });
  Object.assign(plan.release, {
    sourceCohort: LARGE_PROFILE_COHORT,
    scope: 'large-profile-public-import-diagnostics',
    candidateRevision: plan.candidate.revision,
    baselineRevision: plan.baseline.revision,
    predecessorRun: 39008793892,
    previousPhase: 'final-source-package-admission',
    diagnosticPredecessor: {
      run: 39008793892,
      conclusion: 'failure',
      nativeObservations: 0,
      allOwnersClosed: true,
      allFailuresRetained: true,
    },
    evidence: [
      {
        runId: 39008793892,
        artifactId: 12092316097,
        artifactSHA256: 'd'.repeat(64),
        summarySHA256: 'e'.repeat(64),
      },
    ],
  });
  return plan;
}
const bound = (engine = 'chromium', repetition = 1) =>
  bindSupplementalJob(manifest(), engine, repetition);

test('large-profile admission retains three paired repetitions per engine and existing observation bounds', () => {
  const matrix = supplementalMatrix(manifest()).include;
  assert.equal(matrix.length, 6);
  assert.deepEqual(
    matrix.map((x) => [x.engine, x.repetition]),
    ['chromium', 'webkit'].flatMap((engine) => [1, 2, 3].map((r) => [engine, r])),
  );
  for (const job of matrix) {
    const plan = bound(job.engine, job.repetition);
    assert.equal(plan.rows.length, 2);
    assert.deepEqual(new Set(plan.rows.map((x) => x.source)), new Set(['baseline', 'candidate']));
    assert(plan.rows.every((row) => row.timeoutMs === 480000 && row.performanceExclusion));
    assert.equal(plan.helperTimeoutMs, 4500000);
    assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
    assert.equal(plan.evidenceBytes, 256 * 1024 ** 2);
    assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
    assert.equal(plan.release.performanceQualification, 'excluded');
    assert.equal(job.jobMinutes, 130);
  }
  assert.notDeepEqual(
    bound('chromium', 1).rows.map((x) => x.source),
    bound('chromium', 2).rows.map((x) => x.source),
  );
  assert.notDeepEqual(
    bound('chromium', 1).rows.map((x) => x.source),
    bound('webkit', 1).rows.map((x) => x.source),
  );
});

test('wrong sources, missing reuse, changed workload and claimed timing credit are rejected', () => {
  for (const mutate of [
    (p) => (p.candidate.revision = original.candidate.revision),
    (p) => (p.candidate.tree = 'f'.repeat(40)),
    (p) => (p.runtimeRevision = original.runtimeRevision),
    (p) => (p.baseline.revision = 'f'.repeat(40)),
    (p) => delete p.baseline.reusableArtifact,
    (p) => (p.repetition = 4),
    (p) => p.rows.reverse(),
    (p) => p.rows.pop(),
    (p) => p.rows[0].timeoutMs++,
    (p) => p.phases['large-profile'].scenarioTimeoutMs++,
    (p) => (p.phases['large-profile'].upload.sha256 = 'f'.repeat(64)),
    (p) => p.phases['large-profile'].upload.bytes++,
    (p) => (p.phases['large-profile'].upload.stagedName = '../profile.json'),
    (p) => (p.frozenTools[0].bytes = 2 * 1024 ** 2),
    (p) => p.automaticRetries++,
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.performanceQualification = 'passed'),
    (p) => (p.release.diagnosticPredecessor.nativeObservations = 8),
    (p) => (p.hitchJournal = 'bounded-v1'),
  ]) {
    const plan = bound();
    mutate(plan);
    assert.throws(() => validateSupplementalPlan(plan));
  }
  assert.throws(() => bindSupplementalJob(manifest(), 'chromium'));
  assert.throws(() => supplementalMatrix({ ...manifest(), repetitions: [1, 2] }));
});

test('unchanged synthetic profile and public import recipe match the authored opening and declared cardinality', async () => {
  for (const ref of [LARGE_PROFILE_PHASE.recipe, LARGE_PROFILE_PHASE.upload]) {
    assert.deepEqual(digest(await readFile(new URL(ref.path, root))), {
      bytes: ref.bytes,
      sha256: ref.sha256,
    });
  }
  const scenario = await read(LARGE_PROFILE_PHASE.recipe.path),
    profile = await read(LARGE_PROFILE_PHASE.upload.path);
  validateQualification(scenario);
  validateSupplementalScenario(bound(), scenario);
  assert.deepEqual(
    scenario.expectedReplayDefinition,
    (await read('docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture'))
      .expectedReplayDefinition,
  );
  assert.equal(Object.keys(profile.campaigns).length, 480);
  assert.equal(Object.keys(profile.gallery).length, 3840);
  assert.equal(Object.keys(profile.scores).length, 960);
  assert.equal(profile.preferences.musicEnabled, false);
  assert.equal(scenario.actions.filter((a) => a.type === 'reload').length, 1);
  assert.equal(scenario.actions.find((a) => a.type === 'repeat').count, 30);
});

test('declaration runs from only its adapter, with no game imports or installed packages', async () => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'solo-profile-declare-')));
  try {
    const adapter = join(folder, 'adapter.mjs'),
      input = join(folder, 'manifest.json'),
      output = join(folder, 'bound.json');
    await writeFile(adapter, await readFile(new URL('scripts/solo-remote-supplemental.mjs', root)));
    await writeFile(input, JSON.stringify(manifest()));
    const result = execFileSync(process.execPath, [adapter, 'matrix-plan', input], {
      encoding: 'utf8',
      cwd: folder,
      timeout: 10000,
    });
    assert.equal(JSON.parse(result.trim().slice('matrix='.length)).include.length, 6);
    execFileSync(process.execPath, [adapter, 'bind-plan', input, output, 'webkit', '3'], {
      cwd: folder,
      timeout: 10000,
    });
    assert.equal(JSON.parse(await readFile(output)).repetition, 3);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('preparation verifies exact source/archive identities and stages the whole upload before the observer', async () => {
  const folder = await realpath(await mkdtemp(join(tmpdir(), 'solo-profile-prepare-')));
  try {
    const plan = bound();
    const refs = [
      plan.phases['large-profile'].recipe,
      plan.phases['large-profile'].upload,
      ...plan.adapterInputs,
      ...plan.frozenTools,
    ];
    for (const ref of refs) {
      const bytes = ref.path.startsWith('docs/performance/fixtures/solo-remote-supplemental/')
        ? await readFile(new URL(ref.path, root))
        : Buffer.from('test input');
      Object.assign(ref, digest(bytes));
      const target = join(folder, ref.path);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, bytes);
    }
    const context = {
      plan,
      repository: folder,
      work: join(folder, 'work'),
      evidence: join(folder, 'evidence'),
      report: {},
      digest: async (path) => digest(await readFile(path)),
      ensureBaseline: async () => {},
      admitted: {
        status: 'passed',
        artifacts: Object.fromEntries(
          ['baseline', 'candidate'].map((role) => {
            const archive = role === 'candidate' ? plan.candidate : plan.baseline.reusableArtifact;
            return [
              role,
              {
                sourceRevision: plan[role].revision,
                sourceTree: plan[role].tree,
                manifestSHA256: archive.manifestSHA256,
                archiveIdentity: archive.inner,
              },
            ];
          }),
        ),
      },
    };
    await mkdir(context.work);
    await mkdir(context.evidence);
    const changed = structuredClone(context.admitted);
    changed.artifacts.candidate.sourceTree = 'f'.repeat(40);
    await assert.rejects(() => prepareSupplementalMode({ ...context, admitted: changed }));
    const state = await prepareSupplementalMode(context);
    assert.equal(context.report.performanceExclusion, true);
    assert.deepEqual(
      digest(await readFile(join(state.recipePath, '..', LARGE_PROFILE_PHASE.upload.stagedName))),
      { bytes: LARGE_PROFILE_PHASE.upload.bytes, sha256: LARGE_PROFILE_PHASE.upload.sha256 },
    );
    const args = supplementalArguments(
      { ...context, here: 'scripts', modeState: state },
      plan.rows[0],
      'http://127.0.0.1/game/',
      context.evidence,
    );
    assert(args.includes(`--source-revision=${plan[plan.rows[0].source].revision}`));
    assert(!args.some((arg) => /profile|hitch-journal/.test(arg) && arg.startsWith('--')));
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('raw numeric failures remain visible and cannot earn performance credit', () => {
  const plan = bound(),
    row = plan.rows.find((x) => x.source === 'candidate');
  const raw = {
    format: 'SoloQualificationReportV1',
    kind: 'lifecycle',
    scenarioStatus: 'pass',
    sourceRevision: plan.candidate.revision,
    buildIdentity: { sourceRevision: plan.candidate.revision },
    scenarioSHA256: LARGE_PROFILE_PHASE.recipe.sha256,
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: false,
    environment: {
      engine: 'chromium',
      browserVersion: 'test',
      cpuThrottle: 1,
      contextMode: 'ephemeral',
      requestedDisplay: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine: 'chromium', browserVersion: 'test' },
    },
    performanceGateStatus: 'fail',
    pageErrors: [],
  };
  const command = { status: 'closed', exitCode: 2, survivors: [], ambiguous: [] };
  const result = supplementalAssessment(plan, row, raw, command, 'test');
  assert.equal(result.nativeRecipeCorrectness, 'pass');
  assert.equal(result.rawNumericalStatus, 'fail');
  assert.equal(result.performanceQualification, 'excluded');
  assert.equal(
    supplementalAssessment(
      plan,
      row,
      { ...raw, replayFailure: 'different checkpoint' },
      command,
      'test',
    ).status,
    'failed',
  );
});
