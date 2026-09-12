import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { loadNativeSite, validateNativeInventory, byteRange } from '../resources.mjs';
import { APP_ORIGIN, NATIVE_MARKER, NATIVE_FORMAT, SECURITY_HEADERS } from '../policy.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (data) => Buffer.from(JSON.stringify(data));
async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-shell-test-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = {
    'index.html': '<h1>Home</h1>',
    'game/index.html': '<script type="module" src="./app.mjs"></script>',
    'game/app.mjs': 'export const game = true;',
    'game/style.css': 'body { margin:0 }',
    'game/content/level.json': '{"name":"Original"}',
    'authoring/motion-lab/assets/drone.png': 'image-bytes',
    'audio/track.ogg': '0123456789',
  };
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), content);
  }
  const manifest = {
    formatVersion: 1,
    version: 'v0.2.1',
    sourceRevision: 'a'.repeat(40),
    entry: 'game/index.html',
    totalBytes: Object.values(files).reduce((total, value) => total + Buffer.byteLength(value), 0),
    files: Object.entries(files).map(([name, content]) => ({
      path: name,
      bytes: Buffer.byteLength(content),
      sha256: hash(content),
    })),
  };
  const marker = {
    format: NATIVE_FORMAT,
    platform: 'desktop',
    scheme: 'revealline',
    host: 'app',
    entry: manifest.entry,
    version: manifest.version,
    manifestSha256: hash(json(manifest)),
    sourceManifestSha256: hash(json(manifest)),
  };
  async function saveMetadata() {
    marker.manifestSha256 = hash(json(manifest));
    await fs.writeFile(path.join(root, 'manifest.json'), json(manifest));
    await fs.writeFile(path.join(root, NATIVE_MARKER), json(marker));
  }
  await saveMetadata();
  return { root, files, marker, manifest, saveMetadata };
}
const request = (pathname, { method = 'GET', range } = {}) => ({
  url: `${APP_ORIGIN}${pathname}`,
  method,
  headers: new Headers(range ? { range } : {}),
});

test('verified distribution serves nested modules, JSON, art and HTML with MIME and CSP', async (t) => {
  const f = await fixture(t),
    site = await loadNativeSite(f.root);
  assert.equal(site.entryURL, `${APP_ORIGIN}game/index.html`);
  assert.equal(site.fileCount, 7);
  assert.equal(site.isNavigationAllowed(`${APP_ORIGIN}game/?practice=1`), true);
  assert.equal(site.isNavigationAllowed(`${APP_ORIGIN}game/app.mjs`), false);
  for (const [name, mime] of [
    ['game/', 'text/html'],
    ['game/app.mjs', 'text/javascript'],
    ['game/content/level.json', 'application/json'],
    ['authoring/motion-lab/assets/drone.png', 'image/png'],
  ]) {
    const response = await site.handle(request(name));
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('Content-Type').startsWith(mime));
    assert.equal(
      response.headers.get('Content-Security-Policy'),
      SECURITY_HEADERS['Content-Security-Policy'],
    );
    assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('metadata, unknown files, traversal and write requests cannot expose or mutate local files', async (t) => {
  const f = await fixture(t),
    site = await loadNativeSite(f.root);
  await fs.writeFile(path.join(f.root, 'private.json'), 'private');
  for (const pathname of ['private.json', 'manifest.json', 'package.json', 'missing.js'])
    assert.equal((await site.handle(request(pathname))).status, 404);
  for (const pathname of [
    '../private.json',
    '%2e%2e/private.json',
    NATIVE_MARKER,
    'game%2findex.html',
  ])
    assert.equal((await site.handle(request(pathname))).status, 400);
  const denied = await site.handle(request('game/content/level.json', { method: 'POST' }));
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get('Allow'), 'GET, HEAD');
  assert.equal(
    await fs.readFile(path.join(f.root, 'game/content/level.json'), 'utf8'),
    f.files['game/content/level.json'],
  );
});

test('HEAD and bounded single ranges support local media without bypassing integrity', async (t) => {
  const f = await fixture(t),
    site = await loadNativeSite(f.root);
  const head = await site.handle(request('audio/track.ogg', { method: 'HEAD' }));
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), '10');
  assert.equal(await head.text(), '');
  const part = await site.handle(request('audio/track.ogg', { range: 'bytes=2-5' }));
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(await part.text(), '2345');
  assert.equal(
    await (await site.handle(request('audio/track.ogg', { range: 'bytes=-3' }))).text(),
    '789',
  );
  assert.equal(
    await (await site.handle(request('audio/track.ogg', { range: 'bytes=8-' }))).text(),
    '89',
  );
  for (const range of ['bytes=99-', 'bytes=3-2', 'bytes=1-2,5-6', 'bytes=-0', 'bytes=-', 'bad']) {
    const response = await site.handle(request('audio/track.ogg', { range }));
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */10');
  }
  assert.equal(byteRange('bytes=0-', 0), null);
});

