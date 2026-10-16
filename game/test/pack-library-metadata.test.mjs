import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PACK_LIBRARY_VERSION,
  PACK_LIBRARY_METADATA_VERSION,
  MASTERY_PACK_VERSION,
  inspectPackLibraryMetadata,
  isPackLibraryMetadata,
  preparePack,
  importPackLibrary,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  resolvePackCampaign,
  scenarioFromPack,
} from '../packs.mjs';
import { preparedPackIdentity } from '../mission-library/pack-identity.mjs';
import { STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN } from '../mastery.mjs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';
import { campaignKey } from '../library.mjs';
import { createRun } from '../core/index.mjs';
import { createDuel } from '../multiplayer.mjs';

const read = (name = 'night-shift') =>
  JSON.parse(readFileSync(new URL(`../content/packs/${name}.json`, import.meta.url), 'utf8'));
const library = (...packs) => ({ format: PACK_LIBRARY_VERSION, packs });
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const ready = async (source) => (await preparePack(source, { decodeImage })).pack;
function pictured() {
  const pack = read();
  pack.visualOverrides.player = { dataUrl: png, name: 'craft.png' };
  pack.levelVisuals = [
    { levelId: pack.campaigns[0].levels[0].id, visualOverrides: { background: { dataUrl: png } } },
  ];
  return pack;
}
function masterySource() {
  const pack = read('homeward-skies');
  pack.visualOverrides = {};
  pack.levelVisuals = [];
  pack.format = MASTERY_PACK_VERSION;
  pack.masteries = structuredClone([STEADY_SIGNAL, SUPPLY_LINE, SAFE_RETURN]);
  pack.masteries[0].all.reverse();
  pack.masteries[1].all.reverse();
  return pack;
}

test('metadata is an immutable owned snapshot with exact normalized prepared identity and no artwork', async () => {
  const source = pictured();
  const before = structuredClone(source);
  const dto = await inspectPackLibraryMetadata(JSON.stringify(library(source)));
  const prepared = await ready(source);
  const metadata = dto.packs[0];
  assert.equal(dto.format, PACK_LIBRARY_METADATA_VERSION);
  assert.deepEqual(source, before);
  assert.deepEqual(metadata.identity, await preparedPackIdentity(prepared));
  const {
    visualOverrides: _visual,
    levelVisuals: _levels,
    ...expected
  } = resolvePackCampaign(prepared, source.campaigns[0].id);
  assert.deepEqual(metadata.entries[0], expected);
  assert.equal(JSON.stringify(dto).includes('data:image'), false);
  assert.equal(Object.hasOwn(metadata.entries[0], 'visualOverrides'), false);
  assert.equal(Object.hasOwn(metadata.entries[0], 'levelVisuals'), false);
  assert.equal(Object.isFrozen(metadata.entries[0].campaign.levels[0].rules), true);
  assert.throws(() => (metadata.entries[0].campaign.levels[0].rules.lives = 99), TypeError);
  source.campaigns[0].title = 'Later caller change';
  assert.equal(metadata.entries[0].campaign.title, before.campaigns[0].title);
});

test('projection never invokes browser artwork decoders and does not become runtime authority', async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else delete globalThis.Image;
  });
  globalThis.Image = function () {
    throw new Error('Metadata must not construct Image');
  };
  const dto = await inspectPackLibraryMetadata(library(pictured()));
  const projected = dto.packs[0];
  assert.equal(isPackLibraryMetadata(dto), true);
  assert.equal(isPackLibraryMetadata(structuredClone(dto)), false);
  assert.equal(isPackLibraryMetadata(Object.freeze({ ...dto })), false);
  assert.equal(isPackLibraryMetadata(projected), false);
  assert.equal(isPackLibraryMetadata(emptyPackLibrary()), false);
  assert.equal(isPackLibraryMetadata(null), false);
  assert.throws(() => resolvePackCampaign(projected, projected.entries[0].campaign.id), /prepared/);
  assert.throws(() => scenarioFromPack(projected, 'anything', 'anything'), /prepared/);
  assert.throws(() => installPack(emptyPackLibrary(), projected), /prepared/);
  assert.throws(() => installPack(dto, projected), /prepared/);
  assert.throws(() => exportPackLibrary(dto), /prepared/);
  await assert.rejects(importPackLibrary(dto), /Invalid expansion library/);
});

test('mastery normalization shares prepared canonical identity and preserves exact mastery contexts', async () => {
  const source = masterySource();
  const before = structuredClone(source);
  const metadata = (await inspectPackLibraryMetadata(library(source))).packs[0];
  const prepared = await ready(source);
  assert.deepEqual(source, before);
  assert.deepEqual(metadata.identity, await preparedPackIdentity(prepared));
  const entry = metadata.entries[0];
  assert.deepEqual(entry.masteries, prepared.masteries);
  assert.equal(entry.masteries[0].all[0].type, 'clean-win');
  const { campaign, sourcePackId, sourcePackFormat, masteries } = entry;
  assert.equal(
    createMasteryCatalog([{ campaign, sourcePackId, sourcePackFormat, masteries }]).registrations
      .length,
    3,
  );
  assert.equal(
    campaignKey(entry.campaign),
    campaignKey(resolvePackCampaign(prepared, entry.campaign.id).campaign),
  );
  const canonical = structuredClone(source);
  canonical.masteries = structuredClone(prepared.masteries);
  assert.deepEqual(
    (await inspectPackLibraryMetadata(library(canonical))).packs[0].identity,
    metadata.identity,
  );
});

