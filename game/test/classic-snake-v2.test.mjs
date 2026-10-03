// Regression sources are deliberately unrun while publishing/test-policy.json
// waives automated suites. Production observations are recorded separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
  makeClassicSnakeV2,
  validateClassicSnakeLevel,
} from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
  restoreClassicSnakeLegacyMatch,
} from '../snake/classic-match.mjs';

const historical = () => ({
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
  goal: 8,
  stepMs: 200,
  speedupEvery: 0,
  minStepMs: 200,
  wrap: false,
  targetMovement: 'still',
  fleeEvery: 3,
});
const level = () => structuredClone(makeClassicSnakeV2(historical()));
const loop = ['down', 'left', 'up', 'right'];
function loopStep(run) {
  queueClassicSnakeTurn(run, 0, loop[run.tick % 4]);
  stepClassicSnake(run);
}
function advance(match) {
  advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
}
function restored(run) {
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
}

test('v1 keeps the original recipe while explicit v2 conversion preserves authored mechanics', () => {
  const source = historical(),
    old = createClassicSnake(source);
  assert.equal(old.version, 'classic-snake-core.v1');
  assert.deepEqual(old.target, { id: 'humanoid-1', kind: 'humanoid', x: 0, y: 8 });
  const recipe = level();
  recipe.shutters = [{ id: 'shortcut', cells: [{ x: 12, y: 8 }], phase: 0 }];
  assert.deepEqual(makeClassicSnakeV2(recipe), validateClassicSnakeLevel(recipe));
  assert.deepEqual(source, historical());
  restored(old);
});

test('the finite required population never exceeds remaining quota', () => {
  const recipe = level();
  recipe.goal = 1;
  recipe.targets.maxActive = 2;
  const run = createClassicSnake(recipe);
  assert.equal(run.targets.length, 1);
  queueClassicSnakeTurn(run, 0, 'down');
  for (let i = 0; i < 6; i++) stepClassicSnake(run);
  queueClassicSnakeTurn(run, 0, 'left');
  for (let i = 0; i < 5; i++) stepClassicSnake(run);
  assert.equal(run.status, 'won');
  assert.equal(run.catches, 1);
  assert.equal(run.score, 100);
  assert.equal(run.snakes[0].body.length, 5);
  assert.deepEqual(run.targets, []);
  restored(run);
});

test('a committed sprinter warns for four phases then moves at most one cell per phase', () => {
  const recipe = level();
  recipe.targets.required = [{ kind: 'sprinter', every: 3 }];
  const run = createClassicSnake(recipe, { seed: 6 });
  for (let i = 0; i < 8; i++) loopStep(run);
  assert.equal(run.targets[0].phase, 'warning');
  assert.equal(run.targets[0].phaseTicks, 4);
  const before = { x: run.targets[0].x, y: run.targets[0].y };
  for (let i = 0; i < 3; i++) loopStep(run);
  assert.deepEqual({ x: run.targets[0].x, y: run.targets[0].y }, before);
  loopStep(run);
  assert.equal(run.targets[0].burstLeft, 1);
  assert.ok(Math.abs(run.targets[0].x - before.x) + Math.abs(run.targets[0].y - before.y) <= 1);
  loopStep(run);
  assert.equal(run.targets[0].phase, 'rest');
  assert.equal(run.targets[0].phaseTicks, 8);
  restored(run);
});

test('yielding shutters never close through a body entering on the closure boundary', () => {
  const recipe = level();
  recipe.shutters = [{ id: 'shortcut', cells: [{ x: 5, y: 3 }], phase: 31 }];
  const run = createClassicSnake(recipe);
  queueClassicSnakeTurn(run, 0, 'down');
  stepClassicSnake(run);
  assert.equal(run.status, 'running');
  assert.equal(run.shutters[0].closed, false);
  assert.equal(run.shutters[0].yielding, true);
  queueClassicSnakeTurn(run, 0, 'right');
  for (let i = 0; i < 4; i++) stepClassicSnake(run);
  assert.equal(run.shutters[0].closed, true);
  restored(run);
});

test('all closed shutter combinations preserve a permanent bypass', () => {
  const recipe = level();
  recipe.walls = Array.from({ length: 18 }, (_, y) => ({ x: 12, y })).filter(({ y }) => y !== 8);
  recipe.shutters = [{ id: 'only-route', cells: [{ x: 12, y: 8 }], phase: 0 }];
  assert.throws(() => validateClassicSnakeLevel(recipe), /permanent connected bypass/);
});

test('fatal Team contacts cancel otherwise successful catches on the same step', () => {
  const run = createClassicSnake(level(), { mode: 'team' });
  // A reachable transaction fixture: player one can catch while player two
  // faces the boundary. No target overlaps a body or wall.
  run.snakes[1].body = [
    { x: 0, y: 15 },
    { x: 1, y: 15 },
    { x: 2, y: 15 },
    { x: 3, y: 15 },
  ];
  Object.assign(run.targets[0], { x: 6, y: 2 });
  stepClassicSnake(run);
  assert.equal(run.status, 'lost');
  assert.equal(run.catches, 0);
  assert.equal(run.score, 0);
  assert.equal(run.pickupsUsed, 0);
  assert.equal(
    run.events.some((event) => event.type === 'target.caught'),
    false,
  );
});

test('courier offers persist and deferred second offers cannot consume the quota', () => {
  const recipe = level();
  recipe.targets.maxActive = 2;
  recipe.targets.bonus = {
    at: [4, 8],
    policy: {
      kind: 'courier',
      every: 4,
      path: [
        { x: 10, y: 10 },
        { x: 11, y: 10 },
      ],
    },
  };
  const run = createClassicSnake(recipe);
  // Isolate the persistent bonus actor after the first earned offer.
  run.catches = 4;
  run.targets.length = 0;
  loopStep(run);
  const courier = run.targets.find((target) => target.role === 'bonus');
  assert.ok(courier);
  assert.equal(run.spawnedBonus, 1);
  for (let i = 0; i < 48; i++) loopStep(run);
  assert.equal(run.targets.find((target) => target.role === 'bonus').id, courier.id);
  assert.equal(run.spawnedBonus, 1);
  assert.equal(run.catches, 4);
});

