import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, getSummary, validateLevel, FIXED_DT, CELL } from '../core/index.mjs';
import { combatContacts, planCombatMotion } from '../core/combat-motion.mjs';
import { eliminateCombatPatrol, captureCombatPatrols } from '../core/combat-patrols.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  exportReplay,
  verifyReplay,
  recordInput,
} from '../replay.mjs';
import { prepareHuntLevel } from '../hunt/level.mjs';
import {
  chooseHuntRunnerHeading,
  validateHuntDefinition,
  validateHuntReachability,
  HUNT_RUNNER_SENSE_RADIUS,
} from '../hunt/rules.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { CLASSES } from '../core/registry.mjs';
import { combatLevel, combat, patrol } from './helpers/combat-fixture.mjs';

function huntLevel(role = 'scout', mode = 'bonus') {
  const source = combatLevel(role);
  const actors = structuredClone(source.classic.combatPatrols.actors);
  if (role === 'scout') actors[0].turnTicks = 60;
  return prepareHuntLevel(source, {
    id: 'humanoid-hunt-fixture',
    revision: '1',
    actors,
    hunt: {
      version: 'humanoid-hunt.v1',
      mode,
      quota: mode === 'bonus' ? 0 : 1,
      targets: [{ id: actors[0].id, kind: role === 'scout' ? 'runner' : 'guard' }],
    },
  });
}

test('hunt editions are explicit successors; historical combat keeps its exact authority shape', () => {
  const old = combatLevel('scout');
  const run = createRun(old);
  assert.equal(run.ruleset, 'xonix-core.v6');
  assert.equal(Object.hasOwn(run.classic, 'hunt'), false);
  assert.equal(Object.hasOwn(getSummary(run), 'hunt'), false);
  old.classic.hunt = huntLevel().classic.hunt;
  assert.equal(validateLevel(old).valid, false);
  const current = huntLevel();
  assert.equal(createRun(current).ruleset, 'xonix-core.v10');
  delete current.classic.hunt;
  assert.equal(validateLevel(current).valid, false);
});

test('quotas, role references, fixed runner cadence and total actor budget reject impossible variants', () => {
  for (const mutate of [
    (level) => {
      level.classic.hunt.quota = 2;
    },
    (level) => {
      level.classic.hunt.targets[0].id = 'missing';
    },
    (level) => {
      level.classic.hunt.targets[0].kind = 'guard';
    },
    (level) => {
      level.classic.combatPatrols.actors[0].turnTicks = 120;
    },
    (level) => {
      level.classic.combatPatrols.enabled = false;
    },
  ]) {
    const level = huntLevel('scout', 'hunt');
    mutate(level);
    assert.equal(validateLevel(level).valid, false);
  }
  const level = huntLevel();
  assert.throws(() =>
    validateHuntDefinition(level.classic.hunt, level.classic.combatPatrols.actors, {
      ordinaryCount: 24,
    }),
  );
  let read = false;
  assert.throws(() =>
    validateHuntDefinition(
      {
        get version() {
          read = true;
          return 'humanoid-hunt.v1';
        },
      },
      [],
    ),
  );
  assert.equal(read, false);
});

function safeEdgeContacts(run, { wall = false, shot = false } = {}) {
  Object.assign(run.player, { x: 9.95, y: 18.5, cutting: false, graceUntil: 0 });
  Object.assign(patrol(run), { x: 10.22, y: 18.5, vx: 0, vy: 0 });
  run.cells[18 * run.width + 9] = wall ? CELL.WALL : CELL.SAFE;
  if (shot)
    combat(run).projectiles.push({
      id: 'shot',
      actorId: patrol(run).id,
      x: 10.1,
      y: 18.5,
      vx: 0,
      vy: 0,
      expiresAtTick: 999,
    });
  return combatContacts(
    run,
    [{ x1: 9.95, y1: 18.5, x2: 9.95, y2: 18.5, t0: 0, t1: FIXED_DT }],
    planCombatMotion(run, FIXED_DT),
    { started: null, closure: null },
    FIXED_DT,
  );
}

test('safe-edge contact removes hunt targets while safe-ground shots retain exposure gating', () => {
  const run = createRun(huntLevel('sentry'));
  const hits = safeEdgeContacts(run, { shot: true });
  assert.equal(hits.rams.length, 1);
  assert.equal(hits.failure, null);
  assert.equal(safeEdgeContacts(createRun(combatLevel('scout'))).rams.length, 0);
});

test('hunt touch cannot pass through a wall and frozen targets remain removable', () => {
  assert.equal(safeEdgeContacts(createRun(huntLevel()), { wall: true }).rams.length, 0);
  const run = createRun(huntLevel());
  run.classic.effects['enemy-freeze'] = { from: 0, until: 100 };
  assert.equal(safeEdgeContacts(run).rams.length, 1);
});

test('accepted elimination increments separate hunt score once and leaves territory score untouched', () => {
  for (const [cause, points] of [
    ['ram', 100],
    ['capture', 50],
  ]) {
    const run = createRun(huntLevel());
    const score = run.score;
    eliminateCombatPatrol(run, patrol(run), cause);
    eliminateCombatPatrol(run, patrol(run), cause);
    assert.equal(run.classic.hunt.kills, 1);
    assert.equal(run.classic.hunt.score, points);
    assert.equal(run.score, score);
    assert.equal(combatView(run).eliminations[0].kind, 'runner');
    assert.equal(combatView(run).hunt.score, points);
  }
});

