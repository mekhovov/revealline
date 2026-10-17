import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  bindSustainedJob,
  bindTimingJob,
  SUSTAINED_PHASES,
  TIMING_PHASES,
  timingMatrix,
  timingAssessment,
  sustainedArguments,
  validateTimingPlan,
  verifiedMidCalibration,
} from './solo-remote-sustained.mjs';
import { validateQualification } from './solo-qualification.mjs';

const draft = JSON.parse(
  await readFile(new URL('../docs/performance/solo-remote-timing-plan.json', import.meta.url)),
);
const baseline = 'b11745223861c3973ad4bf440cc536198b8e0371';
const candidate = '1'.repeat(40);
const runtime = '2'.repeat(40);
function released(phase = 'cold-first30') {
  const plan = structuredClone(draft);
  Object.assign(plan, { phase, latestSourceRevision: candidate, latestRuntimeRevision: runtime });
  plan.candidate.revision = candidate;
  plan.release = {
    format: 'SoloHostedTimingReleaseV1',
    status: 'reviewed-and-released',
    phase,
    previousPhase: TIMING_PHASES[phase].previous,
    candidateRevision: candidate,
    baselineRevision: baseline,
    latestRuntimeRevision: runtime,
    noUnclosedOwners: true,
    allPriorPlannedJobsClosed: true,
    priorProofInspected: true,
    firstEightAllCorrectnessPassed: true,
    latestProductionPackageVerified: true,
    evidence: [
      {
        runId: 1,
        artifactId: 2,
        artifactSHA256: 'a'.repeat(64),
        summarySHA256: 'b'.repeat(64),
        disposition: 'passed',
      },
    ],
  };
  return plan;
}
const plan = (phase = 'cold-first30', engine = 'chromium', repetition = 1) =>
  bindTimingJob(released(phase), engine, repetition);
const closed = { status: 'closed', exitCode: 0 };
function report(p, role = 'candidate') {
  const engine = p.engine;
  return {
    scenarioStatus: 'pass',
    scenarioSHA256: p.recipes[p.phase].sha256,
    sourceRevision: p[role].revision,
    buildIdentity: { sourceRevision: p[role].revision },
    kind: 'performance',
    scenarioKind: 'performance',
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: role === 'baseline',
    cacheMode: p.phase === 'warm-first30' ? 'warm-http-reload' : 'fresh-context',
    environment: {
      engine,
      browserVersion: '123.4',
      contextMode: engine === 'webkit' ? 'persistent' : 'ephemeral',
      requestedDisplay:
        engine === 'webkit'
          ? {
              viewport: { width: 400, height: 850 },
              deviceScaleFactor: 3,
              isMobile: true,
              hasTouch: true,
            }
          : {
              viewport: { width: 1280, height: 800 },
              deviceScaleFactor: 1,
              isMobile: false,
              hasTouch: false,
            },
      contextOwner: { cleanup: { status: 'closed', browserClosed: true, profileRemoved: true } },
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine, browserVersion: '123.4' },
    },
    pageErrors: [],
    resources: [],
    performanceGateStatus: 'pass-observed-window',
  };
}

test('the prospective latest-source draft cannot execute without actual artifact and release', () => {
  const unreleased = structuredClone(draft);
  unreleased.release.status = 'pending-review';
  assert.throws(() => bindTimingJob(unreleased, 'chromium', 1));
  for (const mutate of [
    (p) => {
      p.release.firstEightAllCorrectnessPassed = false;
    },
    (p) => {
      p.release.latestProductionPackageVerified = false;
    },
    (p) => {
      p.release.noUnclosedOwners = false;
    },
    (p) => {
      p.release.previousPhase = 'diagnostics';
    },
    (p) => {
      p.latestSourceRevision = '3'.repeat(40);
    },
    (p) => {
      p.release.latestRuntimeRevision = '3'.repeat(40);
    },
    (p) => {
      p.release.evidence = [];
    },
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateTimingPlan(p));
  }
});

