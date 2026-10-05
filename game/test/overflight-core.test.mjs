import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  pauseOverflight,
  resumeOverflight,
  chooseOverflightUpgrade,
  rerollOverflightUpgrades,
  spawnOverflightEnemy,
  damageOverflightArea,
  dropOverflightSalvage,
  overflightSummary,
  OVERFLIGHT_STEP,
} from '../overflight/core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import {
  createOverflightBuild,
  overflightPayload,
  legalOverflightUpgrades,
  draftOverflightUpgrades,
  applyOverflightUpgrade,
  overflightBuildItems,
} from '../overflight/upgrades.mjs';
import { DEFAULT_OVERFLIGHT_PROJECT, compileOverflightProject } from '../overflight/project.mjs';

const compiled = compileOverflightProject(DEFAULT_OVERFLIGHT_PROJECT);
const quiet = (options = {}) => {
  const source = structuredClone(compiled);
  source.encounters = [];
  source.goals = { eliteAt: 10000, finalAt: 20000, finalHp: 2400 };
  Object.assign(source, options);
  return source;
};
const playing = (source = quiet(), options = {}) => {
  const run = createOverflightRun(source, options);
  startOverflight(run);
  return run;
};
const steps = (run, count, input = {}) => {
  for (let index = 0; index < count; index++) stepOverflight(run, input);
};
const rebuild = (run) => rebuildOverflightGrid(run._grid, run.enemies);
const spawn = (run, options = {}) =>
  spawnOverflightEnemy(run, { warning: 0, speed: 0, ...options });
const offer = (build, id) =>
  legalOverflightUpgrades(build, compiled.upgrades.modules).find((card) => card.id === id);
const apply = (build, id) =>
  assert.equal(applyOverflightUpgrade(build, offer(build, id), compiled.upgrades.modules), true);

// These white-box assertions target physical/accounting contracts, not rendering.
test('explicit start, fixed ticks, paused upgrades, and confirm/boost release', () => {
  const run = createOverflightRun(quiet());
  stepOverflight(run, { x: 1, boost: true });
  assert.equal(run.tick, 0);
  assert.equal(startOverflight(run), true);
  assert.equal(startOverflight(run), false);
  assert.throws(() => stepOverflight(run, {}, 1 / 30), /fixed/);
  steps(run, 10, { x: 1 });
  const x = run.player.x;
  pauseOverflight(run);
  steps(run, 20, { x: 1, boost: true });
  assert.equal(run.tick, 10);
  assert.equal(run.player.x, x);
  resumeOverflight(run);
  dropOverflightSalvage(run, run.player.x, run.player.y, 12);
  stepOverflight(run);
  assert.equal(run.phase, 'upgrade');
  const tick = run.tick;
  pauseOverflight(run);
  resumeOverflight(run);
  assert.equal(run.phase, 'upgrade');
  steps(run, 10, { boost: true });
  assert.equal(run.tick, tick);
  assert.equal(chooseOverflightUpgrade(run, 'no-such-card'), false);
  assert.equal(chooseOverflightUpgrade(run, run.offers[0].id), true);
  stepOverflight(run, { boost: true });
  assert.equal(run.stats.boostsUsed, 0);
  stepOverflight(run, { boost: false });
  stepOverflight(run, { boost: true });
  assert.equal(run.stats.boostsUsed, 1);
});

test('approved primary payload keeps release distance, delay, radius and damage', () => {
  const run = playing();
  assert.deepEqual(overflightPayload(run.build), {
    cooldown: 1.2,
    damage: 30,
    radius: 48,
    count: 1,
    spacing: 0,
    echoes: 0,
  });
  run.player.heading = 0;
  const enemy = spawn(run, { x: run.player.x - 28 - 50, y: run.player.y, hp: 100 });
  for (let index = 0; index < 20 && !run._echoes.some((record) => record.active); index++)
    stepOverflight(run);
  const pending = run._echoes.find((record) => record.active);
  assert.equal(pending.x, run.player.x - 28);
  assert.equal(pending.remaining, 0.45);
  assert.equal(enemy.hp, 100);
  steps(run, 26);
  assert.equal(enemy.hp, 100);
  steps(run, 2);
  assert.equal(enemy.hp, 70);
});

