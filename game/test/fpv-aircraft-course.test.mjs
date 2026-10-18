import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAircraftCourseSession,
  aircraftCourseTerrain,
  aircraftMissionMotion,
} from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createFlight, createFlightRecorder } from '../../optional-practice/civilian-fpv/model.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { Q } from '../../optional-practice/civilian-fpv/math.mjs';
import { dataIdentity } from '../../game/data-json.mjs';
import { aircraftFlightIdentities } from '../../optional-practice/civilian-fpv/advanced-aircraft-runtime.mjs';
import { createAircraftTerrainFrame } from '../../optional-practice/civilian-fpv/aircraft-terrain.mjs';

const controls = { roll: 0, pitch: 0, yaw: 0, throttle: 0.5 };
const reseal = (value) => {
  const packet = { ...value };
  delete packet.checksum;
  value.checksum = dataIdentity(packet);
  return value;
};
const configuration = (id = listAircraftPresets()[0].id) => {
  const row = createPresetConfiguration(id);
  return {
    response: row.response,
    camera: row.camera,
    advanced: { aircraft: row.aircraft, controller: row.controller },
  };
};
function createClient({ backend } = {}) {
  let simulation;
  return {
    async initialize(options) {
      simulation = createAdvancedSimulation({ ...options, ...(backend ? { backend } : {}) });
      return { telemetry: simulation.telemetry(), comparison: simulation.comparison() };
    },
    async stageTerrainFrame(frame) {
      return simulation.stageTerrainFrame(frame);
    },
    async commitTerrainFrame(value) {
      return simulation.commitTerrainFrame(value);
    },
    async step(sample, motions) {
      simulation.enqueueInput(sample);
      return simulation.stepMission({ motions });
    },
    async snapshot() {
      return simulation.snapshot();
    },
    async telemetry() {
      return simulation.telemetry();
    },
    async restore(value) {
      return simulation.restore(value);
    },
    async recording() {
      return simulation.recording();
    },
    async reportPersistence(value) {
      return simulation.reportPersistence(value);
    },
    async readSealedSegment(afterIndex) {
      return simulation.readSealedSegment(afterIndex);
    },
    async finalizeArchive(afterIndex) {
      return simulation.finalizeArchive(afterIndex);
    },
    dispose() {
      simulation?.dispose();
    },
  };
}

test('optional course challenges freeze separate worker and recovery identities without changing ordinary practice', async (t) => {
  await initAdvancedRuntime();
  const challenge = {
    format: 'AircraftChallengeRules.v1',
    kind: 'timed-practice',
    durationTicks: 1500,
  };
  const build = (rules) =>
    createAircraftCourseSession(
      {
        course: FLIGHT_COURSES[0],
        mode: 'acro',
        legacy: true,
        configuration: { ...configuration(), ...(rules ? { challenge: rules } : {}) },
      },
      { createClient },
    );
  const ordinary = build(),
    timed = build(challenge);
  t.after(() => Promise.all([ordinary.dispose(), timed.dispose()]));
  await ordinary.prepare();
  await timed.prepare();
  assert.equal(
    Object.hasOwn((await ordinary.readSealedSegment()).config.configuration, 'challenge'),
    false,
  );
  assert.deepEqual((await timed.readSealedSegment()).config.configuration.challenge, challenge);
  assert.notEqual(ordinary.identity.configuration, timed.identity.configuration);
  const saved = await timed.exportRecovery();
  await assert.rejects(ordinary.restoreRecovery(saved), /configuration/);
  assert.equal(ordinary.snapshot().ticks, 0);
  const invalid = { ...challenge, durationTicks: 1 };
  assert.throws(() => build(invalid), /duration/);
  assert.throws(
    () =>
      build({
        format: 'AircraftChallengeRules.v1',
        kind: 'battery-endurance',
        takeoffHoldTicks: 25,
        landingHoldTicks: 50,
      }),
    /requires battery depletion/,
  );
});

