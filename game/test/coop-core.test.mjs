import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoop,
  startCoop,
  pauseCoop,
  resumeCoop,
  releaseCoopInputs,
  stepCoop,
  getCoopSummary,
  validateCoopLevel,
} from '../coop/core.mjs';

const DT = 1 / 120;
const FIELD = 0;
const SAFE = 1;
const command = (direction = null, extra = {}) => ({
  direction,
  boost: false,
  support: false,
  ...extra,
});
const pair = (first = null, second = null) => [command(first), command(second)];

function level(changes = {}) {
  return {
    version: 'revealline-coop-level.v1',
    id: 'coop-core-fixture',
    revision: 1,
    name: 'Independent cooperative core fixture',
    width: 72,
    height: 36,
    spawns: [
      { x: 20.5, y: 0.5 },
      { x: 20.5, y: 35.5 },
    ],
    safeRects: [],
    walls: [],
    enemies: [{ id: 'retention', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 }],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 10, boostMultiplier: 1.5 },
    ...changes,
  };
}

function running(changes = {}, options = {}) {
  const run = createCoop(level(changes), options);
  startCoop(run);
  return run;
}

const vertical = (x, first, last) =>
  Array.from({ length: Math.abs(last - first) + 1 }, (_, n) => ({
    x,
    y: first + n * Math.sign(last - first || 1),
  }));
const horizontal = (y, first, last) =>
  Array.from({ length: Math.abs(last - first) + 1 }, (_, n) => ({
    x: first + n * Math.sign(last - first || 1),
    y,
  }));

function arrange(run, seat, { x, y, trail = [], safeAnchor }) {
  const player = run.players[seat];
  Object.assign(player, {
    x,
    y,
    cellIndex: Math.floor(y) * run.width + Math.floor(x),
    direction: null,
    status: 'active',
    cutting: trail.length > 0,
    trail: trail.map((cell) => ({ ...cell, index: cell.y * run.width + cell.x })),
    safeAnchor: safeAnchor || { x, y },
    blockedDirection: null,
  });
  run.headsTouching = false;
  return player;
}

function ticks(run, inputs, count) {
  const events = [];
  for (let n = 0; n < count; n++) {
    const previousTick = run.tick;
    stepCoop(run, inputs, DT);
    if (run.tick !== previousTick) events.push(...structuredClone(run.events));
  }
  return events;
}

function rendezvousFixture(options = {}, swapped = false) {
  const run = running({}, options);
  arrange(run, swapped ? 1 : 0, {
    x: 20.5,
    y: 17.5,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 17),
  });
  arrange(run, swapped ? 0 : 1, {
    x: 20.5,
    y: 18.5,
    safeAnchor: { x: 20.5, y: 35.5 },
    trail: vertical(20, 34, 18),
  });
  return run;
}

function closingFixture(options = {}) {
  const run = running({}, options);
  arrange(run, 0, {
    x: 20.5,
    y: 34.95,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 34),
  });
  return run;
}

function state(run) {
  return structuredClone(run);
}

test('co-op validation accepts the independent arena and rejects invalid spawn geometry', () => {
  const source = level();
  assert.equal(validateCoopLevel(source).valid, true);
  for (const changes of [
    { version: 'xonix-level.v1' },
    { spawns: [{ x: 20.5, y: 0.5 }] },
    {
      spawns: [
        { x: 20.5, y: 10.5 },
        { x: 20.5, y: 35.5 },
      ],
    },
    {
      enemies: [{ id: 'bad', type: 'drifter', x: 60.5, y: 28.5, vx: Infinity, vy: 0, radius: 0.2 }],
    },
  ]) {
    assert.equal(validateCoopLevel(level(changes)).valid, false);
    assert.throws(() => createCoop(level(changes)));
  }
});

test('invalid second-seat input is rejected before either player or the clock changes', () => {
  const run = running();
  const before = state(run);
  for (const invalid of [
    [command('down')],
    [command('down'), ,],
    [command('down'), command('diagonal')],
    [command('down'), command(null, { boost: 1 })],
    [command('down'), command(null, { support: 'yes' })],
    [command('down'), command(null, { claimedCount: 999 })],
  ]) {
    assert.throws(() => stepCoop(run, invalid, DT));
    assert.deepEqual(run, before);
  }
  assert.throws(() => stepCoop(run, pair('down', 'up'), DT * 2));
  assert.deepEqual(run, before);
});

