import {
  readDeclaredPreHeapTool,
  PRE_HEAP_TOOLING_WITNESS,
  preHeapTraceWorkflow,
} from './solo-readiness-rejoin-declared-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from '../publishing/vendor/acorn-8.18.0.mjs';
import {
  bindCpuProfileJob,
  cpuProfileArguments,
  cpuProfileAssessment,
  prepareCpuProfileMode,
  readFrameTraceEvidence,
} from './solo-remote-cpu-profile.mjs';
import {
  qualificationFrameTraceOptions,
  frameTraceCategories,
  FRAME_TASK_TRACE_PROTOCOL,
  FRAME_TASK_TRACE_CATEGORIES,
  FRAME_TRACE_CATEGORIES,
  FRAME_TRACE_LIMITS,
} from './solo-qualification-cpu-profile.mjs';
import { createExecutedFrameReader } from './solo-frame-trace-executed-source.mjs';
import {
  setupFrameTraceFixture as setup,
  finishFrameTraceFixture as finish,
  frameTraceBytes as trace,
} from './solo-frame-trace.test.mjs';
import './solo-frame-trace-failure-admission.test.mjs';

const read = (p) => readFile(new URL('../' + p, import.meta.url));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const path = 'docs/performance/solo-browser-frame-trace-9d-tasks-plan.json';
const manifest = JSON.parse(await read(path));
const prior = JSON.parse(
  await read('docs/performance/solo-browser-frame-trace-9d-failure-plan.json'),
);
const protocol = 'warm-first3-tasks-v2';
const categories = [
  'toplevel',
  'devtools.timeline',
  'disabled-by-default-devtools.timeline',
  'disabled-by-default-devtools.timeline.frame',
  'blink.user_timing',
];
const recipe = await read(manifest.recipe.path);

test('named task/frame successor retains the exact runtime, caps and both failed predecessors', () => {
  const p = bindCpuProfileJob(manifest);
  assert.equal(p.sourceCohort, 'warm-frame-9d5139-tasks-investigation-v2');
  assert.equal(p.release.scope, 'independent-incomplete-trace-investigation');
  for (const key of [
    'candidate',
    'baseline',
    'profile',
    'recipe',
    'node',
    'playwright',
    'cpu',
    'calibrationTimeoutMs',
    'scenarioTimeoutMs',
    'setupTimeoutMs',
    'helperTimeoutMs',
    'evidenceBytes',
    'rowEvidenceBytes',
    'maxParallel',
    'automaticRetries',
    'automaticPhaseContinuation',
  ])
    assert.deepEqual(p[key], prior[key], key);
  assert.deepEqual(p.release.failedFirstEightEvidence, prior.release.failedFirstEightEvidence);
  assert.equal(p.release.firstEightRequired, false);
  assert.equal(p.release.firstEightAllCorrectnessPassed, false);
  assert.equal(p.release.firstEightEvidence, null);
  assert.equal(p.release.failedFrameTraceEvidence.runId, 39142189874);
  assert.equal(p.release.failedFrameTraceEvidence.trace.dataLossOccurred, true);
  assert.equal(p.release.failedFrameTraceEvidence.trace.endAnchorRetained, false);
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].timeoutMs, 480000);
  assert.equal(p.performanceExclusion, true);
  assert.deepEqual(p.diagnostic.trace.categories, categories);
  assert.match(p.diagnostic.limitations.join(' '), /not a measurement of v2 byte cost/);
});

test('unknown protocols, broad categories, altered failure receipts and widened budgets fail admission', () => {
  for (const mutate of [
    (p) => (p.sourceCohort += '-other'),
    (p) => (p.diagnostic.protocol = 'warm-first3-v1'),
    (p) => p.diagnostic.trace.categories.push('cc'),
    (p) => p.diagnostic.trace.categories.reverse(),
    (p) => p.diagnostic.trace.maximumMs++,
    (p) => p.diagnostic.trace.maximumBytes++,
    (p) => p.diagnostic.trace.bufferKiB++,
    (p) => p.profile.maximumMs++,
    (p) => p.profile.maximumBytes++,
    (p) => p.profile.bufferKiB++,
    (p) => (p.release.failedFrameTraceEvidence.trace.dataLossOccurred = false),
    (p) => (p.release.failedFrameTraceEvidence.audit.sha256 = '0'.repeat(64)),
    (p) => p.release.failedFrameTraceEvidence.artifact.id++,
    (p) => (p.release.failedFirstEightEvidence.correctnessFailed = 0),
    (p) => (p.release.firstEightAllCorrectnessPassed = true),
    (p) => p.automaticRetries++,
    (p) => (p.performanceExclusion = false),
  ]) {
    const p = structuredClone(manifest);
    mutate(p);
    assert.throws(() => bindCpuProfileJob(p));
  }
});

