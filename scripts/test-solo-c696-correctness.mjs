import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateBaselineReuse } from './solo-remote-baseline.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await read(path));
const source = 'c696af41857840359ae473558b90682f3d71f2db';
const path = 'docs/performance/solo-remote-c696-correctness-plan.json';
const workflowPath = '.github/workflows/solo-remote-final-correctness-temporary.yml';
const plan = await json(path);
const original = await json('docs/performance/solo-remote-correctness-plan.json');
const prior = await json('docs/performance/solo-remote-final-correctness-plan.json');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const conditions = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  "github.event.before == '" + source + "'",
];
const guard = conditions.join(' && ');
function bound(value) {
  assert.equal(value.format, 'SoloHostedCorrectnessPlan.v1');
  assert.equal(value.status, 'reviewed-correctness-only');
  assert.deepEqual(value.candidate, {
    revision: 'c696af41857840359ae473558b90682f3d71f2db',
    tree: 'b70ce1c4b15023a38628c5e958b166e44898eccf',
    run: 39028705715,
    artifact: 12100662115,
    outer: {
      bytes: 1091949183,
      sha256: '8545bc4e8a665cbaff8d39e9704dd0dc85ba72b52e1f3dc04ed1cc69ca874342',
    },
    inner: {
      bytes: 1073779419,
      sha256: 'c715e0a960300c48b341fbc1b3dbc656882f6f03b5dadf373aaf6d9473079fa5',
    },
    manifestSHA256: '9521c2f2afb62879a7ebedb09b7436f9a93babed10cb53989a4f9108239dc21d',
    producer:
      'Exact successful Appearance package, Node22.13.1 Linux; original focused-policy metadata retained. Full outer/member/source/CSP verification required remotely before any native row.',
  });
  assert.deepEqual(value.packageBinding, {
    format: 'SoloCurrentPackageMetadataBinding.v1',
    producerRun: 39028705715,
    producerConclusion: 'success',
    metadataArtifact: 12100751601,
    metadataOuter: {
      bytes: 17032,
      sha256: '6ffdb6f00a178ec35f78d4d72a7c3da666efa7bb52e309e421b37df36b9ade0b',
    },
    packageBinding: {
      bytes: 7776,
      sha256: '8a85e5bce913c33c549a53ac608e51c21d33d2fda9058c0e839f227b2fcbca65',
    },
    independentReadback: {
      bytes: 1596,
      sha256: 'faf2034e9654057ceeac44ae9fcbf3711b9358b2b7438a175ed1d2d72a034839',
      source: 'c696af41857840359ae473558b90682f3d71f2db',
      status: 'passed-small-metadata-only',
    },
    scope:
      'Actual successful exact-source producer metadata. Full candidate outer/inner/source/static-worker/offline closure and served CSP verification remain mandatory before every native row.',
  });
  assert.equal(value.runtimeRevision, '5c1253d44e2e32f3494910e10118ad3f9437ee43');
  assert.equal(value.releaseTrigger.status, 'reviewed-once-only-synchronize');
  assert.equal(value.releaseTrigger.onceOnlyBefore, source);
  assert.equal(value.currentSourceCorrectness.status, 'pending-not-run');
  assert.equal(value.currentSourceCorrectness.receipt, null);
  assert.equal(value.performanceExclusion, true);
  assert.deepEqual(value.baseline, prior.baseline);
  validateBaselineReuse(value.baseline.reusableArtifact, value);
}
test('exact-c696 first eight binds only the successful independently read-back package', () => {
  bound(plan);
  for (const change of [
    (p) => (p.candidate.artifact = prior.candidate.artifact),
    (p) => (p.candidate.inner = prior.candidate.inner),
    (p) => p.candidate.run++,
    (p) => (p.packageBinding = prior.packageBinding),
    (p) => (p.packageBinding.producerConclusion = 'failure'),
    (p) => (p.packageBinding.independentReadback.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.revision = prior.candidate.revision),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => (p.runtimeRevision = prior.runtimeRevision),
    (p) => (p.status = 'passed'),
    (p) => (p.currentSourceCorrectness.status = 'passed'),
    (p) => (p.releaseTrigger.onceOnlyBefore = prior.candidate.revision),
  ]) {
    const wrong = structuredClone(plan);
    change(wrong);
    assert.throws(() => bound(wrong));
  }
});
test('all original rows, fixed recipe, defaults, source guards and limits remain unchanged', () => {
  for (const key of ['rows', 'fixture', 'helperTimeoutMs', 'evidenceBytes'])
    assert.deepEqual(plan[key], original[key], key);
  assert.deepEqual(plan.resources, prior.resources);
  assert.deepEqual(plan.acceptance, prior.acceptance);
  assert.equal(plan.rows.length, 8);
  assert.equal(plan.currentSourceCorrectness.historicalPredecessor.run, 39012635540);
  assert.equal(plan.currentSourceCorrectness.historicalPredecessor.failedRows, 1);
  for (const key of ['hitchJournal', 'probe', 'readinessProbe', 'profile', 'cpu'])
    assert.equal(plan[key], undefined, key);
});
test('prospective tooling uses current exact hashes and audited dynamic verifier roots without historical fallback', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.equal(new Set(refs.map((ref) => ref.path)).size, refs.length);
  assert.equal(plan.adapterInputs.length, 1);
  assert.equal(plan.adapterInputs[0].path, 'scripts/solo-remote-baseline.mjs');
  assert.equal(refs.length, 41);
  for (const ref of refs) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
  }
  for (const name of [
    'soundtrack-distribution',
    'optional-distribution',
    'external-distribution',
    'optional-artwork',
  ])
    assert(
      refs.some((ref) => ref.path === 'scripts/' + name + '.mjs'),
      name,
    );
});
test('actual reusable workflow uses one exact push edge with sparse tools and full exact source checkouts', async () => {
  const text = (await read(workflowPath)).toString();
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
  assert.match(text, /timeout-minutes: 145/);
  assert.match(text, /cancel-in-progress: false/);
  assert.match(
    text,
    /timeout --signal=TERM --kill-after=30s 78m node scripts\/run-solo-remote-correctness.mjs docs\/performance\/solo-remote-c696-correctness-plan.json/,
  );
  const checks = text
    .split(/\n      - /)
    .filter((step) => step.includes('uses: actions/checkout@'));
  assert.equal(checks.length, 3);
  for (const step of checks) {
    assert.match(step, /timeout-minutes: 3/);
    assert.match(step, /fetch-depth: 1/);
    if (step.includes('path: tools')) {
      assert.match(step, /sparse-checkout-cone-mode: false/);
      assert(!step.includes('filter:'));
      for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.fixture])
        assert(
          step.split('\n').some((line) => line.trim() === '/' + ref.path),
          ref.path,
        );
      for (const file of [
        path,
        'scripts/test-solo-c696-correctness.mjs',
        'scripts/test-solo-source-verifier-smoke.mjs',
        'scripts/solo-source-verifier-smoke.mjs',
        'game/build-config.json',
        'docs/performance/fixtures/solo-final-wave/a7e-correctness-workflow.yml',
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
  assert(!text.includes('--hitch-journal') && !text.includes('--readiness-probe'));
  assert(text.includes('scripts/test-solo-source-verifier-smoke.mjs '));
});
test('future activation requires exactly all four conditions; missing or broader guards reject', () => {
  const verify = (text) => assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  verify('    if: ' + guard);
  for (let omitted = 0; omitted < conditions.length; omitted++)
    assert.throws(() =>
      verify('    if: ' + conditions.filter((_, index) => index !== omitted).join(' && ')),
    );
  for (const text of [
    '',
    '    if: true',
    '    if: false',
    '    if: ' + guard.replace(source, prior.candidate.revision),
  ])
    assert.throws(() => verify(text));
});
