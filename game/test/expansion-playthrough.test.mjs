import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { expansionSources, verifyExpansionRoutes } from '../../scripts/verify-packs.mjs';
import { replayProof } from '../../scripts/verify-campaign.mjs';
const packs = await expansionSources();
const proof = JSON.parse(
  await readFile(new URL('../replays/expansion-routes.json', import.meta.url), 'utf8'),
);
for (const route of proof.routes)
  test(`expansion ${route.levelId} is completable using legal ${route.turnPolicy} input`, () => {
    const pack = packs.find((p) => p.id === route.packId),
      level = pack.campaigns.flatMap((c) => c.levels).find((l) => l.id === route.levelId);
    const summary = replayProof(level, pack.classRecipes, route);
    assert.deepEqual(summary, route.expected);
    assert.equal(summary.won, true);
    assert.equal(summary.lives, 3);
  });
test('expansion proof covers every supplied map and rejects altered geometry', async () => {
  assert.equal((await verifyExpansionRoutes()).verified, 26);
  const route = proof.routes[0],
    pack = packs[0],
    level = structuredClone(pack.campaigns[0].levels[0]);
  level.rules.moveSpeed = 8;
  assert.throws(() => replayProof(level, pack.classRecipes, route), /content changed/);
});
