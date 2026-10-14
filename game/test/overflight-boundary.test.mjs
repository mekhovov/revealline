import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightRun,
  startOverflight,
  spawnOverflightEnemy,
  stepOverflight,
} from '../overflight/core.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';

function scenario(rulesVersion, pattern, edge) {
  const compiled = structuredClone(
    compileOverflightProject(createOverflightProject({ rulesVersion })),
  );
  compiled.encounters = [];
  compiled.goals.eliteAt = 10000;
  compiled.goals.finalAt = 20000;
  const run = createOverflightRun(compiled);
  startOverflight(run);
  run._cooldowns.primary = 10000;
  const enemy = spawnOverflightEnemy(run, {
    family: 'runner',
    x: edge.x,
    y: edge.y,
    hp: 1000,
    speed: 96,
    warning: 0,
    pattern,
  });
  enemy.vx = enemy.steeringX = edge.dx;
  enemy.vy = enemy.steeringY = edge.dy;
  return { run, enemy };
}
const edges = [
  { x: 40, y: 540, dx: -1, dy: 0 },
  { x: 2840, y: 540, dx: 1, dy: 0 },
  { x: 1440, y: 40, dx: 0, dy: -1 },
  { x: 1440, y: 1040, dx: 0, dy: 1 },
];
for (const pattern of ['crossing', 'flank']) {
  test(`V3 ${pattern} completes its first pass at each boundary; legacy stays unchanged`, () => {
    for (const edge of edges) {
      const modern = scenario(3, pattern, edge);
      const legacy = scenario(2, pattern, edge);
      for (let tick = 0; tick < 90; tick++) {
        stepOverflight(modern.run);
        stepOverflight(legacy.run);
      }
      assert.equal(modern.enemy._approachComplete, true);
      assert.equal(legacy.enemy._approachComplete, false);
      const inwardDistance =
        (legacy.enemy.x - modern.enemy.x) * edge.dx + (legacy.enemy.y - modern.enemy.y) * edge.dy;
      assert.ok(inwardDistance > 60, `The completed pass must return inward: ${inwardDistance}`);
      assert.equal(modern.run.stats.retired, 0, 'Enemies return without disappearing.');
      assert.equal(modern.run.stats.enemiesAlive, 1);
      assert.equal(modern.enemy.hp, 1000, 'Boundary correction does not award damage or kills.');
    }
  });
}
test('V3 keeps a crossing approach committed until it reaches the boundary', () => {
  const { run, enemy } = scenario(3, 'crossing', { x: 900, y: 250, dx: 1, dy: 0 });
  const startY = enemy.y;
  for (let tick = 0; tick < 60; tick++) stepOverflight(run);
  assert.equal(enemy._approachComplete, false);
  assert.ok(enemy.x > 990);
  assert.equal(enemy.y, startY, 'The initial pass must not home onto the player each frame.');
});
test('completed passes remain deterministic after leaving the boundary', () => {
  const a = scenario(3, 'flank', edges[0]);
  const b = scenario(3, 'flank', edges[0]);
  for (let tick = 0; tick < 150; tick++) {
    const input = tick < 90 ? {} : { x: 0, y: 1 };
    stepOverflight(a.run, input);
    stepOverflight(b.run, input);
  }
  assert.deepEqual(a.enemy, b.enemy);
  assert.deepEqual(a.run.stats, b.run.stats);
  assert.equal(a.run._randomState, b.run._randomState);
});
