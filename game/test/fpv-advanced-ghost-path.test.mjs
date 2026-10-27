import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGhostPathCollector,
  MAX_GHOST_PATH_SAMPLES,
  sampleGhostPath,
  validateAircraftCoursePresentation,
} from '../../optional-practice/civilian-fpv/advanced-ghost-path.mjs';

import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

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

function presentation(ticks = 12) {
  const collector = createGhostPathCollector();
  for (let tick = 0; tick <= ticks; tick++) collector.add(sample(tick));
  return {
    format: 'AircraftCoursePresentation.v1',
    aircraft: createPresetConfiguration('meteor75-analog-2022').aircraft,
    completedAtTick: ticks,
    ...collector.snapshot(),
  };
}

test('course presentation owns its aircraft and path while retaining COM metres and exact endpoints', () => {
  const source = presentation(),
    before = structuredClone(source);
  const checked = validateAircraftCoursePresentation(source);
  assert.deepEqual(checked, before);
  assert.notEqual(checked.path, source.path);
  assert.notEqual(checked.aircraft, source.aircraft);
  source.path[0][2] = 44;
  source.aircraft.geometry.rotors[0].position.x += 1;
  assert.deepEqual(checked, before);
  checked.path[1][1] = 42;
  assert.deepEqual(source.path[1], before.path[1]);
});

test('course presentation rejects malformed bounds, schedules, geometry and orientation before use', () => {
  const original = presentation();
  for (const mutate of [
    (s) => {
      s.format = 'unknown';
    },
    (s) => {
      s.maxPathSamples++;
    },
    (s) => {
      s.completedAtTick = -1;
    },
    (s) => {
      s.completedAtTick = Number.MAX_SAFE_INTEGER;
    },
    (s) => {
      s.sourceSampleCount++;
    },
    (s) => {
      s.pathStride = 3;
    },
    (s) => {
      s.pathStride = 2 ** 48 + 1;
    },
    (s) => {
      s.pathStride = 0;
    },
    (s) => {
      s.path = [];
    },
    (s) => {
      s.path = Array(MAX_GHOST_PATH_SAMPLES + 1).fill(s.path[0]);
    },
    (s) => {
      s.path[0][0] = 1;
    },
    (s) => {
      s.path[2][0] = 1;
    },
    (s) => {
      s.path.at(-1)[0]--;
    },
    (s) => {
      s.path[1].push(1);
    },
    (s) => {
      delete s.path[1];
    },
    (s) => {
      delete s.path[1][2];
    },
    (s) => {
      s.path[1][2] = Infinity;
    },
    (s) => {
      s.path[1].splice(4, 4, 0, 0, 0, 0);
    },
    (s) => {
      s.path[1].splice(4, 4, 1e308, 1e308, 1e308, 1e308);
    },
    (s) => {
      s.aircraft.geometry.rotors[0].position.x = NaN;
    },
    (s) => {
      delete s.aircraft;
    },
  ]) {
    const changed = structuredClone(original);
    mutate(changed);
    assert.throws(() => validateAircraftCoursePresentation(changed));
  }
  assert.deepEqual(validateAircraftCoursePresentation(original), original);
});

test('course presentation remains bounded beyond old time ceilings and admits safe long clocks', () => {
  const source = presentation(100000),
    checked = validateAircraftCoursePresentation(source);
  assert.ok(checked.path.length <= MAX_GHOST_PATH_SAMPLES);
  assert.ok(checked.pathStride > 1);
  assert.equal(checked.sourceSampleCount, 100001);
  assert.deepEqual(checked.path[0], sample(0));
  assert.deepEqual(checked.path.at(-1), sample(100000));
  const long = presentation(0);
  long.completedAtTick = 2 ** 48 + 1;
  long.sourceSampleCount = long.completedAtTick + 1;
  long.pathStride = 2 ** 48;
  long.path = [sample(0), sample(2 ** 48), sample(long.completedAtTick)];
  assert.deepEqual(validateAircraftCoursePresentation(long), long);
});
