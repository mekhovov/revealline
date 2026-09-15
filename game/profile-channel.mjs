/** Exact profile-channel names shared by transfer and read-only recovery. */
const versionPattern = /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/;
const prefix = 'revealline.library.';
const suffix = '.v1';
function versionParts(version) {
  if (typeof version !== 'string') return null;
  const match = versionPattern.exec(version.replace(/^v/, ''));
  return match ? match.slice(1).map(Number) : null;
}
function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function targetVersion(version) {
  const parsed = versionParts(version);
  if (!parsed)
    throw new TypeError('A stable current release version is required for collection transfer.');
  return parsed;
}
function sourceFor(channel, current) {
  if (typeof channel !== 'string') return null;
  const legacy = channel === 'release';
  const buildLabel = legacy ? 'v0.2.0' : /^release-(v?\d+\.\d+\.\d+)$/.exec(channel)?.[1];
  const parsed = versionParts(buildLabel);
  if (!parsed || (!legacy && compare(parsed, [0, 2, 1]) < 0) || compare(parsed, current) >= 0)
    return null;
  const profileKey = `${prefix}${channel}${suffix}`;
  return Object.freeze({
    id: channel,
    channel,
    version: `v${parsed.join('.')}`,
    buildLabel,
    legacy,
    profileKey,
    packsKey: `revealline.packs.${channel}.v1`,
    sessionKey: `revealline.suspended.${channel}.v1`,
    journalKey: `${profileKey}.backup-journal`,
    writerKey: `${profileKey}.writer`,
    lockKey: `${profileKey}.backup-lock`,
  });
}

export { versionParts, compare, targetVersion, sourceFor };

const channels = new WeakSet();
export function recoveryChannel(id, currentVersion) {
  const current = targetVersion(currentVersion);
  if (typeof id !== 'string') return null;
  const earlier = sourceFor(id, current);
  const label = id === 'release' ? 'v0.2.0' : /^release-(v?\d+\.\d+\.\d+)$/.exec(id)?.[1];
  const parsed = versionParts(label);
  if (!earlier && id !== 'dev' && !parsed) return null;
  const profileKey = `${prefix}${id}${suffix}`;
  const source = Object.freeze({
    ...(earlier ?? {
      id,
      channel: id,
      version: parsed ? `v${parsed.join('.')}` : null,
      buildLabel: label ?? 'DEV',
      legacy: false,
      profileKey,
      packsKey: `revealline.packs.${id}.v1`,
      sessionKey: `revealline.suspended.${id}.v1`,
      journalKey: `${profileKey}.backup-journal`,
      writerKey: `${profileKey}.writer`,
      lockKey: `${profileKey}.backup-lock`,
    }),
    indexKey: `${profileKey}.external-chapter-index.v1`,
    externalJournalKey: `${profileKey}.external-chapter-journal.v1`,
    support: earlier
      ? 'historical'
      : parsed && compare(parsed, current) === 0
        ? 'current'
        : 'protected-unknown',
  });
  channels.add(source);
  return source;
}
export const isRecoveryChannel = (source) => channels.has(source);
export function channelFromStorageKey(key, currentVersion) {
  if (typeof key !== 'string') return null;
  const match =
    /^revealline\.(?:library|packs|suspended)\.(.+?)\.v1(?:\.(?:backup-lock|backup-journal|external-chapter-index\.v1|external-chapter-journal\.v1))?$/.exec(
      key,
    );
  return match ? recoveryChannel(match[1], currentVersion) : null;
}
