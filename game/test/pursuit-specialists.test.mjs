import { specialistFailureCopy } from '../hunt/actor-catalog.mjs';
import { failureExplanation } from '../ui/retry-view.mjs';
import { coopFailureFeedback } from '../couch/coop-feedback.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
import { combatContacts, planCombatMotion } from '../core/combat-motion.mjs';
import { captureCombatPatrols, updateCombatPatrols } from '../core/combat-patrols.mjs';
import { prepareRunningEnemyLevel } from '../hunt/running-enemies.mjs';
import { prepareTeamRunningEnemies } from '../hunt/team-running-enemies.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { combatOwner } from '../hunt/running-enemy-definition.mjs';
import { derivePursuitGoals, updatePursuitHeading } from '../hunt/pursuit-goals.mjs';
import {
  initializePursuitSpecialist,
  protectedPursuitContact,
  specialistMotionAllowed,
} from '../hunt/pursuit-specialists.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { combatLevel } from './helpers/combat-fixture.mjs';

const population = (behavior) => [
  {
    id: 'specialist',
    x: 20.5,
    y: 18.5,
    behavior,
    waypoints: [
      { x: 25.5, y: 18.5 },
      { x: 20.5, y: 12.5 },
    ],
  },
];
function fixture(behavior = 'shield') {
  const run = createRun(
    prepareRunningEnemyLevel(combatLevel('scout'), {
      style: 'varied',
      population: population(behavior),
    }),
  );
  return {
    run,
    actor: combatOwner(run).combatPatrols.actors.find((entry) => entry.id === 'specialist'),
  };
}
function contact(run, actor, dx, dy, grace = 0) {
  Object.assign(run.player, { x: actor.x + dx, y: actor.y + dy, cutting: true, graceUntil: grace });
  actor.vx = actor.vy = 0;
  const p = run.player;
  return combatContacts(
    run,
    [{ x1: p.x, y1: p.y, x2: p.x, y2: p.y, t0: 0, t1: FIXED_DT }],
    planCombatMotion(run, FIXED_DT),
    { started: 0, closure: null },
    FIXED_DT,
  );
}

test('specialists have visible state at spawn and do not alter historical scouts', () => {
  const { actor } = fixture();
  assert.equal(actor.pursuit.behavior, 'shield');
  assert.equal(actor.pursuit.heading, 'right');
  assert.equal(fixture('brace').actor.pursuit.phase, 'rest');
  assert.equal(
    Object.hasOwn(createRun(combatLevel('scout')).classic.combatPatrols.actors[0], 'pursuit'),
    false,
  );
});

test('shield front is hazardous, exact sides and rear are exposed, protection cannot bypass armor', () => {
  const { run, actor } = fixture();
  const front = contact(run, actor, 0.2, 0);
  assert.equal(front.failure.kind, 'combat-specialist');
  assert.equal(front.rams.length, 0);
  for (const [dx, dy] of [
    [-0.2, 0],
    [0, 0.2],
    [0, -0.2],
  ]) {
    const side = contact(run, actor, dx, dy);
    assert.equal(side.failure, null);
    assert.equal(side.rams.length, 1);
  }
  const protectedFront = contact(run, actor, 0.2, 0, 99);
  assert.equal(protectedFront.failure, null);
  assert.equal(protectedFront.rams.length, 0);
  assert.equal(contact(run, actor, -0.2, 0, 99).rams.length, 1);
});

test('shield turn warning keeps its previous hazardous face until the full warning ends', () => {
  const geometry = { width: 12, height: 12, cells: new Uint8Array(144), terrain: [] };
  const actor = { id: 'shield', x: 5.5, y: 5.5, vx: 1, vy: 0, radius: 0.3, alive: true };
  const policy = {
    id: 'shield',
    behavior: 'shield',
    waypoints: [
      { x: 5.5, y: 2.5 },
      { x: 8.5, y: 2.5 },
    ],
  };
  initializePursuitSpecialist(actor, policy);
  const advance = (tick) =>
    updatePursuitHeading({
      actor,
      policy,
      actors: [actor],
      players: [],
      geometry,
      tick,
      speed: 3,
      clearance: () => 1,
    });
  advance(95);
  assert.equal(actor.pursuit.phase, 'walking');
  advance(96);
  assert.equal(actor.pursuit.phase, 'turning');
  assert.equal(actor.pursuit.nextHeading, 'up');
  advance(191);
  assert.equal(actor.pursuit.heading, 'right');
  assert.equal(protectedPursuitContact(actor, { x: 5.7, y: 5.5 }), true);
  advance(192);
  assert.equal(actor.pursuit.heading, 'up');
  assert.equal(protectedPursuitContact(actor, { x: 5.7, y: 5.5 }), false);
});

test('Brace warns for 96 ticks, bursts for 48 and recovers for 192; only warning/burst armor is closed', () => {
  const { run, actor } = fixture('brace'),
    owner = combatOwner(run);
  const phaseAt = (tick) => {
    owner.actorTick = tick;
    updateCombatPatrols(run);
    return actor.pursuit.phase;
  };
  assert.equal(phaseAt(191), 'rest');
  assert.equal(phaseAt(192), 'warning');
  assert.equal(contact(run, actor, -0.2, 0).failure.kind, 'combat-specialist');
  assert.equal(phaseAt(287), 'warning');
  assert.equal(phaseAt(288), 'burst');
  assert.equal(phaseAt(335), 'burst');
  assert.equal(phaseAt(336), 'rest');
  assert.equal(contact(run, actor, -0.2, 0).rams.length, 1);
  assert.equal(phaseAt(527), 'rest');
});

