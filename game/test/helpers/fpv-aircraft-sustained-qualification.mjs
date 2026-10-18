import assert from 'node:assert/strict';
import { dataIdentity } from '../../data-json.mjs';
import { FLIGHT_COURSES } from '../../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createFlight } from '../../../optional-practice/civilian-fpv/model.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { createAircraftCourseSession } from '../../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedRegionalSession } from '../../../optional-practice/civilian-fpv/advanced-regional.mjs';
import { createVerifiedFlightGeometry } from '../../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
} from '../../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { aircraftAttitude } from '../../../optional-practice/civilian-fpv/aircraft-response.mjs';
import { realRegionalGeometry } from './fpv-regional-real-geometry.mjs';

const copy = (value) => structuredClone(value);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const upright = (q) => 1 - 2 * (q.x * q.x + q.z * q.z);
const zero = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const seconds = (ticks) => Math.round(ticks * 2) / 100;

// Test controls only: an altitude feedback pilot keeps a bounded hover near the
// authored spawn, lands, and takes off again. It never changes body state,
// gravity, contact geometry, configured assists, or controller gains.
export function sustainedPilot(
  tick,
  telemetry,
  targetHeight,
  hover,
  { mode, targetPosition, maxTilt, regional = false },
) {
  const t = tick / 50;
  const contact = telemetry.contact?.grounded ?? telemetry.terrain?.grounded;
  const landingEnd = regional ? 34 : 21;
  if ((!regional && t < 1) || (t >= 14 && t < landingEnd && contact)) return { ...zero };
  const target = t >= 14 && t < 20 ? targetHeight - 1.6 : targetHeight;
  const verticalSpeed =
    regional && t >= 14 && t < landingEnd
      ? -0.4
      : clamp(1.2 * (target - telemetry.position.y), -0.45, 0.7);
  const desired = {
    x: clamp(
      0.25 * (targetPosition.x - telemetry.position.x) - 0.8 * telemetry.velocity.x,
      -0.8,
      0.8,
    ),
    y: 0,
    z: clamp(
      0.25 * (targetPosition.z - telemetry.position.z) - 0.8 * telemetry.velocity.z,
      -0.8,
      0.8,
    ),
  };
  // Inverse quaternion rotation expresses horizontal acceleration in body axes.
  const q = telemetry.orientation;
  const tx = -2 * (q.y * desired.z - q.z * desired.y);
  const ty = -2 * (q.z * desired.x - q.x * desired.z);
  const tz = -2 * (q.x * desired.y - q.y * desired.x);
  const body = {
    x: desired.x + q.w * tx - q.y * tz + q.z * ty,
    z: desired.z + q.w * tz - q.x * ty + q.y * tx,
  };
  const targetRoll = (Math.atan2(body.x, 9.81) * 180) / Math.PI;
  const targetPitch = (Math.atan2(-body.z, 9.81) * 180) / Math.PI;
  const attitude = aircraftAttitude(q);
  const stick = (axis, target) =>
    mode === 'self-level'
      ? target / maxTilt
      : clamp(
          (target - attitude[axis]) * 0.025 - telemetry.achievedRates[axis] * 0.0015,
          -0.3,
          0.3,
        );
  return {
    ...zero,
    roll: stick('roll', targetRoll),
    pitch: stick('pitch', targetPitch),
    throttle: clamp(hover + 0.09 * (verticalSpeed - telemetry.velocity.y), 0, 1),
    yaw: t >= 7 && t < 7.6 ? 0.18 : t >= 9 && t < 9.6 ? -0.18 : 0,
  };
}

