import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  qualificationQualityOptions,
  createSubmittedTierObservation,
  qualificationQualityAudioBoundary,
  QUALITY_COMPARISON_SOURCE as source,
  QUALITY_COMPARISON_RECIPES as recipes,
} from './solo-qualification-observation.mjs';
import {
  qualityComparisonSchedule,
  qualityComparisonArguments,
  assessQualityComparisonArm,
  assessQualityComparisonCohort,
  COMBINED_READINESS_COHORT,
  COMBINED_READINESS_PROTOCOL,
  RESUME_READINESS_SOURCE,
  RESUME_READINESS_FIXTURES,
  EFFECTS_READINESS_FIXTURES,
  combinedReadinessRows,
  bindReadinessJob,
  validateReadinessPlan,
  readinessArguments,
  readinessRowPlan,
  collectQualityComparison,
} from './solo-remote-readiness.mjs';
import { validateQualification } from './solo-qualification.mjs';
const fixture = async (tier) => {
  const b = await readFile(
    new URL(
      `../docs/performance/fixtures/solo-remote-timing/public-effects-${tier}-first30.qualification.fixture`,
      import.meta.url,
    ),
  );
  return { bytes: b, scenario: JSON.parse(b), hash: createHash('sha256').update(b).digest('hex') };
};
const flags = (tier) =>
  qualityComparisonArguments(
    { here: '/tools/scripts', repository: '/tools' },
    qualityComparisonSchedule().find((a) => a.tier === tier),
    'http://127.0.0.1:1/game/',
    '/evidence',
  ).slice(4);