test('every preset flies Academy and World in both modes with its real geometry and portable response', async () => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  for (const preset of listAircraftPresets())
    for (const legacy of [true, false])
      for (const mode of ['acro', 'self-level']) {
        const flight = createAircraftCourseSession(
          {
            course: legacy ? FLIGHT_COURSES[0] : WORLD_CATALOGUE[0].course,
            legacy,
            mode,
            configuration: configuration(preset.id),
          },
          { createClient, createMission: legacy ? createFlight : createWorldFlight },
        );
        try {
          assert.equal(flight.referenceIdentity(), null);
          await flight.prepare();
          const reference = flight.referenceIdentity();
          assert.ok(Object.isFrozen(reference));
          assert.equal(
            reference.configurationClass,
            aircraftFlightIdentities((await flight.readSealedSegment()).config).comparisonClass,
          );
          assert.equal(
            reference.terrainIdentity,
            flight.snapshot().advancedTelemetry.terrain.frameIdentity,
          );
          flight.arm();
          for (let i = 0; i < 15; i++) await flight.step(controls);
          assert.equal(flight.referenceIdentity(), reference);
          const state = flight.snapshot();
          assert.equal(state.ticks, 15, `${preset.id}/${legacy}/${mode}`);
          assert.equal(state.unscored, true);
          assert.equal(
            state.aircraftRadiusMm,
            configuration(preset.id).advanced.aircraft.radius * 1000,
          );
          assert.ok(state.aircraftSupportHeightMm > 0);
          assert.equal((await flight.recording()).scored, false);
        } finally {
          await flight.dispose();
          assert.equal(flight.referenceIdentity(), null);
        }
      }
});

test('all authored courses and lessons fit the aircraft collision frame capacity', () => {
  for (const course of [
    ...FLIGHT_COURSES,
    ...WORLD_CATALOGUE.map((e) => e.course),
    ...BEGINNER_CATALOGUE.map((e) => e.course),
  ]) {
    const frame = aircraftCourseTerrain(course);
    assert.equal(frame.colliders.length, course.obstacles.length + 6, course.id);
    assert.ok(frame.colliders.every((c) => c.vertices.every(Number.isFinite)));
  }
});

test('practice reference classes allow personal rates and camera but partition physical conditions', async (t) => {
  await initAdvancedRuntime();
  const references = async ({
    edit = () => {},
    mode = 'acro',
    model,
    backend,
    terrain = false,
  } = {}) => {
    const settings = configuration('meteor75-analog-2022');
    const course = structuredClone(FLIGHT_COURSES[0]);
    edit(settings, course);
    const flight = createAircraftCourseSession(
      { course, mode, model, legacy: true, configuration: settings },
      {
        createClient: () => {
          const client = createClient({ backend });
          return {
            ...client,
            stageTerrainFrame: (frame) =>
              client.stageTerrainFrame(
                terrain
                  ? createAircraftTerrainFrame({
                      sourceIdentity: dataIdentity({ different: true }),
                      colliders: frame.colliders,
                    })
                  : frame,
              ),
          };
        },
      },
    );
    t.after(() => flight.dispose());
    await flight.prepare();
    return flight.referenceIdentity();
  };
  const original = await references();
  assert.deepEqual(
    await references({
      edit(settings) {
        settings.response.rates.axes.roll.rate += 20;
        settings.response.rates.axes.yaw.expo += 10;
        settings.camera.tilt += 5;
        settings.camera.verticalFov += 2;
      },
    }),
    original,
  );
  for (const changed of [
    { edit: (s) => (s.response.rates.throttle.limitType = 'scale') },
    { edit: (s) => (s.response.rates.throttle.expo = 12) },
    { edit: (s) => (s.advanced.controller.gains.roll.p *= 1.1) },
    { edit: (s) => (s.advanced.aircraft.mass *= 1.1) },
    { edit: (s) => (s.response.maxTilt += 1) },
    { mode: 'self-level' },
    { model: 'aircraft-course-practice.v1' },
    { backend: 'civilian-quad-aircraft-regional.v1' },
    { edit: (_s, c) => c.steps.acro[0].ticks++ },
  ])
    assert.notEqual((await references(changed)).configurationClass, original.configurationClass);
  const alteredTerrain = await references({ terrain: true });
  assert.equal(alteredTerrain.configurationClass, original.configurationClass);
  assert.notEqual(alteredTerrain.terrainIdentity, original.terrainIdentity);
});

