import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { check, resolveConfig } from 'prettier';
import { buildProject, readTarEntries } from './game-cli.mjs';
import {
  readSoundtrackDistributionEntries,
  validateSoundtrackDistributionConfig,
  writePublishedSoundtrackMetadata,
} from './soundtrack-distribution.mjs';
import { albumFixture, albumCatalog } from '../game/test/helpers/soundtrack-albums.mjs';
import { importSoundtrackBundle } from '../game/soundtrack-bundle.mjs';
import {
  fixture as audioFixture,
  structuralProbe,
} from '../game/test/helpers/soundtrack-fixtures.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const option = {
  format: 'revealline-soundtrack-distribution.v1',
  catalog: 'game/content/optional-soundtracks.json',
};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const licensedFolder = 'authoring/library/licensed-audio';
const licenses = [
  ['CC0 1.0 Universal', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['CC BY 3.0 Unported', 'https://creativecommons.org/licenses/by/3.0/'],
  ['CC BY 4.0 International', 'https://creativecommons.org/licenses/by/4.0/'],
];
const licenseStatus = 'primary creator submission license declaration verified';
async function fixture(t) {
  const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'soundtrack-build-')));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'source'),
    out = path.join(dir, 'out'),
    album = await albumFixture();
  const put = async (name, bytes) => {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  };
  await put('game/index.html', '<html><head></head><body>Audio fixture</body></html>');
  await put('game/offline.mjs', 'export const offline = true;');
  await put('game/content/soundtrack-catalogue.mjs', 'export const SOUNDTRACK_COLLECTIONS = [];');
  for (const name of [
    'game/offline/service-worker.template.js',
    'game/soundtrack-albums.mjs',
    'game/soundtrack-bundle.mjs',
    'game/soundtrack-portable.mjs',
    'game/soundtrack.mjs',
    'game/soundtrack-rights.mjs',
    'game/mp3.mjs',
    'game/data-json.mjs',
    'game/ui/music.mjs',
  ])
    await put(name, await readFile(path.join(source, name)));
  await put(option.catalog, JSON.stringify(albumCatalog(album.album)));
  await put(
    'authoring/library/licensed-audio/source.json',
    JSON.stringify({
      catalog: albumCatalog(album.album),
      name: album.album.path,
      body: album.bytes.toString('base64'),
    }),
  );
  await put(
    'authoring/library/licensed-audio/build.mjs',
    `import {readFile} from 'node:fs/promises'; export async function buildSoundtrackAlbums() { const x=JSON.parse(await readFile(new URL('./source.json',import.meta.url))); return {catalog:x.catalog,bundles:[{name:x.name,bytes:Buffer.from(x.body,'base64')}]}; }`,
  );
  const config = { version: 'audio-fixture', entry: 'game/index.html', include: ['game'] };
  const save = () => put('game/build-config.json', JSON.stringify(config));
  await save();
  return { root, out, put, save, config, album };
}
test('publication writer preserves catalogue values and emits reproducible repository-formatted JavaScript', async (t) => {
  const f = await fixture(t);
  const catalogue = {
    format: 'revealline-soundtrack-catalogue.v1',
    edition: 'writer-fixture',
    tracks: [
      {
        ...f.album.track,
        id: 'builtin.catalog.writer-fixture',
        title: "Spring's echo — Весна",
        edition: 'writer-fixture',
        path: 'optional/soundtracks/writer-fixture.mp3',
        tags: { genres: ['ukrainian'], role: 'menu', energy: 2, themes: ['ukraine'] },
      },
    ],
  };
  await f.put('.prettierrc.json', await readFile(path.join(source, '.prettierrc.json')));
  await f.put(
    'authoring/library/licensed-audio/publication.json',
    JSON.stringify({
      format: 'revealline-licensed-publication.v1',
      approved: [],
    }),
  );
  await f.put(
    'authoring/library/licensed-audio/production-register.json',
    JSON.stringify({ tracks: [] }),
  );
  await f.put(
    'authoring/library/revealline-original-soundtrack/build.mjs',
    `export async function buildOriginalSoundtrackCatalogue() { return { catalogue: ${JSON.stringify(catalogue)}, files: [] }; }`,
  );
  const built = await writePublishedSoundtrackMetadata(f.root);
  const modulePath = path.join(f.root, 'game/content/soundtrack-catalogue.mjs');
  const first = await readFile(modulePath, 'utf8');
  assert.equal(
    await check(first, { ...(await resolveConfig(modulePath)), filepath: modulePath }),
    true,
  );
  const runtime = await import(`${pathToFileURL(modulePath).href}?sha256=${sha(first)}`);
  assert.deepEqual(runtime.SOUNDTRACK_CATALOGUE, built.catalogue);
  assert.deepEqual(runtime.SOUNDTRACK_CATALOGUE.tracks[0], catalogue.tracks[0]);
  assert.deepEqual(runtime.SOUNDTRACK_ARCHIVES, built.archives);
  assert.deepEqual(runtime.SOUNDTRACK_COLLECTIONS, built.collections);
  const firstMetadata = await readFile(path.join(f.root, 'game/content/soundtrack-catalogue.json'));
  assert.equal(
    await check(firstMetadata.toString('utf8'), {
      ...(await resolveConfig(modulePath)),
      parser: 'json',
    }),
    true,
  );
  await writePublishedSoundtrackMetadata(f.root);
  assert.equal(await readFile(modulePath, 'utf8'), first);
  assert.deepEqual(
    await readFile(path.join(f.root, 'game/content/soundtrack-catalogue.json')),
    firstMetadata,
  );
});
test('real archived CLI builds reviewed soundtrack metadata without installed formatter dependencies', async (t) => {
  const f = await fixture(t);
  for (const name of [
    'scripts/game-cli.mjs',
    'scripts/pack-indexes.mjs',
    'scripts/soundtrack-distribution.mjs',
    'scripts/soundtrack-archive-admissions.mjs',
    'scripts/hosted-soundtrack-publication.mjs',
    'scripts/reviewed-soundtrack-batches.mjs',
    'game/content-launch.mjs',
    'game/soundtrack-archive.mjs',
    'game/soundtrack-album-download.mjs',
  ])
    await f.put(name, await readFile(path.join(source, name)));
  const catalogue = {
    format: 'revealline-soundtrack-catalogue.v2',
    edition: 'archived-fixture',
    tracks: [],
  };
  f.config.soundtrackAlbums = {
    ...option,
    format: 'revealline-soundtrack-distribution.v2',
    originalCatalogue: 'game/content/soundtrack-catalogue.json',
  };
  await f.save();
  await f.put(
    option.catalog,
    JSON.stringify({ format: 'revealline-soundtrack-albums.v1', albums: [] }),
  );
  await f.put(f.config.soundtrackAlbums.originalCatalogue, JSON.stringify(catalogue));
  await f.put(
    'game/content/soundtrack-catalogue.mjs',
    `export const SOUNDTRACK_CATALOGUE = ${JSON.stringify(catalogue)}; export const SOUNDTRACK_ARCHIVES = []; export const SOUNDTRACK_COLLECTIONS = [];`,
  );
  await f.put(
    `${licensedFolder}/publication.json`,
    JSON.stringify({ format: 'revealline-licensed-publication.v1', approved: [] }),
  );
  await f.put(`${licensedFolder}/production-register.json`, JSON.stringify({ tracks: [] }));
  await f.put(
    'authoring/library/revealline-original-soundtrack/build.mjs',
    `export async function buildOriginalSoundtrackCatalogue() { return { catalogue: ${JSON.stringify(catalogue)}, files: [] }; }`,
  );
  await f.put('.gitignore', 'releases/\n');
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith('GIT_') && !['NODE_PATH', 'NODE_OPTIONS'].includes(key),
    ),
  );
  Object.assign(environment, {
    GIT_CONFIG_GLOBAL: os.devNull,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Archived soundtrack fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'Archived soundtrack fixture',
    GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_AUTHOR_DATE: '2026-09-21T12:00:00Z',
    GIT_COMMITTER_DATE: '2026-09-21T12:00:00Z',
  });
  const run = (binary, args) => {
    const result = spawnSync(binary, args, {
      cwd: f.root,
      env: environment,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    return result.stdout;
  };
  run('git', ['init', '--quiet']);
  run('git', ['add', '.']);
  run('git', [
    '-c',
    'commit.gpgsign=false',
    '-c',
    `core.hooksPath=${os.devNull}`,
    'commit',
    '--quiet',
    '-m',
    'Dependency-free archived soundtrack fixture',
  ]);
  const commit = run('git', ['rev-parse', 'HEAD']).trim();
  // Both this checkout and releaseSnapshot's separately extracted Git archive
  // contain only the copied source files: no formatter installation or symlink.
  const version = 'archived-soundtrack-fixture';
  const release = JSON.parse(
    run(process.execPath, [
      path.join(f.root, 'scripts/game-cli.mjs'),
      'release-snapshot',
      '--ref',
      commit,
      '--version',
      version,
    ]),
  );
  assert.equal(release.sourceRevision, commit);
  const output = path.join(f.root, 'releases', version);
  const archive = await readFile(path.join(output, 'source.tar'));
  const entries = new Map(readTarEntries(archive).map((entry) => [entry.name, entry.bytes]));
  assert(![...entries.keys()].some((name) => name.split('/').includes('node_modules')));
  assert.deepEqual(
    entries.get('scripts/soundtrack-distribution.mjs'),
    await readFile(path.join(source, 'scripts/soundtrack-distribution.mjs')),
  );
  assert.equal(release.sourceArchiveSha256, sha(archive));
  assert.equal(
    release.distributionSha256,
    sha(await readFile(path.join(output, 'site/distribution.zip'))),
  );
  assert.deepEqual(
    JSON.parse(
      await readFile(path.join(output, 'site', f.config.soundtrackAlbums.originalCatalogue)),
    ),
    catalogue,
  );
  assert.equal(run('git', ['status', '--porcelain']), '');
});
test('absent album opt-in preserves output bytes and does not read the audio producer', async (t) => {
  const f = await fixture(t);
  await buildProject(f);
  const before = await readFile(path.join(f.out, 'distribution.zip'));
  await f.put('authoring/library/licensed-audio/build.mjs', 'not a module');
  await buildProject(f);
  assert.deepEqual(await readFile(path.join(f.out, 'distribution.zip')), before);
  assert.deepEqual(await readSoundtrackDistributionEntries('/missing'), []);
  assert.throws(() =>
    validateSoundtrackDistributionConfig({ ...option, catalog: '../borrowed.json' }),
  );
});
test('opt-in album bytes join loose, ZIP and manifest once, excluded from core and legacy pack metadata', async (t) => {
  const f = await fixture(t);
  f.config.soundtrackAlbums = option;
  await f.save();
  await buildProject(f);
  const manifest = JSON.parse(await readFile(path.join(f.out, 'manifest.json'))),
    offline = JSON.parse(await readFile(path.join(f.out, 'offline-cache.json')));
  const entries = manifest.files.filter((entry) => entry.path === f.album.album.path);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sha256, f.album.album.sha256);
  assert.deepEqual(await readFile(path.join(f.out, f.album.album.path)), f.album.bytes);
  assert(offline.files.some((entry) => entry.path === option.catalog));
  assert(!offline.files.some((entry) => entry.path.endsWith('.rlsound')));
  assert(!(offline.optionalPacks ?? []).some((entry) => entry.path.endsWith('.rlsound')));
  const zip = await readFile(path.join(f.out, 'distribution.zip'));
  let offset = 0,
    matches = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const length = zip.readUInt32LE(offset + 18),
      nameLength = zip.readUInt16LE(offset + 26),
      extraLength = zip.readUInt16LE(offset + 28),
      start = offset + 30 + nameLength + extraLength;
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    if (name === f.album.album.path) {
      matches++;
      assert.equal(sha(zip.subarray(start, start + length)), f.album.album.sha256);
    }
    offset = start + length;
  }
  assert.equal(matches, 1);
  assert(
    !manifest.files.some((entry) => entry.path.startsWith('authoring/library/licensed-audio/')),
  );
});
test('incorrect compiled body, symbolic source or automatic binary inclusion refuses without replacing old output', async (t) => {
  const f = await fixture(t);
  await buildProject(f);
  const before = await readFile(path.join(f.out, 'distribution.zip'));
  f.config.soundtrackAlbums = option;
  await f.save();
  const input = 'authoring/library/licensed-audio/source.json';
  const old = await readFile(path.join(f.root, input));
  const wrong = JSON.parse(old);
  wrong.body = Buffer.from('wrong bytes').toString('base64');
  await f.put(input, JSON.stringify(wrong));
  await assert.rejects(buildProject(f), /Compiled soundtrack body differs/);
  await f.put(input, old);
  await symlink(
    path.join(source, option.catalog),
    path.join(f.root, 'authoring/library/licensed-audio/borrowed.json'),
  );
  await assert.rejects(buildProject(f), /symbolic links/);
  await rm(path.join(f.root, 'authoring/library/licensed-audio/borrowed.json'));
  await f.put(f.album.album.path, f.album.bytes);
  f.config.include.push(f.album.album.path);
  await f.save();
  await assert.rejects(buildProject(f), /outside automatic includes/);
  assert.deepEqual(await readFile(path.join(f.out, 'distribution.zip')), before);
});
test('all 70 hosted registrations retain provenance without inventing listening approval', async () => {
  // Metadata integrity only: private creator recordings are not needed or read here.
  const load = async (name) =>
    JSON.parse(await readFile(path.join(source, licensedFolder, name), 'utf8'));
  const register = await load('sources.json');
  const initial = await load('provenance/derivatives.json');
  const additional = await load('provenance/additional-derivatives.json');
  const expansion = await load('provenance/expansion-derivatives.json');
  const evidence = await load('provenance/license-revalidation.json');
  const derivatives = [...initial.tracks, ...additional.tracks, ...expansion.tracks];
  assert.equal(register.format, 'revealline-licensed-audio-source.v1');
  assert.equal(register.tracks.length, 70);
  assert.equal(register.albums.length, 15);
  assert.equal(new Set(register.tracks.map((track) => track.id)).size, 70);
  assert.equal(new Set(register.albums.map((album) => album.id)).size, 15);
  assert.deepEqual(register.encoder, initial.encoder);
  assert.deepEqual(expansion.encoder, additional.encoder);
  const assigned = register.albums.flatMap((album) => {
    assert(album.trackIds.length > 0 && album.trackIds.length <= 128);
    for (const id of album.trackIds)
      assert(register.tracks.some((track) => track.id === id && track.albumId === album.id));
    return album.trackIds;
  });
  assert.equal(assigned.length, 70);
  assert.deepEqual(new Set(assigned), new Set(register.tracks.map((track) => track.id)));
  for (const track of register.tracks) {
    const licenseURL = licenses.find(([license]) => license === track.license)?.[1];
    assert(licenseURL, track.id);
    assert.equal(track.licenseURL, licenseURL);
    assert(
      evidence.sources.some(
        (item) =>
          item.source === track.source &&
          item.selectedLicenseURL === licenseURL &&
          item.status === licenseStatus,
      ),
      track.id,
    );
    for (const pin of [track.original, track.runtime]) {
      assert(!path.isAbsolute(pin.path));
      assert(pin.path.split('/').every((part) => part && part !== '.' && part !== '..'));
      assert(Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && pin.bytes <= 32 * 1024 * 1024);
      assert.match(pin.sha256, /^[a-f0-9]{64}$/);
    }
    assert(track.runtime.path.endsWith('.mp3'));
    if (track.original.path === track.runtime.path) {
      assert.deepEqual(track.original, track.runtime);
      assert.equal(track.derivative, null);
    } else {
      assert(track.original.path.endsWith(`/${track.derivative.sourceName}`));
      assert(track.original.path.endsWith('.ogg'));
      assert.equal(track.runtime.path, `derivatives/${track.derivative.name}`);
      assert.equal(track.derivative.sourceSha256, track.original.sha256);
      assert.equal(track.derivative.sourceBytes, track.original.bytes);
      assert.equal(track.derivative.sha256, track.runtime.sha256);
      assert.equal(track.derivative.bytes, track.runtime.bytes);
      assert.deepEqual(
        derivatives.find((item) => item.sha256 === track.runtime.sha256),
        track.derivative,
      );
    }
  }
  assert.equal(register.tracks.filter((track) => track.derivative !== null).length, 33);
  assert.equal(derivatives.length, 33);
  assert.deepEqual(await load('publication.json'), {
    format: 'revealline-licensed-publication.v1',
    approved: [],
  });
  const published = JSON.parse(await readFile(path.join(source, option.catalog), 'utf8'));
  assert.deepEqual(published.albums, []);
  const catalogue = JSON.parse(
    await readFile(path.join(source, 'game/content/soundtrack-catalogue.json'), 'utf8'),
  );
  assert.equal(catalogue.tracks.length, 70);
  assert.deepEqual(
    new Set(catalogue.tracks.map((track) => track.asset.sha256)),
    new Set(register.tracks.map((track) => track.runtime.sha256)),
  );
});

