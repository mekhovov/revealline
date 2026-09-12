import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { packageDesktop } from '../package.mjs';
import { NATIVE_MARKER, NATIVE_FORMAT } from '../policy.mjs';
import { fakeFuseAPI } from './helpers/fuse-api.mjs';

async function fixture(t) {
  const directory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-package-test-')),
  );
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'site/game'), { recursive: true });
  // Only a synthetic ICNS container for policy tests; no native decoding claim.
  const icon = Buffer.alloc(17);
  icon.write('icns');
  icon.writeUInt32BE(17, 4);
  icon.write('icp4', 8);
  icon.writeUInt32BE(9, 12);
  await fs.mkdir(path.join(directory, 'assets'));
  await fs.writeFile(path.join(directory, 'assets/revealline.icns'), icon);
  const html = '<h1>Game</h1>';
  await fs.writeFile(path.join(directory, 'site/game/index.html'), html);
  const manifest = {
    formatVersion: 1,
    version: 'v0.3.0',
    sourceRevision: 'a'.repeat(40),
    entry: 'game/index.html',
    totalBytes: Buffer.byteLength(html),
    files: [
      {
        path: 'game/index.html',
        bytes: Buffer.byteLength(html),
        sha256: createHash('sha256').update(html).digest('hex'),
      },
    ],
  };
  const bytes = JSON.stringify(manifest),
    sha = createHash('sha256').update(bytes).digest('hex');
  await fs.writeFile(path.join(directory, 'site/manifest.json'), bytes);
  await fs.writeFile(
    path.join(directory, 'site', NATIVE_MARKER),
    JSON.stringify({
      format: NATIVE_FORMAT,
      platform: 'desktop',
      scheme: 'revealline',
      host: 'app',
      entry: manifest.entry,
      version: manifest.version,
      manifestSha256: sha,
    }),
  );
  for (const name of ['main.mjs', 'policy.mjs', 'resources.mjs'])
    await fs.writeFile(path.join(directory, name), `// ${name}`);
  await fs.writeFile(path.join(directory, 'private-notes.txt'), 'Do not package');
  const info = {
    name: 'revealline-desktop',
    productName: 'Reveal Line',
    version: '0.3.0',
    description: 'Game shell',
    devDependencies: { electron: '44.3.0', '@electron/packager': '20.3.0' },
  };
  await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(info));
  return { directory, sha, info };
}

test('packaging copies only runtime plus verified site, pins the host engine and never overwrites output', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const implementation = async (options) => {
    calls++;
    assert.deepEqual((await fs.readdir(options.dir)).sort(), [
      'main.mjs',
      'package.json',
      'policy.mjs',
      'resources.mjs',
      'site',
    ]);
    const info = JSON.parse(await fs.readFile(path.join(options.dir, 'package.json'), 'utf8'));
    assert.equal(info.version, '0.3.0');
    assert.equal(info.devDependencies, undefined);
    assert.equal(options.electronVersion, '44.3.0');
    assert.equal(options.platform, process.platform);
    assert.equal(options.arch, process.arch);
    assert.equal(options.overwrite, false);
    assert.equal(options.asar, false);
    if (process.platform === 'darwin') {
      assert.equal(path.basename(options.icon), 'revealline.icns');
      assert.equal(path.dirname(options.icon), path.dirname(options.dir));
      assert.deepEqual(
        await fs.readFile(options.icon),
        await fs.readFile(path.join(f.directory, 'assets/revealline.icns')),
      );
    } else assert.equal(options.icon, undefined);
    await fs.mkdir(path.join(options.out, 'Reveal Line-test'), { recursive: true });
    await fs.writeFile(path.join(options.out, 'Reveal Line-test', 'host-bundle'), 'original');
  };
  const result = await packageDesktop({
    directory: f.directory,
    packagerImplementation: implementation,
    fuseAPI: fakeFuseAPI(),
  });
  assert.equal(result.manifestSha256, f.sha);
  assert.equal(result.signed, false);
  assert.equal(result.notarized, false);
  assert.equal(result.sourceManifestSha256, f.sha);
  assert.equal(result.sourceRevision, 'a'.repeat(40));
  assert.equal(result.label, 'v0.3.0');
  assert.equal(result.fuses.RunAsNode, false);
  assert.deepEqual(await fs.readdir(path.join(f.directory, 'out')), ['v0.3.0']);
  assert.equal(
    await fs.readFile(path.join(result.out, 'Reveal Line-test/host-bundle'), 'utf8'),
    'original',
  );
  await assert.rejects(
    packageDesktop({ directory: f.directory, packagerImplementation: implementation }),
    /not be overwritten/,
  );
  assert.equal(calls, 1);
});

test('candidate labels keep a separate immutable artifact and invalid labels cannot escape output', async (t) => {
  const f = await fixture(t);
  const implementation = async (options) => {
    await fs.mkdir(path.join(options.out, 'Reveal Line-test'), { recursive: true });
  };
  const result = await packageDesktop({
    directory: f.directory,
    label: 'v0.3.0-candidate-01',
    packagerImplementation: implementation,
    fuseAPI: fakeFuseAPI(),
  });
  assert.equal(result.version, '0.3.0');
  assert.equal(result.label, 'v0.3.0-candidate-01');
  assert.equal(result.out, path.join(f.directory, 'out/v0.3.0-candidate-01'));
  for (const label of ['../v0.3.0', 'v0.3.0/other', 'v0.3.0-', 'v0.3.0..x', 'v0.3.0-x'.repeat(30)])
    await assert.rejects(packageDesktop({ directory: f.directory, label }), /safe version/);
  assert.deepEqual(await fs.readdir(path.join(f.directory, 'out')), ['v0.3.0-candidate-01']);
});

test('fuse failure prevents publishing output and clears only owned staging files', async (t) => {
  const f = await fixture(t);
  const implementation = async (options) => {
    await fs.mkdir(path.join(options.out, 'Reveal Line-test'), { recursive: true });
  };
  const api = fakeFuseAPI();
  api.getCurrentFuseWire = async () => ({ version: '1', 0: 49 });
  await assert.rejects(
    packageDesktop({
      directory: f.directory,
      packagerImplementation: implementation,
      fuseAPI: api,
    }),
    /did not verify/,
  );
  assert.deepEqual(await fs.readdir(path.join(f.directory, 'out')), []);
  assert.equal(
    await fs.readFile(path.join(f.directory, 'private-notes.txt'), 'utf8'),
    'Do not package',
  );
});

test('version mismatch or changed site refuses packaging before any packager work', async (t) => {
  const f = await fixture(t);
  const implementation = async () => assert.fail('Packager must not be invoked.');
  await fs.writeFile(
    path.join(f.directory, 'package.json'),
    JSON.stringify({ ...f.info, version: '0.3.1' }),
  );
  await assert.rejects(
    packageDesktop({ directory: f.directory, packagerImplementation: implementation }),
    /version must match/,
  );
  await fs.writeFile(path.join(f.directory, 'package.json'), JSON.stringify(f.info));
  await fs.writeFile(path.join(f.directory, 'site/game/index.html'), 'replacement');
  await assert.rejects(
    packageDesktop({ directory: f.directory, packagerImplementation: implementation }),
    /checksum/,
  );
});