test('movement normalizes diagonals, retains heading and uses approved boost values', () => {
  const run = playing();
  steps(run, 90, { x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(run.player.vx, run.player.vy) - 180) < 1e-6);
  const heading = run.player.heading;
  steps(run, 90);
  assert.equal(run.player.heading, heading);
  stepOverflight(run, { x: 1, boost: true });
  assert.equal(run.player.boostRemaining, 0.3);
  assert.equal(run.player.boostCooldown, 2.5);
  steps(run, 10, { x: 1, boost: true });
  assert.ok(Math.hypot(run.player.vx, run.player.vy) > 320);
  assert.ok(Math.hypot(run.player.vx, run.player.vy) <= 330);
  steps(run, 150, { x: 1, boost: true });
  assert.equal(run.stats.boostsUsed, 1);
});

test('dense area damage visits all 2500 candidates, rewards once and merges overflow XP', () => {
  const run = playing();
  const x = run.player.x + 300,
    y = run.player.y;
  for (let index = 0; index < 2500; index++)
    spawn(run, { x: x + (index % 9), y: y + (index % 7), hp: 30 });
  const refs = run.enemies.slice();
  assert.equal(spawn(run), null);
  rebuild(run);
  assert.equal(damageOverflightArea(run, x, y, 100, 300), 2500);
  assert.equal(damageOverflightArea(run, x, y, 100, 300), 0);
  assert.equal(run.stats.kills, 2500);
  assert.equal(run.stats.damageDealt, 75000);
  assert.equal(run.stats.xpEarned, 2500);
  assert.equal(run.stats.xpOnGround, 2500);
  assert.equal(run.stats.pickupsAlive, 2048);
  assert.equal(run.stats.pickupMerges, 452);
  assert.equal(
    run.pickups.reduce((sum, pickup) => sum + pickup.value, 0),
    2500,
  );
  assert.equal(run._enemyFree.length, 2500);
  run.player.x = x;
  run.player.y = y;
  stepOverflight(run);
  assert.equal(run.stats.xpCollected, 2500);
  assert.equal(run.stats.xpOnGround, 0);
  assert.equal(run._pickupFree.length, 2048);
  assert.equal(run.stats.xpEarned, run.stats.xpOnGround + run.stats.xpCollected);
  for (let index = 0; index < 2500; index++) assert.equal(run.enemies[index], refs[index]);
});

test('area grid boundaries agree with brute-force circle oracle including oversized bodies', () => {
  const run = playing();
  for (let index = 0; index < 800; index++) {
    spawn(run, {
      x: 127 + ((index * 37) % 600),
      y: 128 + ((index * 61) % 500),
      hp: 100,
      radius: index % 17 === 0 ? 92 : 8,
      warning: index % 11 === 0 ? 1 : 0,
    });
  }
  rebuild(run);
  const x = 320,
    y = 320,
    radius = 130;
  const oracle = run.enemies.filter(
    (enemy) =>
      enemy.active &&
      !enemy.warning &&
      (enemy.x - x) ** 2 + (enemy.y - y) ** 2 <= (radius + enemy.radius) ** 2,
  );
  assert.equal(damageOverflightArea(run, x, y, radius, 25, { push: 50 }), oracle.length);
  for (const enemy of run.enemies)
    if (enemy.active) assert.equal(enemy.hp, oracle.includes(enemy) ? 75 : 100);
  // Queued separation impulses do not invalidate later damage queries in a tick.
  assert.equal(damageOverflightArea(run, x, y, radius, 25), oracle.length);
  for (const enemy of oracle) assert.equal(enemy.hp, 50);
});

test('three combat slots, one support, admitted modules and guaranteed evolution', () => {
  const build = createOverflightBuild();
  apply(build, 'primary:wide:2');
  apply(build, 'primary:wide:3');
  for (let index = 0; index < 20; index++)
    assert.ok(
      draftOverflightUpgrades(build, compiled.upgrades.modules, () => index / 20).some(
        (card) => card.id === 'primary:wide:4',
      ),
    );
  apply(build, 'primary:wide:4');
  apply(build, 'side-burst:1');
  apply(build, 'slow-field:1');
  apply(build, 'shield:1');
  const legal = legalOverflightUpgrades(build, compiled.upgrades.modules);
  assert.ok(!legal.some((card) => card.system === 'proximity-pulse' || card.system === 'scanner'));
  assert.equal(build.combat.length + 1, 3);
  assert.equal(overflightBuildItems(build)[0].title.en, 'Saturation Fan');
  const minimal = createOverflightBuild();
  const cards = draftOverflightUpgrades(minimal, ['primary'], () => 0.5);
  assert.equal(cards.length, 3);
  assert.equal(new Set(cards.map((card) => card.id)).size, 3);
  assert.ok(cards.every((card) => card.system === 'primary' || card.kind === 'utility'));
  assert.equal(
    applyOverflightUpgrade(minimal, offer(createOverflightBuild(), 'shield:1'), ['primary']),
    false,
  );
});

test('queued choices stop at ten, rerolls stop at two, draft RNG does not change encounter RNG', () => {
  const run = playing();
  dropOverflightSalvage(run, run.player.x, run.player.y, compiled.upgrades.thresholds.at(-1) + 1);
  stepOverflight(run);
  const state = run._randomState;
  assert.equal(rerollOverflightUpgrades(run), true);
  assert.equal(rerollOverflightUpgrades(run), true);
  assert.equal(rerollOverflightUpgrades(run), false);
  assert.equal(run._randomState, state);
  while (run.phase === 'upgrade') {
    assert.equal(run.offers.length, 3);
    assert.equal(new Set(run.offers.map((card) => card.id)).size, 3);
    chooseOverflightUpgrade(run, run.offers[0].id);
  }
  assert.equal(run.progression.choices, 10);
  assert.equal(run._randomState, state);
  steps(run, 10);
  assert.equal(run.phase, 'playing');
});

test('arrival warning prevents contact and attack damage, contact is 20 with .75s protection', () => {
  const run = playing();
  const enemy = spawn(run, { x: run.player.x, y: run.player.y, warning: 1.1, hp: 1000 });
  steps(run, 30);
  assert.equal(run.player.hull, 100);
  assert.equal(enemy.hp, 1000);
  steps(run, 40);
  assert.equal(run.player.hull, 80);
  assert.ok(run.player.invulnerable > 0.6);
  steps(run, 20);
  assert.equal(run.player.hull, 80);
  steps(run, 35);
  assert.equal(run.player.hull, 60);
});

test('priority attacks have at least one second warning, cap at two, cancel when owner dies', () => {
  const run = playing();
  const owners = [];
  for (let index = 0; index < 8; index++) {
    const enemy = spawn(run, {
      family: 'brace-trooper',
      x: run.player.x + 200,
      y: run.player.y + index,
      hp: 100,
    });
    enemy.attackCooldown = 0;
    owners.push(enemy);
  }
  assert.equal(spawn(run, { family: 'brace-trooper' }), null);
  stepOverflight(run);
  const attacks = run.priorityAttacks.filter((attack) => attack.active);
  assert.equal(attacks.length, 2);
  assert.ok(attacks.every((attack) => attack.remaining >= 1));
  steps(run, 55);
  assert.equal(run.player.hull, 100);
  const owner = owners.find((enemy) => enemy.id === attacks[0].owner);
  damageOverflightArea(run, owner.x, owner.y, 30, 1000);
  assert.equal(
    run.priorityAttacks.some((attack) => attack.active),
    false,
  );
  steps(run, 20);
  assert.equal(run.player.hull, 100);
});

