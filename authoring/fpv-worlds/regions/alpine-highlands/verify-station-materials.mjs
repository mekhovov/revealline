/** Exact source/material/production-owner parity; no native visual acceptance. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import validator from "gltf-validator";
import { validateRegionManifest } from "../region-manifest.mjs";
import {
  validateScenerySource,
  compileScenerySource,
} from "../indexed-scenery-cell.mjs";
import { createVerifiedMixedWindow } from "../verified-mixed-window.mjs";
import { createRegionalSession } from "../../../../optional-practice/civilian-fpv/regional-session.mjs";
import { routes } from "./design.mjs";
const [base, output] = process.argv.slice(2).map((p) => resolve(p));
assert(base && output, "Provide exact contour source and material revision");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const receipt = JSON.parse(
  await readFile(resolve(output, "station-materials.json")),
);
function triangleIdentity(source) {
  const rows = [];
  for (const surface of source.cell.surfaces) {
    const binding = source.bindings.find((b) => b.surfaceId === surface.id);
    for (let i = 0; i < surface.indices.length; i += 3) {
      const vertices = surface.indices
        .slice(i, i + 3)
        .map((index) => [
          ...surface.positionsMm.slice(index * 3, index * 3 + 3),
          ...binding.normals.slice(index * 3, index * 3 + 3),
        ]);
      rows.push(JSON.stringify([binding.collision, ...vertices]));
    }
  }
  return sha(rows.sort().join("\n"));
}
async function load(root) {
  const manifests = {},
    sources = {};
  for (const layer of ["terrain", "scenery"]) {
    const bytes = await readFile(resolve(root, layer, "region.json"));
    const manifest = (manifests[layer] = validateRegionManifest(
      bytes.toString(),
    ));
    const files = new Map();
    for (const asset of manifest.assets) {
      const body = await readFile(resolve(root, layer, asset.path));
      assert.equal(body.length, asset.bytes);
      assert.equal(sha(body), asset.sha256);
      files.set("/" + asset.path, body);
    }
    sources[layer] = {
      baseURL: `https://${layer}.invalid/`,
      files,
      fetchImpl: async (url) => {
        const bytes = files.get(new URL(url).pathname);
        return new Response(bytes, { status: bytes ? 200 : 404 });
      },
    };
  }
  return { manifests, sources };
}
const before = await load(base),
  after = await load(output);
assert.deepEqual(
  after.manifests.terrain.assets,
  before.manifests.terrain.assets,
  "Every terrain asset byte stays exact",
);
for (const layer of ["terrain", "scenery"]) {
  assert.deepEqual(after.manifests[layer].grid, before.manifests[layer].grid);
  assert.deepEqual(
    after.manifests[layer].spawns,
    before.manifests[layer].spawns,
  );
  assert.deepEqual(
    after.manifests[layer].chunks,
    before.manifests[layer].chunks,
  );
}
let cells = 0,
  canonical = 0,
  changed = 0;
for (const asset of after.manifests.scenery.assets.filter(
  (a) => a.kind === "collision",
)) {
  const a = validateScenerySource(
    JSON.parse(before.sources.scenery.files.get("/" + asset.path)),
  );
  const b = validateScenerySource(
    JSON.parse(after.sources.scenery.files.get("/" + asset.path)),
  );
  assert.equal(
    triangleIdentity(a),
    triangleIdentity(b),
    "Every oriented triangle, normal and solid/visual classification stays exact",
  );
  cells++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    changed++;
    const bytes = compileScenerySource(b).glb;
    assert.deepEqual(
      Buffer.from(bytes),
      after.sources.scenery.files.get(`/${b.cell.chunkId}.glb`),
    );
    const result = await validator.validateBytes(bytes);
    assert.equal(result.issues.numErrors, 0);
    assert.equal(result.issues.numWarnings, 0);
    canonical++;
    for (const texture of b.textures) {
      const pixels = Buffer.from(texture.rgbaBase64, "base64");
      for (let i = 3; i < pixels.length; i += 4)
        assert.equal(pixels[i], 255, "No transparent wall pixels");
    }
    assert(b.bindings.every((binding) => binding.alphaMode === "OPAQUE"));
  }
}
assert.equal(changed, receipt.edits.length);
const mm = ([x, y, z]) => ({ x: x * 1000, y: y * 1000, z: z * 1000 });
const cases = [];
for (const quality of ["performance", "balanced", "quality"]) {
  const owner = createVerifiedMixedWindow(after.manifests.terrain, {
    source: { ...after.sources.terrain, surfaceQuality: quality },
    scenery: {
      manifest: after.manifests.scenery,
      source: {
        ...after.sources.scenery,
        surfaceStyle: "alpine-overlays",
        surfaceQuality: quality,
      },
    },
  });
  try {
    await owner.transition(mm([3400, 564, 3100]));
    const route = routes.find((r) => r.id === "summit-station-concourse");
    for (const offset of [-route.halfWidth, 0, route.halfWidth])
      assert.equal(
        owner.sweep(
          mm([route.from[0], route.from[1], route.from[2] + offset]),
          mm([route.to[0], route.to[1], route.to[2] + offset]),
          250,
        ).status,
        "terrain-clear",
      );
    for (const z of [3068, 3132])
      assert.equal(
        owner.sweep(mm([3400, 564, 3100]), mm([3400, 564, z]), 250).status,
        "terrain-hit",
        "Backed wall panels remain solid",
      );
    const s = owner.snapshot();
    cases.push({
      quality,
      geometryBytes: s.geometryBytes,
      textureBytes: s.textureBytes,
      resourceBytes: s.resourceBytes,
      reservedGeometryBytes: s.reservedGeometryBytes,
    });
  } finally {
    await owner.dispose();
    assert.equal(owner.snapshot().resourceBytes, 0);
    assert.equal(owner.snapshot().reservedGeometryBytes, 0);
  }
}
assert.deepEqual(
  cases.map((c) => [c.geometryBytes, c.textureBytes]),
  Array(3).fill([cases[0].geometryBytes, cases[0].textureBytes]),
);
for (const mode of ["self-level", "acro"]) {
  const session = createRegionalSession({
    manifest: after.manifests.terrain,
    source: after.sources.terrain,
    scenery: {
      manifest: after.manifests.scenery,
      source: after.sources.scenery,
    },
    geometryProfile: "terrain-scenery-v1",
    spawnId: "summit-station",
    initialHeading: 9000,
    mode,
  });
  try {
    await session.prepare();
    assert.equal(session.snapshot().status, "paused");
    assert.equal(session.snapshot().position.y, 564000);
  } finally {
    await session.dispose();
    assert.equal(session.snapshot().terrain.geometryBytes, 0);
  }
}
console.log(
  JSON.stringify(
    {
      passed: true,
      unchangedTriangleCells: cells,
      changedCells: changed,
      canonicalGlbs: canonical,
      tiers: cases,
      terrainAssetBytesUnchanged: true,
      collisionAndNormalsUnchanged: true,
      transparentWallPixels: 0,
      disarmedModes: 2,
      disposalZero: true,
      nativeVisualAcceptance: false,
      receipt,
    },
    null,
    2,
  ),
);
