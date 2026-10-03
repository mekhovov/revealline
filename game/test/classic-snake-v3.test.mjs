// Authored regressions. Do not execute while publishing/test-policy.json waives suites.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateClassicSnakeLevel,
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
  makeClassicSnakeV3,
  classicSnakeContactHazardV3,
} from '../snake/classic-core.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  createClassicSnakeMatch,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';
const entry = (slug) => CLASSIC_SNAKE_LEVELS.find((level) => level.id === `classic-living-${slug}`);
const clone = (slug) => structuredClone(entry(slug).level);
const coordinate = ({ x, y }) => ({ x, y });
function front(run, target, kind) {
  target.x = run.snakes[0].body[0].x + 1;
  target.y = run.snakes[0].body[0].y;
  target.kind = kind;
  return target;
}

test('v3 adds twelve distinct layouts without changing the 84 historical recipes', () => {
  assert.equal(CLASSIC_SNAKE_LEVELS.length, 96);
  const previous = CLASSIC_SNAKE_LEVELS.filter(
    (row) => row.level.version !== 'classic-snake-level.v3',
  );
  assert.equal(previous.length, 84);
  const geometries = new Set(
    CLASSIC_SNAKE_LEVELS.slice(-12).map((row) => JSON.stringify(row.level.walls)),
  );
  assert.equal(geometries.size, 12);
  for (const row of CLASSIC_SNAKE_LEVELS) {
    const before = structuredClone(row.level);
    validateClassicSnakeLevel(row.level);
    const remix = makeClassicSnakeV3(row.level, { varied: true });
    assert.deepEqual(row.level, before);
    assert.ok(remix.targets.required.every((target) => !['shield', 'brace'].includes(target.kind)));
    assert.equal(remix.targets.maxActive, 2);
  }
});

test('frontal shield impact is fatal while side and rear remain one-contact catches', () => {
  for (const [heading, expected] of [
    ['left', 'lost'],
    ['up', 'running'],
    ['right', 'running'],
  ]) {
    const run = createClassicSnake(clone('shield-window'));
    const target = front(run, run.targets[0], 'shield');
    target.heading = heading;
    target.phase = 'turning';
    target.phaseTicks = 1;
    target.nextHeading = 'right';
    stepClassicSnake(run);
    assert.equal(run.status, expected);
    assert.equal(run.catches, expected === 'lost' ? 0 : 1);
    if (expected === 'lost') assert.equal(run.failure.cause, 'shield');
  }
});

test('armor is checked before a phase transition and Pulse freezes the current phase', () => {
  const recipe = clone('brace-break');
  const protectedRun = createClassicSnake(recipe);
  const t = front(protectedRun, protectedRun.targets[0], 'brace');
  t.phase = 'warning';
  t.phaseTicks = 1;
  stepClassicSnake(protectedRun);
  assert.equal(protectedRun.failure.cause, 'brace');
  assert.equal(protectedRun.catches, 0);
  const run = createClassicSnake(recipe);
  const actor = run.targets[0];
  actor.phase = 'warning';
  actor.phaseTicks = 3;
  run.pulseTicks = 8;
  const before = structuredClone(actor);
  stepClassicSnake(run);
  assert.deepEqual(run.targets[0], before);
  assert.equal(run.pulseTicks, 7);
});

test('frontal contact across a wrapped boundary uses accepted geometry', () => {
  const level = clone('shield-window');
  level.wrap = true;
  assert.equal(
    classicSnakeContactHazardV3(
      level,
      { kind: 'shield', x: 0, y: 8, heading: 'left' },
      { x: 23, y: 8 },
    ),
    true,
  );
  assert.equal(
    classicSnakeContactHazardV3(
      level,
      { kind: 'shield', x: 0, y: 8, heading: 'left' },
      { x: 0, y: 7 },
    ),
    false,
  );
});

test('a fatal Team step cancels a simultaneous catch and pickup', () => {
  const run = createClassicSnake(clone('supply-flanks'), { mode: 'team' });
  front(run, run.targets[0], 'shield').heading = 'left';
  const other = run.targets[1],
    head = run.snakes[1].body[0];
  Object.assign(other, { x: head.x - 1, y: head.y, kind: 'runner' });
  run.pickup = { id: 'pulse', kind: 'pulse', x: head.x - 1, y: head.y, bornTick: -1 };
  stepClassicSnake(run);
  assert.equal(run.status, 'lost');
  assert.equal(run.catches, 0);
  assert.equal(run.pickupsUsed, 0);
});

test('a caught rendezvous partner stays gone and its survivor remains catchable', () => {
  const run = createClassicSnake(clone('rendezvous-crossing'));
  const caught = front(run, run.targets[0], 'pair'),
    survivor = run.targets[1];
  const id = caught.id;
  stepClassicSnake(run);
  assert.equal(run.catches, 1);
  assert.equal(run.targets.length, 1);
  assert.equal(run.targets[0].id, survivor.id);
  assert.equal(run.targets[0].phase, 'flee');
  assert.equal(
    run.targets.some((target) => target.id === id),
    false,
  );
});

test('varied replay and paired-board match round-trip preserve accepted target phases', () => {
  const recipe = clone('refuge-bays');
  const run = createClassicSnake(recipe, { seed: 33 });
  for (let i = 0; i < 4; i++) {
    queueClassicSnakeTurn(run, 0, ['down', 'left', 'up', 'right'][i]);
    stepClassicSnake(run);
  }
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
  const match = createClassicSnakeMatch(recipe, { mode: 'versus', seed: 33 });
  assert.deepEqual(match.runs[0].targets, match.runs[1].targets);
  assert.deepEqual(restoreClassicSnakeMatch(exportClassicSnakeMatch(match)), match);
});

test('specialists spawn with at least four traversable grid steps of reaction distance', () => {
  const level = clone('shield-window'),
    run = createClassicSnake(level);
  const head = coordinate(run.snakes[0].body[0]),
    walls = new Set(level.walls.map(({ x, y }) => `${x},${y}`));
  const near = new Set([`${head.x},${head.y}`]),
    queue = [{ ...head, distance: 0 }];
  for (let at = 0; at < queue.length; at++) {
    const point = queue[at];
    if (point.distance === 3) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = point.x + dx,
        y = point.y + dy,
        key = `${x},${y}`;
      if (
        x < 0 ||
        y < 0 ||
        x >= level.width ||
        y >= level.height ||
        walls.has(key) ||
        near.has(key)
      )
        continue;
      near.add(key);
      queue.push({ x, y, distance: point.distance + 1 });
    }
  }
  assert.ok(run.targets.every((target) => !near.has(`${target.x},${target.y}`)));
});
