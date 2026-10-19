import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  RUNTIME9D_WORKER_COHORT,
  WORKER_DIAGNOSTIC_ROWS,
  validateWorkerDiagnosticPlan,
  prepareWorkerDiagnosticMode,
  workerDiagnosticAssessment,
  workerProbeArguments,
} from './solo-remote-worker-diagnostic.mjs';
import './test-solo-remote-correctness.mjs';
import './test-solo-build-worker-closure.mjs';
import './test-solo-worker-diagnostics.mjs';
import './test-solo-remote-worker-diagnostic.mjs';
import './test-solo-remote-worker-confirmation.mjs';
import './test-solo-final-worker-diagnostic.mjs';
import './test-solo-source-verifier-smoke.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPath = 'docs/performance/solo-worker-idle-9d5139b-plan.json';
const workflowPath = '.github/workflows/solo-worker-idle-diagnostic.yml';
const plan = JSON.parse(await read(planPath));
const workflow = (await read(workflowPath)).toString();
const original = JSON.parse(await read('docs/performance/solo-final-worker-diagnostic-plan.json'));
const refs = [...plan.adapterInputs, ...plan.frozenTools];
const repository = fileURLToPath(root).replace(/\/$/, '');
const admitted = () => ({
  status: 'passed',
  artifacts: {
    candidate: {
      sourceRevision: plan.candidate.revision,
      sourceTree: plan.candidate.tree,
      manifestSHA256: plan.candidate.manifestSHA256,
      archiveIdentity: structuredClone(plan.candidate.inner),
    },
  },
});
const digest = async (path) => {
  const bytes = await readFile(path);
  return { bytes: bytes.length, sha256: hash(bytes) };
};

// These are source controls. Actual observations remain unobserved and first-eight stays failed.
test('source9d diagnostic retains six exact ordered windows and every original resource bound', () => {
  validateWorkerDiagnosticPlan(plan);
  assert.equal(plan.sourceCohort, RUNTIME9D_WORKER_COHORT);
  assert.equal(plan.release.firstEightStatus, 'failed-one-of-eight');
  assert.equal(plan.release.correctnessPassed, 7);
  assert.equal(plan.release.correctnessFailed, 1);
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release.observation, 'unobserved');
  assert.deepEqual(plan.rows, original.rows);
  assert.deepEqual(plan.rows, WORKER_DIAGNOSTIC_ROWS);
  for (const name of [
    'windowMs',
    'automaticRetries',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'rowEvidenceBytes',
    'evidenceBytes',
  ])
    assert.equal(plan[name], original[name], name);
  assert.deepEqual(plan.resources, original.resources);
  for (const row of plan.rows)
    assert.deepEqual(
      workerProbeArguments(plan, row, 'url', 'report'),
      workerProbeArguments(original, row, 'url', 'report'),
    );
  assert.equal(plan.release.predecessorRun, 39130685076);
  assert.equal(
    plan.release.failedFirstEightAudit.gitDataBlob,
    'a5208f05089a3e2f3109aae6039958e853f10e4c',
  );
});

test('source9d admission refuses altered authority, package, cohort, order and widened bounds', () => {
  for (const mutate of [
    (p) => (p.sourceCohort = 'worker-idle-candidate9d'),
    (p) => (p.runtimeRevision = original.runtimeRevision),
    (p) => (p.candidate.revision = original.candidate.revision),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => p.candidate.run++,
    (p) => p.candidate.artifact++,
    (p) => p.candidate.outer.bytes++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.manifestSHA256 = '0'.repeat(64)),
    (p) => p.release.predecessorRun++,
    (p) => p.release.predecessorAttempt++,
    (p) => (p.release.predecessorToolingRevision = '0'.repeat(40)),
    (p) => (p.release.predecessorWorkerReport.sha256 = '0'.repeat(64)),
    (p) => p.release.predecessorArtifact.id++,
    (p) => (p.release.failedFirstEightAudit.sha256 = '0'.repeat(64)),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.firstEightStatus = 'passed'),
    (p) => (p.release.correctnessPassed = 8),
    (p) => (p.release.correctnessFailed = 0),
    (p) => (p.release.dispatch.ref = 'refs/heads/arbitrary'),
    (p) => (p.release.dispatch.inputs = 'source'),
    (p) => p.rows.reverse(),
    (p) => p.rows[0].timeoutMs++,
    (p) => p.windowMs++,
    (p) => p.automaticRetries++,
    (p) => p.setupTimeoutMs++,
    (p) => p.helperTimeoutMs++,
    (p) => p.rowEvidenceBytes++,
    (p) => p.evidenceBytes++,
    (p) => (p.performanceExclusion = false),
  ]) {
    const candidate = structuredClone(plan);
    mutate(candidate);
    assert.throws(() => validateWorkerDiagnosticPlan(candidate));
  }
});