test('frozen specialist armor stays frozen and enclosure removes either armor state once', () => {
  for (const behavior of ['shield', 'brace']) {
    const { run, actor } = fixture(behavior);
    if (behavior === 'brace') {
      actor.pursuit.phase = 'warning';
      actor.pursuit.phaseUntil = 10;
    }
    const before = structuredClone(actor.pursuit);
    run.classic.effects['enemy-freeze'] = { from: 0, until: 99 };
    stepRun(run, { direction: null });
    assert.deepEqual(actor.pursuit, before);
    run.cells[Math.floor(actor.y) * run.width + Math.floor(actor.x)] = CELL.SAFE;
    captureCombatPatrols(run);
    captureCombatPatrols(run);
    assert.equal(actor.alive, false);
    assert.equal(combatOwner(run).hunt.captureKills, 1);
    assert.equal(combatOwner(run).hunt.score, 50);
  }
});

test('specialists wait at current heads and cables without reading queued inputs', () => {
  const actor = { x: 3.5, y: 3.5, radius: 0.3, pursuit: { behavior: 'shield' } },
    end = { x: 4, y: 3.5 };
  const geometry = { width: 12, trail: [] };
  assert.equal(specialistMotionAllowed(actor, end, geometry, [{ x: 4.3, y: 3.5 }]), false);
  geometry.trail = [{ index: 3 * 12 + 4 }];
  assert.equal(specialistMotionAllowed(actor, end, geometry, []), false);
  geometry.trail = [];
  assert.equal(specialistMotionAllowed(actor, end, geometry, []), true);
});

test('ordinary Varied preparation never introduces a hazardous specialist', () => {
  const geometry = { width: 20, height: 16, cells: new Uint8Array(320) };
  const result = derivePursuitGoals(
    [
      { id: 'a', x: 5.5, y: 5.5 },
      { id: 'b', x: 9.5, y: 9.5 },
    ],
    geometry,
  );
  assert.ok(result.actors.every((actor) => !['shield', 'brace'].includes(actor.behavior)));
});

test('Team front fatal contact does not cancel a surviving partner flank catch or duplicate its score', () => {
  const level = prepareTeamRunningEnemies(
    {
      version: 'revealline-coop-level.v2',
      journeyDifficulty: 'standard',
      id: 'specialist-team',
      revision: '1',
      name: 'Specialist Team',
      width: 72,
      height: 36,
      spawns: [
        { x: 0.5, y: 17.5 },
        { x: 71.5, y: 17.5 },
      ],
      walls: [],
      safeRects: [],
      enemies: [{ id: 'keeper', type: 'drifter', x: 60.5, y: 8.5, vx: 0, vy: 0, radius: 0.25 }],
      goal: { coverage: 0.95 },
      rules: { moveSpeed: 8, boostMultiplier: 1 },
    },
    { style: 'varied', population: population('shield') },
  );
  const run = startCoop(createCoop(level, { seed: 17 })),
    actor = run.combatPatrols.actors[0];
  run.config.jointCuts = false;
  for (const player of run.players) {
    Object.assign(player, {
      x: actor.x + (player.id === 0 ? 0.2 : -0.2),
      y: actor.y,
      cutting: true,
      graceUntil: 0,
      status: 'active',
    });
    player.cellIndex = Math.floor(player.y) * run.width + Math.floor(player.x);
    player.trail = [{ x: Math.floor(player.x), y: Math.floor(player.y), index: player.cellIndex }];
  }
  stepCoop(
    run,
    run.players.map(() => ({ direction: null, boost: false, support: false })),
  );
  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.players[1].status, 'active');
  assert.equal(actor.alive, false);
  assert.equal(run.hunt.score, 100);
  assert.deepEqual(run.combatPatrols.eliminations[0].players, [1]);
});

test('strict live view retains closed facing and accepts only bounded specialist speed', () => {
  for (const behavior of ['shield', 'brace']) {
    const { run, actor } = fixture(behavior);
    const speed = run.level.runningEnemies.combatPatrols.actors.find(
      (entry) => entry.id === actor.id,
    ).speed;
    if (behavior === 'brace') actor.pursuit.phase = 'burst';
    actor.vx = behavior === 'brace' ? speed * 2 : speed / 2;
    actor.vy = 0;
    const view = combatView(run);
    assert.equal(view.valid, true);
    assert.equal(view.actors.find((entry) => entry.id === actor.id).pursuit.heading, 'right');
    actor.vx = speed * 3;
    assert.equal(combatView(run).valid, false);
  }
});

test('protected contact has shared localized counterplay feedback without mislabeling ordinary collisions', () => {
  const explanation = failureExplanation('combat-specialist');
  assert.equal(explanation.cause, 'combat-specialist');
  assert.match(explanation.tip, /side or rear/);
  assert.notEqual(failureExplanation('enemy-player').reason, explanation.reason);
  const run = {
    level: {
      pursuit: {
        actors: [
          { id: 'shield', behavior: 'shield' },
          { id: 'brace', behavior: 'brace' },
        ],
      },
    },
  };
  assert.match(
    coopFailureFeedback(run, { cause: 'combat-specialist', enemy: 'shield' }).advice,
    /side or rear/,
  );
  assert.match(
    coopFailureFeedback(run, { cause: 'combat-specialist', enemy: 'brace' }).advice,
    /recovery/,
  );
  assert.match(specialistFailureCopy('shield', 'uk').reason, /щита/);
  assert.match(specialistFailureCopy('brace', 'uk').tip, /відновлення/);
});
