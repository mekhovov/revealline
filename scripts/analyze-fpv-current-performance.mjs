#!/usr/bin/env node
// Reproduce bounded observations; this is not a benchmark acceptance threshold.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Use RECEIPT_JSON NEW_ANALYSIS_JSON');
const bytes = await fs.readFile(input),
  data = JSON.parse(bytes);
if (data.format !== 'FPVCurrentPlayerProfile.v1') throw Error('Unknown receipt');
const quantile = (sorted, p) => sorted[Math.floor((sorted.length - 1) * p)] ?? null;
function stats(values) {
  const sorted = values.toSorted((a, b) => a - b);
  return {
    count: sorted.length,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    max: sorted.at(-1) ?? null,
  };
}
const start =
  data.measurementStartedAt ??
  Math.min(...data.spans.filter((s) => s.name === 'ui.fly-to-ready').map((s) => s.start));
const end =
  data.measurementEndedAt ??
  data.spans.find((s) => s.name === 'renderer.dispose')?.start ??
  data.elapsedMs;
const spans = data.spans.filter((s) => Number.isFinite(s.wallMs));
const draws = data.draws.filter((d) => d.at >= start && d.at <= end);
const overlaps = (draw, span) => draw.at > span.start && draw.at - draw.cpuSubmissionMs < span.end;
const selected = (name) => spans.filter((s) => s.name === name);
const spanStats = Object.fromEntries(
  [...new Set(spans.map((s) => s.name))]
    .sort()
    .map((name) => [name, stats(selected(name).map((s) => s.wallMs))]),
);
const analysis = {
  format: 'FPVCurrentPlayerProfileAnalysis.v1',
  input: { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length },
  sourceRevision: data.fixture.sourceRevision,
  qualificationKind: data.fixture.qualificationKind,
  environment: data.environment,
  observerSupport: data.observerSupport,
  completed: data.completed === true,
  failure: data.failure ?? null,
  disposeFailure: data.disposeFailure ?? null,
  integrityFailure: data.integrityFailure ?? null,
  checks: {
    passed: data.checks.filter((c) => c.passed).length,
    failed: data.checks.filter((c) => !c.passed),
  },
  warnings: data.warnings,
  errors: data.errors,
  dropped: data.dropped,
  measurement: { start, end, wallMs: end - start, operatorIdleMs: data.operatorIdleMs ?? null },
  visibility: data.visibility,
  spans: spanStats,
  raf: stats(
    data.raf.filter((r) => r.at - r.intervalMs >= start && r.at <= end).map((r) => r.intervalMs),
  ),
  drawCPUSubmission: stats(draws.map((d) => d.cpuSubmissionMs)),
  drawOverlap: Object.fromEntries(
    ['renderer.loadScene', 'renderer.prepare'].map((name) => [
      name,
      stats(
        draws
          .filter((d) => selected(name).some((s) => overlaps(d, s)))
          .map((d) => d.cpuSubmissionMs),
      ),
    ]),
  ),
  transitions: spans
    .filter((s) => s.name.startsWith('ui.'))
    .map((s) => ({ name: s.name, ...s.context, wallMs: s.wallMs })),
  firstPostPrepareDraws: spans
    .filter((s) => ['ui.fly-to-ready', 'ui.retry-to-ready', 'ui.quality-to-ready'].includes(s.name))
    .map((s) => {
      const preparation = selected('renderer.prepare')
        .filter((r) => r.start >= s.start && r.end <= s.end)
        .at(-1);
      const first =
        preparation &&
        draws.find(
          (d) => d.at - d.cpuSubmissionMs >= preparation.end && d.courseId === s.context.courseId,
        );
      return {
        name: s.name,
        ...s.context,
        preparationEnd: preparation?.end ?? null,
        draw: first ?? null,
        postPrepareToDrawEndMs: first ? first.at - preparation.end : null,
      };
    }),
  longestDraws: draws
    .toSorted((a, b) => b.cpuSubmissionMs - a.cpuSubmissionMs)
    .slice(0, 12)
    .map((d) => ({
      ...d,
      overlappingSpans: spans.filter((s) => overlaps(d, s)).map((s) => s.name),
    })),
  samples: data.samples.map((s) => ({
    cycle: s.cycle,
    courseId: s.courseId,
    quality: s.quality,
    drawIdentityVerified:
      s.drawCount > 0 && s.drawnCourseIds?.length === 1 && s.drawnCourseIds[0] === s.courseId,
    drawCount: s.drawCount ?? null,
    drawnCourseIds: s.drawnCourseIds ?? null,
    state: s.state,
    coachStage: s.coachStage ?? null,
    visible: s.visible,
    focused: s.focused,
    canvas: s.canvas,
    registered: s.resources.registered,
    renderer: s.resources.renderer,
  })),
  tasks: data.tasks.filter((t) => t.start + t.duration >= start && t.start <= end),
  disposedResources: data.disposedResources,
  limits: [
    'Nested/overlapping spans cannot be added; loadScene wall time includes concurrent rendering and event scheduling.',
    'RAF intervals are browser callback gaps. draw is CPU/GL submission, not GPU elapsed time or hardware FPS.',
    'First document/renderer use does not flush OS, GPU or network caches.',
    'R1 lacks per-draw course identity and its School guide-covered samples cannot establish selected-course drawing.',
    'Guide Start then immediate Pause in later fixtures is a warm-state transition; sample ticks remain recorded.',
  ],
};
await fs.writeFile(output, JSON.stringify(analysis, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(
  JSON.stringify({
    output,
    completed: analysis.completed,
    checks: analysis.checks,
    raf: analysis.raf,
    drawCPUSubmission: analysis.drawCPUSubmission,
  }) + '\n',
);
