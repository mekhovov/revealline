import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  bindCpuProfileJob,
  cpuProfileArguments,
  cpuProfileAssessment,
  cpuProfileMatrix,
  validateCpuProfilePlan,
  firstVictoryDe332ProfileOrigin,
} from './solo-remote-cpu-profile.mjs';
import {
  qualificationNextRouteOptions,
  FIRST_VICTORY_DE332_CPU_FIXTURE,
} from './solo-qualification-next-route.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const path = 'docs/performance/solo-first-victory-cpu-de332-plan.json';
const manifest = JSON.parse(await read(path));
const priorDeclaredSourcePath =
  'docs/performance/fixtures/solo-first-victory-cpu/de332-prior-declared-source.json';
function priorDeclaredSource(bytes, declarationBytes) {
  assert.equal(bytes.length, 1415);
  assert.equal(sha(bytes), '882ceb674329e9ad1892e8f3bf0893cc17f57766fd2017d26a3f1ff1a9028d14');
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'SoloDe332CpuDeclaredSourceV1');
  assert.equal(value.revision, '2e7947f4ec802314978748c0310c3eabbd5d82da');
  assert.equal(value.tree, '709f86a9771aa03e4daaf2bb964aea01f9889ff7');
  assert.equal(value.postHocExactGitReadback, true);
  assert.equal(value.declaration, path);
  assert.deepEqual(
    value.records.map((r) => r.path),
    [
      'docs/performance/solo-first-victory-cpu-de332-plan.json',
      'scripts/solo-remote-cpu-profile.mjs',
      'scripts/solo-qualification-next-route.mjs',
      'scripts/solo-qualification-hitch-journal.mjs',
    ],
  );
  const refs = new Map(value.records.map((r) => [r.path, r]));
  assert.equal(declarationBytes.length, refs.get(path).bytes);
  assert.equal(sha(declarationBytes), refs.get(path).sha256);
  refs.delete(path);
  return refs;
}

const bytes = await read(manifest.recipe.path);
const recipe = JSON.parse(bytes);
const plan = () => bindCpuProfileJob(manifest);
const args = () =>
  cpuProfileArguments(
    { plan: plan(), here: '/tools/scripts', modeState: { recipePath: '/owned/scenario.json' } },
    'http://127.0.0.1:1/game/',
    '/owned',
  ).slice(4);

test('de332 profile retains actual public actions, replay definition, input deadlines and excluded observation bounds', async () => {
  const prior = JSON.parse(
    await read(
      'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-239.qualification.fixture',
    ),
  );
  for (const key of Object.keys(prior)) {
    if (!['id', 'coverage', 'nativeRouteCpuProfile'].includes(key))
      assert.deepEqual(recipe[key], prior[key], key);
  }
  assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, FIRST_VICTORY_DE332_CPU_FIXTURE);
  assert.deepEqual(qualificationNextRouteOptions(args(), recipe, bytes), {
    protocol: 'authored-next-geometric-v1',
    sourceRevision: manifest.candidate.revision,
  });
  for (const flags of [
    args().map((x) => (x === '--cpu=3.88' ? '--cpu=2.42' : x)),
    args().map((x) =>
      x.startsWith('--source-revision=') ? '--source-revision=' + '0'.repeat(40) : x,
    ),
    args().concat('--source-revision=' + manifest.candidate.revision),
    args().filter((x) => x !== '--hitch-journal'),
    args().concat('--memory-profile'),
  ])
    assert.throws(() => qualificationNextRouteOptions(flags, recipe, bytes));
  assert.throws(() =>
    qualificationNextRouteOptions(args(), { ...recipe, timeoutMs: 240001 }, bytes),
  );
  assert.throws(() =>
    qualificationNextRouteOptions(args(), recipe, Buffer.concat([bytes, Buffer.from(' ')])),
  );
  assert.deepEqual(cpuProfileMatrix(manifest).include, [
    {
      phase: 'first-victory-cpu-profile',
      engine: 'chromium',
      jobMinutes: 130,
      stepMinutes: 78,
      outerSeconds: 4620,
    },
  ]);
});

