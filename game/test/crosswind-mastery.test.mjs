import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCrosswindCandidates } from '../content-design/crosswind-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';
import {
  createCrosswindGoalEvidence,
  observeCrosswindGoal,
  inspectCrosswindGoal,
} from './helpers/crosswind-goal.mjs';

const project = compileContentProject(createCrosswindCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/crosswind-mastery-routes.json', import.meta.url)),
);
test('Crosswind optional-goal routes cover every preset, steering option and mission', () => {
  assert.equal(fixture.format, 'CrosswindMasteryFeasibilityV1');
  assert.deepEqual(
    fixture.sets.map((set) => `${set.difficulty}/${set.turnPolicy}`).sort(),
    ['gentle', 'standard', 'expert']
      .flatMap((d) => ['immediate', 'grid-center'].map((p) => `${d}/${p}`))
      .sort(),
  );
  for (const set of fixture.sets)
    assert.deepEqual(
      set.rows.map((row) => row[0]),
      project.missions.map((m) => m.id),
    );
});
for (const { difficulty, turnPolicy, rows } of fixture.sets)
  test(`Crosswind Array optional goals with no-loss public replays: ${difficulty}/${turnPolicy}`, () => {
    for (const [missionId, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, missionId, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, missionId);
      assert.equal(manifest.officialProgressEligible, false);
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options),
        evidence = createCrosswindGoalEvidence();
      const denominator = run.totalClaimable;
      for (const [direction, ticks] of segments) {
        assert([null, 'up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${missionId}: early terminal`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          observeCrosswindGoal(run, evidence);
          assert.equal(run.classic.livesLost, 0, missionId);
          assert.equal(run.totalClaimable, denominator, missionId);
          if (run.coverage >= manifest.level.goal.coverage)
            assert(
              run.objectives.every((o) => !o.required || o.captured),
              `${missionId}: objective cleanup`,
            );
        }
      }
      assert.equal(run.status, 'won', missionId);
      const goal = inspectCrosswindGoal({ missionId, run, evidence });
      assert.equal(goal.achieved, true, `${missionId}: ${JSON.stringify(goal)}`);
      assert(!run.relay.gates.length || evidence.used.size > 0, `${missionId}: no connector used`);
      assert(
        run.relay.gates.every((g) => g.openedTick !== null && g.openedTick < run.tick),
        `${missionId}: late relay`,
      );
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, missionId);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, missionId);
      assert.equal(replay.state.status, 'won', missionId);
    }
  });
