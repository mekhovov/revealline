import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import {
  SELECTED_FONT_POST_COMMAND_PILOT,
  qualificationReadinessOptions,
  createBrowserReadinessProbe,
  assertSelectedFontPostCommandCancelled,
  assessSelectedFontPostCommandReadiness,
  assertSelectedFontCancelled,
  selectedFont,
} from './solo-qualification-readiness.mjs';
import { validateQualification } from './solo-qualification.mjs';
const clone = (value) => JSON.parse(JSON.stringify(value));
function model(serialized = false, protocol = 'selected-font-cancel-post-command-v3') {
  let at = 0,
    pending = true,
    preparation = 'idle',
    accepted = 'industrial',
    open = 0,
    selected = true;
  const face = { family: 'Field Kit Display', weight: '600', status: 'loading' };
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
    fonts: { check: () => true, [Symbol.iterator]: () => [face][Symbol.iterator]() },
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
    ? runInNewContext('(' + createBrowserReadinessProbe.toString() + ')', {
        TextEncoder,
        structuredClone,
      })
    : createBrowserReadinessProbe;
  const probe = make(() => scene, env, protocol, false, true);
  function click() {
    at += 10;
    callbacks.get('click')({ isTrusted: true, target: { closest: () => ({}) } });
  }
  click();
  preparation = 'busy';
  at += 10;
  const event = { isTrusted: true, code: 'Escape', repeat: false, defaultPrevented: false };
  callbacks.get('keydown')(event);
  // Native callback cleanup may flush the first listener before the app handler.
  while (microtasks.length) microtasks.shift()();
  preparation = 'cancelled';
  event.defaultPrevented = true;
  while (microtasks.length) microtasks.shift()();
  probe.cancelCommandComplete();
  const cancelled = clone(probe.export());
  assertSelectedFontPostCommandCancelled(cancelled);
  at += 500;
  pending = false;
  face.status = 'loaded';
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
    format: 'SoloSelectedFontHoldV2',
    requestPolicy: 'same-url-two-v2',
    maximumRequests: 2,
    ownedRouteCount: 0,
    rejectedOwned: 0,
    joinsClosed: true,
    routes: [{ index: 0, fulfillmentSettled: true, abortionSettled: false }],
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

test('V3 serialized collector preserves early busy state and proves fresh cancellation with exact loading/loaded face', () => {
  for (const serialized of [false, true]) {
    const m = model(serialized);
    assert.equal(m.observation.records.length, 8);
    assert.equal(m.cancelled.records[2].font.preparation, 'busy');
    assert.equal(m.cancelled.records[2].font.defaultPrevented, false);
    assert.equal(m.cancelled.records[3].font.preparation, 'cancelled');
    assert.equal(m.cancelled.records[1].font.loaded, true);
    const result = assessSelectedFontPostCommandReadiness(m.observation, m.app, 1, m.transport);
    assert.equal(result.status, 'passed', result.failures.join('; '));
    assert.throws(() => assertSelectedFontCancelled(m.cancelled));
    const exported = m.probe.export();
    exported.records[4].font.exactFontInventory.faces[0].status = 'loading';
    assert.equal(m.probe.export().records[4].font.exactFontInventory.faces[0].status, 'loaded');
  }
});
test('post-command, exact-face, source-run, readiness and ownership failures cannot pass V3', () => {
  const original = model();
  for (const change of [
    (m) => m.observation.records.splice(3, 1),
    (m) => (m.observation.records[3].font.preparation = 'busy'),
    (m) => (m.observation.records[3].font.defaultPrevented = false),
    (m) => (m.observation.records[3].cancelBoundary.defaultPrevented = false),
    (m) => (m.observation.records[3].tick = 1),
    (m) => m.observation.records[3].run++,
    (m) => (m.observation.records[3].trusted = false),
    (m) => (m.observation.records[3].cancelBoundary.exactFontInventory.faces = []),
    (m) => (m.observation.records[3].cancelBoundary.exactFontInventory.faces[0].weight = '400'),
    (m) => (m.observation.records[3].cancelBoundary.exactFontInventory.faces[0].status = 'loaded'),
    (m) => (m.observation.records[3].cancelBoundary.exactFontInventory.overflow = true),
    (m) => (m.observation.records[3].cancelBoundary.exactFontInventory.invalid = true),
    (m) => (m.observation.records[4].font.exactFontInventory.faces[0].status = 'loading'),
    (m) => (m.observation.records[4].phase = 'running'),
    (m) => (m.observation.records[6].preparedRunMatches = false),
    (m) => (m.observation.records[6].cadence.samples = 29),
    (m) => (m.observation.dropped = 1),
    (m) => (m.transport.ownedRouteCount = 1),
    (m) => (m.transport.responseDisposed = false),
  ]) {
    const m = clone(original);
    change(m);
    assert.equal(
      assessSelectedFontPostCommandReadiness(m.observation, m.app, 1, m.transport).status,
      'failed',
    );
  }
});
test('exact new source/recipe/flag admission preserves old fixture and rejects orphan/mixed/crossed controls', async () => {
  const bytes = await readFile(
    new URL(
      '../docs/performance/fixtures/solo-readiness-font/selected-font-cancel-post-command-v3.qualification.fixture',
      import.meta.url,
    ),
  );
  const scenario = JSON.parse(bytes);
  validateQualification(scenario);
  const flags = [
    '--readiness-probe=selected-font-cancel-post-command-v3',
    '--readiness-cancel-boundary=post-command-v3',
    '--source-revision=' + SELECTED_FONT_POST_COMMAND_PILOT.sourceRevision,
    '--work-probe',
    '--hitch-journal',
    '--cadence=settled120',
    '--server-fixture-access',
  ];
  assert.deepEqual(
    qualificationReadinessOptions(flags, scenario, bytes),
    SELECTED_FONT_POST_COMMAND_PILOT,
  );
  for (const changed of [
    flags.slice(1),
    flags.filter((f) => !f.startsWith('--readiness-cancel')),
    [...flags, flags[1]],
    [...flags, '--readiness-geometry=phase-boundary-v1'],
    [...flags, '--visual-quality-observation=public-preference-v1'],
    flags.map((f) =>
      f.startsWith('--source-revision')
        ? '--source-revision=c696af41857840359ae473558b90682f3d71f2db'
        : f,
    ),
  ])
    assert.throws(() => qualificationReadinessOptions(changed, scenario, bytes));
  const old = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-readiness-font/selected-font-cancel-joined-v2.qualification.fixture',
        import.meta.url,
      ),
    ),
  );
  assert.deepEqual(
    scenario.actions,
    old.actions,
    'Native action durations and public route unchanged',
  );
  assert.deepEqual(scenario.expectedReplayDefinition, old.expectedReplayDefinition);
  assert.deepEqual(scenario.replayRequirements, old.replayRequirements);
  assert.equal(scenario.timeoutMs, old.timeoutMs);
});
test('qualifier executes fresh capture only after the native key command and before the unchanged cancellation predicate', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const start = source.indexOf(
    "if (selectedFontPostCommand && action.label === 'public-cancel-back')",
  );
  assert(start > source.indexOf('await page.keyboard.up(action.key)'));
  const end = source.indexOf("if (action.label === 'public-cancelled')", start);
  const body = source.slice(start, end);
  assert(!/waitForTimeout|setTimeout|queueMicrotask/.test(body));
  const order = [];
  const page = {
    evaluate: async (fn) => {
      order.push('read');
      return runInNewContext('(' + fn.toString() + ')()', {
        window: {
          soloQualificationProbe: {
            completeSelectedFontCancellation: () => order.push('fresh'),
            export: () => ({ readiness: { records: ['new'] } }),
          },
        },
      });
    },
  };
  const report = {};
  await new Function(
    'page',
    'report',
    'save',
    'selectedFontPostCommand',
    'selectedFontSettlementOwner',
    'action',
    'return (async()=>{' + body + '})()',
  )(page, report, async () => order.push('save'), true, null, { label: 'public-cancel-back' });
  assert.deepEqual(order, ['read', 'fresh', 'read', 'save']);
  assert.deepEqual(JSON.parse(JSON.stringify(report.selectedFontPostCommandObservation)), {
    records: ['new'],
  });
});

