import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  readFile,
  writeFile,
  open,
  mkdir,
  mkdtemp,
  lstat,
  realpath,
  statfs,
} from 'node:fs/promises';
import { totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ownedCommand,
  digest,
  evidenceSize,
  scratchRowPath,
} from './run-solo-remote-correctness.mjs';
import {
  requireCleanCommand,
  validateBaselineReuse,
  readBaselineBundle,
} from './solo-remote-baseline.mjs';
import {
  frozenSource,
  sourceGit,
  committedInputMap,
  verifyCommittedInputs,
} from './frozen-source.mjs';
import { startProductionPreview } from './serve-production-preview.mjs';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import {
  loadReplayPortabilityCase,
  createReplayPortabilityReference,
} from './solo-replay-portability-diagnostic.mjs';
import { diagnoseNativeReplayPortability } from './diagnose-solo-replay-portability.mjs';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '..');
const planPath = join(root, 'docs/performance/solo-replay-portability-797-plan.json');
const MiB = 1024 ** 2,
  GiB = 1024 ** 3;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const json = async (path, maximum = 2 * MiB) => {
  assert((await lstat(path)).size <= maximum);
  const bytes = await readFile(path);
  assert(bytes.length <= maximum);
  return JSON.parse(bytes);
};
const exclusive = async (path, value, maximum) => {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value) + '\n');
  assert(bytes.length <= maximum, 'Declared evidence limit');
  const file = await open(path, 'wx');
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  return { bytes: bytes.length, sha256: hash(bytes) };
};
const IDS = [
  'baseline-first30-chromium',
  'baseline-first30-webkit',
  'candidate-first30-chromium',
  'candidate-first30-webkit',
];
export function validatePortabilityPlan(plan, fixedCases) {
  assert.equal(plan.format, 'SoloFixedReplayPortabilityPlanV1');
  assert.equal(plan.status, 'reviewed-diagnostic-only');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.deepEqual(plan.records, IDS);
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.equal(plan.rowTimeoutMs, 120000);
  assert.equal(plan.helperTimeoutMs, 4500000);
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.concurrency, 1);
  assert.equal(plan.sourceRun, fixedCases.sourceRun);
  assert.equal(plan.sourceArtifact, fixedCases.sourceArtifact);
  assert.equal(plan.sourceArtifactSHA256, fixedCases.sourceArtifactSHA256);
  for (const role of ['baseline', 'candidate']) {
    const rows = fixedCases.cases.filter((row) => row.id.startsWith(role + '-'));
    assert.equal(rows.length, 2);
    for (const row of rows) assert.equal(row.sourceRevision, plan[role].revision);
  }
  assert.equal(plan.candidate.revision, '797e03f28743921842df6aa57520a72016ba3dfc');
  assert.equal(plan.candidate.tree, 'bd53120f0cdfa462b8d63c2de5aa61e9c6658ac5');
  assert.equal(plan.candidate.run, 39104551453);
  assert.equal(plan.candidate.artifact, 12128990483);
  assert.equal(plan.candidate.outer.bytes, 1094639112);
  assert.equal(plan.candidate.inner.bytes, 1075807530);
  assert.equal(
    plan.candidate.outer.sha256,
    '76a01b2d29119f1bc4d8aaa8da77846160133067d0eb3036f5791c3198b5b897',
  );
  assert.equal(
    plan.candidate.inner.sha256,
    '5eb1c3e70d8fc460ddeba3762137306cf2e6902c315172c633702621883b7e9c',
  );
  assert.equal(
    plan.candidate.manifestSHA256,
    '497efcff7f399c12030bfa5297f8e67faaa97ef26626ac88a1b924fcb23db6a0',
  );
  validateBaselineReuse(plan.baseline.reusableArtifact, plan);
  const baseline = plan.baseline.reusableArtifact;
  assert.equal(baseline.run, 38998342742);
  assert.equal(baseline.artifact, 12088541389);
  assert.equal(baseline.outer.bytes, 1073805912);
  assert.equal(baseline.inner.bytes, 1073243091);
  assert.equal(
    baseline.outer.sha256,
    '63545549d9d087e96dcade7e549369a3e2cc00eaa8ae292c314686d0b0563230',
  );
  assert.equal(
    baseline.inner.sha256,
    '8f8808fe79390429308cb4637c66ea34aeb5043947616a14b9cffcacf044dc1e',
  );
  assert.equal(
    baseline.manifestSHA256,
    '3b448d181f75bf54aa1f2929e30f8b6a3fbc39a8b4eeb58914f5b29a704a85e8',
  );
  assert.equal(baseline.ready.bytes, 1599);
  assert.equal(
    baseline.ready.sha256,
    '22b6a3cfdba87f242daa41309611ba2671dac18bcf6455cd7ebb68cb6b741d88',
  );
}
async function sourceProof() {
  const source = frozenSource(root);
  assert.equal(source.sourceRevision, process.env.SOLO_TOOLING_REVISION);
  const paths = sourceGit(root, ['ls-files', '-t', '-z'])
    .split('\0')
    .filter(Boolean)
    .filter((row) => row[0] !== 'S')
    .map((row) => row.slice(2));
  const inputs = new Map();
  for (const path of paths) {
    const info = await lstat(join(root, path));
    assert(info.isFile() && !info.isSymbolicLink(), 'Materialized input alias');
    inputs.set(path, await readFile(join(root, path)));
  }
  verifyCommittedInputs(inputs, committedInputMap(root));
  return {
    ...source,
    files: [...inputs].map(([path, bytes]) => ({
      path,
      bytes: bytes.length,
      sha256: hash(bytes),
    })),
  };
}
export function validatePortabilityMetadata(plan, role, run, artifact) {
  assert(['baseline', 'candidate'].includes(role));
  const baseline = role === 'baseline';
  const pin = baseline ? plan.baseline.reusableArtifact : plan.candidate;
  const head = baseline ? pin.producer.toolingRevision : pin.revision;
  assert.equal(run.repository.full_name, plan.repository);
  assert.equal(run.head_sha, head);
  assert.equal(run.status, 'completed');
  assert(baseline ? ['success', 'failure'].includes(run.conclusion) : run.conclusion === 'success');
  if (!baseline) {
    assert.equal(run.path, '.github/workflows/appearance-preview.yml');
    assert.equal(run.run_attempt, 1);
  }
  if (baseline) {
    assert.equal(run.path, pin.producer.workflow);
    assert.equal(run.run_attempt, pin.producer.attempt);
    assert.equal(artifact.name, pin.name);
  }
  assert.equal(artifact.workflow_run.id, pin.run);
  assert.equal(artifact.workflow_run.head_sha, head);
  assert.equal(artifact.size_in_bytes, pin.outer.bytes);
  assert.equal(artifact.digest, 'sha256:' + pin.outer.sha256);
  assert.equal(artifact.expired, false);
}

