import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boundedJSON, exactKeys, required, stableId } from '../../../game/data-json.mjs';
import { inspectMP3 } from '../../../game/mp3.mjs';
import {
  resolveSoundtrackCatalogue,
  SOUNDTRACK_CATALOGUE_FORMAT_V2,
} from '../../../game/soundtrack.mjs';
import { resolveSoundtrackPolicy } from '../../../game/soundtrack-rights.mjs';

export const ORIGINAL_PRODUCTION_FORMAT = 'revealline-original-production.v1';
export const ORIGINAL_READY_FORMAT = 'revealline-original-ready.v1';
export const ORIGINAL_REVIEW_GATES = Object.freeze([
  'composition',
  'originality',
  'fullListening',
  'technical',
  'inGameMix',
  'transitions',
  'culturalAccuracy',
  'publicationRights',
]);
const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const hash = (body) => createHash('sha256').update(body).digest('hex');
const nonempty = (value, max = 4096) =>
  typeof value === 'string' && !!value.trim() && value.length <= max;
const families = ['synth90s', 'metal', 'ukrainian'];
const roles = ['menu', 'gameplay', 'finale'];

/** This authoring catalogue is deliberately separate from ready runtime media. */
export function resolveOriginalProduction(value) {
  const production = boundedJSON(value, { maxBytes: 512 * 1024, maxDepth: 12 });
  exactKeys(
    production,
    ['format', 'edition', 'status', 'summary', 'standards', 'pilotIds', 'fusionPilotId', 'tracks'],
    'production',
  );
  required(
    production.format === ORIGINAL_PRODUCTION_FORMAT && stableId(production.edition),
    'Invalid original production identity.',
  );
  required(
    production.status === 'planned' &&
      Array.isArray(production.tracks) &&
      production.tracks.length === 36,
    'Expected 36 planned composition briefs.',
  );
  const ids = new Set();
  for (const track of production.tracks) {
    required(
      stableId(track.id) && track.id.startsWith('original.') && !ids.has(track.id),
      'Invalid or duplicate original brief ID.',
    );
    ids.add(track.id);
    required(
      track.status === 'planned' && Array.isArray(track.assets) && track.assets.length === 0,
      'Planned briefs cannot declare ready audio.',
    );
    required(
      families.includes(track.family) && roles.includes(track.role),
      'Invalid composition family or role.',
    );
    required(
      Array.isArray(track.genres) &&
        track.genres.length >= 1 &&
        track.genres.length <= 2 &&
        track.genres[0] === track.family &&
        new Set(track.genres).size === track.genres.length &&
        track.genres.every((genre) => families.includes(genre)),
      'Invalid composition fusion.',
    );
    required(
      [
        'title',
        'meter',
        'tonalPalette',
        'motif',
        'rhythm',
        'contrast',
        'aesthetic',
        'form',
        'promptId',
        'prompt',
      ].every((key) => nonempty(track[key])),
      'Incomplete composition brief.',
    );
    const [minimum, maximum] = track.role === 'menu' ? [120, 180] : [180, 300];
    required(
      Number.isInteger(track.tempoBpm) &&
        track.tempoBpm >= 50 &&
        track.tempoBpm <= 220 &&
        Number.isInteger(track.energy) &&
        track.energy >= 1 &&
        track.energy <= 5 &&
        track.targetDurationSeconds >= minimum &&
        track.targetDurationSeconds <= maximum,
      'Invalid composition tempo, energy or duration.',
    );
    required(
      Array.isArray(track.instruments) &&
        track.instruments.length >= 3 &&
        track.instruments.every((value) => nonempty(value)) &&
        Array.isArray(track.referenceIds) &&
        track.referenceIds.length > 0 &&
        track.referenceIds.every(stableId),
      'Missing instruments or source references.',
    );
  }
  for (const family of families) {
    const tracks = production.tracks.filter((track) => track.family === family);
    required(
      tracks.length === 12 &&
        tracks.filter((t) => t.role === 'menu').length === 2 &&
        tracks.filter((t) => t.role === 'gameplay').length === 8 &&
        tracks.filter((t) => t.role === 'finale').length === 2 &&
        tracks.filter((t) => t.genres.length === 2).length === 2,
      'Each family needs 2 menu, 8 gameplay, 2 finale and 2 fusion compositions.',
    );
  }
  required(
    Array.isArray(production.pilotIds) &&
      production.pilotIds.length === 3 &&
      new Set(
        production.pilotIds.map((id) => production.tracks.find((track) => track.id === id)?.family),
      ).size === 3 &&
      production.pilotIds.every((id) => ids.has(id)) &&
      ids.has(production.fusionPilotId),
    'Invalid production pilots.',
  );
  return production;
}

