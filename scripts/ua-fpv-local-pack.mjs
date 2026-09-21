import { createHash } from 'node:crypto';
import fs, { lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { inspectMP3 } from '../game/mp3.mjs';
import {
  AUDIO_TRACK_FORMAT,
  SOUNDTRACK_LIMITS,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
} from '../game/soundtrack.mjs';
import {
  SOUNDTRACK_BUNDLE_FORMAT_V3,
  exportSoundtrackBundle,
  importSoundtrackBundle,
} from '../game/soundtrack-bundle.mjs';
import { mergeSoundtrackShare } from '../game/soundtrack-share.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const compareNames = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));
const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return (
    relative === '' ||
    (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
  );
};
async function prospectiveRealPath(directory) {
  let parent = path.resolve(directory);
  const tail = [];
  for (;;) {
    try {
      return path.join(await realpath(parent), ...tail.reverse());
    } catch (error) {
      if (error.code !== 'ENOENT' || path.dirname(parent) === parent) throw error;
      tail.push(path.basename(parent));
      parent = path.dirname(parent);
    }
  }
}
export const UA_FPV_LOCAL_DISK_RESERVE_BYTES = 1024 ** 3;
const OUTPUT_OVERHEAD_BYTES = 1024 ** 2;
export function assertUAFPVLocalPackDiskBudget({ freeBytes, outputBytes }) {
  required(
    typeof freeBytes === 'bigint' &&
      typeof outputBytes === 'bigint' &&
      outputBytes > 0n &&
      freeBytes >= outputBytes + BigInt(UA_FPV_LOCAL_DISK_RESERVE_BYTES),
    'Local pack output must leave at least 1 GiB free after every volume and its index.',
  );
}
async function checkDiskBudget(directory, fileBytes) {
  let parent = directory,
    stat;
  for (;;) {
    try {
      stat = await fs.statfs(parent, { bigint: true });
      break;
    } catch (error) {
      if (error.code !== 'ENOENT' || path.dirname(parent) === parent) throw error;
      parent = path.dirname(parent);
    }
  }
  required(stat.bsize > 0n, 'Cannot determine the local output filesystem block size.');
  const outputBytes = fileBytes.reduce(
    (total, bytes) => total + ((BigInt(bytes) + stat.bsize - 1n) / stat.bsize) * stat.bsize,
    BigInt(OUTPUT_OVERHEAD_BYTES),
  );
  assertUAFPVLocalPackDiskBudget({ freeBytes: stat.bavail * stat.bsize, outputBytes });
}
// This checks the binary importer, not native decoding or musical quality.
const structuralProbe = async (blob) => ({
  durationSeconds: (await inspectMP3(blob)).durationSeconds,
});

function volumeLibrary(groups, number) {
  const tracks = groups.flatMap((group) => group.tracks);
  return resolveSoundtrackLibrary({
    ...emptySoundtrackLibrary({ catalogue: true }),
    tracks,
    tags: Object.fromEntries(
      tracks.map((track) => [
        track.id,
        {
          genres: ['ukrainian'],
          role: 'any',
          energy: 3,
          themes: ['fpv'],
        },
      ]),
    ),
    playlists: [
      {
        id: `ua.local.volume.${hash(canonicalJSON(tracks.map((track) => track.id))).slice(0, 24)}`,
        title: `UA-FPV · Local volume ${String(number).padStart(2, '0')}`,
        trackIds: groups.map((group) => group.tracks[0].id),
        order: 'shuffle',
        repeat: 'all',
      },
    ],
  });
}
function encodedSize(groups, number) {
  const library = volumeLibrary(groups, number);
  const assets = groups
    .map(({ asset }) => ({ sha256: asset.sha256, bytes: asset.bytes }))
    .sort((a, b) => a.sha256.localeCompare(b.sha256));
  return (
    12 +
    Buffer.byteLength(
      canonicalJSON({
        format: SOUNDTRACK_BUNDLE_FORMAT_V3,
        library,
        assets,
        referenceOnlyTrackIds: [],
      }),
    ) +
    assets.reduce((sum, asset) => sum + asset.bytes, 0)
  );
}

/** Private personal-import packs only. No catalogue admission, license grant, or source mutation. */
export async function buildUAFPVLocalPacks({
  sourceDirectory,
  outputDirectory,
  volumeBytes = SOUNDTRACK_LIMITS.optionalBundleTargetBytes,
} = {}) {
  required(
    typeof sourceDirectory === 'string' && typeof outputDirectory === 'string',
    'Explicit source and output directories are required.',
  );
  required(
    Number.isSafeInteger(volumeBytes) &&
      volumeBytes > 0 &&
      volumeBytes <= SOUNDTRACK_LIMITS.optionalBundleTargetBytes,
    'Each local volume must fit the 64 MiB optional album target.',
  );
  const source = await realpath(sourceDirectory);
  required((await lstat(source)).isDirectory(), 'The source must be a directory.');
  const output = await prospectiveRealPath(outputDirectory);
  required(!inside(source, output), 'Output must be outside the source directory.');
  const names = (await readdir(source)).filter((name) => /\.mp3$/i.test(name)).sort(compareNames);
  required(
    names.length > 0 && names.length <= SOUNDTRACK_LIMITS.customTracks,
    'The collection must contain between 1 and 123 MP3 filenames.',
  );
  const groups = new Map();
  let sourceBytes = 0,
    uniqueBytes = 0;
  for (const fileName of names) {
    required(
      fileName.length <= 255 && !/[\\/\x00-\x1f]/.test(fileName),
      'Unsupported original filename.',
    );
    const file = path.join(source, fileName),
      stat = await lstat(file);
    required(
      stat.isFile() &&
        !stat.isSymbolicLink() &&
        stat.size > 0 &&
        stat.size <= SOUNDTRACK_LIMITS.trackBytes,
      'MP3 sources must be ordinary files no larger than 32 MiB.',
    );
    sourceBytes += stat.size;
    required(
      sourceBytes <= 2 * SOUNDTRACK_LIMITS.managedBytes,
      'Source reads exceed the bounded local collection budget.',
    );
    const bytes = await readFile(file);
    required(bytes.length === stat.size, 'A source file changed while reading.');
    const blob = new Blob([bytes], { type: 'audio/mpeg' }),
      asset = await inspectMP3(blob);
    const track = {
      format: AUDIO_TRACK_FORMAT,
      id: `ua.local.${hash(Buffer.from(fileName)).slice(0, 32)}`,
      kind: 'mp3',
      title:
        fileName
          .replace(/\.mp3$/i, '')
          .trim()
          .slice(0, 120) || fileName,
      artist: '',
      fileName,
      asset,
      rights: {
        kind: 'personal',
        credit: 'User-supplied local file. Artist and permission are unverified.',
        license: '',
        source: '',
      },
    };
    if (!groups.has(asset.sha256)) {
      uniqueBytes += asset.bytes;
      required(
        uniqueBytes <= SOUNDTRACK_LIMITS.managedBytes,
        'Unique audio exceeds the shared 256 MiB storage limit.',
      );
      groups.set(asset.sha256, { asset, blob, tracks: [] });
    }
    groups.get(asset.sha256).tracks.push(track);
  }
  const volumes = [];
  for (const group of groups.values()) {
    let current = volumes.at(-1);
    if (!current || encodedSize([...current, group], volumes.length) > volumeBytes) {
      required(
        encodedSize([group], volumes.length + 1) <= volumeBytes,
        'A recording and all of its filename aliases cannot fit one volume.',
      );
      current = [];
      volumes.push(current);
    }
    current.push(group);
  }
  required(
    volumes.length <= SOUNDTRACK_LIMITS.customPlaylists,
    'Local volumes exceed the 26 custom playlist limit.',
  );
  // Resolve all tracks together before writing so count/metadata/identity limits cannot fail halfway through output.
  resolveSoundtrackLibrary({
    ...emptySoundtrackLibrary({ catalogue: true }),
    tracks: [...groups.values()].flatMap((group) => group.tracks),
    playlists: volumes.map((volume, index) => volumeLibrary(volume, index + 1).playlists[0]),
    tags: Object.assign(
      {},
      ...volumes.map((volume, index) => volumeLibrary(volume, index + 1).tags),
    ),
  });
  const report = {
    format: 'revealline-ua-fpv-local-packs.v1',
    purpose:
      'Private personal imports only; no public redistribution, rights approval, native decoding, or listening approval is asserted.',
    verification:
      'Current binary v3 exporter/importer and additive merge; explicit structural media probe only.',
    sourceFiles: names.length,
    uniqueRecordings: groups.size,
    sourceBytes,
    uniqueBytes,
    remainingUploadSlotsFromEmptyLibrary: SOUNDTRACK_LIMITS.customTracks - names.length,
    remainingPlaylistSlotsFromEmptyLibrary: SOUNDTRACK_LIMITS.customPlaylists - volumes.length,
    remainingSharedBytesBeforeOtherMedia: SOUNDTRACK_LIMITS.managedBytes - uniqueBytes,
    volumes: [],
    files: [],
  };
  for (const [index, volume] of volumes.entries()) {
    const library = volumeLibrary(volume, index + 1);
    const name = `ua-fpv-local-${String(index + 1).padStart(2, '0')}.rlsound`;
    report.volumes.push({
      file: name,
      bytes: encodedSize(volume, index + 1),
      sha256: '0'.repeat(64),
      tracks: library.tracks.length,
      uniqueRecordings: volume.length,
      playlistId: library.playlists[0].id,
      playlistTitle: library.playlists[0].title,
    });
    for (const group of volume) {
      for (const [alias, track] of group.tracks.entries()) {
        report.files.push({
          fileName: track.fileName,
          id: track.id,
          sha256: track.asset.sha256,
          bytes: track.asset.bytes,
          durationSeconds: track.asset.durationSeconds,
          volume: name,
          queued: alias === 0,
          canonicalTrackId: group.tracks[0].id,
          filenameAliases: group.tracks.map((item) => item.fileName),
        });
      }
    }
  }
  // Hash placeholders have the same encoded length as the final digest, so this
  // includes every bundle and the exact index size before any output is created.
  const indexBytes = Buffer.byteLength(json(report));
  const pendingBytes = [...report.volumes.map((volume) => volume.bytes), indexBytes];
  await checkDiskBudget(output, pendingBytes);
  await mkdir(output, { recursive: true });
  const destination = await realpath(output);
  required(!inside(source, destination), 'Output must not resolve inside the source directory.');
  required(
    (await readdir(destination)).length === 0,
    'Use an empty output directory; existing files are never overwritten.',
  );
  let merged = { library: emptySoundtrackLibrary({ catalogue: true }), assets: [] };
  for (const [index, volume] of volumes.entries()) {
    const library = volumeLibrary(volume, index + 1);
    const assets = volume.map(({ asset, blob }) => ({ sha256: asset.sha256, blob }));
    const bundle = await exportSoundtrackBundle(library, assets);
    required(
      bundle.size === report.volumes[index].bytes && bundle.size <= volumeBytes,
      'Encoded volume differs from its bounded size plan.',
    );
    const imported = await importSoundtrackBundle(bundle, { probeMedia: structuralProbe });
    merged = mergeSoundtrackShare(merged.library, merged.assets, imported);
    const body = Buffer.from(await bundle.arrayBuffer());
    report.volumes[index].sha256 = hash(body);
    await checkDiskBudget(destination, pendingBytes.slice(index));
    await writeFile(path.join(destination, report.volumes[index].file), body, { flag: 'wx' });
  }
  required(
    merged.library.tracks.length === names.length && merged.assets.length === groups.size,
    'The additive import did not preserve every filename and recording.',
  );
  required(
    Buffer.byteLength(json(report)) === indexBytes,
    'Local index differs from its disk budget.',
  );
  await checkDiskBudget(destination, [indexBytes]);
  await writeFile(path.join(destination, 'ua-fpv-local-index.json'), json(report), { flag: 'wx' });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    required(
      ['--source-dir', '--output-dir'].includes(key) &&
        args[index + 1] &&
        !Object.hasOwn(options, key),
      'Usage: node scripts/ua-fpv-local-pack.mjs --source-dir <originals> --output-dir <new-empty-private-directory>',
    );
    options[key] = args[index + 1];
  }
  const report = await buildUAFPVLocalPacks({
    sourceDirectory: options['--source-dir'],
    outputDirectory: options['--output-dir'],
  });
  console.log(
    json({
      ...report,
      files: `${report.files.length} filename mappings in ua-fpv-local-index.json`,
    }),
  );
}
