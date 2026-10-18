import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { createHash } from 'node:crypto';
import {
  DEMO_ARMS,
  DEMO_RESOURCE_MODE,
  DEMO_CLOSE_BOUNDARY_POLICY,
  DEMO_RESOURCE_SOURCE_PATHS,
  validateDemoResourceContract,
  assessDemoResourceCycles,
  validateDemoPlan,
  assertDemoResult,
  unchanged,
} from './solo-remote-demo.mjs';
import { installDemoRecoveryProbe } from './solo-demo-recovery-probe.mjs';
const source = 'a'.repeat(40),
  version = '151.0.1.2';
const command = () => ({ status: 'closed', exitCode: 0, survivors: [], ambiguous: [] });
const snapshot = (tick = 10, drawCount = 10) => ({
  visible: true,
  focused: true,
  viewport: { width: 1280, height: 800, dpr: 1 },
  demo: { id: 1, tick, checkpoint: { hash: String(tick) } },
  drawCount,
  disabled: Object.fromEntries(
    ['demo-resume', 'demo-takeover', 'demo-next', 'demo-watch-pause', 'demo-return'].map((k) => [
      k,
      true,
    ]),
  ),
  quality: { tier: 'full' },
  lastDraw: { quality: 'full', width: 640, paused: false },
  calibration: { samples: 30 },
  reducedPreference: false,
});
const report = () => ({
  format: 'SoloHostedDemoRecoveryV1',
  status: 'pass',
  sourceRevision: source,
  browserVersion: version,
  observedBrowserClosed: true,
  ownedProcess: { exitCode: 0, exitSignal: null },
  observationSettled: true,
  arms: DEMO_ARMS.map((id) => ({
    id,
    status: 'pass',
    beforeActivation: { id: 1, tick: 9, paused: true },
    active: { id: 1, tick: 10, paused: false },
    surface: { width: 64, height: 48 },
    loss: { isTrusted: false, defaultPrevented: false, before: snapshot(), after: snapshot() },
    lost: snapshot(),
    restore: { isTrusted: false },
    restored: snapshot(10, 11),
    held: snapshot(10, 11),
    armed: snapshot(10, 11),
    resumed: snapshot(11, 12),
  })),
  qualityWindows: [5000, 2500].map((requestedMs, i) => ({
    status: 'pass',
    mode: i ? 'practice' : 'spectator',
    requestedMs,
    elapsedMs: requestedMs,
    before: snapshot(),
    after: snapshot(11),
  })),
  prefixProof: { status: 'pass' },
  practiceForkProof: { status: 'pass' },
  staleOwner: { status: 'pass' },
  parentUnchanged: true,
  parentReplay: { status: 'pass', browserVersion: version, ownedBrowserClosed: true },
  demoReplay: { status: 'pass', browserVersion: version, ownedBrowserClosed: true },
  errors: [],
  failedRequests: [],
});
test('unbound plans cannot run; exact fixed cohort is accepted only after binding', async () => {
  const plan = JSON.parse(
    await readFile(
      new URL('../docs/performance/solo-remote-demo-plan.json', import.meta.url),
      'utf8',
    ),
  );
  // Exercise pending admission even after a future reviewed package binds this same plan.
  plan.status = 'unbound-not-executable';
  plan.candidate.revision = null;
  plan.release = { status: 'pending', candidateRevision: null };
  assert.throws(() => validateDemoPlan(plan));
  plan.status = 'pinned-for-execution';
  assert.throws(() => validateDemoPlan(plan));
  plan.candidate = {
    revision: 'a'.repeat(40),
    tree: 'b'.repeat(40),
    run: 1,
    artifact: 2,
    manifestSHA256: 'c'.repeat(64),
    outer: { sha256: 'd'.repeat(64), bytes: 1 },
    inner: { sha256: 'e'.repeat(64), bytes: 1 },
  };
  plan.release = { status: 'reviewed', candidateRevision: plan.candidate.revision };
  validateDemoPlan(plan);
  for (const change of [
    (p) => (p.release.status = 'pending'),
    (p) => (p.setupTimeoutMs = 41 * 60000),
    (p) => p.rows.push({ ...p.rows[0] }),
    (p) => (p.demo.cpuThrottle = 2),
    (p) => (p.demo.qualityWindowsMs[0] = 6000),
    (p) => (p.demo.retries = 1),
    (p) => (p.rows[0].timeoutMs = 700000),
    (p) => (p.demo.sourceAssets[0].relative = '../private.json'),
    (p) => p.demo.sourceAssets.push({ ...p.demo.sourceAssets[0] }),
    (p) => (p.demo.expectedClip = null),
    (p) => (p.evidenceBytes = 512 * 1024 ** 2),
  ]) {
    const p = structuredClone(plan);
    change(p);
    assert.throws(() => validateDemoPlan(p));
  }
});
test('acceptance preserves strict failed cleanup, deadlines, incomplete arms and replay results', () => {
  assertDemoResult(report(), command(), source, version);
  for (const change of [
    (r) => (r.deadlineReached = true),
    (r) => (r.ownedProcess.exitCode = 1),
    (r) => (r.ownedProcess.exitSignal = 'SIGKILL'),
    (r) => (r.ownedProcess.error = 'spawn failed'),
    (r) => (r.observationSettled = false),
    (r) => (r.overflow = true),
    (r) => (r.verifierDrainFailure = 'pending'),
    (r) => (r.sourceDrainFailure = 'pending'),
    (r) => (r.unexpectedSourceFetch = true),
    (r) => r.arms.pop(),
    (r) => (r.arms[0].status = 'fail'),
    (r) => (r.demoReplay.status = 'fail'),
    (r) => (r.parentReplay.ownedBrowserClosed = false),
    (r) => r.errors.push('error'),
    (r) => r.failedRequests.push('failure'),
  ]) {
    const r = report();
    change(r);
    assert.throws(() => assertDemoResult(r, command(), source, version));
  }
  const cmd = command();
  cmd.survivors = [{ pid: 1 }];
  assert.throws(() => assertDemoResult(report(), cmd, source, version));
});
test('loss and restore acceptance requires exact ownership and no hidden advancement', () => {
  for (const change of [
    (r) => (r.arms[0].active.tick = r.arms[0].beforeActivation.tick),
    (r) => (r.arms[0].active.paused = true),
    (r) => (r.arms[0].loss.before.lastDraw.paused = true),
    (r) => r.arms[0].lost.demo.tick++,
    (r) => r.arms[0].lost.drawCount++,
    (r) => (r.arms[1].held.demo.checkpoint.hash = 'changed'),
    (r) => r.arms[2].armed.demo.tick++,
    (r) => (r.arms[3].resumed.demo.id = 2),
    (r) => (r.arms[0].lost.disabled = {}),
    (r) => (r.arms[0].surface.width = 0),
    (r) => (r.arms[0].loss.isTrusted = true),
  ]) {
    const r = report();
    change(r);
    assert.throws(() => assertDemoResult(r, command(), source, version));
  }
});
test('quality acceptance permits no automatic transition but requires actual matching painter tier', () => {
  const r = report();
  r.automaticQualityTransition = 'not-observed';
  assertDemoResult(r, command(), source, version);
  for (const change of [
    (r) => (r.qualityWindows[0].after.lastDraw.quality = 'minimal'),
    (r) => r.qualityWindows[1].after.calibration.samples++,
    (r) => (r.qualityWindows[0].elapsedMs = 4999),
    (r) => (r.qualityWindows[1].before.focused = false),
  ]) {
    const r = report();
    change(r);
    assert.throws(() => assertDemoResult(r, command(), source, version));
  }
});
function environment(separateParent = false) {
  const display = new EventTarget();
  Object.assign(display, { id: 'demo-canvas', width: 640, height: 480 });
  const layer = new EventTarget();
  Object.assign(layer, { width: 640, height: 480 });
  const elements = new Map([
    ['demo-canvas', display],
    [
      'demo-dialog',
      { open: true, dataset: { scene: 'playing' }, classList: { contains: () => false } },
    ],
    ['demo-watch-pause', { getAttribute: () => 'true' }],
    ['settings-reduced-effects', { checked: false }],
  ]);
  for (const id of ['demo-resume', 'demo-takeover', 'demo-next', 'demo-return'])
    elements.set(id, { disabled: false });
  const env = {
    Event,
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    performance: { now: () => 1000 },
    document: {
      hidden: false,
      hasFocus: () => true,
      body: { dataset: { flightState: 'paused' } },
      getElementById: (id) => elements.get(id),
    },
    RevealLineSoloPerformance: {
      export: () => ({ quality: { tier: 'full' }, cadenceCalibration: { samples: 30 } }),
    },
  };
  const run = { tick: 10, status: 'running', level: { id: 'test' }, classId: 'scout' };
  let calls = 0;
  class Painter {
    constructor() {
      this.layers = new Map([['concealment', { canvas: layer }]]);
    }
    draw(...args) {
      calls++;
      this.args = args;
      return 17;
    }
  }
  installDemoRecoveryProbe(env);
  env.Phaser = {
    Game: class {
      constructor() {
        this.scene = {
          scenes: [{ lastPaint: { run: separateParent ? { ...run, tick: 0 } : run } }],
        };
      }
    },
  };
  new env.Phaser.Game();
  env.demoRecoveryProbe.install(Painter, (r) => ({ hash: String(r.tick) }));
  const painter = new Painter();
  return { env, painter, run, display, layer, calls: () => calls };
}
test('forwarded painter preserves receiver, arguments, result and observed owner without scheduling', () => {
  const f = environment(),
    ctx = { canvas: f.display },
    options = { quality: 'full', reduced: false, paused: true, displayCSSWidth: 640 };
  assert.equal(f.painter.draw(ctx, f.run, 0.01, options), 17);
  assert.equal(f.calls(), 1);
  assert.deepEqual(f.painter.args, [ctx, f.run, 0.01, options]);
  const s = f.env.demoRecoveryProbe.snapshot('boundary');
  assert.equal(s.demo.tick, 10);
  assert.equal(s.ordinary.id, s.demo.id);
  assert.equal(s.drawCount, 1);
  assert.equal(s.lastDraw.quality, 'full');
  assert.equal(f.env.requestAnimationFrame, undefined);
});
test('surface probes use the actual retained canvas and reject unknown or duplicate owners', () => {
  const f = environment();
  f.painter.draw({ canvas: f.display }, f.run, 0, { quality: 'full', displayCSSWidth: 640 });
  let events = 0;
  f.layer.addEventListener('contextlost', () => events++);
  const retained = f.env.demoRecoveryProbe.retain('owned-concealment-layer', 'one');
  assert.equal(retained.name, 'concealment');
  const loss = f.env.demoRecoveryProbe.event('one', 'contextlost');
  assert.equal(events, 1);
  assert.equal(loss.isTrusted, false);
  unchanged(loss.before, loss.after);
  assert.throws(() => f.env.demoRecoveryProbe.retain('display', 'one'));
  assert.throws(() => f.env.demoRecoveryProbe.event('missing', 'contextlost'));
  assert.throws(() => f.env.demoRecoveryProbe.event('one', 'resize'));
  f.painter.layers.clear();
  assert.throws(() => f.env.demoRecoveryProbe.retain('owned-concealment-layer', 'missing'));
});

