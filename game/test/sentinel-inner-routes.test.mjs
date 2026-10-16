import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelInnerCandidates } from '../content-design/sentinel-inner-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import {
  createSentinelGoalEvidence,
  observeSentinelGoal,
  inspectSentinelGoal,
} from './helpers/sentinel-goal.mjs';

const project = compileContentProject(createSentinelInnerCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/sentinel-inner-clear-routes.json', import.meta.url)),
);

test('inner receiver proofs cover every preset/control and both objective orders without hiding the bounded search prefix', () => {
  assert.equal(fixture.format, 'SentinelInnerFeasibilityV1');
  assert.equal(fixture.rows.length, 9);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    for (const turnPolicy of ['immediate', 'grid-center'])
      assert.equal(
        fixture.rows.filter(
          (r) =>
            r.kind === 'outer-first' && r.difficulty === difficulty && r.turnPolicy === turnPolicy,
        ).length,
        1,
      );
    assert.equal(
      fixture.rows.filter((r) => r.kind === 'inner-first-mastery' && r.difficulty === difficulty)
        .length,
      1,
    );
  }
  assert.equal(fixture.incompleteSearches.length, 1);
  const prefix = fixture.incompleteSearches[0];
  assert.equal(prefix.status, 'running');
  const manifest = resolveMission(project, prefix.id, { difficulty: prefix.difficulty });
  assert.equal(manifest.simulationIdentity, prefix.simulationIdentity);
  const run = createRun(manifest.level, { seed: 1, turnPolicy: prefix.turnPolicy });
  for (const { direction, ticks } of prefix.segments)
    for (let i = 0; i < ticks; i++) stepRun(run, { direction }, FIXED_DT);
  assert.equal(authoritativeCheckpoint(run).hash, prefix.checkpoint);
  assert.equal(run.status, 'running');
  assert.equal(run.classic.livesLost, 0);
});

for (const row of fixture.rows)
  test(`inner receiver clear/replay/equal race: ${row.kind}/${row.difficulty}/${row.turnPolicy}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options);
    const recorder = createRecorder(manifest.level, options);
    const match = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(match.runs[0].cells, match.runs[1].cells);
    resumeDuel(match);
    const evidence = createSentinelGoalEvidence();
    const denominator = run.totalClaimable;
    let restored = null;
    for (const { direction, ticks } of row.segments) {
      assert([null, 'up', 'down', 'left', 'right'].includes(direction));
      assert(Number.isSafeInteger(ticks) && ticks > 0);
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        assert.equal(match.status, 'running');
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        stepDuel(match, [{ direction }, { direction }]);
        if (restored) stepRun(restored, { direction }, FIXED_DT);
        observeSentinelGoal(run, evidence);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, denominator);
        if (!restored && evidence.shields.size === 1) {
          const prefix = verifyReplay(exportReplay(recorder, run));
          assert.equal(prefix.match, true);
          restored = prefix.state;
        }
      }
    }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, row.ticks);
    assert.equal(run.lives, row.lives);
    assert.equal(run.coverage, row.coverage);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert(restored, 'First shield must leave a meaningful continuation');
    assert.equal(authoritativeCheckpoint(restored).hash, row.checkpoint);
    const goal = inspectSentinelGoal({ missionId: row.id, run, evidence });
    assert.deepEqual(goal, row.goal);
    assert.equal(goal.achieved, row.kind === 'inner-first-mastery');
    const shields = new Map(goal.shields);
    assert.notEqual(shields.get('east-shield'), shields.get('west-shield'));
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });
