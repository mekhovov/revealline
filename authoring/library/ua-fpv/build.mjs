import { readFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  boundedJSON,
  canonicalJSON,
  exactKeys,
  required,
  stableId,
} from '../../../game/data-json.mjs';
import { inspectMP3 } from '../../../game/mp3.mjs';
import { resolveCatalogueTrack, SOUNDTRACK_LIMITS } from '../../../game/soundtrack.mjs';
import { resolveSoundtrackPolicy } from '../../../game/soundtrack-rights.mjs';

const base = fileURLToPath(new URL('./', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const text = (value, max = 1024) =>
  typeof value === 'string' && value.trim() && value.length <= max;
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const filename = (value) =>
  text(value, 255) && !/[\\/\x00-\x1f]/.test(value) && value.endsWith('.mp3');
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const sorted = (values) => [...values].sort();
function website(value) {
  required(text(value), 'UA-FPV needs a recording-specific source/license website.');
  const url = new URL(value);
  required(
    ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password,
    'UA-FPV websites require HTTP(S) without credentials.',
  );
  return value;
}
async function ordinary(directory, relative, limit) {
  required(
    text(relative, 512) &&
      !path.isAbsolute(relative) &&
      !relative.includes('\\') &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Unsafe UA-FPV source path.',
  );
  let target = directory;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(!(await lstat(target)).isSymbolicLink(), 'UA-FPV source cannot use symbolic links.');
  }
  const stat = await lstat(target);
  required(
    stat.isFile() && stat.size > 0 && stat.size <= limit,
    'UA-FPV source is missing, empty or oversized.',
  );
  const bytes = await readFile(target);
  required(bytes.length === stat.size, 'UA-FPV source changed while reading.');
  return bytes;
}
async function pinned(directory, pin, prefix, limit) {
  exactKeys(pin, ['path', 'bytes', 'sha256'], 'UA-FPV pinned file');
  required(
    text(pin.path, 512) &&
      pin.path.startsWith(prefix) &&
      Number.isSafeInteger(pin.bytes) &&
      pin.bytes > 0 &&
      pin.bytes <= limit &&
      sha(pin.sha256),
    'Invalid UA-FPV file pin or source scope.',
  );
  const bytes = await ordinary(directory, pin.path, limit);
  required(
    bytes.length === pin.bytes && hash(bytes) === pin.sha256,
    'UA-FPV file differs from its approved hash/bytes.',
  );
  return bytes;
}
const parse = (bytes, maxBytes) =>
  boundedJSON(bytes.toString('utf8'), {
    maxBytes,
    maxNodes: 50000,
    maxDepth: 10,
    maxArray: 512,
    maxString: 8192,
  });
function reviewed(value) {
  required(
    text(value.reviewedBy, 160) &&
      text(value.reviewedAt, 40) &&
      /^\d{4}-\d{2}-\d{2}T/.test(value.reviewedAt) &&
      Number.isFinite(Date.parse(value.reviewedAt)),
    'UA-FPV review needs a named reviewer and dated evidence.',
  );
}
function syncsafe(bytes) {
  required(
    bytes.length === 4 && bytes.every((byte) => byte < 128),
    'Unsupported ID3 size for artwork inspection.',
  );
  return bytes.reduce((size, byte) => size * 128 + byte, 0);
}

/** Exact APIC/PIC frame payload pins, without decoding or copying pictures.
 * Complex tag transforms refuse rather than claiming no artwork was present. */
export function inspectUAFPVArtwork(bytes) {
  if (bytes.subarray(0, 3).toString('ascii') !== 'ID3') return [];
  required(
    bytes.length >= 10 && [2, 3, 4].includes(bytes[3]) && bytes[5] === 0,
    'UA-FPV artwork inspection requires plain ID3v2 tags; review a supported delivery copy.',
  );
  const version = bytes[3],
    end = 10 + syncsafe(bytes.subarray(6, 10));
  required(
    end <= bytes.length && end <= 1024 * 1024 + 10,
    'Unbounded or truncated ID3 artwork tag.',
  );
  const frames = [];
  let offset = 10;
  while (offset < end) {
    if (bytes[offset] === 0) {
      required(
        bytes.subarray(offset, end).every((byte) => byte === 0),
        'Malformed ID3 padding.',
      );
      break;
    }
    const header = version === 2 ? 6 : 10,
      idLength = version === 2 ? 3 : 4;
    required(offset + header <= end, 'Truncated ID3 artwork frame.');
    const id = bytes.subarray(offset, offset + idLength).toString('ascii'),
      length =
        version === 2
          ? bytes.readUIntBE(offset + 3, 3)
          : version === 4
            ? syncsafe(bytes.subarray(offset + 4, offset + 8))
            : bytes.readUInt32BE(offset + 4);
    required(
      new RegExp(`^[A-Z0-9]{${idLength}}$`).test(id) &&
        length > 0 &&
        offset + header + length <= end,
      'Malformed ID3 artwork frame.',
    );
    required(
      version === 2 || bytes.readUInt16BE(offset + 8) === 0,
      'Transformed ID3 frames need separate artwork inspection.',
    );
    if (id === 'APIC' || id === 'PIC') {
      const payload = bytes.subarray(offset + header, offset + header + length);
      frames.push({ sha256: hash(payload), bytes: payload.length });
      required(frames.length <= 16, 'Too many embedded artwork frames.');
    }
    offset += header + length;
  }
  return frames;
}

async function reviewApproval(directory, approval, identity, body) {
  const reviewBytes = await pinned(directory, approval.review, 'evidence/', 256 * 1024),
    review = parse(reviewBytes, 256 * 1024);
  exactKeys(
    review,
    [
      'format',
      'sha256',
      'reviewedBy',
      'reviewedAt',
      'identity',
      'recordingRights',
      'artworkRights',
      'listening',
    ],
    'UA-FPV publication review',
  );
  reviewed(review);
  required(
    review.format === 'revealline-ua-fpv-review.v1' && review.sha256 === approval.sha256,
    'UA-FPV review must bind the exact recording.',
  );
  exactKeys(
    review.identity,
    ['title', 'artist', 'sourceURL', 'fileName', 'filenameAliases', 'confirmed'],
    'UA-FPV identity review',
  );
  required(
    review.identity.confirmed === true &&
      same(review.identity, {
        title: approval.title,
        artist: approval.artist,
        sourceURL: approval.sourceURL,
        fileName: approval.fileName,
        filenameAliases: approval.filenameAliases,
        confirmed: true,
      }),
    'UA-FPV identity, duplicate aliases or source confirmation differs.',
  );
  const rights = review.recordingRights;
  exactKeys(
    rights,
    [
      'rightsHolder',
      'license',
      'licenseURL',
      'attribution',
      'policy',
      'gameUse',
      'composition',
      'recording',
      'performers',
      'samples',
      'gameContext',
      'publicMP3',
      'conditionsMet',
      'evidence',
    ],
    'UA-FPV recording rights',
  );
  required(
    text(rights.rightsHolder, 280) &&
      rights.license === approval.license &&
      rights.licenseURL === approval.licenseURL &&
      rights.attribution === approval.credit &&
      same(rights.policy, approval.policy) &&
      rights.gameUse === 'allowed' &&
      [
        'composition',
        'recording',
        'performers',
        'samples',
        'gameContext',
        'publicMP3',
        'conditionsMet',
      ].every((key) => rights[key] === true),
    'UA-FPV recording/composition/game-context/public-MP3 rights are not fully cleared.',
  );
  await pinned(directory, rights.evidence, 'evidence/', 4 * 1024 * 1024);
  const artwork = review.artworkRights,
    actualArtwork = inspectUAFPVArtwork(body);
  exactKeys(
    artwork,
    ['status', 'frames', 'attribution', 'publicMP3', 'conditionsMet', 'evidence'],
    'UA-FPV embedded artwork rights',
  );
  required(
    same(artwork.frames, actualArtwork) &&
      artwork.status === (actualArtwork.length ? 'cleared' : 'none') &&
      artwork.publicMP3 === true &&
      artwork.conditionsMet === true &&
      typeof artwork.attribution === 'string' &&
      artwork.attribution.length <= 280 &&
      (!actualArtwork.length || text(artwork.attribution, 280)) &&
      approval.credit.includes(artwork.attribution),
    'UA-FPV embedded artwork is uncleared, omitted or differs from its review.',
  );
  await pinned(directory, artwork.evidence, 'evidence/', 4 * 1024 * 1024);
  const listening = review.listening;
  exactKeys(
    listening,
    [
      'fullTrack',
      'repeatedSession',
      'inGameTransition',
      'technicalDecode',
      'ukrainianIdentity',
      'lyricsAndContext',
      'notes',
      'evidence',
    ],
    'UA-FPV listening review',
  );
  required(
    [
      'fullTrack',
      'repeatedSession',
      'inGameTransition',
      'technicalDecode',
      'ukrainianIdentity',
      'lyricsAndContext',
    ].every((key) => listening[key] === true) && text(listening.notes, 8192),
    'UA-FPV full listening, technical, identity and context review must pass.',
  );
  await pinned(directory, listening.evidence, 'evidence/', 4 * 1024 * 1024);
  return {
    id: identity.id,
    sha256: approval.sha256,
    filenameAliases: [...identity.filenameAliases],
    review: { ...approval.review },
    artworkFrames: actualArtwork,
  };
}

/** Public admission only. Reads portable approved/ files, never inventory.sourceFolder.
 * The metadata-only inventory remains historical evidence, not a permission grant. */
export async function compileUAFPVSoundtracks({ baseDirectory = base, edition = 'ua-fpv-1' } = {}) {
  required(stableId(edition), 'Invalid UA-FPV runtime edition.');
  const directory = await realpath(baseDirectory),
    publication = parse(await ordinary(directory, 'publication.json', 512 * 1024), 512 * 1024);
  exactKeys(publication, ['format', 'approved'], 'UA-FPV publication');
  required(
    publication.format === 'revealline-ua-fpv-publication.v1' &&
      Array.isArray(publication.approved) &&
      publication.approved.length <= 256,
    'Invalid UA-FPV public approvals.',
  );
  const tracks = [],
    files = [],
    receipts = [];
  if (!publication.approved.length) return { tracks, files, receipts };
  const inventory = parse(await ordinary(directory, 'inventory.json', 1024 * 1024), 1024 * 1024);
  required(
    inventory.format === 'revealline-ua-fpv-reference-inventory.v1' &&
      Array.isArray(inventory.identities) &&
      inventory.identities.length <= 512 &&
      Array.isArray(inventory.files) &&
      inventory.files.length <= 512,
    'Invalid UA-FPV original reference inventory.',
  );
  const seen = new Set();
  for (const approval of publication.approved) {
    exactKeys(
      approval,
      [
        'sha256',
        'file',
        'title',
        'artist',
        'fileName',
        'filenameAliases',
        'sourceURL',
        'credit',
        'license',
        'licenseURL',
        'policy',
        'review',
      ],
      'UA-FPV approved recording',
    );
    required(
      sha(approval.sha256) && !seen.has(approval.sha256),
      'Duplicate or invalid UA-FPV approved hash.',
    );
    seen.add(approval.sha256);
    const identities = inventory.identities.filter((entry) => entry.sha256 === approval.sha256),
      identity = identities[0],
      aliases = inventory.files.filter((file) => file.sha256 === approval.sha256);
    required(
      identities.length === 1 &&
        identity.id === `ua-reference.${approval.sha256.slice(0, 24)}` &&
        Number.isSafeInteger(identity.bytes) &&
        identity.bytes > 0 &&
        identity.bytes <= SOUNDTRACK_LIMITS.trackBytes &&
        Array.isArray(identity.filenameAliases) &&
        identity.filenameAliases.length > 0 &&
        identity.filenameAliases.every(filename) &&
        new Set(identity.filenameAliases).size === identity.filenameAliases.length &&
        aliases.every((file) => file.identityId === identity.id && file.bytes === identity.bytes) &&
        same(sorted(aliases.map((file) => file.filename)), sorted(identity.filenameAliases)),
      'UA-FPV original hash, size or duplicate alias inventory is inconsistent.',
    );
    required(
      text(approval.title, 120) &&
        text(approval.artist, 160) &&
        text(approval.credit, 280) &&
        text(approval.license, 280) &&
        filename(approval.fileName) &&
        identity.filenameAliases.includes(approval.fileName) &&
        Array.isArray(approval.filenameAliases) &&
        same(sorted(approval.filenameAliases), sorted(identity.filenameAliases)),
      'UA-FPV original filename, complete alias list or credited identity differs.',
    );
    website(approval.sourceURL);
    website(approval.licenseURL);
    const id = `builtin.catalog.ua-fpv.${approval.sha256.slice(0, 24)}`,
      policy = resolveSoundtrackPolicy(approval.policy, { id, sha256: approval.sha256 });
    required(
      policy.webPlayback === 'allowed' && policy.redistribute === 'allowed',
      'Only UA-FPV recordings cleared for game playback and public MP3 redistribution may be compiled.',
    );
    required(
      approval.file?.sha256 === approval.sha256 &&
        approval.file?.bytes === identity.bytes &&
        approval.file?.path?.endsWith('.mp3'),
      'UA-FPV approved bytes must be the exact inventoried recording.',
    );
    const body = await pinned(directory, approval.file, 'approved/', SOUNDTRACK_LIMITS.trackBytes),
      receipt = await reviewApproval(directory, approval, identity, body),
      asset = await inspectMP3(new Blob([body], { type: 'audio/mpeg' })),
      name = `optional/soundtracks/ua-fpv/${asset.sha256}.mp3`;
    required(!tracks.some((track) => track.id === id), 'UA-FPV hash-prefix identity collision.');
    tracks.push(
      resolveCatalogueTrack({
        format: 'revealline-audio-track.v1',
        id,
        kind: 'mp3',
        title: approval.title,
        artist: approval.artist,
        fileName: approval.fileName,
        asset,
        rights: {
          kind: 'licensed',
          credit: approval.credit,
          license: approval.license,
          source: approval.sourceURL,
        },
        edition,
        path: name,
        policy,
        websites: [
          { label: 'Recording source', url: approval.sourceURL },
          { label: 'Recording license', url: approval.licenseURL },
        ],
        tags: { genres: ['ukrainian'], role: 'gameplay', energy: 3, themes: ['fpv'] },
      }),
    );
    files.push({ name, bytes: body });
    receipts.push(receipt);
  }
  return { tracks, files, receipts };
}
