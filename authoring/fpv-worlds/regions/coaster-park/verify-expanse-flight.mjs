/** Real fixed-step commands through the production regional session; no body teleporting. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, sep } from "node:path";
import {
  loadRegionalReview,
  createRegionalSession,
} from "../../../../optional-practice/civilian-fpv/regional-session.mjs";
import {
  responseCurve,
  DEFAULT_RESPONSE,
} from "../../../../optional-practice/civilian-fpv/radio-profile.mjs";
import { routes, solidProbes } from "./expanse-design.mjs";

const root = resolve(process.argv[2] ?? "");
assert(
  process.argv[2],
  "Provide the generated Coaster Gardens paired directory",
);
const receipt = JSON.parse(await readFile(resolve(root, "preparation.json")));
assert.deepEqual(receipt.routes, routes);
assert.deepEqual(receipt.solidProbes, solidProbes);
const sourcePins = {
  terrain: receipt.terrainManifestSHA256,
  scenery: receipt.sceneryManifestSHA256,
};
for (const [layer, expected] of Object.entries(sourcePins)) {
  const bytes = await readFile(resolve(root, layer, "region.json"));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
}
const cache = new Map();
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  const file = resolve(root, "." + new URL(url).pathname);
  assert(file.startsWith(root + sep));
  if (!cache.has(file)) cache.set(file, await readFile(file));
  return new Response(cache.get(file));
};
const configuration = await loadRegionalReview({
  manifestURL: "/terrain/region.json",
  sceneryURL: "/scenery/region.json",
  pageURL: "https://coaster.invalid/sim",
  fetchImpl,
});
const zero = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function inverseResponse(value) {
  const wanted = Math.round(clamp(value, -1, 1) * 1000);
  let low = -1000,
    high = 1000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (responseCurve(middle, DEFAULT_RESPONSE.expo) < wanted) low = middle;
    else high = middle;
  }
  return high / 1000;
}
function command(state, route, mode) {
  const [ax, height, az] = route.from,
    dx = route.to[0] - ax,
    dz = route.to[2] - az;
  const length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const x = state.position.x / 1000,
    z = state.position.z / 1000;
  const along = (x - ax) * ux + (z - az) * uz;
  const cross = -(x - ax) * uz + (z - az) * ux;
  const forward = clamp((length - along) * 1.1, -2, 5),
    lateral = clamp(-cross * 1.2, -2, 2);
  const wantedX = ux * forward - uz * lateral,
    wantedZ = uz * forward + ux * lateral;
  const desired = {
    roll: clamp((wantedX - state.velocity.x / 1000) * 350, -1200, 1200),
    pitch: clamp(-(wantedZ - state.velocity.z / 1000) * 350, -1200, 1200),
  };
  const axes = Object.fromEntries(
    ["roll", "pitch"].map((axis) => [
      axis,
      inverseResponse(
        mode === "self-level"
          ? desired[axis] / (DEFAULT_RESPONSE.maxTilt * 100)
          : ((desired[axis] - state.attitude[axis]) * 4) /
              (DEFAULT_RESPONSE.maxRate * 100),
      ),
    ]),
  );
  return {
    ...zero,
    ...axes,
    throttle: clamp(
      0.49 +
        (height - state.position.y / 1000) * 0.12 -
        (state.velocity.y / 1000) * 0.18,
      0,
      1,
    ),
  };
}
const frame = () => new Promise((resolve) => setImmediate(resolve));
const records = [];
let authoredStarts = 0;
for (const mode of ["self-level", "acro"]) {
  for (const spawn of configuration.manifest.spawns) {
    const session = createRegionalSession({
      ...configuration,
      mode,
      spawnId: spawn.id,
    });
    try {
      await session.prepare();
      const state = session.snapshot();
      assert.equal(state.status, "paused");
      assert.equal(state.ticks, 0);
      assert.equal(state.contacts, 0);
      assert.deepEqual(state.position, spawn.position);
      authoredStarts++;
    } finally {
      await session.dispose();
    }
  }
}
for (const mode of ["self-level", "acro"])
  for (const route of routes) {
    // A controlled start only selects where a scenario begins. Both exact source manifests,
    // asset hashes, colliders, shared flight model and accepted commands remain authoritative.
    const spawn = {
      id: "controlled-route-start",
      position: {
        x: route.from[0] * 1000,
        y: route.from[1] * 1000,
        z: route.from[2] * 1000,
      },
    };
    const manifest = { ...configuration.manifest, spawns: [spawn] };
    const scenery = {
      ...configuration.scenery,
      manifest: { ...configuration.scenery.manifest, spawns: [spawn] },
    };
    const session = createRegionalSession({
      ...configuration,
      manifest,
      scenery,
      initialHeading: 0,
      mode,
    });
    try {
      assert.equal(session.arm(), false);
      await session.prepare();
      assert.equal(session.snapshot().status, "paused");
      assert.equal(session.snapshot().ticks, 0);
      assert(session.arm());
      let state = session.snapshot(),
        maxCrossTrackM = 0,
        maxHeightErrorM = 0;
      const dx = route.to[0] - route.from[0],
        dz = route.to[2] - route.from[2],
        length = Math.hypot(dx, dz);
      for (let tick = 0; tick < 12000; tick++) {
        state = session.step(command(state, route, mode));
        assert.equal(
          state.status,
          "active",
          `${mode}/${route.id}: ${state.reason}`,
        );
        assert.equal(
          state.contacts,
          0,
          `${mode}/${route.id}: unexpected collision at ${JSON.stringify(state.position)}`,
        );
        const x = state.position.x / 1000 - route.from[0],
          z = state.position.z / 1000 - route.from[2];
        maxCrossTrackM = Math.max(
          maxCrossTrackM,
          Math.abs(-x * dz + z * dx) / length,
        );
        maxHeightErrorM = Math.max(
          maxHeightErrorM,
          Math.abs(state.position.y / 1000 - route.from[1]),
        );
        assert(
          maxCrossTrackM < route.halfWidth - 0.25,
          `${route.id}: left verified clear corridor`,
        );
        assert(
          maxHeightErrorM < 0.75,
          `${route.id}: altitude control exceeded corridor margin`,
        );
        const distance = Math.hypot(
          state.position.x / 1000 - route.to[0],
          state.position.z / 1000 - route.to[2],
        );
        await frame(); // Let real source preparation/adoption complete between accepted ticks.
        if (
          distance < 0.7 &&
          Math.hypot(state.velocity.x, state.velocity.z) < 800
        )
          break;
      }
      assert(
        state.ticks < 12000,
        `${mode}/${route.id}: did not reach and settle at route endpoint`,
      );
      assert.equal(state.playerReady, false);
      session.pause();
      const held = session.snapshot();
      assert.deepEqual(session.step({ ...zero, throttle: 1, roll: 1 }), held);
      records.push({
        mode,
        route: route.id,
        ticks: state.ticks,
        position: state.position,
        contacts: state.contacts,
        recentres: state.recentres,
        maxCrossTrackM,
        maxHeightErrorM,
      });
      await session.dispose();
      assert.equal(session.root.children.length, 0);
      assert.equal(session.snapshot().terrain.geometryBytes, 0);
      assert.equal(session.snapshot().terrain.textureBytes, 0);
    } finally {
      await session.dispose();
    }
  }
const contacts = [];
for (const mode of ["self-level", "acro"])
  for (const route of solidProbes) {
    const spawn = {
      id: "solid-check",
      position: {
        x: route.from[0] * 1000,
        y: route.from[1] * 1000,
        z: route.from[2] * 1000,
      },
    };
    const session = createRegionalSession({
      ...configuration,
      manifest: { ...configuration.manifest, spawns: [spawn] },
      scenery: {
        ...configuration.scenery,
        manifest: { ...configuration.scenery.manifest, spawns: [spawn] },
      },
      mode,
      initialHeading: 0,
    });
    try {
      await session.prepare();
      assert(session.arm());
      let state = session.snapshot();
      for (let i = 0; i < 800 && state.contacts === 0; i++) {
        state = session.step(command(state, route, mode));
        assert.equal(state.status, "active");
        await frame();
      }
      assert(
        state.contacts > 0,
        `${route.id}: visible structure must stop actual flight`,
      );
      assert(
        state.position.x < route.to[0] * 1000,
        `${route.id}: body crossed solid endpoint`,
      );
      contacts.push({
        probe: route.id,
        mode,
        ticks: state.ticks,
        position: state.position,
        contacts: state.contacts,
      });
    } finally {
      await session.dispose();
    }
  }
console.log(
  JSON.stringify(
    {
      passed: true,
      actualCommandedRoutes: records.length,
      records,
      authoredStarts,
      actualWallContacts: contacts,
      sourcePins,
      playerReady: false,
      claim:
        "Production regional-session controlled command evidence; not native player/device FPS evidence.",
    },
    null,
    2,
  ),
);