test('two active heads close one shared cut and claim each new field cell once', () => {
  const run = rendezvousFixture();
  const initialGrid = Array.from(run.cells);
  const events = ticks(run, pair('down', 'up'), 6);
  const claims = events.filter((event) => event.type === 'cells.claimed');
  const claimedIndices = claims.flatMap((event) => event.indices);
  assert.equal(events.filter((event) => event.type === 'cut.joint').length, 1);
  assert.equal(run.claimedCount, 20 * 34);
  assert.equal(claimedIndices.length, run.claimedCount);
  assert.equal(new Set(claimedIndices).size, claimedIndices.length);
  assert.equal(
    Array.from(run.cells).filter((cell, index) => cell === SAFE && initialGrid[index] === FIELD)
      .length,
    run.claimedCount,
  );
  assert.equal(run.cells[10 * run.width + 10], SAFE);
  assert.equal(run.cells[10 * run.width + 60], FIELD);
  assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
  assert.equal(ticks(run, pair(), 10).filter((event) => event.type === 'cut.joint').length, 0);
});

test('a joint cut gives neither seat topology or coverage priority', () => {
  const first = rendezvousFixture();
  const swapped = rendezvousFixture({}, true);
  ticks(first, pair('down', 'up'), 6);
  ticks(swapped, pair('up', 'down'), 6);
  assert.deepEqual(first.cells, swapped.cells);
  assert.equal(first.claimedCount, swapped.claimedCount);
  assert.equal(first.coverage, swapped.coverage);
  for (let seat = 0; seat < 2; seat++) {
    const a = first.players[seat];
    const b = swapped.players[1 - seat];
    assert.deepEqual(
      [a.x, a.y, a.status, a.cutting, a.trail, a.safeAnchor],
      [b.x, b.y, b.status, b.cutting, b.trail, b.safeAnchor],
    );
  }
});

test('crossing a teammate trail is harmless and does not impersonate a head rendezvous', () => {
  const run = running();
  arrange(run, 0, {
    x: 10.5,
    y: 10.5,
    safeAnchor: { x: 10.5, y: 0.5 },
    trail: vertical(10, 1, 10),
  });
  arrange(run, 1, {
    x: 9.5,
    y: 6.5,
    safeAnchor: { x: 9.5, y: 0.5 },
    trail: vertical(9, 1, 6),
  });
  const events = ticks(run, pair(null, 'right'), 24);
  assert.ok(run.players[1].x > 11);
  assert.ok(run.players.every((player) => player.status === 'active' && player.cutting));
  assert.equal(run.claimedCount, 0);
  assert.equal(
    events.some((event) => ['cut.joint', 'player.downed'].includes(event.type)),
    false,
  );
});

test('safe bodies can pass through each other without a collision or capture', () => {
  const run = running();
  arrange(run, 0, { x: 8.5, y: 0.5 });
  arrange(run, 1, { x: 9.5, y: 0.5 });
  const events = ticks(run, pair('right', 'left'), 12);
  assert.ok(run.players[0].x > run.players[1].x);
  assert.ok(run.players.every((player) => player.status === 'active'));
  assert.equal(run.claimedCount, 0);
  assert.equal(
    events.some((event) => ['cut.joint', 'player.downed'].includes(event.type)),
    false,
  );
});

test('the comparison prototype permits head crossings when joint cuts are disabled', () => {
  const run = rendezvousFixture({ jointCuts: false });
  const events = ticks(run, pair('down', 'up'), 12);
  assert.ok(run.players.every((player) => player.status === 'active' && player.cutting));
  assert.equal(run.claimedCount, 0);
  assert.equal(
    events.some((event) => event.type === 'cut.joint'),
    false,
  );
});