async function candidateFixture(t) {
  const f = await fixture(t);
  // Import the unmodified real compiler under a temporary source root. It receives
  // only coded-silence MP3s and opaque source-provenance fixtures, never private
  // originals or network input. This does not decode OGG or claim a real conversion.
  await f.put(
    `${licensedFolder}/build.mjs`,
    await readFile(path.join(source, licensedFolder, 'build.mjs')),
  );
  const bodies = new Map();
  const originalBodies = new Map();
  const tracks = [];
  for (const [index, [license, licenseURL]] of licenses.entries()) {
    const bytes = Buffer.from(await (await audioFixture(`producer-${index}`)).blob.arrayBuffer());
    const converted = index === 2;
    const originalBytes = converted
      ? Buffer.from('OggS synthetic opaque provenance fixture; not decoded or encoded audio.')
      : bytes;
    const original = {
      path: `originals/silence-${index}.${converted ? 'ogg' : 'mp3'}`,
      bytes: originalBytes.length,
      sha256: sha(originalBytes),
    };
    const runtime = {
      path: `${converted ? 'derivatives' : 'originals'}/silence-${index}.mp3`,
      bytes: bytes.length,
      sha256: sha(bytes),
    };
    const track = {
      id: `qa.producer-track-${index}`,
      title: `Synthetic coded silence ${index}`,
      artist: 'RevealLine tests',
      albumId: index < 2 ? 'qa.producer-one' : 'qa.producer-two',
      source: `https://example.test/synthetic-silence-${index}`,
      credit: 'Synthetic MPEG frame fixture; not a musical recording approval.',
      license,
      licenseURL,
      original,
      runtime,
      derivative: converted
        ? {
            name: path.basename(runtime.path),
            sourceName: path.basename(original.path),
            sourceSha256: original.sha256,
            sourceBytes: original.bytes,
            sha256: runtime.sha256,
            bytes: runtime.bytes,
          }
        : null,
      fileName: `Synthetic coded silence ${index}.mp3`,
      tags: { genres: ['chiptune'], role: 'any', energy: 3, themes: ['retro'] },
    };
    tracks.push(track);
    bodies.set(track.id, bytes);
    originalBodies.set(track.id, originalBytes);
    await f.put(`${licensedFolder}/${original.path}`, originalBytes);
    if (converted) await f.put(`${licensedFolder}/${runtime.path}`, bytes);
  }
  const register = {
    format: 'revealline-licensed-audio-source.v1',
    encoder: {},
    tracks,
    albums: ['qa.producer-one', 'qa.producer-two'].map((id) => ({
      id,
      title: `Synthetic album ${id}`,
      genre: 'Chiptune',
      description: 'Test-only coded silence; no production audio payload.',
      credit: 'RevealLine tests',
      source: 'https://example.test/synthetic-silence',
      trackIds: tracks.filter((track) => track.albumId === id).map((track) => track.id),
    })),
  };
  const save = () => f.put(`${licensedFolder}/sources.json`, JSON.stringify(register));
  await save();
  for (const name of ['derivatives', 'additional-derivatives', 'expansion-derivatives'])
    await f.put(
      `${licensedFolder}/provenance/${name}.json`,
      JSON.stringify({
        encoder: {},
        tracks:
          name === 'additional-derivatives'
            ? tracks.filter((track) => track.derivative).map((track) => track.derivative)
            : [],
      }),
    );
  await f.put(
    `${licensedFolder}/provenance/license-revalidation.json`,
    JSON.stringify({
      sources: tracks.map((track) => ({
        source: track.source,
        selectedLicenseURL: track.licenseURL,
        status: licenseStatus,
      })),
    }),
  );
  const producer = await import(pathToFileURL(path.join(f.root, licensedFolder, 'build.mjs')));
  return { ...f, register, bodies, originalBodies, saveRegister: save, ...producer };
}

