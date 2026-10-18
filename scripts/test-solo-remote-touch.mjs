import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, copyFile, symlink, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import {
  TOUCH_SOURCE,
  TOUCH_JOBS,
  TOUCH_PROTOCOL,
  TOUCH_FIXTURE,
  touchCase,
  touchDisplayCommand,
  touchMatrix,
  bindTouchJob,
  validateTouchPlan,
  touchAssessment,
  touchLatency,
  readTouchJSON,
  assertTouchMovement,
  assertTouchEvents,
} from './solo-remote-touch.mjs';
import {
  installTouchProbe,
  dispatchTouchDirection,
  writeTouchReport,
  closeTouchOwner,
  observeTouchCadenceAfterStart,
  readPartialTouchReplay,
} from './observe-solo-native-touch.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { quantileBound } from './solo-qualification.mjs';
import { calibrateSettledCadence } from './solo-qualification-cadence.mjs';
const run = promisify(execFile);
const candidate = JSON.parse(
  await readFile(
    new URL('../docs/performance/solo-remote-final-earned-raster-plan.json', import.meta.url),
  ),
).candidate;
const helpers = [
  'run-solo-remote-correctness.mjs',
  'observe-solo-native-touch.mjs',
  'verify-solo-build.mjs',
  'solo-remote-archive.py',
  'serve-production-preview.mjs',
  'game-cli.mjs',
  'solo-qualification-cadence.mjs',
  'solo-qualification-native-replay.mjs',
  'solo-qualification-export.mjs',
  'solo-qualification.mjs',
];
const ref = (path) => ({ path, bytes: 1, sha256: '1'.repeat(64) });
function manifest() {
  return {
    format: 'SoloHostedTouchManifestV1',
    status: 'reviewed-input-diagnostic-only',
    repository: 'mekhovov/revealline',
    candidate: structuredClone(candidate),
    runtimeRevision: TOUCH_SOURCE.runtime,
    baseline: {
      revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
      tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
    },
    node: '22.13.1',
    playwright: '1.62.1',
    cpu: 1,
    maxParallel: 2,
    automaticRetries: 0,
    performanceExclusion: true,
    setupTimeoutMs: 2400000,
    helperTimeoutMs: 4500000,
    rowEvidenceBytes: 32 * 1024 ** 2,
    evidenceBytes: 256 * 1024 ** 2,
    protocol: structuredClone(TOUCH_PROTOCOL),
    fixture: structuredClone(TOUCH_FIXTURE),
    jobs: [...TOUCH_JOBS],
    release: {
      scope: 'native-touch-submission-only',
      candidateRevision: TOUCH_SOURCE.revision,
      firstEightAllCorrectnessPassed: false,
      performanceQualification: 'excluded',
      physicalQualification: 'unobserved',
      automaticRetries: 0,
      priorProofInspected: true,
      noUnclosedOwners: true,
      onceOnlyBefore: 'a7e0219818842f02399317ca6d2a14bdd506da3d',
    },
    adapterInputs: [ref('scripts/solo-remote-touch.mjs')],
    frozenTools: helpers.map((name) => ref('scripts/' + name)),
  };
}
function rawTouch(mode = 'dpad', engine = 'chromium') {
  const job = touchCase(engine + '-' + mode, 1),
    count = 24 + Number(mode !== 'dpad');
  const state = {
    atMs: 1,
    phase: 'running',
    visible: true,
    focused: true,
    levelId: 'first-return',
    tick: 1,
    x: 0,
    y: 0,
    lives: 3,
    trailCells: 0,
  };
  const blank = {
    url: 'about:blank',
    visible: true,
    focused: true,
    viewport: { width: 400, height: 850 },
    devicePixelRatio: 3,
  };
  const externalCadence = calibrateSettledCadence({
    protocol: 'foreground-about-blank-settled-120-v1',
    expected: { width: 400, height: 850, dpr: 3 },
    settleMs: 2000,
    timeoutMs: 10000,
    targetIntervals: 120,
    registeredAtMs: 0,
    measurementAnchor: { callbackAtMs: 2000, timestampMs: 2000 },
    samples: Array(120).fill(16.666),
    settleSamples: Array(120).fill(16.666),
    initialState: blank,
    finalState: blank,
    foregroundThroughout: true,
    environmentStableThroughout: true,
    deadlineReached: false,
    overflow: false,
  });
  const stats = { count, histogram: [count, 0, 0, 0], maxMs: 10 };
  const raw = {
    format: 'SoloHostedNativeTouchV1',
    status: 'pass',
    job,
    initial: state,
    afterNeutralDown: state,
    externalCadence,
    environment: {
      viewport: job.context.viewport,
      dpr: 3,
      maxTouchPoints: engine === 'webkit' ? 0 : 1,
    },
    nativeCapability: { syntheticDOMEvents: false },
    buildIdentity: { sourceRevision: TOUCH_SOURCE.revision, sha256: '2'.repeat(64) },
    artifact: {
      sourceRevision: TOUCH_SOURCE.revision,
      sourceTree: TOUCH_SOURCE.tree,
      manifestSHA256: candidate.manifestSHA256,
      archiveIdentity: candidate.inner,
      buildInfoSHA256: '2'.repeat(64),
    },
    observedBrowserClosed: true,
    errors: [],
    browserVersion: '151.0.0.0',
    csp: PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
    recording: { path: 'report.replay.json', bytes: 17, sha256: '3'.repeat(64) },
    movement: Array.from({ length: 24 }, (_, index) => ({
      index,
      direction: index % 2 ? 'left' : 'right',
      before: { ...state, tick: 100 + index * 120, x: index % 2 ? 10 : 0 },
      after: { ...state, tick: 160 + index * 120, x: index % 2 ? 0 : 10 },
    })),
    nativeInput: {
      dropped: 0,
      events: Array.from({ length: count }, (_, index) => ({
        type: mode === 'dpad' || index === 0 ? 'pointerdown' : 'pointermove',
        isTrusted: true,
        pointerType: 'touch',
        defaultPrevented: true,
      })),
    },
    application: {
      inputLatency: { byKind: { touch: { toTick: stats, toRender: stats } }, overwritten: 0 },
      droppedInputObservations: 0,
      interruptions: { count: 0 },
      failures: { count: 0 },
      histogramUpperBoundsMs: [10, 20, 40, null],
    },
  };
  raw.nativeReplay = {
    status: 'pass',
    engine,
    browserVersion: raw.browserVersion,
    buildIdentity: raw.buildIdentity,
    csp: raw.csp,
    recording: { bytes: 17, sha256: '3'.repeat(64) },
    observation: { match: true, status: 'pass' },
    pageErrors: [],
    failedRequests: [],
  };
  raw.nativeReplay.modules = [{ status: 200, csp: raw.csp }];
  raw.nativeReplay.expected = {
    browserVersion: raw.browserVersion,
    buildIdentity: raw.buildIdentity,
    csp: raw.csp,
  };
  return Object.assign(raw, touchLatency(raw, quantileBound));
}
const command = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] };

