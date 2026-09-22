import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createSignalGoalEvidence, inspectSignalGoal } from './helpers/signal-goal.mjs';

const project = compileContentProject(createSignalCandidates());
function fixture(id) {
  const mission = project.missions.find((m) => m.id === id),
    map = project.source.maps.find((m) => m.id === mission.map.id);
  const run = createRun(resolveMission(project, id).level);
  return { run, evidence: createSignalGoalEvidence(map, run) };
}
test('extracted Signal predicates retain strict before ordering rather than same-tick credit', () => {
  // Synthetic evidence tests the predicate; it is not claimed as gameplay feasibility.
  for (const id of ['dry-spine', 'cool-the-crossing']) {
    const { run, evidence } = fixture(id);
    run.status = 'won';
    evidence.bedAt[0] = 100;
    const other = id === 'dry-spine' ? evidence.enteredAt : evidence.visitAt;
    const inspect = () => inspectSignalGoal({ missionId: id, run, evidence });
    other[1] = 100;
    assert.equal(inspect().achieved, false);
    other[1] = 99;
    assert.equal(inspect().achieved, false);
    other[1] = 101;
    assert.equal(inspect().achieved, true);
    other[1] = null;
    assert.equal(inspect().achieved, true);
  }
});
test('complete beds cannot award a running or damaged attempt and inspections never mutate simulation', () => {
  const { run, evidence } = fixture('neutral-ground');
  evidence.bedAt.fill(100);
  const inspect = () => inspectSignalGoal({ missionId: 'neutral-ground', run, evidence });
  assert.equal(inspect().achieved, false);
  run.status = 'won';
  assert.equal(inspect().achieved, true);
  evidence.bedAt[0] = null;
  assert.equal(inspect().achieved, false);
  evidence.bedAt[0] = 100;
  run.classic.livesLost = 1;
  assert.equal(inspect().achieved, false);
  const before = authoritativeCheckpoint(run);
  inspect();
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.throws(() => inspectSignalGoal({ missionId: 'unknown', run, evidence }), /Unknown Signal/);
  assert.throws(() => createSignalGoalEvidence(null, run), /authored map/);
});
