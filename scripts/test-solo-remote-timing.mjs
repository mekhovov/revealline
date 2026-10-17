import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
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
  verifyTimingHitchJournal,
} from './solo-remote-sustained.mjs';
import { validateQualification } from './solo-qualification.mjs';
import { validateBaselineReuse } from './solo-remote-baseline.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
  qualificationHitchJournalOptions,
} from './solo-qualification-hitch-journal.mjs';

const draft = JSON.parse(
  await readFile(new URL('../docs/performance/solo-remote-timing-plan.json', import.meta.url)),
);
const baseline = 'b11745223861c3973ad4bf440cc536198b8e0371';
const candidate = '1'.repeat(40);
const runtime = '2'.repeat(40);
const current = {
  name: 'cold-main8b-candidatecce',
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
  baselineTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  candidate: 'cce49c81d82b79aefc24898f32eeebc609e569fb',
  candidateTree: '71f7e4cb3b0a39c1d281635774371a693794dd22',
  runtime: '01bcea27ad8c63616e1718121baae12de5bbbb24',
};
function currentCold() {
  const manifest = structuredClone(draft);
  // Synthetic package metadata exercises declaration admission only. These
  // identities are not publication records and must never enter a release plan.
  const packageIdentity = (run, artifact) => ({
    run,
    artifact,
    outer: { bytes: 100, sha256: 'a'.repeat(64) },
    inner: { bytes: 90, sha256: 'b'.repeat(64) },
    manifestSHA256: 'c'.repeat(64),
  });
  Object.assign(manifest, {
    sourceCohort: current.name,
    latestSourceRevision: current.candidate,
    latestRuntimeRevision: current.runtime,
    candidate: {
      revision: current.candidate,
      tree: current.candidateTree,
      ...packageIdentity(31, 32),
    },
    baseline: {
      revision: current.baseline,
      tree: current.baselineTree,
      reusableArtifact: {
        format: 'SoloHostedNormalBaselineReuseV2',
        sourceRevision: current.baseline,
        sourceTree: current.baselineTree,
        name: 'solo-normal-baseline-8b019919-33-1',
        ...packageIdentity(33, 34),
        ready: { bytes: 80, sha256: 'd'.repeat(64) },
        producer: {
          repository: 'mekhovov/revealline',
          workflow: '.github/workflows/solo-remote-baseline-temporary.yml',
          run: 33,
          attempt: 1,
          toolingRevision: current.candidate,
          toolingTree: current.candidateTree,
        },
      },
    },
  });
  Object.assign(manifest.release, {
    sourceCohort: current.name,
    candidateRevision: current.candidate,
    baselineRevision: current.baseline,
    latestRuntimeRevision: current.runtime,
  });
  return manifest;
}
function finalTiming(phase = 'cold-first30') {
  const manifest = currentCold();
  const revision = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
  const tree = '6b13627e324f695b6ee8d9f2dee2eeeb7217c332';
  const runtime = '32abd322afd8243e4537ce4784e2f78ee45ecbec';
  Object.assign(manifest, {
    phase,
    sourceCohort:
      phase === 'cold-first30' ? 'cold-main8b-candidatea6e' : 'timing-main8b-candidatea6e',
    latestSourceRevision: revision,
    latestRuntimeRevision: runtime,
  });
  Object.assign(manifest.candidate, { revision, tree });
  Object.assign(manifest.release, {
    sourceCohort: manifest.sourceCohort,
    phase,
    previousPhase: TIMING_PHASES[phase].previous,
    candidateRevision: revision,
    latestRuntimeRevision: runtime,
  });
  return manifest;
}
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