test('actual qualifier report initializer forwards the admitted post-command policy and preserves other protocols', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('if (readinessOptions) {\n  report.readinessPilot = {');
  const end = source.indexOf('\nconst resumeReadiness', start);
  assert(start >= 0 && end > start);
  const initialize = (options) => {
    const report = {};
    runInNewContext(source.slice(start, end), { report, readinessOptions: options });
    return clone(report);
  };
  assert.deepEqual(initialize(null), {});
  const options = { ...SELECTED_FONT_POST_COMMAND_PILOT };
  const actual = initialize(options);
  assert.equal(actual.readinessPilot.protocol, 'selected-font-cancel-post-command-v3');
  assert.equal(actual.readinessPilot.cancelBoundaryObservation, 'post-command-v3');
  assert.equal(actual.readinessPilot.performanceQualification, false);
  assert.equal(Object.hasOwn(actual.readinessPilot, 'geometryObservation'), false);
  const old = initialize({ protocol: 'selected-font-cancel-joined-v2' });
  assert.equal(Object.hasOwn(old.readinessPilot, 'cancelBoundaryObservation'), false);
  const geometry = initialize({
    protocol: 'first-running-v1',
    geometryObservation: 'phase-boundary-v1',
  });
  assert.equal(geometry.readinessPilot.geometryObservation, 'phase-boundary-v1');
  assert.equal(Object.hasOwn(geometry.readinessPilot, 'cancelBoundaryObservation'), false);
  const broken = source
    .slice(start, end)
    .replace(/    \.\.\.\(readinessOptions\.cancelBoundaryObservation[\s\S]*?: \{\}\),\n/, '');
  assert.notEqual(broken, source.slice(start, end));
  const report = {};
  runInNewContext(broken, { report, readinessOptions: options });
  assert.equal(
    report.readinessPilot.cancelBoundaryObservation,
    undefined,
    'the retained failure is reproduced when the real forwarding hunk is absent',
  );
});
