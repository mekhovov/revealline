import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
  validateClassicSnakeLevel,
} from '../snake/classic-core.mjs';

const level = () => ({
  version: 'classic-snake-level.v1',
  id: 'classic-boundaries',
  revision: '1',
  name: 'Classic boundaries',
  width: 24,
  height: 18,
  walls: [],
  spawns: [
    { x: 5, y: 2, direction: 'right' },
    { x: 18, y: 15, direction: 'left' },
  ],
  goal: 1,
  stepMs: 180,
  speedupEvery: 0,
  minStepMs: 120,
  wrap: false,
  targetMovement: 'still',
  fleeEvery: 3,
});

test('four visible starting cells and the two-turn buffer preserve queued direction semantics', () => {
  const run = createClassicSnake(level());
  assert.deepEqual(run.snakes[0].body, [
    { x: 5, y: 2 },
    { x: 4, y: 2 },
    { x: 3, y: 2 },
    { x: 2, y: 2 },
  ]);
  assert.equal(queueClassicSnakeTurn(run, 0, 'left'), false);
  assert.equal(queueClassicSnakeTurn(run, 0, 'down'), true);
  assert.equal(queueClassicSnakeTurn(run, 0, 'up'), false);
  assert.equal(queueClassicSnakeTurn(run, 0, 'left'), true);
  assert.equal(queueClassicSnakeTurn(run, 0, 'up'), false);
  stepClassicSnake(run);
  assert.deepEqual(run.snakes[0].body[0], { x: 5, y: 3 });
  assert.deepEqual(run.snakes[0].turns, ['left']);
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
});

test('the old tail vacates on the same non-growing move', () => {
  const run = createClassicSnake(level());
  for (const direction of ['down', 'left', 'up']) {
    queueClassicSnakeTurn(run, 0, direction);
    stepClassicSnake(run);
  }
  assert.equal(run.status, 'running');
  assert.deepEqual(run.snakes[0].body, [
    { x: 4, y: 2 },
    { x: 4, y: 3 },
    { x: 5, y: 3 },
    { x: 5, y: 2 },
  ]);
});

test('one target contact grows once and wins only after the accepted transaction', () => {
  const run = createClassicSnake(level(), { seed: 17 });
  assert.deepEqual(run.target, { id: 'humanoid-1', kind: 'humanoid', x: 0, y: 8 });
  queueClassicSnakeTurn(run, 0, 'down');
  for (let i = 0; i < 6; i++) stepClassicSnake(run);
  queueClassicSnakeTurn(run, 0, 'left');
  for (let i = 0; i < 5; i++) stepClassicSnake(run);
  assert.equal(run.status, 'won');
  assert.equal(run.catches, 1);
  assert.equal(run.score, 100);
  assert.equal(run.elapsedMs, 11 * 180);
  assert.equal(run.snakes[0].body.length, 5);
  assert.equal(run.recentCatches.length, 1);
  assert.equal(run.target, null);
  const before = structuredClone(run);
  stepClassicSnake(run);
  assert.deepEqual(run, before);
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
});

test('accepted catches change only the following step clock and replay keeps elapsed time', () => {
  const source = { ...level(), goal: 2, speedupEvery: 1 };
  const run = createClassicSnake(source, { seed: 17 });
  queueClassicSnakeTurn(run, 0, 'down');
  for (let i = 0; i < 6; i++) stepClassicSnake(run);
  queueClassicSnakeTurn(run, 0, 'left');
  for (let i = 0; i < 5; i++) stepClassicSnake(run);
  assert.equal(run.elapsedMs, 1980);
  stepClassicSnake(run);
  assert.equal(run.elapsedMs, 2150);
  assert.equal(run.failure.cause, 'wall');
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
});

test('simultaneous Team head-on and head-swap contacts each fail once and award nothing', () => {
  for (const [x, cause] of [
    [10, 'head-swap'],
    [11, 'head-on'],
  ]) {
    const source = level();
    source.spawns = [
      { x: 5, y: 5, direction: 'right' },
      { x, y: 5, direction: 'left' },
    ];
    const run = createClassicSnake(source, { mode: 'team', seed: 17 });
    for (let step = 0; step < 3; step++) stepClassicSnake(run);
    assert.equal(run.status, 'lost');
    assert.equal(run.failure.cause, cause);
    assert.equal(run.events.filter((event) => event.type === 'snake.failed').length, 2);
    assert.equal(run.events.filter((event) => event.type === 'run.completed').length, 1);
    assert.equal(run.catches, 0);
    assert.equal(run.score, 0);
    assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
  }
});

test('exact recipe authority and checkpoint validation reject altered saves', () => {
  const source = level(),
    run = createClassicSnake(source);
  stepClassicSnake(run);
  const saved = exportClassicSnakeReplay(run);
  assert.throws(
    () => restoreClassicSnakeReplay({ ...saved, checkpoint: '0000000000000000' }),
    /verification/,
  );
  assert.throws(
    () => restoreClassicSnakeReplay(saved, { level: { ...source, goal: 2 } }),
    /different level/,
  );
  assert.throws(
    () =>
      restoreClassicSnakeReplay({ ...saved, turns: [{ tick: 0, playerId: 0, direction: 'left' }] }),
    /rejected turn/,
  );
  assert.throws(() => validateClassicSnakeLevel({ ...source, snake: {} }), /unsupported/i);
});

test('wrap is explicit and stationary targets do not wander between contacts', () => {
  const source = level();
  source.wrap = true;
  source.spawns[0].direction = 'left';
  const run = createClassicSnake(source),
    target = structuredClone(run.target);
  for (let i = 0; i < 6; i++) stepClassicSnake(run);
  assert.equal(run.status, 'running');
  assert.deepEqual(run.snakes[0].body[0], { x: 23, y: 2 });
  assert.deepEqual(run.target, target);
});
