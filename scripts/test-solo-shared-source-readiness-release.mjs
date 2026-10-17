import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindReadinessJob, readinessArguments, readinessMatrix } from './solo-remote-readiness.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const path = 'docs/performance/solo-readiness-diagnosed-239-v2-plan.json';
const workflowPath = '.github/workflows/solo-remote-readiness-diagnosed-239-v2-temporary.yml';
const prior = JSON.parse(await read('docs/performance/solo-readiness-diagnosed-239-plan.json'));
const plan = JSON.parse(await read(path));
const workflow = (await read(workflowPath)).toString();
const conditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == '92ff7ef800e542617b4fc3efad96bd07ce6cbecb'",
];
function guard(text) {
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], conditions.join(' && '));
}
test('shared-source successor preserves actual239 package and all two-row native actions and limits', () => {
  const candidate = structuredClone(plan);
  for (const field of [
    'cohort',
    'frozenTools',
    'adapterInputs',
    'priorCheckoutResult',
    'sourceCheckout',
  ])
    delete candidate[field];
  delete candidate.release.setupCorrection;
  candidate.release.onceOnlyBefore = prior.release.onceOnlyBefore;
  const original = structuredClone(prior);
  for (const field of ['cohort', 'frozenTools', 'adapterInputs']) delete original[field];
  assert.deepEqual(candidate, original);
  const next = bindReadinessJob(plan, 'webkit');
  const previous = bindReadinessJob(prior, 'webkit');
  assert.deepEqual(next.rows, previous.rows);
  for (const row of next.rows)
    assert.deepEqual(
      readinessArguments(
        { plan: next, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://localhost/game/',
        '/evidence',
      ),
      readinessArguments(
        { plan: previous, here: '/tools/scripts', repository: '/tools' },
        row,
        'http://localhost/game/',
        '/evidence',
      ),
    );
  assert.deepEqual(readinessMatrix(plan), readinessMatrix(prior));
  assert.equal(plan.release.setupCorrection.priorNativeObservations, 0);
  assert.equal(plan.release.setupCorrection.priorRowsNotRun, 2);
  assert.equal(plan.release.setupCorrection.priorRun, 39054543070);
  for (const mutate of [
    (p) => delete p.release.setupCorrection,
    (p) => p.release.setupCorrection.priorRun++,
    (p) => p.release.setupCorrection.priorNativeObservations++,
    (p) => (p.release.setupCorrection.originalDeclaration.sha256 = '0'.repeat(64)),
    (p) => p.release.setupCorrection.originalWorkflow.bytes++,
    (p) => p.release.setupCorrection.candidateCheckoutTimeoutMs++,
    (p) => (p.release.setupCorrection.runtimeChanged = true),
    (p) => (p.release.onceOnlyBefore = prior.release.onceOnlyBefore),
    (p) => (p.sourceCheckout.filters = true),
    (p) => p.sourceCheckout.automaticFetchRetries++,
    (p) => (p.candidate.artifact = null),
  ]) {
    const value = structuredClone(plan);
    mutate(value);
    assert.throws(() => bindReadinessJob(value, 'webkit'));
  }
});
test('actual current frozen refs and every complete sparse control are present without historical substitution', async () => {
  const sparse = [...workflow.matchAll(/^            \/([^\n]+)$/gm)].map((m) => m[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const ref of [
    ...plan.adapterInputs,
    ...plan.frozenTools,
    plan.fixture,
    ...plan.additionalFixtures,
  ]) {
    const bytes = await read(ref.path);
    assert.deepEqual(
      { bytes: bytes.length, sha256: sha(bytes) },
      { bytes: ref.bytes, sha256: ref.sha256 },
      ref.path,
    );
    assert(sparse.includes(ref.path), ref.path);
  }
  for (const file of workflow.match(/node --test --test-concurrency=2 ([^\n]+) 2>&1/)[1].split(' '))
    assert(sparse.includes(file), file);
  for (const file of [
    path,
    workflowPath,
    'scripts/solo-shared-source-checkout.sh',
    'scripts/test-solo-shared-source-checkout.mjs',
    'docs/performance/solo-readiness-diagnosed-239-plan.json',
    '.github/workflows/solo-remote-readiness-diagnosed-239-temporary.yml',
    'docs/performance/fixtures/solo-readiness-diagnosed/92ff-execution-source.json',
  ])
    assert(sparse.includes(file), file);
});
test('exact one-shot edge and the original three-minute source/native envelopes remain strict', () => {
  guard(workflow);
  for (const condition of conditions)
    assert.throws(() => guard(workflow.replace(condition, 'true')));
  const step = workflow.match(
    /      - name: Materialize exact candidate from shared job Git objects\n([\s\S]*?)(?=      - )/,
  )[1];
  assert.match(step, /timeout-minutes: 3/);
  assert.match(step, /GITHUB_TOKEN: \$\{\{ github.token \}\}/);
  assert(step.includes('bash tools/scripts/solo-shared-source-checkout.sh'));
  for (const identity of [
    plan.baseline.revision,
    plan.baseline.tree,
    plan.candidate.revision,
    plan.candidate.tree,
  ])
    assert(step.includes(identity));
  assert(!workflow.includes('path: candidate'));
  assert(workflow.includes('path: baseline'));
  assert(workflow.includes('persist-credentials: false'));
  assert(workflow.includes('timeout-minutes: 130'));
  assert(workflow.includes('timeout-minutes: 78'));
  assert(workflow.includes('4620s node scripts/run-solo-remote-correctness.mjs'));
  assert(workflow.includes('playwright" install --with-deps chromium webkit'));
  assert(workflow.includes('engine: [webkit]'));
  assert(workflow.includes('assert size <= 4096'));
  assert(workflow.includes('<= 24*1024*1024'));
});
