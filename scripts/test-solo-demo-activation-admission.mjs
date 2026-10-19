import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  validateDemoPlan,
  prepareDemoMode,
  DEMO_CLOSE_ACTIVATION_POLICY,
} from './solo-remote-demo.mjs';
import {
  decodeDemoActivationWitness,
  demoActivationWitnessPath,
  assertDemoCloseDeclaration,
  readDeclaredDemoCloseTool,
} from './solo-demo-close-declared-source.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const path = 'docs/performance/solo-demo-resources-797e03-activation-boundary-plan.json';
const oldPath = 'docs/performance/solo-demo-resources-797e03-close-boundary-plan.json';
const plan = JSON.parse(await read(path)),
  priorBytes = await read(oldPath),
  prior = JSON.parse(priorBytes);
const witnessBytes = await read(demoActivationWitnessPath);
const witness = decodeDemoActivationWitness(witnessBytes);
const proof = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
).proof;
const routingPaths = ['game/ui/demo-input.mjs', 'game/test/demo-input.test.mjs'];
const tools = new Set([
  'scripts/solo-remote-demo.mjs',
  'scripts/solo-demo-recovery-probe.mjs',
  'scripts/observe-solo-demo-recovery.mjs',
]);
function restore(value, old) {
  if (Array.isArray(value)) return value.map((v, i) => restore(v, old[i]));
  if (value && typeof value === 'object') {
    if (tools.has(value.path) && typeof value.bytes === 'number') return structuredClone(old);
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restore(v, old?.[k])]));
  }
  return value;
}
test('actual activation successor preserves the executed workload and failed click-only receipt', () => {
  validateDemoPlan(plan);
  assert.equal(plan.status, 'pinned-for-execution');
  assert.equal(plan.release.status, 'reviewed');
  assert.deepEqual(plan.release.firstEightEvidence, proof);
  assert.equal(plan.runtimeRevision, '797e03f28743921842df6aa57520a72016ba3dfc');
  const successor = plan.activationBoundarySuccessor;
  assert.deepEqual(successor.priorDeclaration, {
    path: oldPath,
    bytes: priorBytes.length,
    sha256: sha(priorBytes),
  });
  assert.deepEqual(successor.historicalSourceWitness, {
    path: demoActivationWitnessPath,
    bytes: witnessBytes.length,
    sha256: sha(witnessBytes),
  });
  assert.equal(successor.priorObservation.runId, 39142158750);
  assert.equal(successor.priorObservation.artifactId, 12141573283);
  assert.equal(
    successor.priorObservation.artifactSHA256,
    '4eb112a65ca25dbdba0f8fb2f789dcfa5ecb61c33ac14730a2a15fe9a67da16e',
  );
  assert.equal(successor.priorObservation.disposition, 'failed-reviewed');
  assert.equal(successor.priorObservation.ownersClosed, true);
  assert.equal(successor.priorObservation.forcedCleanup, false);
  assert.equal(successor.currentObservation, 'unobserved');
  assert.equal(plan.demo.resourceCycles.closeBoundaryPolicy, DEMO_CLOSE_ACTIVATION_POLICY);
  const copy = structuredClone(plan);
  delete copy.activationBoundarySuccessor;
  for (const key of ['scope', 'bindingScope', 'prospectiveTooling']) copy[key] = prior[key];
  copy.demo.resourceCycles.closeBoundaryPolicy = prior.demo.resourceCycles.closeBoundaryPolicy;
  assert.deepEqual(copy.frozenTools.slice(-2), successor.inputRoutingSources);
  assert.deepEqual(
    successor.inputRoutingSources.map((r) => r.path),
    routingPaths,
  );
  copy.frozenTools = copy.frozenTools.slice(0, -2);
  assert.deepEqual(restore(copy, prior), prior);
});
test('every new runtime/control input uses current bytes and the immutable reader refuses new-plan fallback', async () => {
  for (const ref of [...plan.adapterInputs, ...plan.frozenTools]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
    if (tools.has(ref.path))
      await assert.rejects(() => readDeclaredDemoCloseTool(path, ref), /No historical fallback/);
  }
  for (const ref of plan.activationBoundarySuccessor.inputRoutingSources)
    assert.deepEqual(
      ref,
      plan.frozenTools.find((r) => r.path === ref.path),
    );
});
test('executed fd787 declaration and all three changed helpers remain exact historical Git inputs', async () => {
  assert.deepEqual(assertDemoCloseDeclaration(oldPath, priorBytes), prior);
  assert.equal(witness.revision, 'fd78700a0e3167e104da7c854a8b04f2cea9a19f');
  for (const ref of [...prior.adapterInputs, ...prior.frozenTools])
    if (tools.has(ref.path)) {
      const bytes = await readDeclaredDemoCloseTool(oldPath, ref);
      assert.equal(bytes.length, ref.bytes);
      assert.equal(sha(bytes), ref.sha256);
    }
  const changed = Buffer.from(witnessBytes);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => decodeDemoActivationWitness(changed));
  const mutated = structuredClone(prior);
  mutated.demo.resourceCycles.cyclesPerMode++;
  assert.throws(() => assertDemoCloseDeclaration(oldPath, Buffer.from(JSON.stringify(mutated))));
  await assert.rejects(() =>
    readDeclaredDemoCloseTool(oldPath, { ...prior.demo.driver, sha256: '0'.repeat(64) }),
  );
});
test('current production admission rejects the old executed helper pins before any native effect', async () => {
  let effects = 0;
  await assert.rejects(
    () =>
      prepareDemoMode({
        plan: prior,
        admitted: { artifacts: { candidate: {} } },
        repository: new URL('../', import.meta.url).pathname,
        evidence: '/never',
        digest: async (p) => {
          const b = await readFile(p);
          return { bytes: b.length, sha256: sha(b) };
        },
        required: async () => effects++,
      }),
    { name: 'AssertionError' },
  );
  assert.equal(effects, 0);
});
test('held, wrong-proof, altered activation and expanded bounds remain refused', () => {
  for (const mutate of [
    (p) => (p.release.status = 'held'),
    (p) => (p.release.firstEightEvidence = null),
    (p) => (p.release.firstEightEvidence.sourceRevision = '0'.repeat(40)),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.demo.resourceCycles.closeBoundaryPolicy = 'click-exemption'),
    (p) => p.demo.resourceCycles.snapshotLimit++,
    (p) => p.demo.resourceCycles.cyclesPerMode++,
    (p) => p.demo.observationTimeoutMs++,
    (p) => p.rows[0].timeoutMs++,
  ]) {
    const copy = structuredClone(plan);
    mutate(copy);
    assert.throws(() => validateDemoPlan(copy));
  }
  const legacy = structuredClone(plan);
  legacy.demo.resourceCycles.closeBoundaryPolicy = 'trusted-click-capture-v1';
  validateDemoPlan(legacy);
});
const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
function job(text, lane) {
  const pieces = text.split('\n  ' + lane + ':\n');
  assert.equal(pieces.length, 2);
  return pieces[1].split(/\n  [A-Za-z_][A-Za-z0-9_-]*:\n/)[0];
}
const support = [
  path,
  oldPath,
  demoActivationWitnessPath,
  'scripts/solo-demo-close-declared-source.mjs',
  'scripts/test-solo-demo-activation-admission.mjs',
  ...routingPaths,
];
function check(text, lane) {
  const body = job(text, lane),
    sparse = body.split('          sparse-checkout: |\n')[1].split(/\n      - /)[0];
  for (const file of support) assert(sparse.includes('            /' + file + '\n'), file);
  const line = body.split('\n').find((v) => v.trim().startsWith('node --test '));
  assert(line);
  const args = line.trim().split(/\s+/).slice(0, line.trim().split(/\s+/).indexOf('2>&1'));
  assert.deepEqual(args.slice(0, 3), ['node', '--test', '--test-concurrency=2']);
  assert.equal(
    args.filter((v) => v === 'scripts/test-solo-demo-activation-admission.mjs').length,
    1,
  );
  assert(args.includes('scripts/test-solo-remote-demo.mjs'));
  assert(!args.slice(3).some((v) => v.startsWith('--test')));
  assert(body.includes('timeout-minutes: 125\n'));
  assert(body.includes('timeout-minutes: 79\n'));
  assert(body.includes('timeout --signal=TERM --kill-after=30s 4620s'));
}
test('both actual Demo commands include complete activation controls and current/historical input closure', () => {
  assert(
    job(workflow, 'demo-resources').includes('scripts/run-solo-remote-correctness.mjs ' + path),
  );
  assert(
    job(workflow, 'demo-recovery').includes(
      'scripts/run-solo-remote-correctness.mjs docs/performance/solo-demo-recovery-797e03-current-tooling-plan.json',
    ),
  );
  for (const lane of ['demo-recovery', 'demo-resources']) {
    check(workflow, lane);
    const body = job(workflow, lane);
    for (const file of support)
      assert.throws(() =>
        check(workflow.replace(body, body.replace('            /' + file + '\n', '')), lane),
      );
    const command = body.split('\n').find((v) => v.trim().startsWith('node --test '));
    for (const changed of [
      command.replace('scripts/test-solo-demo-activation-admission.mjs ', ''),
      command.replace('--test-concurrency=2 ', '') + ' --test-concurrency=2',
    ])
      assert.throws(() => check(workflow.replace(body, body.replace(command, changed)), lane));
  }
});
