import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  bindReadinessJob,
  readinessMatrix,
  validateReadinessPlan,
  readinessArguments,
  readinessAssessment,
  readReadinessJSON,
  READINESS_SOURCE,
  READINESS_FIXTURE,
} from './solo-remote-readiness.mjs';
import { assessReadinessPilot } from './solo-qualification-readiness.mjs';
import {
  createBrowserHitchJournal,
  createHitchJournalStore,
} from './solo-qualification-hitch-journal.mjs';
import { verifyTimingHitchJournal } from './solo-remote-sustained.mjs';
const required = [
  'run-solo-remote-correctness.mjs',
  'verify-solo-build.mjs',
  'solo-remote-archive.py',
  'serve-production-preview.mjs',
  'game-cli.mjs',
  'qualify-solo-runtime.mjs',
  'solo-qualification-readiness.mjs',
  'solo-readiness-gpu.mjs',
  'solo-qualification-hitch-journal.mjs',
  'solo-remote-sustained.mjs',
  'solo-qualification-cadence.mjs',
  'solo-qualification-native-replay.mjs',
  'solo-qualification-export.mjs',
  'solo-qualification.mjs',
  'soundtrack-distribution.mjs',
  'optional-distribution.mjs',
  'external-distribution.mjs',
  'optional-artwork.mjs',
];
const ref = (path) => ({ path, bytes: 1, sha256: 'a'.repeat(64) });
function manifest() {
  return {
    format: 'SoloHostedReadinessManifestV1',
    status: 'reviewed-readiness-diagnostic-only',
    sourceCohort: 'readiness-candidateab45',
    phase: 'cold-first30',
    repository: 'mekhovov/revealline',
    node: '22.13.1',
    playwright: '1.62.1',
    engines: ['chromium', 'webkit'],
    candidate: {
      ...READINESS_SOURCE,
      run: 1,
      artifact: 2,
      outer: { bytes: 2, sha256: 'b'.repeat(64) },
      inner: { bytes: 1, sha256: 'c'.repeat(64) },
      manifestSHA256: 'd'.repeat(64),
    },
    runtimeRevision: READINESS_SOURCE.revision,
    baseline: {
      revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
      tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
    },
    cpu: 1,
    maxParallel: 2,
    automaticRetries: 0,
    performanceExclusion: true,
    hitchJournal: 'bounded-v1',
    setupTimeoutMs: 40 * 60000,
    helperTimeoutMs: 75 * 60000,
    rowEvidenceBytes: 32 * 1024 ** 2,
    evidenceBytes: 256 * 1024 ** 2,
    fixture: READINESS_FIXTURE,
    protocol: {
      name: 'first-running-v1',
      startupWait: 'immediate-partial',
      externalCadence: 'settled120',
      observationTimeoutMs: 240000,
      records: 8,
      bytes: 16384,
      numericalGates: 'unchanged-raw',
      performanceQualification: false,
    },
    release: {
      scope: 'independent-native-readiness-pilot',
      readinessPrerequisite: 'diagnosticStatus-passed-and-readinessCorrectness-pass',
      candidateRevision: READINESS_SOURCE.revision,
      firstEightAllCorrectnessPassed: false,
      performanceQualification: 'excluded',
      physicalQualification: 'unobserved',
      automaticRetries: 0,
      priorProofInspected: true,
      noUnclosedOwners: true,
      onceOnlyBefore: 'e'.repeat(40),
    },
    adapterInputs: [ref('scripts/solo-remote-readiness.mjs')],
    frozenTools: required.map((p) => ref('scripts/' + p)),
  };
}
async function temp(t) {
  const p = await realpath(await mkdtemp(join(tmpdir(), 'solo-readiness-adapter-')));
  t.after(() => rm(p, { recursive: true, force: true }));
  return p;
}
test('source-specific pilot binds only two candidate observations, unchanged route and finite owners', () => {
  const m = manifest();
  assert.equal(readinessMatrix(m).include.length, 2);
  for (const engine of m.engines) {
    const p = bindReadinessJob(m, engine);
    assert.equal(p.rows.length, 1);
    assert.equal(p.rows[0].source, 'candidate');
    assert.equal(p.rows[0].timeoutMs, 480000);
    const args = readinessArguments(
      { plan: p, here: '/tools/scripts', repository: '/tools' },
      p.rows[0],
      'http://127.0.0.1:1/game/',
      '/evidence',
    );
    assert(args.includes('--readiness-probe=first-running-v1'));
    assert(args.includes('--cpu=1'));
    assert(args.includes('--cadence=settled120'));
    assert(!args.includes('--baseline-runtime'));
    assert.equal(args.includes('--context=persistent'), engine === 'webkit');
  }
});
test('pilot rejects source, recipe, budget, baseline-payload, repetition and gate widening', () => {
  const p = bindReadinessJob(manifest(), 'chromium');
  for (const mutate of [
    (p) => (p.candidate.revision = 'a'.repeat(40)),
    (p) => (p.candidate.tree = 'a'.repeat(40)),
    (p) => (p.runtimeRevision = 'a'.repeat(40)),
    (p) => (p.phase = 'warm-first30'),
    (p) => (p.fixture = { ...p.fixture, bytes: p.fixture.bytes + 1 }),
    (p) => (p.cpu = 2),
    (p) => p.rows.push({ ...p.rows[0] }),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.protocol.startupWait = 'wait-30'),
    (p) => (p.hitchJournal = undefined),
    (p) => p.rowEvidenceBytes++,
    (p) =>
      (p.frozenTools = p.frozenTools.filter(
        (r) => !r.path.endsWith('soundtrack-distribution.mjs'),
      )),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    assert.throws(() => validateReadinessPlan(q));
  }
  assert.throws(
    () => bindReadinessJob({ ...manifest(), candidate: null }, 'chromium'),
    'No pending artifact is executable',
  );
});
test('actual one-file declaration CLI is standalone and does not materialize native dependencies', async (t) => {
  const dir = await temp(t);
  const file = join(dir, 'solo-remote-readiness.mjs'),
    input = join(dir, 'model-only.json');
  await writeFile(file, await readFile(new URL('./solo-remote-readiness.mjs', import.meta.url)));
  await writeFile(input, JSON.stringify(manifest()));
  const stdout = execFileSync(process.execPath, [file, 'matrix-plan', input], {
    cwd: dir,
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 65536,
  });
  assert.equal(stdout, `matrix=${JSON.stringify(readinessMatrix(manifest()))}\n`);
});
function raw() {
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
    scenarioSHA256: READINESS_FIXTURE.sha256,
    sourceRevision: READINESS_SOURCE.revision,
    buildIdentity: { sourceRevision: READINESS_SOURCE.revision },
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
const command = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] };
test('independent readiness assessment retains failing numeric status instead of promoting it', async () => {
  const p = bindReadinessJob(manifest(), 'chromium'),
    r = raw(),
    j = { status: 'complete' };
  assert.equal((await readinessAssessment(p, p.rows[0], r, command, j)).status, 'passed');
  r.performanceGateStatus = 'fail';
  const result = await readinessAssessment(p, p.rows[0], r, { ...command, exitCode: 2 }, j);
  assert.equal(result.status, 'failed');
  assert.equal(result.readinessCorrectness, 'pass');
  assert.equal(result.diagnosticStatus, 'passed');
  assert.equal(result.numericObservationStatus, 'fail');
  assert.equal(result.rawPerformanceGateStatus, 'fail');
  assert.equal(result.performanceQualification, 'excluded');
  for (const mutate of [
    (r) => (r.readinessDocuments = 2),
    (r) => (r.environment.graphicsCapability.canProceed = false),
    (r) => (r.gpuSetupFailure = 'owned setup failed'),
    (r) => delete r.environment.graphicsCapability,
    (r) => (r.environment.graphicsCapability.engine = 'webkit'),
    (r) => (r.environment.graphicsCapability.sessionDetached = false),
    (r) => (r.environment.graphicsCapability.requestTimedOut = true),
    (r) => (r.readinessObservation.records[1].tick = 1),
    (r) => (r.readinessObservation.records[1].prepared = false),
    (r) => (r.readinessAssessment.status = 'passed-but-forged'),
    (r) => (r.pageErrors = ['']),
    (r) => (r.replay.nativeVerification.observation.match = false),
    (r) => (r.sourceRevision = 'f'.repeat(40)),
  ]) {
    const q = raw();
    mutate(q);
    assert.equal(
      (await readinessAssessment(p, p.rows[0], q, command, j)).readinessCorrectness,
      'fail',
    );
  }
  assert.equal(
    (await readinessAssessment(p, p.rows[0], raw(), command, { status: 'invalid-evidence' }))
      .status,
    'failed',
  );
});
test('bounded report reader rejects aliases, truncation and oversize without following external paths', async (t) => {
  const dir = await temp(t),
    file = join(dir, 'report.json');
  await writeFile(file, '{"ok":true}');
  assert.deepEqual(await readReadinessJSON(file), { ok: true });
  await symlink(file, join(dir, 'alias'));
  await assert.rejects(readReadinessJSON(join(dir, 'alias')));
  await writeFile(file, '{');
  await assert.rejects(readReadinessJSON(file));
  const f = await import('node:fs/promises').then((m) => m.open(file, 'w'));
  await f.truncate(16 * 1024 ** 2 + 1);
  await f.close();
  await assert.rejects(readReadinessJSON(file));
});
test('existing strict journal reader admits only exact readiness source and cold document, with real binary coverage', async (t) => {
  const dir = await temp(t),
    output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const p = bindReadinessJob(manifest(), 'chromium');
  const store = createHitchJournalStore(output, () => 0, { soloURL: url });
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
  const r = { hitchJournal: store.finish() };
  assert.equal((await verifyTimingHitchJournal(p, r, output, url)).status, 'complete');
  for (const mutate of [
    (p) => (p.sourceCohort = 'unreviewed'),
    (p) => (p.phase = 'long29'),
    (p) => (p.candidate.tree = 'a'.repeat(40)),
    (p) => (p.candidate.revision = 'a'.repeat(40)),
    (p) => (p.fixture = { ...p.fixture, sha256: 'a'.repeat(64) }),
    (p) => (p.performanceExclusion = false),
    (p) => (p.hitchJournal = undefined),
  ]) {
    const q = structuredClone(p);
    mutate(q);
    assert.equal((await verifyTimingHitchJournal(q, r, output, url)).status, 'invalid-evidence');
  }
});

