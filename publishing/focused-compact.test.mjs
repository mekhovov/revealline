import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCompactFocusedPacket,
  executeCompactFocusedShard,
  verifyCompactFocusedPacket,
  verifyCompactFocusedAggregate,
} from './focused-compact.mjs';

const policy = JSON.stringify({
  format: 'revealline-release-test-policy.v1',
  authorization: 'explicit-user-request-20261004',
  mode: 'required',
  reason: 'required',
  restoration: 'required',
  scope: 'automated-test-suites',
});
function fixture(count = 1) {
  const inputs = { packageScripts: {}, repositoryFiles: [], shellSemantics: 'posix' };
  const context = {
    repository: 'mekhovov/revealline',
    pullRequest: 1,
    sourceRevision: 'a'.repeat(40),
    baseRef: 'main',
    workflowRevision: 'b'.repeat(40),
    runId: '123',
    runAttempt: 2,
    nodeVersion: 'v20.19.5',
    platform: 'linux',
    architecture: 'x64',
    npmVersion: '10.8.2',
  };
  const admission = {
    format: 'revealline-admission.v1',
    headSha: context.sourceRevision,
    baseSha: 'c'.repeat(40),
    workflowRevision: context.workflowRevision,
    policyDigest: 'd'.repeat(64),
    classification: 'maintenance',
    dependencies: [],
    paths: ['game/example.mjs'],
  };
  const commands = Array.from({ length: Math.max(count, 1) }, (_, i) => ({
    id: `command-${i}`,
    command: 'node',
    args: ['--check', `example${i}.mjs`],
    timeoutMs: 1234,
  }));
  const manifestBytes = JSON.stringify({
    format: 'revealline-focused-test-map.v1',
    categories: [{ id: 'example', pathPatterns: ['^game/'], commands }],
    ignoredPathPatterns: ['^docs/'],
    runtimePathPatterns: ['\\.mjs$'],
    fallbackCommands: [],
  });
  if (count === 0) admission.paths = ['docs/example.md'];
  const options = {
    admission,
    manifestBytes,
    testPolicyBytes: policy,
    root: '/fixture',
    context,
    policyDigest: admission.policyDigest,
  };
  let calls = 0;
  const dependencies = {
    acquire: async () => ({
      sourceRevision: context.sourceRevision,
      sourceTree: 'e'.repeat(40),
      setupFiles: [{ path: 'package.json', gitBlob: 'f'.repeat(40) }],
      inputs,
    }),
    loadInputs: async () => structuredClone(inputs),
    readShellSemantics: () => 'posix',
    execute: async (selected, settings) => {
      calls++;
      assert.equal(settings.concurrency, 2);
      assert.equal(settings.root, options.root);
      return { attempted: selected.length, failures: [], exitCode: 0 };
    },
  };
  return { options, dependencies, inputs, called: () => calls };
}

test('prepare, reconstruct, execute and aggregate retain the exact nonempty command union', async () => {
  for (const count of [1, 2, 3, 4, 9]) {
    const x = fixture(count),
      packet = await buildCompactFocusedPacket(x.options, x.dependencies),
      receipts = [];
    assert.equal(x.called(), 0);
    for (let index = 1; index <= packet.plan.shardCount; index++)
      receipts.push(
        await executeCompactFocusedShard(
          packet,
          packet.plan.sha256,
          index,
          x.options,
          x.dependencies,
        ),
      );
    const result = verifyCompactFocusedAggregate(
      receipts,
      packet,
      packet.plan.sha256,
      x.options,
      'success',
    );
    assert.equal(result.executedCommands, count);
    assert.equal(result.status, 'executed-success');
    assert.equal(x.called(), Math.min(count, 4));
    assert.ok(receipts.every((r) => r.indices.length && r.executedIds.length === r.indices.length));
  }
});

test('deleted changed tests are recorded and workers reject a different deletion inventory', async () => {
  const x = fixture();
  x.options.admission.paths = ['game/example.mjs', 'game/test/removed.test.mjs'];
  const deleted = x.options.admission.paths[1];
  const acquire = x.dependencies.acquire;
  x.dependencies.acquire = async () => ({ ...(await acquire()), deletedTests: [deleted] });
  const packet = await buildCompactFocusedPacket(x.options, x.dependencies);
  assert.deepEqual(packet.selection.selected.deletedTests, [deleted]);
  assert.equal(packet.plan.commands.length, 1);
  await executeCompactFocusedShard(packet, packet.plan.sha256, 1, x.options, x.dependencies);
  x.dependencies.acquire = acquire;
  await assert.rejects(
    executeCompactFocusedShard(packet, packet.plan.sha256, 1, x.options, x.dependencies),
    /reconstruct/,
  );
});

