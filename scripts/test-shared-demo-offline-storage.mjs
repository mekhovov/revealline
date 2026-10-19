import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { offlineStoragePolicy, createLocalOfflineSession } from './shared-demo-offline-storage.mjs';

const MiB = 1024 ** 2;

test('full audited installation determines rounded body cap and conservative local reserve', () => {
  const policy = offlineStoragePolicy(527000001);
  assert(policy.installedBodyCapBytes >= 527000001 + 64 * MiB);
  assert(policy.installedBodyCapBytes < 527000001 + 80 * MiB);
  assert.equal(policy.installedBodyCapBytes % (16 * MiB), 0);
  assert.equal(policy.profileReservationBytes, 3 * policy.installedBodyCapBytes + 256 * MiB);
  assert.equal(policy.minimumFreeBeforeBytes, policy.profileReservationBytes + 512 * MiB);
  for (const bytes of [0, -1, Infinity, NaN, 0.5, Number.MAX_SAFE_INTEGER, 1024 * MiB])
    assert.throws(() => offlineStoragePolicy(bytes));
});

async function temporary(t) {
  const parent = await mkdtemp(path.join(tmpdir(), 'offline-storage-test-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  return parent;
}

test('fresh local session removes only its own verified private tree', async (t) => {
  const parent = await temporary(t);
  const sibling = path.join(parent, 'keep.txt');
  await writeFile(sibling, 'untouched');
  const session = await createLocalOfflineSession(parent);
  assert.equal(await session.verify(), true);
  assert.equal((await lstat(session.session)).mode & 0o077, 0);
  await writeFile(path.join(session.tmp, 'owned'), 'browser temporary data');
  await session.remove();
  await assert.rejects(lstat(session.session), { code: 'ENOENT' });
  assert.equal(await readFile(sibling, 'utf8'), 'untouched');
});

test('a replacement session or symlink is refused before recursive cleanup', async (t) => {
  const parent = await temporary(t);
  const session = await createLocalOfflineSession(parent);
  await rename(session.session, `${session.session}-original`);
  await mkdir(session.session);
  const marker = path.join(session.session, 'keep.txt');
  await writeFile(marker, 'replacement');
  await assert.rejects(session.remove(), /identity changed/);
  assert.equal(await readFile(marker, 'utf8'), 'replacement');
  await rm(session.session, { recursive: true });
  await symlink(`${session.session}-original`, session.session, 'dir');
  await assert.rejects(session.remove(), /ordinary owned directory/);
  assert.equal((await lstat(`${session.session}-original`)).isDirectory(), true);
});

test('the browser qualifier rejects unsafe invocation before creating a profile', async (t) => {
  const parent = await temporary(t);
  const env = { ...process.env, TMPDIR: parent };
  delete env.SHARED_DEMO_BROWSER_SUPERVISED;
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./qualify-shared-demo-offline-browser.mjs', import.meta.url))],
    { env, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Use the bounded owned-process browser supervisor/);
  const malformed = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL('./qualify-shared-demo-offline-browser.mjs', import.meta.url)),
      '--head=' + 'a'.repeat(40),
      '--fingerprint=' + 'b'.repeat(64),
      '--audit=unused.json',
      '--emitted-preview=unused',
      '--runtime=unused',
      '--executable=unused',
      `--report=${path.join(parent, 'report.txt')}`,
    ],
    {
      env: { ...env, SHARED_DEMO_BROWSER_SUPERVISED: '1' },
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    },
  );
  assert.equal(malformed.error, undefined);
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /qualification report must use a .json path/);
  assert.deepEqual(await readdir(parent), []);
});
