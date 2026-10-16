import {
  applyFlightSupport,
  initializeFlightSupport,
} from "../flight-support.mjs";
/** Unscored authoring harness using shared air/contact movement; host admission remains provisional. */
import {
  moveFlightSphere,
  projectContactVelocity,
} from "../flight-contact.mjs";
import * as THREE from "../vendor/three.module.js";
import { Q, isqrt, atan2, sin, cos, multiplyQuaternion } from "../math.mjs";
import { advanceFlightAir, quantizeFlightInput } from "../model.mjs";
import { DEFAULT_RESPONSE, validateFlightResponse } from "../radio-profile.mjs";
import {
  validateRegionManifest,
  createRegionPlanner,
} from "./region-manifest.mjs";
import { createVerifiedFlightGeometry } from "./verified-flight-geometry.mjs";

const AXES = ["x", "y", "z"],
  RADIUS = 220;
const fail = (value, message) => {
  if (!value) throw new TypeError(message);
};
const zero = () => ({ x: 0, y: 0, z: 0 });
const neutral = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });

// The authority receives a copied candidate: rejected terrain never mutates the committed body.
function candidateStep(state, command, mode, rates) {
  const next = structuredClone(state),
    displacement = {};
  advanceFlightAir(next, command, mode, rates, displacement);
  for (const axis of AXES) next.position[axis] += displacement[axis];
  next.ticks++;
  return next;
}

