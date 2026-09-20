import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_TRACE_SIZE, proposeColorTrace } from '../content-design/color-trace.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { inspectManualImageMap } from '../content-design/image-authoring.mjs';
import {
  colorTraceBenchmarkFixtures,
  TRACE_SAMPLE_COLOR,
  benchmarkColorTracing,
} from '../../scripts/content-tracing-benchmark.mjs';

const options = { surface: 'foundations', color: TRACE_SAMPLE_COLOR };
test('flat and noisy diagrams produce exact interior rectangles; uncertain pixels remain explicit', () => {
  const fixtures = colorTraceBenchmarkFixtures();
  for (const name of ['flat-diagram', 'two-outlier-samples', 'minority-speckles']) {
    const { source, truth } = fixtures.find((f) => f.name === name),
      before = source.data.slice();
    const result = proposeColorTrace(source, options);
    assert.equal(result.status, 'inspect-required');
    assert.deepEqual(result.selectedCells, truth);
    assert.equal(result.rectangles.length, 3);
    const raster = new Set();
    for (const r of result.rectangles)
      for (let y = r.y; y < r.y + r.h; y++)
        for (let x = r.x; x < r.x + r.w; x++) raster.add(y * 72 + x);
    assert.deepEqual(
      [...raster].sort((a, b) => a - b),
      truth,
    );
    assert.deepEqual(source.data, before);
    assert(
      Object.isFrozen(result) &&
        Object.isFrozen(result.rectangles) &&
        result.rectangles.every(Object.isFrozen),
    );
    if (name === 'minority-speckles')
      assert.equal(result.uncertainCells.length, 2380 - truth.length);
    else assert.equal(result.uncertainCells.length, 0);
  }
});

test('transparent samples and fragmented masks never silently create or truncate usable geometry', () => {
  const fixtures = colorTraceBenchmarkFixtures();
  const transparent = proposeColorTrace(
    fixtures.find((f) => f.name === 'transparent').source,
    options,
  );
  assert.equal(transparent.status, 'no-match');
  assert.deepEqual(transparent.rectangles, []);
  const fragmented = proposeColorTrace(
    fixtures.find((f) => f.name === 'fragmented').source,
    options,
  );
  assert.equal(fragmented.status, 'too-fragmented');
  assert(fragmented.proposedRectangleCount > 128);
  assert.deepEqual(fragmented.rectangles, []);
});

test('proposals carry no apply authority and use the existing shared compiler inspection', () => {
  const source = createStarterProject(),
    before = JSON.stringify(source);
  const proposal = proposeColorTrace(colorTraceBenchmarkFixtures()[0].source, options);
  const inspected = inspectManualImageMap(source, 'nearby-shore', proposal.rectangles);
  assert.equal(JSON.stringify(source), before);
  assert.notEqual(inspected.candidate, source);
  assert(!inspected.diagnostics.some((row) => row.severity === 'error'));
  assert.equal(Object.hasOwn(proposal, 'candidate'), false);
  assert.equal(Object.hasOwn(proposal, 'publish'), false);
  assert.equal(Object.hasOwn(proposal, 'apply'), false);
  assert.equal(JSON.stringify(inspected.candidate).includes('data:image'), false);
});

