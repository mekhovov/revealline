import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createFlight } from '../../optional-practice/civilian-fpv/model.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';

const copy = (value) => structuredClone(value);
const upright = (q) => 1 - 2 * (q.x * q.x + q.z * q.z);
const configurationFor = (id) => {
  const preset = createPresetConfiguration(id);
  return {
    response: preset.response,
    camera: preset.camera,
    advanced: { aircraft: preset.aircraft, controller: preset.controller },
  };
};
const byHost = {
  academy: FLIGHT_COURSES.map((course) => ({ host: 'academy', legacy: true, course })),
  world: WORLD_CATALOGUE.map((entry) => ({ host: 'world', ...entry })),
  beginner: BEGINNER_CATALOGUE.map((entry) => ({ host: 'beginner', ...entry })),
};

// Fixed-seed sampling is repeatable, spreads the longer flights across the
// catalog, and complements the exhaustive one-interval launch matrix.
function sampleCourses(entries, seed, count) {
  const remaining = [...entries];
  const selected = [];
  let state = seed >>> 0;
  while (selected.length < count) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    selected.push(remaining.splice(state % remaining.length, 1)[0]);
  }
  return selected;
}

async function fly(entry, configuration, mode, { ticks = 180, throttle, inspect } = {}) {
  let initialized;
  const createClient = () => {
    let simulation;
    return {
      async initialize(options) {
        simulation = createAdvancedSimulation({ ...options, recording: false });
        initialized = simulation.snapshot().config;
        return { telemetry: simulation.telemetry() };
      },
      async stageTerrainFrame(frame) {
        return simulation.stageTerrainFrame(frame);
      },
      async commitTerrainFrame(decision) {
        return simulation.commitTerrainFrame(decision);
      },
      async step(sample, motions) {
        simulation.enqueueInput(sample);
        return simulation.stepMission({ motions });
      },
      dispose() {
        simulation?.dispose();
      },
    };
  };
  const expected = copy(configuration);
  const flight = createAircraftCourseSession(
    { course: entry.course, legacy: entry.legacy, configuration, mode },
    { createClient, createMission: entry.legacy ? createFlight : createWorldFlight },
  );
  const hover = throttle ?? aircraftPerformance(expected.advanced.aircraft).hoverThrottle;
  let commanded;
  let minimumUpright = 1;
  let greatestHeight = -Infinity;
  try {
    await flight.prepare();
    // Assert the numerical records accepted by the actual solver, not merely
    // the picker label or the options passed to a mocked worker.
    assert.deepEqual(initialized.aircraft, expected.advanced.aircraft);
    assert.deepEqual(initialized.controller, expected.advanced.controller);
    assert.deepEqual(initialized.response.response, expected.response);
    assert.equal(initialized.response.mode, mode);
    assert.equal(initialized.frequency, 500);
    assert.equal(initialized.backend, 'civilian-quad-aircraft-regional.v2');
    flight.arm();
    for (let tick = 0; tick < ticks; tick++) {
      const command = {
        roll: tick >= 150 && tick < 160 ? 0.12 : 0,
        pitch: tick >= 150 && tick < 160 ? -0.1 : 0,
        yaw: tick >= 150 && tick < 160 ? 0.25 : 0,
        throttle: tick < 20 ? 0 : tick < 100 ? Math.min(1, hover + 0.04) : hover,
      };
      const state = await flight.step(command);
      const telemetry = state.advancedTelemetry;
      assert.equal(state.failure, null);
      assert.equal(state.status, 'active');
      assert.equal(state.ticks, tick + 1);
      assert.equal(telemetry.missionTick, state.ticks);
      assert.ok(Object.values(telemetry.position).every(Number.isFinite));
      assert.ok(Object.values(telemetry.velocity).every(Number.isFinite));
      minimumUpright = Math.min(minimumUpright, upright(telemetry.orientation));
      greatestHeight = Math.max(greatestHeight, state.position.y - entry.course.spawn.y);
      if (tick === 159) commanded = copy(telemetry);
      inspect?.(state, tick);
    }
    return { state: flight.snapshot(), commanded, minimumUpright, greatestHeight };
  } finally {
    await flight.dispose();
  }
}

