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

test('explicit continuous foreground title stalls require two windows and retain reduction dwell', () => {
  const policy = createVisualQualityPolicy();
  policy.observe(0, 16, 1, true);
  policy.observe(600, 600, 1, true);
  policy.observe(1200, 600, 1, true);
  assert.equal(policy.snapshot().tier, 'full');
  policy.observe(1800, 600, 1, true);
  policy.observe(2400, 600, 1, true);
  assert.equal(policy.snapshot().tier, 'reduced');
  for (let now = 3000; now <= 12000; now += 600) policy.observe(now, 600, 1, true);
  assert.equal(policy.snapshot().tier, 'reduced');
  policy.observe(12600, 600, 1, true);
  assert.equal(
    policy.snapshot().tier,
    'reduced',
    'Dwell eligibility is applied at a complete window.',
  );
  policy.observe(13200, 600, 1, true);
  assert.equal(policy.snapshot().tier, 'minimal');
});

test('title stall admission does not alter ordinary interruption, cheap30Hz or safe recovery contracts', () => {
  const ordinary = createVisualQualityPolicy();
  for (let now = 0; now < 20000; now += 600) ordinary.observe(now, 600, 1);
  assert.equal(ordinary.snapshot().tier, 'full');
  const title = createVisualQualityPolicy();
  for (let now = 0; now < 20000; now += 1000 / 30) title.observe(now, 1000 / 30, 1, true);
  assert.equal(title.snapshot().tier, 'full');
  title.safeTransition(20000);
  for (let now = 20000; now <= 22400; now += 600) title.observe(now, 600, 1, true);
  assert.equal(title.snapshot().tier, 'reduced');
  for (let now = 23000; now < 36500; now += 1000 / 60) title.observe(now, 1000 / 60, 1, true);
  assert.equal(title.snapshot().tier, 'reduced', 'Headroom cannot restore during the title visit.');
  assert.equal(title.safeTransition(36500).tier, 'full');
});

test('foreground title stalls cannot combine across an explicit ownership boundary', () => {
  const policy = createVisualQualityPolicy();
  for (let now = 0; now <= 1200; now += 600) policy.observe(now, 600, 1, true);
  policy.safeTransition(1300);
  for (let now = 1400; now <= 2600; now += 600) policy.observe(now, 600, 1, true);
  assert.equal(policy.snapshot().tier, 'full');
});

// Prime the first inclusive window cheaply. Every following window has exactly
// forty 25ms observations, so two over-budget samples are exactly five percent.
function tailPolicy(baseline = 25) {
  const policy = createVisualQualityPolicy();
  policy.setBaseline(baseline);
  policy.observe(0, 25, 2);
  return { policy, now: workWindow(policy, 0, 0) };
}

function workWindow(policy, start, expensiveSamples = 3, expensiveWork = 12) {
  let now = start;
  for (let index = 0; index < 40; index++) {
    now += 25;
    policy.observe(now, 25, index < expensiveSamples ? expensiveWork : 2);
  }
  return now;
}

test('repeated work tails request relief despite a low mean and steady cadence', () => {
  const { policy, now: start } = tailPolicy();
  // Each full window has 37*2+3*12=110ms work: mean 2.75ms, no missed
  // cadence samples and one interval bin. The prior predicates do not overload.
  let now = workWindow(policy, start);
  assert.equal(policy.snapshot().tier, 'full', 'One tail window is insufficient.');
  workWindow(policy, now);
  assert.equal(policy.snapshot().tier, 'reduced');
});

test('work-tail admission is strict at both the work budget and five-percent fraction', () => {
  for (const [samples, cost] of [
    [2, 12],
    [40, 10],
  ]) {
    const { policy, now: start } = tailPolicy();
    let now = start;
    for (let window = 0; window < 12; window++) now = workWindow(policy, now, samples, cost);
    assert.equal(policy.snapshot().tier, 'full', samples + ' samples at ' + cost + 'ms');
  }
  const { policy, now } = tailPolicy();
  const first = workWindow(policy, now, 3, 10.001);
  workWindow(policy, first, 3, 10.001);
  assert.equal(policy.snapshot().tier, 'reduced');
});

