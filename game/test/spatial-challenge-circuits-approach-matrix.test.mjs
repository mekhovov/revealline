import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { createSpatialChallengeJourney } from '../content-design/spatial-challenge-journey.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/spatial-challenge-circuits-approach-matrix.json', import.meta.url),
    'utf8',
  ),
);
const primary = JSON.parse(
  readFileSync(new URL('./fixtures/spatial-challenge-clear-routes.json', import.meta.url), 'utf8'),
);
const project = compileContentProject(createSpatialChallengeJourney());

function verifyPrefix(prepared, row, sample, segments) {
  const run = createRun(prepared.level, {
    seed: row.seed,
    turnPolicy: row.turnPolicy,
    classId: 'scout',
  });
  const field = new Set();
  let closed = false;
  for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.classic.livesLost, 0, 'Recorded prefix stops on its first loss');
      stepRun(run, { direction }, FIXED_DT);
      for (const cell of run.trail) field.add(cell.index);
      closed ||= run.events.some((event) => event.type === 'cut.closed');
    }
  const xs = [...field].map((index) => index % run.width);
  const ys = [...field].map((index) => Math.floor(index / run.width));
  const bounds = xs.length
    ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    : null;
  assert.equal(run.tick, sample.ticks);
  assert.equal(run.classic.livesLost, sample.losses);
  assert.equal(run.failureCause, sample.failureCause);
  assert.equal(run.coverage, sample.coverage);
  assert.deepEqual([run.player.x, run.player.y], sample.returnPosition);
  assert.deepEqual(bounds, sample.fieldBounds);
  assert.equal(
    run.classic.livesLost ? 'life-lost' : closed ? 'closed' : 'route-exhausted',
    sample.status,
  );
}

for (const row of fixture.rows)
  test(`circuits two-approach outcome: ${row.difficulty}/${row.turnPolicy}/${row.approach}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, { difficulty: row.difficulty });
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
    assert.equal(result.replayVerified, true);
    assert.equal(result.gameplayTuning.version, row.gameplayTuningVersion);
    assert.equal(result.gameplayTuning.adminOverride, false);
    assert.deepEqual(
      result.closures.map((closure) => [closure.tick, closure.coverage]),
      row.closureCoverage,
    );
    verifyPrefix(prepared, row, row.prefixEvidence, row.prefixSegments);
    for (const sample of row.prefixAttempts) verifyPrefix(prepared, row, sample, sample.segments);
    if (row.qualification !== 'sampled-prefix-failed') {
      assert.equal(row.prefixEvidence.status, 'closed');
      assert.equal(row.prefixEvidence.losses, 0);
      const [x, y] = row.prefixEvidence.returnPosition;
      const [left, , right] = row.prefixEvidence.fieldBounds;
      if (row.approach === 'inside-circuit') {
        assert(x >= 11 && x < 19 && y >= 18 && y < 21);
        assert(left >= 11 && right < 19);
      } else {
        assert(x < 8 && y === 35 && left < 8);
      }
    }
    assert.equal(row.qualification === 'full-clear-qualified', result.status === 'no-loss-clear');
    if (row.reusedPrimary) {
      const original = primary.rows.find((candidate) =>
        Object.entries(row.reusedPrimary).every(([key, value]) => candidate[key] === value),
      );
      assert(original, 'Reused primary proof retains exact identity and checkpoint');
      assert.deepEqual(original.segments, row.segments);
    }
  });

test('circuits matrix covers both distinct approaches, keeps Grid timing observations and honest outcome counts', () => {
  assert.equal(fixture.rows.length, 12);
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const rows = fixture.rows.filter(
        (row) => row.difficulty === difficulty && row.turnPolicy === turnPolicy,
      );
      assert.equal(rows.length, 2);
      assert.deepEqual(
        new Set(rows.map((row) => row.approach)),
        new Set(['inside-circuit', 'outside-west']),
      );
      assert.notDeepEqual(rows[0].prefixSegments, rows[1].prefixSegments);
    }
  assert.equal(
    fixture.outcomes.fullClears,
    fixture.rows.filter((row) => row.qualification === 'full-clear-qualified').length,
  );
  assert.equal(
    fixture.outcomes.safePrefixesWithUnfinishedContinuation,
    fixture.rows.filter((row) => row.qualification === 'prefix-only-qualified').length,
  );
  assert.equal(
    fixture.outcomes.sampledPrefixFailures,
    fixture.rows.filter((row) => row.qualification === 'sampled-prefix-failed').length,
  );
  assert.equal(
    fixture.outcomes.reusedPrimaryClears,
    fixture.rows.filter((row) => row.reusedPrimary).length,
  );
  for (const row of fixture.gridTimingObservation.rows) {
    const prepared = prepareSpatialMission(project, 'neon-remix', { difficulty: row.difficulty });
    verifyPrefix(prepared, row, row, row.segments);
    assert.equal(row.status, 'closed');
    assert.equal(
      row.returnPosition[1],
      1,
      'An upper return is not the requested outside-west closure',
    );
  }
});