test('readiness polling does not read DOM, export diagnostics, or copy checkpoints', () => {
  const f = environment();
  f.painter.draw({ canvas: f.display }, f.run, 0, {
    quality: 'full',
    paused: true,
    displayCSSWidth: 640,
  });
  const before = f.env.demoRecoveryProbe.readiness();
  f.env.document = new Proxy(
    {},
    {
      get() {
        throw Error('Unexpected DOM read');
      },
    },
  );
  f.env.RevealLineSoloPerformance.export = () => {
    throw Error('Unexpected export');
  };
  assert.deepEqual(f.env.demoRecoveryProbe.readiness(), before);
  f.run.tick++;
  assert.equal(f.env.demoRecoveryProbe.readiness().tick, before.tick + 1);
});

function pausedExportFixture() {
  const f = environment(true);
  let active = false,
    exported = 0;
  const draw = (paused) => {
    active = !paused;
    f.painter.draw({ canvas: f.display }, f.run, 0, {
      quality: 'full',
      paused,
      displayCSSWidth: 640,
    });
  };
  f.env.RevealLineSoloPerformance.export = () => {
    exported++;
    if (active) throw Error('Pause gameplay before exporting diagnostics');
    return { quality: { tier: 'full' }, cadenceCalibration: { samples: 30 } };
  };
  draw(true);
  return { ...f, draw, exported: () => exported };
}

test('active context loss preserves public paused export authority and reaches the actual surface', () => {
  const f = pausedExportFixture(),
    probe = f.env.demoRecoveryProbe;
  const baseline = probe.snapshot('before-activation');
  assert.equal(baseline.quality.tier, 'full');
  f.draw(false);
  probe.retain('owned-concealment-layer', 'active');
  let losses = 0;
  f.layer.addEventListener('contextlost', () => losses++);
  const exportsBefore = f.exported();
  const loss = probe.event('active', 'contextlost');
  assert.equal(losses, 1);
  assert.equal(loss.before.lastDraw.paused, false);
  unchanged(loss.before, loss.after);
  assert.equal(f.exported(), exportsBefore, 'The active fault must not request diagnostics');
  assert.equal(loss.before.quality, null);
  assert.equal(loss.before.calibration, null);
  assert.equal(loss.before.diagnosticsSource, 'not-requested');
  assert.throws(() => probe.snapshot('still-active'), /Pause gameplay/);
  const active = probe.state('active-retired-owner');
  assert.equal(active.quality, null);
  f.draw(true);
  assert.equal(probe.snapshot('after-public-pause').quality.tier, 'full');
});

test('paused export failures remain failures rather than becoming partial quality proof', () => {
  const f = pausedExportFixture(),
    failure = Error('Owner has unsettled preparation');
  f.env.RevealLineSoloPerformance.export = () => {
    throw failure;
  };
  assert.throws(
    () => f.env.demoRecoveryProbe.snapshot('paused'),
    (error) => error === failure,
  );
  const state = f.env.demoRecoveryProbe.state('loss-boundary');
  assert.equal(state.quality, null);
  assert.equal(state.calibration, null);
});

const driverSource = await readFile(
    new URL('./observe-solo-demo-recovery.mjs', import.meta.url),
    'utf8',
  ),
  driverAST = parse(driverSource, { ecmaVersion: 'latest', sourceType: 'module' });
function actualDriverFunction(name, bindings) {
  const declaration = driverAST.body
    .filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations)
    .find((node) => node.id.name === name);
  assert(declaration?.init, `Missing actual driver function ${name}`);
  return Function(
    ...Object.keys(bindings),
    `return (${driverSource.slice(declaration.init.start, declaration.init.end)});`,
  )(...Object.values(bindings));
}

