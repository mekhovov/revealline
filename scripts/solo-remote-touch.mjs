// Native touch is a separately declared input-submission diagnostic.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const MiB = 1024 ** 2;
export const TOUCH_SOURCE = Object.freeze({
  revision: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  tree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
  runtime: '32abd322afd8243e4537ce4784e2f78ee45ecbec',
});
export const TOUCH_DE332_COHORT = 'native-touch-candidatede332';
export const TOUCH_DE332_SOURCE = Object.freeze({
  revision: 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4',
  tree: '2954fef5b0f1293ff2e6a97ce978a673dddaa7db',
  runtime: 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4',
});
export const TOUCH_RUNTIME73_COHORT = 'native-touch-candidate73';
export const TOUCH_RUNTIME73_SOURCE = Object.freeze({
  revision: '73a345cec696d7789198cf295ca5c37b17ca0e71',
  tree: 'ea30e68636b3342f8e60664a79d425e11e27ff1e',
  runtime: '73a345cec696d7789198cf295ca5c37b17ca0e71',
});
const sourceBoundTouch = (sourceCohort) =>
  [TOUCH_DE332_COHORT, TOUCH_RUNTIME73_COHORT].includes(sourceCohort);
export function touchSource(sourceCohort) {
  if (sourceCohort === TOUCH_RUNTIME73_COHORT) return TOUCH_RUNTIME73_SOURCE;
  if (sourceCohort === undefined) return TOUCH_SOURCE;
  assert.equal(sourceCohort, TOUCH_DE332_COHORT, 'Undeclared touch source');
  return TOUCH_DE332_SOURCE;
}
export const TOUCH_JOBS = ['chromium-dpad', 'webkit-dpad', 'chromium-stick', 'chromium-swipe'];
export const TOUCH_FIXTURE = Object.freeze({
  path: 'docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
  bytes: 6387,
  sha256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
});
export const TOUCH_PROTOCOL = Object.freeze({
  directionChanges: 24,
  holdAfterTapMs: 600,
  neutralHoldMs: 250,
  displacementCSSPixels: 40,
  minimumSamples: 20,
  cadence: 'settled120',
  observationTimeoutMs: 240000,
  replayTimeoutMs: 120000,
  eventCapacity: 64,
  reportBytes: 4 * MiB,
  replayBytes: 32 * MiB,
  syntheticDOMEvents: false,
  headed: true,
  display: '1280x1024x24',
});
export function touchCase(job, repetition) {
  assert(TOUCH_JOBS.includes(job));
  assert([1, 2, 3].includes(repetition));
  const [engine, mode] = job.split('-');
  return {
    id: `${job}-r${repetition}`,
    engine,
    mode,
    repetition,
    context: {
      viewport: { width: 400, height: 850 },
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: engine === 'chromium',
    },
  };
}
export function assertTouchCandidate(candidate, sourceCohort) {
  touchSource(sourceCohort);
  if (sourceCohort === TOUCH_RUNTIME73_COHORT) {
    const { revision, tree, run, artifact, outer, inner, manifestSHA256 } = candidate;
    assert.deepEqual(
      { revision, tree, run, artifact, outer, inner, manifestSHA256 },
      {
        revision: '73a345cec696d7789198cf295ca5c37b17ca0e71',
        tree: 'ea30e68636b3342f8e60664a79d425e11e27ff1e',
        run: 39099979283,
        artifact: 12127570566,
        outer: {
          bytes: 1094639407,
          sha256: '6d93e34b3372e24f1f010bb630d7d7b688fdbc8a1280b3f3a9945e99ac171e64',
        },
        inner: {
          bytes: 1075807617,
          sha256: '17d7135c4d16693f0ddb5ee655d6552fdedc18ef7add72aefa7d8e39a7b24a54',
        },
        manifestSHA256: 'd16a636797b4269357cb6302211c71503819b0ca7ae333d244587cee7d159d93',
      },
    );
    return;
  }
  if (sourceCohort === TOUCH_DE332_COHORT) {
    assert.deepEqual(
      {
        revision: candidate.revision,
        tree: candidate.tree,
        run: candidate.run,
        artifact: candidate.artifact,
        outer: candidate.outer,
        inner: candidate.inner,
        manifestSHA256: candidate.manifestSHA256,
      },
      {
        revision: 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4',
        tree: '2954fef5b0f1293ff2e6a97ce978a673dddaa7db',
        run: 39091745654,
        artifact: 12123463810,
        outer: {
          bytes: 1094606342,
          sha256: '47a1b17e91edd11434e2b9ad08883f43b0b3374c33569aebe24a4731cc8cba27',
        },
        inner: {
          bytes: 1075789325,
          sha256: 'd4e051135af877e6bb473b71713be4cc8a0b1bca877f892fa04675059fbe94aa',
        },
        manifestSHA256: '74525fe396c239be2950585cb28d32455706b27628e02e8cc194f770f885f10d',
      },
    );
    return;
  }
  assert.equal(candidate.revision, TOUCH_SOURCE.revision);
  assert.equal(candidate.tree, TOUCH_SOURCE.tree);
  assert.equal(candidate.run, 39008793814);
  assert.equal(candidate.artifact, 12092903788);
  assert.deepEqual(candidate.outer, {
    bytes: 1091879339,
    sha256: 'a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a',
  });
  assert.deepEqual(candidate.inner, {
    bytes: 1073755490,
    sha256: '52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1',
  });
  assert.equal(
    candidate.manifestSHA256,
    'b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7',
  );
}
export function validateTouchPlan(plan) {
  assert.equal(plan.format, 'SoloHostedTouchPlanV1');
  assert.equal(plan.status, 'reviewed-input-diagnostic-only');
  assert.equal(plan.repository, 'mekhovov/revealline');
  const source = touchSource(plan.sourceCohort);
  assertTouchCandidate(plan.candidate, plan.sourceCohort);
  assert.equal(plan.runtimeRevision, source.runtime);
  assert.deepEqual(plan.baseline, {
    revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
    tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  });
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.cpu, 1);
  assert.equal(plan.maxParallel, 2);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.rowEvidenceBytes, 32 * MiB);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.deepEqual(plan.protocol, TOUCH_PROTOCOL);
  assert.deepEqual(plan.fixture, TOUCH_FIXTURE);
  assert.equal(plan.release.scope, 'native-touch-submission-only');
  assert.equal(plan.release.candidateRevision, source.revision);
  if (sourceBoundTouch(plan.sourceCohort)) {
    assert.equal(plan.release.firstEightRequired, false);
    assert.equal(plan.release.firstEightAllCorrectnessPassed, undefined);
    assert.deepEqual(plan.release.dispatch, {
      workflow: '.github/workflows/solo-native-package-consumer.yml',
      lane: 'touch',
      source: source.revision,
    });
    assert.equal(plan.release.onceOnlyBefore, undefined);
  } else assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release.performanceQualification, 'excluded');
  assert.equal(plan.release.physicalQualification, 'unobserved');
  assert.equal(plan.release.automaticRetries, 0);
  assert.equal(plan.release.priorProofInspected, true);
  assert.equal(plan.release.noUnclosedOwners, true);
  if (plan.sourceCohort === undefined) assert.match(plan.release.onceOnlyBefore, /^[a-f0-9]{40}$/);
  assert.deepEqual(
    plan.rows,
    [1, 2, 3].map((repetition) => ({
      id: touchCase(plan.job, repetition).id,
      source: 'candidate',
      kind: 'native-touch',
      engine: touchCase(plan.job, repetition).engine,
      repetition,
      timeoutMs: 480000,
      performanceExclusion: true,
    })),
  );
  assert.deepEqual(
    plan.adapterInputs.map((r) => r.path),
    ['scripts/solo-remote-touch.mjs'],
  );
  assert(plan.frozenTools.length > 0 && plan.frozenTools.length <= 64);
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  for (const ref of refs) {
    assert(
      /^(scripts|docs)\/[a-zA-Z0-9_./-]+$/.test(ref.path) && !ref.path.split('/').includes('..'),
    );
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  for (const name of [
    'run-solo-remote-correctness.mjs',
    'observe-solo-native-touch.mjs',
    'verify-solo-build.mjs',
    'solo-remote-archive.py',
    'serve-production-preview.mjs',
    'game-cli.mjs',
    'solo-qualification-cadence.mjs',
    'solo-qualification-native-replay.mjs',
    'solo-qualification-export.mjs',
    'solo-qualification.mjs',
  ])
    assert(plan.frozenTools.some((r) => r.path === 'scripts/' + name));
  return plan;
}
export function bindTouchJob(manifest, job) {
  assert.equal(manifest.format, 'SoloHostedTouchManifestV1');
  assert.deepEqual(manifest.jobs, TOUCH_JOBS);
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedTouchPlanV1';
  plan.job = job;
  plan.rows = [1, 2, 3].map((repetition) => ({
    id: touchCase(job, repetition).id,
    source: 'candidate',
    kind: 'native-touch',
    engine: touchCase(job, repetition).engine,
    repetition,
    timeoutMs: 480000,
    performanceExclusion: true,
  }));
  return validateTouchPlan(plan);
}
export function touchMatrix(manifest) {
  return {
    include: TOUCH_JOBS.map((job) => {
      bindTouchJob(manifest, job);
      return { job, jobMinutes: 130, stepMinutes: 78, outerSeconds: 4620 };
    }),
  };
}
export async function readTouchJSON(path, maximum = 4 * MiB) {
  const info = await lstat(path);
  assert(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maximum);
  assert.equal(await realpath(path), resolve(path));
  const file = await open(path, 'r');
  try {
    const before = await file.stat();
    assert(before.dev === info.dev && before.ino === info.ino && before.size === info.size);
    const bytes = Buffer.alloc(maximum + 1);
    let count = 0;
    while (count < bytes.length) {
      const part = await file.read(bytes, count, bytes.length - count, count);
      if (!part.bytesRead) break;
      count += part.bytesRead;
    }
    const after = await file.stat();
    assert(
      count === info.size &&
        count <= maximum &&
        before.size === after.size &&
        before.mtimeMs === after.mtimeMs,
    );
    return JSON.parse(bytes.subarray(0, count));
  } finally {
    await file.close();
  }
}
async function verifyInputs(ctx) {
  for (const ref of [...ctx.plan.adapterInputs, ...ctx.plan.frozenTools, ctx.plan.fixture]) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/') && (await realpath(path)) === path);
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}
export function touchDisplayCommand(executables, command) {
  assert.equal(executables['xvfb-run'].path, '/usr/bin/xvfb-run');
  assert(Array.isArray(command) && command.length > 0);
  return [
    executables['xvfb-run'].path,
    '--auto-servernum',
    '--server-args=-screen 0 1280x1024x24',
    ...command,
  ];
}
export async function prepareTouchMode(ctx) {
  validateTouchPlan(ctx.plan);
  const source = touchSource(ctx.plan.sourceCohort);
  await verifyInputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  const actual = ctx.admitted.artifacts.candidate;
  assert.equal(actual.sourceRevision, source.revision);
  assert.equal(actual.sourceTree, source.tree);
  assert.equal(actual.manifestSHA256, ctx.plan.candidate.manifestSHA256);
  assert.deepEqual(actual.archiveIdentity, ctx.plan.candidate.inner);
  const executables = {};
  for (const name of ['Xvfb', 'xvfb-run', 'xauth', 'xdpyinfo']) {
    const path = await realpath(`/usr/bin/${name}`),
      info = await lstat(path);
    assert(
      info.isFile() && !info.isSymbolicLink() && info.mode & 0o111,
      `Required display tool: ${name}`,
    );
    executables[name] = { path, ...(await ctx.digest(path)) };
  }
  await ctx.required(
    'touch-display-preflight',
    touchDisplayCommand(executables, [executables.xdpyinfo.path]),
    30000,
  );
  ctx.report.performanceExclusion = true;
  if (sourceBoundTouch(ctx.plan.sourceCohort)) ctx.report.firstEightRequired = false;
  else ctx.report.firstEightAllCorrectnessPassed = false;
  return {
    executables,
    scope:
      'Trusted native touch event-to-tick-to-submission diagnostic only; no physical input, general frame performance or WebKit continuous-gesture claim.',
  };
}
export function assertTouchMovement(raw, spec) {
  assert.equal(raw.movement.length, 24);
  assert.equal(raw.initial.levelId, 'first-return');
  assert.equal(raw.initial.trailCells, 0);
  for (const [index, item] of raw.movement.entries()) {
    assert.equal(item.index, index);
    assert.equal(item.direction, index % 2 ? 'left' : 'right');
    const { before, after } = item;
    for (const state of [before, after]) {
      assert.equal(state.phase, 'running');
      assert.equal(state.visible, true);
      assert.equal(state.focused, true);
      assert.equal(state.levelId, raw.initial.levelId);
      assert.equal(state.lives, raw.initial.lives);
      assert.equal(state.trailCells, 0);
      assert.equal(state.y, raw.initial.y);
      assert(Number.isFinite(state.x) && Number.isSafeInteger(state.tick));
    }
    assert(after.tick > before.tick);
    assert(item.direction === 'right' ? after.x > before.x : after.x < before.x);
  }
  if (spec.mode !== 'dpad') {
    assert.equal(raw.afterNeutralDown.phase, 'running');
    assert.equal(raw.afterNeutralDown.x, raw.initial.x);
    assert.equal(raw.afterNeutralDown.y, raw.initial.y);
  }
}
export function assertTouchEvents(raw, spec) {
  const count = 24 + Number(spec.mode !== 'dpad'),
    events = raw.nativeInput.events;
  assert.equal(events.length, count);
  assert.equal(raw.nativeInput.dropped, 0);
  assert.equal(
    events.filter((e) => e.type === 'pointerdown').length,
    spec.mode === 'dpad' ? 24 : 1,
  );
  assert.equal(
    events.filter((e) => e.type === 'pointermove').length,
    spec.mode === 'dpad' ? 0 : 24,
  );
  assert(
    events.every(
      (e) => e.isTrusted === true && e.pointerType === 'touch' && e.defaultPrevented === true,
    ),
  );
  const app = raw.application;
  assert.equal(app.inputLatency.byKind.touch.toTick.count, count);
  assert.equal(app.inputLatency.byKind.touch.toRender.count, count);
  assert.equal(app.droppedInputObservations, 0);
  assert.equal(app.inputLatency.overwritten, 0);
  assert.equal(app.interruptions.count, 0);
  assert.equal(app.failures.count, 0);
}
export function touchLatency(raw, quantileBound) {
  const app = raw.application,
    touch = app.inputLatency.byKind.touch,
    count = 24 + Number(raw.job.mode !== 'dpad');
  const inputGateChecks = [
    { name: 'exact-touch-to-tick-count', actual: touch.toTick.count, expected: count },
    { name: 'exact-touch-to-render-count', actual: touch.toRender.count, expected: count },
    { name: 'no-dropped-input-observations', actual: app.droppedInputObservations, expected: 0 },
    {
      name: 'no-overwritten-input-observations',
      actual: app.inputLatency.overwritten,
      expected: 0,
    },
    { name: 'no-safety-interruptions', actual: app.interruptions?.count ?? null, expected: 0 },
    { name: 'no-application-failures', actual: app.failures?.count ?? null, expected: 0 },
  ].map((check) => ({
    ...check,
    status:
      check.actual === null ? 'unobserved' : check.actual === check.expected ? 'pass' : 'fail',
  }));
  const stats = touch.toRender;
  assert.equal(
    stats.histogram.reduce((sum, n) => sum + n, 0),
    stats.count,
  );
  assert(Number.isFinite(stats.maxMs) && stats.maxMs >= 0);
  const B =
    raw.externalCadence.status === 'measured-before-play' ? raw.externalCadence.baselineMs : null;
  const bound =
    stats.count >= 20
      ? quantileBound(stats.histogram, 0.95, app.histogramUpperBoundsMs, stats.maxMs)
      : null;
  const touchLatencyGate = {
    kind: 'touch',
    count: stats.count,
    minimumSamples: 20,
    B,
    limitMs: B ? 2 * B : null,
    quantileBound: bound,
    maxMs: stats.maxMs,
    toTick: touch.toTick,
    toRender: stats,
    scope:
      'External fixed pre-navigation B; internal application B remains independently recorded. Histogram bound, not exact p95.',
  };
  const quantileStatus =
    !B || !bound
      ? 'unobserved'
      : bound.upperInclusiveMs <= 2 * B
        ? 'pass-observed-window'
        : bound.lowerExclusiveMs >= 2 * B
          ? 'fail'
          : 'inconclusive';
  return {
    inputGateChecks,
    touchLatencyGate,
    inputGateStatus:
      inputGateChecks.some((check) => check.status === 'fail') || quantileStatus === 'fail'
        ? 'fail'
        : inputGateChecks.some((check) => check.status === 'unobserved')
          ? 'unobserved'
          : quantileStatus,
  };
}
export async function touchAssessment(plan, row, raw, command) {
  const source = touchSource(plan.sourceCohort);
  const spec = touchCase(plan.job, row.repetition);
  let failure = null;
  try {
    const [{ quantileBound }, { calibrateSettledCadence }, { PUBLIC_SECURITY_HEADERS }] =
      await Promise.all([
        import('./solo-qualification.mjs'),
        import('./solo-qualification-cadence.mjs'),
        import('./game-cli.mjs'),
      ]);
    assert.equal(command.status, 'closed');
    assert([0, 2].includes(command.exitCode));
    assert(!command.forcedCleanup && !command.cleanupUnconfirmed && !command.violation);
    assert.deepEqual(command.survivors, []);
    assert.deepEqual(command.ambiguous, []);
    assert.equal(raw.format, 'SoloHostedNativeTouchV1');
    assert.equal(raw.status, 'pass');
    assert.deepEqual(raw.job, spec);
    assert.equal(raw.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
    assert.deepEqual(raw.environment.viewport, spec.context.viewport);
    assert.equal(raw.environment.dpr, spec.context.deviceScaleFactor);
    assert.equal(raw.nativeCapability.syntheticDOMEvents, false);
    if (spec.engine === 'chromium') assert(raw.environment.maxTouchPoints > 0);
    assert.equal(raw.buildIdentity.sourceRevision, source.revision);
    assert.equal(raw.artifact.sourceRevision, source.revision);
    assert.equal(raw.artifact.sourceTree, source.tree);
    assert.equal(raw.artifact.manifestSHA256, plan.candidate.manifestSHA256);
    assert.deepEqual(raw.artifact.archiveIdentity, plan.candidate.inner);
    assert.equal(raw.observedBrowserClosed, true);
    assert.deepEqual(raw.errors, []);
    for (const key of [
      'failure',
      'deadlineReached',
      'contactCleanupFailure',
      'contextCloseFailure',
      'browserCloseFailure',
      'partialExportFailure',
      'partialReplay',
      'errorOverflow',
      'failedRequestOverflow',
    ])
      assert(!raw[key], key);
    assert.equal(raw.nativeReplay.status, 'pass');
    assert.equal(raw.nativeReplay.engine, row.engine);
    assert.equal(raw.nativeReplay.browserVersion, raw.browserVersion);
    assert.deepEqual(raw.nativeReplay.buildIdentity, raw.buildIdentity);
    assert.equal(raw.nativeReplay.csp, raw.csp);
    assert.equal(raw.buildIdentity.sha256, raw.artifact.buildInfoSHA256);
    assert.deepEqual(raw.nativeReplay.recording, {
      bytes: raw.recording.bytes,
      sha256: raw.recording.sha256,
    });
    assert.equal(raw.nativeReplay.observation.match, true);
    assert.equal(raw.nativeReplay.observation.status, 'pass');
    assert(raw.nativeReplay.modules.length > 0 && raw.nativeReplay.modules.length < 256);
    assert(
      raw.nativeReplay.modules.every(
        (module) => !module.failure && module.status === 200 && module.csp === raw.csp,
      ),
    );
    assert.deepEqual(raw.nativeReplay.expected, {
      browserVersion: raw.browserVersion,
      buildIdentity: raw.buildIdentity,
      csp: raw.csp,
    });
    assert.deepEqual(raw.nativeReplay.pageErrors, []);
    assert.deepEqual(raw.nativeReplay.failedRequests, []);
    assert.deepEqual(raw.externalCadence, calibrateSettledCadence(raw.externalCadence.state));
    const latency = touchLatency(raw, quantileBound);
    for (const [key, value] of Object.entries(latency)) assert.deepEqual(raw[key], value);
    assertTouchMovement(raw, spec);
    assertTouchEvents(raw, spec);
    assert(
      ['pass-observed-window', 'fail', 'inconclusive', 'unobserved'].includes(raw.inputGateStatus),
    );
    assert.equal(command.exitCode, raw.inputGateStatus === 'fail' ? 2 : 0);
  } catch (error) {
    failure = String(error.message);
  }
  return {
    status:
      failure || raw.inputGateStatus === 'fail'
        ? 'failed'
        : raw.inputGateStatus === 'pass-observed-window'
          ? 'passed'
          : 'inconclusive',
    nativeInputCorrectness: failure ? 'fail' : 'pass',
    rawInputGateStatus: raw?.inputGateStatus ?? 'unobserved',
    failure,
    performanceQualification: 'excluded',
    physicalQualification: 'unobserved',
    scope:
      'Public trusted native touch and strict replay; independent raw application submission-latency bound only. No general performance or physical-device pass.',
  };
}
export async function runTouchRow(ctx, row, dir, tmp) {
  const source = touchSource(ctx.plan.sourceCohort);
  await verifyInputs(ctx);
  const { startProductionPreview } = await import(
    pathToFileURL(join(ctx.here, 'serve-production-preview.mjs'))
  );
  const { PUBLIC_SECURITY_HEADERS } = await import(pathToFileURL(join(ctx.here, 'game-cli.mjs')));
  for (const ref of Object.values(ctx.modeState.executables))
    assert.deepEqual(await ctx.digest(ref.path), { bytes: ref.bytes, sha256: ref.sha256 });
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads.candidate,
      port: 0,
      fixtureAccess: true,
      cache: 'policy',
    });
    const response = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length < MiB);
    const build = JSON.parse(bytes);
    assert.equal(build.sourceRevision, source.revision);
    for (const [name, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(name), value);
    const execution = {
      format: 'SoloHostedTouchExecutionV1',
      ...(ctx.plan.sourceCohort ? { sourceCohort: ctx.plan.sourceCohort } : {}),
      job: touchCase(ctx.plan.job, row.repetition),
      protocol: TOUCH_PROTOCOL,
      artifact: {
        ...ctx.admitted.artifacts.candidate,
        buildInfoSHA256: createHash('sha256').update(bytes).digest('hex'),
      },
      address: new URL('game/', server.url).href,
      fixture: { ...ctx.plan.fixture, path: resolve(ctx.repository, ctx.plan.fixture.path) },
      browserModule: ctx.browserModule,
      chromeExecutable: ctx.chromeExecutable,
      scratch: tmp,
    };
    const path = join(dir, 'execution-plan.json');
    await writeFile(path, JSON.stringify(execution, null, 2) + '\n', { flag: 'wx' });
    row.served = {
      address: execution.address,
      fixtureAccess: server.fixtureAccess,
      mode: server.mode,
      build,
    };
    row.artifactAdmission = execution.artifact;
    row.command = await ctx.run(
      row.id,
      touchDisplayCommand(ctx.modeState.executables, [
        process.execPath,
        join(ctx.here, 'observe-solo-native-touch.mjs'),
        path,
        join(dir, 'report.json'),
      ]),
      row.timeoutMs,
      {
        env: { ...ctx.cleanEnv, TMPDIR: tmp },
        log: join(dir, 'command.log'),
        receipt: join(dir, 'command.json'),
        inspect: async () => {
          await ctx.inspect();
          assert((await ctx.evidenceSize(dir)) <= ctx.plan.rowEvidenceBytes);
        },
      },
    );
    const raw = await readTouchJSON(join(dir, 'report.json'));
    Object.assign(row, await touchAssessment(ctx.plan, row, raw, row.command));
    if (raw.recording) {
      assert.equal(raw.recording.path, join(dir, 'report.json.replay.json'));
      const replay = await ctx.digest(raw.recording.path);
      assert.deepEqual(replay, { bytes: raw.recording.bytes, sha256: raw.recording.sha256 });
      assert(replay.bytes <= TOUCH_PROTOCOL.replayBytes);
    }
    row.browserVersion = raw.browserVersion;
    await verifyInputs(ctx);
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((e) => (e ? no(e) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('Touch preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, job] = process.argv.slice(2);
  const bytes = await readFile(input);
  const manifest = JSON.parse(bytes);
  if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(touchMatrix(manifest))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindTouchJob(manifest, job);
    plan.manifestInput = {
      path: resolve(input),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
