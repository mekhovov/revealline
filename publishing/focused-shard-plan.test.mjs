import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactFocusedPlan,
  verifyCompactFocusedCoverage as verifyCoverage,
} from './focused-shard-plan.mjs';

// Fixtures create the trusted preflight plan in-process. Production must take
// this separate expected digest from the authenticated preflight job output.
const verifyCompactFocusedCoverage = (receipts, plan, expected, trustedDigest = plan.sha256) =>
  verifyCoverage(receipts, plan, expected, trustedDigest);

const identity = Object.freeze({
  repository: 'mekhovov/revealline',
  pullRequest: 1631,
  sourceContext: 'exact-head',
  sourceRevision: 'a'.repeat(40),
  sourceTree: 'b'.repeat(40),
  baseSha: 'c'.repeat(40),
  baseRef: 'main',
  workflowRevision: 'd'.repeat(40),
  policyDigest: '1'.repeat(64),
  testPolicySha256: '2'.repeat(64),
  manifestSha256: '3'.repeat(64),
  changedPathsSha256: '4'.repeat(64),
  selectionSha256: '5'.repeat(64),
  setupSha256: '6'.repeat(64),
  nodeVersion: 'v20.19.5',
  platform: 'linux',
  architecture: 'x64',
  runId: '39166448046',
  runAttempt: 1,
  fallbackHandled: false,
});

const commands = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: `command-${index}`,
    command: index % 2 ? 'npm' : 'node',
    args: index % 2 ? ['run', `suite:${index}`] : ['--test', `test/${index}.test.mjs`],
    timeoutMs: 600000 + index,
  }));

function receiptsFor(plan) {
  return plan.assignments.map(({ index, indices }) => ({
    format: 'revealline-focused-shard.v2',
    state: 'complete',
    planSha256: plan.sha256,
    identity: structuredClone(plan.identity),
    shard: { index, total: plan.shardCount },
    indices: [...indices],
    executedIds: indices.map((i) => plan.commands[i].id),
    result: { attempted: indices.length, failures: [], exitCode: 0 },
  }));
}

for (const count of [1, 2, 3, 4, 5, 9, 17]) {
  test(`${count} commands use only nonempty runners with an unchanged exact union`, () => {
    const input = commands(count);
    const before = JSON.stringify(input);
    const plan = compactFocusedPlan(input, identity);
    assert.equal(plan.shardCount, Math.min(4, count));
    assert.deepEqual(plan.matrix, {
      shard: Array.from({ length: plan.shardCount }, (_, i) => i + 1),
    });
    assert.equal(JSON.stringify(plan.commands), before);
    assert.equal(JSON.stringify(input), before);
    assert.ok(plan.assignments.every((x) => x.indices.length > 0));
    assert.deepEqual(
      plan.assignments.flatMap((x) => x.indices).sort((a, b) => a - b),
      Array.from({ length: count }, (_, i) => i),
    );
    assert.deepEqual(compactFocusedPlan(input, identity), plan);
    assert.equal(
      verifyCompactFocusedCoverage(receiptsFor(plan), plan, identity).executedCommands,
      count,
    );
  });
}

test('zero commands require a typed no-work reason and no executed-test verdict', () => {
  assert.throws(() => compactFocusedPlan([], identity), /no-work/i);
  for (const reason of ['no-selected-commands', 'explicit-policy-waiver']) {
    const plan = compactFocusedPlan([], identity, { noWorkReason: reason });
    assert.equal(plan.shardCount, 0);
    assert.deepEqual(plan.matrix, { shard: [] });
    assert.deepEqual(plan.assignments, []);
    const proof = verifyCompactFocusedCoverage([], plan, identity);
    assert.equal(proof.status, 'not-applicable');
    assert.equal(proof.executedCommands, 0);
    assert.equal(proof.noWorkReason, reason);
    assert.throws(() => verifyCompactFocusedCoverage([{}], plan, identity), /receipt/i);
  }
  assert.throws(
    () => compactFocusedPlan([], identity, { noWorkReason: 'unknown-path' }),
    /no-work/i,
  );
  assert.throws(
    () => compactFocusedPlan(commands(1), identity, { noWorkReason: 'no-selected-commands' }),
    /no-work/i,
  );
});

