import { assertDeclaredReadinessTool } from './solo-readiness-rejoin-declared-source.mjs';
import { readHistoricalPageErrorRefs } from './solo-page-error-source-witness.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  CPU_PROFILE_RECIPE,
  CPU_PROFILE_SOURCE,
  bindCpuProfileJob,
  cpuProfileArguments,
  cpuProfileAssessment,
  cpuProfileMatrix,
  prepareCpuProfileMode,
  validateCpuProfilePlan,
} from './solo-remote-cpu-profile.mjs';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL('docs/performance/solo-remote-cpu-profile-plan.json', root)),
);
const makePlan = () => bindCpuProfileJob(manifest);
const witnessPath = 'docs/performance/fixtures/solo-final-cpu-profile/parked-9e-source.json';
function validateHistoricalWitness(bytes) {
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '2d1f8dd361cc1df689131b0f4a4d41b32ba3735abb86c04c4983579281d7343e',
  );
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'SoloHistoricalCpuParkedSourceWitnessV1');
  assert.equal(value.revision, '9e0111e066b5dac7749a33fd0e98e92702851dc6');
  assert.equal(value.files.length, 9);
  return value;
}
function verifyHistoricalBytes(bytes, expected) {
  assert.equal(bytes.length, expected.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
}
async function verifyHistoricalDeclaration() {
  const witness = validateHistoricalWitness(await readFile(new URL(witnessPath, root)));
  for (const path of [
    'docs/performance/solo-remote-cpu-profile-plan.json',
    '.github/workflows/solo-remote-cpu-profile-temporary.yml',
  ]) {
    const expected = witness.files.find((row) => row.path === path);
    assert.deepEqual(await digest(new URL(path, root)), {
      bytes: expected.bytes,
      sha256: expected.sha256,
    });
  }
  return witness;
}

const digest = async (path) => {
  const b = await readFile(path);
  return { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') };
};
const closed = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
};
const readback = { status: 'passed', bytes: 128, sha256: 'a'.repeat(64) };
function report() {
  return {
    format: 'SoloQualificationReportV1',
    kind: 'cpu-profile',
    scenarioKind: 'performance',
    audioProof: false,
    scenarioStatus: 'pass',
    scenarioSHA256: CPU_PROFILE_RECIPE,
    sourceRevision: CPU_PROFILE_SOURCE,
    buildIdentity: { sourceRevision: CPU_PROFILE_SOURCE },
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: false,
    environment: {
      engine: 'chromium',
      cpuThrottle: 2.46,
      contextMode: 'ephemeral',
      browserVersion: '151.0.7922.34',
      requestedDisplay: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine: 'chromium', browserVersion: '151.0.7922.34' },
    },
    pageErrors: [],
    performanceGateStatus: 'excluded-cpu-profiling',
    cpuProfile: {
      status: 'retained',
      maximumMs: 240000,
      samplingIntervalUs: 1000,
      stopReason: 'actions-ended',
      sampleCount: 5000,
      nodeCount: 300,
      bytes: readback.bytes,
      sha256: readback.sha256,
    },
  };
}

