import assert from 'node:assert/strict';
import test from 'node:test';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  spawnOverflightEnemy,
  damageOverflightArea,
  pauseOverflight,
  resumeOverflight,
} from '../overflight/core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import {
  createOverflightCaches,
  updateOverflightCaches,
  hasOverflightEscape,
  overflightAttackContains,
} from '../overflight/tactics.mjs';
import { overflightPayload, overflightModuleParameters } from '../overflight/upgrades.mjs';

function quiet(difficulty = 'standard', rulesVersion = 3) {
  const compiled = structuredClone(
    compileOverflightProject(createOverflightProject({ difficulty, rulesVersion })),
  );
  compiled.encounters = [];
  compiled.goals.eliteAt = 10000;
  compiled.goals.finalAt = 20000;
  const run = createOverflightRun(compiled, { airframes: 3 });
  startOverflight(run);
  run._cooldowns.primary = 10000;
  run.caches = [];
  return run;
}
const advance = (run, ticks, input = {}) => {
  for (let i = 0; i < ticks; i++) stepOverflight(run, input);
};
const contact = (run) => {
  run.player.invulnerable = 0;
  const e = spawnOverflightEnemy(run, {
    x: run.player.x,
    y: run.player.y,
    hp: 1000,
    speed: 0,
    warning: 0,
  });
  stepOverflight(run);
  rebuildOverflightGrid(run._grid, run.enemies);
  damageOverflightArea(run, e.x, e.y, 30, 100000);
};

test('V3 profiles preserve earlier rules and give Relaxed its starting friendly bonus', () => {
  assert.equal(compileOverflightProject(createOverflightProject()).rulesVersion, 2);
  for (const [difficulty, warning, relief, priority, bonus] of [
    ['relaxed', 1.4, 10, 1, 1.15],
    ['standard', 1.2, 8, 2, 1],
    ['veteran', 1, 5, 2, 1],
  ]) {
    const run = quiet(difficulty);
    assert.equal(run.compiled.balanceRevision, 'overflight-balance.v3');
    assert.equal(run.compiled.combat.attacks.warningSeconds, warning);
    assert.equal(run.compiled.combat.pacing.reliefSeconds, relief);
    assert.equal(run.priorityAttacks.length, priority);
    const e = spawnOverflightEnemy(run, {
      x: 500,
      y: 500,
      hp: 100,
      speed: 0,
      warning: 0,
    });
    rebuildOverflightGrid(run._grid, run.enemies);
    damageOverflightArea(run, 500, 500, 20, 20);
    assert.ok(Math.abs(e.hp - (100 - 20 * bonus)) < 1e-8);
  }
  assert.equal(overflightModuleParameters('shield', 3, 2).recharge, 5);
  assert.equal(overflightModuleParameters('shield', 3, 3).recharge, 6);
});

test('Echo anchors three rear impacts to release heading while the front stays vulnerable', () => {
  const run = quiet();
  run.build.primary = { rank: 4, branch: 'double', evolved: true };
  run.player.x = 1000;
  run.player.y = 500;
  run.player.heading = 0;
  const legacy = overflightPayload(run.build, 2);
  assert.equal(legacy.radius, 60);
  assert.equal(legacy.rearOffsets, undefined);
  const front = spawnOverflightEnemy(run, {
    x: 1040,
    y: 500,
    hp: 300,
    speed: 0,
    warning: 0,
  });
  const rear = spawnOverflightEnemy(run, {
    x: 900,
    y: 500,
    hp: 300,
    speed: 0,
    warning: 0,
  });
  run._cooldowns.primary = 0;
  stepOverflight(run);
  assert.deepEqual(
    run._echoes.filter((e) => e.active).map((e) => [e.x, e.y, e.radius]),
    [
      [944, 500, 44],
      [892, 500, 52],
      [840, 500, 60],
    ],
  );
  advance(run, 55, { y: -1 });
  assert.equal(front.hp, 300);
  assert.ok(rear.hp < 300);
});

