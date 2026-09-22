import test from 'node:test';
import assert from 'node:assert/strict';
import { CELL } from '../core/index.mjs';
import {
  remainingLethal,
  districtHazardSearchPolicy,
} from '../../scripts/lib/district-hazard-search.mjs';

function state() {
  const cells = new Uint8Array(72).fill(CELL.FIELD);
  const terrain = new Uint8Array(72);
  terrain[54] = 2;
  terrain[55] = 2;
  terrain[12] = 1;
  return { cells, width: 72, classic: { terrain }, tick: 0 };
}
test('hazard probe rejects early ordinary wins without changing victory or cells', () => {
  const run = state();
  run.status = 'won';
  const original = structuredClone(run);
  assert.equal(remainingLethal(run), 2);
  assert.equal(districtHazardSearchPolicy.acceptCompletion(run), false);
  assert.deepEqual(run, original);
  run.cells[54] = CELL.SAFE;
  assert.equal(districtHazardSearchPolicy.acceptCompletion(run), false);
  run.cells[55] = CELL.SAFE;
  assert.equal(districtHazardSearchPolicy.acceptCompletion(run), true);
  assert.equal(run.cells[12], CELL.FIELD, 'slow field is not a compulsory mastery condition');
});
test('offline ordering prefers eastern approaches then lethal neutralization, never edits runs', () => {
  const run = state();
  const west = structuredClone(run),
    east = structuredClone(run),
    hazard = structuredClone(run);
  west.cells[8] = CELL.SAFE;
  east.cells[40] = CELL.SAFE;
  hazard.cells[54] = CELL.SAFE;
  for (const next of [west, east, hazard]) next.tick = 120;
  const before = structuredClone([run, west, east, hazard]);
  const score = (next) => districtHazardSearchPolicy.scoreCandidate({ run, next, defaultScore: 9 });
  assert(score(east) > score(west));
  assert(score(hazard) > score(east));
  assert.deepEqual([run, west, east, hazard], before);
  run.cells[54] = run.cells[55] = CELL.SAFE;
  assert.equal(score(east), 9, 'ordinary ordering resumes once the hazard is neutralized');
});