export function createRegionalFlightPrototype({
  manifest: input,
  source,
  geometryProfile = "terrain-v1",
  scenery = null,
  geometryBudgets,
  spawnId,
  initialHeading = 0,
  mode = "self-level",
  response = DEFAULT_RESPONSE,
  continuous = false,
  prepareFrame = null,
} = {}) {
  const manifest = validateRegionManifest(input),
    planner = createRegionPlanner(manifest),
    rates = validateFlightResponse(response);
  fail(typeof continuous === "boolean", "Invalid continuous flight option");
  fail(
    prepareFrame === null || typeof prepareFrame === "function",
    "Invalid frame preparation",
  );
  fail(
    ["acro", "self-level"].includes(mode),
    "Unsupported prototype flight mode",
  );
  const spawn = manifest.spawns.find(
    (item) => item.id === (spawnId ?? manifest.spawns[0].id),
  );
  fail(spawn, "Unknown region spawn");
  fail(
    initialHeading === "region-centre" ||
      (Number.isSafeInteger(initialHeading) &&
        initialHeading >= 0 &&
        initialHeading < 36000),
    "Invalid initial regional heading",
  );
  const heading =
    initialHeading === "region-centre"
      ? atan2(
          (manifest.grid.minX + manifest.grid.width / 2) * 128000 -
            spawn.position.x,
          spawn.position.z -
            (manifest.grid.minZ + manifest.grid.depth / 2) * 128000,
        )
      : initialHeading;
  const halfHeading = Math.round(-heading / 2);
  const orientation = multiplyQuaternion(
    [0, 0, 0, Q],
    [0, sin(halfHeading), 0, cos(halfHeading)],
  );
  const terrain = createVerifiedFlightGeometry(manifest, {
      profile: geometryProfile,
      source,
      scenery,
      budgets: geometryBudgets,
      retainCommitted: continuous,
    }),
    root = new THREE.Group(),
    dronePose = new THREE.Object3D(),
    cameraAnchor = new THREE.Object3D();
  root.add(dronePose, cameraAnchor);
  const unavailableMotion = Symbol("regional motion unavailable");
  const staticSweep = (from, delta, radius) => {
    const result = terrain.castMotion(from, delta, radius);
    if (result.status === "motion-hit") return result.hit;
    if (result.status === "motion-clear") return null;
    throw unavailableMotion;
  };
  const noMovingGeometry = () => null;
  let body = {
    position: { ...spawn.position },
    velocity: zero(),
    orientation,
    angular: { roll: 0, pitch: 0, yaw: 0 },
    ticks: 0,
    grounded: false,
    support: null,
    landingSpeed: 0,
    landingTilt: 0,
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
  let streamingJob = null,
    streamingFailure = null,
    retryAfterTick = 0,
    preparationController = null;
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
    geometryProfile,
    streaming: {
      enabled: continuous,
      pending: Boolean(streamingJob),
      failure: streamingFailure,
    },
    model: "regional-authoring-flight-prototype.v1",
    unscored: true,
    playerReady: false,
  });
  function stopStreaming() {
    if (!streamingJob) return;
    generation++;
    streamingJob.controller.abort();
    terrain.cancel();
    streamingJob = null;
  }
  function prefetch() {
    if (
      !continuous ||
      streamingJob ||
      status !== "active" ||
      body.ticks < retryAfterTick
    )
      return;
    const grid = manifest.grid,
      target = { ...body.position };
    for (const key of ["x", "z"]) {
      const min = grid[key === "x" ? "minX" : "minZ"] * 128000 + RADIUS,
        max = min + grid[key === "x" ? "width" : "depth"] * 128000 - 2 * RADIUS;
      // At most one cell ahead; the next 3×3 window still contains the current body.
      target[key] = Math.max(
        min,
        Math.min(
          max,
          body.position[key] +
            Math.max(-96000, Math.min(96000, body.velocity[key] * 3)),
        ),
      );
    }
    const plan = planner(target);
    if (plan.blocked || !plan.origin) {
      streamingFailure = plan.blocked ?? "Background region is unavailable";
      retryAfterTick = body.ticks + 100;
      return;
    }
    if (AXES.every((key) => plan.origin[key] === origin[key])) return;
    const token = ++generation,
      job = { token, controller: new AbortController() },
      previousOrigin = origin,
      previousRecentres = recentres;
    let attached = null;
    const current = () => {
      if (disposed || token !== generation || status !== "active")
        throw new DOMException(
          "Background flight preparation cancelled",
          "AbortError",
        );
    };
    streamingJob = job;
    streamingFailure = null;
    job.promise = terrain
      .transition(target, null, {
        ...(prepareFrame
          ? {
              async prepare({ group }) {
                await prepareFrame(group, { signal: job.controller.signal });
              },
            }
          : {}),
        readPose() {
          current();
          return { positionMm: body.position, radiusMm: RADIUS };
        },
        commit({ group, provenance }) {
          current();
          origin = { ...provenance.originMm };
          recentres++;
          attached = group;
          root.add(group);
          updateFrame();
        },
        rollback() {
          attached?.removeFromParent();
          origin = previousOrigin;
          recentres = previousRecentres;
          updateFrame();
        },
      })
      .catch((error) => {
        if (!disposed && token === generation) {
          streamingFailure = error.message;
          retryAfterTick = body.ticks + 100;
        }
      })
      .finally(() => {
        if (streamingJob === job) streamingJob = null;
      });
  }
  function prepare() {
    live();
    stopStreaming();
    preparationController?.abort();
    const controller = new AbortController();
    preparationController = controller;
    const target = { ...(pendingTarget ?? body.position) },
      token = ++generation;
    status = "paused";
    reason = "preparing-terrain";
    const operation = (async () => {
      try {
        const previousOrigin = origin,
          previousRecentres = recentres;
        let attached = null;
        await terrain.transition(
          target,
          {
            positionMm: body.position,
            radiusMm: RADIUS,
          },
          {
            ...(prepareFrame
              ? {
                  async prepare({ group }) {
                    await prepareFrame(group, { signal: controller.signal });
                  },
                }
              : {}),
            commit({ group, provenance }) {
              if (disposed || token !== generation)
                throw new DOMException(
                  "Prototype preparation cancelled",
                  "AbortError",
                );
              const nextOrigin = provenance.originMm;
              if (AXES.some((key) => nextOrigin[key] !== origin[key]))
                recentres++;
              origin = { ...nextOrigin };
              attached = group;
              root.add(group);
              updateFrame();
            },
            rollback() {
              attached?.removeFromParent();
              origin = previousOrigin;
              recentres = previousRecentres;
              updateFrame();
            },
          },
        );
        if (
          disposed ||
          token !== generation ||
          !terrain.snapshot().terrainReady
        )
          throw new DOMException(
            "Prototype preparation cancelled",
            "AbortError",
          );
        if (body.ticks === 0) {
          const support = terrain.flightSupport(body.position, RADIUS, 5);
          if (support.status !== "flight-support")
            throw new Error("Verified spawn support is unavailable");
          initializeFlightSupport(body, support.ground);
        }
        pendingTarget = null;
        streamingFailure = null;
        retryAfterTick = 0;
        reason = "prepared";
        return snapshot();
      } catch (error) {
        if (!disposed && token === generation) {
          status = "paused";
          reason = "terrain-error";
        }
        throw error;
      } finally {
        if (preparationController === controller) preparationController = null;
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
      stopStreaming();
      if (status === "active") {
        status = "paused";
        reason = "prepared";
      }
    },
    cancelPreparation() {
      live();
      stopStreaming();
      preparationController?.abort();
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
      const impactSpeed = isqrt(
        AXES.reduce(
          (sum, key) => sum + next.velocity[key] * next.velocity[key],
          0,
        ),
      );
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
      if (!continuous) {
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
      }
      let moved;
      try {
        const delta = Object.fromEntries(
          AXES.map((key) => [key, next.position[key] - body.position[key]]),
        );
        moved = moveFlightSphere(
          body.position,
          delta,
          RADIUS,
          [],
          staticSweep,
          noMovingGeometry,
        );
      } catch (error) {
        if (error !== unavailableMotion) throw error;
        pendingTarget = { ...next.position };
        status = "paused";
        reason = "terrain-required";
        return snapshot();
      }
      next.position = moved.position;
      for (const hit of moved.contacts) {
        next.velocity = projectContactVelocity(next.velocity, hit);
      }
      const support = terrain.flightSupport(next.position, RADIUS, 60);
      if (support.status !== "flight-support") {
        pendingTarget = { ...next.position };
        status = "paused";
        reason = "terrain-required";
        return snapshot();
      }
      applyFlightSupport(next, support.ground, body.grounded, impactSpeed);
      contacts += moved.contacts.length;
      body = next;
      updateFrame();
      prefetch();
      return snapshot();
    },
    async dispose() {
      if (!disposed) {
        disposed = true;
        preparationController?.abort();
        streamingJob?.controller.abort();
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