test('independent diagnostic admission retains false prerequisite, exact source and six equivalent jobs', () => {
  const matrix = timingMatrix(draft);
  assert.equal(draft.phase, 'cold-first30');
  assert.equal(matrix.include.length, 6);
  assert.equal(draft.release.firstEightAllCorrectnessPassed, false);
  for (const { engine, repetition } of matrix.include) {
    const p = bindTimingJob(draft, engine, repetition);
    assert.equal(p.candidate.revision, '3adcd53792043ef02459e86168c6b33a66d6ef00');
    assert.equal(p.baseline.revision, baseline);
    assert.equal(p.performanceExclusion, true);
    assert.equal(p.release.performanceQualification, 'not-qualified-diagnostic-only');
    assert.deepEqual(
      p.rows.map((r) => r.source),
      repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
    );
    assert(p.rows.every((r) => r.timeoutMs === 480000 && r.performanceExclusion));
  }
  for (const change of [
    { firstEightAllCorrectnessPassed: true },
    { performanceQualification: 'passed' },
    { automaticRetries: 1 },
    { automaticPhaseContinuation: true },
    { noUnclosedOwners: false },
    { allPriorPlannedJobsClosed: false },
    { priorProofInspected: false },
    { evidence: [] },
    { predecessorRun: 1 },
    { scope: 'qualification' },
  ]) {
    const m = structuredClone(draft);
    Object.assign(m.release, change);
    assert.throws(() => timingMatrix(m));
  }
  const changed = structuredClone(draft);
  changed.candidate.revision =
    changed.latestSourceRevision =
    changed.release.candidateRevision =
      '1'.repeat(40);
  assert.throws(() => timingMatrix(changed));
});

test('diagnostic admission preserves cold/warm/combat recipe commands and every numeric failure', () => {
  for (const phase of Object.keys(TIMING_PHASES))
    for (const engine of ['chromium', 'webkit']) {
      const m = structuredClone(draft);
      m.phase = m.release.phase = phase;
      m.release.previousPhase = TIMING_PHASES[phase].previous;
      const p = bindTimingJob(m, engine, 1),
        row = p.rows[1];
      const q = structuredClone(p);
      q.release.status = 'reviewed-and-released';
      q.release.firstEightAllCorrectnessPassed = true;
      q.performanceExclusion = false;
      for (const r of q.rows) r.performanceExclusion = false;
      validateTimingPlan(q);
      const args = (plan) =>
        sustainedArguments(
          { plan, here: '/tools', modeState: { cpu: 2, recipePath: '/owned/recipe.json' } },
          row,
          'http://localhost/game/',
          '/evidence',
        );
      assert.deepEqual(args(p), args(q));
      for (const performance of [
        'pass-observed-window',
        'fail',
        'inconclusive',
        'review-required',
        'partial-baseline-internal-unknown',
        'invalid-evidence',
      ]) {
        const r = report(p);
        r.performanceGateStatus = performance;
        const command = { ...closed, exitCode: performance === 'fail' ? 2 : 0 };
        const observed = timingAssessment(p, row, r, command, '123.4');
        const original = timingAssessment(q, row, r, command, '123.4');
        assert.equal(observed.status, original.status);
        assert.equal(observed.status, performance === 'pass-observed-window' ? 'passed' : 'failed');
        assert.equal(observed.rawPerformanceGateStatus, performance);
        assert.equal(observed.performanceQualification, 'not-qualified-diagnostic-only');
        assert.equal(observed.firstEightAllCorrectnessPassed, false);
        assert.equal(observed.correctness, original.correctness);
      }
      const r = report(p);
      r.replay.nativeVerification.status = 'fail';
      assert.equal(timingAssessment(p, row, r, closed, '123.4').status, 'failed');
    }
});

test('cold diagnostic release freezes tools and runs only the declared event edge', async () => {
  assert(draft.frozenTools.some((ref) => ref.path === 'scripts/solo-qualification-audio.mjs'));
  for (const ref of [...draft.adapterInputs, ...draft.frozenTools]) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
  }
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-timing-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(
    workflow,
    /github\.event\.action == 'synchronize' && github\.event\.before == '69fdc854ecc07eca46a3becc3e38c233a3865fb0'/,
  );
  assert.match(workflow, /max-parallel: 6/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert(!workflow.includes('fetch-depth: 0'));
});

