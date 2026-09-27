export const INSTALLED_STATE_KEY = 'revealline.installed-app.v1';
export function installedAppURL(locationRef = globalThis.location) {
  const url = new URL(locationRef.href);
  const release = url.pathname.indexOf('/releases/');
  const root =
    release >= 0
      ? url.pathname.slice(0, release + 1)
      : url.pathname.replace(/(?:game|app)\/.*$/, '');
  return new URL(`${root.endsWith('/') ? root : `${root}/`}app/`, url.origin).href;
}
export function installedPresentation(
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
) {
  return Boolean(
    navigatorRef?.standalone ||
      windowRef?.matchMedia?.('(display-mode: standalone)').matches ||
      windowRef?.matchMedia?.('(display-mode: fullscreen)').matches,
  );
}
export function readInstalledState(storage = globalThis.localStorage) {
  const raw = storage.getItem(INSTALLED_STATE_KEY);
  if (!raw) return { active: null, previous: null, pending: null };
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object')
    throw new Error('Installed edition settings need recovery. Your saved games are preserved.');
  return value;
}
export function validateInstalledEdition(value, locationRef = globalThis.location) {
  const scope = new URL(value?.scope);
  const app = new URL(installedAppURL(locationRef));
  if (
    !/^v?\d+\.\d+\.\d+$/.test(value.version) ||
    scope.origin !== app.origin ||
    scope.username ||
    scope.password ||
    !scope.pathname.endsWith('/') ||
    scope.search ||
    scope.hash ||
    (value.selection !== undefined &&
      (!Array.isArray(value.selection) ||
        value.selection.length > 100 ||
        value.selection.some((id) => typeof id !== 'string' || id.length > 200))) ||
    !(
      scope.pathname === new URL('../', app).pathname ||
      scope.pathname.startsWith(new URL('../releases/', app).pathname)
    )
  )
    throw new Error('The installed edition is outside this app.');
  return {
    version: value.version,
    scope: scope.href,
    selection: value.selection || [],
    allGameplay: Boolean(value.allGameplay),
  };
}
export async function stageInstalledEdition(
  value,
  { storage = globalThis.localStorage, locationRef = globalThis.location } = {},
) {
  const candidate = validateInstalledEdition(value, locationRef);
  storage.setItem(
    INSTALLED_STATE_KEY,
    JSON.stringify({ ...readInstalledState(storage), pending: candidate }),
  );
  return candidate;
}
const profile = (version) => `revealline.library.release-${version}.v1`;
async function fingerprint(version, storage, readAsset) {
  const key = profile(version),
    channel = `release-${version}`;
  const values = [
    storage.getItem(key),
    storage.getItem(`revealline.suspended.${channel}.v1`),
    storage.getItem(`${key}.backup-lock`),
  ];
  for (const name of [
    `revealline.packs.${channel}.v1`,
    `${key}.external-chapter-index.v1`,
    `${key}.external-chapter-journal.v1`,
    `${key}.backup-journal`,
  ])
    values.push(await readAsset(name));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(values)),
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function reviewInstalledMigration(
  sourceVersion,
  targetVersion,
  { storage = globalThis.localStorage, readAsset } = {},
) {
  const state = readInstalledState(storage);
  if (
    !state.active ||
    !state.pending ||
    state.active.version.replace(/^v/, '') !== sourceVersion.replace(/^v/, '') ||
    state.pending.version.replace(/^v/, '') !== targetVersion.replace(/^v/, '')
  )
    return null;
  return {
    from: state.active.version,
    to: state.pending.version,
    source: await fingerprint(state.active.version, storage, readAsset),
  };
}
export async function recordInstalledMigration(
  review,
  { storage = globalThis.localStorage, readAsset } = {},
) {
  if (!review) return;
  if (review.source !== (await fingerprint(review.from, storage, readAsset)))
    throw new Error(
      'Earlier progress changed while copying. Review the transfer again before switching editions.',
    );
  const state = readInstalledState(storage);
  storage.setItem(
    INSTALLED_STATE_KEY,
    JSON.stringify({
      ...state,
      migration: { ...review, target: await fingerprint(review.to, storage, readAsset) },
    }),
  );
}
/** The game verifies gameplay first. This second gate verifies save ownership and migration. */
export async function activateInstalledEdition(
  value,
  {
    storage = globalThis.localStorage,
    locationRef = globalThis.location,
    locks = globalThis.navigator?.locks,
    readAsset,
    restorePrevious = false,
    // A trusted embedded host may already hold the exact branded profile lease.
    // The host checks its safe menu boundary and lease; an iframe receives no lease.
    ownsWriter = () => false,
  } = {},
) {
  const candidate = validateInstalledEdition(value, locationRef);
  if (!locks?.request || !readAsset)
    throw new Error('Safe edition switching needs Web Locks and profile storage.');
  return locks.request('revealline.installed-app.switch', async () => {
    const state = readInstalledState(storage),
      active = state.active;
    const borrowed = new Set();
    const assertOwnership = () => {
      for (const key of borrowed)
        if (!ownsWriter(key))
          throw new Error(
            'The game stopped owning its save profile. Your working edition is kept.',
          );
    };
    const switchEdition = async () => {
      for (const version of new Set([active?.version, candidate.version].filter(Boolean))) {
        const key = profile(version);
        if (
          storage.getItem(`${key}.backup-lock`) ||
          (await readAsset(`${key}.backup-journal`)) ||
          (await readAsset(`${key}.external-chapter-journal.v1`))
        )
          throw new Error(
            'Finish game-data recovery before switching editions. Your working edition is kept.',
          );
      }
      if (restorePrevious && state.previous?.scope !== candidate.scope)
        throw new Error('The previous edition changed. Open its download screen again.');
      if (active && active.version !== candidate.version && !restorePrevious) {
        const hasProgress =
          storage.getItem(profile(active.version)) !== null ||
          storage.getItem(`revealline.suspended.release-${active.version}.v1`) !== null;
        if (
          hasProgress &&
          (state.migration?.from !== active.version ||
            state.migration?.to !== candidate.version ||
            state.migration.source !== (await fingerprint(active.version, storage, readAsset)) ||
            storage.getItem(profile(candidate.version)) === null)
        )
          return {
            activated: false,
            message:
              'Edition downloaded. Open this edition’s Game data → Flight library → Bring progress from an earlier release. Review and copy the previous edition there, then return here to switch. An incompatible saved flight or a busy profile leaves your working edition selected.',
          };
      }
      assertOwnership();
      storage.setItem(
        INSTALLED_STATE_KEY,
        JSON.stringify({
          ...state,
          active: candidate,
          previous: active?.scope === candidate.scope ? state.previous : active,
          pending: null,
          migration: null,
        }),
      );
      return {
        activated: true,
        message:
          'This edition will open from the app icon at the next launch. Your previous edition and its progress are kept.',
      };
    };
    const versions = [...new Set([active?.version, candidate.version].filter(Boolean))].sort();
    const acquire = (index) => {
      if (index === versions.length) return switchEdition();
      const key = `${profile(versions[index])}.writer`;
      if (ownsWriter(key)) {
        borrowed.add(key);
        return acquire(index + 1);
      }
      return locks.request(key, { ifAvailable: true }, (lock) => {
        if (!lock)
          throw new Error(
            'Close the game window that owns this profile, then switch editions. No live game was reloaded.',
          );
        return acquire(index + 1);
      });
    };
    return acquire(0);
  });
}

