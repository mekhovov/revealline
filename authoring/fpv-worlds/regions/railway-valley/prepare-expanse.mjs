/** Reproducible paired 4.096 km source. Refuses to overwrite existing output. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import {
  compileScenerySource,
  validateScenerySource,
  scenerySourceResources,
} from '../indexed-scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { TERRAIN_GEOMETRY_BYTES_PER_CELL } from '../verified-terrain-window.mjs';
import {
  EXTENT_M,
  CELL_M,
  heightMm,
  districts,
  architecture,
  routes,
  spawns,
  landmarks,
  placements,
  solidProbes,
} from './expanse-design.mjs';
const output = process.argv[2];
assert(output, 'Provide a new external output directory');
const json = (x) => Buffer.from(JSON.stringify(x) + '\n');
const sha = (x) => createHash('sha256').update(x).digest('hex');
const terrain = [],
  cells = [];
for (let z = 0; z < 16; z++)
  for (let x = 0; x < 16; x++) {
    const base = { chunkId: `valley-${x}-${z}`, x, z, cellSizeMm: CELL_M * 1000 };
    terrain.push({
      format: 'FPVRegionCollision.v1',
      ...base,
      samples: 33,
      heightsMm: Array.from({ length: 1089 }, (_, i) =>
        heightMm(x * CELL_M + (i % 33) * 8, z * CELL_M + Math.floor(i / 33) * 8),
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
const pieces = architecture();
for (const piece of pieces) {
  const min = piece.center.map((v, i) => v - piece.size[i] / 2),
    max = piece.center.map((v, i) => v + piece.size[i] / 2);
  assert(min[0] >= 0 && min[2] >= 0 && max[0] <= EXTENT_M && max[2] <= EXTENT_M, piece.id);
  for (let z = Math.floor(min[2] / CELL_M); z <= Math.min(15, Math.floor(max[2] / CELL_M)); z++)
    for (let x = Math.floor(min[0] / CELL_M); x <= Math.min(15, Math.floor(max[0] / CELL_M)); x++) {
      const cell = cells[z * 16 + x],
        low = [Math.max(min[0], x * CELL_M), min[1], Math.max(min[2], z * CELL_M)],
        high = [Math.min(max[0], (x + 1) * CELL_M), max[1], Math.min(max[2], (z + 1) * CELL_M)];
      if (high[0] <= low[0] || high[2] <= low[2]) continue;
      const key = piece.color.join(',');
      if (!cell.groups.has(key))
        cell.groups.set(key, {
          id: `original-${cell.groups.size}`,
          color: piece.color,
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
            (i % 3 === 0 ? x * CELL_M * 1000 : i % 3 === 2 ? z * CELL_M * 1000 : 0),
        );
      for (const index of geometry.index.array) surface.indices.push(offset + index);
      geometry.dispose();
    }
}
for (const cell of cells) cell.surfaces.push(...cell.groups.values());
// Extract only the previously accepted train primitives, retaining exact UVs/normals/palette.
const modelInputs = [
  [
    'north-tank-a',
    'railway-1-0.json',
    'add4ba15bed559f4e6011a0497d4db05fc159adb08869e114a3aa5e2fb4ec5c9',
    [234, 14.6, 58],
  ],
  [
    'north-timber-a',
    'railway-2-0.json',
    '9a7831e99a96a565e242d0757f66e76167b1777349e62188c5b631b8d58b591b',
    [266, 14.6, 58],
  ],
];
const models = new Map();
let palette;
for (const [id, file, digest, origin] of modelInputs) {
  const bytes = await readFile(new URL(`./delivery-structure-r1/scenery/${file}`, import.meta.url));
  assert.equal(sha(bytes), digest);
  const source = validateScenerySource(bytes.toString());
  palette = source.textures;
  models.set(id, {
    cell: source.cell,
    surfaces: source.cell.surfaces.filter((s) => s.id.startsWith(id + '-')),
    bindings: source.bindings,
    origin,
  });
}
for (const [id, modelId, x, y, z] of placements) {
  const model = models.get(modelId),
    cell = cells[Math.floor(z / CELL_M) * 16 + Math.floor(x / CELL_M)];
  assert(model && cell);
  for (const [i, surface] of model.surfaces.entries()) {
    const surfaceId = `${id}-${i}`;
    cell.surfaces.push({
      ...surface,
      id: surfaceId,
      positionsMm: surface.positionsMm.map((v, axis) =>
        Math.round(
          v +
            (axis % 3 === 0
              ? model.cell.x * 128000 - model.origin[0] * 1000 + x * 1000 - cell.x * CELL_M * 1000
              : axis % 3 === 1
                ? -model.origin[1] * 1000 + y * 1000
                : model.cell.z * 128000 -
                  model.origin[2] * 1000 +
                  z * 1000 -
                  cell.z * CELL_M * 1000),
        ),
      ),
    });
    cell.bindings.push({ ...model.bindings.find((b) => b.surfaceId === surface.id), surfaceId });
  }
}
for (const cell of cells)
  for (const surface of cell.surfaces)
    for (const [i, value] of surface.positionsMm.entries())
      assert(
        Number.isSafeInteger(value) && (i % 3 === 1 || (value >= 0 && value <= CELL_M * 1000)),
        `${cell.chunkId}/${surface.id}: coordinate ${i} = ${value}`,
      );
const scenery = cells.map(({ bindings, format, chunkId, x, z, cellSizeMm, surfaces }) => {
  const cell = { format, chunkId, x, z, cellSizeMm, surfaces };
  return cell.surfaces.length
    ? validateScenerySource(
        bindings.length
          ? { format: 'FPVRegionIndexedScenery.v1', cell, textures: palette, bindings }
          : cell,
      )
    : null;
});
let seams = 0;
for (const cell of terrain)
  for (const [x, z] of [
    [cell.x + 1, cell.z],
    [cell.x, cell.z + 1],
  ])
    if (x < 16 && z < 16) {
      validateTerrainSeams([cell, terrain[z * 16 + x]]);
      seams++;
    }
assert.equal(seams, 480);
let maxWindowBytes = 0;
for (let z = 0; z < 16; z++)
  for (let x = 0; x < 16; x++) {
    const window = [];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx > 15 || z + dz < 0 || z + dz > 15) continue;
        const c = scenery[(z + dz) * 16 + x + dx];
        if (c) window.push(c);
      }
    const bytes =
      scenerySourceResources(window).resourceBytes + 9 * TERRAIN_GEOMETRY_BYTES_PER_CELL;
    maxWindowBytes = Math.max(maxWindowBytes, bytes);
  }
assert(maxWindowBytes * 2 <= 8 * 1024 * 1024, 'Retained plus candidate windows must fit8MiB');
await mkdir(output, { recursive: false });
const manifests = {};
let sourceBytes = 0;
for (const [kind, sources, compile] of [
  ['terrain', terrain, compileTerrainCell],
  ['scenery', scenery, compileScenerySource],
]) {
  await mkdir(resolve(output, kind));
  const assets = [],
    chunks = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i],
      base = terrain[i],
      ids = [];
    if (source)
      for (const [type, bytes] of [
        ['scene', Buffer.from(compile(source).glb)],
        ['collision', json(source)],
      ]) {
        const id = `${base.chunkId}-${type}`,
          path = `${base.chunkId}.${type === 'scene' ? 'glb' : 'json'}`;
        assets.push({ id, kind: type, path, bytes: bytes.length, sha256: sha(bytes) });
        ids.push(id);
        sourceBytes += bytes.length;
        await writeFile(resolve(output, kind, path), bytes);
      }
    chunks.push({ id: base.chunkId, x: base.x, z: base.z, assets: ids });
  }
  const manifest = {
    format: kind === 'terrain' ? 'FPVRegionManifest.v1' : 'FPVSceneryManifest.v1',
    id: 'railway-valley-expanse',
    revision: 'districts-r1',
    title: {
      en: 'Railway Valley — six industrial districts',
      uk: 'Залізнична долина — шість промислових районів',
    },
    grid: {
      cellSizeMm: CELL_M * 1000,
      minX: 0,
      minZ: 0,
      width: 16,
      depth: 16,
      floorMm: 0,
      ceilingMm: 450000,
    },
    assets,
    chunks,
    spawns,
  };
  validateRegionManifest(manifest);
  manifests[kind] = manifest;
  const body = json(manifest);
  sourceBytes += body.length;
  await writeFile(resolve(output, kind, 'region.json'), body);
}
assert(sourceBytes < 64 * 1024 * 1024, 'Source must fit existing64MiB delivery limit');
for (const file of ['source-provenance.json', 'source/License.txt'])
  await writeFile(
    resolve(output, file.split('/').at(-1)),
    await readFile(new URL(file, import.meta.url)),
  );
const receipt = {
  format: 'FPVRailwayExpansePreparation.v1',
  id: manifests.terrain.id,
  revision: manifests.terrain.revision,
  actualExtentM: [EXTENT_M, EXTENT_M],
  sampleSpacingM: 8,
  terrainCells: 256,
  seams,
  sceneryCells: scenery.filter(Boolean).length,
  knownEmptySceneryCells: scenery.filter((x) => !x).length,
  sourceBytes,
  terrainManifestSHA256: sha(json(manifests.terrain)),
  sceneryManifestSHA256: sha(json(manifests.scenery)),
  originalArchitecturePieces: pieces.length,
  licensedPlacements: placements.length,
  maxNineCellResourceBytes: maxWindowBytes,
  maxRetainedCandidateResourceBytes: maxWindowBytes * 2,
  districts,
  landmarks,
  routes,
  spawns,
  solidProbes,
  modelInputs,
  playerReady: false,
  limitations: [
    'Original source composition; no Library or final-art acceptance.',
    'Eight-metre terrain samples; narrower flight openings use matching visible/collision geometry.',
    'Six representative districts and routes, not an uninterrupted whole-map playtest.',
    'No moving trains, gameplay rewards or scored proof changes.',
  ],
};
await writeFile(resolve(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      ...receipt,
      districts: districts.length,
      landmarks: landmarks.length,
      routes: routes.length,
      modelInputs: undefined,
    },
    null,
    2,
  ),
);
