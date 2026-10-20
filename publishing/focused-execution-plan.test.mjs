import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { prepareCompactFocusedExecution, focusedCommandShard } from './focused-tests.mjs';

const sha = (x) => createHash('sha256').update(x).digest('hex');
const policy = {
  format: 'revealline-release-test-policy.v1',
  authorization: 'explicit-user-request-20261004',
  mode: 'required',
  reason: 'Tests required',
  restoration: 'Required',
  scope: 'automated-test-suites',
};
const manifest = {
  format: 'revealline-focused-test-map.v1',
  categories: [
    {
      id: 'example',
      pathPatterns: ['^game/'],
      commands: [
        { id: 'package', command: 'npm', args: ['run', 'test:example'] },
        { id: 'direct', command: 'node', args: ['--test', 'game/test/example.test.mjs'] },
      ],
    },
  ],
  ignoredPathPatterns: ['^docs/'],
  runtimePathPatterns: ['\\.mjs$'],
  fallbackCommands: [{ id: 'fallback', command: 'npm', args: ['run', 'validate'] }],
};

function fixture() {
  const paths = ['game/example.mjs'];
  const manifestBytes = JSON.stringify(manifest),
    testPolicyBytes = JSON.stringify(policy);
  return {
    paths,
    manifestBytes,
    testPolicyBytes,
    inputs: {
      packageScripts: { 'test:example': 'node --test game/test/example.test.mjs' },
      repositoryFiles: ['game/test/example.test.mjs'],
      shellSemantics: 'posix',
    },
    identity: {
      repository: 'mekhovov/revealline',
      pullRequest: 1,
      sourceContext: 'exact-head',
      sourceRevision: 'a'.repeat(40),
      sourceTree: 'b'.repeat(40),
      baseSha: 'c'.repeat(40),
      baseRef: 'main',
      workflowRevision: 'd'.repeat(40),
      policyDigest: '1'.repeat(64),
      testPolicySha256: sha(testPolicyBytes),
      manifestSha256: sha(manifestBytes),
      changedPathsSha256: sha(JSON.stringify(paths)),
      setupSha256: '6'.repeat(64),
      nodeVersion: 'v20.19.5',
      platform: 'linux',
      architecture: 'x64',
      runId: '1',
      runAttempt: 1,
      fallbackHandled: false,
    },
  };
}

test('runner count comes after unchanged package deduplication, not raw selection', () => {
  const input = fixture(),
    before = JSON.stringify(input);
  const { plan, selection } = prepareCompactFocusedExecution(input);
  assert.equal(selection.selected.commands.length, 2);
  assert.equal(selection.execution.commands.length, 1);
  assert.equal(selection.execution.deduplicated[0].id, 'direct');
  assert.equal(plan.shardCount, 1);
  assert.deepEqual(plan.commands, selection.execution.commands);
  assert.equal(JSON.stringify(input), before);
});

test('unknown shell, lifecycle hooks, missing files and mixed scripts retain original coverage', () => {
  const variants = [
    (x) => {
      x.inputs.shellSemantics = null;
    },
    (x) => {
      x.inputs.repositoryFiles = [];
    },
    (x) => {
      x.inputs.packageScripts['test:example'] += ' && npm run validate';
    },
  ];
  for (const mutate of variants) {
    const x = fixture();
    mutate(x);
    const { plan, selection } = prepareCompactFocusedExecution(x);
    assert.equal(plan.commands.length, 2);
    assert.deepEqual(plan.commands, selection.selected.commands);
    assert.equal(plan.shardCount, 2);
  }
  // The existing package command (including any lifecycle hook) remains; this
  // unit does not alter the old exact-test deduplication rule for hook execution.
  const hooks = fixture();
  hooks.inputs.packageScripts['pretest:example'] = 'node setup.mjs';
  const withHooks = prepareCompactFocusedExecution(hooks);
  assert.equal(withHooks.plan.commands[0].id, 'package');
});

test('unknown runtime paths keep the original fallback command', () => {
  const x = fixture();
  x.paths = ['unknown/consumer.mjs'];
  x.identity.changedPathsSha256 = sha(JSON.stringify(x.paths));
  const { plan } = prepareCompactFocusedExecution(x);
  assert.deepEqual(plan.commands, manifest.fallbackCommands);
  assert.equal(plan.shardCount, 1);
});

