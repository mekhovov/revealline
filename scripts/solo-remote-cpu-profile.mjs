import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { readSupplementalJSON } from './solo-remote-supplemental.mjs';

const MiB = 1024 ** 2;
export const CPU_PROFILE_SOURCE = '3adcd53792043ef02459e86168c6b33a66d6ef00';
export const CPU_PROFILE_RECIPE =
  'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5';
export const LONG_RAIL_CPU_SOURCE = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
export const LONG_RAIL_CPU_RECIPE =
  'b9afaecaadcbd0f657dd8064b9f7932c0c7ec12d6433f7d2b76f60de7ef19528';
export const FIRST_VICTORY_CPU_SOURCE = 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17';
export const FIRST_VICTORY_CPU_RECIPE =
  '561510be9786c949f65e6fcf0c0352e7e892c710ec80958e7139040e3911caa1';
const firstVictory = (plan) => plan?.phase === 'first-victory-cpu-profile';
const longRail = (plan) => plan?.phase === 'long-rail-cpu-profile';
const source = (plan) =>
  firstVictory(plan)
    ? FIRST_VICTORY_CPU_SOURCE
    : longRail(plan)
      ? LONG_RAIL_CPU_SOURCE
      : CPU_PROFILE_SOURCE;
const recipeHash = (plan) =>
  firstVictory(plan)
    ? FIRST_VICTORY_CPU_RECIPE
    : longRail(plan)
      ? LONG_RAIL_CPU_RECIPE
      : CPU_PROFILE_RECIPE;
const rowDefinition = (plan) => ({
  id: firstVictory(plan)
    ? 'first-victory-cpu-profile-chromium-candidate'
    : longRail(plan)
      ? 'long-rail-cpu-profile-chromium-candidate'
      : 'cold-cpu-profile-chromium-candidate',
  kind: 'cpu-profile',
  source: 'candidate',
  engine: 'chromium',
  timeoutMs: 480000,
  performanceExclusion: true,
});
const references = (plan) => [
  plan.recipe,
  ...(longRail(plan) ? [plan.upload] : []),
  ...plan.adapterInputs,
  ...plan.frozenTools,
];

export function longRailProfileOrigin() {
  return {
    run: 39015298582,
    job: 117346097375,
    artifact: 12094722207,
    artifactBytes: 771453,
    artifactSHA256: 'f6aeb2f30c77beeb53e367fb2a50bf570dc46299974f820a750d72ee61334953',
    calibrationSHA256: 'd8969abe0039b2ba6b40202a6e9eb6f07832bd0cc05ac341af9c3ce2c038b9f2',
    reportSHA256: '6b9fc01476295961c91ea9ca263df4dd083e5342ad85fa789185162a17b6597f',
    commandSHA256: 'c4a0fc245cd19724b3006c1e49d4500c57497bea9801cd2155b1af21dc699519',
    rate: 4.19,
    originalTarget: 1000,
    originalVerification: [956, 1000.5, 1011.5],
    newHostCalibration: false,
    scope: 'fixed-diagnostic-factor-only',
    predecessorScenarioStatus: 'fail',
    predecessorCommandStatus: 'closed',
    predecessorExitCode: 1,
    predecessorForcedCleanup: false,
    predecessorSurvivors: 0,
    predecessorAmbiguous: 0,
  };
}

export function firstVictoryProfileOrigin() {
  return {
    run: 39044567236,
    job: 117430670106,
    artifact: 12105263002,
    artifactBytes: 321167,
    artifactSHA256: '144684a77dc08ef29353dc3a7f5f57d2cac72425f488998e01ed8b2f697cf0d3',
    calibrationSHA256: 'ca43b506baa91e8d124dac9f4579d0e6d737416b29c2114904c264e647ef3549',
    reportSHA256: 'cd3e2bac36df06e262f2a562be4b9d31ec9c936a66cc348afdcf784d872dd63a',
    commandSHA256: 'cb0e3b3a776fed9c88b29c64dd29e312d13958a4ee8a71502a63b29622b52d9f',
    rate: 2.42,
    originalTarget: 1000,
    originalVerification: [927.5, 986, 865],
    newHostCalibration: false,
    scope: 'fixed-diagnostic-factor-only',
    predecessorScenarioStatus: 'fail',
    predecessorCommandStatus: 'closed',
    predecessorExitCode: 1,
    predecessorForcedCleanup: false,
    predecessorSurvivors: 0,
    predecessorAmbiguous: 0,
  };
}

