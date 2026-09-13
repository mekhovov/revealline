import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { buildProject, PUBLIC_SECURITY_HEADERS } from '../../scripts/game-cli.mjs';
import { iosHTMLPolicy, IOS_CSP } from '../../scripts/native-cli.mjs';

const sourceRoot = new URL('../', import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('the actual game has a static dark guard before resources and a single caught module entry', async () => {
  const html = await fs.readFile(new URL('index.html', sourceRoot), 'utf8');
  assert.match(html, /<html\b[^>]*data-boot-state="loading"/);
  const firstStyle = html.indexOf('<style>');
  const firstResource = html.search(/<(?:link|script)\b/);
  assert.ok(firstStyle > 0 && firstStyle < firstResource);
  assert.match(
    html.slice(firstStyle, html.indexOf('</style>', firstStyle)),
    /body\s*>\s*:not\(#boot-screen\):not\(script\)[\s\S]*?display:\s*none\s*!important/,
  );
  assert.match(html, /<section\b[^>]*id="boot-screen"/);
  assert.match(html, /<noscript\s*>[\s\S]*?JavaScript is disabled/);
  assert.match(html, /<script src="boot.mjs"><\/script>/);
  assert.match(html, /<script id="boot-phaser" src="vendor\/phaser-4.2.1.min.js"><\/script>/);
  assert.doesNotMatch(html, /<script\b[^>]*src="app.mjs"/);
  assert.equal([...html.matchAll(/id="boot-status"/g)].length, 1);
  assert.ok(
    html.indexOf('src="boot.mjs"') < html.indexOf('href="style.css"'),
    'resource failures can be observed before app styles load',
  );
});

test('native wrapper CSP precedes bootstrap and permits the existing external-script/inline-style design', async () => {
  const original = await fs.readFile(new URL('index.html', sourceRoot));
  const transformed = iosHTMLPolicy(original);
  const html = transformed.toString();
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('src="boot.mjs"'));
  assert.match(IOS_CSP, /script-src 'self';/);
  assert.match(
    PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
    /style-src 'self' 'unsafe-inline';/,
  );
  assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/);
  assert.deepEqual(iosHTMLPolicy(transformed), transformed);
  assert.match(html, /src="boot.mjs"/);
  assert.match(html, /href="boot.css"/);
});

test('build rewrites native root paths, preserves extras and includes boot bytes in reproducible offline inventory', async (t) => {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-boot-build-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'source');
  const put = async (name, bytes) => {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), bytes);
  };
  const copy = async (name) => put(name, await fs.readFile(new URL(`../${name}`, sourceRoot)));
  // The HTML, boot code, landing and offline generator inputs are actual source.
  // Unrelated gameplay dependencies are inert fixture resources, not a claim
  // that this small build runs the simulation or a native device.
  await copy('game/index.html');
  for (const name of [
    'game/boot.mjs',
    'game/boot.css',
    'game/ui/fonts/pixelify-sans/PixelifySans.ttf',
    'game/offline.mjs',
    'game/platform.mjs',
    'game/offline/service-worker.template.js',
    'site/index.html',
    'site/about.html',
    'site/launch.mjs',
    'site/landing.mjs',
    'site/release-links.mjs',
    'site/landing.css',
  ])
    await copy(name);
  const html = await fs.readFile(path.join(root, 'game/index.html'), 'utf8');
  for (const [, relative] of html.matchAll(/<link[^>]*href="([^"]+\.css)"/g))
    if (relative !== 'boot.css') await put(`game/${relative}`, '/* unrelated fixture style */');
  await put('game/vendor/phaser-4.2.1.min.js', 'globalThis.Phaser = {};');
  await put('game/app.mjs', 'export {};');
  await put('game/content-launch.mjs', 'export {};');
  await put(
    'game/build-config.json',
    JSON.stringify({ version: '0.29.0', entry: 'game/index.html', include: ['game', 'site'] }),
  );
  const out = path.join(directory, 'build');
  const first = await buildProject({ root, out });
  const second = await buildProject({ root, out: path.join(directory, 'second') });
  assert.equal(first.sha256, second.sha256);
  const landing = await fs.readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(landing, /href="\.\/game\/boot.css"/);
  assert.match(landing, /src="\.\/site\/launch.mjs"/);
  assert.match(landing, /id="launch-game"[^>]*href="\.\/game\/"/);
  assert.doesNotMatch(landing, /__REVEALLINE_VERSION__|landing-pack-select/);
  const extras = await fs.readFile(path.join(out, 'site/about.html'), 'utf8');
  assert.match(extras, /data-current-version="v0.29.0"/);
  assert.match(extras, /href="\.\.\/game\//);
  const cache = JSON.parse(await fs.readFile(path.join(out, 'offline-cache.json'), 'utf8'));
  for (const name of [
    'index.html',
    'game/index.html',
    'game/boot.mjs',
    'game/boot.css',
    'site/launch.mjs',
    'site/about.html',
  ]) {
    const record = cache.files.find(({ path }) => path === name);
    assert.ok(record, `${name} must remain available offline`);
    const bytes = await fs.readFile(path.join(out, name));
    assert.equal(record.bytes, bytes.length);
    assert.equal(record.sha256, digest(bytes));
  }
});
