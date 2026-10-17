import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  SUPPLEMENTAL_PHASES,
  bindSupplementalJob,
  supplementalMatrix,
  supplementalArguments,
  supplementalAssessment,
  readSupplementalJSON,
  validateSupplementalPlan,
} from './solo-remote-supplemental.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL('docs/performance/solo-remote-supplemental-plan.json', root)),
);
function reviewed(phase = 'latency-long-rail') {
  const m = structuredClone(manifest);
  m.status = 'reviewed-diagnostic-only';
  m.phase = phase;
  Object.assign(m.release, {
    priorProofInspected: true,
    noUnclosedOwners: true,
    allPriorPlannedJobsClosed: true,
    previousPhase:
      phase === 'latency-long-rail-anchored'
        ? 'latency-long-rail'
        : (Object.keys(SUPPLEMENTAL_PHASES)[Object.keys(SUPPLEMENTAL_PHASES).indexOf(phase) - 1] ??
          'reviewed-first-eight-diagnostic'),
    evidence:
      phase === 'latency-long-rail-anchored'
        ? structuredClone(manifest.release.evidence)
        : [
            {
              runId: 1,
              artifactId: 2,
              artifactSHA256: 'a'.repeat(64),
              summarySHA256: 'b'.repeat(64),
            },
          ],
  });
  return m;
}
const plan = (engine = 'chromium', phase) => bindSupplementalJob(reviewed(phase), engine);
test('anchored successor retains the failed route and releases only its distinct native preflight', () => {
  assert.equal(manifest.phase, 'latency-long-rail-anchored');
  assert.deepEqual(
    supplementalMatrix(manifest).include.map(({ phase, engine }) => [phase, engine]),
    [
      ['latency-long-rail-anchored', 'chromium'],
      ['latency-long-rail-anchored', 'webkit'],
    ],
  );
  assert.equal(manifest.release.firstEightAllCorrectnessPassed, false);
  assert.equal(manifest.release.diagnosticPredecessor.conclusion, 'failure');
  assert.equal(manifest.routeReview.minimumActualCandidateKeyboardRenderSamples, 20);
  assert.equal(manifest.routeReview.modelIsBrowserEvidence, false);
  assert.match(manifest.routeReview.scope, /Cannot replace original two-cut route/);
  for (const mutate of [
    (p) => p.release.diagnosticPredecessor.run++,
    (p) => p.release.diagnosticPredecessor.failedRows--,
    (p) => (p.release.diagnosticPredecessor.conclusion = 'success'),
    (p) => (p.release.diagnosticPredecessor.allOwnersClosed = false),
    (p) => (p.release.diagnosticPredecessor.allFailuresRetained = false),
    (p) => p.release.evidence.splice(1, 1),
    (p) => (p.release.previousPhase = 'jammer-steering'),
  ]) {
    const p = bindSupplementalJob(manifest, 'chromium');
    mutate(p);
    assert.throws(() => validateSupplementalPlan(p));
  }
});
const closed = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
};
function raw(p, row) {
  const mobile = row.engine === 'webkit';
  return {
    format: 'SoloQualificationReportV1',
    kind: 'performance',
    scenarioStatus: 'pass',
    scenarioSHA256: p.phases[p.phase].recipe.sha256,
    sourceRevision: p[row.source].revision,
    buildIdentity: { sourceRevision: p[row.source].revision },
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: row.source === 'baseline',
    environment: {
      engine: row.engine,
      browserVersion: '123.4',
      cpuThrottle: 1,
      contextMode: mobile ? 'persistent' : 'ephemeral',
      requestedDisplay: {
        viewport: { width: mobile ? 400 : 1280, height: mobile ? 850 : 800 },
        deviceScaleFactor: mobile ? 3 : 1,
        isMobile: mobile,
        hasTouch: mobile,
      },
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine: row.engine, browserVersion: '123.4' },
    },
    pageErrors: [],
    performanceGateStatus: 'inconclusive',
    snapshots:
      row.source === 'baseline'
        ? []
        : [
            {
              application: {
                inputLatency: {
                  byKind: { keyboard: { toRender: { count: 25 } } },
                },
              },
            },
          ],
  };
}
test('held declaration cannot execute, and independent diagnostic review preserves failed prerequisite', () => {
  assert.throws(() => supplementalMatrix({ ...manifest, status: 'held-diagnostic-only' }));
  for (const change of [
    { firstEightAllCorrectnessPassed: true },
    { performanceQualification: 'passed' },
    { priorProofInspected: false },
    { noUnclosedOwners: false },
    { allPriorPlannedJobsClosed: false },
    { evidence: [] },
    { predecessorRun: 1 },
    { previousPhase: 'unknown' },
    { scope: 'timing' },
    { candidateRevision: 'f'.repeat(40) },
  ]) {
    const m = reviewed();
    Object.assign(m.release, change);
    assert.throws(() => supplementalMatrix(m));
  }
});
test('exactly one explicit phase maps two serial source pairs without repetitions or automatic continuation', () => {
  for (const phase of Object.keys(SUPPLEMENTAL_PHASES)) {
    const matrix = supplementalMatrix(reviewed(phase));
    assert.deepEqual(
      matrix.include.map(({ phase: p, engine }) => [p, engine]),
      [
        [phase, 'chromium'],
        [phase, 'webkit'],
      ],
    );
    for (const job of matrix.include) {
      assert(job.outerSeconds * 1000 > 75 * 60000);
      assert(job.stepMinutes * 60000 > job.outerSeconds * 1000 + 30000);
      assert(job.jobMinutes >= 120);
      const p = plan(job.engine, phase);
      assert.deepEqual(
        p.rows.map(({ source }) => source),
        ['baseline', 'candidate'],
      );
      assert(
        p.rows.every(
          ({ timeoutMs, performanceExclusion }) => timeoutMs === 480000 && performanceExclusion,
        ),
      );
      assert.equal(p.release.firstEightAllCorrectnessPassed, false);
    }
  }
  for (const change of [
    { cpu: 2 },
    { automaticRetries: 1 },
    { automaticPhaseContinuation: true },
    { phase: 'unknown' },
    { performanceExclusion: false },
    { maxParallel: 3 },
  ]) {
    assert.throws(() => supplementalMatrix({ ...reviewed(), ...change }));
  }
});
test('source, deadline, recipe and baseline verifier contracts cannot be altered', () => {
  for (const change of [
    (p) => p.rows.reverse(),
    (p) => p.rows[0].timeoutMs++,
    (p) => p.phases[p.phase].scenarioTimeoutMs++,
    (p) => (p.phases[p.phase].recipe.sha256 = 'c'.repeat(64)),
    (p) => (p.baseline.revision = 'f'.repeat(40)),
    (p) => p.adapterInputs.pop(),
    (p) => (p.phases[p.phase].upload.stagedName = '../elsewhere.json'),
  ]) {
    const p = plan();
    change(p);
    assert.throws(() => validateSupplementalPlan(p));
  }
});
test('all executable recipes, uploads, adapters and frozen tools match recorded bytes', async () => {
  const refs = [
    ...Object.values(manifest.phases).flatMap(({ recipe, upload }) => [recipe, upload]),
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
  ];
  for (const ref of refs) {
    const bytes = await readFile(new URL(ref.path, root));
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
  }
});
test('commands keep native elapsed controls, fixed external calibration and explicit portrait WebKit', () => {
  for (const engine of ['chromium', 'webkit']) {
    const p = plan(engine);
    for (const row of p.rows) {
      const args = supplementalArguments(
        { here: '/tools', modeState: { recipePath: '/input/scenario.json' } },
        row,
        'http://localhost/game/',
        '/evidence',
      );
      for (const arg of [
        '--server-fixture-access',
        '--work-probe',
        '--cadence=settled120',
        '--cpu=1',
        `--browser=${engine}`,
        `--source-revision=${p[row.source].revision}`,
      ])
        assert(args.includes(arg));
      assert.equal(args.includes('--baseline-runtime'), row.source === 'baseline');
      assert.equal(args.includes('--context=persistent'), engine === 'webkit');
      assert.equal(args.includes('--viewport=400x850'), engine === 'webkit');
      assert(
        !args.some((arg) => /--(audio-proof|cpu-profile|memory-profile|fixture-access)$/.test(arg)),
      );
    }
  }
});
test('native correctness remains separate from every retained numerical verdict', () => {
  for (const engine of ['chromium', 'webkit'])
    for (const phase of Object.keys(SUPPLEMENTAL_PHASES)) {
      const p = plan(engine, phase);
      for (const row of p.rows)
        for (const numerical of [
          'pass-observed-window',
          'partial-baseline-internal-unknown',
          'inconclusive',
          'review-required',
          'fail',
        ]) {
          const r = raw(p, row);
          r.performanceGateStatus = numerical;
          const result = supplementalAssessment(
            p,
            row,
            r,
            { ...closed, exitCode: numerical === 'fail' ? 2 : 0 },
            '123.4',
          );
          assert.equal(result.status, 'passed');
          assert.equal(result.rawNumericalStatus, numerical);
          assert.equal(result.performanceQualification, 'excluded');
          assert.equal(result.firstEightAllCorrectnessPassed, false);
        }
    }
});
test('scenario, exact mission replay, context, source and cleanup failures remain failures', () => {
  const p = plan('webkit'),
    row = p.rows[1];
  const mutations = [
    (r) => (r.scenarioStatus = 'fail'),
    (r) => (r.scenarioSHA256 = 'c'.repeat(64)),
    (r) => (r.replay.scope = 'partial-failed-scenario'),
    (r) => (r.replay.nativeVerification.status = 'fail'),
    (r) => (r.replay.nativeVerification.engine = 'chromium'),
    (r) => (r.replay.nativeVerification.browserVersion = 'other'),
    (r) => (r.sourceRevision = 'f'.repeat(40)),
    (r) => (r.buildIdentity.sourceRevision = 'f'.repeat(40)),
    (r) => (r.environment.engine = 'chromium'),
    (r) => (r.environment.contextMode = 'ephemeral'),
    (r) => (r.environment.requestedDisplay.deviceScaleFactor = 1),
    (r) => (r.environment.cpuThrottle = 4),
    (r) => (r.environment.browserVersion = ''),
    (r) => (r.workProbe = false),
    (r) => (r.cadenceProtocol = 'blank30'),
    (r) => (r.baselineRuntime = true),
    (r) => (r.kind = 'cpu-profile'),
    (r) => r.pageErrors.push('error'),
    (r) => (r.performanceGateStatus = 'invalid-evidence'),
    ...[
      'failure',
      'finalReadFailure',
      'failureCleanupFailure',
      'audioIdentityFailure',
      'contextCleanupFailure',
      'replayFailure',
    ].map((key) => (r) => (r[key] = 'failure')),
  ];
  for (const change of mutations) {
    const r = raw(p, row);
    change(r);
    assert.equal(supplementalAssessment(p, row, r, closed, '123.4').status, 'failed');
  }
  for (const change of [
    { exitCode: 1 },
    { exitCode: 2 },
    { status: 'timeout' },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { violation: 'rss' },
    { survivors: [1] },
    { ambiguous: [1] },
  ])
    assert.equal(
      supplementalAssessment(p, row, raw(p, row), { ...closed, ...change }, '123.4').status,
      'failed',
    );
  assert.equal(supplementalAssessment(p, row, raw(p, row), closed, 'other').status, 'failed');
});
test('steering native admission needs twenty actual candidate samples without pooling or guessing absent baseline observations', () => {
  for (const phase of [
    'latency-long-rail',
    'latency-long-rail-anchored',
    'latency-sentry',
    'jammer-steering',
  ]) {
    const p = plan('chromium', phase),
      row = p.rows[1];
    for (const count of [null, undefined, -1, 0, 19, 19.5]) {
      const r = raw(p, row);
      r.snapshots[0].application.inputLatency.byKind.keyboard.toRender.count = count;
      const result = supplementalAssessment(p, row, r, closed, '123.4');
      assert.equal(result.nativeRecipeCorrectness, 'pass');
      assert.equal(result.status, 'failed');
      assert.equal(result.steeringSampleReadiness, 'insufficient');
      assert.equal(result.performanceQualification, 'excluded');
    }
    const r = raw(p, row);
    r.snapshots[0].application.inputLatency.byKind.keyboard.toRender.count = 20;
    assert.equal(supplementalAssessment(p, row, r, closed, '123.4').status, 'passed');
    const baseline = supplementalAssessment(p, p.rows[0], raw(p, p.rows[0]), closed, '123.4');
    assert.equal(baseline.applicationKeyboardSamples, null);
    assert.equal(baseline.steeringSampleReadiness, 'baseline-internal-unobserved');
    assert.equal(baseline.performanceQualification, 'excluded');
  }
});
test('bounded raw read rejects symlinks, oversized reports and invalid JSON', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'supplemental-test-')));
  try {
    const file = join(dir, 'report.json');
    await writeFile(file, '{"status":"raw"}');
    assert.deepEqual(await readSupplementalJSON(file, 20), { status: 'raw' });
    await assert.rejects(readSupplementalJSON(file, 2));
    await symlink(file, join(dir, 'alias.json'));
    await assert.rejects(readSupplementalJSON(join(dir, 'alias.json'), 20));
    await writeFile(file, '{bad');
    await assert.rejects(readSupplementalJSON(file, 20));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('one-shot workflow and common owner registration keep one phase and all partial evidence', async () => {
  const workflow = await readFile(
    new URL('.github/workflows/solo-remote-supplemental-temporary.yml', root),
    'utf8',
  );
  assert.match(workflow, /max-parallel: 2/);
  assert(!workflow.includes('fetch-depth: 0'));
  assert(workflow.includes("github.event.before == 'bffcbd838a7bb925da8aaf030695773f893d8bda'"));
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(
    workflow,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository && (false|github\.event\.action == 'synchronize' && github\.event\.before == '[a-f0-9]{40}')/,
  );
  assert.match(
    workflow,
    /name: solo-linux-supplemental-\$\{\{ matrix\.phase \}\}-\$\{\{ matrix\.engine \}\}-\$\{\{ github\.run_id \}\}/,
  );
  assert.match(workflow, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow, /scripts\/test-solo-latency-anchored\.mjs/);
  assert(!workflow.includes('matrix.repetition'));
  const runner = await readFile(new URL('scripts/run-solo-remote-correctness.mjs', root), 'utf8');
  for (const value of [
    'SoloHostedSupplementalPlanV1',
    'validateSupplementalPlan',
    'prepareSupplementalMode',
    'runSupplementalRow',
    'SoloHostedSupplementalPreflightV1',
  ])
    assert(runner.includes(value));
  assert.match(runner, /\['auxiliary', 'supplemental'\]\.includes\(extension\)/);
});
