import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import {
  CLASSIC_RULES_CURRENT,
  projectClassicCurrentRulesEntry,
} from '../game/mission-library/classic-current-rules.mjs';
import { verifyNeonRoute, replayNeonRoute } from './verify-neon-routes.mjs';

const pack = JSON.parse(
  await readFile(new URL('../game/content/packs/neon-reference-pack.json', import.meta.url)),
);
const archive = JSON.parse(
  await readFile(
    new URL('../docs/qualification/neon-level-completion/winning-routes.json', import.meta.url),
  ),
);
const authored = pack.campaigns[0];
const original = {
  ...authored,
  classRecipes: pack.classRecipes.filter((r) => authored.classIds.includes(r.id)),
};
const { campaign } = createDifficultyContext(
  projectClassicCurrentRulesEntry({ campaign: original }, CLASSIC_RULES_CURRENT).campaign,
  'standard',
);
const level = campaign.levels[0];
const options = {
  seed: 1,
  turnPolicy: 'grid-center',
  classId: 'scout',
  classRecipes: campaign.classRecipes,
};
const receipt = archive.receipts.find(
  (r) =>
    r.packId === pack.id &&
    r.levelId === level.id &&
    r.difficulty === 'standard' &&
    r.options.turnPolicy === options.turnPolicy,
);

test('a retained Neon proof reproduces its current level and winning checkpoint', () => {
  assert.deepEqual(verifyNeonRoute(level, options, receipt), {
    levelId: level.id,
    turnPolicy: options.turnPolicy,
    status: 'won',
  });
});
test('Neon proof dispatch rejects changed level identity and execution options', () => {
  assert.throws(
    () => verifyNeonRoute({ ...level, revision: 'changed' }, options, receipt),
    /identity/,
  );
  assert.throws(() => verifyNeonRoute(level, { ...options, seed: 2 }, receipt), /options/);
});
test('Neon replay rejects missing, malformed and oversized input instead of searching for a win', () => {
  assert.throws(() => replayNeonRoute(level, options, []), /no longer wins/);
  for (const segments of [[['teleport', 1]], [['up', 0]], [['up', 216001]], [['up', 1, 'extra']]])
    assert.throws(() => replayNeonRoute(level, options, segments), /Invalid/);
});
