import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { readFile, writeFile, access } from 'node:fs/promises';
import { createServer } from 'node:http';
import { arch, cpus, platform, release } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  compareAdvancedRuntimes,
  runAdvancedDeterminismQualification,
  runAdvancedTimingQualification,
} from '../game/test/helpers/fpv-advanced-qualification.mjs';

import {
  runAdvancedRegionalQualification,
  compareRegionalRuntimes,
} from '../game/test/helpers/fpv-advanced-regional-qualification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helperPath = '/game/test/helpers/fpv-advanced-qualification.mjs';
const execute = promisify(execFile);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = async (filename) =>
  access(filename).then(
    () => true,
    () => false,
  );

export async function advancedQualificationSources() {
  const pending = [
      helperPath.slice(1),
      'optional-practice/civilian-fpv/advanced-worker.mjs',
      'scripts/qualify-fpv-advanced.mjs',
    ],
    visited = new Map();
  while (pending.length) {
    const name = pending.shift();
    if (visited.has(name)) continue;
    const bytes = await readFile(path.join(root, name));
    visited.set(name, {
      path: name,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    });
    for (const match of bytes
      .toString()
      .matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[1] ?? match[2];
      if (specifier.startsWith('.'))
        pending.push(path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier)));
    }
  }
  return [...visited.values()].sort((a, b) => a.path.localeCompare(b.path));
}
async function nodeQualification() {
  return {
    runtime: 'node',
    version: process.version,
    architecture: arch(),
    determinism: await runAdvancedDeterminismQualification(),
    regional: await runAdvancedRegionalQualification(),
    timing: await runAdvancedTimingQualification(),
  };
}
async function browserEvaluation() {
  const fixtures = await import('/game/test/helpers/fpv-advanced-qualification.mjs');
  const regional = await import('/game/test/helpers/fpv-advanced-regional-qualification.mjs');
  return {
    userAgent: navigator.userAgent,
    logicalProcessors: navigator.hardwareConcurrency ?? null,
    determinism: await fixtures.runAdvancedDeterminismQualification(),
    timing: await fixtures.runAdvancedTimingQualification(),
    worker: await fixtures.runAdvancedWorkerQualification(),
    regional: await regional.runAdvancedRegionalQualification(),
    regionalWorker: await regional.runAdvancedRegionalWorkerQualification(),
  };
}
function annotateResult(result, reference) {
  const baseline = reference.determinism;
  const agreement = compareAdvancedRuntimes(baseline, result.determinism);
  const regionalAgreement = compareRegionalRuntimes(reference.regional, result.regional);
  const regionalWorkerMatches = result.regionalWorker
    ? [
        'simulationIdentity',
        'terrainIdentity',
        'finalHash',
        'periodicHashes',
        'consumedInputs',
        'finalTelemetry',
      ].every(
        (key) =>
          JSON.stringify(result.regionalWorker[key]) === JSON.stringify(reference.regional[key]),
      )
    : null;
  const workerMatches = result.worker
    ? result.worker.identity === baseline.identity &&
      result.worker.finalHash === baseline.finalHash &&
      JSON.stringify(result.worker.consumedInputs) === JSON.stringify(baseline.consumedInputs) &&
      JSON.stringify(result.worker.finalTelemetry) === JSON.stringify(baseline.finalTelemetry) &&
      JSON.stringify(result.worker.periodicHashes) ===
        JSON.stringify(
          baseline.hashes
            .filter(([tick]) => tick % 50 === 0)
            .map(([tick, hash]) => [(tick * baseline.frequency) / 50, hash]),
        )
    : null;
  return {
    ...result,
    status: 'measured',
    agreement,
    workerMatches,
    regionalAgreement,
    regionalWorkerMatches,
  };
}
async function makeServer(sources) {
  const allowed = new Set(sources.map((source) => `/${source.path}`));
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/qualification.html') {
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        response.end(
          '<!doctype html><title>Advanced flight qualification</title><p>Local numeric and worker qualification. No scored flight.</p>',
        );
      } else if (allowed.has(pathname)) {
        response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
        response.end(await readFile(path.join(root, pathname.slice(1))));
      } else {
        response.writeHead(404);
        response.end();
      }
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/qualification.html` };
}
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function safariQualification(driverPath, url) {
  if (!(await exists(driverPath)))
    throw new Error('Safari driver is not installed; no installation attempted.');
  const port = await freePort();
  const child = spawn(driverPath, ['--port', String(port)], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '',
    session;
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk).slice(-4000);
  });
  const request = async (pathname, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
      method,
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
      signal: AbortSignal.timeout(60000),
    });
    const result = await response.json();
    if (!response.ok || result.value?.error)
      throw new Error(result.value?.message ?? `WebDriver HTTP ${response.status}`);
    return result.value;
  };
  try {
    let ready = false;
    for (let retry = 0; retry < 40 && child.exitCode === null; retry++) {
      try {
        await request('/status');
        ready = true;
        break;
      } catch {
        await wait(100);
      }
    }
    if (!ready) throw new Error(stderr || 'Existing Safari driver did not start');
    const result = await request('/session', {
      capabilities: { alwaysMatch: { browserName: 'safari' } },
    });
    session = result.sessionId;
    await request(`/session/${session}/timeouts`, { script: 60000 });
    await request(`/session/${session}/url`, { url });
    const outcome = await request(`/session/${session}/execute/async`, {
      script: `const done = arguments[arguments.length - 1]; (${browserEvaluation.toString()})().then(value => done({ value }), error => done({ error: String(error.stack || error) }));`,
      args: [],
    });
    if (outcome.error) throw new Error(outcome.error);
    return {
      runtime: 'safari',
      version: result.capabilities?.browserVersion ?? null,
      ...outcome.value,
    };
  } finally {
    if (session) await request(`/session/${session}`, undefined, 'DELETE').catch(() => {});
    child.kill('SIGTERM');
  }
}

/** Uses explicitly supplied, already installed browser tools. Never downloads
 * engines or enables Safari Remote Automation as a side effect. */
export async function qualifyAdvanced({
  playwrightModule,
  nodeRuntimes = [],
  safariDriver,
  output,
} = {}) {
  const sources = await advancedQualificationSources();
  const baseline = await nodeQualification();
  const results = [annotateResult(baseline, baseline)];
  for (const executable of nodeRuntimes) {
    try {
      const { stdout } = await execute(
        executable,
        [fileURLToPath(import.meta.url), '--node-only'],
        { timeout: 60000, maxBuffer: 2 * 1024 * 1024 },
      );
      results.push(annotateResult(JSON.parse(stdout), baseline));
    } catch (error) {
      results.push({
        runtime: 'node',
        executable,
        status: error.code === 'ENOENT' ? 'unavailable' : 'failed',
        reason: error.message,
      });
    }
  }
  const { server, url } = await makeServer(sources);
  try {
    if (playwrightModule) {
      const playwright = await import(pathToFileURL(path.resolve(playwrightModule)).href);
      for (const name of ['chromium', 'firefox', 'webkit']) {
        let browser;
        try {
          if (name !== 'chromium' && !(await exists(playwright[name].executablePath()))) {
            results.push({
              runtime: name,
              status: 'unavailable',
              reason: 'Browser engine is not installed; no download attempted.',
            });
            continue;
          }
          browser = await playwright[name].launch({
            headless: true,
            ...(name === 'chromium' ? { channel: 'chrome' } : {}),
          });
          const page = await browser.newPage();
          await page.goto(url);
          const result = await page.evaluate(browserEvaluation);
          results.push(
            annotateResult({ runtime: name, version: browser.version(), ...result }, baseline),
          );
        } catch (error) {
          results.push({ runtime: name, status: 'failed', reason: error.message.slice(0, 4000) });
        } finally {
          await browser?.close();
        }
      }
    }
    if (safariDriver) {
      try {
        results.push(annotateResult(await safariQualification(safariDriver, url), baseline));
      } catch (error) {
        results.push({
          runtime: 'safari',
          status: 'unavailable',
          reason: error.message.slice(0, 4000),
        });
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const after = await advancedQualificationSources();
  const measured = results.filter((result) => result.status === 'measured');
  const report = {
    format: 'AdvancedRuntimeQualification.v1',
    createdAt: new Date().toISOString(),
    machine: {
      platform: platform(),
      osRelease: release(),
      architecture: arch(),
      cpu: cpus()[0]?.model ?? null,
      logicalProcessors: cpus().length,
    },
    sources,
    sourceStable: JSON.stringify(sources) === JSON.stringify(after),
    scenario:
      'Identical four-second mixed-axis flight with noise/vibration and 40 m/s thin-wall collision; full replay, verified partial recovery, reset/rerun, snapshot continuation and rejected terrain rollback. Browser tests use the production module worker, wall-clock pause and interrupted-worker recovery. A separate Regional flight streams verified-shape frames, rejects a staged frame and mission, lands, takes off, replays across frame/hash boundaries and recovers after worker termination. Three warmed repetitions of three-axis 100 deg/s step responses at 250/500/1000 Hz against coupled 2000 Hz reference.',
    results,
    measuredDeterminismPass: measured.every(
      (result) =>
        result.agreement.matched &&
        result.workerMatches !== false &&
        result.regionalAgreement.matched &&
        result.regionalWorkerMatches !== false,
    ),
    attemptedRuntimesExecuted: results.every((result) => result.status !== 'failed'),
    measuredTimingPass: measured.every((result) => {
      const frozen = result.timing.candidates.find(
        (candidate) => candidate.frequency === result.timing.frozenExperimentalDefaultHz,
      );
      return (
        frozen?.accuracyPass && frozen.contactsPass && frozen.capacityPass && frozen.repetitionPass
      );
    }),
    fullPlatformMatrixQualified: false,
    scoredEligible: false,
    defaultEligible: false,
    limitations: [
      'All measured engines run on one physical ARM64 host; x64 Node, when included, uses Rosetta emulation and is not physical Intel or low-end-device qualification.',
      'Headless browser timing excludes renderer, production world streaming, native wrappers and physical USB sampling.',
      'Numerical reference is the same independent model at 2 kHz, not a measured real aircraft.',
      'Uninstalled or unavailable engines are explicitly unmeasured, not passing.',
      'Production Regional admission, offline/native lifecycle and experienced-pilot review require separate evidence.',
    ],
  };
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if (process.argv.includes('--node-only'))
    process.stdout.write(`${JSON.stringify(await nodeQualification())}\n`);
  else {
    const args = process.argv.slice(2),
      options = { nodeRuntimes: [] };
    while (args.length) {
      const flag = args.shift(),
        value = args.shift();
      if (!value) throw new Error(`${flag} requires a value`);
      if (flag === '--playwright') options.playwrightModule = value;
      else if (flag === '--node-runtime') options.nodeRuntimes.push(value);
      else if (flag === '--safari-driver') options.safariDriver = value;
      else if (flag === '--write') options.output = value;
      else throw new Error(`Unknown option ${flag}`);
    }
    const report = await qualifyAdvanced(options);
    process.stdout.write(
      `${JSON.stringify({ sourceStable: report.sourceStable, measuredDeterminismPass: report.measuredDeterminismPass, measuredTimingPass: report.measuredTimingPass, results: report.results.map(({ runtime, version, status, agreement, workerMatches, regionalAgreement, regionalWorkerMatches, timing, reason }) => ({ runtime, version, status, agreement, workerMatches, regionalAgreement, regionalWorkerMatches, selectedHzOnThisRuntime: timing?.selectedHzOnThisRuntime, reason })), output: options.output }, null, 2)}\n`,
    );
    if (
      !report.sourceStable ||
      !report.measuredDeterminismPass ||
      !report.attemptedRuntimesExecuted ||
      !report.measuredTimingPass
    )
      process.exitCode = 1;
  }
}
