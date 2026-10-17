import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  bindReadinessJob,
  readinessMatrix,
  validateReadinessPlan,
  readinessArguments,
  readinessAssessment,
} from './solo-remote-readiness.mjs';
import {
  assessReadinessPilot,
  assessReadinessMediaFault,
  createOptionalStartAudio404,
} from './solo-qualification-readiness.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import { verifyTimingHitchJournal } from './solo-remote-sustained.mjs';
const root = new URL('../', import.meta.url),
  path = 'docs/performance/solo-optional-start-audio-e1cc-plan.json',
  workflowPath = '.github/workflows/solo-remote-optional-start-audio-e1cc-temporary.yml',
  manifest = JSON.parse(await readFile(new URL(path, root))),
  workflow = await readFile(new URL(workflowPath, root), 'utf8'),
  protocol = 'optional-audio-start-missing-v1',
  hash = (b) => createHash('sha256').update(b).digest('hex');
const command = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] };
async function temp(t) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-optional-audio-release-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
function evidence() {
  const cadence = {
    samples: 30,
    required: 30,
    baselineMs: 16,
    status: 'measured-before-play',
    waiting: false,
  };
  const application = {
    audio: { muted: false, volume: 0.8, revision: 1 },
    baselineMs: 16,
    cadenceCalibration: cadence,
    resources: {
      pcm: { effects: { loading: 0 } },
      media: {
        queued: 0,
        active: { fetch: 0, decode: 0, inspect: 0, main: 0 },
        reservedDecodeBytes: 0,
      },
    },
  };
  return {
    application,
    audioCheck: {
      master: { ...application.audio },
      requirement: { unmuted: true, nativeStartsAtLeast: 1 },
      observed: {
        sourceStarts: 1,
        oscillatorStarts: 0,
        sourceStartFailures: 0,
        mediaPlayRequests: 0,
        mediaPlayResolved: 0,
        mediaPlayRejected: 0,
      },
    },
    observation: {
      format: 'SoloFirstRunningReadinessV1',
      protocol,
      capacity: 8,
      maximumBytes: 16384,
      dropped: 0,
      errors: 0,
      records: [
        {
          kind: 'start-click',
          trusted: true,
          atMs: 10,
          phase: 'briefing',
          visible: true,
          focused: true,
        },
        {
          kind: 'first-running',
          actorStyle: 'campaign',
          atMs: 20,
          phase: 'running',
          visible: true,
          focused: true,
          tick: 0,
          levelId: 'first-return',
          run: 1,
          prepared: true,
          displayedBoardValid: true,
          preparedRunMatches: true,
          submittedRunMatches: true,
          cadence,
        },
        {
          kind: 'after-running',
          actorStyle: 'campaign',
          atMs: 1300,
          phase: 'paused',
          visible: true,
          focused: true,
          tick: 144,
          run: 1,
        },
      ],
    },
    protocol,
    documents: 1,
  };
}
function baseRaw() {
  const cadence = {
      samples: 30,
      required: 30,
      baselineMs: 16.67,
      restartedSamples: 9,
      waiting: false,
      status: 'measured-before-play',
    },
    application = { baselineMs: 16.67, cadenceCalibration: cadence };
  const observation = {
    format: 'SoloFirstRunningReadinessV1',
    protocol: 'first-running-v1',
    capacity: 8,
    maximumBytes: 16384,
    dropped: 0,
    errors: 0,
    records: [
      {
        kind: 'start-click',
        atMs: 1,
        trusted: true,
        cadence: { ...cadence, samples: 9, status: 'pending-quiet-preparation' },
      },
      {
        kind: 'first-running',
        atMs: 2,
        phase: 'running',
        visible: true,
        focused: true,
        tick: 0,
        levelId: 'first-return',
        run: 2,
        prepared: true,
        displayedBoardValid: true,
        preparedRunMatches: true,
        submittedRunMatches: true,
        cadence,
      },
    ],
  };
  return {
    format: 'SoloQualificationReportV1',
    kind: 'readiness-diagnostic',
    scenarioKind: 'performance',
    scenarioStatus: 'pass',
    scenarioSHA256: manifest.fixture.sha256,
    sourceRevision: manifest.candidate.revision,
    buildIdentity: { sourceRevision: manifest.candidate.revision },
    environment: {
      engine: 'chromium',
      browserVersion: '123.0',
      cpuThrottle: 1,
      contextMode: 'ephemeral',
      graphicsCapability: {
        format: 'SoloReadinessGpuCapabilityV1',
        engine: 'chromium',
        canProceed: true,
        requestBudgetMs: 5000,
        cleanupBudgetMs: 2000,
        maximumBytes: 16384,
        status: 'response-observed',
        requestSettled: true,
        sessionDetached: true,
      },
    },
    workProbe: true,
    cadenceProtocol: 'settled120',
    cacheMode: 'fresh-context',
    baselineRuntime: false,
    readinessPilot: { protocol: 'first-running-v1', performanceQualification: false },
    readinessDocuments: 1,
    readinessObservation: observation,
    readinessAssessment: assessReadinessPilot(observation, application, 1),
    startupCadenceObservations: [
      { pilotStartupWait: 'omitted; immediate partial samples retained' },
    ],
    snapshots: [{ application }],
    performanceGateStatus: 'pass-observed-window',
    pageErrors: [],
    replay: {
      scope: 'completed-scenario',
      nativeVerification: {
        status: 'pass',
        engine: 'chromium',
        browserVersion: '123.0',
        observation: { match: true },
      },
    },
    actions: [{ status: 'pass' }],
  };
}