test('a captured target counts toward the quota and cannot also earn the contact bonus', () => {
  const run = createRun(huntLevel('scout', 'capture-quota'));
  const actor = patrol(run);
  run.cells[Math.floor(actor.y) * run.width + Math.floor(actor.x)] = CELL.SAFE;
  captureCombatPatrols(run);
  eliminateCombatPatrol(run, actor, 'ram');
  assert.equal(run.classic.hunt.kills, 1);
  assert.equal(run.classic.hunt.captureKills, 1);
  assert.equal(run.classic.hunt.score, 50);
});

test('dedicated hunt ends on quota alone; bonus and capture-quota retain coverage requirements', () => {
  for (const mode of ['bonus', 'capture-quota', 'hunt']) {
    const level = huntLevel('scout', mode);
    level.objectives = [
      { id: 'still-optional-in-hunt', x: 30.5, y: 20.5, required: true, hidden: false },
    ];
    const run = createRun(level);
    eliminateCombatPatrol(run, patrol(run), 'ram');
    stepRun(run, { direction: null }, FIXED_DT);
    assert.equal(run.status, mode === 'hunt' ? 'won' : 'running');
    assert.equal(run.coverage, 0);
  }
});

test('runner steering uses six-cell detection, stable tie order and geometric clearance', () => {
  assert.equal(HUNT_RUNNER_SENSE_RADIUS, 6);
  const input = {
    actor: { x: 10, y: 10 },
    players: [{ x: 8, y: 10 }],
    speed: 4,
    rotation: 0,
    clearance: () => 1,
  };
  assert.deepEqual(chooseHuntRunnerHeading(input), [1, 0]);
  assert.deepEqual(chooseHuntRunnerHeading(input), chooseHuntRunnerHeading(input));
  assert.deepEqual(chooseHuntRunnerHeading({ ...input, players: [{ x: 3, y: 10 }] }), [0, -1]);
  assert.notDeepEqual(
    chooseHuntRunnerHeading({ ...input, clearance: (_from, end) => (end.x > 10 ? 0 : 1) }),
    [1, 0],
  );
});

test('successor replay includes exact hunt recipe and deterministic runner continuation', () => {
  const level = huntLevel();
  const run = createRun(level);
  const recorder = createRecorder(level);
  for (let tick = 0; tick < 130; tick++) {
    recordInput(recorder, { direction: null });
    stepRun(run, { direction: null }, FIXED_DT);
  }
  const replay = exportReplay(recorder, run);
  assert.equal(replay.version, 'xonix-replay.v11');
  assert.equal(replay.checkpoint.algorithm, 'fnv1a64-state-v10');
  const verified = verifyReplay(replay);
  assert.equal(verified.match, true);
  assert.deepEqual(authoritativeCheckpoint(verified.state), authoritativeCheckpoint(run));
});

test('successor runner speed preserves the ratio at the maximum craft speed and admits the exact roster', () => {
  const level = huntLevel();
  level.rules.moveSpeed = 20;
  level.classic.combatPatrols.actors[0].speed = 14;
  assert.equal(validateLevel(level).valid, true);
  assert.equal(combatView(createRun(level)).valid, true);
  const historical = combatLevel('scout');
  historical.classic.combatPatrols.actors[0].speed = 14;
  assert.equal(validateLevel(historical).valid, false);
  const recipes = structuredClone(CLASSES);
  recipes[0].moveSpeedMultiplier = 0.5;
  assert.throws(() => createRun(level, { classRecipes: recipes }), /70%/);
  level.classic.combatPatrols.actors[0].speed = 7;
  assert.equal(
    createRun(level, { classRecipes: recipes }).classRecipes[0].moveSpeedMultiplier,
    0.5,
  );
});

test('Bonus mastery targets need a dry route; relay unlock dependencies cannot unlock themselves', () => {
  const cells = Array(25).fill(CELL.WALL);
  for (const index of [10, 11, 13, 14]) cells[index] = CELL.FIELD;
  cells[10] = CELL.SAFE;
  const definition = { quota: 0, targets: [{ id: 'runner' }] },
    actors = [{ id: 'runner', x: 3.5, y: 2.5 }],
    geometry = { width: 5, height: 5, cells, spawns: [{ x: 0.5, y: 2.5 }] };
  assert.throws(() => validateHuntReachability(definition, actors, geometry), /Every Hunt target/);
  assert.throws(
    () =>
      validateHuntReachability(definition, actors, {
        ...geometry,
        gates: [{ cells: [12], objective: { x: 3.5, y: 2.5 } }],
      }),
    /Every Hunt target/,
  );
  assert.deepEqual(
    validateHuntReachability(definition, actors, {
      ...geometry,
      gates: [{ cells: [12], objective: { x: 1.5, y: 2.5 } }],
    }),
    ['runner'],
  );
  const terrain = Array(25).fill(0);
  cells[12] = CELL.FIELD;
  terrain[12] = 2;
  assert.throws(
    () => validateHuntReachability(definition, actors, { ...geometry, terrain }),
    /Every Hunt target/,
  );
  cells[12] = CELL.SAFE;
  assert.deepEqual(validateHuntReachability(definition, actors, { ...geometry, terrain }), [
    'runner',
  ]);
});
