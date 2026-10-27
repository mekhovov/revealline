import test from 'node:test';
import assert from 'node:assert/strict';
import { realRegionalGeometry } from './helpers/fpv-regional-real-geometry.mjs';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { aircraftPerformance } from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { createVerifiedFlightGeometry } from '../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';

await initAdvancedRuntime();
const regions = [
  'urban-earthworks-study',
  'canal-city-study',
  'alpine-highlands-study',
  'lunar-basin-study',
  'canyon-expanse-study',
  'tropical-coastal-districts',
];
const neutral = (throttle = 0) => ({ roll: 0, pitch: 0, yaw: 0, throttle });
const upright = (q) => 1 - 2 * (q.x * q.x + q.z * q.z);
function fixture(configuration, { coverage } = {}) {
  let simulation;
  const session = createAdvancedRegionalSession(configuration, {
    ...(coverage
      ? {
          createGeometry(...args) {
            const geometry = createVerifiedFlightGeometry(...args);
            return {
              ...geometry,
              motionCoverage: (...input) => coverage(...input) ?? geometry.motionCoverage(...input),
            };
          },
        }
      : {}),
    createClient() {
      let owner;
      return {
        async initialize(options) {
          owner = createAdvancedSimulation(options);
          simulation ??= owner;
          return { telemetry: owner.telemetry() };
        },
        async propose(sample) {
          owner.enqueueInput(sample);
          return owner.proposeMission();
        },
        async commit(decision) {
          return owner.commitMission(decision);
        },
        async stageTerrainFrame(frame) {
          return owner.stageTerrainFrame(frame);
        },
        async commitTerrainFrame(decision) {
          const result = owner.commitTerrainFrame(decision);
          if (decision.accepted) simulation = owner;
          return result;
        },
        async snapshot() {
          return owner.snapshot();
        },
        async restore(saved) {
          return owner.restore(await verifyAdvancedRecovery(saved));
        },
        dispose() {
          owner?.dispose();
        },
      };
    },
  });
  return { session, simulation: () => simulation };
}
function configuration(geometry, selected, mode, index) {
  const spawn = geometry.manifest.spawns[index % geometry.manifest.spawns.length];
  return {
    ...geometry,
    spawnId: spawn.id,
    initialHeading: geometry.authoredStartHeadings[spawn.id] ?? 'region-centre',
    advanced: { aircraft: selected.aircraft, controller: selected.controller },
    response: selected.response,
    mode,
  };
}
async function flight(h, selected, mode, ticks = 150) {
  await h.session.prepare();
  const effective = h.simulation().configuration();
  assert.deepEqual(effective.aircraft, selected.aircraft);
  assert.deepEqual(effective.controller, selected.controller);
  assert.deepEqual(effective.response.response, selected.response);
  assert.equal(effective.response.mode, mode);
  assert.equal(h.session.arm(), true);
  const start = h.session.snapshot();
  let minimumUpright = 1,
    maximumYaw = 0,
    maximumRoll = 0;
  for (let tick = 0; tick < ticks; tick++) {
    const controls = neutral(aircraftPerformance(selected.aircraft).hoverThrottle + 0.025);
    if (tick >= 40 && tick < 50) controls.yaw = 0.3;
    if (tick >= 70 && tick < 75) controls.roll = 0.18;
    if (tick >= 75 && tick < 80) controls.roll = -0.18;
    const state = await h.session.step(controls);
    assert.equal(state.status, 'active', `${state.reason}: ${state.failure}`);
    assert.equal(state.ticks, tick + 1);
    assert.ok(Object.values(state.advancedTelemetry.position).every(Number.isFinite));
    assert.ok(Object.values(state.advancedTelemetry.velocity).every(Number.isFinite));
    minimumUpright = Math.min(minimumUpright, upright(state.advancedTelemetry.orientation));
    maximumYaw = Math.max(maximumYaw, Math.abs(state.advancedTelemetry.achievedRates.yaw));
    maximumRoll = Math.max(maximumRoll, Math.abs(state.advancedTelemetry.achievedRates.roll));
  }
  const final = h.session.snapshot();
  assert.ok(minimumUpright > 0.9, `Uncommanded inversion: ${minimumUpright}`);
  assert.ok(maximumYaw > 5, `Yaw ignored: ${maximumYaw}`);
  assert.ok(maximumRoll > 1, `Roll ignored: ${maximumRoll}`);
  assert.ok(final.position.y > start.position.y + 100, 'Positive lift did not increase altitude');
  assert.equal(final.advancedTelemetry.usedAh, 0);
  assert.equal(final.aircraftRadiusMm, Math.ceil(selected.aircraft.radius * 1000));
  return { start, final, minimumUpright, maximumYaw, maximumRoll };
}

