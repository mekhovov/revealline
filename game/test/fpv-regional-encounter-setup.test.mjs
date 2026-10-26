import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';

await initAdvancedRuntime();
const terrainFixture = await createEnduranceFixture();
const deferred = () => {
  let release;
  const promise = new Promise((resolve) => {
    release = resolve;
  });
  return { promise, release };
};
function setup() {
  const aircraft = createPresetConfiguration('holybro-x650-v2'),
    clients = [],
    gates = { snapshot: null, initialize: null };
  const base = createAdvancedRegionalSession(
    {
      manifest: terrainFixture.terrain.manifest,
      source: terrainFixture.terrain.source,
      response: aircraft.response,
      camera: aircraft.camera,
      advanced: { aircraft: aircraft.aircraft, controller: aircraft.controller },
    },
    {
      createClient() {
        const record = {
          index: clients.length,
          disposed: false,
          snapshotPending: false,
          initializing: false,
        };
        clients.push(record);
        let simulation;
        return {
          async initialize(options) {
            record.initializing = true;
            await gates.initialize?.promise;
            simulation = createAdvancedSimulation(options);
            record.initializing = false;
            return { telemetry: simulation.telemetry() };
          },
          async stageTerrainFrame(frame) {
            return simulation.stageTerrainFrame(frame);
          },
          async commitTerrainFrame(value) {
            return simulation.commitTerrainFrame(value);
          },
          async snapshot() {
            record.snapshotPending = true;
            await gates.snapshot?.promise;
            const value = simulation.snapshot();
            record.snapshotPending = false;
            return value;
          },
          async telemetry() {
            return simulation.telemetry();
          },
          dispose() {
            record.disposed = true;
            simulation?.dispose();
          },
        };
      },
    },
  );
  const spawn = terrainFixture.terrain.manifest.spawns[0].position;
  const actor = {
    id: 'initial-life',
    slotId: 'encounter-slot-01',
    type: 'drone',
    position: { ...spawn, x: spawn.x + 5000 },
    radius: 450,
    height: 900,
    status: 'active',
  };
  return { base, clients, gates, actor };
}

test('Regional Advanced combat setup drains an initial checkpoint and owns the worker replacement', async () => {
  const { base, clients, gates, actor } = setup();
  try {
    await base.prepare();
    gates.snapshot = deferred();
    const firstSave = base.exportRecovery();
    await waitFor(() => clients[0].snapshotPending);
    const configuring = base.configureEncounterActors([actor]);
    assert.equal(
      clients.length,
      1,
      'Do not replace a worker while its accepted checkpoint is pending',
    );
    gates.initialize = deferred();
    gates.snapshot.release();
    gates.snapshot = null;
    const prior = await firstSave;
    await waitFor(() => clients.length === 2 && clients[1].initializing);
    assert.equal(base.arm(), false, 'The player cannot arm during actor setup');
    const nextSave = base.exportRecovery();
    assert.equal(clients[0].disposed, false);
    gates.initialize.release();
    gates.initialize = null;
    await configuring;
    const next = await nextSave;
    assert.equal(prior.environment.encounter, undefined);
    assert.equal(typeof next.environment.encounter, 'string');
    assert.equal(clients[0].disposed, true);
    assert.equal(base.snapshot().advancedTelemetry.dynamicColliders.length, 1);
    assert.equal(base.arm(), true);
  } finally {
    gates.snapshot?.release();
    gates.initialize?.release();
    await base.dispose();
  }
});

test('Regional Advanced paused actor setup cannot publish its cancelled candidate worker', async () => {
  const { base, clients, gates, actor } = setup();
  try {
    await base.prepare();
    const before = base.snapshot();
    gates.initialize = deferred();
    const configuring = base.configureEncounterActors([actor]);
    await waitFor(() => clients.length === 2 && clients[1].initializing);
    base.pause();
    gates.initialize.release();
    gates.initialize = null;
    await assert.rejects(configuring, /Combat setup changed/);
    assert.equal(clients[0].disposed, false);
    assert.equal(clients[1].disposed, true);
    assert.deepEqual(base.snapshot().position, before.position);
    assert.equal(base.snapshot().advancedTelemetry.dynamicColliders.length, 0);
    assert.equal(base.arm(), true);
  } finally {
    gates.initialize?.release();
    await base.dispose();
  }
});
