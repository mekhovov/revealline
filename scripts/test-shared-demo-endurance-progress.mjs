import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoEnduranceProgress } from './shared-demo-endurance-progress.mjs';

const frame = (tick, source = 'snake:one', phase = 'playing') => ({ source, phase, tick });

test('regular watching and bounded loading progress retain the existing progress contract', () => {
  const progress = createDemoEnduranceProgress(0);
  assert.deepEqual(progress.observe(frame(10), 10000), { gapMs: 10000, sinceProgressMs: 0 });
  assert.deepEqual(progress.observe(frame(20), 20000), { gapMs: 10000, sinceProgressMs: 0 });
  assert.deepEqual(progress.observe(frame(0, '', 'loading'), 30000), {
    gapMs: 10000,
    sinceProgressMs: 0,
  });
  assert.deepEqual(progress.observe(frame(0, '', 'loading'), 40000), {
    gapMs: 10000,
    sinceProgressMs: 10000,
  });
  assert.deepEqual(progress.observe(frame(1, 'sim:two'), 50000), {
    gapMs: 10000,
    sinceProgressMs: 0,
  });
  assert.deepEqual(progress.finish(50001), { finalObservationGapMs: 1 });
});

test('a long sleep followed by a changed tick cannot erase the observation gap', () => {
  const progress = createDemoEnduranceProgress(0);
  progress.observe(frame(10), 10000);
  assert.throws(() => progress.observe(frame(11), 100000), {
    code: 'demo-endurance-observation-gap',
    gapMs: 90000,
    previousObservationAt: 10000,
    observedAt: 100000,
  });
});

test('the first sample and final edge both retain the strict forty-five-second bound', () => {
  assert.throws(() => createDemoEnduranceProgress(0).observe(frame(1), 45000), {
    code: 'demo-endurance-observation-gap',
    gapMs: 45000,
  });
  const progress = createDemoEnduranceProgress(0);
  progress.observe(frame(1), 10000);
  assert.throws(() => progress.finish(55000), {
    code: 'demo-endurance-observation-gap',
    gapMs: 45000,
  });
});

test('frequent samples with unchanged playback still fail the original nonprogress check', () => {
  const progress = createDemoEnduranceProgress(0);
  for (const at of [1000, 10000, 20000, 30000, 40000]) progress.observe(frame(1), at);
  assert.throws(() => progress.observe(frame(1), 46000), /must keep making progress/);
});

test('a clock reversal or nonfinite observation cannot qualify despite changed playback', () => {
  for (const invalid of [9999, Number.NaN, Number.POSITIVE_INFINITY]) {
    const progress = createDemoEnduranceProgress(0);
    progress.observe(frame(1), 10000);
    assert.throws(() => progress.observe(frame(2), invalid), /must stay ordered/);
  }
});
