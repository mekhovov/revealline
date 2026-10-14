/** Real source/geometry/query/flight composition checks. No mocked collision or physics. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Group } from "../../../optional-practice/civilian-fpv/vendor/three.module.js";
import { compileTerrainCell, TERRAIN_FORMAT } from "./terrain-cell.mjs";
import { compileSceneryCell, SCENERY_FORMAT } from "./scenery-cell.mjs";
import { createVerifiedMixedWindow } from "./verified-mixed-window.mjs";
import { createRegionalFlightPrototype } from "./flight-prototype.mjs";
const point = (x) => ({ x: x * 128000 + 64000, y: 10000, z: 6000 });
function fixture() {
  const layers = {};
  for (const kind of ["terrain", "scenery"]) {
    const assets = [],
      chunks = [],
      bodies = new Map();
    let requests = 0,
      intercept = null;
    for (let x = 0; x < 6; x++) {
      const base = { chunkId: `tile-${x}`, x, z: 0, cellSizeMm: 128000 };
      const cell =
        kind === "terrain"
          ? {
              format: TERRAIN_FORMAT,
              ...base,
              samples: 33,
              heightsMm: Array(1089).fill(0),
            }
          : {
              format: SCENERY_FORMAT,
              ...base,
              surfaces: [
                {
                  id: "roof",
                  positionsMm: [
                    30000, 8000, 30000, 90000, 8000, 30000, 30000, 8000, 90000,
                    90000, 8000, 90000,
                  ],
                  indices: [0, 2, 1, 1, 2, 3],
                  color: [0.5, 0.4, 0.3],
                },
                {
                  id: "wall",
                  positionsMm: [
                    100000, 0, 10000, 100000, 20000, 10000, 100000, 0, 100000,
                    100000, 20000, 100000,
                  ],
                  indices: [0, 1, 2, 1, 3, 2],
                  color: [0.5, 0.4, 0.3],
                },
              ],
            };
      const ids = [];
      for (const [type, bytes] of [
        [
          "scene",
          (kind === "terrain" ? compileTerrainCell : compileSceneryCell)(cell)
            .glb,
        ],
        ["collision", new TextEncoder().encode(JSON.stringify(cell))],
      ]) {
        const id = `tile-${x}-${type}`,
          path = `${id}.${type === "scene" ? "glb" : "json"}`;
        assets.push({
          id,
          kind: type,
          path,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
        bodies.set(path, bytes);
        ids.push(id);
      }
      chunks.push({ id: base.chunkId, x, z: 0, assets: ids });
    }
    layers[kind] = {
      requests: () => requests,
      setIntercept(value) {
        intercept = value;
      },
      manifest: {
        format: "FPVRegionManifest.v1",
        id: "mixed-check",
        revision: "r1",
        title: { en: "Mixed", uk: "Змішаний" },
        grid: {
          cellSizeMm: 128000,
          minX: 0,
          minZ: 0,
          width: 6,
          depth: 1,
          floorMm: -1000,
          ceilingMm: 1000000,
        },
        assets,
        chunks,
        spawns: [{ id: "start", position: point(0) }],
      },
      source: {
        baseURL: `https://${kind}.example/`,
        fetchImpl: async (url, options) => {
          requests++;
          const key = new URL(url).pathname.slice(1);
          const replacement = await intercept?.(key, options);
          const bytes = replacement ?? bodies.get(key);
          return new Response(bytes, { status: bytes ? 200 : 404 });
        },
      },
    };
  }
  return layers;
}
const create = (f, options = {}) =>
  createVerifiedMixedWindow(f.terrain.manifest, {
    source: f.terrain.source,
    scenery: { manifest: f.scenery.manifest, source: f.scenery.source },
    ...options,
  });
let checks = 0;
async function check(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}
await check(
  "mixed ground, roof and wall queries retain nearest hit and layer provenance",
  async () => {
    const f = fixture(),
      window = create(f);
    try {
      await window.transition(point(0), {
        positionMm: point(0),
        radiusMm: 220,
      });
      assert.equal(window.group.children.length, 2);
      assert.equal(window.snapshot().terrainReady, true);
      assert.equal(
        window.support({ x: 10000, y: 20000, z: 6000 }, 30000).layer,
        "terrain",
      );
      const roof = window.support({ x: 64000, y: 20000, z: 64000 }, 30000);
      assert.equal(roof.layer, "scenery");
      assert(Math.abs(roof.heightMm - 8000) < 0.1);
      const wall = window.sweep(
        { x: 50000, y: 4000, z: 64000 },
        { x: 110000, y: 4000, z: 64000 },
        220,
      );
      assert.equal(wall.layer, "scenery");
      assert(wall.fraction < 1);
      assert.equal(
        window.sweep(
          { x: 10000, y: 5000, z: 6000 },
          { x: 10000, y: -500, z: 6000 },
          220,
        ).layer,
        "terrain",
      );
      assert.equal(
        window.sweep(
          { x: 64000, y: 12000, z: 64000 },
          { x: 64000, y: -500, z: 64000 },
          220,
        ).layer,
        "scenery",
      );
      assert.equal(window.support(point(5)).status, "unknown-cell");
      const state = window.snapshot();
      assert(state.sourceBytes <= 32 * 1024 * 1024);
      assert(state.geometryBytes <= 10 * 1024 * 1024);
      assert.equal(state.sourceBytes, state.reservedSourceBytes);
      assert.equal(state.geometryBytes, state.reservedGeometryBytes);
      for (const receipt of state.provenance.chunks) {
        assert(receipt.terrain.scene.sha256);
        assert(receipt.scenery.scene.sha256);
        assert.notEqual(
          receipt.terrain.scene.sha256,
          receipt.scenery.scene.sha256,
        );
      }
      state.provenance.chunks[0].terrain.scene.sha256 = "changed";
      assert.notEqual(
        window.snapshot().provenance.chunks[0].terrain.scene.sha256,
        "changed",
      );
    } finally {
      await window.dispose();
    }
  },
);
for (const kind of ["terrain", "scenery"])
  await check(
    `${kind} successor corruption retains both old layers and retry remains atomic`,
    async () => {
      const f = fixture(),
        window = create(f),
        root = new Group();
      try {
        await window.transition(point(0));
        const old = window.group,
          before = window.snapshot();
        root.add(old);
        f[kind].setIntercept(() => new Uint8Array([1]));
        await assert.rejects(window.transition(point(3)), /truncated|hash/i);
        assert.equal(window.group, old);
        assert.equal(old.children.length, 2);
        assert.deepEqual(window.snapshot().provenance, before.provenance);
        assert.equal(window.snapshot().geometryBytes, before.geometryBytes);
        assert.equal(window.support(point(0)).status, "not-ready");
        f[kind].setIntercept(null);
        await window.transition(point(3), null, {
          commit({ group }) {
            root.add(group);
          },
          rollback() {
            throw new Error("unexpected rollback");
          },
        });
        assert.deepEqual(root.children, [window.group]);
        assert.equal(old.children.length, 0);
      } finally {
        await window.dispose();
      }
      assert.equal(root.children.length, 0);
    },
  );
await check(
  "delayed scenery cannot publish a terrain-only successor; cancellation releases both staged owners",
  async () => {
    const f = fixture(),
      window = create(f);
    let release, started;
    try {
      await window.transition(point(0));
      const old = window.group,
        before = window.snapshot();
      const waiting = new Promise((resolve) => {
          started = resolve;
        }),
        gate = new Promise((resolve) => {
          release = resolve;
        });
      f.scenery.setIntercept(async () => {
        started();
        await gate;
      });
      const operation = window.transition(point(3));
      const rejection = assert.rejects(
        operation,
        (error) => error.name === "AbortError",
      );
      await waiting;
      assert.equal(window.group, old);
      assert.equal(old.children.length, 2);
      assert.deepEqual(window.snapshot().provenance, before.provenance);
      window.cancel();
      release();
      await rejection;
      assert.equal(window.group, old);
      assert.equal(window.snapshot().reservedSourceBytes, before.sourceBytes);
      assert.equal(
        window.snapshot().reservedGeometryBytes,
        before.geometryBytes,
      );
      assert.equal(window.snapshot().state, "cancelled");
    } finally {
      release?.();
      await window.dispose();
    }
  },
);
await check(
  "failed host attachment rolls back the whole mixed group without disposing the old pair",
  async () => {
    const f = fixture(),
      window = create(f),
      root = new Group();
    let staged;
    try {
      await window.transition(point(0));
      const old = window.group;
      root.add(old);
      await assert.rejects(
        window.transition(point(3), null, {
          commit({ group }) {
            staged = group;
            root.add(group);
            window.cancel();
          },
          rollback() {
            staged.removeFromParent();
          },
        }),
        (error) => error.name === "AbortError",
      );
      assert.deepEqual(root.children, [old]);
      assert.equal(old.children.length, 2);
      assert.equal(staged.children.length, 0);
    } finally {
      await window.dispose();
    }
  },
);
await check(
  "combined source and geometry ceilings include retained plus both staged layers before fetching",
  async () => {
    for (const budget of ["source", "geometry"]) {
      const f = fixture(),
        perCell =
          f.terrain.manifest.assets
            .slice(0, 2)
            .reduce((n, a) => n + a.bytes, 0) +
          f.scenery.manifest.assets
            .slice(0, 2)
            .reduce((n, a) => n + a.bytes, 0);
      const window = create(
        f,
        budget === "source"
          ? { maxSourceBytes: perCell * 4 }
          : { maxGeometryBytes: 210000 },
      );
      try {
        await window.transition(point(0));
        const old = window.group,
          requests = f.terrain.requests() + f.scenery.requests();
        await assert.rejects(
          window.transition(point(3)),
          new RegExp(`mixed-transition-${budget}-budget`),
        );
        assert.equal(window.group, old);
        assert.equal(f.terrain.requests() + f.scenery.requests(), requests);
      } finally {
        await window.dispose();
      }
    }
  },
);
await check(
  "mismatched companions reject before transport and blocked support retains whole frame",
  async () => {
    const f = fixture();
    f.scenery.manifest.revision = "other";
    assert.throws(() => create(f), /identity/);
    assert.equal(f.terrain.requests() + f.scenery.requests(), 0);
    f.scenery.manifest.revision = "r1";
    const window = create(f);
    try {
      await window.transition(point(0));
      const old = window.group;
      await assert.rejects(
        window.transition(point(0), {
          positionMm: { x: 100000, y: 4000, z: 64000 },
          radiusMm: 220,
        }),
        /intersects/,
      );
      assert.equal(window.group, old);
    } finally {
      await window.dispose();
    }
  },
);
await check(
  "mixed shared-flight crossing preserves body and pauses until both layers commit",
  async () => {
    const f = fixture(),
      flight = createRegionalFlightPrototype({
        manifest: f.terrain.manifest,
        source: f.terrain.source,
        scenery: { manifest: f.scenery.manifest, source: f.scenery.source },
        geometryProfile: "terrain-scenery-v1",
      });
    let crossings = 0;
    const body = (s) => ({
      position: s.position,
      velocity: s.velocity,
      orientation: s.orientation,
      angular: s.angular,
      ticks: s.ticks,
    });
    try {
      await flight.prepare();
      assert(flight.arm());
      for (let i = 0; i < 2600; i++) {
        const before = flight.snapshot(),
          throttle = Math.max(
            0,
            Math.min(
              1,
              0.5 +
                (12000 - before.position.y) * 0.00002 -
                before.velocity.y * 0.000025,
            ),
          );
        const next = flight.step({ roll: 0.35, pitch: 0, yaw: 0, throttle });
        if (next.reason === "terrain-required") {
          assert.deepEqual(body(next), body(before));
          await flight.prepare();
          assert.deepEqual(body(flight.snapshot()), body(before));
          assert.equal(flight.snapshot().status, "paused");
          assert(flight.arm());
          crossings++;
        } else assert.equal(next.status, "active");
        if (next.position.x > 270000) break;
      }
      const state = flight.snapshot();
      assert(crossings >= 2);
      assert(state.position.x > 270000);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.originMm, state.terrain.provenance.originMm);
      assert.equal(state.terrain.provenance.chunks.length, 3);
      console.log(
        JSON.stringify({
          crossings,
          ticks: state.ticks,
          position: state.position,
          sourceBytes: state.terrain.sourceBytes,
          geometryBytes: state.terrain.geometryBytes,
        }),
      );
    } finally {
      await flight.dispose();
    }
  },
);
if (process.argv[2])
  await check(
    "authored companion manifests admit every cell and both original spawns",
    async () => {
      const folder = resolve(process.argv[2]),
        layers = {};
      for (const kind of ["terrain", "scenery"]) {
        const root = resolve(folder, kind);
        layers[kind] = {
          manifest: JSON.parse(
            await readFile(resolve(root, "region.json"), "utf8"),
          ),
          source: {
            baseURL: `https://${kind}.example/`,
            fetchImpl: async (url) => {
              const path = resolve(root, new URL(url).pathname.slice(1));
              assert(path.startsWith(root + "/"));
              return new Response(await readFile(path));
            },
          },
        };
      }
      const window = create(layers);
      let maxGeometryBytes = 0;
      try {
        for (const cell of layers.terrain.manifest.chunks) {
          await window.transition({
            x: cell.x * 128000 + 64000,
            y: 20000,
            z: cell.z * 128000 + 64000,
          });
          const state = window.snapshot();
          assert(state.terrainReady);
          assert.equal(window.group.children.length, 2);
          maxGeometryBytes = Math.max(maxGeometryBytes, state.geometryBytes);
        }
      } finally {
        await window.dispose();
      }
      for (const spawn of layers.terrain.manifest.spawns) {
        const flight = createRegionalFlightPrototype({
          manifest: layers.terrain.manifest,
          source: layers.terrain.source,
          scenery: layers.scenery,
          geometryProfile: "terrain-scenery-v1",
          spawnId: spawn.id,
        });
        try {
          await flight.prepare();
          assert.equal(flight.snapshot().status, "paused");
          assert.deepEqual(flight.snapshot().position, spawn.position);
          assert(flight.arm());
          for (let tick = 0; tick < 50; tick++)
            flight.step({ throttle: 0.5, roll: 0, pitch: 0, yaw: 0 });
          assert.equal(flight.snapshot().status, "active");
          assert.equal(flight.snapshot().contacts, 0);
        } finally {
          await flight.dispose();
        }
      }
      console.log(
        JSON.stringify({
          authoredCells: layers.terrain.manifest.chunks.length,
          spawns: layers.terrain.manifest.spawns.length,
          maxGeometryBytes,
        }),
      );
    },
  );
console.log(JSON.stringify({ checks, playerReady: false, flightReady: false }));
