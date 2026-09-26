import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MemoryLocker } from '@tus/server';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { MemoryBlobStore } from '../src/blob-store.mjs';
import {
  DEPLOYED_TUS_ACCEPTANCE_FORMAT,
  DEPLOYED_TUS_DESTRUCTIVE_OPT_IN,
  runDeployedTusResumeAcceptance,
  validateDeployedTusResumeConfig,
} from '../src/deployed-tus-resume.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';
import { createCommunityTusServer } from '../src/tus-server.mjs';
import { TusUploadTransportBoundary } from '../src/upload-transport.mjs';
import { createCreatorPackageValidator } from '../src/validator.mjs';
import { processNextValidationJob } from '../src/worker.mjs';
import { startTusFaultProxy } from '../scripts/tus-fault-proxy.mjs';

const bearer = (token) => ({ authorization: `Bearer ${token}` });
const expectedRelease = Object.freeze({
  version: 'v0.141.4',
  sourceRevision: '218e76281e3bfa26f57b7aa0f7b98058f4bd05ad',
  validatorVersion: 'creator-bundle-v1',
});
const config = (overrides = {}) => ({
  baseURL: 'https://community.example.test/',
  namespace: 'tus-deploy-20260926',
  optIn: DEPLOYED_TUS_DESTRUCTIVE_OPT_IN,
  expectedRelease,
  auth: {
    creator: bearer('creator-secret'),
    admin: bearer('admin-secret'),
  },
  requestTimeoutMs: 2_000,
  pollIntervalMs: 50,
  validationTimeoutMs: 5_000,
  chunkBytes: 64 * 1024,
  ...overrides,
});

test('deployed tus config requires HTTPS, explicit opt-in, namespace and bounded credentials', () => {
  assert.throws(
    () => validateDeployedTusResumeConfig(config({ optIn: 'yes' })),
    /destructive acceptance opt-in/u,
  );
  assert.throws(
    () => validateDeployedTusResumeConfig(config({ baseURL: 'http://community.example.test/' })),
    /must use HTTPS/u,
  );
  assert.throws(
    () =>
      validateDeployedTusResumeConfig(
        config({ baseURL: 'https://creator:secret@community.example.test/' }),
      ),
    /must not contain credentials/u,
  );
  assert.throws(
    () => validateDeployedTusResumeConfig(config({ namespace: 'shared' })),
    /unique 8-40 character/u,
  );
  assert.throws(
    () => validateDeployedTusResumeConfig(config({ auth: { ...config().auth, admin: {} } })),
    /Administrator authentication/u,
  );
  assert.throws(
    () => validateDeployedTusResumeConfig(config({ expectedRelease: null })),
    /expected release, source and validator versions/u,
  );
  assert.equal(validateDeployedTusResumeConfig(config()).baseURL, config().baseURL);
});

const fetchThroughFastify =
  (app) =>
  async (input, init = {}) => {
    const url = new URL(input);
    if (url.hostname !== 'community.example.test') return fetch(input, init);
    const body =
      init.body instanceof Blob
        ? Buffer.from(await init.body.arrayBuffer())
        : (init.body ?? undefined);
    const injected = await app.inject({
      method: init.method ?? 'GET',
      url: `${url.pathname}${url.search}`,
      headers: init.headers,
      payload: body,
    });
    const headers = new Headers();
    for (const [name, value] of Object.entries(injected.headers)) {
      if (value !== undefined)
        headers.set(name, Array.isArray(value) ? value.join(', ') : String(value));
    }
    return new Response(injected.rawPayload, { status: injected.statusCode, headers });
  };

test('remote fault proxy requires deliberate HTTPS remote mode', async () => {
  await assert.rejects(
    startTusFaultProxy({ upstreamURL: 'https://community.example.test/' }),
    /loopback-only/u,
  );
  await assert.rejects(
    startTusFaultProxy({
      upstreamURL: 'http://community.example.test/',
      allowRemoteUpstream: true,
    }),
    /must use HTTPS/u,
  );
  const proxy = await startTusFaultProxy({
    upstreamURL: 'https://community.example.test/community/',
    allowRemoteUpstream: true,
  });
  await proxy.close();
});

