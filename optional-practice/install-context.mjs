const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const versionPattern = /^v\d+\.\d+\.\d+$/;

/** Ask the exact owning worker to hash-check all of its pinned dependencies. */
export async function inspectOptionalOffline(
  base,
  { navigator = globalThis.navigator, timeoutMs = 30000 } = {},
) {
  base = new URL(base);
  const registration = await navigator?.serviceWorker?.getRegistration?.(base.href);
  const worker = registration?.active;
  if (
    registration?.scope !== base.href ||
    !worker ||
    worker.scriptURL !== new URL('worker.js', base).href
  )
    return false;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (value) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    channel.port1.onmessage = ({ data }) =>
      finish(data?.type === 'practice-status' && data.ready === true && data.scope === base.href);
    worker.postMessage({ type: 'practice-status' }, [channel.port2]);
  });
}

export async function removeOptionalOffline({
  packageId,
  location = globalThis.location,
  navigator = globalThis.navigator,
  caches = globalThis.caches,
  storage = globalThis.localStorage,
} = {}) {
  const base = new URL('./', location.href);
  const registration = await navigator?.serviceWorker?.getRegistration?.(base.href);
  if (registration?.scope === base.href) await registration.unregister();
  const family = packageId === 'civilian-flight' ? 'civilian-flight' : 'package';
  const prefix = `revealline.optional.${family}.v1:${base.pathname}:`;
  for (const name of (await caches?.keys?.()) ?? [])
    if (name.startsWith(prefix)) await caches.delete(name);
  removeOptionalInstallation({ packageId, location, storage });
}

