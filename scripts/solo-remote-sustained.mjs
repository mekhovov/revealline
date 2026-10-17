import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import {
  evaluateQualificationBudgets,
  qualificationSnapshotStorage,
} from './solo-qualification.mjs';
import {
  aggregateQualificationGates,
  externalQualificationBudgets,
} from './solo-qualification-observation.mjs';

const MiB = 1024 ** 2;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = {
  baseline: 'b11745223861c3973ad4bf440cc536198b8e0371',
  candidate: '3adcd53792043ef02459e86168c6b33a66d6ef00',
};
const coldSourceCohort = {
  name: 'cold-main8b-candidatec9',
  baseline: '8b01991942dc764b8aa4726851699ce1985e53ae',
  baselineTree: '9373b6a74aea8fa1ef47aa17ace140b4cf714609',
  candidate: 'c9e637ad81fadf49caec884155d1bd0c2496c59c',
  candidateTree: '4d72cdb0aa075386bc1e6b5cd53f9f80eeb4a08c',
  runtime: '87aca909201ae0a2520d5856dbca351b82dd6e2d',
};
export const SUSTAINED_PHASES = Object.freeze({
  long29: {
    previous: 'diagnostics',
    timeoutMs: 2640000,
    jobMinutes: 190,
    helperMinutes: 145,
    recipe: 'long29',
    hash: '5ffad85e4dc752ea3e8bcf236f88e65c09875d58ac339c096890c0b6f2133150',
  },
  soak: {
    previous: 'first8',
    timeoutMs: 2640000,
    jobMinutes: 190,
    helperMinutes: 145,
    recipe: 'soak',
    hash: 'c5a3c197b828c92a4e737a681153692aa02ab86b24cc62bafc9d070f3fa2b39b',
  },
  next: {
    previous: 'soak',
    timeoutMs: 1440000,
    jobMinutes: 150,
    helperMinutes: 105,
    recipe: 'next',
    hash: '869679e7a89bbd1a329ea3efd319aa8a4ffeaa1495715642a1447ab7a36dda40',
  },
  retry: {
    previous: 'next',
    timeoutMs: 1140000,
    jobMinutes: 140,
    helperMinutes: 95,
    recipe: 'retry',
    hash: '2e44c12bbe09f3f9cb27b25ee61e1a07659a77ecc5e8898c9e635b657a74606c',
  },
  diagnostics: {
    previous: 'retry',
    timeoutMs: 1800000,
    jobMinutes: 130,
    helperMinutes: 85,
    recipe: null,
  },
});

// Separate, explicitly released timing cohort. The five lifecycle phases above
// keep their original source contract, recipes, deadlines and default behavior.
export const TIMING_PHASES = Object.freeze({
  'cold-first30': {
    previous: 'latest-first8',
    hash: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
  },
  'warm-first30': {
    previous: 'cold-first30',
    hash: '6da01ca449068ca6705012f3d6604362c581fe52c4583407797c0961acf3156d',
  },
  sentry: {
    previous: 'warm-first30',
    hash: '86cc1eea19e1d229dae865b368a94238de900ad83be5d9a4ee469b2e4dc3c0fd',
  },
  'long-rail': {
    previous: 'sentry',
    hash: 'b9afaecaadcbd0f657dd8064b9f7932c0c7ec12d6433f7d2b76f60de7ef19528',
  },
});
const timingPlan = (plan) => plan.format === 'SoloHostedTimingPlanV1';
const roleRevision = (plan, role) => (timingPlan(plan) ? plan[role].revision : source[role]);
const diagnosticComparison = (plan) => plan.release?.status === 'reviewed-diagnostic-only';
function validateDiagnosticComparison(release, candidate = source.candidate) {
  assert.equal(release.scope, 'independent-comparison-diagnostics');
  assert.equal(release.predecessorRun, 38985941469);
  assert.equal(release.firstEightAllCorrectnessPassed, false);
  assert.equal(release.performanceQualification, 'not-qualified-diagnostic-only');
  assert.equal(release.automaticRetries, 0);
  assert.equal(release.automaticPhaseContinuation, false);
  assert.equal(release.candidateRevision, candidate);
}
function comparisonLabels(plan) {
  return diagnosticComparison(plan)
    ? {
        comparisonAdmission: 'independent-diagnostic',
        performanceQualification: 'not-qualified-diagnostic-only',
        firstEightAllCorrectnessPassed: false,
        ...(plan.sourceCohort ? { sourceCohort: plan.sourceCohort } : {}),
      }
    : {};
}

