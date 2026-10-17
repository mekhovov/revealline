import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
} from '../../game/data-json.mjs';
import RAPIER from './vendor/rapier/rapier.mjs';
import {
  AIRCRAFT_BACKEND,
  AIRCRAFT_REGIONAL_BACKEND,
  AIRCRAFT_SNAPSHOT_FORMAT,
  createAircraftSimulation,
  aircraftFlightIdentities,
  replayAircraftRecording,
  verifyAircraftRecovery,
} from './advanced-aircraft-runtime.mjs';
import {
  AIRCRAFT_RECORDING_FORMAT,
  AIRCRAFT_RECORDING_BYTES,
  AIRCRAFT_SNAPSHOT_BYTES,
} from './aircraft-recording.mjs';
import { validateAircraftPhysics, createAircraftControllerTune } from './aircraft-physics.mjs';
export { AIRCRAFT_BACKEND, AIRCRAFT_REGIONAL_BACKEND } from './advanced-aircraft-runtime.mjs';
import { initWorldRuntime, WORLD_COLLISION_BACKEND } from './world-collision.mjs';
import {
  ADVANCED_AXES,
  createAdvancedController,
  DEFAULT_ADVANCED_TUNE,
  validateAdvancedTune,
} from './advanced-controller.mjs';
import { createRateEvaluator, validateRateProfile } from './rates.mjs';
import {
  ADVANCED_TERRAIN_LIMITS,
  validateAdvancedTerrainFrame,
  packTerrainCollider,
  terrainHistoryIdentity,
  terrainHistoryBytes,
  validateTerrainHistory,
} from './advanced-terrain.mjs';

export const ADVANCED_BACKEND = 'civilian-quad-advanced-experimental.v2';
export const ADVANCED_REGIONAL_BACKEND = 'civilian-quad-advanced-regional.v1';
export const ADVANCED_MISSION_HZ = 50;
export const ADVANCED_FREQUENCIES = Object.freeze([250, 500, 1000]);
// Frozen for this experimental backend revision after the local numerical
// benchmark. Qualification on the full device matrix is still required.
export const ADVANCED_DEFAULT_HZ = 250;
export const ADVANCED_MAX_SECONDS = 12 * 60;
export const ADVANCED_RECORDING_BYTES = 8 * 1024 * 1024;
export const ADVANCED_REGIONAL_SNAPSHOT_BYTES = 24 * 1024 * 1024;
export const ADVANCED_REGIONAL_RECOVERY_BYTES = ADVANCED_REGIONAL_SNAPSHOT_BYTES + 65536;
// These stops preserve the last accepted flight. Transactional callers restore
// a rejected mission/frame before the error reaches the worker boundary.
export class AdvancedFlightLimitError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdvancedFlightLimitError';
    this.code = code;
  }
}
const flightLimit = (condition, code, message) => {
  if (!condition) throw new AdvancedFlightLimitError(code, message);
};
export const ADVANCED_QUALIFICATION = Object.freeze({
  status: 'experimental',
  scored: false,
  defaultEligible: false,
  pending: Object.freeze([
    'browser-and-architecture-determinism',
    'qualification-device-performance',
    'reference-aircraft-measurements',
    'regional-and-native-host-qualification',
    'experienced-pilot-review',
  ]),
});
const PI = 3.141592653589793;
const axes = ['x', 'y', 'z'];
const zero = () => ({ x: 0, y: 0, z: 0 });
const clone = (value) => structuredClone(value);
const finite = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const deepFreeze = (value) => {
  for (const child of Object.values(value))
    if (child && typeof child === 'object') deepFreeze(child);
  return Object.freeze(value);
};
const neutral = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
const defaultEvaluator = (controls) => ({
  roll: controls.roll * 400,
  pitch: controls.pitch * 400,
  yaw: controls.yaw * 400,
  throttle: controls.throttle,
});
const aircraft = (id, mass, armLength, inertia, maxThrust, radius, battery) => ({
  format: 'AdvancedAircraft.v1',
  id,
  mass,
  armLength,
  inertia,
  maxThrust,
  radius,
  reactionTorque: 0.014,
  motorTimeConstant: 0.025,
  linearDrag: 0.08 * mass,
  quadraticDrag: 0.035 * mass,
  angularDrag: 0.002 * mass,
  motorOutputLimit: 1,
  battery,
  sensorNoise: 0,
  vibration: 0,
});
export const ADVANCED_AIRCRAFT_TEMPLATES = deepFreeze({
  whoop: aircraft('whoop', 0.035, 0.035, { x: 0.000025, y: 0.000045, z: 0.000025 }, 0.4, 0.04, {
    nominalVoltage: 3.7,
    fullVoltage: 4.2,
    emptyVoltage: 3.2,
    resistance: 0.055,
    fullCurrent: 8,
    capacityAh: 0.3,
  }),
  freestyle: aircraft('freestyle', 0.65, 0.115, { x: 0.0028, y: 0.005, z: 0.0028 }, 6, 0.13, {
    nominalVoltage: 22.2,
    fullVoltage: 25.2,
    emptyVoltage: 19.2,
    resistance: 0.045,
    fullCurrent: 70,
    capacityAh: 1.3,
  }),
  racing: aircraft('racing', 0.45, 0.105, { x: 0.0014, y: 0.0025, z: 0.0014 }, 8, 0.12, {
    nominalVoltage: 22.2,
    fullVoltage: 25.2,
    emptyVoltage: 19.2,
    resistance: 0.035,
    fullCurrent: 100,
    capacityAh: 1.1,
  }),
});

export function createAdvancedAircraftTune(source = 'freestyle') {
  if (source?.format === 'AdvancedAircraft.v2') return createAircraftControllerTune(source);
  const airframe = validateAdvancedAircraft(source),
    tune = clone(DEFAULT_ADVANCED_TUNE);
  const inertiaAxis = { roll: 'z', pitch: 'x', yaw: 'y' };
  for (const axis of ADVANCED_AXES) {
    const scale =
      airframe.inertia[inertiaAxis[axis]] /
      ADVANCED_AIRCRAFT_TEMPLATES.freestyle.inertia[inertiaAxis[axis]];
    for (const key of ['p', 'i', 'd', 'feedforward']) tune.gains[axis][key] *= scale;
  }
  tune.integralLimit *= Math.max(
    ...axes.map(
      (axis) => airframe.inertia[axis] / ADVANCED_AIRCRAFT_TEMPLATES.freestyle.inertia[axis],
    ),
  );
  return validateAdvancedTune(tune);
}

export function validateAdvancedAircraft(source = 'freestyle') {
  if (source?.format === 'AdvancedAircraft.v2') return validateAircraftPhysics(source);
  if (typeof source === 'string') source = ADVANCED_AIRCRAFT_TEMPLATES[source];
  const value = boundedJSON(source, { maxBytes: 8192, maxNodes: 100, maxDepth: 5 });
  exactKeys(value, Object.keys(ADVANCED_AIRCRAFT_TEMPLATES.freestyle), 'Advanced aircraft');
  required(
    value.format === 'AdvancedAircraft.v1' && typeof value.id === 'string' && value.id.length <= 80,
    'Unsupported aircraft',
  );
  const limits = {
    mass: [0.01, 10],
    armLength: [0.01, 1],
    maxThrust: [0.01, 100],
    radius: [0.01, 1],
    reactionTorque: [0.001, 1],
    motorTimeConstant: [0.001, 1],
    linearDrag: [0, 10],
    quadraticDrag: [0, 10],
    angularDrag: [0, 10],
    motorOutputLimit: [0.1, 1],
    sensorNoise: [0, 5],
    vibration: [0, 5],
  };
  for (const [key, range] of Object.entries(limits))
    required(finite(value[key], ...range), `Invalid aircraft ${key}`);
  exactKeys(value.inertia, axes, 'Aircraft inertia');
  required(
    axes.every((axis) => finite(value.inertia[axis], 0.000001, 10)),
    'Invalid aircraft inertia',
  );
  exactKeys(
    value.battery,
    ['nominalVoltage', 'fullVoltage', 'emptyVoltage', 'resistance', 'fullCurrent', 'capacityAh'],
    'Aircraft battery',
  );
  required(
    finite(value.battery.nominalVoltage, 1, 100) &&
      finite(value.battery.fullVoltage, value.battery.nominalVoltage, 100) &&
      finite(value.battery.emptyVoltage, 1, value.battery.nominalVoltage) &&
      finite(value.battery.resistance, 0, 10) &&
      finite(value.battery.fullCurrent, 0, 1000) &&
      finite(value.battery.capacityAh, 0.01, 100),
    'Invalid aircraft battery',
  );
  return value;
}

