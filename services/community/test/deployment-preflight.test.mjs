import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { MemoryBlobStore } from '../src/blob-store.mjs';
import {
  checkDeploymentSchema,
  checkFfprobe,
  checkWritableDirectory,
  createCachedDeploymentReadiness,
  DeploymentPreflightError,
  REQUIRED_DEPLOYMENT_COLUMNS,
  REQUIRED_DEPLOYMENT_TABLES,
  runDeploymentPreflight,
  safeDeploymentPreflightFailure,
} from '../src/deployment-preflight.mjs';
import { runDeploymentPreflightCommand } from '../src/deployment-preflight-runner.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';

const rows = (tables = REQUIRED_DEPLOYMENT_TABLES) =>
  tables.map((tableName) => ({ table_name: tableName }));

const columnRows = () =>
  Object.entries(REQUIRED_DEPLOYMENT_COLUMNS).flatMap(([tableName, names]) =>
    names.map((columnName) => ({ table_name: tableName, column_name: columnName })),
  );

const productionEnvironment = Object.freeze({
  COMMUNITY_ALLOW_DEV_AUTH: 'false',
  COMMUNITY_DATABASE_URL: 'postgres://user:database-secret@database/revealline',
  COMMUNITY_BLOB_ROOT: '/data/blobs',
  COMMUNITY_TUS_ROOT: '/data/tus',
  COMMUNITY_RELEASE_VERSION: 'v0.141.2',
  COMMUNITY_SOURCE_REVISION: '12978e5fd3fe0ce70bbee96aa543f569f64622d4',
  COMMUNITY_IMAGE_RELEASE_VERSION: 'v0.141.2',
  COMMUNITY_IMAGE_SOURCE_REVISION: '12978e5fd3fe0ce70bbee96aa543f569f64622d4',
  COMMUNITY_TRUST_PROXY_HOPS: '1',
  BETTER_AUTH_SECRET: 'authentication-secret-that-is-long-enough',
  BETTER_AUTH_URL: 'https://community.example.test',
  BETTER_AUTH_TRUSTED_ORIGINS: 'https://game.example.test',
  COMMUNITY_ACCOUNT_MAIL_WEBHOOK_URL: 'https://mail.example.test/revealline/account-delivery',
  COMMUNITY_ACCOUNT_MAIL_WEBHOOK_TOKEN: 'mail-secret-that-is-also-long-enough',
});

test('schema readiness requires every application and Better Auth table', async () => {
  const calls = [];
  const result = await checkDeploymentSchema({
    query: async (text, values) => {
      calls.push({ text, values });
      return { rows: calls.length === 1 ? rows() : columnRows() };
    },
  });
  assert.deepEqual(result, {
    status: 'ready',
    tables: REQUIRED_DEPLOYMENT_TABLES.length,
    migrationColumns: columnRows().length,
  });
  assert.deepEqual(calls[0].values, [REQUIRED_DEPLOYMENT_TABLES]);
  assert.deepEqual(calls[1].values, [Object.keys(REQUIRED_DEPLOYMENT_COLUMNS)]);

  await assert.rejects(
    checkDeploymentSchema({ query: async () => ({ rows: rows(['community_submissions']) }) }),
    /migrations have not completed/u,
  );

  let queryCount = 0;
  await assert.rejects(
    checkDeploymentSchema({
      query: async () => ({ rows: queryCount++ === 0 ? rows() : columnRows().slice(1) }),
    }),
    /migrations have not completed/u,
  );
});

test('storage readiness verifies durable round-trip bytes and removes its probe', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'community-preflight-'));
  t.after(() => import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true })));
  await writeFile(path.join(root, 'retained'), 'keep');

  assert.deepEqual(await checkWritableDirectory(root), { status: 'ready' });
  assert.deepEqual(await readdir(root), ['retained']);

  await assert.rejects(checkWritableDirectory(path.join(root, 'retained')), /EEXIST|ENOTDIR/u);
});

