import { boundedJSON, exactKeys } from './data-json.mjs';
import { throwIfSoundtrackAborted } from './mp3.mjs';

export const ONLINE_SOUNDTRACK_CATALOGUE_URL =
  'https://mekhovov.github.io/revealline-soundtracks-01/catalogue.json';
export const ONLINE_SOUNDTRACK_DIRECTORY_URL =
  'https://mekhovov.github.io/revealline-soundtracks-01/archive-directory.json';
const PRIMARY_ARCHIVE = Object.freeze({
  id: 'revealline-soundtracks-01',
  url: ONLINE_SOUNDTRACK_CATALOGUE_URL,
  baseURL: 'https://mekhovov.github.io/revealline-soundtracks-01/',
  required: true,
});
const FORMAT = 'revealline-public-soundtrack-catalogue.v1';
const DIRECTORY_FORMAT = 'revealline-public-soundtrack-directory.v1';
const MAX_BYTES = 512 * 1024;
const MAX_DIRECTORY_BYTES = 64 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const ARCHIVE_ID = /^revealline-soundtracks-([0-9]{2})$/;
const LICENSES = new Set([
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/licenses/by/3.0/',
  'https://creativecommons.org/licenses/by/4.0/',
  'https://creativecommons.org/licenses/by-sa/3.0/',
  'https://creativecommons.org/licenses/by-sa/4.0/',
]);
const LICENSE_IDENTITIES = new Map([
  [
    'https://creativecommons.org/publicdomain/zero/1.0/',
    { id: 'CC0', version: '1.0', label: 'CC0 1.0 Universal', shareAlike: false },
  ],
  [
    'https://creativecommons.org/licenses/by/3.0/',
    { id: 'CC-BY', version: '3.0', label: 'CC BY 3.0 Unported', shareAlike: false },
  ],
  [
    'https://creativecommons.org/licenses/by/4.0/',
    { id: 'CC-BY', version: '4.0', label: 'CC BY 4.0 International', shareAlike: false },
  ],
  [
    'https://creativecommons.org/licenses/by-sa/3.0/',
    { id: 'CC-BY-SA', version: '3.0', label: 'CC BY-SA 3.0 Unported', shareAlike: true },
  ],
  [
    'https://creativecommons.org/licenses/by-sa/4.0/',
    { id: 'CC-BY-SA', version: '4.0', label: 'CC BY-SA 4.0 International', shareAlike: true },
  ],
]);
const AUDIO_PATH = /^(?:objects|batches\/[a-z0-9][a-z0-9-]{0,63}\/objects)\/[a-f0-9]{64}\.mp3$/;
const RESOLVED_TRACKS = new WeakSet();

function catalogueFailure(key, message, values = Object.create(null), cause = null) {
  const error = cause instanceof Error ? cause : new TypeError(message);
  error.localization = Object.freeze({
    key: `errors:soundtrack.catalogue.${key}`,
    values: Object.freeze({ ...values }),
  });
  return error;
}

function catalogueRequired(condition, key, message, values) {
  if (!condition) throw catalogueFailure(key, message, values);
}

function catalogueExactKeys(value, allowed, label) {
  try {
    exactKeys(value, allowed, label);
  } catch (error) {
    throw catalogueFailure('invalidShape', error.message, undefined, error);
  }
}

function catalogueJSON(source) {
  try {
    return boundedJSON(source, {
      maxBytes: MAX_BYTES,
      maxNodes: 20000,
      maxDepth: 8,
      maxArray: 512,
      maxString: 4096,
    });
  } catch (error) {
    throw catalogueFailure('invalidData', error.message, undefined, error);
  }
}

export function isResolvedOnlineSoundtrackTrack(value) {
  return typeof value === 'object' && value !== null && RESOLVED_TRACKS.has(value);
}

export function onlineSoundtrackRecordingAllowed(value) {
  return value?.recordingModeEligible === true && value?.contentId === false;
}

export function onlineSoundtrackRecordingURL(value, sha256) {
  try {
    const url = new URL(value),
      match = /^\/revealline-soundtracks-([0-9]{2})\/(.+)$/.exec(url.pathname),
      path = match?.[2] ?? '';
    return (
      HASH.test(sha256) &&
      url.origin === 'https://mekhovov.github.io' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      path.length > 0 &&
      AUDIO_PATH.test(path) &&
      path.endsWith(`/${sha256}.mp3`)
    );
  } catch {
    return false;
  }
}

function secureURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function directoryJSON(source) {
  try {
    return boundedJSON(source, {
      maxBytes: MAX_DIRECTORY_BYTES,
      maxNodes: 128,
      maxDepth: 4,
      maxArray: 8,
      maxString: 2048,
    });
  } catch (error) {
    throw catalogueFailure('directoryInvalidData', error.message, undefined, error);
  }
}
function directoryExactKeys(value, allowed, label) {
  try {
    exactKeys(value, allowed, label);
  } catch (error) {
    throw catalogueFailure('directoryInvalidShape', error.message, undefined, error);
  }
}
function archiveDescriptor(value) {
  directoryExactKeys(
    value,
    ['id', 'url', 'baseURL', 'required'],
    'online soundtrack archive directory entry',
  );
  const match = typeof value.id === 'string' ? ARCHIVE_ID.exec(value.id) : null,
    baseURL = match ? `https://mekhovov.github.io/revealline-soundtracks-${match[1]}/` : '';
  catalogueRequired(
    match &&
      value.baseURL === baseURL &&
      value.url === `${baseURL}catalogue.json` &&
      typeof value.required === 'boolean',
    'directoryEntryInvalid',
    'Online soundtrack archive directory entry is invalid.',
  );
  return Object.freeze({ ...value });
}
export function resolveOnlineSoundtrackDirectory(source) {
  const value = directoryJSON(source);
  directoryExactKeys(value, ['format', 'catalogues'], 'online soundtrack archive directory');
  catalogueRequired(
    value.format === DIRECTORY_FORMAT &&
      Array.isArray(value.catalogues) &&
      value.catalogues.length >= 1 &&
      value.catalogues.length <= 8,
    'directoryUnsupported',
    'Unsupported online soundtrack archive directory.',
  );
  const ids = new Set(),
    urls = new Set(),
    catalogues = value.catalogues.map((entry) => {
      const archive = archiveDescriptor(entry);
      catalogueRequired(
        !ids.has(archive.id) && !urls.has(archive.url),
        'directoryDuplicate',
        'Online soundtrack archive directory entries must be unique.',
      );
      ids.add(archive.id);
      urls.add(archive.url);
      return archive;
    });
  catalogueRequired(
    catalogues[0].id === PRIMARY_ARCHIVE.id && catalogues[0].required === true,
    'directoryPrimaryRequired',
    'The primary online soundtrack archive must remain required and first.',
  );
  return Object.freeze({ format: DIRECTORY_FORMAT, catalogues: Object.freeze(catalogues) });
}

function text(value, label, maximum = 2048) {
  catalogueRequired(
    typeof value === 'string' &&
      value.trim() === value &&
      value.length >= 1 &&
      value.length <= maximum,
    'invalidField',
    `Online soundtrack ${label} is invalid.`,
    { field: label },
  );
  return value;
}

function structuredRights(value, legacy, id) {
  const identity = LICENSE_IDENTITIES.get(legacy.licenseURL);
  catalogueRequired(
    identity,
    'rightsLicenceUnsupported',
    `Online soundtrack rights licence is unsupported: ${id}.`,
    { id },
  );
  if (value === undefined) {
    catalogueRequired(
      !identity.shareAlike,
      'shareAlikeRequired',
      `Online soundtrack ShareAlike rights are required: ${id}.`,
      { id },
    );
    return null;
  }
  catalogueExactKeys(
    value,
    [
      'licenseId',
      'licenseVersion',
      'licenseURL',
      'rightsEvidenceURL',
      'attribution',
      'derivativeChangeNotice',
      'shareAlike',
    ],
    'online soundtrack rights',
  );
  catalogueRequired(
    value.licenseId === identity.id &&
      value.licenseVersion === identity.version &&
      value.licenseURL === legacy.licenseURL &&
      value.rightsEvidenceURL === legacy.source &&
      value.attribution === legacy.credit &&
      secureURL(value.rightsEvidenceURL),
    'rightsMismatch',
    `Online soundtrack rights differ from the trusted recording metadata: ${id}.`,
    { id },
  );
  const derivativeChangeNotice = text(
    value.derivativeChangeNotice,
    'derivative change notice',
    2048,
  );
  catalogueExactKeys(
    value.shareAlike,
    ['required', 'deliveryLicenseId', 'deliveryLicenseVersion', 'deliveryLicenseURL'],
    'online soundtrack share-alike rights',
  );
  const shareAlike = value.shareAlike;
  catalogueRequired(
    shareAlike.required === identity.shareAlike &&
      (identity.shareAlike
        ? shareAlike.deliveryLicenseId === identity.id &&
          shareAlike.deliveryLicenseVersion === identity.version &&
          shareAlike.deliveryLicenseURL === legacy.licenseURL
        : shareAlike.deliveryLicenseId === null &&
          shareAlike.deliveryLicenseVersion === null &&
          shareAlike.deliveryLicenseURL === null),
    'shareAlikeInvalid',
    `Online soundtrack share-alike rights are invalid: ${id}.`,
    { id },
  );
  return Object.freeze({
    licenseId: identity.id,
    licenseVersion: identity.version,
    licenseURL: legacy.licenseURL,
    evidence: value.rightsEvidenceURL,
    attribution: legacy.credit,
    derivativeChangeNotice,
    shareAlike: Object.freeze({ ...shareAlike }),
  });
}

