import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightTerrainFixture,
  createOverflightTerrain,
  validateOverflightTerrain,
  overflightTerrainClear,
  overflightTerrainWaypoint,
  moveOverflightThroughTerrain,
  damageOverflightTerrain,
  constrainOverflightTerrainAttack,
} from '../overflight/terrain.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  spawnOverflightEnemy,
  damageOverflightArea,
} from '../overflight/core.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import {
  createOverflightHuntRun,
  startOverflightHunt,
  stepOverflightHunt,
  spawnOverflightHuntEnemy,
} from '../overflight/raid-core.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import { overflightAttackContains, hasOverflightEscape } from '../overflight/tactics.mjs';
import { overflightAttackLayers } from '../overflight/tactical-view.mjs';

const arena = { width: 2880, height: 1080 };
const terrain = () => createOverflightTerrain(createOverflightTerrainFixture(arena), arena);
const source = (raid = false) => {
  const project = raid
    ? createOverflightHuntProject({ rulesVersion: 3 })
    : createOverflightProject({ rulesVersion: 3 });
  project.terrain = createOverflightTerrainFixture(arena);
  return project;
};
function quiet(raid = false) {
  const compiled = structuredClone(
    raid ? compileOverflightHuntProject(source(true)) : compileOverflightProject(source()),
  );
  compiled.encounters = [];
  compiled.goals = { eliteAt: 10000, finalAt: 20000, finalHp: 2400 };
  const run = raid ? createOverflightHuntRun(compiled) : createOverflightRun(compiled);
  run.caches = [];
  if (raid) startOverflightHunt(run);
  else startOverflight(run);
  return run;
}

test('terrain admission preserves broad connected routes and rejects obstructed experimental layouts', () => {
  const fixture = createOverflightTerrainFixture();
  assert.equal(fixture.obstacles.filter((o) => o.breakable).length, 2);
  assert.deepEqual(validateOverflightTerrain(fixture, arena), fixture);
  const blocked = structuredClone(fixture);
  blocked.obstacles[0].y = 510;
  assert.throws(() => validateOverflightTerrain(blocked, arena), /central 240/);
  const narrow = structuredClone(fixture);
  narrow.obstacles[1].x = 300;
  narrow.obstacles[1].y = 360;
  assert.throws(() => validateOverflightTerrain(narrow, arena), /central 240|passages/);
  for (const raid of [false, true]) {
    const compiled = raid
      ? compileOverflightHuntProject(source(true))
      : compileOverflightProject(source());
    assert.equal(compiled.terrain.obstacles.length, 8);
  }
});

test('fast diagonal crossings slide along solid faces and preserve hull', () => {
  const state = terrain();
  const actor = { x: 180, y: 190, radius: 9, vx: 400, vy: 120, hull: 100 };
  moveOverflightThroughTerrain(state, actor, 520, 280);
  assert.ok(actor.x <= 241);
  assert.ok(actor.y > 190);
  assert.equal(actor.hull, 100);
  assert.ok(overflightTerrainClear(state, actor.x, actor.y, actor.x, actor.y, actor.radius));
});

test('barriers require two distinct passes or payloads and held contact cannot farm a second hit', () => {
  const state = terrain(),
    barrier = state.obstacles.find((o) => o.breakable);
  const actor = { x: 760, y: 300, radius: 9 };
  moveOverflightThroughTerrain(state, actor, 850, 300, { boostToken: 1 });
  assert.equal(barrier.hp, 1);
  moveOverflightThroughTerrain(state, actor, 850, 300, { boostToken: 2 });
  assert.equal(barrier.hp, 1, 'new boost while still touching is not a new approach');
  actor.x = 750;
  moveOverflightThroughTerrain(state, actor, 850, 300, { boostToken: 3 });
  assert.equal(barrier.active, false);
  assert.equal(state.revision, 1);
  const other = state.obstacles.find((o) => o.breakable && o.active);
  damageOverflightTerrain(state, other.x - 10, other.y + 20, 30, 'one');
  damageOverflightTerrain(state, other.x - 10, other.y + 20, 30, 'one');
  assert.equal(other.hp, 1);
  damageOverflightTerrain(state, other.x - 10, other.y + 20, 30, 'two');
  assert.equal(other.active, false);
});

