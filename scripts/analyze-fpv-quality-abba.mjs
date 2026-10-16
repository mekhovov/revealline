#!/usr/bin/env node
// Describe the predeclared local ABBA observations; do not infer hardware FPS.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Use RECEIPT_JSON NEW_ANALYSIS_JSON');
const bytes = await fs.readFile(input),
  data = JSON.parse(bytes);
if (data.format !== 'FPVWarmQualityABBA.v1') throw Error('Unknown receipt');
const metrics = [
  'readyMs',
  'dispatchToFirstPostPrepareDrawEndMs',
  'preparationMs',
  'firstDrawCPUSubmissionMs',
  'firstPostPrepareDrawDelayMs',
];
const quantile = (sorted, p) => sorted[Math.floor((sorted.length - 1) * p)] ?? null;
function stats(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    count: sorted.length,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null,
  };
}
function summarize(samples) {
  return Object.fromEntries(
    metrics.map((key) => [key, stats(samples.map((sample) => sample[key]))]),
  );
}
function logical(sample) {
  const result = structuredClone({
    state: sample.state,
    resources: sample.resources,
    visible: sample.visible,
    focused: sample.focused,
  });
  for (const key of ['geometries', 'textures', 'programs']) delete result.resources.renderer[key];
  return JSON.stringify(result);
}
const grouping = (key) =>
  Object.fromEntries(
    [...new Set(data.samples.map(key))]
      .sort()
      .map((value) => [value, summarize(data.samples.filter((sample) => key(sample) === value))]),
  );
const comparisons = [];
for (const [a, b] of [
  [1, 2],
  [4, 3],
]) {
  for (const baseline of data.samples.filter((sample) => sample.block === a)) {
    const candidate = data.samples.find(
      (sample) =>
        sample.block === b &&
        sample.courseId === baseline.courseId &&
        sample.quality === baseline.quality &&
        sample.cycle === baseline.cycle,
    );
    comparisons.push({
      baselineBlock: a,
      candidateBlock: b,
      courseId: baseline.courseId,
      quality: baseline.quality,
      cycle: baseline.cycle,
      candidatePresent: Boolean(candidate),
      logicalStateAndResourcesEqual: candidate ? logical(baseline) === logical(candidate) : false,
      candidateMinusBaselineMs: candidate
        ? Object.fromEntries(metrics.map((key) => [key, candidate[key] - baseline[key]]))
        : null,
    });
  }
}
const stageSummary = data.stages.map((stage, index) => {
  const start = stage.measurementStartedAt,
    end = stage.measurementEndedAt;
  const spans = stage.spans.filter((span) =>
    ['renderer.prepare', 'renderer.loadScene'].includes(span.name),
  );
  const draws = stage.draws.filter((draw) => draw.at >= start && draw.at <= end);
  return {
    variant: data.fixture.order[index],
    block: index + 1,
    environment: stage.environment,
    errors: stage.errors,
    warnings: stage.warnings,
    dropped: stage.dropped,
    raf: stats(
      stage.raf
        .filter((row) => row.at - row.intervalMs >= start && row.at <= end)
        .map((row) => row.intervalMs),
    ),
    drawCPUSubmission: stats(draws.map((draw) => draw.cpuSubmissionMs)),
    drawWhilePreparing: stats(
      draws
        .filter((draw) =>
          spans.some((span) => draw.at > span.start && draw.at - draw.cpuSubmissionMs < span.end),
        )
        .map((draw) => draw.cpuSubmissionMs),
    ),
    disposedResources: stage.disposedResources,
  };
});
const result = {
  format: 'FPVWarmQualityABBAAnalysis.v1',
  input: { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length },
  sources: Object.fromEntries(
    Object.entries(data.fixture.variants).map(([key, value]) => [key, value.sourceRevision]),
  ),
  completed: data.completed === true,
  failure: data.failure ?? null,
  disposeFailure: data.disposeFailure ?? null,
  integrityFailure: data.integrityFailure ?? null,
  checks: {
    passed: data.checks.filter((row) => row.passed).length,
    failed: data.checks.filter((row) => !row.passed),
  },
  expectedSamples: 96,
  samples: data.samples.length,
  byVariant: grouping((sample) => sample.variant),
  byBlock: grouping((sample) => `${sample.block}:${sample.variant}`),
  byCourseAndQuality: grouping(
    (sample) => `${sample.courseId}:${sample.quality}:${sample.variant}`,
  ),
  stages: stageSummary,
  logicalComparison: {
    compared: comparisons.length,
    mismatches: comparisons.filter((row) => !row.logicalStateAndResourcesEqual),
  },
  matchedObservations: comparisons,
  limits: [
    'A,B,B,A uses fresh sequential hosts, warm courses, native browser clock and one visible player. It does not reset OS/GPU caches.',
    'Matching block observations share authored workload and cycle number, not simultaneous execution; differences are descriptive rather than causal significance estimates.',
    'Ready timing is observed from the native status mutation. The first later correct-course draw is reported separately.',
    'Renderer draw measures CPU and GL command submission, not GPU elapsed time or sustained hardware FPS.',
    'Logical comparison omits only uploaded renderer geometry/texture/program counts; it is not a pixel or shader-object comparison.',
  ],
};
await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(
  JSON.stringify({
    output,
    completed: result.completed,
    checks: result.checks,
    samples: result.samples,
    byVariant: result.byVariant,
    logicalComparison: result.logicalComparison,
  }) + '\n',
);
