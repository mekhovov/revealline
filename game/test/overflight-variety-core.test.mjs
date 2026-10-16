import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  spawnOverflightEnemy,
  damageOverflightArea,
} from '../overflight/core.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  spawnOverflightHuntEnemy,
} from '../overflight/raid-core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import { createOverflightHuntReviewPilot } from '../overflight/raid-review-pilot.mjs';
import {
  createOverflightBuild,
  legalOverflightUpgrades,
  applyOverflightUpgrade,
} from '../overflight/upgrades.mjs';
import {
  createOverflightHuntBuild,
  legalOverflightHuntUpgrades,
  applyOverflightHuntUpgrade,
} from '../overflight/raid-upgrades.mjs';
import {
  overflightFormationSchedule,
  overflightAttackContains,
  hasOverflightEscape,
  createOverflightCaches,
  updateOverflightCaches,
  overflightArmoredDamage,
} from '../overflight/tactics.mjs';

function quiet(legacy = false) {
  const compiled = structuredClone(compileOverflightProject(createOverflightProject({ legacy })));
  compiled.encounters = [];
  compiled.goals.eliteAt = 10000;
  compiled.goals.finalAt = 20000;
  const run = createOverflightRun(compiled);
  startOverflight(run);
  run._cooldowns.primary = 10000;
  return run;
}
const hit = (run, enemy, damage, offset = 30) => {
  rebuildOverflightGrid(run._grid, run.enemies);
  return damageOverflightArea(run, enemy.x + offset, enemy.y, Math.abs(offset) + 1, damage);
};