export async function updateInstalledSelection(
  scope,
  selection,
  { storage = globalThis.localStorage, locks = globalThis.navigator?.locks } = {},
) {
  if (!locks?.request) throw new Error('Changing installed downloads requires Web Locks.');
  await locks.request('revealline.installed-app.switch', async () => {
    const state = readInstalledState(storage);
    if (state.active?.scope === scope)
      storage.setItem(
        INSTALLED_STATE_KEY,
        JSON.stringify({ ...state, active: { ...state.active, selection, allGameplay: false } }),
      );
  });
}

/** Add explicitly prepared packages to future updates without switching editions
 * or replacing a broader selection made in another window. */
export async function rememberInstalledPackages(
  scope,
  groups,
  { storage = globalThis.localStorage, locks = globalThis.navigator?.locks, signal } = {},
) {
  signal?.throwIfAborted();
  if (
    !Array.isArray(groups) ||
    !groups.length ||
    groups.length > 100 ||
    groups.some((id) => typeof id !== 'string' || !id.length || id.length > 200)
  )
    throw new Error('Remembering downloads requires exact package identities.');
  if (!locks?.request) throw new Error('Changing installed downloads requires Web Locks.');
  return locks.request('revealline.installed-app.switch', { signal }, async () => {
    signal?.throwIfAborted();
    const state = readInstalledState(storage);
    if (state.active?.scope !== scope) return false;
    const selection = [...new Set([...(state.active.selection || []), ...groups])];
    if (selection.length > 100)
      throw new Error('The installed download selection exceeds its package limit.');
    storage.setItem(
      INSTALLED_STATE_KEY,
      JSON.stringify({ ...state, active: { ...state.active, selection } }),
    );
    return true;
  });
}

