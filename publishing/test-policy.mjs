/** Explicit automated-suite policy. Missing/malformed policy never waives tests. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

export const TEST_POLICY_FORMAT = 'revealline-release-test-policy.v1';
export const TEST_POLICY_AUTHORIZATION = 'explicit-user-request-20260922';
export const defaultTestPolicyPath = fileURLToPath(new URL('./test-policy.json', import.meta.url));

export function parseTestPolicy(value) {
  const policy = typeof value === 'string' ? JSON.parse(value) : value;
  const fields = ['authorization', 'format', 'mode', 'reason', 'restoration', 'scope'];
  if (
    !policy ||
    typeof policy !== 'object' ||
    Array.isArray(policy) ||
    JSON.stringify(Object.keys(policy).sort()) !== JSON.stringify(fields) ||
    policy.format !== TEST_POLICY_FORMAT ||
    !['required', 'waived'].includes(policy.mode) ||
    policy.authorization !== TEST_POLICY_AUTHORIZATION ||
    policy.scope !== 'automated-test-suites' ||
    !['reason', 'restoration'].every(
      (key) =>
        typeof policy[key] === 'string' &&
        policy[key].trim().length > 0 &&
        policy[key].length <= 2000,
    )
  )
    throw new Error('Missing or malformed explicit release test policy; no test waiver granted');
  return Object.freeze({ ...policy });
}

export async function readTestPolicy(filename = defaultTestPolicyPath) {
  return parseTestPolicy(await fs.readFile(filename, 'utf8'));
}

export function policyDecision(value, { forceTests = false } = {}) {
  const policy = parseTestPolicy(value);
  if (typeof forceTests !== 'boolean') throw new Error('forceTests must be boolean');
  const mode = forceTests ? 'required' : policy.mode;
  return {
    policyMode: policy.mode,
    mode,
    runTests: mode === 'required' ? 'true' : 'false',
    qualification: mode === 'required' ? 'tests-required' : 'tests-waived-by-user',
    forced: forceTests,
  };
}

async function main(args) {
  let filename = defaultTestPolicyPath;
  let forceTests = false;
  const seen = new Set();
  for (let offset = 0; offset < args.length; offset += 2) {
    const key = args[offset],
      value = args[offset + 1];
    if (!['--policy', '--force-tests'].includes(key) || !value || seen.has(key))
      throw new Error('Usage: test-policy.mjs [--policy FILE] [--force-tests true|false]');
    seen.add(key);
    if (key === '--policy') filename = path.resolve(value);
    else {
      if (!['true', 'false'].includes(value)) throw new Error('force-tests must be true or false');
      forceTests = value === 'true';
    }
  }
  const bytes = await fs.readFile(filename);
  const policy = parseTestPolicy(bytes.toString('utf8'));
  const decision = policyDecision(policy, { forceTests });
  const policySha256 = createHash('sha256').update(bytes).digest('hex');
  console.log(JSON.stringify({ policy, policySha256, ...decision }));
  if (process.env.GITHUB_OUTPUT)
    await fs.appendFile(
      process.env.GITHUB_OUTPUT,
      Object.entries({ ...decision, policySha256 })
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    );
  const statement =
    decision.mode === 'waived'
      ? 'Automated test suites are SKIPPED by explicit user authorization; no passing test verdict is claimed.'
      : 'Automated test suites remain required; this policy decision is not a passing test verdict.';
  if (decision.mode === 'waived') console.log(`::warning::${statement}`);
  if (process.env.GITHUB_STEP_SUMMARY)
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `### Release test policy\n\n${statement}\n\nAuthorization: ${policy.authorization}\n\nPolicy SHA-256: ${policySha256}\n`,
    );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
