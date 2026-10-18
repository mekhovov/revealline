import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root));
const json = async (p) => JSON.parse(await read(p));
const planPath = 'docs/performance/solo-remote-de332-correctness-plan.json';
const workflowPath = '.github/workflows/solo-native-package-consumer.yml';
const plan = await json(planPath);
const prior = await json('docs/performance/solo-remote-39774-correctness-plan.json');
const workflow = (await read(workflowPath)).toString();
const job = workflow.split('  correctness:\n')[1].split('  declare:\n')[0];
const source = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
const before = 'c82d0825999f014c7a5c17386542f3219f4f04e5';
const guard = `github.repository == 'mekhovov/revealline' && ((github.event_name == 'pull_request' && github.event.pull_request.number == 1578 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${before}') || (github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == 'first-eight'))`;
const candidate = {
  revision: source,
  tree: '2954fef5b0f1293ff2e6a97ce978a673dddaa7db',
  run: 39091745654,
  artifact: 12123463810,
  outer: {
    bytes: 1094606342,
    sha256: '47a1b17e91edd11434e2b9ad08883f43b0b3374c33569aebe24a4731cc8cba27',
  },
  inner: {
    bytes: 1075789325,
    sha256: 'd4e051135af877e6bb473b71713be4cc8a0b1bca877f892fa04675059fbe94aa',
  },
  manifestSHA256: '74525fe396c239be2950585cb28d32455706b27628e02e8cc194f770f885f10d',
  producer:
    'Exact successful Appearance39091745654, Node22.13.1; full remote package/source/CSP verification remains mandatory.',
};
function admission(p) {
  assert.deepEqual(p.candidate, candidate);
  assert.equal(p.runtimeRevision, source);
  assert.equal(p.status, 'reviewed-correctness-only');
  assert.equal(p.releaseTrigger.pullRequest, 1578);
  assert.equal(p.releaseTrigger.onceOnlyBefore, before);
  assert.equal(p.releaseTrigger.action, 'synchronize');
  assert.equal(p.releaseTrigger.sameRepositoryRequired, true);
  assert.equal(p.releaseTrigger.workflow, workflowPath);
  assert.equal(p.releaseTrigger.manualLane, 'first-eight');
  assert.equal(p.releaseTrigger.manualRef, 'refs/heads/main');
  assert.equal(p.releaseTrigger.automaticRetries, 0);
  assert.equal(p.packageBinding.producerRun, candidate.run);
  assert.equal(p.packageBinding.producerConclusion, 'success');
  assert.equal(p.packageBinding.metadataArtifact, 12124315665);
  assert.deepEqual(p.packageBinding.metadataOuter, {
    bytes: 37136,
    sha256: '8e66bb40c909596a559f8e7e450f2663cd655aa62dc6f499ef0d0ec689776844',
  });
  assert.equal(p.currentSourceCorrectness.status, 'not-yet-observed');
  assert.equal(p.currentSourceCorrectness.receipt, null);
  assert.deepEqual(
    p.priorQualificationReview.runs.map((x) => [x.run, x.commands]),
    [
      [39073210270, 14],
      [39073210040, 26],
      [39073210265, 4],
    ],
  );
}
test('exact de332 package binds independently from merged-main and historical packages', () => {
  admission(plan);
  for (const mutate of [
    ...['revision', 'tree', 'run', 'artifact', 'outer', 'inner', 'manifestSHA256'].map(
      (k) => (p) => {
        p.candidate[k] = prior.candidate[k];
      },
    ),
    (p) => {
      p.candidate.revision = '56e29fd264f77df191b75b3425cc6e7bb0ce9e13';
    },
    (p) => {
      p.packageBinding.metadataArtifact++;
    },
    (p) => {
      p.packageBinding.metadataOuter.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.releaseTrigger.onceOnlyBefore = source;
    },
    (p) => {
      p.currentSourceCorrectness.status = 'passed';
    },
    (p) => {
      p.priorQualificationReview.runs[0].commands--;
    },
  ]) {
    const p = structuredClone(plan);
    mutate(p);
    assert.throws(() => admission(p));
  }
});

test('all eight original scenarios, normal8b reuse, limits and numerical exclusions remain exact', () => {
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
  ])
    assert.deepEqual(plan[key], prior[key], key);
  const a = structuredClone(plan.resources),
    b = structuredClone(prior.resources);
  delete a.setupBounds;
  delete b.setupBounds;
  assert.deepEqual(a, b);
  assert.equal(plan.rows.length, 8);
  for (const key of ['hitchJournal', 'profile', 'cpu', 'readinessProbe'])
    assert.equal(plan[key], undefined);
});

