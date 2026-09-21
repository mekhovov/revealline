import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoopEventFeedback,
  COOP_EVENT_FEEDBACK_SECONDS,
  COOP_EVENT_FEEDBACK_LIMIT,
} from '../couch/coop-event-feedback.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop, resumeCoop, FIXED_DT } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';

const command = (direction = null, boost = true, support = false) => ({
  direction,
  boost,
  support,
});
const release = [command(null, false), command(null, false)];
const fresh = (level = RELAY_YARD) =>
  startCoop(createCoop(level, { difficulty: 'standard', seed: 17 }));
const joint = (data = {}) => ({
  type: 'cut.joint',
  tick: 0,
  time: 0.005,
  players: [0, 1],
  cells: 70,
  meaningful: true,
  ...data,
});
const synthetic = (events = [joint()]) => ({ tick: 1, time: FIXED_DT, events });
function walk(run, latch, trace) {
  const accepted = [];
  for (const [count, a, b, boost = true, support = false] of trace)
    for (let i = 0; i < count; i++) {
      stepCoop(run, [command(a, boost, support), command(b, boost, support)], FIXED_DT);
      accepted.push(...latch.ingest(run));
    }
  return accepted;
}

for (const [name, level, before, after] of [
  ['First Connection', FIRST_CONNECTION, 150, 203],
  ['Relay Yard', RELAY_YARD, 230, 123],
])
  test(`${name}: earned joint capture survives multiple simulation steps before paint`, () => {
    const run = fresh(level),
      latch = createCoopEventFeedback();
    latch.begin(run);
    const added = walk(run, latch, [
      [60, 'up', 'up'],
      [before, 'right', 'left'],
      [1, 'right', 'left', true, true],
      [after, 'right', 'left'],
    ]);
    assert.equal(run.tick, 414);
    assert.equal(run.team.jointCuts, 1);
    assert.equal(added.length, 1);
    const event = run.events.find((item) => item.type === 'cut.joint');
    assert.ok(event);
    assert.equal(added[0].cells, event.cells);
    assert.equal(added[0].meaningful, event.meaningful);
    assert.deepEqual(added[0].players, event.players);
    walk(run, latch, [[8, null, null, false]]);
    assert.equal(
      run.events.some((item) => item.type === 'cut.joint'),
      false,
    );
    assert.deepEqual(latch.snapshot(run), added);
    const held = structuredClone(run);
    for (let paint = 0; paint < 100; paint++) assert.deepEqual(latch.snapshot(run), added);
    assert.deepEqual(run, held, 'painting cannot mutate simulation');
  });

test('actual team reserve recovery is retained separately from personal grace and capture', () => {
  const run = fresh(),
    control = fresh(),
    latch = createCoopEventFeedback();
  const trace = [
    [140, 'right', 'left'],
    [70, 'up', 'up'],
    [214, 'right', 'left'],
    [1, null, null, false],
    [24, 'left', 'right'],
    [35, 'up', 'up'],
  ];
  const added = walk(run, latch, trace);
  // Independent identical simulation with no feedback observer.
  for (const [count, a, b, boost = true, support = false] of trace)
    for (let i = 0; i < count; i++)
      stepCoop(control, [command(a, boost, support), command(b, boost, support)], FIXED_DT);
  assert.deepEqual(run, control);
  assert.equal(run.tick, 484);
  assert.equal(run.team.reserves, 2);
  assert.equal(run.events.filter((event) => event.type === 'player.revived').length, 2);
  const event = run.events.find((item) => item.type === 'team.recovery');
  assert.ok(event);
  const recovery = added.filter((item) => item.kind === 'team-recovery');
  assert.equal(recovery.length, 1);
  assert.equal(recovery[0].reserves, event.reserves);
  assert.equal(recovery[0].time, event.time);
  assert.equal(latch.snapshot(run).length, 2, 'recent joint capture and recovery coexist');
  assert.deepEqual(latch.ingest(run), []);
  pauseCoop(run);
  const paused = structuredClone(run),
    display = latch.snapshot(run);
  for (let i = 0; i < 180; i++) {
    stepCoop(run, release, FIXED_DT);
    assert.deepEqual(latch.ingest(run), []);
    assert.deepEqual(latch.snapshot(run), display);
  }
  assert.deepEqual(run, paused);
  resumeCoop(run);
  walk(run, latch, [[160, null, null, false]]);
  assert.deepEqual(latch.snapshot(run), []);
  assert.ok(
    run.players.every((player) => player.graceUntil > run.time),
    'personal grace is longer than this event receipt',
  );
});