test('same-origin trails may form a legal joint loop despite their shared prefix', () => {
  const run = running();
  const safeAnchor = { x: 10.5, y: 0.5 };
  arrange(run, 0, {
    x: 19.5,
    y: 8.5,
    safeAnchor,
    trail: [...vertical(10, 1, 8), ...horizontal(8, 11, 19)],
  });
  arrange(run, 1, {
    x: 20.5,
    y: 8.5,
    safeAnchor,
    trail: [...vertical(10, 1, 3), ...horizontal(3, 11, 20), ...vertical(20, 4, 8)],
  });
  const events = ticks(run, pair('right', 'left'), 6);
  assert.equal(events.filter((event) => event.type === 'cut.joint').length, 1);
  assert.equal(run.cells[5 * run.width + 15], SAFE);
  assert.equal(run.claimedCount, 68);
  assert.ok(run.players.every((player) => player.status === 'active'));
});

test('diagonal head contact at a shared-origin loop corner is symmetric and stops both banked players', () => {
  const runs = [running(), running()];
  for (const run of runs) {
    arrange(run, 0, {
      x: 19.9,
      y: 8.1,
      safeAnchor: { x: 10.5, y: 0.5 },
      trail: [...vertical(10, 1, 8), ...horizontal(8, 11, 19)],
    });
    arrange(run, 1, {
      x: 20.1,
      y: 7.9,
      safeAnchor: { x: 10.5, y: 0.5 },
      trail: [...vertical(10, 1, 3), ...horizontal(3, 11, 20), ...vertical(20, 4, 7)],
    });
  }
  const [firstSeat, secondSeat] = runs[1].players;
  runs[1].players = [
    { ...secondSeat, id: 0 },
    { ...firstSeat, id: 1 },
  ];
  const initialPositions = runs[0].players.map(({ x, y }) => ({ x, y }));
  const events = ticks(runs[0], pair('right', 'down'), 10);
  ticks(runs[1], pair('down', 'right'), 10);
  assert.equal(events.filter((event) => event.type === 'cut.joint').length, 1);
  assert.equal(events.filter((event) => event.type === 'cut.closed').length, 2);
  assert.equal(runs[0].claimedCount, 67);
  assert.equal(runs[1].claimedCount, 67);
  assert.deepEqual(runs[0].cells, runs[1].cells);
  assert.deepEqual(
    runs[0].players.map(({ x, y }) => ({ x, y })),
    initialPositions,
  );
  assert.ok(runs[0].players.every((player) => !player.cutting && player.status === 'active'));
});

test('capturing through an ally trail banks its safe prefix and retains its exposed suffix', () => {
  const run = closingFixture();
  arrange(run, 1, {
    x: 30.5,
    y: 12.5,
    safeAnchor: { x: 10.5, y: 0.5 },
    trail: [...vertical(10, 1, 12), ...horizontal(12, 11, 30)],
  });
  ticks(run, pair('down'), 2);
  const ally = run.players[1];
  assert.equal(run.claimedCount, 20 * 34);
  assert.equal(ally.status, 'active');
  assert.equal(ally.cutting, true);
  assert.deepEqual(
    ally.trail.map(({ x, y }) => ({ x, y })),
    horizontal(12, 21, 30),
  );
  assert.deepEqual(ally.safeAnchor, { x: 20.5, y: 12.5 });
  assert.ok(ally.trail.every(({ index }) => run.cells[index] === FIELD));
  const prior = run.claimedCount;
  ticks(run, pair(), 12);
  assert.equal(run.claimedCount, prior);
});

test('an ally inside captured territory is made safe rather than retaining the whole region', () => {
  const run = closingFixture();
  arrange(run, 1, {
    x: 10.5,
    y: 12.5,
    safeAnchor: { x: 10.5, y: 0.5 },
    trail: vertical(10, 1, 12),
  });
  ticks(run, pair('down'), 2);
  assert.equal(run.claimedCount, 20 * 34);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.players[1].cutting, false);
  assert.deepEqual(run.players[1].trail, []);
  assert.equal(run.cells[12 * run.width + 10], SAFE);
});

