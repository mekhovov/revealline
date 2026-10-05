const idPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const versionPattern = /^v\d+\.\d+\.\d+$/;
const operations = new Map();
const preparations = new Map();
const cancelledError = () => new DOMException('Cancelled', 'AbortError');
const checkCancelled = (signal) => {
  if (signal?.aborted) throw cancelledError();
};
const cancelWorker = (worker) => {
  try {
    worker?.postMessage({ type: 'practice-cancel' });
  } catch {
    // A redundant worker has no download left to cancel.
  }
};

// Serialize pointer/cache ownership, including across tabs where Web Locks exist.
// Removal cancels local preparations before joining this queue, so an old hash
// check cannot publish an installed pointer after that copy has been removed.
function ownOfflineOperation(base, navigator, signal, operation, retirement = () => {}) {
  const key = base.href;
  const previous = operations.get(key) ?? Promise.resolve();
  const waiting = new AbortController();
  let resolveResult, rejectResult;
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  const cancelled = () => {
    waiting.abort();
    rejectResult(cancelledError());
  };
  const timer = setTimeout(() => {
    waiting.abort();
    rejectResult(new Error('Another offline operation is still stopping. Retry shortly.'));
  }, 30000);
  signal?.addEventListener('abort', cancelled, { once: true });
  if (signal?.aborted) cancelled();
  const execute = async () => {
    checkCancelled(waiting.signal);
    clearTimeout(timer);
    try {
      resolveResult(await operation());
    } catch (error) {
      rejectResult(error);
    } finally {
      // register() has no browser abort primitive. Its late settlement retains
      // this lock even after the caller is cancelled, so Remove cannot succeed
      // before a newly activated registration becomes visible to it.
      await retirement();
    }
  };
  const pending = previous
    .catch(() => {})
    .then(() => {
      checkCancelled(waiting.signal);
      return navigator?.locks?.request
        ? navigator.locks.request(
            `revealline.optional-offline:${key}`,
            { mode: 'exclusive', signal: waiting.signal },
            execute,
          )
        : execute();
    });
  operations.set(key, pending);
  const retire = () => {
    if (operations.get(key) === pending) operations.delete(key);
  };
  pending.then(retire, (error) => {
    retire();
    rejectResult(error);
  });
  return result.finally(() => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancelled);
  });
}

function stopInstallingWorker(worker, timeoutMs = 30000) {
  cancelWorker(worker);
  if (!worker || worker.state !== 'installing') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', change);
      error ? reject(error) : resolve();
    };
    const change = () => {
      if (worker.state !== 'installing') finish();
    };
    const timer = setTimeout(
      () => finish(new Error('Download is still stopping. Retry removing this offline copy.')),
      timeoutMs,
    );
    worker.addEventListener('statechange', change);
    change();
  });
}

function registerOptionalWorker(base, navigator, signal, retain) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (registration, error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancelled);
      error ? reject(error) : resolve(registration);
    };
    const cancelled = () => finish(null, cancelledError());
    const timer = setTimeout(
      () => finish(null, new Error('Worker registration stalled. Retry online.')),
      30000,
    );
    signal.addEventListener('abort', cancelled, { once: true });
    if (signal.aborted) return cancelled();
    const retirement = Promise.resolve()
      .then(() =>
        navigator.serviceWorker.register(new URL('worker.js', base), {
          scope: base.pathname,
          updateViaCache: 'none',
        }),
      )
      .then((registration) => {
        if (finished) cancelWorker(registration?.installing);
        else finish(registration);
      })
      .catch((error) => finish(null, error));
    retain(retirement);
  });
}

