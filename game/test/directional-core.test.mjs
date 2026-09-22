import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, stepRun, validateLevel, CELL, FIXED_DT } from '../core/index.mjs';
import { planClassicPlayer, planClassicEnemy } from '../core/classic-motion.mjs';
import { resolveVersions, DIRECTIONAL_VERSIONS, RELAY_VERSIONS } from '../core/versions.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const near = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const source = (direction = 'down') => ({
  version: 'xonix-level.v7',
  id: 'directional-contract',
  revision: '1',
  name: 'Marked crossing',
  width: 72,
  height: 36,
  spawn: { x: 35.5, y: 0.5 },
  foundations: [{ x: 30, y: 15, w: 13, h: 3 }],
  walls: [],
  relayGates: { version: 'relay-gates.v1', gates: [] },
  directionalFields: {
    version: 'directional-fields.v1',
    zones: [{ id: 'lane', x: 30, y: 3, w: 13, h: 12, direction }],
  },
  goal: { coverage: 0.99 },
  encounter: null,
  classic: { version: 'classic.v1', terrain: [], powerups: [] },
  enemies: [
    { id: 'west', type: 'bouncer', x: 10.5, y: 25.5, vx: 2.4, vy: 0 },
    { id: 'east', type: 'bouncer', x: 60.5, y: 25.5, vx: -2.4, vy: 0 },
  ],
  objectives: [],
  supplies: [],
  rules: { lives: 3, moveSpeed: 10, stopOnCapture: true },
});

