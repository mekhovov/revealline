import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { createVerifiedFlightGeometry } from '../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';
import { createRegionPlanner } from '../../optional-practice/civilian-fpv/regional/region-manifest.mjs';

await initAdvancedRuntime();
const terrainFixture = await createEnduranceFixture();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const command = { roll: 0.08, pitch: -0.05, yaw: 0.12, throttle: 0.4 };

async function fixture(
  t,
  {
    beforeProposal,
    beforeRestore,
    beforeTerrainStage,
    transformProposal,
    createGeometry,
    mixed = false,
    ...configuration
  } = {},
) {
  let simulation, initialOptions, client;
  const makeClient = () => {
    let ownedSimulation;
    return {
      async initialize(options) {
        initialOptions = structuredClone(options);
        ownedSimulation?.dispose();
        ownedSimulation = simulation = createAdvancedSimulation(options);
        return { telemetry: simulation.telemetry() };
      },
      async propose(sample) {
        ownedSimulation.enqueueInput(sample);
        const proposal = ownedSimulation.proposeMission();
        await beforeProposal?.();
        return transformProposal ? transformProposal(proposal) : proposal;
      },
      async commit(decision) {
        return ownedSimulation.commitMission(decision);
      },
      async stageTerrainFrame(frame) {
        const staged = ownedSimulation.stageTerrainFrame(frame);
        await beforeTerrainStage?.();
        return staged;
      },
      async commitTerrainFrame(decision) {
        return ownedSimulation.commitTerrainFrame(decision);
      },
      async snapshot() {
        return ownedSimulation.snapshot();
      },
      async restore(saved) {
        const result = ownedSimulation.restore(saved);
        await beforeRestore?.();
        return result;
      },
      async recording() {
        return ownedSimulation.recording();
      },
      dispose() {
        ownedSimulation?.dispose();
      },
    };
  };
  const session = createAdvancedRegionalSession(
    {
      manifest: terrainFixture.terrain.manifest,
      source: terrainFixture.terrain.source,
      ...(mixed
        ? {
            geometryProfile: 'terrain-scenery-v1',
            scenery: {
              ...terrainFixture.scenery,
              manifest: {
                ...terrainFixture.scenery.manifest,
                spawns: configuration.manifest?.spawns ?? terrainFixture.scenery.manifest.spawns,
              },
            },
          }
        : {}),
      rateProfile: createRateProfile(),
      ...configuration,
    },
    {
      createClient: () => {
        client = makeClient();
        return client;
      },
      ...(createGeometry ? { createGeometry } : {}),
    },
  );
  t.after(() => session.dispose());
  await session.prepare();
  return { session, client, options: () => initialOptions, simulation: () => simulation };
}

test('Regional Advanced uses verified terrain and frozen portable rates while presenting an unscored 50 Hz flight', async (t) => {
  const profile = createRateProfile();
  const h = await fixture(t, { rateProfile: profile, initialHeading: 9000 });
  assert.equal(h.session.snapshot().reason, 'prepared');
  assert.equal(h.session.snapshot().advanced, true);
  assert.equal(h.session.snapshot().unscored, true);
  assert.equal(h.session.snapshot().mode, 'acro');
  assert.equal(h.session.snapshot().position.y, 11780);
  assert.equal(h.session.snapshot().attitude.yaw, 9000);
  assert.equal(h.session.arm({ ...neutral, throttle: 0.2 }), false);
  assert.equal(h.session.arm({ ...neutral, throttle: NaN }), false);
  assert.equal(h.session.arm({ ...neutral, yaw: Infinity }), false);
  assert.equal(h.session.arm({ ...neutral, throttle: -0.1 }), false);
  assert.equal(h.session.arm(), true);
  profile.axes.roll.rate = 100;
  for (let tick = 0; tick < 10; tick++) await h.session.step(command);
  const state = h.session.snapshot(),
    recording = await h.session.recording();
  assert.equal(state.ticks, 10);
  assert.equal(state.advancedTelemetry.frequency, 250);
  assert.equal(recording.scored, false);
  assert.equal(recording.missionTicks, 10);
  assert.equal(h.options().rateProfile.axes.roll.rate, 67);
  assert.equal(h.options().floor, false, 'No invented floor replaces regional terrain');
  assert.equal(
    recording.config.configuration.environment.terrain,
    h.options().configuration.environment.terrain,
  );
});

