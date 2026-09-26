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
const config = (overrides = {}) => ({
  baseURL: 'https://community.example.test/',
  namespace: 'tus-deploy-20260926',
  optIn: DEPLOYED_TUS_DESTRUCTIVE_OPT_IN,
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
  assert.equal(validateDeployedTusResumeConfig(config()).baseURL, config().baseURL);
});

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
    now: () => wallTime,
    sleep,
    randomUUID: () => '12345678-1234-4abc-8def-123456789abc',
  });

  assert.equal(receipt.format, DEPLOYED_TUS_ACCEPTANCE_FORMAT);
  assert.equal(receipt.status, 'passed');
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
