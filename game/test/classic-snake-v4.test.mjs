import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createClassicSnake,
  classicSnakeUsesVariableHazards,
  validateClassicSnakeLevel,
  stepClassicSnake,
  queueClassicSnakeTurn,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
} from '../snake/classic-core.mjs';
import { classicSnakeHazardAtV4 } from '../snake/classic-core-v4.mjs';
import {
  CLASSIC_SNAKE_V4_LEVELS,
  CLASSIC_SNAKE_V4_INITIAL_LEVELS,
} from '../snake/classic-catalogue-v4.mjs';
import { CLASSIC_SNAKE_FIELD_V3_ARCHIVED_LEVELS } from '../snake/classic-catalogue-field-v3-archive.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import { classicMechanicGuide } from '../snake/classic-mechanic-guide.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { CLASSIC_SNAKE_V4_KINDS } from '../snake/classic-core-v4.mjs';

const entry = (slug) => CLASSIC_SNAKE_V4_LEVELS.find((row) => row.id === `classic-field-${slug}`);
// Retain coverage of the original, unprofiled v4 mechanic rules.
const make = (slug, options = {}) => {
  const fixture =
    CLASSIC_SNAKE_FIELD_V3_ARCHIVED_LEVELS.find((row) => row.id === `classic-field-${slug}`) ??
    entry(slug);
  const level = structuredClone(fixture.level);
  for (const policy of level.targets.required) delete policy.signalProfile;
  return createClassicSnake(level, options);
};
function circulate(run, count) {
  for (let i = 0; i < count; i++) {
    const head = run.snakes[0].body[0];
    const direction =
      head.x === 20 && head.y === 2
        ? 'down'
        : head.x === 20 && head.y === 15
          ? 'left'
          : head.x === 3 && head.y === 15
            ? 'up'
            : head.x === 3 && head.y === 2
              ? 'right'
              : run.snakes[0].direction;
    queueClassicSnakeTurn(run, 0, direction);
    stepClassicSnake(run);
    assert.equal(run.status, 'running');
  }
}
const front = (run, target) => {
  target.x = run.snakes[0].body[0].x + 1;
  target.y = run.snakes[0].body[0].y;
};

test('v4 admits ten teaching/mastery/combined recipes and exact replay', () => {
  assert.equal(CLASSIC_SNAKE_V4_INITIAL_LEVELS.length, 10);
  for (const row of CLASSIC_SNAKE_V4_INITIAL_LEVELS) {
    assert.deepEqual(validateClassicSnakeLevel(row.level), row.level);
    const run = createClassicSnake(row.level, {
      seed: 91,
      ...(classicSnakeUsesVariableHazards(row.level) ? { hazardSeed: 17 } : {}),
    });
    circulate(run, 10);
    assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
  }
});

test('broadcast teaching precedes combined encounters and uses the approved names and scope', () => {
  assert.deepEqual(
    CLASSIC_SNAKE_V4_INITIAL_LEVELS.map((row) => row.id),
    [
      'classic-field-signal-check',
      'classic-field-quiet-return',
      'classic-field-lane-window',
      'classic-field-two-returns',
      'classic-field-relay-key',
      'classic-field-linked-courts',
      'classic-field-broadcast-check',
      'classic-field-quiet-channel',
      'classic-field-signal-crossing',
      'classic-field-relay-airfield',
    ],
  );
  assert.deepEqual(entry('quiet-channel').title, { en: 'Quiet Channel', uk: 'Тихий канал' });
  assert.equal(entry('quiet-channel').level.name, 'Quiet Channel');
  assert.equal(entry('quiet-channel').level.revision, '2');
  assert.equal(entry('broadcast-check').level.revision, '2');
  for (const slug of ['broadcast-check', 'quiet-channel', 'relay-airfield'])
    assert.ok(
      entry(slug)
        .level.targets.required.filter((target) => target.kind === 'jammer')
        .every((target) => target.signalProfile === 'broadcast-burst-v1'),
    );
  assert.equal(entry('signal-crossing').level.targets.required[0].signalProfile, 'local-burst-v2');
  for (const slug of ['signal-check', 'quiet-return', 'signal-crossing', 'field-links'])
    assert.equal(entry(slug).level.revision, '4');
  assert.equal(entry('relay-airfield').level.revision, '3');
  assert.match(entry('relay-airfield').description.en, /broadcast beacon/);
  assert.match(entry('relay-airfield').description.uk, /маячок трансляції/);
});