function meter(tier = 'full', n = 1201) {
  const create = vm.runInNewContext(`(${createSubmittedTierObservation.toString()})`);
  const m = create();
  const run = { status: 'running', tick: 0 },
    paint = { run, tick: 0, quality: tier };
  const scene = {
    lastPaint: paint,
    frameActive: true,
    displayedBoardValid: true,
    submittedRun: run,
  };
  m.bind(scene);
  for (let i = 0; i < n; i++) {
    run.tick = paint.tick = i * 3;
    m.observe(100 + i * 25, 2);
  }
  return { m, run, paint, scene };
}
const admitted = {
  status: 'passed',
  artifacts: {
    candidate: {
      sourceRevision: source,
      sourceTree: 'e87e64d0e14584c2a569d06bae8e7c602c5ed105',
      manifestSHA256: 'a'.repeat(64),
      archiveIdentity: { bytes: 1, sha256: 'b'.repeat(64) },
    },
  },
};
function model(arm) {
  const observation = JSON.parse(JSON.stringify(meter(arm.tier).m.export()));
  const display = { width: 400, height: 850, devicePixelRatio: 3, maxTouchPoints: 0 };
  const raw = {
    format: 'SoloQualificationReportV1',
    kind: 'performance',
    scenarioStatus: 'pass',
    scenarioSHA256: recipes[arm.tier],
    sourceRevision: source,
    buildIdentity: { sourceRevision: source },
    environment: {
      engine: 'webkit',
      browserVersion: 'MODEL-26.5',
      architecture: 'x64',
      osRelease: 'MODEL-LINUX',
      contextMode: 'persistent',
      cpuThrottle: 1,
      headless: true,
      requestedDisplay: {
        viewport: { width: 400, height: 850 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
      initialDisplay: display,
      documentCacheControl: 'no-cache',
      contextOwner: { cleanup: { status: 'closed', profileRemoved: true, browserClosed: true } },
    },
    workProbe: true,
    cadenceProtocol: 'settled120',
    cacheMode: 'fresh-context',
    baselineRuntime: false,
    audioProof: false,
    externalCadenceCalibration: {
      status: 'measured-before-play',
      samples: Array(120).fill(16),
      baselineMs: 16,
    },
    pageErrors: [],
    actions: [
      {
        status: 'pass',
        publicEffects: {
          checked: arm.tier === 'reduced',
          effects: arm.tier,
          phase: 'briefing',
          systemReduced: false,
        },
      },
    ],
    qualityComparison: {
      format: 'SoloPublicEffectsComparisonArmV1',
      tier: arm.tier,
      sourceRevision: source,
      scenarioSHA256: recipes[arm.tier],
      documents: 1,
      performanceQualification: false,
      observation,
    },
    finalState: {
      state: 'paused',
      display,
      probe: {
        phases: ['running'],
        work: { totals: [observation.samples], width: 1 },
        submittedTiers: observation,
      },
    },
    snapshots: ['original-art-ready', 'first30-border-paused'].map((group, index) => ({
      group,
      phase: index ? 'paused' : 'briefing',
      probe: {
        audio: {
          oscillatorStarts: 0,
          sourceStarts: 0,
          sourceStartFailures: 0,
          mediaPlayRequests: 0,
          mediaPlayResolved: 0,
          mediaPlayRejected: 0,
        },
      },
      application: {
        sourceRevision: source,
        audio: { muted: true, volume: 0.8 },
        quality: { tier: arm.tier },
        interruptions: { count: 0 },
      },
    })),
    replay: {
      scope: 'completed-scenario',
      nativeVerification: {
        status: 'pass',
        engine: 'webkit',
        browserVersion: 'MODEL-26.5',
        observation: {
          match: true,
          levelId: 'first-return',
          ticks: 3600,
          features: { movingTicks: 3500, directionChangesWithMovement: 29 },
        },
      },
    },
    performanceGateStatus: 'fail',
  };
  return {
    arm,
    raw,
    command: {
      status: 'closed',
      exitCode: 2,
      forcedCleanup: false,
      cleanupUnconfirmed: false,
      survivors: [],
      ambiguous: [],
    },
    journal: { status: 'complete' },
  };
}
test('default flags remain inactive and exact options reject duplicates, drift and mixed probes', async () => {
  assert.equal(qualificationQualityOptions([], {}, 'none'), null);
  for (const tier of ['full', 'reduced']) {
    const f = await fixture(tier);
    assert.equal(qualificationQualityOptions(flags(tier), f.scenario, f.hash).tier, tier);
    for (const extra of [
      '--browser=chromium',
      '--cpu=2',
      '--readiness-probe=first-running-v1',
      '--memory-profile',
      '--journal-cost-probe',
      '--visual-quality-observation=full',
    ])
      assert.throws(() => qualificationQualityOptions([...flags(tier), extra], f.scenario, f.hash));
    assert.throws(() => qualificationQualityOptions(flags(tier), f.scenario, 'a'.repeat(64)));
  }
});
test('fixtures use public controls and preserve the exact original active actions and immutable replay definition', async () => {
  const root = new URL(
    '../docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
    import.meta.url,
  );
  const original = JSON.parse(await readFile(root));
  for (const tier of ['full', 'reduced']) {
    const { scenario } = await fixture(tier);
    validateQualification(scenario);
    assert.deepEqual(scenario.actions.slice(6), original.actions);
    assert.deepEqual(scenario.expectedReplayDefinition, original.expectedReplayDefinition);
    assert.deepEqual(scenario.replayRequirements, original.replayRequirements);
    assert.equal(scenario.timeoutMs, original.timeoutMs);
    assert.equal(scenario.actions[2].value, tier === 'reduced');
  }
});
test('same serialized fixed-buffer observer records exact active tier without mutating the scene', () => {
  const { m, paint, scene } = meter();
  const before = JSON.stringify(scene);
  const o = m.export();
  assert.equal(o.status, 'complete');
  assert.equal(o.samples, 1201);
  assert.deepEqual(Array.from(o.counts), [1201, 0, 0]);
  assert.equal(o.transitionCount, 1);
  assert.equal(JSON.stringify(scene), before);
  assert(Buffer.byteLength(JSON.stringify(o)) < 16384);
  assert.equal(paint.tick, 3600);
});
test('observer fails on missing/ambiguous binding, stale submission, replacement and backward clock/tick', () => {
  for (const change of [
    (x) => x.m.bind(x.scene),
    (x) => (x.scene.lastPaint = null),
    (x) => (x.scene.submittedRun = {}),
    (x) => (x.scene.frameActive = false),
    (x) => (x.scene.displayedBoardValid = false),
    (x) => x.paint.tick--,
    (x) => {
      x.paint.run = { status: 'running', tick: x.paint.tick };
      x.scene.submittedRun = x.paint.run;
    },
    (x) => (x.paint.quality = 'unknown'),
  ]) {
    const x = meter();
    change(x);
    x.m.observe(30150, 2);
    assert.equal(x.m.export().status, 'incomplete');
  }
  const x = meter();
  x.m.observe(1, 2);
  assert.equal(x.m.export().status, 'incomplete');
  const y = createSubmittedTierObservation();
  y.bind(null);
  y.observe(1, 2);
  assert.equal(y.export().status, 'incomplete');
});
test('sample and transition caps retain failure instead of silently truncating or allocating more', () => {
  const x = meter('full', 5001);
  assert.equal(x.m.export().overflow, true);
  assert.equal(x.m.export().samples, 5000);
  const y = meter('full', 1);
  for (let i = 1; i < 34; i++) {
    y.paint.quality = i % 2 ? 'reduced' : 'full';
    y.m.observe(100 + i, 2);
  }
  assert.equal(y.m.export().overflow, true);
  assert.equal(y.m.export().transitions.length, 96);
});
test('four arms are counterbalanced, serial-ready and use identical observer flags apart from preference', () => {
  const s = qualityComparisonSchedule();
  assert.deepEqual(
    s.map((x) => x.tier),
    ['full', 'reduced', 'reduced', 'full'],
  );
  assert.deepEqual(
    s.map((x) => x.pair),
    [1, 1, 2, 2],
  );
  assert(s.every((x) => x.engine === 'webkit' && x.timeoutMs === 480000));
  assert.equal(new Set(s.map((x) => x.id)).size, 4);
});
test('complete model arm preserves numerical failure and never grants performance qualification', async () => {
  for (const arm of qualityComparisonSchedule()) {
    const x = model(arm);
    const result = await assessQualityComparisonArm(x.raw, x.command, x.journal, arm, admitted);
    assert.equal(result.status, 'observed-comparison-arm', result.failure);
    assert.equal(result.rawPerformanceGateStatus, 'fail');
    assert.equal(result.performanceQualification, false);
  }
});
test('owner, source, foreground sequence, tier, coverage and replay defects cannot produce a comparable arm', async () => {
  const changes = [
    (x) => x.command.survivors.push({ pid: 1 }),
    (x) => (x.command.forcedCleanup = true),
    (x) => (x.raw.sourceRevision = 'f'.repeat(40)),
    (x) => (x.raw.environment.contextOwner.cleanup.profileRemoved = false),
    (x) => (x.raw.scenarioStatus = 'fail'),
    (x) => (x.raw.actions[0].publicEffects.effects = 'reduced'),
    (x) => x.raw.qualityComparison.documents++,
    (x) => (x.raw.qualityComparison.observation.counts = [0, 1201, 0]),
    (x) => x.raw.qualityComparison.observation.activeEntries++,
    (x) => x.raw.qualityComparison.observation.samples--,
    (x) => (x.raw.qualityComparison.observation.lastAtMs = 200),
    (x) => (x.raw.qualityComparison.observation.overflow = true),
    (x) => (x.raw.replay.nativeVerification.observation.match = false),
    (x) => (x.raw.replay.nativeVerification.observation.features.movingTicks = 10),
    (x) => (x.raw.replay.nativeVerification.observation.ticks = 1),
    (x) => (x.raw.snapshots[0].application.interruptions.count = 1),
    (x) => (x.journal.status = 'incomplete'),
    (x) => x.raw.pageErrors.push('error'),
  ];
  for (const change of changes) {
    const x = model(qualityComparisonSchedule()[0]);
    change(x);
    const result = await assessQualityComparisonArm(x.raw, x.command, x.journal, x.arm, admitted);
    assert.equal(result.status, 'invalid-comparison', String(change));
  }
  const x = model(qualityComparisonSchedule()[0]);
  assert.equal(
    (await assessQualityComparisonArm(x.raw, x.command, x.journal, x.arm, null)).status,
    'invalid-comparison',
  );
});
test('missing numerical data and missing audio-state witness cannot look comparable', async () => {
  for (const remove of [
    (x) => delete x.raw.performanceGateStatus,
    (x) => delete x.raw.snapshots[0].application.audio,
  ]) {
    const x = model(qualityComparisonSchedule()[0]);
    remove(x);
    assert.equal(
      (await assessQualityComparisonArm(x.raw, x.command, x.journal, x.arm, admitted)).status,
      'invalid-comparison',
    );
  }
});

test('cohort requires all four in order with matching browser/settings; no pair is discarded', async () => {
  const values = qualityComparisonSchedule().map(model);
  assert.equal(
    (await assessQualityComparisonCohort(values, admitted)).status,
    'complete-diagnostic-comparison',
  );
  assert.equal(
    (await assessQualityComparisonCohort(values.slice(1), admitted)).status,
    'incomplete-comparison',
  );
  const changed = structuredClone(values);
  changed[2].raw.environment.browserVersion = 'OTHER';
  changed[2].raw.replay.nativeVerification.browserVersion = 'OTHER';
  assert.equal(
    (await assessQualityComparisonCohort(changed, admitted)).status,
    'invalid-comparison',
  );
  const reorder = [values[1], values[0], ...values.slice(2)];
  assert.equal(
    (await assessQualityComparisonCohort(reorder, admitted)).status,
    'invalid-comparison',
  );
});

test('actual patched existing callback installer collects opt-in tiers and leaves default reports unchanged', async () => {
  const { parse } = await import('acorn');
  const text = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  let install;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee.name === 'addQualificationProbe' &&
      node.arguments[0]?.type === 'ArrowFunctionExpression'
    )
      install = node.arguments[0];
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(walk);
      else if (value?.type) walk(value);
  }
  walk(ast);
  assert(install);
  for (const enabled of [false, true]) {
    const handlers = new Map();
    let updatePhase,
      domReady,
      clock = 100;
    const run = { status: 'running', tick: 1 };
    const scene = {
      lastPaint: { run, tick: 1, quality: 'full' },
      frameActive: true,
      displayedBoardValid: true,
      submittedRun: run,
    };
    const context = {
      Float64Array,
      Uint32Array,
      Math,
      Object,
      Array,
      Number,
      Error,
      performance: { now: () => clock },
      document: {
        body: { dataset: { flightState: 'briefing' } },
        addEventListener(_name, cb) {
          domReady = cb;
        },
      },
      requestAnimationFrame() {},
      MutationObserver: class {
        constructor(cb) {
          updatePhase = cb;
        }
        observe() {}
      },
      HTMLMediaElement: class {
        play() {}
      },
      soloQualificationReadiness: () => ({ ready: true }),
      soloQualificationFrozenCadence: () => ({ calibration: { status: 'model' }, baselineMs: 16 }),
      soloQualificationIntervalClock: () => ({ observe: () => null, snapshot: () => ({}) }),
      soloQualificationCreateSubmittedTierObservation: createSubmittedTierObservation,
    };
    context.window = context;
    vm.createContext(context);
    const fn = vm.runInContext(`(${text.slice(install.start, install.end)})`, context);
    fn({ bounds: [16, 33, null], workProbe: true, qualityObservation: enabled });
    context.Phaser = {
      Core: { Events: { PRE_STEP: 'pre', POST_RENDER: 'post' } },
      Game: class {
        constructor() {
          this.scene = { scenes: [scene] };
          this.events = { on: (name, cb) => handlers.set(name, cb) };
        }
      },
    };
    new context.Phaser.Game();
    domReady();
    context.soloQualificationProbe.startApplicationProbe();
    context.document.body.dataset.flightState = 'running';
    updatePhase();
    handlers.get('pre')();
    clock += 2;
    handlers.get('post')();
    const result = context.soloQualificationProbe.export();
    assert.equal(result.work.count, 1);
    if (enabled) {
      assert.equal(result.submittedTiers.samples, 1);
      assert.equal(result.submittedTiers.status, 'complete');
      assert.equal(result.submittedTiers.counts[0], 1);
    } else assert(!Object.hasOwn(result, 'submittedTiers'));
  }
});