async function pinnedFile(base, pin, maxBytes) {
  exactKeys(pin, ['path', 'bytes', 'sha256'], 'production file');
  required(
    nonempty(pin.path, 400) &&
      !path.isAbsolute(pin.path) &&
      !pin.path.includes('\\') &&
      pin.path.split('/').every((part) => part && part !== '.' && part !== '..') &&
      Number.isSafeInteger(pin.bytes) &&
      pin.bytes > 0 &&
      pin.bytes <= maxBytes &&
      /^[a-f0-9]{64}$/.test(pin.sha256),
    'Invalid bounded production file pin.',
  );
  let current = path.resolve(base);
  const baseStat = await lstat(current);
  required(
    baseStat.isDirectory() && !baseStat.isSymbolicLink(),
    'Production root must be an ordinary directory.',
  );
  for (const part of pin.path.split('/')) {
    current = path.join(current, part);
    required(!(await lstat(current)).isSymbolicLink(), 'Production file links are not accepted.');
  }
  const stat = await lstat(current);
  required(stat.isFile() && stat.size === pin.bytes, 'Production file size differs.');
  const body = await readFile(current);
  required(body.length === pin.bytes && hash(body) === pin.sha256, 'Production file hash differs.');
  return body;
}

export function inspectOriginalMaster(body) {
  if (body.toString('ascii', 0, 4) === 'fLaC') {
    required(body.length > 42 && (body[4] & 0x7f) === 0, 'FLAC needs a leading STREAMINFO block.');
    let offset = 4;
    let stream;
    let last = false;
    while (!last) {
      required(offset + 4 <= body.length, 'Truncated FLAC metadata.');
      last = (body[offset] & 0x80) !== 0;
      const type = body[offset] & 0x7f;
      const length = body.readUIntBE(offset + 1, 3);
      const start = offset + 4;
      required(type !== 127 && start + length <= body.length, 'Invalid FLAC metadata block.');
      if (type === 0) {
        required(!stream && length === 34, 'Invalid FLAC STREAMINFO.');
        const packed = body.readBigUInt64BE(start + 10);
        stream = {
          sampleRate: Number(packed >> 44n),
          channels: Number((packed >> 41n) & 7n) + 1,
          bitsPerSample: Number((packed >> 36n) & 31n) + 1,
          samples: Number(packed & 0xfffffffffn),
        };
        required(
          body.readUInt16BE(start) >= 16 &&
            body.readUInt16BE(start + 2) >= body.readUInt16BE(start),
          'Invalid FLAC block-size bounds.',
        );
      }
      offset = start + length;
    }
    required(
      stream &&
        stream.channels === 2 &&
        [44100, 48000].includes(stream.sampleRate) &&
        [16, 24, 32].includes(stream.bitsPerSample) &&
        stream.samples > 0 &&
        offset + 2 < body.length &&
        body[offset] === 0xff &&
        (body[offset + 1] & 0xfc) === 0xf8,
      'Master must preserve supported native-resolution stereo FLAC with audio frames.',
    );
    return {
      durationSeconds: stream.samples / stream.sampleRate,
      sampleRate: stream.sampleRate,
      channels: stream.channels,
      bitsPerSample: stream.bitsPerSample,
      encoding: 'flac',
    };
  }
  required(
    body.length >= 44 &&
      body.toString('ascii', 0, 4) === 'RIFF' &&
      body.toString('ascii', 8, 12) === 'WAVE' &&
      body.readUInt32LE(4) + 8 === body.length,
    'Master must be an intact RIFF/WAVE file.',
  );
  let format,
    dataBytes = 0;
  for (let offset = 12; offset + 8 <= body.length; ) {
    const kind = body.toString('ascii', offset, offset + 4),
      length = body.readUInt32LE(offset + 4),
      start = offset + 8;
    required(start + length <= body.length, 'Truncated WAV chunk.');
    if (kind === 'fmt ') {
      required(!format && length >= 16, 'Invalid WAV format chunk.');
      format = {
        kind: body.readUInt16LE(start),
        channels: body.readUInt16LE(start + 2),
        rate: body.readUInt32LE(start + 4),
        alignment: body.readUInt16LE(start + 12),
        bits: body.readUInt16LE(start + 14),
      };
    }
    if (kind === 'data') dataBytes += length;
    offset = start + length + (length % 2);
  }
  required(
    format &&
      format.channels === 2 &&
      [44100, 48000].includes(format.rate) &&
      ((format.kind === 1 && [16, 24, 32].includes(format.bits)) ||
        (format.kind === 3 && format.bits === 32)) &&
      format.alignment === (2 * format.bits) / 8 &&
      dataBytes > 0 &&
      dataBytes % format.alignment === 0,
    'Master must preserve supported native-resolution stereo PCM or float WAV.',
  );
  return {
    durationSeconds: dataBytes / format.alignment / format.rate,
    sampleRate: format.rate,
    channels: format.channels,
    bitsPerSample: format.bits,
    encoding: format.kind === 1 ? 'pcm' : 'float',
  };
}

