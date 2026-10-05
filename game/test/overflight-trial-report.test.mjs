import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightBenchmark } from '../overflight/benchmark.mjs';
import { summarizeOverflightTrials } from '../overflight/trial-report.mjs';
function trial(id) {
  const meter = createOverflightBenchmark({
    warmupSeconds: 30,
    measurementSeconds: 120,
    repetitions: 1,
    stopAtEnd: true,
  });
  for (let i = 0; i <= 9001; i++) meter.frame((i * 1000) / 60);
  return {
    format: 'OverflightMeasurementsV1',
    benchmarkTrial: String(id),
    capturedAt: `trial-${id}`,
    browser: 'test browser',
    projectIdentity: 'test project',
    appearance: { identity: 'test' },
    fixture: 'reference',
    seed: 42,
    viewport: { width: 1920, height: 1080 },
    trialValid: true,
    invalidReasons: [],
    renderer: meter.snapshot({ raw: true }),
    resourceSamples: Array.from({ length: 10 }, () => ({
      alive: 1500,
      visible: 700,
      canvasCount: 1,
    })),
  };
}
test('three separately warmed trials are accepted from raw intervals', () => {
  const report = summarizeOverflightTrials([trial(1), trial(2), trial(3)]);
  assert.equal(report.valid, true);
  assert.equal(report.passes, true);
});
test('duplicates, changed seeds, interruptions and missing actors cannot qualify', () => {
  for (const mutate of [
    (records) => {
      records[2] = records[1];
    },
    (records) => {
      records[1].seed = 43;
    },
    (records) => {
      records[1].trialValid = false;
    },
    (records) => {
      records[1].resourceSamples[0].visible = 64;
    },
    (records) => {
      records[1].renderer.protocol.repetitions = 3;
    },
    (records) => {
      records[1].renderer.rawIntervals = [];
    },
  ]) {
    const records = [trial(1), trial(2), trial(3)];
    mutate(records);
    assert.equal(summarizeOverflightTrials(records).valid, false);
    assert.equal(summarizeOverflightTrials(records).passes, false);
  }
});
