import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createUkrainianOrnamentAtlasJourney,
  UKRAINIAN_ORNAMENT_ATLAS_IDS,
} from '../content-design/ukrainian-ornament-atlas.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { dataIdentity } from '../data-json.mjs';
import { GAMEPLAY_TUNING_VERSION } from '../gameplay-tuning.mjs';
import {
  prepareSpatialMission,
  assessSpatialRoute,
} from '../../scripts/lib/spatial-challenge-assessment.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/ukrainian-ornament-atlas-routes.json', import.meta.url), 'utf8'),
);
const project = compileContentProject(createUkrainianOrnamentAtlasJourney());
const segments = (values) => values.map(([direction, ticks]) => ({ direction, ticks }));
const inputs = (values) => values.flatMap(([direction, ticks]) => Array(ticks).fill(direction));
const closureSummary = ({
  tick,
  claimedCells,
  coverage,
  coverageGain,
  exposureTicks,
  capturedObjectiveIds,
  openedGateIds,
}) => ({
  tick,
  claimedCells,
  coverage,
  coverageGain,
  exposureTicks,
  capturedObjectiveIds,
  openedGateIds,
});

// Legal input replay proves only these concrete samples. Full-state greedy
// searches are not human pacing, alternate-route or all-preset qualification.
for (const row of fixture.rows)
  test(`ornament atlas Standard primary route: ${row.missionId}`, () => {
    const prepared = prepareSpatialMission(project, row.missionId, { difficulty: row.difficulty });
    let usedTicks = 0;
    let previous = null;
    for (const sample of row.samples) {
      assert.equal(prepared.sourceProjectIdentity, sample.sourceProjectIdentity);
      assert.equal(prepared.authoredSimulationIdentity, sample.authoredSimulationIdentity);
      assert.equal(prepared.simulationIdentity, sample.simulationIdentity);
      const actual = assessSpatialRoute(prepared, {
        seed: row.seed,
        turnPolicy: row.turnPolicy,
        segments: segments(sample.segments),
      });
      for (const key of Object.keys(sample).filter(
        (key) => !['stage', 'search', 'segments', 'closures'].includes(key),
      ))
        assert.deepEqual(actual[key], sample[key], `${sample.stage}: ${key}`);
      assert.deepEqual(actual.segments, segments(sample.segments));
      assert.deepEqual(actual.closures.map(closureSummary), sample.closures);
      assert.equal(actual.replayVerified, true);
      assert.equal(actual.losses, 0);
      assert.equal(actual.gameplayTuning.version, GAMEPLAY_TUNING_VERSION);
      assert.equal(actual.gameplayTuning.adminOverride, false);
      const search = sample.search;
      assert.equal(search.policy, 'efficient');
      assert.equal(search.candidateLimit, 16);
      assert.equal(search.maxCuts, 24);
      assert.equal(search.initialDelayTicks, 0);
      assert(search.simulatedTicks <= search.simulationTickBudget);
      assert.equal(search.exhausted, search.simulatedTicks >= search.simulationTickBudget);
      assert.equal(
        Object.values(search.failuresByCause).reduce((sum, count) => sum + count, 0),
        search.failedProposals,
      );
      assert(search.selectedClosures <= search.attemptedProposals - search.failedProposals);
      if (previous) {
        const additional = sample.stage === 'additional-continuation';
        if (additional) {
          assert.equal(row.missionId, 'windbreak-weave');
          assert.equal(previous.stage, 'continuation');
          assert.equal(previous.status, 'route-exhausted');
          assert.equal(previous.search.exhausted, true);
        } else assert.equal(sample.stage, 'continuation');
        assert.equal(
          search.simulationTickBudget,
          additional
            ? fixture.searchBudgets.additionalWindbreakContinuation
            : fixture.searchBudgets.optionalContinuation,
        );
        assert.equal(search.prefixTicks, previous.ticks);
        assert.deepEqual(
          inputs(sample.segments).slice(0, previous.ticks),
          inputs(previous.segments),
          'The continuation preserves its earlier capped sample instead of replacing it.',
        );
      } else {
        assert.equal(sample.stage, 'initial');
        assert.equal(search.simulationTickBudget, fixture.searchBudgets.initial);
        assert.equal(search.prefixTicks, 0);
      }
      usedTicks += search.simulatedTicks;
      previous = sample;
    }
    const windbreak = row.missionId === 'windbreak-weave';
    assert(
      usedTicks <=
        (windbreak
          ? fixture.searchBudgets.maximumWindbreak
          : fixture.searchBudgets.maximumPerMission),
    );
    assert.equal(
      row.samples.length,
      windbreak ? 3 : row.samples[0].status === 'no-loss-clear' ? 1 : 2,
    );
    if (row.missionId !== 'twin-lens-chambers') {
      assert.equal(row.revalidation.unchangedRuntime, true);
      assert.equal(
        row.revalidation.previousSourceProjectIdentity,
        fixture.preReviewIdentity.sourceProjectIdentity,
      );
      assert.equal(
        row.revalidation.currentSourceProjectIdentity,
        fixture.sourceIdentity.sourceProjectIdentity,
      );
      assert.equal(row.revalidation.replayedSamples, row.samples.length - (windbreak ? 1 : 0));
    }
    if (row.qualification === 'primary-clear-qualified') {
      assert.equal(previous.status, 'no-loss-clear');
      assert(previous.coverage >= previous.coverageGoal);
      assert(previous.objectives.every((objective) => !objective.required || objective.captured));
    } else {
      assert.equal(row.qualification, 'primary-route-incomplete');
      assert.equal(previous.status, 'route-exhausted');
      assert.equal(previous.qualification, 'needs-new-route-not-proven-impossible');
    }
  });

