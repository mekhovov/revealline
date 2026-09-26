import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { readConfig } from './config.mjs';
import { runDeploymentPreflight, safeDeploymentPreflightFailure } from './deployment-preflight.mjs';

export async function runDeploymentPreflightCommand({
  environment = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  createPool = (databaseUrl) => new Pool({ connectionString: databaseUrl, max: 2 }),
  runPreflight = runDeploymentPreflight,
} = {}) {
  let pool;
  try {
    const config = readConfig(environment);
    if (!config.databaseUrl) throw new Error('COMMUNITY_DATABASE_URL is required.');
    pool = createPool(config.databaseUrl);
    const result = await runPreflight({
      pool,
      blobRoot: config.blobRoot,
      tusRoot: config.tusRoot,
    });
    stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    stderr.write(`${JSON.stringify(safeDeploymentPreflightFailure(error))}\n`);
    return 1;
  } finally {
    await pool?.end();
  }
}

const main = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (main) process.exitCode = await runDeploymentPreflightCommand();
