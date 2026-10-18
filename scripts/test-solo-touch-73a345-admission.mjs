import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import {
  TOUCH_SOURCE,
  TOUCH_RUNTIME73_SOURCE,
  TOUCH_RUNTIME73_COHORT,
  TOUCH_PROTOCOL,
  TOUCH_JOBS,
  touchSource,
  touchCase,
  touchMatrix,
  bindTouchJob,
  validateTouchPlan,
  touchAssessment,
  touchLatency,
} from './solo-remote-touch.mjs';
import { assertTouchExecutionSource } from './observe-solo-native-touch.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { quantileBound } from './solo-qualification.mjs';
import { calibrateSettledCadence } from './solo-qualification-cadence.mjs';

const manifest = JSON.parse(
  await readFile(
    new URL('../docs/performance/solo-native-touch-73a345-plan.json', import.meta.url),
  ),
);
const reviewed = () => ({ ...structuredClone(manifest), status: 'reviewed-input-diagnostic-only' });
const priorTest = await readFile(new URL('./test-solo-remote-touch.mjs', import.meta.url), 'utf8');
const node = parse(priorTest, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
  (entry) => entry.type === 'FunctionDeclaration' && entry.id.name === 'rawTouch',
);
assert(node);
// Run the existing full raw-evidence fixture in this realm with only its explicit
// candidate/source inputs replaced. It does not launch a browser or emit input.
const rawTouch = new Function(
  'touchCase',
  'calibrateSettledCadence',
  'TOUCH_SOURCE',
  'candidate',
  'PUBLIC_SECURITY_HEADERS',
  'touchLatency',
  'quantileBound',
  `return (${priorTest.slice(node.start, node.end)});`,
)(
  touchCase,
  calibrateSettledCadence,
  TOUCH_RUNTIME73_SOURCE,
  manifest.candidate,
  PUBLIC_SECURITY_HEADERS,
  touchLatency,
  quantileBound,
);
const command = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] };

test('prospective touch references match actual candidate tools and unchanged native fixture', async () => {
  const refs = [manifest.fixture, ...manifest.adapterInputs, ...manifest.frozenTools];
  assert.equal(new Set(refs.map((ref) => ref.path)).size, refs.length);
  for (const ref of refs) {
    const bytes = await readFile(new URL('../' + ref.path, import.meta.url));
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), ref.sha256, ref.path);
  }
});

test('held exact source73 touch declaration keeps all twelve native workloads and original bounds', () => {
  assert.throws(() =>
    touchMatrix({
      ...structuredClone(manifest),
      status: 'held-awaiting-source-and-dispatch-review',
    }),
  );
  assert.equal(manifest.status, 'reviewed-input-diagnostic-only');
  assert.equal(manifest.currentSourceCorrectness.status, 'passed-correctness-only');
  assert.equal(
    manifest.currentSourceCorrectness.receipt.path,
    'docs/performance/fixtures/solo-73a345-consumer/first-eight-39105055762.json',
  );
  const selected = reviewed();
  assert.equal(selected.sourceCohort, TOUCH_RUNTIME73_COHORT);
  assert.deepEqual(touchSource(), TOUCH_SOURCE);
  assert.deepEqual(touchSource(TOUCH_RUNTIME73_COHORT), TOUCH_RUNTIME73_SOURCE);
  assert.throws(() => touchSource('arbitrary'));
  assert.equal(touchMatrix(selected).include.length, 4);
  const rows = TOUCH_JOBS.flatMap((job) => bindTouchJob(selected, job).rows);
  assert.equal(rows.length, 12);
  assert.equal(new Set(rows.map((row) => row.id)).size, 12);
  assert(rows.every((row) => row.timeoutMs === 480000));
  assert.deepEqual(selected.protocol, TOUCH_PROTOCOL);
  assert.equal(TOUCH_PROTOCOL.observationTimeoutMs, 240000);
  assert.equal(TOUCH_PROTOCOL.replayTimeoutMs, 120000);
  assert.equal(TOUCH_PROTOCOL.eventCapacity, 64);
  assert.equal(TOUCH_PROTOCOL.directionChanges, 24);
  assert.throws(() => touchCase('webkit-swipe', 1));
  assert.throws(() => touchCase('chromium-dpad', 4));
});