test('a changed system Reduced Motion preference invalidates the four-arm comparison', async () => {
  const values = qualityComparisonSchedule().map(model);
  values[1].raw.actions[0].publicEffects.systemReduced = true;
  assert.equal(
    (
      await assessQualityComparisonArm(
        values[1].raw,
        values[1].command,
        values[1].journal,
        values[1].arm,
        admitted,
      )
    ).status,
    'observed-comparison-arm',
  );
  assert.equal(
    (await assessQualityComparisonCohort(values, admitted)).status,
    'invalid-comparison',
  );
});

test('both paused audio boundaries must match including observed native operations', async () => {
  for (const index of [0, 1]) {
    for (const mutate of [
      (s) => {
        s.application.audio.muted = false;
      },
      (s) => {
        s.application.audio.volume = 0.5;
      },
      (s) => {
        s.probe.audio.sourceStarts = 1;
      },
      (s) => {
        s.probe.audio.mediaPlayRequests = 1;
        s.probe.audio.mediaPlayResolved = 1;
      },
    ]) {
      const values = qualityComparisonSchedule().map(model);
      mutate(values[1].raw.snapshots[index]);
      assert.equal(
        (
          await assessQualityComparisonArm(
            values[1].raw,
            values[1].command,
            values[1].journal,
            values[1].arm,
            admitted,
          )
        ).status,
        'invalid-comparison',
      );
      assert.equal(
        (await assessQualityComparisonCohort(values, admitted)).status,
        'invalid-comparison',
      );
    }
    for (const mutate of [
      (s) => {
        delete s.probe.audio;
      },
      (s) => {
        s.probe.audio.sourceStarts = NaN;
      },
      (s) => {
        s.probe.audio.mediaPlayResolved = 1;
      },
      (s) => {
        s.phase = 'running';
      },
    ]) {
      const x = model(qualityComparisonSchedule()[0]);
      mutate(x.raw.snapshots[index]);
      assert.equal(
        (await assessQualityComparisonArm(x.raw, x.command, x.journal, x.arm, admitted)).status,
        'invalid-comparison',
      );
    }
  }
});
test('each arm retains its observed B independently rather than equating or recalibrating it', async () => {
  const values = qualityComparisonSchedule().map(model);
  values[1].raw.externalCadenceCalibration.baselineMs = 17;
  values[2].raw.externalCadenceCalibration.baselineMs = 16.5;
  const result = await assessQualityComparisonCohort(values, admitted);
  assert.equal(result.status, 'complete-diagnostic-comparison');
  assert.deepEqual(
    result.results.map((r) => r.observedBaselineMs),
    [16, 17, 16.5, 16],
  );
  assert(result.results.every((r) => r.rawPerformanceGateStatus === 'fail'));
});

