import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, CELL, releaseInputs } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  updateCombatPatrols,
  clearCombatPatrols,
  captureCombatPatrols,
  eliminateCombatPatrol,
  expireCombatProjectiles,
} from '../core/combat-patrols.mjs';
import {
  planCombatMotion,
  combatContacts,
  advanceCombatMotion,
  finishCombatMotion,
} from '../core/combat-motion.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import { combatLevel, patrol, combat, ticks } from './helpers/combat-fixture.mjs';

const actorClock = (run, n) => {
  run.classic.actorTick = n;
  updateCombatPatrols(run);
};
const exposed = () => {
  const run = createRun(combatLevel());
  Object.assign(run.player, { x: 20.5, y: 18.5, cutting: true, graceUntil: 0 });
  return run;
};
const shot = (run, overrides = {}) => ({
  id: 'test-shot',
  actorId: patrol(run).id,
  x: 10.5,
  y: 18.5,
  vx: 8,
  vy: 0,
  expiresAtTick: 1000,
  ...overrides,
});

test('absent and disabled descriptors create no runtime population or random draws', () => {
  const level = combatLevel(),
    off = structuredClone(level),
    absent = structuredClone(level);
  off.classic.combatPatrols.enabled = false;
  delete absent.classic.combatPatrols;
  const a = createRun(absent),
    b = createRun(off);
  ticks(a, 300);
  ticks(b, 300);
  assert.equal(a.classic.combatPatrols, undefined);
  assert.equal(b.classic.combatPatrols, undefined);
  assert.deepEqual(a.classic, b.classic);
  assert.notEqual(authoritativeCheckpoint(a).hash, authoritativeCheckpoint(b).hash);
  assert.equal(
    b.events.some((e) => e.type.startsWith('combat.')),
    false,
  );
});

test('private stable-ID random streams ignore actor input order and preserve exact replay state', () => {
  const level = combatLevel('scout');
  const first = level.classic.combatPatrols.actors[0];
  first.turnTicks = 30;
  level.classic.combatPatrols.actors.push({ ...first, id: 'second', x: 20.5, y: 25.5 });
  const reverse = structuredClone(level);
  reverse.classic.combatPatrols.actors.reverse();
  const a = createRun(level, { seed: 8 }),
    b = createRun(reverse, { seed: 8 });
  const c = createRun(level, { seed: 9 });
  ticks(a, 600);
  ticks(b, 600);
  ticks(c, 600);
  assert.deepEqual(combat(a), combat(b));
  assert.notEqual(patrol(a).random, patrol(c).random);
  assert.equal(a.enemies.length, 1);
  const expected = authoritativeCheckpoint(a);
  patrol(a).random ^= 1;
  assert.notEqual(authoritativeCheckpoint(a).hash, expected.hash);
});

test('diagonal speed is normalized and resolved exactly once; wall reflections stay legal', () => {
  const level = combatLevel('scout');
  Object.assign(level.classic.combatPatrols.actors[0], {
    headingX: 1,
    headingY: 1,
    speed: 8,
    x: 69.5,
    y: 33.5,
  });
  const run = createRun(level);
  assert(Math.abs(Math.hypot(patrol(run).vx, patrol(run).vy) - 8) < 1e-12);
  for (let n = 0; n < 1500; n++) {
    ticks(run, 1);
    assert(fitsClassicDomain(run, patrol(run), patrol(run).radius, CELL.FIELD));
  }
  assert.equal(combat(run).eliminations.length, 0);
});

