// Normal baseline publication/reuse metadata only. Build, extraction and source
// verification stay with the common runner and its existing owned commands.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = 'b11745223861c3973ad4bf440cc536198b8e0371';
const TREE = '09f68c3691a4ae1013c3073f0ccf301b3355903f';
const CURRENT_BASE = '8b01991942dc764b8aa4726851699ce1985e53ae';
const CURRENT_TREE = '9373b6a74aea8fa1ef47aa17ace140b4cf714609';
const CURRENT_WORKFLOW = '.github/workflows/solo-remote-baseline-temporary.yml';
const MiB = 1024 ** 2;
const PRODUCER_WORKFLOWS = {
  'SoloHostedCorrectnessPlan.v1': '.github/workflows/solo-remote-correctness-temporary.yml',
  'SoloHostedOfflinePairPlan.v1': '.github/workflows/solo-remote-offline-temporary.yml',
  SoloHostedNormalBaselineProducerPlanV2: CURRENT_WORKFLOW,
};
export const BASELINE_PROOF = 'normal-baseline-proof';
export const BASELINE_FILES = [
  'distribution.zip',
  'manifest.json',
  `${BASELINE_PROOF}/source-proof.json`,
  `${BASELINE_PROOF}/archive-proof.json`,
  `${BASELINE_PROOF}/command-receipts.json`,
  `${BASELINE_PROOF}/environment.json`,
  `${BASELINE_PROOF}/ready.json`,
  `${BASELINE_PROOF}/SHA256SUMS`,
];
const encoded = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const identity = (data) => ({
  bytes: data.length,
  sha256: createHash('sha256').update(data).digest('hex'),
});
async function exactFile(path, maximum) {
  const before = await lstat(path);
  assert(
    before.isFile() && !before.isSymbolicLink() && before.size <= maximum,
    'Regular bounded baseline file required',
  );
  assert.equal(await realpath(path), resolve(path), 'Baseline file alias');
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const data of createReadStream(path)) {
    bytes += data.length;
    assert(bytes <= maximum, 'Baseline file byte cap');
    hash.update(data);
  }
  const after = await lstat(path);
  for (const key of ['dev', 'ino', 'size', 'mtimeMs'])
    assert.equal(after[key], before[key], 'Baseline file changed');
  assert.equal(bytes, before.size);
  return { bytes, sha256: hash.digest('hex') };
}
async function smallJSON(path) {
  const digest = await exactFile(path, 2 * MiB);
  const bytes = await readFile(path);
  assert.deepEqual(identity(bytes), digest);
  return JSON.parse(bytes);
}
async function exclusive(path, bytes) {
  const file = await open(path, 'wx');
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  assert.deepEqual(await exactFile(path, bytes.length), identity(bytes));
}
export function requireCleanCommand(command) {
  assert.equal(command.status, 'closed');
  assert.equal(command.exitCode, 0);
  assert(
    command.completedAt &&
      !command.violation &&
      !command.forcedCleanup &&
      !command.cleanupUnconfirmed,
  );
  assert.deepEqual(command.survivors, []);
  assert.deepEqual(command.ambiguous, []);
}
export function validateBaselineReuse(reuse, plan) {
  const current = reuse.format === 'SoloHostedNormalBaselineReuseV2';
  assert(current || reuse.format === 'SoloHostedNormalBaselineReuseV1');
  const base = current ? CURRENT_BASE : BASE,
    tree = current ? CURRENT_TREE : TREE;
  if (current) {
    assert.equal(reuse.sourceRevision, base);
    assert.equal(reuse.sourceTree, tree);
  }
  assert.equal(reuse.producer.workflow === CURRENT_WORKFLOW, current);
  assert.equal(plan.baseline.revision, base);
  assert.equal(plan.baseline.tree, tree);
  assert.equal(plan.repository, reuse.producer.repository);
  assert.equal(reuse.producer.repository, 'mekhovov/revealline');
  assert(Object.values(PRODUCER_WORKFLOWS).includes(reuse.producer.workflow));
  assert.match(reuse.producer.toolingRevision, /^[a-f0-9]{40}$/);
  assert.match(reuse.producer.toolingTree, /^[a-f0-9]{40}$/);
  assert(Number.isSafeInteger(reuse.run) && reuse.run > 0);
  assert(Number.isSafeInteger(reuse.artifact) && reuse.artifact > 0);
  assert.equal(reuse.producer.run, reuse.run);
  assert(Number.isSafeInteger(reuse.producer.attempt) && reuse.producer.attempt > 0);
  assert.equal(
    reuse.name,
    `solo-normal-baseline-${base.slice(0, 8)}-${reuse.run}-${reuse.producer.attempt}`,
  );
  for (const [name, maximum] of [
    ['outer', 2 * 1024 ** 3],
    ['inner', 2 * 1024 ** 3],
    ['ready', 2 * MiB],
  ]) {
    assert(
      Number.isSafeInteger(reuse[name]?.bytes) &&
        reuse[name].bytes > 0 &&
        reuse[name].bytes <= maximum,
    );
    assert.match(reuse[name].sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(reuse.manifestSHA256, /^[a-f0-9]{64}$/);
}
export function validateBaselineReady(ready, documents, expected = {}) {
  const current = ready.format === 'SoloHostedNormalBaselineReadyV2';
  assert(current || ready.format === 'SoloHostedNormalBaselineReadyV1');
  const base = current ? CURRENT_BASE : BASE,
    tree = current ? CURRENT_TREE : TREE;
  if (current) {
    assert.equal(expected.sourceRevision, base, 'Explicit V2 source authority required');
    assert.equal(expected.sourceTree, tree, 'Explicit V2 tree authority required');
  } else {
    if (expected.sourceRevision) assert.equal(expected.sourceRevision, base);
    if (expected.sourceTree) assert.equal(expected.sourceTree, tree);
  }
  assert.equal(ready.producer.workflow === CURRENT_WORKFLOW, current);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.profile, 'normal');
  assert.equal(ready.sourceRevision, base);
  assert.equal(ready.sourceTree, tree);
  assert.equal(ready.node, 'v22.13.1');
  assert.equal(ready.platform, 'linux');
  assert.equal(ready.performanceQualification, 'not-provided');
  const { source, archive, commands, environment, manifest } = documents;
  assert.equal(source.status, 'passed');
  assert.deepEqual(source.failures, []);
  assert.equal(source.source.wholeTreeRevision, base);
  assert.equal(source.source.dirty, false);
  assert.equal(source.manifest.declaredSourceRevision, base);
  assert.equal(source.manifest.sha256, ready.files['manifest.json'].sha256);
  assert.equal(source.verifiedArtifactBytes, manifest.totalBytes);
  assert.equal(manifest.sourceRevision, base);
  assert.equal(archive.status, 'passed');
  assert.equal(archive.sourceRevision, base);
  assert.equal(archive.manifestSHA256, source.manifest.sha256);
  assert.deepEqual(ready.files['distribution.zip'], {
    bytes: archive.zipBytes,
    sha256: archive.zipSHA256,
  });
  assert.equal(environment.runner.node, ready.node);
  assert.equal(environment.runner.platform, ready.platform);
  assert(
    environment.runner.workflowRef.startsWith(
      `${ready.producer.repository}/${ready.producer.workflow}@`,
    ),
  );
  assert.equal(environment.source.revision, base);
  assert.equal(environment.source.tree, tree);
  assert.deepEqual(environment.producer, ready.producer);
  assert.equal(environment.tooling.revision, ready.producer.toolingRevision);
  assert.equal(environment.tooling.tree, ready.producer.toolingTree);
  assert.equal(Number(environment.runner.runId), ready.producer.run);
  assert.equal(Number(environment.runner.attempt), ready.producer.attempt);
  assert.equal(ready.producer.repository, 'mekhovov/revealline');
  assert(Object.values(PRODUCER_WORKFLOWS).includes(ready.producer.workflow));
  assert.match(ready.producer.toolingRevision, /^[a-f0-9]{40}$/);
  assert(Number.isSafeInteger(ready.producer.run) && ready.producer.run > 0);
  assert(Number.isSafeInteger(ready.producer.attempt) && ready.producer.attempt > 0);
  assert.deepEqual(Object.keys(commands), ['build', 'inner', 'source']);
  Object.values(commands).forEach(requireCleanCommand);
  const {
    sourcePath,
    buildPath,
    nodeExecutable,
    archiveHelper,
    sourceVerifier,
    payloadPath,
    evidencePath,
  } = environment.paths;
  assert.deepEqual(commands.build.argv, [
    nodeExecutable,
    join(sourcePath, 'scripts/game-cli.mjs'),
    'build',
    '--out',
    buildPath,
    '--revision',
    base,
  ]);
  assert.equal(commands.build.cwd, sourcePath);
  assert.equal(commands.build.timeoutMs, 1200000);
  assert.deepEqual(commands.inner.argv, [
    'python3',
    '-B',
    archiveHelper,
    'inner',
    join(buildPath, 'distribution.zip'),
    payloadPath,
    base,
    join(evidencePath, 'baseline-archive.json'),
  ]);
  assert.equal(commands.inner.timeoutMs, 600000);
  assert.deepEqual(commands.source.argv, [
    nodeExecutable,
    sourceVerifier,
    payloadPath,
    join(evidencePath, 'baseline-source.json'),
    `--source=${sourcePath}`,
    `--base=${base}`,
    `--archive=${join(buildPath, 'distribution.zip')}`,
    `--archive-receipt=${join(evidencePath, 'baseline-archive.json')}`,
  ]);
  assert.equal(commands.source.timeoutMs, 480000);
  if (expected.producer) assert.deepEqual(ready.producer, expected.producer);
  if (expected.inner) assert.deepEqual(ready.files['distribution.zip'], expected.inner);
  if (expected.manifestSHA256)
    assert.equal(ready.files['manifest.json'].sha256, expected.manifestSHA256);
}
export async function readBaselineBundle(root, expected = {}) {
  assert.equal(await realpath(root), resolve(root));
  const readyPath = join(root, BASELINE_PROOF, 'ready.json');
  if (expected.ready) assert.deepEqual(await exactFile(readyPath, 2 * MiB), expected.ready);
  const ready = await smallJSON(readyPath);
  const declared = BASELINE_FILES.filter(
    (name) => !name.endsWith('/ready.json') && !name.endsWith('/SHA256SUMS'),
  );
  assert.deepEqual(Object.keys(ready.files).sort(), [...declared].sort());
  const actual = {};
  for (const name of BASELINE_FILES.filter((name) => !name.endsWith('/SHA256SUMS')))
    actual[name] = await exactFile(
      join(root, name),
      name === 'distribution.zip' ? 2 * 1024 ** 3 : 2 * MiB,
    );
  for (const name of declared) assert.deepEqual(actual[name], ready.files[name]);
  const checksumPath = join(root, BASELINE_PROOF, 'SHA256SUMS');
  await exactFile(checksumPath, 16384);
  const checksums = (await readFile(checksumPath, 'utf8')).trim().split('\n');
  assert.deepEqual(
    checksums,
    Object.entries(actual).map(([name, value]) => `${value.sha256}  ${name}`),
  );
  const documents = {
    source: await smallJSON(join(root, BASELINE_PROOF, 'source-proof.json')),
    archive: await smallJSON(join(root, BASELINE_PROOF, 'archive-proof.json')),
    commands: await smallJSON(join(root, BASELINE_PROOF, 'command-receipts.json')),
    environment: await smallJSON(join(root, BASELINE_PROOF, 'environment.json')),
    manifest: await smallJSON(join(root, 'manifest.json')),
  };
  validateBaselineReady(ready, documents, expected);
  return { ready, files: actual, readyIdentity: actual[`${BASELINE_PROOF}/ready.json`] };
}
export async function publishBaseline({
  buildPath,
  payloadPath,
  evidence,
  report,
  plan,
  sourcePath,
  nodeExecutable,
  archiveHelper,
  sourceVerifier,
  inspect = async () => {},
}) {
  assert(PRODUCER_WORKFLOWS[plan.format], 'Unknown normal baseline producer mode');
  const current = plan.format === 'SoloHostedNormalBaselineProducerPlanV2';
  const base = current ? CURRENT_BASE : BASE,
    tree = current ? CURRENT_TREE : TREE;
  assert.equal(plan.baseline.revision, base);
  assert.equal(plan.baseline.tree, tree);
  assert.equal(plan.baseline.publisher.workflow, PRODUCER_WORKFLOWS[plan.format]);
  assert.equal(plan.baseline.publishVerifiedNormal, true);
  assert(!plan.baseline.reusableArtifact, 'A reused package cannot masquerade as a fresh producer');
  assert.equal(report.baselineSetupStatus, 'passed');
  const proofDir = join(buildPath, BASELINE_PROOF);
  await mkdir(proofDir); // fresh positive authority only
  const source = await smallJSON(join(evidence, 'baseline-source.json'));
  const archive = await smallJSON(join(evidence, 'baseline-archive.json'));
  const commands = {};
  for (const name of ['build', 'inner', 'source'])
    commands[name] = await smallJSON(join(evidence, `baseline-${name}.command.json`));
  const producer = {
    repository: plan.repository,
    workflow: plan.baseline.publisher.workflow,
    run: Number(report.runner.runId),
    attempt: Number(report.runner.attempt),
    toolingRevision: report.tooling.revision,
    toolingTree: report.tooling.tree,
  };
  const environment = {
    producer,
    runner: report.runner,
    source: report.baselineSource,
    tooling: report.tooling,
    plan: report.plan,
    paths: {
      sourcePath,
      buildPath,
      nodeExecutable,
      archiveHelper,
      sourceVerifier,
      payloadPath,
      evidencePath: evidence,
    },
    helperIdentities: {
      archive: await exactFile(archiveHelper, 2 * MiB),
      source: await exactFile(sourceVerifier, 2 * MiB),
    },
    scope:
      'Normal source build and independent member/source/CSP verification only; offline and performance results are separate.',
  };
  const values = {
    'source-proof.json': await readFile(join(evidence, 'baseline-source.json')),
    'archive-proof.json': await readFile(join(evidence, 'baseline-archive.json')),
    'command-receipts.json': encoded(commands),
    'environment.json': encoded(environment),
  };
  for (const [name, bytes] of Object.entries(values)) await exclusive(join(proofDir, name), bytes);
  const files = {};
  for (const name of BASELINE_FILES.filter(
    (name) => !name.endsWith('/ready.json') && !name.endsWith('/SHA256SUMS'),
  )) {
    await inspect();
    files[name] = await exactFile(
      join(buildPath, name),
      name === 'distribution.zip' ? 2 * 1024 ** 3 : 2 * MiB,
    );
  }
  const ready = {
    format: current ? 'SoloHostedNormalBaselineReadyV2' : 'SoloHostedNormalBaselineReadyV1',
    status: 'ready',
    completedAt: new Date().toISOString(),
    sourceRevision: base,
    sourceTree: tree,
    profile: 'normal',
    node: 'v22.13.1',
    platform: 'linux',
    performanceQualification: 'not-provided',
    producer,
    files,
  };
  const manifest = await smallJSON(join(buildPath, 'manifest.json'));
  validateBaselineReady(
    ready,
    { source, archive, commands, environment, manifest },
    { sourceRevision: base, sourceTree: tree },
  );
  const readyBytes = encoded(ready);
  const all = { ...files, [`${BASELINE_PROOF}/ready.json`]: identity(readyBytes) };
  await exclusive(
    join(proofDir, 'SHA256SUMS'),
    Buffer.from(
      Object.entries(all)
        .map(([name, value]) => `${value.sha256}  ${name}`)
        .join('\n') + '\n',
    ),
  );
  await inspect();
  // Positive marker is the last write. Any setup/proof failure leaves it absent.
  await exclusive(join(proofDir, 'ready.json'), readyBytes);
  return {
    status: 'ready',
    path: buildPath,
    ready: { path: join(proofDir, 'ready.json'), ...identity(readyBytes) },
    archive: files['distribution.zip'],
    manifest: files['manifest.json'],
    scope: 'Verified normal baseline only; independent of later offline diagnostic outcome',
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.equal(process.argv[2], 'admit-upload');
  const extra = process.argv.slice(4);
  assert(extra.length === 0 || extra.length === 2);
  const expected = extra.length ? { sourceRevision: extra[0], sourceTree: extra[1] } : {};
  const result = await readBaselineBundle(resolve(process.argv[3]), expected);
  process.stdout.write(
    JSON.stringify({
      status: 'ready',
      ready: result.readyIdentity,
      sourceRevision: result.ready.sourceRevision,
    }) + '\n',
  );
}
