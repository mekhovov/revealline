import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  createPresetConfiguration,
  getAircraftPreset,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import {
  createTuningLibraryStore,
  initialTuningLibrary,
} from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import RAPIER from '../../optional-practice/civilian-fpv/vendor/rapier/rapier.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/fpv-nazgul-revision1.json', import.meta.url), 'utf8'),
);
const old = fixture.configuration;
const id = 'nazgul-eco-xl5-v11';
await initAdvancedRuntime();

test('Nazgul revision 2 changes exactly the documented propeller dimension and preset revision', () => {
  assert.equal(fixture.capturedFrom, 'cf13bcad9a59a387be7c31c9af8d30d74e7c1860');
  assert.equal(
    createHash('sha256').update(JSON.stringify(old)).digest('hex'),
    '33547e290356555cd9b1d3f9a865d960082935e4a682a8cdbffaf9e5e740905a',
  );
  const preset = getAircraftPreset(id);
  assert.equal(preset.propellerDiameterMm, 129.54);
  assert.equal(preset.revision, 2);
  assert.deepEqual(preset.evidence.propeller.sources, [0, 1, 2]);
  assert.equal(preset.evidence.propeller.kind, 'manufacturer');
  assert.match(preset.sources[1].url, /Pro2193$/);
  assert.match(preset.sources[2].url, /pro964$/);
  assert.equal(preset.sources[2].checked, '2026-10-18');
  assert.equal(preset.evidence.propulsion.kind, 'estimated');
  assert.match(preset.evidence.propulsion.note, /preserves.*0\.0127/);
  const expected = structuredClone(old);
  expected.aircraft.geometry.propellerRadius = 0.06477;
  expected.preset.revision = 2;
  const current = createPresetConfiguration(id);
  assert.deepEqual(current, expected, 'No mass, drag, thrust, torque, gains or other retuning');
  assert.equal(current.aircraft.reactionTorque, old.aircraft.reactionTorque);
  assert.deepEqual(current.controller, old.controller);
});

test('saved revision 1 survives reload, backup restore and component edits until explicit reselection', async () => {
  let saved = null;
  const storage = { getItem: () => saved, setItem: (_key, value) => (saved = value) };
  const library = initialTuningLibrary({ response: old.response, camera: old.camera });
  Object.assign(library.setups[0], {
    advanced: { aircraft: old.aircraft, controller: old.controller },
    preset: old.preset,
    components: old.components,
  });
  const store = createTuningLibraryStore({ storage });
  await store.restore(library);
  const before = store.effective();
  const reopened = createTuningLibraryStore({ storage });
  assert.deepEqual(reopened.effective(), before);
  await reopened.restore(store.export());
  assert.deepEqual(reopened.effective(), before);
  assert.deepEqual(reopened.snapshot().setups[0].preset, { id, revision: 1 });
  assert.deepEqual(reopened.effective().advanced, {
    aircraft: old.aircraft,
    controller: old.controller,
  });
  const battery = structuredClone(old.components.battery);
  battery.massGrams += 10;
  await reopened.saveAircraftComponents({
    setupId: 'my-drone',
    battery,
    cameraPayload: old.components.cameraPayload,
  });
  const edited = reopened.effective();
  assert.equal(edited.advanced.aircraft.geometry.propellerRadius, 0.0635);
  assert.deepEqual(edited.advanced.controller, old.controller);
  assert.deepEqual(reopened.snapshot().setups[0].preset, { id, revision: 1 });
  const current = createPresetConfiguration(id);
  await reopened.saveAircraftConfiguration({
    setupId: 'my-drone',
    advanced: { aircraft: current.aircraft, controller: current.controller },
    preset: current.preset,
    components: current.components,
  });
  assert.deepEqual(reopened.snapshot().setups[0].preset, { id, revision: 2 });
  assert.equal(reopened.effective().advanced.aircraft.geometry.propellerRadius, 0.06477);
  assert.notEqual(reopened.effective().simulationIdentity, before.simulationIdentity);
});

test('pre-correction Nazgul recordings reproduce frozen hashes on both historical backend identities', async () => {
  assert.deepEqual(
    fixture.recordings.map((item) => item.backend),
    ['civilian-quad-aircraft.v1', 'civilian-quad-aircraft.v2'],
  );
  for (const { backend, hash, recording } of fixture.recordings) {
    const replayed = await replayAdvancedRecording(recording);
    assert.equal(replayed.snapshot.hash, hash, backend);
  }
});

test('Nazgul dimension correction leaves free-flight motion identical in Acro and self-level', () => {
  for (const mode of ['acro', 'self-level']) {
    const options = { mode, floor: false, gravity: { x: 0, y: 0, z: 0 } };
    const previous = createAdvancedSimulation({ ...old, ...options });
    const current = createAdvancedSimulation({ ...createPresetConfiguration(id), ...options });
    try {
      assert.notEqual(previous.identity, current.identity, 'Geometry remains part of identity');
      for (let tick = 0; tick < 150; tick++) {
        const input = {
          sequence: tick,
          timestampUs: tick * 20000,
          controls: {
            roll: tick < 100 ? 0.12 : 0,
            pitch: tick < 75 ? -0.09 : 0,
            yaw: tick < 50 ? 0.1 : 0,
            throttle: 0.5,
          },
        };
        previous.enqueueInput(input);
        current.enqueueInput(input);
        const a = previous.stepMission().telemetry;
        const b = current.stepMission().telemetry;
        for (const key of [
          'position',
          'velocity',
          'orientation',
          'achievedRates',
          'motorSpeeds',
          'voltage',
          'current',
        ])
          assert.deepEqual(b[key], a[key], `${mode} tick ${tick} ${key}`);
      }
    } finally {
      previous.dispose();
      current.dispose();
    }
  }
});

test('Nazgul uses the corrected rotor cylinders and cannot tunnel through a thin wall at 40 m/s', () => {
  for (const frequency of [500, 2000]) {
    const sim = createAdvancedSimulation({
      ...createPresetConfiguration(id),
      frequency,
      numericalReference: frequency === 2000,
      floor: false,
      gravity: { x: 0, y: 0, z: 0 },
      spawn: { x: 0, y: 2, z: 2 },
      initialVelocity: { x: 0, y: 0, z: -40 },
      obstacles: [
        { id: 'thin-wall', min: { x: -10, y: -10, z: -0.03 }, max: { x: 10, y: 10, z: 0.03 } },
      ],
    });
    try {
      const checkpoint = sim.snapshot().checkpoint;
      const world = RAPIER.World.restoreSnapshot(Buffer.from(checkpoint.world, 'base64'));
      try {
        const body = world.getRigidBody(checkpoint.bodyHandle);
        assert.equal(body.numColliders(), 5);
        for (let i = 1; i < 5; i++) {
          assert.equal(body.collider(i).shapeType(), RAPIER.ShapeType.Cylinder);
          assert.equal(body.collider(i).shape.radius, Math.fround(0.06477));
        }
      } finally {
        world.free();
      }
      let minimumZ = 2;
      for (let tick = 0; tick < 25; tick++)
        for (const point of sim.stepMission().trace) minimumZ = Math.min(minimumZ, point.z);
      assert.ok(minimumZ > 0, `${frequency} Hz crossed the wall`);
      assert.ok(sim.telemetry().contact.contacts > 0);
    } finally {
      sim.dispose();
    }
  }
});
