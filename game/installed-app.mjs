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
  } = {},
) {
  const candidate = validateInstalledEdition(value, locationRef);
  if (!locks?.request || !readAsset)
    throw new Error('Safe edition switching needs Web Locks and profile storage.');
  return locks.request('revealline.installed-app.switch', async () => {
    const state = readInstalledState(storage),
      active = state.active;
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
    const acquire = (index) =>
      index === versions.length
        ? switchEdition()
        : locks.request(`${profile(versions[index])}.writer`, { ifAvailable: true }, (lock) => {
            if (!lock)
              throw new Error(
                'Close the game window that owns this profile, then switch editions. No live game was reloaded.',
              );
            return acquire(index + 1);
          });
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

export function invalidateInstalledMigration(storage = globalThis.localStorage) {
  const state = readInstalledState(storage);
  if (state.migration)
    storage.setItem(INSTALLED_STATE_KEY, JSON.stringify({ ...state, migration: null }));
}
