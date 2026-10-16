import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  recoverGameplayTuning,
  validateGameplayTuning,
  createGameplayTuningController,
  gameplayTuningDescription,
  GAMEPLAY_TUNING_STORAGE_KEY,
} from '../gameplay-tuning-v2.mjs';
import * as v1 from '../gameplay-tuning-v1.mjs';
import * as current from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT, validateLevel } from '../core/index.mjs';
import { createCoop, validateCoopLevel } from '../coop/core.mjs';
import { createDuel, resumeDuel, stepDuel } from '../multiplayer.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createWholeSortingCandidates } from '../content-design/whole-spatial-candidates.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';

const source = () => ({
  version: 'xonix-level.v1',
  id: 'motion-golden',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.8 },
  rules: { moveSpeed: 10, lives: 3 },
  enemies: [{ id: 'orb', type: 'bouncer', x: 38.5, y: 24.5, vx: 2, vy: 1, radius: 0.25 }],
});
const near = (actual, expected) =>
  assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const golden = {
  gentle: 'gp1g-3ff00000000000003ff00000000000003ff0000000000000-adba563dfc507a33',
  standard: 'gp1s-3ff00000000000003ff00000000000003ff0000000000000-b9ab2cbc8a3c2418',
  expert: 'gp1e-3ff00000000000003ff00000000000003ff0000000000000-034b13c3b47d37ac',
};

test('the complete v1 implementation remains byte-identical to released source', async () => {
  const bytes = await readFile(new URL('../gameplay-tuning-v1.mjs', import.meta.url));
  const gitBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(gitBlob, '17af134756974c6482a416d9235d7d1a06316719');
});

test('public dispatch reconstructs fixed gp1 golden identities without using new defaults', () => {
  for (const difficulty of Object.keys(golden)) {
    const original = v1.applyGameplayTuning(source(), v1.resolveGameplayTuning(difficulty));
    assert.equal(original.revision, golden[difficulty]);
    const recipe = recoverGameplayTuning(original);
    assert.equal(recipe.version, 'gameplay-pressure.v1');
    assert.deepEqual(applyGameplayTuning(source(), recipe), original);
    assert.deepEqual(validateGameplayTuning(recipe), v1.resolveGameplayTuning(difficulty));
    assert.notEqual(resolveGameplayTuning(difficulty).version, recipe.version);
    const run = createRun(original, { seed: 12 });
    const reconstructed = createRun(applyGameplayTuning(source(), recipe), { seed: 12 });
    for (let i = 0; i < 180; i++) {
      const direction = { direction: i < 100 ? 'down' : 'right' };
      stepRun(run, direction, FIXED_DT);
      stepRun(reconstructed, direction, FIXED_DT);
    }
    assert.deepEqual(authoritativeCheckpoint(run), authoritativeCheckpoint(reconstructed));
  }
});

test('Standard matches observed normalized speed hierarchy without inflating the opening keeper count', () => {
  const input = source(),
    before = structuredClone(input);
  const level = applyGameplayTuning(input, resolveGameplayTuning('standard'));
  near(level.rules.moveSpeed, 34 * 0.26);
  near(Math.hypot(level.enemies[0].vx, level.enemies[0].vy), 34 * 0.325);
  near(Math.hypot(level.enemies[0].vx, level.enemies[0].vy) / level.rules.moveSpeed, 1.25);
  near(level.enemies[0].vx / level.enemies[0].vy, 2);
  assert.equal(level.enemies.length, 1);
  assert.deepEqual(input, before);
  assert.match(level.revision, /^gp2s-/);
  assert.equal(level.revision.length, 70);
  assert(Object.isFrozen(level.enemies[0]));
});

test('difficulty changes pressure and density but retains the same craft handling', () => {
  const levels = ['gentle', 'standard', 'expert'].map((d) =>
    applyGameplayTuning(source(), resolveGameplayTuning(d)),
  );
  assert.deepEqual(
    levels.map((l) => l.enemies.length),
    [1, 1, 2],
  );
  levels.forEach((l) => near(l.rules.moveSpeed, 8.84));
  [0.75, 1, 1.2].forEach((factor, i) =>
    near(Math.hypot(levels[i].enemies[0].vx, levels[i].enemies[0].vy), 11.05 * factor),
  );
});