test('native touch preserves twelve fixed observations, exact package, context and nonphysical scope', () => {
  const m = manifest();
  assert.equal(touchMatrix(m).include.length, 4);
  const rows = TOUCH_JOBS.flatMap((job) => bindTouchJob(m, job).rows);
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((r) => r.id)).size, 12);
  for (const job of TOUCH_JOBS) {
    const p = bindTouchJob(m, job);
    assert.equal(validateTouchPlan(p), p);
    assert(p.rows.every((r) => r.timeoutMs === 480000 && r.source === 'candidate'));
  }
  assert.throws(() => touchCase('webkit-swipe', 1));
  assert.throws(() => touchCase('chromium-dpad', 4));
  assert.equal(touchCase('webkit-dpad', 1).context.isMobile, false);
  for (const mutate of [
    (m) => (m.candidate.revision = 'f'.repeat(40)),
    (m) => (m.candidate.inner.sha256 = 'f'.repeat(64)),
    (m) => m.candidate.artifact++,
    (m) => (m.protocol.directionChanges = 25),
    (m) => (m.cpu = 4),
    (m) => (m.baseline.reusableArtifact = {}),
    (m) => m.helperTimeoutMs++,
    (m) => (m.release.physicalQualification = 'passed'),
    (m) => (m.release.firstEightAllCorrectnessPassed = true),
    (m) => m.frozenTools.pop(),
  ]) {
    const bad = manifest();
    mutate(bad);
    assert.throws(() => bindTouchJob(bad, 'chromium-dpad'));
  }
});
test('standalone copied declaration binds four actual jobs without runtime imports', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'touch-declaration-')));
  try {
    await copyFile(new URL('./solo-remote-touch.mjs', import.meta.url), join(root, 'adapter.mjs'));
    await writeFile(join(root, 'plan.json'), JSON.stringify(manifest()));
    const result = await run(process.execPath, [
      join(root, 'adapter.mjs'),
      'matrix-plan',
      join(root, 'plan.json'),
    ]);
    assert.equal(JSON.parse(result.stdout.slice(7)).include.length, 4);
    await run(process.execPath, [
      join(root, 'adapter.mjs'),
      'bind-plan',
      join(root, 'plan.json'),
      join(root, 'bound.json'),
      'webkit-dpad',
    ]);
    assert.equal((await readTouchJSON(join(root, 'bound.json'))).rows.length, 3);
    await assert.rejects(
      run(process.execPath, [
        join(root, 'adapter.mjs'),
        'bind-plan',
        join(root, 'plan.json'),
        join(root, 'bound.json'),
        'webkit-dpad',
      ]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('actual native dispatcher taps public buttons and uses one continuous CDP contact only', async () => {
  const calls = [];
  const page = {
    waitForFunction: async (fn, selector, options) =>
      calls.push(['ready', selector, options.timeout]),
    locator: (selector) => ({ boundingBox: async () => ({ x: 10, y: 20, width: 30, height: 40 }) }),
    touchscreen: { tap: async (x, y) => calls.push(['tap', x, y]) },
  };
  for (let i = 0; i < 24; i++) await dispatchTouchDirection({ page, mode: 'dpad', index: i });
  assert.equal(calls.filter((c) => c[0] === 'tap').length, 24);
  assert.deepEqual(calls[0], ['ready', '[data-move="right"]', 10000]);
  assert.deepEqual(calls[1], ['tap', 25, 40]);
  for (const mode of ['stick', 'swipe']) {
    const messages = [];
    const cdp = { send: async (name, input) => messages.push({ name, input }) };
    for (let i = 0; i < 24; i++)
      await dispatchTouchDirection({ cdp, mode, index: i, anchor: { x: 100, y: 200 } });
    assert.equal(messages.length, 24);
    assert(
      messages.every(
        (m) =>
          m.name === 'Input.dispatchTouchEvent' &&
          m.input.type === 'touchMove' &&
          m.input.touchPoints[0].id === 1,
      ),
    );
    assert.deepEqual(
      messages.map((m) => m.input.touchPoints[0].x),
      Array.from({ length: 24 }, (_, i) => (i % 2 ? 60 : 140)),
    );
  }
  await assert.rejects(dispatchTouchDirection({ page, mode: 'invalid', index: 0 }));
});
test('actual installed witness retains trusted metadata, applies no events and exposes overflow', () => {
  const handlers = {},
    environment = {
      performance: { now: () => 42 },
      document: {
        body: { dataset: { flightState: 'running' } },
        hidden: false,
        hasFocus: () => true,
        addEventListener: (name, fn) => (handlers[name] = fn),
      },
    };
  installTouchProbe({ mode: 'dpad' }, environment);
  const target = { id: 'right', closest: () => ({ dataset: { move: 'right' } }) };
  const event = {
    type: 'pointerdown',
    target,
    isTrusted: true,
    pointerType: 'touch',
    defaultPrevented: true,
  };
  for (let i = 0; i < 65; i++) handlers.pointerdown(event);
  const exported = environment.soloTouchProbe.export();
  assert.equal(exported.events.length, 64);
  assert.equal(exported.dropped, 1);
  assert.equal(exported.events[0].isTrusted, true);
  environment.document.body.dataset.flightState = 'paused';
  handlers.pointerdown(event);
  assert.equal(environment.soloTouchProbe.export().dropped, 1);
  environment.Phaser = {
    Game: class {
      constructor() {
        this.scene = {
          scenes: [
            {
              readyCount: 30,
              lastPaint: {
                run: {
                  level: { id: 'first-return' },
                  tick: 10,
                  player: { x: 3, y: 0 },
                  lives: 3,
                  trail: [],
                },
              },
            },
          ],
        };
      }
    },
  };
  new environment.Phaser.Game();
  assert.equal(environment.soloTouchProbe.read().x, 3);
});
test('meaningful movement rejects event padding, wrong route, interrupted phase and lost visibility', () => {
  for (const mode of ['dpad', 'stick', 'swipe']) {
    const raw = rawTouch(mode);
    assertTouchMovement(raw, raw.job);
    assertTouchEvents(raw, raw.job);
  }
  for (const change of [
    (r) => (r.movement[4].after.x = r.movement[4].before.x),
    (r) => (r.movement[5].after.tick = 0),
    (r) => (r.movement[7].after.y = 1),
    (r) => (r.movement[8].after.phase = 'paused'),
    (r) => (r.movement[1].after.focused = false),
    (r) => r.movement[3].after.lives--,
    (r) => r.movement.pop(),
  ]) {
    const raw = rawTouch();
    change(raw);
    assert.throws(() => assertTouchMovement(raw, raw.job));
  }
  const raw = rawTouch('stick');
  raw.afterNeutralDown = { ...raw.initial, x: 1 };
  assert.throws(() => assertTouchMovement(raw, raw.job));
});
test('event trust, exact counts, overflow and all existing interruption checks remain mandatory', () => {
  for (const change of [
    (r) => (r.nativeInput.events[2].isTrusted = false),
    (r) => (r.nativeInput.events[1].pointerType = 'mouse'),
    (r) => (r.nativeInput.events[0].defaultPrevented = false),
    (r) => (r.nativeInput.dropped = 1),
    (r) => r.application.inputLatency.byKind.touch.toTick.count--,
    (r) => (r.application.interruptions.count = 1),
    (r) => (r.application.failures.count = 1),
    (r) => (r.application.inputLatency.overwritten = 1),
  ]) {
    const raw = rawTouch();
    change(raw);
    assert.throws(() => assertTouchEvents(raw, raw.job));
  }
});
test('histogram latency preserves failed, straddling and incomplete cadence labels', () => {
  const raw = rawTouch();
  assert.equal(raw.inputGateStatus, 'pass-observed-window');
  raw.application.inputLatency.byKind.touch.toRender = {
    count: 24,
    histogram: [0, 0, 24, 0],
    maxMs: 39,
  };
  assert.equal(touchLatency(raw, quantileBound).inputGateStatus, 'inconclusive');
  raw.application.inputLatency.byKind.touch.toRender = {
    count: 24,
    histogram: [0, 0, 0, 24],
    maxMs: 45,
  };
  assert.equal(touchLatency(raw, quantileBound).inputGateStatus, 'fail');
  raw.externalCadence.status = 'provisional-incomplete';
  assert.equal(touchLatency(raw, quantileBound).inputGateStatus, 'unobserved');
  raw.application.inputLatency.byKind.touch.toRender = {
    count: 19,
    histogram: [19, 0, 0, 0],
    maxMs: 9,
  };
  assert.equal(touchLatency(raw, quantileBound).touchLatencyGate.quantileBound, null);
  assert.equal(touchLatency(raw, quantileBound).inputGateStatus, 'fail');
});
test('independent assessment keeps real WebKit touch capability and raw numeric failures separate', async () => {
  for (const engine of ['chromium', 'webkit']) {
    const p = bindTouchJob(manifest(), engine + '-dpad'),
      raw = rawTouch('dpad', engine);
    assert.equal((await touchAssessment(p, p.rows[0], raw, command)).status, 'passed');
  }
  const p = bindTouchJob(manifest(), 'chromium-dpad'),
    raw = rawTouch();
  raw.application.inputLatency.byKind.touch.toRender = {
    count: 24,
    histogram: [0, 0, 0, 24],
    maxMs: 45,
  };
  Object.assign(raw, touchLatency(raw, quantileBound));
  const result = await touchAssessment(p, p.rows[0], raw, { ...command, exitCode: 2 });
  assert.equal(result.status, 'failed');
  assert.equal(result.nativeInputCorrectness, 'pass');
  assert.equal(result.rawInputGateStatus, 'fail');
  assert.equal(result.performanceQualification, 'excluded');
  assert.equal(result.physicalQualification, 'unobserved');
});
test('readback cannot promote altered calibration, owner/replay mismatch or hidden raw failure', async () => {
  const p = bindTouchJob(manifest(), 'chromium-dpad');
  for (const change of [
    (r) => (r.externalCadence.baselineMs = 100),
    (r) => (r.inputGateStatus = 'fail'),
    (r) => (r.nativeReplay.browserVersion = 'other'),
    (r) => (r.nativeReplay.observation.match = false),
    (r) => (r.nativeReplay.modules = []),
    (r) => (r.artifact.archiveIdentity = { bytes: 1, sha256: 'f'.repeat(64) }),
    (r) => (r.csp = ''),
    (r) => (r.environment.maxTouchPoints = 0),
    (r) => (r.partialReplay = true),
    (r) => (r.browserCloseFailure = 'timeout'),
    (r) => (r.errorOverflow = true),
  ]) {
    const raw = rawTouch();
    change(raw);
    assert.equal((await touchAssessment(p, p.rows[0], raw, command)).status, 'failed');
  }
  for (const change of [
    (c) => (c.forcedCleanup = true),
    (c) => (c.survivors = [1]),
    (c) => (c.ambiguous = [2]),
    (c) => (c.status = 'failed'),
    (c) => (c.cleanupUnconfirmed = true),
  ]) {
    const c = structuredClone(command);
    change(c);
    assert.equal((await touchAssessment(p, p.rows[0], rawTouch(), c)).status, 'failed');
  }
});
test('bounded atomic reports retain failed partial observations and reject unsafe/oversized reads', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'touch-report-')));
  try {
    const path = join(dir, 'report.json');
    await writeTouchReport(path, { status: 'running' });
    await writeTouchReport(path, { status: 'fail', partialReplay: true, movement: [{ index: 0 }] });
    assert.deepEqual(await readTouchJSON(path), {
      status: 'fail',
      partialReplay: true,
      movement: [{ index: 0 }],
    });
    await symlink(path, join(dir, 'link.json'));
    await assert.rejects(readTouchJSON(join(dir, 'link.json')));
    await assert.rejects(readTouchJSON(path, 5));
    await assert.rejects(writeTouchReport(path, { large: 'x'.repeat(TOUCH_PROTOCOL.reportBytes) }));
    assert.equal((await readTouchJSON(path)).status, 'fail');
    await writeFile(path + '.partial', 'existing');
    await assert.rejects(writeTouchReport(path, { status: 'pass' }));
    assert.equal((await readTouchJSON(path)).status, 'fail');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('cleanup exceptions are retained and never treated as confirmed closure', async () => {
  const report = {};
  await closeTouchOwner(
    {
      close: async () => {
        throw Error('closed transport failure');
      },
    },
    'browser',
    report,
  );
  assert.match(report.browserCloseFailure, /closed transport failure/);
});

test('headed touch uses the same owned display wrapper for preflight and each row', () => {
  const executables = { 'xvfb-run': { path: '/usr/bin/xvfb-run' } };
  assert.deepEqual(touchDisplayCommand(executables, ['node', 'observer', 'plan', 'report']), [
    '/usr/bin/xvfb-run',
    '--auto-servernum',
    '--server-args=-screen 0 1280x1024x24',
    'node',
    'observer',
    'plan',
    'report',
  ]);
  assert.throws(() => touchDisplayCommand({ 'xvfb-run': { path: '/tmp/replacement' } }, ['node']));
  assert.equal(TOUCH_PROTOCOL.headed, true);
});

function publicReplayPage({
  open = true,
  text = '{"version":"retained"}',
  phases = ['paused'],
} = {}) {
  const calls = [];
  let reads = 0;
  return {
    calls,
    locator(selector) {
      return {
        async getAttribute(name) {
          assert.equal(selector, 'body');
          assert.equal(name, 'data-flight-state');
          return phases[Math.min(reads++, phases.length - 1)];
        },
        async isVisible() {
          return selector === '#replay-dialog' ? open : true;
        },
        async inputValue(options) {
          assert.equal(selector, '#replay-json');
          if (options) assert(options.timeout > 0 && options.timeout <= 10000);
          return text;
        },
        async waitFor() {},
        async isEnabled() {
          return true;
        },
        async click() {
          calls.push(selector);
          assert(!open, 'The exact failed WebKit retry clicks behind its already-open modal');
          if (selector === '#export-replay') open = true;
        },
      };
    },
  };
}

test('partial touch readback preserves an already-open public replay after the native click timed out', async () => {
  const page = publicReplayPage();
  assert.deepEqual(await readPartialTouchReplay(page), {
    recording: '{"version":"retained"}',
    source: 'already-open-public-replay-dialog',
  });
  assert.deepEqual(page.calls, [], 'No second menu/export click through the public modal');
  const raw = rawTouch();
  raw.status = 'fail';
  raw.failure = 'locator.click: Timeout; performing click action';
  raw.partialReplay = true;
  raw.partialReplayReadback = { source: 'already-open-public-replay-dialog' };
  const plan = bindTouchJob(manifest(), 'chromium-dpad');
  assert.equal((await touchAssessment(plan, plan.rows[0], raw, command)).status, 'failed');
  assert.match(raw.failure, /performing click action/);
  assert.equal(raw.nativeReplay.status, 'pass', 'Internally valid replay cannot erase the failure');
});

test('partial touch readback keeps the ordinary public export path when no replay dialog exists', async () => {
  const page = publicReplayPage({ open: false });
  assert.equal((await readPartialTouchReplay(page)).source, 'public-export-controls');
  assert.deepEqual(page.calls, [
    '#shell-menu',
    '#shell-options',
    '#settings-tab-extras',
    '#shell-workshop',
    '#export-replay',
  ]);
});

test('partial touch readback rejects running, changed phase, malformed, empty and oversized public text', async () => {
  for (const options of [
    { phases: ['running'] },
    { phases: ['paused', 'running'] },
    { text: '' },
    { text: '   ' },
    { text: '{' },
    { text: 'null' },
    { text: '[]' },
    { text: '"not a replay object"' },
    { text: 'x'.repeat(TOUCH_PROTOCOL.replayBytes + 1) },
  ])
    await assert.rejects(readPartialTouchReplay(publicReplayPage(options)));
  for (const timeout of [0, -1, NaN, Infinity, 10001])
    await assert.rejects(readPartialTouchReplay(publicReplayPage(), timeout));
});

test('internal touch cadence observation follows owned public Start and never replaces settled120 authority', async () => {
  const report = { externalCadence: { baselineMs: 16.7, authority: 'retained' } };
  const external = structuredClone(report.externalCadence);
  let calls = 0;
  await observeTouchCadenceAfterStart(
    {
      async waitForFunction(predicate, argument, options) {
        calls++;
        assert.match(String(predicate), /readyCount === 30/);
        assert.equal(argument, null);
        assert.equal(options.timeout, 5000);
        throw Error('Optional internal readiness unavailable');
      },
    },
    report,
  );
  assert.equal(calls, 1);
  assert.equal(report.internalCadenceBoundary, 'after-public-start-before-native-input');
  assert.match(report.internalCadenceWait, /unavailable/);
  assert.deepEqual(report.externalCadence, external);
  const source = await readFile(
    new URL('./observe-solo-native-touch.mjs', import.meta.url),
    'utf8',
  );
  const body = source.slice(source.indexOf('export async function observeTouch('));
  const check = body.indexOf('await observeTouchCadenceAfterStart(page, report)');
  assert(check > body.indexOf("await requirePhase('running', 60000)"));
  assert(check > body.indexOf("action('first-active-retained-paint-observed')"));
  assert(check < body.indexOf('const initial = await page.evaluate'));
  assert.equal(body.match(/observeTouchCadenceAfterStart\(page, report\)/g)?.length, 1);
  assert(!body.includes('readyCount === 30'), 'No title-stage internal wait remains');
});
