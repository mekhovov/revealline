import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileContentProject } from '../content-design/project.mjs';
import {
  createUkrainianOrnamentJourney,
  UKRAINIAN_ORNAMENT_MISSION_IDS,
} from '../content-design/ukrainian-ornament-candidates.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../gameplay-tuning.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/ukrainian-ornament-clear-routes.json', import.meta.url), 'utf8'),
);
const project = compileContentProject(createUkrainianOrnamentJourney());
const segments = (values) =>
  values.map((value) => (Array.isArray(value) ? { direction: value[0], ticks: value[1] } : value));
const inputs = (values) =>
  segments(values).flatMap(({ direction, ticks }) => Array(ticks).fill(direction));

// Three concrete primary routes, not all-preset/control or human balance proof.
// Earlier unfinished 80k samples remain reproducible instead of being overwritten.
for (const row of fixture.rows)
  test(`ornament Standard/immediate primary clear: ${row.missionId}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(prepared.simulationIdentity, row.result.simulationIdentity);
    assert.equal(prepared.authoredSimulationIdentity, row.result.authoredSimulationIdentity);
    assert.equal(prepared.sourceProjectIdentity, row.result.sourceProjectIdentity);
    const options = { seed: row.seed, turnPolicy: row.turnPolicy };
    const replay = (sample) => {
      const actual = assessSpatialRoute(prepared, {
        ...options,
        segments: segments(sample.segments),
      });
      for (const key of [
        'status',
        'ticks',
        'cuts',
        'losses',
        'failureCause',
        'coverage',
        'checkpoint',
      ])
        assert.equal(actual[key], sample[key], key);
      assert.equal(actual.replayVerified, true);
      assert.equal(sample.replayVerified, true);
      return actual;
    };
    const actual = replay(row.result);
    assert.equal(actual.status, 'no-loss-clear');
    assert.equal(actual.losses, 0);
    assert(actual.coverage >= actual.coverageGoal);
    assert.equal(row.qualification, 'full-clear-qualified');
    assert.equal(actual.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
    assert.equal(actual.gameplayTuning.adminOverride, false);
    assert.deepEqual(actual.gameplayTuning, row.result.gameplayTuning);
    for (const key of [
      'levelIdentity',
      'ruleset',
      'claimedCells',
      'totalClaimable',
      'exposureTicks',
      'maxExposureTicks',
      'initialComponents',
      'finalComponents',
      'actors',
      'objectives',
      'closures',
    ])
      assert.deepEqual(actual[key], row.result[key], key);

    const original = replay(row.originalContinuation);
    assert.equal(original.status, 'route-exhausted');
    assert.equal(original.losses, 0);
    assert(original.coverage < original.coverageGoal);
    assert.equal(row.originalContinuation.search.simulationTickBudget, 80000);
    assert.equal(row.originalContinuation.search.simulatedTicks, 80000);
    assert.deepEqual(
      inputs(row.result.segments).slice(0, original.ticks),
      inputs(row.originalContinuation.segments),
      'The extension must preserve the original unfinished inputs.',
    );
    const opening = replay(row.opening);
    assert.equal(opening.cuts, 1);
    assert.equal(opening.losses, 0);
    assert.deepEqual(
      inputs(row.result.segments).slice(0, opening.ticks),
      inputs(row.opening.segments),
      'The final route must keep its recorded opening approach.',
    );
    assert.equal(actual.closures[0].tick, opening.ticks);
    assert.equal(actual.closures[0].coverage, opening.coverage);
    assert.equal(row.searchHistory.length, 1);
    let used = 0;
    for (const search of row.searchHistory) {
      assert.equal(search.policy, 'efficient');
      assert.equal(search.candidateLimit, 16);
      assert.equal(search.maxCuts, 24);
      assert.equal(search.simulationTickBudget, fixture.searchBudgets.firstExtension);
      assert(search.simulatedTicks <= search.simulationTickBudget);
      assert.equal(search.exhausted, false);
      assert.equal(
        Object.values(search.failuresByCause).reduce((sum, count) => sum + count, 0),
        search.failedAttempts,
      );
      used += search.simulatedTicks;
    }
    assert(used <= fixture.searchBudgets.maximumPerMission);
  });

test('ornament clear evidence is limited to three Standard immediate seed-one routes', () => {
  assert.equal(fixture.rows.length, 3);
  assert.deepEqual(
    fixture.rows.map((row) => row.missionId).sort(),
    [...UKRAINIAN_ORNAMENT_MISSION_IDS].sort(),
  );
  assert(fixture.rows.every((row) => row.difficulty === 'standard'));
  assert(fixture.rows.every((row) => row.turnPolicy === 'immediate' && row.seed === 1));
  assert.equal(fixture.outcomes['full-clear-qualified'], 3);
  assert.equal(fixture.outcomes['continued-route-incomplete'], 0);
  assert.equal(fixture.searchBudgets.firstExtension, 160000);
  assert.equal(fixture.searchBudgets.optionalSecondExtension, 90000);
  assert.equal(fixture.searchBudgets.maximumPerMission, 250000);
  assert.equal(fixture.sourceIdentity.stableDuringProbe, true);
  assert.match(fixture.sourceIdentity.sourceSha256, /^[0-9a-f]{64}$/);
  assert.match(fixture.sourceIdentity.gitRevision, /^[0-9a-f]{40}$/);
  assert(fixture.rows.every((row) => row.result.gameplayTuning.version === 'gameplay-pressure.v4'));
});
