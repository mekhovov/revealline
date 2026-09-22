import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  MISSION_LIBRARY_INDEX_FORMAT,
  MISSION_LIBRARY_INDEX_PATH,
  buildMissionLibraryIndex,
  generateMissionLibraryIndex,
  assertMissionLibraryIndex,
  assertMissionSourceBytes,
} from '../../scripts/mission-library-index.mjs';
import { readExternalDistributionEntries } from '../../scripts/external-distribution.mjs';
import { readPackIndexes, readPackJSON } from '../../scripts/pack-indexes.mjs';
import { PACK_LIMITS, preparePack } from '../packs.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { preparedPackIdentity } from '../mission-library/pack-identity.mjs';
import { campaignKey } from '../library.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
let expected, published, externalEntries;
before(async () => {
  externalEntries = await readExternalDistributionEntries(root, {
    format: 'revealline-external-distribution.v1',
    catalog: 'game/content/external-worlds.json',
  });
  expected = await buildMissionLibraryIndex({ root, externalEntries });
  published = JSON.parse(
    await readFile(new URL(`../../${MISSION_LIBRARY_INDEX_PATH}`, import.meta.url), 'utf8'),
  );
});

test('checked-in library reconciles with every retained authority and is deterministic', async () => {
  assert.equal(expected.format, MISSION_LIBRARY_INDEX_FORMAT);
  assert.deepEqual(published, expected);
  assert.deepEqual(await buildMissionLibraryIndex({ root, externalEntries }), expected);
  assert.equal((await generateMissionLibraryIndex({ root, externalEntries })).missions, 110);
  assert.equal(expected.missions.length, 110);
  assert.deepEqual(
    Object.fromEntries(
      ['base', 'bundled', 'archived', 'optional', 'external'].map((source) => [
        source,
        expected.missions.filter((row) => row.source === source).length,
      ]),
    ),
    {
      base: 12,
      bundled: 23,
      archived: 12,
      optional: 15,
      external: 48,
    },
  );
  assert.equal(new Set(expected.missions.map((row) => row.id)).size, 110);
});

test('base, active and archived campaigns preserve exact IDs, revisions, order and equipment identity', async () => {
  const indexes = await readPackIndexes(root);
  for (const entry of indexes.all) {
    const { value: pack } = await readPackJSON(
      root,
      `game/content/packs/${entry.path}`,
      PACK_LIMITS.maxBytes,
    );
    for (const campaign of pack.campaigns) {
      const rows = expected.missions.filter(
        (row) => row.packId === pack.id && row.campaignId === campaign.id,
      );
      const key = campaignKey({
        ...campaign,
        classRecipes: pack.classRecipes.filter(
          (recipe) => !campaign.classIds || campaign.classIds.includes(recipe.id),
        ),
      });
      assert.deepEqual(
        rows.map((row) => [row.levelId, row.levelRevision, row.levelIndex]),
        campaign.levels.map((level, index) => [level.id, level.revision, index]),
      );
      assert.ok(
        rows.every((row) => row.campaignKey === key && row.campaignRevision === campaign.revision),
      );
    }
  }
  const base = expected.missions.filter((row) => row.source === 'base');
  const { value: campaign } = await readPackJSON(
    root,
    'game/content/campaign.json',
    PACK_LIMITS.maxBytes,
  );
  const { value: classRecipes } = await readPackJSON(
    root,
    'game/content/classes.json',
    1024 * 1024,
  );
  assert.deepEqual(
    base.map((row) => [row.levelId, row.levelRevision, row.levelIndex]),
    campaign.levels.map((level, index) => [level.id, level.revision, index]),
  );
  assert.ok(base.every((row) => row.campaignKey === campaignKey({ ...campaign, classRecipes })));
  assert.equal(base.at(-1).levelIndex, 11);
  assert.ok(base.every((row) => row.packId === null));
});

test('same-name and same-runtime-ID editions remain distinct without invented ratings', () => {
  const groups = new Map();
  for (const row of expected.missions) groups.set(row.name, [...(groups.get(row.name) || []), row]);
  const duplicates = [...groups.values()].filter((rows) => rows.length > 1);
  assert.ok(duplicates.length > 0);
  for (const rows of duplicates) assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  const countercurrent = expected.missions.filter((row) =>
    row.packId?.startsWith('countercurrent-'),
  );
  assert.equal(countercurrent.length, 12);
  assert.equal(new Set(countercurrent.map((row) => row.levelId)).size, 3);
  assert.equal(new Set(countercurrent.map((row) => row.id)).size, 12);
  assert.ok(
    expected.missions.every(
      (row) => !Object.hasOwn(row, 'challengeBand') && !Object.hasOwn(row, 'difficultyBand'),
    ),
  );
});

