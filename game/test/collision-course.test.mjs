import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  COLLISION_COURSE_VERSION,
  steerFieldCourse,
  varyCollisionCourse,
} from '../core/field-course.mjs';
import { createRun, stepRun, FIXED_DT, CELL, validateLevel } from '../core/index.mjs';
import { planEnemy, applyPlannedEnemy } from '../core/movement.mjs';
import { fitsClassicDomain } from '../core/classic-topology.mjs';
import { classicDomainHit, planClassicEnemy, applyClassicEnemy } from '../core/classic-motion.mjs';
import { createCoop, startCoop, stepCoop, validateCoopLevel } from '../coop/core.mjs';
import { enemyWallContact, reflectEnemy } from '../coop/geometry.mjs';
import { createCoopBonusState } from '../coop/timed-bonuses.mjs';
import { createDuel, resumeDuel, stepDuel } from '../multiplayer.mjs';
import {
  applyGameplayTuning,
  resolveGameplayTuning,
  recoverGameplayTuning,
  gameplayTuningDescription,
} from '../gameplay-tuning.mjs';
import * as v3 from '../gameplay-tuning-v3.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
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
const tuned = (level) => applyGameplayTuning(level, resolveGameplayTuning());
const commands = () => [
  { direction: null, boost: false, support: false },
  { direction: null, boost: false, support: false },
];

test('gp3 adapter stays byte-identical and released legacy/classic checkpoint goldens survive', async () => {
  const bytes = await readFile(new URL('../gameplay-tuning-v3.mjs', import.meta.url));
  assert.equal(
    createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    '82f990cbbaba7d13757d1d7b2f59ae2d4e67f233',
  );
  for (const classic of [false, true]) {
    const level = v3.applyGameplayTuning(source(classic), v3.resolveGameplayTuning());
    assert.deepEqual(applyGameplayTuning(source(classic), recoverGameplayTuning(level)), level);
    const run = createRun(level),
      recorder = createRecorder(level);
    for (let t = 0; t < 720; t++) {
      stepRun(run);
      recordInput(recorder, {});
    }
    // Captured from frozen c585bcd before changing core or the current adapter.
    assert.equal(
      authoritativeCheckpoint(run).hash,
      classic ? 'a5a0c57c17816f6a' : '7f47dcaf568116d3',
    );
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  }
});

test('new recipes opt into gp4 without changing speeds/counts or historical descriptions', () => {
  for (const original of [source(), source(true), team()]) {
    const level = tuned(original),
      old = v3.applyGameplayTuning(original, v3.resolveGameplayTuning());
    assert.match(level.revision, /^gp4s-/);
    assert.deepEqual(applyGameplayTuning(original, recoverGameplayTuning(level)), level);
    assert.deepEqual(level.rules, old.rules);
    assert.equal(level.enemies.length, old.enemies.length);
    assert.equal(level.enemies[0].course, COLLISION_COURSE_VERSION);
    near(
      Math.hypot(level.enemies[0].vx, level.enemies[0].vy),
      Math.hypot(old.enemies[0].vx, old.enemies[0].vy),
    );
    assert.throws(() => tuned(level), /exactly once/);
    assert.match(
      gameplayTuningDescription(recoverGameplayTuning(level)),
      /straight between impacts/,
    );
    assert.match(gameplayTuningDescription(recoverGameplayTuning(old)), /gradual/);
    assert.equal(
      (original.version.startsWith('revealline') ? validateCoopLevel(level) : validateLevel(level))
        .valid,
      true,
    );
  }
});

test('no elapsed-time or seed-dependent heading change is possible in open flight', () => {
  for (const [vx, vy] of [
    [11, 0],
    [0, -11],
    [7, 7],
  ]) {
    const enemy = { id: 'orb', type: 'bouncer', vx, vy, course: COLLISION_COURSE_VERSION };
    for (let tick = 0; tick < 7200; tick++) steerFieldCourse(enemy, tick % 9, tick);
    assert.equal(enemy.vx, vx);
    assert.equal(enemy.vy, vy);
  }
});

test('single-face departure stays within eight degrees, away from wall, tangential sign preserved, speed constant', () => {
  for (const axis of ['x', 'y'])
    for (const sign of [-1, 1])
      for (let degree = -89; degree <= 89; degree++) {
        const a = (degree * Math.PI) / 180;
        const normal = 11 * Math.cos(a) * sign,
          tangent = 11 * Math.sin(a);
        const enemy = {
          id: 'orb',
          type: 'bouncer',
          x: degree,
          y: 10.75,
          vx: axis === 'x' ? normal : tangent,
          vy: axis === 'x' ? tangent : normal,
          course: COLLISION_COURSE_VERSION,
        };
        const before = Math.atan2(enemy.vy, enemy.vx);
        varyCollisionCourse(enemy, axis === 'x' ? sign : 0, axis === 'y' ? sign : 0, 17);
        const delta = Math.atan2(
          Math.sin(Math.atan2(enemy.vy, enemy.vx) - before),
          Math.cos(Math.atan2(enemy.vy, enemy.vx) - before),
        );
        assert(Math.abs(delta) <= (8 * Math.PI) / 180 + 1e-10);
        near(Math.hypot(enemy.vx, enemy.vy), 11);
        assert((axis === 'x' ? enemy.vx : enemy.vy) * sign > 0);
        if (tangent)
          assert.equal(Math.sign(axis === 'x' ? enemy.vy : enemy.vx), Math.sign(tangent));
      }
});

