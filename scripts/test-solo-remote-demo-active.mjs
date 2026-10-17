import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { validateDemoActivePlan, demoActiveAssessment } from './solo-remote-demo-active.mjs';
import { requiredTaskMetrics, taskMetricDeltas } from './solo-demo-active-observer.mjs';
const draft = JSON.parse(
  await readFile(new URL('../docs/performance/solo-remote-demo-active-plan.json', import.meta.url)),
);
const version = '151.0.7922.34';
const casePlan = {
  sourceRevision: 'a'.repeat(40),
  artifactArchiveSha256: 'b'.repeat(64),
  driverSha256: 'c'.repeat(64),
};
const closed = {
  status: 'closed',
  exitCode: 0,
  cleanupUnconfirmed: false,
  forcedCleanup: false,
  survivors: [],
  ambiguous: [],
};
const raw = () => ({
  format: 'SoloHostedDemoScopedRafWorkV1',
  status: 'pass-scoped-observation',
  ...casePlan,
  browserVersion: version,
  observedBrowserClosed: true,
  observationSettled: true,
  ownedProcess: { exitCode: 0 },
  prefixProof: { status: 'pass', rows: [{ match: true }, { match: true }] },
  nativeReplay: { status: 'pass', browserVersion: version, ownedBrowserClosed: true },
  aggregate: { valid: true, phaserFrames: 2, demoFrames: 2 },
  rawWindow: { startedAtMs: 10, endedAtMs: 30010 },
  before: { run: { tick: 10 } },
  windowStop: { tickAtStop: 3600 },
  errors: [],
  failedRequests: [],
  fullApplicationCostGateStatus: 'unobserved-timer-and-messagechannel-wake-work-not-timed',
  instrumentationOverheadStatus: 'unqualified',
  scopedRafGates: { status: 'pass-scoped-raf-only' },
});
const bound = () => {
  const p = structuredClone(draft);
  p.status = 'pinned-for-execution';
  p.candidate = {
    revision: casePlan.sourceRevision,
    tree: 'd'.repeat(40),
    run: 1,
    artifact: 2,
    outer: { bytes: 100, sha256: 'e'.repeat(64) },
    inner: { bytes: 80, sha256: 'f'.repeat(64) },
    manifestSHA256: '0'.repeat(64),
  };
  p.release = {
    status: 'reviewed',
    candidateRevision: p.candidate.revision,
    latestFirst8Passed: true,
    affectedDemoCorrectnessClosed: true,
    noConcurrentJobLocalWork: true,
  };
  return p;
};
test('pending artifact/release cannot execute and all three fixed independent rows are required', () => {
  assert.throws(() => validateDemoActivePlan(draft));
  validateDemoActivePlan(bound());
  for (const mutate of [
    (p) => p.rows.pop(),
    (p) => p.rows[1].timeoutMs++,
    (p) => p.demo.watchingMs++,
    (p) => p.demo.deadlineSeconds++,
    (p) => p.demo.cpuThrottle++,
    (p) => (p.release.latestFirst8Passed = false),
    (p) => (p.release.affectedDemoCorrectnessClosed = false),
    (p) => (p.demo.viewport.dpr = 3),
  ]) {
    const p = bound();
    mutate(p);
    assert.throws(() => validateDemoActivePlan(p));
  }
});
test('clean scoped success never becomes full application cost or old contamination replacement credit', () => {
  const result = demoActiveAssessment(raw(), closed, casePlan, version);
  assert.equal(result.status, 'passed');
  assert.equal(result.qualification, 'scoped-rAF-work-and-cadence-only');
  assert.equal(result.fullApplicationCost, 'unobserved');
  assert.equal(result.historicalReplacementCredit, false);
});
test('every nonpassing numerical result remains failed with separate correctness', () => {
  for (const status of ['fail', 'review-required', 'inconclusive', 'unobserved']) {
    const r = raw();
    r.scopedRafGates.status = status;
    const result = demoActiveAssessment(r, closed, casePlan, version);
    assert.equal(result.status, 'failed');
    assert.equal(result.correctness, 'pass');
    assert.equal(result.rawScopedRafGateStatus, status);
  }
});
test('native owner, deadline, incomplete replay and source mismatch cannot pass', () => {
  for (const mutate of [
    (r) => (r.observedBrowserClosed = false),
    (r) => (r.ownedProcess.exitSignal = 'SIGTERM'),
    (r) => (r.observationSettled = false),
    (r) => (r.deadlineReached = true),
    (r) => (r.sourceRevision = 'e'.repeat(40)),
    (r) => (r.artifactArchiveSha256 = 'f'.repeat(64)),
    (r) => (r.nativeReplay.ownedBrowserClosed = false),
    (r) => (r.nativeReplay.browserVersion = 'different'),
    (r) => (r.prefixProof.rows[1].match = false),
    (r) => (r.aggregate.demoFrames = 0),
    (r) => (r.rawWindow.endedAtMs = 29999),
    (r) => r.errors.push('error'),
    (r) => r.failedRequests.push({ failure: 'failed' }),
  ]) {
    const r = raw();
    mutate(r);
    assert.equal(demoActiveAssessment(r, closed, casePlan, version).status, 'failed');
  }
  for (const mutate of [
    (c) => (c.forcedCleanup = true),
    (c) => c.survivors.push(1),
    (c) => c.ambiguous.push(2),
    (c) => (c.exitCode = 1),
  ]) {
    const c = structuredClone(closed);
    mutate(c);
    assert.equal(demoActiveAssessment(raw(), c, casePlan, version).status, 'failed');
  }
});
test('all-cost or overhead assertions cannot be substituted for scoped authority', () => {
  for (const key of ['fullApplicationCostGateStatus', 'instrumentationOverheadStatus']) {
    const r = raw();
    r[key] = 'pass';
    assert.equal(demoActiveAssessment(r, closed, casePlan, version).status, 'failed');
  }
});
test('original observer and complete observed public protocol remain byte exact', async () => {
  const observer = await readFile(new URL('./solo-demo-active-observer.mjs', import.meta.url));
  assert.equal(
    createHash('sha256').update(observer).digest('hex'),
    '7082f727692354b48802d718ccdaa97e0e823634605a5bcd87023ffced7883a8',
  );
  const driver = await readFile(new URL('./observe-solo-demo-active.mjs', import.meta.url), 'utf8');
  const start = driver.indexOf('  await page.bringToFront();');
  const end = driver.indexOf('\n  ensure();\n  assert(!report.overflow);', start);
  assert(start > 0 && end > start);
  assert.equal(
    createHash('sha256').update(driver.slice(start, end)).digest('hex'),
    'c45059fea79e135879e3dfeef6c2e0823d6b940d6de0596a20382cc6098cb7f2',
  );
});
test('finite CDP boundaries and nonnegative deltas remain required', () => {
  const names = [
    'TaskDuration',
    'ScriptDuration',
    'LayoutDuration',
    'RecalcStyleDuration',
    'Timestamp',
  ];
  const values = requiredTaskMetrics(names.map((name) => ({ name, value: 1 })));
  assert.throws(() => requiredTaskMetrics([]));
  assert.throws(() => taskMetricDeltas(values, { ...values, TaskDuration: 0 }));
  assert.deepEqual(
    taskMetricDeltas(values, values),
    Object.fromEntries(names.map((name) => [name, 0])),
  );
});
