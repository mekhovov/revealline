import { required } from '../data-json.mjs';
import { createRewardCosmeticRegistry, resolveRewardCosmetic } from '../rewards/cosmetics.mjs';
import { resolveEditionSelection, resolveEditionAssets } from '../editions/model.mjs';
import { validateCompletionRewardPayload } from '../rewards/model.mjs';
import { editDiscoveryPayload } from './discovery.mjs';

/** The existing edition source packet owns bodies, approval and dependencies.
 * Level Studio can select that packet without inventing another asset store. */
export function discoveryCosmeticContext({ catalog, editionId, files }) {
  const selection = resolveEditionSelection(catalog, { editionId });
  const assets = resolveEditionAssets(catalog, { editionId });
  const registry = createRewardCosmeticRegistry({
    presets: files.get(selection.edition.boot.presets),
    themes: files.get(selection.edition.boot.themes)?.themes,
    assets,
    publication: selection.edition.publication,
  });
  return { selection, registry, assets };
}

export function editDiscoveryCosmetic(source, rewards, rewardId, input, context) {
  const reward = rewards.find((item) => item.id === rewardId);
  required(
    reward &&
      reward.brandId === context.selection.brand.id &&
      context.selection.edition.campaignIds.includes(reward.campaignId),
    'Choose the edition that owns this authored discovery.',
  );
  const payload = validateCompletionRewardPayload(input);
  required(payload.type === 'cosmetic', 'Choose a cosmetic reward payload.');
  resolveRewardCosmetic(context.registry, payload);
  return editDiscoveryPayload(source, rewards, rewardId, payload, 'character');
}
