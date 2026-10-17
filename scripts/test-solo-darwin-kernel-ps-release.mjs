import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oldPath = '.github/workflows/solo-darwin-owner-preflight-temporary.yml';
const path = '.github/workflows/solo-darwin-owner-preflight-kernel-ps-temporary.yml';
const witnessPath = 'docs/performance/fixtures/solo-darwin-inventory/239-preflight-execution.json';
const testPath = 'scripts/test-solo-darwin-kernel-ps-release.mjs';
const oldBytes = await read(oldPath);
const old = oldBytes.toString();
const workflow = (await read(path)).toString();
const witnessBytes = await read(witnessPath);
function history(bytes, declaration) {
  assert.equal(hash(bytes), 'b8e342d11f07272edbc96b069dd349ecd12ee9b7b95ba28a551b4b405e4e1c3d');
  const witness = JSON.parse(bytes);
  assert.equal(witness.head, '239c574ecddd5bb6d5896e621d9edc53e7f6a313');
  assert.equal(witness.tree, '1ac7f17971498d2a8be19085f00a9f732db42798');
  assert.equal(witness.run, 39049194885);
  assert.equal(witness.conclusion, 'failure');
  assert.deepEqual(witness.nativeCases, { leader: 'passed', tree: 'passed', deadline: 'failed' });
  assert.equal(witness.cocoa, 'skipped');
  const record = witness.records.find((r) => r.path === oldPath);
  assert.equal(declaration.length, record.bytes);
  assert.equal(hash(declaration), record.sha256);
  return witness;
}
test('actual239 failed source and original workflow remain immutable', () => {
  const proof = history(witnessBytes, oldBytes);
  assert.equal(proof.records.length, 6);
  for (const changed of [Buffer.from('{}'), Buffer.concat([witnessBytes, Buffer.from(' ')])])
    assert.throws(() => history(changed, oldBytes));
  assert.throws(() => history(witnessBytes, Buffer.concat([oldBytes, Buffer.from(' ')])));
});
const before = '239c574ecddd5bb6d5896e621d9edc53e7f6a313';
const terms = [
  'github.event.pull_request.number == 1544',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "github.event.action == 'synchronize'",
  `github.event.before == '${before}'`,
];
function guard(text) {
  assert.equal(text.split('\n  cocoa:\n')[0].match(/^    if: (.+)$/m)?.[1], terms.join(' && '));
  for (const word of ['workflow_dispatch', 'continue-on-error', 'cancel-in-progress: true'])
    assert(!text.includes(word));
}
test('separately named correction retains the exact three-case command and conditional Cocoa authority', () => {
  guard(workflow);
  for (const term of terms) assert.throws(() => guard(workflow.replace(term, 'true')));
  assert.equal(workflow.split('\n  cocoa:\n')[1], old.split('\n  cocoa:\n')[1]);
  let expected = old
    .replace(
      'name: Temporary non-browser Darwin ownership preflight',
      'name: Temporary Darwin kernel-path classification successor',
    )
    .replace(
      `      - '${oldPath}'`,
      `      - '${path}'\n      - '${testPath}'\n      - '${witnessPath}'`,
    )
    .replace('group: solo-darwin-owner-preflight-', 'group: solo-darwin-kernel-ps-preflight-')
    .replace(
      '# One evidence-latch observation; the exact 7c7 process-tree failure remains failed.',
      '# Exact kernel-path classification correction; original239 deadline failure remains failed.',
    )
    .replace(
      "github.event.before == '7c7cc2648331870683ac7b76850bbeff859f802e'",
      `github.event.before == '${before}'`,
    );
  const [a, b] = expected.split('\n  cocoa:\n');
  expected =
    a
      .replace(
        `            /${oldPath}\n`,
        `            /${oldPath}\n            /${path}\n            /${witnessPath}\n            /${testPath}\n`,
      )
      .replace(
        'scripts/test-solo-darwin-owner-preflight.mjs >',
        `scripts/test-solo-darwin-owner-preflight.mjs ${testPath} >`,
      ) +
    '\n  cocoa:\n' +
    b;
  assert.equal(
    workflow,
    expected,
    'no undeclared command, source, timeout, cleanup or Cocoa edits',
  );
  assert.deepEqual(
    [...workflow.split('\n  cocoa:\n')[0].matchAll(/timeout-minutes: (\d+)/g)].map((m) => +m[1]),
    [24, 2, 1, 6, 2, 3, 6, 2],
  );
});
test('prospective checkout includes every prior input and the new source-bound control', async () => {
  const list = (text) =>
    text
      .split('\n  cocoa:\n')[0]
      .match(/          sparse-checkout: \|\n((?:            .+\n)+)/)[1]
      .trim()
      .split('\n')
      .map((line) => line.trim().slice(1));
  const prior = list(old),
    actual = list(workflow);
  assert.equal(actual.length, new Set(actual).size);
  assert.deepEqual(
    actual.filter((p) => !prior.includes(p)),
    [path, witnessPath, testPath],
  );
  for (const p of prior) assert(actual.includes(p), p);
  for (const p of actual) assert((await read(p)).length > 0, p);
  const contracts = workflow.match(/node --test --test-concurrency=2 ([^\n]+) >/)[1].split(' ');
  assert.deepEqual(contracts, [
    'scripts/test-solo-darwin-process-inventory.mjs',
    'scripts/test-solo-darwin-process-inventory-sdk.mjs',
    'scripts/test-solo-darwin-owner-preflight.mjs',
    testPath,
  ]);
  for (const p of contracts) assert(actual.includes(p));
});