for (const id of DEMO_ARMS) {
  test(`actual ${id} driver faults active paint and exports only after public Pause`, async () => {
    const f = pausedExportFixture(),
      probe = f.env.demoRecoveryProbe,
      practice = id.startsWith('practice'),
      report = { arms: [], snapshots: [] },
      actions = [],
      ordinaryBefore = probe.snapshot('ordinary-before-demo');
    let running = false,
      armed = false,
      lost = false;
    const setDisabled = (value) => {
      for (const name of [
        'demo-resume',
        'demo-takeover',
        'demo-next',
        'demo-watch-pause',
        'demo-return',
      ])
        f.env.document.getElementById(name).disabled = value;
    };
    const target = id.endsWith('-display') ? f.display : f.layer;
    target.addEventListener('contextlost', () => {
      actions.push('contextlost');
      assert.equal(running, true, 'No artificial pause may precede the fault');
      running = false;
      lost = true;
      setDisabled(true);
    });
    target.addEventListener('contextrestored', () => {
      actions.push('contextrestored');
      lost = false;
      f.draw(true);
      setDisabled(false);
    });
    const click = async (selector) => {
      actions.push(selector);
      if (selector === '#demo-resume') {
        armed = true;
        running = !practice;
      } else {
        assert.equal(selector, practice ? '#demo-pause' : '#demo-watch-pause');
        running = false;
        f.draw(true);
      }
    };
    const wait = async (ms) => {
      actions.push(`wait:${ms}`);
      if (running && !lost) {
        f.run.tick++;
        f.draw(false);
      }
    };
    const key = async () => {
      if (practice && armed && !lost) running = true;
    };
    const page = {
      evaluate: async (fn, value) => fn(value),
      keyboard: { down: key, up: async () => {}, press: key },
    };
    const retain = (list, value, cap) => {
      assert(list.length < cap);
      list.push(value);
    };
    const common = {
      window: f.env,
      assert,
      ensure: () => {},
      page,
      report,
      retain,
    };
    const snap = actualDriverFunction('snap', common);
    const fault = actualDriverFunction('fault', {
      ...common,
      snap,
      click,
      wait,
      unchanged,
      validQuality: (s) => {
        assert.equal(s.diagnosticsSource, 'public-paused-export');
        assert.equal(s.quality.tier, s.lastDraw.quality);
      },
      pausedDraw: async () => assert.equal(probe.readiness().paused, true),
      pause: async (value) => click(value ? '#demo-pause' : '#demo-watch-pause'),
      ordinaryBefore,
      save: async () => {},
    });
    await fault(id);
    const arm = report.arms[0];
    assert.equal(arm.status, 'pass');
    assert.equal(arm.loss.before.lastDraw.paused, false);
    assert.equal(arm.loss.before.diagnosticsSource, 'not-requested');
    assert.equal(arm.resumed.diagnosticsSource, 'public-paused-export');
    assert.equal(f.exported(), 2, 'Only baseline and post-Pause export are requested');
    assert(actions.indexOf('contextlost') < actions.indexOf('contextrestored'));
    assert(
      actions.indexOf('contextrestored') <
        actions.lastIndexOf(practice ? '#demo-pause' : '#demo-watch-pause'),
    );
    unchanged(ordinaryBefore, arm.resumed, 'ordinary');
  });
}

test('active reopened and stale-owner driver reads use retained state without export', async () => {
  const f = pausedExportFixture();
  f.draw(false);
  const snap = actualDriverFunction('snap', {
    window: f.env,
    assert,
    ensure: () => {},
    page: { evaluate: async (fn, value) => fn(value) },
    report: { snapshots: [] },
    retain: (rows, value) => rows.push(value),
  });
  assert.equal((await snap('reopened', true)).quality, null);
  assert.equal((await snap('after-retired-events', true)).quality, null);
  assert.equal(f.exported(), 0);
  await assert.rejects(snap('paused-proof'), /Pause gameplay/);
  for (const label of ['reopened', 'after-retired-events']) {
    const escaped = label.replaceAll('-', '\\-');
    assert.match(driverSource, new RegExp(`snap\\('` + escaped + `', true\\)`));
  }
});