/** Derive comparison policy from the actual frozen runtime configuration, never
 * independent UI defaults. Integrity identities keep their published meaning. */
export function advancedFlightIdentities(source, { terrainIdentity = null } = {}) {
  if ([AIRCRAFT_BACKEND, AIRCRAFT_REGIONAL_BACKEND].includes(source?.backend))
    return aircraftFlightIdentities(source, { terrainIdentity });
  const config = boundedJSON(source, {
    maxBytes: 256 * 1024,
    maxNodes: 20000,
    maxArray: 4096,
    maxDepth: 16,
  });
  const regional = config.backend === ADVANCED_REGIONAL_BACKEND;
  required(
    [ADVANCED_BACKEND, ADVANCED_REGIONAL_BACKEND].includes(config.backend) &&
      config.collision === WORLD_COLLISION_BACKEND &&
      [...ADVANCED_FREQUENCIES, 2000].includes(config.frequency) &&
      (regional ? /^[a-f0-9]{16}$/.test(terrainIdentity) : terrainIdentity === null),
    'Unsupported Advanced comparison configuration',
  );
  const comparison = clone(config);
  comparison.aircraft = validateAdvancedAircraft(config.aircraft);
  delete comparison.aircraft.id;
  comparison.controller = validateAdvancedTune(config.controller);
  const preferences = comparison.configuration;
  if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
    for (const key of [
      'camera',
      'profileId',
      'profileRevision',
      'setupId',
      'simulationIdentity',
      'id',
      'name',
      'revision',
      'createdAt',
      'updatedAt',
    ])
      delete preferences[key];
    // Personal axis curves are excluded; every represented throttle setting is
    // retained, including nested rate-profile throttle and older rates.throttle.
    for (const key of ['rateProfile', 'rates']) {
      if (!Object.hasOwn(preferences, key)) continue;
      const rates = preferences[key];
      if (key === 'rateProfile') validateRateProfile(rates);
      if (rates && typeof rates === 'object' && Object.hasOwn(rates, 'throttle'))
        preferences[key] = { throttle: clone(rates.throttle) };
      else delete preferences[key];
    }
  }
  return deepFreeze({
    format: 'AdvancedComparison.v1',
    comparisonClass: dataIdentity({ configuration: comparison, terrainIdentity }),
    simulationIdentity: regional
      ? dataIdentity({ configuration: configurationIdentity(config), terrain: terrainIdentity })
      : configurationIdentity(config),
    terrainIdentity,
    scored: false,
  });
}

function recordingComparison(record) {
  const comparison = advancedFlightIdentities(record.config, {
    terrainIdentity:
      record.config.backend === ADVANCED_REGIONAL_BACKEND ? terrainHistoryIdentity(record) : null,
  });
  if (Object.hasOwn(record, 'comparison')) {
    exactKeys(record.comparison, Object.keys(comparison), 'Advanced comparison metadata');
    required(
      dataIdentity(record.comparison) === dataIdentity(comparison),
      'Advanced comparison metadata changed',
    );
  }
  return comparison;
}

// Only complete replay results produced in this module can establish compatible
// diagnostic runs. A parsed report saying verified:true is not replay evidence.
const verifiedComparisons = new WeakMap();
export function advancedComparisonEligibility(reference, candidate) {
  const a = verifiedComparisons.get(reference),
    b = verifiedComparisons.get(candidate);
  const reason =
    !a || !b
      ? 'unverified-recording'
      : !a.complete || !b.complete
        ? 'partial-replay'
        : a.customEvaluator || b.customEvaluator
          ? 'custom-rate-evaluator'
          : a.comparison.comparisonClass !== b.comparison.comparisonClass
            ? 'comparison-class-mismatch'
            : 'compatible-unscored-practice';
  return {
    eligible: reason === 'compatible-unscored-practice',
    reason,
    scored: false,
    referenceClass: a?.comparison.comparisonClass ?? null,
    candidateClass: b?.comparison.comparisonClass ?? null,
  };
}

