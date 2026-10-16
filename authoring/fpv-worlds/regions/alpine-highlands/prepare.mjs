/** Original 4.096 km source study. No player admission; refuses existing output. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
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
  GRID,
  CELL_M,
  EXTENT_M,
  heightMm,
  surfaceMm,
  districts,
  routes,
  spawns,
  architecture,
  landmarks,
  solidProbes,
} from "./design.mjs";
import { alpineSurfaceOverlays } from "./surface-overlays.mjs";
const output = process.argv[2];
assert(!process.argv[3] || process.argv[3] === "contours", "Unknown authoring variant");
const contours = process.argv[3] === "contours";
assert(output, "Provide a new external output directory");
const json = (v) => Buffer.from(JSON.stringify(v) + "\n"),
  sha = (b) => createHash("sha256").update(b).digest("hex");
const terrain = [],
  groups = [];
for (let z = 0; z < GRID; z++)
  for (let x = 0; x < GRID; x++) {
    terrain.push({
      format: "FPVRegionCollision.v1",
      chunkId: `alpine-${x}-${z}`,
      x,
      z,
      cellSizeMm: CELL_M * 1000,
      samples: 33,
      heightsMm: Array.from({ length: 1089 }, (_, i) =>
        heightMm(
          x * CELL_M + (i % 33) * 8,
          z * CELL_M + Math.floor(i / 33) * 8,
        ),
      ),
    });
    groups.push(new Map());
  }
function clip(poly, axis, edge, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ai = (a[axis] - edge) * sign >= 0,
      bi = (b[axis] - edge) * sign >= 0;
    if (ai) out.push(a);
    if (ai !== bi) {
      const t = (edge - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
function addTriangle(points, color, collision = "solid") {
  color = color.slice(0, 3);
  const min = [0, 2].map((a) =>
    Math.max(0, Math.floor(Math.min(...points.map((p) => p[a])) / CELL_M)),
  );
  const max = [0, 2].map((a) =>
    Math.min(
      GRID - 1,
      Math.floor(Math.max(...points.map((p) => p[a])) / CELL_M),
    ),
  );
  for (let z = min[1]; z <= max[1]; z++)
    for (let x = min[0]; x <= max[0]; x++) {
      let poly = points;
      for (const [axis, edge, sign] of [
        [0, x * CELL_M, 1],
        [0, (x + 1) * CELL_M, -1],
        [2, z * CELL_M, 1],
        [2, (z + 1) * CELL_M, -1],
      ])
        poly = clip(poly, axis, edge, sign);
      if (poly.length < 3) continue;
      const key = [...color, collision].join(","),
        map = groups[z * GRID + x];
      if (!map.has(key))
        map.set(key, {
          id: `surface-${map.size}`,
          color,
          collision,
          positionsMm: [],
          indices: [],
          lookup: new Map(),
        });
      const group = map.get(key);
      for (let n = 1; n + 1 < poly.length; n++) {
        const triangle = [poly[0], poly[n], poly[n + 1]].map((p) =>
          p.map(
            (v, a) =>
              Math.round(v * 1000) -
              (a === 0 ? x * CELL_M * 1000 : a === 2 ? z * CELL_M * 1000 : 0),
          ),
        );
        const a = new THREE.Vector3(...triangle[1]).sub(
            new THREE.Vector3(...triangle[0]),
          ),
          b = new THREE.Vector3(...triangle[2]).sub(
            new THREE.Vector3(...triangle[0]),
          );
        if (a.cross(b).lengthSq() <= 1) continue;
        for (const p of triangle) {
          const k = p.join(",");
          if (!group.lookup.has(k)) {
            group.lookup.set(k, group.positionsMm.length / 3);
            group.positionsMm.push(...p);
          }
          group.indices.push(group.lookup.get(k));
        }
      }
    }
}
const pieces = architecture();
for (const p of pieces) {
  if (
    /retaining|lookout-leg|viaduct-pier|dam-face|station-wing|cable-pylon/.test(
      p.id,
    )
  )
    assert(
      p.center[1] - p.size[1] / 2 <=
        surfaceMm(p.center[0], p.center[2]) / 1000 + 0.002,
      `${p.id}: unsupported foundation`,
    );
  const geometry =
    p.type === "box"
      ? new THREE.BoxGeometry(...p.size)
      : new THREE.ConeGeometry(p.size[0] / 2, p.size[1], 5, 1);
  if (p.rotationX) geometry.rotateX(p.rotationX);
  geometry.translate(...p.center);
  const a = geometry.attributes.position.array,
    ix = geometry.index.array;
  for (let i = 0; i < ix.length; i += 3)
    addTriangle(
      [0, 1, 2].map((j) =>
        Array.from(a.slice(ix[i + j] * 3, ix[i + j] * 3 + 3)),
      ),
      p.color,
    );
  geometry.dispose();
}
// Surface colours follow exact canonical terrain triangles. They are explicitly visual-only,
// 3 mm above the collision lattice, never an invented support or a hidden obstacle.
let overlayTriangles = 0;
for (const { points, color } of alpineSurfaceOverlays({ contours })) {
  addTriangle(points, color, "visual-only");
  overlayTriangles++;
}
// Explicit visual water plane above the reservoir floor; aircraft collision remains terrain-only.
for (const tri of [
  [
    [690, 176, 2680],
    [690, 176, 2770],
    [910, 176, 2680],
  ],
  [
    [910, 176, 2680],
    [690, 176, 2770],
    [910, 176, 2770],
  ],
])
  addTriangle(tri, [0.1, 0.35, 0.4, 1], "visual-only");
const scenery = groups.map((map, i) => {
  const active = [...map.values()].filter((s) => s.indices.length);
  if (!active.length) return null;
  const surfaces = active.map(({ id, color, positionsMm, indices }) => ({
    id,
    color,
    positionsMm,
    indices,
  }));
  const bindings = active.map((s) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        s.positionsMm.map((v) => v / 1000),
        3,
      ),
    );
    g.setIndex(s.indices);
    g.computeVertexNormals();
    const normals = Array.from(g.attributes.normal.array).map(
      (v) => Math.round(v * 1e6) / 1e6,
    );
    g.dispose();
    return {
      surfaceId: s.id,
      textureId: "original-white",
      uvs: Array.from({ length: (s.positionsMm.length / 3) * 2 }, () => 0),
      normals,
      colors: [],
      alphaMode: "OPAQUE",
      alphaCutoff: 0,
      doubleSided: true,
      collision: s.collision,
    };
  });
  const base = terrain[i];
  return validateScenerySource({
    format: "FPVRegionRgbaScenery.v1",
    cell: {
      format: "FPVRegionScenery.v1",
      chunkId: base.chunkId,
      x: base.x,
      z: base.z,
      cellSizeMm: base.cellSizeMm,
      surfaces,
    },
    textures: [
      {
        id: "original-white",
        width: 1,
        height: 1,
        rgbaBase64: "/////w==",
        magFilter: 9728,
        minFilter: 9728,
        wrapS: 33071,
        wrapT: 33071,
      },
    ],
    bindings,
  });
});
let seams = 0,
  maxWindowBytes = 0;
for (const cell of terrain)
  for (const [x, z] of [
    [cell.x + 1, cell.z],
    [cell.x, cell.z + 1],
  ])
    if (x < GRID && z < GRID) {
      validateTerrainSeams([cell, terrain[z * GRID + x]]);
      seams++;
    }
for (let z = 0; z < GRID; z++)
  for (let x = 0; x < GRID; x++) {
    const window = [];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        if (x + dx >= 0 && x + dx < GRID && z + dz >= 0 && z + dz < GRID) {
          const s = scenery[(z + dz) * GRID + x + dx];
          if (s) window.push(s);
        }
    maxWindowBytes = Math.max(
      maxWindowBytes,
      scenerySourceResources(window).resourceBytes +
        9 * TERRAIN_GEOMETRY_BYTES_PER_CELL,
    );
  }
assert(
  maxWindowBytes * 2 <= 8 * 1024 * 1024,
  "Retained and staged geometry must fit existing8MiB",
);
await mkdir(output, { recursive: false });
const manifests = {};
let sourceBytes = 0;
for (const [layer, sources, compile] of [
  ["terrain", terrain, compileTerrainCell],
  ["scenery", scenery, compileScenerySource],
]) {
  await mkdir(resolve(output, layer));
  const assets = [],
    chunks = [];
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i],
      base = terrain[i],
      ids = [];
    if (source)
      for (const [kind, bytes] of [
        ["scene", Buffer.from(compile(source).glb)],
        ["collision", json(source)],
      ]) {
        const id = `${base.chunkId}-${kind}`,
          path = `${base.chunkId}.${kind === "scene" ? "glb" : "json"}`;
        assets.push({
          id,
          kind,
          path,
          bytes: bytes.length,
          sha256: sha(bytes),
        });
        ids.push(id);
        sourceBytes += bytes.length;
        await writeFile(resolve(output, layer, path), bytes);
      }
    chunks.push({ id: base.chunkId, x: base.x, z: base.z, assets: ids });
  }
  const m = {
    format:
      layer === "terrain" ? "FPVRegionManifest.v1" : "FPVSceneryManifest.v1",
    id: "alpine-highlands-study",
    revision: contours ? "relief-r2-contours" : "relief-r1",
    title: {
      en: "Alpine Highlands — connected mountain study",
      uk: "Альпійське високогір’я — пробний гірський світ",
    },
    grid: {
      cellSizeMm: 256000,
      minX: 0,
      minZ: 0,
      width: GRID,
      depth: GRID,
      floorMm: 0,
      ceilingMm: 1000000,
    },
    assets,
    chunks,
    spawns,
  };
  validateRegionManifest(m);
  manifests[layer] = m;
  const bytes = json(m);
  sourceBytes += bytes.length;
  await writeFile(resolve(output, layer, "region.json"), bytes);
}
assert(sourceBytes < 64 * 1024 * 1024, "Existing64MiB source cap unchanged");
const receipt = {
  format: "FPVAlpineHighlandsPreparation.v1",
  id: manifests.terrain.id,
  revision: manifests.terrain.revision,
  actualExtentM: [EXTENT_M, EXTENT_M],
  sampleSpacingM: 8,
  terrainCells: terrain.length,
  sceneryCells: scenery.filter(Boolean).length,
  knownEmptySceneryCells: scenery.filter((s) => !s).length,
  seams,
  sourceBytes,
  terrainManifestSHA256: sha(json(manifests.terrain)),
  sceneryManifestSHA256: sha(json(manifests.scenery)),
  originalArchitecturePieces: pieces.length,
  overlayTriangles,
  maxNineCellResourceBytes: maxWindowBytes,
  maxRetainedCandidateResourceBytes: maxWindowBytes * 2,
  districts,
  landmarks,
  routes,
  spawns,
  solidProbes,
  playerReady: false,
  limitations: [
    "Original4.096km early study, not8km plan completion or representative final art.",
    "No native player/visual/performance or Library qualification.",
    "Water, snow and scree overlays are explicit visual-only surfaces; no swimming/water physics.",
    "Static original structures; no operating railway, cable cars, moving subjects or scored missions.",
    "Controlled representative routes do not prove every arbitrary path safe.",
  ],
};
await writeFile(
  resolve(output, "preparation.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
await writeFile(
  resolve(output, "provenance.json"),
  json({
    author: "RevealLine contributors",
    license: "CC0-1.0",
    source:
      "Original deterministic height fields, architectural solids and visual surface triangles authored for this project. No third-party simulator meshes, imagery or textures.",
    referenceOnly: [
      "https://www.velocidrone.com/scenery",
      "https://store.steampowered.com/app/1881200/TRYP_FPV__The_Drone_Racer_Simulator/",
      "https://store.steampowered.com/app/1682970/Uncrashed__FPV_Drone_Simulator/",
    ],
  }),
);
console.log(
  JSON.stringify(
    {
      ...receipt,
      districts: districts.length,
      landmarks: landmarks.length,
      routes: routes.length,
    },
    null,
    2,
  ),
);
