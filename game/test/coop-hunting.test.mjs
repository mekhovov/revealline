import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, stepCoop, validateCoopLevel } from '../coop/core.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import {
  COOP_HUNT_LEVEL_VERSION,
  COOP_HUNT_RULESET,
  journeyTeamPackEdition,
} from '../coop/foundations.mjs';
import { deriveEncounterLevel } from '../hunt/variants.mjs';
import { dataIdentity } from '../data-json.mjs';
import {
  captureCoopCombat,
  coopCombatView,
  eliminateCoopCombat,
  planCoopCombat,
  updateCoopCombat,
  supportCoopCombat,
} from '../coop/combat-patrols.mjs';
import {
  createInstalledTeamAttemptSnapshot,
  validateInstalledTeamAttempt,
  CREATOR_TEAM_VARIANT_ATTEMPT_FORMAT,
} from '../creator/team-installed.mjs';

const neutral = () => ({ direction: null, boost: false, support: false });
const commands = () => [neutral(), neutral()];
function source() {
  return {
    version: 'revealline-coop-level.v2',
    journeyDifficulty: 'standard',
    id: 'team-hunt-fixture',
    revision: '1',
    name: 'Team hunt fixture',
    width: 72,
    height: 36,
    spawns: [
      { x: 0.5, y: 17.5 },
      { x: 71.5, y: 17.5 },
    ],
    walls: [],
    safeRects: [],
    enemies: [{ id: 'keeper', type: 'drifter', x: 35.5, y: 17.5, vx: 0, vy: 0, radius: 0.25 }],
    goal: { coverage: 0.95 },
    rules: { moveSpeed: 8, boostMultiplier: 1 },
  };
}
function fixture(mode = 'bonus') {
  const level = structuredClone(deriveEncounterLevel(source(), mode, { mode: 'team' }));
  const run = startCoop(createCoop(level, { seed: 47 }));
  stepCoop(run, commands());
  return { level, run };
}
function expose(run, seat, x, y) {
  const player = run.players[seat];
  Object.assign(player, {
    x,
    y,
    cellIndex: Math.floor(y) * run.width + Math.floor(x),
    status: 'active',
    cutting: true,
    graceUntil: 0,
  });
  player.trail = [{ x: Math.floor(x), y: Math.floor(y), index: player.cellIndex }];
  return player;
}

test('Team variants carry a successor edition and preserve source mechanics and input content', () => {
  const original = source(),
    before = structuredClone(original);
  for (const mode of ['patrol', 'bonus', 'capture-quota', 'hunt']) {
    const level = deriveEncounterLevel(original, mode, { mode: 'team' });
    assert.equal(level.version, COOP_HUNT_LEVEL_VERSION);
    assert.equal(createCoop(level).ruleset, COOP_HUNT_RULESET);
    assert.equal(validateCoopLevel(level).valid, true);
    assert.equal(Object.hasOwn(level, 'lineImpact'), false);
    assert.equal(Object.hasOwn(level, 'supportRoles'), false);
    assert.equal(
      validateCoopPack({
        ...journeyTeamPackEdition(level),
        id: 'hunt-pack',
        name: 'Hunt pack',
        revision: '1',
        levels: [level],
      }).valid,
      true,
    );
  }
  assert.deepEqual(original, before);
  assert.equal(Object.hasOwn(createCoop(original), 'hunt'), false);
});

test('hunt target references and achievable shared quotas fail closed', () => {
  const { level } = fixture('capture-quota');
  level.hunt.quota = level.hunt.targets.length + 1;
  assert.equal(validateCoopLevel(level).valid, false);
  level.hunt.quota = 1;
  level.hunt.targets[0].id = 'missing-runner';
  assert.equal(validateCoopLevel(level).valid, false);
});

test('two simultaneous touches award one shared elimination and 100 points', () => {
  const { run } = fixture(),
    actor = run.combatPatrols.actors.find((a) => a.role === 'scout');
  actor.vx = actor.vy = 0;
  expose(run, 0, actor.x, actor.y);
  expose(run, 1, actor.x, actor.y);
  run.config.jointCuts = false;
  stepCoop(run, commands());
  assert.equal(actor.alive, false);
  assert.equal(run.hunt.kills, 1);
  assert.equal(run.hunt.score, 100);
  assert.deepEqual(run.combatPatrols.eliminations[0].players, [0, 1]);
});

test('a fatal shot prevents that seat from ramming, while another surviving seat can finish', () => {
  const { run } = fixture(),
    actor = run.combatPatrols.actors.find((a) => a.role === 'scout');
  actor.vx = actor.vy = 0;
  expose(run, 0, actor.x - 0.2, actor.y);
  expose(run, 1, actor.x + 0.2, actor.y);
  run.config.jointCuts = false;
  run.combatPatrols.projectiles.push({
    id: 'fatal-shot',
    actorId: 'unrelated-guard',
    x: actor.x - 0.4,
    y: actor.y,
    vx: 4,
    vy: 0,
    expiresAtTick: 999,
  });
  stepCoop(run, commands());
  assert.equal(run.players[0].status, 'downed');
  assert.equal(run.players[1].status, 'active');
  assert.equal(actor.alive, false);
  assert.deepEqual(run.combatPatrols.eliminations[0].players, [1]);
  assert.equal(run.huntDowns, 1);
});

