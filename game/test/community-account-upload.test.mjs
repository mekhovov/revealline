import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommunityAccountClient } from '../community/account.mjs';
import { createTusBrowserUpload } from '../community/tus-upload.mjs';

test('same-origin account client sends bounded JSON with cookie credentials and restores session', async () => {
  const calls = [];
  let signedIn = false;
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: new URL(url), init });
    if (new URL(url).pathname.endsWith('/sign-up/email')) {
      signedIn = true;
      return Response.json({ user: { id: 'creator-1', email: 'one@example.test', name: 'One' } });
    }
    if (new URL(url).pathname.endsWith('/sign-in/email')) {
      signedIn = true;
      return Response.json({ user: { id: 'creator-1', email: 'one@example.test', name: 'One' } });
    }
    if (new URL(url).pathname.endsWith('/get-session'))
      return Response.json(
        signedIn
          ? {
              user: { id: 'creator-1', email: 'one@example.test', name: 'One' },
              session: { expiresAt: '2026-10-01T00:00:00.000Z' },
            }
          : null,
      );
    if (new URL(url).pathname.endsWith('/sign-out')) {
      signedIn = false;
      return Response.json({ success: true });
    }
    if (
      new URL(url).pathname.endsWith('/send-verification-email') ||
      new URL(url).pathname.endsWith('/request-password-reset') ||
      new URL(url).pathname.endsWith('/reset-password')
    )
      return Response.json({ status: true });
    throw new Error(`Unexpected account request ${url}`);
  };
  const account = createCommunityAccountClient({
    baseURL: 'https://game.example.test/',
    origin: 'https://game.example.test',
    accountPageURL: 'https://game.example.test/game/community/',
    fetchImpl,
  });
  const session = await account.signUp({
    name: 'One',
    email: 'one@example.test',
    password: 'password-for-test',
  });
  assert.equal(session.user.email, 'one@example.test');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    name: 'One',
    email: 'one@example.test',
    password: 'password-for-test',
    callbackURL: 'https://game.example.test/game/community/?account=verified',
  });
  assert.deepEqual(await account.headers(), {});
  assert.equal(await account.signOut(), null);
  assert.equal(await account.session(), null);
  assert.equal(
    (
      await account.signIn({
        email: 'one@example.test',
        password: 'password-for-test',
      })
    ).user.id,
    'creator-1',
  );
  await account.requestEmailVerification({ email: 'one@example.test' });
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    email: 'one@example.test',
    callbackURL: 'https://game.example.test/game/community/?account=verified',
  });
  await account.requestPasswordReset({ email: 'one@example.test' });
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    email: 'one@example.test',
    redirectTo: 'https://game.example.test/game/community/?account=reset',
  });
  await account.resetPassword({
    token: 'bounded-reset-token',
    newPassword: 'new-password-for-test',
  });
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    token: 'bounded-reset-token',
    newPassword: 'new-password-for-test',
  });
  await assert.rejects(
    account.resetPassword({ token: 'x'.repeat(4_097), newPassword: 'new-password-for-test' }),
    /token is invalid/u,
  );
  assert.throws(
    () =>
      createCommunityAccountClient({
        baseURL: 'https://accounts.other.test/',
        origin: 'https://game.example.test',
      }),
    /same-origin/u,
  );
  assert.throws(
    () =>
      createCommunityAccountClient({
        baseURL: 'https://game.example.test/',
        origin: 'https://game.example.test',
        accountPageURL: 'https://name:password@game.example.test/community/',
      }),
    /bounded same-origin/u,
  );
});

test('tus browser upload retains the resource and resumes from the server offset', async () => {
  const retained = new Map();
  const storage = {
    getItem: (key) => retained.get(key) ?? null,
    setItem: (key, value) => retained.set(key, value),
    removeItem: (key) => retained.delete(key),
  };
  const body = new Blob(['abcdefghij']);
  const descriptor = {
    href: '/v1/uploads',
    protocol: 'tus-1.0',
    resumable: true,
    packageSha256: 'a'.repeat(64),
    packageSize: body.size,
    metadata: {
      submissionId: '11111111-1111-4111-8111-111111111111',
      editionId: `ed_${'b'.repeat(64)}`,
      packageSha256: 'a'.repeat(64),
      packageSize: String(body.size),
    },
  };
  let serverOffset = 0;
  let interrupted = false;
  let creates = 0;
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (init.method === 'POST') {
      creates += 1;
      assert.equal(init.headers['tus-resumable'], '1.0.0');
      assert.equal(init.headers['upload-length'], String(body.size));
      assert.match(init.headers['upload-metadata'], /submissionId/u);
      return new Response(null, { status: 201, headers: { location: '/v1/uploads/one' } });
    }
    if (init.method === 'HEAD')
      return new Response(null, {
        status: 200,
        headers: { 'upload-offset': String(serverOffset) },
      });
    if (init.method === 'PATCH') {
      if (serverOffset === 4 && !interrupted) {
        interrupted = true;
        throw new Error('connection lost');
      }
      assert.equal(init.headers['upload-offset'], String(serverOffset));
      serverOffset += init.body.size;
      return new Response(null, {
        status: 204,
        headers: { 'upload-offset': String(serverOffset) },
      });
    }
    throw new Error(`Unexpected upload request ${init.method}`);
  };
  const upload = createTusBrowserUpload({
    baseURL: 'https://game.example.test/',
    fetchImpl,
    storage,
    chunkBytes: 4,
  });
  await assert.rejects(
    upload({ descriptor, blob: body, authHeaders: async () => ({ 'x-session-test': 'yes' }) }),
    /interrupted at 4 bytes/u,
  );
  assert.equal(retained.size, 1);
  const progress = [];
  const result = await upload({
    descriptor,
    blob: body,
    authHeaders: async () => ({ 'x-session-test': 'yes' }),
    onProgress: (value) => progress.push(value.uploaded),
  });
  assert.deepEqual(result, { uploaded: 10, total: 10, resumable: true });
  assert.deepEqual(progress, [4, 8, 10]);
  assert.equal(creates, 1);
  assert.equal(retained.size, 0);
  assert.ok(calls.every(({ init }) => init.credentials === 'same-origin'));
  assert.ok(calls.every(({ init }) => init.headers['x-session-test'] === 'yes'));
});
