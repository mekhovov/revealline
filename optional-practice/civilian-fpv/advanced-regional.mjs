import * as THREE from './vendor/three.module.js';
import { attitude, atan2, Q } from './math.mjs';
import { dataIdentity } from '../../game/data-json.mjs';
import { createRateProfile, validateRateProfile } from './rates.mjs';
import { createAdvancedWorkerClient } from './advanced-worker-client.mjs';
import { createAdvancedTerrainFrame } from './advanced-terrain.mjs';
import {
  ADVANCED_MAX_SECONDS,
  ADVANCED_MISSION_HZ,
  validateAdvancedAircraft,
  createAdvancedAircraftTune,
} from './advanced-simulation.mjs';
import { validateAdvancedTune } from './advanced-controller.mjs';
import {
  validateAircraftPhysics,
  createAircraftControllerTune,
  validateAircraftControllerTune,
} from './aircraft-physics.mjs';
import { createAircraftResponseDescriptor } from './aircraft-response.mjs';
import { createTunedResponse } from './flight-response.mjs';
import { validateRegionManifest, createRegionPlanner } from './regional/region-manifest.mjs';
import { createVerifiedFlightGeometry } from './regional/verified-flight-geometry.mjs';
import { validateRegionalLocationStart } from './regional-locations.mjs';

const axes = ['x', 'y', 'z'];
// Match the verified support-pose tolerance while retaining Rapier's actual pose.
// Terrain may lie exactly on a region's vertical bound; contact slop is not an escape.
const verticalContactToleranceMm = 1;
const zero = () => ({ x: 0, y: 0, z: 0 });
const neutral = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
const clone = (value) => structuredClone(value);
const abort = () => new DOMException('Regional Advanced operation was cancelled', 'AbortError');
const requireValue = (condition, message) => {
  if (!condition) throw new TypeError(message);
};

/** Verified Regional terrain and the dedicated Advanced worker share one admission
 * boundary. Rapier resolves contacts against the exact admitted collision meshes;
 * unavailable cells and region edges still reject the entire mission interval. */
