import assert from 'node:assert/strict';
import {
  PROSPECTIVE_OVERHEAD_METHOD,
  prospectiveOverhead,
  overheadP95Bounds,
  overheadLogRatioBounds,
  overheadPairedBox,
} from './solo-overhead-interval.mjs';

export const DIAGNOSTICS_FORMAT = 'SoloDiagnosticsQualificationV1';
export const OVERHEAD_LIMIT = 0.05;
// NIST 97.5th-percentile Student t table, rounded upward by one last place.
// https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm
const T95 = [
  null,
  12.707,
  4.304,
  3.183,
  2.777,
  2.572,
  2.448,
  2.366,
  2.307,
  2.263,
  2.229,
  2.202,
  2.18,
  2.161,
  2.146,
  2.132,
  2.121,
  2.111,
  2.102,
  2.094,
  2.087,
  2.081,
  2.075,
  2.07,
  2.065,
  2.061,
  2.057,
  2.053,
  2.049,
  2.046,
];

export function diagnosticsSchedule(pairs = 10, seed = 1544) {
  assert(Number.isInteger(pairs) && pairs >= 3 && pairs <= 30, 'Need 3–30 pairs');
  assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff, 'Invalid seed');
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const result = [];
  for (let pair = 0; pair < pairs; ) {
    const first = random() >= 0.5;
    // Adjacent matched pairs form ABBA or BAAB blocks. Odd totals differ by at
    // most one orientation; the seed is fixed before any observation is read.
    for (const onFirst of [first, !first]) {
      if (pair === pairs) break;
      for (const diagnostics of [onFirst, !onFirst])
        result.push({ order: result.length, pair, diagnostics });
      pair++;
    }
  }
  return result;
}

function canonicalAddress(address) {
  const url = new URL(address);
  url.searchParams.delete('performance');
  url.searchParams.sort();
  return url.href;
}

function pairedInterval(logRatios) {
  if (logRatios.length < 3) return null;
  const n = logRatios.length;
  const mean = logRatios.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(logRatios.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1));
  const margin = (T95[n - 1] * sd) / Math.sqrt(n);
  return {
    pairs: n,
    degreesOfFreedom: n - 1,
    logMean: mean,
    logStandardDeviation: sd,
    geometricRelativeDifference: Math.expm1(mean),
    lower95: Math.expm1(mean - margin),
    upper95: Math.expm1(mean + margin),
  };
}

export function qualityWitness(row) {
  const probe = row.external?.qualityProbe;
  const samples = probe?.samples;
  const reasons = [];
  if (
    row.qualityProbe !== true ||
    !Array.isArray(samples) ||
    samples.length < 4 ||
    samples.length > 1024 ||
    !samples.every((sample) => sample && typeof sample === 'object') ||
    probe.dropped !== 0
  )
    return {
      valid: false,
      reasons: ['Missing, short or censored quality observation.'],
      samples: samples ?? [],
    };
  if (
    samples[0].label !== 'before-start' ||
    samples[1].label !== 'active-start' ||
    samples.at(-1).label !== 'before-pause'
  )
    reasons.push('Quality observation lacks the required Start/Pause boundaries.');
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (
      !Number.isFinite(sample.at) ||
      (sample.quality !== 'full' && !(i === 0 && sample.quality === null)) ||
      (i > 0 && sample.flight !== 'running')
    )
      reasons.push(`Quality sample ${i} is missing, reduced or outside active play.`);
    if (i > 1 && (sample.at < samples[i - 1].at || sample.at - samples[i - 1].at > 1000))
      reasons.push(`Quality sample ${i} has an invalid or greater-than-1s gap.`);
    if (i > 1 && i < samples.length - 1 && sample.label !== 'active')
      reasons.push('Unexpected quality sample label.');
  }
  if (
    samples[0].at > row.launchAt ||
    samples[1].at < row.firstActiveAt ||
    samples[1].at - row.firstActiveAt >= 1000 ||
    samples.at(-1).at - samples[1].at < row.requestedActiveMs * 0.98 ||
    samples.at(-1).at - row.firstActiveAt > row.requestedActiveMs + 1000
  )
    reasons.push('Quality observation does not cover the requested active deadline.');
  return {
    valid: reasons.length === 0,
    reasons,
    samples,
    initialPaint: samples[0].quality === null ? 'not-observed-before-start' : samples[0].quality,
    scope:
      'Retained lastPaint.quality only; <=1s gaps are shorter than the runtime 10s quality dwell. A missing pre-Start paint is admitted only when the first active sample is full less than 1s after running, before two overload windows can downgrade. Before-Pause sampling prevents safe-transition restoration from hiding reduction.',
  };
}

