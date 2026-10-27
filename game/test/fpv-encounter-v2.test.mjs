import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import {
  createEncounterDefinition,
  createEncounterRuntime,
  validateEncounterDefinition,
  normalizeEncounterConfig,
  ENCOUNTER_FORMAT_V2,
  prepareEncounterDefinition,
  createNativeEncounterGeometry,
} from '../../optional-practice/civilian-fpv/encounter-runtime.mjs';
import { initWorldRuntime } from '../../optional-practice/civilian-fpv/world-model.mjs';
import { createRegionalEncounterGeometry } from '../../optional-practice/civilian-fpv/encounter-geometry.mjs';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
const p = (x = 0, y = 0, z = 0) => ({ x, y, z });
const player = (position = p(), extra = {}) => ({ position, velocity: p(), radius: 220, ...extra });
const ground = {
  visible: () => true,
  surface: (position) => ({ position: { ...position, y: 0 }, normal: p(0, 1) }),
  sweepStatic: (from, to, radius = 25) =>
    from.y >= radius && to.y < radius
      ? {
          toi: (from.y - radius) / (from.y - to.y),
          position: p(to.x, radius, to.z),
          normal: p(0, 1),
          surfaceId: 'floor',
        }
      : null,
};
const target = (i = 0, overrides = {}) => ({
  id: `target-${i}`,
  type: 'patrol',
  role: 'civilian',
  position: p(i * 3000, 12, -5000),
  path: [],
  speed: 0,
  health: 50,
  fireEveryTicks: 0,
  ...overrides,
});
function definition(options = {}, targets = [target()]) {
  return createEncounterDefinition({
    course: {
      id: 'combat-test',
      bounds: { min: p(-100000, 0, -100000), max: p(100000, 30000, 100000) },
      spawn: p(),
      actors: targets,
    },
    baseIdentity: 'test-base',
    version: 2,
    population: 6,
    activity: 'elimination',
    admitActor: (a) => (a.id.startsWith('target-') ? a : null),
    admitServicePad: () => p(),
    ...options,
  });
}

test('new combat preserves every authored actor before generated population and raises the effective minimum', () => {
  const targets = Array.from({ length: 9 }, (_, index) => target(index)),
    before = structuredClone(targets),
    seen = [];
  const result = definition(
    {
      population: 6,
      admitActor(actor) {
        seen.push(actor.id);
        return actor.id.startsWith('target-') ? actor : null;
      },
    },
    targets,
  );
  assert.equal(result.population, 12);
  assert.deepEqual(
    result.actors.map((actor) => actor.id),
    targets.map((actor) => actor.id),
  );
  assert.deepEqual(
    seen.slice(0, targets.length),
    targets.map((actor) => actor.id),
  );
  assert.equal(createEncounterRuntime(result, { geometry: ground }).snapshot().actors.length, 9);
  assert.deepEqual(targets, before);
});

test('unsupported authored paths use a validated alternative under the same stable actor identity', () => {
  const source = target(0, { path: [p(0, 12, -5000), p(0, 12, -7000)], speed: 1500 }),
    before = structuredClone(source);
  const result = definition(
    {
      admitActor: (actor) => (actor.id === source.id && actor.path.length === 0 ? actor : null),
    },
    [source],
  );
  assert.equal(result.actors.length, 1);
  assert.equal(result.actors[0].id, source.id);
  assert.deepEqual(result.actors[0].position, source.position);
  assert.deepEqual(result.actors[0].path, []);
  assert.equal(result.actors[0].speed, 0);
  assert.equal(result.actors[0].destructible, true);
  assert.deepEqual(source, before);
});

test('authored relocation is seeded, bounded, spawn-clear and never silently replaces a missing actor', () => {
  const targets = [target(0, { position: p() }), target(1, { position: p() })],
    before = structuredClone(targets),
    one = definition({ seed: 44 }, targets),
    two = definition({ seed: 44 }, targets);
  assert.deepEqual(one, two);
  assert.deepEqual(
    one.actors.map((actor) => actor.id),
    ['target-0', 'target-1'],
  );
  assert.ok(one.actors.every((actor) => Math.hypot(actor.position.x, actor.position.z) >= 3850));
  assert.ok(
    Math.hypot(
      one.actors[0].position.x - one.actors[1].position.x,
      one.actors[0].position.z - one.actors[1].position.z,
    ) >= 1500,
  );
  let probes = 0;
  assert.throws(
    () =>
      definition(
        {
          admitActor(actor) {
            probes++;
            return actor.id === 'target-0' ? null : actor;
          },
        },
        targets,
      ),
    /authored actor target-0.*blocked/,
  );
  assert.ok(probes <= 194, 'one rejected actor has a fixed bounded admission search');
  assert.deepEqual(targets, before);
});

test('over-capacity authored rosters fail explicitly without mutating retained definitions', () => {
  const targets = Array.from({ length: 21 }, (_, index) => target(index));
  assert.throws(() => definition({ population: 20 }, targets), /authored actor roster exceeds/);
  const retained = definition({ population: 20 }, targets.slice(0, 20)),
    before = structuredClone(retained);
  const selected = prepareEncounterDefinition({
    course: { bounds: retained.bounds, spawn: retained.spawn, actors: [] },
    baseIdentity: 'test-base',
    authored: retained,
    selection: { version: 2, population: 6, activity: 'elimination' },
    admitActor: (actor) => actor,
  });
  assert.equal(selected.population, 20, 'new Studio attempts reserve every authored actor');
  assert.equal(createEncounterRuntime(selected, { geometry: ground }).snapshot().actors.length, 20);
  assert.deepEqual(selected.actors, before.actors);
  assert.deepEqual(retained, before);
  const historical = { ...structuredClone(retained), population: 6 },
    runtime = createEncounterRuntime(historical, { geometry: ground }),
    gameplay = {
      format: 'FPVCombatRecovery.v1',
      identity: {
        format: 'FPVEncounterSession.v2',
        base: { course: 'test-base' },
        encounter: runtime.identity,
      },
      encounter: runtime.checkpoint(),
      physical: {},
      recording: {},
    },
    recovery = { gameplay, checksum: dataIdentity(gameplay), presentation: null };
  const restored = prepareEncounterDefinition({
    course: { bounds: retained.bounds, spawn: retained.spawn },
    baseIdentity: 'test-base',
    recovery,
    selection: { version: 2, activity: 'hunting', population: 20 },
    admitActor: (actor) => actor,
  });
  assert.deepEqual(
    restored,
    historical,
    'recovery retains the exact historical active population and definition',
  );
});

test('every shipped world and learning course transfers its complete authored roster at Sparse population', async () => {
  await initWorldRuntime();
  const failures = [];
  for (const entry of [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE])
    try {
      const result = createEncounterDefinition({
          course: entry.course,
          baseIdentity: entry.packIdentity,
          population: 6,
          version: 2,
        }),
        ids = new Set(result.actors.map((actor) => actor.id));
      assert.ok(result.actors.length > 0);
      assert.ok((entry.course.actors ?? []).every((actor) => ids.has(actor.id)));
      assert.ok(result.population >= (entry.course.actors?.length ?? 0));
    } catch (error) {
      failures.push(`${entry.id}: ${error.message}`);
    }
  assert.deepEqual(failures, []);
});
const make = (options, targets, geometry = ground) =>
  createEncounterRuntime(definition(options, targets), { geometry });
