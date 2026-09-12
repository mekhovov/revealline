import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, validateLevel, CELL, FIXED_DT } from '../core/index.mjs';
import { commitCapture } from '../core/capture.mjs';

const base = (extra = {}) => ({
  version: 'xonix-level.v1',
  id: 'test',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.8 },
  enemies: [{ id: 'east', type: 'bouncer', x: 38.5, y: 20.5, vx: 0, vy: 0 }],
  ...extra,
});
const run = (extra = {}, options = {}) => createRun(base(extra), options);
function cutFixture(state, x = 24) {
  state.trail = Array.from({ length: 34 }, (_, n) => ({ x, y: n + 1, index: (n + 1) * 48 + x }));
  state.trailSegments = [{ x1: x + 0.5, y1: 1, x2: x + 0.5, y2: 35 }];
  state.player.cutting = true;
}

test('validation rejects malformed geometry, unsupported actors and unsafe spawn without mutation', () => {
  const level = base(),
    copy = structuredClone(level);
  assert.deepEqual(validateLevel(level), { valid: true, errors: [] });
  assert.deepEqual(level, copy);
  for (const change of [
    { width: 47 },
    { spawn: { x: 24.5, y: 3.5 } },
    { spawn: { x: 4.1, y: 0.5 } },
    { walls: [{ x: 0, y: 2, w: 3, h: 2 }] },
    { enemies: [{ id: 'x', type: 'unknown', x: 2.5, y: 2.5 }] },
    { rules: { moveSpeed: Infinity } },
    { rules: { trailRadius: 0.1 } },
    { goal: { coverage: 0 } },
  ])
    assert.equal(validateLevel({ ...level, ...change }).valid, false);
  assert.throws(
    () => createRun({ ...level, walls: [{ x: 38, y: 20, w: 1, h: 1 }] }),
    /Invalid level/,
  );
});

test('run normalization owns nested rule data and rejects prototype-shaped unsupported keys', () => {
  const source = base({ rules: { timeMedals: [20, 40] } }),
    s = createRun(source);
  source.rules.timeMedals[0] = 900;
  assert.equal(s.rules.timeMedals[0], 20);
  assert.equal(validateLevel(base({ rules: JSON.parse('{"__proto__":1}') })).valid, false);
  assert.equal(
    validateLevel(
      base({ enemies: [{ id: 'p', type: 'border-patrol', x: 0.5, y: 20.5, radius: -1 }] }),
    ).valid,
    false,
  );
});

test('enemy-seeded fill claims the enemy-free side plus secured trail exactly once', () => {
  const s = run();
  cutFixture(s);
  commitCapture(s);
  assert.equal(s.claimedCount, 24 * 34);
  assert.equal(s.totalClaimable, 46 * 34);
  assert.equal(s.cells[20 * 48 + 38], CELL.FIELD);
  const score = s.score;
  commitCapture(s);
  assert.equal(s.score, score);
  assert.equal(s.claimedCount, 24 * 34);
});

test('both sides with anchors retain both regions and award only the trail', () => {
  const s = run({
    enemies: [
      { id: 'a', type: 'bouncer', x: 8.5, y: 20.5, vx: 0, vy: 0 },
      { id: 'b', type: 'bouncer', x: 38.5, y: 20.5, vx: 0, vy: 0 },
    ],
  });
  cutFixture(s);
  commitCapture(s);
  assert.equal(s.claimedCount, 34);
  assert.equal(s.cells[20 * 48 + 8], CELL.FIELD);
  assert.equal(s.cells[20 * 48 + 38], CELL.FIELD);
});

test('no field anchors claims all remaining interior, border patrol does not retain it', () => {
  const s = run({ enemies: [{ id: 'p', type: 'border-patrol', x: 0.5, y: 20.5, speed: 0 }] });
  cutFixture(s);
  commitCapture(s);
  assert.equal(s.coverage, 1);
  assert.equal(s.claimedCount, 1564);
});

