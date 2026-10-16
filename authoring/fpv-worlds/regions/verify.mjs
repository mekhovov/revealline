/** Manual authoring verification; synthetic metadata, not a flight/FPS qualification. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REGION_FORMAT,
  REGION_LIMITS,
  validateRegionManifest,
  createRegionPlanner,
  regionToLocal,
  regionToGlobal,
} from "./region-manifest.mjs";
import { inspectRegion } from "./inspect-region.mjs";

const scene = Buffer.from("synthetic scene bytes; not a GLB"),
  collision = Buffer.from("{}");
const asset = (id, kind, path, bytes) => ({
  id,
  kind,
  path,
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
});
const fixture = {
  format: REGION_FORMAT,
  id: "regional-fixture",
  revision: "r1",
  title: { en: "Metadata fixture", uk: "Макет метаданих" },
  grid: {
    cellSizeMm: 128000,
    minX: -64,
    minZ: -64,
    width: 128,
    depth: 128,
    floorMm: -10000,
    ceilingMm: 2000000,
  },
  assets: [
    asset("scene", "scene", "shared/scene.glb", scene),
    asset("collision", "collision", "shared/collision.json", collision),
  ],
  chunks: [],
  spawns: [{ id: "start", position: { x: 0, y: 1000, z: 0 } }],
};
for (let z = -64; z < 64; z++)
  for (let x = -64; x < 64; x++)
    fixture.chunks.push({
      id: `cell-${x + 64}-${z + 64}`,
      x,
      z,
      assets: ["scene", "collision"],
    });
let checks = 0;
const check = (label, fn) => {
  fn();
  checks++;
  console.log(`PASS ${label}`);
};
const rejected = (modify, expected) => {
  const candidate = structuredClone(fixture);
  modify(candidate);
  assert.throws(() => validateRegionManifest(candidate), expected);
};
const admitted = validateRegionManifest(fixture),
  planner = createRegionPlanner(admitted);
check("maximum rectangular metadata grid admitted and detached", () => {
  assert.equal(admitted.chunks.length, 16384);
  assert(Object.isFrozen(admitted.chunks[0]));
  assert.notEqual(admitted.chunks, fixture.chunks);
});
check("full grid coverage required", () =>
  rejected((x) => x.chunks.pop(), /every cell/),
);
check("duplicate coordinates rejected", () =>
  rejected((x) => {
    x.chunks[1].x = x.chunks[0].x;
  }, /Duplicate cell/),
);
check("unresolved collision rejected", () =>
  rejected((x) => {
    x.chunks[0].assets = ["scene"];
  }, /chunk assets/),
);
check("remote/path traversal resources rejected", () =>
  rejected((x) => {
    x.assets[0].path = "../remote.glb";
  }, /local asset path/),
);
check("asset integrity metadata required", () =>
  rejected((x) => {
    x.assets[0].sha256 = "not-a-hash";
  }, /SHA/),
);
check("legacy format not silently accepted", () =>
  rejected((x) => {
    x.format = "World.v1";
  }, /identity/),
);
check("out-of-bounds spawn rejected", () =>
  rejected((x) => {
    x.spawns[0].position.x = 9000000;
  }, /outside region/),
);
check(
  "finite runtime positions retain fractions; authored positions remain integer",
  () => {
    assert.equal(planner({ x: 0.5, y: 0, z: 0 }).blocked, null);
    assert.throws(() => planner({ x: NaN, y: 0, z: 0 }), /finite/);
    rejected((x) => {
      x.spawns[0].position.x = 0.5;
    }, /integer/);
  },
);
check("source budget failure cannot present a loadable plan", () => {
  const plan = planner(fixture.spawns[0].position, { maxSourceBytes: 1 });
  assert.equal(plan.blocked, "required-source-budget");
  assert.equal(plan.acquireChunks.length, 0);
});
check("shared asset bytes counted once", () => {
  const plan = planner(fixture.spawns[0].position);
  assert.equal(plan.sourceBytes, scene.length + collision.length);
  assert.equal(plan.acquireAssets.length, 2);
  assert.equal(plan.requiredChunks.length, 9);
  assert.equal(plan.targetChunks.length, 25);
});
check(
  "outer edge belongs to final cell and preserves exact coordinate translation",
  () => {
    for (const point of [
      { x: 8192000, y: 2000000, z: 8192000 },
      { x: -8192000, y: -10000, z: -8192000 },
      { x: -1, y: 0, z: -1 },
    ]) {
      const plan = planner(point);
      assert.equal(plan.blocked, null);
      assert.deepEqual(
        regionToGlobal(regionToLocal(point, plan.origin), plan.origin),
        point,
      );
      assert(plan.targetChunks.length <= 25);
    }
  },
);
check("outside position never clamps silently", () =>
  assert.throws(() => planner({ x: 8192001, y: 0, z: 0 }), /outside/),
);
check("reordered metadata gives identical deterministic plans", () => {
  const shuffled = structuredClone(fixture);
  shuffled.chunks.reverse();
  shuffled.assets.reverse();
  assert.deepEqual(
    createRegionPlanner(shuffled)({ x: -1, y: 0, z: -1 }),
    planner({ x: -1, y: 0, z: -1 }),
  );
});
check(
  "prefetch is bounded by bytes without removing mandatory neighbours",
  () => {
    const candidate = structuredClone(fixture);
    candidate.assets.push(
      asset("extra", "texture", "extra.png", Buffer.alloc(100)),
    );
    candidate.chunks
      .find((chunk) => chunk.x === 2 && chunk.z === 0)
      .assets.push("extra");
    const limitedPlanner = createRegionPlanner(candidate),
      point = { x: 0, y: 1000, z: 0 };
    const full = limitedPlanner(point),
      limited = limitedPlanner(point, {
        maxSourceBytes: scene.length + collision.length,
      });
    assert.equal(limited.blocked, null);
    assert.equal(limited.requiredChunks.length, 9);
    assert.equal(limited.targetChunks.length, 24);
    assert(!limited.acquireAssets.includes("extra"));
    const shifted = limitedPlanner(
      { x: -640000, y: 1000, z: 0 },
      { resident: full.targetChunks },
    );
    assert.deepEqual(shifted.releaseAssets, ["extra"]);
    assert.equal(shifted.acquireAssets.length, 0);
  },
);
check("duplicate and excessive resident declarations rejected", () => {
  assert.throws(
    () =>
      planner(fixture.spawns[0].position, {
        resident: ["cell-0-0", "cell-0-0"],
      }),
    /resident/,
  );
  assert.throws(
    () =>
      planner(fixture.spawns[0].position, {
        resident: fixture.chunks.slice(0, 26).map((chunk) => chunk.id),
      }),
    /resident/,
  );
});
check(
  "7200 position samples retain bounded plan size and release stale cells",
  () => {
    let resident = [];
    for (let n = 0; n < 7200; n++) {
      const point = {
        x: ((n * 97001) % 16384000) - 8192000,
        y: 1000,
        z: ((n * 73001) % 16384000) - 8192000,
      };
      const plan = planner(point, { resident });
      const next = [
        ...resident.filter((id) => !plan.releaseChunks.includes(id)),
        ...plan.acquireChunks,
      ];
      assert.deepEqual(new Set(next), new Set(plan.targetChunks));
      assert(next.length <= REGION_LIMITS.residentChunks);
      assert.deepEqual(
        regionToGlobal(regionToLocal(point, plan.origin), plan.origin),
        point,
      );
      resident = next;
    }
  },
);

const directory = await mkdtemp(join(tmpdir(), "fpv-region-verify-"));
try {
  const root = join(directory, "assets");
  await mkdir(join(root, "shared"), { recursive: true });
  const manifestPath = join(directory, "region.json");
  await writeFile(manifestPath, JSON.stringify(fixture));
  await writeFile(join(root, "shared/scene.glb"), scene);
  await writeFile(join(root, "shared/collision.json"), collision);
  const report = await inspectRegion(manifestPath, root);
  check("disk bytes verified separately from player admission", () => {
    assert.equal(report.assetsVerified, true);
    assert.equal(report.playerAdmitted, false);
  });
  await writeFile(join(root, "shared/scene.glb"), Buffer.alloc(scene.length));
  await assert.rejects(inspectRegion(manifestPath, root), /hash mismatch/);
  checks++;
  console.log("PASS corrupted bytes rejected");
  await rm(join(root, "shared/scene.glb"));
  await writeFile(join(directory, "outside.glb"), scene);
  await symlink(join(directory, "outside.glb"), join(root, "shared/scene.glb"));
  await assert.rejects(
    inspectRegion(manifestPath, root),
    /escapes content root/,
  );
  checks++;
  console.log("PASS symlink escape rejected");
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log(
  JSON.stringify({
    checks,
    result: "pass",
    positionSamples: 7200,
    maximumMetadataCells: 16384,
    simulatedFlight: false,
    fpsMeasured: false,
  }),
);
