import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const root = process.cwd();
const proposal = process.env.SOLO_COCOA_METAL_PROPOSAL || root;
const planPath = 'docs/performance/solo-cocoa-identity-v2-plan.json';
const workflowPath = '.github/workflows/solo-native-mp3-cocoa-identity-v2-temporary.yml';
const oldPlanPath = 'docs/performance/solo-cocoa-identity-plan.json';
const oldWorkflowPath = '.github/workflows/solo-native-mp3-cocoa-identity-temporary.yml';
const witnessPath = 'docs/performance/fixtures/solo-cocoa-identity/1cbc-executed-source.json';
const read = (path) => readFile(resolve(proposal, path));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await read(planPath));
const original = JSON.parse(await read(oldPlanPath));
const { MP3_COCOA_CONTROL, nativeOwnerPreflightComplete } = await import(
  pathToFileURL(resolve(root, 'scripts/solo-native-mp3-control.mjs'))
);
const expectedPaths = original.currentInputs.map((row) => row.path);
const executedWitnessPath =
  'docs/performance/fixtures/solo-cocoa-identity/3e640-executed-source.json';
const executedWitnessBytes = await read(executedWitnessPath);
const declarationBytes = await read(planPath);
const workflowBytes = await read(workflowPath);
const executedInventoryPath = 'scripts/test-solo-darwin-process-inventory.mjs';
// Only this already executed declaration is read through its immutable source
// witness. A prospective consumer must still admit its actual current inputs.
function executedInputs(
  plan,
  bytes = executedWitnessBytes,
  declaration = declarationBytes,
  workflow = workflowBytes,
) {
  assert.equal(bytes.length, 4360);
  assert.equal(sha(bytes), '46c931d1e997e22ff66a7022196687b35a60453c108a98876c416c792bad5cdb');
  const witness = JSON.parse(bytes);
  assert.equal(witness.format, 'SoloCocoaExecutedSourceV1');
  assert.equal(witness.sourceRevision, '3e640259d0b39b5d00c044f541208bd56260ab6c');
  assert.equal(witness.sourceTree, '0d8e6535ac6a2a458d7a1080ce1f8a81ba130da2');
  assert.equal(witness.run, 39096176027);
  assert.equal(witness.artifact, 12125060656);
  assert.equal(witness.status, 'failed-hosted-owner-contract-browser-media-withheld');
  assert.deepEqual(witness.contracts, { tests: 97, pass: 92, fail: 1, skipped: 4 });
  assert.equal(witness.fullBeforeAndAllInventoriesRetained, false);
  assert.equal(witness.retrospectiveOwnershipPass, false);
  assert.equal(witness.records.length, 11);
  const refs = new Map(witness.records.map((row) => [row.path, row]));
  assert.equal(refs.size, 11);
  assert.equal(plan.format, 'SoloNativeCocoaIdentityReleaseV2');
  assert.deepEqual(
    plan.currentInputs.map((row) => row.path),
    expectedPaths,
  );
  for (const ref of plan.currentInputs) {
    const original = refs.get(ref.path);
    assert(original, ref.path);
    assert.match(original.gitBlob, /^[a-f0-9]{40}$/);
    assert.deepEqual(ref, { path: original.path, bytes: original.bytes, sha256: original.sha256 });
  }
  for (const [path, input] of [
    [planPath, declaration],
    [workflowPath, workflow],
  ]) {
    const ref = refs.get(path);
    assert(ref, path);
    assert.equal(input.length, ref.bytes, path);
    assert.equal(sha(input), ref.sha256, path);
  }
  assert.deepEqual(refs.get(executedInventoryPath), {
    path: 'scripts/test-solo-darwin-process-inventory.mjs',
    gitBlob: '6bdbf9e43e49ca2e75b8c31d2f510f85523c01cb',
    bytes: 63461,
    sha256: '17ac5d2319db177e4c04b0d26f89fe6bfae0c62f91ddcba35a931187776aabf9',
  });
  return witness;
}
test('executed3e640 V2 preserves actual source inputs and missing-map failure without rebinding', () => {
  executedInputs(manifest);
  for (const path of expectedPaths) {
    const changed = structuredClone(manifest);
    changed.currentInputs.find((row) => row.path === path).sha256 = '0'.repeat(64);
    assert.throws(() => executedInputs(changed));
    const missing = structuredClone(manifest);
    missing.currentInputs = missing.currentInputs.filter((row) => row.path !== path);
    assert.throws(() => executedInputs(missing));
  }
  for (const mutate of [
    (w) => (w.sourceRevision = '0'.repeat(40)),
    (w) => (w.sourceTree = '0'.repeat(40)),
    (w) => w.run++,
    (w) => (w.retrospectiveOwnershipPass = true),
    (w) => (w.fullBeforeAndAllInventoriesRetained = true),
    (w) => (w.contracts.fail = 0),
    (w) =>
      w.records.splice(
        w.records.findIndex((row) => row.path === executedInventoryPath),
        1,
      ),
    (w) => (w.records.find((row) => row.path === executedInventoryPath).sha256 = '0'.repeat(64)),
  ]) {
    const witness = JSON.parse(executedWitnessBytes);
    mutate(witness);
    assert.throws(() => executedInputs(manifest, Buffer.from(JSON.stringify(witness))));
  }
  assert.throws(() => executedInputs(manifest, Buffer.from('{}')));
  assert.throws(() =>
    executedInputs(
      manifest,
      executedWitnessBytes,
      Buffer.concat([declarationBytes, Buffer.from(' ')]),
    ),
  );
  assert.throws(() =>
    executedInputs(
      manifest,
      executedWitnessBytes,
      declarationBytes,
      Buffer.concat([workflowBytes, Buffer.from(' ')]),
    ),
  );
});
function previousAttempt(plan) {
  const previous = plan.previousAttempt;
  assert.equal(previous.revision, '1cbc4a98afd4e980817579b31d76b995ba261773');
  assert.equal(previous.tree, '39f99c40699057805673baa6b2cd3d0301e128cd');
  assert.equal(previous.run, 39082271731);
  assert.equal(previous.artifact, 12119746074);
  assert.deepEqual(previous.archive, {
    bytes: 14742,
    sha256: '2c786982eff968c74309574dc8e2bf655f7b12eaf5dc2af16cd9fd5c7d1bf386',
  });
  assert.equal(previous.status, 'failed-fresh-owner-media-withheld');
  assert.deepEqual(previous.contracts, { tests: 91, pass: 87, fail: 0, skipped: 4 });
  assert.equal(previous.fullBeforeAndAllInventoriesRetained, false);
  assert.equal(previous.retrospectiveOwnershipPass, false);
  assert.deepEqual(
    previous.reports.map(({ member, bytes }) => [member, bytes]),
    [
      ['solo-native-mp3-evidence/owner-preflight.json', 4160],
      ['solo-native-mp3-evidence/owner-preflight-command.json', 8590],
    ],
  );
  for (const ref of previous.reports) {
    assert.equal(Buffer.byteLength(ref.utf8), ref.bytes);
    assert.equal(sha(ref.utf8), ref.sha256);
  }
  const [report, command] = previous.reports.map((ref) => JSON.parse(ref.utf8));
  assert.equal(report.status, 'failed');
  assert.equal(report.sourceRevision, previous.revision);
  assert.equal(nativeOwnerPreflightComplete(report, command), false);
  assert.equal(command.status, 'failed');
  assert.equal(command.violation, 'unattributed-new-browser');
  assert.equal(command.forcedCleanup, true);
  assert.deepEqual(command.ambiguous, []);
  assert.deepEqual(command.survivors, []);
  const row = command.firstAmbiguousInventory.row;
  assert.deepEqual(
    [row.pid, row.ppid, row.pgid, row.birth, row.version, row.argv],
    [3457, 1, 1, '00000000000000003457', 7239, '/usr/libexec/xpcproxy'],
  );
  assert.equal(row.pathInspection, 'complete');
  assert.equal(row.rssInspection, 'unavailable');
  assert.equal(row.ownerTagInspection, 'unavailable');
  const maps = command.firstAmbiguousIdentityMaps;
  assert.equal(maps.format, 'SoloFirstAmbiguousIdentityMapsV1');
  assert.deepEqual(maps.before, {
    status: 'overflow',
    reason: 'byte-cap',
    totalRows: 445,
    maximumBytes: 262144,
    minimumSerializationBytes: 262902,
    rows: null,
  });
  assert.deepEqual(maps.current, {
    status: 'overflow',
    reason: 'byte-cap',
    totalRows: 454,
    maximumBytes: 262144,
    minimumSerializationBytes: 262731,
    rows: null,
  });
  assert.equal(maps.owned.status, 'complete');
  assert.deepEqual(
    maps.owned.rows.map((row) => row.pid),
    [3434, 3451, 3445],
  );
  assert.equal(sha(JSON.stringify(maps.owned.rows)), maps.owned.sha256);
  return previous;
}
test('actual1cbc first ambiguity and overflow remain failed despite final clean closure', async () => {
  const previous = previousAttempt(manifest);
  for (const ref of [
    previous.workflow,
    manifest.historicalSource,
    manifest.priorNonBrowserWitness,
  ]) {
    const bytes = await read(ref.path);
    assert.equal(bytes.length, ref.bytes, ref.path);
    assert.equal(sha(bytes), ref.sha256, ref.path);
  }
  for (const mutate of [
    (p) => p.previousAttempt.run++,
    (p) => (p.previousAttempt.retrospectiveOwnershipPass = true),
    (p) => (p.previousAttempt.fullBeforeAndAllInventoriesRetained = true),
    (p) => (p.previousAttempt.reports[0].utf8 += ' '),
    (p) => (p.previousAttempt.contracts.skipped = 0),
  ]) {
    const plan = structuredClone(manifest);
    mutate(plan);
    assert.throws(() => previousAttempt(plan));
  }
});
function workflow(text, old) {
  const conditions = [
    'github.event.pull_request.number == 1578',
    'github.event.pull_request.head.repo.full_name == github.repository',
    "github.event.action == 'synchronize'",
    "github.event.before == 'c82d0825999f014c7a5c17386542f3219f4f04e5'",
  ];
  assert.equal(text.match(/^    if: (.+)$/m)?.[1], conditions.join(' && '));
  assert(!text.includes('workflow_dispatch'));
  assert.match(text, /runs-on: macos-15-intel/);
  assert.match(text, /SOLO_DARWIN_AMBIGUITY_EVIDENCE: 'identity-maps-v2'/);
  assert.match(text, /timeout-minutes: 28/);
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /persist-credentials: false/);
  assert.match(text, /SOLO_TOOLING_REVISION: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(text, /ref: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(
    text,
    /node --test scripts\/test-solo-cocoa-identity-v2-release.mjs scripts\/test-solo-cocoa-identity-release.mjs scripts\/test-solo-cocoa-metal-release.mjs scripts\/test-solo-cocoa-owner397-release.mjs/,
  );
  const marker = '      - name: Compile the exact read-only SDK inventory';
  assert(text.includes(marker) && old.includes(marker));
  assert.equal(
    text
      .slice(text.indexOf(marker))
      .replaceAll('solo-native-mp3-cocoa-identity-v2-', 'solo-native-mp3-cocoa-identity-'),
    old.slice(old.indexOf(marker)),
  );
  const sparse = [...text.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  const originalSparse = [...old.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  assert.equal(new Set(sparse).size, sparse.length);
  const expected = new Set([
    ...originalSparse,
    workflowPath,
    planPath,
    witnessPath,
    'scripts/test-solo-cocoa-identity-v2-release.mjs',
  ]);
  assert.deepEqual([...sparse].sort(), [...expected].sort());
  return conditions;
}
test('separate PR1578 edge changes only evidence mode and retains all native command budgets', async () => {
  const text = (await read(workflowPath)).toString();
  const old = (await read(oldWorkflowPath)).toString();
  for (const condition of workflow(text, old))
    assert.throws(() => workflow(text.replace(condition, 'true'), old));
  for (const [before, after] of [
    ["'identity-maps-v2'", "'identity-maps-v1'"],
    ['timeout-minutes: 28', 'timeout-minutes: 29'],
    ['run-cocoa', 'child-cocoa'],
    ['if: always()', 'if: success()'],
    ['/' + witnessPath, '/missing-witness'],
    ['persist-credentials: false', 'persist-credentials: true'],
  ]) {
    assert(text.includes(before));
    assert.throws(() => workflow(text.replace(before, after), old));
  }
  const sparse = [...text.matchAll(/^            \/(.+)$/gm)].map((match) => match[1]);
  for (const path of sparse) assert((await read(path)).length > 0, path);
});
test('V2 preserves codec identity, report/map caps, no retries and diagnostic-only authority', () => {
  assert.equal(manifest.scope, original.scope);
  assert.equal(manifest.productionPackage, null);
  assert.equal(manifest.performanceQualification, false);
  assert.equal(manifest.evidenceProtocol, 'identity-maps-v2');
  assert.equal(manifest.release.status, 'pinned-for-execution');
  assert.equal(manifest.release.onceOnlyBefore, 'c82d0825999f014c7a5c17386542f3219f4f04e5');
  assert.equal(manifest.release.automaticRetries, 0);
  assert.equal(manifest.release.automaticPhaseContinuation, false);
  assert.deepEqual(manifest.limits, original.limits);
  for (const [key, value] of Object.entries(manifest.limits))
    if (key !== 'jobMinutes') assert.equal(MP3_COCOA_CONTROL[key], value, key);
  assert.deepEqual(manifest.media, original.media);
  assert.deepEqual(MP3_COCOA_CONTROL.arms, ['bossa-blob']);
  assert.equal(MP3_COCOA_CONTROL.maximumReportBytes, 1048576);
  assert.deepEqual(manifest.evidenceLimits, {
    beforeBytes: 262144,
    currentBytes: 262144,
    ownedBytes: 65536,
    maximumContainingIndentBytes: 24,
    cocoaReportBytes: 1048576,
  });
});
