import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { inspectReplayMechanics } from './solo-qualification-replay-core.mjs';
import {
  installQualificationUploadWitness,
  beginQualificationUploadWitness,
  readPublicQualificationReplay,
  qualificationControlReady,
  waitQualificationPreparation,
} from './solo-qualification-export.mjs';
import {
  assertReplayVerificationIdentity,
  verifyNativeQualificationReplay,
  replayVerificationRequestAllowed,
} from './solo-qualification-native-replay.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import {
  installAudioProof,
  evaluateAudioProof,
  observedMediaAdvancement,
} from './solo-qualification-audio.mjs';
import {
  readPrePlayReadiness,
  createRafIntervalClock,
  calibrateReadyCadence,
  observeLowWorkCadence,
  calibrateLowWorkCadence,
  frozenExternalCadence,
  externalQualificationBudgets,
  aggregateQualificationGates,
} from './solo-qualification-observation.mjs';
import {
  validateQualification,
  qualificationDisplayOptions,
  qualificationCacheMode,
  resourceStability,
  quantileBound,
  mirroredRequest,
  createManifestMirror,
  evaluateQualificationBudgets,
  memoryProfileSummary,
} from './solo-qualification.mjs';

const scenario = (actions, extra = {}) => ({
  format: 'SoloQualificationV1',
  id: 'bounded-test',
  kind: 'performance',
  timeoutMs: 10000,
  coverage: ['declared request, not observed mechanics'],
  actions,
  ...extra,
});

const preparationSelector = '[data-presentation-status="auxiliary"]';
function preparationPage(initial, settled = initial, failure = null) {
  let state = initial;
  const observed = { waits: 0, timeout: null };
  const evaluate = (fn, selector) => {
    assert.equal(selector, preparationSelector);
    return vm.runInNewContext(`(${fn.toString()})(selector)`, {
      selector,
      document: {
        URL: 'https://example.test/game/playground/',
        querySelector: () =>
          state === null
            ? null
            : { getAttribute: () => state, textContent: 'Public preparation message' },
      },
    });
  };
  return {
    observed,
    evaluate: async (...args) => evaluate(...args),
    waitForFunction: async (fn, selector, { timeout }) => {
      observed.waits++;
      observed.timeout = timeout;
      assert.equal(evaluate(fn, selector), false);
      state = settled;
      if (failure) throw failure;
      assert.equal(evaluate(fn, selector), true);
    },
  };
}

test('follow preparation accepts only bounded optional public status selectors', () => {
  const follow = { type: 'follow', selector: '#open-preview' };
  assert.doesNotThrow(() => validateQualification(scenario([follow])));
  assert.doesNotThrow(() =>
    validateQualification(
      scenario([{ ...follow, preparationStatusSelector: preparationSelector }]),
    ),
  );
  for (const preparationStatusSelector of ['', false, 'x'.repeat(4097)])
    assert.throws(() =>
      validateQualification(scenario([{ ...follow, preparationStatusSelector }])),
    );
  assert.throws(() =>
    validateQualification(
      scenario([{ ...follow, type: 'click', preparationStatusSelector: preparationSelector }]),
    ),
  );
});

test('follow preparation waits for public ready and retains its actual initial and final states', async () => {
  const page = preparationPage('busy', 'ready'),
    evidence = {};
  let elapsed = 0;
  await waitQualificationPreparation(page, preparationSelector, 1000, evidence, () => elapsed++);
  assert.equal(evidence.initial.state, 'busy');
  assert.equal(evidence.final.state, 'ready');
  assert.equal(evidence.initial.url, 'https://example.test/game/playground/');
  assert.equal(evidence.final.url, evidence.initial.url);
  assert.equal(evidence.status, 'ready');
  assert.equal(evidence.elapsedMs, 2);
  assert.equal(page.observed.timeout, 999);
  const alreadyReady = preparationPage('ready');
  await waitQualificationPreparation(alreadyReady, preparationSelector, 1000, {});
  assert.equal(alreadyReady.observed.waits, 0);
});

test('follow preparation fails both existing and newly reported public errors', async () => {
  for (const initial of ['error', 'busy']) {
    const page = preparationPage(initial, 'error'),
      evidence = {};
    await assert.rejects(
      waitQualificationPreparation(page, preparationSelector, 1000, evidence),
      /Public preparation failed: Public preparation message/,
    );
    assert.equal(evidence.status, 'failed');
    assert.equal(evidence.initial.state, initial);
    assert.equal(evidence.final.state, 'error');
    assert.equal(page.observed.waits, initial === 'error' ? 0 : 1);
  }
});

test('follow preparation retains missing or busy timeout evidence instead of treating absence as ready', async () => {
  for (const state of [null, 'busy']) {
    const failure = new Error('Observed preparation deadline'),
      page = preparationPage(state, state, failure),
      evidence = {};
    await assert.rejects(
      waitQualificationPreparation(page, preparationSelector, 1000, evidence),
      (error) => error === failure,
    );
    assert.equal(evidence.status, 'failed');
    assert.equal(evidence.initial.present, state !== null);
    assert.equal(evidence.final.state, state);
    assert.equal(evidence.failure, failure.message);
    assert(evidence.elapsedMs >= 0);
  }
});

test('follow preparation preserves the original failure when the departing page can no longer be read', async () => {
  const page = preparationPage('busy'),
    evidence = {},
    failure = new Error('Document closed during wait');
  page.waitForFunction = async () => {
    page.evaluate = async () => {
      throw new Error('Document unavailable');
    };
    throw failure;
  };
  await assert.rejects(
    waitQualificationPreparation(page, preparationSelector, 1000, evidence),
    (error) => error === failure,
  );
  assert.equal(evidence.initial.state, 'busy');
  assert.equal(evidence.final, null);
  assert.equal(evidence.finalReadFailure, 'Document unavailable');
  assert.equal(evidence.failure, failure.message);
});

test('public replay export refuses active play or a disabled ordinary control', async () => {
  const clicked = [];
  let phase = 'running';
  let disabled = null;
  const page = {
    locator: (selector) => ({
      getAttribute: async () => phase,
      waitFor: async ({ timeout }) => assert(timeout > 0 && timeout <= 1000),
      isEnabled: async () => selector !== disabled,
      isVisible: async () => true,
      click: async () => clicked.push(selector),
      inputValue: async () => '{"exact":"public bytes"}',
    }),
  };
  await assert.rejects(readPublicQualificationReplay(page, 1000), /after measured gameplay/);
  assert.deepEqual(clicked, []);
  phase = 'paused';
  disabled = '#export-replay';
  await assert.rejects(readPublicQualificationReplay(page, 1000), /control is disabled/);
  assert(!clicked.includes('#export-replay'));
  clicked.length = 0;
  disabled = null;
  assert.equal(await readPublicQualificationReplay(page, 1000), '{"exact":"public bytes"}');
  assert.deepEqual(clicked, [
    '#shell-menu',
    '#shell-options',
    '#settings-tab-extras',
    '#shell-workshop',
    '#export-replay',
  ]);
});

