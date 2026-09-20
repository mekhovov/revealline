import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const routes = JSON.parse(
  await readFile(new URL('./fixtures/border-clear-routes.json', import.meta.url)),
);
const timing = JSON.parse(
  await readFile(new URL('./fixtures/border-timing-routes.json', import.meta.url)),
);
const projects = new Map(
  [true, false].map((bonuses) => {
    const source = createBorderCandidates();
    if (!bonuses) for (const mission of source.missions) mission.bonuses = [];
    return [bonuses, compileContentProject(source)];
  }),
);

test('all84 recorded Border routes clear across five explicit seeds without losing a life', () => {
  let count = 0;
  for (const set of routes.sets)
    for (const [id, identity, , segments] of set.rows) {
      const manifest = resolveMission(projects.get(set.bonuses), id, {
        difficulty: set.difficulty,
      });
      assert.equal(manifest.simulationIdentity, identity);
      for (const seed of [0, 1, 42, 2026, 0xffffffff]) {
        const run = createRun(manifest.level, {
          seed,
          classId: 'scout',
          turnPolicy: set.turnPolicy,
        });
        for (const [direction, ticks] of segments)
          for (let n = 0; n < ticks; n++) {
            assert.equal(run.status, 'running', `${id}: input after completion`);
            stepRun(run, { direction }, FIXED_DT);
            assert.equal(
              run.lives,
              manifest.level.rules.lives,
              `${id}/${seed}/${set.difficulty}/${set.turnPolicy}`,
            );
          }
        assert.equal(run.status, 'won', id);
        count++;
      }
    }
  assert.equal(count, 420);
});

test('every Border board has an exact legal no-loss route after each sampled start delay', () => {
  assert.equal(timing.format, 'BorderTimingFeasibilityRoutesV1');
  assert.equal(timing.seed, 1);
  assert.equal(timing.difficulty, 'standard');
  assert.equal(timing.turnPolicy, 'immediate');
  assert.deepEqual(
    timing.sets.map((set) => set.delaySeconds),
    [0.25, 0.5, 1, 2, 5],
  );
  const ids = projects.get(true).missions.map((mission) => mission.id);
  for (const { delaySeconds, rows } of timing.sets) {
    assert.deepEqual(
      rows.map((row) => row[0]),
      ids,
    );
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(projects.get(true), id);
      assert.equal(manifest.simulationIdentity, identity, id);
      assert.deepEqual(segments[0], [null, Math.round(delaySeconds / FIXED_DT)]);
      const options = { seed: timing.seed, classId: 'scout', turnPolicy: timing.turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(
          manifest.level,
          options,
          'timing-feasibility-not-human-validation',
        );
      for (const [direction, ticks] of segments) {
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let n = 0; n < ticks; n++) {
          assert.equal(run.status, 'running', id);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, 3, `${id}/${delaySeconds}: no loss, including during idle`);
        }
      }
      assert.equal(run.status, 'won', id);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, id);
      assert.equal(replay.state.status, 'won', id);
    }
  }
});
