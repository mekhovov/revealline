import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRoverCandidates } from '../content-design/rover-candidates.mjs';
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

const project = compileContentProject(createRoverCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/rover-clear-routes.json', import.meta.url)),
);

test('rejected dormant-only practice clears preserve the original negative design evidence', async () => {
  const rejected = JSON.parse(
    await readFile(new URL('./fixtures/rover-rejected-dormant-clears.json', import.meta.url)),
  );
  assert.equal(rejected.rows.length, 2);
  const oldSource = createRoverCandidates();
  for (const [id, x, y] of [
    ['stepped-return', 15.5, 17.5],
    ['broken-yard', 12.5, 24.5],
  ]) {
    const mission = oldSource.missions.find((candidate) => candidate.id === id);
    mission.revision = 'greybox-1';
    mission.map.revision = 'greybox-1';
    oldSource.maps.find((map) => map.id === mission.map.id).revision = 'greybox-1';
    Object.assign(
      mission.actors.find((actor) => actor.id === 'sleeper'),
      { x, y, heading: [1, 0] },
    );
  }
  const oldProject = compileContentProject(oldSource);
  for (const row of rejected.rows) {
    const manifest = resolveMission(oldProject, row.id, { difficulty: row.difficulty });
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    const run = createRun(manifest.level, {
      seed: 1,
      classId: 'scout',
      turnPolicy: row.turnPolicy,
    });
    const roamer = run.enemies.find((actor) => actor.id === 'sleeper');
    for (const { direction, ticks } of row.segments)
      for (let tick = 0; tick < ticks; tick++) {
        stepRun(run, { direction }, FIXED_DT);
        assert.notEqual(roamer.classic.mode, 'active');
      }
    assert.equal(run.status, 'won');
    assert.equal(run.classic.livesLost, 0);
    assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    assert.notEqual(resolveMission(project, row.id).simulationIdentity, row.simulationIdentity);
  }
});

test('Rover complete-route fixtures cover every mission, preset and steering policy exactly once', () => {
  assert.equal(fixture.format, 'RoverFeasibilityRoutesV1');
  const expected = ['gentle', 'standard', 'expert'].flatMap((difficulty) =>
    ['immediate', 'grid-center'].map((turnPolicy) => `${difficulty}/${turnPolicy}`),
  );
  assert.deepEqual(
    fixture.sets.map((s) => `${s.difficulty}/${s.turnPolicy}`).sort(),
    expected.sort(),
  );
  for (const set of fixture.sets)
    assert.deepEqual(
      set.rows.map((r) => r[0]),
      project.missions.map((m) => m.id),
    );
});

for (const { difficulty, turnPolicy, rows } of fixture.sets) {
  test(`Rover legal no-loss Solo clears and public replay verification: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(project, id, { difficulty });
      assert.equal(manifest.simulationIdentity, identity, `${id}: stale identity`);
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(
        manifest.level,
        options,
        'greybox-feasibility-not-human-validation',
      );
      const denominator = run.totalClaimable;
      assert(Number.isSafeInteger(denominator) && denominator > 0);
      for (const [direction, ticks] of segments) {
        assert(['up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${id}: input after completion`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${id}: life loss`);
          assert.equal(run.totalClaimable, denominator, `${id}: denominator changed`);
        }
      }
      assert.equal(run.status, 'won', id);
      assert.equal(run.lives, manifest.level.rules.lives, id);
      assert(run.coverage >= manifest.level.goal.coverage, id);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, id);
      assert.equal(replay.state.status, 'won', id);
    }
  });

  test(`Rover untimed paired boards remain independent and equal through completion: ${difficulty}/${turnPolicy}`, () => {
    for (const [id, identity, , segments] of rows) {
      const manifest = resolveMission(project, id, { mode: 'versus', difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      const match = createDuel(
        manifest.level,
        { seed: 1, classId: 'scout', turnPolicy },
        { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
      );
      assert.notEqual(match.runs[0].cells, match.runs[1].cells);
      assert.notEqual(match.runs[0].foundation.permanent, match.runs[1].foundation.permanent);
      resumeDuel(match);
      for (const [direction, ticks] of segments)
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(match.status, 'running', id);
          stepDuel(match, [{ direction }, { direction }]);
        }
      assert.equal(match.status, 'finished', id);
      assert.equal(match.reason, 'First clear', id);
      assert.equal(match.winner, null, id);
      for (const run of match.runs) {
        assert.equal(run.status, 'won', id);
        assert.equal(run.classic.livesLost, 0, id);
        assert.equal(run.lives, manifest.level.rules.lives, id);
      }
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        id,
      );
    }
  });
}
