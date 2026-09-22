import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  recoverGameplayTuning,
  validateGameplayTuning,
  createGameplayTuningController,
  GAMEPLAY_TUNING_STORAGE_KEY,
  GAMEPLAY_TUNING_DEFAULTS,
} from '../gameplay-tuning-v1.mjs';
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
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { createWholeSortingCandidates } from '../content-design/whole-spatial-candidates.mjs';

const solo = (changes = {}) => ({
  version: 'xonix-level.v1',
  id: 'pressure-fixture',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.99 },
  rules: { moveSpeed: 10, lives: 3 },
  enemies: [
    { id: 'east', type: 'bouncer', x: 38.5, y: 20.5, vx: 2, vy: 1, radius: 0.25 },
    { id: 'west', type: 'bouncer', x: 8.5, y: 20.5, vx: -2, vy: 1, radius: 0.25 },
  ],
  ...changes,
});
const team = (changes = {}) => ({
  version: 'revealline-coop-level.v1',
  id: 'team-pressure',
  revision: 1,
  name: 'Pressure',
  width: 72,
  height: 36,
  spawns: [
    { x: 20.5, y: 0.5 },
    { x: 20.5, y: 35.5 },
  ],
  walls: [],
  safeRects: [],
  goal: { coverage: 0.99 },
  enemies: [
    { id: 'east', type: 'drifter', x: 60.5, y: 28.5, vx: 2, vy: 1, radius: 0.2 },
    { id: 'west', type: 'drifter', x: 10.5, y: 15.5, vx: -2, vy: 1, radius: 0.2 },
  ],
  ...changes,
});
const memory = () => {
  const values = new Map();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};

test('the shared presets visibly raise enemy speed and density without changing handling between difficulties', () => {
  const source = solo(),
    copy = structuredClone(source),
    results = [];
  for (const [difficulty, enemySpeed, count] of [
    ['gentle', 1.2, 2],
    ['standard', 1.6, 3],
    ['expert', 2, 4],
  ]) {
    const snapshot = resolveGameplayTuning(difficulty),
      level = applyGameplayTuning(source, snapshot);
    assert.equal(snapshot.adminOverride, false);
    assert.equal(level.enemies[0].vx, source.enemies[0].vx * enemySpeed);
    assert.equal(level.rules.moveSpeed, 11.5);
    assert.equal(level.enemies.length, count);
    assert.equal(validateLevel(level).valid, true);
    assert.equal(level.revision.length, 70);
    assert.deepEqual(recoverGameplayTuning(level), snapshot);
    assert(Object.isFrozen(level.enemies[0]));
    results.push(level.revision);
  }
  assert.equal(new Set(results).size, 3);
  assert.deepEqual(source, copy);
  assert.equal(recoverGameplayTuning(source), null);
});

test('bounded overrides round-trip exact Float64 values and only custom settings are practice', () => {
  const snapshot = resolveGameplayTuning('expert', {
    enemySpeed: 1.234567890123456,
    playerSpeed: 1.1,
    enemyDensity: 0.25,
  });
  const source = solo(),
    tuned = applyGameplayTuning(source, snapshot);
  assert.equal(snapshot.adminOverride, true);
  assert.deepEqual(recoverGameplayTuning(tuned), snapshot);
  assert.deepEqual(applyGameplayTuning(source, recoverGameplayTuning(tuned)), tuned);
  assert.throws(() => applyGameplayTuning(tuned, snapshot), /exactly once/);
  assert.throws(() => validateGameplayTuning({ ...snapshot, enemySpeed: 1 }), /Inconsistent/);
  assert.throws(
    () => validateGameplayTuning({ ...snapshot, adminOverride: false }),
    /Inconsistent/,
  );
  assert.throws(() => resolveGameplayTuning('unknown'), /Unsupported/);
  for (const bad of [
    { enemySpeed: 2.01 },
    { playerSpeed: 0.7 },
    { enemyDensity: -1 },
    { unknown: 1 },
    { enemySpeed: NaN },
  ])
    assert.throws(() => resolveGameplayTuning('standard', bad));
  const forged = {
    ...tuned,
    revision: tuned.revision.slice(0, -1) + (tuned.revision.endsWith('0') ? '1' : '0'),
  };
  assert.deepEqual(
    recoverGameplayTuning(forged),
    snapshot,
    'recipe is metadata, not save authority',
  );
  assert.notDeepEqual(
    applyGameplayTuning(source, recoverGameplayTuning(forged)),
    forged,
    'exact reconstruction detects forged revision',
  );
  let reads = 0;
  const accessor = Object.defineProperty({}, 'version', {
    enumerable: true,
    get() {
      reads++;
      return 'xonix-level.v1';
    },
  });
  assert.throws(() => applyGameplayTuning(accessor, snapshot), /accessors/);
  assert.equal(reads, 0);
});

