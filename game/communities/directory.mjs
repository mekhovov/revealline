import { communityDirectoryReturnURL } from '../community-routes.mjs';
import { attachLauncherNavigation } from '../ui/launcher-navigation.mjs';

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
  return attachLauncherNavigation({
    document: doc,
    window: win,
    getDefaultFocus: () => back,
    onBack: () => back.click(),
  });
}

if (globalThis.document?.getElementById('community-return')) mountCommunityDirectory();
