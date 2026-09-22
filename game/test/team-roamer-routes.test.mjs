import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamRoamerCandidates } from '../content-design/team-roamer-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';
import { inspectTeamRoamerGoal } from './helpers/team-roamer-goal.mjs';

const source = createTeamRoamerCandidates(),
  before = structuredClone(source),
  project = compileContentProject(source);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/team-roamer-routes.json', import.meta.url)),
);

for (const row of fixture.routes)
  test(`${row.missionId}/${row.difficulty}: both craft clear after deliberate roamer activation without loss`, () => {
    const manifest = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    for (const expected of row.results) {
      const options = { jointCuts: expected.jointCuts, inspectGoal: inspectTeamRoamerGoal };
      const played = playTeamFoundationRoute(manifest.level, row.log, options);
      assert.equal(played.checkpoint, expected.checkpoint);
      assert.equal(played.run.status, 'won');
      assert.equal(played.run.tick, expected.tick);
      assert.equal(played.run.coverage, expected.coverage);
      assert.equal(played.evidence.downs, 0);
      assert.deepEqual([...played.evidence.closed].sort(), [0, 1]);
      assert(played.mastery.achieved);
      assert(played.simultaneousTicks > 0);
      assert(played.run.players.every((p) => p.support.uses === 0));
      for (const actor of manifest.level.enemies.filter((e) => e.type === 'claimed-rover')) {
        const warning = played.events.find((e) => e.type === 'rover.warning' && e.id === actor.id);
        const active = played.events.find((e) => e.type === 'rover.activated' && e.id === actor.id);
        assert(warning && active);
        assert(played.events.indexOf(active) > played.events.indexOf(warning));
      }
      assert.deepEqual(played, playTeamFoundationRoute(manifest.level, row.log, options));
      const swapped = playTeamFoundationRoute(manifest.level, row.log, {
        ...options,
        swapped: true,
      });
      assert.equal(swapped.checkpoint, expected.swappedCheckpoint);
      assert.equal(swapped.run.status, 'won');
      assert(swapped.mastery.achieved);
      assert.equal(swapped.evidence.downs, 0);
    }
    assert.deepEqual(source, before);
  });

for (const row of fixture.routes)
  test(`${row.missionId}/${row.difficulty}: five additional seeds preserve a shared no-loss roamer route`, () => {
    const level = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    }).level;
    for (const seed of [2, 7, 19, 41, 99])
      for (const jointCuts of [true, false]) {
        const options = { seed, jointCuts, inspectGoal: inspectTeamRoamerGoal };
        const played = playTeamFoundationRoute(level, row.log, options);
        assert.equal(played.run.status, 'won');
        assert.equal(played.evidence.downs, 0);
        assert(played.mastery.achieved);
        assert.equal(
          played.checkpoint,
          playTeamFoundationRoute(level, row.log, options).checkpoint,
        );
      }
  });
