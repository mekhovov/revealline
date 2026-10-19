import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { mountAircraftArchiveControls } from '../../optional-practice/civilian-fpv/aircraft-archive-controls.mjs';
import { createAircraftArchiveStore } from '../../optional-practice/civilian-fpv/aircraft-archive.mjs';
import { verifyAircraftArchive } from '../../optional-practice/civilian-fpv/aircraft-archive-verifier.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';

await initAdvancedRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
function createClient(recordingOptions = { segmentBytes: 1 }) {
  let simulation;
  return {
    async initialize(options) {
      simulation = createAdvancedSimulation({ ...options, recordingOptions });
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
    async telemetry() {
      return simulation.telemetry();
    },
    async snapshot() {
      return simulation.snapshot();
    },
    async restore(value) {
      return simulation.restore(value);
    },
    async readSealedSegment(afterIndex) {
      return simulation.readSealedSegment(afterIndex);
    },
    async finalizeArchive(afterIndex) {
      return simulation.finalizeArchive(afterIndex);
    },
    dispose() {
      simulation?.dispose();
    },
  };
}
async function waitForRows(store, predicate) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const rows = await store.list();
    if (predicate(rows)) return rows;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('Archive controls did not reach the expected persisted state');
}
for (const host of ['academy', 'regional'])
  test(`${host} archive controls persist real sealed physics, restore an evicted checkpoint range and finish its tail`, async (t) => {
    const preset = createPresetConfiguration('meteor75-analog-2022');
    const region = host === 'regional' ? await createEnduranceFixture() : null;
    async function createSession(segmentBytes = 1) {
      const clientOptions = { createClient: () => createClient({ segmentBytes }) };
      const session =
        host === 'academy'
          ? createAircraftCourseSession(
              {
                course: FLIGHT_COURSES[0],
                mode: 'acro',
                legacy: true,
                configuration: {
                  response: preset.response,
                  camera: preset.camera,
                  advanced: { aircraft: preset.aircraft, controller: preset.controller },
                },
              },
              clientOptions,
            )
          : createAdvancedRegionalSession(
              {
                manifest: region.terrain.manifest,
                source: region.terrain.source,
                advanced: { aircraft: preset.aircraft, controller: preset.controller },
                response: preset.response,
                mode: 'acro',
              },
              clientOptions,
            );
      t.after(() => session.dispose());
      await session.prepare();
      return session;
    }
    let session = await createSession(),
      id = 0;
    const document = new Document(),
      window = new Events();
    const store = createAircraftArchiveStore({ indexedDB: managedIndexedDB().indexedDB });
    const ui = mountAircraftArchiveControls({
      parent: document.body,
      window,
      key: host,
      store,
      getSession: () => session,
      onPause: () => session.pause(),
      makeId: () => `real-${host}-${++id}`,
      verify: verifyAircraftArchive,
    });
    t.after(() => ui.dispose());
    const update = () => ui.update(session.snapshot());
    const finish = () =>
      document
        .querySelectorAll('button')
        .find((button) => button.textContent === 'Finish current archive')
        .click();
    update();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal((await store.list()).length, 0, 'prepared aircraft creates no persistent archive');
    session.arm();
    for (let tick = 0; tick < 5; tick++) {
      await session.step(neutral);
      update();
      await waitForRows(store, (rows) => rows[0]?.endTick === tick + 1);
    }
    const saved = await session.exportRecovery();
    session.pause();
    await session.restoreRecovery(saved);
    const restored = await session.readSealedSegment();
    assert.ok(restored.earliestIndex > 0);
    update();
    let rows = await waitForRows(
      store,
      (entries) =>
        entries.length === 2 &&
        entries.some((entry) => entry.origin.kind === 'checkpoint' && entry.endTick === 5),
    );
    assert.equal(rows.find((entry) => entry.origin.kind === 'fresh').state, 'interrupted');
    finish();
    rows = await waitForRows(store, (entries) =>
      entries.some((entry) => entry.origin.kind === 'checkpoint' && entry.state === 'ended'),
    );
    const restoredArchive = rows.find((entry) => entry.origin.kind === 'checkpoint');
    assert.equal(restoredArchive.startTick, restored.origin.startTick);
    assert.equal(
      (await verifyAircraftArchive(await store.exportPackage(restoredArchive.id)))
        .verificationScope,
      'checkpoint-clip',
    );
    session.arm();
    await session.step(neutral);
    assert.equal(session.snapshot().ticks, 6, 'Finishing an archive does not end practice');
    session = await createSession(1024 * 1024);
    update();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(
      (await store.list()).length,
      2,
      'switching aircraft while paused creates no archive',
    );
    session.arm();
    await session.step(neutral);
    update();
    await waitForRows(store, (entries) =>
      entries.some((entry) => entry.id === `real-${host}-3` && entry.endTick === 0),
    );
    assert.equal(
      (await session.readSealedSegment()).segment,
      null,
      'short flight has no sealed segment yet',
    );
    finish();
    await waitForRows(store, (entries) =>
      entries.some((entry) => entry.id === `real-${host}-3` && entry.state === 'ended'),
    );
    const packet = await store.exportPackage(`real-${host}-3`);
    assert.equal(packet.manifest.startTick, 0);
    assert.equal(packet.manifest.endTick, 1, 'explicit Finish captures even a one-tick flight');
    const completed = await verifyAircraftArchive(packet);
    assert.equal(completed.verificationScope, 'complete-session');
    assert.equal(completed.scored, false);
    session.arm();
    await session.step(neutral);
    assert.equal(
      session.snapshot().ticks,
      2,
      'finalizing a short archive still permits continued flight',
    );
  });
