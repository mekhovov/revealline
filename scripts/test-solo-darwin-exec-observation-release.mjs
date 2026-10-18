import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DARWIN_EXEC_OBSERVATION, DARWIN_OWNER_PREFLIGHT } from './solo-darwin-owner-preflight.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const oldPath = '.github/workflows/solo-darwin-owner-preflight-thermald-temporary.yml';
const path = '.github/workflows/solo-darwin-exec-observation-temporary.yml';
const testPath = 'scripts/test-solo-darwin-exec-observation-release.mjs';
const witnessPath = 'docs/performance/fixtures/solo-darwin-inventory/34d95-xpcproxy-execution.json';
const [oldBytes, workflowBytes, witnessBytes] = await Promise.all([
  read(oldPath),
  read(path),
  read(witnessPath),
]);
const old = oldBytes.toString(),
  workflow = workflowBytes.toString(),
  witness = JSON.parse(witnessBytes);
const edge = 'bab3b2790944c6257f9c1f9b346839996bbefebb';
const terms = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  `github.event.before == '${edge}'`,
];
function release(text) {
  assert.deepEqual(
    [...text.matchAll(/^    if: (.+)$/gm)].map((m) => m[1]),
    [terms.join(' && ')],
  );
  assert.deepEqual(
    [...text.matchAll(/^  ([a-z][a-z-]*):\n/gm)]
      .map((m) => m[1])
      .filter((x) => x !== 'pull_request'),
    ['preflight'],
  );
  for (const forbidden of [
    'workflow_dispatch',
    'workflow_run',
    'continue-on-error',
    'cancel-in-progress: true',
    '    outputs:',
    'GITHUB_OUTPUT',
    'sudo ',
    'playwright install',
    'run-cocoa',
  ])
    assert(!text.includes(forbidden), forbidden);
  assert(
    text.includes(
      'node scripts/solo-darwin-owner-preflight.mjs run-exec-observation "$RUNNER_TEMP/solo-owner-v2-preflight"',
    ),
  );
  assert(text.includes('if: always()'));
}
test('the new observation has one exact edge and no downstream admission or privilege', () => {
  release(workflow);
  for (const term of terms) assert.throws(() => release(workflow.replace(term, 'true')));
  assert.throws(() => release(workflow.replace('run-exec-observation', 'run')));
  assert.throws(() => release(workflow + '\n  cocoa:\n    runs-on: macos-15-intel\n'));
  assert.throws(() =>
    release(
      workflow.replace(
        'node scripts/solo-darwin-owner-preflight',
        'sudo node scripts/solo-darwin-owner-preflight',
      ),
    ),
  );
  assert.deepEqual(
    [...workflow.matchAll(/timeout-minutes: (\d+)/g)].map((m) => Number(m[1])),
    [24, 2, 1, 6, 2, 3, 6, 2],
  );
  assert(workflow.includes('runs-on: macos-15-intel'));
  assert(workflow.includes("node-version: '22.13.1'"));
  assert(workflow.includes('persist-credentials: false'));
  assert.equal(DARWIN_OWNER_PREFLIGHT.maximumElapsedMs, 240000);
  assert.deepEqual(DARWIN_EXEC_OBSERVATION, {
    format: 'SoloDarwinExecSuccessorObservationV1',
    maximumSnapshots: 3,
    maximumElapsedMs: 10000,
    maximumRecords: 4,
    maximumBytes: 16384,
    intervalMs: 250,
  });
});
test('the actual failed launcher and executed workflow retain immutable exact source identities', () => {
  const check = (bytes, declaration) => {
    assert.equal(hash(bytes), '8128eae8713cafced1b8895b431935248b142fc52b85976be282ea357b3b48bc');
    const w = JSON.parse(bytes);
    assert.equal(w.revision, '34d95cb9fe471ca56c243f05c4330826ba822fb9');
    assert.equal(w.run, 39057302520);
    assert.equal(w.job, 117467788107);
    assert.equal(w.conclusion, 'failure');
    assert.deepEqual(w.cases, { leader: 'failed', tree: 'withheld', deadline: 'withheld' });
    assert.equal(w.cocoa, 'skipped');
    assert.equal(w.records.length, 5);
    const r = w.records.find((r) => r.path === oldPath);
    assert.equal(declaration.length, r.bytes);
    assert.equal(hash(declaration), r.sha256);
    for (const r of w.records) {
      assert.match(r.blob, /^[a-f0-9]{40}$/);
      assert.match(r.sha256, /^[a-f0-9]{64}$/);
      assert(r.bytes > 0);
    }
    assert.equal(w.firstAmbiguousRow.argv, '/usr/libexec/xpcproxy');
    assert.equal(w.firstAmbiguousRow.rssInspection, 'unavailable');
    assert.equal(w.firstAmbiguousRow.ownerTagInspection, 'unavailable');
    return w;
  };
  check(witnessBytes, oldBytes);
  assert.throws(() => check(Buffer.concat([witnessBytes, Buffer.from(' ')]), oldBytes));
  assert.throws(() => check(witnessBytes, Buffer.concat([oldBytes, Buffer.from(' ')])));
});
test('new checkout preserves all prior contract inputs and adds only its three release files', async () => {
  const list = (text) =>
    text
      .match(/          sparse-checkout: \|\n((?:            .+\n)+)/)[1]
      .trim()
      .split('\n')
      .map((s) => s.trim().slice(1));
  const prior = list(old.split('\n  cocoa:\n')[0]),
    actual = list(workflow);
  const check = (values) => {
    assert.equal(values.length, new Set(values).size);
    assert.deepEqual([...values].sort(), [...prior, path, testPath, witnessPath].sort());
  };
  check(actual);
  for (const p of actual) {
    assert.throws(() => check(actual.filter((x) => x !== p)));
    assert((await read(p)).length > 0, p);
  }
  for (const p of [
    'scripts/test-solo-darwin-process-inventory.mjs',
    'scripts/test-solo-darwin-process-inventory-sdk.mjs',
    'scripts/test-solo-darwin-owner-preflight.mjs',
    'scripts/test-solo-darwin-kernel-ps-release.mjs',
    'scripts/test-solo-darwin-thermald-release.mjs',
    testPath,
  ])
    assert(workflow.includes(p));
  assert(workflow.includes('sparse-checkout-cone-mode: false'));
  assert(!workflow.includes('\n          filter:'));
});
test('current runner, native inventory and old ownership predicates are not changed by this observation mode', async () => {
  for (const p of [
    'scripts/solo-darwin-process-inventory.c',
    'scripts/solo-darwin-process-inventory.mjs',
    'scripts/run-solo-remote-correctness.mjs',
  ]) {
    const r = witness.records.find((r) => r.path === p),
      b = await read(p);
    assert.equal(b.length, r.bytes, p);
    assert.equal(hash(b), r.sha256, p);
  }
  const source = (await read('scripts/solo-darwin-owner-preflight.mjs')).toString();
  assert(source.includes("if (report.cases.some((row) => row.status === 'failed'))"));
  assert(source.includes("if (r.status !== 'passed') process.exitCode = 1"));
  for (const token of ['process.kill(', 'sudo', 'launchctl', 'execFileSync(binary'])
    assert(!source.includes(token), token);
});
