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

const preparationReceipt = (extra = {}) => ({
  sequence: 2,
  status: 'prepared',
  objects: 79,
  batches: 10,
  submittedBytes: 563724,
  maxBatchBytes: 206880,
  compileWaitMs: 40,
  uploadCpuMs: 9,
  elapsedMs: 123,
  gpuCompletionMeasured: false,
  ...extra,
});

test('preparation receipt offsets distinguish async lifecycle, completion observation and receipt time', () => {
  const f = fixture();
  f.time(1020);
  const token = f.trace.beginPreparation();
  f.span('prepare-renderer-submit', 1021, 1022);
  f.time(1205);
  assert.equal(
    f.trace.endPreparation(token, {
      endedAt: 1200,
      outcome: 'fulfilled',
      receipt: preparationReceipt(),
    }),
    true,
  );
  const row = f.trace.snapshot().preparationReceipts.last[0];
  assert.equal(row.startElapsedMs, 20);
  assert.equal(row.endElapsedMs, 200);
  assert.equal(row.receivedAtElapsedMs, 205);
  assert.equal(row.elapsedMs, 180);
  assert.equal(row.outcome, 'fulfilled');
  assert.equal(row.receipt.compileWaitMs, 40);
  assert.equal(row.receipt.uploadCpuMs, 9);
  assert.equal(row.receipt.gpuCompletionMeasured, false);
  assert.equal(
    f.trace.snapshot().phases.find(({ phase }) => phase === 'prepare-renderer-submit').maxMs,
    1,
  );
});

test('outer synchronous frame span exposes an unlabelled callback gap without treating an await as CPU', () => {
  const f = fixture();
  f.time(1020);
  const frame = f.trace.begin('frame-callback');
  f.time(1022);
  const preparation = f.trace.beginPreparation();
  f.span('prepare-renderer-submit', 1023, 1024);
  f.time(1050);
  assert.equal(f.trace.end(frame), true);
  f.time(1250);
  f.trace.endPreparation(preparation, {
    endedAt: 1240,
    outcome: 'fulfilled',
    receipt: preparationReceipt(),
  });
  f.send([entry(1020, 240)]);
  const state = f.trace.snapshot();
  assert.equal(state.phases.find(({ phase }) => phase === 'frame-callback').maxMs, 30);
  assert.equal(state.phases.find(({ phase }) => phase === 'prepare-renderer-submit').maxMs, 1);
  assert.equal(state.preparationReceipts.last[0].elapsedMs, 218);
  assert.equal(state.lastLongAnimationFrames[0].preparationOverlaps.entries.length, 1);
  assert.equal(state.lastLongAnimationFrames[0].preparationOverlaps.entries[0].elapsedMs, 218);
});

test('preparation history stays bounded and discloses overwritten late completions', () => {
  const f = fixture();
  f.time(1020);
  const old = f.trace.beginPreparation();
  for (let i = 0; i < 20; i++) {
    f.time(1030 + i * 2);
    const token = f.trace.beginPreparation();
    f.time(1031 + i * 2);
    f.trace.endPreparation(token, {
      endedAt: 1031 + i * 2,
      outcome: 'fulfilled',
      receipt: preparationReceipt({ sequence: i + 3 }),
    });
  }
  f.time(1200);
  assert.equal(
    f.trace.endPreparation(old, {
      endedAt: 1190,
      outcome: 'fulfilled',
      receipt: preparationReceipt(),
    }),
    false,
  );
  const state = f.trace.snapshot().preparationReceipts;
  assert.equal(state.started, 21);
  assert.equal(state.settled, 20);
  assert.equal(state.last.length, 8);
  assert.equal(state.overwritten, 13);
  assert.equal(state.lateCompletions, 1);
  assert.ok(state.last.every(({ id }) => id > old));
});

test('LoAF preparation associations freeze pending and completed receipts at receive time', () => {
  const f = fixture();
  f.time(1020);
  const token = f.trace.beginPreparation();
  f.time(1100);
  f.send([entry(1020, 80)]);
  const early = f.trace.snapshot().lastLongAnimationFrames[0];
  assert.equal(early.preparationOverlaps.entries[0].outcome, 'pending');
  assert.equal(early.preparationOverlaps.entries[0].endElapsedMs, null);
  f.time(1200);
  const receipt = preparationReceipt();
  f.trace.endPreparation(token, { endedAt: 1190, outcome: 'fulfilled', receipt });
  f.send([entry(1020, 180)]);
  const later = f.trace.snapshot().lastLongAnimationFrames[1];
  receipt.uploadCpuMs = 9999;
  for (let i = 0; i < 12; i++) {
    f.time(2000 + i);
    f.trace.beginPreparation();
  }
  assert.deepEqual(f.trace.snapshot().lastLongAnimationFrames[0], early);
  assert.deepEqual(f.trace.snapshot().lastLongAnimationFrames[1], later);
  assert.equal(later.preparationOverlaps.entries[0].receipt.uploadCpuMs, 9);
});