test('exact cce/main8b cold successor admits three fresh equivalent pairs without promoting historical correctness', () => {
  const manifest = currentCold();
  validateBaselineReuse(manifest.baseline.reusableArtifact, manifest);
  assert.deepEqual(timingMatrix(manifest), timingMatrix(draft));
  const rows = [];
  for (const { engine, repetition } of timingMatrix(manifest).include) {
    const p = bindTimingJob(manifest, engine, repetition);
    const legacy = bindTimingJob(draft, engine, repetition);
    rows.push(...p.rows);
    assert.deepEqual(p.rows, legacy.rows);
    for (const key of [
      'recipes',
      'helperTimeoutMs',
      'setupTimeoutMs',
      'calibrationTimeoutMs',
      'calibrationPreset',
      'evidenceBytes',
      'rowEvidenceBytes',
      'resources',
      'deadlines',
    ])
      assert.deepEqual(p[key], legacy[key]);
    assert.equal(p.release.predecessorRun, 38985941469);
    assert.equal(p.release.firstEightAllCorrectnessPassed, false);
    assert.equal(p.release.performanceQualification, 'not-qualified-diagnostic-only');
    assert.equal(p.release.automaticRetries, 0);
    assert.equal(p.release.automaticPhaseContinuation, false);
    for (const row of p.rows) {
      const args = (value) =>
        sustainedArguments(
          { plan: value, here: '/tools', modeState: { cpu: 2, recipePath: '/owned/recipe.json' } },
          row,
          'http://localhost/game/',
          '/evidence',
        );
      assert.deepEqual(
        args(p),
        args(legacy).map((value) =>
          value.startsWith('--source-revision=')
            ? `--source-revision=${p[row.source].revision}`
            : value,
        ),
      );
    }
  }
  assert.equal(rows.length, 12);
});

test('cold successor rejects incomplete packages, wrong source/tree/profile and any broadened release', () => {
  for (const mutate of [
    (p) => {
      p.sourceCohort = 'unreviewed-source';
    },
    (p) => {
      delete p.sourceCohort;
    },
    (p) => {
      delete p.release.sourceCohort;
    },
    (p) => {
      p.release.sourceCohort = 'other';
    },
    (p) => {
      p.phase = p.release.phase = 'warm-first30';
      p.release.previousPhase = 'cold-first30';
    },
    (p) => {
      p.release.status = 'reviewed-and-released';
      p.release.firstEightAllCorrectnessPassed = true;
    },
    (p) => {
      p.release.status = 'pending-review';
    },
    (p) => {
      p.release.firstEightAllCorrectnessPassed = true;
    },
    (p) => {
      p.release.latestProductionPackageVerified = false;
    },
    (p) => {
      p.release.automaticRetries = 1;
    },
    (p) => {
      p.release.automaticPhaseContinuation = true;
    },
    (p) => {
      p.release.predecessorRun = 1;
    },
    (p) => {
      p.release.performanceQualification = 'qualified';
    },
    (p) => {
      p.candidate.revision =
        p.latestSourceRevision =
        p.release.candidateRevision =
          draft.candidate.revision;
    },
    (p) => {
      p.candidate.tree = draft.candidate.tree;
    },
    (p) => {
      p.latestRuntimeRevision = p.release.latestRuntimeRevision = draft.latestRuntimeRevision;
    },
    (p) => {
      p.baseline.revision = p.release.baselineRevision = baseline;
    },
    (p) => {
      p.baseline.tree = draft.baseline.tree;
    },
    (p) => {
      p.baseline = structuredClone(draft.baseline);
      p.release.baselineRevision = baseline;
    },
    (p) => {
      p.baseline.publishVerifiedNormal = true;
    },
    (p) => {
      p.baseline.publisher = { status: 'stale-publication-authority' };
    },
    (p) => {
      delete p.baseline.reusableArtifact;
    },
    (p) => {
      p.baseline.reusableArtifact.format = 'SoloHostedNormalBaselineReuseV1';
    },
    (p) => {
      p.baseline.reusableArtifact.sourceRevision = baseline;
    },
    (p) => {
      p.baseline.reusableArtifact.sourceTree = draft.baseline.tree;
    },
    (p) => {
      p.baseline.reusableArtifact.name = 'main-pages';
    },
    (p) => {
      p.baseline.reusableArtifact.producer.workflow = '.github/workflows/main.yml';
    },
    (p) => {
      p.baseline.reusableArtifact.producer.repository = 'other/repository';
    },
    (p) => {
      p.baseline.reusableArtifact.producer.run++;
    },
    (p) => {
      p.baseline.reusableArtifact.producer.attempt = 0;
    },
    (p) => {
      p.baseline.reusableArtifact.producer.toolingRevision = 'pending';
    },
    (p) => {
      delete p.baseline.reusableArtifact.ready;
    },
    (p) => {
      p.baseline.reusableArtifact.ready.bytes = 2 * 1024 ** 2 + 1;
    },
    (p) => {
      p.baseline.reusableArtifact.ready.sha256 = 'pending';
    },
  ]) {
    const p = currentCold();
    mutate(p);
    assert.throws(() => timingMatrix(p));
  }
  for (const role of ['candidate', 'baseline'])
    for (const mutate of [
      (identity) => {
        delete identity.artifact;
      },
      (identity) => {
        identity.run = 0;
      },
      (identity) => {
        identity.manifestSHA256 = 'pending';
      },
      (identity) => {
        delete identity.outer;
      },
      (identity) => {
        identity.outer.bytes = 2 * 1024 ** 3 + 1;
      },
      (identity) => {
        identity.inner.bytes = 0;
      },
      (identity) => {
        identity.inner.sha256 = 'pending';
      },
    ]) {
      const p = currentCold();
      mutate(role === 'candidate' ? p.candidate : p.baseline.reusableArtifact);
      assert.throws(() => timingMatrix(p));
    }
});

