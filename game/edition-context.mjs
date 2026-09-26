/** Distribution identity is independent of Journey's logical campaign progress. */
const editionPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const versionPattern = /^v?(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/;

export function validateEditionId(editionId) {
  if (typeof editionId !== 'string' || editionId.length > 64 || !editionPattern.test(editionId))
    throw new TypeError('Invalid edition identity.');
  return editionId;
}

export function editionIdFromLocation(locationRef = globalThis.location) {
  if (!locationRef?.href) return undefined;
  const path = new URL(locationRef.href).pathname;
  const match = /\/editions\/([^/]+)\//.exec(path);
  return match ? validateEditionId(match[1]) : undefined;
}

export function resolveEditionContext({ editionId, version } = {}) {
  if (typeof version !== 'string' || (version !== 'DEV' && !versionPattern.test(version)))
    throw new TypeError('A stable release version or DEV is required.');
  const brand = editionId === undefined ? '' : `${validateEditionId(editionId)}.`;
  const channel =
    editionId === undefined
      ? version === 'DEV'
        ? 'dev'
        : `release-${version}`
      : `edition-${brand}${version === 'DEV' ? 'dev' : `release-${version}`}`;
  const profileKey = `revealline.library.${channel}.v1`;
  return Object.freeze({
    ...(editionId === undefined ? {} : { editionId }),
    version,
    channel,
    profileKey,
    packsKey: `revealline.packs.${channel}.v1`,
    sessionKey: `revealline.suspended.${channel}.v1`,
    writerKey: `${profileKey}.writer`,
    lockKey: `${profileKey}.backup-lock`,
    journalKey: `${profileKey}.backup-journal`,
    indexKey: `${profileKey}.external-chapter-index.v1`,
    externalJournalKey: `${profileKey}.external-chapter-journal.v1`,
  });
}

export function parseEditionChannel(channel) {
  if (typeof channel !== 'string') return null;
  const match = /^edition-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.(dev|release-(v?\d+\.\d+\.\d+))$/.exec(
    channel,
  );
  if (!match) return null;
  try {
    return resolveEditionContext({
      editionId: match[1],
      version: match[2] === 'dev' ? 'DEV' : match[3],
    });
  } catch {
    return null;
  }
}

export function installedStateKey(editionId) {
  return editionId === undefined
    ? 'revealline.installed-app.v1'
    : `revealline.installed-app.edition-${validateEditionId(editionId)}.v1`;
}

/** Stable explicit manifest IDs avoid origin-wide './' identity collisions. */
export function editionAppIdentity({ editionId, basePath = '/' } = {}) {
  validateEditionId(editionId);
  if (typeof basePath !== 'string' || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(basePath))
    throw new TypeError('Edition base path must be an absolute directory path.');
  const root = `${basePath}editions/${editionId}/`;
  return Object.freeze({ id: root, start_url: `${root}app/`, scope: root });
}

/** Hash caches may share bytes; ownership and removal must remain separate. */
export function officialContentOwner({ editionId, packId, revision } = {}) {
  if (
    typeof packId !== 'string' ||
    !editionPattern.test(packId) ||
    packId.length > 100 ||
    typeof revision !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/.test(revision)
  )
    throw new TypeError('Invalid official content ownership.');
  return `${editionId === undefined ? 'default' : validateEditionId(editionId)}:${packId}:${revision}`;
}
