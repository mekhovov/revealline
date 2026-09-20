import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildProject, collectBuildFiles, readBuildConfig } from './game-cli.mjs';
import {
  readOptionalArtwork,
  validateOptionalArtworkConfig,
  verifyOptionalArtworkEntries,
} from './optional-artwork.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const option = {
  format: 'revealline-optional-artwork.v1',
  catalog: 'game/content-design/horizon-art.mjs',
};
const imagePath = 'game/content-design/assets/fixture-r1/one.png';
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7V8AAAAASUVORK5CYII=',
  'base64',
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = {
  format: 'AssetRevisionV1',
  id: 'fixture',
  revision: 'r1',
  kind: 'reveal-background',
  path: imagePath.slice(5),
  sha256: sha(image),
  bytes: image.length,
  width: 1,
  height: 1,
  alt: 'Fixture picture.',
  review: 'candidate',
};
async function fixture(t) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'revealline-artwork-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source'),
    out = path.join(directory, 'out');
  await mkdir(path.join(root, path.dirname(imagePath)), { recursive: true });
  await mkdir(path.join(root, 'game/offline'));
  await writeFile(path.join(root, imagePath), image);
  await writeFile(
    path.join(root, 'game/index.html'),
    '<html><head></head><body>Fixture</body></html>',
  );
  await writeFile(path.join(root, 'game/offline.mjs'), 'export const fixture = true;');
  await writeFile(
    path.join(root, 'game/offline/service-worker.template.js'),
    await readFile(path.join(source, 'game/offline/service-worker.template.js')),
  );
  const config = {
    version: 'artwork-test',
    entry: 'game/index.html',
    include: ['game'],
    optionalArtwork: option,
  };
  const saveConfig = (value = config) =>
    writeFile(path.join(root, 'game/build-config.json'), JSON.stringify(value));
  const saveCatalog = (value = [pin]) =>
    writeFile(
      path.join(root, option.catalog),
      `export const HORIZON_ART_CANDIDATES = ${JSON.stringify(value)};`,
    );
  await saveConfig();
  await saveCatalog();
  return { root, out, directory, config, saveConfig, saveCatalog };
}

test('optional artwork requires an explicit narrow opt-in and preserves absent-option compatibility', async (t) => {
  assert.equal(await readOptionalArtwork('/absent'), null);
  for (const value of [
    null,
    {},
    { ...option, format: 'v2' },
    { ...option, catalog: '../arbitrary.mjs' },
    { ...option, extra: true },
  ]) {
    assert.throws(() => validateOptionalArtworkConfig(value));
  }
  const { root, out, config, saveConfig } = await fixture(t);
  delete config.optionalArtwork;
  await saveConfig();
  await buildProject({ root, out });
  const before = await readFile(path.join(out, 'distribution.zip'));
  await buildProject({ root, out });
  assert.deepEqual(await readFile(path.join(out, 'distribution.zip')), before);
  const offline = JSON.parse(await readFile(path.join(out, 'offline-cache.json')));
  assert.equal(offline.optionalArtwork, undefined);
  assert(offline.files.some((file) => file.path === imagePath));
});

test('exact originals remain in loose, ZIP and manifest while only declared images leave core offline cache', async (t) => {
  const { root, out } = await fixture(t);
  await buildProject({ root, out });
  const offline = JSON.parse(await readFile(path.join(out, 'offline-cache.json'))),
    manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'))),
    zip = await readFile(path.join(out, 'distribution.zip'));
  assert.deepEqual(await readFile(path.join(out, imagePath)), image);
  assert.deepEqual(
    manifest.files.find((file) => file.path === imagePath),
    { path: imagePath, bytes: image.length, sha256: sha(image) },
  );
  assert.equal(manifest.files.filter((file) => file.path === imagePath).length, 1);
  assert(zip.includes(image));
  assert(!offline.files.some((file) => file.path === imagePath));
  assert(offline.files.some((file) => file.path === option.catalog));
  assert.equal(offline.optionalArtwork.availability, 'online-only');
  assert.equal(offline.optionalArtwork.count, 1);
  assert.equal(offline.optionalArtwork.bytes, image.length);
  assert.deepEqual(offline.optionalArtwork.files, [
    { path: imagePath, bytes: image.length, sha256: sha(image) },
  ]);
  assert.match(await readFile(path.join(out, 'game/index.html'), 'utf8'), /optionalArtwork/);
  assert.match(await readFile(path.join(out, 'service-worker.js'), 'utf8'), /online-only/);
});

test('invalid pins, missing inputs, bytes, dimensions and duplicate declarations cannot exclude assets', async (t) => {
  const { root, saveCatalog } = await fixture(t);
  const files = await collectBuildFiles(root);
  for (const bad of [
    [],
    Array(33).fill(pin),
    [pin, pin],
    [{ ...pin, width: 2 }],
    [{ ...pin, bytes: image.length + 1 }],
    [{ ...pin, sha256: 'a'.repeat(64) }],
    [{ ...pin, path: '../outside.png' }],
  ]) {
    await saveCatalog(bad);
    await assert.rejects(readOptionalArtwork(root, option, files));
  }
  await saveCatalog();
  await assert.rejects(
    readOptionalArtwork(
      root,
      option,
      files.filter((name) => name !== option.catalog),
    ),
    /registry must be shipped/,
  );
  await assert.rejects(
    readOptionalArtwork(
      root,
      option,
      files.filter((name) => name !== imagePath),
    ),
    /original must be shipped/,
  );
  await writeFile(path.join(root, imagePath), Buffer.alloc(image.length));
  await assert.rejects(readOptionalArtwork(root, option, files), /bytes differ/);
});

test('symlinked source is refused before registry evaluation', async (t) => {
  const { root, directory } = await fixture(t);
  const files = await collectBuildFiles(root);
  await rm(path.join(root, option.catalog));
  await writeFile(path.join(directory, 'outside.mjs'), 'throw Error("executed outside source");');
  await symlink(path.join(directory, 'outside.mjs'), path.join(root, option.catalog));
  await assert.rejects(readOptionalArtwork(root, option, files), /symbolic links/);
});

test('last packaging boundary rejects missing, duplicate or changed originals', () => {
  const artwork = { files: [{ path: imagePath, bytes: image.length, sha256: sha(image) }] },
    entry = { name: imagePath, bytes: image };
  verifyOptionalArtworkEntries(artwork, [entry]);
  for (const entries of [[], [entry, entry], [{ ...entry, bytes: Buffer.alloc(image.length) }]]) {
    assert.throws(() => verifyOptionalArtworkEntries(artwork, entries), /changed between/);
  }
});

test('selected real source authenticates all ten originals without producing a bulk distribution', async () => {
  const config = await readBuildConfig(source),
    files = await collectBuildFiles(source, config);
  const artwork = await readOptionalArtwork(source, config.optionalArtwork, files);
  assert.equal(artwork.count, 10);
  assert.equal(artwork.bytes, 25862573);
  assert.equal(new Set(artwork.files.map((file) => file.path)).size, 10);
});
