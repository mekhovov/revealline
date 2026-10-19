import { createHash } from 'node:crypto';
import { acquireFocusedGitInputs } from './focused-git-inputs.mjs';
import {
  compactFocusedPlan,
  verifyCompactFocusedPlan,
  verifyCompactFocusedCoverage,
} from './focused-shard-plan.mjs';
import {
  focusedTestPlan,
  prepareCompactFocusedExecution,
  loadFocusedExecutionInputs,
  packageScriptShellSemantics,
  runFocusedCommandsParallel,
} from './focused-tests.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const hashJSON = (value) => hash(JSON.stringify(value));
const hex = (value, n) =>
  typeof value === 'string' && new RegExp(`^[a-f0-9]{${n}}$`, 'u').test(value);
const pathOK = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 4096 &&
  !/[\u0000-\u001f\u007f\\]/u.test(value) &&
  !value.startsWith('/') &&
  !value.split('/').some((p) => !p || p === '.' || p === '..');
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const normalizedInputs = (inputs) => ({
  packageScripts: inputs.packageScripts,
  repositoryFiles: [...inputs.repositoryFiles].sort(),
  shellSemantics: inputs.shellSemantics,
});
const INSTALL_COMMANDS = [
  ['npm', 'ci', '--prefer-offline'],
  [
    'npm',
    'ci',
    '--prefix',
    'authoring/fpv-worlds',
    '--ignore-scripts',
    '--include=dev',
    '--prefer-offline',
  ],
];

function knownIdentity({ admission, manifestBytes, testPolicyBytes, context, policyDigest }) {
  if (
    !exact(context, [
      'repository',
      'pullRequest',
      'sourceRevision',
      'baseRef',
      'workflowRevision',
      'runId',
      'runAttempt',
      'nodeVersion',
      'platform',
      'architecture',
      'npmVersion',
    ]) ||
    !/^\d+\.\d+\.\d+$/u.test(context.npmVersion)
  )
    throw new Error('Invalid focused execution context.');
  if (
    !exact(admission, [
      'format',
      'headSha',
      'baseSha',
      'workflowRevision',
      'policyDigest',
      'classification',
      'dependencies',
      'paths',
    ]) ||
    admission.format !== 'revealline-admission.v1' ||
    admission.headSha !== context.sourceRevision ||
    admission.workflowRevision !== context.workflowRevision ||
    !hex(policyDigest, 64) ||
    admission.policyDigest !== policyDigest ||
    !hex(admission.baseSha, 40) ||
    !['maintenance', 'scheduled', 'release', 'release-evidence'].includes(
      admission.classification,
    ) ||
    !Array.isArray(admission.dependencies) ||
    admission.dependencies.some((n) => !Number.isSafeInteger(n) || n < 1) ||
    new Set(admission.dependencies).size !== admission.dependencies.length ||
    !Array.isArray(admission.paths) ||
    !admission.paths.length ||
    admission.paths.length > 10000 ||
    admission.paths.some((p) => !pathOK(p)) ||
    JSON.stringify([...new Set(admission.paths)].sort()) !== JSON.stringify(admission.paths)
  )
    throw new Error('Invalid source-bound focused admission/policy.');
  for (const bytes of [manifestBytes, testPolicyBytes])
    if (
      !(typeof bytes === 'string' || Buffer.isBuffer(bytes)) ||
      Buffer.byteLength(bytes) > 8 * 1024 * 1024
    )
      throw new Error('Focused policy bytes are unavailable or oversized.');
  const identity = {
    repository: context.repository,
    pullRequest: context.pullRequest,
    sourceContext: 'exact-head',
    sourceRevision: context.sourceRevision,
    baseSha: admission.baseSha,
    baseRef: context.baseRef,
    workflowRevision: context.workflowRevision,
    policyDigest,
    manifestSha256: hash(manifestBytes),
    testPolicySha256: hash(testPolicyBytes),
    changedPathsSha256: hashJSON(admission.paths),
    nodeVersion: context.nodeVersion,
    platform: context.platform,
    architecture: context.architecture,
    runId: context.runId,
    runAttempt: context.runAttempt,
    fallbackHandled: ['release', 'release-evidence'].includes(admission.classification),
  };
  // Reuse the pure contract's complete context validator before any source read.
  compactFocusedPlan(
    [],
    {
      ...identity,
      sourceTree: '0'.repeat(40),
      setupSha256: '0'.repeat(64),
      selectionSha256: '0'.repeat(64),
    },
    { noWorkReason: 'no-selected-commands' },
  );
  return identity;
}

