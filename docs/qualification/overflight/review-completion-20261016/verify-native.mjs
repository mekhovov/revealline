/** Independent receipt checks; no browser/app state access and no trimmed stalls. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const root = new URL('./', import.meta.url);
const read = (name) => JSON.parse(gunzipSync(readFileSync(new URL(name, root))));
const target = new URL('native-qualification.json', root);
assert.ok(!existsSync(target), 'Never overwrite completed qualification evidence.');
const d = read('native-soak.json.gz');
assert.equal(d.fixture, 'reference');
assert.equal(d.benchmarkTrial, 'soak');
assert.equal(d.crowdSeparation, 'local-v1');
const window = d.renderer.protocol.windows[0];
const raw = d.renderer.rawIntervals.filter((v) => v.window === 1).map((v) => v.intervalMs);
assert.ok(raw.length && raw.every((v) => Number.isFinite(v) && v >= 0));
const sorted = [...raw].sort((a, b) => a - b);
const q = (p) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
const seconds = raw.reduce((a, b) => a + b, 0) / 1000;
const hz = raw.length / seconds;
const slowFraction = raw.filter((v) => v > 33.3).length / raw.length;
const valid =
  d.trialValid &&
  !d.clipCaptureUsed &&
  !d.reviewTrace &&
  !d.rawOverflow &&
  d.clock.droppedSeconds === 0 &&
  d.invalidReasons.length === 0 &&
  d.renderer.valid;
const populations =
  d.resourceSamples.length > 0 &&
  d.resourceSamples.every((s) => s.alive === 1500 && s.visible === 700 && s.rendered >= 700);
const resources = (key) => ({
  min: Math.min(...d.resourceSamples.map((s) => s[key])),
  max: Math.max(...d.resourceSamples.map((s) => s[key])),
  last: d.resourceSamples.at(-1)[key],
});
const baseline = read('native-retry-baseline.json.gz');
const retries = Array.from({ length: 10 }, (_, i) =>
  read(`native-retry-${String(i + 1).padStart(2, '0')}.json.gz`),
);
const dom = JSON.parse(readFileSync(new URL('native-retry-dom.json', root)));
for (const r of retries) {
  for (const key of ['appearance', 'projectIdentity', 'crowdSeparation', 'seed'])
    assert.deepEqual(r[key], baseline[key]);
  assert.equal(r.summary.phase, 'paused', 'The native measurement export deliberately pauses.');
  assert.ok(r.summary.tick > 0);
  assert.equal(r.renderer.counts.alive, 1500);
  assert.equal(r.renderer.counts.visible, 700);
  assert.deepEqual(r.renderer.atlas, baseline.renderer.atlas);
  assert.equal(r.renderer.allocatedSprites, baseline.renderer.allocatedSprites);
  assert.equal(r.renderer.failed, false);
  assert.equal(r.renderer.lost, false);
}
assert.equal(dom.length, 10);
assert.ok(dom.every((r) => r.domCanvasCount === 1 && r.visible.phase === 'playing'));
const boundary = JSON.parse(readFileSync(new URL('native-source-boundary.json', root)));
for (const [name, expected] of Object.entries(boundary.sources))
  assert.equal(
    createHash('sha256')
      .update(readFileSync(new URL(`../../../../${name}`, root)))
      .digest('hex'),
    expected,
  );
const result = {
  scope:
    'Recorded M4 Pro/Chromium native fixture only; no target-device, real-sortie balance, heap-disposal or enjoyment acceptance.',
  runtimeCommit: boundary.runtimeCommit,
  sourceStable: true,
  retries: {
    count: 10,
    sameIdentity: true,
    playingBeforePausedExport: true,
    canvasCount: 1,
    allocatedSprites: baseline.renderer.allocatedSprites,
    atlasBytes: baseline.renderer.atlas.baseRGBABytes,
    note: 'Nine short ~0.25-second entry samples; not ten complete sorties.',
  },
  soak: {
    valid,
    populations,
    complete: window.complete,
    warmupSeconds: d.renderer.protocol.warmupSeconds,
    configuredMeasurementSeconds: d.renderer.protocol.measurementSeconds,
    measuredSeconds: seconds,
    intervals: raw.length,
    hz,
    p95: q(0.95),
    p99: q(0.99),
    worst: sorted.at(-1),
    slowFraction,
    invalidReasons: d.invalidReasons,
    droppedSeconds: d.clock.droppedSeconds,
    resources: {
      samples: d.resourceSamples.length,
      canvases: resources('canvasCount'),
      atlasBytes: resources('atlasBytes'),
      allocatedSprites: resources('allocatedSprites'),
    },
    viewport: d.viewport,
    browser: d.browser,
    backing: { width: d.renderer.backingWidth, height: d.renderer.backingHeight },
    passes:
      valid &&
      populations &&
      window.complete &&
      Math.abs(seconds - 900) < 0.1 &&
      hz >= 59 &&
      q(0.95) <= 18 &&
      q(0.99) <= 33.3 &&
      slowFraction < 0.01,
  },
};
writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
