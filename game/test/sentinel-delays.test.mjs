import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSentinelCandidates } from '../content-design/sentinel-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../replay.mjs';

const project = compileContentProject(createSentinelCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/sentinel-delay-routes.json', import.meta.url)),
);
test('Sentinel delayed routes cover five waits and every candidate', () => {
  assert.equal(fixture.format, 'SentinelDelayedRoutesV1');
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
  test(`Sentinel Crown no-loss full clears after ${delaySeconds}s idle: Standard/immediate`, () => {
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty: fixture.difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      assert.deepEqual(segments[0], [null, delaySeconds / FIXED_DT], id);
      const options = { seed: 1, classId: 'scout', turnPolicy: fixture.turnPolicy };
      const run = createRun(manifest.level, options),
        recorder = createRecorder(manifest.level, options);
      const denominator = run.totalClaimable;
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
          if (!run.encounter.defeated) assert.notEqual(run.status, 'won', id);
        }
      }
      assert.equal(run.status, 'won', id);
      assert(closures >= 2, id);
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

test('First relay three-second immediate departure is a real warned failure, not accepted delay evidence', () => {
  const level = resolveMission(project, 'first-relay').level;
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  let warning = false;
  for (let tick = 0; tick < 600 && !run.classic.livesLost; tick++) {
    const input = { direction: tick < 360 ? null : 'down' };
    recordInput(recorder, input);
    stepRun(run, input, FIXED_DT);
    if (run.encounter.phase === 'warning') warning = true;
  }
  assert(warning);
  assert.equal(run.tick, 481);
  assert.equal(run.encounter.phase, 'active');
  assert.equal(run.classic.livesLost, 1);
  assert.equal(run.claimedCount, 0);
  assert.equal(run.score, 0);
  assert(run.objectives.every((objective) => !objective.captured));
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  const accepted = fixture.sets
    .find((set) => set.delaySeconds === 3)
    .rows.find((row) => row[0] === 'first-relay');
  assert.deepEqual(
    accepted[3].slice(0, 2),
    [
      [null, 360],
      [null, 240],
    ],
    'The accepted alternative reads the warning and waits before departure.',
  );
});
