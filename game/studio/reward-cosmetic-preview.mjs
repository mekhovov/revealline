import { required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { resolveRewardCosmetic } from '../rewards/cosmetics.mjs';
import { mountRewardCosmetic } from '../ui/reward-cosmetic.mjs';

/** Imported packets never authorize fetching a URL. A local original is
 * explicitly selected and matched to the same runtime hash/size/raster limits. */
export function mountLocalRewardCosmeticPreview({
  container,
  payload,
  context,
  locale = 'en',
  window = globalThis.window,
}) {
  const doc = container.ownerDocument,
    root = doc.createElement('fieldset'),
    input = doc.createElement('input'),
    label = doc.createElement('label'),
    target = doc.createElement('div'),
    status = doc.createElement('p');
  const recipe = resolveRewardCosmetic(context.registry, payload);
  input.type = 'file';
  input.accept = '.png,.jpg,.jpeg,.webp';
  input.setAttribute('data-cosmetic-original', payload.id);
  label.textContent = t('tools:studio.cosmetic.original', { lng: locale });
  label.append(input);
  root.append(label, status, target);
  container.append(root);
  label.hidden = !recipe.image;
  let viewer,
    disposed = false,
    generation = 0;
  function stop() {
    viewer?.dispose();
    viewer = null;
    target.replaceChildren();
  }
  async function load() {
    const current = ++generation;
    stop();
    try {
      let bytes;
      if (recipe.image) {
        const file = input.files?.[0];
        required(
          file && file.size <= 4 * 1024 * 1024,
          'Choose the exact bounded original character image.',
        );
        bytes = new Uint8Array(await file.arrayBuffer());
        if (disposed || current !== generation) return;
      }
      viewer = mountRewardCosmetic({
        container: target,
        payload,
        registry: context.registry,
        locale,
        preview: true,
        window,
        readLocalAsset: async () => ({
          asset: context.assets.find((item) => item.id === recipe.image.assetId),
          bytes,
        }),
      });
    } catch (error) {
      if (!disposed && current === generation) status.textContent = error.message;
    }
  }
  input.onchange = load;
  if (!recipe.image) void load();
  return {
    dispose() {
      disposed = true;
      generation++;
      stop();
      input.onchange = null;
      root.remove();
    },
  };
}
