import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import {
  aircraftPerformance,
  createAircraftController,
} from '../../optional-practice/civilian-fpv/aircraft-physics.mjs';
import { createAircraftTerrainFrame } from '../../optional-practice/civilian-fpv/aircraft-terrain.mjs';
import {
  aircraftTakeoffQualification,
  aircraftHoverQualification,
  aircraftAxisQualification,
  aircraftGroundReleaseQualification,
} from './helpers/fpv-aircraft-flight-qualification.mjs';

await initAdvancedRuntime();
const modes = ['acro', 'self-level'];
const axes = ['roll', 'pitch', 'yaw'];
const sample = (tick, controls) => ({ sequence: tick, timestampUs: tick * 20000, controls });
const neutral = (throttle = 0) => ({ roll: 0, pitch: 0, yaw: 0, throttle });
const terrain = () =>
  createAircraftTerrainFrame({
    sourceIdentity: '0123456789abcdef',
    colliders: [
      {
        id: 'support',
        vertices: [-30, 0, -30, 30, 0, -30, 30, 0, 30, -30, 0, 30],
        indices: [0, 2, 1, 0, 3, 2],
      },
    ],
  });

for (const { id } of listAircraftPresets()) {
  test(`${id}: sustained gravity, supported takeoff, hover and keyboard axis/release control`, () => {
    const hover = aircraftHoverQualification(id);
    assert.ok(hover.height > 10, 'Estimated hover must support gravity after motor startup');
    assert.ok(hover.upright > 0.9999, 'Neutral hover must remain level');
    assert.ok(hover.rate < 0.05, 'Neutral hover must not rotate');
    assert.ok(Math.abs(hover.meanVerticalAcceleration) < 0.1, 'Settled thrust must balance weight');
    for (const mode of modes) {
      const takeoff = aircraftTakeoffQualification(id, mode);
      assert.equal(takeoff.floorContact, true, 'Exercise actual load-bearing floor contact');
      assert.ok(takeoff.minimumUpright > 0.99, `${mode}: takeoff must remain within 8° of upright`);
      assert.ok(takeoff.height > 1, `${mode}: aircraft must take off with available thrust`);
      assert.ok(takeoff.rate < 0.1, `${mode}: no sustained rotation on neutral input`);
      for (const axis of axes) {
        const result = aircraftAxisQualification(id, mode, axis);
        assert.ok(result.peakRate > 15, `${mode}/${axis}: requested axis must respond positively`);
        assert.ok(
          result.minimumUpright > 0.7,
          `${mode}/${axis}: a brief tap must stay controllable`,
        );
        assert.ok(
          result.finalHeight > 20,
          `${mode}/${axis}: pulse must not cause an uncontrolled fall`,
        );
        assert.ok(result.releasedRate < 4, `${mode}/${axis}: releasing must arrest rotation`);
        assert.ok(
          result.peakOtherRate < Math.max(1, result.peakRate * 0.2),
          `${mode}/${axis}: cross-axis response must remain bounded`,
        );
        if (mode === 'self-level') {
          assert.ok(Math.abs(result.finalAttitude.roll) < 1, `${axis}: roll must return to level`);
          assert.ok(
            Math.abs(result.finalAttitude.pitch) < 1,
            `${axis}: pitch must return to level`,
          );
        } else {
          assert.ok(
            result.endOfCommand.rate > result.endOfCommand.requested * 0.2,
            `${axis}: rate response must develop during the 200ms keyboard tap`,
          );
          assert.ok(
            Math.abs(result.finalAttitude[axis]) > 10,
            `${axis}: Acro must retain attitude`,
          );
        }
      }
    }
  });

  test(`${id}: centering sticks after sustained ground input permits level takeoff`, () => {
    for (const mode of modes) {
      const result = aircraftGroundReleaseQualification(id, mode);
      assert.equal(result.backend, 'civilian-quad-aircraft.v2');
      assert.ok(
        result.minimumUpright > 0.99,
        `${mode}: stale ground integral must not tip the aircraft`,
      );
      assert.ok(result.height > 1, `${mode}: neutral takeoff must leave the floor`);
      assert.ok(result.rate < 0.1, `${mode}: neutral takeoff must not keep rotating`);
    }
  });
}

test('published v1 aircraft behavior retains the pre-fix ground-contact hashes', () => {
  const hashes = {
    'meteor75-analog-2022': { acro: '31f7fa60', 'self-level': '9b836d57' },
    'helion-pro-o4': { acro: 'd3366a7d', 'self-level': 'd381a4d4' },
  };
  for (const [id, expected] of Object.entries(hashes))
    for (const mode of modes) {
      const result = aircraftGroundReleaseQualification(id, mode, {
        backend: 'civilian-quad-aircraft.v1',
      });
      assert.equal(
        result.hash,
        expected[mode],
        `${id}/${mode}: historical identity must not drift`,
      );
      assert.ok(result.minimumUpright < -0.99, 'Fixture must reproduce the original inversion');
    }
});

