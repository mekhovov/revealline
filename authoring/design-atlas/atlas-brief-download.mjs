import { getLocale, onLocaleChange } from '../../game/i18n/index.mjs';

const owners = new WeakMap();

/** Prepare the visible example as a plain-text download. Activation remains the
 * real anchor's native action; this owner never copies or downloads on its own. */
export function attachAtlasBriefDownload({
  document: doc = globalThis.document,
  window: win = doc.defaultView ?? globalThis.window,
} = {}) {
  const link = doc.getElementById('download-prompt'),
    brief = doc.getElementById('prompt-example-text');
  if (!link || !brief) return null;
  if (owners.has(link)) return owners.get(link);
  const urls = win.URL ?? globalThis.URL,
    BlobType = win.Blob ?? globalThis.Blob;
  let disposed = false,
    suspended = false,
    current = null;
  function retire() {
    link.removeAttribute('href');
    link.removeAttribute('download');
    link.hidden = true;
    if (current) urls.revokeObjectURL(current.url);
    current = null;
  }
  function refresh() {
    if (disposed || suspended) return;
    const text = brief.textContent,
      locale = getLocale() === 'uk' ? 'uk' : 'en';
    if (current?.text === text && current.locale === locale) return;
    if (!urls?.createObjectURL || !urls?.revokeObjectURL || !BlobType) {
      retire();
      return;
    }
    const url = urls.createObjectURL(new BlobType([text], { type: 'text/plain;charset=utf-8' }));
    retire();
    current = { url, text, locale };
    link.href = url;
    link.download = `fpv-line-atlas-example-brief-${locale}.txt`;
    link.hidden = false;
  }
  // Retire the old language before bindings update, then capture the final
  // translated DOM independent of listener registration order.
  const stopLocale = onLocaleChange(
    () => {
      retire();
      return refresh;
    },
    { before: true },
  );
  const hide = (event) => {
    suspended = true;
    retire();
    if (!event.persisted) owner.destroy();
  };
  const show = (event) => {
    if (!event.persisted || disposed) return;
    suspended = false;
    refresh();
  };
  const owner = {
    refresh,
    destroy() {
      if (disposed) return;
      disposed = true;
      stopLocale();
      win.removeEventListener('pagehide', hide);
      win.removeEventListener('pageshow', show);
      retire();
      owners.delete(link);
    },
  };
  owners.set(link, owner);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  refresh();
  return owner;
}