test('walls and outer border excluded from numerator and denominator; objectives are once only', () => {
  const s = run({
    walls: [{ x: 5, y: 5, w: 2, h: 3 }],
    objectives: [{ id: 'o', x: 8.5, y: 10.5, required: true }],
  });
  cutFixture(s);
  commitCapture(s);
  assert.equal(s.totalClaimable, 1558);
  assert.equal(s.claimedCount, 810);
  assert.equal(s.cells[5 * 48 + 5], CELL.WALL);
  assert.equal(s.objectives[0].captured, true);
  const score = s.score;
  commitCapture(s);
  assert.equal(s.score, score);
  assert.equal(s.events.filter((e) => e.type === 'objective.captured').length, 1);
});

test('four-neighbor fill retains all seeded pockets rather than only the largest', () => {
  const s = run({
    enemies: [
      { id: 'a', type: 'bouncer', x: 8.5, y: 8.5, vx: 0, vy: 0 },
      { id: 'b', type: 'bouncer', x: 38.5, y: 28.5, vx: 0, vy: 0 },
    ],
  });
  cutFixture(s);
  for (let x = 1; x < 47; x++) if (x !== 24) s.trail.push({ x, y: 18, index: 18 * 48 + x });
  commitCapture(s);
  assert.equal(s.cells[8 * 48 + 8], CELL.FIELD);
  assert.equal(s.cells[28 * 48 + 38], CELL.FIELD);
  assert.equal(s.cells[28 * 48 + 8], CELL.SAFE);
  assert.equal(s.cells[8 * 48 + 38], CELL.SAFE);
});

test('a real continuous cut wins and terminal result cannot duplicate', () => {
  const s = run({ goal: { coverage: 0.45 } });
  let completed = 0;
  for (let i = 0; i < 700; i++) {
    stepRun(s, { direction: 'down' });
    completed += s.events.filter((e) => e.type === 'run.completed').length;
  }
  assert.equal(s.status, 'won');
  assert.equal(completed, 1);
  assert.equal(s.claimedCount, 816);
  assert.equal(s.medal, 'gold');
  const snapshot = JSON.stringify({ ...s, events: [] });
  stepRun(s, { direction: 'left', action: true }, 2);
  assert.equal(JSON.stringify(s), snapshot);
});

test('actual campaign first level completes its instructed straight cut in both policies', () => {
  const source = JSON.parse(
    readFileSync(new URL('../content/campaign.json', import.meta.url), 'utf8'),
  ).levels[0];
  for (const turnPolicy of ['immediate', 'grid-center']) {
    const s = createRun(source, { turnPolicy });
    for (let i = 0; i < 600 && s.status === 'running'; i++) stepRun(s, { direction: 'down' });
    assert.equal(s.status, 'won', turnPolicy);
    assert.equal(s.lives, 3);
    assert.equal(s.claimedCount, 816);
  }
});

test('straight cuts do not self-collide at floating point cell boundaries over varied speeds', () => {
  for (const turnPolicy of ['immediate', 'grid-center'])
    for (const moveSpeed of [1, 2.4, 8, 10, 12, 20])
      for (const boost of [false, true]) {
        const s = run({ goal: { coverage: 0.4 }, rules: { moveSpeed } }, { turnPolicy });
        for (let i = 0; i < 5000 && s.status === 'running'; i++)
          stepRun(s, { direction: 'down', boost });
        assert.equal(s.status, 'won', `${turnPolicy} speed${moveSpeed} boost${boost}`);
        assert.equal(s.lives, 3);
        assert.equal(s.claimedCount, 816);
      }
});

test('all cardinal cut directions and multiple ordinary exposed corners preserve the live trail', () => {
  for (const turnPolicy of ['immediate', 'grid-center']) {
    for (const [direction, spawn] of [
      ['up', { x: 24.5, y: 35.5 }],
      ['right', { x: 0.5, y: 18.5 }],
      ['left', { x: 47.5, y: 18.5 }],
    ]) {
      const s = run(
        {
          spawn,
          goal: { coverage: 0.4 },
          rules: { moveSpeed: 10 },
          enemies: [{ id: 'e', type: 'bouncer', x: 38.5, y: 28.5, vx: 0, vy: 0 }],
        },
        { turnPolicy },
      );
      for (let i = 0; i < 700 && s.status === 'running'; i++) stepRun(s, { direction });
      assert.equal(s.status, 'won', `${turnPolicy} ${direction}`);
      assert.equal(s.lives, 3);
    }
    const s = run(
      { spawn: { x: 12.5, y: 0.5 }, goal: { coverage: 0.1 }, rules: { moveSpeed: 10 } },
      { turnPolicy },
    );
    for (const [direction, count] of [
      ['down', 120],
      ['right', 240],
      ['up', 120],
    ])
      for (let i = 0; i < count; i++) stepRun(s, { direction });
    assert.equal(s.status, 'won', `${turnPolicy} bent cut`);
    assert.equal(s.lives, 3);
  }
});