test('actual source9d preparation hashes every current input and exact package before effects', async () => {
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  const visited = [];
  const ctx = {
    plan,
    repository,
    admitted: admitted(),
    digest: async (path) => {
      visited.push(path);
      return digest(path);
    },
  };
  assert.equal((await prepareWorkerDiagnosticMode(ctx)).performanceQualification, 'excluded');
  assert.equal(visited.length, refs.length);
  for (const ref of refs) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
  }
  for (const mutate of [
    (a) => (a.artifacts.candidate.sourceTree = '0'.repeat(40)),
    (a) => (a.artifacts.candidate.sourceRevision = original.candidate.revision),
    (a) => (a.artifacts.candidate.manifestSHA256 = '0'.repeat(64)),
    (a) => a.artifacts.candidate.archiveIdentity.bytes++,
  ]) {
    const candidate = admitted();
    mutate(candidate);
    await assert.rejects(prepareWorkerDiagnosticMode({ ...ctx, admitted: candidate }));
  }
  const stale = structuredClone(plan);
  stale.adapterInputs[0].sha256 = '0'.repeat(64);
  await assert.rejects(prepareWorkerDiagnosticMode({ ...ctx, plan: stale }));
});

const command = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  cleanupUnconfirmed: false,
  violation: null,
  survivors: [],
  ambiguous: [],
};
function rawFor(row) {
  const worker = row.arm === 'worker';
  return {
    engine: 'webkit',
    browser: '26.5',
    status: 'passed',
    pageErrors: [],
    mode: worker ? 'worker' : 'idle-control-no-worker-claim',
    ...(worker
      ? { validationPassed: true, active: { flightBefore: 'running', flightAfter: 'running' } }
      : {}),
    diagnostics: {
      mode: worker ? 'worker-inspection' : 'public-start-idle-control-no-worker-claim',
      windowMs: 12000,
      windowStartedAtMs: 100,
      windowEndedAtMs: 12100,
      initialFlightState: 'running',
      finalFlightState: 'running',
      application: {
        sourceRevision: plan.candidate.revision,
        phase: 'paused',
        events: [{ kind: 'pause-span-begin' }, { kind: 'pause-span-end' }],
      },
    },
  };
}
test('worker and idle are distinct diagnostics and cannot promote failed first-eight or numerical qualification', () => {
  for (const row of [plan.rows[0], plan.rows[1]]) {
    const raw = rawFor(row),
      result = workerDiagnosticAssessment(raw, command, row, plan);
    assert.equal(result.status, 'passed');
    assert.equal(result.diagnosticCompleteness, 'complete');
    assert.equal(result.firstEightAllCorrectnessPassed, false);
    assert.equal(result.performanceQualification, 'excluded');
    assert.equal(
      result.workerClaim,
      row.arm === 'worker' ? 'original-worker-assertions-required' : 'none-idle-control',
    );
    raw.diagnostics.finalFlightState = 'paused';
    raw.status = 'failed';
    const failed = workerDiagnosticAssessment(raw, { ...command, exitCode: 1 }, row, plan);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.diagnosticCompleteness, 'complete');
    assert.equal(failed.firstEightAllCorrectnessPassed, false);
  }
});
test('wrong source, missing diagnostics, original worker failure or unclosed owner cannot pass', () => {
  for (const mutate of [
    (x) => (x.raw.diagnostics.application.sourceRevision = original.candidate.revision),
    (x) => delete x.raw.diagnostics,
    (x) => (x.raw.validationPassed = false),
    (x) => (x.raw.active.flightAfter = 'paused'),
    (x) => (x.command.status = 'failed'),
    (x) => (x.command.forcedCleanup = true),
    (x) => (x.command.cleanupUnconfirmed = true),
    (x) => (x.command.violation = 'deadline'),
    (x) => (x.command.survivors = [{ pid: 1 }]),
    (x) => (x.command.ambiguous = [{ pid: 2 }]),
    (x) => (x.command.exitCode = 1),
  ]) {
    const x = { raw: rawFor(plan.rows[0]), command: structuredClone(command) };
    mutate(x);
    assert.equal(workerDiagnosticAssessment(x.raw, x.command, plan.rows[0], plan).status, 'failed');
  }
  const idle = rawFor(plan.rows[1]);
  idle.validationPassed = true;
  assert.equal(workerDiagnosticAssessment(idle, command, plan.rows[1], plan).status, 'failed');
});

