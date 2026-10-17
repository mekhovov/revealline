import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateBaselineReuse } from './solo-remote-baseline.mjs';
import {
  FIRST_RETURN_COHORT,
  FIRST_RETURN_PHASES,
  bindSupplementalJob,
  supplementalArguments,
  supplementalAssessment,
  supplementalMatrix,
  validateSupplementalPlan,
  validateSupplementalScenario,
} from './solo-remote-supplemental.mjs';

const root = new URL('../', import.meta.url);
const legacy = JSON.parse(
  await readFile(new URL('docs/performance/solo-remote-supplemental-plan.json', root)),
);
const source = {
  candidate: 'c9e637ad81fadf49caec884155d1bd0c2496c59c',
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
};
const tree = {
  candidate: '4d72cdb0aa075386bc1e6b5cd53f9f80eeb4a08c',
  baseline: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
};
const recipes = {};
const phases = {};
for (const kind of ['retry', 'next']) {
  const name = `first-return-${kind}`;
  const path = `docs/performance/fixtures/solo-remote-sustained/${kind}-first-return-anchored-preflight.qualification.fixture`;
  const bytes = await readFile(new URL(path, root));
  recipes[name] = JSON.parse(bytes);
  phases[name] = {
    recipe: {
      path,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      stagedName: 'scenario.qualification.json',
    },
    upload:
      kind === 'retry'
        ? {
            path: 'docs/performance/fixtures/solo-remote-sustained/first-return.xonix.fixture',
            bytes: 2897,
            sha256: 'd36ab449fe115f49b3caf9f29e7f6558d155e6a83ef973748fab08784b8fda3e',
            stagedName: 'first-return.xonix.json',
          }
        : null,
    scenarioTimeoutMs: 240000,
  };
}
// Synthetic metadata exercises admission only. It is never a release declaration,
// never downloaded, and makes no claim that either pending package exists.
function syntheticManifest(phase = 'first-return-retry') {
  const m = structuredClone(legacy);
  Object.assign(m, {
    sourceCohort: FIRST_RETURN_COHORT,
    runtimeRevision: '87aca909201ae0a2520d5856dbca351b82dd6e2d',
    status: 'reviewed-diagnostic-only',
    phase,
    phases: structuredClone(phases),
  });
  const identity = { bytes: 100, sha256: 'a'.repeat(64) };
  m.candidate = {
    revision: source.candidate,
    tree: tree.candidate,
    run: 1,
    artifact: 2,
    outer: { ...identity },
    inner: { ...identity },
    manifestSHA256: 'b'.repeat(64),
  };
  m.baseline = {
    revision: source.baseline,
    tree: tree.baseline,
    reusableArtifact: {
      format: 'SoloHostedNormalBaselineReuseV2',
      sourceRevision: source.baseline,
      sourceTree: tree.baseline,
      run: 3,
      artifact: 4,
      name: 'solo-normal-baseline-8b019919-3-1',
      producer: {
        repository: m.repository,
        workflow: '.github/workflows/solo-remote-baseline-temporary.yml',
        run: 3,
        attempt: 1,
        toolingRevision: source.candidate,
        toolingTree: tree.candidate,
      },
      outer: { ...identity },
      inner: { ...identity },
      ready: { ...identity },
      manifestSHA256: 'b'.repeat(64),
    },
  };
  m.release = {
    scope: 'first-return-native-preflight',
    candidateRevision: source.candidate,
    baselineRevision: source.baseline,
    predecessorRun: 38985941469,
    previousPhase: 'latency-long-rail-anchored',
    firstEightAllCorrectnessPassed: false,
    performanceQualification: 'excluded',
    priorProofInspected: true,
    noUnclosedOwners: true,
    allPriorPlannedJobsClosed: true,
    diagnosticPredecessor: {
      run: 38995660502,
      phase: 'latency-long-rail-anchored',
      conclusion: 'failure',
      passedRows: 3,
      failedRows: 1,
      allOwnersClosed: true,
      allFailuresRetained: true,
    },
    evidence: [12086798338, 12087695323].map((artifactId) => ({
      runId: 38995660502,
      artifactId,
      artifactSHA256: 'c'.repeat(64),
      summarySHA256: 'd'.repeat(64),
    })),
  };
  return m;
}
function raw(plan, row) {
  const mobile = row.engine === 'webkit';
  return {
    format: 'SoloQualificationReportV1',
    kind: 'lifecycle',
    scenarioStatus: 'pass',
    scenarioSHA256: plan.phases[plan.phase].recipe.sha256,
    sourceRevision: source[row.source],
    buildIdentity: { sourceRevision: source[row.source] },
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
      nativeVerification: {
        status: 'pass',
        engine: row.engine,
        browserVersion: '123.4',
      },
    },
    pageErrors: [],
    snapshots: [],
    performanceGateStatus: 'inconclusive',
  };
}
const closed = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
};

