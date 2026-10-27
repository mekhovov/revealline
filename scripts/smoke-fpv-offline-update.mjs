/* global window, document, localStorage, navigator, caches */
/** Local two-revision fixture using production package builders and worker lifecycle.
 * No public publication, cache deletion, forced activation or gate modification. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildOptionalPractice } from './build-optional-practice.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const prefix = '/revealline/';
const marker = '\n/* Earlier local update fixture: behavior and saved-data schema unchanged. */\n';
const mime = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
};
const sources = [
  'scripts/build-optional-practice.mjs',
  'scripts/game-cli.mjs',
  'scripts/optional-launcher.mjs',
  'publishing/optional-package-policy.mjs',
  'optional-practice/worker-template.mjs',
];

export async function smokeFPVOfflineUpdate({ playwrightModule, output }) {
  const runnerPath = fileURLToPath(import.meta.url);
  const report = {
    format: 'FPVOfflineUpdateEvidence.v1',
    generatedAt: new Date().toISOString(),
    node: process.version,
    runnerSha256: sha(await readFile(runnerPath)),
    passed: false,
    published: false,
    limits: [
      'Local HTTP secure context on one Chrome host; no public HTTPS or real password acceptance claim.',
      'Two generated package revisions differ only by an inert earlier CSS marker. This tests worker update and saved-data preservation, not a historical schema migration.',
      'Uses the ordinary optional-package builder and generated worker at the mutable direct routes, not a full Pages build or release promotion.',
      'Offline preparation and explicit update checks use the production installation API and browser registration.update(); visible installer activation is qualified separately.',
      'Browser-process restart uses a disposable persistent profile, with no cache or application storage deletion. No storage eviction or OS installation claim.',
      'Advanced is optional and unscored; no new physics, hardware or performance qualification.',
    ],
    packages: [],
    sources: [],
  };
  const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)).href);
  const bindings = new Map();
  for (const source of sources) bindings.set(source, sha(await readFile(path.join(root, source))));
  let context, server;
  try {
    for (const id of ['civilian-fpv', 'fpv-worlds']) {
      const built = await buildOptionalPractice(root, { packageId: id });
      for (const [name, bytes] of built.inputs) bindings.set(name, sha(bytes));
      const stylePath =
        id === 'civilian-fpv'
          ? 'optional-practice/civilian-fpv/style.css'
          : 'optional-practice/civilian-fpv/world-style.css';
      const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), `fpv-update-source-${id}-`));
      for (const [name, bytes] of built.inputs) {
        const target = path.join(fixtureRoot, name);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(
          target,
          name === stylePath ? Buffer.concat([bytes, Buffer.from(marker)]) : bytes,
        );
      }
      const oldBuilt = await buildOptionalPractice(fixtureRoot, { packageId: id });
      const artifact = (result) => ({
        revision: result.manifest.revision,
        files: new Map(result.entries.map(({ name, bytes }) => [name, bytes])),
        inventory: result.manifest.files,
      });
      const old = artifact(oldBuilt),
        current = artifact(built);
      assert.notEqual(old.revision, current.revision);
      let served = old;
      const requests = [],
        errors = [];
      server = createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/observer') {
          response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
          response.end('<!doctype html><title>Local update observer</title>');
          return;
        }
        const name = decodeURIComponent(url.pathname.slice(prefix.length));
        const bytes = url.pathname.startsWith(prefix) && served.files.get(name);
        requests.push({ path: url.pathname, revision: served.revision, found: !!bytes });
        if (!bytes) {
          response.writeHead(404);
          response.end();
          return;
        }
        response.writeHead(200, {
          'Content-Type': mime[path.extname(name)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        response.end(bytes);
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      const base = `${origin}${prefix}optional-practice/${id}/`;
      const profile = await mkdtemp(path.join(os.tmpdir(), `fpv-offline-update-${id}-`));
      const launch = async () => {
        context = await chromium.launchPersistentContext(profile, {
          channel: 'chrome',
          headless: true,
          viewport: { width: 1440, height: 1000 },
          acceptDownloads: true,
        });
        report.browser = { engine: 'chrome', version: context.browser().version() };
        await context.addInitScript(() => {
          const NativeWorker = window.Worker;
          window.updateWorkerTicks = 0;
          window.Worker = class extends NativeWorker {
            constructor(...args) {
              super(...args);
              this.addEventListener('message', ({ data }) => {
                if (data?.result?.telemetry?.missionTick !== undefined)
                  window.updateWorkerTicks = data.result.telemetry.missionTick;
              });
            }
          };
        });
      };
      await launch();
      let page = context.pages()[0];
      page.setDefaultTimeout(30000);
      page.on('pageerror', (error) => errors.push(error.message));
      const ready = async () =>
        page.waitForFunction(
          () =>
            document.documentElement.dataset.accessState === 'unlocked' &&
            !document.documentElement.dataset.modeShellPending &&
            document.querySelector('[data-mode-action="settings"]'),
        );
      const openTuning = async () => {
        await page.locator('[data-mode-action="settings"]:visible').click();
        await page.getByRole('tab', { name: 'Controls', exact: true }).click();
        await page
          .getByRole('button', { name: 'Aircraft, rates & throttle', exact: true })
          .filter({ visible: true })
          .click();
        await page.getByRole('dialog', { name: 'Setup workbench', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Library', exact: true }).click();
      };
      const enterAdvanced = async (rate) => {
        await openTuning();
        await page.getByLabel('Rate profile', { exact: true }).selectOption('update-rates');
        await page.getByRole('button', { name: 'Use rate profile in draft', exact: true }).click();
        await page.getByRole('button', { name: 'Rates & throttle', exact: true }).click();
        assert.equal(
          await page
            .getByRole('group', { name: 'Roll', exact: true })
            .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
            .inputValue(),
          String(rate),
        );
        await page.getByRole('button', { name: 'Flight response / PID', exact: true }).click();
        await page
          .getByRole('button', { name: 'Advanced reference quad · experimental', exact: true })
          .click();
        const pane = page.locator('.fpv-advanced-practice');
        await pane.getByRole('button', { name: 'Start practice', exact: true }).click();
        await page.waitForFunction(() => window.updateWorkerTicks >= 10);
        await pane.getByRole('button', { name: 'Pause', exact: true }).click();
      };
      const exportRecording = async () => {
        const pending = page.waitForEvent('download');
        await page
          .locator('.fpv-advanced-practice')
          .getByRole('button', { name: 'Export practice recording', exact: true })
          .click();
        const download = await pending;
        return JSON.parse(await readFile(await download.path(), 'utf8'));
      };
      const status = async (target, kind = 'active') =>
        target.evaluate(
          async ({ base, kind }) => {
            const registration = await navigator.serviceWorker.getRegistration(base);
            const worker = registration?.[kind];
            if (!worker) return null;
            return new Promise((resolve, reject) => {
              const channel = new MessageChannel();
              const timer = setTimeout(() => reject(new Error('Worker status timed out')), 30000);
              channel.port1.onmessage = ({ data }) => {
                clearTimeout(timer);
                channel.port1.close();
                resolve({ ...data, state: worker.state });
              };
              worker.postMessage({ type: 'practice-status' }, [channel.port2]);
            });
          },
          { base, kind },
        );
      await page.goto(`${base}index.html?lang=en`);
      await page.locator('#access-gate').waitFor();
      assert.equal(await page.locator('html').getAttribute('data-access-state'), 'locked');
      await page.evaluate(() => {
        const meta = (name) => document.querySelector(`meta[name="${name}"]`).content;
        localStorage.setItem(
          `revealline.access.${meta('revealline-access-id')}.v1`,
          meta('revealline-access-verifier'),
        );
      });
      await page.reload();
      await ready();
      await page.evaluate(async () => {
        const { createTuningLibraryStore } = await import(
          '/revealline/optional-practice/civilian-fpv/tuning-library.mjs'
        );
        const { createTunedResponse } = await import(
          '/revealline/optional-practice/civilian-fpv/flight-response.mjs'
        );
        const store = createTuningLibraryStore({ storage: localStorage, locks: navigator.locks });
        const response = createTunedResponse();
        response.rates.axes.roll.rate = 80;
        await store.createProfile({ id: 'update-rates', name: 'Offline update rates', response });
        await store.setDefault('update-rates');
        await store.saveSetup({
          id: 'update-drone',
          name: 'Offline update drone',
          profileId: 'update-rates',
          camera: { tilt: 33, verticalFov: 105 },
        });
        await store.selectSetup('update-drone');
      });
      await page.evaluate(async (packageId) => {
        const { prepareOptionalOffline } = await import(
          '/revealline/optional-practice/install-context.mjs'
        );
        await prepareOptionalOffline({ packageId });
      }, id);
      await page.reload();
      await ready();
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      const initialStatus = await status(page);
      assert.equal(initialStatus.revision, old.revision);
      assert.equal(initialStatus.ready, true);
      await enterAdvanced(800);
      const before = await exportRecording();
      assert.equal(before.config.configuration.rateProfile.axes.roll.rate, 80);
      assert.ok(before.missionTicks >= 10);
      // A separate library owner saves next-flight values while this attempt remains paused.
      const saved = await page.evaluate(async () => {
        const { createTuningLibraryStore } = await import(
          '/revealline/optional-practice/civilian-fpv/tuning-library.mjs'
        );
        const store = createTuningLibraryStore({ storage: localStorage, locks: navigator.locks });
        const response = store
          .snapshot()
          .profiles.find((item) => item.id === 'update-rates').response;
        response.rates.axes.roll.rate = 90;
        await store.saveProfile('update-rates', { response });
        return store.export();
      });
      served = current;
      await page.evaluate(async () => {
        window.updateOriginalController = navigator.serviceWorker.controller;
        await (await navigator.serviceWorker.getRegistration()).update();
      });
      await page.evaluate(async () => {
        const deadline = performance.now() + 120000;
        for (;;) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration?.waiting?.state === 'installed') return;
          if (performance.now() > deadline)
            throw new Error('Updated worker did not enter waiting state');
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      });
      const waitingStatus = await status(page, 'waiting');
      assert.ok(
        waitingStatus,
        JSON.stringify(
          await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            return {
              active: reg?.active?.state,
              waiting: reg?.waiting?.state,
              installing: reg?.installing?.state,
              scope: reg?.scope,
              controller: navigator.serviceWorker.controller?.state,
            };
          }),
        ),
      );
      assert.equal(waitingStatus.revision, current.revision);
      assert.equal(waitingStatus.ready, true);
      assert.equal((await status(page)).revision, old.revision);
      assert.equal(
        await page.evaluate(
          () => navigator.serviceWorker.controller === window.updateOriginalController,
        ),
        true,
      );
      assert.ok(
        (
          await page.evaluate(
            async (url) => (await fetch(url)).text(),
            `${origin}${prefix}${stylePath}`,
          )
        ).endsWith(marker),
      );
      const during = await exportRecording();
      assert.deepEqual(
        during,
        before,
        'Installing an update or saving next-flight rates changed the paused attempt',
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem('revealline.fpv.tuning.v1')),
        saved,
      );
      const observer = await context.newPage();
      await observer.goto(`${origin}/observer`);
      await page.close();
      await observer.evaluate(async (base) => {
        const deadline = performance.now() + 30000;
        for (;;) {
          const registration = await navigator.serviceWorker.getRegistration(base);
          if (
            registration?.active &&
            !registration.waiting &&
            registration.active.state === 'activated'
          )
            return;
          if (performance.now() > deadline)
            throw new Error('Updated worker did not activate after scope tabs closed');
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }, base);
      const activatedStatus = await status(observer);
      assert.equal(activatedStatus.revision, current.revision);
      assert.equal(activatedStatus.ready, true);
      const retainedCaches = await observer.evaluate(() => caches.keys());
      assert.ok(retainedCaches.some((name) => name.endsWith(old.revision)));
      assert.ok(retainedCaches.some((name) => name.endsWith(current.revision)));
      await context.close();
      context = null;
      // Relaunch the same persistent browser profile completely offline.
      await launch();
      await context.setOffline(true);
      page = context.pages()[0];
      page.setDefaultTimeout(30000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}index.html?lang=en`);
      await ready();
      assert.equal(
        await page.evaluate(() => localStorage.getItem('revealline.fpv.tuning.v1')),
        saved,
      );
      const stored = JSON.parse(saved);
      assert.equal(stored.selectedSetupId, 'update-drone');
      assert.deepEqual(stored.setups.find((setup) => setup.id === 'update-drone').camera, {
        tilt: 33,
        verticalFov: 105,
      });
      assert.equal(
        stored.profiles.find((profile) => profile.id === 'update-rates').history.at(-1).response
          .rates.axes.roll.rate,
        80,
      );
      assert.equal((await status(page)).revision, current.revision);
      assert.equal(
        await page.evaluate(
          async (url) => (await fetch(url)).text(),
          `${origin}${prefix}${stylePath}`,
        ),
        current.files.get(stylePath).toString(),
      );
      await enterAdvanced(900);
      const after = await exportRecording();
      assert.equal(after.config.configuration.rateProfile.axes.roll.rate, 90);
      assert.ok(after.missionTicks >= 10);
      assert.equal(after.scored, false);
      await page
        .locator('.fpv-advanced-practice')
        .getByRole('button', { name: 'Return to tuning', exact: true })
        .click();
      assert.deepEqual(errors, []);
      const missing = requests.filter((request) => !request.found);
      assert.ok(
        missing.every(({ path }) =>
          ['/favicon.ico', `${prefix}game/ui/global-settings-tools.mjs`].includes(path),
        ),
        JSON.stringify(missing),
      );
      report.packages.push({
        id,
        persistentProfile: profile,
        earlierRevision: old.revision,
        currentRevision: current.revision,
        earlierInventory: old.inventory,
        currentInventory: current.inventory,
        initialStatus,
        waitingStatus,
        activatedStatus,
        activeAttemptUnchanged: true,
        priorControllerRetainedWhileOpen: true,
        activeRateDegreesPerSecond: 800,
        pendingNextFlightRateDegreesPerSecond: 900,
        restartedOfflineRateDegreesPerSecond: 900,
        savedLibrarySha256: sha(saved),
        savedLibraryBytes: Buffer.byteLength(saved),
        setupCamera: { tilt: 33, verticalFov: 105 },
        profileHistoryPreserved: true,
        browserProcessRestartedOffline: true,
        naturalActivationAfterScopeClosed: true,
        cacheDeletionPerformedByHarness: false,
        retainedCaches,
        missionTicksBefore: before.missionTicks,
        missionTicksAfter: after.missionTicks,
        pageErrors: errors,
        expectedUnavailablePaths: [...new Set(missing.map(({ path }) => path))],
      });
      await context.close();
      context = null;
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
    report.passed = true;
  } catch (error) {
    report.failure = error.stack;
  } finally {
    await context?.close();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    report.sources = [...bindings]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, sha256]) => ({ path: name, sha256 }));
    report.sourcesStable = (
      await Promise.all(
        report.sources.map(
          async (item) => sha(await readFile(path.join(root, item.path))) === item.sha256,
        ),
      )
    ).every(Boolean);
    report.runnerStable = sha(await readFile(runnerPath)) === report.runnerSha256;
    report.passed &&= report.sourcesStable && report.runnerStable;
    if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [playwrightModule, output] = process.argv.slice(2);
  if (!playwrightModule || !output || process.argv.length !== 4)
    throw new Error(
      'Usage: node scripts/smoke-fpv-offline-update.mjs PLAYWRIGHT_MODULE REPORT.json',
    );
  const report = await smokeFPVOfflineUpdate({ playwrightModule, output });
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        packages: report.packages.map(({ id, earlierRevision, currentRevision }) => ({
          id,
          earlierRevision,
          currentRevision,
        })),
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  process.exitCode = report.passed ? 0 : 1;
}
