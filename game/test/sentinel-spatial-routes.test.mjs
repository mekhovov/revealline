import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelSpatialCandidates } from '../content-design/sentinel-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT, CELL } from '../core/index.mjs';
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

const project = compileContentProject(createSentinelSpatialCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/sentinel-spatial-clear-routes.json', import.meta.url)),
);
test('receiver feasibility covers both maps, every preset and steering without claiming human balance', () => {
  assert.equal(fixture.format, 'SentinelSpatialFeasibilityV1');
  const keys = fixture.rows.map((r) => [r.id, r.difficulty, r.turnPolicy].join('/'));
  assert.equal(keys.length, 12);
  assert.equal(new Set(keys).size, 12);
  for (const id of ['twin-receivers', 'relay-perimeter']) {
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const policy of ['immediate', 'grid-center'])
        assert(keys.includes([id, difficulty, policy].join('/')));
    assert(
      fixture.rows.some((r) => r.id === id && r.goal.achieved),
      id + ' needs a played optional route',
    );
  }
});
for (const row of fixture.rows)
  test(`receiver no-loss clear/replay/equal race: ${row.id}/${row.difficulty}/${row.turnPolicy}`, () => {
    const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: 1, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options);
    const match = createDuel(manifest.level, options, {
      protocol: UNTIMED_DUEL_PROTOCOL,
      seconds: 0,
    });
    assert.notEqual(match.runs[0].cells, match.runs[1].cells);
    assert.notEqual(match.runs[0].encounter, match.runs[1].encounter);
    resumeDuel(match);
    const evidence = createSentinelGoalEvidence(),
      closures = [],
      events = [],
      stages = [];
    const denominator = run.totalClaimable;
    for (const { direction, ticks } of row.segments) {
      assert([null, 'left', 'right', 'up', 'down'].includes(direction));
      assert(Number.isSafeInteger(ticks) && ticks > 0);
      for (let t = 0; t < ticks; t++) {
        assert.equal(run.status, 'running');
        assert.equal(match.status, 'running');
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        stepDuel(match, [{ direction }, { direction }]);
        observeSentinelGoal(run, evidence);
        assert.equal(run.classic.livesLost, 0);
        assert.equal(run.totalClaimable, denominator);
        if (run.events.some((e) => e.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
        for (const e of run.events) {
          if (
            [
              'boss.warning',
              'life.lost',
              'cut.closed',
              'lineImpact.created',
              'relay.opened',
              'objective.captured',
              'encounter.stageChanged',
              'encounter.defeated',
            ].includes(e.type)
          )
            events.push([run.tick, e.type, e.id ?? null]);
          if (e.type === 'encounter.stageChanged')
            stages.push([
              run.tick,
              e.stage,
              run.cells.reduce((n, c) => n + Number(c === CELL.FIELD), 0),
            ]);
        }
        if (!run.encounter.defeated) assert.notEqual(run.status, 'won');
      }
    }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, row.ticks);
    assert.equal(run.lives, row.lives);
    assert.equal(run.coverage, row.coverage);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    assert.deepEqual(events, row.events);
    assert.deepEqual(closures, row.closures);
    assert.deepEqual(stages, row.stages);
    assert.deepEqual(inspectSentinelGoal({ missionId: row.id, run, evidence }), row.goal);
    assert.deepEqual(
      stages.map((s) => s[1]),
      ['transition', 'exposed'],
    );
    assert(
      stages[0][2] > manifest.level.encounter.minReleaseCutCells,
      'Do not finish by trivial isolation',
    );
    assert.equal(row.goal.defeat.cause, 'cut-release');
    assert(row.goal.defeat.cutCells >= manifest.level.encounter.minReleaseCutCells);
    assert(closures.length >= 4);
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
    for (const gate of run.relay.gates)
      for (const cell of gate.cells) {
        assert.equal(run.cells[cell], CELL.SAFE);
        assert.equal(run.foundation.permanent[cell], 1);
        assert.equal(run.classic.everClaimed[cell], 0);
      }
  });