test('sprinter telegraphs for one second, locks its burst heading, and preserves four-second travel', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  const enemy = spawn(run, {
    family: 'sprinter',
    x: run.player.x + 700,
    y: run.player.y,
    speed: 40,
  });
  enemy._behaviorAge = 0;
  const startX = enemy.x;
  steps(run, 60);
  assert.equal(enemy.behaviorPhase, 'windup');
  assert.ok(Math.abs(startX - enemy.x - 20) < 1e-8);
  steps(run, 30);
  assert.equal(enemy.behaviorPhase, 'burst');
  assert.ok(Math.abs(startX - enemy.x - 60) < 1e-8);
  steps(run, 150);
  assert.equal(enemy.behaviorPhase, 'pursuit');
  assert.ok(Math.abs(startX - enemy.x - 160) < 1e-8);
  enemy._behaviorAge = 60;
  stepOverflight(run);
  const heading = enemy.heading,
    y = enemy.y;
  steps(run, 20, { y: 1 });
  assert.equal(enemy.heading, heading);
  assert.equal(enemy.y, y);
});

test('courier and refuge rewards remain optional, exact-once and conserved through pickup overflow', () => {
  const source = quiet();
  source.resources.pools.pickups = 1;
  const run = playing(source);
  const courier = spawn(run, { family: 'courier', x: run.player.x + 250 });
  const refuge = spawn(run, { family: 'refuge-seeker', x: run.player.x + 260 });
  assert.equal(courier.rewardTarget, true);
  assert.equal(refuge.rewardTarget, true);
  rebuild(run);
  damageOverflightArea(run, courier.x, courier.y, 60, 1000);
  damageOverflightArea(run, courier.x, courier.y, 60, 1000);
  assert.equal(run.stats.kills, 2);
  assert.equal(run.stats.xpEarned, 5);
  assert.equal(run.stats.xpOnGround, 5);
  assert.equal(run.stats.pickupMerges, 1);
  assert.equal(run.phase, 'playing');
  const pickup = run.pickups.find((item) => item.active);
  run.player.x = pickup.x;
  run.player.y = pickup.y;
  stepOverflight(run);
  assert.equal(run.stats.xpCollected, 5);
  assert.equal(run.stats.xpOnGround, 0);
});

test('radar support is bounded to eight sources, non-stacking, and cancels immediately on death', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  const enemy = spawn(run, { x: run.player.x + 500, speed: 40 });
  const sources = [];
  for (let index = 0; index < 8; index++)
    sources.push(
      spawn(run, { family: 'radar-truck', x: enemy.x + 60, y: enemy.y - 100 + index * 25 }),
    );
  assert.equal(spawn(run, { family: 'radar-truck' }), null);
  assert.equal(run._supportSources.filter(Boolean).length, 8);
  steps(run, 6);
  const supportedX = enemy.x;
  stepOverflight(run);
  assert.ok(Math.abs(supportedX - enemy.x - (40 * 1.08) / 60) < 1e-8);
  assert.equal(
    run.priorityAttacks.some((attack) => attack.active),
    false,
  );
  rebuild(run);
  for (const source of sources) damageOverflightArea(run, source.x, source.y, 1, 1000);
  assert.equal(run._supportSources.filter(Boolean).length, 0);
  const unsupportedX = enemy.x;
  stepOverflight(run);
  assert.ok(Math.abs(unsupportedX - enemy.x - 40 / 60) < 1e-8);
});

