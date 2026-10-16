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

function feedCadence(policy, start, seconds, intervals, workMs = 2) {
  let now = start;
  for (let i = 0; now - start < seconds * 1000; i++) {
    assert.ok(i < 10000, 'The synthetic schedule has a finite sample bound.');
    const frameMs = intervals[i % intervals.length];
    now += frameMs;
    policy.observe(now, frameMs, workMs);
  }
  return now;
}

test('sustained irregular delivery with cheap callbacks requires two windows and retains the reduction dwell', () => {
  const policy = createVisualQualityPolicy();
  const irregular = [1000 / 60, 1000 / 60, 50];
  let now = feedCadence(policy, 0, 1.1, irregular);
  assert.equal(policy.snapshot().tier, 'full');
  now = feedCadence(policy, now, 1.3, irregular);
  assert.equal(policy.snapshot().tier, 'reduced');
  now = feedCadence(policy, now, 7, irregular);
  assert.equal(policy.snapshot().tier, 'reduced');
  feedCadence(policy, now, 4, irregular);
  assert.equal(policy.snapshot().tier, 'minimal');
});

test('steady native and browser-limited rates retain quality despite bounded timestamp jitter', () => {
  for (const baselineHz of [60, 120]) {
    for (const hz of [30, 40, 45, 60, 90, 120, 144]) {
      const policy = createVisualQualityPolicy();
      policy.setBaseline(1000 / baselineHz);
      const frame = 1000 / hz;
      feedCadence(policy, 0, 32, [frame - 0.75, frame + 0.75]);
      assert.equal(policy.snapshot().tier, 'full', `Baseline ${baselineHz}Hz, steady ${hz}Hz`);
    }
  }
});

test('separated stable cadence steps cannot become consecutive irregular windows', () => {
  for (const offset of [0.1, 0.45, 0.8]) {
    const policy = createVisualQualityPolicy();
    let now = feedCadence(policy, 0, offset, [1000 / 60]);
    for (const hz of [120, 60, 30, 90, 144, 30, 60]) {
      now = feedCadence(policy, now, 3.7, [1000 / hz]);
      assert.equal(policy.snapshot().tier, 'full', `Offset ${offset}s, steady step ${hz}Hz`);
    }
  }
});

test('isolated hitches and the neutral cadence band do not cause progressive reductions', () => {
  const policy = createVisualQualityPolicy();
  let now = feedCadence(policy, 0, 32, [...Array(58).fill(1000 / 60), 120]);
  assert.equal(policy.snapshot().tier, 'full');
  now = feedCadence(policy, now, 32, [24, 26]);
  assert.equal(policy.snapshot().tier, 'full');
});

test('irregular windows cannot straddle a lifecycle interruption or safe transition', () => {
  for (const boundary of ['interruption', 'transition']) {
    const policy = createVisualQualityPolicy();
    const irregular = [1000 / 60, 1000 / 60, 50];
    let now = feedCadence(policy, 0, 1.1, irregular);
    assert.equal(policy.snapshot().tier, 'full');
    if (boundary === 'interruption') {
      now += 251;
      policy.observe(now, 251, 2);
    } else policy.safeTransition(now);
    feedCadence(policy, now, 1.1, irregular);
    assert.equal(policy.snapshot().tier, 'full', boundary);
  }
});

test('irregular-delivery relief restores only at a safe transition after sustained headroom', () => {
  const policy = createVisualQualityPolicy();
  let now = feedCadence(policy, 0, 2.4, [1000 / 60, 1000 / 60, 50]);
  assert.equal(policy.snapshot().tier, 'reduced');
  now = feedCadence(policy, now, 13, [1000 / 60], 1);
  assert.equal(policy.snapshot().tier, 'reduced');
  assert.equal(policy.safeTransition(now).tier, 'full');
});

test('irregular-delivery relief respects the user preference and reuses immutable tier snapshots', () => {
  const policy = createVisualQualityPolicy();
  const reduced = policy.setReducedPreference(true);
  assert.equal(reduced.tier, 'reduced');
  assert.strictEqual(policy.observe(100, 1000 / 60, 2), reduced);
  feedCadence(policy, 100, 2.4, [1000 / 60, 1000 / 60, 50]);
  const minimal = policy.snapshot();
  assert.equal(minimal.tier, 'minimal');
  assert.strictEqual(policy.observe(4000, 1000 / 60, 2), minimal);
});

test('separated slow modes and repeated native alternation request presentation relief without causal attribution', () => {
  for (const intervals of [
    [1000 / 30, 50],
    [20, 40],
    [1000 / 60, 1000 / 30],
  ]) {
    const policy = createVisualQualityPolicy();
    feedCadence(policy, 0, 2.4, intervals);
    assert.equal(policy.snapshot().tier, 'reduced', JSON.stringify(intervals));
  }
});

test('two substantial modes still request relief when ordinary jitter splits each across a bucket edge', () => {
  const policy = createVisualQualityPolicy();
  feedCadence(policy, 0, 2.5, [33.0, 33.6, 49.7, 50.3]);
  assert.equal(policy.snapshot().tier, 'reduced');
});

test('both populations need at least four observations and twenty percent of the active window', () => {
  const few = createVisualQualityPolicy();
  feedCadence(few, 0, 32, [100, 100, 100, 100, 200, 200, 200]);
  assert.equal(
    few.snapshot().tier,
    'full',
    'Three slower observations per second are insufficient.',
  );
  const four = createVisualQualityPolicy();
  feedCadence(four, 0, 2.4, [100, 100, 100, 100, 150, 150, 150, 150]);
  assert.equal(
    four.snapshot().tier,
    'reduced',
    'Four observations in each substantial population qualify.',
  );
  const sparse = createVisualQualityPolicy();
  feedCadence(sparse, 0, 32, [...Array(34).fill(700 / 34), ...Array(6).fill(50)]);
  assert.equal(
    sparse.snapshot().tier,
    'full',
    'Six late observations at fifteen percent remain insufficient.',
  );
  const substantial = createVisualQualityPolicy();
  feedCadence(substantial, 0, 4, [...Array(32).fill(18.75), ...Array(8).fill(50)]);
  assert.equal(
    substantial.snapshot().tier,
    'reduced',
    'Twenty percent satisfies the declared population floor.',
  );
});

test('heterogeneous callbacks without missed deadlines and the admitted interval endpoint retain quality', () => {
  const policy = createVisualQualityPolicy();
  policy.setBaseline(1000 / 30);
  feedCadence(policy, 0, 32, [4, 1000 / 30], 1);
  assert.equal(
    policy.snapshot().tier,
    'full',
    'Separated fast populations have no missed deadlines.',
  );
  const endpoint = createVisualQualityPolicy();
  endpoint.setBaseline(4);
  feedCadence(endpoint, 0, 32, [250], 0.5);
  assert.equal(
    endpoint.snapshot().tier,
    'full',
    'Constant admitted 250 ms delivery remains a single mode.',
  );
});