// Declaration checks only. The common runner must still verify each complete
// package, V2 ready proof, source tree and CSP before admitting either role.
function validateColdSourceCohort(plan) {
  if (plan.sourceCohort === undefined) {
    assert.equal(plan.release.sourceCohort, undefined);
    return false;
  }
  assert.equal(plan.sourceCohort, coldSourceCohort.name);
  assert.equal(plan.release.sourceCohort, coldSourceCohort.name);
  assert.equal(plan.phase, 'cold-first30');
  assert.equal(plan.release.status, 'reviewed-diagnostic-only');
  assert.equal(plan.candidate.revision, coldSourceCohort.candidate);
  assert.equal(plan.candidate.tree, coldSourceCohort.candidateTree);
  assert.equal(plan.baseline.revision, coldSourceCohort.baseline);
  assert.equal(plan.baseline.tree, coldSourceCohort.baselineTree);
  assert.equal(plan.latestRuntimeRevision, coldSourceCohort.runtime);
  assert(
    !plan.baseline.publishVerifiedNormal && !plan.baseline.publisher,
    'Reuse the verified normal baseline',
  );
  const reuse = plan.baseline.reusableArtifact;
  assert.equal(reuse?.format, 'SoloHostedNormalBaselineReuseV2');
  assert.equal(reuse.sourceRevision, coldSourceCohort.baseline);
  assert.equal(reuse.sourceTree, coldSourceCohort.baselineTree);
  assert.equal(reuse.producer.repository, plan.repository);
  assert.equal(reuse.producer.workflow, '.github/workflows/solo-remote-baseline-temporary.yml');
  assert.equal(reuse.producer.run, reuse.run);
  assert(Number.isSafeInteger(reuse.producer.attempt) && reuse.producer.attempt > 0);
  assert.match(reuse.producer.toolingRevision, /^[a-f0-9]{40}$/);
  assert.match(reuse.producer.toolingTree, /^[a-f0-9]{40}$/);
  assert.equal(reuse.name, `solo-normal-baseline-8b019919-${reuse.run}-${reuse.producer.attempt}`);
  for (const identity of [plan.candidate, reuse]) {
    assert(Number.isSafeInteger(identity.run) && identity.run > 0);
    assert(Number.isSafeInteger(identity.artifact) && identity.artifact > 0);
    assert.match(identity.manifestSHA256, /^[a-f0-9]{64}$/);
    for (const name of ['outer', 'inner']) {
      assert(
        Number.isSafeInteger(identity[name]?.bytes) &&
          identity[name].bytes > 0 &&
          identity[name].bytes <= 2 * 1024 ** 3,
      );
      assert.match(identity[name].sha256, /^[a-f0-9]{64}$/);
    }
  }
  assert(Number.isSafeInteger(reuse.ready?.bytes) && reuse.ready.bytes > 0);
  assert(reuse.ready.bytes <= 2 * MiB);
  assert.match(reuse.ready.sha256, /^[a-f0-9]{64}$/);
  return true;
}

