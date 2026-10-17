import assert from 'node:assert/strict';
import { createEnduranceReportDisplay } from './endurance-report-display.mjs';
import { createEnduranceClock } from './endurance-clock.mjs';
let at = 0,
  text = '',
  writes = 0;
const view = createEnduranceReportDisplay({
  now: () => {
    at += 0.25;
    return at;
  },
  write: (value) => {
    text = value;
    writes++;
  },
});
const retained = {
  last120SecondSamples: Array.from({ length: 120 }, (_, i) => ({
    ticks: i,
    raw: 'retained evidence',
  })),
  minuteSamples: Array.from({ length: 121 }, (_, i) => ({ minute: i })),
  lifecycle: { events: Array(128).fill({ type: 'focus' }) },
};
const before = JSON.stringify(retained);
const facts = {
  elapsedMs: 0,
  targetMs: 7200000,
  ticks: 0,
  frames: 0,
  cellCrossings: 0,
  recentres: 0,
  routeProgress: 0,
  observationPolicy: 'visible-commanded',
  maximumFrameIntervalMs: 16.7,
};
Object.defineProperty(facts, 'rawSamples', {
  get() {
    throw new Error('Live view traversed raw evidence');
  },
});
const checks = [];
for (let second = 0; second <= 7200; second++) {
  Object.assign(facts, {
    elapsedMs: second * 1000,
    ticks: second * 50,
    frames: second * 60,
    recentres: second,
    routeProgress: second,
  });
  view.live(facts);
  assert(text.length < 1100, 'Live DOM payload stays bounded independent of elapsed history');
}
assert.equal(writes, 7201);
const live = JSON.parse(text);
assert.equal(live.elapsedSeconds, 7200);
assert.equal(live.ticks, 360000);
assert.equal(live.phase, 'running — provisional, not an accepted report');
assert.equal(JSON.stringify(retained), before);
assert(!Object.hasOwn(live, 'accepted'));
assert(!Object.hasOwn(live, 'last120SecondSamples'));
checks.push(
  'Two-hour-equivalent display updates remain under 1,100 characters without traversing or changing retained raw evidence; this loop is not elapsed endurance.',
);
assert.deepEqual(view.snapshot(), { count: 7201, meanMs: 0.25, maxMs: 0.25 });
const changed = view.snapshot();
changed.maxMs = 100;
assert.equal(view.snapshot().maxMs, 0.25);
checks.push(
  'Observer CPU counters measure exact synchronous display submission, remain bounded and snapshots cannot alter counters.',
);
const throwing = createEnduranceReportDisplay({
  now: () => {
    at++;
    return at;
  },
  write: () => {
    throw new Error('display unavailable');
  },
});
assert.throws(() => throwing.live(facts), /display unavailable/);
assert.equal(throwing.snapshot().count, 1);
checks.push(
  'A failed text submission is measured and propagates; it cannot silently excuse a measurement failure.',
);
const clock = createEnduranceClock({ startedAt: 0, startedWallAt: 0, targetMs: 7200000 });
clock.advance(20, () => true, 20);
clock.advance(277.1, () => true, 277.1);
assert.equal(clock.snapshot().status, 'invalid');
checks.push(
  'The unchanged real elapsed clock still invalidates a 257.1 ms frame gap; display work does not alter acceptance, physics or time.',
);
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        'Authoring-only bounded display and actual acceptance-clock contract. No browser layout, cause diagnosis, renderer FPS or elapsed-endurance claim.',
    },
    null,
    2,
  ),
);
