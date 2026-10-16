import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../../game/data-json.mjs';
import RAPIER from '../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';
import {
  createAdvancedTerrainFrame,
  validateAdvancedTerrainFrame,
  packTerrainCollider,
  unpackTerrainCollider,
  validateTerrainHistory,
  ADVANCED_TERRAIN_FORMAT,
} from '../../optional-practice/civilian-fpv/advanced-terrain.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  regionalQualificationFrames,
  regionalQualificationOptions,
  runAdvancedRegionalQualification,
} from './helpers/fpv-advanced-regional-qualification.mjs';
await initAdvancedRuntime();
const source = () => ({
  sourceIdentity: '123456789abcdef0',
  colliders: [
    {
      id: 'floor-0',
      vertices: [-5, 0, -5, -5, 0, 5, 5, 0, 5, 5, 0, -5],
      indices: [0, 1, 2, 0, 2, 3],
    },
  ],
});
const install = (sim, frame) => {
  const staged = sim.stageTerrainFrame(frame);
  return sim.commitTerrainFrame({ transaction: staged.transaction, accepted: true });
};
test('terrain geometry canonicalizes finite Float32 vertices and stable collider order', () => {
  const input = source();
  input.colliders.push({ ...structuredClone(input.colliders[0]), id: 'a-wall' });
  input.colliders[0].vertices[0] = -5.123456789;
  const frame = createAdvancedTerrainFrame(input),
    other = createAdvancedTerrainFrame({ ...input, colliders: [...input.colliders].reverse() });
  assert.deepEqual(frame, other);
  assert.equal(frame.colliders[1].vertices[0], Math.fround(-5.123456789));
  assert.deepEqual(validateAdvancedTerrainFrame(frame), frame);
  for (const collider of frame.colliders)
    assert.deepEqual(unpackTerrainCollider(packTerrainCollider(collider)), collider);
});
test('terrain rejects unsafe paths, accessors, malformed geometry and identity tampering atomically', () => {
  for (const id of ['../floor', 'a/b', 'a\\b', '__proto__', 'constructor', 'a..b', '']) {
    const value = source();
    value.colliders[0].id = id;
    assert.throws(() => createAdvancedTerrainFrame(value));
  }
  for (const mutate of [
    (value) => value.colliders.push(value.colliders[0]),
    (value) => (value.colliders[0].vertices[0] = Infinity),
    (value) => (value.colliders[0].vertices[0] = 1000001),
    (value) => (value.colliders[0].indices[0] = -1),
    (value) => (value.colliders[0].indices[0] = 4),
    (value) => (value.colliders[0].indices = [0, 0, 0]),
    (value) => (value.extra = true),
  ]) {
    const value = source();
    mutate(value);
    assert.throws(() => createAdvancedTerrainFrame(value));
  }
  const accessor = source();
  Object.defineProperty(accessor, 'sourceIdentity', {
    get() {
      throw Error('getter ran');
    },
    enumerable: true,
  });
  assert.throws(
    () => createAdvancedTerrainFrame(accessor),
    (error) => error.message !== 'getter ran',
  );
  const frame = createAdvancedTerrainFrame(source());
  frame.colliders[0].vertices[0] = -4;
  assert.throws(() => validateAdvancedTerrainFrame(frame), /identity changed/);
});
test('maximum frame history shares each decoded mesh instead of amplifying import memory', () => {
  const input = source();
  input.colliders[0].vertices = input.colliders[0].vertices.concat(Array(3 * (65536 - 4)).fill(0));
  const collider = packTerrainCollider(createAdvancedTerrainFrame(input).colliders[0]);
  const terrainFrames = Array.from({ length: 512 }, (_, index) => {
    const descriptor = {
      sourceIdentity: (index + 1).toString(16).padStart(16, '0'),
      colliders: [collider.key],
    };
    return {
      identity: dataIdentity({ format: ADVANCED_TERRAIN_FORMAT, ...descriptor }),
      ...descriptor,
    };
  });
  const history = {
    terrainColliders: [collider],
    terrainFrames,
    terrainEvents: terrainFrames.map((_, index) => [index * 5, index]),
  };
  const frames = validateTerrainHistory(history, { substeps: 511 * 5, missionSteps: 5 });
  assert.equal(frames.length, 512);
  assert.equal(new Set(frames.map((frame) => frame.colliders[0])).size, 1);
  assert.equal(new Set(frames.map((frame) => frame.colliders[0].vertices)).size, 1);
  assert.ok(Object.isFrozen(frames[0].colliders[0].vertices));
});
test('staged frame owns the transaction until acceptance and rejection restores all state', () => {
  const sim = createAdvancedSimulation(regionalQualificationOptions()),
    frames = regionalQualificationFrames();
  try {
    assert.throws(() => sim.stepMission(), /terrain must be committed/);
    install(sim, frames[0]);
    sim.stepMission();
    const before = sim.snapshot();
    const staged = sim.stageTerrainFrame(frames[1]);
    for (const operation of [
      () => sim.snapshot(),
      () => sim.recording(),
      () => sim.stepMission(),
      () => sim.proposeMission(),
      () => sim.reset(),
      () => sim.enqueueInput({}),
    ])
      assert.throws(operation, /pending|Commit|Finish/);
    assert.throws(
      () => sim.commitTerrainFrame({ transaction: staged.transaction + 1, accepted: true }),
      /Unknown/,
    );
    sim.commitTerrainFrame({ transaction: staged.transaction, accepted: false });
    assert.deepEqual(sim.snapshot(), before);
    const noop = sim.stageTerrainFrame(frames[0]);
    assert.equal(noop.unchanged, true);
    sim.commitTerrainFrame({ transaction: noop.transaction, accepted: true });
    assert.deepEqual(sim.snapshot(), before);
    const saved = sim.snapshot(),
      candidate = RAPIER.World.restoreSnapshot(
        Uint8Array.from(atob(saved.world), (value) => value.charCodeAt(0)),
      );
    candidate.getCollider(saved.terrain.handles[0].handle).setTranslation({ x: 1, y: 0, z: 0 });
    saved.world = Buffer.from(candidate.takeSnapshot()).toString('base64');
    candidate.free();
    assert.throws(() => sim.restore(saved), /collider properties changed/);
    assert.deepEqual(sim.snapshot(), before);
  } finally {
    sim.dispose();
  }
});
test('Regional restore rejects changed physics properties without changing the live attempt', () => {
  const sim = createAdvancedSimulation(regionalQualificationOptions());
  try {
    install(sim, regionalQualificationFrames()[0]);
    for (const step of [false, true]) {
      if (step) sim.stepMission();
      const before = sim.snapshot();
      for (const mutate of [
        (world, body) => body.setAdditionalMass(3, false),
        (world, body) => body.setLinvel({ x: Infinity, y: 0, z: 0 }, false),
        (world, body) => body.setAngvel({ x: 0, y: NaN, z: 0 }, false),
        (world, body) => body.setTranslation({ x: 1000001, y: 0, z: 0 }, false),
        (world, body) => body.addForce({ x: 0, y: Infinity, z: 0 }, false),
        (world, body) => body.addTorque({ x: 0, y: NaN, z: 0 }, false),
        (world, body) => body.setGravityScale(0, false),
        (world, body) => body.setBodyType(RAPIER.RigidBodyType.Fixed, false),
        (world, body) => body.setEnabled(false),
        (world, body) => body.lockRotations(true, false),
        (world, body) => body.collider(0).setCollisionGroups(0),
        (world, body) => body.collider(0).setEnabled(false),
        (world) => (world.gravity.y = 0),
        (world) => (world.integrationParameters.numSolverIterations = 4),
        (world) => world.getCollider(before.terrain.handles[0].handle).setSolverGroups(0),
        (world) => {
          const collider = world.getCollider(before.terrain.handles[0].handle);
          const shape = collider.shape;
          collider.setShape(
            new RAPIER.TriMesh(
              shape.vertices,
              shape.indices,
              RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES,
            ),
          );
        },
      ]) {
        const saved = structuredClone(before),
          world = RAPIER.World.restoreSnapshot(
            Uint8Array.from(atob(saved.world), (value) => value.charCodeAt(0)),
          );
        mutate(world, world.getRigidBody(saved.bodyHandle));
        saved.world = Buffer.from(world.takeSnapshot()).toString('base64');
        world.free();
        assert.throws(
          () => sim.restore(saved),
          /physics properties|collision behavior changed|geometry changed|Invalid Regional body/,
          mutate.toString(),
        );
        assert.deepEqual(sim.snapshot(), before);
      }
    }
  } finally {
    sim.dispose();
  }
});
test('streamed collision frames replay, land, take off and recover at frame/hash boundaries', async () => {
  const result = await runAdvancedRegionalQualification();
  const golden = JSON.parse(
    await readFile(new URL('./fixtures/fpv-advanced-regional-v1.json', import.meta.url)),
  );
  for (const field of [
    'backend',
    'identity',
    'simulationIdentity',
    'terrainIdentity',
    'initialHash',
    'hashes',
    'finalHash',
  ])
    assert.deepEqual(result[field], golden[field], `Published Regional v1 ${field} fixture`);
  assert.equal(result.geometry.colliders, 3);
  assert.equal(result.geometry.frames, 3);
  assert.equal(result.geometry.events.length, 5);
  assert.ok(result.contact.minimumZ > 0);
  assert.ok(result.contact.landed && result.contact.takeoff);
});
test('Regional recovery recomputes consumed-input accounting before replacing live state', () => {
  const sim = createAdvancedSimulation(regionalQualificationOptions());
  try {
    install(sim, regionalQualificationFrames()[0]);
    sim.enqueueInput({
      sequence: 0,
      timestampUs: 0,
      controls: { roll: 0.1, pitch: 0, yaw: 0, throttle: 0.2 },
    });
    sim.stepMission();
    const before = sim.snapshot();
    assert.ok(before.state.inputBytes > 0);
    for (const value of [0, before.state.inputBytes + 1]) {
      const saved = structuredClone(before);
      saved.state.inputBytes = value;
      assert.throws(() => sim.restore(saved), /input budget changed/);
      assert.deepEqual(sim.snapshot(), before);
    }
  } finally {
    sim.dispose();
  }
});
test('recording rejects reordered, missing, unused and tampered frame histories', async () => {
  const sim = createAdvancedSimulation(regionalQualificationOptions()),
    frames = regionalQualificationFrames();
  try {
    install(sim, frames[0]);
    sim.stepMission();
    install(sim, frames[1]);
    const record = sim.recording();
    for (const mutate of [
      (r) => r.terrainColliders.reverse(),
      (r) => r.terrainFrames.reverse(),
      (r) => (r.terrainEvents[0][0] = 1),
      (r) => r.terrainEvents.pop(),
      (r) => (r.terrainColliders[0].vertices = 'AAAA'),
      (r) => (r.terrainIdentity = '0000000000000000'),
      (r) => (r.simulationIdentity = '0000000000000000'),
    ]) {
      const value = structuredClone(record);
      mutate(value);
      await assert.rejects(replayAdvancedRecording(value));
    }
    assert.equal((await replayAdvancedRecording(record)).verified, true);
  } finally {
    sim.dispose();
  }
});
