import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(
  new URL('../../optional-practice/civilian-fpv/world-app.mjs', import.meta.url),
  'utf8',
);
// Exercise the production clock admission boundary, stopping before device polling.
const start = source.indexOf('  function advanceFrame(now) {');
const end = source.indexOf('    pollGamepad(executedAt);', start);
assert.ok(start > 0 && end > start);
const boundary = `${source.slice(start, end)} } advanceFrame(600);`;

function clock(regionalPreparing, lastTime = 100, executedAt = 600) {
  const state = {
    regionalPreparing,
    current: { regional: true },
    flight: {},
    lastTime,
    lastExecutionTime: 100,
    accumulator: 123,
    pauses: 0,
    win: { performance: { now: () => executedAt } },
    $: () => ({ open: true }),
  };
  state.pauseFlight = () => state.pauses++;
  vm.runInNewContext(boundary, state);
  return state;
}

test('disarmed regional preparation does not cancel itself after a slow shader frame', () => {
  const state = clock(Promise.resolve());
  assert.equal(state.pauses, 0);
  assert.equal(state.lastTime, null);
  assert.equal(state.accumulator, 0);
  assert.equal(state.lastExecutionTime, 600);
});

test('completed preparation still freezes before polling after either clock stalls', () => {
  assert.equal(clock(null).pauses, 1);
  assert.equal(clock(null, 100, 110).pauses, 1);
});
