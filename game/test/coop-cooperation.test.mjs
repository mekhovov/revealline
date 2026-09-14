import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoop,
  startCoop,
  pauseCoop,
  resumeCoop,
  stepCoop,
  FIXED_DT,
  FIELD,
  SAFE,
} from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';

const command = (direction = null, support = false, extra = {}) => ({
  direction,
  boost: false,
  support,
  ...extra,
});
const neutral = () => [command(), command()];
const support = (seat = 0) => [command(null, seat === 0), command(null, seat === 1)];
const near = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, message || `${actual} should equal ${expected}`);

function level(changes = {}) {
  return {
    version: 'revealline-coop-level.v1',
    id: 'cooperation-contract',
    revision: 1,
    name: 'Cooperation contract fixture',
    width: 72,
    height: 36,
    spawns: [
      { x: 20.5, y: 0.5 },
      { x: 21.5, y: 0.5 },
    ],
    walls: [],
    safeRects: [],
    enemies: [{ id: 'retention', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 }],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 10, boostMultiplier: 1.5 },
    ...changes,
  };
}

function smallLevel(changes = {}) {
  return level({
    safeRects: [
      { x: 11, y: 1, w: 60, h: 34 },
      { x: 1, y: 11, w: 10, h: 24 },
    ],
    enemies: [{ id: 'retention', type: 'drifter', x: 9.5, y: 8.5, vx: 0, vy: 0, radius: 0.2 }],
    ...changes,
  });
}

function running(source = level(), options = {}) {
  const run = createCoop(source, options);
  startCoop(run);
  return run;
}

function ticks(run, inputs = neutral(), count = 1) {
  const events = [];
  for (let n = 0; n < count; n++) {
    const before = run.tick;
    stepCoop(run, inputs, FIXED_DT);
    if (run.tick !== before) events.push(...structuredClone(run.events));
  }
  return events;
}

function vertical(x, first, last) {
  return Array.from({ length: Math.abs(last - first) + 1 }, (_, index) => ({
    x,
    y: first + index * Math.sign(last - first || 1),
  }));
}
function horizontal(y, first, last) {
  return Array.from({ length: Math.abs(last - first) + 1 }, (_, index) => ({
    x: first + index * Math.sign(last - first || 1),
    y,
  }));
}

function arrange(run, seat, { x, y, trail = [], safeAnchor = { x, y } }) {
  Object.assign(run.players[seat], {
    x,
    y,
    cellIndex: Math.floor(y) * run.width + Math.floor(x),
    safeAnchor,
    trail: trail.map((cell) => ({ ...cell, index: cell.y * run.width + cell.x })),
    cutting: trail.length > 0,
    direction: null,
    blockedDirection: null,
    departureIndex: Math.floor(safeAnchor.y) * run.width + Math.floor(safeAnchor.x),
  });
  run.headsTouching = false;
}

function bankCell(run, column, seat = 0) {
  arrange(run, seat, {
    x: column + 0.5,
    y: 1.05,
    safeAnchor: { x: column + 0.5, y: 0.5 },
    trail: [{ x: column, y: 1 }],
  });
  const inputs = neutral();
  inputs[seat] = command('up');
  return ticks(run, inputs);
}

function downPartner(run, { small = false } = {}) {
  const x = small ? 9 : 21;
  const safeAnchor = small ? { x: 9.5, y: 11.5 } : { x: 21.5, y: 0.5 };
  arrange(run, 1, {
    x: x + 0.5,
    y: 8.5,
    safeAnchor,
    trail: vertical(x, small ? 10 : 1, 8),
  });
  if (!small)
    run.enemies.push({
      id: 'downing-contact',
      type: 'drifter',
      x: 21.5,
      y: 5.5,
      vx: 0,
      vy: 0,
      radius: 0.2,
    });
  ticks(run);
  assert.equal(run.players[1].status, 'downed');
}

function stronghold(
  id = 'relay',
  core = { x: 8.5, y: 8.5 },
  anchors = [
    { x: 1.5, y: 1.5 },
    { x: 2.5, y: 1.5 },
  ],
) {
  return { id, core, anchors };
}

test('two-percent recharge counts cumulative unique territory at the exact boundary', () => {
  const run = running(smallLevel());
  assert.equal(run.totalClaimable, 100);
  ticks(run, [command(null, true), command(null, true)]);
  const readyAt = run.players.map((player) => player.support.readyAt);
  bankCell(run, 1);
  assert.equal(run.claimedCount, 1);
  assert.deepEqual(
    run.players.map((player) => player.support.readyAt),
    readyAt,
  );
  bankCell(run, 2);
  assert.equal(run.claimedCount, 2);
  run.players.forEach((player, seat) => near(player.support.readyAt, readyAt[seat] - 2));
  const after = run.players.map((player) => player.support.readyAt);
  ticks(run, [command('down'), command()], 4);
  ticks(run, [command('up'), command()], 4);
  assert.equal(run.claimedCount, 2);
  assert.deepEqual(
    run.players.map((player) => player.support.readyAt),
    after,
  );
});

