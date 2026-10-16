// Authored boundary regressions; automatic execution is explicitly waived.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { classicSnakeSurvivalEntry, prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { createClassicSnakeMatch } from '../snake/classic-match.mjs';
import { reactionWarmupLineIds } from '../ui/contextual-reactions.mjs';
import { ACTOR_VOICE_RECORDINGS } from '../audio/reactions/actors.mjs';
import { REACTION_VOICE_PILOT } from '../audio/reactions/pilot.mjs';

test('survival selection admits the owned empty arena and rejects packages without one', () => {
  const empty = CLASSIC_SNAKE_LEVELS[0];
  const shield = CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === 'classic-living-shield-window');
  assert.equal(classicSnakeSurvivalEntry([shield]), null);
  assert.equal(classicSnakeSurvivalEntry([shield, empty]), empty);
  const match = createClassicSnakeMatch(prepareClassicSnakeLevel(empty, { format: 'endless' }), {
    mode: 'versus',
    policy: 'survival',
  });
  assert.equal(match.options.policy, 'survival');
});

test('current specialist voices precede shared pilot lines without downloading unrelated casts', () => {
  const originals = [...REACTION_VOICE_PILOT, ...ACTOR_VOICE_RECORDINGS];
  for (const locale of ['en', 'uk']) {
    const ids = reactionWarmupLineIds({ families: ['shield', 'brace'], originals, locale });
    assert.ok(ids.length <= 24);
    assert.deepEqual(ids.slice(0, 4), [
      'humanoid-actors.v1/shield-bearer/notice',
      'humanoid-actors.v1/shield-bearer/caught',
      'humanoid-actors.v1/brace-trooper/notice',
      'humanoid-actors.v1/brace-trooper/caught',
    ]);
    assert.ok(ids.includes(REACTION_VOICE_PILOT[0].lineId));
    assert.ok(!ids.some((id) => id.includes('/lookout/')));
    assert.ok(!ids.some((id) => id.includes('/runner/')));
  }
});
