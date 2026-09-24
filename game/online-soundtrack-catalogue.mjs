import { boundedJSON, exactKeys, required } from './data-json.mjs';
import { throwIfSoundtrackAborted } from './mp3.mjs';

export const ONLINE_SOUNDTRACK_CATALOGUE_URL =
  'https://mekhovov.github.io/revealline-soundtracks-01/catalogue.json';
const BASE_URL = 'https://mekhovov.github.io/revealline-soundtracks-01/';
const FORMAT = 'revealline-public-soundtrack-catalogue.v1';
const MAX_BYTES = 512 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const LICENSES = new Set([
  'https://creativecommons.org/publicdomain/zero/1.0/',
  'https://creativecommons.org/licenses/by/3.0/',
  'https://creativecommons.org/licenses/by/4.0/',
]);
const AUDIO_PATH = /^(?:objects|batches\/[a-z0-9][a-z0-9-]{0,63}\/objects)\/[a-f0-9]{64}\.mp3$/;

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
      'audio',
      'aliases',
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
  required(
    value.license === null || typeof value.license === 'string',
    `Online soundtrack licence is invalid: ${id}.`,
  );
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
  return Object.freeze({
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
      credit: text(value.credit, 'credit'),
      license: value.license,
      source: value.source,
    }),
  });
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
  const bytes = new Uint8Array(await response.arrayBuffer());
  throwIfSoundtrackAborted(signal);
  required(bytes.byteLength <= MAX_BYTES, 'Online soundtrack catalogue exceeds its byte limit.');
  return resolveOnlineSoundtrackCatalogue(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
