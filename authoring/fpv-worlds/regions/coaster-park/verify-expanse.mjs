/** Exact source, collision, source-window and disposal verification; no visual claim. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import validator from "gltf-validator";
import { validateRegionManifest } from "../region-manifest.mjs";
import { compileTerrainCell, validateTerrainSeams } from "../terrain-cell.mjs";
import {
  compileScenerySource,
  validateScenerySource,
  scenerySourceCell,
} from "../indexed-scenery-cell.mjs";
import { createVerifiedMixedWindow } from "../verified-mixed-window.mjs";
import {
  GRID,
  EXTENT_M,
  heightMm,
  surfaceMm,
  routes,
  compositionSupports,
  solidProbes,
  districts,
  landmarks,
} from "./expanse-design.mjs";
const root = resolve(process.argv[2] ?? "");
assert(process.argv[2], "Provide generated paired source");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const receipt = JSON.parse(await readFile(resolve(root, "preparation.json"))),
  manifests = {},
  sources = {},
  terrain = new Map();
assert.deepEqual(receipt.routes, routes);
assert.deepEqual(receipt.solidProbes, solidProbes);
let sourceBytes = 0,
  canonical = 0,
  seams = 0;
for (const layer of ["terrain", "scenery"]) {
  const body = await readFile(resolve(root, layer, "region.json"));
  sourceBytes += body.length;
  assert.equal(sha(body), receipt[`${layer}ManifestSHA256`]);
  const manifest = (manifests[layer] = validateRegionManifest(body.toString()));
  assert.equal(manifest.grid.width, GRID);
  assert.equal(manifest.grid.depth, GRID);
  assert.equal(manifest.grid.cellSizeMm, 256000);
  const bodies = new Map();
  for (const asset of manifest.assets) {
    const bytes = await readFile(resolve(root, layer, asset.path));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(sha(bytes), asset.sha256);
    bodies.set("/" + asset.path, bytes);
    sourceBytes += bytes.length;
  }
  for (const asset of manifest.assets.filter((a) => a.kind === "collision")) {
    const input = JSON.parse(bodies.get("/" + asset.path)),
      cell = layer === "terrain" ? input : scenerySourceCell(input);
    if (layer === "terrain") {
      const regenerated = Array.from({ length: 1089 }, (_, i) =>
        heightMm(
          cell.x * 256 + (i % 33) * 8,
          cell.z * 256 + Math.floor(i / 33) * 8,
        ),
      );
      assert.deepEqual(cell.heightsMm, regenerated);
      terrain.set(`${cell.x},${cell.z}`, cell);
    } else validateScenerySource(input);
    const compiled = (
      layer === "terrain" ? compileTerrainCell : compileScenerySource
    )(input).glb;
    assert.deepEqual(
      Buffer.from(compiled),
      bodies.get("/" + cell.chunkId + ".glb"),
    );
    const result = await validator.validateBytes(new Uint8Array(compiled));
    assert.equal(result.issues.numErrors, 0, `${layer}/${cell.chunkId}`);
    assert.equal(result.issues.numWarnings, 0, `${layer}/${cell.chunkId}`);
    canonical++;
  }
  sources[layer] = {
    baseURL: `https://${layer}.invalid/`,
    fetchImpl: async (url) => {
      const b = bodies.get(new URL(url).pathname);
      return new Response(b, { status: b ? 200 : 404 });
    },
  };
}
for (const cell of terrain.values())
  for (const [x, z] of [
    [cell.x + 1, cell.z],
    [cell.x, cell.z + 1],
  ]) {
    const next = terrain.get(`${x},${z}`);
    if (next) {
      validateTerrainSeams([cell, next]);
      seams++;
    }
  }
assert.equal(seams, 2 * GRID * (GRID - 1));
assert.equal(sourceBytes, receipt.sourceBytes);
const owner = createVerifiedMixedWindow(manifests.terrain, {
  source: sources.terrain,
  scenery: { manifest: manifests.scenery, source: sources.scenery },
  maxGeometryBytes: 8 * 1024 * 1024,
});
const mm = ([x, y, z]) => ({
  x: Math.round(x * 1000),
  y: Math.round(y * 1000),
  z: Math.round(z * 1000),
});
let maxResourceBytes = 0,
  maxReservedBytes = 0,
  transitions = 0,
  clearProbes = 0,
  solidHits = 0;
const prepare = async (point) => {
  await owner.transition(mm(point));
  const s = owner.snapshot();
  assert.equal(s.state, "ready");
  maxResourceBytes = Math.max(maxResourceBytes, s.resourceBytes);
  maxReservedBytes = Math.max(maxReservedBytes, s.reservedGeometryBytes);
  assert(s.reservedGeometryBytes <= 8 * 1024 * 1024);
  transitions++;
};
try {
  for (const route of routes) {
    const distance = Math.hypot(
      route.to[0] - route.from[0],
      route.to[2] - route.from[2],
    );
    const count = Math.ceil(distance / 24);
    for (let n = 0; n < count; n++) {
      const a = route.from.map((v, i) => v + ((route.to[i] - v) * n) / count),
        b = route.from.map((v, i) => v + ((route.to[i] - v) * (n + 1)) / count);
      await prepare(a);
      for (const side of [-route.halfWidth, 0, route.halfWidth]) {
        const dx = (route.to[0] - route.from[0]) / distance,
          dz = (route.to[2] - route.from[2]) / distance;
        const offset = (p) => mm([p[0] - dz * side, p[1], p[2] + dx * side]);
        const result = owner.sweep(offset(a), offset(b), 250);
        assert.equal(
          result.status,
          "terrain-clear",
          `${route.id} offset${side}: ${JSON.stringify(result)}`,
        );
        clearProbes++;
      }
    }
  }
  for (const probe of solidProbes) {
    await prepare(probe.from);
    const result = owner.sweep(mm(probe.from), mm(probe.to), 250);
    assert.equal(result.status, "terrain-hit", probe.id);
    assert.equal(result.layer, "scenery", probe.id);
    solidHits++;
  }
  for (const [x, z] of [
    [1723, 1527],
    [1019, 27],
    [2027, 1995],
    [1031, 945],
  ]) {
    const height = surfaceMm(x, z);
    await prepare([x, height / 1000 + 10, z]);
    const support = owner.support(mm([x, height / 1000 + 10, z]), 20000);
    assert.equal(support.status, "terrain-hit");
    assert.equal(support.layer, "terrain");
    assert(
      Math.abs(support.heightMm - height) < 2,
      "Authored placement must match canonical triangle support",
    );
  }
  for (const probe of compositionSupports) {
    await prepare(probe.position);
    const hit = owner.support(mm(probe.position), 5000);
    assert.equal(hit.status, "terrain-hit", probe.id);
    assert.equal(hit.layer, "scenery", probe.id);
    assert(
      Math.abs(hit.heightMm - probe.height * 1000) < 2,
      `${probe.id}: ${JSON.stringify(hit)}`,
    );
  }
  // All grid corners and each district are actually prepared, including explicit empty scenery.
  for (const [x, z] of [
    [64, 64],
    [EXTENT_M - 64, 64],
    [64, EXTENT_M - 64],
    [EXTENT_M - 64, EXTENT_M - 64],
    [1024, 1024],
  ])
    await prepare([x, heightMm(x, z) / 1000 + 10, z]);
  for (const spawn of manifests.terrain.spawns) {
    await prepare([
      spawn.position.x / 1000,
      spawn.position.y / 1000,
      spawn.position.z / 1000,
    ]);
    assert.equal(
      owner.sweep(spawn.position, spawn.position, 250).status,
      "terrain-clear",
      spawn.id,
    );
  }
  await owner.dispose();
  const final = owner.snapshot();
  for (const key of [
    "resourceBytes",
    "sourceBytes",
    "reservedSourceBytes",
    "reservedGeometryBytes",
  ])
    assert.equal(final[key], 0);
  console.log(
    JSON.stringify(
      {
        passed: true,
        sourcePins: {
          terrain: receipt.terrainManifestSHA256,
          scenery: receipt.sceneryManifestSHA256,
        },
        canonicalGLBs: canonical,
        seams,
        sourceBytes,
        districts: districts.length,
        landmarks: landmarks.length,
        clearProbes,
        compositionSupportProbes: compositionSupports.length,
        solidHits,
        transitions,
        maxResourceBytes,
        maxReservedBytes,
        disposalZero: true,
        playerReady: false,
      },
      null,
      2,
    ),
  );
} finally {
  await owner.dispose();
}