test('assisted prefix banking adds its enclosed area once while the comparison retains that field', () => {
  const results = [];
  for (const assistCaptures of [true, false]) {
    const run = closingFixture({ assistCaptures });
    arrange(run, 1, {
      x: 30.5,
      y: 10.5,
      safeAnchor: { x: 30.5, y: 0.5 },
      trail: [
        ...vertical(30, 1, 5),
        ...horizontal(5, 29, 10),
        ...vertical(10, 6, 10),
        ...horizontal(10, 11, 30),
      ],
    });
    const initialCells = Array.from(run.cells);
    const events = ticks(run, pair('down'), 2);
    const claimed = events
      .filter((event) => event.type === 'cells.claimed')
      .flatMap((event) => event.indices);
    assert.equal(claimed.length, run.claimedCount);
    assert.equal(new Set(claimed).size, run.claimedCount);
    assert.equal(
      Array.from(run.cells).filter((cell, index) => cell === SAFE && initialCells[index] === FIELD)
        .length,
      run.claimedCount,
    );
    assert.deepEqual(
      run.players[1].trail.map(({ x, y }) => ({ x, y })),
      horizontal(10, 21, 30),
    );
    assert.deepEqual(run.players[1].safeAnchor, { x: 20.5, y: 10.5 });
    const claimedCount = run.claimedCount;
    ticks(run, pair(), 5);
    assert.equal(run.claimedCount, claimedCount);
    results.push(run);
  }
  assert.deepEqual(
    results.map((run) => run.claimedCount),
    [730, 680],
  );
  assert.equal(results[0].cells[3 * results[0].width + 25], SAFE);
  assert.equal(results[1].cells[3 * results[1].width + 25], FIELD);
});

test('a swept enemy hit earlier in the tick defeats a later return-to-safety closure', () => {
  const run = closingFixture();
  run.enemies.push({
    id: 'earlier-hit',
    type: 'drifter',
    x: 21.26,
    y: 30.5,
    vx: -20,
    vy: 0,
    radius: 0.2,
  });
  const events = ticks(run, pair('down'), 1);
  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.claimedCount, 0);
  assert.equal(
    events.some((event) => event.type === 'cells.claimed'),
    false,
  );
  assert.equal(
    events.filter((event) => event.type === 'player.downed' && event.player === 0).length,
    1,
  );
});

test('an earlier enemy hit cancels the head rendezvous for either seat without banking the survivor trail', () => {
  for (const swapped of [false, true]) {
    const run = rendezvousFixture({}, swapped);
    run.enemies.push({
      id: 'joint-interrupt',
      type: 'drifter',
      x: 21.26,
      y: 10.5,
      vx: -20,
      vy: 0,
      radius: 0.2,
    });
    const events = ticks(run, swapped ? pair('up', 'down') : pair('down', 'up'), 6);
    assert.equal(run.players[swapped ? 1 : 0].status, 'downed');
    assert.equal(run.players[swapped ? 0 : 1].status, 'active');
    assert.equal(run.players[swapped ? 0 : 1].cutting, true);
    assert.equal(
      events.some((event) => event.type === 'cut.joint'),
      false,
    );
    assert.equal(run.claimedCount, 0);
  }
});

test('a return that beats enemy contact secures the trail and reflects the later enemy', () => {
  const run = closingFixture();
  const enemy = {
    id: 'later-hit',
    type: 'drifter',
    x: 21.36,
    y: 30.5,
    vx: -20,
    vy: 0,
    radius: 0.2,
  };
  run.enemies.push(enemy);
  const events = ticks(run, pair('down'), 3);
  assert.equal(run.players[0].status, 'active');
  assert.equal(run.claimedCount, 20 * 34);
  assert.equal(
    events.some((event) => event.type === 'player.downed'),
    false,
  );
  assert.ok(enemy.vx > 0);
});

test('simultaneous ordinary returns bank one union without duplicate area or seat priority', () => {
  const runs = [closingFixture(), closingFixture()];
  for (const run of runs)
    arrange(run, 1, {
      x: 40.5,
      y: 34.95,
      safeAnchor: { x: 40.5, y: 0.5 },
      trail: vertical(40, 1, 34),
    });
  const firstSeat = runs[1].players[0];
  const secondSeat = runs[1].players[1];
  runs[1].players = [
    { ...secondSeat, id: 0 },
    { ...firstSeat, id: 1 },
  ];
  const events = ticks(runs[0], pair('down', 'down'), 2);
  ticks(runs[1], pair('down', 'down'), 2);
  assert.equal(runs[0].claimedCount, 40 * 34);
  assert.equal(events.filter((event) => event.type === 'cells.claimed').length, 1);
  assert.equal(events.filter((event) => event.type === 'cut.closed').length, 2);
  assert.deepEqual(runs[0].cells, runs[1].cells);
  assert.equal(runs[0].claimedCount, runs[1].claimedCount);
});