test('sentry opening, failed scan, locked aim, warning, recovery and rest have exact tick origins', () => {
  const run = exposed(),
    actor = patrol(run);
  actorClock(run, 239);
  assert.equal(actor.phase, 'cooldown');
  actorClock(run, 240);
  assert.equal(actor.phase, 'warning');
  assert.equal(actor.warningUntil, 360);
  assert.deepEqual(actor.aim, { x: 20.5, y: 18.5 });
  const random = actor.random;
  run.player.x = 25.5;
  actorClock(run, 359);
  assert.equal(combat(run).projectiles.length, 0);
  actorClock(run, 360);
  assert.equal(actor.phase, 'recovery');
  assert.equal(actor.recoveryUntil, 480);
  assert.equal(actor.random, random);
  assert.equal(combat(run).projectiles.length, 1);
  const bullet = combat(run).projectiles[0];
  assert.equal(bullet.x, actor.x);
  assert.equal(bullet.expiresAtTick, 720);
  assert(bullet.vx < 0 && bullet.vy > 0);
  actorClock(run, 479);
  assert.equal(actor.phase, 'recovery');
  actorClock(run, 480);
  assert.equal(actor.phase, 'cooldown');
  assert.equal(actor.nextScanTick, 840);
  run.player.cutting = false;
  actorClock(run, 840);
  assert.equal(actor.nextScanTick, 870);
  run.player.cutting = true;
  actorClock(run, 869);
  assert.equal(actor.phase, 'cooldown');
  actorClock(run, 870);
  assert.equal(actor.phase, 'warning');
});

test('warning cancels on return or occlusion, unrelated remote fill does not cancel', () => {
  for (const reason of ['return', 'occlusion', 'remote']) {
    const run = exposed();
    actorClock(run, 240);
    if (reason === 'return') run.player.cutting = false;
    else
      run.cells[
        (reason === 'occlusion' ? 15 : 30) * run.width + (reason === 'occlusion' ? 25 : 60)
      ] = CELL.SAFE;
    captureCombatPatrols(run);
    assert.equal(patrol(run).phase, reason === 'remote' ? 'warning' : 'cooldown');
    if (reason !== 'remote') assert.equal(patrol(run).nextScanTick, 600);
  }
});

test('overdue stationary turns draw once on resume; no scan/turn catch-up bursts', () => {
  const run = exposed();
  run.level.classic.combatPatrols.actors[0].turnTicks = 30;
  patrol(run).nextTurnTick = 30;
  actorClock(run, 240);
  const rng = patrol(run).random;
  actorClock(run, 360);
  actorClock(run, 479);
  assert.equal(patrol(run).random, rng);
  actorClock(run, 480);
  assert.notEqual(patrol(run).random, rng);
  assert.equal(patrol(run).nextTurnTick, 510);
});

test('freeze pauses movement/clocks/shot damage; slow scales travel, not warning', () => {
  const run = exposed();
  actorClock(run, 240);
  combat(run).projectiles.push(shot(run));
  run.classic.effects['enemy-freeze'] = { from: 0, until: 50 };
  const before = structuredClone(combat(run));
  const clock = run.classic.actorTick;
  ticks(run, 10);
  assert.deepEqual(combat(run), before);
  assert.equal(run.classic.actorTick, clock);
  run.classic.effects['enemy-freeze'].until = 0;
  run.classic.effects['enemy-slow'] = { from: 0, until: 100 };
  const start = combat(run).projectiles[0].x;
  ticks(run, 1);
  assert(Math.abs(combat(run).projectiles[0].x - start - 4 / 120) < 1e-9);
  assert.equal(patrol(run).warningUntil, 360);
  const snapshot = authoritativeCheckpoint(run);
  releaseInputs(run);
  assert.equal(run.classic.actorTick, clock + 1);
  assert.equal(authoritativeCheckpoint(run).sections.classic, snapshot.sections.classic);
});

test('life recovery cancels threats even while frozen; elimination never respawns or scores', () => {
  const run = exposed();
  actorClock(run, 240);
  combat(run).projectiles.push(shot(run));
  run.classic.effects['enemy-freeze'] = { from: 0, until: 1000 };
  clearCombatPatrols(run, 'recovery');
  assert.equal(combat(run).projectiles.length, 0);
  assert.equal(patrol(run).phase, 'cooldown');
  assert.equal(patrol(run).nextScanTick, 600);
  const score = run.score,
    lives = run.lives;
  eliminateCombatPatrol(run, patrol(run), 'ram');
  eliminateCombatPatrol(run, patrol(run), 'capture');
  clearCombatPatrols(run, 'recovery');
  ticks(run, 100);
  assert.equal(combat(run).eliminations.length, 1);
  assert.equal(patrol(run).alive, false);
  assert.equal(run.score, score);
  assert.equal(run.lives, lives);
});

