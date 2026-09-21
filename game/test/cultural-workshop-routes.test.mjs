import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCulturalWorkshopCandidates } from '../content-design/cultural-workshop-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/cultural-workshop-clear-routes.json', import.meta.url)),
);
const project = compileContentProject(createCulturalWorkshopCandidates());

for (const { difficulty, turnPolicy, rows } of fixture.sets) {
  test(`eight greyboxes clear without bonuses or losses, with public replay: ${difficulty}/${turnPolicy}`, () => {
    assert.deepEqual(
      rows.map((row) => row[0]),
      project.missions.map((m) => m.id),
    );
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      const options = { seed: fixture.seed, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      for (const [direction, ticks] of segments)
        for (let n = 0; n < ticks; n++) {
          assert.equal(run.status, 'running', id);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, manifest.level.rules.lives, id);
        }
      assert.equal(run.status, 'won', id);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true, id);
    }
  });
  test(`eight equal paired-board races finish without losses: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, , , segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty, mode: 'versus' });
      const match = createDuel(
        manifest.level,
        { seed: fixture.seed, classId: 'scout', turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      resumeDuel(match);
      for (const [direction, ticks] of segments)
        for (let n = 0; n < ticks; n++) {
          assert.equal(match.status, 'running', id);
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished', id);
      assert.equal(match.winner, null, id);
      assert(
        match.runs.every((run) => run.status === 'won' && run.lives === manifest.level.rules.lives),
        id,
      );
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        id,
      );
    }
  });
}
