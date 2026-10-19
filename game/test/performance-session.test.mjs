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

test('event witnesses keep chronological bounded rows and explicit omitted counts by kind', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  session.setPhase('playing');
  for (let i = 0; i < 300; i++)
    session.markEvent(i % 2 ? 'capture-accepted' : 'run-adopted', 1 + Math.floor(i / 10), i, ++now);
  const data = session.export({ paused: true });
  assert.equal(data.frames.count, 0, 'Event witnesses must not invent frame observations');
  assert.equal(data.eventWitnesses.total, 300);
  assert.equal(data.eventWitnesses.retained, 256);
  assert.equal(data.eventWitnesses.omitted, 44);
  assert.equal(data.eventWitnesses.rejected, 0);
  assert.deepEqual(data.eventWitnesses.recent[0], {
    atMs: 45,
    kind: 'run-adopted',
    runGeneration: 5,
    tick: 44,
    phase: 'playing',
  });
  assert.equal(data.eventWitnesses.recent.at(-1).atMs, 300);
  assert.deepEqual(data.eventWitnesses.byKind['capture-accepted'], {
    total: 150,
    retained: 128,
    omitted: 22,
  });
});

test('event witnesses reject invalid observations and disabled collection reads no clock', () => {
  let reads = 0;
  const session = createPerformanceSession({
    now: () => {
      reads++;
      return 10;
    },
  });
  session.markEvent('run-adopted', 1, 0, 10);
  session.markEvent('capture-accepted', 1, 10, 10);
  for (const args of [
    ['unknown', 1, 10, 11],
    ['capture-accepted', 0, 10, 11],
    ['capture-accepted', 1.5, 10, 11],
    ['capture-accepted', Number.MAX_SAFE_INTEGER + 1, 10, 11],
    ['capture-accepted', 1, -1, 11],
    ['capture-accepted', 1, 1.5, 11],
    ['capture-accepted', 1, 10, NaN],
    ['capture-accepted', 1, 10, Infinity],
    ['capture-accepted', 1, 10, -1],
    ['capture-accepted', 1, 10, 9],
  ])
    session.markEvent(...args);
  const before = session.export({ paused: true }).eventWitnesses;
  assert.equal(before.total, 2, 'Equal timestamps retain their insertion order');
  assert.equal(before.rejected, 10);
  session.setEnabled(false);
  const previousReads = reads;
  session.markEvent('victory-accepted', 1, 11);
  session.markEvent('unknown', -1, -1);
  assert.equal(reads, previousReads);
  assert.deepEqual(session.export({ paused: true }).eventWitnesses, before);
});

test('terminal witnesses do not reclassify prior-playing hitches or manufacture successful work', () => {
  let now = 0;
  const ordinary = createPerformanceSession({ now: () => now });
  const observed = createPerformanceSession({ now: () => now });
  for (const session of [ordinary, observed]) {
    session.setPhase('playing');
    session.recordFrame(16, 1, 1);
  }
  observed.markEvent('run-adopted', 1, 0, 0);
  observed.markEvent('capture-accepted', 1, 30, 100);
  observed.markEvent('victory-accepted', 1, 30, 100);
  observed.markEvent('terminal-work-begin', 1, 30, 101);
  // A failed terminal block has no end marker. Its original failure and the
  // following delayed callback still belong to the existing prior phase.
  for (const session of [ordinary, observed]) {
    session.reportFailure('Terminal presentation failed', 120);
    session.setPhase('error', 120);
    session.recordFrame(216, 150, 2);
  }
  now = 216;
  const expected = ordinary.export({ paused: true });
  const actual = observed.export({ paused: true });
  assert.equal(actual.phases.playing.frames.maxMs, 200);
  assert.equal(actual.phases.playing.frames.over100ms, 1);
  assert.equal(actual.eventWitnesses.byKind['terminal-work-end'].total, 0);
  assert.deepEqual(actual.failures, expected.failures);
  delete actual.eventWitnesses;
  delete expected.eventWitnesses;
  assert.deepEqual(actual, expected);
});

