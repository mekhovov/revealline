import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const root = process.cwd();
const proposal = process.env.SOLO_COCOA_METAL_PROPOSAL || root;
const planPath = 'docs/performance/solo-cocoa-metal-plan.json';
const workflowPath = '.github/workflows/solo-native-mp3-cocoa-metal-temporary.yml';
const oldWorkflowPath = '.github/workflows/solo-native-mp3-cocoa-owner397-temporary.yml';
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
  assert.equal(plan.format, 'SoloNativeCocoaMetalReleaseV1');
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
  assert.equal(previous.revision, '8161953a10b9c37e603d78f236e277da380e57ad');
  assert.equal(previous.tree, '3cc69ce4de5367590e9bd11e4eeed38ddd510d9a');
  assert.equal(previous.run, 39073210308);
  assert.equal(previous.artifact, 12116355923);
  assert.deepEqual(previous.archive, {
    bytes: 13792,
    sha256: 'fbc0aff61da82dc0d5a3d1195401df9a22326e2ca89d937fa41997d9e194d900',
  });
  assert.equal(previous.status, 'failed-fresh-owner-media-withheld');
  assert.equal(previous.fullBeforeAndAllInventoriesRetained, false);
  assert.equal(previous.retrospectiveOwnershipPass, false);
  const expected = [
    [
      'solo-native-mp3-evidence/owner-preflight.json',
      4038,
      '0317f9030dce46568604a122236ca47b60bd06dc8866f98d2ac53ab9e7b8a702',
    ],
    [
      'solo-native-mp3-evidence/owner-preflight-command.json',
      7249,
      '6f625227d3d79e8ff284e8e7ab739a0e6c7481c84ac2819acabc87fd5932013e',
    ],
  ];
  assert.deepEqual(
    previous.reports.map(({ member, bytes, sha256 }) => [member, bytes, sha256]),
    expected,
  );
  for (const row of previous.reports) {
    assert.equal(Buffer.byteLength(row.utf8), row.bytes);
    assert.equal(sha(row.utf8), row.sha256);
  }
  const [report, command] = previous.reports.map((row) => JSON.parse(row.utf8));
  assert.equal(nativeOwnerPreflightComplete(report, command), false);
  assert.equal(command.forcedCleanup, true);
  assert.equal(command.violation, 'unattributed-new-browser');
  assert.equal(
    command.firstAmbiguousInventory.row.argv,
    '/System/Library/Frameworks/Metal.framework/Versions/A/XPCServices/MTLCompilerService.xpc/Contents/MacOS/MTLCompilerService',
  );
  return previous;
}
test('actual failed816 owner bytes remain failed and neither prior proof nor Metal classification grants ownership', async () => {
  const previous = previousAttempt(manifest);
  for (const ref of [previous.workflow, manifest.priorNonBrowserWitness]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes);
    assert.equal(sha(bytes), ref.sha256);
  }
  for (const mutate of [
    (p) => p.previousAttempt.run++,
    (p) => (p.previousAttempt.retrospectiveOwnershipPass = true),
    (p) => (p.previousAttempt.fullBeforeAndAllInventoriesRetained = true),
    (p) => (p.previousAttempt.reports[0].utf8 += ' '),
    (p) => (p.previousAttempt.reports[1].sha256 = '0'.repeat(64)),
  ]) {
    const plan = structuredClone(manifest);
    mutate(plan);
    assert.throws(() => previousAttempt(plan));
  }
});
function workflow(text, old) {
  const conditions = [
    'github.event.pull_request.number == 1544',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == 'e9f5f6548ca7178c67577fcc27ffac5b1d9e0264'",
  ];
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], conditions.join(' && '));
  assert(!text.includes('workflow_dispatch'));
  assert.match(text, /runs-on: macos-15-intel/);
  assert.match(text, /timeout-minutes: 28/);
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /SOLO_TOOLING_REVISION: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(text, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(
    text,
    /node --test scripts\/test-solo-cocoa-metal-release.mjs scripts\/test-solo-cocoa-owner397-release.mjs/,
  );
  const marker = '      - name: Compile the exact read-only SDK inventory';
  assert(text.includes(marker) && old.includes(marker));
  assert.equal(
    text
      .slice(text.indexOf(marker))
      .replaceAll('solo-native-mp3-cocoa-metal-', 'solo-native-mp3-cocoa-owner397-'),
    old.slice(old.indexOf(marker)),
  );
  const sparse = [...text.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  for (const path of [
    workflowPath,
    oldWorkflowPath,
    planPath,
    'scripts/test-solo-cocoa-metal-release.mjs',
    'docs/performance/fixtures/solo-native-816/executed-source.json',
    'docs/performance/fixtures/solo-native-816/legacy-tool-supplement.json',
  ])
    assert(sparse.includes(path), path);
  return conditions;
}
test('separate before-e9 release preserves original native commands, bounds and failure retention', async () => {
  const text = (await read(workflowPath)).toString();
  const old = (await read(oldWorkflowPath)).toString();
  const conditions = workflow(text, old);
  for (const condition of conditions)
    assert.throws(() => workflow(text.replace(condition, 'true'), old));
  for (const [before, after] of [
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
  assert.equal(manifest.release.onceOnlyBefore, 'e9f5f6548ca7178c67577fcc27ffac5b1d9e0264');
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
