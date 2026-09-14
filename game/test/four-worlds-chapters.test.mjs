import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import {
  readOriginalChapters,
  buildOriginalChapters,
  ROOT,
  CHAPTER_ROOT,
  packFile,
  sha,
  distributionFor,
} from '../../authoring/library/four-worlds-chapters/build.mjs';
import { decodeOriginalPNG } from '../../authoring/library/four-worlds-chapters/verify-images.mjs';
import { verifyFourWorlds, PROOF_FILE } from '../../scripts/verify-four-worlds.mjs';
import { readBuildConfig, collectBuildFiles, crc32 } from '../../scripts/game-cli.mjs';
import {
  preparePack,
  importPackLibrary,
  exportPackLibrary,
  installPack,
  removePack,
  PACK_LIMITS,
  scenarioFromPack,
} from '../packs.mjs';
import { prepareScenario } from '../imports.mjs';
import { campaignKey } from '../library.mjs';

const source = await readOriginalChapters();
const proof = JSON.parse(await readFile(path.join(ROOT, PROOF_FILE), 'utf8'));
const preparedPacks = [];
const decodeImage = async (url) => decodeOriginalPNG(url);
for (const pack of source.packs)
  preparedPacks.push((await preparePack(pack, { decodeImage })).pack);

test('four optional theme chapters compile all twelve exact originals with distinct contexts and unchanged gameplay', async () => {
  await buildOriginalChapters();
  const distribution = JSON.parse(
    await readFile(path.join(ROOT, CHAPTER_ROOT, 'distribution.json'), 'utf8'),
  );
  assert.deepEqual(distribution, distributionFor(source));
  assert.equal(distribution.combinedLibraryBytes, 44439900);
  assert.equal(distribution.distinctImages, 12);
  assert.equal(distribution.distinctReusedGeometries, 3);
  assert.equal(
    new Set(
      source.packs.map((p) => campaignKey({ ...p.campaigns[0], classRecipes: p.classRecipes })),
    ).size,
    4,
  );
  assert.deepEqual(
    source.packs.map((p) => p.themes[0].id),
    ['fpv', 'ukraine', 'retro', 'coupa'],
  );
  assert.equal(source.recipe.chapters[1].sourceTheme, 'heritage');
  const used = new Set();
  for (const [packIndex, pack] of preparedPacks.entries()) {
    const original = source.packs[packIndex];
    assert.equal(pack.format, 'xonix-pack.v5');
    assert.equal(pack.engine, 'xonix-core.v5');
    assert.deepEqual(pack.masteries, []);
    assert.deepEqual(pack.music, source.prior.music);
    assert.deepEqual(
      pack.classRecipes.map(({ label: _label, description: _description, ...r }) => r),
      source.prior.classRecipes.map(({ label: _label, description: _description, ...r }) => r),
    );
    for (const [i, level] of pack.campaigns[0].levels.entries()) {
      const { id, name: _name, metadata: _metadata, themeId: _themeId, ...rules } = level;
      const {
        id: _priorId,
        name: _priorName,
        metadata: _priorMetadata,
        themeId: _priorThemeId,
        ...priorRules
      } = source.prior.campaigns[0].levels[i];
      assert.deepEqual(rules, priorRules);
      assert.equal(level.rules.stopOnCapture, true);
      assert.equal(level.classic.arcadeActions.version, 'arcade-actions.v1');
      const selected = scenarioFromPack(pack, pack.campaigns[0].id, id);
      const scenario = (await prepareScenario(selected, { decodeImage })).scenario;
      assert.equal(scenario.format, 'xonix-playground.v5');
      assert.equal(scenario.masteryDefinition, null);
      assert.equal(scenario.theme.id, pack.themes[0].id);
      const picture = source.images.get(source.recipe.chapters[packIndex].maps[i].imageId);
      assert.equal(scenario.visualOverrides.background.dataUrl, picture.dataUrl);
      assert.equal(scenario.visualOverrides.background.fit, 'contain');
      const decoded = decodeOriginalPNG(picture.dataUrl);
      assert.equal(decoded.pixelBytes, 1774 * 887 * 3);
      const bytes = Buffer.from(picture.dataUrl.slice(22), 'base64');
      assert.deepEqual(bytes, await readFile(path.join(ROOT, picture.record.source)));
      assert.equal(sha(bytes), picture.record.sha256);
      used.add(sha(bytes));
      assert.equal(id, original.levelVisuals[i].levelId);
    }
  }
  assert.equal(used.size, 12);
});

test('all four original packs fit the existing installed limit; an extra illustrated edition refuses without eviction', async () => {
  const bytes = JSON.stringify({ format: 'xonix-pack-library.v1', packs: preparedPacks });
  assert.equal(PACK_LIMITS.maxBytes, 24 * 1024 * 1024);
  assert.equal(PACK_LIMITS.libraryBytes, 48 * 1024 * 1024);
  assert.ok(Buffer.byteLength(bytes) < PACK_LIMITS.libraryBytes);
  for (const pack of source.packs)
    assert.ok((await readFile(path.join(ROOT, packFile(pack.id)))).length < PACK_LIMITS.maxBytes);
  const installed = await importPackLibrary(bytes, { decodeImage });
  assert.equal(exportPackLibrary(installed), bytes);
  // R5's older PNGs use the existing imported-image header boundary here; these
  // exact bytes are pinned by the builder. They are not part of the new RGB decode claim.
  const old = (
    await preparePack(source.prior, {
      decodeImage: async () => ({ naturalWidth: 1774, naturalHeight: 887 }),
    })
  ).pack;
  assert.throws(() => installPack(installed, old), /byte budget/);
  assert.equal(exportPackLibrary(installed), bytes);
  const explicitRemoval = removePack(installed, 'original-ukraine-atlas');
  const added = installPack(explicitRemoval, old);
  assert.equal(added.packs.length, 4);
  assert.ok(added.packs.some((p) => p.id === old.id));
  let decoded = 0;
  const over = JSON.stringify({ format: 'xonix-pack-library.v1', packs: [...preparedPacks, old] });
  await assert.rejects(
    importPackLibrary(over, {
      decodeImage: async () => {
        decoded++;
        throw new Error('must not allocate');
      },
    }),
    /byte budget/,
  );
  assert.equal(decoded, 0);
  assert.equal(exportPackLibrary(installed), bytes);
});

