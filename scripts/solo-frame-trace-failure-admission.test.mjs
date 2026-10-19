import { createExecutedFrameReader } from './solo-frame-trace-executed-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';
import {
  bindCpuProfileJob,
  cpuProfileMatrix,
  validateCpuProfilePlan,
  prepareCpuProfileMode,
  cpuProfileAssessment,
} from './solo-remote-cpu-profile.mjs';
import { FRAME_TRACE_LIMITS } from './solo-qualification-cpu-profile.mjs';
import { verifiedMidCalibration } from './solo-remote-sustained.mjs';
import './test-solo-frame-trace-admission.mjs';
import './solo-frame-trace.test.mjs';
import './test-solo-remote-cpu-profile.mjs';
// Preserve executed/held v1 source assertions; the successor has separate current-source controls.
const read = createExecutedFrameReader((p) => readFile(new URL('../' + p, import.meta.url)));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const source = '9d5139b9983c700a6a708f65f379fa4d5a8b0395';
const planPath = 'docs/performance/solo-browser-frame-trace-9d-failure-plan.json';
const manifest = JSON.parse(await read(planPath));
const heldPath = 'docs/performance/solo-browser-frame-trace-warm-plan.json';
const heldBytes = await read(heldPath),
  held = JSON.parse(heldBytes);
const oldTestSource = (await read('scripts/test-solo-frame-trace-admission.mjs')).toString();
const oldTestAst = parse(oldTestSource, { ecmaVersion: 'latest', sourceType: 'module' });
const oldFunction = (name) => {
  const node = oldTestAst.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === name);
  assert(node, name);
  return oldTestSource.slice(node.start, node.end);
};
const oldControl = (title) => {
  const node = oldTestAst.body.find(
    (n) =>
      n.type === 'ExpressionStatement' &&
      n.expression.callee?.name === 'test' &&
      n.expression.arguments[0]?.value === title,
  );
  assert(node, title);
  const callback = node.expression.arguments.at(-1);
  return oldTestSource.slice(callback.start, callback.end);
};
const reviewed = () => structuredClone(manifest);
// Existing assessment fixture is explicitly modeled. Authority comes from the actual declaration.
const modeled = new Function(
  'bindCpuProfileJob',
  'reviewed',
  'FRAME_TRACE_LIMITS',
  'manifest',
  'source',
  'return (' + oldFunction('modeled') + ')',
)(bindCpuProfileJob, reviewed, FRAME_TRACE_LIMITS, manifest, source);
const assess = (x) => cpuProfileAssessment(x.plan, x.raw, x.command, x.readback, x.mode);

test('actual failure-investigation declaration is distinct and cannot release the held first-eight gate', () => {
  const bound = bindCpuProfileJob(manifest);
  assert.equal(cpuProfileMatrix(manifest).include.length, 1);
  assert.equal(bound.release.firstEightRequired, false);
  assert.equal(bound.release.firstEightAllCorrectnessPassed, false);
  assert.equal(bound.release.firstEightEvidence, null);
  assert.equal(bound.release.firstEightStatus, 'failed-one-of-eight');
  assert.equal(bound.release.failedFirstEightEvidence.correctnessPassed, 7);
  assert.equal(bound.release.failedFirstEightEvidence.correctnessFailed, 1);
  assert.equal(bound.release.failedFirstEightEvidence.closedOwners, 14);
  assert.equal(bound.release.failedFirstEightEvidence.nativeReplayPassed, 4);
  assert.equal(bound.release.failedFirstEightEvidence.nodePortabilityMismatches, 4);
  assert.equal(hash(heldBytes), '2da883907291c01706377bcff6bd326cc75e987065a0a6e16f2229e1b21470b0');
  assert(held.status.startsWith('held-'));
  assert.throws(() => bindCpuProfileJob(held));
  const relabeled = structuredClone(held);
  relabeled.status = 'reviewed-diagnostic-only';
  relabeled.release.status = 'reviewed';
  assert.throws(() => bindCpuProfileJob(relabeled));
  for (const key of [
    'candidate',
    'baseline',
    'profile',
    'recipe',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'rowEvidenceBytes',
    'evidenceBytes',
    'scenarioTimeoutMs',
    'calibrationTimeoutMs',
    'automaticRetries',
    'automaticPhaseContinuation',
    'maxParallel',
  ])
    assert.deepEqual(manifest[key], held[key], key);
  assert.equal(bound.rows[0].timeoutMs, 480000);
});

