import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createBlobStore } from '../src/blob-store-factory.mjs';
import { DiskBlobStore, S3CompatibleBlobStore } from '../src/blob-store.mjs';
import { packageBlobKey } from '../src/domain.mjs';

class FakeCommand {
  constructor(input) {
    this.input = input;
  }
}

test('blob storage factory selects disk without loading the S3 SDK', async () => {
  let loaded = false;
  const store = await createBlobStore(
    { driver: 'disk', root: '/tmp/revealline-disk-test' },
    {
      loadS3: async () => {
        loaded = true;
      },
    },
  );
  assert.ok(store instanceof DiskBlobStore);
  assert.equal(loaded, false);
});

test('disk package listing returns more than one bounded page without duplicates', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'revealline-disk-list-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const shard = path.join(root, 'packages', 'sha256', 'aa');
  await mkdir(shard, { recursive: true });
  const names = Array.from(
    { length: 1_001 },
    (_, index) => `aa${index.toString(16).padStart(62, '0')}.rlpack`,
  );
  await Promise.all(names.map((name) => writeFile(path.join(shard, name), 'x')));
  const store = new DiskBlobStore({ root });
  const first = await store.list({ prefix: 'packages/sha256/', limit: 1_000 });
  const second = await store.list({
    prefix: 'packages/sha256/',
    cursor: first.cursor,
    limit: 1_000,
  });
  assert.equal(first.items.length, 1_000);
  assert.equal(second.items.length, 1);
  assert.equal(new Set([...first.items, ...second.items].map(({ key }) => key)).size, 1_001);
  assert.equal(second.cursor, null);
});

test('blob storage factory builds an executable S3 store from exact configuration', async () => {
  let clientConfiguration;
  class FakeS3Client {
    constructor(configuration) {
      clientConfiguration = configuration;
    }

    async send() {
      return {};
    }
  }
  const store = await createBlobStore(
    {
      driver: 's3',
      bucket: 'creator-packages',
      region: 'eu-central-1',
      endpoint: 'https://storage.example.test/',
      forcePathStyle: true,
      stagingRoot: '/tmp/revealline-s3-stage',
    },
    {
      loadS3: async () => ({
        S3Client: FakeS3Client,
        PutObjectCommand: FakeCommand,
        HeadObjectCommand: FakeCommand,
        GetObjectCommand: FakeCommand,
        ListObjectsV2Command: FakeCommand,
      }),
    },
  );
  assert.ok(store instanceof S3CompatibleBlobStore);
  assert.deepEqual(clientConfiguration, {
    region: 'eu-central-1',
    endpoint: 'https://storage.example.test/',
    forcePathStyle: true,
  });
});

test('S3 publication verifies streamed bytes before publishing and removes staging files', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-stream-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const source = Buffer.alloc(3 * 1024 * 1024 + 17, 0x4a);
  const sha256 = createHash('sha256').update(source).digest('hex');
  const calls = [];
  const client = {
    async send(command) {
      calls.push(command);
      if (command.operation !== 'put') return {};
      assert.equal(Buffer.isBuffer(command.input.Body), false);
      const digest = createHash('sha256');
      let uploaded = 0;
      for await (const chunk of command.input.Body) {
        uploaded += chunk.length;
        digest.update(chunk);
      }
      assert.equal(uploaded, source.length);
      assert.equal(digest.digest('hex'), sha256);
      return {};
    },
  };
  const commands = {
    put: (input) => ({ operation: 'put', input }),
    head: (input) => ({ operation: 'head', input }),
    get: (input) => ({ operation: 'get', input }),
    list: (input) => ({ operation: 'list', input }),
  };
  const store = new S3CompatibleBlobStore({
    client,
    bucket: 'creator-packages',
    stagingRoot,
    commands,
  });
  async function* body() {
    for (let offset = 0; offset < source.length; offset += 16 * 1024)
      yield source.subarray(offset, offset + 16 * 1024);
  }
  const result = await store.putVerified({
    key: packageBlobKey(sha256),
    body: body(),
    expectedSha256: sha256,
    expectedSize: source.length,
    maxBytes: source.length,
  });
  assert.deepEqual(result, {
    key: packageBlobKey(sha256),
    sha256,
    size: source.length,
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input.ContentLength, source.length);
  assert.equal(calls[0].input.IfNoneMatch, '*');
  assert.deepEqual(await readdir(stagingRoot), []);
});