test('ordinary-cover comparison preserves time-based recharge without territory acceleration', () => {
  const run = running(smallLevel(), { advancedCooperation: false });
  ticks(run, [command(null, true), command(null, true)]);
  const readyAt = run.players.map((player) => player.support.readyAt);
  bankCell(run, 1);
  bankCell(run, 2);
  assert.equal(run.claimedCount, 2);
  assert.deepEqual(
    run.players.map((player) => player.support.readyAt),
    readyAt,
  );
});

test('a large capture refills at most one Support charge and cannot store excess credits', () => {
  const run = running(smallLevel());
  ticks(run, support());
  arrange(run, 0, { x: 3.5, y: 1.05, safeAnchor: { x: 3.5, y: 11.5 }, trail: vertical(3, 10, 1) });
  ticks(run, [command('up'), command()]);
  assert.equal(run.claimedCount, 30);
  assert.ok(run.players[0].support.readyAt <= run.time);
  const pulse = ticks(run, support());
  assert.equal(pulse.filter((event) => event.type === 'support.pulse').length, 1);
  near(run.players[0].support.readyAt - (run.time - FIXED_DT), 8);
  ticks(run);
  const extra = ticks(run, support());
  assert.equal(extra.filter((event) => event.type === 'support.pulse').length, 0);
  assert.equal(run.players[0].support.uses, 2);
});

test('holding Support never stores or spends extra charges after its eight-second refill', () => {
  const run = running();
  const events = ticks(run, support(), 9 * 120);
  assert.equal(events.filter((event) => event.type === 'support.pulse').length, 1);
  assert.ok(run.players[0].support.readyAt <= run.time);
  ticks(run);
  const second = ticks(run, support());
  assert.equal(second.filter((event) => event.type === 'support.pulse').length, 1);
  near(run.players[0].support.readyAt - (run.time - FIXED_DT), 8);
});

test('overlapping Support pulses neither multiply slow nor extend its original deadline', () => {
  const run = running(
    level({
      enemies: [{ id: 'nearby', type: 'drifter', x: 20.5, y: 3.5, vx: 2, vy: 0, radius: 0.2 }],
    }),
  );
  const enemy = run.enemies[0];
  const firstX = enemy.x;
  ticks(run, support());
  near(enemy.x - firstX, FIXED_DT);
  assert.equal(enemy.speedScale, 0.5);
  const until = enemy.slowUntil;
  ticks(run, neutral(), 89);
  const beforeSecond = enemy.x;
  ticks(run, support(1));
  near(enemy.x - beforeSecond, FIXED_DT);
  assert.equal(enemy.speedScale, 0.5);
  near(enemy.slowUntil, until);
  ticks(run, neutral(), 91);
  assert.equal(enemy.speedScale, 1);
  const before = enemy.x;
  ticks(run);
  near(enemy.x - before, 2 * FIXED_DT);
});

test('Support credits actual slowing rather than stationary enemies that only receive a slow marker', () => {
  const run = running(
    level({
      enemies: [
        { id: 'still', type: 'drifter', x: 20.5, y: 3.5, vx: 0, vy: 0, radius: 0.2 },
        { id: 'warning', type: 'hunter', x: 22.5, y: 3.5, vx: 0, vy: 0, radius: 0.2 },
        { id: 'moving', type: 'drifter', x: 24.5, y: 3.5, vx: 2, vy: 0, radius: 0.2 },
      ],
    }),
  );
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  Object.assign(hunter, { phase: 'warning', phaseUntil: run.time + 1 });
  const events = ticks(run, support());
  const pulse = events.find((event) => event.type === 'support.pulse');
  assert.deepEqual(pulse.slowedEnemies, ['moving']);
  assert.equal(run.players[0].support.slows, 1);
  assert.ok(run.enemies.every((enemy) => enemy.slowUntil > run.time));
});

test('pause freezes Support cooldown, slow duration, and rescue progress', () => {
  const run = running();
  downPartner(run);
  ticks(run, support(), 30);
  pauseCoop(run);
  const before = structuredClone(run);
  ticks(run, support(), 240);
  assert.deepEqual(run, before);
  resumeCoop(run);
  ticks(run);
  assert.equal(run.players[1].status, 'downed');
});

test('one-second safe Support rescue takes precedence over a ready pulse and preserves both charges', () => {
  const run = running();
  downPartner(run);
  run.players[1].support.readyAt = 20;
  const readyAt = run.players.map((player) => player.support.readyAt);
  const first = ticks(run, support(), 119);
  assert.equal(run.players[1].status, 'downed');
  const last = ticks(run, support(), 2);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 3);
  assert.deepEqual(
    run.players.map((player) => player.support.readyAt),
    readyAt,
  );
  assert.equal([...first, ...last].filter((event) => event.type === 'support.pulse').length, 0);
  assert.equal([...first, ...last].filter((event) => event.type === 'player.revived').length, 1);
  ticks(run, support(), 20);
  assert.deepEqual(
    run.players.map((player) => player.support.readyAt),
    readyAt,
  );
});

