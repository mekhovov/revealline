import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const oldPath = '.github/workflows/solo-darwin-owner-preflight-kernel-ps-temporary.yml';
const path = '.github/workflows/solo-darwin-owner-preflight-thermald-temporary.yml';
const fixturePath = 'docs/performance/fixtures/solo-darwin-inventory/92ff-cocoa-execution.json';
const testPath = 'scripts/test-solo-darwin-thermald-release.mjs';
const oldBytes = await read(oldPath);
const old = oldBytes.toString();
const workflow = (await read(path)).toString();
const fixtureBytes = await read(fixturePath);
const fixture = JSON.parse(fixtureBytes);

test('executed92ff prerequisite failure and declaration remain immutable', () => {
  assert.equal(
    hash(fixtureBytes),
    '2d39bb6596fd3541cecbdfbfde5eca3cb2121abaf2b0d55de4bd8c94748df5e3',
  );
  assert.equal(fixture.head, '92ff7ef800e542617b4fc3efad96bd07ce6cbecb');
  assert.equal(fixture.run, 39054542040);
  assert.equal(fixture.conclusion, 'failure');
  assert.equal(fixture.preflight.status, 'passed');
  assert.equal(fixture.cocoa.browserObservations, 0);
  const record = fixture.records.find((r) => r.path === oldPath);
  assert.equal(oldBytes.length, record.bytes);
  assert.equal(hash(oldBytes), record.sha256);
});

test('successor preserves three owner cases, Cocoa workload, versions and deadlines', () => {
  let expected = old
    .replace(
      'name: Temporary Darwin kernel-path classification successor',
      'name: Temporary Darwin thermal-daemon classification successor',
    )
    .replace(
      `      - '${oldPath}'`,
      `      - '${path}'\n      - '${testPath}'\n      - '${fixturePath}'`,
    )
    .replace('group: solo-darwin-kernel-ps-preflight-', 'group: solo-darwin-thermald-preflight-')
    .replace(
      '# Exact kernel-path classification correction; original239 deadline failure remains failed.',
      '# Exact thermal-daemon classification correction; executed92ff Cocoa prerequisite stays failed.',
    )
    .replace(
      "github.event.before == '239c574ecddd5bb6d5896e621d9edc53e7f6a313'",
      `github.event.before == '${fixture.head}'`,
    );
  let [a, b] = expected.split('\n  cocoa:\n');
  a = a
    .replace(
      `            /${oldPath}\n`,
      `            /${oldPath}\n            /${path}\n            /${fixturePath}\n            /${testPath}\n`,
    )
    .replace(
      'scripts/test-solo-darwin-kernel-ps-release.mjs >',
      `scripts/test-solo-darwin-kernel-ps-release.mjs ${testPath} >`,
    );
  b = b
    .replace(
      "          SOLO_RUN_DARWIN_OWNER_TESTS: '1'",
      "          SOLO_RUN_DARWIN_OWNER_TESTS: '1'\n          SOLO_DARWIN_OWNER_EVIDENCE: ${{ runner.temp }}/solo-native-mp3-contracts",
    )
    .replace(
      'scripts/test-solo-remote-correctness.mjs\n      - name:',
      'scripts/test-solo-remote-correctness.mjs > "$RUNNER_TEMP/solo-native-mp3-contracts.tap" 2>&1\n      - name:',
    )
    .replace(
      '            ${{ runner.temp }}/solo-native-mp3-prerequisite.json\n',
      '            ${{ runner.temp }}/solo-native-mp3-prerequisite.json\n            ${{ runner.temp }}/solo-native-mp3-contracts.tap\n            ${{ runner.temp }}/solo-native-mp3-contracts\n',
    );
  assert.equal(workflow, a + '\n  cocoa:\n' + b);
  for (const term of ['workflow_dispatch', 'continue-on-error', 'cancel-in-progress: true'])
    assert(!workflow.includes(term));
});

test('both exact sparse source closures remain readable and unique', async () => {
  const lists = (text) =>
    [...text.matchAll(/          sparse-checkout: \|\n((?:            .+\n)+)/g)].map((m) =>
      m[1]
        .trim()
        .split('\n')
        .map((s) => s.trim().slice(1)),
    );
  const previous = lists(old),
    actual = lists(workflow);
  assert.equal(actual.length, 2);
  assert.deepEqual(actual[1], previous[1]);
  assert.deepEqual(
    actual[0].filter((p) => !previous[0].includes(p)),
    [path, fixturePath, testPath],
  );
  for (const list of actual) {
    assert.equal(list.length, new Set(list).size);
    for (const p of list) assert((await read(p)).length > 0, p);
  }
});
