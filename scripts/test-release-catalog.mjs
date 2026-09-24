import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { copyCatalogPresentation, catalogShell } from './release-catalog.mjs';
import { publishedReleaseIndex } from './build-pages.mjs';
import { validateBuildReferences } from './game-cli.mjs';
import { Document } from '../game/test/helpers/couch-dom.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function temporary(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'field-kit-catalog-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}
async function list(dir, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(path.join(dir, prefix), { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await list(dir, name)));
    else files.push(name);
  }
  return files;
}

test('catalog has a portable shared presentation with identical assets and font notices, outside frozen editions', async (t) => {
  const target = await temporary(t);
  const frozen = path.join(target, 'releases/v0.1.0/site/game');
  await fs.mkdir(frozen, { recursive: true });
  await fs.writeFile(path.join(frozen, 'index.html'), 'immutable old game');
  const receipt = await copyCatalogPresentation(root, target);
  const files = await list(path.join(target, 'catalog-ui'));
  assert.equal(files.length, receipt.files);
  let bytes = 0;
  for (const file of files) {
    const copied = await fs.readFile(path.join(target, 'catalog-ui', file));
    assert.equal(hash(copied), hash(await fs.readFile(path.join(root, file))), file);
    bytes += copied.length;
  }
  assert.equal(bytes, receipt.bytes);
  assert.ok(bytes < 40 * 1024 * 1024);
  assert.ok(files.includes('game/presentation/compiled/runtime.json'));
  assert.ok(files.includes('game/ui/operation-status.css'));
  assert.ok(files.includes('game/ui/fonts/field-kit/Exo2-OFL.txt'));
  assert.ok(files.includes('game/ui/fonts/field-kit/Handjet-OFL.txt'));
  assert.ok(files.includes('game/ui/fonts/field-kit/IBMPlexMono-OFL.txt'));
  assert.ok(files.includes('game/ui/fonts/Tiny5-Regular.ttf'));
  assert.ok(files.includes('game/ui/fonts/OFL.txt'));
  assert.ok(files.includes('game/ui/fonts/METADATA.pb'));
  assert.ok(files.includes('game/ui/fonts/provenance.json'));
  assert.ok(
    !files.some((file) => /(?:^|\/)(?:app|library|media-store|session-store)\.mjs$/.test(file)),
  );
  await fs.writeFile(
    path.join(target, 'releases/index.html'),
    catalogShell('Archive', '<h1>Archive</h1>', { presentation: true }),
  );
  const refs = await validateBuildReferences(
    target,
    (await list(target)).filter((file) => !file.includes('/v0.1.0/')),
  );
  assert.equal(refs.literalReferencesValid, true);
  // Resolve the copied host's actual dependency graph outside the source tree.
  // Catalog pages have no settings dialog but retain their text-size control.
  const { attachFieldKitSurfaces } = await import(
    pathToFileURL(path.join(target, 'catalog-ui/game/ui/field-kit-surfaces.mjs')).href
  );
  const document = new Document(),
    size = document.createElement('select');
  size.setAttribute('data-field-kit-text-size', '');
  document.body.append(size);
  const surfaces = attachFieldKitSurfaces({ document });
  size.value = 'large';
  size.emit('change');
  assert.equal(document.body.dataset.textSize, 'large');
  surfaces.destroy();
  assert.equal(await fs.readFile(path.join(frozen, 'index.html'), 'utf8'), 'immutable old game');
});

test('invalid compiled inventory fails before publication; historical controllers retain a readable fallback', async (t) => {
  const source = await temporary(t);
  const target = await temporary(t);
  assert.equal(await copyCatalogPresentation(source, target), false);
  await copyCatalogPresentation(root, source);
  const fixture = path.join(source, 'catalog-ui');
  const manifestFile = path.join(fixture, 'game/presentation/compiled/manifest.json');
  const original = JSON.parse(await fs.readFile(manifestFile));
  for (const mutate of [
    (manifest) => (manifest.files[0].sha256 = '0'.repeat(64)),
    (manifest) => (manifest.files[0].path = '../outside.png'),
    (manifest) => (manifest.format = 'unknown'),
  ]) {
    const manifest = structuredClone(original);
    mutate(manifest);
    await fs.writeFile(manifestFile, JSON.stringify(manifest));
    await assert.rejects(copyCatalogPresentation(fixture, target), /Catalog|catalog/);
    assert.deepEqual(await fs.readdir(target), []);
  }
  assert.match(catalogShell('<Archive>', ''), /&lt;Archive&gt;/);
  assert.throws(() => catalogShell('Archive', '', { prefix: 'https://external/' }), /prefix/);
});

test('styled catalogs retain canonical plays, manifest paths, downloads and escaped labels', () => {
  const record = { version: 'v0.50.0', sourceRevision: '<source>', play: 'v0.50.0/site/game/' };
  const index = publishedReleaseIndex(
    [record],
    'owner/game',
    record.version,
    {
      'v0.50.0': 'https://owner.github.io/archive/releases/v0.50.0/site/',
    },
    { presentation: true },
  );
  assert.match(index.html, /catalog-ui\/game\/presentation\/page-entry.mjs/);
  assert.match(index.html, /data-current="true"/);
  assert.match(index.html, /&lt;source&gt;/);
  assert.match(
    index.html,
    /href="https:\/\/owner.github.io\/archive\/releases\/v0.50.0\/site\/game\/"/,
  );
  assert.match(index.html, /href="\.\/v0.50.0\/release.json"/);
  assert.match(index.html, /releases\/download\/v0.50.0\/distribution.zip/);
  assert.equal(record.sourceRevision, '<source>');
});
