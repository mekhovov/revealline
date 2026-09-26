import { spawn } from 'node:child_process';
import { planRecoveryRehearsal, rehearseCommunityRecovery } from './recovery-rehearsal.mjs';

const runCommand = (command, args, { databaseUrl, captureOutput = false } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: captureOutput ? ['ignore', 'pipe', 'inherit'] : 'inherit',
      env: databaseUrl ? { ...process.env, PGDATABASE: databaseUrl } : process.env,
    });
    let output = '';
    if (captureOutput) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(captureOutput ? output : undefined);
      else
        reject(new Error(`${command} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`));
    });
  });

const option = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1];
};

const [operation] = process.argv.slice(2);
const configuration = {
  sourceDatabaseUrl: process.env.COMMUNITY_DATABASE_URL,
  sourceBlobRoot: process.env.COMMUNITY_BLOB_ROOT ?? './var/blobs',
  targetDatabaseUrl: process.env.COMMUNITY_RECOVERY_REHEARSAL_TARGET_DATABASE_URL,
  targetBlobRoot: process.env.COMMUNITY_RECOVERY_REHEARSAL_TARGET_BLOB_ROOT,
};

if (operation === 'plan') {
  process.stdout.write(`${JSON.stringify(planRecoveryRehearsal(configuration))}\n`);
} else if (operation === 'run') {
  const receipt = await rehearseCommunityRecovery({
    ...configuration,
    workDirectory: option('--work-directory'),
    receiptFile: option('--receipt'),
    expectedTargetIdentity: option('--confirm-target'),
    runCommand,
  });
  process.stdout.write(
    `${JSON.stringify({ outcome: receipt.outcome, snapshotId: receipt.snapshotId, receipt: option('--receipt') })}\n`,
  );
} else {
  throw new Error(
    'Usage: node src/recovery-rehearsal-runner.mjs <plan|run> [--work-directory <directory> --receipt <file> --confirm-target <identity>]',
  );
}