test('all aircraft take off, steer and release across seeded Academy, World and learning flights', async (t) => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  const visited = new Set();
  let flights = 0;
  for (const [index, preset] of listAircraftPresets().entries()) {
    await t.test(preset.id, async () => {
      const configuration = configurationFor(preset.id);
      const entries = [
        ...sampleCourses(byHost.academy, 8307 + index, 2),
        ...sampleCourses(byHost.world, 9181 + index, 8),
        ...sampleCourses(byHost.beginner, 14071 + index, 4),
      ];
      const failures = [];
      for (const entry of entries)
        for (const mode of ['acro', 'self-level']) {
          const label = `${entry.host}/${entry.course.id}/${mode}`;
          try {
            const result = await fly(entry, configuration, mode);
            assert.ok(result.greatestHeight > 100, `takeoff ${result.greatestHeight} mm`);
            assert.ok(result.minimumUpright > 0.8, `upright ${result.minimumUpright}`);
            assert.ok(result.commanded.achievedRates.roll > 1, 'roll response');
            assert.ok(result.commanded.achievedRates.pitch < -1, 'pitch response');
            assert.ok(result.commanded.achievedRates.yaw > 1, 'yaw response');
            assert.ok(
              Math.abs(result.state.advancedTelemetry.achievedRates.yaw) <
                Math.abs(result.commanded.achievedRates.yaw),
              'yaw release slows the rotation',
            );
            visited.add(`${entry.host}/${entry.course.id}`);
            flights++;
          } catch (error) {
            failures.push(`${label}: ${error.message}`);
          }
        }
      assert.deepEqual(failures, []);
    });
  }
  t.diagnostic(`${flights} real-physics flights across ${visited.size} host/course pairs`);
});

test('custom aircraft, rate and PID values independently change flight behavior in each practice host', async (t) => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  for (const preset of listAircraftPresets())
    await t.test(preset.id, async () => {
      const original = configurationFor(preset.id);
      const hover = aircraftPerformance(original.advanced.aircraft).hoverThrottle;
      for (const entry of [byHost.academy[0], byHost.world[0], byHost.beginner[0]]) {
        const baseline = await fly(entry, original, 'acro', { throttle: hover });
        const heavier = copy(original);
        heavier.advanced.aircraft.mass *= 1.1;
        for (const axis of ['x', 'y', 'z']) heavier.advanced.aircraft.inertia[axis] *= 1.1;
        const physical = await fly(entry, heavier, 'acro', { throttle: hover });
        assert.ok(
          physical.commanded.position.y < baseline.commanded.position.y - 0.1,
          `${entry.host}: added mass must reduce climb at identical throttle`,
        );
        const rates = copy(original);
        rates.response.rates.axes.yaw.rcRate *= 2;
        const faster = await fly(entry, rates, 'acro', { throttle: hover });
        assert.ok(
          faster.commanded.requestedRates.yaw > baseline.commanded.requestedRates.yaw + 5,
          `${entry.host}: changed rates must reach the requested angular velocity`,
        );
        assert.ok(
          faster.commanded.achievedRates.yaw > baseline.commanded.achievedRates.yaw + 1,
          `${entry.host}: changed rates must change physical rotation`,
        );
        const controller = copy(original);
        controller.advanced.controller.gains.yaw.p *= 0.5;
        const softer = await fly(entry, controller, 'acro', { throttle: hover });
        assert.equal(softer.commanded.requestedRates.yaw, baseline.commanded.requestedRates.yaw);
        assert.ok(
          softer.commanded.achievedRates.yaw < baseline.commanded.achievedRates.yaw - 0.1,
          `${entry.host}: lower P must change transient tracking, keeping requested rates`,
        );
      }
    });
});
