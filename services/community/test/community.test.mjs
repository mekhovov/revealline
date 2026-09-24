import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { DiskBlobStore, MemoryBlobStore, S3CompatibleBlobStore } from '../src/blob-store.mjs';
import { readConfig } from '../src/config.mjs';
import {
  PACKAGE_MEDIA_TYPE,
  createEditionId,
  createValidationIdempotencyKey,
  packageBlobKey,
  validateCreateSubmission,
} from '../src/domain.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';
import { DirectUploadTransport, TusUploadTransportBoundary } from '../src/upload-transport.mjs';
import { processNextValidationJob } from '../src/worker.mjs';

const bytes = Buffer.from('revealline-content-bundle.v1 fixture');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const bearer = (token = 'alice-token') => ({ authorization: `Bearer ${token}` });
const submissionBody = (overrides = {}) => ({
  slug: 'aurora-pack',
  title: 'Aurora <Pack>',
  description: 'Line one\n<script>remains text</script>',
  version: '1.0.0',
  packageSha256: sha256,
  packageSize: bytes.length,
  ...overrides,
});

const fixture = async (options = {}) => {
  const repository = options.repository ?? new MemoryCommunityRepository();
  const blobStore = options.blobStore ?? new MemoryBlobStore();
  const app = buildCommunityApp({
    repository,
    blobStore,
    authenticator: createTokenAuthenticator({
      'alice-token': 'creator/alice',
      'bob-token': 'creator/bob',
    }),
    maxPackageBytes: options.maxPackageBytes ?? 1024,
    validatorVersion: 'bundle-validator-v1',
    uploadTransport: options.uploadTransport,
  });
  await app.ready();
  return { app, repository, blobStore };
};

const create = async (app, body = submissionBody()) =>
  app.inject({ method: 'POST', url: '/v1/submissions', headers: bearer(), payload: body });

const createAndUpload = async (app, body = submissionBody()) => {
  const created = await create(app, body);
  assert.equal(created.statusCode, 201, created.body);
  const parsed = created.json();
  const uploaded = await app.inject({
    method: 'PUT',
    url: parsed.upload.href,
    headers: { ...bearer(), 'content-type': PACKAGE_MEDIA_TYPE },
    payload: bytes,
  });
  assert.equal(uploaded.statusCode, 200, uploaded.body);
  return { created: parsed, uploaded: uploaded.json() };
};

test('edition and validation identities are deterministic and cover immutable inputs', () => {
  const base = {
    ownerSubject: 'creator/alice',
    slug: 'aurora-pack',
    editionVersion: '1.0.0',
    packageSha256: sha256,
  };
  const edition = createEditionId(base);
  assert.match(edition, /^ed_[a-f0-9]{64}$/u);
  assert.equal(createEditionId(base), edition);
  assert.notEqual(createEditionId({ ...base, editionVersion: '1.0.1' }), edition);
  const key = createValidationIdempotencyKey({
    submissionId: '8db6007f-242d-4593-9f34-a7ed819627c7',
    packageSha256: sha256,
    validatorVersion: 'v1',
  });
  assert.equal(key.length, 64);
  assert.notEqual(
    key,
    createValidationIdempotencyKey({
      submissionId: '8db6007f-242d-4593-9f34-a7ed819627c7',
      packageSha256: sha256,
      validatorVersion: 'v2',
    }),
  );
});

test('submission validation bounds plain text, semantic versions, hashes, and package sizes', () => {
  const accepted = validateCreateSubmission(submissionBody(), {
    ownerSubject: 'creator/alice',
    maxPackageBytes: 1024,
  });
  assert.equal(accepted.title, 'Aurora <Pack>');
  assert.equal(accepted.description, 'Line one\n<script>remains text</script>');
  for (const body of [
    submissionBody({ slug: '../escape' }),
    submissionBody({ version: 'latest' }),
    submissionBody({ packageSha256: 'wrong' }),
    submissionBody({ packageSize: 1025 }),
    submissionBody({ title: 'bad\nheading' }),
    submissionBody({ description: 'bad\u0000text' }),
  ])
    assert.throws(
      () =>
        validateCreateSubmission(body, {
          ownerSubject: 'creator/alice',
          maxPackageBytes: 1024,
        }),
      /must|contains|unsupported|between|slug|version|SHA-256/u,
    );
});

test('executable configuration refuses implicit development authentication', () => {
  assert.throws(() => readConfig({}), /No production authentication adapter/u);
  const config = readConfig({
    COMMUNITY_ALLOW_DEV_AUTH: 'true',
    COMMUNITY_DEV_TOKENS: '{"token":"creator"}',
  });
  assert.deepEqual(config.developmentTokens, { token: 'creator' });
  assert.equal(config.maxPackageBytes, 256 * 1024 * 1024);
});

test('public health and empty catalog do not require creator authentication', async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  const health = await app.inject({ method: 'GET', url: '/health' });
  assert.deepEqual(health.json(), { status: 'ok' });
  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.deepEqual(catalog.json(), { editions: [], nextCursor: null });
});