test('S3 publication rejects a mismatched stream without sending or retaining bytes', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-mismatch-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  let sends = 0;
  const expected = Buffer.from('expected package');
  const expectedSha256 = createHash('sha256').update(expected).digest('hex');
  const store = new S3CompatibleBlobStore({
    client: {
      async send() {
        sends += 1;
      },
    },
    bucket: 'creator-packages',
    stagingRoot,
    commands: {
      put: (input) => input,
      head: (input) => input,
      get: (input) => input,
      list: (input) => input,
    },
  });
  await assert.rejects(
    store.putVerified({
      key: packageBlobKey(expectedSha256),
      body: [Buffer.from('different package')],
      expectedSha256,
      expectedSize: expected.length,
      maxBytes: 1024,
    }),
    /do not match/u,
  );
  assert.equal(sends, 0);
  assert.deepEqual(await readdir(stagingRoot), []);
});

test('S3 publication retries a conditional conflict with a fresh closed stream', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-retry-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const source = Buffer.from('conditional retry package');
  const sha256 = createHash('sha256').update(source).digest('hex');
  const streams = [];
  let putAttempts = 0;
  const store = new S3CompatibleBlobStore({
    client: {
      async send(command) {
        if (command.operation !== 'put') return {};
        putAttempts += 1;
        streams.push(command.input.Body);
        if (putAttempts === 1)
          throw Object.assign(new Error('concurrent write'), {
            name: 'ConditionalRequestConflict',
            $metadata: { httpStatusCode: 409 },
          });
        const uploaded = [];
        for await (const chunk of command.input.Body) uploaded.push(Buffer.from(chunk));
        assert.deepEqual(Buffer.concat(uploaded), source);
        return {};
      },
    },
    bucket: 'creator-packages',
    stagingRoot,
    commands: {
      put: (input) => ({ operation: 'put', input }),
      head: (input) => ({ operation: 'head', input }),
      get: (input) => ({ operation: 'get', input }),
      list: (input) => ({ operation: 'list', input }),
    },
  });
  const result = await store.putVerified({
    key: packageBlobKey(sha256),
    body: [source],
    expectedSha256: sha256,
    expectedSize: source.length,
    maxBytes: 1024,
  });
  assert.equal(result.sha256, sha256);
  assert.equal(putAttempts, 2);
  assert.notEqual(streams[0], streams[1]);
  assert.ok(streams.every((stream) => stream.closed));
  assert.deepEqual(await readdir(stagingRoot), []);
});

test('S3 publication verifies exact metadata when a conflict retry reaches precondition failure', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-raced-reuse-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const source = Buffer.from('raced immutable package');
  const sha256 = createHash('sha256').update(source).digest('hex');
  const streams = [];
  const operations = [];
  const store = new S3CompatibleBlobStore({
    client: {
      async send(command) {
        operations.push(command.operation);
        if (command.operation === 'head')
          return { ContentLength: source.length, Metadata: { sha256 } };
        streams.push(command.input.Body);
        const status = streams.length === 1 ? 409 : 412;
        throw Object.assign(new Error('conditional write failed'), {
          name: status === 409 ? 'ConditionalRequestConflict' : 'PreconditionFailed',
          $metadata: { httpStatusCode: status },
        });
      },
    },
    bucket: 'creator-packages',
    stagingRoot,
    commands: {
      put: (input) => ({ operation: 'put', input }),
      head: (input) => ({ operation: 'head', input }),
      get: (input) => ({ operation: 'get', input }),
      list: (input) => ({ operation: 'list', input }),
    },
  });
  const result = await store.putVerified({
    key: packageBlobKey(sha256),
    body: [source],
    expectedSha256: sha256,
    expectedSize: source.length,
    maxBytes: 1024,
  });
  assert.equal(result.sha256, sha256);
  assert.deepEqual(operations, ['put', 'put', 'head']);
  assert.notEqual(streams[0], streams[1]);
  assert.ok(streams.every((stream) => stream.closed));
  assert.deepEqual(await readdir(stagingRoot), []);
});

test('S3 publication bounds repeated conditional-conflict retries', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-retry-limit-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const source = Buffer.from('retry limit package');
  const sha256 = createHash('sha256').update(source).digest('hex');
  const streams = [];
  const store = new S3CompatibleBlobStore({
    client: {
      async send(command) {
        streams.push(command.input.Body);
        throw Object.assign(new Error('concurrent write'), {
          name: 'ConditionalRequestConflict',
          $metadata: { httpStatusCode: 409 },
        });
      },
    },
    bucket: 'creator-packages',
    stagingRoot,
    commands: {
      put: (input) => ({ operation: 'put', input }),
      head: (input) => ({ operation: 'head', input }),
      get: (input) => ({ operation: 'get', input }),
      list: (input) => ({ operation: 'list', input }),
    },
  });
  await assert.rejects(
    store.putVerified({
      key: packageBlobKey(sha256),
      body: [source],
      expectedSha256: sha256,
      expectedSize: source.length,
      maxBytes: 1024,
    }),
    { name: 'ConditionalRequestConflict' },
  );
  assert.equal(streams.length, 3);
  assert.ok(streams.every((stream) => stream.closed));
  assert.deepEqual(await readdir(stagingRoot), []);
});

test('S3 publication reuses only an exact immutable object after precondition failure', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-existing-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const source = Buffer.from('already published package');
  const sha256 = createHash('sha256').update(source).digest('hex');
  let existing = { ContentLength: source.length, Metadata: { sha256 } };
  const store = new S3CompatibleBlobStore({
    client: {
      async send(command) {
        if (command.operation === 'put') {
          throw Object.assign(new Error('exists'), {
            name: 'PreconditionFailed',
            $metadata: { httpStatusCode: 412 },
          });
        }
        return existing;
      },
    },
    bucket: 'creator-packages',
    stagingRoot,
    commands: {
      put: (input) => ({ operation: 'put', input }),
      head: (input) => ({ operation: 'head', input }),
      get: (input) => ({ operation: 'get', input }),
      list: (input) => ({ operation: 'list', input }),
    },
  });
  const input = {
    key: packageBlobKey(sha256),
    body: [source],
    expectedSha256: sha256,
    expectedSize: source.length,
    maxBytes: 1024,
  };
  assert.equal((await store.putVerified(input)).sha256, sha256);
  existing = { ContentLength: source.length, Metadata: { sha256: '0'.repeat(64) } };
  await assert.rejects(store.putVerified(input), /Immutable blob collision/u);
  assert.deepEqual(await readdir(stagingRoot), []);
});

test('S3 package listing is bounded and follows opaque continuation tokens', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-list-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const requests = [];
  const client = {
    async send(command) {
      requests.push(command.input);
      if (!command.input.ContinuationToken)
        return {
          Contents: [{ Key: `packages/sha256/aa/${'a'.repeat(64)}.rlpack`, Size: 21 }],
          IsTruncated: true,
          NextContinuationToken: 'opaque+/=token',
        };
      return {
        Contents: [{ Key: `packages/sha256/bb/${'b'.repeat(64)}.rlpack`, Size: 34 }],
        IsTruncated: false,
      };
    },
  };
  const store = new S3CompatibleBlobStore({
    client,
    bucket: 'creator-packages',
    stagingRoot,
    commands: {
      put: (input) => ({ operation: 'put', input }),
      head: (input) => ({ operation: 'head', input }),
      get: (input) => ({ operation: 'get', input }),
      list: (input) => ({ operation: 'list', input }),
    },
  });
  const first = await store.list({ prefix: 'packages/sha256/', limit: 1 });
  const second = await store.list({ prefix: 'packages/sha256/', cursor: first.cursor, limit: 1 });
  assert.equal(first.items[0].size, 21);
  assert.equal(first.cursor, 'opaque+/=token');
  assert.equal(second.items[0].size, 34);
  assert.equal(second.cursor, null);
  assert.deepEqual(requests, [
    { Bucket: 'creator-packages', Prefix: 'packages/sha256/', MaxKeys: 1 },
    {
      Bucket: 'creator-packages',
      Prefix: 'packages/sha256/',
      MaxKeys: 1,
      ContinuationToken: 'opaque+/=token',
    },
  ]);
});

test('S3 package listing rejects a truncated response without a continuation token', async (t) => {
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'revealline-s3-list-invalid-'));
  t.after(() => rm(stagingRoot, { recursive: true, force: true }));
  const store = new S3CompatibleBlobStore({
    client: {
      async send() {
        return { Contents: [], IsTruncated: true };
      },
    },
    bucket: 'creator-packages',
    stagingRoot,
    commands: {
      put: (input) => input,
      head: (input) => input,
      get: (input) => input,
      list: (input) => input,
    },
  });
  await assert.rejects(
    store.list({ prefix: 'packages/sha256/', limit: 1000 }),
    /continuation token/u,
  );
});
