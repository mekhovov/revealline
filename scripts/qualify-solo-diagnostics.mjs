/* global crossOriginIsolated, navigator, location */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  analyzeDiagnostics,
  diagnosticsSchedule,
  DIAGNOSTICS_FORMAT,
} from './solo-diagnostics-analysis.mjs';

import { assessEmpiricalClockOverhead } from './solo-overhead-acceptance.mjs';

const observer = fileURLToPath(new URL('./observe-solo-performance.mjs', import.meta.url));
const observerLifecycle = new URL('./solo-observation-lifecycle.mjs', import.meta.url);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const usage = `Usage:
  PLAYWRIGHT_MODULE=<path> [CHROME_EXECUTABLE=<path>] node scripts/qualify-solo-diagnostics.mjs run <Solo URL> <new output directory> --source-revision=<40-hex> [--artifact-manifest=<JSON path>] [--artifact-sha256=<archive hash>] [--calibration=<JSON path>] [--pairs=10] [--seed=1544] [--duration=30000] [--browser=chromium] [--cpu=1] [--server-fixture-access | --fixture-access] [--warm] [--stationary] [--timeout=360000] [--note=<host conditions>]
  node scripts/qualify-solo-diagnostics.mjs analyze <output directory>
  PLAYWRIGHT_MODULE=<path> node scripts/qualify-solo-diagnostics.mjs timer-probe <Solo URL> <new report.json> --source-revision=<40-hex> [--browser=chromium]
Each arm launches the recorded observer revision once. Existing evidence directories are never reused.
Defaults: 20 runs, 10 minutes active, approximately 12–18 minutes including readiness.
Run only on a quiet host; no builds, other tests, profilers or memory collection.`;

export function diagnosticsArguments(address, directory, flags) {
  const values = new Map();
  const booleans = new Set(['fixture-access', 'server-fixture-access', 'warm', 'stationary']);
  const options = new Set([
    'source-revision',
    'artifact-manifest',
    'artifact-sha256',
    'calibration',
    'pairs',
    'seed',
    'duration',
    'browser',
    'cpu',
    'timeout',
    'note',
  ]);
  for (const flag of flags) {
    const match = /^--([\w-]+)(?:=(.*))?$/.exec(flag);
    if (
      !match ||
      values.has(match[1]) ||
      (!booleans.has(match[1]) && !options.has(match[1])) ||
      (booleans.has(match[1]) ? match[2] !== undefined : !match[2])
    )
      throw new Error(`Invalid or repeated option: ${flag}`);
    values.set(match[1], match[2] ?? true);
  }
  const url = new URL(address);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('Observation requires an HTTP(S) URL.');
  url.searchParams.delete('performance');
  const configuration = {
    address: url.href,
    directory: resolve(directory),
    sourceRevision: values.get('source-revision'),
    pairs: Number(values.get('pairs') ?? 10),
    seed: Number(values.get('seed') ?? 1544),
    durationMs: Number(values.get('duration') ?? 30000),
    browser: values.get('browser') ?? 'chromium',
    cpuRate: Number(values.get('cpu') ?? 1),
    timeoutMs: Number(values.get('timeout') ?? 360000),
    fixtureAccess: values.has('fixture-access'),
    serverFixtureAccess: values.has('server-fixture-access'),
    artifactManifest: values.has('artifact-manifest')
      ? resolve(values.get('artifact-manifest'))
      : null,
    declaredArtifactSha256: values.get('artifact-sha256') ?? null,
    calibration: values.has('calibration') ? resolve(values.get('calibration')) : null,
    profile: values.has('warm') ? 'fresh profile, second navigation' : 'fresh profile',
    inputs: values.has('stationary')
      ? 'stationary'
      : 'alternating left/right on revealed opening border, at least 250ms apart',
    note: values.get('note') ?? 'unspecified; operator must record host conditions',
  };
  diagnosticsSchedule(configuration.pairs, configuration.seed);
  if (
    configuration.declaredArtifactSha256 !== null &&
    !/^[\da-f]{64}$/i.test(configuration.declaredArtifactSha256)
  )
    throw new Error('Invalid declared artifact archive SHA256.');
  if (
    !/^[\da-f]{40}$/i.test(configuration.sourceRevision ?? '') ||
    !['chromium', 'webkit'].includes(configuration.browser) ||
    !Number.isFinite(configuration.durationMs) ||
    configuration.durationMs < 1000 ||
    configuration.durationMs > 60000 ||
    !Number.isFinite(configuration.cpuRate) ||
    configuration.cpuRate < 1 ||
    configuration.cpuRate > 20 ||
    (configuration.browser === 'webkit' && configuration.cpuRate !== 1) ||
    !Number.isFinite(configuration.timeoutMs) ||
    configuration.timeoutMs < configuration.durationMs + 10000 ||
    configuration.timeoutMs > 1200000
  )
    throw new Error('Invalid source, engine, duration, CPU rate or per-run timeout.');
  if (!values.has('stationary') && url.searchParams.get('journey') !== 'opening')
    throw new Error(
      'The border-input recipe requires journey=opening. Use --stationary for another route.',
    );
  if (configuration.fixtureAccess && configuration.serverFixtureAccess)
    throw new Error('Choose one access fixture owner.');
  if (
    (configuration.fixtureAccess || configuration.serverFixtureAccess) &&
    !['localhost', '127.0.0.1'].includes(url.hostname)
  )
    throw new Error('The access fixture is restricted to local test servers.');
  return configuration;
}

