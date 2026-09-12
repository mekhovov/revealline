import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  stepRun,
  replayRun,
  getSummary,
  releaseInputs,
  FIXED_DT,
} from '../core/index.mjs';
const level = {
  version: 'xonix-level.v1',
  id: 'movement',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 6.5, y: 0.5 },
  goal: { coverage: 1 },
  enemies: [{ id: 'e', type: 'bouncer', x: 38.5, y: 28.5, vx: 1.3, vy: 1.7 }],
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('immediate changes direction, stops and boosts without sprite-heading authority', () => {
  const s = createRun(level);
  stepRun(s, { direction: 'right' }, 0.025);
  near(s.player.x, 6.7);
  stepRun(s, { direction: 'down' }, 0.025);
  near(s.player.x, 6.7);
  near(s.player.y, 0.7);
  stepRun(s, {}, 0.025);
  near(s.player.y, 0.7);
  assert.equal(s.player.speed, 0);
  stepRun(s, { direction: 'right', boost: true }, 0.025);
  near(s.player.x, 7);
});

test('grid turns consume a last-command-wins request at the next cell center with leftover movement', () => {
  const s = createRun(level, { turnPolicy: 'grid-center' });
  stepRun(s, { direction: 'right' }, 0.025);
  near(s.player.x, 6.7);
  stepRun(s, { direction: 'down' }, 0.025);
  near(s.player.x, 6.9);
  near(s.player.y, 0.5);
  assert.equal(s.player.queuedDirection, 'down');
  stepRun(s, { direction: 'left' }, 0.1);
  near(s.player.x, 7.3);
  near(s.player.y, 0.5);
  assert.equal(s.player.direction, 'left');
});

test('grid release clears queue and stops; a held new request resumes retained axis to a center', () => {
  const s = createRun(level, { turnPolicy: 'grid-center' });
  stepRun(s, { direction: 'right' }, 0.025);
  stepRun(s, { direction: 'down' }, FIXED_DT);
  const x = s.player.x;
  stepRun(s, {}, 0.2);
  near(s.player.x, x);
  assert.equal(s.player.queuedDirection, null);
  stepRun(s, { direction: 'down' }, 0.1);
  near(s.player.x, 7.5);
  assert.ok(s.player.y > 0.5);
  releaseInputs(s);
  assert.equal(s.player.queuedDirection, null);
  assert.equal(s.player.speed, 0);
});

test('all four grid edges can stop and accept a perpendicular escape', () => {
  for (const [x, y, out, escape] of [
    [0.5, 10.5, 'left', 'up'],
    [47.5, 10.5, 'right', 'up'],
    [10.5, 0.5, 'up', 'right'],
    [10.5, 35.5, 'down', 'right'],
  ]) {
    const s = createRun({ ...level, spawn: { x, y } }, { turnPolicy: 'grid-center' });
    stepRun(s, { direction: out }, 0.1);
    near(s.player.x, x);
    near(s.player.y, y);
    stepRun(s, { direction: escape }, 0.1);
    assert.ok(Math.abs(s.player.x - x) + Math.abs(s.player.y - y) > 0.7);
  }
});

test('grid stops at the reachable center before a wall and can reverse or turn away', () => {
  for (const turn of ['left', 'up', 'down']) {
    const s = createRun(
      { ...level, walls: [{ x: 5, y: 4, w: 1, h: 1 }] },
      { turnPolicy: 'grid-center' },
    );
    Object.assign(s.player, { x: 3.5, y: 4.5 });
    for (let y = 2; y < 7; y++) for (let x = 2; x < 5; x++) s.cells[y * 48 + x] = 1;
    stepRun(s, { direction: 'right' }, 0.5);
    near(s.player.x, 4.5);
    near(s.player.y, 4.5);
    stepRun(s, { direction: turn }, 0.1);
    assert.ok(Math.abs(s.player.x - 4.5) + Math.abs(s.player.y - 4.5) > 0.79);
  }
});

test('grid recovery grace stays at a safe center and permits movement along the rail', () => {
  const s = createRun(level, { turnPolicy: 'grid-center' });
  s.player.graceUntil = 1;
  stepRun(s, { direction: 'down' }, 0.1);
  near(s.player.y, 0.5);
  stepRun(s, { direction: 'right' }, 0.1);
  near(s.player.x, 7.3);
  assert.equal(s.player.cutting, false);
});