test('verified terrain and scenery resolve landings without pausing, and grounded recovery replays exactly', async (t) => {
  for (const mixed of [false, true]) {
    const manifest = structuredClone(terrainFixture.terrain.manifest);
    manifest.spawns[0].position.z = 64000; // Above the verified scenery roof when enabled.
    if (!mixed) manifest.grid.floorMm = 0; // A valid terrain surface may coincide with the region floor.
    let minimumCentreY = Infinity;
    const h = await fixture(t, {
      mixed,
      manifest,
      initialHeading: 9000,
      transformProposal(proposal) {
        minimumCentreY = Math.min(
          minimumCentreY,
          ...proposal.trace.map((point) => point.y * 1000 + manifest.spawns[0].position.y),
        );
        return proposal;
      },
    });
    assert.equal(h.session.arm(), true);
    for (let tick = 0; tick < 160; tick++) await h.session.step(neutral);
    const landed = h.session.snapshot();
    assert.equal(
      landed.status,
      'active',
      JSON.stringify({ reason: landed.reason, ticks: landed.ticks, minimumCentreY }),
    );
    assert.equal(landed.ticks, 160);
    assert.equal(landed.reason, null);
    assert.ok(landed.grounded);
    assert.ok(landed.contacts > 0);
    const centreY = landed.position.y + 220;
    assert.ok(
      Math.abs(centreY - (mixed ? 8000 : 0) - h.options().aircraft.radius * 1000) < 20,
      `Real mesh contact height: ${centreY}`,
    );
    h.session.pause();
    const saved = await h.session.captureRecovery();
    const expected = await h.session.recording();
    const replay = await replayAdvancedRecording(expected);
    assert.equal(replay.verified, true);
    await h.session.restoreRecovery(saved);
    assert.deepEqual(await h.session.recording(), expected);
    assert.equal(h.session.arm(), true);
    for (let tick = 0; tick < 50; tick++) await h.session.step({ ...neutral, throttle: 0.9 });
    assert.equal(h.session.snapshot().status, 'active');
    assert.ok(
      h.session.snapshot().position.y > landed.position.y + 1000,
      'Can take off after contact',
    );
  }
});

test('the verified scenery wall resolves lateral impacts while the flight remains active', async (t) => {
  const manifest = structuredClone(terrainFixture.terrain.manifest);
  manifest.spawns[0].position = { x: 99000, y: 10000, z: 20000 };
  const h = await fixture(t, { mixed: true, manifest });
  assert.equal(h.session.arm(), true);
  let contacts = 0;
  for (let tick = 0; tick < 125; tick++) {
    const state = await h.session.step({ ...neutral, throttle: 0.5, roll: tick < 25 ? 0.2 : 0 });
    assert.equal(state.status, 'active');
    assert.ok(
      state.position.x < 100000 - h.options().aircraft.radius * 1000 + 2,
      'No tunnelling through the real wall',
    );
    contacts = Math.max(contacts, state.contacts);
  }
  assert.ok(contacts > 0, 'Actual wall contact was reported');
});

test('unknown cells and region boundaries reject the whole trace before they become clear space', async (t) => {
  for (const [x, expected] of [
    [300, 'terrain-required'],
    [1000, 'region-edge'],
  ]) {
    const h = await fixture(t, {
      transformProposal: (proposal) => ({
        ...proposal,
        trace: [proposal.trace[0], { x, y: 2, z: 0 }, proposal.trace.at(-1)],
      }),
    });
    const before = await h.session.recording();
    h.session.arm();
    const state = await h.session.step(command);
    assert.equal(state.reason, expected);
    assert.equal(state.ticks, 0);
    assert.equal((await h.session.recording()).finalHash, before.finalHash);
    assert.equal(state.pendingTargetMm !== null, expected === 'terrain-required');
  }
});

