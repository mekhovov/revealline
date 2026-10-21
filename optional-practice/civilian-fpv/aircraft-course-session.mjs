import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';
import { createFlight } from './model.mjs';
import { createAdvancedWorkerClient } from './advanced-worker-client.mjs';
import { createAircraftTerrainFrame } from './aircraft-terrain.mjs';
import { attitude, Q } from './math.mjs';
import { relativeFlightTilt } from './flight-support.mjs';
import { validateAircraftChallengeRules } from './aircraft-challenge.mjs';

const axes = ['x', 'y', 'z'];
const LEGACY_MISSION_MODEL = 'aircraft-course-practice.v1';
const CURRENT_MISSION_MODEL = 'aircraft-course-practice.v2';
const FLOOR_CONTACT_TOLERANCE_METRES = 0.003;
const copy = (value) => structuredClone(value);
const point = (value, scale = 1) =>
  Object.fromEntries(axes.map((key) => [key, value[key] * scale]));
const rounded = (value, scale = 1) =>
  Object.fromEntries(axes.map((key) => [key, Math.round(value[key] * scale)]));
const indices = [
  0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6,
  1, 6, 5,
];

export function aircraftCourseCollider(obstacle) {
  if (obstacle.type === 'trimesh')
    return {
      id: obstacle.id,
      vertices: obstacle.vertices.map((n) => n / 1000),
      indices: [...obstacle.indices],
    };
  const centre = axes.map((key) => (obstacle.min[key] + obstacle.max[key]) / 2000);
  const half = axes.map((key) => (obstacle.max[key] - obstacle.min[key]) / 2000);
  const vertices = [];
  for (const signs of [
    [-1, -1, -1],
    [1, -1, -1],
    [1, 1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
    [1, -1, 1],
    [1, 1, 1],
    [-1, 1, 1],
  ]) {
    let [x, y, z] = signs.map((n, i) => n * half[i]);
    if (obstacle.rotation) {
      const [qx, qy, qz, qw] = obstacle.rotation;
      const tx = 2 * (qy * z - qz * y),
        ty = 2 * (qz * x - qx * z),
        tz = 2 * (qx * y - qy * x);
      [x, y, z] = [
        x + qw * tx + qy * tz - qz * ty,
        y + qw * ty + qz * tx - qx * tz,
        z + qw * tz + qx * ty - qy * tx,
      ];
    }
    vertices.push(x + centre[0], y + centre[1], z + centre[2]);
  }
  return { id: obstacle.id, vertices, indices: [...indices] };
}

export function aircraftCourseTerrain(course) {
  const colliders = course.obstacles.map(aircraftCourseCollider);
  for (const axis of axes)
    for (const side of ['min', 'max']) {
      const min = { ...course.bounds.min },
        max = { ...course.bounds.max };
      if (side === 'min') {
        max[axis] = min[axis];
        min[axis] -= 200;
      } else {
        min[axis] = max[axis];
        max[axis] += 200;
      }
      colliders.push(aircraftCourseCollider({ id: `course-boundary-${axis}-${side}`, min, max }));
    }
  return createAircraftTerrainFrame({ sourceIdentity: dataIdentity(course), colliders });
}

/** Converts COM telemetry to the support-origin convention used by mission goals.
 * The physical solver already resolved contacts; mission rules must not resolve them again. */
export function aircraftMissionMotion(telemetry, supportHeight, missionAdapter = null) {
  if (missionAdapter !== null) {
    exactKeys(missionAdapter, ['format', 'floorHeightMm'], 'Aircraft mission adapter');
    required(
      missionAdapter.format === 'AircraftCourseMission.v2' &&
        Number.isSafeInteger(missionAdapter.floorHeightMm),
      'Unsupported aircraft mission adapter',
    );
  }
  const orientation = ['x', 'y', 'z', 'w'].map((key) => Math.round(telemetry.orientation[key] * Q));
  const position = rounded(telemetry.position, 1000);
  position.y -= Math.round((telemetry.supportHeight ?? supportHeight) * 1000);
  const contact = telemetry.contact ?? {};
  const normal = rounded(contact.normal ?? { x: 0, y: 1, z: 0 }, Q);
  const support = contact.grounded
    ? {
        id: contact.support?.id ?? contact.ids?.[0] ?? 'course-boundary-y-min',
        normal: rounded(contact.support?.normal ?? contact.normal ?? { x: 0, y: 1, z: 0 }, Q),
        y: position.y,
      }
    : null;
  // The physics solver retains its original collider IDs and contact position.
  // Only the versioned mission view names the authored floor and resolves the
  // solver's small contact tolerance at that verified support surface.
  if (
    missionAdapter &&
    contact.grounded &&
    contact.support?.id === 'course-boundary-y-min' &&
    contact.support.normal?.y >= 0.5
  ) {
    support.id = '$floor';
    const supportOriginY = telemetry.position.y - (telemetry.supportHeight ?? supportHeight);
    if (
      Math.abs(supportOriginY - missionAdapter.floorHeightMm / 1000) <=
      FLOOR_CONTACT_TOLERANCE_METRES
    ) {
      position.y = missionAdapter.floorHeightMm;
      support.y = position.y;
    }
  }
  return {
    position,
    velocity: rounded(telemetry.velocity, 1000),
    orientation,
    angular: Object.fromEntries(
      ['roll', 'pitch', 'yaw'].map((key) => [key, Math.round(telemetry.achievedRates[key] * 100)]),
    ),
    grounded: Boolean(contact.grounded),
    support,
    landingSpeed: Math.round((contact.impactSpeed ?? 0) * 1000),
    landingTilt: support
      ? relativeFlightTilt(orientation, support.normal)
      : Math.max(Math.abs(attitude(orientation).roll), Math.abs(attitude(orientation).pitch)),
    contacts: (
      contact.entries ?? (contact.ids ?? []).map((id) => ({ id, normal: contact.normal }))
    ).map((entry) => ({
      id: entry.id,
      normal: entry.normal ? rounded(entry.normal, Q) : normal,
      moving: Boolean(entry.moving),
    })),
  };
}

export function createAircraftCourseSession(
  { course, mode, configuration, legacy = false, model = CURRENT_MISSION_MODEL },
  { createClient = createAdvancedWorkerClient, createMission = createFlight } = {},
) {
  required(
    [LEGACY_MISSION_MODEL, CURRENT_MISSION_MODEL].includes(model),
    'Unsupported aircraft mission model',
  );
  let activeModel = model;
  const aircraft = copy(configuration.advanced.aircraft);
  const challenge =
    configuration.challenge === undefined
      ? null
      : validateAircraftChallengeRules(configuration.challenge);
  required(
    challenge?.kind !== 'battery-endurance' || aircraft.battery.depletion,
    'Battery endurance requires battery depletion',
  );
  const missionOptions = {
    course: copy(course),
    mode,
    response: copy(configuration.response),
    unscoredPractice: true,
    physicalPractice: true,
    physicalRadius: Math.ceil(aircraft.radius * 1000),
  };
  let mission = createMission(missionOptions);
  const source = mission.course();
  const missionAdapterFor = (version) =>
    version === CURRENT_MISSION_MODEL
      ? { format: 'AircraftCourseMission.v2', floorHeightMm: source.bounds.min.y }
      : null;
  const tail = mission.physicalTail?.();
  // Spawn the complete hull above the authored floor, including a shifted COM.
  const geometry = aircraft.geometry;
  const rotorHalfHeight = geometry.ducted ? Math.max(geometry.bodyHalfExtents.y, 0.006) : 0.003;
  const supportHeight = Math.max(
    geometry.bodyHalfExtents.y + geometry.centerOfMass.y,
    ...geometry.rotors.map((rotor) => rotorHalfHeight - rotor.position.y),
  );
  const actorLift = (actor) =>
    ['patrol', 'sentry'].includes(actor.type) ? actor.height / 2 : actor.radius;
  const descriptors = new Map((source.actors ?? []).map((actor) => [actor.id, actor]));
  const actorPoint = (id, p) => point({ ...p, y: p.y + actorLift(descriptors.get(id)) }, 0.001);
  const options = {
    aircraft,
    controller: copy(configuration.advanced.controller),
    response: copy(configuration.response),
    configuration: {
      response: copy(configuration.response),
      environment: { course: dataIdentity(source), host: legacy ? 'academy' : 'world' },
      ...(challenge ? { challenge } : {}),
    },
    assist: { format: 'AircraftAssist.v1', mode, maxTilt: configuration.response.maxTilt ?? 30 },
    spawn: point({ ...source.spawn, y: source.spawn.y + supportHeight * 1000 }, 0.001),
    floor: false,
    terrain: { format: 'AdvancedRegionalTerrain.v1' },
    dynamicColliders: [
      ...(source.actors ?? []).map((actor) => ({
        id: actor.id,
        position: actorPoint(actor.id, actor.position),
        radius: actor.radius / 1000,
        height: (actorLift(actor) * 2) / 1000,
        shape: ['patrol', 'sentry'].includes(actor.type) ? 'cylinder' : 'sphere',
      })),
      ...(tail
        ? tail.ids.map((id) => ({
            id,
            position: point(source.spawn, 0.001),
            radius: tail.radius / 1000,
            height: (tail.radius * 2) / 1000,
            shape: 'sphere',
            enabled: false,
          }))
        : []),
    ],
  };
  const optionsFor = (version) => {
    const adapter = missionAdapterFor(version);
    return adapter
      ? { ...options, configuration: { ...options.configuration, missionAdapter: adapter } }
      : options;
  };
  let client = null,
    restoringClient = null,
    ready = false,
    disposed = false,
    preparing = null,
    stepping = null,
    checkpointing = null,
    checkpointKind = null,
    telemetry = null,
    reference = null,
    error = null,
    archiveGeneration = 0,
    sequence = -1;
  // The reset class covers frozen aircraft/response conditions; terrain is
  // admitted separately. These diagnostics never enter recordings or identities.
  const referenceFor = (initialized, next) => {
    const configurationClass = initialized?.comparison?.comparisonClass,
      terrainIdentity = next?.terrain?.frameIdentity;
    return initialized?.comparison?.terrainIdentity === null &&
      /^[0-9a-f]{16}$/.test(configurationClass) &&
      /^[0-9a-f]{16}$/.test(terrainIdentity)
      ? Object.freeze({ configurationClass, terrainIdentity })
      : null;
  };
  const archiveEnvelope = (value) => ({
    ...value,
    generation: `${archiveGeneration}:${value.generation}`,
  });
  const baseIdentity = {
    course: source.id,
    courseIdentity: dataIdentity(source),
    mode,
    configuration: dataIdentity({
      aircraft,
      controller: configuration.advanced.controller,
      response: configuration.response,
      ...(challenge ? { challenge } : {}),
    }),
  };
  const identities = new Map(
    [LEGACY_MISSION_MODEL, CURRENT_MISSION_MODEL].map((version) => [
      version,
      Object.freeze({ model: version, ...baseIdentity }),
    ]),
  );
  const identityFor = (version) => identities.get(version);
  function snapshot() {
    return {
      ...mission.snapshot(),
      advanced: true,
      unscored: true,
      aircraftRadiusMm: aircraft.radius * 1000,
      aircraftSupportHeightMm: (telemetry?.supportHeight ?? supportHeight) * 1000,
      advancedTelemetry: telemetry && {
        ...copy(telemetry),
        ...(telemetry.archiveStatus
          ? { archiveStatus: archiveEnvelope(telemetry.archiveStatus) }
          : {}),
      },
      recordingStatus: telemetry?.recordingStatus ?? null,
      reason: error ? 'worker-error' : ready ? 'prepared' : 'preparing-aircraft',
      failure: error,
    };
  }
  async function prepare() {
    if (ready) return snapshot();
    if (disposed) throw new Error('Aircraft practice was closed');
    if (preparing) return preparing;
    preparing = (async () => {
      client = createClient();
      const result = await client.initialize(optionsFor(activeModel));
      if (disposed) return snapshot();
      telemetry = result.telemetry;
      const staged = await client.stageTerrainFrame(aircraftCourseTerrain(source));
      const committed = await client.commitTerrainFrame({
        transaction: staged.transaction,
        accepted: true,
      });
      telemetry = committed.telemetry;
      if (!disposed) {
        reference = referenceFor(result, telemetry);
        ready = true;
      }
      return snapshot();
    })().catch((failure) => {
      error = failure.message;
      client?.dispose();
      throw failure;
    });
    return preparing;
  }
  async function step(input) {
    if (!ready || disposed || mission.snapshot().status !== 'active') return snapshot();
    if (stepping) return stepping;
    if (checkpointing) return snapshot();
    const motions = mission.preparePhysicalStep?.() ?? [];
    const sample = {
      sequence: ++sequence,
      timestampUs: Math.round((telemetry?.missionTick ?? 0) * 20000),
      controls: Object.fromEntries(
        ['roll', 'pitch', 'yaw', 'throttle'].map((key) => [key, input[key] ?? 0]),
      ),
    };
    stepping = (async () => {
      const actorState = mission.snapshot().actors ?? [];
      const frameMotions = (source.actors ?? []).map((actor) => {
        const live = actorState.find((a) => a.id === actor.id);
        const moving = motions.find((m) => m.id === actor.id);
        const p = live?.position ?? actor.position;
        return {
          id: actor.id,
          from: actorPoint(actor.id, moving?.from ?? p),
          to: actorPoint(actor.id, moving?.to ?? p),
          enabled: live?.status === 'active',
        };
      });
      if (tail) {
        const positions = mission.snapshot().hunt?.tail ?? [];
        for (let index = 0; index < tail.ids.length; index++) {
          const p = point(positions[index] ?? source.spawn, 0.001);
          frameMotions.push({
            id: tail.ids[index],
            from:
              telemetry?.dynamicColliders?.find((actor) => actor.id === tail.ids[index])
                ?.position ?? point(source.spawn, 0.001),
            to: p,
            enabled: Boolean(positions[index]),
          });
        }
      }
      const result = await client.step(sample, frameMotions);
      if (disposed) return snapshot();
      telemetry = result.telemetry;
      // A pause can arrive while the worker owns a mission interval. Commit that
      // accepted interval once, then preserve the host's paused state.
      const paused = mission.snapshot().status !== 'active';
      if (paused) mission.arm();
      mission.step(input, {
        motion: aircraftMissionMotion(telemetry, supportHeight, missionAdapterFor(activeModel)),
      });
      if (paused) mission.pause();
      return snapshot();
    })()
      .catch((failure) => {
        mission.cancelPhysicalStep?.();
        error = failure.message;
        mission.pause();
        throw failure;
      })
      .finally(() => {
        stepping = null;
      });
    return stepping;
  }
  function exportRecovery() {
    if (checkpointing)
      return checkpointKind !== 'save' ? checkpointing.then(() => exportRecovery()) : checkpointing;
    checkpointKind = 'save';
    checkpointing = (async () => {
      await stepping;
      required(ready && !disposed, 'Aircraft practice is not ready');
      const physical = await client.snapshot();
      const progress = mission.physicalCheckpoint();
      required(
        progress.state.ticks === physical.checkpoint.state.missionTick,
        'Recovery mission boundary changed',
      );
      const packet = {
        format: 'AircraftCourseRecovery.v1',
        identity: copy(identityFor(activeModel)),
        physical,
        mission: progress,
        sequence,
      };
      return { ...packet, checksum: dataIdentity(packet) };
    })().finally(() => {
      checkpointing = null;
      checkpointKind = null;
    });
    return checkpointing;
  }
  function readArchive(afterIndex = -1, finalize = false) {
    required(
      !finalize || mission.snapshot().status !== 'active',
      'Pause before ending the session archive',
    );
    if (preparing && !ready) return preparing.then(() => readArchive(afterIndex, finalize));
    if (checkpointing) return checkpointing.then(() => readArchive(afterIndex, finalize));
    const pendingStep = stepping;
    checkpointKind = finalize ? 'archive-finalize' : 'archive';
    checkpointing = (async () => {
      await pendingStep;
      required(ready && !disposed, 'Aircraft practice is not ready');
      required(
        !finalize || mission.snapshot().status !== 'active',
        'Pause before ending the session archive',
      );
      const result = await (finalize
        ? client.finalizeArchive(afterIndex)
        : client.readSealedSegment(afterIndex));
      if (telemetry)
        telemetry.archiveStatus = {
          generation: result.generation,
          origin: result.origin,
          earliestIndex: result.earliestIndex,
          lastSealedIndex: result.lastSealedIndex,
          latestTick: result.latestTick,
        };
      return archiveEnvelope(result);
    })().finally(() => {
      checkpointing = null;
      checkpointKind = null;
    });
    return checkpointing;
  }
  function restoreRecovery(value, { signal } = {}) {
    required(
      ready && !disposed && !checkpointing && mission.snapshot().status !== 'active',
      'Pause before restoring aircraft practice',
    );
    const pendingStep = stepping;
    checkpointKind = 'restore';
    const operation = (async () => {
      await pendingStep;
      required(!disposed, 'Aircraft practice was closed');
      const saved = boundedJSON(value, {
        maxBytes: 44 * 1024 * 1024,
        maxNodes: 3200000,
        maxArray: 786432,
        maxDepth: 44,
        maxString: 12 * 1024 * 1024,
      });
      exactKeys(
        saved,
        ['format', 'identity', 'physical', 'mission', 'sequence', 'checksum'],
        'Aircraft course recovery',
      );
      const { checksum, ...packet } = saved;
      const restoredModel = saved.identity?.model;
      required(
        saved.format === 'AircraftCourseRecovery.v1' &&
          [LEGACY_MISSION_MODEL, CURRENT_MISSION_MODEL].includes(restoredModel) &&
          dataIdentity(saved.identity) === dataIdentity(identityFor(restoredModel)) &&
          checksum === dataIdentity(packet),
        'Aircraft recovery configuration or checksum differs',
      );
      const progress = mission.validatePhysicalCheckpoint(saved.mission);
      required(
        Number.isSafeInteger(saved.sequence) &&
          saved.sequence >= -1 &&
          saved.sequence === saved.physical.checkpoint?.state?.acceptedSequence &&
          progress.state.ticks === saved.physical.checkpoint?.state?.missionTick,
        'Invalid aircraft recovery clock',
      );
      const candidate = createClient();
      let candidateMission = null;
      restoringClient = candidate;
      const abort = () => candidate.dispose();
      let adopted = false;
      signal?.addEventListener('abort', abort, { once: true });
      try {
        if (signal?.aborted || disposed) throw new Error('Aircraft recovery cancelled');
        // A recovery resumes its published solver, while every other option
        // still comes from this session. Worker identity checks reject any
        // unrelated aircraft, rates, terrain mode or controller configuration.
        const initialized = await candidate.initialize({
          ...optionsFor(restoredModel),
          backend: saved.physical?.config?.backend,
          frequency: saved.physical?.config?.frequency,
        });
        await candidate.restore(saved.physical);
        const restored = await candidate.telemetry();
        if (signal?.aborted || disposed) throw new Error('Aircraft recovery cancelled');
        const expected = aircraftMissionMotion(
          restored,
          supportHeight,
          missionAdapterFor(restoredModel),
        );
        candidateMission = createMission(missionOptions);
        if (progress.state.ticks > 0) {
          for (const field of [
            'position',
            'velocity',
            'orientation',
            'angular',
            'grounded',
            'support',
            'landingSpeed',
            'landingTilt',
          ])
            required(
              dataIdentity(progress.state[field]) === dataIdentity(expected[field]),
              'Mission recovery motion differs from verified physics',
            );
        } else {
          const initial = candidateMission.physicalCheckpoint().state;
          initial.status = progress.state.status;
          required(
            dataIdentity(progress.state) === dataIdentity(initial),
            'Initial mission recovery state differs',
          );
        }
        for (const actor of progress.state.actors ?? []) {
          const verified = restored.dynamicColliders?.find((item) => item.id === actor.id);
          const p = actorPoint(actor.id, actor.position);
          required(
            verified && axes.every((axis) => Math.abs(verified.position[axis] - p[axis]) < 0.001),
            'Mission recovery actors differ from verified physics',
          );
        }
        candidateMission.restorePhysicalCheckpoint(progress);
        if (signal?.aborted || disposed) throw new Error('Aircraft recovery cancelled');
        const previousClient = client,
          previousMission = mission;
        mission = candidateMission;
        candidateMission = null;
        client = candidate;
        activeModel = restoredModel;
        archiveGeneration++;
        adopted = true;
        telemetry = restored;
        reference = referenceFor(initialized, restored);
        sequence = saved.sequence;
        error = null;
        previousClient.dispose();
        previousMission.dispose?.();
        return snapshot();
      } finally {
        signal?.removeEventListener('abort', abort);
        restoringClient = null;
        if (!adopted) candidate.dispose();
        candidateMission?.dispose?.();
      }
    })();
    checkpointing = operation.finally(() => {
      checkpointing = null;
      checkpointKind = null;
    });
    return checkpointing;
  }
  return {
    get identity() {
      return identityFor(activeModel);
    },
    snapshot,
    referenceIdentity: () => (ready && !error && !disposed ? reference : null),
    prepare,
    step,
    stepPending: () => Boolean(stepping || checkpointing),
    course: () => mission.course(),
    aircraft: () => copy(aircraft),
    response: () => mission.response(),
    objectiveFeedback: () => mission.objectiveFeedback?.(),
    arm() {
      // Background checkpoint reads must not consume the player's Arm click.
      // The step lock still holds motion until the accepted boundary is copied.
      if (ready && !error && !disposed && !['restore', 'archive-finalize'].includes(checkpointKind))
        mission.arm();
    },
    pause() {
      mission.pause();
    },
    recording: async () => {
      await stepping;
      return client.recording();
    },
    exportRecovery,
    readSealedSegment: (afterIndex) => readArchive(afterIndex),
    finalizeArchive: (afterIndex) => readArchive(afterIndex, true),
    restoreRecovery,
    async reportPersistence(status) {
      const result = await client.reportPersistence(status);
      if (telemetry) telemetry.recordingStatus = result;
      return result;
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      client?.dispose();
      restoringClient?.dispose();
      await stepping?.catch(() => {});
      await checkpointing?.catch(() => {});
      mission.cancelPhysicalStep?.();
      mission.dispose?.();
    },
  };
}
