import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateQualification,
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
  const { inspectQualificationReplay } = await import('./solo-qualification-replay.mjs');
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
  const inspected = inspectQualificationReplay({ replay }, { closures: 1, maximumTrailCells: 20 });
  assert.equal(inspected.status, 'pass');
  assert.equal(inspected.outcome, 'won');
  assert.equal(inspectQualificationReplay(replay, { eroded: 1 }).status, 'fail');
  const tampered = structuredClone(replay);
  tampered.segments[0].ticks++;
  assert.throws(() => inspectQualificationReplay(tampered));
});
