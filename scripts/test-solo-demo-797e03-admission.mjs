import { readDeclaredDemoCloseTool } from './solo-demo-close-declared-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { validateDemoPlan, prepareDemoMode, DEMO_ARMS } from './solo-remote-demo.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));

// Test-only original source witness. Production admission always hashes current bytes.
const historyPath = 'docs/performance/fixtures/solo-demo-797e03/ee9-observer-source.json';
function originalObserver(bytes) {
  assert.equal(bytes.length, 39865);
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '2061dcc83c49d0157691f3dacece73c47da0d70ae37b27d2e27f40c93c2c9605',
  );
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'SoloDemoObserverHistoricalSourceV1');
  assert.equal(value.revision, 'ee9ece54bc9f484bc4179a20f8fd915d7933680b');
  assert.equal(value.tree, 'a449f7425a95ef867dd0b695f819d9e2c9a1cef2');
  const original = Buffer.from(value.observerSource);
  const ref = value.records.find((item) => item.path === 'scripts/observe-solo-demo-recovery.mjs');
  assert.equal(original.length, ref.bytes);
  assert.equal(createHash('sha256').update(original).digest('hex'), ref.sha256);
  assert.equal(
    createHash('sha1')
      .update(Buffer.from('blob ' + original.length + '\0'))
      .update(original)
      .digest('hex'),
    ref.blob,
  );
  return { source: original, records: value.records };
}
const historyBytes = await read(historyPath);
const original = originalObserver(historyBytes);
function assertHistoricalDeclaration(path, bytes) {
  const ref = original.records.find((item) => item.path === path);
  assert(ref, path);
  assert.equal(bytes.length, ref.bytes, path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, path);
  assert.equal(
    createHash('sha1')
      .update(Buffer.from('blob ' + bytes.length + '\0'))
      .update(bytes)
      .digest('hex'),
    ref.blob,
    path,
  );
}

const plans = await Promise.all(
  ['recovery', 'resources'].map(async (mode) => {
    const path = 'docs/performance/solo-demo-' + mode + '-797e03-plan.json';
    const bytes = await read(path);
    assertHistoricalDeclaration(path, bytes);
    return JSON.parse(bytes);
  }),
);
// Scoped correctness only; raw numerical and portability failures remain retained.
const firstEightOutcome = JSON.parse(
  await read('docs/performance/fixtures/solo-797e03-consumer/first-eight-39109911286.json'),
);
const verifiedFirstEight = firstEightOutcome.proof;
const reviewed = (plan) => structuredClone(plan);
const witness = JSON.parse(
  await read('docs/performance/fixtures/solo-demo-797e03/source-assets.json'),
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
test('both797 Demo declarations bind actual correctness proof and remain independent with original budgets', () => {
  for (const p of plans) {
    assert.deepEqual(p.release.firstEightEvidence, verifiedFirstEight);
    assert.equal(
      p.release.firstEightNumericalFailuresRetained,
      firstEightOutcome.rawNumericalFailuresRetained,
    );
    assert.equal(
      p.release.nodePortabilityMismatchesRetained,
      firstEightOutcome.nodePortabilityMismatchesRetained,
    );
    assert.equal(p.status, 'pinned-for-execution');
    assert.equal(p.release.status, 'reviewed');
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
      (q) => (q.release.firstEightRequired = false),
      (q) =>
        (q.release.firstEightEvidence.sourceRevision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
      (q) => (q.release.firstEightEvidence.unreviewed = true),
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
test('three actual source797 Git asset identities bind catalogue and both strict replay variants', () => {
  assert.equal(witness.sourceRevision, '797e03f28743921842df6aa57520a72016ba3dfc');
  assert.equal(witness.tree, 'bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5');
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
  for (const a of witness.assets) {
    assert.match(a.blob, /^[a-f0-9]{40}$/);
    assert.equal(a.previousBlob, a.blob);
  }
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
test('historical declarations retain exact original observer and immutable tool bytes', async () => {
  for (const [index, p] of plans.entries())
    for (const ref of p.adapterInputs) {
      const b =
        ref.path === 'scripts/observe-solo-demo-recovery.mjs'
          ? original.source
          : ((await readDeclaredDemoCloseTool(
              'docs/performance/solo-demo-' +
                (index ? 'resources' : 'recovery') +
                '-797e03-plan.json',
              ref,
            )) ?? (await read(ref.path)));
      assert.equal(b.length, ref.bytes);
      assert.equal(createHash('sha256').update(b).digest('hex'), ref.sha256);
    }
});
test('historical witness and declaration mutations cannot supply current-tool authority', async () => {
  const changed = Buffer.from(historyBytes);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => originalObserver(changed));
  for (const mode of ['recovery', 'resources']) {
    const path = 'docs/performance/solo-demo-' + mode + '-797e03-plan.json';
    const changedPlan = JSON.parse(await read(path));
    changedPlan.demo.driver.sha256 = '0'.repeat(64);
    assert.throws(() =>
      assertHistoricalDeclaration(path, Buffer.from(JSON.stringify(changedPlan))),
    );
  }
});