test('directional levels pin a successor tuple and reject incomplete or mixed definitions', () => {
  const run = createRun(source());
  assert.equal(run.ruleset, 'xonix-core.v8');
  assert.equal(authoritativeCheckpoint(run).algorithm, 'fnv1a64-state-v8');
  assert.deepEqual(resolveVersions({ levelVersion: 'xonix-level.v7' }), DIRECTIONAL_VERSIONS);
  assert.throws(
    () => resolveVersions({ ...RELAY_VERSIONS, levelVersion: 'xonix-level.v7' }),
    /mismatched/,
  );
  for (const change of [
    (level) => {
      level.version = 'xonix-level.v6';
    },
    (level) => {
      delete level.directionalFields;
    },
    (level) => {
      level.directionalFields.version = 'directional-fields.v2';
    },
    (level) => {
      level.directionalFields.withFlow = 2;
    },
    (level) => {
      level.directionalFields.zones[0].direction = 'diagonal';
    },
  ]) {
    const level = source();
    change(level);
    assert.equal(validateLevel(level).valid, false);
  }
  const old = source();
  old.version = 'xonix-level.v6';
  delete old.directionalFields;
  assert.equal(validateLevel(old).valid, true);
  assert.equal(
    Object.hasOwn(authoritativeCheckpoint(createRun(old)).sections, 'directionalFields'),
    false,
  );
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: legal inputs enter marked cells at the exact boundary, stop after capture and replay`, () => {
    const level = source(),
      options = { seed: 1, turnPolicy },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    const denominator = run.totalClaimable;
    for (let tick = 0; tick < 120; tick++) {
      recordInput(recorder, { direction: 'down' });
      stepRun(run, { direction: 'down' }, FIXED_DT);
    }
    near(run.player.y, 12.375);
    for (let tick = 0; tick < 120 && !run.claimedCount; tick++) {
      recordInput(recorder, { direction: 'down' });
      stepRun(run, { direction: 'down' }, FIXED_DT);
    }
    assert(run.claimedCount > 0);
    assert.equal(run.classic.livesLost, 0);
    assert.equal(run.totalClaimable, denominator);
    assert.equal(run.player.cutting, false);
    assert.equal(run.player.speed, 0);
    near(run.player.y, 15);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    const before = { ...run.player };
    stepRun(run, { direction: null }, FIXED_DT);
    near(run.player.x, before.x);
    near(run.player.y, before.y);
  });

  test(`${turnPolicy}: isolated planner splits entering/leaving and restored field without drift`, () => {
    const run = createRun(source(), { turnPolicy });
    // Unit setup isolates material-boundary integration; not a gameplay solution.
    Object.assign(run.player, { x: 35.5, y: 2.9, direction: 'down' });
    const entering = planClassicPlayer(run, { direction: 'down' }, 0.1);
    near(entering.player.y, 4.125);
    Object.assign(run.player, { y: 3.1, direction: 'up' });
    const leaving = planClassicPlayer(run, { direction: 'up' }, 0.1);
    near(leaving.player.y, 2.125);
    Object.assign(run.player, { y: 8.5, direction: 'down' });
    const index = 8 * 72 + 35;
    run.cells[index] = CELL.SAFE;
    near(planClassicPlayer(run, { direction: 'down' }, 0.02).player.y, 8.7);
    run.cells[index] = CELL.FIELD;
    near(planClassicPlayer(run, { direction: 'down' }, 0.02).player.y, 8.75);
    const idle = planClassicPlayer(run, { direction: null }, 0.1);
    near(idle.player.x, 35.5);
    near(idle.player.y, 8.5);
    assert.equal(idle.player.speed, 0);
  });
}

test('Grid + Buffer recalculates direction-dependent speed at an in-cell turn center', () => {
  const run = createRun(source('right'), { turnPolicy: 'grid-center' });
  Object.assign(run.player, { x: 35.45, y: 8.5, direction: 'right' });
  const perpendicular = planClassicPlayer(run, { direction: 'down' }, 0.1);
  near(perpendicular.player.x, 35.5);
  near(perpendicular.player.y, 9.46);
  const reverse = planClassicPlayer(run, { direction: 'left' }, 0.1);
  near(reverse.player.x, 34.732);
  near(reverse.player.y, 8.5);
  run.turnPolicy = 'immediate';
  const immediate = planClassicPlayer(run, { direction: 'down' }, 0.1);
  near(immediate.player.x, 35.45);
  near(immediate.player.y, 9.5);
});

test('field recipe composes once with bonuses, respects the speed cap and never changes enemy plans', () => {
  const run = createRun(source());
  Object.assign(run.player, { x: 35.5, y: 8.5, direction: 'down' });
  run.classic.effects['player-speed'] = { from: 0, until: 100 };
  near(planClassicPlayer(run, { direction: 'down' }, 0.02).player.y, 8.8125);
  run.tick = 100;
  near(planClassicPlayer(run, { direction: 'down' }, 0.02).player.y, 8.75);
  run.rules.moveSpeed = 20;
  run.rules.boostMultiplier = 4;
  near(planClassicPlayer(run, { direction: 'down', boost: true }, 0.02).player.y, 9.7);
  const enemy = { ...run.enemies[0], x: 35.5, y: 8.5 };
  const withField = planClassicEnemy(run, enemy, 0.1);
  delete run.level.directionalFields;
  assert.deepEqual(planClassicEnemy(run, enemy, 0.1), withField);
});

test('checkpoint authority includes directional definition and replay rejects changed direction', () => {
  const level = source(),
    run = createRun(level),
    recorder = createRecorder(level);
  for (let tick = 0; tick < 120; tick++) {
    recordInput(recorder, { direction: 'down' });
    stepRun(run, { direction: 'down' }, FIXED_DT);
  }
  const original = authoritativeCheckpoint(run),
    replay = exportReplay(recorder, run);
  assert.equal(replay.version, 'xonix-replay.v9');
  assert(original.sections.directionalFields);
  run.level.directionalFields.zones[0].direction = 'up';
  const changed = authoritativeCheckpoint(run);
  assert.notEqual(changed.hash, original.hash);
  assert.notEqual(changed.sections.directionalFields, original.sections.directionalFields);
  replay.level.directionalFields.zones[0].direction = 'up';
  assert.equal(verifyReplay(replay).match, false);
});