test('reference reads leave physical trajectories, mission checkpoints and recordings unchanged', async (t) => {
  await initAdvancedRuntime();
  for (const preset of ['meteor75-analog-2022', 'holybro-x650-v2'])
    for (const mode of ['acro', 'self-level']) {
      const build = () =>
        createAircraftCourseSession(
          { course: FLIGHT_COURSES[0], mode, legacy: true, configuration: configuration(preset) },
          { createClient },
        );
      const observed = build(),
        untouched = build();
      t.after(() => Promise.all([observed.dispose(), untouched.dispose()]));
      await observed.prepare();
      await untouched.prepare();
      const reference = observed.referenceIdentity();
      assert.throws(() => (reference.configurationClass = 'forged'), TypeError);
      observed.arm();
      untouched.arm();
      for (let tick = 0; tick < 40; tick++) {
        assert.equal(observed.referenceIdentity(), reference);
        const input = { ...controls, yaw: tick % 7 === 0 ? 0.1 : 0 };
        assert.deepEqual(await observed.step(input), await untouched.step(input));
      }
      observed.pause();
      untouched.pause();
      assert.deepEqual(await observed.exportRecovery(), await untouched.exportRecovery());
      assert.deepEqual(await observed.recording(), await untouched.recording());
    }
});

test('missing diagnostic identities remain unavailable and a worker failure withdraws references', async (t) => {
  await initAdvancedRuntime();
  for (const missing of ['comparison', 'terrain', null]) {
    const flight = createAircraftCourseSession(
      { course: FLIGHT_COURSES[0], mode: 'acro', legacy: true, configuration: configuration() },
      {
        createClient: () => {
          const client = createClient();
          return {
            ...client,
            async initialize(options) {
              const result = await client.initialize(options);
              if (missing === 'comparison') delete result.comparison;
              return result;
            },
            async commitTerrainFrame(value) {
              const result = await client.commitTerrainFrame(value);
              if (missing === 'terrain') delete result.telemetry.terrain.frameIdentity;
              return result;
            },
            async step(...args) {
              if (!missing) throw new Error('worker unavailable');
              return client.step(...args);
            },
          };
        },
      },
    );
    t.after(() => flight.dispose());
    await flight.prepare();
    if (missing) assert.equal(flight.referenceIdentity(), null);
    else assert.ok(flight.referenceIdentity());
    flight.arm();
    if (missing) assert.equal((await flight.step(controls)).ticks, 1);
    else {
      await assert.rejects(flight.step(controls), /worker unavailable/);
      assert.equal(flight.referenceIdentity(), null);
    }
  }
});

test('physical mission motion bypasses the old air and contact integrator and continues beyond the last goal', () => {
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.steps.acro = [
    {
      ...course.steps.acro.find((s) => s.type === 'land'),
      min: { x: -1000, y: 0, z: -1000 },
      max: { x: 1000, y: 100, z: 1000 },
      ticks: 1,
    },
  ];
  const flight = createFlight({
    course,
    mode: 'acro',
    unscoredPractice: true,
    physicalPractice: true,
  });
  flight.arm();
  const motion = {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    orientation: [0, 0, 0, Q],
    angular: { roll: 0, pitch: 0, yaw: 0 },
    grounded: true,
    support: { id: 'floor', normal: { x: 0, y: Q, z: 0 }, y: 0 },
    landingSpeed: 0,
    landingTilt: 0,
    contacts: [],
  };
  for (let i = 0; i < 100; i++) flight.step({ ...controls, throttle: 0 }, { motion });
  assert.equal(flight.snapshot().step, 1);
  assert.equal(flight.snapshot().status, 'active');
  assert.equal(flight.snapshot().ticks, 100);
  assert.deepEqual(flight.snapshot().position, motion.position);
  assert.throws(() => createFlightRecorder(flight), /Unscored|unscored/);
});

test('world actor staging can roll back without advancing mission state', async () => {
  await initWorldRuntime();
  const flight = createWorldFlight({
    course: WORLD_CATALOGUE[0].course,
    physicalRadius: 50,
    physicalPractice: true,
    unscoredPractice: true,
  });
  try {
    flight.arm();
    const before = flight.snapshot();
    flight.preparePhysicalStep();
    flight.cancelPhysicalStep();
    assert.deepEqual(flight.snapshot(), before);
    assert.throws(() => createWorldRecorder(flight), /Unscored|unscored/);
  } finally {
    flight.dispose();
  }
});

