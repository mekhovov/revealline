/** Optional depth treatment parity; native occlusion/appearance remains a separate gate. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  compileScenerySource,
  scenerySourceCell,
} from "../indexed-scenery-cell.mjs";
import { createVerifiedMixedWindow } from "../verified-mixed-window.mjs";
import { sceneryMaterialStyle } from "../../../../optional-practice/civilian-fpv/regional/scenery-surface.mjs";
import { surfaceMm } from "./design.mjs";

const root = resolve(process.argv[2] ?? "");
assert(process.argv[2], "Provide the exact Alpine paired source directory");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const bodies = new Map();
async function file(relative) {
  if (!bodies.has(relative))
    bodies.set(relative, await readFile(resolve(root, relative)));
  return bodies.get(relative);
}
const terrainBytes = await file("terrain/region.json");
const sceneryBytes = await file("scenery/region.json");
assert.equal(
  sha(terrainBytes),
  "ce45cfcfc2f5ae829c863a926e8b7aa8133bedb404ceff3df4e4ed9a5dfd93a3",
);
assert.equal(
  sha(sceneryBytes),
  "692d5727473f4c99ec43e66fda667fe24112d174d89080409858a53d9a031fb7",
);
const terrain = JSON.parse(terrainBytes),
  scenery = JSON.parse(sceneryBytes);
let overlayTriangles = 0,
  unchangedSurfaces = 0,
  selectiveCases = 0;
const kinds = new Set();
for (const asset of scenery.assets.filter((a) => a.kind === "collision")) {
  const bytes = await file("scenery/" + asset.path);
  assert.equal(sha(bytes), asset.sha256);
  const input = JSON.parse(bytes),
    cell = scenerySourceCell(input);
  for (const surface of compileScenerySource(input).surfaces) {
    const selected = sceneryMaterialStyle("alpine-overlays", surface);
    assert.equal(sceneryMaterialStyle("plain", surface), "plain");
    if (selected === "plain") {
      unchangedSurfaces++;
      continue;
    }
    assert.equal(selected, "alpine-overlays");
    kinds.add(surface.color.join(","));
    overlayTriangles += surface.indices.length / 3;
    // Every selected overlay vertex lies on the exact canonical terrain lattice,
    // at the existing authored +3 mm. No height change is used to hide the defect.
    for (let i = 0; i < surface.positions.length; i += 3) {
      const x = surface.positions[i] + cell.x * 256;
      const y = surface.positions[i + 1];
      const z = surface.positions[i + 2] + cell.z * 256;
      assert(Math.abs(x / 8 - Math.round(x / 8)) < 0.000001);
      assert(Math.abs(z / 8 - Math.round(z / 8)) < 0.000001);
      assert(Math.abs(y * 1000 - 3 - surfaceMm(x, z)) < 0.1);
    }
    for (let i = 0; i < surface.indices.length; i += 3) {
      const points = Array.from(surface.indices.slice(i, i + 3), (index) => [
        surface.positions[index * 3],
        surface.positions[index * 3 + 2],
      ]);
      const x = Math.min(...points.map((p) => p[0])),
        z = Math.min(...points.map((p) => p[1]));
      const key = (a) =>
        a
          .map((p) => p.join(","))
          .sort()
          .join(";");
      assert(
        [
          key([
            [x, z],
            [x, z + 8],
            [x + 8, z],
          ]),
          key([
            [x + 8, z],
            [x, z + 8],
            [x + 8, z + 8],
          ]),
        ].includes(key(points)),
        "Overlay uses the same diagonal as the canonical terrain",
      );
    }
    for (const changed of [
      { ...surface, collision: "solid" },
      { ...surface, alphaMode: "MASK" },
      { ...surface, doubleSided: false },
      { ...surface, colors: new Float32Array([1, 1, 1, 1]) },
      { ...surface, texture: { ...surface.texture, rgbaBase64: "AAAA/w==" } },
      { ...surface, color: [0.1, 0.35, 0.4] }, // Separate reservoir plane.
    ]) {
      assert.equal(sceneryMaterialStyle("alpine-overlays", changed), "plain");
      selectiveCases++;
    }
  }
}
assert.equal(overlayTriangles, 125278);
assert.equal(kinds.size, 4);
assert(unchangedSurfaces > 0);
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const parsed = new URL(url);
  assert.equal(parsed.origin, "https://alpine-overlay.invalid");
  assert(!parsed.pathname.includes(".."));
  return new Response(await file(parsed.pathname.slice(1)));
};
const cases = [],
  baseline = new Map();
for (const style of ["plain", "alpine-overlays"]) {
  for (const quality of style === "plain"
    ? ["balanced"]
    : ["performance", "balanced", "quality"]) {
    const owner = createVerifiedMixedWindow(terrain, {
      source: { baseURL: "https://alpine-overlay.invalid/terrain/", fetchImpl },
      scenery: {
        manifest: scenery,
        source: {
          baseURL: "https://alpine-overlay.invalid/scenery/",
          fetchImpl,
          surfaceStyle: style,
          surfaceQuality: quality,
        },
      },
      maxGeometryBytes: 8 * 1024 * 1024,
    });
    try {
      for (const spawn of terrain.spawns) {
        await owner.transition(spawn.position);
        assert.equal(owner.snapshot().state, "ready");
        const hash = createHash("sha256");
        let biased = 0,
          ordinary = 0;
        owner.group.traverse((object) => {
          if (!object.isMesh) return;
          for (const key of ["position", "normal", "uv", "color"]) {
            const attr = object.geometry.attributes[key];
            if (attr)
              hash.update(
                new Uint8Array(
                  attr.array.buffer,
                  attr.array.byteOffset,
                  attr.array.byteLength,
                ),
              );
          }
          const ix = object.geometry.index;
          if (ix)
            hash.update(
              new Uint8Array(
                ix.array.buffer,
                ix.array.byteOffset,
                ix.array.byteLength,
              ),
            );
          const m = object.material;
          assert.equal(m.depthTest, true);
          assert.equal(m.depthWrite, true);
          assert.equal(object.renderOrder, 0);
          if (m.polygonOffset) {
            assert.equal(style, "alpine-overlays");
            assert.equal(m.name, "Alpine terrain overlay");
            assert.equal(m.polygonOffsetFactor, -1);
            assert.equal(m.polygonOffsetUnits, -1);
            biased++;
          } else ordinary++;
        });
        const s = owner.snapshot();
        const p = spawn.position;
        const queries = {
          support: owner.support(p, 20000),
          sweep: owner.sweep(p, { ...p, y: p.y + 1000 }, 250),
        };
        const parity = {
          geometry: hash.digest("hex"),
          queries,
          geometryBytes: s.geometryBytes,
          textureBytes: s.textureBytes,
          resourceBytes: s.resourceBytes,
        };
        if (style === "plain") baseline.set(spawn.id, parity);
        else assert.deepEqual(parity, baseline.get(spawn.id));
        assert(ordinary > 0);
        cases.push({
          spawn: spawn.id,
          style,
          quality,
          biased,
          ordinary,
          geometrySHA256: parity.geometry,
          resourceBytes: s.resourceBytes,
        });
      }
    } finally {
      await owner.dispose();
      assert.equal(owner.group, null);
      for (const key of [
        "geometryBytes",
        "textureBytes",
        "sourceBytes",
        "reservedSourceBytes",
        "reservedGeometryBytes",
      ])
        assert.equal(owner.snapshot()[key], 0, key);
    }
  }
}
assert(cases.some((c) => c.biased > 0));
console.log(
  JSON.stringify(
    {
      passed: true,
      overlayTriangles,
      kinds: [...kinds],
      unchangedSurfaces,
      selectiveCases,
      cases,
      sourceBytesUnchanged: true,
      disposalZero: true,
      nativeAppearanceAccepted: false,
    },
    null,
    2,
  ),
);
