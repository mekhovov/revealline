import test from 'node:test';
import assert from 'node:assert/strict';
import { actorFacingRadians } from '../hunt/actor-facing.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { createRun } from '../core/index.mjs';
import { combatLevel, patrol, ticks } from './helpers/combat-fixture.mjs';

test('overhead bodies face native motion and accepted armor before a pending turn', () => {
  const actor = { x: 4, y: 4, vx: 2, vy: 0 };
  assert.equal(actorFacingRadians(actor), Math.PI / 2);
  assert.equal(actorFacingRadians({ ...actor, vx: 0, vy: -2 }), 0);
  assert.equal(actorFacingRadians({ ...actor, vy: 2 }), (Math.PI * 3) / 4);
  assert.equal(actorFacingRadians({ ...actor, aim: { x: 4, y: 8 } }), Math.PI);
  assert.equal(
    actorFacingRadians({
      ...actor,
      pursuit: { behavior: 'shield', heading: 'left', nextHeading: 'right' },
    }),
    -Math.PI / 2,
  );
});

test('ordinary successor prey faces actual diagonal/fallback movement, retaining its last heading at rest', () => {
  for (const behavior of ['patroller', 'courier', 'refuge', 'switchback', 'pair', 'runner']) {
    const actor = {
      x: 4,
      y: 4,
      vx: 2,
      vy: 2,
      pursuit: { behavior, heading: 'left', nextHeading: 'up', phase: 'fallback' },
    };
    const before = structuredClone(actor);
    assert.equal(actorFacingRadians(actor), (Math.PI * 3) / 4);
    assert.equal(actorFacingRadians({ ...actor, vx: 0, vy: 0 }), -Math.PI / 2);
    assert.deepEqual(actor, before);
  }
});

test('stationary cleared goals use authored facing without guessing from visit counts', () => {
  const actor = { x: 8, y: 4, vx: 0, vy: 0, pursuit: { cursor: 1, goal: null } };
  const definition = { x: 4, y: 4, headingX: 0, headingY: 1 };
  assert.equal(actorFacingRadians(actor, definition), Math.PI);
  assert.equal(actorFacingRadians(structuredClone(actor), definition), Math.PI);
  assert.equal(actorFacingRadians({ x: 4, y: 4, vx: 0, vy: 0 }, definition), Math.PI);
});

test('Capture retains direction before freeze suppresses displayed motion and uses locked warning aim', () => {
  const run = createRun(combatLevel(), { seed: 7 });
  const loadouts = run._loadouts;
  assert.equal(Object.getPrototypeOf(loadouts), null);
  // structuredClone discards the native null prototype of the loadout bank.
  const before = createRun(combatLevel(), { seed: 7 });
  assert.deepEqual(run, before);
  assert.equal(combatView(run).actors[0].facingRadians, Math.PI / 2);
  assert.deepEqual(run, before);
  assert.equal(run._loadouts, loadouts);
  run.classic.effects['enemy-freeze'] = { from: 0, until: 100 };
  assert.equal(combatView(run).actors[0].vx, 0);
  assert.equal(combatView(run).actors[0].facingRadians, Math.PI / 2);
  const warning = createRun(combatLevel(), { seed: 7 });
  ticks(warning, 300, 'right');
  const actor = patrol(warning);
  assert.equal(
    combatView(warning).actors[0].facingRadians,
    Math.atan2(actor.aim.y - actor.y, actor.aim.x - actor.x) + Math.PI / 2,
  );
});
