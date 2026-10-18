import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startProductionPreview } from './serve-production-preview.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';

export const FINAL_WORKER_COHORT = 'worker-idle-candidatea6e';
const finalSource = Object.freeze({
  revision: 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4',
  tree: '6b13627e324f695b6ee8d9f2dee2eeeb7217c332',
  runtime: '32abd322afd8243e4537ce4784e2f78ee45ecbec',
});
function finalWorkerPlan(plan) {
  if (plan?.sourceCohort === undefined) return false;
  assert.equal(plan.sourceCohort, FINAL_WORKER_COHORT);
  assert.equal(plan.format, 'SoloHostedWorkerDiagnosticPlanV1');
  return true;
}
export const WORKER_DIAGNOSTIC_ROWS = [
  [1, 'worker'],
  [1, 'idle'],
  [2, 'idle'],
  [2, 'worker'],
  [3, 'worker'],
  [3, 'idle'],
].map(([repetition, arm]) => ({
  id: `candidate-webkit-${arm}-p${repetition}`,
  kind: 'worker-diagnostic',
  source: 'candidate',
  engine: 'webkit',
  repetition,
  arm,
  timeoutMs: 240000,
  performanceExclusion: true,
}));
export const WORKER_CONFIRMATION_ROWS = [1, 2, 3, 4].map((repetition) => ({
  id: `candidate-webkit-${repetition === 4 ? 'paused' : 'worker'}-confirmation-p${repetition}`,
  kind: repetition === 4 ? 'paused' : 'worker',
  source: 'candidate',
  engine: 'webkit',
  repetition,
  timeoutMs: 240000,
  performanceExclusion: true,
}));
const confirmationPlan = (plan) => plan.format === 'SoloHostedWorkerConfirmationPlanV1';
export function validateWorkerDiagnosticPlan(plan) {
  const confirmation = confirmationPlan(plan),
    final = finalWorkerPlan(plan);
  assert(confirmation || plan.format === 'SoloHostedWorkerDiagnosticPlanV1');
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.release?.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release?.predecessorRun, final ? 39012635540 : 38985941469);
  assert.equal(plan.release?.candidateRevision, plan.candidate.revision);
  if (confirmation) {
    assert.equal(plan.windowMs, undefined);
    assert.equal(plan.release.scope, 'default-worker-confirmation-with-paused-companion');
    assert.equal(plan.release.diagnosticRun, 38990108478);
    assert.equal(
      plan.release.diagnosticAnalysisSHA256,
      'e0dd826a388fcc6012dfe580cc715f5753d739b698286c1b6f79a7017a504c0c',
    );
  } else assert.equal(plan.windowMs, 12000);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.rowEvidenceBytes, 32 * 1024 ** 2);
  assert.equal(plan.evidenceBytes, 256 * 1024 ** 2);
  assert.deepEqual(plan.rows, confirmation ? WORKER_CONFIRMATION_ROWS : WORKER_DIAGNOSTIC_ROWS);
  assert.equal(
    plan.candidate.revision,
    final ? finalSource.revision : '3adcd53792043ef02459e86168c6b33a66d6ef00',
  );
  assert.equal(
    plan.candidate.tree,
    final ? finalSource.tree : '48018be714c3965f989c75c9fe18e8da2529eebd',
  );
  if (final) {
    assert.equal(plan.runtimeRevision, finalSource.runtime);
    assert.deepEqual(plan.baseline, {
      revision: '8b01991942dc764b8aa4726851699ce1985e53ae',
      tree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
    });
    assert.equal(plan.release.historicalPredecessorRun, 38985941469);
    assert.equal(plan.release.scope, 'independent-final-worker-idle-diagnostic');
    assert.equal(plan.release.onceOnlyBefore, 'a7e0219818842f02399317ca6d2a14bdd506da3d');
    assert.deepEqual(plan.release.predecessorWorkerReport, {
      bytes: 2670,
      sha256: '7b5e8cd5251423092ef4ec8e82b629e8186ed480f77080214503fd91a57b55eb',
    });
    assert(
      Array.isArray(plan.frozenTools) &&
        plan.frozenTools.length > 0 &&
        plan.frozenTools.length <= 64,
    );
    assert.equal(new Set(plan.frozenTools.map((ref) => ref.path)).size, plan.frozenTools.length);
    for (const ref of plan.frozenTools) {
      assert.match(ref.path, /^scripts\/[a-zA-Z0-9/_.-]+$/);
      assert(!ref.path.split('/').includes('..'));
      assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < 1024 ** 2);
      assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    }
    for (const path of [
      'scripts/run-solo-remote-correctness.mjs',
      'scripts/verify-solo-build.mjs',
      'scripts/solo-remote-archive.py',
      'scripts/soundtrack-distribution.mjs',
      'scripts/optional-distribution.mjs',
      'scripts/external-distribution.mjs',
      'scripts/optional-artwork.mjs',
    ])
      assert(
        plan.frozenTools.some((ref) => ref.path === path),
        `Missing final worker tool: ${path}`,
      );
  }
  for (const key of ['run', 'artifact'])
    assert(Number.isSafeInteger(plan.candidate[key]) && plan.candidate[key] > 0);
  for (const key of ['inner', 'outer']) {
    assert(Number.isSafeInteger(plan.candidate[key].bytes) && plan.candidate[key].bytes > 0);
    assert.match(plan.candidate[key].sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(plan.candidate.manifestSHA256, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    plan.adapterInputs.map((ref) => ref.path),
    [
      'scripts/solo-remote-worker-diagnostic.mjs',
      'scripts/verify-solo-mp3-worker.mjs',
      'scripts/solo-worker-diagnostics.mjs',
      ...(confirmation ? ['scripts/verify-solo-paused-render.mjs'] : []),
    ],
  );
  for (const ref of plan.adapterInputs) {
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < 1024 ** 2);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
}
export function workerConfirmationAssessment(raw, command, row) {
  const clean =
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0;
  const valid =
    raw?.engine === 'webkit' &&
    typeof raw.browser === 'string' &&
    raw.status === 'passed' &&
    !raw.failure &&
    !raw.error &&
    raw.pageErrors?.length === 0 &&
    raw.diagnostics === undefined;
  const probe =
    row.kind === 'worker'
      ? raw?.mode === 'worker' &&
        raw.validationPassed === true &&
        raw.active?.flightBefore === 'running' &&
        raw.active?.flightAfter === 'running' &&
        typeof raw.expectedWorkerURL === 'string' &&
        raw.workerURLs?.includes(raw.expectedWorkerURL)
      : row.kind === 'paused' &&
        JSON.stringify(raw?.observation?.cases?.map(({ name }) => name)) ===
          JSON.stringify([
            'paused-initial-settling',
            'startup-settling',
            'paused',
            'covered-by-settings',
            'resize-invalidation',
            'resumed',
          ]) &&
        raw.observation.cases.at(-1).state === 'running';
  return {
    status: clean && valid && probe ? 'passed' : 'failed',
    probe: row.kind,
    performanceQualification: 'excluded',
    firstEightAllCorrectnessPassed: false,
    diagnostic204msInterval: 'retained-unattributed',
    // The unchanged smoke records optional-resource CSP messages. Its worker
    // assertions require the exact static worker URL, not a silent console.
    policyWarnings: raw?.policyErrors ?? [],
  };
}
export function workerProbeArguments(plan, row, address, reportPath) {
  const confirmation = confirmationPlan(plan);
  return [
    confirmation && row.kind === 'paused'
      ? 'verify-solo-paused-render.mjs'
      : 'verify-solo-mp3-worker.mjs',
    address,
    reportPath,
    '--fixture-access',
    '--browser=webkit',
    ...(!confirmation ? ['--diagnostics', ...(row.arm === 'idle' ? ['--idle-control'] : [])] : []),
  ];
}
export function workerDiagnosticAssessment(raw, command, row, plan = null) {
  const expectedRevision = finalWorkerPlan(plan)
    ? finalSource.revision
    : '3adcd53792043ef02459e86168c6b33a66d6ef00';
  const clean =
    command?.status === 'closed' &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    command.survivors?.length === 0 &&
    command.ambiguous?.length === 0;
  const diagnostics = raw?.diagnostics;
  const complete =
    clean &&
    raw?.engine === 'webkit' &&
    typeof raw.browser === 'string' &&
    diagnostics?.application &&
    diagnostics.application.sourceRevision === expectedRevision &&
    diagnostics.windowMs === 12000 &&
    diagnostics.windowEndedAtMs - diagnostics.windowStartedAtMs >= 12000 &&
    diagnostics.initialFlightState === 'running' &&
    ['boot', 'preparing', 'ready', 'paused', 'result', 'hidden', 'error'].includes(
      diagnostics.application.phase,
    ) &&
    Number.isFinite(diagnostics.windowStartedAtMs) &&
    Number.isFinite(diagnostics.windowEndedAtMs) &&
    diagnostics.mode ===
      (row.arm === 'worker' ? 'worker-inspection' : 'public-start-idle-control-no-worker-claim');
  const arm =
    row.arm === 'worker'
      ? raw?.mode === 'worker' &&
        raw.validationPassed === true &&
        raw.active?.flightBefore === 'running' &&
        raw.active?.flightAfter === 'running'
      : raw?.mode === 'idle-control-no-worker-claim' &&
        raw.validationPassed === undefined &&
        raw.active === undefined;
  return {
    status:
      complete &&
      arm &&
      command.exitCode === 0 &&
      raw.status === 'passed' &&
      !raw.failure &&
      raw.pageErrors?.length === 0 &&
      diagnostics.finalFlightState === 'running'
        ? 'passed'
        : 'failed',
    diagnosticCompleteness: complete ? 'complete' : 'incomplete',
    workerClaim: row.arm === 'worker' ? 'original-worker-assertions-required' : 'none-idle-control',
    performanceQualification: 'excluded',
    firstEightAllCorrectnessPassed: false,
  };
}
async function verifyInputs(ctx) {
  for (const ref of [
    ...ctx.plan.adapterInputs,
    ...(finalWorkerPlan(ctx.plan) ? ctx.plan.frozenTools : []),
  ])
    assert.deepEqual(await ctx.digest(join(ctx.repository, ref.path)), {
      bytes: ref.bytes,
      sha256: ref.sha256,
    });
}
export async function prepareWorkerDiagnosticMode(ctx) {
  validateWorkerDiagnosticPlan(ctx.plan);
  await verifyInputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  assert.equal(ctx.admitted.artifacts.candidate.sourceRevision, ctx.plan.candidate.revision);
  if (finalWorkerPlan(ctx.plan)) {
    assert.equal(ctx.admitted.artifacts.candidate.sourceTree, finalSource.tree);
    assert.equal(
      ctx.admitted.artifacts.candidate.manifestSHA256,
      ctx.plan.candidate.manifestSHA256,
    );
    assert.deepEqual(ctx.admitted.artifacts.candidate.archiveIdentity, ctx.plan.candidate.inner);
  }
  return {
    scope: confirmationPlan(ctx.plan)
      ? 'Three serial ordinary WebKit worker probes and one paused-render companion. No diagnostics flag, retries, timing qualification or first-eight promotion.'
      : 'Six prospective serial instrumented Linux WebKit windows. No retries, timing qualification or first-eight gate promotion.',
    firstEightAllCorrectnessPassed: false,
    performanceQualification: 'excluded',
  };
}
export async function runWorkerDiagnosticRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads.candidate,
      port: 0,
      fixtureAccess: false,
      cache: 'policy',
    });
    const response = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    const build = await response.json();
    assert.equal(build.sourceRevision, ctx.plan.candidate.revision);
    for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(key), value);
    const address = new URL('game/', server.url).href;
    row.served = { address, build, fixtureAccess: server.fixtureAccess, mode: server.mode };
    row.artifactAdmission = ctx.admitted.artifacts.candidate;
    row.firstEightAllCorrectnessPassed = false;
    row.performanceQualification = 'excluded';
    const [probe, ...args] = workerProbeArguments(ctx.plan, row, address, join(dir, 'report.json'));
    row.command = await ctx.run(
      row.id,
      [process.execPath, join(ctx.here, probe), ...args],
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
    const bytes = await readFile(join(dir, 'report.json'));
    assert(bytes.length <= 2 * 1024 ** 2);
    const raw = JSON.parse(bytes);
    Object.assign(
      row,
      (confirmationPlan(ctx.plan) ? workerConfirmationAssessment : workerDiagnosticAssessment)(
        raw,
        row.command,
        row,
        ctx.plan,
      ),
    );
    row.browserVersion = raw.browser;
    const previous = ctx.report.rows.find((other) => other !== row && other.browserVersion);
    if (previous)
      assert.equal(
        row.browserVersion,
        previous.browserVersion,
        'Worker diagnostic browser changed',
      );
    await verifyInputs(ctx);
  } finally {
    if (server)
      await Promise.race([
        new Promise((yes, no) => {
          server.server.close((error) => (error ? no(error) : yes()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw Error('Worker diagnostic owned preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
  }
}
