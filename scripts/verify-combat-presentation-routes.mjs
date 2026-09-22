// Read-only public-input presentation compatibility check; not human/device performance evidence.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCombatCandidates } from '../game/content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../game/core/index.mjs';
import { authoritativeCheckpoint } from '../game/replay.mjs';
import { combatView } from '../game/ui/combat-view.mjs';

const { routes } = JSON.parse(
  readFileSync(new URL('../game/test/fixtures/combat-candidate-routes.json', import.meta.url)),
);
const project = compileContentProject(createCombatCandidates());
let frames = 0,
  warnings = 0,
  projectileFrames = 0;
const results = [];
for (const row of routes) {
  const manifest = resolveMission(project, row.id, { difficulty: row.difficulty });
  assert.equal(manifest.simulationIdentity, row.simulationIdentity);
  const run = createRun(manifest.level, {
    seed: row.seed,
    turnPolicy: row.turnPolicy,
    classId: 'scout',
  });
  assert.equal(combatView(run).valid, true);
  for (const { direction, ticks } of row.segments)
    for (let n = 0; n < ticks; n++) {
      stepRun(run, { direction }, FIXED_DT);
      const view = combatView(run);
      assert.equal(
        view.valid,
        true,
        `${row.id}/${row.difficulty}/${row.turnPolicy}/seed${row.seed}/tick${run.tick}: ${view.error}`,
      );
      frames++;
      if (view.actors.some((actor) => actor.phase === 'warning')) warnings++;
      if (view.projectiles.length) projectileFrames++;
    }
  assert.equal(run.status, 'won');
  assert.equal(
    authoritativeCheckpoint(run).hash,
    row.checkpoint,
    'Rendering projection cannot change the pinned simulation outcome.',
  );
  results.push({
    id: row.id,
    difficulty: row.difficulty,
    turnPolicy: row.turnPolicy,
    seed: row.seed,
    frames: run.tick,
  });
}
console.log(
  JSON.stringify({
    source: 'combat-greybox-1',
    routes: results.length,
    frames,
    warnings,
    projectileFrames,
    results,
  }),
);