test('shield recovery keeps progress through hits and adds at most two seconds per cycle', () => {
  const run = quiet();
  run.build.support = { id: 'shield', rank: 3 };
  run.player.shield = 1;
  contact(run);
  assert.equal(run.player.shield, 0);
  assert.equal(run.player.shieldCooldown, 6);
  advance(run, 60);
  assert.ok(run.player.shieldCooldown <= 5.01);
  contact(run);
  contact(run);
  contact(run);
  assert.equal(run.player.shieldPauseAdded, 2);
  assert.ok(run.player.shieldCooldown <= 5.01, 'hits never reset elapsed recovery');
  advance(run, 425);
  assert.equal(run.player.shield, 1, 'defense eventually returns despite repeated interruption');
  contact(run);
  assert.equal(
    run.player.shieldPauseAdded,
    0,
    'consuming recovered shield starts a fresh bounded cycle',
  );
});

test('stored Overdrive waits for a fresh boost, pauses with gameplay and cannot refresh', () => {
  const run = quiet();
  run.player.overdriveReady = true;
  run._boostHeld = true;
  stepOverflight(run, { boost: true });
  assert.equal(run.player.overdriveRemaining, 0);
  stepOverflight(run, { boost: false });
  stepOverflight(run, { boost: true });
  assert.equal(run.player.overdriveRemaining, 6);
  assert.equal(run.player.overdriveReady, false);
  assert.equal(run.attackRate, 1.25);
  run._cooldowns.primary = 1;
  advance(run, 12);
  assert.ok(Math.abs(run._cooldowns.primary - 0.75) < 1e-8);
  const remaining = run.player.overdriveRemaining;
  pauseOverflight(run);
  advance(run, 120);
  assert.equal(run.player.overdriveRemaining, remaining);
  resumeOverflight(run);
  advance(run, 370);
  assert.equal(run.attackRate, 1);
  assert.equal(run.player.overdriveRemaining, 0);
});

test('warning admission rejects body-blocked exits while preserving a real opening', () => {
  const run = quiet();
  run.player.x = 600;
  run.player.y = 500;
  const attack = { kind: 'ground', x: 600, y: 500, radius: 45, remaining: 1.2 };
  assert.equal(hasOverflightEscape(run, attack), true);
  const ring = [];
  for (let i = 0; i < 24; i++)
    ring.push(
      spawnOverflightEnemy(run, {
        x: 600 + Math.cos((i * Math.PI) / 12) * 70,
        y: 500 + Math.sin((i * Math.PI) / 12) * 70,
        hp: 100,
        speed: 0,
        warning: 0,
      }),
    );
  rebuildOverflightGrid(run._grid, run.enemies);
  assert.equal(hasOverflightEscape(run, attack), false);
  for (let i = 0; i < 5; i++) ring[i].active = false;
  rebuildOverflightGrid(run._grid, run.enemies);
  assert.equal(hasOverflightEscape(run, attack), true);
});

test('fired ground danger survives its owner, reserves the threat slot and expires within two seconds', () => {
  const run = quiet();
  const owner = spawnOverflightEnemy(run, {
    family: 'tracked-tank',
    x: 100,
    y: 100,
    hp: 100,
    speed: 0,
    warning: 0,
  });
  const attack = run.priorityAttacks[0];
  Object.assign(attack, {
    active: true,
    stage: 'warning',
    owner: owner.id,
    kind: 'ground',
    x: run.player.x,
    y: run.player.y,
    radius: 45,
    damage: 20,
    remaining: 0.01,
  });
  stepOverflight(run);
  assert.equal(attack.stage, 'active');
  assert.equal(attack.remaining, 2);
  assert.equal(run.stats.damageCauses.ground, 20);
  rebuildOverflightGrid(run._grid, run.enemies);
  damageOverflightArea(run, 100, 100, 50, 100000);
  assert.equal(owner.active, false);
  assert.equal(attack.active, true);
  advance(run, 119, { x: 1 });
  assert.equal(attack.active, true);
  advance(run, 2, { x: 1 });
  assert.equal(attack.active, false);
});

