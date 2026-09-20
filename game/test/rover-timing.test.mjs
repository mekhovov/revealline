import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRoverCandidates } from '../content-design/rover-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url)));
const ordinary = await read('rover-clear-routes');
const supplemental = await read('rover-mastery-routes');
const timing = await read('rover-timing-routes');
const project = compileContentProject(createRoverCandidates());

test('all64 ordinary and supplemental Rover routes remain legal no-loss clears across five explicit seeds', () => {
  const routes = ordinary.sets
    .flatMap((set) =>
      set.rows.map(([missionId, simulationIdentity, , segments]) => ({
        missionId,
        simulationIdentity,
        segments,
        difficulty: set.difficulty,
        turnPolicy: set.turnPolicy,
      })),
    )
    .concat(supplemental.rows);
  assert.equal(routes.length, 64);
  let count = 0;
  for (const row of routes) {
    const manifest = resolveMission(project, row.missionId, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    for (const seed of [0, 1, 42, 2026, 0xffffffff]) {
      const run = createRun(manifest.level, { seed, classId: 'scout', turnPolicy: row.turnPolicy });
      const label = `${row.missionId}/${seed}/${row.difficulty}/${row.turnPolicy}`;
      for (const [direction, ticks] of row.segments)
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${label}: no input after completion`);
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, manifest.level.rules.lives, label);
        }
      assert.equal(run.status, 'won', label);
      assert.equal(run.classic.livesLost, 0, label);
      count++;
    }
  }
  assert.equal(count, 320);
});

test('every Rover greybox has a legal no-loss clear after each sampled initial decision delay', () => {
  assert.equal(timing.format, 'RoverTimingFeasibilityRoutesV1');
  assert.equal(timing.seed, 1);
  assert.equal(timing.difficulty, 'standard');
  assert.equal(timing.turnPolicy, 'immediate');
  assert.deepEqual(
    timing.sets.map((set) => set.delaySeconds),
    [0.25, 0.5, 1, 2, 5],
  );
  for (const { delaySeconds, rows } of timing.sets) {
    assert.deepEqual(
      rows.map((row) => row[0]),
      project.missions.map((m) => m.id),
    );
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id);
      assert.equal(manifest.simulationIdentity, identity, id);
      assert.deepEqual(segments[0], [null, Math.round(delaySeconds / FIXED_DT)]);
      const options = { seed: timing.seed, classId: 'scout', turnPolicy: timing.turnPolicy };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(
        manifest.level,
        options,
        'timing-feasibility-not-human-validation',
      );
      for (const [direction, ticks] of segments) {
        assert(direction === null || ['up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', id);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, 3, `${id}/${delaySeconds}: includes idle period`);
        }
      }
      assert.equal(run.status, 'won', id);
      assert.equal(run.classic.livesLost, 0, id);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, id);
      assert.equal(replay.state.status, 'won', id);
    }
  }
});

test('Two-second Open frequency delay needs a changed approach, not a promised safe default cut', () => {
  const row = timing.rejectedOpening;
  const manifest = resolveMission(project, row.missionId);
  assert.equal(manifest.simulationIdentity, row.simulationIdentity);
  assert.deepEqual(row.segments, [
    [null, 240],
    ['up', 67],
  ]);
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(manifest.level, options);
  const recorder = createRecorder(manifest.level, options, 'retained-unsafe-opening-evidence');
  for (const [direction, ticks] of row.segments)
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.status, 'running');
      recordInput(recorder, { direction });
      stepRun(run, { direction }, FIXED_DT);
      if (direction === null) assert.equal(run.lives, 3, 'Idle itself remains safe');
    }
  assert.equal(run.status, row.status);
  assert.equal(run.status, 'respawning');
  assert.equal(run.lives, row.lives);
  assert.equal(run.lives, 2);
  assert.equal(run.classic.livesLost, 1);
  assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
});