test('moving away cancels a partial rescue instead of saving its previous progress', () => {
  const run = running();
  downPartner(run);
  ticks(run, support(), 60);
  ticks(run, [command('left'), command()]);
  assert.equal(run.players[1].status, 'downed');
  ticks(run, support(), 61);
  assert.equal(run.players[1].status, 'downed');
  ticks(run, support(), 60);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 3);
});

test('a fresh same-direction steering gesture cancels a held rescue channel', () => {
  const run = running();
  downPartner(run);
  ticks(run, [command('left', true), command()], 60);
  ticks(run, [command('left', true, { steer: true }), command()]);
  assert.equal(run.players[0].rescue, null);
  assert.equal(run.players[1].status, 'downed');
});

test('capture rescue counts two percent since this knockdown, rather than old team progress', () => {
  const run = running(smallLevel());
  bankCell(run, 1);
  downPartner(run, { small: true });
  ticks(run, [command(), command('right')], 20);
  run.players[0].support.readyAt = 60;
  run.players[1].support.readyAt = 100;
  bankCell(run, 2);
  assert.equal(run.claimedCount, 2);
  assert.equal(run.players[1].status, 'downed');
  const rescuePosition = { x: run.players[1].x, y: run.players[1].y };
  bankCell(run, 3);
  assert.equal(run.claimedCount, 3);
  assert.equal(run.players[1].status, 'active');
  assert.deepEqual({ x: run.players[1].x, y: run.players[1].y }, rescuePosition);
  assert.equal(run.team.reserves, 3);
  near(run.players[0].support.readyAt, 58);
  near(run.players[1].support.readyAt, 98);
});

test('downed players crawl only on safe ground and rescue at their current crawl location', () => {
  const run = running();
  downPartner(run);
  const startX = run.players[1].x;
  ticks(run, [command(), command('right')], 60);
  near(run.players[1].x - startX, 1.5);
  ticks(run, [command(), command('down')], 60);
  assert.equal(run.players[1].status, 'downed');
  assert.equal(run.cells[run.players[1].cellIndex], SAFE);
  assert.equal(run.players[1].cutting, false);
  assert.deepEqual(run.players[1].trail, []);
  const position = { x: run.players[1].x, y: run.players[1].y };
  arrange(run, 0, { x: position.x + 0.5, y: 0.5 });
  ticks(run, support(), 121);
  assert.equal(run.players[1].status, 'active');
  assert.deepEqual({ x: run.players[1].x, y: run.players[1].y }, position);
});

test('recovery grace ends when the revived player deliberately begins a new exposed cut', () => {
  const run = running();
  downPartner(run);
  ticks(run, support(), 121);
  assert.ok(run.players[1].graceUntil > run.time);
  ticks(run, [command(), command('down')], 10);
  assert.equal(run.players[1].cutting, true);
  assert.ok(run.players[1].graceUntil <= run.time);
});

for (const required of [true, false])
  test(`a captured ${required ? 'required' : 'optional'} anchor ${required ? 'does' : 'does not'} grant a below-threshold rescue`, () => {
    const run = running(
      smallLevel({
        strongholds: [stronghold()],
        goal: required ? { cores: ['relay'] } : { coverage: 0.99 },
      }),
    );
    downPartner(run, { small: true });
    bankCell(run, 1);
    assert.equal(run.claimedCount, 1);
    assert.equal(run.players[1].status, required ? 'active' : 'downed');
    assert.equal(run.team.reserves, 3);
  });

test('ordinary-cover comparison retains held rescue but disables capture-based free revival', () => {
  const run = running(smallLevel(), { advancedCooperation: false });
  downPartner(run, { small: true });
  bankCell(run, 1);
  bankCell(run, 2);
  assert.equal(run.players[1].status, 'downed');
  arrange(run, 0, { x: 10.5, y: 11.5 });
  ticks(run, support(), 121);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 3);
});

test('a single timeout spends one reserve and preserves the survivor and both ability states', () => {
  const run = running();
  downPartner(run);
  arrange(run, 0, {
    x: 40.5,
    y: 18.5,
    safeAnchor: { x: 40.5, y: 35.5 },
    trail: vertical(40, 34, 18),
  });
  run.players[0].support.readyAt = 50;
  run.players[1].support.readyAt = 70;
  const survivor = structuredClone(run.players[0]);
  const remaining = Math.round((run.players[1].downedUntil - run.time) / FIXED_DT);
  ticks(run, neutral(), remaining - 1);
  assert.equal(run.players[1].status, 'downed');
  assert.equal(run.team.reserves, 3);
  ticks(run);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 2);
  assert.deepEqual(run.players[0], survivor);
  assert.equal(run.players[1].support.readyAt, 70);
});