test('terminal HUD substages share bounded numeric event storage without changing frame attribution', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  const ordinary = createPerformanceSession({ now: () => now });
  const kinds = [
    'terminal-hud-begin',
    'terminal-hud-clocks',
    'terminal-hud-owners',
    'terminal-hud-picture',
    'terminal-hud-values',
    'terminal-hud-controls',
    'terminal-hud-end',
  ];
  for (const value of [ordinary, session]) value.setPhase('playing');
  for (let generation = 1; generation <= 40; generation++) {
    for (const kind of kinds) session.markEvent(kind, generation, 632, ++now);
  }
  // A partial final HUD remains partial. No successful end is synthesized.
  session.markEvent('terminal-hud-begin', 41, 632, ++now);
  session.reportFailure('HUD failed', now);
  ordinary.reportFailure('HUD failed', now);
  for (const value of [ordinary, session]) value.recordFrame(now + 16, 106, 0, 74, 5);
  const actual = session.export({ paused: true });
  const expected = ordinary.export({ paused: true });
  assert.equal(actual.eventWitnesses.capacity, 256);
  assert.equal(actual.eventWitnesses.total, 281);
  assert.equal(actual.eventWitnesses.retained, 256);
  assert.equal(actual.eventWitnesses.omitted, 25);
  assert.equal(actual.eventWitnesses.byKind['terminal-hud-end'].total, 40);
  assert.equal(actual.eventWitnesses.recent.at(-1).kind, 'terminal-hud-begin');
  assert.equal(actual.eventWitnesses.recent.at(-1).runGeneration, 41);
  const exported = structuredClone(actual.eventWitnesses);
  actual.eventWitnesses.recent[0].tick = -1;
  assert.deepEqual(session.export({ paused: true }).eventWitnesses, exported);
  delete actual.eventWitnesses;
  delete expected.eventWitnesses;
  assert.deepEqual(
    actual,
    expected,
    'Inclusive substage stamps cannot rewrite raw numerical gates',
  );
});

test('disabled terminal HUD substages do not read the clock or retain event data', () => {
  let reads = 0;
  const session = createPerformanceSession({ now: () => ++reads, enabled: false });
  const before = reads;
  for (const kind of ['terminal-hud-begin', 'terminal-hud-clocks', 'terminal-hud-end'])
    session.markEvent(kind, 1, 0);
  assert.equal(reads, before);
  assert.equal(session.export({ paused: true }).eventWitnesses.total, 0);
});

test('pause substages retain bounded prefixes without rewriting raw frame or failure evidence', () => {
  let now = 0;
  const observed = createPerformanceSession({ now: () => now });
  const ordinary = createPerformanceSession({ now: () => now });
  for (const value of [observed, ordinary]) value.setPhase('playing', 0);
  const kinds = [
    'pause-begin',
    'pause-phase',
    'pause-input',
    'pause-audio',
    'pause-snapshot-begin',
    'pause-snapshot-end',
    'pause-snapshot-failed',
    'pause-save-begin',
    'pause-save-end',
    'pause-save-failed',
    'pause-readback-begin',
    'pause-readback-end',
    'pause-readback-failed',
    'pause-persist-failed',
    'pause-save-skipped',
    'pause-overlay',
    'pause-hud',
    'pause-link',
    'pause-end',
  ];
  for (let generation = 1; generation <= 20; generation++)
    for (const kind of kinds) observed.markEvent(kind, generation, 600, ++now);
  observed.markEvent('pause-begin', 21, 600, ++now);
  observed.markEvent('pause-save-failed', 21, 600, ++now);
  for (const value of [observed, ordinary]) {
    value.setPhase('paused', now);
    value.reportFailure('Original save failure', now);
    value.recordFrame(now + 16, 214, 0, 13, 0);
  }
  const actual = observed.export({ paused: true });
  const expected = ordinary.export({ paused: true });
  assert.equal(actual.eventWitnesses.capacity, 256);
  assert.equal(actual.eventWitnesses.total, 382);
  assert.equal(actual.eventWitnesses.retained, 256);
  assert.equal(actual.eventWitnesses.omitted, 126);
  assert.equal(actual.eventWitnesses.byKind['pause-end'].total, 20);
  assert.equal(actual.eventWitnesses.recent.at(-1).kind, 'pause-save-failed');
  assert.equal(actual.eventWitnesses.recent.at(-1).runGeneration, 21);
  delete actual.eventWitnesses;
  delete expected.eventWitnesses;
  assert.deepEqual(
    actual,
    expected,
    'Pause stamps cannot alter original frame attribution or failure evidence.',
  );
});
test('disabled pause markers read no clock and retain no event rows', () => {
  let reads = 0;
  const session = createPerformanceSession({ enabled: false, now: () => ++reads });
  const before = reads;
  for (const kind of [
    'pause-begin',
    'pause-phase',
    'pause-input',
    'pause-audio',
    'pause-snapshot-begin',
    'pause-snapshot-end',
    'pause-snapshot-failed',
    'pause-save-begin',
    'pause-save-end',
    'pause-save-failed',
    'pause-readback-begin',
    'pause-readback-end',
    'pause-readback-failed',
    'pause-persist-failed',
    'pause-save-skipped',
    'pause-overlay',
    'pause-hud',
    'pause-link',
    'pause-end',
  ])
    session.markEvent(kind, 1, 0);
  assert.equal(reads, before);
  assert.equal(session.export({ paused: true }).eventWitnesses.total, 0);
});

