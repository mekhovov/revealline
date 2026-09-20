import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainTransitionCaption } from '../ui/terrain-feedback.mjs';
import { CELL, createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

test('terrain captions count only accepted, currently neutralized cells, without a safety promise', () => {
  const run = {
    cells: Uint8Array.from([CELL.SAFE, CELL.SAFE, CELL.FIELD, CELL.WALL, CELL.TRAIL]),
    classic: { terrain: Uint8Array.from([1, 2, 2, 2, 1]) },
  };
  assert.equal(
    terrainTransitionCaption(run, {
      type: 'cells.claimed',
      indices: [0, 1, 1, 2, 3, 4, -1, 20, 0.5],
    }),
    '1 slow-field cell neutralized by this capture. 1 lethal-field cell neutralized by this capture.',
  );
  assert.equal(terrainTransitionCaption(run, { type: 'capture.stopped', indices: [0, 1] }), '');
  assert.equal(terrainTransitionCaption(run, { type: 'cells.claimed' }), '');
  assert.equal(
    terrainTransitionCaption({ cells: run.cells }, { type: 'cells.claimed', indices: [0] }),
    '',
  );
  assert.equal(terrainTransitionCaption(run, { type: 'cells.claimed', indices: [2, 3, 4] }), '');
});

test('reopened terrain names its restored effect; reclaimed ground and walls do not become hazard claims', () => {
  const run = {
    cells: Uint8Array.from([CELL.FIELD, CELL.FIELD, CELL.SAFE, CELL.WALL]),
    classic: { terrain: Uint8Array.from([1, 2, 2, 1]) },
  };
  const before = structuredClone(run);
  assert.equal(
    terrainTransitionCaption(run, { type: 'cells.eroded', indices: [0, 1, 2, 3] }),
    '1 slow-field cell active again: slows your craft. 1 lethal-field cell active again: harms your craft.',
  );
  assert.deepEqual(run, before);
});

test('a legal foundation closure explains neutralized materials without changing the authoritative run', () => {
  const source = createStarterProject();
  source.maps[0].spawns[0].x = 36.5;
  source.maps[0].terrain = [
    { id: 'slow', kind: 'slow', x: 10, y: 10, w: 2, h: 2 },
    { id: 'lethal', kind: 'lethal', x: 15, y: 10, w: 2, h: 2 },
  ];
  const run = createRun(resolveMission(compileContentProject(source), 'nearby-shore').level);
  for (let tick = 0; tick < 450 && !run.claimedCount; tick++)
    stepRun(run, { direction: 'down' }, FIXED_DT);
  const event = run.events.find((item) => item.type === 'cells.claimed');
  assert(event);
  const before = authoritativeCheckpoint(run);
  assert.equal(
    terrainTransitionCaption(run, event),
    '4 slow-field cells neutralized by this capture. 4 lethal-field cells neutralized by this capture.',
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
});