test('tool upload readiness requires an enabled non-inert non-busy public control', () => {
  const element = {
    disabled: false,
    closest: () => null,
    getClientRects: () => [{}],
    getAttribute: () => null,
  };
  assert.equal(qualificationControlReady(element), true);
  assert.equal(qualificationControlReady(null), false);
  assert.equal(qualificationControlReady({ ...element, disabled: true }), false);
  assert.equal(qualificationControlReady({ ...element, getClientRects: () => [] }), false);
  for (const boundary of ['inert', 'aria-busy', 'hidden'])
    assert.equal(
      qualificationControlReady({
        ...element,
        closest: (selector) => {
          assert(selector.includes(boundary));
          return {};
        },
      }),
      false,
    );
  assert.equal(qualificationControlReady({ ...element, getAttribute: () => 'true' }), false);
});

test('upload witnesses retain bounded native events without replacing handlers or files', () => {
  const listeners = new Map();
  const originalHandler = () => {};
  const originalFiles = [{}];
  const control = {
    onchange: originalHandler,
    files: originalFiles,
    addEventListener(type, listener, capture) {
      assert.equal(capture, true);
      listeners.set(type, listener);
    },
    removeEventListener(type, listener, capture) {
      assert.equal(capture, true);
      assert.equal(listeners.get(type), listener);
      listeners.delete(type);
    },
  };
  const owner = vm.runInNewContext(`(${installQualificationUploadWitness.toString()})`, {})(
    control,
    () => 42,
  );
  const invoke = listeners.get('change');
  listeners.get('input')({ type: 'input', isTrusted: true });
  invoke({ type: 'change', isTrusted: false });
  const observed = JSON.parse(JSON.stringify(owner.snapshot()));
  assert.deepEqual(observed, [
    { type: 'input', atMs: 42, isTrusted: true, selectedFiles: 1, changeHandlerPresent: true },
    { type: 'change', atMs: 42, isTrusted: false, selectedFiles: 1, changeHandlerPresent: true },
  ]);
  observed[0].type = 'altered-copy';
  assert.equal(owner.snapshot()[0].type, 'input');
  for (let index = 0; index < 20; index++) invoke({ type: 'change', isTrusted: true });
  assert.equal(owner.dispose().length, 8);
  assert.equal(listeners.size, 0);
  invoke({ type: 'change', isTrusted: true });
  assert.equal(owner.dispose().length, 8);
  assert.equal(control.onchange, originalHandler);
  assert.equal(control.files, originalFiles);
});

test('upload witness executes as a Playwright string expression instead of returning a function', async () => {
  const events = new Map();
  const control = {
    files: [{}],
    onchange() {},
    addEventListener: (name, handler) => events.set(name, handler),
    removeEventListener: (name) => events.delete(name),
  };
  const context = {
    window: {},
    document: {
      querySelector: (selector) => {
        assert.equal(selector, '#input-with-"quote');
        return control;
      },
    },
    performance: { now: () => 12 },
  };
  await beginQualificationUploadWitness(
    { evaluate: async (expression) => vm.runInNewContext(expression, context) },
    '#input-with-"quote',
  );
  assert.equal(events.size, 2);
  events.get('change')({ type: 'change', isTrusted: true });
  assert.equal(context.window.soloQualificationUploadWitness.dispose()[0].type, 'change');
  assert.equal(events.size, 0);
});

test('rAF intervals begin at the second callback and preserve later lifecycle gaps', () => {
  let clockReads = 0;
  const clock = vm.runInNewContext(`(${createRafIntervalClock.toString()})(64.8, readNow)`, {
    readNow: () => {
      clockReads++;
      return 65;
    },
  });
  assert.equal(clock.observe(60), null);
  assert.equal(clock.snapshot().timestampMs, 60);
  assert(Math.abs(clock.snapshot().registrationToFirstCallbackMs - 0.2) < 1e-10);
  assert(Math.abs(clock.snapshot().timestampMinusRegistrationMs + 4.8) < 1e-10);
  assert(Math.abs(clock.observe(76.7) - 16.7) < 1e-10);
  assert.equal(clock.observe(576.7), 576.7 - 76.7);
  assert(Math.abs(clock.observe(570) + 6.7) < 1e-10);
  assert.equal(clockReads, 1, 'Only the first callback needs a wall-clock read');
});

test('qualification accepts public input and rejects simulation writes or performance fault injection', () => {
  assert.equal(
    validateQualification(scenario([{ type: 'key', key: 'ArrowDown', ms: 100 }])).id,
    'bounded-test',
  );
  for (const action of [
    { type: 'evaluate', script: 'run.tick++' },
    { type: 'key', key: 'F12', ms: 100 },
    { type: 'fault', event: 'blur' },
  ])
    assert.throws(() => validateQualification(scenario([action])));
  assert.doesNotThrow(() =>
    validateQualification(
      scenario([{ type: 'fault', event: 'canvas-loss', selector: '#game-canvas canvas' }], {
        kind: 'recovery',
      }),
    ),
  );
});

test('bounded repeats cannot silently become an unbounded soak or ambiguous wait', () => {
  for (const actions of [
    [{ type: 'repeat', count: Infinity, actions: [{ type: 'wait', ms: 10 }] }],
    [
      {
        type: 'repeat',
        count: 1000,
        actions: [{ type: 'repeat', count: 1000, actions: [{ type: 'wait', ms: 10 }] }],
      },
    ],
    [{ type: 'wait', ms: 100, phase: 'running' }],
    [{ type: 'wait' }],
    [{ type: 'repeat', count: 1, atLeastMs: 9_000_000, actions: [{ type: 'wait', ms: 10 }] }],
  ])
    assert.throws(() => validateQualification(scenario(actions)));
});

