import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  bindDiagnosticsJob,
  diagnosticsMatrix,
  prepareDiagnosticsMode,
} from './solo-remote-diagnostics.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const planPath = 'docs/performance/solo-797-app-diagnostics-plan.json';
const workflow = (await read(workflowPath)).toString();
const held = JSON.parse(await read(planPath));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function body(text) {
  const result = text.split('\n  app-overhead:\n')[1];
  assert(result, 'Missing app-overhead job');
  return result.split(/\n  [a-z][a-z-]+:\n/)[0];
}
const actualFirstEightProof = JSON.parse(
  await readFile(
    new URL(
      '../docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json',
      import.meta.url,
    ),
  ),
).proof;
function reviewedFixture() {
  return structuredClone(held);
}

function admission(text) {
  const job = body(text);
  const guard =
    "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'app-overhead'";
  assert.equal(job.match(/^    if: (.+)$/m)?.[1], guard);
  assert.match(job, /^    timeout-minutes: 130$/m);
  assert.match(
    job,
    /fail-fast: false\n      max-parallel: 1\n      matrix:\n        engine: \[chromium, webkit\]/,
  );
  assert.match(job, /SOLO_TOOLING_REVISION: \$\{\{ github.sha \}\}/);
  assert.match(job, /ref: \$\{\{ github.sha \}\}/);
  assert.match(job, /timeout-minutes: 88\n        working-directory: tools/);
  assert.match(
    job,
    /timeout --signal=TERM --kill-after=30s 5220s node scripts\/run-solo-remote-correctness\.mjs "\$RUNNER_TEMP\/solo-diagnostics-job.json" "\$OUTPUT"/,
  );
  assert.match(job, /node-version: '22.13.1'/);
  assert.match(job, /playwright@1.62.1/);
  assert.match(job, /install --with-deps \$\{\{ matrix.engine \}\}/);
  assert(
    job.includes(
      `bind-plan ${planPath} "$RUNNER_TEMP/solo-diagnostics-job.json" '\${{ matrix.engine }}'`,
    ),
  );
  assert.match(
    job,
    /solo-shared-source-checkout\.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 797e03f28743921842df6aa57520a72016ba3dfc bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5/,
  );
  // The old per-job time envelope is retained, including the single three-minute
  // candidate materialization and six-minute dependency install.
  assert.deepEqual(
    [...job.matchAll(/^        timeout-minutes: (\d+)$/gm)].map((m) => Number(m[1])),
    [3, 6, 10, 3, 88, 2, 10],
  );
  assert.deepEqual(
    [...job.matchAll(/^      - timeout-minutes: (\d+)$/gm)].map((m) => Number(m[1])),
    [2, 3, 1],
  );
  assert.match(
    job,
    /Materialize the exact candidate from the shared source object store\n        timeout-minutes: 3/,
  );
  assert.equal((job.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert.match(job, /failed \|= total > 20\*1024\*1024/);
  assert.match(job, /'maximumTotalBytes':20\*1024\*1024/);
  for (const prohibited of [
    'continue-on-error',
    'inputs.source',
    'inputs.artifact',
    'inputs.timeout',
    'needs:',
  ])
    assert(!job.includes(prohibited), prohibited);
  return guard;
}

test('app-overhead binds actual797 correctness without changing matched limits', () => {
  assert.equal(held.release.status, 'reviewed-diagnostic-only');
  assert.equal(held.release.noUnclosedOwners, true);
  assert.deepEqual(held.release.firstEightEvidence, actualFirstEightProof);
  assert.equal(held.release.firstEightAllCorrectnessPassed, true);
  assert.equal(bindDiagnosticsJob(held, 'chromium').rows[0].timeoutMs, 1800000);
  for (const mutate of [
    (p) => (p.release.status = 'held-for-review'),
    (p) => (p.release.firstEightEvidence = null),
    (p) =>
      (p.release.firstEightEvidence.sourceRevision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
  ]) {
    const missing = structuredClone(held);
    mutate(missing);
    assert.throws(() => bindDiagnosticsJob(missing, 'chromium'));
  }
  const value = reviewedFixture();
  assert.equal(value.runtimeRevision, '797e03f28743921842df6aa57520a72016ba3dfc');
  assert.equal(value.candidate.artifact, 12128990483);
  assert.equal(value.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
  assert.equal(value.analysisMethod, 'paired-p95-endpoint-box-v1');
  assert.equal(value.release.unconditionalClockGuarantee, false);
  assert.equal(value.release.clockErrorAssumption, 'observed-minimum-step-bounds-duration-error');
  assert.equal(value.release.gameplayPerformanceQualification, false);
  assert.equal(value.release.hitchJournalOverheadQualification, false);
  assert.equal(value.observation.cpuRate, 1);
  assert.equal(value.observation.crossOriginIsolationOverride, false);
  assert.equal(value.observation.pairs, 10);
  assert.equal(value.observation.activeMs, 30000);
  assert.equal(value.observation.overheadLimit, 0.05);
  for (const row of diagnosticsMatrix(value).include) {
    assert.deepEqual(row, {
      engine: row.engine,
      jobMinutes: 130,
      stepMinutes: 88,
      outerSeconds: 5220,
    });
    assert.equal(bindDiagnosticsJob(value, row.engine).rows[0].timeoutMs, 1800000);
  }
});

test('actual manual job guards reject forks, other events, refs and lanes without automatic retries', () => {
  const guard = admission(workflow);
  assert.match(
    workflow,
    /options:\s*\[\s*first-eight,\s*next,\s*cocoa,\s*raster,\s*hud-cpu,\s*readiness,\s*touch,\s*app-overhead,\s*journal-cost,\s*timing,\s*lifecycle,\s*shared-return,\s*demo-recovery,\s*demo-resources,\s*replay-portability,\s*frame-trace,?\s*\]/,
  );
  assert.match(workflow, /cancel-in-progress: false/);
  const evaluate = new Function('github', 'inputs', `return (${guard})`);
  const github = {
    repository: 'mekhovov/revealline',
    event_name: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assert.equal(evaluate(github, { lane: 'app-overhead' }), true);
  for (const input of [
    { ...github, repository: 'fork/repo' },
    { ...github, event_name: 'pull_request' },
    { ...github, ref: 'refs/heads/other' },
  ])
    assert.equal(evaluate(input, { lane: 'app-overhead' }), false);
  assert.equal(evaluate(github, { lane: 'all' }), false);
  for (const term of guard.split(' && '))
    assert.throws(() =>
      admission(
        workflow.replace(
          guard,
          guard
            .split(' && ')
            .filter((x) => x !== term)
            .join(' && '),
        ),
      ),
    );
  for (const [before, after] of [
    ['timeout-minutes: 130', 'timeout-minutes: 131'],
    ['max-parallel: 1', 'max-parallel: 2'],
    ['5220s node', '5221s node'],
    ['timeout-minutes: 88', 'timeout-minutes: 89'],
  ]) {
    const job = body(workflow);
    assert.throws(() => admission('\n  app-overhead:\n' + job.replace(before, after)));
  }
});

test('every actual frozen app input is current and available in the precise sparse job', async () => {
  const paths = [...body(workflow).matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(paths).size, paths.length);
  for (const ref of [...held.adapterInputs, ...held.frozenTools]) {
    assert(paths.includes(ref.path), ref.path);
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
  }
  for (const path of [
    workflowPath,
    planPath,
    'scripts/test-solo-native-consumer-overhead.mjs',
    'scripts/solo-shared-source-checkout.sh',
    'scripts/test-solo-shared-source-checkout.mjs',
    'scripts/solo-overhead-interval.test.mjs',
  ])
    assert(paths.includes(path), path);
});

test('changed adapter input rejects at actual setup boundary before package/native effects', async () => {
  const plan = bindDiagnosticsJob(reviewedFixture(), 'webkit');
  let inspected = 0;
  await assert.rejects(() =>
    prepareDiagnosticsMode({
      plan,
      repository: fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, ''),
      digest: async (path) => {
        const bytes = await readFile(path);
        return {
          bytes: bytes.length,
          sha256: path.endsWith('/solo-remote-diagnostics.mjs') ? '0'.repeat(64) : sha(bytes),
        };
      },
      get admitted() {
        inspected++;
        throw new Error('Package admission must not be consulted');
      },
    }),
  );
  assert.equal(inspected, 0);
});