test('four explicit releases produce24jobs and48paired observations with fixed order and bounds', () => {
  const jobs = [];
  for (const phase of Object.keys(TIMING_PHASES)) {
    const matrix = timingMatrix(released(phase)).include;
    assert.equal(matrix.length, 6);
    for (const entry of matrix) {
      const p = plan(phase, entry.engine, entry.repetition);
      jobs.push(p);
      assert.equal(entry.jobMinutes, 120);
      assert.equal(p.helperTimeoutMs, 75 * 60000);
      assert.deepEqual(
        p.rows.map((r) => r.source),
        entry.repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
      );
      assert(p.rows.every((r) => r.timeoutMs === 480000 && !r.performanceExclusion));
    }
  }
  assert.equal(jobs.length, 24);
  assert.equal(jobs.flatMap((j) => j.rows).length, 48);
  const bad = released();
  bad.jobs.pop();
  assert.throws(() => timingMatrix(bad));
});

test('legacy lifecycle phase defaults and exact bound source remain unchanged', () => {
  assert.deepEqual(Object.keys(SUSTAINED_PHASES), [
    'long29',
    'soak',
    'next',
    'retry',
    'diagnostics',
  ]);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(SUSTAINED_PHASES).map(([k, v]) => [
        k,
        [v.timeoutMs, v.helperMinutes, v.jobMinutes],
      ]),
    ),
    {
      long29: [2640000, 145, 190],
      soak: [2640000, 145, 190],
      next: [1440000, 105, 150],
      retry: [1140000, 95, 140],
      diagnostics: [1800000, 85, 130],
    },
  );
  assert.throws(() => bindSustainedJob(released(), 'chromium', 1));
});

test('frozen timing recipes retain original public controls, requirements and deadlines', async () => {
  const recipes = {};
  for (const [key, ref] of Object.entries(draft.recipes)) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256);
    assert.equal(bytes.length, ref.bytes);
    if (!key.endsWith('-level')) {
      recipes[key] = JSON.parse(bytes);
      validateQualification(recipes[key]);
    }
  }
  assert.equal(recipes['cold-first30'].timeoutMs, 240000);
  assert.equal(recipes['warm-first30'].timeoutMs, 360000);
  assert.equal(recipes.sentry.timeoutMs, 240000);
  assert.equal(recipes['long-rail'].timeoutMs, 240000);
  assert.equal(recipes['warm-first30'].cacheMode, 'warm-http-reload');
  assert.equal(recipes['warm-first30'].actions.filter((a) => a.type === 'reload').length, 1);
  assert.deepEqual(recipes['cold-first30'].replayRequirements, {
    movingTicks: 3300,
    directionChangesWithMovement: 20,
  });
  for (const key of ['sentry', 'long-rail']) {
    assert.equal(
      recipes[key].actions.filter(
        (a) => a.type === 'expect' && a.selector === '#preview-load-status[data-state="ready"]',
      ).length,
      2,
    );
    assert.equal(recipes[key].actions.at(-1).type, 'exportReplay');
  }
});

test('changed recipe, deadline, source pairing or calibration preset is rejected', () => {
  for (const mutate of [
    (p) => {
      p.recipes[p.phase].sha256 = '0'.repeat(64);
    },
    (p) => {
      p.recipes['sentry-level'].sha256 = '0'.repeat(64);
    },
    (p) => {
      p.rows[0].timeoutMs++;
    },
    (p) => {
      p.rows[1].source = p.rows[0].source;
    },
    (p) => {
      p.calibrationPreset = 'low';
    },
    (p) => {
      p.performanceExclusion = true;
    },
    (p) => {
      p.evidenceBytes++;
    },
    (p) => {
      delete p.baseline.reusableArtifact;
    },
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateTimingPlan(p));
  }
});

