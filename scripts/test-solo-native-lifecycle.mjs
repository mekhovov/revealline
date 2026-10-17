import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  LIFECYCLE_SOURCE,
  LIFECYCLE_PROTOCOL,
  LIFECYCLE_FIXTURE,
  LIFECYCLE_PREDECESSOR,
  lifecycleCase,
  bindLifecycleJob,
  lifecycleMatrix,
  validateLifecyclePlan,
  assertSamePaused,
  resumeBounds,
  assertLifecycleProof,
  assertLifecycleReplay,
  lifecycleAssessment,
  readLifecycleJSON,
  lifecycleDisplayCommand,
} from './solo-remote-lifecycle.mjs';
import {
  installLifecycleProbe,
  writeLifecycleReport,
  saveLifecycleRecording,
  readOwnedDevtoolsPort,
  closeLifecycleBrowser,
  automationIdentity,
} from './observe-solo-native-lifecycle.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
const candidate = JSON.parse(
  await readFile(
    new URL('../docs/performance/solo-remote-offline-candidate-plan.json', import.meta.url),
  ),
).candidate;
const names = [
  'run-solo-remote-correctness.mjs',
  'observe-solo-native-lifecycle.mjs',
  'verify-solo-build.mjs',
  'solo-remote-archive.py',
  'serve-production-preview.mjs',
  'game-cli.mjs',
  'soundtrack-distribution.mjs',
  'optional-distribution.mjs',
  'external-distribution.mjs',
  'optional-artwork.mjs',
  'solo-qualification-native-replay.mjs',
  'solo-qualification-export.mjs',
];
const ref = (path) => ({ path, bytes: 1, sha256: 'a'.repeat(64) });
function manifest() {
  return {
    format: 'SoloHostedLifecycleManifestV1',
    status: 'reviewed-lifecycle-diagnostic-only',
    repository: 'mekhovov/revealline',
    candidate: structuredClone(candidate),
    runtimeRevision: LIFECYCLE_SOURCE.runtime,
    baseline: {
      revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
      tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
    },
    node: '22.13.1',
    playwright: '1.62.1',
    cpu: 1,
    maxParallel: 1,
    automaticRetries: 0,
    performanceExclusion: true,
    setupTimeoutMs: 2400000,
    helperTimeoutMs: 3300000,
    rowEvidenceBytes: 16 * 1024 ** 2,
    evidenceBytes: 128 * 1024 ** 2,
    protocol: structuredClone(LIFECYCLE_PROTOCOL),
    fixture: structuredClone(LIFECYCLE_FIXTURE),
    predecessor: structuredClone(LIFECYCLE_PREDECESSOR),
    jobs: ['chromium-background'],
    release: {
      scope: 'real-native-background-correctness-only',
      candidateRevision: LIFECYCLE_SOURCE.revision,
      firstEightAllCorrectnessPassed: false,
      performanceQualification: 'excluded',
      physicalQualification: 'unobserved',
      webkitBackground: 'unsupported-unobserved',
      automaticRetries: 0,
      priorProofInspected: true,
      noUnclosedOwners: true,
      onceOnlyBefore: 'a7e0219818842f02399317ca6d2a14bdd506da3d',
    },
    adapterInputs: [ref('scripts/solo-remote-lifecycle.mjs')],
    frozenTools: names.map((name) => ref('scripts/' + name)),
  };
}
function state(label, atMs, values = {}) {
  return {
    label,
    atMs,
    phase: 'paused',
    visibility: 'visible',
    focused: true,
    runId: 1,
    runTick: 12,
    levelId: 'first-return',
    trailCells: 0,
    player: { x: 25, y: 0.5 },
    checkpoint: {
      algorithm: 'fnv1a64',
      hash: 'a'.repeat(16),
      sections: { movement: 'b'.repeat(16) },
    },
    ...values,
  };
}
function raw() {
  const snapshots = [
    state('initial-running', 0, { phase: 'running', runTick: 0, player: { x: 24.5 } }),
    state('before-interruption-held-right', 100, { phase: 'running' }),
    state('hidden-paused', 350, { visibility: 'hidden', focused: false }),
    state('hidden-after-ten-seconds', 10350, { visibility: 'hidden', focused: false }),
    state('returned-before-resume', 10400),
    state('returned-still-paused', 10900),
    state('before-explicit-resume', 10901),
    state('resumed-neutral-no-key', 11310, { phase: 'running', runTick: 60, player: { x: 26 } }),
    state('fresh-movement', 11410, { phase: 'running', runTick: 72, player: { x: 25.7 } }),
    state('final-paused', 11420, { runTick: 72 }),
    state('after-public-export', 11430, { runTick: 72 }),
  ];
  const gesture = { ...state('gesture', 10902), type: 'click', trusted: true };
  const lifecycle = {
    events: [
      { type: 'visibilitychange', visibility: 'hidden', trusted: true, atMs: 350 },
      { type: 'visibilitychange', visibility: 'visible', trusted: true, atMs: 10400 },
      { type: 'keyup', key: 'ArrowRight', trusted: true, atMs: 10401 },
      { type: 'keydown', key: 'ArrowLeft', trusted: true, atMs: 11320 },
    ],
    phases: [],
    frames: [state('frame', 10936, { phase: 'running', runTick: 16 })],
    dropped: { events: 0, phases: 0 },
    resumeGesture: gesture,
    resumePhase: state('running', 10903, { phase: 'running' }),
  };
  const buildIdentity = {
    url: 'http://127.0.0.1:8765/game/build-info.json',
    sourceRevision: LIFECYCLE_SOURCE.revision,
    version: 'test',
    sha256: 'a'.repeat(64),
  };
  const csp = PUBLIC_SECURITY_HEADERS['Content-Security-Policy'];
  return {
    format: 'SoloHostedNativeLifecycleV1',
    status: 'pass',
    job: lifecycleCase(),
    protocol: structuredClone(LIFECYCLE_PROTOCOL),
    runtimeRevision: LIFECYCLE_SOURCE.runtime,
    observedBrowserClosed: true,
    connection: {
      method: 'connectOverCDP',
      noDefaults: true,
      isLocal: true,
      defaultContextOnly: true,
    },
    ownedProcess: { exited: true, exitCode: 0, exitSignal: null },
    errors: [],
    buildIdentity,
    artifact: {
      sourceRevision: LIFECYCLE_SOURCE.revision,
      sourceTree: LIFECYCLE_SOURCE.tree,
      archiveIdentity: candidate.inner,
      manifestSHA256: candidate.manifestSHA256,
      buildInfoSHA256: buildIdentity.sha256,
    },
    browserVersion: '151.0.1',
    csp,
    recording: { bytes: 2, sha256: 'b'.repeat(64) },
    nativeReplay: {
      status: 'pass',
      engine: 'chromium',
      browserVersion: '151.0.1',
      buildIdentity,
      csp,
      recording: { bytes: 2, sha256: 'b'.repeat(64) },
      observation: {
        status: 'pass',
        match: true,
        ticks: 72,
        checkpoint: structuredClone(snapshots[9].checkpoint),
        definitionCheck: { match: true },
        levelId: 'first-return',
      },
      modules: [{ status: 200, csp }],
      expected: { browserVersion: '151.0.1', buildIdentity, csp },
      pageErrors: [],
      failedRequests: [],
    },
    snapshots,
    lifecycle,
    resumeProbe: structuredClone(lifecycle),
    resumeWitness: resumeBounds(snapshots[6], lifecycle),
  };
}
const owner = () => ({
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
});