test('wrong failed-cohort authority, source, owner counts and widened workload are refused', () => {
  for (const mutate of [
    (p) => (p.sourceCohort = 'warm-frame-9d5139-failure'),
    (p) => (p.candidate.revision = '0'.repeat(40)),
    (p) => (p.candidate.inner.sha256 = '0'.repeat(64)),
    (p) => (p.release.firstEightRequired = true),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => (p.release.firstEightEvidence = {}),
    (p) => (p.release.firstEightStatus = 'passed'),
    (p) => p.release.failedFirstEightEvidence.runId++,
    (p) => p.release.failedFirstEightEvidence.attempt++,
    (p) => (p.release.failedFirstEightEvidence.artifact.sha256 = '0'.repeat(64)),
    (p) => (p.release.failedFirstEightEvidence.audit.sha256 = '0'.repeat(64)),
    (p) => (p.release.failedFirstEightEvidence.correctnessPassed = 8),
    (p) => (p.release.failedFirstEightEvidence.correctnessFailed = 0),
    (p) => (p.release.failedFirstEightEvidence.nativeReplayPassed = 3),
    (p) => (p.release.failedFirstEightEvidence.closedOwners = 13),
    (p) => (p.release.failedFirstEightEvidence.ownerAnomalies = 1),
    (p) => (p.release.failedFirstEightEvidence.failedCase = 'other'),
    (p) => (p.release.failedFirstEightEvidence.extra = true),
    (p) => p.profile.maximumMs++,
    (p) => p.profile.maximumBytes++,
    (p) => p.profile.bufferKiB++,
    (p) => p.scenarioTimeoutMs++,
    (p) => p.helperTimeoutMs++,
    (p) => p.automaticRetries++,
    (p) => (p.performanceExclusion = false),
  ]) {
    const plan = structuredClone(manifest);
    mutate(plan);
    assert.throws(() => bindCpuProfileJob(plan));
  }
});

test('existing complete replay, trace readback and owner adverse controls apply without first-eight credit', () => {
  const result = assess(modeled());
  assert.equal(result.status, 'passed');
  assert.equal(result.firstEightRequired, false);
  assert.equal(result.firstEightAllCorrectnessPassed, false);
  assert.equal(result.firstEightStatus, 'failed-one-of-eight');
  assert.equal(result.performanceQualification, 'excluded-browser-frame-tracing');
  const body = oldControl(
    'complete modeled trace retains diagnostic exclusion while failures cannot gain native credit',
  );
  new Function('assert', 'assess', 'modeled', 'return (' + body + ')()')(assert, assess, modeled);
});

test('actual preparation keeps fresh calibration and reports the failed prerequisite honestly', async () => {
  let body = oldControl(
    'actual preparation performs a fresh verified calibration inside the original owned limit',
  );
  const anchor = "  calibration.result.presets.mid.status = 'unverified';";
  assert.equal(body.split(anchor).length, 2);
  body = body.replace(
    anchor,
    "  assert.equal(ctx.report.firstEightRequired, false);\n  assert.equal(ctx.report.firstEightAllCorrectnessPassed, false);\n  assert.equal(ctx.report.firstEightStatus, 'failed-one-of-eight');\n" +
      anchor,
  );
  await new Function(
    'assert',
    'read',
    'parse',
    'manifest',
    'join',
    'verifiedMidCalibration',
    'bindCpuProfileJob',
    'reviewed',
    'validateCpuProfilePlan',
    'return (' + body + ')()',
  )(
    assert,
    read,
    parse,
    manifest,
    join,
    verifiedMidCalibration,
    bindCpuProfileJob,
    reviewed,
    validateCpuProfilePlan,
  );
});

