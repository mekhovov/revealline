import { required } from '../data-json.mjs';
import { t } from '../i18n/index.mjs';
import { rewardMediaReferences, REWARD_MEDIA_LIMITS } from '../rewards/media-format.mjs';
import { acquireStudioRewardAudio } from './reward-audio.mjs';
import { mountRewardMedia } from '../ui/reward-media.mjs';
import { mountRewardAudioGroup } from '../ui/reward-audio-group.mjs';
import { validateRewardAudioGroups } from '../rewards/audio-groups.mjs';

/** Level/Campaign Studio has no edition asset authority. Authors explicitly
 * choose local originals, matched against exact payload hashes; nothing is
 * uploaded, persisted or treated as a completion receipt. */
export function mountLocalRewardMediaPreview({
  container,
  payload,
  group,
  payloads,
  locale = 'en',
  window = globalThis.window,
}) {
  const document = container.ownerDocument,
    root = document.createElement('fieldset'),
    label = document.createElement('label'),
    input = document.createElement('input'),
    status = document.createElement('p'),
    target = document.createElement('div'),
    recordings = group
      ? validateRewardAudioGroups([group], payloads)[0].payloadIds.map((id) =>
          payloads.find((item) => item.id === id),
        )
      : [payload],
    references = recordings.flatMap(rewardMediaReferences),
    files = new Map();
  const tr = (key) => t(`tools:studio.rewardMedia.${key}`, { lng: locale });
  input.type = 'file';
  input.multiple = true;
  input.accept = '.mp3,.ogg,.wav,.mp4,.webm,.png,.jpg,.jpeg,.webp,.txt,.vtt';
  input.setAttribute('data-reward-media-files', group?.id ?? payload.id);
  label.textContent = tr('choose');
  label.append(input);
  status.setAttribute('role', 'status');
  status.textContent = tr('help');
  root.append(label, status, target);
  container.append(root);
  let viewer = null,
    audioOwner = null,
    disposed = false,
    generation = 0;
  function stop() {
    viewer?.dispose();
    audioOwner?.release();
    viewer = audioOwner = null;
    files.clear();
  }
  const change = async () => {
    const current = ++generation;
    stop();
    try {
      const selected = Array.from(input.files ?? []);
      required(
        selected.length > 0 && selected.length <= references.length,
        'Choose only the bounded originals for this reward.',
      );
      required(
        selected.reduce((total, file) => total + file.size, 0) <= REWARD_MEDIA_LIMITS.sourceBytes,
        'Reward preview originals exceed the edition asset budget.',
      );
      const accepted = new Map();
      for (const file of selected) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const hash = Array.from(
          new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
          (byte) => byte.toString(16).padStart(2, '0'),
        ).join('');
        required(
          references.some(({ reference }) => reference.sha256 === hash),
          'A selected file differs from every authored reward pin.',
        );
        accepted.set(hash, { name: file.name, bytes });
        if (disposed || current !== generation) return;
      }
      for (const [hash, file] of accepted) files.set(hash, file);
      audioOwner = acquireStudioRewardAudio(document);
      const mount = group ? mountRewardAudioGroup : mountRewardMedia;
      viewer = mount({
        container: target,
        ...(group ? { group, payloads: recordings } : { payload }),
        locale,
        document,
        window,
        URLImpl: window.URL,
        audioMaster: audioOwner.master,
        musicDucker: { acquire: () => () => {} },
        readLocalAsset: async (reference, { signal }) => {
          signal.throwIfAborted();
          const file = files.get(reference.sha256);
          required(file, 'Choose the exact original required by this reward.');
          return {
            asset: {
              id: reference.assetId,
              sha256: reference.sha256,
              path: file.name,
              bytes: file.bytes.length,
            },
            bytes: file.bytes,
          };
        },
      });
      status.textContent = tr('previewOnly');
    } catch (error) {
      if (!disposed && current === generation) status.textContent = error.message;
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
