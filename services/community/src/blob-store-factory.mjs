import { DiskBlobStore, S3CompatibleBlobStore } from './blob-store.mjs';

const loadAwsS3 = () => import('@aws-sdk/client-s3');

export async function createBlobStore(storage, { loadS3 = loadAwsS3 } = {}) {
  if (storage?.driver === 'disk') return new DiskBlobStore({ root: storage.root });
  if (storage?.driver !== 's3')
    throw new Error('A supported package storage configuration is required.');

  const module = await loadS3();
  const required = ['S3Client', 'PutObjectCommand', 'HeadObjectCommand', 'GetObjectCommand'];
  if (required.some((name) => typeof module?.[name] !== 'function'))
    throw new Error('The AWS S3 client module is incomplete.');
  const client = new module.S3Client({
    region: storage.region,
    ...(storage.endpoint ? { endpoint: storage.endpoint } : {}),
    forcePathStyle: storage.forcePathStyle,
  });
  return new S3CompatibleBlobStore({
    client,
    bucket: storage.bucket,
    stagingRoot: storage.stagingRoot,
    commands: {
      put: (input) => new module.PutObjectCommand(input),
      head: (input) => new module.HeadObjectCommand(input),
      get: (input) => new module.GetObjectCommand(input),
    },
  });
}