test('new source admission retains every raw timing verdict, strict replay and clean-owner requirement', () => {
  for (const engine of ['chromium', 'webkit']) {
    const p = bindTimingJob(currentCold(), engine, 1);
    for (const row of p.rows) {
      for (const raw of [
        'pass-observed-window',
        'fail',
        'inconclusive',
        'review-required',
        'partial-baseline-internal-unknown',
        'invalid-evidence',
        'insufficient-samples',
      ]) {
        const r = report(p, row.source);
        r.performanceGateStatus = raw;
        const observed = timingAssessment(
          p,
          row,
          r,
          { ...closed, exitCode: raw === 'fail' ? 2 : 0 },
          '123.4',
        );
        assert.equal(observed.status, raw === 'pass-observed-window' ? 'passed' : 'failed');
        assert.equal(observed.rawPerformanceGateStatus, raw);
        assert.equal(observed.sourceCohort, current.name);
        assert.equal(observed.performanceQualification, 'not-qualified-diagnostic-only');
        assert.equal(observed.firstEightAllCorrectnessPassed, false);
      }
      for (const mutate of [
        (r) => {
          r.replay.nativeVerification.status = 'fail';
        },
        (r) => {
          r.sourceRevision = draft[row.source].revision;
        },
        (r) => {
          r.buildIdentity.sourceRevision = draft[row.source].revision;
        },
        (r) => {
          r.pageErrors.push('startup error');
        },
        (r) => {
          r.cadenceProtocol = 'blank30';
        },
        (r) => {
          r.kind = 'cpu-profile';
        },
      ]) {
        const r = report(p, row.source);
        mutate(r);
        assert.equal(timingAssessment(p, row, r, closed, '123.4').status, 'failed');
      }
      assert.equal(
        timingAssessment(
          p,
          row,
          report(p, row.source),
          { status: 'unclosed', exitCode: 0 },
          '123.4',
        ).status,
        'failed',
      );
    }
  }
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
    const declaration = witness.declarations.timing;
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
  const historical = verifyHistorical(witnessBytes, draft);
  for (const ref of [historical.manifest, historical.workflow]) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(bytes.length, ref.bytes);
    assert.equal(digest(bytes), ref.sha256, 'Historical declaration/workflow must stay immutable');
  }
  const changed = structuredClone(draft);
  changed.adapterInputs[0].sha256 = 'f'.repeat(64);
  assert.throws(() => verifyHistorical(witnessBytes, changed));
  const changedWitness = JSON.parse(witnessBytes);
  changedWitness.declarations.timing.refs[0].bytes++;
  assert.throws(() => verifyHistorical(Buffer.from(JSON.stringify(changedWitness)), draft));
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

async function journalManifest() {
  const m = currentCold();
  m.hitchJournal = 'bounded-v1';
  const path = 'scripts/solo-qualification-hitch-journal.mjs';
  const bytes = await readFile(new URL('../' + path, import.meta.url));
  m.frozenTools.push({
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  return m;
}
async function journalFixture(t, { native = false, hitch = true } = {}) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-cold-hitch-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const store = createHitchJournalStore(output, () => 100, { soloURL: url });
  const allocation = store.beginDocument({ url, action: 'initial' });
  let now = 0;
  const environment = {
    performance: { now: () => now, timeOrigin: 1700000000000 },
    location: { origin: 'http://127.0.0.1:4321', pathname: '/game/' },
    document: { hidden: false, hasFocus: () => true, addEventListener() {} },
    addEventListener() {},
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  };
  if (native)
    environment.PerformanceObserver = class {
      static supportedEntryTypes = ['longtask'];
      observe() {}
      takeRecords() {
        return [{ startTime: 5, duration: 55 }];
      }
      disconnect() {}
    };
  const journal = createBrowserHitchJournal({}, environment);
  journal.configure(allocation);
  journal.subscribe(0);
  journal.first(0, 0);
  if (hitch) journal.phase(2, 0);
  journal.frame(0, hitch ? 40.123456789 : 16, 2, 2);
  journal.beginWork(1, 2);
  journal.endWork(hitch ? 55.123456789 : 2, 2);
  if (hitch) journal.phase(3, 60);
  now = 100;
  await store.retain(journal.seal('paused'), 'final-existing-public-boundary');
  const p = bindTimingJob(await journalManifest(), 'chromium', 1),
    row = p.rows[1],
    raw = report(p);
  raw.hitchJournal = store.finish();
  return { p, row, raw, output, url, path: raw.hitchJournal.documents[0].path };
}

test('cold journal opt-in is explicit, source-limited and freezes its dynamic helper without changing default flags', async () => {
  const m = await journalManifest();
  assert.equal(timingMatrix(m).include.length, 6);
  for (const engine of ['chromium', 'webkit']) {
    const p = bindTimingJob(m, engine, 1),
      ordinary = bindTimingJob(currentCold(), engine, 1);
    for (const row of p.rows) {
      const args = (value) =>
        sustainedArguments(
          { plan: value, here: '/tools', modeState: { cpu: 2, recipePath: '/owned/recipe' } },
          row,
          'http://localhost/game/',
          '/evidence',
        );
      assert.equal(args(p).filter((flag) => flag === '--hitch-journal').length, 1);
      assert.deepEqual(
        args(p).filter((flag) => flag !== '--hitch-journal'),
        args(ordinary),
      );
      assert(!args(p).some((flag) => flag.startsWith('--hitch-journal-preparation')));
    }
  }
  for (const mutation of [
    (p) => {
      p.hitchJournal = true;
    },
    (p) => {
      p.hitchJournal = 'other';
    },
    (p) => {
      p.hitchJournal = null;
    },
    (p) => {
      p.frozenTools = p.frozenTools.filter(
        (ref) => !ref.path.endsWith('solo-qualification-hitch-journal.mjs'),
      );
    },
    (p) => {
      p.frozenTools.push(p.frozenTools.at(-1));
    },
    (p) => {
      p.frozenTools.at(-1).bytes = 0;
    },
    (p) => {
      p.frozenTools.at(-1).bytes = 1024 ** 2;
    },
    (p) => {
      p.frozenTools.at(-1).sha256 = 'pending';
    },
    (p) => {
      p.frozenTools = p.frozenTools.filter((ref) => !ref.path.endsWith('qualify-solo-runtime.mjs'));
    },
  ]) {
    const changed = structuredClone(m);
    mutation(changed);
    assert.throws(() => timingMatrix(changed));
  }
  const legacy = structuredClone(draft);
  legacy.hitchJournal = 'bounded-v1';
  assert.throws(() => timingMatrix(legacy));
  const lifecycle = JSON.parse(
    await readFile(new URL('../docs/performance/solo-remote-sustained-plan.json', import.meta.url)),
  );
  lifecycle.hitchJournal = 'bounded-v1';
  assert.throws(() => bindSustainedJob(lifecycle, 'chromium', 1));
});

test('historical cold and four final-source matrices retain the isolated three-module declaration closure', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-cold-declare-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts'));
  for (const file of [
    'solo-remote-sustained.mjs',
    'solo-qualification.mjs',
    'solo-qualification-observation.mjs',
  ])
    await writeFile(join(dir, 'scripts', file), await readFile(new URL(file, import.meta.url)));
  const input = join(dir, 'manifest.json');
  for (const manifest of [
    await journalManifest(),
    ...Object.keys(TIMING_PHASES).map(finalTiming),
  ]) {
    await writeFile(input, JSON.stringify(manifest));
    const actual = execFileSync(
      process.execPath,
      [join(dir, 'scripts/solo-remote-sustained.mjs'), 'timing-matrix-plan', input],
      { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024, cwd: dir },
    );
    assert.equal(actual, `matrix=${JSON.stringify(timingMatrix(manifest))}\n`);
  }
});

test('post-row journal readback accepts exact fractional binary records and preserves native unsupported/drop-count unknown', async (t) => {
  for (const native of [false, true]) {
    const f = await journalFixture(t, { native });
    const result = await verifyTimingHitchJournal(f.p, f.raw, f.output, f.url);
    assert.equal(result.status, 'complete');
    assert.equal(result.activePlayCoverage, 'observed-final-solo');
    assert.equal(result.activeElapsedMs, 40.123456789);
    assert.equal(result.nativeTasks, native ? 'observed' : 'unobserved');
    assert.equal(result.nativeDropped, null);
    assert.equal(result.readbackVerified, true);
    assert.equal(timingAssessment(f.p, f.row, f.raw, closed, '123.4', result).status, 'passed');
  }
  const clean = await journalFixture(t, { hitch: false });
  const result = await verifyTimingHitchJournal(clean.p, clean.raw, clean.output, clean.url);
  assert.equal(result.status, 'complete');
  assert.equal(result.records, 0, 'No long windows is valid with real positive active coverage');
  assert.equal(result.bytes, 0);
});

test('journal evidence rejects lost/navigation/preparation/zero-active/overflow/native-drop and forged aggregate completion', async (t) => {
  const f = await journalFixture(t);
  const mutations = [
    (r) => {
      delete r.hitchJournal;
    },
    (r) => {
      r.hitchJournal.status = 'incomplete';
    },
    (r) => {
      r.hitchJournal.failures.push('lost document');
    },
    (r) => {
      r.hitchJournal.limits.records++;
    },
    (r) => {
      r.hitchJournal.preparationPolicy = 'first-return-anchored-v1';
    },
    (r) => {
      r.hitchJournal.activePlayCoverage = 'incomplete';
    },
    (r) => {
      r.hitchJournal.documents.push(structuredClone(r.hitchJournal.documents[0]));
    },
    (r) => {
      r.hitchJournal.documents[0].status = 'lost';
    },
    (r) => {
      r.hitchJournal.documents[0].boundary = 'before-reload-1';
    },
    (r) => {
      r.hitchJournal.documents[0].identity.path = '/other/';
    },
    (r) => {
      r.hitchJournal.documents[0].header.identity.action = 'follow-4';
    },
    (r) => {
      r.hitchJournal.documents[0].header.location.origin = 'http://other.test';
    },
    (r) => {
      r.hitchJournal.documents[0].header.complete = false;
    },
    (r) => {
      r.hitchJournal.documents[0].header.workScope = 'unobserved';
    },
    (r) => {
      r.hitchJournal.documents[0].header.activeFrames = 0;
    },
    (r) => {
      r.hitchJournal.documents[0].header.activeWorkWindows = 0;
    },
    (r) => {
      r.hitchJournal.documents[0].header.activeElapsedMs = 0;
    },
    (r) => {
      r.hitchJournal.documents[0].header.lastActiveAt = 0;
    },
    (r) => {
      r.hitchJournal.documents[0].header.lastActiveAt = 1000;
    },
    (r) => {
      r.hitchJournal.documents[0].header.firstOverflowAt = 100;
    },
    (r) => {
      r.hitchJournal.documents[0].header.clockInvalid = true;
    },
    (r) => {
      r.hitchJournal.documents[0].header.unmatchedWorkStart = 100;
    },
    (r) => {
      r.hitchJournal.documents[0].header.nativeTasks = 'failed';
    },
    (r) => {
      r.hitchJournal.documents[0].header.nativeDropped = 1;
    },
    (r) => {
      r.hitchJournal.documents[0].header.nativeDropped = 0;
    },
    (r) => {
      r.performanceGateStatusBeforeHitchJournal = 'fail';
    },
    (r) => {
      r.hitchJournalFailure = 'Missing document';
    },
    (r) => {
      r.hitchJournal.documents[0].header.records = 174001;
    },
    (r) => {
      r.hitchJournal.documents[0].header.observed[1]++;
    },
    (r) => {
      r.hitchJournal.documents[0].header.retained[1]++;
    },
    (r) => {
      r.hitchJournal.records++;
    },
    (r) => {
      r.hitchJournal.bytes++;
    },
    (r) => {
      r.hitchJournal.documents[0].bytes++;
    },
    (r) => {
      r.hitchJournal.scope = 'x'.repeat(65536);
    },
    (r) => {
      r.hitchJournal.documents[0].path = join(f.output, '..', 'other.bin');
    },
  ];
  for (const mutate of mutations) {
    const raw = structuredClone(f.raw);
    mutate(raw);
    assert.equal(
      (await verifyTimingHitchJournal(f.p, raw, f.output, f.url)).status,
      'invalid-evidence',
    );
  }
});

test('journal binary readback rejects truncated/corrupt/rehashed-invalid/replaced and aliased files within its fixed byte cap', async (t) => {
  const f = await journalFixture(t),
    original = await readFile(f.path);
  for (const data of [original.subarray(0, original.length - 1), Buffer.from(original)]) {
    if (data.length === original.length) data[data.length - 1] ^= 255;
    await writeFile(f.path, data);
    assert.equal(
      (await verifyTimingHitchJournal(f.p, f.raw, f.output, f.url)).status,
      'invalid-evidence',
    );
  }
  const invalid = Buffer.from(original);
  invalid.writeDoubleLE(NaN, 0);
  await writeFile(f.path, invalid);
  const raw = structuredClone(f.raw);
  raw.hitchJournal.documents[0].sha256 = createHash('sha256').update(invalid).digest('hex');
  assert.equal(
    (await verifyTimingHitchJournal(f.p, raw, f.output, f.url)).status,
    'invalid-evidence',
  );
  await rm(f.path);
  await writeFile(f.path + '.other', original);
  await symlink(f.path + '.other', f.path);
  assert.equal(
    (await verifyTimingHitchJournal(f.p, f.raw, f.output, f.url)).status,
    'invalid-evidence',
  );
  await rm(f.path);
  assert.equal(
    (await verifyTimingHitchJournal(f.p, f.raw, f.output, f.url)).status,
    'invalid-evidence',
  );
});

test('journal verification cannot erase original numeric/replay failures or turn missing readback into a pass', async (t) => {
  const f = await journalFixture(t),
    verified = await verifyTimingHitchJournal(f.p, f.raw, f.output, f.url);
  for (const performance of ['pass-observed-window', 'fail', 'inconclusive', 'invalid-evidence']) {
    const raw = structuredClone(f.raw);
    raw.performanceGateStatus = performance;
    for (const evidence of [
      undefined,
      { status: 'invalid-evidence', failure: 'Lost binary' },
      verified,
    ]) {
      const assessment = timingAssessment(f.p, f.row, raw, closed, '123.4', evidence);
      assert.equal(assessment.rawPerformanceGateStatus, performance);
      assert.equal(assessment.performanceGateStatusBeforeHitchJournal, null);
      assert.equal(assessment.correctness, 'pass');
      assert.equal(
        assessment.status,
        performance === 'pass-observed-window' && evidence === verified ? 'passed' : 'failed',
      );
      assert.equal(assessment.performanceQualification, 'not-qualified-diagnostic-only');
    }
  }
  for (const prior of ['fail', 'inconclusive', 'pass-observed-window']) {
    const contradictory = structuredClone(f.raw);
    contradictory.performanceGateStatusBeforeHitchJournal = prior;
    assert.equal(
      (await verifyTimingHitchJournal(f.p, contradictory, f.output, f.url)).status,
      'invalid-evidence',
    );
    const assessment = timingAssessment(f.p, f.row, contradictory, closed, '123.4', verified);
    assert.equal(assessment.status, 'failed');
    assert.equal(assessment.performanceEvidenceStatus, 'invalid-evidence');
    assert.equal(assessment.rawPerformanceGateStatus, 'pass-observed-window');
    assert.equal(assessment.performanceGateStatusBeforeHitchJournal, prior);
  }
  const broken = structuredClone(f.raw);
  broken.replay.nativeVerification.status = 'fail';
  assert.equal(timingAssessment(f.p, f.row, broken, closed, '123.4', verified).status, 'failed');
  const legacy = plan(),
    historical = timingAssessment(legacy, legacy.rows[1], report(legacy), closed, '123.4');
  assert(!Object.hasOwn(historical, 'hitchJournalVerification'));
  assert(!Object.hasOwn(historical, 'performanceEvidenceStatus'));
});

test('final source admits all four original timing phases with unchanged12-observation cohorts', () => {
  for (const phase of Object.keys(TIMING_PHASES)) {
    const manifest = finalTiming(phase);
    const matrix = timingMatrix(manifest).include;
    assert.equal(matrix.length, 6);
    assert(
      matrix.every(
        (job) => job.jobMinutes === 122 && job.stepMinutes === 78 && job.outerSeconds === 77 * 60,
      ),
    );
    for (const engine of ['chromium', 'webkit'])
      for (const repetition of [1, 2, 3]) {
        const p = bindTimingJob(manifest, engine, repetition);
        assert.equal(p.rows.length, 2);
        assert(p.rows.every((row) => row.timeoutMs === 480000 && row.performanceExclusion));
        assert.equal(p.performanceExclusion, true);
        assert.equal(p.release.firstEightAllCorrectnessPassed, false);
        assert.equal(p.release.predecessorRun, 38985941469);
        assert.equal(p.calibrationTimeoutMs, 300000);
        assert.equal(p.calibrationPreset, 'mid');
        assert.equal(p.helperTimeoutMs, 75 * 60000);
        assert.equal(p.rowEvidenceBytes, 128 * 1024 ** 2);
        assert.equal(p.recipes[phase].sha256, TIMING_PHASES[phase].hash);
      }
    for (const change of [
      (p) => {
        p.candidate.revision = current.candidate;
      },
      (p) => {
        p.candidate.tree = current.candidateTree;
      },
      (p) => {
        p.latestRuntimeRevision = current.runtime;
      },
      (p) => {
        delete p.sourceCohort;
      },
      (p) => {
        p.sourceCohort =
          phase === 'cold-first30' ? 'timing-main8b-candidatea6e' : 'cold-main8b-candidatea6e';
      },
      (p) => {
        p.release.firstEightAllCorrectnessPassed = true;
      },
      (p) => {
        p.release.status = 'reviewed-and-released';
      },
      (p) => {
        p.baseline.publisher = {};
      },
      (p) => {
        p.recipes[phase].sha256 = '0'.repeat(64);
      },
    ]) {
      const changed = bindTimingJob(manifest, 'chromium', 1);
      change(changed);
      assert.throws(() => validateTimingPlan(changed));
    }
  }
  assert.equal(bindTimingJob(currentCold(), 'chromium', 1).candidate.revision, current.candidate);
});

async function finalJournalManifest(phase) {
  const m = finalTiming(phase);
  m.hitchJournal = 'bounded-v1';
  const path = 'scripts/solo-qualification-hitch-journal.mjs';
  const bytes = await readFile(new URL('../' + path, import.meta.url));
  m.frozenTools.push({
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  return m;
}
async function finalJournalFixture(t, phase) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-final-hitch-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const heavy = ['sentry', 'long-rail'].includes(phase),
    warm = phase === 'warm-first30';
  const policy = heavy ? 'timing-heavy-v1' : undefined;
  const store = createHitchJournalStore(output, () => 100, {
    soloURL: url,
    preparationPolicy: policy,
  });
  const specs = heavy
    ? [
        {
          url: new URL('playground/', url).href,
          action: 'initial',
          preparation: true,
          boundary: 'before-follow-4',
        },
        { url, action: 'follow-4', active: true, boundary: 'final-existing-public-boundary' },
      ]
    : warm
      ? [
          { url, action: 'initial', boundary: 'before-reload-1' },
          { url, action: 'reload-1', active: true, boundary: 'final-existing-public-boundary' },
        ]
      : [{ url, action: 'initial', active: true, boundary: 'final-existing-public-boundary' }];
  for (const [i, spec] of specs.entries()) {
    const allocation = store.beginDocument(spec);
    let now = 0;
    const location = new URL(spec.url);
    const environment = {
      performance: { now: () => now, timeOrigin: 1700000000000 + i * 1000 },
      location: { origin: location.origin, pathname: location.pathname },
      document: { hidden: false, hasFocus: () => true, addEventListener() {} },
      addEventListener() {},
      btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    };
    const journal = createBrowserHitchJournal({}, environment);
    journal.configure(allocation);
    if (!spec.preparation) journal.subscribe(0);
    journal.first(0, 0);
    const currentPhase = spec.active ? 2 : spec.preparation ? 6 : 1;
    journal.phase(currentPhase, 0);
    journal.frame(0, 40.125, currentPhase, currentPhase);
    if (!spec.preparation) {
      journal.beginWork(1, currentPhase);
      journal.endWork(55.25, currentPhase);
    }
    if (spec.active) journal.phase(3, 60);
    now = 100;
    await store.retain(
      journal.seal(spec.active ? 'paused' : spec.preparation ? undefined : 'briefing'),
      spec.boundary,
    );
  }
  const p = bindTimingJob(await finalJournalManifest(phase), 'chromium', 1);
  const raw = report(p);
  raw.hitchJournal = store.finish();
  return { p, raw, output, url };
}

test('final cold and warm/heavy journals retain exact source-specific document coverage', async (t) => {
  for (const phase of Object.keys(TIMING_PHASES)) {
    const f = await finalJournalFixture(t, phase);
    const readback = await verifyTimingHitchJournal(f.p, f.raw, f.output, f.url);
    assert.equal(readback.status, 'complete', readback.failure);
    assert.equal(readback.documents, phase === 'cold-first30' ? 1 : 2);
    assert.equal(readback.records, f.raw.hitchJournal.records);
    assert.equal(readback.bytes, f.raw.hitchJournal.bytes);
    assert(readback.activeFrames > 0 && readback.activeWorkWindows > 0);
    if (phase !== 'cold-first30') {
      assert.equal(readback.documentCoverage[0].activeFrames, 0);
      assert.equal(readback.documentCoverage[1].role, 'solo');
    }
    const args = sustainedArguments(
      { plan: f.p, here: '/tools', modeState: { cpu: 1, recipePath: '/recipe' } },
      f.p.rows[0],
      f.url,
      '/report',
    );
    const bytes = await readFile(new URL('../' + f.p.recipes[phase].path, import.meta.url));
    const options = qualificationHitchJournalOptions(args, JSON.parse(bytes), bytes);
    assert.equal(
      options.preparationPolicy,
      ['sentry', 'long-rail'].includes(phase) ? 'timing-heavy-v1' : undefined,
    );
    assert.equal(f.p.release.firstEightAllCorrectnessPassed, false);
  }
});

test('two-document journal rejects missing/extra identities, active preparation and renewed budgets', async (t) => {
  for (const phase of ['warm-first30', 'sentry', 'long-rail']) {
    const f = await finalJournalFixture(t, phase);
    for (const mutate of [
      (r) => {
        r.hitchJournal.documents.pop();
      },
      (r) => {
        r.hitchJournal.documents.push(r.hitchJournal.documents[0]);
      },
      (r) => {
        r.hitchJournal.documents[0].identity.path = '/other/';
      },
      (r) => {
        r.hitchJournal.documents[0].boundary = 'final-existing-public-boundary';
      },
      (r) => {
        r.hitchJournal.documents[0].header.runningSeen = true;
      },
      (r) => {
        r.hitchJournal.documents[0].header.activeFrames = 1;
      },
      (r) => {
        r.hitchJournal.documents[1].header.capacity = 174000;
      },
      (r) => {
        r.hitchJournal.documents[1].path = r.hitchJournal.documents[0].path;
      },
      (r) => {
        r.hitchJournal.documents[1].header.activeWorkWindows = 0;
      },
      (r) => {
        r.hitchJournal.records++;
      },
      (r) => {
        r.performanceGateStatusBeforeHitchJournal = 'fail';
      },
    ]) {
      const raw = structuredClone(f.raw);
      mutate(raw);
      const result = await verifyTimingHitchJournal(f.p, raw, f.output, f.url);
      assert.equal(result.status, 'invalid-evidence', JSON.stringify(raw.hitchJournal.documents));
    }
  }
});

test('heavy preparation policy cannot be applied to altered or unrelated recipe bytes', async () => {
  const flags = ['--work-probe', '--hitch-journal', '--hitch-journal-preparation=timing-heavy-v1'];
  for (const phase of ['sentry', 'long-rail']) {
    const file = new URL(
      `../docs/performance/fixtures/solo-remote-timing/${phase}.qualification.fixture`,
      import.meta.url,
    );
    const bytes = await readFile(file),
      recipe = JSON.parse(bytes);
    assert.equal(
      qualificationHitchJournalOptions(flags, recipe, bytes).preparationPolicy,
      'timing-heavy-v1',
    );
    assert.throws(() =>
      qualificationHitchJournalOptions(flags, recipe, Buffer.concat([bytes, Buffer.from(' ')])),
    );
    assert.throws(() => qualificationHitchJournalOptions([...flags, flags[2]], recipe, bytes));
    assert.throws(() => qualificationHitchJournalOptions(flags, { ...recipe, id: 'other' }, bytes));
  }
  const bytes = await readFile(
    new URL(
      '../docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
      import.meta.url,
    ),
  );
  assert.throws(() => qualificationHitchJournalOptions(flags, JSON.parse(bytes), bytes));
});
