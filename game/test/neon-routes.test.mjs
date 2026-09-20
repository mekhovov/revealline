import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNeonCandidates } from '../content-design/neon-candidates.mjs';
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

const project = compileContentProject(createNeonCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/neon-clear-routes.json', import.meta.url)),
);

test('Inside out keeps the lower approach occupied instead of repeating the rejected two-cut clear', async () => {
  const rejected = JSON.parse(
    await readFile(new URL('./fixtures/neon-rejected-bypass.json', import.meta.url)),
  );
  assert.equal(rejected.sets.length, 6);
  assert.equal(project.missions.find((m) => m.id === 'inside-out').revision, 'greybox-2');
  for (const { difficulty, turnPolicy, segments } of rejected.sets) {
    const manifest = resolveMission(project, 'inside-out', { difficulty });
    const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
    for (const [direction, ticks] of segments)
      for (let tick = 0; tick < ticks; tick++) stepRun(run, { direction }, FIXED_DT);
    assert.equal(run.status, 'running', `${difficulty}/${turnPolicy}`);
    assert.equal(
      run.classic.livesLost,
      0,
      'The old route is still legal, just no longer a trivial clear.',
    );
    assert(run.coverage < manifest.level.goal.coverage);
  }
});

test('Neon complete-route fixtures cover every mission, preset and steering policy exactly once', () => {
  assert.equal(fixture.format, 'NeonFeasibilityRoutesV1');
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
  test(`Neon legal no-loss Solo clears and public replay verification: ${difficulty}/${turnPolicy}`, () => {
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

  test(`Neon untimed paired boards remain independent and equal through completion: ${difficulty}/${turnPolicy}`, () => {
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
