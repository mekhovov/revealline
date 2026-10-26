import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { installDemoRecoveryProbe } from './solo-demo-recovery-probe.mjs';
import {
  DEMO_PAUSED_GEOMETRY_POLICY,
  validateDemoPlan,
  validateDemoResourceContract,
  assertDemoPausedGeometryReceipt,
  assessDemoResourceCycles,
  prepareDemoMode,
} from './solo-remote-demo.mjs';
import { publicCycleFixture, activationCycleContract } from './test-solo-remote-demo.mjs';
import {
  decodeDemoGeometryWitness,
  demoGeometryWitnessPath,
} from './solo-demo-geometry-historical-source.mjs';
const read = (p) => readFile(new URL('../' + p, import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const planPaths = [
  'docs/performance/solo-demo-resources-797e03-paused-geometry-plan.json',
  'docs/performance/solo-demo-recovery-797e03-geometry-tooling-plan.json',
];
const plans = await Promise.all(planPaths.map(async (p) => JSON.parse(await read(p))));
const witnessBytes = await read(demoGeometryWitnessPath);
const witness = decodeDemoGeometryWitness(witnessBytes);
function fixture() {
  let time = 1000,
    next = 1,
    practice = false;
  const frames = new Map(),
    timers = new Map();
  const canvas = {
    id: 'demo-canvas',
    width: 640,
    height: 480,
    clientWidth: 1000,
    clientHeight: 600,
  };
  canvas.getBoundingClientRect = () => ({
    x: 6,
    y: 50,
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  });
  const dialog = {
    open: true,
    dataset: { scene: 'playing' },
    classList: { contains: () => practice },
  };
  const env = {
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    performance: { now: () => time },
    document: {
      hidden: false,
      hasFocus: () => true,
      body: { dataset: { flightState: 'paused' } },
      getElementById: (id) =>
        id === 'demo-canvas' ? canvas : id === 'demo-dialog' ? dialog : null,
    },
    requestAnimationFrame: (fn) => {
      const id = next++;
      frames.set(id, fn);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (fn, ms) => {
      assert.equal(ms, 10000);
      const id = next++;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  class Painter {
    constructor() {
      this.preparationGeneration = 1;
      this.paintRevision = 2;
    }
    draw() {
      return 17;
    }
  }
  const run = { tick: 10, status: 'running', level: { id: 'test' }, classId: 'scout' };
  installDemoRecoveryProbe(env);
  const probe = env.demoRecoveryProbe;
  probe.configurePausedGeometry(DEMO_PAUSED_GEOMETRY_POLICY);
  probe.install(Painter, (r) => ({ hash: String(r.tick) }));
  const painter = new Painter();
  const draw = (
    width = (canvas.clientHeight * canvas.width) / canvas.height,
    paused = true,
    state = run,
  ) =>
    painter.draw({ canvas }, state, 0, {
      quality: 'full',
      reduced: false,
      paused,
      displayCSSWidth: width,
    });
  draw(800, false);
  const before = probe.pausedGeometryState();
  const owner = {
    runId: before.runId,
    painterId: before.painterId,
    afterDraw: before.drawCount,
    practice: false,
  };
  draw(800, true);
  canvas.clientHeight = 300;
  return {
    env,
    canvas,
    dialog,
    painter,
    probe,
    run,
    owner,
    draw,
    handles: () => frames.size + timers.size,
    frame: (timestamp = null, delta = 16) => {
      time += delta;
      const row = frames.entries().next().value;
      assert(row);
      frames.delete(row[0]);
      row[1](timestamp ?? time);
    },
    deadline: () => {
      time += 10000;
      const fn = timers.values().next().value;
      assert(fn);
      fn();
    },
    setPractice: () => {
      practice = true;
    },
  };
}
async function accepted(f = fixture()) {
  const promise = f.probe.settlePausedGeometry(f.owner);
  f.frame(); // Pause has changed actual bounds; cached paint remains stale.
  f.draw(); // Model the application's asynchronous ResizeObserver repaint.
  f.frame();
  f.frame();
  const receipt = await promise;
  return { f, receipt, paused: f.probe.state('spectator-1-paused') };
}
test('actual probe waits for asynchronous size invalidation and two distinct native callbacks', async () => {
  const { f, receipt, paused } = await accepted();
  assert.equal(receipt.first.paint.width, 800);
  assert.equal(receipt.first.fittedWidth, 400);
  assert.equal(receipt.staleGeometryFrames, 1);
  assert.equal(receipt.framesObserved, 3);
  assert.deepEqual(
    receipt.accepted.map((s) => s.nativeCallback.ordinal),
    [2, 3],
  );
  assert(
    receipt.accepted[1].nativeCallback.timestamp > receipt.accepted[0].nativeCallback.timestamp,
  );
  assert.equal(receipt.accepted[0].drawCount, receipt.accepted[1].drawCount);
  assert.equal(paused.lastDraw.width, 400);
  assertDemoPausedGeometryReceipt(receipt, paused);
  assert.equal(f.handles(), 0);
});
test('one matching frame or repeated host reads cannot satisfy two native frame opportunities', async () => {
  const f = fixture();
  f.draw();
  let settled = false;
  const promise = f.probe.settlePausedGeometry(f.owner).then((x) => {
    settled = true;
    return x;
  });
  for (let i = 0; i < 5; i++) f.probe.pausedGeometryState();
  assert.equal(settled, false);
  f.frame();
  await Promise.resolve();
  assert.equal(settled, false);
  f.frame();
  await promise;
  assert.equal(f.handles(), 0);
});
test('geometry and painter-generation changes reset the consecutive frame pair', async () => {
  const f = fixture();
  f.draw();
  const promise = f.probe.settlePausedGeometry(f.owner);
  f.frame();
  f.canvas.clientHeight = 330;
  f.painter.paintRevision++; // Actual bounds changed before repaint.
  f.frame();
  f.draw();
  f.frame();
  f.frame();
  const receipt = await promise;
  assert.equal(receipt.framesObserved, 4);
  assert.deepEqual(
    receipt.accepted.map((s) => s.nativeCallback.ordinal),
    [3, 4],
  );
  assert.equal(receipt.accepted[1].paint.paintRevision, 3);
  assertDemoPausedGeometryReceipt(receipt, f.probe.state('paused'));
});
test('missing repaint reaches the unchanged deadline and releases only its owned scheduling handles', async () => {
  const f = fixture(),
    promise = f.probe.settlePausedGeometry(f.owner);
  f.frame();
  f.deadline();
  await assert.rejects(promise, /deadline/);
  assert.equal(f.handles(), 0);
});
test('duplicate native timestamps and changed owners fail closed with complete readiness cleanup', async () => {
  for (const mutate of [
    (f) => f.frame(1000), // Same callback timestamp on the second delivery.
    (f) => {
      f.run.tick++;
      f.frame();
    },
    (f) => {
      f.dialog.open = false;
      f.frame();
    },
    (f) => {
      f.env.document.hidden = true;
      f.frame();
    },
    (f) => {
      f.env.document.hasFocus = () => false;
      f.frame();
    },
    (f) => {
      f.setPractice();
      f.frame();
    },
    (f) => {
      f.draw(400, false);
      f.frame();
    },
    (f) => {
      f.draw(400, true, { ...f.run });
      f.frame();
    },
    (f) => {
      f.canvas.clientHeight = 0;
      f.frame();
    },
  ]) {
    const f = fixture(),
      promise = f.probe.settlePausedGeometry(f.owner);
    f.frame(1000);
    mutate(f);
    await assert.rejects(promise);
    assert.equal(f.handles(), 0);
  }
});
test('readiness refuses concurrent ownership, invalid policy and stale pre-pause draw boundaries', async () => {
  const f = fixture();
  assert.throws(() => f.probe.configurePausedGeometry(DEMO_PAUSED_GEOMETRY_POLICY));
  for (const owner of [
    { ...f.owner, afterDraw: -1 },
    { ...f.owner, extra: true },
  ])
    assert.throws(() => f.probe.settlePausedGeometry(owner));
  const promise = f.probe.settlePausedGeometry(f.owner);
  assert.throws(() => f.probe.settlePausedGeometry(f.owner));
  f.deadline();
  await assert.rejects(promise);
  await assert.rejects(
    f.probe.settlePausedGeometry({ ...f.owner, afterDraw: 999 }),
    /owner changed/,
  );
  assert.equal(f.handles(), 0);
});
test('assessment rejects relabeled host polls, stale paint, resized bounds, missing receipts and altered timing', async () => {
  const { receipt, paused } = await accepted();
  for (const mutate of [
    (r) => r.accepted.pop(),
    (r) => r.accepted[1].nativeCallback.ordinal--,
    (r) => (r.accepted[1].nativeCallback.timestamp = r.accepted[0].nativeCallback.timestamp),
    (r) => (r.accepted[0].paint.width = 800),
    (r) => r.accepted[1].geometry.clientHeight++,
    (r) => r.accepted[1].paint.generation++,
    (r) => r.framesObserved++,
    (r) => (r.accepted[1].atMs = r.first.atMs + 10000),
    (r) => r.owner.runId++,
  ]) {
    const copy = structuredClone(receipt);
    mutate(copy);
    assert.throws(() => assertDemoPausedGeometryReceipt(copy, paused));
  }
  const copy = structuredClone(paused);
  copy.geometry.geometry.bounds.x++;
  assert.throws(() => assertDemoPausedGeometryReceipt(receipt, copy), /snapshot geometry changed/);
  assert.throws(() => assertDemoPausedGeometryReceipt(undefined, paused));
});
test('actual twenty-cycle driver settles every paused resize and keeps exactly64 snapshots and strict Close draws', async () => {
  const f = publicCycleFixture({ activationBoundary: true, geometryBoundary: true });
  try {
    await f.snap('prepared-first-source');
    await f.cycles();
    await f.snap('ordinary-after');
    assert.equal(f.report.cycles.length, 20);
    assert.equal(f.report.snapshots.length, 64);
    const contract = {
      ...activationCycleContract(),
      pausedGeometryPolicy: DEMO_PAUSED_GEOMETRY_POLICY,
    };
    const raw = { ...f.report, sourceRevision: 'a'.repeat(40) };
    assessDemoResourceCycles(raw, raw.sourceRevision, contract);
    for (const row of raw.cycles) {
      assert.equal(row.pausedGeometry.staleGeometryFrames, 1);
      const paused = raw.snapshots[row.paused],
        activation = raw.snapshots[row.closeActivation],
        closed = raw.snapshots[row.closed];
      assert.equal(paused.lastDraw.width, (424 * 640) / 480);
      assert.equal(activation.drawCount, closed.drawCount);
    }
    assert.equal(f.geometryHandles(), 0);
    const extra = structuredClone(raw);
    extra.snapshots[extra.cycles[0].closed].drawCount++;
    assert.throws(() => assessDemoResourceCycles(extra, raw.sourceRevision, contract));
    const missing = structuredClone(raw);
    delete missing.cycles[0].pausedGeometry;
    assert.throws(() => assessDemoResourceCycles(missing, raw.sourceRevision, contract));
    const changed = structuredClone(raw),
      row = changed.cycles[4],
      paused = changed.snapshots[row.paused];
    for (const s of [row.pausedGeometry.first, ...row.pausedGeometry.accepted, paused.geometry]) {
      s.geometry.clientHeight = 300;
      s.geometry.bounds.height = 300;
      s.fittedWidth = 400;
      s.paint.width = 400;
    }
    paused.lastDraw.width = 400;
    assert.throws(
      () => assessDemoResourceCycles(changed, raw.sourceRevision, contract),
      /Comparable Demo cycle changed/,
    );
  } finally {
    f.dispose();
  }
});
test('new declarations preserve the failed width receipt, exact workload and original limits', async () => {
  for (const plan of plans) {
    validateDemoPlan(plan);
    const prior = JSON.parse(await read(plan.geometryReadinessSuccessor.priorDeclaration.path));
    const restored = structuredClone(plan);
    delete restored.geometryReadinessSuccessor;
    for (const key of ['scope', 'bindingScope', 'prospectiveTooling']) restored[key] = prior[key];
    restored.demo.driver = prior.demo.driver;
    restored.demo.probe = prior.demo.probe;
    restored.adapterInputs = prior.adapterInputs;
    if (restored.demo.resourceCycles) delete restored.demo.resourceCycles.pausedGeometryPolicy;
    assert.deepEqual(restored, prior);
    assert.equal(plan.geometryReadinessSuccessor.priorObservation.runId, 39149681708);
    assert.equal(plan.geometryReadinessSuccessor.priorObservation.artifactId, 12144433958);
    assert.equal(plan.geometryReadinessSuccessor.priorObservation.disposition, 'failed-reviewed');
    assert.equal(
      plan.geometryReadinessSuccessor.priorObservation.auditBlob,
      '8e999f638e696af2063141d346b33fcf4f660144',
    );
    assert.equal(plan.geometryReadinessSuccessor.currentObservation, 'unobserved');
  }
  assert.equal(plans[0].demo.resourceCycles.pausedGeometryPolicy, DEMO_PAUSED_GEOMETRY_POLICY);
  assert.equal(plans[1].demo.resourceCycles, undefined);
});
test('current successor pins are exact; old executed inputs have no production admission fallback', async () => {
  for (const plan of plans)
    for (const ref of [...plan.adapterInputs, ...plan.frozenTools]) {
      const bytes = await read(ref.path);
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(sha(bytes), ref.sha256, ref.path);
    }
  for (const record of witness.records.filter((r) => r.path.endsWith('-plan.json'))) {
    const bytes = await read(record.path);
    assert.equal(sha(bytes), record.sha256);
    let effects = 0;
    await assert.rejects(() =>
      prepareDemoMode({
        plan: JSON.parse(bytes),
        admitted: { artifacts: { candidate: {} } },
        repository: new URL('../', import.meta.url).pathname,
        evidence: '/never',
        digest: async (p) => {
          const b = await readFile(p);
          return { bytes: b.length, sha256: sha(b) };
        },
        required: async () => effects++,
      }),
    );
    assert.equal(effects, 0);
  }
  const changed = Buffer.from(witnessBytes);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => decodeDemoGeometryWitness(changed));
});
test('unknown geometry policies, expanded workload and missing trusted activation remain refused', () => {
  for (const mutate of [
    (c) => (c.pausedGeometryPolicy = 'eventual-layout'),
    (c) => (c.closeBoundaryPolicy = 'trusted-click-capture-v1'),
    (c) => c.snapshotLimit++,
    (c) => c.cyclesPerMode++,
  ]) {
    const c = structuredClone(plans[0].demo.resourceCycles);
    mutate(c);
    assert.throws(() => validateDemoResourceContract(c, plans[0].candidate.revision));
  }
});
const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
const job = (lane) =>
  workflow.split('\n  ' + lane + ':\n')[1].split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
test('both actual commands include complete current and historical closure with fixed source and original bounds', () => {
  for (const [i, lane] of ['demo-resources', 'demo-recovery'].entries()) {
    const body = job(lane),
      sparse = body.split('          sparse-checkout: |\n')[1].split(/\n      - /)[0];
    for (const p of [
      ...planPaths,
      demoGeometryWitnessPath,
      'scripts/solo-demo-geometry-historical-source.mjs',
      'scripts/test-solo-demo-geometry-admission.mjs',
    ])
      assert(sparse.includes('            /' + p + '\n'), p);
    assert(body.includes('scripts/run-solo-remote-correctness.mjs ' + planPaths[i]));
    const line = body.split('\n').find((v) => v.trim().startsWith('node --test '));
    assert(line.includes('--test-concurrency=2 '));
    assert(line.includes('scripts/test-solo-demo-geometry-admission.mjs '));
    assert(body.includes('timeout-minutes: 125\n'));
    assert(body.includes('timeout-minutes: 79\n'));
    assert(body.includes('timeout --signal=TERM --kill-after=30s 4620s'));
    assert(body.includes("github.ref == 'refs/heads/main'"));
    assert(
      body.includes(
        '797e03f28743921842df6aa57520a72016ba3dfc bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5',
      ),
    );
    assert(body.includes('readFile("' + planPaths[i] + '", "utf8")'));
    assert(!body.includes('--test-name-pattern'));
  }
});

test('native callback cap retains bounded failed samples and closes readiness handles', async () => {
  const f = fixture(),
    promise = f.probe.settlePausedGeometry(f.owner);
  for (let i = 0; i < 2048; i++) f.frame(null, 0.1);
  await assert.rejects(promise, /readiness bound/);
  const failure = f.probe.pausedGeometryFailure();
  assert.equal(failure.format, 'DemoPausedGeometryFailureV1');
  assert.equal(failure.framesObserved, 2048);
  assert.equal(failure.first.paint.width, 800);
  assert.equal(failure.latest.nativeCallback.ordinal, 2048);
  assert.equal(f.handles(), 0);
});
test('initial geometry read failure releases pending owner so a fresh boundary can recover', async () => {
  const f = fixture(),
    original = f.canvas.getBoundingClientRect;
  f.canvas.getBoundingClientRect = () => {
    throw Error('modeled layout unavailable');
  };
  await assert.rejects(f.probe.settlePausedGeometry(f.owner), /layout unavailable/);
  assert.equal(f.probe.pausedGeometryFailure().first, null);
  f.canvas.getBoundingClientRect = original;
  const promise = f.probe.settlePausedGeometry(f.owner);
  f.draw();
  f.frame();
  f.frame();
  await promise;
  assert.equal(f.handles(), 0);
});

test('readiness declaration refuses expanded limits, one-frame admission and lost failure receipt', () => {
  for (const mutate of [
    (p) => p.geometryReadinessSuccessor.readiness.deadlineMs++,
    (p) => p.geometryReadinessSuccessor.readiness.maximumNativeCallbacks++,
    (p) => p.geometryReadinessSuccessor.readiness.nativeCallbacks--,
    (p) => p.geometryReadinessSuccessor.priorObservation.artifactId++,
    (p) => (p.geometryReadinessSuccessor.priorObservation.disposition = 'passed'),
    (p) => delete p.geometryReadinessSuccessor,
  ]) {
    const p = structuredClone(plans[0]);
    mutate(p);
    assert.throws(() => validateDemoPlan(p));
  }
});