test('deployed mode resumes one remote tus resource and unlists exact published bytes', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revealline-deployed-tus-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let wallTime = Date.parse('2026-09-26T12:00:00.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => new Date(wallTime) });
  const blobStore = new MemoryBlobStore();
  const authenticator = createTokenAuthenticator({
    'creator-secret': 'creator/deployed-tus',
    'admin-secret': { subject: 'administrator/deployed-tus', roles: ['admin'] },
  });
  const tus = createCommunityTusServer({
    directory,
    authenticator,
    repository,
    blobStore,
    maxPackageBytes: 16 * 1024 * 1024,
    locker: new MemoryLocker(),
    expirationMs: 60_000,
    cleanupIntervalMs: 60_000,
  });
  const app = buildCommunityApp({
    repository,
    blobStore,
    authenticator,
    maxPackageBytes: 16 * 1024 * 1024,
    validatorVersion: expectedRelease.validatorVersion,
    releaseIdentity: expectedRelease,
    uploadTransport: new TusUploadTransportBoundary({ endpoint: '/v1/uploads' }),
    tus,
  });
  await app.ready();
  t.after(() => app.close());
  const upstreamOrigin = await app.listen({ host: '127.0.0.1', port: 0 });
  let closed = false;
  const startProxy = async (options) => {
    const proxy = await startTusFaultProxy({ ...options, upstreamURL: upstreamOrigin });
    return {
      ...proxy,
      close: async () => {
        closed = true;
        await proxy.close();
      },
    };
  };
  let workerRuns = 0;
  const sleep = async (milliseconds) => {
    wallTime += milliseconds;
    workerRuns += 1;
    await processNextValidationJob({
      repository,
      blobStore,
      workerId: `deployed-tus-${workerRuns}`,
      validatePackage: createCreatorPackageValidator(),
    });
  };

  const receipt = await runDeployedTusResumeAcceptance(config(), {
    startProxy,
    fetchImpl: fetchThroughFastify(app),
    now: () => wallTime,
    sleep,
    randomUUID: () => '12345678-1234-4abc-8def-123456789abc',
  });

  assert.equal(receipt.format, DEPLOYED_TUS_ACCEPTANCE_FORMAT);
  assert.equal(receipt.status, 'passed');
  assert.deepEqual(receipt.release, expectedRelease);
  assert.deepEqual(receipt.readiness, { status: 'ready' });
  assert.equal(receipt.resume.interruptedAtBytes, 17);
  assert.equal(receipt.resume.authoritativeHeadOffset, 17);
  assert.equal(receipt.resume.submissionCreates, 1);
  assert.equal(receipt.resume.uploadCreates, 1);
  assert.deepEqual(receipt.resume.patchOffsets.slice(0, 2), [0, 17]);
  assert.equal(receipt.download.exactBytes, true);
  assert.equal(receipt.download.sha256, receipt.package.sha256);
  assert.equal(receipt.cleanup, 'unlisted');
  assert.equal(await repository.getPublishedEdition(receipt.editionId), null);
  assert.equal(closed, true);
  const serialized = JSON.stringify(receipt);
  assert.equal(serialized.includes('creator-secret'), false);
  assert.equal(serialized.includes('admin-secret'), false);
});

test('release mismatch and failed readiness stop before proxy or content mutation', async () => {
  let proxyStarts = 0;
  let packageCreates = 0;
  const startProxy = async () => {
    proxyStarts += 1;
    assert.fail('identity and readiness gates must run before the fault proxy');
  };
  const createPackage = async () => {
    packageCreates += 1;
    assert.fail('identity and readiness gates must run before package creation');
  };

  let calls = [];
  await assert.rejects(
    runDeployedTusResumeAcceptance(config(), {
      fetchImpl: async (input) => {
        calls.push(new URL(input).pathname);
        return Response.json({
          format: 'revealline-community-release.v1',
          ...expectedRelease,
          sourceRevision: '12978e5fd3fe0ce70bbee96aa543f569f64622d4',
        });
      },
      startProxy,
      createPackage,
      randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
    }),
    (error) => {
      assert.equal(error.stage, 'identity');
      assert.equal(error.receipt.cleanup, 'not-required');
      return true;
    },
  );
  assert.deepEqual(calls, ['/version']);

  calls = [];
  await assert.rejects(
    runDeployedTusResumeAcceptance(config(), {
      fetchImpl: async (input) => {
        const pathname = new URL(input).pathname;
        calls.push(pathname);
        if (pathname === '/version')
          return Response.json({ format: 'revealline-community-release.v1', ...expectedRelease });
        if (pathname === '/health') return Response.json({ status: 'ok' });
        return Response.json(
          { error: { code: 'internal_error', message: 'not ready' } },
          { status: 503 },
        );
      },
      startProxy,
      createPackage,
      randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
    }),
    (error) => {
      assert.equal(error.stage, 'readiness');
      assert.deepEqual(error.receipt.release, expectedRelease);
      assert.equal(error.receipt.cleanup, 'not-required');
      return true;
    },
  );
  assert.deepEqual(calls, ['/version', '/health', '/ready']);
  assert.equal(proxyStarts, 0);
  assert.equal(packageCreates, 0);
});

test('CLI reserves an owner-only redacted failure receipt', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revealline-deployed-tus-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const receiptPath = path.join(directory, 'receipt.json');
  const result = spawnSync(process.execPath, ['src/deployed-tus-resume-runner.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      COMMUNITY_TUS_ACCEPTANCE_BASE_URL: 'https://community.example.test/',
      COMMUNITY_TUS_ACCEPTANCE_NAMESPACE: 'cli-tus-20260926',
      COMMUNITY_TUS_ACCEPTANCE_ALLOW_DESTRUCTIVE: 'not-approved',
      COMMUNITY_TUS_ACCEPTANCE_EXPECTED_VERSION: expectedRelease.version,
      COMMUNITY_TUS_ACCEPTANCE_EXPECTED_SOURCE_REVISION: expectedRelease.sourceRevision,
      COMMUNITY_TUS_ACCEPTANCE_EXPECTED_VALIDATOR_VERSION: expectedRelease.validatorVersion,
      COMMUNITY_TUS_ACCEPTANCE_CREATOR_AUTHORIZATION: 'Bearer creator-secret',
      COMMUNITY_TUS_ACCEPTANCE_ADMIN_AUTHORIZATION: 'Bearer admin-secret',
      COMMUNITY_TUS_ACCEPTANCE_RECEIPT: receiptPath,
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /failed at configuration/u);
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /creator-secret|admin-secret/u);
  const receipt = await readFile(receiptPath, 'utf8');
  assert.doesNotMatch(receipt, /creator-secret|admin-secret/u);
  assert.deepEqual(JSON.parse(receipt), {
    format: DEPLOYED_TUS_ACCEPTANCE_FORMAT,
    status: 'failed',
    failedStage: 'configuration',
    errorCode: 'invalid_acceptance_configuration',
  });
  if (process.platform !== 'win32') {
    const { mode } = await import('node:fs/promises').then(({ stat }) => stat(receiptPath));
    assert.equal(mode & 0o777, 0o600);
  }
});
