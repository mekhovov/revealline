import { validatePack } from './packs.mjs';
import { campaignKey } from './library.mjs';
import { required } from './data-json.mjs';

/** Artwork uses the normal portable pack format, without changing the base
 * campaign's identity or installing a second playable copy of its levels. */
export function resolveBaseArtwork(pack, campaign) {
  const checked = validatePack(pack);
  required(checked.valid, `Invalid base artwork: ${checked.errors.join('; ')}`);
  const source = pack.campaigns.find((item) => item.id === campaign.id);
  required(source, 'Base artwork campaign is missing.');
  const owner = {
    ...source,
    classRecipes: pack.classRecipes.filter(
      (recipe) => !source.classIds || source.classIds.includes(recipe.id),
    ),
  };
  required(
    pack.id === 'first-signal-artwork' && campaignKey(owner) === campaignKey(campaign),
    'Base artwork must match the installed campaign.',
  );
  required(
    campaign.levels.every((level) =>
      pack.levelVisuals.some(
        (visual) => visual.levelId === level.id && visual.visualOverrides.background,
      ),
    ),
    'Every base level needs a reveal image.',
  );
  return { visualOverrides: pack.visualOverrides, levelVisuals: pack.levelVisuals };
}

export async function loadBaseArtwork(
  campaign,
  {
    fetch: request = globalThis.fetch,
    signal,
    url = new URL('content/base-artwork.json', import.meta.url),
  } = {},
) {
  const response = await request(url, { signal });
  required(response.ok, `Base artwork is unavailable (${response.status}).`);
  return resolveBaseArtwork(await response.json(), campaign);
}