const rotate = (q, vector, inverse = false) => {
  const x = inverse ? -q.x : q.x,
    y = inverse ? -q.y : q.y,
    z = inverse ? -q.z : q.z;
  const tx = 2 * (y * vector.z - z * vector.y),
    ty = 2 * (z * vector.x - x * vector.z),
    tz = 2 * (x * vector.y - y * vector.x);
  return {
    x: vector.x + q.w * tx + y * tz - z * ty,
    y: vector.y + q.w * ty + z * tx - x * tz,
    z: vector.z + q.w * tz + x * ty - y * tx,
  };
};
const vector = (value, label) => {
  exactKeys(value, axes, label);
  required(
    axes.every((axis) => finite(value[axis], -1e6, 1e6)),
    `Invalid ${label}`,
  );
  return clone(value);
};
function inputSample(source) {
  const value = boundedJSON(source, { maxBytes: 1024, maxNodes: 20, maxDepth: 3 });
  exactKeys(value, ['sequence', 'timestampUs', 'controls'], 'Input sample');
  required(
    Number.isSafeInteger(value.sequence) &&
      value.sequence >= 0 &&
      Number.isSafeInteger(value.timestampUs) &&
      value.timestampUs >= 0,
    'Timestamped input sequence required',
  );
  exactKeys(value.controls, [...ADVANCED_AXES, 'throttle'], 'Calibrated input');
  required(
    ADVANCED_AXES.every((axis) => finite(value.controls[axis], -1, 1)) &&
      finite(value.controls.throttle, 0, 1),
    'Input must be calibrated and normalized',
  );
  return value;
}
function encodeBytes(bytes) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}
function decodeBytes(text, maxText = 2 * 1024 * 1024) {
  required(
    typeof text === 'string' && text.length <= maxText && /^[A-Za-z0-9+/]*={0,2}$/.test(text),
    'Invalid physics snapshot',
  );
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}
/** Non-cryptographic verification hash; eligibility is a separate policy. */
function bytesHash(bytes, hidden) {
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  for (const byte of new TextEncoder().encode(JSON.stringify(hidden)))
    hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

function configurationIdentity(config) {
  const physical = clone(config);
  delete physical.aircraft.id;
  return dataIdentity(physical);
}

export const initAdvancedRuntime = initWorldRuntime;

/** Physics uses metres, kilograms, seconds, radians and newtons. Mission time
 * is always 50 Hz. A nominal high physics frequency does not imply new USB
 * samples: the consumed sequence is exposed and recorded explicitly. */
export function createAdvancedSimulation(options = {}) {
  if (
    options.aircraft?.format === 'AdvancedAircraft.v2' ||
    [AIRCRAFT_BACKEND, AIRCRAFT_REGIONAL_BACKEND].includes(options.backend)
  )
    return createAircraftSimulation(options);
  const terrainEnabled = options.terrain !== undefined;
  if (terrainEnabled) {
    exactKeys(options.terrain, ['format'], 'Advanced terrain mode');
    required(
      options.terrain.format === 'AdvancedRegionalTerrain.v1' && options.floor === false,
      'Verified Regional terrain requires explicit terrain mode without a synthetic floor',
    );
  }
  const backend = terrainEnabled ? ADVANCED_REGIONAL_BACKEND : ADVANCED_BACKEND;
  const snapshotFormat = terrainEnabled ? 'AdvancedRegionalSnapshot.v1' : 'AdvancedSnapshot.v1';
  const recordingFormat = terrainEnabled ? 'AdvancedRegionalRecording.v1' : 'AdvancedRecording.v1';
  const recordArrays = [
    'inputs',
    'hashes',
    'checkpoints',
    ...(terrainEnabled ? ['terrainColliders', 'terrainFrames', 'terrainEvents'] : []),
  ];
  const airframe = validateAdvancedAircraft(options.aircraft);
  const tune = validateAdvancedTune(options.controller ?? createAdvancedAircraftTune(airframe));
  const hz = options.frequency ?? ADVANCED_DEFAULT_HZ;
  required(
    ADVANCED_FREQUENCIES.includes(hz) || (options.numericalReference === true && hz === 2000),
    'Unsupported fixed Advanced frequency',
  );
  const dt = 1 / hz,
    missionSteps = hz / ADVANCED_MISSION_HZ;
  const spawn = vector(options.spawn ?? { x: 0, y: 2, z: 0 }, 'Spawn');
  const initialVelocity = vector(options.initialVelocity ?? zero(), 'Initial velocity');
  const gravity = vector(options.gravity ?? { x: 0, y: -9.81, z: 0 }, 'Gravity');
  const frozen = boundedJSON(
    options.configuration ?? {
      rates: { algorithm: 'linear', degreesPerSecond: 400 },
      throttle: { model: 'linear' },
    },
    { maxBytes: 65536, maxNodes: 2000, maxDepth: 12 },
  );
  if (options.rateProfile) frozen.rateProfile = validateRateProfile(options.rateProfile);
  const portableEvaluator = frozen.rateProfile ? createRateEvaluator(frozen.rateProfile) : null;
  const rateEvaluator =
    options.rateEvaluator ??
    (portableEvaluator
      ? (controls) => ({
          ...Object.fromEntries(
            ADVANCED_AXES.map((axis) => [axis, portableEvaluator.rate(axis, controls[axis])]),
          ),
          throttle: portableEvaluator.throttle(controls.throttle),
        })
      : defaultEvaluator);
  required(typeof rateEvaluator === 'function', 'A rate evaluator is required');
  const boxes = boundedJSON(options.obstacles ?? [], {
    maxBytes: 128 * 1024,
    maxNodes: 10000,
    maxArray: 512,
    maxDepth: 5,
  });
  required(Array.isArray(boxes), 'Obstacle array required');
  required(
    !terrainEnabled || boxes.length === 0,
    'Regional obstacles must come from verified terrain frames',
  );
  const ids = new Set();
  for (const box of boxes) {
    exactKeys(box, ['id', 'min', 'max'], 'Advanced obstacle');
    required(
      typeof box.id === 'string' && box.id.length < 100 && !ids.has(box.id),
      'Unique obstacle IDs required',
    );
    ids.add(box.id);
    vector(box.min, 'Obstacle minimum');
    vector(box.max, 'Obstacle maximum');
    required(
      axes.every((axis) => box.min[axis] < box.max[axis]),
      'Empty obstacle',
    );
  }
  boxes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const config = {
    backend,
    ...(terrainEnabled ? { terrain: { format: 'AdvancedRegionalTerrain.v1' } } : {}),
    collision: WORLD_COLLISION_BACKEND,
    frequency: hz,
    aircraft: airframe,
    controller: tune,
    spawn,
    initialVelocity,
    gravity,
    floor: options.floor !== false,
    obstacles: boxes,
    configuration: frozen,
  };
  const identity = configurationIdentity(config);
  const recordingOverheadBytes =
    new TextEncoder().encode(JSON.stringify(config)).byteLength + 65536;
  const controller = createAdvancedController({
    tune,
    armLength: airframe.armLength,
    maxThrust: airframe.maxThrust,
    reactionTorque: airframe.reactionTorque,
  });
  let world,
    body,
    bodyHandle,
    disposed = false,
    pending = [],
    state,
    record,
    proposal = null,
    proposalSerial = 0,
    terrainState = null,
    terrainProposal = null,
    terrainSerial = 0,
    regionalWorldProperties = null;
  function assertLive() {
    if (disposed) throw new Error('Advanced simulation is disposed');
  }
  function reset() {
    assertLive();
    required(!proposal && !terrainProposal, 'Finish the pending transaction before reset');
    world?.free();
    world = new RAPIER.World(gravity);
    world.timestep = dt;
    world.integrationParameters.maxCcdSubsteps = 4;
    if (terrainEnabled) {
      world.integrationParameters.normalizedAllowedLinearError = 0.0001;
      // Twelve solver iterations keep a 12 m first impact inside the verified
      // owner's 1 mm support tolerance, without inventing a contact correction.
      world.integrationParameters.numSolverIterations = 12;
    }
    if (config.floor)
      world.createCollider(
        new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })).setFriction(0.5),
      );
    for (const box of boxes)
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          (box.max.x - box.min.x) / 2,
          (box.max.y - box.min.y) / 2,
          (box.max.z - box.min.z) / 2,
        )
          .setTranslation(
            (box.max.x + box.min.x) / 2,
            (box.max.y + box.min.y) / 2,
            (box.max.z + box.min.z) / 2,
          )
          .setFriction(0.5),
      );
    body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.x, spawn.y, spawn.z)
        .setLinvel(initialVelocity.x, initialVelocity.y, initialVelocity.z)
        .setAdditionalMassProperties(airframe.mass, zero(), airframe.inertia, {
          x: 0,
          y: 0,
          z: 0,
          w: 1,
        })
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    world.createCollider(
      RAPIER.ColliderDesc.ball(airframe.radius).setDensity(0).setFriction(0.5).setRestitution(0.05),
      body,
    );
    bodyHandle = body.handle;
    if (terrainEnabled) regionalWorldProperties = terrainWorldProperties(world, bodyHandle);
    controller.reset();
    pending = [];
    proposal = null;
    terrainProposal = null;
    terrainState = terrainEnabled
      ? {
          frameIdentity: null,
          handles: [],
          historyBytes: 0,
          historyIdentity: null,
          touching: false,
          contacts: 0,
          grounded: false,
          normal: zero(),
          impactSpeed: 0,
        }
      : null;
    state = {
      substep: 0,
      missionTick: 0,
      motorSpeeds: [0, 0, 0, 0],
      voltage: airframe.battery.fullVoltage,
      usedAh: 0,
      noiseState: 0x52ca31,
      controls: neutral(),
      consumedSequence: -1,
      consumedTimestampUs: 0,
      acceptedSequence: -1,
      acceptedTimestampUs: 0,
      target: defaultEvaluator(neutral()),
      sensors: { roll: 0, pitch: 0, yaw: 0 },
      current: 0,
      inputBytes: 0,
      checkpointBytes: 0,
    };
    record = {
      format: recordingFormat,
      identity,
      scored: false,
      config: clone(config),
      inputs: [],
      hashes: [],
      checkpoints: [],
      missionTicks: 0,
      ...(terrainEnabled ? { terrainColliders: [], terrainFrames: [], terrainEvents: [] } : {}),
    };
  }
  reset();
  function hiddenState() {
    return {
      state: clone(state),
      controller: controller.snapshot(),
      ...(terrainEnabled ? { terrain: clone(terrainState) } : {}),
    };
  }
  function stateHash() {
    const hidden = hiddenState();
    // Future main-thread queue arrival is not part of the consumed flight state.
    delete hidden.state.acceptedSequence;
    delete hidden.state.acceptedTimestampUs;
    delete hidden.state.checkpointBytes;
    return bytesHash(world.takeSnapshot(), hidden);
  }
  function capture(includeRecording = false) {
    return {
      format: snapshotFormat,
      identity,
      bodyHandle,
      world:
        terrainEnabled && !includeRecording
          ? world.takeSnapshot()
          : encodeBytes(world.takeSnapshot()),
      ...hiddenState(),
      pending: clone(pending),
      recorderLengths: {
        inputs: record.inputs.length,
        hashes: record.hashes.length,
        checkpoints: record.checkpoints.length,
        ...(terrainEnabled
          ? {
              terrainColliders: record.terrainColliders.length,
              terrainFrames: record.terrainFrames.length,
              terrainEvents: record.terrainEvents.length,
            }
          : {}),
      },
      ...(includeRecording
        ? { recording: { ...clone(record), comparison: recordingComparison(record) } }
        : {}),
    };
  }
  function restoreInternal(saved, includeRecording = false, terrainFrame = null) {
    required(
      saved.format === snapshotFormat &&
        saved.identity === identity &&
        saved.bodyHandle === bodyHandle,
      'Snapshot belongs to another Advanced configuration',
    );
    const nextWorld = RAPIER.World.restoreSnapshot(
      saved.world instanceof Uint8Array
        ? saved.world
        : decodeBytes(saved.world, terrainEnabled ? 12 * 1024 * 1024 : undefined),
    );
    if (!nextWorld || !nextWorld.getRigidBody(saved.bodyHandle)) {
      nextWorld?.free();
      throw new TypeError('Snapshot has no reference aircraft');
    }
    try {
      if (terrainEnabled && includeRecording) validateTerrainWorld(nextWorld, saved, terrainFrame);
      controller.restore(saved.controller);
    } catch (error) {
      nextWorld.free();
      throw error;
    }
    world.free();
    world = nextWorld;
    body = world.getRigidBody(bodyHandle);
    state = clone(saved.state);
    if (terrainEnabled) terrainState = clone(saved.terrain);
    pending = clone(saved.pending);
    if (includeRecording) {
      record = clone(saved.recording);
      // Metadata is derived at export/capture so later terrain adoption cannot
      // retain a class computed for an earlier history.
      delete record.comparison;
    } else for (const key of recordArrays) record[key].length = saved.recorderLengths[key];
    record.missionTicks = state.missionTick;
  }
  function stageTerrainFrame(source) {
    assertLive();
    required(terrainEnabled, 'This backend does not accept Regional terrain');
    required(
      !proposal && !terrainProposal,
      'Finish the pending transaction before terrain adoption',
    );
    const frame = validateAdvancedTerrainFrame(source);
    const transaction = ++terrainSerial;
    if (frame.identity === terrainState.frameIdentity) {
      terrainProposal = { id: transaction, before: null };
      return { transaction, identity: frame.identity, unchanged: true };
    }
    const before = capture();
    try {
      const packed = frame.colliders.map(packTerrainCollider);
      for (const collider of packed)
        if (!record.terrainColliders.some((known) => known.key === collider.key))
          record.terrainColliders.push(collider);
      let frameIndex = record.terrainFrames.findIndex((known) => known.identity === frame.identity);
      if (frameIndex < 0) {
        frameIndex = record.terrainFrames.length;
        record.terrainFrames.push({
          identity: frame.identity,
          sourceIdentity: frame.sourceIdentity,
          colliders: packed.map((collider) => collider.key),
        });
      }
      flightLimit(
        record.terrainFrames.length <= ADVANCED_TERRAIN_LIMITS.frames &&
          record.terrainEvents.length < ADVANCED_TERRAIN_LIMITS.events,
        'ADVANCED_RECORDING_LIMIT',
        'Regional terrain history capacity reached',
      );
      record.terrainEvents.push([state.substep, frameIndex]);
      const historyBytes = terrainHistoryBytes(record);
      flightLimit(
        historyBytes + state.inputBytes + state.checkpointBytes + recordingOverheadBytes <=
          ADVANCED_RECORDING_BYTES,
        'ADVANCED_RECORDING_LIMIT',
        'Advanced recording capacity reached while adopting terrain',
      );
      const retained = new Map(terrainState.handles.map((entry) => [entry.key, entry.handle]));
      const wanted = new Set(packed.map((collider) => collider.key));
      for (const entry of terrainState.handles)
        if (!wanted.has(entry.key)) {
          world.removeCollider(world.getCollider(entry.handle), true);
          retained.delete(entry.key);
        }
      const handles = frame.colliders.map((collider, index) => {
        const key = packed[index].key;
        const handle =
          retained.get(key) ??
          world.createCollider(
            RAPIER.ColliderDesc.trimesh(
              new Float32Array(collider.vertices),
              new Uint32Array(collider.indices),
            )
              .setFriction(0.7)
              .setRestitution(0.05),
          ).handle;
        return { key, handle };
      });
      required(
        world.takeSnapshot().byteLength <= 8 * 1024 * 1024,
        'Terrain physics snapshot exceeds capacity',
      );
      terrainState = {
        ...terrainState,
        frameIdentity: frame.identity,
        handles,
        historyBytes,
        historyIdentity: terrainHistoryIdentity(record),
        impactSpeed: 0,
      };
      updateTerrainContacts(zero());
      terrainProposal = { id: transaction, before };
      return { transaction, identity: frame.identity, unchanged: false };
    } catch (error) {
      restoreInternal(before);
      throw error;
    }
  }
  function commitTerrainFrame({ transaction, accepted }) {
    assertLive();
    required(
      terrainProposal && terrainProposal.id === transaction && typeof accepted === 'boolean',
      'Unknown Advanced terrain transaction',
    );
    if (!accepted && terrainProposal.before) restoreInternal(terrainProposal.before);
    terrainProposal = null;
    return { adopted: accepted, telemetry: telemetry() };
  }
  function updateTerrainContacts(previousVelocity) {
    const collider = body.collider(0);
    let touching = false,
      support = false,
      normal = zero(),
      impact = 0;
    for (const entry of terrainState.handles) {
      world.contactPair(world.getCollider(entry.handle), collider, (manifold, flipped) => {
        let close = false;
        for (let index = 0; index < manifold.numContacts(); index++)
          if (manifold.contactDist(index) <= 0.015) close = true;
        if (!close) return;
        const value = manifold.normal(),
          sign = flipped ? -1 : 1;
        const direction = { x: value.x * sign, y: value.y * sign, z: value.z * sign };
        if (!touching || direction.y > normal.y) normal = direction;
        touching = true;
        support ||= direction.y >= 0.5;
        impact = Math.max(
          impact,
          -(
            previousVelocity.x * direction.x +
            previousVelocity.y * direction.y +
            previousVelocity.z * direction.z
          ),
        );
      });
    }
    if (touching && !terrainState.touching) terrainState.contacts++;
    terrainState.touching = touching;
    terrainState.grounded = support && Math.abs(body.linvel().y) < 0.3;
    terrainState.normal = normal;
    terrainState.impactSpeed = Math.max(terrainState.impactSpeed, impact);
  }
  function validateSavedTerrain(saved) {
    exactKeys(
      saved.recording,
      [
        ...Object.keys(record),
        ...(Object.hasOwn(saved.recording, 'comparison') ? ['comparison'] : []),
      ],
      'Regional snapshot recording',
    );
    required(
      new TextEncoder().encode(JSON.stringify(saved.recording)).byteLength <=
        ADVANCED_RECORDING_BYTES,
      'Regional snapshot recording exceeds capacity',
    );
    required(
      saved.recording.inputs.every(
        (event) =>
          Array.isArray(event) && [3, 7].includes(event.length) && event.every(Number.isFinite),
      ) &&
        saved.recording.inputs.reduce(
          (bytes, event) => bytes + JSON.stringify(event).length + 1,
          0,
        ) === saved.state.inputBytes,
      'Regional snapshot input budget changed',
    );
    const terrain = saved.terrain;
    exactKeys(terrain, Object.keys(terrainState), 'Advanced terrain snapshot');
    const frames = validateTerrainHistory(saved.recording, {
      substeps: saved.state.substep,
      missionSteps,
    });
    const current = frames[saved.recording.terrainEvents.at(-1)?.[1]];
    required(
      (current?.identity ?? null) === terrain.frameIdentity &&
        Array.isArray(terrain.handles) &&
        terrain.handles.length === (current?.colliders.length ?? 0),
      'Terrain snapshot frame changed',
    );
    required(
      terrain.historyBytes === terrainHistoryBytes(saved.recording) ||
        (!current && terrain.historyBytes === 0),
      'Terrain snapshot budget changed',
    );
    required(
      (current ? terrainHistoryIdentity(saved.recording) : null) === terrain.historyIdentity,
      'Terrain snapshot history changed',
    );
    required(
      saved.state.inputBytes +
        saved.state.checkpointBytes +
        terrain.historyBytes +
        recordingOverheadBytes <=
        ADVANCED_RECORDING_BYTES,
      'Terrain snapshot exceeds recording budget',
    );
    required(
      typeof terrain.touching === 'boolean' &&
        typeof terrain.grounded === 'boolean' &&
        Number.isSafeInteger(terrain.contacts) &&
        terrain.contacts >= 0 &&
        terrain.contacts <= saved.state.substep &&
        finite(terrain.impactSpeed, 0, 1e6),
      'Invalid terrain contact snapshot',
    );
    vector(terrain.normal, 'Terrain contact normal');
    const handles = new Set();
    for (let index = 0; index < terrain.handles.length; index++) {
      const entry = terrain.handles[index];
      exactKeys(entry, ['key', 'handle'], 'Terrain collider handle');
      required(
        entry.key === packTerrainCollider(current.colliders[index]).key &&
          Number.isFinite(entry.handle) &&
          !handles.has(entry.handle),
        'Invalid terrain collider handles',
      );
      handles.add(entry.handle);
    }
    return current;
  }

  function colliderProperties(collider) {
    return Object.fromEntries(
      [
        'isEnabled',
        'isSensor',
        'friction',
        'restitution',
        'frictionCombineRule',
        'restitutionCombineRule',
        'density',
        'collisionGroups',
        'solverGroups',
        'contactSkin',
        'activeHooks',
        'activeEvents',
        'activeCollisionTypes',
        'contactForceEventThreshold',
      ].map((key) => [key, collider[key]()]),
    );
  }
  function terrainWorldProperties(candidate, handle) {
    // Mass changes can be pending until the first physics step. Validate a
    // detached world after resolving them, preserving the live contact cache.
    const probe = RAPIER.World.restoreSnapshot(candidate.takeSnapshot());
    try {
      const reference = probe.getRigidBody(handle);
      reference.setRotation({ x: 0, y: 0, z: 0, w: 1 }, false);
      reference.recomputeMassPropertiesFromColliders();
      const bodyProperties = Object.fromEntries(
        [
          'bodyType',
          'isEnabled',
          'isSleeping',
          'isCcdEnabled',
          'gravityScale',
          'mass',
          'invMass',
          'localCom',
          'principalInertia',
          'invPrincipalInertia',
          'principalInertiaLocalFrame',
          'effectiveInvMass',
          'effectiveAngularInertia',
          'linearDamping',
          'angularDamping',
          'dominanceGroup',
          'additionalSolverIterations',
          'additionalPgsIterations',
          'softCcdPrediction',
        ].map((key) => [key, reference[key]()]),
      );
      const parameters = Object.fromEntries(
        [
          'dt',
          'lengthUnit',
          'contact_erp',
          'normalizedAllowedLinearError',
          'normalizedPredictionDistance',
          'numSolverIterations',
          'numInternalPgsIterations',
          'maxCcdSubsteps',
        ].map((key) => [key, probe.integrationParameters[key]]),
      );
      const hull = reference.collider(0);
      return JSON.stringify({
        gravity: probe.gravity,
        parameters,
        body: bodyProperties,
        hull: {
          ...colliderProperties(hull),
          position: hull.translationWrtParent(),
          rotation: hull.rotationWrtParent(),
        },
      });
    } finally {
      probe.free();
    }
  }
  function validateTerrainWorld(candidate, saved, frame) {
    const aircraftBody = candidate.getRigidBody(saved.bodyHandle);
    for (const key of [
      'translation',
      'nextTranslation',
      'linvel',
      'angvel',
      'userForce',
      'userTorque',
    ]) {
      const value = aircraftBody[key](),
        limit = ['userForce', 'userTorque'].includes(key)
          ? 1e15
          : ADVANCED_TERRAIN_LIMITS.coordinate;
      required(
        axes.every((axis) => finite(value[axis], -limit, limit)),
        `Invalid Regional body ${key}`,
      );
    }
    for (const key of ['rotation', 'nextRotation']) {
      const value = aircraftBody[key]();
      const norm = value.x * value.x + value.y * value.y + value.z * value.z + value.w * value.w;
      required(
        [...axes, 'w'].every((axis) => finite(value[axis], -1.001, 1.001)) &&
          finite(norm, 0.999, 1.001),
        `Invalid Regional body ${key}`,
      );
    }
    required(
      terrainWorldProperties(candidate, saved.bodyHandle) === regionalWorldProperties,
      'Terrain snapshot physics properties changed',
    );
    required(
      candidate.bodies.len() === 1 &&
        candidate.colliders.len() === (frame?.colliders.length ?? 0) + 1 &&
        aircraftBody.numColliders() === 1,
      'Terrain snapshot contains unexpected physics bodies',
    );
    required(
      candidate.timestep === Math.fround(dt) &&
        candidate.integrationParameters.normalizedAllowedLinearError === Math.fround(0.0001),
      'Terrain snapshot timing changed',
    );
    const hull = aircraftBody.collider(0);
    required(
      hull.shapeType() === RAPIER.ShapeType.Ball &&
        hull.shape.radius === Math.fround(airframe.radius),
      'Terrain aircraft hull changed',
    );
    for (let index = 0; index < saved.terrain.handles.length; index++) {
      const collider = candidate.getCollider(saved.terrain.handles[index].handle),
        expected = frame.colliders[index];
      required(
        collider && collider.shapeType() === RAPIER.ShapeType.TriMesh && !collider.isSensor(),
        'Terrain snapshot collider changed',
      );
      const expectedCollider = RAPIER.ColliderDesc.trimesh(
        new Float32Array(expected.vertices),
        new Uint32Array(expected.indices),
      )
        .setFriction(0.7)
        .setRestitution(0.05);
      const propertyWorld = new RAPIER.World(zero());
      try {
        required(
          JSON.stringify(colliderProperties(collider)) ===
            JSON.stringify(colliderProperties(propertyWorld.createCollider(expectedCollider))),
          'Terrain snapshot collision behavior changed',
        );
      } finally {
        propertyWorld.free();
      }
      const position = collider.translation(),
        orientation = collider.rotation(),
        shape = collider.shape;
      required(
        axes.every((axis) => position[axis] === 0 && orientation[axis] === 0) &&
          orientation.w === 1 &&
          collider.friction() === Math.fround(0.7) &&
          collider.restitution() === Math.fround(0.05),
        'Terrain snapshot collider properties changed',
      );
      required(
        shape.flags === 0 &&
          shape.vertices.length === expected.vertices.length &&
          shape.vertices.every((value, i) => value === expected.vertices[i]) &&
          shape.indices.length === expected.indices.length &&
          shape.indices.every((value, i) => value === expected.indices[i]),
        'Terrain snapshot geometry changed',
      );
    }
  }

  function telemetry() {
    assertLive();
    const rotation = body.rotation();
    const localAngular = rotate(rotation, body.angvel(), true);
    return {
      backend,
      ...(terrainEnabled
        ? {
            terrain: {
              frameIdentity: terrainState.frameIdentity,
              touching: terrainState.touching,
              contacts: terrainState.contacts,
              grounded: terrainState.grounded,
              normal: clone(terrainState.normal),
              impactSpeed: terrainState.impactSpeed,
            },
          }
        : {}),
      experimental: true,
      scored: false,
      frequency: hz,
      missionHz: ADVANCED_MISSION_HZ,
      missionTick: state.missionTick,
      substep: state.substep,
      seconds: state.substep / hz,
      position: { ...body.translation() },
      velocity: { ...body.linvel() },
      orientation: { ...rotation },
      requestedRates: { roll: state.target.roll, pitch: state.target.pitch, yaw: state.target.yaw },
      achievedRates: {
        roll: (-localAngular.z * 180) / PI,
        pitch: (-localAngular.x * 180) / PI,
        yaw: (-localAngular.y * 180) / PI,
      },
      calibratedInput: clone(state.controls),
      motorSpeeds: [...state.motorSpeeds],
      voltage: state.voltage,
      usedAh: state.usedAh,
      current: state.current,
      consumedSequence: state.consumedSequence,
      consumedTimestampUs: state.consumedTimestampUs,
      sampleAgeUs:
        state.consumedSequence < 0
          ? null
          : Math.max(0, Math.round((state.substep * 1e6) / hz) - state.consumedTimestampUs),
      devicePollHz: null,
      saturated: controller.telemetry().saturated,
    };
  }
  function enqueueInput(source) {
    assertLive();
    required(
      !proposal && !terrainProposal,
      'Commit or reject the pending mission before adding input',
    );
    const sample = inputSample(source);
    required(
      sample.sequence > state.acceptedSequence && sample.timestampUs >= state.acceptedTimestampUs,
      'Input samples must have increasing sequences and monotonic timestamps',
    );
    required(
      pending.length < 4096 && sample.timestampUs <= ADVANCED_MAX_SECONDS * 1e6,
      'Input queue exceeds duration or capacity',
    );
    state.acceptedSequence = sample.sequence;
    state.acceptedTimestampUs = sample.timestampUs;
    pending.push(sample);
  }
  function noise() {
    let bits = state.noiseState;
    bits ^= bits << 13;
    bits ^= bits >>> 17;
    bits ^= bits << 5;
    state.noiseState = bits >>> 0;
    return state.noiseState / 2147483648 - 1;
  }
  function substep() {
    const timestampUs = Math.round((state.substep * 1e6) / hz);
    let sample;
    while (pending.length && pending[0].timestampUs <= timestampUs) sample = pending.shift();
    if (sample) {
      const changed = [...ADVANCED_AXES, 'throttle'].some(
        (axis) => sample.controls[axis] !== state.controls[axis],
      );
      state.controls = sample.controls;
      state.consumedSequence = sample.sequence;
      state.consumedTimestampUs = sample.timestampUs;
      const event = changed
        ? [
            state.substep,
            sample.sequence,
            sample.timestampUs,
            sample.controls.roll,
            sample.controls.pitch,
            sample.controls.yaw,
            sample.controls.throttle,
          ]
        : [state.substep, sample.sequence, sample.timestampUs];
      state.inputBytes += JSON.stringify(event).length + 1;
      flightLimit(
        state.inputBytes <= 6 * 1024 * 1024 &&
          state.inputBytes +
            state.checkpointBytes +
            (terrainState?.historyBytes ?? 0) +
            recordingOverheadBytes <=
            ADVANCED_RECORDING_BYTES &&
          record.inputs.length < 300000,
        'ADVANCED_RECORDING_LIMIT',
        'Advanced recording capacity reached; export the flight before continuing',
      );
      record.inputs.push(event);
    }
    const quaternion = body.rotation(),
      velocity = body.linvel(),
      angular = rotate(quaternion, body.angvel(), true);
    const vibration = state.substep % 2 === 0 ? airframe.vibration : -airframe.vibration;
    state.sensors = {
      roll: -angular.z + noise() * airframe.sensorNoise + vibration,
      pitch: -angular.x + noise() * airframe.sensorNoise - vibration,
      yaw: -angular.y + noise() * airframe.sensorNoise,
    };
    state.target = rateEvaluator(clone(state.controls), frozen);
    const output = controller.step({
      controls: state.controls,
      target: state.target,
      sensors: state.sensors,
      dt,
    });
    const alpha = Math.min(1, (2 * dt) / (2 * airframe.motorTimeConstant + dt));
    for (let motor = 0; motor < 4; motor++)
      state.motorSpeeds[motor] +=
        (output.motors[motor] * airframe.motorOutputLimit - state.motorSpeeds[motor]) * alpha;
    // Integer powers use explicit IEEE-754 operations: Math.pow implementations
    // differ by a final bit across V8 versions and would break replay hashes.
    state.current =
      (airframe.battery.fullCurrent *
        state.motorSpeeds.reduce((sum, speed) => sum + speed * speed * speed, 0)) /
      4;
    state.usedAh = Math.min(
      airframe.battery.capacityAh,
      state.usedAh + (state.current * dt) / 3600,
    );
    const charge = Math.max(0, 1 - state.usedAh / airframe.battery.capacityAh);
    const openVoltage =
      airframe.battery.emptyVoltage +
      (airframe.battery.fullVoltage - airframe.battery.emptyVoltage) * charge;
    state.voltage = Math.max(
      airframe.battery.emptyVoltage * 0.7,
      openVoltage - state.current * airframe.battery.resistance,
    );
    const voltageScale = state.voltage / airframe.battery.nominalVoltage;
    const thrusts = state.motorSpeeds.map((speed) => {
      const adjusted = speed * voltageScale;
      return airframe.maxThrust * (adjusted * adjusted) * (charge > 0 ? 1 : 0);
    });
    const lever = airframe.armLength * 0.7071067811865476;
    const torque = {
      x:
        (thrusts[0] + thrusts[1] - thrusts[2] - thrusts[3]) * lever -
        angular.x * airframe.angularDrag,
      y:
        (thrusts[0] - thrusts[1] + thrusts[2] - thrusts[3]) * airframe.reactionTorque -
        angular.y * airframe.angularDrag,
      z:
        (-thrusts[0] + thrusts[1] + thrusts[2] - thrusts[3]) * lever -
        angular.z * airframe.angularDrag,
    };
    const force = rotate(quaternion, {
      x: 0,
      y: thrusts.reduce((sum, value) => sum + value, 0),
      z: 0,
    });
    for (const axis of axes)
      force[axis] -=
        airframe.linearDrag * velocity[axis] +
        airframe.quadraticDrag * velocity[axis] * Math.abs(velocity[axis]);
    body.resetForces(true);
    body.resetTorques(true);
    body.addForce(force, true);
    body.addTorque(rotate(quaternion, torque), true);
    world.step();
    if (terrainEnabled) updateTerrainContacts(velocity);
    state.substep++;
  }
  function finishMission() {
    state.missionTick++;
    record.missionTicks = state.missionTick;
    if (state.missionTick % ADVANCED_MISSION_HZ === 0)
      record.hashes.push([state.substep, stateHash()]);
    if (state.missionTick % (ADVANCED_MISSION_HZ * 30) === 0) {
      const checkpoint = terrainEnabled
        ? {
            format: 'AdvancedRegionalCheckpoint.v1',
            substep: state.substep,
            missionTick: state.missionTick,
            hash: stateHash(),
            frameIdentity: terrainState.frameIdentity,
            state: clone(state),
            controller: controller.snapshot(),
            body: {
              position: { ...body.translation() },
              velocity: { ...body.linvel() },
              orientation: { ...body.rotation() },
              angularVelocity: { ...body.angvel() },
            },
          }
        : capture();
      // Checkpoints do not duplicate the input history or future device samples.
      if (!terrainEnabled) checkpoint.pending = [];
      checkpoint.state.acceptedSequence = checkpoint.state.consumedSequence;
      checkpoint.state.acceptedTimestampUs = checkpoint.state.consumedTimestampUs;
      const checkpointBytes = JSON.stringify(checkpoint).length + 1;
      flightLimit(
        state.inputBytes +
          state.checkpointBytes +
          checkpointBytes +
          (terrainState?.historyBytes ?? 0) +
          recordingOverheadBytes <=
          ADVANCED_RECORDING_BYTES,
        'ADVANCED_RECORDING_LIMIT',
        'Advanced recording capacity reached; export the flight before continuing',
      );
      state.checkpointBytes += checkpointBytes;
      record.checkpoints.push(checkpoint);
    }
  }
  function runMission() {
    required(
      !terrainEnabled || terrainState.frameIdentity,
      'Verified terrain must be committed before flight',
    );
    if (terrainEnabled) terrainState.impactSpeed = 0;
    const trace = [{ ...body.translation() }];
    for (let index = 0; index < missionSteps; index++) {
      substep();
      trace.push({ ...body.translation() });
    }
    finishMission();
    return trace;
  }
  function stepMission({ admitMotion } = {}) {
    assertLive();
    required(!proposal && !terrainProposal, 'A mission transaction is pending');
    flightLimit(
      state.missionTick < ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ,
      'ADVANCED_DURATION_LIMIT',
      'Advanced flight duration limit reached',
    );
    const before = capture();
    try {
      const trace = runMission();
      if (admitMotion) {
        const admitted = admitMotion(trace[0], trace.at(-1), clone(trace));
        required(
          typeof admitted === 'boolean',
          'Terrain admission must return a boolean; use proposeMission/commitMission for asynchronous admission',
        );
        if (!admitted) {
          restoreInternal(before);
          return { admitted: false, telemetry: telemetry(), trace };
        }
      }
      return { admitted: true, telemetry: telemetry(), trace };
    } catch (error) {
      restoreInternal(before);
      throw error;
    }
  }
  return {
    identity,
    configuration: () => clone(config),
    comparison: () => recordingComparison(record),
    qualification: () => clone(ADVANCED_QUALIFICATION),
    controllerCapabilities: controller.capabilities,
    enqueueInput,
    stepMission,
    telemetry,
    stateHash,
    stageTerrainFrame,
    commitTerrainFrame,
    snapshot() {
      assertLive();
      required(!proposal && !terrainProposal, 'A mission transaction is pending');
      return capture(true);
    },
    // Structural restore is for trusted snapshots and transactional recovery.
    // User-owned files must pass verifyAdvancedRecovery before adoption.
    restore(source) {
      assertLive();
      required(!proposal && !terrainProposal, 'A mission transaction is pending');
      const saved = boundedJSON(source, {
        maxBytes: terrainEnabled
          ? ADVANCED_REGIONAL_SNAPSHOT_BYTES
          : ADVANCED_RECORDING_BYTES + 2 * 1024 * 1024,
        maxNodes: 2000000,
        maxArray: 300000,
        maxString: terrainEnabled ? 12 * 1024 * 1024 : 2 * 1024 * 1024,
        maxDepth: 30,
      });
      required(
        saved.recording?.identity === identity &&
          Array.isArray(saved.pending) &&
          saved.pending.length <= 4096 &&
          Number.isSafeInteger(saved.state?.missionTick) &&
          saved.state.missionTick >= 0 &&
          saved.state.missionTick <= ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ,
        'Invalid complete Advanced snapshot',
      );
      exactKeys(
        saved,
        [
          'format',
          'identity',
          'bodyHandle',
          'world',
          'state',
          'controller',
          'pending',
          'recorderLengths',
          'recording',
          ...(terrainEnabled ? ['terrain'] : []),
        ],
        'Advanced snapshot',
      );
      exactKeys(saved.state, Object.keys(state), 'Advanced snapshot state');
      const next = saved.state;
      required(
        Number.isSafeInteger(next.substep) &&
          next.substep === next.missionTick * missionSteps &&
          Array.isArray(next.motorSpeeds) &&
          next.motorSpeeds.length === 4 &&
          next.motorSpeeds.every((value) => finite(value, 0, 1)) &&
          finite(next.voltage, 0, 100) &&
          finite(next.usedAh, 0, airframe.battery.capacityAh) &&
          finite(next.current, 0, 1000) &&
          Number.isSafeInteger(next.noiseState) &&
          next.noiseState > 0 &&
          next.noiseState <= 0xffffffff &&
          Number.isSafeInteger(next.inputBytes) &&
          next.inputBytes >= 0 &&
          next.inputBytes <= 6 * 1024 * 1024 &&
          Number.isSafeInteger(next.checkpointBytes) &&
          next.checkpointBytes >= 0 &&
          next.inputBytes + next.checkpointBytes + recordingOverheadBytes <=
            ADVANCED_RECORDING_BYTES,
        'Invalid Advanced dynamics snapshot',
      );
      inputSample({ sequence: 0, timestampUs: 0, controls: next.controls });
      for (const field of ['target', 'sensors']) {
        exactKeys(
          next[field],
          field === 'target' ? [...ADVANCED_AXES, 'throttle'] : ADVANCED_AXES,
          'Advanced sensor snapshot',
        );
        required(
          ADVANCED_AXES.every((axis) => finite(next[field][axis], -1e6, 1e6)),
          'Invalid Advanced sensor snapshot',
        );
      }
      required(finite(next.target.throttle, 0, 1), 'Invalid Advanced target throttle');
      for (const key of ['consumedSequence', 'acceptedSequence'])
        required(
          Number.isSafeInteger(next[key]) && next[key] >= -1,
          'Invalid Advanced input cursor',
        );
      for (const key of ['consumedTimestampUs', 'acceptedTimestampUs'])
        required(
          Number.isSafeInteger(next[key]) &&
            next[key] >= 0 &&
            next[key] <= ADVANCED_MAX_SECONDS * 1e6,
          'Invalid Advanced input timestamp',
        );
      let priorSequence = next.consumedSequence,
        priorTimestamp = next.consumedTimestampUs;
      for (const sample of saved.pending) {
        inputSample(sample);
        required(
          sample.sequence > priorSequence && sample.timestampUs >= priorTimestamp,
          'Invalid pending Advanced input order',
        );
        priorSequence = sample.sequence;
        priorTimestamp = sample.timestampUs;
      }
      required(
        next.acceptedSequence === priorSequence && next.acceptedTimestampUs === priorTimestamp,
        'Invalid Advanced accepted input cursor',
      );
      required(
        saved.recording.format === recordingFormat &&
          saved.recording.scored === false &&
          saved.recording.missionTicks === next.missionTick &&
          configurationIdentity(saved.recording.config) === identity,
        'Invalid Advanced recording snapshot',
      );
      exactKeys(saved.recorderLengths, recordArrays, 'Advanced recording cursor');
      for (const key of recordArrays)
        required(
          Array.isArray(saved.recording[key]) &&
            saved.recording[key].length === saved.recorderLengths[key],
          'Invalid Advanced recording history',
        );
      required(
        saved.recording.hashes.length === Math.floor(next.missionTick / 50) &&
          saved.recording.checkpoints.length === Math.floor(next.missionTick / 1500) &&
          saved.recording.checkpoints.reduce(
            (sum, checkpoint) => sum + JSON.stringify(checkpoint).length + 1,
            0,
          ) === next.checkpointBytes,
        'Incomplete Advanced snapshot recording',
      );
      const savedFrame = terrainEnabled ? validateSavedTerrain(saved) : null;
      recordingComparison(saved.recording);
      restoreInternal(saved, true, savedFrame);
      return telemetry();
    },
    proposeMission() {
      assertLive();
      required(!proposal && !terrainProposal, 'A mission transaction is already pending');
      flightLimit(
        state.missionTick < ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ,
        'ADVANCED_DURATION_LIMIT',
        'Advanced flight duration limit reached',
      );
      const before = capture();
      try {
        const trace = runMission();
        proposal = { id: ++proposalSerial, before };
        return { transaction: proposal.id, trace, telemetry: telemetry() };
      } catch (error) {
        restoreInternal(before);
        throw error;
      }
    },
    commitMission({ transaction, accepted }) {
      assertLive();
      required(
        proposal && proposal.id === transaction && typeof accepted === 'boolean',
        'Unknown Advanced mission transaction',
      );
      if (!accepted) restoreInternal(proposal.before);
      proposal = null;
      return { admitted: accepted, telemetry: telemetry() };
    },
    recording() {
      assertLive();
      required(
        !proposal && !terrainProposal,
        'Commit or reject the pending mission before recording',
      );
      return boundedJSON(
        {
          ...record,
          comparison: recordingComparison(record),
          finalHash: stateHash(),
          ...(terrainEnabled
            ? {
                terrainIdentity: terrainHistoryIdentity(record),
                simulationIdentity: dataIdentity({
                  configuration: identity,
                  terrain: terrainHistoryIdentity(record),
                }),
              }
            : {}),
        },
        {
          maxBytes: ADVANCED_RECORDING_BYTES,
          maxNodes: 2000000,
          maxArray: 300000,
          maxString: 2 * 1024 * 1024,
          maxDepth: 30,
        },
      );
    },
    reset,
    dispose() {
      if (!disposed) {
        world.free();
        disposed = true;
        pending = [];
        proposal = null;
        terrainProposal = null;
      }
    },
  };
}

/** Verify a user-owned recovery without modifying the receiving simulation.
 * Future queued input is not part of the consumed history; its shape/order is
 * checked by restore, while all consumed dynamics must match an exact replay.
 * Run this in a disposable worker so cancellation terminates the replay. */
export async function verifyAdvancedRecovery(source, { expectedIdentity } = {}) {
  if (typeof source === 'string')
    source = boundedJSON(source, {
      maxBytes: AIRCRAFT_SNAPSHOT_BYTES,
      maxNodes: 4000000,
      maxArray: 500000,
      maxString: 12 * 1024 * 1024,
      maxDepth: 40,
    });
  if (source?.format === AIRCRAFT_SNAPSHOT_FORMAT)
    return verifyAircraftRecovery(source, { expectedIdentity });
  const saved = boundedJSON(source, {
    maxBytes: ADVANCED_REGIONAL_SNAPSHOT_BYTES,
    maxNodes: 2000000,
    maxArray: 300000,
    maxString: 12 * 1024 * 1024,
    maxDepth: 30,
  });
  required(
    expectedIdentity === undefined || saved.identity === expectedIdentity,
    'Recovery belongs to another Advanced configuration',
  );
  await initAdvancedRuntime();
  const candidate = createAdvancedSimulation({
    ...saved.recording?.config,
    numericalReference: saved.recording?.config?.frequency === 2000,
  });
  try {
    candidate.restore(saved);
    const replayed = await replayAdvancedRecording(candidate.recording());
    const consumedState = (snapshot) => {
      const state = { ...snapshot.state };
      delete state.acceptedSequence;
      delete state.acceptedTimestampUs;
      delete state.checkpointBytes;
      return {
        world: snapshot.world,
        bodyHandle: snapshot.bodyHandle,
        state,
        controller: snapshot.controller,
        ...(snapshot.terrain ? { terrain: snapshot.terrain } : {}),
      };
    };
    // Compare complete data, not just the small replay verification hash. This
    // also binds contact caches and other Rapier state to the recorded history.
    required(
      canonicalJSON(consumedState(candidate.snapshot())) ===
        canonicalJSON(consumedState(replayed.snapshot)),
      'Advanced recovery dynamics do not match the recorded flight',
    );
    return saved;
  } finally {
    candidate.dispose();
  }
}

/** Replays the recorded consumed samples, never a player's current library.
 * Supply the evaluator appropriate for the recording's frozen configuration. */
export async function replayAdvancedRecording(
  source,
  { rateEvaluator, throughMission, includeTelemetry = false, onMissionTelemetry } = {},
) {
  if (typeof source === 'string')
    source = boundedJSON(source, {
      maxBytes: AIRCRAFT_RECORDING_BYTES,
      maxNodes: 3000000,
      maxArray: 500000,
      maxString: 12 * 1024 * 1024,
      maxDepth: 40,
    });
  if (source?.format === AIRCRAFT_RECORDING_FORMAT)
    return replayAircraftRecording(source, {
      throughMission,
      includeTelemetry,
      onMissionTelemetry,
    });
  required(typeof includeTelemetry === 'boolean', 'Invalid replay telemetry option');
  required(
    onMissionTelemetry === undefined || typeof onMissionTelemetry === 'function',
    'Invalid replay telemetry observer',
  );
  const record = boundedJSON(source, {
    maxBytes: ADVANCED_RECORDING_BYTES,
    maxNodes: 2000000,
    maxArray: 300000,
    maxString: 2 * 1024 * 1024,
    maxDepth: 30,
  });
  const regional = record.format === 'AdvancedRegionalRecording.v1';
  required(
    (regional || record.format === 'AdvancedRecording.v1') &&
      record.scored === false &&
      record.config?.backend === (regional ? ADVANCED_REGIONAL_BACKEND : ADVANCED_BACKEND) &&
      Number.isInteger(record.missionTicks) &&
      record.missionTicks >= 0 &&
      record.missionTicks <= ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ,
    'Unsupported Advanced recording',
  );
  required(
    Array.isArray(record.inputs) && Array.isArray(record.hashes),
    'Recording input and verification arrays required',
  );
  required(
    record.hashes.length === Math.floor(record.missionTicks / ADVANCED_MISSION_HZ) &&
      typeof record.finalHash === 'string' &&
      /^[a-f0-9]{8}$/.test(record.finalHash),
    'Recording verification coverage is incomplete',
  );
  for (let index = 0; index < record.hashes.length; index++)
    required(
      Array.isArray(record.hashes[index]) &&
        record.hashes[index].length === 2 &&
        record.hashes[index][0] === (index + 1) * record.config.frequency &&
        /^[a-f0-9]{8}$/.test(record.hashes[index][1]),
      'Invalid verification schedule',
    );
  const frames = regional
    ? validateTerrainHistory(record, {
        substeps: (record.missionTicks * record.config.frequency) / ADVANCED_MISSION_HZ,
        missionSteps: record.config.frequency / ADVANCED_MISSION_HZ,
      })
    : [];
  if (regional)
    required(
      record.terrainIdentity === terrainHistoryIdentity(record) &&
        record.simulationIdentity ===
          dataIdentity({ configuration: record.identity, terrain: record.terrainIdentity }),
      'Recorded terrain identity changed',
    );
  const comparison = recordingComparison(record);
  await initAdvancedRuntime();
  const sim = createAdvancedSimulation({
    ...record.config,
    rateEvaluator,
    numericalReference: record.config.frequency === 2000,
  });
  try {
    required(sim.identity === record.identity, 'Advanced recording configuration changed');
    let cursor = 0,
      controls = neutral(),
      sequence = -1,
      step = -1,
      hashCursor = 0,
      terrainCursor = 0;
    const applyTerrain = (substep) => {
      while (regional && record.terrainEvents[terrainCursor]?.[0] === substep) {
        const frame = frames[record.terrainEvents[terrainCursor++][1]];
        const staged = sim.stageTerrainFrame(frame);
        sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
      }
    };
    applyTerrain(0);
    const until = throughMission ?? record.missionTicks;
    required(
      Number.isInteger(until) && until >= 0 && until <= record.missionTicks,
      'Invalid recovery target',
    );
    // A requested recovery point between hashes is not yet verified. Continue
    // through its next verification boundary, retaining the requested state.
    const verificationMission = Math.min(
      record.missionTicks,
      Math.ceil(until / ADVANCED_MISSION_HZ) * ADVANCED_MISSION_HZ,
    );
    // Diagnostic samples are returned only after verification succeeds. Their
    // cadence is the mission rate, not the faster controller/physics frequency.
    const telemetrySamples = includeTelemetry ? [sim.telemetry()] : null;
    // Observer values are detached, provisional diagnostics. Callers must not
    // publish a collected path until complete replay verification succeeds.
    onMissionTelemetry?.(sim.telemetry());
    let recovered = until === 0 ? { telemetry: sim.telemetry(), snapshot: sim.snapshot() } : null;
    for (let mission = 0; mission < verificationMission; mission++) {
      const end = ((mission + 1) * record.config.frequency) / ADVANCED_MISSION_HZ;
      while (cursor < record.inputs.length && record.inputs[cursor][0] < end) {
        const item = record.inputs[cursor++];
        required(
          Array.isArray(item) &&
            [3, 7].includes(item.length) &&
            Number.isSafeInteger(item[0]) &&
            item[0] > step &&
            item[1] > sequence,
          'Invalid consumed input history',
        );
        if (item.length === 7)
          controls = { roll: item[3], pitch: item[4], yaw: item[5], throttle: item[6] };
        // Inputs can arrive late, but new arrivals are admitted only between
        // complete synchronous missions. Within a mission, each frozen frequency
        // divides one million microseconds exactly, so timestamp rounding fixes
        // the first eligible substep. Bind the declared consumption time to that
        // schedule; physics hashes alone cannot detect a changed event index.
        required(
          item[0] ===
            Math.max(
              (mission * record.config.frequency) / ADVANCED_MISSION_HZ,
              Math.ceil((item[2] * record.config.frequency) / 1e6),
            ),
          'Recorded input consumption time changed',
        );
        sim.enqueueInput({ sequence: item[1], timestampUs: item[2], controls });
        sequence = item[1];
        step = item[0];
      }
      sim.stepMission();
      const expected = record.hashes[hashCursor];
      if (expected && expected[0] === sim.telemetry().substep) {
        required(
          sim.stateHash() === expected[1],
          `Advanced replay verification failed at mission ${mission + 1}`,
        );
        hashCursor++;
      }
      // Mission hashes precede frame publication at the same boundary. Recovery
      // adopts every published frame before allowing the next mission to run.
      applyTerrain(end);
      if (includeTelemetry && mission + 1 <= until) telemetrySamples.push(sim.telemetry());
      if (mission + 1 <= until) onMissionTelemetry?.(sim.telemetry());
      if (mission + 1 === until)
        recovered = { telemetry: sim.telemetry(), snapshot: sim.snapshot() };
    }
    if (verificationMission === record.missionTicks) {
      required(
        cursor === record.inputs.length &&
          hashCursor === record.hashes.length &&
          (!regional || terrainCursor === record.terrainEvents.length),
        'Unconsumed Advanced recording entries',
      );
      required(sim.stateHash() === record.finalHash, 'Advanced final replay verification failed');
    }
    const result = {
      verified: true,
      verificationScope: verificationMission === record.missionTicks ? 'complete' : 'prefix',
      verifiedThroughMission: verificationMission,
      experimental: true,
      scored: false,
      comparison,
      ...(includeTelemetry ? { telemetryHz: ADVANCED_MISSION_HZ, telemetrySamples } : {}),
      ...recovered,
    };
    verifiedComparisons.set(result, {
      comparison,
      complete: until === record.missionTicks && verificationMission === record.missionTicks,
      customEvaluator: rateEvaluator !== undefined,
    });
    return result;
  } finally {
    sim.dispose();
  }
}
