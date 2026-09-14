import { readFile, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { exactKeys, required, canonicalJSON } from '../game/data-json.mjs';

export function validateSoundtrackDistributionConfig(value) {
  exactKeys(value, ['format', 'catalog'], 'Soundtrack distribution config');
  required(
    value.format === 'revealline-soundtrack-distribution.v1' &&
      value.catalog === 'game/content/optional-soundtracks.json',
    'Unsupported soundtrack album distribution opt-in.',
  );
  return value;
}
async function ordinary(root, relative) {
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(
      !(await lstat(target)).isSymbolicLink(),
      'Soundtrack distribution cannot use symbolic links.',
    );
  }
  const stat = await lstat(target);
  if (stat.isDirectory())
    for (const name of await readdir(target)) await ordinary(root, `${relative}/${name}`);
  else required(stat.isFile(), 'Soundtrack distribution requires ordinary source files.');
  return target;
}
/** Optional binaries join the full distribution only; never pack JSON or core precache. */
export async function readSoundtrackDistributionEntries(root, option) {
  if (option === undefined) return [];
  validateSoundtrackDistributionConfig(option);
  const raw = await readFile(await ordinary(root, option.catalog));
  required(raw.length <= 64 * 1024, 'Soundtrack catalog exceeds 64 KiB.');
  await ordinary(root, 'authoring/library/licensed-audio');
  await ordinary(root, 'game/soundtrack-albums.mjs');
  const { resolveSoundtrackAlbumCatalog } = await import(
    pathToFileURL(path.join(root, 'game/soundtrack-albums.mjs'))
  );
  const { buildSoundtrackAlbums } = await import(
    pathToFileURL(path.join(root, 'authoring/library/licensed-audio/build.mjs'))
  );
  const catalog = resolveSoundtrackAlbumCatalog(raw.toString('utf8')),
    built = await buildSoundtrackAlbums();
  required(
    canonicalJSON(catalog) === canonicalJSON(built.catalog),
    'Compiled soundtrack catalog differs from the selected source.',
  );
  required(
    built.bundles.length === catalog.albums.length,
    'Compiled soundtrack body count differs.',
  );
  const seen = new Set();
  return built.bundles.map(({ name, bytes }) => {
    const album = catalog.albums.find((item) => item.path === name);
    required(
      album &&
        !seen.has(name) &&
        Buffer.isBuffer(bytes) &&
        bytes.length === album.bytes &&
        createHash('sha256').update(bytes).digest('hex') === album.sha256,
      'Compiled soundtrack body differs from its catalog.',
    );
    seen.add(name);
    return { name, bytes: Buffer.from(bytes) };
  });
}
