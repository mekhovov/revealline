import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { playTeamFoundationRoute } from './helpers/team-foundation-route.mjs';

const project = compileContentProject(createTeamJourneyCandidates());
const { routes } = JSON.parse(
  await readFile(new URL('./fixtures/team-opening-routes.json', import.meta.url)),
);
for (const row of routes)
  test(`${row.missionId}: Journey host opening uses legal continuous public inputs with contributions from both seats`, () => {
    const { level } = resolveMission(project, row.missionId, {
      mode: 'team',
      difficulty: row.difficulty,
    });
    // Only test the common contribution condition here. Shared detour's full
    // material mastery is not inferred from an ordinary clear.
    const inspectGoal = (run, evidence) => ({
      achieved: run.status === 'won' && evidence.closed.size === 2 && evidence.downs === 0,
    });
    for (const seed of [1, 17])
      for (const jointCuts of [true, false])
        for (const swapped of [true, false]) {
          const options = { seed, jointCuts, swapped, inspectGoal };
          const result = playTeamFoundationRoute(level, row.log, options);
          assert.equal(result.run.status, 'won');
          assert.equal(result.evidence.downs, 0);
          assert.deepEqual([...result.evidence.closed].sort(), [0, 1]);
          assert(result.simultaneousTicks > 0);
          assert.equal(
            result.checkpoint,
            playTeamFoundationRoute(level, row.log, options).checkpoint,
          );
        }
  });
