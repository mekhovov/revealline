import { evaluateQualificationBudgets } from './solo-qualification.mjs';

/** Declared stability check for a single, fixed pre-play30-frame window. Never
 * recalibrate after starting to make missed frames disappear. */
export function calibrateReadyCadence(samples, state = {}) {
  const valid =
    samples.length === 30 && samples.every((value) => Number.isFinite(value) && value > 0);
  if (!valid)
    return { status: 'provisional-incomplete', samples: samples.slice(), state, baselineMs: null };
  const sorted = samples.slice().sort((a, b) => a - b);
  const baselineMs = (sorted[14] + sorted[15]) / 2;
  const meanMs = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const standardDeviationMs = Math.sqrt(
    samples.reduce((sum, value) => sum + (value - meanMs) ** 2, 0) / samples.length,
  );
  const coefficientOfVariation = standardDeviationMs / meanMs;
  const p05Ms = sorted[1],
    p95Ms = sorted[28];
  const spread = (p95Ms - p05Ms) / baselineMs;
  const stable =
    state.ready === true &&
    state.phase !== 'running' &&
    coefficientOfVariation <= 0.1 &&
    spread <= 0.2;
  return {
    status: stable ? 'measured-before-play' : 'provisional-unstable',
    baselineMs,
    samples: samples.slice(),
    state,
    meanMs,
    standardDeviationMs,
    coefficientOfVariation,
    p05Ms,
    p95Ms,
    minimumMs: sorted[0],
    maximumMs: sorted.at(-1),
    relativeP05P95Spread: spread,
    limits: { coefficientOfVariation: 0.1, relativeP05P95Spread: 0.2 },
    scope:
      'Thirty rAF intervals after observable required preparation/boot readiness, while not playing. Optional catalogue/decode activity may remain; this does not prove host quiescence or physical refresh rate.',
  };
}

export function externalQualificationBudgets(probe) {
  const playing = probe?.phases?.indexOf('running');
  if (playing === undefined || playing < 0 || !probe.work)
    return { status: 'unobserved', reason: 'Independent application work probe unavailable.' };
  const stats = probe.work.totals,
    width = probe.work.width,
    offset = playing * width;
  const frameOffset = playing * 5,
    missedOffset = playing * 3;
  const evidence = {
    enabled: true,
    baselineMs: probe.calibration?.baselineMs,
    cadenceCalibration: { status: probe.calibration?.status },
    histogramUpperBoundsMs: probe.bounds,
    phases: {
      playing: {
        durationMs: probe.totals[frameOffset + 1],
        frames: {
          count: probe.totals[frameOffset],
          totalMs: probe.totals[frameOffset + 1],
          maxMs: probe.totals[frameOffset + 2],
          histogram: probe.counts[playing],
          missedOpportunities: probe.missed[missedOffset],
          maxMissedStreak: probe.missed[missedOffset + 1],
        },
        work: {
          count: stats[offset],
          totalMs: stats[offset + 1],
          maxMs: stats[offset + 2],
          histogram: stats.slice(offset + 3, offset + width),
          histogramUpperBoundsMs: probe.work.bounds,
        },
      },
    },
  };
  const result = evaluateQualificationBudgets(evidence);
  const checks = result.checks.slice(0, 4);
  const numericalStatus = checks.some((row) => row.status === 'fail')
    ? 'fail'
    : checks.every((row) => row.status === 'pass')
      ? 'pass'
      : 'inconclusive';
  let exactRunningWork = null;
  if (probe.work.omittedCount === 0 && probe.work.recent.length === probe.work.count * 2) {
    const samples = [];
    for (let i = 0; i < probe.work.recent.length; i += 2)
      if (probe.work.recent[i + 1] === playing) samples.push(probe.work.recent[i]);
    if (samples.length === stats[offset] && samples.length) {
      samples.sort((a, b) => a - b);
      const value = (fraction) => samples[Math.ceil(fraction * samples.length) - 1];
      exactRunningWork = {
        samples: samples.length,
        p50Ms: value(0.5),
        p95Ms: value(0.95),
        p99Ms: value(0.99),
        maximumMs: samples.at(-1),
        method:
          'Exact nearest-rank quantiles; the independent ring retained every application callback in this document.',
      };
    }
  }
  return {
    ...result,
    checks,
    numericalStatus,
    exactRunningWork,
    status:
      numericalStatus === 'fail'
        ? 'fail'
        : result.review.length
          ? 'review-required'
          : numericalStatus === 'pass'
            ? 'pass-observed-external-window'
            : 'inconclusive',
    unobserved: [
      'Internal input-to-render latency',
      'Internal safety interruptions/failures',
      'Owned resources when application export is absent',
    ],
    scope:
      'Same external Phaser PRE_STEP→POST_RENDER observer on both builds, plus rAF cadence. Includes observer overhead and render submission, not GPU completion. External success never establishes missing internal checks.',
  };
}
