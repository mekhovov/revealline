import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../core/index.mjs';
import { campaignKey } from '../library.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createGalleryDifficultyResolver } from '../gallery-difficulty.mjs';

const original = {
  campaign: {
    version: 'xonix-campaign.v1',
    id: 'gallery-modes',
    revision: '1',
    classRecipes: structuredClone(CLASSES),
    levels: [
      {
        version: 'xonix-level.v1',
        id: 'mode-picture',
        revision: '1',
        name: 'Picture',
        width: 48,
        height: 36,
        spawn: { x: 24.5, y: 0.5 },
        walls: [],
        enemies: [],
        objectives: [],
        supplies: [],
        goal: { coverage: 0.5 },
      },
    ],
  },
  themes: [
    { id: 'fpv', name: 'Dawn' },
    { id: 'retro', name: 'Retro' },
  ],
  classRecipes: structuredClone(CLASSES),
  visualOverrides: {},
};
const entries = createExecutionCatalog([original]).entries;
const rows = entries.map((entry, index) => ({
  key: `row-${index}`,
  campaignKey: entry.executionKey,
  levelId: 'mode-picture',
  levelName: 'Picture',
  themeId: 'fpv',
  seed: 1,
  score: index ? 20000 : 12000,
  medal: index ? 'gold' : 'silver',
}));

test('both stored modes share one exact picture card with Standard default and untouched records', () => {
  const input = structuredClone([rows[1], rows[0]]),
    before = JSON.stringify(input);
  const resolver = createGalleryDifficultyResolver(entries),
    groups = resolver.group(input);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].item, input[1]);
  assert.equal(groups[0].item.score, 12000, 'Gentle statistics never substitute for Standard.');
  assert.deepEqual(
    groups[0].variants.map((v) => v.difficulty),
    ['standard', 'gentle'],
  );
  assert.equal(groups[0].variants[1].item.score, 20000);
  assert.equal(groups[0].variants[1].level.revision, entries[1].campaign.levels[0].revision);
  assert.ok(Object.isFrozen(groups));
  assert.ok(Object.isFrozen(groups[0].variants));
  assert.equal(JSON.stringify(input), before);
});

test('Gentle-only pictures resolve their own context and never invent a Standard row', () => {
  const resolver = createGalleryDifficultyResolver(entries),
    group = resolver.group([rows[1]])[0];
  assert.equal(group.item, rows[1]);
  assert.equal(group.variants.length, 1);
  assert.equal(group.variants[0].entry, entries[1]);
  assert.equal(resolver.label(rows[1].campaignKey), 'Gentle');
});

test('different themes, maps and canonical base identities stay separate', () => {
  const other = structuredClone(original);
  other.campaign.levels[0].goal.coverage = 0.6;
  const more = createExecutionCatalog([original, other]).entries;
  const resolver = createGalleryDifficultyResolver(more);
  const separate = [
    ...rows,
    { ...rows[0], key: 'theme', themeId: 'retro' },
    { ...rows[0], key: 'other-base', campaignKey: more[2].executionKey },
    { ...rows[0], key: 'missing-map', levelId: 'absent' },
  ];
  assert.equal(resolver.group(separate).length, 4);
  assert.equal(resolver.group(separate).at(-1).variants.length, 0);
});

test('pack removal or physics replacement archives both rows without inferring ID prefixes', () => {
  const missing = createGalleryDifficultyResolver([]);
  assert.equal(missing.group(rows).length, 2);
  assert.ok(missing.group(rows).every((group) => group.variants.length === 0));
  assert.match(missing.label(rows[1].campaignKey), /Archived.*unavailable/);
  const replacement = structuredClone(original);
  replacement.campaign.levels[0].goal.coverage = 0.6;
  const changed = createGalleryDifficultyResolver(createExecutionCatalog([replacement]).entries);
  assert.equal(changed.picture(rows[1]), null);
  const restored = createGalleryDifficultyResolver(createExecutionCatalog([original]).entries);
  assert.equal(restored.group(rows).length, 1);
});

test('asset-only replacements keep grouping and resolve the replacement visual for each mode', () => {
  const illustrated = structuredClone(original);
  illustrated.visualOverrides = { background: { dataUrl: 'owned-test-art' } };
  const replacement = createExecutionCatalog([illustrated]).entries;
  assert.equal(replacement[0].executionKey, entries[0].executionKey);
  const group = createGalleryDifficultyResolver(replacement).group(rows)[0];
  assert.equal(group.variants.length, 2);
  assert.ok(group.variants.every((v) => v.visualOverrides.background.dataUrl === 'owned-test-art'));
});

test('invalid wrapper ownership cannot label or coalesce a saved identity', () => {
  for (const bad of [
    { ...entries[1], baseCampaignKey: entries[1].baseCampaignKey + '0' },
    { ...entries[1], difficulty: 'standard' },
    { ...entries[1], executionKey: entries[0].executionKey },
    { ...entries[1], difficulty: undefined },
    { ...entries[1], policyVersion: 'gentle.v2' },
  ])
    assert.equal(createGalleryDifficultyResolver([bad]).picture(rows[1]), null);
});

test('a legacy authored campaign with a Gentle-looking ID remains exact Standard content', () => {
  const authored = structuredClone(original);
  authored.campaign.id = 'gentle-v1-authored';
  const key = campaignKey(authored.campaign);
  const resolver = createGalleryDifficultyResolver([authored]);
  assert.equal(resolver.label(key), 'Standard');
  assert.equal(resolver.picture({ ...rows[0], campaignKey: key }).difficulty, 'standard');
  assert.equal(resolver.picture({ ...rows[1], campaignKey: key + '0' }), null);
});

test('trusted challenge activity has its own label without a campaign difficulty or prefix inference', () => {
  const entry = { ...original, activity: 'challenge' },
    key = campaignKey(entry.campaign);
  const resolver = createGalleryDifficultyResolver([entry]);
  assert.equal(resolver.label(key), 'Challenge');
  assert.equal(resolver.resolve(key).difficulty, null);
  assert.equal(resolver.group([{ ...rows[0], campaignKey: key }])[0].variants.length, 1);
  assert.equal(createGalleryDifficultyResolver([original]).label(key), 'Standard');
});
