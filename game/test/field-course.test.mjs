import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { steerFieldCourse, FIELD_COURSE_VERSION } from '../core/field-course.mjs';
import { createRun, stepRun, FIXED_DT, validateLevel, CELL } from '../core/index.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import { createCoop, startCoop, stepCoop, validateCoopLevel } from '../coop/core.mjs';
import { createCoopBonusState } from '../coop/timed-bonuses.mjs';
import { createDuel, resumeDuel, stepDuel } from '../multiplayer.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  recoverGameplayTuning,
} from '../gameplay-tuning-v3.mjs';
import * as v2 from '../gameplay-tuning-v2.mjs';
import * as v1 from '../gameplay-tuning-v1.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const near = (a, b, epsilon = 1e-8) => assert(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const source = (classic = false) => ({
  version: classic ? 'xonix-level.v4' : 'xonix-level.v1',
  id: 'course-check',
  revision: '1',
  width: classic ? 72 : 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.99 },
  rules: { moveSpeed: 8, lives: 3 },
  walls: [{ x: 24, y: 12, w: 4, h: 5 }],
  enemies: [{ id: 'orb', type: 'bouncer', x: 10.5, y: 10.5, vx: 4, vy: 0, radius: 0.25 }],
  ...(classic
    ? { encounter: null, classic: { version: 'classic.v1', terrain: [], powerups: [] } }
    : {}),
});
const tuned = (classic = false) => applyGameplayTuning(source(classic), resolveGameplayTuning());
const vector = (vx = 11, vy = 0, id = 'orb') => ({
  id,
  type: 'bouncer',
  vx,
  vy,
  course: FIELD_COURSE_VERSION,
});
const commands = () => [
  { direction: null, boost: false, support: false },
  { direction: null, boost: false, support: false },
];
const team = () => ({
  version: 'revealline-coop-level.v1',
  id: 'course-team',
  revision: '1',
  name: 'Course',
  width: 72,
  height: 36,
  spawns: [
    { x: 20.5, y: 0.5 },
    { x: 20.5, y: 35.5 },
  ],
  safeRects: [],
  walls: source().walls,
  goal: { coverage: 0.99 },
  enemies: [{ ...source().enemies[0], type: 'drifter' }],
});

test('v2 adapter remains byte-identical; current dispatch reproduces historical recipes and checkpoints', async () => {
  const bytes = await readFile(new URL('../gameplay-tuning-v2.mjs', import.meta.url));
  assert.equal(
    createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    'f961327ac7bf463ddc6d8e9e0b167102bcac14a1',
  );
  for (const historical of [v1, v2]) {
    const level = historical.applyGameplayTuning(source(), historical.resolveGameplayTuning());
    const reconstructed = applyGameplayTuning(source(), recoverGameplayTuning(level));
    assert.deepEqual(reconstructed, level);
    const a = createRun(level),
      b = createRun(reconstructed);
    const recorder = createRecorder(level);
    for (let t = 0; t < 720; t++) {
      stepRun(a);
      stepRun(b);
      recordInput(recorder, {});
    }
    assert.deepEqual(authoritativeCheckpoint(a), authoritativeCheckpoint(b));
    // Captured independently from the released v0.87 source, not this new core.
    assert.equal(
      authoritativeCheckpoint(a).hash,
      historical === v1 ? 'cabdf00a3134230f' : 'b38537215b5e089e',
    );
    assert.equal(verifyReplay(exportReplay(recorder, a)).match, true);
    assert(!Object.hasOwn(a.enemies[0], 'course'));
    near(a.enemies[0].vy, 0);
  }
});

test('historical gp3 attempts preserve speeds/preferences and reconstruct exact recipes', () => {
  const level = tuned();
  assert.match(level.revision, /^gp3s-/);
  assert.equal(recoverGameplayTuning(level).version, 'gameplay-pressure.v3');
  assert.equal(level.enemies[0].course, FIELD_COURSE_VERSION);
  near(level.rules.moveSpeed, 8.84);
  near(Math.hypot(level.enemies[0].vx, level.enemies[0].vy), 11.05);
  assert.deepEqual(applyGameplayTuning(source(), recoverGameplayTuning(level)), level);
  for (const snapshot of [
    resolveGameplayTuning(),
    v1.resolveGameplayTuning(),
    v2.resolveGameplayTuning(),
  ])
    assert.throws(() => applyGameplayTuning(level, snapshot), /exactly once/);
});

