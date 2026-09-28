import { required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { validateRewardTeaserImage } from '../rewards/model.mjs';
import { REWARD_MEDIA_LIMITS } from '../rewards/media-format.mjs';
import { loadRewardImage } from '../ui/reward-image.mjs';

/** Preview an explicitly chosen original with the same exact-image viewer.
 * Local selection does not import assets or grant rewards. */
export function mountLocalRewardTeaserPreview({
  container,
  teaserImage,
  locale = 'en',
  window = globalThis.window,
}) {
  const image = validateRewardTeaserImage(teaserImage),
    doc = container.ownerDocument;
  const tr = (key) => t(`tools:studio.teaser.${key}`, { lng: locale });
  const root = doc.createElement('fieldset'),
    label = doc.createElement('label'),
    input = doc.createElement('input'),
    target = doc.createElement('div'),
    status = doc.createElement('p');
  input.type = 'file';
  input.accept = '.png,.jpg,.jpeg,.webp';
  input.setAttribute('data-reward-teaser-file', image.asset.assetId);
  label.textContent = tr('chooseFile');
  label.append(input);
  status.textContent = tr('previewOnly');
  status.setAttribute('role', 'status');
  root.append(label, status, target);
  container.append(root);
  let disposed = false,
    generation = 0,
    controller = null;
  const urls = new Set();
  function stop() {
    controller?.abort();
    controller = null;
    for (const url of urls) window.URL.revokeObjectURL(url);
    urls.clear();
    target.replaceChildren();
  }
  const change = async () => {
    const visit = ++generation;
    stop();
    try {
      const file = input.files?.[0];
      required(
        file && file.size > 0 && file.size <= REWARD_MEDIA_LIMITS.imageBytes,
        'Choose a teaser image within the 4 MiB image limit.',
      );
      controller = new AbortController();
      await loadRewardImage({
        container: target,
        image,
        locale,
        signal: controller.signal,
        isCurrent: () => !disposed && visit === generation,
        urls,
        URLImpl: window.URL,
        missingLabel: tr('wrongFile'),
        readLocalAsset: async () => ({
          asset: {
            id: image.asset.assetId,
            sha256: image.asset.sha256,
            path: file.name,
            bytes: file.size,
          },
          bytes: new Uint8Array(await file.arrayBuffer()),
        }),
      });
    } catch (error) {
      if (!disposed && visit === generation) status.textContent = error.message;
    }
  };
  input.addEventListener('change', change);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      stop();
      input.removeEventListener('change', change);
      root.remove();
    },
  };
}