test('relay rally has a full warning, a bounded flank bias, and cancels on death without an extra attack', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  const enemy = spawn(run, { x: run.player.x + 500, speed: 40 });
  const source = spawn(run, { family: 'relay-warden', x: enemy.x + 80, y: enemy.y });
  source._behaviorAge = 0;
  source.attackCooldown = 0;
  const initialY = enemy.y;
  steps(run, 60);
  assert.equal(source.behaviorPhase, 'rally-warning');
  assert.equal(enemy.y, initialY);
  steps(run, 6);
  assert.equal(source.behaviorPhase, 'rally');
  assert.notEqual(enemy.y, initialY);
  assert.ok(Math.abs(enemy._rallySteeringY - enemy.steeringY) <= 0.2);
  assert.equal(
    run.priorityAttacks.some((attack) => attack.active),
    false,
  );
  rebuild(run);
  damageOverflightArea(run, source.x, source.y, 1, 1000);
  const beforeX = enemy.x,
    beforeY = enemy.y;
  const dx = enemy.steeringX,
    dy = enemy.steeringY;
  stepOverflight(run);
  assert.ok(Math.abs(enemy.x - beforeX - (dx * 40) / 60) < 1e-8);
  assert.ok(Math.abs(enemy.y - beforeY - (dy * 40) / 60) < 1e-8);
});

test('family behavior phases are deterministic and do not consume encounter or draft randomness', () => {
  const make = () => {
    const run = playing();
    run._cooldowns.primary = 100;
    for (const [index, family] of [
      'sprinter',
      'courier',
      'refuge-seeker',
      'relay-warden',
      'radar-truck',
    ].entries())
      spawn(run, { family, x: run.player.x + 600, y: run.player.y - 100 + index * 40, speed: 20 });
    return run;
  };
  const first = make(),
    second = make();
  const encounterState = first._randomState,
    draftState = first._draftRandomState;
  steps(first, 600);
  steps(second, 600);
  assert.equal(first._randomState, encounterState);
  assert.equal(first._draftRandomState, draftState);
  assert.deepEqual(first, second);
});

test('relay and radar within attack range never create aimed threats', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  for (const [index, family] of ['relay-warden', 'radar-truck'].entries()) {
    const enemy = spawn(run, { family, x: run.player.x + 200, y: run.player.y + index * 40 });
    enemy.attackCooldown = 0;
  }
  steps(run, 660);
  assert.ok(run.enemies.some((enemy) => enemy.active && enemy.behaviorPhase === 'support'));
  assert.equal(
    run.priorityAttacks.some((attack) => attack.active),
    false,
  );
  assert.equal(run.stats.damageTaken, 0);
});

test('three-airframe replacement preserves build, world, XP and cooldown with safe protection', () => {
  const run = playing(quiet(), { airframes: 3 });
  apply(run.build, 'primary:double:2');
  const enemy = spawn(run, { x: run.player.x, y: run.player.y, hp: 1000 });
  dropOverflightSalvage(run, 20, 20, 15);
  run.player.hull = 20;
  run.player.boostCooldown = 2;
  stepOverflight(run);
  assert.equal(run.airframesRemaining, 2);
  assert.equal(run.player.hull, 100);
  assert.equal(run.player.invulnerable, 1.5);
  assert.equal(run.player.boostCooldown, 2 - OVERFLIGHT_STEP);
  assert.equal(run.build.primary.branch, 'double');
  assert.equal(run.stats.xpOnGround, 15);
  assert.equal(enemy.active, true);
  assert.ok(Math.hypot(run.player.x - enemy.x, run.player.y - enemy.y) >= 80);
  for (let loss = 0; loss < 2; loss++) {
    run.player.hull = 20;
    run.player.invulnerable = 0;
    enemy.x = run.player.x;
    enemy.y = run.player.y;
    stepOverflight(run);
  }
  assert.equal(run.phase, 'lost');
  assert.equal(run.stats.airframesLost, 3);
});

