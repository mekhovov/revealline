import { getLocale, localizedText, onLocaleChange, t } from '../i18n/index.mjs';
import {
  optionalPracticeCatalogURL,
  loadOptionalPracticeCatalog,
  validateOptionalPracticeCatalog,
} from '../optional-practice-catalog.mjs';
import { loadPracticeDetails, validatePracticeDetails } from '../optional-practice-details.mjs';
import { fpvLaunchURL } from '../fpv-entry.mjs';
import { optionalPracticeSourcePreviews } from '../optional-practice-preview.mjs';

/** Explicit simulator navigation. Only a bounded entry page and the public
 * launcher catalog are inspected; the game never opens simulator storage or runs it. */
export function mountOptionalPracticePanel({
  document: doc,
  container,
  pause,
  href,
  fetcher,
  storage,
  timeoutMs = 10000,
  opener: existingOpener = null,
  packageId = null,
  bundledHref = null,
  idPrefix = 'optional-practice',
  preferDirect = false,
  navigate = (url) => (doc.defaultView ?? globalThis.window).location.assign(url),
}) {
  const indexURL = href && optionalPracticeCatalogURL(href);
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage;
    } catch {
      storage = null;
    }
  }
  if (!container || (!indexURL && !bundledHref)) return { dispose() {} };
  const sourcePreviews = optionalPracticeSourcePreviews(href, { packageId }).filter(
    (item) => !packageId || item.id === packageId,
  );
  const cacheKey = indexURL && 'revealline.practice-catalog.v1:' + indexURL;
  const tr = (key) => t('interface:optionalPractice.' + key);
  const node = (tag, key) => {
    const element = doc.createElement(tag);
    if (key) localizedText(element, () => tr(key));
    return element;
  };
  const opener = existingOpener ?? node('button', 'title');
  if (!existingOpener) {
    opener.type = 'button';
    opener.className = 'button secondary';
    opener.id = 'shell-optional-practice';
    container.append(opener);
  }
  const dialog = node('dialog');
  dialog.className = 'optional-practice-dialog';
  dialog.dataset.menuScope = idPrefix;
  dialog.id = `${idPrefix}-dialog`;
  dialog.setAttribute('aria-labelledby', `${idPrefix}-title`);
  const title = node('h2', packageId ? 'simTitle' : 'title');
  title.id = `${idPrefix}-title`;
  const note = node('p', packageId ? 'simNote' : 'note'),
    list = node('ul'),
    status = node('p');
  list.className = 'optional-practice-packages';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const retry = node('button', preferDirect ? 'simRetry' : 'refresh'),
    close = node('button', 'back');
  retry.id = `${idPrefix}-refresh`;
  close.id = `${idPrefix}-close`;
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
  let fallback = null,
    fallbackGuide = null;
  if (indexURL) {
    fallback = node('a', 'fpvGameAction');
    fallback.href =
      fpvLaunchURL(href, getLocale()) ??
      new URL('../optional-practice/civilian-fpv/index.html', indexURL).href;
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
    fallback.className = 'optional-practice-fallback';
    content.append(fallback);
    fallbackGuide = node('a', 'details');
    fallbackGuide.className = 'optional-practice-fallback';
    fallbackGuide.target = '_blank';
    fallbackGuide.rel = 'noopener noreferrer';
    fallbackGuide.href = new URL(
      'guide.html?lang=' + (getLocale() === 'uk' ? 'uk' : 'en'),
      fallback.href,
    ).href;
    content.append(fallbackGuide);
  }
  if (preferDirect && bundledHref) {
    const downloads = node('a', 'simDownloads');
    downloads.className = 'button secondary';
    downloads.href = new URL('../../game/downloads.html', bundledHref).href;
    content.append(downloads);
  }
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
    opener.removeAttribute('aria-busy');
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
  async function bundledEntry(signal) {
    if (!bundledHref) return null;
    const target = new URL(bundledHref),
      current = new URL(href);
    if (
      target.origin !== current.origin ||
      target.protocol !== current.protocol ||
      target.username ||
      target.password
    )
      return null;
    target.hash = '';
    const response = await (fetcher ?? globalThis.fetch)(target.href, {
      signal,
      cache: 'no-cache',
      credentials: 'omit',
      redirect: 'error',
    });
    if (!response.ok) return null;
    const limit = 128 * 1024,
      reader = response.body?.getReader();
    if (!reader) return null;
    if (Number(response.headers?.get('content-length') || 0) > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0,
      html = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (signal.aborted || size > limit) return null;
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
    if (
      !html.includes('data-fpv-worlds="true"') ||
      !html.includes('src="../civilian-fpv/world-app.mjs"')
    )
      return null;
    return bundledHref;
  }
  function reveal() {
    if (!dialog.open) dialog.showModal();
    close.focus({ preventScroll: true });
  }
  async function load({ direct = false } = {}) {
    cancel();
    const ticket = visit,
      controller = new AbortController();
    request = controller;
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    localizedText(status, () => tr('loading'));
    retry.disabled = true;
    opener.setAttribute('aria-busy', 'true');
    list.replaceChildren();
    try {
      let bundled = null;
      try {
        bundled = await bundledEntry(controller.signal);
      } catch {
        /* Fall back to the separately published launcher. */
      }
      if (disposed || ticket !== visit) return;
      if (bundled) {
        const row = node('li'),
          link = node('a', 'simOpen');
        const target = new URL(bundled);
        target.searchParams.set('lang', doc.documentElement.lang === 'uk' ? 'uk' : 'en');
        if (direct) {
          const owner = returnTo?.closest?.('dialog');
          if (doc.hidden || returnTo?.closest?.('[hidden],[inert]') || (owner && !owner.open))
            return;
          navigate(target.href);
          return;
        }
        link.href = target.href;
        link.onclick = () => {
          target.searchParams.set('lang', doc.documentElement.lang === 'uk' ? 'uk' : 'en');
          link.href = target.href;
        };
        // Gamepad polling is not a browser popup gesture. The checked bundled
        // destination can navigate this window after the host has paused.
        link.target = '_self';
        row.append(link);
        list.append(row);
        localizedText(status, () => tr('simReady'));
        return;
      }
      if (direct) reveal();
      if (!indexURL) throw new Error('No published package catalog is available for this host.');
      const packages = (
        await loadOptionalPracticeCatalog(indexURL, {
          fetcher,
          signal: controller.signal,
          missingIsEmpty: false,
        })
      ).filter((item) => !packageId || item.id === packageId);
      if (disposed || ticket !== visit) return;
      renderPackages(packages);
      localizedText(status, () =>
        tr(preferDirect ? 'simUnavailable' : packages.length ? 'ready' : 'empty'),
      );
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
      if (disposed || ticket !== visit) return;
      if (extra) renderPackages(packages, extra.details);
      try {
        if (cacheKey)
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
        if (direct) reveal();
        localizedText(status, () => tr(preferDirect ? 'simUnavailable' : 'unavailable'));
        if (!preferDirect && cacheKey) {
          try {
            const raw = storage?.getItem(cacheKey);
            if (!raw || raw.length > 120000) return;
            const saved = JSON.parse(raw);
            if (
              !/^\d{4}-\d\d-\d\dT/.test(saved.checked) ||
              !Number.isFinite(Date.parse(saved.checked))
            )
              return;
            const packages = validateOptionalPracticeCatalog(saved.catalog, indexURL).filter(
              (item) => !packageId || item.id === packageId,
            );
            let details;
            try {
              details = validatePracticeDetails(saved.details, packages, indexURL);
            } catch {
              /* Basic cards remain usable when optional metadata is stale. */
            }
            renderPackages(packages, details);
            localizedText(status, () => tr('cached') + ' ' + saved.checked);
          } catch {
            /* A corrupt cache does not replace the request error. */
          }
        }
      }
    } finally {
      if (ticket === visit) {
        clearTimeout(timeout);
        timeout = null;
        request = null;
        if (!disposed) retry.disabled = false;
        opener.removeAttribute('aria-busy');
      }
    }
  }
  const open = (trigger = opener) => {
    if (disposed) return;
    if (request && !dialog.open) return;
    if (dialog.open) {
      close.focus({ preventScroll: true });
      return;
    }
    returnTo = trigger;
    restoreOnClose = true;
    pause();
    if (!preferDirect) reveal();
    void load({ direct: preferDirect });
  };
  opener.onclick = () => open();
  retry.onclick = () => void load({ direct: preferDirect });
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
    if (fallback) {
      fallback.href = fpvLaunchURL(href, getLocale()) ?? fallback.href;
      fallbackGuide.href = new URL(
        'guide.html?lang=' + (getLocale() === 'uk' ? 'uk' : 'en'),
        fallback.href,
      ).href;
    }
    for (const link of list.querySelectorAll('a')) {
      const url = new URL(link.href);
      url.searchParams.set('lang', getLocale() === 'uk' ? 'uk' : 'en');
      link.href = url.href;
    }
  });
  dialog.addEventListener('close', onClose);
  const onOtherAction = (event) => {
    if (request && !dialog.open && !returnTo?.contains?.(event.target)) cancel();
  };
  doc.addEventListener('click', onOtherAction, true);
  return {
    open,
    root: () => (dialog.open ? dialog : null),
    primary: () => close,
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
      doc.removeEventListener('click', onOtherAction, true);
      dialog.remove();
      opener.onclick = null;
      if (!existingOpener) opener.remove();
    },
  };
}
