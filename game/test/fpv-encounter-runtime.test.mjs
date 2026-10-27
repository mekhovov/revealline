import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../../game/data-json.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  createEncounterDefinition,
  createEncounterRuntime,
  createNativeEncounterGeometry,
  encounterImpactDamage,
  encounterPhysicsCourse,
  validateEncounterDefinition,
  inspectEncounterRecovery,
  prepareEncounterDefinition,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import {
  createWorldFlight,
  initWorldRuntime,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
await initWorldRuntime();
const p = (x = 0, y = 0, z = 0) => ({ x, y, z });
const player = (position = p()) => ({ position, velocity: p(), radius: 220 });
const geometry = { sweepStatic: () => null, visible: () => true };
const course = () => ({
  ...encounterPhysicsCourse(FLIGHT_COURSES[0]),
  bounds: { min: p(-20000, 0, -20000), max: p(20000, 10000, 20000) },
  actors: [
    {
      id: 'test-actor',
      type: 'patrol',
      role: 'hostile',
      position: p(5000),
      path: [],
      speed: 0,
      health: 50,
      radius: 350,
      height: 1800,
      fireEveryTicks: 0,
    },
  ],
});
const definition = (options = {}) =>
  createEncounterDefinition({
    course: course(),
    baseIdentity: 'test-base',
    population: 6,
    activity: 'elimination',
    admitActor: (a) => (a.id === 'test-actor' ? a : null),
    ...options,
  });
function step(runtime, input = {}, at = player(), extra = {}) {
  const proposed = runtime.prepare({ player: at, input });
  return runtime.commit({
    transaction: proposed.transaction,
    player: at,
    ...extra,
  });
}
function impact(runtime, speed = 10000, extra = {}) {
  const at = player(p(4500)),
    proposed = runtime.prepare({ player: at });
  return runtime.commit({
    transaction: proposed.transaction,
    player: at,
    contacts: [
      {
        actorId: proposed.actors[0].slotId,
        normal: p(-1),
        relativeNormalSpeedMmS: speed,
      },
    ],
    ...extra,
  });
}

test('native admission creates supported distinct routes and preserves course', () => {
  const source = course(),
    before = structuredClone(source),
    valid = createEncounterDefinition({
      course: source,
      baseIdentity: 'native',
      population: 6,
    });
  assert.ok(valid.actors.length > 0 && valid.actors.length <= 6);
  assert.deepEqual(source, before);
  const admitted = createNativeEncounterGeometry(source);
  try {
    for (const actor of valid.actors) assert.ok(admitted.admitActor(actor));
  } finally {
    admitted.dispose();
  }
});
test('admission shortfalls are bounded and a map with no usable targets gives a clear error', () => {
  assert.equal(definition().actors.length, 1);
  assert.throws(
    () => createEncounterDefinition({ course: course(), admitActor: () => null }),
    /No admitted/,
  );
});
test('cancel and rejected commit preserve RNG, actor, projectile and event state', () => {
  const runtime = createEncounterRuntime(definition(), { geometry }),
    before = runtime.snapshot();
  const first = runtime.prepare({ player: player(), input: { fire: true } });
  assert.deepEqual(runtime.snapshot(), before);
  runtime.cancel(first.transaction);
  assert.deepEqual(runtime.snapshot(), before);
  const second = runtime.prepare({ player: player(), input: { fire: true } });
  runtime.commit({ transaction: second.transaction, accepted: false });
  assert.deepEqual(runtime.snapshot(), before);
  assert.throws(
    () => runtime.commit({ transaction: second.transaction, player: player() }),
    /Unknown/,
  );
});
test('closing normal speed uses a continuous threshold and bounded damage', () => {
  assert.equal(encounterImpactDamage(1999), 0);
  assert.equal(encounterImpactDamage(2000), 0);
  assert.equal(encounterImpactDamage(5000), 30);
  assert.equal(encounterImpactDamage(12000), 100);
  assert.equal(encounterImpactDamage(90000), 100);
});
test('one lethal accepted impact produces one defeat and completes finite elimination', () => {
  const runtime = createEncounterRuntime(definition(), { geometry }),
    result = impact(runtime);
  assert.equal(result.kills, 1);
  assert.equal(result.status, 'complete');
  assert.equal(result.actors[0].status, 'defeated');
  assert.equal(runtime.defeats().length, 1);
  assert.equal(result.events.filter((e) => e.type === 'defeat').length, 1);
  assert.equal(runtime.defeats()[0].material, 'organic');
  assert.throws(() => runtime.prepare({ player: player() }), /ended/);
});
test('contact separation and thirteen accepted ticks are both required before another impact', () => {
  const def = definition();
  def.actors[0].health = 200;
  const runtime = createEncounterRuntime(def, { geometry });
  assert.equal(impact(runtime, 5000).actors[0].health, 170);
  for (let i = 0; i < 20; i++) impact(runtime, 5000);
  assert.equal(runtime.snapshot().actors[0].health, 170);
  step(runtime);
  assert.equal(impact(runtime, 5000).actors[0].health, 140);
});
test('player shots can destroy hazards and civilians; verified walls block shots', () => {
  for (const type of ['hazard', 'patrol']) {
    const def = definition();
    Object.assign(def.actors[0], {
      type,
      role: 'civilian',
      position: p(0, 0, -2000),
      health: 25,
      family: 'lookout',
      appearance: { family: 'lookout', cast: 'authored' },
    });
    const runtime = createEncounterRuntime(def, { geometry });
    for (let i = 0; i < 10 && runtime.snapshot().status === 'active'; i++)
      step(runtime, { fire: i === 0 });
    assert.equal(runtime.snapshot().kills, 1);
    const blocked = createEncounterRuntime(def, {
      geometry: {
        ...geometry,
        sweepStatic: () => ({ toi: 0, normal: p(0, 0, 1) }),
      },
    });
    for (let i = 0; i < 10; i++) step(blocked, { fire: i === 0 });
    assert.equal(blocked.snapshot().kills, 0);
  }
});
test('Hunt has no return fire and completes after exactly 9000 accepted ticks', () => {
  const def = definition({ activity: 'hunting' });
  def.actors[0].fireEveryTicks = 50;
  const runtime = createEncounterRuntime(def, { geometry });
  for (let i = 0; i < 8999; i++) step(runtime);
  assert.equal(runtime.snapshot().status, 'active');
  assert.equal(runtime.snapshot().health, 100);
  assert.equal(runtime.snapshot().projectiles.length, 0);
  assert.equal(step(runtime).result.reason, 'time-complete');
});
test('Hunt replaces a target after 50 ticks with a new logical identity and stable physics slot', () => {
  const runtime = createEncounterRuntime(definition({ activity: 'hunting' }), {
      geometry,
    }),
    first = runtime.snapshot().actors[0];
  impact(runtime);
  for (let i = 0; i < 50; i++) step(runtime);
  assert.equal(runtime.snapshot().actors[0].status, 'defeated');
  const next = step(runtime).actors[0];
  assert.equal(next.status, 'active');
  assert.equal(next.slotId, first.slotId);
  assert.notEqual(next.id, first.id);
});
test('Continuous wave delay is fixed by final five seconds of damage; skip creates a new life', () => {
  const runtime = createEncounterRuntime(
      definition({ activity: 'continuous', difficulty: 'normal' }),
      { geometry },
    ),
    first = runtime.snapshot().actors[0];
  const defeated = impact(runtime);
  assert.equal(defeated.phase, 'intermission');
  assert.equal(defeated.nextWaveTick - defeated.ticks, 500);
  runtime.requestNextWave();
  const next = step(runtime);
  assert.equal(next.wave, 2);
  assert.equal(next.actors[0].slotId, first.slotId);
  assert.notEqual(next.actors[0].id, first.id);
});
test('checkpoint restores settled facts without replaying old effects and rejects tampering', () => {
  const def = definition({ activity: 'continuous' }),
    runtime = createEncounterRuntime(def, { geometry });
  impact(runtime);
  const saved = runtime.checkpoint(),
    restored = createEncounterRuntime(def, { geometry });
  restored.restore(saved);
  assert.equal(restored.defeats().length, 1);
  assert.deepEqual(restored.snapshot().events, []);
  saved.state.health = 999;
  assert.throws(() => restored.restore(saved), /checksum/);
});
test('native physics-only bridge suppresses course completion and reports accepted actor contact', () => {
  const source = encounterPhysicsCourse(FLIGHT_COURSES[0]);
  source.steps.acro = source.steps['self-level'] = [{ type: 'survive', ticks: 1 }];
  const flight = createWorldFlight({
    course: source,
    encounterPhysicsOnly: true,
    unscoredPractice: true,
  });
  try {
    const runtime = createEncounterRuntime(definition(), { geometry });
    flight.configureEncounterActors(runtime.snapshot().actors);
    flight.arm();
    const proposed = runtime.prepare({ player: player() });
    flight.stageEncounterActors(proposed);
    const state = flight.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0 });
    assert.equal(state.status, 'active');
    assert.equal(state.step, 0);
    assert.equal(flight.encounterMotion().trace.length, 2);
    const saved = flight.encounterCheckpoint();
    flight.restoreEncounterCheckpoint(saved);
    assert.equal(flight.snapshot().status, 'paused');
  } finally {
    flight.dispose();
  }
});