function localClients() {
  let active;
  return {
    simulation: () => active,
    createClient() {
      let simulation;
      return {
        async initialize(options) {
          active = simulation = createAdvancedSimulation(options);
          return { telemetry: simulation.telemetry() };
        },
        async step(sample, motions) {
          simulation.enqueueInput(sample);
          return simulation.stepMission({ motions });
        },
        async propose(sample) {
          simulation.enqueueInput(sample);
          return simulation.proposeMission();
        },
        async commit(decision) {
          return simulation.commitMission(decision);
        },
        async stageTerrainFrame(frame) {
          return simulation.stageTerrainFrame(frame);
        },
        async commitTerrainFrame(decision) {
          return simulation.commitTerrainFrame(decision);
        },
        async snapshot() {
          return simulation.snapshot();
        },
        async telemetry() {
          return simulation.telemetry();
        },
        async restore(saved) {
          return simulation.restore(await verifyAdvancedRecovery(saved));
        },
        async recording() {
          return simulation.recording();
        },
        async reportPersistence(status) {
          return simulation.reportPersistence(status);
        },
        async readSealedSegment(index) {
          return simulation.readSealedSegment(index);
        },
        async finalizeArchive(index) {
          return simulation.finalizeArchive(index);
        },
        dispose() {
          simulation?.dispose();
        },
      };
    },
  };
}

function verifyConfiguration(simulation, selected, mode) {
  const config = simulation.configuration();
  assert.deepEqual(config.aircraft, selected.aircraft, 'Solver must use selected aircraft');
  assert.deepEqual(config.controller, selected.controller, 'Solver must use selected controller');
  assert.deepEqual(config.response.response, selected.response, 'Solver must use selected rates');
  assert.equal(config.response.mode, mode);
  assert.equal(config.frequency, 500);
  assert.equal(config.backend, 'civilian-quad-aircraft-regional.v3');
  return dataIdentity({
    aircraft: config.aircraft,
    controller: config.controller,
    response: config.response,
  });
}

