import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, CELL, CLASSES } from '../core/index.mjs';
import { authoritativeCheckpoint, createRecorder } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { classicDomainHit } from '../core/classic-motion.mjs';
import { eliminateCombatPatrol } from '../core/combat-patrols.mjs';
import { combatLevel, patrol, combat, ticks } from './helpers/combat-fixture.mjs';

const fresh = () => createRun(combatLevel(), { seed: 7 });
function warning() {
  const run = fresh();
  ticks(run, 300, 'right');
  assert.equal(patrol(run).phase, 'warning');
  return run;
}
function shot() {
  const run = fresh();
  ticks(run, 380, 'right');
  assert.equal(combat(run).projectiles.length, 1);
  return run;
}
function invalid(run, label) {
  const view = combatView(run);
  assert.equal(view?.valid, false, label);
  assert.equal(typeof view.error, 'string');
  assert(view.error.length > 0);
  assert(Object.isFrozen(view));
  assert.deepEqual(Object.keys(view).sort(), ['error', 'valid']);
}

test('combat projection is exact, owned, deeply frozen, and does not expose private simulation state', () => {
  const run = fresh(),
    before = structuredClone(run),
    checkpoint = authoritativeCheckpoint(run);
  const view = combatView(run);
  assert.deepEqual(view, {
    valid: true,
    tick: 0,
    actorTick: 0,
    status: 'running',
    frozen: false,
    actors: [
      {
        id: 'patrol',
        role: 'sentry',
        x: 30.5,
        y: 12.5,
        vx: 0.25,
        vy: 0,
        radius: 0.22,
        phase: 'cooldown',
        warningTicks: 0,
        warningTotal: 0,
        aim: null,
        rayEnd: null,
      },
    ],
    projectiles: [],
    eliminations: [],
  });
  assert(Object.isFrozen(view) && Object.isFrozen(view.actors) && Object.isFrozen(view.actors[0]));
  assert(Object.isFrozen(view.projectiles) && Object.isFrozen(view.eliminations));
  assert.throws(() => {
    view.actors[0].x = 5;
  }, TypeError);
  assert.throws(() => view.actors.push({}), TypeError);
  assert.doesNotMatch(JSON.stringify(view), /random|seed|nextTurn|nextScan|nextShot/);
  assert.deepEqual(structuredClone(run), before);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  patrol(run).x += 1;
  assert.equal(view.actors[0].x, 30.5);
});