test('preparation overlap caps disclose missing examples and discarded history', () => {
  const f = fixture();
  for (let i = 0; i < 12; i++) {
    f.time(1020 + i);
    f.trace.beginPreparation();
  }
  f.time(1200);
  f.send([entry(1020, 100)]);
  const row = f.trace.snapshot().lastLongAnimationFrames[0].preparationOverlaps;
  assert.equal(row.matchingCount, 8);
  assert.equal(row.entries.length, 2);
  assert.equal(row.examplesDropped, 6);
  assert.equal(row.countIsLowerBound, true);
  assert.equal(row.overwrittenPreparationCount, 4);
});

test('receipt sanitization copies only finite known fields and never retains error or source text', () => {
  const f = fixture();
  f.time(1020);
  const token = f.trace.beginPreparation();
  f.time(1200);
  assert.equal(
    f.trace.endPreparation(token, {
      endedAt: 1190,
      outcome: 'rejected',
      receipt: preparationReceipt({
        compileWaitMs: Infinity,
        uploadCpuMs: -1,
        objects: 2.5,
        status: 'https://private.invalid/?token=secret',
        gpuCompletionMeasured: true,
        secret: 'do not retain',
      }),
    }),
    true,
  );
  const row = f.trace.snapshot().preparationReceipts.last[0];
  assert.equal(row.outcome, 'rejected');
  assert.equal(row.receipt.compileWaitMs, null);
  assert.equal(row.receipt.uploadCpuMs, null);
  assert.equal(row.receipt.objects, null);
  assert.equal(row.receipt.status, null);
  assert.equal(row.receipt.gpuCompletionMeasured, null);
  assert.equal(JSON.stringify(row).includes('secret'), false);
  const second = f.trace.beginPreparation();
  f.time(1210);
  assert.equal(
    f.trace.endPreparation(second, {
      endedAt: 1209,
      outcome: 'cancelled',
      receipt: {
        get sequence() {
          throw new Error('private');
        },
      },
    }),
    true,
  );
  assert.equal(f.trace.snapshot().preparationReceipts.last[1].receipt, null);
});

test('invalid offsets stay unknown and returned receipt snapshots cannot mutate retained state', () => {
  const f = fixture();
  f.time(1020);
  const token = f.trace.beginPreparation();
  f.time(1100);
  assert.equal(
    f.trace.endPreparation(token, {
      endedAt: 1200,
      outcome: 'fulfilled',
      receipt: preparationReceipt(),
    }),
    false,
  );
  assert.equal(f.trace.snapshot().preparationReceipts.last[0].outcome, 'pending');
  assert.equal(
    f.trace.endPreparation(token, {
      endedAt: 1090,
      outcome: 'fulfilled',
      receipt: preparationReceipt(),
    }),
    true,
  );
  const expected = f.trace.snapshot();
  const edited = f.trace.snapshot();
  edited.preparationReceipts.last[0].receipt.status = 'mutated';
  edited.preparationReceipts.last[0].startElapsedMs = 999;
  assert.deepEqual(f.trace.snapshot(), expected);
});

test('stop drains existing preparation associations and freezes late completion/cancellation', () => {
  const f = fixture();
  f.time(1020);
  const token = f.trace.beginPreparation();
  f.time(1200);
  f.pending([entry()]);
  f.trace.stop();
  const final = f.trace.snapshot();
  assert.equal(final.lastLongAnimationFrames[0].preparationOverlaps.entries[0].outcome, 'pending');
  f.time(1300);
  assert.equal(
    f.trace.endPreparation(token, { endedAt: 1290, outcome: 'cancelled', receipt: null }),
    false,
  );
  assert.equal(f.trace.beginPreparation(), null);
  f.trace.stop();
  assert.deepEqual(f.trace.snapshot(), final);
});

test('saturated preparation and script histories retain bounded private-free diagnostic payloads', () => {
  const f = fixture(),
    tokens = [];
  for (let i = 0; i < 8; i++) {
    f.time(1020 + i);
    tokens.push(f.trace.beginPreparation());
  }
  f.time(1200);
  for (const token of tokens)
    f.trace.endPreparation(token, {
      endedAt: 1190,
      outcome: 'fulfilled',
      receipt: preparationReceipt({ secret: 'private'.repeat(10000) }),
    });
  const scripts = Array.from({ length: 80 }, () => ({
    startTime: 1030,
    duration: 60,
    sourceURL: 'https://review.invalid/authoring/fpv-worlds/regions/endurance.mjs?secret=private',
    sourceFunctionName: 'frame',
    invokerType: 'user-callback',
    invoker: 'Window.requestAnimationFrame',
  }));
  f.send(Array.from({ length: 24 }, () => entry(1020, 200, { scripts })));
  const state = f.trace.snapshot(),
    payload = JSON.stringify(state);
  assert.equal(state.lastLongAnimationFrames.length, 16);
  assert.equal(state.preparationReceipts.last.length, 8);
  assert.ok(
    state.lastLongAnimationFrames.every(
      (row) => row.preparationOverlaps.entries.length === 2 && row.scripts.length === 8,
    ),
  );
  assert.equal(state.dropped.longAnimationFrames, 8);
  assert.ok(payload.length < 128 * 1024);
  assert.equal(payload.includes('private'), false);
});