test('one fixed candidate-only diagnostic job retains failed historical prerequisite', () => {
  const p = makePlan();
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].source, 'candidate');
  assert.equal(p.rows[0].timeoutMs, 480000);
  assert.equal(p.release.firstEightAllCorrectnessPassed, false);
  assert.equal(p.stressOrigin.newHostCalibration, false);
  assert.deepEqual(cpuProfileMatrix(manifest), {
    include: [
      {
        phase: 'cold-cpu-profile',
        engine: 'chromium',
        jobMinutes: 130,
        stepMinutes: 78,
        outerSeconds: 4620,
      },
    ],
  });
});
test('recipe, source, ownership, CPU factor, exclusion and every bound reject changes', () => {
  for (const mutate of [
    (p) => p.rows.push({ ...p.rows[0] }),
    (p) => (p.rows[0].source = 'baseline'),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.cpu = 1),
    (p) => (p.candidate.revision = 'b'.repeat(40)),
    (p) => (p.recipe.sha256 = 'b'.repeat(64)),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.noUnclosedOwners = false),
    (p) => p.release.predecessorRun++,
    (p) => (p.performanceExclusion = false),
    (p) => (p.automaticRetries = 1),
    (p) => (p.automaticPhaseContinuation = true),
    (p) => (p.stressOrigin.newHostCalibration = true),
    (p) => p.profile.maximumMs++,
    (p) => p.profile.maximumBytes++,
    (p) => (p.profile.traceBytes = 1),
    (p) => (p.profile.heap = true),
    (p) => (p.profile.screenshots = true),
    (p) => (p.profile.samplingIntervalUs = 100),
    (p) => p.helperTimeoutMs++,
    (p) => p.rowEvidenceBytes++,
    (p) => p.evidenceBytes++,
  ]) {
    const p = makePlan();
    mutate(p);
    assert.throws(() => validateCpuProfilePlan(p));
  }
});
test('actual command adds only CPU sampling to fixed original cold route and controls', () => {
  const args = cpuProfileArguments(
    { here: '/tools/scripts', modeState: { recipePath: '/owned/original.json' } },
    'http://127.0.0.1:1234/game/?journey=opening',
    '/owned/report',
  );
  assert.deepEqual(args, [
    '/tools/scripts/qualify-solo-runtime.mjs',
    'http://127.0.0.1:1234/game/?journey=opening',
    '/owned/original.json',
    '/owned/report/report.json',
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    '--cpu=2.46',
    '--browser=chromium',
    `--source-revision=${CPU_PROFILE_SOURCE}`,
    '--cpu-profile',
  ]);
  assert(!args.some((x) => /memory|audio-proof|screenshot|trace|baseline-runtime/.test(x)));
});
test('complete closed native recording can pass diagnostic retention while timing stays excluded', () => {
  const a = cpuProfileAssessment(makePlan(), report(), closed, readback);
  assert.equal(a.status, 'passed');
  assert.equal(a.performanceQualification, 'excluded-cpu-profiling');
  assert.equal(a.firstEightAllCorrectnessPassed, false);
});
test('source/replay/control/profile failures and missing/capped samples remain failed', () => {
  for (const mutate of [
    (r) => (r.sourceRevision = 'f'.repeat(40)),
    (r) => (r.scenarioSHA256 = 'f'.repeat(64)),
    (r) => (r.kind = 'performance'),
    (r) => (r.audioProof = true),
    (r) => (r.scenarioStatus = 'fail'),
    (r) => (r.replay.nativeVerification.status = 'fail'),
    (r) => (r.replay.nativeVerification.browserVersion = 'different'),
    (r) => (r.environment.cpuThrottle = 1),
    (r) => (r.environment.requestedDisplay.deviceScaleFactor = 3),
    (r) => (r.environment.requestedDisplay.viewport.width = 400),
    (r) => r.pageErrors.push('uncaught'),
    (r) => (r.contextCleanupFailure = 'not closed'),
    (r) => (r.performanceGateStatus = 'pass-observed-window'),
    (r) => (r.cpuProfile.status = 'failed'),
    (r) => (r.cpuProfile.limitReached = true),
    (r) => (r.cpuProfile.stopReason = 'scenario-failure'),
    (r) => (r.cpuProfile.sha256 = 'b'.repeat(64)),
    (r) => (r.cpuProfile.sampleCount = 0),
    (r) => (r.cpuProfile.sampleCount = '5000'),
    (r) => (r.cpuProfile.nodeCount = 0),
    (r) => r.cpuProfile.bytes++,
    (r) => r.cpuProfile.samplingIntervalUs++,
    (r) => (r.cpuProfileFailure = 'missing'),
  ]) {
    const r = report();
    mutate(r);
    const a = cpuProfileAssessment(makePlan(), r, closed, readback);
    assert.equal(a.status, 'failed');
    assert.equal(a.performanceQualification, 'excluded-cpu-profiling');
  }
  for (const c of [
    { ...closed, exitCode: 2 },
    { ...closed, forcedCleanup: true },
    { ...closed, violation: 'timeout' },
    { ...closed, survivors: [1] },
    { ...closed, ambiguous: [1] },
  ])
    assert.equal(cpuProfileAssessment(makePlan(), report(), c, readback).status, 'failed');
  assert.equal(
    cpuProfileAssessment(makePlan(), report(), closed, { status: 'failed' }).status,
    'failed',
  );
});
const schemaWitnessPath =
  'docs/performance/fixtures/solo-first-victory-cpu/parked-9e-schema-source.json';
