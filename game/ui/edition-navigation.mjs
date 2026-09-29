import { localizedText } from '../i18n/index.mjs';
import { isStudioPreview, STUDIO_PREVIEW_PARAMETER } from '../studio-preview-session.mjs';
import { gameDocumentURL } from '../community-routes.mjs';
import { editionPublicSlug } from '../edition-context.mjs';

const onlineRoot = 'https://mekhovov.github.io/revealline/';

/** Content stays in the installed edition. Authoring and community destinations
 * are explicitly online tools and leave the running edition in its own tab. */
export function mountEditionNavigation({ provider, document: doc, href }) {
  const game = new URL(provider.href()),
    root = new URL(provider.rootURL),
    documentURL = gameDocumentURL(href);
  for (const link of doc.querySelectorAll('[data-release-explorer]')) {
    link.href = new URL('releases/', onlineRoot).href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    localizedText(link, () => 'Public releases (online)');
  }
  for (const label of doc.querySelectorAll('[data-i18n="interface:revealLineMenu"]'))
    localizedText(label, () => `${provider.selection.brand.name} / Menu`);
  for (const link of doc.querySelectorAll('a[href]')) {
    const target = new URL(link.getAttribute('href') || link.href, documentURL);
    if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname)) continue;
    const relative = target.pathname.slice(root.pathname.length);
    if (/^game\/couch(?:\/|$)/.test(relative)) {
      link.hidden = true;
      continue;
    }
    if (relative === 'game/downloads.html') {
      link.href = `${game.href}#settings-data`;
      localizedText(link, () => 'Offline play & edition data');
      link.onclick = (event) => {
        event.preventDefault();
        doc.getElementById('settings-button').click();
        doc.getElementById('settings-tab-data').click();
      };
      continue;
    }
    if (
      /^(?:authoring\/|site\/|diagnostics\/|game\/(?:playground|community)(?:\/|$))/.test(relative)
    ) {
      const online = new URL(relative, onlineRoot);
      online.hash = target.hash;
      link.href = online.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const label = link.textContent.trim();
      localizedText(link, () => `${label} (online)`);
      continue;
    }
    if (['game/', 'game/index.html', 'game/company.html'].includes(relative)) {
      const destination = new URL(game.href);
      for (const [key, value] of target.searchParams)
        if (!['edition', 'presentation'].includes(key)) destination.searchParams.set(key, value);
      if (isStudioPreview(href)) destination.searchParams.set(STUDIO_PREVIEW_PARAMETER, '1');
      destination.hash = target.hash;
      link.href = destination.href;
    } else if (/^game\/(?:controller-lab|replay-theater)(?:\/|$)/.test(relative)) {
      target.searchParams.set('edition', editionPublicSlug(provider.editionId));
      if (provider.retainedPresentationId)
        target.searchParams.set('presentation', provider.retainedPresentationId);
      else target.searchParams.delete('presentation');
      link.href = target.href;
    }
  }
}
