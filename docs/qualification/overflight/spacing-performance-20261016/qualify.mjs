/** Recompute fixture frame gates from downloaded raw intervals, without trimming stalls. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const paths = process.argv.slice(2);
const output = paths.shift();
assert.ok(output && !existsSync(output) && paths.length > 0);
const rows = [];
for (const path of paths) {
  const bytes = readFileSync(path),
    d = JSON.parse(path.endsWith('.gz') ? gunzipSync(bytes) : bytes);
  const expected =
    d.fixture === 'reference'
      ? { alive: 1500, visible: 700 }
      : d.fixture === 'stress'
        ? { alive: 2500, visible: 1200 }
        : null;
  assert.ok(expected);
  const window = d.renderer.protocol.windows[0];
  assert.ok(window.complete);
  const intervals = d.renderer.rawIntervals.filter((s) => s.window === 1).map((s) => s.intervalMs);
  assert.ok(intervals.length > 0);
  const ordered = [...intervals].sort((a, b) => a - b),
    quantile = (p) => ordered[Math.max(0, Math.ceil(ordered.length * p) - 1)];
  const hz = (intervals.length * 1000) / intervals.reduce((a, b) => a + b, 0),
    p95 = quantile(0.95),
    p99 = quantile(0.99),
    slowFraction = intervals.filter((ms) => ms > 33.3).length / intervals.length;
  const population = d.resourceSamples.every(
    (s) =>
      s.alive === expected.alive &&
      s.visible === expected.visible &&
      s.rendered >= expected.visible,
  );
  const valid =
    d.trialValid &&
    d.clock.droppedSeconds === 0 &&
    d.reviewTrace === null &&
    !d.clipCaptureUsed &&
    d.invalidReasons.length === 0;
  rows.push({
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    fixture: d.fixture,
    trial: d.benchmarkTrial,
    projectIdentity: d.projectIdentity,
    crowdSeparation: d.crowdSeparation,
    seed: d.seed,
    appearance: d.appearance,
    reducedEffects: d.renderer.reducedEffects,
    viewport: d.viewport,
    backing: { width: d.renderer.backingWidth, height: d.renderer.backingHeight },
    browser: d.browser,
    expected,
    population,
    valid,
    hz,
    p95,
    p99,
    slowFraction,
    worst: ordered.at(-1),
    intervals: intervals.length,
    atlasBytes: d.renderer.atlas.baseRGBABytes,
    contextLosses: d.renderer.contextLosses,
    passes: valid && population && hz >= 59 && p95 <= 18 && p99 <= 33.3 && slowFraction < 0.01,
  });
}
const reference = rows.filter((r) => r.fixture === 'reference'),
  referenceComplete = reference.length === 3 && new Set(reference.map((r) => r.trial)).size === 3;
const sameConfiguration =
  new Set(
    reference.map((row) =>
      JSON.stringify({
        projectIdentity: row.projectIdentity,
        seed: row.seed,
        appearance: row.appearance,
        viewport: row.viewport,
        backing: row.backing,
        browser: row.browser,
        reducedEffects: row.reducedEffects,
        crowdSeparation: row.crowdSeparation,
      }),
    ),
  ).size === 1;
const report = {
  format: 'OverflightLocalSpacingFrameQualificationV1',
  runtimeCommit: '5f1906a46',
  scope:
    'Available Mac / Chromium / recorded native viewport only; no Iris Xe, Safari, input-device, enjoyment or full-release acceptance.',
  referenceComplete,
  sameConfiguration,
  referencePass:
    referenceComplete &&
    sameConfiguration &&
    reference.every((r) => r.passes && r.crowdSeparation === 'local-v1'),
  rows,
};
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
