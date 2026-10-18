import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
  READINESS_PILOT,
  qualificationReadinessOptions,
  createBrowserReadinessProbe,
  assessReadinessPilot,
} from './solo-qualification-readiness.mjs';
const fixture = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
    import.meta.url,
  ),
);
const flags = [
  '--readiness-probe=first-running-v1',
  `--source-revision=${READINESS_PILOT.sourceRevision}`,
  '--work-probe',
  '--hitch-journal',
  '--cadence=settled120',
];
test('readiness is absent by default and admitted only for the exact original cold source and recipe', () => {
  assert.equal(qualificationReadinessOptions([], {}, Buffer.from('{}')), null);
  assert.deepEqual(
    qualificationReadinessOptions(flags, JSON.parse(fixture), fixture),
    READINESS_PILOT,
  );
  for (const altered of [
    flags.filter((f) => f !== '--work-probe'),
    flags.filter((f) => f !== '--hitch-journal'),
    flags.filter((f) => f !== '--cadence=settled120'),
    flags.map((f) =>
      f.startsWith('--source-revision=') ? '--source-revision=' + 'a'.repeat(40) : f,
    ),
    [...flags, '--source-revision=' + READINESS_PILOT.sourceRevision],
    [...flags, '--readiness-probe=first-running-v1'],
    flags.map((f) => (f.startsWith('--readiness-probe=') ? '--readiness-probe' : f)),
    ...[
      '--memory-profile',
      '--audio-proof',
      '--cpu-profile',
      '--journal-cost-probe',
      '--baseline-runtime',
      '--snapshot-chunks',
      '--hitch-journal-preparation=first-return-anchored-v1',
    ].map((f) => [...flags, f]),
  ])
    assert.throws(() => qualificationReadinessOptions(altered, JSON.parse(fixture), fixture));
  assert.throws(() =>
    qualificationReadinessOptions(flags, { ...JSON.parse(fixture), timeoutMs: 240001 }, fixture),
  );
  assert.throws(() =>
    qualificationReadinessOptions(
      flags,
      JSON.parse(fixture),
      Buffer.concat([fixture, Buffer.from(' ')]),
    ),
  );
});
function harness({ serialized = false } = {}) {
  const callbacks = new Map(),
    windows = new Map();
  let time = 0,
    reads = 0;
  const run = { tick: 0, level: { id: 'first-return' } };
  let cadence = {
    samples: 9,
    required: 30,
    baselineMs: null,
    restartedSamples: 0,
    waiting: false,
    status: 'pending-quiet-preparation',
  };
  const scene = {
    lastPaint: { run },
    prepared: () => true,
    displayedBoardValid: true,
    preparedState: { run },
    submittedRun: run,
    cadence: {
      snapshot() {
        reads++;
        return { ...cadence };
      },
    },
  };
  const env = {
    performance: { now: () => time },
    document: {
      body: { dataset: { flightState: 'briefing' } },
      hidden: false,
      hasFocus: () => true,
      addEventListener: (name, cb) => callbacks.set(name, cb),
      removeEventListener: (name, cb) => {
        if (callbacks.get(name) === cb) callbacks.delete(name);
      },
    },
    addEventListener: (name, cb) => windows.set(name, cb),
    removeEventListener: (name, cb) => {
      if (windows.get(name) === cb) windows.delete(name);
    },
  };
  const make = serialized
    ? runInNewContext('(' + createBrowserReadinessProbe.toString() + ')', { TextEncoder })
    : createBrowserReadinessProbe;
  const probe = make(() => scene, env);
  return {
    probe,
    env,
    run,
    scene,
    callbacks,
    windows,
    get reads() {
      return reads;
    },
    click(trusted = true, relevant = true) {
      time++;
      callbacks.get('click')?.({
        isTrusted: trusted,
        target: { closest: () => (relevant ? {} : null) },
      });
    },
    ready() {
      cadence = {
        samples: 30,
        required: 30,
        baselineMs: 1000 / 90,
        restartedSamples: 9,
        waiting: false,
        status: 'measured-before-play',
      };
    },
    phase(phase) {
      time++;
      env.document.body.dataset.flightState = phase;
      probe.phase(phase);
    },
    app() {
      return { baselineMs: cadence.baselineMs, cadenceCalibration: { ...cadence } };
    },
  };
}
for (const serialized of [false, true])
  test(`passive readiness records actual boundaries without active exports (${serialized ? 'serialized' : 'direct'})`, () => {
    const h = harness({ serialized });
    h.phase('briefing');
    h.click(false);
    h.click(true, false);
    assert.equal(h.reads, 0);
    h.click();
    assert.equal(h.reads, 1);
    h.ready();
    h.phase('running');
    assert.equal(h.reads, 2);
    for (let i = 0; i < 5000; i++) h.probe.phase('running');
    assert.equal(h.reads, 2);
    assert.throws(() => h.probe.export(), /non-running/);
    h.phase('paused');
    const raw = JSON.parse(JSON.stringify(h.probe.export()));
    assert.equal(raw.records.length, 3);
    assert.equal(raw.records[1].tick, 0);
    assert.equal(raw.records[1].run, raw.records[0].run);
    const result = assessReadinessPilot(raw, h.app(), 1);
    assert.equal(result.status, 'passed');
    assert.equal(result.startBranch, 'incomplete-at-public-click-observed');
    assert.equal(result.performanceQualification, false);
    assert.equal(h.run.tick, 0, 'The observer never advances simulation');
    assert.equal(Buffer.byteLength(JSON.stringify(raw)) < 16384, true);
    raw.records[0].cadence.samples = 99;
    assert.equal(
      h.probe.export().records[0].cadence.samples,
      9,
      'Export copies cannot mutate retained evidence',
    );
  });
