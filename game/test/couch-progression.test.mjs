import test from 'node:test';
import assert from 'node:assert/strict';
import { COUCH_RACE_FORMATS, createCouchProgression } from '../couch/couch-progression.mjs';

const missions = () => [
  { key: 'base/exact-campaign/one', levelId: 'one', name: 'First mission' },
  { key: 'base/exact-campaign/two', levelId: 'two', name: 'Second mission' },
  { key: 'base/exact-campaign/three', levelId: 'three', name: 'Final mission' },
];
const create = (options = {}) =>
  createCouchProgression({
    campaignKey: 'campaign/revision/content-identity',
    campaignName: 'Named campaign',
    missions: missions(),
    roundId: 10,
    ...options,
  });
function finish(owner, winner) {
  assert.equal(owner.settle({ roundId: owner.snapshot().roundId, winner }), true);
}
function adopt(owner, action) {
  const plan = owner.plan(action);
  assert.ok(plan);
  assert.equal(owner.commit(plan, owner.snapshot().roundId + 1), true);
  return plan;
}

test('default one-race ends in a named rematch and resets only when that rematch commits', () => {
  const owner = create();
  assert.equal(owner.snapshot().format, 'one-race');
  assert.equal(owner.plan('next'), null);
  assert.equal(owner.plan('rematch'), null);
  finish(owner, 1);
  const completed = owner.snapshot();
  assert.deepEqual(completed.points, [0, 1]);
  assert.equal(completed.next, null);
  assert.equal(completed.rematch.name, 'First mission');
  const plan = owner.plan('rematch');
  assert.deepEqual(owner.snapshot(), completed);
  assert.equal(owner.commit(plan, 11), true);
  assert.equal(owner.snapshot().mission.key, completed.mission.key);
  assert.deepEqual(owner.snapshot().points, [0, 0]);
  assert.equal(owner.snapshot().terminal, false);
});

test('a drawn one-race result has no point and remains explicitly rematchable', () => {
  const owner = create();
  finish(owner, null);
  assert.deepEqual(owner.snapshot().points, [0, 0]);
  assert.equal(owner.snapshot().terminal, true);
  assert.equal(owner.snapshot().winner, null);
  assert.equal(owner.snapshot().next, null);
  assert.ok(owner.plan('rematch'));
});

test('first-to-two counts wins rather than draws and ends only after the second win', () => {
  const owner = create({ format: 'first-to-two' });
  finish(owner, null);
  assert.deepEqual(owner.snapshot().points, [0, 0]);
  assert.equal(owner.snapshot().rematch, null);
  assert.equal(owner.snapshot().next.name, 'First mission');
  adopt(owner, 'next');
  finish(owner, 0);
  assert.deepEqual(owner.snapshot().points, [1, 0]);
  assert.equal(owner.snapshot().seriesComplete, false);
  adopt(owner, 'next');
  finish(owner, null);
  assert.deepEqual(owner.snapshot().points, [1, 0]);
  adopt(owner, 'next');
  finish(owner, 1);
  assert.deepEqual(owner.snapshot().points, [1, 1]);
  adopt(owner, 'next');
  finish(owner, 0);
  assert.deepEqual(owner.snapshot().points, [2, 1]);
  assert.equal(owner.snapshot().seriesComplete, true);
  assert.equal(owner.snapshot().next, null);
  assert.equal(owner.plan('next'), null);
  const rematch = owner.plan('rematch');
  assert.deepEqual(owner.snapshot().points, [2, 1]);
  assert.equal(owner.commit(rematch, 20), true);
  assert.deepEqual(owner.snapshot().points, [0, 0]);
  assert.equal(owner.snapshot().seriesComplete, false);
});

test('terminal delivery is idempotent and obsolete rounds cannot award another result', () => {
  const owner = create({ format: 'first-to-two' });
  assert.equal(owner.settle({ roundId: 9, winner: 1 }), false);
  assert.equal(owner.settle({ roundId: 11, winner: 1 }), false);
  finish(owner, 0);
  const settled = owner.snapshot();
  assert.equal(owner.settle({ roundId: 10, winner: 0 }), false);
  assert.equal(owner.settle({ roundId: 10, winner: 1 }), false);
  assert.deepEqual(owner.snapshot(), settled);
  adopt(owner, 'next');
  const active = owner.snapshot();
  assert.equal(owner.settle({ roundId: 10, winner: 1 }), false);
  assert.deepEqual(owner.snapshot(), active);
});

