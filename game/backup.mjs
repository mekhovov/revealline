import { boundedJSON, exactKeys, plainObject, required } from './data-json.mjs';
import { CONTENT_LIMITS } from './content.mjs';
import { browserDecodeImage } from './imports.mjs';
import { importLibrary, campaignKey, LIBRARY_LIMITS } from './library.mjs';
import { importPackLibrary, resolvePackCampaign, PACK_LIMITS } from './packs.mjs';
import { restoreSession, snapshotSession, SESSION_IMPORT_BYTES } from './sessions.mjs';
import { MAX_REPLAY_TICKS } from './replay.mjs';

export const BACKUP_FORMAT = 'xonix-backup.v1';
// The existing limits remain authoritative for each member. This outer guard
// fits them together without requiring players to coordinate several files.
export const MAX_BACKUP_BYTES =
  PACK_LIMITS.libraryBytes + LIBRARY_LIMITS.maxBytes + SESSION_IMPORT_BYTES + 16384;
const limits = Object.freeze({
  maxBytes: MAX_BACKUP_BYTES,
  maxNodes: 3400000,
  maxDepth: 30,
  maxArray: MAX_REPLAY_TICKS,
  maxString: CONTENT_LIMITS.maxEncodedImageChars,
});
const preparedBackups = new WeakSet();
export const isPreparedBackup = (value) => preparedBackups.has(value);
const freeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
function checkAbort(signal) {
  if (signal?.aborted) {
    const error = new Error('Backup preparation was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}
function envelope(candidate) {
  const value = boundedJSON(candidate, limits);
  exactKeys(value, ['format', 'library', 'packs', 'session'], 'backup');
  required(value.format === BACKUP_FORMAT, 'Unsupported full-backup format.');
  required(
    plainObject(value.library) && plainObject(value.packs),
    'A full backup must include its player library and expansion library.',
  );
  required(
    value.session === null || plainObject(value.session),
    'A full backup must include an unfinished attempt or explicit session: null.',
  );
  return value;
}

/**
 * Fully prepare a portable backup, without storage or live-state mutations.
 * `campaigns` and optional synchronous `resolveCampaign(key)` are trusted host
 * content (for example the built-in campaign and dated challenge generator).
 * Pack campaigns always come from this backup's successfully prepared packs.
 */
export async function prepareBackup(
  candidate,
  { campaigns = [], decodeImage = browserDecodeImage, signal, onProgress, resolveCampaign } = {},
) {
  checkAbort(signal);
  // Snapshot every supplied data object before the first await; do not permit
  // caller edits during image decoding/replay verification to change adoption.
  const value = envelope(candidate);
  const registered = boundedJSON(campaigns);
  required(Array.isArray(registered), 'Registered backup campaigns must be an array.');
  required(
    resolveCampaign === undefined || typeof resolveCampaign === 'function',
    'The campaign resolver must be a trusted function, not backup data.',
  );
  const known = new Map(registered.map((campaign) => [campaignKey(campaign), campaign]));
  // Fail malformed profile data before any image allocation. Repeat known-
  // campaign validation after the backup's expansions become available.
  importLibrary(value.library, { campaigns: registered });
  if (value.session !== null) value.session = snapshotSession(value.session);
  const packs = await importPackLibrary(value.packs, {
    decodeImage: async (...args) => {
      checkAbort(signal);
      const decoded = await decodeImage(...args);
      checkAbort(signal);
      return decoded;
    },
  });
  checkAbort(signal);
  for (const pack of packs.packs)
    for (const source of pack.campaigns) {
      const { campaign } = resolvePackCampaign(pack, source.id);
      known.set(campaignKey(campaign), campaign);
    }
  if (value.session !== null) {
    const key = value.session.campaignKey;
    required(
      typeof key === 'string' && key.length > 0 && key.length <= 300,
      'Saved attempt campaign identity is invalid.',
    );
    if (!known.has(key) && resolveCampaign) {
      const found = resolveCampaign(key);
      if (found !== null && found !== undefined) {
        const campaign = boundedJSON(found);
        required(campaignKey(campaign) === key, 'Resolved backup campaign identity differs.');
        known.set(key, campaign);
      }
    }
    required(
      known.has(key),
      'The unfinished attempt requires a matching included pack or registered campaign.',
    );
    await restoreSession(value.session, {
      campaign: known.get(key),
      campaignKey: key,
      signal,
      onProgress,
    });
  }
  checkAbort(signal);
  const library = importLibrary(value.library, { campaigns: [...known.values()] });
  const prepared = freeze({ library, packs, session: value.session });
  preparedBackups.add(prepared);
  return prepared;
}

/** Validation includes image decoding and any replay; errors reject the promise. */
export const validateBackup = prepareBackup;

/** Produce compact, validated JSON. Member exports keep their existing formats. */
export async function exportBackup(contents, options = {}) {
  const value = boundedJSON(contents, limits);
  exactKeys(value, ['library', 'packs', 'session'], 'backup contents');
  const prepared = await prepareBackup(
    { format: BACKUP_FORMAT, ...value, session: value.session ?? null },
    options,
  );
  const text = JSON.stringify({ format: BACKUP_FORMAT, ...prepared });
  required(new TextEncoder().encode(text).byteLength <= MAX_BACKUP_BYTES, 'Backup is too large.');
  return text;
}