test('new lifecycle admission is exact-source and two fixed short fixtures; legacy mode remains isolated', () => {
  assert.equal(legacy.sourceCohort, undefined);
  for (const phase of Object.keys(FIRST_RETURN_PHASES)) {
    const manifest = syntheticManifest(phase);
    validateBaselineReuse(manifest.baseline.reusableArtifact, manifest);
    assert.deepEqual(
      supplementalMatrix(manifest).include.map(({ phase: p, engine }) => [p, engine]),
      [
        [phase, 'chromium'],
        [phase, 'webkit'],
      ],
    );
    const plan = bindSupplementalJob(manifest, 'chromium');
    assert.deepEqual(
      plan.rows.map(({ source }) => source),
      ['baseline', 'candidate'],
    );
    assert(plan.rows.every((row) => row.timeoutMs === 480000 && row.performanceExclusion));
    assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
    assert.throws(() => supplementalMatrix({ ...manifest, status: 'held-diagnostic-only' }));
    for (const mutate of [
      (p) => delete p.sourceCohort,
      (p) => {
        p.sourceCohort = 'other';
      },
      (p) => {
        p.candidate = structuredClone(legacy.candidate);
      },
      (p) => {
        p.baseline = structuredClone(legacy.baseline);
      },
      (p) => {
        p.candidate.tree = tree.baseline;
      },
      (p) => {
        p.baseline.tree = tree.candidate;
      },
      (p) => {
        p.runtimeRevision = source.candidate;
      },
      (p) => {
        p.candidate.run = null;
      },
      (p) => {
        p.candidate.outer.bytes = 2 * 1024 ** 3 + 1;
      },
      (p) => {
        p.candidate.inner.sha256 = 'pending';
      },
      (p) => delete p.candidate.manifestSHA256,
      (p) => {
        p.baseline.reusableArtifact.format = 'SoloHostedNormalBaselineReuseV1';
      },
      (p) => {
        p.baseline.reusableArtifact.sourceTree = tree.candidate;
      },
      (p) => {
        p.baseline.reusableArtifact.run = 0;
      },
      (p) => {
        p.baseline.reusableArtifact.artifact = null;
      },
      (p) => {
        p.baseline.reusableArtifact.inner.bytes = 0;
      },
      (p) => {
        p.baseline.reusableArtifact.outer.sha256 = 'pending';
      },
      (p) => {
        p.baseline.reusableArtifact.manifestSHA256 = 'pending';
      },
      (p) => {
        p.baseline.reusableArtifact.ready.bytes = 2 * 1024 ** 2 + 1;
      },
      (p) => {
        p.baseline.reusableArtifact.ready.sha256 = 'pending';
      },
      (p) => {
        p.baseline.reusableArtifact.producer.attempt = 0;
      },
      (p) => {
        p.baseline.reusableArtifact.producer.toolingTree = 'pending';
      },
      (p) => {
        p.baseline.reusableArtifact.name = 'main-pages';
      },
      (p) => {
        p.baseline.reusableArtifact.producer.workflow =
          '.github/workflows/solo-remote-correctness-temporary.yml';
      },
      (p) => {
        p.baseline.publishVerifiedNormal = true;
      },
      (p) => {
        p.release.firstEightAllCorrectnessPassed = true;
      },
      (p) => {
        p.release.diagnosticPredecessor.failedRows = 0;
      },
      (p) => {
        p.release.evidence = [];
      },
      (p) => {
        p.phase = 'latency-long-rail-anchored';
      },
      (p) => {
        p.phases[phase].recipe.sha256 = 'e'.repeat(64);
      },
      (p) => {
        p.phases[phase].recipe.bytes++;
      },
      (p) => {
        p.phases[phase].scenarioTimeoutMs++;
      },
      (p) => {
        p.rowEvidenceBytes++;
      },
      (p) => {
        p.rows[0].timeoutMs++;
      },
    ]) {
      const invalid = structuredClone(plan);
      mutate(invalid);
      assert.throws(() => validateSupplementalPlan(invalid));
    }
  }
  assert.throws(() =>
    bindSupplementalJob({ ...legacy, sourceCohort: FIRST_RETURN_COHORT }, 'chromium'),
  );
});

