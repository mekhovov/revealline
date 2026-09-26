#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEPLOYED_TUS_ACCEPTANCE_FORMAT,
  runDeployedTusResumeAcceptance,
} from './deployed-tus-resume.mjs';

const integer = (value, fallback) => (value === undefined ? fallback : Number(value));
const accountHeaders = (prefix) => {
  const authorization = process.env[`${prefix}_AUTHORIZATION`];
  const cookie = process.env[`${prefix}_COOKIE`];
  if (authorization && cookie) throw new Error('Choose one account credential form.');
  return authorization ? { authorization } : { cookie };
};
const namespace = process.env.COMMUNITY_TUS_ACCEPTANCE_NAMESPACE;
const destination = path.resolve(
  process.env.COMMUNITY_TUS_ACCEPTANCE_RECEIPT ??
    `community-deployed-tus-acceptance-${namespace ?? 'invalid'}.json`,
);

async function reserveReceipt() {
  await mkdir(path.dirname(destination), { recursive: true });
  const handle = await open(destination, 'wx', 0o600);
  try {
    await handle.writeFile(
      `${JSON.stringify({ format: DEPLOYED_TUS_ACCEPTANCE_FORMAT, status: 'running' })}\n`,
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeReceipt(receipt) {
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

try {
  await reserveReceipt();
} catch (error) {
  const reason = error?.code === 'EEXIST' ? 'destination already exists' : 'reservation failed';
  process.stderr.write(`Deployed tus acceptance did not start: ${reason}.\n`);
  process.exit(1);
}

let receipt;
let passed = false;
try {
  receipt = await runDeployedTusResumeAcceptance({
    baseURL: process.env.COMMUNITY_TUS_ACCEPTANCE_BASE_URL,
    namespace,
    optIn: process.env.COMMUNITY_TUS_ACCEPTANCE_ALLOW_DESTRUCTIVE,
    expectedRelease: {
      version: process.env.COMMUNITY_TUS_ACCEPTANCE_EXPECTED_VERSION,
      sourceRevision: process.env.COMMUNITY_TUS_ACCEPTANCE_EXPECTED_SOURCE_REVISION,
      validatorVersion: process.env.COMMUNITY_TUS_ACCEPTANCE_EXPECTED_VALIDATOR_VERSION,
    },
    auth: {
      creator: accountHeaders('COMMUNITY_TUS_ACCEPTANCE_CREATOR'),
      admin: accountHeaders('COMMUNITY_TUS_ACCEPTANCE_ADMIN'),
    },
    dropAfterBytes: integer(process.env.COMMUNITY_TUS_ACCEPTANCE_DROP_AFTER_BYTES, 17),
    chunkBytes: integer(process.env.COMMUNITY_TUS_ACCEPTANCE_CHUNK_BYTES, 1024 * 1024),
    requestTimeoutMs: integer(process.env.COMMUNITY_TUS_ACCEPTANCE_REQUEST_TIMEOUT_MS, 15_000),
    pollIntervalMs: integer(process.env.COMMUNITY_TUS_ACCEPTANCE_POLL_INTERVAL_MS, 1_000),
    validationTimeoutMs: integer(
      process.env.COMMUNITY_TUS_ACCEPTANCE_VALIDATION_TIMEOUT_MS,
      120_000,
    ),
  });
  passed = true;
} catch (error) {
  receipt = error?.receipt ?? {
    format: DEPLOYED_TUS_ACCEPTANCE_FORMAT,
    status: 'failed',
    failedStage: 'configuration',
    errorCode: 'invalid_acceptance_configuration',
  };
}

try {
  await writeReceipt(receipt);
  if (passed) process.stdout.write(`Deployed tus acceptance passed. Receipt: ${destination}\n`);
  else {
    process.stderr.write(
      `Deployed tus acceptance failed at ${receipt.failedStage}; see redacted receipt: ${destination}\n`,
    );
    process.exitCode = 1;
  }
} catch {
  process.stderr.write(
    'Deployed tus acceptance finished, but its reserved receipt could not be finalized.\n',
  );
  process.exitCode = 1;
}
