const integer = (value, fallback, name) => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
};

const seconds = (value, fallback, name) => {
  const result = integer(value, fallback, name) * 1_000;
  if (!Number.isSafeInteger(result)) throw new Error(`${name} is too large.`);
  return result;
};

const boundedInteger = (value, fallback, name, { minimum, maximum }) => {
  const result = integer(value, fallback, name);
  if (result < minimum || result > maximum)
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  return result;
};

const RELEASE_VERSION = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u;
const SOURCE_REVISION = /^[a-f0-9]{40}$/u;

const releaseIdentity = (environment, { required }) => {
  const version = environment.COMMUNITY_RELEASE_VERSION;
  const sourceRevision = environment.COMMUNITY_SOURCE_REVISION;
  if (version === undefined && sourceRevision === undefined && !required) return null;
  if (!RELEASE_VERSION.test(version ?? ''))
    throw new Error('COMMUNITY_RELEASE_VERSION must be an exact v-prefixed release version.');
  if (!SOURCE_REVISION.test(sourceRevision ?? ''))
    throw new Error('COMMUNITY_SOURCE_REVISION must be an exact lowercase 40-character revision.');
  if (required) {
    if (!RELEASE_VERSION.test(environment.COMMUNITY_IMAGE_RELEASE_VERSION ?? ''))
      throw new Error('The production image has no exact embedded release version.');
    if (!SOURCE_REVISION.test(environment.COMMUNITY_IMAGE_SOURCE_REVISION ?? ''))
      throw new Error('The production image has no exact embedded source revision.');
    if (
      environment.COMMUNITY_IMAGE_RELEASE_VERSION !== version ||
      environment.COMMUNITY_IMAGE_SOURCE_REVISION !== sourceRevision
    )
      throw new Error('Runtime release identity differs from the immutable image identity.');
  }
  return Object.freeze({ version, sourceRevision });
};

const httpsOrigin = (value, name) => {
  if (typeof value !== 'string' || value.length > 2_048)
    throw new Error(`${name} must be an HTTPS origin.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an HTTPS origin.`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(`${name} must be an HTTPS origin.`);
  return parsed.origin;
};

const httpsEndpoint = (value, name) => {
  if (typeof value !== 'string' || value.length > 2_048)
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash)
    throw new Error(`${name} must be an absolute HTTPS URL.`);
  return parsed.href;
};

const optionalStorageEndpoint = (value) => {
  if (value === undefined) return null;
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048)
    throw new Error('COMMUNITY_S3_ENDPOINT must be an absolute HTTP(S) URL.');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('COMMUNITY_S3_ENDPOINT must be an absolute HTTP(S) URL.');
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new Error('COMMUNITY_S3_ENDPOINT must be an absolute HTTP(S) URL.');
  return parsed.href;
};