test('pause while worker proposal is in flight rolls it back and never rearms on its late result', async (t) => {
  let release, proposed;
  const ready = new Promise((resolve) => {
    proposed = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const h = await fixture(t, {
    beforeProposal: () => {
      proposed();
      return gate;
    },
  });
  h.session.arm();
  const stepping = h.session.step(command);
  assert.equal(h.session.stepPending(), true);
  assert.equal(
    h.session.step(command),
    stepping,
    'No second worker transaction queues behind the first',
  );
  await ready;
  h.session.pause();
  assert.equal(h.session.arm(), false);
  release();
  await stepping;
  assert.equal(h.session.snapshot().ticks, 0);
  assert.equal(h.session.snapshot().reason, 'prepared');
  assert.equal(h.session.snapshot().status, 'paused');
  assert.equal((await h.session.recording()).inputs.length, 0);
});

test('paused recovery preserves the entire worker state and verifies region/start before restoring', async (t) => {
  const h = await fixture(t);
  h.session.arm();
  for (let index = 0; index < 10; index++) await h.session.step(command);
  await assert.rejects(h.session.captureRecovery(), /Pause/);
  h.session.pause();
  const saved = await h.session.captureRecovery();
  const expected = await h.session.recording();
  assert.equal(h.session.arm(), true);
  for (let index = 0; index < 10; index++) await h.session.step(command);
  await h.session.restoreRecovery(saved);
  assert.equal(h.session.snapshot().ticks, 10);
  assert.equal(h.session.snapshot().reason, 'prepared');
  assert.equal(h.session.snapshot().status, 'paused');
  assert.deepEqual(await h.session.recording(), expected);
  const wrong = structuredClone(saved);
  wrong.environment.terrain = 'another-revision';
  await assert.rejects(h.session.restoreRecovery(wrong), /another region/);
  assert.deepEqual(await h.session.recording(), expected);
  assert.equal(h.session.arm(), true);
  await h.session.step(command);
  assert.equal(h.session.snapshot().ticks, 11);
});

test('a failed worker leaves a paused explicit unavailable state, without advancing presentation', async (t) => {
  const h = await fixture(t);
  h.session.arm();
  h.client.propose = async () => {
    throw new Error('Worker interrupted');
  };
  await assert.rejects(h.session.step(command), /interrupted/);
  assert.equal(h.session.snapshot().reason, 'worker-error');
  assert.equal(h.session.snapshot().status, 'paused');
  assert.equal(h.session.snapshot().ticks, 0);
  assert.equal(h.session.arm(), false);
});

test('streamed terrain adoption waits for the whole in-flight mission and reads the newly committed pose', async (t) => {
  let releaseFrame, releaseProposal, secondProposal, backgroundPreparing;
  const frameGate = new Promise((resolve) => {
    releaseFrame = resolve;
  });
  const proposalGate = new Promise((resolve) => {
    releaseProposal = resolve;
  });
  const secondReady = new Promise((resolve) => {
    secondProposal = resolve;
  });
  const frameReady = new Promise((resolve) => {
    backgroundPreparing = resolve;
  });
  const commits = [],
    poses = [];
  let preparations = 0,
    proposals = 0;
  const manifest = terrainFixture.terrain.manifest;
  const expectedOrigin = createRegionPlanner(manifest)(manifest.spawns[0].position).origin;
  let origin = { ...expectedOrigin, x: expectedOrigin.x + 1 };
  const h = await fixture(t, {
    beforeProposal() {
      if (++proposals === 2) {
        secondProposal();
        return proposalGate;
      }
    },
    async prepareFrame() {
      if (++preparations === 2) {
        backgroundPreparing();
        await frameGate;
      }
    },
    createGeometry: () => ({
      snapshot: () => ({ terrainReady: true, provenance: { originMm: origin, chunks: [] } }),
      castMotion: () => ({ status: 'motion-clear' }),
      async transition(_target, _support, transaction) {
        const group = new THREE.Group();
        await transaction.prepare({
          group,
          collisionFrame: () => ({
            originMm: origin,
            sourceIdentity: '0000000000000000',
            colliders: [
              {
                id: 'terrain:test',
                translation: { x: 0, y: 0, z: 0 },
                vertices: [-100, -10, -100, 100, -10, -100, -100, -10, 100, 100, -10, 100],
                indices: [0, 2, 1, 1, 2, 3],
              },
            ],
          }),
        });
        poses.push(transaction.readPose());
        transaction.commit({
          group,
          provenance: { originMm: commits.length ? expectedOrigin : origin },
        });
        origin = commits.length ? expectedOrigin : origin;
        commits.push(true);
      },
      cancel() {},
      async dispose() {},
    }),
  });
  h.session.arm();
  await h.session.step(command);
  await frameReady;
  const pending = h.session.step(command);
  await secondReady;
  releaseFrame();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    commits.length,
    1,
    'Terrain cannot replace the admitted source window during a mission',
  );
  releaseProposal();
  await pending;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(commits.length, 2);
  assert.equal(h.session.snapshot().ticks, 2);
  assert.equal(poses.at(-1).positionMm.x, h.session.snapshot().position.x);
  assert.deepEqual(h.session.snapshot().originMm, expectedOrigin);
});

test('cancelled detached recovery cannot overwrite the newer live session or its recording', async (t) => {
  let release, restoring;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    restoring = resolve;
  });
  const h = await fixture(t, {
    beforeRestore: () => {
      restoring();
      return gate;
    },
  });
  h.session.arm();
  await h.session.step(command);
  h.session.pause();
  const saved = await h.session.captureRecovery();
  h.session.arm();
  await h.session.step(command);
  h.session.pause();
  const newer = await h.session.recording();
  const pending = h.session.restoreRecovery(saved);
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  await started;
  h.session.pause();
  assert.equal(h.session.arm(), false);
  release();
  await rejection;
  assert.equal(h.session.snapshot().ticks, 2);
  assert.deepEqual(await h.session.recording(), newer);
  assert.equal(h.session.arm(), true);
  await h.session.step(command);
  assert.equal(h.session.snapshot().ticks, 3);
});

