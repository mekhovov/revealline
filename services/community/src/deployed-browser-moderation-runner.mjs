#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEPLOYED_BROWSER_MODERATION_FORMAT,
  verifyDeployedBrowserModeration,
} from './deployed-journey.mjs';

const MAX_SEED_BYTES = 64 * 1024;
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
const seedPath = path.resolve(
  process.env.COMMUNITY_BROWSER_MODERATION_SEED_RECEIPT ?? 'missing-browser-moderation-seed.json',
);
const destination = path.resolve(
  process.env.COMMUNITY_BROWSER_MODERATION_RECEIPT ?? 'community-browser-moderation.json',
);

async function reserveReceipt() {
  await mkdir(path.dirname(destination), { recursive: true });
  const handle = await open(destination, 'wx', 0o600);
  try {
    await handle.writeFile(
      `${JSON.stringify({ format: DEPLOYED_BROWSER_MODERATION_FORMAT, status: 'running' })}\n`,
    );
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readSeed() {
  const bytes = await readFile(seedPath);
  if (bytes.byteLength > MAX_SEED_BYTES) throw new Error('Seed receipt is too large.');
  return JSON.parse(bytes.toString('utf8'));
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
  process.stderr.write(`Browser moderation verification did not start: ${reason}.\n`);
  process.exit(1);
}

let receipt;
let passed = false;
try {
  receipt = await verifyDeployedBrowserModeration({
    baseURL: process.env.COMMUNITY_BROWSER_MODERATION_BASE_URL,
    expectedRelease: {
      version: process.env.COMMUNITY_BROWSER_MODERATION_EXPECTED_VERSION,
      sourceRevision: process.env.COMMUNITY_BROWSER_MODERATION_EXPECTED_SOURCE_REVISION,
    },
    admin: accountAuthentication('COMMUNITY_BROWSER_MODERATION_ADMIN'),
    seedReceipt: await readSeed(),
    requestTimeoutMs: integer(process.env.COMMUNITY_BROWSER_MODERATION_REQUEST_TIMEOUT_MS, 15_000),
  });
  passed = true;
} catch (error) {
  receipt = error?.receipt ?? {
    format: DEPLOYED_BROWSER_MODERATION_FORMAT,
    status: 'failed',
    failedStage: 'configuration',
    errorCode: 'invalid_acceptance_configuration',
  };
}

try {
  await writeReceipt(receipt);
  if (passed)
    process.stdout.write(`Browser moderation acceptance passed. Receipt: ${destination}\n`);
  else {
    process.stderr.write(
      `Browser moderation acceptance failed at ${receipt.failedStage}; see redacted receipt: ${destination}\n`,
    );
    process.exitCode = 1;
  }
} catch {
  process.stderr.write(
    'Browser moderation acceptance finished, but its reserved receipt could not be finalized.\n',
  );
  process.exitCode = 1;
}
