import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_SNAKE_OPERATION_LEVELS_B } from '../snake/classic-catalogue-operations-b.mjs';
import { classicSnakeRecipeEntries } from '../snake/classic-catalogue-archive.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import {
  createClassicSnake,
  stepClassicSnake,
  restoreClassicSnakeReplay,
} from '../snake/classic-core.mjs';
const find = (id) => CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === `classic-operation-${id}`);
const pointKey = ({ x, y }) => `${x},${y}`;
function distance(level, from, to, removed = []) {
  const walls = new Set(
    level.walls.filter((w) => !removed.some((r) => pointKey(r) === pointKey(w))).map(pointKey),
  );
  const seen = new Set([pointKey(from)]),
    queue = [[from, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [at, cost] = queue[i];
    if (pointKey(at) === pointKey(to)) return cost;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: at.x + dx, y: at.y + dy },
        key = pointKey(next);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= level.width ||
        next.y >= level.height ||
        seen.has(key) ||
        walls.has(key)
      )
        continue;
      seen.add(key);
      queue.push([next, cost + 1]);
    }
  }
  return Infinity;
}
test('Loaded Excavation has a real warned shortcut and an unchanged permanent bypass', () => {
  const entry = find('loaded-excavation'),
    level = entry.level;
  const before = CLASSIC_SNAKE_OPERATION_LEVELS_B.find((e) => e.id === entry.id).level;
  const from = { x: 10, y: 8 },
    to = { x: 13, y: 8 },
    mark = { x: 11, y: 8 };
  assert.equal(distance(before, from, to), 13);
  assert.equal(
    distance(before, from, to, [mark]),
    13,
    'the prior advertised notch remained sealed',
  );
  assert.equal(distance(level, from, to), 13, 'the recess does not open a premature passage');
  assert.equal(distance(level, from, to, [mark]), 3, 'demolition now creates the direct delivery');
  assert.deepEqual(level.operation, before.operation);
  assert.deepEqual(level.targets, before.targets);
  assert.equal(level.goal, before.goal);
  for (const pace of ['slow', 'normal', 'fast']) {
    const run = createClassicSnake(prepareClassicSnakeLevel(entry, { pace }), { seed: 17 });
    let openedAt, warningAt;
    for (let i = 0; i < 16 && !run.removedWalls.length; i++) {
      stepClassicSnake(run);
      if (warningAt === undefined && run.targets[0].phase === 'warning') warningAt = run.elapsedMs;
      if (run.removedWalls.length) openedAt = run.elapsedMs;
    }
    assert.deepEqual(run.removedWalls, [mark]);
    assert.ok(openedAt - warningAt >= 800, `${pace}: retain the demolition warning`);
    assert.equal(distance(level, from, to, run.removedWalls), 3);
  }
});
test('Pressure Elbow ties every committed prey route to the far side without reducing its goal', () => {
  const level = find('pressure-elbow').level;
  assert.equal(level.goal, 3);
  assert.equal(level.version, 'classic-snake-level.v6');
  assert.deepEqual(
    level.tactics[0].route,
    Array.from({ length: 8 }, (_, n) => ({ x: 14, y: n + 6 })),
  );
  assert.equal(level.operation.plates[0].gates[0].x, 13);
  assert.ok(
    level.tactics[0].route.every((p) => !level.walls.some((w) => pointKey(w) === pointKey(p))),
  );
});
test('both editorial predecessor recipes remain explicit archive entries', () => {
  for (const id of ['loaded-excavation', 'pressure-elbow']) {
    const entry = find(id),
      recipes = classicSnakeRecipeEntries(entry, { allowArchive: true });
    assert.equal(recipes.length, 2);
    assert.equal(recipes[1].level.revision, 'operations-1');
    assert.equal(recipes[1].level.version, 'classic-snake-level.v5');
    assert.equal(classicSnakeRecipeEntries(entry).length, 1);
  }
});
test('all six revised excavation Solo/Team/pace journals verify against its accepted geometry', async () => {
  const { proofs } = JSON.parse(
    await readFile(
      new URL('../../docs/verification/snake-remaster/editorial-proofs.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(proofs.length, 6);
  const seen = new Set();
  for (const proof of proofs) {
    const entry = CLASSIC_SNAKE_LEVELS.find((e) => e.id === proof.levelId);
    const level = prepareClassicSnakeLevel(entry, { pace: proof.pace });
    assert.equal(restoreClassicSnakeReplay(proof.replay, { level }).status, 'won');
    seen.add(`${proof.mode}/${proof.pace}`);
  }
  assert.equal(seen.size, 6);
});
