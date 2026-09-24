import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readTestPolicy, parseTestPolicy, policyDecision } from './test-policy.mjs';

const cli = fileURLToPath(new URL('./test-policy.mjs', import.meta.url));

test('the checked-in policy requires suites while a synthetic waiver never reports tests passed', async () => {
  const policy = await readTestPolicy();
  assert.equal(policy.mode, 'required');
  assert.equal(policy.authorization, 'explicit-user-request-20260924-soundtrack-master-plan');
  assert.equal(policy.scope, 'automated-test-suites');
  assert.deepEqual(policyDecision(policy), {
    policyMode: 'required',
    mode: 'required',
    runTests: 'true',
    qualification: 'tests-required',
    forced: false,
  });
  assert.deepEqual(policyDecision({ ...policy, mode: 'waived' }), {
    policyMode: 'waived',
    mode: 'waived',
    runTests: 'false',
    qualification: 'tests-waived-by-user',
    forced: false,
  });
  assert.equal(Object.hasOwn(policyDecision(policy), 'passed'), false);
});

test('restored policy or explicit full-test override requires suites without claiming a passing verdict', async () => {
  const policy = await readTestPolicy();
  for (const decision of [
    policyDecision({ ...policy, mode: 'required' }),
    policyDecision(policy, { forceTests: true }),
  ]) {
    assert.equal(decision.mode, 'required');
    assert.equal(decision.runTests, 'true');
    assert.equal(decision.qualification, 'tests-required');
    assert.equal(Object.hasOwn(decision, 'passed'), false);
  }
  assert.throws(() => policyDecision(policy, { forceTests: 'true' }), /boolean/);
});

test('missing, malformed and broadened authorization fail closed', async () => {
  const good = await readTestPolicy();
  for (const policy of [
    null,
    [],
    {},
    '{',
    { ...good, format: 'v2' },
    { ...good, mode: 'skip' },
    { ...good, authorization: 'inferred' },
    { ...good, scope: 'all-release-checks' },
    { ...good, reason: '' },
    { ...good, restoration: ' ' },
    { ...good, extra: true },
  ])
    assert.throws(() => parseTestPolicy(policy));
  await assert.rejects(readTestPolicy('/nonexistent/revealline-test-policy.json'));
});

test('CLI records visible skipped policy and force-tests changes only the effective decision', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-policy-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const filename = path.join(root, 'policy.json');
  await fs.writeFile(filename, JSON.stringify({ ...(await readTestPolicy()), mode: 'waived' }));
  for (const forced of ['false', 'true']) {
    const output = path.join(root, forced + '.output');
    const summary = path.join(root, forced + '.summary');
    const result = spawnSync(
      process.execPath,
      [cli, '--policy', filename, '--force-tests', forced],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          GITHUB_OUTPUT: output,
          GITHUB_STEP_SUMMARY: summary,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const decision = JSON.parse(result.stdout.split('\n')[0]);
    assert.match(decision.policySha256, /^[a-f0-9]{64}$/);
    assert.equal(decision.policyMode, 'waived');
    assert.equal(decision.mode, forced === 'true' ? 'required' : 'waived');
    assert.match(await fs.readFile(output, 'utf8'), new RegExp('runTests=' + forced));
    assert.match(
      await fs.readFile(summary, 'utf8'),
      /not a passing test verdict|no passing test verdict/,
    );
    if (forced === 'false') assert.match(result.stdout, /::warning::.*SKIPPED/);
  }
});

test('CLI missing policy or malformed override cannot emit a waiver output', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-policy-refusal-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const output = path.join(root, 'outputs');
  for (const args of [
    ['--policy', path.join(root, 'missing')],
    ['--force-tests', 'yes'],
    ['--unknown', 'true'],
  ]) {
    const result = spawnSync(process.execPath, [cli, ...args], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
    });
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /runTests|SKIPPED/);
    await assert.rejects(fs.stat(output), { code: 'ENOENT' });
  }
});
