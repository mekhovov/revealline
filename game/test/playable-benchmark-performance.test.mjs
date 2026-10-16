import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createBenchmarkPerformance,
  candidateMemory,
} from '../../authoring/playable-benchmark/performance.mjs';

const emptyMetric = { sampleCount: 0, p50Ms: null, p95Ms: null, worstMs: null };

test('new or reset measurements distinguish no samples from zero CPU cost', () => {
  const collector = createBenchmarkPerformance();
  assert.deepEqual(collector.snapshot(), {
    capacity: 120,
    sampleCount: 0,
    totalSamples: 0,
    excludedGapCount: 0,
    rejectedSampleCount: 0,
    frameInterval: emptyMetric,
    referenceDrawCPU: emptyMetric,
    comparisonDrawCPU: emptyMetric,
  });
  collector.record({ frameMs: 12.5, referenceMs: 0 });
  assert.deepEqual(collector.snapshot().referenceDrawCPU, {
    sampleCount: 1,
    p50Ms: 0,
    p95Ms: 0,
    worstMs: 0,
  });
  assert.deepEqual(collector.snapshot().comparisonDrawCPU, emptyMetric);
  collector.excludeGap();
  collector.record({ frameMs: NaN });
  collector.reset();
  assert.deepEqual(collector.snapshot(), createBenchmarkPerformance().snapshot());
});

test('nearest-rank percentiles keep actual pacing and the two draw costs independent', () => {
  const collector = createBenchmarkPerformance();
  // Scrambled order also ensures the summary sorts a copy, not the rolling data.
  for (const n of [20, 1, 19, 2, 18, 3, 17, 4, 16, 5, 15, 6, 14, 7, 13, 8, 12, 9, 11, 10])
    collector.record({ frameMs: n * 2, referenceMs: n / 10, comparisonMs: n * 3 });
  assert.deepEqual(collector.snapshot().frameInterval, {
    sampleCount: 20,
    p50Ms: 20,
    p95Ms: 38,
    worstMs: 40,
  });
  assert.deepEqual(collector.snapshot().referenceDrawCPU, {
    sampleCount: 20,
    p50Ms: 1,
    p95Ms: 1.9,
    worstMs: 2,
  });
  assert.deepEqual(collector.snapshot().comparisonDrawCPU, {
    sampleCount: 20,
    p50Ms: 30,
    p95Ms: 57,
    worstMs: 60,
  });
});

test('rolling frame window evicts old outliers and missing view samples together', () => {
  const collector = createBenchmarkPerformance({ capacity: 3 });
  collector.record({ frameMs: 900, referenceMs: 800, comparisonMs: 700 });
  collector.record({ frameMs: 11, referenceMs: 1 });
  collector.record({ frameMs: 13, comparisonMs: 3 });
  assert.equal(collector.snapshot().frameInterval.worstMs, 900);
  collector.record({ frameMs: 17, referenceMs: 2, comparisonMs: 4 });
  const snapshot = collector.snapshot();
  assert.equal(snapshot.totalSamples, 4);
  assert.equal(snapshot.sampleCount, 3);
  assert.deepEqual(snapshot.frameInterval, {
    sampleCount: 3,
    p50Ms: 13,
    p95Ms: 17,
    worstMs: 17,
  });
  assert.equal(snapshot.referenceDrawCPU.sampleCount, 2);
  assert.equal(snapshot.referenceDrawCPU.worstMs, 2);
  assert.equal(snapshot.comparisonDrawCPU.sampleCount, 2);
  assert.equal(snapshot.comparisonDrawCPU.worstMs, 4);
  snapshot.frameInterval.worstMs = 99999;
  assert.equal(collector.snapshot().frameInterval.worstMs, 17);
});

test('excluded gaps add no artificial normal frame, draw duration or window eviction', () => {
  const collector = createBenchmarkPerformance({ capacity: 2 });
  collector.record({ frameMs: 17.2, referenceMs: 0.4, comparisonMs: 0.7 });
  collector.excludeGap(); // Long frame caused the host to pause.
  collector.excludeGap(); // Hidden/loading/ready segment, counted once by the host.
  assert.equal(collector.snapshot().excludedGapCount, 2);
  assert.equal(collector.snapshot().sampleCount, 1);
  assert.equal(collector.snapshot().totalSamples, 1);
  collector.record({ frameMs: 23.8, referenceMs: 0.8, comparisonMs: 1.1 });
  assert.equal(collector.snapshot().frameInterval.worstMs, 23.8);
  assert.equal(collector.snapshot().referenceDrawCPU.p50Ms, 0.4);
});

