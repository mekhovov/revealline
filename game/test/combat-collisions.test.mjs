import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { releaseIsolatedCapture } from '../core/capture.mjs';
import { combatLevel, combat, patrol, ticks } from './helpers/combat-fixture.mjs';

// Synthetic sub-tick collision fixtures, not claimed as authored play routes.
function atClosure() {
  const run = createRun(combatLevel());
  Object.assign(run.player, { x: 10.5, y: 34.95, cutting: true, graceUntil: 0, direction: 'down' });
  run.cutStartedAt = 0;
  run.trail = Array.from({ length: 34 }, (_, n) => ({
    x: 10,
    y: n + 1,
    index: (n + 1) * run.width + 10,
  }));
  return run;
}
function tiedShot(run, offset = 0) {
  const r = run.rules.playerRadius + 0.1;
  const horizontal = Math.sqrt(r * r - 0.2 * 0.2);
  return {
    id: 'tied-shot',
    actorId: patrol(run).id,
    x: 10.5 + horizontal + 8 * 0.005 + offset,
    y: 34.8,
    vx: -8,
    vy: 0,
    expiresAtTick: 999,
  };
}

test('existing projectile at closure wins; newly captured ground cannot retroactively absorb it', () => {
  const run = atClosure();
  combat(run).projectiles.push(tiedShot(run));
  stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.classic.livesLost, 1);
  assert.equal(run.failureCause, 'combat-projectile');
  assert.equal(run.coverage, 0);
  assert.equal(
    run.events.some((e) => e.type === 'cut.closed'),
    false,
  );
  assert(run.events.some((e) => e.type === 'combat.impact'));
});

test('a later projectile hit is absorbed by accepted capture with no life lost', () => {
  const run = atClosure();
  combat(run).projectiles.push(tiedShot(run, 0.01));
  // Capture the projectile's footprint as well as the trail without hitting its owner.
  run.enemies[0].x = 5.5;
  stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.classic.livesLost, 0);
  assert(run.events.some((e) => e.type === 'cut.closed'));
  assert.equal(combat(run).projectiles.length, 0);
});

test('ram/capture tie emits exactly one capture elimination', () => {
  const level = combatLevel();
  level.foundations = [{ x: 1, y: 20, w: 10, h: 1 }];
  level.enemies[0].x = 5.5;
  const run = createRun(level);
  Object.assign(run.player, { x: 10.9, y: 19.95, cutting: true, graceUntil: 0, direction: 'down' });
  run.cutStartedAt = 0;
  run.trail = Array.from({ length: 19 }, (_, n) => ({
    x: 10,
    y: n + 1,
    index: (n + 1) * run.width + 10,
  }));
  // Radius fits FIELD to the platform's right. Contact first occurs at closure;
  // the keeper retains the left chamber and the patrol's right chamber fills.
  const radius = run.rules.playerRadius + patrol(run).radius;
  Object.assign(patrol(run), {
    x: 10.9 + Math.sqrt(radius * radius - 0.2 * 0.2),
    y: 20.2,
    vx: 0,
    vy: 0,
    phase: 'warning',
  });
  stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(combat(run).eliminations.length, 1);
  assert.equal(combat(run).eliminations[0].cause, 'capture');
  assert(run.events.some((e) => e.type === 'cut.closed'));
  assert.equal(run.classic.livesLost, 0);
});

test('frozen patrol can be rammed; a frozen touching shot does not damage', () => {
  const level = combatLevel('scout'),
    run = createRun(level);
  run.classic.effects['enemy-freeze'] = { from: 0, until: 500 };
  combat(run).projectiles.push({
    id: 'frozen',
    actorId: patrol(run).id,
    x: 5,
    y: 18.5,
    vx: 0,
    vy: 8,
    expiresAtTick: 999,
  });
  const events = ticks(run, 150, 'right');
  assert(events.some((e) => e.type === 'combat.eliminated' && e.cause === 'ram'));
  assert.equal(run.classic.livesLost, 0);
  assert.equal(combat(run).projectiles.length, 0, 'owner removal still runs during freeze');
});

test('already-fired contact wins its owner ram tie; a strictly earlier ram cancels the shot', () => {
  for (const offset of [0, 0.01]) {
    const run = createRun(combatLevel());
    Object.assign(run.player, { x: 10.05, y: 18.5, cutting: true, graceUntil: 0 });
    Object.assign(patrol(run), { x: 10.5, y: 18.5, vx: 0, vy: 0, phase: 'warning' });
    combat(run).projectiles.push({
      id: 'owner-tie',
      actorId: patrol(run).id,
      x: 10.38 + offset,
      y: 18.5,
      vx: 0,
      vy: 0,
      expiresAtTick: 999,
    });
    stepRun(run, { direction: 'right' }, FIXED_DT);
    assert.equal(run.classic.livesLost, offset === 0 ? 1 : 0);
    assert.equal(patrol(run).alive, offset === 0);
    assert.equal(combat(run).projectiles.length, 0);
  }
});

test('impact redeployment clears projectiles and warnings without costing a life', () => {
  const run = createRun(combatLevel(), { classId: 'impact' });
  ticks(run, 380, 'right');
  assert.equal(combat(run).projectiles.length, 1);
  stepRun(run, { direction: null, action: true }, FIXED_DT);
  assert.equal(combat(run).projectiles.length, 0);
  assert.equal(run.status, 'respawning');
  assert.equal(run.classic.livesLost, 0);
});

test('remote disconnected chamber and isolated boss release remove combat actors without retaining field', () => {
  const level = combatLevel('scout');
  level.foundations = [{ x: 35, y: 1, w: 1, h: 34 }];
  const run = createRun(level);
  // This directly exercises the shared fill transaction; not a fabricated played cut.
  releaseIsolatedCapture(run);
  assert.equal(patrol(run).alive, false);
  assert.equal(combat(run).eliminations[0].cause, 'capture');
  assert(run.coverage > 0);
  assert.equal(run.enemies.length, 1);
});
