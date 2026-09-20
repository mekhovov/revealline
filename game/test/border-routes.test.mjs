import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createDuel, resumeDuel, stepDuel } from '../multiplayer.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';

const fixture = JSON.parse(
  await readFile(new URL('./fixtures/border-clear-routes.json', import.meta.url)),
);
const projects = new Map(
  [true, false].map((bonuses) => {
    const source = createBorderCandidates();
    if (!bonuses) for (const mission of source.missions) mission.bonuses = [];
    return [bonuses, compileContentProject(source)];
  }),
);

test('Border route evidence covers every candidate, preset, steering policy and optional-bonus condition exactly once', () => {
  assert.equal(fixture.format, 'BorderFeasibilityRoutesV1');
  const expected = [];
  for (const bonuses of [true, false])
    for (const difficulty of ['gentle', 'standard', 'expert'])
      for (const turnPolicy of ['immediate', 'grid-center'])
        expected.push(`${bonuses}/${difficulty}/${turnPolicy}`);
  assert.deepEqual(
    fixture.sets.map((row) => `${row.bonuses}/${row.difficulty}/${row.turnPolicy}`),
    expected,
  );
  for (const set of fixture.sets)
    assert.deepEqual(
      set.rows.map((row) => row[0]),
      projects.get(set.bonuses).missions.map((mission) => mission.id),
    );
});

for (const { bonuses, difficulty, turnPolicy, rows } of fixture.sets) {
  const label = `${difficulty}/${turnPolicy}/${bonuses ? 'authored-bonuses' : 'no-bonuses'}`;
  test(`Border complete Solo routes and exported replays: ${label}`, () => {
    for (const [id, identity, checkpoint, segments] of rows) {
      const manifest = resolveMission(projects.get(bonuses), id, { difficulty });
      assert.equal(
        manifest.simulationIdentity,
        identity,
        `${id}: renew route evidence after content changes`,
      );
      const options = { seed: 1, classId: 'scout', turnPolicy };
      const run = createRun(manifest.level, options);
      const recorder = createRecorder(
        manifest.level,
        options,
        'greybox-feasibility-not-human-validation',
      );
      for (const [direction, ticks] of segments) {
        assert(Number.isSafeInteger(ticks) && ticks > 0 && ticks <= 1000);
        for (let tick = 0; tick < ticks; tick++) {
          assert.equal(run.status, 'running', `${id}: route continues beyond completion`);
          recordInput(recorder, { direction });
          stepRun(run, { direction }, FIXED_DT);
          assert.equal(run.lives, manifest.level.rules.lives, `${id}: route lost a life`);
        }
      }
      assert.equal(run.status, 'won', id);
      assert(run.coverage >= manifest.level.goal.coverage, id);
      assert.equal(authoritativeCheckpoint(run).hash, checkpoint, id);
      const replay = verifyReplay(exportReplay(recorder, run));
      assert.equal(replay.match, true, `${id}: exported replay mismatch`);
      assert.equal(replay.state.status, 'won', id);
      if (!bonuses) assert.equal(run.classic.powerups.length, 0);
    }
  });
  test(`Border paired-board complete route equality: ${label}`, () => {
    for (const [id, identity, , segments] of rows) {
      const manifest = resolveMission(projects.get(bonuses), id, { mode: 'versus', difficulty });
      assert.equal(manifest.simulationIdentity, identity, id);
      const match = createDuel(manifest.level, { seed: 1, classId: 'scout', turnPolicy });
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
      assert.equal(match.winner, null, `${id}: simultaneous clears should draw`);
      assert(
        match.runs.every((run) => run.status === 'won' && run.lives === manifest.level.rules.lives),
        id,
      );
      assert.deepEqual(
        authoritativeCheckpoint(match.runs[0]),
        authoritativeCheckpoint(match.runs[1]),
        id,
      );
    }
  });
}