function step(runtime, input = {}, at = player(), extra = {}) {
  const pending = runtime.prepare({ player: at, input });
  return runtime.commit({ transaction: pending.transaction, player: at, ...extra });
}
function ticks(runtime, count, input = {}, at = player()) {
  let state;
  for (let i = 0; i < count && runtime.snapshot().status === 'active'; i++)
    state = step(runtime, input, at);
  return state ?? runtime.snapshot();
}
function edit(runtime, change) {
  const checkpoint = runtime.checkpoint();
  change(checkpoint.state);
  checkpoint.checksum = dataIdentity({
    definition: checkpoint.definition,
    state: checkpoint.state,
  });
  runtime.restore(checkpoint);
}
function impact(runtime, index = 0, speed = 20000) {
  const a = runtime.snapshot().actors[index];
  return step(runtime, {}, player(a.position), {
    contacts: [{ actorId: a.slotId, normal: p(1), relativeNormalSpeedMmS: speed }],
  });
}

test('v2 config normalizes distinct loadout and independent survival population', () => {
  assert.deepEqual(
    normalizeEncounterConfig({ loadout: ['scatter', 'scatter'], activity: 'survival' }).loadout,
    ['scatter', 'precision'],
  );
  assert.equal(normalizeEncounterConfig({ activity: 'survival' }).population, 96);
  const d = definition();
  assert.equal(d.format, ENCOUNTER_FORMAT_V2);
  assert.equal(d.actors[0].role, 'hostile');
  assert.equal(d.actors[0].appearance.cast, 'tactical');
  const invalid = structuredClone(d);
  invalid.loadout = ['autocannon', 'autocannon'];
  assert.throws(() => validateEncounterDefinition(invalid), /loadout/);
});
test('v1 authored definition upgrades only when explicitly selected', () => {
  const d = definition(),
    old = { ...d, format: 'FPVEncounterDefinition.v1', revision: 'r1' };
  for (const key of [
    'survivalMode',
    'loadout',
    'payload',
    'ammoPreset',
    'playerDamage',
    'enemyDamage',
    'servicePad',
    'crowdModel',
  ])
    delete old[key];
  old.actors.forEach((a) => {
    delete a.appearance.archetype;
  });
  const upgraded = prepareEncounterDefinition({
    authored: old,
    baseIdentity: 'test-base',
    selection: { version: 2, activity: 'hunting', population: 6 },
  });
  assert.equal(upgraded.format, ENCOUNTER_FORMAT_V2);
  assert.equal(upgraded.activity, 'hunting');
  assert.equal(
    prepareEncounterDefinition({
      authored: old,
      baseIdentity: 'test-base',
      selection: { activity: 'hunting' },
    }).format,
    'FPVEncounterDefinition.v1',
  );
});
test('v2 rejected/cancelled transactions preserve RNG and one-shot command sequence', () => {
  const runtime = make(),
    before = runtime.snapshot();
  const pending = runtime.prepare({
    player: player(),
    input: { switchWeapon: 1, commandSeq: 1, fire: true },
  });
  assert.deepEqual(runtime.snapshot(), before);
  runtime.cancel(pending.transaction);
  assert.deepEqual(runtime.snapshot(), before);
  const second = runtime.prepare({ player: player(), input: { switchWeapon: 1, commandSeq: 1 } });
  runtime.commit({ transaction: second.transaction, accepted: false });
  assert.deepEqual(runtime.snapshot(), before);
  step(runtime, { switchWeapon: 1, commandSeq: 1 });
  assert.equal(runtime.snapshot().weaponIndex, 1);
  step(runtime, { switchWeapon: 0, commandSeq: 1 });
  assert.equal(runtime.snapshot().weaponIndex, 1);
  step(runtime, { switchWeapon: 0, commandSeq: 2 });
  assert.equal(runtime.snapshot().weaponIndex, 0);
});
test('autocannon uses magazine, reload timing and preserved selected-weapon reload', () => {
  const runtime = make({ activity: 'hunting' });
  step(runtime, { fire: true, nose: p(1) });
  assert.equal(runtime.snapshot().weapons[0].ammo, 29);
  step(runtime, { reload: true, commandSeq: 1 });
  assert.equal(runtime.snapshot().weapons[0].reloadTicks, 90);
  step(runtime, { switchWeapon: 1, commandSeq: 2 });
  ticks(runtime, 20);
  assert.equal(runtime.snapshot().weapons[0].reloadTicks, 90);
  step(runtime, { switchWeapon: 0, commandSeq: 3 });
  ticks(runtime, 89);
  assert.equal(runtime.snapshot().weapons[0].ammo, 30);
  assert.equal(runtime.snapshot().weapons[0].reloadTicks, 0);
});
test('scatter hit accuracy is bounded per trigger rather than per pellet or victim', () => {
  const runtime = make({ loadout: ['scatter', 'autocannon'], activity: 'hunting' }, [
    target(0, { position: p(0, 12, -5000), health: 500, radius: 1000, height: 2200 }),
  ]);
  ticks(runtime, 15, { fire: true });
  const state = runtime.snapshot();
  assert.equal(state.shots, 1);
  assert.equal(state.hits, 1);
  assert.equal(state.accuracy, 1);
  assert.ok(state.actors[0].health < 500);
});
test('projectiles leave persistent supported surface impacts', () => {
  const runtime = make({ activity: 'hunting' });
  ticks(runtime, 5, { fire: true, nose: p(0, -1, -1) }, player(p(0, 2000, 0)));
  const state = runtime.snapshot({ includeImpacts: true });
  assert.ok(state.impactRecords.length);
  assert.equal(state.impactRecords[0].sourceId, 'floor');
  assert.equal(state.impactRecords[0].weapon, 'autocannon');
});
test('Hunting replacement waits four to eight accepted seconds and changes route position', () => {
  const runtime = make({ activity: 'hunting' }, [
    target(0, { path: [p(0, 12, -5000), p(5000, 12, -5000)] }),
  ]);
  const killed = impact(runtime).actors[0];
  assert.equal(killed.status, 'defeated');
  assert.ok(
    killed.replacementTick - killed.defeatedTick >= 200 &&
      killed.replacementTick - killed.defeatedTick <= 400,
  );
  ticks(runtime, killed.replacementTick - runtime.snapshot().ticks);
  assert.equal(runtime.snapshot().actors[0].status, 'defeated');
  step(runtime);
  const replacement = runtime.snapshot().actors[0];
  assert.equal(replacement.status, 'active');
  assert.notEqual(replacement.id, killed.id);
  assert.notDeepEqual(replacement.position, killed.position);
});
test('payload deployment, gravity, remote settling and detonation persist once', () => {
  const runtime = make({ activity: 'hunting', payload: 'remote' });
  step(runtime, { payload: true, commandSeq: 1 }, player(p(0, 2000, 0)));
  assert.equal(runtime.snapshot().payloadAmmo, 1);
  assert.equal(runtime.snapshot().ordnance.length, 1);
  ticks(runtime, 80, {}, player(p(0, 2000, 0)));
  assert.equal(runtime.snapshot().ordnance[0].settled, true);
  step(runtime, { detonate: true, commandSeq: 2 });
  assert.equal(runtime.snapshot().ordnance.length, 0);
  assert.ok(runtime.snapshot().events.some((e) => e.type === 'explosion'));
  step(runtime, { detonate: true, commandSeq: 2 });
  assert.equal(runtime.snapshot().events.filter((e) => e.type === 'explosion').length, 0);
});
test('blocked payload release consumes no ammunition', () => {
  const runtime = make({ payload: 'bomb' }, undefined, {
    ...ground,
    sweepStatic: (from, to) => ({ toi: 0.2, position: to, normal: p(0, 1) }),
  });
  step(runtime, { payload: true, commandSeq: 1 });
  assert.equal(runtime.snapshot().payloadAmmo, 3);
  assert.equal(runtime.snapshot().ordnance.length, 0);
});
test('Tactical reserve is finite and only pad refills it', () => {
  const runtime = make({ ammoPreset: 'tactical', activity: 'hunting' });
  edit(runtime, (s) => {
    s.weapons[0].ammo = 0;
    s.weapons[0].reserve = 0;
  });
  ticks(runtime, 100, { fire: true, nose: p(1) }, player(p(10000, 0, 10000)));
  assert.equal(runtime.snapshot().shots, 0);
  ticks(runtime, 250);
  assert.equal(runtime.snapshot().weapons[0].reserve, 90);
});
test('health pickups remain at full health, heal only living players, and reward count is unique', () => {
  const runtime = make({ activity: 'hunting' });
  edit(runtime, (s) => {
    s.pickups = [{ id: 'health', kind: 'health', position: p(), guarded: false, spawnTick: 0 }];
  });
  step(runtime);
  assert.equal(runtime.snapshot().pickups.length, 1);
  edit(runtime, (s) => {
    s.health = 80;
  });
  step(runtime);
  assert.equal(runtime.snapshot().health, 100);
  assert.equal(runtime.snapshot().pickups.length, 0);
});
test('Survival has stable slots over99, a reserved final slot and reversible admission', () => {
  const actors = Array.from({ length: 128 }, (_, i) =>
    target(i, {
      type: i === 127 ? 'vehicle' : 'patrol',
      position: p(((i % 16) - 8) * 3000, 12, -6000 - Math.floor(i / 16) * 3000),
    }),
  );
  const runtime = make({ activity: 'survival', population: 128 }, actors);
  assert.equal(runtime.snapshot().actors.length, 128);
  assert.equal(runtime.snapshot().actors[100].slotId, 'encounter-slot-101');
  assert.equal(runtime.snapshot().actors[127].status, 'waiting');
  const before = runtime.snapshot(),
    pending = runtime.prepare({ player: player() });
  runtime.cancel(pending.transaction);
  assert.deepEqual(runtime.snapshot(), before);
  const checkpoint = runtime.checkpoint(),
    restored = createEncounterRuntime(checkpoint.definition, { geometry: ground });
  restored.restore(checkpoint);
  assert.deepEqual(restored.snapshot(), { ...runtime.snapshot(), events: [] });
});
test('Timed Survival needs final defeat and time; ordinary survivors do not block completion', () => {
  const runtime = make({ activity: 'survival', population: 64 }, [
    target(0),
    target(1, { type: 'vehicle', position: p(10000, 12, -5000) }),
  ]);
  edit(runtime, (s) => {
    s.ticks = 15000;
    s.survival.nextFormationTick = 16000;
    s.survival.nextEliteTick = 16000;
    s.survival.nextSupplyTick = 16000;
  });
  step(runtime);
  assert.equal(runtime.snapshot().survival.finalSpawned, true);
  assert.equal(runtime.snapshot().actors.at(-1).special, 'final');
  edit(runtime, (s) => {
    s.ticks = 17999;
    s.actors.at(-1).health = 0;
    s.actors.at(-1).status = 'defeated';
    s.actors.at(-1).defeatedTick = 17999;
    s.actors.at(-1).replacementTick = 18200;
    s.survival.finalDefeated = true;
  });
  step(runtime);
  assert.equal(runtime.snapshot().status, 'complete');
  assert.equal(runtime.snapshot().result.reason, 'survival-complete');
  assert.equal(runtime.snapshot().actors[0].status, 'active');
});
test('Strike continues accepted ordnance aftermath and objective success beats drone death', () => {
  const runtime = make({ activity: 'strike', payload: 'drone' }, [
    target(0, { type: 'vehicle', health: 100, position: p(0, 12, -5000) }),
  ]);
  step(runtime, { payload: true, commandSeq: 1 });
  const result = step(runtime, { detonate: true, commandSeq: 2 }, player(p(0, 12, -4000)));
  assert.equal(result.health, 0);
  assert.equal(result.status, 'complete');
  assert.equal(result.result.reason, 'strike-complete');
  const crashing = make({ activity: 'strike' });
  step(crashing, {}, player(p(), { crashed: true }));
  assert.equal(crashing.snapshot().phase, 'aftermath');
  assert.equal(crashing.snapshot().status, 'active');
  ticks(crashing, 1000);
  assert.equal(crashing.snapshot().status, 'failed');
});
test('component damage provides protection counterplay and one reward per defeated actor', () => {
  const runtime = make({ activity: 'hunting', loadout: ['precision', 'autocannon'] }, [
    target(0, { family: 'shield-bearer', health: 100, position: p(0, 12, -4000) }),
  ]);
  ticks(runtime, 10, { fire: true, nose: p(0, 0, 1) }, player(p(0, 0, -8000)));
  assert.ok(runtime.snapshot().actors[0].componentMask & 1);
  assert.equal(runtime.snapshot().shots, 1);
  ticks(runtime, 50, { fire: true, nose: p(0, 0, 1) }, player(p(0, 0, -8000)));
  const state = runtime.snapshot();
  assert.equal(state.kills, 1);
  assert.equal(state.score, 100);
  assert.ok(state.hits <= state.shots);
});
test('v2 recovery round trips ammo, commands, impacts, pickups and corruption is rejected', () => {
  const runtime = make({ activity: 'hunting' });
  ticks(runtime, 10, { fire: true, nose: p(0, -1, -1) }, player(p(0, 2000, 0)));
  step(runtime, { reload: true, commandSeq: 3 });
  const checkpoint = runtime.checkpoint(),
    restored = createEncounterRuntime(checkpoint.definition, { geometry: ground });
  restored.restore(checkpoint);
  assert.deepEqual(restored.snapshot(), { ...runtime.snapshot(), events: [] });
  checkpoint.state.weapons[0].ammo = 1000;
  checkpoint.checksum = dataIdentity({
    definition: checkpoint.definition,
    state: checkpoint.state,
  });
  assert.throws(() => restored.restore(checkpoint), /weapon/i);
});

