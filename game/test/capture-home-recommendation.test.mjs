import test from 'node:test';
import assert from 'node:assert/strict';
import { captureHomeRecommendation } from '../ui/capture-home-recommendation.mjs';

const first = Object.freeze({ id: 'owner/pack/campaign/first', name: 'Same title' });
const next = Object.freeze({ id: 'owner/pack/campaign/next', name: 'Same title' });
const catalog = Object.freeze({
  find: (id) => [first, next].find((row) => row.id === id) ?? null,
  next: () => assert.fail('Explanation cannot own progression'),
});
const facts = Object.freeze({ catalog, destination: first });

test('first and selected recommendations explain exact owned destinations without finding a successor', () => {
  assert.deepEqual(captureHomeRecommendation(facts), {
    reason: 'first',
    destination: first,
    current: null,
  });
  assert.deepEqual(captureHomeRecommendation({ ...facts, cursorId: first.id }), {
    reason: 'selected',
    destination: first,
    current: first,
  });
});

test('real Resume takes priority while a navigation cursor alone still has an explanation', () => {
  assert.equal(captureHomeRecommendation({ ...facts, cursorId: first.id, resume: true }), null);
  assert.equal(captureHomeRecommendation({ ...facts, resume: true }), null);
  assert.equal(captureHomeRecommendation({ ...facts, cursorId: first.id }).reason, 'selected');
});

test('only the accepted terminal loss for this exact mission justifies a retry explanation', () => {
  for (const status of ['ready', 'running', 'respawning', 'won'])
    assert.equal(
      captureHomeRecommendation({
        ...facts,
        cursorId: first.id,
        lastAttempt: { status, mission: first },
      }).reason,
      'selected',
    );
  for (const mission of [next, { ...first }, null])
    assert.equal(
      captureHomeRecommendation({
        ...facts,
        cursorId: first.id,
        lastAttempt: { status: 'lost', mission },
      }).reason,
      'selected',
    );
  assert.equal(
    captureHomeRecommendation({
      ...facts,
      cursorId: first.id,
      lastAttempt: { status: 'lost', mission: first },
    }).reason,
    'retry',
  );
});

test('recorded completion explains the supplied native successor without asserting current mastery', () => {
  const result = captureHomeRecommendation({
    catalog,
    destination: next,
    cursorId: first.id,
    recordedClear: true,
  });
  assert.deepEqual(result, { reason: 'recorded-next', destination: next, current: first });
  assert.ok(Object.isFrozen(result));
  assert.equal(
    captureHomeRecommendation({ ...facts, cursorId: first.id, recordedClear: true }),
    null,
  );
});

test('unknown, substituted, stale and inconsistent owners never fabricate a mission', () => {
  for (const patch of [
    { destination: null },
    { destination: { ...first } },
    { destination: { id: 'removed', name: first.name } },
    { cursorId: 'removed' },
    { cursorId: next.id },
    { catalog: null },
  ])
    assert.equal(captureHomeRecommendation({ ...facts, ...patch }), null);
  assert.equal(captureHomeRecommendation(), null);
  assert.deepEqual(facts, { catalog, destination: first });
});