test('Raid review approach flanks a visible protected escort without changing simulation state', () => {
  const run = createOverflightHuntRun(compileOverflightHuntProject(createOverflightHuntProject()));
  // A minimal public-state observation isolates navigation from random packs.
  const player = { ...run.player, x: 500, y: 500 };
  const shield = {
    active: true,
    id: 1,
    x: 560,
    y: 500,
    radius: 8,
    vx: 0,
    vy: 0,
    heading: Math.PI,
    behavior: 'shield',
    behaviorPhase: 'patrol',
    warning: 0,
  };
  const target = {
    active: true,
    id: 2,
    x: 640,
    y: 500,
    radius: 17,
    vx: 0,
    vy: 0,
    heading: Math.PI,
    behavior: 'vehicle',
    behaviorPhase: 'recovery',
    warning: 0,
    objectiveId: 'vehicle',
    maxArmorSegments: 1,
  };
  const observation = { player, enemies: [shield, target], projectiles: [], hunt: run.hunt };
  const before = structuredClone(observation);
  const input = createOverflightHuntReviewPilot().input(observation);
  assert.notEqual(input.y, 0, 'approach leaves the blocked straight line');
  assert.equal(input.boost, false);
  assert.deepEqual(observation, before, 'review pilot only submits ordinary inputs');
});
test('V2 adds explicit editable combat while V1 preserves original durability and capabilities', () => {
  for (const legacy of [true, false]) {
    const project = createOverflightProject({ legacy });
    const compiled = compileOverflightProject(project);
    assert.equal(compiled.rulesVersion, legacy ? 1 : 2);
    assert.equal(compiled.combat !== null, !legacy);
    assert.equal(project.upgrades.modules.includes('plating'), !legacy);
    const run = quiet(legacy);
    const tank = spawnOverflightEnemy(run, { family: 'tracked-tank', hp: 300, warning: 0 });
    assert.equal(tank.hp, legacy ? 300 : 210);
    assert.equal(tank.armor, legacy ? 0 : 90);
  }
  for (const difficulty of ['standard', 'veteran'])
    for (const encounterSet of ['patrol', 'crossing', 'mixed']) {
      assert.equal(
        compileOverflightHuntProject(createOverflightHuntProject({ difficulty, encounterSet }))
          .rulesVersion,
        2,
      );
    }
  assert.equal(
    compileOverflightHuntProject(createOverflightHuntProject({ legacy: true })).rulesVersion,
    1,
  );
});
test('shield facing, blocked overflow and internal blasts create reliable different approaches', () => {
  const run = quiet();
  const front = spawnOverflightEnemy(run, {
    family: 'shield-bearer',
    x: 500,
    y: 500,
    hp: 30,
    warning: 0,
  });
  front.guardHeading = 0;
  hit(run, front, 30);
  assert.equal(front.hp, 22.5);
  assert.equal(front.guardIntegrity, 37.5);
  hit(run, front, 30);
  assert.equal(front.hp, 15);
  assert.equal(front.guardIntegrity, 15);
  hit(run, front, 30);
  assert.equal(front.active, false);
  assert.equal(run.stats.kills, 1);
  for (const offset of [-30, 0]) {
    const target = spawnOverflightEnemy(run, {
      family: 'shield-bearer',
      x: 700,
      y: 500,
      hp: 30,
      warning: 0,
    });
    target.guardHeading = 0;
    hit(run, target, 30, offset);
    assert.equal(target.active, false);
  }
  assert.equal(run.stats.kills, 3);
});
test('each tank plate break opens recovery without adding durability or replaying rewards', () => {
  const run = quiet();
  const enemy = spawnOverflightEnemy(run, {
    family: 'tracked-tank',
    x: 500,
    y: 500,
    hp: 300,
    warning: 0,
  });
  assert.equal(enemy.hp + enemy.armor, 300);
  run.priorityAttacks[0] = { active: true, owner: enemy.id, remaining: 1 };
  hit(run, enemy, 30, 0);
  assert.equal(enemy.armorSegments, 2);
  assert.equal(enemy.exposureRemaining, 3);
  assert.equal(run.priorityAttacks[0].active, false);
  hit(run, enemy, 20, 0);
  assert.equal(enemy.armorSegments, 1);
  hit(run, enemy, 20, 0);
  assert.equal(enemy.armorSegments, 0);
  assert.equal(run.stats.armorSegmentsBroken, 3);
  hit(run, enemy, 1000, 0);
  hit(run, enemy, 1000, 0);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.armorSegmentsBroken, 3);
});
test('defensive drafts and application reject shield/plating stacks in both modes', () => {
  const modules = createOverflightProject().upgrades.modules;
  const build = createOverflightBuild();
  assert.equal(
    applyOverflightUpgrade(
      build,
      legalOverflightUpgrades(build, modules).find((c) => c.id === 'plating:1'),
      modules,
    ),
    true,
  );
  assert.ok(
    legalOverflightUpgrades(build, modules).every((c) => !['shield', 'scanner'].includes(c.system)),
  );
  for (const first of ['plating', 'recovery-shield']) {
    const hunt = createOverflightHuntBuild();
    const list = createOverflightHuntProject().upgrades.modules;
    const offers = legalOverflightHuntUpgrades(hunt, list);
    const other = first === 'plating' ? 'recovery-shield' : 'plating';
    const illegal = offers.find((c) => c.system === other);
    assert.equal(
      applyOverflightHuntUpgrade(
        hunt,
        offers.find((c) => c.system === first),
        list,
      ),
      true,
    );
    assert.equal(applyOverflightHuntUpgrade(hunt, illegal, list), false);
  }
  assert.equal(overflightArmoredDamage(20, 1), 18);
  assert.equal(overflightArmoredDamage(20, 2), 16);
});
test('seeded formation decks vary, never repeat, and author bounded relief', () => {
  const a = overflightFormationSchedule(12, 'veteran', 'front');
  assert.deepEqual(a, overflightFormationSchedule(12, 'veteran', 'front'));
  assert.notDeepEqual(a, overflightFormationSchedule(13, 'veteran', 'front'));
  for (let i = 1; i < a.length; i++) assert.notEqual(a[i].pattern, a[i - 1].pattern);
  for (const difficulty of ['standard', 'veteran']) {
    const p = createOverflightProject({ difficulty });
    for (const e of p.encounters.filter((e) => e.pattern === 'relief'))
      assert.ok(e.end - e.start >= Math.min(p.combat.pacing.reliefSeconds, p.duration - e.start));
  }
});
test('relief waits for committed warnings then provides its full interval without new commitments', () => {
  const run = quiet();
  run.compiled.encounters = [
    {
      id: 'relief',
      start: 0,
      end: 1,
      pattern: 'relief',
      spawnPerSecond: 0,
      families: ['patroller'],
    },
    {
      id: 'next',
      start: 1,
      end: 30,
      pattern: 'pursuit',
      spawnPerSecond: 20,
      families: ['patroller'],
      hp: 30,
      speed: 40,
    },
  ];
  const owner = spawnOverflightEnemy(run, {
    family: 'brace-trooper',
    x: run.player.x + 150,
    y: run.player.y,
    warning: 0,
  });
  run.priorityAttacks[0] = {
    active: true,
    owner: owner.id,
    remaining: 1.1,
    kind: 'ground',
    x: 50,
    y: 50,
    radius: 10,
    damage: 20,
  };
  for (let i = 0; i < 70; i++) stepOverflight(run);
  assert.ok(run._reliefUntil >= 9);
  const spawned = run.stats.spawned;
  for (let i = 0; i < 300; i++) stepOverflight(run, { x: -1 });
  assert.equal(run.stats.spawned, spawned);
  assert.ok(run.priorityAttacks.every((a) => !a.active));
});
test('fan gaps and temporal warning combinations retain a baseline escape at arena edges', () => {
  const run = quiet();
  run.player.x = 25;
  run.player.y = 25;
  const lane = {
    kind: 'lane',
    originX: 25,
    originY: 0,
    heading: Math.PI / 2,
    length: 620,
    radius: 8,
    remaining: 1,
  };
  assert.equal(hasOverflightEscape(run, lane), true);
  const fan = { ...lane, kind: 'fan', originX: 0, originY: 25, heading: 0, spread: 0.32 };
  assert.equal(overflightAttackContains(fan, 400, 25 + 60, 0), false);
  run.priorityAttacks[0] = {
    active: true,
    kind: 'ground',
    x: 25,
    y: 25,
    radius: 45,
    remaining: 0.05,
  };
  assert.equal(
    hasOverflightEscape(run, lane),
    false,
    'a later warning does not conceal an earlier unavoidable commitment',
  );
});