for (const region of regions)
  test(`all aircraft fly actual ${region} geometry in both modes`, async (t) => {
    const geometry = await realRegionalGeometry(region);
    const failures = [];
    for (const [index, preset] of listAircraftPresets().entries())
      for (const mode of ['acro', 'self-level']) {
        const selected = createPresetConfiguration(preset.id);
        const h = fixture(
          configuration(geometry, selected, mode, index + (mode === 'acro' ? 0 : 3)),
        );
        try {
          await flight(h, selected, mode);
        } catch (error) {
          failures.push(
            `${preset.id}/${mode}/${h.session.snapshot().spawnId ?? index}: ${error.message}`,
          );
        } finally {
          await h.session.dispose();
        }
      }
    t.diagnostic(
      `${geometry.reference.revision}: ${listAircraftPresets().length * 2} three-second flights across ${geometry.manifest.spawns.length} authored starts; exact rates/controller/aircraft verified`,
    );
    assert.deepEqual(failures, []);
  });

test('dense Canal highwalk geometry preserves rollback, checkpoint recovery and exact continuation', async () => {
  const geometry = await realRegionalGeometry('canal-city-study');
  const selected = createPresetConfiguration('meteor75-analog-2022');
  const index = geometry.manifest.spawns.findIndex((spawn) => spawn.id === 'highwalk');
  assert.ok(index >= 0);
  let reject = false;
  const h = fixture(configuration(geometry, selected, 'acro', index), {
    coverage: () => (reject ? { status: 'unknown-cell' } : null),
  });
  let stage = 'initial flight';
  try {
    await flight(h, selected, 'acro', 100);
    h.session.pause();
    stage = 'initial recovery';
    const saved = await h.session.captureRecovery();
    assert.equal(saved.simulation.checkpoint.terrain.format, 'AircraftCollisionFrame.v1');
    assert.ok(saved.simulation.checkpoint.terrain.colliders.length > 128);
    const before = h.simulation().stateHash();
    reject = true;
    stage = 'rejected interval';
    h.session.arm();
    const rejected = await h.session.step({ ...neutral(0.8), roll: 0.6 });
    assert.equal(rejected.reason, 'terrain-required');
    assert.equal(
      h.simulation().stateHash(),
      before,
      'Rejected dense-terrain motion changed the physical state',
    );
    const after = await h.session.captureRecovery();
    for (const key of ['world', 'controller', 'terrain'])
      assert.equal(
        JSON.stringify(after.simulation.checkpoint[key]),
        JSON.stringify(saved.simulation.checkpoint[key]),
        `Rejected interval changed ${key}`,
      );
    const physical = ({ acceptedSequence: _sequence, acceptedTimestampUs: _timestamp, ...state }) =>
      state;
    assert.deepEqual(
      physical(after.simulation.checkpoint.state),
      physical(saved.simulation.checkpoint.state),
    );
    assert.deepEqual(after.simulation.recording, saved.simulation.recording);
    reject = false;
    stage = 'restore after rejection';
    await h.session.restoreRecovery(saved);
    assert.equal(h.simulation().stateHash(), before);
    const input = neutral(aircraftPerformance(selected.aircraft).hoverThrottle + 0.02);
    const continuation = async () => {
      h.session.arm();
      for (let tick = 0; tick < 10; tick++) await h.session.step(input);
      h.session.pause();
      return h.simulation().stateHash();
    };
    const expected = await continuation();
    stage = 'restore after continuation';
    await h.session.restoreRecovery(saved);
    assert.equal(await continuation(), expected);
    stage = 'invalid terrain origin';
    const retainedHash = h.simulation().stateHash();
    const retainedOrigin = h.session.snapshot().originMm;
    for (const terrainOriginMm of [
      { ...saved.terrainOriginMm, x: 0 },
      { ...saved.terrainOriginMm, z: 1e12 },
      { ...saved.terrainOriginMm, extra: true },
      { ...saved.terrainOriginMm, x: 64000, z: 64000 },
    ]) {
      await assert.rejects(
        h.session.restoreRecovery({ ...saved, terrainOriginMm }),
        /terrain (origin|window changed)/,
      );
      assert.equal(h.simulation().stateHash(), retainedHash);
      assert.deepEqual(h.session.snapshot().originMm, retainedOrigin);
    }
  } catch (error) {
    throw new Error(`${stage}: ${error.message}`, { cause: error });
  } finally {
    await h.session.dispose();
  }
});
