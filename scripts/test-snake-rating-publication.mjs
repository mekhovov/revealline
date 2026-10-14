import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_RATING_CALIBRATIONS } from '../game/snake/classic-rating-calibrations.mjs';
import {
  requirePublishedSnakeCalibration,
  requireCompleteSnakeCalibrations,
} from './lib/snake-rating-publication.mjs';
const sample = CLASSIC_SNAKE_RATING_CALIBRATIONS[0];
const published = new Map([[sample.key, sample]]);

test('a new winning setup cannot publish higher grades without separate budget approval', () => {
  assert.equal(requirePublishedSnakeCalibration(sample, published), sample);
  assert.throws(
    () => requirePublishedSnakeCalibration({ ...sample, key: `${sample.key}-new` }, published),
    /Unreviewed/,
  );
});
test('better or slower solver witnesses cannot silently tighten or relax published budgets', () => {
  for (const field of ['goldMoves', 'silverMoves', 'referenceMoves'])
    for (const change of [-1, 1])
      assert.throws(
        () =>
          requirePublishedSnakeCalibration(
            { ...sample, [field]: sample[field] + change },
            published,
          ),
        /would change/,
      );
  assert.throws(
    () =>
      requirePublishedSnakeCalibration({ ...sample, levelIdentity: 'another-recipe' }, published),
    /would change/,
  );
});
test('regeneration preserves published rows even when source evidence becomes unavailable', () => {
  assert.doesNotThrow(() => requireCompleteSnakeCalibrations(published, published));
  assert.throws(
    () => requireCompleteSnakeCalibrations(new Map(), published),
    /must not be deleted/,
  );
});