test('zero reserves preserve the free-rescue opportunity after the timeout expires', () => {
  const run = running();
  run.team.reserves = 0;
  downPartner(run);
  ticks(run, neutral(), 13 * 120);
  assert.equal(run.status, 'running');
  assert.equal(run.players[1].status, 'downed');
  ticks(run, support(), 121);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 0);
});

test('both-down redeployment costs one reserve, uses authored spawns, and preserves ability cooldowns', () => {
  const run = running();
  run.players[0].support.readyAt = 50;
  run.players[1].support.readyAt = 70;
  for (const [seat, x] of [
    [0, 30],
    [1, 40],
  ]) {
    arrange(run, seat, {
      x: x + 0.5,
      y: 10.5,
      safeAnchor: { x: x + 0.5, y: 0.5 },
      trail: vertical(x, 1, 10),
    });
    run.enemies.push({
      id: `contact-${seat}`,
      type: 'drifter',
      x: x + 0.5,
      y: 5.5,
      vx: 0,
      vy: 0,
      radius: 0.2,
    });
  }
  const events = ticks(run);
  assert.equal(run.team.reserves, 2);
  assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
  assert.deepEqual(
    run.players.map(({ x, y }) => ({ x, y })),
    run.level.spawns,
  );
  assert.deepEqual(
    run.players.map((player) => player.support.readyAt),
    [50, 70],
  );
  assert.equal(events.filter((event) => event.type === 'player.revived').length, 2);
});

test('a winning capture on the timeout instant restores the partner before any reserve is spent', () => {
  const run = running(smallLevel({ goal: { coverage: 0.01 } }));
  downPartner(run, { small: true });
  const remaining = Math.round((run.players[1].downedUntil - run.time) / FIXED_DT);
  ticks(run, neutral(), remaining - 1);
  arrange(run, 0, {
    x: 1.5,
    y: 1 + run.rules.moveSpeed * FIXED_DT,
    safeAnchor: { x: 1.5, y: 0.5 },
    trail: [{ x: 1, y: 1 }],
  });
  const events = ticks(run, [command('up'), command()]);
  assert.equal(run.status, 'won');
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 3);
  assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
});

test('a completed contact rescue at the timeout instant wins over the paid reserve fallback', () => {
  const run = running();
  downPartner(run);
  const beforeChannel = Math.round((run.players[1].downedUntil - 1 - run.time) / FIXED_DT);
  ticks(run, neutral(), beforeChannel);
  const events = ticks(run, support(), 120);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 3);
  assert.equal(
    events.filter((event) => event.type === 'player.revived' && event.reason === 'contact').length,
    1,
  );
});

test('a qualifying non-winning capture at the timeout instant revives freely before reserve fallback', () => {
  const run = running(smallLevel());
  downPartner(run, { small: true });
  bankCell(run, 1);
  const remaining = Math.round((run.players[1].downedUntil - run.time) / FIXED_DT);
  ticks(run, neutral(), remaining - 1);
  arrange(run, 0, {
    x: 2.5,
    y: 1 + run.rules.moveSpeed * FIXED_DT,
    safeAnchor: { x: 2.5, y: 0.5 },
    trail: [{ x: 2, y: 1 }],
  });
  const events = ticks(run, [command('up'), command()]);
  assert.equal(run.status, 'running');
  assert.equal(run.claimedCount, 2);
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.team.reserves, 3);
  assert.equal(
    events.filter((event) => event.type === 'player.revived' && event.reason === 'capture').length,
    1,
  );
});

test('meaningful cooperation credit never gates a legal small head rendezvous', () => {
  const run = running(smallLevel());
  arrange(run, 0, { x: 1.8, y: 1.5, safeAnchor: { x: 1.5, y: 0.5 }, trail: [{ x: 1, y: 1 }] });
  arrange(run, 1, { x: 2.2, y: 1.5, safeAnchor: { x: 2.5, y: 0.5 }, trail: [{ x: 2, y: 1 }] });
  const events = ticks(run, [command('right'), command('left')]);
  assert.equal(run.claimedCount, 2);
  const joint = events.find((event) => event.type === 'cut.joint');
  assert.ok(joint);
  assert.equal(joint.meaningful, false);
  assert.equal(run.team.jointCuts, 0);
  assert.ok(run.players.every((player) => player.status === 'active' && !player.cutting));
});

test('capturing both anchors unlocks the core only after the complete transaction', () => {
  const run = running(
    smallLevel({ enemies: [], strongholds: [stronghold()], goal: { cores: ['relay'] } }),
  );
  for (const [seat, column] of [
    [0, 1],
    [1, 2],
  ])
    arrange(run, seat, {
      x: column + 0.5,
      y: 1.05,
      safeAnchor: { x: column + 0.5, y: 0.5 },
      trail: [{ x: column, y: 1 }],
    });
  ticks(run, [command('up'), command('up')]);
  const hold = run.strongholds[0];
  assert.ok(hold.anchors.every((anchor) => anchor.captured));
  assert.equal(hold.shielded, false);
  assert.equal(hold.defeated, false);
  assert.equal(run.claimedCount, 2);
  assert.equal(run.cells[8 * run.width + 8], FIELD);
  ticks(run, neutral(), 5);
  assert.equal(hold.defeated, false);
  assert.equal(run.cells[8 * run.width + 8], FIELD);
  bankCell(run, 3);
  assert.equal(run.cells[8 * run.width + 8], SAFE);
  assert.equal(hold.defeated, true);
  assert.equal(run.status, 'won');
});

