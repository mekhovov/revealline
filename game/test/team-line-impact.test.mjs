import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoop,
  pauseCoop,
  releaseCoopInputs,
  resumeCoop,
  startCoop,
  stepCoop,
  validateCoopLevel,
  FIXED_DT,
} from '../coop/core.mjs';
import {
  advanceImpacts,
  clearInvalidImpacts,
  planImpacts,
  seedTrailImpacts,
} from '../coop/threats.mjs';

const command = (direction = null) => ({ direction, boost: false, support: false });
const neutral = () => [command(), command()];

function level(changes = {}) {
  return {
    version: 'revealline-coop-level.v6',
    id: 'owned-impact-contract',
    revision: 'owned-impact-1',
    name: 'Owned impact contract fixture',
    width: 72,
    height: 36,
    spawns: [
      { x: 20.5, y: 0.5 },
      { x: 30.5, y: 0.5 },
    ],
    walls: [],
    safeRects: [],
    terrain: [],
    enemies: [{ id: 'keeper', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 }],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 10, boostMultiplier: 1.5 },
    journeyDifficulty: 'standard',
    lineImpact: { version: 'team-line-impact.v2', speed: 24 },
    timedBonuses: {
      version: 'timed-bonuses.v2',
      schedules: [
        {
          id: 'distant-freeze',
          kind: 'enemy-freeze',
          anchors: [
            { x: 50.5, y: 10.5 },
            { x: 55.5, y: 20.5 },
          ],
          initialDelayTicks: 1200,
          announcementTicks: 120,
          availableTicks: 240,
          cooldownTicks: 240,
          maxAppearances: 1,
          maxCollections: 1,
        },
      ],
    },
    ...changes,
  };
}

function running(source = level()) {
  const run = createCoop(source);
  startCoop(run);
  return run;
}

function arrangeCut(run, seat, cells, safeAnchor = { x: cells[0].x + 0.5, y: 0.5 }) {
  const player = run.players[seat];
  const last = cells.at(-1);
  Object.assign(player, {
    x: last.x + 0.5,
    y: last.y + 0.5,
    cellIndex: last.y * run.width + last.x,
    safeAnchor,
    departureIndex: Math.floor(safeAnchor.y) * run.width + Math.floor(safeAnchor.x),
    trail: cells.map((cell) => ({ ...cell, index: cell.y * run.width + cell.x })),
    cutting: true,
    cutId: player.nextCutId++,
    impactSources: [],
    direction: null,
    blockedDirection: null,
  });
}

const vertical = (x, first, last) =>
  Array.from({ length: Math.abs(last - first) + 1 }, (_, index) => ({
    x,
    y: first + index * Math.sign(last - first || 1),
  }));

test('v2 travelling impacts require the explicit Team impact edition', () => {
  assert.equal(validateCoopLevel(level()).valid, true);
  assert.equal(validateCoopLevel({ ...level(), version: 'revealline-coop-level.v5' }).valid, false);
  assert.equal(
    validateCoopLevel({ ...level(), lineImpact: { version: 'team-line-impact.v2', speed: 0 } })
      .valid,
    false,
  );
});

test('one enemy source seeds two fronts once for a stable player and cut identity', () => {
  const run = running();
  arrangeCut(run, 0, vertical(20, 1, 10));
  const cellIndex = 5 * run.width + 20;
  const events = [];
  const emit = (_run, type, data) => events.push({ type, ...data });
  const launched = seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 0, cellIndex },
    emit,
  );
  assert.deepEqual(
    launched.map((impact) => impact.direction),
    [-1, 1],
  );
  assert.ok(launched.every((impact) => impact.player === 0 && impact.cutId === 1));
  assert.ok(launched.every((impact) => impact.speed === 24));
  assert.equal(events.filter((event) => event.type === 'impact.launched').length, 1);
  assert.deepEqual(
    seedTrailImpacts(run, { owner: 'keeper', source: 'enemy', player: 0, cellIndex }, emit),
    [],
  );
});

test('front ownership survives partner changes, trims secured cells and never transfers to a later cut', () => {
  const run = running();
  arrangeCut(run, 0, vertical(20, 1, 10));
  arrangeCut(run, 1, vertical(30, 1, 8));
  const emit = () => {};
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 0, cellIndex: 5 * 72 + 20 },
    emit,
  );
  const ids = run.impacts.map((impact) => impact.id);

  run.players[1].trail = [];
  run.players[1].cutting = false;
  run.players[1].cutId = null;
  clearInvalidImpacts(run, emit);
  assert.deepEqual(
    run.impacts.map((impact) => impact.id),
    ids,
  );

  run.players[0].trail = run.players[0].trail.filter((cell) => cell.y >= 5);
  run.cells[4 * 72 + 20] = 1;
  run.impacts[0].cellIndex = 4 * 72 + 20;
  run.impacts[1].cellIndex = 7 * 72 + 20;
  clearInvalidImpacts(run, emit);
  assert.deepEqual(
    run.impacts.map((impact) => impact.direction),
    [1],
  );

  const oldCutId = run.players[0].cutId;
  run.players[0].cutting = false;
  run.players[0].cutId = null;
  clearInvalidImpacts(run, emit);
  assert.equal(run.impacts.length, 0);
  arrangeCut(run, 0, vertical(21, 1, 6));
  assert.notEqual(run.players[0].cutId, oldCutId);
});