test('real candidate producer compiles every tiny fixture, verifies import bytes and preserves output boundaries', async (t) => {
  const f = await candidateFixture(t);
  const { buildSoundtrackAlbums, writeSoundtrackAlbums, register } = f;
  const derivative = register.tracks.find((track) => track.derivative);
  assert(derivative, 'The real compiler must exercise a distinct OGG-source/MP3-runtime case.');
  assert.notEqual(derivative.original.path, derivative.runtime.path);
  assert.notEqual(derivative.original.sha256, derivative.runtime.sha256);
  const result = await buildSoundtrackAlbums();
  const catalog = result.catalog;
  assert.equal(catalog.albums.length, register.albums.length);
  assert.equal(result.bundles.length, register.albums.length);
  assert.equal(
    new Set(catalog.albums.flatMap((a) => a.library.tracks.map((t) => t.id))).size,
    register.tracks.length,
  );
  for (const bundle of result.bundles) {
    const metadata = catalog.albums.find((album) => album.path === bundle.name);
    assert.equal(bundle.bytes.length, metadata.bytes);
    assert.equal(sha(bundle.bytes), metadata.sha256);
    const restored = await importSoundtrackBundle(new Blob([bundle.bytes]), {
      probeMedia: structuralProbe,
    });
    assert.deepEqual(restored.library, metadata.library);
    for (const track of restored.library.tracks) {
      const declared = register.tracks.find((item) => item.id === track.id);
      assert.equal(track.asset.sha256, declared.runtime.sha256);
      assert.equal(track.asset.bytes, declared.runtime.bytes);
      assert.equal(track.fileName, declared.fileName);
      assert.deepEqual(restored.library.tags[track.id], declared.tags);
      assert.deepEqual(track.rights, {
        kind: 'licensed',
        credit: declared.credit,
        license: declared.license,
        source: declared.source,
      });
      const asset = restored.assets.find((item) => item.sha256 === track.asset.sha256);
      assert.deepEqual(Buffer.from(await asset.blob.arrayBuffer()), f.bodies.get(track.id));
    }
  }
  assert(result.bundles.every((body) => body.bytes.length <= 64 * 1024 * 1024));
  await f.put(option.catalog, JSON.stringify(catalog));
  assert.deepEqual(await readSoundtrackDistributionEntries(f.root, option), result.bundles);
  const stale = structuredClone(catalog);
  stale.albums[1].title = 'Stale candidate catalogue';
  await f.put(option.catalog, JSON.stringify(stale));
  await assert.rejects(readSoundtrackDistributionEntries(f.root, option), /catalog differs/);

  await assert.rejects(writeSoundtrackAlbums(path.join(f.root, 'game')), /fresh source cache/);
  await assert.rejects(writeSoundtrackAlbums(path.join(f.root, '.cache')), /fresh source cache/);
  await mkdir(path.join(f.root, '.cache'));
  const held = await mkdtemp(path.join(f.root, '.cache', 'album-output-held-'));
  await writeFile(path.join(held, 'preserve.txt'), 'existing output');
  await assert.rejects(writeSoundtrackAlbums(held), /already exists/);
  assert.equal(await readFile(path.join(held, 'preserve.txt'), 'utf8'), 'existing output');
});