test('qualifier preserves paused witness before gating pre-play audio and never starts a rejected case', async () => {
  const text = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  assert.match(
    text,
    /report\.snapshots\.push\(row\);\s*if \(qualityOptions\) qualificationQualityAudioBoundary\(row, report\.snapshots\.length - 1\);/,
  );
  const row = model(qualityComparisonSchedule()[0]).raw.snapshots[0];
  assert.doesNotThrow(() => qualificationQualityAudioBoundary(row, 0));
  row.probe.audio.mediaPlayRequests = 1;
  assert.throws(() => qualificationQualityAudioBoundary(row, 0), /nonzero or missing/);
  assert.throws(() => qualificationQualityAudioBoundary(row, 2), /unexpected snapshot/);
});
async function combinedManifest() {
  const m = JSON.parse(
    await readFile(new URL('../docs/performance/solo-readiness-ab45-plan.json', import.meta.url)),
  );
  // Pure synthetic admission control; never an executable artifact binding.
  m.sourceCohort = COMBINED_READINESS_COHORT;
  m.phase = 'warm-saved-and-muted-effects';
  m.candidate = { ...m.candidate, ...RESUME_READINESS_SOURCE };
  m.runtimeRevision = RESUME_READINESS_SOURCE.revision;
  m.fixture = RESUME_READINESS_FIXTURES['warm-resume'];
  m.additionalFixtures = [
    RESUME_READINESS_FIXTURES['saved-resume'],
    EFFECTS_READINESS_FIXTURES.full,
    EFFECTS_READINESS_FIXTURES.reduced,
  ];
  m.protocol = structuredClone(COMBINED_READINESS_PROTOCOL);
  m.release.candidateRevision = m.candidate.revision;
  m.release.comparisonScope = 'muted-public-effects-bundle-only';
  return m;
}
test('combined registration retains exact serial2/6 rows within original bounds', async () => {
  const manifest = await combinedManifest();
  for (const engine of ['chromium', 'webkit']) {
    const plan = bindReadinessJob(manifest, engine);
    assert.deepEqual(plan.rows, combinedReadinessRows(engine));
    assert.equal(plan.rows.length, engine === 'webkit' ? 6 : 2);
    assert.equal(plan.helperTimeoutMs, 75 * 60000);
    assert(plan.rows.reduce((sum, row) => sum + row.timeoutMs, 0) < plan.helperTimeoutMs);
    assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
    for (const row of plan.rows) {
      const selected = readinessRowPlan(plan, row);
      assert.equal(selected.candidate.revision, source);
      const args = readinessArguments(
        { plan, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://127.0.0.1:1/game/',
        '/evidence',
      );
      if (row.tier) {
        assert(!args.some((v) => v.startsWith('--readiness-probe')));
        assert(args.includes('--visual-quality-observation=' + row.tier));
      } else {
        assert(args.includes('--readiness-probe=' + row.phase + '-v1'));
        assert(!args.some((v) => v.startsWith('--visual-quality-observation')));
      }
    }
  }
  assert.throws(
    () => readinessRowPlan(bindReadinessJob(manifest, 'chromium'), qualityComparisonSchedule()[0]),
    /Undeclared/,
  );
});
test('combined source, order, fixture, protocol and owner drift is never admitted', async () => {
  for (const change of [
    (p) => p.rows.reverse(),
    (p) => p.rows.push(p.rows[0]),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.candidate.revision = 'a'.repeat(40)),
    (p) => (p.runtimeRevision = 'a'.repeat(40)),
    (p) => (p.candidate.tree = 'a'.repeat(40)),
    (p) => p.additionalFixtures.pop(),
    (p) => (p.additionalFixtures[1] = { ...p.additionalFixtures[1], sha256: 'a'.repeat(64) }),
    (p) => (p.protocol.effects[0] = 'reduced'),
    (p) => (p.protocol.effectsAudio.muted = false),
    (p) => p.helperTimeoutMs++,
    (p) => p.automaticRetries++,
    (p) => (p.release.performanceQualification = 'passed'),
    (p) =>
      (p.frozenTools = p.frozenTools.filter(
        (r) => r.path !== 'scripts/solo-qualification-observation.mjs',
      )),
  ]) {
    const p = bindReadinessJob(await combinedManifest(), 'webkit');
    change(p);
    assert.throws(() => validateReadinessPlan(p), String(change));
  }
});
test('quality aggregation rereads hashed reports and retains missing unsafe failed or changed arms', async (t) => {
  const evidence = await realpath(await mkdtemp(join(tmpdir(), 'quality-comparison-model-')));
  t.after(() => rm(evidence, { recursive: true, force: true }));
  const digest = async (path) => {
    const b = await readFile(path);
    return { bytes: b.length, sha256: createHash('sha256').update(b).digest('hex') };
  };
  const ctx = { evidence, admitted, digest, report: { rows: [] } };
  const values = qualityComparisonSchedule().map(model);
  for (const value of values) {
    const dir = join(evidence, value.arm.id);
    await mkdir(dir);
    const path = join(dir, 'report.json');
    await writeFile(path, JSON.stringify(value.raw));
    ctx.report.rows.push({
      ...value.arm,
      command: value.command,
      qualityJournal: value.journal,
      diagnosticStatus: 'passed',
      comparisonStatus: 'observed-comparison-arm',
      status: 'failed',
      qualityRawReport: { path, ...(await digest(path)) },
    });
  }
  const final = await collectQualityComparison(ctx);
  assert.equal(final.status, 'complete-diagnostic-comparison');
  assert.equal(final.performanceQualification, false);
  assert(final.results.every((r) => r.rawPerformanceGateStatus === 'fail'));
  ctx.report.rows[0].serverCleanupFailure = 'model-failure';
  assert.equal((await collectQualityComparison(ctx)).status, 'incomplete-comparison');
  delete ctx.report.rows[0].serverCleanupFailure;
  ctx.report.rows[0].diagnosticStatus = 'failed'; // post-assessment source/input check failure
  assert.equal((await collectQualityComparison(ctx)).status, 'incomplete-comparison');
  ctx.report.rows[0].diagnosticStatus = 'passed';
  ctx.report.rows[0].command.cleanupUnconfirmed = true;
  assert.equal((await collectQualityComparison(ctx)).status, 'invalid-comparison');
  delete ctx.report.rows[0].command.cleanupUnconfirmed;
  await writeFile(
    ctx.report.rows[0].qualityRawReport.path,
    JSON.stringify({ ...values[0].raw, changed: true }),
  );
  await assert.rejects(() => collectQualityComparison(ctx));
});
test('combined effects subplans preserve real bounded binary journal verification and source negatives', async (t) => {
  const { createBrowserHitchJournal, createHitchJournalStore } = await import(
    './solo-qualification-hitch-journal.mjs'
  );
  const { verifyTimingHitchJournal } = await import('./solo-remote-sustained.mjs');
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'effects-journal-control-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const output = join(dir, 'report.json'),
    url = 'http://127.0.0.1:4321/game/?journey=opening';
  const store = createHitchJournalStore(output, () => 0, { soloURL: url });
  let now = 0;
  const j = createBrowserHitchJournal(
    {},
    {
      performance: { now: () => now, timeOrigin: 1700000000000 },
      location: { origin: 'http://127.0.0.1:4321', pathname: '/game/' },
      document: { hidden: false, hasFocus: () => true, addEventListener() {} },
      addEventListener() {},
      btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    },
  );
  j.configure(store.beginDocument({ url, action: 'initial' }));
  j.first(0, 0);
  j.subscribe(0);
  j.phase(2, 0);
  j.frame(0, 40, 2, 2);
  j.beginWork(1, 2);
  j.endWork(55, 2);
  j.phase(3, 60);
  now = 100;
  await store.retain(j.seal('paused'), 'final-existing-public-boundary');
  const raw = { hitchJournal: store.finish() };
  const combined = bindReadinessJob(await combinedManifest(), 'webkit');
  const a = await import('./solo-remote-readiness.mjs');
  const successorPlans = [
    ...a.densityComparisonSchedule().map((arm) => ({
      format: 'SoloHostedReadinessPlanV1',
      sourceCohort: 'readiness-public-dpr-candidate0feb',
      phase: `public-dpr-${arm.dpr}`,
      candidate: a.FONT_DPR_SOURCE,
      runtimeRevision: a.FONT_DPR_SOURCE.revision,
      engine: 'webkit',
      fixture: a.COMPACT_READINESS_FIXTURES.full,
      hitchJournal: 'bounded-v1',
      performanceExclusion: true,
    })),
    {
      format: 'SoloHostedReadinessPlanV1',
      sourceCohort: 'readiness-selected-font-candidate0feb',
      phase: 'selected-font-cancel',
      candidate: a.FONT_DPR_SOURCE,
      runtimeRevision: a.FONT_DPR_SOURCE.revision,
      engine: 'webkit',
      fixture: a.SELECTED_FONT_JOINED_FIXTURE,
      hitchJournal: 'bounded-v1',
      performanceExclusion: true,
    },
  ];
  successorPlans.push(
    ...successorPlans.map((p) => ({
      ...p,
      candidate: a.SELECTED_FONT_SOURCE,
      runtimeRevision: a.SELECTED_FONT_SOURCE.revision,
      sourceCohort:
        p.sourceCohort === 'readiness-selected-font-candidate0feb'
          ? 'readiness-selected-font-joined-candidatec696'
          : 'readiness-public-dpr-candidatec696',
    })),
  );
  for (const plan of [
    readinessRowPlan(combined, combined.rows[2]),
    readinessRowPlan(combined, combined.rows[3]),
    ...successorPlans,
  ]) {
    assert.equal((await verifyTimingHitchJournal(plan, raw, output, url)).status, 'complete');
    for (const mutate of [
      (p) => (p.runtimeRevision = 'a'.repeat(40)),
      (p) => (p.candidate.tree = 'a'.repeat(40)),
      (p) => (p.fixture = { ...p.fixture, sha256: 'a'.repeat(64) }),
      (p) => (p.phase = 'public-effects-minimal'),
      (p) => (p.performanceExclusion = false),
    ]) {
      const p = structuredClone(plan);
      mutate(p);
      assert.equal(
        (await verifyTimingHitchJournal(p, raw, output, url)).status,
        'invalid-evidence',
      );
    }
  }
});

