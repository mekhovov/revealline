const defaultScope = () => new URL('../../', import.meta.url).href;
function exactScope(scope) {
  const url = new URL(scope);
  if (
    !/^https?:$/.test(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.endsWith('/')
  )
    throw new Error('Offline preparation requires a valid edition directory.');
  return url.href;
}
function inspect(worker, timeoutMs = 120000) {
  if (!worker) throw new Error('Prepare this edition before verifying offline files.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error, value) => {
      clearTimeout(timer);
      channel.port1.close();
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(
      () => finish(new Error('Offline verification timed out. Retry when the browser is ready.')),
      timeoutMs,
    );
    channel.port1.onmessage = ({ data }) =>
      data?.status === 'ready'
        ? finish(null, data)
        : finish(new Error(data?.message || 'Offline files need repair.'));
    worker.postMessage({ type: 'verify-company-edition' }, [channel.port2]);
  });
}

export async function verifyEditionOffline({
  scope = defaultScope(),
  serviceWorker = globalThis.navigator?.serviceWorker,
} = {}) {
  const expected = exactScope(scope);
  if (!serviceWorker?.getRegistration)
    throw new Error('This browser does not support offline preparation.');
  const registration = await serviceWorker.getRegistration(expected);
  if (registration?.scope !== expected)
    throw new Error('This edition has not been prepared offline.');
  return inspect(registration.waiting || registration.active);
}

/** Explicit launcher selection never copies or rewrites campaign progress. */
export async function selectPreparedEdition({
  scope = defaultScope(),
  serviceWorker = globalThis.navigator?.serviceWorker,
  storage = globalThis.localStorage,
  entry = 'game/company.html',
} = {}) {
  const verified = await verifyEditionOffline({ scope, serviceWorker });
  const url = new URL(exactScope(scope));
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(verified.editionId) ||
    !url.pathname.includes(`/editions/${verified.editionId}/`) ||
    entry !== 'game/company.html'
  )
    throw new Error('Install from the published edition address.');
  const key = `revealline.company-installed.${verified.editionId}.v1`;
  const state = JSON.parse(storage.getItem(key) || '{}');
  const active = {
    editionId: verified.editionId,
    version: verified.version,
    buildId: verified.buildId,
    scope: url.href,
    entry,
  };
  storage.setItem(
    key,
    JSON.stringify({
      active,
      previous:
        state.active?.scope === active.scope ? state.previous || null : state.active || null,
    }),
  );
  return active;
}

/** Call only from a visible player action; importing this module performs no work. */
export async function prepareEditionOffline({
  scope = defaultScope(),
  serviceWorker = globalThis.navigator?.serviceWorker,
  onStatus = () => {},
} = {}) {
  const expected = exactScope(scope);
  if (!serviceWorker?.register)
    throw new Error('This browser does not support offline preparation.');
  onStatus({ status: 'downloading' });
  const registration = await serviceWorker.register(new URL('service-worker.js', expected).href, {
    scope: expected,
    updateViaCache: 'none',
  });
  const installing = registration.installing;
  if (installing && !['installed', 'activated'].includes(installing.state))
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => finish(new Error('Offline preparation timed out. Existing editions are preserved.')),
        120000,
      );
      const finish = (error) => {
        clearTimeout(timeout);
        installing.removeEventListener('statechange', changed);
        error ? reject(error) : resolve();
      };
      const changed = () => {
        if (['installed', 'activated'].includes(installing.state)) finish();
        else if (installing.state === 'redundant')
          finish(new Error('Offline download failed. Reconnect and retry.'));
      };
      installing.addEventListener('statechange', changed);
      changed();
    });
  const result = await inspect(registration.waiting || registration.active || installing);
  const ready = { ...result, status: registration.waiting ? 'waiting' : 'ready' };
  onStatus(ready);
  return ready;
}
