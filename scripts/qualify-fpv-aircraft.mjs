import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { arch, cpus, platform } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  runAircraftTimingQualification,
  runAircraftDeterminismQualification,
} from '../game/test/helpers/fpv-aircraft-qualification.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Use only already installed browser engines. Never downloads or installs. */
export async function qualifyAircraft({ playwrightModule, output } = {}) {
  const paths = [
    'optional-practice/civilian-fpv/aircraft-physics.mjs',
    'optional-practice/civilian-fpv/aircraft-response.mjs',
    'optional-practice/civilian-fpv/aircraft-presets.mjs',
    'optional-practice/civilian-fpv/advanced-aircraft-runtime.mjs',
    'optional-practice/civilian-fpv/aircraft-recording.mjs',
    'optional-practice/civilian-fpv/advanced-worker.mjs',
    'game/test/helpers/fpv-aircraft-qualification.mjs',
    'scripts/qualify-fpv-aircraft.mjs',
  ];
  const digests = async () =>
    Promise.all(
      paths.map(async (name) => ({
        path: name,
        sha256: createHash('sha256')
          .update(await readFile(path.join(root, name)))
          .digest('hex'),
      })),
    );
  const sources = await digests();
  const node = {
    runtime: 'node',
    version: process.version,
    architecture: arch(),
    timing: await runAircraftTimingQualification({ repetitions: 2 }),
    determinism: await runAircraftDeterminismQualification(),
    status: 'measured',
  };
  const report = {
    format: 'AircraftBrowserQualification.v1',
    measuredAt: new Date().toISOString(),
    machine: { architecture: arch(), platform: platform(), processor: cpus()[0]?.model },
    sources,
    results: [node],
    fullPlatformMatrixQualified: false,
    scoredEligible: false,
    defaultEligible: false,
    limitations: [
      'Numerical and available browser checks only; not real-aircraft or physical-radio validation.',
      'No native-wrapper, mobile or other-architecture performance claim.',
    ],
  };
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (pathname === '/qualification.html') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<!doctype html><title>Aircraft qualification</title>');
        return;
      }
      const filename = path.resolve(root, `.${decodeURIComponent(pathname)}`);
      if (
        !filename.startsWith(root + path.sep) ||
        !['.mjs', '.js', '.json', '.wasm'].includes(path.extname(filename))
      ) {
        response.writeHead(404);
        response.end();
        return;
      }
      const type =
        path.extname(filename) === '.json'
          ? 'application/json'
          : path.extname(filename) === '.wasm'
            ? 'application/wasm'
            : 'text/javascript';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      response.end(await readFile(filename));
    } catch {
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
      try {
        browser = await engine.launch({ headless: true, ...options });
      } catch (error) {
        report.results.push({
          runtime,
          status: 'unavailable',
          reason: error.message.slice(0, 1000),
        });
        continue;
      }
      try {
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${server.address().port}/qualification.html`);
        const result = await page.evaluate(async () => {
          const fixture = await import('/game/test/helpers/fpv-aircraft-qualification.mjs');
          return {
            userAgent: navigator.userAgent,
            timing: await fixture.runAircraftTimingQualification({ repetitions: 2 }),
            determinism: await fixture.runAircraftDeterminismQualification(),
            worker: await fixture.runAircraftDeterminismQualification({ worker: true }),
          };
        });
        const baseline = JSON.stringify(node.determinism.cases);
        report.results.push({
          runtime,
          version: browser.version(),
          status: 'measured',
          ...result,
          directMatchesNode: JSON.stringify(result.determinism.cases) === baseline,
          workerMatchesNode: JSON.stringify(result.worker.cases) === baseline,
        });
      } catch (error) {
        report.results.push({
          runtime,
          status: 'failed',
          reason: String(error.stack ?? error).slice(0, 6000),
        });
      } finally {
        await browser.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  report.sourcesUnchanged = JSON.stringify(sources) === JSON.stringify(await digests());
  report.availableBrowserChecksPass =
    report.sourcesUnchanged &&
    report.results.every(
      (result) =>
        result.status === 'unavailable' ||
        (result.status === 'measured' &&
          result.timing.selectedHzOnThisRuntime !== null &&
          result.timing.selectedHzOnThisRuntime <= 500 &&
          (result.runtime === 'node' || (result.directMatchesNode && result.workerMatchesNode))),
    );
  if (output) await writeFile(path.resolve(output), JSON.stringify(report, null, 2) + '\n');
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
        results: report.results.map((r) => ({
          runtime: r.runtime,
          status: r.status,
          frequency: r.timing?.selectedHzOnThisRuntime,
          directMatchesNode: r.directMatchesNode,
          workerMatchesNode: r.workerMatchesNode,
          reason: r.reason,
        })),
      },
      null,
      2,
    ) + '\n',
  );
  if (!report.availableBrowserChecksPass) process.exitCode = 1;
}