async function fullRaw() {
  const p = bindReadinessJob(manifest, 'chromium'),
    r = baseRaw(),
    e = evidence();
  const body = await readFile(new URL('../game/audio/effects/start.wav', import.meta.url));
  const entry = 'https://fixture.invalid/game/';
  const owner = createOptionalStartAudio404(entry);
  const url = new URL('audio/effects/start.wav', entry).href;
  await owner.handle({
    request: () => ({
      url: () => url,
      method: () => 'GET',
      resourceType: () => 'fetch',
      headers: () => ({}),
    }),
    fetch: async () => ({
      url: () => url,
      status: () => 200,
      headers: () => ({ 'content-type': 'audio/wav', 'content-length': String(body.length) }),
      body: async () => body,
      dispose: async () => {},
    }),
    fulfill: async (args) => {
      assert.equal(args.status, 404);
    },
    abort: async () => {},
  });
  await owner.close();
  const transport = owner.snapshot();
  Object.assign(r, {
    scenarioKind: 'lifecycle',
    readinessPilot: { protocol, performanceQualification: false },
    readinessObservation: e.observation,
    snapshots: [{ application: e.application }],
    audioCheck: e.audioCheck,
    mediaFaultTransport: transport,
  });
  r.readinessAssessment = assessReadinessMediaFault({ ...e, transport });
  assert.equal(r.readinessAssessment.status, 'passed', JSON.stringify(r.readinessAssessment));
  const fixture = JSON.parse(await readFile(new URL(manifest.fixture.path, root)));
  r.actions = fixture.actions.map((a, i) => ({
    path: String(i),
    type: a.type,
    label: a.label ?? null,
    status: 'pass',
  }));
  return { p, r };
}

