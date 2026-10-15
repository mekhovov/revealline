import test from 'node:test';
import assert from 'node:assert/strict';
import { createPerformanceSession } from '../ui/performance-session.mjs';

test('bounded samples preserve startup, pause-causing stalls and session totals after eviction', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now, capacity: 2 });
  now = 400;
  session.recordFrame(now, 50, 10, 5, 3);
  session.setPhase('playing', now);
  session.recordFrame((now += 16));
  session.setPhase('paused', (now += 500));
  session.interruption(500);
  session.recordFrame(now);
  session.recordFrame((now += 16));
  const data = session.export({ paused: true });
  assert.equal(data.frames.count, 4);
  assert.equal(data.frames.maxMs, 500);
  assert.equal(data.frames.over250ms, 2);
  assert.equal(data.phases.boot.frames.maxMs, 400);
  assert.equal(data.phases.playing.frames.maxMs, 500);
  assert.equal(data.retainedFrameCount, 2);
  assert.equal(data.omittedFrameCount, 2);
  assert.deepEqual(data.interruptions, { count: 1, maxMs: 500 });
  assert.equal(data.stages.update.maxMs, 50);
  assert.equal(
    data.frames.histogram.reduce((sum, n) => sum + n, 0),
    4,
  );
  assert.equal(data.durationMs, 932);
});

test('hidden intervals remain visible without being attributed to active gameplay', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  session.setPhase('playing');
  session.recordFrame((now += 16));
  session.setPhase('hidden');
  now += 10000;
  session.setPhase('paused');
  session.recordFrame(now);
  const data = session.export({ paused: true });
  assert.equal(data.phases.hidden.frames.maxMs, 10000);
  assert.equal(data.phases.playing.frames.over250ms, 0);
  assert.equal(data.phases.hidden.durationMs, 10000);
});

test('input timing is once-per-token, bounded and measures submitted draws only after ticks', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  const input = session.input('controller', 2);
  session.rendered(input, 3);
  session.tick(input, 5);
  session.tick(input, 7);
  session.rendered(input, 10);
  session.rendered(input, 15);
  for (let i = 0; i < 40; i++) session.input('touch', i);
  now = 50;
  const data = session.export({ paused: true });
  assert.equal(data.inputLatency.byKind.controller.toTick.count, 1);
  assert.equal(data.inputLatency.byKind.controller.toTick.maxMs, 3);
  assert.equal(data.inputLatency.byKind.controller.toRender.maxMs, 8);
  assert.equal(data.inputLatency.pending, 32);
  assert.equal(data.inputLatency.overwritten, 8);
});

test('exports require an explicit paused caller and unsupported counters stay unavailable', () => {
  const session = createPerformanceSession({ now: () => 0 });
  assert.throws(() => session.export(), /Pause gameplay/);
  assert.deepEqual(session.export({ paused: true }).longTasks, { supported: false });
  session.setObserverSupport({ longTask: true });
  session.longTask(75);
  session.longTask(NaN);
  assert.equal(session.export({ paused: true }).longTasks.maxMs, 75);
  assert.deepEqual(session.export({ paused: true }).longAnimationFrames, { supported: false });
});

test('discarding input on lifecycle changes retires unfinished latency observations', () => {
  const session = createPerformanceSession({ now: () => 0 });
  const token = session.input('keyboard', 1);
  session.input('pointer', 2);
  session.tick(token, 3);
  assert.equal(session.discardInputs(), 2);
  assert.equal(session.discardInputs(), 0);
  session.rendered(token, 4);
  const data = session.export({ paused: true });
  assert.equal(data.inputLatency.pending, 0);
  assert.equal(data.inputLatency.cancelled, 2);
  assert.equal(data.inputLatency.byKind.keyboard.toTick.count, 1);
  assert.equal(data.inputLatency.byKind.keyboard.toRender.count, 0);
});

test('failure evidence retains bounded messages, phase and totals only when enabled', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  session.setPhase('preparing');
  for (let i = 0; i < 20; i++) session.reportFailure(`Failure ${i}`, ++now);
  session.reportFailure('x'.repeat(800), ++now);
  session.setEnabled(false);
  session.reportFailure('not recorded', ++now);
  const data = session.export({ paused: true });
  assert.equal(data.failures.count, 21);
  assert.equal(data.failures.recent.length, 16);
  assert.equal(data.failures.recent[0].message, 'Failure 5');
  assert.equal(data.failures.recent.at(-1).message.length, 512);
  assert.equal(data.failures.recent.at(-1).phase, 'preparing');
  assert.equal(data.failures.recent.at(-1).atMs, 21);
});

test('explicit cadence baseline counts missed opportunities and consecutive misses without changing during play', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  assert.equal(session.setBaseline(10), true);
  session.setPhase('playing');
  session.recordFrame((now += 10));
  session.recordFrame((now += 30), 5, 1, 2, 3, 9);
  session.recordFrame((now += 20), 4, 1, 1, 2);
  session.recordFrame((now += 10), 2, 1, 1, 1);
  assert.equal(session.setBaseline(20), false);
  const data = session.export({ paused: true });
  assert.equal(data.baselineMs, 10);
  assert.equal(data.phases.playing.frames.missedOpportunities, 3);
  assert.equal(data.phases.playing.frames.maxMissedStreak, 3);
  assert.equal(data.phases.playing.frames.currentMissedStreak, 0);
  assert.equal(data.phases.playing.work.maxMs, 9);
  assert.equal(data.phases.playing.work.p95UpperBoundMs, 9);
  assert.equal(data.stages.work.maxMs, 9);
  assert.equal(data.phases.playing.stages.hud.maxMs, 2);
});

test('worst foreground hitches survive recent-ring eviction and hidden suspension', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now, capacity: 2 });
  session.setPhase('playing');
  session.recordFrame((now += 16));
  session.recordFrame((now += 417), 12, 8);
  for (let i = 0; i < 50; i++) session.recordFrame((now += 16));
  session.setPhase('hidden');
  now += 20000;
  session.setPhase('paused');
  session.recordFrame(now);
  const data = session.export({ paused: true });
  assert.equal(
    data.recentFrames.some((row) => row.intervalMs === 417),
    false,
  );
  assert.equal(data.worstHitches.length, 16);
  assert.equal(data.worstHitches[0].intervalMs, 417);
  assert.equal(data.worstHitches[0].phase, 'playing');
  assert.equal(data.worstHitches[0].drawMs, 8);
});

test('disabled collection is inert and resource inspection runs only on explicit paused export', () => {
  let now = 0,
    snapshots = 0;
  const session = createPerformanceSession({
    now: () => now,
    enabled: false,
    resourceSnapshot: () => ({ owned: ++snapshots }),
  });
  session.setPhase('playing');
  session.recordFrame((now += 500), 10, 5);
  assert.equal(session.input('keyboard'), 0);
  session.interruption(500);
  session.longTask(100);
  assert.equal(snapshots, 0);
  assert.throws(() => session.export(), /Pause/);
  assert.equal(snapshots, 0);
  let data = session.export({ paused: true });
  assert.equal(data.frames.count, 0);
  assert.equal(data.interruptions.count, 0);
  assert.deepEqual(data.resources, { owned: 1 });
  session.setEnabled(true);
  session.recordFrame((now += 16));
  data = session.export({ paused: true });
  assert.equal(data.frames.maxMs, 16);
  assert.equal(data.phases.playing.durationMs, 16);
  assert.equal(snapshots, 2);
});
