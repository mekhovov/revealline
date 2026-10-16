/** Extend the accepted arrival pair to six original districts, retaining every old source asset. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { compileSceneryCell, validateSceneryCell } from '../scenery-cell.mjs';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { reliefHeightMm, reliefSurfaceMm } from './relief-design.mjs';
import { districts } from './design.mjs';
import { districtPlacements, districtStarts, routes } from './districts.mjs';

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide accepted rounded arrival pair and a new output directory');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const expected = {
  terrain: '9fad494a6dc1e974695e9fa218b99e74f1676d2589303c7ececea8728b106239',
  scenery: 'a72ba600c11eba60486b645ca40967802498deb28e46dece02b10b3f04e0c30f',
};
const parent = JSON.parse(await readFile(resolve(input, 'preparation.json')));
const manifests = {},
  bodies = {},
  terrainCells = new Map(),
  cells = new Map();
for (const profile of ['terrain', 'scenery']) {
  const bytes = await readFile(resolve(input, profile, 'region.json'));
  assert.equal(sha(bytes), expected[profile]);
  manifests[profile] = structuredClone(validateRegionManifest(bytes.toString()));
  bodies[profile] = new Map();
  for (const asset of manifests[profile].assets) {
    const body = await readFile(resolve(input, profile, asset.path));
    assert.equal(sha(body), asset.sha256);
    assert.equal(body.length, asset.bytes);
    bodies[profile].set(asset.path, body);
    if (asset.kind === 'collision') {
      const cell = JSON.parse(body);
      (profile === 'terrain' ? terrainCells : cells).set(cell.chunkId, cell);
    }
  }
}
const sourceBytes = await readFile(new URL('./source/canyon-rocks-plants.glb', import.meta.url));
const provenance = JSON.parse(await readFile(new URL('./source/receipt.json', import.meta.url)));
assert.equal(sha(sourceBytes), provenance.modelSHA256);
const document = await new NodeIO().readBinary(sourceBytes);
const addedChunks = [];
for (let z = 0; z < 6; z++)
  for (let x = 0; x < 6; x++) {
    if (x < 3 && z < 3) continue;
    const id = `canyon-${x}-${z}`;
    const terrain = {
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
        terrain.heightsMm.push(reliefHeightMm(x * 128 + ix * 4, z * 128 + iz * 4));
    terrainCells.set(id, terrain);
    bodies.terrain.set(`terrain/${id}.json`, json(terrain));
    bodies.terrain.set(`terrain/${id}.glb`, Buffer.from(compileTerrainCell(terrain).glb));
    cells.set(id, {
      format: 'FPVRegionScenery.v1',
      chunkId: id,
      x,
      z,
      cellSizeMm: 128000,
      surfaces: [],
    });
    addedChunks.push({ id, x, z, assets: [`${id}-scene`, `${id}-collision`] });
  }
// The runtime validator is intentionally bounded to resident windows. Validate
// every shared edge with a two-cell window without enlarging runtime limits.
let seams = 0;
for (const cell of terrainCells.values()) {
  for (const [x, z] of [
    [cell.x + 1, cell.z],
    [cell.x, cell.z + 1],
  ]) {
    const neighbour = terrainCells.get(`canyon-${x}-${z}`);
    if (!neighbour) continue;
    validateTerrainSeams([cell, neighbour]);
    seams++;
  }
}
assert.equal(seams, 60);
const objects = [];
for (const [id, name, x, z, width, height, angle, purpose] of districtPlacements) {
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
      ground = Math.min(ground, reliefSurfaceMm(gx, gz));
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
    purpose,
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
for (const chunk of addedChunks) {
  const cell = cells.get(chunk.id);
  validateSceneryCell(cell);
  bodies.scenery.set(`${chunk.id}.json`, json(cell));
  bodies.scenery.set(`${chunk.id}.glb`, Buffer.from(compileSceneryCell(cell).glb));
}
for (const [profile, manifest] of Object.entries(manifests)) {
  manifest.revision = 'district-r3';
  manifest.title = { en: 'Canyon Badlands — six districts', uk: 'Каньйон — шість районів' };
  manifest.grid.width = manifest.grid.depth = 6;
  manifest.chunks.push(...addedChunks);
  manifest.chunks.sort((a, b) => a.z - b.z || a.x - b.x);
  for (const chunk of addedChunks)
    for (const [kind, extension] of [
      ['scene', 'glb'],
      ['collision', 'json'],
    ]) {
      const path = (profile === 'terrain' ? 'terrain/' : '') + `${chunk.id}.${extension}`;
      const bytes = bodies[profile].get(path);
      manifest.assets.push({
        id: `${chunk.id}-${kind}`,
        kind,
        path,
        bytes: bytes.length,
        sha256: sha(bytes),
      });
    }
  for (const [id, x, z] of districtStarts)
    manifest.spawns.push({
      id,
      position: { x: x * 1000, y: Math.ceil(reliefSurfaceMm(x, z) + 3000), z: z * 1000 },
    });
  validateRegionManifest(manifest);
}
assert.deepEqual(manifests.terrain.spawns, manifests.scenery.spawns);
assert.equal(addedChunks.length, 27);
assert.equal(objects.length, 27);
const grounding = objects.map((object) => {
  let maximum = -Infinity;
  for (
    let x = Math.floor(object.boundsMm[0][0] / 4000) * 4;
    x <= Math.ceil(object.boundsMm[0][1] / 4000) * 4;
    x += 4
  )
    for (
      let z = Math.floor(object.boundsMm[1][0] / 4000) * 4;
      z <= Math.ceil(object.boundsMm[1][1] / 4000) * 4;
      z += 4
    )
      maximum = Math.max(maximum, reliefSurfaceMm(x, z));
  return { id: object.id, topAboveHighestFootprintMm: object.topMm - maximum };
});
assert(
  grounding.every((item) => item.topAboveHighestFootprintMm >= 4000),
  `A landmark is buried by its terrain footprint: ${JSON.stringify(grounding.filter((item) => item.topAboveHighestFootprintMm < 4000))}`,
);
await mkdir(output, { recursive: false });
for (const [profile, manifest] of Object.entries(manifests)) {
  for (const [path, bytes] of bodies[profile]) {
    const file = resolve(output, profile, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  await writeFile(resolve(output, profile, 'region.json'), json(manifest));
}
const receipt = {
  id: manifests.terrain.id,
  revision: 'district-r3',
  actualExtentM: [768, 768],
  designTargetExtentM: [8192, 8192],
  designTargetIsDelivered: false,
  cells: 36,
  assets: 144,
  districts,
  parentTerrainManifestSHA256: expected.terrain,
  parentSceneryManifestSHA256: expected.scenery,
  terrainManifestSHA256: sha(json(manifests.terrain)),
  sceneryManifestSHA256: sha(json(manifests.scenery)),
  retainedAssetCount: 36,
  retainedArrivalBytesUnchanged: true,
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((sum, a) => sum + a.bytes, 0),
  licensedSource: provenance,
  objects: [...parent.objects, ...objects],
  grounding,
  routes,
  sourceSeamsExact: true,
  flightReady: false,
  playerAdmission: false,
};
for (const file of ['source-provenance.json', 'README-upstream.txt'])
  await writeFile(resolve(output, file), await readFile(resolve(input, file)));
await writeFile(resolve(output, 'preparation.json'), json(receipt));
console.log(
  JSON.stringify(
    {
      ...receipt,
      districts: districts.length,
      objects: receipt.objects.length,
      routes: routes.length,
    },
    null,
    2,
  ),
);
