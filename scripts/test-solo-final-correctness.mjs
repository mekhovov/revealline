import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateBaselineReuse } from './solo-remote-baseline.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const json = async (path) => JSON.parse(await read(path));
const plan = await json('docs/performance/solo-remote-final-correctness-plan.json');
const source = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
const guard =
  "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '" +
  source +
  "'";
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function assertActualBinding(value) {
  assert.equal(value.format, 'SoloHostedCorrectnessPlan.v1');
  assert.equal(value.status, 'reviewed-correctness-only');
  assert.equal(value.candidate.revision, source);
  assert.equal(value.candidate.tree, '6b13627e324f695b6ee8d9f2dee2eeeb7217c332');
  assert.equal(value.runtimeRevision, '32abd322afd8243e4537ce4784e2f78ee45ecbec');
  assert.equal(value.candidate.run, 39008793814);
  assert.equal(value.candidate.artifact, 12092903788);
  assert.deepEqual(value.candidate.outer, {
    bytes: 1091879339,
    sha256: 'a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a',
  });
  assert.deepEqual(value.candidate.inner, {
    bytes: 1073755490,
    sha256: '52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1',
  });
  assert.equal(
    value.candidate.manifestSHA256,
    'b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7',
  );
  assert.equal(value.packageBinding.producerConclusion, 'success');
  assert.equal(value.packageBinding.metadataArtifact, 12093018459);
  assert.deepEqual(value.packageBinding.metadataOuter, {
    bytes: 16050,
    sha256: '84817643f9af167b2ffd9dc688f1894ac74bf64cf2493ce3da81eabb9eada8d5',
  });
  assert.deepEqual(value.packageBinding.packageBinding, {
    bytes: 7285,
    sha256: '0b22f74bf0c08adef7d8a26d0485fa013100cc2cd5df355b71a7363ee48f535b',
  });
  assert.equal(value.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
  assert.equal(value.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
  assert.equal(value.baseline.reusableArtifact.artifact, 12088541389);
  validateBaselineReuse(value.baseline.reusableArtifact, value);
  assert.equal(value.performanceExclusion, true);
  assert.equal(value.currentSourceCorrectness.status, 'pending-not-run');
  assert.equal(value.currentSourceCorrectness.receipt, null);
  assert.equal(value.releaseTrigger.onceOnlyBefore, source);
}

test('final correctness binds only the actual successful final package and normal main8b baseline', () => {
  assertActualBinding(plan);
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => p.candidate.inner.bytes++,
    (p) => (p.candidate.outer.sha256 = '0'.repeat(64)),
    (p) => (p.candidate.revision = '0'.repeat(40)),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => p.packageBinding.metadataArtifact++,
    (p) => (p.packageBinding.producerConclusion = 'failure'),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => delete p.baseline.reusableArtifact,
    (p) => (p.currentSourceCorrectness.status = 'passed'),
    (p) => (p.performanceExclusion = false),
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(() => assertActualBinding(changed));
  }
});

test('final correctness preserves all eight original rows, recipe, limits and failed history', async () => {
  const historical = await json('docs/performance/solo-remote-correctness-plan.json');
  for (const key of ['rows', 'fixture', 'helperTimeoutMs', 'evidenceBytes'])
    assert.deepEqual(plan[key], historical[key]);
  for (const key of [
    'automaticRetries',
    'perCommandRSSBytes',
    'perCommandLogBytes',
    'perRowEvidenceBytes',
    'aggregateEvidenceBytes',
    'minimumInitialMemoryBytes',
    'minimumInitialDiskBytes',
    'minimumRemainingDiskBytes',
  ])
    assert.equal(plan.resources[key], historical.resources[key]);
  assert.equal(plan.rows.length, 8);
  assert.equal(plan.currentSourceCorrectness.historicalPredecessor.failedRows, 1);
  assert.equal(plan.currentSourceCorrectness.intermediatePredecessor.observedRows, 0);
  assert.equal(plan.currentSourceCorrectness.intermediatePredecessor.run, 39008793892);
  assert.equal(plan.hitchJournal, undefined);
  assert.equal(plan.probe, undefined);
});

test('final correctness verifies every current tool and scenario byte independently of historical witnesses', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.fixture];
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  for (const ref of refs) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
  }
  assert.equal(plan.adapterInputs.length + plan.frozenTools.length, 32);
});

test('final correctness has one source-bound release edge and only the tools checkout is sparse', async () => {
  const text = (
    await read('.github/workflows/solo-remote-final-correctness-temporary.yml')
  ).toString();
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
  assert.match(text, /timeout-minutes: 145/);
  assert.match(text, /cancel-in-progress: false/);
  const checks = text.split(/\n      - /).filter((s) => s.includes('uses: actions/checkout@'));
  assert.equal(checks.length, 3);
  for (const step of checks) {
    assert.match(step, /timeout-minutes: 3/);
    assert.match(step, /fetch-depth: 1/);
    if (step.includes('path: tools')) {
      assert.match(step, /sparse-checkout-cone-mode: false/);
      for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.fixture])
        assert(
          step.split('\n').some((line) => line.trim() === '/' + ref.path),
          ref.path,
        );
      assert(step.includes('/scripts/test-solo-final-correctness.mjs\n'));
      assert(step.includes('/docs/performance/solo-remote-final-correctness-plan.json\n'));
    } else {
      assert(!step.includes('sparse-checkout'));
      assert(
        step.includes(
          'ref: ' + (step.includes('path: baseline') ? plan.baseline.revision : source),
        ),
      );
    }
  }
});
