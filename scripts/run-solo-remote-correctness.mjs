import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, readFileSync } from 'node:fs';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  statfs,
  writeFile,
} from 'node:fs/promises';
import { arch, cpus, release, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startProductionPreview } from './serve-production-preview.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';

const MiB = 1024 ** 2;
const GiB = 1024 ** 3;
const here = dirname(fileURLToPath(import.meta.url));
const repository = resolve(here, '..');
const hash = (data) => createHash('sha256').update(data).digest('hex');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const save = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
// Chromium creates its Unix socket beneath TMPDIR. Keep that owner path short,
// independently of descriptive report names; do not reuse a shared /tmp profile.
export function scratchRowPath(root, index) {
  assert(Number.isInteger(index) && index >= 0 && index < 100);
  const path = join(root, `r${String(index).padStart(2, '0')}`);
  assert(Buffer.byteLength(path) <= 52, 'Owned browser scratch path exceeds socket budget');
  return path;
}
export async function digest(path) {
  const h = createHash('sha256');
  let bytes = 0;
  for await (const data of createReadStream(path)) {
    h.update(data);
    bytes += data.length;
  }
  return { bytes, sha256: h.digest('hex') };
}
export function parseProcStat(text) {
  const end = text.lastIndexOf(')');
  assert(end > 0);
  const rest = text
    .slice(end + 2)
    .trim()
    .split(/\s+/);
  return {
    pid: Number(text.slice(0, text.indexOf(' '))),
    state: rest[0],
    ppid: Number(rest[1]),
    pgid: Number(rest[2]),
    birth: rest[19],
    rss: Number(rest[21]) * 4096,
  };
}
async function processes() {
  const result = new Map();
  for (const name of await readdir('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const row = parseProcStat(await readFile(`/proc/${name}/stat`, 'utf8'));
      row.argv = (await readFile(`/proc/${name}/cmdline`, 'utf8')).replaceAll('\0', ' ');
      result.set(row.pid, row);
    } catch (error) {
      if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) throw error;
    }
  }
  return result;
}
const live = (row) => row && !['Z', 'X'].includes(row.state);
const same = (a, b) => a && b && a.pid === b.pid && a.birth === b.birth;
const browserCommand = (row) => /(?:chrome|chromium|WebKit|MiniBrowser|crashpad)/i.test(row.argv);
export function spawnedLeaderIdentity(row, leaderPid, parentPid, before) {
  return Boolean(
    row &&
      row.pid === leaderPid &&
      row.ppid === parentPid &&
      row.pgid === leaderPid &&
      typeof row.birth === 'string' &&
      /^\d+$/.test(row.birth) &&
      !same(before.get(row.pid), row),
  );
}
export function isOwnedProcess(row, all, owned, leaderPid, tagged) {
  const parent = all.get(row.ppid);
  return Boolean(
    tagged ||
      (row.pgid === leaderPid && same(owned.get(leaderPid), all.get(leaderPid))) ||
      (parent && same(owned.get(parent.pid), parent)),
  );
}

// Linux-only, job-local ownership. No machine-wide browser kill and no PID-only
// signalling. A forced cleanup is a failed row even if every process then exits.
export async function ownedCommand(
  argv,
  {
    cwd,
    env,
    log,
    timeoutMs,
    rssBytes = 6 * GiB,
    outputBytes = 4 * MiB,
    inspect = async () => {},
    receipt = null,
  },
) {
  assert.equal(process.platform, 'linux');
  const before = await processes();
  const ownerToken = randomUUID();
  const stream = await open(log, 'wx');
  const child = spawn(argv[0], argv.slice(1), {
    cwd,
    env: { ...env, SOLO_REMOTE_OWNER: ownerToken },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Capture the direct child's birth before yielding to the event loop that
  // reaps it. Short --version commands can exit between a later process scan
  // and environ read. Parent + detached group bind this initial stat to spawn;
  // subsequent ownership and signalling still require the same recorded birth.
  const owned = new Map();
  let initialLeaderCapture = 'not-observed',
    initialLeaderFailure = null;
  try {
    const row = parseProcStat(readFileSync(`/proc/${child.pid}/stat`, 'utf8'));
    if (spawnedLeaderIdentity(row, child.pid, process.pid, before)) {
      row.argv = argv.join(' ');
      owned.set(row.pid, row);
      initialLeaderCapture = 'direct-child-birth';
    }
  } catch (error) {
    if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error.code))
      initialLeaderFailure = `leader-capture:${error.code ?? error.message}`;
  }
  const record = {
    argv,
    cwd,
    startedAt: new Date().toISOString(),
    timeoutMs,
    rssBytes,
    outputBytes,
    status: 'running',
    tracked: [],
    forcedCleanup: false,
    ambiguous: [],
    survivors: [],
    initialLeaderCapture,
  };
  let ended = false,
    drained = false,
    exitCode = null,
    signal = null,
    bytes = 0,
    violation = initialLeaderFailure;
  let writes = Promise.resolve();
  const consume = (data) => {
    bytes += data.length;
    if (bytes > outputBytes) violation ??= 'command-output-cap';
    else
      writes = writes
        .then(() => stream.write(data))
        .catch(() => {
          violation ??= 'log-write-failed';
        });
  };
  child.stdout.on('data', consume);
  child.stderr.on('data', consume);
  child.on('error', (error) => {
    violation ??= `spawn:${error.code}`;
    ended = true;
  });
  child.on('close', () => {
    drained = true;
  });
  child.on('exit', (code, sig) => {
    ended = true;
    exitCode = code;
    signal = sig;
  });
  const start = Date.now();
  const collect = async () => {
    const all = await processes();
    for (let pass = 0; pass < 8; pass++) {
      let added = false;
      for (const row of all.values()) {
        if (before.has(row.pid) && same(before.get(row.pid), row)) continue;
        let tagged = false;
        try {
          tagged = (await readFile(`/proc/${row.pid}/environ`, 'utf8'))
            .split('\0')
            .includes(`SOLO_REMOTE_OWNER=${ownerToken}`);
        } catch (error) {
          if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) throw error;
        }
        if (isOwnedProcess(row, all, owned, child.pid, tagged)) {
          if (!same(owned.get(row.pid), row)) {
            owned.set(row.pid, row);
            added = true;
          }
        }
      }
      if (!added) break;
    }
    const current = [...owned.values()]
      .map((row) => (same(row, all.get(row.pid)) ? all.get(row.pid) : null))
      .filter(live);
    record.peakRSS = Math.max(
      record.peakRSS ?? 0,
      current.reduce((sum, row) => sum + row.rss, 0),
    );
    record.ambiguous = [...all.values()].filter(
      (row) =>
        live(row) &&
        browserCommand(row) &&
        !same(before.get(row.pid), row) &&
        !same(owned.get(row.pid), row),
    );
    return current;
  };
  const signalOwned = async (sig) => {
    for (const row of (await collect()).reverse()) {
      const fresh = (await processes()).get(row.pid);
      if (same(row, fresh) && live(fresh)) {
        try {
          process.kill(row.pid, sig);
        } catch (error) {
          if (error.code !== 'ESRCH') throw error;
        }
      }
    }
  };
  try {
    while (!ended && !violation) {
      await collect();
      if (Date.now() - start >= timeoutMs) violation = 'deadline';
      if (record.peakRSS > rssBytes) violation = 'rss-cap';
      if (record.ambiguous.length) violation = 'unattributed-new-browser';
      try {
        await inspect();
      } catch (error) {
        violation ??= `inspection:${error.message}`;
      }
      if (!violation) await delay(250);
    }
    // Give ordinary exits a fixed drain opportunity; never an observation retry.
    for (let n = 0; n < 12 && (await collect()).length && !violation; n++) await delay(250);
  } catch (error) {
    violation ??= `owner-error:${error.message}`;
  } finally {
    try {
      if ((await collect()).length) {
        record.forcedCleanup = true;
        await signalOwned('SIGTERM');
        for (let n = 0; n < 40 && (await collect()).length; n++) await delay(250);
        if ((await collect()).length) await signalOwned('SIGKILL');
        for (let n = 0; n < 20 && (await collect()).length; n++) await delay(250);
      }
      record.survivors = await collect();
    } catch (error) {
      violation ??= `cleanup-error:${error.message}`;
      record.cleanupUnconfirmed = true;
    }
    for (let n = 0; n < 40 && !drained; n++) await delay(250);
    if (!drained) violation ??= 'stdio-drain-deadline';
    await writes;
    try {
      await inspect();
    } catch (error) {
      violation ??= `final-inspection:${error.message}`;
    }
    if (record.peakRSS > rssBytes) violation ??= 'rss-cap';
    record.exitCode = exitCode;
    record.signal = signal;
    record.violation = violation;
    record.outputBytesObserved = bytes;
    record.tracked = [...owned.values()];
    record.status =
      !violation &&
      !record.forcedCleanup &&
      !record.cleanupUnconfirmed &&
      !record.survivors.length &&
      !record.ambiguous.length &&
      ended
        ? 'closed'
        : 'failed';
    child.stdout.destroy();
    child.stderr.destroy();
    await stream.close();
    record.completedAt = new Date().toISOString();
    if (receipt) await save(receipt, record);
  }
  return record;
}