test('verified package and closed numerical-failure predecessor are required; bounds and source substitutions fail', async () => {
  const p = plan();
  const first = JSON.parse(await read('docs/performance/solo-remote-de332-correctness-plan.json'));
  for (const key of ['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'])
    assert.deepEqual(p.candidate[key], first.candidate[key], key);
  assert.deepEqual(p.stressOrigin, firstVictoryDe332ProfileOrigin());
  assert.equal(p.stressOrigin.predecessorExitCode, 2);
  assert.equal(p.stressOrigin.predecessorScenarioStatus, 'pass');
  assert.equal(p.stressOrigin.predecessorPerformanceStatus, 'fail');
  for (const mutate of [
    (q) => q.candidate.artifact++,
    (q) => q.candidate.outer.bytes++,
    (q) => (q.candidate.inner.sha256 = '0'.repeat(64)),
    (q) => (q.runtimeRevision = '0'.repeat(40)),
    (q) => (q.sourceCohort = 'first-victory-239-main8b-v1'),
    (q) => q.recipe.bytes++,
    (q) => (q.recipe.sha256 = '0'.repeat(64)),
    (q) => (q.cpu = 2.42),
    (q) => q.rows[0].timeoutMs++,
    (q) => q.profile.maximumMs++,
    (q) => (q.profile.heap = true),
    (q) => (q.performanceExclusion = false),
    (q) => q.automaticRetries++,
    (q) => (q.release.dispatch.ref = 'arbitrary'),
    (q) => (q.release.dispatch.lane = 'next'),
    (q) => (q.release.noUnclosedOwners = false),
    (q) => (q.stressOrigin.predecessorForcedCleanup = true),
    (q) => (q.stressOrigin.predecessorExitCode = 0),
    (q) => (q.baseline.artifact = 1),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    assert.throws(() => validateCpuProfilePlan(q));
  }
});

test('actual assessment requires completed route, same-source replay, closed owners and retained profile', () => {
  const p = plan(),
    retained = { status: 'passed', bytes: 100, sha256: 'a'.repeat(64) };
  const command = {
    status: 'closed',
    exitCode: 0,
    forcedCleanup: false,
    survivors: [],
    ambiguous: [],
  };
  const raw = {
    format: 'SoloQualificationReportV1',
    kind: 'cpu-profile',
    scenarioKind: 'performance',
    audioProof: false,
    scenarioStatus: 'pass',
    scenarioSHA256: p.recipe.sha256,
    sourceRevision: p.candidate.revision,
    buildIdentity: { sourceRevision: p.candidate.revision },
    environment: {
      engine: 'chromium',
      cpuThrottle: 3.88,
      contextMode: 'ephemeral',
      browserVersion: 'test',
      requestedDisplay: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: false,
    replay: {
      scope: 'completed-scenario',
      nativeVerification: { status: 'pass', engine: 'chromium', browserVersion: 'test' },
    },
    pageErrors: [],
    hitchJournal: { status: 'complete' },
    actions: [
      {
        type: 'authored-next-route',
        status: 'passed-public-route',
        protocol: 'authored-next-geometric-v1',
        mission: 'first-return',
        unsettled: 0,
        heldKeys: [],
      },
    ],
    cpuProfile: {
      status: 'retained',
      maximumMs: 240000,
      samplingIntervalUs: 1000,
      stopReason: 'actions-ended',
      sampleCount: 10,
      nodeCount: 2,
      bytes: 100,
      sha256: 'a'.repeat(64),
    },
    performanceGateStatus: 'excluded-cpu-profiling',
  };
  assert.equal(cpuProfileAssessment(p, raw, command, retained).status, 'passed');
  for (const mutate of [
    (r) => (r.sourceRevision = '0'.repeat(40)),
    (r) => (r.scenarioStatus = 'fail'),
    (r) => (r.actions[0].unsettled = 1),
    (r) => (r.replay.scope = 'failed-scenario-partial'),
    (r) => (r.replay.nativeVerification.status = 'fail'),
    (r) => (r.hitchJournal.status = 'incomplete'),
    (r) => (r.cpuProfile.stopReason = 'deadline'),
    (r) => (r.cpuProfile.sha256 = '0'.repeat(64)),
    (r) => (r.contextCleanupFailure = 'failed'),
    (r) => (r.performanceGateStatus = 'pass-observed-window'),
  ]) {
    const r = structuredClone(raw);
    mutate(r);
    assert.equal(cpuProfileAssessment(p, r, command, retained).status, 'failed');
  }
  for (const changed of [
    { ...command, forcedCleanup: true },
    { ...command, exitCode: 2 },
    { ...command, ambiguous: [{ pid: 1 }] },
  ])
    assert.equal(cpuProfileAssessment(p, raw, changed, retained).status, 'failed');
});

test('standalone binder preserves manifest identity without browser or build execution', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'solo-cpu-de332-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  execFileSync(
    process.execPath,
    [
      new URL('scripts/solo-remote-cpu-profile.mjs', root).pathname,
      'bind-plan',
      new URL(path, root).pathname,
      join(dir, 'plan.json'),
    ],
    { cwd: dir, timeout: 5000, maxBuffer: 65536 },
  );
  const actual = JSON.parse(await readFile(join(dir, 'plan.json')));
  assert.equal(actual.manifestInput.sha256, sha(await read(path)));
  delete actual.manifestInput;
  assert.deepEqual(actual, plan());
});

test('prior CPU declaration retains exact Git-bound tools while unchanged inputs stay current', async () => {
  const historical = priorDeclaredSource(await read(priorDeclaredSourcePath), await read(path));
  const refs = [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools];
  assert.equal(new Set(refs.map((x) => x.path)).size, refs.length);
  for (const ref of refs) {
    const old = historical.get(ref.path);
    if (old) {
      assert.equal(old.bytes, ref.bytes, ref.path);
      assert.equal(old.sha256, ref.sha256, ref.path);
    } else {
      const b = await read(ref.path);
      assert.equal(b.length, ref.bytes, ref.path);
      assert.equal(sha(b), ref.sha256, ref.path);
    }
  }
});
test('prior CPU source cannot accept altered witness, declaration or invented authority', async () => {
  const bytes = await read(priorDeclaredSourcePath),
    declaration = await read(path);
  assert.equal(priorDeclaredSource(bytes, declaration).size, 3);
  for (const [w, d] of [
    [Buffer.concat([bytes, Buffer.from(' ')]), declaration],
    [bytes, Buffer.concat([declaration, Buffer.from(' ')])],
    [Buffer.from(JSON.stringify({ ...JSON.parse(bytes), revision: '0'.repeat(40) })), declaration],
    [Buffer.from(JSON.stringify({ ...JSON.parse(bytes), records: [] })), declaration],
  ])
    assert.throws(() => priorDeclaredSource(w, d));
});
