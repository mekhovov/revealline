import { readHistoricalQualificationRefs } from './solo-page-error-source-witness.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await read(path));
const planPath = 'docs/performance/solo-remote-39774-correctness-plan.json';
const workflowPath = '.github/workflows/solo-remote-39774-correctness-temporary.yml';
const testPath = 'scripts/test-solo-39774-correctness.mjs';
const oldWorkflowPath = '.github/workflows/solo-remote-final-correctness-temporary.yml';
const plan = await json(planPath);
const prior = await json('docs/performance/solo-remote-e1cc-correctness-plan.json');
const original = await json('docs/performance/solo-remote-correctness-plan.json');
const source = '39774cce8697d412d138ef4da11ac547a5f8e535';
const tree = 'cac2369a26cac5282e4260c638b934540d17ced6';
// This exact source already executed. The additive Git witness is historical only;
// future declarations must still admit their own current helper bytes.
const executed816Bytes = await readFile(
  new URL(
    'docs/performance/fixtures/solo-native-816/executed-source.json',
    process.env.SOLO_EXECUTED_816_PROPOSAL || new URL('../', import.meta.url),
  ),
);
function executed816Bindings(bytes, bindings) {
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '017ca49b181d9e2aece4fc059dfac32b21ecea47f2759f262255efd93d1ff45f',
  );
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'Solo816ExecutedSourceWitnessV1');
  assert.equal(value.revision, '8161953a10b9c37e603d78f236e277da380e57ad');
  assert.equal(value.tree, '3cc69ce4de5367590e9bd11e4eeed38ddd510d9a');
  assert.equal(value.postHocExactGitReadback, true);
  assert.deepEqual(
    value.runs.map((r) => r.run),
    [39073210040, 39073210270, 39073210265, 39073210308],
  );
  assert.equal(value.records.length, 73);
  assert.equal(new Set(value.records.map((r) => r.path)).size, value.records.length);
  for (const ref of value.records) assert.match(ref.blob, /^[a-f0-9]{40}$/);
  for (const [path, input] of bindings) {
    const ref = value.records.find((r) => r.path === path);
    assert(ref, path);
    assert.equal(input.length, ref.bytes, path);
    assert.equal(createHash('sha256').update(input).digest('hex'), ref.sha256, path);
  }
  return value;
}
function executed816Ref(execution, ref) {
  const entry = execution.records.find((r) => r.path === ref.path);
  assert(entry, ref.path);
  assert.equal(entry.bytes, ref.bytes, ref.path);
  assert.equal(entry.sha256, ref.sha256, ref.path);
}

const executed816 = executed816Bindings(executed816Bytes, [
  [planPath, await read(planPath)],
  [workflowPath, await read(workflowPath)],
]);
test('executed816 rejects changed witness bytes and original declaration or workflow bytes', () => {
  assert.throws(() => executed816Bindings(Buffer.from('{}'), []));
  const ref = executed816.records.find((r) => r.path === planPath);
  assert.throws(() => executed816Bindings(executed816Bytes, [[ref.path, Buffer.from('{}')]]));
  const workflowRef = executed816.records.find((r) => r.path === workflowPath);
  assert.throws(() =>
    executed816Bindings(executed816Bytes, [[workflowRef.path, Buffer.from('{}')]]),
  );
  assert.throws(() => executed816Ref(executed816, { ...ref, sha256: '0'.repeat(64) }));
  assert.throws(() => executed816Ref(executed816, { ...ref, bytes: ref.bytes + 1 }));
});
const before = '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0';
const expectedNonDispatch = {
  revision: '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0',
  observedAt: '2026-10-17T21:40:58.671026+00:00',
  runCount: 0,
  mergeable: 'CONFLICTING',
  receipt: {
    path: '.cache/solo-followup/integration-397-batch/no-dispatch-5e9/receipt.json',
    bytes: 621,
    sha256: '07ca45eba16843a6b3e37080d28fbb4d21ddcee2f30671120a2d1942fc902595',
  },
  scope:
    'No workflow or native attempt existed at this observation. Re-admit only this previously unexecuted declaration after resolving the merge conflict; exact397 package and all prior failures remain unchanged.',
};
const tests = [
  testPath,
  'scripts/test-solo-remote-correctness.mjs',
  'scripts/test-solo-build-worker-closure.mjs',
  'scripts/test-solo-remote-baseline.mjs',
  'scripts/test-solo-source-verifier-smoke.mjs',
];

