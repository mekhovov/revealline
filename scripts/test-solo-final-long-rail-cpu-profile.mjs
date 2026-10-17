import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  bindCpuProfileJob,
  cpuProfileArguments,
  cpuProfileAssessment,
  cpuProfileMatrix,
  longRailProfileOrigin,
  prepareCpuProfileMode,
  validateCpuProfilePlan,
} from './solo-remote-cpu-profile.mjs';
const root = new URL('../', import.meta.url);
const path = 'docs/performance/solo-final-long-rail-cpu-profile-plan.json';
const workflowPath = '.github/workflows/solo-remote-final-long-rail-cpu-profile-temporary.yml';
const manifest = JSON.parse(await readFile(new URL(path, root)));
const plan = () => bindCpuProfileJob(manifest);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const digest = async (path) => {
  const b = await readFile(path);
  return { bytes: b.length, sha256: sha(b) };
};
const refs = [manifest.recipe, manifest.upload, ...manifest.adapterInputs, ...manifest.frozenTools];
const source = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
const head = 'c41a02216c0811952232a387fd1743e09452c269';
const closed = {
  status: 'closed',
  exitCode: 0,
  survivors: [],
  ambiguous: [],
  forcedCleanup: false,
};
const readback = { status: 'passed', bytes: 128, sha256: 'a'.repeat(64) };
function raw() {
  return {
    format: 'SoloQualificationReportV1',
    kind: 'cpu-profile',
    scenarioKind: 'performance',
    scenarioStatus: 'pass',
    audioProof: false,
    scenarioSHA256: manifest.recipe.sha256,
    sourceRevision: source,
    buildIdentity: { sourceRevision: source },
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: false,
    environment: {
      engine: 'chromium',
      cpuThrottle: 4.19,
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
      sampleCount: 1000,
      nodeCount: 100,
      ...readback,
      file: '/owned/report.json.cpuprofile',
    },
  };
}
// The source report and profile object have different status vocabularies.
function report() {
  const r = raw();
  r.cpuProfile.status = 'retained';
  return r;
}
test('final Long Rail uses one unchanged public route and a fixed observed stress factor', async () => {
  const p = plan();
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].id, 'long-rail-cpu-profile-chromium-candidate');
  assert.equal(p.rows[0].timeoutMs, 480000);
  assert.deepEqual(p.stressOrigin, longRailProfileOrigin());
  assert.equal(p.release.allPriorPlannedJobsClosed, undefined);
  assert.equal(p.baseline.reusableArtifact, undefined);
  assert.equal(p.release.siblingQualificationJobsMayRemainActive, true);
  const recipe = JSON.parse(await readFile(new URL(p.recipe.path, root)));
  assert.equal(recipe.timeoutMs, 240000);
  assert.equal(recipe.entryPath, 'playground/');
  assert.equal(recipe.actions[6].selector, '#start-button');
  assert.deepEqual(recipe.actions[8], { type: 'wait', ms: 8000 });
  assert.equal(recipe.actions[9].key, 'ArrowRight');
  assert.deepEqual(recipe.replayRequirements, { closures: 1, maximumTrailCells: 20 });
  assert.equal(recipe.actions.find((a) => a.type === 'upload').file, 'long-rail.xonix.json');
  assert.deepEqual(cpuProfileMatrix(manifest), {
    include: [
      {
        phase: 'long-rail-cpu-profile',
        engine: 'chromium',
        jobMinutes: 130,
        stepMinutes: 78,
        outerSeconds: 4620,
      },
    ],
  });
  const args = cpuProfileArguments(
    {
      plan: p,
      here: '/tools/scripts',
      modeState: { recipePath: '/owned/scenario.qualification.json' },
    },
    'http://127.0.0.1:1234/game/?journey=opening',
    '/owned',
  );
  assert.deepEqual(args.slice(4), [
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    '--cpu=4.19',
    '--browser=chromium',
    `--source-revision=${source}`,
    '--cpu-profile',
  ]);
  assert(
    !args.some((a) =>
      /hitch-journal|memory-profile|audio-proof|trace|screenshot|heap|calibrat/.test(a),
    ),
  );
});
test('source, package, route, owner evidence and every profile bound remain strict', () => {
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = 'a'.repeat(64)),
    (p) => (p.candidate.tree = 'a'.repeat(40)),
    (p) => (p.candidate.revision = 'a'.repeat(40)),
    (p) => (p.runtimeRevision = 'a'.repeat(40)),
    (p) => (p.sourceCohort = 'unknown'),
    (p) => (p.phase = 'cold-cpu-profile'),
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.baseline.buildCommand = 'build'),
    (p) => (p.baseline.tree = 'b'.repeat(40)),
    (p) => (p.cpu = 1),
    (p) => p.rows.push({ ...p.rows[0] }),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.recipe.sha256 = 'a'.repeat(64)),
    (p) => p.recipe.bytes++,
    (p) => (p.upload.sha256 = 'a'.repeat(64)),
    (p) => (p.upload.path = 'other'),
    (p) => p.profile.maximumMs++,
    (p) => p.profile.maximumBytes++,
    (p) => p.profile.samplingIntervalUs++,
    (p) => (p.profile.traceBytes = 1),
    (p) => (p.profile.heap = true),
    (p) => (p.profile.screenshots = true),
    (p) => p.helperTimeoutMs++,
    (p) => p.evidenceBytes++,
    (p) => p.rowEvidenceBytes++,
    (p) => (p.automaticRetries = 1),
    (p) => (p.performanceExclusion = false),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.allPriorPlannedJobsClosed = true),
    (p) => (p.release.noUnclosedOwners = false),
    (p) => (p.release.onceOnlyBefore = 'a'.repeat(40)),
    (p) => (p.stressOrigin.newHostCalibration = true),
    (p) => (p.stressOrigin.predecessorExitCode = 0),
    (p) => (p.stressOrigin.commandSHA256 = 'a'.repeat(64)),
    (p) =>
      (p.frozenTools = p.frozenTools.filter(
        (r) => r.path !== 'scripts/soundtrack-distribution.mjs',
      )),
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateCpuProfilePlan(p));
  }
});
test('partial, paused, limited, wrong replay or unclosed profile observations cannot pass', () => {
  assert.equal(cpuProfileAssessment(plan(), report(), closed, readback).status, 'passed');
  for (const mutate of [
    (r) => (r.sourceRevision = 'b'.repeat(40)),
    (r) => (r.scenarioStatus = 'fail'),
    (r) => (r.replay.scope = 'partial'),
    (r) => (r.replay.nativeVerification.status = 'fail'),
    (r) => (r.scenarioSHA256 = 'a'.repeat(64)),
    (r) => (r.environment.cpuThrottle = 2.46),
    (r) => (r.cpuProfile.limitReached = true),
    (r) => (r.cpuProfile.stopReason = 'scenario-failure'),
    (r) => r.cpuProfile.bytes++,
    (r) => (r.cpuProfile.sampleCount = 0),
    (r) => (r.cpuProfileFailure = 'lost'),
    (r) => (r.performanceGateStatus = 'pass-observed-window'),
  ]) {
    const r = report();
    mutate(r);
    assert.equal(cpuProfileAssessment(plan(), r, closed, readback).status, 'failed');
  }
  for (const command of [
    { ...closed, exitCode: 1 },
    { ...closed, forcedCleanup: true },
    { ...closed, survivors: [1] },
    { ...closed, ambiguous: [1] },
    { ...closed, violation: 'deadline' },
  ])
    assert.equal(cpuProfileAssessment(plan(), report(), command, readback).status, 'failed');
});
test('preparation copies exact route and upload without baseline acquisition or browser launch', async (t) => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'long-rail-profile-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await mkdir(join(temporary, 'work'));
  await mkdir(join(temporary, 'evidence'));
  const p = plan();
  const ctx = {
    plan: p,
    repository: await realpath(root),
    work: join(temporary, 'work'),
    evidence: join(temporary, 'evidence'),
    report: {},
    admitted: { status: 'passed' },
    digest,
    ensureBaseline() {
      throw Error('Forbidden baseline acquisition');
    },
  };
  const state = await prepareCpuProfileMode(ctx);
  assert.deepEqual(await digest(state.recipePath), {
    bytes: p.recipe.bytes,
    sha256: p.recipe.sha256,
  });
  assert.deepEqual(await digest(join(dirname(state.recipePath), 'long-rail.xonix.json')), {
    bytes: p.upload.bytes,
    sha256: p.upload.sha256,
  });
  assert.equal(ctx.report.performanceQualification, 'excluded-cpu-profiling');
  assert.equal(ctx.report.firstEightAllCorrectnessPassed, false);
});
test('final profile declaration imports only its two standalone adapters', async (t) => {
  const temp = await realpath(await mkdtemp(join(tmpdir(), 'profile-declaration-')));
  t.after(() => rm(temp, { recursive: true, force: true }));
  for (const file of [
    'scripts/solo-remote-cpu-profile.mjs',
    'scripts/solo-remote-supplemental.mjs',
    path,
  ]) {
    const target = join(temp, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, await readFile(new URL(file, root)), { flag: 'wx' });
  }
  const output = execFileSync(
    process.execPath,
    [join(temp, 'scripts/solo-remote-cpu-profile.mjs'), 'matrix-plan', join(temp, path)],
    { cwd: temp, encoding: 'utf8', timeout: 10000, maxBuffer: 1048576 },
  );
  assert.equal(output, `matrix=${JSON.stringify(cpuProfileMatrix(manifest))}\n`);
});
async function checkRelease(m, workflow) {
  validateCpuProfilePlan(bindCpuProfileJob(m));
  assert.deepEqual(m.releaseTrigger, {
    status: 'reviewed-one-shot',
    pullRequest: 1544,
    sameRepositoryRequired: true,
    action: 'synchronize',
    onceOnlyBefore: head,
  });
  const guard = `github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${head}'`;
  assert(workflow.includes('    if: ' + guard + '\n'));
  assert(!workflow.includes('workflow_dispatch'));
  assert(workflow.includes('cancel-in-progress: false'));
  assert(workflow.includes('max-parallel: 1'));
  assert(workflow.includes('timeout --signal=TERM --kill-after=30s ${{ matrix.outerSeconds }}s'));
  assert(workflow.includes('sparse-checkout-cone-mode: false'));
  assert(!workflow.includes('          filter:'));
  assert(!workflow.includes('npm ci --prefix baseline'));
  for (const s of ['baseline', 'candidate'])
    assert(
      workflow.includes('timeout-minutes: 3\n        uses: actions/checkout') &&
        workflow.includes(`ref: ${m[s].revision}\n          path: ${s}`),
    );
  const command = workflow.split('\n').find((l) => l.includes('node --test'));
  for (const file of [
    'scripts/test-solo-source-verifier-smoke.mjs',
    'scripts/test-solo-final-long-rail-cpu-profile.mjs',
    'scripts/test-solo-qualification-cpu-profile.mjs',
  ])
    assert(command.includes(file));
  for (const ref of [m.recipe, m.upload, ...m.adapterInputs, ...m.frozenTools]) {
    assert.deepEqual(
      await digest(new URL(ref.path, root)),
      { bytes: ref.bytes, sha256: ref.sha256 },
      ref.path,
    );
    assert(workflow.includes('            /' + ref.path + '\n'));
  }
  assert(workflow.includes(path));
  assert(workflow.includes(workflowPath));
}
test('actual one-shot release freezes all current dependencies and uses actual verifier smoke', async () =>
  checkRelease(manifest, await readFile(new URL(workflowPath, root), 'utf8')));
test('concrete release rejects relaxed activation, omitted source proof and changed current bytes', async () => {
  const w = await readFile(new URL(workflowPath, root), 'utf8');
  for (const altered of [
    w.replace(`github.event.before == '${head}'`, 'true'),
    w.replaceAll('scripts/test-solo-source-verifier-smoke.mjs', 'missing-smoke'),
    w.replace('cancel-in-progress: false', 'cancel-in-progress: true'),
  ])
    await assert.rejects(checkRelease(manifest, altered));
  const m = structuredClone(manifest);
  m.adapterInputs[0].sha256 = 'a'.repeat(64);
  await assert.rejects(checkRelease(m, w));
});
