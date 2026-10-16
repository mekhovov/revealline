import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightRun, startOverflight, spawnOverflightEnemy } from '../overflight/core.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
} from '../overflight/riy-project.mjs';
import { createOverflightRiy, stepOverflightRiy } from '../overflight/riy-core.mjs';
import {
  applyOverflightRiyUpgrade,
  legalOverflightRiyUpgrades,
} from '../overflight/riy-upgrades.mjs';
import { rebuildOverflightGrid } from '../overflight/grid.mjs';
import { overflightTerrainClear } from '../overflight/terrain.mjs';
import { overflightEscortShotLayers } from '../overflight/tactical-view.mjs';

function covered(role = 'breaker', rulesVersion = 4) {
  const compiled = structuredClone(
    compileOverflightRiyProject(createOverflightRiyProject({ rulesVersion })),
  );
  compiled.encounters = [];
  compiled.terrain = {
    format: 'OverflightTerrainV2',
    id: 'riy-cover-regression',
    experimental: false,
    obstacles: [{ id: 'wall', x: 1280, y: 600, width: 32, height: 120, breakable: false }],
  };
  const run = createOverflightRun(compiled);
  const config = compiled.riy.escorts.find((item) => item.role === role);
  run.player.heading = 0;
  run.player.x = (role === 'breaker' ? 1200 : 1400) - config.forward;
  run.player.y = 650 - config.lateral;
  run.camera.x = run.player.x;
  run.camera.y = run.player.y;
  run.riy = createOverflightRiy(run);
  startOverflight(run);
  for (const escort of run.riy.escorts) escort.cooldown = escort.role === role ? 0 : 10000;
  return { run, escort: run.riy.escorts.find((item) => item.role === role) };
}

function enemy(run, x, y, extra = {}) {
  const target = spawnOverflightEnemy(run, {
    family: 'patroller',
    x,
    y,
    hp: 1000,
    speed: 0,
    warning: 0,
    ...extra,
  });
  rebuildOverflightGrid(run._grid, run.enemies);
  return target;
}

function upgrade(run, branch) {
  const card = legalOverflightRiyUpgrades(run.build).find(
    (item) => item.role === 'breaker' && item.branch === branch,
  );
  assert.ok(applyOverflightRiyUpgrade(run.build, card, run.compiled.upgrades.modules));
}

for (const rulesVersion of [3, 4]) {
  for (const role of ['sweeper', 'breaker']) {
    test(`rules ${rulesVersion} ${role} selects a clear follow target instead of firing into cover`, () => {
      const { run, escort } = covered(role, rulesVersion);
      const blocked = enemy(run, role === 'breaker' ? 1330 : 1260, 650, { role: 'elite' });
      // Sweeper ranks distance; keep its blocked target nearer than the clear one.
      if (role === 'sweeper') blocked.x = 1270;
      const clear = enemy(run, role === 'breaker' ? 1260 : 1320, role === 'breaker' ? 730 : 744);
      if (role === 'sweeper') {
        escort.x = 1370;
        run.player.x -= 30;
      }
      assert.equal(
        overflightTerrainClear(run.terrain, escort.x, escort.y, blocked.x, blocked.y),
        false,
      );
      assert.equal(overflightTerrainClear(run.terrain, escort.x, escort.y, clear.x, clear.y), true);
      stepOverflightRiy(run);
      assert.equal(blocked.hp, 1000);
      assert.ok(clear.hp < 1000);
      assert.equal(escort.shots, 1);
      assert.equal(escort.targetX, clear.x);
      assert.ok(escort.cooldown > 0);
    });
  }
}

test('blocked follow attack preserves its weapon cycle until a clear shot exists', () => {
  const { run, escort } = covered();
  const target = enemy(run, 1340, 650);
  for (let tick = 0; tick < 20; tick++) stepOverflightRiy(run);
  assert.equal(target.hp, 1000);
  assert.equal(escort.cooldown, 0);
  assert.equal(escort.shots, 0);
  assert.equal(escort.beamRemaining, 0);
  assert.equal(run.stats.hits, 0);
  run.terrain.obstacles[0].active = false;
  stepOverflightRiy(run);
  assert.equal(target.hp, 964);
  assert.equal(escort.shots, 1);
  assert.ok(escort.cooldown > 0);
});

