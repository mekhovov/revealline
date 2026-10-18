import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { admitDefaultBaselineReuse } from './run-solo-remote-correctness.mjs';
import {
  executed73Source,
  assertExecuted73Ref,
  RUNTIME73_EXECUTED_WITNESS,
  RUNTIME73_EXECUTED_WORKFLOW,
} from './solo-73-executed-source.mjs';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const priorPath = 'docs/performance/solo-remote-73a345-correctness-plan.json';
const planPath = 'docs/performance/solo-remote-73a345-correctness-tooling-plan.json';
const priorBytes = await read(priorPath),
  prior = JSON.parse(priorBytes);
const plan = JSON.parse(await read(planPath));
const witnessBytes = await read(RUNTIME73_EXECUTED_WITNESS);
const oldWorkflow = await read(RUNTIME73_EXECUTED_WORKFLOW);
const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
const job = workflow.split('\n  correctness:\n')[1].split('\n  declare:\n')[0];
const proofPath = 'docs/performance/fixtures/solo-73a345-consumer/first-eight-39105055762.json';
// The unexecuted73 tooling declaration stays separate from its immutable570 predecessor.
const nextPlanPath = 'docs/performance/solo-remote-797e03-correctness-plan.json';
const activePlanPath = job.includes(
  '78m node scripts/run-solo-remote-correctness.mjs ' + nextPlanPath,
)
  ? nextPlanPath
  : planPath;
