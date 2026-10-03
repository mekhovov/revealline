import test from 'node:test';
import assert from 'node:assert/strict';
import { createHuntTrainingCandidates } from '../content-design/hunt-training-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, releaseInputs, validateLevel } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
} from '../replay.mjs';
import {
  snakeContacts,
  recordSnakeCatch,
  recordSnakeReturn,
  snakeSummary,
} from '../snake/rules.mjs';

const definition = {
  version: 'snake-hunt.v1',
  initialLength: 6,
  growthPerCatch: 2,
  maxLength: 24,
  shedOnReturn: 0,
  friendlyTail: 'self',
  bonus: 'chain',
  chainWindowTicks: 600,
  order: [],
};
function level() {
  const project = compileContentProject(createHuntTrainingCandidates({ artwork: false }));
  const manifest = resolveMission(project, 'hunt-final-roundup', {
    mode: 'solo',
    difficulty: 'standard',
  });
  return {
    ...manifest.level,
    id: 'snake-regression',
    spawn: { x: 5.5, y: 0.5 },
    version: 'xonix-level.v11',
    snake: { ...definition },
  };
}

test('Snake persists on safe territory, pauses without shedding, and hits its own body with replay parity', async () => {
  const source = level(),
    run = createRun(source, { seed: 5 }),
    recorder = createRecorder(source, { seed: 5 });
  for (let tick = 0; tick < 90; tick++) {
    const command = { direction: 'right' };
    recordInput(recorder, command);
    stepRun(run, command);
  }
  assert.equal(run.turnPolicy, 'grid-center');
  assert.equal(run.player.cutting, false);
  assert.equal(run.snake.bodies[0].length, 6);
  const body = structuredClone(run.snake);
  releaseInputs(run);
  recordRelease(recorder);
  assert.deepEqual(run.snake, body);
  let failed;
  for (let tick = 0; tick < 90 && run.status === 'running'; tick++) {
    const command = { direction: 'left' };
    recordInput(recorder, command);
    stepRun(run, command);
    failed = run.events.find((event) => event.type === 'player.failed') ?? failed;
  }
  assert.equal(failed.cause, 'snake-body');
  assert.equal(run.lives, source.rules.lives - 1);
  assert.equal(run.snake.bodies[0].length, 0);
  assert.equal(run.snake.bodies[0].capacity, 6);
  const replay = exportReplay(recorder, run);
  assert.equal(replay.version, 'xonix-replay.v13');
  assert.equal(replay.checkpoint.algorithm, 'fnv1a64-state-v12');
  assert.equal((await verifyReplayAsync(replay)).match, true);
});

test('Snake growth, shedding and optional order bonuses never rewrite the required Hunt population', () => {
  const source = level();
  source.snake = {
    ...definition,
    shedOnReturn: 2,
    bonus: 'ordered',
    order: source.classic.hunt.targets.map((target) => target.id),
  };
  const run = createRun(source);
  const targets = structuredClone(run.level.classic.hunt);
  recordSnakeCatch(run, source.snake.order[0]);
  assert.equal(run.snake.bodies[0].capacity, 8);
  assert.equal(snakeSummary(run).bonusScore, 50);
  recordSnakeCatch(run, source.snake.order[2]);
  assert.equal(run.snake.bodies[0].capacity, 10);
  assert.equal(snakeSummary(run).bonusScore, 50);
  recordSnakeCatch(run, source.snake.order[2]);
  assert.equal(run.snake.bodies[0].capacity, 10);
  recordSnakeCatch(run, source.snake.order[1]);
  assert.equal(snakeSummary(run).nextTargetId, source.snake.order[3]);
  assert.equal(snakeSummary(run).bonusScore, 150);
  recordSnakeReturn(run, 0);
  assert.equal(run.snake.bodies[0].capacity, 10);
  assert.deepEqual(run.level.classic.hunt, targets);
  assert.equal(run.classic.hunt.kills, 0); // The shared observer never invents an elimination.
});

test('moving tail vacates continuously instead of leaving a stale whole-segment collision', () => {
  const run = {
    level: { snake: { ...definition, friendlyTail: 'team' } },
    players: [{ status: 'active' }, { status: 'active' }],
    snake: {
      bodies: [
        { playerId: 0, points: [{ x: -1, y: 0 }], length: 0, capacity: 4 },
        {
          playerId: 1,
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
          ],
          length: 4,
          capacity: 4,
        },
      ],
    },
  };
  const plans = [
    { playerId: 0, radius: 0.18, paths: [{ x1: -1, y1: 0, x2: 1, y2: 0, t0: 0, t1: 1 }] },
    { playerId: 1, radius: 0.18, paths: [{ x1: 2, y1: 2, x2: 2, y2: 4, t0: 0, t1: 1 }] },
  ];
  assert.deepEqual(snakeContacts(run, plans, 1), []);
  plans[1].paths[0].y2 = 2;
  assert.equal(snakeContacts(run, plans, 1)[0].player, 0);
});

test('historical Hunt cannot silently admit Snake state or malformed new recipes', () => {
  const source = level();
  assert.equal(validateLevel(source).valid, true);
  assert.equal(validateLevel({ ...source, version: 'xonix-level.v9' }).valid, false);
  assert.equal(
    validateLevel({ ...source, snake: { ...source.snake, maxLength: 65 } }).valid,
    false,
  );
  assert.equal(
    validateLevel({ ...source, snake: { ...source.snake, bonus: 'ordered', order: [] } }).valid,
    false,
  );
  assert.equal(
    validateLevel({
      ...source,
      classic: { ...source.classic, hunt: { ...source.classic.hunt, quota: 1 } },
    }).valid,
    false,
  );
  assert.throws(() => createRun(source, { turnPolicy: 'instant' }), /unsupported turnPolicy/);
});
