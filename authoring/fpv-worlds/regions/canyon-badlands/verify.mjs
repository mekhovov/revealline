/** Read-only admission of generated authoring artifacts; does not run or award a flight. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { validateRegionManifest } from '../region-manifest.mjs';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
const root = process.argv[2];
assert(root, 'Provide the prepared output directory.');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const manifest = validateRegionManifest(await json(resolve(root, 'region.json')));
const design = await json(resolve(root, 'design.json'));
const receipt = await json(resolve(root, 'preparation.json'));
assert.equal(hash(JSON.stringify(manifest)), receipt.manifestSHA256);
assert.equal(manifest.grid.width * 128, 768);
assert.equal(manifest.grid.depth * 128, 768);
assert.equal(design.districts.length, 6);
assert.equal(design.landmarks.length, 12);
assert.equal(manifest.spawns.length, 3);
const cells = new Map(),
  assets = new Map();
for (const asset of manifest.assets) {
  const bytes = await readFile(resolve(root, asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(hash(bytes), asset.sha256);
  assets.set(asset.id, bytes);
}
for (const chunk of manifest.chunks) {
  const source = JSON.parse(assets.get(`${chunk.id}-collision`));
  const compiled = compileTerrainCell(source);
  assert.deepEqual(Buffer.from(compiled.glb), assets.get(`${chunk.id}-scene`));
  cells.set(`${source.x},${source.z}`, source);
}
let edges = 0;
for (const cell of cells.values())
  for (const neighbour of [
    cells.get(`${cell.x + 1},${cell.z}`),
    cells.get(`${cell.x},${cell.z + 1}`),
  ])
    if (neighbour) {
      validateTerrainSeams([cell, neighbour]);
      edges++;
    }
assert.equal(edges, 60);
// Use prepared source samples, independently of design.mjs and its height equation.
const ground = (x, z) => {
  const cx = Math.min(5, Math.floor(x / 128)),
    cz = Math.min(5, Math.floor(z / 128));
  const cell = cells.get(`${cx},${cz}`);
  assert(cell, 'Route leaves prepared region');
  const lx = (x - cx * 128) / 4,
    lz = (z - cz * 128) / 4;
  const ix = Math.min(31, Math.floor(lx)),
    iz = Math.min(31, Math.floor(lz));
  const u = lx - ix,
    v = lz - iz,
    i = iz * 33 + ix;
  const [a, b, c, d] = [
    cell.heightsMm[i],
    cell.heightsMm[i + 1],
    cell.heightsMm[i + 33],
    cell.heightsMm[i + 34],
  ];
  return (
    (u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v)) / 1000
  );
};
let routeSamples = 0;
for (const route of design.routes) {
  let minimum = Infinity;
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1],
      b = route.points[i];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    for (let s = 0; s <= Math.ceil(length); s++)
      for (const offset of [-route.halfWidthM, 0, route.halfWidthM]) {
        const t = s / Math.ceil(length),
          x = a[0] + dx * t - (dz / length) * offset,
          z = a[1] + dz * t + (dx / length) * offset;
        minimum = Math.min(minimum, a[2] + (b[2] - a[2]) * t - ground(x, z));
        routeSamples++;
      }
  }
  assert(minimum >= route.clearanceM, `${route.id} corridor fails clearance`);
  assert.equal(+minimum.toFixed(3), receipt.routes.find((r) => r.id === route.id).minClearanceM);
}
for (const spawn of manifest.spawns)
  assert(spawn.position.y / 1000 - ground(spawn.position.x / 1000, spawn.position.z / 1000) >= 3);
const sourceReceipt = await json(new URL('./source/receipt.json', import.meta.url));
const model = await readFile(new URL('./source/canyon-rocks-plants.glb', import.meta.url));
assert.equal(hash(model), sourceReceipt.modelSHA256);
assert.equal(model.length, sourceReceipt.modelBytes);
assert.equal(model.readUInt32LE(0), 0x46546c67);
assert.equal(model.readUInt32LE(8), model.length);
const modelJSON = JSON.parse(model.subarray(20, 20 + model.readUInt32LE(12)));
assert.equal(modelJSON.meshes.length, 160);
assert.equal(modelJSON.nodes.length, 160);
assert.equal(modelJSON.materials.length, 5);
assert.equal(modelJSON.images?.length ?? 0, 0);
assert.equal(modelJSON.extensionsRequired?.length ?? 0, 0);
assert.equal(receipt.flightReady, false);
console.log(
  JSON.stringify(
    {
      format: 'FPVCanyonArtifactVerification.v1',
      node: process.version,
      assetsVerified: assets.size,
      exactCanonicalScenes: cells.size,
      sharedEdges: edges,
      routeSamples,
      candidateSourceGLBHash: sourceReceipt.modelSHA256,
      flightReady: false,
      limitations:
        'Geometry and source provenance only. No runtime streaming, flight, scenery collision, package or device-performance claim.',
    },
    null,
    2,
  ),
);
