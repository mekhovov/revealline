import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
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
    'game/test/solo-performance-host.test.mjs',
    'game/test/solo-auto-next-preferences-host.test.mjs',
    'game/test/preparation-cadence.test.mjs',
    'game/test/hunt-feedback-layout.test.mjs',
    'game/test/presentation-host.test.mjs',
    'game/test/solo-cadence-readiness-host.test.mjs',
    'game/test/edition-controller-practice.test.mjs',
    'game/test/scenario-mastery.test.mjs',
    'game/test/edition-solo-host.test.mjs',
    'game/test/optional-chapters-host-copy.test.mjs',
    'game/test/optional-world-choice-lifetime.test.mjs',
    'game/test/optional-world-play-lifetime.test.mjs',
    'game/test/optional-world-play-installed-host.test.mjs',
    'game/test/solo-preparation-invalidation-host.test.mjs',
    'game/test/solo-soundtrack-context-host.test.mjs',
    'game/test/flight-information-source.test.mjs',
    'game/test/flight-information-bridge.test.mjs',
    'game/test/flight-information-host.test.mjs',
    'game/test/flight-information-details-host.test.mjs',
    'game/test/audio.test.mjs',
    'game/test/published-audio.test.mjs',
    'game/test/published-cue-inspection.test.mjs',
    'game/test/published-cue-closure.test.mjs',
    'game/test/media-preparation.test.mjs',
    'game/test/destruction-audio.test.mjs',
    'game/test/destruction-level.test.mjs',
    'game/test/human-reaction-audio.test.mjs',
    'game/test/classic-catch-audio.test.mjs',
    'game/test/mp3.test.mjs',
    'game/test/mp3-inspector.test.mjs',
    'game/test/solo-soundtrack-admission-host.test.mjs',
    'game/test/soundtrack-player.test.mjs',
    'game/test/soundtrack-gain-leases.test.mjs',
    'game/test/audio-master.test.mjs',
    'game/test/soundtrack-master.test.mjs',
    'game/test/modal-navigation.test.mjs',
    'game/test/immutable-presentation-fixture.test.mjs',
    'game/test/controller-confirm-trace.test.mjs',
    'game/test/controller-router.test.mjs',
    'game/test/classic-presentation.test.mjs',
    'game/test/controller-restore.test.mjs',
  ]) {
    await access(new URL(`../${path}`, import.meta.url));
    assert.ok(changedPaths.includes(`      - '${path}'`));
    assert.ok(
      focusedTests?.includes(path),
      `The complete regression file gates the package: ${path}`,
    );
  }
  for (const path of [
    'game/ui/preparation-cadence.mjs',
    'game/ui/hunt-feedback-layout.mjs',
    'game/presentation/host.mjs',
    'game/scenario-entry.mjs',
    'game/playground/model.mjs',
    'game/ui/edition-controller-practice.mjs',
    'game/ui/audio.mjs',
    'game/ui/published-audio.mjs',
    'game/published-cue-inspection.mjs',
    'game/ui/media-preparation.mjs',
    'game/mp3-inspection.mjs',
    'game/ui/mp3-inspector.mjs',
    'game/mp3-inspection-worker.mjs',
    'game/test/helpers/pcm-wave.mjs',
    'game/test/helpers/immutable-presentation-fixture.mjs',
    'game/test/helpers/solo-dom.mjs',
    'game/ui/flight-information-source.mjs',
    'game/ui/flight-information-bridge.mjs',
    'game/ui/flight-information-host.mjs',
    'game/ui/soundtrack-player.mjs',
    'game/ui/modal-navigation.mjs',
    'game/ui/controller-confirm-trace.mjs',
    'game/ui/controller-router.mjs',
    'game/ui/classic-view.mjs',
    'game/couch/controller-session.mjs',
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
  assert.ok(changedPaths.includes("      - 'game/audio/effects/**'"));
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

test('packaging reserves bounded evidence closure without changing test or gameplay deadlines', () => {
  assert.match(workflow, /preview:\s+runs-on: ubuntu-latest\s+timeout-minutes: 70/);
  for (const [name, minutes] of [
    ['Run focused appearance, SIM and curated-community checks', 45],
    ['Build the full game and separate Worlds playtest', 12],
    ['Bind checksums and policy-qualified evidence to the exact source', 1],
    ['Upload playable preview archives and receipts', 2],
    ['Bind small metadata to the successfully uploaded exact package', 2],
    ['Upload compact package identity for remote verification', 3],
    ['Retain focused diagnostics when packaging does not finish', 2],
    ['Report preview scope', 1],
  ])
    assert.ok(step(name).includes(`timeout-minutes: ${minutes}\n`), name);
  assert.match(
    step('Run focused appearance, SIM and curated-community checks'),
    /node --test --test-concurrency=1/,
  );
  assert.doesNotMatch(workflow, /--test-timeout|continue-on-error/);
  const focusedTests = workflow
    .match(/APPEARANCE_TEST_FILES: >-\n([\s\S]*?)\n    steps:/)[1]
    .trim()
    .split(/\s+/);
  assert.equal(focusedTests.length, 113);
  assert.equal(new Set(focusedTests).size, 113);
  const startup = step('Record the bounded packaging start');
  assert.match(startup, /PREVIEW_STARTED_AT=\$\(date \+%s\)/);
  assert.ok(workflow.indexOf(startup) < workflow.indexOf('- uses: actions/checkout'));
  const retain = step('Retain focused diagnostics when packaging does not finish');
  assert.match(retain, /always\(\) && \(failure\(\) \|\| cancelled\(\)\)/);
  for (const outcome of ['success', 'failure', 'cancelled']) {
    assert.ok(retain.includes(`steps.focused.outcome == '${outcome}'`));
  }
  assert.match(retain, /path: \.cache\/appearance-preview\/focused-tests\.tap/);
  assert.doesNotMatch(retain, /distribution\.zip|appearance-preview\/\s/);
});

test('actual build admission fails closed before spawning a build when closure time is unavailable', () => {
  const guard = step('Build the full game and separate Worlds playtest')
    .split('        run: |\n')[1]
    .split('          node scripts/game-cli.mjs build')[0]
    .replace(/^ {10}/gm, '');
  const now = 1_800_000_000;
  const check = (start) =>
    spawnSync('bash', ['-c', `date() { echo ${now}; }\n${guard}`], {
      encoding: 'utf8',
      timeout: 5_000,
      env: { ...process.env, PREVIEW_STARTED_AT: start },
    });
  for (const remaining of [1_380, 1_381, 4_080]) {
    const result = check(String(now - (4_080 - remaining)));
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(`remaining=${remaining}s required=1380s`));
  }
  for (const start of [
    String(now - 2_701),
    String(now - 4_081),
    String(now + 1),
    '',
    'not-a-clock',
  ]) {
    const result = check(start);
    assert.equal(
      result.status,
      1,
      `A missing, reversed or exhausted clock must not admit a build: ${start}`,
    );
    assert.equal(result.error, undefined);
  }
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
