import { spawn } from 'node:child_process';
import {
  createRecoverySnapshot,
  restoreRecoverySnapshot,
  verifyRecoverySnapshot,
} from './recovery.mjs';

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
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
const blobRoot = process.env.COMMUNITY_BLOB_ROOT ?? './var/blobs';

let manifest;
if (operation === 'backup')
  manifest = await createRecoverySnapshot({
    databaseUrl,
    blobRoot,
    destination: directory,
    runCommand,
  });
else if (operation === 'verify') manifest = await verifyRecoverySnapshot({ source: directory });
else if (operation === 'restore')
  manifest = await restoreRecoverySnapshot({
    databaseUrl,
    blobRoot,
    source: directory,
    runCommand,
  });
else
  throw new Error(
    'Usage: node src/recovery-runner.mjs <backup|verify|restore> --directory <snapshot-directory>',
  );

process.stdout.write(
  `${JSON.stringify({ operation, snapshotId: manifest.snapshotId, blobs: manifest.blobs.length })}\n`,
);
