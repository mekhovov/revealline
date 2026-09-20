import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFractureCandidates } from '../content-design/fracture-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';

const project = compileContentProject(createFractureCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/fracture-clear-routes.json', import.meta.url)),
);

test('all42 Fractured Grid full-clear routes remain no-loss across five explicit seeds', () => {
  let count = 0;
  for (const { difficulty, turnPolicy, rows } of fixture.sets)
    for (const [id, identity, , segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      for (const seed of [0, 1, 42, 2026, 0xffffffff]) {
        const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy });
        const label = `${id}/${difficulty}/${turnPolicy}/${seed}`;
        for (const [direction, ticks] of segments)
          for (let tick = 0; tick < ticks; tick++) {
            assert.equal(run.status, 'running', label);
            stepRun(run, { direction }, FIXED_DT);
            assert.equal(run.classic.livesLost, 0, label);
            if (run.coverage >= manifest.level.goal.coverage)
              assert(
                run.objectives.every((o) => !o.required || o.captured),
                label,
              );
          }
        assert.equal(run.status, 'won', label);
        count++;
      }
    }
  assert.equal(count, 210);
});