test('creator routes require authentication and preserve owner isolation', async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  const unauthorized = await app.inject({
    method: 'POST',
    url: '/v1/submissions',
    payload: submissionBody(),
  });
  assert.equal(unauthorized.statusCode, 401);
  const created = (await create(app)).json();
  const hidden = await app.inject({
    method: 'GET',
    url: `/v1/submissions/${created.submission.id}`,
    headers: bearer('bob-token'),
  });
  assert.equal(hidden.statusCode, 404);
});

test('mismatched package bytes are rejected without advancing submission state', async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  const created = (await create(app)).json();
  const failed = await app.inject({
    method: 'PUT',
    url: created.upload.href,
    headers: { ...bearer(), 'content-type': PACKAGE_MEDIA_TYPE },
    payload: Buffer.from('wrong'),
  });
  assert.equal(failed.statusCode, 422);
  assert.equal(failed.json().error.code, 'package_identity_mismatch');
  const status = await app.inject({
    method: 'GET',
    url: `/v1/submissions/${created.submission.id}`,
    headers: bearer(),
  });
  assert.equal(status.json().submission.status, 'draft');
});

test('upload and submit are immutable and validation enqueue is idempotent', async (t) => {
  const { app } = await fixture();
  t.after(() => app.close());
  const { created, uploaded } = await createAndUpload(app);
  assert.equal(uploaded.submission.status, 'uploaded');
  const first = await app.inject({
    method: 'POST',
    url: `/v1/submissions/${created.submission.id}/submit`,
    headers: bearer(),
  });
  assert.equal(first.statusCode, 202);
  const second = await app.inject({
    method: 'POST',
    url: `/v1/submissions/${created.submission.id}/submit`,
    headers: bearer(),
  });
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().validation.jobId, first.json().validation.jobId);
  assert.equal(second.json().validation.reused, true);
  const changed = await app.inject({
    method: 'PUT',
    url: created.upload.href,
    headers: { ...bearer(), 'content-type': PACKAGE_MEDIA_TYPE },
    payload: bytes,
  });
  assert.equal(changed.statusCode, 409);
});

test('accepted worker result publishes exact JSON metadata and immutable package bytes', async (t) => {
  const { app, repository, blobStore } = await fixture();
  t.after(() => app.close());
  const { created } = await createAndUpload(app);
  await app.inject({
    method: 'POST',
    url: `/v1/submissions/${created.submission.id}/submit`,
    headers: bearer(),
  });
  const result = await processNextValidationJob({
    repository,
    blobStore,
    workerId: 'worker-1',
    validatePackage: async ({ body, submission }) => {
      const collected = [];
      for await (const chunk of body) collected.push(chunk);
      assert.deepEqual(Buffer.concat(collected), bytes);
      assert.equal(submission.packageSha256, sha256);
      return { accepted: true, report: { compiler: 'passed', replay: 'passed' } };
    },
  });
  assert.equal(result.submission.status, 'published');
  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  const edition = catalog.json().editions[0];
  assert.equal(edition.editionId, created.submission.editionId);
  assert.equal(edition.description, 'Line one\n<script>remains text</script>');
  assert.match(catalog.headers['content-type'], /^application\/json/u);
  const download = await app.inject({
    method: 'GET',
    url: `/v1/catalog/${edition.editionId}/download`,
  });
  assert.equal(download.statusCode, 200);
  assert.deepEqual(download.rawPayload, bytes);
  assert.equal(download.headers.etag, `"sha256-${sha256}"`);
  assert.equal(download.headers['cache-control'], 'public, max-age=31536000, immutable');
});

test('rejected content stays out of the public catalog and remains visible to its owner', async (t) => {
  const { app, repository, blobStore } = await fixture();
  t.after(() => app.close());
  const { created } = await createAndUpload(app);
  await app.inject({
    method: 'POST',
    url: `/v1/submissions/${created.submission.id}/submit`,
    headers: bearer(),
  });
  await processNextValidationJob({
    repository,
    blobStore,
    workerId: 'worker-1',
    validatePackage: async () => ({
      accepted: false,
      rejectionCode: 'unsupported_format',
      report: { format: 'wrong' },
    }),
  });
  const catalog = await app.inject({ method: 'GET', url: '/v1/catalog' });
  assert.deepEqual(catalog.json().editions, []);
  const owner = await app.inject({
    method: 'GET',
    url: `/v1/submissions/${created.submission.id}`,
    headers: bearer(),
  });
  assert.equal(owner.json().submission.status, 'rejected');
  assert.equal(owner.json().submission.rejectionCode, 'unsupported_format');
});