test('ambiguous corners, separating contacts, stationary and non-field roles retain ordinary reflection', () => {
  for (const props of [{}, { type: 'border-patrol' }, { vx: 0, vy: 0 }]) {
    const enemy = {
      id: 'orb',
      type: 'bouncer',
      x: 2,
      y: 2,
      vx: 3,
      vy: 4,
      course: COLLISION_COURSE_VERSION,
      ...props,
    };
    const before = structuredClone(enemy);
    varyCollisionCourse(enemy, 1, -1, 17);
    assert.deepEqual(enemy, before);
    varyCollisionCourse(enemy, -1, 0, 17);
    assert.deepEqual(enemy, before);
  }
  const make = () => ({
    id: 'orb',
    type: 'drifter',
    x: 1.25,
    y: 2,
    vx: -4,
    vy: 0,
    course: COLLISION_COURSE_VERSION,
  });
  const one = make(),
    duplicate = make();
  reflectEnemy(one, [{ nx: 1, ny: 0 }], 17);
  reflectEnemy(
    duplicate,
    [
      { nx: 1, ny: 0 },
      { nx: 1, ny: 0 },
    ],
    17,
  );
  assert.deepEqual(one, duplicate);
  assert(one.vx > 0 && one.vy !== 0);
  const corner = { ...make(), vx: -3, vy: -4 };
  reflectEnemy(
    corner,
    [
      { nx: 1, ny: 0 },
      { nx: 0, ny: 1 },
    ],
    17,
  );
  assert(corner.vx > 0 && corner.vy > 0);
  near(Math.hypot(corner.vx, corner.vy), 5);
});

for (const classic of [false, true])
  test(`${classic ? 'Classic' : 'Legacy'} live headings change only on physical contacts, routes vary, and replay exactly`, () => {
    for (const [vx, vy] of [
      [4, 0],
      [0, -4],
      [3, 3],
    ]) {
      const original = source(classic);
      Object.assign(original.enemies[0], { vx, vy });
      const level = tuned(original),
        run = createRun(level, { seed: 17 }),
        recorder = createRecorder(level, { seed: 17 });
      const slopes = new Set();
      let impacts = 0;
      for (let t = 0; t < 2400; t++) {
        const e = run.enemies[0],
          before = { ...e },
          end = { x: e.x + e.vx * FIXED_DT, y: e.y + e.vy * FIXED_DT };
        const contact = classicDomainHit(run, e, end, e.radius, CELL.FIELD);
        stepRun(run);
        recordInput(recorder, {});
        if (!contact) {
          assert.equal(e.vx, before.vx);
          assert.equal(e.vy, before.vy);
        } else impacts++;
        assert(fitsClassicDomain(run, e, e.radius - 1e-7, CELL.FIELD));
        near(Math.hypot(e.vx, e.vy), 11.05);
        slopes.add(Math.atan2(Math.abs(e.vy), Math.abs(e.vx)).toFixed(4));
      }
      assert(impacts > 2);
      assert(slopes.size > 2, `${vx},${vy}: ${[...slopes]} across ${impacts} impacts`);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    }
  });

test('legacy speculative plan publishes only the reached rebound, with exact unscaled velocity', () => {
  const run = createRun(tuned(source())),
    enemy = run.enemies[0];
  Object.assign(enemy, { x: 46.7, y: 10.5, vx: 11.05, vy: 0, slowUntil: 10, slowFactor: 0.5 });
  const original = structuredClone(enemy),
    plan = planEnemy(run, enemy, 0.1);
  assert.deepEqual(enemy, original);
  const impact = plan.paths[0].t1;
  assert(impact > 0 && impact < 0.05);
  const before = structuredClone(enemy),
    after = structuredClone(enemy);
  applyPlannedEnemy(before, plan, impact / 2, 0.1, run);
  assert.equal(before.vx, original.vx);
  assert.equal(before.vy, 0);
  applyPlannedEnemy(after, plan, impact + 0.001, 0.1, run);
  near(Math.hypot(after.vx, after.vy), 11.05);
  assert(after.vx < 0 && after.vy !== 0);
  assert.equal(after.vx, plan.paths[1].courseVelocity.vx);
  const exact = structuredClone(enemy),
    endPlan = planEnemy(run, enemy, impact);
  applyPlannedEnemy(exact, endPlan, impact, impact, run);
  near(exact.vx, after.vx);
  near(exact.vy, after.vy);
});