test('coverage alone cannot win while a required objective remains in retained region', () => {
  const s = run({
    goal: { coverage: 0.45 },
    objectives: [{ id: 'o', x: 38.5, y: 28.5, required: true }],
  });
  for (let i = 0; i < 530; i++) stepRun(s, { direction: 'down' });
  assert.equal(s.status, 'running');
  assert.ok(s.coverage > 0.45);
  assert.equal(s.objectives[0].captured, false);
});

test('enemy swept contact tied exactly with closure cancels capture before reward', () => {
  const s = run({ goal: { coverage: 0.4 } });
  cutFixture(s);
  s.trailSegments[0].y2 = 35 - 1 / 30;
  s.player.x = 24.5;
  s.player.y = 35 - 1 / 30;
  Object.assign(s.enemies[0], { x: 25.25 + 1 / 30, y: 20.5, vx: -8, vy: 0 });
  stepRun(s, { direction: 'down' });
  assert.equal(s.lives, 2);
  assert.equal(s.status, 'respawning');
  assert.equal(s.claimedCount, 0);
  assert.equal(s.score, 0);
  assert.ok(s.events.some((e) => e.type === 'player.failed'));
  assert.ok(!s.events.some((e) => e.type === 'cut.closed'));
});

test('closure just before contact commits first and enemy remains outside claimed topology', () => {
  const s = run({ goal: { coverage: 0.4 } });
  cutFixture(s);
  s.trailSegments[0].y2 = 35 - 1 / 30;
  s.player.x = 24.5;
  s.player.y = 35 - 1 / 30;
  Object.assign(s.enemies[0], { x: 25.3, y: 20.5, vx: -8, vy: 0 });
  stepRun(s, { direction: 'down' });
  assert.equal(s.status, 'won');
  assert.equal(s.lives, 3);
  assert.equal(s.claimedCount, 816);
  assert.ok(s.enemies[0].x > 25.25);
});

test('stopping does not make a live trail safe from swept enemy movement', () => {
  const s = run();
  cutFixture(s);
  s.player.x = 24.5;
  s.player.y = 34.5;
  Object.assign(s.enemies[0], { x: 25.3, y: 20.5, vx: -20, vy: 0 });
  stepRun(s, { direction: null }, FIXED_DT);
  assert.equal(s.lives, 2);
  assert.equal(s.trail.length, 0);
});

test('self reversal loses life even with an active shield; three failures emit one loss', () => {
  const s = run({}, { classId: 'interceptor' });
  let terminal = 0;
  for (let life = 3; life > 0; life--) {
    Object.assign(s.player, { x: 24.5, y: 4.5, cutting: true, graceUntil: 0, direction: 'down' });
    s.status = 'running';
    s.trail = [
      { x: 24, y: 1, index: 72 },
      { x: 24, y: 2, index: 120 },
      { x: 24, y: 3, index: 168 },
      { x: 24, y: 4, index: 216 },
    ];
    s.trailSegments = [{ x1: 24.5, y1: 1, x2: 24.5, y2: 4.5 }];
    s.ability.shieldUntil = s.time + 1;
    stepRun(s, { direction: 'up' });
    assert.equal(s.lives, life - 1);
    terminal += s.events.filter((e) => e.type === 'run.completed').length;
  }
  assert.equal(s.status, 'lost');
  assert.equal(terminal, 1);
  stepRun(s, {});
  assert.deepEqual(s.events, []);
});

test('wall contact blocks movement without closing or destroying a valid live cut', () => {
  const s = run({ walls: [{ x: 24, y: 6, w: 2, h: 2 }] });
  for (let i = 0; i < 200; i++) stepRun(s, { direction: 'down' });
  assert.ok(Math.abs(s.player.y - 5.82) < 1e-7);
  assert.equal(s.lives, 3);
  assert.equal(s.player.cutting, true);
  assert.equal(s.claimedCount, 0);
});
