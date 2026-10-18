import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { DEMO_ARMS, validateDemoPlan, assertDemoResult, unchanged } from './solo-remote-demo.mjs';
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
