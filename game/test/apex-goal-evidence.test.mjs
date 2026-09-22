import test from 'node:test';
import assert from 'node:assert/strict';
import { createApexCandidates } from '../content-design/apex-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, CELL } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createApexGoalEvidence, observeApexGoal, inspectApexGoal } from './helpers/apex-goal.mjs';

const project = compileContentProject(createApexCandidates());
const fixture = (id) => ({
  missionId: id,
  run: createRun(resolveMission(project, id).level),
  evidence: createApexGoalEvidence(),
});
test('Apex optional goals are initially false, read-only and fail closed for unknown IDs', () => {
  for (const mission of project.missions) {
    const f = fixture(mission.id),
      before = authoritativeCheckpoint(f.run);
    observeApexGoal(f.run, f.evidence);
    assert.equal(inspectApexGoal(f).achieved, false);
    assert.equal(inspectApexGoal(f).condition, false);
    assert.deepEqual(authoritativeCheckpoint(f.run), before);
  }
  assert.throws(
    () => inspectApexGoal({ ...fixture('home-signal'), missionId: 'unknown' }),
    /Unknown/,
  );
});

// Isolated state arrangements exercise evidence boundaries, not playthroughs.
test('Apex landing visits require reclaimed connection at visit time and at completion', () => {
  const f = fixture('returning-light');
  Object.assign(f.run.player, { x: 22.5, y: 11.5 });
  observeApexGoal(f.run, f.evidence);
  assert(!f.evidence.visits.has(1));
  f.run.cells.fill(CELL.SAFE);
  f.run.classic.topologyRevision++;
  f.run.player.cutting = true;
  observeApexGoal(f.run, f.evidence);
  assert(!f.evidence.visits.has(1));
  f.run.player.cutting = false;
  observeApexGoal(f.run, f.evidence);
  assert(f.evidence.visits.has(1));
  Object.assign(f.run.player, { x: 51.5, y: 26.5 });
  observeApexGoal(f.run, f.evidence);
  assert(inspectApexGoal(f).condition);
  assert(!inspectApexGoal(f).achieved);
  f.run.status = 'won';
  assert(inspectApexGoal(f).achieved);
  f.run.classic.livesLost = 1;
  assert(!inspectApexGoal(f).achieved);
  const disconnected = fixture('returning-light');
  disconnected.run.status = 'won';
  disconnected.evidence.visits = new Set([1, 3]);
  assert(!inspectApexGoal(disconnected).condition);
});

test('Home signal needs a connected visit on each wing, not two platforms on one side', () => {
  const f = fixture('home-signal');
  f.run.cells.fill(CELL.SAFE);
  f.run.classic.topologyRevision++;
  f.evidence.visits = new Set([1, 2, 3, 4]);
  f.run.status = 'won';
  assert(!inspectApexGoal(f).condition);
  f.evidence.visits.add(7);
  assert(inspectApexGoal(f).achieved);
});

test('every lethal cell must be reclaimed; erosion of one cell invalidates neutralization', () => {
  const f = fixture('crossing-complete');
  f.run.cells.fill(CELL.SAFE);
  f.run.classic.topologyRevision++;
  f.evidence.visits.add(3);
  f.run.status = 'won';
  assert(inspectApexGoal(f).achieved);
  const hazard = f.run.level.classic.terrain.find((tile) => tile.kind === 'lethal');
  f.run.cells[hazard.y * f.run.width + hazard.x] = CELL.FIELD;
  assert(!inspectApexGoal(f).condition);
});

test('connector visits reject future openings, live trails, unclaimed cells and completion-tick shortcuts', () => {
  const f = fixture('final-broadcast'),
    gate = f.run.relay.gates.find((gate) => gate.id === 'upper-link'),
    cell = gate.cells[0];
  Object.assign(f.run.player, {
    x: (cell % f.run.width) + 0.5,
    y: Math.floor(cell / f.run.width) + 0.5,
  });
  f.run.tick = 10;
  f.run.cells[cell] = CELL.SAFE;
  observeApexGoal(f.run, f.evidence);
  assert.equal(f.evidence.used.size, 0);
  gate.openedTick = 11;
  observeApexGoal(f.run, f.evidence);
  assert.equal(f.evidence.used.size, 0);
  gate.openedTick = 9;
  f.run.player.cutting = true;
  observeApexGoal(f.run, f.evidence);
  assert.equal(f.evidence.used.size, 0);
  f.run.player.cutting = false;
  f.run.cells[cell] = CELL.FIELD;
  observeApexGoal(f.run, f.evidence);
  assert.equal(f.evidence.used.size, 0);
  f.run.cells[cell] = CELL.SAFE;
  observeApexGoal(f.run, f.evidence);
  assert.equal(f.evidence.used.get('upper-link'), 10);
  f.evidence.used.set('lower-link', 20);
  f.run.tick = 20;
  f.run.status = 'won';
  assert(!inspectApexGoal(f).achieved);
  f.run.tick = 21;
  assert(inspectApexGoal(f).achieved);
});
