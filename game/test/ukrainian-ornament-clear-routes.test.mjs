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
  assessSpatialRoute,
  prepareSpatialMission,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/ukrainian-ornament-clear-routes.json', import.meta.url), 'utf8'),
);
const project = compileContentProject(createUkrainianOrnamentJourney());
const outcomeKeys = [
  'status',
  'ticks',
  'cuts',
  'losses',
  'failureCause',
  'coverage',
  'coverageGoal',
  'checkpoint',
  'sourceProjectIdentity',
  'authoredSimulationIdentity',
  'simulationIdentity',
  'levelIdentity',
  'ruleset',
  'gameplayTuning',
  'objectives',
  'replayVerified',
];

for (const row of fixture.rows)
  test(`v11 replay audit: ${row.missionId}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, { difficulty: row.difficulty });
    for (const sample of row.samples) {
      const actual = assessSpatialRoute(prepared, {
        seed: row.seed,
        turnPolicy: row.turnPolicy,
        segments: sample.segments.map(([direction, ticks]) => ({ direction, ticks })),
      });
      for (const key of outcomeKeys)
        assert.deepEqual(actual[key], sample[key], `${sample.sampleId}: ${key}`);
    }
  });

test('former v9 clear routes remain truthfully superseded on the v11 source', () => {
  assert.equal(fixture.format, 'UkrainianOrnamentV11ClearReplayAuditV1');
  assert.deepEqual(
    fixture.rows.map((row) => row.missionId).toSorted(),
    [...UKRAINIAN_ORNAMENT_MISSION_IDS].toSorted(),
  );
  assert.equal(fixture.gameplayVersion, GAMEPLAY_TUNING_VERSION);
  assert.equal(fixture.supersedes.sourceProjectIdentity, '98161e7c0fba69c1');
  assert.deepEqual(fixture.outcomes, { 'life-lost': 6, 'route-exhausted': 3 });
  assert.equal(fixture.rows.flatMap((row) => row.samples).length, 9);
  assert.equal(
    fixture.rows.flatMap((row) => row.samples).some((sample) => sample.status === 'no-loss-clear'),
    false,
  );
});
