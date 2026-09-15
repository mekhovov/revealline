import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, FIELD, FIXED_DT } from '../coop/core.mjs';
import { playerWallContact, enemyWallContact } from '../coop/geometry.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';

const command = (direction) => ({ direction, boost: false, support: false });
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function advance(run, directions, ticks) {
  const events = [];
  for (let tick = 0; tick < ticks; tick++) {
    stepCoop(run, directions.map(command));
    events.push(...run.events);
  }
  return events;
}

for (const direction of ['up', 'down']) {
  test(`live Yard: both craft slide ${direction} along pillar tile seams after normal inward contact`, () => {
    const run = startCoop(createCoop(RELAY_YARD));
    const original = structuredClone(RELAY_YARD);
    const events = advance(run, ['right', 'left'], 240);
    near(run.players[0].x, 16 - run.players[0].radius);
    near(run.players[1].x, 56 + run.players[1].radius);
    assert.ok(run.players.every((player) => player.status === 'active' && player.cutting));
    const before = run.players.map((player) => ({
      x: player.x,
      y: player.y,
      trail: player.trail.length,
    }));
    for (let tick = 0; tick < 60; tick++) {
      events.push(...advance(run, [direction, direction], 1));
      for (const [id, player] of run.players.entries()) {
        near(player.x, before[id].x);
        near(player.y, before[id].y + (direction === 'up' ? -1 : 1) * (tick + 1) * 8 * FIXED_DT);
        assert.equal(player.status, 'active');
        assert.equal(run.cells[player.cellIndex], FIELD);
      }
    }
    assert.ok(run.players.every((player, id) => player.trail.length > before[id].trail));
    assert.equal(events.filter((event) => event.type === 'player.downed').length, 0);
    assert.deepEqual(RELAY_YARD, original);
  });
}

const geometricBoard = (horizontal) => {
  const cells = new Uint8Array(72 * 36);
  for (let offset = 0; offset < 5; offset++)
    cells[(horizontal ? 12 : 12 + offset) * 72 + (horizontal ? 20 + offset : 20)] = 2;
  return { width: 72, height: 36, cells, strongholds: [] };
};

test('sliding leaves the real trail live, so reversing onto it still downs both players', () => {
  const run = startCoop(createCoop(RELAY_YARD));
  advance(run, ['right', 'left'], 240);
  advance(run, ['up', 'up'], 60);
  const events = advance(run, ['down', 'down'], 12);
  assert.deepEqual(
    events.filter((event) => event.type === 'player.downed').map((event) => event.cause),
    ['self-trail', 'self-trail'],
  );
  assert.equal(run.team.reserves, 2);
});

test('a genuine diagonal corner approach still contacts the rounded boundary before crossing it', () => {
  const run = geometricBoard(false);
  const body = { x: 19.5, y: 11.5, radius: 0.18 };
  const velocity = { x: 8, y: 8 };
  const expected = (0.5 - body.radius / Math.SQRT2) / 8;
  near(playerWallContact(run, body, velocity, 0.1).time, expected);
  near(enemyWallContact(run, { ...body, vx: velocity.x, vy: velocity.y }, 0.1).time, expected);
});

for (const horizontal of [false, true]) {
  test(`${horizontal ? 'horizontal' : 'vertical'} tile seams permit exact tangency but block inward motion`, () => {
    const run = geometricBoard(horizontal);
    const body = horizontal
      ? { x: 20.5, y: 11.82, radius: 0.18 }
      : { x: 19.82, y: 12.5, radius: 0.18 };
    const tangent = horizontal ? { x: 8, y: 0 } : { x: 0, y: 8 };
    assert.equal(playerWallContact(run, body, tangent, 0.5), null);
    assert.equal(enemyWallContact(run, { ...body, vx: tangent.x, vy: tangent.y }, 0.5), null);
    const inward = horizontal ? { x: 0, y: 8 } : { x: 8, y: 0 };
    near(playerWallContact(run, body, inward, 0.5).time, 0);
    const diagonal = { x: 8, y: 8 };
    assert.ok(playerWallContact(run, body, diagonal, 0.5));
  });
}

test('public steering can slide past a shielded core corner and bank while the core remains solid', () => {
  const source = {
    version: 'revealline-coop-level.v1',
    id: 'shield-slide',
    revision: 1,
    name: 'Shield slide',
    width: 72,
    height: 36,
    spawns: [
      { x: 35.5, y: 0.5 },
      { x: 70.5, y: 35.5 },
    ],
    enemies: [{ id: 'retention', type: 'drifter', x: 60.5, y: 28.5, vx: 0, vy: 0, radius: 0.2 }],
    strongholds: [
      {
        id: 'relay',
        core: { x: 35.5, y: 6.5 },
        anchors: [
          { x: 23.5, y: 11.5 },
          { x: 48.5, y: 11.5 },
        ],
      },
    ],
    goal: { cores: ['relay'] },
  };
  const run = startCoop(createCoop(source));
  const events = advance(run, ['down', null], 100);
  near(run.players[0].x, 35.5);
  near(run.players[0].y, 6 - run.players[0].radius);
  assert.equal(run.strongholds[0].shielded, true);
  events.push(...advance(run, ['left', null], 12));
  near(run.players[0].x, 34.7);
  near(run.players[0].y, 5.82);
  events.push(...advance(run, ['up', null], 90));
  assert.ok(events.some((event) => event.type === 'cut.closed'));
  assert.equal(events.filter((event) => event.type === 'player.downed').length, 0);
  assert.equal(run.strongholds[0].shielded, true);
  assert.equal(run.cells[6 * 72 + 35], FIELD);
});