for (const ammoPreset of ['balanced', 'arcade', 'tactical']) {
  const weapons = ['autocannon', 'scatter', 'precision', 'rocket'];
  for (let first = 0; first < weapons.length; first++)
    for (let second = first + 1; second < weapons.length; second++) {
      const loadout = [weapons[first], weapons[second]];
      test(`${ammoPreset}: ${loadout.join(' + ')} defeats ordinary and armored targets with admitted ammunition`, () => {
        const runtime = make({ ammoPreset, loadout, playerDamage: 'invulnerable' }, [
          target(0, { position: p(-4000, 12, -6000) }),
          target(1, {
            type: 'vehicle',
            vehicleModel: 'armored-carrier',
            position: p(4000, 12, -6000),
            health: 100,
          }),
        ]);
        for (let index = 0; index < 2; index++) {
          step(runtime, { switchWeapon: index, commandSeq: index + 1 });
          let state = runtime.snapshot();
          const actor = state.actors[index],
            direction = p(
              actor.position.x,
              actor.position.y + actor.height / 2 - 220,
              actor.position.z,
            );
          for (
            let tick = 0;
            tick < 600 && state.status === 'active' && state.actors[index].status === 'active';
            tick++
          )
            state = step(runtime, { fire: true, nose: direction });
          assert.equal(
            state.actors[index].status,
            'defeated',
            `${loadout[index]} exhausted or ineffective`,
          );
        }
        assert.equal(runtime.snapshot().status, 'complete');
        assert.equal(runtime.snapshot().kills, 2);
        assert.ok(runtime.snapshot().hits <= runtime.snapshot().shots);
      });
    }
}