test('source-confirmed deleted tests omit only automatic commands and bind the omission', () => {
  const x = fixture();
  x.paths = ['scripts/removed.test.mjs', 'game/test/removed.test.mjs', 'game/test/new.test.mjs'];
  x.identity.changedPathsSha256 = sha(JSON.stringify(x.paths));
  const before = prepareCompactFocusedExecution(x);
  x.deletedTests = x.paths.slice(0, 2);
  const { plan, selection } = prepareCompactFocusedExecution(x);
  assert.deepEqual(selection.selected.deletedTests, x.deletedTests.slice().sort());
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['package', 'fallback', 'changed-test:game/test/new.test.mjs'],
  );
  assert.notEqual(plan.identity.selectionSha256, before.plan.identity.selectionSha256);
  assert.ok(selection.selected.commands.some(({ id }) => id === 'direct'));
  x.deletedTests.push('game/not-admitted.test.mjs');
  assert.throws(() => prepareCompactFocusedExecution(x), /admitted changed test/);
});

test('a deleted file cannot waive a category-declared test command', () => {
  const x = fixture();
  x.paths = ['game/test/example.test.mjs'];
  x.identity.changedPathsSha256 = sha(JSON.stringify(x.paths));
  x.deletedTests = [...x.paths];
  x.inputs.repositoryFiles = [];
  const { plan } = prepareCompactFocusedExecution(x);
  assert.deepEqual(
    plan.commands.map(({ id }) => id),
    ['package', 'direct'],
  );
});

test('a selector-proven docs-only case records typed no-work without test receipts', () => {
  const x = fixture();
  x.paths = ['docs/example.md'];
  x.identity.changedPathsSha256 = sha(JSON.stringify(x.paths));
  const { plan, selection } = prepareCompactFocusedExecution(x);
  assert.equal(selection.selected.commands.length, 0);
  assert.equal(plan.shardCount, 0);
  assert.equal(plan.noWorkReason, 'no-selected-commands');
});

test('only the existing valid explicit policy can produce the waiver no-work reason', () => {
  const x = fixture();
  x.testPolicyBytes = JSON.stringify({
    ...policy,
    authorization: 'explicit-user-request-20260922',
    mode: 'waived',
  });
  x.identity.testPolicySha256 = sha(x.testPolicyBytes);
  const waived = prepareCompactFocusedExecution(x);
  assert.equal(waived.selection.waivedTests.length, 2);
  assert.equal(waived.plan.noWorkReason, 'explicit-policy-waiver');
  assert.equal(waived.plan.shardCount, 0);
  x.testPolicyBytes = JSON.stringify({ ...policy, authorization: 'invented', mode: 'waived' });
  x.identity.testPolicySha256 = sha(x.testPolicyBytes);
  assert.throws(() => prepareCompactFocusedExecution(x), /policy/i);
});

test('changed trusted source bytes or path inventory cannot reuse the expected hashes', () => {
  for (const mutate of [
    (x) => {
      x.manifestBytes += ' ';
    },
    (x) => {
      x.testPolicyBytes += ' ';
    },
    (x) => {
      x.paths.push('game/extra.mjs');
    },
  ]) {
    const x = fixture();
    mutate(x);
    assert.throws(() => prepareCompactFocusedExecution(x), /identity|digest/i);
  }
});

test('plan digest binds package/files/shell selection inputs as well as final commands', () => {
  const x = fixture(),
    original = prepareCompactFocusedExecution(x);
  x.inputs.packageScripts['unrelated'] = 'node another.mjs';
  const changed = prepareCompactFocusedExecution(x);
  assert.deepEqual(changed.plan.commands, original.plan.commands);
  assert.notEqual(changed.plan.identity.selectionSha256, original.plan.identity.selectionSha256);
  assert.notEqual(changed.plan.sha256, original.plan.sha256);
});

test('legacy v1 partitioning still requires four shards and retains its old behavior', () => {
  const one = manifest.fallbackCommands;
  assert.deepEqual(
    [1, 2, 3, 4].map((index) => focusedCommandShard(one, { index, total: 4 }).commands.length),
    [1, 0, 0, 0],
  );
  assert.throws(() => focusedCommandShard(one, { index: 1, total: 1 }));
});

test('filesystem directory enumeration order does not change the final plan digest', () => {
  const x = fixture();
  x.inputs.repositoryFiles.push('game/test/z.test.mjs');
  const before = prepareCompactFocusedExecution(x);
  x.inputs.repositoryFiles.reverse();
  assert.equal(prepareCompactFocusedExecution(x).plan.sha256, before.plan.sha256);
});