function track(value, ids, hashes, archive) {
  catalogueExactKeys(
    value,
    [
      'id',
      'title',
      'artist',
      'durationSeconds',
      'tags',
      'source',
      'license',
      'licenseURL',
      'credit',
      'fileName',
      'archiveId',
      'collection',
      'status',
      'listeningApproval',
      'gameCatalogueAdmission',
      'contentId',
      'recordingModeEligible',
      'default',
      'audio',
      'aliases',
      'rights',
    ],
    'online soundtrack track',
  );
  const id = text(value.id, 'identity', 160);
  catalogueRequired(
    !ids.has(id),
    'duplicateIdentity',
    'Online soundtrack identities must be unique.',
  );
  ids.add(id);
  catalogueRequired(
    value.durationSeconds === null ||
      (Number.isFinite(value.durationSeconds) &&
        value.durationSeconds > 0 &&
        value.durationSeconds <= 3600),
    'durationInvalid',
    `Online soundtrack duration is invalid: ${id}.`,
    { id },
  );
  catalogueRequired(
    Array.isArray(value.tags) &&
      value.tags.length <= 32 &&
      value.tags.every((tag) => typeof tag === 'string' && tag.trim() === tag && tag.length <= 100),
    'tagsInvalid',
    `Online soundtrack tags are invalid: ${id}.`,
    { id },
  );
  catalogueRequired(
    secureURL(value.source),
    'sourceInvalid',
    `Online soundtrack source is invalid: ${id}.`,
    { id },
  );
  catalogueRequired(
    LICENSES.has(value.licenseURL),
    'licenceUnsupported',
    `Online soundtrack licence is unsupported: ${id}.`,
    { id },
  );
  const licenseIdentity = LICENSE_IDENTITIES.get(value.licenseURL);
  catalogueRequired(
    value.license === licenseIdentity.label,
    'licenceInvalid',
    `Online soundtrack licence is invalid: ${id}.`,
    { id },
  );
  catalogueRequired(
    value.gameCatalogueAdmission === false &&
      typeof value.status === 'string' &&
      typeof value.listeningApproval === 'string',
    'reviewInvalid',
    `Online soundtrack review status is invalid: ${id}.`,
    { id },
  );
  catalogueRequired(
    [true, false, null, 'unknown'].includes(value.contentId) &&
      typeof value.recordingModeEligible === 'boolean' &&
      (!value.recordingModeEligible || value.contentId === false),
    'recordingPolicyInvalid',
    `Online soundtrack recording policy is invalid: ${id}.`,
    { id },
  );
  catalogueRequired(
    value.default === undefined || value.default === false,
    'defaultPolicyInvalid',
    `Online soundtrack default policy is invalid: ${id}.`,
    { id },
  );
  catalogueExactKeys(value.audio, ['path', 'bytes', 'sha256'], 'online soundtrack audio');
  catalogueRequired(
    HASH.test(value.audio.sha256) &&
      AUDIO_PATH.test(value.audio.path) &&
      value.audio.path.endsWith(`/${value.audio.sha256}.mp3`) &&
      Number.isSafeInteger(value.audio.bytes) &&
      value.audio.bytes > 0 &&
      value.audio.bytes <= 100_000_000 &&
      !hashes.has(value.audio.sha256),
    'audioIdentityInvalid',
    `Online soundtrack audio identity is invalid: ${id}.`,
    { id },
  );
  hashes.add(value.audio.sha256);
  catalogueRequired(
    Array.isArray(value.aliases) && value.aliases.length <= 16,
    'aliasesInvalid',
    `Online aliases are invalid: ${id}.`,
    { id },
  );
  const credit = text(value.credit, 'credit');
  const rightsEvidence = structuredRights(
    value.rights,
    { licenseURL: value.licenseURL, source: value.source, credit },
    id,
  );
  const resolved = Object.freeze({
    id: `online.${value.audio.sha256}`,
    archiveTrackId: id,
    kind: 'remote',
    title: text(value.title, 'title', 200),
    artist: text(value.artist, 'artist', 200),
    durationSeconds: value.durationSeconds,
    tags: Object.freeze([...value.tags]),
    collection: text(value.collection, 'collection', 200),
    fileName: text(value.fileName, 'filename', 300),
    url: new URL(value.audio.path, archive.baseURL).href,
    bytes: value.audio.bytes,
    sha256: value.audio.sha256,
    contentId: value.contentId,
    recordingModeEligible: value.recordingModeEligible,
    websites: Object.freeze([
      Object.freeze({ label: 'Creator source', url: value.source }),
      Object.freeze({ label: value.license ?? 'Recording licence', url: value.licenseURL }),
    ]),
    rights: Object.freeze({
      kind: 'licensed',
      credit,
      license: value.license,
      source: value.source,
      evidence: rightsEvidence,
    }),
  });
  RESOLVED_TRACKS.add(resolved);
  return resolved;
}

