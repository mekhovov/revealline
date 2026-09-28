import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  ACCOUNT_BOOTSTRAP_OPT_IN,
  DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT,
  runDeployedAccountBootstrap,
  validateDeployedAccountBootstrapConfig,
} from '../src/deployed-account-bootstrap.mjs';

const expectedRelease = Object.freeze({
  version: 'v0.141.7',
  sourceRevision: 'efbb3882b4edd447c8e9f60ed60c536a956d78f3',
});
const password = 'correct horse battery staple';
const config = (overrides = {}) => ({
  baseURL: 'https://community.example.test/',
  namespace: 'account-check-20260928',
  optIn: ACCOUNT_BOOTSTRAP_OPT_IN,
  expectedRelease,
  creators: {
    creatorA: { name: 'Creator A', email: 'creator-a@example.test', password },
    creatorB: { name: 'Creator B', email: 'creator-b@example.test', password },
  },
  admin: { authorization: 'Bearer administrator-secret' },
  mailCapture: {
    url: 'https://mail.example.test/messages',
    authorizationToken: 'capture-reader-token-that-is-long-enough',
  },
  requestTimeoutMs: 1_000,
  pollIntervalMs: 50,
  mailTimeoutMs: 5_000,
  ...overrides,
});

test('account bootstrap configuration requires HTTPS, disposable opt-in, and bounded actors', () => {
  const accepted = validateDeployedAccountBootstrapConfig(config());
  assert.equal(accepted.baseURL, 'https://community.example.test/');
  assert.equal(Object.isFrozen(accepted.creators.creatorA), true);
  assert.throws(
    () => validateDeployedAccountBootstrapConfig(config({ optIn: 'yes' })),
    /disposable-account acceptance opt-in/u,
  );
  assert.throws(
    () =>
      validateDeployedAccountBootstrapConfig(config({ baseURL: 'http://community.example.test/' })),
    /absolute HTTPS URL/u,
  );
  assert.throws(
    () =>
      validateDeployedAccountBootstrapConfig(
        config({ mailCapture: { url: 'https://mail.example.test/', authorizationToken: 'short' } }),
      ),
    /authorization token is invalid/u,
  );
  assert.throws(
    () =>
      validateDeployedAccountBootstrapConfig(
        config({
          creators: {
            ...config().creators,
            creatorA: { ...config().creators.creatorA, unexpected: true },
          },
        }),
      ),
    /name, email, and password only/u,
  );
});

