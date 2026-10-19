import test from 'node:test';
import assert from 'node:assert/strict';
import { versusHomeRecommendation } from '../ui/versus-home-recommendation.mjs';

const missions = Object.freeze(
  ['opening', 'middle', 'host-successor'].map((id) => Object.freeze({ id })),
);
const catalog = Object.freeze({
  missions,
  find: (id) => missions.find((mission) => mission.id === id),
  next() {
    throw new Error('Explanation must not choose a successor.');
  },
});
const explain = (options) => versusHomeRecommendation({ catalog, ready: true, ...options });

test('first explanation requires the exact accepted first mission from its initial owner', () => {
  const initial = Object.freeze({
    destination: missions[0],
    cursor: null,
    cursorId: null,
    recordedClear: false,
  });
  assert.deepEqual(explain({ mission: missions[0], initial }), {
    kind: 'first',
    mission: missions[0],
  });
  assert.equal(explain({ mission: missions[1], initial }), null);
});

test('recorded completion explains the exact host destination without computing another next', () => {
  const initial = Object.freeze({
    destination: missions[2],
    cursor: missions[0],
    cursorId: missions[0].id,
    recordedClear: true,
  });
  assert.deepEqual(explain({ mission: missions[2], initial }), {
    kind: 'recordedNext',
    mission: missions[2],
    previous: missions[0],
  });
  assert.equal(initial.destination, missions[2]);
});

test('an exact manually accepted mission receives neutral selected wording', () => {
  assert.deepEqual(explain({ mission: missions[2] }), { kind: 'selected', mission: missions[2] });
  const initial = {
    destination: missions[1],
    cursor: missions[1],
    cursorId: missions[1].id,
    recordedClear: false,
  };
  assert.deepEqual(explain({ mission: missions[1], initial }), {
    kind: 'selected',
    mission: missions[1],
  });
});

test('a stale cursor, an unknown accepted object and a final fallback invent no recommendation', () => {
  assert.equal(explain({ mission: { ...missions[0] } }), null);
  assert.equal(
    explain({
      mission: missions[0],
      initial: {
        destination: missions[0],
        cursor: null,
        cursorId: 'unavailable',
        recordedClear: false,
      },
    }),
    null,
  );
  assert.equal(
    explain({
      mission: missions[2],
      initial: {
        destination: missions[2],
        cursor: missions[2],
        cursorId: missions[2].id,
        recordedClear: true,
      },
    }),
    null,
  );
});

test('a pending or resumed attempt does not inspect a catalogue for a Start recommendation', () => {
  assert.equal(
    versusHomeRecommendation({
      catalog: {
        find() {
          throw new Error('Not a ready selection.');
        },
      },
      mission: missions[0],
      ready: false,
    }),
    null,
  );
});