const cycleContract = () => ({
  mode: DEMO_RESOURCE_MODE,
  sourceRevision: source,
  resources: { format: 'DemoOwnedResourcesV1', sourceRevision: source },
  cyclesPerMode: 10,
  modes: ['spectator', 'practice'],
  snapshotLimit: 64,
});
const demoHostSource = await readFile(new URL('../game/ui/demo-host.mjs', import.meta.url), 'utf8');
const snapshotStart = demoHostSource.indexOf('  function resourceSnapshot() {');
const snapshotEnd = demoHostSource.indexOf('\n  const listen =', snapshotStart);
assert(snapshotStart > 0 && snapshotEnd > snapshotStart);
const actualDemoSnapshot = new Function(
  'active',
  `
  const canvas={width:640,height:480},resourceOwners=new Set(),disposed=false,
    preparationPhase=()=>active?'paused':null,pendingSourceLoads=0,pendingPreparations=0,
    workerHandles=0,workersCreated=0,workerTerminationRequests=0;
  const zero={canvases:0,pixels:0,rgbaBytesEstimate:0};
  const sceneTransition={resourceSnapshot:()=>({...zero,loading:false})};
  const reward={resourceSnapshot:()=>({pendingPreparations:0,poster:zero,presentation:null,presentationUnavailable:false})};
  ${demoHostSource.slice(snapshotStart, snapshotEnd)}
  return resourceSnapshot();`,
);
function resourceBoundary(label, active, practice, id, tick) {
  return {
    ...snapshot(tick),
    label,
    open: active,
    practice,
    ordinary: { id: 1, tick: 5, checkpoint: { hash: 'ordinary' } },
    demo: { id, tick, checkpoint: { hash: String(tick) } },
    diagnosticsSource: 'public-paused-export',
    resourceContract: cycleContract().resources,
    resources: { demo: actualDemoSnapshot(active) },
    lastDraw: { quality: 'full', width: 640, paused: true },
  };
}
function resourceReport() {
  const r = {
    ...report(),
    format: 'SoloHostedDemoResourceV1',
    resourceContract: cycleContract(),
    resourceStorageBaseline: { localStorage: [], sessionStorage: [] },
    sources: [
      {
        url: 'https://example.test/catalog.json',
        role: 'catalog',
        status: 200,
        responses: 21,
        verifiedResponses: 21,
        bytes: 1,
        sha256: 'a'.repeat(64),
      },
    ],
    arms: [],
    qualityWindows: [],
    snapshots: [resourceBoundary('initial', false, false, 2, 0)],
    cycles: [],
  };
  for (let i = 0; i < 20; i++) {
    const practice = i >= 10,
      mode = practice ? 'practice' : 'spectator',
      cycle = (i % 10) + 1,
      id = 10 + i * 2;
    const paused = r.snapshots.length;
    r.snapshots.push(
      resourceBoundary(`${mode}-${cycle}-paused`, true, practice, practice ? id + 1 : id, 20),
    );
    const closed = r.snapshots.length;
    r.snapshots.push(
      resourceBoundary(`${mode}-${cycle}-closed`, false, false, practice ? id + 1 : id, 20),
    );
    const storage = { localStorage: [], sessionStorage: [] };
    r.cycles.push({
      mode,
      cycle,
      status: 'pass',
      opened: { id, tick: 10, paused: false },
      paused,
      closed,
      storageBefore: storage,
      storageAfter: structuredClone(storage),
      direction: practice ? 'right' : undefined,
      actions: practice
        ? ['open', 'watch-pause', 'details', 'takeover', 'resume', 'ArrowRight', 'pause', 'back']
        : ['open', 'watch-pause', 'back'],
      fork: practice
        ? {
            source: { id, tick: 10, checkpoint: { hash: '10' } },
            demo: { id: id + 1, tick: 10, checkpoint: { hash: '10' } },
          }
        : null,
    });
  }
  r.cycleProof = {
    status: 'pass',
    rows: r.cycles.map((row) => ({
      mode: row.mode,
      cycle: row.cycle,
      sourceMatch: true,
      match: true,
      actual: r.snapshots[row.paused].demo.checkpoint,
      expected: r.snapshots[row.paused].demo.checkpoint,
    })),
  };
  r.resourceAssessment = assessDemoResourceCycles(r, source, cycleContract());
  return r;
}
test('resource mode is explicit, source-bound and does not admit recovery as cycle evidence', async () => {
  const contract = cycleContract();
  validateDemoResourceContract(contract, source);
  for (const change of [
    (c) => (c.cyclesPerMode = 9),
    (c) => (c.snapshotLimit = 65),
    (c) => c.modes.reverse(),
    (c) => (c.sourceRevision = 'b'.repeat(40)),
    (c) => (c.resources.format = 'unknown'),
  ]) {
    const c = structuredClone(contract);
    change(c);
    assert.throws(() => validateDemoResourceContract(c, source));
  }
  const p = JSON.parse(
    await readFile(
      new URL('../docs/performance/solo-remote-demo-plan.json', import.meta.url),
      'utf8',
    ),
  );
  p.format = 'SoloHostedDemoResourcePlanV1';
  p.status = 'pinned-for-execution';
  p.candidate = {
    revision: source,
    tree: 'b'.repeat(40),
    run: 1,
    artifact: 2,
    manifestSHA256: 'c'.repeat(64),
    outer: { bytes: 1, sha256: 'd'.repeat(64) },
    inner: { bytes: 1, sha256: 'e'.repeat(64) },
  };
  p.release = { status: 'reviewed', candidateRevision: source };
  p.rows[0].id = 'candidate-demo-close-reopen-resources';
  Object.assign(p.demo, {
    arms: [],
    qualityWindowsMs: [],
    resourceCycles: contract,
    sourcePaths: DEMO_RESOURCE_SOURCE_PATHS,
  });
  validateDemoPlan(p);
  for (const change of [
    (p) => (p.format = 'SoloHostedDemoRecoveryPlanV1'),
    (p) => (p.demo.resourceCycles = null),
    (p) => (p.demo.arms = DEMO_ARMS),
    (p) => p.demo.observationTimeoutMs++,
    (p) => (p.demo.sourcePaths = DEMO_RESOURCE_SOURCE_PATHS.slice(0, -1)),
  ]) {
    const changed = structuredClone(p);
    change(changed);
    assert.throws(() => validateDemoPlan(changed));
  }
  const r = resourceReport();
  assertDemoResult(r, command(), source, version, contract);
  assert.throws(() => assertDemoResult(r, command(), source, version));
  assert.throws(() => assertDemoResult(report(), command(), source, version, contract));
  assert.equal(r.resourceAssessment.nativeMemoryQualification, false);
  assert.equal(r.resourceAssessment.recoveryQualification, false);
  assert.equal(
    r.resourceAssessment.bounds.status,
    'inconclusive',
    'Unobserved other owners remain unknown',
  );
});
test('cycle acceptance rejects drops, duplicates, wrong actions, active exports, storage drift and owner drift', () => {
  const valid = resourceReport();
  for (const change of [
    (r) => r.cycles.pop(),
    (r) => (r.cycles[1].opened.id = r.cycles[0].opened.id),
    (r) => (r.cycles[0].closed = r.cycles[0].paused),
    (r) => (r.cycles[0].actions = ['open', 'back']),
    (r) => (r.snapshots[1].diagnosticsSource = 'not-requested'),
    (r) => (r.snapshots[1].lastDraw.paused = false),
    (r) => (r.snapshots[1].resources.demo.pendingPreparations = 1),
    (r) => (r.snapshots[1].resources.demo = null),
    (r) => (r.snapshots[2].resources.demo.active = true),
    (r) => r.snapshots[1].ordinary.tick++,
    (r) => (r.cycles[0].storageBefore = undefined),
    (r) => r.cycles[0].storageAfter.localStorage.push({ key: 'changed' }),
    (r) => (r.cycles[10].direction = 'left'),
    (r) => (r.cycles[10].fork.demo.id = r.cycles[10].opened.id),
    (r) => (r.snapshots[21].demo.tick = 10),
    (r) => (r.snapshots[3].quality.tier = 'reduced'),
    (r) => (r.resourceContract.resources.sourceRevision = 'b'.repeat(40)),
    (r) => (r.cycleProof.rows[0].match = false),
    (r) => (r.resourceAssessment.bounds.failures = 0.5),
    (r) => (r.parentReplay.status = 'fail'),
    (r) => (r.cleanupFailure = 'unclosed'),
    (r) => (r.failure = 'earlier raw failure'),
    (r) => r.sources[0].verifiedResponses--,
    (r) => r.sources.push({ ...r.sources[0] }),
    (r) => (r.sources[0].failure = 'corrupt earlier response'),
  ]) {
    const r = structuredClone(valid);
    change(r);
    assert.throws(
      () => assertDemoResult(r, command(), source, version, cycleContract()),
      String(change),
    );
  }
  const pending = structuredClone(valid);
  pending.snapshots[2].resources.demo.pendingPreparations = 1;
  pending.resourceAssessment = assessDemoResourceCycles(pending, source, cycleContract());
  assertDemoResult(pending, command(), source, version, cycleContract());
  assert.equal(pending.resourceAssessment.rows[1].values['demo.pendingPreparations'], 1);
});
test('probe adds owned resources only under explicit contract and successful paused public export', () => {
  const f = pausedExportFixture(),
    probe = f.env.demoRecoveryProbe;
  f.env.RevealLineSoloPerformance.export = () => ({
    quality: { tier: 'full' },
    cadenceCalibration: { samples: 30 },
    resources: { demo: actualDemoSnapshot(true) },
  });
  assert.equal(probe.snapshot('legacy').resources, undefined);
  probe.configureResources(cycleContract().resources);
  const observed = probe.snapshot('paused');
  assert.equal(observed.resources.demo.format, 'DemoOwnedResourcesV1');
  assert.deepEqual(observed.resourceContract, cycleContract().resources);
  assert.equal(probe.state('active').resources, undefined);
  assert.throws(() => probe.configureResources(cycleContract().resources));
  const failure = Error('preparation unsettled');
  f.env.RevealLineSoloPerformance.export = () => {
    throw failure;
  };
  assert.throws(
    () => probe.snapshot('denied'),
    (e) => e === failure,
  );
  assert.equal(probe.state('still-passive').resources, undefined);
});

