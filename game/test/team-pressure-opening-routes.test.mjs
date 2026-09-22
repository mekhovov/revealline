import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { assessTeamPressureRoute } from '../../scripts/lib/team-pressure-assessment.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/team-pressure-opening-routes.json', import.meta.url)),
);
const assessment = JSON.parse(
  await readFile(new URL('./fixtures/team-pressure-assessment.json', import.meta.url)),
);
const source = withPressureDifficulty(createTeamJourneyCandidates());
const before = structuredClone(source),
  project = compileContentProject(source);

test('fresh opening routes fill four former gaps without replacing historical failures', () => {
  assert.equal(fixture.format, 'TeamPressureOpeningRoutesV1');
  assert.equal(fixture.projectRevision, source.revision);
  assert.equal(fixture.difficultyCatalogue, project.difficulty.id);
  assert.deepEqual(fixture.rows.map((r) => `${r.missionId}/${r.difficulty}`).sort(), [
    'shared-detour/expert',
    'shared-detour/standard',
    'twin-landings/expert',
    'twin-landings/standard',
  ]);
  for (const row of fixture.rows) {
    assert.equal(
      assessment.rows.find((r) => r.missionId === row.missionId && r.difficulty === row.difficulty)
        .selected,
      null,
    );
    assert.equal(row.outcomes.length, 4);
    assert.equal(row.additionalTiming.delayTicks, 30);
    assert.equal(row.additionalTiming.outcomes.length, 4);
    for (const outcomes of [row.outcomes, row.additionalTiming.outcomes])
      assert.deepEqual(outcomes.map((r) => `${r.jointCuts}/${r.swapped}`).sort(), [
        'false/false',
        'false/true',
        'true/false',
        'true/true',
      ]);
    assert.equal(
      row.bothIdleTicks,
      row.log.reduce((sum, s) => sum + (s.a === null && s.b === null ? s.ticks : 0), 0),
    );
  }
  assert.equal(assessment.rows.filter((r) => r.selected).length + fixture.rows.length, 17);
  assert.equal(fixture.partialAttempts.length, 1);
});

for (const row of fixture.rows) {
  const manifest = resolveMission(project, row.missionId, {
    mode: 'team',
    difficulty: row.difficulty,
  });
  for (const timing of [{ delayTicks: 0, outcomes: row.outcomes }, row.additionalTiming])
    for (const { jointCuts, swapped, ...expected } of timing.outcomes)
      test(`${row.missionId}/${row.difficulty}/delay${timing.delayTicks}/joint${jointCuts}/swap${swapped}: fresh public route clears with both self-returns`, () => {
        assert.equal(manifest.simulationIdentity, row.simulationIdentity);
        const options = { jointCuts, swapped, delayTicks: timing.delayTicks };
        const actual = assessTeamPressureRoute(manifest.level, row.log, options);
        assert.deepEqual(actual, expected);
        assert.deepEqual(assessTeamPressureRoute(manifest.level, row.log, options), actual);
        assert.equal(actual.status, 'shared-no-loss-clear');
        assert.equal(actual.firstDown, null);
        assert(actual.closures.every((count) => count >= 2));
        assert(
          actual.closureReasons.every(
            (reasons) => Object.keys(reasons).length === 1 && reasons.return >= 2,
          ),
        );
        assert.equal(actual.reserves, row.difficulty === 'standard' ? 2 : 1);
        assert.deepEqual(actual.supportUses, [0, 0]);
        assert.equal(actual.jointEvents, 0);
        assert.equal(actual.meaningfulJointCuts, 0);
        assert.equal(actual.mastery.achieved, true);
        assert(actual.simultaneousTicks > 0);
        assert.deepEqual(source, before);
      });
}

for (const row of fixture.partialAttempts)
  for (const { jointCuts, swapped, ...expected } of row.outcomes)
    test(`preserved ${row.missionId}/${row.difficulty} incomplete branch joint${jointCuts}/swap${swapped} is not promoted as a clear`, () => {
      const { level } = resolveMission(project, row.missionId, {
        mode: 'team',
        difficulty: row.difficulty,
      });
      const actual = assessTeamPressureRoute(level, row.log, { jointCuts, swapped });
      assert.deepEqual(actual, expected);
      assert.equal(actual.status, 'route-exhausted');
      assert(actual.coverage < level.goal.coverage);
      assert.equal(actual.mastery.achieved, false);
    });