test('accepted Survival thresholds, formation relief, support cap and supply times are deterministic', () => {
  const targets = Array.from({ length: 64 }, (_, i) =>
    target(i, {
      type: i === 63 ? 'vehicle' : 'patrol',
      position: p(((i % 8) - 4) * 3500, 12, -6000 - Math.floor(i / 8) * 3500),
    }),
  );
  const runtime = make(
    { activity: 'survival', population: 64, playerDamage: 'invulnerable' },
    targets,
  );
  assert.equal(runtime.snapshot().actors.filter((a) => a.status === 'active').length, 25);
  edit(runtime, (s) => {
    s.ticks = 2999;
  });
  step(runtime);
  assert.equal(runtime.snapshot().survival.pressure, 0.65);
  assert.notEqual(runtime.snapshot().survival.formation, 'advance');
  edit(runtime, (s) => {
    s.ticks = 4499;
  });
  step(runtime);
  assert.equal(runtime.snapshot().pickups.filter((p) => p.guarded).length, 1);
  edit(runtime, (s) => {
    s.ticks = 5999;
  });
  step(runtime);
  assert.ok(runtime.snapshot().actors.some((a) => a.special === 'elite'));
  assert.equal(runtime.snapshot().survival.pressure, 0.85);
  edit(runtime, (s) => {
    s.ticks = 11999;
  });
  step(runtime);
  assert.equal(runtime.snapshot().survival.pressure, 1);
  edit(runtime, (s) => {
    s.ticks = 14999;
  });
  step(runtime);
  assert.equal(runtime.snapshot().survival.finalSpawned, true);
  assert.equal(runtime.snapshot().actors.at(-1).special, 'final');
});
test('Endless continues after six minutes while Timed stops ordinary arrivals', () => {
  for (const survivalMode of ['timed', 'endless']) {
    const runtime = make(
      { activity: 'survival', survivalMode, population: 64, playerDamage: 'invulnerable' },
      [target(0), target(1), target(2, { type: 'vehicle', position: p(10000, 12, -5000) })],
    );
    edit(runtime, (s) => {
      s.ticks = 17999;
      s.survival.nextFormationTick = 30000;
      s.survival.reliefUntil = 0;
      s.survival.nextSpawnTick = 0;
      s.survival.nextEliteTick = 30000;
    });
    step(runtime);
    assert.equal(runtime.snapshot().status, 'active');
    const count = runtime.snapshot().nextSpawn;
    ticks(runtime, 50);
    if (survivalMode === 'timed') assert.equal(runtime.snapshot().nextSpawn, count);
    else assert.ok(runtime.snapshot().actors.filter((a) => a.status === 'active').length >= 2);
  }
});
test('Strike commit-time crash retains already deployed bomb and accepts delayed objective success', () => {
  const runtime = make({ activity: 'strike', payload: 'bomb' }, [
    target(0, { type: 'vehicle', position: p(0, 12, -5000), health: 50 }),
  ]);
  const at = player(p(0, 2500, -5000));
  step(runtime, { payload: true, commandSeq: 1 }, at);
  const proposal = runtime.prepare({ player: at });
  runtime.commit({ transaction: proposal.transaction, player: { ...at, crashed: true } });
  assert.equal(runtime.snapshot().phase, 'aftermath');
  assert.equal(runtime.snapshot().status, 'active');
  ticks(runtime, 100, {}, { ...at, crashed: true });
  assert.equal(runtime.snapshot().status, 'complete');
  assert.equal(runtime.snapshot().result.reason, 'strike-complete');
});
test('crossing projectiles are tested against swept actor bounds in the broadphase', () => {
  const runtime = make({ activity: 'hunting', loadout: ['precision', 'scatter'] }, [
    target(0, { position: p(0, 12, -9000), health: 50 }),
  ]);
  ticks(runtime, 10, { fire: true });
  assert.equal(runtime.snapshot().kills, 1);
});
test('surface archive stays outside ordinary snapshots and restores without replay effects', () => {
  const runtime = make({ activity: 'hunting' });
  ticks(runtime, 8, { fire: true, nose: p(0, -1, -1) }, player(p(0, 2000, 0)));
  assert.equal(runtime.snapshot().impactRecords, undefined);
  assert.ok(runtime.impacts().length > 0);
  const restored = createEncounterRuntime(runtime.checkpoint().definition, { geometry: ground });
  restored.restore(runtime.checkpoint());
  assert.deepEqual(restored.impacts(), runtime.impacts());
  assert.deepEqual(restored.snapshot().events, []);
});
test('v2 rejects forged actor attack powers, component grants and ordinary-game victory with a live roster', () => {
  const runtime = make();
  for (const mutate of [
    (s) => {
      s.actors[0].damage = 999;
    },
    (s) => {
      s.actors[0].components[0].maxHealth = 999;
    },
    (s) => {
      s.status = 'complete';
      s.result = { reason: 'targets-cleared', tick: s.ticks, kills: s.kills, score: s.score };
    },
  ]) {
    const record = runtime.checkpoint();
    mutate(record.state);
    record.checksum = dataIdentity({ definition: record.definition, state: record.state });
    assert.throws(() => runtime.restore(record));
  }
});

