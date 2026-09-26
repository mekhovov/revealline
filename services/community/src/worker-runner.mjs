import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createBlobStore } from './blob-store-factory.mjs';
import { readConfig } from './config.mjs';
import { PostgresCommunityRepository } from './postgres-repository.mjs';
import { createCreatorPackageValidator } from './validator.mjs';
import { processNextValidationJob } from './worker.mjs';

const config = readConfig(process.env, { requireAuth: false });
if (!config.databaseUrl) throw new Error('COMMUNITY_DATABASE_URL is required.');
const pool = new Pool({ connectionString: config.databaseUrl, max: 2 });
const repository = new PostgresCommunityRepository({ pool });
const blobStore = await createBlobStore(config.blobStorage);
const validatePackage = createCreatorPackageValidator({});
const workerId = `${process.pid}-${randomUUID()}`;
let stopping = false;

const stop = () => {
  stopping = true;
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

while (!stopping) {
  try {
    const processed = await processNextValidationJob({
      repository,
      blobStore,
      validatePackage,
      workerId,
    });
    if (!processed) await new Promise((resolve) => setTimeout(resolve, config.workerPollMs));
  } catch (error) {
    console.error('Community validation job failed and was requeued.', error);
    await new Promise((resolve) => setTimeout(resolve, config.workerPollMs));
  }
}

await pool.end();
