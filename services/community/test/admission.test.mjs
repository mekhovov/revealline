import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createAdmissionController } from '../src/admission.mjs';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { MemoryBlobStore } from '../src/blob-store.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';

const policies = ({ auth = 2, report = 2, submission = 2, uploadBytes = 20 } = {}) => ({
  auth: { limit: auth, windowMs: 60_000 },
  report: { limit: report, windowMs: 60_000 },
  submission: { limit: submission, windowMs: 60_000 },
  uploadBytes: { limit: uploadBytes, windowMs: 60_000 },
});

test('shared admission repository enforces one window across API replicas', async () => {
  let now = new Date('2026-09-25T12:00:10.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => now });
  const firstReplica = createAdmissionController({ repository, policies: policies() });
  const secondReplica = createAdmissionController({ repository, policies: policies() });
  await assert.rejects(
    firstReplica.admit({ action: 'report', subject: undefined }),
    /non-empty string/u,
  );
  await assert.rejects(
    firstReplica.admit({ action: 'report', subject: 'valid', idempotencyKey: '' }),
    /non-empty string/u,
  );
  const first = await firstReplica.admit({ action: 'report', subject: 'network/203.0.113.5' });
  const second = await secondReplica.admit({ action: 'report', subject: 'network/203.0.113.5' });
  assert.equal(first.remaining, 1);
  assert.equal(second.remaining, 0);
  await assert.rejects(
    firstReplica.admit({ action: 'report', subject: 'network/203.0.113.5' }),
    (error) =>
      error.statusCode === 429 && error.code === 'rate_limited' && error.retryAfterSeconds === 50,
  );
  now = new Date('2026-09-25T12:01:00.000Z');
  assert.equal(
    (await secondReplica.admit({ action: 'report', subject: 'network/203.0.113.5' })).remaining,
    1,
  );
});

test('idempotent byte admission charges one immutable edition once', async () => {
  let now = new Date('2026-09-25T12:00:10.000Z');
  const repository = new MemoryCommunityRepository({
    clock: () => now,
  });
  const admission = createAdmissionController({
    repository,
    policies: policies({ uploadBytes: 20 }),
  });
  const first = await admission.admit({
    action: 'uploadBytes',
    subject: 'creator/alice',
    idempotencyKey: 'ed_one',
    cost: 12,
  });
  const retry = await admission.admit({
    action: 'uploadBytes',
    subject: 'creator/alice',
    idempotencyKey: 'ed_one',
    cost: 12,
  });
  assert.equal(first.reused, false);
  assert.equal(retry.reused, true);
  assert.equal(retry.remaining, 8);
  now = new Date('2026-09-25T12:00:30.000Z');
  assert.equal(
    (
      await admission.admit({
        action: 'uploadBytes',
        subject: 'creator/alice',
        idempotencyKey: 'ed_one',
        cost: 12,
      })
    ).retryAfterSeconds,
    30,
  );
  await assert.rejects(
    admission.admit({
      action: 'uploadBytes',
      subject: 'creator/alice',
      idempotencyKey: 'ed_two',
      cost: 9,
    }),
    (error) => error.statusCode === 429 && error.code === 'rate_limited',
  );
});

test('direct upload admission reserves declared bytes before blob writes', async (t) => {
  const repository = new MemoryCommunityRepository({
    clock: () => new Date('2026-09-25T12:00:10.000Z'),
  });
  const app = buildCommunityApp({
    repository,
    blobStore: new MemoryBlobStore(),
    authenticator: createTokenAuthenticator({ token: 'creator/alice' }),
    admissionPolicies: policies({ submission: 3, uploadBytes: 10 }),
    maxPackageBytes: 1_024,
  });
  await app.ready();
  t.after(() => app.close());
  const packageBytes = Buffer.from('123456');
  const create = async (slug, version) =>
    app.inject({
      method: 'POST',
      url: '/v1/submissions',
      headers: { authorization: 'Bearer token' },
      payload: {
        slug,
        title: slug,
        version,
        packageSha256: createHash('sha256').update(packageBytes).digest('hex'),
        packageSize: packageBytes.length,
      },
    });
  const first = await create('first-pack', '1.0.0');
  const uploaded = await app.inject({
    method: 'PUT',
    url: first.json().upload.href,
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/vnd.revealline.rlpack',
    },
    payload: packageBytes,
  });
  assert.equal(uploaded.statusCode, 200, uploaded.body);
  const repeated = await app.inject({
    method: 'PUT',
    url: first.json().upload.href,
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/vnd.revealline.rlpack',
    },
    payload: packageBytes,
  });
  assert.equal(repeated.statusCode, 200, repeated.body);
  const second = await create('second-pack', '2.0.0');
  const limited = await app.inject({
    method: 'PUT',
    url: second.json().upload.href,
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/vnd.revealline.rlpack',
    },
    payload: packageBytes,
  });
  assert.equal(limited.statusCode, 429, limited.body);
  assert.equal(limited.headers['retry-after'], '50');
  assert.equal(limited.json().error.code, 'rate_limited');
});

test('HTTP admission returns bounded Retry-After and keeps immutable retries idempotent', async (t) => {
  let now = new Date('2026-09-25T12:00:10.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => now });
  const app = buildCommunityApp({
    repository,
    blobStore: new MemoryBlobStore(),
    authenticator: createTokenAuthenticator({ token: 'creator/alice' }),
    admissionPolicies: policies({ auth: 1, submission: 1, uploadBytes: 1_024 }),
    maxPackageBytes: 1_024,
  });
  app.post('/api/auth/test', async () => ({ ok: true }));
  await app.ready();
  t.after(() => app.close());
  assert.equal((await app.inject({ method: 'POST', url: '/api/auth/test' })).statusCode, 200);
  const authLimited = await app.inject({ method: 'POST', url: '/api/auth/test' });
  assert.equal(authLimited.statusCode, 429);
  assert.equal(authLimited.headers['retry-after'], '50');
  assert.deepEqual(authLimited.json().error, {
    code: 'rate_limited',
    message: 'Too many requests. Retry after the current limit window.',
    retryAfterSeconds: 50,
  });

  const packageBytes = Buffer.from('package');
  const payload = {
    slug: 'one-pack',
    title: 'One pack',
    version: '1.0.0',
    packageSha256: createHash('sha256').update(packageBytes).digest('hex'),
    packageSize: packageBytes.length,
  };
  const created = await app.inject({
    method: 'POST',
    url: '/v1/submissions',
    headers: { authorization: 'Bearer token' },
    payload,
  });
  assert.equal(created.statusCode, 201, created.body);
  const duplicate = await app.inject({
    method: 'POST',
    url: '/v1/submissions',
    headers: { authorization: 'Bearer token' },
    payload,
  });
  assert.equal(duplicate.statusCode, 409, duplicate.body);
  const limited = await app.inject({
    method: 'POST',
    url: '/v1/submissions',
    headers: { authorization: 'Bearer token' },
    payload: { ...payload, slug: 'two-pack', version: '2.0.0' },
  });
  assert.equal(limited.statusCode, 429, limited.body);
  assert.equal(limited.headers['retry-after'], '50');
});
