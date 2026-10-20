import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
  verifyAdvancedRecovery,
  validateAdvancedPracticeRecovery,
  ADVANCED_MAX_SECONDS,
  ADVANCED_MISSION_HZ,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAdvancedTerrainFrame } from '../../optional-practice/civilian-fpv/advanced-terrain.mjs';
import { createAdvancedWorkerHandler } from '../../optional-practice/civilian-fpv/advanced-worker.mjs';
import RAPIER from '../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';

await initAdvancedRuntime();
const collider = (id = 'encounter-slot-01', position = { x: 5, y: 2, z: 0 }) => ({
  id,
  position,
  radius: 0.5,
  height: 1,
  shape: 'sphere',
  enabled: true,
});
const options = (extra) => ({
  floor: false,
  gravity: { x: 0, y: 0, z: 0 },
  dynamicColliders: [collider()],
  ...extra,
});
const motion = (sim, to, enabled) => ({
  id: 'encounter-slot-01',
  from: sim.telemetry().dynamicColliders[0].position,
  to,
  ...(enabled === undefined ? {} : { enabled }),
});
const install = (sim) => {
  const frame = createAdvancedTerrainFrame({
    sourceIdentity: '123456789abcdef0',
    colliders: [
      {
        id: 'floor-0',
        vertices: [-10, 0, -10, -10, 0, 10, 10, 0, 10, 10, 0, -10],
        indices: [0, 1, 2, 0, 2, 3],
      },
    ],
  });
  const staged = sim.stageTerrainFrame(frame);
  sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
};

test('encounter reference clock continues through the historical twelve-minute boundary', () => {
  const sim = createAdvancedSimulation(options({ dynamicColliders: [] }));
  try {
    const boundary = ADVANCED_MAX_SECONDS * ADVANCED_MISSION_HZ;
    for (let tick = 0; tick <= boundary; tick++) sim.stepMission();
    assert.equal(sim.telemetry().missionTick, boundary + 1);
    assert.equal(sim.recordingStatus().localPractice, true);
    assert.equal(sim.recordingStatus().fromMission, boundary);
    sim.enqueueInput({
      sequence: 0,
      timestampUs: (boundary + 1) * 20000,
      controls: { roll: 0, pitch: 0, yaw: 0, throttle: 0 },
    });
    sim.stepMission();
    assert.equal(sim.telemetry().consumedSequence, 0);
    const saved = sim.snapshot();
    sim.restore(saved);
    assert.equal(sim.telemetry().missionTick, boundary + 2);
  } finally {
    sim.dispose();
  }
});

test('worker forwards moving actor proposals, cancellation, accepted steps and recording status', async () => {
  let reply,
    id = 0;
  const handler = createAdvancedWorkerHandler((value) => {
    reply = value;
  });
  const request = async (type, fields = {}) => {
    await handler.receive({ id: ++id, session: 'moving-reference', type, ...fields });
    assert.equal(reply.error, undefined);
    return reply.result;
  };
  try {
    await request('init', { options: options() });
    const motions = [
      {
        id: 'encounter-slot-01',
        from: { x: 5, y: 2, z: 0 },
        to: { x: 6, y: 2, z: 0 },
        enabled: false,
      },
    ];
    const proposal = await request('propose', { motions });
    assert.equal(proposal.telemetry.dynamicColliders[0].position.x, 6);
    const rejected = await request('commit', {
      decision: { transaction: proposal.transaction, accepted: false },
    });
    assert.equal(rejected.telemetry.dynamicColliders[0].position.x, 5);
    const accepted = await request('step', { motions });
    assert.equal(accepted.telemetry.dynamicColliders[0].enabled, false);
    assert.equal((await request('recording')).motionEvents.length, 1);
    assert.equal((await request('recording-status')).complete, true);
  } finally {
    handler.dispose();
  }
});