test('support policy clears only integral while grounded and retains airborne zero-throttle Airmode', () => {
  const { aircraft, controller: tune } = createPresetConfiguration('meteor75-analog-2022');
  const old = createAircraftController({ aircraft, tune });
  const guarded = createAircraftController({
    aircraft,
    tune,
    groundIntegralPolicy: 'supported-reset.v1',
  });
  assert.notEqual(
    old.identity,
    guarded.identity,
    'Policy is part of the controller checkpoint identity',
  );
  const input = {
    controls: { ...neutral(), roll: 0.5 },
    target: { ...neutral(), roll: 60 },
    sensors: { roll: 0, pitch: 0, yaw: 0 },
    dt: 0.002,
  };
  for (let step = 0; step < 500; step++) {
    assert.deepEqual(guarded.step(input), old.step(input), 'Airborne outputs must stay identical');
    assert.deepEqual(
      guarded.telemetry(),
      old.telemetry(),
      'Airborne integral/filter state must stay identical',
    );
  }
  assert.ok(
    guarded.telemetry().integral.roll > 0,
    'Zero throttle must not erase airborne integral',
  );
  const supported = guarded.step({ ...input, grounded: true });
  assert.equal(guarded.telemetry().integral.roll, 0);
  assert.ok(
    supported.motors[0] > supported.motors[1],
    'P/D/feedforward and armed control remain active',
  );
  guarded.step(input);
  assert.ok(
    guarded.telemetry().integral.roll > 0,
    'Integration resumes immediately after lift-off',
  );
  assert.throws(() => old.restore(guarded.snapshot()), /snapshot mismatch/);
});

test('airborne and wall-contact trajectories remain physically identical across v1 and v2', () => {
  const preset = createPresetConfiguration('meteor75-analog-2022');
  const sims = [1, 2].map((version) =>
    createAdvancedSimulation({
      ...preset,
      backend: `civilian-quad-aircraft.v${version}`,
      spawn: { x: 0.1, y: 5, z: 0 },
      initialVelocity: { x: -1, y: 0, z: 0 },
      gravity: { x: 0, y: 0, z: 0 },
      floor: false,
      obstacles: [{ id: 'wall', min: { x: -1, y: -20, z: -20 }, max: { x: 0, y: 20, z: 20 } }],
      recording: false,
    }),
  );
  let touchedWall = false;
  try {
    for (let tick = 0; tick < 150; tick++) {
      for (const sim of sims) {
        sim.enqueueInput(sample(tick, { ...neutral(), yaw: tick < 50 ? 0.18 : 0 }));
        sim.stepMission();
      }
      const snapshots = sims.map((sim) => sim.snapshot().checkpoint);
      touchedWall ||= snapshots[0].state.contact.touching;
      assert.equal(snapshots[0].state.contact.grounded, false, 'A wall is not supporting ground');
      assert.equal(snapshots[0].world, snapshots[1].world);
      assert.deepEqual(snapshots[0].state, snapshots[1].state);
      assert.deepEqual(snapshots[0].controller.state, snapshots[1].controller.state);
    }
    assert.equal(touchedWall, true);
  } finally {
    sims.forEach((sim) => sim.dispose());
  }
});

test('v1/v2 floor and Regional sessions retain replay, recovery and worker dispatch', async () => {
  for (const version of [1, 2])
    for (const regional of [false, true]) {
      const preset = createPresetConfiguration('meteor75-analog-2022');
      const backend = `civilian-quad-aircraft${regional ? '-regional' : ''}.v${version}`;
      const options = {
        ...preset,
        backend,
        mode: 'self-level',
        spawn: { x: 0, y: preset.aircraft.geometry.bodyHalfExtents.y, z: 0 },
        ...(regional ? { floor: false, terrain: { format: 'AdvancedRegionalTerrain.v1' } } : {}),
      };
      const simulation = createAdvancedSimulation(options);
      let restored;
      try {
        if (regional) {
          const staged = simulation.stageTerrainFrame(terrain());
          simulation.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
        }
        const hover = aircraftPerformance(preset.aircraft).hoverThrottle;
        for (let tick = 0; tick < 180; tick++) {
          const input = sample(tick, {
            ...neutral(tick < 50 ? 0 : Math.min(hover + 0.04, (tick - 50) * 0.007)),
            roll: tick < 50 ? 0.5 : 0,
          });
          simulation.enqueueInput(input);
          simulation.stepMission();
          if (restored) {
            restored.enqueueInput(input);
            restored.stepMission();
            assert.equal(restored.stateHash(), simulation.stateHash());
          }
          if (tick === 74) {
            const checkpoint = await verifyAdvancedRecovery(simulation.snapshot());
            restored = createAdvancedSimulation(checkpoint.config);
            restored.restore(checkpoint);
          }
        }
        const recorded = simulation.recording();
        const replay = await replayAdvancedRecording(recorded);
        assert.equal(replay.snapshot.hash, simulation.stateHash());
        assert.equal(replay.snapshot.config.backend, backend);
        const replies = [];
        const worker = createAdvancedWorkerHandler((message) => replies.push(message));
        try {
          await worker.receive({ id: 1, session: backend, type: 'init', options });
          assert.equal(replies.at(-1).error, undefined);
          assert.equal(replies.at(-1).result.telemetry.backend, backend);
          await worker.receive({
            id: 2,
            session: backend,
            type: 'restore',
            snapshot: simulation.snapshot(),
          });
          assert.equal(replies.at(-1).error, undefined);
          assert.equal(replies.at(-1).result.missionTick, 180);
          if (!regional) {
            await worker.receive({
              id: 3,
              session: backend,
              type: 'verify-recording',
              recording: recorded,
            });
            assert.equal(
              replies.at(-1).error,
              undefined,
              'Old and current reference-arena ghosts stay readable',
            );
          }
        } finally {
          worker.dispose();
        }
      } finally {
        simulation.dispose();
        restored?.dispose();
      }
    }
});
