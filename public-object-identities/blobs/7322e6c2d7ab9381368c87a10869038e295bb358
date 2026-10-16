/** Actual camera math and immutable Coaster vertices; not a GPU timing/visual claim. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import * as THREE from "../../../optional-practice/civilian-fpv/vendor/three.module.js";

const source = await readFile(
  new URL(
    "../../../optional-practice/civilian-fpv/renderer.mjs",
    import.meta.url,
  ),
  "utf8",
);
const baseline = process.argv[3]
  ? await readFile(process.argv[3], "utf8")
  : execFileSync("git", [
      "show",
      "310b5091:optional-practice/civilian-fpv/renderer.mjs",
    ]).toString();
const factory = (text) =>
  runInNewContext(
    text
      .slice(
        text.indexOf("export function createFlightViewFrame"),
        text.indexOf("/** Presentation only. All world/actor"),
      )
      .replace("export function", "function") + "\ncreateFlightViewFrame",
    { THREE },
  );
const currentFactory = factory(source),
  oldFactory = factory(baseline);
const make = (create, aspect, far) => {
  const camera = new THREE.PerspectiveCamera(82, aspect, 0.035, far);
  const aircraft = new THREE.Group();
  return { camera, aircraft, frame: create({ camera, aircraft }) };
};
const pose = {
  position: { x: 0, y: 11000, z: 0 },
  orientation: [0, 0, 0, 1000000],
  ticks: 0,
};
const stamp = ({ camera, aircraft }) => ({
  position: camera.position.toArray(),
  orientation: camera.quaternion.toArray(),
  projection: camera.projectionMatrix.toArray(),
  near: camera.near,
  far: camera.far,
  aircraft: aircraft.position.toArray(),
  visible: aircraft.visible,
});
let exactFlightComparisons = 0,
  boundedViews = 0,
  visibleBoundaryPoints = 0;
const aspects = [390 / 844, 844 / 390, 1280 / 800, 16 / 9];
for (const cell of [128, 256, 512])
  for (const shape of [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ])
    for (const aspect of aspects)
      for (const offset of [0, -8192000, 8192000]) {
        const bounds = {
          min: { x: offset, y: 0, z: offset },
          max: {
            x: offset + shape[0] * cell * 1000,
            y: 1000000,
            z: offset + shape[1] * cell * 1000,
          },
        };
        const a = make(oldFactory, aspect, (cell * 1000) / 128),
          b = make(currentFactory, aspect, (cell * 1000) / 128);
        for (const row of [a, b]) {
          row.frame.bounds = bounds;
          row.frame.originMm = { x: offset, y: 128000, z: offset };
        }
        // Ordinary hosts retain every view's exact historical projection and pose.
        for (const view of ["fpv", "chase", "overview", "editor"]) {
          a.frame.view = b.frame.view = view;
          a.frame.draw(pose);
          b.frame.draw(pose);
          assert.deepEqual(stamp(b), stamp(a));
          exactFlightComparisons++;
        }
        b.frame.regionalOverview = true;
        b.frame.view = "overview";
        b.frame.draw(pose);
        b.camera.updateMatrixWorld();
        assert(b.camera.near > 0.035 && b.camera.near <= 10);
        // Include high, low and close side faces. Only points within the view cone
        // require a near-plane visibility assertion; off-screen points are not clipped UI.
        for (let ix = 0; ix <= 4; ix++)
          for (let iz = 0; iz <= 4; iz++)
            for (const y of [-200, 0, 8, 100, 250, 500, 1000, 2000]) {
              const point = new THREE.Vector3(
                (shape[0] * cell * ix) / 4,
                y - 128,
                (shape[1] * cell * iz) / 4,
              );
              const viewDepth = -point
                .clone()
                .applyMatrix4(b.camera.matrixWorldInverse).z;
              const projected = point.project(b.camera);
              if (
                viewDepth > 0 &&
                Math.abs(projected.x) <= 1 &&
                Math.abs(projected.y) <= 1
              ) {
                assert(
                  viewDepth > b.camera.near * 3.99,
                  "Visible resident prism has a fourfold near margin",
                );
                assert(projected.z > -1);
                visibleBoundaryPoints++;
              }
            }
        boundedViews++;
        // Camera cycling, aspect changes and return to an ordinary host restore 35mm exactly.
        for (const aspect2 of [aspect, 390 / 844, 844 / 390]) {
          a.camera.aspect = b.camera.aspect = aspect2;
          a.camera.updateProjectionMatrix();
          b.camera.updateProjectionMatrix();
          for (const view of ["fpv", "chase", "editor"]) {
            a.frame.view = b.frame.view = view;
            a.frame.draw(pose);
            b.frame.draw(pose);
            assert.deepEqual(stamp(b), stamp(a));
            exactFlightComparisons++;
          }
        }
        b.frame.regionalOverview = false;
        a.frame.view = b.frame.view = "overview";
        a.frame.draw(pose);
        b.frame.draw(pose);
        assert.deepEqual(stamp(b), stamp(a));
        exactFlightComparisons++;
      }

assert(
  process.argv[2],
  "Provide the preserved Coaster supported-r5 source tree",
);
const root = resolve(process.argv[2]);
const manifestBytes = await readFile(resolve(root, "scenery/region.json"));
const manifest = JSON.parse(manifestBytes);
assert.equal(manifest.id, "coaster-gardens-study");
assert.equal(manifest.revision, "composition-r2");
const cells = [];
for (const asset of manifest.assets.filter(
  (asset) => asset.kind === "collision",
)) {
  const bytes = await readFile(resolve(root, "scenery", asset.path));
  assert.equal(bytes.length, asset.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256);
  const parsed = JSON.parse(bytes);
  cells.push(parsed.cell ?? parsed);
}
let inspectedVertices = 0,
  visibleSourceVertices = 0;
const separation = [];
for (const spawn of manifest.spawns)
  for (const aspect of aspects) {
    const cellSize = manifest.grid.cellSizeMm;
    const x = Math.floor(spawn.position.x / cellSize),
      z = Math.floor(spawn.position.z / cellSize);
    const bounds = {
      min: {
        x: Math.max(0, x - 1) * cellSize,
        y: 0,
        z: Math.max(0, z - 1) * cellSize,
      },
      max: {
        x: Math.min(8, x + 2) * cellSize,
        y: 450000,
        z: Math.min(8, z + 2) * cellSize,
      },
    };
    const a = make(oldFactory, aspect, 2000),
      b = make(currentFactory, aspect, 2000);
    for (const row of [a, b]) {
      row.frame.bounds = bounds;
      row.frame.view = "overview";
      row.frame.originMm = { x: x * cellSize, y: 0, z: z * cellSize };
    }
    b.frame.regionalOverview = true;
    a.frame.draw(pose);
    b.frame.draw(pose);
    a.camera.updateMatrixWorld();
    b.camera.updateMatrixWorld();
    for (const cell of cells.filter(
      (c) => Math.abs(c.x - x) <= 1 && Math.abs(c.z - z) <= 1,
    ))
      for (const surface of cell.surfaces)
        for (let i = 0; i < surface.positionsMm.length; i += 3) {
          const p = new THREE.Vector3(
            (surface.positionsMm[i] + (cell.x - x) * cellSize) / 1000,
            surface.positionsMm[i + 1] / 1000,
            (surface.positionsMm[i + 2] + (cell.z - z) * cellSize) / 1000,
          );
          const projected = p.clone().project(b.camera);
          inspectedVertices++;
          if (Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1) {
            assert(
              projected.z > -1 && projected.z < 1,
              "Actual resident geometry remains inside depth range",
            );
            visibleSourceVertices++;
          }
        }
    const gaps = [a, b].map(({ camera }) => {
      const ground = new THREE.Vector3(
        (spawn.position.x - x * cellSize) / 1000,
        8,
        (spawn.position.z - z * cellSize) / 1000,
      );
      const paving = ground.clone();
      paving.y += 0.08;
      return (
        (Math.abs(paving.project(camera).z - ground.project(camera).z) / 2) *
        (2 ** 24 - 1)
      );
    });
    assert(
      gaps[1] > 4 && gaps[1] > gaps[0] * 100,
      "80mm plaza depth separation improves at least 100x",
    );
    separation.push({
      spawn: spawn.id,
      aspect,
      near: b.camera.near,
      estimated24BitDepthStepsBefore: gaps[0],
      estimated24BitDepthStepsAfter: gaps[1],
    });
  }
console.log(
  JSON.stringify(
    {
      passed: true,
      scope:
        "CPU camera projections and source vertices; no GPU/rendered-art acceptance",
      baselineSHA256: createHash("sha256").update(baseline).digest("hex"),
      rendererSHA256: createHash("sha256").update(source).digest("hex"),
      exactFlightComparisons,
      boundedViews,
      visibleBoundaryPoints,
      inspectedVertices,
      visibleSourceVertices,
      sceneryManifestSHA256: createHash("sha256")
        .update(manifestBytes)
        .digest("hex"),
      separation,
    },
    null,
    2,
  ),
);
