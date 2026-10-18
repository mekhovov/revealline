import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { admitDefaultBaselineReuse } from './run-solo-remote-correctness.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPath = 'docs/performance/solo-remote-797e03-correctness-plan.json';
const priorPath = 'docs/performance/solo-remote-73a345-correctness-tooling-plan.json';
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const plan = JSON.parse(await read(planPath));
const prior = JSON.parse(await read(priorPath));
const workflow = (await read(workflowPath)).toString();
const job = workflow.split('\n  correctness:\n')[1].split('\n  declare:\n')[0];
const source = '797e03f28743921842df6aa57520a72016ba3dfc';
const tree = 'bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5';
const guard =
  "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'";
const candidate = {
  revision: source,
  tree,
  run: 39104551453,
  artifact: 12128990483,
  outer: {
    bytes: 1094639112,
    sha256: '76a01b2d29119f1bc4d8aaa8da77846160133067d0eb3036f5791c3198b5b897',
  },
  inner: {
    bytes: 1075807530,
    sha256: '5eb1c3e70d8fc460ddeba3762137306cf2e6902c315172c633702621883b7e9c',
  },
  manifestSHA256: '497efcff7f399c12030bfa5297f8e67faaa97ef26626ac88a1b924fcb23db6a0',
  producer:
    'Successful Appearance39104551453; compact metadata independently verified. Full payload/source/worker/CSP validation remains mandatory in hosted consumer.',
};
function declaration(value) {
  assert.deepEqual(value.candidate, candidate);
  assert.equal(value.runtimeRevision, source);
  assert.equal(value.status, 'reviewed-correctness-only');
  assert.deepEqual(value.releaseTrigger, prior.releaseTrigger);
  assert.equal(value.packageBinding.producerRun, candidate.run);
  assert.equal(value.packageBinding.producerConclusion, 'success');
  assert.equal(value.packageBinding.metadataArtifact, 12128970750);
  assert.deepEqual(value.packageBinding.metadataOuter, {
    bytes: 37136,
    sha256: '035cab60bfa3eed7f56a6d9988405c81e14acf9ff5599f0353e980f23fde4263',
  });
  assert.equal(value.packageBinding.manifestBytes, 529292);
  assert.equal(value.packageBinding.requiredFocusedFiles, 118);
  assert.equal(value.packageBinding.requiredPassedTests, 1756);
  assert.equal(value.packageBinding.prerequisiteProofs, 4);
  assert.deepEqual(value.currentSourceCorrectness, {
    status: 'not-yet-observed',
    source,
    receipt: null,
  });
  assert.equal(value.sourceSuccessor.previousDeclaration, priorPath);
  assert.equal(value.sourceSuccessor.previousRuntimeRevision, prior.runtimeRevision);
  assert.equal(value.historicalSourceCorrectnessReview.source, prior.runtimeRevision);
  assert.equal(value.historicalSourceCorrectnessReview.qualificationForCandidate, false);
}
test('source797 binds exact verified preview identities and rejects mixed or promoted authority', () => {
  declaration(plan);
  for (const mutate of [
    ...['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'].map(
      (key) => (value) => {
        value.candidate[key] = prior.candidate[key];
      },
    ),
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
      value.currentSourceCorrectness.receipt = { run: 39105055762 };
    },
    (value) => {
      value.historicalSourceCorrectnessReview.qualificationForCandidate = true;
    },
    (value) => {
      value.releaseTrigger.manualRef = 'refs/heads/other';
    },
    (value) => {
      value.releaseTrigger.onceOnlyBefore = source;
    },
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(() => declaration(changed));
  }
});
test('all eight workloads, baseline, recipe, acceptance, original bounds and numerical exclusions are unchanged', () => {
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
  assert(plan.rows.every((row) => row.timeoutMs === 240000 && row.performanceExclusion));
  for (const key of ['hitchJournal', 'profile', 'cpu', 'readinessProbe'])
    assert.equal(plan[key], undefined);
});
function workflowAdmission(text) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert.match(text, /^    timeout-minutes: 145$/m);
  assert(text.includes('timeout-minutes: 79\n        working-directory: tools'));
  assert(text.includes('78m node scripts/run-solo-remote-correctness.mjs ' + planPath));
  assert(
    text.includes(
      'solo-shared-source-checkout.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 ' +
        source +
        ' ' +
        tree,
    ),
  );
  assert(text.includes('playwright@1.62.1'));
  assert(text.includes('install --with-deps chromium webkit'));
  assert(text.includes("node-version: '22.13.1'"));
  assert(text.includes('SOLO_TOOLING_REVISION: ${{ github.sha }}'));
  assert(text.includes('ref: ${{ github.sha }}'));
  assert(text.includes('solo-linux-797e03-correctness'));
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  for (const forbidden of [
    'continue-on-error',
    'inputs.source',
    'inputs.artifact',
    'inputs.timeout',
  ])
    assert(!text.includes(forbidden));
  const command = text.split('\n').find((line) => line.trim().startsWith('node --test '));
  const args = command.trim().split(/\s+/);
  assert(args.includes('scripts/test-solo-797e03-correctness.mjs'));
  const firstFile = args.findIndex((arg) => arg.endsWith('.mjs'));
  assert(firstFile > 1);
  assert(!args.slice(firstFile).some((arg) => arg.startsWith('--test')));
}
test('manual trusted-main job selects only797 with exact command ordering and unchanged retention', () => {
  workflowAdmission(job);
  const evaluate = new Function('github', 'inputs', 'return (' + guard + ')');
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
    [
      '78m node scripts/run-solo-remote-correctness.mjs ' + planPath,
      '78m node scripts/run-solo-remote-correctness.mjs ' + priorPath,
    ],
    ['timeout-minutes: 145', 'timeout-minutes: 146'],
    ['timeout-minutes: 79', 'timeout-minutes: 80'],
    ['78m node', '79m node'],
    [tree, prior.candidate.tree],
    [
      'node --test scripts/test-solo-797e03-correctness.mjs',
      'node scripts/test-solo-797e03-correctness.mjs --test',
    ],
  ])
    assert.throws(() => workflowAdmission(job.replace(before, after)));
});
async function current(ref) {
  const bytes = await read(ref.path);
  assert.equal(bytes.length, ref.bytes, ref.path);
  assert.equal(sha(bytes), ref.sha256, ref.path);
}
test('current references match actual sparse files and stale baseline helper fails before publication', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.deepEqual(
    refs.map((ref) => ref.path),
    [...prior.adapterInputs, ...prior.frozenTools, prior.fixture].map((ref) => ref.path),
  );
  const sparse = [...job.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of refs) await current(ref);
  for (const path of [
    planPath,
    priorPath,
    workflowPath,
    'scripts/test-solo-797e03-correctness.mjs',
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
        '/never-published-source797-evidence',
      ),
    /Changed baseline helper/,
  );
});
test('source73 proof and exact executed identities stay historical, preserving all numerical failures', async () => {
  const history = plan.historicalSourceCorrectnessReview;
  await current(history.proof);
  const proof = JSON.parse(await read(history.proof.path));
  assert.equal(proof.run, 39105055762);
  assert.equal(proof.candidate.revision, prior.candidate.revision);
  assert.notEqual(proof.candidate.revision, plan.candidate.revision);
  assert.equal(proof.performanceQualification, false);
  assert.deepEqual(proof.numericalFailures, [
    'baseline-first30-chromium',
    'baseline-first30-webkit',
    'candidate-first30-webkit',
  ]);
  for (const ref of [...plan.historicalInputs, ...plan.priorQualificationReview.evidence])
    await current(ref);
});
