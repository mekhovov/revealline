import { Pool } from 'pg';
import { buildCommunityApp } from './app.mjs';
import { createTokenAuthenticator } from './auth.mjs';
import { createSessionAuthenticator } from './auth.mjs';
import { createCommunityBetterAuth, mountCommunityBetterAuth } from './better-auth-runtime.mjs';
import { DiskBlobStore } from './blob-store.mjs';
import { readConfig } from './config.mjs';
import { PostgresCommunityRepository } from './postgres-repository.mjs';
import { createCommunityTusServer } from './tus-server.mjs';
import { TusUploadTransportBoundary } from './upload-transport.mjs';

const config = readConfig();
if (!config.databaseUrl) throw new Error('COMMUNITY_DATABASE_URL is required.');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
const repository = new PostgresCommunityRepository({ pool });
const blobStore = new DiskBlobStore({ root: config.blobRoot });
const betterAuth = config.betterAuth
  ? createCommunityBetterAuth({ database: pool, ...config.betterAuth })
  : null;
const authenticator = betterAuth
  ? createSessionAuthenticator({
      getSession: betterAuth.api.getSession,
      getRoles: (session) => (config.adminSubjects.has(session.user.id) ? ['admin'] : []),
    })
  : createTokenAuthenticator(config.developmentTokens);
const tus = createCommunityTusServer({
  directory: config.tusRoot,
  endpoint: '/v1/uploads',
  authenticator,
  repository,
  blobStore,
  maxPackageBytes: config.maxPackageBytes,
});
const app = buildCommunityApp({
  repository,
  blobStore,
  authenticator,
  maxPackageBytes: config.maxPackageBytes,
  validatorVersion: config.validatorVersion,
  uploadTransport: new TusUploadTransportBoundary({ endpoint: '/v1/uploads' }),
  tus,
  logger: true,
});
if (betterAuth) mountCommunityBetterAuth(app, betterAuth);

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