test('mass clearing earns bounded relief without suppressing every subsequent pressure window', () => {
  for (const difficulty of ['standard', 'veteran']) {
    const run = quiet();
    const seconds = difficulty === 'standard' ? 8 : 5;
    run.compiled.combat.pacing.reliefSeconds = seconds;
    run.compiled.encounters = [
      {
        id: 'pressure',
        start: 0,
        end: 90,
        pattern: 'pursuit',
        spawnPerSecond: 10,
        hp: 30,
        speed: 0,
        families: ['patroller'],
      },
    ];
    const clear = () => {
      for (let i = 0; i < 20; i++)
        spawnOverflightEnemy(run, { x: 100, y: 100, hp: 30, speed: 0, warning: 0 });
      rebuildOverflightGrid(run._grid, run.enemies);
      damageOverflightArea(run, 100, 100, 50, 30);
    };
    const advance = (ticks) => {
      for (let i = 0; i < ticks; i++) stepOverflight(run);
    };
    clear();
    advance(60);
    const firstEnd = run._reliefUntil;
    assert.equal(firstEnd, 1 + seconds);
    const spawned = run.stats.spawned;
    advance(seconds * 60 - 1);
    assert.equal(run.stats.spawned, spawned, 'no instant replacement during earned space');
    clear();
    const afterClear = run.stats.spawned;
    advance(61);
    assert.equal(run._reliefUntil, firstEnd, 'another burst cannot renew relief immediately');
    assert.ok(run.stats.spawned > afterClear, 'authored pressure resumes');
    while (run.time < run._clearReliefReadyAt) stepOverflight(run);
    clear();
    advance(60);
    assert.ok(run._reliefUntil > firstEnd, 'a later clearing pass can earn space again');
  }
});
test('cache groups stay finite, coexist, and require a deliberate physical reward entry', () => {
  const run = quiet();
  run.time = 220;
  run.tick = 13200;
  const update = () =>
    updateOverflightCaches(
      run,
      (options) => spawnOverflightEnemy(run, options),
      () => {},
    );
  update();
  assert.equal(run.caches.filter((c) => c.state === 'locked').length, 2);
  const spawned = run.stats.spawned;
  update();
  assert.equal(run.stats.spawned, spawned);
  const cache = run.caches[0];
  for (const enemy of run.enemies) if (cache.guardIds.includes(enemy.id)) enemy.active = false;
  run.player.x = cache.rewards[0].x;
  run.player.y = cache.rewards[0].y;
  run.player.hull = 40;
  update();
  assert.equal(cache.state, 'open');
  assert.equal(run.player.hull, 40);
  update();
  assert.equal(cache.state, 'open');
  run.player.y += 100;
  update();
  run.player.y -= 100;
  update();
  assert.equal(cache.state, 'claimed');
  assert.equal(run.player.hull, 70);
  update();
  assert.equal(run.player.hull, 70);
  assert.equal(run.phase, 'playing');
  const edge = createOverflightCaches({ ...run.compiled, props: [{ id: 'edge', x: 0, y: 0 }] })[0];
  assert.ok(edge.rewards[0].x >= 28);
  assert.ok(edge.rewards[1].x - edge.rewards[0].x >= 88);
});
test('Raid carriers fire a complete committed fan, while legacy carriers retain one projectile', () => {
  for (const legacy of [false, true]) {
    const run = createOverflightHuntRun(
      compileOverflightHuntProject(createOverflightHuntProject({ legacy })),
    );
    for (const enemy of run.enemies)
      if (enemy.active) {
        enemy.active = false;
        run._enemyFree.push(enemy._slot);
      }
    run.caches = [];
    run.hunt.objectives = [];
    const enemy = spawnOverflightHuntEnemy(run, {
      family: 'armored-carrier',
      x: run.player.x + 150,
      y: run.player.y,
      warning: 0,
      phaseRemaining: 0,
      behaviorPhase: 'guarding',
    });
    startOverflightHunt(run);
    for (let i = 0; i < 78; i++) stepOverflightHunt(run, { y: 0.2 });
    assert.equal(enemy.attackKind, legacy ? null : 'fan');
    assert.equal(run.stats.projectilesFired, legacy ? 1 : 3);
  }
});

