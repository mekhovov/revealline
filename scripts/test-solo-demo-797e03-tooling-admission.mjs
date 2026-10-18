import { readDeclaredDemoCloseTool } from './solo-demo-close-declared-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateDemoPlan, prepareDemoMode } from './solo-remote-demo.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const modes = ['recovery', 'resources'];
const plans = await Promise.all(
  modes.map(async (mode) =>
    JSON.parse(await read('docs/performance/solo-demo-' + mode + '-797e03-tooling-plan.json')),
  ),
);
const prior = await Promise.all(
  modes.map(async (mode) =>
    JSON.parse(await read('docs/performance/solo-demo-' + mode + '-797e03-plan.json')),
  ),
);
const outcome = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
);
const witnessPath = 'docs/performance/fixtures/solo-demo-797e03/ee9-observer-source.json';
const witnessBytes = await read(witnessPath);
const witness = JSON.parse(witnessBytes);
const reviewed = (plan) => structuredClone(plan);
test('separate observer successors retain exact runtime, complete workloads and failed outcomes', () => {
  assert.equal(witnessBytes.length, 39865);
  assert.equal(
    createHash('sha256').update(witnessBytes).digest('hex'),
    '2061dcc83c49d0157691f3dacece73c47da0d70ae37b27d2e27f40c93c2c9605',
  );
  for (const [index, plan] of plans.entries()) {
    assert.equal(plan.status, 'pinned-for-execution');
    assert.equal(plan.release.status, 'reviewed');
    validateDemoPlan(plan);
    assert.deepEqual(plan.release.firstEightEvidence, outcome.proof);
    assert.equal(plan.runtimeRevision, '797e03f28743921842df6aa57520a72016ba3dfc');
    assert.equal(plan.toolingSuccessor.priorObservation.runId, index ? 39123950010 : 39123948345);
    assert.equal(plan.toolingSuccessor.priorObservation.disposition, 'failed-reviewed');
    assert.equal(plan.toolingSuccessor.priorObservation.forcedCleanup, true);
    assert.equal(plan.toolingSuccessor.priorObservation.survivors, 0);
    assert.equal(plan.toolingSuccessor.currentObservation, 'unobserved');
    assert.deepEqual(plan.toolingSuccessor.historicalSourceWitness, {
      path: witnessPath,
      bytes: witnessBytes.length,
      sha256: createHash('sha256').update(witnessBytes).digest('hex'),
    });
    const restored = structuredClone(plan);
    delete restored.toolingSuccessor;
    for (const key of ['status', 'scope', 'prospectiveTooling', 'bindingScope'])
      restored[key] = prior[index][key];
    for (const key of ['status', 'ownerScope', 'publicationScope'])
      restored.release[key] = prior[index].release[key];
    restored.resources.workflow = prior[index].resources.workflow;
    restored.demo.driver = prior[index].demo.driver;
    restored.adapterInputs = restored.adapterInputs.map((ref) =>
      ref.path === restored.demo.driver.path ? prior[index].demo.driver : ref,
    );
    assert.deepEqual(
      restored,
      prior[index],
      'Only observer identity and explicit successor/review metadata may differ',
    );
  }
});
test('executed observer successors retain their exact historical tool inputs', async () => {
  for (const [index, plan] of plans.entries()) {
    assert.deepEqual(
      plan.demo.driver,
      plan.adapterInputs.find((ref) => ref.path === plan.demo.driver.path),
    );
    for (const ref of [...plan.adapterInputs, ...plan.frozenTools]) {
      const bytes =
        (await readDeclaredDemoCloseTool(
          'docs/performance/solo-demo-' + modes[index] + '-797e03-tooling-plan.json',
          ref,
        )) ?? (await read(ref.path));
      assert.equal(bytes.length, ref.bytes, ref.path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
    }
  }
});
test('held, missing-proof, wrong-source, open-owner and expanded limits remain rejected', () => {
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
      const copy = reviewed(plan);
      mutate(copy);
      assert.throws(() => validateDemoPlan(copy));
    }
});
test('actual current digest rejects the original executed observer before native effects', async () => {
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
            return {
              bytes: bytes.length,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            };
          },
          required: async () => effects++,
        }),
      { name: 'AssertionError' },
    );
    assert.equal(effects, 0);
  }
});
test('original executed declarations remain the exact independent Git records', async () => {
  for (const mode of modes) {
    const path = 'docs/performance/solo-demo-' + mode + '-797e03-plan.json';
    const bytes = await read(path);
    const record = witness.records.find((entry) => entry.path === path);
    assert.equal(record.revision, 'ee9ece54bc9f484bc4179a20f8fd915d7933680b');
    assert.equal(bytes.length, record.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
    assert.equal(
      createHash('sha1')
        .update(Buffer.from('blob ' + bytes.length + '\0'))
        .update(bytes)
        .digest('hex'),
      record.blob,
    );
  }
});