/** Shared package service. A transient progress panel does not control a flight. */
export async function prepareOptionalOffline({
  packageId,
  navigator = globalThis.navigator,
  location = globalThis.location,
  storage = globalThis.localStorage,
  signal,
  onProgress,
  document: doc = globalThis.document,
} = {}) {
  if (!navigator?.serviceWorker) throw new Error('Service workers unavailable');
  const base = new URL('./', location.href);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) abort.abort();
  const uk = doc?.documentElement?.lang === 'uk';
  let panel, progress;
  if (doc?.body && !onProgress) {
    panel = doc.createElement('section');
    panel.setAttribute('aria-label', uk ? 'Підготовка офлайн' : 'Offline download');
    panel.style.cssText =
      'position:fixed;bottom:1rem;left:1rem;right:1rem;z-index:10000;padding:1rem;background:#10263b;color:#fff;border:2px solid #68b2ff';
    progress = doc.createElement('p');
    progress.setAttribute('role', 'status');
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = uk ? 'Скасувати' : 'Cancel download';
    button.onclick = cancel;
    panel.append(progress, button);
    doc.body.append(panel);
  }
  const report = (data) => {
    if (progress)
      progress.textContent =
        (data.phase === 'verifying'
          ? uk
            ? 'Перевірка'
            : 'Verifying'
          : uk
            ? 'Завантаження'
            : 'Downloading') +
        ` · ${Math.min(100, Math.round((data.downloaded / Math.max(1, data.total)) * 100))}%`;
    onProgress?.(data);
  };
  let worker, port;
  try {
    if (abort.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (await inspectOptionalOffline(base, { navigator })) {
      recordOptionalInstallation({ packageId, location, storage });
      return true;
    }
    const registration = await navigator.serviceWorker.register(new URL('worker.js', base), {
      scope: base.pathname,
      updateViaCache: 'none',
    });
    worker = registration.installing ?? registration.waiting ?? registration.active;
    if (!worker) throw new Error('Optional practice worker unavailable');
    await new Promise((resolve, reject) => {
      let idle,
        overall,
        finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(idle);
        clearTimeout(overall);
        worker.removeEventListener('statechange', change);
        abort.signal.removeEventListener('abort', cancelled);
        if (error) reject(error);
        else resolve();
      };
      const cancelled = () => {
        worker.postMessage({ type: 'practice-cancel' });
        finish(new DOMException('Cancelled', 'AbortError'));
      };
      const activity = () => {
        clearTimeout(idle);
        idle = setTimeout(() => {
          worker.postMessage({ type: 'practice-cancel' });
          finish(new Error('Download stalled for 30 seconds. Retry online.'));
        }, 30000);
      };
      const change = () => {
        if (worker.state === 'activated') finish();
        else if (worker.state === 'redundant')
          finish(
            new Error(
              'Download or verification failed. Check connection and available storage, then retry.',
            ),
          );
        else if (worker.state === 'installed' && registration.active)
          finish(new Error('Update downloaded. Close this version’s tabs and reopen to finish.'));
      };
      const channel = new MessageChannel();
      port = channel.port1;
      port.onmessage = ({ data }) => {
        if (data?.type === 'practice-progress') {
          activity();
          report(data);
        }
      };
      worker.postMessage({ type: 'practice-progress' }, [channel.port2]);
      worker.addEventListener('statechange', change);
      abort.signal.addEventListener('abort', cancelled, { once: true });
      activity();
      overall = setTimeout(() => {
        worker.postMessage({ type: 'practice-cancel' });
        finish(new Error('Download exceeded five minutes. Retry on a faster connection.'));
      }, 300000);
      if (abort.signal.aborted) cancelled();
      else change();
    });
    report({ phase: 'verifying', downloaded: 1, total: 1 });
    if (abort.signal.aborted || !(await inspectOptionalOffline(base, { navigator })))
      throw new Error(
        'Needs repair: offline files are missing. Remove this version’s offline copy and download again.',
      );
    recordOptionalInstallation({ packageId, location, storage });
    return true;
  } finally {
    port?.close();
    panel?.remove();
    signal?.removeEventListener('abort', cancel);
  }
}
export function optionalInstallationKey(id, root) {
  if (!idPattern.test(id) || id.length > 64)
    throw new TypeError('Invalid optional package identity.');
  if (typeof root !== 'string' || !new RegExp(`^/(?:[A-Za-z0-9_-]+/)*practice/${id}/$`).test(root))
    throw new TypeError('Invalid optional installation root.');
  return `revealline.optional-installed.${id}.${encodeURIComponent(root)}.v1`;
}
export function validateOptionalInstallationReference(value, { packageId, root, baseURL }) {
  optionalInstallationKey(packageId, root);
  if (
    !value ||
    value.id !== packageId ||
    !versionPattern.test(value.version) ||
    value.entry !== `optional-practice/${packageId}/index.html` ||
    typeof value.scope !== 'string' ||
    value.scope.length > 2048 ||
    !new RegExp(`^/(?:[A-Za-z0-9_-]+/)*practice/${packageId}/$`).test(root)
  )
    throw new TypeError('Optional installation reference differs.');
  const base = new URL(baseURL),
    scope = new URL(value.scope, base);
  if (
    !/^https?:$/.test(base.protocol) ||
    scope.origin !== base.origin ||
    scope.username ||
    scope.password ||
    scope.search ||
    scope.hash ||
    scope.pathname !== `${root}releases/${value.version}/site/`
  )
    throw new TypeError('Optional installation must use its exact published package path.');
  return Object.freeze({
    id: packageId,
    version: value.version,
    scope: scope.href,
    entry: value.entry,
  });
}
export function recordOptionalInstallation({
  packageId,
  location = globalThis.location,
  storage = globalThis.localStorage,
}) {
  if (!idPattern.test(packageId) || packageId.length > 64)
    throw new TypeError('Invalid optional package identity.');
  const base = new URL(location.href);
  const match = new RegExp(
    `^(/(?:[A-Za-z0-9_-]+/)*practice/${packageId}/)releases/(v\\d+\\.\\d+\\.\\d+)/site/optional-practice/${packageId}/(?:index\\.html)?$`,
  ).exec(base.pathname);
  if (!match) return false;
  const context = { packageId, root: match[1], baseURL: base.href };
  const active = validateOptionalInstallationReference(
    {
      id: packageId,
      version: match[2],
      scope: `${match[1]}releases/${match[2]}/site/`,
      entry: `optional-practice/${packageId}/index.html`,
    },
    context,
  );
  let state = {};
  try {
    state = JSON.parse(storage.getItem(optionalInstallationKey(packageId, match[1])) ?? '{}');
  } catch {
    /* A malformed local pointer cannot authorize another path. */
  }
  let previous;
  try {
    previous = validateOptionalInstallationReference(state.active, context);
  } catch {
    /* No verified previous pointer. */
  }
  if (previous?.scope === active.scope) return true;
  storage.setItem(
    optionalInstallationKey(packageId, match[1]),
    JSON.stringify({ active, ...(previous ? { previous } : {}) }),
  );
  return true;
}

export function removeOptionalInstallation({
  packageId,
  location = globalThis.location,
  storage = globalThis.localStorage,
}) {
  if (!idPattern.test(packageId) || packageId.length > 64)
    throw new TypeError('Invalid optional package identity.');
  const base = new URL(location.href);
  const match = new RegExp(
    `^(/(?:[A-Za-z0-9_-]+/)*practice/${packageId}/)releases/(v\\d+\\.\\d+\\.\\d+)/site/optional-practice/${packageId}/(?:index\\.html)?$`,
  ).exec(base.pathname);
  if (!match) return false;
  const key = optionalInstallationKey(packageId, match[1]);
  const context = { packageId, root: match[1], baseURL: base.href };
  let state;
  try {
    state = JSON.parse(storage.getItem(key) ?? '{}');
  } catch {
    return false;
  }
  const retained = {};
  for (const [name, value] of Object.entries(state)) {
    if (!['active', 'previous'].includes(name)) continue;
    try {
      const reference = validateOptionalInstallationReference(value, context);
      if (reference.version !== match[2]) retained[name] = reference;
    } catch {
      /* Unrelated or malformed pointers cannot be retained. */
    }
  }
  if (!retained.active && retained.previous) {
    retained.active = retained.previous;
    delete retained.previous;
  }
  storage.setItem(key, JSON.stringify(retained));
  return true;
}