test('worker infrastructure errors requeue the job instead of publishing or rejecting content', async () => {
  let time = new Date('2026-09-24T12:00:00.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => time });
  const blobStore = new MemoryBlobStore();
  const { app } = await fixture({ repository, blobStore });
  const { created } = await createAndUpload(app);
  await app.inject({
    method: 'POST',
    url: `/v1/submissions/${created.submission.id}/submit`,
    headers: bearer(),
  });
  await assert.rejects(
    processNextValidationJob({
      repository,
      blobStore,
      workerId: 'worker-1',
      clock: () => time,
      validatePackage: async () => {
        throw new Error('temporary decoder outage');
      },
    }),
    /temporary decoder outage/u,
  );
  const status = await repository.getOwnerSubmission(created.submission.id, 'creator/alice');
  assert.equal(status.status, 'queued');
  assert.equal(await repository.claimValidationJob({ workerId: 'too-early' }), null);
  time = new Date('2026-09-24T12:00:31.000Z');
  assert.equal((await repository.claimValidationJob({ workerId: 'retry' })).job.attempts, 2);
  await app.close();
});

test('expired worker lease is restart-safe and prevents the old worker from committing', async () => {
  let time = new Date('2026-09-24T13:00:00.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => time });
  const { app } = await fixture({ repository });
  const { created } = await createAndUpload(app);
  await app.inject({
    method: 'POST',
    url: `/v1/submissions/${created.submission.id}/submit`,
    headers: bearer(),
  });
  const first = await repository.claimValidationJob({ workerId: 'worker-old', leaseMs: 1_000 });
  assert.equal(first.job.attempts, 1);
  time = new Date('2026-09-24T13:00:02.000Z');
  const reclaimed = await repository.claimValidationJob({ workerId: 'worker-new', leaseMs: 1_000 });
  assert.equal(reclaimed.job.id, first.job.id);
  assert.equal(reclaimed.job.attempts, 2);
  await assert.rejects(
    repository.completeValidationJob({
      jobId: first.job.id,
      workerId: 'worker-old',
      accepted: true,
      result: {},
    }),
    /not owned/u,
  );
  await app.close();
});

test('disk blob writes verify identity and do not retain failed partial files', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'revealline-community-blobs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new DiskBlobStore({ root });
  const key = packageBlobKey(sha256);
  await assert.rejects(
    store.putVerified({
      key,
      body: Buffer.from('wrong'),
      expectedSha256: sha256,
      expectedSize: bytes.length,
      maxBytes: 1024,
    }),
    /do not match/u,
  );
  assert.equal(await store.stat(key), null);
  await store.putVerified({
    key,
    body: bytes,
    expectedSha256: sha256,
    expectedSize: bytes.length,
    maxBytes: 1024,
  });
  const opened = await store.open(key);
  assert.equal(opened.size, bytes.length);
  assert.deepEqual(await readFile(path.join(root, key)), bytes);
});

test('upload transport boundary distinguishes direct development and future tus behavior', () => {
  const submission = {
    id: '71fe5f20-c969-4690-80e8-bbf9654d2615',
    editionId: 'ed_test',
    packageSha256: sha256,
    declaredSize: bytes.length,
  };
  assert.deepEqual(new DirectUploadTransport().describe(submission), {
    method: 'PUT',
    href: `/v1/submissions/${submission.id}/package`,
    mediaType: PACKAGE_MEDIA_TYPE,
    packageSha256: sha256,
    packageSize: bytes.length,
    resumable: false,
  });
  const tus = new TusUploadTransportBoundary({
    endpoint: 'https://uploads.example.test/files/',
  }).describe(submission);
  assert.equal(tus.href, 'https://uploads.example.test/files');
  assert.equal(tus.resumable, true);
  assert.equal(tus.metadata.packageSha256, sha256);
});

test('S3 boundary requires verified bytes and delegates exact immutable metadata', async () => {
  const calls = [];
  const store = new S3CompatibleBlobStore({
    client: {
      async send(command) {
        calls.push(command);
        return {};
      },
    },
    bucket: 'community-test',
    commands: {
      put: (input) => ({ operation: 'put', input }),
      head: (input) => ({ operation: 'head', input }),
      get: (input) => ({ operation: 'get', input }),
    },
  });
  const key = packageBlobKey(sha256);
  await store.putVerified({
    key,
    body: bytes,
    expectedSha256: sha256,
    expectedSize: bytes.length,
    maxBytes: 1024,
  });
  assert.equal(calls[0].input.Key, key);
  assert.equal(calls[0].input.Metadata.sha256, sha256);
  assert.equal(calls[0].input.ContentType, PACKAGE_MEDIA_TYPE);
  await assert.rejects(
    store.putVerified({
      key,
      body: Buffer.from('wrong'),
      expectedSha256: sha256,
      expectedSize: 5,
      maxBytes: 1024,
    }),
    /SHA-256/u,
  );
});

test('migration defines immutable editions, bounded states, idempotent jobs, and expiring leases', async () => {
  const sql = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
  assert.match(sql, /UNIQUE \(owner_subject, slug, edition_version\)/u);
  assert.match(sql, /idempotency_key char\(64\) NOT NULL UNIQUE/u);
  assert.match(sql, /UNIQUE \(submission_id, package_sha256, validator_version\)/u);
  assert.match(sql, /lease_expires_at timestamptz/u);
  assert.match(
    sql,
    /status IN \('draft', 'uploaded', 'queued', 'validating', 'published', 'rejected'\)/u,
  );
  assert.match(sql, /status IN \('queued', 'running'\)/u);
});
