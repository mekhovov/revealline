import { localizedText } from '../i18n/index.mjs';

const onlineRoot = 'https://mekhovov.github.io/revealline/';

/** Content stays in the installed edition. Authoring and community destinations
 * are explicitly online tools and leave the running edition in its own tab. */
export function mountEditionNavigation({ provider, document: doc, href }) {
  const game = new URL(provider.href()),
    root = new URL(provider.rootURL);
  for (const link of doc.querySelectorAll('[data-release-explorer]')) {
    link.href = new URL('releases/', onlineRoot).href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    localizedText(link, () => 'Public releases (online)');
  }
  for (const label of doc.querySelectorAll('[data-i18n="interface:revealLineMenu"]'))
    localizedText(label, () => `${provider.selection.brand.name} / Menu`);
  for (const link of doc.querySelectorAll('a[href]')) {
    const target = new URL(link.getAttribute('href') || link.href, href);
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
      destination.search = target.search;
      destination.searchParams.set('edition', provider.editionId);
      destination.hash = target.hash;
      link.href = destination.href;
    } else if (/^game\/(?:controller-lab|replay-theater)(?:\/|$)/.test(relative)) {
      target.searchParams.set('edition', provider.editionId);
      link.href = target.href;
    }
  }
}
