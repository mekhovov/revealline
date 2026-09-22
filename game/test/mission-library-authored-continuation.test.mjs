import test from 'node:test';
import assert from 'node:assert/strict';
import { authoredMissionSuccessor } from '../mission-library/authored-continuation.mjs';

const entry = Object.freeze({
  campaign: Object.freeze({
    levels: Object.freeze(
      Array.from({ length: 12 }, (_, index) => Object.freeze({ id: `mission-${index}` })),
    ),
  }),
});

test('Next follows authored order after an explicitly selected late mission, not first unfinished', () => {
  assert.deepEqual(authoredMissionSuccessor(entry, 0), { levelIndex: 1, atEnd: false });
  assert.deepEqual(authoredMissionSuccessor(entry, 9), { levelIndex: 10, atEnd: false });
  assert.equal(Object.isFrozen(authoredMissionSuccessor(entry, 9)), true);
});

test('last authored mission ends this sequence without wrapping or claiming campaign completion', () => {
  const result = authoredMissionSuccessor(entry, 11);
  assert.deepEqual(result, { levelIndex: null, atEnd: true });
  assert.equal(Object.hasOwn(result, 'complete'), false);
  assert.deepEqual(authoredMissionSuccessor({ campaign: { levels: [{ id: 'only' }] } }, 0), {
    levelIndex: null,
    atEnd: true,
  });
});

test('Custom ordering stays in its exact campaign even with identical display names', () => {
  const custom = {
    campaign: {
      levels: [
        { id: 'z', name: 'Same' },
        { id: 'a', name: 'Same' },
      ],
    },
  };
  const before = structuredClone(custom);
  const successor = authoredMissionSuccessor(custom, 0);
  assert.equal(custom.campaign.levels[successor.levelIndex].id, 'a');
  assert.deepEqual(custom, before);
  assert.deepEqual(authoredMissionSuccessor(custom, 1), { levelIndex: null, atEnd: true });
});

test('navigation neither reads progress nor grants clears or unlocks', () => {
  const profile = { clears: {}, unlocked: [] };
  const before = structuredClone(profile);
  const guarded = {
    campaign: entry.campaign,
    get progress() {
      throw new Error('Progress is not Next authority');
    },
  };
  assert.deepEqual(authoredMissionSuccessor(guarded, 10), { levelIndex: 11, atEnd: false });
  assert.deepEqual(profile, before);
});

test('invalid or stale indexes fail rather than clamping to an unrelated mission', () => {
  for (const index of [-1, 12, 0.5, '0', NaN, Infinity, null, undefined])
    assert.throws(() => authoredMissionSuccessor(entry, index), /exact current mission/);
  for (const invalid of [null, {}, { campaign: {} }, { campaign: { levels: [] } }])
    assert.throws(() => authoredMissionSuccessor(invalid, 0), /exact current mission/);
  assert.throws(
    () => authoredMissionSuccessor({ campaign: { levels: [{ id: 'first' }, null] } }, 0),
    /successor is missing/,
  );
});