test('resource plateaus require enough comparable finite samples and retain growth', () => {
  const rule = { group: 'same-result', path: 'resources.renderer.bytes', last: 3, maxRange: 0 };
  const row = (bytes, group = 'same-result') => ({
    group,
    application: { resources: { renderer: { bytes } } },
  });
  assert.equal(resourceStability([row(20), row(20)], [rule])[0].status, 'unobserved');
  assert.equal(resourceStability([row(20), row(20), row(null)], [rule])[0].status, 'unobserved');
  assert.equal(resourceStability([row(10), row(20), row(20), row(20)], [rule])[0].status, 'pass');
  const growing = resourceStability([row(20), row(21), row(22)], [rule])[0];
  assert.equal(growing.status, 'fail');
  assert.equal(growing.firstToLast, 2);
  assert.equal(
    resourceStability([row(20), row(20), row(20, 'different-size')], [rule])[0].status,
    'unobserved',
  );
});

test('histogram quantiles preserve finite bounds and an unbounded tail', () => {
  assert.equal(quantileBound(Array(11).fill(0), 0.95), null);
  assert.deepEqual(quantileBound([0, 0, 94, 6, 0, 0, 0, 0, 0, 0, 0], 0.95), {
    lowerExclusiveMs: 16.67,
    upperInclusiveMs: 20,
  });
  assert.deepEqual(quantileBound([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1], 0.99), {
    lowerExclusiveMs: 250,
    upperInclusiveMs: null,
  });
});

test('origin mirroring admits only the game prefix and local transport, leaving real same-origin catalogue paths untouched', () => {
  const publicURL = 'https://mekhovov.github.io/revealline/game/',
    localURL = 'http://127.0.0.1:8776/game/';
  assert.equal(
    mirroredRequest(
      'https://mekhovov.github.io/revealline/game/ui/a.mjs?revision=1',
      publicURL,
      localURL,
    ),
    'http://127.0.0.1:8776/game/ui/a.mjs?revision=1',
  );
  assert.equal(
    mirroredRequest(
      'https://mekhovov.github.io/revealline-soundtracks/catalogue.json',
      publicURL,
      localURL,
    ),
    null,
  );
  assert.equal(
    mirroredRequest('https://unrelated.invalid/revealline/game/a.mjs', publicURL, localURL),
    null,
  );
  assert.equal(
    mirroredRequest(
      'https://mekhovov.github.io/revealline/game/../private.json',
      publicURL,
      localURL,
    ),
    null,
  );
  assert.throws(() => mirroredRequest(publicURL, publicURL, 'https://unrelated.invalid/game/'));
});

test('resource path and navigation options cannot introduce prototype access or alternate protocols', () => {
  const actions = [{ type: 'snapshot', group: 'paused' }];
  for (const path of ['resources.__proto__.x', 'resources.constructor.x', 'window.secret'])
    assert.throws(() =>
      validateQualification(
        scenario(actions, { resourceRules: [{ group: 'paused', path, last: 3, maxRange: 0 }] }),
      ),
    );
  for (const entryPath of ['https://other.invalid/', '../other/', '/other/'])
    assert.throws(() => validateQualification(scenario(actions, { entryPath })));
});

test('frozen deployment mirroring includes authoring and blocks absent runtime paths instead of reading the current public site', () => {
  const mirror = createManifestMirror(
    {
      formatVersion: 1,
      entry: 'game/index.html',
      files: [
        'game/index.html',
        'game/ui/render.mjs',
        'authoring/motion-lab/render-character.mjs',
      ].map((path) => ({ path })),
    },
    'https://mekhovov.github.io/revealline/game/',
    'http://127.0.0.1:8776/game/',
  );
  assert.deepEqual(
    mirror('https://mekhovov.github.io/revealline/authoring/motion-lab/render-character.mjs'),
    {
      kind: 'local',
      path: 'authoring/motion-lab/render-character.mjs',
      url: 'http://127.0.0.1:8776/authoring/motion-lab/render-character.mjs',
    },
  );
  assert.equal(mirror('https://mekhovov.github.io/revealline/game/').path, 'game/index.html');
  assert.equal(
    mirror('https://mekhovov.github.io/revealline/game/new-runtime.mjs').kind,
    'blocked',
  );
  assert.equal(mirror('https://mekhovov.github.io/revealline/authoring/other.mjs').kind, 'blocked');
  assert.equal(mirror('https://mekhovov.github.io/other-project/runtime.mjs').kind, 'blocked');
  assert.equal(
    mirror('https://mekhovov.github.io/revealline-soundtracks/catalogue.json').kind,
    'remote',
  );
  assert.throws(() =>
    createManifestMirror(
      { formatVersion: 1, entry: 'game/index.html', files: [{ path: '../private' }] },
      'https://mekhovov.github.io/revealline/game/',
      'http://127.0.0.1:8776/game/',
    ),
  );
});

test('required mechanics cannot silently pass without a final public replay export', () => {
  assert.throws(() =>
    validateQualification(
      scenario([{ type: 'snapshot', group: 'paused' }], { replayRequirements: { eroded: 1 } }),
    ),
  );
  assert.doesNotThrow(() =>
    validateQualification(
      scenario([{ type: 'exportReplay' }], { replayRequirements: { eroded: 1 } }),
    ),
  );
});

const application = () => {
  const bounds = [1, 2, 4, 6, 8.34, 10, 12, 16.67, 20, 25, 33.34, 50, 100, 250, null];
  const stats = (bucket, count = 100) => ({
    count,
    maxMs: bounds[bucket],
    histogram: bounds.map((_, index) => (index === bucket ? count : 0)),
    missedOpportunities: 0,
    maxMissedStreak: 0,
  });
  return {
    enabled: true,
    baselineMs: 1000 / 60,
    cadenceCalibration: { status: 'measured-before-play' },
    histogramUpperBoundsMs: bounds,
    phases: { playing: { durationMs: 30000, frames: stats(7), work: stats(2) } },
    inputLatency: { byKind: { keyboard: { toRender: stats(8, 20) } } },
    interruptions: { count: 0 },
    failures: { count: 0 },
  };
};

test('numerical gates distinguish observed-window success from missing or provisional evidence', () => {
  assert.equal(evaluateQualificationBudgets(application()).status, 'pass-observed-window');
  assert.equal(evaluateQualificationBudgets(undefined).status, 'inconclusive');
  const provisional = application();
  provisional.cadenceCalibration.status = 'provisional-60hz';
  assert.equal(evaluateQualificationBudgets(provisional).status, 'inconclusive');
  const tinyInput = application();
  tinyInput.inputLatency.byKind.keyboard.toRender.count = 2;
  const result = evaluateQualificationBudgets(tinyInput);
  assert.equal(result.status, 'inconclusive');
  assert.equal(result.checks.find((row) => row.name.startsWith('keyboard')).status, 'unobserved');
  assert.equal(result.cohortStatus, 'not-evaluated');
});

