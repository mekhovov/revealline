import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';
import { createCommunityBetterAuth } from './better-auth-runtime.mjs';
import { readConfig } from './config.mjs';

const config = readConfig();
if (!config.databaseUrl || !config.betterAuth)
  throw new Error('PostgreSQL and Better Auth configuration are required.');
const pool = new Pool({ connectionString: config.databaseUrl, max: 2 });
try {
  const auth = createCommunityBetterAuth({ database: pool, ...config.betterAuth });
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
} finally {
  await pool.end();
}
