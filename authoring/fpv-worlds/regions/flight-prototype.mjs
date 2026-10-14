/** Temporary unscored authoring flight harness. Not a production physics implementation. */
import * as THREE from "../../../optional-practice/civilian-fpv/vendor/three.module.js";
import {
  Q,
  attitude,
  clamp,
  integrateOrientation,
  mul,
  roundDiv,
} from "../../../optional-practice/civilian-fpv/math.mjs";
import { quantizeFlightInput } from "../../../optional-practice/civilian-fpv/model.mjs";
import {
  DEFAULT_RESPONSE,
  responseCurve,
  validateFlightResponse,
} from "../../../optional-practice/civilian-fpv/radio-profile.mjs";
import {
  validateRegionManifest,
  createRegionPlanner,
} from "./region-manifest.mjs";
import { createVerifiedTerrainWindow } from "./verified-terrain-window.mjs";

const AXES = ["x", "y", "z"],
  HZ = 50,
  RADIUS = 220;
const fail = (value, message) => {
  if (!value) throw new TypeError(message);
};
const zero = () => ({ x: 0, y: 0, z: 0 });
const neutral = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });

/** Temporary port of existing free-air equations; production integration must share one core. */
function candidateStep(state, command, mode, rates) {
  const next = structuredClone(state),
    angles = attitude(state.orientation);
  for (const key of ["roll", "pitch", "yaw"]) {
    const shaped = responseCurve(command[key], rates.expo);
    const desired =
      mode === "self-level" && key !== "yaw"
        ? clamp(
            (roundDiv(shaped * rates.maxTilt * 100, 1000) - angles[key]) * 4,
            -rates.maxRate * 100,
            rates.maxRate * 100,
          )
        : roundDiv(shaped * rates.maxRate * 100, 1000);
    const difference = desired - next.angular[key];
    next.angular[key] += difference
      ? Math.sign(difference) *
        Math.max(1, Math.abs(roundDiv(difference, rates.responseTicks)))
      : 0;
  }
  next.orientation = integrateOrientation(state.orientation, next.angular, HZ);
  const up = attitude(next.orientation).up,
    thrust = roundDiv(command.throttle * 19620, 1000);
  for (const key of AXES) {
    const acceleration = mul(up[key], thrust) - (key === "y" ? 9810 : 0);
    next.velocity[key] = clamp(
      roundDiv(state.velocity[key] * 995, 1000) + roundDiv(acceleration, HZ),
      -30000,
      30000,
    );
    next.position[key] = state.position[key] + roundDiv(next.velocity[key], HZ);
  }
  next.ticks++;
  return next;
}

