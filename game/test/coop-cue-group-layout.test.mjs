import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutCoopCues } from '../couch/coop-actor-layout.mjs';

const box = (x, y, width, height) => ({
  x,
  y,
  width,
  height,
  left: x - width / 2,
  right: x + width / 2,
  top: y - height / 2,
  bottom: y + height / 2,
});
const request = (x, y, width, height) => ({
  x,
  y,
  width,
  height,
  original: box(x, y, width, height),
});
const overlaps = (a, b) =>
  a.left < b.right - 1e-9 &&
  a.right > b.left + 1e-9 &&
  a.top < b.bottom - 1e-9 &&
  a.bottom > b.top + 1e-9;

function assertPacking(result, requests, { arenaWidth, arenaHeight, heads = [] }) {
  assert.equal(result.placements.length, requests.length);
  assert.deepEqual(
    result.unplaced,
    result.placements.flatMap((rect, index) => (rect ? [] : [index])),
  );
  for (let index = 0; index < requests.length; index++) {
    const rect = result.placements[index];
    if (!rect) continue;
    assert.equal(rect.width, requests[index].width);
    assert.equal(rect.height, requests[index].height);
    assert.ok(rect.left >= 1 && rect.right <= arenaWidth - 1);
    assert.ok(rect.top >= 1 && rect.bottom <= arenaHeight - 1);
    assert.ok(!heads.some((head) => overlaps(rect, head)));
    for (let other = 0; other < index; other++)
      if (result.placements[other]) assert.ok(!overlaps(rect, result.placements[other]));
  }
}

test('clear historical cue placements remain exact and input measurements are untouched', () => {
  const requests = [request(20, 15, 20, 12), request(70, 40, 30, 16)],
    context = { arenaWidth: 100, arenaHeight: 60, heads: [box(48, 20, 4, 4)] },
    before = structuredClone({ requests, context });
  const result = layoutCoopCues(requests, context);
  assert.deepEqual(result.unplaced, []);
  assert.equal(result.exhausted, false);
  for (let index = 0; index < requests.length; index++)
    assert.strictEqual(result.placements[index], requests[index].original);
  assert.deepEqual({ requests, context }, before);
});

test('group packing repairs overlapping greedy positions without shrinking or covering heads', () => {
  const requests = [request(50, 30, 60, 20), request(50, 30, 60, 20), request(75, 30, 35, 35)],
    context = { arenaWidth: 100, arenaHeight: 60, heads: [box(3, 3, 4, 4)] },
    before = structuredClone({ requests, context }),
    first = layoutCoopCues(requests, context);
  assert.deepEqual(first.unplaced, []);
  assertPacking(first, requests, context);
  for (let frame = 0; frame < 5; frame++)
    assert.deepEqual(
      layoutCoopCues(requests, context),
      first,
      'Packing has no frame clock/history.',
    );
  assert.deepEqual({ requests, context }, before);
});

test('oversized, impossible and malformed cues remain explicit overflow instead of disappearing', () => {
  for (const requests of [
    [request(30, 20, 60, 12)],
    [request(30, 20, 58, 38), request(30, 20, 58, 38)],
    [request(30, 20, 20, 12), { x: NaN, y: 20, width: 20, height: 12 }],
  ]) {
    const context = { arenaWidth: 60, arenaHeight: 40, heads: [] },
      result = layoutCoopCues(requests, context);
    assert.ok(result.unplaced.length > 0);
    assertPacking(result, requests, context);
  }
  const requests = [request(30, 20, 20, 12)];
  assert.deepEqual(
    layoutCoopCues(requests, {
      arenaWidth: 60,
      arenaHeight: 40,
      heads: [{ left: NaN, right: 40, top: 0, bottom: 40 }],
    }).unplaced,
    [0],
  );
});

test('a malformed original rectangle cannot bypass the group head exclusion', () => {
  const requests = [request(30, 20, 20, 12)],
    context = { arenaWidth: 60, arenaHeight: 40, heads: [box(30, 20, 8, 8)] };
  requests[0].original.left = 1;
  requests[0].original.right = 2;
  const result = layoutCoopCues(requests, context);
  assert.deepEqual(result.unplaced, []);
  assertPacking(result, requests, context);
  assert.notDeepEqual(result.placements[0], requests[0].original);
});
