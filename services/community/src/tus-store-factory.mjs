import { FileStore } from '@tus/file-store';
import { ERRORS, MemoryKvStore } from '@tus/server';

const loadTusS3 = () => import('@tus/s3-store');
const loadAwsS3 = () => import('@aws-sdk/client-s3');

// Keep each API process inside a predictable multipart memory/network envelope.
// The upstream store may increase the part size for very large uploads, while
// the service's lower max-package bound remains authoritative.
export const TUS_S3_PART_SIZE = 8 * 1024 * 1024;
export const TUS_S3_MAX_CONCURRENT_PART_UPLOADS = 4;

export async function createTusDatastore(
  { storage, directory, expirationMs },
  { loadS3Store = loadTusS3, loadS3 = loadAwsS3 } = {},
) {
  if (storage?.driver === 'disk') {
    if (typeof directory !== 'string' || directory.length === 0)
      throw new Error('A tus storage root is required for disk storage.');
    return new FileStore({
      directory,
      expirationPeriodInMilliseconds: expirationMs,
    });
  }
  if (storage?.driver !== 's3')
    throw new Error('A supported tus storage configuration is required.');

  const [module, s3] = await Promise.all([loadS3Store(), loadS3()]);
  if (typeof module?.S3Store !== 'function')
    throw new Error('The maintained tus S3 store module is incomplete.');
  if (typeof s3?.S3Client !== 'function' || typeof s3?.DeleteObjectsCommand !== 'function')
    throw new Error('The AWS S3 tus cleanup module is incomplete.');
  const clientConfiguration = {
    region: storage.region,
    ...(storage.endpoint ? { endpoint: storage.endpoint } : {}),
    forcePathStyle: storage.forcePathStyle,
  };
  const cache = new MemoryKvStore();
  const store = new module.S3Store({
    partSize: TUS_S3_PART_SIZE,
    minPartSize: TUS_S3_PART_SIZE,
    maxConcurrentPartUploads: TUS_S3_MAX_CONCURRENT_PART_UPLOADS,
    expirationPeriodInMilliseconds: expirationMs,
    cache,
    // PostgreSQL owns expiry leases and calls datastore.remove(). Avoid making
    // object-tag permissions another hidden runtime dependency.
    useTags: false,
    s3ClientConfig: {
      bucket: storage.bucket,
      ...clientConfiguration,
    },
  });
  const cleanupClient = new s3.S3Client(clientConfiguration);
  store.removeCompleted = async (id) => {
    if (!/^[a-f0-9]{32}$/u.test(id)) throw new Error('Completed tus upload identity is invalid.');
    const result = await cleanupClient.send(
      new s3.DeleteObjectsCommand({
        Bucket: storage.bucket,
        Delete: {
          Objects: [{ Key: id }, { Key: `${id}.info` }],
          Quiet: true,
        },
      }),
    );
    if (result.Errors?.length) throw new Error('Completed tus upload cleanup failed.');
    await cache.delete(id);
  };
  const removeMultipartUpload = store.remove.bind(store);
  store.remove = async (id) => {
    try {
      await removeMultipartUpload(id);
    } catch (error) {
      // The maintained adapter maps AbortMultipartUpload's NoSuchUpload to
      // FILE_NOT_FOUND after a multipart upload has already completed. Let the
      // PostgreSQL expiry retry remove the final object and metadata instead.
      if (error !== ERRORS.FILE_NOT_FOUND) throw error;
      await store.removeCompleted(id);
    }
  };
  store.close = () => cleanupClient.destroy?.();
  return store;
}
