import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { assessTeamPressureRoute } from '../../scripts/lib/team-pressure-assessment.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/team-pressure-${name}.json`, import.meta.url)));
const material = await read('material-routes'),
  roamer = await read('roamer-routes');
const earlier = [
  await read('assessment'),
  await read('opening-routes'),
  await read('foundation-routes'),
];
const source = withPressureDifficulty(createTeamJourneyCandidates()),
  before = structuredClone(source);
const project = compileContentProject(source);
const pairs = ['false/false', 'false/true', 'true/false', 'true/true'];
const masteries = new Set([
  'crossed-gardens/expert',
  'split-orchards/standard',
  'shared-lookout/standard',
]);
const laterFailures = new Map([
  ['split-orchards/standard', [1063, 'keeper-1']],
  ['weaver-crossing/expert', [2136, 'keeper-3']],
  ['twin-depots/expert', [1950, 'keeper-1']],
]);

test('all twelve Team missions now have all three ordinary pressure presets with no overwritten failure evidence', () => {
  assert.equal(material.format, 'TeamPressureMaterialRoutesV1');
  assert.equal(roamer.format, 'TeamPressureRoamerRoutesV1');
  const rows = [
    ...earlier[0].rows.filter((r) => r.selected),
    ...earlier[1].rows,
    ...earlier[2].rows,
    ...material.rows,
    ...roamer.rows,
  ];
  assert.equal(rows.length, 36);
  assert.equal(new Set(rows.map((r) => `${r.missionId}/${r.difficulty}`)).size, 36);
  for (const mission of project.missions)
    for (const difficulty of ['gentle', 'standard', 'expert'])
      assert(rows.some((r) => r.missionId === mission.id && r.difficulty === difficulty));
  assert.equal(material.rows.length, 6);
  assert.equal(roamer.rows.length, 8);
  const extra = [...material.rows, ...roamer.rows].flatMap((r) => r.additionalTiming.outcomes);
  assert.equal(extra.filter((o) => o.status === 'shared-no-loss-clear').length, 44);
  assert.equal(extra.filter((o) => o.status === 'first-knockdown').length, 12);
  assert.equal(earlier[0].rows.filter((r) => !r.selected).length, 23);
});

for (const fixture of [material, roamer]) {
  test(`${fixture.format}: exact matrix and failed-probe summary`, () => {
    assert.equal(fixture.projectRevision, source.revision);
    assert.equal(fixture.difficultyCatalogue, project.difficulty.id);
    for (const row of fixture.rows) {
      assert.equal(
        earlier[0].rows.find(
          (r) => r.missionId === row.missionId && r.difficulty === row.difficulty,
        ).selected,
        null,
      );
      assert.equal(row.additionalTiming.delayTicks, 30);
      for (const outcomes of [row.outcomes, row.additionalTiming.outcomes])
        assert.deepEqual(outcomes.map((r) => `${r.jointCuts}/${r.swapped}`).sort(), pairs);
      assert.equal(
        row.bothIdleTicks,
        row.log.reduce((sum, s) => sum + (s.a === null && s.b === null ? s.ticks : 0), 0),
      );
      const failure = fixture.failed.find(
        (f) => f.missionId === row.missionId && f.difficulty === row.difficulty,
      );
      assert.equal(Boolean(failure), laterFailures.has(`${row.missionId}/${row.difficulty}`));
      assert.equal(row.additionalTiming.success, !failure);
      if (failure)
        for (const record of failure.outcomes) {
          const actual = row.additionalTiming.outcomes.find(
            (o) => o.jointCuts === record.jointCuts && o.swapped === record.swapped,
          );
          for (const [key, value] of Object.entries(record)) assert.deepEqual(actual[key], value);
        }
    }
  });
  for (const row of fixture.rows) {
    const { level, simulationIdentity } = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    for (const timing of [{ delayTicks: 0, outcomes: row.outcomes }, row.additionalTiming])
      for (const { jointCuts, swapped, ...expected } of timing.outcomes)
        test(`${row.missionId}/${row.difficulty}/delay${timing.delayTicks}/joint${jointCuts}/swap${swapped}: public two-seat outcome`, () => {
          assert.equal(simulationIdentity, row.simulationIdentity);
          const options = { jointCuts, swapped, delayTicks: timing.delayTicks };
          const actual = assessTeamPressureRoute(level, row.log, options);
          assert.deepEqual(actual, expected);
          assert.deepEqual(assessTeamPressureRoute(level, row.log, options), actual);
          const failure =
            timing.delayTicks && laterFailures.get(`${row.missionId}/${row.difficulty}`);
          if (failure) {
            assert.equal(actual.status, 'first-knockdown');
            assert.equal(actual.tick, failure[0]);
            assert.equal(actual.firstDown.tick, failure[0] - 1);
            assert.equal(actual.firstDown.cause, 'enemy-trail');
            assert.equal(actual.firstDown.enemy, failure[1]);
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
            if (!timing.delayTicks)
              assert.equal(
                actual.mastery.achieved,
                masteries.has(`${row.missionId}/${row.difficulty}`),
              );
          }
          assert.deepEqual(actual.supportUses, [0, 0]);
          assert.equal(actual.jointEvents, 0);
          assert.deepEqual(source, before);
        });
  }
}
