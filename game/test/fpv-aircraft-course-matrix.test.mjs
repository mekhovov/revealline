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
  applyAircraftComponents,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';

const entries = [
  ...FLIGHT_COURSES.map((course) => ({ host: 'academy', course, legacy: true })),
  ...WORLD_CATALOGUE.map((entry) => ({ ...entry, host: 'world' })),
  ...BEGINNER_CATALOGUE.map((entry) => ({ ...entry, host: 'beginner' })),
];

function createClient() {
  let simulation;
  return {
    async initialize(options) {
      simulation = createAdvancedSimulation(options);
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
}

test('all twelve aircraft launch every Academy, World and Beginner course in both modes', async (t) => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  for (const preset of listAircraftPresets()) {
    await t.test(preset.id, async () => {
      const selected = createPresetConfiguration(preset.id);
      const configuration = {
        response: selected.response,
        camera: selected.camera,
        advanced: { aircraft: selected.aircraft, controller: selected.controller },
      };
      const failures = [];
      for (const entry of entries) {
        for (const mode of ['acro', 'self-level']) {
          let flight;
          try {
            flight = createAircraftCourseSession(
              { course: entry.course, legacy: entry.legacy, mode, configuration },
              { createClient, createMission: entry.legacy ? createFlight : createWorldFlight },
            );
            const prepared = await flight.prepare();
            assert.equal(prepared.failure, null);
            assert.equal(prepared.aircraftRadiusMm, selected.aircraft.radius * 1000);
            assert.ok(prepared.aircraftSupportHeightMm > 0);
            flight.arm();
            await flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.5 });
            const state = flight.snapshot();
            assert.equal(state.ticks, 1);
            assert.equal(state.advancedTelemetry.missionTick, 1);
            assert.equal(state.unscored, true);
            assert.equal(state.failure, null);
            assert.equal(state.aircraftRadiusMm, selected.aircraft.radius * 1000);
            assert.ok(Object.values(state.advancedTelemetry.position).every(Number.isFinite));
            assert.ok(Object.values(state.advancedTelemetry.velocity).every(Number.isFinite));
          } catch (error) {
            failures.push(`${entry.host}/${entry.course.id}/${mode}: ${error.message}`);
          } finally {
            await flight?.dispose();
          }
        }
      }
      assert.equal(failures.length, 0, failures.join('\n'));
    });
  }
});

test('edited batteries and physical-camera payloads launch with their shifted COM in every practice host', async () => {
  await initAdvancedRuntime();
  await initWorldRuntime();
  const failures = [];
  for (const preset of listAircraftPresets()) {
    const selected = createPresetConfiguration(preset.id);
    const edited = applyAircraftComponents(selected.aircraft, selected.components, {
      battery: {
        massGrams: selected.components.reference.batteryMassGrams * 2,
        capacityMah: selected.components.reference.capacityMah * 2,
      },
      cameraPayload: { massGrams: selected.components.reference.maxPayloadGrams },
    });
    for (const host of ['academy', 'world', 'beginner'])
      for (const mode of ['acro', 'self-level']) {
        const entry = entries.find((row) => row.host === host);
        let flight;
        try {
          flight = createAircraftCourseSession(
            {
              course: entry.course,
              legacy: entry.legacy,
              mode,
              configuration: {
                response: selected.response,
                camera: selected.camera,
                advanced: { aircraft: edited.aircraft, controller: selected.controller },
              },
            },
            { createClient, createMission: entry.legacy ? createFlight : createWorldFlight },
          );
          await flight.prepare();
          flight.arm();
          await flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.5 });
          const state = flight.snapshot();
          assert.equal(state.ticks, 1);
          assert.equal(state.failure, null);
          assert.equal(state.aircraftRadiusMm, edited.aircraft.radius * 1000);
          assert.ok(
            state.aircraftSupportHeightMm >= edited.aircraft.geometry.bodyHalfExtents.y * 1000,
          );
        } catch (error) {
          failures.push(`${preset.id}/${host}/${mode}: ${error.message}`);
        } finally {
          await flight?.dispose();
        }
      }
  }
  assert.equal(failures.length, 0, failures.join('\n'));
});
