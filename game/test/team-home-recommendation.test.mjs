import test from 'node:test';
import assert from 'node:assert/strict';
import { teamHomeRecommendation } from '../ui/team-home-recommendation.mjs';

const first = Object.freeze({ id: 'first', name: 'First' });
const second = Object.freeze({ id: 'second', name: 'Second' });
const firstRow = Object.freeze({ mission: first, difficulty: 'standard' });
const secondRow = Object.freeze({ mission: second, difficulty: 'standard' });
const expertRow = Object.freeze({ mission: first, difficulty: 'expert' });
const mismatchedRow = Object.freeze({ mission: Object.freeze({ ...first }) });
const owned = new Set([firstRow, secondRow, expertRow, mismatchedRow]);
const journey = Object.freeze({
  owns: (row) => owned.has(row),
  catalog: Object.freeze({
    find: (id) => [first, second].find((mission) => mission.id === id),
    get missions() {
      throw new Error('Explanation must not read or reorder the mission list.');
    },
  }),
  next() {
    throw new Error('Explanation must not select a successor.');
  },
});
const explain = (row, initial = null, ready = true) =>
  teamHomeRecommendation({ journey, row, initial, ready });

test('explains the first destination supplied by the initial Team owner', () => {
  const initial = Object.freeze({ destination: firstRow, first, cursorId: null, cursor: null });
  assert.deepEqual(explain(firstRow, initial), { kind: 'first', mission: first });
});

test('a deliberate prepared selection is neutral even when it is the opening mission', () => {
  assert.deepEqual(explain(firstRow), { kind: 'selected', mission: first });
  assert.deepEqual(explain(expertRow), { kind: 'selected', mission: first });
  assert.deepEqual(explain(secondRow), { kind: 'selected', mission: second });
});

test('explains an owned cursor without claiming completion or mastery', () => {
  const initial = Object.freeze({
    destination: secondRow,
    first,
    cursorId: second.id,
    cursor: second,
  });
  assert.deepEqual(explain(secondRow, initial), { kind: 'selected', mission: second });
});

test('explains only the existing owner supplied successor of a recorded completion', () => {
  const initial = Object.freeze({
    destination: secondRow,
    first,
    cursorId: first.id,
    cursor: first,
    recordedClear: true,
  });
  assert.deepEqual(explain(secondRow, initial), {
    kind: 'recordedNext',
    mission: second,
    previous: first,
  });
  assert.equal(explain(firstRow, initial), null);
});

test('a recorded final fallback does not fabricate another mission', () => {
  assert.equal(
    explain(secondRow, { destination: secondRow, cursor: second, recordedClear: true }),
    null,
  );
});

test('unknown, archived and mismatched initial cursors do not explain the fallback', () => {
  for (const initial of [
    { destination: firstRow, first, cursorId: 'unknown', cursor: null },
    { destination: firstRow, first, cursorId: 'archive/first', cursor: null },
    { destination: secondRow, first, cursor: first },
  ])
    assert.equal(explain(initial.destination, Object.freeze(initial)), null);
});

test('same-ID imports, copied mission objects and unsupported prepared states have no authority', () => {
  for (const row of [null, { ...firstRow }, mismatchedRow]) assert.equal(explain(row), null);
  assert.equal(explain(firstRow, null, false), null);
  assert.equal(teamHomeRecommendation({ row: firstRow, ready: true }), null);
});

test('the first reason uses the host supplied first identity without consulting catalogue order', () => {
  assert.deepEqual(explain(secondRow, { destination: secondRow, first: second }), {
    kind: 'first',
    mission: second,
  });
});