export function functionalResult(row, raw, command, revision) {
  if (command.status !== 'closed') return false;
  if (row.kind !== 'first30')
    return command.exitCode === 0 && raw?.status === 'passed' && raw.engine === row.engine;
  const replay = raw?.replay?.nativeVerification;
  return (
    [0, 2].includes(command.exitCode) &&
    raw?.scenarioStatus === 'pass' &&
    raw.environment?.engine === row.engine &&
    raw.environment?.contextMode === (row.engine === 'webkit' ? 'persistent' : 'ephemeral') &&
    raw.sourceRevision === revision &&
    raw.buildIdentity?.sourceRevision === revision &&
    replay?.status === 'pass' &&
    replay.engine === row.engine &&
    replay.browserVersion === raw.environment?.browserVersion &&
    !raw.contextCleanupFailure &&
    !raw.replayFailure &&
    !raw.failure &&
    raw.pageErrors?.length === 0
  );
}

async function evidenceSize(root) {
  let size = 0,
    count = 0;
  const walk = async (dir) => {
    for (const name of await readdir(dir)) {
      const path = join(dir, name),
        info = await lstat(path);
      assert(!info.isSymbolicLink(), 'Evidence symlink');
      assert(++count <= 2000, 'Evidence file-count cap');
      if (info.isDirectory()) await walk(path);
      else {
        assert(info.isFile());
        size += info.size;
      }
    }
  };
  await walk(root);
  return size;
}
async function sourceIdentity(path, revision) {
  const git = (...args) =>
    execFileSync('git', args, { cwd: path, encoding: 'utf8', timeout: 15000 }).trim();
  assert.equal(git('rev-parse', 'HEAD'), revision);
  assert.equal(git('status', '--porcelain=v1', '--untracked-files=normal'), '');
  return { revision, tree: git('rev-parse', 'HEAD^{tree}') };
}
async function downloadCandidate(plan, work, evidence, signal, reuse = null) {
  const candidate = reuse ?? plan.candidate;
  const role = reuse ? 'baseline-reuse' : 'candidate';
  const headers = {
    Authorization: `Bearer ${process.env.GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
  };
  const api = `https://api.github.com/repos/${plan.repository}/actions`;
  const get = async (url) => {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
    assert(response.ok, `GitHub metadata HTTP ${response.status}`);
    return response.json();
  };
  const run = await get(`${api}/runs/${candidate.run}`);
  const artifact = await get(`${api}/artifacts/${candidate.artifact}`);
  assert.equal(run.head_sha, reuse ? reuse.producer.toolingRevision : candidate.revision);
  if (reuse) {
    assert.equal(run.status, 'completed');
    assert(
      ['success', 'failure'].includes(run.conclusion),
      'Interrupted producer cannot provide reuse authority',
    );
    assert.equal(run.path, reuse.producer.workflow);
    assert.equal(run.run_attempt, reuse.producer.attempt);
  } else assert.equal(run.conclusion, 'success');
  assert.equal(run.repository.full_name, plan.repository);
  assert.equal(artifact.workflow_run.id, candidate.run);
  assert.equal(
    artifact.workflow_run.head_sha,
    reuse ? reuse.producer.toolingRevision : candidate.revision,
  );
  assert.equal(artifact.size_in_bytes, candidate.outer.bytes);
  assert.equal(artifact.digest, `sha256:${candidate.outer.sha256}`);
  assert.equal(artifact.expired, false);
  if (reuse) assert.equal(artifact.name, reuse.name);
  await save(join(evidence, `${role}-run.json`), run);
  await save(join(evidence, `${role}-artifact.json`), artifact);
  const redirect = await fetch(`${api}/artifacts/${candidate.artifact}/zip`, {
    headers,
    redirect: 'manual',
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  assert.equal(redirect.status, 302);
  const url = new URL(redirect.headers.get('location'));
  assert.equal(url.protocol, 'https:');
  // Signed URL and bearer token are deliberately never reported or sent to child commands.
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]),
  });
  assert(response.ok, `Artifact download HTTP ${response.status}`);
  const path = join(work, `${role}-outer.zip`),
    file = await open(path, 'wx');
  let bytes = 0;
  try {
    for await (const data of response.body) {
      bytes += data.length;
      assert(bytes <= candidate.outer.bytes);
      await file.write(data);
    }
    await file.sync();
  } finally {
    await file.close();
  }
  assert.deepEqual(await digest(path), candidate.outer);
  return path;
}

