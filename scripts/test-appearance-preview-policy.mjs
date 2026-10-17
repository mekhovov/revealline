import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { bindAppearanceMetadata } from './prepare-appearance-preview-metadata.mjs';
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

test('appearance preview gates tests and test fixtures while retaining mandatory source and build checks', async () => {
  const changedPaths = workflow.match(
    /\n  pull_request:\n    paths:\n([\s\S]*?)(?=\n(?:  \S|\S)|$)/,
  )?.[1];
  assert.ok(changedPaths, 'The preview has an explicit pull-request path filter.');
  const focusedTests = workflow
    .match(/\n      APPEARANCE_TEST_FILES: >-\n([\s\S]*?)(?=\n {0,6}\S|$)/)?.[1]
    ?.trim()
    .split(/\s+/);
  for (const path of [
    'game/test/solo-preparation-invalidation-host.test.mjs',
    'game/test/modal-navigation.test.mjs',
    'game/test/controller-confirm-trace.test.mjs',
  ]) {
    await access(new URL(`../${path}`, import.meta.url));
    assert.ok(changedPaths.includes(`      - '${path}'`));
    assert.ok(
      focusedTests?.includes(path),
      `The complete regression file gates the package: ${path}`,
    );
  }
  for (const path of [
    'game/ui/modal-navigation.mjs',
    'game/ui/controller-confirm-trace.mjs',
    'game/editions/package-budget.mjs',
    'game/build-config.json',
    'scripts/game-cli.mjs',
    'publishing/edition-admission.mjs',
  ]) {
    await access(new URL(`../${path}`, import.meta.url));
    assert.ok(
      changedPaths.includes(`      - '${path}'`),
      `Packaging changes require an exact-head playable build: ${path}`,
    );
  }
  assert.match(workflow, /permissions:\s+contents: read/);
  assert.match(
    step('Build the full game and separate Worlds playtest'),
    /game-cli\.mjs build --out \S+ --revision "\$PREVIEW_HEAD_SHA"/,
  );
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
    [
      'publishing/test-policy.json',
      Buffer.from(
        JSON.stringify({
          ...acceptedPolicy,
          mode,
          authorization:
            mode === 'waived' ? 'explicit-user-request-20260922' : acceptedPolicy.authorization,
        }),
      ),
    ],
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
  assert.equal(identity.qualification, 'development-preview');
  assert.equal(identity.deployed, false);
  assert.equal(identity.releaseQualified, false);
  assert.equal(identity.focusedTests.result, 'passed');
  assert.equal(identity.focusedTests.executed, true);
  assert.match(files.get(root + 'SHA256SUMS').toString(), /focused-tests\.tap/);
  await assert.rejects(bindEvidence('required', 'skipped'), /outcome does not match/);
  await assert.rejects(bindEvidence('required', 'failure'), /outcome does not match/);
  await assert.rejects(bindEvidence('waived', 'success'), /outcome does not match/);
});

function compactMetadataFixture(mode = 'required') {
  const sourceRevision = 'a'.repeat(40),
    runURL = 'https://github.com/mekhovov/revealline/actions/runs/123';
  const mainBytes = Buffer.from(JSON.stringify({ sourceRevision, sha256: 'b'.repeat(64) }));
  const identityBytes = Buffer.from(
    JSON.stringify({
      format: 'AppearancePreview.v1',
      sourceRevision,
      sourceTree: 'c'.repeat(40),
      workflowRun: runURL,
      node: 'v22.13.1',
      deployed: false,
      releaseQualified: false,
      artifacts: [{ path: 'distribution.zip', bytes: 100, sha256: 'b'.repeat(64) }],
      focusedTests: {
        result: mode === 'waived' ? 'waived' : 'passed',
        executed: mode !== 'waived',
      },
      testPolicy: { mode },
    }),
  );
  const checksumBytes = Buffer.from(
    `${'b'.repeat(64)}  distribution.zip\n${digest(mainBytes)}  main-build.json\n${digest(identityBytes)}  preview-identity.json\n`,
  );
  return {
    sourceRevision,
    runURL,
    artifactID: '456',
    artifactURL: runURL + '/artifacts/456',
    artifactDigest: 'd'.repeat(64),
    identityBytes,
    mainBytes,
    checksumBytes,
    manifestBytes: Buffer.from(JSON.stringify({ formatVersion: 1, sourceRevision, files: [] })),
  };
}

test('compact metadata binds actual full-upload identity and original bytes without copying the payload', () => {
  const input = compactMetadataFixture(),
    files = bindAppearanceMetadata(input);
  assert.deepEqual(Object.keys(files), [
    'preview-identity.json',
    'main-build.json',
    'SHA256SUMS',
    'package-binding.json',
    'METADATA-SHA256SUMS',
  ]);
  assert.deepEqual(files['preview-identity.json'], input.identityBytes);
  const binding = JSON.parse(files['package-binding.json']);
  assert.equal(binding.fullArtifact.id, 456);
  assert.equal(binding.fullArtifact.sha256, input.artifactDigest);
  assert.equal(binding.manifest.sha256, digest(input.manifestBytes));
  assert.equal(binding.inner.sha256, 'b'.repeat(64));
});

test('compact metadata cannot publish without successful full-upload outputs or exact source identity', () => {
  for (const mutate of [
    (x) => {
      x.artifactID = '';
    },
    (x) => {
      x.artifactDigest = '';
    },
    (x) => {
      x.artifactURL += 'other';
    },
    (x) => {
      x.sourceRevision = 'f'.repeat(40);
    },
    (x) => {
      x.manifestBytes = Buffer.from(
        JSON.stringify({ formatVersion: 1, sourceRevision: 'f'.repeat(40) }),
      );
    },
  ]) {
    const input = compactMetadataFixture();
    mutate(input);
    assert.throws(() => bindAppearanceMetadata(input));
  }
});

test('compact metadata rejects changed original checksum inputs and bounds local reads', () => {
  for (const mutate of [
    (x) => {
      x.mainBytes = Buffer.from('{}');
    },
    (x) => {
      x.checksumBytes = Buffer.from('');
    },
    (x) => {
      x.checksumBytes = Buffer.concat([x.checksumBytes, x.checksumBytes]);
    },
    (x) => {
      x.manifestBytes = Buffer.alloc(2 * 1024 ** 2 + 1);
    },
  ]) {
    const input = compactMetadataFixture();
    mutate(input);
    assert.throws(() => bindAppearanceMetadata(input));
  }
});

test('compact metadata preserves explicit waived policy without adding a passing test verdict', () => {
  const files = bindAppearanceMetadata(compactMetadataFixture('waived'));
  const binding = JSON.parse(files['package-binding.json']);
  assert.equal(binding.focusedTests.result, 'waived');
  assert.equal(binding.focusedTests.executed, false);
  assert.equal(binding.testPolicy.mode, 'waived');
  assert.match(binding.qualification, /No test, release, offline or performance verdict added/);
});

test('compact upload follows the successful full archive and preserves the original checksum artifact', () => {
  const full = step('Upload playable preview archives and receipts');
  assert.match(full, /id: playable_archive/);
  const bind = step('Bind small metadata to the successfully uploaded exact package');
  assert.doesNotMatch(bind, /always\(\)|continue-on-error/);
  assert.match(bind, /steps\.playable_archive\.outputs\.artifact-digest/);
  assert.match(
    step('Upload compact package identity for remote verification'),
    /path: \.cache\/appearance-preview-metadata\//,
  );
  assert.match(full, /path: \.cache\/appearance-preview\//);
});
