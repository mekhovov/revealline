import assert from 'node:assert/strict';
import { createEnduranceLifecycle } from './endurance-lifecycle.mjs';
import { createEnduranceClock } from './endurance-clock.mjs';
const doc = new EventTarget(),
  win = new EventTarget();
let at = 1000,
  focused = true;
doc.visibilityState = 'visible';
doc.hasFocus = () => focused;
let callback,
  disconnected = 0,
  pending = [];
class Observer {
  static supportedEntryTypes = ['longtask'];
  constructor(cb) {
    callback = cb;
  }
  observe(options) {
    assert.deepEqual(options, { type: 'longtask', buffered: false });
  }
  takeRecords() {
    const rows = pending;
    pending = [];
    return rows;
  }
  disconnect() {
    disconnected++;
  }
}
const trace = createEnduranceLifecycle({
  startedAt: 1000,
  now: () => at,
  document: doc,
  window: win,
  PerformanceObserver: Observer,
});
const checks = [];
at = 1020;
trace.frame(at);
focused = false;
win.dispatchEvent(new Event('blur'));
at = 1030;
doc.dispatchEvent(new Event('freeze'));
at = 1300;
doc.dispatchEvent(new Event('resume'));
trace.frame(at);
callback({
  getEntries: () => [
    { startTime: 900, duration: 50 },
    { startTime: 1040, duration: 60, name: 'private URL' },
    { startTime: 1100, duration: NaN },
  ],
});
assert.deepEqual(
  trace.snapshot().events.map((e) => e.type),
  ['start', 'blur', 'freeze', 'resume'],
);
assert.equal(trace.snapshot().lastFrames.at(-1).intervalMs, 280);
assert.deepEqual(trace.snapshot().longTasks.last, [{ elapsedMs: 40, durationMs: 60 }]);
checks.push(
  'Exact lifecycle/focus correlation and terminal frame interval recorded; older/malformed tasks and attribution data excluded',
);
const clock = createEnduranceClock({ startedAt: 1000, startedWallAt: 1000, targetMs: 1000 });
clock.advance(1020, () => true, 1020);
clock.advance(1300, () => true, 1300);
assert.equal(clock.snapshot().status, 'invalid');
checks.push(
  'Recorded blur/resume and long task do not excuse the real clock’s >250 ms invalidation',
);
for (let i = 0; i < 200; i++) {
  at++;
  win.dispatchEvent(new Event('focus'));
  trace.frame(at);
  callback({ getEntries: () => [{ startTime: at, duration: 50 }] });
}
let view = trace.snapshot();
assert.equal(view.events.length, 128);
assert.equal(view.longTasks.last.length, 64);
assert.equal(view.lastFrames.length, 64);
assert(view.dropped.events > 0 && view.dropped.longTasks > 0 && view.dropped.frames > 0);
view.events[0].type = 'tampered';
assert.notEqual(trace.snapshot().events[0].type, 'tampered');
checks.push('Bounded rings disclose dropped samples and snapshots cannot alter retained evidence');
pending = [{ startTime: at, duration: 51 }];
trace.stop();
const final = trace.snapshot();
assert.equal(final.longTasks.count, 202);
assert.equal(final.stopped, true);
assert.equal(disconnected, 1);
at++;
win.dispatchEvent(new Event('blur'));
trace.frame(at);
callback({ getEntries: () => [{ startTime: at, duration: 52 }] });
trace.stop();
assert.deepEqual(trace.snapshot(), final);
checks.push(
  'Final pending tasks drained once; listeners/observer released and finished segment cannot change',
);
const unsupported = createEnduranceLifecycle({
  startedAt: at,
  now: () => at,
  document: doc,
  window: win,
  PerformanceObserver: null,
});
assert.equal(unsupported.snapshot().longTasks.capability, 'unsupported');
unsupported.stop();
class Broken extends Observer {
  observe() {
    throw new Error('Unavailable');
  }
}
const broken = createEnduranceLifecycle({
  startedAt: at,
  now: () => at,
  document: doc,
  window: win,
  PerformanceObserver: Broken,
});
assert.equal(broken.snapshot().longTasks.capability, 'unavailable');
broken.stop();
checks.push(
  'Unsupported/unavailable observation is explicit, never a zero-long-task or causal claim',
);
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        'Authoring diagnostics and real elapsed-clock policy with deterministic event times; no renderer or elapsed endurance claim.',
    },
    null,
    2,
  ),
);
