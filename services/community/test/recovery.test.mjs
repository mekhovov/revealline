import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MemoryBlobStore } from '../src/blob-store.mjs';
import {
  RECOVERY_FORMAT,
  createRecoverySnapshot,
  restoreRecoverySnapshot,
  restoreRecoverySnapshotToStore,
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

const backupCommand = (databaseBytes, calls) => async (command, args, options) => {
  calls.push({ command, args, options });
  assert.equal(command, 'pg_dump');
  const output = args[args.indexOf('--file') + 1];
  await writeFile(output, databaseBytes);
};

const trackedBody = (bytes) => ({
  destroyed: false,
  destroy() {
    this.destroyed = true;
  },
  async *[Symbol.asyncIterator]() {
    yield bytes;
  },
});

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
  assert.equal(calls[0].args.length, 5);
  assert.equal(calls[0].options.databaseUrl, 'postgres://backup.example/revealline');
  assert.equal(
    await readFile(path.join(destination, 'blobs', key), 'utf8'),
    bytes.toString('utf8'),
  );
  assert.deepEqual(await verifyRecoverySnapshot({ source: destination }), created);
});

test('store backup rejects unexpected package keys and bytes that change after listing', async (t) => {
  const { root, bytes, sha256, key } = await fixture(t);
  const databaseBytes = Buffer.from('database');
  await assert.rejects(
    createRecoverySnapshot({
      databaseUrl: 'postgres://source/revealline',
      blobStore: {
        async list() {
          return {
            items: [{ key: 'packages/sha256/not-a-package', size: 10 }],
            cursor: null,
          };
        },
        async open() {
          assert.fail('invalid keys must fail before download');
        },
      },
      destination: path.join(root, 'invalid-key-snapshot'),
      runCommand: backupCommand(databaseBytes, []),
    }),
    /Unexpected community blob key/u,
  );
  await assert.rejects(
    createRecoverySnapshot({
      databaseUrl: 'postgres://source/revealline',
      blobStore: {
        async list() {
          return { items: [{ key, size: bytes.length }], cursor: null };
        },
        async open() {
          return { key, size: bytes.length, body: [Buffer.from('changed package bytes')] };
        },
      },
      destination: path.join(root, 'changed-byte-snapshot'),
      runCommand: backupCommand(databaseBytes, []),
    }),
    /changed during recovery backup/u,
  );
});

test('store backup destroys opened bodies on metadata and local target failures', async (t) => {
  const { root, bytes, key } = await fixture(t);
  const databaseBytes = Buffer.from('database');
  const metadataBody = trackedBody(bytes);
  await assert.rejects(
    createRecoverySnapshot({
      databaseUrl: 'postgres://source/revealline',
      blobStore: {
        async list() {
          return { items: [{ key, size: bytes.length }], cursor: null };
        },
        async open() {
          return { key, size: bytes.length + 1, body: metadataBody };
        },
      },
      destination: path.join(root, 'metadata-failure-snapshot'),
      runCommand: backupCommand(databaseBytes, []),
    }),
    /disappeared or changed/u,
  );
  assert.equal(metadataBody.destroyed, true);

  const localFailureBody = trackedBody(bytes);
  await assert.rejects(
    createRecoverySnapshot({
      databaseUrl: 'postgres://source/revealline',
      blobStore: {
        async list() {
          return { items: [{ key, size: bytes.length }], cursor: null };
        },
        async open() {
          return { key, size: bytes.length, body: localFailureBody };
        },
      },
      destination: path.join(root, 'local-failure-snapshot'),
      runCommand: backupCommand(databaseBytes, []),
      openBlobTarget: async () => {
        throw new Error('local target open failed');
      },
    }),
    /local target open failed/u,
  );
  assert.equal(localFailureBody.destroyed, true);
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
  const targetDatabaseUrl = 'postgresql://restore-user:restore-secret@target.example/reveal%2Fline';
  const restored = await restoreRecoverySnapshot({
    databaseUrl: targetDatabaseUrl,
    blobRoot: restoredBlobs,
    source: snapshot,
    runCommand: async (command, args, options) => calls.push({ command, args, options }),
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
        'reveal/line',
        path.join(snapshot, 'database.dump'),
      ],
      options: { databaseUrl: targetDatabaseUrl },
    },
    {
      command: 'psql',
      args: [
        '--no-psqlrc',
        '--set=ON_ERROR_STOP=1',
        '--command',
        'DELETE FROM public.community_tus_uploads;',
      ],
      options: { databaseUrl: targetDatabaseUrl },
    },
  ]);
  assert.equal(calls.flatMap(({ args }) => args).includes('--exclude-table-data'), false);
  assert.equal(calls.flatMap(({ args }) => args).includes(targetDatabaseUrl), false);
  assert.equal(
    calls.flatMap(({ args }) => args).some((arg) => arg.includes('restore-secret')),
    false,
  );
});