export function validateCpuProfilePlan(plan) {
  assert.equal(plan.format, 'SoloHostedCpuProfilePlanV1');
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert(
    ['cold-cpu-profile', 'long-rail-cpu-profile', 'first-victory-cpu-profile'].includes(plan.phase),
  );
  const victory = firstVictory(plan),
    current = longRail(plan) || victory;
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.candidate.revision, source(plan));
  if (victory) {
    assert.equal(plan.sourceCohort, 'first-victory-e1cc-main8b-v1');
    assert.equal(plan.candidate.tree, '58f19392e25384620d896098fce8616b538e318d');
    assert.equal(plan.runtimeRevision, FIRST_VICTORY_CPU_SOURCE);
    assert.equal(plan.candidate.run, 39037874955);
    assert.equal(plan.candidate.artifact, 12104590541);
    assert.deepEqual(plan.candidate.outer, {
      bytes: 1091965213,
      sha256: 'fb85094a61cdc329ccf8a1488b6e3ca1043ef5f249a6b33729bb04141336af1e',
    });
    assert.deepEqual(plan.candidate.inner, {
      bytes: 1073790972,
      sha256: '6c8bbb6aafe3f9d55e2fb445d5846a5e9d02ebd648c4e630889743bf76ec421e',
    });
    assert.equal(
      plan.candidate.manifestSHA256,
      '23f555db20036838cc1601f2cebf8f1a75eb62fb0c6cf36f1e1988035b3e1b64',
    );
    assert.equal(plan.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
    assert.equal(plan.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
    for (const key of ['artifact', 'reusableArtifact', 'publisher', 'buildCommand'])
      assert.equal(plan.baseline[key], undefined);
    assert.equal(plan.upload, undefined);
  } else if (current) {
    assert.equal(plan.sourceCohort, 'long-rail-a6-main8b-v1');
    assert.equal(plan.candidate.tree, '6b13627e324f695b6ee8d9f2dee2eeeb7217c332');
    assert.equal(plan.runtimeRevision, '32abd322afd8243e4537ce4784e2f78ee45ecbec');
    assert.equal(plan.candidate.run, 39008793814);
    assert.equal(plan.candidate.artifact, 12092903788);
    assert.deepEqual(plan.candidate.outer, {
      bytes: 1091879339,
      sha256: 'a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a',
    });
    assert.deepEqual(plan.candidate.inner, {
      bytes: 1073755490,
      sha256: '52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1',
    });
    assert.equal(
      plan.candidate.manifestSHA256,
      'b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7',
    );
    assert.equal(plan.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
    assert.equal(plan.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
    for (const key of ['artifact', 'reusableArtifact', 'publisher', 'buildCommand'])
      assert.equal(plan.baseline[key], undefined);
    assert.deepEqual(plan.upload, {
      path: 'docs/performance/fixtures/solo-remote-timing/long-rail.xonix.fixture',
      bytes: 3563,
      sha256: '821897e571449bb5ec27678eef09c5955d9e9be873aaaf76736ff1aadbd0d84c',
    });
  } else {
    assert.equal(plan.sourceCohort, undefined);
    assert.equal(plan.upload, undefined);
    assert.equal(plan.baseline.revision, 'b11745223861c3973ad4bf440cc536198b8e0371');
    assert(plan.baseline.reusableArtifact);
  }
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.cpu, victory ? 2.42 : current ? 4.19 : 2.46);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.automaticPhaseContinuation, false);
  assert.equal(plan.maxParallel, 1);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.deepEqual(plan.rows, [rowDefinition(plan)]);
  assert.equal(plan.recipe.sha256, recipeHash(plan));
  if (current) assert.equal(plan.recipe.bytes, victory ? 3527 : 4562);
  assert.equal(
    plan.recipe.path,
    victory
      ? 'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-e1cc.qualification.fixture'
      : current
        ? 'docs/performance/fixtures/solo-remote-timing/long-rail.qualification.fixture'
        : 'docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
  );
  assert.deepEqual(plan.profile, {
    maximumMs: 240000,
    maximumBytes: 64 * MiB,
    samplingIntervalUs: 1000,
    traceBytes: 0,
    screenshots: false,
    heap: false,
  });
  assert.equal(plan.release.scope, 'single-causal-cpu-profile');
  if (victory) {
    assert.equal(plan.release.firstEightRequired, false);
    assert.equal(plan.release.firstEightAllCorrectnessPassed, undefined);
  } else assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release.performanceQualification, 'excluded-cpu-profiling');
  if (victory) {
    assert.equal(plan.release.predecessorRun, 39044567236);
    assert.equal(plan.release.priorProofInspected, true);
    assert.equal(plan.release.noUnclosedOwners, true);
    assert.equal(plan.release.ownerClosureScope, 'specific-next-chromium-r2-command-only');
    assert.equal(plan.release.allPriorPlannedJobsClosed, undefined);
    assert.equal(plan.release.onceOnlyBefore, '7c7cc2648331870683ac7b76850bbeff859f802e');
    assert.deepEqual(plan.stressOrigin, firstVictoryProfileOrigin());
  } else if (current) {
    assert.equal(plan.release.predecessorRun, 39015298582);
    assert.equal(plan.release.priorProofInspected, true);
    assert.equal(plan.release.noUnclosedOwners, true);
    assert.equal(plan.release.ownerClosureScope, 'specific-long-rail-chromium-r1-command-only');
    assert.equal(plan.release.allPriorPlannedJobsClosed, undefined);
    assert.equal(plan.release.siblingQualificationJobsMayRemainActive, true);
    assert.equal(plan.release.onceOnlyBefore, 'c41a02216c0811952232a387fd1743e09452c269');
    assert.deepEqual(plan.stressOrigin, longRailProfileOrigin());
  } else {
    assert.equal(plan.release.predecessorRun, 38991754594);
    for (const key of ['priorProofInspected', 'noUnclosedOwners', 'allPriorPlannedJobsClosed'])
      assert.equal(plan.release[key], true);
    assert.equal(plan.stressOrigin.run, 38991754594);
    assert.equal(plan.stressOrigin.artifact, 12085597903);
    assert.equal(plan.stressOrigin.rate, 2.46);
    assert.equal(plan.stressOrigin.newHostCalibration, false);
    assert.equal(plan.stressOrigin.scope, 'fixed-diagnostic-factor-only');
  }
  assert.deepEqual(
    plan.adapterInputs.map(({ path }) => path),
    ['scripts/solo-remote-cpu-profile.mjs', 'scripts/solo-remote-baseline.mjs'],
  );
  assert(plan.frozenTools.length > 0 && plan.frozenTools.length <= 64);
  assert.equal(new Set(references(plan).map(({ path }) => path)).size, references(plan).length);
  for (const path of [
    'scripts/solo-qualification-cpu-profile.mjs',
    'scripts/solo-remote-supplemental.mjs',
    'scripts/qualify-solo-runtime.mjs',
    'scripts/run-solo-remote-correctness.mjs',
    ...(victory
      ? [
          'scripts/solo-qualification-next-route.mjs',
          'scripts/solo-qualification-hitch-journal.mjs',
        ]
      : []),
    ...(current
      ? [
          'scripts/soundtrack-distribution.mjs',
          'scripts/optional-distribution.mjs',
          'scripts/external-distribution.mjs',
          'scripts/optional-artwork.mjs',
          'scripts/verify-solo-build.mjs',
        ]
      : []),
  ])
    assert(plan.frozenTools.some((ref) => ref.path === path));
  for (const ref of references(plan)) {
    assert(/^(scripts|game|docs)\//.test(ref.path) && !ref.path.split('/').includes('..'));
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}
export function bindCpuProfileJob(manifest) {
  assert.equal(manifest.format, 'SoloHostedCpuProfileManifestV1');
  return validateCpuProfilePlan({
    ...structuredClone(manifest),
    format: 'SoloHostedCpuProfilePlanV1',
    rows: [rowDefinition(manifest)],
  });
}
export function cpuProfileMatrix(manifest) {
  const plan = bindCpuProfileJob(manifest);
  return {
    include: [
      {
        phase: plan.phase,
        engine: 'chromium',
        jobMinutes: 130,
        stepMinutes: 78,
        outerSeconds: 4620,
      },
    ],
  };
}
async function verifyInputs(ctx) {
  for (const ref of references(ctx.plan)) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/'));
    assert.equal(await realpath(path), path);
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}
export async function prepareCpuProfileMode(ctx) {
  validateCpuProfilePlan(ctx.plan);
  await verifyInputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  const input = join(ctx.work, 'cpu-profile-inputs');
  await mkdir(input);
  const recipePath = join(input, 'scenario.qualification.json');
  await copyFile(resolve(ctx.repository, ctx.plan.recipe.path), recipePath);
  assert.deepEqual(await ctx.digest(recipePath), {
    bytes: ctx.plan.recipe.bytes,
    sha256: ctx.plan.recipe.sha256,
  });
  await copyFile(recipePath, join(ctx.evidence, 'scenario.qualification.json'));
  if (longRail(ctx.plan)) {
    const upload = join(input, 'long-rail.xonix.json');
    await copyFile(resolve(ctx.repository, ctx.plan.upload.path), upload);
    assert.deepEqual(await ctx.digest(upload), {
      bytes: ctx.plan.upload.bytes,
      sha256: ctx.plan.upload.sha256,
    });
    await copyFile(upload, join(ctx.evidence, 'long-rail.xonix.json'));
  }
  const scenario = await readSupplementalJSON(recipePath, MiB);
  assert.equal(scenario.timeoutMs, ctx.plan.profile.maximumMs);
  assert.equal(scenario.kind, 'performance');
  assert(scenario.expectedReplayDefinition && scenario.replayRequirements);
  Object.assign(ctx.report, {
    performanceExclusion: true,
    performanceQualification: 'excluded-cpu-profiling',
    ...(firstVictory(ctx.plan)
      ? { firstEightRequired: false }
      : { firstEightAllCorrectnessPassed: false }),
    releaseScope: ctx.plan.release.scope,
    stressOrigin: ctx.plan.stressOrigin,
  });
  return { recipePath };
}
export function cpuProfileArguments(ctx, url, dir) {
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    ctx.modeState.recipePath,
    join(dir, 'report.json'),
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    `--cpu=${firstVictory(ctx.plan) ? 2.42 : longRail(ctx.plan) ? 4.19 : 2.46}`,
    '--browser=chromium',
    `--source-revision=${source(ctx.plan)}`,
    '--cpu-profile',
    ...(firstVictory(ctx.plan)
      ? ['--hitch-journal', '--authored-next-route=authored-next-geometric-v1']
      : []),
  ];
}
export function cpuProfileAssessment(plan, raw, command, profileReadback) {
  const profile = raw?.cpuProfile,
    replay = raw?.replay?.nativeVerification;
  const correct =
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0 &&
    raw?.format === 'SoloQualificationReportV1' &&
    raw.kind === 'cpu-profile' &&
    raw.scenarioKind === 'performance' &&
    raw.audioProof === false &&
    raw.scenarioStatus === 'pass' &&
    raw.scenarioSHA256 === recipeHash(plan) &&
    raw.sourceRevision === source(plan) &&
    raw.buildIdentity?.sourceRevision === source(plan) &&
    raw.environment?.engine === 'chromium' &&
    raw.environment.cpuThrottle === plan.cpu &&
    raw.environment.contextMode === 'ephemeral' &&
    typeof raw.environment.browserVersion === 'string' &&
    raw.environment.requestedDisplay?.viewport?.width === 1280 &&
    raw.environment.requestedDisplay.viewport.height === 800 &&
    raw.environment.requestedDisplay.deviceScaleFactor === 1 &&
    raw.environment.requestedDisplay.isMobile === false &&
    raw.environment.requestedDisplay.hasTouch === false &&
    raw.workProbe === true &&
    raw.cadenceProtocol === 'settled120' &&
    raw.baselineRuntime === false &&
    raw.replay?.scope === 'completed-scenario' &&
    replay?.status === 'pass' &&
    replay.engine === 'chromium' &&
    replay.browserVersion === raw.environment.browserVersion &&
    raw.pageErrors?.length === 0 &&
    !raw.failure &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure &&
    (!firstVictory(plan) ||
      (raw.hitchJournal?.status === 'complete' &&
        !raw.hitchJournalFailure &&
        raw.actions?.filter((a) => a.type === 'authored-next-route').length === 1 &&
        raw.actions.some(
          (a) =>
            a.type === 'authored-next-route' &&
            a.status === 'pass' &&
            a.protocol === 'authored-next-geometric-v1' &&
            a.mission === 'first-return' &&
            a.unsettled === 0 &&
            a.heldKeys?.length === 0,
        )));
  const retained =
    profileReadback?.status === 'passed' &&
    profile?.status === 'retained' &&
    profile.maximumMs === plan.profile.maximumMs &&
    profile.samplingIntervalUs === plan.profile.samplingIntervalUs &&
    !profile.limitReached &&
    profile.stopReason === 'actions-ended' &&
    Number.isSafeInteger(profile.sampleCount) &&
    profile.sampleCount > 0 &&
    Number.isSafeInteger(profile.nodeCount) &&
    profile.nodeCount > 0 &&
    profile.bytes === profileReadback.bytes &&
    profile.sha256 === profileReadback.sha256 &&
    profile.bytes > 0 &&
    profile.bytes <= plan.profile.maximumBytes &&
    !raw.cpuProfileFailure &&
    !raw.cpuProfileLimit;
  return {
    status:
      correct && retained && raw?.performanceGateStatus === 'excluded-cpu-profiling'
        ? 'passed'
        : 'failed',
    nativeRecipeCorrectness: correct ? 'pass' : 'fail',
    profileRetention: retained ? 'pass' : 'fail',
    rawPerformanceGateStatus: raw?.performanceGateStatus ?? 'unobserved',
    performanceQualification: 'excluded-cpu-profiling',
    ...(firstVictory(plan)
      ? { firstEightRequired: false }
      : { firstEightAllCorrectnessPassed: false }),
    scope:
      'One causal JavaScript CPU profile; no timing, device, thermal, trace or prerequisite credit. Fixed stress factor is not calibrated on this host.',
  };
}
export async function runCpuProfileRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  const { startProductionPreview } = await import('./serve-production-preview.mjs');
  const { PUBLIC_SECURITY_HEADERS } = await import('./game-cli.mjs');
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
    const bytes = Buffer.from(await response.arrayBuffer()),
      build = JSON.parse(bytes);
    assert.equal(build.sourceRevision, source(ctx.plan));
    for (const [name, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(name), value);
    const url = new URL('game/?journey=opening', server.url).href;
    row.served = {
      url,
      build,
      buildInfoSHA256: createHash('sha256').update(bytes).digest('hex'),
      headers: server.headers,
      mode: server.mode,
      fixtureAccess: server.fixtureAccess,
    };
    row.artifactAdmission = ctx.admitted.artifacts.candidate;
    row.command = await ctx.run(
      row.id,
      [process.execPath, ...cpuProfileArguments(ctx, url, dir)],
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
    const raw = await readSupplementalJSON(join(dir, 'report.json'));
    row.profileReadback = { status: 'failed' };
    try {
      const profilePath = join(dir, 'report.json.cpuprofile');
      assert.equal(raw.cpuProfile?.file, profilePath);
      assert.equal(await realpath(profilePath), profilePath);
      const info = await lstat(profilePath);
      assert(
        info.isFile() &&
          !info.isSymbolicLink() &&
          info.size > 0 &&
          info.size <= ctx.plan.profile.maximumBytes,
      );
      const identity = await ctx.digest(profilePath);
      assert.deepEqual(identity, { bytes: raw.cpuProfile.bytes, sha256: raw.cpuProfile.sha256 });
      row.profileReadback = { status: 'passed', ...identity };
    } catch (error) {
      row.profileReadback.failure = String(error);
    }
    Object.assign(row, cpuProfileAssessment(ctx.plan, raw, row.command, row.profileReadback));
    row.browserVersion = raw.environment?.browserVersion;
    await verifyInputs(ctx);
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((error) => (error ? no(error) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('CPU-profile owned preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output] = process.argv.slice(2),
    bytes = await readFile(input);
  if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(cpuProfileMatrix(JSON.parse(bytes)))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindCpuProfileJob(JSON.parse(bytes));
    plan.manifestInput = {
      path: resolve(input),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
