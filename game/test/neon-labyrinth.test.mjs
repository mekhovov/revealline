import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildNeonLabyrinth } from '../../scripts/build-neon-labyrinth.mjs';
import { createRun, stepRun, CELL } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

test('Labyrinth reproduces its source with six bouncers and two outer patrols', async () => {
  const documents = await buildNeonLabyrinth();
  for (const name of ['scenario', 'pack'])
    assert.deepEqual(
      JSON.parse(
        await readFile(
          new URL(`../../authoring/library/neon-labyrinth/${name}.json`, import.meta.url),
        ),
      ),
      documents[name],
    );
  const { level } = documents.scenario;
  assert.equal(level.walls.length, 37);
  assert.equal(level.classic.terrain.length, 86);
  assert.deepEqual(
    level.enemies.reduce(
      (types, enemy) => ({ ...types, [enemy.type]: (types[enemy.type] ?? 0) + 1 }),
      {},
    ),
    { bouncer: 6, 'border-patrol': 2 },
  );
  const run = createRun(level);
  for (const enemy of level.enemies)
    assert.notEqual(run.cells[Math.floor(enemy.y) * 72 + Math.floor(enemy.x)], CELL.WALL, enemy.id);
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`Labyrinth legal opening capture and replay in ${turnPolicy}`, async () => {
    const { scenario } = await buildNeonLabyrinth();
    const options = { ...scenario.settings, classRecipes: scenario.classRecipes, turnPolicy };
    const run = createRun(scenario.level, options);
    const recorder = createRecorder(scenario.level, options, 'neon-labyrinth-check');
    for (const [direction, ticks] of [
      ['left', 60],
      ['up', 24],
      ['right', 12],
      ['down', 36],
    ])
      for (let tick = 0; tick < ticks; tick++) {
        recordInput(recorder, { direction });
        stepRun(run, { direction });
      }
    assert.equal(run.lives, 3);
    assert.equal(run.claimedCount, 36);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  });
