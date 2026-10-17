// Diagnostic native admission for new public-control recipes. Timing results
// remain raw evidence and never release a performance prerequisite.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const MiB = 1024 ** 2;
const SOURCE = {
  baseline: 'b11745223861c3973ad4bf440cc536198b8e0371',
  candidate: '3adcd53792043ef02459e86168c6b33a66d6ef00',
};
export const SUPPLEMENTAL_PHASES = Object.freeze({
  'latency-long-rail': '6815653eadf5a4e05435be5e87bc933ba5e17b7d10fb51032988c274dd651802',
  'latency-sentry': '225c05486cb28516086acf3bbefb2bd4bcdabe30d5e1a990c7c07137f583a5d9',
  'erosion-first-fracture': '3e2c56b4c5aae3343986a8a68d39e402a9822f66093c6556b99042e24947604e',
  'jammer-neutral': 'aa2cbdbba30450e296b75f7458afa101dcd6ad0bc5858dd2de5ffc2dcc1e2c34',
  'jammer-steering': '9169d2a4d583b563cb322d5e374bb62179ef5d6dfa2c2f3d5351926969e5b78f',
});
const engines = ['chromium', 'webkit'];
function validateRelease(plan) {
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.release?.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release?.performanceQualification, 'excluded');
  assert.equal(plan.release?.scope, 'supplemental-native-preflight');
  assert.equal(plan.release?.predecessorRun, 38985941469);
  assert.equal(plan.release?.candidateRevision, SOURCE.candidate);
  for (const key of ['priorProofInspected', 'noUnclosedOwners', 'allPriorPlannedJobsClosed'])
    assert.equal(plan.release[key], true);
  const previous = Object.keys(SUPPLEMENTAL_PHASES).indexOf(plan.phase) - 1;
  assert.equal(
    plan.release.previousPhase,
    previous < 0 ? 'reviewed-first-eight-diagnostic' : Object.keys(SUPPLEMENTAL_PHASES)[previous],
  );
  assert(Array.isArray(plan.release.evidence) && plan.release.evidence.length > 0);
  assert(plan.release.evidence.length <= 32);
  for (const row of plan.release.evidence) {
    assert(Number.isSafeInteger(row.runId) && row.runId > 0);
    assert(Number.isSafeInteger(row.artifactId) && row.artifactId > 0);
    for (const key of ['artifactSHA256', 'summarySHA256']) assert.match(row[key], /^[a-f0-9]{64}$/);
  }
}
function expectedRows(plan, engine) {
  return ['baseline', 'candidate'].map((source) => ({
    id: `${plan.phase}-${engine}-${source}`,
    kind: 'supplemental',
    source,
    engine,
    timeoutMs: 480000,
    performanceExclusion: true,
  }));
}
export function validateSupplementalPlan(plan) {
  assert.equal(plan.format, 'SoloHostedSupplementalPlanV1');
  assert(Object.hasOwn(SUPPLEMENTAL_PHASES, plan.phase));
  validateRelease(plan);
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.candidate.revision, SOURCE.candidate);
  assert.equal(plan.baseline.revision, SOURCE.baseline);
  assert(plan.baseline.reusableArtifact);
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.cpu, 1);
  assert.equal(plan.maxParallel, 2);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.automaticPhaseContinuation, false);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.evidenceBytes, 256 * MiB);
  assert.equal(plan.rowEvidenceBytes, 32 * MiB);
  assert(engines.includes(plan.engine));
  assert.deepEqual(plan.rows, expectedRows(plan, plan.engine));
  assert.deepEqual(Object.keys(plan.phases), Object.keys(SUPPLEMENTAL_PHASES));
  for (const [name, phase] of Object.entries(plan.phases)) {
    assert.equal(phase.recipe.sha256, SUPPLEMENTAL_PHASES[name]);
    assert.equal(phase.scenarioTimeoutMs, 240000);
    assert(/^[a-z0-9-]+\.xonix\.json$/.test(phase.upload.stagedName));
  }
  assert.deepEqual(
    plan.adapterInputs.map(({ path }) => path),
    ['scripts/solo-remote-supplemental.mjs', 'scripts/solo-remote-baseline.mjs'],
  );
  assert(plan.frozenTools.length > 0 && plan.frozenTools.length <= 64);
  assert.equal(new Set(plan.frozenTools.map(({ path }) => path)).size, plan.frozenTools.length);
  for (const name of [
    'qualify-solo-runtime.mjs',
    'solo-qualification.mjs',
    'solo-qualification-native-replay.mjs',
    'solo-qualification-replay-core.mjs',
    'solo-qualification-observation.mjs',
    'solo-qualification-browser-context.mjs',
    'solo-qualification-cadence.mjs',
    'solo-qualification-export.mjs',
    'solo-qualification-replay-identity.mjs',
    'run-solo-remote-correctness.mjs',
    'solo-remote-archive.py',
    'verify-solo-build.mjs',
    'serve-production-preview.mjs',
    'game-cli.mjs',
  ])
    assert(plan.frozenTools.some(({ path }) => path === `scripts/${name}`));
  for (const ref of inputReferences(plan)) {
    assert(/^(scripts|game|docs)\//.test(ref.path) && !ref.path.split('/').includes('..'));
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
  }
  return plan;
}
export function bindSupplementalJob(manifest, engine) {
  assert.equal(manifest.format, 'SoloHostedSupplementalManifestV1');
  assert.deepEqual(manifest.engines, engines);
  const plan = structuredClone(manifest);
  delete plan.engines;
  plan.format = 'SoloHostedSupplementalPlanV1';
  plan.engine = engine;
  plan.rows = expectedRows(plan, engine);
  return validateSupplementalPlan(plan);
}
export function supplementalMatrix(manifest) {
  return {
    include: engines.map((engine) => {
      const plan = bindSupplementalJob(manifest, engine);
      return { phase: plan.phase, engine, jobMinutes: 130, stepMinutes: 78, outerSeconds: 4620 };
    }),
  };
}
function inputReferences(plan) {
  return [
    ...Object.values(plan.phases).flatMap(({ recipe, upload }) => [recipe, upload]),
    ...plan.adapterInputs,
    ...plan.frozenTools,
  ];
}
export async function readSupplementalJSON(path, maximum = 32 * MiB) {
  const info = await lstat(path);
  assert(info.isFile() && !info.isSymbolicLink() && info.size <= maximum);
  assert.equal(await realpath(path), resolve(path));
  const file = await open(path, 'r');
  try {
    const before = await file.stat();
    assert(before.dev === info.dev && before.ino === info.ino && before.size === info.size);
    const buffer = Buffer.alloc(maximum + 1);
    let count = 0;
    while (count < buffer.length) {
      const part = await file.read(buffer, count, buffer.length - count, count);
      if (!part.bytesRead) break;
      count += part.bytesRead;
    }
    assert(count <= maximum && count === info.size);
    const after = await file.stat();
    assert(after.size === before.size && after.mtimeMs === before.mtimeMs);
    return JSON.parse(buffer.subarray(0, count).toString('utf8'));
  } finally {
    await file.close();
  }
}
async function verifyInputs(ctx) {
  for (const ref of inputReferences(ctx.plan)) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/'));
    assert.equal(await realpath(path), path);
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}
export async function prepareSupplementalMode(ctx) {
  validateSupplementalPlan(ctx.plan);
  await verifyInputs(ctx);
  await ctx.ensureBaseline();
  assert.equal(ctx.admitted.status, 'passed');
  const input = join(ctx.work, 'supplemental-inputs');
  await mkdir(input);
  const phase = ctx.plan.phases[ctx.plan.phase];
  for (const [ref, name] of [
    [phase.recipe, 'scenario.qualification.json'],
    [phase.upload, phase.upload.stagedName],
  ]) {
    const target = join(input, name);
    await copyFile(resolve(ctx.repository, ref.path), target);
    assert.deepEqual(await ctx.digest(target), { bytes: ref.bytes, sha256: ref.sha256 });
    await copyFile(target, join(ctx.evidence, name));
  }
  const scenario = await readSupplementalJSON(join(input, 'scenario.qualification.json'), MiB);
  assert.equal(scenario.timeoutMs, phase.scenarioTimeoutMs);
  assert.equal(scenario.kind, 'performance');
  assert(scenario.expectedReplayDefinition && scenario.replayRequirements);
  ctx.report.performanceExclusion = true;
  ctx.report.firstEightAllCorrectnessPassed = false;
  ctx.report.releaseScope = 'supplemental-native-preflight';
  return { recipePath: join(input, 'scenario.qualification.json'), browserVersion: null };
}
export function supplementalArguments(ctx, row, url, dir) {
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    ctx.modeState.recipePath,
    join(dir, 'report.json'),
    '--server-fixture-access',
    '--work-probe',
    '--cadence=settled120',
    '--cpu=1',
    `--browser=${row.engine}`,
    `--source-revision=${SOURCE[row.source]}`,
    ...(row.source === 'baseline' ? ['--baseline-runtime'] : []),
    ...(row.engine === 'webkit'
      ? ['--context=persistent', '--viewport=400x850', '--dpr=3', '--mobile-context']
      : []),
  ];
}
export function supplementalAssessment(plan, row, raw, command, browserVersion) {
  const replay = raw?.replay?.nativeVerification;
  const display = raw?.environment?.requestedDisplay;
  const mobile = row.engine === 'webkit';
  const clean =
    command?.status === 'closed' &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0;
  const numerical = raw?.performanceGateStatus;
  // Exit2 means a retained numerical failure only. Scenario/replay failures exit1.
  const expectedExit = numerical === 'fail' ? 2 : 0;
  const numericalRecorded = [
    'pass-observed-window',
    'partial-baseline-internal-unknown',
    'inconclusive',
    'review-required',
    'fail',
  ].includes(numerical);
  const steering = plan.phase.startsWith('latency-') || plan.phase === 'jammer-steering';
  const count =
    raw?.snapshots?.at(-1)?.application?.inputLatency?.byKind?.keyboard?.toRender?.count;
  const inputCount = Number.isSafeInteger(count) && count >= 0 ? count : null;
  const sampleReadiness = !steering
    ? 'not-requested'
    : row.source === 'baseline'
      ? inputCount === null
        ? 'baseline-internal-unobserved'
        : 'observed-baseline-excluded'
      : inputCount >= 20
        ? 'observed-at-least20'
        : 'insufficient';
  const correct =
    clean &&
    numericalRecorded &&
    command.exitCode === expectedExit &&
    raw?.format === 'SoloQualificationReportV1' &&
    raw.kind === 'performance' &&
    raw.scenarioStatus === 'pass' &&
    raw.workProbe === true &&
    raw.cadenceProtocol === 'settled120' &&
    raw.baselineRuntime === (row.source === 'baseline') &&
    raw.scenarioSHA256 === SUPPLEMENTAL_PHASES[plan.phase] &&
    raw.sourceRevision === SOURCE[row.source] &&
    raw.buildIdentity?.sourceRevision === SOURCE[row.source] &&
    raw.environment?.engine === row.engine &&
    raw.environment.cpuThrottle === 1 &&
    raw.environment.contextMode === (mobile ? 'persistent' : 'ephemeral') &&
    typeof raw.environment.browserVersion === 'string' &&
    raw.environment.browserVersion.length > 0 &&
    (!browserVersion || raw.environment.browserVersion === browserVersion) &&
    display?.viewport?.width === (mobile ? 400 : 1280) &&
    display.viewport.height === (mobile ? 850 : 800) &&
    display.deviceScaleFactor === (mobile ? 3 : 1) &&
    display.isMobile === mobile &&
    display.hasTouch === mobile &&
    raw.replay?.scope === 'completed-scenario' &&
    replay?.status === 'pass' &&
    replay.engine === row.engine &&
    replay.browserVersion === raw.environment.browserVersion &&
    raw.pageErrors?.length === 0 &&
    !raw.failure &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure &&
    !raw.audioIdentityFailure &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure;
  return {
    status: correct && sampleReadiness !== 'insufficient' ? 'passed' : 'failed',
    nativeRecipeCorrectness: correct ? 'pass' : 'fail',
    applicationKeyboardSamples: inputCount,
    steeringSampleReadiness: sampleReadiness,
    rawNumericalStatus: numerical ?? 'unobserved',
    performanceQualification: 'excluded',
    firstEightAllCorrectnessPassed: false,
    scope:
      'Single recipe preflight only; all raw gates retained, no timing or prerequisite promotion.',
  };
}
export async function runSupplementalRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  const { startProductionPreview } = await import('./serve-production-preview.mjs');
  const { PUBLIC_SECURITY_HEADERS } = await import('./game-cli.mjs');
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads[row.source],
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
    assert.equal(build.sourceRevision, SOURCE[row.source]);
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
    row.artifactAdmission = ctx.admitted.artifacts[row.source];
    row.command = await ctx.run(
      row.id,
      [process.execPath, ...supplementalArguments(ctx, row, url, dir)],
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
    Object.assign(
      row,
      supplementalAssessment(ctx.plan, row, raw, row.command, ctx.modeState.browserVersion),
    );
    row.browserVersion = raw.environment?.browserVersion;
    assert.equal(typeof row.browserVersion, 'string');
    if (ctx.modeState.browserVersion)
      assert.equal(row.browserVersion, ctx.modeState.browserVersion);
    else ctx.modeState.browserVersion = row.browserVersion;
    await verifyInputs(ctx);
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((error) => (error ? no(error) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('Supplemental owned preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, engine] = process.argv.slice(2);
  const bytes = await readFile(input);
  if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(supplementalMatrix(JSON.parse(bytes)))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindSupplementalJob(JSON.parse(bytes), engine);
    plan.manifestInput = {
      path: resolve(input),
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