test('replacement checks the full fired lane instead of only its aim point', () => {
  const run = quiet();
  run.player.hull = 1;
  const lane = {
    active: true,
    stage: 'active',
    kind: 'lane',
    originX: 0,
    originY: run.player.y,
    heading: 0,
    length: 2880,
    radius: 8,
    remaining: 2,
    damage: 20,
    owner: -1,
    x: 0,
    y: 0,
  };
  Object.assign(run.priorityAttacks[0], lane);
  stepOverflight(run);
  assert.equal(run.stats.airframesLost, 1);
  assert.equal(
    overflightAttackContains(lane, run.player.x, run.player.y, run.player.radius + 20),
    false,
  );
  assert.equal(run.player.invulnerable, 1.5);
});

test('surviving ranged attackers continue committed cycles during relief without fresh crowds', () => {
  const run = quiet();
  run.compiled.encounters = [
    {
      id: 'relief',
      start: 0,
      end: 30,
      pattern: 'relief',
      spawnPerSecond: 0,
      families: ['patroller'],
    },
  ];
  const e = spawnOverflightEnemy(run, {
    family: 'brace-trooper',
    x: run.player.x + 220,
    y: run.player.y,
    hp: 1000,
    speed: 62,
    warning: 0,
  });
  e.attackCooldown = 0;
  advance(run, 20);
  assert.ok(run.priorityAttacks.some((a) => a.active));
  assert.ok(Math.abs(e.x - run.player.x) >= 180);
  assert.equal(run.stats.spawned, 1);
});

test('machinery resists slow fields while ordinary pursuit retains its full slowing effect', () => {
  const run = quiet();
  const ordinary = spawnOverflightEnemy(run, {
    x: 100,
    y: 100,
    hp: 100,
    warning: 0,
  });
  const machinery = spawnOverflightEnemy(run, {
    family: 'armored-carrier',
    x: 100,
    y: 100,
    hp: 100,
    warning: 0,
  });
  rebuildOverflightGrid(run._grid, run.enemies);
  damageOverflightArea(run, 100, 100, 50, 1, {
    slow: 0.55,
    slowMultiplier: 0.55,
  });
  assert.equal(ordinary.slowMultiplier, 0.55);
  assert.equal(machinery.slowMultiplier, 0.75);
});

test('supply Overdrive requires a deliberate return and cannot replace a stored or active charge', () => {
  const run = quiet();
  run.caches = createOverflightCaches(run.compiled);
  const cache = run.caches[0],
    reward = cache.rewards.find((r) => r.id === 'overdrive');
  cache.state = 'open';
  run.player.x = reward.x;
  run.player.y = reward.y;
  const update = () =>
    updateOverflightCaches(
      run,
      () => {
        throw Error('Unexpected spawn');
      },
      () => {},
    );
  update();
  assert.equal(run.player.overdriveReady, false);
  run.player.y += 100;
  update();
  assert.equal(cache.armed, true);
  run.player.y -= 100;
  run.player.overdriveRemaining = 3;
  update();
  assert.equal(cache.state, 'open');
  assert.equal(reward.enabled, false);
  run.player.overdriveRemaining = 0;
  run.player.overdriveReady = true;
  update();
  assert.equal(cache.state, 'open');
  assert.equal(reward.enabled, false);
  run.player.overdriveReady = false;
  update();
  assert.equal(cache.state, 'claimed');
  assert.equal(run.player.overdriveReady, true);
  assert.equal(run.player.overdriveRemaining, 0);
  assert.equal(run._boostHeld, true);
  update();
  assert.equal(run.player.overdriveRemaining, 0);
});
