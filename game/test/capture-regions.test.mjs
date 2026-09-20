import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { CELL } from '../core/registry.mjs';

function board(enemies = []) {
  const width = 9,
    height = 7;
  return {
    width,
    height,
    tick: 42,
    classic: {},
    enemies,
    cells: Uint8Array.from({ length: width * height }, (_, i) => {
      const x = i % width,
        y = Math.floor(i / width);
      return x === 0 || y === 0 || x === width - 1 || y === height - 1 ? CELL.SAFE : CELL.FIELD;
    }),
    objectives: [{ id: 'relay', x: 2.5, y: 3.5 }],
  };
}
const divider = [13, 22, 31, 40, 49];
test('one enemy retains its region, empty side fills and preview leaves live cells unchanged', () => {
  const state = board([{ id: 'drifter', type: 'bouncer', x: 6.5, y: 3.5 }]);
  const before = Uint8Array.from(state.cells);
  const result = inspectCaptureSnapshot(state, { trailCells: divider });
  assert.equal(result.components.length, 2);
  assert.equal(result.filledCells.length, 15);
  assert.deepEqual(result.affectedObjectiveIds, ['relay']);
  assert.deepEqual(
    result.components.map((component) => component.enemyIds),
    [[], ['drifter']],
  );
  assert.deepEqual(state.cells, before);
  assert.equal(result.tick, 42);
});
test('enemies on both sides produce a line-only capture; patrols and rovers do not retain', () => {
  const enemies = [
    { id: 'left', type: 'bouncer', x: 2.5, y: 3.5 },
    { id: 'right', type: 'bouncer', x: 6.5, y: 3.5 },
  ];
  assert.equal(inspectCaptureSnapshot(board(enemies), { trailCells: divider }).lineOnly, true);
  for (const type of ['border-patrol', 'contour-patrol', 'claimed-rover']) {
    const result = inspectCaptureSnapshot(board([{ ...enemies[0], type }]), {
      trailCells: divider,
    });
    assert.equal(result.filledCells.length, 30);
  }
});
test('remote chambers fill, diagonal touch does not connect, and a cardinal narrow link does', () => {
  const state = board([{ id: 'right', type: 'bouncer', x: 6.5, y: 3.5 }]);
  for (const index of divider) state.cells[index] = CELL.WALL;
  assert.equal(inspectCaptureSnapshot(state).filledCells.length, 15);
  state.cells[31] = CELL.FIELD;
  assert.equal(inspectCaptureSnapshot(state).filledCells.length, 0);
  state.cells.fill(CELL.WALL);
  state.cells[10] = state.cells[20] = CELL.FIELD;
  state.enemies = [{ id: 'seed', type: 'bouncer', x: 1.5, y: 1.5 }];
  assert.deepEqual(inspectCaptureSnapshot(state).filledCells, [20]);
});
test('boss release is explicit; walls cannot become return trails', () => {
  const state = board([{ id: 'boss', type: 'relay-sentinel', x: 6.5, y: 3.5 }]);
  assert.equal(inspectCaptureSnapshot(state).filledCells.length, 0);
  assert.equal(inspectCaptureSnapshot(state, { releaseBoss: true }).filledCells.length, 35);
  state.cells[13] = CELL.WALL;
  assert.throws(() => inspectCaptureSnapshot(state, { trailCells: divider }), /wall/);
  assert.throws(() => inspectCaptureSnapshot(state, { trailCells: [-1] }), /outside/);
});
