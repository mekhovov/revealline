import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildNeonCrossroads } from '../../scripts/build-neon-crossroads.mjs';
import { createRun, stepRun, CELL } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

test('Neon Crossroads artifacts reproduce and the solid cross isolates four seeded chambers', async () => {
  const documents = await buildNeonCrossroads();
  for (const name of ['scenario', 'pack']) {
    const saved = JSON.parse(
      await readFile(
        new URL(`../../authoring/library/neon-crossroads/${name}.json`, import.meta.url),
      ),
    );
    assert.deepEqual(saved, documents[name]);
  }
  const { scenario } = documents;
  const run = createRun(scenario.level, {
    ...scenario.settings,
    classRecipes: scenario.classRecipes,
  });
  assert.equal(run.cells.filter((cell) => cell === CELL.WALL).length, 204);
  const seen = new Set();
  const chambers = [];
  for (let start = 0; start < run.cells.length; start++) {
    if (seen.has(start) || run.cells[start] !== CELL.FIELD) continue;
    const queue = [start];
    seen.add(start);
    for (const cell of queue)
      for (const next of [cell - 72, cell + 72, cell - 1, cell + 1]) {
        if (!seen.has(next) && run.cells[next] === CELL.FIELD) {
          seen.add(next);
          queue.push(next);
        }
      }
    const occupants = scenario.level.enemies.filter((enemy) =>
      queue.includes(Math.floor(enemy.y) * 72 + Math.floor(enemy.x)),
    );
    chambers.push({ cells: queue.length, actors: occupants.length });
  }
  assert.deepEqual(chambers, [
    { cells: 544, actors: 1 },
    { cells: 544, actors: 2 },
    { cells: 544, actors: 2 },
    { cells: 544, actors: 1 },
  ]);
  for (let tick = 0; tick < 30; tick++) stepRun(run, { direction: 'up' });
  assert.ok(
    run.player.y >= 35 + run.rules.playerRadius - 1e-9,
    'the player body stays outside the central wall',
  );
  assert.equal(run.claimedCount, 0, 'touching a wall never awards a capture');
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`Crossroads legal chamber capture and exact replay in ${turnPolicy}`, async () => {
    const { scenario } = await buildNeonCrossroads();
    const options = { ...scenario.settings, classRecipes: scenario.classRecipes, turnPolicy };
    const run = createRun(scenario.level, options);
    const recorder = createRecorder(scenario.level, options, 'neon-crossroads-check');
    for (const [direction, ticks] of [
      ['right', 72],
      ['up', 144],
      ['right', 342],
    ]) {
      for (let tick = 0; tick < ticks; tick++) {
        recordInput(recorder, { direction });
        stepRun(run, { direction });
      }
    }
    assert.equal(run.lives, 3);
    assert.equal(run.status, 'running');
    assert.equal(run.claimedCount, 348);
    const replay = verifyReplay(exportReplay(recorder, run));
    assert.equal(replay.match, true, JSON.stringify(replay.diagnostics));
  });
}