async function fixedDownload(plan, role, work, evidence, inspect, signal) {
  const baseline = role === 'baseline';
  const pin = baseline ? plan.baseline.reusableArtifact : plan.candidate;
  const headers = {
    Authorization: 'Bearer ' + process.env.GH_TOKEN,
    Accept: 'application/vnd.github+json',
  };
  const api = 'https://api.github.com/repos/mekhovov/revealline/actions';
  const get = async (url) => {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    });
    assert(response.ok, 'GitHub metadata HTTP ' + response.status);
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      assert(bytes <= MiB, 'Metadata cap');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  };
  const run = await get(api + '/runs/' + pin.run);
  const artifact = await get(api + '/artifacts/' + pin.artifact);
  validatePortabilityMetadata(plan, role, run, artifact);
  await exclusive(join(evidence, role + '-run.json'), run, MiB);
  await exclusive(join(evidence, role + '-artifact.json'), artifact, MiB);
  const redirect = await fetch(api + '/artifacts/' + pin.artifact + '/zip', {
    headers,
    redirect: 'manual',
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
  });
  assert.equal(redirect.status, 302);
  const url = new URL(redirect.headers.get('location'));
  assert.equal(url.protocol, 'https:');
  // Neither token nor signed URL is retained or passed to a child process.
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]),
  });
  assert(response.ok);
  const path = join(work, role + '-outer.zip'),
    file = await open(path, 'wx');
  let bytes = 0,
    lastInspection = -Infinity;
  try {
    for await (const chunk of response.body) {
      if (Date.now() - lastInspection >= 1000) {
        await inspect();
        lastInspection = Date.now();
      }
      bytes += chunk.length;
      assert(bytes <= pin.outer.bytes);
      await file.writeFile(chunk);
    }
    await file.sync();
  } finally {
    await file.close();
  }
  assert.deepEqual(await digest(path), pin.outer);
  return path;
}
async function rowChild(id, payload, output) {
  const started = performance.now();
  const { fixture, row } = await loadReplayPortabilityCase(id);
  const plan = await json(planPath);
  validatePortabilityPlan(plan, fixture);
  assert.equal(process.version, 'v22.13.1');
  assert.equal(process.platform, 'linux');
  assert(process.env.SOLO_REMOTE_OWNER, 'Owned row is required');
  const reportPath = join(output, 'diagnostic.json');
  let server, result;
  try {
    // No external reference argument exists. This exact child generates and
    // retains it after reproducing the original strict Node mismatch.
    const referenceText = await createReplayPortabilityReference(id, row.recording.text);
    const reference = await exclusive(join(output, 'node-reference.json'), referenceText, 2 * MiB);
    await exclusive(
      join(output, 'reference-receipt.json'),
      {
        format: 'SoloOwnedReplayReferenceReceiptV1',
        recordId: id,
        node: process.version,
        nodeSourceRevision: fixture.nodeSourceRevision,
        originalMismatchReproduced: true,
        sourceChecks: 'exact47-before-and-after',
        recording: row.recording,
        reference,
      },
      32 * 1024,
    );
    assert(
      performance.now() - started < 120000,
      'Owned row exhausted during reference preparation',
    );
    const browserModule = resolve(process.env.SOLO_PLAYWRIGHT_MODULE);
    assert.equal(
      browserModule,
      join(
        resolve(process.env.RUNNER_TEMP),
        'solo-browser-tools/node_modules/playwright/index.mjs',
      ),
    );
    const browserPackage = JSON.parse(await readFile(join(dirname(browserModule), 'package.json')));
    assert.equal(browserPackage.name, 'playwright');
    assert.equal(browserPackage.version, '1.62.1');
    const preview = await startProductionPreview({ root: payload, port: 0 });
    server = preview.server;
    assert.equal(preview.mode, 'generated-build');
    const identityPath = join(payload, 'game/build-info.json');
    const identityBytes = await readFile(identityPath);
    assert(identityBytes.length <= 65536);
    assert.equal(JSON.parse(identityBytes).sourceRevision, row.sourceRevision);
    const remaining = Math.floor(120000 - (performance.now() - started));
    assert(remaining > 0, 'Owned row exhausted during reference preparation');
    const playwright = await import(browserModule);
    result = await diagnoseNativeReplayPortability({
      playwright,
      engine: row.engine,
      executablePath: row.engine === 'chromium' ? playwright.chromium.executablePath() : undefined,
      expected: {
        browserVersion: row.browserVersion,
        buildIdentity: {
          url: new URL('game/build-info.json', preview.url).href,
          sourceRevision: row.sourceRevision,
          sha256: hash(identityBytes),
        },
        csp: PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
      },
      observedBrowserClosed: true,
      recordingText: row.recording.text,
      portabilityDiagnostic: {
        format: 'SoloReplayPortabilityRequestV1',
        recordId: id,
        referenceText,
      },
      timeoutMs: remaining,
    });
  } catch (error) {
    result = {
      format: 'SoloReplayPortabilityCompanionV1',
      status: 'incomplete',
      recordId: id,
      strictVerdictChanged: false,
      failure: String(error.stack ?? error).slice(0, 4096),
    };
  } finally {
    if (server) {
      try {
        await new Promise((resolveClose, reject) => {
          server.close((error) => (error ? reject(error) : resolveClose()));
          server.closeAllConnections();
        });
      } catch (error) {
        result.status = 'incomplete';
        result.serverCleanupFailure = String(error).slice(0, 512);
      }
    }
    if (performance.now() - started >= 120000) {
      result.status = 'incomplete';
      result.failure =
        'Whole owned row exceeded120000ms, including reference preparation and cleanup';
    }
    await exclusive(reportPath, result, 512 * 1024);
  }
  process.exitCode = result.status === 'complete' ? 0 : 1;
}
async function run(output) {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.GITHUB_REPOSITORY, 'mekhovov/revealline');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  assert.equal(process.platform, 'linux');
  assert.equal(process.version, 'v22.13.1');
  output = resolve(output);
  const temporary = resolve(process.env.RUNNER_TEMP);
  assert(output.startsWith(temporary + '/'));
  assert.equal(await realpath(temporary), temporary);
  await mkdir(output);
  const evidence = join(output, 'evidence'),
    work = join(output, 'work');
  await mkdir(evidence);
  await mkdir(work);
  const plan = await json(planPath),
    { fixture } = await loadReplayPortabilityCase(IDS[0]);
  validatePortabilityPlan(plan, fixture);
  const summary = {
    format: 'SoloFixedReplayPortabilityCohortV1',
    status: 'failed',
    performanceExclusion: true,
    startedAt: new Date().toISOString(),
    rows: IDS.map((id) => ({ id, status: 'not-run' })),
    commands: [],
    sourceRun: fixture.sourceRun,
    sourceArtifact: fixture.sourceArtifact,
  };
  const stop = new AbortController();
  const terminate = () => stop.abort(new Error('Outer termination'));
  process.once('SIGTERM', terminate);
  process.once('SIGINT', terminate);
  const timer = setTimeout(() => stop.abort(new Error('Helper deadline')), plan.helperTimeoutMs);
  const cleanEnv = { ...process.env };
  delete cleanEnv.GH_TOKEN;
  let setupActive = true;
  const setupDeadline = Date.now() + 2400000;
  const inspect = async () => {
    assert(!setupActive || Date.now() < setupDeadline, 'Setup deadline');
    assert(!stop.signal.aborted, 'Stopped owner');
    const disk = await statfs(output);
    assert(disk.bavail * disk.bsize >= GiB, 'Remaining disk reserve');
    assert((await evidenceSize(evidence)) <= 256 * MiB - 4 * MiB, 'Evidence reserve');
  };
  const command = async (name, argv, timeoutMs, extraEnv = {}) => {
    const value = await ownedCommand(argv, {
      cwd: root,
      env: { ...cleanEnv, ...extraEnv },
      log: join(evidence, name + '.log'),
      receipt: join(evidence, name + '.command.json'),
      timeoutMs,
      rssBytes: 6 * GiB,
      outputBytes: 4 * MiB,
      inspect,
    });
    summary.commands.push({ name, ...value });
    requireCleanCommand(value);
    return value;
  };
  try {
    assert(totalmem() >= 12 * GiB);
    const initialDisk = await statfs(output);
    assert(initialDisk.bavail * initialDisk.bsize >= 8 * GiB);
    const before = await sourceProof();
    await exclusive(join(evidence, 'tooling-before.json'), before, 2 * MiB);
    const payloads = {};
    for (const role of ['candidate', 'baseline']) {
      const pin = role === 'baseline' ? plan.baseline.reusableArtifact : plan.candidate;
      const source = resolve(process.env['SOLO_' + role.toUpperCase() + '_SOURCE']);
      assert.equal(sourceGit(source, ['rev-parse', 'HEAD']).trim(), plan[role].revision);
      assert.equal(sourceGit(source, ['rev-parse', 'HEAD^{tree}']).trim(), plan[role].tree);
      assert.equal(
        sourceGit(source, ['status', '--porcelain', '--untracked-files=normal']),
        '',
        'Package source checkout must remain clean',
      );
      const outer = await fixedDownload(plan, role, work, evidence, inspect, stop.signal);
      const selected = join(work, role + '-selected'),
        archive = join(selected, 'distribution.zip');
      await command(
        role + '-outer',
        [
          'python3',
          '-B',
          join(here, 'solo-remote-archive.py'),
          role === 'baseline' ? 'baseline-outer' : 'outer',
          outer,
          selected,
          plan[role].revision,
          join(evidence, role + '-outer.json'),
        ],
        600000,
      );
      if (role === 'candidate') {
        const producer = (await json(join(evidence, 'candidate-outer.json'))).producer;
        assert.equal(producer.sourceTree, plan.candidate.tree);
        assert.equal(producer.node, 'v' + plan.node);
      }
      if (role === 'baseline') {
        const authority = await readBaselineBundle(selected, pin);
        await exclusive(
          join(evidence, 'baseline-authority.json'),
          {
            status: 'passed',
            ready: authority.readyIdentity,
            producer: authority.ready.producer,
          },
          MiB,
        );
      }
      assert.deepEqual(await digest(archive), pin.inner);
      const payload = join(work, role + '-payload');
      await command(
        role + '-inner',
        [
          'python3',
          '-B',
          join(here, 'solo-remote-archive.py'),
          'inner',
          archive,
          payload,
          plan[role].revision,
          join(evidence, role + '-archive.json'),
        ],
        600000,
      );
      await writeFile(archive + '.sha256', pin.inner.sha256 + '  distribution.zip\n', {
        flag: 'wx',
      });
      await command(
        role + '-source',
        [
          process.execPath,
          join(here, 'verify-solo-build.mjs'),
          payload,
          join(evidence, role + '-source.json'),
          '--source=' + source,
          '--base=' + plan[role].revision,
          '--archive=' + archive,
          '--archive-receipt=' + join(evidence, role + '-archive.json'),
        ],
        480000,
      );
      const proof = await json(join(evidence, role + '-source.json'));
      assert.equal(proof.status, 'passed');
      assert.equal(proof.source.wholeTreeRevision, plan[role].revision);
      assert.equal(proof.manifest.sha256, pin.manifestSHA256);
      const metadata = join(evidence, role + '-payload-metadata');
      await mkdir(metadata);
      for (const name of ['manifest.json', '_headers', 'game/build-info.json']) {
        const target = join(metadata, name);
        await mkdir(dirname(target), { recursive: true });
        const bytes = await readFile(join(payload, name));
        assert(bytes.length <= 2 * MiB);
        await exclusive(target, bytes, 2 * MiB);
      }
      payloads[role] = payload;
    }
    setupActive = false;
    const scratch = await mkdtemp(join(temporary, 'sc-'));
    const scratchOwner = await lstat(scratch);
    summary.scratchOwner = { path: scratch, device: scratchOwner.dev, inode: scratchOwner.ino };
    for (let index = 0; index < IDS.length; index++) {
      const id = IDS[index],
        role = id.startsWith('baseline-') ? 'baseline' : 'candidate';
      const rowOutput = join(evidence, id),
        rowScratch = scratchRowPath(scratch, index);
      await mkdir(rowOutput);
      await mkdir(rowScratch);
      // This is the single120-second owner: reference generation, both fresh
      // native contexts, source checks, retention and cleanup all occur inside.
      summary.rows[index].status = 'running';
      const owner = await command(
        id,
        [process.execPath, fileURLToPath(import.meta.url), 'row', id, payloads[role], rowOutput],
        120000,
        { TMPDIR: rowScratch, TMP: rowScratch, TEMP: rowScratch },
      );
      const result = await json(join(rowOutput, 'diagnostic.json'), 512 * 1024);
      assert.equal(result.status, 'complete');
      assert.equal(result.strictVerdictChanged, false);
      summary.rows[index] = {
        id,
        status: 'completed-diagnostic',
        owner,
        report: await digest(join(rowOutput, 'diagnostic.json')),
      };
    }
    for (const role of ['baseline', 'candidate']) {
      const source = resolve(process.env['SOLO_' + role.toUpperCase() + '_SOURCE']);
      assert.deepEqual(frozenSource(source), {
        sourceRevision: plan[role].revision,
        sourceTree: plan[role].tree,
      });
    }
    const after = await sourceProof();
    assert.deepEqual(after, before);
    await exclusive(join(evidence, 'tooling-after.json'), after, 2 * MiB);
    await inspect();
    summary.status = 'completed-diagnostic';
  } catch (error) {
    summary.failure = String(error.stack ?? error).slice(0, 8192);
    for (const row of summary.rows)
      if (row.status === 'running') {
        row.status = 'failed';
        row.failure = summary.failure;
      }
  } finally {
    if (stop.signal.aborted) {
      summary.status = 'failed';
      summary.failure ??= String(stop.signal.reason).slice(0, 8192);
    }
    clearTimeout(timer);
    process.removeListener('SIGTERM', terminate);
    process.removeListener('SIGINT', terminate);
    summary.completedAt = new Date().toISOString();
    await exclusive(join(evidence, 'summary.json'), summary, 2 * MiB);
    process.exitCode = summary.status === 'completed-diagnostic' ? 0 : 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'row') {
    assert.equal(process.argv.length, 6);
    await rowChild(process.argv[3], resolve(process.argv[4]), resolve(process.argv[5]));
  } else {
    assert.equal(process.argv[2], 'run');
    assert.equal(process.argv.length, 4);
    await run(process.argv[3]);
  }
}
