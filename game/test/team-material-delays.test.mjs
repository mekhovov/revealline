import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamMaterialPracticeCandidates } from '../content-design/team-material-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamMaterialGoal } from './helpers/team-material-goal.mjs';

const project = compileContentProject(createTeamMaterialPracticeCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/team-material-delays.json', import.meta.url)),
);

test('material delayed alternatives cover all three missions and all five declared Standard waits', () => {
  assert.equal(fixture.routes.length, 15);
  for (const mission of project.missions) {
    const rows = fixture.routes.filter((r) => r.missionId === mission.id);
    assert.deepEqual(
      rows.map((r) => r.delayTicks).sort((a, b) => a - b),
      [60, 120, 240, 360, 600],
    );
    assert(rows.every((r) => r.difficulty === 'standard'));
  }
  assert(
    fixture.routes.some((r) => r.results.some((result) => !result.mastery)),
    'ordinary clearing and optional mastery remain separately evidenced',
  );
});

for (const mission of project.missions)
  test(`${mission.id}: delayed two-seat routes remain legal, repeatable and no-loss with swapped seats`, () => {
    const manifest = resolveMission(project, mission.id, { mode: 'team' });
    for (const row of fixture.routes.filter((r) => r.missionId === mission.id)) {
      assert.equal(row.simulationIdentity, manifest.simulationIdentity);
      assert.deepEqual(row.log[0], { a: null, b: null, ticks: row.delayTicks });
      for (const expected of row.results) {
        const options = { jointCuts: expected.jointCuts, inspectGoal: inspectTeamMaterialGoal };
        const played = playTeamFoundationRoute(manifest.level, row.log, options);
        assert.equal(played.run.status, 'won');
        assert.equal(played.evidence.downs, 0);
        assert.deepEqual([...played.evidence.closed].sort(), [0, 1]);
        assert.equal(played.checkpoint, expected.checkpoint);
        assert.equal(played.run.tick, expected.tick);
        assert.equal(played.run.coverage, expected.coverage);
        assert.equal(played.mastery.achieved, expected.mastery);
        assert.deepEqual(played, playTeamFoundationRoute(manifest.level, row.log, options));
        const swapped = playTeamFoundationRoute(manifest.level, row.log, {
          ...options,
          swapped: true,
        });
        assert.equal(swapped.checkpoint, expected.swappedCheckpoint);
        assert.equal(swapped.run.status, 'won');
        assert.equal(swapped.evidence.downs, 0);
        assert.deepEqual([...swapped.evidence.closed].sort(), [0, 1]);
      }
    }
  });
