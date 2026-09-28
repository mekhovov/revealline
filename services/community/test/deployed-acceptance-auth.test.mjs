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
  assert.deepEqual(
    validateDeployedAcceptanceAccount(
      { authorization: 'Bearer short-lived', 'x-acceptance-scope': 'production' },
      'Creator authentication',
    ),
    { authorization: 'Bearer short-lived', 'x-acceptance-scope': 'production' },
  );

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
        { Authorization: 'Bearer old', Cookie: 'session=old' },
        'Creator authentication',
      ),
    /exactly one credential form/u,
  );
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

test('deployed acceptance sign-in enforces the response limit in bytes while streaming', async () => {
  const credentials = validateDeployedAcceptanceAccount(
    { email: 'creator@example.test', password: 'correct horse battery staple' },
    'Creator authentication',
  );
  const headers = {
    'set-cookie': 'better-auth.session_token=bounded; Path=/; HttpOnly; Secure',
  };

  const boundary = await resolveDeployedAcceptanceAccount(credentials, {
    baseURL: 'https://community.example.test/',
    fetchImpl: async () => new Response(new Uint8Array(64 * 1024), { headers }),
    timeoutMs: 1_000,
  });
  assert.deepEqual(boundary, { cookie: 'better-auth.session_token=bounded' });

  let multibyteCancelled = false;
  const multibyteBytes = new TextEncoder().encode('é'.repeat(40_000));
  await assert.rejects(
    resolveDeployedAcceptanceAccount(credentials, {
      baseURL: 'https://community.example.test/',
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(multibyteBytes);
            },
            cancel() {
              multibyteCancelled = true;
            },
          }),
          { headers },
        ),
      timeoutMs: 1_000,
    }),
    /returned too much data/u,
  );
  assert.equal(multibyteBytes.byteLength, 80_000);
  assert.equal(multibyteCancelled, true);

  let chunksProduced = 0;
  let streamCancelled = false;
  await assert.rejects(
    resolveDeployedAcceptanceAccount(credentials, {
      baseURL: 'https://community.example.test/',
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            pull(controller) {
              chunksProduced += 1;
              controller.enqueue(new Uint8Array(chunksProduced === 1 ? 32 * 1024 : 32 * 1024 + 1));
            },
            cancel() {
              streamCancelled = true;
            },
          }),
          { headers },
        ),
      timeoutMs: 1_000,
    }),
    /returned too much data/u,
  );
  assert.ok(chunksProduced <= 3);
  assert.equal(streamCancelled, true);
});

test('deployed acceptance sign-in times out stalled bodies and cancels them', async () => {
  const password = 'correct horse battery staple';
  const credentials = validateDeployedAcceptanceAccount(
    { email: 'creator@example.test', password },
    'Creator authentication',
  );
  let cancelled = false;
  const startedAt = Date.now();
  await assert.rejects(
    resolveDeployedAcceptanceAccount(credentials, {
      baseURL: 'https://community.example.test/',
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          {
            headers: {
              'set-cookie':
                'better-auth.session_token=never-read; Path=/; HttpOnly; Secure; SameSite=Lax',
            },
          },
        ),
      timeoutMs: 100,
    }),
    (error) => {
      assert.equal(error.message, 'Account sign-in timed out.');
      assert.equal(error.message.includes(password), false);
      return true;
    },
  );
  assert.equal(cancelled, true);
  assert.ok(Date.now() - startedAt < 1_000);
});
