import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareSnakeResultFixture } from './manual/snake-result-fixture.mjs';
import {
  restoreClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
} from '../snake/classic-match.mjs';

test('result fixture is a verified unfinished journal prefix and only the next accepted move completes it', async () => {
  const solo = JSON.parse(
    await readFile(
      new URL(
        '../../docs/verification/classic-snake/authored-open-loop.replay.json',
        import.meta.url,
      ),
    ),
  );
  const { proofs } = JSON.parse(
    await readFile(new URL('./fixtures/classic-snake-v4-proofs.json', import.meta.url)),
  );
  for (const mode of ['solo', 'team', 'versus']) {
    const replay =
      mode === 'team'
        ? proofs.find(
            (p) =>
              p.levelId === 'classic-field-quiet-channel' &&
              p.mode === 'team' &&
              p.pace === 'normal',
          ).replay
        : solo;
    const prepared = prepareSnakeResultFixture(replay, { mode });
    const match = restoreClassicSnakeMatch(prepared.session.match);
    assert.equal(match.status, 'running');
    assert.equal(match.runs[0].tick, replay.steps - 1);
    for (const turn of prepared.finalTurns)
      for (const player of mode === 'versus' ? [0, 1] : [turn.playerId])
        assert.ok(queueClassicSnakeMatchTurn(match, player, turn.direction));
    advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
    assert.equal(match.status, 'finished');
    assert.equal(match.result, mode === 'versus' ? 'draw' : 'won');
  }
});