function parkedSchemaSource(bytes, declaration, workflow) {
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    'b8a6a93d82de1a9636b26bb4e0852344aea187e0349b3d794d59868e69e598e0',
  );
  const w = JSON.parse(bytes);
  assert.equal(w.head, '9e0111e066b5dac7749a33fd0e98e92702851dc6');
  assert.equal(w.tree, '780fdfcb84a1d5cc6009b697879a98fbe39d0487');
  for (const [path, b] of [
    ['docs/performance/solo-remote-cpu-profile-plan.json', declaration],
    ['.github/workflows/solo-remote-cpu-profile-temporary.yml', workflow],
  ])
    verifyHistoricalBytes(
      b,
      w.records.find((x) => x.path === path),
    );
  return w.records.find((x) => x.path === 'scripts/solo-qualification.mjs');
}
test('immutable parked declaration and witnessed source refs remain exact', async () => {
  const witness = await verifyHistoricalDeclaration();
  const errorHistory = await readHistoricalPageErrorRefs(
    'docs/performance/solo-remote-cpu-profile-plan.json',
    '.github/workflows/solo-remote-cpu-profile-temporary.yml',
  );
  errorHistory.set(
    'scripts/solo-qualification.mjs',
    parkedSchemaSource(
      await readFile(new URL(schemaWitnessPath, root)),
      await readFile(new URL('docs/performance/solo-remote-cpu-profile-plan.json', root)),
      await readFile(new URL('.github/workflows/solo-remote-cpu-profile-temporary.yml', root)),
    ),
  );
  for (const ref of [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools]) {
    if (
      ref.path === 'scripts/solo-qualification-cpu-profile.mjs' &&
      (await assertDeclaredReadinessTool('docs/performance/solo-remote-cpu-profile-plan.json', ref))
    )
      continue;
    const historical =
      witness.files.find((row) => row.path === ref.path) ?? errorHistory.get(ref.path);
    const actual = historical
      ? { bytes: historical.bytes, sha256: historical.sha256 }
      : await digest(new URL(ref.path, root));
    assert.deepEqual(actual, { bytes: ref.bytes, sha256: ref.sha256 }, ref.path);
  }
  const recipe = JSON.parse(await readFile(new URL(manifest.recipe.path, root)));
  assert.equal(recipe.timeoutMs, 240000);
  assert.equal(recipe.actions.filter((a) => a.type === 'key').length, 30);
  assert.equal(recipe.replayRequirements.movingTicks, 3300);
  assert.equal(recipe.replayRequirements.directionChangesWithMovement, 20);
});
test('declaration CLI works with its complete source closure and no installed dependencies', async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'solo-cpu-declaration-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const files = [
    'scripts/solo-remote-cpu-profile.mjs',
    'scripts/solo-remote-supplemental.mjs',
    'docs/performance/solo-remote-cpu-profile-plan.json',
    // The adapter imports the additive trace protocol constants from this built-in-only helper.
    'scripts/solo-qualification-cpu-profile.mjs',
  ];
  for (const path of files) {
    const target = join(temporary, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await readFile(new URL(path, root)), { flag: 'wx' });
  }
  const output = execFileSync(
    process.execPath,
    [join(temporary, files[0]), 'matrix-plan', join(temporary, files[2])],
    { cwd: temporary, encoding: 'utf8', timeout: 10000, maxBuffer: 1048576 },
  );
  assert.equal(output, `matrix=${JSON.stringify(cpuProfileMatrix(manifest))}\n`);
});
test('preparation copies exact recipe and does not acquire or run a baseline browser', async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'solo-cpu-prepare-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await mkdir(join(temporary, 'evidence'));
  await mkdir(join(temporary, 'work'));
  // This unit fixture deliberately tests today's preparer with today's file bytes.
  // The separate immutable-source control above verifies the historical plan.
  const localPlan = makePlan();
  for (const ref of [...localPlan.adapterInputs, ...localPlan.frozenTools])
    Object.assign(ref, await digest(new URL(ref.path, root)));
  const ctx = {
    plan: localPlan,
    repository: await realpath(new URL('../', import.meta.url)),
    work: join(temporary, 'work'),
    evidence: join(temporary, 'evidence'),
    report: {},
    admitted: { status: 'passed' },
    digest,
    ensureBaseline: () => {
      throw Error('No baseline row requested');
    },
  };
  const state = await prepareCpuProfileMode(ctx);
  assert.deepEqual(await digest(state.recipePath), {
    bytes: manifest.recipe.bytes,
    sha256: manifest.recipe.sha256,
  });
  assert.equal(ctx.report.firstEightAllCorrectnessPassed, false);
  assert.equal(ctx.report.performanceQualification, 'excluded-cpu-profiling');
});
test('workflow is single-shot and keeps source/command/profile ownership bounds', async () => {
  const workflow = await readFile(
    new URL('.github/workflows/solo-remote-cpu-profile-temporary.yml', root),
    'utf8',
  );
  assert.match(workflow, /github\.event\.before == 'bffcbd838a7bb925da8aaf030695773f893d8bda'/);
  assert.match(workflow, /max-parallel: 1/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /sparse-checkout-cone-mode: false/);
  assert.match(workflow, /ref: 3adcd53792043ef02459e86168c6b33a66d6ef00/);
  assert.match(
    workflow,
    /timeout --signal=TERM --kill-after=30s \$\{\{ matrix\.outerSeconds \}\}s/,
  );
  assert.match(workflow, /scripts\/test-solo-qualification-cpu-profile\.mjs/);
  assert.match(workflow, /install --with-deps chromium 2>&1/);
  assert(!workflow.includes('install --with-deps chromium webkit'));
  const runner = await readFile(new URL('scripts/run-solo-remote-correctness.mjs', root), 'utf8');
  assert.match(
    runner,
    /\['offline', 'demo', 'demo-active', 'cpu-profile', 'lifecycle'\]\.includes\(extension\)/,
  );
  for (const value of [
    'SoloHostedCpuProfilePlanV1',
    'validateCpuProfilePlan',
    'prepareCpuProfileMode',
    'runCpuProfileRow',
  ])
    assert(runner.includes(value));
});