test('same held-command trace is invariant at 10/20/30/60/120/240 render FPS', () => {
  for (const policy of ['immediate', 'grid-center']) {
    const snapshots = [];
    for (const fps of [10, 20, 30, 60, 120, 240]) {
      const s = createRun(level, { seed: 765, turnPolicy: policy });
      for (const command of [
        { direction: 'right' },
        { direction: 'down', boost: true },
        { direction: 'right' },
        {},
      ])
        for (let i = 0; i < fps / 2; i++) stepRun(s, command, 1 / fps);
      snapshots.push({
        summary: getSummary(s),
        player: s.player,
        enemies: s.enemies,
        trail: s.trail,
        cells: [...s.cells],
      });
    }
    for (const snapshot of snapshots) assert.deepEqual(snapshot, snapshots[0]);
  }
});

test('one input per fixed tick replays identical full authoritative state', () => {
  const inputs = Array.from({ length: 400 }, (_, n) => ({
    direction: n < 60 ? 'right' : n < 180 ? 'down' : n < 300 ? 'right' : null,
    boost: n >= 100 && n < 150,
    action: n === 20,
  }));
  const options = { seed: 123, turnPolicy: 'grid-center', classId: 'scout' },
    a = createRun(level, options);
  for (const input of inputs) stepRun(a, input);
  const b = replayRun(level, options, inputs);
  assert.deepEqual(b, a);
});

test('not stepping is pause; zero elapsed advances no ability timer or actor', () => {
  const s = createRun(level);
  stepRun(s, { action: true });
  const time = s.time,
    x = s.enemies[0].x,
    cooldown = s.ability.cooldownUntil;
  releaseInputs(s);
  stepRun(s, {}, 0);
  assert.equal(s.time, time);
  assert.equal(s.enemies[0].x, x);
  assert.equal(s.ability.cooldownUntil, cooldown);
});

test('render-only metadata, seed identity and decorative heading cannot change gameplay', () => {
  const a = createRun(level),
    b = createRun({
      ...level,
      theme: 'business',
      playerSprite: 'anything.png',
      palette: { color: 'pink' },
    });
  b.player.heading = 270;
  for (let i = 0; i < 120; i++) {
    stepRun(a, { direction: 'right' });
    stepRun(b, { direction: 'right' });
  }
  assert.deepEqual(getSummary(a), getSummary(b));
  near(a.player.x, b.player.x);
  assert.deepEqual(a.cells, b.cells);
  assert.throws(() => createRun(level, { turnPolicy: 'float' }), /turnPolicy/);
  assert.throws(() => createRun(level, { classId: 'cosmetic-unlock' }), /classId/);
});

test('finite elapsed and input validation rejects malformed calls without stepping', () => {
  const s = createRun(level);
  for (const dt of [-1, NaN, Infinity, 11]) assert.throws(() => stepRun(s, {}, dt));
  assert.equal(s.tick, 0);
  assert.throws(() => stepRun(s, { direction: 'diagonal' }));
  assert.throws(() => stepRun(s, { boost: 1 }));
  assert.equal(s.tick, 0);
});

test('bouncers reflect from border and wall without entering either, while perimeter patrol crosses corners', () => {
  const source = {
    ...level,
    walls: [{ x: 30, y: 10, w: 2, h: 10 }],
    enemies: [
      { id: 'e', type: 'bouncer', x: 32.5, y: 15.5, vx: -20, vy: 14 },
      { id: 'p', type: 'border-patrol', x: 47.5, y: 0.5, speed: 10, clockwise: true },
    ],
  };
  const s = createRun(source);
  for (let i = 0; i < 1800; i++) {
    stepRun(s, {});
    const e = s.enemies[0];
    assert.equal(s.cells[Math.floor(e.y) * 48 + Math.floor(e.x)], 0);
    assert.ok(
      e.x >= 1.25 - 1e-7 && e.x <= 46.75 + 1e-7 && e.y >= 1.25 - 1e-7 && e.y <= 34.75 + 1e-7,
    );
  }
  const p = s.enemies[1];
  near(p.x, 33.5);
  near(p.y, 0.5);
});
