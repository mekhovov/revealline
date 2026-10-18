import { readSoloDiagnosticSource } from './solo-retired-diagnostic-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  bindCpuProfileJob,
  cpuProfileMatrix,
  cpuProfileArguments,
  cpuProfileAssessment,
  validateCpuProfilePlan,
} from './solo-remote-cpu-profile.mjs';
import {
  qualificationNextRouteOptions,
  FIRST_VICTORY_239_CPU_FIXTURE,
  NEXT_ROUTE_PROTOCOL,
} from './solo-qualification-next-route.mjs';
const root = new URL('../', import.meta.url),
  read = readSoloDiagnosticSource,
  sha = (b) => createHash('sha256').update(b).digest('hex');
const path = 'docs/performance/solo-first-victory-cpu-239-plan.json',
  workflowPath = '.github/workflows/solo-remote-first-victory-cpu-239-temporary.yml';
const manifest = JSON.parse(await read(path)),
  bytes = await read(manifest.recipe.path),
  recipe = JSON.parse(bytes),
  plan = () => bindCpuProfileJob(manifest);
const executionWitnessPath =
  'docs/performance/fixtures/solo-first-victory-cpu/92ff-execution-source.json';
function checkedExecutionWitness(bytes, declarationBytes, workflowBytes) {
  assert.equal(sha(bytes), 'd4dca2543cc2eddb9be19e2dd0460cbc673f0f3d1c25c5ea4e997a50430151a7');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloFirstVictoryCpu92ffExecutionSourceV1');
  assert.equal(witness.head, '92ff7ef800e542617b4fc3efad96bd07ce6cbecb');
  assert.equal(witness.tree, '0cbdde8dbe125e0194d6e23df0b2da288f6c751e');
  assert.equal(witness.run, 39054542080);
  assert.equal(witness.conclusion, 'failure');
  const refs = new Map(witness.records.map((ref) => [ref.path, ref]));
  assert.equal(refs.size, witness.records.length);
  for (const [name, content] of [
    [path, declarationBytes],
    [workflowPath, workflowBytes],
  ]) {
    const ref = refs.get(name);
    assert(ref, name);
    assert.equal(content.length, ref.bytes, name);
    assert.equal(sha(content), ref.sha256, name);
  }
  return refs;
}
const args = () =>
  cpuProfileArguments(
    { plan: plan(), here: '/tools/scripts', modeState: { recipePath: '/owned/scenario.json' } },
    'http://127.0.0.1:1/game/',
    '/owned',
  ).slice(4);

test('239 profile changes only source metadata and freezes the identical public first-victory workload', async () => {
  const old = JSON.parse(
    await read(
      'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-e1cc.qualification.fixture',
    ),
  );
  assert.deepEqual(recipe, JSON.parse(JSON.stringify(old).replaceAll('e1cc', '239')));
  assert.deepEqual(recipe.actions, old.actions);
  assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, FIRST_VICTORY_239_CPU_FIXTURE);
  assert.deepEqual(qualificationNextRouteOptions(args(), recipe, bytes), {
    protocol: NEXT_ROUTE_PROTOCOL,
    sourceRevision: manifest.candidate.revision,
  });
  for (const flags of [
    args().map((x) =>
      x.startsWith('--source-revision=')
        ? '--source-revision=e1cc5dd7656bab349715cd1c3ce6e9f783508c17'
        : x,
    ),
    args().concat('--source-revision=' + manifest.candidate.revision),
    args().filter((x) => x !== '--hitch-journal'),
    args().map((x) => (x === '--cpu=2.42' ? '--cpu=2.43' : x)),
  ])
    assert.throws(() => qualificationNextRouteOptions(flags, recipe, bytes));
  assert.throws(() =>
    qualificationNextRouteOptions(args(), { ...recipe, timeoutMs: 240001 }, bytes),
  );
  const next = await read(
    'docs/performance/fixtures/solo-remote-sustained/next-geometric.qualification.fixture',
  );
  assert.throws(() =>
    qualificationNextRouteOptions(
      [
        '--authored-next-route=' + NEXT_ROUTE_PROTOCOL,
        '--source-revision=' + manifest.candidate.revision,
      ],
      JSON.parse(next),
      next,
    ),
  );
});