export function resolveOnlineSoundtrackCatalogue(source, { archive = PRIMARY_ARCHIVE } = {}) {
  const descriptor = archiveDescriptor(archive);
  const value = catalogueJSON(source);
  catalogueExactKeys(
    value,
    ['format', 'archive', 'sources', 'counts', 'tracks'],
    'online soundtrack catalogue',
  );
  catalogueRequired(
    value.format === FORMAT,
    'unsupported',
    'Unsupported online soundtrack catalogue.',
  );
  catalogueExactKeys(value.archive, ['id', 'baseURL'], 'online soundtrack archive');
  catalogueRequired(
    value.archive.id === descriptor.id && value.archive.baseURL === descriptor.baseURL,
    'archiveInvalid',
    'Online soundtrack catalogue must use its declared project archive.',
  );
  catalogueRequired(
    Array.isArray(value.sources) && value.sources.length <= 32,
    'sourcesInvalid',
    'Online soundtrack sources are invalid.',
  );
  catalogueExactKeys(
    value.counts,
    ['declaredTracks', 'uniqueRecordings', 'duplicateAliases', 'audioBytes'],
    'online soundtrack counts',
  );
  catalogueRequired(
    Array.isArray(value.tracks) && value.tracks.length <= 256,
    'listTooLarge',
    'Online soundtrack list is too large.',
  );
  const ids = new Set(),
    hashes = new Set(),
    tracks = value.tracks.map((entry) => track(entry, ids, hashes, descriptor));
  catalogueRequired(
    value.counts.uniqueRecordings === tracks.length &&
      value.counts.declaredTracks >= tracks.length &&
      value.counts.duplicateAliases === value.counts.declaredTracks - tracks.length &&
      value.counts.audioBytes === tracks.reduce((sum, item) => sum + item.bytes, 0),
    'countsMismatch',
    'Online soundtrack counts differ from the recording list.',
  );
  return Object.freeze({
    format: FORMAT,
    archive: descriptor,
    tracks: Object.freeze(tracks),
    counts: Object.freeze({ ...value.counts }),
  });
}