test('jamming has a visible warning, four moves of interference and no steering mutation', () => {
  const run = make('signal-check');
  circulate(run, 12);
  assert.equal(run.targets[0].phase, 'warning');
  assert.equal(run.targets[0].phaseTicks, 4);
  circulate(run, 4);
  assert.deepEqual(run.signal, { jammed: true, remainingTicks: 4 });
  circulate(run, 4);
  assert.deepEqual(run.signal, { jammed: false, remainingTicks: 0 });
  assert.equal(run.targets[0].phaseTicks, 12);
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
});

test('fast setup still provides at least 800ms warning and keeps new target policies', () => {
  const recipe = prepareClassicSnakeLevel(entry('lane-window'), { pace: 'fast' });
  const run = createClassicSnake(recipe);
  circulate(run, 8);
  assert.equal(run.targets[0].phase, 'warning');
  assert.ok(run.targets[0].phaseTicks * recipe.minStepMs >= 800);
  assert.equal(run.targets[0].kind, 'lane');
});

test('capturing the jammer immediately restores reception and produces one catch', () => {
  const run = make('signal-check');
  const target = run.targets[0];
  front(run, target);
  target.phase = 'jamming';
  target.phaseTicks = 4;
  run.signal = { jammed: true, remainingTicks: 4 };
  stepClassicSnake(run);
  assert.equal(run.catches, 1);
  assert.equal(run.signal.jammed, false);
  assert.equal(run.events.filter((event) => event.type === 'target.caught').length, 1);
});

test('winning retires interference and projectiles before the celebration board is drawn', () => {
  const run = make('signal-crossing');
  const jammer = run.targets.find((target) => target.kind === 'jammer');
  const lane = run.targets.find((target) => target.kind === 'lane');
  jammer.phase = 'jamming';
  jammer.phaseTicks = 4;
  run.signal = { jammed: true, remainingTicks: 4 };
  run.catches = run.level.goal - 1;
  front(run, lane);
  stepClassicSnake(run);
  assert.equal(run.status, 'won');
  assert.deepEqual(run.signal, { jammed: false, remainingTicks: 0 });
  assert.deepEqual(run.projectiles, []);
});

test('active lane affects heads only and cannot kill a trailing occupied segment', () => {
  const run = make('lane-window');
  const target = run.targets[0];
  target.phase = 'active';
  target.phaseTicks = 2;
  run.snakes[0].body = [
    { x: 10, y: 9 },
    { x: 10, y: 8 },
    { x: 9, y: 8 },
    { x: 8, y: 8 },
  ];
  run.snakes[0].direction = 'down';
  stepClassicSnake(run);
  assert.equal(run.status, 'running');
  assert.equal(classicSnakeHazardAtV4(run, { x: 11, y: 8 }), 'lane');
  assert.equal(classicSnakeHazardAtV4(run, { x: 4, y: 8 }), null);
  const collision = make('lane-window');
  collision.targets[0].phase = 'active';
  collision.targets[0].phaseTicks = 2;
  collision.snakes[0].body = [
    { x: 10, y: 7 },
    { x: 9, y: 7 },
    { x: 8, y: 7 },
    { x: 7, y: 7 },
  ];
  collision.snakes[0].direction = 'down';
  stepClassicSnake(collision);
  assert.equal(collision.failure.cause, 'lane');
});

