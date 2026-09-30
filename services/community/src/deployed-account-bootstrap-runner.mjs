#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ACCOUNT_BOOTSTRAP_OPT_IN,
  DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT,
  runDeployedAccountBootstrap,
} from './deployed-account-bootstrap.mjs';

const integer = (value, fallback) => (value === undefined ? fallback : Number(value));
const accountAuthentication = (prefix) =>
  Object.freeze(
    Object.fromEntries(
      [
        ['authorization', process.env[`${prefix}_AUTHORIZATION`]],
        ['cookie', process.env[`${prefix}_COOKIE`]],
        ['email', process.env[`${prefix}_EMAIL`]],
        ['password', process.env[`${prefix}_PASSWORD`]],
      ].filter(([, value]) => value !== undefined),
    ),
  );
const creator = (prefix) =>
  Object.freeze({
    name: process.env[`${prefix}_NAME`],
    email: process.env[`${prefix}_EMAIL`],
    password: process.env[`${prefix}_PASSWORD`],
  });
const namespace = process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_NAMESPACE;
const destination = path.resolve(
  process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_RECEIPT ??
    `community-account-bootstrap-${namespace ?? 'invalid'}.json`,
);

async function reserveReceipt() {
  await mkdir(path.dirname(destination), { recursive: true });
  const handle = await open(destination, 'wx', 0o600);
  try {
    await handle.writeFile(
      `${JSON.stringify({ format: DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT, status: 'running' })}\n`,
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
  process.stderr.write(`Account bootstrap acceptance did not start: ${reason}.\n`);
  process.exit(1);
}

let receipt;
let passed = false;
try {
  receipt = await runDeployedAccountBootstrap({
    baseURL: process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_BASE_URL,
    namespace,
    optIn: process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_ALLOW_DESTRUCTIVE,
    expectedRelease: {
      version: process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_EXPECTED_VERSION,
      sourceRevision: process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_EXPECTED_SOURCE_REVISION,
    },
    creators: {
      creatorA: creator('COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_A'),
      creatorB: creator('COMMUNITY_ACCOUNT_ACCEPTANCE_CREATOR_B'),
    },
    admin: accountAuthentication('COMMUNITY_ACCOUNT_ACCEPTANCE_ADMIN'),
    mailCapture: {
      url: process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_MAIL_CAPTURE_URL,
      authorizationToken: process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_MAIL_CAPTURE_TOKEN,
    },
    requestTimeoutMs: integer(process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_REQUEST_TIMEOUT_MS, 15_000),
    pollIntervalMs: integer(process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_POLL_INTERVAL_MS, 1_000),
    mailTimeoutMs: integer(process.env.COMMUNITY_ACCOUNT_ACCEPTANCE_MAIL_TIMEOUT_MS, 120_000),
  });
  passed = true;
} catch (error) {
  receipt = error?.receipt ?? {
    format: DEPLOYED_ACCOUNT_BOOTSTRAP_FORMAT,
    status: 'failed',
    failedStage: 'configuration',
    errorCode: 'invalid_acceptance_configuration',
  };
}

try {
  await writeReceipt(receipt);
  if (passed)
    process.stdout.write(`Account bootstrap acceptance passed. Receipt: ${destination}\n`);
  else {
    process.stderr.write(
      `Account bootstrap acceptance failed at ${receipt.failedStage}; see redacted receipt: ${destination}\n`,
    );
    process.exitCode = 1;
  }
} catch {
  process.stderr.write(
    'Account bootstrap acceptance finished, but its reserved receipt could not be finalized.\n',
  );
  process.exitCode = 1;
}

export { ACCOUNT_BOOTSTRAP_OPT_IN };
