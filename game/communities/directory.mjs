import { COMMUNITY_ROUTES, communityDirectoryReturnURL } from '../community-routes.mjs';
import { attachLauncherNavigation } from '../ui/launcher-navigation.mjs';
import { localizedText, t } from '../i18n/index.mjs';

export function mountCommunityDirectory({
  document: doc = globalThis.document,
  window: win = globalThis.window,
} = {}) {
  const back = doc.getElementById('community-return');
  const address = new URL(win.location.href);
  back.href = communityDirectoryReturnURL(
    address.searchParams.get('return') || '../',
    address,
  ).href;
  for (const route of COMMUNITY_ROUTES) {
    const entry = doc.querySelector(`a.community-entry[href="./${route.slug}/"]`);
    if (!entry) continue;
    const download = doc.createElement('a');
    download.className = 'community-download';
    const target = new URL('../downloads.html', address);
    target.searchParams.set('community', route.slug);
    download.href = target.href;
    localizedText(download, () => t('interface:downloads.prepareCommunity'));
    entry.insertAdjacentElement('afterend', download);
  }
  return attachLauncherNavigation({
    document: doc,
    window: win,
    getDefaultFocus: () => back,
    onBack: () => back.click(),
  });
}

if (globalThis.document?.getElementById('community-return')) mountCommunityDirectory();