test('held successor matrix executes with only its isolated adapter and manifest, with no runtime dependency checkout', async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'solo-first-return-declare-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await mkdir(join(temporary, 'scripts'));
  const adapter = join(temporary, 'scripts', 'solo-remote-supplemental.mjs');
  await writeFile(adapter, await readFile(new URL('scripts/solo-remote-supplemental.mjs', root)), {
    flag: 'wx',
  });
  for (const phase of Object.keys(FIRST_RETURN_PHASES)) {
    const manifest = syntheticManifest(phase),
      file = join(temporary, phase + '.json');
    await writeFile(file, JSON.stringify(manifest), { flag: 'wx' });
    const result = execFileSync(process.execPath, [adapter, 'matrix-plan', file], {
      cwd: temporary,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(result, `matrix=${JSON.stringify(supplementalMatrix(manifest))}\n`);
    manifest.status = 'held-diagnostic-only';
    await writeFile(file, JSON.stringify(manifest));
    assert.throws(() =>
      execFileSync(process.execPath, [adapter, 'matrix-plan', file], {
        cwd: temporary,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
        stdio: 'pipe',
      }),
    );
  }
});

test('Retry uses exact imported bytes and Next stays authored, inline and without an inherited capture requirement', () => {
  for (const phase of Object.keys(FIRST_RETURN_PHASES)) {
    const plan = bindSupplementalJob(syntheticManifest(phase), 'webkit');
    const scenario = recipes[phase];
    assert.equal(validateSupplementalScenario(plan, scenario), scenario);
    for (const mutate of [
      (s) => {
        s.kind = 'performance';
      },
      (s) => {
        s.evidenceStorage = 'snapshot-chunks-v1';
      },
      (s) => {
        s.timeoutMs++;
      },
      (s) => {
        s.resourceRules = [];
      },
      (s) => {
        s.replayRequirements = { closures: 99 };
      },
    ]) {
      const invalid = structuredClone(scenario);
      mutate(invalid);
      assert.throws(() => validateSupplementalScenario(plan, invalid));
    }
    if (phase === 'first-return-next') assert.equal(plan.phases[phase].upload, null);
    else assert.equal(plan.phases[phase].upload.stagedName, 'first-return.xonix.json');
    for (const row of plan.rows) {
      const args = supplementalArguments(
        { plan, here: '/tools', modeState: { recipePath: '/input/scenario.json' } },
        row,
        'http://localhost/game/',
        '/evidence',
      );
      assert(args.includes(`--source-revision=${source[row.source]}`));
      assert.equal(args.includes('--baseline-runtime'), row.source === 'baseline');
      for (const flag of [
        '--work-probe',
        '--cadence=settled120',
        '--cpu=1',
        '--context=persistent',
        '--viewport=400x850',
        '--dpr=3',
      ])
        assert(args.includes(flag));
      assert(
        !args.some((arg) =>
          /snapshot-chunks|audio-proof|memory-profile|cpu-profile|resume/.test(arg),
        ),
      );
    }
  }
});

test('new lifecycle correctness preserves raw numerical failures without requiring latency samples or promoting timing', () => {
  for (const phase of Object.keys(FIRST_RETURN_PHASES))
    for (const engine of ['chromium', 'webkit']) {
      const plan = bindSupplementalJob(syntheticManifest(phase), engine);
      for (const row of plan.rows)
        for (const numerical of [
          'pass-observed-window',
          'partial-baseline-internal-unknown',
          'inconclusive',
          'review-required',
          'fail',
        ]) {
          const report = raw(plan, row);
          report.performanceGateStatus = numerical;
          const result = supplementalAssessment(
            plan,
            row,
            report,
            { ...closed, exitCode: numerical === 'fail' ? 2 : 0 },
            '123.4',
          );
          assert.equal(result.status, 'passed');
          assert.equal(result.steeringSampleReadiness, 'not-requested');
          assert.equal(result.rawNumericalStatus, numerical);
          assert.equal(result.performanceQualification, 'excluded');
          assert.equal(result.firstEightAllCorrectnessPassed, false);
        }
    }
});

test('source, replay, page-error, numerical-evidence and owner failures cannot pass a short preflight', () => {
  const plan = bindSupplementalJob(syntheticManifest('first-return-next'), 'webkit'),
    row = plan.rows[1];
  for (const mutate of [
    (r) => {
      r.kind = 'performance';
    },
    (r) => {
      r.scenarioStatus = 'fail';
    },
    (r) => {
      r.scenarioSHA256 = FIRST_RETURN_PHASES['first-return-retry'];
    },
    (r) => {
      r.sourceRevision = legacy.candidate.revision;
    },
    (r) => {
      r.buildIdentity.sourceRevision = legacy.candidate.revision;
    },
    (r) => {
      r.replay.scope = 'partial-failed-scenario';
    },
    (r) => {
      r.replay.nativeVerification.status = 'fail';
    },
    (r) => {
      r.replay.nativeVerification.engine = 'chromium';
    },
    (r) => {
      r.environment.contextMode = 'ephemeral';
    },
    (r) => {
      r.environment.cpuThrottle = 4;
    },
    (r) => {
      r.pageErrors.push('');
    },
    (r) => {
      r.performanceGateStatus = 'invalid-evidence';
    },
    (r) => {
      r.workProbe = false;
    },
    ...[
      'failure',
      'finalReadFailure',
      'failureCleanupFailure',
      'audioIdentityFailure',
      'contextCleanupFailure',
      'replayFailure',
    ].map((key) => (r) => {
      r[key] = 'failed';
    }),
  ]) {
    const report = raw(plan, row);
    mutate(report);
    assert.equal(supplementalAssessment(plan, row, report, closed, '123.4').status, 'failed');
  }
  for (const change of [
    { status: 'failed' },
    { exitCode: 1 },
    { exitCode: 2 },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { violation: 'disk' },
    { survivors: [1] },
    { ambiguous: [1] },
  ])
    assert.equal(
      supplementalAssessment(plan, row, raw(plan, row), { ...closed, ...change }, '123.4').status,
      'failed',
    );
});
