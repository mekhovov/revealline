import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamRoamerSpatialCandidates } from '../content-design/team-roamer-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { assessTeamPressureRoute } from '../../scripts/lib/team-pressure-assessment.mjs';
import { measureTeamRoamerSpatialRoute } from './helpers/team-roamer-spatial-evidence.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/team-roamer-spatial-routes.json', import.meta.url)),
);
const source = createTeamRoamerSpatialCandidates(),
  before = structuredClone(source);
const project = compileContentProject(source);
const pairs = ['false/false', 'false/true', 'true/false', 'true/true'];
const pair = (o) => `${o.jointCuts}/${o.swapped}`;

test('spatial evidence contains exactly six preset sets, all option pairs and preserved failed probes', () => {
  assert.equal(fixture.format, 'TeamRoamerSpatialRoutesV1');
  assert.equal(fixture.projectRevision, source.revision);
  assert.equal(fixture.difficultyCatalogue, project.difficulty.id);
  assert.equal(fixture.rows.length, 6);
  assert.equal(new Set(fixture.rows.map((r) => `${r.missionId}/${r.difficulty}`)).size, 6);
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      assert(fixture.rows.some((r) => r.missionId === mission.id && r.difficulty === difficulty));
  assert.equal(fixture.failed.length, 1);
  assert.equal(fixture.partialAttempts.length, 1);
  assert(fixture.searchMilliseconds < fixture.searchBudgetMilliseconds);
  for (const row of fixture.rows) {
    for (const values of [
      row.outcomes,
      row.encounterEvidence,
      row.measurements,
      row.additionalTiming.outcomes,
    ])
      assert.deepEqual(values.map(pair).sort(), pairs);
    assert.equal(
      row.bothIdleTicks,
      row.log.reduce((n, s) => n + (s.a === null && s.b === null ? s.ticks : 0), 0),
    );
    assert(row.searchMilliseconds < fixture.perVariantBudgetMilliseconds);
  }
  assert.equal(
    fixture.rows
      .flatMap((r) => r.additionalTiming.outcomes)
      .filter((o) => o.status === 'shared-no-loss-clear').length,
    20,
  );
  const failure = fixture.failed[0];
  assert.equal(failure.missionId, 'twin-depots');
  assert.equal(failure.difficulty, 'expert');
  assert.deepEqual(
    failure.outcomes,
    fixture.rows.find(
      (r) => r.missionId === failure.missionId && r.difficulty === failure.difficulty,
    ).additionalTiming.outcomes,
  );
});

for (const row of fixture.rows) {
  const { level, simulationIdentity } = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  for (const { jointCuts, swapped, ...expected } of row.outcomes)
    test(`${row.missionId}/${row.difficulty}/joint${jointCuts}/swap${swapped}: fresh clear with active-patrol escape and later return`, () => {
      assert.equal(simulationIdentity, row.simulationIdentity);
      const options = { jointCuts, swapped };
      const { encounter, partnerGroundCells, ...outcome } = measureTeamRoamerSpatialRoute(
        level,
        row.log,
        options,
      );
      assert.deepEqual(outcome, expected);
      assert.equal(outcome.status, 'shared-no-loss-clear');
      assert.equal(outcome.firstDown, null);
      assert.equal(outcome.mastery.achieved, true);
      assert(outcome.closureReasons.every((r) => r.return > 0 && Object.keys(r).length === 1));
      const measured = row.measurements.find((o) => pair(o) === pair(options));
      assert.deepEqual(encounter, measured.encounter);
      assert.deepEqual(
        partnerGroundCells.map((c) => c.length),
        measured.partnerGroundCount,
      );
      const independent = row.encounterEvidence.find((o) => pair(o) === pair(options));
      assert.equal(independent.checkpoint, outcome.checkpoint);
      assert.equal(
        encounter.length,
        level.enemies.filter((e) => e.type === 'claimed-rover').length,
      );
      for (const record of encounter) {
        const other = independent.records.find((r) => r.id === record.id);
        assert.equal(record.warningTick, other.warning.tick);
        assert.equal(record.activationTick, other.activation.tick);
        assert.equal(record.activationTick - record.warningTick, 120);
        assert.equal(record.activeTicksBeforeFinish, other.activeTicksBeforeWin);
        assert(record.activeTicksBeforeFinish >= 360);
        assert.deepEqual(record.laneExit, other.laneExit);
        assert.deepEqual(record.subsequentReturn, other.subsequentReturn);
        assert(record.laneExit.tick > record.activationTick);
        assert(record.subsequentReturn.tick > record.laneExit.tick);
        assert(record.postActivationReturns.every((n) => n > 0));
        if (row.missionId === 'twin-depots' && record.id === 'roamer-1') {
          assert(record.laneExit.cutting);
          assert(record.laneExit.separation < 2);
        }
      }
      // Deliberately expose the remaining cooperation gap, not a fabricated
      // engagement score from both players having contributed once.
      assert.equal(outcome.simultaneousTicks, 0);
      assert.equal(outcome.jointEvents, 0);
      assert.deepEqual(outcome.supportUses, [0, 0]);
      assert.deepEqual(source, before);
    });
  for (const { jointCuts, swapped, ...expected } of row.additionalTiming.outcomes)
    test(`${row.missionId}/${row.difficulty}/joint${jointCuts}/swap${swapped}: delayed start retains its real outcome`, () => {
      const actual = assessTeamPressureRoute(level, row.log, {
        jointCuts,
        swapped,
        delayTicks: row.additionalTiming.delayTicks,
      });
      assert.deepEqual(actual, expected);
      if (row.missionId === 'twin-depots' && row.difficulty === 'expert') {
        assert.equal(actual.status, 'first-knockdown');
        assert.equal(actual.tick, 1425);
        assert.equal(actual.firstDown.tick, 1424);
        assert.equal(actual.firstDown.enemy, 'inner-keeper-2');
        assert.equal(actual.firstDown.cause, 'enemy-trail');
      } else assert.equal(actual.status, 'shared-no-loss-clear');
    });
}

for (const row of fixture.partialAttempts)
  for (const { jointCuts, swapped, ...expected } of row.outcomes)
    test(`incomplete ${row.missionId}/${row.difficulty}/joint${jointCuts}/swap${swapped}: activation alone is not completion`, () => {
      const { level } = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      const actual = assessTeamPressureRoute(level, row.segments, { jointCuts, swapped });
      assert.deepEqual(actual, expected);
      assert.equal(actual.status, 'route-exhausted');
      assert.equal(actual.tick, 639);
      assert.equal(actual.mastery.achieved, false);
      assert.equal(actual.mastery.activated.length, 2);
    });

test('measurement cannot convert a braking mismatch or first knockdown into a clear', () => {
  const row = fixture.rows.find((r) => r.missionId === 'twin-depots' && r.difficulty === 'expert');
  const { level } = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  const failed = measureTeamRoamerSpatialRoute(level, row.log, { delayTicks: 30 });
  assert.equal(failed.status, 'first-knockdown');
  assert.equal(failed.tick, 1425);
  const mismatch = measureTeamRoamerSpatialRoute(level, [
    { a: 'left', b: null, ticks: 1 },
    { a: null, b: null, ticks: 1 },
  ]);
  assert.equal(mismatch.status, 'continuous-input-mismatch');
  assert.equal(mismatch.tick, 1);
});
