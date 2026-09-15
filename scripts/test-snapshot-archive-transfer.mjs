import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { transferSnapshotArchive } from './game-cli.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const failure = (code) => Object.assign(new Error(code), { code });

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'xonix-transfer-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const staging = path.join(directory, 'staging');
  await fs.mkdir(staging);
  const source = path.join(directory, 'source.tar');
  const bytes = Buffer.from([0, 255, 42, 0, 10, 128, 65]);
  await fs.writeFile(source, bytes);
  return { directory, staging, source, bytes, destination: path.join(staging, 'source.tar') };
}

test('same-filesystem transfer preserves the archive inode, bytes and mode without copying', async (t) => {
  const { staging, source, bytes, destination } = await fixture(t);
  await fs.chmod(source, 0o640);
  const before = await fs.stat(source);
  await transferSnapshotArchive(source, staging, {
    copyFile: () => assert.fail('same-filesystem transfer must not copy'),
    unlink: () => assert.fail('rename already removed the source name'),
  });
  const after = await fs.stat(destination);
  assert.equal(after.dev, before.dev);
  assert.equal(after.ino, before.ino);
  assert.equal(after.mode, before.mode);
  assert.deepEqual(await fs.readFile(destination), bytes);
  assert.equal(digest(await fs.readFile(destination)), digest(bytes));
  await assert.rejects(fs.stat(source), { code: 'ENOENT' });
});

test('EXDEV alone falls back to complete copy before unlinking the source', async (t) => {
  const { staging, source, bytes, destination } = await fixture(t);
  const calls = [];
  await transferSnapshotArchive(source, staging, {
    rename: async () => {
      calls.push('rename');
      throw failure('EXDEV');
    },
    copyFile: async (from, to) => {
      calls.push('copy');
      assert.equal(from, source);
      assert.equal(to, destination);
      await fs.copyFile(from, to);
    },
    unlink: async (from) => {
      calls.push('unlink');
      assert.deepEqual(await fs.readFile(destination), bytes);
      assert.deepEqual(await fs.readFile(from), bytes);
      await fs.unlink(from);
    },
  });
  assert.deepEqual(calls, ['rename', 'copy', 'unlink']);
  assert.equal(digest(await fs.readFile(destination)), digest(bytes));
  await assert.rejects(fs.stat(source), { code: 'ENOENT' });
});

test('other rename failures never copy or remove the source', async (t) => {
  const { staging, source, bytes } = await fixture(t);
  const error = failure('EACCES');
  await assert.rejects(
    transferSnapshotArchive(source, staging, {
      rename: async () => {
        throw error;
      },
      copyFile: () => assert.fail('only EXDEV may copy'),
      unlink: () => assert.fail('the source must remain'),
    }),
    (actual) => actual === error,
  );
  assert.deepEqual(await fs.readFile(source), bytes);
  assert.deepEqual(await fs.readdir(staging), []);
});

test('a failed partial fallback copy is removed and leaves the source intact', async (t) => {
  const { staging, source, bytes } = await fixture(t);
  const error = failure('ENOSPC');
  await assert.rejects(
    transferSnapshotArchive(source, staging, {
      rename: async () => {
        throw failure('EXDEV');
      },
      copyFile: async (_from, to) => {
        await fs.writeFile(to, bytes.subarray(0, 2));
        throw error;
      },
      unlink: () => assert.fail('incomplete copy must never remove source'),
    }),
    (actual) => actual === error,
  );
  assert.deepEqual(await fs.readFile(source), bytes);
  assert.deepEqual(await fs.readdir(staging), []);
});

test('a failed fallback unlink refuses completion and cleans its copied destination', async (t) => {
  const { staging, source, bytes, destination } = await fixture(t);
  const error = failure('EACCES');
  await assert.rejects(
    transferSnapshotArchive(source, staging, {
      rename: async () => {
        throw failure('EXDEV');
      },
      unlink: async () => {
        assert.deepEqual(await fs.readFile(destination), bytes);
        throw error;
      },
    }),
    (actual) => actual === error,
  );
  assert.deepEqual(await fs.readFile(source), bytes);
  assert.deepEqual(await fs.readdir(staging), []);
});

for (const kind of ['file', 'symlink']) {
  test(`an existing destination ${kind} is refused without overwriting outside staging`, async (t) => {
    const { directory, staging, source, bytes, destination } = await fixture(t);
    const outside = path.join(directory, 'keep.txt');
    await fs.writeFile(outside, 'keep');
    if (kind === 'file') await fs.writeFile(destination, 'existing');
    else await fs.symlink(outside, destination);
    await assert.rejects(
      transferSnapshotArchive(source, staging, {
        rename: () => assert.fail('reservation must fail before transfer'),
        copyFile: () => assert.fail('reservation must fail before copying'),
      }),
      { code: 'EEXIST' },
    );
    assert.deepEqual(await fs.readFile(source), bytes);
    assert.equal(await fs.readFile(outside, 'utf8'), 'keep');
    if (kind === 'file') assert.equal(await fs.readFile(destination, 'utf8'), 'existing');
    else assert.equal(await fs.readlink(destination), outside);
  });
}
