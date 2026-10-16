import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createUkrainianOrnamentAtlasJourney,
  UKRAINIAN_ORNAMENT_ATLAS_IDS,
} from '../content-design/ukrainian-ornament-atlas.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../gameplay-tuning.mjs';
import {
  assessSpatialRoute,
  prepareSpatialMission,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/ukrainian-ornament-atlas-routes.json', import.meta.url), 'utf8'),
);
const project = compileContentProject(createUkrainianOrnamentAtlasJourney());
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
  test(`v11 atlas replay audit: ${row.missionId}`, () => {
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

test('atlas audit is exact-source evidence and does not preserve obsolete acceptance claims', () => {
  assert.equal(fixture.format, 'UkrainianOrnamentV11AtlasReplayAuditV1');
  assert.deepEqual(
    fixture.rows.map((row) => row.missionId),
    [...UKRAINIAN_ORNAMENT_ATLAS_IDS],
  );
  assert.equal(fixture.gameplayVersion, GAMEPLAY_TUNING_VERSION);
  assert.equal(fixture.supersedes.sourceProjectIdentity, 'f90703749b115ec4');
  assert.deepEqual(fixture.outcomes, {
    'life-lost': 6,
    'no-loss-clear': 5,
    'route-exhausted': 6,
  });
  assert.equal(fixture.rows.flatMap((row) => row.samples).length, 17);
});