test('work tails use the smaller ten-ms and native-baseline budget without altering baseline cadence', () => {
  for (const baseline of [4, 8, 16, 25, 50]) {
    const { policy, now } = tailPolicy(baseline);
    const cost = Math.min(10, baseline * 0.6) + 0.001;
    const first = workWindow(policy, now, 3, cost);
    workWindow(policy, first, 3, cost);
    assert.equal(policy.snapshot().tier, 'reduced', 'Baseline ' + baseline + 'ms');
  }
  const cheap = createVisualQualityPolicy();
  cheap.setBaseline(1000 / 30);
  feed(cheap, 0, 30, 1000 / 30, 2);
  assert.equal(cheap.snapshot().tier, 'full', 'Cheap stable 30Hz still retains decoration.');
  const costly = createVisualQualityPolicy();
  costly.setBaseline(1000 / 30);
  feed(costly, 0, 2.2, 1000 / 30, 11);
  assert.equal(costly.snapshot().tier, 'reduced', 'The ten-ms cap also applies at 30Hz.');
});

test('one tail window and isolated over-budget callbacks cannot become sustained overload', () => {
  const { policy, now: start } = tailPolicy();
  let now = start;
  for (let pair = 0; pair < 12; pair++) {
    now = workWindow(policy, now);
    assert.equal(policy.snapshot().tier, 'full');
    now = workWindow(policy, now, 1);
    assert.equal(policy.snapshot().tier, 'full');
  }
});

test('tail windows cannot join across pause-owner transitions, interruption or baseline reset', () => {
  for (const boundary of ['safe-transition', 'interruption', 'baseline']) {
    const { policy, now: start } = tailPolicy();
    let now = workWindow(policy, start);
    assert.equal(policy.snapshot().tier, 'full');
    if (boundary === 'safe-transition') policy.safeTransition(now);
    else if (boundary === 'baseline') policy.setBaseline(25);
    else {
      now += 251;
      policy.observe(now, 251, 2);
    }
    // The first sample starts the reset window; neither its bounded tail nor the
    // next completed window may inherit the old owner's overload count.
    policy.observe(now, 25, 2);
    now = workWindow(policy, now);
    assert.equal(policy.snapshot().tier, 'full', boundary);
    workWindow(policy, now);
    assert.equal(policy.snapshot().tier, 'reduced', boundary);
  }
});

test('continued work tails preserve the ten-second dwell between presentation reductions', () => {
  const { policy, now: start } = tailPolicy();
  let now = workWindow(policy, start);
  now = workWindow(policy, now);
  assert.equal(now, 3000);
  assert.equal(policy.snapshot().tier, 'reduced');
  for (let window = 0; window < 9; window++) now = workWindow(policy, now);
  assert.equal(now, 12000);
  assert.equal(policy.snapshot().tier, 'reduced');
  workWindow(policy, now);
  assert.equal(policy.snapshot().tier, 'minimal');
});

test('tail-driven relief restores only at a safe transition and retains the reduced preference floor', () => {
  const { policy, now: start } = tailPolicy();
  let now = workWindow(policy, start);
  now = workWindow(policy, now);
  for (let window = 0; window < 12; window++) now = workWindow(policy, now, 0);
  assert.equal(policy.snapshot().tier, 'reduced', 'Headroom alone cannot restore during play.');
  assert.equal(policy.safeTransition(now).tier, 'full');
  const preferred = tailPolicy();
  preferred.policy.setReducedPreference(true);
  const first = workWindow(preferred.policy, preferred.now);
  workWindow(preferred.policy, first);
  assert.equal(preferred.policy.snapshot().tier, 'minimal');
});
