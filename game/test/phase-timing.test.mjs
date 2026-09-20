import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPhaseCandidates } from '../content-design/phase-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const project = compileContentProject(createPhaseCandidates());
const timing = JSON.parse(
  await readFile(new URL('./fixtures/phase-timing-routes.json', import.meta.url)),
);

test('all seven Phaseworks candidates allow legal clears after five sampled decision delays', () => {
  assert.equal(timing.format, 'PhaseTimingFeasibilityRoutesV1');
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

test('Seven delayed departure failures remain replayable, while idle itself is safe', () => {
  assert.equal(timing.rejectedOpenings.length, 7);
  for (const row of timing.rejectedOpenings) {
    assert(
      ['return-in-reserve', 'two-ways-home', 'crossed-bands', 'pressure-ladder'].includes(
        row.missionId,
      ),
    );
    assert([0.25, 0.5, 1, 2, 5].includes(row.delaySeconds));
    const manifest = resolveMission(project, row.missionId);
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const options = { seed: timing.seed, classId: 'scout', turnPolicy: timing.turnPolicy };
    const run = createRun(manifest.level, options),
      recorder = createRecorder(manifest.level, options, 'retained-unsafe-departure-evidence');
    for (const [direction, ticks] of row.segments)
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(run.status, 'running');
        recordInput(recorder, { direction });
        stepRun(run, { direction }, FIXED_DT);
        if (direction === null)
          assert.equal(run.classic.livesLost, 0, 'decision time itself stays safe');
      }
    assert.equal(run.status, 'respawning');
    assert.equal(run.status, row.status);
    assert.equal(run.lives, 2);
    assert.equal(run.lives, row.lives);
    assert.equal(run.classic.livesLost, 1);
    const failure = run.events.find((event) => event.type === 'player.failed');
    assert.equal(
      failure?.cause,
      row.missionId === 'crossed-bands' ? 'enemy-player' : 'enemy-trail',
    );
    assert.equal(failure.actorId, row.missionId === 'return-in-reserve' ? 'carrier' : 'frontier');
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  }
});
