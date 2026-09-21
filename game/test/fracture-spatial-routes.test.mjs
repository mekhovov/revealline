import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFractureSpatialCandidates } from '../content-design/fracture-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';
import {
  createFractureGoalEvidence,
  observeFractureGoal,
  inspectFractureGoal,
} from './helpers/fracture-goal.mjs';

const project = compileContentProject(createFractureSpatialCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/fracture-spatial-clear-routes.json', import.meta.url)),
);
const key = (r) => [r.difficulty, r.turnPolicy, r.seed, r.delaySeconds].join('/');
test('district successor has all six configurations and separate seed/delay samples', () => {
  assert.equal(fixture.format, 'FractureSpatialFeasibilityV1');
  assert.equal(fixture.projectRevision, project.source.revision);
  assert.equal(fixture.rows.length, 18);
  const expected = ['gentle', 'standard', 'expert'].flatMap((difficulty) =>
    ['immediate', 'grid-center'].flatMap((turnPolicy) =>
      [
        [1, 0],
        [2, 0],
        [1, 1.5],
      ].map(([seed, delaySeconds]) => key({ difficulty, turnPolicy, seed, delaySeconds })),
    ),
  );
  assert.deepEqual(fixture.rows.map(key).sort(), expected.sort());
});
for (const row of fixture.rows)
  test(`district no-loss clear/replay/race: ${key(row)}`, () => {
    assert.equal(row.id, 'two-districts');
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const segments = row.segments.map((s) => [s.direction, s.ticks]);
    const { segments: played, ...metrics } = assessPressureRoute(manifest.level, {
      segments,
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      replay: true,
    });
    assert.deepEqual(played, segments);
    assert.equal(metrics.status, 'no-loss-clear');
    assert.deepEqual(metrics.collectedBonusIds, []);
    assert.deepEqual(metrics, row.metrics);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      evidence = createFractureGoalEvidence();
    const match = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(match.runs[0].cells, match.runs[1].cells);
    resumeDuel(match);
    const denominator = run.totalClaimable,
      closures = [];
    for (const [direction, ticks] of segments)
      for (let t = 0; t < ticks; t++) {
        assert.equal(run.status, 'running');
        assert.equal(match.status, 'running');
        const before = {
          trail: run.trail.map((c) => c.index),
          activeRoamer: run.enemies.some(
            (a) => a.type === 'claimed-rover' && a.classic.mode === 'active',
          ),
        };
        stepRun(run, { direction }, FIXED_DT);
        observeFractureGoal(run, evidence, before);
        stepDuel(match, [{ direction }, { direction }]);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, denominator);
        if (run.events.some((e) => e.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
        for (const event of run.events)
          if (event.type === 'cells.eroded')
            for (const index of event.indices) assert.equal(run.foundation.permanent[index], 0);
      }
    for (let i = 0; i < run.foundation.permanent.length; i++)
      if (run.foundation.permanent[i]) assert.equal(run.classic.everClaimed[i], 0);
    assert.deepEqual(closures, row.closures);
    assert.equal(closures.length, row.cuts);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.deepEqual(
      inspectFractureGoal({
        missionId: row.id,
        run,
        evidence,
        foundations: manifest.level.foundations,
        coverageTarget: manifest.level.goal.coverage,
      }),
      row.goal,
    );
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });
