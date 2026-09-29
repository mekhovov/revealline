import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { startServer } from './game-cli.mjs';

// External Playwright is a validation tool, never an optional-game dependency.
const [modulePath, output = '/tmp/fpv-runtime-observation.json'] = process.argv.slice(2);
if (!modulePath) throw new Error('Pass the absolute path to the validation Playwright module.');
const { chromium } = await import(pathToFileURL(path.resolve(modulePath)).href);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const built = await buildOptionalPractice(root, { packageId: 'civilian-fpv' });
const directory = await mkdtemp(path.join(tmpdir(), 'fpv-runtime-observation-'));
let served, browser;
try {
  for (const item of built.entries) {
    const file = path.join(directory, item.name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, item.bytes);
  }
  await writeFile(
    path.join(directory, '.xonix-build.json'),
    JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }),
  );
  const folder = path.join(directory, 'optional-practice/civilian-fpv');
  const html = (await readFile(path.join(folder, 'index.html'), 'utf8'))
    .replace('data-civilian-fpv="true"', 'data-civilian-fpv="false"')
    .replace('src="app.mjs"', 'src="observation.mjs"');
  await writeFile(path.join(folder, 'observation.html'), html);
  const wrapper =
    "import {mountFlightApp} from './app.mjs'; globalThis.flightObservation=mountFlightApp();";
  await writeFile(path.join(folder, 'observation.mjs'), wrapper);
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const instrumentation = {
    observerSha256: digest(await readFile(fileURLToPath(import.meta.url))),
    htmlSha256: digest(html),
    wrapperSha256: digest(wrapper),
  };
  served = await startServer({ root: directory, port: 0 });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(served.url + 'optional-practice/civilian-fpv/observation.html');
  await page.waitForTimeout(500);
  const resources = () => page.evaluate(() => globalThis.flightObservation.resources());
  const initial = await resources(),
    cycles = [];
  async function choose(index) {
    await page.getByRole('button', { name: 'Choose a drill', exact: true }).click();
    await page.locator('#course-list button').nth(index).click();
  }
  for (let i = 0; i < 20; i++) {
    await choose(i % 12);
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.waitForTimeout(50);
    cycles.push({
      cycle: i + 1,
      resources: await resources(),
      nodes: await page.evaluate(() => ({
        canvases: globalThis.document.querySelectorAll('canvas').length,
        dialogs: globalThis.document.querySelectorAll('dialog').length,
      })),
    });
  }
  await choose(0);
  await page.waitForTimeout(100);
  const returned = await resources(),
    layouts = [];
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [844, 390],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(80);
    layouts.push(
      await page.evaluate(() => {
        const box = globalThis.document.querySelector('#flight-canvas').getBoundingClientRect();
        return {
          width: globalThis.innerWidth,
          height: globalThis.innerHeight,
          scrollWidth: globalThis.document.documentElement.scrollWidth,
          scrollHeight: globalThis.document.documentElement.scrollHeight,
          canvas: { x: box.x, y: box.y, width: box.width, height: box.height },
        };
      }),
    );
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await choose(11);
  await page.getByRole('button', { name: 'Watch example', exact: true }).click();
  await page.evaluate(() => globalThis.flightObservation.settled());
  const playbackState = () =>
    page.evaluate(() => ({
      status: globalThis.document.getElementById('status').textContent,
      height: globalThis.document.getElementById('height').textContent,
      speed: globalThis.document.getElementById('speed').textContent,
      step: globalThis.document.getElementById('step-progress').value,
    }));
  const playbackBefore = await playbackState();
  const pacing = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [],
          longTasks = [];
        let last, start;
        const observer = new globalThis.PerformanceObserver((list) => {
          longTasks.push(
            ...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })),
          );
        });
        observer.observe({ type: 'longtask', buffered: false });
        function frame(now) {
          start ??= now;
          if (last !== undefined) frames.push(now - last);
          last = now;
          if (now - start < 8000) return globalThis.requestAnimationFrame(frame);
          longTasks.push(
            ...observer.takeRecords().map(({ startTime, duration }) => ({ startTime, duration })),
          );
          observer.disconnect();
          const sorted = [...frames].sort((a, b) => a - b);
          resolve({
            scenario: 'final-circuit demonstrated flight, 1440 × 900, headless Chrome',
            duration: now - start,
            samples: frames.length,
            p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
            max: sorted.at(-1),
            longTasks,
          });
        }
        globalThis.requestAnimationFrame(frame);
      }),
  );
  const playbackAfter = await playbackState();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Arm / resume', exact: true }).click();
  await page.waitForTimeout(300);
  const beforeLoss = await page.evaluate(() => globalThis.flightObservation.snapshot());
  await page.evaluate(() =>
    globalThis.document
      .getElementById('flight-canvas')
      .getContext('webgl2')
      .getExtension('WEBGL_lose_context')
      .loseContext(),
  );
  await page.waitForFunction(
    () =>
      globalThis.flightObservation.snapshot().status === 'paused' &&
      globalThis.document.getElementById('flight-canvas').getContext('webgl2').isContextLost(),
  );
  const frozen = await page.evaluate(() => globalThis.flightObservation.snapshot());
  await page.waitForTimeout(200);
  const afterLoss = await page.evaluate(() => globalThis.flightObservation.snapshot());
  const disposed = await page.evaluate(() => {
    globalThis.flightObservation.dispose();
    return globalThis.flightObservation.resources();
  });
  const passed =
    errors.length === 0 &&
    playbackBefore.status.includes('example') &&
    JSON.stringify(playbackBefore) !== JSON.stringify(playbackAfter) &&
    JSON.stringify(initial) === JSON.stringify(returned) &&
    layouts.every(
      (item) =>
        item.scrollWidth === item.width &&
        item.scrollHeight <= item.height &&
        item.canvas.width > 0 &&
        item.canvas.height > 0 &&
        item.canvas.y >= 0 &&
        item.canvas.y + item.canvas.height <= item.height &&
        item.canvas.x >= 0 &&
        item.canvas.x + item.canvas.width <= item.width,
    ) &&
    beforeLoss.status === 'active' &&
    beforeLoss.ticks > 0 &&
    afterLoss.status === 'paused' &&
    frozen.ticks === afterLoss.ticks &&
    Object.values(disposed.registered).every((value) => value === 0) &&
    disposed.renderer.contextLost;
  const report = {
    format: 'FlightRuntimeObservation.v1',
    createdAt: new Date().toISOString(),
    passed,
    browser: browser.version(),
    scope:
      'Exact compiled modules in instrumented host, production-style headers. Scoped headless timing and registered resource counts; not hardware, full heap-retainer, installed-app or release qualification. Three retains a shared lookup-texture accounting entry after disposal; the GL context is explicitly lost.',
    runtimeRevision: built.manifest.revision,
    instrumentation,
    runtimeFiles: built.manifest.files,
    headers: await response.allHeaders(),
    initial,
    cycles,
    returned,
    layouts,
    pacing,
    playback: { before: playbackBefore, after: playbackAfter },
    contextLoss: {
      beforeTicks: beforeLoss.ticks,
      method: 'WEBGL_lose_context.loseContext(), actual isContextLost() confirmed',
      frozenTicks: frozen.ticks,
      afterTicks: afterLoss.ticks,
      beforeStatus: beforeLoss.status,
      afterStatus: afterLoss.status,
    },
    disposed,
    errors,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed, pacing, layouts, contextLoss: report.contextLoss }));
  if (!passed) process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    try {
      if (served) await new Promise((resolve) => served.server.close(resolve));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
