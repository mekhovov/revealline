import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolveDeployedAcceptanceAccount,
  validateDeployedAcceptanceAccount,
} from '../src/deployed-acceptance-auth.mjs';

test('deployed acceptance accounts accept one bounded header or password credential form', () => {
  const headers = validateDeployedAcceptanceAccount(
    { cookie: 'better-auth.session_token=short-lived' },
    'Creator authentication',
  );
  assert.deepEqual(headers, { cookie: 'better-auth.session_token=short-lived' });

  const credentials = validateDeployedAcceptanceAccount(
    { email: 'creator@example.test', password: 'correct horse battery staple' },
    'Creator authentication',
  );
  assert.deepEqual(credentials, {
    email: 'creator@example.test',
    password: 'correct horse battery staple',
  });
  assert.equal(Object.isFrozen(credentials), true);

  assert.throws(
    () =>
      validateDeployedAcceptanceAccount(
        {
          cookie: 'better-auth.session_token=old',
          email: 'creator@example.test',
          password: 'correct horse battery staple',
        },
        'Creator authentication',
      ),
    /exactly one credential form/u,
  );
  assert.throws(
    () =>
      validateDeployedAcceptanceAccount(
        { email: 'creator@example.test' },
        'Creator authentication',
      ),
    /exactly one credential form/u,
  );
  assert.throws(
    () =>
      validateDeployedAcceptanceAccount(
        { email: 'creator@example.test', password: 'short' },
        'Creator authentication',
      ),
    /password is invalid/u,
  );
});

test('deployed acceptance signs in verified accounts and retains only the session cookie', async () => {
  const credentials = validateDeployedAcceptanceAccount(
    { email: 'creator@example.test', password: 'correct horse battery staple' },
    'Creator authentication',
  );
  let calls = 0;
  const resolved = await resolveDeployedAcceptanceAccount(credentials, {
    baseURL: 'https://community.example.test/',
    fetchImpl: async (input, init) => {
      calls += 1;
      assert.equal(new URL(input).href, 'https://community.example.test/api/auth/sign-in/email');
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      assert.deepEqual(JSON.parse(init.body), credentials);
      return new Response(JSON.stringify({ user: { id: 'not-retained' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'set-cookie':
            'better-auth.session_token=short-lived-session; Path=/; HttpOnly; Secure; SameSite=Lax',
        },
      });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(resolved, { cookie: 'better-auth.session_token=short-lived-session' });
  assert.equal(JSON.stringify(resolved).includes(credentials.password), false);
});

test('deployed acceptance sign-in fails closed without exposing credentials', async () => {
  const credentials = validateDeployedAcceptanceAccount(
    { email: 'creator@example.test', password: 'correct horse battery staple' },
    'Creator authentication',
  );
  await assert.rejects(
    resolveDeployedAcceptanceAccount(credentials, {
      baseURL: 'https://community.example.test/',
      fetchImpl: async () => Response.json({ message: credentials.password }, { status: 401 }),
    }),
    (error) => {
      assert.equal(error.message, 'Account sign-in failed (401).');
      assert.equal(error.message.includes(credentials.password), false);
      return true;
    },
  );
  await assert.rejects(
    resolveDeployedAcceptanceAccount(credentials, {
      baseURL: 'https://community.example.test/',
      fetchImpl: async () => Response.json({ ok: true }),
    }),
    /did not return a bounded session cookie/u,
  );
  await assert.rejects(
    resolveDeployedAcceptanceAccount(credentials, {
      baseURL: 'https://community.example.test/',
      fetchImpl: async () =>
        new Response('{}', {
          headers: { 'set-cookie': 'better-auth.session_token=readable; Path=/; Secure' },
        }),
    }),
    /did not return a bounded session cookie/u,
  );
});
