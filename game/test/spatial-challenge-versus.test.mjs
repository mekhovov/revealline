import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createSpatialChallengeJourney } from '../content-design/spatial-challenge-journey.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';

const project = compileContentProject(createSpatialChallengeJourney());
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/spatial-challenge-clear-routes.json', import.meta.url), 'utf8'),
);

for (const row of fixture.rows)
  test(`current gp4 equal paired boards: ${row.missionId}/${row.difficulty}/${row.turnPolicy}/seed${row.seed}`, () => {
    const manifest = resolveMission(project, row.missionId, {
      mode: 'versus',
      difficulty: row.difficulty,
    });
    const level = applyGameplayTuning(manifest.level, resolveGameplayTuning(row.difficulty));
    assert.equal(
      dataIdentity(level),
      row.levelIdentity,
      'Versus uses the qualified Solo conditions',
    );
    const duel = createDuel(
      level,
      { seed: row.seed, turnPolicy: row.turnPolicy, classId: 'scout' },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    assert.notEqual(duel.runs[0].cells, duel.runs[1].cells, 'Boards own separate mutable state');
    resumeDuel(duel);
    for (const [direction, ticks] of row.segments)
      for (let tick = 0; tick < ticks; tick++) {
        assert.equal(duel.status, 'running');
        stepDuel(duel, [{ direction }, { direction }]);
      }
    assert.equal(duel.status, 'finished');
    assert.equal(duel.winner, null, 'Equal input must never favor either seat');
    for (const run of duel.runs) {
      assert.equal(run.status, 'won');
      assert.equal(run.classic.livesLost, 0);
      assert.equal(run.tick, row.ticks);
      assert.equal(authoritativeCheckpoint(run).hash, row.checkpoint);
    }
    assert.deepEqual(authoritativeCheckpoint(duel.runs[0]), authoritativeCheckpoint(duel.runs[1]));
  });
