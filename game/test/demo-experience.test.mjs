import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDemoIdle,
  createDemoPractice,
  createDemoCaptions,
  readDemoSettings,
} from '../demo-experience.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const level = {
  version: 'xonix-level.v1',
  id: 'practice-clock',
  revision: '1',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  goal: { coverage: 0.9 },
  enemies: [{ id: 'anchor', type: 'bouncer', x: 39.5, y: 25.5, vx: 0, vy: 0 }],
};

test('idle countdown counts only contiguous eligible foreground frames', () => {
  const idle = createDemoIdle(1);
  assert.equal(idle.advance(0.25, true), false);
  assert.equal(idle.advance(30, true), false);
  for (let i = 0; i < 3; i++) assert.equal(idle.advance(0.25, true), false);
  assert.equal(idle.advance(0.25, false), false);
  for (let i = 0; i < 3; i++) assert.equal(idle.advance(0.25, true), false);
  assert.equal(idle.advance(0.25, true), true);
  idle.advance(0.25, true);
  idle.activity();
  for (let i = 0; i < 3; i++) assert.equal(idle.advance(0.25, true), false);
});

test('reduced-motion default is manual; malformed preferences fail safely', () => {
  const storage = (value) => ({ getItem: () => value });
  assert.deepEqual(readDemoSettings(storage(null), 'demo', true), {
    auto: false,
    collect: false,
    gameSounds: false,
  });
  assert.deepEqual(readDemoSettings(storage('{broken'), 'demo'), {
    auto: true,
    collect: false,
    gameSounds: false,
  });
  assert.deepEqual(readDemoSettings(storage('{"version":1,"auto":false,"collect":true}'), 'demo'), {
    auto: false,
    collect: true,
    gameSounds: false,
  });
  assert.deepEqual(
    readDemoSettings(storage('{"version":1,"auto":true,"collect":true,"extra":1}'), 'demo', true),
    { auto: false, collect: false, gameSounds: false },
  );
});

test('demo sound preference is opt-in and preserves existing v1 settings', () => {
  const stored = { version: 1, auto: false, collect: true, gameSounds: true };
  const storage = { getItem: () => JSON.stringify(stored) };
  assert.deepEqual(readDemoSettings(storage, 'demo'), {
    auto: false,
    collect: true,
    gameSounds: true,
  });
  stored.gameSounds = 'yes';
  assert.deepEqual(readDemoSettings(storage, 'demo'), {
    auto: true,
    collect: false,
    gameSounds: false,
  });
});

test('practice waits for fresh steering, consumes input at real ticks, and suspends long gaps', () => {
  const practice = createDemoPractice(createRun(level));
  let reads = 0;
  const controls = () => {
    reads++;
    return {};
  };
  practice.advance(0.1, controls);
  assert.equal(reads, 0);
  assert.equal(practice.state.tick, 0);
  practice.steer('down');
  practice.advance(FIXED_DT / 2, controls);
  assert.equal(reads, 0, 'an impulse is retained across a frame shorter than one tick');
  practice.advance(FIXED_DT / 2, controls);
  assert.equal(reads, 1);
  assert.equal(practice.state.tick, 1);
  const checkpoint = authoritativeCheckpoint(practice.state);
  assert.equal(practice.advance(8, controls).reason, 'frame-gap');
  assert.deepEqual(authoritativeCheckpoint(practice.state), checkpoint);
  practice.advance(0.1, controls);
  assert.equal(reads, 1, 'visibility return does not advance or consume input');
  practice.steer('right');
  practice.advance(FIXED_DT, controls);
  assert.equal(practice.state.tick, 2);
  const paused = authoritativeCheckpoint(practice.state);
  practice.pause();
  assert.deepEqual(
    authoritativeCheckpoint(practice.state),
    paused,
    'pausing preserves the displayed checkpoint',
  );
});

test('direct takeover applies its initiating action once at the first real tick without inventing steering', () => {
  for (const [action, field] of [
    ['ability', 'action'],
    ['pickup', 'pickup'],
    ['boost', 'boost'],
  ]) {
    const options = action === 'pickup' ? { classId: 'bomber' } : {};
    const source = {
      ...level,
      supplies: [{ id: 'home', x: level.spawn.x, y: level.spawn.y, radius: 2 }],
      objectives: [{ id: 'hidden', x: level.spawn.x, y: 8, required: false, hidden: true }],
    };
    const practice = createDemoPractice(createRun(source, options)),
      expected = createRun(source, options);
    practice.start({ action });
    assert.equal(practice.phase, 'playing');
    practice.advance(FIXED_DT / 2);
    assert.equal(practice.state.tick, 0, 'The pending first action survives a sub-tick frame.');
    practice.advance(FIXED_DT / 2);
    stepRun(expected, { [field]: true }, FIXED_DT);
    assert.deepEqual(authoritativeCheckpoint(practice.state), authoritativeCheckpoint(expected));
    const result = practice.advance(FIXED_DT);
    stepRun(expected, {}, FIXED_DT);
    assert.deepEqual(authoritativeCheckpoint(practice.state), authoritativeCheckpoint(expected));
    assert.ok(!result.events.some((event) => event.type === 'ability.rejected'));
  }
  const practice = createDemoPractice(createRun(level));
  practice.start({ direction: 'down', action: 'ability' });
  practice.pause();
  practice.steer('right');
  assert.ok(!practice.advance(FIXED_DT).events.some((event) => event.type === 'ability.used'));
});

test('captions use emitted core events and maintain a six-second reading interval', () => {
  const captions = createDemoCaptions();
  captions.reset();
  for (let i = 0; i < 23; i++) assert.equal(captions.advance(0.25), 'demo:tipStart');
  assert.equal(captions.advance(0.25, [{ type: 'lineImpact.seeded' }]), 'demo:tipImpact');
  assert.equal(captions.advance(0.25, [{ type: 'powerup.collected' }]), 'demo:tipImpact');
  for (let i = 0; i < 22; i++) assert.equal(captions.advance(0.25), 'demo:tipImpact');
  assert.equal(captions.advance(0.25), 'demo:tipPowerup');
});