test('already completed Start is labeled without claiming the pending preparation branch', () => {
  const h = harness();
  h.ready();
  h.click();
  h.phase('running');
  h.phase('paused');
  assert.equal(
    assessReadinessPilot(h.probe.export(), h.app(), 1).startBranch,
    'already-ready-observed; pending-path-unobserved',
  );
});
test('a newly accepted title attempt is admitted only when its actual prepared and submitted owners agree', () => {
  const h = harness();
  h.click();
  const accepted = { tick: 0, level: { id: 'first-return' } };
  h.scene.lastPaint.run = accepted;
  h.scene.preparedState.run = accepted;
  h.scene.submittedRun = accepted;
  h.ready();
  h.phase('running');
  h.phase('paused');
  const raw = h.probe.export();
  assert.notEqual(raw.records[0].run, raw.records[1].run);
  assert.equal(assessReadinessPilot(raw, h.app(), 1).status, 'passed');
});
test('stale paint, invalidated preparation and unsubmitted boards cannot pass the readiness boundary', () => {
  for (const alter of [
    (h) => (h.scene.prepared = () => false),
    (h) => (h.scene.displayedBoardValid = false),
    (h) => (h.scene.preparedState.run = { tick: 0 }),
    (h) => (h.scene.submittedRun = { tick: 0 }),
    (h) => (h.scene.lastPaint.run = { tick: 0, level: { id: 'first-return' } }),
  ]) {
    const h = harness();
    h.click();
    h.ready();
    alter(h);
    h.phase('running');
    h.phase('paused');
    const result = assessReadinessPilot(h.probe.export(), h.app(), 1);
    assert.equal(result.status, 'failed');
    assert(result.failures.includes('accepted-prepared-board-submitted'));
  }
});
test('readiness remains failed for incomplete/changed baselines, late ticks, hidden or missing observations', () => {
  const h = harness();
  h.click();
  h.ready();
  h.phase('running');
  h.phase('paused');
  const raw = h.probe.export(),
    app = h.app();
  for (const change of [
    (r) => (r.records[1].cadence.samples = 29),
    (r) => (r.records[1].cadence.required = 29),
    (r) => (r.records[1].cadence.baselineMs = null),
    (r) => (r.records[1].cadence.baselineMs = 3),
    (r) => (r.records[1].cadence.baselineMs = 51),
    (r) => (r.records[1].cadence.waiting = true),
    (r) => (r.records[1].cadence.status = 'pending-quiet-preparation'),
    (r) => (r.records[1].tick = 1),
    (r) => (r.records[1].visible = false),
    (r) => (r.records[1].focused = false),
    (r) => (r.records[0].trusted = false),
    (r) => (r.records[0].atMs = -1),
    (r) => r.records.splice(0, 1),
    (r) => r.records.push({ ...r.records[1] }),
    (r) => (r.dropped = 1),
    (r) => (r.errors = 1),
    (r) => (r.extra = 'x'.repeat(16384)),
  ]) {
    const altered = structuredClone(raw);
    change(altered);
    assert.equal(assessReadinessPilot(altered, app, 1).status, 'failed');
  }
  assert.equal(assessReadinessPilot(raw, { ...app, baselineMs: 16.67 }, 1).status, 'failed');
  assert.equal(assessReadinessPilot(raw, app, 2).status, 'failed');
  assert.equal(assessReadinessPilot(null, app, 1).status, 'failed');
});
test('caps and cleanup preserve partial evidence and stop subsequent owner observations', () => {
  const h = harness();
  for (let i = 0; i < 12; i++) h.click();
  const raw = h.probe.export();
  assert.equal(raw.records.length, 8);
  assert.equal(raw.dropped, 4);
  assert.equal(assessReadinessPilot(raw, h.app(), 1).status, 'failed');
  h.windows.get('pagehide')();
  assert.equal(h.callbacks.size, 0);
  assert.equal(h.windows.size, 0);
  const before = h.reads;
  h.click();
  h.phase('running');
  assert.equal(h.reads, before);
  h.phase('paused');
  assert.equal(h.probe.export().disposed, true);
});

test('a late phase callback cannot pretend a later running snapshot proves first-tick readiness', () => {
  const h = harness();
  h.click();
  h.ready();
  h.run.tick = 1;
  h.phase('running');
  h.phase('paused');
  const result = assessReadinessPilot(h.probe.export(), h.app(), 1);
  assert.equal(result.status, 'failed');
  assert(result.failures.includes('initial-authoritative-tick'));
});

test('actual qualifier phase hook captures tick zero and keeps ordinary counters unchanged', async () => {
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
      preparedState: { run: state },
      submittedRun: state,
      cadence: { snapshot: () => ({ ...cadence }) },
    };
    const env = {
      performance: { now: () => now },
      document: {
        body: { dataset: { flightState: 'briefing' } },
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
    env.soloQualificationCreateReadinessProbe = (getScene) =>
      createBrowserReadinessProbe(getScene, env);
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
  assert.equal(observed.sceneReads, 3, 'Only click/first-running/paused boundaries read the owner');
  assert.equal(
    readiness.records[1].tick,
    0,
    'The body MutationObserver runs before the modeled next simulation callback',
  );
  assert.equal(assessReadinessPilot(readiness, observed.app, 1).status, 'passed');
});
