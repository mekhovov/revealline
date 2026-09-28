import { closeSync, openSync, writeSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { startServer } from './game-cli.mjs';
import { compareFlightHeaps, FPV_HEAP_LIMITS, readFlightHeap } from './analyze-fpv-heap.mjs';

// A separate forced-GC diagnostic, never a gameplay benchmark or earning path.
const [modulePath, requestedOutput] = process.argv.slice(2);
if (!modulePath || !path.isAbsolute(modulePath))
  throw new Error('Pass the absolute installed Playwright module path.');
const output = requestedOutput
  ? path.resolve(requestedOutput)
  : await mkdtemp(path.join(tmpdir(), 'fpv-retention-evidence-'));
if (requestedOutput) await mkdir(output, { recursive: false });
const { chromium } = await import(pathToFileURL(modulePath).href);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const built = await buildOptionalPractice(root, { packageId: 'civilian-fpv' });
const directory = await mkdtemp(path.join(tmpdir(), 'fpv-retention-site-'));
let served, browser, client;
const errors = [];
async function boundedCapture(action, label) {
  let timer;
  try {
    return await Promise.race([
      action(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded60seconds.`)), 60_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
try {
  for (const entry of built.entries) {
    const file = path.join(directory, entry.name);
    if (!file.startsWith(directory + path.sep))
      throw new Error('Compiler emitted an escaping path.');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, entry.bytes);
  }
  await writeFile(
    path.join(directory, '.xonix-build.json'),
    JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }),
  );
  const folder = path.join(directory, 'optional-practice/civilian-fpv'),
    html = (await readFile(path.join(folder, 'index.html'), 'utf8'))
      .replace('data-civilian-fpv="true"', 'data-civilian-fpv="false"')
      .replace('src="app.mjs"', 'src="retention-observer.mjs"'),
    wrapper =
      "import {mountFlightApp} from './app.mjs'; globalThis.flightRetention=mountFlightApp();";
  await writeFile(path.join(folder, 'retention-observer.html'), html);
  await writeFile(path.join(folder, 'retention-observer.mjs'), wrapper);
  const instrumentation = {};
  for (const [name, file] of [
    ['observer', fileURLToPath(import.meta.url)],
    ['analyzer', fileURLToPath(new URL('./analyze-fpv-heap.mjs', import.meta.url))],
  ]) {
    const bytes = await readFile(file);
    instrumentation[name] = { bytes: bytes.length, sha256: digest(bytes) };
    await writeFile(path.join(output, name + '.mjs'), bytes);
  }
  instrumentation.html = { bytes: Buffer.byteLength(html), sha256: digest(html) };
  instrumentation.wrapper = { bytes: Buffer.byteLength(wrapper), sha256: digest(wrapper) };
  await writeFile(path.join(output, 'retention-observer.html'), html);
  await writeFile(path.join(output, 'retention-wrapper.mjs'), wrapper);
  await writeFile(
    path.join(output, 'runtime-manifest.json'),
    JSON.stringify(built.manifest, null, 2) + '\n',
  );
  served = await startServer({ root: directory, port: 0 });
  const verifiedMembers = [];
  for (const file of built.manifest.files) {
    const response = await fetch(new URL(file.path, served.url));
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || bytes.length !== file.bytes || digest(bytes) !== file.sha256)
      throw new Error(`Served member differs: ${file.path}`);
    verifiedMembers.push(file.path);
  }
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(
    served.url + 'optional-practice/civilian-fpv/retention-observer.html',
  );
  await page.evaluate(() => globalThis.flightRetention.settled());
  client = await page.context().newCDPSession(page);
  await client.send('HeapProfiler.enable');
  const resources = () =>
    page.evaluate(() => ({
      renderer: globalThis.flightRetention.resources(),
      connected: {
        all: globalThis.document.querySelectorAll('*').length,
        canvases: globalThis.document.querySelectorAll('canvas').length,
        dialogs: globalThis.document.querySelectorAll('dialog').length,
      },
      openDialogs: globalThis.document.querySelectorAll('dialog[open]').length,
    }));
  async function choose(index) {
    await page.getByRole('button', { name: 'Choose a drill', exact: true }).click();
    await page.locator('#course-list button').nth(index).click();
  }
  async function cycle(index) {
    await choose(index % 12);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.getByRole('button', { name: 'Radio & response', exact: true }).click();
    await page.waitForTimeout(40);
    await page.locator('[data-close="setup-dialog"]').click();
    await page.locator('#notebook-button').click();
    await page.locator('[data-close="notebook-dialog"]').click();
    await page.locator('#help').click();
    await page.locator('#studio-button').click();
    await page.getByRole('button', { name: 'Preview without earning', exact: true }).click();
    await page.waitForFunction(() => !globalThis.document.getElementById('studio-dialog').open);
    await choose(0);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.waitForTimeout(40);
    return resources();
  }
  // Warm every scene/shader and each dialog/preview before taking the baseline.
  for (let i = 0; i < 12; i++) await cycle(i);
  async function snapshot(name) {
    await boundedCapture(() => client.send('HeapProfiler.collectGarbage'), 'Garbage collection');
    const dom = await client.send('Memory.getDOMCounters'),
      file = path.join(output, name + '.heapsnapshot'),
      descriptor = openSync(file, 'wx');
    let bytes = 0,
      overflow = false,
      ioError = null;
    const chunk = ({ chunk: text }) => {
      bytes += Buffer.byteLength(text);
      if (bytes > FPV_HEAP_LIMITS.bytes) {
        overflow = true;
        return;
      }
      if (ioError) return;
      try {
        const data = Buffer.from(text);
        let offset = 0;
        while (offset < data.length) {
          const written = writeSync(descriptor, data, offset, data.length - offset);
          if (written <= 0) throw new Error('Incomplete heap chunk write.');
          offset += written;
        }
      } catch (error) {
        ioError = error;
      }
    };
    client.on('HeapProfiler.addHeapSnapshotChunk', chunk);
    try {
      await boundedCapture(
        () => client.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false }),
        'Heap snapshot',
      );
    } finally {
      client.off('HeapProfiler.addHeapSnapshotChunk', chunk);
      closeSync(descriptor);
    }
    if (overflow)
      throw new Error('Heap snapshot exceeds128MiB; truncated evidence retained, not analyzed.');
    if (ioError) throw ioError;
    const analysis = await readFlightHeap(file);
    await writeFile(
      path.join(output, name + '-analysis.json'),
      JSON.stringify(analysis, null, 2) + '\n',
    );
    return { dom, analysis };
  }
  const beforeResources = await resources(),
    before = await snapshot('before');
  const cycles = [];
  for (let i = 0; i < 20; i++) cycles.push({ cycle: i + 1, resources: await cycle(i) });
  const afterResources = await resources(),
    after = await snapshot('after');
  const secondCycles = [];
  for (let i = 20; i < 40; i++) secondCycles.push({ cycle: i + 1, resources: await cycle(i) });
  const after40Resources = await resources(),
    after40 = await snapshot('after40');
  const disposed = await page.evaluate(() => {
    globalThis.flightRetention.dispose();
    const result = globalThis.flightRetention.resources();
    delete globalThis.flightRetention;
    return result;
  });
  await page.waitForTimeout(100);
  const released = await snapshot('released');
  const report = {
    format: 'FlightRetentionObservation.v1',
    createdAt: new Date().toISOString(),
    qualification: false,
    scope:
      'One headless Chrome desktop session;12 warm cycles then40 public scene/reset/radio/notebook/Studio-preview cycles with a separate20-cycle checkpoint. Explicit forced GC before each heap snapshot. No wins, stored receipts, radio samples, installed PWA, natural pacing or physical-device claims.',
    browser: browser.version(),
    viewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    runtimeRevision: built.manifest.revision,
    runtimeFiles: built.manifest.files,
    verifiedMembers,
    instrumentation,
    headers: await response.allHeaders(),
    beforeResources,
    cycles,
    afterResources,
    secondCycles,
    after40Resources,
    disposed,
    snapshotFiles: {
      before: before.analysis.file,
      after: after.analysis.file,
      after40: after40.analysis.file,
      released: released.analysis.file,
    },
    domCounters: {
      before: before.dom,
      after: after.dom,
      after40: after40.dom,
      released: released.dom,
    },
    activeComparison: compareFlightHeaps(before.analysis, after.analysis),
    secondIntervalComparison: compareFlightHeaps(after.analysis, after40.analysis),
    fullComparison: compareFlightHeaps(before.analysis, after40.analysis),
    releasedComparison: compareFlightHeaps(before.analysis, released.analysis),
    procedureComplete:
      cycles.length === 20 &&
      secondCycles.length === 20 &&
      errors.length === 0 &&
      [...cycles, ...secondCycles].every((item) => item.resources.openDialogs === 0),
    errors,
    limitations: [
      'Object populations and sampled strong retaining paths require interpretation; this is not an automatic leak-free pass.',
      'The retained app API is intentionally released only after dispose; static host DOM remains mounted.',
      'Three resource counters are bookkeeping and not total GPU bytes; context loss is recorded separately.',
      'Heap snapshots may retain source/fixture strings; keep raw files local. Public summaries omit their payloads.',
    ],
    sources: [
      'https://playwright.dev/docs/api/class-cdpsession',
      'https://chromedevtools.github.io/devtools-protocol/tot/HeapProfiler/',
      'https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots',
    ],
  };
  await writeFile(path.join(output, 'observation.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      output,
      procedureComplete: report.procedureComplete,
      runtimeRevision: report.runtimeRevision,
      shallowByteDelta: report.activeComparison.shallowByteDelta,
      secondIntervalShallowByteDelta: report.secondIntervalComparison.shallowByteDelta,
      domCounters: report.domCounters,
      disposed,
    }),
  );
  if (!report.procedureComplete) process.exitCode = 1;
} catch (error) {
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify(
      { error: error.message, errors, runtimeRevision: built.manifest.revision },
      null,
      2,
    ) + '\n',
  );
  throw error;
} finally {
  try {
    await client?.detach().catch(() => {});
    await browser?.close();
  } finally {
    try {
      if (served) await new Promise((resolve) => served.server.close(resolve));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