test('tooling successor preserves exact73 runtime, package, recipe, eight rows, baseline, numerical exclusions and bounds', () => {
  for (const key of [
    'format',
    'repository',
    'node',
    'playwright',
    'candidate',
    'baseline',
    'fixture',
    'rows',
    'performanceExclusion',
    'helperTimeoutMs',
    'evidenceBytes',
    'acceptance',
    'resources',
    'runtimeRevision',
    'releaseTrigger',
    'packageBinding',
    'currentSourceCorrectness',
  ])
    assert.deepEqual(plan[key], prior[key], key);
  assert.equal(plan.toolingSuccessor.historicalDeclaration, priorPath);
  assert.equal(plan.toolingSuccessor.executedTooling, '570ca4ffe57f75c342e2d99b62a04a8b62b740a0');
  assert.equal(plan.toolingSuccessor.executedRun, 39105055762);
  assert.equal(plan.currentSourceCorrectness.status, 'not-yet-observed');
  assert.equal(plan.currentSourceCorrectness.receipt, null);
  assert.equal(plan.priorSourceCorrectnessReview.status, 'reviewed-passed-correctness-only');
  assert.equal(plan.priorSourceCorrectnessReview.performanceQualification, false);
  assert.equal(plan.priorSourceCorrectnessReview.freshOwnerRequired, true);
});
test('the independently retained prior proof is source scoped and keeps all three numerical failures', async () => {
  const bytes = await read(proofPath),
    proof = JSON.parse(bytes);
  assert.deepEqual(plan.priorSourceCorrectnessReview.proof, {
    path: proofPath,
    bytes: bytes.length,
    sha256: sha(bytes),
  });
  assert.equal(proof.status, 'passed-correctness-only');
  assert.equal(proof.run, 39105055762);
  assert.equal(proof.artifact, 12127359946);
  assert.equal(
    proof.artifactSHA256,
    '17665afe978ae63cfaf8d24b1a9626e1d7f607b7ee2611fc637c9e680f3d46d8',
  );
  assert.equal(
    proof.summarySHA256,
    'a33416a355620817896366d5312fbecb44f0c7e6b8f7220941c8447886d99762',
  );
  assert.deepEqual(proof.candidate, {
    revision: plan.candidate.revision,
    tree: plan.candidate.tree,
  });
  assert.equal(proof.correctnessRowsPassed, 8);
  assert.equal(proof.strictNativeReplayPassed, 4);
  assert.equal(proof.closedCommands, 14);
  assert.deepEqual(proof.numericalFailures, [
    'baseline-first30-chromium',
    'baseline-first30-webkit',
    'candidate-first30-webkit',
  ]);
  assert.equal(proof.performanceQualification, false);
});
test('immutable570 witness rejects changed source, omitted records, old declaration, workflow and reference identities', () => {
  const refs = executed73Source(witnessBytes, priorBytes, oldWorkflow);
  assert.equal(refs.size, 42);
  for (const ref of [...prior.adapterInputs, ...prior.frozenTools, prior.fixture])
    assertExecuted73Ref(refs, ref);
  for (const mutate of [
    (value) => {
      value.revision = '0'.repeat(40);
    },
    (value) => {
      value.tree = '0'.repeat(40);
    },
    (value) => {
      value.run++;
    },
    (value) => {
      value.records.pop();
    },
    (value) => {
      value.records[0].sha256 = '0'.repeat(64);
    },
  ]) {
    const value = JSON.parse(witnessBytes);
    mutate(value);
    assert.throws(() =>
      executed73Source(Buffer.from(JSON.stringify(value)), priorBytes, oldWorkflow),
    );
  }
  assert.throws(() =>
    executed73Source(witnessBytes, Buffer.concat([priorBytes, Buffer.from(' ')]), oldWorkflow),
  );
  assert.throws(() =>
    executed73Source(witnessBytes, priorBytes, Buffer.concat([oldWorkflow, Buffer.from(' ')])),
  );
  const first = prior.frozenTools[0];
  assert.throws(() => assertExecuted73Ref(refs, { ...first, sha256: '0'.repeat(64) }));
  assert.throws(() => assertExecuted73Ref(refs, { ...first, bytes: first.bytes + 1 }));
  assert.throws(() => assertExecuted73Ref(refs, { ...first, path: 'scripts/unwitnessed.mjs' }));
});
function workflowAdmission(text) {
  const guard =
    "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'";
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert.match(text, /^    timeout-minutes: 145$/m);
  assert(text.includes('timeout-minutes: 79\n        working-directory: tools'));
  assert(text.includes('78m node scripts/run-solo-remote-correctness.mjs ' + activePlanPath));
  assert(text.includes('SOLO_TOOLING_REVISION: ${{ github.sha }}'));
  assert(text.includes('ref: ${{ github.sha }}'));
  assert(text.includes('scripts/test-solo-73a345-correctness-tooling.mjs'));
  assert(
    text.includes(
      activePlanPath === planPath
        ? '73a345cec696d7789198cf295ca5c37b17ca0e71 ea30e68636b3342f8e60664a79d425e11e27ff1e'
        : '797e03f28743921842df6aa57520a72016ba3dfc bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5',
    ),
  );
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  for (const forbidden of [
    'continue-on-error',
    'inputs.source',
    'inputs.artifact',
    'inputs.timeout',
  ])
    assert(!text.includes(forbidden));
}
test('current manual job retains its explicit source successor and original145/79/78m envelope', () => {
  workflowAdmission(job);
  for (const [a, b] of [
    [
      '78m node scripts/run-solo-remote-correctness.mjs ' + activePlanPath,
      '78m node scripts/run-solo-remote-correctness.mjs ' + priorPath,
    ],
    ['timeout-minutes: 145', 'timeout-minutes: 146'],
    ['78m node', '79m node'],
    ["github.ref == 'refs/heads/main' && ", ''],
  ])
    assert.throws(() => workflowAdmission(job.replace(a, b)));
});
test('current prospective refs stay strict before effects; historical witness never admits current changed tooling', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.deepEqual(
    refs.map((ref) => ref.path),
    [...prior.adapterInputs, ...prior.frozenTools, prior.fixture].map((ref) => ref.path),
  );
  for (const ref of refs) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
  }
  for (const ref of plan.historicalInputs) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
  }
  const sparse = [...job.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  assert.equal(sparse.length, new Set(sparse).size);
  for (const path of [
    planPath,
    priorPath,
    proofPath,
    RUNTIME73_EXECUTED_WITNESS,
    RUNTIME73_EXECUTED_WORKFLOW,
    'scripts/solo-73-executed-source.mjs',
    'scripts/test-solo-73a345-correctness-tooling.mjs',
    ...refs.map((ref) => ref.path),
  ])
    assert(sparse.includes(path), path);
  const changed = structuredClone(plan);
  changed.adapterInputs[0].sha256 = '0'.repeat(64);
  await assert.rejects(
    () =>
      admitDefaultBaselineReuse(
        changed,
        fileURLToPath(root),
        '/never-published-source73-tooling-evidence',
      ),
    /Changed baseline helper/,
  );
});