test('admin count increases work on Standard while reductions never delete authored enemies', () => {
  const up = resolveGameplayTuning('standard', { enemyDensity: 2 });
  assert.equal(up.enemyDensity, 1);
  assert.equal(up.adminOverride, true);
  assert.equal(applyGameplayTuning(source(), up).enemies.length, 2);
  const down = resolveGameplayTuning('standard', { enemyDensity: 0 });
  assert.equal(applyGameplayTuning(source(), down).enemies.length, 1);
  assert.equal(down.adminOverride, true);
});

test('pre-existing overrides survive without changing the saved preference format', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const previous = v1.createGameplayTuningController({ storage });
  previous.set({ enemySpeed: 1.25, playerSpeed: 0.9, enemyDensity: 1.5 });
  const current = createGameplayTuningController({ storage });
  assert.deepEqual(current.status().overrides, previous.status().overrides);
  assert.equal(current.snapshot().version, 'gameplay-pressure.v2');
  assert.equal(current.snapshot().enemyDensity, 0.5);
  current.reset();
  assert.equal(JSON.parse(values.get(GAMEPLAY_TUNING_STORAGE_KEY)).version, 'gameplay-pressure.v1');
  const rollback = v1.createGameplayTuningController({ storage });
  assert.equal(rollback.snapshot().adminOverride, false);
  previous.dispose();
  current.dispose();
  rollback.dispose();
});

test('gp2 saves retain exact floating overrides and reject double adaptation across either recipe version', () => {
  const recipe = resolveGameplayTuning('expert', {
    enemySpeed: 1.234567890123456,
    playerSpeed: 1.123456789,
    enemyDensity: 0.25,
  });
  const level = applyGameplayTuning(source(), recipe);
  assert.deepEqual(recoverGameplayTuning(level), recipe);
  assert.deepEqual(applyGameplayTuning(source(), recoverGameplayTuning(level)), level);
  for (const snapshot of [recipe, v1.resolveGameplayTuning('standard')])
    assert.throws(() => applyGameplayTuning(level, snapshot), /exactly once/);
  assert.throws(() => validateGameplayTuning({ ...recipe, enemySpeed: 999 }), /Inconsistent/);
  assert.equal(recoverGameplayTuning({ revision: level.revision.replace('gp2', 'gp9') }), null);
});