test('a tour advances in captured authored order and completes without an implicit wrap', () => {
  const owner = create({ format: 'campaign-tour' });
  finish(owner, 0);
  assert.equal(owner.snapshot().next.name, 'Second mission');
  adopt(owner, 'next');
  assert.equal(owner.snapshot().mission.levelId, 'two');
  finish(owner, null);
  assert.equal(owner.snapshot().completed, 2);
  assert.deepEqual(owner.snapshot().points, [1, 0]);
  adopt(owner, 'next');
  assert.equal(owner.snapshot().mission.levelId, 'three');
  finish(owner, 1);
  const final = owner.snapshot();
  assert.equal(final.tourComplete, true);
  assert.equal(final.completed, 3);
  assert.deepEqual(final.points, [1, 1]);
  assert.equal(final.next, null);
  assert.equal(owner.plan('next'), null);
  assert.equal(final.rematch.name, 'Final mission');
  assert.deepEqual(
    final.records.map((r) => r.missionKey),
    missions().map((m) => m.key),
  );
});

test('a pending or running rematch preserves its earlier tour point until replacement settles', () => {
  const owner = create({ format: 'campaign-tour' });
  finish(owner, 0);
  const before = owner.snapshot(),
    rematch = owner.plan('rematch');
  assert.deepEqual(owner.snapshot(), before);
  assert.equal(owner.commit(rematch, 11), true);
  assert.deepEqual(owner.snapshot().records, before.records);
  assert.deepEqual(owner.snapshot().points, [1, 0]);
  assert.equal(owner.settle({ roundId: 10, winner: 1 }), false);
  finish(owner, 1);
  assert.deepEqual(owner.snapshot().points, [0, 1]);
  assert.equal(owner.snapshot().records.length, 1);
  assert.equal(owner.snapshot().records[0].roundId, 11);
  adopt(owner, 'rematch');
  assert.deepEqual(owner.snapshot().points, [0, 1]);
  finish(owner, null);
  assert.deepEqual(owner.snapshot().points, [0, 0]);
  assert.equal(owner.snapshot().records.length, 1);
  assert.equal(owner.snapshot().records[0].winner, null);
});

test('rematching a later mission cannot change another mission credit', () => {
  const owner = create({ format: 'campaign-tour' });
  finish(owner, 0);
  adopt(owner, 'next');
  finish(owner, 1);
  const first = owner.snapshot().records[0];
  adopt(owner, 'rematch');
  finish(owner, 0);
  assert.deepEqual(owner.snapshot().points, [2, 0]);
  assert.equal(owner.snapshot().records[0], first);
  assert.equal(owner.snapshot().completed, 2);
});

test('a one-mission tour ends after a draw and retains its result while rematching', () => {
  const owner = create({ format: 'campaign-tour', missions: missions().slice(0, 1) });
  finish(owner, null);
  assert.equal(owner.snapshot().tourComplete, true);
  assert.equal(owner.plan('next'), null);
  assert.deepEqual(owner.snapshot().points, [0, 0]);
  adopt(owner, 'rematch');
  assert.equal(owner.snapshot().tourComplete, false);
  assert.equal(owner.snapshot().completed, 1);
  finish(owner, 1);
  assert.equal(owner.snapshot().tourComplete, true);
  assert.deepEqual(owner.snapshot().points, [0, 1]);
});

test('failed preparation can reuse its exact pending plan without moving the cursor', () => {
  const owner = create({ format: 'campaign-tour' });
  finish(owner, 1);
  const completed = owner.snapshot(),
    planned = owner.plan('next');
  assert.equal(owner.plan('next'), planned);
  assert.equal(owner.current(planned), true);
  assert.equal(owner.plan('rematch'), null, 'Another action cannot overwrite a pending target.');
  assert.deepEqual(owner.snapshot(), completed);
  assert.equal(owner.commit(planned, 11), true);
  assert.equal(owner.snapshot().mission.key, planned.target.key);
  assert.deepEqual(owner.snapshot().points, [0, 1]);
  assert.equal(owner.commit(planned, 12), false);
});

test('Cancel retires only its plan; a late failed/cancelled rematch cannot erase tour points', () => {
  const owner = create({ format: 'campaign-tour' });
  finish(owner, 0);
  const completed = owner.snapshot(),
    cancelled = owner.plan('rematch');
  assert.equal(owner.cancel(cancelled), true);
  assert.equal(owner.current(cancelled), false);
  assert.deepEqual(owner.snapshot(), completed);
  const retry = owner.plan('rematch');
  assert.notEqual(retry, cancelled);
  assert.equal(owner.cancel(cancelled), false);
  assert.equal(owner.current(retry), true);
  assert.equal(owner.commit(cancelled, 11), false);
  assert.deepEqual(owner.snapshot(), completed);
  assert.equal(owner.commit(retry, 12), true);
  assert.deepEqual(owner.snapshot().points, [1, 0]);
});