export async function buildCompactFocusedPacket(
  options,
  {
    acquire = acquireFocusedGitInputs,
    loadInputs = loadFocusedExecutionInputs,
    readShellSemantics = packageScriptShellSemantics,
  } = {},
) {
  const known = knownIdentity(options);
  const selected = focusedTestPlan(
    options.admission.paths,
    JSON.parse(options.manifestBytes.toString()),
    { fallbackHandled: known.fallbackHandled },
  );
  const source = await acquire(selected.commands, options.root, {
    expectedSource: known.sourceRevision,
    loadInputs,
    readShellSemantics,
  });
  if (source.sourceRevision !== known.sourceRevision || !hex(source.sourceTree, 40))
    throw new Error('Focused acquisition changed source identity.');
  const setup = {
    files: source.setupFiles,
    installCommands: structuredClone(INSTALL_COMMANDS),
    commandConcurrency: 2,
    maxShards: 4,
    jobTimeoutMinutes: 90,
    npmVersion: options.context.npmVersion,
  };
  const { plan, selection } = prepareCompactFocusedExecution({
    paths: options.admission.paths,
    manifestBytes: options.manifestBytes,
    testPolicyBytes: options.testPolicyBytes,
    inputs: source.inputs,
    identity: { ...known, sourceTree: source.sourceTree, setupSha256: hashJSON(setup) },
  });
  return { format: 'revealline-focused-packet.v2', plan, selection, setup };
}

// The separate expected digest is an authenticated preflight job output, not a
// claim read from this packet. Source tree/setup/selection are trusted through
// that binding; known admission/run/runtime context is checked independently.
export function verifyCompactFocusedPacket(packet, expectedPlanSha256, options) {
  const known = knownIdentity(options);
  if (
    !exact(packet, ['format', 'plan', 'selection', 'setup']) ||
    packet.format !== 'revealline-focused-packet.v2' ||
    Buffer.byteLength(JSON.stringify(packet)) > 16 * 1024 * 1024
  )
    throw new Error('Invalid focused packet.');
  const expected = { ...packet.plan?.identity, ...known };
  verifyCompactFocusedPlan(packet.plan, expected, expectedPlanSha256);
  if (hashJSON(packet.selection) !== packet.plan.identity.selectionSha256)
    throw new Error('Focused selection digest mismatch.');
  if (
    hashJSON(packet.setup) !== packet.plan.identity.setupSha256 ||
    packet.setup.npmVersion !== options.context.npmVersion ||
    JSON.stringify(packet.setup.installCommands) !== JSON.stringify(INSTALL_COMMANDS) ||
    packet.setup.commandConcurrency !== 2 ||
    packet.setup.maxShards !== 4 ||
    packet.setup.jobTimeoutMinutes !== 90
  )
    throw new Error('Focused setup identity mismatch.');
  return packet.plan;
}

export async function executeCompactFocusedShard(
  packet,
  expectedPlanSha256,
  index,
  options,
  {
    acquire = acquireFocusedGitInputs,
    loadInputs = loadFocusedExecutionInputs,
    readShellSemantics = packageScriptShellSemantics,
    execute = runFocusedCommandsParallel,
  } = {},
) {
  const plan = verifyCompactFocusedPacket(packet, expectedPlanSha256, options);
  if (!Number.isInteger(index) || index < 1 || index > plan.shardCount)
    throw new Error('Focused shard is empty or outside its matrix.');
  const reconstructed = await buildCompactFocusedPacket(options, {
    acquire,
    loadInputs,
    readShellSemantics,
  });
  if (reconstructed.plan.sha256 !== expectedPlanSha256)
    throw new Error('Focused worker could not reconstruct the preflight plan.');
  const actual = await loadInputs(reconstructed.selection.selected.commands, options.root, {
    shellSemantics: readShellSemantics(options.root),
  });
  if (hashJSON(normalizedInputs(actual)) !== packet.selection.inputsSha256)
    throw new Error('Focused filesystem inputs differ from the planned source.');
  const indices = plan.assignments[index - 1].indices;
  const commands = indices.map((i) => plan.commands[i]);
  const result = await execute(commands, { root: options.root, concurrency: 2 });
  if (
    !exact(result, ['attempted', 'failures', 'exitCode']) ||
    result.attempted !== commands.length ||
    !Array.isArray(result.failures) ||
    !Number.isInteger(result.exitCode)
  )
    throw new Error('Focused executor returned incomplete command outcomes.');
  return {
    format: 'revealline-focused-shard.v2',
    state: 'complete',
    planSha256: expectedPlanSha256,
    identity: plan.identity,
    shard: { index, total: plan.shardCount },
    indices,
    executedIds: commands.map((c) => c.id),
    result,
  };
}

export function verifyCompactFocusedAggregate(
  receipts,
  packet,
  expectedPlanSha256,
  options,
  workersResult,
) {
  const plan = verifyCompactFocusedPacket(packet, expectedPlanSha256, options);
  if (workersResult !== (plan.shardCount ? 'success' : 'skipped'))
    throw new Error('Focused worker job outcome does not satisfy the planned shard contract.');
  return verifyCompactFocusedCoverage(receipts, plan, plan.identity, expectedPlanSha256);
}
