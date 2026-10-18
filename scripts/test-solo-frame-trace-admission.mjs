import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';
import {
  bindCpuProfileJob,
  cpuProfileMatrix,
  prepareCpuProfileMode,
  cpuProfileArguments,
  cpuProfileAssessment,
  readFrameTraceEvidence,
  validateCpuProfilePlan,
} from './solo-remote-cpu-profile.mjs';
import {
  inspectFrameTrace,
  FRAME_TRACE_CATEGORIES,
  FRAME_TRACE_LIMITS,
} from './solo-qualification-cpu-profile.mjs';
import { verifiedMidCalibration } from './solo-remote-sustained.mjs';
const read = (p) => readFile(new URL('../' + p, import.meta.url));
const manifest = JSON.parse(await read('docs/performance/solo-browser-frame-trace-warm-plan.json'));
const source = '9d5139b9983c700a6a708f65f379fa4d5a8b0395';
const hash = (b) => createHash('sha256').update(b).digest('hex');
// Explicit parser/assessment model only. The committed declaration has no native first-eight proof.
function reviewed() {
  const p = structuredClone(manifest);
  p.status = 'reviewed-diagnostic-only';
  p.release.status = 'reviewed';
  p.release.firstEightAllCorrectnessPassed = true;
  p.release.firstEightEvidence = {
    format: 'SoloFirstEightCorrectnessEvidenceV1',
    sourceRevision: source,
    runId: 1,
    artifactId: 2,
    artifactSHA256: 'a'.repeat(64),
    summarySHA256: 'b'.repeat(64),
    correctness: 'passed',
    ownersClosed: true,
  };
  return p;
}
function modeled() {
  const plan = bindCpuProfileJob(reviewed()),
    mode = {
      cpu: 2.46,
      browserVersion: '123.4',
      calibration: { path: '/evidence/calibration.json', bytes: 100, sha256: 'c'.repeat(64) },
    };
  const trace = {
    ...FRAME_TRACE_LIMITS,
    status: 'retained',
    protocol: 'warm-first3-v1',
    stopReason: 'safe-border-direction-3',
    stopRequestedElapsedMs: 3200,
    preStartSetupMs: 30,
    startAcknowledged: true,
    completionObserved: true,
    dataLossOccurred: false,
    streamEOF: true,
    streamClosed: true,
    cdpDetached: true,
    bytes: 100,
    sha256: 'd'.repeat(64),
    backend: { applicationRenderer: 'unobserved', hardwareGraphics: 'unobserved' },
  };
  const raw = {
    format: 'SoloQualificationReportV1',
    kind: 'frame-trace-diagnostic',
    scenarioKind: 'performance',
    audioProof: false,
    scenarioStatus: 'pass',
    scenarioSHA256: manifest.recipe.sha256,
    sourceRevision: source,
    buildIdentity: { sourceRevision: source },
    environment: {
      engine: 'chromium',
      headless: true,
      cpuThrottle: mode.cpu,
      contextMode: 'ephemeral',
      browserVersion: mode.browserVersion,
      requestedDisplay: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
    workProbe: true,
    cadenceProtocol: 'settled120',
    baselineRuntime: false,
    replay: {
      scope: 'completed-scenario',
      nativeVerification: {
        status: 'pass',
        engine: 'chromium',
        browserVersion: mode.browserVersion,
      },
    },
    pageErrors: [],
    frameTrace: trace,
    performanceGateStatus: 'excluded-browser-frame-tracing',
  };
  return {
    plan,
    mode,
    raw,
    command: {
      status: 'closed',
      exitCode: 0,
      signal: null,
      forcedCleanup: false,
      cleanupUnconfirmed: false,
      violation: null,
      survivors: [],
      ambiguous: [],
    },
    readback: { status: 'passed', bytes: 100, sha256: 'd'.repeat(64), inspectionVerified: true },
  };
}
const assess = (x) => cpuProfileAssessment(x.plan, x.raw, x.command, x.readback, x.mode);
test('held final9d trace refuses native admission before proof and before preparation effects', async () => {
  assert.equal(manifest.release.firstEightEvidence, null);
  assert.equal(manifest.release.firstEightAllCorrectnessPassed, false);
  assert(manifest.status.startsWith('held-'));
  assert.throws(() => bindCpuProfileJob(manifest));
  assert.throws(() => cpuProfileMatrix(manifest));
  const p = reviewed();
  p.release.firstEightEvidence = null;
  assert.throws(() => bindCpuProfileJob(p));
  const held = bindCpuProfileJob(reviewed());
  held.status = manifest.status;
  const x = modeled();
  assert.throws(() => cpuProfileAssessment(held, x.raw, x.command, x.readback, x.mode));
  await assert.rejects(
    prepareCpuProfileMode({
      plan: held,
      get required() {
        assert.fail('Held preparation reached owned process');
      },
      get work() {
        assert.fail('Held preparation reached filesystem');
      },
    }),
  );
});
test('modeled exact proof binds one original bounded CPU owner without claiming observed correctness', () => {
  const p = bindCpuProfileJob(reviewed());
  assert.deepEqual(cpuProfileMatrix(reviewed()).include, [
    {
      phase: 'warm-browser-frame-trace',
      engine: 'chromium',
      jobMinutes: 130,
      stepMinutes: 78,
      outerSeconds: 4620,
    },
  ]);
  assert.deepEqual(p.rows, [
    {
      id: 'warm-browser-frame-trace-chromium-candidate',
      kind: 'cpu-profile',
      source: 'candidate',
      engine: 'chromium',
      timeoutMs: 480000,
      performanceExclusion: true,
    },
  ]);
  assert.equal(p.helperTimeoutMs, 4500000);
  assert.equal(p.scenarioTimeoutMs, 360000);
  assert.equal(p.calibrationTimeoutMs, 300000);
  assert.equal(p.profile.maximumBytes, 64 * 1024 ** 2);
});
test('source package proof workload and budget mutations remain refused', () => {
  for (const mutate of [
    (p) => (p.candidate.revision = '797e03f28743921842df6aa57520a72016ba3dfc'),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => p.candidate.run++,
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.manifestSHA256 = '0'.repeat(64)),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => (p.sourceCohort = 'other'),
    (p) => (p.release.firstEightEvidence.sourceRevision = '0'.repeat(40)),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.release.firstEightEvidence.correctness = 'failed'),
    (p) => (p.release.firstEightEvidence.extra = true),
    (p) => (p.release.firstEightEvidence.runId = 0),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => (p.release.status = 'held'),
    (p) => (p.release.dispatch.ref = 'branch'),
    (p) => (p.cpu = 3.88),
    (p) => (p.calibrationPreset = 'low'),
    (p) => p.calibrationTimeoutMs++,
    (p) => p.helperTimeoutMs++,
    (p) => p.scenarioTimeoutMs++,
    (p) => p.profile.maximumMs++,
    (p) => p.profile.maximumBytes++,
    (p) => p.profile.bufferKiB++,
    (p) => (p.profile.sampling = true),
    (p) => (p.automaticRetries = 1),
    (p) => (p.automaticPhaseContinuation = true),
    (p) => (p.maxParallel = 2),
    (p) => (p.recipe.sha256 = '0'.repeat(64)),
    (p) => (p.recipe.path = '../elsewhere'),
    (p) => (p.profile.traceBytes = 0),
    (p) => (p.stressOrigin = { rate: 3.88 }),
  ]) {
    const p = reviewed();
    mutate(p);
    assert.throws(() => bindCpuProfileJob(p));
  }
  const p = bindCpuProfileJob(reviewed());
  p.rows[0].timeoutMs++;
  assert.throws(() => validateCpuProfilePlan(p));
});
test('actual frame arguments retain original warm workload flags and use only fresh calibration rate', () => {
  const x = modeled();
  const argv = cpuProfileArguments(
    {
      plan: x.plan,
      modeState: { ...x.mode, recipePath: '/owned/recipe.json' },
      here: '/tools/scripts',
    },
    'http://127.0.0.1:1/game/?journey=opening',
    '/owned/evidence',
  );
  assert.deepEqual(argv, [
    '/tools/scripts/qualify-solo-runtime.mjs',
    'http://127.0.0.1:1/game/?journey=opening',
    '/owned/recipe.json',
    '/owned/evidence/report.json',
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    '--cpu=2.46',
    '--browser=chromium',
    '--source-revision=' + source,
    '--frame-trace=warm-first3-v1',
  ]);
  for (const value of [NaN, 0, 21])
    assert.throws(() =>
      cpuProfileArguments(
        { plan: x.plan, modeState: { ...x.mode, cpu: value }, here: '/tools' },
        'http://example.test',
        '/owned',
      ),
    );
  assert(!argv.includes('--cpu-profile'));
  assert(!argv.includes('--headed'));
});
test('actual preparation performs a fresh verified calibration inside the original owned limit', async () => {
  const text = (await read('scripts/solo-remote-cpu-profile.mjs')).toString(),
    ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' }),
    declaration = ast.body.find(
      (n) =>
        n.type === 'ExportNamedDeclaration' && n.declaration?.id?.name === 'prepareCpuProfileMode',
    ).declaration;
  let code = text.slice(declaration.start, declaration.end);
  const dynamic = code.match(/await import\(\s*'\.\/solo-remote-sustained\.mjs'\s*\)/);
  assert(dynamic);
  code = code.replace(dynamic[0], 'await Promise.resolve(sustained)');
  const effects = [],
    identity = { bytes: manifest.recipe.bytes, sha256: manifest.recipe.sha256 };
  const calibration = {
    failure: null,
    browser: '123.4',
    finishedAt: '2026-10-18T00:00:00Z',
    result: {
      presets: {
        mid: {
          status: 'verified',
          target: 1000,
          rate: 2.46,
          verification: [990, 1000, 1010],
          median: 1000,
          spread: 0.02,
        },
      },
    },
  };
  const fn = new Function(
    'validateCpuProfilePlan',
    'verifyInputs',
    'assert',
    'join',
    'resolve',
    'mkdir',
    'copyFile',
    'readSupplementalJSON',
    'warmFrameTrace',
    'longRail',
    'firstVictory797',
    'firstVictory',
    'sustained',
    'MiB',
    'return (' + code + ')',
  )(
    validateCpuProfilePlan,
    async () => effects.push('inputs'),
    assert,
    join,
    join,
    async () => effects.push('mkdir'),
    async () => effects.push('copy'),
    async (p) =>
      p.endsWith('fresh-mid-calibration.json')
        ? calibration
        : {
            timeoutMs: 360000,
            kind: 'performance',
            expectedReplayDefinition: {},
            replayRequirements: {},
          },
    () => true,
    () => false,
    () => false,
    () => false,
    {
      verifiedMidCalibration,
      prepareCalibrationScratch: async () => {
        effects.push('scratch');
        return { path: '/owned/c00' };
      },
    },
    1024 ** 2,
  );
  const ctx = {
    plan: bindCpuProfileJob(reviewed()),
    admitted: { status: 'passed' },
    repository: '/tools',
    work: '/owned/work',
    evidence: '/owned/evidence',
    here: '/tools/scripts',
    cleanEnv: { SAFE: '1' },
    report: {},
    digest: async (p) =>
      p.endsWith('fresh-mid-calibration.json') ? { bytes: 100, sha256: 'c'.repeat(64) } : identity,
    required: async (...args) => {
      effects.push('calibrate');
      assert.equal(args[0], 'fresh-mid-calibration');
      assert.deepEqual(args[1], [
        process.execPath,
        '/tools/scripts/calibrate-solo-performance.mjs',
        '/owned/evidence/fresh-mid-calibration.json',
      ]);
      assert.equal(args[2], 300000);
      assert.deepEqual(args[3], { env: { SAFE: '1', TMPDIR: '/owned/c00' } });
    },
  };
  const mode = await fn(ctx);
  assert.equal(mode.cpu, 2.46);
  assert.equal(mode.browserVersion, '123.4');
  assert(effects.indexOf('inputs') < effects.indexOf('calibrate'));
  assert(effects.indexOf('scratch') < effects.indexOf('calibrate'));
  assert.equal(ctx.report.performanceQualification, 'excluded-browser-frame-tracing');
  calibration.result.presets.mid.status = 'unverified';
  await assert.rejects(fn(ctx));
});
test('complete modeled trace retains diagnostic exclusion while failures cannot gain native credit', () => {
  const good = assess(modeled());
  assert.equal(good.status, 'passed');
  assert.equal(good.performanceQualification, 'excluded-browser-frame-tracing');
  assert.deepEqual(good.backend, {
    applicationRenderer: 'unobserved',
    hardwareGraphics: 'unobserved',
  });
  for (const mutate of [
    (x) => (x.command.exitCode = 1),
    (x) => (x.command.signal = 'SIGTERM'),
    (x) => (x.command.forcedCleanup = true),
    (x) => (x.command.survivors = [1]),
    (x) => (x.command.ambiguous = [1]),
    (x) => (x.raw.failure = 'failed'),
    (x) => (x.raw.contextCleanupFailure = 'failed'),
    (x) => (x.raw.replay.nativeVerification.status = 'fail'),
    (x) => (x.raw.replay.nativeVerification.browserVersion = 'different'),
    (x) => (x.raw.sourceRevision = '0'.repeat(40)),
    (x) => (x.raw.environment.headless = false),
    (x) => (x.raw.environment.cpuThrottle = 3.88),
    (x) => (x.raw.environment.browserVersion = 'different'),
    (x) => (x.raw.workProbe = false),
    (x) => (x.raw.scenarioSHA256 = '0'.repeat(64)),
    (x) => (x.mode.calibration = null),
    (x) => (x.raw.frameTrace.status = 'incomplete'),
    (x) => (x.raw.cpuProfile = {}),
    (x) => (x.raw.frameTrace.backend.hardwareGraphics = 'GPU'),
    (x) => (x.raw.frameTrace.dataLossOccurred = true),
    (x) => (x.raw.frameTrace.limitReached = true),
    (x) => (x.raw.frameTrace.bufferFull = true),
    (x) => (x.raw.frameTrace.startOutcomeUnknown = true),
    (x) => (x.raw.frameTrace.completionUnconfirmed = true),
    (x) => (x.raw.frameTrace.ownerClosureRequested = 'unknown'),
    (x) => (x.raw.frameTrace.streamClosed = false),
    (x) => (x.raw.frameTrace.cdpDetached = false),
    (x) => (x.raw.frameTrace.stopRequestedElapsedMs = 30001),
    (x) => (x.raw.frameTrace.preStartSetupMs = 60000),
    (x) => (x.raw.frameTraceFailure = 'failed'),
    (x) => (x.readback.inspectionVerified = false),
    (x) => (x.readback.sha256 = '0'.repeat(64)),
    (x) => (x.raw.performanceGateStatus = 'pass'),
  ]) {
    const x = modeled();
    mutate(x);
    assert.equal(assess(x).status, 'failed');
  }
});
function evidence() {
  const anchors = {
    start: { before: 1, startTime: 1, after: 1, timeOrigin: 1000, cdpRequestElapsedMs: 1 },
    end: { before: 3001, startTime: 3001, after: 3001, timeOrigin: 1000, cdpRequestElapsedMs: 1 },
  };
  const bytes = Buffer.from(
    JSON.stringify({
      traceEvents: [
        {
          name: 'solo-frame-trace-before-public-start-v1',
          cat: 'blink.user_timing',
          ts: 1000,
          pid: 1,
          tid: 2,
        },
        {
          name: 'solo-frame-trace-after-safe-border-direction-3-v1',
          cat: 'blink.user_timing',
          ts: 3001000,
          pid: 1,
          tid: 2,
        },
      ],
    }),
  );
  return {
    bytes,
    raw: {
      bytes: bytes.length,
      sha256: hash(bytes),
      categories: [...FRAME_TRACE_CATEGORIES],
      anchors,
      inspection: inspectFrameTrace(bytes, anchors),
    },
  };
}
test('actual trace readback rehashes raw anchors and refuses changed bytes, aliases and forged inspection', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'solo-frame-readback-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'report.json.frame-trace.json'),
    x = evidence();
  await writeFile(path, x.bytes);
  x.raw.file = path;
  assert.equal((await readFrameTraceEvidence(path, x.raw)).inspectionVerified, true);
  for (const mutate of [
    (r) => (r.sha256 = '0'.repeat(64)),
    (r) => r.bytes++,
    (r) => r.inspection.eventCount++,
    (r) => r.categories.pop(),
    (r) => r.anchors.end.timeOrigin++,
  ]) {
    const r = structuredClone(x.raw);
    mutate(r);
    await assert.rejects(readFrameTraceEvidence(path, r));
  }
  const alias = join(dir, 'alias');
  await symlink(path, alias);
  await assert.rejects(readFrameTraceEvidence(alias, { ...x.raw, file: alias }));
  await writeFile(path, Buffer.concat([x.bytes, Buffer.from(' ')]));
  await assert.rejects(readFrameTraceEvidence(path, x.raw));
});
test('new declaration freezes actual tools and the unchanged complete warm recipe', async () => {
  for (const ref of [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
  }
  const recipe = JSON.parse(await read(manifest.recipe.path));
  assert.equal(recipe.timeoutMs, 360000);
  assert.equal(recipe.actions[3].selector, '#shell-featured');
  assert.equal(recipe.actions[7].label, 'safe-border-direction-3');
  assert.equal(recipe.actions.at(-1).type, 'exportReplay');
  assert.deepEqual(manifest.profile.maximumBytes, FRAME_TRACE_LIMITS.maximumBytes);
});

test('fixed trace choice shares only the bounded CPU job and keeps manual main-only source admission', async () => {
  const text = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
  const body = text.split('\n  hud-cpu:\n')[1].split(/\n  [a-z][a-z-]+:\n/)[0];
  const guard = body.match(/^    if: (.+)$/m)[1];
  assert.equal(
    guard,
    "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && (inputs.lane == 'hud-cpu' || inputs.lane == 'frame-trace')",
  );
  const allows = new Function('github', 'inputs', 'return (' + guard + ')'),
    base = {
      repository: 'mekhovov/revealline',
      event_name: 'workflow_dispatch',
      ref: 'refs/heads/main',
    };
  for (const lane of ['hud-cpu', 'frame-trace']) {
    assert.equal(allows(base, { lane }), true);
    for (const changed of [
      { ...base, repository: 'other/repo' },
      { ...base, event_name: 'pull_request' },
      { ...base, ref: 'refs/heads/branch' },
    ])
      assert.equal(allows(changed, { lane }), false);
  }
  assert.equal(allows(base, { lane: 'all' }), false);
  assert.match(body, /^    timeout-minutes: 130$/m);
  assert.match(body, /timeout-minutes: 78/);
  assert.match(body, /4620s node scripts\/run-solo-remote-correctness\.mjs/);
  assert.equal((body.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(
    body.includes(
      'solo-shared-source-checkout.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 ' +
        manifest.candidate.revision +
        ' ' +
        manifest.candidate.tree,
    ),
  );
  assert(body.includes('bind-plan docs/performance/solo-browser-frame-trace-warm-plan.json'));
  assert(body.includes('bind-plan docs/performance/solo-first-victory-cpu-797e03-plan.json'));
  assert(
    !body.includes('inputs.source') &&
      !body.includes('inputs.artifact') &&
      !body.includes('continue-on-error'),
  );
  const sparse = [...body.matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
  for (const p of [
    'docs/performance/solo-browser-frame-trace-warm-plan.json',
    'scripts/test-solo-frame-trace-admission.mjs',
    'scripts/solo-frame-trace.test.mjs',
    manifest.recipe.path,
    ...manifest.adapterInputs.map((x) => x.path),
    ...manifest.frozenTools.map((x) => x.path),
  ])
    assert(sparse.includes(p), p);
  const command = body.split('\n').find((s) => s.trim().startsWith('node --test '));
  const argv = command.trim().split(/\s+/);
  assert(argv.includes('scripts/test-solo-frame-trace-admission.mjs'));
  assert(argv.includes('scripts/solo-frame-trace.test.mjs'));
  assert(
    !argv.includes('scripts/test-solo-qualification-cpu-profile.mjs'),
    'owner suite imported once by trace entry',
  );
  const first = argv.findIndex((x) => x.endsWith('.mjs'));
  assert(!argv.slice(first).some((x) => x.startsWith('--test')));
  const traceEntry = (await read('scripts/solo-frame-trace.test.mjs')).toString();
  assert(traceEntry.includes("import './test-solo-qualification-cpu-profile.mjs';"));
  assert(
    body.includes(
      "SOLO_DIAGNOSTIC_OUTPUT: ${{ inputs.lane == 'frame-trace' && 'solo-linux-9d5139-frame-trace' || 'solo-linux-797e03-hud-cpu' }}",
    ),
  );
  assert(
    body.includes(
      'name: ${{ env.SOLO_DIAGNOSTIC_OUTPUT }}-${{ github.run_id }}-${{ github.run_attempt }}',
    ),
  );
  assert(body.includes('${{ runner.temp }}/${{ env.SOLO_DIAGNOSTIC_OUTPUT }}/evidence/'));
});
