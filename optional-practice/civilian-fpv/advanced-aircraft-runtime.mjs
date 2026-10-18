import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
} from '../../game/data-json.mjs';
import RAPIER from './vendor/rapier/rapier.mjs';
import { initWorldRuntime, WORLD_COLLISION_BACKEND } from './world-collision.mjs';
import { packTerrainCollider } from './advanced-terrain.mjs';
import { validateAircraftTerrainFrame } from './aircraft-terrain.mjs';
import {
  validateAircraftPhysics,
  createAircraftControllerTune,
  validateAircraftControllerTune,
  createAircraftController,
  stepAircraftPropulsion,
  aircraftBodyForces,
} from './aircraft-physics.mjs';
import {
  createAircraftResponseDescriptor,
  validateAircraftResponseDescriptor,
  createAircraftResponseEvaluator,
} from './aircraft-response.mjs';
import { createTunedResponse } from './flight-response.mjs';
import {
  AIRCRAFT_RECORDING_FORMAT,
  AIRCRAFT_RECORDING_BYTES,
  AIRCRAFT_SNAPSHOT_BYTES,
  createAircraftRecorder,
  validateAircraftRecording,
} from './aircraft-recording.mjs';

export const AIRCRAFT_BACKEND = 'civilian-quad-aircraft.v1';
export const AIRCRAFT_REGIONAL_BACKEND = 'civilian-quad-aircraft-regional.v1';
export const AIRCRAFT_SNAPSHOT_FORMAT = 'AdvancedAircraftSnapshot.v1';
const AXES = ['x', 'y', 'z'];
const CONTROLS = ['roll', 'pitch', 'yaw', 'throttle'];
const clone = (value) => structuredClone(value);
const zero = () => ({ x: 0, y: 0, z: 0 });
const neutral = () => ({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
const finite = (value, low = -1e6, high = 1e6) =>
  Number.isFinite(value) && value >= low && value <= high;
const safeTick = (value) =>
  Number.isSafeInteger(value) && value >= 0 && value <= Math.floor(Number.MAX_SAFE_INTEGER / 40000);
const plain = (value, maxBytes = 65536) =>
  boundedJSON(value, { maxBytes, maxNodes: 10000, maxDepth: 20 });
function vector(value) {
  exactKeys(value, AXES, 'Aircraft vector');
  required(
    AXES.every((axis) => finite(value[axis])),
    'Invalid aircraft vector',
  );
  return clone(value);
}
function rotate(q, v, inverse = false) {
  const x = inverse ? -q.x : q.x,
    y = inverse ? -q.y : q.y,
    z = inverse ? -q.z : q.z;
  const tx = 2 * (y * v.z - z * v.y),
    ty = 2 * (z * v.x - x * v.z),
    tz = 2 * (x * v.y - y * v.x);
  return {
    x: v.x + q.w * tx + y * tz - z * ty,
    y: v.y + q.w * ty + z * tx - x * tz,
    z: v.z + q.w * tz + x * ty - y * tx,
  };
}
function encode(bytes) {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    text += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(text);
}
function decode(value) {
  required(
    typeof value === 'string' &&
      value.length <= 12 * 1024 * 1024 &&
      /^[A-Za-z0-9+/]*={0,2}$/.test(value),
    'Invalid aircraft physics checkpoint',
  );
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  required(encode(bytes) === value, 'Invalid aircraft checkpoint encoding');
  return bytes;
}
function hash(bytes, hidden) {
  let value = 2166136261;
  for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0;
  for (const byte of new TextEncoder().encode(JSON.stringify(hidden)))
    value = Math.imul(value ^ byte, 16777619) >>> 0;
  return value.toString(16).padStart(8, '0');
}
function validateInput(source) {
  const sample = plain(source, 1024);
  exactKeys(sample, ['sequence', 'timestampUs', 'controls'], 'Aircraft input sample');
  exactKeys(sample.controls, CONTROLS, 'Aircraft calibrated input');
  required(
    Number.isSafeInteger(sample.sequence) &&
      sample.sequence >= 0 &&
      Number.isSafeInteger(sample.timestampUs) &&
      sample.timestampUs >= 0 &&
      CONTROLS.every((key) => finite(sample.controls[key], key === 'throttle' ? 0 : -1, 1)),
    'Invalid normalized aircraft input',
  );
  return sample;
}
function physicalConfiguration(config) {
  const result = clone(config);
  delete result.aircraft.id;
  for (const key of [
    'camera',
    'profileId',
    'profileRevision',
    'setupId',
    'simulationIdentity',
    'name',
    'id',
    'revision',
    'createdAt',
    'updatedAt',
    'preset',
    'advanced',
  ])
    delete result.configuration[key];
  return result;
}
function configurationIdentity(config) {
  return dataIdentity(physicalConfiguration(config));
}
export function aircraftFlightIdentities(config, { terrainIdentity = null } = {}) {
  required(
    [AIRCRAFT_BACKEND, AIRCRAFT_REGIONAL_BACKEND].includes(config.backend),
    'Unsupported aircraft comparison configuration',
  );
  const physical = physicalConfiguration(config);
  const response = physical.response.response;
  physical.response.response = response.rates
    ? { throttle: clone(response.rates.throttle), maxTilt: response.maxTilt }
    : { maxTilt: response.maxTilt, throttle: 'legacy-linear' };
  // The one canonical descriptor owns response behavior; presentation config
  // may contain a duplicated saved setup for UI reconstruction only.
  delete physical.configuration.response;
  delete physical.configuration.rateProfile;
  delete physical.configuration.rates;
  return {
    format: 'AdvancedComparison.v1',
    comparisonClass: dataIdentity({ physical, terrainIdentity }),
    simulationIdentity:
      terrainIdentity === null
        ? configurationIdentity(config)
        : dataIdentity({
            configuration: configurationIdentity(config),
            terrain: terrainIdentity,
          }),
    terrainIdentity,
    scored: false,
  };
}

/** The legacy implementation remains in advanced-simulation.mjs. This backend
 * has no practice-duration limit and never includes recorder state in dynamics. */
export function createAircraftSimulation(options = {}) {
  const aircraft = validateAircraftPhysics(options.aircraft);
  const regional = options.terrain !== undefined;
  if (regional)
    required(
      options.terrain?.format === 'AdvancedRegionalTerrain.v1' && options.floor === false,
      'Terrain-backed aircraft require an explicit terrain mode and no synthetic floor',
    );
  const hz = options.frequency ?? 500;
  required(
    [250, 500, 1000].includes(hz) || (options.numericalReference === true && hz === 2000),
    'Unsupported fixed aircraft frequency',
  );
  const missionSteps = hz / 50,
    dt = 1 / hz;
  const frozen = plain(options.configuration ?? {});
  const descriptor =
    options.response?.format === 'AircraftResponse.v1'
      ? validateAircraftResponseDescriptor(options.response)
      : createAircraftResponseDescriptor(
          options.response ??
            frozen.response ??
            createTunedResponse(options.rateProfile ?? frozen.rateProfile),
          {
            mode: options.assist?.mode ?? options.mode ?? 'acro',
            levelGain: options.assist?.levelGain ?? 4,
          },
        );
  required(
    options.rateEvaluator === undefined,
    'Aircraft workers require a serializable response descriptor',
  );
  const response = createAircraftResponseEvaluator(descriptor);
  const tune = validateAircraftControllerTune(
    options.controller ?? createAircraftControllerTune(aircraft),
  );
  const obstacles = plain(options.obstacles ?? [], 128 * 1024);
  required(
    Array.isArray(obstacles) && obstacles.length <= 512 && (!regional || !obstacles.length),
    'Invalid aircraft obstacles',
  );
  const identifiers = new Set();
  const validId = (id) =>
    typeof id === 'string' && id.length > 0 && id.length <= 128 && !identifiers.has(id);
  for (const box of obstacles) {
    exactKeys(box, ['id', 'min', 'max'], 'Aircraft obstacle');
    required(validId(box.id), 'Duplicate aircraft obstacle');
    identifiers.add(box.id);
    vector(box.min);
    vector(box.max);
    required(
      AXES.every((axis) => box.max[axis] > box.min[axis]),
      'Empty aircraft obstacle',
    );
  }
  const dynamic = plain(options.dynamicColliders ?? [], 65536);
  required(Array.isArray(dynamic) && dynamic.length <= 128, 'Invalid moving aircraft obstacles');
  for (const item of dynamic) {
    exactKeys(
      item,
      [
        'id',
        'position',
        'radius',
        'height',
        ...(Object.hasOwn(item, 'enabled') ? ['enabled'] : []),
        ...(Object.hasOwn(item, 'shape') ? ['shape'] : []),
      ],
      'Moving aircraft obstacle',
    );
    required(
      validId(item.id) && finite(item.radius, 0.01, 100) && finite(item.height, 0.01, 100),
      'Invalid moving obstacle',
    );
    identifiers.add(item.id);
    vector(item.position);
    required(
      (item.enabled === undefined || typeof item.enabled === 'boolean') &&
        (item.shape === undefined || ['sphere', 'cylinder'].includes(item.shape)),
      'Invalid moving obstacle shape',
    );
  }
  const config = {
    backend: regional ? AIRCRAFT_REGIONAL_BACKEND : AIRCRAFT_BACKEND,
    ...(regional ? { terrain: { format: 'AdvancedRegionalTerrain.v1' } } : {}),
    collision: WORLD_COLLISION_BACKEND,
    frequency: hz,
    aircraft,
    controller: tune,
    response: descriptor,
    spawn: vector(options.spawn ?? { x: 0, y: 2, z: 0 }),
    initialVelocity: vector(options.initialVelocity ?? zero()),
    gravity: vector(options.gravity ?? { x: 0, y: -9.81, z: 0 }),
    wind: vector(options.wind ?? zero()),
    floor: options.floor !== false,
    obstacles,
    dynamicColliders: dynamic,
    configuration: frozen,
  };
  const identity = configurationIdentity(config);
  const controller = createAircraftController({ aircraft, tune });
  let world,
    body,
    bodyHandle,
    state,
    queue = [],
    terrain = null,
    terrainHandles = [],
    actors = [],
    staticHandles = [],
    recorder,
    archiveGeneration = 0,
    disposed = false,
    transaction = null,
    serial = 0;
  const idleContact = () => ({
    touching: false,
    grounded: false,
    normal: zero(),
    impactSpeed: 0,
    contacts: 0,
    ids: [],
    entries: [],
    support: null,
  });
  function live() {
    required(!disposed, 'Aircraft simulation is disposed');
  }
  function unlocked() {
    live();
    required(!transaction, 'An aircraft transaction is pending');
  }
  function addHull(target, reference) {
    const g = aircraft.geometry,
      h = g.bodyHalfExtents;
    target.createCollider(
      RAPIER.ColliderDesc.cuboid(h.x, h.y, h.z)
        .setTranslation(-g.centerOfMass.x, -g.centerOfMass.y, -g.centerOfMass.z)
        .setDensity(0)
        .setFriction(0.5)
        .setRestitution(0.05),
      reference,
    );
    for (const rotor of g.rotors)
      target.createCollider(
        RAPIER.ColliderDesc.cylinder(g.ducted ? Math.max(h.y, 0.006) : 0.003, g.propellerRadius)
          .setTranslation(rotor.position.x, rotor.position.y, rotor.position.z)
          .setDensity(0)
          .setFriction(0.5)
          .setRestitution(0.05),
        reference,
      );
  }
  function makeWorld() {
    const target = new RAPIER.World(config.gravity);
    target.timestep = dt;
    target.integrationParameters.maxCcdSubsteps = 4;
    target.integrationParameters.normalizedAllowedLinearError = 0.0001;
    target.integrationParameters.numSolverIterations = 12;
    const fixed = [];
    if (config.floor)
      fixed.push({
        id: 'floor',
        handle: target.createCollider(
          new RAPIER.ColliderDesc(new RAPIER.HalfSpace({ x: 0, y: 1, z: 0 })).setFriction(0.5),
        ).handle,
      });
    for (const box of obstacles)
      fixed.push({
        id: box.id,
        handle: target.createCollider(
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
        ).handle,
      });
    const reference = target.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(config.spawn.x, config.spawn.y, config.spawn.z)
        .setLinvel(config.initialVelocity.x, config.initialVelocity.y, config.initialVelocity.z)
        .setAdditionalMassProperties(aircraft.mass, zero(), aircraft.inertia, {
          x: 0,
          y: 0,
          z: 0,
          w: 1,
        })
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    addHull(target, reference);
    const moving = dynamic.map((item) => {
      const actor = target.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          item.position.x,
          item.position.y,
          item.position.z,
        ),
      );
      const collider = target.createCollider(
        (item.shape === 'sphere'
          ? RAPIER.ColliderDesc.ball(item.radius)
          : RAPIER.ColliderDesc.cylinder(item.height / 2, item.radius)
        ).setFriction(0.5),
        actor,
      );
      actor.setEnabled(item.enabled !== false);
      return { id: item.id, bodyHandle: actor.handle, handle: collider.handle };
    });
    return { target, reference, fixed, moving };
  }
  function physicalState() {
    const physical = clone(state);
    delete physical.acceptedSequence;
    delete physical.acceptedTimestampUs;
    return {
      state: physical,
      controller: controller.snapshot(),
      terrainIdentity: terrain?.identity ?? null,
      terrainHandles,
      actors,
    };
  }
  function stateHash() {
    return hash(world.takeSnapshot(), physicalState());
  }
  function capture(forRecording = false) {
    const snapshot = {
      format: 'AircraftCheckpoint.v1',
      identity,
      bodyHandle,
      world: encode(world.takeSnapshot()),
      state: clone(state),
      controller: controller.snapshot(),
      pending: forRecording ? [] : clone(queue),
      terrain: clone(terrain),
      terrainHandles: clone(terrainHandles),
      actors: clone(actors),
    };
    if (forRecording) {
      snapshot.state.acceptedSequence = snapshot.state.consumedSequence;
      snapshot.state.acceptedTimestampUs = snapshot.state.consumedTimestampUs;
    }
    return snapshot;
  }
  function reset() {
    unlocked();
    world?.free();
    const created = makeWorld();
    world = created.target;
    body = created.reference;
    bodyHandle = body.handle;
    staticHandles = created.fixed;
    actors = created.moving;
    terrain = null;
    terrainHandles = [];
    queue = [];
    controller.reset();
    state = {
      missionTick: 0,
      substep: 0,
      controls: neutral(),
      target: neutral(),
      sensors: { roll: 0, pitch: 0, yaw: 0 },
      motorSpeeds: [0, 0, 0, 0],
      voltage: aircraft.battery.fullVoltage,
      current: 0,
      usedAh: 0,
      noiseState: 0x52ca31,
      consumedSequence: -1,
      consumedTimestampUs: 0,
      acceptedSequence: -1,
      acceptedTimestampUs: 0,
      contact: idleContact(),
    };
    recorder = createAircraftRecorder({
      identity,
      config,
      checkpoint: capture(true),
      hash: stateHash(),
      origin: 'fresh',
      ...(options.recording === false ? { enabled: false } : (options.recordingOptions ?? {})),
    });
    archiveGeneration++;
  }
  function restoreInternal(saved) {
    const candidate = RAPIER.World.restoreSnapshot(
      saved.world instanceof Uint8Array ? saved.world : decode(saved.world),
    );
    required(candidate && candidate.getRigidBody(saved.bodyHandle), 'Missing aircraft body');
    try {
      controller.restore(saved.controller);
    } catch (error) {
      candidate.free();
      throw error;
    }
    world.free();
    world = candidate;
    bodyHandle = saved.bodyHandle;
    body = world.getRigidBody(bodyHandle);
    state = clone(saved.state);
    queue = clone(saved.pending);
    terrain = clone(saved.terrain);
    terrainHandles = clone(saved.terrainHandles);
    actors = clone(saved.actors);
  }
  function transactionCapture() {
    return {
      format: 'AircraftCheckpoint.v1',
      identity,
      bodyHandle,
      world: world.takeSnapshot(),
      state: clone(state),
      controller: controller.snapshot(),
      pending: clone(queue),
      terrain,
      terrainHandles: clone(terrainHandles),
      actors: clone(actors),
    };
  }
  function contacts(previousVelocity) {
    const result = idleContact();
    result.contacts = state.contact.contacts;
    const possible = [
      ...staticHandles,
      ...terrainHandles,
      ...actors.map((item) => ({ ...item, moving: true })),
    ];
    for (const obstacle of possible) {
      if (obstacle.moving && !world.getRigidBody(obstacle.bodyHandle).isEnabled()) continue;
      const collider = world.getCollider(obstacle.handle);
      if (!collider) continue;
      let chosen = null;
      for (let index = 0; index < body.numColliders(); index++)
        world.contactPair(collider, body.collider(index), (manifold, flipped) => {
          let close = false;
          for (let contact = 0; contact < manifold.numContacts(); contact++)
            close ||= manifold.contactDist(contact) <= 0.003;
          if (!close) return;
          const normal = manifold.normal(),
            sign = flipped ? -1 : 1;
          const direction = { x: normal.x * sign, y: normal.y * sign, z: normal.z * sign };
          if (!chosen || direction.y > chosen.y) chosen = direction;
          result.impactSpeed = Math.max(
            result.impactSpeed,
            -AXES.reduce((sum, axis) => sum + previousVelocity[axis] * direction[axis], 0),
          );
        });
      if (chosen) {
        result.touching = true;
        result.ids.push(obstacle.id);
        result.entries.push({ id: obstacle.id, normal: chosen, moving: obstacle.moving === true });
        if (!result.support || chosen.y > result.normal.y) {
          result.normal = chosen;
          if (chosen.y >= 0.5) result.support = { id: obstacle.id, normal: chosen };
        }
      }
    }
    result.grounded = result.support !== null && Math.abs(body.linvel().y) < 0.3;
    if (result.touching && !state.contact.touching) result.contacts++;
    result.impactSpeed = Math.max(result.impactSpeed, state.contact.impactSpeed);
    state.contact = result;
  }
  function hullExtents() {
    const q = body.rotation(),
      g = aircraft.geometry,
      h = g.bodyHalfExtents;
    let lowest = Infinity,
      highest = -Infinity;
    for (const x of [-h.x, h.x])
      for (const y of [-h.y, h.y])
        for (const z of [-h.z, h.z]) {
          const height = rotate(q, {
            x: x - g.centerOfMass.x,
            y: y - g.centerOfMass.y,
            z: z - g.centerOfMass.z,
          }).y;
          lowest = Math.min(lowest, height);
          highest = Math.max(highest, height);
        }
    const up = rotate(q, { x: 0, y: 1, z: 0 });
    const diskVertical = g.propellerRadius * Math.sqrt(Math.max(0, 1 - up.y * up.y));
    for (const rotor of g.rotors) {
      const height = rotate(q, rotor.position).y;
      const extent = diskVertical + Math.abs(up.y) * (g.ducted ? Math.max(h.y, 0.006) : 0.003);
      lowest = Math.min(lowest, height - extent);
      highest = Math.max(highest, height + extent);
    }
    return { supportHeight: -lowest, topHeight: highest };
  }
  function telemetry() {
    live();
    const q = body.rotation(),
      angular = rotate(q, body.angvel(), true);
    return {
      backend: config.backend,
      experimental: true,
      scored: false,
      frequency: hz,
      missionHz: 50,
      missionTick: state.missionTick,
      substep: state.substep,
      seconds: state.missionTick / 50,
      position: { ...body.translation() },
      velocity: { ...body.linvel() },
      orientation: { ...q },
      requestedRates: { roll: state.target.roll, pitch: state.target.pitch, yaw: state.target.yaw },
      achievedRates: {
        roll: (-angular.z * 180) / Math.PI,
        pitch: (-angular.x * 180) / Math.PI,
        yaw: (-angular.y * 180) / Math.PI,
      },
      calibratedInput: clone(state.controls),
      motorSpeeds: [...state.motorSpeeds],
      voltage: state.voltage,
      current: state.current,
      usedAh: state.usedAh,
      consumedSequence: state.consumedSequence,
      consumedTimestampUs: state.consumedTimestampUs,
      sampleAgeUs:
        state.consumedSequence < 0
          ? null
          : Math.max(0, state.substep * (1e6 / hz) - state.consumedTimestampUs),
      devicePollHz: null,
      saturated: controller.telemetry().saturated,
      radius: aircraft.radius,
      ...hullExtents(),
      contact: clone(state.contact),
      dynamicColliders: actors.map((actor) => {
        const moving = world.getRigidBody(actor.bodyHandle);
        return { id: actor.id, position: { ...moving.translation() }, enabled: moving.isEnabled() };
      }),
      recordingStatus: recorder.status(),
      archiveStatus: { generation: archiveGeneration, ...recorder.sealedStatus() },
      ...(regional
        ? { terrain: { frameIdentity: terrain?.identity ?? null, ...clone(state.contact) } }
        : {}),
    };
  }
  function enqueueInput(source) {
    unlocked();
    const sample = validateInput(source);
    required(
      queue.length < 4096 &&
        sample.sequence > state.acceptedSequence &&
        sample.timestampUs >= state.acceptedTimestampUs,
      'Input queue is full or sample order is invalid',
    );
    state.acceptedSequence = sample.sequence;
    state.acceptedTimestampUs = sample.timestampUs;
    queue.push(sample);
  }
  function noise() {
    let bits = state.noiseState;
    bits ^= bits << 13;
    bits ^= bits >>> 17;
    bits ^= bits << 5;
    state.noiseState = bits >>> 0;
    return state.noiseState / 2147483648 - 1;
  }
  function validateMotions(source = []) {
    const motions = plain(source, 65536),
      seen = new Set();
    required(
      Array.isArray(motions) && motions.length <= actors.length,
      'Invalid actor motion list',
    );
    for (const motion of motions) {
      exactKeys(
        motion,
        ['id', 'from', 'to', ...(Object.hasOwn(motion, 'enabled') ? ['enabled'] : [])],
        'Actor motion',
      );
      required(
        motion.enabled === undefined || typeof motion.enabled === 'boolean',
        'Invalid actor activation',
      );
      const actor = actors.find((value) => value.id === motion.id);
      required(actor && !seen.has(motion.id), 'Unknown or duplicate actor motion');
      seen.add(motion.id);
      vector(motion.from);
      vector(motion.to);
      const current = world.getRigidBody(actor.bodyHandle).translation();
      required(
        AXES.every((axis) => Math.abs(current[axis] - motion.from[axis]) < 0.001),
        'Actor motion starts outside its accepted pose',
      );
    }
    return motions;
  }
  function substep(events, motions, fraction) {
    const timestampUs = state.substep * (1e6 / hz);
    let sample;
    while (queue.length && queue[0].timestampUs <= timestampUs) sample = queue.shift();
    if (sample) {
      state.controls = sample.controls;
      state.consumedSequence = sample.sequence;
      state.consumedTimestampUs = sample.timestampUs;
      events.push([
        'input',
        state.substep,
        sample.sequence,
        sample.timestampUs,
        sample.controls.roll,
        sample.controls.pitch,
        sample.controls.yaw,
        sample.controls.throttle,
      ]);
    }
    for (const motion of motions) {
      const actor = actors.find((item) => item.id === motion.id);
      const actorBody = world.getRigidBody(actor.bodyHandle);
      if (motion.enabled !== undefined) actorBody.setEnabled(motion.enabled);
      const position = Object.fromEntries(
        AXES.map((axis) => [
          axis,
          motion.from[axis] + (motion.to[axis] - motion.from[axis]) * fraction,
        ]),
      );
      if (!actorBody.isEnabled()) actorBody.setTranslation(position, false);
      actorBody.setNextKinematicTranslation(position);
    }
    const q = body.rotation(),
      velocity = body.linvel(),
      angular = rotate(q, body.angvel(), true);
    const vibration = state.substep % 2 === 0 ? aircraft.vibration : -aircraft.vibration;
    state.sensors = {
      roll: -angular.z + noise() * aircraft.sensorNoise + vibration,
      pitch: -angular.x + noise() * aircraft.sensorNoise - vibration,
      yaw: -angular.y + noise() * aircraft.sensorNoise,
    };
    state.target = response(state.controls, q);
    const output = controller.step({
      controls: state.controls,
      target: state.target,
      sensors: state.sensors,
      dt,
      voltage: state.voltage,
      usedAh: state.usedAh,
    });
    const propulsion = stepAircraftPropulsion(aircraft, {
      motorSpeeds: state.motorSpeeds,
      commands: output.motors,
      usedAh: state.usedAh,
      dt,
    });
    for (const key of ['motorSpeeds', 'voltage', 'current', 'usedAh']) state[key] = propulsion[key];
    const forces = aircraftBodyForces(aircraft, {
      thrusts: propulsion.thrusts,
      reactionTorques: propulsion.reactionTorques,
      linearVelocity: rotate(
        q,
        {
          x: velocity.x - config.wind.x,
          y: velocity.y - config.wind.y,
          z: velocity.z - config.wind.z,
        },
        true,
      ),
      angularVelocity: angular,
    });
    body.resetForces(true);
    body.resetTorques(true);
    body.addForce(rotate(q, forces.force), true);
    body.addTorque(rotate(q, forces.torque), true);
    world.step();
    contacts(velocity);
    state.substep++;
  }
  // Requested explicitly by the isolated response bench. These copied samples
  // are observations only: they never enter dynamics, checkpoints or hashes.
  function physicsSample() {
    const angular = rotate(body.rotation(), body.angvel(), true),
      diagnostic = controller.telemetry();
    return {
      substep: state.substep,
      seconds: state.substep / hz,
      requestedRates: { roll: state.target.roll, pitch: state.target.pitch, yaw: state.target.yaw },
      achievedRates: {
        roll: (-angular.z * 180) / Math.PI,
        pitch: (-angular.x * 180) / Math.PI,
        yaw: (-angular.y * 180) / Math.PI,
      },
      motors: [...state.motorSpeeds],
      requestedTorque: diagnostic.requestedTorque,
      achievedTorque: diagnostic.achievedTorque,
      saturated: diagnostic.saturated,
    };
  }
  function runMission(motionSource, diagnostics = false) {
    required(!regional || terrain, 'Verified terrain is required before aircraft flight');
    required(safeTick(state.missionTick + 1), 'Aircraft clock exhausted safe integer precision');
    const motions = validateMotions(motionSource),
      events = [];
    if (motions.length) events.push(['motion', state.missionTick, motions]);
    state.contact.impactSpeed = 0;
    const trace = [{ ...body.translation(), ...hullExtents() }],
      physicsSamples = diagnostics ? [] : null;
    for (let step = 0; step < missionSteps; step++) {
      substep(events, motions, (step + 1) / missionSteps);
      trace.push({ ...body.translation(), ...hullExtents() });
      if (diagnostics) physicsSamples.push(physicsSample());
    }
    state.missionTick++;
    return { trace, events, physicsSamples };
  }
  function accepted(events) {
    recorder.append({
      events,
      tick: state.missionTick,
      stateHash: stateHash(),
      checkpoint: () => capture(true),
    });
  }
  function stageTerrainFrame(source) {
    unlocked();
    required(regional, 'This aircraft session does not accept terrain frames');
    const frame = validateAircraftTerrainFrame(source),
      before = transactionCapture(),
      id = ++serial;
    if (frame.identity === terrain?.identity) {
      transaction = { kind: 'terrain', id, before, events: [] };
      return { transaction: id, identity: frame.identity, unchanged: true };
    }
    try {
      const packed = frame.colliders.map(packTerrainCollider);
      const retained = new Map(terrainHandles.map((item) => [item.key, item]));
      const wanted = new Set(packed.map((item) => item.key));
      for (const item of terrainHandles)
        if (!wanted.has(item.key)) world.removeCollider(world.getCollider(item.handle), true);
      terrainHandles = frame.colliders.map(
        (collider, index) =>
          retained.get(packed[index].key) ?? {
            id: collider.id,
            key: packed[index].key,
            handle: world.createCollider(
              RAPIER.ColliderDesc.trimesh(
                new Float32Array(collider.vertices),
                new Uint32Array(collider.indices),
              )
                .setFriction(0.7)
                .setRestitution(0.05),
            ).handle,
          },
      );
      for (const entry of terrainHandles)
        if (!retained.has(entry.key)) {
          const collider = world.getCollider(entry.handle);
          for (let part = 0; part < body.numColliders(); part++) {
            const contact = body.collider(part).contactCollider(collider, 0.001);
            required(
              !contact || contact.distance >= -0.001,
              'New terrain intersects the aircraft collision geometry',
            );
          }
        }
      required(
        world.takeSnapshot().byteLength <= 8 * 1024 * 1024,
        'Active terrain exceeds aircraft physics capacity',
      );
      terrain = frame;
      transaction = {
        kind: 'terrain',
        id,
        before,
        events: [['terrain', state.missionTick, frame]],
      };
      return { transaction: id, identity: frame.identity, unchanged: false };
    } catch (error) {
      restoreInternal(before);
      throw error;
    }
  }
  function commit(kind, { transaction: id, accepted: admitted }) {
    live();
    required(
      transaction?.kind === kind && transaction.id === id && typeof admitted === 'boolean',
      'Unknown aircraft transaction',
    );
    const pending = transaction;
    if (!admitted) restoreInternal(pending.before);
    transaction = null;
    if (admitted && pending.events.length) accepted(pending.events);
    else if (admitted && kind === 'mission') accepted([]);
    return { admitted, adopted: admitted, telemetry: telemetry() };
  }
  function stepMission({ admitMotion, motions, diagnostics = false } = {}) {
    unlocked();
    required(typeof diagnostics === 'boolean', 'Invalid aircraft diagnostics request');
    const before = transactionCapture();
    try {
      const result = runMission(motions, diagnostics);
      const admitted = admitMotion
        ? admitMotion(result.trace[0], result.trace.at(-1), clone(result.trace))
        : true;
      required(typeof admitted === 'boolean', 'Motion admission must return a boolean');
      if (!admitted) restoreInternal(before);
      else accepted(result.events);
      return {
        admitted,
        telemetry: telemetry(),
        trace: result.trace,
        ...(diagnostics
          ? { physicsHz: hz, physicsSamples: admitted ? result.physicsSamples : [] }
          : {}),
      };
    } catch (error) {
      restoreInternal(before);
      throw error;
    }
  }
  // Snapshot validation checks the actual restored physics properties, not only
  // caller-supplied metadata. A clip remains checkpoint-origin and unscored.
  function validateCheckpoint(saved) {
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
        'terrain',
        'terrainHandles',
        'actors',
      ],
      'Aircraft checkpoint',
    );
    required(
      saved.format === 'AircraftCheckpoint.v1' &&
        saved.identity === identity &&
        saved.bodyHandle === bodyHandle,
      'Aircraft checkpoint configuration changed',
    );
    exactKeys(saved.state, Object.keys(state), 'Aircraft state');
    const next = saved.state;
    required(
      safeTick(next.missionTick) &&
        next.substep === next.missionTick * missionSteps &&
        Array.isArray(next.motorSpeeds) &&
        next.motorSpeeds.length === 4 &&
        next.motorSpeeds.every((value) => finite(value, 0, 1)) &&
        finite(next.usedAh, 0, aircraft.battery.capacityAh) &&
        finite(next.current, 0, 10000) &&
        finite(next.voltage, 0, 100) &&
        Number.isSafeInteger(next.noiseState) &&
        next.noiseState > 0 &&
        next.noiseState <= 0xffffffff,
      'Invalid aircraft dynamics checkpoint',
    );
    validateInput({ sequence: 0, timestampUs: 0, controls: next.controls });
    for (const key of ['target', 'sensors']) {
      exactKeys(
        next[key],
        key === 'target' ? CONTROLS : ['roll', 'pitch', 'yaw'],
        'Aircraft response state',
      );
      required(
        Object.values(next[key]).every((value) => finite(value)),
        'Invalid response checkpoint',
      );
    }
    required(
      finite(next.target.throttle, 0, 1) &&
        Array.isArray(saved.pending) &&
        saved.pending.length <= 4096,
      'Invalid aircraft queue checkpoint',
    );
    for (const key of ['acceptedSequence', 'consumedSequence'])
      required(Number.isSafeInteger(next[key]) && next[key] >= -1, 'Invalid input cursor');
    for (const key of ['acceptedTimestampUs', 'consumedTimestampUs'])
      required(Number.isSafeInteger(next[key]) && next[key] >= 0, 'Invalid input timestamp');
    let sequence = next.consumedSequence,
      timestamp = next.consumedTimestampUs;
    for (const sample of saved.pending) {
      validateInput(sample);
      required(
        sample.sequence > sequence && sample.timestampUs >= timestamp,
        'Invalid pending input order',
      );
      sequence = sample.sequence;
      timestamp = sample.timestampUs;
    }
    required(
      sequence === next.acceptedSequence && timestamp === next.acceptedTimestampUs,
      'Invalid accepted input cursor',
    );
    exactKeys(next.contact, Object.keys(idleContact()), 'Aircraft contact state');
    required(
      typeof next.contact.touching === 'boolean' &&
        typeof next.contact.grounded === 'boolean' &&
        finite(next.contact.impactSpeed, 0, 1e6) &&
        Number.isSafeInteger(next.contact.contacts) &&
        next.contact.contacts >= 0 &&
        Array.isArray(next.contact.ids) &&
        Array.isArray(next.contact.entries),
      'Invalid aircraft contacts',
    );
    vector(next.contact.normal);
    const frame = saved.terrain === null ? null : validateAircraftTerrainFrame(saved.terrain);
    required(regional || frame === null, 'Unexpected terrain checkpoint');
    required(
      Array.isArray(saved.terrainHandles) &&
        saved.terrainHandles.length === (frame?.colliders.length ?? 0) &&
        Array.isArray(saved.actors) &&
        canonicalJSON(saved.actors) === canonicalJSON(actors),
      'Invalid checkpoint collider registry',
    );
    const probe = RAPIER.World.restoreSnapshot(decode(saved.world));
    const expected = makeWorld();
    try {
      const restoredBody = probe?.getRigidBody(saved.bodyHandle);
      required(
        restoredBody &&
          probe.bodies.len() === 1 + dynamic.length &&
          probe.colliders.len() === expected.target.colliders.len() + saved.terrainHandles.length &&
          restoredBody.numColliders() === 5 &&
          probe.timestep === Math.fround(dt),
        'Unexpected aircraft physics objects',
      );
      required(
        AXES.every(
          (axis) => Math.fround(probe.gravity[axis]) === Math.fround(expected.target.gravity[axis]),
        ),
        'Aircraft gravity changed',
      );
      for (const key of [
        'dt',
        'lengthUnit',
        'contact_erp',
        'normalizedAllowedLinearError',
        'normalizedPredictionDistance',
        'numSolverIterations',
        'numInternalPgsIterations',
        'maxCcdSubsteps',
      ])
        required(
          probe.integrationParameters[key] === expected.target.integrationParameters[key],
          'Aircraft solver properties changed',
        );
      function shape(collider, actorGeometry = false) {
        required(collider, 'Missing checkpoint collider');
        const value = collider.shape;
        const normalized = (item) =>
          typeof item === 'number'
            ? Math.fround(item)
            : Array.isArray(item) || ArrayBuffer.isView(item)
              ? Array.from(item, normalized)
              : item && typeof item === 'object'
                ? Object.fromEntries(
                    Object.entries(item).map(([key, child]) => [key, normalized(child)]),
                  )
                : item;
        return canonicalJSON({
          type: collider.shapeType(),
          shape: Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
              key,
              normalized(key === 'flags' ? (item ?? 0) : item),
            ]),
          ),
          translation: collider.translationWrtParent() ?? collider.translation(),
          rotation: collider.rotationWrtParent() ?? collider.rotation(),
          enabled: actorGeometry ? true : collider.isEnabled(),
          sensor: collider.isSensor(),
          density: collider.density(),
          friction: collider.friction(),
          restitution: collider.restitution(),
          groups: collider.collisionGroups(),
          solver: collider.solverGroups(),
        });
      }
      restoredBody.recomputeMassPropertiesFromColliders();
      expected.reference.recomputeMassPropertiesFromColliders();
      for (const key of [
        'mass',
        'principalInertia',
        'localCom',
        'bodyType',
        'isCcdEnabled',
        'gravityScale',
        'linearDamping',
        'angularDamping',
      ])
        required(
          canonicalJSON(restoredBody[key]()) === canonicalJSON(expected.reference[key]()),
          'Aircraft mass or response properties changed',
        );
      for (let i = 0; i < 5; i++)
        required(
          shape(restoredBody.collider(i)) === shape(expected.reference.collider(i)),
          'Aircraft collision geometry changed',
        );
      for (const entry of expected.fixed)
        required(
          shape(probe.getCollider(entry.handle)) ===
            shape(expected.target.getCollider(entry.handle)),
          'Aircraft scene geometry changed',
        );
      for (let i = 0; i < saved.terrainHandles.length; i++) {
        const entry = saved.terrainHandles[i],
          source = frame.colliders[i];
        required(
          entry.id === source.id && entry.key === packTerrainCollider(source).key,
          'Terrain checkpoint identity changed',
        );
        const expectedCollider = expected.target.createCollider(
          RAPIER.ColliderDesc.trimesh(
            new Float32Array(source.vertices),
            new Uint32Array(source.indices),
          )
            .setFriction(0.7)
            .setRestitution(0.05),
        );
        required(
          shape(probe.getCollider(entry.handle)) === shape(expectedCollider),
          'Terrain checkpoint geometry changed',
        );
      }
      for (const entry of actors) {
        const actor = probe.getRigidBody(entry.bodyHandle),
          collider = probe.getCollider(entry.handle);
        required(
          actor?.isKinematic() &&
            actor.numColliders() === 1 &&
            actor.collider(0).handle === entry.handle &&
            shape(collider, true) === shape(expected.target.getCollider(entry.handle), true) &&
            (collider.isEnabled() === actor.isEnabled() ||
              // Rapier applies initial parent disabling to its collider on the
              // first step. Both initial and stepped disabled checkpoints are valid.
              (next.substep === 0 && !actor.isEnabled() && collider.isEnabled())),
          'Moving actor geometry changed',
        );
        for (const key of ['translation', 'linvel', 'angvel']) vector({ ...actor[key]() });
      }
      for (const key of ['translation', 'linvel', 'angvel']) vector({ ...restoredBody[key]() });
      const q = restoredBody.rotation();
      required(
        Object.values(q).every((value) => finite(value, -1.001, 1.001)) &&
          Math.abs(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w - 1) < 0.002,
        'Invalid aircraft orientation',
      );
    } finally {
      probe?.free();
      expected.target.free();
    }
  }
  reset();
  return {
    identity,
    configuration: () => clone(config),
    stateHash,
    telemetry,
    enqueueInput,
    stepMission,
    controllerCapabilities: controller.capabilities,
    qualification: () => ({
      status: 'experimental',
      scored: false,
      defaultEligible: false,
      pending: [
        'reference-aircraft-measurements',
        'qualification-device-performance',
        'experienced-pilot-review',
      ],
    }),
    comparison: () =>
      aircraftFlightIdentities(config, { terrainIdentity: terrain?.identity ?? null }),
    recordingStatus: () => recorder.status(),
    reportPersistence: (value) => recorder.reportPersistence(value),
    readSealedSegment(afterIndex = -1) {
      unlocked();
      return {
        format: 'AircraftSealedRead.v1',
        generation: archiveGeneration,
        identity,
        config: clone(config),
        ...recorder.readSealedSegment(afterIndex),
      };
    },
    finalizeArchive(afterIndex = -1) {
      unlocked();
      recorder.readSealedSegment(afterIndex);
      const finalizedThroughIndex = recorder.sealCurrent({
        checkpoint: () => capture(true),
        stateHash: stateHash(),
      });
      return { ...this.readSealedSegment(afterIndex), finalizedThroughIndex };
    },
    stageTerrainFrame,
    commitTerrainFrame: (decision) => commit('terrain', decision),
    proposeMission({ motions } = {}) {
      unlocked();
      const before = transactionCapture();
      try {
        const result = runMission(motions);
        transaction = { kind: 'mission', id: ++serial, before, events: result.events };
        return { transaction: serial, trace: result.trace, telemetry: telemetry() };
      } catch (error) {
        restoreInternal(before);
        throw error;
      }
    },
    commitMission: (decision) => commit('mission', decision),
    checkpoint() {
      unlocked();
      return capture(true);
    },
    restoreCheckpoint(source) {
      unlocked();
      const saved = boundedJSON(source, {
        maxBytes: 16 * 1024 * 1024,
        maxNodes: 1000000,
        maxArray: 500000,
        maxString: 12 * 1024 * 1024,
        maxDepth: 30,
      });
      validateCheckpoint(saved);
      restoreInternal(saved);
      recorder = createAircraftRecorder({
        identity,
        config,
        checkpoint: capture(true),
        hash: stateHash(),
        ...(options.recording === false ? { enabled: false } : (options.recordingOptions ?? {})),
      });
      archiveGeneration++;
      return telemetry();
    },
    snapshot() {
      unlocked();
      let recording = null;
      try {
        recording = recorder.recording();
      } catch {
        /* Flying and recovery remain available. */
      }
      return {
        format: AIRCRAFT_SNAPSHOT_FORMAT,
        identity,
        config: clone(config),
        checkpoint: capture(),
        hash: stateHash(),
        recording,
        recordingStatus: recorder.status(),
      };
    },
    restore(source) {
      unlocked();
      const saved = boundedJSON(source, {
        maxBytes: AIRCRAFT_SNAPSHOT_BYTES,
        maxNodes: 4000000,
        maxArray: 500000,
        maxString: 12 * 1024 * 1024,
        maxDepth: 40,
      });
      exactKeys(
        saved,
        ['format', 'identity', 'config', 'checkpoint', 'hash', 'recording', 'recordingStatus'],
        'Aircraft snapshot',
      );
      required(
        saved.format === AIRCRAFT_SNAPSHOT_FORMAT &&
          saved.identity === identity &&
          configurationIdentity(saved.config) === identity &&
          /^[a-f0-9]{8}$/.test(saved.hash),
        'Aircraft recovery configuration changed',
      );
      validateCheckpoint(saved.checkpoint);
      const before = transactionCapture();
      const previousRecorder = recorder;
      try {
        restoreInternal(saved.checkpoint);
        required(stateHash() === saved.hash, 'Aircraft recovery hash changed');
        recorder = createAircraftRecorder({
          identity,
          config,
          checkpoint: capture(true),
          hash: stateHash(),
          ...(options.recording === false ? { enabled: false } : (options.recordingOptions ?? {})),
        });
        if (saved.recording && saved.recording.missionTicks === state.missionTick)
          recorder.restore(saved.recording);
        archiveGeneration++;
        return telemetry();
      } catch (error) {
        restoreInternal(before);
        recorder = previousRecorder;
        throw error;
      }
    },
    recording() {
      unlocked();
      return recorder.recording();
    },
    reset,
    dispose() {
      if (!disposed) {
        world.free();
        disposed = true;
        queue = [];
        transaction = null;
      }
    },
  };
}

