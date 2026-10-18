import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { validateDemoPlan, prepareDemoMode, DEMO_ARMS } from './solo-remote-demo.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const plans = await Promise.all(
  ['recovery', 'resources'].map(async (mode) =>
    JSON.parse(await read('docs/performance/solo-demo-' + mode + '-73a345-plan.json')),
  ),
);
// Exact retained source73 first-eight correctness receipt; numerical failures remain separate.
const verifiedFirstEight = {
  format: 'SoloFirstEightCorrectnessEvidenceV1',
  sourceRevision: '73a345cec696d7789198cf295ca5c37b17ca0e71',
  runId: 39105055762,
  artifactId: 12127359946,
  artifactSHA256: '17665afe978ae63cfaf8d24b1a9626e1d7f607b7ee2611fc637c9e680f3d46d8',
  summarySHA256: 'a33416a355620817896366d5312fbecb44f0c7e6b8f7220941c8447886d99762',
  correctness: 'passed',
  ownersClosed: true,
};
const reviewed = (plan) => ({
  ...structuredClone(plan),
  status: 'pinned-for-execution',
  release: {
    ...structuredClone(plan.release),
    status: 'reviewed',
    firstEightAllCorrectnessPassed: true,
    firstEightEvidence: structuredClone(verifiedFirstEight),
  },
});
const witness = JSON.parse(
  await read('docs/performance/fixtures/solo-demo-73a345/source-assets.json'),
);
const runner = await readFile(
  new URL('./run-solo-remote-correctness.mjs', import.meta.url),
  'utf8',
);
const ast = parse(runner, { ecmaVersion: 'latest', sourceType: 'module' });
const main = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === 'main');
const variable = (name) =>
  main.body.body
    .flatMap((n) => (n.type === 'VariableDeclaration' ? n.declarations : []))
    .find((n) => n.id.name === name).init;
const extension = variable('extension'),
  format = variable('report').properties.find((n) => n.key.name === 'format').value;
