const CONNECTION_KEYS = [
  'PGAPPNAME',
  'PGCHANNELBINDING',
  'PGCONNECT_TIMEOUT',
  'PGDATABASE',
  'PGHOST',
  'PGHOSTADDR',
  'PGPASSWORD',
  'PGPASSFILE',
  'PGPORT',
  'PGSERVICE',
  'PGSERVICEFILE',
  'PGSSLCERT',
  'PGSSLCRL',
  'PGSSLKEY',
  'PGSSLMODE',
  'PGSSLROOTCERT',
  'PGTARGETSESSIONATTRS',
  'PGUSER',
];

const QUERY_ENVIRONMENT_KEYS = new Map([
  ['application_name', 'PGAPPNAME'],
  ['channel_binding', 'PGCHANNELBINDING'],
  ['connect_timeout', 'PGCONNECT_TIMEOUT'],
  ['sslcert', 'PGSSLCERT'],
  ['sslcrl', 'PGSSLCRL'],
  ['sslkey', 'PGSSLKEY'],
  ['sslmode', 'PGSSLMODE'],
  ['sslrootcert', 'PGSSLROOTCERT'],
  ['target_session_attrs', 'PGTARGETSESSIONATTRS'],
]);

const invalidDatabaseUrl = () => new Error('PostgreSQL database URL is invalid.');

const decode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw invalidDatabaseUrl();
  }
};

export function postgresCommandEnvironment(databaseUrl, baseEnvironment = process.env) {
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) throw invalidDatabaseUrl();
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw invalidDatabaseUrl();
  }
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.pathname.length < 2 ||
    parsed.hash
  )
    throw invalidDatabaseUrl();

  const environment = { ...baseEnvironment };
  for (const key of CONNECTION_KEYS) delete environment[key];
  environment.PGHOST = parsed.hostname.replace(/^\[|\]$/gu, '');
  environment.PGPORT = parsed.port || '5432';
  environment.PGDATABASE = decode(parsed.pathname.slice(1));
  if (!environment.PGDATABASE) throw invalidDatabaseUrl();
  if (parsed.username) environment.PGUSER = decode(parsed.username);
  if (parsed.password) environment.PGPASSWORD = decode(parsed.password);

  const seen = new Set();
  for (const [name, value] of parsed.searchParams) {
    const key = QUERY_ENVIRONMENT_KEYS.get(name);
    if (!key || seen.has(key)) throw invalidDatabaseUrl();
    seen.add(key);
    environment[key] = value;
  }
  return environment;
}

export const postgresDatabaseName = (databaseUrl) =>
  postgresCommandEnvironment(databaseUrl, {}).PGDATABASE;