test('numerical gates never turn a threshold-crossing histogram into an exact passing quantile', () => {
  const data = application();
  data.baselineMs = 15; // work budget9ms falls inside the (8.34,10] bucket.
  data.phases.playing.work.histogram = data.histogramUpperBoundsMs.map((_, i) =>
    i === 5 ? 100 : 0,
  );
  data.phases.playing.work.maxMs = 10;
  const result = evaluateQualificationBudgets(data);
  assert.equal(result.checks[0].status, 'inconclusive');
  assert.equal(result.checks[0].lowerExclusiveMs, 8.34);
  assert.equal(result.checks[0].upperInclusiveMs, 10);
  data.phases.playing.work.maxMs = 9;
  assert.equal(evaluateQualificationBudgets(data).checks[0].status, 'pass');
});

test('missed opportunities, overload failures and inclusive100ms tails remain visible', () => {
  const data = application();
  data.phases.playing.frames.missedOpportunities = 2;
  let result = evaluateQualificationBudgets(data);
  assert.equal(result.status, 'fail');
  assert.equal(result.checks.find((row) => row.name.includes('opportunity')).actual, 2 / 102);
  data.phases.playing.frames.missedOpportunities = 0;
  data.phases.playing.frames.histogram[7]--;
  data.phases.playing.frames.histogram[12]++;
  data.phases.playing.frames.maxMs = 100;
  result = evaluateQualificationBudgets(data);
  assert.equal(result.status, 'review-required');
  assert.match(result.review[0], />=100ms/);
  data.interruptions.count = 1;
  assert.equal(evaluateQualificationBudgets(data).status, 'fail');
});

test('heap/DOM profiles compare equivalent post-GC checkpoints without hiding missing native counters', () => {
  const row = (usedSize, group = 'same-result') => ({
    group,
    memory: {
      before: { heap: { usedSize: usedSize + 1000 } },
      after: {
        heap: { usedSize, totalSize: 2000 },
        dom: { documents: 1, nodes: 100, jsEventListeners: 10 },
      },
    },
  });
  const result = memoryProfileSummary(
    [row(100), row(200), row(300), row(999, 'different-size')],
    3,
  );
  assert.equal(result[0].counters['heap.usedSize'].firstToLast, 200);
  assert.equal(result[0].counters['heap.usedSize'].range, 200);
  assert.deepEqual(result[0].counters['heap.usedSize'].values, [100, 200, 300]);
  assert.equal(result[0].counters['heap.backingStorageSize'].status, 'unavailable');
  assert.equal(result[1].counters['heap.usedSize'].status, 'insufficient-comparable-samples');
  assert.equal(result[0].gateStatus, 'requires-owner-and-trend-review');
});

test('offline native-recording inspection verifies actual captures and rejects an unobserved mechanic or tampering', async () => {
  const { readFile } = await import('node:fs/promises');
  const { createRun, stepRun, FIXED_DT } = await import('../game/core/index.mjs');
  const { createRecorder, recordInput, exportReplay } = await import('../game/replay.mjs');
  const { inspectQualificationReplay, inspectQualificationReplayPortability } = await import(
    './solo-qualification-replay.mjs'
  );
  const campaign = JSON.parse(
    await readFile(new URL('../game/content/campaign.json', import.meta.url)),
  );
  const level = campaign.levels[0],
    options = { seed: 1 };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (const [direction, ticks] of [
    [null, 180],
    ['down', 469],
  ])
    for (let i = 0; i < ticks; i++) {
      if (['won', 'lost'].includes(run.status)) break;
      const input = { direction };
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
    }
  const replay = exportReplay(recorder, run);
  const inspected = inspectQualificationReplay(
    { replay },
    { closures: 1, maximumTrailCells: 20, movingTicks: 20 },
  );
  assert.equal(inspected.status, 'pass');
  assert.equal(inspected.outcome, 'won');
  assert(inspected.features.movingTicks >= 20);
  assert.equal(inspectQualificationReplay(replay, { movingTicks: 100000 }).status, 'fail');
  assert.equal(inspectQualificationReplay(replay, { eroded: 1 }).status, 'fail');
  const expected = { level: structuredClone(replay.level), options: { seed: 1 } };
  const exact = inspectQualificationReplayPortability(replay, { closures: 1 }, expected);
  assert.equal(exact.definitionCheck.match, true);
  assert.equal(exact.status, 'pass');
  const sameTitleWrongRules = structuredClone(expected);
  sameTitleWrongRules.level.rules.moveSpeed += 0.01;
  const wrong = inspectQualificationReplayPortability(replay, { closures: 1 }, sameTitleWrongRules);
  assert.equal(wrong.match, true, 'Recording itself remains strictly valid');
  assert.equal(wrong.features.closures, exact.features.closures);
  assert.equal(wrong.definitionCheck.actualLevelId, wrong.definitionCheck.expectedLevelId);
  assert.equal(wrong.definitionCheck.match, false);
  assert.equal(
    wrong.status,
    'fail',
    'Mechanic counts and matching title cannot qualify changed rules',
  );
  assert.equal(
    inspectQualificationReplayPortability(
      replay,
      {},
      {
        ...expected,
        options: { seed: 2 },
      },
    ).definitionCheck.match,
    false,
  );
  const tampered = structuredClone(replay);
  tampered.segments[0].ticks++;
  assert.throws(() => inspectQualificationReplay(tampered));
});

test('shared mechanic inspector uses only supplied artifact dependencies and never counts a rejected replay', () => {
  const diagnostics = [{ code: 'state-mismatch', section: 'enemies' }];
  let checked = 0;
  const dependencies = {
    verifyReplay(recording) {
      checked++;
      assert.equal(recording.checkpoint.hash, 'original');
      return { match: false, diagnostics, actual: { checkpoint: { hash: 'other' } } };
    },
    createRun() {
      assert.fail('Rejected recording must never produce mechanic counts');
    },
  };
  const recording = { replay: { checkpoint: { hash: 'original' } } };
  const original = JSON.stringify(recording);
  // The browser receives this exact function source, without Node imports or
  // access to the current checkout's simulation or demo compatibility helper.
  const result = vm.runInNewContext(
    `(${inspectReplayMechanics.toString()})(recording, requirements, dependencies)`,
    { recording, requirements: { closures: 1 }, dependencies },
  );
  assert.equal(checked, 1);
  assert.equal(result.match, false);
  assert.equal(result.status, 'fail');
  assert.equal(result.features, null);
  assert.equal(result.diagnostics, diagnostics);
  assert.equal(JSON.stringify(recording), original);
});

