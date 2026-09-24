import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileContentProject } from '../content-design/project.mjs';
import { createSpatialChallengeJourney } from '../content-design/spatial-challenge-journey.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../gameplay-tuning.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/spatial-challenge-alternate-matrix.json', import.meta.url),
    'utf8',
  ),
);
const project = compileContentProject(createSpatialChallengeJourney());
const segments = (tuples) => tuples.map(([direction, ticks]) => ({ direction, ticks }));
const inputs = (tuples) => tuples.flatMap(([direction, ticks]) => Array(ticks).fill(direction));
const prefixQualified = (row, prefix) => {
  const lethal = prefix.events
    .filter((event) => event.type === 'cells.claimed')
    .reduce((total, event) => total + event.neutralizedLethalCells, 0);
  const expectedClosures = row.missionId === 'crossing-complete' ? 2 : 1;
  const expectedLethal =
    row.approach === 'southern-hazard' ? 24 : row.approach === 'west-belt' ? 42 : 0;
  return prefix.losses === 0 && prefix.cuts >= expectedClosures && lethal >= expectedLethal;
};

// A passing diagnostic test reproduces its recorded outcome. Only rows marked
// full-clear-qualified establish a complete route; failed prefixes remain open.
for (const row of fixture.rows)
  test(`alternate route evidence: ${row.missionId}/${row.approach}/${row.difficulty}/${row.turnPolicy}: ${row.qualification}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(prepared.simulationIdentity, row.simulationIdentity);
    const options = { seed: row.seed, turnPolicy: row.turnPolicy };
    const result = assessSpatialRoute(prepared, { ...options, segments: segments(row.segments) });
    for (const key of [
      'status',
      'checkpoint',
      'ticks',
      'cuts',
      'losses',
      'coverage',
      'levelIdentity',
    ])
      assert.equal(result[key], row[key], key);
    assert.equal(result.replayVerified, true);
    assert.equal(result.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
    assert.equal(result.gameplayTuning.adminOverride, false);
    const prefix = assessSpatialRoute(prepared, {
      ...options,
      segments: segments(row.prefixEvidence.segments),
    });
    assert.equal(prefix.status, row.prefixEvidence.status);
    assert.equal(prefix.ticks, row.prefixEvidence.ticks);
    assert.equal(prefix.losses, row.prefixEvidence.losses);
    assert.equal(prefix.cuts, row.prefixEvidence.closures);
    assert.equal(prefixQualified(row, prefix), row.prefixQualified);
    assert.deepEqual(
      inputs(row.segments).slice(0, prefix.ticks),
      inputs(row.prefixEvidence.segments),
      'The final sample actually follows its recorded approach.',
    );
    assert.equal(row.qualification === 'full-clear-qualified', result.status === 'no-loss-clear');
    for (const sample of [
      row.previousRouteEvidence,
      row.priorEvidence,
      row.intermediateEvidence,
      row.prefixEvidence.previousSample,
      ...(row.prefixTimingSamples ?? []),
    ].filter(Boolean)) {
      const earlier = assessSpatialRoute(prepared, {
        ...options,
        segments: segments(sample.segments),
      });
      for (const key of [
        'status',
        'checkpoint',
        'ticks',
        'cuts',
        'losses',
        'coverage',
        'failureCause',
      ])
        if (Object.hasOwn(sample, key)) assert.equal(earlier[key], sample[key], `earlier ${key}`);
      if (Object.hasOwn(sample, 'closures')) assert.equal(earlier.cuts, sample.closures);
      assert.equal(earlier.replayVerified, true);
    }
    for (const search of row.searchHistory) {
      assert(search.used <= search.budget);
      assert(search.budget <= 240000);
    }
  });

test('alternate matrix scope and outcome totals are explicit, unique, and bounded', () => {
  assert.equal(fixture.rows.length, 30);
  const key = (row) =>
    [row.missionId, row.approach, row.difficulty, row.turnPolicy, row.seed].join('/');
  assert.equal(new Set(fixture.rows.map(key)).size, fixture.rows.length);
  assert(fixture.rows.every((row) => row.seed === 1));
  const counts = Object.fromEntries(
    ['full-clear-qualified', 'prefix-only-qualified', 'sampled-prefix-failed'].map(
      (qualification) => [
        qualification,
        fixture.rows.filter((row) => row.qualification === qualification).length,
      ],
    ),
  );
  assert.deepEqual(counts, fixture.outcomes);
  const arrows = fixture.rows.filter((row) => row.missionId === 'read-the-arrows');
  assert.equal(arrows.length, 12);
  assert(arrows.every((row) => row.prefixQualified));
  assert(arrows.every((row) => row.qualification === 'full-clear-qualified'));
});
