import { t, localizedText } from '../../game/i18n/index.mjs';
/** Keep a deliberate download action after asynchronous preparation. Browsers
 * may decline a synthetic click once user activation expires. Requesting a
 * download is not proof that a file reached the user's device. Own only one URL. */
export function createStudioDownload({ document, target, urls = URL }) {
  let current = null;
  function dispose() {
    if (current) urls.revokeObjectURL(current);
    current = null;
    target.replaceChildren();
    target.hidden = true;
  }
  function offer(blob, filename) {
    const url = urls.createObjectURL(blob),
      link = document.createElement('a');
    link.href = url;
    link.className = 'file-button';
    link.dataset.studioHost = 'control';
    link.download = filename;
    localizedText(link, () =>`Download ${filename}`);
    const note = document.createElement('span');
    localizedText(note, () =>("" + t("tools:preparedFileReadyIfTheAutomaticDownloadDidNotStart") + " "));
    // Allocate before releasing the last usable file: failed preparation keeps it.
    const old = current;
    current = url;
    target.replaceChildren(note, link);
    target.hidden = false;
    if (old) urls.revokeObjectURL(old);
    link.click();
    return link;
  }
  return Object.freeze({ offer, dispose });
}
