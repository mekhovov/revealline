import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import {
  createBrowserReadinessProbe,
  assessReadinessGeometry,
  assessReadinessPilot,
} from './solo-qualification-readiness.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const defaultBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-readiness-geometry/default-observation.json',
    import.meta.url,
  ),
);
assert.equal(
  createHash('sha256').update(defaultBytes).digest('hex'),
  '824616c303af1cea9e89f6739a16ba27ec7c64d199ceedc425efb312e97cb4b5',
);
const defaults = JSON.parse(defaultBytes);
function harness({ geometry = true, protocol = 'first-running-v1', serialized = false } = {}) {
  let now = 0,
    layoutReads = 0;
  const handlers = new Map(),
    windows = new Map();
  const run = { tick: 0, level: { id: 'first-return' } };
  const cadence = {
    samples: 30,
    required: 30,
    baselineMs: 1000 / 90,
    restartedSamples: 0,
    waiting: false,
    status: 'measured-before-play',
  };
  const canvas = {
    get clientWidth() {
      layoutReads++;
      return 384;
    },
    get clientHeight() {
      layoutReads++;
      return 192;
    },
  };
  const scene = {
    lastPaint: { run },
    prepared: () => true,
    displayedBoardValid: true,
    preparedState: { run, revision: 7 },
    submittedRun: run,
    cadence: { snapshot: () => ({ ...cadence }) },
    revision: 7,
    displayCSSWidth: 384,
    displayCSSHeight: 192,
    game: { canvas },
  };
  const env = {
    performance: { now: () => ++now },
    document: {
      body: {
        dataset: { flightState: 'briefing', screenControls: 'shown', flightLayout: 'preparing' },
      },
      hidden: false,
      hasFocus: () => true,
      addEventListener: (k, v) => handlers.set(k, v),
      removeEventListener: (k, v) => {
        if (handlers.get(k) === v) handlers.delete(k);
      },
    },
    addEventListener: (k, v) => windows.set(k, v),
    removeEventListener: (k, v) => {
      if (windows.get(k) === v) windows.delete(k);
    },
  };
  const fn = createBrowserReadinessProbe;
  const make = serialized ? runInNewContext('(' + fn.toString() + ')', { TextEncoder }) : fn;
  const probe = make(() => scene, env, protocol, geometry);
  return {
    probe,
    scene,
    run,
    env,
    windows,
    handlers,
    get layoutReads() {
      return layoutReads;
    },
    click() {
      handlers.get('click')({ isTrusted: true, target: { closest: () => ({}) } });
    },
    phase(p) {
      env.document.body.dataset.flightState = p;
      probe.phase(p);
    },
    clearMarker() {
      delete env.document.body.dataset.flightLayout;
    },
    app() {
      return { baselineMs: cadence.baselineMs, cadenceCalibration: { ...cadence } };
    },
    raw() {
      return JSON.parse(JSON.stringify(probe.export()));
    },
  };
}
function complete(h) {
  h.click();
  h.clearMarker();
  h.phase('running');
  h.phase('paused');
  return h.raw();
}
for (const serialized of [false, true])
  test(`geometry reads occur only at actual active phase boundaries (${serialized ? 'serialized' : 'direct'})`, () => {
    const h = harness({ protocol: 'warm-resume-v1', serialized });
    h.phase('briefing');
    h.click();
    assert.equal(h.layoutReads, 0);
    h.clearMarker();
    h.phase('running');
    assert.equal(h.layoutReads, 2);
    for (let i = 0; i < 10000; i++) h.phase('running');
    assert.equal(h.layoutReads, 2);
    h.run.tick = 144;
    h.phase('paused');
    h.click();
    assert.equal(h.layoutReads, 2);
    h.phase('running');
    assert.equal(h.layoutReads, 4);
    h.run.tick = 192;
    h.phase('paused');
    const raw = h.raw();
    assert.equal(raw.records.length, 6);
    assert.equal(Buffer.byteLength(JSON.stringify(raw)) < 16384, true);
    assert.equal(assessReadinessGeometry([raw], 'warm-resume-v1').status, 'passed');
    assert.deepEqual(
      raw.records.filter((r) => r.geometry).map((r) => r.kind),
      ['first-running', 'resumed-running'],
    );
    assert.equal(h.run.tick, 192, 'Observation never advances the run');
    raw.records[1].geometry.clientWidth = 1;
    assert.equal(
      h.raw().records[1].geometry.clientWidth,
      384,
      'Exports cannot mutate retained geometry',
    );
    h.probe.dispose();
    assert.equal(h.handlers.size, 0);
    assert.equal(h.windows.size, 0);
    h.phase('running');
    assert.equal(h.layoutReads, 4);
  });
test('default collector is byte-identical and performs zero layout reads', () => {
  for (const protocol of ['first-running-v1', 'warm-resume-v1', 'saved-resume-v1']) {
    const b = harness({ protocol, geometry: false });
    assert.deepEqual(complete(b), defaults.outputs[protocol]);
    assert.equal(b.layoutReads, 0);
    assert(!Object.hasOwn(b.raw(), 'geometryObservation'));
    assert(b.raw().records.every((r) => !Object.hasOwn(r, 'geometry')));
  }
});
test('geometry fails for stale, missing, invalid, unsubmitted or unsettled preparation fields', () => {
  const h = harness(),
    raw = complete(h);
  assert.equal(assessReadinessGeometry([raw], 'first-running-v1').status, 'passed');
  const edits = [
    (r) => delete r.geometry,
    (r) => (r.geometry.clientWidth = 0),
    (r) => (r.geometry.clientHeight = null),
    (r) => (r.geometry.clientWidth = Number.MAX_SAFE_INTEGER + 1),
    (r) => (r.geometry.displayCSSWidth = 385),
    (r) => (r.geometry.displayCSSHeight = 193),
    (r) => (r.geometry.revision = -1),
    (r) => (r.geometry.preparedRevision = 6),
    (r) => (r.geometry.flightLayout = 'preparing'),
    (r) => (r.geometry.flightLayout = 'other'),
    (r) => (r.geometry.screenControls = null),
    (r) => (r.prepared = false),
    (r) => (r.preparedRunMatches = false),
    (r) => (r.submittedRunMatches = false),
    (r) => (r.displayedBoardValid = false),
    (r) => (r.visible = false),
    (r) => (r.phase = 'paused'),
  ];
  for (const edit of edits) {
    const bad = structuredClone(raw);
    edit(bad.records[1]);
    assert.equal(assessReadinessGeometry([bad], 'first-running-v1').status, 'failed');
  }
  for (const edit of [
    (r) => delete r.geometryObservation,
    (r) => r.errors++,
    (r) => r.dropped++,
    (r) => r.records.push(...r.records, ...r.records),
    (r) => (r.records[0].geometry = { ...r.records[1].geometry }),
  ]) {
    const bad = structuredClone(raw);
    edit(bad);
    assert.equal(assessReadinessGeometry([bad], 'first-running-v1').status, 'failed');
  }
});
test('layout getter failures remain incomplete and use no retry or extra callback', () => {
  const h = harness();
  Object.defineProperty(h.scene.game.canvas, 'clientWidth', {
    get() {
      throw Error('unavailable');
    },
  });
  h.click();
  h.clearMarker();
  h.phase('running');
  h.phase('paused');
  const raw = h.raw();
  assert.equal(raw.errors, 1);
  assert.equal(raw.records.length, 2);
  assert.equal(assessReadinessGeometry([raw], 'first-running-v1').status, 'failed');
});
test('saved documents each require their own first-running geometry; existing tick-zero rule remains independent', () => {
  const a = harness({ protocol: 'saved-resume-v1' }),
    b = harness({ protocol: 'saved-resume-v1' });
  const first = complete(a);
  b.run.tick = 144;
  const second = complete(b);
  assert.equal(assessReadinessGeometry([first, second], 'saved-resume-v1').status, 'passed');
  assert.equal(assessReadinessGeometry([first], 'saved-resume-v1').status, 'failed');
  const late = harness();
  late.run.tick = 1;
  const raw = complete(late);
  assert.equal(
    assessReadinessGeometry([raw], 'first-running-v1').status,
    'passed',
    'Geometry alone cannot certify prior tick timing',
  );
  const readiness = assessReadinessPilot(raw, late.app(), 1);
  assert.equal(readiness.status, 'failed');
  assert(readiness.failures.includes('initial-authoritative-tick'));
});
test('geometry opt-in is exact and separate from the selected-font protocol', () => {
  for (const geometry of [undefined, null, 'true', 1]) {
    if (geometry === undefined) continue;
    assert.throws(() => harness({ geometry }));
  }
  assert.throws(() => harness({ protocol: 'selected-font-cancel-joined-v2', geometry: true }));
});

test('missing, zero and nonfinite native dimension observations remain explicit failures', () => {
  for (const value of [undefined, 0, NaN, Infinity, -Infinity]) {
    const h = harness();
    Object.defineProperty(h.scene.game.canvas, 'clientWidth', { get: () => value });
    const raw = complete(h),
      geometry = raw.records[1].geometry;
    assert.equal(geometry.clientWidth, Number.isFinite(value) ? value : null);
    assert.equal(assessReadinessGeometry([raw], 'first-running-v1').status, 'failed');
  }
});

test('the phase predicate rejects the retained 360-to-320 preparation mismatch and accepts reconciled dimensions', () => {
  const h = harness();
  h.scene.displayCSSWidth = 360;
  Object.defineProperty(h.scene.game.canvas, 'clientWidth', { get: () => 320 });
  const raw = complete(h);
  assert.equal(
    raw.records[1].prepared,
    true,
    'A prepared flag alone does not prove final geometry',
  );
  assert.equal(raw.records[1].geometry.displayCSSWidth, 360);
  assert.equal(raw.records[1].geometry.clientWidth, 320);
  assert(
    assessReadinessGeometry([raw], 'first-running-v1').failures.includes(
      'accepted-cache-matches-visible-css-geometry',
    ),
  );
  const reconciled = harness();
  reconciled.scene.displayCSSWidth = 320;
  Object.defineProperty(reconciled.scene.game.canvas, 'clientWidth', { get: () => 320 });
  assert.equal(
    assessReadinessGeometry([complete(reconciled)], 'first-running-v1').status,
    'passed',
  );
});

test('actual qualifier forwards geometry only at existing phase boundaries and preserves all default counters', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const { createRafIntervalClock, frozenExternalCadence } = await import(
    './solo-qualification-observation.mjs'
  );
  const marker = '  await addQualificationProbe(\n';
  const first = source.indexOf(marker) + marker.length;
  const end = source.indexOf('    {\n      bounds: FRAME_BOUNDS,', first);
  const factory = source.slice(first, end).trim().replace(/,$/, '');
  const run = (enabled) => {
    let now = 0,
      nextFrame,
      onPhase,
      sceneReads = 0;
    const listeners = new Map(),
      work = new Map();
    const state = { tick: 0, level: { id: 'first-return' } };
    let cadence = {
      samples: 9,
      required: 30,
      baselineMs: null,
      restartedSamples: 0,
      waiting: false,
      status: 'pending-quiet-preparation',
    };
    const scene = {
      lastPaint: { run: state, quality: 'full' },
      prepared: () => true,
      displayedBoardValid: true,
      preparedState: { run: state, revision: 2 },
      revision: 2,
      displayCSSWidth: 384,
      displayCSSHeight: 192,
      game: { canvas: { clientWidth: 384, clientHeight: 192 } },
      submittedRun: state,
      cadence: { snapshot: () => ({ ...cadence }) },
    };
    const env = {
      performance: { now: () => now },
      document: {
        body: { dataset: { flightState: 'briefing', screenControls: 'shown' } },
        hidden: false,
        hasFocus: () => true,
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener() {},
      },
      addEventListener() {},
      removeEventListener() {},
      MutationObserver: class {
        constructor(callback) {
          onPhase = callback;
        }
        observe() {}
      },
      requestAnimationFrame: (callback) => {
        nextFrame = callback;
      },
      HTMLMediaElement: class {
        play() {
          return Promise.resolve();
        }
      },
      RevealLineSoloPerformance: {
        export() {
          throw Error('Active application export is forbidden');
        },
      },
    };
    env.window = env;
    env.soloQualificationIntervalClock = (at) => createRafIntervalClock(at, env.performance.now);
    env.soloQualificationFrozenCadence = frozenExternalCadence;
    env.soloQualificationReadiness = () => ({});
    env.soloQualificationCreateReadinessProbe = (getScene, _environment, protocol, geometry) =>
      createBrowserReadinessProbe(getScene, env, protocol, geometry);
    runInNewContext(
      '(' + factory + ')',
      env,
    )({
      bounds: [33, 50, 100, 250, null],
      workProbe: true,
      externalCadenceCalibration: null,
      hitchJournal: false,
      journalCost: false,
      readinessProbe: enabled,
      readinessGeometry: enabled,
      readinessProtocol: 'warm-resume-v1',
    });
    env.Phaser = {
      Game: class {
        constructor() {
          this.events = { on: (name, fn) => work.set(name, fn) };
        }
        get scene() {
          sceneReads++;
          return { scenes: [scene] };
        }
      },
      Core: { Events: { PRE_STEP: 'pre', POST_RENDER: 'post' } },
    };
    new env.Phaser.Game();
    listeners.get('DOMContentLoaded')();
    env.soloQualificationProbe.startApplicationProbe();
    nextFrame(0);
    listeners.get('click')?.({ isTrusted: true, target: { closest: () => ({}) } });
    cadence = {
      samples: 30,
      required: 30,
      baselineMs: 1000 / 90,
      restartedSamples: 9,
      waiting: false,
      status: 'measured-before-play',
    };
    env.document.body.dataset.flightState = 'running';
    onPhase();
    for (let i = 1; i <= 120; i++) {
      now = (i * 1000) / 60;
      work.get('pre')();
      state.tick++;
      now += 1;
      work.get('post')();
      nextFrame((i * 1000) / 60);
    }
    env.document.body.dataset.flightState = 'paused';
    onPhase();
    now = 2200;
    listeners.get('click')?.({ isTrusted: true, target: { closest: () => ({}) } });
    env.document.body.dataset.flightState = 'running';
    onPhase();
    for (let i = 1; i <= 24; i++) {
      now = 2200 + (i * 1000) / 60;
      work.get('pre')();
      state.tick++;
      now += 1;
      work.get('post')();
      nextFrame(now);
    }
    env.document.body.dataset.flightState = 'paused';
    onPhase();
    return {
      snapshot: JSON.parse(JSON.stringify(env.soloQualificationProbe.export())),
      sceneReads,
      app: { baselineMs: cadence.baselineMs, cadenceCalibration: cadence },
    };
  };
  const plain = run(false),
    observed = run(true);
  const { readiness, ...unchanged } = observed.snapshot;
  assert(readiness, 'The actual qualifier must wire the explicit probe');
  assert.deepEqual(
    unchanged,
    plain.snapshot,
    'Default counters and raw phase attribution remain identical',
  );
  assert.equal(plain.sceneReads, 0);
  assert.equal(observed.sceneReads, 6, 'Only the six click/phase boundaries read the owner');
  assert.equal(readiness.records[4].kind, 'resumed-running');
  assert.equal(readiness.records[4].tick, 120, 'Resume observes paused tick before new simulation');
  assert.equal(
    readiness.records[1].tick,
    0,
    'The body MutationObserver runs before the modeled next simulation callback',
  );
  assert.equal(readiness.protocol, 'warm-resume-v1');
  assert.equal(assessReadinessGeometry([readiness], 'warm-resume-v1').status, 'passed');
  assert.equal(readiness.records.filter((r) => r.geometry).length, 2);
});
