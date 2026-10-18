import assert from 'node:assert/strict';
import { diagnosticsSchedule } from './solo-diagnostics-analysis.mjs';

export const JOURNAL_COST_RECIPE = Object.freeze({
  path: 'docs/performance/fixtures/solo-remote-timing/cold-first30.qualification.fixture',
  bytes: 6387,
  sha256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
});
export const JOURNAL_COST_COLUMNS = Object.freeze([
  'start',
  'end',
  'phaseBefore',
  'phaseAfter',
  'appMs',
  'insideHookMs',
  'assignedOutsideHookMs',
  'appAndAssignedOutsideMs',
]);
const finite = (value) => Number.isFinite(value) && value >= 0;
const sameNumber = (actual, expected) =>
  Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-10);
const p95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];

export function journalCostObservation(raw, execution, configuration) {
  const reasons = [],
    reject = (condition, reason) => {
      if (condition) reasons.push(reason);
    };
  const cost = raw?.journalCost,
    replay = raw?.replay?.nativeVerification;
  reject(
    execution.status !== 'complete' || execution.exitCode !== 0 || execution.signal,
    'Owned observation did not close successfully.',
  );
  reject(
    raw?.format !== 'SoloQualificationReportV1' ||
      raw.scenarioStatus !== 'pass' ||
      raw.scenarioSHA256 !== JOURNAL_COST_RECIPE.sha256 ||
      raw.kind !== 'performance',
    'Wrong or incomplete fixed public recipe.',
  );
  reject(
    raw?.sourceRevision !== configuration.sourceRevision ||
      raw?.buildIdentity?.sourceRevision !== configuration.sourceRevision,
    'Source identity mismatch.',
  );
  reject(
    raw?.environment?.engine !== configuration.engine ||
      raw?.environment?.contextMode !==
        (configuration.engine === 'webkit' ? 'persistent' : 'ephemeral') ||
      raw?.environment?.cpuThrottle !== 1 ||
      raw?.environment?.browserVersion !== configuration.browserVersion,
    'Browser, profile or CPU settings differ.',
  );
  reject(
    raw?.workProbe !== true ||
      raw?.audioProof !== false ||
      raw?.cadenceProtocol !== 'settled120' ||
      raw?.performanceGateStatus !== 'pass-observed-window' ||
      raw?.failure ||
      raw?.replayFailure ||
      raw?.contextCleanupFailure ||
      raw?.journalCostFailure ||
      raw?.hitchJournalFailure ||
      Object.hasOwn(raw ?? {}, 'performanceGateStatusBeforeJournalCost') ||
      Object.hasOwn(raw ?? {}, 'performanceGateStatusBeforeHitchJournal'),
    'Incomplete or failed raw evidence remains excluded.',
  );
  reject(
    !Array.isArray(raw?.pageErrors) ||
      raw.pageErrors.length !== 0 ||
      replay?.status !== 'pass' ||
      replay.engine !== configuration.engine ||
      replay.browserVersion !== configuration.browserVersion,
    'Page errors or strict source-native replay failure.',
  );
  reject(
    cost?.format !== 'SoloJournalCostProbeV1' ||
      cost.status !== 'complete' ||
      cost.documents !== 1 ||
      cost.journalEnabled !== execution.diagnostics ||
      cost.errors !== 0 ||
      cost.sealed !== true ||
      cost.workOpen !== false ||
      cost.hookOpen !== false ||
      cost.phase !== 3,
    'Missing complete single-document cost endpoints.',
  );
  if (execution.diagnostics)
    reject(
      execution.journalReadback?.status !== 'complete',
      'Journal binary readback missing or incomplete.',
    );
  else
    reject(Object.hasOwn(raw ?? {}, 'hitchJournal'), 'Journal-off arm contains journal evidence.');
  const values = [],
    rawValues = [],
    endpoints = [];
  let observedTier = null,
    activeCount = 0,
    firstActive = null,
    lastActive = null;
  try {
    assert(cost);
    assert.deepEqual(cost.rowColumns, JOURNAL_COST_COLUMNS);
    assert(Number.isSafeInteger(cost.windows) && cost.windows > 0 && cost.windows <= 16384);
    assert(Number.isSafeInteger(cost.hooks) && cost.hooks >= 0 && cost.hooks <= 65536);
    assert.equal(cost.bufferBytes, 3145728);
    assert.equal(cost.rows.length, cost.windows * 8);
    assert.equal(cost.quantizationEndpointCounts.length, cost.windows);
    assert(
      Number.isSafeInteger(cost.zeroDurationHooks) &&
        cost.zeroDurationHooks >= 0 &&
        cost.zeroDurationHooks <= cost.hooks,
    );
    assert(
      Array.isArray(cost.kindTotals) &&
        cost.kindTotals.length === 16 &&
        cost.kindTotals.every(finite),
    );
    assert(
      cost.kindTotals
        .filter((_, i) => i % 2 === 0)
        .every((n) => Number.isSafeInteger(n) && n <= cost.hooks),
    );
    assert.equal(
      cost.kindTotals.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0),
      cost.hooks,
    );
    assert.equal(cost.kindTotals[3 * 2], cost.windows);
    assert.equal(cost.kindTotals[4 * 2], cost.windows);
    assert(finite(cost.timeOrigin) && finite(cost.startedAt) && finite(cost.endedAt));
    assert(cost.endedAt >= cost.startedAt && cost.endedAt - cost.startedAt <= 240000);
    assert.equal(cost.envelopeRequiresTailAssessment, true);
    for (const array of [
      cost.outsideByPhase,
      cost.initialByPhase,
      cost.unassignedTailByPhase,
      cost.unassignedTailEndpointCounts,
    ])
      assert(Array.isArray(array) && array.length === 7 && array.every(finite));
    assert(
      cost.unassignedTailEndpointCounts.every(
        (n) => Number.isSafeInteger(n) && n % 2 === 0 && n <= 327680,
      ),
    );
    let previous = cost.startedAt,
      app = 0,
      inside = 0,
      assigned = 0,
      mixed = 0;
    for (let i = 0; i < cost.windows; i++) {
      const [start, end, before, after, work, overlap, outside, combined] = cost.rows.slice(
        i * 8,
        i * 8 + 8,
      );
      assert([start, end, work, overlap, outside, combined].every(finite));
      assert(start >= previous && end >= start && end <= cost.endedAt);
      previous = end;
      assert([before, after].every((p) => Number.isInteger(p) && p >= 0 && p < 7));
      assert(
        sameNumber(work, end - start) &&
          overlap <= work + 1e-8 &&
          sameNumber(combined, work + outside),
      );
      const count = cost.quantizationEndpointCounts[i];
      assert(Number.isSafeInteger(count) && count >= 2 && count % 2 === 0 && count <= 327682);
      if (outside > 0) assert(count >= 4);
      app += work;
      inside += overlap;
      assigned += outside;
      if (before !== after) mixed++;
      if (before === 2 && after === 2) {
        activeCount++;
        values.push(combined);
        rawValues.push(work);
        endpoints.push(count);
        firstActive ??= start;
        lastActive = end;
      }
    }
    assert.equal(mixed, cost.mixedWindows);
    const tails = cost.unassignedTailByPhase.reduce((a, b) => a + b, 0);
    assert(
      [
        cost.appMs,
        cost.hookMs,
        cost.insideMs,
        cost.outsideMs,
        cost.combinedMs,
        cost.maximumHookMs,
        cost.maximumUnassignedTailMs,
      ].every(finite),
    );
    assert(sameNumber(app, cost.appMs) && sameNumber(inside, cost.insideMs));
    assert(
      sameNumber(assigned + tails, cost.outsideMs) &&
        sameNumber(cost.hookMs, inside + cost.outsideMs),
    );
    assert(sameNumber(cost.combinedMs, app + cost.outsideMs));
    assert(
      sameNumber(
        cost.kindTotals.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0),
        cost.hookMs,
      ),
    );
    assert(
      cost.quantizationEndpointCounts.reduce((a, b) => a + b, 0) +
        cost.unassignedTailEndpointCounts.reduce((a, b) => a + b, 0) >=
        2 * cost.windows + 2 * cost.zeroDurationHooks,
      'Quantized-zero hook endpoints were omitted',
    );
    assert(
      sameNumber(
        cost.outsideByPhase.reduce((a, b) => a + b, 0),
        cost.outsideMs,
      ),
    );
    assert(cost.initialByPhase.every((n, i) => n <= cost.outsideByPhase[i] + 1e-8));
    assert(cost.unassignedTailByPhase.every((n, i) => n <= cost.outsideByPhase[i] + 1e-8));
    assert(activeCount >= 600 && lastActive - firstActive >= 29000);
    assert.equal(cost.activeWindows, rawValues.filter((n) => n > 0).length);
    const quality = cost.activeQuality;
    assert(
      quality &&
        ['full', 'reduced', 'minimal', 'unobserved'].every(
          (key) => Number.isSafeInteger(quality[key]) && quality[key] >= 0,
        ),
    );
    assert.equal(
      quality.full + quality.reduced + quality.minimal + quality.unobserved,
      activeCount,
    );
    assert.equal(quality.unobserved, 0, 'Unobserved submitted quality');
    observedTier =
      ['full', 'reduced', 'minimal'].find((key) => quality[key] === activeCount) ?? null;
    assert(observedTier, 'Adaptive tier changed within an arm');
    // Every active final tail remains in both the aggregate and the last active
    // sample. Other/mixed-phase tails remain separately reported outside this
    // active-window comparison; the severe-hook/tail check still applies.
    values[values.length - 1] += cost.unassignedTailByPhase[2];
    endpoints[endpoints.length - 1] += cost.unassignedTailEndpointCounts[2];
    reject(
      values.some((value) => value >= 100) ||
        cost.maximumHookMs >= 100 ||
        cost.maximumUnassignedTailMs >= 100,
      'A severe application/hook interval needs investigation.',
    );
  } catch (error) {
    reasons.push(`Cost coverage: ${String(error.message).slice(0, 1024)}`);
  }
  return {
    order: execution.order,
    pair: execution.pair,
    journal: execution.diagnostics,
    valid: reasons.length === 0,
    reasons,
    tier: observedTier,
    activeCount,
    activeMs: firstActive === null ? null : lastActive - firstActive,
    p95Ms: values.length ? p95(values) : null,
    rawAppP95Ms: rawValues.length ? p95(rawValues) : null,
    totalMs: values.reduce((a, b) => a + b, 0),
    maximumMs: values.length ? Math.max(...values) : null,
    maximumEndpointCount: endpoints.length ? Math.max(...endpoints) : null,
    tailCosts: cost?.unassignedTailByPhase ?? null,
    nonActiveTailMs:
      cost?.unassignedTailByPhase?.filter((_, i) => i !== 2).reduce((a, b) => a + b, 0) ?? null,
    rawPerformanceGateStatus: raw?.performanceGateStatus ?? 'unobserved',
    readback: execution.reportIdentity ?? null,
    report: execution.report,
  };
}