export function observerArguments(configuration, execution) {
  return [
    observer,
    configuration.address,
    join(configuration.directory, execution.report),
    '--runs=1',
    `--duration=${configuration.durationMs}`,
    `--browser=${configuration.browser}`,
    `--cpu=${configuration.cpuRate}`,
    '--work-probe',
    '--quality-probe',
    `--diagnostics=${Number(execution.diagnostics)}`,
    `--source-revision=${configuration.sourceRevision}`,
    `--note=${configuration.note}`,
    ...(configuration.fixtureAccess ? ['--fixture-access'] : []),
    ...(configuration.serverFixtureAccess ? ['--server-fixture-access'] : []),
    ...(configuration.profile.includes('second') ? ['--warm'] : []),
    ...(configuration.inputs !== 'stationary' ? ['--input-probe'] : []),
  ];
}

export async function timerResolution(configuration, signal) {
  let browser;
  const startedAt = new Date().toISOString();
  const cancel = () => {
    void browser?.close().catch(() => {});
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
    browser = await playwright[configuration.browser].launch({
      ...(configuration.browser === 'chromium'
        ? { executablePath: process.env.CHROME_EXECUTABLE }
        : {}),
      headless: true,
    });
    signal.throwIfAborted();
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(configuration.address, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const result = await page.evaluate(() => {
      const deadline = Date.now() + 100;
      let previous = performance.now(),
        minimum = Infinity,
        maximum = 0,
        positiveSteps = 0,
        iterations = 0;
      while (Date.now() < deadline && iterations++ < 1000000) {
        const now = performance.now(),
          step = now - previous;
        if (step > 0) {
          minimum = Math.min(minimum, step);
          maximum = Math.max(maximum, step);
          positiveSteps++;
        }
        previous = now;
      }
      return {
        minimumPositiveStepMs: Number.isFinite(minimum) ? minimum : null,
        maximumPositiveStepMs: maximum,
        positiveSteps,
        iterations,
        crossOriginIsolated,
        userAgent: navigator.userAgent,
        address: location.href,
      };
    });
    return {
      status: result.positiveSteps >= 20 ? 'observed' : 'unresolved',
      startedAt,
      browser: `${configuration.browser} ${browser.version()}`,
      ...result,
      scope:
        'Separate same-origin page before timing. Observed minimum positive step estimates precision; not a guarantee against privacy jitter or later clock-policy changes.',
    };
  } catch (error) {
    return { status: 'failed', startedAt, failure: String(error?.message ?? error) };
  } finally {
    signal.removeEventListener('abort', cancel);
    await browser?.close();
  }
}

// Signal the owned observer first; force-stop its process group if graceful
// cleanup hangs. Never search for or terminate unrelated test workers.
async function observe(configuration, execution, signal) {
  const log = await open(join(configuration.directory, execution.log), 'wx');
  let child,
    timeout,
    killTimeout,
    timedOut = false,
    interrupted = false,
    spawnError = null;
  const terminate = () => {
    if (!child?.pid) return;
    const kill = (kind) => {
      try {
        if (process.platform === 'win32') child.kill(kind);
        else process.kill(-child.pid, kind);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    };
    // Give the observer a chance to pause/export before terminating its browser.
    child.kill('SIGTERM');
    killTimeout ??= setTimeout(() => kill('SIGKILL'), 5000);
  };
  const cancel = () => {
    interrupted = true;
    terminate();
  };
  try {
    child = spawn(process.execPath, observerArguments(configuration, execution), {
      cwd: resolve(dirname(observer), '..'),
      env: process.env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', log.fd, log.fd],
    });
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) cancel();
    timeout = setTimeout(() => {
      timedOut = true;
      terminate();
    }, configuration.timeoutMs);
    const exit = await new Promise((resolveExit) => {
      child.once('error', (error) => {
        spawnError = String(error.message);
      });
      child.once('close', (exitCode, exitSignal) => resolveExit({ exitCode, signal: exitSignal }));
    });
    return {
      ...exit,
      status: timedOut
        ? 'timed-out'
        : interrupted
          ? 'interrupted'
          : spawnError
            ? 'spawn-failed'
            : 'complete',
      spawnError,
    };
  } finally {
    clearTimeout(timeout);
    clearTimeout(killTimeout);
    signal.removeEventListener('abort', cancel);
    await log.close();
  }
}

export async function analyzeDirectory(directory) {
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const reports = [];
  for (const execution of manifest.executions) {
    let report = null;
    try {
      const bytes = await readFile(join(directory, execution.report));
      if (
        execution.reportSha256 &&
        createHash('sha256').update(bytes).digest('hex') !== execution.reportSha256
      )
        execution.status = 'report-hash-mismatch';
      report = JSON.parse(bytes);
    } catch (error) {
      execution.readFailure = String(error.message);
    }
    reports.push(report);
  }
  return {
    ...analyzeDiagnostics(manifest, reports),
    analysisSourceSha256: sha256(
      await readFile(new URL('./solo-diagnostics-analysis.mjs', import.meta.url)),
    ),
    provenance: {
      sourceRevision: manifest.configuration.sourceRevision,
      declaredArtifactSha256: manifest.configuration.declaredArtifactSha256 ?? null,
      observerSha256: manifest.observerSha256,
      observerLifecycleSha256: manifest.observerLifecycleSha256,
      references: manifest.references ?? {},
      cpuQualification: manifest.cpuQualification ?? null,
    },
  };
}

async function main(args) {
  const [mode, address, directory, ...flags] = args;
  if (mode === 'timer-probe' && address && directory && process.env.PLAYWRIGHT_MODULE) {
    // Hosted callers own this child through the common process supervisor. The
    // probe runs before all active arms and never alters clock privacy policy.
    const output = resolve(directory);
    const configuration = diagnosticsArguments(address, dirname(output), flags);
    const controller = new AbortController();
    const interrupt = () => controller.abort();
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
      const result = await timerResolution(configuration, controller.signal);
      await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
      process.exitCode = result.status === 'observed' ? 0 : 1;
    } finally {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', interrupt);
    }
    return;
  }
  if (mode === 'analyze' && address && directory === undefined) {
    const report = assessEmpiricalClockOverhead(await analyzeDirectory(resolve(address)));
    const output = join(resolve(address), `analysis-${Date.now()}.json`);
    await writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
    console.log(
      JSON.stringify({
        status: report.status,
        conditionalStatus: report.conditionalStatus,
        qualificationAssessment: report.qualificationAssessment,
        output,
        reasons: report.reasons,
      }),
    );
    process.exitCode = report.status === 'pass' ? 0 : 1;
    return;
  }
  if (mode !== 'run' || !address || !directory || !process.env.PLAYWRIGHT_MODULE)
    throw new Error(usage);
  const configuration = diagnosticsArguments(address, directory, flags);
  await mkdir(dirname(configuration.directory), { recursive: true });
  await mkdir(configuration.directory); // EEXIST deliberately refuses to overwrite evidence.
  const manifest = {
    format: DIAGNOSTICS_FORMAT,
    createdAt: new Date().toISOString(),
    configuration,
    node: process.version,
    observerSha256: createHash('sha256')
      .update(await readFile(observer))
      .digest('hex'),
    observerLifecycleSha256: sha256(await readFile(observerLifecycle)),
    timerResolution: null,
    references: {},
    cpuQualification:
      configuration.cpuRate === 1
        ? 'Unthrottled desktop; any attached calibration is context only and was not applied.'
        : 'Requested desktop stress factor. An attached calibration is provenance, not automatic proof that this rate is verified or device-equivalent.',
    executions: diagnosticsSchedule(configuration.pairs, configuration.seed).map((row) => ({
      ...row,
      report: `${String(row.order).padStart(2, '0')}-pair-${row.pair}-${row.diagnostics ? 'on' : 'off'}.json`,
      log: `${String(row.order).padStart(2, '0')}-pair-${row.pair}-${row.diagnostics ? 'on' : 'off'}.log`,
      status: 'not-observed',
    })),
  };
  for (const [key, path] of [
    ['artifactManifest', configuration.artifactManifest],
    ['calibration', configuration.calibration],
  ]) {
    if (!path) continue;
    const bytes = await readFile(path);
    const reference = JSON.parse(bytes.toString());
    if (key === 'artifactManifest' && reference.sourceRevision !== configuration.sourceRevision)
      throw new Error('Artifact manifest does not match the declared source revision.');
    const copiedFile = `${key}.json`;
    await writeFile(join(configuration.directory, copiedFile), bytes, { flag: 'wx' });
    manifest.references[key] = {
      originalPath: path,
      copiedFile,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      ...(key === 'artifactManifest'
        ? { sourceRevision: reference.sourceRevision, version: reference.version }
        : {}),
      scope:
        'Caller-supplied provenance copied byte-for-byte; no assertion that a remote server serves these bytes.',
    };
  }
  const persist = async (event) => {
    await appendFile(
      join(configuration.directory, 'events.jsonl'),
      JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n',
    );
    await writeFile(
      join(configuration.directory, 'manifest.json.tmp'),
      JSON.stringify(manifest, null, 2),
    );
    await rename(
      join(configuration.directory, 'manifest.json.tmp'),
      join(configuration.directory, 'manifest.json'),
    );
  };
  await persist({ kind: 'planned', executions: manifest.executions });
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    manifest.timerResolution = await timerResolution(configuration, controller.signal);
    await persist({ kind: 'timer-resolution', result: manifest.timerResolution });
    for (const execution of manifest.executions) {
      if (controller.signal.aborted) break;
      if (
        sha256(await readFile(observer)) !== manifest.observerSha256 ||
        sha256(await readFile(observerLifecycle)) !== manifest.observerLifecycleSha256
      ) {
        execution.status = 'harness-changed';
        await persist({ kind: 'harness-changed', execution });
        break;
      }
      execution.status = 'running';
      execution.startedAt = new Date().toISOString();
      await persist({ kind: 'start', execution });
      Object.assign(execution, await observe(configuration, execution, controller.signal), {
        endedAt: new Date().toISOString(),
      });
      try {
        execution.reportSha256 = createHash('sha256')
          .update(await readFile(join(configuration.directory, execution.report)))
          .digest('hex');
      } catch (error) {
        execution.reportFailure = String(error.message);
      }
      await persist({ kind: 'finish', execution });
      console.log(
        JSON.stringify({
          order: execution.order,
          pair: execution.pair,
          diagnostics: execution.diagnostics,
          status: execution.status,
          exitCode: execution.exitCode,
        }),
      );
    }
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);
    manifest.finishedAt = new Date().toISOString();
    await persist({ kind: controller.signal.aborted ? 'interrupted' : 'finished' });
    const analysis = assessEmpiricalClockOverhead(await analyzeDirectory(configuration.directory));
    await writeFile(
      join(configuration.directory, 'analysis.json'),
      JSON.stringify(analysis, null, 2),
      { flag: 'wx' },
    );
    console.log(
      JSON.stringify({
        status: analysis.status,
        conditionalStatus: analysis.conditionalStatus,
        qualificationAssessment: analysis.qualificationAssessment,
        pairs: analysis.completePairs,
        reasons: analysis.reasons,
      }),
    );
    process.exitCode = analysis.status === 'pass' ? 0 : 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url)
  await main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