test('course checkpoint recovers exact physical and mission state, remains paused and rejects mixed configuration', async () => {
  await initAdvancedRuntime();
  const flight = createAircraftCourseSession(
    { course: FLIGHT_COURSES[0], mode: 'acro', legacy: true, configuration: configuration() },
    { createClient },
  );
  try {
    await flight.prepare();
    const initial = await flight.exportRecovery();
    await flight.restoreRecovery(initial);
    assert.equal(flight.snapshot().ticks, 0);
    flight.arm();
    for (let i = 0; i < 40; i++) await flight.step(controls);
    const saved = await flight.exportRecovery();
    assert.equal(saved.mission.state.ticks, saved.physical.checkpoint.state.missionTick);
    const expected = flight.snapshot();
    for (let i = 0; i < 20; i++) await flight.step(controls);
    flight.pause();
    await flight.restoreRecovery(saved);
    const state = flight.snapshot();
    assert.equal(state.ticks, 40);
    assert.equal(state.status, 'paused');
    assert.deepEqual(state.position, expected.position);
    assert.deepEqual(state.advancedTelemetry.position, expected.advancedTelemetry.position);
    const bad = structuredClone(saved);
    bad.mission.state.ticks++;
    await assert.rejects(flight.restoreRecovery(bad), /checksum/);
    assert.equal(flight.snapshot().ticks, 40);
    const inconsistent = structuredClone(saved);
    inconsistent.mission.state.position.x += 1000;
    const packet = { ...inconsistent };
    delete packet.checksum;
    inconsistent.checksum = dataIdentity(packet);
    await assert.rejects(flight.restoreRecovery(inconsistent), /motion differs/);
    assert.equal(flight.snapshot().ticks, 40);
  } finally {
    await flight.dispose();
  }
});

test('current course host resumes historical v1 recovery with its original solver and rejects unknown backends', async (t) => {
  await initAdvancedRuntime();
  const options = {
    course: FLIGHT_COURSES[0],
    mode: 'acro',
    legacy: true,
    configuration: configuration('meteor75-analog-2022'),
  };
  const historical = createAircraftCourseSession(options, {
    createClient: () => createClient({ backend: 'civilian-quad-aircraft-regional.v1' }),
  });
  const current = createAircraftCourseSession(options, { createClient });
  t.after(() => Promise.all([historical.dispose(), current.dispose()]));
  await historical.prepare();
  await current.prepare();
  const freshReference = current.referenceIdentity();
  assert.notDeepEqual(freshReference, historical.referenceIdentity());
  assert.equal(current.snapshot().advancedTelemetry.backend, 'civilian-quad-aircraft-regional.v3');
  historical.arm();
  for (let tick = 0; tick < 30; tick++) await historical.step(controls);
  historical.pause();
  const saved = await historical.exportRecovery();
  await current.restoreRecovery(saved);
  assert.deepEqual(current.referenceIdentity(), historical.referenceIdentity());
  assert.equal(current.snapshot().status, 'paused');
  assert.equal(current.snapshot().advancedTelemetry.backend, 'civilian-quad-aircraft-regional.v1');
  assert.deepEqual(current.snapshot().position, historical.snapshot().position);
  historical.arm();
  current.arm();
  for (let tick = 0; tick < 20; tick++) {
    await historical.step(controls);
    await current.step(controls);
  }
  historical.pause();
  current.pause();
  const expected = await historical.exportRecovery();
  const actual = await current.exportRecovery();
  const restoredReference = current.referenceIdentity();
  assert.equal(
    actual.physical.hash,
    expected.physical.hash,
    'Continuation uses the original solver',
  );
  assert.deepEqual(actual.mission, expected.mission);
  for (const backend of ['civilian-quad-aircraft-regional.v99', 'civilian-quad-aircraft.v1']) {
    const invalid = structuredClone(saved);
    invalid.physical.config.backend = backend;
    reseal(invalid);
    await assert.rejects(current.restoreRecovery(invalid), /backend/);
    assert.equal(current.referenceIdentity(), restoredReference);
    assert.equal((await current.exportRecovery()).physical.hash, actual.physical.hash);
  }
});