const resign = (checkpoint) => {
  checkpoint.checksum = dataIdentity({
    definition: checkpoint.definition,
    state: checkpoint.state,
  });
  return checkpoint;
};
test('authored prototype roster survives population changes while active slots obey the selected count', () => {
  const def = definition();
  def.actors = Array.from({ length: 20 }, (_, i) => ({
    ...structuredClone(def.actors[0]),
    id: `target-${i}`,
    position: p(5000 + i * 500),
  }));
  assert.equal(validateEncounterDefinition(def).actors.length, 20);
  const runtime = createEncounterRuntime(def, { geometry });
  assert.equal(runtime.snapshot().actors.length, 6);
  assert.equal(runtime.definition().actors.length, 20);
});
test('optional props do not block finite elimination or completion of a wave', () => {
  for (const activity of ['elimination', 'continuous']) {
    const def = definition({ activity });
    def.actors.push({
      ...structuredClone(def.actors[0]),
      id: 'optional-crate',
      type: 'prop',
      material: 'wood',
      position: p(8000),
    });
    const runtime = createEncounterRuntime(def, { geometry }),
      result = impact(runtime);
    assert.equal(result.actors[1].status, 'active');
    assert.equal(
      activity === 'elimination' ? result.status : result.phase,
      activity === 'elimination' ? 'complete' : 'intermission',
    );
  }
});
test('impact counters remain separate from pulse accuracy and damage breaks the streak', () => {
  const def = definition({ activity: 'hunting', difficulty: 'easy' });
  def.actors[0].position = p(0, 0, -2000);
  def.actors[0].health = 100;
  const runtime = createEncounterRuntime(def, { geometry });
  for (let i = 0; i < 10; i++) step(runtime, { fire: i === 0 });
  assert.equal(runtime.snapshot().hits, 1);
  assert.equal(runtime.snapshot().shots, 1);
  const result = impact(runtime);
  assert.equal(result.successfulImpacts, 1);
  assert.equal(result.hits, 1);
  assert.equal(result.accuracy, 1);
  assert.equal(result.streak, 1);
  assert.equal(result.bestStreak, 1);
});
test('same accepted inputs produce varied deterministic next waves with stable physics archetypes', () => {
  const def = definition({ activity: 'continuous', difficulty: 'easy' });
  const a = createEncounterRuntime(def, { geometry }),
    b = createEncounterRuntime(def, { geometry });
  for (const runtime of [a, b]) {
    impact(runtime);
    runtime.requestNextWave();
    step(runtime);
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.notEqual(a.snapshot().actors[0].family, def.actors[0].family);
  assert.deepEqual(
    ['type', 'radius', 'height'].map((key) => a.snapshot().actors[0][key]),
    ['type', 'radius', 'height'].map((key) => def.actors[0][key]),
  );
});
test('incoming attackers obey difficulty limits and hunting never returns fire', () => {
  for (const [difficulty, maximum] of [
    ['easy', 2],
    ['normal', 3],
    ['hard', 4],
  ]) {
    const def = definition({ difficulty, activity: 'continuous' });
    def.actors = Array.from({ length: 6 }, (_, i) => ({
      ...structuredClone(def.actors[0]),
      id: `attacker-${i}`,
      position: p(5000 + i * 900),
      fireEveryTicks: 50,
    }));
    const runtime = createEncounterRuntime(def, { geometry });
    for (let i = 0; i < 50; i++) step(runtime);
    assert.equal(runtime.snapshot().projectiles.length, maximum);
  }
});
test('a mutual fatal collision records the target once and fails the run before success', () => {
  const def = definition({ difficulty: 'hard' }),
    runtime = createEncounterRuntime(def, { geometry });
  const checkpoint = runtime.checkpoint();
  checkpoint.state.health = 10;
  runtime.restore(resign(checkpoint));
  const result = impact(runtime, 12000);
  assert.equal(result.kills, 1);
  assert.equal(result.status, 'failed');
  assert.equal(result.result.reason, 'player-defeated');
  assert.equal(runtime.defeats().length, 1);
});
test('checkpoint validation rejects forged nested state even with recomputed checksums', () => {
  const def = definition(),
    runtime = createEncounterRuntime(def, { geometry });
  for (const mutate of [
    (s) => {
      s.actors[0].radius = 1000;
    },
    (s) => {
      s.actors[0].damage = 999;
    },
    (s) => {
      s.actors[0].position.x = 999999;
    },
    (s) => {
      s.contactLocks.unknown = { tick: 0, separated: false };
    },
    (s) => {
      s.actors[0].pathIndex = 99;
    },
    (s) => {
      s.hits = 1;
    },
    (s) => {
      s.actors[0].appearance.cast = 'injected';
    },
  ]) {
    const checkpoint = runtime.checkpoint();
    mutate(checkpoint.state);
    assert.throws(() => runtime.restore(resign(checkpoint)));
  }
});
test('native physical checkpoint uses configured collision slots and validates their shapes', () => {
  const source = encounterPhysicsCourse(FLIGHT_COURSES[0]),
    runtime = createEncounterRuntime(definition(), { geometry });
  const flight = createWorldFlight({
    course: source,
    encounterPhysicsOnly: true,
    unscoredPractice: true,
    physicalPractice: true,
    physicalRadius: 220,
  });
  try {
    flight.configureEncounterActors(runtime.snapshot().actors);
    const checkpoint = flight.physicalCheckpoint();
    assert.equal(flight.validatePhysicalCheckpoint(checkpoint).state.actors.length, 1);
    flight.restorePhysicalCheckpoint(checkpoint);
    checkpoint.state.actors[0].radius++;
    assert.throws(() => flight.validatePhysicalCheckpoint(checkpoint), /geometry/);
    flight.reset();
    assert.equal(flight.snapshot().actors.length, 1);
    assert.equal(flight.physicalCheckpoint().state.actors[0].health, 50);
  } finally {
    flight.dispose();
  }
});
test('humanoid motion reuses pursuit warning, burst, recovery and restore state', () => {
  const def = definition({ activity: 'hunting' });
  Object.assign(def.actors[0], {
    position: p(4000),
    path: [p(4000), p(8000)],
    speed: 1500,
    family: 'sprinter',
    appearance: { family: 'sprinter', cast: 'authored' },
  });
  const runtime = createEncounterRuntime(def, { geometry });
  const first = step(runtime);
  assert.equal(first.actors[0].pursuit.phase, 'warning');
  assert.equal(first.actors[0].warning, true);
  for (let i = 0; i < 40; i++) step(runtime);
  assert.equal(runtime.snapshot().actors[0].pursuit.phase, 'burst');
  assert.ok(runtime.snapshot().actors[0].position.x > 4000);
  const resumed = createEncounterRuntime(def, { geometry });
  resumed.restore(runtime.checkpoint());
  for (let i = 0; i < 30; i++) {
    step(runtime);
    step(resumed);
  }
  assert.deepEqual(runtime.snapshot(), resumed.snapshot());
  assert.equal(runtime.snapshot().actors[0].pursuit.phase, 'recovering');
});
test('a full settled-remains ledger is retained outside per-tick snapshots', (context) => {
  const def = definition({ activity: 'continuous', difficulty: 'easy' });
  Object.assign(def.actors[0], { type: 'hazard', material: 'metal' });
  const runtime = createEncounterRuntime(def, { geometry });
  for (let i = 0; i < 1030; i++) {
    impact(runtime);
    runtime.requestNextWave();
    step(runtime);
  }
  assert.equal(runtime.defeats().length, 1024);
  assert.equal(Object.hasOwn(runtime.snapshot(), 'defeats'), false);
  const saved = runtime.checkpoint(),
    restored = createEncounterRuntime(def, { geometry });
  restored.restore(saved);
  assert.equal(restored.defeats().length, 1024);
  const started = performance.now();
  for (let i = 0; i < 1000; i++) step(runtime);
  const mean = (performance.now() - started) / 1000;
  context.diagnostic(`Mean accepted tick with full remains ledger: ${mean.toFixed(3)} ms`);
  assert.ok(mean < 3, `Incremental core mean ${mean} ms exceeds 3 ms target`);
});
test('all shipped world and learning catalogue courses admit at least one verified combat target', () => {
  const failures = [];
  for (const entry of [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE]) {
    try {
      const def = createEncounterDefinition({
        course: entry.course,
        baseIdentity: entry.packIdentity,
        population: 12,
      });
      assert.equal(def.baseIdentity, entry.packIdentity);
      assert.ok(def.actors.length > 0);
    } catch (error) {
      failures.push(`${entry.id}: ${error.message}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('tall narrow humanoids use continuous capsule hits without gaps between sampled heights', () => {
  const def = definition();
  Object.assign(def.actors[0], {
    position: p(0, 0, -2000),
    health: 25,
    radius: 100,
    height: 5000,
  });
  const runtime = createEncounterRuntime(def, { geometry });
  for (let tick = 0; tick < 10 && runtime.snapshot().status === 'active'; tick++)
    step(runtime, { fire: tick === 0 }, player(p(0, 1500)));
  assert.equal(runtime.snapshot().kills, 1);
});
test('accepted player damage and actor defeat events contain independent presentation facts', () => {
  const def = definition({ difficulty: 'hard' });
  Object.assign(def.actors[0], {
    type: 'vehicle',
    material: 'metal',
    vehicleModel: 'field-tank',
  });
  const runtime = createEncounterRuntime(def, { geometry }),
    result = impact(runtime, 12000);
  const damage = result.events.find((event) => event.type === 'player-damage'),
    defeat = runtime.defeats()[0];
  assert.equal(damage.damage, 25);
  assert.equal(damage.health, 75);
  assert.equal(damage.cause, 'impact');
  assert.equal(defeat.machine, 'tracked');
  assert.equal(defeat.humanoid, false);
  assert.equal(defeat.family, 'tracked-tank');
  assert.equal(defeat.appearance.model, 'field-tank');
});
test('actor movement consumes verified host support instead of linear route height', () => {
  const def = definition({ activity: 'hunting' });
  Object.assign(def.actors[0], {
    type: 'vehicle',
    path: [p(6000)],
    speed: 1000,
  });
  let calls = 0;
  const runtime = createEncounterRuntime(def, {
    geometry: {
      ...geometry,
      moveActor(actor, movement) {
        calls++;
        return {
          position: {
            x: actor.position.x + movement.x,
            y: actor.position.y + 10,
            z: actor.position.z,
          },
          blocked: false,
        };
      },
    },
  });
  step(runtime);
  assert.equal(calls, 1);
  assert.equal(runtime.snapshot().actors[0].position.y, 10);
});

test('continuous waves wait for a clear spawn instead of appearing inside the player', () => {
  const runtime = createEncounterRuntime(
    definition({ activity: 'continuous', difficulty: 'easy' }),
    { geometry },
  );
  impact(runtime);
  runtime.requestNextWave();
  const waiting = step(runtime, {}, player(p(5000)));
  assert.equal(waiting.wave, 1);
  assert.equal(waiting.waitingForClearSpawn, true);
  assert.equal(waiting.actors[0].status, 'defeated');
  const resumed = step(runtime);
  assert.equal(resumed.wave, 2);
  assert.equal(resumed.waitingForClearSpawn, false);
  assert.equal(resumed.actors[0].status, 'active');
});

test('authored encounters preserve all prototypes when active population changes', () => {
  const source = definition({ population: 20 });
  source.actors = Array.from({ length: 20 }, (_, index) => ({
    ...structuredClone(source.actors[0]),
    id: `authored-${index}`,
    position: p(1000 + index * 500),
    path: [],
  }));
  const authored = { definition: source },
    before = structuredClone(authored);
  const prepared = prepareEncounterDefinition({
    course: course(),
    baseIdentity: 'test-base',
    authored,
    selection: { population: 6, activity: 'hunting' },
    admitActor: (actor) => actor,
  });
  assert.equal(prepared.actors.length, 20);
  assert.equal(prepared.population, 6);
  assert.equal(createEncounterRuntime(prepared, { geometry }).snapshot().actors.length, 6);
  assert.deepEqual(authored, before);
  assert.throws(
    () =>
      prepareEncounterDefinition({
        course: course(),
        baseIdentity: 'test-base',
        authored,
        selection: {},
        admitActor: () => null,
      }),
    /verified geometry/,
  );
});

test('portable recovery retains exact encounter definition and rejects tampering before navigation', () => {
  const runtime = createEncounterRuntime(definition({ activity: 'continuous', seed: 987 }), {
    geometry,
    runId: 'load-proof',
  });
  step(runtime, { fire: true, nose: p(1) });
  const gameplay = {
    format: 'FPVCombatRecovery.v1',
    identity: {
      format: 'FPVEncounterSession.v1',
      base: { course: 'test-base' },
      encounter: runtime.identity,
    },
    encounter: runtime.checkpoint(),
    physical: {},
    recording: {},
  };
  const saved = { gameplay, checksum: dataIdentity(gameplay), presentation: null };
  assert.equal(
    inspectEncounterRecovery({ ...saved, presentation: { invalid: 'x'.repeat(5000) } }).saved
      .presentation,
    null,
  );
  const unsafeCosmetics = { ...saved };
  Object.defineProperty(unsafeCosmetics, 'presentation', {
    get() {
      throw new Error('must not run');
    },
  });
  assert.equal(inspectEncounterRecovery(unsafeCosmetics).saved.presentation, null);
  const parsed = inspectEncounterRecovery(saved);
  assert.deepEqual(parsed.definition, runtime.definition());
  assert.deepEqual(
    prepareEncounterDefinition({
      course: course(),
      baseIdentity: 'test-base',
      recovery: saved,
      selection: { population: 20, seed: 1, activity: 'elimination' },
      admitActor: (actor) => actor,
    }),
    runtime.definition(),
  );
  assert.throws(
    () =>
      prepareEncounterDefinition({ course: course(), baseIdentity: 'wrong-map', recovery: saved }),
    /different map revision/,
  );
  const corrupt = structuredClone(saved);
  corrupt.gameplay.encounter.state.health--;
  assert.throws(() => inspectEncounterRecovery(corrupt), /checksum/);
  corrupt.checksum = dataIdentity(corrupt.gameplay);
  assert.throws(() => inspectEncounterRecovery(corrupt), /checksum/);
  const wrongDefinition = structuredClone(saved);
  wrongDefinition.gameplay.identity.encounter = 'wrong';
  wrongDefinition.checksum = dataIdentity(wrongDefinition.gameplay);
  assert.throws(() => inspectEncounterRecovery(wrongDefinition), /definition identity/);
});

test('accepted firing and damage facts retain contact direction and actor foot anchor', () => {
  const runtime = createEncounterRuntime(definition(), { geometry });
  const firing = step(runtime, { fire: true, nose: p(1) });
  assert.equal(
    firing.events.filter((event) => event.type === 'fire' && event.actor === 'player').length,
    1,
  );
  const result = impact(runtime, 10000);
  const defeat = result.events.find((event) => event.type === 'defeat');
  assert.deepEqual(defeat.position, result.actors[0].position);
  assert.deepEqual(defeat.velocity, p(10000));
  assert.ok(defeat.impactPosition);
  const restored = createEncounterRuntime(definition(), { geometry, runId: result.runId });
  restored.restore(runtime.checkpoint());
  assert.deepEqual(restored.defeats(), runtime.defeats());
});

test('all companion actors including optional props must be destructible', () => {
  const candidate = definition();
  candidate.actors[0].destructible = false;
  assert.throws(() => validateEncounterDefinition(candidate), /capabilities/);
  candidate.actors[0].type = 'prop';
  assert.throws(() => validateEncounterDefinition(candidate), /capabilities/);
  const original = course();
  original.actors[0].destructible = false;
  const adopted = createEncounterDefinition({
    course: original,
    baseIdentity: 'unchanged-source',
    admitActor: (actor) => (actor.id === 'test-actor' ? actor : null),
  });
  assert.equal(adopted.actors[0].destructible, true);
  assert.equal(original.actors[0].destructible, false, 'Original course rules remain unchanged');
});

test('hunting replacement waits when another living target occupies its spawn', () => {
  const source = course();
  source.actors.push({
    ...source.actors[0],
    id: 'second-actor',
    position: p(8000),
    path: [p(5000)],
    speed: 3000,
  });
  const def = createEncounterDefinition({
    course: source,
    baseIdentity: 'spawn-clearance',
    activity: 'hunting',
    population: 6,
    admitActor: (actor) => (['test-actor', 'second-actor'].includes(actor.id) ? actor : null),
  });
  const runtime = createEncounterRuntime(def, { geometry });
  impact(runtime);
  for (let tick = 0; tick < 60; tick++) step(runtime);
  assert.equal(runtime.snapshot().actors[0].status, 'defeated');
  assert.ok(
    Math.abs(runtime.snapshot().actors[1].position.x - 5000) < 1000,
    'The living target occupies the required spawn clearance',
  );
  const proposed = runtime.prepare({ player: player(p(4500)) });
  runtime.commit({
    transaction: proposed.transaction,
    player: player(p(4500)),
    contacts: [
      { actorId: proposed.actors[1].slotId, normal: p(-1), relativeNormalSpeedMmS: 10000 },
    ],
  });
  const next = step(runtime);
  assert.equal(next.actors[0].status, 'active');
  assert.equal(next.actors[1].status, 'defeated');
});
