import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { createSpatialChallengeJourney } from '../content-design/spatial-challenge-journey.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../gameplay-tuning.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/spatial-challenge-twin-approaches.json', import.meta.url),
    'utf8',
  ),
);
const project = compileContentProject(createSpatialChallengeJourney());
const segments = (tuples) => tuples.map(([direction, ticks]) => ({ direction, ticks }));
const inputs = (tuples) => tuples.flatMap(([direction, ticks]) => Array(ticks).fill(direction));
const inLanding = (position, approach) =>
  !!position &&
  position.x >= 22 &&
  position.x < 30 &&
  (approach === 'upper-landing'
    ? position.y >= 5 && position.y < 9
    : position.y >= 27 && position.y < 31);
function firstLanding(prepared, options, tuples) {
  const run = createRun(prepared.level, { ...options, classId: 'scout' });
  for (const [direction, ticks] of tuples)
    for (let tick = 0; tick < ticks; tick++) {
      stepRun(run, { direction }, FIXED_DT);
      if (run.events.some((event) => event.type === 'cut.closed'))
        return { x: run.player.x, y: run.player.y };
    }
  return null;
}

// Landing proofs are intentionally separate from required objective completion.
// Passing these diagnostics does not turn unfinished routes into full clears.
for (const row of fixture.rows)
  test(`Twin landing evidence: ${row.approach}/${row.difficulty}/${row.turnPolicy}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, { difficulty: row.difficulty });
    for (const key of ['sourceProjectIdentity', 'authoredSimulationIdentity', 'simulationIdentity'])
      assert.equal(prepared[key], row[key], key);
    const options = { seed: row.seed, turnPolicy: row.turnPolicy };
    const replay = (sample) => {
      const result = assessSpatialRoute(prepared, {
        ...options,
        segments: segments(sample.segments),
      });
      for (const key of [
        'status',
        'coverage',
        'ticks',
        'cuts',
        'losses',
        'failureCause',
        'checkpoint',
      ])
        assert.equal(result[key], sample[key], key);
      assert.equal(result.replayVerified, true);
      assert.equal(sample.replayVerified, true);
      assert.equal(result.levelIdentity, row.levelIdentity);
      assert.deepEqual(result.gameplayTuning, row.gameplayTuning);
      return result;
    };
    const result = replay(row);
    assert.equal(result.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
    assert.equal(result.gameplayTuning.adminOverride, false);
    assert.equal(row.qualification, 'prefix-only-qualified');
    assert.notEqual(result.status, 'no-loss-clear');
    assert.deepEqual(
      result.closures
        .filter((closure) => closure.capturedObjectiveIds.length)
        .map((closure) => ({ tick: closure.tick, ids: closure.capturedObjectiveIds })),
      row.objectiveCaptures,
      'Receiver order is reported only from actual capture events.',
    );
    const prefix = replay(row.prefixEvidence);
    assert.equal(prefix.cuts, 1);
    assert.equal(prefix.losses, 0);
    assert.equal(prefix.closures[0].claimedCells, row.prefixEvidence.claimed);
    assert.deepEqual(prefix.closures[0].capturedObjectiveIds, []);
    assert(inLanding(firstLanding(prepared, options, row.prefixEvidence.segments), row.approach));
    assert.deepEqual(
      inputs(row.segments).slice(0, prefix.ticks),
      inputs(row.prefixEvidence.segments),
      'The continuation actually begins with the qualified landing route.',
    );
    for (const sample of row.prefixTimingSamples) {
      const actual = replay(sample);
      const landing = firstLanding(prepared, options, sample.segments);
      assert.deepEqual(landing, sample.landing);
      assert.equal(actual.closures[0]?.claimedCells ?? 0, sample.claimed);
      assert.deepEqual(
        actual.closures.flatMap((closure) => closure.capturedObjectiveIds),
        sample.objectives,
      );
      assert.equal(
        actual.losses === 0 && actual.cuts === 1 && inLanding(landing, row.approach),
        sample.qualified,
      );
    }
    assert.equal(row.searchHistory.length, fixture.searchBudget.passesPerApproach);
    for (const search of row.searchHistory) {
      assert(search.used <= search.budget);
      assert(search.budget <= fixture.searchBudget.perApproach);
      assert.equal(
        Object.values(search.failuresByCause).reduce((sum, count) => sum + count, 0),
        search.failedAttempts,
      );
    }
  });

test('Twin landing matrix distinguishes twelve prefix proofs from complete routes', () => {
  assert.equal(fixture.rows.length, 12);
  assert.equal(fixture.outcomes['full-clear-qualified'], 0);
  assert.equal(fixture.outcomes['prefix-only-qualified'], 12);
  assert(fixture.searchElapsedSeconds < 300);
  assert.equal(fixture.sourceIdentity.stableDuringProbe, true);
  assert(fixture.rows.every((row) => row.missionId === 'twin-receivers' && row.seed === 1));
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const pair = fixture.rows.filter(
        (row) => row.difficulty === difficulty && row.turnPolicy === turnPolicy,
      );
      assert.deepEqual(pair.map((row) => row.approach).sort(), ['lower-landing', 'upper-landing']);
      assert(
        pair.flatMap((row) => row.searchHistory).reduce((sum, search) => sum + search.used, 0) <=
          fixture.searchBudget.maximumPerPresetAndControl,
      );
      assert(pair.every((row) => row.prefixEvidence.qualified));
    }
  assert(
    fixture.rows.flatMap((row) => row.prefixTimingSamples).some((sample) => !sample.qualified),
  );
});
