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
    'game/test/solo-preparation-layout-host.test.mjs',
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
    'game/test/controller-boost-settings.test.mjs',
    'game/test/pause-menu-host.test.mjs',
    'game/test/classic-presentation.test.mjs',
    'game/test/feedback-director.test.mjs',
    'game/test/title-character.test.mjs',
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
    'game/ui/controller-boost-settings.mjs',
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
  for (const path of [
    'game/ui/handheld-play.css',
    'game/ui/device-controls.css',
    'game/ui/hunt-feedback.css',
    'game/ui/pixel-theme.css',
    'game/ui/journey.css',
  ])
    assert.ok(
      changedPaths.includes(`      - '${path}'`),
      `Layout source requires preparation checks: ${path}`,
    );
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
  assert.match(
    workflow,
    /preview:\s+needs: admission\s+runs-on: ubuntu-latest\s+timeout-minutes: 70/,
  );
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
  assert.equal(focusedTests.length, 118);
  assert.equal(new Set(focusedTests).size, 118);
  const startup = step('Record the bounded packaging start');
  assert.match(startup, /PREVIEW_STARTED_AT=\$\(date \+%s\)/);
  const preview = workflow.slice(workflow.indexOf('  preview:\n'));
  assert.ok(preview.indexOf(startup) < preview.indexOf('- uses: actions/checkout'));
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

