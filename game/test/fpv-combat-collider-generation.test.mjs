import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { COMBAT_SHAPE_FORMAT } from '../../optional-practice/civilian-fpv/world-collision.mjs';
await initAdvancedRuntime();
for (const modern of [false, true])
  test(`128 collider generations atomically commit, reject and restore (${modern ? 'aircraft' : 'reference'})`, async () => {
    const dynamicColliders = Array.from({ length: 128 }, (_, i) => ({
      id: `encounter-slot-${i}`,
      position: { x: 10 + i * 2, y: 2, z: 0 },
      shape: i % 2 ? 'sphere' : 'cylinder',
      radius: 0.5,
      height: i % 2 ? 1 : 1.8,
      enabled: false,
    }));
    const sim = createAdvancedSimulation({
      ...(modern ? createPresetConfiguration('meteor75-analog-2022') : {}),
      floor: false,
      gravity: { x: 0, y: 0, z: 0 },
      dynamicColliders,
      dynamicShapeFormat: COMBAT_SHAPE_FORMAT,
    });
    const motions = () =>
      sim.telemetry().dynamicColliders.map((entry, i) => ({
        id: entry.id,
        from: entry.position,
        to: { ...entry.position, z: 4 },
        enabled: false,
        shapeDescriptor: {
          shape: dynamicColliders[i].shape,
          radius: 0.5,
          height: dynamicColliders[i].height,
          spawnId: `wave-2-slot-${i}`,
        },
      }));
    try {
      const before = sim.snapshot(),
        first = sim.proposeMission({ motions: motions() });
      assert.equal(first.telemetry.dynamicColliders.length, 128);
      assert.equal(first.telemetry.dynamicColliders[127].spawnId, 'wave-2-slot-127');
      sim.commitMission({ transaction: first.transaction, accepted: false });
      assert.deepEqual(sim.snapshot(), before);
      sim.stepMission({ motions: motions() });
      const saved = sim.snapshot(),
        record = sim.recording();
      const bad = motions();
      bad[0].shapeDescriptor.radius = 0.6;
      assert.throws(() => sim.stepMission({ motions: bad }), /admitted slot/);
      assert.deepEqual(sim.snapshot(), saved);
      const second = motions();
      second[0].shapeDescriptor.spawnId = 'wave-3';
      sim.stepMission({ motions: second });
      sim.restore(saved);
      assert.equal(sim.snapshot().world, saved.world);
      assert.deepEqual(sim.snapshot().actors, saved.actors);
      assert.equal(sim.telemetry().dynamicColliders[0].spawnId, 'wave-2-slot-0');
      assert.deepEqual(await verifyAdvancedRecovery(saved), saved);
      const replay = await replayAdvancedRecording(record);
      assert.equal(replay.snapshot.world, saved.world);
    } finally {
      sim.dispose();
    }
  });

test('Standard native preserves all 128 slots through promoted health, reset and recovery', async () => {
  const { createWorldFlight } = await import(
    '../../optional-practice/civilian-fpv/world-model.mjs'
  );
  const { encounterPhysicsCourse } = await import(
    '../../optional-practice/civilian-fpv/encounter-runtime.mjs'
  );
  const { FLIGHT_COURSES } = await import('../../optional-practice/civilian-fpv/catalogue.mjs');
  const base = createWorldFlight({
    course: encounterPhysicsCourse(FLIGHT_COURSES[0]),
    encounterPhysicsOnly: true,
    unscoredPractice: true,
  });
  const p = base.snapshot().position;
  const actors = Array.from({ length: 128 }, (_, i) => ({
    id: `life-${i}`,
    slotId: `slot-${i}`,
    type: 'drone',
    position: { ...p, x: p.x + 3000 + i * 10, y: p.y + 2000 },
    radius: 350,
    height: 700,
    health: 100,
    maxHealth: 100,
    status: 'active',
  }));
  try {
    base.configureEncounterActors(actors);
    base.arm();
    base.stageEncounterActors({
      actors: actors.map((a) => ({ ...a, health: 400, maxHealth: 400 })),
      motions: actors.map((a) => ({
        id: a.slotId,
        from: a.position,
        to: a.position,
        enabled: true,
      })),
    });
    base.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    base.pause();
    const saved = base.encounterCheckpoint();
    assert.equal(saved.state.actors.length, 128);
    assert.ok(saved.state.actors.every((a) => a.maxHealth === 100));
    base.reset();
    base.restoreEncounterCheckpoint(saved);
    assert.equal(base.snapshot().ticks, 1);
    base.reset();
    base.restoreEncounterCheckpoint(base.encounterCheckpoint());
    assert.equal(base.snapshot().actors.length, 128);
  } finally {
    base.dispose();
  }
});