// The failed compact route is replaced prospectively only for exact c696.
test('compact c696 comparison admits exact new source/recipes and preserves all raw numeric failures', async () => {
  const a = await import('./solo-remote-readiness.mjs');
  for (const arm of qualityComparisonSchedule()) {
    const item = model(arm),
      ref = a.COMPACT_READINESS_FIXTURES[arm.tier],
      bytes = await readFile(new URL('../' + ref.path, import.meta.url)),
      scenario = JSON.parse(bytes);
    const p = {
      sourceCohort: 'readiness-public-effects-candidatec696',
      phase: 'public-effects-' + arm.tier,
      candidate: a.SELECTED_FONT_SOURCE,
      engine: 'webkit',
      fixture: ref,
    };
    const args = qualityComparisonArguments(
      { plan: p, here: '/tools/scripts', repository: '/tools' },
      arm,
      'http://localhost/game/',
      '/out',
    ).slice(4);
    assert.equal(
      qualificationQualityOptions(args, scenario, ref.sha256).sourceRevision,
      a.SELECTED_FONT_SOURCE.revision,
    );
    for (const changed of [
      args.map((x) => (x.startsWith('--source-revision=') ? '--source-revision=' + source : x)),
      args.concat('--readiness-probe=selected-font-cancel-v1'),
    ])
      assert.throws(() => qualificationQualityOptions(changed, scenario, ref.sha256));
    assert.throws(() =>
      qualificationQualityOptions(
        args,
        { ...scenario, id: scenario.id.replace('-compact-close-v2', '') },
        ref.sha256,
      ),
    );
    assert.throws(() => qualificationQualityOptions(args, scenario, recipes[arm.tier]));
    const r = item.raw;
    r.sourceRevision =
      r.buildIdentity.sourceRevision =
      r.qualityComparison.sourceRevision =
        a.SELECTED_FONT_SOURCE.revision;
    r.scenarioSHA256 = r.qualityComparison.scenarioSHA256 = ref.sha256;
    r.snapshots.forEach((s) => (s.application.sourceRevision = a.SELECTED_FONT_SOURCE.revision));
    const setting = r.actions[0].publicEffects;
    r.actions = scenario.actions.map((x, i) => ({
      path: String(i),
      type: x.type,
      label: x.label ?? null,
      status: 'pass',
      ...(i === 2 ? { publicEffects: setting } : {}),
    }));
    const admission = structuredClone(admitted);
    admission.artifacts.candidate.sourceRevision = a.SELECTED_FONT_SOURCE.revision;
    admission.artifacts.candidate.sourceTree = a.SELECTED_FONT_SOURCE.tree;
    const result = await assessQualityComparisonArm(
      r,
      item.command,
      item.journal,
      arm,
      admission,
      p,
    );
    assert.equal(result.status, 'observed-comparison-arm', result.failure);
    assert.equal(result.rawPerformanceGateStatus, 'fail');
    const i = scenario.actions.findIndex((x) =>
      x.selector?.includes('body:not(:has(#settings-dialog[open]))'),
    );
    assert(i >= 0);
    r.actions[i].status = 'skipped-not-visible';
    assert.equal(
      (await assessQualityComparisonArm(r, item.command, item.journal, arm, admission, p)).status,
      'invalid-comparison',
    );
  }
});