test('invalid records are rejected atomically without dropping prior observations', () => {
  const collector = createBenchmarkPerformance({ capacity: 1 });
  collector.record({ frameMs: 20, referenceMs: 2, comparisonMs: 3 });
  const invalid = [
    {},
    { frameMs: 0 },
    { frameMs: -1 },
    { frameMs: Infinity },
    { frameMs: NaN },
    { frameMs: '16' },
    { frameMs: 16, referenceMs: -1 },
    { frameMs: 16, comparisonMs: Infinity },
    { frameMs: 16, referenceMs: false },
  ];
  for (const record of invalid) assert.equal(collector.record(record), false);
  const snapshot = collector.snapshot();
  assert.equal(snapshot.rejectedSampleCount, invalid.length);
  assert.equal(snapshot.totalSamples, 1);
  assert.equal(snapshot.frameInterval.worstMs, 20);
  assert.equal(snapshot.referenceDrawCPU.worstMs, 2);
  assert.equal(snapshot.comparisonDrawCPU.worstMs, 3);
});

test('window capacity is finite and bounded', () => {
  for (const capacity of [0, -1, 0.5, NaN, Infinity, 601, '120'])
    assert.throws(() => createBenchmarkPerformance({ capacity }), RangeError);
  const collector = createBenchmarkPerformance();
  for (let index = 1; index <= 1000; index++) collector.record({ frameMs: index });
  assert.equal(collector.snapshot().sampleCount, 120);
  assert.equal(collector.snapshot().totalSamples, 1000);
  assert.equal(collector.snapshot().frameInterval.p50Ms, 940);
});

test('active candidate provenance accounts only the two actually owned Scout images', async () => {
  for (const directory of ['fpv-body-detail-candidates', 'fpv-body-contrast-candidates']) {
    const manifest = JSON.parse(
      await readFile(
        new URL(`../../authoring/library/${directory}/manifest.json`, import.meta.url),
      ),
    );
    // Match acquireScoutComparison's post-decode provenance, which omits Carrier.
    const assets = manifest.assets
      .filter((entry) => entry.slot.startsWith('player.scout.'))
      .map(({ slot, path, assetRevision }) => ({ slot, path, assetRevision }));
    const provenance = {
      kind: 'source-only-actor-comparison',
      treatment: 'compact',
      assets,
    };
    const before = JSON.stringify(provenance);
    assert.deepEqual(candidateMemory(provenance), {
      knownImageCount: 2,
      sourceBytes: assets.reduce((sum, entry) => sum + entry.assetRevision.file.bytes, 0),
      rgbaBytesLowerBound: 4 * (32 * 32 + 64 * 64),
      unknownCandidateImageCount: 0,
      approvedSharedImageCount: null,
      approvedSharedBytes: null,
    });
    assert.equal(JSON.stringify(provenance), before);
  }
});

test('approved/shared memory stays unknown even when no candidate override is loaded', () => {
  assert.deepEqual(candidateMemory(null), {
    knownImageCount: 0,
    sourceBytes: 0,
    rgbaBytesLowerBound: 0,
    unknownCandidateImageCount: 0,
    approvedSharedImageCount: null,
    approvedSharedBytes: null,
  });
  assert.equal(candidateMemory({ assets: [] }).unknownCandidateImageCount, null);
});

test('unknown, duplicate and unsafe candidate entries do not become invented bytes', () => {
  const image = (slot, width, height, bytes) => ({
    slot,
    assetRevision: { kind: 'image', file: { width, height, bytes } },
  });
  const memory = candidateMemory({
    kind: 'source-only-actor-comparison',
    assets: [
      image('known', 10, 20, 123),
      image('known', 10, 20, 123),
      image('missing-size', undefined, 20, 123),
      image('bad-size', -10, 20, 123),
      image('unsafe-size', Number.MAX_SAFE_INTEGER, 20, 123),
      image('missing-bytes', 10, 20, undefined),
      null,
    ],
  });
  assert.equal(memory.knownImageCount, 1);
  assert.equal(memory.sourceBytes, 123);
  assert.equal(memory.rgbaBytesLowerBound, 800);
  assert.equal(memory.unknownCandidateImageCount, 6);
  assert.equal(memory.approvedSharedBytes, null);
});
