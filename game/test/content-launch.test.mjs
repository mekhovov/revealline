import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PACK_CATALOG_VERSION,
  preparePackCatalog,
  resolvePackLaunch,
  packLaunchHref,
} from '../content-launch.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const source = await json('../content/packs/catalog.json');
const catalog = preparePackCatalog(source);

test('shipped pack catalog is a lightweight exact projection of every bundled pack', async () => {
  assert.equal(catalog.format, PACK_CATALOG_VERSION);
  const index = await json('../content/packs/index.json');
  assert.deepEqual(
    catalog.packs.map(({ id, path }) => ({ id, path })),
    index.packs,
  );
  for (const summary of catalog.packs) {
    const pack = await json(`../content/packs/${summary.path}`);
    assert.equal(summary.name, pack.name);
    assert.deepEqual(
      summary.campaigns,
      pack.campaigns.map((campaign) => ({
        id: campaign.id,
        revision: campaign.revision,
        title: campaign.title,
        levels: campaign.levels.map((level) => ({ id: level.id, name: level.name })),
      })),
    );
  }
  assert.ok(Object.isFrozen(catalog));
  assert.ok(Object.isFrozen(catalog.packs[0].campaigns[0].levels[0]));
});

test('pack launch resolves defaults and an explicit level only from the shipped catalog', () => {
  assert.deepEqual(resolvePackLaunch(new URLSearchParams('pack=homeward-skies&play=1'), catalog), {
    packId: 'homeward-skies',
    packName: 'Homeward Skies',
    path: 'homeward-skies.json',
    campaignId: 'homeward-skies',
    campaignTitle: 'Homeward Skies',
    levelId: 'homeward-01',
    levelName: 'Copper Orchard',
    play: true,
  });
  assert.equal(
    resolvePackLaunch(
      new URLSearchParams('pack=fieldcraft&campaign=fieldcraft&level=fieldcraft-04&play=1'),
      catalog,
    ).levelName,
    'Net Loom',
  );
  assert.equal(resolvePackLaunch(new URLSearchParams(), catalog), null);
});

test('pack launch rejects unknown, ambiguous and partial routes without accepting file paths', () => {
  for (const query of [
    'pack=unknown',
    'pack=../night-shift',
    'pack=night-shift&campaign=unknown',
    'pack=night-shift&level=unknown',
    'pack=night-shift&play=0',
    'pack=night-shift&pack=fieldcraft',
    'level=night-shift-01',
  ])
    assert.throws(() => resolvePackLaunch(new URLSearchParams(query), catalog));
});

test('pack launch href encodes selector choices and autoplay explicitly', () => {
  assert.equal(
    packLaunchHref('./game/', {
      packId: 'night-shift',
      campaignId: 'night-shift',
      levelId: 'night-shift-02',
      play: true,
    }),
    './game/?pack=night-shift&campaign=night-shift&level=night-shift-02&play=1',
  );
});

test('catalog validation rejects drift, duplicate identities and unsupported fields', () => {
  const mutate = (fn) => {
    const candidate = structuredClone(source);
    fn(candidate);
    return candidate;
  };
  assert.throws(() => preparePackCatalog(mutate((value) => (value.format = 'future'))));
  assert.throws(() =>
    preparePackCatalog(mutate((value) => value.packs.push(structuredClone(value.packs[0])))),
  );
  assert.throws(() =>
    preparePackCatalog(mutate((value) => (value.packs[0].path = '../night-shift.json'))),
  );
  assert.throws(() =>
    preparePackCatalog(mutate((value) => (value.packs[0].campaigns[0].revision = ''))),
  );
  assert.throws(() =>
    preparePackCatalog(mutate((value) => (value.packs[0].campaigns[0].levels[0].extra = true))),
  );
});

test('landing and game expose wired pack and level selectors with exact first-mission routes', async () => {
  const landing = await readFile(new URL('../../site/index.html', import.meta.url), 'utf8');
  const game = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(landing, /id="landing-pack-select"/);
  assert.match(landing, /id="landing-level-select"/);
  assert.match(game, /id="pack-select"/);
  assert.match(game, /id="level-select"/);
  for (const pack of catalog.packs) {
    const campaign = pack.campaigns[0];
    const level = campaign.levels[0];
    const encoded = `pack=${pack.id}&amp;campaign=${campaign.id}&amp;level=${level.id}&amp;play=1`;
    assert.ok(landing.includes(encoded), `${pack.name} card must launch its first mission`);
  }
});