test('navigation routes around permanent cover and keeps a finite shared target cache', () => {
  const state = terrain();
  const actor = { x: 180, y: 240, radius: 10 },
    goal = { x: 520, y: 240 };
  for (let tick = 0; tick < 600 && Math.hypot(goal.x - actor.x, goal.y - actor.y) > 4; tick++) {
    const next = overflightTerrainWaypoint(state, actor, goal, arena);
    const dx = next.x - actor.x,
      dy = next.y - actor.y,
      length = Math.hypot(dx, dy);
    moveOverflightThroughTerrain(
      state,
      actor,
      actor.x + (dx / length) * Math.min(3, length),
      actor.y + (dy / length) * Math.min(3, length),
    );
    assert.ok(overflightTerrainClear(state, actor.x, actor.y, actor.x, actor.y, actor.radius));
  }
  assert.ok(
    Math.hypot(goal.x - actor.x, goal.y - actor.y) < 5,
    'target remains reachable around cover',
  );
  for (let x = 270; x < 2800; x += 20)
    overflightTerrainWaypoint(state, { x: 180, y: 240, radius: 9 }, { x, y: 240 }, arena);
  assert.ok(state.fields.size <= 64);
});

test('committed cover clipping is identical for warnings and hits after a barrier breaks', () => {
  const state = terrain();
  const spec = {
    kind: 'lane',
    originX: 730,
    originY: 300,
    heading: 0,
    length: 620,
    radius: 8,
    remaining: 1.2,
  };
  const committed = constrainOverflightTerrainAttack(state, spec);
  assert.equal(committed.rayLengths[0], 62);
  assert.equal(overflightAttackContains(committed, 920, 300, 9), false);
  const lines = overflightAttackLayers(committed).filter((layer) => layer.frame === 'bar');
  assert.ok(lines.every((line) => line.width === 62));
  damageOverflightTerrain(state, 790, 300, 40, 1);
  damageOverflightTerrain(state, 790, 300, 40, 2);
  assert.equal(overflightAttackContains(committed, 920, 300, 9), false);
  const fresh = constrainOverflightTerrainAttack(state, spec);
  assert.ok(fresh.rayLengths[0] > committed.rayLengths[0]);
});

test('area damage inspects every visible candidate but cover prevents blast tunnelling', () => {
  const run = quiet();
  for (let i = 0; i < 90; i++)
    spawnOverflightEnemy(run, { x: 720, y: 285 + (i % 20), hp: 10, speed: 0, warning: 0 });
  const protectedEnemy = spawnOverflightEnemy(run, {
    x: 920,
    y: 300,
    hp: 100,
    speed: 0,
    warning: 0,
  });
  rebuildOverflightGrid(run._grid, run.enemies);
  const first = damageOverflightArea(run, 730, 300, 260, 30, { terrainStrike: 1 });
  assert.equal(first, 90);
  assert.equal(protectedEnemy.hp, 100);
  assert.equal(run.stats.kills, 90);
  damageOverflightArea(run, 730, 300, 260, 30, { terrainStrike: 2 });
  assert.equal(protectedEnemy.hp, 100, 'breaking the wall cannot extend the same blast');
  damageOverflightArea(run, 730, 300, 260, 30, { terrainStrike: 3 });
  assert.equal(protectedEnemy.hp, 70);
  assert.equal(run.stats.kills, 90, 'barriers do not award kills, salvage or Rush');
});

test('native Survivor and Raid movement cannot cross cover or damage hull through wall contact', () => {
  for (const raid of [false, true]) {
    const run = quiet(raid);
    Object.assign(run.player, { x: 180, y: 240, hull: 100 });
    const before = run.stats.damageTaken;
    for (let tick = 0; tick < 180; tick++) {
      (raid ? stepOverflightHunt : stepOverflight)(run, { x: 1, y: 0, boost: tick % 90 === 0 });
      assert.ok(
        overflightTerrainClear(
          run.terrain,
          run.player.x,
          run.player.y,
          run.player.x,
          run.player.y,
          run.player.radius,
        ),
      );
    }
    assert.ok(run.player.x <= 241);
    assert.equal(run.stats.damageTaken, before);
    assert.ok(run.terrain.obstacles.every((o) => !o.breakable || o.hp === 2));
  }
});

test('freight convoy reaches a firing stop before committing, preserves armor and resumes after recovery', () => {
  const run = quiet(true);
  run.compiled.encounterProfile = 'freight-depot.v1';
  Object.assign(run.player, { x: 700, y: 540 });
  const enemy = spawnOverflightHuntEnemy(run, {
    family: 'tracked-tank',
    objectiveId: 'convoy-proof',
    x: 400,
    y: 540,
    warning: 0,
    behaviorPhase: 'guarding',
    phaseRemaining: 0,
    speed: 90,
    route: [
      { x: 490, y: 540 },
      { x: 400, y: 540 },
    ],
    armorSegments: 3,
  });
  for (let i = 0; i < 30; i++) stepOverflightHunt(run);
  assert.ok(enemy.x > 430 && enemy.x < 490);
  assert.equal(enemy.behaviorPhase, 'guarding');
  assert.equal(enemy.armorSegments, 3);
  for (let i = 0; i < 90 && enemy.behaviorPhase !== 'windup'; i++) stepOverflightHunt(run);
  assert.equal(enemy.behaviorPhase, 'windup');
  const parked = enemy.x;
  for (let i = 0; i < 30; i++) stepOverflightHunt(run);
  assert.equal(enemy.x, parked);
  for (let i = 0; i < 400 && !(enemy.behaviorPhase === 'guarding' && enemy.x < parked - 5); i++) {
    run.player.invulnerable = 2;
    stepOverflightHunt(run);
  }
  assert.ok(enemy.x < parked - 5, 'convoy resumes its authored route after exposure');
});