test('regular spawn expiry continues play and final death wins before hostile damage in the same tick', () => {
  const source = quiet();
  source.duration = 60;
  source.encounters = [
    {
      id: 'last',
      start: 0,
      end: 60,
      spawnPerSecond: 1,
      speed: 0,
      hp: 30,
      families: ['patroller'],
      pattern: 'pursuit',
    },
  ];
  source.goals.finalAt = 60;
  const run = playing(source);
  run.tick = 3599;
  run.time = run.tick / 60;
  stepOverflight(run);
  assert.equal(run.phase, 'playing');
  assert.equal(run.goals.finalSpawned, true);
  const count = run.stats.spawned;
  steps(run, 120);
  assert.equal(run.phase, 'playing');
  assert.equal(run.stats.spawned, count);
  const final = run.enemies.find((enemy) => enemy.active && enemy.role === 'final');
  final.warning = 0;
  final.x = run.player.x;
  final.y = run.player.y;
  final.hp = 1;
  run.player.hull = 1;
  run._echoes[0] = {
    active: true,
    remaining: 0,
    x: final.x,
    y: final.y,
    radius: 48,
    damage: 30,
    count: 1,
    spacing: 0,
    heading: 0,
    kind: 'drop',
  };
  stepOverflight(run);
  assert.equal(run.phase, 'won');
  assert.equal(run.player.hull, 1);
  assert.equal(run.goals.finalDefeated, true);
  const tick = run.tick;
  steps(run, 100);
  assert.equal(run.tick, tick);
});

test('ordinary pursuit decisions stagger at 10Hz while every actor moves each fixed tick', () => {
  const run = playing();
  const enemy = spawn(run, { x: 400, y: 200, speed: 40 });
  const initialSteering = [enemy.steeringX, enemy.steeringY];
  run.player.y += 100;
  const start = [enemy.x, enemy.y];
  steps(run, 5);
  assert.deepEqual([enemy.steeringX, enemy.steeringY], initialSteering);
  assert.notDeepEqual([enemy.x, enemy.y], start);
  stepOverflight(run);
  assert.notDeepEqual([enemy.steeringX, enemy.steeringY], initialSteering);
});

test('nonpiercing shots hit first collision surface rather than nearest center', () => {
  const run = playing();
  run.build.combat = [{ id: 'side-burst', rank: 1 }];
  const tank = spawn(run, {
    family: 'tracked-tank',
    x: run.player.x + 31,
    y: run.player.y,
    radius: 21,
    hp: 100,
  });
  const soldier = spawn(run, { x: run.player.x + 19, y: run.player.y, radius: 8, hp: 100 });
  stepOverflight(run);
  assert.equal(tank.hp, 66);
  assert.equal(soldier.hp, 100);
});

test('piercing shots hit all crossed bodies once and projectile pool exhaustion defers launch', () => {
  const run = playing();
  run.build.combat = [{ id: 'side-burst', rank: 3 }];
  const a = spawn(run, { x: run.player.x + 35, y: run.player.y, hp: 1000 });
  const b = spawn(run, { x: run.player.x + 50, y: run.player.y, hp: 1000 });
  steps(run, 18);
  assert.equal(a.hp, 942);
  assert.equal(b.hp, 942);
  const source = quiet();
  source.resources.pools.projectiles = 1;
  const exhausted = playing(source);
  exhausted.build.combat = [{ id: 'side-burst', rank: 1 }];
  steps(exhausted, 10);
  assert.equal(exhausted.stats.projectileDeferrals, 10);
  assert.equal(exhausted.projectiles[0].active, false);
  assert.equal(exhausted._projectileFree.length, 1);
});

test('identical seeds, decisions and inputs produce identical simulation and summary', () => {
  const a = playing(compiled),
    b = playing(compiled);
  for (let index = 0; index < 1800; index++) {
    for (const run of [a, b]) {
      if (run.phase === 'upgrade') chooseOverflightUpgrade(run, run.offers[0].id);
      stepOverflight(run, {
        x: Math.cos(index / 130) * 0.5,
        y: Math.sin(index / 130) * 0.5,
        boost: index % 200 === 0,
      });
    }
  }
  assert.deepEqual(overflightSummary(a), overflightSummary(b));
  assert.deepEqual(a.enemies, b.enemies);
  assert.deepEqual(a.pickups, b.pickups);
  assert.deepEqual(a.player, b.player);
});

