import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnakeTraceReview } from './lib/snake-trace-review.mjs';
const actor = { id: 'a', kind: 'runner', phase: 'travel' };
function fixture() {
  const trace = createSnakeTraceReview();
  trace.start({ runs: [{ tick: 0, elapsedMs: 0, targets: [actor] }] });
  return {
    trace,
    step(tick, events = [], targets = [actor]) {
      trace.observe({ run: { tick, events, targets, elapsedMs: tick * 200 } });
    },
  };
}
test('capture concentration includes simultaneous catches and ignores duplicate observer callbacks', () => {
  const { trace, step } = fixture(),
    catchAt = (x, y) => ({ type: 'target.caught', target: { x, y } });
  step(1, [catchAt(2, 3), catchAt(2, 3)]);
  step(1, [catchAt(2, 3), catchAt(2, 3)]);
  step(2, [catchAt(7, 8)]);
  step(3, [catchAt(2, 3)]);
  const result = trace.result()[0];
  assert.equal(result.captures, 4);
  assert.equal(result.maxRepeatedSpot, 3);
  assert.equal(result.captureConcentration, 0.75);
  assert.equal(result.longestSameSpotStreak, 2);
  assert.deepEqual(result.signals, ['concentrated-captures']);
});
test('moving prey does not hide long following intervals; objective and phase changes reset them', () => {
  const { trace, step } = fixture();
  for (let i = 1; i <= 30; i++)
    step(i, [{ type: 'target.moved', target: { ...actor, x: i, y: 0 } }]);
  step(31, [{ type: 'cargo.delivered' }]);
  step(32, [], [{ ...actor, phase: 'warning' }]);
  step(33, [], [{ ...actor, phase: 'warning' }]);
  const result = trace.result()[0];
  assert.equal(result.maxNoChangeMoves, 30);
  assert.equal(result.maxNoChangeMs, 6000);
  assert.equal(result.meaningfulSteps, 2);
  assert.deepEqual(result.signals, ['long-interval-without-encounter-change']);
});
test('sparse observations are rejected rather than silently undercounting elapsed decisions', () => {
  const { step } = fixture();
  assert.throws(() => step(2), /per-step/);
});

test('reception changes are meaningful without treating ordinary coordinate changes as decisions', () => {
  const { trace, step } = fixture();
  step(1);
  trace.observe({
    run: { tick: 2, elapsedMs: 400, targets: [actor], events: [], signal: { jammed: true } },
  });
  trace.observe({
    run: {
      tick: 3,
      elapsedMs: 600,
      targets: [{ ...actor, x: 8, y: 9 }],
      events: [],
      signal: { jammed: true },
    },
  });
  trace.observe({
    run: { tick: 4, elapsedMs: 800, targets: [actor], events: [], signal: { jammed: false } },
  });
  assert.equal(trace.result()[0].meaningfulSteps, 2);
  assert.equal(trace.result()[0].maxNoChangeMoves, 1);
});
