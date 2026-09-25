import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  RECOVERY_FORMAT,
  createRecoverySnapshot,
  restoreRecoverySnapshot,
  verifyRecoverySnapshot,
} from '../src/recovery.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

const fixture = async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'revealline-community-recovery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const blobRoot = path.join(root, 'live-blobs');
  const bytes = Buffer.from('immutable rlpack fixture');
  const sha256 = digest(bytes);
  const key = `packages/sha256/${sha256.slice(0, 2)}/${sha256}.rlpack`;
  await mkdir(path.dirname(path.join(blobRoot, key)), { recursive: true });
  await writeFile(path.join(blobRoot, key), bytes);
  return { root, blobRoot, bytes, sha256, key };
};

const backupCommand = (databaseBytes, calls) => async (command, args) => {
  calls.push({ command, args });
  assert.equal(command, 'pg_dump');
  const output = args[args.indexOf('--file') + 1];
  await writeFile(output, databaseBytes);
};

test('offline backup writes a canonical, content-verified database/blob snapshot', async (t) => {
  const { root, blobRoot, bytes, sha256, key } = await fixture(t);
  const destination = path.join(root, 'snapshot');
  const databaseBytes = Buffer.from('postgres custom-format fixture');
  const calls = [];
  const created = await createRecoverySnapshot({
    databaseUrl: 'postgres://backup.example/revealline',
    blobRoot,
    destination,
    runCommand: backupCommand(databaseBytes, calls),
  });
  assert.equal(created.format, RECOVERY_FORMAT);
  assert.match(created.snapshotId, /^snapshot_[a-f0-9]{64}$/u);
  assert.deepEqual(created.blobs, [{ key, size: bytes.length, sha256 }]);
  assert.equal(created.database.sha256, digest(databaseBytes));
  assert.equal(calls[0].command, 'pg_dump');
  assert.deepEqual(calls[0].args.slice(0, 4), [
    '--format=custom',
    '--no-owner',
    '--no-acl',
    '--file',
  ]);
  assert.match(calls[0].args[4], /snapshot\.partial-[^/]+\/database\.dump$/u);
  assert.equal(calls[0].args[5], 'postgres://backup.example/revealline');
  assert.equal(
    await readFile(path.join(destination, 'blobs', key), 'utf8'),
    bytes.toString('utf8'),
  );
  assert.deepEqual(await verifyRecoverySnapshot({ source: destination }), created);
});

test('restore verifies all bytes before replacing an empty blob root', async (t) => {
  const { root, blobRoot, bytes, key } = await fixture(t);
  const snapshot = path.join(root, 'snapshot');
  await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobRoot,
    destination: snapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });
  const restoredBlobs = path.join(root, 'restored-blobs');
  await mkdir(restoredBlobs);
  const calls = [];
  const restored = await restoreRecoverySnapshot({
    databaseUrl: 'postgres://target/revealline',
    blobRoot: restoredBlobs,
    source: snapshot,
    runCommand: async (command, args) => calls.push({ command, args }),
  });
  assert.equal(restored.format, RECOVERY_FORMAT);
  assert.equal(await readFile(path.join(restoredBlobs, key), 'utf8'), bytes.toString('utf8'));
  assert.deepEqual(calls, [
    {
      command: 'pg_restore',
      args: [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-acl',
        '--exit-on-error',
        '--dbname',
        'postgres://target/revealline',
        path.join(snapshot, 'database.dump'),
      ],
    },
  ]);
});

test('verification rejects changed package bytes and restore refuses a non-empty target', async (t) => {
  const { root, blobRoot, key } = await fixture(t);
  const snapshot = path.join(root, 'snapshot');
  await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobRoot,
    destination: snapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });
  await writeFile(path.join(snapshot, 'blobs', key), 'changed');
  await assert.rejects(
    verifyRecoverySnapshot({ source: snapshot }),
    /content-addressed key|inventory/u,
  );

  const cleanSnapshot = path.join(root, 'clean-snapshot');
  await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobRoot,
    destination: cleanSnapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });
  const occupied = path.join(root, 'occupied');
  await mkdir(occupied);
  await writeFile(path.join(occupied, 'keep'), 'existing');
  await assert.rejects(
    restoreRecoverySnapshot({
      databaseUrl: 'postgres://target/revealline',
      blobRoot: occupied,
      source: cleanSnapshot,
      runCommand: async () => {},
    }),
    /must be empty/u,
  );
});

test('failed database restore retains a resumable journal without publishing package files', async (t) => {
  const { root, blobRoot, bytes, key } = await fixture(t);
  const snapshot = path.join(root, 'snapshot');
  await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobRoot,
    destination: snapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });
  const restoredBlobs = path.join(root, 'failed-restore');
  await assert.rejects(
    restoreRecoverySnapshot({
      databaseUrl: 'postgres://target/revealline',
      blobRoot: restoredBlobs,
      source: snapshot,
      runCommand: async () => {
        throw new Error('pg_restore failed');
      },
    }),
    /pg_restore failed/u,
  );
  await assert.rejects(access(restoredBlobs), /ENOENT/u);
  const journal = JSON.parse(await readFile(`${restoredBlobs}.restore-journal.json`, 'utf8'));
  assert.equal(journal.state, 'blobs-staged');
  assert.match(journal.databaseTargetHash, /^[a-f0-9]{64}$/u);

  await assert.rejects(
    restoreRecoverySnapshot({
      databaseUrl: 'postgres://different-target/revealline',
      blobRoot: restoredBlobs,
      source: snapshot,
      runCommand: async () => {
        throw new Error('must not reach a different database');
      },
    }),
    /journal does not match/u,
  );

  let retries = 0;
  await restoreRecoverySnapshot({
    databaseUrl: 'postgres://target/revealline',
    blobRoot: restoredBlobs,
    source: snapshot,
    runCommand: async () => {
      retries += 1;
    },
  });
  assert.equal(retries, 1);
  assert.equal(await readFile(path.join(restoredBlobs, key), 'utf8'), bytes.toString('utf8'));
  await assert.rejects(access(`${restoredBlobs}.restore-journal.json`), /ENOENT/u);
});
