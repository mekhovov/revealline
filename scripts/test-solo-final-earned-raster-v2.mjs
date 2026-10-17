import { readHistoricalQualificationRefs } from './solo-page-error-source-witness.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindRasterJob, EARNED_RASTER_CASES } from './solo-remote-raster.mjs';

const root = new URL('../', import.meta.url);
const originalPath = 'docs/performance/solo-remote-final-earned-raster-plan.json';
const planPath = 'docs/performance/solo-remote-final-earned-raster-v2-plan.json';
const workflowPath = '.github/workflows/solo-remote-final-earned-raster-v2-temporary.yml';
const read = (path) => readFile(new URL(path, root));
const originalBytes = await read(originalPath),
  original = JSON.parse(originalBytes);
const plan = JSON.parse(await read(planPath)),
  workflow = (await read(workflowPath)).toString();
const edge = 'a7e0219818842f02399317ca6d2a14bdd506da3d';
const guard = `github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${edge}'`;
const roots = [
  'soundtrack-distribution',
  'optional-distribution',
  'external-distribution',
  'optional-artwork',
].map((name) => `scripts/${name}.mjs`);
const prior = [
  [
    'chromium',
    12092814087,
    65467,
    'fe3c40a9e7a2c300ef896254414bedee5626510ade89c43afa996397ae22e060',
  ],
  [
    'webkit',
    12093333132,
    65404,
    '36c3d5179df1711148c634c55dfb3ece58189c385687cb48ba8d844666a96805',
  ],
];
function check(value, text) {
  for (const key of [
    'format',
    'status',
    'repository',
    'candidate',
    'baseline',
    'runtimeRevision',
    'raster',
    'jobs',
    'resources',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'evidenceBytes',
    'rowEvidenceBytes',
    'packageBinding',
  ])
    assert.deepEqual(value[key], original[key], key);
  assert.deepEqual(value.release, { ...original.release, onceOnlyBefore: edge });
  assert.equal(value.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(value.releaseTrigger.onceOnlyBefore, edge);
  assert.equal(value.setupSuccessor.retainedRun, 39012635555);
  assert.equal(value.setupSuccessor.retainedTooling, edge);
  assert.equal(value.setupSuccessor.nativeCasesObserved, 0);
  assert.deepEqual(value.setupSuccessor.previousDeclaration, {
    path: originalPath,
    bytes: 13408,
    sha256: '5fade8474629c12b6e170faeef29917aeb418a32baeb6074eddb14a739d92fc3',
  });
  assert.equal(value.setupSuccessor.results.length, 2);
  for (let i = 0; i < prior.length; i++) {
    const [engine, artifact, bytes, sha256] = prior[i],
      actual = value.setupSuccessor.results[i];
    assert.equal(actual.engine, engine);
    assert.equal(actual.artifact, artifact);
    assert.deepEqual(actual.archive, { bytes, sha256 });
    assert.equal(actual.run, 39012635555);
    assert.equal(actual.runConclusion, 'failure');
    assert.equal(actual.fullMemberReadback, 'passed');
  }
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /timeout-minutes: 125/);
  assert.match(text, /timeout-minutes: 79/);
  assert.match(text, /4620s node scripts\/run-solo-remote-correctness\.mjs/);
  const command = text.split('\n').find((line) => line.includes('node --test'));
  for (const path of [
    'scripts/test-solo-final-earned-raster-v2.mjs',
    'scripts/test-solo-source-verifier-smoke.mjs',
  ])
    assert(command.includes(path));
  const steps = text.split(/\n      - /).filter((step) => step.includes('uses: actions/checkout@'));
  assert.equal(steps.length, 3);
  for (const step of steps) {
    assert.match(step, /fetch-depth: 1/);
    if (step.includes('path: tools')) {
      assert.match(step, /timeout-minutes: 2/);
      assert.match(step, /sparse-checkout-cone-mode: false/);
      for (const path of [...value.adapterInputs, ...value.frozenTools, value.raster.fixture]
        .map((ref) => ref.path)
        .concat(roots, planPath, workflowPath, 'game/build-config.json'))
        assert(
          step.split('\n').some((line) => line.trim() === '/' + path),
          path,
        );
    } else {
      assert.match(step, /timeout-minutes: 3/);
      assert(!step.includes('sparse-checkout'));
    }
  }
  for (const path of roots) assert(value.frozenTools.some((ref) => ref.path === path));
  for (const engine of ['chromium', 'webkit']) {
    const bound = bindRasterJob(value, 'raster-' + engine);
    assert.deepEqual(bound.raster.cases, EARNED_RASTER_CASES);
    assert.equal(bound.raster.pixelTolerance, 0);
    assert.equal(bound.raster.retryCount, 0);
    assert.equal(bound.rows.length, 1);
    assert.equal(bound.rows[0].timeoutMs, 1200000);
  }
}
test('raster setup successor preserves the immutable failed declaration and exact case protocol', async () => {
  assert.equal(originalBytes.length, 13408);
  assert.equal(
    createHash('sha256').update(originalBytes).digest('hex'),
    '5fade8474629c12b6e170faeef29917aeb418a32baeb6074eddb14a739d92fc3',
  );
  check(plan, workflow);
  const historical = await readHistoricalQualificationRefs(planPath, workflowPath);
  for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.raster.fixture]) {
    const old = historical.get(ref.path);
    assert(old, ref.path);
    assert.equal(old.bytes, ref.bytes, ref.path);
    assert.equal(old.sha256, ref.sha256, ref.path);
  }
});
test('raster successor rejects changed source, cases, failed evidence, limits, edge and missing smoke', () => {
  for (const mutate of [
    (v) => v.candidate.artifact++,
    (v) => v.raster.pixelTolerance++,
    (v) => v.raster.cases.pop(),
    (v) => v.setupSuccessor.nativeCasesObserved++,
    (v) => (v.setupSuccessor.results[0].runConclusion = 'success'),
    (v) => (v.setupSuccessor.previousDeclaration.sha256 = '0'.repeat(64)),
    (v) => (v.release.firstEightAllCorrectnessPassed = true),
    (v) => (v.release.onceOnlyBefore = v.candidate.revision),
    (v) => v.rowEvidenceBytes++,
    ...roots.map(
      (path) => (v) => (v.frozenTools = v.frozenTools.filter((ref) => ref.path !== path)),
    ),
  ]) {
    const value = structuredClone(plan);
    mutate(value);
    assert.throws(() => check(value, workflow));
  }
  for (const alter of [
    (s) => s.replace(guard, 'true'),
    (s) => s.replace('timeout-minutes: 125', 'timeout-minutes: 126'),
    (s) => s.replaceAll('scripts/test-solo-source-verifier-smoke.mjs', 'scripts/missing-smoke.mjs'),
    (s) => s.replaceAll('/scripts/optional-artwork.mjs', '/scripts/missing-artwork.mjs'),
  ])
    assert.throws(() => check(plan, alter(workflow)));
});
