import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OPERATION_PROTOTYPES } from './manual/snake-operation-recipes.mjs';
import {
  createClassicSnake,
  stepClassicSnake,
  queueClassicSnakeTurn,
  restoreClassicSnakeReplay,
  exportClassicSnakeReplay,
} from '../snake/classic-core.mjs';
import { classicVisualSnapshot } from '../snake/classic-recent-replay.mjs';
import { classicOperationMarkers } from '../snake/classic-operation-view.mjs';
const recipe = (i) => structuredClone(OPERATION_PROTOTYPES[i].level);
const make = (i = 6, mode = 'solo') => createClassicSnake(recipe(i), { mode });
const body = (run, points, seat = 0, direction = 'right') =>
  Object.assign(run.snakes[seat], {
    body: points.map(([x, y]) => ({ x, y })),
    direction,
    turns: [],
  });
const harmless = (run) => {
  run.targets = [];
  run.spawnedRequired = run.level.goal;
  run.catches = run.level.goal;
};

test('routing recipes reject teleport routes, dangerous patrols, overlaps and closed traps', () => {
  for (const mutate of [
    (l) => (l.operation.switchyards[0].routes[1][1].x += 3),
    (l) => l.operation.switchyards[0].routes[1][0].x++,
    (l) => (l.operation.switchyards[0].routes[1] = l.operation.switchyards[0].routes[0]),
    (l) => l.operation.switchyards[0].switches.push({ x: 3, y: 3 }),
    (l) => (l.targets.required[0].kind = 'contour'),
    (l) => (l.operation.stages[0].activations[0].id = 'missing'),
    (l) => (l.operation.stages[0].activations[0].count = 99),
  ]) {
    const l = recipe(4);
    mutate(l);
    assert.throws(() => createClassicSnake(l));
  }
  const l = recipe(6);
  l.operation.plates[0].gates = [{ x: 6, y: 2 }];
  assert.throws(() => createClassicSnake(l), /starts clear/);
  const trapped = recipe(6);
  trapped.walls = [];
  for (let y = 0; y < 18; y++) if (y !== 8) trapped.walls.push({ x: 10, y });
  assert.throws(() => createClassicSnake(trapped), /bypass/);
});

test('two simultaneous Team switch contacts toggle their group once and grant no catches', () => {
  const run = make(4, 'team');
  harmless(run);
  body(run, [
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
  ]);
  body(
    run,
    [
      [20, 6],
      [21, 6],
      [22, 6],
      [23, 6],
    ],
    1,
    'left',
  );
  stepClassicSnake(run);
  assert.equal(run.operation.switchyards[0].selection, 1);
  assert.equal(run.operation.switchyards[0].toggles, 1);
  assert.equal(run.events.filter((e) => e.type === 'switchyard.changed').length, 1);
  assert.equal(
    run.events.some((e) => e.type === 'target.caught'),
    false,
  );
});

test('a switch changes the next junction departure, never a patrol mid-branch', () => {
  const run = make(4);
  const group = run.level.operation.switchyards[0],
    target = run.targets[0];
  Object.assign(target, group.routes[0][4], { routeIndex: 4, wait: 1 });
  body(run, [
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
  ]);
  stepClassicSnake(run);
  assert.equal(run.operation.switchyards[0].selection, 1);
  assert.deepEqual({ x: target.x, y: target.y }, group.routes[0][5]);
  Object.assign(target, group.routes[0][0], { routeIndex: 0, wait: 1 });
  stepClassicSnake(run);
  assert.deepEqual({ x: target.x, y: target.y }, group.routes[1][1]);
  assert.equal(target.switchyardBranch, 1);
});

test('a fatal partner collision prevents switch and plate activation', () => {
  const run = make(4, 'team');
  harmless(run);
  body(run, [
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
  ]);
  body(
    run,
    [
      [0, 15],
      [1, 15],
      [2, 15],
      [3, 15],
    ],
    1,
    'left',
  );
  stepClassicSnake(run);
  assert.equal(run.status, 'lost');
  assert.equal(run.operation.switchyards[0].toggles, 0);
  const plate = make(6, 'team');
  harmless(plate);
  body(plate, [
    [6, 8],
    [5, 8],
    [4, 8],
    [3, 8],
  ]);
  body(
    plate,
    [
      [0, 15],
      [1, 15],
      [2, 15],
      [3, 15],
    ],
    1,
    'left',
  );
  stepClassicSnake(plate);
  assert.equal(plate.operation.plates[0].activations, 0);
  assert.equal(plate.shutters[0].closed, true);
});

