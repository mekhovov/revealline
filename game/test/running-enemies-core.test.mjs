import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES, CELL } from '../core/index.mjs';
import { normalizedLevel, validateLevel } from '../core/level.mjs';
import {
  prepareRunningEnemyLevel,
  runningEnemyBaseLevel,
  matchRunningEnemyLevel,
} from '../hunt/running-enemies.mjs';
import { combatContacts, planCombatMotion } from '../core/combat-motion.mjs';
import { captureCombatPatrols } from '../core/combat-patrols.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { combatView } from '../ui/combat-view.mjs';
import { combatLevel } from './helpers/combat-fixture.mjs';

const original = () =>
  JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url))).levels[0];

test('Running enemies keeps legacy mechanics and owns a separate replay/checkpoint edition', () => {
  const base = original(),
    level = prepareRunningEnemyLevel(base),
    run = createRun(level);
  assert.equal(level.version, 'xonix-level.v10');
  assert.equal(level.revision, base.revision);
  assert.deepEqual(runningEnemyBaseLevel(level), normalizedLevel(base));
  assert.equal(run.width, 48);
  assert.equal(run.classic, undefined);
  assert.equal(run.encounter, undefined);
  assert.equal(run.runningEnemies.combatPatrols.actors.length, 6);
  assert.equal(combatView(run).valid, true);
  const recorder = createRecorder(level);
  const input = { direction: 'down' };
  recordInput(recorder, input);
  stepRun(run, input, FIXED_DT);
  const replay = exportReplay(recorder, run),
    result = verifyReplay(replay);
  assert.equal(replay.version, 'xonix-replay.v12');
  assert.equal(result.match, true);
  assert.equal(result.state.classic, undefined);
  assert.equal(authoritativeCheckpoint(result.state).algorithm, 'fnv1a64-state-v11');
});

test('supplemental population preserves original patrols and matches only the accepted base recipe', () => {
  const base = combatLevel('sentry'),
    level = prepareRunningEnemyLevel(base);
  assert.deepEqual(level.classic.combatPatrols, base.classic.combatPatrols);
  assert.deepEqual(
    level.runningEnemies.combatPatrols.actors.slice(0, 1),
    base.classic.combatPatrols.actors,
  );
  assert.equal(matchRunningEnemyLevel(base, level), true);
  const changed = structuredClone(level);
  changed.goal.coverage = changed.goal.coverage === 0.5 ? 0.6 : 0.5;
  assert.equal(validateLevel(changed).valid, false);
  assert.equal(matchRunningEnemyLevel(base, changed), false);
});

test('a full historical actor budget reserves no ordinary actors away from its owner', () => {
  const base = original();
  base.enemies = Array.from({ length: 24 }, (_, n) => ({
    id: `keeper-${n}`,
    type: 'bouncer',
    x: 2.5 + (n % 12) * 3,
    y: 15.5 + Math.floor(n / 12) * 5,
    vx: 1,
    vy: 1,
  }));
  const level = prepareRunningEnemyLevel(base);
  assert.equal(level.enemies.length, 24);
  assert.equal(level.runningEnemies.hunt.targets.length, 6);
  assert.deepEqual(level.enemies, base.enemies);
});

test('accepted custom craft speed determines the runner speed and remains replay-admissible', () => {
  const base = original();
  base.rules.moveSpeed = 20;
  const classes = CLASSES.map((item) => ({ ...item, moveSpeedMultiplier: 1.5 }));
  const level = prepareRunningEnemyLevel(base, { classes });
  assert.equal(level.runningEnemies.combatPatrols.actors[0].speed, 21);
  assert.equal(combatView(createRun(level, { classRecipes: classes })).valid, true);
  assert.throws(() => createRun(level));
});

test('legacy safe-edge touch is permitted, walls occlude it, enclosure awards one separate score', () => {
  const run = createRun(prepareRunningEnemyLevel(original()));
  const actor = run.runningEnemies.combatPatrols.actors[0];
  Object.assign(run.player, { x: 9.95, y: 18.5, cutting: false, graceUntil: 0 });
  Object.assign(actor, { x: 10.22, y: 18.5, vx: 0, vy: 0 });
  const contact = () =>
    combatContacts(
      run,
      [{ x1: 9.95, y1: 18.5, x2: 9.95, y2: 18.5, t0: 0, t1: FIXED_DT }],
      planCombatMotion(run, FIXED_DT),
      { started: null, closure: null },
      FIXED_DT,
    );
  run.cells[18 * run.width + 9] = CELL.SAFE;
  assert.equal(contact().rams.length, 1);
  run.cells[18 * run.width + 9] = CELL.WALL;
  assert.equal(contact().rams.length, 0);
  run.cells[18 * run.width + 10] = CELL.SAFE;
  captureCombatPatrols(run);
  captureCombatPatrols(run);
  assert.equal(getSummary(run).hunt.captureKills, 1);
  assert.equal(getSummary(run).hunt.score, 50);
  assert.equal(run.score, 0);
});
