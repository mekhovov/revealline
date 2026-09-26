import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('MinIO recovery acceptance is isolated, explicit, and checks transient tus recovery', async () => {
  const [compose, minioDockerfile, runner, packageJson, productionCompose] = await Promise.all([
    readFile(new URL('../compose.minio-acceptance.yaml', import.meta.url), 'utf8'),
    readFile(new URL('../Dockerfile.minio-acceptance', import.meta.url), 'utf8'),
    readFile(new URL('../src/minio-recovery-acceptance-runner.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../compose.production.yaml', import.meta.url), 'utf8'),
  ]);
  assert.match(compose, /COMMUNITY_RUN_MINIO_RECOVERY_ACCEPTANCE: 'true'/u);
  assert.match(compose, /COMMUNITY_S3_BUCKET: revealline-source/u);
  assert.match(compose, /COMMUNITY_RECOVERY_TARGET_S3_BUCKET: revealline-target/u);
  assert.match(compose, /community-minio-recovery-evidence/u);
  assert.doesNotMatch(compose, /ports:/u);
  assert.doesNotMatch(compose, /:latest/u);
  assert.doesNotMatch(compose, /minio\/minio|quay\.io\/minio/u);
  assert.match(minioDockerfile, /07c3a429bfed433e49018cb0f78a52145d4bedeb/u);
  assert.match(runner, /CreateBucketCommand/u);
  assert.match(runner, /Set COMMUNITY_RUN_MINIO_RECOVERY_ACCEPTANCE=true/u);
  assert.match(runner, /postgresCommandEnvironment\(databaseUrl\)/u);
  assert.doesNotMatch(runner, /PGDATABASE:\s*databaseUrl/u);
  assert.match(runner, /discardedTusUploads/u);
  assert.match(runner, /Restored MinIO package bytes differ/u);
  assert.equal(
    JSON.parse(packageJson).scripts['acceptance:minio-recovery'],
    'node src/minio-recovery-acceptance-runner.mjs',
  );
  assert.doesNotMatch(productionCompose, /minio/u);
});