const expectedCandidate = {
  revision: '39774cce8697d412d138ef4da11ac547a5f8e535',
  tree: 'cac2369a26cac5282e4260c638b934540d17ced6',
  run: 39066188021,
  artifact: 12114802738,
  outer: {
    bytes: 1092535270,
    sha256: '6da8f8e085c18168f17c8a0e6348890b1f5ade90a4404463d1ba6dfd69b31fcb',
  },
  inner: {
    bytes: 1074103399,
    sha256: '4a93ff4a892ea17d89e7fd42e5da7d079e0db3a03159ebaf2d74971995ebd6bd',
  },
  manifestSHA256: '7ff350dfb99ef499d3af61b43178c0149d699e2d51cc1c76f9142318a5b3e190',
  producer:
    'Exact successful Appearance package, Node22.13.1 Linux; original focused-policy metadata retained. Full outer/member/source/CSP verification required remotely before any native row.',
};
const expectedPackageBinding = {
  format: 'SoloCurrentPackageMetadataBinding.v1',
  producerRun: 39066188021,
  producerConclusion: 'success',
  metadataArtifact: 12115226405,
  metadataOuter: {
    bytes: 23548,
    sha256: '010f687eef3882432f293e24102963e938b4a7f99669f8c4b805a80082e14236',
  },
  packageBinding: {
    path: '.cache/solo-followup/397-package/appearance-retained/members/package-binding.json',
    bytes: 11034,
    sha256: '47e7905e6157fb432c1ab7659022e2fd340d95153876fa4d3a93e3b347123266',
  },
  independentReadback: {
    path: '.cache/solo-followup/397-package/appearance-analysis.json',
    bytes: 14638,
    sha256: '56820945ef7af4aeed69bff886c48c202f533ca27f50236105bc3633633291a6',
  },
  scope:
    'Actual successful exact397 producer metadata only. Full candidate outer/inner/source/static-worker/offline closure and served CSP verification remain mandatory. Does not qualify later Restart, Demo or Team changes.',
  rootIndependentReadback: {
    path: '.cache/solo-followup/397-package/root-independent-readback.json',
    bytes: 1528,
    sha256: '3843afceb38c9476f2c8fe26550ed4b5df90efb0955b4adf0efb6432b23520cc',
  },
};
const expectedOwners = {
  status: 'prior-scoped-linux-owners-closed-failures-retained',
  observedAt: '2026-10-17T21:16:28.472634+00:00',
  analysis: {
    path: '.cache/solo-followup/final397-next-proposal/prior-owners/combined-readback.json',
    bytes: 1173,
    sha256: 'a469e0ae19e4234faba4e72de7043dc9aef68ab46d123f103b162a526486024a',
  },
  commandCount: 78,
  runs: [
    39044567236, 39054542080, 39049194995, 39057302464, 39057302158, 39059454404, 39066188215,
    39044567174,
  ],
  scope:
    'Only eight explicitly identified historical Linux cohorts; no global clearance, unknown-process ownership, Darwin or future-host assertion. Fresh native owner gates remain mandatory. Original failures/numerical exits remain unchanged.',
  newRows:
    'Each future row retains independent fresh owner checks; same-wave siblings may execute concurrently.',
};
const expectedGuard =
  "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0'";
