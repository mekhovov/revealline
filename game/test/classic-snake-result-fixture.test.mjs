import { CLASSIC_SNAKE_CAMPAIGN_REVISION } from '../snake/classic-campaign.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { resolveClassicSnakeRecipeEntry } from '../snake/classic-catalogue-archive.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  prepareSnakeResultFixture,
  storeSnakeResultFixture,
} from './manual/snake-result-fixture.mjs';
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
    const setup = {
      pace: 'normal',
      format: 'campaign',
      targetRules: 'authored',
      preset: 'classic',
    };
    const entry = resolveClassicSnakeRecipeEntry(
      CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === replay.level.id),
      replay.level,
      setup,
      { allowArchive: false },
    );
    const match = restoreClassicSnakeMatch(prepared.session.match, {
      level: prepareClassicSnakeLevel(entry, setup),
    });
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

test('result fixture follows current campaign storage and protects unowned current and legacy saves', () => {
  const saveKey = `revealline.classic-snake.round.${CLASSIC_SNAKE_CAMPAIGN_REVISION}`;
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  for (const key of [
    saveKey,
    'revealline.classic-snake.round.v2',
    'revealline.classic-snake.round.v1',
  ]) {
    memory.clear();
    memory.set(key, 'player save');
    assert.throws(
      () => storeSnakeResultFixture(storage, { levelId: 'review' }),
      /Existing Snake profile/,
    );
    assert.deepEqual([...memory], [[key, 'player save']]);
  }
  memory.clear();
  storeSnakeResultFixture(storage, { levelId: 'review' });
  assert.deepEqual(JSON.parse(memory.get(saveKey)), { levelId: 'review' });
  storeSnakeResultFixture(storage, { levelId: 'second review' });
  assert.deepEqual(JSON.parse(memory.get(saveKey)), { levelId: 'second review' });
});