test('store backup and restore stream exact packages and resume after a partial target write', async (t) => {
  const { root, bytes, sha256, key } = await fixture(t);
  const sourceStore = new MemoryBlobStore();
  await sourceStore.putVerified({
    key,
    body: [bytes],
    expectedSha256: sha256,
    expectedSize: bytes.length,
    maxBytes: 1024,
  });
  const secondBytes = Buffer.from('second immutable package');
  const secondSha256 = digest(secondBytes);
  const secondKey = `packages/sha256/${secondSha256.slice(0, 2)}/${secondSha256}.rlpack`;
  await sourceStore.putVerified({
    key: secondKey,
    body: [secondBytes],
    expectedSha256: secondSha256,
    expectedSize: secondBytes.length,
    maxBytes: 1024,
  });
  const snapshot = path.join(root, 'store-snapshot');
  const created = await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobStore: sourceStore,
    destination: snapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });
  assert.equal(created.blobs.length, 2);

  const targetStore = new MemoryBlobStore();
  let puts = 0;
  const interruptedStore = {
    list: (...args) => targetStore.list(...args),
    open: (...args) => targetStore.open(...args),
    async putVerified(input) {
      puts += 1;
      if (puts === 2) throw new Error('simulated object-store interruption');
      return targetStore.putVerified(input);
    },
  };
  const journalFile = path.join(root, 'store-restore-journal.json');
  const restoreCommands = [];
  await assert.rejects(
    restoreRecoverySnapshotToStore({
      databaseUrl: 'postgres://target/revealline',
      blobStore: interruptedStore,
      storageIdentity: 's3_target',
      journalFile,
      source: snapshot,
      runCommand: async (command, args) => {
        restoreCommands.push({ command, args });
      },
    }),
    /object-store interruption/u,
  );
  assert.deepEqual(
    restoreCommands.map(({ command }) => command),
    ['pg_restore', 'psql'],
  );
  assert.match(restoreCommands[1].args.at(-1), /DELETE FROM public\.community_tus_uploads/u);
  assert.equal(JSON.parse(await readFile(journalFile, 'utf8')).state, 'database-restored');

  await restoreRecoverySnapshotToStore({
    databaseUrl: 'postgres://target/revealline',
    blobStore: targetStore,
    storageIdentity: 's3_target',
    journalFile,
    source: snapshot,
    runCommand: async (command, args) => {
      restoreCommands.push({ command, args });
    },
  });
  assert.equal(restoreCommands.length, 2);
  assert.equal((await targetStore.open(key)).sha256, sha256);
  assert.equal((await targetStore.open(secondKey)).sha256, secondSha256);
  await assert.rejects(access(journalFile), /ENOENT/u);
});

test('store restore refuses a contaminated target and a journal for another storage target', async (t) => {
  const { root, bytes, sha256, key } = await fixture(t);
  const sourceStore = new MemoryBlobStore();
  await sourceStore.putVerified({
    key,
    body: [bytes],
    expectedSha256: sha256,
    expectedSize: bytes.length,
    maxBytes: 1024,
  });
  const snapshot = path.join(root, 'snapshot');
  await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobStore: sourceStore,
    destination: snapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });
  const occupied = new MemoryBlobStore();
  await occupied.putVerified({
    key,
    body: [bytes],
    expectedSha256: sha256,
    expectedSize: bytes.length,
    maxBytes: 1024,
  });
  await assert.rejects(
    restoreRecoverySnapshotToStore({
      databaseUrl: 'postgres://target/revealline',
      blobStore: occupied,
      storageIdentity: 's3_occupied',
      journalFile: path.join(root, 'occupied-journal.json'),
      source: snapshot,
      runCommand: async () => {},
    }),
    /must be empty/u,
  );

  const target = new MemoryBlobStore();
  const journalFile = path.join(root, 'identity-journal.json');
  await assert.rejects(
    restoreRecoverySnapshotToStore({
      databaseUrl: 'postgres://target/revealline',
      blobStore: {
        list: (...args) => target.list(...args),
        open: (...args) => target.open(...args),
        async putVerified() {
          throw new Error('stop after database restore');
        },
      },
      storageIdentity: 's3_expected',
      journalFile,
      source: snapshot,
      runCommand: async () => {},
    }),
    /stop after database restore/u,
  );
  await assert.rejects(
    restoreRecoverySnapshotToStore({
      databaseUrl: 'postgres://target/revealline',
      blobStore: target,
      storageIdentity: 's3_different',
      journalFile,
      source: snapshot,
      runCommand: async () => {},
    }),
    /journal does not match/u,
  );
});

