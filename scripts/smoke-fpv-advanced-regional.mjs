/* global window */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { replayAdvancedRecording } from '../optional-practice/civilian-fpv/advanced-simulation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mime = {
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.html': 'text/html',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.ico': 'image/x-icon',
};
const requireCheck = (condition, message) => {
  if (!condition) throw new Error(message);
};

export async function smokeAdvancedRegional({ playwrightModule, output, screenshot } = {}) {
  const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
  const sources = new Map(),
    errors = [],
    missing = [],
    workers = [];
  sources.set(
    'scripts/smoke-fpv-advanced-regional.mjs',
    createHash('sha256')
      .update(await readFile(fileURLToPath(import.meta.url)))
      .digest('hex'),
  );
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let name = pathname.slice(1);
      if (pathname === '/optional-practice/fpv-worlds/qualification.html') {
        // Only this ephemeral test response boots directly. The source HTML and
        // production access gate remain byte-for-byte untouched.
        const original = await readFile(
          path.join(root, 'optional-practice/fpv-worlds/index.html'),
          'utf8',
        );
        const html = original
          .replace(/<!-- access-gate:start -->[\s\S]*?<!-- access-gate:end -->/, '')
          .replaceAll('data-access-state="locked"', 'data-access-state="unlocked"')
          .replaceAll('data-fpv-worlds="true"', 'data-fpv-worlds="false"')
          .replace(/<script\b[\s\S]*?<\/script>/g, '');
        sources.set(
          'optional-practice/fpv-worlds/index.html',
          createHash('sha256').update(original).digest('hex'),
        );
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        response.end(html);
        return;
      }
      const filename = path.resolve(root, name);
      if (
        !filename.startsWith(`${root}${path.sep}`) ||
        name.split('/').some((part) => part.startsWith('.')) ||
        !mime[path.extname(name)]
      ) {
        response.writeHead(404);
        response.end();
        return;
      }
      const bytes = await readFile(filename);
      sources.set(name, createHash('sha256').update(bytes).digest('hex'));
      response.writeHead(200, {
        'Content-Type': mime[path.extname(name)],
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch {
      missing.push(request.url);
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const temporary = await mkdtemp(path.join(tmpdir(), 'fpv-regional-smoke-'));
  let browser;
  const evidence = {};
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('worker', (worker) => workers.push(worker.url()));
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      window.qualificationWorkers = { created: 0, terminated: 0, live: 0 };
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          window.qualificationWorkers.created++;
          window.qualificationWorkers.live++;
          this.qualificationClosed = false;
        }
        terminate() {
          if (!this.qualificationClosed) {
            this.qualificationClosed = true;
            window.qualificationWorkers.terminated++;
            window.qualificationWorkers.live--;
          }
          return super.terminate();
        }
      };
    });
    await page.goto(
      `http://127.0.0.1:${server.address().port}/optional-practice/fpv-worlds/qualification.html`,
    );
    await page.evaluate(async () => {
      const [{ mountWorldApp }, { createEnduranceFixture }, { regionalReviewEntry }] =
        await Promise.all([
          import('/optional-practice/civilian-fpv/world-app.mjs'),
          import('/authoring/fpv-worlds/regions/endurance-fixture.mjs'),
          import('/optional-practice/civilian-fpv/regional-session.mjs'),
        ]);
      window.qualificationApp = mountWorldApp();
      await window.qualificationApp.ready;
      const { terrain } = await createEnduranceFixture();
      window.qualificationRegion = regionalReviewEntry({
        manifest: terrain.manifest,
        source: terrain.source,
      });
      await window.qualificationApp.startFlight(window.qualificationRegion);
    });
    evidence.legacy = await page.evaluate(() => window.qualificationApp.snapshot());
    requireCheck(
      evidence.legacy.state.reason === 'prepared',
      'Legacy Regional fixture did not prepare',
    );
    await page.keyboard.press('p');
    await page.locator('[data-regional-advanced="toggle"]').click();
    await page.waitForFunction(
      () =>
        window.qualificationApp.snapshot().state?.advanced &&
        window.qualificationApp.snapshot().state.reason === 'prepared',
      null,
      { timeout: 30000 },
    );
    evidence.prepared = await page.evaluate(() => window.qualificationApp.snapshot());
    requireCheck(
      evidence.prepared.state.advancedTelemetry.frequency === 250 &&
        evidence.prepared.state.unscored,
      'Advanced configuration was not unscored 250 Hz',
    );
    await page.locator('#world-flight-resume').click();
    await page.waitForFunction(() => window.qualificationApp.snapshot().state.ticks >= 10, {
      timeout: 10000,
    });
    await page.keyboard.press('Escape');
    evidence.paused = await page.evaluate(() => window.qualificationApp.snapshot());
    await page.waitForTimeout(120);
    const afterPause = await page.evaluate(() => window.qualificationApp.snapshot());
    requireCheck(
      afterPause.state.ticks === evidence.paused.state.ticks &&
        afterPause.state.status === 'paused',
      'Pause did not freeze the worker-backed Regional attempt',
    );
    requireCheck(
      evidence.paused.state.terrain && evidence.paused.ghost.resources,
      'Real terrain/renderer evidence is missing',
    );
    const downloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Advanced recording', exact: true }).click();
    const download = await downloadReady,
      exported = path.join(temporary, 'flight.json');
    await download.saveAs(exported);
    const recording = JSON.parse(await readFile(exported, 'utf8'));
    const replay = await replayAdvancedRecording(recording);
    requireCheck(replay.verified, 'Browser Regional export did not verify in Node');
    evidence.export = {
      bytes: (await readFile(exported)).length,
      backend: recording.config.backend,
      missionTicks: recording.missionTicks,
      finalHash: recording.finalHash,
      nodeReplayVerified: replay.verified,
    };
    if (screenshot) await page.screenshot({ path: screenshot });
    await page.locator('[data-regional-advanced="toggle"]').click();
    await page.waitForFunction(
      () =>
        !window.qualificationApp.snapshot().state?.advanced &&
        window.qualificationApp.snapshot().state?.reason === 'prepared',
    );
    evidence.backToLegacy = await page.evaluate(() => ({
      state: window.qualificationApp.snapshot().state,
      workers: window.qualificationWorkers,
    }));
    requireCheck(
      evidence.backToLegacy.workers.live === 0,
      'Switching to Legacy leaked the Advanced worker',
    );
    await page.keyboard.press('p');
    await page.locator('[data-regional-advanced="toggle"]').click();
    await page.waitForFunction(
      () =>
        window.qualificationApp.snapshot().state?.advanced &&
        window.qualificationApp.snapshot().state.reason === 'prepared',
    );
    await page.locator('#world-flight-resume').click();
    await page.waitForFunction(
      () => window.qualificationApp.snapshot().state?.grounded === true,
      null,
      { timeout: 15000 },
    );
    evidence.contact = await page.evaluate(() => window.qualificationApp.snapshot().state);
    requireCheck(
      evidence.contact.status === 'active' && evidence.contact.contacts > 0,
      'Verified terrain contact did not resolve while the flight remained active',
    );
    await page.waitForFunction(
      (tick) => window.qualificationApp.snapshot().state.ticks >= tick + 20,
      evidence.contact.ticks,
    );
    await page.keyboard.down('w');
    try {
      await page.waitForFunction(
        (height) =>
          window.qualificationApp.snapshot().state.advancedTelemetry.position.y > height + 0.5,
        evidence.contact.advancedTelemetry.position.y,
        { timeout: 10000 },
      );
    } finally {
      await page.keyboard.up('w');
    }
    await page.keyboard.press('Escape');
    evidence.takeoff = await page.evaluate(() => window.qualificationApp.snapshot().state);
    requireCheck(
      !evidence.takeoff.grounded && evidence.takeoff.status === 'paused',
      'Grounded aircraft could not take off and pause',
    );
    const contactDownloadReady = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Advanced recording', exact: true }).click();
    const contactDownload = await contactDownloadReady,
      contactExport = path.join(temporary, 'contact-flight.json');
    await contactDownload.saveAs(contactExport);
    const contactRecording = JSON.parse(await readFile(contactExport, 'utf8'));
    const contactReplay = await replayAdvancedRecording(contactRecording);
    evidence.contactReplay = {
      verified: contactReplay.verified,
      finalHash: contactRecording.finalHash,
      simulationIdentity: contactRecording.simulationIdentity,
      frames: contactRecording.terrainFrames.length,
      colliders: contactRecording.terrainColliders.length,
      events: contactRecording.terrainEvents.length,
    };
    requireCheck(contactReplay.verified, 'Landing/takeoff browser export did not replay in Node');
    await page.evaluate(() => window.qualificationApp.dispose());
    evidence.cleanup = await page.evaluate(() => window.qualificationWorkers);
    requireCheck(evidence.cleanup.live === 0, 'Host disposal leaked the worker');
    requireCheck(errors.length === 0, `Browser page errors: ${errors.join('; ')}`);
    return await finish(true, browser.version());
  } catch (error) {
    evidence.failure = error.stack ?? String(error);
    const activePage = browser?.contexts()[0]?.pages()[0];
    if (activePage)
      evidence.failureSnapshot = await activePage
        .evaluate(() => window.qualificationApp?.snapshot())
        .catch(() => null);
    if (browser && screenshot)
      await browser
        .contexts()[0]
        ?.pages()[0]
        ?.screenshot({ path: screenshot })
        .catch(() => {});
    return await finish(false, browser?.version() ?? null);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
    await rm(temporary, { recursive: true, force: true });
  }
  async function finish(passed, version) {
    const pins = await Promise.all(
      [...sources]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(async ([name, sha256]) => ({
          path: name,
          sha256,
          unchanged:
            createHash('sha256')
              .update(await readFile(path.join(root, name)))
              .digest('hex') === sha256,
        })),
    );
    const report = {
      format: 'AdvancedRegionalBrowserSmoke.v1',
      createdAt: new Date().toISOString(),
      runtime: 'Chrome',
      version,
      passed: passed && pins.every((source) => source.unchanged),
      sourceStable: pins.every((source) => source.unchanged),
      scope:
        'Actual World host, Three renderer, verified six-cell terrain fixture and production Advanced module worker; keyboard/menu restart, pause, recording download and Node replay, verified terrain landing and continued takeoff, exact exported contact replay, switch back to Legacy, disposal. Fixture boot only; production access gate unchanged. One headless Chrome ARM64 host, no native or device qualification.',
      sources: pins,
      workers,
      pageErrors: errors,
      missingRequests: [...new Set(missing)],
      evidence,
    };
    if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [playwrightModule, output, screenshot] = process.argv.slice(2);
  if (!playwrightModule || !output)
    throw new Error(
      'Usage: node scripts/smoke-fpv-advanced-regional.mjs /absolute/path/to/playwright/index.mjs report.json [screenshot.png]',
    );
  const report = await smokeAdvancedRegional({ playwrightModule, output, screenshot });
  process.stdout.write(
    `${JSON.stringify({ passed: report.passed, sourceStable: report.sourceStable, version: report.version, failure: report.evidence.failure, evidence: Object.keys(report.evidence), missingRequests: report.missingRequests, output }, null, 2)}\n`,
  );
  if (!report.passed) process.exitCode = 1;
}