test('head and trailing body hold a cable plate; release warns for at least 800 ms at every supported pace', () => {
  for (const stepMs of [150, 200, 280]) {
    const l = recipe(6);
    l.stepMs = l.minStepMs = stepMs;
    const run = createClassicSnake(l);
    harmless(run);
    body(run, [
      [6, 8],
      [5, 8],
      [4, 8],
      [3, 8],
    ]);
    stepClassicSnake(run);
    assert.equal(run.shutters[0].closed, false);
    for (let i = 0; i < 3; i++) {
      stepClassicSnake(run);
      assert.equal(run.operation.plates[0].held, true);
    }
    stepClassicSnake(run);
    const releasedAt = run.elapsedMs;
    assert.equal(run.operation.plates[0].held, false);
    assert.equal(run.shutters[0].warning, true);
    assert.equal(run.operation.plates[0].closeAtMs, releasedAt + 800);
    while (!run.shutters[0].closed) {
      const before = run.elapsedMs;
      stepClassicSnake(run);
      assert.equal(run.status, 'running');
      if (run.elapsedMs - releasedAt < 800) assert.equal(run.shutters[0].closed, false);
      if (run.shutters[0].closed) {
        assert.ok(run.elapsedMs - releasedAt >= 800);
        assert.ok(before - releasedAt < 800);
      }
    }
  }
});

test('gates yield to trailing cable, then close only at a safe displayed boundary', () => {
  const run = make();
  harmless(run);
  const gate = run.shutters[0],
    state = run.operation.plates[0];
  gate.closed = false;
  gate.warning = true;
  state.closeAtMs = 200;
  body(run, [
    [14, 8],
    [13, 8],
    [12, 8],
    [11, 8],
    [10, 8],
    [9, 8],
  ]);
  stepClassicSnake(run);
  assert.equal(gate.closed, false);
  assert.equal(gate.yielding, true);
  stepClassicSnake(run);
  assert.equal(gate.closed, true);
  assert.equal(gate.yielding, false);
});

test('a released gate yields to a living enemy and re-pressing the plate cancels closing', () => {
  const run = make();
  const gate = run.shutters[0],
    state = run.operation.plates[0];
  Object.assign(run.targets[0], { x: 10, y: 8, wait: 99 });
  gate.closed = false;
  gate.warning = true;
  state.closeAtMs = 200;
  stepClassicSnake(run);
  assert.equal(gate.yielding, true);
  assert.equal(gate.closed, false);
  body(run, [
    [6, 8],
    [5, 8],
    [4, 8],
    [3, 8],
  ]);
  stepClassicSnake(run);
  assert.equal(state.closeAtMs, null);
  assert.equal(gate.warning, false);
  assert.equal(state.held, true);
});

test('a closed gate cannot open retroactively during the same accepted Team move', () => {
  const run = make(6, 'team');
  harmless(run);
  body(run, [
    [6, 8],
    [5, 8],
    [4, 8],
    [3, 8],
  ]);
  body(
    run,
    [
      [11, 8],
      [12, 8],
      [13, 8],
      [14, 8],
    ],
    1,
    'left',
  );
  stepClassicSnake(run);
  assert.equal(run.status, 'lost');
  assert.equal(run.failure.cause, 'wall');
  assert.equal(run.shutters[0].closed, true);
  assert.equal(run.operation.plates[0].activations, 0);
});

test('activation requirements prevent catch-only clears; visual snapshots retain routing state', () => {
  const run = make(4);
  harmless(run);
  body(run, [
    [19, 12],
    [18, 12],
    [17, 12],
    [16, 12],
  ]);
  stepClassicSnake(run);
  assert.equal(run.status, 'running');
  assert.equal(run.operation.stage, 0);
  const snapshot = classicVisualSnapshot(run);
  assert.deepEqual(classicOperationMarkers(snapshot), classicOperationMarkers(run));
  assert.ok(classicOperationMarkers(snapshot).some((p) => p.kind === 'switch'));
  snapshot.operation.switchyards[0].selection = 1;
  assert.equal(run.operation.switchyards[0].selection, 0);
});

test('original cargo/stage v5 recordings retain their exact historical checkpoints', async () => {
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v5-prototype-proofs.json', import.meta.url)),
  );
  for (const proof of proofs.slice(0, 8))
    assert.equal(restoreClassicSnakeReplay(proof).status, 'won');
});

test('routing state restores exactly and altered routing recipes fail replay verification', () => {
  const run = make(4);
  queueClassicSnakeTurn(run, 0, 'down');
  for (let i = 0; i < 6; i++) stepClassicSnake(run);
  queueClassicSnakeTurn(run, 0, 'right');
  stepClassicSnake(run);
  assert.equal(run.operation.switchyards[0].toggles, 1);
  const replay = exportClassicSnakeReplay(run);
  assert.deepEqual(restoreClassicSnakeReplay(replay), run);
  replay.level.operation.switchyards[0].switches[0].x--;
  assert.throws(() => restoreClassicSnakeReplay(replay));
});
