import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildCommunityApp } from '../src/app.mjs';
import { createTokenAuthenticator } from '../src/auth.mjs';
import { MemoryBlobStore } from '../src/blob-store.mjs';
import {
  DEPLOYED_ACCEPTANCE_FORMAT,
  DESTRUCTIVE_OPT_IN,
  runDeployedCommunityJourney,
  validateDeployedJourneyConfig,
} from '../src/deployed-journey.mjs';
import { MemoryCommunityRepository } from '../src/memory-repository.mjs';
import { processNextValidationJob } from '../src/worker.mjs';

const bearer = (token) => ({ authorization: `Bearer ${token}` });
const config = (overrides = {}) => ({
  baseURL: 'https://community.example.test/',
  namespace: 'deploy-check-20260926',
  optIn: DESTRUCTIVE_OPT_IN,
  auth: {
    creatorA: bearer('creator-a-secret'),
    creatorB: bearer('creator-b-secret'),
    admin: bearer('admin-secret'),
  },
  requestTimeoutMs: 1_000,
  pollIntervalMs: 50,
  validationTimeoutMs: 5_000,
  ...overrides,
});

const fetchThroughFastify =
  (app) =>
  async (input, init = {}) => {
    const url = new URL(input);
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

test('configuration requires explicit destructive opt-in, a unique namespace and three accounts', () => {
  assert.throws(
    () => validateDeployedJourneyConfig(config({ optIn: 'yes' })),
    /destructive acceptance opt-in/u,
  );
  assert.throws(
    () => validateDeployedJourneyConfig(config({ namespace: 'shared' })),
    /unique 8-40 character/u,
  );
  assert.throws(
    () => validateDeployedJourneyConfig(config({ auth: { ...config().auth, admin: {} } })),
    /Administrator authentication/u,
  );
  const accepted = validateDeployedJourneyConfig(config());
  assert.equal(accepted.baseURL, 'https://community.example.test/');
  assert.equal(Object.isFrozen(accepted.auth.creatorA), true);
  assert.equal(
    validateDeployedJourneyConfig(
      config({
        auth: {
          creatorA: { cookie: 'session=a' },
          creatorB: { cookie: 'session=b' },
          admin: { cookie: 'session=admin' },
        },
      }),
    ).auth.admin.cookie,
    'session=admin',
  );
});

test('deployed journey publishes, polls, isolates owners, downloads exact bytes and moderates', async (t) => {
  let wallTime = Date.parse('2026-09-26T12:00:00.000Z');
  const repository = new MemoryCommunityRepository({ clock: () => new Date(wallTime) });
  const blobStore = new MemoryBlobStore();
  const app = buildCommunityApp({
    repository,
    blobStore,
    authenticator: createTokenAuthenticator({
      'creator-a-secret': 'creator/a',
      'creator-b-secret': 'creator/b',
      'admin-secret': { subject: 'administrator/acceptance', roles: ['admin'] },
    }),
    maxPackageBytes: 16 * 1024 * 1024,
  });
  await app.ready();
  t.after(() => app.close());

  let workerRuns = 0;
  const sleep = async (milliseconds) => {
    wallTime += milliseconds;
    workerRuns += 1;
    await processNextValidationJob({
      repository,
      blobStore,
      workerId: `deployed-test-${workerRuns}`,
      validatePackage: async () => ({
        accepted: true,
        report: { compiler: 'passed', replay: 'passed' },
      }),
    });
  };
  const receipt = await runDeployedCommunityJourney(config(), {
    fetchImpl: fetchThroughFastify(app),
    now: () => wallTime,
    sleep,
    randomUUID: () => '12345678-1234-4abc-8def-123456789abc',
  });

  assert.equal(receipt.format, DEPLOYED_ACCEPTANCE_FORMAT);
  assert.equal(receipt.status, 'passed');
  assert.match(receipt.editionId, /^ed_[a-f0-9]{64}$/u);
  assert.equal(receipt.validation.status, 'published');
  assert.equal(receipt.discovery.creatorBIsolation, true);
  assert.equal(receipt.discovery.exactDownload, true);
  assert.equal(receipt.discovery.sha256, receipt.package.sha256);
  assert.equal(receipt.play.completionReloaded, true);
  assert.match(receipt.play.pictureSha256, /^[a-f0-9]{64}$/u);
  assert.equal(receipt.moderation.reportStatus, 'resolved');
  assert.equal(receipt.moderation.editionStatus, 'unlisted');
  assert.deepEqual(receipt.offline, { exactEditionReloaded: true, replayStarted: true });
  assert.equal(await repository.getPublishedEdition(receipt.editionId), null);
  const reports = await repository.listReports({ status: 'resolved', limit: 10, cursor: null });
  assert.equal(reports.rows[0].id, receipt.moderation.reportId);
  const serialized = JSON.stringify(receipt);
  for (const secret of ['creator-a-secret', 'creator-b-secret', 'admin-secret'])
    assert.equal(serialized.includes(secret), false);
});

test('failure emits a bounded redacted receipt and never runs after missing opt-in', async () => {
  let calls = 0;
  await assert.rejects(
    runDeployedCommunityJourney(config({ optIn: '' }), {
      fetchImpl: async () => {
        calls += 1;
        return Response.json({ status: 'ok' });
      },
    }),
    /opt-in/u,
  );
  assert.equal(calls, 0);

  let thrown;
  try {
    await runDeployedCommunityJourney(config(), {
      fetchImpl: async () =>
        Response.json(
          { error: { message: 'admin-secret must never reach the receipt' } },
          { status: 503 },
        ),
      now: () => Date.parse('2026-09-26T12:00:00.000Z'),
      randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
    });
  } catch (error) {
    thrown = error;
  }
  assert.equal(thrown.name, 'DeployedCommunityAcceptanceError');
  assert.equal(thrown.stage, 'health');
  assert.equal(thrown.receipt.status, 'failed');
  assert.equal(thrown.receipt.failedStage, 'health');
  assert.equal(JSON.stringify(thrown.receipt).includes('admin-secret'), false);
  assert.equal(String(thrown).includes('admin-secret'), false);
});

test('CLI writes a versioned failure receipt without printing supplied secrets', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revealline-deployed-acceptance-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const receiptPath = path.join(directory, 'receipt.json');
  const result = spawnSync(process.execPath, ['src/deployed-journey-runner.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      COMMUNITY_ACCEPTANCE_BASE_URL: 'https://community.example.test/',
      COMMUNITY_ACCEPTANCE_NAMESPACE: 'cli-check-20260926',
      COMMUNITY_ACCEPTANCE_ALLOW_DESTRUCTIVE: 'not-approved',
      COMMUNITY_ACCEPTANCE_CREATOR_A_AUTHORIZATION: 'Bearer cli-creator-a-secret',
      COMMUNITY_ACCEPTANCE_CREATOR_B_AUTHORIZATION: 'Bearer cli-creator-b-secret',
      COMMUNITY_ACCEPTANCE_ADMIN_AUTHORIZATION: 'Bearer cli-admin-secret',
      COMMUNITY_ACCEPTANCE_RECEIPT: receiptPath,
    },
  });
  assert.equal(result.status, 1);
  const output = `${result.stdout}\n${result.stderr}`;
  for (const secret of ['cli-creator-a-secret', 'cli-creator-b-secret', 'cli-admin-secret'])
    assert.equal(output.includes(secret), false);
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  assert.deepEqual(receipt, {
    format: DEPLOYED_ACCEPTANCE_FORMAT,
    status: 'failed',
    failedStage: 'configuration',
    errorCode: 'invalid_acceptance_configuration',
  });
});

