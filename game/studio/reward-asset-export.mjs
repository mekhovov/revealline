import { t, localizedText } from '../i18n/index.mjs';
import { prepareRewardRasterOriginal } from '../rewards/raster-original.mjs';

/** One explicit native download of an existing raster. The source tool remains
 * the only owner of its bytes/history; this control never admits publication. */
export function mountRewardAssetExport({ container, getOriginal, URLImpl = globalThis.URL }) {
  const doc = container.ownerDocument,
    tr = (key) => t('tools:studio.assetHandoff.' + key);
  const root = doc.createElement('section'),
    prepare = doc.createElement('button'),
    cancel = doc.createElement('button'),
    link = doc.createElement('a'),
    status = doc.createElement('p');
  root.setAttribute('data-reward-asset-export', 'true');
  prepare.type = cancel.type = 'button';
  prepare.setAttribute('data-asset-export-action', 'prepare');
  cancel.setAttribute('data-asset-export-action', 'cancel');
  localizedText(prepare, () => tr('prepareExport'));
  localizedText(cancel, () => tr('cancel'));
  localizedText(link, () => tr('download'));
  localizedText(status, () => tr('exportHelp'));
  status.setAttribute('role', 'status');
  link.hidden = true;
  cancel.hidden = true;
  root.append(prepare, cancel, link, status);
  container.append(root);
  let disposed = false,
    generation = 0,
    controller = null,
    url = null;
  function reset() {
    generation++;
    controller?.abort();
    controller = null;
    if (url) URLImpl.revokeObjectURL(url);
    url = null;
    link.hidden = true;
    link.removeAttribute('href');
    link.removeAttribute('download');
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
      const result = await prepareRewardRasterOriginal(original, { signal });
      if (disposed || signal.aborted || visit !== generation) return false;
      url = URLImpl.createObjectURL(result.blob);
      link.href = url;
      link.download = result.filename;
      link.hidden = false;
      localizedText(status, () => tr('exportReady'));
      return true;
    } catch (error) {
      if (!disposed && visit === generation) status.textContent = error.message;
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
  link.onclick = (event) => {
    if (disposed || !url || controller) event.preventDefault();
  };
  return {
    reset,
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      prepare.onclick = cancel.onclick = link.onclick = null;
      root.remove();
    },
  };
}