test('callback work labels the first active callback independently of its preparation interval', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  session.setPhase('preparing');
  session.recordFrame((now = 10), 1, 1, 0, 0, 2, 'preparing');
  session.setPhase('playing', (now = 15));
  session.recordFrame((now = 26), 3, 2, 1, 1, 11, 'playing');
  const data = session.export({ paused: true });
  assert.equal(data.recentFrames.at(-1).phase, 'preparing');
  assert.equal(data.recentFrames.at(-1).workPhase, 'playing');
  assert.equal(data.phases.preparing.frames.totalMs, 16);
  assert.equal(data.phases.preparing.work.totalMs, 11, 'Legacy work bucket remains unchanged');
  assert.equal(data.callbackWork.phases.playing.work.totalMs, 11);
  assert.deepEqual(
    Object.fromEntries(
      ['updateMs', 'drawMs', 'hudMs', 'simulationMs'].map((key) => [
        key,
        data.recentFrames.at(-1)[key],
      ]),
    ),
    { updateMs: 3, drawMs: 2, hudMs: 1, simulationMs: 1 },
  );
  assert.equal(data.callbackWork.attributedFrameCount, 2);
  assert.equal(data.callbackWork.unattributedFrameCount, 0);
});

test('external Pause and first result callback retain their prior-playing intervals only', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  session.setPhase('playing');
  session.recordFrame((now = 16), 1, 0, 0, 0, 1, 'playing');
  session.setPhase('paused', (now = 17));
  session.recordFrame((now = 32), 3, 0, 0, 0, 3, 'paused');
  session.setPhase('playing', (now = 33));
  session.recordFrame((now = 48), 5, 0, 0, 0, 5, 'playing');
  session.setPhase('result', (now = 64));
  session.recordFrame(now, 7, 0, 0, 0, 7, 'result');
  const data = session.export({ paused: true });
  assert.deepEqual(
    data.recentFrames.map(({ phase, workPhase }) => [phase, workPhase]),
    [
      ['boot', 'playing'],
      ['playing', 'paused'],
      ['paused', 'playing'],
      ['playing', 'result'],
    ],
  );
  assert.equal(data.phases.playing.frames.count, 2);
  assert.equal(data.phases.playing.work.totalMs, 10);
  assert.equal(data.callbackWork.phases.playing.work.totalMs, 6);
  assert.equal(data.callbackWork.phases.paused.work.totalMs, 3);
  assert.equal(data.callbackWork.phases.result.work.totalMs, 7);
});

test('pause, terminal and failure transitions inside a callback retain its playing work entry', () => {
  for (const finalPhase of ['paused', 'result', 'error']) {
    let now = 0;
    const session = createPerformanceSession({ now: () => now });
    session.setPhase('playing');
    session.recordFrame((now = 16), 1, 0, 0, 0, 1, 'playing');
    session.setPhase(finalPhase, (now = 412));
    if (finalPhase === 'paused') session.interruption(396);
    if (finalPhase === 'error') session.reportFailure('Actual callback did not complete normally');
    session.recordFrame(now, 133, 1, 14, 0, 134, 'playing');
    const data = session.export({ paused: true });
    assert.equal(data.phase, finalPhase);
    assert.equal(data.recentFrames.at(-1).phase, 'playing');
    assert.equal(data.recentFrames.at(-1).workPhase, 'playing');
    assert.equal(data.phases.playing.frames.maxMs, 396);
    assert.equal(data.callbackWork.phases.playing.work.maxMs, 134);
    assert.equal(data.callbackWork.phases[finalPhase].work.count, 0);
    assert.equal(data.failures.count, finalPhase === 'error' ? 1 : 0);
    assert.equal(data.interruptions.count, finalPhase === 'paused' ? 1 : 0);
  }
});

test('hidden suspension overrides interval attribution without relabeling visible callback work', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now });
  session.setPhase('playing');
  session.recordFrame((now = 16), 1, 0, 0, 0, 1, 'playing');
  session.setPhase('hidden', (now = 20));
  session.setPhase('playing', (now = 10000));
  session.recordFrame((now = 10016), 9, 0, 0, 0, 9, 'playing');
  const data = session.export({ paused: true });
  assert.equal(data.recentFrames.at(-1).phase, 'hidden');
  assert.equal(data.recentFrames.at(-1).workPhase, 'playing');
  assert.equal(data.phases.hidden.frames.maxMs, 10000);
  assert.equal(data.callbackWork.phases.playing.work.totalMs, 10);
  assert.equal(data.callbackWork.phases.hidden.work.count, 0);
  assert.equal(
    data.worstHitches.some((row) => row.intervalMs === 10000),
    false,
  );
});

