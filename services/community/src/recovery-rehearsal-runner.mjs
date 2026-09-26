import { spawn } from 'node:child_process';
import { createBlobStore } from './blob-store-factory.mjs';
import { readConfig } from './config.mjs';
import { postgresCommandEnvironment } from './postgres-command-environment.mjs';
import { planRecoveryRehearsal, rehearseCommunityRecovery } from './recovery-rehearsal.mjs';

const runCommand = (command, args, { databaseUrl, captureOutput = false } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: captureOutput ? ['ignore', 'pipe', 'inherit'] : 'inherit',
      env: databaseUrl ? postgresCommandEnvironment(databaseUrl) : process.env,
    });
    let output = '';
    if (captureOutput) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(captureOutput ? output : undefined);
      else
        reject(new Error(`${command} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`));
    });
  });

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};

const [operation] = process.argv.slice(2);
const sourceConfig = readConfig(process.env, { requireAuth: false });
const targetDriver = process.env.COMMUNITY_RECOVERY_TARGET_BLOB_STORAGE ?? 'disk';
const targetConfig = readConfig(
  {
    COMMUNITY_BLOB_STORAGE: targetDriver,
    COMMUNITY_BLOB_ROOT:
      process.env.COMMUNITY_RECOVERY_TARGET_BLOB_ROOT ??
      process.env.COMMUNITY_RECOVERY_REHEARSAL_TARGET_BLOB_ROOT,
    COMMUNITY_S3_BUCKET: process.env.COMMUNITY_RECOVERY_TARGET_S3_BUCKET,
    COMMUNITY_S3_REGION: process.env.COMMUNITY_RECOVERY_TARGET_S3_REGION,
    COMMUNITY_S3_ENDPOINT: process.env.COMMUNITY_RECOVERY_TARGET_S3_ENDPOINT,
    COMMUNITY_S3_FORCE_PATH_STYLE: process.env.COMMUNITY_RECOVERY_TARGET_S3_FORCE_PATH_STYLE,
    COMMUNITY_BLOB_STAGING_ROOT: process.env.COMMUNITY_RECOVERY_TARGET_BLOB_STAGING_ROOT,
  },
  { requireAuth: false },
);
const sourceBlobStore =
  sourceConfig.blobStorage.driver === 's3' ? await createBlobStore(sourceConfig.blobStorage) : null;
const targetBlobStore =
  targetConfig.blobStorage.driver === 's3' ? await createBlobStore(targetConfig.blobStorage) : null;
const configuration = {
  sourceDatabaseUrl: process.env.COMMUNITY_DATABASE_URL,
  sourceBlobRoot:
    sourceConfig.blobStorage.driver === 'disk' ? sourceConfig.blobStorage.root : undefined,
  sourceBlobStore,
  sourceBlobStorage:
    sourceConfig.blobStorage.driver === 's3' ? sourceConfig.blobStorage : undefined,
  targetDatabaseUrl: process.env.COMMUNITY_RECOVERY_REHEARSAL_TARGET_DATABASE_URL,
  targetBlobRoot:
    targetConfig.blobStorage.driver === 'disk' ? targetConfig.blobStorage.root : undefined,
  targetBlobStore,
  targetBlobStorage:
    targetConfig.blobStorage.driver === 's3' ? targetConfig.blobStorage : undefined,
};

if (operation === 'plan') {
  process.stdout.write(`${JSON.stringify(planRecoveryRehearsal(configuration))}\n`);
} else if (operation === 'run') {
  const receipt = await rehearseCommunityRecovery({
    ...configuration,
    workDirectory: option('--work-directory'),
    receiptFile: option('--receipt'),
    expectedTargetIdentity: option('--confirm-target'),
    runCommand,
  });
  process.stdout.write(
    `${JSON.stringify({ outcome: receipt.outcome, snapshotId: receipt.snapshotId, receipt: option('--receipt') })}\n`,
  );
} else {
  throw new Error(
    'Usage: node src/recovery-rehearsal-runner.mjs <plan|run> [--work-directory <directory> --receipt <file> --confirm-target <identity>]',
  );
}
