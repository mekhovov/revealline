import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { createOfflineDownloadAccess } from '../offline-download-access.mjs';
import { offlineAvailability, checkOffline } from '../offline.mjs';
import { attachInstallOfflinePanel } from './install-offline-panel.mjs';

/** Admit the complete selected company package before its first ordinary asset
 * URL can load. The temporary panel has no profile migration/activation authority. */
export async function loadCompanyStartup({
  documentRef = globalThis.document,
  locationRef = globalThis.location,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
  offlineLocationRef = documentRef?.defaultView?.location ?? windowRef?.location ?? locationRef,
  availability = offlineAvailability({
    documentRef,
    locationRef: offlineLocationRef,
    navigatorRef,
  }),
  loadProvider = loadRuntimeContentProvider,
  createAccess = createOfflineDownloadAccess,
  createPanel = attachInstallOfflinePanel,
  checkCore = checkOffline,
  ...options
} = {}) {
  const controller = new AbortController();
  let panel = null,
    releaseInput = null;
  const abort = () =>
    controller.abort(new DOMException('Company startup cancelled.', 'AbortError'));
  const hidden = () => {
    if (documentRef?.hidden) abort();
  };
  const release = () => {
    releaseInput?.();
    releaseInput = null;
  };
  windowRef?.addEventListener?.('pagehide', abort);
  documentRef?.addEventListener?.('visibilitychange', hidden);
  const requestPackage = async (request) => {
    controller.signal.throwIfAborted();
    if (documentRef?.hidden) abort();
    controller.signal.throwIfAborted();
    panel ||= createPanel({
      document: documentRef,
      window: windowRef,
      mountRoot: documentRef?.getElementById?.('boot-screen') ?? documentRef?.body,
      downloadsURL: new URL('../downloads.html', import.meta.url),
      canActivate: () => false,
      onOpen: () => {
        releaseInput ||= windowRef?.RevealLineBoot?.suspendInput?.();
      },
      onClose: release,
    });
    await panel.requestPackage({ ...request, signal: controller.signal });
    controller.signal.throwIfAborted();
  };
  const access = createAccess({ availability, requestPackage });
  // Read-only verification: neither register a worker nor force its activation.
  const reachable = async () => {
    controller.signal.throwIfAborted();
    const worker = navigatorRef?.serviceWorker?.controller;
    const registration = await navigatorRef?.serviceWorker?.getRegistration(availability.scope);
    controller.signal.throwIfAborted();
    if (
      !worker ||
      registration?.scope !== availability.scope ||
      registration.active !== worker ||
      registration.waiting ||
      registration.installing ||
      worker.scriptURL !== new URL('service-worker.js', availability.scope).href
    )
      return false;
    const report = await checkCore({
      documentRef,
      locationRef: offlineLocationRef,
      navigatorRef,
      signal: controller.signal,
    });
    controller.signal.throwIfAborted();
    return (
      report.status === 'ready' &&
      report.buildId === availability.buildId &&
      navigatorRef.serviceWorker.controller === worker &&
      registration.active === worker &&
      !registration.waiting &&
      !registration.installing
    );
  };
  let admittedWorker = null;
  const changed = () => {
    if (admittedWorker) abort();
  };
  navigatorRef?.serviceWorker?.addEventListener?.('controllerchange', changed);
  try {
    return await loadProvider({
      ...options,
      documentRef,
      locationRef,
      signal: controller.signal,
      ensurePackage: async (groupId, { requiresAssets = true } = {}) => {
        if (!availability.available || !availability.packageConsent) return;
        await access.ensure(groupId, { signal: controller.signal, retain: true });
        controller.signal.throwIfAborted();
        if (!requiresAssets) return;
        if (!(await reachable())) {
          // A cache reused from another edition is not proof that this document
          // can read it. The existing explicit surface also prepares core files.
          await requestPackage({ groupId });
          if (!(await reachable()))
            throw new Error(
              'Company downloads are verified. Reload this page to use this version’s offline worker. If an update is waiting, close this version’s other tabs first. Your saved progress is preserved.',
            );
        }
        admittedWorker = navigatorRef.serviceWorker.controller;
        controller.signal.throwIfAborted();
      },
    });
  } finally {
    // Settle an in-flight request before removing its abort listener/dialog.
    abort();
    panel?.dispose();
    release();
    windowRef?.removeEventListener?.('pagehide', abort);
    documentRef?.removeEventListener?.('visibilitychange', hidden);
    navigatorRef?.serviceWorker?.removeEventListener?.('controllerchange', changed);
  }
}
