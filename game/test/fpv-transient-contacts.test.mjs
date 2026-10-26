import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  replayAdvancedRecording,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createPresetConfiguration } from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
await initAdvancedRuntime();
for (const [backend, z, radius, beforeHash, afterHash] of [
  ['aircraft', 0.3, 0.05, '15577d94', '73e6f068'],
  ['advanced', 0.1, 0.1, '46ea9228', '7f11524f'],
]) {
  test(`${backend} retains a fast off-centre moving contact after separation without changing physical hashes`, async () => {
    const from = { x: -1, y: 2, z },
      to = { x: 1, y: 2, z };
    const options = {
      ...(backend === 'aircraft' ? createPresetConfiguration('holybro-x650-v2') : {}),
      floor: false,
      dynamicColliders: [
        { id: 'crossing', position: from, radius, height: radius * 2, shape: 'sphere' },
      ],
    };
    const sim = createAdvancedSimulation(options),
      ordinary = createAdvancedSimulation(options);
    try {
      const before = sim.snapshot();
      assert.equal(sim.stateHash(), beforeHash);
      const motions = [{ id: 'crossing', from, to }],
        proposal = sim.proposeMission({ motions });
      assert.equal(
        sim.stateHash(),
        afterHash,
        'New observations cannot change historical physical state',
      );
      assert.deepEqual(
        proposal.telemetry.contact.entries,
        [],
        'Actor has separated before the final physics substep',
      );
      assert.ok(
        Math.abs(proposal.telemetry.position.x) > 0.005,
        'The solver physically responded to the contact',
      );
      assert.equal(
        proposal.movingContacts?.length,
        1,
        'Contact from an earlier physics substep survives in the proposal',
      );
      const hit = proposal.movingContacts[0];
      assert.equal(hit.id, 'crossing');
      assert.ok(hit.normal.x > 0.5, 'Normal points from the passing actor toward the drone');
      assert.ok(Math.abs(Math.hypot(...Object.values(hit.normal)) - 1) < 0.001);
      assert.ok(
        hit.relativeNormalSpeed > 50 && hit.relativeNormalSpeed <= 110,
        'Pre-response speed includes the actor travelling at 100 m/s',
      );
      assert.ok(hit.substep >= 0 && hit.substep < proposal.telemetry.substep);
      assert.equal(
        sim.commitMission({ transaction: proposal.transaction, accepted: false }).admitted,
        false,
      );
      assert.equal(sim.stateHash(), beforeHash);
      assert.deepEqual(
        sim.snapshot(),
        before,
        'Rejected observations cannot alter any checkpoint state',
      );
      const empty = sim.proposeMission({ motions: [{ id: 'crossing', from, to: from }] });
      assert.deepEqual(
        empty.movingContacts,
        [],
        'Rejected interval contacts never leak into the next proposal',
      );
      sim.commitMission({ transaction: empty.transaction, accepted: false });
      const repeat = sim.proposeMission({ motions });
      assert.deepEqual(
        repeat.movingContacts,
        proposal.movingContacts,
        'Contact facts replay deterministically after rejection',
      );
      sim.commitMission({ transaction: repeat.transaction, accepted: true });
      ordinary.stepMission({ motions });
      assert.equal(ordinary.stateHash(), sim.stateHash());
      assert.deepEqual(
        ordinary.recording(),
        sim.recording(),
        'Proposal observations do not enter historical recordings',
      );
      const replay = await replayAdvancedRecording(sim.recording());
      if (backend === 'aircraft') assert.equal(replay.snapshot.hash, afterHash);
      else assert.deepEqual(replay.telemetry, sim.telemetry());
    } finally {
      sim.dispose();
      ordinary.dispose();
    }
  });
}

import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { encounterPhysicsCourse } from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import { WORLD_CATALOGUE } from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
import { createVerifiedFlightGeometry } from '../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';
await initWorldRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const selected = createPresetConfiguration('holybro-x650-v2');
const configuration = {
  response: selected.response,
  advanced: { aircraft: selected.aircraft, controller: selected.controller },
};
function workerHarness() {
  const h = {
    hit: {
      id: 'slot-0',
      normal: { x: 0.6, y: 0, z: 0.8 },
      relativeNormalSpeed: 12.345,
      substep: 0,
    },
    failCommit: false,
    decisions: [],
    lastProposal: null,
  };
  h.createClient = () => {
    let sim;
    return {
      async initialize(options) {
        sim = createAdvancedSimulation(options);
        return { telemetry: sim.telemetry() };
      },
      async stageTerrainFrame(frame) {
        return sim.stageTerrainFrame(frame);
      },
      async commitTerrainFrame(decision) {
        return sim.commitTerrainFrame(decision);
      },
      async propose(input, motions) {
        sim.enqueueInput(input);
        const proposal = sim.proposeMission({ motions });
        assert.deepEqual(
          proposal.telemetry.contact.entries.filter((hit) => hit.moving),
          [],
        );
        h.lastProposal = proposal;
        return { ...proposal, movingContacts: h.hit ? [structuredClone(h.hit)] : [] };
      },
      async commit(decision) {
        if (h.failCommit && decision.accepted) throw new Error('Commit interrupted');
        h.decisions.push(decision.accepted);
        return sim.commitMission(decision);
      },
      async snapshot() {
        return sim.snapshot();
      },
      async recording() {
        return sim.recording();
      },
      dispose() {
        sim?.dispose();
      },
    };
  };
  return h;
}
function actorAt(p) {
  return {
    id: 'life-0',
    slotId: 'slot-0',
    type: 'hazard',
    radius: 100,
    height: 200,
    position: { x: p.x + 4000, y: p.y + 1000, z: p.z },
    status: 'active',
    health: 100,
    maxHealth: 100,
    velocity: { x: 0, y: 0, z: 0 },
    appearance: { family: 'drone' },
  };
}
function stage(session, actor) {
  session.stageEncounterActors({
    actors: [actor],
    motions: [{ id: actor.slotId, from: actor.position, to: actor.position, enabled: true }],
  });
}