test('one partner closing removes only that owned cut while the other player fronts continue', () => {
  const run = running();
  arrangeCut(run, 0, vertical(20, 1, 10));
  arrangeCut(run, 1, [{ x: 30, y: 1 }]);
  run.players[1].y = 1.05;
  run.players[1].cellIndex = run.width + 30;
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 0, cellIndex: 5 * run.width + 20 },
    () => {},
  );
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 1, cellIndex: run.width + 30 },
    () => {},
  );
  const firstCut = run.players[0].cutId;

  stepCoop(run, [command(), command('up')], FIXED_DT);

  assert.equal(run.players[0].cutting, true);
  assert.equal(run.players[0].cutId, firstCut);
  assert.equal(run.players[1].cutting, false);
  assert.equal(run.players[1].cutId, null);
  assert.equal(run.impacts.length, 2);
  assert.ok(run.impacts.every((impact) => impact.player === 0 && impact.cutId === firstCut));
  assert.ok(
    run.events.some(
      (event) => event.type === 'cut.closed' && event.player === 1 && event.cutId === 1,
    ),
  );
});

test('a joint closure cancels both participating owned cuts without transferring either identity', () => {
  const run = running();
  arrangeCut(run, 0, vertical(20, 1, 10));
  arrangeCut(run, 1, vertical(21, 1, 10));
  run.players[0].x = 20.5;
  run.players[0].y = 10.5;
  run.players[1].x = 20.8;
  run.players[1].y = 10.5;
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 0, cellIndex: 3 * run.width + 20 },
    () => {},
  );
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 1, cellIndex: 3 * run.width + 21 },
    () => {},
  );

  stepCoop(run, neutral(), FIXED_DT);

  assert.equal(run.players[0].cutting, false);
  assert.equal(run.players[1].cutting, false);
  assert.equal(run.impacts.length, 0);
  assert.deepEqual(
    run.events
      .filter((event) => event.type === 'cut.closed')
      .map((event) => [event.player, event.cutId, event.reason]),
    [
      [0, 1, 'joint'],
      [1, 1, 'joint'],
    ],
  );
  assert.ok(run.events.some((event) => event.type === 'cut.joint'));
});

test('partner-fill prefix trimming clears secured fronts and rebases a surviving departure front', () => {
  const run = running();
  arrangeCut(run, 0, vertical(20, 1, 10));
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 0, cellIndex: 5 * run.width + 20 },
    () => {},
  );
  const [departure, playerBound] = run.impacts;
  departure.cellIndex = 5 * run.width + 20;
  departure.x = 20.5;
  departure.y = 5.5;
  playerBound.cellIndex = 4 * run.width + 20;
  playerBound.x = 20.5;
  playerBound.y = 4.5;
  for (let y = 1; y <= 4; y++) run.cells[y * run.width + 20] = 1;
  run.players[0].trail = run.players[0].trail.filter((cell) => cell.y >= 5);
  run.players[0].safeAnchor = { x: 20.5, y: 4.5 };
  run.players[0].departureIndex = 4 * run.width + 20;

  clearInvalidImpacts(run, () => {});

  assert.deepEqual(
    run.impacts.map((impact) => impact.id),
    [departure.id],
  );
  const [plan] = planImpacts(
    run,
    neutral().map(() => ({ x: 0, y: 0 })),
    FIXED_DT,
  );
  assert.equal(plan.impact.cutId, run.players[0].cutId);
  assert.equal(plan.expires, true);
  assert.equal(plan.nextCellIndex, null);
  assert.equal(plan.velocity.x, 0);
  assert.equal(plan.velocity.y, -24);
  assert.ok(Math.abs(plan.waypointAt - 1 / 24) < 1e-9);
});

