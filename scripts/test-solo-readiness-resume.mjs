import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
  RESUME_READINESS_PILOTS,
  COMPACT_WARM_READINESS_PILOT,
  qualificationReadinessOptions,
  createBrowserReadinessProbe,
  createResumeReplayEvidence,
  assessResumeReadiness,
} from './solo-qualification-readiness.mjs';
import { validateQualification } from './solo-qualification.mjs';
import { Document } from '../game/test/helpers/couch-dom.mjs';
import { attachSettingsPanels } from '../game/ui/settings-panels.mjs';
const clone = (value) => JSON.parse(JSON.stringify(value));
function harness(protocol, serialized = false) {
  let time = 0;
  const callbacks = new Map(),
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
  const scene = {
    lastPaint: { run },
    prepared: () => true,
    displayedBoardValid: true,
    preparedState: { run },
    submittedRun: run,
    cadence: { snapshot: () => ({ ...cadence }) },
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
  const probe = make(() => scene, env, protocol);
  return {
    probe,
    env,
    run,
    scene,
    cadence,
    callbacks,
    windows,
    click(at) {
      time = at;
      callbacks.get('click')({ isTrusted: true, target: { closest: () => ({}) } });
    },
    phase(phase, tick, at) {
      time = at;
      run.tick = tick;
      env.document.body.dataset.flightState = phase;
      probe.phase(phase);
    },
    app() {
      return { baselineMs: cadence.baselineMs, cadenceCalibration: { ...cadence } };
    },
  };
}
function replay(ticks, discrete = false) {
  return JSON.stringify({
    replay: {
      ticks,
      level: { id: 'first-return' },
      checkpoint: { algorithm: 'fixture-only', hash: 'tick-' + ticks },
      segments: [
        {
          ticks: 120,
          input: {
            direction: 'left',
            boost: false,
            action: false,
            pickup: false,
            switchClass: null,
          },
        },
        ...(ticks > 120
          ? [
              {
                ticks: ticks - 120,
                input: {
                  direction: 'left',
                  boost: false,
                  action: discrete,
                  pickup: false,
                  switchClass: null,
                },
              },
            ]
          : []),
      ],
    },
  });
}
function model(saved, serialized = false) {
  const protocol = saved ? 'saved-resume-v1' : 'warm-resume-v1',
    first = harness(protocol, serialized);
  first.click(10);
  first.phase('running', 0, 100);
  first.phase('paused', 120, 1100);
  const before = clone(first.probe.export()),
    initialApp = first.app();
  const evidence = createResumeReplayEvidence(protocol);
  evidence.observe('before-resume', replay(120));
  const last = saved ? harness(protocol, serialized) : first;
  if (saved) {
    first.probe.dispose();
    last.env.document.body.dataset.flightState = 'paused';
    last.run.tick = 120;
    evidence.observe('saved-restored', replay(120));
  }
  last.click(1500);
  last.phase('running', 120, 2000);
  last.phase('paused', 168, 2400);
  evidence.observe('after-resume', replay(168));
  evidence.finish();
  return {
    input: {
      protocol,
      documents: saved ? 2 : 1,
      observations: saved ? [before, clone(last.probe.export())] : [clone(last.probe.export())],
      applications: saved ? [initialApp, last.app(), last.app()] : [initialApp, last.app()],
      replayEvidence: clone(evidence.report),
      finalReplayText: replay(168),
    },
    first,
    last,
  };
}
for (const saved of [false, true])
  for (const serialized of [false, true])
    test(`${saved ? 'saved' : 'warm'} ${serialized ? 'serialized' : 'direct'} actual passive collector retains resumed run/tick and continuous direction`, () => {
      const { input, first, last } = model(saved, serialized),
        result = assessResumeReadiness(input);
      assert.equal(result.status, 'passed', JSON.stringify(result));
      assert.equal(result.neutralTicks, 48);
      assert.deepEqual(result.directions, ['left']);
      assert.equal(result.performanceQualification, false);
      assert.equal(
        input.observations.reduce((n, o) => n + o.records.length, 0),
        6,
      );
      assert.equal(first.probe.export().records.length, saved ? 3 : 6);
      last.phase('running', 168, 2500);
      assert.throws(() => last.probe.export(), /non-running/);
      last.probe.dispose();
      assert.equal(last.callbacks.size, 0);
      assert.equal(last.windows.size, 0);
    });
test('exact new source/recipe admission leaves original protocol separate', async () => {
  for (const mode of ['warm', 'saved']) {
    const b = await readFile(
      new URL(
        `../docs/performance/fixtures/solo-readiness-resume/${mode}.qualification.fixture`,
        import.meta.url,
      ),
    );
    const scenario = JSON.parse(b),
      protocol = `${mode}-resume-v1`,
      source = RESUME_READINESS_PILOTS[protocol].sourceRevision;
    validateQualification(scenario);
    const flags = [
      `--readiness-probe=${protocol}`,
      `--source-revision=${source}`,
      '--work-probe',
      '--hitch-journal',
      '--cadence=settled120',
    ];
    assert.equal(
      qualificationReadinessOptions(flags, scenario, b),
      RESUME_READINESS_PILOTS[protocol],
    );
    for (const altered of [
      flags.concat('--readiness-probe=' + protocol),
      flags.filter((f) => f !== '--hitch-journal'),
      flags.map((f) =>
        f.startsWith('--source-revision') ? '--source-revision=' + 'a'.repeat(40) : f,
      ),
      flags.concat('--audio-proof'),
    ])
      assert.throws(() => qualificationReadinessOptions(altered, scenario, b));
    assert.throws(() =>
      qualificationReadinessOptions(flags, scenario, Buffer.concat([b, Buffer.from(' ')])),
    );
    assert.throws(() =>
      qualificationReadinessOptions(flags, { ...scenario, timeoutMs: 240001 }, b),
    );
  }
});
test('warm rejects stale board, delayed phase tick, changed run/B and time debt without touching raw numerics', () => {
  const { input } = model(false);
  const mutations = [
    (q) => q.observations[0].records[4].tick++,
    (q) => q.observations[0].records[4].run++,
    (q) => (q.observations[0].records[4].preparedRunMatches = false),
    (q) => (q.observations[0].records[4].submittedRunMatches = false),
    (q) => (q.observations[0].records[4].displayedBoardValid = false),
    (q) => (q.observations[0].records[4].cadence.samples = 29),
    (q) => (q.observations[0].records[4].cadence.baselineMs = 16.7),
    (q) => (q.observations[0].records[4].visible = false),
    (q) => (q.observations[0].records[5].atMs = 2100),
    (q) => (q.observations[0].records[5].tick = 120),
    (q) => (q.applications[1].baselineMs = 20),
  ];
  for (const mutate of mutations) {
    const q = clone(input);
    mutate(q);
    assert.equal(assessResumeReadiness(q).status, 'failed');
  }
  assert.equal(assessResumeReadiness(input).status, 'passed');
});
test('saved requires exact two receipts before final play and positive complete second document', () => {
  const { input } = model(true);
  for (const mutate of [
    (q) => (q.documents = 1),
    (q) => q.observations.pop(),
    (q) => (q.replayEvidence.receipts[1].sha256 = 'a'.repeat(64)),
    (q) => (q.replayEvidence.restoration.status = 'failed'),
    (q) => q.observations[1].records[0].tick++,
    (q) => q.observations[1].records[1].tick++,
    (q) => (q.observations[1].records[2].tick = 120),
  ]) {
    const q = clone(input);
    mutate(q);
    assert.equal(assessResumeReadiness(q).status, 'failed');
  }
  const q = clone(input);
  q.observations[1].records.forEach((r) => (r.run = 9));
  assert.equal(
    assessResumeReadiness(q).status,
    'passed',
    'Document-local identities do not falsely require equality across reload',
  );
});
test('neutral replay check rejects discrete edges but permits persistent direction', () => {
  const { input } = model(false);
  const e = createResumeReplayEvidence(input.protocol);
  e.observe('before-resume', replay(120));
  e.observe('after-resume', replay(168, true));
  e.finish();
  input.replayEvidence = e.report;
  input.finalReplayText = replay(168, true);
  assert.equal(assessResumeReadiness(input).status, 'failed');
  assert(
    assessResumeReadiness(input).failures.includes(
      'neutral-discrete-replay-commands-through-resumed-window',
    ),
  );
});
test('source replay owner is bounded, preserves rejected identity and cannot skip or reuse final export', () => {
  const e = createResumeReplayEvidence('saved-resume-v1');
  e.observe('before-resume', replay(120));
  assert.throws(() => e.observe('saved-restored', replay(121)), /changed/);
  assert.equal(e.report.status, 'failed');
  assert.throws(() => e.finish());
  const w = createResumeReplayEvidence('warm-resume-v1');
  assert.throws(() => w.observe('after-resume', replay(168)), /order/);
  const complete = createResumeReplayEvidence('warm-resume-v1');
  complete.observe('before-resume', replay(120));
  complete.observe('after-resume', replay(168));
  complete.finish();
  assert.throws(() => complete.observe('after-resume', replay(168)));
});
test('aggregate bounds and explicit saturation fail instead of omitting earlier document evidence', () => {
  const { input } = model(true);
  for (const mutate of [
    (q) => (q.observations[0].dropped = 1),
    (q) => (q.observations[1].errors = 1),
    (q) => q.observations[0].records.push(...Array(6).fill(q.observations[0].records[0])),
    (q) => (q.observations[1].extra = 'x'.repeat(16384)),
  ]) {
    const q = clone(input);
    mutate(q);
    assert.equal(assessResumeReadiness(q).status, 'failed');
  }
});

test('actual qualifier forwards Resume mode and captures second running boundary before its first new tick', async () => {
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
    env.soloQualificationCreateReadinessProbe = (getScene, _environment, protocol) =>
      createBrowserReadinessProbe(getScene, env, protocol);
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
});

// Native dialog defaults/Escape stack are modeled; the actual compact Settings
// capture owner is used. This proves the route fix, not native actionability.
const warmClosureRows = [];
const original = JSON.parse(
  await readFile(
    new URL(
      '../docs/performance/fixtures/solo-readiness-resume/warm.qualification.fixture',
      import.meta.url,
    ),
  ),
);
const compactWarmBytes = await readFile(
  new URL(
    '../docs/performance/fixtures/solo-readiness-resume/warm-compact-v2.qualification.fixture',
    import.meta.url,
  ),
);
const candidate = JSON.parse(compactWarmBytes);
function fixture(width) {
  const doc = new Document();
  doc.defaultView.innerWidth = width;
  const home = doc.createElement('dialog');
  home.id = 'shell-home';
  doc.body.append(home);
  home.showModal();
  const settings = doc.createElement('dialog');
  settings.id = 'settings-dialog';
  settings.classList.add('native-settings');
  const close = doc.createElement('button');
  close.setAttribute('data-close', 'settings-dialog');
  close.onclick = () => settings.close();
  const list = doc.createElement('div');
  list.className = 'field-kit-settings-tabs';
  const tab = doc.createElement('button'),
    panel = doc.createElement('section');
  tab.id = 'settings-tab-extras';
  panel.id = 'settings-panel-extras';
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-controls', panel.id);
  list.append(tab);
  settings.append(close, list, panel);
  doc.body.append(settings);
  const owner = attachSettingsPanels({ root: settings, document: doc });
  settings.showModal();
  tab.click();
  const workshop = doc.createElement('dialog'),
    replay = doc.createElement('dialog');
  workshop.id = 'shell-workshop-dialog';
  replay.id = 'replay-dialog';
  doc.body.append(workshop, replay);
  workshop.showModal();
  replay.showModal();
  return { doc, home, settings, close, workshop, replay, owner };
}
function route(f, recipe) {
  const observed = [];
  for (const action of recipe.actions.slice(
    7,
    recipe.actions.findIndex(
      (a, i) => i > 7 && a.type === 'click' && a.selector === '#start-button',
    ),
  )) {
    if (action.type === 'click') {
      if (action.selector === '#replay-dialog .dialog-close[data-close="replay-dialog"]')
        f.replay.close();
      else if (action.selector === '[data-close="shell-workshop-dialog"]') f.workshop.close();
      else if (action.selector === '[data-close="settings-dialog"]') f.close.click();
      else {
        assert.equal(
          action.selector,
          '#settings-dialog[open][data-settings-view="categories"] button[data-close="settings-dialog"]',
        );
        assert.equal(action.optional, true);
        if (f.settings.open && f.settings.dataset.settingsView === 'categories') f.close.click();
      }
    } else if (action.type === 'key') {
      assert.equal(action.key, 'Escape');
      const top = [f.replay, f.workshop, f.settings, f.home].find((d) => d.open);
      assert(top);
      const e = top.emit('cancel', { bubbles: false });
      if (!e.defaultPrevented) top.close();
    } else if (action.type === 'expect') {
      if (action.selector === 'body:not(:has(#settings-dialog[open])) #shell-home[open]')
        assert(
          !f.settings.open && f.home.open,
          'Settings closed and Home open before existing Escape',
        );
      else {
        assert.equal(action.selector, 'body:not(:has(dialog[open])) #start-button:not(:disabled)');
        assert(
          ![f.home, f.settings, f.workshop, f.replay].some((d) => d.open),
          'No dialog may block resumed Start',
        );
      }
    } else throw Error('Unexpected closure action');
    observed.push({
      type: action.type,
      selector: action.selector ?? null,
      home: f.home.open,
      settings: f.settings.open,
      view: f.settings.dataset.settingsView,
      workshop: f.workshop.open,
      replay: f.replay.open,
    });
  }
  return observed;
}
test('only the existing compact public closure is inserted; entire active/replay/deadline workload is identical', () => {
  validateQualification(original);
  validateQualification(candidate);
  const restored = structuredClone(candidate);
  const inserted = restored.actions.splice(10, 2);
  assert.deepEqual(restored, original);
  assert.deepEqual(inserted, [
    {
      type: 'click',
      selector:
        '#settings-dialog[open][data-settings-view="categories"] button[data-close="settings-dialog"]',
      optional: true,
    },
    {
      type: 'expect',
      selector: 'body:not(:has(#settings-dialog[open])) #shell-home[open]',
      timeoutMs: 15000,
    },
  ]);
  assert.equal(candidate.timeoutMs, 240000);
  assert.equal(candidate.replayRequirements.movingTicks, 120);
  assert.equal(candidate.actions.find((a) => a.label === 'safe-border-before-pause').ms, 1200);
});
test('actual compact owner reproduces the retained warm route incomplete closure at400', () => {
  const f = fixture(400);
  try {
    assert.throws(() => route(f, original), /No dialog/);
    assert(f.home.open);
    assert.equal(f.settings.open, false);
    warmClosureRows.push({
      width: 400,
      recipe: 'original',
      result: 'failed-no-dialog-boundary',
      homeOpen: f.home.open,
    });
  } finally {
    f.owner.destroy();
  }
});
for (const width of [400, 1024])
  test(`corrected warm closure reaches the same paused Start boundary at${width}`, () => {
    const f = fixture(width);
    try {
      const actions = route(f, candidate);
      assert.equal(f.home.open, false);
      assert.equal(f.settings.open, false);
      warmClosureRows.push({
        width,
        recipe: 'corrected',
        result: 'passed-modeled-closure',
        actions,
      });
    } finally {
      f.owner.destroy();
    }
  });
test('original wide route stays valid; corrected conditional close does not add another close when Settings already closed', () => {
  const f = fixture(1024);
  try {
    route(f, original);
    assert(!f.home.open && !f.settings.open);
  } finally {
    f.owner.destroy();
  }
  const broken = structuredClone(candidate);
  broken.actions.splice(10, 1);
  const bad = fixture(400);
  try {
    assert.throws(() => route(bad, broken), /Settings closed/);
  } finally {
    bad.owner.destroy();
  }
});

test('compact warm239 requires the exact source, recipe and geometry opt-in; historical warm remains separate', () => {
  const flags = [
    '--readiness-probe=warm-resume-v1',
    '--source-revision=' + COMPACT_WARM_READINESS_PILOT.sourceRevision,
    '--readiness-geometry=phase-boundary-v1',
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
  ];
  assert.equal(
    qualificationReadinessOptions(flags, candidate, compactWarmBytes),
    COMPACT_WARM_READINESS_PILOT,
  );
  for (const changed of [
    flags.filter((x) => !x.startsWith('--readiness-geometry')),
    flags.concat('--readiness-geometry=phase-boundary-v1'),
    flags.map((x) =>
      x.startsWith('--source-revision')
        ? '--source-revision=e1cc5dd7656bab349715cd1c3ce6e9f783508c17'
        : x,
    ),
    flags.concat('--readiness-required-start=trusted-initial-start-v1'),
    flags.concat('--readiness-cancel-boundary=post-command-v3'),
  ])
    assert.throws(() => qualificationReadinessOptions(changed, candidate, compactWarmBytes));
  assert.throws(() =>
    qualificationReadinessOptions(flags, original, Buffer.from(JSON.stringify(original))),
  );
  assert.throws(() =>
    qualificationReadinessOptions(
      flags,
      candidate,
      Buffer.concat([compactWarmBytes, Buffer.from(' ')]),
    ),
  );
});