test('store restore rechecks target emptiness before resuming a prepared journal', async (t) => {
  const { root, bytes, sha256, key } = await fixture(t);
  const sourceStore = new MemoryBlobStore();
  await sourceStore.putVerified({
    key,
    body: [bytes],
    expectedSha256: sha256,
    expectedSize: bytes.length,
    maxBytes: 1024,
  });
  const snapshot = path.join(root, 'stale-journal-snapshot');
  await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobStore: sourceStore,
    destination: snapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });

  const targetStore = new MemoryBlobStore();
  const journalFile = path.join(root, 'stale-prepared-journal.json');
  let restoreAttempts = 0;
  await assert.rejects(
    restoreRecoverySnapshotToStore({
      databaseUrl: 'postgres://target/revealline',
      blobStore: targetStore,
      storageIdentity: 's3_stale_prepared',
      journalFile,
      source: snapshot,
      runCommand: async () => {
        restoreAttempts += 1;
        throw new Error('simulated database interruption');
      },
    }),
    /database interruption/u,
  );
  assert.equal(JSON.parse(await readFile(journalFile, 'utf8')).state, 'prepared');

  const unrelatedBytes = Buffer.from('unrelated target package');
  const unrelatedSha256 = digest(unrelatedBytes);
  await targetStore.putVerified({
    key: `packages/sha256/${unrelatedSha256.slice(0, 2)}/${unrelatedSha256}.rlpack`,
    body: [unrelatedBytes],
    expectedSha256: unrelatedSha256,
    expectedSize: unrelatedBytes.length,
    maxBytes: 1024,
  });
  await assert.rejects(
    restoreRecoverySnapshotToStore({
      databaseUrl: 'postgres://target/revealline',
      blobStore: targetStore,
      storageIdentity: 's3_stale_prepared',
      journalFile,
      source: snapshot,
      runCommand: async () => {
        restoreAttempts += 1;
      },
    }),
    /must be empty/u,
  );
  assert.equal(restoreAttempts, 1);
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

test('transient upload cleanup must succeed before disk or store restore journals advance', async (t) => {
  const { root, blobRoot } = await fixture(t);
  const snapshot = path.join(root, 'cleanup-snapshot');
  await createRecoverySnapshot({
    databaseUrl: 'postgres://source/revealline',
    blobRoot,
    destination: snapshot,
    runCommand: backupCommand(Buffer.from('database'), []),
  });
  const runCommands = [];
  const failCleanup = async (command, args) => {
    runCommands.push({ command, args });
    if (command === 'psql') throw new Error('transient upload cleanup failed');
  };

  const restoredBlobs = path.join(root, 'cleanup-disk-target');
  await assert.rejects(
    restoreRecoverySnapshot({
      databaseUrl: 'postgres://disk-target/revealline',
      blobRoot: restoredBlobs,
      source: snapshot,
      runCommand: failCleanup,
    }),
    /transient upload cleanup failed/u,
  );
  assert.equal(
    JSON.parse(await readFile(`${restoredBlobs}.restore-journal.json`, 'utf8')).state,
    'blobs-staged',
  );
  await assert.rejects(access(restoredBlobs), /ENOENT/u);

  const targetStore = new MemoryBlobStore();
  const storeJournal = path.join(root, 'cleanup-store-journal.json');
  await assert.rejects(
    restoreRecoverySnapshotToStore({
      databaseUrl: 'postgres://store-target/revealline',
      blobStore: targetStore,
      storageIdentity: 's3_cleanup_target',
      journalFile: storeJournal,
      source: snapshot,
      runCommand: failCleanup,
    }),
    /transient upload cleanup failed/u,
  );
  assert.equal(JSON.parse(await readFile(storeJournal, 'utf8')).state, 'prepared');
  assert.equal(
    (await targetStore.list({ prefix: 'packages/', cursor: null, limit: 1 })).items.length,
    0,
  );
  assert.deepEqual(
    runCommands.map(({ command }) => command),
    ['pg_restore', 'psql', 'pg_restore', 'psql'],
  );
  for (const call of runCommands.filter(({ command }) => command === 'psql'))
    assert.equal(call.args.at(-1), 'DELETE FROM public.community_tus_uploads;');
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

  const retryCommands = [];
  await restoreRecoverySnapshot({
    databaseUrl: 'postgres://target/revealline',
    blobRoot: restoredBlobs,
    source: snapshot,
    runCommand: async (command, args) => {
      retryCommands.push({ command, args });
    },
  });
  assert.deepEqual(
    retryCommands.map(({ command }) => command),
    ['pg_restore', 'psql'],
  );
  assert.equal(await readFile(path.join(restoredBlobs, key), 'utf8'), bytes.toString('utf8'));
  await assert.rejects(access(`${restoredBlobs}.restore-journal.json`), /ENOENT/u);
});
