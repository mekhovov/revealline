// Pure collector/transport/source controls, not native-browser observations.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import {
  SELECTED_FONT_PILOT,
  COMPACT_SAVED_READINESS_PILOT,
  qualificationReadinessOptions,
  createBrowserReadinessProbe,
  assertSelectedFontCancelled,
  assessSelectedFontReadiness,
  selectedFont,
} from './solo-qualification-readiness.mjs';
import {
  FONT_COMPACT_COHORT,
  FONT_COMPACT_PROTOCOL,
  SELECTED_FONT_SOURCE,
  SELECTED_FONT_FIXTURE,
  COMPACT_READINESS_FIXTURES,
  fontCompactRows,
  bindReadinessJob,
  readinessMatrix,
  readinessArguments,
  readinessRowPlan,
  validateReadinessPlan,
} from './solo-remote-readiness.mjs';
import { validateQualification } from './solo-qualification.mjs';
const clone = (x) => JSON.parse(JSON.stringify(x));
const read = (path) => readFile(new URL('../' + path, import.meta.url));
function model(serialized = false) {
  let at = 0,
    pending = true,
    preparation = 'idle',
    accepted = 'industrial',
    open = 0,
    selected = true;
  const callbacks = new Map(),
    windows = new Map(),
    microtasks = [];
  const run = { tick: 0, level: { id: 'first-return' } },
    cadence = {
      samples: 30,
      required: 30,
      baselineMs: 1000 / 90,
      restartedSamples: 0,
      waiting: false,
      status: 'measured-before-play',
    };
  const scene = {
    lastPaint: { run },
    prepared: () => true,
    displayedBoardValid: true,
    preparedState: { run },
    submittedRun: run,
    cadence: { snapshot: () => ({ ...cadence }) },
  };
  const document = {
    body: { dataset: { flightState: 'briefing' } },
    documentElement: { dataset: {} },
    hidden: false,
    hasFocus: () => true,
    querySelectorAll: () => Array(open),
    getElementById: (id) =>
      id === 'flight-preparation-status'
        ? { dataset: { state: preparation } }
        : id === 'theme-card-dnipro-porcelain'
          ? { getAttribute: () => (selected ? 'true' : 'false') }
          : null,
    fonts: { check: () => !pending },
    addEventListener: (name, fn) => callbacks.set(name, fn),
    removeEventListener: (name, fn) => {
      if (callbacks.get(name) === fn) callbacks.delete(name);
    },
  };
  Object.defineProperty(document.documentElement.dataset, 'interfaceTheme', {
    get: () => accepted,
  });
  const env = {
    document,
    performance: { now: () => at },
    queueMicrotask: (fn) => microtasks.push(fn),
    addEventListener: (name, fn) => windows.set(name, fn),
    removeEventListener: (name, fn) => {
      if (windows.get(name) === fn) windows.delete(name);
    },
  };
  const make = serialized
    ? runInNewContext('(' + createBrowserReadinessProbe.toString() + ')', { TextEncoder })
    : createBrowserReadinessProbe;
  const probe = make(() => scene, env, 'selected-font-cancel-v1');
  function click() {
    at += 10;
    callbacks.get('click')({ isTrusted: true, target: { closest: () => ({}) } });
  }
  click();
  preparation = 'busy';
  at += 10;
  const event = { isTrusted: true, code: 'Escape', repeat: false, defaultPrevented: false };
  callbacks.get('keydown')(event);
  // Models the actual public target handler between capture and microtask.
  preparation = 'cancelled';
  event.defaultPrevented = true;
  while (microtasks.length) microtasks.shift()();
  const cancelled = clone(probe.export());
  assertSelectedFontCancelled(cancelled);
  at += 500;
  pending = false;
  accepted = 'dnipro-porcelain';
  probe.boundary('font-release-no-start');
  click();
  document.body.dataset.flightState = 'running';
  at += 10;
  probe.phase('running');
  run.tick = 144;
  at += 1200;
  document.body.dataset.flightState = 'paused';
  probe.phase('paused');
  const transport = {
    format: 'SoloSelectedFontHoldV1',
    status: 'complete',
    claimed: 1,
    released: true,
    done: true,
    closed: true,
    responseDisposed: true,
    ownedResponseCount: 0,
    pendingOperations: [],
    timedOutOperations: [],
    failure: null,
    dropped: 0,
    expected: selectedFont,
    actualBytes: selectedFont.bytes,
    actualSHA256: selectedFont.sha256,
    records: [
      'request-matched',
      'original-response-validated',
      'declared-public-cancel-boundary',
      'original-response-forwarded',
      'response-disposed',
    ].map((kind, i) => ({ kind, atMs: i })),
  };
  return {
    observation: clone(probe.export()),
    app: { baselineMs: cadence.baselineMs, cadenceCalibration: { ...cadence } },
    cancelled,
    transport,
    probe,
    callbacks,
    windows,
    scene,
    env,
    setOpen: (n) => {
      open = n;
    },
    setSelected: (v) => {
      selected = v;
    },
  };
}
test('actual serialized scalar collector proves public cancellation, original release, explicit Start and submitted run', () => {
  for (const serialized of [false, true]) {
    const m = model(serialized);
    assert.equal(m.observation.records.length, 7);
    assert.equal(
      assessSelectedFontReadiness(m.observation, m.app, 1, m.transport).status,
      'passed',
    );
    m.probe.dispose();
    assert.equal(m.callbacks.size, 0);
    assert.equal(m.windows.size, 0);
  }
});
test('stale/open/untrusted/missing/capped/late-tick observations and transport uncertainty cannot pass', () => {
  const original = model();
  for (const mutate of [
    (m) => (m.observation.records[1].font.openDialogs = 1),
    (m) => (m.observation.records[2].font.preparation = 'busy'),
    (m) => (m.observation.records[2].font.defaultPrevented = false),
    (m) => (m.observation.records[1].trusted = false),
    (m) => (m.observation.records[1].font.loaded = true),
    (m) => (m.observation.records[3].phase = 'running'),
    (m) => m.observation.records[4].run++,
    (m) => (m.observation.records[5].tick = 1),
    (m) => (m.observation.records[5].preparedRunMatches = false),
    (m) => (m.observation.records[5].submittedRunMatches = false),
    (m) => (m.observation.records[5].cadence.samples = 29),
    (m) => (m.observation.records[5].font.loaded = false),
    (m) => (m.observation.dropped = 1),
    (m) => m.observation.records.splice(1, 1),
    (m) => (m.transport.pendingOperations = ['response-body']),
    (m) => (m.transport.timedOutOperations = ['response-body']),
    (m) => (m.transport.actualSHA256 = '0'.repeat(64)),
    (m) => (m.transport.closed = false),
    (m) => (m.transport.ownedResponseCount = 1),
    (m) => m.transport.records.pop(),
  ]) {
    const m = clone(original);
    mutate(m);
    assert.equal(
      assessSelectedFontReadiness(m.observation, m.app, 1, m.transport).status,
      'failed',
    );
  }
  assert.equal(
    assessSelectedFontReadiness(original.observation, original.app, 2, original.transport).status,
    'failed',
  );
});
function manifest() {
  const m = JSON.parse(requirePlan);
  m.sourceCohort = FONT_COMPACT_COHORT;
  m.phase = 'selected-font-saved-and-muted-effects';
  m.candidate = {
    ...SELECTED_FONT_SOURCE,
    run: 1,
    artifact: 2,
    outer: { bytes: 2, sha256: 'a'.repeat(64) },
    inner: { bytes: 1, sha256: 'b'.repeat(64) },
    manifestSHA256: 'c'.repeat(64),
  };
  m.runtimeRevision = SELECTED_FONT_SOURCE.revision;
  m.fixture = SELECTED_FONT_FIXTURE;
  m.additionalFixtures = [
    COMPACT_READINESS_FIXTURES.saved,
    COMPACT_READINESS_FIXTURES.full,
    COMPACT_READINESS_FIXTURES.reduced,
  ];
  m.protocol = FONT_COMPACT_PROTOCOL;
  m.release.candidateRevision = SELECTED_FONT_SOURCE.revision;
  m.release.onceOnlyBefore = SELECTED_FONT_SOURCE.revision;
  return m;
}
const requirePlan = (await read('docs/performance/solo-readiness-4bf-plan.json')).toString();
test('new source admits exactly seven excluded rows and exact compact public recipe deltas, preserving old source', async () => {
  const m = manifest();
  assert.deepEqual(
    readinessMatrix(m).include.map((r) => r.jobMinutes),
    [130, 130],
  );
  for (const engine of m.engines) {
    const p = bindReadinessJob(m, engine);
    assert.equal(p.rows.length, engine === 'webkit' ? 6 : 1);
    assert.deepEqual(p.rows, fontCompactRows(engine));
    for (const row of p.rows) {
      const r = readinessRowPlan(p, row),
        args = readinessArguments(
          { plan: p, here: '/tools/scripts', repository: '/tools' },
          row,
          'http://localhost/game/',
          '/out',
        );
      assert(args.includes('--source-revision=' + SELECTED_FONT_SOURCE.revision));
      const bytes = await read(r.fixture.path),
        scenario = JSON.parse(bytes);
      validateQualification(scenario);
      assert.equal(bytes.length, r.fixture.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), r.fixture.sha256);
      if (row.kind === 'readiness') {
        const option = qualificationReadinessOptions(args.slice(4), scenario, bytes);
        assert.equal(option.protocol, row.phase + '-v1');
      }
      assert.equal(row.timeoutMs, 480000);
    }
  }
  const old = JSON.parse(requirePlan);
  assert.equal(bindReadinessJob(old, 'chromium').rows.length, 2);
  assert.equal(bindReadinessJob(old, 'webkit').rows.length, 6);
});
test('source/recipe mismatch, repeat, altered limits and undeclared warm route fail closed', async () => {
  for (const mutate of [
    (m) => (m.candidate.revision = 'a'.repeat(40)),
    (m) => (m.candidate.tree = 'a'.repeat(40)),
    (m) => (m.runtimeRevision = 'a'.repeat(40)),
    (m) => (m.cpu = 2),
    (m) => (m.automaticRetries = 1),
    (m) => (m.additionalFixtures[0].sha256 = 'a'.repeat(64)),
    (m) => (m.protocol.readiness = ['warm-resume-v1']),
    (m) => m.fixture.bytes++,
  ]) {
    const m = clone(manifest());
    mutate(m);
    assert.throws(() => bindReadinessJob(m, 'webkit'));
  }
  const p = bindReadinessJob(manifest(), 'webkit');
  p.rows.push(clone(p.rows[0]));
  assert.throws(() => validateReadinessPlan(p));
  const bytes = await read(SELECTED_FONT_FIXTURE.path),
    scenario = JSON.parse(bytes),
    args = readinessArguments(
      {
        plan: readinessRowPlan(
          bindReadinessJob(manifest(), 'chromium'),
          fontCompactRows('chromium')[0],
        ),
        here: '/tools/scripts',
        repository: '/tools',
      },
      fontCompactRows('chromium')[0],
      'http://localhost/game/',
      '/out',
    ).slice(4);
  for (const alter of [
    (a) => a.filter((x) => !x.startsWith('--readiness-probe')),
    (a) =>
      a.map((x) =>
        x.startsWith('--source-revision')
          ? '--source-revision=4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7'
          : x,
      ),
    (a) => a.concat('--fixture-access'),
    (a) => a.concat('--public-url=http://localhost/'),
  ])
    assert.throws(() => qualificationReadinessOptions(alter(args), scenario, bytes));
  assert.equal(
    COMPACT_SAVED_READINESS_PILOT.scenarioSHA256,
    COMPACT_READINESS_FIXTURES.saved.sha256,
  );
});
test('qualifier routes the exact native response, performs passive boundaries and retains independent numeric verdicts', async () => {
  const s = (await read('scripts/qualify-solo-runtime.mjs')).toString();
  for (const required of [
    'selectedFontHold.handle(route)',
    'assertSelectedFontCancelled(witness)',
    'selectedFontHold.releaseAfterPublicCancellation()',
    'no-automatic-start-after-release',
    "readinessBoundary('font-release-no-start')",
    'await selectedFontHold.close()',
    'report.selectedFontTransport = selectedFontHold.snapshot()',
    'assessSelectedFontReadiness(',
    'report.readinessDocuments = readinessDocuments',
  ])
    assert(s.includes(required), required);
  assert(!s.includes('font-preparation-cancel'));
});

