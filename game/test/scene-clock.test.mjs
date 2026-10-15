import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneClock } from '../ui/scene-clock.mjs';

test('native 30 through 144 Hz schedules advance the same authoritative time past startup', () => {
  for (const hz of [30, 60, 90, 120, 144]) {
    const clock = createSceneClock();
    clock.sample(0, true);
    let seconds = 0;
    for (let frame = 1; frame <= hz * 10; frame++)
      seconds += clock.sample((frame * 1000) / hz, true).elapsedSeconds;
    assert.ok(Math.abs(seconds - 10) < 1e-9, `${hz} Hz must retain real elapsed time`);
  }
});

test('cadence changes and exact interruption boundary preserve time without hiding long frames', () => {
  const clock = createSceneClock();
  clock.sample(0, true);
  let now = 0;
  for (const delta of [1000 / 60, 1000 / 30, 1000 / 90, 100, 249, 250]) {
    now += delta;
    const result = clock.sample(now, true);
    assert.ok(Math.abs(result.elapsedSeconds - delta / 1000) < 1e-9);
    assert.equal(result.interrupted, false);
  }
  for (const delta of [251, 500]) {
    now += delta;
    assert.deepEqual(clock.sample(now, true), {
      elapsedSeconds: 0,
      rawElapsedMs: delta,
      interrupted: true,
    });
  }
});

test('pauses, readiness, lifecycle resets and regressing timestamps do not create catch-up debt', () => {
  const clock = createSceneClock();
  const reused = clock.sample(100, false);
  assert.strictEqual(clock.sample(200, false), reused);
  assert.equal(clock.sample(100000, true).elapsedSeconds, 0);
  assert.equal(clock.sample(100016, true).elapsedSeconds, 0.016);
  assert.equal(clock.sample(100000, true).elapsedSeconds, 0);
  assert.equal(clock.sample(NaN, true).elapsedSeconds, 0);
  assert.equal(clock.sample(100032, true).elapsedSeconds, 0.016);
  clock.reset();
  assert.equal(clock.sample(200000, { active: true }).elapsedSeconds, 0);
  assert.equal(clock.sample(200016, true).elapsedSeconds, 0.016);
});