test('the atlas evidence covers exactly nine bounded Standard seed-one samples', () => {
  assert.equal(fixture.format, 'UkrainianOrnamentAtlasRoutesV1');
  assert.deepEqual(
    fixture.rows.map((row) => row.missionId),
    [...UKRAINIAN_ORNAMENT_ATLAS_IDS],
  );
  assert.equal(fixture.sourceIdentity.sourceProjectIdentity, dataIdentity(project.source));
  assert.equal(fixture.sourceIdentity.gameplayVersion, GAMEPLAY_TUNING_VERSION);
  assert.equal(fixture.sourceIdentity.stableDuringProbe, true);
  assert.match(fixture.sourceIdentity.gitRevision, /^[0-9a-f]{40}$/);
  assert(
    Object.values(fixture.sourceIdentity.moduleSha256).every((sha) => /^[0-9a-f]{64}$/.test(sha)),
  );
  assert.equal(fixture.searchBudgets.initial, 120000);
  assert.equal(fixture.searchBudgets.optionalContinuation, 160000);
  assert.equal(fixture.searchBudgets.maximumPerMission, 280000);
  assert.equal(fixture.searchBudgets.additionalWindbreakContinuation, 160000);
  assert.equal(fixture.searchBudgets.maximumWindbreak, 440000);
  for (const qualification of ['primary-clear-qualified', 'primary-route-incomplete'])
    assert.equal(
      fixture.outcomes[qualification],
      fixture.rows.filter((row) => row.qualification === qualification).length,
    );
  assert(fixture.rows.every((row) => row.difficulty === 'standard'));
  assert(fixture.rows.every((row) => row.turnPolicy === 'immediate' && row.seed === 1));
});

test('pre-review identity and superseded Twin evidence are not current acceptance', () => {
  assert.notEqual(
    fixture.preReviewIdentity.sourceProjectIdentity,
    fixture.sourceIdentity.sourceProjectIdentity,
  );
  assert.deepEqual(
    fixture.revalidationProvenance.unchangedRuntimeMissionIds,
    UKRAINIAN_ORNAMENT_ATLAS_IDS.filter((id) => id !== 'twin-lens-chambers'),
  );
  assert.deepEqual(fixture.revalidationProvenance.changedGeometryMissionIds, [
    'twin-lens-chambers',
  ]);
  assert.equal(
    fixture.revalidationProvenance.replayedSamples,
    fixture.rows.reduce((sum, row) => sum + (row.revalidation?.replayedSamples ?? 0), 0),
  );
  assert.equal(fixture.supersededGeometry.length, 1);
  const superseded = fixture.supersededGeometry[0];
  assert.equal(superseded.status, 'superseded-geometry-not-current-acceptance');
  assert.equal(superseded.missionId, 'twin-lens-chambers');
  assert.deepEqual(superseded.sourceIdentity, fixture.preReviewIdentity);
  assert.equal(superseded.evidence.missionId, superseded.missionId);
  assert(
    superseded.evidence.samples.every(
      (sample) => sample.sourceProjectIdentity === fixture.preReviewIdentity.sourceProjectIdentity,
    ),
  );
  const current = fixture.rows.find((row) => row.missionId === superseded.missionId);
  assert.notEqual(
    current.samples[0].simulationIdentity,
    superseded.evidence.samples[0].simulationIdentity,
  );
});
