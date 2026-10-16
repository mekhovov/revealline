import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  spawnOverflightEnemy,
  dropOverflightSalvage,
} from '../overflight/core.mjs';
import { createOverflightTerrain, overflightTerrainClear } from '../overflight/terrain.mjs';
import { pilot } from '../overflight/review-pilot.mjs';
function quiet() {
  const source = structuredClone(
    compileOverflightProject(createOverflightProject({ rulesVersion: 4 })),
  );
  source.encounters = [];
  source.goals = { eliteAt: 10000, finalAt: 20000, finalHp: 2400 };
  const run = createOverflightRun(source);
  startOverflight(run);
  run.caches = [];
  run.player.x = 1200;
  run.player.y = 540;
  run.terrain = null;
  return run;
}

test('review steering routes around cover to collect salvage through public movement input', () => {
  const run = quiet();
  run.terrain = createOverflightTerrain(
    {
      format: 'OverflightTerrainV2',
      id: 'pilot-cover-test',
      experimental: false,
      obstacles: [{ id: 'wall', x: 1240, y: 480, width: 120, height: 120, breakable: false }],
    },
    run.compiled.arena,
  );
  dropOverflightSalvage(run, 1480, 540, 1);
  let input = {};
  for (let i = 0; i < 300 && run.stats.xpCollected === 0; i++) {
    if (run.tick % 6 === 0) {
      const position = [run.player.x, run.player.y, run.player.hull];
      input = pilot(run, 'echo');
      assert.deepEqual(
        [run.player.x, run.player.y, run.player.hull],
        position,
        'review policy cannot move or heal the player',
      );
      assert.ok(
        overflightTerrainClear(
          run.terrain,
          run.player.x,
          run.player.y,
          run.player.x + input.x * run.flight.speed * 0.5,
          run.player.y + input.y * run.flight.speed * 0.5,
          run.player.radius,
        ),
      );
    }
    stepOverflight(run, input);
  }
  assert.equal(run.stats.xpCollected, 1);
  assert.ok(run.player.x > 1360, 'the route passed the full cover footprint');
});

test('review avoidance predicts the actual V4 crossing, independently of obsolete pursuit steering', () => {
  const run = quiet();
  run.player.boostCooldown = 1;
  dropOverflightSalvage(run, 1480, 540, 1);
  const enemy = spawnOverflightEnemy(run, { x: 1260, y: 440, speed: 200, warning: 0 });
  Object.assign(enemy, { _motionVX: 0, _motionVY: 200, steeringX: 1, steeringY: 0 });
  const input = pilot(run, 'fan');
  const rx = run.player.x - enemy.x,
    ry = run.player.y - enemy.y;
  const sx = input.x * run.flight.speed * 0.5,
    sy = (input.y * run.flight.speed - enemy._motionVY) * 0.5;
  const t = Math.max(0, Math.min(1, -(rx * sx + ry * sy) / (sx * sx + sy * sy)));
  assert.ok(Math.hypot(rx + sx * t, ry + sy * t) > run.player.radius + enemy.radius + 6);
  assert.equal(input.boost, false);
});
