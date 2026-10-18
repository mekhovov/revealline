import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const root = process.cwd();
const proposal = process.env.SOLO_COCOA_METAL_PROPOSAL || root;
const planPath = 'docs/performance/solo-cocoa-identity-plan.json';
const workflowPath = '.github/workflows/solo-native-mp3-cocoa-identity-temporary.yml';
const oldWorkflowPath = '.github/workflows/solo-native-mp3-cocoa-metal-temporary.yml';
const read = (path) => readFile(resolve(proposal, path));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await read(planPath));
const { MP3_COCOA_CONTROL, nativeOwnerPreflightComplete } = await import(
  pathToFileURL(resolve(root, 'scripts/solo-native-mp3-control.mjs'))
);
const { AUDIO_RECORDINGS } = await import(
  pathToFileURL(resolve(root, 'scripts/prepare-solo-audio-fixtures.mjs'))
);
const expectedPaths = [
  'solo-native-mp3-control.mjs',
  'prepare-solo-audio-fixtures.mjs',
  'solo-qualification-browser-context.mjs',
  'serve-production-preview.mjs',
  'run-solo-remote-correctness.mjs',
  'solo-darwin-process-inventory.c',
  'solo-darwin-process-inventory.mjs',
].map((path) => 'scripts/' + path);
function currentInputs(plan, inputs) {
  assert.equal(plan.format, 'SoloNativeCocoaIdentityReleaseV1');
  assert.deepEqual(
    plan.currentInputs.map((ref) => ref.path),
    expectedPaths,
  );
  for (const ref of plan.currentInputs) {
    const bytes = inputs.get(ref.path);
    assert(bytes, ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
  }
}
test('new Cocoa release freezes the seven actual current native admission and provider inputs', async () => {
  const inputs = new Map(
    await Promise.all(expectedPaths.map(async (path) => [path, await read(path)])),
  );
  currentInputs(manifest, inputs);
  for (const path of expectedPaths) {
    const missing = new Map(inputs);
    missing.delete(path);
    assert.throws(() => currentInputs(manifest, missing));
    const changed = new Map(inputs);
    changed.set(path, Buffer.concat([inputs.get(path), Buffer.from(' ')]));
    assert.throws(() => currentInputs(manifest, changed));
    const plan = structuredClone(manifest);
    plan.currentInputs.find((ref) => ref.path === path).sha256 = '0'.repeat(64);
    assert.throws(() => currentInputs(plan, inputs));
  }
});
function previousAttempt(plan) {
  const previous = plan.previousAttempt;
  assert.equal(previous.revision, '2c519bfe94b6364a57c71ba40b7212c71f0994ab');
  assert.equal(previous.tree, '76f5c88845d0340ae27e13f5ab61b0c82a9ac1bf');
  assert.equal(previous.run, 39076890164);
  assert.equal(previous.artifact, 12117935204);
  assert.deepEqual(previous.archive, {
    bytes: 9432,
    sha256: '0e8429393e6c233299d9d5d080de3924cfdda7e06b2a6c545648f673d777754a',
  });
  assert.equal(previous.status, 'failed-hosted-owner-contract-browser-media-withheld');
  assert.deepEqual(previous.contracts, { tests: 83, pass: 78, fail: 1, skipped: 4 });
  assert.equal(previous.fullBeforeAndAllInventoriesRetained, false);
  assert.equal(previous.retrospectiveOwnershipPass, false);
  assert.deepEqual(
    previous.reports.map(({ member, bytes, sha256 }) => ({ member, bytes, sha256 })),
    [
      {
        member: 'solo-native-mp3-contracts/normal.json',
        bytes: 2489,
        sha256: 'ad1ed9a8fc6b60675fb9279782f3c67e8399b56761b43034793d8b9e3bb66975',
      },
      {
        member: 'solo-native-mp3-contracts/deadline.json',
        bytes: 9200,
        sha256: '9a05425e16f5a6e9e08a88b896a2376f9eec3077731f10d8161b04e75abcad01',
      },
    ],
  );
  for (const ref of previous.reports) {
    assert.equal(Buffer.byteLength(ref.utf8), ref.bytes);
    assert.equal(sha(ref.utf8), ref.sha256);
  }
  const [normal, deadline] = previous.reports.map((r) => JSON.parse(r.utf8).result);
  assert.equal(normal.status, 'closed');
  assert.deepEqual(normal.ambiguous, []);
  assert.equal(deadline.status, 'failed');
  assert.equal(deadline.violation, 'deadline');
  assert.equal(deadline.forcedCleanup, true);
  assert.equal(deadline.ambiguous.length, 4);
  assert.deepEqual(deadline.survivors, []);
  assert.equal(deadline.firstAmbiguousInventory.row.argv, '/bin/bash');
  assert.equal(deadline.firstAmbiguousIdentityMaps, undefined);
  assert.equal(nativeOwnerPreflightComplete(null, deadline), false);
  return previous;
}
test('actual failed2c contract remains failed and supplies no fresh browser or media authority', async () => {
  const previous = previousAttempt(manifest);
  for (const ref of [
    previous.workflow,
    manifest.historicalSource,
    manifest.priorNonBrowserWitness,
  ]) {
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes);
    assert.equal(sha(b), ref.sha256);
  }
  for (const mutate of [
    (p) => p.previousAttempt.run++,
    (p) => (p.previousAttempt.retrospectiveOwnershipPass = true),
    (p) => (p.previousAttempt.fullBeforeAndAllInventoriesRetained = true),
    (p) => (p.previousAttempt.reports[0].utf8 += ' '),
    (p) => (p.previousAttempt.contracts.fail = 0),
  ]) {
    const p = structuredClone(manifest);
    mutate(p);
    assert.throws(() => previousAttempt(p));
  }
});
function workflow(text, old) {
  const conditions = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == '2c519bfe94b6364a57c71ba40b7212c71f0994ab'",
  ];
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], conditions.join(' && '));
  assert(!text.includes('workflow_dispatch'));
  assert.match(text, /runs-on: macos-15-intel/);
  assert.match(text, /SOLO_DARWIN_AMBIGUITY_EVIDENCE: 'identity-maps-v1'/);
  assert.match(text, /timeout-minutes: 28/);
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /SOLO_TOOLING_REVISION: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(text, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(
    text,
    /node --test scripts\/test-solo-cocoa-identity-release.mjs scripts\/test-solo-cocoa-metal-release.mjs scripts\/test-solo-cocoa-owner397-release.mjs/,
  );
  const marker = '      - name: Compile the exact read-only SDK inventory';
  assert(text.includes(marker) && old.includes(marker));
  assert.equal(
    text
      .slice(text.indexOf(marker))
      .replaceAll('solo-native-mp3-cocoa-identity-', 'solo-native-mp3-cocoa-metal-'),
    old.slice(old.indexOf(marker)),
  );
  const sparse = [...text.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const path of [
    workflowPath,
    oldWorkflowPath,
    planPath,
    'scripts/test-solo-cocoa-identity-release.mjs',
    'scripts/test-solo-cocoa-metal-release.mjs',
    'docs/performance/solo-cocoa-metal-plan.json',
    'docs/performance/fixtures/solo-cocoa-identity/2c-executed-source.json',
    'docs/performance/fixtures/solo-native-816/executed-source.json',
    'docs/performance/fixtures/solo-native-816/legacy-tool-supplement.json',
  ])
    assert(sparse.includes(path), path);
  return conditions;
}
test('separate before-2c release preserves original native commands, bounds and failure retention', async () => {
  const text = (await read(workflowPath)).toString();
  const old = (await read(oldWorkflowPath)).toString();
  const conditions = workflow(text, old);
  for (const condition of conditions)
    assert.throws(() => workflow(text.replace(condition, 'true'), old));
  for (const [before, after] of [
    [
      "SOLO_DARWIN_AMBIGUITY_EVIDENCE: 'identity-maps-v1'",
      "SOLO_DARWIN_AMBIGUITY_EVIDENCE: 'disabled'",
    ],
    ['timeout-minutes: 28', 'timeout-minutes: 29'],
    ['run-cocoa', 'child-cocoa'],
    ['if: always()', 'if: success()'],
    ['/docs/performance/fixtures/solo-native-816/executed-source.json', '/missing-witness'],
  ]) {
    assert(text.includes(before));
    assert.throws(() => workflow(text.replace(before, after), old));
  }
});
test('codec-only release keeps original Bossa bytes and all native protocol limits', () => {
  assert.equal(manifest.scope, 'codec-only-original-bossa-fresh-native-owner-required');
  assert.equal(manifest.productionPackage, null);
  assert.equal(manifest.performanceQualification, false);
  assert.equal(manifest.evidenceProtocol, 'identity-maps-v1');
  assert.equal(manifest.release.onceOnlyBefore, '2c519bfe94b6364a57c71ba40b7212c71f0994ab');
  assert.equal(manifest.release.automaticRetries, 0);
  assert.equal(manifest.release.automaticPhaseContinuation, false);
  assert.equal(manifest.limits.jobMinutes, 28);
  for (const [key, value] of Object.entries(manifest.limits))
    if (key !== 'jobMinutes') assert.equal(MP3_COCOA_CONTROL[key], value, key);
  assert.deepEqual(MP3_COCOA_CONTROL.arms, ['bossa-blob']);
  assert.deepEqual(
    AUDIO_RECORDINGS.find((row) => row.id === manifest.media.id),
    manifest.media,
  );
});
