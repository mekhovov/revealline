import { localizedText, t } from '../i18n/index.mjs';
import {
  optionalPracticeCatalogURL,
  loadOptionalPracticeCatalog,
} from '../optional-practice-catalog.mjs';

/** A shared explicit exit to an independently installed optional package. No
 * package content, progress store or simulation is admitted to the core game. */
export function mountOptionalPracticePanel({
  document: doc,
  container,
  pause,
  href,
  fetcher,
  timeoutMs = 10000,
}) {
  const indexURL = href && optionalPracticeCatalogURL(href);
  if (!container || !indexURL) return { dispose() {} };
  const tr = (key) => t('interface:optionalPractice.' + key);
  const node = (tag, key) => {
    const element = doc.createElement(tag);
    if (key) localizedText(element, () => tr(key));
    return element;
  };
  const opener = node('button', 'title');
  opener.type = 'button';
  opener.className = 'button secondary';
  opener.id = 'shell-optional-practice';
  container.append(opener);
  const dialog = node('dialog');
  dialog.className = 'shell-workshop-dialog';
  dialog.id = 'optional-practice-dialog';
  dialog.setAttribute('aria-labelledby', 'optional-practice-title');
  const title = node('h2', 'title');
  title.id = 'optional-practice-title';
  const note = node('p', 'note'),
    list = node('ul'),
    status = node('p');
  status.setAttribute('role', 'status');
  const retry = node('button', 'refresh'),
    close = node('button', 'back');
  for (const button of [retry, close]) {
    button.type = 'button';
    button.className = 'button secondary';
  }
  dialog.append(title, note, status, list, retry, close);
  doc.body.append(dialog);
  let disposed = false,
    request = null,
    timeout = null,
    visit = 0;
  function cancel() {
    visit++;
    request?.abort();
    clearTimeout(timeout);
    timeout = null;
    request = null;
    retry.disabled = false;
  }
  async function load() {
    cancel();
    const ticket = visit,
      controller = new AbortController();
    request = controller;
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    localizedText(status, () => tr('loading'));
    retry.disabled = true;
    list.replaceChildren();
    try {
      const packages = await loadOptionalPracticeCatalog(indexURL, {
        fetcher,
        signal: controller.signal,
      });
      if (disposed || ticket !== visit || !dialog.open) return;
      for (const item of packages) {
        const row = node('li'),
          link = node('a');
        link.textContent = item.name;
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        row.append(link);
        list.append(row);
      }
      localizedText(status, () => tr(packages.length ? 'ready' : 'empty'));
    } catch {
      if (!disposed && ticket === visit) localizedText(status, () => tr('unavailable'));
    } finally {
      if (ticket === visit) {
        clearTimeout(timeout);
        timeout = null;
        if (!disposed) retry.disabled = false;
      }
    }
  }
  opener.onclick = () => {
    pause();
    dialog.showModal();
    close.focus({ preventScroll: true });
    void load();
  };
  retry.onclick = () => void load();
  close.onclick = () => dialog.close();
  const onClose = () => {
    if (dialog.open) return;
    cancel();
    list.replaceChildren();
    if (opener.isConnected) opener.focus({ preventScroll: true });
  };
  dialog.addEventListener('close', onClose);
  return {
    dispose() {
      disposed = true;
      cancel();
      dialog.removeEventListener('close', onClose);
      dialog.remove();
      opener.remove();
    },
  };
}