test('same-engine verification rejects changed version, artifact, origin or CSP and an open observation browser', async () => {
  const expected = {
    browserVersion: '155.0.8059.80',
    buildIdentity: {
      sourceRevision: 'a'.repeat(40),
      sha256: 'b'.repeat(64),
      url: 'http://127.0.0.1:8777/game/build-info.json',
    },
    csp: PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
  };
  const actual = { ...structuredClone(expected), url: expected.buildIdentity.url };
  assert.doesNotThrow(() => assertReplayVerificationIdentity(expected, actual));
  for (const replacement of [
    { browserVersion: '155.0.8059.81' },
    { buildIdentity: { ...actual.buildIdentity, sourceRevision: 'c'.repeat(40) } },
    { buildIdentity: { ...actual.buildIdentity, sha256: 'd'.repeat(64) } },
    { url: 'http://127.0.0.1:8778/game/build-info.json' },
    { csp: 'default-src *' },
  ])
    assert.throws(() => assertReplayVerificationIdentity(expected, { ...actual, ...replacement }));
  assert.throws(() =>
    assertReplayVerificationIdentity({ ...expected, browserVersion: null }, actual),
  );
  let launches = 0;
  await assert.rejects(
    verifyNativeQualificationReplay({
      observedBrowserClosed: false,
      playwright: {
        chromium: {
          launch() {
            launches++;
          },
        },
      },
    }),
    /Close the gameplay browser/,
  );
  assert.equal(launches, 0);
});

test('verification admits original vendor JS and sibling artifact modules but never boots another game document', () => {
  const identity = 'https://example.test/deploy/game/build-info.json';
  for (const path of [
    '/deploy/game/replay.mjs',
    '/deploy/game/vendor/i18next-26.4.2.min.js',
    '/deploy/authoring/shared.mjs',
  ])
    assert.equal(
      replayVerificationRequestAllowed(identity, new URL(path, identity).href, 'script'),
      true,
    );
  assert.equal(replayVerificationRequestAllowed(identity, identity, 'document'), true);
  for (const path of [
    '/deploy/game/',
    '/deploy/game/index.html',
    '/deploy/game/app.mjs',
    '/other/shared.mjs',
    '/deploy/game/recording.mp3',
  ])
    assert.equal(
      replayVerificationRequestAllowed(identity, new URL(path, identity).href, 'script'),
      false,
    );
  assert.equal(
    replayVerificationRequestAllowed(
      identity,
      'https://other.test/deploy/game/replay.mjs',
      'script',
    ),
    false,
  );
  assert.equal(
    replayVerificationRequestAllowed(
      identity,
      'https://example.test/deploy/game/replay.mjs',
      'document',
    ),
    false,
  );
});

test('packaged title cadence accepts the actual launch without inventing asset readiness', () => {
  const controls = new Map();
  const marker = { content: JSON.stringify({ packageConsent: true }) };
  const document = {
    documentElement: { dataset: { bootState: 'ready' } },
    body: { dataset: { flightState: 'briefing', pictureState: 'pending' } },
    hidden: false,
    visibilityState: 'visible',
    defaultView: {
      getComputedStyle: (element) => ({ visibility: element.visibility ?? 'visible' }),
    },
    querySelector: (selector) => (selector.startsWith('meta[') ? marker : controls.get(selector)),
  };
  const button = (options = {}) => ({
    disabled: false,
    hidden: false,
    getClientRects: () => [{}],
    getAttribute: () => null,
    ...options,
  });
  controls.set('#shell-featured', button());
  controls.set('#start-button', button({ disabled: true, getClientRects: () => [] }));
  // Execute the exact self-contained source installed in the native page.
  const installed = vm.runInNewContext(`(${readPrePlayReadiness.toString()})()`, { document });
  assert.equal(installed.ready, true);
  assert.equal(installed.publicLaunch, '#shell-featured');
  assert.equal(installed.pictureReady, false);
  assert.equal(installed.preparationDeferredToStart, true);
  assert.equal(
    calibrateReadyCadence(Array(30).fill(16.67), installed).status,
    'measured-before-play',
  );
  controls.get('#shell-featured').disabled = true;
  assert.equal(readPrePlayReadiness(document).ready, false);
  controls.clear();
  assert.equal(readPrePlayReadiness(document).ready, false);
  controls.set('#start-button', button());
  marker.content = '{';
  assert.equal(readPrePlayReadiness(document).ready, false);
  document.body.dataset.pictureState = 'ready';
  assert.equal(readPrePlayReadiness(document).ready, true);
  document.hidden = true;
  assert.equal(readPrePlayReadiness(document).ready, false);
  document.hidden = false;
  document.body.dataset.flightState = 'running';
  assert.equal(readPrePlayReadiness(document).ready, false);
  document.body.dataset.flightState = 'briefing';
  controls.get('#start-button').visibility = 'hidden';
  assert.equal(readPrePlayReadiness(document).ready, false);
});

test('pre-play calibration keeps unstable, incomplete and active windows provisional', () => {
  const ready = { ready: true, phase: 'briefing', picture: 'ready' };
  const stable = calibrateReadyCadence(Array(30).fill(1000 / 60), ready);
  assert.equal(stable.status, 'measured-before-play');
  assert.equal(stable.baselineMs, 1000 / 60);
  const disturbed = Array(30).fill(1000 / 60);
  disturbed[5] = 80;
  const result = calibrateReadyCadence(disturbed, ready);
  assert.equal(result.status, 'provisional-unstable');
  assert.equal(result.maximumMs, 80);
  assert.equal(calibrateReadyCadence(Array(29).fill(16.7), ready).status, 'provisional-incomplete');
  assert.equal(
    calibrateReadyCadence(Array(30).fill(16.7), { ready: true, phase: 'running' }).status,
    'provisional-unstable',
  );
});

function lowWorkBrowser() {
  let clock = 5,
    scheduled,
    timer,
    focused = true,
    frameCount = 0;
  const listeners = new Map();
  const environment = {
    location: { href: 'about:blank' },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    performance: { now: () => clock },
    requestAnimationFrame(callback) {
      scheduled = callback;
      frameCount++;
      return frameCount;
    },
    cancelAnimationFrame: () => (scheduled = null),
    setTimeout: (callback) => (timer = callback),
    clearTimeout: () => (timer = null),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    document: {
      hidden: false,
      visibilityState: 'visible',
      hasFocus: () => focused,
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
    },
  };
  return {
    environment,
    listeners,
    frame(timestamp) {
      clock = timestamp + 10;
      const callback = scheduled;
      scheduled = null;
      callback?.(timestamp);
    },
    blur() {
      focused = false;
      listeners.get('blur')?.();
      focused = true;
    },
    timeout() {
      clock = 5005;
      timer?.();
    },
    scheduled: () => scheduled,
    frameCount: () => frameCount,
  };
}