/** No network, generation, encoding or approval inference. Review assertions remain human evidence. */
export async function compileReadyOriginals(
  productionValue,
  readyValue,
  { baseDirectory = folder } = {},
) {
  const production = resolveOriginalProduction(productionValue);
  const ready = boundedJSON(readyValue, { maxBytes: 128 * 1024, maxDepth: 12 });
  exactKeys(ready, ['format', 'edition', 'tracks'], 'ready originals');
  required(
    ready.format === ORIGINAL_READY_FORMAT &&
      ready.edition === production.edition &&
      Array.isArray(ready.tracks) &&
      ready.tracks.length <= 36 &&
      new Set(ready.tracks.map((track) => track.id)).size === ready.tracks.length,
    'Invalid ready-original register.',
  );
  for (const family of families) {
    const group = production.tracks.filter((track) => track.family === family);
    for (const offset of [0, 6]) {
      const ids = new Set(group.slice(offset, offset + 6).map((track) => track.id));
      const bytes = ready.tracks
        .filter((track) => ids.has(track.id))
        .reduce((sum, track) => sum + track.mp3?.bytes, 0);
      required(
        Number.isSafeInteger(bytes) && bytes <= 64 * 1024 * 1024,
        'Original six-track volume exceeds 64 MiB or has invalid byte pins.',
      );
    }
  }
  const tracks = [],
    files = [],
    receipts = [];
  for (const accepted of ready.tracks) {
    exactKeys(
      accepted,
      ['id', 'artist', 'master', 'mp3', 'rights', 'review', 'policy'],
      'ready original',
    );
    const brief = production.tracks.find((track) => track.id === accepted.id);
    required(
      brief && nonempty(accepted.artist, 160),
      'Ready original has no composition brief or artist.',
    );
    required(
      accepted.rights?.kind === 'original' &&
        nonempty(accepted.rights.license, 280) &&
        nonempty(accepted.rights.credit, 280),
      'Original publication requires explicit rights and credit.',
    );
    let source;
    try {
      source = new URL(accepted.rights.source);
    } catch {}
    required(
      source && source.protocol === 'https:' && !source.username && !source.password,
      'Original publication needs its HTTPS provenance source.',
    );
    required(
      /\.(wav|flac)$/.test(accepted.master.path) &&
        accepted.mp3.path.endsWith('.mp3') &&
        accepted.review.path.endsWith('.json'),
      'Unexpected production file type.',
    );
    const review = boundedJSON(
      (await pinnedFile(baseDirectory, accepted.review, 64 * 1024)).toString('utf8'),
    );
    exactKeys(
      review,
      [
        'format',
        'id',
        'reviewer',
        'reviewedAt',
        'masterSha256',
        'mp3Sha256',
        'gates',
        'measurements',
        'production',
      ],
      'original review',
    );
    required(
      review.format === 'revealline-original-approval.v1' &&
        review.id === brief.id &&
        nonempty(review.reviewer, 160) &&
        /^\d{4}-\d{2}-\d{2}T/.test(review.reviewedAt) &&
        Number.isFinite(Date.parse(review.reviewedAt)) &&
        review.masterSha256 === accepted.master.sha256 &&
        review.mp3Sha256 === accepted.mp3.sha256,
      'Review identity does not match these exact originals.',
    );
    exactKeys(review.gates, ORIGINAL_REVIEW_GATES, 'review gates');
    required(
      ORIGINAL_REVIEW_GATES.every((gate) => review.gates[gate] === true),
      'Every original review gate must pass explicitly.',
    );
    const measurements = review.measurements;
    exactKeys(
      measurements,
      ['durationSeconds', 'integratedLUFS', 'truePeakDbTP', 'fullDecode', 'method'],
      'review measurements',
    );
    const [minimum, maximum] = brief.role === 'menu' ? [120, 180] : [180, 300];
    required(
      measurements.fullDecode === true &&
        nonempty(measurements.method) &&
        Number.isFinite(measurements.integratedLUFS) &&
        measurements.integratedLUFS >= -17 &&
        measurements.integratedLUFS <= -15 &&
        Number.isFinite(measurements.truePeakDbTP) &&
        measurements.truePeakDbTP <= -1 &&
        measurements.truePeakDbTP >= -120 &&
        measurements.durationSeconds >= minimum &&
        measurements.durationSeconds <= maximum,
      'Original measurements fail the game-mix or duration targets.',
    );
    exactKeys(
      review.production,
      ['method', 'tool', 'version', 'promptId', 'rightsEvidence', 'sessionEvidence'],
      'production receipt',
    );
    required(
      nonempty(review.production.method, 280) &&
        nonempty(review.production.tool, 280) &&
        nonempty(review.production.version, 280) &&
        review.production.promptId === brief.promptId,
      'Missing matching production method and prompt receipt.',
    );
    await pinnedFile(baseDirectory, review.production.rightsEvidence, 4 * 1024 * 1024);
    await pinnedFile(baseDirectory, review.production.sessionEvidence, 4 * 1024 * 1024);
    const master = await pinnedFile(baseDirectory, accepted.master, 128 * 1024 * 1024);
    const masterFormat = inspectOriginalMaster(master);
    const body = await pinnedFile(baseDirectory, accepted.mp3, 32 * 1024 * 1024);
    const asset = await inspectMP3(new Blob([body], { type: 'audio/mpeg' }));
    required(
      Math.abs(asset.durationSeconds - masterFormat.durationSeconds) < 0.15 &&
        Math.abs(asset.durationSeconds - measurements.durationSeconds) < 0.15,
      'Master, MP3 and full-decode measurement duration differ.',
    );
    const name = `optional/soundtracks/originals/${production.edition}/${brief.id.slice(9)}.mp3`;
    const id = `builtin.catalog.${brief.id}`;
    const policy = resolveSoundtrackPolicy(accepted.policy, { id, sha256: asset.sha256 });
    required(
      policy.webPlayback === 'allowed',
      'Ready original needs explicit approved web playback rights.',
    );
    tracks.push({
      format: 'revealline-audio-track.v1',
      id,
      kind: 'mp3',
      title: brief.title,
      artist: accepted.artist,
      asset,
      rights: accepted.rights,
      edition: production.edition,
      path: name,
      fileName: path.basename(accepted.mp3.path),
      websites: [{ label: 'Original production source', url: accepted.rights.source }],
      policy,
      tags: {
        genres: brief.genres,
        role: brief.role === 'finale' ? 'intense' : brief.role,
        energy: brief.energy,
        themes: brief.genres.map(
          (genre) => ({ synth90s: 'retro', metal: 'fpv', ukrainian: 'ukraine' })[genre],
        ),
      },
    });
    files.push({ name, bytes: body });
    receipts.push({ id: brief.id, review: accepted.review, masterFormat });
  }
  const catalogue = resolveSoundtrackCatalogue({
    format: SOUNDTRACK_CATALOGUE_FORMAT_V2,
    edition: production.edition,
    tracks,
  });
  return { catalogue, files, receipts };
}