test('account bootstrap verifies two captured accounts and the allowlisted administrator', async () => {
  const verified = new Set();
  const capturePolls = new Map();
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    calls.push(`${init.method ?? 'GET'} ${url.origin}${url.pathname}`);
    if (url.pathname === '/version')
      return Response.json({ format: 'revealline-community-release.v1', ...expectedRelease });
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    if (url.pathname === '/ready') return Response.json({ status: 'ready' });
    if (url.pathname === '/api/auth/sign-up/email') {
      assert.equal(init.headers.origin, 'https://community.example.test');
      const account = JSON.parse(init.body);
      assert.equal(account.password, password);
      return Response.json({
        token: null,
        user: { email: account.email, emailVerified: false },
      });
    }
    if (url.origin === 'https://mail.example.test') {
      assert.equal(init.headers.authorization, 'Bearer capture-reader-token-that-is-long-enough');
      const request = JSON.parse(init.body);
      assert.equal(request.kind, 'verify-email');
      assert.match(request.after, /^2026-09-28T02:00/u);
      const email = request.to;
      const polls = (capturePolls.get(email) ?? 0) + 1;
      capturePolls.set(email, polls);
      if (polls === 1) return new Response(null, { status: 404 });
      const token = email.startsWith('creator-a') ? 'token-a' : 'token-b';
      return Response.json({
        message: {
          id: (email.startsWith('creator-a') ? 'a' : 'b').repeat(64),
          kind: 'verify-email',
          to: email,
          actionURL: `https://community.example.test/api/auth/verify-email?token=${token}`,
          expiresAt: '2026-09-28T03:00:00.000Z',
        },
      });
    }
    if (url.pathname === '/api/auth/verify-email') {
      verified.add(url.searchParams.get('token'));
      return new Response(null, { status: 302, headers: { location: '/' } });
    }
    if (url.pathname === '/api/auth/sign-in/email') {
      const account = JSON.parse(init.body);
      assert.equal(
        verified.has(account.email.startsWith('creator-a') ? 'token-a' : 'token-b'),
        true,
      );
      return Response.json(
        { user: { email: account.email } },
        {
          headers: {
            'set-cookie': `better-auth.session_token=${account.email}; Path=/; HttpOnly; Secure`,
          },
        },
      );
    }
    if (url.pathname === '/api/auth/get-session') {
      const email = init.headers.cookie.split('=')[1];
      return Response.json({ user: { email, emailVerified: true } });
    }
    if (url.pathname === '/v1/admin/reports') {
      assert.equal(init.headers.authorization, 'Bearer administrator-secret');
      return Response.json({ reports: [], nextCursor: null });
    }
    assert.fail(`Unexpected request ${url.href}`);
  };
  let wallTime = Date.parse('2026-09-28T02:00:00.000Z');
  const receipt = await runDeployedAccountBootstrap(config(), {
    fetchImpl,
    now: () => wallTime,
    sleep: async (milliseconds) => {
      wallTime += milliseconds;
    },
    randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
  });
  assert.equal(receipt.format, DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT);
  assert.equal(receipt.status, 'passed');
  assert.deepEqual(receipt.release, expectedRelease);
  assert.deepEqual(receipt.accounts, {
    creatorsVerified: 2,
    mailPolls: { creatorA: 2, creatorB: 2 },
  });
  assert.deepEqual(receipt.administrator, { roleBound: true });
  const serialized = JSON.stringify(receipt);
  assert.doesNotMatch(
    serialized,
    /creator-a@example|creator-b@example|correct horse|administrator-secret|capture-reader/u,
  );
  assert.deepEqual(calls.slice(0, 3), [
    'GET https://community.example.test/version',
    'GET https://community.example.test/health',
    'GET https://community.example.test/ready',
  ]);
});

test('account bootstrap fails closed on a foreign verification action without exposing secrets', async () => {
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/version')
      return Response.json({ format: 'revealline-community-release.v1', ...expectedRelease });
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    if (url.pathname === '/ready') return Response.json({ status: 'ready' });
    if (url.pathname === '/api/auth/sign-up/email') {
      const account = JSON.parse(init.body);
      return Response.json({
        token: null,
        user: { email: account.email, emailVerified: false },
      });
    }
    if (url.origin === 'https://mail.example.test')
      return Response.json({
        message: {
          id: 'a'.repeat(64),
          kind: 'verify-email',
          to: 'creator-a@example.test',
          actionURL: 'https://attacker.example.test/api/auth/verify-email?token=stolen',
          expiresAt: '2026-09-28T03:00:00.000Z',
        },
      });
    assert.fail('Foreign verification action must stop account bootstrap.');
  };
  await assert.rejects(
    runDeployedAccountBootstrap(config(), {
      fetchImpl,
      randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
    }),
    (error) => {
      assert.equal(error.stage, 'creatorA-verification');
      assert.doesNotMatch(JSON.stringify(error.receipt), /correct horse|capture-reader|stolen/u);
      return true;
    },
  );
});

test('account bootstrap bounds a stalled mail-capture body and cancels without exposing secrets', async () => {
  let cancelled = false;
  const startedAt = Date.now();
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/version')
      return Response.json({ format: 'revealline-community-release.v1', ...expectedRelease });
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    if (url.pathname === '/ready') return Response.json({ status: 'ready' });
    if (url.pathname === '/api/auth/sign-up/email') {
      const account = JSON.parse(init.body);
      return Response.json({
        token: null,
        user: { email: account.email, emailVerified: false },
      });
    }
    if (url.origin === 'https://mail.example.test')
      return new Response(
        new ReadableStream({
          cancel() {
            cancelled = true;
            return new Promise(() => {});
          },
        }),
      );
    assert.fail('Stalled mail capture must stop account bootstrap.');
  };
  await assert.rejects(
    runDeployedAccountBootstrap(config({ requestTimeoutMs: 100 }), {
      fetchImpl,
      randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
    }),
    (error) => {
      assert.equal(error.stage, 'creatorA-verification');
      assert.equal(error.cause.message, 'Mail capture timed out.');
      assert.doesNotMatch(JSON.stringify(error.receipt), /correct horse|capture-reader/u);
      return true;
    },
  );
  assert.equal(cancelled, true);
  assert.ok(Date.now() - startedAt < 1_000);
});

