import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightBenchmark,
  overflightBenchmarkMeasureAt,
} from '../overflight/benchmark.mjs';
import { overflightRememberedOperationURL } from '../overflight/operation-view.mjs';

test('native late timing requires an explicit finite benchmark trial and admitted earned review build', () => {
  const source = 'benchmark=1&trial=1&reviewBuild=fan-shield&measureAt=160';
  for (const trial of ['1', '2', '3']) {
    const params = new URLSearchParams(source);
    params.set('trial', trial);
    assert.equal(overflightBenchmarkMeasureAt(params, { reviewBuild: 'fan-shield' }), 160);
  }
  for (const value of ['0', '160.5', '360']) {
    const params = new URLSearchParams(source);
    params.set('measureAt', value);
    assert.equal(
      overflightBenchmarkMeasureAt(params, { reviewBuild: 'fan-shield' }),
      Number(value),
    );
  }
  for (const value of ['', ' ', '-1', '361', 'Infinity', 'NaN', '0x10', '1e2', '160seconds']) {
    const params = new URLSearchParams(source);
    params.set('measureAt', value);
    assert.equal(overflightBenchmarkMeasureAt(params, { reviewBuild: 'fan-shield' }), null);
  }
  for (const [key, value] of [
    ['benchmark', '0'],
    ['trial', 'soak'],
    ['trial', '4'],
    ['measureAt', null],
  ]) {
    const params = new URLSearchParams(source);
    if (value === null) params.delete(key);
    else params.set(key, value);
    assert.equal(overflightBenchmarkMeasureAt(params, { reviewBuild: 'fan-shield' }), null);
  }
  assert.equal(overflightBenchmarkMeasureAt(new URLSearchParams(source)), null);
  assert.equal(
    overflightBenchmarkMeasureAt(new URLSearchParams(source), {
      reviewBuild: 'fan-shield',
      fixture: 'reference',
    }),
    null,
  );
  const home = new URL(
    'https://example.test/game/overflight/play.html?family=1&measureAt=160&benchmark=1&trial=1&lang=uk',
  );
  const restored = new URL(overflightRememberedOperationURL(home.href, 'overflight-riy'));
  assert.equal(restored.searchParams.has('measureAt'), false);
  assert.equal(restored.searchParams.get('lang'), 'uk');
});

test('pending late timing collects no cadence or submissions and retains the complete threshold-crossing interval', () => {
  const benchmark = createOverflightBenchmark({ measureAt: 160, repetitions: 1, stopAtEnd: true });
  benchmark.frame(0, true, 'playing', 0);
  benchmark.submission(4, 0);
  benchmark.frame(1000, true, 'playing', 159.9);
  benchmark.submission(4, 1000);
  let report = benchmark.snapshot({ raw: true });
  assert.equal(report.protocol.scheduledStart.pending, true);
  assert.equal(report.protocol.scheduledStart.actualGameplaySeconds, null);
  assert.equal(report.measuredIntervals, 0);
  assert.equal(report.rawSubmission.length, 0);
  assert.equal(benchmark.complete(), false);

  benchmark.frame(1400, true, 'upgrade', 160.01);
  benchmark.submission(3, 1400);
  report = benchmark.snapshot({ raw: true });
  assert.deepEqual(
    report.rawIntervals.map(({ intervalMs }) => intervalMs),
    [400],
  );
  assert.equal(report.protocol.scheduledStart.actualGameplaySeconds, 160.01);
  assert.equal(report.protocol.scheduledStart.pending, false);
  assert.equal(report.over100Ms, 1);
  assert.equal(report.rawSubmission.length, 1);
  // Draft time is still foreground rendering, despite a frozen simulation clock.
  for (let now = 1416; now <= 151016; now += 16) benchmark.frame(now, true, 'upgrade', 160.01);
  report = benchmark.snapshot();
  assert.equal(benchmark.complete(), true);
  assert.equal(report.protocol.warmupSeconds, 30);
  assert.equal(report.protocol.measurementSeconds, 120);
  assert.equal(report.protocol.windows[0].complete, true);
  assert.ok(report.protocol.windows[0].phaseCoverage.upgrade.samples > 7000);
  assert.equal(report.protocol.scheduledStart.measurementGameplaySeconds, 160.01);
});

test('lifecycle interruptions before arming remain invalid after the full late window', () => {
  for (const reason of ['manual-pause', 'hidden', 'context-lost', 'dropped-catch-up-time']) {
    const benchmark = createOverflightBenchmark({
      measureAt: 160,
      warmupSeconds: 0,
      measurementSeconds: 1,
      repetitions: 1,
    });
    benchmark.frame(0, true, 'playing', 0);
    benchmark.frame(16, true, 'playing', 10);
    if (reason === 'manual-pause') benchmark.frame(32, false, 'paused', 10);
    else benchmark.exclude(reason);
    benchmark.frame(48, true, 'playing', 159.9);
    benchmark.frame(64, true, 'playing', 160);
    for (let now = 80; now <= 1088; now += 16) benchmark.frame(now, true, 'playing', 161);
    const report = benchmark.snapshot();
    assert.equal(report.protocol.windows[0].complete, true);
    assert.equal(report.valid, false, reason);
    assert.equal(report.protocol.acceptance, false, reason);
    assert.ok(report.invalidReasons.includes(reason === 'manual-pause' ? 'interrupted' : reason));
  }
});

test('late measurement keeps long foreground intervals and an absent option preserves the original protocol', () => {
  const benchmark = createOverflightBenchmark({
    measureAt: 1,
    warmupSeconds: 0,
    measurementSeconds: 1,
    repetitions: 1,
  });
  benchmark.frame(0, true, 'playing', 0);
  benchmark.frame(16, true, 'playing', 1);
  benchmark.frame(266, true, 'upgrade', 1);
  assert.equal(benchmark.snapshot({ raw: true }).rawIntervals[1].intervalMs, 250);
  assert.equal(benchmark.snapshot().protocol.windows[0].cadenceMs.worst, 250);
  const standard = createOverflightBenchmark(),
    explicit = createOverflightBenchmark({ measureAt: null });
  for (const clock of [standard, explicit]) {
    clock.frame(0, true);
    clock.frame(16, true);
    clock.submission(2, 16);
    clock.frame(266, true, 'upgrade');
  }
  assert.deepEqual(standard.snapshot({ raw: true }), explicit.snapshot({ raw: true }));
  assert.equal(Object.hasOwn(standard.snapshot().protocol, 'scheduledStart'), false);
  for (const value of [-1, 361, NaN, Infinity, '160'])
    assert.throws(() => createOverflightBenchmark({ measureAt: value }));
});
