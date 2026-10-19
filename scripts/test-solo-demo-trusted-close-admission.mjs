import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateDemoPlan, prepareDemoMode } from './solo-remote-demo.mjs';
import {
  decodeDemoCloseWitness,
  assertDemoCloseDeclaration,
  readDeclaredDemoCloseTool,
  demoCloseWitnessPath,
} from './solo-demo-close-declared-source.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPaths = [
  'docs/performance/solo-demo-recovery-797e03-current-tooling-plan.json',
  'docs/performance/solo-demo-resources-797e03-close-boundary-plan.json',
];
const oldPaths = [
  'docs/performance/solo-demo-recovery-797e03-tooling-plan.json',
  'docs/performance/solo-demo-resources-797e03-tooling-plan.json',
];
const plans = await Promise.all(planPaths.map(async (path) => JSON.parse(await read(path))));
const prior = await Promise.all(oldPaths.map(async (path) => JSON.parse(await read(path))));
const proof = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
).proof;
const witnessBytes = await read(demoCloseWitnessPath);
const witness = decodeDemoCloseWitness(witnessBytes);
const changedTools = new Set([
  'scripts/solo-remote-demo.mjs',
  'scripts/solo-demo-recovery-probe.mjs',
  'scripts/observe-solo-demo-recovery.mjs',
]);
function restoreReferences(value, original) {
  if (Array.isArray(value))
    return value.map((entry, index) => restoreReferences(entry, original[index]));
  if (value && typeof value === 'object') {
    if (
      changedTools.has(value.path) &&
      typeof value.bytes === 'number' &&
      typeof value.sha256 === 'string'
    )
      return structuredClone(original);
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, restoreReferences(entry, original?.[key])]),
    );
  }
  return value;
}
test('actual separately named Demo declarations preserve every workload and historical result', () => {
  for (const [index, plan] of plans.entries()) {
    validateDemoPlan(plan);
    assert.equal(plan.status, 'pinned-for-execution');
    assert.equal(plan.release.status, 'reviewed');
    assert.deepEqual(plan.release.firstEightEvidence, proof);
    assert.equal(plan.runtimeRevision, '797e03f28743921842df6aa57520a72016ba3dfc');
    const successor = plan.closeBoundarySuccessor;
    assert.equal(successor.priorDeclaration.path, oldPaths[index]);
    assert.deepEqual(successor.historicalSourceWitness, {
      path: demoCloseWitnessPath,
      bytes: witnessBytes.length,
      sha256: sha(witnessBytes),
    });
    assert.equal(successor.priorObservation.runId, index ? 39130888941 : 39130879732);
    assert.equal(successor.priorObservation.disposition, index ? 'failed-reviewed' : 'passed');
    assert.equal(successor.priorObservation.ownersClosed, true);
    assert.equal(successor.priorObservation.forcedCleanup, false);
    assert.equal(successor.currentObservation, 'unobserved');
    const restored = restoreReferences(structuredClone(plan), prior[index]);
    delete restored.closeBoundarySuccessor;
    for (const key of ['scope', 'bindingScope', 'prospectiveTooling'])
      restored[key] = prior[index][key];
    restored.demo.bindingRequired = prior[index].demo.bindingRequired;
    if (index) delete restored.demo.resourceCycles.closeBoundaryPolicy;
    assert.deepEqual(
      restored,
      prior[index],
      'Only declared tooling references, the resource-only opt-in and explicit successor metadata may differ',
    );
  }
  assert.equal(plans[0].demo.resourceCycles, undefined);
  assert.equal(plans[1].demo.resourceCycles.closeBoundaryPolicy, 'trusted-click-capture-v1');
  assert.equal(plans[1].demo.resourceCycles.cyclesPerMode, 10);
  assert.equal(plans[1].demo.resourceCycles.snapshotLimit, 64);
});
test('prospective recovery inputs stay current while executed resource inputs use exact historical bytes', async () => {
  for (const [index, plan] of plans.entries()) {
    for (const ref of [...plan.adapterInputs, ...plan.frozenTools]) {
      const historical =
        index === 1 ? await readDeclaredDemoCloseTool(planPaths[index], ref) : null;
      const bytes = historical ?? (await read(ref.path));
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(sha(bytes), ref.sha256, ref.path);
      if (index === 0 && changedTools.has(ref.path))
        await assert.rejects(
          () => readDeclaredDemoCloseTool(planPaths[index], ref),
          /No historical fallback/,
        );
    }
    assert.deepEqual(
      plan.demo.driver,
      plan.adapterInputs.find((ref) => ref.path === plan.demo.driver.path),
    );
    assert.deepEqual(
      plan.demo.probe,
      plan.adapterInputs.find((ref) => ref.path === plan.demo.probe.path),
    );
  }
});
test('every original Demo declaration and declared helper remains bound to actual historical Git bytes', async () => {
  for (const record of witness.records.filter((entry) => entry.path.endsWith('-plan.json'))) {
    const bytes = await read(record.path);
    const plan = assertDemoCloseDeclaration(record.path, bytes);
    for (const ref of [...plan.adapterInputs, ...plan.frozenTools]) {
      const historical = await readDeclaredDemoCloseTool(record.path, ref);
      if (!changedTools.has(ref.path)) {
        assert.equal(historical, null);
        continue;
      }
      assert.equal(historical.length, ref.bytes);
      assert.equal(sha(historical), ref.sha256);
    }
  }
});
test('historical witness, declaration and reference substitutions are rejected', async () => {
  const changed = Buffer.from(witnessBytes);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => decodeDemoCloseWitness(changed));
  for (const path of oldPaths) {
    const bytes = await read(path),
      plan = JSON.parse(bytes);
    plan.demo.driver.sha256 = '0'.repeat(64);
    assert.throws(() => assertDemoCloseDeclaration(path, Buffer.from(JSON.stringify(plan))));
    const ref = JSON.parse(bytes).demo.driver;
    await assert.rejects(() => readDeclaredDemoCloseTool(path, { ...ref, sha256: '0'.repeat(64) }));
  }
});
test('executed Demo inputs are refused before display or browser effects by current production admission', async () => {
  for (const plan of prior) {
    let effects = 0;
    await assert.rejects(
      () =>
        prepareDemoMode({
          plan,
          admitted: { artifacts: { candidate: {} } },
          repository: new URL('../', import.meta.url).pathname,
          evidence: '/never',
          digest: async (path) => {
            const bytes = await readFile(path);
            return { bytes: bytes.length, sha256: sha(bytes) };
          },
          required: async () => effects++,
        }),
      { name: 'AssertionError' },
    );
    assert.equal(effects, 0);
  }
});
test('held, absent-proof, wrong-source, open-owner and expanded bounds remain rejected', () => {
  for (const plan of plans)
    for (const mutate of [
      (p) => (p.status = 'held-awaiting-source-and-dispatch-review'),
      (p) => (p.release.status = 'held'),
      (p) => (p.release.firstEightEvidence = null),
      (p) => (p.release.firstEightEvidence.sourceRevision = '0'.repeat(40)),
      (p) => (p.release.firstEightEvidence.ownersClosed = false),
      (p) => p.demo.observationTimeoutMs++,
      (p) => p.demo.replayTimeoutMs++,
      (p) => p.rows[0].timeoutMs++,
    ]) {
      const copy = structuredClone(plan);
      mutate(copy);
      assert.throws(() => validateDemoPlan(copy));
    }
  for (const mutate of [
    (p) => (p.demo.resourceCycles.closeBoundaryPolicy = 'synthetic'),
    (p) => (p.demo.resourceCycles.closeBoundaryPolicy = null),
    (p) => p.demo.resourceCycles.snapshotLimit++,
    (p) => p.demo.resourceCycles.cyclesPerMode++,
  ]) {
    const copy = structuredClone(plans[1]);
    mutate(copy);
    assert.throws(() => validateDemoPlan(copy));
  }
  const legacy = structuredClone(plans[1]);
  delete legacy.demo.resourceCycles.closeBoundaryPolicy;
  validateDemoPlan(legacy);
});

