import { prepareOptionalOffline, removeOptionalInstallation } from '../install-context.mjs';
export const PRACTICE_CACHE_PREFIX = 'revealline.optional.civilian-flight.v1:';
export const practiceCachePrefix = (location) =>
  `${PRACTICE_CACHE_PREFIX}${new URL('./', location.href).pathname}:`;
export function preparePracticeOffline(options = {}) {
  return prepareOptionalOffline({ packageId: 'civilian-flight', ...options });
}
export async function removePracticeOffline({
  navigator = globalThis.navigator,
  caches = globalThis.caches,
  location = globalThis.location,
  storage = globalThis.localStorage,
} = {}) {
  const base = new URL('./', location.href);
  const registration = await navigator?.serviceWorker?.getRegistration(base.href);
  if (registration?.scope === base.href) await registration.unregister();
  for (const name of (await caches?.keys?.()) ?? [])
    if (name.startsWith(practiceCachePrefix(location))) await caches.delete(name);
  removeOptionalInstallation({ packageId: 'civilian-flight', location, storage });
}