test('Team open-flight invariance, seed parity and lawful variable bounces', () => {
  const a = createCoop(tuned(team()), { seed: 17 }),
    b = createCoop(tuned(team()), { seed: 17 });
  startCoop(a);
  startCoop(b);
  const slopes = new Set();
  for (let t = 0; t < 2400; t++) {
    const e = a.enemies[0],
      before = { ...e },
      contact = enemyWallContact(a, e, FIXED_DT);
    stepCoop(a, commands());
    stepCoop(b, commands());
    if (!contact) {
      assert.equal(e.vx, before.vx);
      assert.equal(e.vy, before.vy);
    }
    near(Math.hypot(e.vx, e.vy), 11.05);
    assert(fitsClassicDomain(a, e, e.radius - 1e-7, CELL.FIELD));
    slopes.add(Math.atan2(Math.abs(e.vy), Math.abs(e.vx)).toFixed(4));
  }
  assert(slopes.size > 2);
  assert.deepEqual(a.enemies, b.enemies);
});

test('equal-seeded Versus boards retain exact fairness', () => {
  const duel = createDuel(tuned(source(true)), { seed: 17 });
  resumeDuel(duel);
  for (let t = 0; t < 1800; t++) stepDuel(duel, [{}, {}]);
  assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
});

test('Classic speculative impact waits for contact and does not perturb a promised attack', () => {
  const run = createRun(tuned(source(true))),
    enemy = run.enemies[0];
  Object.assign(enemy, { x: 70.7, y: 10.5, vx: 11.05, vy: 0 });
  const original = structuredClone(enemy),
    plan = planClassicEnemy(run, enemy, 0.1);
  assert.deepEqual(enemy, original);
  assert.equal(plan.event.kind, 'domain-hit');
  const before = structuredClone(enemy),
    after = structuredClone(enemy);
  applyClassicEnemy(before, plan, plan.event.time / 2, 0.1);
  assert.equal(before.vx, 11.05);
  assert.equal(before.vy, 0);
  applyClassicEnemy(after, plan, plan.event.time, 0.1);
  assert(after.vx < 0 && after.vy !== 0);
  enemy.classic = { pressure: { phase: 'warning' } };
  const warning = planClassicEnemy(run, enemy, 0.1);
  near(warning.enemy.vx, -11.05);
  near(warning.enemy.vy, 0);
});

test('stun expiry adds no turn debt, and seeded departure never reads the player', () => {
  const run = createRun(tuned(source(true)));
  run.ability.fields.push({ kind: 'stun-field', x: 10.5, y: 10.5, radius: 2, until: 3 });
  for (let t = 0; t < 360; t++) stepRun(run);
  near(run.enemies[0].x, 10.5);
  near(run.enemies[0].vy, 0);
  for (let t = 0; t < 30; t++) stepRun(run);
  near(run.enemies[0].vy, 0);
  const make = () => ({
    id: 'orb',
    type: 'bouncer',
    x: 46.75,
    y: 10.5,
    vx: -11,
    vy: 0,
    course: COLLISION_COURSE_VERSION,
  });
  const a = make(),
    b = make(),
    c = make();
  varyCollisionCourse(a, -1, 0, 17);
  varyCollisionCourse(b, -1, 0, 17);
  varyCollisionCourse(c, -1, 0, 19);
  assert.deepEqual(a, b);
  // The seed may select the same clamped incidence; use an oblique vector to
  // check independent seed choice without assuming a random sign flip.
  for (const e of [a, c]) Object.assign(e, { vx: -8, vy: 8 });
  varyCollisionCourse(a, -1, 0, 17);
  varyCollisionCourse(c, -1, 0, 19);
  assert.notDeepEqual([a.vx, a.vy], [c.vx, c.vy]);
});

test('one-cell corridor never escapes or exceeds collision horizon', () => {
  const original = source(true);
  original.walls = [
    { x: 1, y: 1, w: 70, h: 9 },
    { x: 1, y: 11, w: 70, h: 24 },
  ];
  const run = createRun(tuned(original), { seed: 71 });
  for (let t = 0; t < 3600; t++) {
    stepRun(run);
    assert(fitsClassicDomain(run, run.enemies[0], 0.25 - 1e-7, CELL.FIELD));
    near(Math.hypot(run.enemies[0].vx, run.enemies[0].vy), 11.05);
  }
});

test('Solo and Team freeze leave heading/position unchanged, with no deferred turn on expiry', () => {
  const run = createRun(tuned(source(true))),
    coop = createCoop(tuned(team()), { seed: 17 });
  startCoop(coop);
  run.classic.effects['enemy-freeze'] = { from: 0, until: 360 };
  coop.bonuses = createCoopBonusState({ schedules: [] });
  coop.bonuses.effects['enemy-freeze'] = { from: 0, until: 360 };
  for (let t = 0; t < 350; t++) {
    stepRun(run);
    stepCoop(coop, commands());
  }
  for (const state of [run, coop]) {
    near(state.enemies[0].x, 10.5);
    near(state.enemies[0].vy, 0);
  }
  for (let t = 0; t < 20; t++) {
    stepRun(run);
    stepCoop(coop, commands());
  }
  for (const state of [run, coop]) {
    assert(state.enemies[0].x > 10.5);
    near(state.enemies[0].vy, 0);
  }
});