function publicCycleFixture({
  failAfterClose = 0,
  closeBoundary = false,
  resizeBeforeClose = false,
  paintAfterClose = false,
  failCloseClick = false,
  failDisarm = false,
} = {}) {
  const f = pausedExportFixture(),
    probe = f.env.demoRecoveryProbe;
  probe.configureResources(cycleContract().resources);
  let active = true,
    practice = false,
    current = f.run,
    running = false,
    closes = 0,
    exports = 0;
  const actions = [],
    stored = new Map();
  const doc = f.env.document;
  const closeEvents = closeBoundary ? closeEventFixture(f) : null;
  if (failDisarm) {
    const disarm = probe.disarmCloseBoundary;
    probe.disarmCloseBoundary = () => {
      disarm();
      throw Error('modeled disarm transport failure');
    };
  }
  doc.getElementById('demo-dialog').classList.contains = () => practice;
  f.env.crypto = globalThis.crypto;
  for (const name of ['localStorage', 'sessionStorage'])
    f.env[name] = {
      get length() {
        return stored.size;
      },
      key: (i) => [...stored.keys()][i],
      getItem: (key) => stored.get(key),
    };
  const draw = (paused, width = 640) =>
    f.painter.draw({ canvas: f.display }, current, 0, {
      quality: 'full',
      paused,
      displayCSSWidth: width,
    });
  f.env.RevealLineSoloPerformance.export = () => {
    assert(!active || !running, 'Active play must not request resources');
    exports++;
    return {
      quality: { tier: 'full' },
      cadenceCalibration: { samples: 30 },
      resources: { demo: actualDemoSnapshot(active) },
    };
  };
  const openDemo = async () => {
    actions.push('open');
    active = true;
    practice = false;
    running = true;
    current = { ...f.run, tick: 1 };
    doc.getElementById('demo-dialog').open = true;
    draw(false);
  };
  const pause = async (expectedPractice) => {
    assert.equal(expectedPractice, practice);
    actions.push(practice ? 'pause' : 'watch-pause');
    running = false;
    draw(true);
  };
  const click = async (selector) => {
    actions.push(selector);
    if (selector === '#demo-back') {
      assert(!running);
      if (closeEvents?.listeners.size) {
        if (resizeBeforeClose) draw(true, 565);
        if (failCloseClick) throw Error('modeled public click timeout');
        closeEvents.fire();
        if (paintAfterClose) draw(true, 565);
      }
      active = false;
      practice = false;
      doc.getElementById('demo-dialog').open = false;
      if (++closes === failAfterClose) stored.set('unexpected', 'change');
    } else if (selector === '#demo-takeover') {
      assert(active && !running && !practice);
      practice = true;
      current = { ...current };
      draw(true);
    } else {
      assert(['#demo-details-toggle', '#demo-resume'].includes(selector));
      if (selector === '#demo-resume') doc.activeElement = f.display;
    }
  };
  const report = {
    snapshots: [],
    cycles: [],
    resourceStorageBaseline: { localStorage: [], sessionStorage: [] },
  };
  const page = {
    evaluate: async (fn, arg) => fn(arg),
    waitForFunction: async (fn, arg) => assert(fn(arg)),
    keyboard: {
      down: async (key) => {
        assert.equal(key, 'ArrowRight');
        assert(practice);
        running = true;
      },
      up: async () => {},
    },
  };
  const retain = (rows, value, cap) => {
    assert(rows.length < cap);
    rows.push(value);
  };
  const common = { window: f.env, document: doc, assert, ensure: () => {}, page, report, retain };
  const snap = actualDriverFunction('snap', common);
  const ordinaryBefore = probe.snapshot('ordinary-before');
  report.snapshots.push(ordinaryBefore);
  const readDemoWebStorage = actualDriverFunction('readDemoWebStorage', {
    window: f.env,
    TextEncoder,
    Uint8Array,
  });
  const cycles = actualDriverFunction('resourceCycles', {
    ...common,
    plan: { resourceCycles: closeBoundary ? closeCycleContract() : cycleContract() },
    snap,
    click,
    openDemo,
    pause,
    readDemoWebStorage,
    bounded: async (label, fn) => fn(),
    pausedDraw: async () => assert(probe.readiness().paused),
    wait: async (ms) => {
      assert.equal(ms, 250);
      assert(running);
      current.tick++;
      draw(false);
    },
    unchanged,
    validQuality: (s) => assert.equal(s.lastDraw.paused, true),
    ordinaryBefore,
    save: async () => {},
  });
  return { cycles, report, actions, snap, closeEvents, exports: () => exports };
}
test('actual repeat driver performs all twenty public cycles and exports only after Pause or Close', async () => {
  const f = publicCycleFixture();
  await f.cycles();
  assert.equal(f.report.cycles.length, 20);
  assert.equal(f.actions.filter((x) => x === 'open').length, 20);
  assert.equal(f.actions.filter((x) => x === '#demo-takeover').length, 10);
  assert.equal(f.actions.filter((x) => x === '#demo-back').length, 21);
  assert.equal(f.report.snapshots.length, 42);
  assert.equal(f.exports(), 42);
  const result = assessDemoResourceCycles(
    { ...f.report, sourceRevision: source },
    source,
    cycleContract(),
  );
  assert.equal(result.bounds.failures, 0);
  assert.equal(result.groups['practice-closed'].observed, 10);
});
test('actual repeat driver retains failed storage boundary and stops instead of completing later cycles', async () => {
  const f = publicCycleFixture({ failAfterClose: 2 });
  await assert.rejects(f.cycles(), /deep-equal/);
  assert.equal(f.report.cycles.length, 1);
  assert.equal(f.report.cycles[0].status, 'pending');
  assert.equal(f.report.snapshots.length, 4);
  assert(f.report.cycles[0].storageAfter.localStorage.length > 0);
});
test('actual bounded web-storage reader rejects oversized or invalid storage before digest', async () => {
  let digests = 0;
  const read = actualDriverFunction('readDemoWebStorage', {
    window: {
      localStorage: { length: 1, key: () => 'x'.repeat(257), getItem: () => '' },
      sessionStorage: { length: 0 },
      crypto: {
        subtle: {
          digest: () => {
            digests++;
          },
        },
      },
    },
    TextEncoder,
    Uint8Array,
  });
  await assert.rejects(read(), /key bound/);
  assert.equal(digests, 0);
});
test('actual cycle reconstruction checks source fork and final public-direction practice state', async () => {
  const core = await import('../game/core/index.mjs'),
    replay = await import('../game/replay.mjs');
  const { createDemoPractice } = await import('../game/demo-experience.mjs');
  const text = await readFile(
    new URL('../game/demo-data/first-signal-left.replay.json', import.meta.url),
    'utf8',
  );
  const recording = JSON.parse(text),
    state = core.createRun(recording.level, recording.options);
  assert.equal(recording.segments[0].ticks, 1);
  core.stepRun(state, recording.segments[0].input, core.FIXED_DT);
  const sourceRecord = { tick: state.tick, checkpoint: replay.authoritativeCheckpoint(state) };
  const practice = createDemoPractice(state),
    fork = { tick: state.tick, checkpoint: replay.authoritativeCheckpoint(state) };
  practice.start({ direction: 'right' });
  for (let i = 0; i < 3; i++) practice.advance(core.FIXED_DT);
  practice.pause();
  const target = { tick: state.tick, checkpoint: replay.authoritativeCheckpoint(state) };
  const fn = actualDriverFunction('reconstructResourceCycles', {});
  const input = {
    source: text,
    cycles: [
      {
        mode: 'practice',
        cycle: 1,
        direction: 'right',
        paused: 0,
        fork: { source: sourceRecord, demo: fork },
      },
    ],
    snapshots: [{ demo: target }],
    base: new URL('../game/', import.meta.url).href,
  };
  assert.equal((await fn(input)).status, 'pass');
  const changed = structuredClone(input);
  changed.snapshots[0].demo.checkpoint.hash = 'changed';
  assert.equal((await fn(changed)).status, 'fail');
  const wrong = structuredClone(input);
  wrong.cycles[0].fork.source.checkpoint.hash = 'changed';
  assert.equal((await fn(wrong)).status, 'fail');
  const direction = structuredClone(input);
  direction.cycles[0].direction = 'left';
  await assert.rejects(fn(direction), /tick\/input bound/);
});

test('full retained resource shape and forty cycle boundaries stay within the existing report cap', async () => {
  const retained = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-resource-assessment/retained-3ad-soak.fixture',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const r = resourceReport();
  for (const snapshot of r.snapshots)
    snapshot.resources = {
      ...structuredClone(retained.snapshots[1].application.resources),
      demo: snapshot.resources.demo,
    };
  r.resourceAssessment = assessDemoResourceCycles(r, source, cycleContract());
  assertDemoResult(r, command(), source, version, cycleContract());
  assert(Buffer.byteLength(JSON.stringify(r, null, 2)) < 2 * 1024 ** 2);
});

