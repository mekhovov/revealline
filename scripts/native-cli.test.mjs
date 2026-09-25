import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stageNative, verifySite, NATIVE_MARKER, IOS_CSP, iosHTMLPolicy } from './native-cli.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { loadNativeSite, MAX_SITE_BYTES } from '../platforms/desktop/resources.mjs';
import { MAX_NATIVE_FILES, MAX_NATIVE_SITE_BYTES } from './native-cli.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const script = fileURLToPath(new URL('./native-cli.mjs', import.meta.url));
async function present(file) {
  try {
    await fs.lstat(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}
async function snapshot(root) {
  const result = {};
  async function walk(relative = '') {
    for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${item.name}` : item.name;
      if (item.isDirectory()) await walk(name);
      else
        result[name] = item.isSymbolicLink()
          ? `link:${await fs.readlink(path.join(root, name))}`
          : hash(await fs.readFile(path.join(root, name)));
    }
  }
  await walk();
  return result;
}
async function fixture(t) {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-native-test-')),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const site = path.join(root, 'release-site'),
    out = path.join(root, 'native-site');
  const files = new Map([
    [
      'game/index.html',
      Buffer.from(
        '<!doctype html><html><head><script type="module" src="app.mjs"></script></head><body>Game</body></html>',
      ),
    ],
    ['game/app.mjs', Buffer.from('export const version="fixture";')],
    ['game/content/example.json', Buffer.from('{"id":"fixture"}')],
    ['authoring/motion-lab/assets/body.png', Buffer.from('bounded fixture image bytes')],
    [
      'credits.html',
      Buffer.from(
        '<!doctype html><html><head><title>Credits</title></head><body><p>Original credits</p></body></html>',
      ),
    ],
  ]);
  for (const [name, bytes] of files) {
    const target = path.join(site, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
  const manifest = {
    formatVersion: 1,
    version: 'v0.2.1',
    entry: 'game/index.html',
    sourceRevision: '1'.repeat(40),
    totalBytes: [...files.values()].reduce((total, bytes) => total + bytes.length, 0),
    files: [...files].map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: hash(bytes),
    })),
  };
  const writeManifest = (next = manifest) =>
    fs.writeFile(path.join(site, 'manifest.json'), json(next));
  await writeManifest();
  const bridge = path.join(root, 'bridge.mjs');
  await fs.writeFile(bridge, 'export const nativeFixture=true;\n');
  return { root, site, out, bridge, manifest, files, writeManifest };
}

test('desktop staging preserves verified asset/manifest bytes and never rewrites the released source', async (t) => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.site, 'not-in-the-manifest.txt'), 'not native content');
  const before = await snapshot(f.site),
    originalManifest = await fs.readFile(path.join(f.site, 'manifest.json'));
  const result = await stageNative({ site: f.site, out: f.out, platform: 'desktop' });
  assert.equal(result.scheme, 'revealline');
  assert.equal(result.host, 'app');
  assert.equal(result.entry, 'game/index.html');
  assert.equal(result.files, f.files.size);
  assert.equal(result.sourceManifestSha256, hash(originalManifest));
  assert.equal(result.manifestSha256, hash(originalManifest));
  assert.deepEqual(await fs.readFile(path.join(f.out, 'manifest.json')), originalManifest);
  for (const [name, bytes] of f.files)
    assert.deepEqual(await fs.readFile(path.join(f.out, name)), bytes);
  assert.equal(await present(path.join(f.out, 'not-in-the-manifest.txt')), false);
  assert.deepEqual(await snapshot(f.site), before);
  assert.equal((await verifySite(f.out, { native: true })).marker.platform, 'desktop');
});
test('current-sized native inventories stage and load without dropping localization files', async (t) => {
  const f = await fixture(t);
  const additional = new Map(
    Array.from({ length: 1100 }, (_, index) => [`game/item-${index}.json`, Buffer.from('{}')]),
  );
  additional.set(
    'game/i18n/catalogs.mjs',
    Buffer.from('globalThis.RevealLineTranslations={en:{},uk:{}};'),
  );
  for (const [name, bytes] of additional) {
    await fs.mkdir(path.dirname(path.join(f.site, name)), { recursive: true });
    await fs.writeFile(path.join(f.site, name), bytes);
    f.manifest.files.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
    f.manifest.totalBytes += bytes.length;
  }
  await f.writeManifest();
  await stageNative({ site: f.site, out: f.out, platform: 'desktop' });
  const site = await loadNativeSite(f.out);
  assert.equal(site.fileCount, f.manifest.files.length);
  assert.equal(
    (await site.handle(new Request('revealline://app/game/i18n/catalogs.mjs'))).status,
    200,
  );
  assert.equal(MAX_NATIVE_SITE_BYTES, MAX_SITE_BYTES);
  await f.writeManifest({
    ...f.manifest,
    files: Array(MAX_NATIVE_FILES + 1).fill(f.manifest.files[0]),
  });
  await assert.rejects(verifySite(f.site), /Invalid native file inventory/);
});
test('iOS adds the explicit bridge and records both source and resulting inventory identities', async (t) => {
  const f = await fixture(t),
    before = await snapshot(f.site);
  const result = await stageNative({ ...f, platform: 'ios' });
  const verified = await verifySite(f.out, { native: true });
  assert.equal(result.scheme, 'capacitor');
  assert.equal(result.host, 'localhost');
  assert.equal(result.files, f.files.size + 1);
  assert.notEqual(result.manifestSha256, result.sourceManifestSha256);
  assert.deepEqual(
    await fs.readFile(path.join(f.out, 'native/bridge.mjs')),
    await fs.readFile(f.bridge),
  );
  assert.equal(verified.manifest.sourceRevision, f.manifest.sourceRevision);
  for (const [name, bytes] of f.files) {
    const staged = await fs.readFile(path.join(f.out, name));
    if (name.endsWith('.html')) {
      const html = staged.toString();
      assert.ok(
        html.indexOf('Content-Security-Policy') < html.indexOf('<script') ||
          !html.includes('<script'),
      );
      assert.ok(html.includes(IOS_CSP));
      assert.notDeepEqual(staged, bytes);
      assert.deepEqual(iosHTMLPolicy(staged, name), staged);
      assert.equal(
        verified.manifest.files.find((entry) => entry.path === name).sha256,
        hash(staged),
      );
    } else assert.deepEqual(staged, bytes);
  }
  assert.deepEqual(await snapshot(f.site), before);
});
test('iOS policy derives from public headers, excludes unsupported meta directives and precedes bootstrap', () => {
  assert.equal(
    IOS_CSP,
    PUBLIC_SECURITY_HEADERS['Content-Security-Policy']
      .split(';')
      .map((s) => s.trim())
      .filter((s) => !s.startsWith('frame-ancestors'))
      .join('; '),
  );
  assert.ok(!IOS_CSP.includes('frame-ancestors'));
  assert.ok(!IOS_CSP.includes('unsafe-eval'));
  assert.ok(IOS_CSP.includes("script-src 'self';"));
  assert.ok(IOS_CSP.includes("connect-src 'self';"));
  assert.ok(IOS_CSP.includes("img-src 'self' data: blob:;"));
  assert.ok(IOS_CSP.includes("base-uri 'none'; form-action 'none'"));
  const html =
    '<!doctype html><!-- <head><script>fake</script></head> --><html><head>\n<script type="module" src="app.mjs"></script></head><body><iframe src="../game/index.html"></iframe></body></html>';
  const changed = iosHTMLPolicy(Buffer.from(html));
  const actual = changed.toString();
  assert.match(actual, /<html><head>\n    <meta http-equiv="Content-Security-Policy"/);
  assert.ok(actual.indexOf('Content-Security-Policy') < actual.indexOf('src="app.mjs"'));
  assert.ok(actual.includes('<iframe src="../game/index.html">'));
  assert.deepEqual(iosHTMLPolicy(changed), changed);
});
test('compatible existing policy is preserved and relocated once; conflicts, duplicates and malformed heads reject', () => {
  const policy =
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";
  const meta = `<meta content="${policy}" http-equiv="Content-Security-Policy">`;
  const source = `<html><head><meta charset="utf-8">${meta}<script src="page.js"></script></head></html>`;
  const result = iosHTMLPolicy(Buffer.from(source));
  assert.match(result.toString(), /^<html><head>\n    <meta content=/);
  assert.ok(result.toString().includes(policy));
  assert.equal(result.toString().match(/Content-Security-Policy/g).length, 1);
  assert.deepEqual(iosHTMLPolicy(result), result);
  for (const html of [
    `<html><head>${meta}${meta}</head></html>`,
    `<html><head>${meta.replace("script-src 'self'", "script-src 'self' 'unsafe-eval'")}</head></html>`,
    `<html><head>${meta.replace("connect-src 'self'", 'connect-src https:')}</head></html>`,
    `<html><head>${meta.replace("base-uri 'none'", "base-uri 'self'")}</head></html>`,
    `<html><head>${meta.replace('http-equiv=', 'HTTP-EQUIV="refresh" http-equiv=')}</head></html>`,
    `<html><head>${meta.replace('Content-Security-Policy', 'Content-Security-Policy-Report-Only')}</head></html>`,
    `<html><head></head><body>${meta}</body></html>`,
    '<script src="early.js"></script><html><head></head></html>',
    '<html><head></head><head></head></html>',
    '<html><body>No explicit head</body></html>',
  ])
    assert.throws(() => iosHTMLPolicy(Buffer.from(html)));
  assert.throws(() => iosHTMLPolicy(Buffer.from([0xff])), /UTF-8/);
});
test('a conflicting first-party HTML policy cannot replace an existing verified iOS stage', async (t) => {
  const f = await fixture(t);
  await stageNative({ ...f, platform: 'ios' });
  const before = await snapshot(f.out);
  const name = 'game/index.html';
  const bytes = Buffer.from(
    '<html><head><meta http-equiv="Content-Security-Policy" content="default-src *; script-src *"></head></html>',
  );
  await fs.writeFile(path.join(f.site, name), bytes);
  const files = f.manifest.files.map((entry) =>
    entry.path === name
      ? {
          ...entry,
          bytes: bytes.length,
          sha256: hash(bytes),
        }
      : entry,
  );
  await f.writeManifest({
    ...f.manifest,
    files,
    totalBytes: files.reduce((sum, entry) => sum + entry.bytes, 0),
  });
  await assert.rejects(
    stageNative({ ...f, platform: 'ios', replace: true }),
    /Incompatible existing iOS CSP/,
  );
  assert.deepEqual(await snapshot(f.out), before);
  assert.deepEqual(await fs.readFile(path.join(f.site, name)), bytes);
});
test('iOS diagnostics copy exactly four bounded files into the native inventory without altering source', async (t) => {
  const f = await fixture(t),
    diagnostics = path.join(f.root, 'diagnostics');
  await fs.mkdir(diagnostics);
  const names = ['index.html', 'page.js', 'probe.mjs', 'style.css'];
  const diagnosticHTML =
    '<html><head><script type="module" src="page.js"></script></head><body>Diagnostics</body></html>';
  for (const name of names)
    await fs.writeFile(
      path.join(diagnostics, name),
      name === 'index.html' ? diagnosticHTML : `fixture ${name}`,
    );
  await fs.writeFile(path.join(diagnostics, 'not-a-public-file.txt'), 'do not copy');
  const before = await snapshot(f.site);
  const diagnosticsBefore = await snapshot(diagnostics);
  const result = await stageNative({ ...f, platform: 'ios', diagnostics });
  const verified = await verifySite(f.out, { native: true });
  assert.equal(result.files, f.files.size + 5);
  assert.notEqual(result.manifestSha256, result.sourceManifestSha256);
  assert.deepEqual(
    verified.entries
      .filter((entry) => entry.name.startsWith('diagnostics/'))
      .map((entry) => entry.name),
    names.map((name) => `diagnostics/${name}`).sort(),
  );
  for (const name of names)
    assert.equal(
      await fs.readFile(path.join(f.out, 'diagnostics', name), 'utf8'),
      name === 'index.html'
        ? iosHTMLPolicy(Buffer.from(diagnosticHTML)).toString()
        : `fixture ${name}`,
    );
  assert.equal(await present(path.join(f.out, 'diagnostics/not-a-public-file.txt')), false);
  assert.deepEqual(await snapshot(f.site), before);
  assert.deepEqual(await snapshot(diagnostics), diagnosticsBefore);
});
test('diagnostics reject wrong platform, missing/oversized files and symlinks before replacing output', async (t) => {
  const f = await fixture(t),
    diagnostics = path.join(f.root, 'diagnostics');
  await stageNative({ ...f, platform: 'ios' });
  const before = await snapshot(f.out);
  await assert.rejects(
    stageNative({ ...f, platform: 'desktop', diagnostics }),
    /only supported for iOS/,
  );
  await fs.mkdir(diagnostics);
  await assert.rejects(stageNative({ ...f, platform: 'ios', diagnostics, replace: true }));
  for (const name of ['index.html', 'page.js', 'probe.mjs', 'style.css'])
    await fs.writeFile(path.join(diagnostics, name), 'test');
  await fs.writeFile(path.join(diagnostics, 'style.css'), Buffer.alloc(128 * 1024 + 1));
  await assert.rejects(
    stageNative({ ...f, platform: 'ios', diagnostics, replace: true }),
    /file size/,
  );
  await fs.unlink(path.join(diagnostics, 'style.css'));
  await fs.symlink(f.bridge, path.join(diagnostics, 'style.css'));
  await assert.rejects(
    stageNative({ ...f, platform: 'ios', diagnostics, replace: true }),
    /Symbolic link/,
  );
  assert.deepEqual(await snapshot(f.out), before);
});
test('traversal, duplicate, reserved and invalid inventory records are rejected before creating output', async (t) => {
  const f = await fixture(t);
  const variants = [
    { ...f.manifest, files: [{ ...f.manifest.files[0], path: '../outside.txt' }] },
    { ...f.manifest, files: [{ ...f.manifest.files[0], path: '/absolute.txt' }] },
    { ...f.manifest, files: [...f.manifest.files, f.manifest.files[0]] },
    ...['manifest.json', NATIVE_MARKER].map((name) => ({
      ...f.manifest,
      files: [{ ...f.manifest.files[0], path: name }],
    })),
    { ...f.manifest, version: '../release' },
    { ...f.manifest, totalBytes: f.manifest.totalBytes + 1 },
    { ...f.manifest, files: [{ ...f.manifest.files[0], bytes: -1 }] },
    { ...f.manifest, files: [{ ...f.manifest.files[0], sha256: 'bad' }] },
    {
      ...f.manifest,
      files: f.manifest.files.slice(1),
      totalBytes: f.manifest.totalBytes - f.manifest.files[0].bytes,
    },
  ];
  for (const manifest of variants) {
    await f.writeManifest(manifest);
    await assert.rejects(stageNative({ ...f, platform: 'desktop' }));
    assert.equal(await present(f.out), false);
  }
});
test('missing and tampered assets cannot replace a previously verified native stage', async (t) => {
  const f = await fixture(t);
  await stageNative({ ...f, platform: 'desktop' });
  const before = await snapshot(f.out),
    target = path.join(f.site, 'game/app.mjs');
  const changed = Buffer.from(f.files.get('game/app.mjs'));
  changed[0] ^= 1;
  await fs.writeFile(target, changed);
  await assert.rejects(stageNative({ ...f, platform: 'desktop', replace: true }), /verification/);
  assert.deepEqual(await snapshot(f.out), before);
  await fs.unlink(target);
  await assert.rejects(stageNative({ ...f, platform: 'desktop', replace: true }));
  assert.deepEqual(await snapshot(f.out), before);
});
test('bounded stat guards reject oversized manifest, actual asset and bridge before reading their data', async (t) => {
  const f = await fixture(t);
  const grow = async (target, size) => {
    const handle = await fs.open(target, 'r+');
    try {
      await handle.truncate(size);
    } finally {
      await handle.close();
    }
  };
  await grow(path.join(f.site, 'manifest.json'), 1024 * 1024 + 1);
  await assert.rejects(verifySite(f.site), /file size failed verification/);
  await f.writeManifest();
  // Sparse file: the inventory still promises only the tiny original asset.
  await grow(path.join(f.site, 'game/app.mjs'), 256 * 1024 * 1024);
  await assert.rejects(verifySite(f.site), /file size failed verification/);
  await fs.writeFile(path.join(f.site, 'game/app.mjs'), f.files.get('game/app.mjs'));
  await grow(f.bridge, 1024 * 1024 + 1);
  await assert.rejects(stageNative({ ...f, platform: 'ios' }), /file size failed verification/);
  assert.equal(await present(f.out), false);
});
test('source/output overlap and existing unowned output are preserved', async (t) => {
  const f = await fixture(t),
    before = await snapshot(f.site);
  for (const out of [f.site, path.join(f.site, 'nested'), f.root])
    await assert.rejects(
      stageNative({ site: f.site, out, platform: 'desktop', replace: true }),
      /separate/,
    );
  await fs.mkdir(f.out);
  await fs.writeFile(path.join(f.out, 'keep.txt'), 'important unrelated file');
  await assert.rejects(stageNative({ ...f, platform: 'desktop' }), /output exists/);
  await assert.rejects(stageNative({ ...f, platform: 'desktop', replace: true }));
  assert.equal(await fs.readFile(path.join(f.out, 'keep.txt'), 'utf8'), 'important unrelated file');
  assert.deepEqual(await snapshot(f.site), before);
});
test('verified owned stages can be replaced explicitly, but tampered or augmented stages cannot', async (t) => {
  const f = await fixture(t);
  await stageNative({ ...f, platform: 'desktop' });
  await assert.rejects(stageNative({ ...f, platform: 'desktop' }), /--replace/);
  const updated = Buffer.from('export const version="updated";');
  await fs.writeFile(path.join(f.site, 'game/app.mjs'), updated);
  const manifest = structuredClone(f.manifest),
    item = manifest.files.find((entry) => entry.path === 'game/app.mjs');
  manifest.totalBytes += updated.length - item.bytes;
  item.bytes = updated.length;
  item.sha256 = hash(updated);
  await f.writeManifest(manifest);
  await stageNative({ ...f, platform: 'desktop', replace: true });
  assert.deepEqual(await fs.readFile(path.join(f.out, 'game/app.mjs')), updated);
  await fs.writeFile(path.join(f.out, 'keep.txt'), 'do not erase');
  const before = await snapshot(f.out);
  await assert.rejects(stageNative({ ...f, platform: 'desktop', replace: true }), /untracked/);
  assert.deepEqual(await snapshot(f.out), before);
  await fs.unlink(path.join(f.out, 'keep.txt'));
  await fs.writeFile(path.join(f.out, 'game/app.mjs'), 'changed outside staging');
  await assert.rejects(stageNative({ ...f, platform: 'desktop', replace: true }), /verification/);
  assert.equal(
    await fs.readFile(path.join(f.out, 'game/app.mjs'), 'utf8'),
    'changed outside staging',
  );
});
test('missing/empty/conflicting iOS bridge and cross-platform replacement preserve existing output', async (t) => {
  const f = await fixture(t);
  await stageNative({ ...f, platform: 'desktop' });
  const before = await snapshot(f.out);
  await assert.rejects(
    stageNative({ ...f, platform: 'ios', replace: true }),
    /different native platform/,
  );
  await assert.rejects(
    stageNative({ site: f.site, out: path.join(f.root, 'ios'), platform: 'ios' }),
    /requires --bridge/,
  );
  await fs.writeFile(f.bridge, '');
  await assert.rejects(
    stageNative({ ...f, out: path.join(f.root, 'ios'), platform: 'ios' }),
    /bridge size/,
  );
  assert.deepEqual(await snapshot(f.out), before);
});
test('all source/bridge/output symbolic links are rejected without creating directories through them', async (t) => {
  const f = await fixture(t),
    outside = path.join(f.root, 'outside');
  await fs.mkdir(outside);
  await fs.writeFile(path.join(outside, 'sentinel'), 'keep');
  const linkedParent = path.join(f.root, 'linked-output');
  await fs.symlink(outside, linkedParent, 'dir');
  await assert.rejects(
    stageNative({ ...f, out: path.join(linkedParent, 'new-parent', 'stage'), platform: 'desktop' }),
    /Symbolic link/,
  );
  assert.deepEqual(await fs.readdir(outside), ['sentinel']);
  const linkedSite = path.join(f.root, 'linked-source');
  await fs.symlink(f.site, linkedSite, 'dir');
  await assert.rejects(
    stageNative({ ...f, site: linkedSite, platform: 'desktop' }),
    /Symbolic link/,
  );
  const linkedBridge = path.join(f.root, 'linked-bridge');
  await fs.symlink(f.bridge, linkedBridge);
  await assert.rejects(
    stageNative({ ...f, bridge: linkedBridge, platform: 'ios' }),
    /Symbolic link/,
  );
  const asset = path.join(f.site, 'game/app.mjs');
  await fs.unlink(asset);
  await fs.symlink(path.join(outside, 'sentinel'), asset);
  await assert.rejects(verifySite(f.site), /Symbolic link/);
  assert.equal(await present(f.out), false);
});
test('native marker version/origin/source identity and untracked symlinks are checked on verification', async (t) => {
  const f = await fixture(t);
  await stageNative({ ...f, platform: 'desktop' });
  const file = path.join(f.out, NATIVE_MARKER),
    marker = JSON.parse(await fs.readFile(file, 'utf8'));
  for (const patch of [
    { version: 'v99' },
    { scheme: 'file' },
    { host: 'elsewhere' },
    { sourceManifestSha256: 'unknown' },
    { manifestSha256: '0'.repeat(64) },
  ]) {
    await fs.writeFile(file, json({ ...marker, ...patch }));
    await assert.rejects(verifySite(f.out, { native: true }));
  }
  await fs.writeFile(file, json(marker));
  await fs.symlink(f.bridge, path.join(f.out, 'untracked-link'));
  await assert.rejects(verifySite(f.out, { native: true }), /Unsupported native file/);
});
test('CLI reports errors without creating output and verifies a valid staged directory', async (t) => {
  const f = await fixture(t);
  const invalid = spawnSync(
    process.execPath,
    [script, 'stage', '--platform', 'desktop', '--site', f.site, '--out'],
    { encoding: 'utf8' },
  );
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /incomplete option/);
  assert.equal(await present(f.out), false);
  const staged = spawnSync(
    process.execPath,
    [script, 'stage', '--platform', 'desktop', '--site', f.site, '--out', f.out],
    { encoding: 'utf8' },
  );
  assert.equal(staged.status, 0, staged.stderr);
  assert.equal(JSON.parse(staged.stdout).platform, 'desktop');
  const verified = spawnSync(process.execPath, [script, 'verify', '--site', f.out], {
    encoding: 'utf8',
  });
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(JSON.parse(verified.stdout).files, f.files.size);
});
