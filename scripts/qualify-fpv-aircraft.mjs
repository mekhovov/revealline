import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { arch, cpus, platform, release, loadavg } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helper = 'game/test/helpers/fpv-aircraft-qualification.mjs';
const frozenHz = 1000;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Pin the entire literal module/worker closure, including dynamic imports.
 * Browser responses use these captured bytes, never a subsequent disk read. */
export async function aircraftQualificationSources() {
  const pending = [
    helper,
    'optional-practice/civilian-fpv/advanced-worker.mjs',
    'scripts/qualify-fpv-aircraft.mjs',
  ];
  const files = new Map();
  while (pending.length) {
    const name = pending.shift();
    if (files.has(name)) continue;
    const bytes = await readFile(path.join(root, name));
    files.set(name, bytes);
    for (const match of bytes
      .toString()
      .matchAll(
        /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\bnew\s+URL\(\s*['"]([^'"]+)['"]/g,
      )) {
      const specifier = match.slice(1).find(Boolean);
      if (specifier.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier));
        if (target.startsWith('../')) throw new Error('Qualification dependency leaves repository');
        pending.push(target);
      }
    }
  }
  return files;
}
function summary(result, baseline) {
  const candidates = result.timing.aircraft.map((p) =>
    p.candidates.find((c) => c.frequency === frozenHz),
  );
  const directMatchesNode = baseline
    ? JSON.stringify(result.determinism.cases) === JSON.stringify(baseline.cases)
    : null;
  const workerMatchesNode =
    baseline && result.worker
      ? JSON.stringify(result.worker.cases) === JSON.stringify(baseline.cases)
      : null;
  return {
    ...result,
    status: 'measured',
    fixedFrequencyHz: frozenHz,
    directMatchesNode,
    workerMatchesNode,
    frozenFrequencyPass:
      candidates.length === 15 &&
      candidates.every(
        (c) => c && c.accuracyPass && c.capacityPass && c.contactsPass && c.repetitionPass,
      ),
    directCasesComplete:
      result.determinism.frequency === frozenHz && result.determinism.cases.length === 30,
    workerCasesComplete: result.worker
      ? result.worker.frequency === frozenHz && result.worker.cases.length === 30
      : null,
    minimumResponseCapacity: Math.min(
      ...candidates.flatMap((c) => Object.values(c.axes).map((a) => a.minimumCapacity)),
    ),
    minimumLandingCapacity: Math.min(...candidates.map((c) => c.minimumLandingCapacity)),
    minimumWorkerProtocolCapacity: result.worker
      ? Math.min(...result.worker.capacities.map((c) => c.capacity))
      : null,
  };
}
async function withDeadline(operation, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Qualification exceeded ${milliseconds} ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Uses isolated headless contexts and already installed engines only. */
export async function qualifyAircraft({ playwrightModule, output } = {}) {
  const files = await aircraftQualificationSources();
  const sources = [...files]
    .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const report = {
    format: 'AircraftBrowserQualification.v2',
    startedAt: new Date().toISOString(),
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    runtimeChangesFromRevision: execFileSync(
      'git',
      ['diff', '--name-only', 'HEAD', '--', 'optional-practice', 'game/data-json.mjs'],
      { cwd: root, encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .filter(Boolean),
    machine: {
      architecture: arch(),
      platform: platform(),
      release: release(),
      processor: cpus()[0]?.model,
      logicalProcessors: cpus().length,
      loadAverageBefore: loadavg(),
    },
    sources,
    backend: 'civilian-quad-aircraft.v3',
    fixedFrequencyHz: frozenHz,
    expectedAircraft: 15,
    expectedCasesPerRuntime: 30,
    repetitions: 2,
    results: [],
    fullPlatformMatrixQualified: false,
    scoredEligible: false,
    defaultEligible: false,
    limitations: [
      'One physical Apple ARM64 host; headless desktop browser engines only.',
      'No installed-PWA, offline/update/eviction, native-wrapper, mobile, physical-radio or real-aircraft qualification.',
      'Numerical reference is 2 kHz; candidates 250/500/1000 remain measured, but only frozen v3 1000 Hz is the release gate.',
      'Replay covers each complete bounded 80-mission (1.6 s) retained clip, including checkpoint replay; not maximum-duration archive/storage qualification.',
      'Pause checks that an owner does not advance without mission requests; this is not OS suspend or browser background lifecycle qualification.',
      'Direct numerical timing includes production controller, motors, bodies, recording and thin-wall/floor contacts. Worker protocol capacity includes messages and one snapshot; no rendering workload.',
      'Sources include all literal imports and worker URL dependencies; no public tabs, user profiles or site storage are accessed.',
    ],
  };
  const save = async () => {
    if (output) {
      await mkdir(path.dirname(path.resolve(output)), { recursive: true });
      await writeFile(path.resolve(output), JSON.stringify(report, null, 2) + '\n');
    }
  };
  const fixture = await import(pathToFileURL(path.join(root, helper)).href);
  let baseline;
  try {
    const started = performance.now();
    const timing = await fixture.runAircraftTimingQualification({ repetitions: 2 });
    const determinism = await fixture.runAircraftDeterminismQualification();
    baseline = determinism;
    report.results.push(
      summary({
        runtime: 'node',
        version: process.version,
        elapsedMs: performance.now() - started,
        timing,
        determinism,
      }),
    );
  } catch (error) {
    report.results.push({
      runtime: 'node',
      version: process.version,
      status: 'failed',
      reason: String(error.stack ?? error),
    });
  }
  await save();
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/qualification.html') {
      response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><title>Local v3 aircraft qualification</title>');
    } else if (files.has(pathname.slice(1))) {
      response.writeHead(200, {
        'Content-Type': pathname.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
        'Cache-Control': 'no-store',
      });
      response.end(files.get(pathname.slice(1)));
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const playwright = await import(pathToFileURL(path.resolve(playwrightModule)).href);
    for (const [runtime, engine, options] of [
      ['chrome', playwright.chromium, { channel: 'chrome' }],
      ['firefox', playwright.firefox, {}],
      ['webkit', playwright.webkit, {}],
    ]) {
      let browser;
      const errors = [];
      const started = performance.now();
      try {
        browser = await engine.launch({ headless: true, ...options });
      } catch (error) {
        report.results.push({ runtime, status: 'unavailable', reason: String(error.message) });
        await save();
        continue;
      }
      try {
        const page = await browser.newPage();
        page.on('pageerror', (error) => errors.push(String(error.message)));
        page.on('response', (response) => {
          if (
            response.status() >= 400 &&
            /\.(?:mjs|js|wasm)$/.test(new URL(response.url()).pathname)
          )
            errors.push(`HTTP ${response.status()} ${response.url()}`);
        });
        await page.goto(`http://127.0.0.1:${server.address().port}/qualification.html`);
        const result = await withDeadline(
          page.evaluate(async () => {
            const fixture = await import('/game/test/helpers/fpv-aircraft-qualification.mjs');
            return {
              userAgent: navigator.userAgent,
              logicalProcessors: navigator.hardwareConcurrency ?? null,
              timing: await fixture.runAircraftTimingQualification({ repetitions: 2 }),
              determinism: await fixture.runAircraftDeterminismQualification(),
              worker: await fixture.runAircraftDeterminismQualification({ worker: true }),
            };
          }),
          600000,
        );
        report.results.push(
          summary(
            {
              runtime,
              version: browser.version(),
              elapsedMs: performance.now() - started,
              errors,
              ...result,
            },
            baseline,
          ),
        );
      } catch (error) {
        report.results.push({
          runtime,
          version: browser.version(),
          status: 'failed',
          elapsedMs: performance.now() - started,
          errors,
          reason: String(error.stack ?? error),
        });
      } finally {
        await browser.close();
      }
      await save();
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  report.changedSources = [];
  for (const source of sources)
    if (hash(await readFile(path.join(root, source.path))) !== source.sha256)
      report.changedSources.push(source.path);
  report.sourcesUnchanged = report.changedSources.length === 0;
  report.finishedAt = new Date().toISOString();
  report.machine.loadAverageAfter = loadavg();
  report.availableBrowserChecksPass =
    report.sourcesUnchanged &&
    report.runtimeChangesFromRevision.length === 0 &&
    report.results.length === 4 &&
    report.results.every(
      (result) =>
        result.status === 'measured' &&
        result.frozenFrequencyPass &&
        result.directCasesComplete &&
        (result.runtime === 'node' ||
          (result.workerCasesComplete &&
            result.directMatchesNode &&
            result.workerMatchesNode &&
            result.minimumWorkerProtocolCapacity >= 2 &&
            result.errors.length === 0)),
    );
  await save();
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [playwrightModule, output] = process.argv.slice(2);
  if (!playwrightModule || !output)
    throw new Error(
      'Usage: node scripts/qualify-fpv-aircraft.mjs EXISTING_PLAYWRIGHT_MODULE OUTPUT.json',
    );
  const report = await qualifyAircraft({ playwrightModule, output });
  process.stdout.write(
    JSON.stringify(
      {
        passed: report.availableBrowserChecksPass,
        sourcesUnchanged: report.sourcesUnchanged,
        results: report.results.map(
          ({
            runtime,
            version,
            status,
            frozenFrequencyPass,
            directMatchesNode,
            workerMatchesNode,
            minimumResponseCapacity,
            minimumLandingCapacity,
            minimumWorkerProtocolCapacity,
            reason,
          }) => ({
            runtime,
            version,
            status,
            frozenFrequencyPass,
            directMatchesNode,
            workerMatchesNode,
            minimumResponseCapacity,
            minimumLandingCapacity,
            minimumWorkerProtocolCapacity,
            reason,
          }),
        ),
      },
      null,
      2,
    ) + '\n',
  );
  if (!report.availableBrowserChecksPass) process.exitCode = 1;
}
