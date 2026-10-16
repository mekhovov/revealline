import { resolveJourneyRequest } from './content-design/default-entry.mjs';
import { downloadFiles } from './download-catalogue.mjs';

export const OFFLINE_DESTINATION_PARAMETER = 'offline-destination';
const modes = {
  'game/': 'solo',
  'game/couch/': 'versus',
  'game/couch/relay-rescue.html': 'team',
};
const names = { solo: 'Solo', versus: 'Versus', team: 'Team' };

/** The worker carries the original query verbatim. Only published owner records
 * authorize bytes; return tokens and local content IDs remain opaque to this UI. */
export function readOfflineDestination({ pageURL, scope, catalogue, version }) {
  const values = new URL(pageURL).searchParams.getAll(OFFLINE_DESTINATION_PARAMETER);
  if (!values.length) return null;
  if (values.length !== 1 || !values[0] || values[0].length > 16384)
    throw new Error('This offline destination request is invalid. Return to the game menu.');
  const base = new URL(scope),
    url = new URL(values[0], base);
  if (
    url.origin !== base.origin ||
    url.username ||
    url.password ||
    !base.pathname.endsWith('/') ||
    !url.pathname.startsWith(base.pathname)
  )
    throw new Error('This destination is outside the current game edition.');
  const path = url.pathname.slice(base.pathname.length).replace(/index\.html$/, ''),
    mode = modes[path];
  if (!mode) throw new Error('This destination is not a supported game mode.');
  if (catalogue?.format !== 'revealline-offline-content.v2' || catalogue.version !== version)
    throw new Error('The offline destination catalogue differs from this edition.');
  const ids = url.searchParams.getAll('library-mission');
  if (ids.length > 1 || (ids.length && !ids[0]) || url.searchParams.getAll('journey').length > 1)
    throw new Error('This offline destination request is ambiguous.');
  const routeId = resolveJourneyRequest(url.searchParams, { mode }) || 'legacy';
  const matches = (catalogue.destinations || []).filter(
    (row) =>
      row.path === path &&
      row.mode === mode &&
      row.routeId === routeId &&
      (ids.length ? row.libraryId === ids[0] : row.libraryId === undefined),
  );
  if (matches.length !== 1)
    throw new Error('This exact destination has no offline package. Return to the game menu.');
  const localContent =
    routeId === 'legacy' &&
    !ids.length &&
    [
      'pack',
      'practice',
      'course',
      'lesson',
      'return-token',
      'return-token-v2',
      'mode-return',
      'mode-return-v2',
    ].some((key) => url.searchParams.has(key));
  const groups = localContent ? matches[0].runtimeGroups : matches[0].groups;
  if (
    !Array.isArray(groups) ||
    !groups.length ||
    new Set(groups).size !== groups.length ||
    groups.some(
      (id) =>
        catalogue.groups.filter((group) => group.id === id && group.kind === 'gameplay').length !==
        1,
    )
  )
    throw new Error('The destination package is incomplete. Return to the game menu.');
  // Resolve dependencies before displaying a usable confirmation action.
  if (!downloadFiles(catalogue, groups).length)
    throw new Error('The destination package has no verified file inventory.');
  return Object.freeze({
    href: url.href,
    mode,
    title: `${names[mode]} · ${groups.map((id) => catalogue.groups.find((group) => group.id === id).title || id).join(', ')}`,
    groups: Object.freeze([...groups]),
    checkpoint: `destination:${JSON.stringify([...groups].sort())}`,
  });
}

/** Bookmark preparation has its own durable owner. It must not replace the
 * player's broader gameplay selection or store private return tokens. */
export function downloadOfflineDestination(store, { request, ...options }) {
  return store.download({ ...options, group: request.checkpoint, selection: request.groups });
}

/** Called only by the standalone page's explicit approved download/open action.
 * The final local verification and cancellation check prevent stale navigation. */
export async function continueOfflineDestination({
  request,
  verify,
  remember = async () => {},
  navigate,
  signal,
}) {
  signal?.throwIfAborted();
  const report = await verify(request.groups, { signal });
  signal?.throwIfAborted();
  if (!report.ready)
    throw new Error('This destination is not ready offline. Resume to repair its missing files.');
  await remember(request.groups, { signal });
  signal?.throwIfAborted();
  navigate(request.href);
}
