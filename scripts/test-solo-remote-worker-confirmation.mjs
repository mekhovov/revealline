import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  validateWorkerDiagnosticPlan,
  workerConfirmationAssessment,
  workerProbeArguments,
  WORKER_CONFIRMATION_ROWS,
} from './solo-remote-worker-diagnostic.mjs';
const plan = JSON.parse(
  await readFile(
    new URL('../docs/performance/solo-remote-worker-confirmation-plan.json', import.meta.url),
  ),
);
test('confirmation binds all three ordinary probes and the paused companion without promotion', async () => {
  validateWorkerDiagnosticPlan(plan);
  assert.deepEqual(plan.rows, WORKER_CONFIRMATION_ROWS);
  for (const ref of plan.adapterInputs) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.deepEqual(
      { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
      { bytes: ref.bytes, sha256: ref.sha256 },
    );
  }
  for (const mutate of [
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.predecessorRun = 1),
    (p) => (p.release.diagnosticRun = 1),
    (p) => (p.release.diagnosticAnalysisSHA256 = '0'.repeat(64)),
    (p) => (p.automaticRetries = 1),
    (p) => (p.windowMs = 12000),
    (p) => p.rows.pop(),
    (p) => p.rows[0].timeoutMs++,
    (p) => (p.performanceExclusion = false),
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(() => validateWorkerDiagnosticPlan(changed));
  }
});
test('ordinary confirmation arguments omit instrumentation and the diagnostic default is unchanged', () => {
  for (const row of plan.rows)
    assert.deepEqual(workerProbeArguments(plan, row, 'http://localhost/game/', '/report.json'), [
      row.kind === 'worker' ? 'verify-solo-mp3-worker.mjs' : 'verify-solo-paused-render.mjs',
      'http://localhost/game/',
      '/report.json',
      '--fixture-access',
      '--browser=webkit',
    ]);
  const diagnostic = { format: 'SoloHostedWorkerDiagnosticPlanV1' };
  for (const arm of ['worker', 'idle'])
    assert.deepEqual(workerProbeArguments(diagnostic, { arm }, 'url', 'report'), [
      'verify-solo-mp3-worker.mjs',
      'url',
      'report',
      '--fixture-access',
      '--browser=webkit',
      '--diagnostics',
      ...(arm === 'idle' ? ['--idle-control'] : []),
    ]);
});
const command = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] };
const raw = {
  engine: 'webkit',
  browser: '26.5',
  status: 'passed',
  mode: 'worker',
  validationPassed: true,
  active: { flightBefore: 'running', flightAfter: 'running' },
  pageErrors: [],
  policyErrors: [],
};
test('confirmation preserves failed active state, validation and cleanup evidence', () => {
  const row = plan.rows[0];
  const result = workerConfirmationAssessment(raw, command, row);
  assert.equal(result.status, 'passed');
  assert.equal(result.firstEightAllCorrectnessPassed, false);
  assert.equal(result.diagnostic204msInterval, 'retained-unattributed');
  for (const mutate of [
    (r) => (r.active.flightAfter = 'paused'),
    (r) => (r.validationPassed = false),
    (r) => (r.mode = 'paused-fallback'),
    (r) => (r.diagnostics = {}),
    (r) => r.pageErrors.push('error'),
    (r) => r.policyErrors.push('error'),
  ]) {
    const changed = structuredClone(raw);
    mutate(changed);
    assert.equal(workerConfirmationAssessment(changed, command, row).status, 'failed');
  }
  for (const mutation of [
    { exitCode: 1 },
    { forcedCleanup: true },
    { cleanupUnconfirmed: true },
    { violation: 'rss' },
    { survivors: [1] },
    { ambiguous: [2] },
  ])
    assert.equal(
      workerConfirmationAssessment(raw, { ...command, ...mutation }, row).status,
      'failed',
    );
});
test('paused companion requires all original observations and actual running return', () => {
  const paused = {
    engine: 'webkit',
    browser: '26.5',
    status: 'passed',
    pageErrors: [],
    observation: {
      cases: [
        'paused-initial-settling',
        'startup-settling',
        'paused',
        'covered-by-settings',
        'resize-invalidation',
        'resumed',
      ].map((name) => ({ name, state: 'running' })),
    },
  };
  const row = plan.rows[3];
  assert.equal(workerConfirmationAssessment(paused, command, row).status, 'passed');
  paused.observation.cases.at(-1).state = 'paused';
  assert.equal(workerConfirmationAssessment(paused, command, row).status, 'failed');
  paused.observation.cases = [];
  assert.equal(workerConfirmationAssessment(paused, command, row).status, 'failed');
});
test('confirmation is one declared push edge and both earlier observations remain parked', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/solo-remote-worker-confirmation-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /github\.event\.pull_request\.number == 1544/);
  assert.match(
    workflow,
    /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  );
  assert.match(workflow, /github\.event\.action == 'synchronize'/);
  assert.match(workflow, /github\.event\.before == '69fdc854ecc07eca46a3becc3e38c233a3865fb0'/);
  assert.equal((workflow.match(/fetch-depth: 1/g) ?? []).length, 3);
  const earlier = await readFile(
    new URL('../.github/workflows/solo-remote-worker-diagnostic-temporary.yml', import.meta.url),
    'utf8',
  );
  assert.match(earlier, /github\.event\.before == '7bf47c6ff631149f4b82f57c67a84d6df6b5827f'/);
});
