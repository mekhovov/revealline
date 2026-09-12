import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createExecutionCatalog,
  expandDifficultyCampaigns,
  EXECUTION_CATALOG_LIMITS,
} from '../campaign-contexts.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { campaignKey } from '../library.mjs';
import { canonicalJSON } from '../data-json.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const clone = (value) => structuredClone(value);
const base = await json('../content/campaign.json');
base.classRecipes = await json('../content/classes.json');
const source = await json('../content/packs/homeward-skies.json');
const homeward = {
  campaign: { ...source.campaigns[0], classRecipes: source.classRecipes },
  classRecipes: source.classRecipes,
  sourcePackId: source.id,
  themes: source.themes,
  visualOverrides: source.visualOverrides,
  levelVisuals: source.levelVisuals,
  music: source.music,
};

test('resolved metadata and exact keys survive owned Standard/Gentle lookup', () => {
  const authored = [{ campaign: base, sourcePackId: null }, homeward],
    before = canonicalJSON(authored);
  const catalog = createExecutionCatalog(authored);
  assert.equal(catalog.entries.length, 4);
  assert.deepEqual(
    catalog.entries.map((e) => e.difficulty),
    ['standard', 'gentle', 'standard', 'gentle'],
  );
  for (const entry of catalog.entries) {
    assert.equal(catalog.find(entry.executionKey), entry);
    assert.equal(catalog.select(entry.baseCampaignKey, entry.difficulty), entry);
    assert.equal(entry.executionKey, campaignKey(entry.campaign));
    assert.equal(entry.baseCampaignKey, campaignKey(entry.baseCampaign));
  }
  const standard = catalog.select(campaignKey(homeward.campaign), 'standard'),
    gentle = catalog.select(campaignKey(homeward.campaign), 'gentle');
  assert.equal(standard.baseCampaign, standard.campaign);
  assert.equal(gentle.baseCampaign, standard.campaign);
  assert.equal(gentle.levelVisuals, standard.levelVisuals);
  for (const key of [
    'classRecipes',
    'sourcePackId',
    'themes',
    'visualOverrides',
    'levelVisuals',
    'music',
  ])
    assert.deepEqual(gentle[key], homeward[key]);
  assert.notEqual(standard.levelVisuals, homeward.levelVisuals);
  assert.ok(
    standard.levelVisuals.some((v) => v.visualOverrides.background.dataUrl.length > 1_000_000),
  );
  assert.equal(canonicalJSON(authored), before);
  assert.ok(Object.isFrozen(catalog) && Object.isFrozen(catalog.entries));
  assert.throws(() => {
    gentle.levelVisuals[0].visualOverrides.background.fit = 'cover';
  }, TypeError);
  assert.throws(() => {
    gentle.campaign.levels[0].rules.lives = 9;
  }, TypeError);
  assert.throws(() => catalog.entries.pop(), TypeError);
});

test('catalog snapshots input and retains the first same-owner metadata', () => {
  const first = { campaign: clone(base), sourcePackId: 'first', metadata: { title: 'First copy' } },
    second = { campaign: clone(base), sourcePackId: 'second', metadata: { title: 'Later copy' } };
  const catalog = createExecutionCatalog([first, second]);
  assert.equal(catalog.entries.length, 2);
  assert.ok(catalog.entries.every((e) => e.sourcePackId === 'first'));
  first.metadata.title = 'Changed';
  first.campaign.levels[0].rules.lives = 9;
  assert.equal(catalog.entries[0].metadata.title, 'First copy');
  assert.equal(catalog.entries[0].campaign.levels[0].rules.lives, base.levels[0].rules.lives);
});

test('a derived campaign presented as authored collides even with exactly equal execution data', () => {
  const derived = createDifficultyContext(base, 'gentle').campaign;
  const original = { campaign: base },
    impostor = { campaign: derived };
  assert.equal(campaignKey(derived), createDifficultyContext(base, 'gentle').campaignKey);
  for (const entries of [
    [original, impostor],
    [impostor, original],
  ]) {
    const before = canonicalJSON(entries);
    assert.throws(() => createExecutionCatalog(entries), /different base\/difficulty owners/);
    assert.equal(canonicalJSON(entries), before);
    assert.throws(
      () => expandDifficultyCampaigns(entries.map((e) => e.campaign)),
      /different base\/difficulty owners/,
    );
  }
});

test('lookup rejects mode coercion and missing keys without inferring labels or ownership', () => {
  const catalog = createExecutionCatalog([{ campaign: base }]);
  for (const mode of [undefined, null, 'Gentle', 'easy', {}, ['gentle']])
    assert.throws(() => catalog.select(campaignKey(base), mode), /difficulty/);
  assert.equal(catalog.select('missing/1/0000000000000000', 'gentle'), null);
  assert.equal(catalog.select(catalog.entries[1].executionKey, 'standard'), null);
  assert.equal(catalog.find('gentle-v1-lookalike/1/0000000000000000'), null);
  let calls = 0;
  const key = {
    toString() {
      calls++;
      return campaignKey(base);
    },
  };
  assert.equal(catalog.find(key), null);
  assert.equal(catalog.select(key, 'standard'), null);
  assert.equal(calls, 0);
});

test('the backup hook returns only owned full campaigns with the same registry partitions', () => {
  const originals = [clone(base), clone(homeward.campaign)];
  const expanded = expandDifficultyCampaigns(originals);
  assert.ok(Object.isFrozen(expanded));
  assert.equal(expanded.length, 4);
  const catalog = createExecutionCatalog(originals.map((campaign) => ({ campaign })));
  assert.deepEqual(
    expanded,
    catalog.entries.map((e) => e.campaign),
  );
  assert.deepEqual(expanded[0], originals[0]);
  assert.notEqual(expanded[0], originals[0]);
  assert.throws(() => {
    expanded[1].levels[0].rules.lives = 9;
  }, TypeError);
  assert.equal(Object.hasOwn(expanded[0], 'executionKey'), false);
  assert.equal(expandDifficultyCampaigns([base, clone(base)]).length, 2);
  assert.deepEqual(expandDifficultyCampaigns([]), []);
});

test('the registry rejects malformed arrays, accessors and mismatching execution rosters before adoption', () => {
  let calls = 0;
  const accessorEntry = {};
  Object.defineProperty(accessorEntry, 'campaign', {
    enumerable: true,
    get() {
      calls++;
      return base;
    },
  });
  const accessorArray = [];
  Object.defineProperty(accessorArray, '0', {
    enumerable: true,
    get() {
      calls++;
      return { campaign: base };
    },
  });
  const extra = [];
  extra.metadata = true;
  const symbol = [];
  symbol[Symbol('hidden')] = true;
  for (const entries of [
    null,
    {},
    Array(1),
    extra,
    symbol,
    accessorArray,
    [accessorEntry],
    [{ campaign: base, callback() {} }],
    Array(EXECUTION_CATALOG_LIMITS.authoredEntries + 1).fill({ campaign: base }),
  ])
    assert.throws(() => createExecutionCatalog(entries));
  assert.throws(() => expandDifficultyCampaigns(accessorArray));
  assert.equal(calls, 0);
  assert.throws(
    () => createExecutionCatalog([{ campaign: base, classRecipes: base.classRecipes.slice(0, 1) }]),
    /equipment differs/,
  );
});