export function createAdvancedRegionalSession(
  configuration,
  { createClient = createAdvancedWorkerClient, createGeometry = createVerifiedFlightGeometry } = {},
) {
  const manifest = validateRegionManifest(configuration.manifest);
  const planner = createRegionPlanner(manifest);
  const spawn = manifest.spawns.find(
    (item) => item.id === (configuration.spawnId ?? manifest.spawns[0].id),
  );
  requireValue(spawn, 'Unknown regional starting point');
  const saved = configuration.savedStart
    ? validateRegionalLocationStart(configuration.savedStart, manifest)
    : null;
  const frame = clone(saved?.position ?? spawn.position);
  const heading =
    saved?.heading ??
    (configuration.initialHeading === 'region-centre'
      ? atan2(
          (manifest.grid.minX + manifest.grid.width / 2) * manifest.grid.cellSizeMm - frame.x,
          frame.z - (manifest.grid.minZ + manifest.grid.depth / 2) * manifest.grid.cellSizeMm,
        )
      : (configuration.initialHeading ?? 0));
  requireValue(
    Number.isSafeInteger(heading) && heading >= 0 && heading < 36000,
    'Invalid Regional Advanced heading',
  );
  const angle = (-heading * Math.PI) / 18000;
  const headingRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    angle,
  );
  const rotate = (value) => ({
    x: Math.cos(angle) * value.x + Math.sin(angle) * value.z,
    y: value.y,
    z: -Math.sin(angle) * value.x + Math.cos(angle) * value.z,
  });
  const globalPoint = (value) => {
    const point = rotate(value);
    return Object.fromEntries(axes.map((key) => [key, frame[key] + point[key] * 1000]));
  };
  const aircraftPhysics = configuration.advanced?.aircraft?.format === 'AdvancedAircraft.v2';
  const airframe = aircraftPhysics
    ? validateAircraftPhysics(configuration.advanced.aircraft)
    : validateAdvancedAircraft(configuration.advanced?.aircraft ?? 'freestyle');
  const controller = aircraftPhysics
    ? validateAircraftControllerTune(
        configuration.advanced.controller ?? createAircraftControllerTune(airframe),
      )
    : validateAdvancedTune(
        configuration.advanced?.controller ?? createAdvancedAircraftTune(airframe),
      );
  const mode = aircraftPhysics ? (configuration.mode ?? 'acro') : 'acro';
  requireValue(['acro', 'self-level'].includes(mode), 'Invalid Regional aircraft flight mode');
  const radius = Math.ceil(airframe.radius * 1000);
  const profile = validateRateProfile(configuration.rateProfile ?? createRateProfile());
  const response = aircraftPhysics
    ? createAircraftResponseDescriptor(configuration.response ?? createTunedResponse(profile), {
        mode,
      })
    : null;
  const environment = {
    model: aircraftPhysics ? 'regional-aircraft-contact.v1' : 'regional-advanced-contact.v1',
    terrain: dataIdentity(manifest),
    scenery: configuration.scenery ? dataIdentity(configuration.scenery.manifest) : null,
    geometryProfile: configuration.geometryProfile ?? 'terrain-v1',
    frame,
    heading,
    contact: 'rapier-verified-mesh.v1',
  };
  const options = {
    aircraft: airframe,
    controller,
    ...(aircraftPhysics ? { response } : { rateProfile: profile }),
    // Explicit air start gives motor spin-up time without an invented ground plane.
    spawn: { x: 0, y: 2, z: 0 },
    floor: false,
    terrain: { format: 'AdvancedRegionalTerrain.v1' },
    configuration: { environment },
  };
  const terrain = createGeometry(manifest, {
    profile: environment.geometryProfile,
    source: configuration.source,
    scenery: configuration.scenery ?? null,
    budgets: configuration.geometryBudgets,
    retainCommitted: true,
  });
  const root = new THREE.Group();
  let client = null,
    initialized = false,
    disposed = false,
    sequence = 0;
  let status = 'paused',
    reason = 'terrain-required',
    failure = null,
    flightStopReason = null;
  let origin = zero(),
    recentres = 0,
    generation = 0;
  let pendingTarget = globalPoint(options.spawn),
    preparation = null,
    preparingController = null;
  let stepJob = null,
    streamingJob = null,
    retryAfterTick = 0,
    streamingFailure = null;
  let sourceFrameIdentity = null,
    frameJob = null,
    frameCommitOwner = null,
    recoveryJob = null,
    recoveryClient = null,
    recoveryVerification = null,
    checkpointJob = null,
    checkpointKind = null,
    archiveGeneration = 0;
  const archiveEnvelope = (value) => ({
    ...value,
    generation: `${archiveGeneration}:${value.generation}`,
  });
  let telemetry = {
    missionTick: 0,
    seconds: 0,
    position: clone(options.spawn),
    velocity: zero(),
    orientation: { x: 0, y: 0, z: 0, w: 1 },
    achievedRates: { roll: 0, pitch: 0, yaw: 0 },
    calibratedInput: neutral(),
  };
  const live = () => requireValue(!disposed, 'Regional Advanced session is disposed');
  const centre = () => globalPoint(telemetry.position);
  const supportPose = (currentTelemetry = telemetry) => {
    // The new worker validates the complete collider hull before a terrain
    // transaction can commit. The historical sphere-only restore proof would
    // reject a flat aircraft resting on the ground and is not its geometry.
    if (aircraftPhysics) return null;
    const point = globalPoint(currentTelemetry.position);
    return {
      positionMm: { ...point, y: point.y - radius },
      radiusMm: radius,
      requireClearRestore: true,
    };
  };
  function snapshot() {
    const point = centre(),
      velocity = rotate(telemetry.velocity);
    // Legacy renderers use their historical 220 mm offset. Aircraft snapshots
    // carry the actual support height so body and camera stay at the COM pose.
    const supportHeightMm = aircraftPhysics
      ? (telemetry.supportHeight ?? airframe.geometry.bodyHalfExtents.y) * 1000
      : 220;
    const position = { ...point, y: point.y - supportHeightMm };
    const quaternion = headingRotation
      .clone()
      .multiply(new THREE.Quaternion().copy(telemetry.orientation));
    const orientation = quaternion.toArray().map((value) => Math.round(value * Q));
    const angles = attitude(orientation);
    return {
      position,
      velocity: Object.fromEntries(axes.map((key) => [key, Math.round(velocity[key] * 1000)])),
      orientation,
      attitude: angles,
      angular: Object.fromEntries(
        ['roll', 'pitch', 'yaw'].map((key) => [
          key,
          Math.round(telemetry.achievedRates[key] * 100),
        ]),
      ),
      ticks: telemetry.missionTick,
      mode,
      status,
      reason,
      failure,
      contacts: telemetry.terrain?.contacts ?? 0,
      recentres,
      grounded: telemetry.terrain?.grounded ?? false,
      support: telemetry.terrain?.grounded
        ? {
            normal: rotate(telemetry.terrain.normal ?? { x: 0, y: 1, z: 0 }),
          }
        : null,
      landingSpeed: Math.round((telemetry.terrain?.impactSpeed ?? 0) * 1000),
      landingTilt: aircraftPhysics ? atan2(Math.hypot(angles.up.x, angles.up.z), angles.up.y) : 0,
      lastInput: Object.fromEntries(
        Object.entries(telemetry.calibratedInput).map(([key, value]) => [
          key,
          Math.round(value * 1000),
        ]),
      ),
      originMm: { ...origin },
      localPositionMm: Object.fromEntries(axes.map((key) => [key, position[key] - origin[key]])),
      pendingTargetMm: pendingTarget && { ...pendingTarget },
      terrain: terrain.snapshot(),
      geometryProfile: environment.geometryProfile,
      streaming: { enabled: true, pending: Boolean(streamingJob), failure: streamingFailure },
      model: environment.model,
      unscored: true,
      playerReady: false,
      advanced: true,
      advancedTelemetry: {
        ...clone(telemetry),
        ...(telemetry.archiveStatus
          ? { archiveStatus: archiveEnvelope(telemetry.archiveStatus) }
          : {}),
      },
      ...(aircraftPhysics
        ? {
            aircraftRadiusMm: radius,
            aircraftSupportHeightMm: supportHeightMm,
            recordingStatus: clone(telemetry.recordingStatus ?? null),
          }
        : {}),
      step: 0,
      total: 0,
      hold: 0,
      events: [],
      actors: [],
      projectiles: [],
      score: 0,
    };
  }
  function stopStreaming() {
    if (!streamingJob) return;
    streamingJob.controller.abort();
    streamingJob = null;
    terrain.cancel();
  }
  function stopAtFlightLimit(error) {
    if (aircraftPhysics) return false;
    // Only the worker's explicit rolled-back quota contract is recoverable.
    // Similar-looking freeform messages and unknown codes remain failures.
    const limitReason =
      error.code === 'ADVANCED_DURATION_LIMIT'
        ? 'duration-limit'
        : error.code === 'ADVANCED_RECORDING_LIMIT'
          ? 'recording-limit'
          : null;
    if (!limitReason) return false;
    flightStopReason = limitReason;
    status = 'paused';
    reason = limitReason;
    failure = error.message;
    stopStreaming();
    return true;
  }
  function workerFrame(verified) {
    requireValue(
      verified && Array.isArray(verified.colliders),
      'Verified collision frame is required',
    );
    const cosine = Math.cos(angle),
      sine = Math.sin(angle);
    return createAdvancedTerrainFrame({
      sourceIdentity: verified.sourceIdentity,
      colliders: verified.colliders.map(({ id, vertices, indices, translation }) => {
        const result = [];
        for (let index = 0; index < vertices.length; index += 3) {
          const x = (verified.originMm.x - frame.x) / 1000 + translation.x + vertices[index];
          const y = (verified.originMm.y - frame.y) / 1000 + translation.y + vertices[index + 1];
          const z = (verified.originMm.z - frame.z) / 1000 + translation.z + vertices[index + 2];
          result.push(cosine * x - sine * z, y, sine * x + cosine * z);
        }
        return { id, vertices: result, indices };
      }),
    });
  }
  function transition(target, parameters) {
    const preceding = frameJob,
      checkpointAtDispatch = checkpointJob;
    const operation = (async () => {
      // A cancelled preparation must roll back its staged worker frame before a
      // newer prepare/recovery may acquire the shared source and worker owners.
      await preceding?.catch(() => {});
      await checkpointAtDispatch;
      parameters.current();
      return transitionFrame(target, parameters);
    })();
    frameJob = operation;
    void operation
      .finally(() => {
        if (frameJob === operation) frameJob = null;
      })
      .catch(() => {});
    return operation;
  }
  async function transitionFrame(
    target,
    { signal, current, pose = supportPose, targetClient = client },
  ) {
    const previousOrigin = origin,
      previousRecentres = recentres,
      previousFrameIdentity = sourceFrameIdentity;
    const frameOwner = Symbol('regional-frame');
    let attached = null,
      staged = null,
      result = null;
    try {
      await terrain.transition(target, pose(), {
        async prepare({ group, collisionFrame }) {
          current();
          await configuration.prepareFrame?.(group, { signal });
          while (stepJob) await stepJob;
          current();
          frameCommitOwner = frameOwner;
          requireValue(
            typeof collisionFrame === 'function',
            'Verified collision frame is unavailable',
          );
          staged = await targetClient.stageTerrainFrame(workerFrame(collisionFrame()));
          current();
        },
        ...(!aircraftPhysics
          ? {
              readPose() {
                current();
                const { positionMm, radiusMm } = pose();
                return { positionMm, radiusMm };
              },
            }
          : {}),
        commit({ group, provenance }) {
          current();
          origin = { ...provenance.originMm };
          if (axes.some((key) => previousOrigin[key] !== origin[key])) recentres++;
          sourceFrameIdentity = staged.identity;
          attached = group;
          root.add(group);
        },
        rollback() {
          attached?.removeFromParent();
          attached = null;
          origin = previousOrigin;
          recentres = previousRecentres;
          sourceFrameIdentity = previousFrameIdentity;
        },
      });
      current();
    } finally {
      try {
        if (staged && !disposed) {
          // Source publication is synchronous after commit(). A cancellation
          // during subsequent cleanup still retains this published frame; a
          // rejected source adoption leaves attached null and restores physics.
          result = await targetClient.commitTerrainFrame({
            transaction: staged.transaction,
            accepted: Boolean(attached),
          });
          if (targetClient === client) telemetry = result.telemetry;
        }
      } catch (error) {
        if (!disposed) {
          status = 'paused';
          reason = 'worker-error';
          failure = error.message;
        }
        throw error;
      } finally {
        if (frameCommitOwner === frameOwner) frameCommitOwner = null;
      }
    }
    return result?.telemetry;
  }
  function prefetch() {
    if (disposed || status !== 'active' || streamingJob || telemetry.missionTick < retryAfterTick)
      return;
    const point = centre(),
      velocity = rotate(telemetry.velocity),
      grid = manifest.grid;
    const target = { ...point };
    for (const key of ['x', 'z']) {
      const lower = grid[key === 'x' ? 'minX' : 'minZ'] * grid.cellSizeMm + radius;
      const upper = lower + grid[key === 'x' ? 'width' : 'depth'] * grid.cellSizeMm - 2 * radius;
      target[key] = Math.max(
        lower,
        Math.min(upper, point[key] + Math.max(-96000, Math.min(96000, velocity[key] * 3000))),
      );
    }
    const plan = planner(target);
    if (plan.blocked || !plan.origin || axes.every((key) => plan.origin[key] === origin[key]))
      return;
    const job = { controller: new AbortController() },
      token = generation;
    streamingJob = job;
    const current = () => {
      if (disposed || token !== generation || streamingJob !== job || status !== 'active')
        throw abort();
    };
    job.promise = transition(target, { signal: job.controller.signal, current })
      .catch((error) => {
        if (!disposed && streamingJob === job && token === generation) {
          if (stopAtFlightLimit(error)) return;
          streamingFailure = error.message;
          retryAfterTick = telemetry.missionTick + 100;
        }
      })
      .finally(() => {
        if (streamingJob === job) streamingJob = null;
      });
  }
  function pause() {
    live();
    generation++;
    stopStreaming();
    if (recoveryJob) preparingController?.abort();
    if (status === 'active') {
      status = 'paused';
      reason = 'prepared';
    }
  }
  async function prepare() {
    live();
    pause();
    preparingController?.abort();
    if (flightStopReason) return snapshot();
    const token = generation,
      controller = new AbortController();
    preparingController = controller;
    const current = () => {
      if (disposed || generation !== token || controller.signal.aborted) throw abort();
    };
    reason = 'preparing-terrain';
    failure = null;
    const operation = (async () => {
      try {
        await stepJob;
        await recoveryJob?.catch(() => {});
        await frameJob?.catch(() => {});
        current();
        if (flightStopReason) return snapshot();
        if (!initialized) {
          client ??= createClient();
          telemetry = (await client.initialize(clone(options))).telemetry;
          current();
          initialized = true;
        }
        const target = { ...(pendingTarget ?? centre()) };
        await transition(target, { signal: controller.signal, current });
        current();
        requireValue(terrain.snapshot().terrainReady, 'Regional terrain is unavailable');
        pendingTarget = null;
        streamingFailure = null;
        retryAfterTick = 0;
        reason = 'prepared';
        return snapshot();
      } catch (error) {
        if (!disposed && token === generation && stopAtFlightLimit(error)) return snapshot();
        if (!disposed && token === generation && !flightStopReason && reason !== 'worker-error') {
          reason = 'terrain-error';
          failure = error.message;
        }
        throw error;
      } finally {
        if (preparingController === controller) preparingController = null;
      }
    })();
    preparation = operation;
    return operation;
  }
  function admit(trace) {
    requireValue(Array.isArray(trace) && trace.length >= 2, 'Incomplete Regional Advanced trace');
    const grid = manifest.grid;
    let from = null;
    for (const local of trace) {
      requireValue(
        local && axes.every((key) => Number.isFinite(local[key])),
        'Invalid Regional Advanced trace',
      );
      const point = globalPoint(local);
      const lowerExtent = aircraftPhysics ? local.supportHeight * 1000 : radius;
      const upperExtent = aircraftPhysics ? local.topHeight * 1000 : radius;
      requireValue(
        Number.isFinite(lowerExtent) &&
          Number.isFinite(upperExtent) &&
          lowerExtent >= 0 &&
          upperExtent >= 0,
        'Incomplete aircraft hull bounds',
      );
      if (
        point.x - radius < grid.minX * grid.cellSizeMm ||
        point.x + radius > (grid.minX + grid.width) * grid.cellSizeMm ||
        point.z - radius < grid.minZ * grid.cellSizeMm ||
        point.z + radius > (grid.minZ + grid.depth) * grid.cellSizeMm ||
        point.y - lowerExtent < grid.floorMm - verticalContactToleranceMm ||
        point.y + upperExtent > grid.ceilingMm + verticalContactToleranceMm
      )
        return { accepted: false, reason: 'region-edge' };
      if (from) {
        const query = terrain.motionCoverage(
          from,
          Object.fromEntries(axes.map((key) => [key, point[key] - from[key]])),
          radius,
        );
        if (query.status !== 'motion-covered')
          return { accepted: false, reason: 'terrain-required', target: point };
      }
      from = point;
    }
    return { accepted: true };
  }
  function step(input) {
    live();
    if (stepJob) return stepJob;
    if (status !== 'active' || frameCommitOwner || recoveryJob || checkpointJob)
      return Promise.resolve(snapshot());
    const controls = Object.fromEntries(
      ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [key, input[key]]),
    );
    requireValue(
      ['roll', 'pitch', 'yaw'].every(
        (key) => Number.isFinite(controls[key]) && Math.abs(controls[key]) <= 1,
      ) &&
        Number.isFinite(controls.throttle) &&
        controls.throttle >= 0 &&
        controls.throttle <= 1,
      'Regional input must be normalized',
    );
    const token = generation;
    const sample = {
      sequence: sequence++,
      timestampUs: Math.round(telemetry.seconds * 1e6),
      controls,
    };
    const job = (async () => {
      try {
        const proposal = await client.propose(sample);
        if (disposed) return snapshot();
        let decision = { accepted: false };
        try {
          if (token === generation && status === 'active') decision = admit(proposal.trace);
        } catch (error) {
          await client.commit({ transaction: proposal.transaction, accepted: false });
          throw error;
        }
        const result = await client.commit({
          transaction: proposal.transaction,
          accepted: decision.accepted,
        });
        if (disposed) return snapshot();
        // An already dispatched commit linearizes before a later pause. Its
        // final pose is retained, but a late response can never re-arm the host.
        telemetry = result.telemetry;
        if (!decision.accepted && token === generation) {
          status = 'paused';
          reason = decision.reason ?? 'prepared';
          pendingTarget = decision.target ?? null;
          stopStreaming();
        }
        if (token === generation && status === 'active') prefetch();
        return snapshot();
      } catch (error) {
        if (!disposed) {
          if (stopAtFlightLimit(error)) return snapshot();
          status = 'paused';
          reason = 'worker-error';
          failure = error.message;
          stopStreaming();
        }
        throw error;
      } finally {
        if (stepJob === job) stepJob = null;
      }
    })();
    stepJob = job;
    return job;
  }
  function readArchive(afterIndex = -1, finalize = false) {
    live();
    requireValue(aircraftPhysics && initialized && !recoveryJob, 'Aircraft archive is not ready');
    requireValue(!finalize || status !== 'active', 'Pause before ending the session archive');
    if (checkpointJob) return checkpointJob.then(() => readArchive(afterIndex, finalize));
    const pendingStep = stepJob,
      pendingFrame = frameJob;
    checkpointKind = 'archive';
    const operation = (async () => {
      await pendingStep;
      await pendingFrame;
      live();
      requireValue(!finalize || status !== 'active', 'Pause before ending the session archive');
      const result = await (finalize
        ? client.finalizeArchive(afterIndex)
        : client.readSealedSegment(afterIndex));
      telemetry.archiveStatus = {
        generation: result.generation,
        origin: result.origin,
        earliestIndex: result.earliestIndex,
        lastSealedIndex: result.lastSealedIndex,
        latestTick: result.latestTick,
      };
      return archiveEnvelope(result);
    })();
    checkpointJob = operation;
    void operation
      .finally(() => {
        if (checkpointJob === operation) {
          checkpointJob = null;
          checkpointKind = null;
        }
      })
      .catch(() => {});
    return operation;
  }
  return Object.freeze({
    root,
    snapshot,
    prepare,
    pause,
    step,
    stepPending: () => Boolean(stepJob || checkpointJob),
    arm(input = neutral()) {
      live();
      if (
        !initialized ||
        flightStopReason ||
        reason !== 'prepared' ||
        sourceFrameIdentity !== telemetry.terrain?.frameIdentity ||
        stepJob ||
        frameCommitOwner ||
        frameJob ||
        recoveryJob ||
        checkpointJob ||
        !terrain.snapshot().terrainReady ||
        !Number.isFinite(input?.throttle) ||
        input.throttle < 0 ||
        input.throttle > 0.05 ||
        ['pitch', 'roll', 'yaw'].some(
          (key) => !Number.isFinite(input?.[key]) || Math.abs(input[key]) > 0.1,
        )
      )
        return false;
      status = 'active';
      reason = null;
      return true;
    },
    cancelPreparation() {
      live();
      const recovering = Boolean(recoveryJob);
      const verificationOnly = recovering && preparingController === recoveryVerification;
      pause();
      preparingController?.abort();
      if (flightStopReason) return;
      if (!verificationOnly) terrain.cancel();
      // A detached verifier has not changed the admitted live terrain/flight.
      // Its finally path marks terrain-required if publication did begin.
      if (!recovering) {
        reason = 'terrain-required';
        pendingTarget ??= centre();
      }
    },
    async recording() {
      live();
      await stepJob;
      await frameJob;
      live();
      return client.recording();
    },
    readSealedSegment: (afterIndex) => readArchive(afterIndex),
    finalizeArchive: (afterIndex) => readArchive(afterIndex, true),
    exportRecovery() {
      live();
      requireValue(aircraftPhysics, 'Continuous recovery requires the aircraft backend');
      requireValue(initialized && !recoveryJob, 'Aircraft recovery is not ready');
      if (checkpointJob)
        return checkpointKind === 'save'
          ? checkpointJob
          : checkpointJob.then(() => this.exportRecovery());
      // Lock new missions and terrain transitions until the already accepted
      // interval has drained and its complete worker checkpoint is captured.
      // Capture owners before yielding so later transitions cannot create a
      // checkpoint/frame wait cycle.
      const pendingStep = stepJob,
        pendingFrame = frameJob;
      const operation = (async () => {
        await pendingStep;
        await pendingFrame;
        live();
        return {
          format: 'AdvancedRegionalRecovery.v2',
          environment: clone(environment),
          simulation: await client.snapshot(),
        };
      })();
      checkpointJob = operation;
      checkpointKind = 'save';
      void operation
        .finally(() => {
          if (checkpointJob === operation) {
            checkpointJob = null;
            checkpointKind = null;
          }
        })
        .catch(() => {});
      return operation;
    },
    async reportPersistence(report) {
      live();
      if (!aircraftPhysics || !client?.reportPersistence) return null;
      const next = await client.reportPersistence(report);
      if (!disposed && next) telemetry.recordingStatus = clone(next);
      return next;
    },
    async captureRecovery() {
      live();
      requireValue(status !== 'active', 'Pause before capturing Regional Advanced recovery');
      await stepJob;
      await frameJob;
      live();
      return {
        format: aircraftPhysics ? 'AdvancedRegionalRecovery.v2' : 'AdvancedRegionalRecovery.v1',
        environment: clone(environment),
        simulation: await client.snapshot(),
      };
    },
    async restoreRecovery(savedState, { signal } = {}) {
      live();
      await checkpointJob;
      live();
      if (signal?.aborted) throw abort();
      requireValue(!recoveryJob, 'Regional Advanced recovery is already pending');
      const saved = clone(savedState);
      requireValue(
        saved?.format ===
          (aircraftPhysics ? 'AdvancedRegionalRecovery.v2' : 'AdvancedRegionalRecovery.v1') &&
          dataIdentity(saved.environment) === dataIdentity(environment),
        'Regional Advanced recovery belongs to another region or start',
      );
      requireValue(initialized, 'Prepare Regional Advanced before recovery');
      pause();
      const token = generation,
        controller = new AbortController();
      const current = () => {
        if (disposed || token !== generation || controller.signal.aborted) throw abort();
      };
      const cancelRestore = () => controller.abort();
      signal?.addEventListener('abort', cancelRestore, { once: true });
      if (signal?.aborted) cancelRestore();
      preparingController = controller;
      recoveryVerification = controller;
      const operation = (async () => {
        let candidate = null;
        const cancelVerification = () => candidate?.dispose(abort());
        controller.signal.addEventListener('abort', cancelVerification, { once: true });
        try {
          await stepJob;
          await frameJob?.catch(() => {});
          current();
          // A detached worker keeps failed/stale recovery from modifying the
          // live controller, input cursor, motors, battery or recording.
          candidate = createClient();
          recoveryClient = candidate;
          await candidate.initialize(clone(options));
          current();
          const restored = await candidate.restore(saved.simulation);
          current();
          // Once verified, terrain adoption owns its existing commit/rollback
          // cleanup. Cancellation during replay instead terminates its CPU owner.
          controller.signal.removeEventListener('abort', cancelVerification);
          if (recoveryVerification === controller) recoveryVerification = null;
          const adopted = await transition(globalPoint(restored.position), {
            signal: controller.signal,
            current,
            pose: () => supportPose(restored),
            targetClient: candidate,
          });
          current();
          const previous = client;
          client = candidate;
          archiveGeneration++;
          candidate = null;
          telemetry = adopted ?? restored;
          sequence =
            (aircraftPhysics
              ? saved.simulation.checkpoint.state.acceptedSequence
              : saved.simulation.state.acceptedSequence) + 1;
          pendingTarget = null;
          flightStopReason =
            !aircraftPhysics && telemetry.missionTick >= ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ
              ? 'duration-limit'
              : null;
          reason = flightStopReason ?? 'prepared';
          failure = null;
          previous.dispose();
          return snapshot();
        } finally {
          signal?.removeEventListener('abort', cancelRestore);
          controller.signal.removeEventListener('abort', cancelVerification);
          if (recoveryVerification === controller) recoveryVerification = null;
          candidate?.dispose();
          if (
            !disposed &&
            !flightStopReason &&
            reason !== 'worker-error' &&
            sourceFrameIdentity !== telemetry.terrain?.frameIdentity
          ) {
            status = 'paused';
            reason = 'terrain-required';
            pendingTarget = centre();
          }
          recoveryClient = null;
          if (preparingController === controller) preparingController = null;
          if (recoveryJob === operation) recoveryJob = null;
        }
      })();
      recoveryJob = operation;
      return operation;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      status = 'disposed';
      reason = null;
      preparingController?.abort();
      stopStreaming();
      terrain.cancel();
      client?.dispose();
      recoveryClient?.dispose();
      await Promise.allSettled([stepJob, preparation, recoveryJob, frameJob, checkpointJob]);
      root.clear();
      root.removeFromParent();
      await terrain.dispose();
    },
  });
}