test('historical source witness rejects substituted source authority or declaration', async () => {
  const bytes = await readFile(new URL(witnessPath, root));
  validateHistoricalWitness(bytes);
  const altered = JSON.parse(bytes);
  altered.files[2].sha256 = '0'.repeat(64);
  assert.throws(() => validateHistoricalWitness(Buffer.from(JSON.stringify(altered))));
  const witness = await verifyHistoricalDeclaration();
  const manifestBytes = await readFile(
    new URL('docs/performance/solo-remote-cpu-profile-plan.json', root),
  );
  const tampered = Buffer.concat([manifestBytes, Buffer.from(' ')]);
  assert.throws(() => verifyHistoricalBytes(tampered, witness.files[0]));
});

test('later parked schema witness rejects changed source and declaration bytes', async () => {
  const b = await readFile(new URL(schemaWitnessPath, root)),
    m = await readFile(new URL('docs/performance/solo-remote-cpu-profile-plan.json', root)),
    w = await readFile(new URL('.github/workflows/solo-remote-cpu-profile-temporary.yml', root));
  for (const x of [
    [Buffer.concat([b, Buffer.from(' ')]), m, w],
    [b, Buffer.concat([m, Buffer.from(' ')]), w],
    [b, m, Buffer.concat([w, Buffer.from(' ')])],
  ])
    assert.throws(() => parkedSchemaSource(...x));
});
