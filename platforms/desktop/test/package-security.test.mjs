import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import {
  PACKAGED_FUSES,
  hardenPackage,
  packagedExecutable,
  readMacIcon,
} from '../package-security.mjs';
import { fakeFuseAPI } from './helpers/fuse-api.mjs';

test('packaged fuses disable executable injection and file privileges while preserving directory loading', async () => {
  const api = fakeFuseAPI();
  const result = await hardenPackage('/tmp/app', { api, platform: 'darwin' });
  assert.deepEqual(result, PACKAGED_FUSES);
  for (const name of [
    'RunAsNode',
    'EnableNodeOptionsEnvironmentVariable',
    'EnableNodeCliInspectArguments',
    'GrantFileProtocolExtraPrivileges',
  ])
    assert.equal(result[name], false);
  assert.equal(result.OnlyLoadAppFromAsar, false);
  assert.equal(result.EnableEmbeddedAsarIntegrityValidation, false);
  assert.equal(api.calls.length, 1);
  assert.equal(api.calls[0].target, path.join('/tmp/app', 'Reveal Line.app'));
  assert.equal(api.calls[0].config.strictlyRequireAllFuses, true);
  assert.equal(api.calls[0].config.resetAdHocDarwinSignature, true);
});

test('fuse readback mismatch blocks packaging even if flipping reported success', async () => {
  const api = fakeFuseAPI();
  api.getCurrentFuseWire = async () => ({ version: '1', 0: 49 });
  await assert.rejects(
    hardenPackage('/tmp/app', { api, platform: 'linux' }),
    /did not verify: RunAsNode/,
  );
  assert.equal(api.calls[0].config.resetAdHocDarwinSignature, false);
});

test('an unsupported fuse API fails before modifying a binary', async () => {
  const api = fakeFuseAPI();
  delete api.FuseV1Options.GrantFileProtocolExtraPrivileges;
  await assert.rejects(hardenPackage('/tmp/app', { api }), /does not support/);
  assert.equal(api.calls.length, 0);
});

test('packaged binary selection is host explicit and refuses unsupported platforms', () => {
  assert.equal(packagedExecutable('/tmp/app', 'linux'), path.join('/tmp/app', 'Reveal Line'));
  assert.equal(packagedExecutable('/tmp/app', 'win32'), path.join('/tmp/app', 'Reveal Line.exe'));
  assert.throws(() => packagedExecutable('/tmp/app', 'unknown'), /Unsupported/);
});

async function iconFixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-icon-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'assets'));
  // Synthetic metadata fixture; actual image decoding is a separate native test.
  const bytes = Buffer.alloc(17);
  bytes.write('icns');
  bytes.writeUInt32BE(17, 4);
  bytes.write('icp4', 8);
  bytes.writeUInt32BE(9, 12);
  const filename = path.join(directory, 'assets/revealline.icns');
  await fs.writeFile(filename, bytes);
  return { directory, bytes, filename };
}

test('known icon source has bounded ICNS metadata and an owned immutable packaging buffer', async (t) => {
  const fixture = await iconFixture(t);
  const icon = await readMacIcon(fixture.directory);
  assert.equal(icon.source, 'assets/revealline.icns');
  assert.match(icon.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(icon.bytes, fixture.bytes);
  await fs.writeFile(fixture.filename, Buffer.alloc(0));
  assert.deepEqual(icon.bytes, fixture.bytes);
});

test('missing, oversized and broken icon containers fail with a useful packaging error', async (t) => {
  const fixture = await iconFixture(t);
  for (const bytes of [
    Buffer.from('not an icon container'),
    Buffer.alloc(8 * 1024 * 1024 + 1),
    fixture.bytes.subarray(0, 16),
  ]) {
    await fs.writeFile(fixture.filename, bytes);
    await assert.rejects(readMacIcon(fixture.directory), /valid assets\/revealline.icns/);
  }
  await fs.unlink(fixture.filename);
  await assert.rejects(readMacIcon(fixture.directory), /valid assets\/revealline.icns/);
});

test('icon files and their containing assets directory cannot be symbolic links', async (t) => {
  const fixture = await iconFixture(t);
  const outside = path.join(fixture.directory, 'original.icns');
  await fs.rename(fixture.filename, outside);
  await fs.symlink(outside, fixture.filename);
  await assert.rejects(readMacIcon(fixture.directory), /regular/);
  await fs.unlink(fixture.filename);
  await fs.rename(outside, fixture.filename);
  const real = path.join(fixture.directory, 'real-assets');
  await fs.rename(path.join(fixture.directory, 'assets'), real);
  await fs.symlink(real, path.join(fixture.directory, 'assets'), 'dir');
  await assert.rejects(readMacIcon(fixture.directory), /regular/);
});
