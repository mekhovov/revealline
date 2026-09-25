import { t } from '../i18n/index.mjs';
import { studioReturnLinks } from './asset-studio-return.mjs';
import { workshopToolHref } from './workshop-return.mjs';

/** Content Studio is a descendant of Playground, not another Workshop opener.
 * Reuse the shared bounded Journey rule; never adopt a caller's return URL,
 * practice/session token, project ID or mission selection into a game route.
 */
export function contentStudioLinks(href) {
  const page = new URL(href);
  if (!/\/game\/(?:studio|playground)\/(?:index\.html)?$/.test(page.pathname))
    throw new TypeError(t("interface:useTheFixedContentStudioOrPlaygroundPage"));
  const { game } = studioReturnLinks(href);
  const studio = new URL('studio/', game);
  studio.search = new URL(game).search;
  return Object.freeze({
    game,
    playground: workshopToolHref(game, 'playground'),
    studio: studio.href,
  });
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