async function fetchBoundedText({ request, signal, url, maximum, label, kind = 'catalogue' }) {
  const keys =
    kind === 'directory'
      ? {
          direct: 'directoryDirectResponseRequired',
          bytes: 'directoryByteLimit',
          unreadable: 'directoryResponseUnreadable',
          invalid: 'directoryResponseInvalid',
        }
      : {
          direct: 'directResponseRequired',
          bytes: 'byteLimit',
          unreadable: 'responseUnreadable',
          invalid: 'responseInvalid',
        };
  throwIfSoundtrackAborted(signal);
  const response = await request(url, {
    signal,
    redirect: 'error',
    credentials: 'omit',
    mode: 'cors',
    cache: 'no-store',
  });
  catalogueRequired(
    response?.status === 200 && !response.redirected && response.url === url,
    keys.direct,
    `${label} needs a direct HTTP 200 response.`,
  );
  const length = response.headers.get('content-length');
  catalogueRequired(
    length === null || (/^[0-9]+$/.test(length) && Number(length) <= maximum),
    keys.bytes,
    `${label} exceeds its byte limit.`,
  );
  const reader = response.body?.getReader?.();
  catalogueRequired(reader, keys.unreadable, `${label} response cannot be read safely.`);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      throwIfSoundtrackAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      catalogueRequired(value instanceof Uint8Array, keys.invalid, `${label} response is invalid.`);
      size += value.byteLength;
      if (size > maximum) {
        try {
          await reader.cancel(`${label} exceeds its byte limit.`);
        } catch {}
        throw catalogueFailure(keys.bytes, `${label} exceeds its byte limit.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock?.();
  }
  throwIfSoundtrackAborted(signal);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw catalogueFailure(keys.invalid, `${label} response is invalid.`, undefined, error);
  }
}

export async function fetchOnlineSoundtrackCatalogue({
  fetch: request = globalThis.fetch,
  signal,
  archive = PRIMARY_ARCHIVE,
  url = archive.url,
} = {}) {
  const descriptor = archiveDescriptor(archive);
  catalogueRequired(
    url === descriptor.url,
    'urlInvalid',
    'Online soundtracks require the declared project catalogue URL.',
  );
  return resolveOnlineSoundtrackCatalogue(
    await fetchBoundedText({
      request,
      signal,
      url,
      maximum: MAX_BYTES,
      label: 'Online soundtrack catalogue',
    }),
    { archive: descriptor },
  );
}

export async function fetchOnlineSoundtrackDirectory({
  fetch: request = globalThis.fetch,
  signal,
  url = ONLINE_SOUNDTRACK_DIRECTORY_URL,
} = {}) {
  catalogueRequired(
    url === ONLINE_SOUNDTRACK_DIRECTORY_URL,
    'directoryURLInvalid',
    'Online soundtracks require the project directory URL.',
  );
  return resolveOnlineSoundtrackDirectory(
    await fetchBoundedText({
      request,
      signal,
      url,
      maximum: MAX_DIRECTORY_BYTES,
      label: 'Online soundtrack archive directory',
      kind: 'directory',
    }),
  );
}

export async function fetchOnlineSoundtrackCatalogues(options = {}) {
  let directory,
    directoryError = null;
  try {
    directory = await fetchOnlineSoundtrackDirectory(options);
  } catch (error) {
    throwIfSoundtrackAborted(options.signal);
    directoryError = error;
    directory = Object.freeze({
      format: DIRECTORY_FORMAT,
      catalogues: Object.freeze([PRIMARY_ARCHIVE]),
    });
  }
  const tracks = [],
    ids = new Set(),
    hashes = new Set(),
    unavailable = directoryError
      ? [Object.freeze({ id: 'archive-directory', error: directoryError })]
      : [];
  let declaredTracks = 0,
    duplicateAliases = 0,
    audioBytes = 0;
  for (const archive of directory.catalogues) {
    try {
      const catalogue = await fetchOnlineSoundtrackCatalogue({
          ...options,
          archive,
          url: archive.url,
        }),
        stagedIds = [],
        stagedHashes = [];
      for (const entry of catalogue.tracks) {
        catalogueRequired(
          !ids.has(entry.archiveTrackId) && !hashes.has(entry.sha256),
          'duplicateRecording',
          `Online soundtrack archives contain a duplicate recording: ${entry.archiveTrackId}.`,
          { id: entry.archiveTrackId, archive: archive.id },
        );
        stagedIds.push(entry.archiveTrackId);
        stagedHashes.push(entry.sha256);
      }
      for (const id of stagedIds) ids.add(id);
      for (const hash of stagedHashes) hashes.add(hash);
      tracks.push(...catalogue.tracks);
      declaredTracks += catalogue.counts.declaredTracks;
      duplicateAliases += catalogue.counts.duplicateAliases;
      audioBytes += catalogue.counts.audioBytes;
    } catch (error) {
      throwIfSoundtrackAborted(options.signal);
      if (archive.required) throw error;
      unavailable.push(Object.freeze({ id: archive.id, error }));
    }
  }
  return Object.freeze({
    format: FORMAT,
    tracks: Object.freeze(tracks),
    counts: Object.freeze({
      declaredTracks,
      uniqueRecordings: tracks.length,
      duplicateAliases,
      audioBytes,
    }),
    unavailable: Object.freeze(unavailable),
  });
}
