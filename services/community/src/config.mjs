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

export function readConfig(environment = process.env) {
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
  if (!allowDevAuth && (!secret || secret.length < 32 || !baseURL))
    throw new Error('BETTER_AUTH_SECRET (32+ characters) and BETTER_AUTH_URL are required.');
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
  return Object.freeze({
    host: environment.COMMUNITY_HOST ?? '127.0.0.1',
    port: integer(environment.COMMUNITY_PORT, 8787, 'COMMUNITY_PORT'),
    databaseUrl: environment.COMMUNITY_DATABASE_URL,
    blobRoot: environment.COMMUNITY_BLOB_ROOT ?? './var/blobs',
    tusRoot: environment.COMMUNITY_TUS_ROOT ?? './var/tus',
    maxPackageBytes,
    validatorVersion: environment.COMMUNITY_VALIDATOR_VERSION ?? 'creator-bundle-v1',
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
    betterAuth: allowDevAuth
      ? null
      : {
          secret,
          baseURL,
          trustedOrigins: (environment.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        },
    adminSubjects: new Set(
      (environment.COMMUNITY_ADMIN_SUBJECTS ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  });
}