test('new CLI selection is exact and keeps ordinary and v1 defaults', () => {
  const flags = ['--frame-trace=' + protocol, '--work-probe', '--cadence=settled120'];
  assert.equal(qualificationFrameTraceOptions(flags, 'chromium', recipe).protocol, protocol);
  assert.equal(qualificationFrameTraceOptions([], 'webkit', recipe), null);
  assert.deepEqual(frameTraceCategories(), FRAME_TRACE_CATEGORIES);
  assert.deepEqual(frameTraceCategories(protocol), categories);
  assert.deepEqual(FRAME_TASK_TRACE_CATEGORIES, categories);
  assert.equal(FRAME_TASK_TRACE_PROTOCOL, protocol);
  for (const changed of [
    flags.concat('--frame-trace=warm-first3-v1'),
    flags.concat('--cpu-profile'),
    flags.concat('--memory-profile'),
    flags.concat('--audio-proof'),
    flags.map((f) => (f.includes(protocol) ? '--frame-trace=tasks' : f)),
  ])
    assert.throws(() => qualificationFrameTraceOptions(changed, 'chromium', recipe));
  assert.throws(() => qualificationFrameTraceOptions(flags, 'webkit', recipe));
  assert.throws(() => frameTraceCategories('other'));
});

test('actual recorder requests only the five named categories with the original bounds', async (t) => {
  const x = await setup(t, { protocol, categories });
  await x.owner.start();
  const request = x.calls.find(([name]) => name === 'Tracing.start')[1];
  assert.deepEqual(request, {
    transferMode: 'ReturnAsStream',
    streamFormat: 'json',
    streamCompression: 'none',
    bufferUsageReportingInterval: 1000,
    traceConfig: {
      recordMode: 'recordUntilFull',
      traceBufferSizeInKb: 8192,
      enableSampling: false,
      enableSystrace: false,
      includedCategories: categories,
      excludedCategories: ['*'],
    },
  });
  const r = await finish(x);
  assert.equal(r.status, 'retained');
  assert.equal(r.protocol, protocol);
  assert.deepEqual(r.categories, categories);
  assert.match(r.categoryCoverage, /Reduced coverage is not a guarantee/);
  assert.equal(r.dataLossOccurred, false);
  assert.equal(r.streamEOF, true);
  assert.equal(r.streamClosed, true);
  assert.equal(r.cdpDetached, true);
  assert.equal(r.maximumMs, 30000);
  assert.equal(r.maximumBytes, 67108864);
  assert.deepEqual(await readFile(x.file), trace());
});

test('missing task categories fail without fallback even though broad graphics categories are unnecessary', async (t) => {
  const x = await setup(t, { protocol, categories: categories.slice(1) });
  await assert.rejects(x.owner.start(), /Required trace category/);
  await x.owner.finish();
  assert(!x.calls.some(([name]) => name === 'Tracing.start'));
});

test('v2 still refuses data loss, a missing raw anchor, a full buffer and unsuccessful cleanup', async (t) => {
  for (const options of [
    { loss: true },
    { bytes: trace(JSON.parse(trace()).traceEvents.slice(0, 1)) },
    { closeError: true },
    { detachError: true },
    { bufferFull: true },
  ]) {
    const x = await setup(t, { protocol, ...options });
    await x.owner.start();
    if (options.bufferFull) x.cdp.emit('Tracing.bufferUsage', { percentFull: 1 });
    assert.equal((await finish(x)).status, 'incomplete');
  }
});

test('v2 readback verifies bytes and category identity and rejects a relabeled v1 record', async (t) => {
  const x = await setup(t, { protocol });
  await x.owner.start();
  const r = await finish(x);
  assert.equal((await readFrameTraceEvidence(x.file, r)).inspectionVerified, true);
  for (const mutate of [
    (r) => (r.protocol = 'warm-first3-v1'),
    (r) => (r.protocol = 'other'),
    (r) => r.categories.push('gpu'),
    (r) => (r.sha256 = '0'.repeat(64)),
    (r) => r.anchors.end.timeOrigin++,
  ]) {
    const bad = structuredClone(r);
    mutate(bad);
    await assert.rejects(readFrameTraceEvidence(x.file, bad));
  }
});