test('pulse freezes target phase counters for exactly eight phases without movement catchup', () => {
  const recipe = level();
  recipe.targets.required = [{ kind: 'sprinter', every: 3 }];
  const run = createClassicSnake(recipe),
    before = structuredClone(run.targets[0]);
  run.pulseTicks = 8;
  for (let i = 0; i < 8; i++) loopStep(run);
  assert.deepEqual(run.targets[0], before);
  assert.equal(run.pulseTicks, 0);
  loopStep(run);
  assert.equal(run.targets[0].age, 1);
  assert.equal(run.targets[0].phaseTicks, 7);
});

test('score duel keeps a dead board frozen while the survivor reaches the exact cap', () => {
  const recipe = makeClassicSnakeV2(
    { ...historical(), stepMs: 199, minStepMs: 199 },
    { endless: true },
  );
  const match = createClassicSnakeMatch(recipe, { mode: 'versus', policy: 'score' });
  while (match.status === 'running') {
    queueClassicSnakeMatchTurn(match, 1, loop[match.runs[1].tick % 4]);
    advance(match);
  }
  assert.equal(match.elapsedMs, 180000);
  assert.equal(match.runs[0].tick, 19);
  assert.equal(match.runs[1].tick, 904);
  assert.equal(match.runs[0].elapsedMs, 3781);
  assert.equal(match.runs[1].elapsedMs, 179896);
  assert.equal(match.boardResults[1].cause, 'time');
  assert.deepEqual(restoreClassicSnakeMatch(exportClassicSnakeMatch(match)), match);
});

test('a legal catch exactly on the Survival deadline refreshes both deadlines', () => {
  const recipe = makeClassicSnakeV2(
    { ...historical(), stepMs: 240, minStepMs: 240 },
    { endless: true },
  );
  const match = createClassicSnakeMatch(recipe, { mode: 'versus', policy: 'survival' });
  for (let i = 0; i < 112; i++) {
    for (let seat = 0; seat < 2; seat++) queueClassicSnakeMatchTurn(match, seat, loop[i % 4]);
    advance(match);
  }
  advance(match);
  for (const direction of ['down', 'left']) {
    for (let seat = 0; seat < 2; seat++) queueClassicSnakeMatchTurn(match, seat, direction);
    for (let i = 0; i < 6; i++) advance(match);
  }
  assert.equal(match.elapsedMs, 30000);
  assert.equal(match.status, 'running');
  assert.deepEqual(match.lastCatchAt, [30000, 30000]);
  assert.deepEqual(restoreClassicSnakeMatch(exportClassicSnakeMatch(match)), match);
});

test('match restore rejects an independently valid board outside the shared accepted timeline', () => {
  const match = createClassicSnakeMatch(level(), { mode: 'versus' });
  advanceClassicSnakeMatchTo(match, 517.25);
  const saved = exportClassicSnakeMatch(match);
  saved.replays[1] = exportClassicSnakeReplay(createClassicSnake(level()));
  assert.throws(() => restoreClassicSnakeMatch(saved), /timeline verification/);
});

test('legacy board journals migrate pending turns and fractional elapsed time exactly', () => {
  const recipe = historical(),
    match = createClassicSnakeMatch(recipe, { mode: 'versus' });
  advanceClassicSnakeMatchTo(match, 91.5);
  queueClassicSnakeMatchTurn(match, 0, 'down');
  queueClassicSnakeMatchTurn(match, 1, 'down');
  advanceClassicSnakeMatchTo(match, 517.25);
  const migrated = restoreClassicSnakeLegacyMatch(
    { replays: match.runs.map(exportClassicSnakeReplay), mode: 'versus', elapsedMs: 517.25 },
    { level: recipe },
  );
  assert.equal(migrated.elapsedMs, 517.25);
  assert.deepEqual(
    migrated.runs.map(exportClassicSnakeReplay),
    match.runs.map(exportClassicSnakeReplay),
  );
});

test('a collected reel trims four cells and never shortens below the four-cell minimum', () => {
  for (const length of [4, 6, 8]) {
    const run = createClassicSnake(level());
    run.snakes[0].body = Array.from({ length }, (_, i) => ({ x: 10 - i, y: 2 }));
    run.pickup = { id: 'pickup-1', kind: 'reel', x: 11, y: 2, bornTick: 0 };
    stepClassicSnake(run);
    assert.equal(run.status, 'running');
    assert.equal(run.snakes[0].body.length, Math.max(4, length - 4));
    assert.equal(run.pickupsUsed, 1);
    assert.equal(run.score, 0);
  }
});

test('a resting sprinter does not warn or burst while heads remain outside six traversable cells', () => {
  const recipe = level();
  recipe.targets.required = [{ kind: 'sprinter', every: 3 }];
  const run = createClassicSnake(recipe, { seed: 17 });
  const start = { x: run.targets[0].x, y: run.targets[0].y };
  let warnings = 0;
  for (let i = 0; i < 24; i++) {
    loopStep(run);
    warnings += run.events.filter((event) => event.type === 'target.warning').length;
  }
  assert.equal(warnings, 0);
  assert.equal(run.targets[0].phase, 'rest');
  assert.equal(run.targets[0].phaseTicks, 1);
  assert.deepEqual({ x: run.targets[0].x, y: run.targets[0].y }, start);
  restored(run);
});
