import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import {
  bindCpuProfileJob,
  cpuProfileArguments,
  cpuProfileAssessment,
  cpuProfileMatrix,
  validateCpuProfilePlan,
  firstVictoryDe332ProfileOrigin,
} from './solo-remote-cpu-profile.mjs';
import {
  qualificationNextRouteOptions,
  FIRST_VICTORY_797E03_CPU_FIXTURE,
} from './solo-qualification-next-route.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const source = '797e03f28743921842df6aa57520a72016ba3dfc';
// Modeled parser control only; actual797 first-eight evidence remains null in the held plans.
const modeledProof = {
  format: 'SoloFirstEightCorrectnessEvidenceV1',
  sourceRevision: source,
  runId: 1,
  artifactId: 2,
  artifactSHA256: 'a'.repeat(64),
  summarySHA256: 'b'.repeat(64),
  correctness: 'passed',
  ownersClosed: true,
};

const manifest = JSON.parse(await read('docs/performance/solo-first-victory-cpu-797e03-plan.json'));
const bytes = await read(manifest.recipe.path),
  recipe = JSON.parse(bytes);
const reviewed = () => {
  const p = structuredClone(manifest);
  p.status = 'reviewed-diagnostic-only';
  p.release.firstEightAllCorrectnessPassed = true;
  p.release.firstEightEvidence = structuredClone(modeledProof);
  return p;
};
const plan = () => bindCpuProfileJob(reviewed());
const args = () =>
  cpuProfileArguments(
    { plan: plan(), here: '/tools/scripts', modeState: { recipePath: '/owned/scenario.json' } },
    'http://127.0.0.1:1/game/',
    '/owned',
  ).slice(4);
test('held797 HUD cannot execute by status alone or using source73 evidence', () => {
  assert.equal(manifest.release.firstEightEvidence, null);
  assert.throws(() => cpuProfileMatrix(manifest));
  const p = structuredClone(manifest);
  p.status = 'reviewed-diagnostic-only';
  assert.throws(() => cpuProfileMatrix(p));
  assert.deepEqual(cpuProfileMatrix(reviewed()).include, [
    {
      phase: 'first-victory-cpu-profile',
      engine: 'chromium',
      jobMinutes: 130,
      stepMinutes: 78,
      outerSeconds: 4620,
    },
  ]);
});
test('exact797 HUD keeps public first-victory actions, strict replay and excluded historical3.88 factor', async () => {
  const prior = JSON.parse(
    await read(
      'docs/performance/fixtures/solo-remote-sustained/first-victory-cpu-de332.qualification.fixture',
    ),
  );
  for (const key of Object.keys(prior))
    if (!['id', 'coverage', 'nativeRouteCpuProfile'].includes(key))
      assert.deepEqual(recipe[key], prior[key], key);
  assert.deepEqual({ bytes: bytes.length, sha256: sha(bytes) }, FIRST_VICTORY_797E03_CPU_FIXTURE);
  assert.deepEqual(qualificationNextRouteOptions(args(), recipe, bytes), {
    protocol: 'authored-next-geometric-v1',
    sourceRevision: source,
  });
  assert.deepEqual(plan().stressOrigin, firstVictoryDe332ProfileOrigin());
  assert.equal(plan().stressOrigin.newHostCalibration, false);
  assert.equal(plan().stressOrigin.predecessorPerformanceStatus, 'fail');
  assert.equal(plan().performanceExclusion, true);
  assert.equal(plan().rows[0].timeoutMs, 480000);
  assert.equal(plan().profile.maximumMs, 240000);
  assert.equal(plan().profile.maximumBytes, 64 * 1024 ** 2);
  for (const flags of [
    args().map((f) => (f === '--cpu=3.88' ? '--cpu=2.42' : f)),
    args().filter((f) => f !== '--hitch-journal'),
    args().concat('--memory-profile'),
    args().concat('--source-revision=' + source),
  ])
    assert.throws(() => qualificationNextRouteOptions(flags, recipe, bytes));
  assert.throws(() =>
    qualificationNextRouteOptions(args(), { ...recipe, timeoutMs: 240001 }, bytes),
  );
});
test('797 package/proof/profile/owner mutations remain invalid', () => {
  for (const mutate of [
    (p) => p.candidate.artifact++,
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => (p.sourceCohort = 'first-victory-de332-main8b-v1'),
    (p) => (p.release.firstEightEvidence = null),
    (p) =>
      (p.release.firstEightEvidence.sourceRevision = '73a345cec696d7789198cf295ca5c37b17ca0e71'),
    (p) => (p.release.firstEightEvidence.correctness = 'failed'),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.release.firstEightRequired = false),
    (p) => (p.release.firstEightAllCorrectnessPassed = false),
    (p) => (p.cpu = 2.42),
    (p) => p.recipe.bytes++,
    (p) => p.rows[0].timeoutMs++,
    (p) => p.profile.maximumMs++,
    (p) => (p.profile.heap = true),
    (p) => (p.performanceExclusion = false),
    (p) => p.automaticRetries++,
    (p) => (p.release.noUnclosedOwners = false),
    (p) => (p.release.dispatch.source = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4'),
    (p) => (p.stressOrigin.predecessorForcedCleanup = true),
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateCpuProfilePlan(p));
  }
});
test('actual797 CPU assessment retains original replay, source, profile and cleanup negatives', async () => {
  const text = (await read('scripts/test-solo-first-victory-cpu-de332.mjs')).toString(),
    ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const name =
    'actual assessment requires completed route, same-source replay, closed owners and retained profile';
  const call = ast.body.find(
    (n) =>
      n.type === 'ExpressionStatement' &&
      n.expression.callee?.name === 'test' &&
      n.expression.arguments[0]?.value === name,
  )?.expression;
  assert(call);
  const callback = new Function(
    'assert',
    'plan',
    'cpuProfileAssessment',
    'return (' + text.slice(call.arguments[1].start, call.arguments[1].end) + ');',
  )(assert, plan, cpuProfileAssessment);
  callback();
});
test('797 profile refs freeze current source and preserve prior declaration bytes', async () => {
  for (const ref of [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools]) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(sha(b), ref.sha256, ref.path);
  }
  const b = await read(manifest.priorDeclaration.path);
  assert.equal(b.length, manifest.priorDeclaration.bytes);
  assert.equal(sha(b), manifest.priorDeclaration.sha256);
});
