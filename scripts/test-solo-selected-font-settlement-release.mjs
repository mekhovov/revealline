import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext, createContext, runInContext } from 'node:vm';
import { parse } from 'acorn';
import {
  bindReadinessJob,
  readinessMatrix,
  readinessArguments,
  readinessAssessment,
  validateReadinessPlan,
  SELECTED_FONT_SETTLEMENT_FIXTURE,
} from './solo-remote-readiness.mjs';
import * as readiness from './solo-qualification-readiness.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import { verifyTimingHitchJournal } from './solo-remote-sustained.mjs';
const root = new URL('../', import.meta.url),
  read = (p) => readFile(new URL(p, root));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const manifestPath = 'docs/performance/solo-selected-font-settlement-e1cc-plan.json';
const workflowPath = '.github/workflows/solo-remote-selected-font-settlement-e1cc-temporary.yml';
const manifest = JSON.parse(await read(manifestPath)),
  workflow = (await read(workflowPath)).toString();
const before = 'bab3b2790944c6257f9c1f9b346839996bbefebb';
const plan = () => bindReadinessJob(manifest, 'webkit');

const executedBytes = await read(
  'docs/performance/fixtures/solo-readiness-font/397-settlement-execution-source.json',
);
function executedBindings(bytes, declaration, workflowBytes) {
  assert.equal(hash(bytes), '1a76da62793199a23c9de1cb749ae11db5a4f9895e0d6d8e3a29d9f865be7f6d');
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'SoloSelectedFont397ExecutedSourceV1');
  assert.equal(value.revision, '39774cce8697d412d138ef4da11ac547a5f8e535');
  assert.equal(value.tree, 'cac2369a26cac5282e4260c638b934540d17ced6');
  assert.equal(value.run, 39066188215);
  assert.equal(value.artifact, 12113228769);
  assert.equal(value.records.length, 52);
  assert.equal(new Set(value.records.map((r) => r.path)).size, value.records.length);
  for (const [path, input] of [
    [manifestPath, declaration],
    [workflowPath, workflowBytes],
  ]) {
    const ref = value.records.find((r) => r.path === path);
    assert.equal(input.length, ref.bytes);
    assert.equal(hash(input), ref.sha256);
  }
  for (const ref of value.records) assert.match(ref.blob, /^[a-f0-9]{40}$/);
  return value;
}
const executed = executedBindings(executedBytes, await read(manifestPath), Buffer.from(workflow));
test('executed397 V4 rejects changed source witness, declaration or workflow', () => {
  assert.throws(() =>
    executedBindings(Buffer.from('{}'), Buffer.from('{}'), Buffer.from(workflow)),
  );
  assert.throws(() => executedBindings(executedBytes, Buffer.from('{}'), Buffer.from(workflow)));
  assert.throws(() =>
    executedBindings(
      executedBytes,
      Buffer.from(JSON.stringify(manifest)),
      Buffer.from(workflow + ' '),
    ),
  );
});