async function bindEvidence(mode, outcome, { mutateProof, omitProof = false, artifact = {} } = {}) {
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
  const proofResult = await prepareAdmission(mode, mode === 'waived' ? 'skipped' : 'success');
  const proof = structuredClone(proofResult.proof);
  mutateProof?.(proof);
  const source = step('Bind checksums and policy-qualified evidence to the exact source')
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
        APPEARANCE_ADMISSION_TEST_FILES: admissionFiles.join(' '),
        ADMISSION_PROOF: omitProof ? '' : JSON.stringify(proof),
        ADMISSION_ARTIFACT_ID: '345',
        ADMISSION_ARTIFACT_URL: 'https://example.test/run/1/artifacts/345',
        ADMISSION_ARTIFACT_DIGEST: 'c'.repeat(64),
        ...artifact,
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

const admissionFiles = [
  'game/test/journey-performance-admission.test.mjs',
  'game/test/journey-performance-observation-admission.test.mjs',
  'game/test/journey-profile-owned-transition.test.mjs',
  'game/test/journey-required-progress-admission.test.mjs',
  'game/test/solo-required-progress-preparation-host.test.mjs',
  'game/test/owned-recorder.test.mjs',
  'game/test/demo-library-indexeddb.test.mjs',
  'game/test/optional-learning-admission.test.mjs',
  'game/test/optional-replay-admission.test.mjs',
  'game/test/solo-pending-verification-gameplay-host.test.mjs',
  'game/test/edition-mastery-host.test.mjs',
  'game/test/edition-lessons.test.mjs',
  'game/test/capture-presentation-session.test.mjs',
  'game/test/solo-dense-replay-persistence.test.mjs',
  'game/test/library-entry.test.mjs',
  'game/test/solo-lazy-library-host.test.mjs',
  'game/test/solo-transition-performance-host.test.mjs',
];
async function prepareAdmission(
  mode,
  outcome,
  { missing = false, oversize = false, symlink = false } = {},
) {
  const root = '.cache/appearance-admission/';
  const policyBytes = Buffer.from(
    JSON.stringify({
      ...acceptedPolicy,
      mode,
      authorization:
        mode === 'waived' ? 'explicit-user-request-20260922' : acceptedPolicy.authorization,
    }),
  );
  const files = new Map([['publishing/test-policy.json', policyBytes]]);
  if (mode === 'required' && !missing)
    files.set(
      root + 'admission-tests.tap',
      Buffer.from('TAP version 13\n1..1\nok 1 - complete regression\n'),
    );
  const source = step('Bind exact-source admission proof')
    .match(/node --input-type=module <<'NODE'\n([\s\S]*?)\n          NODE/)[1]
    .replace(/^ {10}/gm, '')
    .replace(/^import .*;\n/gm, '');
  const reads = [];
  let output = '';
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction(
    'readFile',
    'writeFile',
    'appendFile',
    'lstat',
    'createHash',
    'execFileSync',
    'parseTestPolicy',
    'policyDecision',
    'process',
    source,
  )(
    async (name) => {
      reads.push(name);
      assert(files.has(name), `Missing proof input: ${name}`);
      return files.get(name);
    },
    async (name, value) => files.set(name, Buffer.from(value)),
    async (name, value) => {
      assert.equal(name, 'outputs');
      output += value;
    },
    async (name) => {
      assert(files.has(name), `Missing proof input: ${name}`);
      return {
        isFile: () => true,
        isSymbolicLink: () => symlink,
        size: oversize ? 8 * 1024 ** 2 + 1 : files.get(name).length,
      };
    },
    createHash,
    () => 'b'.repeat(40),
    parseTestPolicy,
    policyDecision,
    {
      version: 'v22.13.1',
      env: {
        PREVIEW_HEAD_SHA: 'a'.repeat(40),
        PREVIEW_RUN_URL: 'https://example.test/run/1',
        TEST_POLICY_MODE: mode,
        TEST_POLICY_SHA256: digest(policyBytes),
        ADMISSION_RESULT: outcome,
        APPEARANCE_ADMISSION_TEST_FILES: admissionFiles.join(' '),
        GITHUB_OUTPUT: 'outputs',
      },
    },
  );
  assert.match(output, /^proof=.+\n$/);
  const proof = JSON.parse(output.slice('proof='.length));
  assert.deepEqual(JSON.parse(files.get(root + 'admission-proof.json')), proof);
  return { proof, files, reads, root };
}

test('separate predecessor gates each declared complete regression file without extending the existing preview clock', async () => {
  const prefix = workflow.split('  preview:\n')[0];
  assert.match(prefix, /admission:\s+runs-on: ubuntu-latest\s+timeout-minutes: 19/);
  assert.doesNotMatch(prefix, /PREVIEW_STARTED_AT|game-cli.mjs build/);
  const stepMinutes = [...prefix.matchAll(/        timeout-minutes: ([0-9]+)/g)].map((match) =>
    Number(match[1]),
  );
  assert.deepEqual(stepMinutes, [3, 2, 1, 3, 5, 1, 2]);
  assert.equal(
    stepMinutes.reduce((sum, value) => sum + value, 0),
    17,
  ); // two-minute outer reserve
  for (const output of ['proof', 'artifactId', 'artifactURL', 'artifactDigest']) {
    assert(prefix.includes(`      ${output}:`));
    assert(workflow.includes(`needs.admission.outputs.${output}`));
  }
  const declared = workflow
    .match(/APPEARANCE_ADMISSION_TEST_FILES: >-\n([\s\S]*?)\n\njobs:/)[1]
    .trim()
    .split(/\s+/);
  assert.deepEqual(declared, admissionFiles);
  assert.equal(new Set(declared).size, 17);
  const existing = workflow
    .match(/APPEARANCE_TEST_FILES: >-\n([\s\S]*?)\n    steps:/)[1]
    .trim()
    .split(/\s+/);
  assert.equal(existing.length, 118);
  for (const file of declared) {
    await access(new URL(`../${file}`, import.meta.url));
    assert(workflow.includes(`      - '${file}'`));
    assert(
      !existing.includes(file),
      'Separate complete file must not silently duplicate original 118',
    );
  }
  for (const path of [
    'game/replay.mjs',
    'game/demo-library.mjs',
    'game/journey/performance-store.mjs',
    'game/journey/performance.mjs',
    'game/journey/profile.mjs',
    'game/mastery-awards.mjs',
    'game/mastery-verification.mjs',
    'game/mastery-journey.mjs',
    'game/mastery-journey-proofs.mjs',
    'game/company-campaigns/evidence.mjs',
    'game/company-campaigns/learning-proofs.mjs',
    'game/ui/edition-lessons.mjs',
    'game/ui/edition-mastery.mjs',
    'game/ui/edition-solo.mjs',
    'game/ui/library-entry.mjs',
    'game/ui/library-panel.mjs',
    'game/capture-presentation-session.mjs',
  ])
    assert(workflow.includes(`      - '${path}'`));
  const run = step('Run complete optional-proof and saved-flight regressions');
  assert.match(run, /timeout-minutes: 5/);
  assert.match(run, /if: steps\.test_policy\.outputs\.runTests == 'true'/);
  assert.match(run, /node --test --test-concurrency=1 "\$\{test_files\[@\]\}"/);
  assert.match(
    step('Install admission test dependencies'),
    /if: steps\.test_policy\.outputs\.runTests == 'true'/,
  );
  const retain = step('Retain admission proof and partial diagnostics');
  assert.match(retain, /always\(\)/);
  for (const value of ['success', 'failure', 'cancelled'])
    assert(retain.includes(`steps.admission_tests.outcome == '${value}'`));
  assert.match(retain, /path: \.cache\/appearance-admission\//);
  assert.match(retain, /if-no-files-found: error/);
  const preview = workflow.slice(workflow.indexOf('  preview:\n'));
  assert.match(preview, /^  preview:\s+needs: admission/);
  assert.doesNotMatch(preview.slice(0, preview.indexOf('    env:')), /if:.*always/);
});

test('actual predecessor proof binds complete output bytes and preserves explicit waiver semantics', async () => {
  const passed = await prepareAdmission('required', 'success');
  assert.equal(passed.proof.result, 'passed');
  assert.equal(passed.proof.executed, true);
  assert.deepEqual(passed.proof.files, admissionFiles);
  const bytes = passed.files.get(passed.root + passed.proof.output.path);
  assert.equal(passed.proof.output.bytes, bytes.length);
  assert.equal(passed.proof.output.sha256, digest(bytes));
  const waived = await prepareAdmission('waived', 'skipped');
  assert.equal(waived.proof.result, 'waived');
  assert.equal(waived.proof.executed, false);
  assert.equal(waived.proof.command, null);
  assert(!waived.reads.some((path) => path.endsWith('.tap')));
  for (const outcome of ['failure', 'cancelled', 'skipped', ''])
    await assert.rejects(prepareAdmission('required', outcome), /outcome does not match/);
  await assert.rejects(prepareAdmission('waived', 'success'), /outcome does not match/);
  await assert.rejects(
    prepareAdmission('required', 'success', { missing: true }),
    /Missing proof input/,
  );
  for (const option of [{ oversize: true }, { symlink: true }])
    await assert.rejects(
      prepareAdmission('required', 'success', option),
      /Bounded admission output required/,
    );
});

test('preview and compact identity retain the exact predecessor evidence and reject mismatched source, policy, result or artifact', async () => {
  for (const mode of ['required', 'waived']) {
    const { identity } = await bindEvidence(mode, mode === 'required' ? 'success' : 'skipped');
    const [proof] = identity.focusedTests.additionalCohorts;
    assert.equal(proof.sourceRevision, identity.sourceRevision);
    assert.equal(proof.sourceTree, identity.sourceTree);
    assert.equal(proof.result, mode === 'required' ? 'passed' : 'waived');
    assert.equal(proof.executed, mode === 'required');
    assert.deepEqual(proof.files, admissionFiles);
    assert.equal(proof.artifact.id, 345);
    assert.equal(proof.artifact.sha256, 'c'.repeat(64));
    const prepared = await prepareAdmission(mode, mode === 'required' ? 'success' : 'skipped');
    assert.equal(
      proof.receipt.sha256,
      digest(prepared.files.get(prepared.root + 'admission-proof.json')),
    );
    const input = compactMetadataFixture(mode);
    const compactIdentity = JSON.parse(input.identityBytes);
    compactIdentity.focusedTests.additionalCohorts = identity.focusedTests.additionalCohorts;
    input.identityBytes = Buffer.from(JSON.stringify(compactIdentity));
    input.checksumBytes = Buffer.from(
      `${'b'.repeat(64)}  distribution.zip\n${digest(input.mainBytes)}  main-build.json\n${digest(input.identityBytes)}  preview-identity.json\n`,
    );
    const binding = JSON.parse(bindAppearanceMetadata(input)['package-binding.json']);
    assert.deepEqual(
      binding.focusedTests.additionalCohorts,
      identity.focusedTests.additionalCohorts,
    );
  }
  for (const mutateProof of [
    (x) => {
      x.sourceRevision = 'f'.repeat(40);
    },
    (x) => {
      x.sourceTree = 'f'.repeat(40);
    },
    (x) => {
      x.workflowRun += '/other';
    },
    (x) => {
      x.node = 'v20';
    },
    (x) => {
      x.testPolicy.policySha256 = 'f'.repeat(64);
    },
    (x) => {
      x.result = 'failed';
    },
    (x) => {
      x.executed = false;
    },
    (x) => {
      x.command = null;
    },
    (x) => {
      x.files.pop();
    },
    (x) => {
      x.output.path = 'other.tap';
    },
    (x) => {
      x.output.bytes = 0;
    },
    (x) => {
      x.output.bytes = 8 * 1024 ** 2 + 1;
    },
    (x) => {
      x.output.sha256 = '';
    },
  ])
    await assert.rejects(
      bindEvidence('required', 'success', { mutateProof }),
      /Predecessor admission/,
    );
  await assert.rejects(
    bindEvidence('required', 'success', { omitProof: true }),
    /predecessor admission proof/,
  );
  for (const artifact of [
    { ADMISSION_ARTIFACT_ID: '' },
    { ADMISSION_ARTIFACT_URL: 'https://example.test/other' },
    { ADMISSION_ARTIFACT_DIGEST: '' },
    { ADMISSION_ARTIFACT_ID: '9007199254740992' },
  ])
    await assert.rejects(
      bindEvidence('required', 'success', { artifact }),
      /artifact identity required/,
    );
});
