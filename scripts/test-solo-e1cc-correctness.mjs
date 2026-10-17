import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateBaselineReuse } from './solo-remote-baseline.mjs';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await read(path));
const path = 'docs/performance/solo-remote-e1cc-correctness-plan.json';
const workflowPath = '.github/workflows/solo-remote-final-correctness-temporary.yml';
const plan = await json(path);
const prior = await json('docs/performance/solo-remote-c696-correctness-plan.json');
const original = await json('docs/performance/solo-remote-correctness-plan.json');
const source = 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17';
const conditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17'",
];
const guard = conditions.join(' && ');
const candidate = {
  revision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
  tree: '58f19392e25384620d896098fce8616b538e318d',
  run: 39037874955,
  artifact: 12104590541,
  outer: {
    bytes: 1091965213,
    sha256: 'fb85094a61cdc329ccf8a1488b6e3ca1043ef5f249a6b33729bb04141336af1e',
  },
  inner: {
    bytes: 1073790972,
    sha256: '6c8bbb6aafe3f9d55e2fb445d5846a5e9d02ebd648c4e630889743bf76ec421e',
  },
  manifestSHA256: '23f555db20036838cc1601f2cebf8f1a75eb62fb0c6cf36f1e1988035b3e1b64',
  producer:
    'Exact successful Appearance package, Node22.13.1 Linux; original focused-policy metadata retained. Full outer/member/source/CSP verification required remotely before any native row.',
};
const binding = {
  format: 'SoloCurrentPackageMetadataBinding.v1',
  producerRun: 39037874955,
  producerConclusion: 'success',
  metadataArtifact: 12104261890,
  metadataOuter: {
    bytes: 17342,
    sha256: '623ddb15fd55d7b15fb705bfa9666ed5cb35753d4b9605ff182cc03389cd3b16',
  },
  packageBinding: {
    bytes: 7931,
    sha256: 'f548ebdc12740dfb59d2fdb6ba49fdf3cf0aa8095eda469239852a540c54cbab',
  },
  independentReadback: {
    bytes: 1198,
    sha256: 'cf7476fe6d4c8e7a61d669cad552d71386cd9b92174df20d951862b8d42f7656',
    source: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
    status: 'passed-small-metadata-only',
  },
  scope:
    'Actual successful exact-source producer metadata. Full candidate outer/inner/source/static-worker/offline closure and served CSP verification remain mandatory before every native row.',
};
function bound(value) {
  assert.equal(value.format, 'SoloHostedCorrectnessPlan.v1');
  assert.equal(value.status, 'reviewed-correctness-only');
  assert.deepEqual(value.candidate, candidate);
  assert.deepEqual(value.packageBinding, binding);
  assert.equal(value.runtimeRevision, source);
  assert.equal(value.currentSourceCorrectness.status, 'pending-not-run');
  assert.equal(value.currentSourceCorrectness.receipt, null);
  assert.equal(value.releaseTrigger.onceOnlyBefore, source);
  assert.equal(value.releaseTrigger.status, 'reviewed-once-only-synchronize');
  assert.equal(
    value.priorQualificationReview.status,
    'prior-scoped-linux-owners-closed-failures-retained',
  );
  assert.equal(value.performanceExclusion, true);
  assert.deepEqual(value.baseline, prior.baseline);
  validateBaselineReuse(value.baseline.reusableArtifact, value);
}
test('reviewed e1cc first eight binds exact verified 118 package without prior-source promotion', () => {
  bound(plan);
  for (const change of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.run++,
    (p) => (p.candidate.revision = prior.candidate.revision),
    (p) => (p.candidate.tree = prior.candidate.tree),
    (p) => (p.candidate.outer = prior.candidate.outer),
    (p) => (p.candidate.inner = prior.candidate.inner),
    (p) => (p.candidate.manifestSHA256 = prior.candidate.manifestSHA256),
    (p) => (p.packageBinding.producerConclusion = 'failure'),
    (p) => (p.packageBinding.independentReadback.sha256 = '0'.repeat(64)),
    (p) => (p.runtimeRevision = prior.runtimeRevision),
    (p) => (p.currentSourceCorrectness.status = 'passed'),
    (p) => (p.releaseTrigger.onceOnlyBefore = prior.candidate.revision),
    (p) => (p.priorQualificationReview.status = 'closed'),
    (p) => (p.performanceExclusion = false),
    (p) => p.baseline.reusableArtifact.artifact++,
  ]) {
    const value = structuredClone(plan);
    change(value);
    assert.throws(() => bound(value));
  }
});
function protocol(value) {
  for (const key of ['rows', 'fixture', 'helperTimeoutMs', 'evidenceBytes'])
    assert.deepEqual(value[key], original[key], key);
  for (const key of ['resources', 'acceptance']) assert.deepEqual(value[key], prior[key], key);
  for (const key of ['hitchJournal', 'probe', 'readinessProbe', 'profile', 'cpu'])
    assert.equal(value[key], undefined, key);
}
test('all eight scenarios, recipe, strict replay, ownership and finite bounds remain exact', () => {
  protocol(plan);
  assert.equal(plan.rows.length, 8);
  for (let row = 0; row < 8; row++)
    for (const key of ['id', 'kind', 'engine', 'source', 'timeoutMs', 'performanceExclusion']) {
      const value = structuredClone(plan);
      value.rows[row][key] = null;
      assert.throws(() => protocol(value));
    }
  for (const key of ['helperTimeoutMs', 'evidenceBytes']) {
    const value = structuredClone(plan);
    value[key]++;
    assert.throws(() => protocol(value));
  }
  const wrong = structuredClone(plan);
  wrong.readinessProbe = true;
  assert.throws(() => protocol(wrong));
});
function released(value, text) {
  assert.equal(value.adapterInputs.length, 1);
  assert.equal(value.adapterInputs[0].path, 'scripts/solo-remote-baseline.mjs');
  assert.equal(value.frozenTools.length, 39);
  assert.equal(
    value.toolingClosure.status,
    'current-files-refrozen-source-confined-controls-passed',
  );
  assert.equal(value.toolingClosure.controls.passed, 52);
  assert.equal(value.toolingClosure.controls.explicitPlatformSkips, 4);
  assert.equal(value.toolingClosure.controls.failed, 0);
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
}
test('reviewed release requires exactly the source-bound four-condition edge and current tooling', async () => {
  const text = (await read(workflowPath)).toString();
  released(plan, text);
  const wrong = structuredClone(plan);
  wrong.frozenTools = null;
  assert.throws(() => released(wrong, text));
  for (let omitted = 0; omitted < conditions.length; omitted++) {
    const altered = text.replace(guard, conditions.filter((_, i) => i !== omitted).join(' && '));
    assert.throws(() => released(plan, altered));
  }
  for (const other of ['true', 'false', guard.replace(source, prior.candidate.revision)])
    assert.throws(() => released(plan, text.replace(guard, other)));
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
});
test('reviewed reusable workflow preserves source, scheduling, test and failure-retention structure', async () => {
  const text = (await read(workflowPath)).toString();
  assert.match(text, /timeout-minutes: 145/);
  assert.match(text, /cancel-in-progress: false/);
  assert.match(
    text,
    /timeout --signal=TERM --kill-after=30s 78m node scripts\/run-solo-remote-correctness.mjs docs\/performance\/solo-remote-e1cc-correctness-plan.json/,
  );
  const checkouts = text
    .split(/\n      - /)
    .filter((step) => step.includes('uses: actions/checkout@'));
  assert.equal(checkouts.length, 3);
  for (const step of checkouts) {
    assert.match(step, /timeout-minutes: 3/);
    assert.match(step, /fetch-depth: 1/);
    if (step.includes('path: tools')) {
      assert.match(step, /sparse-checkout-cone-mode: false/);
      assert(!step.includes('filter:'));
      for (const file of [
        path,
        'scripts/test-solo-e1cc-correctness.mjs',
        'scripts/test-solo-c696-correctness.mjs',
        'scripts/test-solo-source-verifier-smoke.mjs',
        'scripts/solo-source-verifier-smoke.mjs',
        'game/build-config.json',
        'docs/performance/fixtures/solo-remote-correctness/0feb-c696-source.json',
        'docs/performance/fixtures/solo-remote-correctness/0feb-c696-workflow.yml',
      ])
        assert(step.includes('/' + file + '\n'), file);
    } else {
      assert(!step.includes('sparse-checkout'));
      assert(
        step.includes(
          'ref: ' + (step.includes('path: baseline') ? plan.baseline.revision : source),
        ),
      );
    }
  }
  assert(
    text.includes(
      'node --test scripts/test-solo-e1cc-correctness.mjs scripts/test-solo-c696-correctness.mjs',
    ),
  );
  assert(text.includes('scripts/test-solo-source-verifier-smoke.mjs '));
  assert.equal((text.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(!text.includes('--hitch-journal') && !text.includes('--readiness-probe'));
});
test('prior c696 correctness stays separately source-bound and numerically excluded', () => {
  const predecessor = plan.currentSourceCorrectness.historicalPredecessor;
  assert.equal(predecessor.run, 39032516813);
  assert.equal(predecessor.candidate, prior.candidate.revision);
  assert.equal(predecessor.passedRows, 8);
  assert.equal(predecessor.failedRows, 0);
  assert.equal(predecessor.analysis.bytes, 37548);
  assert.equal(
    predecessor.analysis.sha256,
    '26fa24feb96a3f7f50ff247251ed6c5f5f9842c6c3d9262b803c4594d2d752fe',
  );
  assert.equal(plan.currentSourceCorrectness.earlierHistory.historicalPredecessor.failedRows, 1);
});

async function currentRef(ref) {
  const bytes = await read(ref.path);
  assert.equal(bytes.length, ref.bytes, ref.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
}
test('every prospective runtime input uses current bytes and audited source-verifier roots', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.equal(refs.length, 41);
  assert.equal(new Set(refs.map((ref) => ref.path)).size, refs.length);
  for (const ref of refs) {
    await currentRef(ref);
    await assert.rejects(() => currentRef({ ...ref, sha256: '0'.repeat(64) }));
  }
  for (const name of [
    'soundtrack-distribution',
    'optional-distribution',
    'external-distribution',
    'optional-artwork',
  ])
    assert(refs.some((ref) => ref.path === 'scripts/' + name + '.mjs'));
});

test('fresh scoped prior-owner evidence retains both failed cohorts and grants no unrelated clearance', () => {
  assert.equal(plan.priorQualificationReview.commandCount, 36);
  assert.deepEqual(plan.priorQualificationReview.runs, [39037875135, 39037875095]);
  assert.deepEqual(plan.priorQualificationReview.analysis, {
    path: '.cache/solo-followup/e1cc-package-next/prior-linux-owner-readback.json',
    bytes: 17356,
    sha256: 'a9c8afc47cc982ed74a87af50a7c4bab60dd5fd8dbc6c494ce39d48dc01383a1',
  });
  assert.match(plan.priorQualificationReview.scope, /All failed results remain/);
  assert.match(
    plan.priorQualificationReview.scope,
    /no Darwin, unrelated CI, future-wave or native-success assertion/,
  );
});