async function runFlight({
  session,
  clients,
  selected,
  mode,
  duration,
  checkpointAt,
  beforeStep,
  regional = false,
}) {
  const started = performance.now();
  await session.prepare();
  const configIdentity = verifyConfiguration(clients.simulation(), selected, mode);
  const initial = session.snapshot().advancedTelemetry;
  const targetHeight = initial.position.y + 1.4;
  const hover = aircraftPerformance(selected.aircraft).hoverThrottle;
  const capture = () => session.exportRecovery?.() ?? session.captureRecovery();
  const ticks = duration * 50;
  const tape = [];
  let saved,
    pauseNoop = false,
    airborne = 0,
    grounded = 0,
    secondAirborne = 0;
  let landing = false,
    initialSupport = false,
    minUpright = 1,
    maximumYaw = 0,
    maximumHeight = -Infinity;
  const courseProgress = [];
  session.arm();
  try {
    for (let tick = 0; tick < ticks; tick++) {
      const input = sustainedPilot(
        tick,
        session.snapshot().advancedTelemetry,
        targetHeight,
        hover,
        {
          mode,
          targetPosition: initial.position,
          maxTilt: selected.response.maxTilt ?? 30,
          regional,
        },
      );
      await beforeStep?.(tick, input, capture);
      if (tick === checkpointAt * 50) {
        session.pause();
        const before = copy(session.snapshot());
        const hash = clients.simulation().stateHash();
        await session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 });
        assert.deepEqual(session.snapshot(), before, 'Paused controls must not advance mission');
        assert.equal(
          clients.simulation().stateHash(),
          hash,
          'Paused controls must not advance physics',
        );
        saved = await capture();
        pauseNoop = true;
        session.arm();
      }
      if (saved) tape.push(copy(input));
      const state = await session.step(input);
      assert.equal(state.failure, null);
      assert.equal(state.status, 'active', `${state.reason}: ${state.failure}`);
      assert.equal(state.ticks, tick + 1);
      const telemetry = state.advancedTelemetry;
      assert.equal(telemetry.missionTick, tick + 1);
      assert.ok(Object.values(telemetry.position).every(Number.isFinite));
      assert.ok(Object.values(telemetry.velocity).every(Number.isFinite));
      assert.equal(telemetry.usedAh, 0, 'Default practice battery must not deplete');
      const supported = Boolean(telemetry.contact?.grounded ?? telemetry.terrain?.grounded);
      if (supported) grounded++;
      else airborne++;
      if (tick < 50) initialSupport ||= supported;
      if (tick >= 14 * 50 && tick < (regional ? 34 : 21) * 50) landing ||= supported;
      if (tick >= (regional ? 35 : 22) * 50 && !supported) secondAirborne++;
      minUpright = Math.min(minUpright, upright(telemetry.orientation));
      maximumYaw = Math.max(maximumYaw, Math.abs(telemetry.achievedRates.yaw));
      maximumHeight = Math.max(maximumHeight, telemetry.position.y - initial.position.y);
      if ((tick + 1) % 500 === 0)
        courseProgress.push({
          tick: tick + 1,
          step: state.step ?? null,
          position: copy(state.position),
        });
    }
    assert.ok(airborne >= 20 * 50, `Insufficient airborne duration: ${seconds(airborne)} s`);
    assert.ok(landing, 'Controlled descent must reach physical supporting contact');
    assert.ok(secondAirborne >= 7 * 50, 'Must take off again after landing');
    assert.ok(minUpright > 0.98, `Uncommanded tilt during vertical/yaw flight: ${minUpright}`);
    assert.ok(maximumYaw > 5, 'Yaw steering must reach the physical controller');
    assert.ok(maximumHeight > 0.8, 'Aircraft must climb above initial height');
    session.pause();
    const finalHash = clients.simulation().stateHash();
    const finalPosition = copy(session.snapshot().position);
    const recording = clients.simulation().recordingStatus();
    assert.ok(recording.retainedSegments <= 3, 'Recent clip retention must remain bounded');
    await session.restoreRecovery(saved);
    assert.equal(session.snapshot().status, 'paused', 'Recovery must never automatically arm');
    verifyConfiguration(clients.simulation(), selected, mode);
    session.arm();
    for (const input of tape) await session.step(input);
    session.pause();
    assert.equal(
      clients.simulation().stateHash(),
      finalHash,
      'Recovery with identical consumed inputs must continue exactly',
    );
    assert.deepEqual(session.snapshot().position, finalPosition);
    return {
      configIdentity,
      backend: clients.simulation().configuration().backend,
      durationSeconds: duration,
      airborneSeconds: seconds(airborne),
      groundedSeconds: seconds(grounded),
      secondTakeoffSeconds: seconds(secondAirborne),
      initialSupport,
      landed: landing,
      minimumUpright: minUpright,
      maximumYawDegreesPerSecond: maximumYaw,
      maximumClimbMetres: maximumHeight,
      finalHash,
      finalPosition,
      pauseNoop,
      recoveryExact: true,
      recoveryAtSeconds: checkpointAt,
      recoveryContinuationSeconds: seconds(tape.length),
      retainedSegments: recording.retainedSegments,
      retainedBytes: recording.retainedBytes,
      courseProgress,
      elapsedSeconds: (performance.now() - started) / 1000,
    };
  } catch (error) {
    throw new Error(
      `${error.message}; observations=${JSON.stringify({ airborneSeconds: seconds(airborne), groundedSeconds: seconds(grounded), secondTakeoffSeconds: seconds(secondAirborne), landing, minUpright, maximumYaw, maximumHeight, courseProgress })}`,
      { cause: error },
    );
  } finally {
    await session.dispose();
  }
}

export async function qualifyCourseAircraft(
  id,
  mode,
  host,
  { duration = 32, checkpointAt = 24 } = {},
) {
  const selected = createPresetConfiguration(id);
  const entry =
    host === 'academy'
      ? { course: FLIGHT_COURSES[0], legacy: true }
      : host === 'learning'
        ? BEGINNER_CATALOGUE[0]
        : WORLD_CATALOGUE.find((entry) => entry.course.id === 'adventure-coast-01');
  const clients = localClients();
  const session = createAircraftCourseSession(
    {
      course: entry.course,
      legacy: entry.legacy,
      mode,
      configuration: {
        response: selected.response,
        camera: selected.camera,
        advanced: { aircraft: selected.aircraft, controller: selected.controller },
      },
    },
    {
      createClient: clients.createClient,
      createMission: entry.legacy ? createFlight : createWorldFlight,
    },
  );
  return {
    aircraft: id,
    mode,
    host,
    course: entry.course.id,
    courseIdentity: dataIdentity(entry.course),
    ...(await runFlight({ session, clients, selected, mode, duration, checkpointAt })),
  };
}

