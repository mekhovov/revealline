import { Pool } from 'pg';
import { buildCommunityApp } from './app.mjs';
import { createTokenAuthenticator } from './auth.mjs';
import { DiskBlobStore } from './blob-store.mjs';
import { readConfig } from './config.mjs';
import { PostgresCommunityRepository } from './postgres-repository.mjs';

const config = readConfig();
if (!config.databaseUrl) throw new Error('COMMUNITY_DATABASE_URL is required.');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
const repository = new PostgresCommunityRepository({ pool });
const app = buildCommunityApp({
  repository,
  blobStore: new DiskBlobStore({ root: config.blobRoot }),
  authenticator: createTokenAuthenticator(config.developmentTokens),
  maxPackageBytes: config.maxPackageBytes,
  validatorVersion: config.validatorVersion,
  logger: true,
});

const close = async () => {
  await app.close();
  await pool.end();
};
process.once('SIGINT', close);
process.once('SIGTERM', close);

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await close();
  process.exitCode = 1;
}
