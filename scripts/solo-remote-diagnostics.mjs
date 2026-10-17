// Hosted app-diagnostics overhead only. No hitch journal, profiler or game mutation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, open, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  analyzeDiagnostics,
  diagnosticsSchedule,
  DIAGNOSTICS_FORMAT,
} from './solo-diagnostics-analysis.mjs';
import { diagnosticsArguments, observerArguments } from './qualify-solo-diagnostics.mjs';

const MiB = 1024 ** 2;
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const DIAGNOSTICS_SOURCE = 'cce49c81d82b79aefc24898f32eeebc609e569fb';
const SOURCE_TREE = '71f7e4cb3b0a39c1d281635774371a693794dd22';
const FORMAT = 'SoloHostedDiagnosticsPlanV1';
const engines = ['chromium', 'webkit'];
const requiredTools = [
  'scripts/run-solo-remote-correctness.mjs',
  'scripts/qualify-solo-diagnostics.mjs',
  'scripts/solo-diagnostics-analysis.mjs',
  'scripts/observe-solo-performance.mjs',
  'scripts/solo-observation-lifecycle.mjs',
  'scripts/serve-production-preview.mjs',
  'scripts/game-cli.mjs',
  'scripts/solo-remote-archive.py',
  'scripts/verify-solo-build.mjs',
];
const references = (plan) => [...plan.adapterInputs, ...plan.frozenTools];
const rowDefinition = (engine) => ({
  id: `diagnostics-${engine}-candidate`,
  kind: 'app-diagnostics-overhead',
  source: 'candidate',
  engine,
  timeoutMs: 1800000,
  performanceExclusion: true,
});

export function validateDiagnosticsPlan(plan) {
  assert.equal(plan.format, FORMAT);
  assert.equal(plan.status, 'reviewed-app-diagnostics-only');
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.candidate.revision, DIAGNOSTICS_SOURCE);
  assert.equal(plan.candidate.tree, SOURCE_TREE);
  assert.equal(plan.baseline.revision, '8b01991942dc764b8aa4726851699ce1985e53ae');
  assert.equal(plan.baseline.tree, '9373b6a74aea8fa1ef47aa17ace140b4cf714609');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert(engines.includes(plan.engine));
  assert.equal(plan.performanceExclusion, true);
  assert.equal(plan.automaticRetries, 0);
  assert.equal(plan.automaticPhaseContinuation, false);
  assert.equal(plan.maxParallel, 1);
  assert.equal(plan.setupTimeoutMs, 40 * 60000);
  assert.equal(plan.helperTimeoutMs, 85 * 60000);
  assert.equal(plan.evidenceBytes, 512 * MiB);
  assert.equal(plan.rowEvidenceBytes, 128 * MiB);
  assert.deepEqual(plan.rows, [rowDefinition(plan.engine)]);
  assert.deepEqual(plan.observation, {
    pairs: 10,
    seed: 1544,
    activeMs: 30000,
    armTimeoutMs: 360000,
    timerTimeoutMs: 180000,
    cpuRate: 1,
    reportBytes: 4 * MiB,
    timerBytes: MiB,
    analysisBytes: 16 * MiB,
    overheadLimit: 0.05,
    profile: 'fresh profile',
    fixtureAccess: 'server',
    hitchJournal: false,
    cpuProfile: false,
    heap: false,
    screenshots: false,
    crossOriginIsolationOverride: false,
  });
  assert.equal(plan.release.scope, 'app-diagnostics-overhead-only');
  assert.equal(plan.release.candidateRevision, DIAGNOSTICS_SOURCE);
  assert.equal(plan.release.onceOnlyBefore, DIAGNOSTICS_SOURCE);
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.release.gameplayPerformanceQualification, false);
  assert.equal(plan.release.hitchJournalOverheadQualification, false);
  for (const key of ['priorProofInspected', 'noUnclosedOwners', 'allPriorPlannedJobsClosed'])
    assert.equal(plan.release[key], true);
  assert.deepEqual(
    plan.adapterInputs.map(({ path }) => path),
    ['scripts/solo-remote-diagnostics.mjs'],
  );
  assert(plan.frozenTools.length >= requiredTools.length && plan.frozenTools.length <= 64);
  for (const path of requiredTools) assert(plan.frozenTools.some((ref) => ref.path === path));
  const refs = references(plan);
  assert.equal(new Set(refs.map(({ path }) => path)).size, refs.length);
  for (const ref of refs) {
    assert(/^scripts\/[a-zA-Z0-9_./-]+$/.test(ref.path) && !ref.path.split('/').includes('..'));
    assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0 && ref.bytes < MiB);
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
  }
  return plan;
}

