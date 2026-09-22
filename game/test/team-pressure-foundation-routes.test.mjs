import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { assessTeamPressureRoute } from '../../scripts/lib/team-pressure-assessment.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const fixture = await read('team-pressure-foundation-routes');
const assessment = await read('team-pressure-assessment');
const opening = await read('team-pressure-opening-routes');
const source = withPressureDifficulty(createTeamJourneyCandidates()),
  before = structuredClone(source);
const project = compileContentProject(source);
const pairs = ['false/false', 'false/true', 'true/false', 'true/true'];

test('five fresh foundation sets extend coverage without overwriting earlier failed trials', () => {
  assert.equal(fixture.format, 'TeamPressureFoundationRoutesV1');
  assert.equal(fixture.projectRevision, source.revision);
  assert.equal(fixture.difficultyCatalogue, project.difficulty.id);
  assert.deepEqual(fixture.rows.map((r) => `${r.missionId}/${r.difficulty}`).sort(), [
    'divided-workshop/expert',
    'divided-workshop/standard',
    'stepping-exchange/expert',
    'stepping-exchange/standard',
    'switchback-partners/standard',
  ]);
  const covered = [
    ...assessment.rows.filter((r) => r.selected),
    ...opening.rows,
    ...fixture.rows,
  ].map((r) => `${r.missionId}/${r.difficulty}`);
  assert.equal(covered.length, 22);
  assert.equal(new Set(covered).size, 22);
  for (const row of fixture.rows) {
    assert.equal(
      assessment.rows.find((r) => r.missionId === row.missionId && r.difficulty === row.difficulty)
        .selected,
      null,
    );
    assert.equal(row.additionalTiming.delayTicks, 30);
    for (const outcomes of [row.outcomes, row.additionalTiming.outcomes])
      assert.deepEqual(outcomes.map((r) => `${r.jointCuts}/${r.swapped}`).sort(), pairs);
    assert.equal(
      row.bothIdleTicks,
      row.log.reduce((sum, s) => sum + (s.a === null && s.b === null ? s.ticks : 0), 0),
    );
  }
  assert.equal(
    fixture.rows
      .flatMap((r) => r.additionalTiming.outcomes)
      .filter((o) => o.status === 'shared-no-loss-clear').length,
    16,
  );
});

for (const row of fixture.rows) {
  const { level, simulationIdentity } = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  for (const timing of [{ delayTicks: 0, outcomes: row.outcomes }, row.additionalTiming])
    for (const { jointCuts, swapped, ...expected } of timing.outcomes)
      test(`${row.missionId}/${row.difficulty}/delay${timing.delayTicks}/joint${jointCuts}/swap${swapped}: pinned fresh-input outcome`, () => {
        assert.equal(simulationIdentity, row.simulationIdentity);
        const options = { jointCuts, swapped, delayTicks: timing.delayTicks };
        const actual = assessTeamPressureRoute(level, row.log, options);
        assert.deepEqual(actual, expected);
        assert.deepEqual(assessTeamPressureRoute(level, row.log, options), actual);
        const fails =
          row.missionId === 'divided-workshop' &&
          row.difficulty === 'standard' &&
          timing.delayTicks === 30;
        if (fails) {
          assert.equal(actual.status, 'first-knockdown');
          assert.equal(actual.tick, 1742);
          assert.equal(actual.firstDown.tick, 1741);
          assert.equal(actual.firstDown.cause, 'enemy-trail');
          assert.equal(actual.firstDown.enemy, 'keeper-2');
          assert.equal(actual.mastery.achieved, false);
        } else {
          assert.equal(actual.status, 'shared-no-loss-clear');
          assert.equal(actual.firstDown, null);
          assert(actual.closures.every((count) => count > 0));
          assert(
            actual.closureReasons.every(
              (reasons) => Object.keys(reasons).length === 1 && reasons.return > 0,
            ),
          );
          assert.equal(actual.reserves, row.difficulty === 'standard' ? 2 : 1);
          assert.deepEqual(actual.supportUses, [0, 0]);
          assert.equal(actual.mastery.achieved, row.missionId === 'divided-workshop');
        }
        assert.deepEqual(source, before);
      });
}

test('failed timing summary points to the actual failed four-way sample', () => {
  assert.equal(fixture.failed.length, 1);
  const failure = fixture.failed[0];
  const row = fixture.rows.find(
    (r) => r.missionId === failure.missionId && r.difficulty === failure.difficulty,
  );
  assert.equal(failure.delayTicks, row.additionalTiming.delayTicks);
  assert.equal(row.additionalTiming.success, false);
  assert.deepEqual(
    failure.outcomes,
    row.additionalTiming.outcomes.map(({ jointCuts, swapped, status, tick, firstDown }) => ({
      jointCuts,
      swapped,
      status,
      tick,
      firstDown,
    })),
  );
});
