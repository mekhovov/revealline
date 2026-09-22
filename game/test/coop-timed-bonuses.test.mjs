import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoop,
  startCoop,
  stepCoop,
  pauseCoop,
  resumeCoop,
  validateCoopLevel,
} from '../coop/core.mjs';
import { COOP_BONUS_LEVEL_VERSION, COOP_BONUS_RULESET } from '../coop/foundations.mjs';
import { coopBonusActive, coopBonusEnemyFactor } from '../coop/timed-bonuses.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../core/timed-bonuses.mjs';
import { CLASSIC_EFFECTS } from '../core/classic-state.mjs';
import { captureSeedEnemies } from '../core/capture-regions.mjs';

const command = (direction = null, support = false) => ({ direction, boost: false, support });
const idle = [command(), command()];
function fixture(kind = 'enemy-slow') {
  return {
    version: COOP_BONUS_LEVEL_VERSION,
    id: 'team-timed',
    revision: '1',
    name: 'Team timed',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: 8.5, y: 0.5 },
      { x: 71.5, y: 30.5 },
    ],
    walls: [],
    safeRects: [],
    terrain: [],
    enemies: [{ id: 'keeper', type: 'drifter', x: 55.5, y: 18.5, vx: 0, vy: 0, radius: 0.25 }],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 8, boostMultiplier: 1 },
    timedBonuses: {
      version: TIMED_BONUS_TRAIL_VERSION,
      schedules: [
        {
          id: 'opportunity',
          kind,
          anchors: [
            { x: 8.5, y: 8.5 },
            { x: 8.5, y: 18.5 },
          ],
          initialDelayTicks: 0,
          announcementTicks: 120,
          availableTicks: 1200,
          cooldownTicks: 240,
          maxAppearances: 3,
          maxCollections: 1,
        },
      ],
    },
  };
}
function advance(run, ticks, commands = idle) {
  const events = [];
  for (let i = 0; i < ticks; i++) {
    stepCoop(run, commands);
    events.push(...structuredClone(run.events));
  }
  return events;
}
function available(level = fixture()) {
  const run = startCoop(createCoop(level, { seed: 17 }));
  advance(run, 121);
  assert.equal(run.bonuses.timed.schedules[0].phase, 'available');
  return run;
}
function take(run, commands = [command('down'), command()]) {
  for (let guard = 0; guard < 1200; guard++) {
    stepCoop(run, commands);
    assert(run.players.every((player) => player.status === 'active'));
    const event = run.events.find((item) => item.type === 'powerup.collected');
    if (event) return event;
  }
  assert.fail('No pickup collected by public movement.');
}

test('Team bonus edition validates owned v2 data; old editions and unqualified mechanics reject it', () => {
  const level = fixture(),
    original = structuredClone(level);
  assert.equal(validateCoopLevel(level).valid, true);
  const run = createCoop(level);
  assert.equal(run.ruleset, COOP_BONUS_RULESET);
  assert.deepEqual(level, original);
  assert.notEqual(run.level.timedBonuses, level.timedBonuses);
  for (const version of [
    'revealline-coop-level.v1',
    'revealline-coop-level.v2',
    'revealline-coop-level.v3',
    'revealline-coop-level.v4',
  ])
    assert.equal(validateCoopLevel({ ...level, version }).valid, false);
  for (const mutate of [
    (l) => {
      l.timedBonuses = JSON.stringify(l.timedBonuses);
    },
    (l) => {
      l.timedBonuses.version = 'timed-bonuses.v1';
    },
    (l) => {
      l.timedBonuses.schedules[0].id = 'keeper';
    },
    (l) => {
      l.timedBonuses.schedules[0].anchors[0].y = 0.5;
    },
    (l) => {
      l.enemies[0].type = 'hunter';
    },
    (l) => {
      l.strongholds = [];
    },
    (l) => {
      l.encounter = {};
    },
    (l) => {
      l.goal = { cores: ['missing'] };
    },
  ]) {
    const bad = structuredClone(level);
    mutate(bad);
    assert.equal(validateCoopLevel(bad).valid, false);
  }
  let reads = 0;
  Object.defineProperty(level.timedBonuses, 'version', {
    enumerable: true,
    get() {
      reads++;
      return TIMED_BONUS_TRAIL_VERSION;
    },
  });
  assert.equal(validateCoopLevel(level).valid, false);
  assert.equal(reads, 0);
  const hidden = fixture();
  Object.defineProperty(hidden, 'timedBonuses', { value: hidden.timedBonuses, enumerable: false });
  assert.equal(validateCoopLevel(hidden).valid, false);
  assert.throws(() => createCoop(hidden), /enumerable/);
  const noBonus = fixture();
  delete noBonus.timedBonuses;
  assert.equal(
    createCoop(noBonus).bonuses,
    undefined,
    'remove-last retains explicit v5 without implicit state',
  );
});

