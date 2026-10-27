import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import {
  createEncounterSession,
  replayEncounterSession,
} from '../../optional-practice/civilian-fpv/encounter-session.mjs';
import {
  createEncounterDefinition,
  createEncounterRuntime,
  createNativeEncounterGeometry,
  encounterPhysicsCourse,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import { createRegionalEncounterGeometry } from '../../optional-practice/civilian-fpv/encounter-geometry.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { createAircraftCourseSession } from '../../optional-practice/civilian-fpv/aircraft-course-session.mjs';
import { createAdvancedRegionalSession } from '../../optional-practice/civilian-fpv/advanced-regional.mjs';
import {
  createRegionalSession,
  regionalReviewEntry,
} from '../../optional-practice/civilian-fpv/regional-session.mjs';
import {
  createAdvancedSimulation,
  initAdvancedRuntime,
  verifyAdvancedRecovery,
  validateAdvancedPracticeRecovery,
} from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  createPresetConfiguration,
  listAircraftPresets,
} from '../../optional-practice/civilian-fpv/aircraft-presets.mjs';
import { createEnduranceFixture } from '../../authoring/fpv-worlds/regions/endurance-fixture.mjs';
import { createVerifiedFlightGeometry } from '../../optional-practice/civilian-fpv/regional/verified-flight-geometry.mjs';
await initAdvancedRuntime();
await initWorldRuntime();
const fixture = await createEnduranceFixture(),
  preset = createPresetConfiguration(listAircraftPresets()[0].id);
