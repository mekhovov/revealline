import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import { createClassicSnake, restoreClassicSnakeReplay } from '../snake/classic-core.mjs';
import { proveClassicSnakeV4 } from './helpers/classic-snake-v4-playthrough.mjs';

for (const mode of ['solo', 'team'])
  test(`qualification pilot completes a v1 ${mode} recipe without v4 state`, () => {
    const level = CLASSIC_SNAKE_LEVELS[0].level;
    const before = structuredClone(level);
    const replay = proveClassicSnakeV4(level, { mode });
    const restored = restoreClassicSnakeReplay(replay, { level });
    assert.equal(restored.status, 'won');
    assert.equal(restored.catches, level.goal);
    assert.equal(restored.mode, mode);
    assert.equal(replay.version, 'classic-snake-replay.v1');
    assert.deepEqual(level, before);
  });

test('qualification pilot routes across a wrap seam through accepted input', () => {
  const level = {
    ...structuredClone(CLASSIC_SNAKE_LEVELS[0].level),
    id: 'qualification-wrap',
    width: 16,
    height: 12,
    wrap: true,
    goal: 1,
    spawns: [
      { x: 0, y: 2, direction: 'up' },
      { x: 8, y: 8, direction: 'down' },
    ],
  };
  const seed = 195;
  const initial = createClassicSnake(level, { seed });
  assert.equal(initial.target.x, 15);
  assert.equal(initial.target.y, 2);
  const replay = proveClassicSnakeV4(level, { seed, maxSteps: 1 });
  assert.deepEqual(replay.turns, [{ tick: 0, playerId: 0, direction: 'left' }]);
  const restored = restoreClassicSnakeReplay(replay, { level });
  assert.equal(restored.status, 'won');
  assert.equal(restored.tick, 1);
  assert.deepEqual(restored.snakes[0].body[0], { x: 15, y: 2 });
});

test('qualification pilot retains v4 hazard-aware legal completion', () => {
  const level = CLASSIC_SNAKE_V4_LEVELS.find(
    (entry) => entry.id === 'classic-field-lane-window',
  ).level;
  const replay = proveClassicSnakeV4(level);
  const restored = restoreClassicSnakeReplay(replay, { level });
  assert.equal(restored.status, 'won');
  assert.equal(restored.catches, level.goal);
  assert.equal(replay.version, 'classic-snake-replay.v4');
});

test('bounded input backtracking recovers a Team route from a greedy body trap', () => {
  const level = CLASSIC_SNAKE_LEVELS.find(
    (entry) => entry.id === 'classic-snake-staggered-elbows',
  ).level;
  assert.throws(
    () => proveClassicSnakeV4(level, { mode: 'team', maxBacktracks: 0 }),
    /No safe qualification move/,
  );
  const replay = proveClassicSnakeV4(level, { mode: 'team' });
  const restored = restoreClassicSnakeReplay(replay, { level });
  assert.equal(restored.status, 'won');
  assert.equal(restored.catches, level.goal);
  assert.ok(restored.snakes.every((snake) => snake.alive));
});
