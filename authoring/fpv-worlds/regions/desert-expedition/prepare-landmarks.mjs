/** Original Desert composition using pinned CC0 rocks and unchanged natural-r1 terrain. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { compileSceneryCell } from '../scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { CELL_M, SAMPLE_M, heightMm, surfaceMm } from './desert-design.mjs';
import { compositions, placements, routes } from './landmark-design.mjs';

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide natural-r1 source and a NEW output directory');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value) + '\n');
const original = await readFile(resolve(input, 'terrain/region.json'));
assert.equal(sha(original), '21c5b63e51a33c22ebd7ff22e05d92d6b91b00173fcc5d3c911bc530bb166468');
const terrain = structuredClone(validateRegionManifest(original.toString()));
const sourceBytes = await readFile(
  new URL('../canyon-badlands/source/canyon-rocks-plants.glb', import.meta.url),
);
const provenance = JSON.parse(
  await readFile(new URL('../canyon-badlands/source/receipt.json', import.meta.url)),
);
assert.equal(sha(sourceBytes), provenance.modelSHA256);
const document = await new NodeIO().readBinary(sourceBytes);
terrain.revision = 'landmarks-r1';
terrain.title = {
  en: 'Desert Expedition — six rock compositions',
  uk: 'Пустельна експедиція — шість скельних композицій',
};
const scenery = { ...structuredClone(terrain), format: 'FPVSceneryManifest.v1', assets: [] };
scenery.chunks = terrain.chunks.map((chunk) => ({ ...chunk, assets: [] }));
const cells = new Map(),
  objects = [];
for (const [id, compositionId, name, x, z, width, height, angle] of placements) {
  const composition = compositions.find((value) => value.id === compositionId);
  assert(composition);
  const node = document
    .getRoot()
    .listNodes()
    .find((value) => value.getName() === name);
  assert(node && !name.includes('colonly'), 'Only exact licensed visual triangles are admitted');
  assert.deepEqual(Array.from(node.getScale()), [1, 1, 1]);
  assert.deepEqual(Array.from(node.getRotation()), [0, 0, 0, 1]);
  const primitives = node.getMesh().listPrimitives();
  assert.equal(primitives.length, 1);
  const primitive = primitives[0];
  assert.equal(primitive.getMode(), 4);
  const positions = Array.from(primitive.getAttribute('POSITION').getArray());
  const indices = Array.from(primitive.getIndices().getArray());
  const axis = (a) => positions.filter((_, i) => i % 3 === a);
  const min = [0, 1, 2].map((a) => Math.min(...axis(a)));
  const max = [0, 1, 2].map((a) => Math.max(...axis(a)));
  const scale = width / Math.max(max[0] - min[0], max[2] - min[2]);
  const points = [];
  for (let i = 0; i < positions.length; i += 3) {
    const px = (positions[i] - (min[0] + max[0]) / 2) * scale;
    const pz = (positions[i + 2] - (min[2] + max[2]) / 2) * scale;
    points.push([
      x + px * Math.cos(angle) - pz * Math.sin(angle),
      ((positions[i + 1] - min[1]) * height) / (max[1] - min[1]),
      z + px * Math.sin(angle) + pz * Math.cos(angle),
    ]);
  }
  const bounds = [0, 2].map((a) => [
    Math.min(...points.map((p) => p[a])),
    Math.max(...points.map((p) => p[a])),
  ]);
  // A linear terrain triangle lies within the enclosing lattice vertex heights.
  // Bury the base; do not flatten terrain or claim that a floating rock is grounded.
  let ground = Infinity;
  for (
    let gx = Math.floor(bounds[0][0] / SAMPLE_M) * SAMPLE_M;
    gx <= Math.ceil(bounds[0][1] / SAMPLE_M) * SAMPLE_M;
    gx += SAMPLE_M
  )
    for (
      let gz = Math.floor(bounds[1][0] / SAMPLE_M) * SAMPLE_M;
      gz <= Math.ceil(bounds[1][1] / SAMPLE_M) * SAMPLE_M;
      gz += SAMPLE_M
    )
      ground = Math.min(ground, heightMm(gx, gz));
  const baseMm = ground - 800;
  const cx = Math.floor(x / CELL_M),
    cz = Math.floor(z / CELL_M),
    chunkId = `desert-${cx}-${cz}`;
  if (!cells.has(chunkId))
    cells.set(chunkId, {
      format: 'FPVRegionScenery.v1',
      chunkId,
      x: cx,
      z: cz,
      cellSizeMm: CELL_M * 1000,
      surfaces: [],
    });
  const cell = cells.get(chunkId);
  cell.surfaces.push({
    id,
    positionsMm: points.flatMap((p) => [
      Math.round(p[0] * 1000) - cx * CELL_M * 1000,
      Math.round(p[1] * 1000) + baseMm,
      Math.round(p[2] * 1000) - cz * CELL_M * 1000,
    ]),
    indices,
    color: composition.color,
  });
  objects.push({
    id,
    composition: compositionId,
    sourceNode: name,
    chunkId,
    center: [x, z],
    requestedWidthM: width,
    requestedHeightM: height,
    yawRadians: angle,
    baseMm,
    topMm: baseMm + Math.round(height * 1000),
    boundsMm: bounds.map((b) => b.map((v) => Math.round(v * 1000))),
    triangles: indices.length / 3,
  });
}
// Compile before writing, so ownership/geometry budget failures do not leave a half-generated source.
const compiled = [...cells.values()].map((cell) => ({
  cell,
  glb: Buffer.from(compileSceneryCell(cell).glb),
}));
await mkdir(output, { recursive: false });
await mkdir(resolve(output, 'terrain'));
await mkdir(resolve(output, 'scenery'));
const pending = [...terrain.assets];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    while (pending.length) {
      const asset = pending.shift(),
        bytes = await readFile(resolve(input, 'terrain', asset.path));
      assert.equal(sha(bytes), asset.sha256);
      assert.equal(bytes.length, asset.bytes);
      await mkdir(dirname(resolve(output, 'terrain', asset.path)), { recursive: true });
      await writeFile(resolve(output, 'terrain', asset.path), bytes);
    }
  }),
);
for (const { cell, glb } of compiled) {
  const chunk = scenery.chunks.find((value) => value.id === cell.chunkId);
  for (const [kind, extension, bytes] of [
    ['scene', 'glb', glb],
    ['collision', 'json', json(cell)],
  ]) {
    const id = `${cell.chunkId}-${kind}`,
      path = `${cell.chunkId}.${extension}`;
    chunk.assets.push(id);
    scenery.assets.push({ id, kind, path, bytes: bytes.length, sha256: sha(bytes) });
    await writeFile(resolve(output, 'scenery', path), bytes);
  }
}
for (const [profile, manifest] of Object.entries({ terrain, scenery })) {
  validateRegionManifest(manifest);
  await writeFile(resolve(output, profile, 'region.json'), json(manifest));
}
const payloadBytes =
  [...terrain.assets, ...scenery.assets].reduce((sum, asset) => sum + asset.bytes, 0) +
  json(terrain).length +
  json(scenery).length;
// Reserve 1 MiB for the eventual strict delivery descriptor; do not silently expand the cap.
assert(payloadBytes + 1024 * 1024 < 64 * 1024 * 1024);
const receipt = {
  format: 'FPVDesertLandmarkPreparation.v1',
  id: terrain.id,
  revision: terrain.revision,
  actualExtentM: [16384, 16384],
  compositions,
  objects,
  parentTerrainManifestSHA256: sha(original),
  terrainManifestSHA256: sha(json(terrain)),
  sceneryManifestSHA256: sha(json(scenery)),
  byteIdenticalTerrainAssets: terrain.assets.length,
  populatedSceneryCells: cells.size,
  emptySceneryCells: scenery.chunks.length - cells.size,
  sourceBytes: payloadBytes,
  licensedSource: provenance,
  routes: routes.map((route) => ({
    ...route,
    points: route.points.map(([x, z]) => [x, surfaceMm(x, z) / 1000 + route.clearanceM, z]),
  })),
  admission:
    'Source study only; no Library pin, scored mission or final environment quality claim.',
};
await writeFile(resolve(output, 'preparation.json'), json(receipt));
console.log(JSON.stringify(receipt, null, 2));
