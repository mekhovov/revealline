import test from 'node:test';
import assert from 'node:assert/strict';
import { revealFirstFlightBoard } from '../ui/first-flight-launch.mjs';

function arena(rect) {
  const calls = [];
  return {
    calls,
    getBoundingClientRect: () => ({ ...rect }),
    scrollIntoView: (options) => calls.push(options),
    focus: () => assert.fail('Course board alignment must not change focus.'),
  };
}

test('a board already wholly visible retains the existing document scroll and focus', () => {
  const node = arena({ top: 0, bottom: 210, left: 20, right: 300 });
  assert.equal(revealFirstFlightBoard(node, { innerWidth: 320, innerHeight: 640 }), false);
  assert.deepEqual(node.calls, []);
});

test('explicit launch aligns a clipped board by the nearest edge without animated scrolling', () => {
  for (const rect of [
    { top: -52, bottom: 158, left: 20, right: 300 },
    { top: 500, bottom: 710, left: 20, right: 300 },
    { top: 20, bottom: 230, left: -20, right: 260 },
    { top: 20, bottom: 230, left: 60, right: 340 },
  ]) {
    const node = arena(rect);
    assert.equal(revealFirstFlightBoard(node, { innerWidth: 320, innerHeight: 640 }), true);
    assert.deepEqual(node.calls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  }
});

test('hidden, unmounted or unmeasurable layouts never trigger a page scroll', () => {
  for (const rect of [
    { top: 0, bottom: 0, left: 0, right: 0 },
    { top: NaN, bottom: 210, left: 20, right: 300 },
    { top: 500, bottom: 400, left: 20, right: 300 },
  ]) {
    const node = arena(rect);
    assert.equal(revealFirstFlightBoard(node, { innerWidth: 320, innerHeight: 640 }), false);
    assert.deepEqual(node.calls, []);
  }
  assert.equal(revealFirstFlightBoard(null, { innerWidth: 320, innerHeight: 640 }), false);
  const node = arena({ top: -52, bottom: 158, left: 20, right: 300 });
  assert.equal(revealFirstFlightBoard(node, { innerWidth: 320, innerHeight: 0 }), false);
  assert.deepEqual(node.calls, []);
});
