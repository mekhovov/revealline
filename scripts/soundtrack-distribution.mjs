import { readFile, lstat, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { exactKeys, required, canonicalJSON } from '../game/data-json.mjs';
import { applySoundtrackArchiveAdmissions } from './soundtrack-archive-admissions.mjs';

export function validateSoundtrackDistributionConfig(value) {
  exactKeys(value, ['format', 'catalog', 'originalCatalogue'], 'Soundtrack distribution config');
  required(
    ['revealline-soundtrack-distribution.v1', 'revealline-soundtrack-distribution.v2'].includes(
      value.format,
    ) && value.catalog === 'game/content/optional-soundtracks.json',
    'Unsupported soundtrack album distribution opt-in.',
  );
  required(
    value.originalCatalogue === undefined ||
      value.originalCatalogue === 'game/content/soundtrack-catalogue.json',
    'Unsupported original soundtrack catalogue.',
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
  if (option.format === 'revealline-soundtrack-distribution.v2')
    return readPublishedSoundtrackEntries(root, option);
  const raw = await readFile(await ordinary(root, option.catalog));
  required(raw.length <= 512 * 1024, 'Soundtrack catalog exceeds 512 KiB.');
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
  const entries = built.bundles.map(({ name, bytes }) => {
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
  if (option.originalCatalogue) {
    const rawOriginals = await readFile(await ordinary(root, option.originalCatalogue));
    required(rawOriginals.length <= 512 * 1024, 'Original catalogue exceeds 512 KiB.');
    await ordinary(root, 'authoring/library/revealline-original-soundtrack');
    const { buildOriginalSoundtrackCatalogue } = await import(
      pathToFileURL(path.join(root, 'authoring/library/revealline-original-soundtrack/build.mjs'))
    );
    const originals = await buildOriginalSoundtrackCatalogue();
    required(
      canonicalJSON(JSON.parse(rawOriginals.toString('utf8'))) ===
        canonicalJSON(originals.catalogue),
      'Approved original catalogue differs from the selected source.',
    );
    required(
      originals.files.length === originals.catalogue.tracks.length,
      'Original recording inventory differs.',
    );
    for (const { name, bytes } of originals.files) {
      const track = originals.catalogue.tracks.find((item) => item.path === name);
      required(
        track &&
          name.startsWith('optional/soundtracks/') &&
          !seen.has(name) &&
          Buffer.isBuffer(bytes) &&
          bytes.length === track.asset.bytes &&
          createHash('sha256').update(bytes).digest('hex') === track.asset.sha256,
        'Original recording differs from its approved catalogue.',
      );
      seen.add(name);
      entries.push({ name, bytes: Buffer.from(bytes) });
    }
  }
  return entries;
}

/** Publication is explicit. Production candidates and restricted originals never
 * become public simply because they exist in the source tree. */
export async function compilePublishedSoundtracks(root, { delivery = 'runtime' } = {}) {
  required(['runtime', 'source'].includes(delivery), 'Unsupported soundtrack delivery target.');
  const load = async (relative) =>
    JSON.parse(await readFile(await ordinary(root, relative), 'utf8'));
  const manifest = await load('authoring/library/licensed-audio/publication.json');
  exactKeys(manifest, ['format', 'approved'], 'licensed publication approvals');
  required(
    manifest.format === 'revealline-licensed-publication.v1' &&
      Array.isArray(manifest.approved) &&
      manifest.approved.length <= 256,
    'Invalid licensed publication approvals.',
  );
  const register = await load('authoring/library/licensed-audio/production-register.json');
  const { resolveSoundtrackCatalogue, soundtrackRights } = await import(
    pathToFileURL(path.join(root, 'game/soundtrack.mjs'))
  );
  const { buildOriginalSoundtrackCatalogue } = await import(
    pathToFileURL(path.join(root, 'authoring/library/revealline-original-soundtrack/build.mjs'))
  );
  const originals = await buildOriginalSoundtrackCatalogue();
  const tracks = [...originals.catalogue.tracks],
    files = [...originals.files];
  // Optional in older authoring checkouts; this edition keeps an empty approval
  // register until the supplied recordings and artwork have been cleared.
  let uaCompiler;
  try {
    uaCompiler = await ordinary(root, 'authoring/library/ua-fpv/build.mjs');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (uaCompiler) {
    const { compileUAFPVSoundtracks } = await import(pathToFileURL(uaCompiler));
    const ua = await compileUAFPVSoundtracks({
      baseDirectory: path.join(root, 'authoring/library/ua-fpv'),
      edition: originals.catalogue.edition,
    });
    tracks.push(...ua.tracks);
    files.push(...ua.files);
  }
  const seen = new Set();
  for (const approval of manifest.approved) {
    exactKeys(
      approval,
      [
        'id',
        'sha256',
        'reviewedBy',
        'reviewEvidence',
        'fullTrack',
        'repeatedSession',
        'inGameTransition',
      ],
      'licensed listening approval',
    );
    required(
      !seen.has(approval.id) &&
        approval.fullTrack === true &&
        approval.repeatedSession === true &&
        approval.inGameTransition === true &&
        typeof approval.reviewedBy === 'string' &&
        approval.reviewedBy.trim().length > 0 &&
        typeof approval.reviewEvidence === 'string' &&
        approval.reviewEvidence.startsWith('reviews/') &&
        !approval.reviewEvidence.includes('..'),
      'Licensed recordings require complete listening evidence.',
    );
    seen.add(approval.id);
    const source = register.tracks.find((track) => track.id === approval.id);
    required(
      source &&
        source.asset.sha256 === approval.sha256 &&
        source.policy.webPlayback === 'allowed' &&
        source.policy.redistribute === 'allowed',
      'Only exact approved redistributable recordings may enter this public distribution.',
    );
    const evidence = await readFile(
      await ordinary(root, `authoring/library/licensed-audio/${approval.reviewEvidence}`),
    );
    required(
      evidence.length > 0 && evidence.length <= 64 * 1024,
      'Listening evidence is missing or oversized.',
    );
    const body = await readFile(
      await ordinary(root, `authoring/library/licensed-audio/${source.runtime.path}`),
    );
    required(
      body.length === source.asset.bytes &&
        createHash('sha256').update(body).digest('hex') === source.asset.sha256,
      'Published licensed recording differs from reviewed bytes.',
    );
    const id = `builtin.catalog.${source.id}`,
      name = `optional/soundtracks/${source.asset.sha256}.mp3`;
    tracks.push({
      format: 'revealline-audio-track.v1',
      id,
      kind: 'mp3',
      title: source.title,
      artist: source.artist,
      asset: source.asset,
      rights: {
        kind: 'licensed',
        credit: source.credit,
        license: source.license,
        source: source.source,
      },
      edition: originals.catalogue.edition,
      path: name,
      tags: source.tags,
      policy: { ...source.policy, id },
      fileName: path.basename(source.runtime.path),
      websites: source.websites,
    });
    files.push({ name, bytes: body });
  }
  const catalogue = resolveSoundtrackCatalogue({ ...originals.catalogue, tracks });
  required(
    catalogue.tracks.every((track) => {
      const rights = soundtrackRights(track, { catalogue });
      return rights.webPlayback === 'allowed' && rights.redistribute === 'allowed';
    }),
    'Public soundtrack delivery cannot override a restrictive recording hash alias.',
  );
  const built = {
    catalogue,
    files,
    albums: { format: 'revealline-soundtrack-albums.v1', albums: [] },
    archives: [],
  };
  return delivery === 'source' ? built : applySoundtrackArchiveAdmissions(root, built);
}
export function soundtrackCatalogueModule(catalogue, archives = []) {
  return `// Generated from reviewed soundtrack publication metadata.\nexport const SOUNDTRACK_CATALOGUE = ${JSON.stringify(catalogue, null, 2)};\nexport const SOUNDTRACK_ARCHIVES = ${JSON.stringify(archives)};\n`;
}
export async function writePublishedSoundtrackMetadata(root) {
  const { format, resolveConfig } = await import('prettier');
  const built = await compilePublishedSoundtracks(root);
  const modulePath = path.join(root, 'game/content/soundtrack-catalogue.mjs');
  const moduleSource = await format(soundtrackCatalogueModule(built.catalogue, built.archives), {
    ...(await resolveConfig(modulePath)),
    filepath: modulePath,
  });
  await writeFile(
    path.join(root, 'game/content/soundtrack-catalogue.json'),
    JSON.stringify(built.catalogue, null, 2) + '\n',
  );
  await writeFile(
    path.join(root, 'game/content/optional-soundtracks.json'),
    JSON.stringify(built.albums, null, 2) + '\n',
  );
  await writeFile(modulePath, moduleSource);
  return built;
}
async function readPublishedSoundtrackEntries(root, option) {
  required(option.originalCatalogue, 'Reviewed publication requires a soundtrack catalogue.');
  const built = await compilePublishedSoundtracks(root);
  for (const [relative, expected] of [
    [option.catalog, built.albums],
    [option.originalCatalogue, built.catalogue],
  ]) {
    const raw = await readFile(await ordinary(root, relative));
    required(
      raw.length <= 512 * 1024 && canonicalJSON(JSON.parse(raw)) === canonicalJSON(expected),
      'Published soundtrack metadata differs from reviewed production.',
    );
  }
  const runtime = await import(
    pathToFileURL(await ordinary(root, 'game/content/soundtrack-catalogue.mjs'))
  );
  required(
    canonicalJSON(runtime.SOUNDTRACK_CATALOGUE) === canonicalJSON(built.catalogue) &&
      canonicalJSON(runtime.SOUNDTRACK_ARCHIVES) === canonicalJSON(built.archives),
    'Code-owned soundtrack catalogue differs from reviewed production.',
  );
  return built.files.map(({ name, bytes }) => ({ name, bytes: Buffer.from(bytes) }));
}
