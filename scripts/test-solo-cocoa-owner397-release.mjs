import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
const root = process.cwd();
const proposal = process.env.SOLO_COCOA_397_PROPOSAL || root;
const fixturePath = 'docs/performance/fixtures/solo-darwin-inventory/397-owner-preflight.json';
const workflowPath = '.github/workflows/solo-native-mp3-cocoa-owner397-temporary.yml';
const oldPath = '.github/workflows/solo-darwin-owner-preflight-thermald-temporary.yml';
const witness = JSON.parse(await readFile(join(proposal, fixturePath)));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
// This exact source already executed. The additive Git witness is historical only;
// future declarations must still admit their own current helper bytes.
const executed816Bytes = await readFile(
  new URL(
    'docs/performance/fixtures/solo-native-816/executed-source.json',
    process.env.SOLO_EXECUTED_816_PROPOSAL || new URL('../', import.meta.url),
  ),
);
function executed816Bindings(bytes, bindings) {
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    '017ca49b181d9e2aece4fc059dfac32b21ecea47f2759f262255efd93d1ff45f',
  );
  const value = JSON.parse(bytes);
  assert.equal(value.format, 'Solo816ExecutedSourceWitnessV1');
  assert.equal(value.revision, '8161953a10b9c37e603d78f236e277da380e57ad');
  assert.equal(value.tree, '3cc69ce4de5367590e9bd11e4eeed38ddd510d9a');
  assert.equal(value.postHocExactGitReadback, true);
  assert.deepEqual(
    value.runs.map((r) => r.run),
    [39073210040, 39073210270, 39073210265, 39073210308],
  );
  assert.equal(value.records.length, 73);
  assert.equal(new Set(value.records.map((r) => r.path)).size, value.records.length);
  for (const ref of value.records) assert.match(ref.blob, /^[a-f0-9]{40}$/);
  for (const [path, input] of bindings) {
    const ref = value.records.find((r) => r.path === path);
    assert(ref, path);
    assert.equal(input.length, ref.bytes, path);
    assert.equal(createHash('sha256').update(input).digest('hex'), ref.sha256, path);
  }
  return value;
}
function executed816Ref(execution, ref) {
  const entry = execution.records.find((r) => r.path === ref.path);
  assert(entry, ref.path);
  assert.equal(entry.bytes, ref.bytes, ref.path);
  assert.equal(entry.sha256, ref.sha256, ref.path);
}