test('one exact e1cc WebKit settlement row retains the original public actions and source/package limits', async () => {
  const p = plan(),
    old = JSON.parse(await read('docs/performance/solo-optional-start-audio-e1cc-v4-plan.json'));
  assert.deepEqual(readinessMatrix(manifest), {
    include: [{ engine: 'webkit', jobMinutes: 130, stepMinutes: 78, outerSeconds: 4620 }],
  });
  for (const key of [
    'candidate',
    'runtimeRevision',
    'baseline',
    'cpu',
    'maxParallel',
    'automaticRetries',
    'performanceExclusion',
    'hitchJournal',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'rowEvidenceBytes',
    'evidenceBytes',
  ])
    assert.deepEqual(p[key], old[key], key);
  assert.equal(p.rows.length, 1);
  assert.deepEqual(p.fixture, SELECTED_FONT_SETTLEMENT_FIXTURE);
  const scenario = JSON.parse(await read(p.fixture.path));
  const prior = JSON.parse(
    await read(
      'docs/performance/fixtures/solo-readiness-font/selected-font-cancel-post-command-v3.qualification.fixture',
    ),
  );
  assert.deepEqual(scenario.actions, prior.actions);
  for (const key of ['replayRequirements', 'expectedReplayDefinition', 'timeoutMs']) {
    assert(Object.hasOwn(scenario, key));
    assert(Object.hasOwn(prior, key));
    assert.deepEqual(scenario[key], prior[key], key);
  }
  assert.equal(p.release.firstEightRequired, false);
  assert.equal(p.release.firstEightAllCorrectnessPassed, undefined);
  assert.equal(p.priorResults.status, 'failed');
  for (const mutate of [
    (v) => v.candidate.artifact++,
    (v) => v.candidate.run++,
    (v) => v.candidate.outer.bytes++,
    (v) => (v.candidate.inner.sha256 = '0'.repeat(64)),
    (v) => (v.candidate.manifestSHA256 = '0'.repeat(64)),
    (v) => (v.candidate.revision = '0'.repeat(40)),
    (v) => (v.candidate.tree = '0'.repeat(40)),
    (v) => (v.runtimeRevision = '0'.repeat(40)),
    (v) => (v.engine = 'chromium'),
    (v) => (v.fixture.sha256 = '0'.repeat(64)),
    (v) => (v.sourceCohort = 'readiness-selected-font-candidatec696'),
    (v) => (v.protocol.name = 'selected-font-cancel-post-command-v3'),
    (v) => delete v.protocol.cancelBoundaryObservation,
    (v) => v.rows.push(v.rows[0]),
    (v) => v.automaticRetries++,
    (v) => (v.cpu = 2),
    (v) => v.rows[0].timeoutMs++,
    (v) => v.rowEvidenceBytes++,
    (v) => v.helperTimeoutMs++,
    (v) => (v.performanceExclusion = false),
    (v) => (v.release.onceOnlyBefore = '0'.repeat(40)),
    (v) => v.release.observationCorrection.priorRun++,
    (v) => (v.release.observationCorrection.priorRowStatus = 'passed'),
    (v) => (v.release.observationCorrection.originalDemandOnly = false),
    (v) => (v.release.observationCorrection.publicActionsChanged = true),
    (v) => (v.release.observationCorrection.numericalGatesChanged = true),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    assert.throws(() => validateReadinessPlan(q));
  }
  assert.throws(() => bindReadinessJob(manifest, 'chromium'));
});

test('actual one-module CLI and enriched row arguments select V4 without changing browser ownership or raw gates', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-font-v4-bind-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'adapter.mjs'), await read('scripts/solo-remote-readiness.mjs'));
  await writeFile(join(dir, 'plan.json'), await read(manifestPath));
  const out = spawnSync(
    process.execPath,
    [
      join(dir, 'adapter.mjs'),
      'bind-plan',
      join(dir, 'plan.json'),
      join(dir, 'bound.json'),
      'webkit',
    ],
    { cwd: dir, encoding: 'utf8', timeout: 5000, maxBuffer: 65536 },
  );
  assert.equal(out.status, 0, out.stderr);
  const p = JSON.parse(await readFile(join(dir, 'bound.json')));
  const row = {
    ...p.rows[0],
    status: 'failed',
    startedAt: new Date(0).toISOString(),
    storage: { minimumRemainingBytes: 1024 ** 3 },
  };
  const args = readinessArguments(
    { plan: p, here: '/tools/scripts', repository: '/tools' },
    row,
    'http://127.0.0.1:4321/game/?journey=opening',
    '/evidence',
  );
  for (const arg of [
    '--readiness-probe=selected-font-request-settlement-v4',
    '--readiness-cancel-boundary=post-command-v3',
    '--context=persistent',
    '--cpu=1',
    '--cadence=settled120',
    '--hitch-journal',
    '--work-probe',
  ])
    assert(args.includes(arg), arg);
  assert(!args.includes('--baseline-runtime'));
});

test('executed four-condition one-shot workflow and every immutable frozen input are exact', async () => {
  const terms = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    `github.event.before == '${before}'`,
  ];
  const guard = (s) => assert(s.includes('    if: ' + terms.join(' && ') + '\n'));
  guard(workflow);
  for (const term of terms) assert.throws(() => guard(workflow.replace(term, 'true')));
  assert.equal(manifest.releaseTrigger.onceOnlyBefore, before);
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  for (const term of [
    'engine: [webkit]',
    'install --with-deps chromium webkit',
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
    'bind-plan ' + manifestPath,
    'cancel-in-progress: false',
  ])
    assert(workflow.includes(term), term);
  for (const term of ['workflow_dispatch', 'workflow_run', 'continue-on-error'])
    assert(!workflow.includes(term));
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [...manifest.adapterInputs, ...manifest.frozenTools, manifest.fixture]) {
    const historical = executed.records.find((r) => r.path === ref.path);
    assert.equal(historical?.bytes, ref.bytes, ref.path);
    assert.equal(historical?.sha256, ref.sha256, ref.path);
    assert(sparse.includes(ref.path));
  }
  for (const p of [
    manifestPath,
    workflowPath,
    'scripts/test-solo-selected-font-settlement.mjs',
    'scripts/test-solo-selected-font-settlement-release.mjs',
    'scripts/test-solo-optional-audio-observer-successor.mjs',
    'docs/performance/fixtures/solo-optional-start-audio/bab3-execution-source.json',
    'game/ui/field-kit-fonts.css',
    'game/presentation/theme-host.mjs',
  ])
    assert(sparse.includes(p), p);
});