test('no newly lethal lane during interference and its full warning resumes afterward', () => {
  const run = make('signal-crossing');
  const jammer = run.targets.find((target) => target.kind === 'jammer');
  const lane = run.targets.find((target) => target.kind === 'lane');
  jammer.phase = 'jamming';
  jammer.phaseTicks = 4;
  lane.phase = 'warning';
  lane.phaseTicks = 1;
  for (let i = 0; i < 3; i++) {
    stepClassicSnake(run);
    assert.equal(lane.phase, 'warning');
    assert.equal(lane.phaseTicks, 4);
  }
  stepClassicSnake(run);
  assert.equal(run.signal.jammed, false);
  assert.equal(lane.phase, 'warning');
  assert.equal(lane.phaseTicks, 4);
});

test('relay pads do not grow the body, count as enemies or relock an opened sentinel', () => {
  const run = make('relay-key');
  const target = run.targets[0];
  run.relays[0].x = 6;
  run.relays[0].y = 2;
  run.relays[1].x = 7;
  run.relays[1].y = 2;
  stepClassicSnake(run);
  stepClassicSnake(run);
  assert.equal(run.snakes[0].body.length, 4);
  assert.equal(run.catches, 0);
  assert.equal(target.phase, 'open');
  circulate(run, 60);
  assert.equal(target.phase, 'open');
  front(run, target);
  const head = run.snakes[0].body[0];
  target.x = head.x;
  target.y = head.y + 1;
  run.snakes[0].direction = 'down';
  stepClassicSnake(run);
  assert.equal(run.catches, 1);
  assert.equal(run.status, 'won');
});

test('locked relay contact uses the pre-step shield state', () => {
  const run = make('relay-key');
  front(run, run.targets[0]);
  stepClassicSnake(run);
  assert.equal(run.failure.cause, 'relay');
  assert.equal(run.catches, 0);
});

test('new recipes reject lanes without bypasses, invalid relay pads and unmarked erosion', () => {
  const lane = structuredClone(entry('lane-window').level);
  lane.targets.required[0].lane.from = 0;
  assert.throws(() => validateClassicSnakeLevel(lane), /bypass/);
  const relay = structuredClone(entry('relay-key').level);
  relay.targets.required[0].relays[1] = relay.targets.required[0].relays[0];
  assert.throws(() => validateClassicSnakeLevel(relay), /separate/);
  const eroder = structuredClone(entry('open-seam').level);
  eroder.targets.required[0].breaks = [{ x: 4, y: 4 }];
  assert.throws(() => validateClassicSnakeLevel(eroder), /marked adjacent walls/);
});

test('projectiles terminate at walls, cannot materialize inside a body, and only threaten heads', () => {
  const run = make('guard-line');
  const guard = run.targets[0];
  guard.phase = 'warning';
  guard.phaseTicks = 1;
  run.snakes[0].body = [
    { x: 9, y: 8 },
    { x: 8, y: 8 },
    { x: 7, y: 8 },
    { x: 7, y: 9 },
  ];
  run.snakes[0].direction = 'down';
  stepClassicSnake(run);
  assert.equal(run.projectiles.length, 0);
  assert.equal(guard.phase, 'warning');
  const clear = make('guard-line');
  clear.targets[0].phase = 'warning';
  clear.targets[0].phaseTicks = 1;
  stepClassicSnake(clear);
  assert.equal(clear.projectiles.length, 1);
  clear.projectiles[0].x = 10;
  clear.projectiles[0].y = 3;
  clear.projectiles[0].heading = 'down';
  stepClassicSnake(clear);
  assert.equal(clear.projectiles.length, 0);
});

test('later prey never moves into a snake and eroders only open authored wall cells', () => {
  for (const slug of ['border-watch', 'contour-orbit', 'wake-watch', 'ricochet-line']) {
    const run = make(slug);
    circulate(run, 48);
    const body = new Set(run.snakes.flatMap((snake) => snake.body.map(({ x, y }) => `${x},${y}`)));
    assert.ok(run.targets.every(({ x, y }) => !body.has(`${x},${y}`)));
    assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
  }
  const run = make('open-seam');
  circulate(run, 12);
  assert.deepEqual(run.removedWalls, [{ x: 12, y: 8 }]);
  assert.ok(run.level.walls.some((cell) => cell.x === 12 && cell.y === 8));
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
});