test('pause freezes simulation and resume cannot replay a held pre-pause movement', () => {
  const run = running();
  ticks(run, pair('down', 'up'), 10);
  pauseCoop(run);
  const before = state(run);
  stepCoop(run, pair('down', 'up'), DT);
  assert.deepEqual(run, before);
  resumeCoop(run);
  releaseCoopInputs(run);
  const positions = run.players.map(({ x, y }) => ({ x, y }));
  ticks(run, pair(), 1);
  assert.deepEqual(
    run.players.map(({ x, y }) => ({ x, y })),
    positions,
  );
});

test('the same seed and command log reproduce complete state regardless of render reads', () => {
  const changes = {
    enemies: [{ id: 'moving', type: 'drifter', x: 60.5, y: 28.5, vx: 2, vy: -3, radius: 0.2 }],
  };
  const plain = running(changes, { seed: 7351 });
  const rendered = running(changes, { seed: 7351 });
  for (let tick = 0; tick < 400; tick++) {
    const inputs = tick < 120 ? pair('down', 'up') : tick < 240 ? pair('right', 'left') : pair();
    stepCoop(plain, inputs, DT);
    for (let read = 0; read < tick % 5; read++) getCoopSummary(rendered);
    stepCoop(rendered, inputs, DT);
    if (tick % 3 === 0) getCoopSummary(rendered);
  }
  assert.deepEqual(rendered, plain);
});

test('a full joint clear is achievable through public commands and freezes after team victory', () => {
  const run = running({ goal: { coverage: 0.25 } });
  const events = ticks(run, pair('down', 'up'), 300);
  assert.equal(run.status, 'won');
  assert.equal(events.filter((event) => event.type === 'cut.joint').length, 1);
  assert.equal(run.claimedCount, 20 * 34);
  assert.ok(run.players.every((player) => player.status === 'active'));
  const before = state(run);
  stepCoop(run, pair('down', 'up'), DT);
  assert.deepEqual(run, before);
});

function knockdownFixture(both = true) {
  const run = rendezvousFixture();
  run.enemies.push({
    id: 'upper-hit',
    type: 'drifter',
    x: 20.5,
    y: 10.5,
    vx: 0,
    vy: 0,
    radius: 0.2,
  });
  if (both)
    run.enemies.push({
      id: 'lower-hit',
      type: 'drifter',
      x: 20.5,
      y: 25.5,
      vx: 0,
      vy: 0,
      radius: 0.2,
    });
  return run;
}

test('both-down recovery spends one team reserve and held inputs cannot immediately relaunch either player', () => {
  const run = knockdownFixture();
  const reserves = run.team.reserves;
  const first = ticks(run, pair('down', 'up'), 1);
  assert.ok(run.players.every((player) => player.status === 'downed'));
  assert.equal(first.filter((event) => event.type === 'player.downed').length, 2);
  assert.equal(run.team.reserves, reserves - 1);
  const events = ticks(run, pair('down', 'up'), 100);
  assert.equal(run.status, 'running');
  assert.equal(run.team.reserves, reserves - 1);
  assert.equal(events.filter((event) => event.type === 'player.revived').length, 2);
  assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
  assert.deepEqual(
    run.players.map(({ x, y }) => ({ x, y })),
    level().spawns,
  );
});

test('both down with no reserve resolves defeat once and never advances afterward', () => {
  const run = knockdownFixture();
  run.team.reserves = 0;
  const events = ticks(run, pair('down', 'up'), 1);
  assert.equal(run.status, 'lost');
  assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
  const before = state(run);
  stepCoop(run, pair(), DT);
  assert.deepEqual(run, before);
  assert.equal(run.team.reserves, 0);
});

test('one down with no reserve leaves the survivor active instead of ending or resetting the team', () => {
  const run = knockdownFixture(false);
  run.team.reserves = 0;
  ticks(run, pair(), 100);
  assert.equal(run.status, 'running');
  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 0);
  assert.equal(run.players[1].y, 18.5);
  assert.equal(run.claimedCount, 0);
});