test('legacy moving geometry is optional and cannot alias static IDs or admit malformed shapes', () => {
  const old = createAdvancedSimulation();
  assert.equal(Object.hasOwn(old.configuration(), 'dynamicColliders'), false);
  assert.equal(Object.hasOwn(old.snapshot(), 'actors'), false);
  assert.equal(Object.hasOwn(old.recording(), 'motionEvents'), false);
  old.dispose();
  for (const dynamicColliders of [
    [collider(), collider()],
    [collider('bad', { x: NaN, y: 0, z: 0 })],
    [{ ...collider(), shape: 'box' }],
    [{ ...collider(), radius: 0 }],
  ])
    assert.throws(() => createAdvancedSimulation(options({ dynamicColliders })));
  assert.throws(
    () =>
      createAdvancedSimulation(
        options({
          obstacles: [
            { id: 'encounter-slot-01', min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
          ],
        }),
      ),
    /Unique/,
  );
});

for (const regional of [false, true])
  test(`moving actor missions roll back and replay exact accepted poses (${regional ? 'Regional' : 'reference'})`, async () => {
    const sim = createAdvancedSimulation(
      options(regional ? { terrain: { format: 'AdvancedRegionalTerrain.v1' } } : {}),
    );
    try {
      if (regional) install(sim);
      const before = sim.snapshot(),
        hash = sim.stateHash();
      const rejected = sim.proposeMission({ motions: [motion(sim, { x: 6, y: 2, z: 0 }, false)] });
      assert.equal(rejected.telemetry.dynamicColliders[0].enabled, false);
      sim.commitMission({ transaction: rejected.transaction, accepted: false });
      assert.deepEqual(sim.snapshot(), before);
      assert.equal(sim.stateHash(), hash);
      assert.throws(
        () =>
          sim.stepMission({
            motions: [{ id: 'unknown', from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 } }],
          }),
        /Unknown/,
      );
      assert.throws(
        () =>
          sim.stepMission({
            motions: [{ ...motion(sim, { x: 6, y: 2, z: 0 }), from: { x: 4, y: 2, z: 0 } }],
          }),
        /accepted pose/,
      );
      assert.deepEqual(sim.snapshot(), before);
      for (let index = 0; index < 55; index++)
        sim.stepMission({
          motions: [motion(sim, { x: 5 + (index + 1) / 100, y: 2, z: 0 }, index !== 54)],
        });
      const saved = sim.snapshot(),
        record = sim.recording();
      assert.equal(record.config.dynamicMotionFormat, 'AdvancedMovingActors.v1');
      assert.equal(record.motionEvents.length, 55);
      assert.equal(sim.telemetry().dynamicColliders[0].enabled, false);
      sim.stepMission({ motions: [motion(sim, { x: 6, y: 2, z: 0 }, true)] });
      sim.restore(saved);
      assert.equal(sim.stateHash(), record.finalHash);
      const replay = await replayAdvancedRecording(record);
      assert.equal(replay.snapshot.recording.missionTicks, 55);
      assert.equal(replay.snapshot.world, saved.world);
      assert.deepEqual(await verifyAdvancedRecovery(saved), saved);
      const tampered = structuredClone(record);
      tampered.motionEvents[3][1][0].to.x += 0.5;
      await assert.rejects(() => replayAdvancedRecording(tampered));
    } finally {
      sim.dispose();
    }
  });

test('moving collider contacts expose accepted actor IDs and normals and disabled bodies do not collide', () => {
  const sim = createAdvancedSimulation(
    options({ dynamicColliders: [collider('encounter-slot-01', { x: 0.6, y: 2, z: 0 })] }),
  );
  try {
    sim.stepMission({ motions: [motion(sim, { x: 0.45, y: 2, z: 0 })] });
    assert.equal(sim.telemetry().contact.touching, true);
    assert.equal(sim.telemetry().contact.entries[0].id, 'encounter-slot-01');
    assert.equal(sim.telemetry().contact.entries[0].moving, true);
    assert.ok(Math.abs(sim.telemetry().contact.entries[0].normal.x) > 0.9);
    sim.stepMission({ motions: [motion(sim, { x: 0.45, y: 2, z: 0 }, false)] });
    assert.equal(sim.telemetry().contact.touching, false);
  } finally {
    sim.dispose();
  }
});