test('every indexed pack fingerprint matches its prepared runtime owner including presentation', async () => {
  const packs = new Map();
  for (const row of expected.missions) if (row.packId) packs.set(row.packId, row);
  for (const row of packs.values()) {
    const bytes =
      row.source === 'external'
        ? externalEntries.find((item) => item.name === row.sourceFile.path).bytes
        : await readFile(new URL(`../../${row.sourceFile.path}`, import.meta.url));
    // A finite header-only decoder verifies normalization identity, not pixels.
    const { pack } = await preparePack(bytes.toString('utf8'), {
      decodeImage: async (dataUrl) => {
        const header = inspectImageDataUrl(dataUrl);
        return { naturalWidth: header.width, naturalHeight: header.height };
      },
    });
    assert.deepEqual(await preparedPackIdentity(pack), row.packIdentity, row.packId);
  }
});

test('browse metadata never embeds artwork, engine geometry or artificial progress', () => {
  const bytes = JSON.stringify(expected);
  assert.ok(Buffer.byteLength(bytes) < 256 * 1024);
  for (const forbidden of [
    'data:image',
    'data:audio',
    'dataUrl',
    'cleared',
    'unlocked',
    'walls',
    'spawns',
    'visualOverrides',
  ]) {
    assert.ok(!bytes.includes(forbidden), forbidden);
  }
  for (const row of expected.missions) {
    assert.deepEqual(row.modes, ['solo', 'versus']);
    assert.deepEqual(row.difficultiesByMode, {
      solo: ['standard', 'gentle'],
      versus: ['standard'],
    });
    assert.ok(row.tags.includes('Classic'));
    if (row.tags.includes('FPV')) assert.equal(row.themeId, 'fpv');
    if (row.tags.includes('Ukrainian')) assert.equal(row.themeId, 'ukraine');
    assert.match(row.rules, /coverage.*lives.*cells\/s/);
  }
});

test('download sizes account for paired external media, without eager browser work', () => {
  const downloads = expected.missions.filter((row) => row.download);
  assert.equal(downloads.length, 63);
  for (const row of downloads) {
    assert.equal(row.download.id, row.packId);
    assert.equal(row.download.packPath, row.sourceFile.path);
    if (row.source === 'external') {
      assert.ok(row.download.bytes > row.sourceFile.bytes);
      assert.ok(row.download.mediaPath.endsWith('/media.rlmedia'));
    } else assert.equal(row.download.bytes, row.sourceFile.bytes);
  }
});

test('modified, missing and duplicated browse rows fail source reconciliation', () => {
  for (const mutate of [
    (index) => index.missions.pop(),
    (index) => index.missions.push(index.missions[0]),
    (index) => {
      index.missions[0].campaignKey += '-forged';
    },
    (index) => {
      index.missions[0].name = 'Invented name';
    },
    (index) => {
      index.missions[0].rules = 'Invented rules';
    },
  ]) {
    const forged = structuredClone(expected);
    mutate(forged);
    assert.throws(
      () => assertMissionLibraryIndex(forged, expected),
      /differs from validated source/,
    );
  }
});

test('external byte tampering and incomplete or duplicate pairs are rejected before indexing', async () => {
  const altered = externalEntries.map((entry, index) =>
    index === 0 ? { ...entry, bytes: Buffer.concat([entry.bytes, Buffer.from(' ')]) } : entry,
  );
  await assert.rejects(
    buildMissionLibraryIndex({ root, externalEntries: altered }),
    /trusted byte identity/,
  );
  await assert.rejects(
    buildMissionLibraryIndex({ root, externalEntries: externalEntries.slice(1) }),
    /every exact external/,
  );
  await assert.rejects(
    buildMissionLibraryIndex({ root, externalEntries: [...externalEntries, externalEntries[0]] }),
    /every exact external/,
  );
  const entry = externalEntries[0];
  const row = expected.missions.find((row) => row.sourceFile.path === entry.name);
  assertMissionSourceBytes(entry.bytes, row.sourceFile);
  const changed = Buffer.from(entry.bytes);
  changed[0] ^= 1;
  assert.throws(() => assertMissionSourceBytes(changed, row.sourceFile), /trusted byte identity/);
});
