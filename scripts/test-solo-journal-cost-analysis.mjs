import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserJournalCostProbe } from './solo-qualification-journal-cost.mjs';
import { diagnosticsSchedule } from './solo-diagnostics-analysis.mjs';
import {
  JOURNAL_COST_RECIPE,
  journalCostObservation,
  analyzeJournalCost,
} from './solo-journal-cost-analysis.mjs';

const source = 'cce49c81d82b79aefc24898f32eeebc609e569fb';
function arm(on, overhead = 0.001, tier = 'full') {
  let now = 0;
  const meter = createBrowserJournalCostProbe(
    {},
    { performance: { now: () => now, timeOrigin: 1000 } },
  );
  meter.phase(2);
  for (let i = 0; i < 900; i++) {
    const start = 1 + (i * 100) / 3;
    now = start;
    meter.beginWork(start);
    meter.begin(3);
    now += on ? overhead : 0;
    meter.end();
    now = start + 1 + (on ? overhead : 0);
    meter.endWork(now, tier);
    meter.begin(4);
    now += on ? overhead : 0;
    meter.end();
    meter.begin(1);
    meter.end();
  }
  meter.phase(3);
  const cost = meter.export();
  cost.documents = 1;
  cost.journalEnabled = on;
  return {
    format: 'SoloQualificationReportV1',
    scenarioStatus: 'pass',
    scenarioSHA256: JOURNAL_COST_RECIPE.sha256,
    kind: 'performance',
    sourceRevision: source,
    buildIdentity: { sourceRevision: source },
    environment: {
      engine: 'chromium',
      contextMode: 'ephemeral',
      cpuThrottle: 1,
      browserVersion: '151',
    },
    workProbe: true,
    audioProof: false,
    cadenceProtocol: 'settled120',
    performanceGateStatus: 'pass-observed-window',
    pageErrors: [],
    replay: { nativeVerification: { status: 'pass', engine: 'chromium', browserVersion: '151' } },
    journalCost: cost,
    ...(on ? { hitchJournal: { status: 'complete' } } : {}),
  };
}
function cohort(overhead = 0.001) {
  const executions = diagnosticsSchedule(10, 1544).map((value) => ({
    ...value,
    status: 'complete',
    exitCode: 0,
    report: `arm-${value.order}.json`,
    journalReadback: value.diagnostics ? { status: 'complete' } : null,
  }));
  return {
    manifest: {
      executions,
      configuration: { sourceRevision: source, engine: 'chromium', browserVersion: '151' },
      timerResolution: {
        status: 'observed',
        crossOriginIsolated: false,
        browser: 'chromium 151',
        minimumPositiveStepMs: 0.000001,
        positiveSteps: 100,
      },
    },
    reports: executions.map((value) => arm(value.diagnostics, overhead)),
  };
}
test('all ten fixed pairs produce a narrow scoped verdict with explicit unmeasured cost', () => {
  const f = cohort(),
    result = analyzeJournalCost(f.manifest, f.reports);
  assert.equal(result.status, 'pass-scoped-envelope');
  assert.equal(result.completePairs, 10);
  assert.equal(result.gameplayPerformanceQualification, false);
  assert.equal(result.fullJournalOverheadQualification, false);
  assert(result.interval.upper95 < 0.05);
  assert.match(result.scope, /registration\/browser delivery/);
  assert(result.observations.every((row) => row.valid && row.tier === 'full'));
});
test('overhead above five percent fails without a tolerance change', () => {
  const f = cohort(0.1),
    result = analyzeJournalCost(f.manifest, f.reports);
  assert.equal(result.status, 'fail-scoped-envelope');
  assert(result.interval.lower95 > 0.05);
});
test('missing arms, changed inventory and contradictory raw failures remain unresolved', () => {
  for (const mutate of [
    (f) => {
      f.reports[0] = null;
    },
    (f) => {
      f.reports.pop();
    },
    (f) => {
      f.manifest.executions[0].pair = 9;
    },
    (f) => {
      f.manifest.executions[0].status = 'failed';
    },
    (f) => {
      f.reports[0].performanceGateStatus = 'fail';
    },
    (f) => {
      f.reports[0].performanceGateStatusBeforeJournalCost = 'fail';
    },
    (f) => {
      f.reports[0].pageErrors = ['page error'];
    },
    (f) => {
      f.reports[0].replay.nativeVerification.status = 'fail';
    },
    (f) => {
      f.reports[0].journalCost.documents = 2;
    },
    (f) => {
      f.reports[0].journalCost.errors = 1;
    },
    (f) => {
      f.reports[0].journalCost.workOpen = true;
    },
    (f) => {
      f.reports[0].sourceRevision = 'a'.repeat(40);
    },
    (f) => {
      f.reports[0].scenarioSHA256 = 'b'.repeat(64);
    },
  ]) {
    const f = cohort();
    mutate(f);
    const result = analyzeJournalCost(f.manifest, f.reports);
    assert.equal(result.status, 'unresolved');
    assert(result.reasons.length > 0);
  }
});
test('on requires independently verified journal and off cannot quietly contain one', () => {
  const f = cohort(),
    on = f.manifest.executions.findIndex((x) => x.diagnostics),
    off = f.manifest.executions.findIndex((x) => !x.diagnostics);
  f.manifest.executions[on].journalReadback = { status: 'incomplete' };
  assert.equal(analyzeJournalCost(f.manifest, f.reports).status, 'unresolved');
  const g = cohort();
  g.reports[off].hitchJournal = { status: 'complete' };
  assert.equal(analyzeJournalCost(g.manifest, g.reports).status, 'unresolved');
});
test('constant reduced tier is admitted only when both matched arms have that tier', () => {
  const f = cohort();
  f.reports = f.manifest.executions.map((x) => arm(x.diagnostics, 0.001, 'reduced'));
  assert.equal(analyzeJournalCost(f.manifest, f.reports).status, 'pass-scoped-envelope');
  f.reports[0] = arm(f.manifest.executions[0].diagnostics, 0.001, 'full');
  assert.equal(analyzeJournalCost(f.manifest, f.reports).status, 'unresolved');
  const q = f.reports[0].journalCost.activeQuality;
  q.full--;
  q.minimal++;
  assert.equal(
    journalCostObservation(f.reports[0], f.manifest.executions[0], f.manifest.configuration).valid,
    false,
  );
  q.minimal--;
  q.unobserved++;
  assert.equal(
    journalCostObservation(f.reports[0], f.manifest.executions[0], f.manifest.configuration).valid,
    false,
  );
});
test('endpoint-count quantization prevents an apparent zero-variance false pass', () => {
  const f = cohort();
  f.manifest.timerResolution.minimumPositiveStepMs = 0.1;
  const result = analyzeJournalCost(f.manifest, f.reports);
  assert.equal(result.status, 'unresolved');
  assert(result.interval === null || result.interval.upper95 > 0.05);
  assert(result.pairs.every((pair) => pair.onErrorMs >= 0.2 && pair.offErrorMs >= 0.2));
});
test('raw cost geometry, tail conservation and missing constant quality are checked', () => {
  for (const mutate of [
    (c) => {
      c.rows[7]++;
    },
    (c) => {
      c.appMs++;
    },
    (c) => {
      c.outsideMs++;
    },
    (c) => {
      c.rows[0] = -1;
    },
    (c) => {
      c.quantizationEndpointCounts[0] = 1;
    },
    (c) => {
      c.activeQuality.unobserved = 1;
    },
    (c) => {
      c.unassignedTailByPhase[2] += 1;
    },
    (c) => {
      c.kindTotals[0] += 0.5;
      c.kindTotals[2] -= 0.5;
    },
    (c) => {
      c.unassignedTailEndpointCounts[2] += 0.5;
    },
    (c) => {
      c.unassignedTailEndpointCounts[2] += 1;
    },
    (c) => {
      c.activeWindows--;
    },
    (c) => {
      c.timeOrigin = undefined;
    },
    (c) => {
      c.maximumHookMs = 100;
    },
  ]) {
    const f = cohort();
    mutate(f.reports[0].journalCost);
    const result = journalCostObservation(
      f.reports[0],
      f.manifest.executions[0],
      f.manifest.configuration,
    );
    assert.equal(result.valid, false);
    assert(result.reasons.length > 0);
  }
});
test('active terminal costs are included in the last sample and total, not silently discarded', () => {
  const f = cohort();
  const i = f.manifest.executions.findIndex((x) => x.diagnostics),
    raw = f.reports[i],
    cost = raw.journalCost;
  const result = journalCostObservation(raw, f.manifest.executions[i], f.manifest.configuration);
  const sum = cost.rows.filter((_, index) => index % 8 === 7).reduce((a, b) => a + b, 0);
  assert(Math.abs(result.totalMs - sum - cost.unassignedTailByPhase[2]) < 1e-6);
  assert(cost.unassignedTailByPhase[2] > 0);
});