function responseFixture(resourceMode, assets) {
  let callback;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee.object?.name === 'page' &&
      node.callee.property?.name === 'on' &&
      node.arguments[0]?.value === 'response'
    )
      callback = node.arguments[1];
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
  };
  visit(driverAST);
  assert(callback);
  const report = { sources: [] },
    pending = [],
    expected = new Map(assets.map((a) => [a.url, a]));
  const hash = (b) => createHash('sha256').update(b).digest('hex');
  const handler = Function(
    'resourceMode',
    'assets',
    'report',
    'pending',
    'expected',
    'assert',
    'sha',
    `
    let sourceCapture=true,sourceBytes=0,sourceResponses=0;const resourceSources=new Map();
    return (${driverSource.slice(callback.start, callback.end)});`,
  )(resourceMode, assets, report, pending, expected, assert, hash);
  return { report, pending, handler, hash };
}
test('actual source-response observer verifies every repeat without growing distinct source records', async () => {
  const bytes = Buffer.from('abc'),
    hash = createHash('sha256').update(bytes).digest('hex');
  const asset = {
    url: 'https://example.test/demo-data/source.json',
    role: 'replay',
    bytes: 3,
    sha256: hash,
  };
  const f = responseFixture(true, [asset]);
  const response = {
    url: () => asset.url,
    status: () => 200,
    ok: () => true,
    body: async () => bytes,
  };
  for (let i = 0; i < 21; i++) f.handler(response);
  await Promise.all(f.pending);
  assert.equal(f.report.sources.length, 1);
  assert.equal(f.report.sources[0].responses, 21);
  assert.equal(f.report.sources[0].verifiedResponses, 21);
  assert.equal(f.report.overflow, undefined);
  f.handler(response);
  assert.equal(f.report.overflow, true);
  const bad = responseFixture(true, [asset]);
  bad.handler({ ...response, body: async () => Buffer.from('abd') });
  bad.handler(response);
  await Promise.all(bad.pending);
  assert(bad.report.sources[0].failure);
  assert.equal(bad.report.sources[0].responses, 2);
  assert.equal(bad.report.sources[0].verifiedResponses, 1);
  const old = responseFixture(false, [asset]);
  for (let i = 0; i < 17; i++) old.handler(response);
  await Promise.all(old.pending);
  assert.equal(old.report.sources.length, 16);
  assert.equal(old.report.overflow, true);
});
test('actual repeat source observer retains the original distinct-record and aggregate-byte caps', async () => {
  const bytes = Buffer.alloc(1024 * 1024),
    hash = createHash('sha256').update(bytes).digest('hex');
  const assets = Array.from({ length: 9 }, (_, i) => ({
    url: `https://example.test/${i}.mjs`,
    role: 'module',
    bytes: bytes.length,
    sha256: hash,
  }));
  const f = responseFixture(true, assets);
  for (const a of assets)
    f.handler({ url: () => a.url, status: () => 200, ok: () => true, body: async () => bytes });
  await Promise.all(f.pending);
  assert.equal(f.report.sources.length, 8);
  assert.equal(f.report.overflow, true);
  const small = Buffer.from('x'),
    digest = createHash('sha256').update(small).digest('hex');
  const many = Array.from({ length: 17 }, (_, i) => ({
    url: `https://example.test/${i}.mjs`,
    role: 'module',
    bytes: 1,
    sha256: digest,
  }));
  const capped = responseFixture(true, many);
  for (const a of many)
    capped.handler({
      url: () => a.url,
      status: () => 200,
      ok: () => true,
      body: async () => small,
    });
  await Promise.all(capped.pending);
  assert.equal(capped.report.sources.length, 16);
  assert.equal(capped.report.overflow, true);
});

test('actual Demo entry uses visible Settings for both initial and repeated visits', async () => {
  for (const previous of [null, 10]) {
    for (const settingsVisible of [true, false]) {
      let state = { id: 10, tick: 20, paused: true };
      const clicks = [],
        old = [];
      const open = actualDriverFunction('openDemo', {
        window: { demoRecoveryProbe: { readiness: () => state } },
        document: { getElementById: () => ({ dataset: { scene: 'playing' } }) },
        click: async (selector) => {
          if (settingsVisible)
            assert.notEqual(selector, '#shell-options', 'Home is covered by Settings');
          clicks.push(selector);
        },
        page: {
          locator: (selector) => {
            assert.equal(selector, '#settings-dialog');
            return { isVisible: async () => settingsVisible };
          },
          waitForFunction: async (fn, prior, options) => {
            assert.equal(options.timeout, 60000);
            assert.equal(prior, previous);
            if (prior !== null) {
              old.push(fn(prior));
              state = { id: 11, tick: 1, paused: true };
              old.push(fn(prior));
            }
            state = { id: 11, tick: 1, paused: false };
            assert.equal(fn(prior), true);
          },
        },
      });
      await open(previous);
      assert.deepEqual(old, previous === null ? [] : [false, false]);
      assert.deepEqual(clicks, [
        ...(settingsVisible ? [] : ['#shell-options']),
        '#settings-tab-extras',
        '#shell-demo',
      ]);
    }
  }
});

test('actual Demo entry captures full storage after Settings and before the first Demo action', async () => {
  let stored = 'before-settings',
    baseline = null;
  const actions = [];
  const open = actualDriverFunction('openDemo', {
    click: async (selector) => {
      actions.push(selector);
      if (selector === '#shell-options') stored = 'saved-by-public-settings';
      if (selector === '#shell-demo') assert.equal(baseline, 'saved-by-public-settings');
    },
    page: {
      locator: () => ({ isVisible: async () => false }),
      waitForFunction: async () => {},
    },
  });
  await open(null, async () => {
    actions.push('full-storage-baseline');
    baseline = stored;
  });
  assert.deepEqual(actions, [
    '#shell-options',
    '#settings-tab-extras',
    'full-storage-baseline',
    '#shell-demo',
  ]);
  actions.length = 0;
  await assert.rejects(
    open(null, async () => {
      throw Error('storage read failed');
    }),
    /storage read failed/,
  );
  assert(!actions.includes('#shell-demo'), 'Failed baseline must prevent Demo activation');
});

test('full suspended-parent hash is protected during initial Demo and every repeat', () => {
  const raw = resourceReport();
  const entry = {
    key: 'revealline.suspended.journey-opening.v1',
    bytes: 5606,
    sha256: 'a'.repeat(64),
  };
  raw.resourceStorageBaseline.localStorage = [entry];
  for (const cycle of raw.cycles) {
    cycle.storageBefore = structuredClone(raw.resourceStorageBaseline);
    cycle.storageAfter = structuredClone(raw.resourceStorageBaseline);
  }
  assessDemoResourceCycles(raw, source, cycleContract());
  const initialDrift = structuredClone(raw);
  for (const cycle of initialDrift.cycles) {
    cycle.storageBefore.localStorage[0].sha256 = 'b'.repeat(64);
    cycle.storageAfter.localStorage[0].sha256 = 'b'.repeat(64);
  }
  assert.throws(
    () => assessDemoResourceCycles(initialDrift, source, cycleContract()),
    /Web storage changed between cycles/,
  );
  const repeatDrift = structuredClone(raw);
  repeatDrift.cycles[19].storageAfter.localStorage[0].sha256 = 'b'.repeat(64);
  assert.throws(
    () => assessDemoResourceCycles(repeatDrift, source, cycleContract()),
    /Demo changed observed web storage/,
  );
});

function actualCloseFixture(mode, { acquisitionMs = 0, sendMs = 0 } = {}) {
  const declaration = driverAST.body
    .filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations)
    .find((node) => node.id.name === 'closeObservation');
  assert(declaration?.init);
  const setup = [
    'let exited = false, connected = !mode.startsWith("disconnected"), now = 0, resolveExit;',
    'const events = [], bounds = [], report = { ownedProcess: { pid: 123 } };',
    'const performance = { now: () => now };',
    'const exitPromise = new Promise(resolve => { resolveExit = resolve; });',
    'const finish = (code = 0, signal = null) => {',
    '  exited = true;',
    '  Object.assign(report.ownedProcess, { exitCode: code, exitSignal: signal });',
    '  resolveExit();',
    '};',
    'const chrome = { pid: 123 };',
    "const chromeLog = { close: async () => events.push('log-close') };",
    'const bounded = async (label, operation, ms) => {',
    '  assert(ms > 0 && ms <= 5000); bounds.push({ label, ms });',
    "  if (label === 'observation process exit') {",
    "    if (mode.includes('never-exits')) throw Error(label + ' deadline');",
    "    finish(mode.includes('nonzero-exit') ? 1 : 0, mode.includes('signal-exit') ? 'SIGTERM' : null);",
    "    if (mode.includes('spawn-error')) report.ownedProcess.error = 'spawn error';",
    '  }',
    '  return operation();',
    '};',
    'const browser = {',
    '  isConnected: () => connected,',
    '  newBrowserCDPSession: async () => {',
    "    events.push('acquire'); now += acquisitionMs;",
    '    return { send: async (command) => {',
    "      assert.equal(command, 'Browser.close'); events.push(command); now += sendMs;",
    "      if (mode.startsWith('target-close-race')) { connected = false; throw Error('target closed'); }",
    '    } };',
    '  },',
    "  close: async () => { events.push('disconnect'); connected = false; },",
    '};',
    'const close = (' + driverSource.slice(declaration.init.start, declaration.init.end) + ');',
    'return { close, events, bounds, report };',
  ].join('\n');
  return Function(
    'assert',
    'mode',
    'acquisitionMs',
    'sendMs',
    setup,
  )(assert, mode, acquisitionMs, sendMs);
}