test('course archive bridge serializes with recovery, seals only paused tails and changes generation on repeated restore', async (t) => {
  await initAdvancedRuntime();
  const flight = createAircraftCourseSession(
    { course: FLIGHT_COURSES[0], mode: 'acro', legacy: true, configuration: configuration() },
    { createClient },
  );
  t.after(() => flight.dispose());
  const preparing = flight.prepare();
  const initialReading = flight.readSealedSegment();
  await preparing;
  const initial = await initialReading;
  assert.equal(initial.generation, flight.snapshot().advancedTelemetry.archiveStatus.generation);
  const backgroundRead = flight.readSealedSegment();
  flight.arm();
  assert.equal(flight.snapshot().status, 'active', 'a background archive read must retain Arm');
  await backgroundRead;
  await flight.step(controls);
  assert.throws(() => flight.finalizeArchive(), /Pause before/);
  const [read, recovery] = await Promise.all([flight.readSealedSegment(), flight.exportRecovery()]);
  assert.equal(read.format, 'AircraftSealedRead.v1');
  assert.equal(recovery.format, 'AircraftCourseRecovery.v1');
  flight.pause();
  const ending = flight.finalizeArchive();
  flight.arm();
  assert.equal(flight.snapshot().status, 'paused', 'final tail sealing retains its pause guard');
  const ended = await ending;
  assert.equal(ended.segment.endTick, 1);
  assert.equal(ended.finalizedThroughIndex, 0);
  await flight.restoreRecovery(recovery);
  const firstRestore = await flight.readSealedSegment();
  assert.notEqual(firstRestore.generation, initial.generation);
  assert.equal(firstRestore.origin.kind, 'checkpoint');
  await flight.restoreRecovery(recovery);
  assert.notEqual((await flight.readSealedSegment()).generation, firstRestore.generation);
});

test('landing metrics use physical impact speed and hull support height', () => {
  const motion = aircraftMissionMotion(
    {
      position: { x: 1, y: 0.03, z: 2 },
      supportHeight: 0.03,
      orientation: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      achievedRates: { roll: 0, pitch: 0, yaw: 0 },
      contact: { grounded: true, normal: { x: 0, y: 1, z: 0 }, impactSpeed: 2.4, ids: ['floor'] },
    },
    0.22,
  );
  assert.equal(motion.position.y, 0);
  assert.equal(motion.landingSpeed, 2400);
  assert.equal(motion.landingTilt, 0);
});

test('every authored world and lesson validates its initial and evolving physical mission checkpoints', async () => {
  await initWorldRuntime();
  for (const { course } of [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE])
    for (const mode of ['acro', 'self-level']) {
      const flight = (course.format === 'FlightCourse.v1' ? createFlight : createWorldFlight)({
        course,
        mode,
        physicalRadius: 50,
        physicalPractice: true,
        unscoredPractice: true,
      });
      try {
        flight.validatePhysicalCheckpoint(flight.physicalCheckpoint());
        flight.arm();
        for (let i = 0; i < (course.pursuit ? 180 : 4); i++) {
          flight.preparePhysicalStep?.();
          const current = flight.snapshot();
          flight.step(
            { ...controls, ...(course.format === 'FlightCourse.v1' ? {} : { actions: 1 }) },
            {
              motion: {
                position: current.position,
                velocity: current.velocity,
                orientation: current.orientation,
                angular: current.angular,
                grounded: false,
                support: null,
                landingSpeed: 0,
                landingTilt: 0,
                contacts: [],
              },
            },
          );
          assert.doesNotThrow(
            () => flight.validatePhysicalCheckpoint(flight.physicalCheckpoint()),
            `${course.id}/${mode}/${i}`,
          );
        }
      } finally {
        flight.dispose?.();
      }
    }
});

test('checksum-recomputed actor, projectile, hunt and pursuit corruption cannot replace a live world session', async () => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  const course = WORLD_CATALOGUE.find((entry) => entry.course.pursuit).course;
  const flight = createAircraftCourseSession(
    { course, mode: 'acro', configuration: configuration() },
    { createClient, createMission: createWorldFlight },
  );
  try {
    await flight.prepare();
    flight.arm();
    for (let i = 0; i < 5; i++) await flight.step({ ...controls, actions: 1 });
    flight.pause();
    const saved = await flight.exportRecovery();
    const cases = [
      (s) => {
        s.mission.state.heightRange = null;
      },
      (s) => {
        s.mission.state.lastInput.throttle = -1;
      },
      (s) => {
        s.mission.state.actors[0].radius *= 2;
      },
      (s) => {
        s.mission.state.actors[0].pathIndex = 900;
      },
      (s) => {
        s.mission.state.actors.find((a) => a.pursuit).pursuit.node = 'unknown-node';
      },
      (s) => {
        s.mission.state.actors.find((a) => a.pursuit).pursuit.heading = null;
      },
      (s) => {
        s.mission.state.actors.find((a) => a.pursuit).pursuit.cursor = 900;
      },
      (s) => {
        s.mission.state.hunt.path = [];
      },
      (s) => {
        s.mission.state.hunt.caught = ['unknown-actor'];
      },
      (s) => {
        s.mission.state.pursuit.bonusCaught = ['unknown-actor'];
      },
      (s) => {
        s.mission.state.events = [{ type: 'objective', index: -1 }];
      },
      (s) => {
        s.mission.state.projectiles = [{ id: 1 }];
      },
      (s) => {
        s.sequence++;
      },
    ];
    for (const mutate of cases) {
      const malformed = structuredClone(saved);
      mutate(malformed);
      await assert.rejects(flight.restoreRecovery(reseal(malformed)));
      assert.deepEqual(await flight.exportRecovery(), saved);
    }
    await flight.restoreRecovery(saved);
    flight.arm();
    assert.equal((await flight.step(controls)).ticks, 6);
  } finally {
    await flight.dispose();
  }
});

