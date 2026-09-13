import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  copyPlayableSite,
  publishedReleaseIndex,
  pagesBytes,
  buildPages,
} from '../../scripts/build-pages.mjs';
import { execFileSync } from 'node:child_process';

test('Pages retains every runtime byte and license while moving only redundant root ZIPs', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-delivery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source'),
    target = path.join(root, 'published');
  await fs.mkdir(path.join(source, 'game'), { recursive: true });
  const files = {
    'game/app.mjs': 'original game source',
    'game/distribution.zip': 'ordinary nested asset',
    'manifest.json': '{"version":"v0.26.0"}',
    'OFL.txt': 'font license',
    'distribution.zip': 'duplicate runtime',
    'distribution.zip.sha256': 'duplicate checksum',
  };
  for (const [name, bytes] of Object.entries(files))
    await fs.writeFile(path.join(source, name), bytes);
  await copyPlayableSite(source, target);
  let expectedBytes = 0;
  for (const [name, bytes] of Object.entries(files)) {
    if (name.startsWith('distribution.zip'))
      await assert.rejects(fs.access(path.join(target, name)), { code: 'ENOENT' });
    else {
      assert.equal(await fs.readFile(path.join(target, name), 'utf8'), bytes);
      expectedBytes += Buffer.byteLength(bytes);
    }
    assert.equal(await fs.readFile(path.join(source, name), 'utf8'), bytes);
  }
  assert.equal(await pagesBytes(target), expectedBytes);
  await fs.symlink(path.join(source, 'OFL.txt'), path.join(target, 'unsafe-link'));
  await assert.rejects(pagesBytes(target), /symbolic links/);
});

test('published version index keeps immutable play URLs and explicit GitHub ZIP downloads', () => {
  const records = ['v0.9.0', 'v0.26.0'].map((version) => ({
    version,
    sourceRevision: 'abc123',
    play: `${version}/site/game/`,
    download: `${version}/site/distribution.zip`,
  }));
  const result = publishedReleaseIndex(records, 'mekhovov/revealline', 'v0.26.0');
  assert.equal(result.json.releases[0].version, 'v0.26.0');
  assert.equal(result.json.releases[0].play, 'v0.26.0/site/game/');
  assert.equal(
    result.json.releases[0].download,
    'https://github.com/mekhovov/revealline/releases/download/v0.26.0/distribution.zip',
  );
  assert.equal(records[1].download, 'v0.26.0/site/distribution.zip');
  assert.throws(() => publishedReleaseIndex(records, 'invalid/<repo>', 'v0.26.0'), /Invalid/);
});

test('Pages refuses untagged work and a stale archive before replacing a working site', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pages-tag-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', args, { cwd: root, stdio: 'pipe' }).toString().trim();
  git('init');
  git('config', 'user.name', 'Pages test');
  git('config', 'user.email', 'pages@example.test');
  await fs.writeFile(path.join(root, 'package.json'), '{"version":"0.26.0"}');
  git('add', 'package.json');
  git('commit', '-m', 'test');
  await fs.mkdir(path.join(root, 'dist'));
  await fs.writeFile(path.join(root, 'dist', 'index.html'), 'working edition');
  await assert.rejects(buildPages({ projectRoot: root }), /Freeze and tag/);
  git('tag', 'v0.26.0');
  await fs.mkdir(path.join(root, 'releases', 'v0.26.0'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'releases', 'v0.26.0', 'release.json'),
    JSON.stringify({ version: 'v0.26.0', sourceRevision: 'wrong' }),
  );
  await assert.rejects(buildPages({ projectRoot: root }), /does not match/);
  assert.equal(await fs.readFile(path.join(root, 'dist', 'index.html'), 'utf8'), 'working edition');
});