export function createRegionalFlightPrototype({
  manifest: input,
  source,
  spawnId,
  mode = "self-level",
  response = DEFAULT_RESPONSE,
} = {}) {
  const manifest = validateRegionManifest(input),
    planner = createRegionPlanner(manifest),
    rates = validateFlightResponse(response);
  fail(
    ["acro", "self-level"].includes(mode),
    "Unsupported prototype flight mode",
  );
  const spawn = manifest.spawns.find(
    (item) => item.id === (spawnId ?? manifest.spawns[0].id),
  );
  fail(spawn, "Unknown region spawn");
  const terrain = createVerifiedTerrainWindow(manifest, source),
    root = new THREE.Group(),
    dronePose = new THREE.Object3D(),
    cameraAnchor = new THREE.Object3D();
  root.add(dronePose, cameraAnchor);
  let body = {
    position: { ...spawn.position },
    velocity: zero(),
    orientation: [0, 0, 0, Q],
    angular: { roll: 0, pitch: 0, yaw: 0 },
    ticks: 0,
  };
  let status = "paused",
    reason = "terrain-required",
    origin = zero(),
    pendingTarget = { ...body.position },
    contacts = 0,
    recentres = 0;
  let generation = 0,
    disposed = false,
    pending = Promise.resolve();
  const live = () => fail(!disposed, "Regional prototype is disposed");
  function updateFrame() {
    const position = {
      x: (body.position.x - origin.x) / 1000,
      y: (body.position.y + RADIUS - origin.y) / 1000,
      z: (body.position.z - origin.z) / 1000,
    };
    for (const pose of [dronePose, cameraAnchor]) {
      pose.position.set(position.x, position.y, position.z);
      pose.quaternion.set(...body.orientation.map((value) => value / Q));
      pose.updateMatrixWorld(true);
    }
  }
  updateFrame();
  const snapshot = () => ({
    ...structuredClone(body),
    mode,
    status,
    reason,
    contacts,
    recentres,
    originMm: { ...origin },
    localPositionMm: Object.fromEntries(
      AXES.map((key) => [key, body.position[key] - origin[key]]),
    ),
    pendingTargetMm: pendingTarget && { ...pendingTarget },
    terrain: terrain.snapshot(),
    model: "regional-authoring-flight-prototype.v1",
    unscored: true,
    playerReady: false,
  });
  function centred(point) {
    return { ...point, y: point.y + RADIUS };
  }
  function prepare() {
    live();
    const target = { ...(pendingTarget ?? body.position) },
      token = ++generation;
    status = "paused";
    reason = "preparing-terrain";
    const operation = (async () => {
      try {
        const ready = await terrain.transition(target);
        if (disposed || token !== generation)
          throw new DOMException(
            "Prototype preparation cancelled",
            "AbortError",
          );
        const support = terrain.support(centred(body.position), 4000000);
        fail(
          support.status === "terrain-hit" &&
            body.position.y >= support.heightMm - 1,
          "Prototype pose needs verified terrain support below it",
        );
        const nextOrigin = ready.provenance.originMm;
        if (AXES.some((key) => nextOrigin[key] !== origin[key])) recentres++;
        // No await between origin, terrain and both pose updates: one complete local frame.
        origin = { ...nextOrigin };
        root.add(terrain.group);
        updateFrame();
        pendingTarget = null;
        reason = "prepared";
        return snapshot();
      } catch (error) {
        if (!disposed && token === generation) {
          status = "paused";
          reason = "terrain-error";
        }
        throw error;
      }
    })();
    pending = operation.catch(() => {});
    return operation;
  }
  return Object.freeze({
    snapshot,
    root,
    dronePose,
    cameraAnchor,
    prepare,
    arm(input = neutral()) {
      live();
      const command = quantizeFlightInput(input);
      if (
        reason !== "prepared" ||
        !terrain.snapshot().terrainReady ||
        command.throttle > 50 ||
        ["pitch", "roll", "yaw"].some((key) => Math.abs(command[key]) > 100)
      )
        return false;
      status = "active";
      reason = null;
      return true;
    },
    pause() {
      live();
      if (status === "active") {
        status = "paused";
        reason = "prepared";
      }
    },
    cancelPreparation() {
      live();
      generation++;
      terrain.cancel();
      status = "paused";
      reason = "terrain-required";
      pendingTarget ??= { ...body.position };
    },
    setMode(value) {
      live();
      fail(
        status !== "active" && ["acro", "self-level"].includes(value),
        "Pause before changing prototype flight mode",
      );
      mode = value;
    },
    step(input) {
      live();
      const command = quantizeFlightInput(input);
      if (status !== "active") return snapshot();
      if (!terrain.snapshot().terrainReady) {
        status = "paused";
        reason = "terrain-required";
        return snapshot();
      }
      const next = candidateStep(body, command, mode, rates);
      const grid = manifest.grid;
      if (
        next.position.x - RADIUS < grid.minX * 128000 ||
        next.position.x + RADIUS > (grid.minX + grid.width) * 128000 ||
        next.position.z - RADIUS < grid.minZ * 128000 ||
        next.position.z + RADIUS > (grid.minZ + grid.depth) * 128000 ||
        next.position.y + 2 * RADIUS > grid.ceilingMm
      ) {
        status = "paused";
        reason = "region-edge";
        return snapshot();
      }
      let plan;
      try {
        plan = planner(next.position);
      } catch {
        status = "paused";
        reason = "region-edge";
        return snapshot();
      }
      const readyChunks = new Set(
        terrain.snapshot().provenance.chunks.map((chunk) => chunk.chunkId),
      );
      if (
        plan.requiredChunks.some((id) => !readyChunks.has(id)) ||
        AXES.some((key) => plan.origin[key] !== origin[key])
      ) {
        pendingTarget = { ...next.position };
        status = "paused";
        reason = "terrain-required";
        return snapshot();
      }
      const hit = terrain.sweep(
        centred(body.position),
        centred(next.position),
        RADIUS,
      );
      if (!["terrain-clear", "terrain-hit"].includes(hit.status)) {
        pendingTarget = { ...next.position };
        status = "paused";
        reason = "terrain-required";
        return snapshot();
      }
      if (hit.status === "terrain-hit") {
        const displacement = Math.hypot(
          ...AXES.map((key) => next.position[key] - body.position[key]),
        );
        const fraction = Math.max(
          0,
          hit.fraction - 2 / Math.max(displacement, 1),
        );
        for (const key of AXES)
          next.position[key] =
            body.position[key] +
            Math.trunc((next.position[key] - body.position[key]) * fraction);
        next.velocity = zero();
        contacts++;
      }
      body = next;
      updateFrame();
      return snapshot();
    },
    async dispose() {
      if (!disposed) {
        disposed = true;
        generation++;
        status = "disposed";
        reason = null;
        terrain.cancel();
        root.clear();
        root.removeFromParent();
      }
      await pending;
      await terrain.dispose();
    },
  });
}