test('optional pack files and raw originals stay outside every default build and index', async () => {
  const config = await readBuildConfig(ROOT),
    files = await collectBuildFiles(ROOT, config);
  const indexes = await Promise.all(
    ['index', 'archive-index'].map((name) =>
      readFile(path.join(ROOT, `game/content/packs/${name}.json`), 'utf8').then(JSON.parse),
    ),
  );
  for (const pack of source.packs) {
    assert.equal(files.includes(packFile(pack.id)), false);
    assert.equal(
      indexes.some((index) => index.packs.some((p) => p.id === pack.id)),
      false,
    );
  }
  assert.equal(
    files.some((file) => file.startsWith(`${CHAPTER_ROOT}/`)),
    false,
  );
  for (const image of source.images.values())
    assert.equal(files.includes(image.record.source), false);
  assert.equal(
    config.optionalOffline.length,
    6,
    'Arcade R5 joins the existing optional editions within the unchanged offline budget.',
  );
});

test('48 fresh wins resolve actual compiled art and verify pressure-phase save/restore in both difficulties and steering policies', async () => {
  const result = await verifyFourWorlds();
  assert.equal(result.routes.length, 48);
  assert.equal(result.imageFacts.length, 12);
  assert.equal(
    new Set(result.routes.map((r) => `${r.packId}/${r.difficulty}/${r.levelId}/${r.turnPolicy}`))
      .size,
    48,
  );
  assert.equal(new Set(result.imageFacts.map((r) => r.sha256)).size, 12);
  for (const route of result.routes) {
    assert.equal(route.status, 'won');
    assert.equal(route.livesLost, 0);
    assert.equal(route.savedContinuationVerified, true);
    assert.ok(route.savedTick > 0 && route.eventCounts['pressure.committed'] > 0);
  }
});

test('missing, duplicate, foreign and tampered art/rule/route/checkpoint candidates cannot borrow old verdicts', async () => {
  for (const mutate of [
    (c) => c.proof.routes.pop(),
    (c) => c.proof.routes.splice(1, 1, structuredClone(c.proof.routes[0])),
    (c) => {
      c.packs[0].levelVisuals[0].visualOverrides.background.dataUrl =
        c.packs[1].levelVisuals[0].visualOverrides.background.dataUrl;
    },
    (c) => {
      c.packs[0].campaigns[0].levels[0].rules.moveSpeed++;
    },
    (c) => {
      c.proof.routes[0].campaignKey = 'foreign';
    },
    (c) => {
      c.proof.routes[0].segments[0].input.boost = true;
    },
    (c) => {
      c.proof.routes[0].checkpoint.hash = 'invented';
    },
    (c) => {
      c.proof.routes[0].savePrefix.sessionSha256 = 'invented';
    },
  ]) {
    const candidate = structuredClone({ packs: source.packs, proof });
    mutate(candidate);
    await assert.rejects(verifyFourWorlds({ candidate }));
  }
  let reads = 0;
  const candidate = { packs: source.packs };
  Object.defineProperty(candidate, 'proof', {
    enumerable: true,
    get() {
      reads++;
      return proof;
    },
  });
  await assert.rejects(verifyFourWorlds({ candidate }));
  assert.equal(reads, 0);
});

function fixturePNG(filter, encoded) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]),
      result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length);
    body.copy(result, 4);
    result.writeUInt32BE(crc32(body), result.length - 4);
    return result;
  };
  const header = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 10, 20, 30, 40, 50, 60, filter, ...encoded]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
test('owned PNG verification decodes all five filters and rejects bad CRC/compressed pixels behind a valid header', () => {
  const pixelHash = sha(Buffer.from([10, 20, 30, 40, 50, 60, 12, 24, 36, 48, 60, 72]));
  const encodings = [
    [12, 24, 36, 48, 60, 72],
    [12, 24, 36, 36, 36, 36],
    [2, 4, 6, 8, 10, 12],
    [7, 14, 21, 22, 23, 24],
    [2, 4, 6, 8, 10, 12],
  ];
  for (let filter = 0; filter < 5; filter++) {
    const bytes = fixturePNG(filter, encodings[filter]);
    assert.equal(
      decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`).pixelsSha256,
      pixelHash,
    );
    const corrupt = Buffer.from(bytes);
    corrupt[45] ^= 1;
    assert.throws(
      () => decodeOriginalPNG(`data:image/png;base64,${corrupt.toString('base64')}`),
      /CRC/,
    );
  }
  const invalid = fixturePNG(5, encodings[0]);
  assert.throws(
    () => decodeOriginalPNG(`data:image/png;base64,${invalid.toString('base64')}`),
    /filter/,
  );
});