test('snapshots and newly accepted receipts are immutable and detached from input', () => {
  const run = synthetic(),
    before = structuredClone(run),
    latch = createCoopEventFeedback();
  const accepted = latch.ingest(run),
    view = latch.snapshot(run);
  assert.deepEqual(run, before);
  for (const value of [accepted, view, view[0], view[0].players]) assert.ok(Object.isFrozen(value));
  assert.throws(() => view.push({}), TypeError);
  assert.throws(() => {
    view[0].players[0] = 1;
  }, TypeError);
  run.events[0].players.reverse();
  run.events[0].cells = 999;
  assert.deepEqual(view[0].players, [0, 1]);
  assert.equal(view[0].cells, 70);
});

test('same step cannot replay receipts, even if its events array is replaced', () => {
  const run = synthetic(),
    latch = createCoopEventFeedback();
  latch.begin(run);
  assert.equal(latch.ingest(run).length, 1);
  const expected = latch.snapshot(run);
  run.events = [joint({ cells: 999 })];
  latch.begin(run);
  assert.deepEqual(latch.ingest(run), []);
  assert.deepEqual(latch.snapshot(run), expected);
  run.tick++;
  run.time += FIXED_DT;
  assert.deepEqual(latch.ingest(run), [], 'prior tick event cannot replay in a later step');
});

test('lifetime follows simulation time and expires exactly at its deadline', () => {
  const run = synthetic(),
    latch = createCoopEventFeedback();
  latch.ingest(run);
  const until = 0.005 + COOP_EVENT_FEEDBACK_SECONDS;
  run.time = until - 1e-9;
  assert.equal(latch.snapshot(run).length, 1);
  run.time = until;
  assert.deepEqual(latch.snapshot(run), []);
  run.tick = 151;
  run.events = [];
  latch.ingest(run);
  assert.deepEqual(latch.snapshot(run), []);
});

test('retry/new reference and explicit reset discard the previous attempt', () => {
  const run = synthetic(),
    retry = synthetic([]),
    latch = createCoopEventFeedback();
  latch.ingest(run);
  assert.deepEqual(latch.snapshot(retry), [], 'other owner never sees prior receipt');
  assert.equal(latch.snapshot(run).length, 1, 'read-only query does not switch owner');
  latch.begin(retry);
  assert.deepEqual(latch.snapshot(run), []);
  assert.deepEqual(latch.snapshot(retry), []);
  assert.equal(latch.ingest(run).length, 1, 'new owner adopts automatically at first real step');
  latch.reset();
  assert.deepEqual(latch.snapshot(run), []);
  latch.begin(run);
  assert.deepEqual(latch.snapshot(run), []);
});

test('same-object rewind resets receipts and duplicate-step tracking', () => {
  const run = synthetic(),
    latch = createCoopEventFeedback();
  latch.ingest(run);
  Object.assign(run, { tick: 0, time: 0, events: [] });
  assert.deepEqual(latch.snapshot(run), []);
  latch.ingest(run);
  Object.assign(run, synthetic([joint({ cells: 9, meaningful: false })]));
  assert.equal(latch.ingest(run).length, 1);
  assert.equal(latch.snapshot(run)[0].cells, 9);
  assert.equal(latch.snapshot(run)[0].meaningful, false, 'do not imply a meaningful capture');
});

