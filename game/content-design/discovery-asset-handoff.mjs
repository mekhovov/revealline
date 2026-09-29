import { dataIdentity, required } from '../data-json.mjs';
import { resolveEditionAssets, resolveEditionSelection } from '../editions/model.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { inspectRewardMediaBytes, REWARD_MEDIA_LIMITS } from '../rewards/media-format.mjs';
import { discoveryCosmeticContext, editDiscoveryCosmetic } from './discovery-cosmetics.mjs';
import { editDiscoveryPayload } from './discovery.mjs';
import { editDiscoveryTeaser } from './discovery-teaser.mjs';

export { prepareRewardRasterOriginal } from '../rewards/raster-original.mjs';
const cancelled = (signal) => {
  if (signal?.aborted) throw new DOMException('Asset handoff cancelled.', 'AbortError');
};

export function rewardAssetHandoffContext(source, campaignId) {
  const selection = resolveEditionSelection(source.catalog, { editionId: source.editionId });
  const campaign = selection.campaigns.find((item) => item.id === campaignId);
  required(campaign, 'Choose the edition that owns this reward campaign.');
  const assets = resolveEditionAssets(source.catalog, { editionId: source.editionId });
  const ledger = new Map(assets.map((asset) => [asset.id, asset]));
  function admitted(asset, seen = new Set()) {
    required(
      asset &&
        asset.approved &&
        (selection.edition.publication !== 'public' || asset.publication === 'public'),
      'The original or a dependency lacks selected publication approval.',
    );
    if (seen.has(asset.id)) return;
    seen.add(asset.id);
    for (const id of asset.dependencies) admitted(ledger.get(id), seen);
  }
  return {
    source,
    selection,
    campaign,
    assets,
    admitted,
    identity: dataIdentity({
      catalog: source.catalog,
      editionId: source.editionId,
      files: [...source.files],
    }),
  };
}

/** Match bytes against explicit selected inventory. Names and local source
 * declarations cannot turn an unreviewed file into a publishable asset. */
export async function inspectDiscoveryAssetHandoff(context, file, purpose, { signal } = {}) {
  required(['teaser', 'image', 'cosmetic'].includes(purpose), 'Choose a supported raster handoff.');
  required(
    file instanceof Blob && file.size > 0 && file.size <= REWARD_MEDIA_LIMITS.imageBytes,
    'Choose a raster original within the existing 4 MiB image limit.',
  );
  cancelled(signal);
  const bytes = new Uint8Array(await file.arrayBuffer());
  cancelled(signal);
  const sha256 = await hashPresentationBytes(bytes);
  cancelled(signal);
  const cosmetics = purpose === 'cosmetic' ? discoveryCosmeticContext(context.source) : null;
  const permitted = new Set(
    purpose === 'cosmetic'
      ? cosmetics.registry.map((recipe) => recipe.image?.assetId).filter(Boolean)
      : context.campaign.assetIds,
  );
  const matches = context.assets.filter(
    (asset) => permitted.has(asset.id) && asset.sha256 === sha256 && asset.bytes === bytes.length,
  );
  required(
    matches.length,
    'This file is not an admitted original for the selected campaign and use. Complete source and rights review before handoff.',
  );
  for (const asset of matches) {
    context.admitted(asset);
    inspectRewardMediaBytes(asset, 'poster', bytes);
  }
  return {
    identity: context.identity,
    campaignId: context.campaign.id,
    purpose,
    bytes,
    matches,
    recipes:
      cosmetics?.registry.filter((recipe) =>
        matches.some(
          (asset) => recipe.image?.assetId === asset.id && recipe.image.sha256 === asset.sha256,
        ),
      ) ?? [],
  };
}

/** All edits pass through the existing immutable reward revision/rebind path. */
export function editDiscoveryAssetHandoff(
  source,
  rewards,
  rewardId,
  context,
  inspected,
  selection,
) {
  required(
    inspected.identity === context.identity && inspected.campaignId === context.campaign.id,
    'The edition source changed. Inspect the original again.',
  );
  const reward = rewards.find((item) => item.id === rewardId);
  required(
    reward?.campaignId === context.campaign.id && reward.brandId === context.selection.brand.id,
    'Choose a reward owned by this selected campaign.',
  );
  const asset = inspected.matches.find((item) => item.id === selection.assetId);
  required(
    asset && context.assets.some((item) => item.id === asset.id && item.sha256 === asset.sha256),
    'Explicitly select one verified original.',
  );
  context.admitted(asset);
  if (inspected.purpose !== 'teaser') {
    const previous = reward.payloads.find((item) => item.id === selection.payloadId);
    required(
      !previous || previous.type === inspected.purpose,
      'Choose a new payload ID or an existing payload of the same kind.',
    );
  }
  const reference = { assetId: asset.id, sha256: asset.sha256 };
  if (inspected.purpose === 'teaser')
    return editDiscoveryTeaser(source, rewards, rewardId, {
      asset: reference,
      locales: { en: { alt: selection.locales.en.alt }, uk: { alt: selection.locales.uk.alt } },
    });
  if (inspected.purpose === 'image')
    return editDiscoveryPayload(
      source,
      rewards,
      rewardId,
      {
        id: selection.payloadId,
        type: 'image',
        asset: reference,
        locales: selection.locales,
      },
      'picture',
    );
  const recipe = inspected.recipes.find(
    (item) => item.recipeId === selection.recipeId && item.image?.assetId === asset.id,
  );
  required(recipe, 'Explicitly choose the registered character using this exact image.');
  return editDiscoveryCosmetic(
    source,
    rewards,
    rewardId,
    {
      id: selection.payloadId,
      type: 'cosmetic',
      recipeId: recipe.recipeId,
      recipeRevision: recipe.recipeRevision,
      locales: {
        en: { title: selection.locales.en.title },
        uk: { title: selection.locales.uk.title },
      },
    },
    discoveryCosmeticContext(context.source),
  );
}