const route = new Function(
  'plan',
  'return (' + runner.slice(extension.start, extension.end) + ');',
);
const report = new Function(
  'plan',
  'extension',
  'return (' + runner.slice(format.start, format.end) + ');',
);
test('both reviewed Demo declarations bind actual correctness proof and remain independent with original budgets', () => {
  for (const p of plans) {
    assert.deepEqual(p.release.firstEightEvidence, verifiedFirstEight);
    assert.deepEqual(p.release.firstEightNumericalFailures, [
      'baseline-first30-chromium',
      'baseline-first30-webkit',
      'candidate-first30-webkit',
    ]);
    validateDemoPlan(p);
    assert.throws(() =>
      validateDemoPlan({
        ...structuredClone(p),
        status: 'held-awaiting-source-and-dispatch-review',
        release: { ...structuredClone(p.release), status: 'held' },
      }),
    );
    assert.throws(() =>
      validateDemoPlan({
        ...reviewed(p),
        release: { ...reviewed(p).release, firstEightAllCorrectnessPassed: false },
      }),
    );
    const q = reviewed(p);
    validateDemoPlan(q);
    assert.equal(q.demo.observationTimeoutMs, 360000);
    assert.equal(q.demo.replayTimeoutMs, 120000);
    assert.equal(q.rows[0].timeoutMs, 660000);
    assert.equal(q.helperTimeoutMs, 4500000);
    assert.equal(q.setupTimeoutMs, 2400000);
    assert.equal(q.rowEvidenceBytes, 32 * 1024 ** 2);
    assert.equal(q.evidenceBytes, 256 * 1024 ** 2);
  }
  assert.deepEqual(plans[0].demo.arms, DEMO_ARMS);
  assert.deepEqual(plans[0].demo.qualityWindowsMs, [5000, 2500]);
  assert.equal(plans[0].demo.resourceCycles, undefined);
  assert.deepEqual(plans[1].demo.arms, []);
  assert.deepEqual(plans[1].demo.qualityWindowsMs, []);
  assert.equal(plans[1].demo.resourceCycles.cyclesPerMode, 10);
  assert.equal(plans[1].demo.resourceCycles.snapshotLimit, 64);
});
test('explicit exact package/source/asset/prior-proof/dispatch binding cannot be removed or substituted', () => {
  for (const p of plans)
    for (const mutate of [
      (q) => delete q.sourceCohort,
      (q) => (q.sourceCohort = 'other'),
      (q) => (q.release.firstEightEvidence = null),
      (q) =>
        (q.release.firstEightEvidence.sourceRevision = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4'),
      (q) => (q.release.firstEightEvidence.correctness = 'failed'),
      (q) => (q.release.firstEightEvidence.ownersClosed = false),
      (q) => (q.release.firstEightEvidence.artifactId = 0),
      (q) => (q.release.firstEightEvidence.artifactSHA256 = 'invalid'),
      (q) => (q.release.firstEightSourceRevision = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4'),
      (q) => (q.release.firstEightAllCorrectnessPassed = false),
      (q) => (q.runtimeRevision = '0'.repeat(40)),
      (q) => (q.candidate.revision = '0'.repeat(40)),
      (q) => (q.candidate.tree = '0'.repeat(40)),
      (q) => q.candidate.run++,
      (q) => q.candidate.artifact++,
      (q) => q.candidate.outer.bytes++,
      (q) => (q.candidate.inner.sha256 = '0'.repeat(64)),
      (q) => (q.candidate.manifestSHA256 = '0'.repeat(64)),
      (q) => (q.release.format = 'other'),
      (q) => (q.release.scope = 'other'),
      (q) => (q.release.dispatch.lane = 'next'),
      (q) => (q.release.dispatch.ref = 'refs/heads/other'),
      (q) => (q.release.physicalQualification = 'pass'),
      (q) => q.release.automaticRetries++,
      (q) => (q.release.priorProofInspected = false),
      (q) => (q.release.noUnclosedOwners = false),
      (q) => (q.release.evidence = []),
      (q) => q.release.evidence[0].artifactId++,
      (q) => (q.demo.sourceAssets[0].sha256 = '0'.repeat(64)),
      (q) => q.demo.sourceAssets[1].bytes++,
      (q) => q.demo.observationTimeoutMs++,
      (q) => q.demo.replayTimeoutMs++,
      (q) => q.rows[0].timeoutMs++,
      (q) => q.helperTimeoutMs++,
      (q) => q.demo.retries++,
      (q) => (q.demo.cpuThrottle = 4),
      (q) => (q.playwright = 'latest'),
    ]) {
      const q = reviewed(p);
      mutate(q);
      assert.throws(() => validateDemoPlan(q));
    }
  for (const mutate of [
    (q) => (q.demo.resourceCycles.cyclesPerMode = 9),
    (q) => (q.demo.resourceCycles.snapshotLimit = 65),
    (q) => (q.demo.resourceCycles.sourceRevision = '0'.repeat(40)),
    (q) => q.demo.arms.push('spectator-display'),
  ]) {
    const q = reviewed(plans[1]);
    mutate(q);
    assert.throws(() => validateDemoPlan(q));
  }
});
test('actual common dispatch keeps historical recovery unchanged and labels resource mode separately', () => {
  for (const [input, output] of [
    ['SoloHostedDemoRecoveryPlanV1', 'SoloHostedDemoRecoveryCohortV1'],
    ['SoloHostedDemoResourcePlanV1', 'SoloHostedDemoResourceCohortV1'],
  ]) {
    assert.equal(route({ format: input }), 'demo');
    assert.equal(report({ format: input }, 'demo'), output);
  }
  for (const [input, owner] of [
    ['SoloHostedDemoActivePlanV1', 'demo-active'],
    ['SoloHostedRasterPlanV1', 'raster'],
    ['SoloHostedAuxiliaryPlanV1', 'auxiliary'],
    ['SoloHostedDiagnosticsPlanV1', 'diagnostics'],
  ])
    assert.equal(route({ format: input }), owner);
  assert.equal(route({ format: 'SoloHostedDemoResourcePlanV2' }), null);
});
test('three actual source73 Git asset identities bind catalogue and both strict replay variants', () => {
  assert.equal(witness.sourceRevision, '73a345cec696d7789198cf295ca5c37b17ca0e71');
  assert.equal(witness.tree, 'ea30e68636b3342f8e60664a79d425e11e27ff1e');
  assert.equal(witness.assets.length, 3);
  for (const p of plans) {
    assert.deepEqual(p.demo.expectedClip, witness.expectedClip);
    assert.deepEqual(
      p.demo.sourceAssets,
      witness.assets.map(({ role, relative, bytes, sha256 }) => ({
        role,
        relative,
        bytes,
        sha256,
      })),
    );
  }
  for (const a of witness.assets) assert.match(a.blob, /^[a-f0-9]{40}$/);
});
test('changed driver bytes reject before display/browser effects', async () => {
  for (const p of plans) {
    let effects = 0;
    await assert.rejects(
      () =>
        prepareDemoMode({
          plan: reviewed(p),
          admitted: { artifacts: { candidate: {} } },
          repository: new URL('../', import.meta.url).pathname,
          evidence: '/never',
          digest: async (path) => {
            const b = await readFile(path);
            return { bytes: b.length, sha256: '0'.repeat(64) };
          },
          required: async () => effects++,
        }),
      { name: 'AssertionError' },
    );
    assert.equal(effects, 0);
  }
});
test('all declared observer source references are exact current candidate bytes', async () => {
  for (const p of plans)
    for (const ref of p.adapterInputs) {
      const b = await read(ref.path);
      assert.equal(b.length, ref.bytes);
      assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256);
    }
});
