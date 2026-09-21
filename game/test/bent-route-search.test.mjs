import test from 'node:test';
import assert from 'node:assert/strict';
import { createFractureSpatialCandidates } from '../content-design/fracture-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, CELL, DIRECTIONS } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { bentFieldChoices, sampleBentChoices } from '../../scripts/lib/bent-route-search.mjs';

const manifest = resolveMission(
  compileContentProject(createFractureSpatialCandidates()),
  'two-districts',
);
test('bent proposals stay within field, avoid walls/lethal terrain and end on reclaimed ground', () => {
  const run = createRun(manifest.level);
  const start = 30 * run.width + 37,
    path = [start];
  const before = authoritativeCheckpoint(run);
  const choices = bentFieldChoices(run, start, path, 'right');
  assert(choices.length > 0);
  assert(choices.some((c) => c.legs.length === 3));
  for (const choice of choices) {
    let x = start % run.width,
      y = Math.floor(start / run.width);
    const cells = [];
    for (const leg of choice.legs) {
      const v = DIRECTIONS[leg.direction];
      while (x !== Math.floor(leg.x) || y !== Math.floor(leg.y)) {
        x += v.x;
        y += v.y;
        assert(x >= 0 && x < run.width && y >= 0 && y < run.height);
        const index = y * run.width + x;
        assert.notEqual(run.cells[index], CELL.WALL);
        assert.notEqual(run.classic.terrain[index], 2);
        cells.push(index);
      }
    }
    assert.equal(new Set(cells).size, cells.length);
    assert.equal(run.cells[cells.at(-1)], CELL.SAFE);
    assert(cells.slice(0, -1).every((i) => run.cells[i] === CELL.FIELD));
    assert.deepEqual(choice.trail, cells.slice(0, -1));
  }
  const sampled = sampleBentChoices(run, choices);
  assert(sampled.length > 0 && sampled.length <= 60);
  assert(sampled.every((c) => choices.includes(c) && Number.isFinite(c.estimate)));
  assert.deepEqual(authoritativeCheckpoint(run), before, 'frozen estimates never mutate gameplay');
  assert.deepEqual(bentFieldChoices(run, 0, [0], 'up'), []);
});
