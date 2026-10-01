import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { addOfflineUpdater } from './offline-launcher.mjs';
import { publishOfflineLauncher } from '../publishing/pages-controller/launcher.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const buildId = 'b'.repeat(64);
const sidecars = ['app/update.html', 'app/update.mjs', 'game-update.html', 'game-update.mjs'];
function fixture() {
  const entries = [
    ['game/downloads.html', '<html><body>Shared download screen</body></html>'],
    ['app/index.html', '<html><body>Stable app launcher</body></html>'],
    ['app/app.mjs', 'export {};'],
    ['app/installed-app.mjs', 'export {};'],
    ['app/app.css', 'body{margin:0}'],
    ['app/manifest.webmanifest', '{"id":"./","start_url":"./"}'],
    ['app/current.json', '{"version":"1.2.3","scope":"../"}'],
    ...[180, 192, 512].map((size) => [`app/icon-${size}.png`, 'fixture icon']),
    [
      'app/service-worker.js',
      `const CONFIG = ${JSON.stringify({ id: 'a'.repeat(64), files: [{ path: 'index.html' }] })};`,
    ],
    ['offline-cache.json', JSON.stringify({ buildId, files: [{ path: 'game/downloads.html' }] })],
  ].map(([name, body]) => ({ name, bytes: Buffer.from(body) }));
  const originals = new Map(entries.map((entry) => [entry.name, Buffer.from(entry.bytes)]));
  addOfflineUpdater(entries, { sourceRevision: 'c'.repeat(40) }, buildId);
  return { entries, originals, files: new Map(entries.map((entry) => [entry.name, entry.bytes])) };
}

test('updater documents satisfy the existing script and base CSP without caching their sidecars', () => {
  const { entries, originals, files } = fixture();
  assert.deepEqual(
    entries.slice(originals.size).map((entry) => entry.name),
    sidecars,
  );
  for (const [name, bytes] of originals) assert.deepEqual(files.get(name), bytes, name);
  for (const document of ['app/update.html', 'game-update.html']) {
    const html = files.get(document).toString();
    assert.doesNotMatch(html, /<base\b/i);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 1);
    for (const [, attributes, body] of scripts) {
      assert.equal(body.trim(), '', 'CSP forbids inline bootstrap code.');
      assert.match(attributes, /\btype="module"/);
      const source = /\bsrc="([^"]+)"/.exec(attributes)?.[1];
      assert.ok(source, 'The bootstrap must be external.');
      const url = new URL(source, `https://game.example/revealline/${document}`);
      const bytes = files.get(url.pathname.slice('/revealline/'.length));
      assert.ok(bytes, 'Every external bootstrap is emitted.');
      assert.equal(url.searchParams.get('build'), hash(bytes));
    }
  }
  assert.match(
    files.get('app/update.html').toString(),
    /<link rel="manifest" href="\.\/manifest\.webmanifest">/,
  );
  assert.match(
    files.get('app/update.html').toString(),
    /<link rel="apple-touch-icon" href="\.\/icon-180\.png">/,
  );
});

test('frozen publication binds the candidate and requires every external update dependency', async (t) => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-updater-test-'));
  t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const source = path.join(temp, 'source');
  const { entries, files } = fixture();
  for (const entry of entries) {
    const file = path.join(source, entry.name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, entry.bytes);
  }
  const output = path.join(temp, 'published');
  await publishOfflineLauncher(source, output, 'v1.2.3');
  const html = await fs.readFile(path.join(output, 'app/update.html'), 'utf8');
  const marker = JSON.parse(/name="revealline-update" content='([^']+)'/.exec(html)[1]);
  assert.equal(marker.scope, '../releases/v1.2.3/site/');
  assert.equal(marker.buildId, buildId);
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  for (const file of sidecars.slice(1))
    assert.deepEqual(await fs.readFile(path.join(output, file)), files.get(file));
  for (const [index, file] of sidecars.slice(1).entries()) {
    await fs.unlink(path.join(source, file));
    await assert.rejects(
      publishOfflineLauncher(source, path.join(temp, `missing-${index}`), 'v1.2.3'),
      { code: 'ENOENT' },
      'A supplied updater cannot silently omit a required dependency.',
    );
    await fs.writeFile(path.join(source, file), files.get(file));
  }
});