for (const regional of [false, true])
  test(`encounter recording rolls bounded local history without stopping ${regional ? 'Regional' : 'reference'} flight`, async () => {
    const dynamicColliders = Array.from({ length: 128 }, (_, index) =>
      collider(`target-${index}-${'x'.repeat(110)}`, { x: 100 + index * 2, y: 2, z: 0 }),
    );
    const sim = createAdvancedSimulation(
      options({
        dynamicColliders,
        ...(regional ? { terrain: { format: 'AdvancedRegionalTerrain.v1' } } : {}),
      }),
    );
    try {
      if (regional) install(sim);
      let tick = 0;
      while (sim.telemetry().recordingStatus.complete && tick < 250) {
        const motions = sim.telemetry().dynamicColliders.map((actor) => ({
          id: actor.id,
          from: actor.position,
          to: { ...actor.position, z: (tick + 1) / 1000 },
        }));
        sim.stepMission({ motions });
        tick++;
      }
      assert.ok(tick < 250, 'bounded recording rolls before memory cap');
      assert.equal(sim.telemetry().recordingStatus.localPractice, true);
      assert.equal(sim.telemetry().recordingStatus.fromMission, tick);
      sim.stepMission();
      assert.equal(sim.telemetry().missionTick, tick + 1);
      const saved = sim.snapshot();
      assert.ok(JSON.stringify(sim.recording()).length < 8 * 1024 * 1024);
      sim.restore(saved);
      assert.equal(sim.telemetry().missionTick, tick + 1);
      await assert.rejects(() => replayAdvancedRecording(sim.recording()), /local-practice/);
      await assert.rejects(() => verifyAdvancedRecovery(saved), /local-practice/);
      if (regional) {
        const expectedIdentity = sim.identity;
        assert.deepEqual(
          await validateAdvancedPracticeRecovery(saved, { expectedIdentity }),
          saved,
        );
        await assert.rejects(
          () => validateAdvancedPracticeRecovery(saved, { expectedIdentity: 'foreign' }),
          /configuration/,
        );
        const corrupt = structuredClone(saved);
        const world = RAPIER.World.restoreSnapshot(Buffer.from(corrupt.world, 'base64'));
        try {
          world.getCollider(corrupt.actors[0].handle).setFriction(0.1);
          corrupt.world = Buffer.from(world.takeSnapshot()).toString('base64');
        } finally {
          world.free();
        }
        await assert.rejects(
          () => validateAdvancedPracticeRecovery(corrupt, { expectedIdentity }),
          /physics properties/,
        );
        let reply,
          id = 0;
        const handler = createAdvancedWorkerHandler((value) => {
          reply = value;
        });
        const request = async (type, fields) => {
          await handler.receive({ id: ++id, session: 'practice-recovery', type, ...fields });
          return reply;
        };
        try {
          assert.equal((await request('init', { options: sim.configuration() })).error, undefined);
          assert.match((await request('restore', { snapshot: saved })).error, /local-practice/);
          assert.match(
            (await request('restore-practice', { snapshot: corrupt })).error,
            /physics properties/,
          );
          const restored = await request('restore-practice', { snapshot: saved });
          assert.equal(restored.error, undefined);
          assert.equal(restored.result.missionTick, tick + 1);
          assert.equal(restored.result.recordingStatus.localPractice, true);
          assert.equal(restored.result.recordingStatus.complete, false);
          assert.equal((await request('step')).result.telemetry.missionTick, tick + 2);
        } finally {
          handler.dispose();
        }
      }
    } finally {
      sim.dispose();
    }
  });
