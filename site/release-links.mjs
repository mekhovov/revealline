import { releaseExplorerHref } from '../game/release-explorer.mjs';

/** Only explicit Open build links use this resolver; it never navigates. */
export function archivedPlayHref(play) {
  if (typeof play !== 'string' || play.length > 2048 || /[\s\\%?#]/.test(play)) return null;
  const suffix = '[A-Za-z0-9][A-Za-z0-9._-]{0,63}/site/game/(?:index\\.html)?';
  if (play.includes('..')) return null;
  if (new RegExp(`^${suffix}$`).test(play)) return `../releases/${play}`;
  if (!play.startsWith('https://')) return null;
  try {
    const url = new URL(play);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      !new RegExp(`^/(?:[A-Za-z0-9._~-]+/)*releases/${suffix}$`).test(url.pathname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

/** About is alongside its edition's game entry, including frozen site/site URLs. */
export function releaseHistoryHref(pageHref) {
  const page = new URL(pageHref);
  // This project's numbered archives preserve immutable sites but publish only
  // an HTML catalogue redirect. Its JSON catalogue belongs to the main site.
  if (
    page.origin === 'https://mekhovov.github.io' &&
    !page.username &&
    !page.password &&
    /^\/revealline-archive-\d{2,}\/releases\/v\d+\.\d+\.\d+\/site\/site\/about\.html$/.test(
      page.pathname,
    )
  )
    return 'https://mekhovov.github.io/revealline/releases/';
  return releaseExplorerHref(new URL('../game/', page).href);
}

/** Rebase only the existing validator's local form; canonical archive URLs stay exact. */
export function archivedPlayHrefFromCatalog(play, catalogIndexHref) {
  const checked = archivedPlayHref(play);
  if (checked?.startsWith('../releases/'))
    return new URL(checked.slice('../releases/'.length), catalogIndexHref).href;
  return checked;
}