// Prospective contract controls use synthetic package metadata; they are never
// executable release declarations or native observations.
const resumeModule = await import('./solo-qualification-readiness.mjs');
const resumeAdapter = await import('./solo-remote-readiness.mjs');
function resumeManifest(phase) {
  const m = manifest();
  m.sourceCohort = 'readiness-resume-candidate4bf';
  m.phase = phase;
  Object.assign(m.candidate, resumeAdapter.RESUME_READINESS_SOURCE);
  m.runtimeRevision = m.candidate.revision;
  m.release.candidateRevision = m.candidate.revision;
  m.fixture = resumeAdapter.RESUME_READINESS_FIXTURES[phase];
  m.protocol.name = phase + '-v1';
  m.frozenTools.push(ref('scripts/solo-qualification-replay-identity.mjs'));
  return m;
}
function resumeRaw(phase) {
  const r = raw(),
    saved = phase === 'saved-resume',
    protocol = phase + '-v1',
    source = resumeAdapter.RESUME_READINESS_SOURCE.revision;
  const base = r.readinessObservation.records[1];
  const start = { ...base, kind: 'start-click', atMs: 1, phase: 'briefing', trusted: true };
  const active = { ...base, atMs: 100 };
  const paused = { ...base, kind: 'after-running', atMs: 1100, phase: 'paused', tick: 120 };
  const click = {
    ...base,
    kind: 'start-click',
    atMs: 1500,
    phase: 'paused',
    tick: 120,
    trusted: true,
    run: saved ? 9 : 2,
  };
  const resumed = {
    ...click,
    kind: saved ? 'first-running' : 'resumed-running',
    atMs: 2000,
    phase: 'running',
    trusted: null,
  };
  const final = { ...resumed, kind: 'after-running', atMs: 2400, phase: 'paused', tick: 168 };
  const obs = (records) => ({ ...r.readinessObservation, protocol, records });
  const observations = saved
    ? [obs([start, active, paused]), obs([click, resumed, final])]
    : [obs([start, active, paused, click, resumed, final])];
  const text = (ticks) =>
    JSON.stringify({
      replay: {
        ticks,
        level: { id: 'first-return' },
        checkpoint: { hash: String(ticks) },
        segments: [
          {
            ticks,
            input: {
              direction: 'left',
              boost: false,
              action: false,
              pickup: false,
              switchClass: null,
            },
          },
        ],
      },
    });
  const replay = resumeModule.createResumeReplayEvidence(protocol);
  replay.observe('before-resume', text(120));
  if (saved) replay.observe('saved-restored', text(120));
  replay.observe('after-resume', text(168));
  replay.finish();
  const app = r.snapshots[0].application;
  r.snapshots = (
    saved
      ? ['before-resume', 'saved-restored-before-resume', 'after-resume']
      : ['before-resume', 'after-resume']
  ).map((group) => ({ group, application: structuredClone(app) }));
  Object.assign(r, {
    scenarioKind: 'lifecycle',
    scenarioSHA256: resumeAdapter.RESUME_READINESS_FIXTURES[phase].sha256,
    sourceRevision: source,
    buildIdentity: { sourceRevision: source },
    readinessPilot: { protocol, performanceQualification: false },
    readinessDocuments: saved ? 2 : 1,
    readinessObservations: observations,
    readinessReplayEvidence: replay.report,
    startupCadenceObservations: Array(saved ? 2 : 1).fill({
      pilotStartupWait: 'omitted; immediate partial samples retained',
    }),
  });
  r.readinessAssessment = resumeModule.assessResumeReadiness({
    protocol,
    documents: r.readinessDocuments,
    observations,
    applications: r.snapshots.map((s) => s.application),
    replayEvidence: replay.report,
    finalReplayText: text(168),
  });
  return { raw: r, text: text(168) };
}
test('new warm and saved Resume admission remains one source-specific candidate per engine with no pending package execution', () => {
  for (const phase of ['warm-resume', 'saved-resume']) {
    const m = resumeManifest(phase);
    assert.equal(readinessMatrix(m).include.length, 2);
    for (const engine of m.engines) {
      const p = bindReadinessJob(m, engine);
      assert.equal(p.rows.length, 1);
      assert.equal(p.rows[0].id, `readiness-${phase}-${engine}`);
      const args = readinessArguments(
        { plan: p, here: '/tools/scripts', repository: '/tools' },
        p.rows[0],
        'http://127.0.0.1:1/game/',
        '/evidence',
      );
      assert(args.includes('--readiness-probe=' + phase + '-v1'));
      assert(args.includes('--source-revision=' + m.candidate.revision));
      assert(args.includes('--cpu=1'));
      assert(args.includes('--cadence=settled120'));
    }
    for (const mutate of [
      (q) => (q.sourceCohort = 'readiness-candidateab45'),
      (q) => (q.phase = 'cold-first30'),
      (q) => (q.candidate.tree = 'a'.repeat(40)),
      (q) => (q.protocol.name = 'first-running-v1'),
      (q) =>
        (q.frozenTools = q.frozenTools.filter(
          (r) => !r.path.endsWith('solo-qualification-replay-identity.mjs'),
        )),
      (q) => (q.candidate = null),
    ]) {
      const q = structuredClone(m);
      mutate(q);
      assert.throws(() => bindReadinessJob(q, 'chromium'));
    }
  }
});
test('short Resume correctness is independent of preserved numerical failure and requires final native replay/GPU/journal', async () => {
  for (const phase of ['warm-resume', 'saved-resume']) {
    const p = bindReadinessJob(resumeManifest(phase), 'chromium'),
      { raw: r, text } = resumeRaw(phase),
      j = { status: 'complete' };
    assert.equal(r.readinessAssessment.status, 'passed', JSON.stringify(r.readinessAssessment));
    r.performanceGateStatus = 'fail';
    const result = await readinessAssessment(p, p.rows[0], r, { ...command, exitCode: 2 }, j, text);
    assert.equal(result.status, 'failed');
    assert.equal(result.diagnosticStatus, 'passed');
    assert.equal(result.rawPerformanceGateStatus, 'fail');
    assert.equal(result.readinessCorrectness, 'pass');
    for (const mutate of [
      (q) => (q.replay.nativeVerification.status = 'fail'),
      (q) => (q.environment.graphicsCapability.canProceed = false),
      (q) => (q.readinessDocuments = 9),
      (q) => (q.readinessObservations[0].dropped = 1),
      (q) => q.readinessReplayEvidence.receipts[0].ticks++,
    ]) {
      const q = structuredClone(r);
      mutate(q);
      assert.equal(
        (await readinessAssessment(p, p.rows[0], q, command, j, text)).readinessCorrectness,
        'fail',
      );
    }
    assert.equal(
      (await readinessAssessment(p, p.rows[0], r, command, j, null)).readinessCorrectness,
      'fail',
    );
  }
});
test('saved Resume strict binary journal reader requires both positive-active documents and exact reload ownership', async (t) => {
  const dir = await temp(t),
    output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const p = bindReadinessJob(resumeManifest('saved-resume'), 'chromium');
  const store = createHitchJournalStore(output, () => 0, { soloURL: url });
  for (let i = 0; i < 2; i++) {
    const allocation = store.beginDocument({ url, action: i ? 'reload-7' : 'initial' });
    let now = 0;
    const j = createBrowserHitchJournal(
      {},
      {
        performance: { now: () => now, timeOrigin: 1700000000000 + i * 1000 },
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
    await store.retain(j.seal('paused'), i ? 'final-existing-public-boundary' : 'before-reload-7');
  }
  const r = { hitchJournal: store.finish() };
  assert.equal((await verifyTimingHitchJournal(p, r, output, url)).status, 'complete');
  for (const mutate of [
    (q) => (q.hitchJournal.documents[0].header.runningSeen = false),
    (q) => (q.hitchJournal.documents[0].header.activeFrames = 0),
    (q) => (q.hitchJournal.documents[0].boundary = 'before-reload-8'),
    (q) => (q.hitchJournal.documents[1].identity.action = 'reload-8'),
    (q) => q.hitchJournal.documents.pop(),
  ]) {
    const q = structuredClone(r);
    mutate(q);
    assert.equal((await verifyTimingHitchJournal(p, q, output, url)).status, 'invalid-evidence');
  }
});

test('both new Resume matrix declarations run from the actual isolated one-file CLI', async (t) => {
  const dir = await temp(t),
    file = join(dir, 'solo-remote-readiness.mjs');
  await writeFile(file, await readFile(new URL('./solo-remote-readiness.mjs', import.meta.url)));
  for (const phase of ['warm-resume', 'saved-resume']) {
    const input = join(dir, phase + '.json'),
      m = resumeManifest(phase);
    await writeFile(input, JSON.stringify(m));
    assert.equal(
      execFileSync(process.execPath, [file, 'matrix-plan', input], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 16384,
      }),
      `matrix=${JSON.stringify(readinessMatrix(m))}\n`,
    );
    m.candidate = null;
    await writeFile(input, JSON.stringify(m));
    assert.throws(() =>
      execFileSync(process.execPath, [file, 'matrix-plan', input], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 16384,
        stdio: 'pipe',
      }),
    );
  }
});