test('repeated Hunting lives alternate distinct admitted route points, including duplicate route anchors', () => {
  const runtime = make({ activity: 'hunting', playerDamage: 'invulnerable' }, [
    target(0, { path: [p(0, 12, -5000), p(5000, 12, -5000)] }),
  ]);
  const positions = [];
  for (let life = 0; life < 4; life++) {
    positions.push(runtime.snapshot().actors[0].position);
    const defeated = impact(runtime).actors[0];
    ticks(runtime, defeated.replacementTick - runtime.snapshot().ticks + 1);
  }
  for (let i = 1; i < positions.length; i++) assert.notDeepEqual(positions[i], positions[i - 1]);
});
test('final UAV attack has an advertised windup, finite salvo and recovery interval', () => {
  const runtime = make({ activity: 'survival', population: 64, playerDamage: 'invulnerable' }, [
    target(0),
    target(1, { type: 'hazard', position: p(10000, 2000, -5000), fireEveryTicks: 0 }),
  ]);
  edit(runtime, (s) => {
    s.ticks = 14999;
    s.survival.nextFormationTick = 20000;
    s.survival.nextEliteTick = 20000;
    s.survival.nextSupplyTick = 20000;
  });
  step(runtime);
  assert.equal(runtime.snapshot().actors.at(-1).warning, true);
  let fired = 0;
  for (let i = 0; i < 180; i++) {
    const result = step(runtime);
    fired += result.events.filter(
      (e) => e.type === 'fire' && e.actor === result.actors.at(-1).id,
    ).length;
  }
  assert.ok(fired > 0 && fired <= 3);
  for (let i = 0; i < 50; i++)
    assert.equal(
      step(runtime).events.some((e) => e.type === 'fire'),
      false,
    );
});

test('Survival pursues the player and falls back to its route when pursuit has no support', () => {
  const targets = [
    target(0, {
      position: p(0, 12, -5000),
      path: [p(0, 12, -8000)],
      speed: 1500,
      fireEveryTicks: 100,
    }),
    target(1, { type: 'vehicle', position: p(10000, 12, -5000) }),
  ];
  const runtime = make({ activity: 'survival', population: 64 }, targets);
  const first = runtime.snapshot().actors[0].position;
  ticks(runtime, 10);
  assert.ok(runtime.snapshot().actors[0].position.z > first.z);
  const gapGeometry = {
    ...ground,
    surface: (position) => (position.z > -5000 ? null : ground.surface(position)),
  };
  const stopped = make({ activity: 'survival', population: 64 }, targets, gapGeometry);
  ticks(stopped, 10);
  assert.ok(stopped.snapshot().actors[0].position.z <= -5000);
  assert.equal(stopped.snapshot().actors[0].position.y, 12);
  const saved = stopped.checkpoint();
  stopped.restore(saved);
  assert.deepEqual(stopped.checkpoint().state.actors, saved.state.actors);
});

test('Survival validates full-height pursuit clearance and rejected steps do not move actors', () => {
  const targets = [
    target(0, {
      position: p(0, 12, -5000),
      path: [p(0, 12, -8000)],
      speed: 1500,
      fireEveryTicks: 100,
    }),
    target(1, { type: 'vehicle', position: p(10000, 12, -5000) }),
  ];
  let highSweeps = 0;
  const geometry = {
    ...ground,
    sweepStatic: (from, to, radius) => {
      if (from.y > 1000 && to.z > from.z) {
        highSweeps++;
        return { toi: 0, position: from, normal: p(0, 0, -1) };
      }
      return ground.sweepStatic(from, to, radius);
    },
  };
  const runtime = make({ activity: 'survival', population: 64 }, targets, geometry);
  const before = runtime.snapshot();
  const proposal = runtime.prepare({ player: player() });
  assert.deepEqual(runtime.snapshot(), before);
  runtime.cancel(proposal.transaction);
  assert.deepEqual(runtime.snapshot(), before);
  step(runtime);
  assert.ok(highSweeps > 0);
  assert.ok(runtime.snapshot().actors[0].position.z <= -5000);
});

test('Survival keeps readable ground lanes and UAV height bands around a stationary player', () => {
  const targets = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * Math.PI) / 6,
      airborne = i >= 6;
    const position = p(
      Math.round(Math.sin(angle) * 18000),
      airborne ? 5000 : 12,
      Math.round(Math.cos(angle) * 18000),
    );
    return target(i, {
      type: airborne ? 'drone' : 'patrol',
      position,
      path: [{ ...position, x: position.x + 500 }],
      speed: 3000,
    });
  });
  targets.push(target(12, { type: 'vehicle', position: p(30000, 12, -30000) }));
  const runtime = make(
    { activity: 'survival', population: 64, playerDamage: 'invulnerable' },
    targets,
  );
  edit(runtime, (s) => {
    for (const a of s.actors.slice(0, -1)) a.status = 'active';
    s.survival.nextFormationTick = 3000;
  });
  const initial = runtime.checkpoint();
  const at = player(p(0, 5000, 0));
  ticks(runtime, 800, {}, at);
  const actors = runtime.snapshot().actors.filter((a) => a.status === 'active');
  assert.equal(actors.length, 12, 'Crowd detail cannot hide or reduce the active roster');
  const drones = actors.filter((a) => a.type === 'drone');
  assert.ok(
    Math.max(...drones.map((a) => a.position.y)) - Math.min(...drones.map((a) => a.position.y)) >
      1500,
    'UAVs need distinct altitude bands',
  );
  for (let i = 0; i < actors.length; i++)
    for (const b of actors.slice(i + 1)) {
      const a = actors[i];
      if (a.type === 'patrol' && b.type === 'patrol')
        assert.ok(
          Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) >=
            a.radius + b.radius + 300,
          'Troop silhouettes overlap',
        );
      if (a.type === 'drone' && b.type === 'drone')
        assert.ok(
          Math.hypot(
            a.position.x - b.position.x,
            a.position.y - b.position.y,
            a.position.z - b.position.z,
          ) >=
            a.radius + b.radius + 650,
          'Rotor silhouettes overlap',
        );
    }
  const repeated = make(
    { activity: 'survival', population: 64, playerDamage: 'invulnerable' },
    targets,
  );
  repeated.restore(initial);
  ticks(repeated, 800, {}, at);
  assert.deepEqual(repeated.checkpoint().state.actors, runtime.checkpoint().state.actors);
});

test('crowd separation uses overlapping upright bodies rather than only their centres', () => {
  const runtime = make({ activity: 'survival', population: 64 }, [
    target(0, {
      position: p(0, 12, -5000),
      height: 4200,
      radius: 180,
      path: [p(0, 12, -8000)],
      speed: 1500,
      fireEveryTicks: 100,
    }),
    target(1, { type: 'prop', position: p(0, 12, -4500), height: 300, radius: 200 }),
    target(2, { type: 'vehicle', position: p(20000, 12, -5000) }),
  ]);
  edit(runtime, (s) => {
    s.actors[1].status = 'active';
  });
  const before = runtime.snapshot().actors[0].position.z;
  ticks(runtime, 10);
  assert.ok(
    runtime.snapshot().actors[0].position.z <= before,
    'Tall troops must not walk through a short ground robot',
  );
});

