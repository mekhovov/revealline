import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnduranceAttribution } from '../../authoring/fpv-worlds/regions/endurance-attribution.mjs';

// Injected observer times test bounded diagnostic retention, not elapsed flight,
// browser scheduling, performance, caller causality or any acceptance threshold.
function fixture() {
  let at = 1000,
    callback,
    pending = [],
    disconnects = 0;
  class Observer {
    static supportedEntryTypes = ['long-animation-frame'];
    constructor(fn) {
      callback = fn;
    }
    observe() {}
    takeRecords() {
      const result = pending;
      pending = [];
      return result;
    }
    disconnect() {
      disconnects++;
    }
  }
  const trace = createEnduranceAttribution({
    startedAt: 1000,
    now: () => at,
    pageURL: 'https://review.invalid/authoring/fpv-worlds/regions/authored-endurance.html',
    PerformanceObserver: Observer,
  });
  return {
    trace,
    time(value) {
      at = value;
    },
    span(phase, start, end) {
      at = start;
      const token = trace.begin(phase);
      if (end !== null) {
        at = end;
        assert.equal(trace.end(token), true);
      }
      return token;
    },
    overwrite(count = 160, start = 2000) {
      for (let i = 0; i < count; i++) {
        trace.frame();
        this.span('renderer-draw', start + i * 2, start + i * 2 + 1);
      }
    },
    send(entries) {
      callback({ getEntries: () => entries });
    },
    pending(entries) {
      pending = entries;
    },
    disconnects: () => disconnects,
  };
}
const entry = (start = 1020, duration = 100, extra = {}) => ({
  entryType: 'long-animation-frame',
  startTime: start,
  duration,
  scripts: [],
  ...extra,
});

test('a delayed final snapshot retains early observer-time overlaps after the phase ring wraps', () => {
  const f = fixture();
  f.span('snapshot-before-step', 1020, 1032);
  f.span('flight-step', 1035, 1100);
  f.time(1200);
  f.send([entry()]);
  const expected = f.trace.snapshot().lastLongAnimationFrames[0];
  assert.deepEqual(
    expected.overlappingSpans.map(({ phase, overlapMs }) => [phase, overlapMs]),
    [
      ['flight-step', 65],
      ['snapshot-before-step', 12],
    ],
  );
  f.overwrite();
  f.time(300000);
  f.trace.stop();
  const final = f.trace.snapshot();
  assert.ok(final.lastSpans.every(({ elapsedMs }) => elapsedMs >= 1000));
  assert.deepEqual(final.lastLongAnimationFrames[0], expected);
  assert.equal(final.lastLongAnimationFrames[0].overlappingSpanCount, 2);
});

test('receipt-time matching keeps known counts but only twelve bounded overlap examples', () => {
  const f = fixture();
  for (let i = 0; i < 40; i++) f.span('flight-step', 1020 + i, 1020 + i + 0.5);
  f.time(1200);
  f.send([entry()]);
  const row = f.trace.snapshot().lastLongAnimationFrames[0];
  assert.equal(row.overlappingSpanCount, 40);
  assert.equal(row.overlappingSpans.length, 12);
  assert.equal(row.overlapExamplesDropped, 28);
  assert.equal(row.incompleteOverlappingSpanCount, 0);
  assert.equal(row.overlapCountIsLowerBound, false);
  assert.equal(row.overlapCapture.retainedSpanCount, 40);
  assert.equal(row.overlapCapture.overwrittenSpanCount, 0);
  f.overwrite();
  assert.deepEqual(f.trace.snapshot().lastLongAnimationFrames[0], row);
  f.trace.stop();
});

test('unfinished spans remain unknown as received even if the phase finishes before final snapshot', () => {
  const f = fixture();
  const token = f.span('renderer-draw', 1040, null);
  f.time(1100);
  f.send([entry()]);
  const row = f.trace.snapshot().lastLongAnimationFrames[0];
  assert.equal(row.incompleteOverlappingSpanCount, 1);
  assert.equal(row.overlappingSpans[0].overlapMs, null);
  assert.equal(row.overlappingSpans[0].completed, false);
  f.time(1300);
  assert.equal(f.trace.end(token), true);
  f.overwrite();
  f.trace.stop();
  assert.deepEqual(f.trace.snapshot().lastLongAnimationFrames[0], row);
});

test('late observer delivery discloses overwritten history instead of presenting zero as exhaustive', () => {
  const f = fixture();
  f.span('flight-step', 1020, 1100);
  f.overwrite();
  f.time(3000);
  f.send([entry()]);
  const row = f.trace.snapshot().lastLongAnimationFrames[0];
  assert.equal(row.overlappingSpanCount, 0);
  assert.equal(row.overlapCountIsLowerBound, true);
  assert.equal(row.overlapCapture.retainedSpanCount, 128);
  assert.equal(row.overlapCapture.overwrittenSpanCount, 33);
  assert.equal(row.overlapCapture.framePredatesRetainedSpanWindow, true);
  assert.ok(row.overlapCapture.oldestRetainedElapsedMs > row.elapsedMs + row.durationMs);
  f.trace.stop();
});

test('returned snapshots and later observer input mutations cannot change retained overlap facts', () => {
  const f = fixture();
  f.span('flight-step', 1020, 1100);
  f.time(1200);
  const supplied = entry(1020, 100, {
    scripts: [
      {
        startTime: 1030,
        duration: 60,
        sourceURL: 'https://review.invalid/authoring/fpv-worlds/regions/endurance.mjs?private=1',
        sourceFunctionName: 'frame',
        invokerType: 'user-callback',
        invoker: 'Window.requestAnimationFrame',
      },
    ],
  });
  f.send([supplied]);
  const expected = f.trace.snapshot();
  supplied.startTime = 9000;
  supplied.scripts[0].sourceURL = 'https://foreign.invalid/private';
  const edited = f.trace.snapshot();
  edited.lastLongAnimationFrames[0].overlappingSpans[0].phase = 'mutated';
  edited.lastLongAnimationFrames[0].overlapCapture.overwrittenSpanCount = 999;
  edited.lastLongAnimationFrames[0].scripts[0].source.path = 'mutated';
  assert.deepEqual(f.trace.snapshot(), expected);
  assert.equal(JSON.stringify(expected).includes('private='), false);
  f.trace.stop();
});

test('stop drains available entries once, then freezes retained associations without future callbacks', () => {
  const f = fixture();
  f.span('snapshot-before-step', 1020, 1030);
  f.time(1200);
  f.pending([entry()]);
  f.trace.stop();
  const final = f.trace.snapshot();
  assert.equal(final.lastLongAnimationFrames[0].overlappingSpans[0].overlapMs, 10);
  assert.equal(final.lastLongAnimationFrames[0].overlapCapture.capturedAtElapsedMs, 200);
  assert.equal(f.disconnects(), 1);
  f.send([entry(2000)]);
  f.trace.frame();
  assert.equal(f.trace.begin('flight-step'), null);
  f.trace.stop();
  assert.deepEqual(f.trace.snapshot(), final);
});
