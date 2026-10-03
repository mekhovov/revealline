import { t } from '../i18n/index.mjs';
import { studioReturnLinks } from './asset-studio-return.mjs';
import { workshopToolHref } from './workshop-return.mjs';

/** Content Studio is a descendant of Playground, not another Workshop opener.
 * Reuse the shared bounded Journey/language rule; never adopt a caller's return URL,
 * practice/session token, project ID or mission selection into a game route.
 */
export function contentStudioLinks(href) {
  const page = new URL(href);
  if (
    !/\/game\/(?:studio\/(?:(?:index|snake)\.html)?|playground\/(?:index\.html)?)$/.test(
      page.pathname,
    )
  )
    throw new TypeError(t('interface:useTheFixedContentStudioOrPlaygroundPage'));
  const { game } = studioReturnLinks(href);
  const studio = new URL('studio/', game);
  studio.search = new URL(game).search;
  return Object.freeze({
    game,
    playground: workshopToolHref(game, 'playground'),
    studio: studio.href,
  });
}

/** A preview may return to the fixed editor, never a caller-supplied destination. */
export function snakeStudioReturnHref(href) {
  let page;
  try {
    page = new URL(href);
  } catch {
    return null;
  }
  if (
    !['http:', 'https:', 'file:', 'capacitor:'].includes(page.protocol) ||
    page.username ||
    page.password ||
    !/\/game\/snake\/play\.html$/.test(page.pathname) ||
    page.searchParams.getAll('studio').length !== 1 ||
    page.searchParams.get('studio') !== 'snake'
  )
    return null;
  const target = new URL('../studio/snake.html', page);
  const languages = page.searchParams.getAll('lang');
  if (languages.length === 1 && ['en', 'uk'].includes(languages[0]))
    target.searchParams.set('lang', languages[0]);
  return target.href;
}

/** Early navigation only. Editor loading, focus, drafts and storage have separate owners. */
export function mountContentStudioLinks({ document: doc, href }) {
  const links = contentStudioLinks(href);
  for (const link of doc.querySelectorAll('[data-content-studio-route]')) {
    const key = link.getAttribute('data-content-studio-route');
    if (!Object.hasOwn(links, key)) continue;
    link.href = links[key];
    link.removeAttribute('inert');
    link.inert = false;
    link.removeAttribute('aria-disabled');
  }
}
