// Producer only: exact normal source build and independent archive/source/CSP
// verification. No candidate artifact or browser observation is admitted here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, statfs, writeFile } from 'node:fs/promises';
import { arch, release, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, ownedCommand } from './run-solo-remote-correctness.mjs';
import {
  publishBaseline,
  readBaselineBundle,
  requireCleanCommand,
} from './solo-remote-baseline.mjs';

const MiB = 1024 ** 2,
  GiB = 1024 ** 3;
const BASE = '8b01991942dc764b8aa4726851699ce1985e53ae';
const TREE = '9373b6a74aea8fa1ef47aa17ace140b4cf714609';
const WORKFLOW = '.github/workflows/solo-remote-baseline-temporary.yml';
const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '..');
export function validateNormalBaselineProducer(plan) {
  assert.equal(plan.format, 'SoloHostedNormalBaselineProducerPlanV2');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.deepEqual(plan.baseline, {
    revision: BASE,
    tree: TREE,
    publishVerifiedNormal: true,
    publisher: { workflow: WORKFLOW },
  });
  assert.deepEqual(plan.release, {
    scope: 'normal-baseline-producer-only',
    before: '1ccf8368a3dcd099e1608c8a9433e6f0c0518e8f',
    automaticRetries: 0,
    performanceQualification: 'not-provided',
  });
  assert.equal(plan.helperTimeoutMs, 3000000);
  assert.equal(plan.evidenceBytes, 32 * MiB);
  assert.equal(plan.finalizationReserveBytes, 4 * MiB);
  assert.equal(plan.initialDiskBytes, 8 * GiB);
  assert.equal(plan.diskFloorBytes, GiB + 4 * MiB);
  assert.equal(plan.minimumMemoryBytes, 12 * GiB);
  assert.equal(plan.commandRssBytes, 6 * GiB);
  assert.equal(plan.commandOutputBytes, 4 * MiB);
  assert.deepEqual(plan.commandTimeouts, { build: 1200000, inner: 600000, source: 480000 });
  assert.equal(plan.archiveBytes, 2 * GiB);
  assert.equal(plan.proofFileBytes, 2 * MiB);
  assert.equal(plan.candidate, undefined);
  assert.equal(plan.rows, undefined);
  assert.equal(plan.playwright, undefined);
  assert.deepEqual(
    plan.frozenTools.map((ref) => ref.path),
    [
      'scripts/produce-solo-normal-baseline.mjs',
      'scripts/run-solo-remote-correctness.mjs',
      'scripts/solo-remote-baseline.mjs',
      'scripts/solo-remote-archive.py',
      'scripts/verify-solo-build.mjs',
      'scripts/solo-build-worker-closure.mjs',
      'scripts/serve-production-preview.mjs',
      'scripts/game-cli.mjs',
    ],
  );
  for (const ref of plan.frozenTools) {
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < 2 * MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}
export function normalBaselineStages({
  nodeExecutable,
  sourcePath,
  buildPath,
  payloadPath,
  evidence,
  toolsPath,
}) {
  return [
    {
      name: 'build',
      timeoutMs: 1200000,
      cwd: sourcePath,
      argv: [
        nodeExecutable,
        join(sourcePath, 'scripts/game-cli.mjs'),
        'build',
        '--out',
        buildPath,
        '--revision',
        BASE,
      ],
    },
    {
      name: 'inner',
      timeoutMs: 600000,
      cwd: toolsPath,
      argv: [
        'python3',
        '-B',
        join(toolsPath, 'scripts/solo-remote-archive.py'),
        'inner',
        join(buildPath, 'distribution.zip'),
        payloadPath,
        BASE,
        join(evidence, 'baseline-archive.json'),
      ],
    },
    {
      name: 'source',
      timeoutMs: 480000,
      cwd: toolsPath,
      argv: [
        nodeExecutable,
        join(toolsPath, 'scripts/verify-solo-build.mjs'),
        payloadPath,
        join(evidence, 'baseline-source.json'),
        `--source=${sourcePath}`,
        `--base=${BASE}`,
        `--archive=${join(buildPath, 'distribution.zip')}`,
        `--archive-receipt=${join(evidence, 'baseline-archive.json')}`,
      ],
    },
  ];
}
export async function requireProducerSource(path, revision, tree) {
  assert.equal(await realpath(path), resolve(path));
  assert((await lstat(path)).isDirectory());
  const git = (...args) =>
    execFileSync('git', args, { cwd: path, encoding: 'utf8', timeout: 15000 }).trim();
  assert.equal(git('rev-parse', 'HEAD'), revision);
  const actualTree = git('rev-parse', 'HEAD^{tree}');
  if (tree) assert.equal(actualTree, tree);
  assert.equal(git('status', '--porcelain=v1', '--untracked-files=normal'), '');
  return { revision, tree: actualTree };
}
async function evidenceSize(root) {
  let count = 0,
    bytes = 0;
  async function walk(path) {
    for (const name of await readdir(path)) {
      const file = join(path, name),
        info = await lstat(file);
      assert(++count <= 2000 && !info.isSymbolicLink());
      if (info.isDirectory()) await walk(file);
      else {
        assert(info.isFile());
        bytes += info.size;
      }
    }
  }
  await walk(root);
  return bytes;
}
// Use the reserved metadata space after a resource stop. A high-water mark
// failure must never throw away the failed summary by repeating its assertion.
export async function finalizeNormalBaselineEvidence({
  evidence,
  report,
  plan,
  diskBytes,
  stopped = false,
}) {
  const before = await evidenceSize(evidence);
  const reserveFailure =
    before > plan.evidenceBytes - plan.finalizationReserveBytes || diskBytes < plan.diskFloorBytes;
  if (reserveFailure || stopped) {
    report.status = 'failed';
    report.finalizationFailure = {
      reserveFailure,
      stopped,
      evidenceBytesBefore: before,
      diskBytes,
    };
  }
  const inventory = [];
  let replaced = 0,
    previousSummaryBytes = 0;
  for (const name of await readdir(evidence)) {
    const path = join(evidence, name),
      info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    if (['summary.json', 'inventory.json'].includes(name)) {
      replaced += info.size;
      if (name === 'summary.json') previousSummaryBytes = info.size;
    } else inventory.push({ path: name, ...(await digest(path)) });
  }
  const encoded = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
  let summary = encoded(report),
    index = encoded(inventory);
  if (
    summary.length > 2 * MiB ||
    index.length > 2 * MiB ||
    before - replaced + summary.length + index.length > plan.evidenceBytes
  ) {
    report.status = 'failed';
    // The full command receipts and logs remain untouched. This explicitly
    // incomplete summary records the storage failure instead of claiming ready.
    summary = encoded({
      format: report.format,
      status: 'failed',
      complete: false,
      failure: 'Final metadata exceeds the declared evidence capacity',
      originalFailure: String(report.failure ?? '').slice(0, 2048),
      commandReceiptsRetained: true,
    });
    index = null;
    assert(
      before - previousSummaryBytes + summary.length <= plan.evidenceBytes,
      'No capacity for bounded failure summary',
    );
  }
  if (index) await writeFile(join(evidence, 'inventory.json'), index);
  await writeFile(join(evidence, 'summary.json'), summary);
  return report.status;
}
async function main() {
  assert.equal(process.platform, 'linux');
  assert.equal(arch(), 'x64');
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  const planPath = resolve(process.argv[2]),
    output = resolve(process.argv[3]);
  const plan = validateNormalBaselineProducer(JSON.parse(await readFile(planPath)));
  assert.equal(process.version, `v${plan.node}`);
  const temporary = resolve(process.env.RUNNER_TEMP);
  assert.equal(await realpath(temporary), temporary);
  assert(output.startsWith(temporary + '/'));
  await mkdir(output); // No overwrite or reuse of earlier output.
  const evidence = join(output, 'evidence'),
    work = join(output, 'work');
  await mkdir(evidence);
  await mkdir(work);
  const buildPath = join(work, 'baseline-build'),
    payloadPath = join(work, 'baseline-payload');
  const sourcePath = resolve(process.env.SOLO_BASELINE_SOURCE);
  const args = {
    nodeExecutable: process.execPath,
    sourcePath,
    buildPath,
    payloadPath,
    evidence,
    toolsPath: repository,
  };
  const report = {
    format: 'SoloHostedNormalBaselineProducerReportV2',
    status: 'failed',
    performanceQualification: 'not-provided',
    startedAt: new Date().toISOString(),
    baselineSetupStatus: 'not-run',
    commands: normalBaselineStages(args).map(({ name }) => ({ name, status: 'not-run' })),
  };
  const write = async (name, value) => {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
    assert(bytes.length <= 2 * MiB);
    await writeFile(join(evidence, name), bytes);
  };
  const started = Date.now(),
    stop = new AbortController();
  const onStop = () => stop.abort(new Error('Producer outer stop'));
  process.once('SIGTERM', onStop);
  process.once('SIGINT', onStop);
  const timer = setTimeout(
    () => stop.abort(new Error('Producer deadline')),
    plan.helperTimeoutMs,
  ).unref();
  const inspect = async () => {
    assert(
      !stop.signal.aborted && Date.now() - started < plan.helperTimeoutMs,
      'Producer deadline or stop',
    );
    const fs = await statfs(output);
    assert(fs.bavail * fs.bsize >= plan.diskFloorBytes, 'Producer disk reserve');
    assert(
      (await evidenceSize(evidence)) <= plan.evidenceBytes - plan.finalizationReserveBytes,
      'Producer evidence reserve',
    );
  };
  try {
    assert(totalmem() >= plan.minimumMemoryBytes);
    const fs = await statfs(output);
    assert(fs.bavail * fs.bsize >= plan.initialDiskBytes);
    report.tooling = await requireProducerSource(repository, process.env.SOLO_TOOLING_REVISION);
    report.baselineSource = await requireProducerSource(sourcePath, BASE, TREE);
    report.plan = { path: planPath, ...(await digest(planPath)) };
    report.runner = {
      node: process.version,
      platform: process.platform,
      arch: arch(),
      release: release(),
      runId: process.env.GITHUB_RUN_ID,
      attempt: process.env.GITHUB_RUN_ATTEMPT,
      workflowRef: process.env.GITHUB_WORKFLOW_REF,
      imageOS: process.env.ImageOS,
      imageVersion: process.env.ImageVersion,
    };
    assert(report.runner.workflowRef.startsWith(`${plan.repository}/${WORKFLOW}@`));
    for (const ref of plan.frozenTools) {
      const path = resolve(repository, ref.path),
        info = await lstat(path);
      assert(info.isFile() && !info.isSymbolicLink() && (await realpath(path)) === path);
      assert.deepEqual(await digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
    }
    await write('plan.json', plan);
    report.baselineSetupStatus = 'running';
    for (const [index, stage] of normalBaselineStages(args).entries()) {
      await inspect();
      const command = await ownedCommand(stage.argv, {
        cwd: stage.cwd,
        env: { ...process.env, GH_TOKEN: '' },
        log: join(evidence, `baseline-${stage.name}.log`),
        receipt: join(evidence, `baseline-${stage.name}.command.json`),
        timeoutMs: stage.timeoutMs,
        rssBytes: plan.commandRssBytes,
        outputBytes: plan.commandOutputBytes,
        inspect,
      });
      report.commands[index] = { name: stage.name, ...command };
      await write('summary.json', report);
      requireCleanCommand(command);
    }
    await requireProducerSource(sourcePath, BASE, TREE);
    await requireProducerSource(repository, report.tooling.revision, report.tooling.tree);
    report.baselineSetupStatus = 'passed';
    const publisher = {
      ...args,
      report,
      plan,
      archiveHelper: join(here, 'solo-remote-archive.py'),
      sourceVerifier: join(here, 'verify-solo-build.mjs'),
      inspect,
    };
    report.publication = await publishBaseline(publisher);
    const checked = await readBaselineBundle(buildPath, { sourceRevision: BASE, sourceTree: TREE });
    assert.deepEqual(checked.readyIdentity, {
      bytes: report.publication.ready.bytes,
      sha256: report.publication.ready.sha256,
    });
    report.packageReadback = {
      status: 'passed',
      ready: checked.readyIdentity,
      files: checked.files,
    };
    await inspect();
    report.status = 'ready';
  } catch (error) {
    report.failure = String(error.stack ?? error);
    if (report.baselineSetupStatus === 'running') report.baselineSetupStatus = 'failed';
  } finally {
    if (stop.signal.aborted || Date.now() - started >= plan.helperTimeoutMs) {
      report.status = 'failed';
      report.finalizationDeadlineFailure = true;
    }
    report.completedAt = new Date().toISOString();
    const fs = await statfs(output);
    await finalizeNormalBaselineEvidence({
      evidence,
      report,
      plan,
      diskBytes: fs.bavail * fs.bsize,
      stopped: stop.signal.aborted || Date.now() - started >= plan.helperTimeoutMs,
    });
    if (
      (stop.signal.aborted || Date.now() - started >= plan.helperTimeoutMs) &&
      report.status === 'ready'
    ) {
      report.status = 'failed';
      report.finalizationDeadlineFailure = true;
      await finalizeNormalBaselineEvidence({
        evidence,
        report,
        plan,
        diskBytes: fs.bavail * fs.bsize,
        stopped: true,
      });
    }
    clearTimeout(timer);
    process.removeListener('SIGTERM', onStop);
    process.removeListener('SIGINT', onStop);
    process.exitCode = report.status === 'ready' ? 0 : 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