// Same-viewport density successor. All records below are synthetic contract data.
async function densityModel(arm, c696 = false) {
  const a = await import('./solo-remote-readiness.mjs');
  const selectedSource = c696 ? a.SELECTED_FONT_SOURCE : a.FONT_DPR_SOURCE;
  const item = model(arm),
    r = item.raw,
    ref = a.COMPACT_READINESS_FIXTURES.full;
  const scenario = JSON.parse(await readFile(new URL('../' + ref.path, import.meta.url)));
  const plan = {
    sourceCohort: c696
      ? 'readiness-public-dpr-candidatec696'
      : 'readiness-public-dpr-candidate0feb',
    phase: `public-dpr-${arm.dpr}`,
    candidate: selectedSource,
    runtimeRevision: selectedSource.revision,
    engine: 'webkit',
    fixture: ref,
  };
  r.sourceRevision =
    r.buildIdentity.sourceRevision =
    r.qualityComparison.sourceRevision =
      selectedSource.revision;
  r.scenarioSHA256 = r.qualityComparison.scenarioSHA256 = ref.sha256;
  Object.assign(r.qualityComparison, {
    densityComparison: 'same-viewport-v1',
    deviceScaleFactor: arm.dpr,
  });
  r.environment.requestedDisplay.deviceScaleFactor = arm.dpr;
  r.environment.initialDisplay.devicePixelRatio = arm.dpr;
  r.finalState.display.devicePixelRatio = arm.dpr;
  const settings = r.actions[0].publicEffects;
  r.actions = scenario.actions.map((x, i) => ({
    path: String(i),
    type: x.type,
    label: x.label ?? null,
    status: 'pass',
    ...(i === 2 ? { publicEffects: settings } : {}),
  }));
  for (const snapshot of r.snapshots) {
    snapshot.application.sourceRevision = selectedSource.revision;
    snapshot.application.resources = {
      phaser: {
        displayed: { canvases: 1, width: 1152, height: 576, pixels: 663552 },
        detachedBoard: { canvases: 1, width: 1152, height: 576, pixels: 663552 },
      },
    };
    snapshot.application.canvas = { desynchronized: false, willReadFrequently: false };
  }
  const admission = structuredClone(admitted);
  admission.artifacts.candidate.sourceRevision = selectedSource.revision;
  admission.artifacts.candidate.sourceTree = selectedSource.tree;
  return { ...item, plan, admission, scenario };
}
test('density successor accepts only exact full route/source with DPR1 or3 and preserves old option output', async () => {
  const a = await import('./solo-remote-readiness.mjs');
  assert.deepEqual(
    a.densityComparisonSchedule().map((x) => x.dpr),
    [1, 3, 3, 1],
  );
  for (const arm of a.densityComparisonSchedule()) {
    const x = await densityModel(arm);
    const args = qualityComparisonArguments(
      { plan: x.plan, here: '/tools/scripts', repository: '/tools' },
      arm,
      'http://localhost/game/',
      '/out',
    ).slice(4);
    const opt = qualificationQualityOptions(args, x.scenario, x.plan.fixture.sha256);
    assert.equal(opt.densityComparison, 'same-viewport-v1');
    assert.equal(opt.deviceScaleFactor, arm.dpr);
    assert.equal(opt.tier, 'full');
    for (const change of [
      (f) => f.filter((v) => !v.startsWith('--density-comparison=')),
      (f) => f.concat('--density-comparison=same-viewport-v1'),
      (f) => f.map((v) => (v.startsWith('--dpr=') ? '--dpr=2' : v)),
      (f) => f.map((v) => (v.startsWith('--viewport=') ? '--viewport=1280x800' : v)),
      (f) => f.map((v) => (v.startsWith('--source-revision=') ? '--source-revision=' + source : v)),
      (f) =>
        f.map((v) =>
          v.startsWith('--visual-quality-observation=')
            ? '--visual-quality-observation=reduced'
            : v,
        ),
      (f) => f.concat('--readiness-probe=selected-font-cancel-joined-v2'),
    ])
      assert.throws(() =>
        qualificationQualityOptions(change(args), x.scenario, x.plan.fixture.sha256),
      );
    assert.throws(() => qualificationQualityOptions(args, x.scenario, recipes.full));
    const out = await assessQualityComparisonArm(
      x.raw,
      x.command,
      x.journal,
      arm,
      x.admission,
      x.plan,
    );
    assert.equal(out.status, 'observed-comparison-arm', out.failure);
    assert.equal(out.rawPerformanceGateStatus, 'fail');
    assert.deepEqual(out.rasterObservation.theoreticalViewportRaster, {
      width: 400 * arm.dpr,
      height: 850 * arm.dpr,
      pixels: 340000 * arm.dpr ** 2,
    });
    assert.equal(out.rasterObservation.canvases[0].displayed.width, 1152);
    assert.equal(out.rasterObservation.graphicsBackend, null);
    for (const change of [
      (r) => (r.environment.initialDisplay.devicePixelRatio = 2),
      (r) => (r.qualityComparison.deviceScaleFactor = 2),
      (r) => delete r.qualityComparison.densityComparison,
      (r) => (r.snapshots[0].application.canvas.desynchronized = null),
      (r) => r.snapshots[1].application.resources.phaser.displayed.pixels++,
      (r) => (r.snapshots[1].application.audio.muted = false),
      (r) => (r.qualityComparison.observation.counts = [0, 1201, 0]),
      (r) => (r.environment.requestedDisplay.viewport.width = 401),
      (r) => (r.replay.nativeVerification.observation.match = false),
      (r) => (r.environment.contextOwner.cleanup.status = 'unknown'),
    ]) {
      const raw = structuredClone(x.raw);
      change(raw);
      assert.equal(
        (await assessQualityComparisonArm(raw, x.command, x.journal, arm, x.admission, x.plan))
          .status,
        'invalid-comparison',
      );
    }
  }
  for (const tier of ['full', 'reduced']) {
    const f = await fixture(tier);
    assert.deepEqual(qualificationQualityOptions(flags(tier), f.scenario, f.hash), {
      format: 'SoloPublicEffectsComparisonArmV1',
      tier,
      sourceRevision: source,
      scenarioSHA256: f.hash,
      performanceQualification: false,
    });
  }
  assert.throws(() =>
    qualificationQualityOptions(['--density-comparison=same-viewport-v1'], {}, 'none'),
  );
});
test('density cohort changes only DPR across fixed counterbalanced pairs and retains every raw failure', async () => {
  const a = await import('./solo-remote-readiness.mjs'),
    schedule = a.densityComparisonSchedule(),
    items = await Promise.all(schedule.map((arm) => densityModel(arm)));
  const plan = { ...items[0].plan, sourceCohort: a.FONT_DPR_COHORT, engine: 'webkit' };
  const result = await assessQualityComparisonCohort(items, items[0].admission, plan);
  assert.equal(result.status, 'complete-diagnostic-comparison', JSON.stringify(result));
  assert(result.results.every((r) => r.rawPerformanceGateStatus === 'fail'));
  assert.equal(result.performanceQualification, false);
  for (const change of [
    (x) => x.reverse(),
    (x) => x[1].raw.environment.initialDisplay.width++,
    (x) => (x[1].raw.environment.browserVersion = 'OTHER'),
    (x) => x.pop(),
  ]) {
    const altered = structuredClone(items);
    change(altered);
    assert.notEqual(
      (await assessQualityComparisonCohort(altered, items[0].admission, plan)).status,
      'complete-diagnostic-comparison',
    );
  }
});