const configuration = {
  response: preset.response,
  camera: preset.camera,
  advanced: { aircraft: preset.aircraft, controller: preset.controller },
};
const controls = { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 };
function worker(hooks) {
  let simulation;
  return {
    async initialize(options) {
      simulation = createAdvancedSimulation(options);
      return { telemetry: simulation.telemetry() };
    },
    async stageTerrainFrame(value) {
      return simulation.stageTerrainFrame(value);
    },
    async commitTerrainFrame(value) {
      return simulation.commitTerrainFrame(value);
    },
    async propose(sample, motions) {
      simulation.enqueueInput(sample);
      const result = simulation.proposeMission({ motions });
      hooks?.beforeProposal?.();
      return result;
    },
    async commit(value) {
      return simulation.commitMission(value);
    },
    async step(sample, motions) {
      simulation.enqueueInput(sample);
      return simulation.stepMission({ motions });
    },
    async snapshot() {
      return simulation.snapshot();
    },
    async restore(value) {
      return simulation.restore(await verifyAdvancedRecovery(value));
    },
    async restorePractice(value) {
      return simulation.restore(
        await validateAdvancedPracticeRecovery(value, {
          expectedIdentity: simulation.identity,
        }),
      );
    },
    async telemetry() {
      return simulation.telemetry();
    },
    async recording() {
      return simulation.recording();
    },
    dispose() {
      simulation?.dispose();
    },
  };
}
function backendFactory(kind, hooks = {}) {
  return async ({ definition: retained, runId } = {}) => {
    let base, geometry, definition;
    const regional = kind.startsWith('regional');
    if (regional) {
      const options = {
        manifest: fixture.terrain.manifest,
        source: fixture.terrain.source,
        mode: 'acro',
        response: preset.response,
        ...(kind === 'regional-advanced' ? { advanced: configuration.advanced } : {}),
      };
      base =
        kind === 'regional-advanced'
          ? createAdvancedRegionalSession(options, {
              createClient: () => worker(hooks),
              createGeometry(...args) {
                const owner = createVerifiedFlightGeometry(...args);
                return {
                  ...owner,
                  motionCoverage(...query) {
                    return hooks.rejectCoverage
                      ? { status: 'unknown-cell' }
                      : owner.motionCoverage(...query);
                  },
                };
              },
            })
          : createRegionalSession(options);
      await base.prepare();
      const course = regionalReviewEntry(options).course,
        spawn = Object.fromEntries(
          ['x', 'y', 'z'].map((key) => [key, Math.round(base.snapshot().position[key])]),
        );
      geometry = createRegionalEncounterGeometry(base.encounterGeometry(), {
        bounds: course.bounds,
        player: spawn,
      });
      definition =
        retained ??
        createEncounterDefinition({
          course: { ...course, bounds: geometry.area, spawn },
          version: 2,
          activity: 'hunting',
          population: 6,
          playerDamage: 'invulnerable',
          admitActor: geometry.admitActor,
          admitServicePad: geometry.admitServicePad,
        });
    } else {
      const course = FLIGHT_COURSES[0];
      geometry = createNativeEncounterGeometry(course);
      definition =
        retained ??
        createEncounterDefinition({
          course,
          version: 2,
          activity: 'hunting',
          population: 6,
          playerDamage: 'invulnerable',
          admitActor: geometry.admitActor,
          admitServicePad: geometry.admitServicePad,
        });
      base =
        kind === 'native-standard'
          ? createWorldFlight({
              course: encounterPhysicsCourse(course),
              encounterPhysicsOnly: true,
              unscoredPractice: true,
            })
          : createAircraftCourseSession(
              {
                course: encounterPhysicsCourse(course),
                mode: 'acro',
                configuration,
                encounterActors: createEncounterRuntime(definition, { geometry }).snapshot().actors,
              },
              { createClient: () => worker(hooks), createMission: createWorldFlight },
            );
    }
    const verifiedGeometry = geometry;
    geometry = {
      ...verifiedGeometry,
      ready: (...args) =>
        hooks.encounterReady !== false && (verifiedGeometry.ready?.(...args) ?? true),
    };
    const session = await createEncounterSession(base, { definition, geometry, runId, regional });
    if (kind === 'native-advanced') await session.prepare();
    return session;
  };
}
for (const kind of ['native-standard', 'native-advanced', 'regional-standard', 'regional-advanced'])
  test(`${kind} preserves paired recovery and replay across an encounter geometry hold`, async () => {
    const hooks = {},
      factory = backendFactory(kind, hooks),
      session = await factory(),
      regional = kind.startsWith('regional');
    let saved;
    try {
      session.arm();
      await session.step(controls);
      const roster = session.snapshot().encounter.actors;
      hooks.encounterReady = false;
      for (let tick = 0; tick < 3; tick++) await session.step({ ...controls, actions: 1 });
      const held = session.snapshot();
      assert.equal(held.status, 'active');
      assert.equal(held.ticks, regional ? 4 : 1);
      assert.equal(held.encounter.ticks, 1);
      assert.equal(held.encounter.shots, 0);
      assert.equal(held.encounter.geometryWaiting, true);
      assert.equal(held.encounter.outsideArea, false);
      assert.deepEqual(held.encounter.actors, roster);
      const checkpoint = await session.exportCombatRecovery();
      await session.restoreCombatRecovery(checkpoint);
      const restored = session.snapshot();
      assert.equal(restored.status, 'paused');
      assert.equal(restored.ticks, held.ticks);
      assert.equal(restored.encounter.ticks, 1);
      assert.deepEqual(restored.encounter.actors, roster);
      await session.step(controls);
      assert.deepEqual(session.snapshot(), restored, 'Recovery requires an explicit Arm');
      hooks.encounterReady = true;
      session.arm();
      await session.step(controls);
      assert.equal(session.snapshot().ticks, regional ? 5 : 2);
      assert.equal(session.snapshot().encounter.ticks, 2);
      assert.equal(session.snapshot().encounter.geometryWaiting, false);
      saved = await session.exportCombatRecovery();
      assert.deepEqual(
        saved.gameplay.recording.frames.map((frame) => frame[6]),
        regional ? [0, 1, 1, 1, 0] : [0, 0],
      );
    } finally {
      await session.dispose();
    }
    const proof = await replayEncounterSession(saved, { createSession: factory });
    assert.equal(proof.verified, true);
    assert.equal(proof.sessionTicks, regional ? 5 : 2);
    assert.equal(proof.acceptedTicks, 2);
    assert.equal(proof.physicalBoundary, 'accepted-dynamics-v1');
  });

