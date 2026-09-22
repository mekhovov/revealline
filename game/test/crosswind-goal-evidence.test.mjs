import test from 'node:test';
import assert from 'node:assert/strict';
import { createCrosswindCandidates } from '../content-design/crosswind-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, CELL } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import {
  createCrosswindGoalEvidence,
  observeCrosswindGoal,
  inspectCrosswindGoal,
} from './helpers/crosswind-goal.mjs';

const project = compileContentProject(createCrosswindCandidates());
const fixture = (id) => ({
  missionId: id,
  run: createRun(resolveMission(project, id).level),
  evidence: createCrosswindGoalEvidence(),
});

test('initial Crosswind goals are false and observers cannot alter runtime authority', () => {
  for (const mission of project.missions) {
    const f = fixture(mission.id),
      before = authoritativeCheckpoint(f.run);
    observeCrosswindGoal(f.run, f.evidence);
    assert.equal(inspectCrosswindGoal(f).achieved, false);
    assert.equal(inspectCrosswindGoal(f).condition, false);
    assert.deepEqual(authoritativeCheckpoint(f.run), before);
  }
  assert.throws(
    () => inspectCrosswindGoal({ ...fixture('read-the-arrows'), missionId: 'unknown' }),
    /Unknown/,
  );
});

test('whole-field goal rejects a partial strip, life loss, unfinished run and restored unclaimed cell', () => {
  const f = fixture('read-the-arrows'),
    { run } = f;
  // Isolated state arrangements validate the observer; they are not gameplay solutions.
  run.status = 'won';
  for (const zone of run.level.directionalFields.zones)
    for (let y = zone.y; y < zone.y + zone.h; y++)
      for (let x = zone.x; x < zone.x + zone.w; x++) run.cells[y * run.width + x] = CELL.SAFE;
  assert.equal(inspectCrosswindGoal(f).achieved, true);
  run.status = 'running';
  assert.equal(inspectCrosswindGoal(f).achieved, false);
  run.status = 'won';
  run.classic.livesLost = 1;
  assert.equal(inspectCrosswindGoal(f).achieved, false);
  run.classic.livesLost = 0;
  const zone = run.level.directionalFields.zones[1];
  run.cells[zone.y * run.width + zone.x] = CELL.FIELD;
  assert.equal(inspectCrosswindGoal(f).condition, false);
});

test('landing visits require a reclaimed connection and no active cut, not just coordinates', () => {
  const f = fixture('survey-markers'),
    { run, evidence } = f;
  Object.assign(run.player, { x: 9.5, y: 17.5 });
  observeCrosswindGoal(run, evidence);
  assert(!evidence.visits.has(1), 'An isolated landing cannot count as connected.');
  run.cells.fill(CELL.SAFE);
  run.classic.topologyRevision++;
  run.player.cutting = true;
  observeCrosswindGoal(run, evidence);
  assert(!evidence.visits.has(1), 'An unfinished crossing cannot count as a return.');
  run.player.cutting = false;
  observeCrosswindGoal(run, evidence);
  assert(evidence.visits.has(1));
  assert.equal(inspectCrosswindGoal(f).condition, false);
  run.player.x = 60.5;
  observeCrosswindGoal(run, evidence);
  run.status = 'won';
  assert.equal(inspectCrosswindGoal(f).achieved, true);
  const disconnected = fixture('survey-markers');
  disconnected.run.status = 'won';
  disconnected.evidence.visits = new Set([1, 2]);
  assert.equal(
    inspectCrosswindGoal(disconnected).condition,
    false,
    'Historical visits cannot hide a disconnected final return.',
  );
});

test('Remix usage rejects closed gates, future opening ticks and unclaimed connectors', () => {
  const f = fixture('crosswind-remix'),
    { run, evidence } = f,
    gate = run.relay.gates[0];
  Object.assign(run.player, { x: 35.5, y: 20.5, cutting: false });
  observeCrosswindGoal(run, evidence);
  assert.equal(evidence.used.size, 0);
  gate.openedTick = run.tick + 1;
  run.cells[20 * run.width + 35] = CELL.SAFE;
  observeCrosswindGoal(run, evidence);
  assert.equal(evidence.used.size, 0);
  gate.openedTick = run.tick;
  run.cells[20 * run.width + 35] = CELL.FIELD;
  observeCrosswindGoal(run, evidence);
  assert.equal(evidence.used.size, 0);
  run.cells[20 * run.width + 35] = CELL.SAFE;
  observeCrosswindGoal(run, evidence);
  assert(evidence.used.has('protected-return'));
  assert.equal(
    inspectCrosswindGoal(f).achieved,
    false,
    'Traversal alone does not reclaim both side currents or finish the run.',
  );
});
