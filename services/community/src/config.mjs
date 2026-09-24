const integer = (value, fallback, name) => {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
};

export function readConfig(environment = process.env) {
  const allowDevAuth = environment.COMMUNITY_ALLOW_DEV_AUTH === 'true';
  if (!allowDevAuth)
    throw new Error(
      'No production authentication adapter is configured. Set COMMUNITY_ALLOW_DEV_AUTH=true only for local development.',
    );
  let developmentTokens;
  try {
    developmentTokens = JSON.parse(environment.COMMUNITY_DEV_TOKENS ?? '{}');
  } catch {
    throw new Error('COMMUNITY_DEV_TOKENS must be a JSON object.');
  }
  return Object.freeze({
    host: environment.COMMUNITY_HOST ?? '127.0.0.1',
    port: integer(environment.COMMUNITY_PORT, 8787, 'COMMUNITY_PORT'),
    databaseUrl: environment.COMMUNITY_DATABASE_URL,
    blobRoot: environment.COMMUNITY_BLOB_ROOT ?? './var/blobs',
    maxPackageBytes: integer(
      environment.COMMUNITY_MAX_PACKAGE_BYTES,
      256 * 1024 * 1024,
      'COMMUNITY_MAX_PACKAGE_BYTES',
    ),
    validatorVersion: environment.COMMUNITY_VALIDATOR_VERSION ?? 'creator-bundle-v1',
    developmentTokens,
  });
}