test('older v2 definitions retain their exact legacy crowd motion and identity', () => {
  const d = definition({ activity: 'survival', population: 64 }, [
    target(0, { position: p(0, 12, -5000), path: [p(0, 12, -8000)], speed: 1500 }),
    target(1, { type: 'vehicle', position: p(10000, 12, -5000) }),
  ]);
  assert.equal(d.crowdModel, 'squad-lanes-v1');
  delete d.crowdModel;
  const identity = dataIdentity(d);
  assert.equal(dataIdentity(validateEncounterDefinition(d)), identity);
  const runtime = createEncounterRuntime(d, { geometry: ground });
  ticks(runtime, 50);
  assert.deepEqual(runtime.snapshot().actors[0].position, p(0, 12, -3500));
  assert.equal(Object.hasOwn(runtime.checkpoint().definition, 'crowdModel'), false);
  const bad = { ...d, crowdModel: 'unknown' };
  assert.throws(() => validateEncounterDefinition(bad), /crowd model/);
});

test('contact-only UAVs retain a staggered attack approach through their stand-off lanes', () => {
  const runtime = make({ activity: 'survival', population: 64 }, [
    target(1, { type: 'vehicle', position: p(30000, 12, 30000) }),
    target(0, {
      type: 'drone',
      position: p(0, 4600, -1200),
      path: [p(0, 4600, -3000)],
      speed: 3000,
      radius: 400,
    }),
  ]);
  const at = player(p(0, 5000, 0));
  let closest = Infinity;
  for (let i = 0; i < 50; i++) {
    const state = step(runtime, {}, at);
    const a = state.actors[0];
    closest = Math.min(
      closest,
      Math.hypot(a.position.x, a.position.y + a.radius - 5000, a.position.z),
    );
  }
  assert.ok(closest <= 620, 'Contact-only actors must be able to reach the aircraft');
  assert.equal(runtime.snapshot().health, 100, 'New enemies retain their two-second spawn grace');
  ticks(runtime, 50, {}, at);
  assert.equal(runtime.snapshot().health, 100);
  ticks(runtime, 30, {}, at);
  assert.ok(
    runtime.snapshot().health < 100,
    'Approach must preserve incoming pressure after spawn grace',
  );
});

test('slow contact rovers cross their outer lane after a readable warning under shield-front pressure', () => {
  const runtime = make({ activity: 'survival', population: 64 }, [
    target(0, {
      type: 'prop',
      position: p(0, 12, -6000),
      path: [p(0, 12, -8000)],
      speed: 600,
      radius: 350,
    }),
    target(2, { position: p(-30000, 12, -30000) }),
    target(1, { type: 'vehicle', position: p(30000, 12, 30000) }),
  ]);
  edit(runtime, (s) => {
    s.ticks = 500;
    const rover = s.actors.find((a) => a.type === 'prop');
    rover.position = p(0, 12, -3200);
    rover.status = 'active';
    s.survival.formation = 'shield-front';
    s.survival.nextFormationTick = 3000;
  });
  const at = player(p(0, 362, 0));
  const initial = runtime.snapshot().actors.find((a) => a.type === 'prop').position;
  const first = step(runtime, {}, at);
  assert.equal(first.actors.find((a) => a.type === 'prop').warning, true);
  assert.deepEqual(first.actors.find((a) => a.type === 'prop').position, initial);
  ticks(runtime, 24, {}, at);
  assert.deepEqual(runtime.snapshot().actors.find((a) => a.type === 'prop').position, initial);
  ticks(runtime, 475, {}, at);
  assert.ok(
    runtime.snapshot().health < 100,
    'A 0.6 m/s rover slowed by formation still needs to close from its outer lane',
  );
});

test('actual native wall hits publish finite positions and unit normals for surface effects', async () => {
  await initWorldRuntime();
  const course = {
    id: 'wall-test',
    bounds: { min: p(-10000, 0, -10000), max: p(10000, 10000, 10000) },
    spawn: p(),
    obstacles: [{ id: 'wall', type: 'box', min: p(-10000, 0, -3500), max: p(10000, 10000, -3000) }],
    actors: [],
  };
  const geometry = createNativeEncounterGeometry(course);
  const runtime = make({ activity: 'hunting' }, [target()], geometry);
  try {
    ticks(runtime, 6, { fire: true }, player(p(0, 1200, 0)));
    const event = runtime.impacts().find((e) => e.sourceId === 'wall');
    assert.ok(event);
    assert.ok(Object.values(event.position).every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...Object.values(event.normal)) - 1) < 1e-9);
    assert.deepEqual(event.surface.position, event.position);
  } finally {
    geometry.dispose();
  }
});

test('regional hit normalization, full-area coverage and airborne hazard admission share exact geometry', () => {
  let covered = true;
  const query = {
    ready: () => true,
    motionCoverage: () => ({ status: covered ? 'motion-covered' : 'unknown-cell' }),
    castMotion: () => ({ status: 'motion-clear' }),
    support: () => ({ status: 'terrain-hit', heightMm: 0, normal: p(0, 1), chunkId: 'ground' }),
  };
  const geometry = createRegionalEncounterGeometry(query, {
    bounds: { min: p(-10000, 0, -10000), max: p(10000, 10000, 10000) },
    player: p(),
  });
  assert.equal(geometry.ready(), true);
  covered = false;
  assert.equal(geometry.ready(), false);
  const hazard = {
    ...target(0, { type: 'hazard', position: p(5000, 2500, 0) }),
    radius: 350,
    height: 700,
  };
  assert.equal(geometry.admitActor(hazard).position.y, 2500);
  query.castMotion = () => ({
    status: 'motion-hit',
    hit: { id: 'wall', toi: 0.5, normal: p(0, 0, 1000000) },
  });
  const hit = geometry.sweepStatic(p(0, 1000, 0), p(0, 1000, -2000));
  assert.deepEqual(hit.position, p(0, 1000, -1000));
  assert.deepEqual(hit.normal, p(0, 0, 1));
});

test('unavailable geometry rejects prepare or commit without consuming state, ammo or command identity', () => {
  let ready = false,
    unavailable = false;
  const runtime = make({}, undefined, {
    ...ground,
    ready: () => ready,
    sweepStatic: (...args) => (unavailable ? { unavailable: true } : ground.sweepStatic(...args)),
  });
  const before = runtime.snapshot();
  assert.equal(
    runtime.prepare({ player: player(), input: { fire: true } }).rejected,
    'geometry-unavailable',
  );
  assert.deepEqual(runtime.snapshot(), before);
  ready = true;
  const proposal = runtime.prepare({
    player: player(),
    input: { fire: true, switchWeapon: 1, commandSeq: 1 },
  });
  unavailable = true;
  const result = runtime.commit({ transaction: proposal.transaction, player: player() });
  assert.equal(result.rejected, 'geometry-unavailable');
  assert.deepEqual(runtime.snapshot(), before);
  unavailable = false;
  step(runtime, { switchWeapon: 1, commandSeq: 1 });
  assert.equal(runtime.snapshot().lastCommandSeq, 1);
});

