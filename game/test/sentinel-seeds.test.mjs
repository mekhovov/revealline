import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';

const project = compileContentProject(createSentinelCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/sentinel-clear-routes.json', import.meta.url)),
);
// Finite deterministic samples, not a statistical claim or proof for every seed.
for (const { difficulty, turnPolicy, rows } of fixture.sets)
  test(`Sentinel Array five additional seed samples: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, identity, , segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity);
      for (const seed of [2, 7, 19, 41, 99]) {
        const label = `${id}/${seed}`,
          options = { seed, classId: 'scout', turnPolicy };
        const run = createRun(manifest.level, options),
          recorder = createRecorder(manifest.level, options);
        const denominator = run.totalClaimable;
        for (const [direction, ticks] of segments)
          for (let tick = 0; tick < ticks; tick++) {
            assert.equal(run.status, 'running', `${label}: early terminal`);
            recordInput(recorder, { direction });
            stepRun(run, { direction }, FIXED_DT);
            assert.equal(run.classic.livesLost, 0, `${label}: life loss`);
            assert.equal(run.totalClaimable, denominator);
            if (!run.encounter.defeated) assert.notEqual(run.status, 'won', label);
          }
        assert.equal(run.status, 'won', label);
        assert(
          run.relay.gates.every((gate) => gate.openedTick !== null && gate.openedTick < run.tick),
          label,
        );
        assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, label);
      }
    }
  });
