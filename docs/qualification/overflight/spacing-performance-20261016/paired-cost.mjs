/** Alternate implementations under the same process/load. CPU kernel evidence only. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
assert.ok(output && !existsSync(output) && !existsSync(output + '.sources.gz'));
const baseline = execFileSync('git', ['show', 'e5ac39905:game/overflight/grid.mjs'], {
  encoding: 'utf8',
});
const candidate = readFileSync(
  new URL('../../../../game/overflight/grid.mjs', import.meta.url),
  'utf8',
);
assert.match(candidate, /const cellSize = (16|32);/);
const texts = {
  original64: baseline,
  fine32: candidate.replace(/const cellSize = (16|32);/, 'const cellSize = 32;'),
  fine16: candidate.replace(/const cellSize = (16|32);/, 'const cellSize = 16;'),
};
const implementations = {};
for (const [id, text] of Object.entries(texts))
  implementations[id] = await import(
    'data:text/javascript;base64,' + Buffer.from(text).toString('base64')
  );
const results = [];
let checksum = 0,
  maxError = 0;
for (const capacity of [1500, 2500])
  for (const crowded of [false, true]) {
    const records = Array.from({ length: capacity }, (_, index) => ({
      id: index + 1,
      active: true,
      radius: 8,
      x: crowded ? 900 + (index % 50) * 4 : 20 + (index % 75) * 37,
      y: crowded ? 430 + Math.floor(index / 50) * 4 : 20 + Math.floor(index / 75) * 31,
    }));
    const versions = Object.entries(implementations).map(([id, api]) => ({
      id,
      api,
      grid: api.createOverflightGrid(2880, 1080, capacity),
      scratch: {},
      samples: [],
    }));
    for (const version of versions) version.api.rebuildOverflightGrid(version.grid, records);
    for (let index = 0; index < records.length; index++) {
      const expected = versions[0].api.overflightCrowdSeparation(versions[0].grid, index, 8, {});
      for (const version of versions.slice(1)) {
        const actual = version.api.overflightCrowdSeparation(
          version.grid,
          index,
          8,
          version.scratch,
        );
        maxError = Math.max(
          maxError,
          Math.abs(actual.x - expected.x),
          Math.abs(actual.y - expected.y),
        );
      }
    }
    for (let iteration = -30; iteration < 120; iteration++)
      for (let offset = 0; offset < versions.length; offset++) {
        const version = versions[(offset + iteration + 30) % versions.length],
          { api, grid, scratch } = version;
        const start = performance.now();
        api.rebuildOverflightGrid(grid, records);
        for (let index = 0; index < records.length; index++) {
          api.overflightCrowdSeparation(grid, index, grid.maxRadius, scratch);
          checksum += scratch.x + scratch.y;
        }
        if (iteration >= 0) version.samples.push(performance.now() - start);
      }
    for (const version of versions) {
      const ms = version.samples.sort((a, b) => a - b);
      results.push({
        version: version.id,
        capacity,
        crowded,
        samples: ms.length,
        mean: ms.reduce((a, b) => a + b, 0) / ms.length,
        p50: ms[60],
        p95: ms[114],
        p99: ms[118],
        worst: ms[119],
        extraIndexBytes: version.grid.local
          ? version.grid.local.heads.byteLength + version.grid.local.next.byteLength
          : 0,
      });
    }
  }
assert.ok(maxError < 1e-12, `Force changed by ${maxError}`);
const sourceHashes = Object.fromEntries(
  Object.entries(texts).map(([id, text]) => [id, createHash('sha256').update(text).digest('hex')]),
);
writeFileSync(output + '.sources.gz', gzipSync(JSON.stringify(texts)));
writeFileSync(
  output,
  JSON.stringify(
    {
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      sourceHashes,
      runtime: process.version,
      platform: process.platform,
      arch: process.arch,
      scope:
        'Alternating grid-rebuild/local-force kernels, 30 warmups and 120 samples per implementation/scene; no render/audio/full simulation; workstation load included.',
      maxError,
      checksum,
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify({ maxError, results }));