test('exact package, source, physical exclusions and all touch limits remain mandatory', () => {
  for (const mutate of [
    (m) => m.candidate.artifact++,
    (m) => m.candidate.run++,
    (m) => m.candidate.outer.bytes++,
    (m) => (m.candidate.inner.sha256 = '0'.repeat(64)),
    (m) => (m.candidate.tree = '0'.repeat(40)),
    (m) => (m.candidate.manifestSHA256 = '0'.repeat(64)),
    (m) => (m.runtimeRevision = '0'.repeat(40)),
    (m) => (m.sourceCohort = undefined),
    (m) => (m.sourceCohort = 'arbitrary'),
    (m) => m.protocol.directionChanges++,
    (m) => m.protocol.eventCapacity++,
    (m) => m.protocol.observationTimeoutMs++,
    (m) => m.protocol.replayTimeoutMs++,
    (m) => (m.protocol.syntheticDOMEvents = true),
    (m) => (m.cpu = 4),
    (m) => m.helperTimeoutMs++,
    (m) => m.automaticRetries++,
    (m) => (m.release.dispatch.lane = 'next'),
    (m) => (m.release.physicalQualification = 'passed'),
    (m) => (m.performanceExclusion = false),
  ]) {
    const changed = reviewed();
    mutate(changed);
    assert.throws(() => bindTouchJob(changed, 'chromium-dpad'));
  }
  const plan = bindTouchJob(reviewed(), 'chromium-dpad');
  plan.rows[0].timeoutMs++;
  assert.throws(() => validateTouchPlan(plan));
});

test('observer validates the explicit source selection before launch and preserves legacy default', () => {
  const execution = {
    format: 'SoloHostedTouchExecutionV1',
    sourceCohort: TOUCH_RUNTIME73_COHORT,
    protocol: TOUCH_PROTOCOL,
    job: touchCase('chromium-dpad', 1),
    artifact: {
      sourceRevision: TOUCH_RUNTIME73_SOURCE.revision,
      sourceTree: TOUCH_RUNTIME73_SOURCE.tree,
      buildInfoSHA256: '1'.repeat(64),
    },
  };
  assert.equal(assertTouchExecutionSource(execution), execution.job);
  for (const mutate of [
    (p) => delete p.sourceCohort,
    (p) => (p.sourceCohort = 'unknown'),
    (p) => (p.artifact.sourceRevision = TOUCH_SOURCE.revision),
    (p) => (p.artifact.sourceTree = TOUCH_SOURCE.tree),
    (p) => p.protocol.directionChanges++,
    (p) => p.job.context.deviceScaleFactor++,
  ]) {
    const changed = structuredClone(execution);
    mutate(changed);
    assert.throws(() => assertTouchExecutionSource(changed));
  }
  const legacy = structuredClone(execution);
  delete legacy.sourceCohort;
  legacy.artifact.sourceRevision = TOUCH_SOURCE.revision;
  legacy.artifact.sourceTree = TOUCH_SOURCE.tree;
  assert.equal(assertTouchExecutionSource(legacy), legacy.job);
});

test('source73 independent readback still requires native trusted input, exact replay, source and closed owners', async () => {
  for (const job of TOUCH_JOBS) {
    const plan = bindTouchJob(reviewed(), job);
    const [engine, mode] = job.split('-');
    const raw = rawTouch(mode, engine);
    assert.equal((await touchAssessment(plan, plan.rows[0], raw, command)).status, 'passed');
    for (const mutate of [
      (r) => (r.buildIdentity.sourceRevision = TOUCH_SOURCE.revision),
      (r) => (r.artifact.sourceTree = TOUCH_SOURCE.tree),
      (r) => (r.artifact.archiveIdentity.sha256 = '0'.repeat(64)),
      (r) => (r.nativeCapability.syntheticDOMEvents = true),
      (r) => (r.nativeInput.events[0].isTrusted = false),
      (r) => (r.nativeInput.events[0].pointerType = 'mouse'),
      (r) => (r.nativeInput.dropped = 1),
      (r) => r.nativeInput.events.pop(),
      (r) => (r.movement[0].after.visible = false),
      (r) => (r.nativeReplay.observation.match = false),
      (r) => (r.nativeReplay.modules[0].status = 404),
      (r) => (r.observedBrowserClosed = false),
      (r) => (r.deadlineReached = true),
      (r) => (r.failure = 'retained original failure'),
    ]) {
      const changed = structuredClone(raw);
      mutate(changed);
      assert.equal((await touchAssessment(plan, plan.rows[0], changed, command)).status, 'failed');
    }
    for (const changed of [
      { ...command, forcedCleanup: true },
      { ...command, survivors: [{ pid: 1 }] },
      { ...command, ambiguous: [{ pid: 1 }] },
    ])
      assert.equal((await touchAssessment(plan, plan.rows[0], raw, changed)).status, 'failed');
    const slow = structuredClone(raw);
    slow.application.inputLatency.byKind.touch.toRender.maxMs = 100;
    slow.application.inputLatency.byKind.touch.toRender.histogram = [
      0,
      0,
      0,
      slow.nativeInput.events.length,
    ];
    Object.assign(slow, touchLatency(slow, quantileBound));
    const failed = await touchAssessment(plan, plan.rows[0], slow, { ...command, exitCode: 2 });
    assert.equal(failed.nativeInputCorrectness, 'pass');
    assert.equal(failed.status, 'failed');
    assert.equal(failed.performanceQualification, 'excluded');
    assert.equal(failed.physicalQualification, 'unobserved');
  }
});
