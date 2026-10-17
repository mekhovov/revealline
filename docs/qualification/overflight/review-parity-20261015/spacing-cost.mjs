/** CPU-only steering cost, not a render-cadence or target-device qualification. */
import assert from 'node:assert/strict';
import { writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import {
  createOverflightGrid,
  rebuildOverflightGrid,
  overflightCrowdSeparation,
} from '../../../../game/overflight/grid.mjs';
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
assert.ok(output && !existsSync(output), 'Choose a new output file.');
const results = [];
let checksum = 0;
for (const capacity of [1500, 2500])
  for (const crowded of [false, true]) {
    const records = Array.from({ length: capacity }, (_, index) => ({
      id: index + 1,
      active: true,
      radius: 8,
      x: crowded ? 900 + (index % 50) * 4 : 20 + (index % 75) * 37,
      y: crowded ? 430 + Math.floor(index / 50) * 4 : 20 + Math.floor(index / 75) * 31,
    }));
    const grid = createOverflightGrid(2880, 1080, capacity),
      scratch = { x: 0, y: 0 };
    const trial = () => {
      const start = performance.now();
      rebuildOverflightGrid(grid, records);
      for (let index = 0; index < records.length; index++) {
        overflightCrowdSeparation(grid, index, grid.maxRadius, scratch);
        checksum += scratch.x + scratch.y;
      }
      return performance.now() - start;
    };
    for (let warmup = 0; warmup < 30; warmup++) trial();
    const ms = Array.from({ length: 120 }, trial).sort((a, b) => a - b);
    results.push({
      capacity,
      scene: crowded ? 'packed 4-unit lattice' : 'distributed 37x31 lattice',
      samples: ms.length,
      average: ms.reduce((a, b) => a + b, 0) / ms.length,
      p50: ms[60],
      p95: ms[114],
      p99: ms[118],
      worst: ms[119],
    });
  }
writeFileSync(
  output,
  JSON.stringify(
    {
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      runtime: process.version,
      platform: process.platform,
      arch: process.arch,
      scope:
        'Grid rebuild and local steering only; no simulation, renderer, audio or frame pacing. Concurrent workstation load retained.',
      checksum,
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(results));
