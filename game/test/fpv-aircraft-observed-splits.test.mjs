import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import {
  createPracticeSectorObserver,
  createSectorTracker,
  mountPracticeSplits,
} from '../../optional-practice/civilian-fpv/flight-sectors.mjs';

const state = (ticks, step = 0, total = 3) => ({ ticks, step, total });
test('practice observations preserve the historical tracker and accept only consecutive mission ticks', () => {
  const old = createSectorTracker();
  assert.throws(() => old.consume(state(36001)), /monotonically/);
  const observer = createPracticeSectorObserver();
  assert.equal(observer.reset(state(0)), true);
  for (let tick = 1; tick <= 36050; tick++) {
    assert.equal(observer.consume(state(tick, tick >= 36050 ? 3 : tick >= 36001 ? 1 : 0)), true);
    if (tick === 100) {
      const before = observer.snapshot();
      for (const invalid of [
        state(100),
        state(99),
        state(102),
        state(101, -1),
        state(101, 0, 65),
        state(Infinity),
        state(0.5),
      ])
        assert.equal(observer.consume(invalid), false);
      assert.deepEqual(
        observer.snapshot(),
        before,
        'rejected/duplicate/out-of-order samples cannot mutate timing',
      );
    }
  }
  assert.deepEqual(observer.snapshot().rows, [
    { index: 0, ticks: 36001, endTick: 36001 },
    { index: 1, ticks: 49, endTick: 36050 },
    { index: 2, ticks: 0, endTick: 36050 },
  ]);
  const copy = observer.snapshot();
  copy.rows[0].ticks = -1;
  assert.equal(observer.snapshot().rows[0].ticks, 36001);
});

test('recovery omits historical objectives and marks the crossing split unknown, including same-tick restore', () => {
  const observer = createPracticeSectorObserver();
  observer.reset(state(0));
  observer.consume(state(1, 1));
  observer.reset(state(1, 1));
  assert.deepEqual(observer.snapshot().rows, []);
  assert.equal(observer.snapshot().partial, true);
  observer.consume(state(2, 2));
  observer.consume(state(3, 2));
  observer.consume(state(4, 3));
  assert.deepEqual(observer.snapshot().rows, [
    { index: 1, ticks: null, endTick: 2 },
    { index: 2, ticks: 2, endTick: 4 },
  ]);
  observer.reset(state(4, 3));
  observer.consume(state(5, 3));
  assert.deepEqual(observer.snapshot().rows, [], 'completed recovery invents no boundaries');
});

test('practice memory is bounded by64 objectives and supports safe clocks without overflow', () => {
  const observer = createPracticeSectorObserver();
  observer.reset(state(0, 0, 64));
  for (let tick = 1; tick <= 40000; tick++) observer.consume(state(tick, Math.min(tick, 64), 64));
  assert.equal(observer.snapshot().rows.length, 64);
  observer.reset(state(Number.MAX_SAFE_INTEGER - 1));
  assert.equal(observer.consume(state(Number.MAX_SAFE_INTEGER, 1)), true);
  assert.equal(observer.consume(state(Number.MAX_SAFE_INTEGER + 1, 2)), false);
  assert.equal(observer.reset(state(0, 0, 65)), false);
  assert.equal(observer.snapshot().rows.length, 1);
});

test('pause-panel observations localize, retain ownership, report unknown gaps and tolerate presentation failure', () => {
  const document = new Document();
  let locale = 'en';
  const ui = mountPracticeSplits({ parent: document.body, locale: () => locale });
  const first = {},
    second = {};
  ui.update(first, state(0), { enabled: true });
  const list = ui.root.querySelector('ol');
  let paints = 0;
  const replace = list.replaceChildren.bind(list);
  list.replaceChildren = (...nodes) => {
    paints++;
    replace(...nodes);
  };
  for (let tick = 1; tick < 10; tick++) {
    ui.consume(first, state(tick));
    ui.update(first, state(tick), { enabled: true });
  }
  assert.equal(paints, 0, 'unchanged timing does not rebuild on every frame');
  ui.consume(first, state(10, 1));
  ui.update(first, state(10, 1), { enabled: true });
  assert.match(ui.root.textContent, /50 Hz.*No record or score/);
  assert.match(ui.root.textContent, /Objective 1: 0.20 s/);
  assert.equal(paints, 1);
  ui.restored(first, state(10, 1));
  assert.match(ui.root.textContent, /Earlier timings are unavailable/);
  ui.consume(first, state(11, 2));
  ui.update(first, state(11, 2), { enabled: true });
  assert.match(ui.root.textContent, /Objective 2: start time unavailable/);
  locale = 'uk';
  ui.update(first, state(11, 2), { enabled: true });
  assert.match(ui.root.textContent, /без заліку/);
  assert.match(ui.root.textContent, /час початку недоступний/);
  ui.update(second, state(0), { enabled: true });
  assert.equal(ui.consume(first, state(12, 3)), false);
  ui.restored(first, state(10, 1));
  assert.equal(ui.snapshot().originTick, 0, 'late old-session recovery cannot reset a new session');
  ui.update(second, state(20, 1), { enabled: true });
  assert.equal(
    ui.snapshot().originTick,
    20,
    'missed observations become unknown instead of invented splits',
  );
  list.replaceChildren = () => {
    throw new Error('presentation unavailable');
  };
  assert.doesNotThrow(() => ui.restored(second, state(20, 1)));
  assert.match(ui.root.textContent, /Спостережуваний час недоступний/);
  list.replaceChildren = replace;
  ui.update(second, state(20, 1, 65), { enabled: true });
  assert.equal(ui.snapshot(), null);
  ui.update(second, state(0, 0, 0), { enabled: true, freeFlight: true });
  assert.match(ui.root.textContent, /У вільному польоті немає ділянок курсу/);
  assert.equal(ui.snapshot(), null);
  ui.update(second, state(0), { enabled: false });
  assert.equal(ui.root.hidden, true);
  Object.defineProperty(ui.root, 'hidden', {
    configurable: true,
    set() {
      throw new Error('presentation setter failed');
    },
    get() {
      return false;
    },
  });
  assert.doesNotThrow(() => ui.update(second, state(1), { enabled: true }));
  assert.equal(ui.snapshot(), null);
  ui.root.remove = () => {
    throw new Error('presentation teardown failed');
  };
  ui.dispose();
  assert.equal(ui.consume(second, state(1, 1)), false);
});

