import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamMaterialPracticeCandidates } from '../content-design/team-material-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamMaterialGoal } from './helpers/team-material-goal.mjs';
import { SAFE, FIELD } from '../coop/core.mjs';

const source = createTeamMaterialPracticeCandidates(),
  before = structuredClone(source);
const project = compileContentProject(source);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/team-material-routes.json', import.meta.url)),
);

for (const row of fixture.routes)
  test(`${row.missionId}/${row.difficulty}: all material neutralized through real two-seat commands`, () => {
    const manifest = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    for (const expected of row.results) {
      const options = { jointCuts: expected.jointCuts, inspectGoal: inspectTeamMaterialGoal };
      const played = playTeamFoundationRoute(manifest.level, row.log, options);
      assert.equal(played.checkpoint, expected.checkpoint);
      assert.equal(played.run.status, 'won');
      assert.equal(played.run.tick, expected.tick);
      assert.equal(played.run.coverage, expected.coverage);
      assert(played.run.coverage >= manifest.level.goal.coverage);
      assert.equal(played.evidence.downs, 0);
      assert.deepEqual([...played.evidence.closed].sort(), [0, 1]);
      assert.equal(played.mastery.achieved, true);
      assert(played.simultaneousTicks > 0);
      assert.equal(
        played.run.players.every((p) => p.support.uses === 0),
        true,
      );
      assert.deepEqual(played, playTeamFoundationRoute(manifest.level, row.log, options));
      const swapped = playTeamFoundationRoute(manifest.level, row.log, {
        ...options,
        swapped: true,
      });
      assert.equal(swapped.checkpoint, expected.swappedCheckpoint);
      assert.equal(swapped.run.status, 'won');
      assert.equal(swapped.mastery.achieved, true);
      assert.equal(swapped.evidence.downs, 0);
      for (const area of manifest.level.terrain)
        for (let y = area.y; y < area.y + area.h; y++)
          for (let x = area.x; x < area.x + area.w; x++)
            assert.equal(played.run.cells[y * 72 + x], SAFE);
    }
    assert.deepEqual(source, before);
  });

test('material mastery rejects a missing patch cell, missing contributor or knockdown despite won state', () => {
  const row = fixture.routes.find(
    (r) => r.missionId === 'crossed-gardens' && r.difficulty === 'standard',
  );
  const level = resolveMission(project, row.missionId, { mode: 'team' }).level;
  const played = playTeamFoundationRoute(level, row.log, { inspectGoal: inspectTeamMaterialGoal });
  assert(played.mastery.achieved);
  // Observer unit counterfactuals only, not route-feasibility evidence.
  const incomplete = structuredClone(played.run),
    area = level.terrain[0];
  incomplete.cells[area.y * 72 + area.x] = FIELD;
  const snapshot = structuredClone(incomplete);
  assert.equal(inspectTeamMaterialGoal(incomplete, played.evidence).achieved, false);
  assert.deepEqual(incomplete, snapshot);
  for (const alter of [(e) => e.closed.delete(1), (e) => e.downs++]) {
    const evidence = structuredClone(played.evidence);
    alter(evidence);
    assert.equal(inspectTeamMaterialGoal(played.run, evidence).achieved, false);
  }
});

for (const row of fixture.routes)
  test(`${row.missionId}/${row.difficulty}: five additional seeds preserve a no-loss shared material route`, () => {
    const level = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    for (const seed of [2, 7, 19, 41, 99])
      for (const jointCuts of [true, false]) {
        const options = { seed, jointCuts, inspectGoal: inspectTeamMaterialGoal };
        const played = playTeamFoundationRoute(level, row.log, options);
        assert.equal(played.run.status, 'won');
        assert.equal(played.evidence.downs, 0);
        assert.equal(played.mastery.achieved, true);
        assert.deepEqual([...played.evidence.closed].sort(), [0, 1]);
        assert.equal(
          played.checkpoint,
          playTeamFoundationRoute(level, row.log, options).checkpoint,
        );
      }
  });
