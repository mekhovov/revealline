import assert from 'node:assert/strict';
import { createEnduranceObservation } from './endurance-observation.mjs';
import { createEnduranceClock } from './endurance-clock.mjs';

// Actual authoring policy and elapsed-time clock, with deterministic event times.
// This does not execute a renderer, claim elapsed endurance, or change player input.
const checks = [];
const make = (policy) => {
  const observation = createEnduranceObservation({ startedAt: 0, ...(policy ? { policy } : {}) });
  const clock = createEnduranceClock({ startedAt: 0, startedWallAt: 1000, targetMs: 1000 });
  const observe = (at, focused, visible = true, type = 'sample') => {
    const reason = observation.observe({ at, focused, visible, type });
    if (reason) clock.invalidate(reason);
  };
  observe(0, true, true, 'start');
  return { observation, clock, observe };
};
{
  const run = make();
  run.clock.advance(20, () => true, 1020);
  run.observe(21, false, true, 'blur');
  run.observe(22, true, true, 'focus');
  run.clock.advance(
    40,
    () => {
      throw new Error('Strict invalidated run advanced');
    },
    1040,
  );
  assert.equal(run.observation.snapshot().policy, 'strict-focus');
  assert.equal(run.clock.snapshot().status, 'invalid');
  assert.equal(run.clock.snapshot().ticks, 1);
  assert.equal(run.clock.snapshot().reason, 'Window lost focus');
  checks.push(
    'Default strict policy invalidates blur permanently; focus cannot resume or join a segment',
  );
}
{
  const run = make('visible-commanded');
  for (let at = 20; at <= 1000; at += 20) {
    const focused = at < 100 || at >= 800;
    run.observe(at, focused, true, at === 100 ? 'blur' : at === 800 ? 'focus' : 'sample');
    run.clock.advance(at, () => true, 1000 + at);
  }
  assert.equal(run.clock.snapshot().status, 'completed');
  assert.equal(run.clock.snapshot().ticks, 50);
  assert.equal(run.clock.snapshot().elapsedMs, 1000);
  assert.deepEqual(
    run.observation
      .snapshot()
      .events.map(({ elapsedMs, type, focused }) => ({ elapsedMs, type, focused })),
    [
      { elapsedMs: 0, type: 'start', focused: true },
      { elapsedMs: 100, type: 'blur', focused: false },
      { elapsedMs: 800, type: 'focus', focused: true },
    ],
  );
  const view = run.observation.snapshot();
  view.events[0].focused = false;
  assert.equal(run.observation.snapshot().events[0].focused, true);
  checks.push(
    'Explicit visible policy records focus loss/restoration, preserves elapsed ticks and protects trace ownership',
  );
}
for (const policy of ['strict-focus', 'visible-commanded']) {
  const run = make(policy);
  run.observe(20, true, false, 'visibilitychange');
  assert.equal(run.clock.snapshot().status, 'invalid');
  assert.equal(run.clock.snapshot().reason, 'Tab hidden');
  assert.equal(run.observation.snapshot().events.at(-1).visible, false);
}
checks.push('Hidden tab invalidates both policies and is recorded');
for (const boundary of ['gap', 'wall', 'rejected', 'context', 'viewport', 'contact']) {
  const run = make('visible-commanded');
  run.observe(10, false, true, 'blur');
  if (boundary === 'gap') run.clock.advance(251, () => true, 1251);
  else if (boundary === 'wall') run.clock.advance(20, () => true, 1400);
  else if (boundary === 'rejected') run.clock.advance(20, () => false, 1020);
  else
    run.clock.invalidate(
      {
        context: 'Graphics context lost',
        viewport: 'Viewport or canvas changed',
        contact: 'Unexpected contact on authored review route',
      }[boundary],
    );
  assert.equal(run.clock.snapshot().status, 'invalid');
  run.observe(300, true, true, 'focus');
  run.clock.advance(
    1000,
    () => {
      throw new Error('Invalid run advanced');
    },
    2000,
  );
  assert.equal(run.clock.snapshot().status, 'invalid');
}
checks.push(
  'Visible policy cannot bypass gap, wall-clock, rejected-tick or host safety invalidation',
);
{
  const run = make('visible-commanded');
  for (let at = 1; at <= 1024; at++) run.observe(at, at % 2 === 0, true, at % 2 ? 'blur' : 'focus');
  assert.equal(run.observation.snapshot().events.length, 1024);
  assert.equal(run.clock.snapshot().reason, 'Focus-event trace exceeded its bound');
  assert.throws(() => createEnduranceObservation({ startedAt: 0, policy: 'unknown' }));
  const fresh = make('visible-commanded');
  assert.equal(fresh.clock.snapshot().ticks, 0);
  assert.equal(fresh.clock.snapshot().elapsedMs, 0);
  assert.equal(fresh.observation.snapshot().events.length, 1);
}
checks.push(
  'Trace growth fails closed at its bound; new segments have independent zero-time histories',
);
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        'Authoring observation policy and actual clock only; virtual time is not native elapsed endurance',
    },
    null,
    2,
  ),
);
