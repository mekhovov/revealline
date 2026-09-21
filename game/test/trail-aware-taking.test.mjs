import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTimedBorderCandidates } from '../content-design/timed-border-candidates.mjs';
import { TIMED_BONUS_TRAIL_VERSION } from '../core/timed-bonuses.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { playTimedTakingRoute } from './helpers/timed-taking-evidence.mjs';

const old = JSON.parse(
  await readFile(new URL('./fixtures/timed-taking-routes.json', import.meta.url)),
);
const fixture = JSON.parse(
  await readFile(new URL('./fixtures/trail-aware-taking.json', import.meta.url)),
);
const key = (row) =>
  [row.policy, row.id, row.difficulty, row.turnPolicy, row.seed, row.purpose].join('/');
const projects = new Map(
  ['v1', 'v2'].map((policy) => {
    const source = createTimedBorderCandidates({ version: TIMED_BONUS_TRAIL_VERSION });
    return [
      policy,
      compileContentProject(policy === 'v2' ? withPressureDifficulty(source) : source),
    ];
  }),
);

test('trail-aware edition has exact evidence for all existing collection paths without duplicating inputs', () => {
  assert.equal(fixture.format, 'TrailAwareTakingEvidenceV1');
  assert.equal(fixture.rows.length, 112);
  assert.deepEqual(
    fixture.rows.map((row) => row.key),
    old.rows.map(key),
  );
  assert.equal(new Set(fixture.rows.map((row) => row.key)).size, 112);
  for (const policy of ['v1', 'v2'])
    assert.equal(
      old.rows.filter((row) => row.policy === policy && row.purpose === 'ordinary').length,
      54,
    );
});

for (const row of old.rows)
  test(`trail-aware collection/clear/replay/equal race: ${key(row)}`, () => {
    const pinned = fixture.rows.find((item) => item.key === key(row));
    const manifest = resolveMission(projects.get(row.policy), row.id, {
      difficulty: row.difficulty,
    });
    assert.equal(manifest.level.classic.timedBonuses.version, TIMED_BONUS_TRAIL_VERSION);
    assert.equal(manifest.simulationIdentity, pinned.simulationIdentity);
    assert.notEqual(manifest.simulationIdentity, row.simulationIdentity);
    const { observations } = playTimedTakingRoute(manifest.level, row);
    assert.equal(observations.checkpoint, pinned.checkpoint);
    assert.deepEqual(
      { ...observations, checkpoint: null },
      { ...row.observations, checkpoint: null },
    );
    const match = createDuel(
      manifest.level,
      { seed: row.seed, classId: 'scout', turnPolicy: row.turnPolicy },
      { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 },
    );
    assert.notEqual(match.runs[0].classic.timedBonuses, match.runs[1].classic.timedBonuses);
    resumeDuel(match);
    for (const { direction, ticks } of row.segments)
      for (let t = 0; t < ticks; t++) {
        assert.equal(match.status, 'running');
        stepDuel(match, [{ direction }, { direction }]);
        assert(match.runs.every((run) => run.classic.livesLost === 0));
      }
    assert.equal(match.status, 'finished');
    assert.equal(match.winner, null);
    assert(
      match.runs.every(
        (run) => run.status === 'won' && run.classic.timedBonuses.schedules[0].collections === 1,
      ),
    );
    assert.deepEqual(
      authoritativeCheckpoint(match.runs[0]),
      authoritativeCheckpoint(match.runs[1]),
    );
  });