test('typed zero work requires skipped workers and never creates a test receipt', async () => {
  const x = fixture(0),
    packet = await buildCompactFocusedPacket(x.options, x.dependencies);
  const result = verifyCompactFocusedAggregate(
    [],
    packet,
    packet.plan.sha256,
    x.options,
    'skipped',
  );
  assert.equal(result.status, 'not-applicable');
  assert.equal(result.executedCommands, 0);
  await assert.rejects(
    executeCompactFocusedShard(packet, packet.plan.sha256, 1, x.options, x.dependencies),
    /shard|empty/i,
  );
  assert.equal(x.called(), 0);
  assert.throws(
    () => verifyCompactFocusedAggregate([], packet, packet.plan.sha256, x.options, 'success'),
    /worker|shard/i,
  );
});

test('worker refuses a changed source plan or filesystem discovery before any execution', async () => {
  const x = fixture(),
    packet = await buildCompactFocusedPacket(x.options, x.dependencies);
  await assert.rejects(
    executeCompactFocusedShard(packet, packet.plan.sha256, 1, x.options, {
      ...x.dependencies,
      acquire: async () => ({ ...(await x.dependencies.acquire()), sourceTree: '9'.repeat(40) }),
    }),
    /plan|identity|reconstruct/i,
  );
  await assert.rejects(
    executeCompactFocusedShard(packet, packet.plan.sha256, 1, x.options, {
      ...x.dependencies,
      loadInputs: async () => ({ ...x.inputs, repositoryFiles: ['unexpected.test.mjs'] }),
    }),
    /filesystem|inputs|reconstruct/i,
  );
  assert.equal(x.called(), 0);
});

test('failed commands and failed, skipped or cancelled required jobs cannot qualify', async () => {
  const x = fixture(),
    packet = await buildCompactFocusedPacket(x.options, x.dependencies);
  const receipt = await executeCompactFocusedShard(packet, packet.plan.sha256, 1, x.options, {
    ...x.dependencies,
    execute: async () => ({
      attempted: 1,
      failures: [{ id: 'command-0', status: 1 }],
      exitCode: 1,
    }),
  });
  assert.equal(receipt.result.exitCode, 1);
  assert.throws(
    () =>
      verifyCompactFocusedAggregate([receipt], packet, packet.plan.sha256, x.options, 'success'),
    /failed|command/i,
  );
  for (const state of ['failure', 'cancelled', 'skipped', '', null])
    assert.throws(
      () => verifyCompactFocusedAggregate([receipt], packet, packet.plan.sha256, x.options, state),
      /worker|shard/i,
    );
});

test('foreign context, trusted policy, digest and selection cannot replace preflight identity', async () => {
  const x = fixture(),
    packet = await buildCompactFocusedPacket(x.options, x.dependencies);
  for (const context of [
    { ...x.options.context, runAttempt: 3 },
    { ...x.options.context, baseRef: 'retargeted' },
    { ...x.options.context, nodeVersion: 'v20.19.6' },
    { ...x.options.context, repository: 'other/repository' },
  ]) {
    assert.throws(
      () => verifyCompactFocusedPacket(packet, packet.plan.sha256, { ...x.options, context }),
      /identity|setup|context|plan/i,
    );
  }
  assert.throws(() => verifyCompactFocusedPacket(packet, '0'.repeat(64), x.options), /plan/i);
  assert.throws(
    () =>
      verifyCompactFocusedPacket(packet, packet.plan.sha256, {
        ...x.options,
        policyDigest: '0'.repeat(64),
      }),
    /policy/i,
  );
  const altered = structuredClone(packet);
  altered.selection.inputsSha256 = '0'.repeat(64);
  assert.throws(
    () => verifyCompactFocusedPacket(altered, packet.plan.sha256, x.options),
    /selection|digest/i,
  );
});

test('malformed admission and context fail before source data or commands are touched', async () => {
  const x = fixture();
  let acquired = 0;
  for (const mutate of [
    (o) => {
      o.admission.paths.push(o.admission.paths[0]);
    },
    (o) => {
      o.admission.paths = ['../escape'];
    },
    (o) => {
      o.admission.headSha = 'f'.repeat(40);
    },
    (o) => {
      o.context.runAttempt = 0;
    },
    (o) => {
      o.admission.classification = 'hold';
    },
  ]) {
    const options = structuredClone(x.options);
    mutate(options);
    await assert.rejects(
      buildCompactFocusedPacket(options, {
        ...x.dependencies,
        acquire: async () => {
          acquired++;
          return x.dependencies.acquire();
        },
      }),
    );
  }
  assert.equal(acquired, 0);
  assert.equal(x.called(), 0);
});
