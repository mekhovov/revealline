import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertHistoricalWorkerBindings } from './solo-worker-source-witness.mjs';
import {
  validateWorkerDiagnosticPlan,
  workerDiagnosticAssessment,
  WORKER_DIAGNOSTIC_ROWS,
} from './solo-remote-worker-diagnostic.mjs';
const plan = JSON.parse(
  await readFile(
    new URL('../docs/performance/solo-remote-worker-diagnostic-plan.json', import.meta.url),
    'utf8',
  ),
);
test('prospective diagnostic declares all six balanced windows and retains the failed prerequisite', async () => {
  validateWorkerDiagnosticPlan(plan);
  assert.deepEqual(plan.rows, WORKER_DIAGNOSTIC_ROWS);
  await assertHistoricalWorkerBindings(
    'docs/performance/solo-remote-worker-diagnostic-plan.json',
    plan.adapterInputs,
  );
});
test('diagnostic admission rejects promotion, retries, reordered observations and widened deadlines', () => {
  for (const mutate of [
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.automaticRetries = 1),
    (p) => p.rows.reverse(),
    (p) => p.rows[0].timeoutMs++,
    (p) => p.windowMs--,
    (p) => (p.candidate.revision = 'a'.repeat(40)),
    (p) => (p.performanceExclusion = false),
  ]) {
    const copy = structuredClone(plan);
    mutate(copy);
    assert.throws(() => validateWorkerDiagnosticPlan(copy));
  }
});
const command = {
  status: 'closed',
  exitCode: 0,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
};
const diagnostics = {
  mode: 'worker-inspection',
  application: { sourceRevision: plan.candidate.revision, phase: 'paused' },
  windowMs: 12000,
  windowStartedAtMs: 100,
  windowEndedAtMs: 12100,
  initialFlightState: 'running',
  finalFlightState: 'running',
};
const worker = {
  engine: 'webkit',
  browser: '26.5',
  status: 'passed',
  mode: 'worker',
  validationPassed: true,
  active: { flightBefore: 'running', flightAfter: 'running' },
  pageErrors: [],
  diagnostics,
};
test('complete worker result still requires original validation and uninterrupted state', () => {
  assert.equal(workerDiagnosticAssessment(worker, command, { arm: 'worker' }).status, 'passed');
  for (const mutate of [
    (r) => (r.validationPassed = false),
    (r) => (r.active.flightAfter = 'paused'),
    (r) => (r.diagnostics.finalFlightState = 'paused'),
    (r) => (r.diagnostics.application.phase = 'playing'),
    (r) => r.diagnostics.windowEndedAtMs--,
    (r) => r.pageErrors.push('error'),
    (r) => (r.failure = 'failed'),
  ]) {
    const copy = structuredClone(worker);
    mutate(copy);
    assert.equal(workerDiagnosticAssessment(copy, command, { arm: 'worker' }).status, 'failed');
  }
});
test('idle control cannot claim worker validation or a passing first-eight gate', () => {
  const idle = {
    ...worker,
    mode: 'idle-control-no-worker-claim',
    diagnostics: { ...diagnostics, mode: 'public-start-idle-control-no-worker-claim' },
    validationPassed: undefined,
    active: undefined,
  };
  const result = workerDiagnosticAssessment(idle, command, { arm: 'idle' });
  assert.equal(result.status, 'passed');
  assert.equal(result.workerClaim, 'none-idle-control');
  assert.equal(result.firstEightAllCorrectnessPassed, false);
  assert.equal(workerDiagnosticAssessment(worker, command, { arm: 'idle' }).status, 'failed');
  assert.equal(
    workerDiagnosticAssessment(idle, { ...command, forcedCleanup: true }, { arm: 'idle' }).status,
    'failed',
  );
  assert.equal(
    workerDiagnosticAssessment(idle, { ...command, survivors: [12] }, { arm: 'idle' }).status,
    'failed',
  );
});

test('hosted diagnostic runs only once on its declared synchronize edge', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-worker-diagnostic-temporary.yml', import.meta.url),
    'utf8',
  );
  const condition = workflow
    .split('\n')
    .find((line) => line.trimStart().startsWith('if:'))
    ?.trim();
  assert.equal(
    condition,
    "if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '7bf47c6ff631149f4b82f57c67a84d6df6b5827f'",
  );
  const original = await readFile(
    new URL('../.github/workflows/solo-remote-correctness-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(
    original,
    /github\.event\.pull_request\.head\.sha == 'ddbb565a0640b61f83edde5828a2825942cf26ab'/,
  );
});