test('verified collider export is detached from mutable renderer geometry and preserves all collision layers', async (t) => {
  const owner = createVerifiedFlightGeometry(terrainFixture.terrain.manifest, {
    profile: 'terrain-scenery-v1',
    source: terrainFixture.terrain.source,
    scenery: terrainFixture.scenery,
  });
  t.after(() => owner.dispose());
  const point = terrainFixture.terrain.manifest.spawns[0].position;
  let prepared;
  await owner.transition(point, null, {
    async prepare({ group, collisionFrame }) {
      prepared = collisionFrame();
      group.traverse((object) => {
        if (object.geometry?.attributes?.position)
          object.geometry.attributes.position.array.fill(999);
      });
    },
    commit() {},
    rollback() {},
  });
  const exported = owner.collisionFrame();
  assert.deepEqual(
    exported,
    prepared,
    'Physics uses privately verified sources, not renderer arrays',
  );
  assert.ok(exported.colliders.some((collider) => collider.id.startsWith('terrain:')));
  assert.ok(exported.colliders.some((collider) => collider.id.startsWith('scenery:')));
  exported.colliders[0].vertices.fill(0);
  assert.deepEqual(
    owner.collisionFrame(),
    prepared,
    'Export mutation cannot modify the source owner',
  );
});

test('a rejected visible-frame adoption restores the staged worker collision frame and recording', async (t) => {
  let reject = false;
  const h = await fixture(t, {
    prepareFrame(group) {
      if (reject)
        group.addEventListener('added', () => {
          throw new Error('Renderer rejected candidate');
        });
    },
  });
  h.session.arm();
  await h.session.step(command);
  h.session.pause();
  const before = await h.session.recording();
  const origin = h.session.snapshot().originMm;
  reject = true;
  await assert.rejects(h.session.prepare(), /Renderer rejected/);
  assert.equal(h.session.snapshot().status, 'paused');
  assert.deepEqual(h.session.snapshot().originMm, origin);
  assert.deepEqual(await h.session.recording(), before);
  reject = false;
  await h.session.prepare();
  assert.equal(h.session.arm(), true);
});

test('cancellation while the worker stages terrain rejects the complete candidate before another prepare', async (t) => {
  let release,
    staged,
    count = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const ready = new Promise((resolve) => {
    staged = resolve;
  });
  const h = await fixture(t, {
    async beforeTerrainStage() {
      if (++count === 2) {
        staged();
        await gate;
      }
    },
  });
  h.session.arm();
  await h.session.step(command);
  h.session.pause();
  const before = await h.session.recording();
  const pending = h.session.prepare();
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await ready;
  h.session.cancelPreparation();
  const newer = h.session.prepare();
  assert.equal(h.session.arm(), false);
  release();
  await rejected;
  await newer;
  assert.deepEqual(await h.session.recording(), before);
  assert.equal(h.session.arm(), true);
});

test('worker failure after source adoption leaves the session paused and unavailable until restart', async (t) => {
  const h = await fixture(t);
  h.session.arm();
  await h.session.step(command);
  h.session.pause();
  const before = h.session.snapshot();
  h.client.commitTerrainFrame = async () => {
    throw new Error('Worker lost terrain commit');
  };
  await assert.rejects(h.session.prepare(), /Worker lost terrain commit/);
  const failed = h.session.snapshot();
  assert.equal(failed.status, 'paused');
  assert.equal(failed.reason, 'worker-error');
  assert.equal(failed.ticks, before.ticks);
  assert.equal(h.session.arm(), false);
  await h.session.step(command);
  assert.equal(h.session.snapshot().ticks, before.ticks);
});