test('an assisting prefix can capture the second anchor without retroactively filling the shielded core', () => {
  const run = running(
    level({
      strongholds: [
        stronghold('relay', { x: 28.5, y: 3.5 }, [
          { x: 10.5, y: 5.5 },
          { x: 30.5, y: 4.5 },
        ]),
      ],
      goal: { cores: ['relay'] },
    }),
  );
  arrange(run, 0, {
    x: 20.5,
    y: 34.95,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 34),
  });
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
  const first = ticks(run, [command('down'), command()]);
  assert.equal(run.claimedCount, 694);
  assert.ok(run.strongholds[0].anchors.every((anchor) => anchor.captured));
  assert.equal(run.strongholds[0].shielded, false);
  assert.equal(run.strongholds[0].defeated, false);
  assert.equal(run.cells[3 * run.width + 28], FIELD);
  assert.equal(
    first.some((event) => event.type === 'core.defeated'),
    false,
  );
  const later = ticks(run, [command(), command('up')], 70);
  assert.equal(run.cells[3 * run.width + 28], SAFE);
  assert.equal(run.strongholds[0].defeated, true);
  assert.equal(later.filter((event) => event.type === 'core.defeated').length, 1);
  assert.equal(run.status, 'won');
});

function impact(run, id, owner, player, x, y) {
  return { id, owner, player, cellIndex: y * run.width + x, x: x + 0.5, y: y + 0.5, progress: 0 };
}

test('Support intercepts only travelling impacts in range and records actual protection once', () => {
  const run = running();
  arrange(run, 1, {
    x: 20.5,
    y: 10.5,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 10),
  });
  run.impacts = [impact(run, 'near', 'relay', 1, 20, 3), impact(run, 'far', 'relay', 1, 20, 8)];
  const events = ticks(run, support());
  assert.deepEqual(
    run.impacts.map((entry) => entry.id),
    ['far'],
  );
  assert.equal(run.players[0].support.intercepts, 1);
  assert.equal(run.team.interceptions, 1);
  assert.equal(events.filter((event) => event.type === 'impact.intercepted').length, 1);
  ticks(run, support());
  assert.equal(run.players[0].support.intercepts, 1);
});

test('capture discards an impact on a banked prefix and preserves one on the remaining suffix', () => {
  const run = running();
  arrange(run, 0, {
    x: 20.5,
    y: 34.95,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 34),
  });
  arrange(run, 1, {
    x: 30.5,
    y: 12.5,
    safeAnchor: { x: 10.5, y: 0.5 },
    trail: [...vertical(10, 1, 12), ...horizontal(12, 11, 30)],
  });
  run.impacts = [
    impact(run, 'prefix', 'relay', 1, 10, 5),
    impact(run, 'suffix', 'relay', 1, 25, 12),
  ];
  ticks(run, [command('down'), command()]);
  assert.deepEqual(
    run.impacts.map((entry) => entry.id),
    ['suffix'],
  );
  assert.ok(run.players[1].trail.some((cell) => cell.index === run.impacts[0].cellIndex));
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.players[1].cutting, true);
});

test('an impact launched onto a head at the rendezvous instant is resolved before the joint bank', () => {
  const run = running(
    level({
      strongholds: [
        stronghold('relay', { x: 55.5, y: 30.5 }, [
          { x: 50.5, y: 1.5 },
          { x: 51.5, y: 1.5 },
        ]),
      ],
    }),
  );
  arrange(run, 0, {
    x: 20.5,
    y: 17.4,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 17),
  });
  arrange(run, 1, {
    x: 20.5,
    y: 17.86,
    safeAnchor: { x: 20.5, y: 35.5 },
    trail: vertical(20, 34, 17),
  });
  Object.assign(run.strongholds[0].emitter, {
    phase: 'warning',
    phaseUntil: 0.005,
    target: 0,
    cellIndex: 17 * run.width + 20,
    targetPoint: { x: 20.5, y: 17.5 },
  });
  const events = ticks(run, [command('down'), command('up')]);
  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.claimedCount, 0);
  assert.ok(events.some((event) => event.type === 'impact.launched'));
  assert.equal(
    events.some((event) => event.type === 'cut.joint'),
    false,
  );
});

