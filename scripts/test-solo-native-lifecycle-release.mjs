import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { bindLifecycleJob, lifecycleMatrix, LIFECYCLE_SOURCE } from './solo-remote-lifecycle.mjs';
const manifestPath = 'docs/performance/solo-native-lifecycle-plan.json';
const workflowPath = '.github/workflows/solo-remote-native-lifecycle-temporary.yml';
const root = new URL('../', import.meta.url);
// Actual executed helper identities are historical; they must not follow HEAD.
const lifecycleWitnessBytes = await readFile(
  new URL('docs/performance/fixtures/solo-native-lifecycle/696-execution-source.json', root),
);
assert.equal(
  createHash('sha256').update(lifecycleWitnessBytes).digest('hex'),
  'd7eeda3b2500754e80a870904deb77508006c21f9076a525a8c9b31ad070b27b',
);
const lifecycleWitness = JSON.parse(lifecycleWitnessBytes);
assert.equal(lifecycleWitness.sourceRevision, '69639b30d985ffa723a4d0c11756b632fc2da5c1');
assert.equal(lifecycleWitness.sourceTree, 'd022c57efa75dbe7b7aeeca00a1950f61426595b');
// The actual696 runner is historical too; its receipt does not authorize current helpers.
const historicalRunnerBytes = await readFile(
  new URL('docs/performance/fixtures/solo-native-lifecycle/696-runner-source.json', root),
);
assert.equal(
  createHash('sha256').update(historicalRunnerBytes).digest('hex'),
  '98b44d2a23cee5e124504cb2e3d4f97f2024846771d920e6e22ec61746f0dfbc',
);
const historicalRunner = JSON.parse(historicalRunnerBytes);
const assertHistoricalRunnerRef = (ref, witness = historicalRunner) => {
  assert.deepEqual(witness, {
    format: 'SoloLifecycleHistoricalRunnerV1',
    sourceRevision: '69639b30d985ffa723a4d0c11756b632fc2da5c1',
    sourceTree: 'd022c57efa75dbe7b7aeeca00a1950f61426595b',
    path: 'scripts/run-solo-remote-correctness.mjs',
    gitBlob: 'b3a8d041cdb70697183f1b3562a5f852f70c26fd',
    bytes: 57545,
    sha256: 'cdec62bc65481f30bb36d7055227594a727f390e75d5bbb86415f1b7fa2a07c7',
    scope:
      'Exact actual696 source runner for already executed a6 lifecycle and offline declarations; no authority for a new source release.',
  });
  if (ref.path !== witness.path) return false;
  assert.deepEqual(ref, { path: witness.path, bytes: witness.bytes, sha256: witness.sha256 });
  return true;
};
const recordedLifecycleRef = (ref) => {
  if (assertHistoricalRunnerRef(ref)) return true;
  if (
    !['scripts/solo-remote-lifecycle.mjs', 'scripts/observe-solo-native-lifecycle.mjs'].includes(
      ref.path,
    )
  )
    return false;
  const recorded = lifecycleWitness.files.find((file) => file.path === ref.path);
  assert.deepEqual(ref, { path: recorded.path, bytes: recorded.bytes, sha256: recorded.sha256 });
  return true;
};
for (const recorded of lifecycleWitness.files.filter((file) => !file.path.startsWith('scripts/'))) {
  const bytes = await readFile(new URL(recorded.path, root));
  assert.equal(bytes.length, recorded.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), recorded.sha256);
}
export async function assertLifecycleRelease(manifest, workflow) {
  const plan = bindLifecycleJob(manifest, 'chromium-background');
  assert.deepEqual(lifecycleMatrix(manifest).include[0], {
    job: 'chromium-background',
    jobMinutes: 100,
    stepMinutes: 58,
    outerSeconds: 3420,
  });
  const previous = JSON.parse(
    await readFile(new URL('docs/performance/solo-remote-offline-candidate-plan.json', root)),
  );
  assert.deepEqual(manifest.candidate, previous.candidate);
  assert.equal(manifest.runtimeRevision, LIFECYCLE_SOURCE.runtime);
  assert.equal(manifest.releaseTrigger.status, 'reviewed-one-shot');
  assert(
    workflow.includes(
      "    if: github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'\n",
    ),
  );
  assert(!workflow.includes('workflow_dispatch'));
  assert(workflow.includes('max-parallel: 1'));
  assert(workflow.includes('job: [chromium-background]'));
  assert(workflow.includes('timeout-minutes: 100'));
  assert(workflow.includes('timeout-minutes: 58'));
  assert(workflow.includes('3420s node scripts/run-solo-remote-correctness.mjs'));
  assert(workflow.includes('install --with-deps chromium '));
  assert(!workflow.includes('install --with-deps chromium webkit'));
  assert(!workflow.includes('filter:'));
  assert(workflow.includes('sparse-checkout-cone-mode: false'));
  const sourceCheckouts = [
    ...workflow.matchAll(
      /- timeout-minutes: 3\n\s+uses: actions\/checkout@[\s\S]*?ref: ([a-f0-9]{40})\n\s+path: (baseline|candidate)\n\s+persist-credentials: false\n\s+fetch-depth: 1/g,
    ),
  ];
  assert.deepEqual(
    sourceCheckouts.map((m) => [m[1], m[2]]),
    [
      [manifest.baseline.revision, 'baseline'],
      [manifest.candidate.revision, 'candidate'],
    ],
  );
  assert.equal((workflow.match(/if: \$\{\{ always\(\) \}\}/g) || []).length, 2);
  assert(workflow.includes('scripts/test-solo-source-verifier-smoke.mjs'));
  assert(workflow.includes('scripts/test-solo-native-lifecycle.mjs'));
  assert(workflow.includes('scripts/test-solo-native-lifecycle-release.mjs'));
  for (const file of [
    manifestPath,
    workflowPath,
    'game/build-config.json',
    'scripts/solo-source-verifier-smoke.mjs',
    'scripts/soundtrack-distribution.mjs',
    'scripts/optional-distribution.mjs',
    'scripts/external-distribution.mjs',
    'scripts/optional-artwork.mjs',
  ])
    assert(workflow.includes('            /' + file + '\n'), file);
  assert.equal(manifest.resources.jobDisjointMinutes.total, 98);
  assert.equal(manifest.resources.jobDisjointMinutes.jobCap, 100);
  for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.fixture]) {
    if (recordedLifecycleRef(ref)) {
      assert(workflow.includes('            /' + ref.path + '\n'), ref.path);
      continue;
    }
    const bytes = await readFile(new URL(ref.path, root));
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    assert(workflow.includes('            /' + ref.path + '\n'), ref.path);
  }
}
test('one-shot native lifecycle declaration binds exact source, helpers, sparse closure and finite budgets', async () => {
  await assertLifecycleRelease(
    JSON.parse(await readFile(new URL(manifestPath, root))),
    await readFile(new URL(workflowPath, root), 'utf8'),
  );
});
test('lifecycle release rejects changed helper/source, wrong activation, missing smoke or source checkout', async () => {
  const original = JSON.parse(await readFile(new URL(manifestPath, root))),
    workflow = await readFile(new URL(workflowPath, root), 'utf8');
  for (const mutate of [
    (m) => m.candidate.artifact++,
    (m) => (m.adapterInputs[0].sha256 = '0'.repeat(64)),
    (m) =>
      m.frozenTools.find((r) => r.path === 'scripts/observe-solo-native-lifecycle.mjs').bytes++,
    (m) => (m.runtimeRevision = '0'.repeat(40)),
    (m) => (m.frozenTools[0].sha256 = '0'.repeat(64)),
    (m) => (m.protocol.hiddenMs = 100),
    (m) => (m.releaseTrigger.status = 'held'),
  ]) {
    const m = structuredClone(original);
    mutate(m);
    await assert.rejects(assertLifecycleRelease(m, workflow));
  }
  for (const changed of [
    workflow.replace("github.event.before == 'a7e0219818842f02399317ca6d2a14bdd506da3d'", 'true'),
    workflow.replaceAll('scripts/test-solo-source-verifier-smoke.mjs', 'omitted'),
    workflow.replace('path: candidate', 'path: ignored'),
    workflow.replace('timeout-minutes: 100', 'timeout-minutes: 99'),
    workflow.replaceAll('/scripts/optional-artwork.mjs', '/omitted'),
  ])
    await assert.rejects(assertLifecycleRelease(original, changed));
});

test('historical runner source witness rejects changed manifest references and witness identity', () => {
  const ref = {
    path: historicalRunner.path,
    bytes: historicalRunner.bytes,
    sha256: historicalRunner.sha256,
  };
  assert.equal(assertHistoricalRunnerRef(ref), true);
  assert.throws(() => assertHistoricalRunnerRef({ ...ref, bytes: ref.bytes + 1 }));
  assert.throws(() => assertHistoricalRunnerRef({ ...ref, sha256: '0'.repeat(64) }));
  for (const field of ['sourceRevision', 'sourceTree', 'gitBlob', 'sha256']) {
    const changed = structuredClone(historicalRunner);
    changed[field] = '0'.repeat(changed[field].length);
    assert.throws(() => assertHistoricalRunnerRef(ref, changed));
  }
});
