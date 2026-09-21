import { readFile, lstat, mkdir, writeFile, statfs } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { boundedJSON, canonicalJSON, required, stableId } from '../../../game/data-json.mjs';
import { inspectMP3 } from '../../../game/mp3.mjs';
import { emptySoundtrackLibrary } from '../../../game/soundtrack.mjs';
import { exportSoundtrackBundle } from '../../../game/soundtrack-bundle.mjs';
import {
  resolveSoundtrackAlbumCatalog,
  SOUNDTRACK_ALBUM_CATALOG_FORMAT,
} from '../../../game/soundtrack-albums.mjs';

const folder = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(folder, '../../..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function ordinary(relative) {
  required(
    typeof relative === 'string' &&
      relative.length < 400 &&
      !path.isAbsolute(relative) &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Invalid audio source path.',
  );
  let target = folder;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(!(await lstat(target)).isSymbolicLink(), 'Audio source links are not accepted.');
  }
  const stat = await lstat(target);
  required(
    stat.isFile() && stat.size <= 32 * 1024 * 1024,
    'Audio source must be a bounded ordinary file.',
  );
  return target;
}
async function original(pin) {
  required(
    pin && Number.isSafeInteger(pin.bytes) && /^[a-f0-9]{64}$/.test(pin.sha256),
    'Invalid audio original pin.',
  );
  const bytes = await readFile(await ordinary(pin.path));
  required(
    bytes.length === pin.bytes && hash(bytes) === pin.sha256,
    `Audio original differs: ${pin.path}`,
  );
  return bytes;
}
/** Explicit source compiler. No network, decoding to PCM, encoding or storage access. */
export async function buildSoundtrackAlbums() {
  const source = boundedJSON(await readFile(await ordinary('sources.json'), 'utf8'), {
    maxBytes: 512 * 1024,
    maxDepth: 12,
    maxNodes: 30000,
    maxArray: 256,
    maxString: 1024,
  });
  const derivativeEvidence = boundedJSON(
    await readFile(await ordinary('provenance/derivatives.json'), 'utf8'),
  );
  const additionalDerivatives = boundedJSON(
    await readFile(await ordinary('provenance/additional-derivatives.json'), 'utf8'),
  );
  let expansionDerivatives;
  try {
    expansionDerivatives = boundedJSON(
      await readFile(await ordinary('provenance/expansion-derivatives.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (expansionDerivatives)
    required(
      canonicalJSON(expansionDerivatives.encoder) === canonicalJSON(additionalDerivatives.encoder),
      'Expansion encoder provenance differs from its retained settings.',
    );
  const licenseEvidence = boundedJSON(
    await readFile(await ordinary('provenance/license-revalidation.json'), 'utf8'),
  );
  const declaredDerivatives = [
    ...derivativeEvidence.tracks,
    ...additionalDerivatives.tracks,
    ...(expansionDerivatives?.tracks ?? []),
  ];
  required(
    canonicalJSON(source.encoder) === canonicalJSON(derivativeEvidence.encoder),
    'Encoder provenance differs from its retained receipt.',
  );
  required(
    source.format === 'revealline-licensed-audio-source.v1' &&
      source.tracks.length > 0 &&
      source.tracks.length <= 256 &&
      new Set(source.tracks.map((t) => t.id)).size === source.tracks.length &&
      source.tracks.every((t) => stableId(t.id) && !t.id.startsWith('builtin.')) &&
      source.albums.length > 0 &&
      source.albums.length <= 32 &&
      new Set(source.albums.map((a) => a.id)).size === source.albums.length &&
      source.albums.every((a) => stableId(a.id) && !a.id.startsWith('builtin.')),
    'Expected a bounded source collection with unique track and album IDs.',
  );
  const verified = new Map(),
    bodies = new Map();
  for (const track of source.tracks) {
    const licenseURL =
      track.license === 'CC0 1.0 Universal'
        ? 'https://creativecommons.org/publicdomain/zero/1.0/'
        : track.license === 'CC BY 3.0 Unported'
          ? 'https://creativecommons.org/licenses/by/3.0/'
          : track.license === 'CC BY 4.0 International'
            ? 'https://creativecommons.org/licenses/by/4.0/'
            : null;
    required(
      licenseURL &&
        licenseEvidence.sources.some(
          (item) =>
            item.source === track.source &&
            item.selectedLicenseURL === licenseURL &&
            item.status === 'primary creator submission license declaration verified',
        ),
      'Audio requires a matching reviewed open recording license.',
    );
    const sourceBytes = await original(track.original);
    const same = track.original.path === track.runtime.path;
    required(
      same
        ? track.original.path.endsWith('.mp3') && track.derivative === null
        : track.original.path.endsWith('.ogg') &&
            track.runtime.path.endsWith('.mp3') &&
            track.derivative?.sourceSha256 === track.original.sha256 &&
            track.derivative?.sourceBytes === track.original.bytes &&
            track.derivative?.sha256 === track.runtime.sha256 &&
            track.derivative?.bytes === track.runtime.bytes,
      'Runtime audio must be the exact MP3 original or its declared OGG derivative.',
    );
    if (!same)
      required(
        track.runtime.path === `derivatives/${track.derivative.name}` &&
          track.original.path.endsWith(`/${track.derivative.sourceName}`) &&
          declaredDerivatives.some(
            (item) => canonicalJSON(item) === canonicalJSON(track.derivative),
          ),
        'Derivative path or retained provenance differs.',
      );
    const bytes = same ? sourceBytes : await original(track.runtime),
      blob = new Blob([bytes], { type: 'audio/mpeg' });
    const asset = await inspectMP3(blob);
    required(
      asset.sha256 === track.runtime.sha256 && asset.bytes === track.runtime.bytes,
      'MP3 frame inspection differs from runtime pin.',
    );
    verified.set(track.id, {
      format: 'revealline-audio-track.v1',
      id: track.id,
      title: track.title,
      artist: track.artist,
      kind: 'mp3',
      asset,
      rights: {
        kind: 'licensed',
        credit: track.credit,
        license: track.license,
        source: track.source,
      },
      ...(track.fileName ? { fileName: track.fileName } : {}),
    });
    bodies.set(track.id, { sha256: asset.sha256, blob });
  }
  const albums = [],
    bundles = [];
  const assigned = new Set();
  for (const album of source.albums) {
    required(
      Array.isArray(album.trackIds) &&
        album.trackIds.length > 0 &&
        album.trackIds.length <= 128 &&
        new Set(album.trackIds).size === album.trackIds.length &&
        album.trackIds.every(
          (id) =>
            !assigned.has(id) && source.tracks.some((t) => t.id === id && t.albumId === album.id),
        ),
      'Album track ownership differs from the source register.',
    );
    album.trackIds.forEach((id) => assigned.add(id));
    const library = {
      ...emptySoundtrackLibrary({ catalogue: true }),
      tracks: album.trackIds.map((id) => verified.get(id)),
      tags: Object.fromEntries(
        source.tracks
          .filter((track) => album.trackIds.includes(track.id) && track.tags)
          .map((track) => [track.id, track.tags]),
      ),
      playlists: [
        {
          id: album.id,
          title: album.title,
          trackIds: album.trackIds,
          order: 'shuffle',
          repeat: 'all',
        },
      ],
      selection: { playlistId: album.id },
    };
    const bundle = await exportSoundtrackBundle(
      library,
      album.trackIds.map((id) => bodies.get(id)),
    );
    required(bundle.size <= 64 * 1024 * 1024, 'Optional audio album exceeds 64 MiB.');
    const bytes = Buffer.from(await bundle.arrayBuffer()),
      name = `optional/soundtracks/${album.id}.rlsound`;
    const { trackIds, ...description } = album;
    albums.push({ ...description, path: name, bytes: bytes.length, sha256: hash(bytes), library });
    bundles.push({ name, bytes });
  }
  required(assigned.size === source.tracks.length, 'Source track has no album.');
  const catalog = resolveSoundtrackAlbumCatalog({
    format: SOUNDTRACK_ALBUM_CATALOG_FORMAT,
    albums,
  });
  return { catalog, bundles };
}
export async function writeSoundtrackAlbums(output) {
  const target = path.resolve(output),
    cache = path.join(root, '.cache');
  required(
    target.startsWith(cache + path.sep),
    'Album output must be a fresh source cache directory.',
  );
  let current = root;
  for (const part of path.relative(root, path.dirname(target)).split(path.sep)) {
    current = path.join(current, part);
    const stat = await lstat(current);
    required(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Album output ancestors must be ordinary directories.',
    );
  }
  let existing;
  try {
    existing = await lstat(target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  required(!existing, 'Album output already exists; choose a fresh directory.');
  const result = await buildSoundtrackAlbums();
  const catalogBytes = Buffer.from(JSON.stringify(result.catalog, null, 2) + '\n');
  let remaining =
    catalogBytes.length + result.bundles.reduce((sum, entry) => sum + entry.bytes.length, 0);
  const checkReserve = async () => {
    const disk = await statfs(path.dirname(target));
    required(
      disk.bavail * disk.bsize >= 1024 ** 3 + remaining + 1024 ** 2,
      'Album export must leave at least 1 GiB of free disk space.',
    );
  };
  await checkReserve();
  await mkdir(target);
  await writeFile(path.join(target, 'catalog.json'), catalogBytes, { flag: 'wx' });
  remaining -= catalogBytes.length;
  for (const entry of result.bundles) {
    await checkReserve();
    const file = path.join(target, entry.name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, entry.bytes, { flag: 'wx' });
    remaining -= entry.bytes.length;
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  required(
    process.argv.length === 4 && process.argv[2] === '--output',
    'Usage: node build.mjs --output .cache/NEW_OUTPUT',
  );
  const result = await writeSoundtrackAlbums(process.argv[3]);
  console.log(
    JSON.stringify(
      result.catalog.albums.map(({ id, bytes, sha256 }) => ({ id, bytes, sha256 })),
      null,
      2,
    ),
  );
}