test('capture removes radius-overlapping actors, bullets and warnings, never retaining remote chambers', () => {
  const run = exposed();
  actorClock(run, 240);
  combat(run).projectiles.push(shot(run));
  const actor = patrol(run);
  // Synthetic corner-envelope fixture: same domain envelope as swept classic motion.
  actor.x = 30.9;
  actor.y = 12.9;
  run.cells[13 * run.width + 31] = CELL.SAFE;
  captureCombatPatrols(run);
  assert.equal(actor.alive, false);
  assert.equal(combat(run).projectiles.length, 0);
  assert.equal(combat(run).eliminations[0].cause, 'capture');
});

test('expiry precedes contact and terminal cleanup cannot create attacks', () => {
  const run = exposed();
  actorClock(run, 240);
  combat(run).projectiles.push(shot(run, { expiresAtTick: 240 }));
  expireCombatProjectiles(run);
  assert.equal(combat(run).projectiles.length, 0);
  assert(run.events.some((e) => e.type === 'combat.expired'));
  clearCombatPatrols(run, 'completed');
  run.status = 'won';
  actorClock(run, 1000);
  assert.equal(combat(run).projectiles.length, 0);
});

test('projectile capacity is bounded, actor-ID ordered, skipped shots enter recovery', () => {
  const level = combatLevel();
  const def = level.classic.combatPatrols.actors[0];
  level.classic.combatPatrols.actors.push({ ...def, id: 'alpha', x: 25.5, y: 10.5 });
  const run = createRun(level);
  Object.assign(run.player, { x: 20.5, y: 18.5, cutting: true, graceUntil: 0 });
  actorClock(run, 240);
  for (let n = 0; n < 7; n++) combat(run).projectiles.push(shot(run, { id: `existing-${n}` }));
  actorClock(run, 360);
  assert.equal(combat(run).projectiles.length, 8);
  assert.equal(combat(run).projectiles.at(-1).actorId, 'alpha');
  assert(combat(run).actors.every((a) => a.phase === 'recovery'));
  assert(run.events.some((e) => e.type === 'combat.shotSkipped' && e.id === 'patrol'));
});

test('swept crossing rams and bullets hit between endpoints, boundary ties absorb', () => {
  const run = exposed();
  Object.assign(patrol(run), { x: 10.5, y: 18.5, vx: 0, vy: 0 });
  const paths = [{ x1: 8, y1: 18.5, x2: 13, y2: 18.5, t0: 0, t1: 1 }];
  const trace = { started: null, closure: null };
  combat(run).projectiles.push(shot(run, { x: 12.5, vx: -8 }));
  const plans = planCombatMotion(run, 1);
  const hits = combatContacts(run, paths, plans, trace, 1);
  assert(hits.rams[0].time > 0 && hits.rams[0].time < 1);
  assert(hits.failure.time > 0 && hits.failure.time < 1);
  finishCombatMotion(run, plans, hits, hits.rams[0].time, true);
  assert.equal(patrol(run).alive, true, 'fatal event suppresses tied ram');
  // Exact boundary/body tie constructed from the planned pre-existing boundary.
  run.cells[18 * run.width + 8] = CELL.SAFE;
  const p = planCombatMotion(run, 1);
  const t = p.shots[0].event.time;
  const end = p.shots[0].paths[0].x2;
  const contactX = end - (0.1 + run.rules.playerRadius);
  const atBoundary = [{ x1: contactX, y1: 18.5, x2: contactX, y2: 18.5, t0: 0, t1: 1 }];
  const tie = combatContacts(run, atBoundary, p, trace, t);
  assert.equal(tie.failure, null);
  advanceCombatMotion(run, p, t);
  finishCombatMotion(run, p, tie, t, false);
  assert.equal(combat(run).projectiles.length, 0);
});