for (const kind of ['native-standard', 'native-advanced'])
  test(`${kind} migrates only old v2 absent-slot bookkeeping while preserving replay and rejecting active caught actors`, async () => {
    const course = FLIGHT_COURSES[0],
      geometry = createNativeEncounterGeometry(course),
      definition = createEncounterDefinition({
        course,
        version: 2,
        activity: 'survival',
        population: 64,
        playerDamage: 'invulnerable',
        admitActor: geometry.admitActor,
        admitServicePad: geometry.admitServicePad,
      }),
      factory = backendFactory(kind),
      session = await factory({ definition });
    const physicalActors = (saved) =>
      kind === 'native-standard'
        ? saved.gameplay.physical.state.actors
        : saved.gameplay.physical.mission.state.actors;
    const rehash = (saved) => {
      if (kind === 'native-advanced') {
        const { checksum: _checksum, ...packet } = saved.gameplay.physical;
        saved.gameplay.physical.checksum = dataIdentity(packet);
      }
      saved.checksum = dataIdentity(saved.gameplay);
    };
    let saved;
    try {
      session.arm();
      for (let tick = 0; tick < 4; tick++) await session.step(controls);
      saved = await session.exportCombatRecovery();
      const absent = new Set(
        saved.gameplay.encounter.state.actors
          .filter((actor) => ['waiting', 'inactive'].includes(actor.status))
          .map((actor) => actor.slotId),
      );
      assert.ok(absent.size > 0);
      for (const actor of physicalActors(saved))
        if (absent.has(actor.id)) {
          assert.equal(actor.status, 'defeated');
          actor.status = 'caught';
          actor.health = actor.maxHealth;
        }
      rehash(saved);
      const original = structuredClone(saved);
      await session.restoreCombatRecovery(saved);
      assert.deepEqual(saved, original, 'Migration must not rewrite the archived source');
      assert.equal(session.snapshot().encounter.ticks, 4);
      for (const actor of physicalActors(await session.exportCombatRecovery()))
        if (absent.has(actor.id)) assert.equal(actor.status, 'defeated');
      const activeCaught = structuredClone(saved),
        active = physicalActors(activeCaught).find(
          (actor) => !absent.has(actor.id) && actor.health > 0,
        );
      assert.ok(active);
      active.status = 'caught';
      rehash(activeCaught);
      await assert.rejects(session.restoreCombatRecovery(activeCaught), /caught actor/);
      if (kind === 'native-advanced') {
        const invalidChecksum = structuredClone(saved);
        invalidChecksum.gameplay.physical.checksum = 'invalid';
        invalidChecksum.checksum = dataIdentity(invalidChecksum.gameplay);
        await assert.rejects(session.restoreCombatRecovery(invalidChecksum), /checksum/);
      }
    } finally {
      await session.dispose();
    }
    const proof = await replayEncounterSession(saved, { createSession: factory });
    assert.equal(proof.verified, true);
    assert.equal(proof.acceptedTicks, 4);
  });
for (const kind of ['native-advanced', 'regional-standard', 'regional-advanced'])
  test(`${kind} replays accepted combat commands against the exact physical world`, async () => {
    const factory = backendFactory(kind),
      session = await factory();
    let saved;
    try {
      session.arm();
      for (let tick = 0; tick < 12; tick++) {
        if (tick === 0) session.queueCombatCommand({ switchWeapon: 1 });
        if (tick === 4) session.queueCombatCommand({ reload: true });
        await session.step({ ...controls, actions: tick === 2 ? 1 : 0 });
        assert.equal(session.snapshot().encounter.ticks, tick + 1);
      }
      saved = await session.exportCombatRecovery();
    } finally {
      await session.dispose();
    }
    const proof = await replayEncounterSession(saved, { createSession: factory });
    assert.equal(proof.verified, true);
    assert.equal(proof.physicalBoundary, 'accepted-dynamics-v1');
    const changed = structuredClone(saved);
    if (kind === 'regional-standard') changed.gameplay.physical.body.position.x += 100;
    else {
      const physical =
        kind === 'native-advanced'
          ? changed.gameplay.physical.physical
          : changed.gameplay.physical.simulation;
      physical.checkpoint.state.usedAh += 0.01;
    }
    changed.checksum = dataIdentity(changed.gameplay);
    await assert.rejects(
      replayEncounterSession(changed, { createSession: factory }),
      /physical boundary/,
    );
  });
test('Advanced regional replay tolerates rejected transport sequence gaps while checking accepted dynamics', async () => {
  const hooks = {},
    factory = backendFactory('regional-advanced', hooks),
    session = await factory();
  let saved;
  try {
    session.arm();
    await session.step(controls);
    const before = session.snapshot();
    hooks.beforeProposal = () => {
      hooks.rejectCoverage = true;
    };
    await session.step(controls);
    assert.equal(session.snapshot().encounter.ticks, before.encounter.ticks);
    hooks.rejectCoverage = false;
    hooks.beforeProposal = null;
    await session.prepare();
    session.arm();
    for (let tick = 0; tick < 5; tick++) await session.step(controls);
    saved = await session.exportCombatRecovery();
  } finally {
    await session.dispose();
  }
  const proof = await replayEncounterSession(saved, { createSession: factory });
  assert.equal(proof.verified, true);
  assert.equal(proof.acceptedTicks, 6);
});

test('old v2 definitions without the crowd revision replay through the legacy rule dispatch', async () => {
  const factory = backendFactory('native-standard');
  const initial = await factory();
  const savedDefinition = (await initial.exportCombatRecovery()).gameplay.encounter.definition;
  await initial.dispose();
  delete savedDefinition.crowdModel;
  const session = await factory({ definition: savedDefinition });
  let saved;
  try {
    session.arm();
    for (let i = 0; i < 20; i++) await session.step(controls);
    saved = await session.exportCombatRecovery();
  } finally {
    await session.dispose();
  }
  assert.equal(Object.hasOwn(saved.gameplay.encounter.definition, 'crowdModel'), false);
  assert.equal((await replayEncounterSession(saved, { createSession: factory })).verified, true);
});