test('ffprobe readiness invokes only the bounded version inspection', async () => {
  const calls = [];
  const result = await checkFfprobe({
    ffprobePath: '/usr/local/bin/ffprobe',
    runCommand: async (...args) => {
      calls.push(args);
      return { stdout: 'ffprobe version 9.0\n' };
    },
  });
  assert.deepEqual(result, { status: 'ready' });
  assert.deepEqual(calls, [
    [
      '/usr/local/bin/ffprobe',
      ['-version'],
      { encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024 },
    ],
  ]);
  await assert.rejects(
    checkFfprobe({ runCommand: async () => ({ stdout: 'unexpected' }) }),
    /unexpected version/u,
  );
});

test('deployment preflight reports the failing boundary without credentials or host paths', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'community-preflight-run-'));
  t.after(() => import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true })));
  let queryCount = 0;
  const pool = {
    query: async () => ({ rows: queryCount++ === 0 ? rows() : columnRows() }),
  };
  await assert.rejects(
    runDeploymentPreflight({
      pool,
      blobRoot: path.join(root, 'blobs'),
      tusRoot: path.join(root, 'tus'),
      runCommand: async () => {
        throw new Error('spawn /secret/operator/path/ffprobe failed');
      },
    }),
    (error) => {
      assert.ok(error instanceof DeploymentPreflightError);
      assert.equal(error.check, 'ffprobe');
      assert.deepEqual(safeDeploymentPreflightFailure(error), {
        status: 'not-ready',
        error: {
          code: 'deployment_not_ready',
          check: 'ffprobe',
          message: 'Community deployment ffprobe check failed.',
        },
      });
      assert.doesNotMatch(JSON.stringify(safeDeploymentPreflightFailure(error)), /secret|path/u);
      return true;
    },
  );
});

test('deployment preflight CLI validates production config and never prints credentials', async () => {
  const output = [];
  const errors = [];
  let ended = 0;
  const pool = { end: async () => (ended += 1) };
  const exitCode = await runDeploymentPreflightCommand({
    environment: productionEnvironment,
    stdout: { write: (value) => output.push(value) },
    stderr: { write: (value) => errors.push(value) },
    createPool: (databaseUrl) => {
      assert.equal(databaseUrl, productionEnvironment.COMMUNITY_DATABASE_URL);
      return pool;
    },
    runPreflight: async (options) => {
      assert.equal(options.pool, pool);
      return { status: 'ready', checks: {} };
    },
  });
  assert.equal(exitCode, 0);
  assert.equal(ended, 1);
  assert.deepEqual(errors, []);
  assert.deepEqual(JSON.parse(output.join('')), { status: 'ready', checks: {} });
  assert.doesNotMatch(output.join(''), /database-secret|authentication-secret|mail-secret/u);

  const invalidOutput = [];
  const invalidErrors = [];
  assert.equal(
    await runDeploymentPreflightCommand({
      environment: {},
      stdout: { write: (value) => invalidOutput.push(value) },
      stderr: { write: (value) => invalidErrors.push(value) },
      createPool: () => assert.fail('invalid configuration must not create a pool'),
    }),
    1,
  );
  assert.deepEqual(invalidOutput, []);
  assert.deepEqual(JSON.parse(invalidErrors.join('')), {
    status: 'not-ready',
    error: {
      code: 'invalid_configuration',
      check: 'configuration',
      message: 'Community deployment configuration is invalid.',
    },
  });
});

test('readiness cache coalesces probes and bounds repeated success and failure work', async () => {
  let now = 1_000;
  let attempts = 0;
  let fail = false;
  const ready = createCachedDeploymentReadiness(
    async () => {
      attempts += 1;
      if (fail) throw new Error('not ready');
      return { status: 'ready', attempt: attempts };
    },
    { ttlMs: 100, clock: () => now },
  );

  assert.deepEqual(await Promise.all([ready(), ready()]), [
    { status: 'ready', attempt: 1 },
    { status: 'ready', attempt: 1 },
  ]);
  assert.equal(attempts, 1);
  now += 100;
  fail = true;
  await assert.rejects(ready(), /not ready/u);
  await assert.rejects(ready(), /not ready/u);
  assert.equal(attempts, 2);
  now += 100;
  fail = false;
  assert.deepEqual(await ready(), { status: 'ready', attempt: 3 });
});