for (const kind of ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze'])
  test(`public shared contact grants ${kind} once with bounded ownership`, () => {
    const run = available(fixture(kind)),
      event = take(run);
    assert.deepEqual(event.players, [0]);
    assert.equal(run.bonuses.items.length, 0);
    assert.equal(run.bonuses.timed.schedules[0].collections, 1);
    assert.equal(run.bonuses.timed.schedules[0].phase, 'exhausted');
    if (kind === 'extra-life') {
      assert.equal(run.team.reserves, 3);
      assert.equal(event.gain, 1);
    } else {
      assert.equal(event.activationTick, event.tick + 1);
      assert.equal(event.untilTick - event.activationTick, CLASSIC_EFFECTS[kind]);
      assert.equal(coopBonusActive(run, kind, 0), true);
      if (kind === 'player-speed') assert.equal(coopBonusActive(run, kind, 1), false);
      advance(run, CLASSIC_EFFECTS[kind]);
      assert.equal(coopBonusActive(run, kind, 0), false);
    }
  });

test('announcements, pause and misses use one finite seeded schedule and relocate after expiry', () => {
  const run = available(),
    first = structuredClone(run.bonuses.items[0]);
  pauseCoop(run);
  const paused = structuredClone(run);
  advance(run, 100);
  assert.deepEqual(run, paused);
  resumeCoop(run);
  advance(run, 1200);
  assert.equal(run.bonuses.items.length, 0);
  assert.equal(run.bonuses.timed.schedules[0].phase, 'cooldown');
  assert.equal(run.bonuses.timed.schedules[0].collections, 0);
  advance(run, 360);
  assert.equal(run.bonuses.items.length, 1);
  assert.notEqual(run.bonuses.items[0].y, first.y);
  advance(run, 1200 + 360 + 1200);
  assert.equal(run.bonuses.timed.schedules[0].phase, 'exhausted');
  assert.equal(run.bonuses.timed.schedules[0].appearances, 3);
});

test('shared schedule continues identically from an owned state clone, without claiming a public Team save format', () => {
  const run = available(),
    restored = structuredClone(run);
  const left = take(run),
    right = take(restored);
  assert.deepEqual(left, right);
  assert.deepEqual(restored, run);
  advance(run, 400);
  advance(restored, 400);
  assert.deepEqual(restored, run);
});

test('v7 roamers remain nonretaining and freeze pauses activation clocks without stopping bonus time', () => {
  const level = fixture('enemy-freeze');
  level.safeRects = [{ x: 30, y: 10, w: 5, h: 5 }];
  level.enemies.push({
    id: 'rover',
    type: 'claimed-rover',
    x: 32.5,
    y: 12.5,
    vx: 1,
    vy: 0,
    radius: 0.25,
  });
  const run = available(level);
  assert.deepEqual(
    captureSeedEnemies(run).map((enemy) => enemy.id),
    ['keeper'],
  );
  const event = take(run),
    rover = run.enemies.find((enemy) => enemy.id === 'rover');
  const position = { x: rover.x, y: rover.y },
    clock = run.roverActorTick,
    bonusClock = run.bonuses.timed.clock;
  advance(run, 360);
  assert.deepEqual({ x: rover.x, y: rover.y }, position);
  assert.equal(run.roverActorTick, clock);
  assert.equal(run.bonuses.timed.clock, bonusClock + 360);
  assert.equal(run.tick, event.untilTick);
  advance(run, 1);
  assert.equal(run.roverActorTick, clock + 1);
  assert.notDeepEqual({ x: rover.x, y: rover.y }, position);
});

test('slow uses strongest support factor and does not corrupt authored velocity', () => {
  const run = available(),
    event = take(run),
    enemy = run.enemies[0];
  // Controlled effect-overlap unit arrangement, separate from the public taking route.
  enemy.vx = 2;
  enemy.vy = 0;
  enemy.speedScale = 1;
  assert.equal(coopBonusEnemyFactor(run, enemy), 0.5);
  const x = enemy.x;
  advance(run, 120);
  assert(Math.abs(enemy.x - x - 1) < 1e-8);
  assert.equal(enemy.vx, 2);
  enemy.vx = 1;
  enemy.speedScale = 0.5;
  enemy.slowUntil = run.time + 2;
  assert.equal(coopBonusEnemyFactor(run, enemy), 1, 'not double-slowed to one quarter');
  const supportedX = enemy.x;
  advance(run, 120);
  assert(Math.abs(enemy.x - supportedX - 1) < 1e-8);
  assert.equal(run.bonuses.effects['enemy-slow'].until, event.untilTick);
});

test('simultaneous public contact grants one shared life or equal speed to both pilots', () => {
  for (const kind of ['extra-life', 'player-speed']) {
    const level = fixture(kind);
    level.spawns[1] = { x: 8.5, y: 34.5 };
    level.safeRects = [{ x: 8, y: 34, w: 1, h: 1 }];
    level.timedBonuses.schedules[0].anchors = [
      { x: 8.5, y: 17.5 },
      { x: 24.5, y: 17.5 },
    ];
    // Choose and pin a seed that starts at the central authored anchor.
    const run = available(level);
    assert.equal(run.bonuses.items[0].x, 8.5);
    const event = take(run, [command('down'), command('up')]);
    assert.deepEqual(event.players, [0, 1]);
    assert.equal(run.bonuses.timed.schedules[0].collections, 1);
    assert.equal(run.bonuses.items.length, 0);
    if (kind === 'extra-life') assert.equal(run.team.reserves, 3);
    else
      assert.deepEqual(
        run.bonuses.effects['player-speed'][0],
        run.bonuses.effects['player-speed'][1],
      );
  }
});

function placePilot(player, point) {
  Object.assign(player, {
    x: point.x,
    y: point.y,
    cellIndex: Math.floor(point.y) * 72 + Math.floor(point.x),
  });
}

test('expiry-tick removal wins a simultaneous contact and capped life still consumes one item', () => {
  const run = available(fixture('extra-life'));
  const item = structuredClone(run.bonuses.items[0]);
  advance(run, 1199);
  // Exact contact-boundary unit arrangement, not a public taking route.
  placePilot(run.players[0], item);
  stepCoop(run, idle);
  assert.equal(run.bonuses.timed.schedules[0].collections, 0);
  assert.equal(run.bonuses.items.length, 0);
  assert.equal(run.team.reserves, 2);
  assert(run.events.some((event) => event.type === 'bonus.expired'));
  const capped = available(fixture('extra-life'));
  capped.team.reserves = 8;
  const event = take(capped);
  assert.equal(event.gain, 0);
  assert.equal(capped.team.reserves, 8);
  assert.equal(capped.bonuses.timed.schedules[0].collections, 1);
});

test('damage precedes collection even when a tied partner closure immediately revives the victim', () => {
  const run = available(fixture('player-speed')),
    item = run.bonuses.items[0];
  // Exact-time damage/closure fixture. Ordinary public contacts are tested above.
  const victim = run.players[0],
    partner = run.players[1];
  placePilot(victim, { x: item.x, y: item.y });
  victim.cutting = true;
  victim.trail = [{ x: 8, y: Math.floor(item.y), index: Math.floor(item.y) * 72 + 8 }];
  victim.departureIndex = 8;
  victim.safeAnchor = { x: item.x, y: item.y };
  run.bonuses.effects['player-speed'][0] = { from: 0, until: run.tick + 600 };
  run.enemies[0].x = victim.x;
  run.enemies[0].y = victim.y;
  placePilot(partner, { x: 20.5, y: 35 });
  partner.cellIndex = 34 * 72 + 20;
  partner.cutting = true;
  partner.trail = Array.from({ length: 34 }, (_, i) => ({
    x: 20,
    y: i + 1,
    index: (i + 1) * 72 + 20,
  }));
  partner.departureIndex = 20;
  partner.safeAnchor = { x: 20.5, y: 0.5 };
  stepCoop(run, [command(), command('down')]);
  assert(run.events.some((event) => event.type === 'player.downed' && event.player === 0));
  assert(
    run.events.some(
      (event) =>
        event.type === 'player.revived' && event.player === 0 && event.reason === 'capture',
    ),
  );
  assert(run.events.some((event) => event.type === 'cut.closed' && event.player === 1));
  assert.equal(run.bonuses.timed.schedules[0].collections, 0);
  assert.equal(run.bonuses.items.length, 1);
  assert.deepEqual(run.bonuses.effects['player-speed'][0], { from: 0, until: 0 });
  assert.equal(
    run.events.some((event) => event.type === 'powerup.collected'),
    false,
  );
  // A later simulation instant is a new opportunity, not the tied contact.
  stepCoop(run, idle);
  assert.equal(run.bonuses.timed.schedules[0].collections, 1);
});

test('freeze suppresses enemy contact but not lethal terrain or self-trail hazards', () => {
  for (const hazard of ['enemy', 'lethal', 'self']) {
    const run = available(fixture('enemy-freeze'));
    take(run);
    const player = run.players[0];
    if (hazard === 'enemy') {
      run.enemies[0].x = player.x;
      run.enemies[0].y = player.y;
    }
    if (hazard === 'lethal') run.terrain[player.cellIndex] = 2;
    if (hazard === 'self') {
      const previous = player.cellIndex - 72;
      assert(player.trail.some((cell) => cell.index === previous));
    }
    const events = advance(run, hazard === 'self' ? 20 : 1, [
      command(hazard === 'self' ? 'up' : null),
      command(),
    ]);
    assert.equal(
      events.some((event) => event.type === 'player.downed'),
      hazard !== 'enemy',
    );
  }
});

test('same-instant damage exclusion survives a tick boundary and cloned continuation', () => {
  const run = available(fixture('player-speed')),
    item = run.bonuses.items[0];
  const victim = run.players[0],
    partner = run.players[1];
  // Exact end-of-tick linear contact: damage, pickup and partner return meet at dt.
  placePilot(victim, { x: item.x, y: item.y - 0.63 - 8 / 120 });
  victim.cutting = true;
  victim.trail = [{ x: 8, y: 2, index: 2 * 72 + 8 }];
  victim.safeAnchor = { x: item.x, y: item.y };
  run.enemies[0].x = item.x;
  run.enemies[0].y = item.y - 0.2;
  placePilot(partner, { x: 20.5, y: 35 - 8 / 120 });
  partner.cutting = true;
  partner.trail = Array.from({ length: 34 }, (_, i) => ({
    x: 20,
    y: i + 1,
    index: (i + 1) * 72 + 20,
  }));
  partner.safeAnchor = { x: 20.5, y: 0.5 };
  stepCoop(run, [command('down'), command('down')]);
  assert(
    run.events.some(
      (event) =>
        event.type === 'player.revived' && event.player === 0 && event.reason === 'capture',
    ),
  );
  assert(Math.abs(run.bonuses.lastDamageTime[0] - run.time) < 1e-8);
  assert.equal(run.bonuses.timed.schedules[0].collections, 0);
  const restored = structuredClone(run);
  for (const candidate of [run, restored]) {
    stepCoop(candidate, idle);
    assert.equal(
      candidate.bonuses.timed.schedules[0].collections,
      0,
      'same timestamp at next tick start is still excluded',
    );
    stepCoop(candidate, idle);
    assert.equal(candidate.bonuses.timed.schedules[0].collections, 1);
  }
  assert.deepEqual(restored, run);
});

test('a surviving simultaneous collector receives the grant regardless of seat number', () => {
  for (const victimId of [0, 1]) {
    const run = available(fixture('player-speed')),
      item = run.bonuses.items[0];
    const victim = run.players[victimId],
      survivor = run.players[1 - victimId];
    // Controlled same-time body-contact arrangement, mirrored between seats.
    for (const [player, x] of [
      [victim, item.x - 0.6],
      [survivor, item.x + 0.6],
    ]) {
      placePilot(player, { x, y: item.y });
      player.cutting = true;
      player.trail = [{ x: Math.floor(x), y: Math.floor(item.y), index: player.cellIndex }];
    }
    run.enemies[0].x = victim.x;
    run.enemies[0].y = victim.y;
    stepCoop(run, idle);
    const event = run.events.find((entry) => entry.type === 'powerup.collected');
    assert.deepEqual(event.players, [1 - victimId]);
    assert.equal(run.bonuses.timed.schedules[0].collections, 1);
    assert.equal(coopBonusActive(run, 'player-speed', victimId), false);
    assert.equal(coopBonusActive(run, 'player-speed', 1 - victimId), true);
  }
});

test('two public speed collections refresh one window, not stacked speed or a one-tick gap', () => {
  const level = fixture('player-speed');
  level.timedBonuses.schedules[0].anchors[1] = { x: 24.5, y: 8.5 };
  level.timedBonuses.schedules[0].maxCollections = 2;
  const run = available(level),
    first = take(run);
  const effect = run.bonuses.effects['player-speed'][0],
    from = effect.from;
  advance(run, 360);
  assert.equal(run.bonuses.items[0].x, 24.5);
  const second = take(run, [command('right'), command()]);
  assert(second.tick < first.untilTick, 'first speed window still active at second contact');
  assert.equal(effect.from, from);
  assert.equal(effect.until, second.activationTick + 600);
  assert.equal(run.bonuses.timed.schedules[0].collections, 2);
  const x = run.players[0].x;
  advance(run, 12, [command('right'), command()]);
  assert(Math.abs(run.players[0].x - x - 1) < 1e-8, 'one 1.25x factor gives ten cells per second');
});

test('freeze preserves the full roamer activation warning and ready/terminal states freeze schedules', () => {
  const level = fixture('enemy-freeze');
  level.enemies.push({
    id: 'rover',
    type: 'claimed-rover',
    x: 32.5,
    y: 12.5,
    vx: 1,
    vy: 0,
    radius: 0.25,
  });
  const ready = createCoop(level),
    before = structuredClone(ready);
  advance(ready, 10);
  assert.deepEqual(ready, before);
  const run = available(level);
  take(run);
  const rover = run.enemies.find((enemy) => enemy.id === 'rover');
  assert.equal(rover.rover.mode, 'dormant');
  // Reclaimed-domain arrangement isolates warning clock behavior, not capture evidence.
  for (let y = 10; y < 15; y++) for (let x = 30; x < 35; x++) run.cells[y * 72 + x] = 1;
  advance(run, 1);
  assert.equal(rover.rover.mode, 'warning');
  const clock = run.roverActorTick;
  advance(run, 359);
  assert.equal(run.roverActorTick, clock);
  assert.equal(rover.rover.mode, 'warning');
  advance(run, 119);
  assert.equal(rover.rover.mode, 'warning');
  advance(run, 1);
  assert.equal(rover.rover.mode, 'active');
  for (const status of ['won', 'lost']) {
    run.status = status;
    const terminal = structuredClone(run);
    advance(run, 50);
    assert.deepEqual(run, terminal);
  }
});