const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
function job(text, lane) {
  const pieces = text.split('\n  ' + lane + ':\n');
  assert.equal(pieces.length, 2);
  return pieces[1].split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
}
function checkSourceInputs(text, lane) {
  const body = job(text, lane);
  const sparse = body.split('          sparse-checkout: |\n')[1].split(/\n      - /)[0];
  for (const path of [
    'scripts/solo-demo-close-declared-source.mjs',
    'docs/performance/fixtures/solo-demo-797e03/d99-close-boundary-source.json',
    'docs/performance/solo-demo-recovery-73a345-plan.json',
    'docs/performance/solo-demo-resources-73a345-plan.json',
    'docs/performance/solo-demo-recovery-797e03-plan.json',
    'docs/performance/solo-demo-resources-797e03-plan.json',
    'docs/performance/solo-demo-recovery-797e03-tooling-plan.json',
    'docs/performance/solo-demo-resources-797e03-tooling-plan.json',
    'docs/performance/solo-demo-recovery-797e03-current-tooling-plan.json',
    'docs/performance/solo-demo-resources-797e03-close-boundary-plan.json',
    'scripts/test-solo-demo-trusted-close-admission.mjs',
  ])
    assert(sparse.includes('            /' + path + '\n'), path);
  const line = body.split('\n').find((value) => value.trim().startsWith('node --test '));
  assert(line);
  const args = line.trim().split(/\s+/).slice(0, line.trim().split(/\s+/).indexOf('2>&1'));
  assert.deepEqual(args.slice(0, 3), ['node', '--test', '--test-concurrency=2']);
  assert.equal(
    args.filter((value) => value === 'scripts/test-solo-demo-trusted-close-admission.mjs').length,
    1,
  );
  assert(!args.slice(3).some((value) => value.startsWith('--test')));
  assert(body.includes('timeout-minutes: 125\n'));
  assert(body.includes('timeout-minutes: 79\n'));
  assert(body.includes('timeout --signal=TERM --kill-after=30s 4620s'));
}
test('both actual Demo setup commands select complete close/history controls and every required sparse input', () => {
  for (const lane of ['demo-recovery', 'demo-resources']) {
    checkSourceInputs(workflow, lane);
    const body = job(workflow, lane);
    for (const path of [
      'scripts/solo-demo-close-declared-source.mjs',
      'docs/performance/fixtures/solo-demo-797e03/d99-close-boundary-source.json',
      'docs/performance/solo-demo-recovery-73a345-plan.json',
      'docs/performance/solo-demo-resources-73a345-plan.json',
      'docs/performance/solo-demo-recovery-797e03-plan.json',
      'docs/performance/solo-demo-resources-797e03-plan.json',
      'docs/performance/solo-demo-recovery-797e03-tooling-plan.json',
      'docs/performance/solo-demo-resources-797e03-tooling-plan.json',
      'docs/performance/solo-demo-recovery-797e03-current-tooling-plan.json',
      'docs/performance/solo-demo-resources-797e03-close-boundary-plan.json',
      'scripts/test-solo-demo-trusted-close-admission.mjs',
    ])
      assert.throws(() =>
        checkSourceInputs(
          workflow.replace(body, body.replace('            /' + path + '\n', '')),
          lane,
        ),
      );
    const command = body.split('\n').find((value) => value.trim().startsWith('node --test '));
    assert.throws(() =>
      checkSourceInputs(
        workflow.replace(
          body,
          body.replace(
            command,
            command.replace('scripts/test-solo-demo-trusted-close-admission.mjs ', ''),
          ),
        ),
        lane,
      ),
    );
    assert.throws(() =>
      checkSourceInputs(
        workflow.replace(
          body,
          body.replace(
            command,
            command.replace('--test-concurrency=2 ', '') + ' --test-concurrency=2',
          ),
        ),
        lane,
      ),
    );
  }
});
