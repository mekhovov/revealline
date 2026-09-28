import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRewardCosmeticRegistry,
  resolveRewardCosmetic,
  validateRewardCharacterIds,
  projectEarnedRewardCosmetics,
} from '../rewards/cosmetics.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createRewardState, reconcileEarnedRewards } from '../rewards/model.mjs';

function fixture() {
  const body = {
    label: 'Workshop glider',
    sourceStatus: 'Original fictional illustration',
    src: '../../game/editions/assets/glider.png',
    widthCells: 1.5,
    heightCells: 1.5,
    headingOffsetDegrees: 0,
    sampling: 'linear',
    animationRecipe: 'still',
    rotors: [],
    bodyMotion: { kind: 'rigid-spin', radiansPerSecond: 2, travelGain: 0 },
  };
  const presets = {
    characters: {
      starter: { ...body, src: null },
      glider: body,
      unrelated: { ...body, src: null },
    },
    animationRecipes: { still: { components: [] } },
    rewardCharacters: ['glider'],
  };
  const assets = [
    {
      id: 'glider-picture',
      path: 'game/editions/assets/glider.png',
      sha256: 'a'.repeat(64),
      bytes: 800,
      approved: true,
      publication: 'public',
      dependencies: [],
    },
  ];
  const themes = [
    {
      player: 'starter',
      classBodies: { scout: 'starter' },
      actorRecipes: { bouncer: 'unrelated' },
    },
  ];
  return { presets, assets, themes };
}

test('cosmetic recipes reuse explicitly allowed body/motion presets with exact approved media identities', () => {
  const f = fixture(),
    before = JSON.stringify(f),
    registry = createRewardCosmeticRegistry(f),
    recipe = registry[0];
  assert.equal(recipe.recipeId, 'glider');
  assert.deepEqual(recipe.image, { assetId: 'glider-picture', sha256: 'a'.repeat(64) });
  assert.equal(resolveRewardCosmetic(registry, recipe), recipe);
  assert.equal(JSON.stringify(f), before);
  assert.throws(
    () => resolveRewardCosmetic(registry, { ...recipe, recipeRevision: 'future' }),
    /exact reward character/,
  );
  for (const modify of [
    (x) => {
      x.presets.characters.glider.bodyMotion.radiansPerSecond = 3;
    },
    (x) => {
      x.assets[0].sha256 = 'b'.repeat(64);
    },
    (x) => {
      x.presets.animationRecipes.still.label = 'Different exact recipe';
    },
  ]) {
    const changed = structuredClone(f);
    modify(changed);
    assert.notEqual(createRewardCosmeticRegistry(changed)[0].recipeRevision, recipe.recipeRevision);
  }
  for (const ids of [['starter'], ['unrelated'], ['missing'], ['glider', 'glider']]) {
    const altered = structuredClone(f);
    altered.presets.rewardCharacters = ids;
    assert.throws(
      () => createRewardCosmeticRegistry(altered),
      /reward character|Reward characters/,
    );
  }
  const legacy = structuredClone(f);
  delete legacy.presets.rewardCharacters;
  assert.deepEqual(createRewardCosmeticRegistry(legacy), []);
  assert.deepEqual(validateRewardCharacterIds(legacy.presets, legacy.themes), []);
});

test('unapproved, private, external, wrong media and gameplay fields cannot enter cosmetic recipes', () => {
  for (const modify of [
    (x) => {
      x.assets[0].approved = false;
    },
    (x) => {
      x.assets[0].publication = 'restricted';
    },
    (x) => {
      x.presets.characters.glider.src = 'https://foreign.test/body.png';
    },
    (x) => {
      x.assets[0].bytes = 4 * 1024 * 1024 + 1;
    },
    (x) => {
      x.presets.characters.glider.playerSpeed = 50;
    },
    (x) => {
      x.assets[0].dependencies = ['omitted'];
    },
  ]) {
    const f = fixture();
    modify(f);
    assert.throws(() => createRewardCosmeticRegistry(f));
  }
});

test('only exact earned receipts unlock a body, and changed artwork preserves the unavailable original', () => {
  const f = fixture(),
    registry = createRewardCosmeticRegistry(f),
    recipe = registry[0],
    source = createStarterProject();
  const reward = structuredClone(
    createStudioReward({
      campaign: { ...source.campaigns[0], brandId: 'museum' },
      source,
      rule: 'all-missions',
      id: 'glider-unlock',
      locales: {
        en: {
          title: 'Glider',
          teaser: 'Complete the workshop',
          paragraph: 'Original fictional cosmetic.',
        },
        uk: {
          title: 'Планер',
          teaser: 'Завершіть майстерню',
          paragraph: 'Оригінальне вигадане оформлення.',
        },
      },
    }),
  );
  reward.payloads.push({
    id: 'body',
    type: 'cosmetic',
    recipeId: recipe.recipeId,
    recipeRevision: recipe.recipeRevision,
    locales: { en: { title: 'Glider' }, uk: { title: 'Планер' } },
  });
  const context = {
    editionId: 'museum-public',
    brandId: 'museum',
    campaignIds: [reward.campaignId],
    clears: {},
    learning: [],
    mastery: [],
  };
  const options = { ...context, registry };
  const locked = reconcileEarnedRewards(
    [reward],
    context,
    createRewardState(context.editionId),
  ).state;
  assert.deepEqual(projectEarnedRewardCosmetics(locked, options).available, []);
  context.clears[source.missions[0].id] = {
    ...reward.requirements.missions[0].bindings[0],
    runId: 'accepted',
  };
  const state = reconcileEarnedRewards([reward], context, locked).state;
  assert.deepEqual(projectEarnedRewardCosmetics(state, options).available, [recipe]);
  assert.deepEqual(
    projectEarnedRewardCosmetics(state, { ...options, campaignIds: [] }).available,
    [],
  );
  const changed = structuredClone(f);
  changed.assets[0].sha256 = 'c'.repeat(64);
  assert.deepEqual(
    projectEarnedRewardCosmetics(state, {
      ...options,
      registry: createRewardCosmeticRegistry(changed),
    }),
    {
      available: [],
      unavailable: [{ recipeId: recipe.recipeId, recipeRevision: recipe.recipeRevision }],
    },
  );
  assert.throws(
    () => projectEarnedRewardCosmetics(state, { ...options, editionId: 'foreign' }),
    /another edition/,
  );
});
