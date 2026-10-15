/** Manual authoring scenarios with the shipped Three and Rapier. Not player/FPS acceptance. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  compileTerrainCell,
  validateTerrainCell,
  validateTerrainSeams,
  TERRAIN_FORMAT,
} from "./terrain-cell.mjs";
import { prepareTerrainWindow } from "./terrain-admission.mjs";

const makeCell = (x, z, height = () => 0) => ({
  format: TERRAIN_FORMAT,
  chunkId: `cell-${x + 2}-${z + 2}`,
  x,
  z,
  cellSizeMm: 128000,
  samples: 33,
  heightsMm: Array.from({ length: 1089 }, (_, i) =>
    height(
      x * 128000 + (i % 33) * 4000,
      z * 128000 + Math.floor(i / 33) * 4000,
    ),
  ),
});
const cells = [
  makeCell(-1, -1),
  makeCell(0, -1),
  makeCell(-1, 0),
  makeCell(0, 0),
];
const manifestFor = (terrain) => {
  const assets = [],
    chunks = [];
  for (const cell of terrain) {
    const built = compileTerrainCell(cell),
      collision = new TextEncoder().encode(JSON.stringify(cell));
    const add = (kind, bytes, extension) => {
      const id = `${cell.chunkId}-${kind}`;
      assets.push({
        id,
        kind,
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        path: `${id}.${extension}`,
      });
      return id;
    };
    chunks.push({
      id: cell.chunkId,
      x: cell.x,
      z: cell.z,
      assets: [
        add("scene", built.glb, "glb"),
        add("collision", collision, "json"),
      ],
    });
  }
  const minX = Math.min(...terrain.map((c) => c.x)),
    minZ = Math.min(...terrain.map((c) => c.z));
  return {
    format: "FPVRegionManifest.v1",
    id: "terrain-fixture",
    revision: "r1",
    title: { en: "Terrain fixture", uk: "Макет рельєфу" },
    grid: {
      cellSizeMm: 128000,
      minX,
      minZ,
      width: Math.max(...terrain.map((c) => c.x)) - minX + 1,
      depth: Math.max(...terrain.map((c) => c.z)) - minZ + 1,
      floorMm: -10000,
      ceilingMm: 100000,
    },
    assets,
    chunks,
    spawns: [
      {
        id: "start",
        position: {
          x: minX * 128000 + 64000,
          y: 1000,
          z: minZ * 128000 + 64000,
        },
      },
    ],
  };
};
const manifest = manifestFor(cells),
  requiredChunkIds = cells.map((c) => c.chunkId);
let checks = 0;
async function check(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}
await check("bounded detached terrain payload", () => {
  const value = validateTerrainCell(cells[0]);
  assert(Object.isFrozen(value.heightsMm));
  assert.notEqual(value.heightsMm, cells[0].heightsMm);
  for (const mutate of [
    (c) => c.heightsMm.pop(),
    (c) => (c.heightsMm[0] = 0.5),
    (c) => (c.heightsMm[0] = 2000001),
    (c) => (c.samples = 65),
    (c) => (c.cellSizeMm = 192000),
    (c) => (c.extra = true),
    (c) => (c.chunkId = "bad/id"),
  ]) {
    const bad = structuredClone(cells[0]);
    mutate(bad);
    assert.throws(() => validateTerrainCell(bad));
  }
});
await check("exact X/Z/corner seams and duplicate rejection", () => {
  assert.equal(validateTerrainSeams(cells).length, 4);
  for (const i of [0, 32, 1056]) {
    const bad = structuredClone(cells);
    bad[3].heightsMm[i]++;
    assert.throws(() => validateTerrainSeams(bad), /seam/);
  }
  assert.throws(() => validateTerrainSeams([cells[0], cells[0]]), /Duplicate/);
});
await check(
  "deterministic GLB uses collision vertices and upward triangles",
  () => {
    const built = compileTerrainCell(cells[0]),
      dv = new DataView(built.glb.buffer);
    assert.equal(dv.getUint32(0, true), 0x46546c67);
    assert.equal(dv.getUint32(4, true), 2);
    assert.equal(dv.getUint32(8, true), built.glb.length);
    const jsonLength = dv.getUint32(12, true),
      json = JSON.parse(
        new TextDecoder().decode(built.glb.slice(20, 20 + jsonLength)),
      );
    assert.equal(json.accessors[0].count, 1089);
    assert.equal(json.accessors[1].count, 6144);
    const binaryStart = 28 + jsonLength;
    built.positions.forEach((n, i) =>
      assert.equal(dv.getFloat32(binaryStart + i * 4, true), n),
    );
    built.indices.forEach((n, i) =>
      assert.equal(
        dv.getUint32(binaryStart + built.positions.byteLength + i * 4, true),
        n,
      ),
    );
    assert.deepEqual(compileTerrainCell(cells[0]).glb, built.glb);
    for (let i = 0; i < built.indices.length; i += 3) {
      const [a, b, c] = built.indices.slice(i, i + 3).map((n) => n * 3),
        p = built.positions;
      assert(
        (p[b + 2] - p[a + 2]) * (p[c] - p[a]) -
          (p[b] - p[a]) * (p[c + 2] - p[a + 2]) >
          0,
      );
    }
  },
);
await check(
  "missing required cells and invalid manifest binding fail before admission",
  async () => {
    await assert.rejects(
      prepareTerrainWindow(manifest, cells.slice(1), { requiredChunkIds }),
      /Required terrain missing/,
    );
    const wrong = structuredClone(cells);
    wrong[0].chunkId = "absent";
    await assert.rejects(
      prepareTerrainWindow(manifest, wrong, { requiredChunkIds }),
      /manifest/,
    );
    await assert.rejects(
      prepareTerrainWindow(manifest, cells, {
        requiredChunkIds,
        maxGeometryBytes: 1,
      }),
      /budget/,
    );
    await assert.rejects(
      prepareTerrainWindow(manifest, cells, {
        requiredChunkIds,
        originMm: { x: 9999999, y: 0, z: 0 },
      }),
      /nearby origin/,
    );
  },
);
await check(
  "origin ownership and manifest vertical range remain enforced",
  async () => {
    const originMm = { x: 0, y: 0, z: 0 };
    const prepared = await prepareTerrainWindow(manifest, cells, {
      requiredChunkIds,
      originMm,
    });
    try {
      originMm.y = 100000;
      assert(
        Math.abs(prepared.support({ x: 1000, y: 2000, z: 1000 }).heightMm) <
          0.1,
      );
    } finally {
      prepared.dispose();
    }
    const high = cells.map((cell) => ({
      ...cell,
      heightsMm: cell.heightsMm.map(() => 150000),
    }));
    await assert.rejects(
      prepareTerrainWindow(manifest, high, { requiredChunkIds }),
      /vertical bounds/,
    );
  },
);
const window = await prepareTerrainWindow(manifest, cells, {
  requiredChunkIds,
});
try {
  await check(
    "detached render geometry and isolated Rapier support match",
    () => {
      assert.equal(window.group.parent, null);
      assert.equal(window.group.children.length, 4);
      assert.equal(window.snapshot().flightReady, false);
      for (const x of [-127000, -4000, 0, 4000, 127000])
        for (const z of [-127000, -4000, 0, 4000, 127000]) {
          const hit = window.support({ x, y: 1500, z });
          assert.equal(hit.status, "terrain-hit");
          assert(Math.abs(hit.heightMm) < 0.1);
          assert(hit.normal.y > 0.999);
        }
    },
  );
  await check(
    "sphere sweep detects high-speed terrain contact and clear travel",
    () => {
      const hit = window.sweep(
        { x: -60000, y: 50000, z: 30000 },
        { x: 60000, y: -50000, z: 30000 },
      );
      assert.equal(hit.status, "terrain-hit");
      assert(hit.fraction > 0.49 && hit.fraction < 0.51);
      assert.equal(
        window.sweep(
          { x: -60000, y: 2000, z: 30000 },
          { x: 60000, y: 2000, z: 30000 },
        ).status,
        "terrain-clear",
      );
    },
  );
  await check(
    "missing terrain and boundary-straddling shapes never report clear",
    () => {
      assert.equal(
        window.support({ x: 200000, y: 1000, z: 0 }).status,
        "unknown-cell",
      );
      assert.equal(
        window.sweep(
          { x: 127900, y: 2000, z: 1000 },
          { x: 127900, y: 2000, z: 2000 },
        ).status,
        "unknown-cell",
      );
      assert.equal(
        window.sweep(
          { x: 0, y: 2000, z: 1000 },
          { x: 200000, y: 2000, z: 2000 },
        ).status,
        "unknown-cell",
      );
    },
  );
} finally {
  window.dispose();
}
await check(
  "idempotent disposal releases visible nodes and rejects stale queries",
  () => {
    window.dispose();
    assert.equal(window.group.children.length, 0);
    assert.equal(window.snapshot().geometryBytes, 0);
    assert.throws(() => window.support({ x: 0, y: 1000, z: 0 }), /disposed/);
  },
);
await check(
  "sloped terrain supports preserve global height after local translation",
  async () => {
    const slope = [makeCell(10, 20, (x) => (x - 1280000) / 4)],
      manifest = manifestFor(slope);
    const prepared = await prepareTerrainWindow(manifest, slope, {
      requiredChunkIds: [slope[0].chunkId],
      originMm: { x: 1280000, y: 10000, z: 2560000 },
    });
    try {
      const hit = prepared.support({ x: 1344000, y: 20000, z: 2624000 });
      assert.equal(hit.status, "terrain-hit");
      assert(Math.abs(hit.heightMm - 16000) < 0.1);
      assert(hit.normal.y > 0.96 && hit.normal.y < 0.98);
    } finally {
      prepared.dispose();
    }
  },
);
await check(
  "repeated construction/disposal keeps resource counters bounded",
  async () => {
    for (let i = 0; i < 25; i++) {
      const prepared = await prepareTerrainWindow(manifest, cells, {
        requiredChunkIds,
      });
      assert.equal(prepared.snapshot().cells, 4);
      prepared.dispose();
      assert.equal(prepared.snapshot().cells, 0);
    }
  },
);
console.log(
  JSON.stringify({
    checks,
    passed: true,
    flightReady: false,
    runtime: process.version,
    limitations:
      "Authoring terrain queries only; no player streaming, scenery collision, GPU residency, FPS or safe-spawn qualification.",
  }),
);