test('CLI refuses to replace an existing acceptance receipt', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revealline-deployed-acceptance-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const receiptPath = path.join(directory, 'receipt.json');
  await writeFile(receiptPath, 'retained evidence\n', { mode: 0o600 });
  const result = spawnSync(process.execPath, ['src/deployed-journey-runner.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      COMMUNITY_ACCEPTANCE_BASE_URL: 'https://community.example.test/',
      COMMUNITY_ACCEPTANCE_NAMESPACE: 'cli-check-20260926',
      COMMUNITY_ACCEPTANCE_ALLOW_DESTRUCTIVE: 'not-approved',
      COMMUNITY_ACCEPTANCE_CREATOR_A_AUTHORIZATION: 'Bearer cli-creator-a-secret',
      COMMUNITY_ACCEPTANCE_CREATOR_B_AUTHORIZATION: 'Bearer cli-creator-b-secret',
      COMMUNITY_ACCEPTANCE_ADMIN_AUTHORIZATION: 'Bearer cli-admin-secret',
      COMMUNITY_ACCEPTANCE_RECEIPT: receiptPath,
    },
  });
  assert.equal(result.status, 1);
  assert.equal(await readFile(receiptPath, 'utf8'), 'retained evidence\n');
  assert.match(result.stderr, /destination already exists/u);
  const output = `${result.stdout}\n${result.stderr}`;
  for (const secret of ['cli-creator-a-secret', 'cli-creator-b-secret', 'cli-admin-secret'])
    assert.equal(output.includes(secret), false);
});

test('owner isolation requires the exact owner-scoped not-found response', async (t) => {
  const repository = new MemoryCommunityRepository();
  const blobStore = new MemoryBlobStore();
  const app = buildCommunityApp({
    repository,
    blobStore,
    authenticator: createTokenAuthenticator({
      'creator-a-secret': 'creator/a',
      'creator-b-secret': 'creator/b',
      'admin-secret': { subject: 'administrator/acceptance', roles: ['admin'] },
    }),
    maxPackageBytes: 16 * 1024 * 1024,
  });
  await app.ready();
  t.after(() => app.close());
  const serviceFetch = fetchThroughFastify(app);
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    if (
      init.method === undefined &&
      url.pathname.startsWith('/v1/submissions/') &&
      init.headers?.authorization === 'Bearer creator-b-secret'
    ) {
      return Response.json({ error: { message: 'temporary failure' } }, { status: 503 });
    }
    return serviceFetch(input, init);
  };

  await assert.rejects(
    runDeployedCommunityJourney(config(), {
      fetchImpl,
      randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
    }),
    (error) => {
      assert.equal(error.name, 'DeployedCommunityAcceptanceError');
      assert.equal(error.stage, 'ownership');
      assert.equal(error.receipt.failedStage, 'ownership');
      return true;
    },
  );
});