test('low-work cadence uses one fixed foreground window with first callback retained separately', async () => {
  const fake = lowWorkBrowser();
  // The exact function is serialized into a blank browser page, without imports.
  const pending = vm.runInNewContext(`(${observeLowWorkCadence.toString()})()`, fake.environment);
  fake.frame(0);
  for (let index = 1; index <= 30; index++) fake.frame(index * (1000 / 60));
  const observation = await pending;
  assert.equal(observation.samples.length, 30);
  assert.equal(observation.firstRafCallback.timestampMinusRegistrationMs, -5);
  assert.equal(observation.firstRafCallback.registrationToFirstCallbackMs, 5);
  assert(observation.samples.every((value) => value > 16 && value < 17));
  assert.equal(fake.frameCount(), 31);
  assert.equal(fake.scheduled(), null);
  assert.equal(fake.listeners.size, 0);
  const calibration = calibrateLowWorkCadence(observation);
  assert.equal(calibration.status, 'measured-before-play');
  assert.equal(calibration.protocol, 'foreground-about-blank-fixed-30-v1');
  assert.match(calibration.scope, /not physical refresh rate/);
  const firstDocument = frozenExternalCadence(calibration);
  const reloadedDocument = frozenExternalCadence(structuredClone(calibration));
  assert.equal(firstDocument.baselineMs, reloadedDocument.baselineMs);
  assert.throws(() => (firstDocument.baselineMs = 50), TypeError);
  // A busy title window is separate evidence and cannot replace external B.
  const busyTitle = calibrateReadyCadence([300, ...Array(29).fill(16.67)], {
    ready: true,
    phase: 'briefing',
  });
  assert.equal(busyTitle.status, 'provisional-unstable');
  assert.equal(firstDocument.baselineMs, calibration.baselineMs);
});

test('low-work cadence retains instability, transient focus loss and deadline without retry', async () => {
  for (const failure of [
    'unstable',
    'blur',
    'timeout',
    'changed-viewport',
    'restored-viewport',
    'restored-dpr',
    'nonpositive',
  ]) {
    const fake = lowWorkBrowser();
    const pending = observeLowWorkCadence({}, fake.environment);
    fake.frame(0);
    let timestamp = 0;
    for (let index = 1; index <= 30; index++) {
      if (index === 4 && failure === 'blur') fake.blur();
      if (index === 4 && failure === 'changed-viewport') fake.environment.innerWidth = 400;
      if (index === 4 && failure === 'restored-viewport') {
        fake.environment.innerWidth = 400;
        fake.listeners.get('resize')();
        fake.environment.innerWidth = 1280;
        fake.listeners.get('resize')();
      }
      if (index === 4 && failure === 'restored-dpr') {
        fake.environment.devicePixelRatio = 3;
        fake.listeners.get('resize')();
        fake.environment.devicePixelRatio = 1;
        fake.listeners.get('resize')();
      }
      if (index === 4 && failure === 'timeout') {
        fake.timeout();
        break;
      }
      timestamp += index === 4 && failure === 'unstable' ? 100 : 1000 / 60;
      fake.frame(index === 4 && failure === 'nonpositive' ? timestamp - 1000 / 60 : timestamp);
    }
    const observation = await pending;
    const calibration = calibrateLowWorkCadence(observation);
    assert.notEqual(calibration.status, 'measured-before-play', failure);
    assert.equal(frozenExternalCadence(calibration).baselineMs, null, failure);
    assert.equal(fake.scheduled(), null);
    assert.equal(fake.listeners.size, 0);
    if (failure === 'timeout') {
      assert.equal(observation.deadlineReached, true);
      assert.equal(observation.samples.length, 3);
      assert.equal(fake.frameCount(), 5);
    } else assert.equal(observation.samples.length, 30);
  }
});

test('external baseline gates never synthesize missing internal counters or exact truncated quantiles', () => {
  const bounds = [2, 4, 8.34, 16.67, 20, 33.34, 100, null];
  const probe = {
    phases: ['running'],
    bounds,
    totals: [100, 1667, 16.67, 0, 0],
    counts: [[0, 0, 0, 100, 0, 0, 0, 0]],
    missed: [0, 0, 0],
    calibration: calibrateReadyCadence(Array(30).fill(1000 / 60), {
      ready: true,
      phase: 'briefing',
    }),
    work: {
      bounds,
      width: 11,
      count: 100,
      omittedCount: 0,
      totals: [100, 200, 2, 100, 0, 0, 0, 0, 0, 0, 0],
      recent: Array.from({ length: 100 }, () => [2, 0]).flat(),
    },
  };
  const result = externalQualificationBudgets(probe);
  assert.equal(result.status, 'pass-observed-external-window');
  assert.equal(result.checks.length, 4);
  assert.equal(result.exactRunningWork.p95Ms, 2);
  assert(result.unobserved.some((text) => text.includes('input')));
  probe.work.omittedCount = 1;
  assert.equal(externalQualificationBudgets(probe).exactRunningWork, null);
  probe.calibration.status = 'provisional-unstable';
  assert.equal(externalQualificationBudgets(probe).status, 'inconclusive');
});

test('audio identity scenarios require bounded valid hashes and no-input transition windows', () => {
  const hash = 'a'.repeat(64);
  assert.doesNotThrow(() =>
    validateQualification(
      scenario(
        [
          { type: 'audio-ready', recordedHashes: [hash], fallbackMs: 5000, timeoutMs: 30000 },
          { type: 'result', outcome: 'won', timeoutMs: 20000 },
        ],
        { audioRequirements: { recordedHashes: [hash] } },
      ),
    ),
  );
  for (const extra of [
    { recordedHashes: ['invalid'] },
    { recordedHashes: [hash, hash] },
    { streamedHashes: [hash], naturalTransitionsAtLeast: 1 },
    { recordedHashes: [hash], misspelledAdvanceSeconds: 1 },
  ])
    assert.throws(() =>
      validateQualification(
        scenario([{ type: 'snapshot', group: 'paused' }], { audioRequirements: extra }),
      ),
    );
  assert.throws(() =>
    validateQualification(
      scenario([{ type: 'click', selector: '#next', label: 'natural-music-transition' }]),
    ),
  );
  assert.throws(() =>
    validateQualification(scenario([{ type: 'audio-ready', recordedHashes: [hash] }])),
  );
});