test('actual239 package and prior no-observation failure bind without changed bounds or baseline acquisition', () => {
  const p = plan();
  assert.equal(p.candidate.run, 39049194998);
  assert.equal(p.candidate.artifact, 12107584924);
  assert.equal(p.candidate.tree, '1ac7f17971498d2a8be19085f00a9f732db42798');
  assert.deepEqual(cpuProfileMatrix(manifest).include, [
    {
      phase: 'first-victory-cpu-profile',
      engine: 'chromium',
      jobMinutes: 130,
      stepMinutes: 78,
      outerSeconds: 4620,
    },
  ]);
  assert.equal(p.cpu, 2.42);
  assert.equal(p.rows[0].timeoutMs, 480000);
  assert.equal(p.profile.maximumMs, 240000);
  assert.equal(p.profile.maximumBytes, 64 * 1024 ** 2);
  assert.equal(p.profile.samplingIntervalUs, 1000);
  for (const change of [
    (q) => q.candidate.run++,
    (q) => q.candidate.artifact++,
    (q) => q.candidate.outer.bytes++,
    (q) => (q.candidate.inner.sha256 = '0'.repeat(64)),
    (q) => (q.candidate.manifestSHA256 = '0'.repeat(64)),
    (q) => (q.candidate.tree = '0'.repeat(40)),
    (q) => (q.runtimeRevision = '0'.repeat(40)),
    (q) => (q.sourceCohort = 'first-victory-e1cc-main8b-v1'),
    (q) => (q.recipe.sha256 = '0'.repeat(64)),
    (q) => (q.cpu = 2.43),
    (q) => q.rows[0].timeoutMs++,
    (q) => q.profile.maximumMs++,
    (q) => (q.profile.heap = true),
    (q) => (q.release.priorProfileAttempt.nativeObservations = 1),
    (q) => (q.release.priorProfileAttempt.sourceCheckoutMinutes = 4),
    (q) => (q.release.onceOnlyBefore = '0'.repeat(40)),
    (q) => (q.baseline.artifact = 1),
    (q) => (q.release.firstEightAllCorrectnessPassed = true),
  ]) {
    const q = structuredClone(p);
    change(q);
    assert.throws(() => validateCpuProfilePlan(q));
  }
});

test('239 source assessment keeps failed or partial profile observations failed', () => {
  const p = plan(),
    retained = { status: 'passed', bytes: 100, sha256: 'a'.repeat(64) },
    command = { status: 'closed', exitCode: 0, forcedCleanup: false, survivors: [], ambiguous: [] };
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
      cpuThrottle: 2.42,
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
        protocol: NEXT_ROUTE_PROTOCOL,
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
  for (const change of [
    (r) => (r.sourceRevision = 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17'),
    (r) => (r.scenarioStatus = 'fail'),
    (r) => (r.actions[0].status = 'pass'),
    (r) => (r.replay.scope = 'failed-scenario-partial'),
    (r) => (r.actions[0].unsettled = 1),
    (r) => (r.cpuProfile.stopReason = 'deadline'),
    (r) => (r.hitchJournal.status = 'incomplete'),
    (r) => (r.contextCleanupFailure = 'failed'),
    (r) => (r.performanceGateStatus = 'pass-observed-window'),
  ]) {
    const r = structuredClone(raw);
    change(r);
    assert.equal(cpuProfileAssessment(p, r, command, retained).status, 'failed');
  }
  assert.equal(
    cpuProfileAssessment(p, raw, { ...command, forcedCleanup: true }, retained).status,
    'failed',
  );
});

test('executed workflow freezes exact92ff files and four-condition before239 edge', async () => {
  const text = (await read(workflowPath)).toString();
  const conditions = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == '239c574ecddd5bb6d5896e621d9edc53e7f6a313'",
  ];
  const guard = (s) => assert(s.includes('    if: ' + conditions.join(' && ') + '\n'));
  guard(text);
  for (const c of conditions) assert.throws(() => guard(text.replace(c, 'true')));
  assert(!text.includes('workflow_dispatch'));
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(manifest.releaseTrigger.onceOnlyBefore, manifest.candidate.revision);
  const sparse = [
    ...text.slice(text.indexOf('          path: tools')).matchAll(/^            \/([^\n]+)$/gm),
  ].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  const historical = checkedExecutionWitness(
    await read(executionWitnessPath),
    await read(path),
    await read(workflowPath),
  );
  for (const ref of [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools]) {
    const original = historical.get(ref.path);
    assert(original, ref.path);
    assert.equal(original.bytes, ref.bytes, ref.path);
    assert.equal(original.sha256, ref.sha256, ref.path);
    assert(sparse.includes(ref.path), ref.path);
  }
  for (const token of [
    'timeout-minutes: 3',
    'timeout-minutes: ${{ matrix.stepMinutes }}',
    'test-solo-source-verifier-smoke.mjs',
    'test-solo-first-victory-cpu-239.mjs',
    'cancel-in-progress: false',
    'max-parallel: 1',
    'playwright@1.62.1',
  ])
    assert(text.includes(token), token);
  assert(!text.includes('npm ci --prefix baseline'));
  assert(text.includes('ref: ' + manifest.candidate.revision + '\n          path: candidate'));
});

test('standalone actual module binds the239 profile without a browser', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'solo-victory239-'));
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
  const p = JSON.parse(await readFile(join(dir, 'plan.json')));
  assert.equal(p.manifestInput.sha256, sha(await read(path)));
  assert.equal(p.manifestInput.bytes, (await read(path)).length);
  delete p.manifestInput;
  assert.deepEqual(p, plan());
});

test('executed239 release rejects changed witness, declaration and workflow independently', async () => {
  const w = await read(executionWitnessPath),
    m = await read(path),
    f = await read(workflowPath);
  checkedExecutionWitness(w, m, f);
  for (const inputs of [
    [Buffer.concat([w, Buffer.from(' ')]), m, f],
    [w, Buffer.concat([m, Buffer.from(' ')]), f],
    [w, m, Buffer.concat([f, Buffer.from(' ')])],
  ])
    assert.throws(() => checkedExecutionWitness(...inputs));
});
