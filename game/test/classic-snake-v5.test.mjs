import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createClassicSnake,
  stepClassicSnake,
  queueClassicSnakeTurn,
  classicSnakeSummary,
  validateClassicSnakeLevel,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from '../snake/classic-core.mjs';
import { CLASSIC_PACES } from '../snake/classic-setup.mjs';
import { OPERATION_PROTOTYPES } from './manual/snake-operation-recipes.mjs';
import { classicOperationMarkers } from '../snake/classic-operation-view.mjs';
import { classicVisualSnapshot } from '../snake/classic-recent-replay.mjs';
import {
  createClassicSnakeMatch,
  advanceClassicSnakeMatchTo,
  exportClassicSnakeMatch,
  restoreClassicSnakeMatch,
} from '../snake/classic-match.mjs';
const level = (index = 2) => structuredClone(OPERATION_PROTOTYPES[index].level);
const make = (index = 2, options) => createClassicSnake(level(index), options);
const body = (run, points, player = 0, direction = 'right') => {
  run.snakes[player].body = points.map(([x, y]) => ({ x, y }));
  run.snakes[player].direction = direction;
};
const place = (run, x, y) => Object.assign(run.targets[0], { x, y, kind: 'still' });

test('v5 bounded validation rejects malformed, ambiguous and silent Score recipes', () => {
  for (const row of OPERATION_PROTOTYPES)
    assert.deepEqual(validateClassicSnakeLevel(row.level), row.level);
  for (const mutate of [
    (l) => l.operation.stages.push(...l.operation.stages),
    (l) => l.operation.parcels.push(l.operation.parcels[0]),
    (l) => l.operation.stages[0].deliveries.push('missing'),
    (l) => l.operation.stages[0].deliveries.push('parcel-a'),
    (l) => (l.operation.stages[0].catches = 3),
    (l) => (l.operation.stages[2].catches = 1),
    (l) => (l.operation.parcels[0].at = { x: 10, y: 7 }),
    (l) => (l.operation.parcels[0].dockId = 'missing'),
    (l) => (l.operation.docks[0].at = l.operation.parcels[0].at),
    (l) => (l.operation.docks[0].untrusted = true),
    (l) => (l.operation.untrusted = true),
    (l) => (l.objective = 'endless'),
  ]) {
    const l = level();
    mutate(l);
    assert.throws(() => createClassicSnake(l));
  }
  assert.throws(() => createClassicSnakeMatch(level(), { mode: 'versus', policy: 'score' }));
});

test('cargo adds temporary length, docks remove only cargo, and parcels are not catches', () => {
  const run = make();
  place(run, 22, 16);
  body(run, [
    [8, 2],
    [7, 2],
    [6, 2],
    [5, 2],
  ]);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 5);
  assert.equal(run.operation.parcels[0].state, 'carried');
  assert.equal(run.catches, 0);
  assert.equal(run.score, 0);
  assert.equal(run.events.filter((e) => e.type === 'target.caught').length, 0);
  // Ordinary catch growth remains after delivering the temporary segment.
  place(run, 10, 2);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 6);
  body(run, [
    [17, 12],
    [16, 12],
    [15, 12],
    [14, 12],
    [13, 12],
    [12, 12],
  ]);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 5);
  assert.equal(run.operation.parcels[0].state, 'delivered');
  assert.equal(run.catches, 1);
  assert.equal(run.operation.stage, 0);
});

test('wrong dock does not unload a carried parcel', () => {
  const run = make(3);
  place(run, 22, 16);
  body(run, [
    [7, 3],
    [6, 3],
    [5, 3],
    [4, 3],
  ]);
  stepClassicSnake(run);
  body(run, [
    [19, 3],
    [18, 3],
    [17, 3],
    [16, 3],
    [15, 3],
  ]);
  stepClassicSnake(run);
  assert.equal(run.operation.parcels[0].state, 'carried');
  assert.equal(run.snakes[0].body.length, 5);
});

