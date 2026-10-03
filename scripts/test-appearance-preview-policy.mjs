import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseTestPolicy, policyDecision } from '../publishing/test-policy.mjs';

const workflow = await readFile(
  new URL('../.github/workflows/appearance-preview.yml', import.meta.url),
  'utf8',
);
const acceptedPolicy = JSON.parse(
  await readFile(new URL('../publishing/test-policy.json', import.meta.url), 'utf8'),
);
const step = (name) =>
  workflow.split(/\n      - /).find((value) => value.startsWith(`name: ${name}\n`));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('appearance preview gates tests and test fixtures while retaining mandatory source and build checks', () => {
  assert.match(
    step('Read explicit automated-suite policy'),
    /id: test_policy\s+run: node publishing\/test-policy\.mjs/,
  );
  for (const name of [
    'Install pinned SIM test dependencies',
    'Run focused appearance, SIM and curated-community checks',
  ])
    assert.match(step(name), /if: steps\.test_policy\.outputs\.runTests == 'true'/);
  const sourceDependencies = step(
    'Install pinned SIM source-validation dependencies without test fixtures',
  );
  assert.match(sourceDependencies, /if: steps\.test_policy\.outputs\.mode == 'waived'/);
  assert.match(
    sourceDependencies,
    /npm ci --prefix authoring\/fpv-worlds --ignore-scripts --omit=dev/,
  );
  for (const name of [
    'Verify generated presentation and marking sources',
    'Build the full game and separate Worlds playtest',
    'Bind checksums and policy-qualified evidence to the exact source',
  ])
    assert.doesNotMatch(step(name), /\n\s+if:/);
});

async function bindEvidence(mode, outcome) {
  const root = '.cache/appearance-preview/';
  const files = new Map([
    ['publishing/test-policy.json', Buffer.from(JSON.stringify({ ...acceptedPolicy, mode }))],
    [root + 'distribution.zip', Buffer.from('game archive')],
    [root + 'fpv-worlds-playtest.zip', Buffer.from('world archive')],
    [root + 'README.md', Buffer.from('manual review guide')],
  ]);
  const head = 'a'.repeat(40);
  files.set(
    root + 'main-build.json',
    Buffer.from(
      JSON.stringify({
        sourceRevision: head,
        sha256: digest(files.get(root + 'distribution.zip')),
      }),
    ),
  );
  files.set(
    root + 'world-build.json',
    Buffer.from(JSON.stringify({ zipSha256: digest(files.get(root + 'fpv-worlds-playtest.zip')) })),
  );
  if (mode === 'required') files.set(root + 'focused-tests.tap', Buffer.from('TAP version 13\n'));
  const reads = [];
  const source = workflow
    .match(/node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/)[1]
    .replace(/^ {10}/gm, '')
    .replace(/^import .*;\n/gm, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(
    'readFile',
    'writeFile',
    'createHash',
    'execFileSync',
    'parseTestPolicy',
    'policyDecision',
    'process',
    source,
  )(
    async (name, encoding) => {
      reads.push(name);
      assert.ok(files.has(name), `Evidence must exist before hashing: ${name}`);
      return encoding ? files.get(name).toString(encoding) : files.get(name);
    },
    async (name, value) => files.set(name, Buffer.from(value)),
    createHash,
    () => 'b'.repeat(40),
    parseTestPolicy,
    policyDecision,
    {
      version: 'v22.13.1',
      env: {
        PREVIEW_HEAD_SHA: head,
        PREVIEW_PR: '1',
        PREVIEW_RUN_URL: 'https://example.test/run/1',
        TEST_POLICY_MODE: mode,
        TEST_POLICY_SHA256: digest(files.get('publishing/test-policy.json')),
        FOCUSED_RESULT: outcome,
        APPEARANCE_TEST_FILES: 'game/test/example.test.mjs',
      },
    },
  );
  return { files, reads, root, identity: JSON.parse(files.get(root + 'preview-identity.json')) };
}

test('waived preview receipts never read missing TAP or claim a passing test result', async () => {
  const { files, reads, root, identity } = await bindEvidence('waived', 'skipped');
  assert.equal(identity.focusedTests.result, 'waived');
  assert.equal(identity.focusedTests.executed, false);
  assert.equal(identity.focusedTests.command, null);
  assert.equal(identity.testPolicy.mode, 'waived');
  assert.equal(
    reads.some((name) => name.endsWith('.tap')),
    false,
  );
  assert.match(files.get(root + 'SHA256SUMS').toString(), /focused-tests-waived\.json/);
  assert.doesNotMatch(files.get(root + 'SHA256SUMS').toString(), /focused-tests\.tap/);
});

test('required preview receipts require successful focused checks and bind their TAP', async () => {
  const { files, root, identity } = await bindEvidence('required', 'success');
  assert.equal(identity.focusedTests.result, 'passed');
  assert.equal(identity.focusedTests.executed, true);
  assert.match(files.get(root + 'SHA256SUMS').toString(), /focused-tests\.tap/);
  await assert.rejects(bindEvidence('required', 'skipped'), /outcome does not match/);
  await assert.rejects(bindEvidence('required', 'failure'), /outcome does not match/);
  await assert.rejects(bindEvidence('waived', 'success'), /outcome does not match/);
});