test('caller mutation cannot change the planned source, commands or assignments', () => {
  const source = structuredClone(identity),
    input = commands(2);
  const plan = compactFocusedPlan(input, source);
  input[0].args[0] = '--changed';
  source.runAttempt = 2;
  assert.equal(plan.commands[0].args[0], '--test');
  assert.equal(plan.identity.runAttempt, 1);
  assert.throws(() => plan.assignments[0].indices.push(999), TypeError);
  assert.throws(() => {
    plan.commands[0].timeoutMs = 1;
  }, TypeError);
});

test('canonical identity field order does not change the plan digest', () => {
  const reordered = Object.fromEntries(Object.entries(identity).reverse());
  assert.equal(
    compactFocusedPlan(commands(3), reordered).sha256,
    compactFocusedPlan(commands(3), identity).sha256,
  );
});

test('original valid command arguments and optional deadlines are preserved', () => {
  const input = [{ id: 'one', command: 'node', args: ['--test', 'test/a.test.mjs'] }];
  assert.deepEqual(compactFocusedPlan(input, identity).commands, input);
});

test('command lists reject duplicate IDs, unsafe shape and bounded oversize', () => {
  for (const mutate of [
    (rows) => {
      rows[1].id = rows[0].id;
    },
    (rows) => {
      rows[0].id = '';
    },
    (rows) => {
      rows[0].command = 'sh';
    },
    (rows) => {
      rows[0].args = '--test';
    },
    (rows) => {
      rows[0].args.push('a\0b');
    },
    (rows) => {
      rows[0].timeoutMs = 0;
    },
    (rows) => {
      rows[0].unreviewed = true;
    },
  ]) {
    const rows = commands(2);
    mutate(rows);
    assert.throws(() => compactFocusedPlan(rows, identity));
  }
  assert.throws(() => compactFocusedPlan(commands(4097), identity), /bound/i);
  const huge = commands(1);
  huge[0].args.push('x'.repeat(8 * 1024 * 1024));
  assert.throws(() => compactFocusedPlan(huge, identity), /bound/i);
});

test('source and execution identities are mandatory, bounded and context-specific', () => {
  for (const key of Object.keys(identity)) {
    const input = structuredClone(identity);
    delete input[key];
    assert.throws(() => compactFocusedPlan(commands(1), input), key);
  }
  for (const patch of [
    { sourceRevision: 'main' },
    { sourceTree: 'a'.repeat(39) },
    { policyDigest: 'unknown' },
    { runId: '01' },
    { runAttempt: 0 },
    { pullRequest: -1 },
    { repository: '../foreign' },
    { baseRef: 'bad\nref' },
    { sourceContext: 'synthetic-merge' },
    { platform: 'darwin' },
    { nodeVersion: '20.x' },
    { fallbackHandled: 'false' },
    { extra: true },
  ])
    assert.throws(() => compactFocusedPlan(commands(1), { ...identity, ...patch }));
});

test('trusted expected identity cannot be replaced by unanimous worker claims', () => {
  const foreign = { ...identity, sourceRevision: 'f'.repeat(40) };
  const foreignPlan = compactFocusedPlan(commands(2), foreign);
  assert.throws(
    () => verifyCompactFocusedCoverage(receiptsFor(foreignPlan), foreignPlan, identity),
    /identity/i,
  );
});

test('a self-consistent reduced plan cannot replace the trusted preflight plan', () => {
  const original = compactFocusedPlan(commands(5), identity);
  const reduced = compactFocusedPlan(commands(4), identity);
  assert.throws(
    () => verifyCompactFocusedCoverage(receiptsFor(reduced), original, identity),
    /plan/i,
  );
});

test('changing both packet and receipts cannot replace the preflight job output digest', () => {
  const original = compactFocusedPlan(commands(5), identity);
  const reduced = compactFocusedPlan(commands(4), identity);
  assert.throws(
    () => verifyCoverage(receiptsFor(reduced), reduced, identity, original.sha256),
    /plan/i,
  );
  assert.throws(() => verifyCoverage(receiptsFor(original), original, identity), /plan/i);
});

