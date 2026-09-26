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
  return Object.freeze({
    host: environment.COMMUNITY_HOST ?? '127.0.0.1',
    port: integer(environment.COMMUNITY_PORT, 8787, 'COMMUNITY_PORT'),
    databaseUrl: environment.COMMUNITY_DATABASE_URL,
    blobRoot: environment.COMMUNITY_BLOB_ROOT ?? './var/blobs',
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
