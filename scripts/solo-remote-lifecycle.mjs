// Actual native background/return is an excluded correctness diagnostic.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const MiB = 1024 ** 2;
export const LIFECYCLE_RUN_RETENTION_POLICY = 'retained-paused-run-with-visible-rejoin-v1';
export const LIFECYCLE_SOURCE = Object.freeze({
  revision: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  tree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
  runtime: '32abd322afd8243e4537ce4784e2f78ee45ecbec',
});
export const LIFECYCLE_FIXTURE = Object.freeze({
  path: 'docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
  bytes: 6387,
  sha256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
});
export const LIFECYCLE_PROTOCOL = Object.freeze({
  hiddenMs: 10000,
  returnPausedMs: 500,
  resumeObservationMs: 400,
  heldDirectionMs: 100,
  resumedFrameCapacity: 16,
  eventCapacity: 128,
  phaseCapacity: 64,
  observationTimeoutMs: 360000,
  replayTimeoutMs: 120000,
  cleanupTimeoutMs: 45000,
  reportBytes: 2 * MiB,
  replayBytes: 256 * 1024,
  syntheticDOMEvents: false,
  headed: true,
  display: '1280x800x24',
  connection: 'connectOverCDP',
  noDefaults: true,
  defaultContextOnly: true,
});
export const LIFECYCLE_PREDECESSOR = Object.freeze({
  sourceRevision: 'e0252ff8f6b7f5ac84721fd5994c74e8469fb271',
  driverBytes: 22613,
  driverSHA256: '894bc9082f9bdde863dc009f73d028d08b1ddadcb2179f2228610a5c5f11bdc9',
  automationWitnessSHA256: 'e74162b32fc580e9830e4fa956d9a83ba1939eb12902d4670caf536376ebf2c3',
  reportSHA256: 'dcaccf36a3cfe9182ed00bca83dd19e8d627faa2f365748d288598ea5ac27d8e',
  scope: 'Historical V4 Chromium protocol and provenance only; no current-source or hosted pass.',
});
export function lifecycleCase() {
  return {
    id: 'chromium-background-r1',
    engine: 'chromium',
    mode: 'background',
    repetition: 1,
    viewport: { width: 1280, height: 800 },
  };
}
export function assertLifecycleCandidate(candidate) {
  assert.equal(candidate.revision, LIFECYCLE_SOURCE.revision);
  assert.equal(candidate.tree, LIFECYCLE_SOURCE.tree);
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
export function validateLifecyclePlan(plan) {
  assert.equal(plan.format, 'SoloHostedLifecyclePlanV1');
  assert.equal(plan.status, 'reviewed-lifecycle-diagnostic-only');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assertLifecycleCandidate(plan.candidate);
  assert.equal(plan.runtimeRevision, LIFECYCLE_SOURCE.runtime);
  assert.deepEqual(plan.baseline, {
    revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
    tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  });
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.cpu, 1);
  assert.equal(plan.maxParallel, 1);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 55 * 60000);
  assert.equal(plan.rowEvidenceBytes, 16 * MiB);
  assert.equal(plan.evidenceBytes, 128 * MiB);
  assert.deepEqual(plan.protocol, LIFECYCLE_PROTOCOL);
  if (plan.runRetentionPolicy !== undefined)
    assert.equal(plan.runRetentionPolicy, LIFECYCLE_RUN_RETENTION_POLICY);
  assert.deepEqual(plan.fixture, LIFECYCLE_FIXTURE);
  assert.deepEqual(plan.predecessor, LIFECYCLE_PREDECESSOR);
  assert.equal(plan.job, 'chromium-background');
  assert.deepEqual(plan.release, {
    scope: 'real-native-background-correctness-only',
    candidateRevision: LIFECYCLE_SOURCE.revision,
    firstEightAllCorrectnessPassed: false,
    performanceQualification: 'excluded',
    physicalQualification: 'unobserved',
    webkitBackground: 'unsupported-unobserved',
    automaticRetries: 0,
    priorProofInspected: true,
    noUnclosedOwners: true,
    onceOnlyBefore: plan.release.onceOnlyBefore,
  });
  assert.match(plan.release.onceOnlyBefore, /^[a-f0-9]{40}$/);
  assert.deepEqual(plan.rows, [
    {
      id: lifecycleCase().id,
      source: 'candidate',
      kind: 'native-lifecycle',
      engine: 'chromium',
      repetition: 1,
      timeoutMs: 600000,
      performanceExclusion: true,
    },
  ]);
  assert.deepEqual(
    plan.adapterInputs.map((r) => r.path),
    ['scripts/solo-remote-lifecycle.mjs'],
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
  ])
    assert(plan.frozenTools.some((r) => r.path === 'scripts/' + name));
  return plan;
}
export function bindLifecycleJob(manifest, job) {
  assert.equal(manifest.format, 'SoloHostedLifecycleManifestV1');
  assert.deepEqual(manifest.jobs, ['chromium-background']);
  assert.equal(job, 'chromium-background');
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedLifecyclePlanV1';
  plan.job = job;
  plan.rows = [
    {
      id: lifecycleCase().id,
      source: 'candidate',
      kind: 'native-lifecycle',
      engine: 'chromium',
      repetition: 1,
      timeoutMs: 600000,
      performanceExclusion: true,
    },
  ];
  return validateLifecyclePlan(plan);
}
export function lifecycleMatrix(manifest) {
  bindLifecycleJob(manifest, 'chromium-background');
  return {
    include: [{ job: 'chromium-background', jobMinutes: 100, stepMinutes: 58, outerSeconds: 3420 }],
  };
}
export function assertSamePaused(before, after) {
  assert.equal(after.phase, 'paused');
  assert(Number.isSafeInteger(before.runId) && before.runId > 0);
  assert(Number.isSafeInteger(before.runTick) && before.runTick >= 0);
  assert.match(before.checkpoint?.hash ?? '', /^[a-f0-9]{16}$/);
  assert.equal(after.runId, before.runId, 'Paused run identity changed');
  assert.equal(after.runTick, before.runTick, 'Paused authoritative tick changed');
  assert.deepEqual(after.checkpoint, before.checkpoint, 'Paused authoritative checkpoint changed');
}
export function resumeBounds(before, probe) {
  assert(probe.frames.length > 0 && probe.frames.length <= 16);
  assert.equal(probe.resumeGesture?.type, 'click');
  assert.equal(probe.resumeGesture?.trusted, true);
  const first = probe.frames[0];
  const retained = probe.runRetentionPolicy !== undefined;
  if (retained) assert.equal(probe.runRetentionPolicy, LIFECYCLE_RUN_RETENTION_POLICY);
  const usePhase =
    probe.resumePhase?.atMs <= first.atMs &&
    (!retained ||
      (probe.resumePhase.runId === before.runId &&
        probe.resumePhase.runEvidence === 'submitted-board' &&
        probe.resumePhase.retainedIdentityMatched));
  const anchor = usePhase ? probe.resumePhase : probe.resumeGesture;
  assert(anchor && Number.isFinite(anchor.atMs) && anchor.atMs <= first.atMs);
  assert.equal(anchor.runId, before.runId);
  let previous = anchor.atMs;
  const bounds = probe.frames.map((frame) => {
    assert.equal(frame.phase, 'running');
    assert.equal(frame.runId, before.runId);
    if (retained) {
      assert.equal(frame.visibility, 'visible');
      assert.equal(frame.runEvidence, 'submitted-board');
      assert.equal(frame.retainedIdentityMatched, true);
      assert.equal(frame.identityFailure, false);
    }
    assert(Number.isFinite(frame.atMs) && frame.atMs >= previous);
    previous = frame.atMs;
    assert(Number.isSafeInteger(frame.runTick));
    const elapsedMs = frame.atMs - anchor.atMs;
    const maximumTicks = Math.ceil((elapsedMs * 120) / 1000) + 1;
    const actualTicks = frame.runTick - before.runTick;
    assert(actualTicks >= 0 && actualTicks <= maximumTicks, 'Resume accumulated hidden time debt');
    return { atMs: frame.atMs, elapsedMs, actualTicks, maximumTicks };
  });
  return {
    anchor,
    anchorKind: usePhase ? 'public-running-phase-mutation' : 'trusted-public-Resume-click',
    simulationRateHz: 120,
    roundingMarginTicks: 1,
    submittedFrameBounds: bounds,
  };
}
export function assertLifecycleProof(raw) {
  const state = (name) => {
    const matches = raw.snapshots.filter((v) => v.label === name);
    assert.equal(matches.length, 1, 'Missing or duplicate lifecycle snapshot: ' + name);
    return matches[0];
  };
  const initial = state('initial-running'),
    moving = state('before-interruption-held-right');
  assert.equal(initial.phase, 'running');
  assert.equal(initial.levelId, 'first-return');
  assert.equal(initial.visibility, 'visible');
  assert.equal(initial.focused, true);
  assert.equal(initial.trailCells, 0);
  assert.equal(moving.phase, 'running');
  assert.equal(moving.runId, initial.runId);
  assert(moving.player.x > initial.player.x);
  const hidden = state('hidden-paused'),
    held = state('hidden-after-ten-seconds');
  for (const value of [hidden, held]) assert.equal(value.visibility, 'hidden');
  assert.equal(hidden.runId, initial.runId);
  assertSamePaused(hidden, held);
  assert(Number.isFinite(held.atMs) && held.atMs - hidden.atMs >= 10000);
  const returned = state('returned-before-resume'),
    waiting = state('returned-still-paused');
  for (const value of [returned, waiting]) {
    assert.equal(value.visibility, 'visible');
    assert.equal(value.focused, true);
    assertSamePaused(hidden, value);
  }
  assert(waiting.atMs - returned.atMs >= 500);
  const before = state('before-explicit-resume');
  assertSamePaused(hidden, before);
  const { events, phases, frames, dropped } = raw.lifecycle;
  assert.deepEqual(dropped, { events: 0, phases: 0 });
  assert(events.length <= 128 && phases.length <= 64 && frames.length <= 16);
  const hiddenIndex = events.findIndex(
    (e) => e.type === 'visibilitychange' && e.visibility === 'hidden' && e.trusted,
  );
  assert(hiddenIndex >= 0);
  assert(
    events
      .slice(hiddenIndex + 1)
      .some((e) => e.type === 'visibilitychange' && e.visibility === 'visible' && e.trusted),
  );
  assert(
    events.some(
      (e) =>
        e.type === 'keyup' &&
        e.key === 'ArrowRight' &&
        e.trusted &&
        e.atMs <= raw.lifecycle.resumeGesture.atMs,
    ),
  );
  assert(
    events.some(
      (e) =>
        e.type === 'keydown' &&
        e.key === 'ArrowLeft' &&
        e.trusted &&
        e.atMs > raw.lifecycle.resumeGesture.atMs,
    ),
  );
  assert.deepEqual(raw.resumeWitness, resumeBounds(before, raw.resumeProbe));
  assert.deepEqual(
    raw.lifecycle.frames.slice(0, raw.resumeProbe.frames.length),
    raw.resumeProbe.frames,
  );
  assert.deepEqual(raw.lifecycle.resumeGesture, raw.resumeProbe.resumeGesture);
  assert.deepEqual(raw.lifecycle.resumePhase, raw.resumeProbe.resumePhase);
  const resumed = state('resumed-neutral-no-key'),
    fresh = state('fresh-movement');
  for (const value of [resumed, fresh]) {
    assert.equal(value.phase, 'running');
    assert.equal(value.runId, before.runId);
    assert.equal(value.visibility, 'visible');
    assert.equal(value.focused, true);
  }
  assert(resumed.runTick > before.runTick);
  assert(fresh.player.x < resumed.player.x);
  assert.equal(state('final-paused').phase, 'paused');
  assert.equal(state('final-paused').runId, before.runId);
  assertSamePaused(state('final-paused'), state('after-public-export'));
  if (raw.runRetentionPolicy !== undefined) {
    assert.equal(raw.runRetentionPolicy, LIFECYCLE_RUN_RETENTION_POLICY);
    for (const probe of [raw.lifecycle, raw.resumeProbe]) {
      assert.equal(probe.runRetentionPolicy, raw.runRetentionPolicy);
      assert.equal(probe.identityFailure, false);
    }
    const latched = state('retained-initial-running');
    assert.equal(latched.runId, initial.runId);
    assert.equal(latched.phase, 'running');
    for (const value of [
      latched,
      moving,
      resumed,
      fresh,
      state('final-paused'),
      state('after-public-export'),
      raw.lifecycle.current,
      ...frames,
    ]) {
      assert.equal(value.runId, initial.runId);
      assert.equal(value.runEvidence, 'submitted-board');
      assert.equal(value.retainedIdentityMatched, true);
      assert.equal(value.identityFailure, false);
      assert.equal(value.visibility, 'visible');
    }
    for (const value of [hidden, held, returned, waiting, before]) {
      assert.equal(value.identityFailure, false);
      assert(['submitted-board', 'retained-paused-reference'].includes(value.runEvidence));
      if (value.runEvidence === 'retained-paused-reference')
        assert.equal(value.submittedPaintTick, null);
      else assert.equal(value.retainedIdentityMatched, true);
    }
  }
}
export function assertLifecycleReplay(raw) {
  const final = raw.snapshots.find((value) => value.label === 'final-paused');
  assert(final && Number.isSafeInteger(final.runTick) && final.runTick > 0);
  assert.equal(
    raw.nativeReplay.observation.ticks,
    final.runTick,
    'Replay does not cover final live tick',
  );
  assert.deepEqual(
    raw.nativeReplay.observation.checkpoint,
    final.checkpoint,
    'Replay differs from final live checkpoint',
  );
  assert.equal(raw.nativeReplay.observation.definitionCheck.match, true);
  assert.equal(raw.nativeReplay.observation.levelId, 'first-return');
}
export async function lifecycleAssessment(plan, row, raw, command) {
  const { PUBLIC_SECURITY_HEADERS } = await import('./game-cli.mjs');
  let failure = null;
  try {
    assert.equal(command.status, 'closed');
    assert(!command.forcedCleanup && !command.cleanupUnconfirmed && !command.violation);
    assert.deepEqual(command.survivors, []);
    assert.deepEqual(command.ambiguous, []);
    assert.equal(command.exitCode, 0);
    assert.equal(raw.status, 'pass');
    assert.equal(raw.format, 'SoloHostedNativeLifecycleV1');
    assert.deepEqual(raw.job, lifecycleCase());
    assert.equal(row.id, lifecycleCase().id);
    assert.equal(raw.runtimeRevision, LIFECYCLE_SOURCE.runtime);
    assert.deepEqual(raw.protocol, LIFECYCLE_PROTOCOL);
    assert.equal(raw.runRetentionPolicy, plan.runRetentionPolicy);
    assert.equal(raw.observedBrowserClosed, true);
    assert.deepEqual(raw.connection, {
      method: 'connectOverCDP',
      noDefaults: true,
      isLocal: true,
      defaultContextOnly: true,
    });
    assert.equal(raw.ownedProcess.exited, true);
    assert.equal(raw.ownedProcess.exitCode, 0);
    assert.equal(raw.ownedProcess.exitSignal, null);
    assert.deepEqual(raw.errors, []);
    for (const key of [
      'failure',
      'deadlineReached',
      'cleanupFailure',
      'partialReplay',
      'partialExportFailure',
      'errorOverflow',
      'failedRequestOverflow',
      'navigationFailure',
      'crashed',
      'unexpectedPageClose',
      'spawnFailure',
    ])
      assert(!raw[key], key);
    assert.equal(raw.buildIdentity.sourceRevision, LIFECYCLE_SOURCE.revision);
    assert.equal(raw.artifact.sourceRevision, LIFECYCLE_SOURCE.revision);
    assert.equal(raw.artifact.sourceTree, LIFECYCLE_SOURCE.tree);
    assert.equal(raw.artifact.manifestSHA256, plan.candidate.manifestSHA256);
    assert.deepEqual(raw.artifact.archiveIdentity, plan.candidate.inner);
    assert.equal(raw.buildIdentity.sha256, raw.artifact.buildInfoSHA256);
    assert.equal(raw.nativeReplay.status, 'pass');
    assert.equal(raw.nativeReplay.engine, 'chromium');
    assert.equal(raw.nativeReplay.browserVersion, raw.browserVersion);
    assert.deepEqual(raw.nativeReplay.buildIdentity, raw.buildIdentity);
    assert.equal(raw.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
    assert.equal(raw.nativeReplay.csp, raw.csp);
    assert.deepEqual(raw.nativeReplay.recording, {
      bytes: raw.recording.bytes,
      sha256: raw.recording.sha256,
    });
    assert.equal(raw.nativeReplay.observation.match, true);
    assert.equal(raw.nativeReplay.observation.status, 'pass');
    assert(raw.nativeReplay.modules.length > 0 && raw.nativeReplay.modules.length < 256);
    assert(
      raw.nativeReplay.modules.every((m) => !m.failure && m.status === 200 && m.csp === raw.csp),
    );
    assert.deepEqual(raw.nativeReplay.expected, {
      browserVersion: raw.browserVersion,
      buildIdentity: raw.buildIdentity,
      csp: raw.csp,
    });
    assert.deepEqual(raw.nativeReplay.pageErrors, []);
    assert.deepEqual(raw.nativeReplay.failedRequests, []);
    assertLifecycleProof(raw);
    assertLifecycleReplay(raw);
  } catch (error) {
    failure = String(error.message);
  }
  return {
    status: failure ? 'failed' : 'passed',
    failure,
    observedLifecycle: raw?.status === 'unobserved' ? 'unobserved' : failure ? 'failed' : 'passed',
    performanceQualification: 'excluded',
    physicalQualification: 'unobserved',
    webkitBackground: 'unsupported-unobserved',
  };
}
export async function readLifecycleJSON(path, maximum = 2 * MiB) {
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
export function lifecycleDisplayCommand(executables, command) {
  assert.equal(executables['xvfb-run'].path, '/usr/bin/xvfb-run');
  assert(Array.isArray(command) && command.length > 0);
  return [
    executables['xvfb-run'].path,
    '--auto-servernum',
    '--server-args=-screen 0 1280x800x24',
    ...command,
  ];
}
export async function prepareLifecycleMode(ctx) {
  validateLifecyclePlan(ctx.plan);
  await verifyInputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  const actual = ctx.admitted.artifacts.candidate;
  assert.equal(actual.sourceRevision, LIFECYCLE_SOURCE.revision);
  assert.equal(actual.sourceTree, LIFECYCLE_SOURCE.tree);
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
    'lifecycle-display-preflight',
    lifecycleDisplayCommand(executables, [executables.xdpyinfo.path]),
    30000,
  );
  ctx.report.performanceExclusion = true;
  ctx.report.firstEightAllCorrectnessPassed = false;
  return {
    executables,
    scope:
      'Real hidden/visible desktop Chromium lifecycle correctness only; WebKit and physical iPhone suspension are unobserved. All timings excluded.',
  };
}
export async function runLifecycleRow(ctx, row, dir, tmp) {
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
    assert.equal(build.sourceRevision, LIFECYCLE_SOURCE.revision);
    for (const [name, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(name), value);
    const execution = {
      format: 'SoloHostedLifecycleExecutionV1',
      job: lifecycleCase(),
      runtimeRevision: LIFECYCLE_SOURCE.runtime,
      protocol: LIFECYCLE_PROTOCOL,
      ...(ctx.plan.runRetentionPolicy ? { runRetentionPolicy: ctx.plan.runRetentionPolicy } : {}),
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
      lifecycleDisplayCommand(ctx.modeState.executables, [
        process.execPath,
        join(ctx.here, 'observe-solo-native-lifecycle.mjs'),
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
    const raw = await readLifecycleJSON(join(dir, 'report.json'));
    Object.assign(row, await lifecycleAssessment(ctx.plan, row, raw, row.command));
    if (raw.recording) {
      assert.equal(raw.recording.path, join(dir, 'report.json.replay.json'));
      const replay = await ctx.digest(raw.recording.path);
      assert.deepEqual(replay, { bytes: raw.recording.bytes, sha256: raw.recording.sha256 });
      assert(replay.bytes <= LIFECYCLE_PROTOCOL.replayBytes);
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
          throw Error('Lifecycle preview close deadline');
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
    process.stdout.write(`matrix=${JSON.stringify(lifecycleMatrix(manifest))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindLifecycleJob(manifest, job);
    plan.manifestInput = {
      path: resolve(input),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
