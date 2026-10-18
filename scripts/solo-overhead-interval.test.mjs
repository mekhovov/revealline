import assert from 'node:assert/strict';
import test from 'node:test';
import {
  overheadP95Bounds,
  overheadLogRatioBounds,
  overheadPairedBox,
} from './solo-overhead-interval.mjs';
// This *.test.mjs entry point also runs the complete existing analyzer
// contracts, so changed-test CI admission covers their prospective boundaries.
import './test-solo-diagnostics-analysis.mjs';
import './test-solo-journal-cost-analysis.mjs';

const close = (a, b) => assert(Math.abs(a - b) < 1e-12, `${a} versus ${b}`);
const p95 = (xs) => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1];

// Independent interval expression uses pairwise squared distances, not the
// production centered-variance loop: sum_{i<j}(xi-xj)^2 = n*sum_i(xi-mean)^2.
function interval(xs, critical) {
  const n = xs.length;
  let distances = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) distances += (xs[i] - xs[j]) ** 2;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const margin = critical * Math.sqrt(distances / (n * n * (n - 1)));
  return [mean - margin, mean + margin];
}

test('exact box encloses exhaustive asymmetric interiors and correlated endpoint choices', () => {
  for (const [bounds, critical] of [
    [
      [
        [-0.1, 0.2],
        [0.05, 0.3],
        [-0.2, -0.05],
      ],
      4.304,
    ],
    [
      [
        [0, 0],
        [-0.2, 0.5],
        [0, 0.1],
      ],
      4.304,
    ],
    [
      [
        [-0.8, 0.1],
        [-0.3, 0.2],
        [-0.01, 0.6],
        [0.1, 0.3],
      ],
      3.183,
    ],
  ]) {
    const result = overheadPairedBox(bounds.map(([lower, upper]) => ({ lower, upper })));
    let min = Infinity,
      max = -Infinity;
    // Includes all vertices and interior points without sharing enumeration
    // code with the production helper. The all-low/all-high choices include
    // perfectly correlated errors, which must not be averaged away.
    function visit(xs) {
      if (xs.length === bounds.length) {
        const [low, high] = interval(xs, critical);
        assert(low >= result.lowerLog - 1e-12 && high <= result.upperLog + 1e-12);
        min = Math.min(min, low);
        max = Math.max(max, high);
        return;
      }
      const [low, high] = bounds[xs.length];
      for (let k = 0; k <= 10; k++) visit([...xs, low + ((high - low) * k) / 10]);
    }
    visit([]);
    close(min, result.lowerLog);
    close(max, result.upperLog);
  }
});

test('ten equal pair boxes agree with the independent eleven-count closed form', () => {
  const a = Math.log(6.4 / 6.2),
    n = 10;
  let upper = -Infinity;
  for (let k = 0; k <= n; k++)
    upper = Math.max(
      upper,
      (a * (2 * k - n)) / n + 2 * 2.263 * a * Math.sqrt((k * (n - k)) / (n * n * (n - 1))),
    );
  const result = overheadPairedBox(Array.from({ length: n }, () => ({ lower: -a, upper: a })));
  close(result.lowerLog, -upper);
  close(result.upperLog, upper);
  assert.equal(result.vertices, 1024);
  assert.equal(result.pairs, 10);
  assert.equal(result.degreesOfFreedom, 9);
  assert(result.upper95 > 0.04 && result.upper95 < 0.041);
});

test('fixed intervals reduce to the original Student-t endpoints; wider errors cannot narrow them', () => {
  const xs = Array.from({ length: 10 }, (_, i) => (i - 4) * 0.01),
    original = interval(xs, 2.263),
    fixed = overheadPairedBox(xs.map((x) => ({ lower: x, upper: x }))),
    small = overheadPairedBox(xs.map((x, i) => ({ lower: x - i * 0.001, upper: x + 0.002 }))),
    large = overheadPairedBox(xs.map((x, i) => ({ lower: x - i * 0.001 - 0.03, upper: x + 0.02 })));
  close(fixed.lowerLog, original[0]);
  close(fixed.upperLog, original[1]);
  assert(small.lowerLog <= fixed.lowerLog && small.upperLog >= fixed.upperLog);
  assert(large.lowerLog <= small.lowerLog && large.upperLog >= small.upperLog);
});