const modelText = (await read('scripts/test-solo-frame-trace-admission.mjs')).toString();
const modelAst = parse(modelText, { ecmaVersion: 'latest', sourceType: 'module' });
const modelNode = modelAst.body.find(
  (n) => n.type === 'FunctionDeclaration' && n.id.name === 'modeled',
);
const model = new Function(
  'bindCpuProfileJob',
  'reviewed',
  'FRAME_TRACE_LIMITS',
  'manifest',
  'source',
  'return (' + modelText.slice(modelNode.start, modelNode.end) + ')',
)(
  bindCpuProfileJob,
  () => structuredClone(manifest),
  FRAME_TRACE_LIMITS,
  manifest,
  manifest.runtimeRevision,
);
const modeled = () => {
  const x = model();
  x.raw.frameTrace.protocol = protocol;
  x.raw.frameTrace.categories = categories;
  return x;
};
test('actual driver forwards v2 and assessment never promotes v1 or incomplete evidence', () => {
  const x = modeled();
  x.mode.recipePath = '/owned/recipe.json';
  const args = cpuProfileArguments(
    { plan: x.plan, modeState: x.mode, here: '/tools' },
    'http://127.0.0.1:1/game/?journey=opening',
    '/evidence',
  );
  assert.equal(args.at(-1), '--frame-trace=' + protocol);
  const assess = (x) => cpuProfileAssessment(x.plan, x.raw, x.command, x.readback, x.mode);
  assert.equal(assess(x).status, 'passed');
  assert.equal(assess(x).firstEightAllCorrectnessPassed, false);
  assert.equal(assess(x).performanceQualification, 'excluded-browser-frame-tracing');
  for (const mutate of [
    (x) => (x.raw.frameTrace.protocol = 'warm-first3-v1'),
    (x) => (x.raw.frameTrace.dataLossOccurred = true),
    (x) => (x.raw.frameTrace.streamEOF = false),
    (x) => (x.raw.frameTrace.streamClosed = false),
    (x) => (x.raw.frameTrace.cdpDetached = false),
    (x) => (x.raw.frameTrace.status = 'incomplete'),
    (x) => (x.raw.frameTrace.bufferFull = true),
    (x) => (x.readback.inspectionVerified = false),
    (x) => (x.raw.performanceGateStatus = 'pass'),
  ]) {
    const bad = modeled();
    mutate(bad);
    assert.equal(assess(bad).status, 'failed');
  }
});

test('every frozen v2 input is exact and historical adapter pins cannot start native work', async () => {
  for (const ref of [manifest.recipe, ...manifest.adapterInputs, ...manifest.frozenTools]) {
    const b = (await readDeclaredPreHeapTool(path, ref)) ?? (await read(ref.path));
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(hash(b), ref.sha256, ref.path);
  }
  const p = bindCpuProfileJob(manifest),
    effects = [];
  p.adapterInputs = structuredClone(prior.adapterInputs);
  await assert.rejects(
    prepareCpuProfileMode({
      plan: p,
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

test('historical source adapter is test-only and refuses an altered witness', async () => {
  const witnessPath =
    'docs/performance/fixtures/solo-browser-frame-trace/fd787-executed-source.json';
  const valid = await read(witnessPath),
    reader = createExecutedFrameReader(read);
  assert.equal(
    hash(await reader('scripts/solo-qualification-cpu-profile.mjs')),
    'b47327db20a192d12ba09053ed9726d67811d544b9b2b9a32957a70a14df1658',
  );
  for (const bytes of [
    Buffer.concat([valid, Buffer.from(' ')]),
    Buffer.from(JSON.stringify({ ...JSON.parse(valid), revision: '0'.repeat(40) })),
  ]) {
    const altered = createExecutedFrameReader((p) => (p === witnessPath ? bytes : read(p)));
    await assert.rejects(altered('scripts/solo-qualification-cpu-profile.mjs'));
  }
  for (const path of ['scripts/solo-remote-cpu-profile.mjs', 'scripts/qualify-solo-runtime.mjs'])
    assert(!(await read(path)).toString().includes('createExecutedFrameReader'));
});

test('frozen pre-heap lane selected v2 with complete controls and unchanged owner limits', async () => {
  const workflow = preHeapTraceWorkflow(
    await read(PRE_HEAP_TOOLING_WITNESS),
    path,
    await read(path),
  ).toString();
  const body = workflow.split('\n  hud-cpu:\n')[1].split(/\n  [a-z][a-z-]+:\n/)[0];
  assert(body.includes('bind-plan ' + path));
  assert(
    !body.includes('bind-plan docs/performance/solo-browser-frame-trace-9d-failure-plan.json'),
  );
  assert(body.includes("'solo-linux-9d5139-frame-tasks-v2'"));
  assert(
    body.includes(
      'node --test --test-concurrency=2 scripts/solo-frame-trace-tasks-admission.test.mjs ',
    ),
  );
  for (const value of [
    'timeout-minutes: 130',
    'timeout-minutes: 78',
    '4620s node scripts/run-solo-remote-correctness.mjs',
  ])
    assert(body.includes(value));
  for (const p of [
    path,
    'scripts/solo-frame-trace-tasks-admission.test.mjs',
    'scripts/solo-frame-trace-executed-source.mjs',
    'docs/performance/fixtures/solo-browser-frame-trace/fd787-executed-source.json',
  ])
    assert(body.includes('            /' + p));
  const qualifier = (await read('scripts/qualify-solo-runtime.mjs')).toString();
  assert.match(
    qualifier,
    /createQualificationFrameTrace\(cdp, \{\s*protocol: frameTraceOptions\.protocol,/,
  );
  assert(!body.includes('continue-on-error'));
});
