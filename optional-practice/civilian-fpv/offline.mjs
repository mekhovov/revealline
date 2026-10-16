import { prepareOptionalOffline, removeOptionalOffline } from '../install-context.mjs';
export const PRACTICE_CACHE_PREFIX = 'revealline.optional.package.v1:';
export const practiceCachePrefix = (location) =>
  `${PRACTICE_CACHE_PREFIX}${new URL('./', location.href).pathname}:`;
export function preparePracticeOffline(options = {}) {
  return prepareOptionalOffline({ packageId: 'civilian-fpv', ...options });
}
export function removePracticeOffline(options = {}) {
  return removeOptionalOffline({ packageId: 'civilian-fpv', ...options });
}

/** Native controls own their pending UI; the shared installer owns the files.
 * Removing runtime files never opens the worlds or flight-record stores. */
export function mountPracticeOfflineControls({
  prepareButton,
  removeButton,
  packageId,
  document: doc = globalThis.document,
  window: win = globalThis.window,
  storage,
  onStatus = () => {},
  prepare = preparePracticeOffline,
  remove = removePracticeOffline,
}) {
  const available =
    /^https?:$/.test(new URL(win.location.href).protocol) &&
    win.isSecureContext !== false &&
    !!win.navigator?.serviceWorker;
  let pending = null,
    disposed = false;
  const refresh = () => {
    for (const button of [prepareButton, removeButton])
      if (button) button.disabled = !available || !!pending || disposed;
  };
  async function perform(kind, operation) {
    if (!available || pending || disposed) return;
    const owner = new AbortController();
    pending = owner;
    refresh();
    onStatus(kind === 'prepare' ? 'preparing' : 'removing');
    try {
      await operation({
        packageId,
        document: doc,
        progressParent:
          (kind === 'prepare' ? prepareButton : removeButton)?.closest?.('dialog[open]') ??
          doc?.body,
        navigator: win.navigator,
        location: win.location,
        caches: win.caches,
        storage,
        signal: owner.signal,
      });
      if (!disposed && !owner.signal.aborted) onStatus(kind === 'prepare' ? 'ready' : 'removed');
    } catch (error) {
      if (!disposed) onStatus(error.name === 'AbortError' ? 'cancelled' : 'error', error);
    } finally {
      if (pending === owner) pending = null;
      if (!disposed) refresh();
    }
  }
  const download = () => void perform('prepare', prepare),
    offload = () => void perform('remove', remove),
    suspend = () => pending?.abort();
  prepareButton?.addEventListener('click', download);
  removeButton?.addEventListener('click', offload);
  win.addEventListener('pagehide', suspend);
  refresh();
  return Object.freeze({
    available,
    dispose() {
      if (disposed) return;
      disposed = true;
      suspend();
      prepareButton?.removeEventListener('click', download);
      removeButton?.removeEventListener('click', offload);
      win.removeEventListener('pagehide', suspend);
      refresh();
    },
  });
}
