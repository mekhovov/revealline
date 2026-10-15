import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisualQualityPolicy } from '../ui/visual-quality-policy.mjs';

function feed(policy, start, seconds, frameMs = 1000 / 60, workMs = 14) {
  let now = start;
  for (let i = 0; i < Math.ceil((seconds * 1000) / frameMs); i++) {
    now += frameMs;
    policy.observe(now, frameMs, workMs);
  }
  return now;
}

test('quality requires two overloaded windows and ten seconds between reductions', () => {
  const policy = createVisualQualityPolicy();
  let now = feed(policy, 0, 1.1);
  assert.equal(policy.snapshot().tier, 'full');
  now = feed(policy, now, 1.1);
  assert.equal(policy.snapshot().tier, 'reduced');
  now = feed(policy, now, 8);
  assert.equal(policy.snapshot().tier, 'reduced');
  feed(policy, now, 3);
  assert.equal(policy.snapshot().tier, 'minimal');
});

test('cheap OS-limited 30 Hz does not reduce quality and native high-refresh baseline is explicit', () => {
  const policy = createVisualQualityPolicy();
  feed(policy, 0, 30, 1000 / 30, 2);
  assert.equal(policy.snapshot().tier, 'full');
  policy.setBaseline(1000 / 120);
  feed(policy, 31000, 3, 1000 / 120, 6);
  assert.equal(policy.snapshot().tier, 'reduced');
});

test('restoration needs sustained headroom and a safe transition; reduced preference remains authoritative', () => {
  const policy = createVisualQualityPolicy();
  let now = feed(policy, 0, 3);
  assert.equal(policy.snapshot().tier, 'reduced');
  policy.safeTransition(now);
  assert.equal(policy.snapshot().tier, 'reduced');
  now = feed(policy, now, 13, 1000 / 60, 1);
  assert.equal(policy.snapshot().tier, 'reduced');
  policy.setReducedPreference(true);
  assert.equal(policy.safeTransition(now).tier, 'reduced');
  assert.equal(policy.setReducedPreference(false).tier, 'full');
});

test('lifecycle gaps do not create overload windows or allocate new snapshots', () => {
  const policy = createVisualQualityPolicy();
  const full = policy.snapshot();
  policy.observe(100, 16, 14);
  policy.observe(1200, 1100, 14);
  assert.strictEqual(policy.observe(2200, 1000, 14), full);
  assert.strictEqual(policy.observe(NaN, 10, 10), full);
});

test('reduced preference starts overload reduction from the visible tier', () => {
  const policy = createVisualQualityPolicy();
  policy.setReducedPreference(true);
  feed(policy, 0, 2.2);
  assert.equal(policy.snapshot().tier, 'minimal');
});

test('two overload windows cannot straddle a safe transition', () => {
  const policy = createVisualQualityPolicy();
  const now = feed(policy, 0, 1.1);
  policy.safeTransition(now + 10000);
  feed(policy, now + 10000, 1.1);
  assert.equal(policy.snapshot().tier, 'full');
});