// Validate original one-pass observer evidence without mutating or filtering it.
// Every rejected record still carries its original report path and reasons.
export function diagnosticsObservation(report, execution, configuration) {
  const reasons = [];
  const reject = (condition, reason) => {
    if (condition) reasons.push(reason);
  };
  reject(
    execution.status !== 'complete' || execution.exitCode !== 0 || Boolean(execution.signal),
    'Observation process did not complete successfully.',
  );
  if (!Array.isArray(report) || report.length !== 1 || !report[0])
    return {
      ...execution,
      valid: false,
      reasons: [...reasons, 'Missing exact single-pass report.'],
      rawRunningWorkMs: [],
    };
  const row = report[0];
  const quality = qualityWitness(row);
  reject(
    row.status !== 'observed' ||
      Boolean(row.failure) ||
      Boolean(row.batchFailure) ||
      Boolean(row.interruption) ||
      Boolean(row.interruptionCleanupFailure),
    'Observer reported failed or unobserved evidence.',
  );
  reject(
    !Array.isArray(row.errors) || row.errors.length > 0,
    'Missing or nonempty browser error evidence.',
  );
  reject(
    !Array.isArray(row.failedResponses) || row.failedResponses.length > 0,
    'Missing or failed HTTP response evidence.',
  );
  reject(
    row.beforePause?.flight !== 'running',
    'Requested active workload did not remain running.',
  );
  reject(
    !Number.isFinite(row.firstActiveAt) || !Number.isFinite(row.launchAt),
    'Missing active readiness timestamps.',
  );
  reject(row.independentWorkProbe !== true, 'Independent work instrumentation was not enabled.');
  reject(
    row.diagnostics !== execution.diagnostics,
    'Diagnostics mode does not match the planned arm.',
  );
  reject(row.sourceRevision !== configuration.sourceRevision, 'Source revision mismatch.');
  reject(
    row.requestedActiveMs !== configuration.durationMs || row.cpuRate !== configuration.cpuRate,
    'Duration or CPU rate mismatch.',
  );
  reject(
    row.fixtureAccess !== configuration.fixtureAccess ||
      row.serverFixtureAccess !== configuration.serverFixtureAccess ||
      row.profile !== configuration.profile ||
      row.inputs !== configuration.inputs,
    'Cache/profile, access fixture or input recipe mismatch.',
  );
  try {
    reject(
      canonicalAddress(row.address) !== canonicalAddress(configuration.address),
      'Workload URL mismatch.',
    );
    reject(
      new URL(row.address).searchParams.get('performance') !== (execution.diagnostics ? '1' : '0'),
      'URL diagnostics mode mismatch.',
    );
  } catch {
    reasons.push('Invalid workload URL.');
  }
  reject(
    typeof row.browser !== 'string' || !row.browser.startsWith(`${configuration.browser} `),
    'Browser engine missing or mismatched.',
  );
  reject(
    !row.host?.arch ||
      !row.host?.osRelease ||
      !row.viewport?.width ||
      !row.viewport?.height ||
      !row.audio ||
      !row.httpCache,
    'Missing environment/settings identity.',
  );
  if (execution.diagnostics) {
    reject(
      row.application?.enabled !== true ||
        row.application.sourceRevision !== configuration.sourceRevision,
      'Enabled application diagnostics or observed source identity missing.',
    );
    reject(
      row.application?.interruptions?.count !== 0 || row.application?.failures?.count !== 0,
      'Application reported an interruption/failure, or omitted its counters.',
    );
    reject(
      row.application?.quality?.tier !== 'full',
      'Adaptive reduction makes the observed workload unsuitable for overhead qualification.',
    );
  } else
    reject(row.application != null, 'Application diagnostics unexpectedly present in off arm.');
  const external = row.external,
    probe = external?.workProbe;
  const phase = Array.isArray(external?.names) ? external.names.indexOf('running') : -1;
  const rawRunningWorkMs = [];
  let maximumObservedWorkMs = 0;
  if (
    phase < 0 ||
    !probe ||
    !Array.isArray(probe.recent) ||
    !Array.isArray(probe.totals) ||
    !Number.isInteger(probe.count) ||
    probe.count <= 0 ||
    !Number.isInteger(probe.width) ||
    probe.width < 3 ||
    probe.totals.length !== external.names.length * probe.width
  ) {
    reasons.push('Missing or malformed independent running-phase samples.');
  } else {
    reject(
      probe.count > 5000 || probe.recent.length !== probe.count * 2,
      'Raw work ring is censored or incomplete; recent-only p95 cannot qualify the full run.',
    );
    let total = 0;
    for (let i = 0; i < external.names.length; i++) total += probe.totals[i * probe.width];
    reject(total !== probe.count, 'Lifetime work counts disagree with sample count.');
    for (let i = 0; i < probe.recent.length; i += 2) {
      const work = probe.recent[i],
        samplePhase = probe.recent[i + 1];
      if (
        !Number.isFinite(work) ||
        work < 0 ||
        !Number.isInteger(samplePhase) ||
        samplePhase < 0 ||
        samplePhase >= external.names.length
      ) {
        reasons.push('Invalid raw work sample.');
        break;
      }
      if (samplePhase === phase) rawRunningWorkMs.push(work);
      maximumObservedWorkMs = Math.max(maximumObservedWorkMs, work);
    }
    reject(
      rawRunningWorkMs.length !== probe.totals[phase * probe.width],
      'Running work sample count is incomplete.',
    );
    reject(rawRunningWorkMs.length < 100, 'Too few running frames for a p95 estimate.');
  }
  const offset = phase * external?.width;
  const activeMs = external?.totals?.[offset + 1];
  reject(
    !Number.isFinite(activeMs) || activeMs < configuration.durationMs * 0.98,
    'Less than 98% of the requested active duration was observed.',
  );
  const sorted = [...rawRunningWorkMs].sort((a, b) => a - b);
  const p95Ms = sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null;
  reject(!(p95Ms > 0), 'Work p95 is zero or absent; a relative overhead cannot be resolved.');
  return {
    ...execution,
    valid: reasons.length === 0,
    reasons,
    p95Ms,
    rawRunningWorkMs,
    maximumObservedWorkMs,
    activeMs,
    environment: {
      browser: row.browser,
      arch: row.host?.arch,
      osRelease: row.host?.osRelease,
      viewport: row.viewport,
      audio: row.audio,
      httpCache: row.httpCache,
      profile: row.profile,
    },
    observedAt: row.observedAt,
    qualityWitness: quality,
    preparationBaseline: execution.diagnostics
      ? {
          baselineMs: row.application?.baselineMs,
          calibration: row.application?.cadenceCalibration,
        }
      : null,
    hostLoad: { initial: row.host?.initialLoad, final: row.host?.finalLoad },
    callbackSummary: external?.totals?.slice(offset, offset + 7) ?? null,
  };
}