test('real candidate producer refuses a changed final source body, false runtime hash and unassigned recording', async (t) => {
  const f = await candidateFixture(t);
  const track = f.register.tracks.at(-1);
  const body = f.originalBodies.get(track.id);
  await f.put(`${licensedFolder}/${track.original.path}`, Buffer.alloc(body.length));
  await assert.rejects(f.buildSoundtrackAlbums(), /Audio original differs/);
  await f.put(`${licensedFolder}/${track.original.path}`, body);
  const directMP3 = f.register.tracks[0];
  const runtimeHash = directMP3.runtime.sha256;
  directMP3.runtime.sha256 = '0'.repeat(64);
  await f.saveRegister();
  await assert.rejects(f.buildSoundtrackAlbums(), /inspection differs/);
  directMP3.runtime.sha256 = runtimeHash;
  f.register.albums.pop();
  await f.saveRegister();
  await assert.rejects(f.buildSoundtrackAlbums(), /Source track has no album/);
});

test('real candidate producer refuses altered derivative provenance and changed runtime bytes', async (t) => {
  const f = await candidateFixture(t);
  const track = f.register.tracks.find((item) => item.derivative);
  const receiptPath = `${licensedFolder}/provenance/additional-derivatives.json`;
  await f.put(
    receiptPath,
    JSON.stringify({
      encoder: {},
      tracks: [{ ...track.derivative, bytes: track.derivative.bytes + 1 }],
    }),
  );
  await assert.rejects(f.buildSoundtrackAlbums(), /Derivative path or retained provenance differs/);
  await f.put(receiptPath, JSON.stringify({ encoder: {}, tracks: [track.derivative] }));
  const changed = Buffer.from(f.bodies.get(track.id));
  changed[changed.length - 1] ^= 1;
  await f.put(`${licensedFolder}/${track.runtime.path}`, changed);
  await assert.rejects(f.buildSoundtrackAlbums(), /Audio original differs: derivatives\//);
  assert.deepEqual(
    await readFile(path.join(f.root, licensedFolder, track.original.path)),
    f.originalBodies.get(track.id),
  );
});

test('approved original recordings are optional binaries while their catalogue remains offline metadata', async (t) => {
  const f = await fixture(t);
  const name = 'optional/soundtracks/originals/test/pilot.mp3';
  const bytes = Buffer.from(await f.album.prepared.assets[0].blob.arrayBuffer());
  const catalogue = {
    format: 'revealline-soundtrack-catalogue.v1',
    edition: 'test',
    tracks: [
      {
        ...f.album.track,
        id: 'builtin.catalog.pilot',
        edition: 'test',
        path: name,
        tags: { genres: ['metal'], role: 'gameplay', energy: 4, themes: ['fpv'] },
      },
    ],
  };
  f.config.soundtrackAlbums = {
    ...option,
    originalCatalogue: 'game/content/soundtrack-catalogue.json',
  };
  await f.put(f.config.soundtrackAlbums.originalCatalogue, JSON.stringify(catalogue));
  await f.put(
    'authoring/library/revealline-original-soundtrack/input.json',
    JSON.stringify({ catalogue, name, bytes: bytes.toString('base64') }),
  );
  await f.put(
    'authoring/library/revealline-original-soundtrack/build.mjs',
    `import {readFile} from 'node:fs/promises'; export async function buildOriginalSoundtrackCatalogue() { const x=JSON.parse(await readFile(new URL('./input.json',import.meta.url))); return {catalogue:x.catalogue,files:[{name:x.name,bytes:Buffer.from(x.bytes,'base64')}]}; }`,
  );
  await f.save();
  await buildProject(f);
  const offline = JSON.parse(await readFile(path.join(f.out, 'offline-cache.json')));
  assert(offline.files.some((item) => item.path === f.config.soundtrackAlbums.originalCatalogue));
  assert(!offline.files.some((item) => item.path === name));
  assert.deepEqual(await readFile(path.join(f.out, name)), bytes);
  const prior = await readFile(path.join(f.out, 'manifest.json'));
  await f.put(
    f.config.soundtrackAlbums.originalCatalogue,
    JSON.stringify({ ...catalogue, edition: 'tampered' }),
  );
  await assert.rejects(buildProject(f), /catalogue differs/);
  assert.deepEqual(await readFile(path.join(f.out, 'manifest.json')), prior);
});
