import { readExecuted73Source, assertExecuted73Ref } from './solo-73-executed-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { admitDefaultBaselineReuse } from './run-solo-remote-correctness.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPath = 'docs/performance/solo-remote-73a345-correctness-plan.json';
const priorPath = 'docs/performance/solo-remote-de332-correctness-tooling-plan.json';
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const plan = JSON.parse(await read(planPath));
const prior = JSON.parse(await read(priorPath));
const executed = await readExecuted73Source();
const workflow = executed.workflow;
const job = workflow.split('\n  correctness:\n')[1].split('\n  declare:\n')[0];
const source = '73a345cec696d7789198cf295ca5c37b17ca0e71';
const guard =
  "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'";
const candidate = {
  revision: source,
  tree: 'ea30e68636b3342f8e60664a79d425e11e27ff1e',
  run: 39099979283,
  artifact: 12127570566,
  outer: {
    bytes: 1094639407,
    sha256: '6d93e34b3372e24f1f010bb630d7d7b688fdbc8a1280b3f3a9945e99ac171e64',
  },
  inner: {
    bytes: 1075807617,
    sha256: '17d7135c4d16693f0ddb5ee655d6552fdedc18ef7add72aefa7d8e39a7b24a54',
  },
  manifestSHA256: 'd16a636797b4269357cb6302211c71503819b0ca7ae333d244587cee7d159d93',
  producer:
    'Exact successful Appearance39099979283, Node22.13.1. Full hosted archive/member/source/CSP verification remains mandatory.',
};
function declaration(value) {
  assert.deepEqual(value.candidate, candidate);
  assert.equal(value.runtimeRevision, source);
  assert.equal(value.status, 'reviewed-correctness-only');
  assert.deepEqual(value.releaseTrigger, {
    status: 'reviewed-explicit-dispatch',
    workflow: workflowPath,
    sameRepositoryRequired: true,
    manualLane: 'first-eight',
    manualRef: 'refs/heads/main',
    automaticRetries: 0,
  });
  assert.equal(value.packageBinding.producerRun, candidate.run);
  assert.equal(value.packageBinding.producerConclusion, 'success');
  assert.equal(value.packageBinding.metadataArtifact, 12127316659);
  assert.deepEqual(value.packageBinding.metadataOuter, {
    bytes: 37136,
    sha256: 'f520c7e8183310822b43a6a2b7c5126c21d92602d2ac0eecd1b2c9b7e7190e67',
  });
  assert.equal(value.packageBinding.manifestBytes, 529292);
  assert.equal(value.packageBinding.requiredFocusedFiles, 118);
  assert.equal(value.packageBinding.requiredPassedTests, 1756);
  assert.equal(value.packageBinding.prerequisitePassedTests, 624);
  assert.equal(value.packageBinding.payloadFiles, 3556);
  assert.deepEqual(value.currentSourceCorrectness, {
    status: 'not-yet-observed',
    source,
    receipt: null,
  });
  assert.deepEqual(
    value.priorQualificationReview.runs.map((row) => [row.run, row.commands]),
    [
      [39096176143, 14],
      [39098131087, 27],
    ],
  );
  assert.equal(value.sourceSuccessor.previousDeclaration, priorPath);
  assert.equal(value.sourceSuccessor.previousRuntimeRevision, prior.runtimeRevision);
}

test('source73 binds its actual package and complete producer totals without merged-main or old-source credit', () => {
  declaration(plan);
  for (const mutate of [
    ...['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'].map(
      (key) => (value) => {
        value.candidate[key] = prior.candidate[key];
      },
    ),
    (value) => {
      value.candidate.revision = 'bbd56e6fcd8f20113ccb168660d5e05d0781e1e3';
    },
    (value) => {
      value.packageBinding.producerConclusion = 'failure';
    },
    (value) => {
      value.packageBinding.metadataArtifact++;
    },
    (value) => {
      value.packageBinding.metadataOuter.sha256 = '0'.repeat(64);
    },
    (value) => {
      value.packageBinding.requiredPassedTests = 1748;
    },
    (value) => {
      value.currentSourceCorrectness.status = 'passed';
    },
    (value) => {
      value.currentSourceCorrectness.source = prior.runtimeRevision;
    },
    (value) => {
      value.releaseTrigger.onceOnlyBefore = source;
    },
    (value) => {
      value.releaseTrigger.manualRef = 'refs/heads/other';
    },
    (value) => {
      value.priorQualificationReview.runs[1].commands--;
    },
  ]) {
    const value = structuredClone(plan);
    mutate(value);
    assert.throws(() => declaration(value));
  }
});