test('font correctness remains independent from failed numbers and rejects replay, GPU, action or transport failures', async () => {
  const { readinessAssessment } = await import('./solo-remote-readiness.mjs');
  const m = model(),
    p = readinessRowPlan(bindReadinessJob(manifest(), 'chromium'), fontCompactRows('chromium')[0]),
    row = p.rows[0];
  const scenario = JSON.parse(await read(p.fixture.path));
  const raw = {
    format: 'SoloQualificationReportV1',
    kind: 'readiness-diagnostic',
    scenarioKind: 'lifecycle',
    scenarioStatus: 'pass',
    scenarioSHA256: p.fixture.sha256,
    sourceRevision: SELECTED_FONT_SOURCE.revision,
    buildIdentity: { sourceRevision: SELECTED_FONT_SOURCE.revision },
    environment: {
      engine: 'chromium',
      browserVersion: 'MODEL',
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
    readinessPilot: { protocol: 'selected-font-cancel-v1', performanceQualification: false },
    readinessDocuments: 1,
    readinessObservation: m.observation,
    selectedFontTransport: m.transport,
    readinessAssessment: assessSelectedFontReadiness(m.observation, m.app, 1, m.transport),
    startupCadenceObservations: [
      { pilotStartupWait: 'omitted; immediate partial samples retained' },
    ],
    snapshots: [{ application: m.app }],
    performanceGateStatus: 'fail',
    pageErrors: [],
    replay: {
      scope: 'completed-scenario',
      nativeVerification: {
        status: 'pass',
        engine: 'chromium',
        browserVersion: 'MODEL',
        observation: { match: true },
      },
    },
    actions: scenario.actions.map((a, i) => ({
      path: String(i),
      type: a.type,
      label: a.label ?? null,
      status: a.optional ? 'skipped-not-visible' : 'pass',
    })),
  };
  const command = { status: 'closed', exitCode: 2, survivors: [], ambiguous: [] },
    journal = { status: 'complete' };
  const result = await readinessAssessment(p, row, raw, command, journal);
  assert.equal(result.readinessCorrectness, 'pass', result.readinessFailure);
  assert.equal(result.diagnosticStatus, 'passed');
  assert.equal(result.status, 'failed');
  assert.equal(result.rawPerformanceGateStatus, 'fail');
  for (const change of [
    (r) => (r.selectedFontTransport.closed = false),
    (r) => (r.selectedFontFailure = 'uncertain'),
    (r) => (r.replay.nativeVerification.status = 'fail'),
    (r) => (r.environment.graphicsCapability.canProceed = false),
    (r) => (r.actions.find((a) => a.label === 'public-cancelled').status = 'skipped-not-visible'),
    (r) => (r.actions[0].path = '99'),
    (r) => (r.scenarioStatus = 'fail'),
    (r) => (r.readinessDocuments = 2),
  ]) {
    const r = clone(raw);
    change(r);
    assert.equal(
      (await readinessAssessment(p, row, r, command, journal)).readinessCorrectness,
      'fail',
    );
  }
});

test('new combined declaration runs from the actual isolated one-file CLI and unbound metadata cannot execute', async (t) => {
  const { mkdtemp, writeFile, rm, realpath } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-font-admission-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'adapter.mjs'),
    input = join(dir, 'model-only.json');
  await writeFile(file, await read('scripts/solo-remote-readiness.mjs'));
  await writeFile(input, JSON.stringify(manifest()));
  assert.equal(
    execFileSync(process.execPath, [file, 'matrix-plan', input], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 65536,
    }),
    `matrix=${JSON.stringify(readinessMatrix(manifest()))}\n`,
  );
  const held = manifest();
  held.candidate = { ...SELECTED_FONT_SOURCE };
  await writeFile(input, JSON.stringify(held));
  assert.throws(() =>
    execFileSync(process.execPath, [file, 'matrix-plan', input], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 65536,
      stdio: 'pipe',
    }),
  );
});