export function bindDiagnosticsJob(manifest, engine) {
  assert.equal(manifest.format, 'SoloHostedDiagnosticsManifestV1');
  return validateDiagnosticsPlan({
    ...structuredClone(manifest),
    format: FORMAT,
    engine,
    rows: [rowDefinition(engine)],
  });
}
export function diagnosticsMatrix(manifest) {
  return {
    include: engines.map((engine) => {
      bindDiagnosticsJob(manifest, engine);
      return { engine, jobMinutes: 130, stepMinutes: 88, outerSeconds: 5220 };
    }),
  };
}

async function verifyInputs(ctx) {
  for (const ref of references(ctx.plan)) {
    const path = resolve(ctx.repository, ref.path);
    assert(path.startsWith(ctx.repository + '/'));
    assert.equal(await realpath(path), path);
    const info = await lstat(path);
    assert(info.isFile() && !info.isSymbolicLink());
    assert.deepEqual(await ctx.digest(path), { bytes: ref.bytes, sha256: ref.sha256 });
  }
}

// Bound the first read before allocating, check the opened inode, then read back
// the exact bytes after close. Native children are already closed at this point.
export async function diagnosticsReadback(path, maximumBytes) {
  assert(Number.isSafeInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= 16 * MiB);
  const info = await lstat(path);
  assert(info.isFile() && !info.isSymbolicLink() && info.size > 0 && info.size <= maximumBytes);
  assert.equal(await realpath(path), resolve(path));
  const file = await open(path, 'r');
  let bytes;
  try {
    const opened = await file.stat();
    assert.equal(opened.dev, info.dev);
    assert.equal(opened.ino, info.ino);
    bytes = Buffer.alloc(info.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = await file.read(bytes, count, bytes.length - count, null);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    assert.equal(count, info.size, 'Closed report changed size');
    bytes = bytes.subarray(0, count);
  } finally {
    await file.close();
  }
  // A second bounded read proves the retained binary identity, not reserialized JSON.
  const readback = await open(path, 'r');
  try {
    const current = await readback.stat();
    assert.equal(current.dev, info.dev);
    assert.equal(current.ino, info.ino);
    assert.equal(current.size, bytes.length);
    const copy = Buffer.alloc(bytes.length + 1);
    let count = 0;
    while (count < copy.length) {
      const read = await readback.read(copy, count, copy.length - count, null);
      if (!read.bytesRead) break;
      count += read.bytesRead;
    }
    assert.equal(count, bytes.length);
    assert(copy.subarray(0, count).equals(bytes), 'Closed report binary readback mismatch');
  } finally {
    await readback.close();
  }
  return { value: JSON.parse(bytes), identity: { bytes: bytes.length, sha256: sha(bytes) } };
}

export function diagnosticsOwnerClosed(command) {
  return (
    command?.status === 'closed' &&
    command.exitCode === 0 &&
    !command.signal &&
    !command.forcedCleanup &&
    !command.cleanupUnconfirmed &&
    !command.violation &&
    Array.isArray(command.survivors) &&
    command.survivors.length === 0 &&
    Array.isArray(command.ambiguous) &&
    command.ambiguous.length === 0
  );
}

export async function prepareDiagnosticsMode(ctx) {
  validateDiagnosticsPlan(ctx.plan);
  await verifyInputs(ctx);
  assert.equal(ctx.admitted.status, 'passed');
  const admitted = ctx.admitted.artifacts.candidate;
  assert.equal(admitted.sourceRevision, DIAGNOSTICS_SOURCE);
  assert.equal(admitted.sourceTree, SOURCE_TREE);
  assert.equal(admitted.manifestSHA256, ctx.plan.candidate.manifestSHA256);
  assert.deepEqual(admitted.archiveIdentity, ctx.plan.candidate.inner);
  Object.assign(ctx.report, {
    appDiagnosticsOverhead: 'unobserved',
    hitchJournalOverhead: 'not-measured',
    gameplayPerformanceQualification: false,
    firstEightAllCorrectnessPassed: false,
  });
  return { browserVersion: null };
}

export function diagnosticsConfiguration(ctx, url, dir) {
  return diagnosticsArguments(url, dir, [
    `--source-revision=${DIAGNOSTICS_SOURCE}`,
    `--artifact-sha256=${ctx.plan.candidate.inner.sha256}`,
    `--browser=${ctx.plan.engine}`,
    '--pairs=10',
    '--seed=1544',
    '--duration=30000',
    '--cpu=1',
    '--timeout=360000',
    '--server-fixture-access',
    '--note=isolated hosted app-diagnostics overhead; native owner/resource supervisor included; no journal/profile/heap',
  ]);
}

const save = async (path, value) => {
  await writeFile(path + '.tmp', JSON.stringify(value, null, 2) + '\n');
  await rename(path + '.tmp', path);
};
const reason = (error) => String(error?.message ?? error).slice(0, 4096);

// The fixed inventory is written before any native child. Every native child
// has its own common ownership receipt; no PID-only nested supervisor is used.
export async function runDiagnosticsCohort(ctx, row, dir, tmp, url, now = () => performance.now()) {
  const configuration = diagnosticsConfiguration(ctx, url, dir);
  const manifest = {
    format: DIAGNOSTICS_FORMAT,
    createdAt: new Date().toISOString(),
    configuration,
    node: process.version,
    timerResolution: null,
    observerSha256: ctx.plan.frozenTools.find((ref) =>
      ref.path.endsWith('/observe-solo-performance.mjs'),
    ).sha256,
    observerLifecycleSha256: ctx.plan.frozenTools.find((ref) =>
      ref.path.endsWith('/solo-observation-lifecycle.mjs'),
    ).sha256,
    executions: diagnosticsSchedule(10, 1544).map((entry) => ({
      ...entry,
      report: `arm-${String(entry.order).padStart(2, '0')}.json`,
      log: `arm-${String(entry.order).padStart(2, '0')}.log`,
      status: 'not-observed',
    })),
  };
  const reports = Array(20).fill(null);
  const deadline = now() + row.timeoutMs;
  const persist = () => save(join(dir, 'manifest.json'), manifest);
  const inspect = async () => {
    assert(now() < deadline, 'Diagnostics cohort deadline');
    await ctx.inspect();
    assert(
      (await ctx.evidenceSize(dir)) <= ctx.plan.rowEvidenceBytes,
      'Diagnostics row evidence cap',
    );
  };
  const command = async (id, argv, timeoutMs, log, receipt) => {
    await inspect();
    return ctx.run(
      id,
      [process.execPath, ...argv],
      Math.min(timeoutMs, Math.floor(deadline - now())),
      {
        env: { ...ctx.cleanEnv, TMPDIR: tmp },
        log: join(dir, log),
        receipt: join(dir, receipt),
        inspect,
      },
    );
  };
  await persist();
  try {
    row.timerCommand = await command(
      `${row.id}-timer`,
      [
        join(ctx.here, 'qualify-solo-diagnostics.mjs'),
        'timer-probe',
        url,
        join(dir, 'timer.json'),
        `--source-revision=${DIAGNOSTICS_SOURCE}`,
        `--browser=${row.engine}`,
      ],
      ctx.plan.observation.timerTimeoutMs,
      'timer.log',
      'timer.command.json',
    );
    const timer = await diagnosticsReadback(
      join(dir, 'timer.json'),
      ctx.plan.observation.timerBytes,
    );
    row.timerReadback = timer.identity;
    manifest.timerResolution = timer.value;
    await persist();
    assert(diagnosticsOwnerClosed(row.timerCommand), 'Timer child did not close cleanly');
    assert.equal(timer.value.status, 'observed');
    assert.equal(timer.value.address, url);
    assert.equal(
      timer.value.crossOriginIsolated,
      false,
      'Normal non-isolated clock policy required',
    );
    assert.equal(typeof timer.value.userAgent, 'string');
    assert(timer.value.browser.startsWith(`${row.engine} `));
    assert(
      Number.isFinite(timer.value.minimumPositiveStepMs) && timer.value.minimumPositiveStepMs > 0,
    );
    assert(timer.value.positiveSteps >= 20);
    ctx.modeState.browserVersion = timer.value.browser;
    for (const execution of manifest.executions) {
      await inspect();
      await verifyInputs(ctx);
      execution.status = 'running';
      execution.startedAt = new Date().toISOString();
      await persist();
      try {
        execution.command = await command(
          `${row.id}-arm-${execution.order}`,
          observerArguments(configuration, execution),
          ctx.plan.observation.armTimeoutMs,
          execution.log,
          `arm-${execution.order}.command.json`,
        );
        execution.exitCode = execution.command.exitCode;
        execution.signal = execution.command.signal ?? null;
        execution.status = diagnosticsOwnerClosed(execution.command) ? 'complete' : 'failed';
        const readback = await diagnosticsReadback(
          join(dir, execution.report),
          ctx.plan.observation.reportBytes,
        );
        execution.reportIdentity = readback.identity;
        execution.reportSha256 = readback.identity.sha256;
        reports[execution.order] = readback.value;
        const raw = readback.value?.[0];
        assert.equal(
          raw?.browser,
          ctx.modeState.browserVersion,
          'Native browser changed across arms',
        );
      } catch (error) {
        execution.status = 'failed';
        execution.failure = reason(error);
      } finally {
        execution.endedAt = new Date().toISOString();
        await persist();
      }
      // Failed observations remain in the analysis. A missing/unsafe owner
      // receipt stops admission, including when ctx.run itself rejected it.
      assert(
        execution.command &&
          !execution.command.cleanupUnconfirmed &&
          execution.command.survivors?.length === 0 &&
          execution.command.ambiguous?.length === 0,
        'Unclosed or missing arm owner; remaining observations withheld',
      );
    }
  } catch (error) {
    row.cohortFailure = reason(error);
  } finally {
    manifest.finishedAt = new Date().toISOString();
    manifest.failure = row.cohortFailure ?? null;
    await persist();
    const analysis = {
      ...analyzeDiagnostics(manifest, reports),
      provenance: {
        sourceRevision: DIAGNOSTICS_SOURCE,
        artifactAdmission: row.artifactAdmission,
        served: row.served,
        frozenTools: ctx.plan.frozenTools,
      },
      scope:
        'App diagnostics overhead only. Hitch-journal, gameplay performance, physical devices and thermal conditions are not measured.',
    };
    await writeFile(join(dir, 'analysis.json'), JSON.stringify(analysis, null, 2) + '\n', {
      flag: 'wx',
    });
    const readback = await diagnosticsReadback(
      join(dir, 'analysis.json'),
      ctx.plan.observation.analysisBytes,
    );
    row.analysisReadback = readback.identity;
    row.appDiagnosticsOverhead = analysis.status;
    row.hitchJournalOverhead = 'not-measured';
    row.plannedPairs = analysis.plannedPairs;
    row.completePairs = analysis.completePairs;
    row.analysisReasons = analysis.reasons;
    row.status = !row.cohortFailure && analysis.status === 'pass' ? 'passed' : 'failed';
    ctx.report.appDiagnosticsOverhead = row.appDiagnosticsOverhead;
  }
}

export async function runDiagnosticsRow(ctx, row, dir, tmp) {
  await verifyInputs(ctx);
  const { startProductionPreview } = await import(
    pathToFileURL(join(ctx.here, 'serve-production-preview.mjs')).href
  );
  const { PUBLIC_SECURITY_HEADERS } = await import(
    pathToFileURL(join(ctx.here, 'game-cli.mjs')).href
  );
  let server;
  try {
    server = await startProductionPreview({
      root: ctx.payloads.candidate,
      port: 0,
      fixtureAccess: true,
      cache: 'policy',
    });
    const response = await fetch(new URL('game/build-info.json', server.url), {
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(response.status, 200);
    for (const [key, value] of Object.entries(PUBLIC_SECURITY_HEADERS))
      assert.equal(response.headers.get(key), value);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length < MiB);
    const build = JSON.parse(bytes);
    assert.equal(build.sourceRevision, DIAGNOSTICS_SOURCE);
    const url = new URL('game/?journey=opening', server.url).href;
    row.served = {
      url,
      build,
      buildInfoSHA256: sha(bytes),
      headers: server.headers,
      mode: server.mode,
      fixtureAccess: server.fixtureAccess,
    };
    row.artifactAdmission = ctx.admitted.artifacts.candidate;
    await runDiagnosticsCohort(ctx, row, dir, tmp, url);
    await verifyInputs(ctx);
  } finally {
    if (server) {
      let timer;
      try {
        await Promise.race([
          new Promise((yes, no) => {
            server.server.close((error) => (error ? no(error) : yes()));
            server.server.closeAllConnections();
          }),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(Error('Diagnostics preview close deadline')), 10000);
          }),
        ]);
      } catch (error) {
        row.serverCleanupFailure = reason(error);
        row.status = 'failed';
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, input, output, engine] = process.argv.slice(2);
  const bytes = await readFile(input);
  const manifest = JSON.parse(bytes);
  if (mode === 'matrix-plan')
    process.stdout.write(`matrix=${JSON.stringify(diagnosticsMatrix(manifest))}\n`);
  else {
    assert.equal(mode, 'bind-plan');
    const plan = bindDiagnosticsJob(manifest, engine);
    plan.manifestInput = { path: resolve(input), bytes: bytes.length, sha256: sha(bytes) };
    await writeFile(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  }
}
