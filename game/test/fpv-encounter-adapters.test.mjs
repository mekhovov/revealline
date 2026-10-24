import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
  validateAdvancedPracticeRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import { createEncounterSession } from '../../optional-practice/civilian-fpv/encounter-session.mjs';
import {
  createEncounterDefinition,
  createEncounterRuntime,
  createNativeEncounterGeometry,
  encounterPhysicsCourse,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import { createWorldFlight } from '../../optional-practice/civilian-fpv/world-model.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
import { createVerifiedFlightGeometry } from '../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';

await initAdvancedRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
const fixture = await createEnduranceFixture();
function configuration() {
  const row = createPresetConfiguration(listAircraftPresets()[0].id);
  return {
    response: row.response,
    camera: row.camera,
    advanced: { aircraft: row.aircraft, controller: row.controller },
  };
}
function clients() {
  const motions = [],
    decisions = [];
  const controls = {
    motions,
    decisions,
    beforeProposal: null,
    simulations: [],
    practiceRestores: [],
  };
  const createClient = () => {
    let simulation;
    return {
      async initialize(options) {
        simulation = createAdvancedSimulation(options);
        controls.simulations.push(simulation);
        return { telemetry: simulation.telemetry() };
      },
      async stageTerrainFrame(frame) {
        return simulation.stageTerrainFrame(frame);
      },
      async commitTerrainFrame(value) {
        return simulation.commitTerrainFrame(value);
      },
      async propose(sample, values) {
        motions.push(structuredClone(values));
        simulation.enqueueInput(sample);
        const proposed = simulation.proposeMission({ motions: values });
        await controls.beforeProposal?.();
        return proposed;
      },
      async commit(value) {
        decisions.push(value.accepted);
        return simulation.commitMission(value);
      },
      async step(sample, values) {
        simulation.enqueueInput(sample);
        return simulation.stepMission({ motions: values });
      },
      async telemetry() {
        return simulation.telemetry();
      },
      async snapshot() {
        return simulation.snapshot();
      },
      async restore(value) {
        const verified = await verifyAdvancedRecovery(value);
        return simulation.restore(verified);
      },
      async restorePractice(value) {
        controls.practiceRestores.push(value.identity);
        const checked = await validateAdvancedPracticeRecovery(value, {
          expectedIdentity: simulation.identity,
        });
        return simulation.restore(checked);
      },
      async recording() {
        return simulation.recording();
      },
      dispose() {
        simulation?.dispose();
      },
    };
  };
  return {
    ...controls,
    createClient,
    get beforeProposal() {
      return controls.beforeProposal;
    },
    set beforeProposal(value) {
      controls.beforeProposal = value;
    },
  };
}

test('Regional reference imports a rolled unscored encounter checkpoint and re-admits its exact terrain window', async () => {
  const client = clients();
  const base = createAdvancedRegionalSession(
    { manifest: fixture.terrain.manifest, source: fixture.terrain.source },
    { createClient: client.createClient },
  );
  try {
    await base.prepare();
    const spawn = fixture.terrain.manifest.spawns[0].position;
    await base.configureEncounterActors([
      {
        id: 'target-life',
        slotId: 'encounter-slot-01',
        type: 'drone',
        position: { ...spawn, x: spawn.x + 5000 },
        radius: 450,
        height: 900,
        status: 'active',
      },
    ]);
    const simulation = client.simulations.at(-1);
    for (let tick = 0; tick < 36000; tick++) simulation.stepMission();
    assert.equal(base.arm(), true);
    await base.step(neutral);
    base.pause();
    const saved = await base.captureRecovery();
    assert.equal(saved.simulation.recording.retention.complete, false);
    assert.ok(saved.terrainOriginMm);
    await assert.rejects(() => verifyAdvancedRecovery(saved.simulation), /local-practice/);
    const changedWindow = structuredClone(saved);
    changedWindow.terrainOriginMm.x += fixture.terrain.manifest.grid.cellSizeMm;
    const before = base.snapshot();
    await assert.rejects(() => base.restoreRecovery(changedWindow), /terrain window changed/);
    assert.equal(base.snapshot().ticks, before.ticks);
    assert.deepEqual(base.snapshot().position, before.position);
    assert.deepEqual(base.snapshot().originMm, before.originMm);
    await base.restoreRecovery(saved);
    assert.equal(client.practiceRestores.length, 2);
    assert.equal(base.snapshot().ticks, 36001);
    assert.equal(base.snapshot().recordingStatus.localPractice, true);
    assert.equal(base.snapshot().status, 'paused');
    assert.equal(
      base.arm(),
      true,
      'continuous encounter has no historical duration stop after recovery',
    );
    await base.step(neutral);
    assert.equal(base.snapshot().ticks, 36002);
  } finally {
    await base.dispose();
  }
});

test('aircraft encounter wrapper advances accepted substeps and restores paired gameplay/physics recovery', async () => {
  const original = FLIGHT_COURSES[0],
    geometry = createNativeEncounterGeometry(original);
  const definition = createEncounterDefinition({
    course: original,
    population: 6,
    activity: 'hunting',
    admitActor: geometry.admitActor,
  });
  const runtime = createEncounterRuntime(definition, { geometry }),
    client = clients();
  const base = createAircraftCourseSession(
    {
      course: encounterPhysicsCourse(original),
      mode: 'acro',
      configuration: configuration(),
      encounterActors: runtime.snapshot().actors,
    },
    { createClient: client.createClient, createMission: createWorldFlight },
  );
  const session = await createEncounterSession(base, { definition, geometry, runtime });
  try {
    await session.prepare();
    session.arm();
    for (let tick = 0; tick < 55; tick++) await session.step({ ...neutral, actions: 1 });
    assert.equal(session.snapshot().ticks, 55);
    assert.equal(session.snapshot().encounter.ticks, 55);
    assert.equal(client.decisions.filter(Boolean).length, 55);
    const trace = base.encounterMotion().trace;
    assert.equal(trace.length, session.snapshot().advancedTelemetry.frequency / 50 + 1);
    assert.ok(trace.every((row) => Object.values(row.position).every(Number.isSafeInteger)));
    const saved = await session.exportCombatRecovery();
    session.arm();
    await session.step(neutral);
    await session.restoreCombatRecovery(saved);
    assert.equal(session.snapshot().ticks, 55);
    assert.equal(session.snapshot().encounter.ticks, 55);
    assert.equal(session.snapshot().status, 'paused');
    session.arm();
    await session.step(neutral);
    assert.equal(session.snapshot().ticks, 56);
  } finally {
    await session.dispose();
  }
});

function proposal(actor, from, to, enabled = true) {
  const next = {
    ...structuredClone(actor),
    position: structuredClone(to),
    status: enabled ? 'active' : 'defeated',
  };
  return {
    transaction: 1,
    actors: [next],
    motions: [{ id: actor.slotId, actorId: actor.id, from, to, enabled }],
  };
}

for (const advanced of [false, true])
  test(`native ${advanced ? 'Advanced' : 'Standard'} reserved combat slots recover without course caught state`, async () => {
    const course = encounterPhysicsCourse(FLIGHT_COURSES[0]);
    const actors = ['active', 'waiting', 'inactive'].map((status, index) => ({
      id: `life-${index}`,
      slotId: `encounter-slot-${index}`,
      type: 'drone',
      position: { ...course.spawn, x: course.spawn.x + 5000 + index * 2000 },
      radius: 450,
      height: 900,
      health: 50,
      maxHealth: 50,
      status,
    }));
    const client = clients();
    const base = advanced
      ? createAircraftCourseSession(
          { course, mode: 'acro', configuration: configuration(), encounterActors: actors },
          { createClient: client.createClient, createMission: createWorldFlight },
        )
      : createWorldFlight({ course, encounterPhysicsOnly: true, unscoredPractice: true });
    try {
      await base.prepare?.();
      if (!advanced) base.configureEncounterActors(actors);
      base.arm();
      base.stageEncounterActors({
        actors,
        motions: actors.map((actor) => ({
          id: actor.slotId,
          actorId: actor.id,
          from: actor.position,
          to: actor.position,
          enabled: actor.status === 'active',
        })),
      });
      await base.step(neutral);
      base.pause();
      const saved = await base.encounterCheckpoint();
      const rows = advanced ? saved.mission.state.actors : saved.state.actors;
      assert.deepEqual(
        rows.map((actor) => [actor.status, actor.health]),
        [
          ['active', 50],
          ['defeated', 0],
          ['defeated', 0],
        ],
      );
      await base.restoreEncounterCheckpoint(saved);
      assert.equal(base.snapshot().ticks, 1);
      // Migration requires the authoritative saved encounter state and belongs
      // to the session. The adapter alone must reject course-only catch state.
      for (const actor of rows.slice(1)) Object.assign(actor, { health: 50, status: 'caught' });
      if (advanced) {
        const { checksum: _checksum, ...packet } = saved;
        saved.checksum = dataIdentity(packet);
      }
      if (advanced)
        await assert.rejects(
          () => base.restoreEncounterCheckpoint(saved),
          /Unexpected caught actor/,
        );
      else assert.throws(() => base.restoreEncounterCheckpoint(saved), /Unexpected caught actor/);
      assert.equal(base.snapshot().ticks, 1);
      if (advanced)
        assert.deepEqual(
          base.snapshot().advancedTelemetry.dynamicColliders.map((actor) => actor.enabled),
          [true, false, false],
        );
    } finally {
      await base.dispose();
    }
  });

test('ordinary course checkpoints still reject caught actors outside contact hunting', () => {
  const source = encounterPhysicsCourse(FLIGHT_COURSES[0]);
  source.actors = [
    {
      id: 'ordinary-drone',
      type: 'drone',
      position: { ...source.spawn, x: source.spawn.x + 5000 },
      radius: 450,
      height: 900,
      health: 50,
      path: [],
      speed: 0,
      fireEveryTicks: 0,
    },
  ];
  const base = createWorldFlight({
    course: source,
    unscoredPractice: true,
    physicalPractice: true,
    physicalRadius: 220,
  });
  try {
    const saved = base.physicalCheckpoint();
    saved.state.actors[0].status = 'caught';
    assert.throws(() => base.validatePhysicalCheckpoint(saved), /Unexpected caught actor/);
  } finally {
    base.dispose();
  }
});

test('aircraft encounter pool relocates replacements disabled before activating at the accepted spawn', async () => {
  const original = FLIGHT_COURSES[0],
    geometry = createNativeEncounterGeometry(original);
  const definition = createEncounterDefinition({
    course: original,
    population: 6,
    admitActor: geometry.admitActor,
  });
  definition.actors = definition.actors.slice(0, 1);
  const runtime = createEncounterRuntime(definition, { geometry }),
    actor = runtime.snapshot().actors[0],
    client = clients();
  const base = createAircraftCourseSession(
    {
      course: encounterPhysicsCourse(original),
      mode: 'acro',
      configuration: configuration(),
      encounterActors: [actor],
    },
    { createClient: client.createClient, createMission: createWorldFlight },
  );
  try {
    await base.prepare();
    base.arm();
    const initial = structuredClone(actor.position),
      away = { ...initial, x: initial.x + 1000 };
    base.stageEncounterActors(proposal(actor, initial, away));
    await base.step(neutral);
    base.stageEncounterActors(proposal(actor, initial, initial));
    await base.step(neutral);
    assert.equal(client.motions.at(-1)[0].enabled, false);
    assert.ok(Math.abs(client.motions.at(-1)[0].from.x - away.x / 1000) < 0.001);
    assert.equal(base.snapshot().advancedTelemetry.dynamicColliders[0].enabled, false);
    base.stageEncounterActors(proposal(actor, initial, initial));
    await base.step(neutral);
    assert.equal(client.motions.at(-1)[0].enabled, true);
    assert.equal(base.snapshot().advancedTelemetry.dynamicColliders[0].enabled, true);
  } finally {
    await base.dispose();
    geometry.dispose();
  }
});

for (const aircraft of [false, true])
  test(`Regional ${aircraft ? 'aircraft' : 'reference'} combat pool relocates safely and exposes accepted integer traces`, async () => {
    const client = clients();
    const base = createAdvancedRegionalSession(
      {
        manifest: fixture.terrain.manifest,
        source: fixture.terrain.source,
        ...(aircraft ? configuration() : {}),
      },
      { createClient: client.createClient },
    );
    try {
      await base.prepare();
      const spawn = fixture.terrain.manifest.spawns[0].position;
      const initial = { x: spawn.x + 5000, y: spawn.y + 2000, z: spawn.z };
      const actor = {
        id: 'first-life',
        slotId: 'encounter-slot-01',
        type: 'drone',
        position: initial,
        radius: 450,
        height: 900,
        status: 'active',
      };
      await base.configureEncounterActors([actor]);
      base.arm();
      const away = { ...initial, x: initial.x + 1000 };
      base.stageEncounterActors(proposal(actor, initial, away));
      await base.step(neutral);
      assert.equal(base.snapshot().ticks, 1);
      assert.equal(
        base.encounterMotion().trace.length,
        base.snapshot().advancedTelemetry.frequency / 50 + 1,
      );
      assert.ok(
        base
          .encounterMotion()
          .trace.every((row) => Object.values(row.position).every(Number.isSafeInteger)),
      );
      client.beforeProposal = () => {
        client.beforeProposal = null;
        base.pause();
      };
      base.stageEncounterActors(proposal(actor, initial, initial));
      await base.step(neutral);
      assert.equal(base.snapshot().ticks, 1);
      assert.equal(client.decisions.at(-1), false);
      assert.equal(base.snapshot().advancedTelemetry.dynamicColliders[0].enabled, true);
      base.arm();
      base.stageEncounterActors(proposal(actor, initial, initial));
      await base.step(neutral);
      assert.equal(client.motions.at(-1)[0].enabled, false);
      base.stageEncounterActors(proposal(actor, initial, initial));
      await base.step(neutral);
      assert.equal(client.motions.at(-1)[0].enabled, true);
      base.pause();
      const saved = await base.encounterCheckpoint();
      base.arm();
      base.stageEncounterActors(proposal(actor, initial, initial));
      await base.step(neutral);
      base.pause();
      await base.restoreEncounterCheckpoint(saved);
      assert.equal(base.snapshot().ticks, 3);
      assert.equal(base.snapshot().status, 'paused');
      assert.ok(base.identity.configuration);
    } finally {
      await base.dispose();
    }
  });

for (const aircraft of [false, true])
  test(`Regional ${aircraft ? 'aircraft' : 'reference'} wrapper cancels rejected intervals and restores paired recovery`, async () => {
    const client = clients();
    let rejectCoverage = false;
    const base = createAdvancedRegionalSession(
      {
        manifest: fixture.terrain.manifest,
        source: fixture.terrain.source,
        ...(aircraft ? configuration() : {}),
      },
      {
        createClient: client.createClient,
        createGeometry(...args) {
          const owner = createVerifiedFlightGeometry(...args);
          return {
            ...owner,
            motionCoverage(...query) {
              return rejectCoverage ? { status: 'unknown-cell' } : owner.motionCoverage(...query);
            },
          };
        },
      },
    );
    const grid = fixture.terrain.manifest.grid,
      spawn = fixture.terrain.manifest.spawns[0].position;
    const definition = {
      format: 'FPVEncounterDefinition.v1',
      revision: 'r1',
      baseIdentity: 'regional-test:r1',
      activity: 'hunting',
      difficulty: 'normal',
      population: 6,
      seed: 1,
      bounds: {
        min: { x: grid.minX * grid.cellSizeMm, y: grid.floorMm, z: grid.minZ * grid.cellSizeMm },
        max: {
          x: (grid.minX + grid.width) * grid.cellSizeMm,
          y: grid.ceilingMm,
          z: (grid.minZ + grid.depth) * grid.cellSizeMm,
        },
      },
      spawn,
      actors: [
        {
          id: 'drone-source',
          type: 'drone',
          role: 'rival',
          position: { x: spawn.x + 5000, y: spawn.y + 2000, z: spawn.z },
          path: [],
          speed: 0,
          radius: 450,
          height: 900,
          health: 100,
          fireEveryTicks: 0,
          damage: 0,
          projectileSpeed: 8000,
          range: 20000,
          family: 'lookout',
          material: 'electronic',
          appearance: { family: 'lookout', cast: 'authored' },
          destructible: true,
        },
      ],
    };
    const geometry = { sweepStatic: () => null, visible: () => true, dispose() {} };
    let session;
    try {
      await base.prepare();
      session = await createEncounterSession(base, { definition, geometry, regional: true });
      session.arm();
      for (let tick = 0; tick < 5; tick++) await session.step(neutral);
      const accepted = session.snapshot();
      rejectCoverage = true;
      await session.step({ ...neutral, actions: 1 });
      assert.equal(session.snapshot().ticks, accepted.ticks);
      assert.deepEqual(session.snapshot().encounter, accepted.encounter);
      assert.equal(client.decisions.at(-1), false);
      rejectCoverage = false;
      await session.prepare();
      session.arm();
      await session.step(neutral);
      const saved = await session.exportCombatRecovery();
      session.arm();
      await session.step(neutral);
      await session.restoreCombatRecovery(saved);
      assert.equal(session.snapshot().ticks, 6);
      assert.equal(session.snapshot().encounter.ticks, 6);
      assert.equal(session.snapshot().status, 'paused');
    } finally {
      await (session ?? base).dispose();
    }
  });

for (const kind of ['native', 'regional-reference', 'regional-aircraft'])
  test(`v2 ${kind} keeps 128 admitted slots and collider generation during recovery`, async () => {
    const client = clients(),
      regional = kind !== 'native';
    const initial = regional
      ? fixture.terrain.manifest.spawns[0].position
      : FLIGHT_COURSES[0].spawn;
    const actors = Array.from({ length: 128 }, (_, i) => ({
      id: `life-${i}`,
      spawnId: `life-${i}`,
      slotId: `encounter-slot-${i}`,
      type: 'drone',
      position: {
        ...initial,
        x: initial.x + 5000 + (i % 16) * 1200,
        z: initial.z + Math.floor(i / 16) * 1200,
        y: initial.y + 2000,
      },
      radius: 450,
      height: 900,
      health: 100,
      maxHealth: 100,
      status: 'active',
      appearance: { archetype: 'military-uav' },
    }));
    const base = regional
      ? createAdvancedRegionalSession(
          {
            manifest: fixture.terrain.manifest,
            source: fixture.terrain.source,
            ...(kind === 'regional-aircraft' ? configuration() : {}),
          },
          { createClient: client.createClient },
        )
      : createAircraftCourseSession(
          {
            course: encounterPhysicsCourse(FLIGHT_COURSES[0]),
            mode: 'acro',
            configuration: configuration(),
            encounterActors: actors,
          },
          { createClient: client.createClient, createMission: createWorldFlight },
        );
    const staged = (life) => ({
      actors: actors.map((a, i) => ({
        ...a,
        spawnId: `${life}-${i}`,
        health: i === 127 ? 400 : 100,
        maxHealth: i === 127 ? 400 : 100,
      })),
      motions: actors.map((a) => ({
        id: a.slotId,
        actorId: a.id,
        from: a.position,
        to: a.position,
        enabled: true,
      })),
    });
    try {
      await base.prepare();
      if (regional) await base.configureEncounterActors(actors);
      base.arm();
      base.stageEncounterActors(staged('next'));
      await base.step(neutral);
      assert.equal(client.motions.at(-1).length, 128);
      assert.equal(client.motions.at(-1)[127].shapeDescriptor.spawnId, 'next-127');
      assert.equal(client.motions.at(-1)[127].enabled, false);
      base.stageEncounterActors(staged('next'));
      await base.step(neutral);
      assert.equal(client.motions.at(-1)[127].enabled, true);
      base.pause();
      const saved = await base.encounterCheckpoint();
      base.arm();
      base.stageEncounterActors(staged('third'));
      await base.step(neutral);
      base.pause();
      await base.restoreEncounterCheckpoint(saved);
      assert.equal(base.snapshot().advancedTelemetry.dynamicColliders.length, 128);
      assert.equal(base.snapshot().advancedTelemetry.dynamicColliders[127].spawnId, 'next-127');
      assert.equal(base.snapshot().ticks, 2);
    } finally {
      await base.dispose();
    }
  });