for (const fixture of ['reference', 'stress']) {
  test(`${fixture} fixture simulates every actor for 1000 ticks with stable alive/visible counts`, () => {
    const run = playing(compiled, { fixture });
    const before = run.enemies.map((enemy) => [enemy.x, enemy.y]);
    let committed = 0;
    for (let index = 0; index < 1000; index++) {
      stepOverflight(run);
      committed += run.events.find((event) => event.type === 'warning')?.count ?? 0;
      assert.equal(run.stats.enemiesAlive, fixture === 'reference' ? 1500 : 2500);
      assert.equal(run.stats.enemiesVisible, fixture === 'reference' ? 700 : 1200);
      assert.equal(run.stats.specialistsAlive, 8);
      assert.equal(run.stats.heaviesAlive, 4);
      assert.ok(run.stats.priorityAttacks <= 2);
    }
    assert.equal(
      run.enemies.filter(
        (enemy, index) =>
          enemy.active && (enemy.x !== before[index][0] || enemy.y !== before[index][1]),
      ).length,
      run.stats.enemiesAlive,
    );
    assert.ok(run.stats.collisionCandidates > 10000);
    assert.ok(run.stats.fixtureDefeats > 0);
    assert.ok(committed > 0);
    assert.equal(run.stats.kills, 0);
    assert.equal(run.stats.damageTaken, 0);
    assert.equal(run.phase, 'playing');
    assert.equal(overflightSummary(run).outcome, 'technical-fixture');
    assert.equal(run.fixtureWorkload.frozenPositions, false);
  });
}

test('stationary slow fields persist at departure and reduce ordinary travel', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  run.build.combat = [{ id: 'slow-field', rank: 3 }];
  const target = spawn(run, { x: run.player.x + 90, y: run.player.y, hp: 1000, speed: 40 });
  stepOverflight(run);
  const field = run.fields.find((record) => record.active);
  const origin = [field.x, field.y];
  const startX = target.x;
  assert.equal(field.radius, 118);
  assert.ok(target.slowUntil > run.tick);
  steps(run, 12, { x: -1 });
  assert.deepEqual([field.x, field.y], origin);
  assert.ok(startX - target.x < (40 * 12) / 60);
  assert.ok(run.player.x < field.x - 20);
  assert.ok(field.active);
});

test('return pulse is a delayed second opportunity at the first pulse location', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  run.build.combat = [{ id: 'proximity-pulse', rank: 3 }];
  const target = spawn(run, { x: run.player.x + 90, y: run.player.y, hp: 1000, warning: 0.5 });
  steps(run, 24);
  assert.equal(target.hp, 1000); // Arrival immune to the first delayed pulse.
  steps(run, 25);
  assert.equal(target.hp, 962);
});

test('scanner prioritizes machinery, increases marked damage and caps chain to three targets', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  run.build.support = { id: 'scanner', rank: 1 };
  const tank = spawn(run, {
    family: 'tracked-tank',
    x: run.player.x + 180,
    y: run.player.y,
    hp: 1000,
  });
  const common = spawn(run, { x: run.player.x + 100, y: run.player.y, hp: 1000 });
  stepOverflight(run);
  assert.ok(tank.markUntil > run.tick);
  assert.equal(common.markUntil, 0);
  damageOverflightArea(run, tank.x, tank.y, 1, 40);
  assert.equal(tank.hp, 948);
  run.build.support.rank = 3;
  run._cooldowns.scanner = 0;
  const others = [];
  for (let index = 0; index < 8; index++)
    others.push(spawn(run, { x: tank.x + index * 10, y: tank.y + 50, hp: 1000 }));
  const before = run.stats.hits;
  stepOverflight(run);
  assert.equal(run.stats.hits - before, 3);
  assert.ok(others.filter((enemy) => enemy.hp < 1000).length <= 2);
});

