import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, mkdir, writeFile, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bindCpuProfileJob,
  cpuProfileArguments,
  cpuProfileAssessment,
  cpuProfileMatrix,
  firstVictoryProfileOrigin,
  validateCpuProfilePlan,
  prepareCpuProfileMode,
} from './solo-remote-cpu-profile.mjs';
import {
  qualificationNextRouteOptions,
  NEXT_ROUTE_PROTOCOL,
  FIRST_VICTORY_CPU_FIXTURE,
} from './solo-qualification-next-route.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root));
const manifest = JSON.parse(await read('docs/performance/solo-first-victory-cpu-e1cc-plan.json'));
const bytes = await read(manifest.recipe.path),
  recipe = JSON.parse(bytes),
  plan = () => bindCpuProfileJob(manifest);
const original = JSON.parse(
  await read(
    'docs/performance/fixtures/solo-remote-sustained/next-geometric.qualification.fixture',
  ),
);
const args = () =>
  cpuProfileArguments(
    { plan: plan(), here: '/tools/scripts', modeState: { recipePath: '/owned/scenario.json' } },
    'http://127.0.0.1:1234/game/?journey=opening',
    '/owned',
  ).slice(4);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const closed = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  ambiguous: [],
  survivors: [],
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
    sourceRevision: manifest.candidate.revision,
    buildIdentity: { sourceRevision: manifest.candidate.revision },
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: false,
    environment: {
      engine: 'chromium',
      cpuThrottle: 2.42,
      contextMode: 'ephemeral',
      browserVersion: 'native-test-version',
      requestedDisplay: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
    replay: {
      scope: 'completed-scenario',
      nativeVerification: {
        status: 'pass',
        engine: 'chromium',
        browserVersion: 'native-test-version',
      },
    },
    pageErrors: [],
    performanceGateStatus: 'excluded-cpu-profiling',
    cpuProfile: {
      ...readback,
      status: 'retained',
      maximumMs: 240000,
      samplingIntervalUs: 1000,
      stopReason: 'actions-ended',
      sampleCount: 1000,
      nodeCount: 100,
    },
    hitchJournal: { status: 'complete' },
    actions: [
      {
        type: 'authored-next-route',
        protocol: NEXT_ROUTE_PROTOCOL,
        mission: 'first-return',
        status: 'pass',
        unsettled: 0,
        heldKeys: [],
      },
    ],
  };
}
test('profile freezes the original first-victory public prefix and keeps its input deadline', () => {
  assert.deepEqual(recipe.actions.slice(0, 7), original.actions.slice(0, 7));
  assert.deepEqual(recipe.actions.slice(7), [
    { type: 'snapshot', group: 'first-victory-cpu' },
    { type: 'exportReplay', label: 'first-victory-cpu' },
  ]);
  assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, FIRST_VICTORY_CPU_FIXTURE);
  assert.deepEqual(qualificationNextRouteOptions(args(), recipe, bytes), {
    protocol: NEXT_ROUTE_PROTOCOL,
    sourceRevision: manifest.candidate.revision,
  });
  assert.equal(recipe.query.journey, original.query.journey);
  assert.equal(recipe.timeoutMs, 240000);
  assert.equal(recipe.expectedReplayDefinition.level.id, 'first-return');
  assert.deepEqual(
    recipe.expectedReplayDefinition.options,
    original.expectedReplayDefinition.options,
  );
  assert.deepEqual(plan().stressOrigin, firstVictoryProfileOrigin());
  assert.equal(plan().baseline.reusableArtifact, undefined);
  assert.deepEqual(cpuProfileMatrix(manifest), {
    include: [
      {
        phase: 'first-victory-cpu-profile',
        engine: 'chromium',
        jobMinutes: 130,
        stepMinutes: 78,
        outerSeconds: 4620,
      },
    ],
  });
  assert.deepEqual(args(), [
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    '--cpu=2.42',
    '--browser=chromium',
    `--source-revision=${manifest.candidate.revision}`,
    '--cpu-profile',
    '--hitch-journal',
    `--authored-next-route=${NEXT_ROUTE_PROTOCOL}`,
  ]);
});
test('profile source, actual package, observed factor, owner and all existing caps reject mutation', () => {
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.run++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = 'a'.repeat(64)),
    (p) => (p.candidate.manifestSHA256 = 'a'.repeat(64)),
    (p) => (p.candidate.tree = 'a'.repeat(40)),
    (p) => (p.candidate.revision = 'a'.repeat(40)),
    (p) => (p.runtimeRevision = 'a'.repeat(40)),
    (p) => (p.sourceCohort = 'unknown'),
    (p) => (p.phase = 'long-rail-cpu-profile'),
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.baseline.buildCommand = 'build'),
    (p) => (p.baseline.tree = 'a'.repeat(40)),
    (p) => (p.upload = {}),
    (p) => (p.cpu = 1),
    (p) => p.rows.push(p.rows[0]),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.recipe.sha256 = 'a'.repeat(64)),
    (p) => p.recipe.bytes++,
    (p) => (p.recipe.path = 'docs/other'),
    (p) => p.profile.maximumMs++,
    (p) => p.profile.maximumBytes++,
    (p) => p.profile.samplingIntervalUs++,
    (p) => (p.profile.traceBytes = 1),
    (p) => (p.profile.heap = true),
    (p) => (p.profile.screenshots = true),
    (p) => p.helperTimeoutMs++,
    (p) => p.setupTimeoutMs++,
    (p) => p.evidenceBytes++,
    (p) => p.rowEvidenceBytes++,
    (p) => p.automaticRetries++,
    (p) => (p.performanceExclusion = false),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => (p.release.firstEightRequired = true),
    (p) => (p.release.allPriorPlannedJobsClosed = true),
    (p) => (p.release.noUnclosedOwners = false),
    (p) => (p.release.onceOnlyBefore = 'a'.repeat(40)),
    (p) => (p.stressOrigin.newHostCalibration = true),
    (p) => (p.stressOrigin.predecessorExitCode = 0),
    (p) => (p.stressOrigin.commandSHA256 = 'a'.repeat(64)),
    (p) =>
      (p.frozenTools = p.frozenTools.filter(
        (x) => x.path !== 'scripts/solo-qualification-next-route.mjs',
      )),
    (p) =>
      (p.frozenTools = p.frozenTools.filter((x) => x.path !== 'scripts/verify-solo-build.mjs')),
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateCpuProfilePlan(p));
  }
});
test('only the exact separate profile recipe can combine CPU recording and the native route', () => {
  for (const flag of [
    '--cpu-profile',
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--browser=chromium',
    '--cpu=2.42',
    `--source-revision=${manifest.candidate.revision}`,
  ])
    assert.throws(
      () =>
        qualificationNextRouteOptions(
          args().filter((x) => x !== flag),
          recipe,
          bytes,
        ),
      flag,
    );
  for (const flag of [
    '--memory-profile',
    '--baseline-runtime',
    '--audio-proof',
    '--readiness-probe=first-running-v1',
    '--journal-cost-probe',
    '--cpu=2.42',
    '--hitch-journal-preparation=first-return-anchored-v1',
  ])
    assert.throws(() => qualificationNextRouteOptions([...args(), flag], recipe, bytes), flag);
  for (const change of [
    (r) => r.timeoutMs++,
    (r) => r.actions[6].timeoutMs++,
    (r) => (r.actions[6].mission = 'second-landing'),
    (r) => (r.nativeRouteCpuProfile = 'other'),
    (r) => delete r.nativeRouteProtocol,
    (r) => r.expectedReplayDefinition.level.rules.moveSpeed++,
  ]) {
    const r = structuredClone(recipe);
    change(r);
    assert.throws(() => qualificationNextRouteOptions(args(), r, bytes));
  }
  assert.throws(() =>
    qualificationNextRouteOptions(args(), recipe, Buffer.concat([bytes, Buffer.from(' ')])),
  );
  const legacyFlags = args().filter((x) => x !== '--cpu-profile');
  const legacyBytes = Buffer.from(JSON.stringify(original));
  assert.throws(() => qualificationNextRouteOptions(args(), original, legacyBytes));
  assert.throws(() => qualificationNextRouteOptions(legacyFlags, recipe, bytes));
});
test('partial or limited profile remains retained evidence without qualifying the failed route', () => {
  assert.equal(cpuProfileAssessment(plan(), raw(), closed, readback).status, 'passed');
  for (const mutate of [
    (r) => (r.scenarioStatus = 'fail'),
    (r) => (r.replay.scope = 'partial'),
    (r) => (r.replay.nativeVerification.status = 'fail'),
    (r) => (r.actions[0].status = 'fail'),
    (r) => (r.actions[0].unsettled = 1),
    (r) => (r.actions[0].heldKeys = ['ArrowDown']),
    (r) => (r.actions[0].mission = 'second-landing'),
    (r) => r.actions.push(r.actions[0]),
    (r) => (r.hitchJournal.status = 'incomplete'),
    (r) => (r.cpuProfile.stopReason = 'scenario-failure'),
    (r) => (r.cpuProfile.limitReached = true),
    (r) => (r.cpuProfileFailure = 'stop timeout'),
    (r) => r.cpuProfile.bytes++,
    (r) => (r.sourceRevision = 'a'.repeat(40)),
    (r) => (r.performanceGateStatus = 'pass-observed-window'),
  ]) {
    const r = raw();
    mutate(r);
    assert.equal(cpuProfileAssessment(plan(), r, closed, readback).status, 'failed');
  }
  for (const c of [
    { ...closed, exitCode: 1 },
    { ...closed, forcedCleanup: true },
    { ...closed, violation: 'deadline' },
    { ...closed, survivors: [1] },
    { ...closed, ambiguous: [1] },
  ])
    assert.equal(cpuProfileAssessment(plan(), raw(), c, readback).status, 'failed');
  const partial = raw();
  partial.scenarioStatus = 'fail';
  partial.cpuProfile.stopReason = 'scenario-failure';
  const verdict = cpuProfileAssessment(plan(), partial, { ...closed, exitCode: 1 }, readback);
  assert.equal(partial.cpuProfile.status, 'retained');
  assert.equal(verdict.status, 'failed');
  assert.equal(verdict.performanceQualification, 'excluded-cpu-profiling');
});
test('standalone adapter binds only one exact profile with no payload or browser', async (t) => {
  const temp = await realpath(await mkdtemp(join(tmpdir(), 'first-victory-profile-')));
  t.after(() => rm(temp, { recursive: true, force: true }));
  await mkdir(join(temp, 'scripts'));
  for (const f of ['solo-remote-cpu-profile.mjs', 'solo-remote-supplemental.mjs'])
    await writeFile(join(temp, 'scripts', f), await read('scripts/' + f));
  await writeFile(join(temp, 'plan.json'), JSON.stringify(manifest));
  const r = spawnSync(
    process.execPath,
    [
      join(temp, 'scripts/solo-remote-cpu-profile.mjs'),
      'bind-plan',
      join(temp, 'plan.json'),
      join(temp, 'bound.json'),
    ],
    { cwd: temp, encoding: 'utf8', timeout: 5000, maxBuffer: 65536 },
  );
  assert.equal(r.status, 0, r.stderr);
  const bound = JSON.parse(await readFile(join(temp, 'bound.json')));
  assert.deepEqual(bound.rows, plan().rows);
  assert.equal(bound.releaseTrigger.status, 'reviewed-one-shot');
});

