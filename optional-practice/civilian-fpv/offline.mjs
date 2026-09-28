import { recordOptionalInstallation, removeOptionalInstallation } from '../install-context.mjs';
export const PRACTICE_CACHE_PREFIX = 'revealline.optional.package.v1:';
export const practiceCachePrefix = (location) =>
  `${PRACTICE_CACHE_PREFIX}${new URL('./', location.href).pathname}:`;
export async function preparePracticeOffline({
  navigator = globalThis.navigator,
  location = globalThis.location,
  storage = globalThis.localStorage,
} = {}) {
  if (!navigator?.serviceWorker) throw new Error('Service workers unavailable');
  const base = new URL('./', location.href);
  const registration = await navigator.serviceWorker.register(new URL('worker.js', base), {
    scope: base.pathname,
  });
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error('Optional practice worker unavailable');
  const record = () => {
    recordOptionalInstallation({ packageId: 'civilian-fpv', location, storage });
    return true;
  };
  if (worker.state === 'activated') return record();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Optional practice install timed out')), 15000);
    const change = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant')
        finish(new Error('Optional practice verification failed'));
    };
    const finish = (error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', change);
      if (error) reject(error);
      else {
        try {
          resolve(record());
        } catch (failure) {
          reject(failure);
        }
      }
    };
    worker.addEventListener('statechange', change);
    change();
  });
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
  removeOptionalInstallation({ packageId: 'civilian-fpv', location, storage });
}