test('shield break leaves its emitter active until the exposed core is actually captured', () => {
  const run = running(smallLevel({ strongholds: [stronghold()], goal: { cores: ['relay'] } }));
  bankCell(run, 1);
  bankCell(run, 2);
  assert.equal(run.strongholds[0].shielded, false);
  assert.notEqual(run.strongholds[0].emitter.phase, 'disabled');
  arrange(run, 0, { x: 8.5, y: 5.5, safeAnchor: { x: 8.5, y: 0.5 }, trail: vertical(8, 1, 5) });
  const events = ticks(run, neutral(), 2 * 120);
  assert.ok(events.some((event) => event.type === 'impact.launched' && event.owner === 'relay'));
  assert.equal(run.strongholds[0].defeated, false);
});

test('defeating one core removes only its emitter and owned travelling impacts', () => {
  const run = running(
    level({
      enemies: [],
      strongholds: [
        stronghold('left'),
        stronghold('right', { x: 60.5, y: 28.5 }, [
          { x: 62.5, y: 1.5 },
          { x: 65.5, y: 1.5 },
        ]),
      ],
      goal: { cores: ['left', 'right'] },
    }),
  );
  bankCell(run, 1);
  bankCell(run, 2);
  arrange(run, 0, {
    x: 20.5,
    y: 34.95,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 34),
  });
  arrange(run, 1, {
    x: 40.5,
    y: 18.5,
    safeAnchor: { x: 40.5, y: 35.5 },
    trail: vertical(40, 34, 18),
  });
  run.impacts = [
    impact(run, 'left-impact', 'left', 1, 40, 25),
    impact(run, 'right-impact', 'right', 1, 40, 25),
  ];
  ticks(run, [command('down'), command()]);
  const [left, right] = run.strongholds;
  assert.equal(left.defeated, true);
  assert.equal(left.emitter.phase, 'disabled');
  assert.equal(right.defeated, false);
  assert.notEqual(right.emitter.phase, 'disabled');
  assert.deepEqual(
    run.impacts.map((entry) => entry.owner),
    ['right'],
  );
  assert.equal(run.players[1].status, 'active');
  assert.equal(run.status, 'running');
});

function hunterFixture() {
  const run = running(
    level({
      enemies: [{ id: 'hunter', type: 'hunter', x: 30.5, y: 10.5, vx: 0, vy: 0, radius: 0.2 }],
    }),
  );
  arrange(run, 0, {
    x: 20.5,
    y: 10.5,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 10),
  });
  arrange(run, 1, {
    x: 50.5,
    y: 10.5,
    safeAnchor: { x: 50.5, y: 0.5 },
    trail: vertical(50, 1, 10),
  });
  return run;
}

function until(run, predicate, limit = 360) {
  const events = [];
  for (let count = 0; !predicate() && count < limit; count++) events.push(...ticks(run));
  assert.ok(predicate(), 'The expected threat phase was not reached.');
  return events;
}

test('Hunter warning locks its target point and commitment cannot retarget a closer player', () => {
  const run = hunterFixture();
  const hunter = run.enemies[0];
  until(run, () => hunter.phase === 'warning');
  assert.equal(hunter.target, 0);
  const targetPoint = structuredClone(hunter.targetPoint);
  arrange(run, 0, {
    x: 10.5,
    y: 10.5,
    safeAnchor: { x: 10.5, y: 0.5 },
    trail: vertical(10, 1, 10),
  });
  arrange(run, 1, {
    x: 25.5,
    y: 10.5,
    safeAnchor: { x: 25.5, y: 0.5 },
    trail: vertical(25, 1, 10),
  });
  until(run, () => hunter.phase === 'commit');
  assert.equal(hunter.target, 0);
  assert.deepEqual(hunter.targetPoint, targetPoint);
  assert.ok(hunter.vx < 0);
  Object.assign(run.players[0], {
    status: 'downed',
    cutting: false,
    trail: [],
    downedUntil: run.time + 12,
    downedClaimedAt: run.claimedCount,
  });
  const events = ticks(run);
  assert.equal(hunter.phase, 'commit');
  assert.equal(hunter.target, 0);
  assert.deepEqual(hunter.targetPoint, targetPoint);
  assert.equal(
    events.some((event) => event.type === 'enemy.warning'),
    false,
  );
});

test('a Hunter whose warned target goes down recovers instead of changing targets or committing', () => {
  const run = hunterFixture();
  const hunter = run.enemies[0];
  until(run, () => hunter.phase === 'warning');
  run.enemies.push({
    id: 'interrupt',
    type: 'drifter',
    x: 20.5,
    y: 5.5,
    vx: 0,
    vy: 0,
    radius: 0.2,
  });
  ticks(run);
  assert.equal(run.players[0].status, 'downed');
  const events = until(run, () => hunter.phase !== 'warning');
  assert.equal(hunter.phase, 'recovery');
  assert.equal(hunter.target, 0);
  assert.equal(
    events.some((event) => event.type === 'enemy.commit'),
    false,
  );
  assert.equal(
    events.some((event) => event.type === 'enemy.warning'),
    false,
  );
});

