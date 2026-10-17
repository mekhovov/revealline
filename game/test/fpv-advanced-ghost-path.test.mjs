import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGhostPathCollector,
  MAX_GHOST_PATH_SAMPLES,
  sampleGhostPath,
} from '../../optional-practice/civilian-fpv/advanced-ghost-path.mjs';

const sample = (tick) => [tick, tick / 50, 2 * tick, -tick, 0, 0, 0, 1];

test('long ghost histories have a fixed budget with exact endpoints and monotonic source ticks', () => {
  const collector = createGhostPathCollector({ maxSamples: 32 });
  for (let tick = 71999; tick < 171999; tick++) {
    collector.add(sample(tick));
    if (tick % 1000 === 0) assert.ok(collector.snapshot().path.length <= 32);
  }
  const result = collector.snapshot();
  assert.equal(result.sourceSampleCount, 100000);
  assert.ok(result.pathStride > 1);
  assert.ok(result.path.length <= 32);
  assert.deepEqual(result.path[0], sample(71999));
  assert.deepEqual(result.path.at(-1), sample(171998));
  for (let i = 1; i < result.path.length; i++) assert.ok(result.path[i][0] > result.path[i - 1][0]);
  assert.deepEqual(sampleGhostPath(result.path, 100000), sample(100000));
  result.path[0][1] = 999;
  assert.deepEqual(collector.snapshot().path[0], sample(71999));
});

test('short flights retain all samples; malformed and missing source ticks are rejected atomically', () => {
  const collector = createGhostPathCollector();
  assert.equal(collector.snapshot().maxPathSamples, MAX_GHOST_PATH_SAMPLES);
  assert.deepEqual(collector.snapshot().path, []);
  for (let tick = 100; tick <= 104; tick++) collector.add(sample(tick));
  const before = collector.snapshot();
  for (const invalid of [sample(104), sample(106), [105], sample(105).fill(NaN)])
    assert.throws(() => collector.add(invalid), /Invalid/);
  assert.deepEqual(collector.snapshot(), before);
  collector.add(sample(105));
  assert.equal(collector.snapshot().path.length, 6);
  assert.deepEqual(sampleGhostPath(before.path, -10), sample(100));
  assert.deepEqual(sampleGhostPath(before.path, 1000), sample(104));
  assert.equal(sampleGhostPath([], 1), null);
  assert.equal(sampleGhostPath(before.path, NaN), null);
  for (const maxSamples of [1, 7, 8193, 9.5, Infinity])
    assert.throws(() => createGhostPathCollector({ maxSamples }));
});

test('display interpolation follows the shortest quaternion arc without changing verification samples', () => {
  const path = [
    [0, 0, 0, 0, 0, 0, 0, 1],
    [10, 10, 20, 30, 0, 0, -Math.SQRT1_2, -Math.SQRT1_2],
  ];
  const original = structuredClone(path),
    point = sampleGhostPath(path, 5);
  assert.deepEqual(point.slice(0, 4), [5, 5, 10, 15]);
  assert.ok(Math.abs(point[6] - Math.sin(Math.PI / 8)) < 1e-12);
  assert.ok(Math.abs(point[7] - Math.cos(Math.PI / 8)) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...point.slice(4)) - 1) < 1e-12);
  assert.deepEqual(path, original);
});

test('sampling remains bounded under repeated final-point reads and deterministic across runs', () => {
  const first = createGhostPathCollector({ maxSamples: 8 }),
    second = createGhostPathCollector({ maxSamples: 8 });
  for (let tick = 0; tick < 250; tick++) {
    first.add(sample(tick));
    second.add(sample(tick));
    assert.ok(first.snapshot().path.length <= 8);
    assert.deepEqual(first.snapshot(), second.snapshot());
  }
});