test('earned aerial supplies settle on supported ground and wait when support is unavailable', () => {
  for (const initiallySupported of [true, false]) {
    let supported = initiallySupported;
    const runtime = make(
      { activity: 'hunting', playerDamage: 'invulnerable' },
      [0, 1, 2].map((i) => target(i, { type: 'drone', position: p(i * 5000, 5000, -5000) })),
      { ...ground, surface: (...args) => (supported ? ground.surface(...args) : null) },
    );
    for (let i = 0; i < 3; i++) impact(runtime, i);
    let state = runtime.snapshot();
    assert.equal(state.pickups.length, initiallySupported ? 1 : 0);
    if (!initiallySupported) {
      assert.equal(state.pendingPickups.length, 1);
      supported = true;
      step(runtime);
      state = runtime.snapshot();
    }
    assert.equal(state.pickups[0].position.y, 12);
    assert.equal(state.pickups[0].surfacePending, false);
    const saved = runtime.checkpoint();
    runtime.restore(saved);
    assert.deepEqual(runtime.snapshot().pickups, saved.state.pickups);
  }
});

test('Arcade payload recharge restarts on deployment and never consumes a second armed drone charge', () => {
  const runtime = make({ activity: 'hunting', ammoPreset: 'arcade', payload: 'bomb' });
  ticks(runtime, 552);
  step(runtime, { payload: true, commandSeq: 1 }, player(p(0, 2000)));
  assert.equal(runtime.snapshot().payloadAmmo, 2);
  step(runtime, {}, player(p(0, 2000)));
  assert.equal(
    runtime.snapshot().payloadAmmo,
    2,
    'Previously idle timer must not refill the spent bomb immediately',
  );
  const drone = make({ activity: 'hunting', ammoPreset: 'arcade', payload: 'drone' });
  step(drone, { payload: true, commandSeq: 1 });
  ticks(drone, 552);
  assert.equal(drone.snapshot().payloadArmed, true);
  assert.equal(drone.snapshot().payloadAmmo, 1);
  step(drone, { payload: true, commandSeq: 2 });
  assert.equal(
    drone.snapshot().payloadAmmo,
    1,
    'An already armed charge cannot consume replenished ammunition',
  );
});
test('accepted physical destruction overrides a simultaneous Elimination victory', () => {
  const runtime = make({ activity: 'elimination', difficulty: 'easy' });
  const actor = runtime.snapshot().actors[0],
    before = player(actor.position),
    proposal = runtime.prepare({ player: before, input: {} });
  const state = runtime.commit({
    transaction: proposal.transaction,
    player: { ...before, crashed: true },
    contacts: [{ actorId: actor.slotId, normal: p(1), relativeNormalSpeedMmS: 20000 }],
  });
  assert.equal(state.kills, 1);
  assert.equal(state.health, 0);
  assert.equal(state.status, 'failed');
  assert.equal(state.result.reason, 'player-defeated');
});

test('smaller Survival population preserves its reserved final enemy and nonempty opening roster', () => {
  const targets = Array.from({ length: 128 }, (_, i) =>
    target(i, {
      type: i === 127 ? 'vehicle' : 'patrol',
      position: p(((i % 16) - 8) * 3000, 12, -6000 - Math.floor(i / 16) * 3000),
    }),
  );
  const authored = definition({ activity: 'survival', population: 128 }, targets),
    selected = validateEncounterDefinition({ ...authored, population: 64 });
  const runtime = createEncounterRuntime(selected, { geometry: ground });
  assert.equal(runtime.checkpoint().definition.actors.length, 128);
  assert.equal(runtime.snapshot().actors.length, 64);
  assert.equal(runtime.snapshot().actors.at(-1).sourceId, authored.actors.at(-1).id);
  assert.equal(runtime.snapshot().actors.at(-1).type, 'vehicle');
  assert.ok(runtime.snapshot().actors.some((a) => a.status === 'active' && a.type !== 'prop'));
  assert.throws(
    () => definition({ activity: 'survival', population: 64 }, [target(0, { type: 'drone' })]),
    /separate ordinary target/,
  );
});

test('Advanced muzzle obstruction starts at the admitted aircraft centre instead of its bounding radius', () => {
  const queries = [];
  const runtime = make({ activity: 'hunting' }, undefined, {
    ...ground,
    sweepStatic(from, to, radius) {
      queries.push({ from, to, radius });
      return null;
    },
  });
  const at = player(p(0, 1000), { radius: 500, supportHeight: 90 });
  step(runtime, { fire: true, nose: p(0, 0, -1), muzzle: p(0, 1090, -540) }, at);
  assert.ok(queries.some((q) => q.from.y === 1090 && q.to.z === -540));
});

test('regional service pads resolve supported floors below an airborne restart and retain exact identities', () => {
  const query = {
    castMotion: () => ({ status: 'motion-clear' }),
    support: () => ({
      status: 'terrain-hit',
      heightMm: 2000,
      normal: p(0, 1),
      chunkId: 'elevated-floor',
    }),
  };
  const geometry = createRegionalEncounterGeometry(query, {
    bounds: { min: p(-50000, 0, -50000), max: p(50000, 80000, 50000) },
    player: p(0, 40000),
  });
  assert.equal(geometry.area.min.y, 2000);
  assert.deepEqual(geometry.admitServicePad(p(0, 40000)), p(0, 2000));
  assert.deepEqual(geometry.admitServicePad(p(0, 2000), { exact: true }), p(0, 2000));
  assert.equal(geometry.admitServicePad(p(0, 40000), { exact: true }), null);
  query.castMotion = () => ({ status: 'unknown-cell' });
  assert.equal(geometry.admitServicePad(p(0, 40000)), null);
});

test('Tactical rejects missing service support and preserves a validated pad through recovery', () => {
  assert.throws(
    () => definition({ ammoPreset: 'tactical', admitServicePad: () => null }),
    /supported, reachable service pad/,
  );
  const source = definition({ ammoPreset: 'tactical', admitServicePad: () => p(5000) });
  assert.deepEqual(source.servicePad, p(5000));
  const runtime = createEncounterRuntime(source, { geometry: ground });
  edit(runtime, (s) => {
    s.weapons[0].ammo = 0;
  });
  ticks(runtime, 250, {}, player());
  assert.equal(
    runtime.snapshot().weapons[0].ammo,
    0,
    'former airborne/spawn location is not a pad',
  );
  ticks(runtime, 250, {}, player(p(5000)));
  assert.equal(runtime.snapshot().weapons[0].reserve, 90);
  step(runtime, { reload: true });
  ticks(runtime, 90);
  assert.equal(runtime.snapshot().weapons[0].ammo, 30);
  const saved = runtime.checkpoint();
  runtime.restore(saved);
  assert.deepEqual(runtime.checkpoint().definition, saved.definition);
  assert.deepEqual(runtime.snapshot().weapons, saved.state.weapons);
  assert.throws(
    () =>
      prepareEncounterDefinition({
        authored: source,
        baseIdentity: source.baseIdentity,
        selection: { version: 2, ammoPreset: 'tactical' },
        admitServicePad: () => null,
      }),
    /saved service pad/,
  );
});