test('plans cannot cross owners or be reconstructed from their public fields', () => {
  const first = create({ format: 'campaign-tour' }),
    replacement = create({ format: 'campaign-tour' });
  finish(first, 0);
  finish(replacement, 1);
  const plan = first.plan('next'),
    current = replacement.plan('next'),
    before = replacement.snapshot();
  assert.equal(first.current({ ...plan }), false);
  assert.equal(first.commit({ ...plan }, 11), false);
  assert.equal(replacement.commit(plan, 11), false);
  assert.equal(replacement.cancel(plan), false);
  assert.equal(replacement.current(current), true);
  assert.deepEqual(replacement.snapshot(), before);
});

test('an adopted round must have a strictly newer identity, with no partial commit on refusal', () => {
  const owner = create({ format: 'campaign-tour' });
  finish(owner, 0);
  const plan = owner.plan('next'),
    before = owner.snapshot();
  for (const id of [9, 10]) assert.equal(owner.commit(plan, id), false);
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => owner.commit(plan, id), /round identity/);
  assert.equal(owner.current(plan), true);
  assert.deepEqual(owner.snapshot(), before);
  assert.equal(owner.commit(plan, 100), true, 'Cancelled candidate IDs may leave gaps.');
});

test('disposal invalidates outstanding work without altering retained results', () => {
  const owner = create({ format: 'campaign-tour' });
  finish(owner, 0);
  const plan = owner.plan('next'),
    before = owner.snapshot();
  owner.dispose();
  owner.dispose();
  assert.deepEqual(owner.snapshot().records, before.records);
  assert.deepEqual(owner.snapshot().points, before.points);
  assert.equal(owner.snapshot().disposed, true);
  assert.equal(owner.current(plan), false);
  assert.equal(owner.commit(plan, 11), false);
  assert.equal(owner.cancel(plan), false);
  assert.equal(owner.plan('rematch'), null);
  assert.equal(owner.settle({ roundId: 10, winner: 1 }), false);
});

test('owned identity/order and exposed result projections cannot be mutated by their callers', () => {
  const supplied = missions(),
    owner = create({ format: 'campaign-tour', missions: supplied });
  supplied[0].name = 'Changed later';
  supplied.reverse();
  finish(owner, 1);
  const view = owner.snapshot(),
    plan = owner.plan('next');
  assert.equal(view.mission.name, 'First mission');
  assert.equal(plan.target.name, 'Second mission');
  for (const write of [
    () => view.points.push(5),
    () => {
      view.records[0].winner = 0;
    },
    () => {
      view.mission.key = 'different';
    },
    () => {
      view.campaign.key = 'different';
    },
    () => {
      plan.target.index = 2;
    },
    () => {
      plan.resetWins = true;
    },
    () => COUCH_RACE_FORMATS.push('other'),
  ])
    assert.throws(write, TypeError);
  assert.deepEqual(owner.snapshot().points, [0, 1]);
  assert.equal(owner.commit(plan, 11), true);
  assert.equal(owner.snapshot().mission.levelId, 'two');
});

test('a new tour refuses a later starting point while standalone formats preserve selected identity', () => {
  const initialKey = missions()[1].key;
  assert.throws(() => create({ format: 'campaign-tour', initialKey }), /first mission/);
  for (const format of ['one-race', 'first-to-two']) {
    const owner = create({ format, initialKey });
    assert.equal(owner.snapshot().mission.levelId, 'two');
    finish(owner, 0);
    assert.equal((owner.snapshot().next ?? owner.snapshot().rematch).levelId, 'two');
  }
});

test('invalid campaign identities, missions and result values reject without manufacturing progress', () => {
  for (const options of [
    { format: 'tour-ish' },
    { campaignKey: '' },
    { campaignName: ' ' },
    { missions: [] },
    { missions: [undefined] },
    { missions: [{ key: 'one', levelId: 'one' }] },
    { missions: [missions()[0], missions()[0]] },
    { missions: [missions()[0], { ...missions()[1], levelId: 'one' }] },
    { initialKey: 'another-campaign/one' },
    { roundId: 0 },
  ])
    assert.throws(() => create(options), TypeError);
  const owner = create(),
    before = owner.snapshot();
  for (const winner of [undefined, -1, 2, '0', false, NaN])
    assert.throws(() => owner.settle({ roundId: 10, winner }), /winner/);
  assert.throws(() => owner.plan('skip-campaign'), /action/);
  assert.deepEqual(owner.snapshot(), before);
});
