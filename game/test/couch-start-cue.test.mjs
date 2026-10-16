import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionStartCue, missionStartCueDuration } from '../couch/start-cue.mjs';

test('a new mission holds play through 3, 2, 1 and releases exactly at Go', () => {
  const cue = createMissionStartCue('mission');
  assert.deepEqual(cue.sample(10), { active: true, blocksPlay: true, label: '3', phase: 0 });
  assert.equal(cue.sample(709).label, '3');
  assert.equal(cue.sample(709.99999).label, '3');
  assert.equal(cue.sample(710).label, '2');
  assert.equal(cue.sample(1410).label, '1');
  assert.deepEqual(cue.sample(2110), {
    active: true,
    blocksPlay: false,
    label: 'GO',
    phase: 3,
  });
  assert.deepEqual(cue.sample(2459.99999), {
    active: true,
    blocksPlay: false,
    label: 'GO',
    phase: 3,
  });
  assert.equal(cue.sample(2460).active, false);
  assert.equal(missionStartCueDuration('mission'), 2450);
});

test('Retry uses one 600 ms ready cue and cannot release early', () => {
  const cue = createMissionStartCue('retry');
  assert.equal(cue.sample(5000).label, 'READY');
  assert.equal(cue.sample(5599).blocksPlay, true);
  assert.equal(cue.sample(5599.99999).blocksPlay, true);
  assert.deepEqual(cue.sample(5600), {
    active: true,
    blocksPlay: false,
    label: 'GO',
    phase: 1,
  });
  assert.deepEqual(cue.sample(5899.99999), {
    active: true,
    blocksPlay: false,
    label: 'GO',
    phase: 1,
  });
  assert.equal(cue.sample(5900).active, false);
  assert.equal(missionStartCueDuration('retry'), 900);
});

test('accumulated 120 Hz clocks settle the exact mission boundary', () => {
  let now = 1000;
  now += 3000;
  now += 1000 / 120;
  const startedAt = now;
  const cue = createMissionStartCue('mission');
  assert.equal(cue.sample(now).label, '3');
  for (const label of ['2', '1', 'GO']) {
    now += 700;
    assert.equal(cue.sample(now).label, label);
  }
  for (let frame = 0; frame < 42; frame++) now += 1000 / 120;
  const undershoot = missionStartCueDuration('mission') - (now - startedAt);
  assert.ok(undershoot > 0 && undershoot < 1e-6);
  assert.equal(cue.sample(now).active, false);
});

test('invalid clocks and cue kinds fail closed', () => {
  assert.throws(() => createMissionStartCue('resume'), /mission or retry/);
  const cue = createMissionStartCue('mission');
  assert.throws(() => cue.sample(Number.NaN), /finite/);
});