test('a recovering Hunter cannot inflict an unannounced body or trail hit', () => {
  const run = hunterFixture();
  const hunter = run.enemies[0];
  Object.assign(hunter, {
    phase: 'recovery',
    phaseUntil: run.time + 1.8,
    x: 20.5,
    y: 5.5,
    vx: 0,
    vy: 0,
  });
  const events = ticks(run, neutral(), 20);
  assert.equal(run.players[0].status, 'active');
  assert.equal(run.players[0].cutting, true);
  assert.equal(
    events.some((event) => event.type === 'player.downed'),
    false,
  );
});

for (const [contactAt, expected] of [
  [0.004, 'downed'],
  [0.005, 'active'],
])
  test(`a Hunter contact at ${contactAt}s respects its 0.005s recovery boundary`, () => {
    const run = running(
      level({
        enemies: [
          {
            id: 'hunter',
            type: 'hunter',
            x: 21.2 + contactAt * 20,
            y: 5.5,
            vx: -20,
            vy: 0,
            radius: 0.2,
          },
        ],
      }),
    );
    const hunter = run.enemies[0];
    Object.assign(hunter, {
      phase: 'commit',
      phaseUntil: 0.005,
      target: 0,
      targetPoint: { x: 20.5, y: 5.5 },
    });
    arrange(run, 0, {
      x: 20.5,
      y: 10.5,
      safeAnchor: { x: 20.5, y: 0.5 },
      trail: vertical(20, 1, 10),
    });
    ticks(run);
    assert.equal(run.players[0].status, expected);
    assert.equal(hunter.phase, 'recovery');
  });

test('capturing a harmless Hunter cell defeats it without leaving an active actor or stale threat deadline', () => {
  const run = running(
    smallLevel({
      enemies: [
        { id: 'hunter', type: 'hunter', x: 1.5, y: 1.5, vx: 0, vy: 0, radius: 0.2 },
        { id: 'retention', type: 'drifter', x: 9.5, y: 8.5, vx: 0, vy: 0, radius: 0.2 },
      ],
    }),
  );
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  Object.assign(hunter, { phase: 'recovery', phaseUntil: 1.8 });
  bankCell(run, 1);
  assert.equal(run.cells[run.width + 1], SAFE);
  assert.equal(hunter.active, false);
  const location = { x: hunter.x, y: hunter.y };
  const tick = run.tick;
  ticks(run, neutral(), 3 * 120);
  assert.equal(run.tick, tick + 3 * 120);
  assert.equal(run.status, 'running');
  assert.deepEqual({ x: hunter.x, y: hunter.y }, location);
  assert.ok(run.players.every((player) => player.status === 'active'));
});

test('a Hunter partially overlapped by new safe territory reflects inward commitment without entering safe cells', () => {
  const run = running(
    level({
      enemies: [{ id: 'hunter', type: 'hunter', x: 10.2, y: 5.5, vx: 0, vy: 0, radius: 0.35 }],
    }),
  );
  const hunter = run.enemies[0];
  Object.assign(hunter, {
    phase: 'warning',
    phaseUntil: 0.1,
    target: 0,
    targetPoint: { x: 9.5, y: 5.5 },
  });
  arrange(run, 0, { x: 9.5, y: 34.95, safeAnchor: { x: 9.5, y: 0.5 }, trail: vertical(9, 1, 34) });
  ticks(run, [command('down'), command()]);
  assert.equal(run.cells[5 * run.width + 9], SAFE);
  near(hunter.x, 10.2);
  for (let count = 0; count < 30; count++) {
    ticks(run);
    assert.equal(run.cells[Math.floor(hunter.y) * run.width + Math.floor(hunter.x)], FIELD);
    assert.equal(hunter.active, true);
  }
  assert.ok(hunter.x > 10.2);
});

test('merely enclosing a harmless Hunter retains its field until a cut actually claims its cell', () => {
  const run = running(
    level({
      enemies: [
        { id: 'hunter', type: 'hunter', x: 10.5, y: 10.5, vx: 0, vy: 0, radius: 0.2 },
        { id: 'retention', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 },
      ],
    }),
  );
  const hunter = run.enemies.find((enemy) => enemy.type === 'hunter');
  Object.assign(hunter, { phase: 'recovery', phaseUntil: 1.8 });
  arrange(run, 0, {
    x: 20.5,
    y: 34.95,
    safeAnchor: { x: 20.5, y: 0.5 },
    trail: vertical(20, 1, 34),
  });
  ticks(run, [command('down'), command()]);
  assert.equal(run.claimedCount, 34);
  assert.equal(run.cells[10 * run.width + 10], FIELD);
  assert.notEqual(hunter.active, false);
});

