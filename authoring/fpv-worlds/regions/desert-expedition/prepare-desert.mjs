/** Original 16.384 km source preparation. No delivery or player admission is implied. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import {
  EXTENT_M,
  CELL_M,
  SAMPLE_M,
  heightMm,
  surfaceMm,
  districts,
  landmarks,
  starts,
  routes,
} from './desert-design.mjs';

const output = process.argv[2];
assert(output, 'Provide a new output directory');
await mkdir(output, { recursive: false });
await mkdir(resolve(output, 'terrain'));
await mkdir(resolve(output, 'scenery'));
const json = (value) => Buffer.from(JSON.stringify(value) + '\n');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = {
  format: 'FPVRegionManifest.v1',
  id: 'desert-expedition-study',
  revision: 'natural-r1',
  title: {
    en: 'Desert Expedition — natural terrain study',
    uk: 'Пустельна експедиція — дослідження природного рельєфу',
  },
  grid: {
    cellSizeMm: CELL_M * 1000,
    minX: 0,
    minZ: 0,
    width: 32,
    depth: 32,
    floorMm: 0,
    ceilingMm: 1000000,
  },
  assets: [],
  chunks: [],
  spawns: starts.map(({ id, x, z }) => ({
    id,
    position: { x: x * 1000, y: Math.ceil(surfaceMm(x, z) + 3000), z: z * 1000 },
  })),
};
for (const spawn of manifest.spawns)
  for (const value of Object.values(spawn.position))
    assert(Number.isSafeInteger(value), 'Authored starts use integer global millimetres');
const previousRow = new Map(),
  windows = [],
  treeHash = createHash('sha256');
let sourceBytes = 0,
  seams = 0,
  minHeight = Infinity,
  maxHeight = -Infinity,
  maxSlope = 0,
  maxCellBytes = 0;
for (let z = 0; z < 32; z++) {
  let previous;
  for (let x = 0; x < 32; x++) {
    const id = `desert-${x}-${z}`;
    const cell = {
      format: 'FPVRegionCollision.v1',
      chunkId: id,
      x,
      z,
      cellSizeMm: CELL_M * 1000,
      samples: 33,
      heightsMm: [],
    };
    for (let iz = 0; iz < 33; iz++)
      for (let ix = 0; ix < 33; ix++)
        cell.heightsMm.push(heightMm(x * CELL_M + ix * SAMPLE_M, z * CELL_M + iz * SAMPLE_M));
    if (previous) {
      validateTerrainSeams([previous, cell]);
      seams++;
    }
    if (previousRow.has(x)) {
      validateTerrainSeams([previousRow.get(x), cell]);
      seams++;
    }
    previous = cell;
    previousRow.set(x, cell);
    for (let iz = 0; iz < 33; iz++)
      for (let ix = 0; ix < 33; ix++) {
        const h = cell.heightsMm[iz * 33 + ix];
        minHeight = Math.min(minHeight, h);
        maxHeight = Math.max(maxHeight, h);
        for (const j of [ix < 32 ? iz * 33 + ix + 1 : -1, iz < 32 ? (iz + 1) * 33 + ix : -1])
          if (j >= 0)
            maxSlope = Math.max(maxSlope, Math.abs(h - cell.heightsMm[j]) / (SAMPLE_M * 1000));
      }
    const compiled = compileTerrainCell(cell),
      bodies = { scene: Buffer.from(compiled.glb), collision: json(cell) };
    let cellBytes = 0;
    const writes = [];
    for (const [kind, body] of Object.entries(bodies)) {
      const path = `${id}.${kind === 'scene' ? 'glb' : 'json'}`;
      assert(kind !== 'collision' || body.length <= 16384);
      writes.push(writeFile(resolve(output, 'terrain', path), body));
      const digest = sha(body);
      manifest.assets.push({ id: `${id}-${kind}`, kind, path, bytes: body.length, sha256: digest });
      treeHash.update(path + ':' + digest + '\n');
      sourceBytes += body.length;
      cellBytes += body.length;
    }
    await Promise.all(writes);
    maxCellBytes = Math.max(maxCellBytes, cellBytes);
    manifest.chunks.push({ id, x, z, assets: [`${id}-scene`, `${id}-collision`] });
    if (x === 0 || x === 31 || z === 0 || z === 31 || (x % 4 === 2 && z % 4 === 2))
      windows.push({ x, z });
  }
}
assert.equal(seams, 1984);
validateRegionManifest(manifest);
const bytes = json(manifest);
await writeFile(resolve(output, 'terrain', 'region.json'), bytes);
sourceBytes += bytes.length;
const sparse = {
  ...manifest,
  format: 'FPVSceneryManifest.v1',
  assets: [],
  chunks: manifest.chunks.map((c) => ({ ...c, assets: [] })),
};
validateRegionManifest(sparse);
const sparseBytes = json(sparse);
await writeFile(resolve(output, 'scenery', 'region.json'), sparseBytes);
sourceBytes += sparseBytes.length;
assert(
  sourceBytes < 64 * 1024 * 1024,
  'Terrain source must fit existing optional delivery ceiling before descriptor',
);
const routeSamples = routes.map((route) => {
  const points = [];
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1],
      b = route.points[i];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = Math.ceil(length / 32);
    for (let j = 0; j <= count; j++) {
      if (i > 1 && j === 0) continue;
      const x = a[0] + ((b[0] - a[0]) * j) / count,
        z = a[1] + ((b[1] - a[1]) * j) / count;
      points.push([x, surfaceMm(x, z) / 1000 + route.clearanceM, z]);
    }
  }
  return { ...route, points };
});
const receipt = {
  id: manifest.id,
  revision: manifest.revision,
  actualExtentM: [EXTENT_M, EXTENT_M],
  grid: manifest.grid,
  cells: 1024,
  assets: 2048,
  sourceBytes,
  manifestBytes: bytes.length,
  manifestSHA256: sha(bytes),
  sparseManifestBytes: sparseBytes.length,
  sparseManifestSHA256: sha(sparseBytes),
  sourceTreeSHA256: treeHash.digest('hex'),
  minHeightMm: minHeight,
  maxHeightMm: maxHeight,
  maxAdjacentSlope: maxSlope,
  cellSampleSpacingM: SAMPLE_M,
  seams,
  districts,
  landmarks: landmarks.map(([id, x, z, rx, rz, rise]) => ({
    id,
    x,
    z,
    designRadiusM: [rx, rz],
    authoredRiseM: rise,
    surfaceHeightMm: surfaceMm(x, z),
  })),
  routes: routeSamples,
  representativeWindows: windows,
  conservativeNineCellSourceBytes: maxCellBytes * 9,
  pairedSparseScenerySupported: true,
  provenance:
    'Original analytic relief and landmark composition authored for RevealLine; no imported mesh or scaled arrival terrain.',
  priorCanyonSourcesUnchanged: true,
  playerReady: false,
  canonicalProductionWindowVerification: false,
  commandedFlightVerification: false,
  limitations: [
    'Terrain-only source with an explicit empty scenery companion; no detailed mesh landmarks are supplied.',
    '16 m samples are for broad natural relief. Narrow gaps, overhangs and detailed terrain require separately authored scenery.',
    'Extent is source coverage, not a qualified playable release or final art standard.',
  ],
};
await writeFile(
  resolve(output, 'preparation.json'),
  Buffer.from(JSON.stringify(receipt, null, 2) + '\n'),
);
console.log(
  JSON.stringify(
    { ...receipt, routes: routeSamples.length, representativeWindows: windows.length },
    null,
    2,
  ),
);
