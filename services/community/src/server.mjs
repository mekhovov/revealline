import { Pool } from 'pg';
import { createWebhookAccountMailDelivery } from './account-mail.mjs';
import { createAdmissionController } from './admission.mjs';
import { buildCommunityApp } from './app.mjs';
import { createTokenAuthenticator } from './auth.mjs';
import { createSessionAuthenticator } from './auth.mjs';
import { createCommunityBetterAuth, mountCommunityBetterAuth } from './better-auth-runtime.mjs';
import { DiskBlobStore } from './blob-store.mjs';
import { readConfig } from './config.mjs';
import {
  createCachedDeploymentReadiness,
  runDeploymentPreflight,
} from './deployment-preflight.mjs';
import { PostgresCommunityRepository } from './postgres-repository.mjs';
import { createCommunityTusServer } from './tus-server.mjs';
import { PostgresTusLocker, PostgresTusUploadRegistry } from './tus-coordination.mjs';
import { TusUploadTransportBoundary } from './upload-transport.mjs';

const config = readConfig();
if (!config.databaseUrl) throw new Error('COMMUNITY_DATABASE_URL is required.');

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });
const tusLockPool = new Pool({
  connectionString: config.databaseUrl,
  max: config.tusLockPoolSize,
  connectionTimeoutMillis: config.tusLockTimeoutMs,
  application_name: 'revealline-community-tus-locks',
});
const repository = new PostgresCommunityRepository({ pool });
const admission = createAdmissionController({
  repository,
  policies: config.admissionPolicies,
});
const blobStore = new DiskBlobStore({ root: config.blobRoot });
const betterAuth = config.betterAuth
  ? createCommunityBetterAuth({
      database: pool,
      ...config.betterAuth,
      mailDelivery: createWebhookAccountMailDelivery(config.betterAuth.mail),
    })
  : null;
const authenticator = betterAuth
  ? createSessionAuthenticator({
      getSession: betterAuth.api.getSession,
      getRoles: (session) => (config.adminSubjects.has(session.user.id) ? ['admin'] : []),
    })
  : createTokenAuthenticator(config.developmentTokens);
const readinessCheck = createCachedDeploymentReadiness(() =>
  runDeploymentPreflight({
    pool,
    blobRoot: config.blobRoot,
    tusRoot: config.tusRoot,
  }),
);
const tus = createCommunityTusServer({
  directory: config.tusRoot,
  endpoint: '/v1/uploads',
  authenticator,
  repository,
  blobStore,
  maxPackageBytes: config.maxPackageBytes,
  admission,
  locker: new PostgresTusLocker({
    pool: tusLockPool,
    acquireTimeoutMs: config.tusLockTimeoutMs,
  }),
  uploadRegistry: new PostgresTusUploadRegistry({ pool }),
  expirationMs: config.tusExpirationMs,
  cleanupIntervalMs: config.tusCleanupIntervalMs,
  cleanupBatchSize: config.tusCleanupBatchSize,
  cleanupLeaseMs: config.tusCleanupLeaseMs,
  onBackgroundError: (error) => console.error('Tus coordination background error.', error),
});
const app = buildCommunityApp({
  repository,
  blobStore,
  authenticator,
  maxPackageBytes: config.maxPackageBytes,
  validatorVersion: config.validatorVersion,
  uploadTransport: new TusUploadTransportBoundary({ endpoint: '/v1/uploads' }),
  tus,
  admission,
  trustProxy: config.trustProxyHops ?? false,
  readinessCheck,
  releaseIdentity: config.releaseIdentity,
  logger: true,
});
if (betterAuth) mountCommunityBetterAuth(app, betterAuth);

const close = async () => {
  await app.close();
  await tusLockPool.end();
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
