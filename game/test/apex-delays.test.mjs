import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApexCandidates } from '../content-design/apex-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const project = compileContentProject(createApexCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/apex-delay-routes.json', import.meta.url)),
);

test('Returning light rejects the five-second keeper collision; a later departure is a deliberate alternative', () => {
  const level = resolveMission(project, 'returning-light').level;
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  while (run.tick < 1000 && !run.classic.livesLost) {
    const input = { direction: run.tick < 600 ? null : 'right' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
  }
  assert.equal(run.tick, 867);
  assert.equal(run.status, 'respawning');
  assert.equal(run.classic.livesLost, 1);
  assert.equal(run.claimedCount, 0);
  const failure = run.events.find((event) => event.type === 'player.failed');
  assert.equal(failure.cause, 'enemy-trail');
  assert.equal(failure.actorId, 'keeper');
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const accepted = fixture.sets
    .find((set) => set.delaySeconds === 5)
    .rows.find((row) => row[0] === 'returning-light');
  assert.deepEqual(accepted[3].slice(0, 2), [
    [null, 600],
    [null, 180],
  ]);
});
test('Apex delayed routes cover five waits and every candidate', () => {
  assert.equal(fixture.format, 'ApexDelayedRoutesV1');
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
  test(`Apex Aurora no-loss full clears after ${delaySeconds}s idle: Standard/immediate`, () => {
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
          assert(
            run.classic.powerups.every((p) => p.collectedTick === null),
            id,
          );
          closures += run.events.filter((event) => event.type === 'cut.closed').length;
          for (const gate of run.relay.gates)
            if (
              gate.openedTick !== null &&
              gate.cells.includes(Math.floor(run.player.y) * run.width + Math.floor(run.player.x))
            )
              used.add(gate.id);
          if (!run.encounter && run.coverage >= manifest.level.goal.coverage)
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
