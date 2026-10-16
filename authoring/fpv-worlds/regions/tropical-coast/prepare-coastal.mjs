/** Exact original layout plus CC0 derived assets; no decoder or network fetch in the player. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { compileScenerySource, scenerySourceResources } from '../indexed-scenery-cell.mjs';
import {
  validateRgbaSceneryCell,
  rgbaTextureKey,
} from '../../../../optional-practice/civilian-fpv/regional/rgba-scenery-cell.mjs';
import { compileTerrainCell, validateTerrainSeams } from '../terrain-cell.mjs';
import { validateRegionManifest } from '../region-manifest.mjs';
import * as originalDesign from './coastal-design.mjs';
const variant = process.argv[4];
assert(
  !variant || ['districts', 'settlement', 'harbour'].includes(variant),
  'Unknown coastal composition',
);
const design =
  variant === 'harbour'
    ? await import('./harbour-design.mjs')
    : variant === 'settlement'
      ? await import('./settlement-design.mjs')
      : variant
        ? await import('./district-design.mjs')
        : originalDesign;
const { coastalHeightMm, placements, startingPoints, flightRoutes } = design;
const cellSizeMm = design.region?.cellSizeMm ?? 128000;
const cellSizeM = cellSizeMm / 1000;
if (variant) {
  assert.equal(design.districts.length, 6);
  assert.equal(design.landmarks.length, 12);
  const ids = new Set(design.landmarks.map((landmark) => landmark.id));
  assert.equal(ids.size, 12, 'Landmarks need distinct identities');
  const referenced = design.districts.flatMap((district) => district.landmarks);
  assert.equal(new Set(referenced).size, 12);
  assert(
    referenced.every((id) => ids.has(id)),
    'District landmark must exist',
  );
  const cells = design.districts.flatMap((district) => district.cells.map(([x, z]) => `${x},${z}`));
  assert.equal(cells.length, 9);
  assert.equal(new Set(cells).size, 9, 'Districts partition the authored cells');
}

const [input, output] = process.argv.slice(2);
assert(input && output, 'Provide prepared RGBA asset folder and a new external output directory');
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex');
const json = (x) => Buffer.from(JSON.stringify(x));
const records = JSON.parse(await fs.readFile(path.join(input, 'receipt.json'), 'utf8'));
const models = new Map();
for (const row of records) {
  const b = await fs.readFile(path.join(input, row.id + '.json'));
  assert.equal(hash(b), row.sourceSha256);
  const source = validateRgbaSceneryCell(b.toString('utf8'));
  const glb = compileScenerySource(source).glb;
  assert.equal(hash(glb), row.glbSha256);
  models.set(row.id, source);
}
const grid = {
  cellSizeMm,
  minX: 0,
  minZ: 0,
  width: 3,
  depth: 3,
  floorMm: -12000,
  ceilingMm: 120000,
};
const base = {
  format: 'FPVRegionManifest.v1',
  id: design.region?.id ?? 'tropical-coastal-study',
  revision: design.region?.revision ?? 'coastal-r1',
  title: design.region?.title ?? {
    en: 'Tropical coast — bounded flight study',
    uk: 'Тропічне узбережжя — дослідження польоту',
  },
  grid,
  spawns: startingPoints,
};
const layers = {
  terrain: { ...base, assets: [], chunks: [] },
  scenery: { ...base, assets: [], chunks: [] },
};
const terrainCells = [],
  sceneryCells = [],
  waterCells = [];
for (let z = 0; z < 3; z++)
  for (let x = 0; x < 3; x++) {
    const id = `coast-${x}-${z}`,
      surfaces = [],
      bindings = [],
      textures = [],
      textureKeys = new Map();
    const textureRef = (t) => {
      const key = rgbaTextureKey(t);
      if (textureKeys.has(key)) return textureKeys.get(key);
      const id = `texture-${textures.length}`;
      textures.push({ ...t, id });
      textureKeys.set(key, id);
      return id;
    };
    for (const item of placements.filter(
      (p) => Math.floor(p.x / cellSizeM) === x && Math.floor(p.z / cellSizeM) === z,
    )) {
      const model = models.get(item.asset);
      assert(model, item.asset);
      const c = Math.cos(item.yaw),
        s = Math.sin(item.yaw);
      for (const surf of model.cell.surfaces) {
        const b = model.bindings.find((b) => b.surfaceId === surf.id),
          surfaceId = `${item.id}-${surf.id}`;
        const positionsMm = [];
        for (let i = 0; i < surf.positionsMm.length; i += 3) {
          const px = (surf.positionsMm[i] / 1000 - 64) * item.scale,
            pz = (surf.positionsMm[i + 2] / 1000 - 64) * item.scale;
          positionsMm.push(
            Math.round((item.x - x * cellSizeM + c * px + s * pz) * 1000),
            Math.round(item.y * 1000 + surf.positionsMm[i + 1] * item.scale),
            Math.round((item.z - z * cellSizeM - s * px + c * pz) * 1000),
          );
        }
        const normals = [];
        for (let i = 0; i < b.normals.length; i += 3)
          normals.push(
            c * b.normals[i] + s * b.normals[i + 2],
            b.normals[i + 1],
            -s * b.normals[i] + c * b.normals[i + 2],
          );
        surfaces.push({ ...surf, id: surfaceId, positionsMm });
        bindings.push({
          ...b,
          surfaceId,
          normals,
          textureId: textureRef(model.textures.find((t) => t.id === b.textureId)),
        });
      }
    }
    for (const addition of design.extraSurfaces?.({ x, z, models }) ?? []) {
      surfaces.push(addition.surface);
      bindings.push({ ...addition.binding, textureId: textureRef(addition.texture) });
    }
    if (z === 0) {
      const textureId = textureRef({
        id: 'water',
        width: 1,
        height: 1,
        rgbaBase64: Buffer.from([255, 255, 255, 255]).toString('base64'),
        magFilter: 9729,
        minFilter: 9729,
        wrapS: 33071,
        wrapT: 33071,
      });
      surfaces.push({
        id: 'sea-surface',
        positionsMm: [0, 0, 0, 0, 0, cellSizeMm, cellSizeMm, 0, cellSizeMm, cellSizeMm, 0, 0],
        indices: [0, 1, 2, 0, 2, 3],
        color: [0.035, 0.35, 0.43],
      });
      bindings.push({
        surfaceId: 'sea-surface',
        textureId,
        uvs: [0, 0, 0, 1, 1, 1, 1, 0],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        colors: [],
        alphaMode: 'OPAQUE',
        alphaCutoff: 0,
        doubleSided: false,
        collision: 'visual-only',
      });
      waterCells.push(id);
    }
    const scenery = validateRgbaSceneryCell({
      format: 'FPVRegionRgbaScenery.v1',
      cell: {
        format: 'FPVRegionScenery.v1',
        chunkId: id,
        x,
        z,
        cellSizeMm,
        surfaces,
      },
      textures,
      bindings,
    });
    sceneryCells.push(scenery);
    const heightsMm = [];
    for (let iz = 0; iz < 33; iz++)
      for (let ix = 0; ix < 33; ix++)
        heightsMm.push(
          coastalHeightMm(
            x * cellSizeM + (ix * cellSizeM) / 32,
            z * cellSizeM + (iz * cellSizeM) / 32,
          ),
        );
    terrainCells.push({
      format: 'FPVRegionCollision.v1',
      chunkId: id,
      x,
      z,
      cellSizeMm,
      samples: 33,
      heightsMm,
    });
  }
validateTerrainSeams(terrainCells);
const resources = scenerySourceResources(sceneryCells);
const terrainGeometryBytes = terrainCells.reduce((n, c) => {
  const g = compileTerrainCell(c);
  return n + g.positions.byteLength * 2 + g.indices.byteLength;
}, 0);
assert(Number.isFinite(terrainGeometryBytes));
console.error(
  JSON.stringify({
    geometry: resources.geometryBytes,
    texture: resources.textureBytes,
    terrainGeometryBytes,
    retainedCandidate: (resources.resourceBytes + terrainGeometryBytes) * 2,
    textures: resources.textures.size,
  }),
);
assert(
  (resources.resourceBytes + terrainGeometryBytes) * 2 <= 8 * 1024 * 1024,
  'Full retained+candidate windows must fit existing resource ceiling',
);
await fs.mkdir(output, { recursive: false });
const cellRecords = [];
for (const [layer, cells, compile] of [
  ['terrain', terrainCells, compileTerrainCell],
  ['scenery', sceneryCells, compileScenerySource],
]) {
  await fs.mkdir(path.join(output, layer));
  for (const source of cells) {
    const cell = source.cell || source,
      compiled = compile(source),
      sourceBytes = json(source);
    for (const [kind, ext, bytes] of [
      ['collision', 'json', sourceBytes],
      ['scene', 'glb', compiled.glb],
    ]) {
      const asset = {
        id: `${cell.chunkId}-${kind}`,
        kind,
        path: `${cell.chunkId}.${ext}`,
        bytes: bytes.length,
        sha256: hash(bytes),
      };
      await fs.writeFile(path.join(output, layer, asset.path), bytes);
      layers[layer].assets.push(asset);
    }
    layers[layer].chunks.push({
      id: cell.chunkId,
      x: cell.x,
      z: cell.z,
      assets: [`${cell.chunkId}-collision`, `${cell.chunkId}-scene`],
    });
    if (layer === 'scenery')
      cellRecords.push({
        id: cell.chunkId,
        sourceBytes: sourceBytes.length,
        sceneBytes: compiled.glb.length,
        surfaces: cell.surfaces.length,
        triangles: cell.surfaces.reduce((n, s) => n + s.indices.length / 3, 0),
        textures: source.textures.length,
        solid: source.bindings.filter((b) => b.collision === 'solid').length,
        visualOnly: source.bindings.filter((b) => b.collision === 'visual-only').length,
      });
  }
  validateRegionManifest(layers[layer]);
  await fs.writeFile(path.join(output, layer, 'region.json'), json(layers[layer]));
}
const receipt = {
  format: 'FPVTropicalCoastPreparation.v1',
  scope:
    design.region?.scope ??
    'Bounded384m authoring candidate, not large archipelago/default player admission',
  regionId: base.id,
  revision: base.revision,
  sizeM: [cellSizeM * 3, cellSizeM * 3],
  terrainManifestSHA256: hash(json(layers.terrain)),
  sceneryManifestSHA256: hash(json(layers.scenery)),
  resources: {
    ...resources,
    textures: resources.textures.size,
    terrainGeometryBytes,
    retainedAndCandidateBytes: (resources.resourceBytes + terrainGeometryBytes) * 2,
  },
  cells: cellRecords,
  placements,
  water: {
    cells: waterCells,
    meaning: 'Visual sea at0m above actual terrain seabed; no buoyancy or water-damage behavior',
  },
  routes: flightRoutes,
  inputs: records,
  ...(variant
    ? {
        districts: design.districts,
        landmarks: design.landmarks,
        verificationProbes: design.verificationProbes,
        contactProbes: design.contactProbes,
      }
    : {}),
};
await fs.writeFile(path.join(output, 'preparation.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt.resources));
