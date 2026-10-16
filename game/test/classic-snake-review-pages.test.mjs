import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS, CLASSIC_SNAKE_CHAPTERS } from '../snake/classic-catalogue.mjs';
import { snakeReviewPage } from './manual/snake-review-pages.mjs';

test('the whole catalogue remains reachable with at most six missions and 24 look canvases per page', () => {
  const count = snakeReviewPage(CLASSIC_SNAKE_LEVELS).pages;
  const visited = [];
  for (let page = 0; page < count; page++) {
    const view = snakeReviewPage(CLASSIC_SNAKE_LEVELS, { page });
    assert(view.entries.length > 0 && view.entries.length <= 6);
    assert(view.entries.length * 4 <= 24);
    visited.push(...view.entries.map((entry) => entry.id));
  }
  assert.deepEqual(
    visited,
    CLASSIC_SNAKE_LEVELS.map((entry) => entry.id),
  );
});

test('chapter navigation preserves order, clamps old page indices and does not mutate recipes', () => {
  const before = JSON.stringify(CLASSIC_SNAKE_LEVELS);
  for (const chapter of CLASSIC_SNAKE_CHAPTERS) {
    const expected = CLASSIC_SNAKE_LEVELS.filter((entry) => entry.chapterId === chapter.id);
    const first = snakeReviewPage(CLASSIC_SNAKE_LEVELS, { chapterId: chapter.id, page: -1 });
    const last = snakeReviewPage(CLASSIC_SNAKE_LEVELS, { chapterId: chapter.id, page: 999 });
    assert.equal(first.page, 0);
    assert.equal(last.page, first.pages - 1);
    const actual = Array.from(
      { length: first.pages },
      (_, page) => snakeReviewPage(CLASSIC_SNAKE_LEVELS, { chapterId: chapter.id, page }).entries,
    ).flat();
    assert.deepEqual(actual, expected);
  }
  assert.deepEqual(snakeReviewPage([], { page: Infinity }).entries, []);
  assert.equal(JSON.stringify(CLASSIC_SNAKE_LEVELS), before);
});