test('v4 appends 48 distinct authored encounters while historical versions retain 96 entries', () => {
  assert.equal(CLASSIC_SNAKE_LEVELS.length, 144);
  assert.equal(CLASSIC_SNAKE_LEVELS.filter((row) => !row.level.version.endsWith('v4')).length, 96);
  assert.deepEqual(
    CLASSIC_SNAKE_V4_LEVELS.map((row) => row.chapterId).reduce((counts, id) => {
      counts[id] = (counts[id] ?? 0) + 1;
      return counts;
    }, {}),
    {
      'classic-snake-signal-tactics': 10,
      'classic-snake-patrol-frontiers': 6,
      'classic-snake-field-mastery': 8,
      'classic-snake-crossing-routes': 6,
      'classic-snake-changing-shortcuts': 6,
      'classic-snake-hidden-signals': 6,
      'classic-snake-expedition-circuits': 6,
    },
  );
  assert.equal(
    new Set(CLASSIC_SNAKE_V4_LEVELS.map((row) => JSON.stringify(row.level.walls))).size,
    48,
  );
  for (const row of CLASSIC_SNAKE_V4_LEVELS)
    assert.deepEqual(validateClassicSnakeLevel(row.level), row.level);
});

test('every v4 campaign mission has a verified Solo and Team winning proof at every pace', async () => {
  const source = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v4-proofs.json', import.meta.url), 'utf8'),
  );
  assert.equal(source.proofs.length, 288);
  const keys = new Set();
  for (const proof of source.proofs) {
    const row = CLASSIC_SNAKE_V4_LEVELS.find((item) => item.id === proof.levelId);
    const accepted = prepareClassicSnakeLevel(row, { pace: proof.pace });
    const run = restoreClassicSnakeReplay(proof.replay, { level: accepted });
    assert.equal(run.status, 'won', `${proof.levelId}/${proof.mode}/${proof.pace}`);
    assert.equal(run.seed, 17);
    assert.equal(run.mode, proof.mode);
    keys.add(`${proof.levelId}/${proof.mode}/${proof.pace}`);
  }
  assert.equal(keys.size, 288);
});

test('mechanic rendering is deterministic, supports reduced effects, and never changes replay authority', async () => {
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v4-proofs.json', import.meta.url), 'utf8'),
  );
  const calls = [];
  const ctx = new Proxy(
    {},
    { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) },
  );
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  for (const row of CLASSIC_SNAKE_V4_LEVELS) {
    const proof = proofs.find(
      (item) => item.levelId === row.id && item.mode === 'solo' && item.pace === 'normal',
    ).replay;
    const run = createClassicSnake(proof.level, {
      seed: proof.seed,
      ...(proof.hazardSeed === undefined ? {} : { hazardSeed: proof.hazardSeed }),
    });
    // Different starts and routes require their own accepted inputs; an old
    // perimeter loop is not a valid render probe for every authored board.
    let cursor = 0;
    for (let tick = 0; tick < Math.min(16, proof.steps); tick++) {
      while (proof.turns[cursor]?.tick === tick) {
        const turn = proof.turns[cursor++];
        assert.ok(queueClassicSnakeTurn(run, turn.playerId, turn.direction));
      }
      stepClassicSnake(run);
    }
    const before = JSON.stringify(run),
      replay = exportClassicSnakeReplay(run);
    for (const reduced of [false, true]) drawClassicBoard(canvas, run, { reduced, pixelRatio: 2 });
    assert.equal(JSON.stringify(run), before);
    assert.deepEqual(exportClassicSnakeReplay(run), replay);
    assert.equal(canvas.width, 1344);
  }
  assert.ok(calls.some(([method]) => method === 'strokeRect'));
  for (const kind of CLASSIC_SNAKE_V4_KINDS) {
    const en = classicMechanicGuide(kind, 'en'),
      uk = classicMechanicGuide(kind, 'uk');
    assert.equal(en.kind, kind);
    for (const key of ['name', 'goal', 'tell', 'counter']) {
      assert.ok(en[key].length > 0 && uk[key].length > 0);
      assert.notEqual(en[key], uk[key]);
    }
  }
});