test('evolved shield uses boost departure pulse and recharges after absorbing one hit', () => {
  const run = playing();
  run._cooldowns.primary = 100;
  run.build.support = { id: 'shield', rank: 3 };
  run.player.shield = 1;
  const target = spawn(run, { x: run.player.x - 70, y: run.player.y, hp: 1000 });
  stepOverflight(run, { x: 1, boost: true });
  assert.equal(target.hp, 970);
  const contact = spawn(run, { x: run.player.x, y: run.player.y, hp: 1000 });
  stepOverflight(run);
  assert.equal(run.player.hull, 100);
  assert.equal(run.player.shield, 0);
  assert.equal(run.player.shieldCooldown, 5);
  contact.x = 20;
  contact.y = 20;
  steps(run, 301);
  assert.equal(run.player.shield, 1);
});

test('fixture defeat recycling waits for the next movement/grid phase', () => {
  const run = playing(compiled, { fixture: 'reference' });
  const enemy = run.enemies[100];
  const before = [enemy.x, enemy.y];
  damageOverflightArea(run, enemy.x, enemy.y, 0, 1000);
  assert.equal(enemy._fixtureRecycle, true);
  assert.deepEqual([enemy.x, enemy.y], before);
  assert.equal(run.stats.enemiesAlive, 1500);
  stepOverflight(run);
  assert.equal(enemy._fixtureRecycle, false);
  assert.notDeepEqual([enemy.x, enemy.y], before);
  assert.equal(run.stats.enemiesVisible, 700);
});

for (const fixture of ['reference', 'stress']) {
  test(`${fixture} fixture retains broad distinct silhouettes beyond fifteen simulated minutes`, () => {
    const run = playing(compiled, { fixture });
    const expectedVisible = fixture === 'reference' ? 700 : 1200;
    const maximumBucket = fixture === 'reference' ? 100 : 160;
    for (let tick = 1; tick <= 901 * 60; tick++) {
      stepOverflight(run);
      assert.equal(run.stats.enemiesAlive, fixture === 'reference' ? 1500 : 2500);
      assert.equal(run.stats.enemiesVisible, expectedVisible);
      if (tick % 60 === 0) {
        assert.ok(run.fixtureWorkload.occupiedScreenBuckets >= 45);
        assert.ok(run.fixtureWorkload.maximumScreenBucketPopulation <= maximumBucket);
      }
      if (tick !== 390 * 60 && tick !== 600 * 60 && tick !== 901 * 60) continue;
      const visible = run.enemies.filter(
        (enemy) =>
          enemy.active &&
          Math.abs(enemy.x - run.camera.x) <= 480 &&
          Math.abs(enemy.y - run.camera.y) <= 270,
      );
      assert.equal(new Set(visible.map((enemy) => `${enemy.x},${enemy.y}`)).size, expectedVisible);
      const buckets = new Uint16Array(60);
      for (const enemy of visible) {
        const column = Math.min(9, Math.floor((enemy.x - run.camera.x + 480) / 96));
        const row = Math.min(5, Math.floor((enemy.y - run.camera.y + 270) / 90));
        buckets[row * 10 + column]++;
      }
      assert.equal(
        buckets.filter((count) => count > 0).length,
        run.fixtureWorkload.occupiedScreenBuckets,
      );
      assert.equal(Math.max(...buckets), run.fixtureWorkload.maximumScreenBucketPopulation);
    }
    assert.ok(run.fixtureWorkload.recycledActors > 0);
    assert.equal(run.stats.kills, 0);
    assert.equal(run.stats.damageTaken, 0);
  });
}
