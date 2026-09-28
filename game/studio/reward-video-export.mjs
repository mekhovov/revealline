import { t, localizedText } from '../i18n/index.mjs';
import { prepareDiscoveryVideoOriginal } from '../rewards/video-original.mjs';

/** Explicit complete-original and poster downloads, with owned short-lived URLs.
 * No publication approval, media assignment or progress mutation. */
export function mountRewardVideoExport({ container, getOriginal, URLImpl = globalThis.URL }) {
  const doc = container.ownerDocument,
    tr = (key) => t('tools:studio.videoHandoff.' + key);
  const root = doc.createElement('section'),
    prepare = doc.createElement('button'),
    cancel = doc.createElement('button'),
    link = doc.createElement('a'),
    posterLink = doc.createElement('a'),
    status = doc.createElement('p');
  root.setAttribute('data-reward-video-export', 'true');
  prepare.type = cancel.type = 'button';
  prepare.setAttribute('data-video-export-action', 'prepare');
  cancel.setAttribute('data-video-export-action', 'cancel');
  localizedText(prepare, () => tr('prepareExport'));
  localizedText(cancel, () => tr('cancel'));
  localizedText(link, () => tr('download'));
  localizedText(posterLink, () => tr('downloadPoster'));
  link.setAttribute('data-video-export-file', 'video');
  posterLink.setAttribute('data-video-export-file', 'poster');
  localizedText(status, () => tr('exportHelp'));
  status.setAttribute('role', 'status');
  link.hidden = posterLink.hidden = true;
  cancel.hidden = true;
  root.append(prepare, cancel, link, posterLink, status);
  container.append(root);
  let disposed = false,
    generation = 0,
    controller = null,
    url = null,
    posterURL = null;
  function reset() {
    generation++;
    controller?.abort();
    controller = null;
    if (url) URLImpl.revokeObjectURL(url);
    if (posterURL) URLImpl.revokeObjectURL(posterURL);
    posterURL = null;
    url = null;
    link.hidden = posterLink.hidden = true;
    link.removeAttribute('href');
    link.removeAttribute('download');
    posterLink.removeAttribute('href');
    posterLink.removeAttribute('download');
    prepare.disabled = disposed;
    cancel.hidden = true;
  }
  prepare.onclick = async () => {
    if (disposed || controller) return false;
    reset();
    const visit = generation;
    controller = new AbortController();
    const signal = controller.signal;
    prepare.disabled = true;
    cancel.hidden = false;
    try {
      const original = await getOriginal({ signal });
      const result = await prepareDiscoveryVideoOriginal(original, { signal });
      if (disposed || signal.aborted || visit !== generation) return false;
      url = URLImpl.createObjectURL(result.video.blob);
      link.href = url;
      link.download = result.video.filename;
      posterURL = URLImpl.createObjectURL(result.poster.blob);
      posterLink.href = posterURL;
      posterLink.download = result.poster.filename;
      link.hidden = posterLink.hidden = false;
      localizedText(status, () => tr('exportReady'));
      return true;
    } catch (error) {
      if (!disposed && visit === generation) {
        reset();
        status.textContent = error.message;
      }
      return false;
    } finally {
      if (!disposed && visit === generation) {
        controller = null;
        prepare.disabled = false;
        cancel.hidden = true;
      }
    }
  };
  cancel.onclick = () => {
    reset();
    localizedText(status, () => tr('exportHelp'));
  };
  link.onclick = posterLink.onclick = (event) => {
    if (disposed || !url || controller) event.preventDefault();
  };
  return {
    reset,
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      prepare.onclick = cancel.onclick = link.onclick = posterLink.onclick = null;
      root.remove();
    },
  };
}