test('callback labels remain bounded through recent eviction and worst-hitch replacement', () => {
  let now = 0;
  const session = createPerformanceSession({ now: () => now, capacity: 2 });
  session.setPhase('playing');
  for (let i = 1; i <= 40; i++)
    session.recordFrame((now += i), i, 0, 0, 0, i, i % 2 ? 'playing' : 'paused');
  const data = session.export({ paused: true });
  assert.equal(data.retainedFrameCount, 2);
  assert.equal(data.omittedFrameCount, 38);
  assert.equal(data.worstHitches.length, 16);
  for (const row of [...data.recentFrames, ...data.worstHitches])
    assert.equal(row.workPhase, row.updateMs % 2 ? 'playing' : 'paused');
  assert.equal(data.callbackWork.phases.playing.work.count, 20);
  assert.equal(data.callbackWork.phases.paused.work.count, 20);
  assert.equal(data.callbackWork.attributedFrameCount, 40);
});

test('absent or invalid work phases stay unattributed and disabled frame collection reads no clock', () => {
  let reads = 0;
  const session = createPerformanceSession({
    now: () => {
      reads++;
      return 0;
    },
  });
  session.setPhase('playing', 0);
  for (const [i, phase] of [
    undefined,
    null,
    'unknown',
    3,
    {
      toString() {
        throw Error('No coercion');
      },
    },
  ].entries())
    session.recordFrame(i + 1, 1, 0, 0, 0, 1, phase);
  let data = session.export({ paused: true });
  assert.equal(data.callbackWork.attributedFrameCount, 0);
  assert.equal(data.callbackWork.unattributedFrameCount, 5);
  assert(data.recentFrames.every((row) => row.workPhase === null));
  session.setEnabled(false);
  const before = reads;
  session.recordFrame(100, 100, 0, 0, 0, 100, 'playing');
  assert.equal(reads, before);
  data = session.export({ paused: true });
  assert.equal(data.frames.count, 5);
  assert.equal(data.callbackWork.unattributedFrameCount, 5);
});

test('explicit work labels leave every existing interval, failure and phase aggregate unchanged', () => {
  let now = 0;
  const legacy = createPerformanceSession({ now: () => now });
  const labeled = createPerformanceSession({ now: () => now });
  for (const session of [legacy, labeled]) session.setPhase('preparing');
  const record = (stamp, phase) => {
    now = stamp;
    legacy.recordFrame(now, 9, 4, 2, 1, 15);
    labeled.recordFrame(now, 9, 4, 2, 1, 15, phase);
  };
  record(16, 'preparing');
  for (const session of [legacy, labeled]) session.setPhase('playing', 17);
  record(32, 'playing');
  for (const session of [legacy, labeled]) {
    session.setPhase('paused', 428);
    session.interruption(396);
    session.reportFailure('Retained failure', 428);
  }
  record(428, 'playing');
  const originalFields = ({
    callbackWork: _callbackWork,
    recentFrames,
    worstHitches,
    ...rest
  }) => ({
    ...rest,
    recentFrames: recentFrames.map(({ workPhase: _workPhase, ...row }) => row),
    worstHitches: worstHitches.map(({ workPhase: _workPhase, ...row }) => row),
  });
  assert.deepEqual(
    originalFields(labeled.export({ paused: true })),
    originalFields(legacy.export({ paused: true })),
  );
});

test('optional Missions markers reuse the bounded numeric ring with explicit incomplete semantics', () => {
  let time = 0;
  const session = createPerformanceSession({ now: () => time });
  session.markEvent('missions-opening', 1, 42);
  session.markEvent('missions-render-begin', 1, 42, ++time);
  const pending = session.export({ paused: true }).eventWitnesses;
  assert.deepEqual(
    pending.recent.map((event) => event.kind),
    ['missions-opening', 'missions-render-begin'],
  );
  assert.match(pending.definition, /Missing ends remain incomplete/);
  for (let i = 0; i < 300; i++) session.markEvent('missions-cancelled', 1, 42, ++time);
  const full = session.export({ paused: true }).eventWitnesses;
  assert.equal(full.capacity, 256);
  assert.equal(full.retained, 256);
  assert.equal(full.omitted, 46);
  assert.equal(full.rejected, 0);
  assert(full.recent.every((event) => event.runGeneration === 1 && event.tick === 42));
  let reads = 0;
  const disabled = createPerformanceSession({ enabled: false, now: () => ++reads });
  const initial = reads;
  disabled.markEvent('missions-opening', 1, 0);
  disabled.markEvent('missions-render-begin', 1, 0);
  assert.equal(reads, initial, 'Disabled markers read no clock.');
});
