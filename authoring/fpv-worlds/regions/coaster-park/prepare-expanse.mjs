/** Reproducible paired 2.048 km source. Refuses to overwrite existing output. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import * as THREE from "../../../../optional-practice/civilian-fpv/vendor/three.module.js";
import { compileTerrainCell, validateTerrainSeams } from "../terrain-cell.mjs";
import {
  compileScenerySource,
  validateScenerySource,
  scenerySourceResources,
} from "../indexed-scenery-cell.mjs";
import { validateRegionManifest } from "../region-manifest.mjs";
import { TERRAIN_GEOMETRY_BYTES_PER_CELL } from "../verified-terrain-window.mjs";
import {
  EXTENT_M,
  GRID,
  acceptedModels,
  surfaceMm,
  CELL_M,
  heightMm,
  districts,
  architecture,
  routes,
  spawns,
  landmarks,
  placements,
  solidProbes,
} from "./expanse-design.mjs";
import { createCoasterIndexedCells } from "./indexed-source.mjs";
const output = process.argv[2];
assert(output, "Provide a new external output directory");
const json = (x) => Buffer.from(JSON.stringify(x) + "\n");
const sha = (x) => createHash("sha256").update(x).digest("hex");
const terrain = [],
  cells = [];
for (let z = 0; z < GRID; z++)
  for (let x = 0; x < GRID; x++) {
    const base = {
      chunkId: `gardens-${x}-${z}`,
      x,
      z,
      cellSizeMm: CELL_M * 1000,
    };
    terrain.push({
      format: "FPVRegionCollision.v1",
      ...base,
      samples: 33,
      heightsMm: Array.from({ length: 1089 }, (_, i) =>
        heightMm(
          x * CELL_M + (i % 33) * 8,
          z * CELL_M + Math.floor(i / 33) * 8,
        ),
      ),
    });
    cells.push({
      format: "FPVRegionScenery.v1",
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
  assert(
    min[0] >= 0 && min[2] >= 0 && max[0] <= EXTENT_M && max[2] <= EXTENT_M,
    piece.id,
  );
  for (
    let z = Math.floor(min[2] / CELL_M);
    z <= Math.min(GRID - 1, Math.floor(max[2] / CELL_M));
    z++
  )
    for (
      let x = Math.floor(min[0] / CELL_M);
      x <= Math.min(GRID - 1, Math.floor(max[0] / CELL_M));
      x++
    ) {
      const cell = cells[z * GRID + x],
        low = [
          Math.max(min[0], x * CELL_M),
          min[1],
          Math.max(min[2], z * CELL_M),
        ],
        high = [
          Math.min(max[0], (x + 1) * CELL_M),
          max[1],
          Math.min(max[2], (z + 1) * CELL_M),
        ];
      if (high[0] <= low[0] || high[2] <= low[2]) continue;
      const key = piece.color.join(",");
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
            (i % 3 === 0
              ? x * CELL_M * 1000
              : i % 3 === 2
                ? z * CELL_M * 1000
                : 0),
        );
      for (const index of geometry.index.array)
        surface.indices.push(offset + index);
      geometry.dispose();
    }
}
for (const cell of cells) cell.surfaces.push(...cell.groups.values());
// Only the eight previously accepted source primitives are eligible for placement.
const inputModels = await createCoasterIndexedCells();
const models = new Map();
let palette;
for (const name of acceptedModels) {
  const model = inputModels.get(name);
  assert(model, name);
  compileScenerySource(model); // Re-prove quantization and canonical validation before placement.
  palette ??= model.textures;
  assert.deepEqual(
    model.textures,
    palette,
    "All placements retain one exact pinned palette",
  );
  models.set(name, model);
}
const modelInputs = acceptedModels;
for (const placement of placements) {
  const { id, model: name, x, z } = placement;
  const model = models.get(name),
    cell = cells[Math.floor(z / CELL_M) * GRID + Math.floor(x / CELL_M)];
  assert(model && cell, id);
  const minY = Math.min(
    ...model.cell.surfaces.flatMap((s) =>
      s.positionsMm.filter((_, i) => i % 3 === 1),
    ),
  );
  const y = surfaceMm(x, z);
  if (name === "coaster-steel-looping.glb") {
    // Each support crosshead must contain actual imported rim vertices. This is
    // stronger than placing a visually nearby frame using an approximate circle.
    for (const dz of [-11, 11]) {
      const beam = pieces.find(
        (piece) =>
          piece.id === id.replace("-outer-feature", `-loop-rim-beam-${dz}`),
      );
      assert(beam, id);
      let contacts = 0;
      for (const surface of model.cell.surfaces) {
        for (let i = 0; i < surface.positionsMm.length; i += 3) {
          const point = [
            surface.positionsMm[i] / 1000 + x - 64,
            (surface.positionsMm[i + 1] + y - minY) / 1000,
            surface.positionsMm[i + 2] / 1000 + z - 64,
          ];
          if (
            point.every(
              (value, axis) =>
                Math.abs(value - beam.center[axis]) <= beam.size[axis] / 2,
            )
          )
            contacts++;
        }
      }
      assert(contacts > 0, `${id}: support ${dz} does not touch imported rim`);
    }
  }
  for (const [i, surface] of model.cell.surfaces.entries()) {
    const surfaceId = `${id}-${i}`;
    cell.surfaces.push({
      ...surface,
      id: surfaceId,
      positionsMm: surface.positionsMm.map((value, axis) =>
        Math.round(
          value +
            (axis % 3 === 0
              ? x * 1000 - 64000 - cell.x * CELL_M * 1000
              : axis % 3 === 1
                ? y - minY
                : z * 1000 - 64000 - cell.z * CELL_M * 1000),
        ),
      ),
    });
    cell.bindings.push({
      ...model.bindings.find((b) => b.surfaceId === surface.id),
      surfaceId,
    });
  }
}
for (const cell of cells)
  for (const surface of cell.surfaces)
    for (const [i, value] of surface.positionsMm.entries())
      assert(
        Number.isSafeInteger(value) &&
          (i % 3 === 1 || (value >= 0 && value <= CELL_M * 1000)),
        `${cell.chunkId}/${surface.id}: coordinate ${i} = ${value}`,
      );
const scenery = cells.map(
  ({ bindings, format, chunkId, x, z, cellSizeMm, surfaces }) => {
    const cell = { format, chunkId, x, z, cellSizeMm, surfaces };
    return cell.surfaces.length
      ? validateScenerySource(
          JSON.stringify(
            bindings.length
              ? {
                  format: "FPVRegionIndexedScenery.v1",
                  cell,
                  textures: palette,
                  bindings,
                }
              : cell,
          ),
        )
      : null;
  },
);
let seams = 0;
for (const cell of terrain)
  for (const [x, z] of [
    [cell.x + 1, cell.z],
    [cell.x, cell.z + 1],
  ])
    if (x < GRID && z < GRID) {
      validateTerrainSeams([cell, terrain[z * GRID + x]]);
      seams++;
    }
assert.equal(seams, 2 * GRID * (GRID - 1));
let maxWindowBytes = 0;
for (let z = 0; z < GRID; z++)
  for (let x = 0; x < GRID; x++) {
    const window = [];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || x + dx >= GRID || z + dz < 0 || z + dz >= GRID)
          continue;
        const c = scenery[(z + dz) * GRID + x + dx];
        if (c) window.push(c);
      }
    const bytes =
      scenerySourceResources(window).resourceBytes +
      9 * TERRAIN_GEOMETRY_BYTES_PER_CELL;
    maxWindowBytes = Math.max(maxWindowBytes, bytes);
  }
assert(
  maxWindowBytes * 2 <= 8 * 1024 * 1024,
  "Retained plus candidate windows must fit8MiB",
);
await mkdir(output, { recursive: false });
const manifests = {};
let sourceBytes = 0;
for (const [kind, sources, compile] of [
  ["terrain", terrain, compileTerrainCell],
  ["scenery", scenery, compileScenerySource],
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
        [
          "scene",
          Buffer.from(
            (() => {
              try {
                return compile(source).glb;
              } catch (error) {
                throw new Error(`${kind} ${base.chunkId}: ${error.message}`, {
                  cause: error,
                });
              }
            })(),
          ),
        ],
        ["collision", json(source)],
      ]) {
        const id = `${base.chunkId}-${type}`,
          path = `${base.chunkId}.${type === "scene" ? "glb" : "json"}`;
        assets.push({
          id,
          kind: type,
          path,
          bytes: bytes.length,
          sha256: sha(bytes),
        });
        ids.push(id);
        sourceBytes += bytes.length;
        await writeFile(resolve(output, kind, path), bytes);
      }
    chunks.push({ id: base.chunkId, x: base.x, z: base.z, assets: ids });
  }
  const manifest = {
    format:
      kind === "terrain" ? "FPVRegionManifest.v1" : "FPVSceneryManifest.v1",
    id: "coaster-gardens-study",
    revision: "composition-r2",
    title: {
      en: "Coaster Gardens — six connected park districts",
      uk: "Сади атракціонів — шість поєднаних паркових районів",
    },
    grid: {
      cellSizeMm: CELL_M * 1000,
      minX: 0,
      minZ: 0,
      width: GRID,
      depth: GRID,
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
  await writeFile(resolve(output, kind, "region.json"), body);
}
assert(
  sourceBytes < 64 * 1024 * 1024,
  "Source must fit existing64MiB delivery limit",
);
for (const file of ["source-provenance.json", "source/License.txt"])
  await writeFile(
    resolve(output, file.split("/").at(-1)),
    await readFile(new URL(file, import.meta.url)),
  );
const receipt = {
  format: "FPVCoasterGardensPreparation.v1",
  id: manifests.terrain.id,
  revision: manifests.terrain.revision,
  actualExtentM: [EXTENT_M, EXTENT_M],
  sampleSpacingM: 8,
  terrainCells: GRID * GRID,
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
    "Original source composition; no Library or final-art acceptance.",
    "Eight-metre terrain samples; narrower flight openings use matching visible/collision geometry.",
    "Six representative districts and routes, not an uninterrupted whole-map playtest.",
    "Static original park composition, not a mechanically connected functioning rollercoaster. No moving rides or scored proof changes.",
    "Four-kilometre target deferred until meaningful content density supports expansion. Original 160m pack unchanged.",
  ],
};
await writeFile(
  resolve(output, "preparation.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
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
