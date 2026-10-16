/** Immutable 384 m composition slice; copies exact terrain, adds matching visible rock triangles. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { compileSceneryCell, validateSceneryCell } from '../scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { surfaceMm } from './design.mjs';
import { placements, routes } from './landmarks.mjs';

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide original Canyon r1 directory and a new output directory');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const json = (v) => Buffer.from(JSON.stringify(v, null, 2) + '\n');
const parentBytes = await readFile(resolve(input, 'region.json'));
assert.equal(
  sha(JSON.stringify(JSON.parse(parentBytes))),
  '0828de82c5e29fbf61b79dc17b9dea419227faa3ee044cde23fc8b128d15aeb8',
);
const parent = validateRegionManifest(parentBytes.toString());
const sourceBytes = await readFile(new URL('./source/canyon-rocks-plants.glb', import.meta.url));
const provenance = JSON.parse(await readFile(new URL('./source/receipt.json', import.meta.url)));
assert.equal(sha(sourceBytes), provenance.modelSHA256);
const document = await new NodeIO().readBinary(sourceBytes);
const chunks = parent.chunks.filter((c) => c.x < 3 && c.z < 3);
const cells = new Map(
  chunks.map((c) => [
    c.id,
    {
      format: 'FPVRegionScenery.v1',
      chunkId: c.id,
      x: c.x,
      z: c.z,
      cellSizeMm: 128000,
      surfaces: [],
    },
  ]),
);
const objects = [];
for (const [id, name, x, z, width, height, angle] of placements) {
  const node = document
    .getRoot()
    .listNodes()
    .find((n) => n.getName() === name);
  assert(node && !name.includes('colonly'), 'Only the licensed visual mesh is used');
  assert.deepEqual(Array.from(node.getScale()), [1, 1, 1]);
  assert.deepEqual(Array.from(node.getRotation()), [0, 0, 0, 1]);
  const primitives = node.getMesh().listPrimitives();
  assert.equal(primitives.length, 1);
  const primitive = primitives[0];
  assert.equal(primitive.getMode(), 4);
  const sourcePositions = Array.from(primitive.getAttribute('POSITION').getArray());
  const indices = Array.from(primitive.getIndices().getArray());
  const axis = (a) => sourcePositions.filter((_, i) => i % 3 === a);
  const min = [0, 1, 2].map((a) => Math.min(...axis(a)));
  const max = [0, 1, 2].map((a) => Math.max(...axis(a)));
  const scale = width / Math.max(max[0] - min[0], max[2] - min[2]);
  const points = [];
  for (let i = 0; i < sourcePositions.length; i += 3) {
    const px = (sourcePositions[i] - (min[0] + max[0]) / 2) * scale;
    const pz = (sourcePositions[i + 2] - (min[2] + max[2]) / 2) * scale;
    points.push([
      x + px * Math.cos(angle) - pz * Math.sin(angle),
      ((sourcePositions[i + 1] - min[1]) * height) / (max[1] - min[1]),
      z + px * Math.sin(angle) + pz * Math.cos(angle),
    ]);
  }
  // Enclosing 4 m lattice vertices bound every linear terrain triangle under the footprint.
  // Do not flatten, displace or substitute the authoritative terrain.
  const bounds = [0, 2].map((a) => [
    Math.min(...points.map((p) => p[a])),
    Math.max(...points.map((p) => p[a])),
  ]);
  let ground = Infinity;
  for (let gx = Math.floor(bounds[0][0] / 4) * 4; gx <= Math.ceil(bounds[0][1] / 4) * 4; gx += 4)
    for (let gz = Math.floor(bounds[1][0] / 4) * 4; gz <= Math.ceil(bounds[1][1] / 4) * 4; gz += 4)
      ground = Math.min(ground, surfaceMm(gx, gz));
  const baseMm = Math.floor(ground) - 800;
  const cell = cells.get(`canyon-${Math.floor(x / 128)}-${Math.floor(z / 128)}`);
  const positionsMm = points.flatMap((p) => [
    Math.round(p[0] * 1000) - cell.x * 128000,
    Math.round(p[1] * 1000) + baseMm,
    Math.round(p[2] * 1000) - cell.z * 128000,
  ]);
  // Three restrained sandstone bands make the large source formations legible at FPV range.
  const bands = [[], [], []];
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3);
    const level = triangle.reduce((s, index) => s + points[index][1], 0) / 3 / height;
    bands[Math.min(2, Math.floor(level * 3))].push(...triangle);
  }
  const palette = [
    [0.46, 0.23, 0.12],
    [0.66, 0.39, 0.21],
    [0.77, 0.55, 0.33],
  ];
  bands.forEach((band, i) => {
    if (!band.length) return;
    const remap = new Map(),
      compact = [],
      triangles = [];
    for (const index of band) {
      if (!remap.has(index)) {
        remap.set(index, compact.length / 3);
        compact.push(...positionsMm.slice(index * 3, index * 3 + 3));
      }
      triangles.push(remap.get(index));
    }
    cell.surfaces.push({
      id: `${id}-band-${i}`,
      positionsMm: compact,
      indices: triangles,
      color: palette[i],
    });
  });
  objects.push({
    id,
    sourceNode: name,
    center: [x, z],
    requestedWidthM: width,
    requestedHeightM: height,
    baseMm,
    topMm: baseMm + Math.round(height * 1000),
    boundsMm: bounds.map((b) => b.map((v) => Math.round(v * 1000))),
    triangles: indices.length / 3,
  });
}
const terrain = structuredClone(parent);
terrain.id = 'canyon-arrival-landmarks-study';
terrain.revision = 'r1';
terrain.title = {
  en: 'Canyon arrival — rock landmark study',
  uk: 'Вхід у каньйон — дослідження скельних орієнтирів',
};
terrain.grid.width = 3;
terrain.grid.depth = 3;
terrain.chunks = chunks;
terrain.assets = parent.assets.filter((a) => chunks.some((c) => c.assets.includes(a.id)));
terrain.spawns = parent.spawns.filter((s) => s.id === 'basin');
const scenery = structuredClone(terrain);
scenery.assets = [];
await mkdir(output, { recursive: false });
for (const profile of ['terrain', 'scenery']) await mkdir(resolve(output, profile));
for (const asset of terrain.assets) {
  const bytes = await readFile(resolve(input, asset.path));
  assert.equal(sha(bytes), asset.sha256);
  assert.equal(bytes.length, asset.bytes);
  if (asset.kind === 'collision') {
    const cell = JSON.parse(bytes);
    cell.heightsMm.forEach((height, i) =>
      assert.equal(
        height,
        surfaceMm(cell.x * 128 + (i % 33) * 4, cell.z * 128 + Math.floor(i / 33) * 4),
        'Grounding formula must match the retained serialized terrain',
      ),
    );
  }
  await mkdir(resolve(output, 'terrain', 'terrain'), { recursive: true });
  await writeFile(resolve(output, 'terrain', asset.path), bytes);
}
let surfaces = 0;
for (const cell of cells.values()) {
  validateSceneryCell(cell);
  surfaces += cell.surfaces.length;
  for (const [kind, extension, bytes] of [
    ['scene', 'glb', Buffer.from(compileSceneryCell(cell).glb)],
    ['collision', 'json', json(cell)],
  ]) {
    const path = `${cell.chunkId}.${extension}`;
    scenery.assets.push({
      id: `${cell.chunkId}-${kind}`,
      kind,
      path,
      bytes: bytes.length,
      sha256: sha(bytes),
    });
    await writeFile(resolve(output, 'scenery', path), bytes);
  }
}
for (const [profile, manifest] of Object.entries({ terrain, scenery })) {
  validateRegionManifest(manifest);
  await writeFile(resolve(output, profile, 'region.json'), json(manifest));
}
const receipt = {
  id: terrain.id,
  revision: 'r1',
  actualExtentM: [384, 384],
  originalTerrainExtentM: [768, 768],
  parentTerrainManifestSHA256: sha(parentBytes),
  terrainManifestSHA256: sha(json(terrain)),
  sceneryManifestSHA256: sha(json(scenery)),
  sourceBytes: [...terrain.assets, ...scenery.assets].reduce((s, a) => s + a.bytes, 0),
  cells: 9,
  assets: 36,
  byteIdenticalTerrainAssets: 18,
  licensedSource: provenance,
  objects,
  surfaces,
  sceneryTriangles: objects.reduce((s, o) => s + o.triangles, 0),
  routes,
  exactRenderCollision: true,
  flightReady: false,
};
await writeFile(resolve(output, 'preparation.json'), json(receipt));
await writeFile(resolve(output, 'source-provenance.json'), json(provenance));
await writeFile(
  resolve(output, 'README-upstream.txt'),
  await readFile(new URL('./source/README-upstream.txt', import.meta.url)),
);
console.log(
  JSON.stringify(
    {
      ...receipt,
      objects: objects.length,
      routes: routes.length,
      licensedSource: provenance.modelSHA256,
    },
    null,
    2,
  ),
);