const exactBoolean = (value, fallback, name) => {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false.`);
};

const requiredStorageValue = (value, name, { maximum = 255 } = {}) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    throw new Error(`${name} is required for S3 package storage.`);
  return value;
};

const storageBucket = (value) => {
  const bucket = requiredStorageValue(value, 'COMMUNITY_S3_BUCKET', { maximum: 63 });
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket) ||
    bucket.includes('..') ||
    /^\d+\.\d+\.\d+\.\d+$/u.test(bucket)
  )
    throw new Error('COMMUNITY_S3_BUCKET must be a valid DNS-style bucket name.');
  return bucket;
};

const storageRegion = (value) => {
  const region = requiredStorageValue(value, 'COMMUNITY_S3_REGION', { maximum: 64 });
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(region))
    throw new Error('COMMUNITY_S3_REGION is invalid.');
  return region;
};

const packageStorage = (environment) => {
  const driver = environment.COMMUNITY_BLOB_STORAGE ?? 'disk';
  if (driver === 'disk') {
    const s3Variables = [
      'COMMUNITY_S3_BUCKET',
      'COMMUNITY_S3_REGION',
      'COMMUNITY_S3_ENDPOINT',
      'COMMUNITY_S3_FORCE_PATH_STYLE',
      'COMMUNITY_BLOB_STAGING_ROOT',
    ];
    if (s3Variables.some((name) => environment[name] !== undefined))
      throw new Error('S3 package storage variables require COMMUNITY_BLOB_STORAGE=s3.');
    return Object.freeze({
      driver,
      root: environment.COMMUNITY_BLOB_ROOT ?? './var/blobs',
    });
  }
  if (driver !== 's3') throw new Error('COMMUNITY_BLOB_STORAGE must be disk or s3.');
  if (environment.COMMUNITY_BLOB_ROOT !== undefined)
    throw new Error('COMMUNITY_BLOB_ROOT cannot be combined with S3 package storage.');
  return Object.freeze({
    driver,
    bucket: storageBucket(environment.COMMUNITY_S3_BUCKET),
    region: storageRegion(environment.COMMUNITY_S3_REGION),
    endpoint: optionalStorageEndpoint(environment.COMMUNITY_S3_ENDPOINT),
    forcePathStyle: exactBoolean(
      environment.COMMUNITY_S3_FORCE_PATH_STYLE,
      false,
      'COMMUNITY_S3_FORCE_PATH_STYLE',
    ),
    stagingRoot: requiredStorageValue(
      environment.COMMUNITY_BLOB_STAGING_ROOT,
      'COMMUNITY_BLOB_STAGING_ROOT',
      { maximum: 4_096 },
    ),
  });
};

export function readConfig(environment = process.env, { requireAuth = true } = {}) {
  const allowDevAuth = environment.COMMUNITY_ALLOW_DEV_AUTH === 'true';
  let developmentTokens;
  if (allowDevAuth) {
    try {
      developmentTokens = JSON.parse(environment.COMMUNITY_DEV_TOKENS ?? '{}');
    } catch {
      throw new Error('COMMUNITY_DEV_TOKENS must be a JSON object.');
    }
  }
  const secret = environment.BETTER_AUTH_SECRET;
  const baseURL = environment.BETTER_AUTH_URL;
  if (
    requireAuth &&
    !allowDevAuth &&
    (typeof secret !== 'string' ||
      secret.length < 32 ||
      secret.length > 4_096 ||
      /[\u0000-\u001f\u007f]/u.test(secret))
  )
    throw new Error('BETTER_AUTH_SECRET must contain 32–4096 non-control characters.');
  const maxPackageBytes = integer(
    environment.COMMUNITY_MAX_PACKAGE_BYTES,
    256 * 1024 * 1024,
    'COMMUNITY_MAX_PACKAGE_BYTES',
  );
  const uploadByteLimit = integer(
    environment.COMMUNITY_UPLOAD_BYTES_PER_WINDOW,
    2 * 1024 * 1024 * 1024,
    'COMMUNITY_UPLOAD_BYTES_PER_WINDOW',
  );
  if (uploadByteLimit < maxPackageBytes)
    throw new Error('COMMUNITY_UPLOAD_BYTES_PER_WINDOW must allow at least one maximum package.');
  const tusCleanupBatchSize = integer(
    environment.COMMUNITY_TUS_CLEANUP_BATCH_SIZE,
    32,
    'COMMUNITY_TUS_CLEANUP_BATCH_SIZE',
  );
  if (tusCleanupBatchSize > 256)
    throw new Error('COMMUNITY_TUS_CLEANUP_BATCH_SIZE must not exceed 256.');
  const blobStorage = packageStorage(environment);
  return Object.freeze({
    host: environment.COMMUNITY_HOST ?? '127.0.0.1',
    port: integer(environment.COMMUNITY_PORT, 8787, 'COMMUNITY_PORT'),
    databaseUrl: environment.COMMUNITY_DATABASE_URL,
    blobRoot: blobStorage.driver === 'disk' ? blobStorage.root : null,
    blobStorage,
    tusRoot: environment.COMMUNITY_TUS_ROOT ?? './var/tus',
    tusExpirationMs: seconds(
      environment.COMMUNITY_TUS_EXPIRATION_SECONDS,
      86_400,
      'COMMUNITY_TUS_EXPIRATION_SECONDS',
    ),
    tusCleanupIntervalMs: seconds(
      environment.COMMUNITY_TUS_CLEANUP_INTERVAL_SECONDS,
      300,
      'COMMUNITY_TUS_CLEANUP_INTERVAL_SECONDS',
    ),
    tusCleanupBatchSize,
    tusCleanupLeaseMs: seconds(
      environment.COMMUNITY_TUS_CLEANUP_LEASE_SECONDS,
      120,
      'COMMUNITY_TUS_CLEANUP_LEASE_SECONDS',
    ),
    tusLockTimeoutMs: seconds(
      environment.COMMUNITY_TUS_LOCK_TIMEOUT_SECONDS,
      30,
      'COMMUNITY_TUS_LOCK_TIMEOUT_SECONDS',
    ),
    tusLockPoolSize: integer(
      environment.COMMUNITY_TUS_LOCK_POOL_SIZE,
      20,
      'COMMUNITY_TUS_LOCK_POOL_SIZE',
    ),
    maxPackageBytes,
    validatorVersion: environment.COMMUNITY_VALIDATOR_VERSION ?? 'creator-bundle-v1',
    releaseIdentity: releaseIdentity(environment, { required: requireAuth && !allowDevAuth }),
    workerPollMs: integer(environment.COMMUNITY_WORKER_POLL_MS, 1_000, 'COMMUNITY_WORKER_POLL_MS'),
    trustProxyHops:
      environment.COMMUNITY_TRUST_PROXY_HOPS === undefined
        ? null
        : integer(environment.COMMUNITY_TRUST_PROXY_HOPS, 1, 'COMMUNITY_TRUST_PROXY_HOPS'),
    admissionPolicies: Object.freeze({
      auth: Object.freeze({
        limit: integer(
          environment.COMMUNITY_AUTH_ATTEMPTS_PER_WINDOW,
          30,
          'COMMUNITY_AUTH_ATTEMPTS_PER_WINDOW',
        ),
        windowMs: seconds(
          environment.COMMUNITY_AUTH_WINDOW_SECONDS,
          300,
          'COMMUNITY_AUTH_WINDOW_SECONDS',
        ),
      }),
      report: Object.freeze({
        limit: integer(environment.COMMUNITY_REPORTS_PER_WINDOW, 6, 'COMMUNITY_REPORTS_PER_WINDOW'),
        windowMs: seconds(
          environment.COMMUNITY_REPORT_WINDOW_SECONDS,
          3_600,
          'COMMUNITY_REPORT_WINDOW_SECONDS',
        ),
      }),
      submission: Object.freeze({
        limit: integer(
          environment.COMMUNITY_SUBMISSIONS_PER_WINDOW,
          12,
          'COMMUNITY_SUBMISSIONS_PER_WINDOW',
        ),
        windowMs: seconds(
          environment.COMMUNITY_SUBMISSION_WINDOW_SECONDS,
          3_600,
          'COMMUNITY_SUBMISSION_WINDOW_SECONDS',
        ),
      }),
      uploadBytes: Object.freeze({
        limit: uploadByteLimit,
        windowMs: seconds(
          environment.COMMUNITY_UPLOAD_WINDOW_SECONDS,
          86_400,
          'COMMUNITY_UPLOAD_WINDOW_SECONDS',
        ),
      }),
    }),
    developmentTokens: developmentTokens ?? null,
    betterAuth:
      !requireAuth || allowDevAuth
        ? null
        : (() => {
            const trustedOrigins = (environment.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean);
            if (trustedOrigins.length > 16)
              throw new Error('BETTER_AUTH_TRUSTED_ORIGINS must contain at most 16 origins.');
            const webhookToken = environment.COMMUNITY_ACCOUNT_MAIL_WEBHOOK_TOKEN;
            if (
              typeof webhookToken !== 'string' ||
              webhookToken.length < 32 ||
              webhookToken.length > 4_096 ||
              /[\u0000-\u001f\u007f]/u.test(webhookToken)
            )
              throw new Error(
                'COMMUNITY_ACCOUNT_MAIL_WEBHOOK_TOKEN must contain 32–4096 non-control characters.',
              );
            return Object.freeze({
              secret,
              baseURL: httpsOrigin(baseURL, 'BETTER_AUTH_URL'),
              trustedOrigins: trustedOrigins.map((value, index) =>
                httpsOrigin(value, `BETTER_AUTH_TRUSTED_ORIGINS entry ${index + 1}`),
              ),
              emailVerificationExpiresIn: boundedInteger(
                environment.COMMUNITY_EMAIL_VERIFICATION_EXPIRES_SECONDS,
                3_600,
                'COMMUNITY_EMAIL_VERIFICATION_EXPIRES_SECONDS',
                { minimum: 300, maximum: 86_400 },
              ),
              passwordResetExpiresIn: boundedInteger(
                environment.COMMUNITY_PASSWORD_RESET_EXPIRES_SECONDS,
                1_800,
                'COMMUNITY_PASSWORD_RESET_EXPIRES_SECONDS',
                { minimum: 300, maximum: 3_600 },
              ),
              mail: Object.freeze({
                endpoint: httpsEndpoint(
                  environment.COMMUNITY_ACCOUNT_MAIL_WEBHOOK_URL,
                  'COMMUNITY_ACCOUNT_MAIL_WEBHOOK_URL',
                ),
                authorizationToken: webhookToken,
                timeoutMs: boundedInteger(
                  environment.COMMUNITY_ACCOUNT_MAIL_TIMEOUT_MS,
                  5_000,
                  'COMMUNITY_ACCOUNT_MAIL_TIMEOUT_MS',
                  { minimum: 100, maximum: 30_000 },
                ),
              }),
            });
          })(),
    adminSubjects: new Set(
      (environment.COMMUNITY_ADMIN_SUBJECTS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  });
}