test('readiness endpoint runs deployment readiness and fails closed', async (t) => {
  let ready = false;
  const repository = new MemoryCommunityRepository();
  const app = buildCommunityApp({
    repository,
    blobStore: new MemoryBlobStore(),
    authenticator: createTokenAuthenticator({ creator: 'creator-a' }),
    readinessCheck: async () => {
      if (!ready) throw new Error('database URL contains database-secret');
    },
  });
  t.after(() => app.close());

  const unavailable = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(unavailable.statusCode, 500);
  assert.equal(unavailable.json().error.code, 'internal_error');
  assert.doesNotMatch(unavailable.body, /database-secret/u);

  ready = true;
  const available = await app.inject({ method: 'GET', url: '/ready' });
  assert.equal(available.statusCode, 200);
  assert.deepEqual(available.json(), { status: 'ready' });
  assert.equal(available.headers['cache-control'], 'no-store');
});

test('production Compose profile fails closed and preserves every shared admission setting', async () => {
  const compose = await readFile(new URL('../compose.production.yaml', import.meta.url), 'utf8');
  const baseCompose = await readFile(new URL('../compose.yaml', import.meta.url), 'utf8');
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(baseCompose, /'127\.0\.0\.1:8787:8787'/u);
  assert.match(compose, /COMMUNITY_ALLOW_DEV_AUTH: 'false'/u);
  assert.match(compose, /COMMUNITY_DEV_TOKENS: '\{\}'/u);
  for (const name of [
    'COMMUNITY_AUTH_ATTEMPTS_PER_WINDOW',
    'COMMUNITY_AUTH_WINDOW_SECONDS',
    'COMMUNITY_REPORTS_PER_WINDOW',
    'COMMUNITY_REPORT_WINDOW_SECONDS',
    'COMMUNITY_SUBMISSIONS_PER_WINDOW',
    'COMMUNITY_SUBMISSION_WINDOW_SECONDS',
    'COMMUNITY_UPLOAD_BYTES_PER_WINDOW',
    'COMMUNITY_UPLOAD_WINDOW_SECONDS',
    'COMMUNITY_TRUST_PROXY_HOPS',
    'COMMUNITY_RELEASE_VERSION',
    'COMMUNITY_SOURCE_REVISION',
  ]) {
    assert.match(compose, new RegExp(name + ': \\$\\{'));
  }
  assert.match(compose, /x-community-production-build:/u);
  assert.match(compose, /COMMUNITY_RELEASE_VERSION: \$\{COMMUNITY_RELEASE_VERSION:/u);
  assert.match(compose, /COMMUNITY_SOURCE_REVISION: \$\{COMMUNITY_SOURCE_REVISION:/u);
  assert.match(dockerfile, /COMMUNITY_IMAGE_RELEASE_VERSION=\$\{COMMUNITY_RELEASE_VERSION\}/u);
  assert.match(dockerfile, /COMMUNITY_IMAGE_SOURCE_REVISION=\$\{COMMUNITY_SOURCE_REVISION\}/u);
  assert.match(compose, /auth-migrate:[\s\S]*command: \['npm', 'run', 'auth:migrate'\]/u);
  assert.match(compose, /preflight:[\s\S]*auth-migrate:[\s\S]*service_completed_successfully/u);
  assert.match(compose, /api:[\s\S]*preflight:[\s\S]*service_completed_successfully/u);
  assert.match(compose, /worker:[\s\S]*preflight:[\s\S]*service_completed_successfully/u);
  assert.doesNotMatch(
    compose.slice(compose.indexOf('  worker:')),
    /BETTER_AUTH_SECRET|COMMUNITY_ACCOUNT_MAIL_WEBHOOK_TOKEN/u,
  );
});