test('actual Demo cleanup closes exact owned Chrome before disconnecting, within original slots', async () => {
  const f = actualCloseFixture('success', { acquisitionMs: 1000, sendMs: 500 });
  await f.close();
  assert.deepEqual(f.events, ['acquire', 'Browser.close', 'disconnect', 'log-close']);
  assert.equal(f.report.observedBrowserClosed, true);
  assert.deepEqual(f.bounds, [
    { label: 'observation browser shutdown', ms: 5000 },
    { label: 'observation browser close', ms: 3500 },
    { label: 'observation process exit', ms: 5000 },
  ]);
});

test('actual Demo cleanup permits a retained transport race only after exact clean process exit', async () => {
  const f = actualCloseFixture('target-close-race');
  await f.close();
  assert.equal(f.report.observedBrowserClosed, true);
  assert.match(f.report.ownedProcess.closeRequestError, /target closed/);
  assert.deepEqual(f.events, ['acquire', 'Browser.close', 'log-close']);
  for (const mode of [
    'never-exits',
    'nonzero-exit',
    'signal-exit',
    'spawn-error',
    'target-close-race-never-exits',
    'target-close-race-nonzero-exit',
    'disconnected-never-exits',
  ]) {
    const failed = actualCloseFixture(mode);
    await assert.rejects(
      failed.close(),
      mode.includes('never-exits') ? /process exit deadline/ : /false.*true/s,
    );
    assert.notEqual(failed.report.observedBrowserClosed, true, mode);
  }
});

test('actual Demo cleanup never renews the original browser-close deadline', async () => {
  const f = actualCloseFixture('success', { acquisitionMs: 4000, sendMs: 1000 });
  await assert.rejects(f.close(), /browser close deadline/);
  assert.deepEqual(f.events, ['acquire', 'Browser.close']);
  assert.notEqual(f.report.observedBrowserClosed, true);
});

test('actual initial observation binds its baseline before any Demo activation', async () => {
  const observation = driverAST.body
    .filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations)
    .find((node) => node.id.name === 'observation')?.init;
  assert(observation?.body?.body);
  const index = observation.body.body.findIndex(
    (node) =>
      node.type === 'IfStatement' &&
      driverSource.slice(node.start, node.end).includes('report.resourceNavigationStorageBefore'),
  );
  assert(index >= 0, 'Initial navigation evidence is retained');
  const first = observation.body.body[index],
    next = observation.body.body[index + 1];
  assert.equal(next.type, 'ExpressionStatement');
  assert.equal(next.expression.type, 'AwaitExpression');
  assert.equal(next.expression.argument.callee.name, 'openDemo');
  const report = {},
    actions = [];
  let stored = 'before-settings';
  const page = {
    evaluate: async () => ({
      localStorage: [{ key: 'parent', bytes: 10, sha256: stored }],
      sessionStorage: [],
    }),
    locator: () => ({ isVisible: async () => false }),
    waitForFunction: async () => {},
  };
  const openDemo = actualDriverFunction('openDemo', {
    page,
    click: async (selector) => {
      actions.push(selector);
      if (selector === '#shell-options') stored = 'after-public-settings-save';
      if (selector === '#shell-demo') {
        assert.equal(report.resourceStorageBaseline.localStorage[0].sha256, stored);
        assert.equal(
          report.resourceNavigationStorageBefore.localStorage[0].sha256,
          'before-settings',
        );
      }
    },
  });
  const entry = Function(
    'resourceMode',
    'report',
    'bounded',
    'page',
    'readDemoWebStorage',
    'openDemo',
    'return (async () => {' + driverSource.slice(first.start, next.end) + '})();',
  );
  await entry(
    true,
    report,
    async (label, fn) => fn(),
    page,
    () => {},
    openDemo,
  );
  assert.deepEqual(actions, ['#shell-options', '#settings-tab-extras', '#shell-demo']);
});

const closeCycleContract = () => ({
  ...cycleContract(),
  closeBoundaryPolicy: DEMO_CLOSE_BOUNDARY_POLICY,
});

// The Node control explicitly models event trust; hosted evidence still requires
// the browser's actual isTrusted value and the real public locator click.
function closeEventFixture(f) {
  const doc = f.env.document,
    oldLookup = doc.getElementById,
    listeners = new Set(),
    button = { id: 'demo-back', contains: (target) => target?.parent === button };
  doc.getElementById = (id) => (id === 'demo-back' ? button : oldLookup(id));
  doc.addEventListener = (type, listener, capture) => {
    assert.equal(type, 'click');
    assert.equal(capture, true);
    listeners.add(listener);
  };
  doc.removeEventListener = (type, listener, capture) => {
    assert.equal(type, 'click');
    assert.equal(capture, true);
    listeners.delete(listener);
  };
  return {
    button,
    listeners,
    fire: (event = {}) => {
      for (const listener of [...listeners])
        listener({ target: button, isTrusted: true, ...event });
    },
  };
}

function closeProbeFixture() {
  const f = pausedExportFixture(),
    events = closeEventFixture(f),
    probe = f.env.demoRecoveryProbe;
  probe.configureResources(cycleContract().resources);
  const before = probe.state('before');
  return {
    ...f,
    events,
    probe,
    arm: () =>
      probe.armCloseBoundary({
        label: 'spectator-1-close-click',
        runId: before.demo.id,
        painterId: before.painterId,
      }),
  };
}

test('trusted Close capture is an explicit contract extension with unchanged historical default', () => {
  validateDemoResourceContract(cycleContract(), source);
  validateDemoResourceContract(closeCycleContract(), source);
  for (const value of [null, false, 'width-change-exemption', 'trusted-click-capture-v2'])
    assert.throws(() =>
      validateDemoResourceContract({ ...cycleContract(), closeBoundaryPolicy: value }, source),
    );
  const old = resourceReport();
  old.snapshots[old.cycles[0].closed].drawCount++;
  assert.throws(() => assessDemoResourceCycles(old, source, cycleContract()));
});

test('actual probe captures the trusted Back boundary without export and releases its listener', () => {
  const f = closeProbeFixture();
  let exports = 0;
  f.env.RevealLineSoloPerformance.export = () => {
    exports++;
    throw Error('No public export allowed inside Close capture');
  };
  f.arm();
  assert.equal(f.events.listeners.size, 1);
  f.events.fire({ target: { parent: f.events.button } });
  const capture = f.probe.takeCloseBoundary();
  assert.equal(capture.closeClick.isTrusted, true);
  assert.equal(capture.diagnosticsSource, 'not-requested');
  assert.equal(capture.resources, undefined);
  assert.equal(capture.resourceContract, undefined);
  assert.equal(exports, 0);
  f.probe.disarmCloseBoundary();
  assert.equal(f.events.listeners.size, 0);
  assert.throws(() => f.probe.takeCloseBoundary(), /missing/);
  f.probe.disarmCloseBoundary();
});

test('actual Close probe rejects missing, synthetic, duplicate and stale-owner events', () => {
  for (const mutate of [
    () => {},
    (f) => f.events.fire({ target: {} }),
    (f) => f.events.fire({ isTrusted: false }),
    (f) => {
      f.events.fire();
      f.events.fire();
    },
    (f) => {
      f.painter.draw({ canvas: f.display }, { ...f.run }, 0, {
        quality: 'full',
        paused: true,
        displayCSSWidth: 640,
      });
      f.events.fire();
    },
    (f) => {
      f.env.document.getElementById('demo-dialog').open = false;
      f.events.fire();
    },
  ]) {
    const f = closeProbeFixture();
    f.arm();
    mutate(f);
    assert.throws(() => f.probe.takeCloseBoundary());
    f.probe.disarmCloseBoundary();
    assert.equal(f.events.listeners.size, 0);
  }
  const f = closeProbeFixture();
  for (let i = 0; i < 20; i++) {
    f.arm();
    f.events.fire();
    f.probe.takeCloseBoundary();
    f.probe.disarmCloseBoundary();
  }
  assert.throws(f.arm, /Bounded/);
  assert.equal(f.events.listeners.size, 0);
});