/** A public-input route uses two bent anchor approaches and then joins on the exposed core. */
function clearRelayYard({ swapped = false } = {}) {
  const source = swapped ? { ...RELAY_YARD, spawns: [...RELAY_YARD.spawns].reverse() } : RELAY_YARD;
  const run = running(source);
  const players = swapped ? [run.players[1], run.players[0]] : run.players;
  const events = [];
  const boosted = (direction = null) => command(direction, false, { boost: true });
  const stage = (inputs, done) => {
    events.push(...ticks(run));
    for (let count = 0; !done() && count < 1500; count++) {
      assert.equal(run.status, 'running');
      const next = inputs();
      events.push(...ticks(run, swapped ? [next[1], next[0]] : next));
      assert.ok(
        run.players.every((player) => player.status === 'active'),
        'The authored route suffered an unexpected knockdown.',
      );
    }
    assert.ok(done(), 'The authored route failed to reach its next waypoint.');
  };
  stage(
    () => [boosted(players[0].y > 8.55 ? 'up' : null), boosted(players[1].y > 12.55 ? 'up' : null)],
    () => players[0].y <= 8.55 && players[1].y <= 12.55,
  );
  stage(
    () => [
      boosted(players[0].x < 24.45 ? 'right' : null),
      boosted(players[1].x > 48.55 ? 'left' : null),
    ],
    () => players[0].x >= 24.45 && players[1].x <= 48.55,
  );
  stage(
    () => players.map((player) => boosted(player.cutting ? 'down' : null)),
    () => run.players.every((player) => !player.cutting),
  );
  assert.ok(run.strongholds[0].anchors.every((anchor) => anchor.captured));
  assert.equal(run.strongholds[0].shielded, false);
  assert.equal(run.strongholds[0].defeated, false);
  assert.equal(run.cells[6 * run.width + 36], FIELD);
  const shieldTick = run.tick;
  stage(
    () => [boosted(players[0].y > 8.55 ? 'up' : null), boosted(players[1].y > 12.55 ? 'up' : null)],
    () => players[0].y <= 8.55 && players[1].y <= 12.55,
  );
  stage(
    () => [
      boosted(players[0].y > 6.55 ? 'up' : null),
      boosted(players[1].x > 36.55 ? 'left' : null),
    ],
    () => players[0].y <= 6.55 && players[1].x <= 36.55,
  );
  stage(
    () => [
      boosted(players[0].x < 36.45 ? 'right' : null),
      boosted(players[1].y > 6.55 ? 'up' : null),
    ],
    () => run.status === 'won',
  );
  return { run, events, shieldTick };
}

test('the authored staggered Relay Yard is completed through public controls, distinct anchor banks, and a later joint core cut', () => {
  const original = structuredClone(RELAY_YARD);
  const result = clearRelayYard();
  const { run, events, shieldTick } = result;
  assert.equal(run.status, 'won');
  assert.equal(run.ruleset, 'revealline-coop.v2');
  assert.equal(run.strongholds[0].defeated, true);
  assert.equal(run.strongholds[0].emitter.phase, 'disabled');
  assert.equal(run.team.reserves, 3);
  assert.equal(run.team.jointCuts, 1);
  assert.equal(run.coverage, 0.5);
  assert.ok(run.tick > shieldTick);
  assert.equal(events.filter((event) => event.type === 'core.defeated').length, 1);
  assert.ok(events.some((event) => event.type === 'enemy.warning'));
  assert.ok(events.some((event) => event.type === 'enemy.commit'));
  assert.ok(events.some((event) => event.type === 'enemy.recovery'));
  assert.ok(
    events.some((event) => event.type === 'enemy.defeated' && event.enemy === 'yard-hunter'),
  );
  assert.equal(run.enemies.find((enemy) => enemy.id === 'yard-hunter').active, false);
  assert.deepEqual(RELAY_YARD, original);
  assert.deepEqual(clearRelayYard(), result);
});

test('the real Relay Yard route is invariant when seats and their command streams are exchanged', () => {
  const first = clearRelayYard();
  const second = clearRelayYard({ swapped: true });
  const { run: a } = first;
  const { run: b } = second;
  assert.equal(a.tick, b.tick);
  assert.equal(a.status, b.status);
  assert.deepEqual(a.cells, b.cells);
  assert.equal(a.claimedCount, b.claimedCount);
  assert.equal(a.team.reserves, b.team.reserves);
  assert.equal(a.team.jointCuts, b.team.jointCuts);
  for (let seat = 0; seat < 2; seat++) {
    const x = a.players[seat];
    const y = b.players[1 - seat];
    assert.deepEqual(
      [x.x, x.y, x.status, x.safeAnchor, x.trail, x.support],
      [y.x, y.y, y.status, y.safeAnchor, y.trail, y.support],
    );
  }
  const target = (id) => (id === null || id === undefined ? id : 1 - id);
  assert.deepEqual(
    a.enemies,
    b.enemies.map((enemy) =>
      enemy.type === 'hunter' ? { ...enemy, target: target(enemy.target) } : enemy,
    ),
  );
  assert.deepEqual(
    a.strongholds,
    b.strongholds.map((hold) => ({
      ...hold,
      emitter: { ...hold.emitter, target: target(hold.emitter.target) },
    })),
  );
});
