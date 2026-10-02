import { localizedText, t } from '../i18n/index.mjs';
import {
  optionalPracticeCatalogURL,
  loadOptionalPracticeCatalog,
} from '../optional-practice-catalog.mjs';
import { optionalPracticeSourcePreviews } from '../optional-practice-preview.mjs';
import { appearanceLaunchURL } from '../fpv-entry.mjs';

/** A shared explicit exit to an independently installed optional package. No
 * package content, progress store or simulation is admitted to the core game. */
export function mountOptionalPracticePanel({
  document: doc,
  container,
  pause,
  href,
  fetcher,
  timeoutMs = 10000,
  getAppearanceDefault = () => null,
}) {
  const indexURL = href && optionalPracticeCatalogURL(href);
  if (!container || !indexURL) return { dispose() {} };
  const sourcePreviews = optionalPracticeSourcePreviews(href);
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
  dialog.className = 'optional-practice-dialog';
  dialog.id = 'optional-practice-dialog';
  dialog.setAttribute('aria-labelledby', 'optional-practice-title');
  const title = node('h2', 'title');
  title.id = 'optional-practice-title';
  const note = node('p', 'note'),
    list = node('ul'),
    status = node('p');
  list.className = 'optional-practice-packages';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const retry = node('button', 'refresh'),
    close = node('button', 'back');
  retry.id = 'optional-practice-refresh';
  close.id = 'optional-practice-close';
  for (const button of [retry, close]) {
    button.type = 'button';
    button.className = 'button secondary';
  }
  const heading = node('header'),
    content = node('div'),
    footer = node('footer');
  content.className = 'optional-practice-content';
  heading.append(title, close);
  content.append(note, status, list);
  footer.append(retry);
  if (sourcePreviews.length) {
    const preview = node('section'),
      previewTitle = node('h3', 'sourcePreviews'),
      previewNote = node('p', 'sourcePreviewNote'),
      previews = node('ul');
    preview.className = 'optional-practice-source-previews';
    previews.className = 'optional-practice-packages';
    for (const item of sourcePreviews) {
      const row = node('li'),
        link = node('a', item.titleKey);
      link.href = appearanceLaunchURL(item.url, getAppearanceDefault(), { transfer: false });
      link.onclick = () => {
        link.href = appearanceLaunchURL(item.url, getAppearanceDefault(), {
          window: doc.defaultView,
        });
      };
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('data-practice-source-preview', item.id);
      row.append(link);
      previews.append(row);
    }
    preview.append(previewTitle, previewNote, previews);
    content.append(preview);
  }
  dialog.append(heading, content, footer);
  doc.body.append(dialog);
  let disposed = false,
    request = null,
    timeout = null,
    visit = 0,
    returnTo = opener,
    restoreOnClose = true;
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
        link.href = appearanceLaunchURL(item.url, getAppearanceDefault(), { transfer: false });
        link.onclick = () => {
          link.href = appearanceLaunchURL(item.url, getAppearanceDefault(), {
            window: doc.defaultView,
          });
        };
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const version = node('small');
        version.textContent = item.version;
        row.append(link, version);
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
  const open = (trigger = opener) => {
    if (disposed) return;
    if (dialog.open) {
      close.focus({ preventScroll: true });
      return;
    }
    returnTo = trigger;
    restoreOnClose = true;
    pause();
    dialog.showModal();
    close.focus({ preventScroll: true });
    void load();
  };
  opener.onclick = () => open();
  retry.onclick = () => void load();
  close.onclick = () => dialog.close();
  const onClose = () => {
    if (dialog.open) return;
    cancel();
    list.replaceChildren();
    const owner = returnTo?.closest?.('dialog');
    if (
      restoreOnClose &&
      !doc.hidden &&
      (!doc.hasFocus || doc.hasFocus()) &&
      returnTo?.isConnected &&
      !returnTo.disabled &&
      !returnTo.closest?.('[hidden],[inert]') &&
      (!owner || owner.open)
    )
      returnTo.focus({ preventScroll: true });
  };
  dialog.addEventListener('close', onClose);
  return {
    open,
    close({ restoreFocus = true } = {}) {
      restoreOnClose = restoreFocus;
      cancel();
      if (dialog.open) dialog.close();
    },
    dispose() {
      disposed = true;
      cancel();
      dialog.removeEventListener('close', onClose);
      dialog.remove();
      opener.onclick = null;
      opener.remove();
    },
  };
}