export function analyzeJournalCost(manifest, reports) {
  const reasons = [],
    schedule = diagnosticsSchedule(10, 1544),
    observations = [];
  try {
    assert.deepEqual(
      manifest.executions.map(({ order, pair, diagnostics }) => ({ order, pair, diagnostics })),
      schedule,
    );
  } catch {
    reasons.push('Fixed ten-pair inventory changed.');
  }
  if (reports.length !== 20)
    reasons.push('All twenty declared arms must remain in the evidence inventory.');
  for (let i = 0; i < 20; i++)
    observations.push(
      journalCostObservation(
        reports[i],
        manifest.executions[i] ?? schedule[i],
        manifest.configuration,
      ),
    );
  const timer = manifest.timerResolution,
    q = timer?.minimumPositiveStepMs;
  const timerValid =
    timer?.status === 'observed' &&
    timer.crossOriginIsolated === false &&
    timer.browser === `${manifest.configuration.engine} ${manifest.configuration.browserVersion}` &&
    finite(q) &&
    q > 0 &&
    timer.positiveSteps >= 20;
  if (!timerValid) reasons.push('Compatible normal-precision timer probe missing.');
  const pairs = [],
    ratios = [],
    allowances = [];
  for (let pair = 0; pair < 10; pair++) {
    const arms = observations.filter((value) => value.pair === pair),
      on = arms.find((value) => value.journal),
      off = arms.find((value) => !value.journal);
    const valid = arms.length === 2 && on?.valid && off?.valid && on.tier === off.tier;
    const onError = timerValid && on ? q * on.maximumEndpointCount : null;
    const offError = timerValid && off ? q * off.maximumEndpointCount : null;
    const resolvable = valid && on.p95Ms > onError && off.p95Ms > offError;
    const ratio = resolvable ? Math.log(on.p95Ms / off.p95Ms) : null;
    if (resolvable) {
      ratios.push(ratio);
      allowances.push(
        Math.max(
          Math.log((on.p95Ms + onError) / (off.p95Ms - offError)) - ratio,
          ratio - Math.log((on.p95Ms - onError) / (off.p95Ms + offError)),
        ),
      );
    }
    pairs.push({
      pair,
      valid: Boolean(valid),
      resolvable: Boolean(resolvable),
      tier: on?.tier ?? null,
      onP95Ms: on?.p95Ms ?? null,
      offP95Ms: off?.p95Ms ?? null,
      onErrorMs: onError,
      offErrorMs: offError,
    });
  }
  if (pairs.some((pair) => !pair.valid))
    reasons.push('Incomplete, mismatched-quality or failed pairs remain unqualified.');
  if (pairs.some((pair) => !pair.resolvable))
    reasons.push('Endpoint uncertainty cannot resolve this relative overhead.');
  let interval = null,
    status = 'unresolved';
  if (reasons.length === 0 && ratios.length === 10) {
    const mean = ratios.reduce((a, b) => a + b, 0) / 10;
    const sd = Math.sqrt(ratios.reduce((sum, x) => sum + (x - mean) ** 2, 0) / 9);
    const statistical = (2.263 * sd) / Math.sqrt(10),
      quantum = Math.max(...allowances) * (1 + 2.263 / 3);
    interval = {
      lower95: Math.expm1(mean - statistical - quantum),
      upper95: Math.expm1(mean + statistical + quantum),
      statisticalLogMargin: statistical,
      endpointLogMargin: quantum,
    };
    if (interval.upper95 <= 0.05) status = 'pass-scoped-envelope';
    else if (interval.lower95 > 0.05) status = 'fail-scoped-envelope';
    else reasons.push('The uncertainty interval crosses the unchanged 5% limit.');
  }
  return {
    format: 'SoloJournalHookCostAnalysisV1',
    status,
    limit: 0.05,
    plannedPairs: 10,
    completePairs: pairs.filter((pair) => pair.valid).length,
    reasons,
    pairs,
    observations,
    interval,
    gameplayPerformanceQualification: false,
    fullJournalOverheadQualification: false,
    scope:
      'Only synchronous invoked journal-hook plus application-work envelopes on the declared fixed route. ' +
      'Normal-precision observed quantum is a sensitivity assumption, not a guaranteed privacy-jitter bound. ' +
      'Non-active/mixed tails remain separately reported rather than credited as active work. ' +
      'Setup, observer registration/browser delivery, paused queued-entry drain/export, meter instructions outside ' +
      'endpoints, GPU work and total browser CPU are unobserved. No physical-device or gameplay qualification.',
    method:
      'Ten predeclared matched pairs; nearest-rank p95 of all stable active work windows plus assigned hook costs; ' +
      'active terminal tails added to the final sample and retained totals. Paired log ratios with a two-sided95% ' +
      'Student-t interval (df9, rounded-up2.263), expanded by conservative per-endpoint observed-quantum sensitivity. ' +
      'No trimming, successful-subset pooling, optional stopping or automatic retries.',
  };
}