test('parcel growth prevents vacating the tail; a fatal move awards no parcel', () => {
  const run = make();
  place(run, 22, 16);
  body(run, [
    [8, 2],
    [8, 3],
    [9, 3],
    [9, 2],
  ]);
  stepClassicSnake(run);
  assert.equal(run.status, 'lost');
  assert.equal(run.failure.cause, 'body');
  assert.equal(run.operation.parcels[0].state, 'waiting');
  assert.equal(
    run.events.some((e) => e.type === 'cargo.collected'),
    false,
  );
});

test('simultaneous Team fatal move suppresses the other head delivery and stage award', () => {
  const run = make(2, { mode: 'team' });
  place(run, 22, 16);
  run.operation.parcels[0] = { id: 'parcel-a', state: 'carried', carrier: 0 };
  run.operation.parcels[1] = { id: 'parcel-b', state: 'delivered', carrier: null };
  body(run, [
    [17, 12],
    [16, 12],
    [15, 12],
    [14, 12],
    [13, 12],
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
  assert.equal(run.operation.stage, 0);
  assert.equal(run.operation.parcels[0].state, 'carried');
  assert.equal(
    run.events.some((e) => e.type === 'cargo.delivered'),
    false,
  );
});

test('either Team head can extract on the exact move the other delivers', () => {
  const l = level();
  l.operation.stages = [
    { id: 'all', catches: 2, deliveries: ['parcel-a', 'parcel-b'], exit: { x: 5, y: 12 } },
  ];
  const run = createClassicSnake(l, { mode: 'team' });
  run.catches = 2;
  run.targets = [];
  run.operation.parcels[0] = { id: 'parcel-a', state: 'carried', carrier: 0 };
  run.operation.parcels[1] = { id: 'parcel-b', state: 'delivered', carrier: null };
  body(run, [
    [17, 12],
    [16, 12],
    [15, 12],
    [14, 12],
    [13, 12],
  ]);
  body(
    run,
    [
      [6, 12],
      [7, 12],
      [8, 12],
      [9, 12],
    ],
    1,
    'left',
  );
  stepClassicSnake(run);
  assert.equal(run.status, 'won');
  assert.equal(run.operation.stage, 1);
  assert.equal(run.events.filter((e) => e.type === 'run.completed').length, 1);
});

test('intermediate stage keeps the same body, clock and input; finite quota cannot auto-win', () => {
  const run = make(0);
  place(run, 19, 3);
  body(run, [
    [18, 3],
    [17, 3],
    [16, 3],
    [15, 3],
  ]);
  stepClassicSnake(run);
  assert.equal(run.operation.stage, 1);
  assert.equal(run.status, 'running');
  assert.equal(run.snakes[0].body.length, 5);
  assert.equal(run.tick, 1);
  assert.equal(
    run.events.some((e) => e.type === 'run.completed'),
    false,
  );
  place(run, 20, 3);
  stepClassicSnake(run);
  assert.equal(run.catches, 2);
  assert.equal(run.targets.length, 0);
  assert.equal(run.status, 'running');
  body(
    run,
    [
      [5, 14],
      [6, 14],
      [7, 14],
      [8, 14],
      [9, 14],
      [10, 14],
    ],
    0,
    'left',
  );
  stepClassicSnake(run);
  assert.equal(run.status, 'won');
});

test('target plus parcel on one accepted move retains two growth credits without duplicate body cells', () => {
  const run = make();
  place(run, 9, 2);
  body(run, [
    [8, 2],
    [7, 2],
    [6, 2],
    [5, 2],
  ]);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 5);
  assert.equal(run.snakes[0].pendingGrowth, 1);
  place(run, 22, 16);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 6);
  assert.equal(run.snakes[0].pendingGrowth, 0);
  assert.equal(new Set(run.snakes[0].body.map((p) => `${p.x},${p.y}`)).size, 6);
});

test('supplies still trigger after the finite quota while extraction remains pending', () => {
  const l = level();
  l.pickups = [{ at: 2, kind: 'reel', pads: [{ x: 6, y: 6 }] }];
  const run = createClassicSnake(l);
  run.catches = 1;
  place(run, 6, 2);
  stepClassicSnake(run);
  assert.equal(run.status, 'running');
  assert.equal(run.pickup.kind, 'reel');
});

