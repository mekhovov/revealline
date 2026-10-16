/* global window, document, localStorage, navigator, caches, requestAnimationFrame */
/** Exercise the actual generated main-pages files under their repository path.
 * This never rewrites the site, weakens its gate, or promotes an optional package. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const basePath = '/revealline/';
const mime = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
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
const packages = ['civilian-fpv', 'fpv-worlds'];
const required = [
  'rates.mjs',
  'tuning-library.mjs',
  'tuning-ui.mjs',
  'tuning.css',
  'betaflight-import.mjs',
  'advanced-worker.mjs',
  'advanced-worker-client.mjs',
  'advanced-simulation.mjs',
  'advanced-terrain.mjs',
  'advanced-regional.mjs',
  'advanced-practice.mjs',
  'vendor/rapier/rapier.mjs',
];

export async function smokeFPVPages({ site, playwrightModule, output }) {
  site = await realpath(site);
  const manifestBytes = await readFile(path.join(site, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  const inventory = new Map(manifest.files.map((file) => [file.path, file]));
  const markerBytes = await readFile(path.join(site, '.xonix-build.json'));
  let localStaging = null;
  try {
    localStaging = JSON.parse(
      await readFile(path.resolve(site, '..', 'staging-report.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const publicationFiles = [
    ...manifest.files,
    { path: 'manifest.json', bytes: manifestBytes.length },
    { path: '.xonix-build.json', bytes: markerBytes.length },
  ];
  const directories = new Set(['.']);
  for (const file of publicationFiles) {
    let directory = path.posix.dirname(file.path);
    while (directory !== '.') {
      directories.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  // A conservative local forecast, never the actual upload-action archive.
  // Per-member header allowance also covers extended path headers; final
  // rolling metadata / empty optional directory receives a separate reserve.
  const stagedBytes = publicationFiles.reduce((sum, file) => sum + file.bytes, 0);
  const maximumPathBytes = Math.max(
    ...publicationFiles.map((file) => Buffer.byteLength(file.path)),
  );
  const archiveUpperForecast =
    publicationFiles.reduce((sum, file) => sum + Math.ceil(file.bytes / 512) * 512 + 2048, 0) +
    directories.size * 2048 +
    10240 +
    65536;
  const served = new Map(),
    missing = [],
    pageErrors = [],
    consoleErrors = [],
    requestFailures = [],
    workers = [];
  const report = {
    format: 'FPVPagesLiveTestingEvidence.v1',
    generatedAt: new Date().toISOString(),
    site,
    basePath,
    version: manifest.version,
    node: process.version,
    sourceRevision: manifest.sourceRevision,
    manifestSha256: sha256(manifestBytes),
    runnerSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    localStaging,
    capacity: {
      maximumBytes: 980000000,
      generatedFilesExcludingDownloadZip: publicationFiles.length,
      generatedStagedBytes: stagedBytes,
      localArchiveUpperForecastBytes: archiveUpperForecast,
      forecastHeadroomBytes: 980000000 - archiveUpperForecast,
      publicationMetadataReserveBytes: 65536,
      maximumPathBytes,
      forecastOnly: true,
      note: 'Distribution ZIP and its checksum are excluded exactly as in publish-main-pages. This forecasts the empty optional selector. Actual final staging inventory and uploaded archive must still pass the unchanged CI gates.',
    },
    passed: false,
    published: false,
    sourceBinding:
      'Local generated working-tree build; final committed CI build must be checked separately.',
    authentication:
      'Fresh locked gate verified. Then a disposable local browser profile uses the same remembered-unlock fixture as access-gate tests. Production HTML, scripts, and verifier are unchanged; no real-password acceptance is claimed.',
    limits: [
      'Chrome on one local host, HTTP localhost secure context; not a public HTTPS deployment test.',
      'Offline preparation uses the production installation API; this is not an installer button/accessibility acceptance test.',
      'Each package has an isolated browser context. Offline reload/re-entry is tested; browser-process restart and storage eviction are not.',
      'The declared lazy main-game tools extension is outside optional offline packages; its exact unavailable request and user-facing fallback are checked separately.',
      'Advanced remains experimental and unscored; no performance, device, Regional scene, or competition qualification is inferred.',
    ],
    packages: [],
  };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      assert.ok(pathname.startsWith(basePath), 'Request escaped repository base path');
      let name = pathname.slice(basePath.length);
      if (name.endsWith('/')) name += 'index.html';
      const target = path.resolve(site, name);
      assert.ok(target.startsWith(site + path.sep), 'Request escaped generated site');
      const bytes = await readFile(target);
      const expected = inventory.get(name);
      assert.ok(expected, `Unmanifested runtime request: ${name}`);
      assert.equal(bytes.length, expected.bytes);
      assert.equal(sha256(bytes), expected.sha256);
      served.set(name, expected);
      response.writeHead(200, {
        'Content-Type': mime[path.extname(name)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch (error) {
      missing.push({ url: request.url, error: error.message });
      response.writeHead(404);
      response.end();
    }
  });
  let browser,
    page,
    browserOffline = false;
  try {
    if (localStaging) {
      assert.equal(localStaging.passed, true, 'Local staging verification did not finish');
      assert.equal(localStaging.out, site, 'Local staging report names another output');
      assert.equal(localStaging.manifestSha256, report.manifestSha256);
      assert.equal(localStaging.verifiedEntries, manifest.files.length + 1);
    }
    assert.ok(
      maximumPathBytes <= 512,
      'Path lengths exceed the local tar-header forecast assumptions',
    );
    assert.ok(
      archiveUpperForecast <= 980000000,
      'Conservative local Pages capacity forecast exceeds the unchanged guard',
    );
    for (const name of required)
      assert.ok(inventory.has(`optional-practice/civilian-fpv/${name}`), `Missing ${name}`);
    assert.ok(inventory.has('game/platform.mjs'), 'Missing browser export platform dependency');
    assert.ok(
      inventory.has('optional-practice/fpv-worlds/advanced-worker.mjs'),
      'Missing World-scoped worker entry',
    );
    for (const id of packages) {
      const worker = await readFile(path.join(site, `optional-practice/${id}/worker.js`), 'utf8');
      for (const name of required.filter(
        (name) => id === 'fpv-worlds' || name !== 'advanced-regional.mjs',
      ))
        assert.ok(worker.includes(name), `${id} offline worker omits ${name}`);
      if (id === 'fpv-worlds') assert.ok(worker.includes('"path":"advanced-worker.mjs"'));
    }
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    report.browser = { engine: 'chromium', version: browser.version() };
    let context, storageState;
    const startContext = async (packageId) => {
      browserOffline = false;
      context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true,
        storageState,
      });
      page = await context.newPage();
      page.setDefaultTimeout(30000);
      page.on('pageerror', (error) => pageErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error')
          consoleErrors.push({
            text: message.text(),
            url: message.location().url,
            offline: browserOffline,
            packageId,
          });
      });
      page.on('worker', (worker) => workers.push(worker.url()));
      page.on('requestfailed', (request) =>
        requestFailures.push({
          url: request.url(),
          error: request.failure()?.errorText,
          offline: browserOffline,
          packageId,
        }),
      );
      await page.addInitScript(() => {
        window.pagesClickEvents = [];
        window.pagesPointerEvents = [];
        for (const type of ['pointerdown', 'pointerup'])
          document.addEventListener(
            type,
            (event) => {
              const dialog = document.querySelector('.fpv-tuning[open]');
              if (!dialog) return;
              window.pagesPointerEvents.push({
                type,
                tag: event.target.tagName,
                text: event.target.textContent?.slice(0, 100),
                y: event.clientY,
                top: event.target.getBoundingClientRect().top,
                scrollTop: dialog.scrollTop,
                scrollHeight: dialog.scrollHeight,
                hint: dialog.querySelector('.sim-menu-hint')?.textContent,
                hintHidden: dialog.querySelector('.sim-menu-hint')?.hidden,
              });
            },
            true,
          );
        document.addEventListener(
          'click',
          (event) => {
            window.pagesClickEvents.push({
              text: event.target.textContent?.slice(0, 150),
              tag: event.target.tagName,
              busy: document.querySelector('.fpv-tuning')?.getAttribute('aria-busy'),
            });
          },
          true,
        );
        const NativeWorker = window.Worker;
        window.pagesWorkerState = { created: 0, terminated: 0, lastMissionTick: 0 };
        window.Worker = class extends NativeWorker {
          constructor(...args) {
            super(...args);
            const workerSequence = ++window.pagesWorkerState.created;
            window.pagesWorkerState.lastMissionTick = 0;
            this.addEventListener('message', ({ data }) => {
              if (
                workerSequence === window.pagesWorkerState.created &&
                data?.result?.telemetry?.missionTick !== undefined
              )
                window.pagesWorkerState.lastMissionTick = data.result.telemetry.missionTick;
            });
          }
          terminate() {
            window.pagesWorkerState.terminated++;
            return super.terminate();
          }
        };
      });
    };
    const openTuning = async () => {
      await page.locator('[data-mode-action="settings"]:visible').click();
      await page.waitForFunction(() => {
        const fallback = document.querySelector('[data-sim-global-tools-fallback]');
        return (
          fallback &&
          (fallback.hidden || fallback.textContent.includes('SIM tools remain available.'))
        );
      });
      await page.getByRole('tab', { name: 'Controls', exact: true }).click();
      await page
        .getByRole('button', { name: 'Rates & throttle', exact: true })
        .filter({ visible: true })
        .click();
      await page.getByRole('dialog', { name: 'Rates & throttle', exact: true }).waitFor();
      await page.getByText(/^Raw input:/).waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
    };
    const advanced = async (packageId) => {
      await page
        .getByLabel('Rate profile', { exact: true })
        .selectOption({ label: 'Pages rates check' });
      assert.equal(
        await page
          .getByRole('group', { name: 'Roll', exact: true })
          .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
          .inputValue(),
        '900',
      );
      await page
        .getByRole('button', { name: 'Advanced reference quad · experimental', exact: true })
        .click();
      const pane = page.locator('.fpv-advanced-practice');
      await pane.getByRole('button', { name: 'Start practice', exact: true }).click();
      await page.waitForFunction(() => window.pagesWorkerState.lastMissionTick >= 10);
      await pane.getByRole('button', { name: 'Pause', exact: true }).click();
      const initialMissionTicks = await page.evaluate(
        () => window.pagesWorkerState.lastMissionTick,
      );
      const expectedWorkerURL = `${origin}${basePath}optional-practice/${packageId}/advanced-worker.mjs`;
      assert.deepEqual(
        page.workers().map((worker) => worker.url()),
        [expectedWorkerURL],
      );
      await pane.getByRole('button', { name: 'Restart practice', exact: true }).click();
      await page.waitForFunction(
        () =>
          window.pagesWorkerState.created === 2 &&
          window.pagesWorkerState.terminated === 1 &&
          window.pagesWorkerState.lastMissionTick === 0,
      );
      await pane.getByRole('button', { name: 'Start practice', exact: true }).click();
      await page.waitForFunction(() => window.pagesWorkerState.lastMissionTick >= 10);
      await pane.getByRole('button', { name: 'Pause', exact: true }).click();
      assert.deepEqual(
        page.workers().map((worker) => worker.url()),
        [expectedWorkerURL],
      );
      const downloadPromise = page.waitForEvent('download');
      await pane.getByRole('button', { name: 'Export practice recording', exact: true }).click();
      const download = await downloadPromise;
      const recording = JSON.parse(await readFile(await download.path(), 'utf8'));
      assert.ok(recording.missionTicks >= 10, 'Exported worker recording is empty');
      assert.equal(recording.format, 'AdvancedRecording.v1');
      assert.equal(recording.config.backend, 'civilian-quad-advanced-experimental.v2');
      assert.equal(recording.scored, false);
      assert.equal(
        recording.config.configuration.rateProfile.axes.roll.rate,
        90,
        'The worker did not freeze the selected rates',
      );
      const workerState = await page.evaluate(() => ({ ...window.pagesWorkerState }));
      await pane.getByRole('button', { name: 'Return to tuning', exact: true }).click();
      await page.waitForFunction(
        () => window.pagesWorkerState.created === window.pagesWorkerState.terminated,
      );
      await page
        .getByRole('dialog', { name: 'Rates & throttle', exact: true })
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      return {
        initialMissionTicks,
        missionTicks: recording.missionTicks,
        format: recording.format,
        backend: recording.config.backend,
        scored: recording.scored,
        workerState,
        disposedWorkerState: await page.evaluate(() => ({ ...window.pagesWorkerState })),
        workerURL: expectedWorkerURL,
        restarted: true,
        download: download.suggestedFilename(),
        pointerEvents: await page.evaluate(() => window.pagesPointerEvents),
      };
    };
    for (const [index, id] of packages.entries()) {
      await startContext(id);
      const url = `${origin}${basePath}optional-practice/${id}/index.html?lang=en`;
      await context.setOffline(false);
      await page.goto(url);
      if (index === 0) {
        await page.locator('#access-gate').waitFor();
        assert.equal(await page.locator('html').getAttribute('data-access-state'), 'locked');
        assert.equal(await page.evaluate(() => window.pagesWorkerState.created), 0);
        assert.equal(
          served.has('optional-practice/civilian-fpv/app.mjs'),
          false,
          'Locked gate fetched the application module',
        );
        await page.evaluate(() => {
          const meta = (name) => document.querySelector(`meta[name="${name}"]`).content;
          localStorage.setItem(
            `revealline.access.${meta('revealline-access-id')}.v1`,
            meta('revealline-access-verifier'),
          );
        });
        await page.reload();
        report.freshGateLocked = true;
      }
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.accessState === 'unlocked' &&
          !document.documentElement.dataset.modeShellPending &&
          document.querySelector('[data-mode-action="settings"]'),
      );
      await openTuning();
      if (index === 0) {
        await page.getByRole('button', { name: 'New Actual profile', exact: true }).click();
        await page.waitForFunction(
          () => JSON.parse(localStorage.getItem('revealline.fpv.tuning.v1'))?.profiles.length === 2,
        );
        await page.getByLabel('Profile name', { exact: true }).fill('Pages rates check');
        await page
          .getByRole('group', { name: 'Roll', exact: true })
          .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
          .fill('900');
        await page.getByRole('button', { name: 'Save for next flight', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'Saved for the next flight' }).waitFor();
        report.savedProfilePointerEvents = await page.evaluate(() => window.pagesPointerEvents);
      }
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('revealline.fpv.tuning.v1')),
      );
      assert.ok(
        stored.profiles.some((profile) => profile.name === 'Pages rates check'),
        'Saved player rates were not retained',
      );
      assert.equal(
        stored.profiles.find((profile) => profile.name === 'Pages rates check').response.rates.axes
          .roll.rate,
        90,
      );
      const result = {
        id,
        isolatedOfflineContext: true,
        route: new URL(url).pathname,
        ratesPersisted: true,
        online: await advanced(id),
      };
      await page.reload();
      await page.waitForFunction(
        () =>
          !document.documentElement.dataset.modeShellPending &&
          document.querySelector('[data-mode-action="settings"]'),
      );
      result.preparedOffline = await page.evaluate(async (packageId) => {
        const { prepareOptionalOffline } = await import('../install-context.mjs');
        return prepareOptionalOffline({ packageId, onProgress: () => {} });
      }, id);
      assert.equal(result.preparedOffline, true);
      await page.reload();
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      result.workerScope = await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistration()).scope,
      );
      assert.ok(result.workerScope.endsWith(`${basePath}optional-practice/${id}/`));
      browserOffline = true;
      await context.setOffline(true);
      await page.reload();
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.accessState === 'unlocked' &&
          !document.documentElement.dataset.modeShellPending &&
          document.querySelector('[data-mode-action="settings"]'),
      );
      await openTuning();
      await page.waitForFunction(() =>
        [...document.querySelectorAll('[data-sim-global-tools-fallback] [role="status"]')].some(
          (node) => node.textContent.includes('SIM tools remain available.'),
        ),
      );
      result.optionalCoreToolsFallback = await page
        .locator('[data-sim-global-tools-fallback] [role="status"]')
        .textContent();
      result.offline = await advanced(id);
      result.offlineCaches = await page.evaluate(() => caches.keys());
      report.packages.push(result);
      storageState = await context.storageState();
      await context.close();
      context = null;
    }
    const optionalToolsURL = `${origin}${basePath}game/ui/global-settings-tools.mjs`;
    report.expectedOptionalCoreRequests = requestFailures.filter(
      (failure) =>
        failure.offline &&
        failure.url === optionalToolsURL &&
        failure.error === 'net::ERR_INTERNET_DISCONNECTED',
    );
    report.expectedOptionalCoreConsole = consoleErrors.filter(
      (error) =>
        error.offline &&
        error.url === optionalToolsURL &&
        error.text === 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED',
    );
    for (const id of packages) {
      assert.equal(
        report.expectedOptionalCoreRequests.filter((entry) => entry.packageId === id).length,
        1,
      );
      assert.equal(
        report.expectedOptionalCoreConsole.filter((entry) => entry.packageId === id).length,
        1,
      );
    }
    assert.deepEqual(pageErrors, [], 'Browser application errors');
    assert.deepEqual(
      consoleErrors.filter((error) => !report.expectedOptionalCoreConsole.includes(error)),
      [],
      'Unexpected browser console errors',
    );
    assert.deepEqual(
      requestFailures.filter((failure) => !report.expectedOptionalCoreRequests.includes(failure)),
      [],
      'Unexpected failed requests',
    );
    assert.deepEqual(missing, [], 'Missing or unverified generated dependencies');
    assert.ok(
      workers.length >= 4 &&
        workers.every(
          (url) => url.startsWith(origin + basePath) && url.endsWith('/advanced-worker.mjs'),
        ),
      'Advanced worker escaped the generated base path',
    );
    report.passed = true;
  } catch (error) {
    report.failure = error.stack ?? error.message;
    report.failureState = await page
      ?.evaluate(() => ({
        dialogs: [...document.querySelectorAll('dialog[open]')].map((dialog) => ({
          label: dialog.getAttribute('aria-label'),
          text: dialog.innerText.slice(0, 5000),
        })),
        tuningLibrary: JSON.parse(localStorage.getItem('revealline.fpv.tuning.v1')),
        clicks: window.pagesClickEvents,
        pointers: window.pagesPointerEvents,
        activeElement: document.activeElement?.outerHTML,
      }))
      .catch(() => null);
  } finally {
    await browser?.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    report.pageErrors = pageErrors;
    report.consoleErrors = consoleErrors;
    report.requestFailures = requestFailures;
    report.missing = missing;
    report.workers = workers;
    report.servedFiles = [...served.values()].sort((a, b) => a.path.localeCompare(b.path));
    report.generatedBytesStable = true;
    for (const file of report.servedFiles) {
      if (sha256(await readFile(path.join(site, file.path))) !== file.sha256)
        report.generatedBytesStable = false;
    }
    report.runnerStable =
      sha256(await readFile(fileURLToPath(import.meta.url))) === report.runnerSha256;
    report.passed &&= report.generatedBytesStable && report.runnerStable;
    if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [site, playwrightModule, output] = process.argv.slice(2);
  if (!site || !playwrightModule || !output || process.argv.length !== 5)
    throw new Error('Usage: node scripts/smoke-fpv-pages.mjs SITE PLAYWRIGHT_MODULE REPORT.json');
  const report = await smokeFPVPages({ site, playwrightModule, output });
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        generatedBytesStable: report.generatedBytesStable,
        runnerStable: report.runnerStable,
        capacity: report.capacity,
        packages: report.packages.map(({ id, online, offline }) => ({
          id,
          onlineMissionTicks: online?.missionTicks,
          offlineMissionTicks: offline?.missionTicks,
          onlineRestarted: online?.restarted,
          offlineRestarted: offline?.restarted,
          workerURL: offline?.workerURL,
          finalWorkerState: offline?.disposedWorkerState,
        })),
        failure: report.failure,
        output,
      },
      null,
      2,
    ),
  );
  if (!report.passed) process.exitCode = 1;
}
