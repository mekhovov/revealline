import { createHash } from 'node:crypto';

// Pure contract only. The trusted caller must first perform the existing
// selection, explicit-policy decision and exact package-coverage deduplication.
// These helpers neither select/waive tests nor establish artifact provenance.
const MAX_COMMANDS = 4096;
const MAX_BYTES = 8 * 1024 * 1024;
const IDENTITY_FIELDS = [
  'repository',
  'pullRequest',
  'sourceContext',
  'sourceRevision',
  'sourceTree',
  'baseSha',
  'baseRef',
  'workflowRevision',
  'policyDigest',
  'testPolicySha256',
  'manifestSha256',
  'changedPathsSha256',
  'selectionSha256',
  'setupSha256',
  'nodeVersion',
  'platform',
  'architecture',
  'runId',
  'runAttempt',
  'fallbackHandled',
];

function exactFields(value, fields, label) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).sort().join('\0') !== [...fields].sort().join('\0')
  ) {
    throw new Error(`Invalid ${label} fields.`);
  }
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

function bounded(value, label) {
  const bytes = canonical(value);
  if (Buffer.byteLength(bytes) > MAX_BYTES) throw new Error(`${label} exceeds its byte bound.`);
  return bytes;
}

const hash = (value) => createHash('sha256').update(bounded(value, 'Focused plan')).digest('hex');
const hex = (value, length) =>
  typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`, 'u').test(value);
const positiveInteger = (value) => Number.isSafeInteger(value) && value > 0;

function assertIdentity(identity) {
  exactFields(identity, IDENTITY_FIELDS, 'focused identity');
  if (
    typeof identity.repository !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(identity.repository) ||
    identity.repository.length > 256 ||
    !positiveInteger(identity.pullRequest) ||
    identity.sourceContext !== 'exact-head' ||
    !['sourceRevision', 'sourceTree', 'baseSha', 'workflowRevision'].every((key) =>
      hex(identity[key], 40),
    ) ||
    ![
      'policyDigest',
      'testPolicySha256',
      'manifestSha256',
      'changedPathsSha256',
      'selectionSha256',
      'setupSha256',
    ].every((key) => hex(identity[key], 64)) ||
    typeof identity.baseRef !== 'string' ||
    !identity.baseRef.length ||
    identity.baseRef.length > 1024 ||
    /[\u0000-\u0020\u007f]/u.test(identity.baseRef) ||
    typeof identity.nodeVersion !== 'string' ||
    !/^v20\.19\.[0-9]+$/u.test(identity.nodeVersion) ||
    identity.platform !== 'linux' ||
    identity.architecture !== 'x64' ||
    typeof identity.runId !== 'string' ||
    !/^[1-9][0-9]{0,19}$/u.test(identity.runId) ||
    !positiveInteger(identity.runAttempt) ||
    typeof identity.fallbackHandled !== 'boolean'
  ) {
    throw new Error('Invalid focused source or execution identity.');
  }
}

function assertCommands(commands) {
  if (!Array.isArray(commands) || commands.length > MAX_COMMANDS)
    throw new Error('Focused commands exceed their count bound.');
  const ids = new Set();
  for (const command of commands) {
    exactFields(
      command,
      [
        'id',
        'command',
        'args',
        ...(Object.hasOwn(command ?? {}, 'timeoutMs') ? ['timeoutMs'] : []),
      ],
      'focused command',
    );
    if (
      typeof command.id !== 'string' ||
      !command.id.length ||
      command.id.length > 4096 ||
      /[\u0000-\u001f\u007f]/u.test(command.id) ||
      ids.has(command.id) ||
      !['node', 'npm'].includes(command.command) ||
      !Array.isArray(command.args) ||
      command.args.length > 4096 ||
      command.args.some(
        (arg) => typeof arg !== 'string' || arg.includes('\0') || Buffer.byteLength(arg) > 65536,
      ) ||
      (Object.hasOwn(command, 'timeoutMs') &&
        (!positiveInteger(command.timeoutMs) || command.timeoutMs > 0x7fffffff))
    ) {
      throw new Error('Invalid, duplicate or out-of-bound focused command.');
    }
    ids.add(command.id);
  }
  bounded(commands, 'Focused commands');
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function compactFocusedPlan(commands, identity, { noWorkReason = null } = {}) {
  assertIdentity(identity);
  assertCommands(commands);
  if (
    commands.length
      ? noWorkReason !== null
      : !['no-selected-commands', 'explicit-policy-waiver'].includes(noWorkReason)
  ) {
    throw new Error(
      'A zero-command plan requires a typed no-work reason; executable plans cannot have one.',
    );
  }
  const shardCount = Math.min(4, commands.length);
  const shards = Array.from({ length: shardCount }, (_, i) => i + 1);
  const body = {
    format: 'revealline-focused-plan.v2',
    identity: structuredClone(identity),
    commands: structuredClone(commands),
    shardCount,
    matrix: { shard: shards },
    assignments: shards.map((index) => ({
      index,
      indices: commands.flatMap((_, offset) => (offset % shardCount === index - 1 ? [offset] : [])),
    })),
    noWorkReason,
  };
  return freeze({ ...body, sha256: hash(body) });
}

function assertTrustedPlan(plan, expectedIdentity) {
  assertIdentity(expectedIdentity);
  exactFields(
    plan,
    [
      'format',
      'identity',
      'commands',
      'shardCount',
      'matrix',
      'assignments',
      'noWorkReason',
      'sha256',
    ],
    'focused plan',
  );
  if (canonical(plan.identity) !== canonical(expectedIdentity))
    throw new Error('Trusted focused plan identity mismatch.');
  const recomputed = compactFocusedPlan(plan.commands, expectedIdentity, {
    noWorkReason: plan.noWorkReason,
  });
  if (bounded(plan, 'Focused plan') !== canonical(recomputed))
    throw new Error('Trusted focused plan is changed, noncanonical or has an invalid digest.');
}

// The expected digest must come from the trusted preflight job output, separately
// from the downloaded packet. Worker agreement or a self-hashed packet cannot
// replace that binding. This function does not authenticate artifact provenance.
export function verifyCompactFocusedPlan(plan, expectedIdentity, expectedPlanSha256) {
  if (!hex(expectedPlanSha256, 64) || plan?.sha256 !== expectedPlanSha256)
    throw new Error('Focused plan does not match the trusted preflight output.');
  assertTrustedPlan(plan, expectedIdentity);
  return plan;
}

export function verifyCompactFocusedCoverage(receipts, plan, expectedIdentity, expectedPlanSha256) {
  verifyCompactFocusedPlan(plan, expectedIdentity, expectedPlanSha256);
  if (!Array.isArray(receipts) || receipts.length !== plan.shardCount)
    throw new Error('Exactly the planned focused shard receipts are required.');
  const seen = new Set(),
    covered = new Set();
  for (const receipt of receipts) {
    exactFields(
      receipt,
      ['format', 'state', 'planSha256', 'identity', 'shard', 'indices', 'executedIds', 'result'],
      'focused receipt',
    );
    bounded(receipt, 'Focused receipt');
    if (receipt.format !== 'revealline-focused-shard.v2' || receipt.state !== 'complete')
      throw new Error('Focused receipt is not a complete v2 execution.');
    if (receipt.planSha256 !== plan.sha256) throw new Error('Focused receipt plan mismatch.');
    if (canonical(receipt.identity) !== canonical(expectedIdentity))
      throw new Error('Focused receipt execution identity mismatch.');
    exactFields(receipt.shard, ['index', 'total'], 'focused shard');
    const { index, total } = receipt.shard;
    if (!positiveInteger(index) || index > plan.shardCount || total !== plan.shardCount)
      throw new Error('Focused shard is outside the planned matrix.');
    if (seen.has(index)) throw new Error('Duplicate focused shard receipt.');
    seen.add(index);
    const expected = plan.assignments[index - 1].indices;
    if (!expected.length || canonical(receipt.indices) !== canonical(expected))
      throw new Error('Focused shard is empty or its assignment changed.');
    const executed = expected.map((offset) => plan.commands[offset].id);
    if (canonical(receipt.executedIds) !== canonical(executed))
      throw new Error('Focused shard executed IDs differ from its assigned commands.');
    exactFields(receipt.result, ['attempted', 'failures', 'exitCode'], 'focused result');
    if (
      receipt.result.attempted !== expected.length ||
      receipt.result.exitCode !== 0 ||
      !Array.isArray(receipt.result.failures) ||
      receipt.result.failures.length !== 0
    )
      throw new Error('Focused shard has failed, cancelled or missing command results.');
    for (const offset of expected) {
      if (covered.has(offset)) throw new Error('Duplicate focused command execution.');
      covered.add(offset);
    }
  }
  if (seen.size !== plan.shardCount || covered.size !== plan.commands.length)
    throw new Error('Focused command union is incomplete.');
  return {
    status: plan.shardCount ? 'executed-success' : 'not-applicable',
    shards: plan.shardCount,
    executedCommands: covered.size,
    planSha256: plan.sha256,
    sourceRevision: expectedIdentity.sourceRevision,
    noWorkReason: plan.noWorkReason,
  };
}