test('personal recovery and counters never imply a team recovery receipt', () => {
  const run = synthetic([
    {
      type: 'player.revived',
      tick: 0,
      time: 0.005,
      player: 0,
      reason: 'team-reserve',
      graceUntil: 2,
    },
    { type: 'player.revived', tick: 0, time: 0.005, player: 1, reason: 'reserve', graceUntil: 2 },
  ]);
  run.team = { reserves: 2, jointCuts: 10 };
  run.players = [{ graceUntil: 2 }, { graceUntil: 2 }];
  const latch = createCoopEventFeedback();
  assert.deepEqual(latch.ingest(run), []);
  assert.deepEqual(latch.snapshot(run), []);
});

test('malformed, future, expired, and unrelated events cannot create feedback', () => {
  const events = [
    null,
    {},
    joint({ tick: -1 }),
    joint({ tick: 1 }),
    joint({ time: Infinity }),
    joint({ time: -1 }),
    joint({ time: 99 }),
    joint({ players: [0, 0] }),
    joint({ players: [0, 2] }),
    joint({ players: [0] }),
    joint({ cells: -1 }),
    joint({ cells: 1.5 }),
    joint({ meaningful: undefined }),
    { type: 'team.recovery', tick: 0, time: 0, reserves: -1 },
    { type: 'team.recovery', tick: 0, time: 0, reserves: 1.5 },
  ];
  const latch = createCoopEventFeedback(),
    run = synthetic(events);
  assert.deepEqual(latch.ingest(run), []);
  run.tick++;
  run.time = COOP_EVENT_FEEDBACK_SECONDS;
  run.events = [joint({ tick: 1, time: 0 })];
  assert.deepEqual(latch.ingest(run), []);
});

test('a run before its first completed step cannot earn an event', () => {
  const run = { tick: 0, time: 0, events: [joint({ tick: -1, time: 0 })] };
  const latch = createCoopEventFeedback();
  assert.deepEqual(latch.ingest(run), []);
  assert.deepEqual(latch.snapshot(run), []);
});

test('memory and batch output stay bounded while newest valid receipts survive', () => {
  const events = Array.from({ length: 1000 }, (_, cells) => joint({ cells }));
  const latch = createCoopEventFeedback(),
    run = synthetic(events);
  const added = latch.ingest(run);
  assert.equal(added.length, COOP_EVENT_FEEDBACK_LIMIT);
  assert.equal(latch.snapshot(run).length, COOP_EVENT_FEEDBACK_LIMIT);
  assert.deepEqual(
    added.map((item) => item.cells),
    Array.from(
      { length: COOP_EVENT_FEEDBACK_LIMIT },
      (_, i) => 1000 - COOP_EVENT_FEEDBACK_LIMIT + i,
    ),
  );
  run.tick++;
  run.time += FIXED_DT;
  run.events = [joint({ tick: 1, time: run.time, cells: 1000 })];
  latch.ingest(run);
  assert.equal(latch.snapshot(run).length, COOP_EVENT_FEEDBACK_LIMIT);
  assert.equal(latch.snapshot(run).at(-1).cells, 1000);
});

test('separate host and Studio instances never share state', () => {
  const a = createCoopEventFeedback(),
    b = createCoopEventFeedback(),
    run = synthetic();
  a.ingest(run);
  b.begin(run);
  assert.deepEqual(b.snapshot(run), []);
  b.ingest(run);
  a.reset();
  assert.equal(b.snapshot(run).length, 1);
});

test('invalid run clocks fail without changing an existing valid owner', () => {
  const latch = createCoopEventFeedback(),
    run = synthetic();
  latch.ingest(run);
  const before = latch.snapshot(run);
  for (const invalid of [
    null,
    {},
    { tick: -1, time: 0 },
    { tick: 1.5, time: 0 },
    { tick: 0, time: NaN },
    { tick: 0, time: -1 },
  ])
    for (const action of ['begin', 'ingest', 'snapshot'])
      assert.throws(() => latch[action](invalid), TypeError);
  assert.deepEqual(latch.snapshot(run), before);
});
