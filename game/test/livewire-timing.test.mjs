import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const project = compileContentProject(createLivewireCandidates());
const timing = JSON.parse(
  await readFile(new URL('./fixtures/livewire-timing-routes.json', import.meta.url)),
);

test('all seven Livewire Foundry candidates allow legal clears after five sampled decision delays', () => {
  assert.equal(timing.format, 'LivewireTimingFeasibilityRoutesV1');
  assert.equal(timing.seed, 1);
  assert.equal(timing.difficulty, 'standard');
  assert.equal(timing.turnPolicy, 'immediate');
  assert.deepEqual(
    timing.sets.map((s) => s.delaySeconds),
    [0.25, 0.5, 1, 2, 5],
  );
  for (const { delaySeconds, rows } of timing.sets) {
    assert.deepEqual(
      rows.map((r) => r[0]),
      project.missions.map((m) => m.id),
    );
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id);
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
        assert(direction === null || ['up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', id);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${id}/${delaySeconds}: includes idle period`);
          if (run.coverage >= manifest.level.goal.coverage)
            assert(
              run.objectives.every((o) => !o.required || o.captured),
              `${id}/${delaySeconds}: no quota cleanup`,
            );
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
