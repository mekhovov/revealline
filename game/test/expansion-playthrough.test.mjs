import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { expansionSources, verifyExpansionRoutes } from '../../scripts/verify-packs.mjs';
import { replayProof, digest } from '../../scripts/verify-campaign.mjs';
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
  const expected = packs.reduce(
    (total, pack) =>
      total + pack.campaigns.reduce((n, campaign) => n + campaign.levels.length * 2, 0),
    0,
  );
  const arcade = await expansionSources({ scope: 'arcade' });
  const pressure = await expansionSources({ scope: 'pressure' });
  const earlier = [...packs, ...arcade];
  const r4 = arcade.filter((pack) => !packs.some((old) => old.id === pack.id));
  assert.deepEqual(
    r4.map((pack) => pack.id),
    ['fpv-arcade-r4'],
  );
  const additional = pressure.filter((pack) => !earlier.some((old) => old.id === pack.id));
  assert.deepEqual(
    additional.map((pack) => pack.id),
    ['fpv-arcade-r5', 'fpv-pressure-frontier'],
  );
  const additionalRoutes = [...r4, ...additional].reduce(
    (total, pack) =>
      total + pack.campaigns.reduce((n, campaign) => n + campaign.levels.length * 2, 0),
    0,
  );
  const result = await verifyExpansionRoutes();
  assert.equal(result.verified, expected + additionalRoutes);
  assert.equal(result.verified, 70, 'All 35 indexed expansion maps have both Standard routes.');
  assert.equal(result.supplementalGentleVerified, 30);
  assert.equal(result.pressure.routes.length, 24);
  assert.equal(result.pressure.ordinaryProbes.length, 24);
  for (const batch of [packs, arcade, pressure])
    assert.ok(Buffer.byteLength(JSON.stringify(batch)) < 64 * 1024 * 1024);
  const route = proof.routes[0],
    pack = packs.find((item) => item.id === route.packId),
    level = structuredClone(pack.campaigns[0].levels[0]);
  level.rules.moveSpeed = 8;
  assert.throws(() => replayProof(level, pack.classRecipes, route), /content changed/);
});

test('workshop proof append preserves all 26 earlier entries and discovery metadata', () => {
  assert.equal(
    digest(proof.routes.slice(0, 26)),
    'b2aee528faa74c99468ab843c7cdb60fa0b17bc0c01789b242cc6cc5c6e4060a',
  );
  assert.equal(proof.examined, 1484);
  assert.equal(proof.simulatedTicks, 793832);
  const appended = proof.routes.slice(26).filter((route) => route.packId === 'equipment-workshop');
  assert.equal(appended.length, 6);
  for (const levelId of ['workshop-01', 'workshop-02', 'workshop-03'])
    assert.deepEqual(
      appended.filter((route) => route.levelId === levelId).map((route) => route.turnPolicy),
      ['immediate', 'grid-center'],
    );
});
