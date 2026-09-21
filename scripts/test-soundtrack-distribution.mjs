import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  symlink,
  realpath,
  access,
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { check, resolveConfig } from 'prettier';
import { buildProject } from './game-cli.mjs';
import {
  readSoundtrackDistributionEntries,
  validateSoundtrackDistributionConfig,
  writePublishedSoundtrackMetadata,
} from './soundtrack-distribution.mjs';
import { albumFixture, albumCatalog } from '../game/test/helpers/soundtrack-albums.mjs';
import {
  buildSoundtrackAlbums,
  writeSoundtrackAlbums,
} from '../authoring/library/licensed-audio/build.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const option = {
  format: 'revealline-soundtrack-distribution.v1',
  catalog: 'game/content/optional-soundtracks.json',
};
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
  for (const name of [
    'game/offline/service-worker.template.js',
    'game/soundtrack-albums.mjs',
    'game/soundtrack-bundle.mjs',
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
  const runtime = await import(pathToFileURL(modulePath));
  assert.deepEqual(runtime.SOUNDTRACK_CATALOGUE, built.catalogue);
  assert.deepEqual(runtime.SOUNDTRACK_CATALOGUE.tracks[0], catalogue.tracks[0]);
  assert.deepEqual(runtime.SOUNDTRACK_ARCHIVES, built.archives);
  const firstMetadata = await readFile(path.join(f.root, 'game/content/soundtrack-catalogue.json'));
  await writePublishedSoundtrackMetadata(f.root);
  assert.equal(await readFile(modulePath, 'utf8'), first);
  assert.deepEqual(
    await readFile(path.join(f.root, 'game/content/soundtrack-catalogue.json')),
    firstMetadata,
  );
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
test('candidate producer binds every admitted source and stays separate from published catalogue', async (t) => {
  const register = JSON.parse(
    await readFile(path.join(source, 'authoring/library/licensed-audio/sources.json')),
  );
  const available = await Promise.all(
    register.tracks.flatMap((track) =>
      [track.original.path, track.runtime.path].map(async (relative) => {
        try {
          await access(path.join(source, 'authoring/library/licensed-audio', relative));
          return true;
        } catch (error) {
          if (error.code === 'ENOENT') return false;
          throw error;
        }
      }),
    ),
  );
  if (available.some((present) => !present)) {
    t.skip(
      'Local unreviewed creator recordings are not distributed in a source checkout; synthetic distribution and publication-refusal tests still run.',
    );
    return;
  }
  const result = await buildSoundtrackAlbums();
  const catalog = result.catalog;
  assert.equal(catalog.albums.length, register.albums.length);
  assert.equal(
    new Set(catalog.albums.flatMap((a) => a.library.tracks.map((t) => t.id))).size,
    register.tracks.length,
  );
  assert.equal(register.tracks.length, 70);
  for (const bundle of result.bundles) {
    const metadata = catalog.albums.find((album) => album.path === bundle.name);
    assert.equal(bundle.bytes.length, metadata.bytes);
    assert.equal(sha(bundle.bytes), metadata.sha256);
  }
  assert(result.bundles.every((body) => body.bytes.length <= 64 * 1024 * 1024));
  await assert.rejects(writeSoundtrackAlbums(path.join(source, 'game')), /fresh source cache/);
  await assert.rejects(writeSoundtrackAlbums(path.join(source, '.cache')), /fresh source cache/);
  await mkdir(path.join(source, '.cache'), { recursive: true });
  const held = await mkdtemp(path.join(source, '.cache', 'album-output-held-'));
  t.after(() => rm(held, { recursive: true, force: true }));
  await writeFile(path.join(held, 'preserve.txt'), 'existing output');
  await assert.rejects(writeSoundtrackAlbums(held), /already exists/);
  assert.equal(await readFile(path.join(held, 'preserve.txt'), 'utf8'), 'existing output');
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