const reference = () => ({
  name: 'Earlier completed flight',
  rows: [
    { index: 0, ticks: 10, endTick: 10 },
    { index: 1, ticks: 20, endTick: 30 },
    { index: 2, ticks: 30, endTick: 60 },
  ],
});
test('split reference compares known observations, copies bounded rows and retains ordinary pause paints', () => {
  const doc = new Document(),
    owner = {};
  let locale = 'en';
  const ui = mountPracticeSplits({ parent: doc.body, locale: () => locale });
  ui.update(owner, state(0), { enabled: true });
  const value = reference();
  assert.equal(ui.setReference(owner, value), true);
  value.rows[0].ticks = 100;
  assert.match(ui.root.textContent, /Objective 1: not observed · reference 0.20 s/);
  for (let tick = 1; tick <= 12; tick++) ui.consume(owner, state(tick, tick === 12 ? 1 : 0));
  ui.update(owner, state(12, 1), { enabled: true });
  assert.match(ui.root.textContent, /Objective 1: 0.24 s · reference 0.20 s · Δ \+0.04 s/);
  ui.update(owner, state(12, 1), { enabled: true });
  assert.match(ui.root.textContent, /Earlier completed flight/);
  locale = 'uk';
  ui.update(owner, state(12, 1), { enabled: true });
  assert.match(ui.root.textContent, /Орієнтир часу/);
  assert.equal(ui.setReference({}, reference()), false);
  assert.equal(ui.setReference(owner, null), true);
  assert.doesNotMatch(ui.root.textContent, /Earlier completed flight|Δ/);
  ui.dispose();
  assert.equal(ui.setReference(owner, reference()), false);
});
test('split references never invent missing recovery history and clear on recovery, owner, mode or observation discontinuity', () => {
  const doc = new Document(),
    owner = {},
    ui = mountPracticeSplits({ parent: doc.body });
  ui.update(owner, state(5), { enabled: true });
  assert.equal(ui.setReference(owner, reference()), true);
  ui.consume(owner, state(6, 1));
  ui.update(owner, state(6, 1), { enabled: true });
  assert.match(ui.root.textContent, /Objective 1: start time unavailable · reference 0.20 s/);
  assert.doesNotMatch(ui.root.textContent, /Δ/);
  ui.restored(owner, state(6, 1));
  assert.doesNotMatch(ui.root.textContent, /Earlier completed flight/);
  ui.setReference(owner, reference());
  ui.update(owner, state(8, 1), { enabled: true });
  assert.doesNotMatch(ui.root.textContent, /Earlier completed flight/);
  ui.setReference(owner, reference());
  ui.update({}, state(0), { enabled: true });
  assert.doesNotMatch(ui.root.textContent, /Earlier completed flight/);
  ui.update(owner, state(0, 0, 0), { enabled: true, freeFlight: true });
  assert.equal(ui.setReference(owner, reference()), false);
  ui.update(owner, state(0), { enabled: false });
  assert.equal(ui.setReference(owner, reference()), false);
});
test('reference rows reject unsafe, unbounded, mismatched and noncontiguous timing', () => {
  const doc = new Document(),
    owner = {},
    ui = mountPracticeSplits({ parent: doc.body });
  ui.update(owner, state(0), { enabled: true });
  for (const mutate of [
    (v) => (v.name = 'x'.repeat(121)),
    (v) => v.rows.pop(),
    (v) => (v.rows[1].index = 9),
    (v) => (v.rows[0].ticks = null),
    (v) => (v.rows[0].ticks = -1),
    (v) => (v.rows[0].endTick = 11),
    (v) => (v.rows[2].endTick = Number.MAX_SAFE_INTEGER + 1),
    (v) => (v.rows = Array(65).fill(v.rows[0])),
  ]) {
    const value = reference();
    mutate(value);
    assert.equal(ui.setReference(owner, value), false);
  }
  const long = reference();
  long.rows = [{ index: 0, ticks: 36001, endTick: 36001 }];
  ui.update(owner, state(0, 0, 1), { enabled: true });
  assert.equal(
    ui.setReference(owner, long),
    true,
    'practice does not inherit the legacy twelve-minute ceiling',
  );
});
