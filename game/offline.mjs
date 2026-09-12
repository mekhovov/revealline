import { nativePlatform } from './platform.mjs';
/** Explicit, opt-in preparation of a generated distribution's complete local cache. */
const MARKER = 'meta[name="revealline-offline"]';
function configFromPage(documentRef = globalThis.document, locationRef = globalThis.location) {
  const marker = documentRef?.querySelector(MARKER)?.content;
  if (!marker || !locationRef?.href) return null;
  let config;
  try {
    config = JSON.parse(marker);
  } catch {
    return null;
  }
  if (config.format !== 'revealline-offline.v1' || !/^[0-9a-f]{64}$/.test(config.buildId))
    return null;
  const page = new URL(locationRef.href),
    scope = new URL(config.scope, page),
    worker = new URL(config.worker, page);
  if (
    scope.origin !== page.origin ||
    worker.origin !== page.origin ||
    !page.pathname.startsWith(scope.pathname) ||
    worker.pathname !== `${scope.pathname}service-worker.js`
  )
    return null;
  return { ...config, scope: scope.href, worker: worker.href };
}
export function offlineAvailability({
  documentRef = globalThis.document,
  locationRef = globalThis.location,
  navigatorRef = globalThis.navigator,
  secure = globalThis.isSecureContext,
} = {}) {
  const platform = nativePlatform(locationRef);
  if (platform)
    return {
      available: false,
      bundled: true,
      reason:
        'This app includes its game files for offline play. No additional download is needed. Export a complete backup to protect your saved collection.',
    };
  const config = configFromPage(documentRef, locationRef);
  if (!config)
    return {
      available: false,
      reason:
        'Offline preparation is available in a packaged release. The live development page keeps using fresh files.',
    };
  if (!secure || !navigatorRef?.serviceWorker)
    return {
      available: false,
      reason: 'Offline play needs a browser with service workers on HTTPS or localhost.',
    };
  return { available: true, version: config.version, buildId: config.buildId, scope: config.scope };
}
function requestReport(
  worker,
  {
    MessageChannelImpl = globalThis.MessageChannel,
    timeout = 30000,
    messageType = 'revealline.offline-check',
  } = {},
) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannelImpl();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Offline verification timed out. Reconnect and try again.'));
    }, timeout);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data);
    };
    try {
      worker.postMessage({ type: messageType }, [channel.port2]);
    } catch (error) {
      clearTimeout(timer);
      channel.port1.close();
      channel.port2.close();
      reject(error);
    }
  });
}
async function registered(config, navigatorRef) {
  const registration = await navigatorRef.serviceWorker.getRegistration(config.scope);
  return registration?.scope === config.scope ? registration : null;
}
function installed(registration, timeout = 60000) {
  if (registration.waiting) return Promise.resolve(registration.waiting);
  if (registration.active && !registration.installing) return Promise.resolve(registration.active);
  const worker = registration.installing;
  if (!worker) return Promise.reject(new Error('Offline worker did not begin installing.'));
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', changed);
      error ? reject(error) : resolve(worker);
    };
    const changed = () => {
      if (['installed', 'activated'].includes(worker.state)) finish();
      else if (worker.state === 'redundant')
        finish(new Error('Offline download failed or the browser could not save every file.'));
    };
    const timer = setTimeout(
      () => finish(new Error('Offline preparation timed out. Keep the page online and try again.')),
      timeout,
    );
    worker.addEventListener('statechange', changed);
    changed();
  });
}
function environment(options) {
  return {
    documentRef: options.documentRef ?? globalThis.document,
    locationRef: options.locationRef ?? globalThis.location,
    navigatorRef: options.navigatorRef ?? globalThis.navigator,
    secure: options.secure ?? globalThis.isSecureContext,
  };
}
function requireConfig(env) {
  const available = offlineAvailability(env);
  if (!available.available) throw new Error(available.reason);
  return configFromPage(env.documentRef, env.locationRef);
}
/** The caller must connect this function to a deliberate player action. No startup side effects. */
export async function prepareOffline(options = {}) {
  const env = environment(options),
    config = requireConfig(env),
    status = options.onStatus ?? (() => {});
  status({ status: 'preparing', message: 'Downloading and verifying this complete game version…' });
  const registration = await env.navigatorRef.serviceWorker.register(config.worker, {
    scope: config.scope,
    updateViaCache: 'none',
  });
  let worker = await installed(registration, options.installTimeout);
  const report = await requestReport(worker, {
    ...options,
    messageType: 'revealline.offline-prepare',
  });
  if (report.status !== 'ready' || report.buildId !== config.buildId)
    throw new Error(
      report.message ??
        'Offline files do not match this build. Close this version’s tabs and reopen it online.',
    );
  const result = {
    ...report,
    status: registration.waiting === worker ? 'waiting' : 'ready',
    message:
      registration.waiting === worker
        ? 'Update saved. Close all tabs of this version to use it; your current game continues unchanged.'
        : 'Offline files verified. This version can open without a connection while the browser retains its storage.',
  };
  status(result);
  return result;
}
/** Checks cached bytes through the worker; it does not fetch, install, or request storage permission. */
export async function checkOffline(options = {}) {
  const env = environment(options),
    config = requireConfig(env),
    status = options.onStatus ?? (() => {});
  status({ status: 'checking', message: 'Checking every saved game file…' });
  const registration = await registered(config, env.navigatorRef),
    worker = registration?.waiting ?? registration?.active;
  if (!worker) {
    const result = { status: 'not-ready', message: 'Prepare offline play first.', verified: 0 };
    status(result);
    return result;
  }
  const report = await requestReport(worker, options);
  const result =
    report.buildId === config.buildId
      ? report
      : {
          ...report,
          status: 'not-ready',
          message:
            'Cached worker belongs to a different build. Reconnect and prepare this version again.',
        };
  status(result);
  return result;
}