/** Ask the exact owning worker to hash-check all of its pinned dependencies. */
export async function inspectOptionalOffline(
  base,
  { navigator = globalThis.navigator, timeoutMs = 30000, signal } = {},
) {
  base = new URL(base);
  checkCancelled(signal);
  return new Promise((resolve, reject) => {
    let channel,
      finished = false;
    const finish = (value, error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancelled);
      channel?.port1.close();
      channel?.port2.close();
      error ? reject(error) : resolve(value);
    };
    const cancelled = () => finish(false, cancelledError());
    const timer = setTimeout(() => finish(false), timeoutMs);
    signal?.addEventListener('abort', cancelled, { once: true });
    Promise.resolve()
      .then(() => navigator?.serviceWorker?.getRegistration?.(base.href))
      .then((registration) => {
        if (finished) return;
        const worker = registration?.active;
        if (
          registration?.scope !== base.href ||
          !worker ||
          worker.scriptURL !== new URL('worker.js', base).href
        )
          return finish(false);
        channel = new MessageChannel();
        channel.port1.onmessage = ({ data }) =>
          finish(
            data?.type === 'practice-status' && data.ready === true && data.scope === base.href,
          );
        channel.port1.onmessageerror = () => finish(false);
        worker.postMessage({ type: 'practice-status' }, [channel.port2]);
      })
      .catch(() => finish(false));
  });
}

export async function removeOptionalOffline({
  packageId,
  location = globalThis.location,
  navigator = globalThis.navigator,
  caches = globalThis.caches,
  storage = globalThis.localStorage,
} = {}) {
  if (!idPattern.test(packageId) || packageId.length > 64)
    throw new TypeError('Invalid optional package identity.');
  const base = new URL('./', location.href);
  for (const abort of preparations.get(base.href) ?? []) abort.abort();
  // Stop a download owned by another tab before waiting for its Web Lock.
  const before = await navigator?.serviceWorker?.getRegistration?.(base.href);
  if (before?.scope === base.href) cancelWorker(before.installing);
  return ownOfflineOperation(base, navigator, null, async () => {
    const registration = await navigator?.serviceWorker?.getRegistration?.(base.href);
    if (registration?.scope === base.href) {
      // unregister() alone does not wait for a pending cache.put() to settle.
      await stopInstallingWorker(registration.installing);
      await registration.unregister();
    }
    const family = packageId === 'civilian-flight' ? 'civilian-flight' : 'package';
    const prefix = `revealline.optional.${family}.v1:${base.pathname}:`;
    for (const name of (await caches?.keys?.()) ?? [])
      if (name.startsWith(prefix)) await caches.delete(name);
    removeOptionalInstallation({ packageId, location, storage });
  });
}

