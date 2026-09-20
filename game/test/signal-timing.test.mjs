import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/signal-clear-routes.json', import.meta.url)),
);
const projects = new Map(
  [true, false].map((bonuses) => {
    const source = createSignalCandidates();
    if (!bonuses) for (const mission of source.missions) mission.bonuses = [];
    return [bonuses, compileContentProject(source)];
  }),
);

test('all84 Signal routes remain legal no-loss clears across five explicit seeds', () => {
  let count = 0;
  for (const set of fixture.sets)
    for (const [id, identity, , segments] of set.rows) {
      const manifest = resolveMission(projects.get(set.bonuses), id, {
        difficulty: set.difficulty,
      });
      assert.equal(manifest.simulationIdentity, identity, id);
      for (const seed of [0, 1, 42, 2026, 0xffffffff]) {
        const run = createRun(manifest.level, {
          seed,
          classId: 'scout',
          turnPolicy: set.turnPolicy,
        });
        for (const [direction, ticks] of segments)
          for (let tick = 0; tick < ticks; tick++) {
            assert.equal(run.status, 'running', `${id}: no input after completion`);
            stepRun(run, { direction }, FIXED_DT);
            assert.equal(
              run.lives,
              manifest.level.rules.lives,
              `${id}/${seed}/${set.difficulty}/${set.turnPolicy}`,
            );
          }
        assert.equal(run.status, 'won', id);
        assert.equal(run.classic.livesLost, 0, id);
        count++;
      }
    }
  assert.equal(count, 420);
});