test('recording identity requires resolved original bytes and actual gameplay start, not preference or preview', () => {
  const sha256 = 'a'.repeat(64),
    requirements = { recordedHashes: [sha256] };
  const proof = {
    sources: [{ id: 0, status: 'pending', sha256 }],
    starts: [{ sourceId: 0, phase: 'running' }],
    mediaEvents: [],
  };
  assert.equal(evaluateAudioProof(null, requirements).status, 'unobserved');
  assert.equal(evaluateAudioProof(proof, requirements).status, 'unobserved');
  proof.sources[0].status = 'resolved';
  proof.starts[0].phase = 'paused';
  assert.equal(evaluateAudioProof(proof, requirements).status, 'unobserved');
  proof.starts[0].phase = 'picture';
  assert.equal(evaluateAudioProof(proof, requirements).status, 'pass');
});

test('stream proof requires advancing exact recordings and a near-end switch inside an input-free window', () => {
  const first = 'a'.repeat(64),
    second = 'b'.repeat(64);
  const event = (sourceId, atMs, name, currentTime, duration = 60) => ({
    sourceId,
    element: sourceId,
    event: name,
    atMs,
    currentTime,
    duration,
  });
  const proof = {
    sources: [
      { id: 0, status: 'resolved', sha256: first },
      { id: 1, status: 'resolved', sha256: second },
    ],
    starts: [],
    windows: [{ label: 'natural-music-transition', startMs: 10000, endMs: 70000 }],
    mediaEvents: [
      event(0, 0, 'playing', 0),
      event(0, 2000, 'timeupdate', 2),
      event(1, 5000, 'playing', 0, 44.5),
      event(1, 10000, 'window-start', 5, 44.5),
      event(1, 45000, 'timeupdate', 40, 44.5),
      event(1, 45500, 'timeupdate', 40.5, 44.5),
      event(0, 46000, 'playing', 0),
      event(0, 48000, 'timeupdate', 2),
    ],
  };
  const requirements = {
    streamedHashes: [first, second],
    minimumAdvanceSeconds: 1,
    naturalTransitionsAtLeast: 1,
  };
  assert.equal(evaluateAudioProof(proof, requirements).status, 'pass');
  assert.equal(
    evaluateAudioProof(proof, requirements).checks.at(-1).transitions[0].mechanism,
    'near-end-overlap',
  );
  const missingWindow = { ...proof, windows: [] };
  assert.equal(evaluateAudioProof(missingWindow, requirements).status, 'unobserved');
  const earlyManualSwitch = {
    ...proof,
    mediaEvents: proof.mediaEvents.map((row) =>
      row.sourceId === 1 ? { ...row, duration: 90 } : row,
    ),
  };
  assert.equal(evaluateAudioProof(earlyManualSwitch, requirements).status, 'unobserved');
  const staticSecond = {
    ...proof,
    mediaEvents: proof.mediaEvents.map((row) =>
      row.sourceId === 1 ? { ...row, currentTime: 0 } : row,
    ),
  };
  assert.equal(evaluateAudioProof(staticSecond, requirements).status, 'unobserved');
});

test('explicit audio probe preserves native promises and links decoded buffers after asynchronous hashing', async () => {
  const buffer = { duration: 1, sampleRate: 48000, numberOfChannels: 1 };
  let nativePromise,
    nativeStarts = 0,
    nextURL = 0;
  class Context {
    decodeAudioData(_bytes, success) {
      nativePromise = Promise.resolve(buffer);
      nativePromise.then(success);
      return nativePromise;
    }
  }
  class Source {
    start() {
      nativeStarts++;
    }
  }
  class Media {
    play() {
      return Promise.resolve();
    }
  }
  const sandbox = {
    window: { AudioContext: Context },
    document: { body: { dataset: { flightState: 'running' } } },
    AudioBufferSourceNode: Source,
    HTMLMediaElement: Media,
    URL: { createObjectURL: () => `blob:${nextURL++}` },
    crypto: webcrypto,
    performance: { now: () => 1 },
    Uint8Array,
    Map,
    WeakMap,
    Set,
  };
  vm.runInNewContext(`(${installAudioProof.toString()})()`, sandbox);
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const pending = new Context().decodeAudioData(bytes);
  assert.equal(pending, nativePromise);
  const decoded = await pending;
  const player = new Source();
  player.buffer = decoded;
  player.start();
  assert.equal(nativeStarts, 1);
  let proof;
  for (let i = 0; i < 100; i++) {
    proof = sandbox.window.soloAudioProof.export();
    if (proof.sources[0].status === 'resolved') break;
    await new Promise((done) => setTimeout(done, 1));
  }
  assert.equal(proof.sources[0].decoded, true);
  assert.equal(proof.starts[0].sourceId, 0);
  assert.equal(
    proof.sources[0].sha256,
    '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
  );
  assert.equal(sandbox.window.soloAudioProof.recordingsReady([proof.sources[0].sha256]), true);
  assert.equal(
    evaluateAudioProof(proof, { recordedHashes: [proof.sources[0].sha256] }).status,
    'pass',
  );
  sandbox.URL.createObjectURL({ type: 'application/vnd.revealline.soundtrack', size: 3 });
  assert.equal(
    sandbox.window.soloAudioProof.export().sources.length,
    1,
    'Container upload is not a recording identity',
  );
});

test('audio identity keeps the baseline bank observable without exceeding source or byte bounds', async () => {
  function probe() {
    let nativeCalls = 0;
    class Context {
      decodeAudioData() {
        nativeCalls++;
        return Promise.resolve({ duration: 1 });
      }
    }
    class Media {
      play() {
        return Promise.resolve();
      }
    }
    const sandbox = {
      window: { AudioContext: Context },
      document: { body: { dataset: { flightState: 'briefing' } } },
      HTMLMediaElement: Media,
      URL: { createObjectURL: () => 'blob:bounded-test' },
      crypto: webcrypto,
      performance: { now: () => 1 },
      Uint8Array,
    };
    vm.runInNewContext(`(${installAudioProof.toString()})()`, sandbox);
    return {
      context: new Context(),
      proof: sandbox.window.soloAudioProof,
      calls: () => nativeCalls,
    };
  }
  const bank = probe();
  for (let i = 0; i < 129; i++) await bank.context.decodeAudioData(new Uint8Array([i]).buffer);
  let report;
  for (let i = 0; i < 100; i++) {
    report = bank.proof.export();
    if (report.sources.every((row) => row.status === 'resolved')) break;
    await new Promise((done) => setTimeout(done, 1));
  }
  assert.equal(bank.calls(), 129, 'Instrumentation never suppresses the native decoder');
  assert.equal(report.sources.length, 128);
  assert.equal(report.capped, 1);
  assert.equal(report.copiedBytes, 128);
  assert.equal(report.sources[94].decoded, true);
  assert.equal(bank.proof.recordingsReady([report.sources[94].sha256]), true);
  assert.equal(report.limits.sources, 128);
  const bytes = probe();
  await bytes.context.decodeAudioData(new ArrayBuffer(2 * 1024 ** 2 + 1));
  assert.equal(bytes.proof.export().copiedBytes, 0, 'Per-source bound rejects before copying');
  for (let i = 0; i < 8; i++) await bytes.context.decodeAudioData(new ArrayBuffer(2 * 1024 ** 2));
  await bytes.context.decodeAudioData(new ArrayBuffer(1));
  assert.equal(bytes.calls(), 10);
  assert.equal(bytes.proof.export().copiedBytes, 16 * 1024 ** 2);
  assert.equal(bytes.proof.export().sources.length, 8);
  assert.equal(
    bytes.proof.export().capped,
    2,
    'Aggregate byte limit remains independent of source capacity',
  );
});

