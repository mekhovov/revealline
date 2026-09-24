import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileContentProject } from '../content-design/project.mjs';
import { createSpatialChallengeJourney } from '../content-design/spatial-challenge-journey.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/spatial-challenge-circuits-seal-probe.json', import.meta.url),
    'utf8',
  ),
);
const project = compileContentProject(createSpatialChallengeJourney());

for (const row of fixture.rows)
  test(`circuits seal probe reproduces exact legal-input outcome: ${row.id}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, {
      difficulty: row.difficulty,
    });
    assert.equal(prepared.simulationIdentity, row.simulationIdentity);
    assert.equal(prepared.authoredSimulationIdentity, row.authoredSimulationIdentity);
    const result = assessSpatialRoute(prepared, {
      seed: row.seed,
      turnPolicy: row.turnPolicy,
      segments: row.segments.map(([direction, ticks]) => ({ direction, ticks })),
    });
    for (const key of [
      'levelIdentity',
      'ruleset',
      'status',
      'ticks',
      'cuts',
      'losses',
      'failureCause',
      'coverage',
      'coverageGoal',
      'checkpoint',
    ])
      assert.equal(result[key], row[key], key);
    assert.equal(result.gameplayTuning.version, row.gameplayTuningVersion);
    assert.equal(result.gameplayTuning.adminOverride, false);
    assert.equal(result.replayVerified, true);
    assert.deepEqual(result.finalComponents, row.retainedComponents);
    assert.deepEqual(
      result.closures.map((closure) => [closure.tick, closure.coverage]),
      row.closureCoverage,
    );
    assert.equal(result.closures[0].claimedCells, 6, 'Western seal secures its line only');
    assert(
      result.finalComponents.some(
        (component) => component.cells === 70 && component.enemyIds.includes('west'),
      ),
      'The western keeper remains in its legally sealed circuit',
    );
    if (row.id === 'middle-seal-keeper-escaped')
      assert(
        result.finalComponents.some(
          (component) => component.cells > 1000 && component.enemyIds.includes('middle'),
        ),
        'The middle keeper escaped before its mouth sealed; the outer field does not fill',
      );
    assert(result.coverage < result.coverageGoal);
  });

test('sampled failures and the frozen hypothesis remain separate from clear or exhaustive evidence', () => {
  assert.equal(fixture.rows.length, 5);
  assert.equal(new Set(fixture.rows.map((row) => row.id)).size, 5);
  assert.deepEqual(
    fixture.rows.filter((row) => row.id.startsWith('west-mouth')).map((row) => row.seed),
    [1, 2],
  );
  assert.deepEqual(
    fixture.rows.filter((row) => row.losses).map((row) => row.failureCause).sort(),
    ['enemy-player', 'enemy-trail'],
  );
  assert(fixture.rows.every((row) => row.status !== 'no-loss-clear'));
  assert.match(fixture.diagnosticSweeps.qualification, /not these sweeps/);
  assert.match(fixture.diagnosticSweeps.qualification, /never sum/);
  assert.match(fixture.frozenTimeHypothesis.qualification, /not a legal continuous trail/);
});