/** Replay one validated, contiguous segment on an already positioned simulator.
 * Keeping this loop shared prevents archive verification from drifting from clips. */
export async function replayAircraftSegment(
  sim,
  segment,
  { frequency, onMissionTelemetry, signal, yieldEvery = 250 } = {},
) {
  if (signal?.aborted) throw new Error('Aircraft replay verification cancelled');
  let cursor = 0,
    hashCursor = 0;
  const applyTerrain = (tick) => {
    while (segment.events[cursor]?.[0] === 'terrain' && segment.events[cursor][1] === tick) {
      const event = segment.events[cursor++];
      required(event.length === 3, 'Invalid terrain event');
      const staged = sim.stageTerrainFrame(event[2]);
      sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
    }
  };
  for (let tick = segment.startTick; tick < segment.endTick; tick++) {
    applyTerrain(tick);
    let motions;
    if (segment.events[cursor]?.[0] === 'motion' && segment.events[cursor][1] === tick) {
      const event = segment.events[cursor++];
      required(event.length === 3, 'Invalid actor event');
      motions = event[2];
    }
    let lastStep = -1;
    while (
      segment.events[cursor]?.[0] === 'input' &&
      segment.events[cursor][1] < ((tick + 1) * frequency) / 50
    ) {
      const item = segment.events[cursor++];
      required(
        item.length === 8 &&
          Number.isSafeInteger(item[1]) &&
          item[1] > lastStep &&
          item[1] === Math.max((tick * frequency) / 50, Math.ceil(item[3] / (1e6 / frequency))),
        'Aircraft input consumption schedule changed',
      );
      sim.enqueueInput({
        sequence: item[2],
        timestampUs: item[3],
        controls: { roll: item[4], pitch: item[5], yaw: item[6], throttle: item[7] },
      });
      lastStep = item[1];
    }
    sim.stepMission({ motions });
    if (segment.hashes[hashCursor]?.[0] === tick + 1) {
      required(
        sim.stateHash() === segment.hashes[hashCursor++][1],
        'Aircraft replay hash mismatch',
      );
    }
    onMissionTelemetry?.(sim.telemetry());
    if (tick % yieldEvery === 0) {
      if (signal?.aborted) throw new Error('Aircraft replay verification cancelled');
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  applyTerrain(segment.endTick);
  if (signal?.aborted) throw new Error('Aircraft replay verification cancelled');
  required(
    cursor === segment.events.length &&
      hashCursor === segment.hashes.length &&
      sim.stateHash() === segment.finalHash,
    'Aircraft clip contains unconsumed events or a changed final state',
  );
}

export async function replayAircraftRecording(
  source,
  { throughMission, includeTelemetry = false, onMissionTelemetry, signal } = {},
) {
  const record = validateAircraftRecording(source);
  await initWorldRuntime();
  const sim = createAircraftSimulation({
    ...record.config,
    numericalReference: record.config.frequency === 2000,
    recording: false,
  });
  try {
    required(sim.identity === record.identity, 'Aircraft recording configuration changed');
    const until = throughMission ?? record.missionTicks;
    required(
      Number.isSafeInteger(until) &&
        until >= record.startMissionTick &&
        until <= record.missionTicks,
      'Replay point is outside retained clip',
    );
    let recovered = null;
    const samples = includeTelemetry ? [] : null;
    const report = () => {
      const telemetry = sim.telemetry();
      if (telemetry.missionTick <= until) {
        if (includeTelemetry) samples.push(telemetry);
        onMissionTelemetry?.(telemetry);
        if (telemetry.missionTick === until) recovered = { telemetry, snapshot: sim.snapshot() };
      }
    };
    for (let index = 0; index < record.segments.length; index++) {
      if (signal?.aborted) throw new Error('Aircraft replay verification cancelled');
      const segment = record.segments[index];
      if (index === 0) sim.restoreCheckpoint(segment.checkpoint);
      else
        required(
          canonicalJSON(sim.checkpoint()) === canonicalJSON(segment.checkpoint),
          'Aircraft segment checkpoint changed',
        );
      required(sim.stateHash() === segment.initialHash, 'Aircraft clip starting hash changed');
      if (index === 0) report();
      await replayAircraftSegment(sim, segment, {
        frequency: record.config.frequency,
        onMissionTelemetry: report,
        signal,
      });
      if (segment.endTick === until)
        recovered = { telemetry: sim.telemetry(), snapshot: sim.snapshot() };
    }
    required(sim.stateHash() === record.finalHash, 'Aircraft clip final hash changed');
    return {
      verified: true,
      verificationScope: 'checkpoint-clip',
      verifiedThroughMission: record.missionTicks,
      experimental: true,
      scored: false,
      comparison: sim.comparison(),
      ...recovered,
      ...(includeTelemetry ? { telemetryHz: 50, telemetrySamples: samples } : {}),
    };
  } finally {
    sim.dispose();
  }
}

export async function verifyAircraftRecovery(source, { expectedIdentity } = {}) {
  const saved = boundedJSON(source, {
    maxBytes: AIRCRAFT_SNAPSHOT_BYTES,
    maxNodes: 4000000,
    maxArray: 500000,
    maxString: 12 * 1024 * 1024,
    maxDepth: 40,
  });
  required(
    expectedIdentity === undefined || saved.identity === expectedIdentity,
    'Aircraft recovery belongs to another configuration',
  );
  await initWorldRuntime();
  const sim = createAircraftSimulation({
    ...saved.config,
    numericalReference: saved.config?.frequency === 2000,
    recording: false,
  });
  try {
    sim.restore(saved);
    if (saved.recording?.missionTicks === saved.checkpoint.state.missionTick) {
      const checked = await replayAircraftRecording(saved.recording);
      required(
        checked.snapshot.hash === saved.hash,
        'Aircraft recovery differs from retained clip',
      );
    }
    // Origin is explicitly a checkpoint. No claim of verification from takeoff
    // is made when older segments have been evicted or recording was disabled.
    return saved;
  } finally {
    sim.dispose();
  }
}
