#!/usr/bin/env node
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DESTRUCTIVE_OPT_IN, runDeployedCommunityJourney } from './deployed-journey.mjs';

const integer = (value, fallback) => (value === undefined ? fallback : Number(value));
const accountHeaders = (prefix) => {
  const authorization = process.env[`${prefix}_AUTHORIZATION`];
  const cookie = process.env[`${prefix}_COOKIE`];
  if (authorization && cookie) throw new Error('Choose one account credential form.');
  return authorization ? { authorization } : { cookie };
};
const namespace = process.env.COMMUNITY_ACCEPTANCE_NAMESPACE;
const destination = path.resolve(
  process.env.COMMUNITY_ACCEPTANCE_RECEIPT ??
    `community-deployed-acceptance-${namespace ?? 'invalid'}.json`,
);

async function writeReceipt(receipt) {
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, destination);
}

try {
  const receipt = await runDeployedCommunityJourney({
    baseURL: process.env.COMMUNITY_ACCEPTANCE_BASE_URL,
    namespace,
    optIn: process.env.COMMUNITY_ACCEPTANCE_ALLOW_DESTRUCTIVE,
    auth: {
      creatorA: accountHeaders('COMMUNITY_ACCEPTANCE_CREATOR_A'),
      creatorB: accountHeaders('COMMUNITY_ACCEPTANCE_CREATOR_B'),
      admin: accountHeaders('COMMUNITY_ACCEPTANCE_ADMIN'),
    },
    requestTimeoutMs: integer(process.env.COMMUNITY_ACCEPTANCE_REQUEST_TIMEOUT_MS, 15_000),
    pollIntervalMs: integer(process.env.COMMUNITY_ACCEPTANCE_POLL_INTERVAL_MS, 1_000),
    validationTimeoutMs: integer(process.env.COMMUNITY_ACCEPTANCE_VALIDATION_TIMEOUT_MS, 120_000),
  });
  await writeReceipt(receipt);
  process.stdout.write(`Deployed community acceptance passed. Receipt: ${destination}\n`);
} catch (error) {
  const receipt = error?.receipt ?? {
    format: 'revealline-community-deployed-acceptance.v1',
    status: 'failed',
    failedStage: 'configuration',
    errorCode: 'invalid_acceptance_configuration',
  };
  await writeReceipt(receipt);
  process.stderr.write(
    `Deployed community acceptance failed at ${receipt.failedStage}; see redacted receipt: ${destination}\n`,
  );
  process.exitCode = 1;
}

export { DESTRUCTIVE_OPT_IN };