test('sample-specific p95 bounds survive rank reordering, zero durations and correlated errors', () => {
  const values = Array.from({ length: 20 }, (_, i) => (i === 0 ? 0 : 1 + i * 0.01)),
    counts = Array.from({ length: 20 }, (_, i) => (i === 18 ? 40 : 2)),
    quantum = 0.01,
    before = JSON.stringify({ values, counts }),
    bounds = overheadP95Bounds(values, quantum, counts);
  close(bounds.lower, 1.15);
  close(bounds.upper, 1.21);
  // The old rank's interval is not the p95 interval after unequal errors.
  assert.notEqual(bounds.lower, Math.max(0, values[18] - quantum * counts[18]));
  for (let step = 0; step <= 100; step++) {
    const uniform = values.map(
      (v, i) =>
        Math.max(0, v - quantum * counts[i]) +
        ((v + quantum * counts[i] - Math.max(0, v - quantum * counts[i])) * step) / 100,
    );
    const alternating = values.map(
      (v, i) =>
        Math.max(0, v - quantum * counts[i]) +
        ((v + quantum * counts[i] - Math.max(0, v - quantum * counts[i])) *
          (i % 2 ? step : 100 - step)) /
          100,
    );
    for (const permitted of [uniform, alternating]) {
      const actual = p95(permitted);
      assert(actual >= bounds.lower - 1e-12 && actual <= bounds.upper + 1e-12);
    }
  }
  assert.equal(JSON.stringify({ values, counts }), before);
  assert.deepEqual(overheadP95Bounds([0, 0, 0], 0.1, [2, 4, 6]), {
    lower: 0,
    upper: 0.6000000000000001,
  });
});

test('changing duration units with their error bounds preserves relative interval', () => {
  const calculate = (scale) => {
    const pairs = Array.from({ length: 10 }, (_, i) =>
      overheadLogRatioBounds(
        overheadP95Bounds([6.3 * scale, (6.4 + i * 0.01) * scale], 0.1 * scale),
        overheadP95Bounds([6.2 * scale, 6.3 * scale], 0.1 * scale),
      ),
    );
    return overheadPairedBox(pairs);
  };
  const base = calculate(1),
    scaled = calculate(1000);
  close(base.lower95, scaled.lower95);
  close(base.upper95, scaled.upper95);
});

test('malformed, nonpositive and over-cap arithmetic cannot produce a prospective interval', () => {
  for (const call of [
    () => overheadPairedBox(Array(11).fill({ lower: 0, upper: 1 })),
    () => overheadPairedBox(Array(2).fill({ lower: 0, upper: 1 })),
    () => overheadPairedBox(Array(3).fill({ lower: 1, upper: 0 })),
    () => overheadPairedBox(Array(3).fill({ lower: 0, upper: Infinity })),
    () => overheadPairedBox(Array(3).fill({ lower: 0, upper: 1e308 })),
    () => overheadP95Bounds([], 0.1),
    () => overheadP95Bounds(Array(16385).fill(1), 0.1),
    () => overheadP95Bounds([1], NaN),
    () => overheadP95Bounds([-1], 0.1),
    () => overheadP95Bounds([1], 0.1, []),
    () => overheadP95Bounds([1], 0.1, [0]),
    () => overheadP95Bounds([1], 0.1, [655363]),
    () => overheadP95Bounds([1e308], 1e308, [2]),
    () => overheadLogRatioBounds({ lower: 0, upper: 1 }, { lower: 1, upper: 2 }),
    () => overheadLogRatioBounds({ lower: 1, upper: 2 }, { lower: 0, upper: 1 }),
  ])
    assert.throws(call);
});
