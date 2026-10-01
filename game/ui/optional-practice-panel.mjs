import { getLocale, localizedText, onLocaleChange, t } from '../i18n/index.mjs';
import {
  optionalPracticeCatalogURL,
  loadOptionalPracticeCatalog,
  validateOptionalPracticeCatalog,
} from '../optional-practice-catalog.mjs';
import { loadPracticeDetails, validatePracticeDetails } from '../optional-practice-details.mjs';
import { fpvLaunchURL } from '../fpv-entry.mjs';
import { optionalPracticeSourcePreviews } from '../optional-practice-preview.mjs';

/** A shared explicit exit to an independently installed optional package. No
 * package content, progress store or simulation is admitted to the core game. */
export function mountOptionalPracticePanel({
  document: doc,
  container,
  pause,
  href,
  fetcher,
  storage,
  timeoutMs = 10000,
}) {
  const indexURL = href && optionalPracticeCatalogURL(href);
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage;
    } catch {
      storage = null;
    }
  }
  if (!container || !indexURL) return { dispose() {} };
  const sourcePreviews = optionalPracticeSourcePreviews(href);
  const cacheKey = 'revealline.practice-catalog.v1:' + indexURL;
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
  const fallback = node('a', 'fpvGameAction');
  fallback.href =
    fpvLaunchURL(href, getLocale()) ??
    new URL('../optional-practice/civilian-fpv/index.html', indexURL).href;
  fallback.target = '_blank';
  fallback.rel = 'noopener noreferrer';
  fallback.className = 'optional-practice-fallback';
  content.append(fallback);
  const fallbackGuide = node('a', 'details');
  fallbackGuide.className = 'optional-practice-fallback';
  fallbackGuide.target = '_blank';
  fallbackGuide.rel = 'noopener noreferrer';
  fallbackGuide.href = new URL(
    'guide.html?lang=' + (getLocale() === 'uk' ? 'uk' : 'en'),
    fallback.href,
  ).href;
  content.append(fallbackGuide);
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
      link.href = item.url;
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
  function renderPackages(packages, details = new Map()) {
    list.replaceChildren();
    for (const item of packages) {
      const row = node('li'),
        heading = node('h3'),
        summary = details.get(item.id);
      localizedText(
        heading,
        () => summary?.description.copy[getLocale() === 'uk' ? 'uk' : 'en'].name ?? item.name,
      );
      row.append(heading);
      if (summary) {
        const preview = node('img');
        preview.src = summary.previewURL;
        preview.alt = '';
        preview.loading = 'lazy';
        preview.width = 800;
        preview.height = 700;
        preview.onerror = () => {
          preview.hidden = true;
        };
        row.append(preview);
        for (const key of ['description', 'purpose', 'inputs', 'requirements']) {
          const paragraph = node('p');
          localizedText(
            paragraph,
            () => summary.description.copy[getLocale() === 'uk' ? 'uk' : 'en'][key],
          );
          row.append(paragraph);
        }
      }
      const version = node('small');
      version.textContent =
        item.version + (summary ? ` · ${(summary.downloadBytes / 1048576).toFixed(1)} MiB` : '');
      const play = node('a', 'play'),
        guide = node('a', 'details');
      play.href = item.url + '?action=play&lang=' + (getLocale() === 'uk' ? 'uk' : 'en');
      guide.href = item.url + '?lang=' + (getLocale() === 'uk' ? 'uk' : 'en');
      for (const link of [play, guide]) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      row.append(version, play, guide);
      list.append(row);
    }
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
        missingIsEmpty: false,
      });
      if (disposed || ticket !== visit || !dialog.open) return;
      renderPackages(packages);
      localizedText(status, () => tr(packages.length ? 'ready' : 'empty'));
      let extra = null;
      if (packages.length) {
        try {
          extra = await loadPracticeDetails(indexURL, packages, {
            fetcher,
            signal: controller.signal,
          });
        } catch {
          /* Optional metadata must never block a valid v1 launch. */
        }
      }
      if (disposed || ticket !== visit || !dialog.open) return;
      if (extra) renderPackages(packages, extra.details);
      try {
        storage?.setItem(
          cacheKey,
          JSON.stringify({
            checked: new Date().toISOString(),
            catalog: {
              format: 'revealline-optional-package-launchers.v1',
              packages: packages.map(({ url: _url, ...item }) => item),
            },
            details: extra?.raw,
          }),
        );
      } catch {
        /* Browsing also works with denied or full storage. */
      }
    } catch {
      if (!disposed && ticket === visit) {
        localizedText(status, () => tr('unavailable'));
        try {
          const raw = storage?.getItem(cacheKey);
          if (!raw || raw.length > 120000) return;
          const saved = JSON.parse(raw);
          if (
            !/^\d{4}-\d\d-\d\dT/.test(saved.checked) ||
            !Number.isFinite(Date.parse(saved.checked))
          )
            return;
          const packages = validateOptionalPracticeCatalog(saved.catalog, indexURL);
          let details;
          try {
            details = validatePracticeDetails(saved.details, packages, indexURL);
          } catch {
            /* basic cards */
          }
          renderPackages(packages, details);
          localizedText(status, () => tr('cached') + ' ' + saved.checked);
        } catch {
          /* A corrupt cache does not replace the request error. */
        }
      }
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
  const unsubscribeLocale = onLocaleChange(() => {
    fallback.href = fpvLaunchURL(href, getLocale()) ?? fallback.href;
    fallbackGuide.href = new URL(
      'guide.html?lang=' + (getLocale() === 'uk' ? 'uk' : 'en'),
      fallback.href,
    ).href;
    for (const link of list.querySelectorAll('a')) {
      const url = new URL(link.href);
      url.searchParams.set('lang', getLocale() === 'uk' ? 'uk' : 'en');
      link.href = url.href;
    }
  });
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
      unsubscribeLocale();
      cancel();
      dialog.removeEventListener('close', onClose);
      dialog.remove();
      opener.onclick = null;
      opener.remove();
    },
  };
}
