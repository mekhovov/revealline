import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoop,
  startCoop,
  stepCoop,
  validateCoopLevel,
  getCoopSummary,
  FIXED_DT,
  SAFE,
  FIELD,
} from '../coop/core.mjs';
import { COOP_FOUNDATION_LEVEL_VERSION, COOP_FOUNDATION_RULESET } from '../coop/foundations.mjs';
import { compileMapDesign } from '../content-design/map.mjs';
import { validateCoopPack, COOP_PACK_VERSION } from '../coop/recipes.mjs';
import { COOP_RULESET } from '../coop/core.mjs';

function fixture() {
  const map = compileMapDesign({
    format: 'MapDesignV1',
    id: 'team-islands',
    revision: '1',
    name: 'Two return islands',
    width: 72,
    height: 36,
    walls: [],
    terrain: [],
    foundations: [
      { x: 18, y: 15, w: 5, h: 5 },
      { x: 49, y: 15, w: 5, h: 5 },
    ],
    spawns: [
      { id: 'west', x: 20.5, y: 17.5 },
      { id: 'east', x: 51.5, y: 17.5 },
    ],
  });
  const level = {
    version: COOP_FOUNDATION_LEVEL_VERSION,
    journeyDifficulty: 'standard',
    id: 'team-islands',
    revision: 1,
    name: 'Two return islands',
    width: map.geometry.width,
    height: map.geometry.height,
    spawns: map.geometry.spawns.map(({ x, y }) => ({ x, y })),
    walls: map.source.walls,
    safeRects: map.source.foundations,
    enemies: [
      { id: 'north', type: 'drifter', x: 35.5, y: 8.5, vx: 0, vy: 0, radius: 0.2 },
      { id: 'south', type: 'drifter', x: 35.5, y: 27.5, vx: 0, vy: 0, radius: 0.2 },
    ],
    goal: { coverage: 0.95 },
    rules: { moveSpeed: 10, boostMultiplier: 1.5 },
  };
  return { map, level };
}
const command = (direction = null) => ({ direction, boost: false, support: false });

test('new Team edition uses the same disconnected foundation geometry and zero earned coverage', () => {
  const { map, level } = fixture(),
    before = structuredClone(level);
  const run = createCoop(level);
  assert.equal(run.ruleset, COOP_FOUNDATION_RULESET);
  assert.equal(getCoopSummary(run).ruleset, COOP_FOUNDATION_RULESET);
  assert.deepEqual([...run.cells], map.geometry.cells);
  assert.equal(run.totalClaimable, map.geometry.eligibleCount);
  assert.equal(run.totalClaimable, 70 * 34 - 50);
  assert.equal(run.coverage, 0);
  assert.equal(run.claimedCount, 0);
  assert.deepEqual(level, before);
  for (const player of run.players) assert.equal(run.cells[player.cellIndex], SAFE);
});

test('both island spawns can close independent routes onto the perimeter with fresh-direction stop', () => {
  const { level } = fixture(),
    run = createCoop(level);
  startCoop(run);
  stepCoop(run, [command(), command()], FIXED_DT);
  const initialClaimable = run.totalClaimable;
  const events = [];
  for (let tick = 0; tick < 400; tick++) {
    stepCoop(run, [command('left'), command('right')], FIXED_DT);
    events.push(...structuredClone(run.events));
  }
  assert(run.claimedCount > 0);
  assert.equal(run.totalClaimable, initialClaimable);
  assert.equal(run.coverage, run.claimedCount / initialClaimable);
  for (const player of run.players) {
    assert.equal(player.status, 'active');
    assert.equal(player.cutting, false);
    assert.equal(player.direction, null);
    assert.equal(run.cells[player.cellIndex], SAFE);
  }
  assert.deepEqual(
    events
      .filter((event) => event.type === 'cut.closed')
      .map((event) => event.player)
      .sort(),
    [0, 1],
  );
  for (const area of level.safeRects)
    for (let y = area.y; y < area.y + area.h; y++)
      for (let x = area.x; x < area.x + area.w; x++) assert.equal(run.cells[y * 72 + x], SAFE);
  assert(
    run.cells.some((cell) => cell === FIELD),
    'occupied regions remain unclaimed',
  );
});

test('historical Team editions and packs never silently adopt disconnected-island semantics', () => {
  const { level } = fixture();
  const historical = { ...level, version: 'revealline-coop-level.v1' };
  delete historical.journeyDifficulty;
  assert.equal(validateCoopLevel(historical).valid, false);
  assert.match(validateCoopLevel(historical).errors.join(' '), /must be connected/);
  const pack = {
    version: COOP_PACK_VERSION,
    ruleset: COOP_RULESET,
    id: 'historical',
    revision: 1,
    name: 'Historical',
    levels: [level],
  };
  assert.equal(validateCoopPack(pack).valid, false);
  assert.match(validateCoopPack(pack).errors.join(' '), /newer Team runtime/);
});

test('new Team editions pin the shared three-preset life budget without rewriting historical reserves', () => {
  for (const [difficulty, lives] of [
    ['gentle', 5],
    ['standard', 3],
    ['expert', 2],
  ]) {
    const { level } = fixture();
    level.journeyDifficulty = difficulty;
    const run = createCoop(level);
    assert.equal(run.difficulty, difficulty);
    assert.equal(run.team.reserves + 1, lives);
    assert.throws(
      () => createCoop(level, { difficulty: difficulty === 'standard' ? 'expert' : 'standard' }),
      /compiled Journey edition/,
    );
  }
});

test('shared Team geometry rejects blocked spawns, overlaps, malformed positions and unsupported terrain', () => {
  for (const mutate of [
    (level) => {
      level.spawns[0].x = 20;
    },
    (level) => {
      level.walls = [{ x: 18, y: 15, w: 1, h: 1 }];
    },
    (level) => {
      level.spawns[0] = { x: 30.5, y: 12.5 };
    },
    (level) => {
      level.terrain = [{ x: 3, y: 3, w: 4, h: 4, kind: 'lethal' }];
    },
  ]) {
    const { level } = fixture();
    mutate(level);
    assert.equal(validateCoopLevel(level).valid, false);
    assert.throws(() => createCoop(level));
  }
});

test('Journey Team contact recovery uses the shared short delay and consumes held steering', () => {
  const { level } = fixture();
  level.enemies[0].x = 20.5;
  level.enemies[0].y = 22.5;
  const run = createCoop(level);
  startCoop(run);
  stepCoop(run, [command(), command()], FIXED_DT);
  for (let tick = 0; tick < 240 && run.players[0].status === 'active'; tick++)
    stepCoop(run, [command('down'), command()], FIXED_DT);
  assert.equal(run.players[0].status, 'downed');
  const at = run.time;
  assert(Math.abs(run.players[0].downedUntil - at - 0.65) <= FIXED_DT + 1e-8);
  for (let tick = 0; tick < 80 && run.players[0].status === 'downed'; tick++)
    stepCoop(run, [command('down'), command()], FIXED_DT);
  assert.equal(run.players[0].status, 'active');
  assert(run.time - at <= 0.67);
  assert.equal(run.team.reserves, 1);
  const { x, y } = run.players[0];
  for (let tick = 0; tick < 24; tick++) stepCoop(run, [command('down'), command()], FIXED_DT);
  assert.equal(run.players[0].x, x);
  assert.equal(run.players[0].y, y);
  assert.equal(run.players[0].direction, null);
});
