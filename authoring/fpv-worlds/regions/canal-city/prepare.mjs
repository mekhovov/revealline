/** Original Canal City composition; write only to a new external output directory. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as THREE from '../../../../optional-practice/civilian-fpv/vendor/three.module.js';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { compileRgbaSceneryCell, validateRgbaSceneryCell } from '../rgba-scenery-cell.mjs';
import { scenerySourceResources } from '../indexed-scenery-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import { loadBuildingModels } from '../hillside-town/indexed-source.mjs';
import * as design from './design.mjs';

assert(process.argv[2], 'Provide a new external output directory');
const output = resolve(process.argv[2]);
const json = (x) => Buffer.from(JSON.stringify(x) + '\n');
const hash = (x) => createHash('sha256').update(x).digest('hex');
const { models, texture: indexed } = await loadBuildingModels();
// Retain only the atlas rectangle actually addressed by the admitted wall/door meshes.
// Original texels and sample density are unchanged; distant mip averages may differ.
const crop = { x: 128, y: 384, width: 256, height: 128 };
const pixels = Buffer.from(indexed.indicesBase64, 'base64'),
  rgba = Buffer.alloc(crop.width * crop.height * 4);
assert.equal(indexed.width, 512);
assert.equal(indexed.height, 512);
for (let y = 0; y < crop.height; y++)
  for (let x = 0; x < crop.width; x++) {
    const original = pixels[(crop.y + y) * indexed.width + crop.x + x],
      offset = (y * crop.width + x) * 4;
    for (let c = 0; c < 3; c++) rgba[offset + c] = indexed.paletteRgb[original * 3 + c];
    rgba[offset + 3] = 255;
  }
const palette = {
  id: 'building-palette-crop',
  width: crop.width,
  height: crop.height,
  rgbaBase64: rgba.toString('base64'),
  magFilter: indexed.magFilter,
  minFilter: indexed.minFilter,
  wrapS: indexed.wrapS,
  wrapT: indexed.wrapT,
};
function croppedUVs(values) {
  return values.map((uv, i) => {
    const source = uv * 512,
      offset = i % 2 ? crop.y : crop.x,
      size = i % 2 ? crop.height : crop.width;
    assert(
      source >= offset + 16 && source <= offset + size - 16,
      'Atlas crop requires a 16-texel sampling halo',
    );
    const result = (source - offset) / size;
    assert(Math.abs(result * size + offset - source) < 1e-9, 'Atlas remap changed sample position');
    return result;
  });
}
const white = {
  id: 'original-solid-white',
  width: 1,
  height: 1,
  rgbaBase64: '/////w==',
  magFilter: 9728,
  minFilter: 9728,
  wrapS: 33071,
  wrapT: 33071,
};
const waterPixels = Buffer.alloc(32 * 32 * 4);
for (let z = 0; z < 32; z++)
  for (let x = 0; x < 32; x++) {
    const n = Math.sin(x * 0.38 + Math.sin(z * 0.2)) * 3 + Math.cos(z * 0.55) * 2;
    waterPixels.set(
      [Math.round(28 + n), Math.round(96 + n), Math.round(103 + n), 255],
      (z * 32 + x) * 4,
    );
  }
const water = {
  id: 'original-canal-water',
  width: 32,
  height: 32,
  rgbaBase64: waterPixels.toString('base64'),
  magFilter: 9729,
  minFilter: 9729,
  wrapS: 10497,
  wrapT: 10497,
};
const terrains = [],
  cells = [];
for (let z = 0; z < 3; z++)
  for (let x = 0; x < 3; x++) {
    const base = { chunkId: `canal-${x}-${z}`, x, z, cellSizeMm: 128000 };
    terrains.push({
      format: 'FPVRegionCollision.v1',
      ...base,
      samples: 33,
      heightsMm: Array.from({ length: 1089 }, (_, i) =>
        design.heightMm(x * 128 + (i % 33) * 4, z * 128 + Math.floor(i / 33) * 4),
      ),
    });
    cells.push({
      cell: { format: 'FPVRegionScenery.v1', ...base, surfaces: [] },
      bindings: [],
      textures: new Map(),
      groups: new Map(),
    });
  }
// Clip original triangle meshes at cell edges. Render and collision consume this one result.
function clip(polygon, axis, bound, positive) {
  const out = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const ai = positive ? a[axis] >= bound : a[axis] <= bound,
      bi = positive ? b[axis] >= bound : b[axis] <= bound;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + (b[k] - v) * t));
    }
  }
  return out;
}
function solid(id, positions, indices, color) {
  for (const entry of cells) {
    const { x, z } = entry.cell,
      key = color.join(',');
    for (let i = 0; i < indices.length; i += 3) {
      let polygon = indices.slice(i, i + 3).map((j) => positions.slice(j * 3, j * 3 + 3));
      for (const [axis, bound, positive] of [
        [0, x * 128, true],
        [0, (x + 1) * 128, false],
        [2, z * 128, true],
        [2, (z + 1) * 128, false],
      ])
        polygon = clip(polygon, axis, bound, positive);
      if (polygon.length < 3) continue;
      if (!entry.groups.has(key))
        entry.groups.set(key, {
          id: `original-solid-${entry.groups.size}`,
          positionsMm: [],
          indices: [],
          color,
        });
      const surface = entry.groups.get(key);
      for (let j = 1; j < polygon.length - 1; j++) {
        const tri = [polygon[0], polygon[j], polygon[j + 1]].map((p) =>
          p.map(
            (v, axis) =>
              Math.round(v * 1000) - (axis === 0 ? x * 128000 : axis === 2 ? z * 128000 : 0),
          ),
        );
        const a = new THREE.Vector3(...tri[1]).sub(new THREE.Vector3(...tri[0]));
        const b = new THREE.Vector3(...tri[2]).sub(new THREE.Vector3(...tri[0]));
        if (a.cross(b).lengthSq() === 0) continue;
        const offset = surface.positionsMm.length / 3;
        surface.positionsMm.push(...tri.flat());
        surface.indices.push(offset, offset + 1, offset + 2);
      }
    }
  }
}
function addBox(box) {
  const geometry = new THREE.BoxGeometry(...box.size);
  geometry.translate(...box.center);
  solid(box.id, [...geometry.attributes.position.array], [...geometry.index.array], box.color);
  geometry.dispose();
}
for (const q of design.quays)
  addBox({
    id: 'quay',
    center: [(q.min[0] + q.max[0]) / 2, 0.5, (q.min[1] + q.max[1]) / 2],
    size: [q.max[0] - q.min[0], 7, q.max[1] - q.min[1]],
    color: [0.48, 0.46, 0.4],
  });
for (const box of design.boxes) addBox(box);
for (const roof of design.gables) {
  const [x, y, z] = roof.center,
    w = roof.width / 2,
    d = roof.depth / 2;
  const positions = [
    [x - w, y, z - d],
    [x + w, y, z - d],
    [x, y + roof.rise, z - d],
    [x - w, y, z + d],
    [x + w, y, z + d],
    [x, y + roof.rise, z + d],
  ].flat();
  solid(
    roof.id,
    positions,
    [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4],
    roof.color,
  );
}
const cubeFaces = [
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6,
  1, 6, 5,
];
for (const arch of design.arches)
  for (let i = 0; i < 20; i++) {
    const a = (Math.PI * i) / 20,
      b = (Math.PI * (i + 1)) / 20;
    const section = [a, b].map((t) => [
      arch.center[0] - (Math.cos(t) * arch.span) / 2,
      arch.center[1] + Math.sin(t) * arch.rise,
    ]);
    const positions = [];
    for (const z of [arch.center[2] - arch.depth / 2, arch.center[2] + arch.depth / 2])
      for (const [p, extra] of [
        [section[0], 0],
        [section[1], 0],
        [section[1], arch.thickness],
        [section[0], arch.thickness],
      ])
        positions.push(p[0], p[1] + extra, z);
    solid(`${arch.id}-${i}`, positions, cubeFaces, arch.color);
  }
for (const placement of design.placements) {
  const { id, asset, x, y, z, scale, yaw } = placement,
    model = models.get(asset);
  const entry = cells.find(
    (e) => e.cell.x === Math.floor(x / 128) && e.cell.z === Math.floor(z / 128),
  );
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    positionsMm = [],
    normals = [];
  for (let i = 0; i < model.positions.length; i += 3) {
    const px = model.positions[i] * scale,
      pz = model.positions[i + 2] * scale;
    positionsMm.push(
      Math.round((x + c * px + s * pz) * 1000) - entry.cell.x * 128000,
      Math.round((y + model.positions[i + 1] * scale) * 1000),
      Math.round((z - s * px + c * pz) * 1000) - entry.cell.z * 128000,
    );
    normals.push(
      c * model.normals[i] + s * model.normals[i + 2],
      model.normals[i + 1],
      -s * model.normals[i] + c * model.normals[i + 2],
    );
  }
  assert(
    positionsMm.every((v, i) => i % 3 === 1 || (v >= 0 && v <= 128000)),
    `Licensed placement crosses a cell: ${id}`,
  );
  entry.cell.surfaces.push({ id, positionsMm, indices: model.indices, color: [1, 1, 1] });
  entry.textures.set(palette.id, palette);
  entry.bindings.push({
    surfaceId: id,
    textureId: palette.id,
    uvs: croppedUVs(model.uvs),
    normals,
    colors: [],
    alphaMode: 'OPAQUE',
    alphaCutoff: 0,
    doubleSided: false,
    collision: 'solid',
  });
}
for (const entry of cells) {
  for (const surface of [...entry.groups.values()].filter((s) => s.indices.length)) {
    entry.cell.surfaces.push(surface);
    entry.textures.set(white.id, white);
    const normals = [];
    for (let i = 0; i < surface.positionsMm.length; i += 9) {
      const p = surface.positionsMm;
      const n = new THREE.Vector3(p[i + 3] - p[i], p[i + 4] - p[i + 1], p[i + 5] - p[i + 2])
        .cross(new THREE.Vector3(p[i + 6] - p[i], p[i + 7] - p[i + 1], p[i + 8] - p[i + 2]))
        .normalize();
      normals.push(...n.toArray(), ...n.toArray(), ...n.toArray());
    }
    entry.bindings.push({
      surfaceId: surface.id,
      textureId: white.id,
      uvs: Array((surface.positionsMm.length / 3) * 2).fill(0.5),
      normals,
      colors: [],
      alphaMode: 'OPAQUE',
      alphaCutoff: 0,
      doubleSided: false,
      collision: 'solid',
    });
  }
  for (const canal of design.canals) {
    const { x, z } = entry.cell,
      lo = [Math.max(x * 128, canal.min[0]), Math.max(z * 128, canal.min[1])],
      hi = [Math.min((x + 1) * 128, canal.max[0]), Math.min((z + 1) * 128, canal.max[1])];
    if (hi[0] <= lo[0] || hi[1] <= lo[1]) continue;
    const id = canal.id + '-water',
      points = [
        [lo[0], lo[1]],
        [lo[0], hi[1]],
        [hi[0], hi[1]],
        [hi[0], lo[1]],
      ];
    entry.cell.surfaces.push({
      id,
      positionsMm: points.flatMap(([px, pz]) => [
        Math.round(px * 1000) - x * 128000,
        0,
        Math.round(pz * 1000) - z * 128000,
      ]),
      indices: [0, 1, 2, 0, 2, 3],
      color: [1, 1, 1],
    });
    entry.textures.set(water.id, water);
    entry.bindings.push({
      surfaceId: id,
      textureId: water.id,
      uvs: points.flatMap(([px, pz]) => [px / 24, pz / 24]),
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      colors: [],
      alphaMode: 'OPAQUE',
      alphaCutoff: 0,
      doubleSided: false,
      collision: 'visual-only',
    });
  }
}
const scenery = cells.map(({ cell, bindings, textures }) =>
  validateRgbaSceneryCell({
    format: 'FPVRegionRgbaScenery.v1',
    cell,
    bindings,
    textures: [...textures.values()],
  }),
);
validateTerrainSeams(terrains);
const resources = scenerySourceResources(scenery);
assert(
  (resources.resourceBytes + 456408) * 2 <= 8 * 1024 * 1024,
  'Retained plus staged window exceeds8MiB',
);
await mkdir(output, { recursive: false });
const manifests = {};
for (const [layer, sources, compile] of [
  ['terrain', terrains, compileTerrainCell],
  ['scenery', scenery, compileRgbaSceneryCell],
]) {
  await mkdir(resolve(output, layer));
  const assets = [],
    chunks = [];
  for (const source of sources) {
    const cell = source.cell ?? source,
      ids = [];
    for (const [kind, bytes] of [
      ['scene', compile(source).glb],
      ['collision', json(source)],
    ]) {
      const id = `${cell.chunkId}-${kind}`,
        path = `${cell.chunkId}.${kind === 'scene' ? 'glb' : 'json'}`;
      assets.push({ id, kind, path, bytes: bytes.length, sha256: hash(bytes) });
      ids.push(id);
      await writeFile(resolve(output, layer, path), bytes);
    }
    chunks.push({ id: cell.chunkId, x: cell.x, z: cell.z, assets: ids });
  }
  const manifest = {
    format: 'FPVRegionManifest.v1',
    id: 'canal-city-study',
    revision: design.revision,
    title: { en: 'Canal City — bridges and courtyards', uk: 'Місто каналів — мости й подвір’я' },
    grid: {
      cellSizeMm: 128000,
      minX: 0,
      minZ: 0,
      width: 3,
      depth: 3,
      floorMm: -12000,
      ceilingMm: 100000,
    },
    assets,
    chunks,
    spawns: design.spawns,
  };
  validateRegionManifest(manifest);
  manifests[layer] = manifest;
  await writeFile(resolve(output, layer, 'region.json'), json(manifest));
}
const provenance = await readFile(
  new URL('../hillside-town/source-provenance.json', import.meta.url),
);
await writeFile(resolve(output, 'licensed-source-provenance.json'), provenance);
await writeFile(
  resolve(output, 'License.txt'),
  await readFile(new URL('../hillside-town/source/License.txt', import.meta.url)),
);
const receipt = {
  format: 'FPVCanalCityPreparation.v1',
  actualSizeM: [384, 384],
  terrainCells: 9,
  sceneryCells: 9,
  spawns: design.spawns,
  routes: design.routes,
  licensedPlacements: design.placements.length,
  originalBoxes: design.boxes.length,
  archedBridges: design.arches.length,
  gabledRoofs: design.gables.length,
  sourceBytes: Object.values(manifests)
    .flatMap((m) => m.assets)
    .reduce((n, a) => n + a.bytes, 0),
  geometryBytes: resources.geometryBytes,
  textureBytes: resources.textureBytes,
  resourceBytes: resources.resourceBytes,
  retainedAndCandidateBytes: (resources.resourceBytes + 456408) * 2,
  terrainManifestSHA256: hash(json(manifests.terrain)),
  sceneryManifestSHA256: hash(json(manifests.scenery)),
  paletteConversion:
    'Exact original texels in 256x128 atlas crop; UVs remapped at original texel density with 16px halo, normals retained. Distant mip averages can differ.',
  paletteCrop: crop,
  sourceReceiptSHA256: hash(provenance),
  water: 'Visual-only; no fluid physics',
  playerReady: false,
};
await writeFile(resolve(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