// These manifests were dispatched at239. Their exact source is independently Git-derived.
const historicalBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-optional-start-audio/239-execution-source.json',
    import.meta.url,
  ),
);
function executed239(bytes, declaration, workflowBytes) {
  assert.equal(hash(bytes), '842dbb4a020b5df5ae02b0ff9ca7aa6e751f86aae60e85c3ed091d5b79452ba0');
  const proof = JSON.parse(bytes);
  assert.equal(proof.head, '239c574ecddd5bb6d5896e621d9edc53e7f6a313');
  assert.equal(proof.tree, '1ac7f17971498d2a8be19085f00a9f732db42798');
  for (const [path, input] of [
    ['docs/performance/solo-optional-start-audio-e1cc-plan.json', declaration],
    ['.github/workflows/solo-remote-optional-start-audio-e1cc-temporary.yml', workflowBytes],
  ]) {
    const record = proof.records.find((r) => r.path === path);
    assert(record, path);
    assert.equal(input.length, record.bytes, path);
    assert.equal(hash(input), record.sha256, path);
  }
  return proof;
}
const executionDeclaration239 = await readFile(new URL(path, root));
const execution239 = executed239(historicalBytes, executionDeclaration239, Buffer.from(workflow));
test('immutable239 source rejects altered witness, declaration and workflow', () => {
  const raw = Buffer.from(historicalBytes);
  raw[0] ^= 1;
  assert.throws(() =>
    executed239(raw, Buffer.from(JSON.stringify(manifest)), Buffer.from(workflow)),
  );
  assert.throws(() => executed239(historicalBytes, Buffer.from('{}'), Buffer.from(workflow)));
  assert.throws(() =>
    executed239(historicalBytes, executionDeclaration239, Buffer.from(workflow + ' ')),
  );
});
test('one actual e1cc Chromium row preserves public route, setup/owner bounds and excludes performance', async () => {
  assert.deepEqual(readinessMatrix(manifest), {
    include: [{ engine: 'chromium', jobMinutes: 130, stepMinutes: 78, outerSeconds: 4620 }],
  });
  const p = bindReadinessJob(manifest, 'chromium');
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].source, 'candidate');
  assert.equal(p.rows[0].timeoutMs, 480000);
  assert.equal(
    p.fixture.sha256,
    '05ce2d60b858eff3f1ee67d23c17c815efe1a0c7f3da196c89b98b931139d096',
  );
  assert.equal(p.candidate.artifact, 12104590541);
  assert.equal(p.release.firstEightRequired, false);
  const args = readinessArguments(
    { plan: p, here: '/tools/scripts', repository: '/tools' },
    p.rows[0],
    'http://127.0.0.1:4321/game/',
    '/evidence',
  );
  for (const flag of [
    '--readiness-probe=' + protocol,
    '--cpu=1',
    '--cadence=settled120',
    '--hitch-journal',
    '--work-probe',
  ])
    assert(args.includes(flag), flag);
  for (const flag of ['--baseline-runtime', '--audio-proof', '--context=persistent'])
    assert(!args.includes(flag));
  assert.throws(() => bindReadinessJob(manifest, 'webkit'));
  const previous = JSON.parse(
    await readFile(new URL('docs/performance/solo-readiness-preparation-e1cc-v2-plan.json', root)),
  );
  assert.equal(readinessMatrix(previous).include.length, 2);
  assert.equal(bindReadinessJob(previous, 'chromium').rows.length, 6);
  for (const change of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.run++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => (p.candidate.revision = '0'.repeat(40)),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => (p.phase = 'optional-icon-missing'),
    (p) => p.fixture.bytes++,
    (p) => (p.protocol.name = 'optional-icon-missing-v1'),
    (p) => p.rows.push(p.rows[0]),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.cpu = 2),
    (p) => p.automaticRetries++,
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.release.firstEightRequired = true),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => (p.performanceExclusion = false),
    (p) => p.rowEvidenceBytes++,
    (p) => p.helperTimeoutMs++,
    (p) => (p.release.onceOnlyBefore = '0'.repeat(40)),
  ]) {
    const q = structuredClone(p);
    change(q);
    assert.throws(() => validateReadinessPlan(q));
  }
});
test('independent audio request/settlement, native replay and raw numerical failures remain separate', async () => {
  const { p, r } = await fullRaw();
  const pass = await readinessAssessment(p, p.rows[0], r, command, { status: 'complete' });
  assert.equal(pass.status, 'passed', pass.readinessFailure);
  assert.equal(pass.firstEightRequired, false);
  const numeric = structuredClone(r);
  numeric.performanceGateStatus = 'fail';
  const failed = await readinessAssessment(
    p,
    p.rows[0],
    numeric,
    { ...command, exitCode: 2 },
    { status: 'complete' },
  );
  assert.equal(failed.status, 'failed');
  assert.equal(failed.readinessCorrectness, 'pass');
  assert.equal(failed.numericObservationStatus, 'fail');
  assert.equal(failed.performanceQualification, 'excluded');
  for (const mutate of [
    (r) => delete r.audioCheck,
    (r) => (r.audioCheck.observed.sourceStarts = 0),
    (r) => (r.audioCheck.master.muted = true),
    (r) => (r.mediaFaultTransport.injected404 = false),
    (r) => (r.mediaFaultTransport.claimed = 0),
    (r) => (r.mediaFaultTransport.responseDisposed = false),
    (r) => (r.snapshots[0].application.resources.media.active.decode = 1),
    (r) => (r.mediaFaultCleanupFailure = 'late failure'),
    (r) => (r.readinessObservation.records[2].tick = 119),
    (r) => (r.replay.nativeVerification.observation.match = false),
    (r) => (r.replay.scope = 'failure-cleanup'),
    (r) => r.actions.pop(),
    (r) => r.pageErrors.push(''),
    (r) => (r.environment.graphicsCapability.canProceed = false),
  ]) {
    const q = structuredClone(r);
    mutate(q);
    assert.equal(
      (await readinessAssessment(p, p.rows[0], q, command, { status: 'complete' }))
        .readinessCorrectness,
      'fail',
    );
  }
  assert.equal(
    (
      await readinessAssessment(
        p,
        p.rows[0],
        r,
        { ...command, forcedCleanup: true },
        { status: 'complete' },
      )
    ).status,
    'failed',
  );
  assert.equal(
    (await readinessAssessment(p, p.rows[0], r, command, { status: 'invalid-evidence' })).status,
    'failed',
  );
});
test('actual one-module CLI binds exactly one row without loading native dependencies', async (t) => {
  const dir = await temp(t),
    file = join(dir, 'adapter.mjs'),
    input = join(dir, 'manifest.json');
  await writeFile(file, await readFile(new URL('./solo-remote-readiness.mjs', import.meta.url)));
  await writeFile(input, JSON.stringify(manifest));
  const out = execFileSync(process.execPath, [file, 'matrix-plan', input], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 65536,
  });
  assert.equal(out, `matrix=${JSON.stringify(readinessMatrix(manifest))}\n`);
});
test('real binary journal verifies the new exact source/fixture and rejects incomplete or altered evidence', async (t) => {
  const dir = await temp(t),
    output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const p = bindReadinessJob(manifest, 'chromium'),
    store = createHitchJournalStore(output, () => 0, { soloURL: url });
  const allocation = store.beginDocument({ url, action: 'initial' });
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
  const raw = { hitchJournal: store.finish(), readinessPilot: { protocol } };
  assert.equal((await verifyTimingHitchJournal(p, raw, output, url)).status, 'complete');
  for (const change of [
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => (p.engine = 'webkit'),
    (p) => (p.fixture.sha256 = '0'.repeat(64)),
    (p) => (p.protocol.name = 'wrong'),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
  ]) {
    const q = structuredClone(p);
    change(q);
    assert.equal((await verifyTimingHitchJournal(q, raw, output, url)).status, 'invalid-evidence');
  }
  const missing = structuredClone(raw);
  missing.hitchJournal.documents = [];
  assert.equal(
    (await verifyTimingHitchJournal(p, missing, output, url)).status,
    'invalid-evidence',
  );
});
test('one-shot workflow and all executed239 frozen refs retain exact source admission and bounded sparse closure', async () => {
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(manifest.releaseTrigger.onceOnlyBefore, '7c7cc2648331870683ac7b76850bbeff859f802e');
  const terms = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
  ];
  function guard(text) {
    assert(text.includes('    if: ' + terms.join(' && ') + '\n'));
    assert(!text.includes('workflow_dispatch') && !text.includes('if: ${{ false }}'));
  }
  guard(workflow);
  for (const term of terms) assert.throws(() => guard(workflow.replace(term, 'true')));
  assert(workflow.includes('engine: [chromium]'));
  assert(!workflow.includes('engine: [chromium, webkit]'));
  assert(workflow.includes('timeout-minutes: 130'));
  assert(workflow.includes('timeout --signal=TERM --kill-after=30s 4620s'));
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [...manifest.adapterInputs, ...manifest.frozenTools, manifest.fixture]) {
    const record = execution239.records.find((r) => r.path === ref.path);
    assert(record, ref.path);
    assert.equal(record.bytes, ref.bytes, ref.path);
    assert.equal(record.sha256, ref.sha256, ref.path);
    assert(sparse.includes(ref.path), ref.path);
  }
  for (const p of [
    path,
    workflowPath,
    'scripts/test-solo-optional-start-audio-release.mjs',
    'scripts/test-solo-source-verifier-smoke.mjs',
    'game/audio/effects/start.wav',
  ])
    assert(sparse.includes(p), p);
});
