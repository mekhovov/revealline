import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertExpansionCheckpoint } from './helpers/multiplayer-expansion-checkpoint.mjs';
import { createDuelExpansionCandidates } from '../content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import {
  createDuel,
  resumeDuel,
  pauseDuel,
  stepDuel,
  UNTIMED_DUEL_PROTOCOL,
} from '../multiplayer.mjs';
import { dataIdentity } from '../data-json.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const project = compileContentProject(createDuelExpansionCandidates());
const protocol = { protocol: UNTIMED_DUEL_PROTOCOL, seconds: 0 };
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center']) {
    test(`all 72 Duel ${difficulty}/${turnPolicy} routes draw equally and win from either seat`, async () => {
      const proof = JSON.parse(
        await readFile(
          new URL(
            `./fixtures/multiplayer-expansion/duel-${difficulty}-${turnPolicy}.json`,
            import.meta.url,
          ),
        ),
      );
      assert.equal(proof.rows.length, 72);
      assert.equal(new Set(proof.rows.map((row) => row.missionId)).size, 72);
      for (const row of proof.rows) {
        const authored = resolveMission(project, row.missionId, {
          mode: 'versus',
          difficulty,
        }).level;
        const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
        assert.equal(dataIdentity(authored), row.authoredIdentity, row.missionId);
        assert.equal(dataIdentity(level), row.tunedIdentity, row.missionId);
        assert.deepEqual(row.options, { seed: 17, classId: 'scout', turnPolicy });
        for (const seat of [null, 0, 1]) {
          const match = createDuel(level, row.options, protocol);
          resumeDuel(match);
          for (const segment of row.segments)
            for (let tick = 0; tick < segment.ticks; tick++) {
              const input = {
                direction: segment.direction,
                boost: false,
                action: false,
                pickup: false,
              };
              stepDuel(
                match,
                seat === null ? [input, input] : seat === 0 ? [input, {}] : [{}, input],
              );
            }
          assert.equal(match.status, 'finished', row.missionId);
          assert.equal(match.winner, seat, row.missionId);
          assert.equal(match.reason, 'First clear', row.missionId);
          assert.equal(match.tick, row.tick, row.missionId);
          if (seat === null) {
            assert.deepEqual(
              authoritativeCheckpoint(match.runs[0]),
              authoritativeCheckpoint(match.runs[1]),
              row.missionId,
            );
            assertExpansionCheckpoint('versus', match, row, `duel-${difficulty}-${turnPolicy}`);
          }
        }
      }
    });
  }

test('an environmental Duel resumes exact continuation and a rematch starts clean', async () => {
  const proof = JSON.parse(
    await readFile(
      new URL('./fixtures/multiplayer-expansion/duel-standard-immediate.json', import.meta.url),
    ),
  );
  const row = proof.rows.find((row) => row.missionId === 'versus-expedition-decider');
  const level = applyGameplayTuning(
    resolveMission(project, row.missionId, { mode: 'versus' }).level,
    resolveGameplayTuning('standard'),
  );
  const match = createDuel(level, row.options, protocol);
  const fresh = JSON.stringify(match);
  resumeDuel(match);
  for (const segment of row.segments) {
    const input = { direction: segment.direction, boost: false, action: false, pickup: false };
    for (let tick = 0; tick < segment.ticks; tick++) stepDuel(match, [input, input]);
    if (match.status === 'running') {
      pauseDuel(match, { preserveContinuation: true });
      const frozen = JSON.stringify(match);
      stepDuel(match, [input, input]);
      assert.equal(JSON.stringify(match), frozen);
      resumeDuel(match, { preserveContinuation: true });
    }
  }
  assertExpansionCheckpoint('versus', match, row, 'duel-standard-immediate');
  assert.equal(JSON.stringify(createDuel(level, row.options, protocol)), fresh);
});