test('color meaning is explicit and bounded; unsafe pixel/options shapes are rejected without getters', () => {
  const source = colorTraceBenchmarkFixtures()[0].source;
  for (const change of [
    { surface: 'spawn' },
    { color: [0, 0] },
    { color: [256, 0, 0] },
    { backgroundColor: [0, 0] },
    { backgroundColor: [0, -1, 0] },
    { backgroundColor: TRACE_SAMPLE_COLOR },
    { backgroundColor: [40, 180, 147] },
    { tolerance: 65 },
    { tolerance: -1 },
    { minMatches: 4 },
    { minMatches: 10 },
    { apply: true },
  ])
    assert.throws(() => proposeColorTrace(source, { ...options, ...change }));
  for (const invalid of [
    { ...source, width: 72 },
    { ...source, data: new Uint8Array(source.data.length) },
    { ...source, data: new Uint8ClampedArray(4) },
    { ...source, [Symbol('extra')]: true },
  ])
    assert.throws(() => proposeColorTrace(invalid, options));
  let called = false;
  assert.throws(() =>
    proposeColorTrace(
      {
        width: 216,
        height: 108,
        get data() {
          called = true;
          return source.data;
        },
      },
      options,
    ),
  );
  assert.throws(() =>
    proposeColorTrace(source, {
      surface: 'walls',
      get color() {
        called = true;
        return TRACE_SAMPLE_COLOR;
      },
    }),
  );
  assert.equal(called, false);
  if (typeof SharedArrayBuffer === 'function')
    assert.throws(
      () =>
        proposeColorTrace(
          {
            ...COLOR_TRACE_SIZE,
            data: new Uint8ClampedArray(new SharedArrayBuffer(source.data.length)),
          },
          options,
        ),
      /Shared sample/,
    );
});

test('benchmark exposes ambiguity failure instead of claiming general screenshot recognition', () => {
  const report = benchmarkColorTracing({ repeats: 1 });
  assert.equal(report.rows.length, 7);
  for (const row of report.rows.slice(0, 3)) assert.equal(row.iou, 1, row.name);
  const ambiguous = report.rows.find((row) => row.name === 'ambiguous-background');
  assert(ambiguous.falsePositive > 2000);
  assert(ambiguous.iou < 0.05);
  const explicitBackground = report.rows.find((row) => row.name === 'explicit-background-sample');
  assert.equal(explicitBackground.iou, 1);
  assert.equal(explicitBackground.falsePositive, 0);
  assert.equal(explicitBackground.explicitBackgroundSample, true);
  const invalidProposal = proposeColorTrace(
    colorTraceBenchmarkFixtures().find((row) => row.name === 'ambiguous-background').source,
    options,
  );
  const source = createStarterProject(),
    before = JSON.stringify(source);
  assert.throws(() => inspectManualImageMap(source, 'nearby-shore', invalidProposal.rectangles));
  assert.equal(JSON.stringify(source), before, 'A broad color match cannot bypass map validation.');
  assert.match(report.limitations, /no photograph/);
  for (const repeats of [0, 26, 0.5]) assert.throws(() => benchmarkColorTracing({ repeats }));
});

test('an explicit contrasting background sample removes the known flat false positives without changing default behavior', () => {
  const { source, truth } = colorTraceBenchmarkFixtures().find(
    (f) => f.name === 'ambiguous-background',
  );
  const before = source.data.slice();
  const result = proposeColorTrace(source, {
    ...options,
    backgroundColor: TRACE_SAMPLE_COLOR.map((channel) => channel + 10),
  });
  assert.deepEqual(result.selectedCells, truth);
  assert.equal(result.status, 'inspect-required');
  assert.equal(result.rectangles.length, 3);
  assert.equal(result.uncertainCells.length, 0);
  assert.deepEqual(source.data, before);
  assert.equal(
    proposeColorTrace(source, options).selectedCells.length,
    2380,
    'The original unsupervised color ambiguity remains measured, not hidden.',
  );
});

test('pixels between target and background samples are abstentions, never inferred collision', () => {
  const { source } = colorTraceBenchmarkFixtures()[0];
  const midpoint = TRACE_SAMPLE_COLOR.map((channel) => channel + 5);
  for (let at = 0; at < source.data.length; at += 4) source.data.set([...midpoint, 255], at);
  const result = proposeColorTrace(source, {
    ...options,
    backgroundColor: TRACE_SAMPLE_COLOR.map((channel) => channel + 10),
  });
  assert.equal(result.status, 'no-match');
  assert.equal(result.selectedCells.length, 0);
  assert.equal(result.uncertainCells.length, 2380);
  assert.deepEqual(result.rectangles, []);
});
