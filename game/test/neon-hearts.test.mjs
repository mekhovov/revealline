import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildNeonHearts } from '../../scripts/build-neon-hearts.mjs';
import { createRun, stepRun, CELL } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

test('Neon Hearts imports reproduce seven distinct hazards and reachable central safe ground', async () => {
  const documents = await buildNeonHearts();
  for (const name of ['scenario', 'pack']) {
    const saved = JSON.parse(
      await readFile(new URL(`../../authoring/library/neon-hearts/${name}.json`, import.meta.url)),
    );
    assert.deepEqual(saved, documents[name]);
  }
  const { scenario } = documents;
  const run = createRun(scenario.level, {
    ...scenario.settings,
    classRecipes: scenario.classRecipes,
  });
  const lethal = new Set();
  for (const rect of scenario.level.classic.terrain)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) lethal.add(y * 72 + x);
  const remaining = new Set(lethal);
  let hearts = 0;
  while (remaining.size) {
    hearts++;
    const queue = [remaining.values().next().value];
    remaining.delete(queue[0]);
    for (const cell of queue)
      for (const next of [cell - 72, cell + 72, cell - 1, cell + 1])
        if (remaining.delete(next)) queue.push(next);
  }
  assert.equal(hearts, 7);
  assert.equal(scenario.level.enemies.filter((enemy) => enemy.type === 'bouncer').length, 8);
  assert.equal(scenario.level.enemies.filter((enemy) => enemy.type === 'border-patrol').length, 2);
  const start = 35 * 72 + 36,
    queue = [start],
    visited = new Set(queue);
  for (const cell of queue) {
    const x = cell % 72,
      y = Math.floor(cell / 72);
    for (const next of [
      y > 0 ? cell - 72 : -1,
      y < 35 ? cell + 72 : -1,
      x > 0 ? cell - 1 : -1,
      x < 71 ? cell + 1 : -1,
    ]) {
      if (next < 0 || visited.has(next) || lethal.has(next) || run.cells[next] === CELL.WALL)
        continue;
      visited.add(next);
      queue.push(next);
    }
  }
  for (const rect of scenario.level.foundations)
    assert.ok(
      visited.has(rect.y * 72 + rect.x),
      'every safe heart segment has a nonlethal path through an opening',
    );
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`Neon Hearts legal opening capture and exact replay in ${turnPolicy}`, async () => {
    const { scenario } = await buildNeonHearts();
    const options = { ...scenario.settings, classRecipes: scenario.classRecipes, turnPolicy };
    const run = createRun(scenario.level, options);
    const recorder = createRecorder(scenario.level, options, 'neon-hearts-check');
    for (const [direction, ticks] of [
      ['left', 72],
      ['up', 36],
      ['left', 354],
    ]) {
      for (let tick = 0; tick < ticks; tick++) {
        recordInput(recorder, { direction });
        stepRun(run, { direction });
      }
    }
    assert.equal(run.lives, 3);
    assert.equal(run.status, 'running');
    assert.equal(run.claimedCount, 140);
    const replay = verifyReplay(exportReplay(recorder, run));
    assert.equal(replay.match, true, JSON.stringify(replay.diagnostics));
  });
}
