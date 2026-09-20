import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { COLOR_TRACE_SIZE, proposeColorTrace } from '../game/content-design/color-trace.mjs';

export const TRACE_SAMPLE_COLOR = Object.freeze([40, 180, 140]);
const rectangles = [
  { x: 12, y: 12, w: 4, h: 3 },
  { x: 44, y: 20, w: 7, h: 4 },
  { x: 49, y: 8, w: 2, h: 5 },
];
const member = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Synthetic ground truth, not an artwork generator or real-user accuracy claim. */
export function colorTraceBenchmarkFixtures() {
  return [
    'flat-diagram',
    'two-outlier-samples',
    'minority-speckles',
    'transparent',
    'ambiguous-background',
    'fragmented',
  ].map((name) => {
    const { width, height } = COLOR_TRACE_SIZE,
      data = new Uint8ClampedArray(width * height * 4),
      truth = [];
    for (let y = 0; y < 36; y++)
      for (let x = 0; x < 72; x++) {
        const inside = x > 0 && x < 71 && y > 0 && y < 35;
        const target =
          inside &&
          (name === 'fragmented' ? (x + y) % 2 === 0 : rectangles.some((r) => member(r, x, y)));
        if (target) truth.push(y * 72 + x);
        for (let sample = 0; sample < 9; sample++) {
          let color = target ? [...TRACE_SAMPLE_COLOR] : [5, 12, 18];
          if (name === 'two-outlier-samples' && target)
            color =
              sample < 2
                ? [90, 90, 90]
                : TRACE_SAMPLE_COLOR.map((c, i) => c + (((sample + i) % 3) - 1) * 8);
          if (name === 'minority-speckles' && !target && inside && sample < 3)
            color = [...TRACE_SAMPLE_COLOR];
          if (name === 'ambiguous-background' && !target)
            color = TRACE_SAMPLE_COLOR.map((c) => c + 10);
          const at = ((y * 3 + Math.floor(sample / 3)) * width + x * 3 + (sample % 3)) * 4;
          data.set([...color, name === 'transparent' ? 0 : 255], at);
        }
      }
    return { name, source: { width, height, data }, truth };
  });
}

export function benchmarkColorTracing({ repeats = 7 } = {}) {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 25)
    throw new Error('Benchmark repeats must be1–25.');
  const rows = colorTraceBenchmarkFixtures().map(({ name, source, truth }) => {
    const expected = new Set(truth),
      durations = [];
    let result;
    for (let repeat = 0; repeat < repeats; repeat++) {
      const start = performance.now();
      result = proposeColorTrace(source, { surface: 'foundations', color: TRACE_SAMPLE_COLOR });
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    const actual = new Set(result.selectedCells),
      intersection = [...actual].filter((cell) => expected.has(cell)).length;
    const union = new Set([...actual, ...expected]).size;
    return {
      name,
      truthCells: truth.length,
      selectedCells: actual.size,
      truePositive: intersection,
      falsePositive: actual.size - intersection,
      falseNegative: truth.length - intersection,
      iou: union ? intersection / union : 1,
      uncertainCells: result.uncertainCells.length,
      status: result.status,
      rectangles: result.rectangles.length,
      proposedRectangles: result.proposedRectangleCount,
      medianMs: Number(durations[Math.floor(repeats / 2)].toFixed(3)),
    };
  });
  return {
    format: 'ContentColorTraceBenchmarkV1',
    samplesPerCell: 9,
    raster: COLOR_TRACE_SIZE,
    repeats,
    rows,
    limitations:
      'Synthetic cell-aligned fixtures only. Ambiguous colors deliberately demonstrate failure; no photograph, source-game screenshot, browser decode, human correction time or native-device performance qualification. Proposals do not apply or publish geometry.',
  };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url)
  process.stdout.write(JSON.stringify(benchmarkColorTracing(), null, 2) + '\n');
