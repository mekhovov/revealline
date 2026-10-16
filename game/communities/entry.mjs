import { communityEntryURL, communityRouteFromURL, gameDocumentURL } from '../community-routes.mjs';

const MAX_DOCUMENT_BYTES = 1024 * 1024;
const URL_ATTRIBUTES = [
  'src',
  'href',
  'data-boot-href',
  'poster',
  'action',
  'formaction',
  'xlink:href',
];

function absoluteReference(value, base) {
  // Empty reload links and in-page fragments belong to the visible community URL.
  if (!value.trim() || value.trim().startsWith('#')) return value;
  return new URL(value, base).href;
}

function cssReferences(value, base) {
  return value
    .replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi, (_, double, single, bare) => {
      const url = absoluteReference(double ?? single ?? bare, base);
      return `url(${JSON.stringify(url)})`;
    })
    .replace(
      /(@import\s+)(['"])([^'"]+)\2/gi,
      (_, prefix, quote, path) => `${prefix}${quote}${absoluteReference(path, base)}${quote}`,
    );
}

function sourceSet(value, base) {
  // URLs (including data URLs with commas) end at whitespace. Descriptors end
  // at the next comma; parenthesized future descriptors remain one token.
  const candidates = [];
  let position = 0;
  while (position < value.length) {
    while (/[\s,]/.test(value[position] ?? '') && position < value.length) position++;
    const start = position;
    while (position < value.length && !/\s/.test(value[position])) position++;
    let url = value.slice(start, position);
    if (!url) break;
    let descriptor = '';
    if (url.endsWith(',')) url = url.replace(/,+$/, '');
    else {
      const descriptorStart = position;
      let depth = 0;
      while (position < value.length) {
        const character = value[position];
        if (character === ',' && !depth) break;
        if (character === '(') depth++;
        if (character === ')') depth = Math.max(0, depth - 1);
        position++;
      }
      descriptor = value.slice(descriptorStart, position).trim();
    }
    candidates.push(`${absoluteReference(url, base)}${descriptor ? ` ${descriptor}` : ''}`);
  }
  return candidates.join(', ');
}

/** Reuse the shipped Solo document without a second host template or <base>.
 * DOMParser keeps scripts inert until the validated document is written once. */
export function prepareCommunityDocument(
  source,
  { documentURL, recoveryURL = null, DOMParserClass = globalThis.DOMParser } = {},
) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > MAX_DOCUMENT_BYTES)
    throw new Error('The shared game document is too large.');
  const base = new URL(documentURL);
  const parsed = new DOMParserClass().parseFromString(source, 'text/html');
  const boot = [...parsed.querySelectorAll('script[src]')].find(
    (script) => new URL(script.getAttribute('src'), base).href === new URL('boot.mjs', base).href,
  );
  if (
    !parsed.doctype ||
    parsed.doctype.name.toLowerCase() !== 'html' ||
    parsed.querySelector('base') ||
    !parsed.querySelector('#boot-screen') ||
    !parsed.querySelector('#boot-status') ||
    !boot ||
    boot.getAttribute('type') === 'module' ||
    parsed.documentElement.getAttribute('data-boot-state') !== 'loading'
  )
    throw new Error('The shared game document is unavailable.');

  for (const attribute of URL_ATTRIBUTES)
    for (const element of parsed.querySelectorAll(`[${attribute.replace(':', '\\:')}]`))
      element.setAttribute(attribute, absoluteReference(element.getAttribute(attribute), base));
  for (const element of parsed.querySelectorAll('[srcset]'))
    element.setAttribute('srcset', sourceSet(element.getAttribute('srcset'), base));
  for (const element of parsed.querySelectorAll('[style]'))
    element.setAttribute('style', cssReferences(element.getAttribute('style'), base));
  for (const element of parsed.querySelectorAll('style'))
    element.textContent = cssReferences(element.textContent, base);
  for (const marker of parsed.querySelectorAll('meta[name="revealline-offline"]')) {
    const config = JSON.parse(marker.getAttribute('content'));
    if (config.format !== 'revealline-offline.v1')
      throw new Error('The shared game offline configuration is unavailable.');
    for (const key of ['scope', 'worker']) {
      if (typeof config[key] !== 'string')
        throw new Error('The shared game offline configuration is incomplete.');
      const target = new URL(config[key], base);
      if (target.origin !== base.origin || target.username || target.password)
        throw new Error('The shared game offline configuration points outside this site.');
      config[key] = target.href;
    }
    marker.setAttribute('content', JSON.stringify(config));
  }
  if (recoveryURL) parsed.querySelector('#boot-online')?.setAttribute('href', recoveryURL);
  return `<!doctype html>\n${parsed.documentElement.outerHTML}`;
}

/** Only fetch the known shared host. Friendly URL, history and saves stay owned
 * by the current page; the runtime derives its company from that visible URL. */
export async function loadCommunityEntry({
  documentRef = globalThis.document,
  locationRef = globalThis.location,
  windowRef = globalThis.window,
  fetcher = globalThis.fetch,
  DOMParserClass = globalThis.DOMParser,
  timeoutMs = 20_000,
} = {}) {
  const href = locationRef.href;
  const controller = new AbortController();
  const leave = () => controller.abort();
  const timeout = setTimeout(leave, timeoutMs);
  windowRef?.addEventListener('pagehide', leave, { once: true });
  try {
    const route = communityRouteFromURL(href);
    if (!route) throw new Error('Choose a known community address.');
    const fallback = documentRef.getElementById('community-fallback');
    const safe = new URL(href);
    safe.search = '';
    safe.hash = '';
    if (fallback) fallback.href = communityEntryURL(safe).href;
    // A conflicting edition query must fail before any host request or write.
    const selected = communityEntryURL(href);
    const shared = gameDocumentURL(href);
    shared.search = '';
    shared.hash = '';
    const response = await fetcher(shared.href, {
      credentials: 'same-origin',
      mode: 'same-origin',
      redirect: 'error',
      signal: controller.signal,
    });
    if (
      !response.ok ||
      response.redirected ||
      new URL(response.url).href !== shared.href ||
      !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')
    )
      throw new Error('The shared game could not be loaded from this site.');
    const declaredSize = Number(response.headers.get('content-length'));
    if (declaredSize > MAX_DOCUMENT_BYTES)
      throw new Error('The shared game document is too large.');
    const markup = prepareCommunityDocument(await response.text(), {
      documentURL: shared,
      recoveryURL: selected.href,
      DOMParserClass,
    });
    if (controller.signal.aborted || locationRef.href !== href) return false;
    documentRef.open();
    documentRef.write(markup);
    documentRef.close();
    return true;
  } catch {
    if (locationRef.href === href) {
      documentRef.documentElement.dataset.communityEntry = 'failed';
      const status = documentRef.getElementById('community-status');
      if (status)
        status.textContent =
          'This community could not open. Reload or use the direct game link below. / Не вдалося відкрити спільноту. Перезавантажте сторінку або скористайтеся посиланням нижче.';
    }
    return false;
  } finally {
    clearTimeout(timeout);
    windowRef?.removeEventListener('pagehide', leave);
  }
}

if (globalThis.document?.documentElement?.hasAttribute('data-community-entry'))
  void loadCommunityEntry();
