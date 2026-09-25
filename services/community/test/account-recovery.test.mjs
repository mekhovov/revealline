import assert from 'node:assert/strict';
import test from 'node:test';
import { memoryAdapter } from '@better-auth/memory-adapter';
import {
  MemoryAccountMailDelivery,
  createAccountMailCallbacks,
  createWebhookAccountMailDelivery,
} from '../src/account-mail.mjs';
import { createCommunityBetterAuth } from '../src/better-auth-runtime.mjs';
import { readConfig } from '../src/config.mjs';

const secret = 'test-secret-that-is-longer-than-thirty-two-characters';
const webhookToken = 'mail-webhook-token-that-is-long-enough-for-production';

const productionEnvironment = (overrides = {}) => ({
  BETTER_AUTH_SECRET: secret,
  BETTER_AUTH_URL: 'https://community.example.test',
  BETTER_AUTH_TRUSTED_ORIGINS: 'https://game.example.test',
  COMMUNITY_ACCOUNT_MAIL_WEBHOOK_URL: 'https://mail.example.test/revealline',
  COMMUNITY_ACCOUNT_MAIL_WEBHOOK_TOKEN: webhookToken,
  ...overrides,
});

const authRequest = async (auth, path, { method = 'POST', body, headers = {} } = {}) => {
  const response = await auth.handler(
    new Request(new URL(path, 'https://community.test/api/auth/'), {
      method,
      redirect: 'manual',
      headers: {
        ...(method === 'POST'
          ? { 'content-type': 'application/json', origin: 'https://community.test' }
          : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  const text = await response.text();
  return { response, value: text ? JSON.parse(text) : null };
};

test('production account recovery configuration requires bounded HTTPS origins and mail secrets', () => {
  const config = readConfig(productionEnvironment());
  assert.deepEqual(config.betterAuth.trustedOrigins, ['https://game.example.test']);
  assert.equal(config.betterAuth.emailVerificationExpiresIn, 3_600);
  assert.equal(config.betterAuth.passwordResetExpiresIn, 1_800);
  assert.deepEqual(config.betterAuth.mail, {
    endpoint: 'https://mail.example.test/revealline',
    authorizationToken: webhookToken,
    timeoutMs: 5_000,
  });
  for (const [environment, pattern] of [
    [productionEnvironment({ BETTER_AUTH_URL: 'http://community.example.test' }), /HTTPS origin/u],
    [
      productionEnvironment({ BETTER_AUTH_TRUSTED_ORIGINS: 'https://game.example.test/path' }),
      /HTTPS origin/u,
    ],
    [
      productionEnvironment({ COMMUNITY_ACCOUNT_MAIL_WEBHOOK_URL: 'http://mail.example.test' }),
      /HTTPS URL/u,
    ],
    [productionEnvironment({ COMMUNITY_ACCOUNT_MAIL_WEBHOOK_TOKEN: 'short' }), /32–4096/u],
    [
      productionEnvironment({ COMMUNITY_PASSWORD_RESET_EXPIRES_SECONDS: '299' }),
      /between 300 and 3600/u,
    ],
  ])
    assert.throws(() => readConfig(environment), pattern);
});

test('account mail callbacks bind bounded tokens and URLs to the configured action origin', async () => {
  const delivery = new MemoryAccountMailDelivery();
  const callbacks = createAccountMailCallbacks({
    delivery,
    actionBaseURL: 'https://community.test',
    emailVerificationExpiresIn: 600,
    passwordResetExpiresIn: 300,
    now: () => new Date('2026-09-25T00:00:00.000Z'),
  });
  await callbacks.sendVerificationEmail({
    user: { email: 'creator@example.test' },
    token: 'verification-token',
    url: 'https://community.test/api/auth/verify-email?token=verification-token',
  });
  assert.deepEqual(delivery.messages()[0], {
    id: delivery.messages()[0].id,
    kind: 'verify-email',
    to: 'creator@example.test',
    actionURL: 'https://community.test/api/auth/verify-email?token=verification-token',
    expiresAt: '2026-09-25T00:10:00.000Z',
  });
  assert.match(delivery.messages()[0].id, /^[a-f0-9]{64}$/u);
  await assert.rejects(
    callbacks.sendResetPassword({
      user: { email: 'creator@example.test' },
      token: 'reset-token',
      url: 'https://attacker.example/api/auth/reset-password/reset-token',
    }),
    /unexpected origin/u,
  );
  await assert.rejects(
    callbacks.sendVerificationEmail({
      user: { email: 'creator@example.test' },
      token: 'x'.repeat(4_097),
      url: 'https://community.test/api/auth/verify-email?token=x',
    }),
    /token is invalid/u,
  );
  assert.equal(delivery.messages().length, 1);
  assert.throws(
    () =>
      createAccountMailCallbacks({
        delivery,
        actionBaseURL: 'https://community.test',
        emailVerificationExpiresIn: 299,
        passwordResetExpiresIn: 300,
      }),
    /verification expiry/u,
  );
});

test('HTTPS webhook adapter sends one bounded message without exposing credentials in errors', async () => {
  const requests = [];
  const delivery = createWebhookAccountMailDelivery({
    endpoint: 'https://mail.example.test/deliver',
    authorizationToken: webhookToken,
    timeoutMs: 1_000,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return new Response(null, { status: 202 });
    },
  });
  const message = {
    id: 'a'.repeat(64),
    kind: 'reset-password',
    to: 'creator@example.test',
    actionURL: 'https://community.example.test/api/auth/reset-password/token',
    expiresAt: '2026-09-25T00:30:00.000Z',
  };
  await delivery.deliver(message);
  assert.equal(requests[0].url, 'https://mail.example.test/deliver');
  assert.equal(requests[0].init.redirect, 'error');
  assert.equal(requests[0].init.headers.authorization, `Bearer ${webhookToken}`);
  assert.deepEqual(JSON.parse(requests[0].init.body), message);

  const failing = createWebhookAccountMailDelivery({
    endpoint: 'https://mail.example.test/deliver',
    authorizationToken: webhookToken,
    timeoutMs: 1_000,
    fetchImpl: async () => new Response(null, { status: 503 }),
  });
  await assert.rejects(failing.deliver(message), /^Error: Account mail delivery failed\.$/u);
});

test('Better Auth verifies email and completes password recovery through the mail boundary', async () => {
  const delivery = new MemoryAccountMailDelivery();
  const auth = createCommunityBetterAuth({
    database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
    baseURL: 'https://community.test',
    secret,
    trustedOrigins: ['https://community.test'],
    mailDelivery: delivery,
    emailVerificationExpiresIn: 600,
    passwordResetExpiresIn: 300,
  });
  const signUp = await authRequest(auth, 'sign-up/email', {
    body: {
      name: 'Creator One',
      email: 'creator@example.test',
      password: 'correct horse battery staple',
    },
  });
  assert.equal(signUp.response.status, 200);
  assert.equal(signUp.value.token, null);
  assert.equal(signUp.value.user.emailVerified, false);
  assert.equal(delivery.messages()[0].kind, 'verify-email');

  const blocked = await authRequest(auth, 'sign-in/email', {
    body: { email: 'creator@example.test', password: 'correct horse battery staple' },
  });
  assert.equal(blocked.response.status, 403);
  assert.equal(delivery.messages().length, 2);

  const verification = await auth.handler(
    new Request(delivery.messages()[0].actionURL, { redirect: 'manual' }),
  );
  assert.equal(verification.status, 302);
  const signedIn = await authRequest(auth, 'sign-in/email', {
    body: { email: 'creator@example.test', password: 'correct horse battery staple' },
  });
  assert.equal(signedIn.response.status, 200);
  assert.equal(signedIn.value.user.emailVerified, true);
  const signedInCookie = signedIn.response.headers.get('set-cookie').split(';')[0];

  const resetRequest = await authRequest(auth, 'request-password-reset', {
    body: {
      email: 'creator@example.test',
      redirectTo: 'https://community.test/account/reset-password',
    },
  });
  assert.equal(resetRequest.response.status, 200);
  const resetMessage = delivery.messages().at(-1);
  assert.equal(resetMessage.kind, 'reset-password');
  assert.doesNotMatch(resetMessage.actionURL, /correct horse/u);

  const resetCallback = await auth.handler(
    new Request(resetMessage.actionURL, { redirect: 'manual' }),
  );
  assert.equal(resetCallback.status, 302);
  const resetToken = new URL(resetCallback.headers.get('location')).searchParams.get('token');
  assert.ok(resetToken);
  const reset = await authRequest(auth, 'reset-password', {
    body: { token: resetToken, newPassword: 'new correct horse battery staple' },
  });
  assert.equal(reset.response.status, 200);
  const revoked = await authRequest(auth, 'get-session', {
    method: 'GET',
    headers: { cookie: signedInCookie },
  });
  assert.equal(revoked.value, null);
  const reusedReset = await authRequest(auth, 'reset-password', {
    body: { token: resetToken, newPassword: 'another correct horse battery staple' },
  });
  assert.equal(reusedReset.response.status, 400);
  const oldPassword = await authRequest(auth, 'sign-in/email', {
    body: { email: 'creator@example.test', password: 'correct horse battery staple' },
  });
  assert.equal(oldPassword.response.status, 401);
  const newPassword = await authRequest(auth, 'sign-in/email', {
    body: { email: 'creator@example.test', password: 'new correct horse battery staple' },
  });
  assert.equal(newPassword.response.status, 200);
});
