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
import { loadBuildingModels } from './indexed-source.mjs';
const variant = process.argv[3];
assert(!variant || ['courtyard-r3', 'courtyard-r4'].includes(variant), 'Unknown Hillside source variant');
const design = await import(variant ? `./${variant}/design.mjs` : './design.mjs');
const { architecture, placements, routes, spawns, probes, heightMm, sizeM, roads, roadTopMm } =
  design;
const output = process.argv[2];
assert(output, 'Provide a new external output directory');
const json = (value) => Buffer.from(JSON.stringify(value) + '\n');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const { models, texture } = await loadBuildingModels(),
  terrain = [],
  cells = [];
for (let z = 0; z < 3; z++)
  for (let x = 0; x < 3; x++) {
    const base = { chunkId: `town-${x}-${z}`, x, z, cellSizeMm: 128000 };
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
    const dimensions = high.map((v, i) => v - low[i]);
    if (box.primitive)
      assert.deepEqual([low, high], [min, max], 'Rounded art must not straddle cells');
    const geometry =
      box.primitive === 'crown'
        ? new THREE.SphereGeometry(1, 8, 5).scale(...dimensions.map((v) => v / 2))
        : box.primitive === 'trunk'
          ? new THREE.CylinderGeometry(dimensions[0] / 2, dimensions[0] / 2, dimensions[1], 8)
          : new THREE.BoxGeometry(...dimensions);
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
// Explicit watertight road ribbons, clipped at cells and sampled on the terrain's
// 4 m lattice. Bottoms are 20 mm below terrain; tops share one 100 mm offset.
const lattice = (lo, hi) => [
  lo,
  ...Array.from(
    { length: Math.max(0, Math.ceil(hi / 4) - Math.floor(lo / 4) - 1) },
    (_, i) => (Math.floor(lo / 4) + i + 1) * 4,
  ),
  hi,
];
for (const cell of cells)
  for (const road of roads) {
    const lo = [Math.max(road.min[0], cell.x * 128), Math.max(road.min[1], cell.z * 128)],
      hi = [Math.min(road.max[0], (cell.x + 1) * 128), Math.min(road.max[1], (cell.z + 1) * 128)];
    if (lo[0] >= hi[0] || lo[1] >= hi[1]) continue;
    const xs = lattice(lo[0], hi[0]),
      zs = lattice(lo[1], hi[1]),
      count = xs.length * zs.length;
    const surface = { id: road.id, color: road.color, positionsMm: [], indices: [] };
    for (const offset of [roadTopMm, -20])
      for (const z of zs)
        for (const x of xs)
          surface.positionsMm.push(
            Math.round(x * 1000) - cell.x * 128000,
            heightMm(x, z) + offset,
            Math.round(z * 1000) - cell.z * 128000,
          );
    for (let z = 0; z < zs.length - 1; z++)
      for (let x = 0; x < xs.length - 1; x++) {
        const a = z * xs.length + x,
          b = a + 1,
          c = a + xs.length,
          d = c + 1;
        surface.indices.push(
          a,
          c,
          b,
          b,
          c,
          d,
          a + count,
          b + count,
          c + count,
          b + count,
          d + count,
          c + count,
        );
      }
    const edge = (a, b) => surface.indices.push(a, b, a + count, b, b + count, a + count);
    for (let x = 0; x < xs.length - 1; x++) {
      edge(x, x + 1);
      edge(count - 1 - x, count - 2 - x);
    }
    for (let z = 0; z < zs.length - 1; z++) {
      edge((z + 1) * xs.length, z * xs.length);
      edge((z + 1) * xs.length - 1, (z + 2) * xs.length - 1);
    }
    cell.surfaces.push(surface);
  }

for (const item of placements) {
  const { id, asset, x, y, z, scale, yaw } = item,
    model = models.get(asset),
    cell = cells.find((c) => c.x === Math.floor(x / 128) && c.z === Math.floor(z / 128));
  assert(model && cell);
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    positionsMm = [],
    normals = [];
  for (let i = 0; i < model.positions.length; i += 3) {
    const px = model.positions[i] * scale,
      pz = model.positions[i + 2] * scale;
    positionsMm.push(
      Math.round((x - cell.x * 128 + c * px + s * pz) * 1000),
      Math.round((y + model.positions[i + 1] * scale) * 1000),
      Math.round((z - cell.z * 128 - s * px + c * pz) * 1000),
    );
    normals.push(
      c * model.normals[i] + s * model.normals[i + 2],
      model.normals[i + 1],
      -s * model.normals[i] + c * model.normals[i + 2],
    );
  }
  cell.surfaces.push({ id, positionsMm, indices: model.indices, color: [1, 1, 1] });
  cell.bindings.push({ surfaceId: id, textureId: texture.id, uvs: model.uvs, normals });
}
const palette = [texture];
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
    id: 'hillside-town-study',
    revision: design.revision ?? 'town-r2',
    title: design.title ?? {
      en: 'Hillside Town — terraces and courtyards',
      uk: 'Містечко на схилі — тераси та подвір’я',
    },
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
assert(
  (resources.resourceBytes + 456408) * 2 <= 8 * 1024 * 1024,
  'Retained/candidate must fit existing8MiB',
);
const sourceReceipt = await readFile(new URL('./source-provenance.json', import.meta.url)),
  license = await readFile(new URL('./source/License.txt', import.meta.url));
await writeFile(resolve(output, 'source-provenance.json'), sourceReceipt);
await writeFile(resolve(output, 'License.txt'), license);
const receipt = {
  format: 'FPVHillsideTownPreparation.v1',
  actualSizeM: [sizeM, sizeM],
  futureDesignTargetM: null,
  terrainCells: 9,
  sceneryCells: 9,
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((n, a) => n + a.bytes, 0),
  terrainManifestSHA256: hash(json(manifests.terrain)),
  sceneryManifestSHA256: hash(json(manifests.scenery)),
  licensedPlacements: placements.length,
  originalArchitecturePieces: boxes.length,
  terrainConformingRoads: roads.length,
  roadLatticeM: 4,
  roadTopMm,
  geometryBytes: resources.geometryBytes,
  textureBytes: resources.textureBytes,
  resourceBytes: resources.resourceBytes,
  retainedAndCandidateBytes: (resources.resourceBytes + 456408) * 2,
  routes,
  verificationProbes: probes,
  contactProbes: [
    { id: 'house-roof', from: [48, 10, 48], falling: true, minY: 6 },
    { id: 'elevated-pad', from: [320, 35, 288], falling: true, minY: 30 },
  ],
  spawns,
  sourceReceiptSHA256: hash(sourceReceipt),
  licenseSHA256: hash(license),
  playerReady: false,
  movingSubjects: false,
};
await writeFile(resolve(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