function workflowAdmission(text) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert(text.includes(`78m node scripts/run-solo-remote-correctness.mjs ${planPath}`));
  assert(text.includes('timeout-minutes: 145'));
  assert(text.includes('timeout-minutes: 79'));
  assert(text.includes('playwright@1.62.1'));
  assert(text.includes('install --with-deps chromium webkit'));
  assert(
    text.includes(
      'bash tools/scripts/solo-shared-source-checkout.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 ' +
        source +
        ' ' +
        candidate.tree,
    ),
  );
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
}
test('PR1578 is admitted on only the reviewed before edge; manual inputs cannot select source or package', () => {
  workflowAdmission(job);
  const evaluate = new Function('github', 'inputs', `return (${job.match(/^    if: (.+)$/m)[1]})`);
  const event = {
    repository: 'mekhovov/revealline',
    event_name: 'pull_request',
    event: {
      action: 'synchronize',
      before,
      pull_request: { number: 1578, head: { repo: { full_name: 'mekhovov/revealline' } } },
    },
  };
  assert.equal(evaluate(event, {}), true);
  for (const mutate of [
    (g) => {
      g.repository = 'fork/revealline';
    },
    (g) => {
      g.event.pull_request.number = 1544;
    },
    (g) => {
      g.event.pull_request.head.repo.full_name = 'fork/revealline';
    },
    (g) => {
      g.event.action = 'opened';
    },
    (g) => {
      g.event.before = source;
    },
    (g) => {
      g.event_name = 'push';
    },
  ]) {
    const g = structuredClone(event);
    mutate(g);
    assert.equal(evaluate(g, {}), false);
  }
  const manual = {
    repository: 'mekhovov/revealline',
    event_name: 'workflow_dispatch',
    ref: 'refs/heads/main',
  };
  assert.equal(evaluate(manual, { lane: 'first-eight' }), true);
  for (const lane of ['next', 'cocoa', 'arbitrary', '', undefined])
    assert.equal(evaluate(manual, { lane }), false);
  assert.equal(
    evaluate({ ...manual, ref: 'refs/heads/arbitrary' }, { lane: 'first-eight' }),
    false,
  );
  assert.match(workflow, /options: \[first-eight, next, cocoa\]/);
  const inputBlock = workflow.split('  workflow_dispatch:\n')[1].split('\npermissions:')[0];
  assert.deepEqual(
    [...inputBlock.matchAll(/^      ([a-z_-]+):$/gm)].map((x) => x[1]),
    ['lane'],
  );
  for (const fragment of [
    "github.repository == 'mekhovov/revealline' && ",
    "github.event_name == 'pull_request' && ",
    'github.event.pull_request.number == 1578 && ',
    'github.event.pull_request.head.repo.full_name == github.repository && ',
    "github.event.action == 'synchronize' && ",
    ` && github.event.before == '${before}'`,
    "github.ref == 'refs/heads/main' && ",
  ])
    assert.throws(() => workflowAdmission(job.replace(fragment, '')));
  assert.throws(() =>
    workflowAdmission(job.replace('timeout-minutes: 145', 'timeout-minutes: 146')),
  );
});

async function current(ref) {
  const b = await read(ref.path);
  assert.equal(b.length, ref.bytes, ref.path);
  assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256, ref.path);
}
test('current executable inputs and complete-control sparse reads are frozen without historical substitution', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.equal(plan.adapterInputs.length, 1);
  assert.equal(plan.adapterInputs[0].path, 'scripts/solo-remote-baseline.mjs');
  assert(refs.some((r) => r.path === 'scripts/run-solo-remote-correctness.mjs'));
  assert(refs.some((r) => r.path === 'scripts/solo-shared-source-checkout.sh'));
  assert.equal(refs.length, new Set(refs.map((r) => r.path)).size);
  for (const ref of refs) await current(ref);
  const stale = refs.find((r) => r.path === 'scripts/run-solo-remote-correctness.mjs');
  await assert.rejects(() => current({ ...stale, sha256: '0'.repeat(64) }));
  await assert.rejects(() => current({ ...stale, bytes: stale.bytes + 1 }));
  const sparse = [...job.matchAll(/^            \/(.+)$/gm)].map((x) => x[1]);
  for (const p of [
    workflowPath,
    planPath,
    'scripts/test-solo-de332-correctness.mjs',
    ...refs.map((r) => r.path),
  ])
    assert(sparse.includes(p), p);
  assert.equal(sparse.length, new Set(sparse).size);
  assert.equal(plan.toolingClosure.status, 'current-source-confined-controls-required');
});

test('executed397 declarations and recipes retain their exact historical bytes', async () => {
  for (const ref of plan.historicalInputs) await current(ref);
});
