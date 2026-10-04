import { validateClassicSnakePackage } from '../snake/classic-community.mjs';

/** Pin the selected native package entry before installation can yield. The
 * caller owns foreground intent; a completed storage transaction alone never
 * authorizes navigation, and cancellation never removes another local owner. */
export async function prepareSnakeStudioPlay({
  source,
  selectedIndex,
  mode,
  locale,
  baseURL,
  install,
  isCurrent,
}) {
  const pack = validateClassicSnakePackage(source);
  if (!['solo', 'versus', 'team'].includes(mode)) throw new TypeError('Invalid Snake play mode.');
  if (!Number.isSafeInteger(selectedIndex) || !pack.entries[selectedIndex])
    throw new TypeError('Choose a Snake mission before playing.');
  if (!isCurrent()) return null;
  let installed;
  try {
    installed = await install(pack, { owner: 'studio' });
  } catch (error) {
    if (!isCurrent()) return null;
    throw error;
  }
  if (!isCurrent()) return null;
  const url = new URL('../snake/play.html', baseURL);
  url.search = new URLSearchParams({
    mode,
    community: installed.identity,
    level: installed.entries[selectedIndex].id,
    lang: locale,
    studio: 'snake',
  }).toString();
  return url.href;
}