test('startup rejects changed resources and runtime rechecks prevent serving replacements', async (t) => {
  const f = await fixture(t),
    site = await loadNativeSite(f.root);
  await fs.writeFile(path.join(f.root, 'game/app.mjs'), 'replaced script');
  assert.equal((await site.handle(request('game/app.mjs'))).status, 503);
  await assert.rejects(loadNativeSite(f.root), /checksum/);
  await fs.writeFile(path.join(f.root, 'game/app.mjs'), f.files['game/app.mjs']);
  await fs.unlink(path.join(f.root, 'game/app.mjs'));
  assert.equal((await site.handle(request('game/app.mjs'))).status, 503);
});

test('symlink files and directories are rejected even if bytes have the expected checksum', async (t) => {
  const f = await fixture(t),
    site = await loadNativeSite(f.root);
  const target = path.join(f.root, 'copy.mjs');
  await fs.writeFile(target, f.files['game/app.mjs']);
  await fs.unlink(path.join(f.root, 'game/app.mjs'));
  await fs.symlink(target, path.join(f.root, 'game/app.mjs'));
  assert.equal((await site.handle(request('game/app.mjs'))).status, 503);
  await assert.rejects(loadNativeSite(f.root), /Symbolic links/);
  await fs.unlink(path.join(f.root, 'game/app.mjs'));
  await fs.rename(path.join(f.root, 'game'), path.join(f.root, 'original-game'));
  await fs.symlink(path.join(f.root, 'original-game'), path.join(f.root, 'game'), 'dir');
  await assert.rejects(loadNativeSite(f.root), /Symbolic links/);
});

test('marker identity, manifest hash, paths, case aliases and size accounting must agree', async (t) => {
  const f = await fixture(t);
  assert.equal(validateNativeInventory(json(f.marker), json(f.manifest)).inventory.size, 7);
  for (const change of [
    (m) => {
      m.platform = 'ios';
    },
    (m) => {
      m.host = 'localhost';
    },
    (m) => {
      m.scheme = 'file';
    },
    (m) => {
      m.version = 'v9.0.0';
    },
    (m) => {
      m.manifestSha256 = 'b'.repeat(64);
    },
    (m) => {
      m.extra = true;
    },
    (m) => {
      m.sourceManifestSha256 = 'invalid';
    },
  ]) {
    const marker = structuredClone(f.marker);
    change(marker);
    assert.throws(() => validateNativeInventory(json(marker), json(f.manifest)), /Native site/);
  }
  for (const change of [
    (m) => {
      m.totalBytes++;
    },
    (m) => {
      m.files[0].path = '../private';
    },
    (m) => {
      m.files[0].bytes = -1;
    },
    (m) => {
      m.files[0].sha256 = 'wrong';
    },
    (m) => {
      m.files.push({ ...m.files[0], path: 'INDEX.HTML' });
    },
    (m) => {
      m.files = m.files.filter((file) => file.path !== 'game/index.html');
    },
  ]) {
    const manifest = structuredClone(f.manifest);
    change(manifest);
    const bytes = json(manifest),
      marker = { ...f.marker, manifestSha256: hash(bytes) };
    assert.throws(() => validateNativeInventory(json(marker), bytes), /Native site/);
  }
  await fs.unlink(path.join(f.root, NATIVE_MARKER));
  await assert.rejects(loadNativeSite(f.root));
});