test('horizontal, vertical and diagonal courses vary gradually without changing magnitude', () => {
  for (const [vx, vy] of [
    [11, 0],
    [0, -11],
    [7, 7],
  ]) {
    const enemy = vector(vx, vy),
      speed = Math.hypot(vx, vy),
      angles = new Set();
    for (let tick = 0; tick < 3600; tick++) {
      const angle = Math.atan2(enemy.vy, enemy.vx);
      steerFieldCourse(enemy, 17, tick);
      near(Math.hypot(enemy.vx, enemy.vy), speed);
      const delta = Math.atan2(
        Math.sin(Math.atan2(enemy.vy, enemy.vx) - angle),
        Math.cos(Math.atan2(enemy.vy, enemy.vx) - angle),
      );
      assert(Math.abs(delta) < 0.033, 'turn must stay below 1.9 degrees per fixed tick');
      if (tick < 120) {
        near(enemy.vx, vx);
        near(enemy.vy, vy);
      }
      angles.add(Math.atan2(enemy.vy, enemy.vx).toFixed(2));
    }
    assert(angles.size > 100, 'must not remain a repeating fixed-angle billiard');
  }
});

test('seed and actor ID choose independent deterministic courses without consuming shared RNG', () => {
  const path = (seed, id) => {
    const enemy = vector(11, 0, id);
    const trace = [];
    for (let t = 0; t < 1800; t++) {
      steerFieldCourse(enemy, seed, t);
      if (t % 120 === 0) trace.push([enemy.vx, enemy.vy]);
    }
    return trace;
  };
  assert.deepEqual(path(17, 'orb'), path(17, 'orb'));
  assert.notDeepEqual(path(17, 'orb'), path(18, 'orb'));
  assert.notDeepEqual(path(17, 'orb'), path(17, 'other'));
});

test('unsupported, stationary, and domain-incompatible course descriptors are rejected', () => {
  for (const mutation of [
    (e) => (e.course = 'random'),
    (e) => (e.vx = 0),
    (e) => (e.type = 'border-patrol'),
  ]) {
    const bad = structuredClone(tuned());
    mutation(bad.enemies[0]);
    assert.equal(validateLevel(bad).valid, false);
  }
  const bad = applyGameplayTuning(team(), resolveGameplayTuning());
  for (const mutation of [
    (e) => (e.course = 'random'),
    (e) => (e.vx = 0),
    (e) => (e.type = 'hunter'),
  ]) {
    const copy = structuredClone(bad);
    mutation(copy.enemies[0]);
    assert.equal(validateCoopLevel(copy).valid, false);
  }
});

for (const classic of [false, true])
  test(`${classic ? 'Classic' : 'Legacy'} Solo curves stay in field through swept wall/border collisions and replay exactly`, () => {
    const level = tuned(classic),
      run = createRun(level, { seed: 17 }),
      recorder = createRecorder(level, { seed: 17 });
    let altered = false;
    for (let t = 0; t < 2400; t++) {
      stepRun(run, {}, FIXED_DT);
      recordInput(recorder, {});
      assert(fitsClassicDomain(run, run.enemies[0], run.enemies[0].radius - 1e-7, CELL.FIELD));
      near(Math.hypot(run.enemies[0].vx, run.enemies[0].vy), 11.05);
      altered ||= Math.abs(run.enemies[0].vy) > 1;
    }
    assert(altered);
    assert.equal(run.status, 'running');
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  });

test('Versus equal inputs and seeds preserve exact parity across multiple curves', () => {
  const duel = createDuel(tuned(true), { seed: 17 });
  resumeDuel(duel);
  for (let t = 0; t < 1200; t++) stepDuel(duel, [{}, {}]);
  assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
  assert(Math.abs(duel.runs[0].enemies[0].vy) > 1);
});

test('Team drifters share curves and remain in their domain, identical seeds agree', () => {
  const level = applyGameplayTuning(team(), resolveGameplayTuning()),
    a = createCoop(level, { seed: 17 }),
    b = createCoop(level, { seed: 17 });
  startCoop(a);
  startCoop(b);
  for (let t = 0; t < 2400; t++) {
    stepCoop(a, commands());
    stepCoop(b, commands());
    assert(fitsClassicDomain(a, a.enemies[0], a.enemies[0].radius - 1e-7, CELL.FIELD));
    near(Math.hypot(a.enemies[0].vx, a.enemies[0].vy), 11.05);
  }
  assert.deepEqual(a.enemies, b.enemies);
  assert(Math.abs(a.enemies[0].vy) > 1);
});