test('timing arguments preserve public work probe and separate intrusive instrumentation', () => {
  for (const phase of Object.keys(TIMING_PHASES))
    for (const engine of ['chromium', 'webkit']) {
      const p = plan(phase, engine),
        row = p.rows[0];
      const args = sustainedArguments(
        {
          plan: p,
          here: '/tools/scripts',
          modeState: { cpu: engine === 'chromium' ? 3.4 : 1, recipePath: '/scratch/scenario.json' },
        },
        row,
        'http://127.0.0.1:123/game/',
        '/evidence',
      );
      assert(
        args.includes('--work-probe') &&
          args.includes('--cadence=settled120') &&
          args.includes('--server-fixture-access'),
      );
      assert(args.includes(`--cpu=${engine === 'chromium' ? 3.4 : 1}`));
      assert(
        !args.some((x) =>
          /--(?:memory-profile|cpu-profile|audio-proof|fixture-access|skip|force)/.test(x),
        ),
      );
      assert.equal(args.includes('--context=persistent'), engine === 'webkit');
      assert.equal(args.includes('--viewport=400x850'), engine === 'webkit');
      assert.equal(args.includes('--dpr=3'), engine === 'webkit');
    }
});

test('missing or invalid calibration never yields an admitted rate', () => {
  for (const raw of [
    {},
    {
      failure: null,
      browser: 'v',
      finishedAt: 'now',
      result: { presets: { mid: { status: 'unverified', target: 1000, rate: 1 } } },
    },
  ])
    assert.throws(() => verifiedMidCalibration(raw));
});

test('strict replay, raw numerical gates and startup cadence failures remain failures', () => {
  const p = plan();
  const row = p.rows.find((r) => r.source === 'candidate');
  assert.equal(timingAssessment(p, row, report(p), closed, '123.4').status, 'passed');
  for (const mutate of [
    (r) => {
      r.performanceGateStatus = 'invalid-evidence';
    },
    (r) => {
      r.performanceGateStatus = 'insufficient-samples';
    },
    (r) => {
      r.replay.nativeVerification.status = 'fail';
    },
    (r) => {
      r.replay.scope = 'failed-scenario-partial-play';
    },
    (r) => {
      r.pageErrors.push('bootstrap aborted');
    },
    (r) => {
      r.sourceRevision = baseline;
    },
    (r) => {
      r.scenarioSHA256 = '0'.repeat(64);
    },
    (r) => {
      r.kind = 'cpu-profile';
    },
    (r) => {
      r.finalReadFailure = 'late failure';
    },
    (r) => {
      r.cadenceProtocol = 'blank30';
    },
  ]) {
    const r = report(p);
    mutate(r);
    assert.equal(timingAssessment(p, row, r, closed, '123.4').status, 'failed');
  }
  assert.equal(
    timingAssessment(p, row, report(p), { status: 'unclosed', exitCode: 0 }, '123.4').status,
    'failed',
  );
  assert.equal(timingAssessment(p, row, report(p), closed, 'different').status, 'failed');
});

test('WebKit requires declared portrait context and clean exact persistent-owner closure', () => {
  const p = plan('long-rail', 'webkit');
  const row = p.rows.find((r) => r.source === 'candidate');
  assert.equal(timingAssessment(p, row, report(p), closed, '123.4').status, 'passed');
  for (const mutate of [
    (r) => {
      r.environment.requestedDisplay.deviceScaleFactor = 1;
    },
    (r) => {
      r.environment.contextMode = 'ephemeral';
    },
    (r) => {
      r.environment.contextOwner.cleanup.profileRemoved = false;
    },
    (r) => {
      r.environment.contextOwner.cleanup.browserClosed = false;
    },
    (r) => {
      r.environment.contextOwner.cleanup.status = 'failed-profile-retained';
    },
  ]) {
    const r = report(p);
    mutate(r);
    assert.equal(timingAssessment(p, row, r, closed, '123.4').status, 'failed');
  }
});

test('warm acceptance cannot relabel a fresh-context run or accept extra resource rules', () => {
  const p = plan('warm-first30');
  const row = p.rows.find((r) => r.source === 'candidate');
  const r = report(p);
  r.cacheMode = 'fresh-context';
  assert.equal(timingAssessment(p, row, r, closed, '123.4').status, 'failed');
  const extra = report(p);
  extra.resources = [{ status: 'pass' }];
  assert.equal(timingAssessment(p, row, extra, closed, '123.4').status, 'failed');
});