test('fixed manual workflow has no arbitrary selector, retries or expanded owner deadlines', async () => {
  assert(workflow.includes('  workflow_dispatch:'));
  assert(!workflow.includes('pull_request:'));
  assert(!workflow.includes('inputs:'));
  assert(
    workflow.includes(
      "if: github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'",
    ),
  );
  assert(workflow.includes('SOLO_TOOLING_REVISION: ' + '$' + '{{ github.sha }}'));
  assert(workflow.includes('cancel-in-progress: false'));
  for (const literal of [
    'timeout-minutes: 145',
    'timeout-minutes: 79',
    'timeout-minutes: 3',
    "node-version: '22.13.1'",
    'playwright@1.62.1',
    'ref: ' + plan.candidate.revision,
    'ref: ' + plan.baseline.revision,
  ])
    assert(workflow.includes(literal), literal);
  assert(
    workflow.includes(
      '78m node scripts/run-solo-remote-correctness.mjs ' + planPath + ' "$OUTPUT"',
    ),
  );
  assert.equal(workflow.split('if: ' + '$' + '{{ always() }}').length - 1, 2);
  assert(workflow.includes('retention-days: 14'));
  assert(workflow.includes('if-no-files-found: warn'));
  const commandLine = workflow.split('\n').find((line) => line.trim().startsWith('node --test '));
  assert(
    commandLine.includes(
      'node --test --test-concurrency=2 scripts/solo-worker-idle-9d5139b.test.mjs ',
    ),
  );
  const self = (await read('scripts/solo-worker-idle-9d5139b.test.mjs')).toString();
  for (const path of [
    'scripts/test-solo-remote-correctness.mjs',
    'scripts/test-solo-build-worker-closure.mjs',
    'scripts/test-solo-worker-diagnostics.mjs',
    'scripts/test-solo-remote-worker-diagnostic.mjs',
    'scripts/test-solo-remote-worker-confirmation.mjs',
    'scripts/test-solo-final-worker-diagnostic.mjs',
    'scripts/test-solo-source-verifier-smoke.mjs',
  ])
    assert(self.includes("import './" + path.slice('scripts/'.length) + "';"), path);
  const sparse = [...workflow.matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
  assert.equal(sparse.length, plan.toolingClosure.sparseInputs);
  assert.equal(new Set(sparse).size, sparse.length);
  const prior = (
    await read('.github/workflows/solo-remote-final-worker-diagnostic-temporary.yml')
  ).toString();
  for (const match of prior.matchAll(/^            \/(.+)$/gm))
    assert(sparse.includes(match[1]), match[1]);
  for (const path of [
    ...refs.map((r) => r.path),
    planPath,
    workflowPath,
    'scripts/solo-worker-idle-9d5139b.test.mjs',
    'docs/performance/fixtures/solo-worker-diagnostic/f179-declared-source.json',
  ])
    assert(sparse.includes(path), path);
});
