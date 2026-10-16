import { t } from '../i18n/index.mjs';
import { required } from '../data-json.mjs';
import { explorationAssetReferences, validateExplorationPayload } from '../rewards/exploration.mjs';
import { loadRewardImage } from '../ui/reward-image.mjs';
import { mountDiscoveryExploration } from '../ui/discovery-exploration.mjs';
import { REWARD_MEDIA_LIMITS } from '../rewards/media-format.mjs';

/** Explicit local files feed the same exact-pin image loader as the player.
 * No remote URL, catalogue mutation, stored progress or preview receipt. */
export function mountLocalExplorationPreview({
  container,
  payload: input,
  locale = 'en',
  window = globalThis.window,
}) {
  const payload = validateExplorationPayload(input),
    document = container.ownerDocument,
    root = document.createElement('section'),
    media = document.createElement('fieldset'),
    target = document.createElement('div'),
    status = document.createElement('p'),
    files = new Map(),
    urls = new Set(),
    inputs = [],
    references = [
      ...new Map(
        explorationAssetReferences(payload.recipe).map((ref) => [
          ref.assetId + '@' + ref.sha256,
          ref,
        ]),
      ).values(),
    ],
    tr = (key) => t('tools:studio.exploration.diagram.' + key, { lng: locale });
  let disposed = false,
    viewer = null;
  const legend = document.createElement('legend');
  legend.textContent = tr('previewFiles');
  media.append(legend);
  status.setAttribute('role', 'status');
  status.textContent = tr('previewOnly');
  const stop = () => {
    viewer?.dispose();
    viewer = null;
    for (const url of urls) window.URL.revokeObjectURL(url);
    urls.clear();
    target.replaceChildren();
  };
  const mount = () => {
    stop();
    if (disposed) return;
    viewer = mountDiscoveryExploration({
      container: target,
      payload,
      locale,
      loadImage: (image, figure, { signal }) =>
        loadRewardImage({
          container: figure,
          image,
          locale,
          signal,
          urls,
          URLImpl: window.URL,
          isCurrent: () => !disposed,
          missingLabel: tr('missingFile'),
          readLocalAsset: async (reference) => {
            const file = files.get(reference.assetId + '@' + reference.sha256);
            required(file, 'Select the exact local image for this asset.');
            return {
              asset: {
                id: reference.assetId,
                sha256: reference.sha256,
                path: file.name,
                bytes: file.size,
              },
              bytes: new Uint8Array(await file.arrayBuffer()),
            };
          },
        }),
    });
  };
  for (const ref of references) {
    const label = document.createElement('label'),
      input = document.createElement('input');
    label.textContent = ref.assetId;
    input.type = 'file';
    input.accept = '.png,.jpg,.jpeg,.webp';
    input.setAttribute('data-exploration-image-file', ref.assetId);
    input.onchange = () => {
      if (disposed) return;
      const key = ref.assetId + '@' + ref.sha256,
        file = input.files?.[0];
      files.delete(key);
      if (file && file.size > 0 && file.size <= REWARD_MEDIA_LIMITS.imageBytes) {
        files.set(key, file);
        status.textContent = tr('previewOnly');
      } else status.textContent = tr('fileLimit');
      mount();
    };
    inputs.push(input);
    label.append(input);
    media.append(label);
  }
  media.hidden = !references.length;
  root.append(media, status, target);
  container.append(root);
  mount();
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      inputs.forEach((input) => (input.onchange = null));
      files.clear();
      root.remove();
    },
  };
}