function binding(value) {
  assert.equal(value.format, 'SoloHostedCorrectnessPlan.v1');
  assert.equal(value.status, 'reviewed-correctness-only');
  assert.deepEqual(value.candidate, expectedCandidate);
  assert.equal(value.runtimeRevision, source);
  assert.deepEqual(value.packageBinding, expectedPackageBinding);
  assert.equal(value.releaseTrigger.status, 'reviewed-once-only-synchronize');
  assert.equal(value.releaseTrigger.onceOnlyBefore, before);
  assert.deepEqual(value.releaseTrigger.priorUnexecutedEdge, expectedNonDispatch);
  assert.equal(value.releaseTrigger.pullRequest, 1544);
  assert.equal(value.releaseTrigger.sameRepositoryRequired, true);
  assert.equal(value.releaseTrigger.action, 'synchronize');
  assert.equal(value.currentSourceCorrectness.status, 'pending-not-run');
  assert.equal(value.currentSourceCorrectness.receipt, null);
  assert.deepEqual(value.priorQualificationReview, expectedOwners);
  assert.equal(value.incompleteRequirements.length, 2);
}
test('exact successful397 package and scoped78 owners bind only this prospective release', () => {
  binding(plan);
  for (const change of [
    (p) => (p.candidate.revision = prior.candidate.revision),
    (p) => (p.candidate.tree = prior.candidate.tree),
    ...['run', 'artifact', 'outer', 'inner', 'manifestSHA256'].map(
      (key) => (p) => (p.candidate[key] = prior.candidate[key]),
    ),
    (p) => (p.packageBinding = prior.packageBinding),
    (p) => (p.releaseTrigger.onceOnlyBefore = prior.candidate.revision),
    (p) => (p.releaseTrigger.sameRepositoryRequired = false),
    (p) => (p.releaseTrigger.onceOnlyBefore = source),
    (p) => (p.releaseTrigger.priorUnexecutedEdge.runCount = 1),
    (p) => (p.currentSourceCorrectness.status = 'passed'),
    (p) => (p.currentSourceCorrectness.receipt = {}),
    (p) => (p.priorQualificationReview = prior.priorQualificationReview),
    (p) => (p.priorQualificationReview.commandCount = 64),
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.throws(() => binding(changed));
  }
});

function protocol(value) {
  for (const key of ['rows', 'fixture', 'helperTimeoutMs', 'evidenceBytes'])
    assert.deepEqual(value[key], original[key], key);
  for (const key of [
    'baseline',
    'resources',
    'acceptance',
    'node',
    'playwright',
    'repository',
    'performanceExclusion',
  ])
    assert.deepEqual(value[key], prior[key], key);
  assert.equal(value.rows.length, 8);
  for (const key of ['hitchJournal', 'probe', 'readinessProbe', 'profile', 'cpu'])
    assert.equal(value[key], undefined, key);
}

test('eight original scenarios, normal 8b artifact, strict replay, source/CSP, owner and resource gates stay exact', () => {
  protocol(plan);
  for (let row = 0; row < 8; row++)
    for (const key of ['id', 'kind', 'engine', 'source', 'timeoutMs', 'performanceExclusion']) {
      const changed = structuredClone(plan);
      changed.rows[row][key] = null;
      assert.throws(() => protocol(changed));
    }
  for (const change of [
    (p) => p.helperTimeoutMs++,
    (p) => p.evidenceBytes++,
    (p) => p.baseline.reusableArtifact.artifact++,
    (p) => (p.acceptance.first30 = 'numeric failure passes'),
    (p) => (p.readinessProbe = true),
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.throws(() => protocol(changed));
  }
});

function releaseWorkflow(text, oldText) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], expectedGuard);
  assert.equal((text.match(/^    if:/gm) ?? []).length, 1);
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
  assert.match(text, /cancel-in-progress: false/);
  assert.deepEqual(
    [...text.matchAll(/timeout-minutes: (\d+)/g)].map((m) => m[1]),
    [...oldText.matchAll(/timeout-minutes: (\d+)/g)].map((m) => m[1]),
  );
  assert(text.includes(`78m node scripts/run-solo-remote-correctness.mjs ${planPath}`));
  assert(text.includes(`node --test ${tests.join(' ')} 2>&1`));
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  const checkouts = text
    .split(/\n      - /)
    .filter((step) => step.includes('uses: actions/checkout@'));
  assert.equal(checkouts.length, 3);
  for (const step of checkouts) {
    assert.match(step, /timeout-minutes: 3/);
    assert.match(step, /fetch-depth: 1/);
    if (step.includes('path: tools')) {
      assert.match(step, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
      assert.match(step, /sparse-checkout-cone-mode: false/);
      const sparse = [...step.matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
      assert.equal(sparse.length, new Set(sparse).size);
      for (const path of [
        planPath,
        workflowPath,
        ...tests,
        ...plan.historicalInputs.map((r) => r.path),
        ...plan.adapterInputs.map((r) => r.path),
        ...plan.frozenTools.map((r) => r.path),
        plan.fixture.path,
      ])
        assert(sparse.includes(path), path);
    } else {
      assert(!step.includes('sparse-checkout'));
      assert(
        step.includes(
          'ref: ' + (step.includes('path: baseline') ? plan.baseline.revision : source),
        ),
      );
    }
  }
  assert(!text.includes('--hitch-journal') && !text.includes('--readiness-probe'));
}

test('actual workflow executes only the reviewed same-repository PR1544 before5e9 edge', async () => {
  const text = (await read(workflowPath)).toString();
  const oldText = (await read(oldWorkflowPath)).toString();
  releaseWorkflow(text, oldText);
  const actual = text.match(/^    if: (.+)$/m)[1];
  const allowed = {
    repository: 'mekhovov/revealline',
    event: {
      action: 'synchronize',
      before,
      pull_request: { number: 1544, head: { repo: { full_name: 'mekhovov/revealline' } } },
    },
  };
  const evaluate = new Function('github', 'return (' + actual + ')');
  assert.equal(evaluate(allowed), true);
  for (const change of [
    (g) => g.event.pull_request.number++,
    (g) => (g.event.pull_request.head.repo.full_name = 'fork/revealline'),
    (g) => (g.event.action = 'opened'),
    (g) => (g.event.before = prior.candidate.revision),
    (g) => (g.event.before = source),
  ]) {
    const changed = structuredClone(allowed);
    change(changed);
    assert.equal(evaluate(changed), false);
  }
  for (const term of expectedGuard.split(' && '))
    assert.throws(() =>
      releaseWorkflow(
        text.replace(
          expectedGuard,
          expectedGuard
            .split(' && ')
            .filter((v) => v !== term)
            .join(' && '),
        ),
        oldText,
      ),
    );
  for (const replacement of ['true', 'false'])
    assert.throws(() => releaseWorkflow(text.replace(expectedGuard, replacement), oldText));
  assert.throws(() =>
    releaseWorkflow(text.replace('timeout-minutes: 145', 'timeout-minutes: 146'), oldText),
  );
  assert.throws(() => releaseWorkflow(text.replace(`/${testPath}\n`, '/omitted-test\n'), oldText));
});

async function currentRef(ref) {
  const bytes = await read(ref.path);
  assert.equal(bytes.length, ref.bytes, ref.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
}

test('executed816 runtime references bind to exact historical Git source', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.equal(plan.adapterInputs.length, 1);
  assert.equal(plan.adapterInputs[0].path, 'scripts/solo-remote-baseline.mjs');
  assert.equal(refs.length, new Set(refs.map((r) => r.path)).size);
  assert.equal(
    plan.toolingClosure.runtimeScriptReferences,
    plan.adapterInputs.length + plan.frozenTools.length,
  );
  for (const ref of refs) {
    executed816Ref(executed816, ref);
    assert.throws(() => executed816Ref(executed816, { ...ref, sha256: '0'.repeat(64) }));
  }
  for (const name of [
    'soundtrack-distribution',
    'optional-distribution',
    'external-distribution',
    'optional-artwork',
  ])
    assert(refs.some((ref) => ref.path === `scripts/${name}.mjs`));
});

test('executed e1cc inputs and all historical failures remain separate, immutable evidence', async () => {
  assert.equal(plan.historicalInputs.length, 4);
  const historical = await readHistoricalQualificationRefs(
    'docs/performance/solo-remote-e1cc-correctness-plan.json',
    '.github/workflows/solo-remote-final-correctness-temporary.yml',
  );
  for (const ref of plan.historicalInputs) {
    const old = historical.get(ref.path);
    assert(old, ref.path);
    assert.equal(old.bytes, ref.bytes, ref.path);
    assert.equal(old.sha256, ref.sha256, ref.path);
  }
  assert.equal(plan.currentSourceCorrectness.historicalPredecessor.run, 39044567174);
  assert.equal(
    plan.currentSourceCorrectness.historicalPredecessor.candidate,
    prior.candidate.revision,
  );
  assert.equal(plan.currentSourceCorrectness.historicalPredecessor.passedRows, 8);
  assert.deepEqual(plan.currentSourceCorrectness.earlierHistory, prior.currentSourceCorrectness);
  assert.equal(
    plan.currentSourceCorrectness.earlierHistory.earlierHistory.historicalPredecessor.failedRows,
    1,
  );
});

test('current first-eight reference checking still rejects stale bytes independently of historical witness', async () => {
  const path = 'scripts/run-solo-remote-correctness.mjs';
  const bytes = await read(path);
  const ref = {
    path,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  await currentRef(ref);
  await assert.rejects(() => currentRef({ ...ref, bytes: ref.bytes + 1 }));
  await assert.rejects(() => currentRef({ ...ref, sha256: '0'.repeat(64) }));
});
