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
    new URL('./fixtures/spatial-challenge-two-bays-alternate.json', import.meta.url),
    'utf8',
  ),
);
const project = compileContentProject(createSpatialChallengeJourney());
const segments = (tuples) => tuples.map(([direction, ticks]) => ({ direction, ticks }));
const inputs = (tuples) => tuples.flatMap(([direction, ticks]) => Array(ticks).fill(direction));
const firstClosure = (result) => {
  const closure = result.closures[0];
  return closure
    ? {
        tick: closure.tick,
        claimedCells: closure.claimedCells,
        retainedRegions: closure.retainedComponents.filter((component) => component.retained)
          .length,
      }
    : null;
};
const isEastFirstConnection = (result) =>
  result.losses === 0 &&
  result.cuts === 1 &&
  firstClosure(result)?.claimedCells === 42 &&
  firstClosure(result)?.retainedRegions === 3;

// These diagnostics retain failed and unfinished samples as well as all six
// final legal clears. A route proof is not human balance or broad seed evidence.
for (const row of fixture.rows)
  test(`Two bays east-first: ${row.difficulty}/${row.turnPolicy}: ${row.qualification}`, () => {
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
      assert.equal(result.ruleset, row.ruleset);
      assert.deepEqual(result.gameplayTuning, row.gameplayTuning);
      if (Object.hasOwn(sample, 'firstClosure'))
        assert.deepEqual(firstClosure(result), sample.firstClosure);
      return result;
    };
    const result = replay(row);
    assert.equal(result.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
    assert.equal(result.gameplayTuning.adminOverride, false);
    assert.equal(row.qualification === 'full-clear-qualified', result.status === 'no-loss-clear');
    const prefix = replay(row.prefixEvidence);
    assert.equal(isEastFirstConnection(prefix), true);
    assert.equal(row.prefixQualified, true);
    assert.deepEqual(
      inputs(row.segments).slice(0, prefix.ticks),
      inputs(row.prefixEvidence.segments),
      'The complete sample must actually begin with the qualified east-first input sequence.',
    );
    assert.deepEqual(firstClosure(result), firstClosure(prefix));
    assert.equal(row.launchDelayTicks, row.difficulty === 'expert' ? 300 : 0);
    assert.deepEqual(
      row.prefixEvidence.segments,
      row.launchDelayTicks
        ? [
            [null, row.launchDelayTicks],
            ['right', 591],
          ]
        : [['right', 591]],
    );
    replay(row.baselineSample);
    for (const sample of row.launchSamples)
      assert.equal(isEastFirstConnection(replay(sample)), sample.qualified);
    assert.equal(
      row.sampledTicks,
      row.launchSamples.reduce((sum, sample) => sum + sample.ticks, 0),
    );
    let usedTicks = row.sampledTicks + row.baselineSample.ticks;
    for (const search of row.searchHistory) {
      assert(search.used <= search.budget);
      assert(search.budget <= fixture.maxInitialSimulationTicksPerConfig);
      assert.equal(
        Object.values(search.failuresByCause).reduce((sum, count) => sum + count, 0),
        search.failedAttempts,
      );
      usedTicks += search.used;
    }
    assert(usedTicks <= fixture.maxInitialSimulationTicksPerConfig);
    if (row.continuationEvidence) {
      const continuation = row.continuationEvidence;
      const initial = replay(continuation.initialEvidence);
      assert.equal(initial.status, 'route-exhausted');
      assert.equal(initial.losses, 0);
      assert(initial.coverage < row.coverageGoal);
      assert.equal(continuation.initialQualification, 'prefix-only-qualified');
      assert.deepEqual(
        inputs(row.segments).slice(0, initial.ticks),
        inputs(continuation.initialEvidence.segments),
        'The separately budgeted continuation must preserve the original unfinished route.',
      );
      assert.deepEqual(continuation.search.initialSegments, continuation.initialEvidence.segments);
      assert.equal(continuation.sourceIdentity.sourceSha256, fixture.sourceIdentity.sourceSha256);
      assert(continuation.search.used <= continuation.search.budget);
      assert(continuation.search.budget <= fixture.maxAdditionalContinuationTicks);
      assert.equal(
        Object.values(continuation.search.failuresByCause).reduce((sum, count) => sum + count, 0),
        continuation.search.failedAttempts,
      );
    }
  });

test('Two bays matrix covers six configurations and preserves its earlier bounded gaps', () => {
  assert.equal(fixture.rows.length, 6);
  assert.equal(fixture.maxInitialSimulationTicksPerConfig, 240000);
  assert.equal(fixture.maxAdditionalContinuationTicks, 240000);
  assert(fixture.searchElapsedSeconds < 300);
  assert.equal(fixture.sourceIdentity.stableDuringProbe, true);
  assert.match(fixture.sourceIdentity.gitRevision, /^[a-f0-9]{40}$/);
  assert.match(fixture.sourceIdentity.sourceSha256, /^[a-f0-9]{64}$/);
  assert(fixture.rows.every((row) => row.missionId === 'two-bays' && row.seed === 1));
  assert.deepEqual(
    fixture.rows.map((row) => `${row.difficulty}/${row.turnPolicy}`).sort(),
    ['gentle', 'standard', 'expert']
      .flatMap((preset) => ['immediate', 'grid-center'].map((control) => `${preset}/${control}`))
      .sort(),
  );
  assert.deepEqual(
    Object.fromEntries(
      Object.keys(fixture.outcomes).map((qualification) => [
        qualification,
        fixture.rows.filter((row) => row.qualification === qualification).length,
      ]),
    ),
    fixture.outcomes,
  );
  assert.equal(fixture.outcomes['full-clear-qualified'], 6);
  const resumed = fixture.rows.filter((row) => row.continuationEvidence);
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].difficulty, 'expert');
  assert.equal(resumed[0].turnPolicy, 'grid-center');
  assert.equal(resumed[0].searchHistory.at(-1).exhausted, true);
  assert.equal(resumed[0].continuationEvidence.search.exhausted, false);
  assert.equal(fixture.rows.filter((row) => row.baselineSample.status === 'life-lost').length, 5);
  assert.equal(
    fixture.rows.flatMap((row) => row.launchSamples).filter((sample) => !sample.qualified).length,
    22,
  );
});
