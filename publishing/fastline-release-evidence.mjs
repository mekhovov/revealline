#!/usr/bin/env node
/** Admit only evidence contracts the Fastline coordinator can actually assemble. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTestPolicy } from './test-policy.mjs';

export function fastlineEvidencePolicy(value, mode) {
  if (!['shadow', 'publish', 'resume'].includes(mode)) throw new Error('Unknown Fastline mode');
  const policy = parseTestPolicy(value);
  const supported = policy.mode === 'waived';
  if (!supported && mode !== 'shadow')
    throw new Error(
      'The exact source requires full-test evidence. Fastline currently supports only the waived evidence adapter; refusing before qualification or publication. Qualify and inspect through the reviewed full-test release process after reconciling its workflow authorities. Do not waive tests to bypass this refusal.',
    );
  return {
    sourceTestPolicy: policy.mode,
    evidenceAdapter: supported ? 'waived' : 'unsupported-required',
    evidenceAdapterSupported: supported,
  };
}

async function main() {
  if (!process.env.SOURCE_TEST_POLICY)
    throw new Error('An exact checked-out source test-policy path is required');
  const decision = fastlineEvidencePolicy(
    await fs.readFile(process.env.SOURCE_TEST_POLICY, 'utf8'),
    process.env.MODE,
  );
  console.log(JSON.stringify(decision));
  if (process.env.GITHUB_OUTPUT)
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries(decision)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    );
  if (!decision.evidenceAdapterSupported)
    console.log(
      '::warning::Read-only shadow admission only: the required-test source has no compatible Fastline evidence adapter. Publication remains blocked.',
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