/** Shared package service. A transient progress panel does not control a flight. */
export async function prepareOptionalOffline({
  packageId,
  navigator = globalThis.navigator,
  location = globalThis.location,
  storage = globalThis.localStorage,
  signal,
  onProgress,
  progressParent,
  document: doc = globalThis.document,
} = {}) {
  if (!idPattern.test(packageId) || packageId.length > 64)
    throw new TypeError('Invalid optional package identity.');
  if (!navigator?.serviceWorker) throw new Error('Service workers unavailable');
  const base = new URL('./', location.href);
  const abort = new AbortController();
  const cancel = () => abort.abort();
  const owners = preparations.get(base.href) ?? new Set();
  owners.add(abort);
  preparations.set(base.href, owners);
  signal?.addEventListener('abort', cancel, { once: true });
  doc?.defaultView?.addEventListener?.('pagehide', cancel);
  if (signal?.aborted) abort.abort();
  const uk = doc?.documentElement?.lang === 'uk';
  let panel, progress, progressOwner;
  const previousFocus = doc?.activeElement;
  if (doc?.body && !onProgress) {
    // A body-level overlay is inert behind a native modal, regardless of z-index.
    // Resolve ownership now: hosts can move their settings into a dialog after mount.
    const parent = progressParent ?? previousFocus?.closest?.('dialog[open]') ?? doc.body;
    progressOwner = parent.closest?.('dialog');
    panel = doc.createElement('section');
    panel.setAttribute('data-optional-offline-progress', '');
    panel.setAttribute('aria-label', uk ? 'Підготовка офлайн' : 'Offline download');
    panel.style.cssText =
      (progressOwner
        ? 'position:sticky;bottom:0;z-index:1;'
        : 'position:fixed;bottom:1rem;left:1rem;right:1rem;z-index:10000;') +
      'padding:1rem;background:#10263b;color:#fff;border:2px solid #68b2ff';
    progress = doc.createElement('p');
    progress.setAttribute('role', 'status');
    progress.textContent = uk ? 'Перевірка офлайн-файлів…' : 'Checking offline files…';
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = uk ? 'Скасувати' : 'Cancel download';
    button.style.minHeight = '44px';
    button.onclick = cancel;
    panel.append(progress, button);
    parent.append(panel);
    progressOwner?.addEventListener('close', cancel);
    if (progressOwner && !progressOwner.open) cancel();
    if (!abort.signal.aborted) {
      button.focus?.({ preventScroll: true });
      if (progressOwner) button.scrollIntoView?.({ block: 'nearest' });
    }
  }
  const report = (data) => {
    if (abort.signal.aborted) return;
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
  let worker, port, registrationRetired;
  try {
    return await ownOfflineOperation(
      base,
      navigator,
      abort.signal,
      async () => {
        checkCancelled(abort.signal);
        if (await inspectOptionalOffline(base, { navigator, signal: abort.signal })) {
          checkCancelled(abort.signal);
          recordOptionalInstallation({ packageId, location, storage });
          return true;
        }
        const registration = await registerOptionalWorker(
          base,
          navigator,
          abort.signal,
          (pending) => {
            registrationRetired = pending;
          },
        );
        worker = registration.installing ?? registration.waiting ?? registration.active;
        if (abort.signal.aborted) {
          cancelWorker(worker);
          throw cancelledError();
        }
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
            cancelWorker(worker);
            finish(cancelledError());
          };
          const activity = () => {
            clearTimeout(idle);
            idle = setTimeout(() => {
              cancelWorker(worker);
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
              finish(
                new Error('Update downloaded. Close this version’s tabs and reopen to finish.'),
              );
          };
          const channel = new MessageChannel();
          port = channel.port1;
          port.onmessage = ({ data }) => {
            if (!finished && data?.type === 'practice-progress') {
              activity();
              report(data);
            }
          };
          worker.addEventListener('statechange', change);
          abort.signal.addEventListener('abort', cancelled, { once: true });
          activity();
          overall = setTimeout(() => {
            cancelWorker(worker);
            finish(new Error('Download exceeded five minutes. Retry on a faster connection.'));
          }, 300000);
          try {
            if (abort.signal.aborted) cancelled();
            else {
              worker.postMessage({ type: 'practice-progress' }, [channel.port2]);
              change();
            }
          } catch (error) {
            finish(error);
          }
        });
        report({ phase: 'verifying', downloaded: 1, total: 1 });
        const ready = await inspectOptionalOffline(base, { navigator, signal: abort.signal });
        checkCancelled(abort.signal);
        if (!ready)
          throw new Error(
            'Needs repair: offline files are missing. Remove this version’s offline copy and download again.',
          );
        recordOptionalInstallation({ packageId, location, storage });
        return true;
      },
      () => registrationRetired,
    );
  } finally {
    port?.close();
    const restoreFocus = panel?.contains(doc?.activeElement);
    panel?.remove();
    progressOwner?.removeEventListener('close', cancel);
    if (
      restoreFocus &&
      previousFocus?.isConnected &&
      !previousFocus.disabled &&
      (!progressOwner || progressOwner.open)
    )
      previousFocus.focus?.({ preventScroll: true });
    signal?.removeEventListener('abort', cancel);
    doc?.defaultView?.removeEventListener?.('pagehide', cancel);
    owners.delete(abort);
    if (!owners.size && preparations.get(base.href) === owners) preparations.delete(base.href);
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