test('artwork-only, presentation-only and gameplay-only changes produce distinct editions', async () => {
  const source = pictured();
  const first = (await inspectPackLibraryMetadata(library(source))).packs[0];
  for (const mutate of [
    (pack) => {
      pack.visualOverrides.player.dataUrl =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    },
    (pack) => {
      pack.visualOverrides.player.name = 'replacement.png';
    },
    (pack) => {
      pack.levelVisuals[0].visualOverrides.background.fit = 'contain';
    },
    (pack) => {
      pack.themes[0].palette.accent = '#123456';
    },
    (pack) => {
      pack.campaigns[0].levels[0].rules.lives++;
    },
  ]) {
    const changed = structuredClone(source);
    mutate(changed);
    const projection = (await inspectPackLibraryMetadata(library(changed))).packs[0];
    assert.notEqual(projection.identity.sha256, first.identity.sha256);
    assert.deepEqual(projection.identity, await preparedPackIdentity(await ready(changed)));
  }
});

test('authored order, same-name missions and campaign class restrictions remain intact for real mode validators', async () => {
  const source = read();
  const first = source.campaigns[0];
  first.levels[1].name = first.levels[0].name;
  first.classIds = [source.classRecipes[1].id];
  const second = structuredClone(first);
  second.id = 'second-campaign';
  second.revision = 'authored-revision-2';
  second.levels = second.levels
    .slice(0, 2)
    .map((level, index) => ({ ...level, id: `second-${index}` }));
  source.campaigns.push(second);
  const dto = await inspectPackLibraryMetadata(library(source));
  const prepared = await ready(source);
  assert.deepEqual(
    dto.packs[0].entries.map((entry) => entry.campaign.id),
    source.campaigns.map((campaign) => campaign.id),
  );
  for (const entry of dto.packs[0].entries) {
    const original = resolvePackCampaign(prepared, entry.campaign.id);
    assert.deepEqual(entry.campaign, original.campaign);
    assert.deepEqual(
      entry.classRecipes.map((recipe) => recipe.id),
      first.classIds,
    );
    for (const level of entry.campaign.levels) {
      const settings = { classRecipes: entry.classRecipes, classId: entry.classRecipes[0].id };
      assert.doesNotThrow(() => createRun(level, settings));
      assert.doesNotThrow(() => createDuel(level, settings));
    }
  }
});

test('library dependency, identity, missing version and cycle errors fail closed', async () => {
  const parent = read();
  const child = read('living-threads');
  child.dependencies = [{ id: parent.id, version: parent.version }];
  assert.equal((await inspectPackLibraryMetadata(library(parent, child))).packs.length, 2);
  await assert.rejects(inspectPackLibraryMetadata(library(child)), /requires/);
  await assert.rejects(inspectPackLibraryMetadata(library(parent, parent)), /unique/);
  const wrongVersion = structuredClone(parent);
  wrongVersion.version = '2.0.0';
  await assert.rejects(inspectPackLibraryMetadata(library(wrongVersion, child)), /requires/);
  parent.dependencies = [{ id: child.id, version: child.version }];
  await assert.rejects(inspectPackLibraryMetadata(library(parent, child)), /cycle/);
});

test('malformed image headers, gameplay and mastery targets are rejected even without decoding', async () => {
  const image = pictured();
  image.visualOverrides.player.dataUrl = 'data:image/png;base64,AAAA';
  await assert.rejects(inspectPackLibraryMetadata(library(image)), /image|PNG/i);
  const gameplay = read();
  gameplay.campaigns[0].levels[0].rules.lives = -1;
  await assert.rejects(inspectPackLibraryMetadata(library(gameplay)), /lives/);
  const mastery = masterySource();
  mastery.masteries[0].levelId = 'not-an-authored-level';
  await assert.rejects(inspectPackLibraryMetadata(library(mastery)), /map|level/i);
});

test('metadata checks cross-library mastery conflicts and the installed pack count boundary', async () => {
  const first = masterySource();
  const conflicting = structuredClone(first);
  conflicting.id = 'conflicting-mastery';
  conflicting.masteries[0].revision = 'different-authored-mastery';
  await assert.rejects(inspectPackLibraryMetadata(library(first, conflicting)), /conflict/i);
  await assert.rejects(
    inspectPackLibraryMetadata(library(...Array(13).fill(read()))),
    /Invalid expansion library/,
  );
});

test('untrusted objects cannot run getters, and input mutations during hashing cannot change the snapshot', async () => {
  let getterRuns = 0;
  await assert.rejects(
    inspectPackLibraryMetadata({
      format: PACK_LIBRARY_VERSION,
      get packs() {
        getterRuns++;
        return [];
      },
    }),
    /accessors/,
  );
  assert.equal(getterRuns, 0);
  const source = read();
  const expected = await preparedPackIdentity(await ready(source));
  const pending = inspectPackLibraryMetadata(library(source));
  source.name = 'Mutation after first async boundary';
  source.campaigns[0].levels[0].rules.lives++;
  assert.deepEqual((await pending).packs[0].identity, expected);
  assert.deepEqual(await inspectPackLibraryMetadata(library()), {
    format: PACK_LIBRARY_METADATA_VERSION,
    packs: [],
  });
});