test('a covered chain victim cannot take a damage share or bridge to another victim behind the wall', () => {
  const { run, escort } = covered();
  upgrade(run, 'chain');
  const first = enemy(run, 1260, 650);
  const blocked = enemy(run, 1330, 650);
  const behind = enemy(run, 1340, 665);
  stepOverflightRiy(run);
  assert.ok(Math.abs(first.hp - 960.4) < 1e-8);
  assert.equal(blocked.hp, 1000);
  assert.equal(behind.hp, 1000);
  assert.ok(Math.abs(run.stats.damageDealt - 39.6) < 1e-8);
  assert.equal(run.stats.hits, 1);
  assert.equal(escort.shots, 1);
  assert.equal(escort.shotSegmentCount, 1);
  assert.equal(escort.shotSegments[0].targetX, first.x);
});

test('chain divides the unchanged damage budget only among reachable link victims', () => {
  const { run } = covered();
  upgrade(run, 'chain');
  const first = enemy(run, 1260, 650);
  const blocked = enemy(run, 1320, 650);
  const clear = enemy(run, 1260, 715);
  stepOverflightRiy(run);
  assert.ok(Math.abs(first.hp - 980.2) < 1e-8);
  assert.ok(Math.abs(clear.hp - 980.2) < 1e-8);
  assert.equal(blocked.hp, 1000);
  assert.ok(Math.abs(run.stats.damageDealt - 39.6) < 1e-8);
  assert.equal(run.stats.hits, 2);
});

test('chain can turn around a corner when every individual link has clear line of fire', () => {
  const { run, escort } = covered();
  upgrade(run, 'chain');
  const victims = [enemy(run, 1260, 650), enemy(run, 1260, 590), enemy(run, 1320, 590)];
  assert.equal(
    overflightTerrainClear(run.terrain, escort.x, escort.y, victims[2].x, victims[2].y),
    false,
  );
  stepOverflightRiy(run);
  assert.ok(victims.every((target) => Math.abs(target.hp - 986.8) < 1e-8));
  assert.ok(Math.abs(run.stats.damageDealt - 39.6) < 1e-8);
  assert.equal(run.stats.hits, 3);
  assert.equal(escort.shotSegmentCount, 3);
  assert.deepEqual(
    escort.shotSegments.map((s) => [s.x, s.y, s.targetX, s.targetY]),
    [
      [escort.x, escort.y, 1260, 650],
      [1260, 650, 1260, 590],
      [1260, 590, 1320, 590],
    ],
  );
  const normal = overflightEscortShotLayers(escort);
  const reduced = overflightEscortShotLayers(escort, true);
  assert.equal(normal.length, 3);
  assert.deepEqual(
    normal.map(({ alpha, ...geometry }) => geometry),
    reduced.map(({ alpha, ...geometry }) => geometry),
  );
  // Presentation records the accepted hit, not a new straight beam through the
  // wall when the escort and victims move during the 120ms impact feedback.
  escort.x += 100;
  victims[1].x += 100;
  assert.deepEqual(overflightEscortShotLayers(escort), normal);
  escort.beamRemaining = 0;
  assert.deepEqual(overflightEscortShotLayers(escort), []);
});

test('a burst second hit respects newly obstructed contact without drawing a false beam', () => {
  const { run, escort } = covered();
  upgrade(run, 'burst');
  const target = enemy(run, 1260, 650);
  stepOverflightRiy(run);
  assert.equal(escort.shots, 1);
  assert.ok(escort.pending);
  const hp = target.hp;
  target.x = 1340;
  rebuildOverflightGrid(run._grid, run.enemies);
  for (let tick = 0; tick < 12; tick++) stepOverflightRiy(run);
  assert.equal(target.hp, hp);
  assert.equal(escort.shots, 1);
  assert.equal(escort.beamRemaining, 0);
  assert.equal(escort.pending, null);
  assert.equal(run.stats.hits, 1);
});

test('Focus can approach a covered target while blocked weapons wait for line of fire', () => {
  const { run, escort } = covered();
  run.riy.rules = { ...run.riy.rules, escortSpeed: 1 };
  const target = enemy(run, 1340, 650);
  stepOverflightRiy(run, { focus: true });
  assert.equal(run.riy.targetId, target.id);
  assert.equal(run.riy.commands, 1);
  assert.equal(escort.shots, 0);
  assert.equal(escort.cooldown, 0);
  assert.equal(target.hp, 1000);
});
