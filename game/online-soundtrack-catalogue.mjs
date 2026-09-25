import { boundedJSON, exactKeys, required } from './data-json.mjs';
import { throwIfSoundtrackAborted } from './mp3.mjs';

export const ONLINE_SOUNDTRACK_CATALOGUE_URL =
  'https://mekhovov.github.io/revealline-soundtracks-01/catalogue.json';
const BASE_URL = 'https://mekhovov.github.io/revealline-soundtracks-01/';
const BASE = new URL(BASE_URL);
const FORMAT = 'revealline-public-soundtrack-catalogue.v1';
const MAX_BYTES = 512 * 1024;
const HASH = /^[a-f0-9]{64}$/;
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

export function isResolvedOnlineSoundtrackTrack(value) {
  return typeof value === 'object' && value !== null && RESOLVED_TRACKS.has(value);
}

export function onlineSoundtrackRecordingAllowed(value) {
  return value?.recordingModeEligible === true && value?.contentId === false;
}

export function onlineSoundtrackRecordingURL(value, sha256) {
  try {
    const url = new URL(value),
      prefix = BASE.pathname,
      path = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
    return (
      HASH.test(sha256) &&
      url.origin === BASE.origin &&
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

function text(value, label, maximum = 2048) {
  required(
    typeof value === 'string' &&
      value.trim() === value &&
      value.length >= 1 &&
      value.length <= maximum,
    `Online soundtrack ${label} is invalid.`,
  );
  return value;
}

function structuredRights(value, legacy, id) {
  const identity = LICENSE_IDENTITIES.get(legacy.licenseURL);
  required(identity, `Online soundtrack rights licence is unsupported: ${id}.`);
  if (value === undefined) {
    required(!identity.shareAlike, `Online soundtrack ShareAlike rights are required: ${id}.`);
    return null;
  }
  exactKeys(
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
  required(
    value.licenseId === identity.id &&
      value.licenseVersion === identity.version &&
      value.licenseURL === legacy.licenseURL &&
      value.rightsEvidenceURL === legacy.source &&
      value.attribution === legacy.credit &&
      secureURL(value.rightsEvidenceURL),
    `Online soundtrack rights differ from the trusted recording metadata: ${id}.`,
  );
  const derivativeChangeNotice = text(
    value.derivativeChangeNotice,
    'derivative change notice',
    2048,
  );
  exactKeys(
    value.shareAlike,
    ['required', 'deliveryLicenseId', 'deliveryLicenseVersion', 'deliveryLicenseURL'],
    'online soundtrack share-alike rights',
  );
  const shareAlike = value.shareAlike;
  required(
    shareAlike.required === identity.shareAlike &&
      (identity.shareAlike
        ? shareAlike.deliveryLicenseId === identity.id &&
          shareAlike.deliveryLicenseVersion === identity.version &&
          shareAlike.deliveryLicenseURL === legacy.licenseURL
        : shareAlike.deliveryLicenseId === null &&
          shareAlike.deliveryLicenseVersion === null &&
          shareAlike.deliveryLicenseURL === null),
    `Online soundtrack share-alike rights are invalid: ${id}.`,
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

function track(value, ids, hashes) {
  exactKeys(
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
  required(!ids.has(id), 'Online soundtrack identities must be unique.');
  ids.add(id);
  required(
    value.durationSeconds === null ||
      (Number.isFinite(value.durationSeconds) &&
        value.durationSeconds > 0 &&
        value.durationSeconds <= 3600),
    `Online soundtrack duration is invalid: ${id}.`,
  );
  required(
    Array.isArray(value.tags) &&
      value.tags.length <= 32 &&
      value.tags.every((tag) => typeof tag === 'string' && tag.trim() === tag && tag.length <= 100),
    `Online soundtrack tags are invalid: ${id}.`,
  );
  required(secureURL(value.source), `Online soundtrack source is invalid: ${id}.`);
  required(LICENSES.has(value.licenseURL), `Online soundtrack licence is unsupported: ${id}.`);
  const licenseIdentity = LICENSE_IDENTITIES.get(value.licenseURL);
  required(value.license === licenseIdentity.label, `Online soundtrack licence is invalid: ${id}.`);
  required(
    value.gameCatalogueAdmission === false &&
      typeof value.status === 'string' &&
      typeof value.listeningApproval === 'string',
    `Online soundtrack review status is invalid: ${id}.`,
  );
  required(
    [true, false, null, 'unknown'].includes(value.contentId) &&
      typeof value.recordingModeEligible === 'boolean' &&
      (!value.recordingModeEligible || value.contentId === false),
    `Online soundtrack recording policy is invalid: ${id}.`,
  );
  required(
    value.default === undefined || value.default === false,
    `Online soundtrack default policy is invalid: ${id}.`,
  );
  exactKeys(value.audio, ['path', 'bytes', 'sha256'], 'online soundtrack audio');
  required(
    HASH.test(value.audio.sha256) &&
      AUDIO_PATH.test(value.audio.path) &&
      value.audio.path.endsWith(`/${value.audio.sha256}.mp3`) &&
      Number.isSafeInteger(value.audio.bytes) &&
      value.audio.bytes > 0 &&
      value.audio.bytes <= 100_000_000 &&
      !hashes.has(value.audio.sha256),
    `Online soundtrack audio identity is invalid: ${id}.`,
  );
  hashes.add(value.audio.sha256);
  required(
    Array.isArray(value.aliases) && value.aliases.length <= 16,
    `Online aliases are invalid: ${id}.`,
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
    url: new URL(value.audio.path, BASE_URL).href,
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

export function resolveOnlineSoundtrackCatalogue(source) {
  const value = boundedJSON(source, {
    maxBytes: MAX_BYTES,
    maxNodes: 20000,
    maxDepth: 8,
    maxArray: 512,
    maxString: 4096,
  });
  exactKeys(
    value,
    ['format', 'archive', 'sources', 'counts', 'tracks'],
    'online soundtrack catalogue',
  );
  required(value.format === FORMAT, 'Unsupported online soundtrack catalogue.');
  exactKeys(value.archive, ['id', 'baseURL'], 'online soundtrack archive');
  required(
    value.archive.id === 'revealline-soundtracks-01' && value.archive.baseURL === BASE_URL,
    'Online soundtrack catalogue must use the project archive.',
  );
  required(
    Array.isArray(value.sources) && value.sources.length <= 32,
    'Online soundtrack sources are invalid.',
  );
  exactKeys(
    value.counts,
    ['declaredTracks', 'uniqueRecordings', 'duplicateAliases', 'audioBytes'],
    'online soundtrack counts',
  );
  required(
    Array.isArray(value.tracks) && value.tracks.length <= 256,
    'Online soundtrack list is too large.',
  );
  const ids = new Set(),
    hashes = new Set(),
    tracks = value.tracks.map((entry) => track(entry, ids, hashes));
  required(
    value.counts.uniqueRecordings === tracks.length &&
      value.counts.declaredTracks >= tracks.length &&
      value.counts.duplicateAliases === value.counts.declaredTracks - tracks.length &&
      value.counts.audioBytes === tracks.reduce((sum, item) => sum + item.bytes, 0),
    'Online soundtrack counts differ from the recording list.',
  );
  return Object.freeze({
    format: FORMAT,
    tracks: Object.freeze(tracks),
    counts: Object.freeze({ ...value.counts }),
  });
}

export async function fetchOnlineSoundtrackCatalogue({
  fetch: request = globalThis.fetch,
  signal,
  url = ONLINE_SOUNDTRACK_CATALOGUE_URL,
} = {}) {
  required(
    url === ONLINE_SOUNDTRACK_CATALOGUE_URL,
    'Online soundtracks require the project catalogue URL.',
  );
  throwIfSoundtrackAborted(signal);
  const response = await request(url, {
    signal,
    redirect: 'error',
    credentials: 'omit',
    mode: 'cors',
    cache: 'no-store',
  });
  required(
    response?.status === 200 && !response.redirected && response.url === url,
    'Online soundtrack catalogue needs a direct HTTP 200 response.',
  );
  const length = response.headers.get('content-length');
  required(
    length === null || (/^[0-9]+$/.test(length) && Number(length) <= MAX_BYTES),
    'Online soundtrack catalogue exceeds its byte limit.',
  );
  const reader = response.body?.getReader?.();
  required(reader, 'Online soundtrack catalogue response cannot be read safely.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      throwIfSoundtrackAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      required(value instanceof Uint8Array, 'Online soundtrack catalogue response is invalid.');
      size += value.byteLength;
      if (size > MAX_BYTES) {
        try {
          await reader.cancel('Online soundtrack catalogue exceeds its byte limit.');
        } catch {
          // The byte limit remains authoritative even if the network cannot be cancelled cleanly.
        }
        throw new Error('Online soundtrack catalogue exceeds its byte limit.');
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
  return resolveOnlineSoundtrackCatalogue(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