export function invalidateInstalledMigration(storage = globalThis.localStorage) {
  const state = readInstalledState(storage);
  if (state.migration)
    storage.setItem(INSTALLED_STATE_KEY, JSON.stringify({ ...state, migration: null }));
}

let launcherRequest = 0;
function requestLauncher(
  worker,
  type,
  { signal, timeout = 30000, MessageChannelImpl = globalThis.MessageChannel } = {},
) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const channel = new MessageChannelImpl(),
      requestId = `launcher-${++launcherRequest}`;
    let settled = false;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      channel.port1.close();
      channel.port2.close();
      error ? reject(error) : resolve(value);
    };
    const abort = () =>
      finish(null, new DOMException('Launcher preparation paused.', 'AbortError'));
    const timer = setTimeout(
      () =>
        finish(
          null,
          new Error(
            'The app launcher did not confirm its saved files. Close other launcher windows and resume.',
          ),
        ),
      timeout,
    );
    signal?.addEventListener('abort', abort, { once: true });
    channel.port1.onmessage = (event) => {
      if (
        event.data?.format !== 'revealline.launcher-health.v1' ||
        event.data.requestId !== requestId
      )
        return;
      if (event.data.status === 'ready') finish(event.data);
      else
        finish(
          null,
          new Error(
            event.data.message || 'The app launcher is not ready offline. Resume to repair it.',
          ),
        );
    };
    worker.postMessage({ type, requestId }, [channel.port2]);
  });
}

/** Verify the stable icon destination separately from edition content. No global ready promise. */
export async function prepareInstalledLauncher({
  navigatorRef = globalThis.navigator,
  locationRef = globalThis.location,
  signal,
  timeout = 30000,
  MessageChannelImpl = globalThis.MessageChannel,
} = {}) {
  signal?.throwIfAborted();
  const appURL = installedAppURL(locationRef);
  const registration = await navigatorRef.serviceWorker.register(
    new URL('service-worker.js', appURL),
    {
      scope: appURL,
      updateViaCache: 'none',
    },
  );
  const worker = registration.installing || registration.waiting || registration.active;
  if (!worker) throw new Error('Launcher installation has not started. Resume preparation.');
  if (worker.state !== 'activated')
    await new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        worker.removeEventListener('statechange', changed);
        signal?.removeEventListener('abort', abort);
        error ? reject(error) : resolve();
      };
      const changed = () => {
        if (worker.state === 'activated') finish();
        else if (worker.state === 'redundant')
          finish(new Error('Launcher installation failed. Resume preparation.'));
      };
      const abort = () => finish(new DOMException('Launcher preparation paused.', 'AbortError'));
      const timer = setTimeout(
        () =>
          finish(
            new Error('Close other launcher windows, then resume so its update can activate.'),
          ),
        timeout,
      );
      worker.addEventListener('statechange', changed);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      else changed();
    });
  signal?.throwIfAborted();
  return requestLauncher(worker, 'revealline.launcher-prepare', {
    signal,
    timeout,
    MessageChannelImpl,
  });
}

export async function checkInstalledLauncher({
  navigatorRef = globalThis.navigator,
  locationRef = globalThis.location,
  ...options
} = {}) {
  const registration = await navigatorRef?.serviceWorker?.getRegistration(
    installedAppURL(locationRef),
  );
  if (!registration?.active) return { status: 'missing' };
  try {
    return await requestLauncher(registration.active, 'revealline.launcher-check', options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return { status: 'incomplete', message: error.message };
  }
}
