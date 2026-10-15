/** New immutable, original material-only revision of the pinned contour source. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { validateRegionManifest } from "../region-manifest.mjs";
import {
  compileScenerySource,
  validateScenerySource,
  scenerySourceResources,
} from "../indexed-scenery-cell.mjs";
import { TERRAIN_GEOMETRY_BYTES_PER_CELL } from "../verified-terrain-window.mjs";
import { detailStationCell } from "./station-materials.mjs";
const [base, output] = process.argv.slice(2).map((p) => resolve(p));
assert(base && output, "Provide exact contour source and a new output folder");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const json = (v) => Buffer.from(JSON.stringify(v) + "\n");
const expected = {
  terrain: "c1218b914e01346414dd160e2535fdd115a057a18b511a29577526675b6a90b0",
  scenery: "73d63d56158b300b006bcd3e1750477ba23304af51665cda7080aec891ed5a61",
};
const manifests = {},
  cells = new Map(),
  edits = [];
let sourceBytes = 0;
await mkdir(output, { recursive: false });
for (const layer of ["terrain", "scenery"]) {
  const bytes = await readFile(resolve(base, layer, "region.json"));
  assert.equal(sha(bytes), expected[layer], "Exact reviewed source required");
  const manifest = structuredClone(validateRegionManifest(bytes.toString()));
  const replacements = new Map();
  if (layer === "scenery") {
    for (const asset of manifest.assets.filter((a) => a.kind === "collision")) {
      const raw = await readFile(resolve(base, layer, asset.path));
      assert.equal(sha(raw), asset.sha256);
      const original = validateScenerySource(JSON.parse(raw));
      const detailed = detailStationCell(original);
      const source = validateScenerySource(detailed.source);
      cells.set(`${source.cell.x},${source.cell.z}`, source);
      if (detailed.changedTriangles) {
        replacements.set(asset.path, json(source));
        replacements.set(
          `${source.cell.chunkId}.glb`,
          Buffer.from(compileScenerySource(source).glb),
        );
        edits.push({
          chunkId: source.cell.chunkId,
          changedTriangles: detailed.changedTriangles,
          textures: source.textures.map((t) => ({
            id: t.id,
            width: t.width,
            height: t.height,
            sha256: sha(Buffer.from(t.rgbaBase64, "base64")),
          })),
        });
      }
    }
  }
  await mkdir(resolve(output, layer));
  for (const asset of manifest.assets) {
    const replacement = replacements.get(asset.path);
    if (replacement) {
      await writeFile(resolve(output, layer, asset.path), replacement);
      asset.bytes = replacement.length;
      asset.sha256 = sha(replacement);
    } else {
      const original = await readFile(resolve(base, layer, asset.path));
      assert.equal(original.length, asset.bytes);
      assert.equal(sha(original), asset.sha256);
      await copyFile(
        resolve(base, layer, asset.path),
        resolve(output, layer, asset.path),
      );
    }
    sourceBytes += asset.bytes;
  }
  manifest.revision = "relief-r3-station-materials";
  validateRegionManifest(manifest);
  const body = json(manifest);
  sourceBytes += body.length;
  await writeFile(resolve(output, layer, "region.json"), body);
  manifests[layer] = manifest;
}
assert(
  edits.length > 0 && edits.length <= 4,
  "Only bounded station cells may change",
);
let maxNineCellResourceBytes = 0;
for (let z = 0; z < 16; z++)
  for (let x = 0; x < 16; x++) {
    const sources = [];
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const cell = cells.get(`${x + dx},${z + dz}`);
        if (cell) sources.push(cell);
      }
    maxNineCellResourceBytes = Math.max(
      maxNineCellResourceBytes,
      scenerySourceResources(sources).resourceBytes +
        9 * TERRAIN_GEOMETRY_BYTES_PER_CELL,
    );
  }
assert(maxNineCellResourceBytes * 2 <= 8 * 1024 * 1024);
assert(sourceBytes <= 64 * 1024 * 1024);
const receipt = {
  format: "FPVAlpineStationMaterials.v1",
  revision: manifests.terrain.revision,
  previousManifestSHA256: expected,
  sourceBytes,
  edits,
  manifestSHA256: Object.fromEntries(
    Object.entries(manifests).map(([k, v]) => [k, sha(json(v))]),
  ),
  maxNineCellResourceBytes,
  maxRetainedCandidateResourceBytes: maxNineCellResourceBytes * 2,
  materialScaleMetres: {
    wallTile: [8, 14],
    timberBoardWidth: 0.25,
    masonryCourse: 0.35,
    roofTile: [8, 4],
    roofSeamSpacing: 0.5,
  },
  unchanged: [
    "Every terrain asset byte",
    "All oriented solid/visual triangle positions",
    "All spawn positions",
    "All route/collision clearance",
  ],
  nativeAccepted: false,
  playerReady: false,
};
await writeFile(
  resolve(output, "station-materials.json"),
  JSON.stringify(receipt, null, 2) + "\n",
);
await writeFile(
  resolve(output, "provenance.json"),
  json({
    author: "RevealLine contributors",
    license: "CC0-1.0",
    source:
      "Original deterministic pixel artwork for timber boards, masonry, opaque backed panels and roof seams. No external imagery or simulator assets. All panels remain OPAQUE and sit on existing solid walls; they are not fly-through openings.",
    parentManifestSHA256: expected,
  }),
);
console.log(JSON.stringify(receipt, null, 2));
