import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { bindTouchJob, touchMatrix, TOUCH_JOBS, TOUCH_PROTOCOL } from './solo-remote-touch.mjs';

const root = new URL('../', import.meta.url);
const planPath = 'docs/performance/solo-native-touch-plan.json';
const workflowPath = '.github/workflows/solo-remote-native-touch-temporary.yml';
const read = (path) => readFile(new URL(path, root));
const plan = JSON.parse(await read(planPath));
const workflow = (await read(workflowPath)).toString();
const edge = 'a7e0219818842f02399317ca6d2a14bdd506da3d';
const guard = `github.event.pull_request.number == 1544 && github.event.pull_request.head.repo.full_name == github.repository && github.event.action == 'synchronize' && github.event.before == '${edge}'`;
const dynamicRoots = [
  'soundtrack-distribution',
  'optional-distribution',
  'external-distribution',
  'optional-artwork',
].map((name) => `scripts/${name}.mjs`);

function check(value, text) {
  assert.deepEqual(
    touchMatrix(value).include.map((row) => row.job),
    TOUCH_JOBS,
  );
  assert.deepEqual(value.protocol, TOUCH_PROTOCOL);
  assert.equal(value.release.onceOnlyBefore, edge);
  assert.equal(value.releaseTrigger.onceOnlyBefore, edge);
  assert.equal(value.releaseTrigger.status, 'reviewed-one-shot');
  assert.equal(value.releaseTrigger.pullRequest, 1544);
  assert.equal(value.releaseTrigger.sameRepositoryRequired, true);
  assert.equal(value.releaseTrigger.action, 'synchronize');
  assert.equal(value.packageBinding.producerConclusion, 'success');
  assert.equal(value.packageBinding.metadataArtifact, 12093018459);
  assert.equal(value.release.evidence.length, 1);
  const prior = value.release.evidence[0];
  assert.equal(prior.run, 39012635540);
  assert.equal(prior.artifact, 12094016272);
  assert.deepEqual(prior.archive, {
    bytes: 807066,
    sha256: '170f3013944b1c9c68664ddd4acf7adebd55ed9785bf6746ed6c30fa26cabde5',
  });
  assert.equal(prior.firstEightPassed, 7);
  assert.equal(prior.firstEightFailed, 1);
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], guard);
  assert(!text.includes('workflow_dispatch') && !text.includes('workflow_run:'));
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /timeout-minutes: 130/);
  assert.match(text, /timeout-minutes: 78/);
  assert.match(text, /4620s node scripts\/run-solo-remote-correctness\.mjs/);
  assert.match(text, /max-parallel: 2/);
  assert.match(text, /fail-fast: false/);
  const command = text.split('\n').find((line) => line.includes('node --test'));
  for (const path of [
    'scripts/test-solo-native-touch-release.mjs',
    'scripts/test-solo-source-verifier-smoke.mjs',
    'scripts/test-solo-remote-touch.mjs',
  ])
    assert(command.includes(path), path);
  const steps = text.split(/\n      - /).filter((step) => step.includes('uses: actions/checkout@'));
  assert.equal(steps.length, 3);
  for (const step of steps) {
    assert.match(step, /fetch-depth: 1/);
    assert.match(step, /persist-credentials: false/);
    if (step.includes('path: tools')) {
      assert.match(step, /timeout-minutes: 2/);
      assert.match(step, /sparse-checkout-cone-mode: false/);
      for (const path of [...value.adapterInputs, ...value.frozenTools, value.fixture]
        .map((ref) => ref.path)
        .concat(dynamicRoots, planPath, workflowPath, 'game/build-config.json'))
        assert(
          step.split('\n').some((line) => line.trim() === '/' + path),
          path,
        );
    } else {
      assert.match(step, /timeout-minutes: 3/);
      assert(!step.includes('sparse-checkout'));
      assert(
        step.includes(
          'ref: ' +
            (step.includes('path: baseline') ? value.baseline.revision : value.candidate.revision),
        ),
      );
    }
  }
  for (const path of dynamicRoots) assert(value.frozenTools.some((ref) => ref.path === path));
  for (const job of TOUCH_JOBS) {
    const bound = bindTouchJob(value, job);
    assert.equal(bound.rows.length, 3);
    assert(bound.rows.every((row) => row.timeoutMs === 480000 && row.source === 'candidate'));
  }
  assert.equal(value.resources.jobDisjointMinutes.total, 122);
  assert.equal(value.resources.jobDisjointMinutes.jobCap, 130);
  assert.match(text, /if: \$\{\{ always\(\) \}\}/);
}

test('actual native touch release retains twelve fixed observations, exact failed predecessor and bounded owned workflow', async () => {
  check(plan, workflow);
  for (const ref of [...plan.adapterInputs, ...plan.frozenTools, plan.fixture]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
  }
});
test('touch release rejects source, protocol, evidence, scope, one-shot and dynamic closure mutations', () => {
  for (const mutate of [
    (v) => v.candidate.artifact++,
    (v) => v.protocol.directionChanges--,
    (v) => (v.protocol.headed = false),
    (v) => (v.release.firstEightAllCorrectnessPassed = true),
    (v) => (v.release.evidence[0].firstEightFailed = 0),
    (v) => (v.release.evidence[0].archive.sha256 = '0'.repeat(64)),
    (v) => (v.release.onceOnlyBefore = v.candidate.revision),
    (v) => (v.releaseTrigger.status = 'held'),
    (v) => (v.baseline.reusableArtifact = {}),
    ...dynamicRoots.map(
      (path) => (v) => (v.frozenTools = v.frozenTools.filter((ref) => ref.path !== path)),
    ),
  ]) {
    const value = structuredClone(plan);
    mutate(value);
    assert.throws(() => check(value, workflow));
  }
  for (const alter of [
    (s) => s.replace(guard, 'true'),
    (s) => s.replace('timeout-minutes: 130', 'timeout-minutes: 131'),
    (s) => s.replaceAll('scripts/test-solo-source-verifier-smoke.mjs', 'scripts/missing-smoke.mjs'),
    (s) =>
      s.replaceAll('/scripts/soundtrack-distribution.mjs', '/scripts/missing-distribution.mjs'),
    (s) => s.replace('path: candidate', 'path: candidate\n          sparse-checkout: game'),
  ])
    assert.throws(() => check(plan, alter(workflow)));
});