test('actual resource driver retains paused resize and all 64 setup/click/final boundaries', async () => {
  const f = publicCycleFixture({ closeBoundary: true, resizeBeforeClose: true });
  await f.snap('prepared-first-source');
  await f.cycles();
  await f.snap('ordinary-after');
  assert.equal(f.report.snapshots.length, 64);
  assert.equal(f.exports(), 44, 'Trusted capture must not add public exports');
  assert.equal(f.report.cycles.length, 20);
  assert.equal(f.closeEvents.listeners.size, 0);
  for (const row of f.report.cycles) {
    const paused = f.report.snapshots[row.paused],
      click = f.report.snapshots[row.closeClick],
      closed = f.report.snapshots[row.closed];
    assert.equal(paused.lastDraw.width, 640);
    assert.equal(click.lastDraw.width, 565);
    assert.equal(click.drawCount, paused.drawCount + 1);
    assert.equal(closed.drawCount, click.drawCount);
  }
  assessDemoResourceCycles({ ...f.report, sourceRevision: source }, source, closeCycleContract());
  await assert.rejects(f.snap('overflow'), /false|overflow|assert/i);
  assert.equal(f.report.snapshots.length, 64);
});

test('actual resource driver disarms on click failure and retains the pending cycle', async () => {
  const f = publicCycleFixture({ closeBoundary: true, failCloseClick: true });
  await assert.rejects(f.cycles(), /modeled public click timeout/);
  assert.equal(f.report.cycles.length, 1);
  assert.equal(f.report.cycles[0].status, 'pending');
  assert.equal(f.report.cycles[0].closeClick, undefined);
  assert.equal(f.closeEvents.listeners.size, 0);
});

test('actual resource assessor rejects any extra paint after the trusted Close boundary', async () => {
  const f = publicCycleFixture({ closeBoundary: true, paintAfterClose: true });
  await f.cycles();
  assert.throws(
    () =>
      assessDemoResourceCycles(
        { ...f.report, sourceRevision: source },
        source,
        closeCycleContract(),
      ),
    /painted after/,
  );
});

test('actual resource assessor rejects missing, reused, wrong-owner and invalid trusted boundaries', async () => {
  const f = publicCycleFixture({ closeBoundary: true, resizeBeforeClose: true });
  await f.cycles();
  const raw = { ...f.report, sourceRevision: source };
  for (const mutate of [
    (r) => delete r.cycles[0].closeClick,
    (r) => (r.cycles[1].closeClick = r.cycles[0].closeClick),
    (r, click) => (click.closeClick.isTrusted = false),
    (r, click) => (click.closeClick.target = 'demo-resume'),
    (r, click) => (click.demo.id += 1),
    (r, click) => (click.demo.tick += 1),
    (r, click) => (click.demo.checkpoint.hash = 'changed'),
    (r, click) => (click.painterId += 1),
    (r, click) => (click.atMs = -1),
    (r, click) => (click.lastDraw.paused = false),
    (r, click) => (click.resources = {}),
    (r, click) => (click.diagnosticsSource = 'public-paused-export'),
    (r, click) => (click.ordinary.checkpoint.hash = 'changed'),
    (r, click) => (click.drawCount = 0),
  ]) {
    const changed = structuredClone(raw),
      click = changed.snapshots[changed.cycles[0].closeClick];
    mutate(changed, click);
    assert.throws(() => assessDemoResourceCycles(changed, source, closeCycleContract()));
  }
});

function actualDemoHostFunction(name) {
  const found = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) found.push(node);
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
  };
  visit(parse(demoHostSource, { ecmaVersion: 'latest', sourceType: 'module' }));
  assert.equal(found.length, 1, name);
  return demoHostSource.slice(found[0].start, found[0].end);
}

test('actual host permits paused resize before Close but retires paint before every disposal callback', () => {
  const fixture = Function(
    'assert',
    [
      'let active=true,displayRevision=0,displayCSSWidth=null,lastPaint=null;',
      'let draws=0,reads=0,context=null,picture=null,source=null,practice=null,detailsOpen=false;',
      'let publishedPreparationPhase=null,handoffPending=false,epoch=0,handoffGeneration=0;',
      'let adoptedPlayer=null,paintOwner={},armed=false,busy=false,rewardAge=0,transitionAge=0;',
      'const interrupted=false,origin=null,doc={hidden:false},state={tick:33,status:"running"};',
      'const canvas={width:640,height:480,clientWidth:640,clientHeight:480,getContext:()=>({})};',
      'const dialog={dataset:{},close:()=>{assert.equal(active,false);paint(0);}};',
      'const sceneTransition={paint(){},clear(){paint(0);}},reward={reset(){paint(0);}};',
      'const clock={stop(){paint(0);}},audio=null,audioControls={reset(){paint(0);}};',
      'const controller={abort(){paint(0);}},idle={activity(){paint(0);}},fullscreen={release(){paint(0);}};',
      'const owners=new Map(),getContext=()=>({reduced:false,quality:"full"});',
      'const currentRun=()=>{reads++;return state;},renderingLost=()=>false;',
      'const pictureVisibility=()=>"blurred",renderControls=()=>{},clear=()=>{paint(0);};',
      'const onQualityTransition=()=>{assert.equal(active,false);paint(0);},onExit=()=>{paint(0);};',
      'let painter={preparationGeneration:1,paintRevision:0,draw(){draws++;}};',
      'let director={phase:"paused",player:{},dispose(){assert.equal(active,false);paint(0);}};',
      actualDemoHostFunction('invalidateDisplay'),
      actualDemoHostFunction('paint'),
      actualDemoHostFunction('close'),
      'return {paint,close,resize(width){canvas.clientWidth=width;invalidateDisplay();},',
      'facts:()=>({active,draws,reads,tick:state.tick})};',
    ].join('\n'),
  )(assert);
  fixture.paint(0);
  assert.equal(fixture.facts().draws, 1);
  fixture.paint(0);
  assert.equal(fixture.facts().draws, 1, 'Unchanged paused frame remains suppressed');
  fixture.resize(565);
  fixture.paint(0);
  assert.equal(fixture.facts().draws, 2, 'Paused resize legitimately redraws before Close');
  const before = fixture.facts();
  fixture.close();
  fixture.resize(320);
  fixture.paint(0);
  fixture.close();
  assert.deepEqual(fixture.facts(), { ...before, active: false });
});

test('actual resource driver disarms the capture if the fixed snapshot cap is exhausted', async () => {
  const f = publicCycleFixture({ closeBoundary: true });
  while (f.report.snapshots.length < 62) await f.snap('modeled-existing-boundary');
  await assert.rejects(f.cycles());
  assert.equal(f.report.snapshots.length, 64);
  assert.equal(f.report.cycles.length, 1);
  assert.equal(f.report.cycles[0].status, 'pending');
  assert.equal(f.report.cycles[0].closeClick, undefined);
  assert.equal(f.closeEvents.listeners.size, 0);
});

test('actual resource driver retains primary Close failure if disarming also rejects', async () => {
  const f = publicCycleFixture({ closeBoundary: true, failCloseClick: true, failDisarm: true });
  await assert.rejects(f.cycles(), /modeled public click timeout/);
  const row = f.report.cycles[0];
  assert.equal(row.status, 'pending');
  assert.equal(row.closeCaptureFailure, 'modeled public click timeout');
  assert.equal(row.closeCaptureCleanupFailure, 'modeled disarm transport failure');
  assert.equal(f.closeEvents.listeners.size, 0);
});

test('actual resource driver still fails when only capture cleanup rejects', async () => {
  const f = publicCycleFixture({ closeBoundary: true, failDisarm: true });
  await assert.rejects(f.cycles(), /modeled disarm transport failure/);
  assert.equal(f.report.cycles[0].closeCaptureFailure, undefined);
  assert.equal(f.report.cycles[0].closeCaptureCleanupFailure, 'modeled disarm transport failure');
  assert.equal(f.report.cycles[0].status, 'pending');
});