test('native service admission grounds an elevated launch and rejects unsupported pads', async () => {
  await initWorldRuntime();
  const course = {
    id: 'pad-test',
    spawn: p(0, 9000),
    bounds: { min: p(-10000, 0, -10000), max: p(10000, 15000, 10000) },
    actors: [],
    obstacles: [{ id: 'deck', type: 'box', min: p(-5000, 0, -5000), max: p(5000, 3000, 5000) }],
  };
  const geometry = createNativeEncounterGeometry(course);
  try {
    assert.deepEqual(geometry.admitServicePad(course.spawn), p(0, 3000));
    assert.equal(geometry.admitServicePad(p(0, 9000), { exact: true }), null);
  } finally {
    geometry.dispose();
  }
});

test('uncovered muzzle and payload release block only weapons, without consuming ammo or the accepted interval', () => {
  const source = definition({ activity: 'hunting' });
  const geometry = {
    ...ground,
    sweepStatic(from, to, radius) {
      assert.ok(
        from.x >= source.bounds.min.x + radius && to.x >= source.bounds.min.x + radius,
        'uncovered x query',
      );
      assert.ok(
        from.z >= source.bounds.min.z + radius && to.z >= source.bounds.min.z + radius,
        'uncovered z query',
      );
      return ground.sweepStatic(from, to, radius);
    },
  };
  const runtime = createEncounterRuntime(source, { geometry });
  const position = p(source.bounds.min.x + 50, 2000, source.bounds.min.z + 50);
  const before = runtime.snapshot();
  const state = step(runtime, { fire: true, payload: true, commandSeq: 1 }, player(position));
  assert.equal(state.ticks, before.ticks + 1);
  assert.equal(state.weapons[0].ammo, before.weapons[0].ammo);
  assert.equal(state.payloadAmmo, before.payloadAmmo);
  assert.equal(state.lastCommandSeq, 1);
  assert.ok(state.events.some((e) => e.type === 'weapon-blocked'));
  runtime.restore(runtime.checkpoint());
});

test('payload and secondary explosions never create a null shot identity or invalidate recovery', () => {
  const runtime = make({ activity: 'hunting', payload: 'drone' }, [
    target(0, { position: p(0, 12, -4000), health: 20 }),
    target(1, { type: 'vehicle', position: p(0, 12, -7000), health: 20 }),
  ]);
  step(runtime, { payload: true, commandSeq: 1 });
  const state = step(runtime, { detonate: true, commandSeq: 2 });
  assert.ok(state.kills >= 1);
  assert.equal(state.shots, 0);
  assert.equal(state.hits, 0);
  assert.deepEqual(state.attackHits, []);
  runtime.restore(runtime.checkpoint());
});

test('a rocket blocked at its muzzle counts its splash victims as one trigger hit', () => {
  const runtime = make(
    { activity: 'hunting', loadout: ['rocket', 'autocannon'] },
    [target(0, { position: p(0, 12, -4000), health: 100 })],
    {
      ...ground,
      sweepStatic(from, to, radius) {
        if (from.z === 0 && to.z < 0)
          return {
            toi: 0.5,
            position: p(0, 220, -130),
            normal: p(0, 0, 1),
            surfaceId: 'muzzle-cover',
          };
        return ground.sweepStatic(from, to, radius);
      },
    },
  );
  const state = step(runtime, { fire: true });
  assert.equal(state.shots, 1);
  assert.equal(state.hits, 1);
  assert.deepEqual(state.attackHits, [1]);
  runtime.restore(runtime.checkpoint());
});

test('surface marks use the actual wall contact, not the swept projectile centre', async () => {
  await initWorldRuntime();
  const course = {
    id: 'rocket-mark',
    bounds: { min: p(-10000, 0, -10000), max: p(10000, 10000, 10000) },
    spawn: p(),
    actors: [],
    obstacles: [
      { id: 'rocket-wall', type: 'box', min: p(-10000, 0, -3500), max: p(10000, 10000, -3000) },
    ],
  };
  const geometry = createNativeEncounterGeometry(course);
  const runtime = make(
    { activity: 'hunting', loadout: ['rocket', 'autocannon'] },
    [target()],
    geometry,
  );
  try {
    ticks(runtime, 12, { fire: true }, player(p(0, 1200)));
    const mark = runtime.impacts().find((e) => e.sourceId === 'rocket-wall');
    assert.ok(mark);
    assert.ok(Math.abs(mark.position.z + 3000) <= 2, 'mark lands on wall plane');
    assert.deepEqual(mark.surface.position, mark.position);
    runtime.restore(runtime.checkpoint());
  } finally {
    geometry.dispose();
  }
});

test('impact self-damage uses actual inflicted health rather than overkill power', () => {
  for (const [difficulty, expected] of [
    ['normal', 98],
    ['hard', 95],
  ]) {
    const runtime = make({ difficulty }, [target(0, { health: 20 })]);
    const state = impact(runtime);
    assert.equal(state.kills, 1);
    assert.equal(state.health, expected);
    runtime.restore(runtime.checkpoint());
  }
});

test('v2 native admission rejects sealed targets but accepts a visible supported route point', async () => {
  await initWorldRuntime();
  const base = {
    id: 'attack-position',
    bounds: { min: p(-10000, 0, -10000), max: p(10000, 10000, 10000) },
    spawn: p(-5000),
    actors: [],
  };
  const actor = {
    ...target(0, { position: p(5000), path: [p(5000, 0, 5000)] }),
    radius: 350,
    height: 1800,
  };
  for (const sealed of [true, false]) {
    const course = {
      ...base,
      obstacles: [
        {
          id: 'wall',
          type: 'box',
          min: p(-250, 0, sealed ? -10000 : -2000),
          max: p(250, 10000, sealed ? 10000 : 2000),
        },
      ],
    };
    const geometry = createNativeEncounterGeometry(course);
    try {
      assert.ok(geometry.admitActor(actor), 'historical v1 geometry remains unchanged');
      assert.equal(Boolean(geometry.admitActor(actor, { requireAttackPosition: true })), !sealed);
    } finally {
      geometry.dispose();
    }
  }
});

test('v2 regional admission proves a firing line to at least one complete supported route point', () => {
  const query = {
    support: () => ({ status: 'terrain-hit', heightMm: 0, normal: p(0, 1), chunkId: 'floor' }),
    castMotion(from, movement, radius) {
      return radius === 1 && from.z + movement.z > 3000
        ? { status: 'motion-hit', hit: { toi: 0.5, normal: p(0, 0, -1) } }
        : { status: 'motion-clear' };
    },
  };
  const geometry = createRegionalEncounterGeometry(query, {
    bounds: { min: p(-30000, 0, -30000), max: p(30000, 30000, 30000) },
    player: p(-10000, 1000, -10000),
  });
  const hidden = { ...target(0, { position: p(0, 0, 5000) }), radius: 350, height: 1800 };
  assert.ok(geometry.admitActor(hidden));
  assert.equal(geometry.admitActor(hidden, { requireAttackPosition: true }), null);
  assert.ok(
    geometry.admitActor(
      { ...hidden, path: [p(0, 0, 5000), p(0, 0, 2000)] },
      { requireAttackPosition: true },
    ),
  );
});