test('display arguments preserve defaults and label bounded desktop mobile-layout stress', () => {
  assert.deepEqual(qualificationDisplayOptions([]), {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  assert.deepEqual(
    qualificationDisplayOptions(['--viewport=400x850', '--dpr=3', '--mobile-context']),
    { viewport: { width: 400, height: 850 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  );
  for (const flags of [
    ['--viewport'],
    ['--viewport=400'],
    ['--viewport=0x850'],
    ['--viewport=400x99999'],
    ['--viewport=400x850', '--viewport=800x600'],
    ['--viewport=3840x2160', '--dpr=4'],
    ['--dpr'],
    ['--dpr='],
    ['--dpr=Infinity'],
    ['--dpr=0'],
    ['--dpr=5'],
    ['--dpr=1', '--dpr=2'],
    ['--mobile-context=false'],
  ])
    assert.throws(() => qualificationDisplayOptions(flags));
});

test('combined gates retain every unresolved requested component and never hide an external review', () => {
  const application = { status: 'pass-observed-window' },
    external = { status: 'pass-observed-external-window' };
  assert.equal(
    aggregateQualificationGates({ application, external, workProbe: true }).status,
    'pass-observed-window',
  );
  for (const status of [
    'inconclusive',
    'unobserved',
    'review-required',
    'fail',
    'invalid-evidence',
  ]) {
    const result = aggregateQualificationGates({
      application,
      external: { status },
      workProbe: true,
    });
    assert.equal(
      result.status,
      ['unobserved', 'inconclusive'].includes(status) ? 'inconclusive' : status,
    );
    assert.deepEqual(result.unresolved, [{ source: 'external-work-probe', status }]);
  }
  const both = aggregateQualificationGates({
    application: { status: 'inconclusive' },
    external: { status: 'review-required' },
    workProbe: true,
  });
  assert.equal(both.status, 'review-required');
  assert.equal(both.unresolved.length, 2);
  assert.equal(
    aggregateQualificationGates({ application, external, workProbe: true, baselineRuntime: true })
      .status,
    'partial-baseline-internal-unknown',
  );
  assert.equal(
    aggregateQualificationGates({
      application,
      external: { status: 'inconclusive' },
      workProbe: true,
      baselineRuntime: true,
    }).status,
    'inconclusive',
  );
  assert.equal(
    aggregateQualificationGates({ application, workProbe: true }).status,
    'inconclusive',
  );
  assert.equal(aggregateQualificationGates({ application }).status, 'pass-observed-window');
  assert.equal(
    aggregateQualificationGates({
      application: { status: 'fail' },
      applicationAvailable: true,
      baselineRuntime: true,
      external,
      workProbe: true,
    }).status,
    'fail',
  );
});

test('stream progress rejects backward resets and seeks while retaining a chronological native-play witness', () => {
  const event = (event, atMs, currentTime) => ({
    event,
    atMs,
    currentTime,
    sourceId: 0,
    element: 0,
    playbackRate: 1,
  });
  assert.equal(
    observedMediaAdvancement([
      event('playing', 0, 50),
      event('timeupdate', 1000, 50),
      event('pause', 2000, 0),
    ]).seconds,
    0,
  );
  assert.equal(
    observedMediaAdvancement([
      event('playing', 0, 0),
      event('seeking', 100, 40),
      event('seeked', 200, 40),
      event('timeupdate', 2000, 40),
    ]).seconds,
    0,
  );
  assert.equal(
    observedMediaAdvancement([event('playing', 0, 0), event('timeupdate', 100, 40)]).seconds,
    0,
  );
  const observed = observedMediaAdvancement([
    event('play-request', 0, 0),
    event('playing', 100, 50),
    event('play-resolved', 100, 50),
    event('timeupdate', 600, 50.5),
    event('timeupdate', 1600, 51.5),
    event('pause', 1700, 0),
  ]);
  assert.equal(observed.seconds, 1.5);
  assert.deepEqual(observed.witness.from, { atMs: 100, currentTime: 50, event: 'playing' });
  assert.deepEqual(observed.witness.to, { atMs: 1600, currentTime: 51.5, event: 'timeupdate' });
  assert.equal(
    observedMediaAdvancement([
      event('playing', 0, 50),
      event('playing', 1000, 0),
      event('timeupdate', 2000, 1),
    ]).seconds,
    1,
  );
  const sha256 = 'a'.repeat(64);
  const falseRange = {
    sources: [{ id: 0, status: 'resolved', sha256 }],
    starts: [],
    mediaEvents: [event('playing', 0, 50), event('timeupdate', 1000, 50), event('pause', 2000, 0)],
  };
  assert.equal(
    evaluateAudioProof(falseRange, { streamedHashes: [sha256], minimumAdvanceSeconds: 1 }).status,
    'unobserved',
  );
});

test('warm reload scenario is explicit and unknown cache labels cannot masquerade as qualification', () => {
  assert.doesNotThrow(() =>
    validateQualification(scenario([{ type: 'reload' }], { cacheMode: 'warm-http-reload' })),
  );
  assert.throws(() =>
    validateQualification(scenario([{ type: 'reload' }], { cacheMode: 'cache-proven' })),
  );
  const warm = { cacheMode: 'warm-http-reload' };
  assert.equal(qualificationCacheMode(warm, { workProbe: true }), 'warm-http-reload');
  assert.throws(() => qualificationCacheMode(warm));
  assert.throws(() => qualificationCacheMode(warm, { workProbe: true, fixtureAccess: true }));
  assert.throws(() => qualificationCacheMode(warm, { workProbe: true, mirrored: true }));
  assert.equal(qualificationCacheMode({}), 'fresh-context');
});