test('a full guard pool defers the objective until a genuine kill frees a slot', () => {
  const compiled = structuredClone(compileOverflightProject(createOverflightProject()));
  compiled.encounters = [];
  compiled.population.capacity = compiled.combat.supplies.guardCount;
  compiled.goals.eliteAt = 91;
  compiled.goals.finalAt = 20000;
  const run = createOverflightRun(compiled);
  startOverflight(run);
  run._cooldowns.primary = 10000;
  run.caches = run.caches.slice(0, 1);
  run.time = 90;
  run.tick = 5400;
  stepOverflight(run);
  const cache = run.caches[0];
  const guardIds = [...cache.guardIds];
  assert.equal(guardIds.length, compiled.population.capacity);
  assert.equal(run._enemyFree.length, 0);

  compiled.goals.eliteAt = run.time;
  for (let i = 0; i < 70; i++) stepOverflight(run);
  assert.equal(run.goals.eliteSpawned, false);
  assert.equal(run.stats.retired, 0);
  assert.equal(cache.state, 'locked');
  assert.ok(guardIds.every((id) => run.enemies.some((enemy) => enemy.id === id && enemy.active)));

  const firstGuard = run.enemies.find((enemy) => enemy.id === guardIds[0]);
  hit(run, firstGuard, 1000, 0);
  stepOverflight(run);
  assert.equal(run.goals.eliteSpawned, true);
  assert.equal(run.stats.kills, 1);
  assert.equal(run.stats.retired, 0);
  assert.equal(cache.state, 'locked', 'reusing the dead guard slot does not unlock the cache');
  for (const id of guardIds.slice(1)) {
    const guard = run.enemies.find((enemy) => enemy.id === id);
    assert.ok(guard?.active);
    hit(run, guard, 1000, 0);
  }
  stepOverflight(run);
  assert.equal(cache.state, 'open');
  assert.equal(run.stats.kills, guardIds.length);
  assert.equal(run.stats.retired, 0);
  assert.equal(run.enemies.filter((enemy) => enemy.active && enemy.role === 'elite').length, 1);
});

test('V2 pulse charge requires displacement, so tiny loops cannot manufacture full power', () => {
  const run = quiet();
  run.build.combat.push({ id: 'proximity-pulse', rank: 2 });
  run._cooldowns['proximity-pulse'] = 100;
  const x = run.player.x,
    y = run.player.y;
  for (let i = 0; i < 180; i++) stepOverflight(run, { x: Math.cos(i * 0.3), y: Math.sin(i * 0.3) });
  assert.ok(Math.hypot(run.player.x - x, run.player.y - y) < 35);
  assert.ok(run.player.pulseCharge < 0.4);
  for (let i = 0; i < 45; i++) stepOverflight(run, { x: 1 });
  assert.equal(run.player.pulseCharge, 1);
});

test('current caches queue the second guard encounter without losing either reward opportunity', () => {
  const compiled = compileOverflightProject(createOverflightProject({ rulesVersion: 3 }));
  const run = createOverflightRun(compiled);
  startOverflight(run);
  run.time = 220;
  run.tick = 13200;
  const update = () =>
    updateOverflightCaches(
      run,
      (options) => spawnOverflightEnemy(run, options),
      () => {},
    );
  const originalRewardCounts = run.caches.map((cache) => cache.rewards.length);
  update();
  assert.equal(run.caches[0].state, 'locked');
  assert.equal(run.caches[1].state, 'dormant');
  assert.equal(run.caches[1].guardIds.length, 0);
  const admitted = run.stats.spawned;
  update();
  assert.equal(run.stats.spawned, admitted, 'waiting cannot create additional guard packs');
  const first = run.caches[0];
  for (const enemy of run.enemies) if (first.guardIds.includes(enemy.id)) enemy.active = false;
  update();
  assert.equal(first.state, 'open');
  assert.equal(run.caches[1].state, 'locked');
  assert.equal(run.caches.filter((cache) => cache.state === 'locked').length, 1);
  assert.deepEqual(
    run.caches.map((cache) => cache.rewards.length),
    originalRewardCounts,
  );
  assert.equal(
    first.selectedReward,
    null,
    'opening a later encounter cannot spend an earlier reward',
  );
  assert.equal(run.caches[1].guardIds.length, compiled.combat.supplies.guardCount);
});