test('one-shot workflow freezes every current helper and preserves the existing source/owner envelope', async () => {
  const workflow = await read('.github/workflows/solo-remote-first-victory-cpu-e1cc-temporary.yml');
  const text = workflow.toString();
  const conditions = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
  ];
  const guard = (value) => assert(value.includes('    if: ' + conditions.join(' && ') + '\n'));
  guard(text);
  for (const condition of conditions) assert.throws(() => guard(text.replace(condition, 'true')));
  assert(!text.includes('if: ${{ false }}'));
  assert(!text.includes('workflow_dispatch'));
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(manifest.releaseTrigger.onceOnlyBefore, '7c7cc2648331870683ac7b76850bbeff859f802e');
  const sparse = [
    ...text.slice(text.indexOf('          path: tools')).matchAll(/^            \/([^\n]+)$/gm),
  ].map((x) => x[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools]) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(sha(b), ref.sha256, ref.path);
    assert(sparse.includes(ref.path), ref.path);
  }
  for (const expected of [
    'cancel-in-progress: false',
    'max-parallel: 1',
    "node-version: '22.13.1'",
    'playwright@1.62.1',
    'timeout-minutes: ${{ matrix.stepMinutes }}',
    'test-solo-source-verifier-smoke.mjs',
  ])
    assert(text.includes(expected), expected);
  assert(!text.includes('npm ci --prefix baseline'));
  assert(text.includes('ref: ' + manifest.candidate.revision + '\n          path: candidate'));
  assert(text.includes('ref: ' + manifest.baseline.revision + '\n          path: baseline'));
});

test('actual preparer verifies current closure and copies the exact profile route without baseline acquisition', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'first-victory-preparation-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'work'));
  await mkdir(join(dir, 'evidence'));
  const digest = async (p) => {
    const b = await readFile(p);
    return { bytes: b.length, sha256: sha(b) };
  };
  const report = {};
  const state = await prepareCpuProfileMode({
    plan: plan(),
    repository: await realpath(root),
    work: join(dir, 'work'),
    evidence: join(dir, 'evidence'),
    admitted: { status: 'passed' },
    digest,
    report,
    ensureBaseline() {
      throw Error('forbidden baseline acquisition');
    },
  });
  assert.deepEqual(await readFile(state.recipePath), bytes);
  assert.equal(report.performanceQualification, 'excluded-cpu-profiling');
});