// Default first-eight reuse is admitted before importing the reusable-baseline
// module. Extension modes retain their existing adapter input admission.
export async function admitDefaultBaselineReuse(plan, repositoryPath, evidence) {
  if (!plan.baseline.reusableArtifact) return false;
  assert.equal(plan.format, 'SoloHostedCorrectnessPlan.v1');
  assert(
    !plan.baseline.publishVerifiedNormal && !plan.baseline.publisher,
    'A reused baseline cannot retain fresh-publication authority',
  );
  assert.deepEqual(
    plan.adapterInputs?.map((ref) => ref.path),
    ['scripts/solo-remote-baseline.mjs'],
    'Exactly one baseline helper identity is required',
  );
  const ref = plan.adapterInputs[0];
  assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes <= MiB);
  assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  const path = resolve(repositoryPath, ref.path);
  assert.equal(await realpath(path), path, 'Baseline helper alias');
  const info = await lstat(path);
  assert(info.isFile() && !info.isSymbolicLink() && info.size === ref.bytes);
  const bytes = await readFile(path);
  assert.deepEqual(
    { bytes: bytes.length, sha256: hash(bytes) },
    { bytes: ref.bytes, sha256: ref.sha256 },
    'Changed baseline helper',
  );
  await writeFile(join(evidence, 'solo-remote-baseline.mjs'), bytes, { flag: 'wx' });
  return true;
}