test('absent and disabled descriptors are null; active empty populations remain valid', () => {
  for (const mode of ['absent', 'disabled', 'empty']) {
    const level = combatLevel();
    if (mode === 'absent') delete level.classic.combatPatrols;
    if (mode === 'disabled') level.classic.combatPatrols.enabled = false;
    if (mode === 'empty') level.classic.combatPatrols.actors = [];
    const run = createRun(level),
      before = authoritativeCheckpoint(run);
    const view = combatView(run);
    if (mode === 'empty') {
      assert.equal(view.valid, true);
      assert.deepEqual(view.actors, []);
    } else assert.equal(view, null);
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
  assert.equal(combatView(null), null);
});

test('only matching foundation-aware level/ruleset pairs are accepted', () => {
  for (let version = 5; version <= 8; version++) {
    const level = combatLevel();
    level.version = `xonix-level.v${version}`;
    if (version >= 6) level.relayGates = { version: 'relay-gates.v1', gates: [] };
    if (version >= 7) level.directionalFields = { version: 'directional-fields.v1', zones: [] };
    const run = createRun(level);
    assert.equal(combatView(run).valid, true);
    run.level.version = `xonix-level.v${version === 8 ? 5 : version + 1}`;
    invalid(run, 'mismatched schema pair');
  }
  for (const ruleset of [
    'xonix-core.v2',
    'xonix-core.v5',
    'xonix-core.v10',
    'revealline-coop.v4',
  ]) {
    const run = fresh();
    run.ruleset = ruleset;
    invalid(run, ruleset);
  }
});

test('warning progress, stationary phases, pause and freeze use authoritative actor ticks only', () => {
  const run = warning(),
    actor = patrol(run),
    before = authoritativeCheckpoint(run);
  const view = combatView(run),
    entry = view.actors[0];
  assert.equal(view.valid, true);
  assert.equal(entry.warningTotal, 120);
  assert.equal(entry.warningTicks, 60);
  assert.deepEqual(entry.aim, actor.aim);
  assert.notEqual(entry.aim, actor.aim);
  assert(Object.isFrozen(entry.aim) && Object.isFrozen(entry.rayEnd));
  assert.equal(entry.vx, 0);
  assert.equal(entry.vy, 0);
  for (let n = 0; n < 20; n++) assert.deepEqual(combatView(run), view); // Paused: no step calls.
  assert.deepEqual(authoritativeCheckpoint(run), before);
  ticks(run, 1, 'right');
  assert.equal(combatView(run).actors[0].warningTicks, 59);
  run.classic.effects['enemy-freeze'] = { from: run.tick, until: run.tick + 100 };
  const frozen = combatView(run);
  assert.equal(frozen.frozen, true);
  ticks(run, 10);
  assert.equal(combatView(run).actorTick, frozen.actorTick);
  assert.equal(combatView(run).actors[0].warningTicks, frozen.actors[0].warningTicks);
  assert.deepEqual(combatView(run).actors, frozen.actors);
  const recovery = combatView(shot()).actors[0];
  assert.equal(recovery.phase, 'recovery');
  assert.equal(recovery.vx, 0);
  assert.equal(recovery.aim, null);
  assert.equal(recovery.rayEnd, null);
});

test('warning ray passes its locked point and clips with the existing projectile radius envelope', () => {
  // Synthetic geometry probes: they inspect current ray geometry, not future outcomes.
  const run = warning(),
    actor = patrol(run);
  Object.assign(actor, { x: 8.5, y: 8.5, aim: { x: 10.5, y: 8.5 } });
  assert.deepEqual(combatView(run).actors[0].rayEnd, { x: 32.5, y: 8.5 });
  run.cells[8 * 72 + 20] = CELL.WALL;
  assert(Math.abs(combatView(run).actors[0].rayEnd.x - 19.9) < 1e-8);
  run.cells[8 * 72 + 20] = CELL.SAFE;
  assert(Math.abs(combatView(run).actors[0].rayEnd.x - 19.9) < 1e-8);
  run.cells[8 * 72 + 20] = CELL.FIELD;
  actor.aim = { x: 10.5, y: 9.5 };
  run.cells[10 * 72 + 11] = CELL.WALL;
  const length = Math.hypot(2, 1),
    end = { x: 8.5 + 48 / length, y: 8.5 + 24 / length };
  const radiusHit = classicDomainHit(run, actor, end, 0.1, CELL.FIELD);
  const centerHit = classicDomainHit(run, actor, end, 0, CELL.FIELD);
  assert(radiusHit.t < centerHit.t);
  const view = combatView(run);
  assert.equal(view.valid, true);
  assert(Math.abs(view.actors[0].rayEnd.x - (actor.x + (end.x - actor.x) * radiusHit.t)) < 1e-8);
  assert(Math.abs(view.actors[0].rayEnd.y - 9.9) < 1e-8);
  Object.assign(actor, { x: 69.5, y: 8.5, aim: { x: 70.5, y: 8.5 } });
  assert(Math.abs(combatView(run).actors[0].rayEnd.x - 70.9) < 1e-8);
});

test('projectile projection preserves direction and stays visible during freeze while actors use actual motion', () => {
  const run = shot(),
    source = combat(run).projectiles[0],
    view = combatView(run);
  assert.equal(view.valid, true);
  assert.deepEqual(view.projectiles[0], {
    id: source.id,
    actorId: source.actorId,
    x: source.x,
    y: source.y,
    vx: source.vx,
    vy: source.vy,
    radius: 0.1,
  });
  assert(Object.isFrozen(view.projectiles[0]));
  run.classic.effects['enemy-freeze'] = { from: run.tick, until: run.tick + 50 };
  ticks(run, 5);
  const frozen = combatView(run);
  assert.equal(frozen.frozen, true);
  assert.deepEqual(frozen.projectiles, view.projectiles);
  const scout = createRun(combatLevel('scout'));
  scout.classic.effects['enemy-slow'] = { from: 0, until: 100 };
  assert.equal(combatView(scout).actors[0].vx, 0.125);
  scout.classic.effects['enemy-freeze'] = { from: 0, until: 100 };
  assert.equal(combatView(scout).actors[0].vx, 0);
});

test('eliminations project event positions once and terminal views retain inert records', () => {
  for (const cause of ['ram', 'capture']) {
    const run = fresh();
    eliminateCombatPatrol(run, patrol(run), cause);
    const view = combatView(run);
    assert.equal(view.valid, true);
    assert.deepEqual(view.actors, []);
    assert.deepEqual(view.eliminations, [{ id: 'patrol', cause, x: 30.5, y: 12.5, tick: 0 }]);
    assert(Object.isFrozen(view.eliminations[0]));
    for (const status of ['won', 'lost']) {
      run.status = status;
      assert.deepEqual(combatView(run).eliminations, view.eliminations);
      assert.equal(combatView(run).status, status);
    }
  }
  const terminal = fresh();
  terminal.status = 'won';
  assert.equal(
    combatView(terminal).actors.length,
    1,
    'Winning need not eliminate every optional actor.',
  );
  assert.equal(combatView(terminal).actors[0].vx, 0);
});

test('a real winning closure at the exact recovery deadline preserves a valid static terminal actor', () => {
  const level = combatLevel();
  // Public-input route: fire at 360, recover until 846, close at 846.
  level.classic.combatPatrols.actors[0].recoveryTicks = 486;
  const run = createRun(level);
  ticks(run, 1000, 'right');
  assert.equal(run.status, 'won');
  assert.equal(run.tick, 846);
  assert.equal(patrol(run).phase, 'recovery');
  assert.equal(patrol(run).recoveryUntil, run.classic.actorTick);
  const view = combatView(run);
  assert.equal(view.valid, true);
  assert.equal(view.actors.length, 1);
  assert.equal(view.actors[0].vx, 0);
  assert.deepEqual(view.projectiles, []);
  run.status = 'running';
  invalid(run, 'Expired recovery is not a valid post-AI running state.');
});

test('malformed active descriptor, actor, clocks and geometry fail visibly instead of hiding hazards', () => {
  for (const change of [
    (r) => {
      r.level.classic.combatPatrols = null;
    },
    (r) => {
      r.level.classic.combatPatrols.version = 'future';
    },
    (r) => {
      r.level.classic.combatPatrols.enabled = 'yes';
    },
    (r) => {
      r.classic.combatPatrols = undefined;
    },
    (r) => {
      combat(r).version = 'future';
    },
    (r) => {
      combat(r).actors = [];
    },
    (r) => {
      combat(r).actors.push({ ...patrol(r) });
    },
    (r) => {
      patrol(r).id = 'unknown';
    },
    (r) => {
      patrol(r).role = 'scout';
    },
    (r) => {
      patrol(r).alive = false;
    },
    (r) => {
      patrol(r).phase = 'eliminated';
    },
    (r) => {
      patrol(r).x = Infinity;
    },
    (r) => {
      patrol(r).y = -1;
    },
    (r) => {
      patrol(r).x = 72.5;
    },
    (r) => {
      patrol(r).x = 0.5;
    },
    (r) => {
      patrol(r).vx = NaN;
    },
    (r) => {
      patrol(r).radius = 1;
    },
    (r) => {
      patrol(r).warningUntil = 10;
    },
    (r) => {
      r.classic.actorTick = r.tick + 1;
    },
    (r) => {
      r.classic.actorTick = -1;
    },
    (r) => {
      r.tick = 0.5;
    },
    (r) => {
      r.status = 'future';
    },
    (r) => {
      r.width = 48;
    },
    (r) => {
      r.cells = new Uint8Array(5);
    },
    (r) => {
      r.cells = Array.from(r.cells);
    },
    (r) => {
      r.cells[100] = 3;
    },
    (r) => {
      r.classic.effects['enemy-freeze'].until = Infinity;
    },
    (r) => {
      combat(r).actors.length = 2;
    },
    (r) => {
      combat(r).projectiles.length = 1;
    },
    (r) => {
      r.level.classic.combatPatrols.actors.length = 2;
    },
    (r) => {
      r.level.classic.combatPatrols.actors = Array(25).fill(
        r.level.classic.combatPatrols.actors[0],
      );
    },
  ]) {
    const run = fresh();
    change(run);
    invalid(run, change.toString());
  }
  for (const change of [
    (r) => {
      patrol(r).warningUntil = r.classic.actorTick;
    },
    (r) => {
      patrol(r).warningUntil = r.classic.actorTick + 121;
    },
    (r) => {
      patrol(r).aim = null;
    },
    (r) => {
      patrol(r).aim = { x: patrol(r).x, y: patrol(r).y };
    },
    (r) => {
      patrol(r).recoveryUntil = r.classic.actorTick + 5;
    },
    (r) => {
      r.level.classic.combatPatrols.actors[0].warningTicks = 1;
    },
  ]) {
    const run = warning();
    change(run);
    invalid(run, change.toString());
  }
});

test('projectile and elimination ownership, capacities and live/dead phases are validated', () => {
  for (const change of [
    (r) => {
      combat(r).projectiles[0].actorId = 'unknown';
    },
    (r) => {
      combat(r).projectiles[0].x = 100;
    },
    (r) => {
      combat(r).projectiles[0].vx = Infinity;
    },
    (r) => {
      combat(r).projectiles[0].expiresAtTick = r.classic.actorTick;
    },
    (r) => {
      combat(r).projectiles.push({ ...combat(r).projectiles[0] });
    },
    (r) => {
      combat(r).projectiles = Array(9).fill(combat(r).projectiles[0]);
    },
  ]) {
    const run = shot();
    change(run);
    invalid(run, change.toString());
  }
  for (const change of [
    (r) => {
      combat(r).eliminations[0].id = 'unknown';
    },
    (r) => {
      combat(r).eliminations[0].cause = 'bonus';
    },
    (r) => {
      combat(r).eliminations[0].tick = r.tick + 1;
    },
    (r) => {
      combat(r).eliminations[0].x++;
    },
    (r) => {
      patrol(r).alive = true;
      patrol(r).phase = 'cooldown';
    },
    (r) => {
      combat(r).eliminations = [];
    },
    (r) => {
      combat(r).eliminations.push({ ...combat(r).eliminations[0] });
    },
    (r) => {
      combat(r).eliminations = Array(25).fill(combat(r).eliminations[0]);
    },
  ]) {
    const run = fresh();
    eliminateCombatPatrol(run, patrol(run), 'ram');
    change(run);
    invalid(run, change.toString());
  }
});

test('maximum valid actor/elimination populations remain bounded and a ninth sentry is rejected', () => {
  const level = combatLevel(),
    sentry = level.classic.combatPatrols.actors[0];
  const scout = combatLevel('scout').classic.combatPatrols.actors[0];
  level.classic.combatPatrols.actors = Array.from({ length: 24 }, (_, i) => ({
    ...(i < 8 ? sentry : scout),
    id: `patrol-${i}`,
    x: 4.5 + i,
    y: 10.5,
  }));
  const run = createRun(level);
  assert.equal(combatView(run).actors.length, 24);
  for (const actor of combat(run).actors) eliminateCombatPatrol(run, actor, 'capture');
  const view = combatView(run);
  assert.equal(view.valid, true);
  assert.equal(view.actors.length, 0);
  assert.equal(view.eliminations.length, 24);
  run.level.classic.combatPatrols.actors[8] = { ...sentry, id: 'patrol-8' };
  invalid(run, 'ninth sentry');
});

test('accessors on nested descriptors, state, IDs, arrays and private fields are never executed', () => {
  for (const locate of [
    (r) => [r, 'ruleset'],
    (r) => [r, 'cells'],
    (r) => [r.level, 'classic'],
    (r) => [r.level.classic.combatPatrols, 'enabled'],
    (r) => [r.level.classic.combatPatrols.actors[0], 'warningTicks'],
    (r) => [r.classic, 'actorTick'],
    (r) => [combat(r), 'actors'],
    (r) => [combat(r).actors, '0'],
    (r) => [patrol(r), 'id'],
    (r) => [patrol(r), 'x'],
    (r) => [patrol(r), 'random'],
    (r) => [r.classic.effects['enemy-freeze'], 'until'],
  ]) {
    const run = fresh();
    let invoked = 0;
    const [target, key] = locate(run);
    Object.defineProperty(target, key, {
      enumerable: true,
      get() {
        invoked++;
        throw new Error('Never execute');
      },
    });
    invalid(run, locate.toString());
    assert.equal(invoked, 0);
  }
  const run = fresh();
  let coerced = 0;
  run.ruleset = {
    toString() {
      coerced++;
      return 'xonix-core.v6';
    },
  };
  invalid(run, 'schema values must not invoke conversion hooks');
  assert.equal(coerced, 0);
});

test('suspend/restore reconstructs warning, shot and elimination projections without event replay', async () => {
  for (const [role, count] of [
    ['sentry', 300],
    ['sentry', 380],
    ['scout', 150],
  ]) {
    const level = combatLevel(role),
      options = { seed: 7 };
    const run = createRun(level, options),
      recorder = createRecorder(level, options);
    ticks(run, count, 'right', recorder);
    const campaign = {
      version: 'xonix-campaign.v1',
      id: 'combat-view-save',
      revision: '1',
      levels: [level],
      classRecipes: CLASSES,
    };
    const key = campaignKey(campaign);
    const saved = suspendSession({
      run,
      recorder,
      campaignKey: key,
      themeId: 'fpv',
      bodyId: 'quad',
      runId: 'combat-view-save',
      continuation: { direction: 'right' },
    });
    const restored = await restoreSession(saved, { campaign, campaignKey: key });
    const expected = combatView(run);
    assert.equal(expected.valid, true);
    if (role === 'scout') assert.equal(expected.eliminations.length, 1);
    const before = structuredClone(restored.run);
    assert.deepEqual(combatView(restored.run), expected);
    assert.deepEqual(structuredClone(restored.run), before);
    assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  }
});
