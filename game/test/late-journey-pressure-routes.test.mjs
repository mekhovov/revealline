import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { CROSSWIND_FIRST_RETURNS } from '../content-design/crosswind-candidates.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { assessPressureRoute } from '../../scripts/lib/pressure-route-assessment.mjs';
import * as crosswind from './helpers/crosswind-goal.mjs';
import * as apex from './helpers/apex-goal.mjs';

const project = compileContentProject(withPressureDifficulty(createWholeJourneyCandidates()));
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/late-journey-pressure-routes.json', import.meta.url)),
);
const historical = JSON.parse(
  await readFile(new URL('./fixtures/journey-pressure-route-assessment.json', import.meta.url)),
);
const key = (r) => [r.id ?? r.missionId, r.difficulty, r.turnPolicy].join('/');
const old = historical.rows.filter((r) => ['crosswind', 'apex'].includes(r.chapter));
test('new routes cover exactly the 36 unresolved late-Journey configurations without replacing old successes', () => {
  assert.equal(fixture.format, 'LateJourneyPressureRefinementV1');
  assert.equal(fixture.projectRevision, historical.projectRevision);
  assert.equal(fixture.rows.length, 36);
  assert.deepEqual(
    fixture.rows.map(key).sort(),
    old
      .filter((r) => !r.chosen)
      .map(key)
      .sort(),
  );
  assert.equal(new Set(fixture.rows.map(key)).size, 36);
  assert.equal(fixture.comparisonRows.length, 1);
  assert(old.find((r) => key(r) === key(fixture.comparisonRows[0])).chosen);
  for (const row of [...fixture.rows, ...fixture.comparisonRows]) {
    assert.equal(row.simulationIdentity, old.find((r) => key(r) === key(row)).simulationIdentity);
    assert.equal(row.status, 'won');
    assert.equal(row.seed, 1);
  }
});

function equalRace(level, segments, options) {
  const match = createDuel(level, options, { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 });
  assert.notEqual(match.runs[0].cells, match.runs[1].cells);
  resumeDuel(match);
  for (const [direction, ticks] of segments)
    for (let i = 0; i < ticks; i++) {
      assert.equal(match.status, 'running');
      stepDuel(match, [{ direction }, { direction }]);
    }
  assert.equal(match.status, 'finished');
  assert.equal(match.winner, null);
  assert(match.runs.every((r) => r.status === 'won' && r.classic.livesLost === 0));
  assert.deepEqual(authoritativeCheckpoint(match.runs[0]), authoritativeCheckpoint(match.runs[1]));
}

for (const row of [...fixture.rows, ...fixture.comparisonRows])
  test(`new late pressure clear/replay/race: ${key(row)}`, () => {
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
    assert.deepEqual(metrics, row.metrics);
    const options = { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy };
    const run = createRun(manifest.level, options);
    const isCrosswind = Object.hasOwn(CROSSWIND_FIRST_RETURNS, row.id);
    const evidence = isCrosswind
      ? crosswind.createCrosswindGoalEvidence()
      : apex.createApexGoalEvidence();
    const events = [],
      closures = [];
    for (const [direction, ticks] of segments)
      for (let i = 0; i < ticks; i++) {
        assert.equal(run.status, 'running');
        stepRun(run, { direction }, FIXED_DT);
        (isCrosswind ? crosswind.observeCrosswindGoal : apex.observeApexGoal)(run, evidence);
        for (const event of run.events)
          if (
            [
              'boss.warning',
              'player.failed',
              'cut.closed',
              'lineImpact.created',
              'relay.opened',
              'objective.captured',
              'encounter.stageChanged',
              'encounter.defeated',
            ].includes(event.type)
          )
            events.push([run.tick, event.type, event.id ?? null]);
        if (run.events.some((event) => event.type === 'cut.closed'))
          closures.push([run.tick, run.coverage]);
      }
    assert.deepEqual(events, row.events);
    assert.deepEqual(closures, row.closures);
    assert.equal(closures.length, row.cuts);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.deepEqual(
      (isCrosswind ? crosswind.inspectCrosswindGoal : apex.inspectApexGoal)({
        missionId: row.id,
        run,
        evidence,
      }),
      row.goal,
    );
    equalRace(manifest.level, segments, options);
  });

for (const row of old.filter((r) => r.chosen))
  test(`retain historical late pressure route: ${key(row)}`, () => {
    const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const result = assessPressureRoute(manifest.level, {
      segments: row.chosen.segments,
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      replay: true,
    });
    assert.equal(result.status, 'no-loss-clear');
    assert.equal(result.checkpoint, row.chosen.checkpoint);
    equalRace(manifest.level, row.chosen.segments, {
      seed: row.seed,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    });
  });
