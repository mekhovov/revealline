import assert from 'node:assert/strict';
import { FileStore } from '@tus/file-store';
import test from 'node:test';
import {
  createTusDatastore,
  TUS_S3_MAX_CONCURRENT_PART_UPLOADS,
  TUS_S3_PART_SIZE,
} from '../src/tus-store-factory.mjs';

test('tus storage factory preserves the disk default without loading S3', async () => {
  let loaded = false;
  const store = await createTusDatastore(
    {
      storage: { driver: 'disk', root: '/unused/package-root' },
      directory: '/tmp/revealline-tus-store-test',
      expirationMs: 60_000,
    },
    {
      loadS3Store: async () => {
        loaded = true;
      },
    },
  );
  assert.ok(store instanceof FileStore);
  assert.equal(loaded, false);
});

test('tus storage factory builds the maintained S3 store with bounded multipart work', async () => {
  let options;
  let clientConfiguration;
  let destroyed = 0;
  const cleanupCalls = [];
  class FakeS3Store {
    constructor(input) {
      options = input;
    }

    async remove() {
      const { ERRORS } = await import('@tus/server');
      throw ERRORS.FILE_NOT_FOUND;
    }
  }
  const store = await createTusDatastore(
    {
      storage: {
        driver: 's3',
        bucket: 'creator-packages',
        region: 'eu-central-1',
        endpoint: 'https://storage.example.test/',
        forcePathStyle: true,
      },
      directory: null,
      expirationMs: 86_400_000,
    },
    {
      loadS3Store: async () => ({ S3Store: FakeS3Store }),
      loadS3: async () => ({
        S3Client: class {
          constructor(input) {
            clientConfiguration = input;
          }

          async send(command) {
            cleanupCalls.push(command.input);
            return {};
          }

          destroy() {
            destroyed += 1;
          }
        },
        DeleteObjectsCommand: class {
          constructor(input) {
            this.input = input;
          }
        },
      }),
    },
  );
  assert.ok(store instanceof FakeS3Store);
  const { cache, ...boundedOptions } = options;
  assert.equal(typeof cache?.delete, 'function');
  assert.deepEqual(boundedOptions, {
    partSize: TUS_S3_PART_SIZE,
    minPartSize: TUS_S3_PART_SIZE,
    maxConcurrentPartUploads: TUS_S3_MAX_CONCURRENT_PART_UPLOADS,
    expirationPeriodInMilliseconds: 86_400_000,
    useTags: false,
    s3ClientConfig: {
      bucket: 'creator-packages',
      region: 'eu-central-1',
      endpoint: 'https://storage.example.test/',
      forcePathStyle: true,
    },
  });
  assert.deepEqual(clientConfiguration, {
    region: 'eu-central-1',
    endpoint: 'https://storage.example.test/',
    forcePathStyle: true,
  });
  await store.removeCompleted('0123456789abcdef0123456789abcdef');
  assert.deepEqual(cleanupCalls, [
    {
      Bucket: 'creator-packages',
      Delete: {
        Objects: [
          { Key: '0123456789abcdef0123456789abcdef' },
          { Key: '0123456789abcdef0123456789abcdef.info' },
        ],
        Quiet: true,
      },
    },
  ]);
  await store.remove('fedcba9876543210fedcba9876543210');
  assert.deepEqual(cleanupCalls.at(-1).Delete.Objects, [
    { Key: 'fedcba9876543210fedcba9876543210' },
    { Key: 'fedcba9876543210fedcba9876543210.info' },
  ]);
  await assert.rejects(store.removeCompleted('../packages/unsafe'), /identity is invalid/u);
  store.close();
  assert.equal(destroyed, 1);
});

test('tus storage factory fails closed for incomplete modules and configurations', async () => {
  await assert.rejects(
    createTusDatastore({
      storage: { driver: 'disk' },
      directory: null,
      expirationMs: 1,
    }),
    /tus storage root/u,
  );
  await assert.rejects(
    createTusDatastore(
      {
        storage: {
          driver: 's3',
          bucket: 'creator-packages',
          region: 'eu-central-1',
          forcePathStyle: false,
        },
        directory: null,
        expirationMs: 1,
      },
      {
        loadS3Store: async () => ({}),
        loadS3: async () => ({
          S3Client: class {},
          DeleteObjectsCommand: class {},
        }),
      },
    ),
    /module is incomplete/u,
  );
});