export function validateTimingPlan(plan) {
  assert.equal(plan.format, 'SoloHostedTimingPlanV1');
  const spec = TIMING_PHASES[plan.phase];
  assert(spec, 'Unknown timing phase');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  const currentCold = validateColdSourceCohort(plan);
  const expectedSource = currentCold ? coldSourceCohort : source;
  assert.equal(plan.baseline.revision, expectedSource.baseline);
  assert.match(plan.candidate.revision, /^[a-f0-9]{40}$/);
  assert.notEqual(plan.candidate.revision, expectedSource.baseline);
  assert.equal(plan.candidate.revision, plan.latestSourceRevision);
  assert.match(plan.latestRuntimeRevision, /^[a-f0-9]{40}$/);
  assert(['chromium', 'webkit'].includes(plan.engine));
  assert([1, 2, 3].includes(plan.repetition));
  const release = plan.release;
  assert.equal(release.format, 'SoloHostedTimingReleaseV1');
  const diagnostic = diagnosticComparison(plan);
  assert(
    diagnostic || release.status === 'reviewed-and-released',
    'Explicit latest-source timing release required',
  );
  if (diagnostic) {
    validateDiagnosticComparison(release, expectedSource.candidate);
    assert.equal(plan.candidate.revision, expectedSource.candidate);
    assert.equal(
      plan.latestRuntimeRevision,
      currentCold ? coldSourceCohort.runtime : '0d9fef1120face4c0f9998ebd24a94e6df0d85c0',
    );
  }
  assert.equal(release.phase, plan.phase);
  assert.equal(release.previousPhase, spec.previous);
  assert.equal(release.candidateRevision, plan.candidate.revision);
  assert.equal(release.baselineRevision, expectedSource.baseline);
  assert.equal(release.latestRuntimeRevision, plan.latestRuntimeRevision);
  for (const field of [
    'noUnclosedOwners',
    'allPriorPlannedJobsClosed',
    'priorProofInspected',
    'latestProductionPackageVerified',
  ])
    assert.equal(release[field], true);
  assert.equal(release.firstEightAllCorrectnessPassed, !diagnostic);
  assert(
    Array.isArray(release.evidence) && release.evidence.length > 0 && release.evidence.length <= 32,
  );
  for (const ref of release.evidence) {
    assert(Number.isSafeInteger(ref.runId) && ref.runId > 0);
    assert(Number.isSafeInteger(ref.artifactId) && ref.artifactId > 0);
    assert.match(ref.artifactSHA256, /^[a-f0-9]{64}$/);
    assert.match(ref.summarySHA256, /^[a-f0-9]{64}$/);
    assert(['passed', 'failed-reviewed'].includes(ref.disposition));
  }
  assert.equal(plan.helperTimeoutMs, 75 * 60000);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.calibrationTimeoutMs, 5 * 60000);
  assert.equal(plan.calibrationPreset, 'mid');
  assert.equal(plan.evidenceBytes, 512 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.equal(plan.performanceExclusion, diagnostic);
  assert.deepEqual(
    plan.adapterInputs.map((ref) => ref.path),
    ['scripts/solo-remote-sustained.mjs', 'scripts/solo-remote-baseline.mjs'],
  );
  assert(plan.baseline.reusableArtifact, 'The existing pinned normal baseline must be reused');
  for (const ref of plan.adapterInputs) {
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  const roles = roleOrder(plan.repetition, plan.phase);
  assert.deepEqual(
    plan.rows.map((row) => row.source),
    roles,
  );
  assert.equal(new Set(plan.rows.map((row) => row.id)).size, 2);
  for (const row of plan.rows) {
    assert.equal(row.id, `timing-${plan.phase}-${plan.engine}-r${plan.repetition}-${row.source}`);
    assert.equal(row.kind, 'timing');
    assert.equal(row.engine, plan.engine);
    assert.equal(row.timeoutMs, 480000);
    assert.equal(row.performanceExclusion, diagnostic);
  }
  assert.deepEqual(
    Object.keys(plan.recipes).sort(),
    [
      'cold-first30',
      'warm-first30',
      'sentry',
      'long-rail',
      'sentry-level',
      'long-rail-level',
    ].sort(),
  );
  for (const [phase, value] of Object.entries(TIMING_PHASES))
    assert.equal(plan.recipes[phase].sha256, value.hash);
  assert.equal(
    plan.recipes['sentry-level'].sha256,
    'caad15d6f4770bc5e48935db1655e2892cfb5bd9093a72d0d7795125e8d2d3fa',
  );
  assert.equal(
    plan.recipes['long-rail-level'].sha256,
    '821897e571449bb5ec27678eef09c5955d9e9be873aaaf76736ff1aadbd0d84c',
  );
  for (const ref of Object.values(plan.recipes)) {
    assert.match(ref.path, /^docs\/performance\/fixtures\/solo-remote-timing\/[a-z0-9.-]+$/);
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 16384);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  assert(
    Array.isArray(plan.frozenTools) && plan.frozenTools.length > 0 && plan.frozenTools.length <= 64,
  );
  assert.equal(new Set(plan.frozenTools.map((ref) => ref.path)).size, plan.frozenTools.length);
  for (const ref of plan.frozenTools) {
    assert.match(ref.path, /^scripts\/[a-zA-Z0-9/_.-]+$/);
    assert(!ref.path.split('/').includes('..'));
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}

export function bindTimingJob(manifest, engine, repetition) {
  assert.equal(manifest.format, 'SoloHostedTimingManifestV1');
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedTimingPlanV1';
  plan.engine = engine;
  plan.repetition = repetition;
  plan.helperTimeoutMs = 75 * 60000;
  plan.performanceExclusion = diagnosticComparison(plan);
  plan.rows = roleOrder(repetition, plan.phase).map((role) => ({
    id: `timing-${plan.phase}-${engine}-r${repetition}-${role}`,
    kind: 'timing',
    engine,
    source: role,
    timeoutMs: 480000,
    performanceExclusion: plan.performanceExclusion,
  }));
  return validateTimingPlan(plan);
}

export function timingMatrix(manifest) {
  const expected = ['chromium', 'webkit'].flatMap((engine) =>
    [1, 2, 3].map((repetition) => ({ engine, repetition })),
  );
  assert.deepEqual(manifest.jobs, expected, 'Exactly six declared timing jobs');
  return {
    include: expected.map(({ engine, repetition }) => {
      const plan = bindTimingJob(manifest, engine, repetition);
      return {
        phase: plan.phase,
        engine,
        repetition,
        jobMinutes: 120,
        stepMinutes: 78,
        outerSeconds: 77 * 60,
      };
    }),
  };
}

function roleOrder(repetition, phase) {
  return phase === 'diagnostics'
    ? ['candidate']
    : repetition === 2
      ? ['candidate', 'baseline']
      : ['baseline', 'candidate'];
}
export function validateRelease(release, phase) {
  assert(SUSTAINED_PHASES[phase], 'Unknown phase');
  assert.equal(release.format, 'SoloHostedPhaseReleaseV1');
  const diagnostic = release.status === 'reviewed-diagnostic-only';
  assert(
    diagnostic || release.status === 'reviewed-and-released',
    'An explicit reviewed phase release is required',
  );
  if (diagnostic) validateDiagnosticComparison(release);
  assert.equal(release.phase, phase);
  assert.equal(release.previousPhase, SUSTAINED_PHASES[phase].previous);
  assert.equal(release.candidateRevision, source.candidate);
  assert.equal(release.baselineRevision, source.baseline);
  assert.equal(release.noUnclosedOwners, true);
  assert.equal(release.allPriorPlannedJobsClosed, true);
  assert.equal(release.priorProofInspected, true);
  assert(
    Array.isArray(release.evidence) && release.evidence.length > 0 && release.evidence.length <= 32,
  );
  for (const ref of release.evidence) {
    assert(Number.isSafeInteger(ref.runId) && ref.runId > 0);
    assert(Number.isSafeInteger(ref.artifactId) && ref.artifactId > 0);
    assert.match(ref.artifactSHA256, /^[a-f0-9]{64}$/);
    assert.match(ref.summarySHA256, /^[a-f0-9]{64}$/);
    assert(['passed', 'failed-reviewed'].includes(ref.disposition));
  }
  if (diagnostic || ['soak', 'long29'].includes(phase))
    assert.equal(release.firstEightAllCorrectnessPassed, !diagnostic);
  return release;
}

export function validateSustainedPlan(plan) {
  if (timingPlan(plan)) return validateTimingPlan(plan);
  assert.equal(plan.format, 'SoloHostedSustainedPlanV1');
  const spec = SUSTAINED_PHASES[plan.phase];
  assert(spec);
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.baseline.revision, source.baseline);
  assert.equal(plan.candidate.revision, source.candidate);
  assert(['chromium', 'webkit'].includes(plan.engine));
  assert([1, 2, 3].includes(plan.repetition));
  validateRelease(plan.release, plan.phase);
  assert.equal(plan.helperTimeoutMs, spec.helperMinutes * 60000);
  assert.equal(plan.evidenceBytes, 512 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.equal(plan.setupTimeoutMs, 40 * 60000); // After the separately bounded 20-minute dependency setup.
  assert.equal(plan.calibrationTimeoutMs, 5 * 60000);
  assert.equal(plan.calibrationPreset, 'mid');
  assert.deepEqual(
    plan.adapterInputs.map((ref) => ref.path),
    [
      'scripts/solo-remote-sustained.mjs',
      ...(plan.baseline.reusableArtifact ? ['scripts/solo-remote-baseline.mjs'] : []),
    ],
  );
  for (const ref of plan.adapterInputs) {
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(plan.performanceExclusion, diagnosticComparison(plan) || plan.phase === 'retry');
  const roles = roleOrder(plan.repetition, plan.phase);
  assert.deepEqual(
    plan.rows.map((row) => row.source),
    roles,
  );
  assert.equal(new Set(plan.rows.map((row) => row.id)).size, roles.length);
  for (const row of plan.rows) {
    assert.equal(row.id, `${plan.phase}-${plan.engine}-r${plan.repetition}-${row.source}`);
    assert.equal(row.kind, plan.phase === 'diagnostics' ? 'diagnostics' : 'lifecycle');
    assert.equal(row.engine, plan.engine);
    assert.equal(row.timeoutMs, spec.timeoutMs);
    assert.equal(row.performanceExclusion, plan.performanceExclusion);
  }
  if (spec.recipe) assert.equal(plan.recipes[spec.recipe].sha256, spec.hash);
  for (const ref of Object.values(plan.recipes)) {
    assert.match(ref.path, /^docs\/performance\/fixtures\/solo-remote-sustained\/[a-z0-9.-]+$/);
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= 16384);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(
    plan.recipes.opening.sha256,
    'd36ab449fe115f49b3caf9f29e7f6558d155e6a83ef973748fab08784b8fda3e',
  );
  assert(
    Array.isArray(plan.frozenTools) && plan.frozenTools.length > 0 && plan.frozenTools.length <= 64,
  );
  assert.equal(new Set(plan.frozenTools.map((ref) => ref.path)).size, plan.frozenTools.length);
  for (const ref of plan.frozenTools) {
    assert.match(ref.path, /^scripts\/[a-zA-Z0-9/_.-]+$/);
    assert(!ref.path.split('/').includes('..'));
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}

export function bindSustainedJob(manifest, engine, repetition) {
  assert.equal(manifest.format, 'SoloHostedSustainedManifestV1');
  const plan = structuredClone(manifest);
  delete plan.jobs;
  plan.format = 'SoloHostedSustainedPlanV1';
  plan.engine = engine;
  plan.repetition = repetition;
  const spec = SUSTAINED_PHASES[plan.phase];
  assert(spec);
  plan.helperTimeoutMs = spec.helperMinutes * 60000;
  plan.performanceExclusion = diagnosticComparison(plan) || plan.phase === 'retry';
  plan.rows = roleOrder(repetition, plan.phase).map((role) => ({
    id: `${plan.phase}-${engine}-r${repetition}-${role}`,
    kind: plan.phase === 'diagnostics' ? 'diagnostics' : 'lifecycle',
    engine,
    source: role,
    timeoutMs: spec.timeoutMs,
    performanceExclusion: plan.performanceExclusion,
  }));
  return validateSustainedPlan(plan);
}

export function sustainedMatrix(manifest) {
  const expected = ['chromium', 'webkit'].flatMap((engine) =>
    [1, 2, 3].map((repetition) => ({ engine, repetition })),
  );
  assert.deepEqual(manifest.jobs, expected, 'Exactly six declared jobs in one released phase');
  return {
    include: expected.map(({ engine, repetition }) => {
      const plan = bindSustainedJob(manifest, engine, repetition),
        spec = SUSTAINED_PHASES[plan.phase];
      return {
        phase: plan.phase,
        engine,
        repetition,
        jobMinutes: spec.jobMinutes,
        stepMinutes: spec.helperMinutes + 3,
        outerSeconds: (spec.helperMinutes + 2) * 60,
      };
    }),
  };
}

async function checkedJSON(path, maximumBytes = 16 * MiB) {
  const info = await lstat(path);
  assert(
    info.isFile() && !info.isSymbolicLink() && info.size <= maximumBytes,
    'Bounded regular report required',
  );
  return JSON.parse(await readFile(path, 'utf8'));
}
async function verifyInputs(ctx) {
  for (const ref of [
    ...Object.values(ctx.plan.recipes),
    ...ctx.plan.frozenTools,
    ...ctx.plan.adapterInputs,
  ]) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/'));
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    const actual = await ctx.digest(path);
    assert.equal(actual.sha256, ref.sha256, `Changed input: ${ref.path}`);
    if (ref.bytes !== undefined) assert.equal(actual.bytes, ref.bytes);
  }
}
export function verifiedMidCalibration(raw) {
  assert.equal(raw.failure, null);
  assert.equal(typeof raw.browser, 'string');
  assert(raw.browser.length > 0 && raw.finishedAt);
  const mid = raw.result?.presets?.mid;
  assert.equal(mid?.status, 'verified');
  assert.equal(mid.target, 1000);
  assert(Number.isFinite(mid.rate) && mid.rate >= 1 && mid.rate <= 20);
  assert(Array.isArray(mid.verification) && mid.verification.length === 3);
  assert(mid.verification.every((x) => Number.isFinite(x) && x > 0));
  const sorted = [...mid.verification].sort((a, b) => a - b);
  const median = sorted[1],
    spread = (sorted[2] - sorted[0]) / median;
  assert.equal(mid.median, median);
  assert.equal(mid.spread, spread);
  assert(Math.abs(median - 1000) / 1000 <= 0.1 && spread <= 0.2);
  return { cpu: mid.rate, browserVersion: raw.browser };
}

export async function prepareCalibrationScratch(report) {
  const owner = report.scratchOwner;
  assert(owner && resolve(owner.path) === owner.path);
  assert.equal(await realpath(owner.path), owner.path, 'Calibration scratch owner alias');
  const root = await lstat(owner.path);
  assert(root.isDirectory() && !root.isSymbolicLink());
  assert.equal(root.dev, owner.device);
  assert.equal(root.ino, owner.inode);
  const path = join(owner.path, 'c00');
  assert(Buffer.byteLength(path) <= 52, 'Calibration scratch exceeds socket budget');
  await mkdir(path);
  const info = await lstat(path);
  assert(info.isDirectory() && !info.isSymbolicLink());
  const record = { path, device: info.dev, inode: info.ino, owner };
  report.calibrationScratch = record;
  return record;
}

export function sustainedSnapshotStorage(plan, recipe) {
  const options = qualificationSnapshotStorage(
    recipe.evidenceStorage === undefined ? [] : ['--snapshot-chunks'],
    recipe,
  );
  if (options)
    assert(
      [...plan.frozenTools, ...plan.adapterInputs].some(
        (ref) => ref.path === 'scripts/solo-qualification-snapshot-store.mjs',
      ),
      'Chunked lifecycle evidence requires a frozen snapshot-store helper',
    );
  return options;
}

export async function prepareSustainedMode(ctx) {
  validateSustainedPlan(ctx.plan);
  await verifyInputs(ctx);
  if (ctx.plan.phase !== 'diagnostics') await ctx.ensureBaseline();
  assert(ctx.admitted.artifacts.candidate);
  const mode = { cpu: 1, browserVersion: null, calibration: null, recipePath: null };
  if (ctx.plan.phase !== 'diagnostics') {
    const inputs = join(ctx.work, 'sustained-inputs');
    await mkdir(inputs);
    for (const [key, name] of timingPlan(ctx.plan)
      ? [
          [ctx.plan.phase, 'scenario.qualification.json'],
          ...(ctx.plan.phase === 'sentry' ? [['sentry-level', 'sentry-detour.xonix.json']] : []),
          ...(ctx.plan.phase === 'long-rail' ? [['long-rail-level', 'long-rail.xonix.json']] : []),
        ]
      : [
          [ctx.plan.phase, 'scenario.qualification.json'],
          ['opening', 'first-return.xonix.json'],
        ]) {
      const ref = ctx.plan.recipes[key],
        target = join(inputs, name);
      await writeFile(target, await readFile(resolve(ctx.repository, ref.path)), { flag: 'wx' });
      assert.deepEqual(await ctx.digest(target), { bytes: ref.bytes, sha256: ref.sha256 });
    }
    mode.recipePath = join(inputs, 'scenario.qualification.json');
    const recipe = await checkedJSON(mode.recipePath, MiB);
    mode.snapshotStorage = sustainedSnapshotStorage(ctx.plan, recipe);
  }
  if (ctx.plan.engine === 'chromium') {
    const path = join(ctx.evidence, 'fresh-mid-calibration.json');
    const scratch = await prepareCalibrationScratch(ctx.report);
    await ctx.required(
      'fresh-mid-calibration',
      [process.execPath, join(ctx.here, 'calibrate-solo-performance.mjs'), path],
      ctx.plan.calibrationTimeoutMs,
      { env: { ...ctx.cleanEnv, TMPDIR: scratch.path } },
    );
    Object.assign(mode, verifiedMidCalibration(await checkedJSON(path, MiB)));
    mode.calibration = { path, ...(await ctx.digest(path)) };
  }
  Object.assign(ctx.report, {
    performanceExclusion: ctx.plan.performanceExclusion,
    timingQualification: diagnosticComparison(ctx.plan)
      ? 'not-qualified-diagnostic-only'
      : ctx.plan.phase === 'retry'
        ? 'excluded-retention-profiling'
        : 'new-linux-stratum-only',
    ...comparisonLabels(ctx.plan),
    phaseRelease: ctx.plan.release,
    sustainedStratum: {
      engine: ctx.plan.engine,
      repetition: ctx.plan.repetition,
      cpu: mode.cpu,
      calibration: mode.calibration,
      scope:
        'Paired within this hosted runner only. No historical macOS, physical device, GPU, memory-bandwidth or thermal inference.',
    },
  });
  return mode;
}

export function sustainedArguments(ctx, row, url, dir) {
  const base = [
    `--source-revision=${ctx.plan[row.source].revision}`,
    '--server-fixture-access',
    `--browser=${row.engine}`,
    `--cpu=${ctx.modeState.cpu}`,
  ];
  if (ctx.plan.phase === 'diagnostics') {
    const artifact = ctx.admitted.artifacts.candidate;
    return [
      join(ctx.here, 'qualify-solo-diagnostics.mjs'),
      'run',
      url,
      join(dir, 'diagnostics'),
      ...base,
      '--pairs=10',
      '--seed=1544',
      '--duration=30000',
      `--artifact-manifest=${join(ctx.payloads.candidate, 'manifest.json')}`,
      `--artifact-sha256=${artifact.archiveIdentity.sha256}`,
      ...(ctx.modeState.calibration ? [`--calibration=${ctx.modeState.calibration.path}`] : []),
      '--note=Fixed Linux paired diagnostics cohort; no concurrent job-local build, download, test, profiler or archive. Independent host and browser stratum.',
    ];
  }
  return [
    join(ctx.here, 'qualify-solo-runtime.mjs'),
    url,
    ctx.modeState.recipePath,
    join(dir, 'report.json'),
    ...base,
    '--work-probe',
    '--cadence=settled120',
    ...(ctx.modeState.snapshotStorage ? ['--snapshot-chunks'] : []),
    ...(row.source === 'baseline' ? ['--baseline-runtime'] : []),
    ...(row.engine === 'webkit' ? ['--context=persistent'] : []),
    ...(timingPlan(ctx.plan) && row.engine === 'webkit'
      ? ['--viewport=400x850', '--dpr=3', '--mobile-context']
      : []),
    ...(ctx.plan.phase === 'retry' && row.engine === 'chromium' ? ['--memory-profile'] : []),
  ];
}

export function lifecycleAssessment(plan, row, raw, command, browserVersion) {
  const replay = raw?.replay?.nativeVerification;
  const correct =
    command.status === 'closed' &&
    [0, 2].includes(command.exitCode) &&
    raw?.scenarioStatus === 'pass' &&
    raw.scenarioSHA256 === plan.recipes[plan.phase].sha256 &&
    raw.sourceRevision === roleRevision(plan, row.source) &&
    raw.buildIdentity?.sourceRevision === roleRevision(plan, row.source) &&
    raw.environment?.engine === row.engine &&
    raw.environment?.contextMode === (row.engine === 'webkit' ? 'persistent' : 'ephemeral') &&
    (!browserVersion || raw.environment.browserVersion === browserVersion) &&
    replay?.status === 'pass' &&
    replay.engine === row.engine &&
    replay.browserVersion === raw.environment.browserVersion &&
    Array.isArray(raw.pageErrors) &&
    raw.pageErrors.length === 0 &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure &&
    !raw.failure;
  const rules = raw?.resources;
  const expectedRules = timingPlan(plan) || ['next', 'long29'].includes(plan.phase) ? 0 : 3;
  const resources =
    expectedRules === 0 && Array.isArray(rules) && rules.length === 0
      ? 'not-requested-by-frozen-recipe'
      : Array.isArray(rules) &&
          rules.length === expectedRules &&
          rules.every((rule) => rule.status === 'pass')
        ? 'pass'
        : Array.isArray(rules) && rules.some((rule) => rule.status === 'fail')
          ? 'fail'
          : 'unobserved';
  const repeat = raw?.actions?.find((action) => action.type === 'repeat');
  const elapsed = plan.phase !== 'soak' || repeat?.elapsedMs >= 1800000;
  const performance = raw?.performanceGateStatus ?? 'unobserved';
  const eligible = plan.phase !== 'retry';
  const retained =
    plan.phase === 'retry' &&
    (row.engine !== 'chromium' || performance === 'excluded-memory-profiling');
  return {
    correctness: correct && elapsed ? 'pass' : 'fail',
    resourceStatus: resources,
    rawPerformanceGateStatus: performance,
    performanceQualification: eligible ? performance : 'excluded-retention',
    status:
      correct &&
      elapsed &&
      ['pass', 'not-requested-by-frozen-recipe'].includes(resources) &&
      (eligible ? performance === 'pass-observed-window' && command.exitCode === 0 : retained)
        ? 'passed'
        : 'failed',
    ...comparisonLabels(plan),
  };
}

export function timingAssessment(plan, row, raw, command, browserVersion) {
  const inherited = lifecycleAssessment(plan, row, raw, command, browserVersion);
  const display =
    row.engine === 'webkit'
      ? {
          viewport: { width: 400, height: 850 },
          deviceScaleFactor: 3,
          isMobile: true,
          hasTouch: true,
        }
      : {
          viewport: { width: 1280, height: 800 },
          deviceScaleFactor: 1,
          isMobile: false,
          hasTouch: false,
        };
  let valid = false;
  try {
    assert.equal(raw.workProbe, true);
    assert.equal(raw.kind, 'performance');
    assert.equal(raw.scenarioKind, 'performance');
    assert.equal(raw.cadenceProtocol, 'settled120');
    assert.equal(raw.baselineRuntime, row.source === 'baseline');
    assert.equal(
      raw.cacheMode,
      plan.phase === 'warm-first30' ? 'warm-http-reload' : 'fresh-context',
    );
    assert.deepEqual(raw.environment.requestedDisplay, display);
    assert.equal(raw.replay.scope, 'completed-scenario');
    assert(!raw.finalReadFailure && !raw.failureCleanupFailure);
    if (row.engine === 'webkit') {
      assert.equal(raw.environment.contextOwner?.cleanup?.status, 'closed');
      assert.equal(raw.environment.contextOwner.cleanup.profileRemoved, true);
      assert.equal(raw.environment.contextOwner.cleanup.browserClosed, true);
    }
    valid = true;
  } catch {
    /* Raw gates and failures remain in the retained report. */
  }
  return {
    ...inherited,
    protocolStatus: valid ? 'pass' : 'fail',
    correctness: valid ? inherited.correctness : 'fail',
    status: valid ? inherited.status : 'failed',
    scope: diagnosticComparison(plan)
      ? 'Independent hosted comparison diagnostics only. Raw numerical/replay/protocol failures remain unchanged; prerequisite remains false and overall performance is not qualified.'
      : 'Latest-source hosted timing only; neither physical-device evidence nor replacement credit for historical macOS observations.',
  };
}

export function longRecordingAssessment(plan, row, raw, command, browserVersion) {
  const inherited = lifecycleAssessment(plan, row, raw, command, browserVersion);
  const repeats = raw?.actions?.filter((action) => action.type === 'repeat') ?? [];
  const pre =
    raw?.snapshots?.filter((snapshot) => snapshot.group === 'continuous-recording-paused') ?? [];
  const identity = raw?.replayIdentity;
  const pair = identity?.observations;
  const actions = raw?.actions ?? [];
  const labels = [
    'before-saved-flight-reload',
    'public-saved-flight-reload',
    'public-load-saved-flight',
    'public-restored-pause-owner',
    'after-saved-flight-reload',
  ];
  const positions = labels.map((label) =>
    actions.findIndex((action) => action.label === label && action.status === 'pass'),
  );
  const ordered = positions.every(
    (index, at) => index >= 0 && (at === 0 || index > positions[at - 1]),
  );
  const duration =
    repeats.length === 1 &&
    repeats[0].status === 'pass' &&
    repeats[0].elapsedMs >= 1740000 &&
    repeats[0].iterations <= 870;
  const restored =
    identity?.format === 'SoloPublicReplayIdentityPairV1' &&
    identity.mode === 'exact-public-bytes-pair' &&
    identity.status === 'pass' &&
    pair?.length === 2 &&
    pair.every(
      (item) =>
        Number.isSafeInteger(item.bytes) &&
        item.bytes > 0 &&
        item.bytes <= 32 * MiB &&
        /^[a-f0-9]{64}$/.test(item.sha256),
    ) &&
    pair[0].bytes === pair[1].bytes &&
    pair[0].sha256 === pair[1].sha256 &&
    raw.replay?.scope === 'completed-scenario' &&
    raw.replay.bytes === pair[1].bytes &&
    raw.replay.sha256 === pair[1].sha256;
  let performance;
  try {
    assert.equal(pre.length, 1, 'One pre-reload snapshot is required');
    assert.equal(pre[0].phase, 'paused');
    const application = evaluateQualificationBudgets(pre[0].application);
    const external = externalQualificationBudgets(pre[0].probe);
    performance = {
      application,
      external,
      ...aggregateQualificationGates({
        application,
        external,
        workProbe: true,
        baselineRuntime: row.source === 'baseline',
        applicationAvailable: Boolean(pre[0].application),
      }),
      snapshotGroup: pre[0].group,
      scope:
        'Only the paused pre-reload document window; final new-document metrics are not substituted.',
    };
  } catch (error) {
    performance = { status: 'invalid-evidence', failure: String(error.message) };
  }
  const correctness =
    inherited.correctness === 'pass' &&
    duration &&
    ordered &&
    restored &&
    !raw.finalReadFailure &&
    !raw.failureCleanupFailure;
  return {
    ...inherited,
    correctness: correctness ? 'pass' : 'fail',
    durationStatus: duration ? 'pass' : 'fail',
    publicSavedReload: {
      status: restored && ordered ? 'pass' : 'fail',
      identity,
      scope:
        'Exact public replay bytes survived same-context reload and ordinary paused Load; save-call attribution/OS-flush/browser-restart are not proved.',
    },
    preReloadPerformance: performance,
    finalDocumentPerformanceGateStatus: raw?.performanceGateStatus ?? 'unobserved',
    performanceQualification: performance.status,
    status:
      correctness &&
      inherited.resourceStatus === 'not-requested-by-frozen-recipe' &&
      performance.status === 'pass-observed-window' &&
      [0, 2].includes(command.exitCode)
        ? 'passed'
        : 'failed',
    ...comparisonLabels(plan),
  };
}

export function diagnosticsAssessment(raw, manifest, row, command, expectedBrowserVersion) {
  const observations = raw?.observations;
  const versions = Array.isArray(observations)
    ? [...new Set(observations.map((x) => x.environment?.browser))]
    : [];
  const expected = expectedBrowserVersion ? `${row.engine} ${expectedBrowserVersion}` : null;
  const complete =
    command.status === 'closed' &&
    command.exitCode === 0 &&
    raw?.status === 'pass' &&
    raw.limit === 0.05 &&
    raw.plannedPairs === 10 &&
    raw.completePairs === 10 &&
    raw.noAdaptationWitness?.status === 'observed-full' &&
    observations?.length === 20 &&
    observations.every((x) => x.valid) &&
    versions.length === 1 &&
    typeof versions[0] === 'string' &&
    (!expected || versions[0] === expected) &&
    manifest?.configuration?.sourceRevision === source.candidate &&
    manifest.configuration.pairs === 10 &&
    manifest.configuration.seed === 1544 &&
    manifest.configuration.durationMs === 30000 &&
    manifest.configuration.browser === row.engine &&
    manifest.executions?.length === 20 &&
    manifest.executions.every((x) => x.status === 'complete' && x.exitCode === 0);
  return {
    status: complete ? 'passed' : 'failed',
    rawPerformanceGateStatus: raw?.status ?? 'unobserved',
    browserIdentity: versions[0] ?? null,
    strictReplay: 'not-a-full-run-replay-observer',
    contextScope: 'Existing observer context; separate from persistent WebKit lifecycle qualifier',
  };
}

export async function runSustainedRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  const { startProductionPreview } = await import(
    pathToFileURL(join(ctx.here, 'serve-production-preview.mjs')).href
  );
  const { PUBLIC_SECURITY_HEADERS } = await import(
    pathToFileURL(join(ctx.here, 'game-cli.mjs')).href
  );
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads[row.source],
      port: 0,
      fixtureAccess: true,
      cache: 'policy',
    });
    const identity = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(identity.status, 200);
    for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(identity.headers.get(key), value);
    const identityBytes = Buffer.from(await identity.arrayBuffer());
    const build = JSON.parse(identityBytes);
    assert.equal(build.sourceRevision, roleRevision(ctx.plan, row.source));
    const url = new URL('game/?journey=opening', server.url).href;
    row.served = {
      url,
      build,
      buildInfoSHA256: sha(identityBytes),
      headers: server.headers,
      mode: server.mode,
      fixtureAccess: server.fixtureAccess,
    };
    const admitted = ctx.admitted.artifacts[row.source];
    assert.equal(admitted.sourceRevision, build.sourceRevision);
    row.artifactAdmission = admitted;
    const command = await ctx.run(
      row.id,
      [process.execPath, ...sustainedArguments(ctx, row, url, dir)],
      row.timeoutMs,
      {
        env: { ...ctx.cleanEnv, TMPDIR: tmp },
        log: join(dir, 'command.log'),
        receipt: join(dir, 'command.json'),
        inspect: async () => {
          await ctx.inspect();
          assert((await ctx.evidenceSize(dir)) <= ctx.plan.rowEvidenceBytes, 'Row evidence cap');
        },
      },
    );
    row.command = command;
    if (ctx.plan.phase === 'diagnostics') {
      const raw = await checkedJSON(join(dir, 'diagnostics/analysis.json'));
      const manifest = await checkedJSON(join(dir, 'diagnostics/manifest.json'));
      assert.equal(manifest.configuration.cpuRate, ctx.modeState.cpu);
      assert.equal(raw.provenance?.sourceRevision, source.candidate);
      assert.equal(
        raw.provenance?.declaredArtifactSha256,
        ctx.admitted.artifacts.candidate.archiveIdentity.sha256,
      );
      Object.assign(
        row,
        diagnosticsAssessment(raw, manifest, row, command, ctx.modeState.browserVersion),
      );
    } else {
      const raw = ctx.modeState.snapshotStorage
        ? await (
            await import('./solo-qualification-snapshot-store.mjs')
          ).readQualificationSnapshotReport(join(dir, 'report.json'), ctx.modeState.snapshotStorage)
        : await checkedJSON(join(dir, 'report.json'), ctx.plan.rowEvidenceBytes);
      assert.equal(raw.environment?.cpuThrottle, ctx.modeState.cpu);
      Object.assign(
        row,
        (timingPlan(ctx.plan)
          ? timingAssessment
          : ctx.plan.phase === 'long29'
            ? longRecordingAssessment
            : lifecycleAssessment)(ctx.plan, row, raw, command, ctx.modeState.browserVersion),
      );
      row.browserVersion = raw.environment?.browserVersion;
      assert.equal(typeof row.browserVersion, 'string');
      if (ctx.modeState.browserVersion)
        assert.equal(row.browserVersion, ctx.modeState.browserVersion);
      else ctx.modeState.browserVersion = row.browserVersion;
    }
    Object.assign(row, comparisonLabels(ctx.plan));
    await verifyInputs(ctx);
  } finally {
    if (server) {
      await Promise.race([
        new Promise((resolveClose, reject) => {
          server.server.close((error) => (error ? reject(error) : resolveClose()));
          server.server.closeAllConnections();
        }),
        delay(10000).then(() => {
          throw new Error('Sustained owned preview close deadline');
        }),
      ]).catch((error) => {
        row.serverCleanupFailure = String(error);
        row.status = 'failed';
        throw error;
      });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, engine, repetition] = process.argv.slice(2);
  const bytes = await readFile(input);
  if (mode === 'timing-matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(timingMatrix(JSON.parse(bytes)))}\n`);
  else if (mode === 'bind-timing-plan') {
    const plan = bindTimingJob(JSON.parse(bytes), engine, Number(repetition));
    plan.manifestInput = { path: resolve(input), bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  } else if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(sustainedMatrix(JSON.parse(bytes)))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindSustainedJob(JSON.parse(bytes), engine, Number(repetition));
    plan.manifestInput = { path: resolve(input), bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