export async function qualifyRegionalAircraft(id, mode) {
  const selected = createPresetConfiguration(id);
  const geometry = await realRegionalGeometry('canyon-expanse-study');
  const clients = localClients();
  let reject = false,
    boundaryRollback = false;
  const session = createAdvancedRegionalSession(
    {
      ...geometry,
      spawnId: geometry.manifest.spawns[0].id,
      initialHeading:
        geometry.authoredStartHeadings[geometry.manifest.spawns[0].id] ?? 'region-centre',
      advanced: { aircraft: selected.aircraft, controller: selected.controller },
      response: selected.response,
      mode,
    },
    {
      createClient: clients.createClient,
      createGeometry(...args) {
        const owner = createVerifiedFlightGeometry(...args);
        return {
          ...owner,
          motionCoverage: (...input) =>
            reject ? { status: 'unknown-cell' } : owner.motionCoverage(...input),
        };
      },
    },
  );
  const result = await runFlight({
    session,
    clients,
    selected,
    mode,
    duration: 65,
    checkpointAt: 62,
    regional: true,
    async beforeStep(tick, input, capture) {
      if (tick !== 2999) return;
      session.pause();
      const saved = await capture();
      const hash = clients.simulation().stateHash();
      const recorded = clients.simulation().recording();
      reject = true;
      session.arm();
      const result = await session.step(input);
      assert.equal(result.reason, 'terrain-required');
      assert.equal(
        clients.simulation().stateHash(),
        hash,
        'Rejected boundary must roll back the aircraft',
      );
      assert.deepEqual(
        clients.simulation().recording(),
        recorded,
        'Rejected boundary must not rotate recording',
      );
      reject = false;
      await session.restoreRecovery(saved);
      session.arm();
      boundaryRollback = true;
    },
  });
  assert.ok(result.retainedSegments >= 2, 'Must cross the physical 60-second recording boundary');
  return {
    aircraft: id,
    mode,
    host: 'regional',
    source: geometry.reference,
    boundaryRollback,
    ...result,
  };
}

export async function runSustainedQualification({ smoke = false, onResult } = {}) {
  await initAdvancedRuntime();
  await initWorldRuntime();
  const results = [];
  const run = async (run, identity) => {
    let result;
    try {
      result = { ...(await run()), passed: true };
    } catch (error) {
      result = { ...identity, passed: false, error: error.stack };
    }
    results.push(result);
    await onResult?.(result);
  };
  const presets = smoke ? [{ id: 'meteor75-analog-2022' }] : listAircraftPresets();
  for (const [index, { id }] of presets.entries())
    for (const mode of smoke ? ['self-level'] : ['acro', 'self-level']) {
      const host = ['academy', 'world', 'learning'][index % 3];
      await run(() => qualifyCourseAircraft(id, mode, host), { aircraft: id, mode, host });
    }
  if (!smoke)
    for (const id of ['meteor75-analog-2022', 'holybro-x650-v2'])
      for (const mode of ['acro', 'self-level'])
        await run(() => qualifyRegionalAircraft(id, mode), {
          aircraft: id,
          mode,
          host: 'regional',
        });
  if (!smoke)
    await run(
      () =>
        qualifyCourseAircraft('meteor75-analog-2022', 'self-level', 'academy', {
          duration: 735,
          checkpointAt: 732,
        }),
      {
        aircraft: 'meteor75-analog-2022',
        mode: 'self-level',
        host: 'academy',
        durationSeconds: 735,
      },
    );
  return { passed: results.every((row) => row.passed), smoke, results };
}
