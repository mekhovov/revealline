const integer = (value, fallback, name) => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
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
  return Object.freeze({
    host: environment.COMMUNITY_HOST ?? '127.0.0.1',
    port: integer(environment.COMMUNITY_PORT, 8787, 'COMMUNITY_PORT'),
    databaseUrl: environment.COMMUNITY_DATABASE_URL,
    blobRoot: environment.COMMUNITY_BLOB_ROOT ?? './var/blobs',
    tusRoot: environment.COMMUNITY_TUS_ROOT ?? './var/tus',
    maxPackageBytes: integer(
      environment.COMMUNITY_MAX_PACKAGE_BYTES,
      256 * 1024 * 1024,
      'COMMUNITY_MAX_PACKAGE_BYTES',
    ),
    validatorVersion: environment.COMMUNITY_VALIDATOR_VERSION ?? 'creator-bundle-v1',
    workerPollMs: integer(environment.COMMUNITY_WORKER_POLL_MS, 1_000, 'COMMUNITY_WORKER_POLL_MS'),
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
