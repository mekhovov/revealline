import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, lstat, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { aggregateQualificationGates } from './solo-qualification-observation.mjs';
import {
  bindSustainedJob,
  diagnosticsAssessment,
  lifecycleAssessment,
  longRecordingAssessment,
  prepareSustainedMode,
  prepareCalibrationScratch,
  SUSTAINED_PHASES,
  sustainedArguments,
  validateRelease,
  validateSustainedPlan,
  verifiedMidCalibration,
} from './solo-remote-sustained.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(
  await readFile(new URL('../docs/performance/solo-remote-sustained-plan.json', import.meta.url)),
);
const candidate = '3adcd53792043ef02459e86168c6b33a66d6ef00';
const baseline = 'b11745223861c3973ad4bf440cc536198b8e0371';
const clone = (x) => structuredClone(x);
function admitted(phase = 'soak') {
  const m = clone(manifest);
  m.phase = phase;
  m.release = {
    format: 'SoloHostedPhaseReleaseV1',
    status: 'reviewed-and-released',
    phase,
    previousPhase: SUSTAINED_PHASES[phase].previous,
    candidateRevision: candidate,
    baselineRevision: baseline,
    noUnclosedOwners: true,
    allPriorPlannedJobsClosed: true,
    priorProofInspected: true,
    firstEightAllCorrectnessPassed: true,
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
  return m;
}
function plan(phase = 'soak', engine = 'chromium', repetition = 1) {
  return bindSustainedJob(admitted(phase), engine, repetition);
}
function raw(sourceRole = 'candidate', engine = 'chromium', phase = 'soak') {
  return {
    scenarioStatus: 'pass',
    scenarioSHA256: manifest.recipes[phase].sha256,
    sourceRevision: sourceRole === 'baseline' ? baseline : candidate,
    buildIdentity: { sourceRevision: sourceRole === 'baseline' ? baseline : candidate },
    environment: {
      engine,
      contextMode: engine === 'webkit' ? 'persistent' : 'ephemeral',
      browserVersion: '123.4',
      cpuThrottle: 2,
    },
    replay: { nativeVerification: { status: 'pass', engine, browserVersion: '123.4' } },
    pageErrors: [],
    performanceGateStatus: aggregateQualificationGates({
      application: { status: 'pass-observed-window' },
      external: { status: 'pass-observed-external-window' },
      workProbe: true,
      applicationAvailable: true,
    }).status,
    resources: Array.from({ length: 3 }, () => ({ status: 'pass' })),
    actions: [{ type: 'repeat', elapsedMs: 1800000 }],
  };
}
const closed = { status: 'closed', exitCode: 0 };

test('the checked-in draft refuses execution before a reviewed phase release', () => {
  const unreleased = clone(manifest);
  unreleased.release.status = 'pending-review';
  assert.throws(() => bindSustainedJob(unreleased, 'chromium', 1), /release/);
  for (const change of [
    { previousPhase: 'diagnostics' },
    { noUnclosedOwners: false },
    { firstEightAllCorrectnessPassed: false },
    { evidence: [] },
  ]) {
    assert.throws(() => validateRelease({ ...admitted().release, ...change }, 'soak'));
  }
});
test('independent soak diagnostic admission retains failed prerequisite and all original source/order/bounds', () => {
  assert.equal(manifest.phase, 'soak');
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const p = bindSustainedJob(manifest, engine, repetition);
      assert.equal(p.release.firstEightAllCorrectnessPassed, false);
      assert.equal(p.performanceExclusion, true);
      assert.equal(p.helperTimeoutMs, 145 * 60000);
      assert.deepEqual(
        p.rows.map((r) => r.source),
        repetition === 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'],
      );
      assert(p.rows.every((r) => r.timeoutMs === 2640000 && r.performanceExclusion));
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
    const m = clone(manifest);
    Object.assign(m.release, change);
    assert.throws(() => bindSustainedJob(m, 'chromium', 1));
  }
});
test('independent soak diagnostic changes neither observations nor numerical, resource and elapsed verdicts', () => {
  for (const engine of ['chromium', 'webkit']) {
    const p = bindSustainedJob(manifest, engine, 1),
      q = plan('soak', engine),
      row = p.rows[1];
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
      const r = raw('candidate', engine);
      r.performanceGateStatus = performance;
      const command = { ...closed, exitCode: performance === 'fail' ? 2 : 0 };
      const observed = lifecycleAssessment(p, row, r, command, '123.4');
      const original = lifecycleAssessment(q, row, r, command, '123.4');
      assert.equal(observed.status, original.status);
      assert.equal(observed.status, performance === 'pass-observed-window' ? 'passed' : 'failed');
      assert.equal(observed.rawPerformanceGateStatus, performance);
      assert.equal(observed.performanceQualification, 'not-qualified-diagnostic-only');
      assert.equal(observed.firstEightAllCorrectnessPassed, false);
    }
    for (const mutate of [
      (r) => (r.actions[0].elapsedMs = 1799999),
      (r) => (r.resources[0].status = 'unobserved'),
      (r) => (r.resources[0].status = 'fail'),
      (r) => (r.replay.nativeVerification.status = 'fail'),
      (r) => (r.contextCleanupFailure = 'not-closed'),
    ]) {
      const r = raw('candidate', engine);
      mutate(r);
      assert.equal(lifecycleAssessment(p, row, r, closed, '123.4').status, 'failed');
    }
  }
});
test('soak diagnostic release freezes tools and runs only the declared event edge', async () => {
  assert(manifest.frozenTools.some((ref) => ref.path === 'scripts/solo-qualification-audio.mjs'));
  // These declarations are historical source records. Their two older tool
  // refs already differed from a6 and are not authority to execute evolving HEAD.
  const witnessBytes = await readFile(
    new URL(
      '../docs/performance/fixtures/solo-final-timing/historical-a6-source.json',
      import.meta.url,
    ),
  );
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const verifyHistorical = (bytes, value) => {
    assert.equal(digest(bytes), 'b68fddaca8d7548202790479dc5803270ef7df2b64d57b659770401131311f49');
    const witness = JSON.parse(bytes);
    assert.equal(witness.sourceRevision, 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4');
    assert.equal(witness.sourceTree, '6b13627e324f695b6ee8d9f2dee2eeeb7217c332');
    assert.equal(witness.status, 'historical-held-declarations-not-executable-at-a6');
    const declaration = witness.declarations.sustained;
    assert.deepEqual(
      [...value.adapterInputs, ...value.frozenTools].map(({ path, bytes, sha256 }) => ({
        path,
        bytes,
        sha256,
      })),
      declaration.refs.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    );
    for (const ref of declaration.refs) {
      assert.match(ref.gitBlob, /^[a-f0-9]{40}$/);
      assert.equal(
        ref.sourceRevision,
        {
          'scripts/game-cli.mjs': '49b777477d572f0cff6fa4a6f0a332e55af03b12',
          'scripts/run-solo-remote-correctness.mjs': '9f81414ff28fa21db8d68af2b7b4a06c9343eb21',
        }[ref.path] ?? witness.sourceRevision,
      );
      assert.match(ref.sourceTree, /^[a-f0-9]{40}$/);
    }
    return declaration;
  };
  const historical = verifyHistorical(witnessBytes, manifest);
  for (const ref of [historical.manifest, historical.workflow]) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(bytes.length, ref.bytes);
    assert.equal(digest(bytes), ref.sha256, 'Historical declaration/workflow must stay immutable');
  }
  const changed = structuredClone(manifest);
  changed.adapterInputs[0].sha256 = 'f'.repeat(64);
  assert.throws(() => verifyHistorical(witnessBytes, changed));
  const changedWitness = JSON.parse(witnessBytes);
  changedWitness.declarations.sustained.refs[0].bytes++;
  assert.throws(() => verifyHistorical(Buffer.from(JSON.stringify(changedWitness)), manifest));
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-sustained-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(
    workflow,
    /github\.event\.action == 'synchronize' && github\.event\.before == 'aeadf7f43a8c1aba3af78d6cc8713666b4af49f1'/,
  );
  assert.match(workflow, /max-parallel: 6/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert(!workflow.includes('fetch-depth: 0'));
});
test('24 fixed jobs retain exactly three source pairs per engine and six ten-pair overhead batches', () => {
  const jobs = [];
  for (const phase of ['soak', 'next', 'retry', 'diagnostics'])
    for (const engine of ['chromium', 'webkit'])
      for (const repetition of [1, 2, 3]) jobs.push(plan(phase, engine, repetition));
  assert.equal(jobs.length, 24);
  assert.equal(
    jobs.reduce((n, j) => n + j.rows.length, 0),
    42,
  );
  assert.deepEqual(
    plan('next', 'webkit', 2).rows.map((r) => r.source),
    ['candidate', 'baseline'],
  );
  assert.deepEqual(
    plan('diagnostics').rows.map((r) => r.source),
    ['candidate'],
  );
  assert.equal(
    jobs.reduce((n, j) => n + (j.phase === 'diagnostics' ? 20 : j.rows.length), 0),
    156,
  );
});
test('phase release cannot jump over the required predecessor or hide prior job closure', () => {
  const p = plan('next');
  p.release.previousPhase = 'first8';
  assert.throws(() => validateSustainedPlan(p));
  p.release.previousPhase = 'soak';
  p.release.allPriorPlannedJobsClosed = false;
  assert.throws(() => validateSustainedPlan(p));
});
test('verified baseline reuse requires its actual separately pinned verifier', async () => {
  const p = plan();
  p.adapterInputs = p.adapterInputs.filter(
    (ref) => ref.path !== 'scripts/solo-remote-baseline.mjs',
  );
  p.baseline.reusableArtifact = {};
  assert.throws(() => validateSustainedPlan(p));
  const bytes = await readFile(new URL('./solo-remote-baseline.mjs', import.meta.url));
  p.adapterInputs.push({
    path: 'scripts/solo-remote-baseline.mjs',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  assert.equal(validateSustainedPlan(p), p);
  for (const replacement of [
    { path: 'scripts/other.mjs' },
    { bytes: 0 },
    { sha256: 'unverified' },
  ]) {
    const invalid = clone(p);
    Object.assign(invalid.adapterInputs[1], replacement);
    assert.throws(() => validateSustainedPlan(invalid));
  }
  delete p.baseline.reusableArtifact;
  assert.throws(() => validateSustainedPlan(p));
});
test('resource, timeout and frozen recipe mutation cannot enter a job', () => {
  for (const mutate of [
    (p) => {
      p.rows[0].timeoutMs = 3600000;
    },
    (p) => {
      p.evidenceBytes++;
    },
    (p) => {
      p.rowEvidenceBytes--;
    },
    (p) => {
      p.setupTimeoutMs++;
    },
    (p) => {
      p.calibrationPreset = 'low';
    },
    (p) => {
      p.recipes.soak.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.candidate.revision = baseline;
    },
    (p) => {
      p.repetition = 4;
    },
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateSustainedPlan(p));
  }
});
test('a numerical performance failure is retained even with a correct strict replay', () => {
  const p = plan(),
    row = p.rows[1],
    r = raw();
  r.performanceGateStatus = 'fail';
  const result = lifecycleAssessment(p, row, r, { ...closed, exitCode: 2 }, '123.4');
  assert.equal(result.correctness, 'pass');
  assert.equal(result.rawPerformanceGateStatus, 'fail');
  assert.equal(result.status, 'failed');
});
test('elapsed 30-minute floor cannot be replaced by a short correct replay', () => {
  const p = plan(),
    row = p.rows[1],
    r = raw();
  r.actions[0].elapsedMs = 1799999;
  assert.equal(lifecycleAssessment(p, row, r, closed, '123.4').status, 'failed');
  r.actions[0].elapsedMs = 1800000;
  assert.equal(lifecycleAssessment(p, row, r, closed, '123.4').status, 'passed');
});
test('strict source, browser and replay ownership are mandatory', () => {
  const p = plan(),
    row = p.rows[1];
  for (const mutate of [
    (r) => {
      r.sourceRevision = baseline;
    },
    (r) => {
      r.scenarioSHA256 = '0'.repeat(64);
    },
    (r) => {
      r.replay.nativeVerification.status = 'fail';
    },
    (r) => {
      r.replay.nativeVerification.browserVersion = 'other';
    },
    (r) => {
      r.contextCleanupFailure = 'survivor';
    },
    (r) => {
      r.pageErrors.push('error');
    },
  ]) {
    const r = raw();
    mutate(r);
    assert.equal(lifecycleAssessment(p, row, r, closed, '123.4').status, 'failed');
  }
  assert.equal(
    lifecycleAssessment(p, row, raw(), { ...closed, status: 'failed' }, '123.4').status,
    'failed',
  );
});
test('unobserved baseline resource counters do not become a resource pass', () => {
  const p = plan(),
    r = raw('baseline');
  r.resources[0].status = 'unobserved';
  const result = lifecycleAssessment(p, p.rows[0], r, closed, '123.4');
  assert.equal(result.resourceStatus, 'unobserved');
  assert.equal(result.status, 'failed');
});
test('Next retains its frozen no-plateau-rule scope rather than inventing three rules', () => {
  const p = plan('next'),
    r = raw('candidate', 'chromium', 'next');
  r.resources = [];
  const result = lifecycleAssessment(p, p.rows[1], r, closed, '123.4');
  assert.equal(result.resourceStatus, 'not-requested-by-frozen-recipe');
  assert.equal(result.status, 'passed');
});
test('Retry must retain profiling exclusion, and cannot pass a changed engine context', () => {
  const p = plan('retry'),
    r = raw('candidate', 'chromium', 'retry');
  r.performanceGateStatus = 'excluded-memory-profiling';
  const result = lifecycleAssessment(p, p.rows[1], r, closed, '123.4');
  assert.equal(result.status, 'passed');
  assert.equal(result.performanceQualification, 'excluded-retention');
  r.performanceGateStatus = 'pass';
  assert.equal(lifecycleAssessment(p, p.rows[1], r, closed, '123.4').status, 'failed');
});
test('fresh mid calibration is verified from all three samples and cannot use a fallback label', () => {
  const r = {
    failure: null,
    browser: '123.4',
    finishedAt: 'done',
    result: {
      presets: {
        mid: {
          status: 'verified',
          target: 1000,
          rate: 2,
          verification: [980, 1000, 1020],
          median: 1000,
          spread: 0.04,
        },
      },
    },
  };
  assert.deepEqual(verifiedMidCalibration(r), { cpu: 2, browserVersion: '123.4' });
  for (const mutate of [
    (x) => {
      x.result.presets.mid.status = 'host-too-slow';
    },
    (x) => {
      x.result.presets.mid.rate = 21;
    },
    (x) => {
      x.result.presets.mid.verification[0] = 500;
    },
    (x) => {
      x.failure = 'timeout';
    },
  ]) {
    const x = clone(r);
    mutate(x);
    assert.throws(() => verifiedMidCalibration(x));
  }
});
test('Chromium heap profiling and persistent WebKit resource-only arguments stay separate', () => {
  const make = (engine, phase) => {
    const p = plan(phase, engine);
    return {
      plan: p,
      here: '/tools/scripts',
      repository: '/tools',
      payloads: { candidate: '/candidate' },
      admitted: { artifacts: { candidate: { archiveIdentity: { sha256: 'a'.repeat(64) } } } },
      modeState: {
        cpu: engine === 'webkit' ? 1 : 2,
        recipePath: '/owned/scenario.qualification.json',
        calibration: null,
      },
    };
  };
  const chrome = make('chromium', 'retry'),
    wk = make('webkit', 'retry'),
    overhead = make('webkit', 'diagnostics');
  const c = sustainedArguments(chrome, chrome.plan.rows[0], 'http://localhost/game/', '/out');
  const w = sustainedArguments(wk, wk.plan.rows[0], 'http://localhost/game/', '/out');
  const d = sustainedArguments(
    overhead,
    overhead.plan.rows[0],
    'http://localhost/game/?journey=opening',
    '/out',
  );
  assert(c.includes('--memory-profile'));
  assert(!w.includes('--memory-profile'));
  assert(w.includes('--context=persistent'));
  assert(!d.includes('--context=persistent'));
  assert(d.includes('--pairs=10'));
  assert(d.includes('--duration=30000'));
  assert(c.includes('--baseline-runtime'));
  assert.equal(c[2], '/owned/scenario.qualification.json');
});
test('diagnostics requires all 20 observations and the unchanged quality/uncertainty gate', () => {
  const p = plan('diagnostics'),
    row = p.rows[0];
  const r = {
    status: 'pass',
    limit: 0.05,
    plannedPairs: 10,
    completePairs: 10,
    noAdaptationWitness: { status: 'observed-full' },
    observations: Array.from({ length: 20 }, () => ({
      valid: true,
      environment: { browser: 'chromium 123.4' },
    })),
  };
  const m = {
    configuration: {
      sourceRevision: candidate,
      pairs: 10,
      seed: 1544,
      durationMs: 30000,
      browser: 'chromium',
    },
    executions: Array.from({ length: 20 }, () => ({ status: 'complete', exitCode: 0 })),
  };
  assert.equal(diagnosticsAssessment(r, m, row, closed, '123.4').status, 'passed');
  for (const mutate of [
    (x) => {
      x.status = 'unresolved';
    },
    (x) => {
      x.observations.pop();
    },
    (x) => {
      x.noAdaptationWitness.status = 'unresolved';
    },
    (x) => {
      x.completePairs = 9;
    },
  ]) {
    const x = clone(r);
    mutate(x);
    assert.equal(diagnosticsAssessment(x, m, row, closed, '123.4').status, 'failed');
  }
});
test('frozen recipes retain their declared exact semantics and relative upload filename', async () => {
  const recipe = async (key) => {
    const ref = manifest.recipes[key];
    const b = await readFile(join(root, ref.path));
    assert.equal(b.length, ref.bytes);
    assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256);
    return JSON.parse(b);
  };
  const soak = await recipe('soak'),
    retry = await recipe('retry'),
    next = await recipe('next');
  assert.equal(soak.actions.find((a) => a.type === 'repeat').atLeastMs, 1800000);
  assert.equal(retry.actions.find((a) => a.type === 'repeat').count, 20);
  assert.equal(soak.actions.find((a) => a.type === 'upload').file, 'first-return.xonix.json');
  assert.equal(next.actions.filter((a) => a.type === 'result').length, 11);
  assert.equal(next.actions.filter((a) => a.selector === '#next-button').length, 10);
  assert.equal(next.resourceRules, undefined);
});

test('preparation materializes exact upload and recipe bytes without a browser or source mutation', async (t) => {
  const temporary = await mkdtemp(join(tmpdir(), 'solo-sustained-policy-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const work = join(temporary, 'work');
  await mkdir(work);
  const p = bindSustainedJob(manifest, 'webkit', 1);
  // Prospective unit preparation explicitly binds current tools in memory.
  // No historical declaration or executable artifact identity is rewritten.
  p.adapterInputs = await Promise.all(
    p.adapterInputs.map(async (ref) => {
      const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
      return {
        ...ref,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    }),
  );
  const moduleBytes = await readFile(new URL('./solo-remote-sustained.mjs', import.meta.url));
  p.frozenTools = [
    {
      path: 'scripts/solo-remote-sustained.mjs',
      sha256: createHash('sha256').update(moduleBytes).digest('hex'),
    },
  ];
  let admittedBaseline = false;
  const ctx = {
    plan: p,
    repository: root.replace(/\/$/, ''),
    work,
    evidence: temporary,
    report: {},
    admitted: { artifacts: { candidate: {} } },
    ensureBaseline: async () => {
      admittedBaseline = true;
    },
    required: async () => {
      assert.fail('WebKit preparation cannot launch calibration');
    },
    digest: async (path) => {
      const b = await readFile(path);
      return { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') };
    },
  };
  const mode = await prepareSustainedMode(ctx);
  assert(admittedBaseline);
  assert.equal(ctx.report.firstEightAllCorrectnessPassed, false);
  assert.equal(ctx.report.performanceExclusion, true);
  assert.equal(ctx.report.performanceQualification, 'not-qualified-diagnostic-only');
  assert.equal(ctx.report.timingQualification, 'not-qualified-diagnostic-only');
  assert.equal(mode.cpu, 1);
  assert.equal(mode.calibration, null);
  assert.deepEqual(await ctx.digest(mode.recipePath), {
    bytes: p.recipes.soak.bytes,
    sha256: p.recipes.soak.sha256,
  });
  assert.deepEqual(await ctx.digest(join(work, 'sustained-inputs/first-return.xonix.json')), {
    bytes: p.recipes.opening.bytes,
    sha256: p.recipes.opening.sha256,
  });
});

test('calibration uses a fresh short inode-bound scratch and rejects aliases or changed owners', async (t) => {
  const directory = await mkdtemp('/tmp/sc-');
  const path = await realpath(directory);
  t.after(() => rm(path, { recursive: true, force: true }));
  const rootInfo = await lstat(path);
  const report = { scratchOwner: { path, device: rootInfo.dev, inode: rootInfo.ino } };
  await assert.rejects(
    prepareCalibrationScratch({
      scratchOwner: { ...report.scratchOwner, inode: rootInfo.ino + 1 },
    }),
  );
  const alias = join(path, 'alias');
  await symlink(path, alias);
  await assert.rejects(
    prepareCalibrationScratch({ scratchOwner: { ...report.scratchOwner, path: alias } }),
  );
  const scratch = await prepareCalibrationScratch(report);
  assert.equal(scratch.path, join(path, 'c00'));
  assert(Buffer.byteLength(scratch.path) <= 52);
  assert.deepEqual(report.calibrationScratch, scratch);
  const info = await lstat(scratch.path);
  assert.equal(info.ino, scratch.inode);
  await assert.rejects(prepareCalibrationScratch(report), { code: 'EEXIST' });
});

test('real aggregate success is accepted without accepting an invented pass label', () => {
  const p = plan('next'),
    r = raw('candidate', 'chromium', 'next');
  r.resources = [];
  assert.equal(r.performanceGateStatus, 'pass-observed-window');
  assert.equal(lifecycleAssessment(p, p.rows[1], r, closed, '123.4').status, 'passed');
  r.performanceGateStatus = 'pass';
  assert.equal(lifecycleAssessment(p, p.rows[1], r, closed, '123.4').status, 'failed');
});

test('reviewed baseline unknown or numerical failure cannot become a pass or prevent deliberate phase review', () => {
  const p = plan('next'),
    r = raw('baseline', 'chromium', 'next');
  r.resources = [];
  for (const external of ['pass-observed-external-window', 'fail']) {
    r.performanceGateStatus = aggregateQualificationGates({
      application: { status: 'unobserved' },
      external: { status: external },
      workProbe: true,
      baselineRuntime: true,
      applicationAvailable: false,
    }).status;
    const result = lifecycleAssessment(
      p,
      p.rows[0],
      r,
      { ...closed, exitCode: external === 'fail' ? 2 : 0 },
      '123.4',
    );
    assert.equal(result.correctness, 'pass');
    assert.equal(result.status, 'failed');
    assert.equal(
      result.performanceQualification,
      external === 'fail' ? 'fail' : 'partial-baseline-internal-unknown',
    );
  }
  const release = admitted('retry').release;
  release.evidence[0].disposition = 'failed-reviewed';
  assert.equal(validateRelease(release, 'retry'), release);
  release.noUnclosedOwners = false;
  assert.throws(() => validateRelease(release, 'retry'));
});

function longRaw() {
  const p = plan('long29'),
    r = raw('candidate', 'chromium', 'long29');
  r.resources = [];
  r.actions = [
    { type: 'repeat', status: 'pass', elapsedMs: 1740000, iterations: 870 },
    ...[
      'before-saved-flight-reload',
      'public-saved-flight-reload',
      'public-load-saved-flight',
      'public-restored-pause-owner',
      'after-saved-flight-reload',
    ].map((label) => ({ label, status: 'pass' })),
  ];
  r.replayIdentity = {
    format: 'SoloPublicReplayIdentityPairV1',
    mode: 'exact-public-bytes-pair',
    status: 'pass',
    observations: [
      { bytes: 100, sha256: 'a'.repeat(64) },
      { bytes: 100, sha256: 'a'.repeat(64) },
    ],
  };
  Object.assign(r.replay, { scope: 'completed-scenario', bytes: 100, sha256: 'a'.repeat(64) });
  r.snapshots = [
    { group: 'continuous-recording-paused', phase: 'paused', application: null, probe: null },
    {
      group: 'restored-continuous-recording-paused',
      phase: 'paused',
      application: { enabled: true },
      probe: {},
    },
  ];
  return { p, r };
}
test('long29 adds exactly six separately released source pairs with unchanged44minute arms', () => {
  for (const engine of ['chromium', 'webkit'])
    for (const repetition of [1, 2, 3]) {
      const p = plan('long29', engine, repetition);
      assert.equal(p.rows.length, 2);
      assert(p.rows.every((row) => row.timeoutMs === 2640000));
      assert.equal(p.helperTimeoutMs, 145 * 60000);
      assert.equal(SUSTAINED_PHASES.long29.jobMinutes, 190);
      assert.equal(p.release.previousPhase, 'diagnostics');
    }
});
test('the long public sequence retains original29minute mechanics and uses paused ordinary Load', async () => {
  const recipe = JSON.parse(await readFile(join(root, manifest.recipes.long29.path)));
  const repeat = recipe.actions.find((a) => a.type === 'repeat');
  assert.deepEqual(repeat, {
    type: 'repeat',
    count: 870,
    atLeastMs: 1740000,
    actions: [
      { type: 'key', key: 'ArrowLeft', ms: 1000 },
      { type: 'key', key: 'ArrowRight', ms: 1000 },
    ],
  });
  assert.equal(recipe.actions.filter((a) => a.type === 'reload').length, 1);
  assert.equal(recipe.actions.filter((a) => a.type === 'exportReplay').length, 2);
  assert(recipe.actions.some((a) => a.selector === '#continue-saved'));
  assert(
    !recipe.actions.some((a) =>
      ['#shell-continue', '#start-button', '#retry-button'].includes(a.selector),
    ),
  );
  assert.deepEqual(recipe.replayRequirements, {
    movingTicks: 200000,
    directionChangesWithMovement: 1500,
  });
});
test('long29 cannot substitute fresh-document success for unavailable pre-reload measurements', () => {
  const { p, r } = longRaw();
  r.performanceGateStatus = 'pass-observed-window';
  const result = longRecordingAssessment(p, p.rows[1], r, closed, '123.4');
  assert.equal(result.correctness, 'pass');
  assert.equal(result.publicSavedReload.status, 'pass');
  assert.equal(result.preReloadPerformance.status, 'inconclusive');
  assert.equal(result.finalDocumentPerformanceGateStatus, 'pass-observed-window');
  assert.equal(result.status, 'failed');
});
test('long29 rejects short, repeated, missing, mismatched or partial durability evidence', () => {
  for (const mutate of [
    (r) => (r.actions[0].elapsedMs = 1739999),
    (r) => (r.actions[0].iterations = 871),
    (r) => r.actions.splice(2, 1),
    (r) => (r.replayIdentity.observations[1].sha256 = 'b'.repeat(64)),
    (r) => r.replayIdentity.observations.push({ bytes: 100, sha256: 'a'.repeat(64) }),
    (r) => (r.replay.scope = 'failed-scenario-partial-play'),
    (r) => (r.replay.sha256 = 'b'.repeat(64)),
    (r) => (r.finalReadFailure = 'lost final owner'),
  ]) {
    const { p, r } = longRaw();
    mutate(r);
    assert.equal(longRecordingAssessment(p, p.rows[1], r, closed, '123.4').correctness, 'fail');
  }
});
test('long29 requires one exact pre-reload paused snapshot and retains invalid evidence', () => {
  for (const mutate of [
    (r) => r.snapshots.shift(),
    (r) => r.snapshots.push(r.snapshots[0]),
    (r) => (r.snapshots[0].phase = 'running'),
  ]) {
    const { p, r } = longRaw();
    mutate(r);
    const result = longRecordingAssessment(p, p.rows[1], r, closed, '123.4');
    assert.equal(result.preReloadPerformance.status, 'invalid-evidence');
    assert.equal(result.status, 'failed');
  }
});
