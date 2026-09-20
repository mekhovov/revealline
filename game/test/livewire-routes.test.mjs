import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLivewireCandidates } from '../content-design/livewire-candidates.mjs';
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

const project = compileContentProject(createLivewireCandidates());
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/livewire-clear-routes.json', import.meta.url)),
);

test('Livewire Foundry full-clear fixtures cover all seven missions and six preset/control pairs', () => {
  assert.equal(fixture.format, 'LivewireFeasibilityRoutesV1');
  assert.deepEqual(
    fixture.sets.map((s) => `${s.difficulty}/${s.turnPolicy}`).sort(),
    ['gentle', 'standard', 'expert']
      .flatMap((difficulty) =>
        ['immediate', 'grid-center'].map((policy) => `${difficulty}/${policy}`),
      )
      .sort(),
  );
  for (const set of fixture.sets)
    assert.deepEqual(
      set.rows.map((row) => row[0]),
      project.missions.map((m) => m.id),
    );
});

for (const { difficulty, turnPolicy, rows } of fixture.sets) {
  test(`Livewire Foundry legal Solo clears, no quota cleanup, and public replays: ${difficulty}/${turnPolicy}`, () => {
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
      let closures = 0,
        warnings = 0;
      for (const [direction, ticks] of segments) {
        assert([null, 'up', 'down', 'left', 'right'].includes(direction));
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${id}: input after completion`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.classic.livesLost, 0, `${id}: life loss`);
          assert.equal(run.totalClaimable, denominator, `${id}: denominator changed`);
          if (run.events.some((event) => event.type === 'cut.closed')) closures++;
          if (run.events.some((event) => event.type === 'boss.warning')) warnings++;
          if (run.coverage >= manifest.level.goal.coverage)
            assert(
              run.objectives.every((objective) => !objective.required || objective.captured),
              `${id}: quota reached before required anchors`,
            );
        }
      }
      assert.equal(run.status, 'won', id);
      assert.equal(run.lives, manifest.level.rules.lives, id);
      assert(run.coverage >= manifest.level.goal.coverage, id);
      assert(closures >= 2, `${id}: not a one-cut clear`);
      if (id === 'read-the-lock') assert(warnings > 0, `${id}: lane lesson must actually occur`);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, id);
      assert.equal(replay.state.status, 'won', id);
    }
  });

  test(`Livewire Foundry equal independent untimed paired-board clears: ${difficulty}/${turnPolicy}`, () => {
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