test('c696 density opt-in keeps native-completed compact controls and permits only exact Full density pairs', async () => {
  const a = await import('./solo-remote-readiness.mjs'),
    items = await Promise.all(a.densityComparisonSchedule().map((arm) => densityModel(arm, true)));
  const plan = { ...items[0].plan, sourceCohort: a.FONT_DPR_C696_COHORT, engine: 'webkit' };
  for (const item of items) {
    const args = qualityComparisonArguments(
      { plan: item.plan, here: '/tools/scripts', repository: '/tools' },
      item.arm,
      'http://localhost/game/',
      '/out',
    ).slice(4);
    const opt = qualificationQualityOptions(args, item.scenario, item.plan.fixture.sha256);
    assert.equal(opt.sourceRevision, a.SELECTED_FONT_SOURCE.revision);
    assert.equal(opt.deviceScaleFactor, item.arm.dpr);
    assert.equal(opt.tier, 'full');
    for (const mutate of [
      (r) => (r.sourceRevision = a.FONT_DPR_SOURCE.revision),
      (r) => (r.qualityComparison.densityComparison = 'other'),
      (r) => (r.environment.requestedDisplay.deviceScaleFactor = 2),
    ]) {
      const raw = structuredClone(item.raw);
      mutate(raw);
      assert.equal(
        (
          await assessQualityComparisonArm(
            raw,
            item.command,
            item.journal,
            item.arm,
            item.admission,
            item.plan,
          )
        ).status,
        'invalid-comparison',
      );
    }
  }
  const result = await assessQualityComparisonCohort(items, items[0].admission, plan);
  assert.equal(result.status, 'complete-diagnostic-comparison', JSON.stringify(result));
  assert(result.results.every((r) => r.rawPerformanceGateStatus === 'fail'));
  const mixed = structuredClone(items);
  mixed[2] = await densityModel(mixed[2].arm, false);
  assert.equal(
    (await assessQualityComparisonCohort(mixed, items[0].admission, plan)).status,
    'invalid-comparison',
  );
});
