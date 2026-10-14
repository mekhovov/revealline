/** Functional movement prototype only; no production flight or device qualification. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createFlight } from "../../../optional-practice/civilian-fpv/model.mjs";
import { compileTerrainCell, TERRAIN_FORMAT } from "./terrain-cell.mjs";
import { createRegionalFlightPrototype } from "./flight-prototype.mjs";
const zero = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const encode = (x) => new TextEncoder().encode(JSON.stringify(x));
const fixture = () => {
  const assets = [],
    chunks = [],
    bodies = new Map();
  for (let x = 0; x < 8; x++)
    for (let z = 0; z < 3; z++) {
      const cell = {
          format: TERRAIN_FORMAT,
          chunkId: `tile-${x}-${z}`,
          x,
          z,
          cellSizeMm: 128000,
          samples: 33,
          heightsMm: Array(1089).fill(0),
        },
        ids = [];
      for (const [kind, bytes] of [
        ["scene", compileTerrainCell(cell).glb],
        ["collision", encode(cell)],
      ]) {
        const id = `${cell.chunkId}-${kind}`,
          path = `${id}.${kind === "scene" ? "glb" : "json"}`;
        assets.push({
          id,
          kind,
          path,
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
        bodies.set(`/region/${path}`, bytes);
        ids.push(id);
      }
      chunks.push({ id: cell.chunkId, x, z, assets: ids });
    }
  return {
    bodies,
    manifest: {
      format: "FPVRegionManifest.v1",
      id: "flight-prototype",
      revision: "r1",
      title: { en: "Prototype", uk: "Прототип" },
      grid: {
        cellSizeMm: 128000,
        minX: 0,
        minZ: 0,
        width: 8,
        depth: 3,
        floorMm: -1000,
        ceilingMm: 1000000,
      },
      assets,
      chunks,
      spawns: [{ id: "start", position: { x: 64000, y: 5, z: 192000 } }],
    },
  };
};
const body = (state) => ({
  ticks: state.ticks,
  position: state.position,
  velocity: state.velocity,
  angular: state.angular,
  orientation: state.orientation,
});
const sourceFor = (f, intercept) => ({
  baseURL: "https://terrain.example/region/",
  fetchImpl: async (url, options) => {
    await intercept?.(url, options);
    const bytes = f.bodies.get(new URL(url).pathname);
    return new Response(bytes, { status: bytes ? 200 : 404 });
  },
});
const legacyCourse = () => {
  const hold = {
    type: "hold",
    min: { x: -1000, y: 90000, z: -1000 },
    max: { x: 1000, y: 100000, z: 1000 },
    ticks: 500,
    maxSpeed: 0,
    maxTilt: 0,
    minTilt: 0,
    centred: true,
    heading: null,
  };
  return {
    format: "FlightCourse.v1",
    id: "parity",
    revision: "r1",
    environment: "field",
    locales: {
      en: { title: "Parity", brief: "Parity", lesson: "Parity" },
      uk: { title: "Порівняння", brief: "Порівняння", lesson: "Порівняння" },
    },
    spawn: { x: 0, y: 0, z: 0 },
    bounds: {
      min: { x: -100000, y: 0, z: -100000 },
      max: { x: 100000, y: 100000, z: 100000 },
    },
    obstacles: [],
    steps: { acro: [hold], "self-level": [hold] },
  };
};
let checks = 0;
async function check(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}
await check(
  "free-air force/rotation parity with existing model in Acro and self-level",
  async () => {
    for (const mode of ["acro", "self-level"])
      for (const rotation of [0, 1]) {
        const f = fixture(),
          flight = createRegionalFlightPrototype({
            manifest: f.manifest,
            source: sourceFor(f),
            mode,
          }),
          legacy = createFlight({
            course: legacyCourse(),
            mode,
            unscoredPractice: true,
          });
        try {
          await flight.prepare();
          assert.equal(flight.arm(), true);
          legacy.arm();
          for (let i = 0; i < 80; i++) {
            const input = {
              throttle: i < 25 ? 1 : i < 55 ? 0.55 : 0.8,
              roll: rotation * (i < 40 ? 0.07 : -0.09),
              pitch: rotation * (i < 45 ? -0.08 : 0.06),
              yaw: rotation * 0.11,
            };
            const a = flight.step(input),
              b = legacy.step(input);
            assert.equal(a.status, "active");
            assert.deepEqual(a.orientation, b.orientation);
            assert.deepEqual(a.angular, b.angular);
            assert.deepEqual(a.velocity, b.velocity);
            for (const key of ["x", "y", "z"])
              assert.equal(
                a.position[key] - f.manifest.spawns[0].position[key],
                b.position[key],
              );
          }
        } finally {
          await flight.dispose();
        }
      }
  },
);
await check(
  "cell crossings pause atomically and reframe without world-pose or momentum jumps",
  async () => {
    const f = fixture(),
      flight = createRegionalFlightPrototype({
        manifest: f.manifest,
        source: sourceFor(f),
      });
    let crossings = 0;
    try {
      await flight.prepare();
      assert.equal(flight.arm(), true);
      for (let i = 0; i < 2200; i++) {
        const input =
          i < 100
            ? { ...zero, throttle: 0.9 }
            : { ...zero, roll: 0.65, throttle: 0.55 };
        const before = flight.snapshot(),
          after = flight.step(input);
        if (after.reason === "terrain-required") {
          assert.deepEqual(body(after), body(before));
          const prepared = await flight.prepare();
          assert.equal(flight.root.children.length, 3);
          assert.deepEqual(body(prepared), body(before));
          assert.equal(prepared.status, "paused");
          for (const key of ["x", "y", "z"])
            assert.equal(
              prepared.localPositionMm[key] + prepared.originMm[key],
              prepared.position[key],
            );
          assert.deepEqual(
            flight.dronePose.position,
            flight.cameraAnchor.position,
          );
          assert.deepEqual(
            flight.dronePose.quaternion.toArray(),
            flight.cameraAnchor.quaternion.toArray(),
          );
          assert(
            Math.abs(
              flight.dronePose.position.x * 1000 +
                prepared.originMm.x -
                prepared.position.x,
            ) < 0.001,
          );
          assert.equal(flight.arm({ ...zero, throttle: 0.8 }), false);
          assert.equal(flight.arm(), true);
          crossings++;
        } else assert.equal(after.status, "active");
      }
      assert(crossings >= 3);
      assert(flight.snapshot().position.x > 450000);
      assert(flight.snapshot().terrain.geometryBytes <= 9 * 50712);
      console.log(
        JSON.stringify({
          crossedCells: crossings,
          worldPositionMm: flight.snapshot().position,
          ticks: flight.snapshot().ticks,
          recentres: flight.snapshot().recentres,
        }),
      );
    } finally {
      await flight.dispose();
    }
  },
);
await check(
  "unavailable required terrain stops progression and recovery stays disarmed",
  async () => {
    const f = fixture();
    let deny = false;
    const flight = createRegionalFlightPrototype({
      manifest: f.manifest,
      source: sourceFor(f, () => {
        if (deny) throw new Error("offline fixture");
      }),
    });
    try {
      await flight.prepare();
      flight.arm();
      let state;
      for (let i = 0; i < 1000; i++) {
        state = flight.step(
          i < 100
            ? { ...zero, throttle: 0.9 }
            : { ...zero, roll: 0.65, throttle: 0.55 },
        );
        if (state.reason === "terrain-required") break;
      }
      assert.equal(state.reason, "terrain-required");
      const frozen = body(state);
      deny = true;
      await assert.rejects(flight.prepare(), /offline fixture/);
      for (let i = 0; i < 100; i++)
        assert.deepEqual(body(flight.step({ ...zero, throttle: 1 })), frozen);
      assert.equal(flight.arm(), false);
      deny = false;
      await flight.prepare();
      assert.deepEqual(body(flight.snapshot()), frozen);
      assert.equal(flight.snapshot().status, "paused");
      assert(flight.arm());
    } finally {
      await flight.dispose();
    }
  },
);
await check(
  "sphere collision prevents terrain tunnelling during a commanded descent",
  async () => {
    const f = fixture();
    f.manifest.spawns[0].position.y = 15000;
    const flight = createRegionalFlightPrototype({
      manifest: f.manifest,
      source: sourceFor(f),
    });
    try {
      await flight.prepare();
      flight.arm();
      for (let i = 0; i < 200; i++) {
        const state = flight.step(zero);
        assert(state.position.y >= 0);
      }
      assert(flight.snapshot().contacts > 0);
      assert(flight.snapshot().position.y < 10);
    } finally {
      await flight.dispose();
    }
  },
);
await check(
  "region ceiling rejects the candidate before pose or time advances",
  async () => {
    const f = fixture();
    f.manifest.grid.ceilingMm = 20000;
    const flight = createRegionalFlightPrototype({
      manifest: f.manifest,
      source: sourceFor(f),
    });
    try {
      await flight.prepare();
      flight.arm();
      let stopped = false;
      for (let i = 0; i < 400; i++) {
        const before = body(flight.snapshot());
        const after = flight.step({ ...zero, throttle: 1 });
        if (after.reason === "region-edge") {
          assert.deepEqual(body(after), before);
          assert(after.position.y + 440 <= 20000);
          assert.equal(flight.arm(), false);
          stopped = true;
          break;
        }
      }
      assert(stopped);
    } finally {
      await flight.dispose();
    }
  },
);
await check(
  "cancelled preparation and disposal cannot move or arm the prototype",
  async () => {
    const f = fixture();
    let release, entered;
    const gate = new Promise((resolve) => (release = resolve)),
      seen = new Promise((resolve) => (entered = resolve));
    const flight = createRegionalFlightPrototype({
      manifest: f.manifest,
      source: sourceFor(f, async () => {
        entered();
        await gate;
      }),
    });
    const before = body(flight.snapshot()),
      preparing = flight.prepare(),
      rejected = assert.rejects(preparing, { name: "AbortError" });
    await seen;
    flight.cancelPreparation();
    release();
    await rejected;
    assert.deepEqual(body(flight.snapshot()), before);
    assert.equal(flight.arm(), false);
    await flight.dispose();
    await flight.dispose();
    assert.equal(flight.root.children.length, 0);
    assert.throws(() => flight.step(zero), /disposed/);
  },
);
if (process.argv[2])
  await check(
    "Canyon HTTP sources admit a real movement/terrain smoke path",
    async () => {
      const url = new URL(process.argv[2]),
        manifest = await (await fetch(url)).json(),
        flight = createRegionalFlightPrototype({
          manifest,
          source: { baseURL: new URL(".", url).href },
        });
      try {
        await flight.prepare();
        flight.arm();
        let accepted = 0,
          crossings = 0;
        for (let i = 0; i < 1400; i++) {
          const state = flight.step(
            i < 380
              ? { ...zero, throttle: 0.8 }
              : { ...zero, roll: 0.65, throttle: 0.55 },
          );
          if (state.reason === "terrain-required") {
            const before = body(state);
            await flight.prepare();
            assert.deepEqual(body(flight.snapshot()), before);
            flight.arm();
            crossings++;
          } else if (state.reason === "region-edge") break;
          else {
            assert.equal(state.status, "active");
            accepted++;
          }
        }
        assert(accepted > 500);
        assert(crossings >= 1);
        console.log(
          JSON.stringify({
            canyonTicks: accepted,
            crossings,
            positionMm: flight.snapshot().position,
            contacts: flight.snapshot().contacts,
          }),
        );
      } finally {
        await flight.dispose();
      }
    },
  );
console.log(
  JSON.stringify({
    checks,
    passed: true,
    runtime: process.version,
    playerReady: false,
    limitations:
      "Shared production air transition; terrain collision remains provisional. No scored proof, production integrator, GPU/FPS or player qualification.",
  }),
);