async function main() {
  assert.equal(process.platform, 'linux', 'This declared cohort is Linux only');
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Run only in the declared hosted job');
  const planPath = resolve(process.argv[2]);
  const output = resolve(process.argv[3]);
  assert(output.startsWith(`${resolve(process.env.RUNNER_TEMP)}/`));
  await mkdir(output); // fresh run; prior output is never reused
  const evidence = join(output, 'evidence'),
    work = join(output, 'work');
  await mkdir(evidence);
  await mkdir(work);
  const plan = await json(planPath);
  const extension =
    plan.format === 'SoloHostedOfflinePairPlan.v1'
      ? 'offline'
      : ['SoloHostedSustainedPlanV1', 'SoloHostedTimingPlanV1'].includes(plan.format)
        ? 'sustained'
        : plan.format === 'SoloHostedSupplementalPlanV1'
          ? 'supplemental'
          : plan.format === 'SoloHostedAuxiliaryPlanV1'
            ? 'auxiliary'
            : plan.format === 'SoloHostedDemoActivePlanV1'
              ? 'demo-active'
              : plan.format === 'SoloHostedDemoRecoveryPlanV1'
                ? 'demo'
                : plan.format === 'SoloHostedRasterPlanV1'
                  ? 'raster'
                  : [
                        'SoloHostedWorkerDiagnosticPlanV1',
                        'SoloHostedWorkerConfirmationPlanV1',
                      ].includes(plan.format)
                    ? 'worker-diagnostic'
                    : plan.format === 'SoloHostedCpuProfilePlanV1'
                      ? 'cpu-profile'
                      : null;
  let adapter = null,
    defaultBaselineReuse = false,
    modeState = null,
    setupActive =
      [
        'sustained',
        'auxiliary',
        'demo',
        'demo-active',
        'raster',
        'worker-diagnostic',
        'supplemental',
        'cpu-profile',
      ].includes(extension) ||
      (extension === 'offline' && Boolean(plan.offline.gameplay));
  if (extension) {
    adapter = await import(`./solo-remote-${extension}.mjs`);
    adapter[
      {
        offline: 'validateOfflinePlan',
        sustained: 'validateSustainedPlan',
        auxiliary: 'validateAuxiliaryPlan',
        demo: 'validateDemoPlan',
        'demo-active': 'validateDemoActivePlan',
        raster: 'validateRasterPlan',
        'worker-diagnostic': 'validateWorkerDiagnosticPlan',
        supplemental: 'validateSupplementalPlan',
        'cpu-profile': 'validateCpuProfilePlan',
      }[extension]
    ](plan);
  }
  const profileEvidence = extension === 'offline' ? join(output, 'profile-evidence') : null;
  if (profileEvidence) await mkdir(profileEvidence);
  const report = {
    format:
      extension === 'offline'
        ? 'SoloHostedOfflinePair.v1'
        : extension === 'sustained'
          ? 'SoloHostedSustained.v1'
          : extension === 'auxiliary'
            ? 'SoloHostedAuxiliary.v1'
            : extension === 'demo-active'
              ? 'SoloHostedDemoScopedRafCohortV1'
              : extension === 'demo'
                ? 'SoloHostedDemoRecoveryCohortV1'
                : extension === 'raster'
                  ? 'SoloHostedNativeRasterCohortV1'
                  : extension === 'worker-diagnostic'
                    ? plan.format === 'SoloHostedWorkerConfirmationPlanV1'
                      ? 'SoloHostedWorkerConfirmationCohortV1'
                      : 'SoloHostedWorkerDiagnosticCohortV1'
                    : extension === 'supplemental'
                      ? 'SoloHostedSupplementalPreflightV1'
                      : extension === 'cpu-profile'
                        ? 'SoloHostedCpuProfileCohortV1'
                        : 'SoloHostedCorrectness.v1',
    status: 'failed',
    performanceExclusion: ['sustained', 'demo-active'].includes(extension)
      ? plan.performanceExclusion
      : true,
    timingQualification:
      extension === 'demo-active'
        ? 'scoped-raf-only-full-cost-unobserved'
        : extension === 'sustained'
          ? 'source-and-host-scoped-raw-gates-required'
          : 'not-attempted',
    startedAt: new Date().toISOString(),
    rows: plan.rows.map((row) => ({ ...row, status: 'not-run' })),
  };
  const finalPath = join(evidence, 'summary.json');
  const cleanEnv = { ...process.env };
  delete cleanEnv.GH_TOKEN;
  const start = Date.now();
  const stop = new AbortController();
  const stopSignal = () => stop.abort(new Error('Outer termination requested'));
  process.once('SIGTERM', stopSignal);
  process.once('SIGINT', stopSignal);
  const overallDeadline = setTimeout(
    () => stop.abort(new Error('Helper deadline')),
    plan.helperTimeoutMs,
  ).unref();
  let server = null;
  const inspect = async () => {
    assert(!stop.signal.aborted, 'outer-stop-or-deadline');
    assert(Date.now() - start < plan.helperTimeoutMs, 'overall-helper-deadline');
    if (setupActive) assert(Date.now() - start < plan.setupTimeoutMs, 'setup-deadline');
    const fs = await statfs(output);
    assert(fs.bavail * fs.bsize >= GiB + 4 * MiB, 'disk-floor-plus-finalization-reserve');
    assert(
      (await evidenceSize(evidence)) <= plan.evidenceBytes - 4 * MiB,
      'aggregate-evidence-cap',
    );
    if (profileEvidence)
      assert(
        (await evidenceSize(profileEvidence)) <= plan.profileEvidenceBytes - 4 * MiB,
        'profile-evidence-cap',
      );
  };
  let progressCount = 0;
  const progress = (event, id, result = {}) => {
    if (!extension) return;
    assert(++progressCount <= 256, 'Progress record cap');
    assert(/^[a-z0-9-]{1,100}$/.test(id), 'Bounded public stage identifier');
    process.stdout.write(
      JSON.stringify({ event, id, at: new Date().toISOString(), ...result }) + '\n',
    );
  };
  const run = async (id, argv, timeoutMs, options = {}) => {
    progress('stage-start', id);
    const command = await ownedCommand(argv, {
      cwd: repository,
      env: cleanEnv,
      log: join(evidence, `${id}.log`),
      receipt: join(evidence, `${id}.command.json`),
      timeoutMs,
      inspect,
      ...options,
    });
    progress('stage-end', id, { status: command.status, exitCode: command.exitCode });
    assert(
      !command.cleanupUnconfirmed && !command.survivors.length && !command.ambiguous.length,
      'Unclosed owner; remaining rows withheld',
    );
    return command;
  };
  const required = async (...args) => {
    const command = await run(...args);
    assert.equal(command.status, 'closed');
    assert.equal(command.exitCode, 0);
  };
  const sources = {
    baseline: resolve(process.env.SOLO_BASELINE_SOURCE),
    candidate: resolve(process.env.SOLO_CANDIDATE_SOURCE),
  };
  const payloads = {
    baseline: join(work, 'baseline-payload'),
    candidate: join(work, 'candidate-payload'),
  };
  try {
    if (!extension) {
      assert.equal(plan.format, 'SoloHostedCorrectnessPlan.v1');
      assert.equal(plan.rows.length, 8);
    }
    assert.equal(process.version, `v${plan.node}`);
    assert.equal(arch(), 'x64');
    report.tooling = await sourceIdentity(repository, process.env.SOLO_TOOLING_REVISION);
    report.plan = { path: planPath, ...(await digest(planPath)) };
    report.runner = {
      platform: process.platform,
      arch: arch(),
      release: release(),
      cpus: cpus(),
      memoryBytes: totalmem(),
      imageOS: process.env.ImageOS,
      imageVersion: process.env.ImageVersion,
      runId: process.env.GITHUB_RUN_ID,
      attempt: process.env.GITHUB_RUN_ATTEMPT,
      node: process.version,
      ...(extension || plan.baseline.publishVerifiedNormal
        ? { workflowRef: process.env.GITHUB_WORKFLOW_REF }
        : {}),
    };
    assert(totalmem() >= 12 * GiB, 'Hosted runner memory admission');
    const disk = await statfs(output);
    assert(disk.bavail * disk.bsize >= 8 * GiB, 'Hosted disk admission');
    const temporaryRoot = resolve(process.env.RUNNER_TEMP);
    assert.equal(await realpath(temporaryRoot), temporaryRoot, 'Runner temporary root alias');
    assert(!(await lstat(temporaryRoot)).isSymbolicLink());
    const scratchRoot = await mkdtemp(join(temporaryRoot, 'sc-'));
    scratchRowPath(scratchRoot, report.rows.length - 1);
    const scratchOwner = await lstat(scratchRoot);
    report.scratchOwner = {
      path: scratchRoot,
      device: scratchOwner.dev,
      inode: scratchOwner.ino,
      maximumRowPathBytes: 52,
      lifetime: 'Fresh hosted-job owner; retained until job teardown',
    };
    for (const role of ['baseline', 'candidate']) {
      report[`${role}Source`] = await sourceIdentity(sources[role], plan[role].revision);
      assert.equal(report[`${role}Source`].tree, plan[role].tree);
    }
    if (plan.baseline.publishVerifiedNormal) {
      const ref = plan.baseline.publisher;
      assert.equal(ref.path, 'scripts/solo-remote-baseline.mjs');
      assert.deepEqual(await digest(join(repository, ref.path)), {
        bytes: ref.bytes,
        sha256: ref.sha256,
      });
      if (!extension)
        await writeFile(
          join(evidence, 'solo-remote-baseline.mjs'),
          await readFile(join(repository, ref.path)),
          { flag: 'wx' },
        );
    }
    if (!extension)
      defaultBaselineReuse = await admitDefaultBaselineReuse(plan, repository, evidence);
    const fixture = extension ? null : resolve(repository, plan.fixture.path);
    if (fixture) {
      assert.deepEqual(await digest(fixture), {
        bytes: plan.fixture.bytes,
        sha256: plan.fixture.sha256,
      });
      await writeFile(join(evidence, 'first30.qualification.json'), await readFile(fixture), {
        flag: 'wx',
      });
    }
    if (extension) {
      if (plan.baseline.publishVerifiedNormal || plan.baseline.reusableArtifact)
        assert(
          plan.adapterInputs.some((ref) => ref.path === 'scripts/solo-remote-baseline.mjs'),
          'Baseline adapter identity must be pinned',
        );
      for (const ref of plan.adapterInputs) {
        assert(ref.path.startsWith('scripts/') && !ref.path.includes('..'));
        assert.deepEqual(await digest(join(repository, ref.path)), {
          bytes: ref.bytes,
          sha256: ref.sha256,
        });
        await writeFile(
          join(evidence, ref.path.split('/').at(-1)),
          await readFile(join(repository, ref.path)),
          { flag: 'wx' },
        );
      }
    }
    await writeFile(join(evidence, 'plan.json'), await readFile(planPath), { flag: 'wx' });
    for (const name of ['run-solo-remote-correctness.mjs', 'solo-remote-archive.py'])
      await writeFile(join(evidence, name), await readFile(join(here, name)), { flag: 'wx' });
    const browserModule = resolve(process.env.SOLO_PLAYWRIGHT_MODULE);
    const pw = await import(pathToFileURL(browserModule));
    const pwPackage = await json(join(dirname(browserModule), 'package.json'));
    assert.equal(pwPackage.version, plan.playwright);
    report.playwright = {
      version: pwPackage.version,
      module: browserModule,
      moduleIdentity: await digest(browserModule),
      engines: {},
    };
    for (const engine of ['offline', 'demo', 'demo-active'].includes(extension)
      ? ['chromium']
      : ['chromium', 'webkit'])
      report.playwright.engines[engine] = {
        executable: pw[engine].executablePath(),
        identity: await digest(pw[engine].executablePath()),
      };
    const browserRegistry = resolve(dirname(browserModule), '../playwright-core/browsers.json');
    report.playwright.registry = await json(browserRegistry);
    report.playwright.registryIdentity = await digest(browserRegistry);
    cleanEnv.CHROME_EXECUTABLE = pw.chromium.executablePath();
    cleanEnv.PLAYWRIGHT_MODULE = browserModule;
    const outer = await downloadCandidate(plan, work, evidence, stop.signal);
    const selected = join(work, 'candidate-selected');
    await required(
      'candidate-outer',
      [
        'python3',
        '-B',
        join(here, 'solo-remote-archive.py'),
        'outer',
        outer,
        selected,
        plan.candidate.revision,
        join(evidence, 'candidate-outer.json'),
      ],
      600000,
    );
    assert.deepEqual(await digest(join(selected, 'distribution.zip')), plan.candidate.inner);
    const producer = (await json(join(evidence, 'candidate-outer.json'))).producer;
    assert.equal(producer.sourceTree, plan.candidate.tree);
    assert.equal(producer.node, `v${plan.node}`);
    await required(
      'candidate-inner',
      [
        'python3',
        '-B',
        join(here, 'solo-remote-archive.py'),
        'inner',
        join(selected, 'distribution.zip'),
        payloads.candidate,
        plan.candidate.revision,
        join(evidence, 'candidate-archive.json'),
      ],
      600000,
    );
    const baselineBuild = join(work, 'baseline-build');
    const admitted = {
      format: 'SoloHostedVerifiedArtifactsV1',
      status: 'passed',
      performanceExclusion: true,
      artifacts: {},
    };
    let baselineArchive = join(baselineBuild, 'distribution.zip');
    const verifyArtifact = async (role) => {
      const archive = role === 'candidate' ? join(selected, 'distribution.zip') : baselineArchive;
      const archiveProof = await json(join(evidence, `${role}-archive.json`));
      await writeFile(`${archive}.sha256`, `${archiveProof.zipSHA256}  distribution.zip\n`);
      await required(
        `${role}-source`,
        [
          process.execPath,
          join(here, 'verify-solo-build.mjs'),
          payloads[role],
          join(evidence, `${role}-source.json`),
          `--source=${sources[role]}`,
          `--base=${plan[role].revision}`,
          `--archive=${archive}`,
          `--archive-receipt=${join(evidence, `${role}-archive.json`)}`,
        ],
        480000,
      );
      const proof = await json(join(evidence, `${role}-source.json`));
      assert.equal(proof.status, 'passed');
      assert.equal(proof.source.wholeTreeRevision, plan[role].revision);
      if (role === 'candidate') assert.equal(proof.manifest.sha256, plan.candidate.manifestSHA256);
      if (role === 'baseline' && plan.baseline.reusableArtifact)
        assert.equal(proof.manifest.sha256, plan.baseline.reusableArtifact.manifestSHA256);
      const retained = join(evidence, `${role}-payload-metadata`);
      await mkdir(retained);
      for (const name of ['manifest.json', '_headers', 'game/build-info.json']) {
        const target = join(retained, name);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, await readFile(join(payloads[role], name)), { flag: 'wx' });
      }
      admitted.artifacts[role] = {
        sourceRole: role,
        sourceRevision: plan[role].revision,
        sourceTree: plan[role].tree,
        payloadRealpath: payloads[role],
        manifestSHA256: proof.manifest.sha256,
        archivePath: archive,
        archiveIdentity: { bytes: archiveProof.zipBytes, sha256: archiveProof.zipSHA256 },
        sourceProof: {
          path: join(evidence, `${role}-source.json`),
          ...(await digest(join(evidence, `${role}-source.json`))),
        },
        archiveProof: {
          path: join(evidence, `${role}-archive.json`),
          ...(await digest(join(evidence, `${role}-archive.json`))),
        },
      };
      await save(join(evidence, 'verified-artifacts.json'), admitted);
    };
    await verifyArtifact('candidate');
    report.candidateSetupStatus = 'passed';
    await save(finalPath, report);
    const ensureBaseline = async () => {
      if (admitted.artifacts.baseline) return;
      report.baselineSetupStatus = 'running';
      if ((extension && plan.baseline.reusableArtifact) || defaultBaselineReuse) {
        assert(
          !plan.baseline.publishVerifiedNormal,
          'Cannot republish a reused baseline as freshly built',
        );
        const { validateBaselineReuse, readBaselineBundle, BASELINE_FILES } = await import(
          './solo-remote-baseline.mjs'
        );
        const reuse = plan.baseline.reusableArtifact;
        validateBaselineReuse(reuse, plan);
        const baselineOuter = await downloadCandidate(plan, work, evidence, stop.signal, reuse);
        const baselineSelected = join(work, 'baseline-reuse-selected');
        await required(
          'baseline-reuse-outer',
          [
            'python3',
            '-B',
            join(here, 'solo-remote-archive.py'),
            'baseline-outer',
            baselineOuter,
            baselineSelected,
            plan.baseline.revision,
            join(evidence, 'baseline-reuse-outer.json'),
          ],
          600000,
        );
        const retained = await readBaselineBundle(baselineSelected, reuse);
        await save(join(evidence, 'baseline-reuse-authority.json'), {
          status: 'passed',
          producer: retained.ready.producer,
          ready: retained.readyIdentity,
          disposition:
            'Producer proof is historical; current inner and exact-source proofs remain independently required.',
        });
        const historical = join(evidence, 'baseline-reuse-proof');
        await mkdir(historical);
        for (const name of BASELINE_FILES.filter((name) => name !== 'distribution.zip')) {
          const target = join(historical, name);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, await readFile(join(baselineSelected, name)), { flag: 'wx' });
        }
        baselineArchive = join(baselineSelected, 'distribution.zip');
        await required(
          'baseline-inner',
          [
            'python3',
            '-B',
            join(here, 'solo-remote-archive.py'),
            'inner',
            baselineArchive,
            payloads.baseline,
            plan.baseline.revision,
            join(evidence, 'baseline-archive.json'),
          ],
          600000,
        );
        await verifyArtifact('baseline');
        report.baselineSetupStatus = 'passed';
        report.baselineAcquisition = 'pinned-normal-artifact-reverified';
        return;
      }
      const observations = [];
      let lastObservation = -Infinity;
      const observeBuild = async (force = false) => {
        if (!force && Date.now() - lastObservation < 15000) return;
        assert(observations.length < 100, 'baseline-build-observation-cap');
        lastObservation = Date.now();
        const staging = (await readdir(work, { withFileTypes: true })).filter((entry) =>
          entry.name.startsWith('.xonix-build-'),
        );
        assert(staging.length <= 2, 'Unexpected baseline staging count');
        const roots = [baselineBuild, ...staging.map((entry) => join(work, entry.name))];
        const paths = [];
        for (const root of roots) {
          try {
            assert((await lstat(root)).isDirectory(), 'Build output must remain a directory');
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            paths.push({ path: root, exists: false });
            continue;
          }
          for (const name of ['manifest.json', 'distribution.zip', '.xonix-build.json']) {
            const path = join(root, name);
            try {
              const info = await lstat(path);
              assert(info.isFile(), 'Declared build output must remain a regular file');
              paths.push({ path, exists: true, bytes: info.size, modifiedMs: info.mtimeMs });
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
              paths.push({ path, exists: false });
            }
          }
        }
        observations.push({ at: new Date().toISOString(), paths });
        await save(join(evidence, 'baseline-build-observations.json'), {
          scope:
            'Setup-only scalar lstat observations; absence/presence does not identify CPU cause',
          intervalMs: 15000,
          maximumRecords: 100,
          observations,
        });
      };
      await observeBuild();
      try {
        await required(
          'baseline-build',
          [
            process.execPath,
            join(sources.baseline, 'scripts/game-cli.mjs'),
            'build',
            '--out',
            baselineBuild,
            '--revision',
            plan.baseline.revision,
          ],
          1200000,
          {
            cwd: sources.baseline,
            inspect: async () => {
              await inspect();
              await observeBuild();
            },
          },
        );
      } finally {
        await observeBuild(true);
      }
      await required(
        'baseline-inner',
        [
          'python3',
          '-B',
          join(here, 'solo-remote-archive.py'),
          'inner',
          join(baselineBuild, 'distribution.zip'),
          payloads.baseline,
          plan.baseline.revision,
          join(evidence, 'baseline-archive.json'),
        ],
        600000,
      );
      await verifyArtifact('baseline');
      report.baselineSetupStatus = 'passed';
      report.baselineAcquisition = 'fresh-normal-build';
      if (plan.baseline.publishVerifiedNormal) {
        const { publishBaseline } = await import('./solo-remote-baseline.mjs');
        report.baselinePublication = await publishBaseline({
          buildPath: baselineBuild,
          payloadPath: payloads.baseline,
          evidence,
          report,
          plan,
          sourcePath: sources.baseline,
          nodeExecutable: process.execPath,
          archiveHelper: join(here, 'solo-remote-archive.py'),
          sourceVerifier: join(here, 'verify-solo-build.mjs'),
          inspect,
        });
        await save(join(evidence, 'baseline-publication.json'), report.baselinePublication);
      }
    };
    const context = {
      plan,
      report,
      sources,
      payloads,
      admitted,
      cleanEnv,
      inspect,
      ensureBaseline,
      run,
      required,
      digest,
      evidenceSize,
      here,
      repository,
      output,
      work,
      evidence,
      browserModule,
      chromeExecutable: cleanEnv.CHROME_EXECUTABLE,
    };
    if (extension) {
      if (
        extension === 'offline' ||
        (extension === 'sustained' && plan.phase !== 'diagnostics') ||
        (['auxiliary', 'supplemental'].includes(extension) &&
          plan.rows.some((row) => row.source === 'baseline'))
      )
        await ensureBaseline();
      if (
        [
          'sustained',
          'auxiliary',
          'demo',
          'demo-active',
          'raster',
          'worker-diagnostic',
          'supplemental',
          'cpu-profile',
        ].includes(extension) ||
        (extension === 'offline' && Boolean(plan.offline.gameplay))
      )
        await inspect();
      setupActive = false;
      report.setupCompletedAt = new Date().toISOString();
      report.modePreparationStartedAt = report.setupCompletedAt;
      modeState =
        await adapter[
          {
            offline: 'prepareOfflineMode',
            sustained: 'prepareSustainedMode',
            auxiliary: 'prepareAuxiliaryMode',
            demo: 'prepareDemoMode',
            'demo-active': 'prepareDemoActiveMode',
            raster: 'prepareRasterMode',
            'worker-diagnostic': 'prepareWorkerDiagnosticMode',
            supplemental: 'prepareSupplementalMode',
            'cpu-profile': 'prepareCpuProfileMode',
          }[extension]
        ](context);
      context.modeState = modeState;
      report.modePreparationCompletedAt = new Date().toISOString();
      report.modeScope = plan.scope;
      report.supervisorScope =
        'Common process/resource admission samples ownership and aggregate filesystem/RSS at250ms outside application callbacks. This environment work remains part of the hosted stratum; no per-frame trace/profiler added.';
    }
    for (const row of report.rows) {
      if (row.kind === 'first30' && !admitted.artifacts.baseline) await ensureBaseline();
      const dir = join(evidence, row.id);
      await mkdir(dir);
      const rawPath = join(dir, 'report.json'),
        tmp = scratchRowPath(report.scratchOwner.path, report.rows.indexOf(row));
      const currentOwner = await lstat(report.scratchOwner.path);
      assert(currentOwner.isDirectory());
      assert.equal(currentOwner.dev, report.scratchOwner.device);
      assert.equal(currentOwner.ino, report.scratchOwner.inode);
      await mkdir(tmp);
      const scratchStat = await lstat(tmp),
        scratchSpace = await statfs(tmp);
      row.storage = {
        outputRoot: dir,
        scratchRoot: tmp,
        scratchOwner: report.scratchOwner,
        device: scratchStat.dev,
        inode: scratchStat.ino,
        freeBytesAtAdmission: scratchSpace.bavail * scratchSpace.bsize,
        minimumRemainingBytes: GiB,
      };
      if (['offline', 'demo', 'demo-active'].includes(extension)) {
        const authorityPath = join(dir, 'scratch-authority.json');
        await writeFile(
          authorityPath,
          JSON.stringify(
            {
              format: 'SoloHostedRowScratchV1',
              runRoot: output,
              rowId: row.id,
              storage: row.storage,
            },
            null,
            2,
          ) + '\n',
          { flag: 'wx' },
        );
        row.scratchAuthority = { path: authorityPath, ...(await digest(authorityPath)) };
      }
      row.startedAt = new Date().toISOString();
      progress('row-start', row.id);
      row.status = 'failed';
      try {
        await inspect();
        await sourceIdentity(repository, report.tooling.revision);
        for (const role of ['baseline', 'candidate'])
          await sourceIdentity(sources[role], plan[role].revision);
        if (extension) {
          await adapter[
            {
              offline: 'runOfflineRow',
              sustained: 'runSustainedRow',
              auxiliary: 'runAuxiliaryRow',
              demo: 'runDemoRow',
              'demo-active': 'runDemoActiveRow',
              raster: 'runRasterRow',
              'worker-diagnostic': 'runWorkerDiagnosticRow',
              supplemental: 'runSupplementalRow',
              'cpu-profile': 'runCpuProfileRow',
            }[extension]
          ](context, row, dir, tmp);
        } else {
          assert.deepEqual(await digest(fixture), {
            bytes: plan.fixture.bytes,
            sha256: plan.fixture.sha256,
          });
          server = await startProductionPreview({
            root: payloads[row.source],
            port: 0,
            fixtureAccess: row.kind === 'first30',
            cache: 'policy',
          });
          const url = new URL('game/', server.url).href;
          const response = await fetch(new URL('game/build-info.json', server.url), {
            signal: AbortSignal.timeout(10000),
          });
          const infoBytes = Buffer.from(await response.arrayBuffer());
          const build = JSON.parse(infoBytes);
          assert.equal(build.sourceRevision, plan[row.source].revision);
          for (const [name, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
            assert.equal(response.headers.get(name), value);
          row.served = {
            url,
            build,
            buildInfoSHA256: hash(infoBytes),
            headers: server.headers,
            mode: server.mode,
            fixtureAccess: server.fixtureAccess,
          };
          const args =
            row.kind === 'first30'
              ? [
                  join(here, 'qualify-solo-runtime.mjs'),
                  url,
                  fixture,
                  rawPath,
                  '--work-probe',
                  '--server-fixture-access',
                  '--cadence=settled120',
                  `--source-revision=${plan[row.source].revision}`,
                  ...(row.source === 'baseline' ? ['--baseline-runtime'] : []),
                  ...(row.engine === 'webkit' ? ['--browser=webkit', '--context=persistent'] : []),
                ]
              : [
                  join(
                    here,
                    row.kind === 'worker'
                      ? 'verify-solo-mp3-worker.mjs'
                      : 'verify-solo-paused-render.mjs',
                  ),
                  url,
                  rawPath,
                  '--fixture-access',
                  ...(row.engine === 'webkit' ? ['--browser=webkit'] : []),
                ];
          // The server owns the unchanged localhost access fixture. Authentication is excluded.
          const env = { ...cleanEnv, TMPDIR: tmp };
          const command = await ownedCommand([process.execPath, ...args], {
            cwd: repository,
            env,
            log: join(dir, 'command.log'),
            receipt: join(dir, 'command.json'),
            timeoutMs: row.timeoutMs,
            inspect: async () => {
              await inspect();
              assert((await evidenceSize(dir)) <= 32 * MiB, 'row-evidence-cap');
            },
          });
          row.command = command;
          let raw = null;
          try {
            raw = await json(rawPath);
          } catch (error) {
            row.reportReadFailure = error.message;
          }
          row.rawPerformanceGateStatus = raw?.performanceGateStatus ?? null;
          row.status = functionalResult(row, raw, command, plan[row.source].revision)
            ? 'passed'
            : 'failed';
          row.browserVersion = raw?.environment?.browserVersion ?? raw?.browser ?? null;
          assert.equal(typeof row.browserVersion, 'string', 'Actual browser version is required');
          const previous = report.rows.find(
            (other) => other !== row && other.engine === row.engine && other.browserVersion,
          );
          if (previous)
            assert.equal(
              row.browserVersion,
              previous.browserVersion,
              'Browser version changed across rows',
            );
          assert(
            !command.cleanupUnconfirmed && !command.survivors.length && !command.ambiguous.length,
            'Owned or ambiguous browser remains',
          );
        }
      } catch (error) {
        row.status = 'failed';
        row.error = String(error.stack ?? error);
        if (
          !row.command ||
          row.serverCleanupFailure ||
          row.command.cleanupUnconfirmed ||
          row.command?.survivors.length ||
          row.command?.ambiguous.length
        )
          throw error;
      } finally {
        if (server) {
          const closing = server;
          server = null;
          await Promise.race([
            new Promise((resolveClose, reject) => {
              closing.server.close((error) => (error ? reject(error) : resolveClose()));
              closing.server.closeAllConnections();
            }),
            delay(10000).then(() => {
              throw Error('Owned server close deadline');
            }),
          ]);
        }
        row.completedAt = new Date().toISOString();
        progress('row-end', row.id, { status: row.status });
        await save(finalPath, report);
        await inspect();
        assert(
          (await evidenceSize(dir)) <= (extension ? (plan.rowEvidenceBytes ?? 32 * MiB) : 32 * MiB),
          'Final row evidence cap',
        );
      }
    }
    await inspect();
    report.status =
      extension === 'offline'
        ? report.rows.every((row) => row.status === 'completed-diagnostic')
          ? 'completed-diagnostic'
          : 'failed'
        : report.rows.every((row) => row.status === 'passed')
          ? 'passed'
          : 'failed';
    if (extension === 'offline') report.offlineQualification = 'not-qualified-diagnostic-only';
  } catch (error) {
    report.status = 'failed';
    report.failure = String(error.stack ?? error);
    if (report.baselineSetupStatus === 'running') report.baselineSetupStatus = 'failed';
  } finally {
    if (server) {
      server.server.close();
      server.server.closeAllConnections();
      report.serverCleanupFailure = true;
    }
    report.completedAt = new Date().toISOString();
    const baselineScope =
      report.baselineSetupStatus !== 'passed'
        ? 'baseline not admitted; see setup status'
        : report.baselineAcquisition === 'pinned-normal-artifact-reverified'
          ? 'baseline pinned prior normal Linux artifact with fresh full inner/source verification'
          : 'baseline fresh pinned-source normal Linux build';
    report.artifactScope =
      extension === 'demo-active'
        ? 'Candidate exact retained CI package; candidate-only Linux rAF work/cadence scope. Timer/MessageChannel/full application cost, observer overhead, physical devices and heat remain unqualified. Common process/resource supervisor is part of this hosted environment.'
        : extension === 'sustained'
          ? `Candidate exact retained CI package; ${baselineScope}. Hosted source/context-scoped raw timing gates only; common process/resource supervisor is part of this environment. No authentication, physical-device, GPU or thermal qualification.`
          : `Candidate exact retained CI package; ${baselineScope}. Localhost access fixture; no authentication, timing, physical-device, GPU or thermal qualification.`;
    const finalSpace = await statfs(output);
    assert(finalSpace.bavail * finalSpace.bsize >= GiB + 4 * MiB, 'Final evidence disk reserve');
    assert(
      (await evidenceSize(evidence)) <= plan.evidenceBytes - 4 * MiB,
      'Final evidence metadata reserve',
    );
    const inventory = [];
    const walk = async (dir) => {
      for (const name of await readdir(dir)) {
        const path = join(dir, name),
          info = await lstat(path);
        assert(!info.isSymbolicLink());
        if (info.isDirectory()) await walk(path);
        else if (info.isFile() && path !== finalPath && name !== 'inventory.json')
          inventory.push({ path: path.slice(evidence.length + 1), ...(await digest(path)) });
      }
    };
    await walk(evidence);
    if (profileEvidence) {
      assert((await evidenceSize(profileEvidence)) <= plan.profileEvidenceBytes - 4 * MiB);
      const profiles = [];
      for (const name of await readdir(profileEvidence)) {
        const dir = join(profileEvidence, name);
        assert((await lstat(dir)).isDirectory());
        for (const item of await readdir(dir)) {
          const file = join(dir, item),
            info = await lstat(file);
          assert(info.isFile() && !info.isSymbolicLink());
          profiles.push({ path: `${name}/${item}`, ...(await digest(file)) });
        }
      }
      const profileInventory = Buffer.from(JSON.stringify(profiles, null, 2) + '\n');
      assert(profileInventory.length <= 2 * MiB);
      await writeFile(join(profileEvidence, 'inventory.json'), profileInventory, { flag: 'wx' });
      report.profileEvidence = {
        path: profileEvidence,
        inventorySHA256: hash(profileInventory),
        files: profiles.length,
      };
    }
    const failExpiredFinalization = () => {
      if (stop.signal.aborted || Date.now() - start >= plan.helperTimeoutMs) {
        report.status = 'failed';
        report.finalizationDeadlineFailure = true;
        return true;
      }
      return false;
    };
    const publish = async () => {
      failExpiredFinalization();
      const finalBytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
      assert(finalBytes.length <= 2 * MiB, 'Final summary bound');
      const inventoryBytes = Buffer.from(
        JSON.stringify(
          [
            ...inventory,
            { path: 'summary.json', bytes: finalBytes.length, sha256: hash(finalBytes) },
          ],
          null,
          2,
        ) + '\n',
      );
      assert(inventoryBytes.length <= 2 * MiB, 'Final inventory bound');
      await writeFile(join(evidence, 'inventory.json'), inventoryBytes);
      // A passing summary is published last. If the stop arrives during either
      // write, the caller immediately publishes an irreversible failed pair.
      await writeFile(finalPath, finalBytes);
    };
    await publish();
    if (!report.finalizationDeadlineFailure && failExpiredFinalization()) await publish();
    clearTimeout(overallDeadline);
    process.removeListener('SIGTERM', stopSignal);
    process.removeListener('SIGINT', stopSignal);
    process.exitCode = ['passed', 'completed-diagnostic'].includes(report.status) ? 0 : 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
