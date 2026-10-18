import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { admitDefaultBaselineReuse } from './run-solo-remote-correctness.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPath = 'docs/performance/solo-remote-9d5139b-correctness-plan.json';
const priorPath = 'docs/performance/solo-remote-797e03-correctness-plan.json';
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const plan = JSON.parse(await read(planPath));
const prior = JSON.parse(await read(priorPath));
const workflow = (await read(workflowPath)).toString();
const job = workflow.split('\n  correctness:\n')[1].split('\n  declare:\n')[0];
const source = '9d5139b9983c700a6a708f65f379fa4d5a8b0395';
const tree = '99f9e6cea7ea7dc27c93609aae632908531d93d1';
const guard =
  "github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'";
const candidate = {
  revision: source,
  tree,
  run: 39122543440,
  artifact: 12135616655,
  outer: {
    bytes: 1094656114,
    sha256: '84c1621400e4a4a7ce662cf0ee52916fe03e716ec51f0559fbaa218bafa01888',
  },
  inner: {
    bytes: 1075818191,
    sha256: 'ef878c4d42fdcb8ae61ff1e05c4199a6c1b7023decd45a35c9f5fd1dcecd2b16',
  },
  manifestSHA256: '8d4bc6d5d25e92e4743afa9d241180735b16cd446e333ab7b0dab0bca45641c2',
  producer:
    'Successful Appearance39122543440; compact metadata independently verified. Full payload/source/worker/CSP validation remains mandatory in hosted consumer.',
};
function declaration(value) {
  assert.deepEqual(value.candidate, candidate);
  assert.equal(value.runtimeRevision, source);
  assert.equal(value.status, 'reviewed-correctness-only');
  assert.deepEqual(value.releaseTrigger, prior.releaseTrigger);
  assert.equal(value.packageBinding.producerRun, candidate.run);
  assert.equal(value.packageBinding.producerConclusion, 'success');
  assert.equal(value.packageBinding.metadataArtifact, 12135546832);
  assert.deepEqual(value.packageBinding.metadataOuter, {
    bytes: 37136,
    sha256: '03459bff1a036a679e65f93448fbfb7ada5132a9d05ae61ed472a9a4be46dd97',
  });
  assert.equal(value.packageBinding.manifestBytes, 529292);
  assert.equal(value.packageBinding.requiredFocusedFiles, 118);
  assert.equal(value.packageBinding.requiredPassedTests, 1756);
  assert.deepEqual(value.packageBinding.focusedTAP, {
    bytes: 404942,
    sha256: 'fec098970c247b366a760cbd6b40ec93f6826205043375f06ebdfff651e25b27',
    tests: 1756,
    passed: 1756,
    failed: 0,
    skipped: 0,
  });
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
test('source9d5139b binds exact verified preview identities and rejects mixed or promoted authority', () => {
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
  assert(text.includes('solo-linux-9d5139b-correctness'));
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
  assert(args.includes('scripts/test-solo-9d5139b-correctness.mjs'));
  const firstFile = args.findIndex((arg) => arg.endsWith('.mjs'));
  assert(firstFile > 1);
  assert(!args.slice(firstFile).some((arg) => arg.startsWith('--test')));
}
test('manual trusted-main job selects only9d5139b with exact command ordering and unchanged retention', () => {
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
      'node --test scripts/test-solo-9d5139b-correctness.mjs',
      'node scripts/test-solo-9d5139b-correctness.mjs --test',
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
    'scripts/test-solo-9d5139b-correctness.mjs',
    plan.historicalSourceCorrectnessReview.proof.path,
    ...plan.historicalInputs.map((ref) => ref.path),
    ...plan.priorQualificationReview.evidence.map((ref) => ref.path),
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
        '/never-published-source9d5139b-evidence',
      ),
    /Changed baseline helper/,
  );
});
test('exact797 correctness remains historical with numerical and portability failures retained', async () => {
  const history = plan.historicalSourceCorrectnessReview;
  await current(history.proof);
  const record = JSON.parse(await read(history.proof.path));
  assert.equal(record.format, 'SoloFirstEightReviewedOutcomeV1');
  assert.equal(record.proof.runId, 39109911286);
  assert.equal(record.proof.sourceRevision, prior.runtimeRevision);
  assert.notEqual(record.proof.sourceRevision, plan.runtimeRevision);
  assert.equal(record.proof.correctness, 'passed');
  assert.equal(record.proof.ownersClosed, true);
  assert.equal(record.rawNumericalFailuresRetained, 3);
  assert.equal(record.nodePortabilityMismatchesRetained, 4);
  assert.equal(history.qualificationForCandidate, false);
  for (const ref of [...plan.historicalInputs, ...plan.priorQualificationReview.evidence])
    await current(ref);
});