test('failed or cancelled detached mission adoption preserves both current owners and rejects concurrent restore', async () => {
  await initAdvancedRuntime();
  let failMissionRestore = false,
    delayRestore = null,
    enteredRestore;
  const factory = () => {
    const client = createClient();
    return {
      ...client,
      async restore(value) {
        enteredRestore?.();
        if (delayRestore) await delayRestore;
        return client.restore(value);
      },
    };
  };
  const createMission = (options) => {
    const mission = createFlight(options);
    return {
      ...mission,
      restorePhysicalCheckpoint(value) {
        mission.restorePhysicalCheckpoint(value);
        if (failMissionRestore) throw new Error('Injected mission adoption failure');
      },
    };
  };
  const flight = createAircraftCourseSession(
    { course: FLIGHT_COURSES[0], mode: 'acro', legacy: true, configuration: configuration() },
    { createClient: factory, createMission },
  );
  try {
    await flight.prepare();
    flight.arm();
    await flight.step(controls);
    flight.pause();
    const saved = await flight.exportRecovery();
    const reference = flight.referenceIdentity();
    failMissionRestore = true;
    await assert.rejects(flight.restoreRecovery(saved), /Injected mission/);
    assert.deepEqual(await flight.exportRecovery(), saved);
    assert.equal(flight.referenceIdentity(), reference);
    failMissionRestore = false;
    let release;
    delayRestore = new Promise((resolve) => {
      release = resolve;
    });
    const entered = new Promise((resolve) => {
      enteredRestore = resolve;
    });
    const abort = new AbortController();
    const restoring = flight.restoreRecovery(saved, { signal: abort.signal });
    const rejected = assert.rejects(restoring);
    await entered;
    assert.throws(() => flight.restoreRecovery(saved), /Pause before/);
    abort.abort();
    release();
    await rejected;
    delayRestore = null;
    assert.deepEqual(await flight.exportRecovery(), saved);
    assert.equal(flight.referenceIdentity(), reference);
    flight.arm();
    assert.equal((await flight.step(controls)).ticks, 2);
  } finally {
    await flight.dispose();
  }
});

test('resumed skill and tracking algorithms reject missing nested progress instead of failing on their next step', async () => {
  await initWorldRuntime();
  for (const type of ['path-v1', 'rotation-v1', 'actor-track-v1']) {
    const { course } = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].find((entry) =>
      entry.course.steps.acro.some((step) => step.type === type),
    );
    const mission = createWorldFlight({
      course,
      mode: 'acro',
      physicalPractice: true,
      physicalRadius: 50,
      unscoredPractice: true,
    });
    try {
      const saved = mission.physicalCheckpoint();
      const index = course.steps.acro.findIndex((step) => step.type === type);
      saved.state.step = index;
      if (type === 'actor-track-v1') {
        saved.state.actorTrack = { index, status: 'tracking', reason: null, travel: -1 };
        assert.throws(() => mission.validatePhysicalCheckpoint(saved), /tracked travel/);
      } else {
        saved.state.skill = {
          index,
          status: 'active',
          reason: null,
          ticks: 0,
          dwell: 0,
          entry: [0, 0, 0, Q],
          startAxis: 0,
          rotation: { angle: 0, reverse: 0, other: 0, checkpoint: 0 },
          path: {
            winding: 0,
            reverse: 0,
            checkpoint: 0,
            sample: type === 'path-v1' ? { a: 1000, b: 0, bearing: 0 } : null,
          },
        };
        assert.doesNotThrow(() => mission.validatePhysicalCheckpoint(saved));
        if (type === 'path-v1') saved.state.skill.path.sample = null;
        else saved.state.skill.rotation = null;
        assert.throws(() => mission.validatePhysicalCheckpoint(saved));
      }
    } finally {
      mission.dispose();
    }
  }
});