test('current inputs stay strict and old held adapter pins cannot use historical admission in production', async () => {
  for (const ref of [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(hash(bytes), ref.sha256, ref.path);
  }
  const effects = [],
    plan = bindCpuProfileJob(manifest);
  plan.adapterInputs = structuredClone(held.adapterInputs);
  await assert.rejects(
    prepareCpuProfileMode({
      plan,
      repository: fileURLToPath(new URL('../', import.meta.url)),
      admitted: { status: 'passed' },
      digest: async (path) => {
        const b = await readFile(path);
        return { bytes: b.length, sha256: hash(b) };
      },
      required: async () => effects.push('native'),
    }),
  );
  assert.deepEqual(effects, []);
});

test('prior held witness rejects altered source authority while original validator bytes stay exact', async () => {
  const witnessPath = 'docs/performance/fixtures/solo-browser-frame-trace/83f-held-source.json',
    witness = await read(witnessPath);
  const make = (w, d) =>
    new Function('read', 'assert', 'hash', 'return (' + oldFunction('priorHeldFrameAdapter') + ')')(
      async (p) => (p === witnessPath ? w : p === heldPath ? d : read(p)),
      assert,
      hash,
    );
  assert.equal((await make(witness, heldBytes)()).path, 'scripts/solo-remote-cpu-profile.mjs');
  for (const [w, d] of [
    [Buffer.concat([witness, Buffer.from(' ')]), heldBytes],
    [witness, Buffer.concat([heldBytes, Buffer.from(' ')])],
    [Buffer.from(JSON.stringify({ ...JSON.parse(witness), revision: '0'.repeat(40) })), heldBytes],
  ])
    await assert.rejects(make(w, d)());
  const src = (await read('scripts/solo-remote-cpu-profile.mjs')).toString(),
    ast = parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const old = ast.body.find(
    (n) => n.type === 'FunctionDeclaration' && n.id.name === 'validateFrameTracePlan',
  );
  assert.equal(
    hash(src.slice(old.start, old.end)),
    '67c2a1aaad23ca499152b0982a28e64fe9aa7b0b5612b0de1bc336d5e16aef05',
  );
});

test('fixed trace lane selects only the named failure investigation with complete prior controls', async () => {
  const workflow = (await read('.github/workflows/solo-native-package-consumer.yml')).toString();
  const body = workflow.split('\n  hud-cpu:\n')[1].split(/\n  [a-z][a-z-]+:\n/)[0];
  assert(body.includes('bind-plan ' + planPath));
  assert(!body.includes('bind-plan ' + heldPath));
  assert(body.includes("'solo-linux-9d5139-frame-failure'"));
  const line = body.split('\n').find((l) => l.trim().startsWith('node --test '));
  assert(
    line.includes(
      'node --test --test-concurrency=2 scripts/solo-frame-trace-failure-admission.test.mjs ',
    ),
  );
  const args = line.trim().split(/\s+/),
    first = args.findIndex((a) => a.endsWith('.mjs'));
  assert(!args.slice(first).some((a) => a.startsWith('--test')));
  for (const file of [
    'scripts/test-solo-frame-trace-admission.mjs',
    'scripts/solo-frame-trace.test.mjs',
    'scripts/test-solo-remote-cpu-profile.mjs',
  ])
    assert(!args.includes(file), 'complete file imported once by new entry');
  const paths = [...body.matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
  for (const file of [
    planPath,
    'scripts/solo-frame-trace-failure-admission.test.mjs',
    'docs/performance/fixtures/solo-browser-frame-trace/83f-held-source.json',
    heldPath,
  ])
    assert(paths.includes(file), file);
  for (const literal of [
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
  ])
    assert(body.includes(literal));
  assert.equal((body.match(/if: \$\{\{ always\(\) \}\}/g) ?? []).length, 2);
});
