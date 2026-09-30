import { freezeDesign } from '../content-design/catalogs.mjs';
import { createRewardCosmeticRegistry } from '../rewards/cosmetics.mjs';

const definitions = freezeDesign([
  {
    brandId: 'fpv-learning',
    campaignId: 'fpv-meet-aircraft',
    id: 'reward-fpv-discovery-courier-v1',
    title: { en: 'Workshop camera courier', uk: 'Кур’єр із камерою для майстерні' },
    size: 1.8,
    spin: 0.6,
  },
  {
    brandId: 'ukraine-culture',
    campaignId: 'ukraine-threads',
    id: 'reward-textile-discovery-shuttle-v1',
    title: { en: 'Gallery weaving shuttle', uk: 'Ткацький човник галереї' },
    size: 2.5,
    spin: 0.35,
  },
]);
export const curriculumCosmeticAssetIds = (brandId) =>
  definitions.filter((entry) => entry.brandId === brandId).map((entry) => entry.id);

export function curriculumRewardCharacters(brandId) {
  const entries = definitions.filter((entry) => entry.brandId === brandId);
  if (!entries.length) return null;
  return {
    rewardCharacters: entries.map((entry) => entry.id),
    characters: Object.fromEntries(
      entries.map((entry) => [
        entry.id,
        {
          label: entry.title.en,
          sourceStatus: 'Original fictional generated character; optional appearance only',
          src: `../../game/editions/assets/discovery/${entry.id}.png`,
          widthCells: entry.size,
          heightCells: entry.size,
          headingOffsetDegrees: 0,
          sampling: 'linear',
          rotors: [],
          animationRecipe: 'still',
          bodyMotion: { kind: 'rigid-spin', radiansPerSecond: entry.spin, travelGain: 0 },
        },
      ]),
    ),
  };
}

export function curriculumCosmeticPayload(campaignId, assets) {
  const entry = definitions.find((item) => item.campaignId === campaignId);
  if (!entry) return null;
  const registry = createRewardCosmeticRegistry({
    presets: {
      ...curriculumRewardCharacters(entry.brandId),
      animationRecipes: { still: { label: 'Rigid body', components: [] } },
    },
    assets,
  });
  const recipe = registry.find((item) => item.recipeId === entry.id);
  return {
    id: `${campaignId}-curator-character`,
    type: 'cosmetic',
    recipeId: recipe.recipeId,
    recipeRevision: recipe.recipeRevision,
    locales: Object.fromEntries(
      ['en', 'uk'].map((locale) => [locale, { title: entry.title[locale] }]),
    ),
  };
}
