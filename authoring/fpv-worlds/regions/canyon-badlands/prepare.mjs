import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { districts, extent, heightMm, landmarks, routes, surfaceMm } from './design.mjs';
import { overview } from './overview.mjs';
const destination = process.argv[2];
if (!destination)
  throw Error('Provide a new output directory. No default player output is written.');
const output = resolve(destination);
await mkdir(output, { recursive: false });
await mkdir(resolve(output, 'terrain'));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const manifest = {
  format: 'FPVRegionManifest.v1',
  id: 'canyon-badlands-study',
  revision: 'r1',
  title: { en: 'Canyon Badlands — terrain study', uk: 'Каньйон — дослідження рельєфу' },
  grid: { cellSizeMm: 128000, minX: 0, minZ: 0, width: 6, depth: 6, floorMm: 0, ceilingMm: 350000 },
  assets: [],
  chunks: [],
  spawns: [],
};
const cells = new Map();
for (let z = 0; z < 6; z++)
  for (let x = 0; x < 6; x++) {
    const id = `canyon-${x}-${z}`;
    const cell = {
      format: 'FPVRegionCollision.v1',
      chunkId: id,
      x,
      z,
      cellSizeMm: 128000,
      samples: 33,
      heightsMm: [],
    };
    for (let iz = 0; iz < 33; iz++)
      for (let ix = 0; ix < 33; ix++)
        cell.heightsMm.push(heightMm(x * 128 + ix * 4, z * 128 + iz * 4));
    const compiled = compileTerrainCell(cell),
      source = Buffer.from(JSON.stringify(cell));
    for (const [kind, suffix, bytes] of [
      ['scene', 'glb', compiled.glb],
      ['collision', 'json', source],
    ]) {
      const path = `terrain/${id}.${suffix}`;
      await writeFile(resolve(output, path), bytes);
      manifest.assets.push({
        id: `${id}-${kind}`,
        path,
        sha256: hash(bytes),
        bytes: bytes.length,
        kind,
      });
    }
    manifest.chunks.push({ id, x, z, assets: [`${id}-scene`, `${id}-collision`] });
    cells.set(`${x},${z}`, cell);
  }
let seams = 0;
for (const cell of cells.values())
  for (const next of [cells.get(`${cell.x + 1},${cell.z}`), cells.get(`${cell.x},${cell.z + 1}`)])
    if (next) {
      validateTerrainSeams([cell, next]);
      seams++;
    }
for (const [id, x, z] of [
  ['basin', 110, 100],
  ['mesa', 680, 215],
  ['shelf', 670, 700],
])
  manifest.spawns.push({
    id,
    position: { x: x * 1000, y: Math.ceil(surfaceMm(x, z) + 3000), z: z * 1000 },
  });
validateRegionManifest(manifest);
const routeChecks = routes.map((route) => {
  let samples = 0,
    minClearanceM = Infinity,
    lengthM = 0;
  for (let segment = 1; segment < route.points.length; segment++) {
    const a = route.points[segment - 1],
      b = route.points[segment];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengthM += length;
    for (let n = 0; n <= Math.ceil(length); n++) {
      const t = n / Math.ceil(length),
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t,
        y = a[2] + (b[2] - a[2]) * t;
      for (const offset of [-route.halfWidthM, 0, route.halfWidthM]) {
        const px = x - ((b[1] - a[1]) / length) * offset,
          pz = z + ((b[0] - a[0]) / length) * offset;
        assert(px >= 0 && px <= 768 && pz >= 0 && pz <= 768);
        minClearanceM = Math.min(minClearanceM, y - surfaceMm(px, pz) / 1000);
        samples++;
      }
    }
  }
  assert(
    minClearanceM >= route.clearanceM,
    `${route.id}: only ${minClearanceM.toFixed(2)} m terrain clearance`,
  );
  return {
    id: route.id,
    samples,
    lengthM: Math.round(lengthM),
    corridorWidthM: route.halfWidthM * 2,
    minClearanceM: +minClearanceM.toFixed(3),
    requiredClearanceM: route.clearanceM,
  };
});
const heights = [...cells.values()].flatMap((cell) => cell.heightsMm);
const metadata = {
  format: 'FPVCanyonDesign.v1',
  extent,
  districts,
  landmarks: landmarks.map((landmark) => ({
    ...landmark,
    terrainHeightMm: Math.round(surfaceMm(landmark.x, landmark.z)),
  })),
  routes,
  sceneStatus: 'Authoring preparation only; no player flight admission',
  source:
    'Original authored terrain, channels, terraces, landmarks and routes; no third-party model bytes included',
};
const receipt = {
  format: 'FPVCanyonPreparation.v1',
  extent,
  chunks: cells.size,
  assets: manifest.assets.length,
  sourceBytes: manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0),
  terrainTriangles: cells.size * 2048,
  sharedEdgesVerified: seams,
  heightRangeM: [Math.min(...heights) / 1000, Math.max(...heights) / 1000],
  districts: districts.length,
  landmarks: landmarks.length,
  spawns: manifest.spawns.length,
  routes: routeChecks,
  manifestSHA256: hash(JSON.stringify(manifest)),
  flightReady: false,
  limitations: [
    '4 m heightfield has no caves or overhangs',
    'Route checks are sampled geometric clearance, not flight simulation or scored lessons',
    'Canonical terrain material remains the shared neutral material; sandstone tint is authoring preview only',
    'No textures or candidate CC0 scenery admitted yet',
    '8.192 km target is not implemented by this 768 m representative',
  ],
};
for (const [name, value] of [
  ['region.json', manifest],
  ['design.json', metadata],
  ['preparation.json', receipt],
])
  await writeFile(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
await writeFile(resolve(output, 'overview.html'), overview(metadata));
console.log(JSON.stringify(receipt, null, 2));