test('actual gp2 simulation replays deterministically and Versus boards use identical levels', () => {
  const level = applyGameplayTuning(source(), resolveGameplayTuning('standard'));
  const run = createRun(level, { seed: 17 }),
    recorder = createRecorder(level, { seed: 17 });
  for (let tick = 0; tick < 240 && !['won', 'lost'].includes(run.status); tick++) {
    const input = { direction: tick < 120 ? 'down' : 'right' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  assert(recorder.ticks > 0, 'The fixture must execute actual gameplay ticks.');
  assert(verifyReplay(exportReplay(recorder, run)).match);
  const duel = createDuel(level, { seed: 17 });
  assert.deepEqual(duel.runs[0].level, duel.runs[1].level);
  resumeDuel(duel);
  for (let tick = 0; tick < 120; tick++)
    stepDuel(duel, [{ direction: 'down' }, { direction: 'down' }]);
  assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
});

test('menu description uses normalized reference targets, not old authored-speed claims', () => {
  const normal = gameplayTuningDescription(resolveGameplayTuning('standard'));
  assert.match(
    normal,
    /craft 0\.260, field enemies 0\.325, boundary patrols 0\.240 short-fields\/s/,
  );
  assert.match(normal, /Authored enemy counts/);
  assert.match(gameplayTuningDescription(resolveGameplayTuning('expert')), /\+50%/);
  assert.match(
    gameplayTuningDescription(v1.resolveGameplayTuning('standard')),
    /Historical pressure/,
  );
});

test('calibrated patrols preserve stationary actors and do not retime unmeasured lane warnings', () => {
  const fixture = source();
  fixture.enemies = [
    { ...fixture.enemies[0], vx: 0, vy: 0 },
    { id: 'patrol', type: 'border-patrol', x: 0.5, y: 20.5, speed: 4 },
    { id: 'parked', type: 'border-patrol', x: 0.5, y: 10.5, speed: 0 },
    {
      id: 'lane',
      type: 'lane-boss',
      x: 30.5,
      y: 15.5,
      warningSeconds: 1.5,
      activeSeconds: 0.7,
      period: 6,
      axis: 'horizontal',
    },
  ];
  const tuned = applyGameplayTuning(fixture, resolveGameplayTuning('standard'));
  const previous = v1.applyGameplayTuning(fixture, v1.resolveGameplayTuning('standard'));
  assert.deepEqual(tuned.enemies[0], fixture.enemies[0]);
  near(tuned.enemies[1].speed, 34 * 0.24);
  assert.equal(tuned.enemies[2].speed, 0);
  assert.deepEqual(tuned.enemies[3], previous.enemies[3]);
  assert.equal(tuned.enemies.length, fixture.enemies.length);
  assert.equal(
    applyGameplayTuning({ ...source(), enemies: [] }, resolveGameplayTuning('expert')).enemies
      .length,
    0,
  );
});

test('additional fast keepers respect increased spawn clearance and caps', () => {
  const fixture = source();
  const tuned = applyGameplayTuning(
    fixture,
    resolveGameplayTuning('expert', { enemySpeed: 2, enemyDensity: 2 }),
  );
  assert(tuned.enemies.length > 1);
  for (const enemy of tuned.enemies.slice(1)) {
    const speed = Math.hypot(enemy.vx, enemy.vy);
    assert(speed <= 20);
    assert(
      Math.hypot(enemy.x - fixture.spawn.x, enemy.y - fixture.spawn.y) >= Math.max(8, speed * 1.2),
    );
  }
});

test('all current Solo and Team editions validate at every bounded override with unchanged geometry', () => {
  let soloVariants = 0,
    teamVariants = 0;
  for (const [mode, project] of [
    ['solo', createWholeSortingCandidates()],
    ['team', createTeamSpatialOriginalCandidates()],
  ]) {
    const catalog = createContentExecutionCatalog(project, { mode });
    for (const entry of catalog.entries)
      for (const level of entry.campaign.levels) {
        for (const overrides of [
          {},
          { enemySpeed: 2, playerSpeed: 1.5, enemyDensity: 2 },
          { enemySpeed: 0.5, playerSpeed: 0.75, enemyDensity: 0 },
        ]) {
          const tuned = current.applyGameplayTuning(
            level,
            current.resolveGameplayTuning(entry.difficulty, overrides),
          );
          const validation = mode === 'solo' ? validateLevel(tuned) : validateCoopLevel(tuned);
          assert(validation.valid, `${mode}/${level.id}: ${validation.errors.join(';')}`);
          assert.deepEqual(tuned.goal, level.goal);
          assert.deepEqual(tuned.walls, level.walls);
          assert.deepEqual(tuned.foundations, level.foundations);
          assert.deepEqual(tuned.spawn ?? tuned.spawns, level.spawn ?? level.spawns);
          assert(tuned.enemies.length >= level.enemies.length);
          if (entry.difficulty === 'standard' && !Object.keys(overrides).length)
            assert.equal(tuned.enemies.length, level.enemies.length);
          if (mode === 'team') {
            assert.equal(createCoop(tuned).totalClaimable, createCoop(level).totalClaimable);
            teamVariants++;
          } else soloVariants++;
        }
      }
  }
  assert.equal(soloVariants, 819);
  assert.equal(teamVariants, 108);
});

test('retained Classic maps validate under both new ordinary defaults and maximum admin settings', async () => {
  let variants = 0;
  for (const file of [
    'campaign.json',
    'packs/fieldcraft.json',
    'packs/night-shift.json',
    'packs/living-threads.json',
    'packs/classic-lab.json',
    'packs/sentinel-relay.json',
  ]) {
    const pack = JSON.parse(await readFile(new URL(`../content/${file}`, import.meta.url)));
    for (const campaign of pack.campaigns ?? [pack.campaign ?? pack])
      for (const level of campaign.levels ?? [])
        for (const difficulty of ['gentle', 'standard', 'expert'])
          for (const overrides of [{}, { enemySpeed: 2, playerSpeed: 1.5, enemyDensity: 2 }]) {
            const checked = validateLevel(
              current.applyGameplayTuning(
                level,
                current.resolveGameplayTuning(difficulty, overrides),
              ),
            );
            assert(checked.valid, `${level.id}: ${checked.errors.join(';')}`);
            variants++;
          }
  }
  assert.equal(variants, 192);
});