const executed816 = executed816Bindings(executed816Bytes, [
  [fixturePath, await readFile(join(proposal, fixturePath))],
  [workflowPath, await readFile(join(proposal, workflowPath))],
]);
test('executed816 rejects changed witness bytes and original declaration or workflow bytes', () => {
  assert.throws(() => executed816Bindings(Buffer.from('{}'), []));
  const ref = executed816.records.find((r) => r.path === fixturePath);
  assert.throws(() => executed816Bindings(executed816Bytes, [[ref.path, Buffer.from('{}')]]));
  const workflowRef = executed816.records.find((r) => r.path === workflowPath);
  assert.throws(() =>
    executed816Bindings(executed816Bytes, [[workflowRef.path, Buffer.from('{}')]]),
  );
  assert.throws(() => executed816Ref(executed816, { ...ref, sha256: '0'.repeat(64) }));
  assert.throws(() => executed816Ref(executed816, { ...ref, bytes: ref.bytes + 1 }));
});
const { assessDarwinOwnerCase } = await import(
  pathToFileURL(join(root, 'scripts/solo-darwin-owner-preflight.mjs'))
);
const { MP3_COCOA_CONTROL, nativeOwnerPreflightComplete } = await import(
  pathToFileURL(join(root, 'scripts/solo-native-mp3-control.mjs'))
);
function prerequisite(value) {
  const source = '39774cce8697d412d138ef4da11ac547a5f8e535';
  assert.equal(value.format, 'SoloDarwin397PrerequisiteWitnessV1');
  assert.equal(value.sourceRevision, source);
  assert.equal(value.sourceTree, 'cac2369a26cac5282e4260c638b934540d17ced6');
  assert.equal(value.status, 'passed-declared-non-browser-cases');
  assert.equal(value.run, 39066188284);
  assert.equal(value.workflow, '.github/workflows/solo-darwin-exec-observation-temporary.yml');
  assert.equal(value.artifact.id, 12112809455);
  assert.equal(value.artifact.size_in_bytes, 15163);
  assert.equal(
    value.artifact.digest,
    'sha256:769d581252aaa2a0fb9247408fb2e3a8e67184fcf4374ed2da50cff3bd6918f5',
  );
  assert.equal(value.artifact.workflow_run.id, value.run);
  assert.equal(value.artifact.workflow_run.head_sha, source);
  assert.equal(value.report.bytes, 17935);
  assert.equal(Buffer.byteLength(value.report.utf8), value.report.bytes);
  assert.equal(
    value.report.sha256,
    'eaae0857724dfe239d25d48b8400b18b67ee39b57792d72d6f206fc900cdd86b',
  );
  assert.equal(sha(value.report.utf8), value.report.sha256);
  const report = JSON.parse(value.report.utf8);
  assert.equal(report.sourceRevision, source);
  assert.equal(report.status, 'passed');
  assert.equal(report.platform, 'darwin');
  assert.equal(report.architecture, 'x64');
  assert.deepEqual(
    report.cases.map((r) => r.id),
    ['leader', 'tree', 'deadline'],
  );
  for (const row of report.cases) {
    const result = assessDarwinOwnerCase(row.id, row.command, row.observations, source);
    assert.deepEqual(result, row.assessment);
    assert.equal(result.status, row.id === 'deadline' ? 'expected-negative-observed' : 'passed');
    assert.equal(result.failures.length, 0);
    assert.deepEqual(row.command.processInventory, {
      platform: 'darwin',
      ...value.inventoryBuild.binary,
    });
    assert.equal(row.execSuccessorObservation, undefined);
    assert.equal(row.command.firstAmbiguousInventory, undefined);
  }
  assert.equal(report.browserObservations, 0);
  assert.equal(report.mediaObservations, 0);
  assert.equal(report.performanceQualification, false);
  assert.equal(report.ownershipQualification, false);
  return report;
}
test('actual397 retained non-browser proof is source bound and re-assessed without promoting browser authority', async () => {
  const report = prerequisite(witness);
  assert.equal(nativeOwnerPreflightComplete(report, report.cases[0].command), false);
  for (const ref of report.sources) {
    executed816Ref(executed816, ref);
  }
});
test('missing or substituted previous-host source, archive, raw report and case evidence fails', () => {
  for (const mutate of [
    (w) => {
      w.sourceRevision = 'f'.repeat(40);
    },
    (w) => {
      w.sourceTree = 'f'.repeat(40);
    },
    (w) => {
      w.run++;
    },
    (w) => {
      w.artifact.id++;
    },
    (w) => {
      w.artifact.digest = 'sha256:' + '0'.repeat(64);
    },
    (w) => {
      w.report.utf8 = w.report.utf8.replace('"status": "passed"', '"status": "failed"');
    },
    (w) => {
      w.inventoryBuild.binary.sha256 = '0'.repeat(64);
    },
  ]) {
    const changed = structuredClone(witness);
    mutate(changed);
    assert.throws(() => prerequisite(changed));
  }
  const report = prerequisite(witness);
  for (const mutate of [
    (c) => {
      c.survivors = [{ pid: 1 }];
    },
    (c) => {
      c.ambiguous = [{ pid: 1 }];
    },
    (c) => {
      c.cleanupUnconfirmed = true;
    },
    (c) => {
      c.argv[5] = 'f'.repeat(40);
    },
    (c) => {
      c.forcedCleanup = true;
    },
  ]) {
    const row = structuredClone(report.cases[0]);
    mutate(row.command);
    assert.equal(
      assessDarwinOwnerCase(row.id, row.command, row.observations, report.sourceRevision).status,
      'failed',
    );
  }
});
function workflow(text, old) {
  assert.equal(
    text.match(/^    if: (.+)$/m)?.[1],
    [
      'github.event.pull_request.number == 1544',
      'github.event.pull_request.head.repo.full_name == github.repository',
      "github.event.action == 'synchronize'",
      "github.event.before == '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0'",
    ].join(' && '),
  );
  assert(!text.includes('workflow_dispatch') && !text.includes('needs: preflight'));
  assert.match(text, /runs-on: macos-15-intel/);
  assert.match(text, /timeout-minutes: 28/);
  assert.match(text, /cancel-in-progress: false/);
  assert.match(text, /SOLO_TOOLING_REVISION: \$\{\{ github.event.pull_request.head.sha \}\}/);
  assert.match(text, /node --test scripts\/test-solo-cocoa-owner397-release.mjs/);
  assert.match(text, /scope: witness.scope/);
  const marker = '      - name: Compile the exact read-only SDK inventory';
  const actual = text
    .slice(text.indexOf(marker))
    .replaceAll('solo-native-mp3-cocoa-owner397-', 'solo-native-mp3-cocoa-');
  assert.equal(actual, old.slice(old.indexOf(marker, old.indexOf('  cocoa:\n'))));
  const sparse = [...text.matchAll(/^            \/(.+)$/gm)].map((m) => m[1]);
  assert.equal(sparse.length, new Set(sparse).size);
  for (const path of [
    workflowPath,
    fixturePath,
    oldPath,
    'scripts/test-solo-cocoa-owner397-release.mjs',
    'scripts/solo-darwin-owner-preflight.mjs',
  ])
    assert(sparse.includes(path), path);
}
test('one-shot separate workflow preserves all native commands, fresh owner gate, bounds and unconditional failure upload', async () => {
  const text = await readFile(join(proposal, workflowPath), 'utf8');
  const old = await readFile(join(root, oldPath), 'utf8');
  workflow(text, old);
  for (const [before, after] of [
    ['github.event.pull_request.number == 1544', 'true'],
    ['github.event.pull_request.head.repo.full_name == github.repository', 'true'],
    ["github.event.action == 'synchronize'", 'true'],
    ["github.event.before == '5e9e16fd48f4b96b4a7fe30c72aa835ce9f536f0'", 'true'],
    ['timeout-minutes: 28', 'timeout-minutes: 29'],
    ['run-cocoa', 'child-cocoa'],
    ['install webkit', 'install chromium'],
    ['if: always()', 'if: success()'],
    ['/' + fixturePath, '/missing-prerequisite'],
  ]) {
    assert(text.includes(before));
    assert.throws(() => workflow(text.replace(before, after), old));
  }
});
test('original Bossa-only Cocoa timing and resource limits are unchanged and exclude game qualification', () => {
  assert.deepEqual(MP3_COCOA_CONTROL.arms, ['bossa-blob']);
  assert.equal(MP3_COCOA_CONTROL.playwright, '1.62.1');
  assert.equal(MP3_COCOA_CONTROL.webkitRevision, '2336');
  assert.equal(MP3_COCOA_CONTROL.browserVersion, '26.5');
  assert.equal(MP3_COCOA_CONTROL.ownerPreflightTimeoutMs, 120000);
  assert.equal(MP3_COCOA_CONTROL.passiveMs, 5000);
  assert.equal(MP3_COCOA_CONTROL.playbackMs, 10000);
  assert.equal(MP3_COCOA_CONTROL.sampleMs, 500);
  assert.equal(MP3_COCOA_CONTROL.armTimeoutMs, 60000);
  assert.equal(MP3_COCOA_CONTROL.commandTimeoutMs, 300000);
  assert.equal(MP3_COCOA_CONTROL.preparationTimeoutMs, 180000);
  assert.equal(MP3_COCOA_CONTROL.maximumEvidenceBytes, 16 * 1024 * 1024);
  assert.equal(MP3_COCOA_CONTROL.maximumRecords, 128);
  assert.equal(MP3_COCOA_CONTROL.maximumSamples, 32);
});