test('warning admission rejects an escape that is geometrically outside danger but behind cover', () => {
  const run = quiet();
  Object.assign(run.player, { x: 240, y: 240 });
  const candidate = { kind: 'ground', x: 100, y: 240, radius: 245, remaining: 1.2 };
  assert.equal(hasOverflightEscape(run, candidate), false);
  const terrain = run.terrain;
  run.terrain = null;
  assert.equal(hasOverflightEscape(run, candidate), true);
  run.terrain = terrain;
});

test('native pursuit and authored Raid routes reach the far side of permanent cover', () => {
  for (const raid of [false, true]) {
    const run = quiet(raid);
    Object.assign(run.player, { x: 540, y: 240, invulnerable: 20 });
    run._cooldowns.primary = 1000;
    const enemy = (raid ? spawnOverflightHuntEnemy : spawnOverflightEnemy)(run, {
      family: 'patroller',
      x: 180,
      y: 240,
      warning: 0,
      speed: 100,
      hp: 10000,
      route: [{ x: 540, y: 240 }],
    });
    for (let tick = 0; tick < 430 && enemy.x < 475; tick++) {
      (raid ? stepOverflightHunt : stepOverflight)(run);
      assert.ok(
        overflightTerrainClear(run.terrain, enemy.x, enemy.y, enemy.x, enemy.y, enemy.radius),
      );
    }
    assert.ok(enemy.x > 475, `${raid ? 'Raid' : 'Survivor'} navigates around cover`);
  }
});

test('Riy escort following navigates around cover without changing its command clock', async () => {
  const { createOverflightRiy, stepOverflightRiy } = await import('../overflight/riy-core.mjs');
  const { createOverflightRiyProject, compileOverflightRiyProject } = await import(
    '../overflight/riy-project.mjs'
  );
  const project = createOverflightRiyProject({ rulesVersion: 3 });
  project.terrain = createOverflightTerrainFixture();
  const compiled = structuredClone(compileOverflightRiyProject(project));
  compiled.encounters = [];
  const run = createOverflightRun(compiled);
  startOverflight(run);
  Object.assign(run.player, { x: 560, y: 240, heading: 0 });
  run.riy = createOverflightRiy(run);
  run.riy.escorts.forEach((escort) => {
    escort.x = 180;
    escort.y = 240;
  });
  for (let i = 0; i < 300; i++) {
    stepOverflightRiy(run);
    for (const escort of run.riy.escorts)
      assert.ok(overflightTerrainClear(run.terrain, escort.x, escort.y, escort.x, escort.y, 9));
  }
  assert.ok(run.riy.escorts.every((escort) => escort.x > 450));
  assert.equal(run.riy.commands, 0);
});

test('fired Raid projectiles retain their warned cover range after a barrier is destroyed', () => {
  const run = quiet(true);
  Object.assign(run.player, { x: 920, y: 300 });
  const enemy = spawnOverflightHuntEnemy(run, {
    family: 'brace-trooper',
    x: 730,
    y: 300,
    warning: 0,
    speed: 0,
    behaviorPhase: 'burst',
    phaseRemaining: 5,
  });
  enemy.heading = 0;
  enemy.attackSpec = constrainOverflightTerrainAttack(run.terrain, {
    kind: 'lane',
    originX: 730,
    originY: 300,
    heading: 0,
    length: 620,
    radius: 8,
    remaining: 1.2,
  });
  enemy.burstNextTick = 1;
  stepOverflightHunt(run);
  assert.equal(run.stats.projectilesFired, 1);
  damageOverflightTerrain(run.terrain, 790, 300, 40, 1);
  damageOverflightTerrain(run.terrain, 790, 300, 40, 2);
  for (let i = 0; i < 60; i++) stepOverflightHunt(run);
  assert.equal(run.player.hull, 100);
  assert.equal(run.projectiles.filter((p) => p.active).length, 0);
});