function declarations(source, names) {
  return parse(source, { ecmaVersion: 'latest', sourceType: 'module' })
    .body.filter(
      (n) =>
        (n.type === 'FunctionDeclaration' && names.includes(n.id.name)) ||
        (n.type === 'VariableDeclaration' &&
          n.declarations.every((d) => names.includes(d.id.name))),
    )
    .map((n) => source.slice(n.start, n.end))
    .join('\n');
}
async function actualModel() {
  const source = (await read('scripts/test-solo-selected-font-settlement.mjs')).toString();
  const prior = (await read('scripts/test-solo-selected-font-post-command.mjs')).toString();
  const actualModel = prior.slice(
    prior.indexOf('function model('),
    prior.indexOf("\ntest('V3 serialized"),
  );
  const bodies = declarations(source, [
    'target',
    'sample',
    'flush',
    'deferred',
    'face',
    'harness',
    'ownerHarness',
    'completedOwner',
    'readinessModel',
  ]);
  return JSON.parse(
    JSON.stringify(
      await runInNewContext(
        `(async()=>{${bodies};const h=await completedOwner();const m=readinessModel('selected-font-request-settlement-v4');return {observation:m.observation,app:m.app,transport:m.transport,owner:h.owner.snapshot()};})()`,
        {
          assert,
          JSON,
          TextEncoder,
          URL,
          structuredClone,
          runInNewContext,
          createContext,
          runInContext,
          actualModel,
          ...readiness,
        },
      ),
    ),
  );
}
async function raw() {
  const m = await actualModel(),
    p = plan(),
    scenario = JSON.parse(await read(p.fixture.path));
  const r = {
    format: 'SoloQualificationReportV1',
    kind: 'readiness-diagnostic',
    scenarioKind: 'lifecycle',
    scenarioStatus: 'pass',
    scenarioSHA256: p.fixture.sha256,
    sourceRevision: p.candidate.revision,
    buildIdentity: { sourceRevision: p.candidate.revision },
    environment: {
      engine: 'webkit',
      browserVersion: 'modeled',
      cpuThrottle: 1,
      contextMode: 'persistent',
      contextOwner: { cleanup: { status: 'closed', profileRemoved: true, browserClosed: true } },
      graphicsCapability: {
        format: 'SoloReadinessGpuCapabilityV1',
        engine: 'webkit',
        canProceed: true,
        requestBudgetMs: 5000,
        cleanupBudgetMs: 2000,
        maximumBytes: 16384,
        status: 'unsupported',
        requestSettled: false,
        sessionDetached: false,
        reason: 'non-chromium-engine',
      },
    },
    workProbe: true,
    cadenceProtocol: 'settled120',
    cacheMode: 'fresh-context',
    baselineRuntime: false,
    readinessPilot: {
      protocol: p.protocol.name,
      cancelBoundaryObservation: 'post-command-v3',
      settlementObservation: 'original-demand-v1',
      performanceQualification: false,
    },
    readinessDocuments: 1,
    readinessObservation: m.observation,
    selectedFontTransport: m.transport,
    selectedFontSettlement: m.owner,
    startupCadenceObservations: [
      { pilotStartupWait: 'omitted; immediate partial samples retained' },
    ],
    snapshots: [{ application: m.app }],
    performanceGateStatus: 'pass-observed-window',
    pageErrors: [],
    replay: {
      scope: 'completed-scenario',
      nativeVerification: {
        status: 'pass',
        engine: 'webkit',
        browserVersion: 'modeled',
        observation: { match: true },
      },
    },
    actions: scenario.actions.map((a, i) => ({
      path: String(i),
      type: a.type,
      label: a.label ?? null,
      status: 'pass',
    })),
  };
  r.readinessAssessment = readiness.assessSelectedFontSettlementReadiness(
    m.observation,
    m.app,
    1,
    m.transport,
    m.owner,
  );
  return r;
}
test('independent adapter reads actual serialized settlement evidence and preserves numeric or native failures', async () => {
  const p = plan(),
    r = await raw(),
    command = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] },
    journal = { status: 'complete' };
  const check = (v, c = command, j = journal) => readinessAssessment(p, p.rows[0], v, c, j);
  const result = await check(r);
  assert.equal(result.status, 'passed', result.readinessFailure);
  for (const [numeric, status] of [
    ['fail', 'failed'],
    ['inconclusive', 'inconclusive'],
    ['review-required', 'inconclusive'],
  ]) {
    const v = structuredClone(r);
    v.performanceGateStatus = numeric;
    const out = await check(v);
    assert.equal(out.status, status);
    assert.equal(out.readinessCorrectness, 'pass');
    assert.equal(out.numericObservationStatus, numeric);
    assert.equal(out.performanceQualification, 'excluded');
  }
  for (const change of [
    (v) => delete v.selectedFontSettlement,
    (v) => (v.selectedFontSettlement.closed = false),
    (v) => (v.selectedFontSettlement.evidence.calls[0].settlement = 'rejected'),
    (v) => (v.selectedFontSettlementCleanupFailure = 'failed'),
    (v) => delete v.readinessPilot.settlementObservation,
    (v) => (v.replay.nativeVerification.observation.match = false),
    (v) => v.pageErrors.push('error'),
    (v) => (v.environment.contextOwner.cleanup.status = 'unsettled'),
    (v) => (v.actions[0].status = 'failed'),
  ]) {
    const v = structuredClone(r);
    change(v);
    assert.equal((await check(v)).readinessCorrectness, 'fail');
  }
  assert.equal((await check(r, { ...command, forcedCleanup: true })).status, 'failed');
  assert.equal((await check(r, command, { status: 'invalid-evidence' })).status, 'failed');
});

