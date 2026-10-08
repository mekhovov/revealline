import {
  OVERFLIGHT_BENCHMARK_TARGETS as targets,
  overflightBenchmarkTarget,
} from './benchmark.mjs';

/** A set is three fresh trials, never three windows copied from one run. */
export function summarizeOverflightTrials(records) {
  const errors = [];
  if (records.length !== 3) errors.push('Exactly three independent trials are required.');
  const identities = new Set(),
    captured = new Set();
  let fingerprint;
  const trials = records.map((record, index) => {
    const reasons = [];
    const meter = record.renderer;
    const protocol = meter?.protocol;
    const raid = record.fixture === 'raid-reference';
    const expectedFormat = raid ? 'OverflightHuntMeasurementsV1' : 'OverflightMeasurementsV1';
    if (record.format !== expectedFormat) reasons.push('Unknown measurement format for fixture.');
    if (!['1', '2', '3'].includes(record.benchmarkTrial))
      reasons.push('Missing numbered independent trial.');
    if (identities.has(record.benchmarkTrial) || captured.has(record.capturedAt))
      reasons.push('Duplicate trial.');
    identities.add(record.benchmarkTrial);
    captured.add(record.capturedAt);
    if (!record.capturedAt || !record.browser || !record.projectIdentity || !record.appearance)
      reasons.push('Missing run identity.');
    const identity = JSON.stringify({
      fixture: record.fixture,
      seed: record.seed,
      browser: record.browser,
      viewport: record.viewport,
      appearance: record.appearance,
      project: record.projectIdentity,
      backing: [meter?.backingWidth, meter?.backingHeight],
      effects: meter?.reducedEffects,
    });
    if (fingerprint === undefined) fingerprint = identity;
    else if (fingerprint !== identity)
      reasons.push('Device, project, seed or display settings differ.');
    if (
      protocol?.warmupSeconds !== 30 ||
      protocol?.measurementSeconds !== 120 ||
      protocol?.repetitions !== 1
    )
      reasons.push('Trial must have its own 30-second warm-up and 120-second measurement.');
    if (record.trialValid !== true || meter?.valid !== true || record.invalidReasons?.length)
      reasons.push('Trial was interrupted, overflowed, recorded video or dropped simulation time.');
    if (protocol?.windows?.length !== 1 || protocol.windows[0]?.complete !== true)
      reasons.push('Incomplete measurement.');
    const samples = (meter?.rawIntervals ?? [])
      .filter((frame) => frame.window === 1)
      .map((frame) => frame.intervalMs);
    if (!samples.length || samples.some((ms) => !Number.isFinite(ms) || ms <= 0))
      reasons.push('Missing or invalid raw render intervals.');
    const sorted = [...samples].sort((a, b) => a - b),
      sum = samples.reduce((a, b) => a + b, 0);
    const percentile = (p) => sorted[Math.ceil(sorted.length * p) - 1] ?? null;
    const cadenceHz = sum ? (samples.length * 1000) / sum : null;
    const slowFraction = samples.length
      ? samples.filter((ms) => ms > 33.3).length / samples.length
      : null;
    if (
      sum < 119000 ||
      sum > 121000 ||
      samples.length !== protocol?.windows?.[0]?.cadenceMs?.samples
    )
      reasons.push('Raw intervals do not cover the reported measurement.');
    const population = overflightBenchmarkTarget(record.fixture);
    if (!population) reasons.push('Unknown fixture.');
    if (raid) {
      const summary = record.summary,
        workload = summary?.fixtureWorkload;
      if (
        summary?.format !== 'OverflightHuntRunSummaryV1' ||
        summary.fixture !== 'raid-reference' ||
        summary.projectIdentity !== record.projectIdentity ||
        summary.seed !== record.seed ||
        summary.outcome !== 'technical-fixture' ||
        workload?.kind !== 'raid-reference' ||
        workload.gameplayResult !== false ||
        workload.alive !== population.alive ||
        workload.visible !== population.visible ||
        workload.fullBuild !== true ||
        workload.movingContactCollisions !== true ||
        workload.independentProjectiles !== true ||
        workload.partitionWrapping !== true ||
        workload.poolPolicy !== 'same-owned-pools' ||
        workload.progressionPolicy !== 'disabled-for-controlled-fixture'
      )
        reasons.push(
          'Raid evidence must identify the controlled contact workload, not a gameplay result.',
        );
    }
    const resources = record.resourceSamples ?? [];
    if (
      resources.length < 9 ||
      resources.some(
        (sample) =>
          sample.alive !== population?.alive ||
          sample.visible !== population?.visible ||
          sample.canvasCount !== 1,
      )
    )
      reasons.push('Fixture population or resource samples do not match the workload.');
    const passes =
      reasons.length === 0 &&
      cadenceHz >= targets.minimumCadenceHz &&
      percentile(0.95) <= targets.cadenceP95Ms &&
      percentile(0.99) <= targets.cadenceP99Ms &&
      slowFraction < targets.maximumSlowFraction;
    return {
      index: index + 1,
      trial: record.benchmarkTrial,
      valid: reasons.length === 0,
      reasons,
      passes,
      measuredSeconds: sum / 1000,
      samples: samples.length,
      cadenceHz,
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      slowFraction,
    };
  });
  return {
    format: 'OverflightIndependentTrialsV1',
    fixture: records[0]?.fixture ?? null,
    workload: overflightBenchmarkTarget(records[0]?.fixture),
    valid: errors.length === 0 && trials.every((trial) => trial.valid),
    errors,
    trials,
    passes: errors.length === 0 && trials.every((trial) => trial.passes),
    scope:
      records[0]?.fixture === 'raid-reference'
        ? 'Controlled Raid workload with automatic movement, full upgrades, recycled actors and fixed camera partitions. Normal sorties do not recycle actors. Recorded browser runs only; hardware identity, power mode and source binding require the receipt. This does not establish normal-run pacing, player enjoyment or target-device acceptance.'
        : 'Recorded browser runs only. Hardware identity, power mode and source binding require the accompanying receipt. This does not establish player enjoyment or target-device acceptance.',
  };
}