export function analyzeDiagnostics(manifest, reports) {
  assert.equal(manifest.format, DIAGNOSTICS_FORMAT);
  const prospective = prospectiveOverhead(manifest);
  if (prospective)
    assert.equal(manifest.configuration.pairs, 10, 'Prospective overhead requires ten pairs');
  const expected = diagnosticsSchedule(manifest.configuration.pairs, manifest.configuration.seed);
  const reasons = [];
  const observations = expected.map((planned, index) => {
    const actual = manifest.executions?.[index];
    const execution = { ...planned, ...actual };
    if (!actual || ['order', 'pair', 'diagnostics'].some((key) => actual[key] !== planned[key]))
      reasons.push(`Scheduled observation ${index} is missing or changed.`);
    return diagnosticsObservation(reports[index], execution, manifest.configuration);
  });
  if (manifest.executions?.length !== expected.length || reports.length !== expected.length)
    reasons.push('Execution/report inventory differs from the predeclared schedule.');
  const identity = JSON.stringify(observations.find((row) => row.environment)?.environment);
  for (const observation of observations) {
    if (JSON.stringify(observation.environment) !== identity) {
      observation.valid = false;
      observation.reasons.push(
        'Browser version, viewport, host or settings changed within the qualification.',
      );
    }
  }
  const pairs = [];
  for (let pair = 0; pair < manifest.configuration.pairs; pair++) {
    const arms = observations.filter((row) => row.pair === pair);
    const on = arms.find((row) => row.diagnostics),
      off = arms.find((row) => !row.diagnostics);
    const valid = arms.length === 2 && on?.valid && off?.valid;
    pairs.push({
      pair,
      valid: Boolean(valid),
      order: arms.map((row) => (row.diagnostics ? 'on' : 'off')),
      onP95Ms: on?.p95Ms ?? null,
      offP95Ms: off?.p95Ms ?? null,
      relativeDifference: on?.p95Ms > 0 && off?.p95Ms > 0 ? on.p95Ms / off.p95Ms - 1 : null,
      logRatio: valid ? Math.log(on.p95Ms / off.p95Ms) : null,
    });
  }
  const valid = pairs.filter((pair) => pair.valid);
  const interval = pairedInterval(valid.map((pair) => pair.logRatio));
  if (valid.length !== pairs.length)
    reasons.push('Failed, incomplete or unmatched pairs remain in the original inventory.');
  const resolution = manifest.timerResolution;
  const quantum = resolution?.minimumPositiveStepMs;
  const resolutionValid =
    resolution?.status === 'observed' &&
    Number.isFinite(quantum) &&
    quantum > 0 &&
    resolution.positiveSteps >= 20 &&
    resolution.browser === observations[0].environment?.browser;
  if (!resolutionValid) reasons.push('Compatible timer-resolution probe is missing or unresolved.');
  let adjustedInterval = null;
  // Do not substitute the on arm's final exported quality: Pause can restore
  // it, and the off arm has no application diagnostics. Require matching
  // retained-render observations across the full active window in both arms.
  const noAdaptationWitness = {
    status: 'unresolved',
    scope:
      'Matched retained lastPaint snapshots before Start, throughout active play at <=1s gaps, and before Pause; no runtime methods called.',
  };
  if (observations.every((row) => row.valid && row.qualityWitness?.valid)) {
    noAdaptationWitness.status = 'observed-full';
  } else
    reasons.push('No complete quality witness excludes adaptive rendering changes in both arms.');
  if (prospective) {
    if (resolutionValid && valid.length === 10) {
      try {
        const bounds = pairs.map((pair) => {
          const arms = observations.filter((row) => row.pair === pair.pair);
          pair.onP95BoundsMs = overheadP95Bounds(
            arms.find((row) => row.diagnostics).rawRunningWorkMs,
            quantum,
          );
          pair.offP95BoundsMs = overheadP95Bounds(
            arms.find((row) => !row.diagnostics).rawRunningWorkMs,
            quantum,
          );
          return overheadLogRatioBounds(pair.onP95BoundsMs, pair.offP95BoundsMs);
        });
        adjustedInterval = overheadPairedBox(bounds);
      } catch (error) {
        reasons.push(`Prospective interval unresolved: ${String(error.message).slice(0, 256)}`);
      }
    }
  } else if (
    interval &&
    resolutionValid &&
    valid.every((pair) => pair.offP95Ms > quantum && pair.onP95Ms > quantum)
  ) {
    const allowance = Math.max(
      ...valid.flatMap((pair) => [
        Math.log((pair.onP95Ms + quantum) / (pair.offP95Ms - quantum)) - pair.logRatio,
        pair.logRatio - Math.log((pair.onP95Ms - quantum) / (pair.offP95Ms + quantum)),
      ]),
    );
    // Bound the mean and sample-SD changes under a ±allowance perturbation of
    // each paired log ratio (triangle inequality). Quantization must not create
    // a false zero-variance pass. This is deliberately conservative.
    const margin = allowance * (1 + T95[valid.length - 1] / Math.sqrt(valid.length - 1));
    adjustedInterval = {
      maximumLogAllowance: allowance,
      lower95: Math.expm1(Math.log1p(interval.lower95) - margin),
      upper95: Math.expm1(Math.log1p(interval.upper95) + margin),
    };
  } else if (interval && resolutionValid)
    reasons.push('Work p95 is too close to timer resolution for a relative bound.');
  let status = 'unresolved';
  if (reasons.length === 0 && adjustedInterval) {
    if (adjustedInterval.upper95 <= OVERHEAD_LIMIT) status = 'pass';
    else if (adjustedInterval.lower95 > OVERHEAD_LIMIT) status = 'fail';
    else reasons.push('The uncertainty interval crosses the unchanged 5% overhead limit.');
  }
  return {
    format: DIAGNOSTICS_FORMAT,
    ...(prospective ? { analysisMethod: PROSPECTIVE_OVERHEAD_METHOD } : {}),
    status,
    limit: OVERHEAD_LIMIT,
    reasons,
    plannedPairs: pairs.length,
    completePairs: valid.length,
    pairs,
    interval,
    adjustedInterval,
    timerResolution: resolution ?? null,
    noAdaptationWitness,
    observations,
    unexpectedEvidence: reports.slice(expected.length).map((report, index) => ({
      execution: manifest.executions?.[expected.length + index] ?? null,
      report,
    })),
    method: prospective
      ? 'Prospective paired-p95-endpoint-box-v1: all ten predeclared pairs; raw nearest-rank p95 duration bounds; exact 1,024-vertex extrema of the existing two-sided 95% Student-t interval under the assumed duration-error bounds. No historical verdict replacement.'
      : 'Nearest-rank p95 of complete independent running-phase samples; paired log(on/off) differences; two-sided 95% Student-t interval; conservative observed-quantum sensitivity bound.',
    assumptions: [
      'Independent matched pairs and approximately normal paired log ratios; frames are not treated as independent experimental replicates.',
      'Observed minimum positive timer step estimates quantization; sensitivity assumes that step bounds each measured duration error. It is not a guaranteed browser privacy-jitter bound.',
      'Identical declared source, browser/settings and public input recipe. Retained quality is sampled with gaps below the runtime dwell; exact internal mission trajectory is not compared.',
      'Only diagnostics overhead for this workload is qualified. Browser/device frame budgets, resource stability and physical devices require their own evidence.',
      'All planned pairs are required. No deletion of outliers, optional stopping, replacement retries or pooling successful subsets.',
    ],
    sources: [
      'https://www.itl.nist.gov/div898/handbook/prc/section3/prc311.htm',
      'https://www.itl.nist.gov/div898/handbook/eda/section3/eda3672.htm',
    ],
  };
}
