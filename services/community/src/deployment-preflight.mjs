import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const REQUIRED_DEPLOYMENT_TABLES = Object.freeze([
  'account',
  'community_admission_events',
  'community_admission_windows',
  'community_audit_log',
  'community_reports',
  'community_submissions',
  'community_tus_uploads',
  'community_validation_jobs',
  'session',
  'user',
  'verification',
]);

export const REQUIRED_DEPLOYMENT_COLUMNS = Object.freeze({
  community_audit_log: Object.freeze(['report_id']),
  community_reports: Object.freeze(['resolution', 'resolved_at', 'resolved_by']),
  community_tus_uploads: Object.freeze(['cleanup_lease_expires_at', 'cleanup_owner']),
});

export class DeploymentPreflightError extends Error {
  constructor(check, cause) {
    super(`Community deployment ${check} check failed.`, { cause });
    this.name = 'DeploymentPreflightError';
    this.code = 'deployment_not_ready';
    this.check = check;
  }
}

const checked = async (name, operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof DeploymentPreflightError) throw error;
    throw new DeploymentPreflightError(name, error);
  }
};

export async function checkDeploymentSchema(pool) {
  if (!pool?.query) throw new Error('A PostgreSQL pool is required.');
  const result = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema=current_schema()
        AND table_name = ANY($1::text[])
      ORDER BY table_name`,
    [REQUIRED_DEPLOYMENT_TABLES],
  );
  const found = new Set(result.rows.map(({ table_name: tableName }) => tableName));
  const missing = REQUIRED_DEPLOYMENT_TABLES.filter((tableName) => !found.has(tableName));
  if (missing.length) throw new Error(`Required database migrations have not completed.`);
  const columnResult = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema=current_schema()
        AND table_name = ANY($1::text[])
      ORDER BY table_name, column_name`,
    [Object.keys(REQUIRED_DEPLOYMENT_COLUMNS)],
  );
  const columns = new Set(
    columnResult.rows.map(
      ({ table_name: tableName, column_name: columnName }) => `${tableName}.${columnName}`,
    ),
  );
  const missingColumns = Object.entries(REQUIRED_DEPLOYMENT_COLUMNS).flatMap(([tableName, names]) =>
    names.filter((name) => !columns.has(`${tableName}.${name}`)),
  );
  if (missingColumns.length) throw new Error(`Required database migrations have not completed.`);
  return Object.freeze({
    status: 'ready',
    tables: REQUIRED_DEPLOYMENT_TABLES.length,
    migrationColumns: columns.size,
  });
}

export async function checkWritableDirectory(root) {
  if (typeof root !== 'string' || root.length === 0) throw new Error('A storage root is required.');
  const directory = path.resolve(root);
  await mkdir(directory, { recursive: true });
  const probe = path.join(directory, `.deployment-preflight-${randomUUID()}`);
  const expected = randomBytes(32);
  let handle;
  try {
    handle = await open(probe, 'wx', 0o600);
    await handle.writeFile(expected);
    await handle.sync();
    await handle.close();
    handle = null;
    const actual = await readFile(probe);
    if (!actual.equals(expected))
      throw new Error('Storage verification read returned different bytes.');
  } finally {
    await handle?.close().catch(() => {});
    await rm(probe, { force: true });
  }
  return Object.freeze({ status: 'ready' });
}

export async function checkFfprobe({
  ffprobePath = 'ffprobe',
  runCommand = (command, args, options) => execFileAsync(command, args, options),
} = {}) {
  const result = await runCommand(ffprobePath, ['-version'], {
    encoding: 'utf8',
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  if (!/^ffprobe version\s/u.test(result?.stdout ?? ''))
    throw new Error('ffprobe returned an unexpected version response.');
  return Object.freeze({ status: 'ready' });
}

export async function runDeploymentPreflight({
  pool,
  blobRoot,
  tusRoot,
  ffprobePath = 'ffprobe',
  runCommand,
}) {
  const schema = await checked('schema', () => checkDeploymentSchema(pool));
  const blobStorage = await checked('blob-storage', () => checkWritableDirectory(blobRoot));
  const tusStorage = await checked('tus-storage', () => checkWritableDirectory(tusRoot));
  const ffprobe = await checked('ffprobe', () => checkFfprobe({ ffprobePath, runCommand }));
  return Object.freeze({
    status: 'ready',
    checks: Object.freeze({ schema, blobStorage, tusStorage, ffprobe }),
  });
}

export function createCachedDeploymentReadiness(
  operation,
  { ttlMs = 30_000, clock = () => Date.now() } = {},
) {
  if (typeof operation !== 'function') throw new Error('A readiness operation is required.');
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1)
    throw new Error('Readiness cache duration must be a positive integer.');
  let pending = null;
  let settledAt = Number.NEGATIVE_INFINITY;
  let settledResult;
  let settledError;
  return async () => {
    if (pending) return pending;
    if (clock() - settledAt < ttlMs) {
      if (settledError) throw settledError;
      return settledResult;
    }
    pending = Promise.resolve()
      .then(operation)
      .then(
        (result) => {
          settledResult = result;
          settledError = undefined;
          settledAt = clock();
          return result;
        },
        (error) => {
          settledResult = undefined;
          settledError = error;
          settledAt = clock();
          throw error;
        },
      )
      .finally(() => {
        pending = null;
      });
    return pending;
  };
}

export function safeDeploymentPreflightFailure(error) {
  return Object.freeze({
    status: 'not-ready',
    error: Object.freeze({
      code: error instanceof DeploymentPreflightError ? error.code : 'invalid_configuration',
      check: error instanceof DeploymentPreflightError ? error.check : 'configuration',
      message:
        error instanceof DeploymentPreflightError
          ? error.message
          : 'Community deployment configuration is invalid.',
    }),
  });
}
