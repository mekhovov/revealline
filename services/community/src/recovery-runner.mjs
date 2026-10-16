import { spawn } from 'node:child_process';
import path from 'node:path';
import { createBlobStore } from './blob-store-factory.mjs';
import { readConfig } from './config.mjs';
import { postgresCommandEnvironment } from './postgres-command-environment.mjs';
import {
  createRecoverySnapshot,
  recoveryStorageIdentity,
  restoreRecoverySnapshot,
  restoreRecoverySnapshotToStore,
  verifyRecoverySnapshot,
} from './recovery.mjs';

const runCommand = (command, args, { databaseUrl } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: databaseUrl ? postgresCommandEnvironment(databaseUrl) : process.env,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`));
    });
  });

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};

const [operation] = process.argv.slice(2);
const directory = option('--directory');
const databaseUrl = process.env.COMMUNITY_DATABASE_URL;
const config = readConfig(process.env, { requireAuth: false });
const blobRoot = config.blobStorage.driver === 'disk' ? config.blobStorage.root : null;
const blobStore =
  config.blobStorage.driver === 's3' ? await createBlobStore(config.blobStorage) : null;

let manifest;
if (operation === 'backup')
  manifest = await createRecoverySnapshot({
    databaseUrl,
    blobRoot,
    blobStore,
    destination: directory,
    runCommand,
  });
else if (operation === 'verify') manifest = await verifyRecoverySnapshot({ source: directory });
else if (operation === 'restore') {
  if (blobStore)
    manifest = await restoreRecoverySnapshotToStore({
      databaseUrl,
      blobStore,
      storageIdentity: recoveryStorageIdentity(config.blobStorage),
      journalFile: option('--journal') ?? path.resolve(`${directory}.restore-journal.json`),
      source: directory,
      runCommand,
    });
  else
    manifest = await restoreRecoverySnapshot({
      databaseUrl,
      blobRoot,
      source: directory,
      runCommand,
    });
} else
  throw new Error(
    'Usage: node src/recovery-runner.mjs <backup|verify|restore> --directory <snapshot-directory>',
  );

process.stdout.write(
  `${JSON.stringify({ operation, snapshotId: manifest.snapshotId, blobs: manifest.blobs.length })}\n`,
);
