/* global window, document, localStorage, navigator, caches */
/** Actual pre-tuning main -> feature migration, using each revision's own package builder. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildOptionalPractice } from './build-optional-practice.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const prefix = '/revealline/';
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
const git = async (...args) =>
  (await run('git', args, { cwd: root, maxBuffer: 128 * 1024 * 1024 })).stdout;

async function historicalSource(ref) {
  assert.match(ref, /^[a-f0-9]{40}$/);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fpv-historical-source-'));
  const names = (await git('ls-tree', '-r', '--name-only', ref)).trim().split('\n');
  const selected = names.filter(
    (name) =>
      name.startsWith('optional-practice/') ||
      name.startsWith('scripts/') ||
      name.startsWith('game/locales/') ||
      name.startsWith('game/vendor/') ||
      name.startsWith('game/ui/art/identity/') ||
      (/\.(?:mjs|js)$/.test(name) &&
        !name.startsWith('game/test/') &&
        (name.startsWith('game/') || name.startsWith('publishing/'))),
  );
  const archive = path.join(directory, 'source.tar');
  await run('git', ['archive', '--format=tar', `--output=${archive}`, ref, ...selected], {
    cwd: root,
  });
  await run('tar', ['-xf', archive, '-C', directory]);
  // Only the installed tool dependencies are shared. Every package source is a Git blob.
  await symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'));
  const { OPTIONAL_PACKAGE_POLICIES } = await import(
    pathToFileURL(path.join(directory, 'publishing/optional-package-policy.mjs'))
  );
  const missing = new Set();
  for (const id of ['civilian-fpv', 'fpv-worlds']) {
    const policy = OPTIONAL_PACKAGE_POLICIES[id];
    for (const name of [
      ...policy.localFiles.map((name) => policy.root + name),
      ...policy.sharedFiles,
    ])
      if (names.includes(name) && !selected.includes(name)) missing.add(name);
  }
  if (missing.size) {
    await run('git', ['archive', '--format=tar', `--output=${archive}`, ref, ...missing], {
      cwd: root,
    });
    await run('tar', ['-xf', archive, '-C', directory]);
  }
  const builderPath = path.join(directory, 'scripts/build-optional-practice.mjs');
  const { buildOptionalPractice: build } = await import(pathToFileURL(builderPath));
  return { directory, build, builderSha256: sha(await readFile(builderPath)) };
}

export async function smokeFPVHistoricalUpdate({
  playwrightModule,
  output,
  historicalRef = '8b0199194',
}) {
  const runnerPath = fileURLToPath(import.meta.url);
  const oldCommit = (await git('rev-parse', `${historicalRef}^{commit}`)).trim();
  const currentCommit = (await git('rev-parse', 'HEAD')).trim();
  const report = {
    format: 'FPVHistoricalOfflineUpdateEvidence.v1',
    generatedAt: new Date().toISOString(),
    node: process.version,
    runnerSha256: sha(await readFile(runnerPath)),
    historicalCommit: oldCommit,
    currentHeadAtStart: currentCommit,
    passed: false,
    published: false,
    limits: [
      'Local Chrome secure context and disposable persistent profile; no public HTTPS deployment, real password entry, physical radio or pilot qualification.',
      'Historical packages are generated from the exact pre-tuning main commit by its own unmodified builder; this does not represent every earlier release.',
      'Legacy radio data is synthetic calibration data saved through the historical production store; no connected radio is simulated or claimed.',
      'Existing settings are changed through their historical DOM event handlers. Offline preparation uses the production API and registration.update().',
      'Natural worker activation occurs after all scope tabs close. No skipWaiting, storage clearing, cache deletion or user browser data access.',
      'Direct optional-package routes, not a full Pages build. No physics, performance, OS-installed app or storage-eviction qualification.',
    ],
    packages: [],
    sources: [],
  };
  const bindings = new Map();
  for (const name of [
    'scripts/build-optional-practice.mjs',
    'scripts/game-cli.mjs',
    'scripts/optional-launcher.mjs',
    'publishing/optional-package-policy.mjs',
    'publishing/optional-import-capabilities.mjs',
    'package-lock.json',
  ])
    bindings.set(name, sha(await readFile(path.join(root, name))));
  const historical = await historicalSource(oldCommit);
  report.historicalSourceDirectory = historical.directory;
  report.historicalBuilderSha256 = historical.builderSha256;
  const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)));
  let context, server;
  try {
    for (const id of ['civilian-fpv', 'fpv-worlds']) {
      const prior = await historical.build(historical.directory, { packageId: id });
      const next = await buildOptionalPractice(root, { packageId: id });
      for (const [name, bytes] of next.inputs) bindings.set(name, sha(bytes));
      const historicalInputs = [];
      for (const [name, bytes] of prior.inputs) {
        const { stdout: blob } = await run('git', ['show', `${oldCommit}:${name}`], {
          cwd: root,
          encoding: 'buffer',
          maxBuffer: 32 * 1024 * 1024,
        });
        assert.ok(bytes.equals(blob), `Historical source differs from Git: ${name}`);
        historicalInputs.push({ path: name, sha256: sha(bytes) });
      }
      const artifact = (result) => ({
        revision: result.manifest.revision,
        files: new Map(result.entries.map(({ name, bytes }) => [name, bytes])),
        inventory: result.manifest.files,
      });
      const old = artifact(prior),
        current = artifact(next);
      assert.notEqual(old.revision, current.revision);
      assert.equal(old.files.has('optional-practice/civilian-fpv/tuning-ui.mjs'), false);
      assert.equal(current.files.has('optional-practice/civilian-fpv/tuning-ui.mjs'), true);
      let served = old;
      const requests = [],
        errors = [];
      server = createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/observer') {
          response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
          response.end('<!doctype html><title>Historical update observer</title>');
          return;
        }
        const name = decodeURIComponent(url.pathname.slice(prefix.length));
        const bytes = url.pathname.startsWith(prefix) && served.files.get(name);
        requests.push({ path: url.pathname, revision: served.revision, found: !!bytes });
        response.writeHead(bytes ? 200 : 404, {
          'Content-Type': mime[path.extname(name)] ?? 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        response.end(bytes || undefined);
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const origin = `http://127.0.0.1:${server.address().port}`;
      const base = `${origin}${prefix}optional-practice/${id}/`;
      const profile = await mkdtemp(path.join(os.tmpdir(), `fpv-historical-update-${id}-`));
      const launch = async () => {
        context = await chromium.launchPersistentContext(profile, {
          channel: 'chrome',
          headless: true,
          viewport: { width: 1440, height: 1000 },
          acceptDownloads: true,
        });
        report.browser = { engine: 'chrome', version: context.browser().version() };
      };
      await launch();
      let page = context.pages()[0];
      page.setDefaultTimeout(30000);
      page.on('pageerror', (error) => errors.push(error.message));
      const ready = () =>
        page.waitForFunction(
          () =>
            document.documentElement.dataset.accessState === 'unlocked' &&
            !document.documentElement.dataset.modeShellPending &&
            document.querySelector('[data-mode-action="settings"]'),
        );
      const status = (target, kind = 'active') =>
        target.evaluate(
          async ({ base, kind }) => {
            const worker = (await navigator.serviceWorker.getRegistration(base))?.[kind];
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
      const values = () =>
        page.evaluate((id) => {
          const academy = id === 'civilian-fpv';
          const value = (name) => document.getElementById(name).value;
          return {
            tilt: Number(value(academy ? 'camera-tilt' : 'world-tilt')),
            verticalFov: Number(value(academy ? 'camera-fov' : 'world-fov')),
            keyboard: value(academy ? 'keyboard-preset' : 'flight-keyboard-preset'),
            touch: value(academy ? 'touch-response' : 'flight-touch-response'),
            comfort: document.querySelector('[data-flight-comfort="size"]').value,
            opacity: document.querySelector('[data-flight-comfort="opacity"]').value,
          };
        }, id);
      const storage = () =>
        page.evaluate(() =>
          Object.fromEntries(
            Object.entries(localStorage).filter(
              ([key]) =>
                key.startsWith('revealline.fpv.') || key.startsWith('revealline.flight-profiles.'),
            ),
          ),
        );
      const openTuning = async () => {
        await page.locator('[data-mode-action="settings"]:visible').click();
        await page.getByRole('tab', { name: 'Controls', exact: true }).click();
        await page
          .getByRole('button', { name: 'Aircraft, rates & throttle', exact: true })
          .filter({ visible: true })
          .click();
        await page
          .getByRole('dialog', { name: 'Aircraft, rates & throttle', exact: true })
          .waitFor();
      };
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
      const legacy = await page.evaluate(async () => {
        const { createFlightProfileStore, defaultRadioProfile, DEFAULT_RESPONSE } = await import(
          '/revealline/optional-practice/civilian-fpv/radio-profile.mjs'
        );
        const store = createFlightProfileStore({ storage: localStorage });
        const radio = defaultRadioProfile();
        radio.id = 'historical-synthetic';
        radio.name = 'Synthetic migration fixture';
        radio.verified = false;
        radio.channels.roll.deadZone = 0.07;
        radio.channels.pitch.invert = true;
        const response = {
          ...DEFAULT_RESPONSE,
          maxRate: 480,
          maxTilt: 42,
          expo: 45,
          responseTicks: 11,
        };
        const result = store.save({ format: 'FlightProfiles.v1', radio, response });
        if (!result.saved) throw new Error(result.error);
        return { snapshot: store.snapshot(), library: store.library() };
      });
      await page.evaluate((id) => {
        const academy = id === 'civilian-fpv';
        const set = (selector, value) => {
          const node = document.querySelector(selector);
          node.value = value;
          node.dispatchEvent(new Event('input', { bubbles: true }));
          node.dispatchEvent(new Event('change', { bubbles: true }));
        };
        set(academy ? '#camera-tilt' : '#world-tilt', '27');
        set(academy ? '#camera-fov' : '#world-fov', '108');
        const keyboard = document.getElementById(
          academy ? 'keyboard-preset' : 'flight-keyboard-preset',
        );
        set(
          `#${keyboard.id}`,
          [...keyboard.options].find((option) => option.value !== keyboard.value).value,
        );
        set(academy ? '#touch-response' : '#flight-touch-response', 'direct');
        set('[data-flight-comfort="size"]', 'large');
        set('[data-flight-comfort="opacity"]', 'strong');
      }, id);
      await page.reload();
      await ready();
      const beforeValues = await values(),
        beforeStorage = await storage();
      assert.equal(beforeValues.tilt, 27);
      assert.equal(beforeValues.verticalFov, 108);
      assert.equal(beforeValues.touch, 'direct');
      assert.equal(beforeValues.comfort, 'large');
      assert.equal(beforeValues.opacity, 'strong');
      assert.equal(
        await page.getByRole('button', { name: 'Aircraft, rates & throttle', exact: true }).count(),
        0,
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem('revealline.fpv.tuning.v1')),
        null,
      );
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
      served = current;
      await page.evaluate(async () => {
        window.historicalOriginalController = navigator.serviceWorker.controller;
        await (await navigator.serviceWorker.getRegistration()).update();
      });
      await page.evaluate(async () => {
        const deadline = performance.now() + 120000;
        while ((await navigator.serviceWorker.getRegistration())?.waiting?.state !== 'installed') {
          if (performance.now() > deadline)
            throw new Error('Historical update worker did not wait');
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      });
      const waitingStatus = await status(page, 'waiting');
      assert.equal(waitingStatus.revision, current.revision);
      assert.equal(waitingStatus.ready, true);
      assert.equal((await status(page)).revision, old.revision);
      assert.equal(
        await page.evaluate(
          () => navigator.serviceWorker.controller === window.historicalOriginalController,
        ),
        true,
      );
      assert.deepEqual(await values(), beforeValues);
      assert.deepEqual(await storage(), beforeStorage);
      const oldRuntimePath = 'optional-practice/civilian-fpv/radio-profile.mjs';
      const servedOldRuntime = await page.evaluate(
        async (url) => (await fetch(url)).text(),
        `${origin}${prefix}${oldRuntimePath}`,
      );
      assert.equal(sha(servedOldRuntime), sha(old.files.get(oldRuntimePath)));
      const observer = await context.newPage();
      await observer.goto(`${origin}/observer`);
      await page.close();
      await observer.evaluate(async (base) => {
        const deadline = performance.now() + 30000;
        for (;;) {
          const registration = await navigator.serviceWorker.getRegistration(base);
          if (registration?.active?.state === 'activated' && !registration.waiting) return;
          if (performance.now() > deadline)
            throw new Error('Updated worker did not activate naturally');
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
      await launch();
      await context.setOffline(true);
      page = context.pages()[0];
      page.setDefaultTimeout(30000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}index.html?lang=en`);
      await ready();
      assert.deepEqual(
        await values(),
        beforeValues,
        'Legacy visible preferences changed after update',
      );
      const afterStorage = await storage();
      for (const [key, value] of Object.entries(beforeStorage))
        assert.equal(afterStorage[key], value, `Legacy storage changed: ${key}`);
      const restoredLegacy = await page.evaluate(async () => {
        const { createFlightProfileStore } = await import(
          '/revealline/optional-practice/civilian-fpv/radio-profile.mjs'
        );
        const store = createFlightProfileStore({ storage: localStorage });
        return { snapshot: store.snapshot(), library: store.library() };
      });
      assert.deepEqual(restoredLegacy, legacy);
      await openTuning();
      assert.equal(
        await page.getByLabel('Rate profile', { exact: true }).inputValue(),
        'legacy-feel',
      );
      assert.equal(
        await page.getByLabel('Camera tilt (degrees)', { exact: true }).inputValue(),
        '27',
      );
      assert.equal(
        await page.getByLabel('Vertical FOV (degrees)', { exact: true }).inputValue(),
        '108',
      );
      // First persist the migrated setup through the actual editor before creating new rates.
      await page
        .getByRole('button', { name: 'Save drone assignment & camera', exact: true })
        .click();
      await page.waitForFunction(() => localStorage.getItem('revealline.fpv.tuning.v1') !== null);
      const migrated = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('revealline.fpv.tuning.v1')),
      );
      assert.deepEqual(migrated.profiles[0].response, legacy.snapshot.response);
      assert.deepEqual(migrated.setups[0].camera, { tilt: 27, verticalFov: 108 });
      const saved = await page.evaluate(async () => {
        const { createTuningLibraryStore } = await import(
          '/revealline/optional-practice/civilian-fpv/tuning-library.mjs'
        );
        const { createTunedResponse } = await import(
          '/revealline/optional-practice/civilian-fpv/flight-response.mjs'
        );
        const store = createTuningLibraryStore({ storage: localStorage, locks: navigator.locks });
        const response = createTunedResponse();
        response.rates.axes.roll.rate = 90;
        await store.createProfile({
          id: 'historical-new-rates',
          name: 'After offline update',
          response,
        });
        await store.setDefault('historical-new-rates');
        await store.saveSetup({
          id: 'historical-new-drone',
          name: 'After update drone',
          profileId: 'historical-new-rates',
          camera: { tilt: 33, verticalFov: 105 },
        });
        await store.selectSetup('historical-new-drone');
        return store.export();
      });
      await context.close();
      context = null;
      await launch();
      await context.setOffline(true);
      page = context.pages()[0];
      page.setDefaultTimeout(30000);
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${base}index.html?lang=en`);
      await ready();
      await openTuning();
      assert.equal(
        await page.getByLabel('Rate profile', { exact: true }).inputValue(),
        'historical-new-rates',
      );
      assert.equal(
        await page
          .getByRole('group', { name: 'Roll', exact: true })
          .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
          .inputValue(),
        '900',
      );
      assert.equal(
        await page.getByLabel('Camera tilt (degrees)', { exact: true }).inputValue(),
        '33',
      );
      assert.equal(
        await page.getByLabel('Vertical FOV (degrees)', { exact: true }).inputValue(),
        '105',
      );
      assert.equal(
        await page.evaluate(() => localStorage.getItem('revealline.fpv.tuning.v1')),
        saved,
      );
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
        historicalInputs,
        earlierInventory: old.inventory,
        currentInventory: current.inventory,
        initialStatus,
        waitingStatus,
        activatedStatus,
        legacySettings: beforeValues,
        legacyResponse: legacy.snapshot.response,
        legacyRadioSha256: sha(JSON.stringify(legacy.snapshot.radio)),
        legacyStorageHashes: Object.fromEntries(
          Object.entries(beforeStorage).map(([key, value]) => [key, sha(value)]),
        ),
        legacyStoragePreserved: true,
        legacyRadioAndResponsePreserved: true,
        migratedCamera: migrated.setups[0].camera,
        migrationPersistedThroughEditor: true,
        newOfflineProfileRateDegreesPerSecond: 900,
        savedLibrarySha256: sha(saved),
        savedLibraryBytes: Buffer.byteLength(saved),
        browserProcessRestartsOffline: 2,
        priorControllerRetainedWhileOpen: true,
        naturalActivationAfterScopeClosed: true,
        cacheDeletionPerformedByHarness: false,
        retainedCaches,
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
  const [playwrightModule, output, historicalRef] = process.argv.slice(2);
  if (!playwrightModule || !output || process.argv.length > 5)
    throw new Error(
      'Usage: node scripts/smoke-fpv-historical-update.mjs PLAYWRIGHT_MODULE REPORT.json [HISTORICAL_REF]',
    );
  const report = await smokeFPVHistoricalUpdate({ playwrightModule, output, historicalRef });
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        historicalCommit: report.historicalCommit,
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