test('reel cannot remove cargo growth; delivery restores the normal four-segment floor', () => {
  const run = make();
  place(run, 22, 16);
  run.operation.parcels[0] = { id: 'parcel-a', state: 'carried', carrier: 0 };
  run.pickup = { id: 'pickup-1', kind: 'reel', x: 6, y: 2, bornTick: -1 };
  body(run, [
    [5, 2],
    [4, 2],
    [3, 2],
    [2, 2],
    [1, 2],
    [0, 2],
    [0, 3],
    [1, 3],
  ]);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 5);
  body(run, [
    [17, 12],
    [16, 12],
    [15, 12],
    [14, 12],
    [13, 12],
  ]);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 4);
});

test('operation state is compact, immutable in visual snapshots and verified in recordings', () => {
  const run = make();
  for (let i = 0; i < 4; i++) stepClassicSnake(run);
  assert.equal(run.operation.parcels[0].state, 'carried');
  const replay = exportClassicSnakeReplay(run),
    restored = restoreClassicSnakeReplay(replay);
  assert.deepEqual(restored, run);
  const frame = classicVisualSnapshot(run);
  assert.equal(frame.level, run.level);
  assert.equal(frame.history, undefined);
  assert.deepEqual(classicOperationMarkers(frame), classicOperationMarkers(run));
  assert.ok(classicOperationMarkers(frame).some((p) => p.kind === 'attached'));
  frame.operation.parcels[0].state = 'delivered';
  assert.equal(run.operation.parcels[0].state, 'carried');
  for (const change of [
    (r) => (r.checkpoint = '0000000000000000'),
    (r) => r.level.operation.parcels[0].at.x++,
    (r) => (r.ruleset = 'classic-snake-core.v4'),
  ]) {
    const r = structuredClone(replay);
    change(r);
    assert.throws(() => restoreClassicSnakeReplay(r));
  }
  assert.equal(classicSnakeSummary(run).operation.carried, 1);
});

test('Mission Race uses independent v5 boards and match verification preserves stages', () => {
  const match = createClassicSnakeMatch(level(), { mode: 'versus', policy: 'mission' });
  advanceClassicSnakeMatchTo(match, 800);
  assert.equal(match.runs[0].operation.parcels[0].state, 'carried');
  assert.notEqual(match.runs[0].operation, match.runs[1].operation);
  assert.deepEqual(restoreClassicSnakeMatch(exportClassicSnakeMatch(match)), match);
});

test('all eight prototype routes complete in Solo and Team at three paces, without mutating recipes', async () => {
  const { readFile } = await import('node:fs/promises');
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v5-prototype-proofs.json', import.meta.url)),
  );
  assert.equal(proofs.length, 16);
  for (const proof of proofs) {
    const recipe = OPERATION_PROTOTYPES.find((p) => p.level.id === proof.level.id).level;
    const restored = restoreClassicSnakeReplay(proof, { level: recipe });
    assert.equal(restored.status, 'won');
    assert.equal(restored.operation.stage, recipe.operation.stages.length);
    for (const factor of Object.values(CLASSIC_PACES)) {
      const stepMs = Math.round(recipe.stepMs * factor);
      const paced = { ...structuredClone(recipe), stepMs, minStepMs: stepMs };
      const run = createClassicSnake(paced, { mode: proof.mode, seed: proof.seed });
      let cursor = 0;
      for (let tick = 0; tick < proof.steps; tick++) {
        while (proof.turns[cursor]?.tick === tick) {
          const turn = proof.turns[cursor++];
          assert.ok(queueClassicSnakeTurn(run, turn.playerId, turn.direction));
        }
        stepClassicSnake(run);
      }
      assert.equal(run.status, 'won', `${recipe.id}/${proof.mode}/${stepMs}`);
      assert.equal(run.elapsedMs, proof.steps * stepMs);
      assert.equal(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)).status, 'won');
    }
  }
});
