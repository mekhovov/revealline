import { assertFinalWaveBindings } from './solo-final-wave-witness.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindRasterJob, EARNED_RASTER_CASES } from './solo-remote-raster.mjs';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const plan = JSON.parse(await read('docs/performance/solo-remote-final-earned-raster-plan.json'));
const source = 'a6eacee2f09f06f9ffa76fe8cd5d674aff0475a4';
const guard =
  "github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '" +
  source +
  "'";
test('final earned raster binds the exact successful package while preserving candidate-only diagnostic scope', () => {
  assert.equal(plan.candidate.revision, source);
  assert.equal(plan.candidate.run, 39008793814);
  assert.equal(plan.candidate.artifact, 12092903788);
  assert.deepEqual(plan.candidate.outer, {
    bytes: 1091879339,
    sha256: 'a61fd756ce362abacf5dd5f329bed1a936db2b888b9f814cf5924a781964e14a',
  });
  assert.deepEqual(plan.candidate.inner, {
    bytes: 1073755490,
    sha256: '52a9f82f48b3e657755f2c5735826b827caa1e866430d30939d05113b1fa67b1',
  });
  assert.equal(
    plan.candidate.manifestSHA256,
    'b0e56f24e4d49c6c9ee42000f472ca895c883ca02e1063db741e2eddfe428fb7',
  );
  assert.equal(plan.packageBinding.metadataArtifact, 12093018459);
  assert.equal(plan.packageBinding.producerConclusion, 'success');
  assert.equal(plan.release.onceOnlyBefore, source);
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.baseline.reusableArtifact, undefined);
  for (const engine of ['chromium', 'webkit']) {
    const bound = bindRasterJob(plan, 'raster-' + engine);
    assert.equal(bound.rows.length, 1);
    assert.equal(bound.rows[0].source, 'candidate');
    assert.equal(bound.rows[0].timeoutMs, 1200000);
    assert.deepEqual(bound.raster.cases, EARNED_RASTER_CASES);
    assert.equal(bound.raster.cases.length, 21);
    assert.equal(bound.raster.pixelTolerance, 0);
    assert.equal(bound.raster.retryCount, 0);
    assert.equal(bound.raster.conditionalLocalization, false);
  }
});
test('final earned raster preserves dispatched tools and the unchanged legal route fixture', async () => {
  const refs = [...plan.adapterInputs, ...plan.frozenTools, plan.raster.fixture];
  assert.equal(new Set(refs.map((r) => r.path)).size, refs.length);
  await assertFinalWaveBindings(
    'docs/performance/solo-remote-final-earned-raster-plan.json',
    refs,
    '.github/workflows/solo-remote-final-earned-raster-temporary.yml',
  );
  assert.equal(plan.adapterInputs.length + plan.frozenTools.length, 21);
});
test('final earned raster preserves its one-shot edge and 125-minute envelope with sparse tooling only', async () => {
  const text = (
    await read('.github/workflows/solo-remote-final-earned-raster-temporary.yml')
  ).toString();
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
  assert.match(text, /timeout-minutes: 125/);
  assert.match(text, /cancel-in-progress: false/);
  const checks = text.split(/\n      - /).filter((s) => s.includes('uses: actions/checkout@'));
  assert.equal(checks.length, 3);
  for (const step of checks) {
    assert.match(step, /fetch-depth: 1/);
    if (step.includes('path: tools')) {
      assert.match(step, /timeout-minutes: 2/);
      assert.match(step, /sparse-checkout-cone-mode: false/);
      for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.raster.fixture])
        assert(
          step.split('\n').some((line) => line.trim() === '/' + ref.path),
          ref.path,
        );
      assert(step.includes('/scripts/test-solo-final-earned-raster.mjs\n'));
    } else {
      assert.match(step, /timeout-minutes: 3/);
      assert(!step.includes('sparse-checkout'));
      assert(
        step.includes(
          'ref: ' + (step.includes('path: baseline') ? plan.baseline.revision : source),
        ),
      );
    }
  }
  assert.equal(plan.resources.jobDisjointMinutes.total, 123);
  assert.equal(plan.resources.jobDisjointMinutes.jobCap, 125);
});