export async function buildOriginalSoundtrackCatalogue() {
  return compileReadyOriginals(
    await readFile(path.join(folder, 'production.json'), 'utf8'),
    await readFile(path.join(folder, 'ready.json'), 'utf8'),
  );
}

export async function writeOriginalSoundtrackCatalogue(output) {
  const target = path.resolve(output),
    cache = path.join(root, '.cache');
  required(
    target.startsWith(cache + path.sep),
    'Original output must be a fresh directory beneath .cache.',
  );
  let current = root;
  for (const part of path.relative(root, path.dirname(target)).split(path.sep)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    required(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Output ancestors must be ordinary directories.',
    );
  }
  const result = await buildOriginalSoundtrackCatalogue();
  await mkdir(target); // Refuse any existing destination, including symlinks.
  await writeFile(
    path.join(target, 'soundtrack-catalogue.json'),
    JSON.stringify(result.catalogue, null, 2) + '\n',
    { flag: 'wx' },
  );
  for (const file of result.files) {
    const destination = path.join(target, file.name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes, { flag: 'wx' });
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  required(
    process.argv.length === 4 && process.argv[2] === '--output',
    'Usage: node build.mjs --output .cache/NEW_OUTPUT',
  );
  const result = await writeOriginalSoundtrackCatalogue(process.argv[3]);
  console.log(
    JSON.stringify(
      {
        edition: result.catalogue.edition,
        readyRecordings: result.catalogue.tracks.length,
        plannedCompositions: 36,
        bytes: result.files.reduce((sum, file) => sum + file.bytes.length, 0),
      },
      null,
      2,
    ),
  );
}