test('noncanonical, changed or forged trusted plan data fails closed', () => {
  const plan = compactFocusedPlan(commands(5), identity);
  for (const mutate of [
    (p) => {
      p.commands.pop();
    },
    (p) => {
      p.commands[0].timeoutMs = 1;
    },
    (p) => {
      p.assignments[0].indices = [];
    },
    (p) => {
      p.matrix.shard = [1];
    },
    (p) => {
      p.shardCount = 1;
    },
    (p) => {
      p.sha256 = '0'.repeat(64);
    },
    (p) => {
      p.format = 'revealline-focused-plan.v1';
    },
    (p) => {
      p.extra = true;
    },
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(
      () => verifyCompactFocusedCoverage(receiptsFor(plan), changed, identity),
      /plan/i,
    );
  }
});

test('missing, extra and duplicated shard receipts are rejected', () => {
  const plan = compactFocusedPlan(commands(9), identity),
    rows = receiptsFor(plan);
  assert.throws(() => verifyCompactFocusedCoverage(rows.slice(1), plan, identity), /receipt/i);
  assert.throws(() => verifyCompactFocusedCoverage([...rows, rows[0]], plan, identity), /receipt/i);
  assert.throws(
    () => verifyCompactFocusedCoverage([rows[0], rows[0], rows[2], rows[3]], plan, identity),
    /duplicate/i,
  );
});

const receiptMutations = [
  [
    'old format',
    (r) => {
      r.format = 'revealline-focused-shard.v1';
    },
  ],
  [
    'planned only',
    (r) => {
      r.state = 'planned';
    },
  ],
  [
    'cancelled',
    (r) => {
      r.state = 'cancelled';
    },
  ],
  [
    'wrong plan',
    (r) => {
      r.planSha256 = '0'.repeat(64);
    },
  ],
  [
    'wrong attempt',
    (r) => {
      r.identity.runAttempt++;
    },
  ],
  [
    'wrong run',
    (r) => {
      r.identity.runId = '999';
    },
  ],
  [
    'wrong tree',
    (r) => {
      r.identity.sourceTree = 'f'.repeat(40);
    },
  ],
  [
    'wrong setup',
    (r) => {
      r.identity.setupSha256 = 'f'.repeat(64);
    },
  ],
  [
    'different runtime',
    (r) => {
      r.identity.nodeVersion = 'v22.22.2';
    },
  ],
  [
    'wrong total',
    (r) => {
      r.shard.total = 3;
    },
  ],
  [
    'out of range',
    (r) => {
      r.shard.index = 0;
    },
  ],
  [
    'empty worker',
    (r) => {
      r.indices = [];
      r.executedIds = [];
      r.result.attempted = 0;
    },
  ],
  [
    'reassigned',
    (r) => {
      r.indices.reverse();
    },
  ],
  [
    'extra command',
    (r) => {
      r.indices.push(999);
    },
  ],
  [
    'missing execution',
    (r) => {
      r.executedIds.pop();
    },
  ],
  [
    'duplicate execution',
    (r) => {
      r.executedIds[1] = r.executedIds[0];
    },
  ],
  [
    'wrong executed ID',
    (r) => {
      r.executedIds[0] = 'foreign';
    },
  ],
  [
    'missing attempted',
    (r) => {
      delete r.result.attempted;
    },
  ],
  [
    'incomplete attempted',
    (r) => {
      r.result.attempted--;
    },
  ],
  [
    'failed exit',
    (r) => {
      r.result.exitCode = 1;
    },
  ],
  [
    'failed outcome',
    (r) => {
      r.result.failures.push({ id: 'command-0', status: 1 });
    },
  ],
  [
    'missing failures',
    (r) => {
      delete r.result.failures;
    },
  ],
  [
    'skipped outcome',
    (r) => {
      r.result.skipped = true;
    },
  ],
  [
    'foreign fields',
    (r) => {
      r.foreign = true;
    },
  ],
];

for (const [label, mutate] of receiptMutations) {
  test(`coverage rejects ${label}`, () => {
    const plan = compactFocusedPlan(commands(9), identity),
      rows = receiptsFor(plan);
    mutate(rows[0]);
    assert.throws(() => verifyCompactFocusedCoverage(rows, plan, identity));
  });
}

test('receipt arrival order does not alter complete coverage', () => {
  const plan = compactFocusedPlan(commands(9), identity);
  assert.deepEqual(
    verifyCompactFocusedCoverage(receiptsFor(plan).reverse(), plan, identity),
    verifyCompactFocusedCoverage(receiptsFor(plan), plan, identity),
  );
});