test('native aircraft bridge publishes interval contact facts only after an accepted worker commit', async () => {
  const course = encounterPhysicsCourse(WORLD_CATALOGUE.find((e) => !e.legacy).course),
    actor = actorAt(course.spawn),
    h = workerHarness();
  const session = createAircraftCourseSession(
    { course, mode: 'self-level', configuration, encounterActors: [actor] },
    { createClient: h.createClient, createMission: createWorldFlight },
  );
  try {
    await session.prepare();
    session.arm(neutral);
    assert.equal(session.snapshot().status, 'active');
    stage(session, actor);
    await session.step(neutral);
    assert.deepEqual(session.encounterMotion().contacts, [
      { actorId: 'slot-0', normal: { x: 0.6, y: 0, z: 0.8 }, relativeNormalSpeedMmS: 12345 },
    ]);
    const accepted = session.encounterMotion();
    h.failCommit = true;
    h.hit.relativeNormalSpeed = 99;
    stage(session, actor);
    await assert.rejects(session.step(neutral), /Commit interrupted/);
    assert.deepEqual(
      session.encounterMotion(),
      accepted,
      'Failed commit cannot publish speculative contacts',
    );
    assert.deepEqual(h.decisions, [true, false]);
  } finally {
    await session.dispose();
  }
});

for (const backend of ['aircraft', 'advanced'])
  test(`regional ${backend} bridge rotates interval contact normals and discards a terrain-rejected interval`, async () => {
    const fixture = await createEnduranceFixture(),
      manifest = structuredClone(fixture.terrain.manifest),
      h = workerHarness();
    manifest.spawns[0].position = { x: 64000, y: 1000, z: 30000 };
    let failCoverage = false;
    const session = createAdvancedRegionalSession(
      {
        manifest,
        source: fixture.terrain.source,
        initialHeading: 9000,
        ...(backend === 'aircraft' ? configuration : {}),
      },
      {
        createClient: h.createClient,
        createGeometry(...args) {
          const geometry = createVerifiedFlightGeometry(...args);
          return {
            ...geometry,
            motionCoverage(...query) {
              return failCoverage ? { status: 'not-ready' } : geometry.motionCoverage(...query);
            },
          };
        },
      },
    );
    try {
      await session.prepare();
      const actor = actorAt(manifest.spawns[0].position);
      await session.configureEncounterActors([actor]);
      assert.equal(session.arm(neutral), true);
      stage(session, actor);
      await session.step(neutral);
      const hit = session.encounterMotion().contacts[0];
      assert.equal(hit.relativeNormalSpeedMmS, 12345);
      assert.equal(hit.actorId, 'slot-0');
      assert.ok(Math.abs(hit.normal.x + 0.8) < 1e-10);
      assert.ok(Math.abs(hit.normal.z - 0.6) < 1e-10);
      failCoverage = true;
      stage(session, actor);
      await session.step(neutral);
      assert.equal(
        session.encounterMotion(),
        null,
        'Rejected terrain interval cannot publish a damage contact',
      );
      assert.deepEqual(h.decisions, [true, false]);
    } finally {
      await session.dispose();
    }
  });

import { observeMovingContact } from '../../optional-practice/civilian-fpv/advanced-aircraft-runtime.mjs';
test('shared observation uses pre-response angular velocity and retains only the strongest closing contact per actor', () => {
  const o = {
    contacts: new Map(),
    motions: [{ id: 'arm', from: { x: 0, y: 0, z: 0 }, to: { x: 0.02, y: 0, z: 0 } }],
    center: { x: 0, y: 0, z: 0 },
    angular: { x: 0, y: 2, z: 0 },
  };
  const normal = { x: -1, y: 0, z: 0 },
    velocity = { x: 2, y: 0, z: 0 };
  observeMovingContact(o, 'arm', normal, velocity, 2, { x: 0, y: 0, z: 3 });
  assert.equal(
    o.contacts.get('arm').relativeNormalSpeed,
    7,
    '2 m/s linear + 6 m/s angular - 1 m/s actor velocity',
  );
  observeMovingContact(o, 'arm', normal, velocity, 3);
  assert.equal(o.contacts.get('arm').relativeNormalSpeed, 7);
  assert.equal(o.contacts.get('arm').substep, 2);
  observeMovingContact(o, 'arm', normal, velocity, 4, { x: 0, y: 0, z: 4 });
  assert.equal(o.contacts.get('arm').relativeNormalSpeed, 9);
  assert.equal(o.contacts.get('arm').substep, 4);
  observeMovingContact(o, 'departing', { x: 1, y: 0, z: 0 }, velocity, 5);
  assert.equal(
    o.contacts.get('departing').relativeNormalSpeed,
    0,
    'Separating motion cannot create impact speed',
  );
});
