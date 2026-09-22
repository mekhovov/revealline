import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, validateCoopLevel } from '../coop/core.mjs';
import { COOP_ROVER_LEVEL_VERSION } from '../coop/foundations.mjs';
import { hasTeamBonusOpportunity } from '../coop/bonus-opportunity.mjs';
import { hasBonusOpportunity } from '../core/bonus-opportunity.mjs';

const definition = { availableTicks: 300 };
const command = (direction) => ({ direction, boost: false, support: false });
function fixture() {
  return {
    version: COOP_ROVER_LEVEL_VERSION,
    id: 'bonus-opportunity',
    revision: '1',
    name: 'Bonus opportunity',
    width: 72,
    height: 36,
    journeyDifficulty: 'standard',
    spawns: [
      { x: 10.5, y: 0.5 },
      { x: 60.5, y: 35.5 },
    ],
    walls: [],
    safeRects: [],
    terrain: [],
    enemies: [{ id: 'keeper', type: 'drifter', x: 35.5, y: 18.5, vx: 0, vy: 0, radius: 0.25 }],
    goal: { coverage: 0.99 },
    rules: { moveSpeed: 8, boostMultiplier: 1 },
  };
}

test('either active pilot provides opportunity without seat-order bias or state mutation', () => {
  const run = createCoop(fixture()),
    before = structuredClone(run);
  const anchors = [
    { x: 10.5, y: 8.5 },
    { x: 60.5, y: 27.5 },
  ];
  for (const anchor of anchors) {
    assert.equal(hasTeamBonusOpportunity(run, definition, anchor), true);
    assert.equal(
      hasTeamBonusOpportunity({ ...run, players: [...run.players].reverse() }, definition, anchor),
      true,
    );
  }
  assert.deepEqual(run, before);
  assert.equal(hasTeamBonusOpportunity(run, definition, { x: 35.5, y: 5.5 }), false);
});

test('public Team steering supplies real record-shaped trails and both are excluded', () => {
  const run = startCoop(createCoop(fixture()));
  for (let tick = 0; tick < 180; tick++) stepCoop(run, [command('down'), command('up')]);
  assert(
    run.players.every(
      (pilot) => pilot.status === 'active' && pilot.cutting && pilot.trail.length > 5,
    ),
  );
  for (const anchor of [
    { x: 10.5, y: 4.5 },
    { x: 60.5, y: 31.5 },
  ]) {
    assert.equal(hasTeamBonusOpportunity(run, definition, anchor), false);
    assert.equal(
      hasTeamBonusOpportunity({ ...run, players: [...run.players].reverse() }, definition, anchor),
      false,
    );
    // Control isolates trail exclusion from proximity and travel-budget refusal.
    const withoutTrails = { ...run, players: run.players.map((p) => ({ ...p, trail: [] })) };
    assert.equal(hasTeamBonusOpportunity(withoutTrails, definition, anchor), true);
  }
});

test('downed pilots cannot supply a reachable start but still reserve body clearance', () => {
  const run = createCoop(fixture());
  // Unit arrangement of status only; not a public recovery scenario.
  run.players[1].status = 'downed';
  assert.equal(hasTeamBonusOpportunity(run, definition, { x: 60.5, y: 27.5 }), false);
  assert.equal(hasTeamBonusOpportunity(run, { availableTicks: 2400 }, { x: 60.5, y: 34.5 }), false);
  run.players[0].status = 'downed';
  assert.equal(hasTeamBonusOpportunity(run, { availableTicks: 2400 }, { x: 10.5, y: 8.5 }), false);
});

test('shared eligibility excludes reclaimed, lethal, occupied and enemy-adjacent anchors', () => {
  const run = createCoop(fixture()),
    anchor = { x: 10.5, y: 8.5 },
    index = 8 * 72 + 10;
  assert.equal(hasTeamBonusOpportunity(run, definition, anchor), true);
  run.cells[index] = 1; // Explicit geometry-only unit arrangements.
  assert.equal(hasTeamBonusOpportunity(run, definition, anchor), false);
  run.cells[index] = 0;
  run.terrain[index] = 2;
  assert.equal(hasTeamBonusOpportunity(run, definition, anchor), false);
  run.terrain[index] = 0;
  assert.equal(
    hasTeamBonusOpportunity(run, definition, anchor, [{ ...anchor, collectedTick: null }]),
    false,
  );
  assert.equal(
    hasTeamBonusOpportunity(run, definition, anchor, [{ ...anchor, collectedTick: 1 }]),
    true,
  );
  run.enemies[0].x = anchor.x;
  run.enemies[0].y = anchor.y;
  assert.equal(hasTeamBonusOpportunity(run, definition, anchor), false);
  run.enemies[0].active = false;
  assert.equal(hasTeamBonusOpportunity(run, definition, anchor), true);
  const dormantLevel = fixture();
  dormantLevel.enemies.push({
    id: 'dormant-rover',
    type: 'claimed-rover',
    ...anchor,
    vx: 1,
    vy: 0,
    radius: 0.25,
  });
  const dormantRun = createCoop(dormantLevel);
  assert.equal(
    dormantRun.enemies.find((enemy) => enemy.id === 'dormant-rover').rover.mode,
    'dormant',
  );
  assert.equal(hasTeamBonusOpportunity(dormantRun, definition, anchor), false);
});

test('multi-origin path search cannot cross either trail or a wall/lethal barrier', () => {
  const board = { width: 9, height: 7, cells: new Uint8Array(63) };
  const barrier = Array.from({ length: 7 }, (_, y) => y * 9 + 4);
  const options = {
    anchor: { x: 6.5, y: 3.5 },
    starts: [9, 45],
    trail: new Set(),
    bodies: [],
    items: [],
    maxDistance: 20,
    terrain: new Uint8Array(63),
  };
  assert.equal(hasBonusOpportunity(board, options), true);
  assert.equal(hasBonusOpportunity(board, { ...options, trail: new Set(barrier) }), false);
  for (const index of barrier) board.cells[index] = 2;
  assert.equal(hasBonusOpportunity(board, options), false);
  for (const index of barrier) {
    board.cells[index] = 0;
    options.terrain[index] = 2;
  }
  assert.equal(hasBonusOpportunity(board, options), false);
  for (const index of barrier) board.cells[index] = 1;
  assert.equal(hasBonusOpportunity(board, options), true, 'reclamation neutralizes lethal terrain');
});

test('eligibility primitive does not enable an unsupported Team runtime descriptor', () => {
  const level = fixture();
  level.timedBonuses = { version: 'timed-bonuses.v2', schedules: [] };
  assert.equal(validateCoopLevel(level).valid, false);
});