test('actual qualifier metadata forwards V4 settlement policy and leaves historical defaults absent', async () => {
  const s = (await read('scripts/qualify-solo-runtime.mjs')).toString();
  const a = s.indexOf('  report.readinessPilot = {'),
    b = s.indexOf('\n  };', a);
  assert(a > 0 && b > a);
  const emit = new Function(
    'readinessOptions',
    'const report={};' + s.slice(a, b + 5) + 'return report.readinessPilot;',
  );
  assert.equal(
    emit(readiness.SELECTED_FONT_SETTLEMENT_PILOT).settlementObservation,
    'original-demand-v1',
  );
  assert.equal(emit(readiness.SELECTED_FONT_POST_COMMAND_PILOT).settlementObservation, undefined);
});

test('exact V4 source and protocol reuse actual complete binary journal; tampering or missing observation policy fails', async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-font-v4-journal-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const url = 'http://127.0.0.1:4321/game/?journey=opening',
    p = plan(),
    output = join(dir, 'report.json');
  const store = createHitchJournalStore(output, () => 0, { soloURL: url }),
    allocation = store.beginDocument({ url, action: 'initial' });
  let now = 0;
  const j = createBrowserHitchJournal(
    {},
    {
      performance: { now: () => now, timeOrigin: 1700000000000 },
      location: { origin: 'http://127.0.0.1:4321', pathname: '/game/' },
      document: { hidden: false, hasFocus: () => true, addEventListener() {} },
      addEventListener() {},
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    },
  );
  j.configure(allocation);
  j.first(0, 0);
  j.subscribe(0);
  j.phase(2, 0);
  j.frame(0, 40, 2, 2);
  j.beginWork(1, 2);
  j.endWork(55, 2);
  j.phase(3, 60);
  now = 100;
  await store.retain(j.seal('paused'), 'final-existing-public-boundary');
  const r = {
    hitchJournal: store.finish(),
    readinessPilot: {
      protocol: p.protocol.name,
      cancelBoundaryObservation: 'post-command-v3',
      settlementObservation: 'original-demand-v1',
    },
  };
  const checked = await verifyTimingHitchJournal(p, r, output, url);
  assert.equal(checked.status, 'complete', JSON.stringify(checked));
  for (const change of [
    (q) => (q.candidate.tree = '0'.repeat(40)),
    (q) => (q.runtimeRevision = '0'.repeat(40)),
    (q) => (q.fixture.sha256 = '0'.repeat(64)),
    (q) => (q.protocol.name = 'other'),
    (q) => (q.engine = 'chromium'),
  ]) {
    const q = structuredClone(p);
    change(q);
    assert.equal((await verifyTimingHitchJournal(q, r, output, url)).status, 'invalid-evidence');
  }
  const missing = structuredClone(r);
  delete missing.readinessPilot.settlementObservation;
  assert.equal(
    (await verifyTimingHitchJournal(p, missing, output, url)).status,
    'invalid-evidence',
  );
  const descriptor = r.hitchJournal.documents[0];
  assert(descriptor, 'Actual journal document retained');
});