test('account bootstrap sanitizes mail-capture transport failures', async () => {
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    if (url.pathname === '/version')
      return Response.json({ format: 'revealline-community-release.v1', ...expectedRelease });
    if (url.pathname === '/health') return Response.json({ status: 'ok' });
    if (url.pathname === '/ready') return Response.json({ status: 'ready' });
    if (url.pathname === '/api/auth/sign-up/email') {
      const account = JSON.parse(init.body);
      return Response.json({
        token: null,
        user: { email: account.email, emailVerified: false },
      });
    }
    if (url.origin === 'https://mail.example.test') throw new Error(`transport ${password}`);
    assert.fail('Mail transport failure must stop account bootstrap.');
  };
  await assert.rejects(
    runDeployedAccountBootstrap(config(), {
      fetchImpl,
      randomUUID: () => 'abcdef12-1234-4abc-8def-123456789abc',
    }),
    (error) => {
      assert.equal(error.stage, 'creatorA-verification');
      assert.equal(error.cause.message, 'Mail capture failed.');
      assert.doesNotMatch(`${error.message}${JSON.stringify(error.receipt)}`, /correct horse/u);
      return true;
    },
  );
});

test('account bootstrap CLI reserves one redacted receipt', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'revealline-account-bootstrap-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const receiptPath = path.join(directory, 'receipt.json');
  const result = spawnSync(process.execPath, ['src/deployed-account-bootstrap-runner.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      COMMUNITY_ACCOUNT_ACCEPTANCE_BASE_URL: 'https://community.example.test/',
      COMMUNITY_ACCOUNT_ACCEPTANCE_NAMESPACE: 'cli-account-20260928',
      COMMUNITY_ACCOUNT_ACCEPTANCE_ALLOW_DESTRUCTIVE: 'not-approved',
      COMMUNITY_ACCOUNT_ACCEPTANCE_EXPECTED_VERSION: expectedRelease.version,
      COMMUNITY_ACCOUNT_ACCEPTANCE_EXPECTED_SOURCE_REVISION: expectedRelease.sourceRevision,
      COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_A_NAME: 'Creator A',
      COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_A_EMAIL: 'creator-a@example.test',
      COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_A_PASSWORD: password,
      COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_B_NAME: 'Creator B',
      COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_B_EMAIL: 'creator-b@example.test',
      COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_B_PASSWORD: password,
      COMMUNITY_ACCOUNT_ACCEPTANCE_ADMIN_AUTHORIZATION: 'Bearer administrator-secret',
      COMMUNITY_ACCOUNT_ACCEPTANCE_MAIL_CAPTURE_URL: 'https://mail.example.test/messages',
      COMMUNITY_ACCOUNT_ACCEPTANCE_MAIL_CAPTURE_TOKEN: 'capture-reader-token-that-is-long-enough',
      COMMUNITY_ACCOUNT_ACCEPTANCE_RECEIPT: receiptPath,
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /failed at configuration/u);
  assert.doesNotMatch(
    `${result.stdout}${result.stderr}`,
    /correct horse|administrator-secret|capture-reader/u,
  );
  const receipt = await readFile(receiptPath, 'utf8');
  assert.doesNotMatch(receipt, /correct horse|administrator-secret|capture-reader/u);
  assert.deepEqual(JSON.parse(receipt), {
    format: DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT,
    status: 'failed',
    failedStage: 'configuration',
    errorCode: 'invalid_acceptance_configuration',
  });
});