test('freeze and stun do not change heading, and no skipped turn is caught up afterward', () => {
  const run = createRun(tuned(true));
  run.classic.effects['enemy-freeze'] = { from: 0, until: 400 };
  for (let t = 0; t < 360; t++) stepRun(run);
  near(run.enemies[0].vy, 0);
  near(run.enemies[0].x, 10.5);
  run.classic.effects['enemy-freeze'].until = run.tick;
  run.ability.fields.push({ kind: 'stun-field', x: 10.5, y: 10.5, radius: 2, until: run.time + 3 });
  for (let t = 0; t < 360; t++) stepRun(run);
  near(run.enemies[0].vy, 0);
  near(run.enemies[0].x, 10.5);
  stepRun(run);
  near(run.enemies[0].vy, 0);
});

test('stationary keepers and all non-field roles keep their authored movement contracts', () => {
  const original = source();
  original.enemies.push({ id: 'patrol', type: 'border-patrol', x: 0.5, y: 10.5, speed: 4 });
  original.enemies[0].vx = 0;
  const level = applyGameplayTuning(original, resolveGameplayTuning());
  assert(level.enemies.every((e) => !Object.hasOwn(e, 'course')));
  const enemy = { ...vector(), type: 'border-patrol' },
    before = structuredClone(enemy);
  for (let t = 0; t < 720; t++) steerFieldCourse(enemy, 17, t);
  assert.deepEqual(enemy, before);
});

test('telegraphed pursuit warning and commitment suppress ordinary course changes', () => {
  const level = source(true);
  level.spawn.x = 50.5;
  level.enemies[0].x = 60.5;
  level.classic.enemyPressure = {
    version: 'enemy-pressure.v1',
    actors: [
      {
        id: 'orb',
        mode: 'trail-pursuit',
        senseRadius: 24,
        scanTicks: 24,
        warningTicks: 180,
        commitTicks: 120,
        cooldownTicks: 180,
        leadTicks: 0,
      },
    ],
  };
  const curved = applyGameplayTuning(level, resolveGameplayTuning()),
    straight = structuredClone(curved);
  delete straight.enemies[0].course;
  const a = createRun(curved, { seed: 17 }),
    b = createRun(straight, { seed: 17 });
  let warning = 0,
    committed = 0;
  for (let t = 0; t < 230; t++) {
    stepRun(a, { direction: 'down' });
    stepRun(b, { direction: 'down' });
    const phase = a.enemies[0].classic.pressure.phase;
    if (phase === 'warning' || phase === 'committed') {
      near(a.enemies[0].vx, b.enemies[0].vx);
      near(a.enemies[0].vy, b.enemies[0].vy);
      near(a.enemies[0].x, b.enemies[0].x);
      near(a.enemies[0].y, b.enemies[0].y);
      warning += Number(phase === 'warning');
      committed += Number(phase === 'committed');
    }
  }
  assert(warning >= 120);
  assert(committed > 0);
});

test('curves cannot escape a one-cell field corridor or exhaust the collision horizon', () => {
  const level = source(true);
  level.walls = [
    { x: 1, y: 1, w: 70, h: 9 },
    { x: 1, y: 11, w: 70, h: 24 },
  ];
  const run = createRun(applyGameplayTuning(level, resolveGameplayTuning()), { seed: 71 });
  for (let t = 0; t < 3600; t++) {
    stepRun(run);
    assert(fitsClassicDomain(run, run.enemies[0], 0.25 - 1e-7, CELL.FIELD));
    near(Math.hypot(run.enemies[0].vx, run.enemies[0].vy), 11.05);
  }
});

test('Team freeze suppresses steering as well as displacement without a recovery jump', () => {
  const run = createCoop(applyGameplayTuning(team(), resolveGameplayTuning()), { seed: 17 });
  startCoop(run);
  run.bonuses = createCoopBonusState({ schedules: [] });
  run.bonuses.effects['enemy-freeze'] = { from: 0, until: 360 };
  for (let t = 0; t < 360; t++) stepCoop(run, commands());
  near(run.enemies[0].x, 10.5);
  near(run.enemies[0].vy, 0);
  stepCoop(run, commands());
  near(run.enemies[0].vy, 0);
  near(run.enemies[0].x, 10.5 + 11.05 / 120);
});
