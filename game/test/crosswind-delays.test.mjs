import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCrosswindCandidates } from '../content-design/crosswind-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const project = compileContentProject(createCrosswindCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/crosswind-delay-routes.json', import.meta.url)),
);
test('Crosswind delayed routes cover five waits and every candidate', () => {
  assert.equal(fixture.format, 'CrosswindDelayedRoutesV1');
  assert.equal(fixture.difficulty, 'standard');
  assert.equal(fixture.turnPolicy, 'immediate');
  assert.deepEqual(
    fixture.sets.map((set) => set.delaySeconds),
    [0.5, 1, 2, 3, 5],
  );
  for (const set of fixture.sets)
    assert.deepEqual(
      set.rows.map((row) => row[0]),
      project.missions.map((mission) => mission.id),
    );
});
for (const { delaySeconds, rows } of fixture.sets)
  test(`Crosswind Array no-loss full clears after ${delaySeconds}s idle: Standard/immediate`, () => {
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty: fixture.difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      assert.deepEqual(segments[0], [null, delaySeconds / FIXED_DT], id);
      const options = { seed: 1, classId: 'scout', turnPolicy: fixture.turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      const denominator = run.totalClaimable,
        used = new Set();
      let closures = 0;
      for (const [direction, ticks] of segments) {
        assert([null, 'up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${id}: early terminal`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${id}: life loss`);
          assert.equal(run.totalClaimable, denominator);
          closures += run.events.filter((event) => event.type === 'cut.closed').length;
          for (const gate of run.relay.gates)
            if (
              gate.openedTick !== null &&
              gate.cells.includes(Math.floor(run.player.y) * run.width + Math.floor(run.player.x))
            )
              used.add(gate.id);
          if (run.coverage >= manifest.level.goal.coverage)
            assert(
              run.objectives.every((objective) => !objective.required || objective.captured),
              `${id}: objective cleanup`,
            );
        }
      }
      assert.equal(run.status, 'won', id);
      assert(closures >= 2, id);
      assert(!run.relay.gates.length || used.size > 0, `${id}: no connector used`);
      assert(
        run.relay.gates.every((gate) => gate.openedTick !== null && gate.openedTick < run.tick),
        `${id}: late relay`,
      );
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, id);
      assert.equal(replay.state.status, 'won', id);
    }
  });
