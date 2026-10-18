import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { auxiliaryMatrix } from './solo-remote-auxiliary.mjs';
import { validateDemoPlan } from './solo-remote-demo.mjs';

const read = (path) => readFile(new URL('../' + path, import.meta.url));
const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
const firstEightOutcome = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
);
const actualProof = firstEightOutcome.proof;
const source = '797e03f28743921842df6aa57520a72016ba3dfc';
const tree = 'bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5';
const lanes = {
  'shared-return': {
    plan: 'solo-shared-mode-public-return-797e03-plan.json',
    job: 105,
    step: 63,
    seconds: 3720,
  },
  'demo-recovery': {
    plan: 'solo-demo-recovery-797e03-plan.json',
    job: 125,
    step: 79,
    seconds: 4620,
  },
  'demo-resources': {
    plan: 'solo-demo-resources-797e03-plan.json',
    job: 125,
    step: 79,
    seconds: 4620,
  },
};
function job(text, lane) {
  const result = text.split(`\n  ${lane}:\n`);
  assert.equal(result.length, 2);
  return result[1].split(/\n  [a-z][a-z-]+:\n/)[0];
}
function check(text, lane) {
  const body = job(text, lane),
    spec = lanes[lane];
  assert.equal(
    body.match(/^    if: (.+)$/m)?.[1],
    `github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == '${lane}'`,
  );
  assert(body.includes(`timeout-minutes: ${spec.job}\n`));
  assert(body.includes(`timeout-minutes: ${spec.step}\n        working-directory: tools\n`));
  assert(
    body.includes(
      `timeout --signal=TERM --kill-after=30s ${spec.seconds}s node scripts/run-solo-remote-correctness.mjs`,
    ),
  );
  assert(body.includes(`docs/performance/${spec.plan}`));
  assert(
    body.includes(
      `solo-shared-source-checkout.sh 8b01991942dc764b8aa4726851699ce1985e53ae 9373b6a74aea8fa1ef47aa17ace140b4cf714609 ${source} ${tree}`,
    ),
  );
  assert(body.includes('SOLO_TOOLING_REVISION: ${{ github.sha }}'));
  assert(body.includes('ref: ${{ github.sha }}'));
  assert(body.includes('persist-credentials: false'));
  assert(body.includes("node-version: '22.13.1'"));
  assert(body.includes('playwright@1.62.1'));
  const engines = lane === 'shared-return' ? 'chromium webkit' : 'chromium';
  assert.equal(body.match(/playwright" install --with-deps (.+?) 2>&1/m)?.[1], engines);
  assert(body.includes('npm ci --prefix tools --no-audit --no-fund 2>&1'));
  assert(body.includes('--ignore-scripts --save-exact playwright@1.62.1 2>&1'));
  const command = body.match(/^          node (--test [^\n]+?) 2>&1/m)?.[1];
  assert(command);
  const argv = command.trim().split(/\s+/);
  assert.deepEqual(argv.slice(0, 2), ['--test', '--test-concurrency=2']);
  assert(argv.slice(2).every((arg) => /^scripts\/test-[a-z0-9-]+\.mjs$/.test(arg)));
  if (lane === 'shared-return') {
    assert(
      body.includes(
        'fail-fast: false\n      max-parallel: 2\n      matrix:\n        job: [recovery-chromium, recovery-webkit]',
      ),
    );
    assert(body.includes('scripts/test-solo-shared-mode-797e03-admission.mjs '));
    assert(body.includes('scripts/test-solo-shared-mode-public-return.mjs '));
  } else {
    assert(!body.includes('matrix.'));
    assert(body.includes('scripts/test-solo-demo-797e03-admission.mjs '));
    assert(body.includes('scripts/test-solo-owned-resource-assessment.mjs '));
  }
  assert(body.includes('scripts/test-solo-native-consumer-shared-demo.mjs '));
  assert.equal((body.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
  assert(body.includes('cap-reached-completeness-unconfirmed'));
  assert(body.includes("maximumTotalBytes':24*1024*1024"));
  assert(body.includes('retention-days: 14'));
  assert(!/inputs\.(?:source|artifact|timeout)/.test(body));
  return body;
}
test('three reviewed fixed source797 lanes retain actual proof with unchanged engine and timeout owners', async () => {
  const choices = workflow
    .split('      lane:\n')[1]
    .match(/options:\s*\[([^\]]+)\]/)[1]
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  assert.deepEqual(choices.slice(-3), ['shared-return', 'demo-recovery', 'demo-resources']);
  assert(workflow.includes('cancel-in-progress: false'));
  for (const [lane, spec] of Object.entries(lanes)) {
    check(workflow, lane);
    const plan = JSON.parse(await read('docs/performance/' + spec.plan));
    assert.equal(plan.candidate.revision, source);
    assert.equal(plan.candidate.tree, tree);
    assert.equal(plan.release.firstEightSourceRevision, source);
    assert.equal(plan.release.firstEightAllCorrectnessPassed, true);
    assert.deepEqual(plan.release.firstEightEvidence, actualProof);
    assert.equal(
      plan.release.firstEightNumericalFailuresRetained,
      firstEightOutcome.rawNumericalFailuresRetained,
    );
    assert.equal(
      plan.release.nodePortabilityMismatchesRetained,
      firstEightOutcome.nodePortabilityMismatchesRetained,
    );
    const validate = lane === 'shared-return' ? auxiliaryMatrix : validateDemoPlan;
    assert.equal(
      plan.status,
      lane === 'shared-return' ? 'reviewed-diagnostic-only' : 'pinned-for-execution',
    );
    if (lane !== 'shared-return') assert.equal(plan.release.status, 'reviewed');
    validate(plan);
    const held = structuredClone(plan);
    held.status = 'held-awaiting-source-and-dispatch-review';
    if (lane !== 'shared-return') held.release.status = 'held';
    assert.throws(() => validate(held));
    const changed = structuredClone(plan);
    changed.release.firstEightEvidence = null;
    assert.throws(
      () => validate(changed),
      'Reviewed status cannot replace required source797 first-eight evidence',
    );
  }
});
test('changed source, lost guard, expanded limit, wrong engine and omitted failure receipt reject', () => {
  for (const [lane, spec] of Object.entries(lanes)) {
    const body = check(workflow, lane);
    for (const [before, after] of [
      [
        `    if: github.repository == 'mekhovov/revealline' && github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.lane == '${lane}'`,
        '    if: true',
      ],
      ["github.repository == 'mekhovov/revealline' && ", ''],
      ["github.event_name == 'workflow_dispatch' && ", ''],
      ["github.ref == 'refs/heads/main' && ", ''],
      [`inputs.lane == '${lane}'`, "inputs.lane == 'next'"],
      [`timeout-minutes: ${spec.job}`, `timeout-minutes: ${spec.job + 1}`],
      [`timeout-minutes: ${spec.step}`, `timeout-minutes: ${spec.step + 1}`],
      [`${spec.seconds}s node`, `${spec.seconds + 1}s node`],
      [source, '0'.repeat(40)],
      [tree, '0'.repeat(40)],
      ['install --with-deps chromium', 'install --with-deps firefox'],
      ['if: ${{ always() }}', 'if: ${{ success() }}'],
      ['scripts/test-solo-native-consumer-shared-demo.mjs ', ''],
      ['cap-reached-completeness-unconfirmed', 'complete'],
      [
        'npm ci --prefix tools --no-audit --no-fund 2>&1',
        'npm ci --prefix tools --no-audit --no-fund scripts/test-solo-native-consumer-shared-demo.mjs 2>&1',
      ],
      [
        '--save-exact playwright@1.62.1 2>&1',
        '--save-exact playwright@1.62.1 scripts/test-solo-native-consumer-shared-demo.mjs 2>&1',
      ],
      [
        'node --test --test-concurrency=2 scripts/test-solo-remote-correctness.mjs',
        'node --test scripts/test-solo-remote-correctness.mjs --test-concurrency=2',
      ],
    ]) {
      assert(body.includes(before));
      assert.throws(() => check(workflow.replace(body, body.replace(before, after)), lane), before);
    }
  }
});
test('each reviewed sparse set contains every exact adapter and frozen observer reference', async () => {
  for (const [lane, spec] of Object.entries(lanes)) {
    const body = check(workflow, lane);
    const inputs = body
      .split('          sparse-checkout: |\n')[1]
      .split(/\n      - /)[0]
      .trim()
      .split('\n')
      .map((line) => line.trim().slice(1));
    assert.equal(inputs.length, new Set(inputs).size);
    const plan = JSON.parse(await read('docs/performance/' + spec.plan));
    for (const ref of [...plan.adapterInputs, ...plan.frozenTools]) {
      assert(inputs.includes(ref.path), ref.path);
      const bytes = await read(ref.path);
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    }
  }
});
