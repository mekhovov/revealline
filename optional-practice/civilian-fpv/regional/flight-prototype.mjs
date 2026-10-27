import { applyFlightSupport, initializeFlightSupport } from '../flight-support.mjs';
/** Unscored authoring harness using shared air/contact movement; host admission remains provisional. */
import { moveFlightSphere, projectContactVelocity } from '../flight-contact.mjs';
import * as THREE from '../vendor/three.module.js';
import { Q, isqrt, atan2, sin, cos, multiplyQuaternion } from '../math.mjs';
import { advanceFlightAir, quantizeFlightInput } from '../model.mjs';
import { DEFAULT_RESPONSE, validateFlightResponse } from '../radio-profile.mjs';
import { validateRegionManifest, createRegionPlanner } from './region-manifest.mjs';
import { createVerifiedFlightGeometry } from './verified-flight-geometry.mjs';
import { validateRegionalLocationStart } from '../regional-locations.mjs';
import { createWorldCollision } from '../world-collision.mjs';
import { boundedJSON, dataIdentity, exactKeys } from '../../../game/data-json.mjs';

const AXES = ['x', 'y', 'z'],
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
  geometryProfile = 'terrain-v1',
  scenery = null,
  geometryBudgets,
  spawnId,
  savedStart = null,
  initialHeading = 0,
  mode = 'self-level',
  response = DEFAULT_RESPONSE,
  continuous = false,
  prepareFrame = null,
} = {}) {
  const manifest = validateRegionManifest(input),
    planner = createRegionPlanner(manifest),
    rates = validateFlightResponse(response);
  fail(typeof continuous === 'boolean', 'Invalid continuous flight option');
  fail(prepareFrame === null || typeof prepareFrame === 'function', 'Invalid frame preparation');
  fail(['acro', 'self-level'].includes(mode), 'Unsupported prototype flight mode');
  const spawn = manifest.spawns.find((item) => item.id === (spawnId ?? manifest.spawns[0].id));
  fail(spawn, 'Unknown region spawn');
  const saved = savedStart === null ? null : validateRegionalLocationStart(savedStart, manifest);
  fail(
    initialHeading === 'region-centre' ||
      (Number.isSafeInteger(initialHeading) && initialHeading >= 0 && initialHeading < 36000),
    'Invalid initial regional heading',
  );
  const heading = saved
    ? saved.heading
    : initialHeading === 'region-centre'
      ? atan2(
          (manifest.grid.minX + manifest.grid.width / 2) * manifest.grid.cellSizeMm -
            spawn.position.x,
          spawn.position.z -
            (manifest.grid.minZ + manifest.grid.depth / 2) * manifest.grid.cellSizeMm,
        )
      : initialHeading;
  const halfHeading = Math.round(-heading / 2);
  const orientation = multiplyQuaternion([0, 0, 0, Q], [0, sin(halfHeading), 0, cos(halfHeading)]);
  const makeTerrain = () =>
    createVerifiedFlightGeometry(manifest, {
      profile: geometryProfile,
      source,
      scenery,
      budgets: geometryBudgets,
      retainCommitted: continuous,
    });
  let terrain = makeTerrain();
  const root = new THREE.Group(),
    dronePose = new THREE.Object3D(),
    cameraAnchor = new THREE.Object3D();
  root.add(dronePose, cameraAnchor);
  const unavailableMotion = Symbol('regional motion unavailable');
  const staticSweep = (from, delta, radius) => {
    const result = terrain.castMotion(from, delta, radius);
    if (result.status === 'motion-hit') return result.hit;
    if (result.status === 'motion-clear') return null;
    throw unavailableMotion;
  };
  let encounterCollision = null,
    encounterDescriptors = new Map(),
    encounterShapeVersioned = false,
    encounterMotions = [],
    acceptedEncounterMotion = null;
  let encounterPoolIdentity = null,
    restoring = null,
    restoringController = null;
  const environmentIdentity = () =>
    dataIdentity({
      format: 'RegionalEncounterEnvironment.v1',
      terrain: dataIdentity(manifest),
      scenery: scenery?.manifest ? dataIdentity(scenery.manifest) : null,
      geometryProfile,
      continuous,
      spawn: spawn.id,
      start: saved?.position ?? spawn.position,
      heading,
      mode,
      response: rates,
      encounterPool: encounterPoolIdentity,
    });
  const movingGeometry = (...args) => encounterCollision?.castMoving(...args) ?? null;
  let body = {
    position: { ...(saved?.position ?? spawn.position) },
    velocity: zero(),
    orientation,
    angular: { roll: 0, pitch: 0, yaw: 0 },
    ticks: 0,
    grounded: false,
    support: null,
    landingSpeed: 0,
    landingTilt: 0,
  };
  let status = 'paused',
    reason = 'terrain-required',
    origin = zero(),
    pendingTarget = { ...body.position },
    contacts = 0,
    recentres = 0;
  let generation = 0,
    disposed = false,
    pending = Promise.resolve();
  let streamingJob = null,
    streamingSettled = Promise.resolve(),
    streamingFailure = null,
    retryAfterTick = 0,
    preparationController = null;
  const live = () => fail(!disposed, 'Regional prototype is disposed');
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
    localPositionMm: Object.fromEntries(AXES.map((key) => [key, body.position[key] - origin[key]])),
    pendingTargetMm: pendingTarget && { ...pendingTarget },
    terrain: terrain.snapshot(),
    geometryProfile,
    streaming: {
      enabled: continuous,
      pending: Boolean(streamingJob),
      failure: streamingFailure,
    },
    model: 'regional-authoring-flight-prototype.v1',
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
    if (!continuous || streamingJob || status !== 'active' || body.ticks < retryAfterTick) return;
    const grid = manifest.grid,
      target = { ...body.position };
    for (const key of ['x', 'z']) {
      const min = grid[key === 'x' ? 'minX' : 'minZ'] * grid.cellSizeMm + RADIUS,
        max = min + grid[key === 'x' ? 'width' : 'depth'] * grid.cellSizeMm - 2 * RADIUS;
      // At most one cell ahead; the next 3×3 window still contains the current body.
      target[key] = Math.max(
        min,
        Math.min(
          max,
          body.position[key] + Math.max(-96000, Math.min(96000, body.velocity[key] * 3)),
        ),
      );
    }
    const plan = planner(target);
    if (plan.blocked || !plan.origin) {
      streamingFailure = plan.blocked ?? 'Background region is unavailable';
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
      if (disposed || token !== generation || status !== 'active')
        throw new DOMException('Background flight preparation cancelled', 'AbortError');
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
    streamingSettled = job.promise;
  }
  function prepare() {
    live();
    fail(!restoring, 'A regional recovery is pending');
    stopStreaming();
    preparationController?.abort();
    const controller = new AbortController();
    preparationController = controller;
    const target = { ...(pendingTarget ?? body.position) },
      token = ++generation;
    status = 'paused';
    reason = 'preparing-terrain';
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
            ...(saved && body.ticks === 0 ? { requireClearRestore: true } : {}),
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
                throw new DOMException('Prototype preparation cancelled', 'AbortError');
              const nextOrigin = provenance.originMm;
              if (AXES.some((key) => nextOrigin[key] !== origin[key])) recentres++;
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
        if (disposed || token !== generation || !terrain.snapshot().terrainReady)
          throw new DOMException('Prototype preparation cancelled', 'AbortError');
        if (body.ticks === 0) {
          const support = terrain.flightSupport(body.position, RADIUS, 5);
          if (support.status !== 'flight-support')
            throw new Error('Verified spawn support is unavailable');
          initializeFlightSupport(body, support.ground);
        }
        pendingTarget = null;
        streamingFailure = null;
        retryAfterTick = 0;
        reason = 'prepared';
        return snapshot();
      } catch (error) {
        if (!disposed && token === generation) {
          status = 'paused';
          reason = 'terrain-error';
        }
        throw error;
      } finally {
        if (preparationController === controller) preparationController = null;
      }
    })();
    pending = operation.catch(() => {});
    return operation;
  }
  function checkpoint() {
    live();
    fail(
      !restoring && !preparationController && !streamingJob && terrain.snapshot().terrainReady,
      'Prepare and pause the Regional flight before saving its encounter',
    );
    return {
      format: 'RegionalEncounterFlight.v2',
      identity: environmentIdentity(),
      body: structuredClone(body),
      mode,
      origin: { ...origin },
      contacts,
      recentres,
    };
  }
  function validateCheckpoint(input) {
    const value = boundedJSON(input, {
      maxBytes: 16384,
      maxNodes: 256,
      maxArray: 4,
      maxDepth: 6,
      maxString: 256,
    });
    exactKeys(
      value,
      ['format', 'identity', 'body', 'mode', 'origin', 'contacts', 'recentres'],
      'Regional encounter checkpoint',
    );
    fail(
      value.format === 'RegionalEncounterFlight.v2' &&
        value.identity === environmentIdentity() &&
        value.mode === mode,
      'Regional encounter checkpoint belongs to another environment',
    );
    const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
    const vector = (v, keys, limit, label) => {
      exactKeys(v, keys, label);
      fail(
        keys.every((key) => integer(v[key], -limit, limit)),
        `Invalid ${label}`,
      );
    };
    const next = value.body;
    exactKeys(
      next,
      [
        'position',
        'velocity',
        'orientation',
        'angular',
        'ticks',
        'grounded',
        'support',
        'landingSpeed',
        'landingTilt',
      ],
      'Regional body',
    );
    vector(next.position, AXES, 100000000, 'regional position');
    vector(next.velocity, AXES, 30000, 'regional velocity');
    vector(next.angular, ['roll', 'pitch', 'yaw'], 10000000, 'regional angular velocity');
    vector(value.origin, AXES, 100000000, 'regional origin');
    fail(
      integer(next.ticks, 0, Math.floor(Number.MAX_SAFE_INTEGER / 20000)) &&
        integer(value.contacts, 0, next.ticks * 1024) &&
        integer(value.recentres, 0, next.ticks + 1) &&
        integer(next.landingSpeed, 0, 100000) &&
        integer(next.landingTilt, 0, 18000) &&
        typeof next.grounded === 'boolean',
      'Invalid regional counters or landing state',
    );
    fail(
      Array.isArray(next.orientation) &&
        next.orientation.length === 4 &&
        next.orientation.every((n) => integer(n, -Q - 1, Q + 1)) &&
        Math.abs(Math.hypot(...next.orientation) - Q) < 4,
      'Invalid regional orientation',
    );
    const grid = manifest.grid,
      position = next.position;
    fail(
      position.x - RADIUS >= grid.minX * grid.cellSizeMm &&
        position.x + RADIUS <= (grid.minX + grid.width) * grid.cellSizeMm &&
        position.z - RADIUS >= grid.minZ * grid.cellSizeMm &&
        position.z + RADIUS <= (grid.minZ + grid.depth) * grid.cellSizeMm &&
        position.y >= grid.floorMm &&
        position.y + 2 * RADIUS <= grid.ceilingMm,
      'Regional recovery body leaves the region',
    );
    const bodyPlan = planner(position),
      originPlan = planner({ ...value.origin, y: position.y });
    fail(
      !bodyPlan.blocked &&
        !originPlan.blocked &&
        AXES.every((axis) => value.origin[axis] === originPlan.origin[axis]),
      'Invalid regional recovery window',
    );
    if (next.support !== null) {
      exactKeys(next.support, ['id', 'y', 'normal'], 'Regional support');
      vector(next.support.normal, AXES, Q, 'regional support normal');
      fail(
        next.grounded &&
          typeof next.support.id === 'string' &&
          next.support.id.length > 0 &&
          next.support.id.length <= 256 &&
          integer(next.support.y, grid.floorMm, grid.ceilingMm) &&
          Math.abs(next.support.y - position.y) <= 6 &&
          next.velocity.y === 0 &&
          next.support.normal.y >= 866025 &&
          Math.abs(Math.hypot(...AXES.map((axis) => next.support.normal[axis])) - Q) < 4,
        'Invalid regional support',
      );
    } else fail(!next.grounded, 'Grounded regional recovery requires support');
    return value;
  }
  async function restoreCheckpoint(input) {
    live();
    const value = validateCheckpoint(input);
    fail(
      status !== 'active' && !restoring && !preparationController && !streamingJob,
      'Pause before restoring a Regional encounter',
    );
    const controller = new AbortController(),
      candidate = makeTerrain();
    restoringController = controller;
    const token = generation;
    const current = () => {
      live();
      fail(!controller.signal.aborted && generation === token, 'Regional recovery cancelled');
    };
    const operation = (async () => {
      let adopted = false;
      try {
        await streamingSettled;
        current();
        await candidate.transition(
          { ...value.origin, y: value.body.position.y },
          { positionMm: value.body.position, radiusMm: RADIUS, requireClearRestore: true },
          {
            ...(prepareFrame
              ? {
                  async prepare({ group }) {
                    current();
                    await prepareFrame(group, { signal: controller.signal });
                    current();
                  },
                }
              : {}),
            commit() {
              current();
            },
            rollback() {},
          },
        );
        current();
        const support = candidate.flightSupport(value.body.position, RADIUS, 60);
        fail(
          support.status === 'flight-support',
          'Recovery support is not covered by verified terrain',
        );
        if (value.body.grounded)
          fail(
            support.ground &&
              Math.abs(support.ground.y - value.body.position.y) <= 6 &&
              support.ground.id === value.body.support.id &&
              AXES.every(
                (axis) =>
                  Math.abs(support.ground.normal[axis] - value.body.support.normal[axis]) <= 2,
              ),
            'Regional recovery support differs from verified terrain',
          );
        const previous = {
          terrain,
          body,
          origin,
          status,
          reason,
          pendingTarget,
          contacts,
          recentres,
          encounterMotions,
          acceptedEncounterMotion,
          streamingFailure,
          retryAfterTick,
        };
        const attached = candidate.group;
        try {
          root.add(attached);
          current();
          terrain = candidate;
          body = structuredClone(value.body);
          origin = { ...value.origin };
          status = 'paused';
          reason = 'prepared';
          pendingTarget = null;
          contacts = value.contacts;
          recentres = value.recentres;
          encounterMotions = [];
          acceptedEncounterMotion = null;
          streamingFailure = null;
          retryAfterTick = 0;
          updateFrame();
          current();
        } catch (error) {
          attached?.removeFromParent();
          ({
            terrain,
            body,
            origin,
            status,
            reason,
            pendingTarget,
            contacts,
            recentres,
            encounterMotions,
            acceptedEncounterMotion,
            streamingFailure,
            retryAfterTick,
          } = previous);
          if (disposed) {
            status = 'disposed';
            reason = null;
          }
          updateFrame();
          throw error;
        }
        adopted = true;
        previous.terrain.group?.removeFromParent();
        await previous.terrain.dispose();
        return snapshot();
      } finally {
        if (!adopted) await candidate.dispose();
        if (restoringController === controller) restoringController = null;
      }
    })();
    restoring = operation;
    try {
      return await operation;
    } finally {
      if (restoring === operation) restoring = null;
    }
  }
  return Object.freeze({
    get identity() {
      return { format: 'RegionalEncounterEnvironment.v1', configuration: environmentIdentity() };
    },
    snapshot,
    collisionSnapshot: () => terrain.collisionSnapshot(),
    encounterGeometry: () => ({
      castMotion: (...args) => terrain.castMotion(...args),
      support: (...args) => terrain.support(...args),
      motionCoverage: (...args) => terrain.motionCoverage(...args),
      ready: () => terrain.snapshot().terrainReady,
    }),
    configureEncounterActors(actors) {
      live();
      fail(body.ticks === 0 && status !== 'active', 'Configure encounter before arming');
      fail(
        Array.isArray(actors) && actors.length > 0 && actors.length <= 128,
        'Invalid combat actor pool',
      );
      const descriptors = new Map();
      for (const actor of actors) {
        const id = actor.slotId ?? actor.id;
        fail(
          typeof id === 'string' &&
            !descriptors.has(id) &&
            Number.isSafeInteger(actor.radius) &&
            actor.radius >= 100 &&
            actor.radius <= 2000 &&
            Number.isSafeInteger(actor.height) &&
            actor.height >= 100 &&
            actor.height <= 5000 &&
            ['x', 'y', 'z'].every((k) => Number.isFinite(actor.position?.[k])),
          'Invalid combat collider',
        );
        descriptors.set(id, structuredClone(actor));
      }
      const candidate = createWorldCollision({
        bounds: { min: { x: 0, y: 0, z: 0 } },
        obstacles: [],
      });
      try {
        for (const [id, actor] of descriptors) candidate.addActor({ ...actor, id });
      } catch (error) {
        candidate.dispose();
        throw error;
      }
      encounterCollision?.dispose();
      encounterCollision = candidate;
      encounterDescriptors = descriptors;
      encounterShapeVersioned = actors.some((a) => a.appearance?.archetype);
      encounterPoolIdentity = dataIdentity(
        actors.map((actor) => ({
          id: actor.slotId ?? actor.id,
          type: actor.type,
          position: actor.position,
          radius: actor.radius,
          height: actor.height,
        })),
      );
    },
    stageEncounterActors(proposal) {
      if (encounterShapeVersioned || proposal?.actors !== undefined) {
        fail(
          Array.isArray(proposal?.actors) &&
            proposal.actors.length === encounterDescriptors.size &&
            new Set(proposal.actors.map((a) => a.slotId ?? a.id)).size ===
              encounterDescriptors.size,
          'Invalid combat proposal',
        );
        for (const actor of proposal.actors) {
          const admitted = encounterDescriptors.get(actor.slotId ?? actor.id);
          fail(
            admitted &&
              admitted.type === actor.type &&
              admitted.radius === actor.radius &&
              admitted.height === actor.height,
            'Combat collider differs from its admitted slot',
          );
        }
      }
      fail(
        Array.isArray(proposal.motions) &&
          (!encounterShapeVersioned ||
            (proposal.motions.length === encounterDescriptors.size &&
              new Set(proposal.motions.map((m) => m.id)).size === encounterDescriptors.size)) &&
          proposal.motions.every(
            (m) =>
              encounterDescriptors.has(m.id) &&
              (m.enabled === undefined || typeof m.enabled === 'boolean') &&
              ['from', 'to'].every((p) => ['x', 'y', 'z'].every((k) => Number.isFinite(m[p]?.[k]))),
          ),
        'Invalid combat motion',
      );
      encounterMotions = structuredClone(proposal.motions);
    },
    encounterMotion: () => structuredClone(acceptedEncounterMotion),
    encounterCheckpoint: checkpoint,
    restoreEncounterCheckpoint: restoreCheckpoint,
    root,
    dronePose,
    cameraAnchor,
    prepare,
    arm(input = neutral()) {
      live();
      const command = quantizeFlightInput(input);
      if (
        restoring ||
        reason !== 'prepared' ||
        !terrain.snapshot().terrainReady ||
        command.throttle > 50 ||
        ['pitch', 'roll', 'yaw'].some((key) => Math.abs(command[key]) > 100)
      )
        return false;
      status = 'active';
      reason = null;
      return true;
    },
    pause() {
      live();
      stopStreaming();
      if (status === 'active') {
        status = 'paused';
        reason = 'prepared';
      }
    },
    cancelPreparation() {
      live();
      restoringController?.abort();
      stopStreaming();
      preparationController?.abort();
      generation++;
      terrain.cancel();
      status = 'paused';
      reason = 'terrain-required';
      pendingTarget ??= { ...body.position };
    },
    setMode(value) {
      live();
      fail(
        !restoring && status !== 'active' && ['acro', 'self-level'].includes(value),
        'Pause before changing prototype flight mode',
      );
      mode = value;
    },
    step(input) {
      live();
      const command = quantizeFlightInput(input);
      if (restoring || status !== 'active') return snapshot();
      if (!terrain.snapshot().terrainReady) {
        status = 'paused';
        reason = 'terrain-required';
        return snapshot();
      }
      const next = candidateStep(body, command, mode, rates);
      acceptedEncounterMotion = null;
      const incomingVelocity = { ...next.velocity };
      const impactSpeed = isqrt(
        AXES.reduce((sum, key) => sum + next.velocity[key] * next.velocity[key], 0),
      );
      const grid = manifest.grid;
      if (
        next.position.x - RADIUS < grid.minX * grid.cellSizeMm ||
        next.position.x + RADIUS > (grid.minX + grid.width) * grid.cellSizeMm ||
        next.position.z - RADIUS < grid.minZ * grid.cellSizeMm ||
        next.position.z + RADIUS > (grid.minZ + grid.depth) * grid.cellSizeMm ||
        next.position.y + 2 * RADIUS > grid.ceilingMm
      ) {
        status = 'paused';
        reason = 'region-edge';
        return snapshot();
      }
      let plan;
      try {
        plan = planner(next.position);
      } catch {
        status = 'paused';
        reason = 'region-edge';
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
          status = 'paused';
          reason = 'terrain-required';
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
          encounterMotions,
          staticSweep,
          movingGeometry,
        );
      } catch (error) {
        if (error !== unavailableMotion) throw error;
        pendingTarget = { ...next.position };
        status = 'paused';
        reason = 'terrain-required';
        return snapshot();
      }
      next.position = moved.position;
      for (const hit of moved.contacts) {
        next.velocity = projectContactVelocity(next.velocity, hit);
      }
      const support = terrain.flightSupport(next.position, RADIUS, 60);
      if (support.status !== 'flight-support') {
        pendingTarget = { ...next.position };
        status = 'paused';
        reason = 'terrain-required';
        return snapshot();
      }
      applyFlightSupport(next, support.ground, body.grounded, impactSpeed);
      acceptedEncounterMotion = {
        trace: [
          { position: { ...body.position }, velocity: incomingVelocity },
          { position: { ...next.position }, velocity: incomingVelocity },
        ],
        contacts: moved.contacts
          .filter((hit) => hit.moving)
          .map((hit) => {
            const motion = encounterMotions.find((row) => row.id === hit.id);
            return {
              actorId: hit.id,
              normal: hit.normal,
              relativeNormalSpeedMmS: Math.max(
                0,
                -AXES.reduce(
                  (sum, key) =>
                    sum +
                    ((incomingVelocity[key] -
                      (motion ? (motion.to[key] - motion.from[key]) * 50 : 0)) *
                      hit.normal[key]) /
                      Q,
                  0,
                ),
              ),
            };
          }),
      };
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
        restoringController?.abort();
        streamingJob?.controller.abort();
        generation++;
        status = 'disposed';
        reason = null;
        terrain.cancel();
        root.clear();
        encounterCollision?.dispose();
        root.removeFromParent();
      }
      await pending;
      await restoring?.catch(() => {});
      await terrain.dispose();
    },
  });
}