test('downing clears only the failed owned cut and a later cut receives a fresh identity', () => {
  const run = running();
  arrangeCut(run, 0, vertical(20, 1, 10));
  arrangeCut(run, 1, vertical(30, 1, 8));
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 0, cellIndex: 5 * run.width + 20 },
    () => {},
  );
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 1, cellIndex: 5 * run.width + 30 },
    () => {},
  );
  const firstCut = run.players[0].cutId;
  run.enemies[0].x = run.players[0].x;
  run.enemies[0].y = run.players[0].y;

  stepCoop(run, neutral(), FIXED_DT);

  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.players[0].cutId, null);
  assert.ok(run.impacts.every((impact) => impact.player === 1));
  assert.ok(run.impacts.every((impact) => impact.cutId === run.players[1].cutId));
  run.players[0].status = 'active';
  run.players[0].graceUntil = 0;
  arrangeCut(run, 0, vertical(21, 1, 6));
  assert.notEqual(run.players[0].cutId, firstCut);
  assert.ok(run.impacts.every((impact) => impact.player === 1));
});

test('pause and disconnect-style input release preserve stable front ownership', () => {
  const run = running();
  arrangeCut(run, 0, vertical(20, 1, 10));
  seedTrailImpacts(
    run,
    { owner: 'keeper', source: 'enemy', player: 0, cellIndex: 5 * run.width + 20 },
    () => {},
  );
  const owned = run.impacts.map(({ id, player, cutId }) => ({ id, player, cutId }));

  releaseCoopInputs(run);
  pauseCoop(run);
  assert.deepEqual(
    run.impacts.map(({ id, player, cutId }) => ({ id, player, cutId })),
    owned,
  );
  resumeCoop(run);
  stepCoop(run, neutral(), FIXED_DT);

  assert.deepEqual(
    run.impacts.map(({ id, player, cutId }) => ({ id, player, cutId })),
    owned,
  );
});

test('live enemy contact launches fronts without an immediate loss and fixed impact speed ignores enemy slow', () => {
  const run = running(
    level({
      enemies: [{ id: 'keeper', type: 'drifter', x: 20.5, y: 5.5, vx: 0, vy: 0, radius: 0.2 }],
    }),
  );
  arrangeCut(run, 0, vertical(20, 1, 10));
  stepCoop(run, neutral(), FIXED_DT);
  assert.equal(run.players[0].status, 'active');
  assert.equal(run.impacts.length, 2);
  assert.ok(run.events.some((event) => event.type === 'impact.launched'));
  // Impact velocity is owned by the policy, not by enemy movement modifiers.
  run.bonuses.effects['enemy-slow'] = { from: 0, until: 10 };
  const plans = planImpacts(
    run,
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    FIXED_DT,
  );
  const before = run.impacts.map((impact) => impact.progress);
  advanceImpacts(plans, FIXED_DT);
  run.impacts.forEach((impact, index) =>
    assert.ok(Math.abs(impact.progress - before[index] - 24 * FIXED_DT) < 1e-9),
  );
});

test('a valid closure wins an exact craft-front arrival tie and clears only that owned cut', () => {
  const run = running();
  arrangeCut(run, 0, [{ x: 20, y: 1 }]);
  run.players[0].y = 1.05;
  run.impacts = [
    {
      id: 'impact-tie',
      version: 'team-line-impact.v2',
      owner: 'keeper',
      source: 'enemy',
      player: 0,
      cutId: run.players[0].cutId,
      direction: 1,
      speed: 24,
      cellIndex: 1 * run.width + 20,
      x: 20.5,
      y: 1.42,
      progress: 0,
    },
  ];
  stepCoop(run, [command('up'), command()], FIXED_DT);
  assert.equal(run.players[0].status, 'active');
  assert.equal(run.players[0].cutting, false);
  assert.equal(run.impacts.length, 0);
  assert.ok(run.events.some((event) => event.type === 'cut.closed' && event.cutId === 1));
  assert.equal(
    run.events.some((event) => event.type === 'player.downed'),
    false,
  );
});

test('freeze blocks new enemy seeds while already-launched fronts continue at policy speed', () => {
  const run = running(
    level({
      enemies: [
        { id: 'first', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 },
        { id: 'second', type: 'drifter', x: 20.5, y: 7.5, vx: 0, vy: 0, radius: 0.2 },
      ],
    }),
  );
  arrangeCut(run, 0, vertical(20, 1, 10));
  seedTrailImpacts(
    run,
    { owner: 'first', source: 'enemy', player: 0, cellIndex: 4 * 72 + 20 },
    () => {},
  );
  run.bonuses.effects['enemy-freeze'] = { from: run.tick, until: run.tick + 60 };
  const before = run.impacts.map((impact) => impact.progress);
  stepCoop(run, neutral(), FIXED_DT);
  assert.equal(run.impacts.length, 2, 'second enemy cannot seed during freeze');
  assert.deepEqual(run.players[0].impactSources, ['enemy:first']);
  run.impacts.forEach((impact, index) => assert(impact.progress > before[index]));
});