test('capture cleanup is authoritative, once-only and removes owner projectiles', () => {
  const { run } = fixture(),
    actor = run.combatPatrols.actors[0];
  run.cells[Math.floor(actor.y) * run.width + Math.floor(actor.x)] = 1;
  run.combatPatrols.projectiles.push({
    id: 'owned-shot',
    actorId: actor.id,
    x: 25,
    y: 20,
    vx: 4,
    vy: 0,
    expiresAtTick: 999,
  });
  captureCoopCombat(run, [1]);
  eliminateCoopCombat(run, actor, 'ram', [0]);
  assert.equal(run.hunt.captureKills, 1);
  assert.equal(run.hunt.touchKills, 0);
  assert.equal(run.hunt.score, 50);
  assert.equal(run.combatPatrols.projectiles.length, 0);
});

test('guard warning keeps the selected seat and observed point; target recovery cancels it', () => {
  const { run } = fixture(),
    guard = run.combatPatrols.actors.find((a) => a.role === 'sentry');
  const definition = run.level.combatPatrols.actors.find((a) => a.id === guard.id);
  expose(run, 0, guard.x + 2, guard.y);
  run.combatPatrols.actorTick = definition.openingTicks;
  updateCoopCombat(run);
  assert.equal(guard.phase, 'warning');
  const aim = { ...guard.aim };
  run.players[0].y += 1;
  expose(run, 1, guard.x + 1, guard.y);
  updateCoopCombat(run);
  assert.deepEqual(guard.aim, aim);
  assert.equal(guard.targetPlayer, 0);
  const projected = coopCombatView(run).actors.find((a) => a.id === guard.id);
  assert.equal(projected.warningTicks, definition.warningTicks);
  assert.equal(projected.warningTotal, definition.warningTicks);
  run.players[0].status = 'downed';
  updateCoopCombat(run);
  assert.equal(guard.phase, 'cooldown');
  assert.equal(guard.aim, null);
});

test('Support roles affect nearby optional patrols and shots without stacking slow', () => {
  const { run } = fixture(),
    actor = run.combatPatrols.actors[0];
  const player = expose(run, 0, actor.x, actor.y);
  run.combatPatrols.projectiles.push({
    id: 'incoming',
    actorId: actor.id,
    x: actor.x + 1,
    y: actor.y,
    vx: 4,
    vy: 0,
    expiresAtTick: 999,
  });
  const result = supportCoopCombat(run, player, { canSlow: true, canIntercept: true });
  assert.ok(result.slowedEnemies.includes(actor.id));
  assert.deepEqual(result.interceptedImpacts, ['incoming']);
  const velocity = planCoopCombat(
    run,
    [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
    0.1,
  ).patrols.find((plan) => plan.body === actor).velocity;
  assert.equal(velocity.x, actor.vx * 0.5);
  assert.equal(
    supportCoopCombat(run, player, { canSlow: true, canIntercept: false }).slowedEnemies.length,
    0,
  );
});

test('pure hunt victory uses its quota while bonus preserves capture goal', () => {
  for (const mode of ['hunt', 'bonus']) {
    const { run } = fixture(mode);
    for (const actor of run.combatPatrols.actors) eliminateCoopCombat(run, actor, 'ram', [0]);
    stepCoop(run, commands());
    assert.equal(run.status, mode === 'hunt' ? 'won' : 'running');
  }
});

test('Team variant snapshot carries a separate identity and rejects a damaged descriptor', () => {
  const { run, level } = fixture();
  const snapshot = createInstalledTeamAttemptSnapshot({
    editionId: 'a'.repeat(64),
    attemptId: 'hunt-attempt',
    gameplayId: 'variant-gameplay',
    presetId: 'full',
    run,
    encounterVariant: 'bonus',
    encounterLevelIdentity: dataIdentity(level),
    segments: [{ ticks: 1, commands: commands() }],
  });
  assert.equal(snapshot.format, CREATOR_TEAM_VARIANT_ATTEMPT_FORMAT);
  assert.equal(
    validateInstalledTeamAttempt(snapshot, 'a'.repeat(64), run.level.id).encounterVariant,
    'bonus',
  );
  snapshot.encounterLevelIdentity = 'damaged';
  assert.throws(() => validateInstalledTeamAttempt(snapshot, 'a'.repeat(64), run.level.id));
});

test('safe-edge hunt contact succeeds while projectiles retain exposure requirements', () => {
  const { run } = fixture();
  const actor = run.combatPatrols.actors.find((item) => item.role === 'scout');
  Object.assign(actor, { x: 1.22, y: 17.5, vx: 0, vy: 0 });
  Object.assign(run.players[0], { x: 0.99, y: 17.5, cellIndex: 17 * run.width, cutting: false });
  run.combatPatrols.projectiles.push({
    id: 'safe-edge-shot',
    actorId: 'another-guard',
    x: 1.1,
    y: 17.5,
    vx: -4,
    vy: 0,
    expiresAtTick: 999,
  });
  stepCoop(run, commands());
  assert.equal(actor.alive, false);
  assert.equal(run.hunt.score, 100);
  assert.equal(run.players[0].status, 'active');
});
