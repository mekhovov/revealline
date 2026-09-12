import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadHomewardPack, verifyHomewardRoutes } from '../../scripts/verify-homeward.mjs';
import { buildHomewardPack } from '../../scripts/build-homeward-pack.mjs';
import { replaySpecialtyRoute } from '../../scripts/verify-specialty.mjs';
import { preparePack, scenarioFromPack } from '../packs.mjs';

const pack = await loadHomewardPack();
const proof = JSON.parse(
  await readFile(new URL('../replays/homeward-routes.json', import.meta.url), 'utf8'),
);

test('Homeward proves useful equipment interactions and every class in both turning modes', async () => {
  const result = await verifyHomewardRoutes();
  assert.equal(result.verified, 52);
  assert.equal(result.roleClears, 6);
  assert.equal(result.fallbackClears, 42);
  assert.equal(result.actionOmissionComparisons, 4);
  for (const level of pack.campaigns[0].levels)
    for (const recipe of pack.classRecipes)
      for (const turnPolicy of ['immediate', 'grid-center'])
        assert.ok(
          proof.routes.some(
            (route) =>
              route.variant === 'fallback' &&
              route.levelId === level.id &&
              route.classId === recipe.id &&
              route.turnPolicy === turnPolicy &&
              route.expected.won &&
              route.expected.lives === 3,
          ),
        );
});

test('three reward slots embed exact distinct original PNG bytes with retained source attribution', async () => {
  const { pack: built, report } = await buildHomewardPack();
  assert.equal(report.backgrounds.length, 3);
  assert.equal(new Set(report.backgrounds.map((entry) => entry.sha256)).size, 3);
  assert.ok(report.encodedPackBytes < 24 * 1024 * 1024);
  for (const entry of report.backgrounds) {
    const background = built.levelVisuals.find((visual) => visual.levelId === entry.levelId)
      .visualOverrides.background;
    const bytes = Buffer.from(background.dataUrl.split(',')[1], 'base64');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(entry.width * 3, entry.height * 4);
    assert.equal(background.fit, 'contain');
    assert.match(background.metadata.author, /AI-assisted/);
    assert.match(background.metadata.rightsStatus, /Original AI-generated/);
  }
});

test('prepared pack routes each picture and music descriptor to its own mission with all classes selectable', async () => {
  const decodedScopes = [];
  // Adapter double tests dispatch; real image decoding is a separate browser release check.
  const prepared = await preparePack(pack, {
    decodeImage: async (_dataUrl, context) => {
      decodedScopes.push(context.scope);
      return { naturalWidth: 1448, naturalHeight: 1086 };
    },
  });
  assert.equal(new Set(decodedScopes).size, 3);
  assert.equal(prepared.pack.campaigns[0].classIds, undefined);
  for (const level of prepared.pack.campaigns[0].levels) {
    assert.match(level.metadata.description, /^Recommended:/);
    for (const recipe of prepared.pack.classRecipes) {
      const scenario = scenarioFromPack(prepared.pack, 'homeward-skies', level.id, {
        classId: recipe.id,
        turnPolicy: 'grid-center',
      });
      assert.equal(scenario.settings.classId, recipe.id);
      assert.equal(scenario.music.id, level.musicId);
      assert.equal(scenario.visualOverrides.background.name, level.name);
      assert.equal(
        scenario.visualOverrides.background.dataUrl,
        pack.levelVisuals.find((visual) => visual.levelId === level.id).visualOverrides.background
          .dataUrl,
      );
    }
  }
});

test('Homeward role proof rejects a missing recovery action and changed encounter content', () => {
  const route = proof.routes.find(
    (entry) => entry.classId === 'impact' && entry.variant === 'specialty',
  );
  const omitted = structuredClone(route);
  for (const segment of omitted.segments) segment.input.action = false;
  assert.throws(() => replaySpecialtyRoute(pack, omitted));
  const changed = structuredClone(pack);
  changed.campaigns[0].levels[2].enemies[0].vx = 0;
  assert.throws(() => replaySpecialtyRoute(changed, route), /map changed/);
});