test('single native Chromium plan and finite scheduling preserve exact source/recipe/provenance', () => {
  const m = manifest(),
    p = bindLifecycleJob(m, 'chromium-background');
  assert.equal(validateLifecyclePlan(p), p);
  assert.deepEqual(lifecycleMatrix(m), {
    include: [{ job: 'chromium-background', jobMinutes: 100, stepMinutes: 58, outerSeconds: 3420 }],
  });
  assert.throws(() => bindLifecycleJob(m, 'webkit-background'));
  for (const mutate of [
    (p) => (p.candidate.revision = '0'.repeat(40)),
    (p) => p.candidate.inner.bytes++,
    (p) => (p.candidate.manifestSHA256 = 'b'.repeat(64)),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => (p.baseline.reusableArtifact = {}),
    (p) => p.protocol.hiddenMs--,
    (p) => (p.protocol.noDefaults = false),
    (p) => (p.protocol.syntheticDOMEvents = true),
    (p) => p.rows[0].timeoutMs++,
    (p) => p.rows.push(p.rows[0]),
    (p) => (p.automaticRetries = 1),
    (p) => (p.release.physicalQualification = 'passed'),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.fixture.sha256 = '0'.repeat(64)),
    (p) => (p.predecessor.driverSHA256 = '0'.repeat(64)),
    (p) => p.frozenTools.pop(),
    (p) => p.frozenTools.push(p.frozenTools[0]),
    (p) => (p.frozenTools[0].path = 'scripts/../secret'),
  ]) {
    const changed = structuredClone(p);
    mutate(changed);
    assert.throws(() => validateLifecyclePlan(changed));
  }
});
test('actual frozen checkpoints and monotonic Resume permit30Hz without hidden debt', () => {
  const r = raw();
  assertLifecycleProof(r);
  assert.equal(r.resumeWitness.submittedFrameBounds[0].maximumTicks, 5);
  for (const mutate of [
    (r) => r.snapshots[3].runTick++,
    (r) => (r.snapshots[3].checkpoint.sections.movement = 'c'.repeat(16)),
    (r) => (r.snapshots[4].phase = 'running'),
    (r) => r.snapshots[3].atMs--,
    (r) => r.snapshots[5].atMs--,
    (r) => (r.lifecycle.events[0].trusted = false),
    (r) => (r.lifecycle.events[1].visibility = 'hidden'),
    (r) => r.lifecycle.dropped.events++,
    (r) => r.lifecycle.dropped.phases++,
    (r) => (r.lifecycle.events[2].key = 'ArrowDown'),
    (r) => (r.resumeProbe.frames[0].runTick += 1000),
    (r) => (r.resumeProbe.resumeGesture.trusted = false),
    (r) => (r.resumeProbe.frames[0].atMs = NaN),
    (r) => (r.snapshots[8].player.x = 99),
    (r) => (r.snapshots[1].runId = 2),
    (r) => r.snapshots.push(r.snapshots[0]),
  ]) {
    const changed = raw();
    mutate(changed);
    assert.throws(() => assertLifecycleProof(changed));
  }
  const before = state('before', 0);
  const phaseAfter = raw().resumeProbe;
  phaseAfter.resumePhase.atMs = 11000;
  assert.equal(resumeBounds(before, phaseAfter).anchorKind, 'trusted-public-Resume-click');
  assert.throws(() => assertSamePaused({ ...before, runTick: null }, before));
});
test('assessment requires closed owners, complete native proof and exact same-browser replay', async () => {
  const p = bindLifecycleJob(manifest(), 'chromium-background');
  assert.equal((await lifecycleAssessment(p, p.rows[0], raw(), owner())).status, 'passed');
  for (const mutate of [
    (r) => (r.status = 'unobserved'),
    (r) => (r.observedBrowserClosed = false),
    (r) => (r.ownedProcess.exitSignal = 'SIGTERM'),
    (r) => r.errors.push('error'),
    (r) => (r.cleanupFailure = 'timeout'),
    (r) => (r.partialExportFailure = 'missing final read'),
    (r) => (r.deadlineReached = true),
    (r) => (r.partialReplay = true),
    (r) => (r.crashed = true),
    (r) => (r.navigationFailure = 'about:blank'),
    (r) => (r.nativeReplay.browserVersion = 'different'),
    (r) => (r.nativeReplay.observation.match = false),
    (r) => (r.nativeReplay.modules[0].status = 404),
    (r) => r.nativeReplay.failedRequests.push('failed'),
    (r) => (r.runtimeRevision = '0'.repeat(40)),
    (r) => r.nativeReplay.recording.bytes++,
    (r) => (r.csp = 'unsafe'),
    (r) => (r.connection.noDefaults = false),
    (r) => (r.nativeReplay.observation.ticks = 20),
    (r) => (r.nativeReplay.observation.checkpoint.sections.movement = 'c'.repeat(16)),
    (r) => (r.nativeReplay.observation.definitionCheck.match = false),
  ]) {
    const changed = raw();
    mutate(changed);
    const result = await lifecycleAssessment(p, p.rows[0], changed, owner());
    assert.equal(result.status, 'failed');
    if (changed.status === 'unobserved') assert.equal(result.observedLifecycle, 'unobserved');
  }
  for (const key of ['forcedCleanup', 'cleanupUnconfirmed', 'violation']) {
    const command = owner();
    command[key] = true;
    assert.equal((await lifecycleAssessment(p, p.rows[0], raw(), command)).status, 'failed');
  }
});
function environment() {
  const documentListeners = new Map(),
    windowListeners = new Map(),
    postRender = [];
  let now = 0,
    mutation;
  const run = {
    tick: 7,
    level: { id: 'first-return' },
    player: { x: 25, y: 0.5 },
    trail: [],
    lives: 3,
  };
  const env = {
    document: {
      body: { dataset: { flightState: 'paused' } },
      visibilityState: 'hidden',
      hasFocus: () => false,
      addEventListener: (name, fn) => documentListeners.set(name, fn),
    },
    performance: { now: () => now },
    innerWidth: 1280,
    innerHeight: 800,
    devicePixelRatio: 1,
    MutationObserver: class {
      constructor(fn) {
        mutation = fn;
      }
      observe() {}
    },
    addEventListener: (name, fn) => windowListeners.set(name, fn),
  };
  env.top = env;
  const Phaser = {
    Core: { Events: { POST_RENDER: 'post-render' } },
    Game: class {
      constructor() {
        this.scene = { scenes: [{ lastPaint: { run, tick: 1 } }] };
        this.events = {
          on: (name, fn) => {
            assert.equal(name, 'post-render');
            postRender.push(fn);
          },
        };
      }
    },
  };
  return {
    env,
    Phaser,
    run,
    documentListeners,
    windowListeners,
    postRender,
    setNow: (value) => (now = value),
    mutate: () => mutation(),
  };
}
test('actual installer preserves authoritative run, pause-only checkpoint and fixed16frame capacity', () => {
  const e = environment();
  installLifecycleProbe(null, e.env);
  e.env.Phaser = e.Phaser;
  new e.env.Phaser.Game();
  let checkpoints = 0;
  e.env.soloLifecycleProbe.installCheckpoint(() => {
    checkpoints++;
    return { hash: 'a'.repeat(16) };
  });
  const r = e.env.soloLifecycleProbe.snapshot('paused', true);
  assert.equal(r.runTick, 7);
  assert.equal(r.submittedPaintTick, 1);
  assert.equal(checkpoints, 1);
  e.documentListeners.get('DOMContentLoaded')();
  e.env.soloLifecycleProbe.armFrames('resume');
  e.documentListeners.get('click')({
    type: 'click',
    isTrusted: true,
    target: { id: 'start-button', closest: () => true },
  });
  e.env.document.body.dataset.flightState = 'running';
  e.setNow(1);
  e.mutate();
  assert.throws(() => e.env.soloLifecycleProbe.snapshot('invalid', true), /pause-only/);
  for (let i = 0; i < 40; i++) {
    e.setNow(i + 2);
    e.run.tick++;
    e.postRender[0]();
  }
  const out = e.env.soloLifecycleProbe.export();
  assert.equal(out.frames.length, 16);
  assert.equal(out.resumeGesture.trusted, true);
  assert.equal(out.resumePhase.phase, 'running');
  assert.equal(checkpoints, 1);
  assert.throws(() => e.env.soloLifecycleProbe.armFrames('again'));
  for (let i = 0; i < 140; i++)
    e.documentListeners.get('visibilitychange')({ type: 'visibilitychange', isTrusted: true });
  assert(e.env.soloLifecycleProbe.export().dropped.events > 0);
});
test('child frames install no lifecycle observer or game hook', () => {
  const e = environment();
  e.env.top = {};
  installLifecycleProbe(null, e.env);
  assert.equal(e.env.soloLifecycleProbe, undefined);
  assert.equal(e.documentListeners.size, 0);
  assert.equal(e.windowListeners.size, 0);
  assert.equal(Object.getOwnPropertyDescriptor(e.env, 'Phaser'), undefined);
});
test('graceful browser close requires actual child exit; never signals or excuses an uncertain child', async () => {
  const owner = { exited: false, exitCode: null, exitSignal: null, exitPromise: Promise.resolve() };
  let connected = true;
  const calls = [];
  const browser = {
    isConnected: () => connected,
    close: async () => {
      calls.push('disconnect');
      connected = false;
    },
    newBrowserCDPSession: async () => ({
      send: async (name) => {
        calls.push(name);
        owner.exited = true;
        owner.exitCode = 0;
        connected = false;
      },
    }),
  };
  assert.equal((await closeLifecycleBrowser(browser, owner, 5)).observedBrowserClosed, true);
  assert.deepEqual(calls, ['Browser.close']);
  owner.exited = false;
  owner.exitCode = null;
  connected = true;
  browser.newBrowserCDPSession = async () => ({
    send: async () => {
      connected = false;
    },
  });
  await assert.rejects(closeLifecycleBrowser(browser, owner, 5), /exit unconfirmed/);
  owner.exitPromise = new Promise(() => {});
  await assert.rejects(closeLifecycleBrowser(browser, owner, 5), /deadline/);
  owner.exited = true;
  owner.exitCode = 0;
  owner.exitSignal = 'SIGTERM';
  await assert.rejects(closeLifecycleBrowser(browser, owner, 5), /exit unconfirmed/);
});
test('bounded port, exclusive replay and atomic report readback reject symlinks, caps and replacement', async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'solo-lifecycle-contract-')));
  try {
    const port = join(dir, 'DevToolsActivePort');
    await writeFile(port, '4321\n/devtools/browser/owned-123\n');
    assert.equal(await readOwnedDevtoolsPort(dir), 'http://127.0.0.1:4321');
    for (const value of [
      '0\n/devtools/browser/owned\n',
      '99999\n/devtools/browser/owned\n',
      '4321\nws://evil\n',
      'a'.repeat(4097),
    ]) {
      await writeFile(port, value);
      await assert.rejects(readOwnedDevtoolsPort(dir));
    }
    await rm(port);
    await writeFile(join(dir, 'real-port'), '4321\n/devtools/browser/owned\n');
    await symlink(join(dir, 'real-port'), port);
    await assert.rejects(readOwnedDevtoolsPort(dir));
    const report = join(dir, 'report.json');
    await writeLifecycleReport(report, { status: 'unobserved' });
    assert.deepEqual(await readLifecycleJSON(report), { status: 'unobserved' });
    await assert.rejects(writeLifecycleReport(report, { huge: 'a'.repeat(2 * 1024 ** 2) }));
    const record = await saveLifecycleRecording(report, '{}', true);
    assert.equal(record.partial, true);
    assert.equal(record.status, 'retained-unverified');
    assert.equal(record.sha256, createHash('sha256').update('{}').digest('hex'));
    await assert.rejects(saveLifecycleRecording(report, '{}', false), { code: 'EEXIST' });
    await assert.rejects(saveLifecycleRecording(join(dir, 'large'), 'a'.repeat(262145), false));
    await symlink(report, join(dir, 'link'));
    await assert.rejects(readLifecycleJSON(join(dir, 'link')));
    await writeFile(join(dir, 'index.mjs'), 'export const test = true;');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'playwright', version: '1.62.1' }),
    );
    assert.equal((await automationIdentity(join(dir, 'index.mjs'))).package.version, '1.62.1');
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'playwright', version: '1.0.0' }),
    );
    await assert.rejects(automationIdentity(join(dir, 'index.mjs')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('common runner registration and observer preserve real native authority and bounded display', async () => {
  const runner = await readFile(
    new URL('./run-solo-remote-correctness.mjs', import.meta.url),
    'utf8',
  );
  for (const name of [
    'SoloHostedLifecyclePlanV1',
    'SoloHostedNativeLifecycleCohortV1',
    'validateLifecyclePlan',
    'prepareLifecycleMode',
    'runLifecycleRow',
  ])
    assert(runner.includes(name));
  const observer = await readFile(
    new URL('./observe-solo-native-lifecycle.mjs', import.meta.url),
    'utf8',
  );
  for (const forbidden of [
    'process.kill(',
    'child.kill(',
    'dispatchEvent(',
    'setWebLifecycleState',
    'setFocusEmulationEnabled',
  ])
    assert(!observer.includes(forbidden));
  assert(observer.includes('noDefaults: true'));
  assert(observer.includes('detached: false'));
  assert.deepEqual(
    lifecycleDisplayCommand({ 'xvfb-run': { path: '/usr/bin/xvfb-run' } }, ['node', 'observe']),
    [
      '/usr/bin/xvfb-run',
      '--auto-servernum',
      '--server-args=-screen 0 1280x800x24',
      'node',
      'observe',
    ],
  );
  assert.throws(() =>
    lifecycleDisplayCommand({ 'xvfb-run': { path: resolve('unknown') } }, ['node']),
  );
});

test('actual recorder trailing release exports the same paused checkpoint without permissive normalization', async () => {
  const [
    { createRun, stepRun, releaseInputs, FIXED_DT },
    {
      createRecorder,
      recordInput,
      recordRelease,
      exportReplay,
      authoritativeCheckpoint,
      verifyReplay,
    },
  ] = await Promise.all([import('../game/core/index.mjs'), import('../game/replay.mjs')]);
  const {
    expectedReplayDefinition: { level, options },
  } = JSON.parse(await readFile(new URL('../' + LIFECYCLE_FIXTURE.path, import.meta.url)));
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'lifecycle-contract');
  for (let i = 0; i < 12; i++) {
    const input = { direction: 'right' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  releaseInputs(run);
  recordRelease(recorder);
  const checkpoint = authoritativeCheckpoint(run),
    replay = exportReplay(recorder, run),
    verified = verifyReplay(replay);
  assert.equal(replay.releaseAfter, true);
  assert.equal(replay.ticks, run.tick);
  assert.deepEqual(replay.checkpoint, checkpoint);
  assert.equal(verified.match, true);
  assert.deepEqual(verified.actual.checkpoint, checkpoint);
  const r = raw();
  r.snapshots.find((s) => s.label === 'final-paused').runTick = run.tick;
  r.snapshots.find((s) => s.label === 'final-paused').checkpoint = checkpoint;
  r.nativeReplay.observation.ticks = run.tick;
  r.nativeReplay.observation.checkpoint = checkpoint;
  assertLifecycleReplay(r);
  // An internally valid shorter recorder is still insufficient evidence for the observed full run.
  r.nativeReplay.observation.ticks--;
  assert.throws(() => assertLifecycleReplay(r), /final live tick/);
});
