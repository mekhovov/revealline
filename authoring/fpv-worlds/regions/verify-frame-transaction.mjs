/** Actual verified Three/Rapier owners: adoption, cancellation and recovery boundaries. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Group } from "../../../optional-practice/civilian-fpv/vendor/three.module.js";
import { compileTerrainCell, TERRAIN_FORMAT } from "./terrain-cell.mjs";
import { compileSceneryCell, SCENERY_FORMAT } from "./scenery-cell.mjs";
import { createVerifiedTerrainWindow } from "./verified-terrain-window.mjs";
import { createVerifiedSceneryWindow } from "./verified-scenery-window.mjs";
import { createRegionalFlightPrototype } from "./flight-prototype.mjs";

const point = (x) => ({ x: x * 128000 + 64000, y: 10000, z: 64000 });
function fixture(kind) {
  const bodies = new Map(),
    assets = [],
    chunks = [];
  for (let x = 0; x < 6; x++) {
    const common = { chunkId: `tile-${x}`, x, z: 0, cellSizeMm: 128000 };
    const cell =
      kind === "terrain"
        ? {
            format: TERRAIN_FORMAT,
            ...common,
            samples: 33,
            heightsMm: Array(1089).fill(0),
          }
        : {
            format: SCENERY_FORMAT,
            ...common,
            surfaces: [
              {
                id: "floor",
                positionsMm: [
                  0, 0, 0, 128000, 0, 0, 0, 0, 128000, 128000, 0, 128000,
                ],
                indices: [0, 2, 1, 1, 2, 3],
                color: [0.4, 0.3, 0.2],
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
      const id = `${common.chunkId}-${type}`,
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
    chunks.push({ id: common.chunkId, x, z: 0, assets: ids });
  }
  let requests = 0;
  return {
    requests: () => requests,
    manifest: {
      format: "FPVRegionManifest.v1",
      id: "atomic-frame",
      revision: "r1",
      title: { en: "Atomic frame", uk: "Цілісний кадр" },
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
      baseURL: "https://terrain.example/",
      fetchImpl: async (url) => {
        requests++;
        const bytes = bodies.get(new URL(url).pathname.slice(1));
        return new Response(bytes, { status: bytes ? 200 : 404 });
      },
    },
  };
}
let checks = 0;
async function check(label, run) {
  await run();
  checks++;
  console.log(`PASS ${label}`);
}
for (const [kind, create] of [
  ["terrain", createVerifiedTerrainWindow],
  ["scenery", createVerifiedSceneryWindow],
]) {
  await check(
    `${kind}: renderer preparation precedes adoption and cancellation retains old queries`,
    async () => {
      const f = fixture(kind),
        window = create(f.manifest, { ...f.source, retainCommitted: true });
      let release, entered, candidate;
      const started = new Promise((resolve) => {
        entered = resolve;
      });
      const delayed = new Promise((resolve) => {
        release = resolve;
      });
      try {
        await window.transition(point(0));
        const old = window.group;
        const transition = window.transition(point(1), null, {
          async prepare({ group }) {
            candidate = group;
            entered();
            await delayed;
          },
          commit() {
            assert.fail("cancelled preparation committed");
          },
          rollback() {},
        });
        await started;
        assert.equal(candidate.parent, null);
        assert.equal(window.group, old);
        assert.equal(window.support(point(0), 4000000).status, `${kind}-hit`);
        window.cancel();
        release();
        await assert.rejects(transition, { name: "AbortError" });
        assert.equal(window.group, old);
        assert.equal(candidate.children.length, 0);
        assert.equal(
          window.snapshot().reservedGeometryBytes,
          window.snapshot().geometryBytes,
        );
      } finally {
        release?.();
        await window.dispose();
      }
    },
  );
  await check(
    `${kind}: failed adoption retains old owner and visible frame; retry replaces once`,
    async () => {
      const f = fixture(kind),
        window = create(f.manifest, f.source),
        root = new Group();
      let origin = null,
        old = null,
        staged = null,
        rollbacks = 0;
      try {
        await window.transition(point(0));
        old = window.group;
        root.add(old);
        origin = window.snapshot().provenance.originMm;
        const before = window.snapshot();
        const transaction = {
          commit(value) {
            staged = value.group;
            root.add(staged);
            origin = value.provenance.originMm;
            throw new Error("host attachment rejected");
          },
          rollback() {
            rollbacks++;
            staged.removeFromParent();
            origin = before.provenance.originMm;
          },
        };
        await assert.rejects(
          window.transition(point(3), null, transaction),
          /host attachment rejected/,
        );
        assert.equal(window.group, old);
        assert.deepEqual(root.children, [old]);
        assert.deepEqual(origin, before.provenance.originMm);
        assert.equal(rollbacks, 1);
        assert.equal(staged.children.length, 0);
        assert.equal(window.snapshot().geometryBytes, before.geometryBytes);
        assert.equal(
          window.snapshot().reservedGeometryBytes,
          before.geometryBytes,
        );
        assert.equal(window.support(point(0)).status, "not-ready");
        await window.transition(point(3), null, {
          commit(value) {
            root.add(value.group);
            origin = value.provenance.originMm;
          },
          rollback() {
            throw new Error("unexpected rollback");
          },
        });
        assert.deepEqual(root.children, [window.group]);
        assert.equal(old.children.length, 0);
        assert.deepEqual(origin, window.snapshot().provenance.originMm);
        assert.equal(window.support(point(3), 4000000).status, `${kind}-hit`);
      } finally {
        await window.dispose();
      }
      assert.equal(root.children.length, 0);
    },
  );
  await check(
    `${kind}: synchronous cancellation during adoption rolls back before publication`,
    async () => {
      const f = fixture(kind),
        window = create(f.manifest, f.source),
        root = new Group();
      let staged = null,
        rolled = false;
      try {
        await window.transition(point(0));
        const old = window.group,
          before = window.snapshot();
        root.add(old);
        await assert.rejects(
          window.transition(point(3), null, {
            commit(value) {
              staged = value.group;
              root.add(staged);
              window.cancel();
            },
            rollback() {
              rolled = true;
              staged.removeFromParent();
            },
          }),
          (error) => error.name === "AbortError",
        );
        assert(rolled);
        assert.deepEqual(root.children, [old]);
        assert.equal(window.group, old);
        assert.deepEqual(window.snapshot().provenance, before.provenance);
        assert.equal(staged.children.length, 0);
        assert.equal(window.snapshot().state, "cancelled");
      } finally {
        await window.dispose();
      }
    },
  );
  await check(
    `${kind}: cancellation queued after adoption retains one coherent new frame`,
    async () => {
      const f = fixture(kind),
        window = create(f.manifest, f.source),
        root = new Group();
      let frame = null;
      try {
        await window.transition(point(0));
        root.add(window.group);
        await window.transition(point(3), null, {
          commit(value) {
            frame = value;
            root.add(value.group);
            queueMicrotask(() => window.cancel());
          },
          rollback() {
            throw new Error("commit already finished");
          },
        });
        assert.equal(window.snapshot().state, "cancelled");
        assert.deepEqual(root.children, [window.group]);
        assert.equal(frame.group, window.group);
        assert.deepEqual(frame.provenance, window.snapshot().provenance);
        assert.equal(window.support(point(3), 4000000).status, "not-ready");
      } finally {
        await window.dispose();
      }
    },
  );
  await check(
    `${kind}: invalid async transactions rejected before transport`,
    async () => {
      const f = fixture(kind),
        window = create(f.manifest, f.source);
      try {
        await assert.rejects(
          window.transition(point(0), null, {
            commit: async () => {},
            rollback() {},
          }),
          /synchronous/,
        );
        await assert.rejects(
          window.transition(point(0), null, { commit() {} }),
          /synchronous/,
        );
        assert.equal(f.requests(), 0);
      } finally {
        await window.dispose();
      }
    },
  );
}
const body = (state) => ({
  position: state.position,
  velocity: state.velocity,
  orientation: state.orientation,
  angular: state.angular,
  ticks: state.ticks,
});
for (const kind of ["terrain", "scenery"]) {
  await check(
    `${kind} flight: cancellation from real root attachment preserves body, frame and retained terrain`,
    async () => {
      const f = fixture(kind),
        flight = createRegionalFlightPrototype({
          manifest: f.manifest,
          source: f.source,
          geometryProfile: `${kind}-v1`,
        });
      try {
        await flight.prepare();
        flight.arm();
        for (let i = 0; i < 20; i++)
          flight.step({ throttle: 0.55, roll: 0.03, pitch: 0, yaw: 0 });
        flight.pause();
        const before = flight.snapshot(),
          children = [...flight.root.children],
          pose = flight.dronePose.position.toArray(),
          originalAdd = flight.root.add;
        flight.root.add = function (...items) {
          const result = originalAdd.apply(this, items);
          flight.cancelPreparation();
          return result;
        };
        await assert.rejects(
          flight.prepare(),
          (error) => error.name === "AbortError",
        );
        flight.root.add = originalAdd;
        const after = flight.snapshot();
        assert.deepEqual(body(after), body(before));
        assert.deepEqual(after.originMm, before.originMm);
        assert.equal(after.recentres, before.recentres);
        assert.deepEqual(flight.root.children, children);
        assert.deepEqual(flight.dronePose.position.toArray(), pose);
        assert.equal(flight.arm(), false);
        await flight.prepare();
        assert.deepEqual(body(flight.snapshot()), body(before));
        assert.equal(flight.snapshot().status, "paused");
        assert.equal(
          flight.arm({ throttle: 0.5, roll: 0, pitch: 0, yaw: 0 }),
          false,
        );
        assert.equal(flight.arm(), true);
      } finally {
        await flight.dispose();
      }
    },
  );
  await check(
    `${kind} flight: cancellation in promise handoff leaves adopted origin and geometry consistent`,
    async () => {
      const f = fixture(kind),
        flight = createRegionalFlightPrototype({
          manifest: f.manifest,
          source: f.source,
          geometryProfile: `${kind}-v1`,
        });
      try {
        await flight.prepare();
        const originalAdd = flight.root.add;
        flight.root.add = function (...items) {
          const result = originalAdd.apply(this, items);
          queueMicrotask(() => flight.cancelPreparation());
          return result;
        };
        await assert.rejects(
          flight.prepare(),
          (error) => error.name === "AbortError",
        );
        flight.root.add = originalAdd;
        const state = flight.snapshot();
        assert.deepEqual(state.originMm, state.terrain.provenance.originMm);
        assert.equal(flight.root.children.length, 3);
        assert.equal(
          flight.root.children[2].children.length,
          state.terrain.provenance.chunks.length,
        );
        assert.equal(state.status, "paused");
        assert.equal(flight.arm(), false);
        await flight.prepare();
        assert.equal(flight.snapshot().reason, "prepared");
      } finally {
        await flight.dispose();
      }
    },
  );
}
console.log(
  JSON.stringify({ checks, physicsChanged: false, playerReady: false }),
);
