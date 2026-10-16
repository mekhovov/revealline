/** Immutable bounded composition. Run against a new external output directory. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import {
  compileScenerySource,
  scenerySourceResources,
  validateScenerySource,
} from '../indexed-scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { createRailwayIndexedCells } from './indexed-source.mjs';
import { architecture, placements, routes, spawns, heightMm, sizeM } from './design.mjs';
const output = process.argv[2];
assert(output, 'Provide a new external output directory');
const json = (value) => Buffer.from(JSON.stringify(value) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const models = await createRailwayIndexedCells(),
  terrain = [],
  cells = [];
for (let z = 0; z < 3; z++)
  for (let x = 0; x < 3; x++) {
    const base = { chunkId: `railway-${x}-${z}`, x, z, cellSizeMm: 128000 };
    terrain.push({
      format: 'FPVRegionCollision.v1',
      ...base,
      samples: 33,
      heightsMm: Array.from({ length: 1089 }, (_, i) =>
        heightMm(x * 128 + (i % 33) * 4, z * 128 + Math.floor(i / 33) * 4),
      ),
    });
    cells.push({
      format: 'FPVRegionScenery.v1',
      ...base,
      surfaces: [],
      groups: new Map(),
      bindings: [],
    });
  }
const boxes = architecture();
for (const box of boxes) {
  const min = box.center.map((v, i) => v - box.size[i] / 2),
    max = box.center.map((v, i) => v + box.size[i] / 2);
  assert(min[0] >= 0 && min[2] >= 0 && max[0] <= sizeM && max[2] <= sizeM, box.id);
  for (const cell of cells) {
    const low = [Math.max(min[0], cell.x * 128), min[1], Math.max(min[2], cell.z * 128)],
      high = [Math.min(max[0], (cell.x + 1) * 128), max[1], Math.min(max[2], (cell.z + 1) * 128)];
    if (high[0] <= low[0] || high[2] <= low[2]) continue;
    const key = box.color.join(',');
    if (!cell.groups.has(key))
      cell.groups.set(key, {
        id: `original-${cell.groups.size}`,
        color: box.color,
        positionsMm: [],
        indices: [],
      });
    const surface = cell.groups.get(key),
      offset = surface.positionsMm.length / 3;
    const geometry = new THREE.BoxGeometry(...high.map((v, i) => v - low[i]));
    geometry.translate(...high.map((v, i) => (v + low[i]) / 2));
    for (let i = 0; i < geometry.attributes.position.array.length; i++)
      surface.positionsMm.push(
        Math.round(geometry.attributes.position.array[i] * 1000) -
          (i % 3 === 0 ? cell.x * 128000 : i % 3 === 2 ? cell.z * 128000 : 0),
      );
    for (const index of geometry.index.array) surface.indices.push(offset + index);
    geometry.dispose();
  }
}
for (const cell of cells) cell.surfaces.push(...cell.groups.values());
for (const [id, name, x, y, z] of placements) {
  const model = models.get(name),
    cell = cells.find((c) => c.x === Math.floor(x / 128) && c.z === Math.floor(z / 128));
  assert(model && cell);
  // Preserve accepted primitive triangles/UVs/normals; only translate the 2.5x source placement.
  model.cell.surfaces.forEach((surface, i) => {
    const surfaceId = `${id}-part-${i}`;
    cell.surfaces.push({
      ...surface,
      id: surfaceId,
      positionsMm: surface.positionsMm.map(
        (value, axis) =>
          value +
          (axis % 3 === 0
            ? Math.round(x * 1000) - 64000 - cell.x * 128000
            : axis % 3 === 1
              ? Math.round(y * 1000) - 4000
              : Math.round(z * 1000) - 64000 - cell.z * 128000),
      ),
    });
    cell.bindings.push({ ...model.bindings[i], surfaceId });
  });
}
const palette = models.get('train-carriage-tank.glb').textures;
const scenery = cells.map(({ groups, bindings, ...cell }) =>
  validateScenerySource(
    bindings.length
      ? { format: 'FPVRegionIndexedScenery.v1', cell, textures: palette, bindings }
      : cell,
  ),
);
validateTerrainSeams(terrain);
const empty = scenery.filter((s) => (s.cell ?? s).surfaces.length === 0);
assert.equal(empty.length, 0, 'Every prepared cell needs an intentional reachable landmark');
const resources = scenerySourceResources(scenery);
assert(
  resources.resourceBytes <= 6 * 1024 * 1024,
  'Representative scenery exceeds6MiB live allowance',
);
await mkdir(output, { recursive: false });
const manifests = {};
for (const [kind, sources, compile] of [
  ['terrain', terrain, compileTerrainCell],
  ['scenery', scenery, compileScenerySource],
]) {
  await mkdir(resolve(output, kind));
  const assets = [],
    chunks = [];
  for (const source of sources) {
    const cell = source.cell ?? source,
      ids = [];
    for (const [type, bytes] of [
      ['scene', compile(source).glb],
      ['collision', json(source)],
    ]) {
      const id = `${cell.chunkId}-${type}`,
        path = `${cell.chunkId}.${type === 'scene' ? 'glb' : 'json'}`;
      assets.push({ id, kind: type, path, bytes: bytes.length, sha256: hash(bytes) });
      ids.push(id);
      await writeFile(resolve(output, kind, path), bytes);
    }
    chunks.push({ id: cell.chunkId, x: cell.x, z: cell.z, assets: ids });
  }
  const manifest = {
    format: 'FPVRegionManifest.v1',
    id: 'railway-valley-study',
    revision: 'pilot-r1',
    title: { en: 'Railway Valley — route study', uk: 'Залізнична долина — дослідження маршрутів' },
    grid: {
      cellSizeMm: 128000,
      minX: 0,
      minZ: 0,
      width: 3,
      depth: 3,
      floorMm: -20000,
      ceilingMm: 100000,
    },
    assets,
    chunks,
    spawns,
  };
  validateRegionManifest(manifest);
  manifests[kind] = manifest;
  await writeFile(resolve(output, kind, 'region.json'), json(manifest));
}
const sourceReceipt = await readFile(new URL('./source-provenance.json', import.meta.url)),
  license = await readFile(new URL('./source/License.txt', import.meta.url));
await writeFile(resolve(output, 'source-provenance.json'), sourceReceipt);
await writeFile(resolve(output, 'License.txt'), license);
const receipt = {
  format: 'FPVRailwayPilotPreparation.v1',
  actualSizeM: [sizeM, sizeM],
  futureDesignTargetM: [4000, 4000],
  terrainCells: 9,
  sceneryCells: 9,
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((n, a) => n + a.bytes, 0),
  terrainManifestSHA256: hash(json(manifests.terrain)),
  sceneryManifestSHA256: hash(json(manifests.scenery)),
  licensedPlacements: placements.length,
  originalArchitecturePieces: boxes.length,
  geometryBytes: resources.geometryBytes,
  textureBytes: resources.textureBytes,
  resourceBytes: resources.resourceBytes,
  routes,
  spawns,
  sourceReceiptSHA256: hash(sourceReceipt),
  licenseSHA256: hash(license),
  playerReady: false,
  movingSubjects: false,
};
await writeFile(resolve(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