test('extra keepers never seed an empty disconnected chamber or overlap foundations, walls, actors or spawns', () => {
  const source = solo({ walls: [{ x: 24, y: 1, w: 1, h: 34 }], enemies: [solo().enemies[0]] });
  const tuned = applyGameplayTuning(source, resolveGameplayTuning('expert', { enemyDensity: 2 }));
  assert.equal(tuned.enemies.length, 3);
  for (const added of tuned.enemies.slice(1)) {
    assert(added.x > 25);
    assert(Math.hypot(added.x - source.spawn.x, added.y - source.spawn.y) >= 8);
    for (const other of tuned.enemies.filter((enemy) => enemy !== added))
      assert(Math.hypot(added.x - other.x, added.y - other.y) >= 3);
  }
  const foundation = {
    ...solo(),
    version: 'xonix-level.v5',
    width: 72,
    spawn: { x: 32.5, y: 17.5 },
    foundations: [{ x: 30, y: 15, w: 5, h: 5 }],
    encounter: null,
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
  };
  const run = createRun(applyGameplayTuning(foundation, resolveGameplayTuning('expert')));
  assert.equal(run.totalClaimable, createRun(foundation).totalClaimable);
  for (const enemy of run.enemies)
    assert.equal(run.cells[Math.floor(enemy.y) * 72 + Math.floor(enemy.x)], 0);
});

test('zero-keeper and stationary puzzles stay zero-keeper or stationary; density zero never removes authored enemies', () => {
  const empty = solo({ enemies: [] });
  assert.equal(applyGameplayTuning(empty, resolveGameplayTuning('expert')).enemies.length, 0);
  const stationary = solo({ enemies: [{ ...solo().enemies[0], vx: 0, vy: 0 }] });
  assert.deepEqual(
    applyGameplayTuning(stationary, resolveGameplayTuning('expert')).enemies,
    stationary.enemies,
  );
  assert.equal(
    applyGameplayTuning(solo(), resolveGameplayTuning('expert', { enemyDensity: 0 })).enemies
      .length,
    2,
  );
});

test('lane attacks preserve warning and active windows while patrols use bounded higher speed', () => {
  const source = solo({
    enemies: [
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
      { id: 'patrol', type: 'border-patrol', x: 0.5, y: 20.5, speed: 12 },
    ],
  });
  const tuned = applyGameplayTuning(source, resolveGameplayTuning('expert'));
  assert.equal(tuned.enemies[0].warningSeconds, 1.5);
  assert.equal(tuned.enemies[0].activeSeconds, 0.7);
  assert.equal(tuned.enemies[0].period, 4.1);
  assert.equal(tuned.enemies[1].speed, 15);
  assert.equal(tuned.enemies.length, 2);
});

test('Team uses the same recipe, keeps both starts clear and bounds attack/velocity speed', () => {
  const source = team({
    enemies: [
      ...team().enemies,
      { id: 'hunter', type: 'hunter', x: 45.5, y: 20.5, vx: 2, vy: 2, radius: 0.2 },
    ],
  });
  const snapshot = resolveGameplayTuning('expert', {
    enemySpeed: 2,
    playerSpeed: 1.5,
    enemyDensity: 2,
  });
  const tuned = applyGameplayTuning(source, snapshot);
  assert.equal(validateCoopLevel(tuned).valid, true);
  assert.equal(tuned.rules.moveSpeed, 13.799999999999999);
  assert.equal(tuned.encounter.hunterAttackSpeed, 14);
  assert.equal(tuned.enemies.length, 7);
  assert.deepEqual(tuned.spawns, source.spawns);
  for (const enemy of tuned.enemies.slice(3))
    for (const spawn of source.spawns)
      assert(Math.hypot(enemy.x - spawn.x, enemy.y - spawn.y) >= 8);
  const run = createCoop(tuned, { difficulty: 'expert', seed: 17 });
  assert.equal(run.rules.moveSpeed, tuned.rules.moveSpeed);
  assert.equal(run.enemies.length, 7);
  const huge = team({ enemies: [{ ...team().enemies[0], vx: 12, vy: 16 }] });
  assert(
    Math.hypot(...['vx', 'vy'].map((key) => applyGameplayTuning(huge, snapshot).enemies[0][key])) <=
      20,
  );
  const angled = team({
    enemies: [{ ...team().enemies[0], vx: -7.710802229758452, vy: 6.367380071391379 }],
  });
  assert(
    validateCoopLevel(applyGameplayTuning(angled, snapshot)).valid,
    'speed cap must remain below the strict bound after floating-point rounding',
  );
});