test('source73 preserves all eight rows, exact baseline and recipe, original limits and raw numerical failures', () => {
  for (const key of [
    'format',
    'repository',
    'node',
    'playwright',
    'rows',
    'fixture',
    'baseline',
    'performanceExclusion',
    'helperTimeoutMs',
    'evidenceBytes',
    'acceptance',
    'resources',
  ])
    assert.deepEqual(plan[key], prior[key], key);
  assert.equal(plan.rows.length, 8);
  assert.equal(
    plan.rows.every((row) => row.timeoutMs === 240000 && row.performanceExclusion),
    true,
  );
  for (const key of ['hitchJournal', 'profile', 'cpu', 'readinessProbe'])
    assert.equal(plan[key], undefined);
});

function workflowAdmission(text) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert.match(text, /^    timeout-minutes: 145$/m);
  assert.match(text, /timeout-minutes: 79\n        working-directory: tools/);
  assert(text.includes(`78m node scripts/run-solo-remote-correctness.mjs ${planPath}`));
  assert(text.includes('playwright@1.62.1'));
  assert(text.includes('install --with-deps chromium webkit'));
  assert(text.includes("node-version: '22.13.1'"));
  assert(text.includes('SOLO_TOOLING_REVISION: ${{ github.sha }}'));
  assert(text.includes('ref: ${{ github.sha }}'));
  assert(
    text.includes(
      'solo-shared-source-checkout.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 ' +
        source +
        ' ' +
        candidate.tree,
    ),
  );
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(text.includes('solo-linux-73a345-correctness'));
  for (const forbidden of [
    'continue-on-error',
    'inputs.source',
    'inputs.artifact',
    'inputs.timeout',
  ])
    assert(!text.includes(forbidden));
}
test('first-eight requires explicit trusted-main dispatch; no automatic Next or source/package input', () => {
  workflowAdmission(job);
  const evaluate = new Function('github', 'inputs', `return (${guard})`);
  const github = {
    repository: 'mekhovov/revealline',
    event_name: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assert.equal(evaluate(github, { lane: 'first-eight' }), true);
  for (const other of [
    { ...github, repository: 'fork/repo' },
    { ...github, event_name: 'pull_request' },
    { ...github, event_name: 'push' },
    { ...github, ref: 'refs/heads/other' },
  ])
    assert.equal(evaluate(other, { lane: 'first-eight' }), false);
  for (const lane of ['next', 'all', '', undefined])
    assert.equal(evaluate(github, { lane }), false);
  for (const term of guard.split(' && '))
    assert.throws(() =>
      workflowAdmission(
        job.replace(
          guard,
          guard
            .split(' && ')
            .filter((value) => value !== term)
            .join(' && '),
        ),
      ),
    );
  for (const [before, after] of [
    ['timeout-minutes: 145', 'timeout-minutes: 146'],
    ['timeout-minutes: 79', 'timeout-minutes: 80'],
    ['78m node', '79m node'],
    [candidate.tree, prior.candidate.tree],
  ])
    assert.throws(() => workflowAdmission(job.replace(before, after)));
  const inputs = workflow.split('  workflow_dispatch:\n')[1].split('\npermissions:')[0];
  assert.deepEqual(
    [...inputs.matchAll(/^      ([a-z_-]+):$/gm)].map((match) => match[1]),
    ['lane'],
  );
  assert.match(workflow.split('\n  sustained:\n')[1], /^    needs: declare$/m);
});

async function current(ref) {
  const bytes = await read(ref.path);
  assert.equal(bytes.length, ref.bytes, ref.path);
  assert.equal(sha(bytes), ref.sha256, ref.path);
}
test('executed runtime refs and original complete read inputs remain bound to exact570', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  const sparse = [...job.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  assert.equal(new Set(refs.map((ref) => ref.path)).size, refs.length);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of refs) assertExecuted73Ref(executed.refs, ref);
  for (const path of [
    planPath,
    workflowPath,
    'scripts/test-solo-73a345-correctness.mjs',
    ...refs.map((ref) => ref.path),
  ])
    assert(sparse.includes(path), path);
  const runner = refs.find((ref) => ref.path === 'scripts/run-solo-remote-correctness.mjs');
  assert.throws(() => assertExecuted73Ref(executed.refs, { ...runner, sha256: '0'.repeat(64) }));
  assert.throws(() => assertExecuted73Ref(executed.refs, { ...runner, bytes: runner.bytes + 1 }));
});

test('actual default-baseline admission still rejects altered helper identity before evidence publication', async () => {
  const changed = structuredClone(plan);
  changed.adapterInputs[0].sha256 = '0'.repeat(64);
  await assert.rejects(
    () =>
      admitDefaultBaselineReuse(changed, fileURLToPath(root), '/never-published-source73-evidence'),
    /Changed baseline helper/,
  );
});

test('historical de332 declarations, executed source and scoped outcome evidence remain exact bytes', async () => {
  for (const ref of [...plan.historicalInputs, ...plan.priorQualificationReview.evidence])
    await current(ref);
});
