import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { createBlobStore } from './blob-store-factory.mjs';
import { readConfig } from './config.mjs';
import { packageBlobKey } from './domain.mjs';
import { postgresCommandEnvironment } from './postgres-command-environment.mjs';
import { planRecoveryRehearsal, rehearseCommunityRecovery } from './recovery-rehearsal.mjs';

if (process.env.COMMUNITY_RUN_MINIO_RECOVERY_ACCEPTANCE !== 'true')
  throw new Error('Set COMMUNITY_RUN_MINIO_RECOVERY_ACCEPTANCE=true for this destructive fixture.');

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

const targetEnvironment = {
  COMMUNITY_BLOB_STORAGE: 's3',
  COMMUNITY_S3_BUCKET: process.env.COMMUNITY_RECOVERY_TARGET_S3_BUCKET,
  COMMUNITY_S3_REGION: process.env.COMMUNITY_RECOVERY_TARGET_S3_REGION,
  COMMUNITY_S3_ENDPOINT: process.env.COMMUNITY_RECOVERY_TARGET_S3_ENDPOINT,
  COMMUNITY_S3_FORCE_PATH_STYLE: process.env.COMMUNITY_RECOVERY_TARGET_S3_FORCE_PATH_STYLE,
  COMMUNITY_BLOB_STAGING_ROOT: process.env.COMMUNITY_RECOVERY_TARGET_BLOB_STAGING_ROOT,
};
const sourceConfig = readConfig(process.env, { requireAuth: false });
const targetConfig = readConfig(targetEnvironment, { requireAuth: false });
if (sourceConfig.blobStorage.driver !== 's3' || targetConfig.blobStorage.driver !== 's3')
  throw new Error('MinIO recovery acceptance requires S3 source and target stores.');
if (sourceConfig.blobStorage.bucket === targetConfig.blobStorage.bucket)
  throw new Error('MinIO recovery acceptance source and target buckets must differ.');

const bucketClient = new S3Client({
  region: sourceConfig.blobStorage.region,
  endpoint: sourceConfig.blobStorage.endpoint,
  forcePathStyle: sourceConfig.blobStorage.forcePathStyle,
});
try {
  await bucketClient.send(new CreateBucketCommand({ Bucket: sourceConfig.blobStorage.bucket }));
  await bucketClient.send(new CreateBucketCommand({ Bucket: targetConfig.blobStorage.bucket }));
} finally {
  bucketClient.destroy();
}

const sourceDatabaseUrl = process.env.COMMUNITY_DATABASE_URL;
const targetDatabaseUrl = process.env.COMMUNITY_RECOVERY_REHEARSAL_TARGET_DATABASE_URL;
if (!sourceDatabaseUrl || !targetDatabaseUrl)
  throw new Error('MinIO recovery acceptance requires distinct source and target databases.');
const sourceBlobStore = await createBlobStore(sourceConfig.blobStorage);
const targetBlobStore = await createBlobStore(targetConfig.blobStorage);
const targetInventory = await targetBlobStore.list({
  prefix: 'packages/sha256/',
  cursor: null,
  limit: 1,
});
if (targetInventory.items.length)
  throw new Error('MinIO recovery acceptance target bucket is not empty.');

const packageBytes = Buffer.from(`RevealLine MinIO recovery acceptance ${randomUUID()}`, 'utf8');
const packageSha256 = createHash('sha256').update(packageBytes).digest('hex');
const blobKey = packageBlobKey(packageSha256);
await sourceBlobStore.putVerified({
  key: blobKey,
  body: [packageBytes],
  expectedSha256: packageSha256,
  expectedSize: packageBytes.length,
  maxBytes: 1024 * 1024,
});

const publishedId = randomUUID();
const draftId = randomUUID();
const collectionId = `co_${createHash('sha256').update(publishedId).digest('hex')}`;
const now = new Date().toISOString();
const seedSql = `
INSERT INTO community_submissions (
  id, edition_id, collection_id, owner_subject, slug, title, description, edition_version,
  package_sha256, declared_size, actual_size, blob_key, status, created_at, updated_at, published_at
) VALUES (
  '${publishedId}', 'minio-${publishedId}', '${collectionId}', 'minio-acceptance',
  'minio-${publishedId}', 'MinIO recovery acceptance', '', '1.0.0', '${packageSha256}',
  ${packageBytes.length}, ${packageBytes.length}, '${blobKey}', 'published', '${now}', '${now}', '${now}'
);
INSERT INTO community_submissions (
  id, edition_id, collection_id, owner_subject, slug, title, description, edition_version,
  package_sha256, declared_size, status, created_at, updated_at
) VALUES (
  '${draftId}', 'draft-${draftId}', 'co_${'d'.repeat(64)}', 'minio-acceptance',
  'draft-${draftId}', 'Interrupted upload', '', '1.0.0', '${'e'.repeat(64)}', 1024,
  'draft', '${now}', '${now}'
);
INSERT INTO community_tus_uploads (
  upload_id, submission_id, owner_subject, expires_at
) VALUES ('interrupted-${draftId}', '${draftId}', 'minio-acceptance', '${now}'::timestamptz + interval '1 day');
`;
await runCommand('psql', ['--no-psqlrc', '--set=ON_ERROR_STOP=1', '--command', seedSql], {
  databaseUrl: sourceDatabaseUrl,
});

const evidenceRoot = path.resolve(
  process.env.COMMUNITY_MINIO_RECOVERY_EVIDENCE_ROOT ?? '/data/recovery',
);
await mkdir(evidenceRoot, { recursive: true });
const runId = randomUUID();
const workDirectory = path.join(evidenceRoot, `minio-${runId}`);
const receiptFile = path.join(evidenceRoot, `minio-${runId}.json`);
const configuration = {
  sourceDatabaseUrl,
  sourceBlobStore,
  sourceBlobStorage: sourceConfig.blobStorage,
  targetDatabaseUrl,
  targetBlobStore,
  targetBlobStorage: targetConfig.blobStorage,
};
const plan = planRecoveryRehearsal(configuration);
const receipt = await rehearseCommunityRecovery({
  ...configuration,
  workDirectory,
  receiptFile,
  expectedTargetIdentity: plan.targetDatabase,
  runCommand,
});
const restored = await targetBlobStore.open(blobKey);
if (!restored || restored.size !== packageBytes.length || restored.sha256 !== packageSha256)
  throw new Error('Restored MinIO package identity differs from the source package.');
const restoredChunks = [];
for await (const chunk of restored.body) restoredChunks.push(Buffer.from(chunk));
if (!Buffer.concat(restoredChunks).equals(packageBytes))
  throw new Error('Restored MinIO package bytes differ from the source package.');

process.stdout.write(
  `${JSON.stringify({
    passed: true,
    snapshotId: receipt.snapshotId,
    discardedTusUploads: receipt.evidence.discardedTusUploads,
    packageSha256,
    receipt: receiptFile,
  })}\n`,
);