test('identical tuned levels keep paired boards equal and replay reconstruction has no ambient preference dependency', () => {
  const level = applyGameplayTuning(solo(), resolveGameplayTuning('standard'));
  const run = createRun(level, { seed: 8 }),
    recorder = createRecorder(level, { seed: 8 });
  for (let tick = 0; tick < 120; tick++) {
    const input = { direction: 'right' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const match = createDuel(level, { seed: 8 });
  resumeDuel(match);
  for (let tick = 0; tick < 120; tick++)
    stepDuel(match, [{ direction: 'right' }, { direction: 'right' }]);
  assert.equal(
    authoritativeCheckpoint(match.runs[0]).hash,
    authoritativeCheckpoint(match.runs[1]).hash,
  );
  const historical = createRun(solo());
  assert.equal(historical.level.revision, '1');
  assert.equal(historical.rules.moveSpeed, 10);
  assert.equal(historical.enemies[0].vx, 2);
});

test('global storage persists overrides, not difficulty; snapshots do not change after settings updates', () => {
  const storage = memory(),
    controller = createGameplayTuningController({ storage });
  const old = controller.snapshot('standard');
  let notices = 0;
  const unsubscribe = controller.subscribe(() => notices++);
  controller.set({ enemySpeed: 1.5 });
  assert.equal(notices, 1);
  assert.equal(old.enemySpeed, 1.6);
  assert.equal(controller.snapshot('standard').enemySpeed, 2.4000000000000004);
  const second = createGameplayTuningController({ storage });
  assert.equal(second.snapshot('expert').enemySpeed, 3);
  assert.equal(second.status().durable, true);
  assert.deepEqual(Object.keys(JSON.parse(storage.getItem(GAMEPLAY_TUNING_STORAGE_KEY))).sort(), [
    'overrides',
    'version',
  ]);
  controller.reset();
  assert.deepEqual(controller.status().overrides, GAMEPLAY_TUNING_DEFAULTS);
  assert.equal(controller.snapshot().adminOverride, false);
  unsubscribe();
  controller.dispose();
  second.dispose();
  assert.throws(() => controller.set({ enemySpeed: 2 }), /disposed/);
});

test('failed reads/writes and corrupt storage remain truthfully session-only without deleting user data', () => {
  const storage = memory();
  storage.values.set(GAMEPLAY_TUNING_STORAGE_KEY, '{broken');
  const controller = createGameplayTuningController({ storage });
  assert.equal(controller.status().durable, false);
  assert.match(controller.status().error, /session-only/);
  assert.equal(storage.getItem(GAMEPLAY_TUNING_STORAGE_KEY), '{broken');
  storage.setItem = () => {
    throw new Error('quota');
  };
  controller.set({ enemyDensity: 0.5 });
  assert.equal(controller.snapshot().overrides.enemyDensity, 0.5);
  assert.match(controller.status().error, /quota/);
  storage.setItem = (key, value) => storage.values.set(key, value);
  controller.set({});
  assert.equal(controller.status().durable, true);
  assert.equal(controller.status().error, null);
  controller.dispose();
  const absent = createGameplayTuningController({ storage: null });
  absent.set({ playerSpeed: 1.25 });
  assert.equal(absent.snapshot().overrides.playerSpeed, 1.25);
  assert.equal(absent.status().durable, false);
  absent.dispose();
});

test('cross-tab settings apply to next snapshots without mutating a retained attempt recipe', () => {
  const storage = memory(),
    events = new EventTarget();
  const controller = createGameplayTuningController({ storage, eventTarget: events });
  const captured = controller.snapshot();
  const other = createGameplayTuningController({ storage });
  other.set({ enemySpeed: 0.75 });
  const event = new Event('storage');
  Object.assign(event, {
    key: GAMEPLAY_TUNING_STORAGE_KEY,
    newValue: storage.getItem(GAMEPLAY_TUNING_STORAGE_KEY),
    storageArea: storage,
  });
  events.dispatchEvent(event);
  assert.equal(captured.enemySpeed, 1.6);
  assert.equal(controller.snapshot().overrides.enemySpeed, 0.75);
  controller.dispose();
  other.dispose();
});

test('candidate preparation captures the exact tuning before async work, retaining authored picture identity and replay agreement', async () => {
  const { themes } = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const preparer = createContentAttemptPreparer(createOpeningCandidates(), { themes });
  const selection = {
    missionId: preparer.catalog.journey().missions[0].id,
    difficulty: 'standard',
    seed: 1,
    turnPolicy: 'immediate',
  };
  const snapshot = structuredClone(resolveGameplayTuning('standard'));
  const pending = preparer.prepare(selection, { gameplayTuning: snapshot });
  snapshot.enemySpeed = 4;
  snapshot.overrides.enemySpeed = 2;
  const prepared = await pending;
  assert.equal(prepared.tuning.enemySpeed, 1.6);
  assert.equal(prepared.tuning.adminOverride, false);
  assert.notEqual(prepared.run.level.revision, prepared.manifest.level.revision);
  assert.deepEqual(
    prepared.run.level,
    applyGameplayTuning(prepared.manifest.level, prepared.tuning),
  );
  assert.equal(verifyReplay(exportReplay(prepared.recorder, prepared.run)).match, true);
  await assert.rejects(
    preparer.prepare(selection, { gameplayTuning: resolveGameplayTuning('expert') }),
    /must match/,
  );
  assert(preparer.current(prepared), 'invalid request did not retire valid preparation');
  const legacy = await preparer.prepare(selection);
  assert.equal(legacy.tuning, undefined);
  assert.deepEqual(legacy.run.level, createRun(legacy.manifest.level).level);
  preparer.dispose();
});

test('all twelve current Team missions and the checked-in Classic pack levels validate at bounded pressure settings', async () => {
  const catalog = createContentExecutionCatalog(createTeamSpatialOriginalCandidates(), {
    mode: 'team',
  });
  let teamVariants = 0,
    classicVariants = 0;
  for (const entry of catalog.entries)
    for (const level of entry.campaign.levels)
      for (const overrides of [
        {},
        { enemySpeed: 2, playerSpeed: 1.5, enemyDensity: 2 },
        { enemySpeed: 0.5, playerSpeed: 0.75, enemyDensity: 0 },
      ]) {
        const tuned = applyGameplayTuning(
          level,
          resolveGameplayTuning(entry.difficulty, overrides),
        );
        assert(validateCoopLevel(tuned).valid, `${level.id}/${entry.difficulty}`);
        assert.equal(createCoop(tuned).totalClaimable, createCoop(level).totalClaimable);
        teamVariants++;
      }
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
            assert(
              validateLevel(
                applyGameplayTuning(level, resolveGameplayTuning(difficulty, overrides)),
              ).valid,
              `${level.id}/${difficulty}`,
            );
            classicVariants++;
          }
  }
  assert.equal(teamVariants, 108);
  assert.equal(classicVariants, 192);
});

test('all 91 current Solo missions validate across every preset and bounded override extremes', () => {
  const catalog = createContentExecutionCatalog(createWholeSortingCandidates(), { mode: 'solo' });
  let variants = 0;
  for (const entry of catalog.entries)
    for (const level of entry.campaign.levels)
      for (const overrides of [
        {},
        { enemySpeed: 2, playerSpeed: 1.5, enemyDensity: 2 },
        { enemySpeed: 0.5, playerSpeed: 0.75, enemyDensity: 0 },
      ]) {
        const tuned = applyGameplayTuning(
          level,
          resolveGameplayTuning(entry.difficulty, overrides),
        );
        assert(validateLevel(tuned).valid, `${level.id}/${entry.difficulty}`);
        assert.deepEqual(tuned.goal, level.goal);
        assert.deepEqual(tuned.spawn, level.spawn);
        assert.equal(tuned.enemies.length >= level.enemies.length, true);
        variants++;
      }
  assert.equal(variants, 819);
});
