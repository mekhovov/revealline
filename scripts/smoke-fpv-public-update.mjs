/* global window, document, localStorage, navigator, caches */
/** Bounded two-stage public HTTPS acceptance. Password enters only the ordinary form. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const ids = ['civilian-fpv', 'fpv-worlds'];
const runner = fileURLToPath(import.meta.url);
const libraryKey = 'revealline.fpv.tuning.v1';
const jsonWrite = (target, value) =>
  writeFile(target, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
async function publicBinding(root, expected) {
  const read = async (relative) => {
    const url = new URL(relative, root);
    url.searchParams.set('fpv-acceptance', `${Date.now()}`);
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    assert.ok(response.ok, `Public HTTP ${response.status}: ${relative}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const metadataBytes = await read('main-deployment.json'),
    metadata = JSON.parse(metadataBytes);
  assert.equal(metadata.format, 'revealline-main-deployment.v1');
  assert.equal(metadata.channel, 'main');
  assert.equal(metadata.sourceRevision, expected);
  const manifestBytes = await read('manifest.json'),
    manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.sourceRevision, expected, 'Public manifest differs from expected main');
  const inventory = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const pins = {},
    workers = {};
  for (const name of [
    'game/access-gate.mjs',
    'optional-practice/civilian-fpv/radio-profile.mjs',
    'optional-practice/civilian-fpv/app.mjs',
    'optional-practice/civilian-fpv/world-app.mjs',
    ...ids.flatMap((id) => [
      `optional-practice/${id}/index.html`,
      `optional-practice/${id}/worker.js`,
    ]),
    ...['tuning-ui.mjs', 'advanced-simulation.mjs', 'advanced-worker.mjs', 'rates.mjs']
      .map((name) => `optional-practice/civilian-fpv/${name}`)
      .filter((name) => inventory.has(name)),
  ]) {
    const pin = inventory.get(name);
    assert.ok(pin, `Missing public manifest entry: ${name}`);
    const bytes = await read(name);
    assert.equal(bytes.length, pin.bytes);
    assert.equal(sha(bytes), pin.sha256);
    pins[name] = pin;
    if (name.endsWith('/worker.js')) {
      const match = bytes.toString().match(/,\s*"([a-f0-9]{64})"\);\s*$/);
      assert.ok(match, `Cannot bind generated worker revision: ${name}`);
      workers[name.split('/')[1]] = match[1];
    }
  }
  return {
    metadata,
    metadataSha256: sha(metadataBytes),
    manifestSha256: sha(manifestBytes),
    pins,
    workers,
    tuningAvailable: inventory.has('optional-practice/civilian-fpv/tuning-ui.mjs'),
  };
}
const ready = (page) =>
  page.waitForFunction(
    () =>
      document.documentElement.dataset.accessState === 'unlocked' &&
      !document.documentElement.dataset.modeShellPending &&
      document.querySelector('[data-mode-action="settings"]'),
    null,
    { timeout: 60000 },
  );
const storageSnapshot = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(
        ([key]) =>
          key.startsWith('revealline.fpv.') || key.startsWith('revealline.flight-profiles.'),
      ),
    ),
  );
const settingValues = (page, id) =>
  page.evaluate((id) => {
    const academy = id === 'civilian-fpv',
      value = (name) => document.getElementById(name).value;
    return {
      tilt: Number(value(academy ? 'camera-tilt' : 'world-tilt')),
      verticalFov: Number(value(academy ? 'camera-fov' : 'world-fov')),
      keyboard: value(academy ? 'keyboard-preset' : 'flight-keyboard-preset'),
      touch: value(academy ? 'touch-response' : 'flight-touch-response'),
    };
  }, id);
const workerStatus = (page, base, kind = 'active') =>
  page.evaluate(
    async ({ base, kind }) => {
      const worker = (await navigator.serviceWorker.getRegistration(base))?.[kind];
      if (!worker) return null;
      return new Promise((resolve, reject) => {
        const channel = new MessageChannel(),
          timer = setTimeout(() => reject(new Error('Worker status timed out')), 30000);
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
async function prepareUI(page, id) {
  const academy = id === 'civilian-fpv';
  await page.locator('[data-mode-action="settings"]:visible').click();
  await page
    .getByRole('tab', { name: academy ? 'Help & Extras' : 'Content & Offline', exact: true })
    .click();
  if (academy) {
    await page.locator('#help').click();
    const summary = page
      .locator('#help-dialog summary')
      .filter({ hasText: /^Workshop & offline$/ });
    if (!(await summary.evaluate((node) => node.parentElement.open))) await summary.click();
  }
  const button = page.locator(academy ? '#install-offline' : '#prepare-runtime');
  await button.click();
  const status = page.locator(academy ? '#transfer-status' : '#settings-runtime-offline-status');
  const text = academy
    ? 'This exact optional package is ready offline.'
    : 'Offline runtime preparation completed.';
  await status.filter({ hasText: text }).waitFor({ state: 'visible', timeout: 180000 });
  return { control: await button.textContent(), completion: (await status.textContent()).trim() };
}
async function openTuning(page) {
  await page.locator('[data-mode-action="settings"]:visible').click();
  await page.getByRole('tab', { name: 'Controls', exact: true }).click();
  await page
    .getByRole('button', { name: 'Rates & throttle', exact: true })
    .filter({ visible: true })
    .click();
  await page.getByRole('dialog', { name: 'Rates & throttle', exact: true }).waitFor();
}
async function launch(chromium, profile, offline = false) {
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  await context.setOffline(offline);
  await context.addInitScript(() => {
    const Original = window.Worker;
    window.publicWorkerState = { created: 0, terminated: 0, tick: 0 };
    window.Worker = class extends Original {
      constructor(...args) {
        super(...args);
        const sequence = ++window.publicWorkerState.created;
        window.publicWorkerState.tick = 0;
        this.addEventListener('message', ({ data }) => {
          if (
            sequence === window.publicWorkerState.created &&
            data?.result?.telemetry?.missionTick !== undefined
          )
            window.publicWorkerState.tick = data.result.telemetry.missionTick;
        });
      }
      terminate() {
        window.publicWorkerState.terminated++;
        return super.terminate();
      }
    };
  });
  return context;
}

export async function smokeFPVPublicUpdate({
  mode,
  publicRoot,
  expectedRevision,
  statePath,
  output,
  playwrightModule,
}) {
  assert.ok(['prepare', 'complete'].includes(mode));
  assert.match(expectedRevision, /^[a-f0-9]{40}$/);
  const root = new URL(publicRoot.endsWith('/') ? publicRoot : `${publicRoot}/`);
  assert.equal(root.protocol, 'https:');
  assert.equal(root.username, '');
  assert.equal(root.password, '');
  assert.equal(root.search, '');
  assert.equal(root.hash, '');
  const password = process.env.FPV_LIVE_TEST_PASSWORD;
  delete process.env.FPV_LIVE_TEST_PASSWORD; // Never pass the secret to the browser subprocess environment.
  if (mode === 'prepare')
    assert.ok(password, 'FPV_LIVE_TEST_PASSWORD is required for the normal password form');
  const redact = (text) =>
    password ? String(text).split(password).join('[redacted]') : String(text);
  const report = {
    format: 'FPVPublicUpdateEvidence.v1',
    mode,
    generatedAt: new Date().toISOString(),
    publicRoot: root.href,
    expectedRevision,
    runnerSha256: sha(await readFile(runner)),
    passed: false,
    packages: [],
    authentication:
      'Ordinary public password form in isolated persistent Chrome profiles; no unlock injection.',
    limits: [
      'Single local Chrome host using public HTTPS; no physical-device, pilot, aircraft or performance qualification.',
      'No publication, cache clearing, forced worker activation, browser-profile replacement or existing user data access.',
      'Legacy calibration is synthetic and unverified. Camera/input preferences use production DOM handlers.',
      'New profile/backup checks use production library APIs; CLI patch uses the visible editor. Full backup download/upload UI and raw preset bundles are not covered.',
      'Advanced remains optional and unscored. Regional scene admission, OS-installed PWAs, storage eviction and other browsers are not covered.',
    ],
  };
  let context;
  try {
    const binding = await publicBinding(root, expectedRevision);
    report.publicBinding = binding;
    assert.equal(
      binding.tuningAvailable,
      mode === 'complete',
      'Public revision does not match expected pre/post tuning stage',
    );
    const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)));
    const state =
      mode === 'prepare'
        ? {
            format: 'FPVPublicUpdateState.v1',
            root: root.href,
            binding,
            preparedRunnerSha256: report.runnerSha256,
            packages: [],
          }
        : JSON.parse(await readFile(statePath, 'utf8'));
    if (mode === 'complete') report.preparationStateSha256 = sha(await readFile(statePath));
    assert.equal(state.format, 'FPVPublicUpdateState.v1');
    assert.equal(state.root, root.href);
    if (mode === 'complete')
      assert.notEqual(state.binding.metadata.sourceRevision, expectedRevision);
    for (const id of ids) {
      const base = new URL(`optional-practice/${id}/`, root).href;
      const saved = state.packages.find((item) => item.id === id);
      if (mode === 'complete') assert.ok(saved, `Prepared profile missing for ${id}`);
      const profile =
        saved?.profile ?? (await mkdtemp(path.join(os.tmpdir(), `fpv-public-update-${id}-`)));
      context = await launch(chromium, profile, mode === 'complete');
      report.browser = { engine: 'chrome', version: context.browser().version() };
      let page = context.pages()[0];
      page.setDefaultTimeout(60000);
      const errors = [];
      page.on('pageerror', (error) => errors.push(redact(error.message)));
      await page.goto(`${base}index.html?lang=en`);
      if (mode === 'prepare') {
        await page.locator('#access-gate').waitFor();
        assert.equal(await page.locator('html').getAttribute('data-access-state'), 'locked');
        await page.locator('#access-gate input[type="password"]').fill(password);
        await page
          .locator('#access-gate')
          .getByRole('button', { name: 'Unlock', exact: true })
          .click();
        await ready(page);
        const legacy = await page.evaluate(async (moduleURL) => {
          const { createFlightProfileStore, defaultRadioProfile, DEFAULT_RESPONSE } = await import(
            moduleURL
          );
          const store = createFlightProfileStore({ storage: localStorage });
          const radio = defaultRadioProfile();
          radio.id = 'public-synthetic';
          radio.name = 'Public migration fixture';
          radio.verified = false;
          radio.channels.roll.deadZone = 0.07;
          const result = store.save({
            format: 'FlightProfiles.v1',
            radio,
            response: {
              ...DEFAULT_RESPONSE,
              maxRate: 480,
              maxTilt: 42,
              expo: 45,
              responseTicks: 11,
            },
          });
          if (!result.saved) throw new Error(result.error);
          return store.library();
        }, new URL('optional-practice/civilian-fpv/radio-profile.mjs', root).href);
        await page.evaluate((id) => {
          const academy = id === 'civilian-fpv';
          const set = (name, value) => {
            const node = document.getElementById(name);
            node.value = value;
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
          };
          set(academy ? 'camera-tilt' : 'world-tilt', '27');
          set(academy ? 'camera-fov' : 'world-fov', '108');
          set(academy ? 'touch-response' : 'flight-touch-response', 'direct');
        }, id);
        await page.reload();
        await ready(page);
        const settings = await settingValues(page, id),
          storage = await storageSnapshot(page);
        assert.equal(settings.tilt, 27);
        assert.equal(settings.verticalFov, 108);
        const preparation = await prepareUI(page, id);
        await page.reload();
        await ready(page);
        await page.waitForFunction(() => !!navigator.serviceWorker.controller);
        const status = await workerStatus(page, base);
        assert.equal(status.revision, binding.workers[id]);
        assert.equal(status.ready, true);
        assert.deepEqual(errors, []);
        state.packages.push({
          id,
          base,
          profile,
          legacy,
          settings,
          storage,
          oldWorkerRevision: status.revision,
        });
        await jsonWrite(statePath, state);
        report.packages.push({
          id,
          base,
          profile,
          preparation,
          oldWorkerRevision: status.revision,
          settings,
          storageSha256: sha(JSON.stringify(storage)),
          passwordFormAccepted: true,
          pageErrors: errors,
        });
      } else {
        await ready(page);
        let waiting, retainedCaches;
        const resumedActivation = Boolean(saved.activation);
        if (resumedActivation) {
          assert.equal(saved.activation.expectedRevision, expectedRevision);
          assert.equal(saved.activation.manifestSha256, binding.manifestSha256);
          assert.equal((await workerStatus(page, base)).revision, binding.workers[id]);
          waiting = saved.activation.waiting;
          retainedCaches = await page.evaluate(() => caches.keys());
          assert.ok(retainedCaches.some((name) => name.endsWith(binding.workers[id])));
        } else {
          assert.equal((await workerStatus(page, base)).revision, saved.oldWorkerRevision);
          assert.deepEqual(await settingValues(page, id), saved.settings);
          await context.setOffline(false);
          await page.evaluate(async () => {
            window.publicOldController = navigator.serviceWorker.controller;
            await (await navigator.serviceWorker.getRegistration()).update();
          });
          await page.waitForFunction(
            async () =>
              (await navigator.serviceWorker.getRegistration())?.waiting?.state === 'installed',
            null,
            { timeout: 180000 },
          );
          waiting = await workerStatus(page, base, 'waiting');
          assert.equal(waiting.revision, binding.workers[id]);
          assert.equal(waiting.ready, true);
          assert.equal((await workerStatus(page, base)).revision, saved.oldWorkerRevision);
          assert.equal(
            await page.evaluate(
              () => navigator.serviceWorker.controller === window.publicOldController,
            ),
            true,
          );
          assert.deepEqual(await storageSnapshot(page), saved.storage);
          const observer = await context.newPage();
          await observer.goto(new URL('main-deployment.json', root).href);
          await page.close();
          await observer.waitForFunction(
            async (base) => {
              const reg = await navigator.serviceWorker.getRegistration(base);
              return reg?.active?.state === 'activated' && !reg.waiting;
            },
            base,
            { timeout: 60000 },
          );
          assert.equal((await workerStatus(observer, base)).revision, binding.workers[id]);
          retainedCaches = await observer.evaluate(() => caches.keys());
          assert.ok(retainedCaches.some((name) => name.endsWith(saved.oldWorkerRevision)));
          assert.ok(retainedCaches.some((name) => name.endsWith(binding.workers[id])));
          saved.activation = {
            expectedRevision,
            manifestSha256: binding.manifestSha256,
            waiting,
            retainedCaches,
            observedAt: new Date().toISOString(),
            oldControllerRetained: true,
            naturalActivationAfterScopeClosed: true,
          };
          await jsonWrite(statePath, state);
        }
        await context.close();
        context = await launch(chromium, profile, true);
        page = context.pages()[0];
        page.setDefaultTimeout(60000);
        page.on('pageerror', (error) => errors.push(redact(error.message)));
        await page.goto(`${base}index.html?lang=en`);
        await ready(page);
        assert.deepEqual(await settingValues(page, id), saved.settings);
        const currentStorage = await storageSnapshot(page);
        for (const [key, value] of Object.entries(saved.storage))
          assert.equal(currentStorage[key], value, `Legacy setting changed: ${key}`);
        await openTuning(page);
        assert.equal(
          await page.getByLabel('Camera tilt (degrees)', { exact: true }).inputValue(),
          '27',
        );
        assert.equal(
          await page.getByLabel('Vertical FOV (degrees)', { exact: true }).inputValue(),
          '108',
        );
        await page
          .getByRole('button', { name: 'Save drone assignment & camera', exact: true })
          .click();
        await page.waitForFunction((key) => localStorage.getItem(key) !== null, libraryKey);
        const backupCheck = await page.evaluate(
          async ({ root, expectedLegacy }) => {
            const { createTuningLibraryStore } = await import(
              new URL('optional-practice/civilian-fpv/tuning-library.mjs', root).href
            );
            const { createTunedResponse } = await import(
              new URL('optional-practice/civilian-fpv/flight-response.mjs', root).href
            );
            const { createFlightProfileStore } = await import(
              new URL('optional-practice/civilian-fpv/radio-profile.mjs', root).href
            );
            const old = createFlightProfileStore({ storage: localStorage }).library();
            if (JSON.stringify(old) !== JSON.stringify(expectedLegacy))
              throw new Error('Legacy radio/response changed');
            const store = createTuningLibraryStore({
              storage: localStorage,
              locks: navigator.locks,
            });
            const response = createTunedResponse();
            response.rates.axes.roll.rate = 90;
            const existing = store
              .snapshot()
              .profiles.find((profile) => profile.id === 'public-rates');
            if (existing) {
              if (JSON.stringify(existing.response) !== JSON.stringify(response))
                throw new Error('Existing public acceptance profile differs');
            } else
              await store.createProfile({
                id: 'public-rates',
                name: 'Public rates acceptance',
                response,
              });
            await store.setDefault('public-rates');
            const backup = store.export();
            await store.saveProfile('public-rates', { name: 'Temporary restore check' });
            await store.restore(backup);
            const before = JSON.parse(backup),
              after = JSON.parse(store.export());
            delete before.revision;
            delete after.revision;
            if (JSON.stringify(before) !== JSON.stringify(after))
              throw new Error('Backup restore changed data');
            return {
              restored: true,
              libraryBytes: new TextEncoder().encode(store.export()).length,
            };
          },
          { root: root.href, expectedLegacy: saved.legacy },
        );
        await page.reload();
        await ready(page);
        await openTuning(page);
        await page.getByLabel('Rate profile', { exact: true }).selectOption('public-rates');
        await page
          .locator('.fpv-tuning details')
          .filter({ has: page.locator('textarea') })
          .locator('summary')
          .click();
        await page
          .getByLabel('Source / export firmware version', { exact: true })
          .selectOption('2025.12.5');
        await page
          .getByLabel('Paste CLI or a SIM rate profile', { exact: true })
          .fill('set rates_type = ACTUAL\nset roll_srate = 88');
        await page.getByRole('button', { name: 'Preview import', exact: true }).click();
        await page.waitForFunction(() =>
          document
            .querySelector('.fpv-tuning')
            .textContent.includes('Preview only. Save as a new profile'),
        );
        const beforeImportCount = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).profiles.length,
          libraryKey,
        );
        await page.getByRole('button', { name: 'Save import as new profile', exact: true }).click();
        await page.waitForFunction(
          ({ key, count }) => {
            const profiles = JSON.parse(localStorage.getItem(key)).profiles;
            return (
              profiles.length > count &&
              profiles.some((item) => item.provenance && item.response.rates.axes.roll.rate === 88)
            );
          },
          { key: libraryKey, count: beforeImportCount },
        );
        await page.getByLabel('Rate profile', { exact: true }).selectOption('public-rates');
        await page
          .getByRole('button', { name: 'Advanced reference quad · experimental', exact: true })
          .click();
        const pane = page.locator('.fpv-advanced-practice');
        await pane.getByRole('button', { name: 'Start practice', exact: true }).click();
        await page.waitForFunction(() => window.publicWorkerState.tick >= 10);
        await pane.getByRole('button', { name: 'Pause', exact: true }).click();
        const expectedWorkerURL = new URL(`optional-practice/${id}/advanced-worker.mjs`, root).href;
        assert.deepEqual(
          page.workers().map((worker) => worker.url()),
          [expectedWorkerURL],
        );
        const pending = page.waitForEvent('download');
        await pane.getByRole('button', { name: 'Export practice recording', exact: true }).click();
        const download = await pending,
          recordingBytes = await readFile(await download.path()),
          recording = JSON.parse(recordingBytes);
        const recordingPath = `${output.replace(/\.json$/, '')}-${id}-recording.json`;
        await writeFile(recordingPath, recordingBytes, { mode: 0o600 });
        assert.equal(recording.format, 'AdvancedRecording.v1');
        assert.equal(recording.scored, false);
        assert.ok(recording.missionTicks >= 10);
        assert.equal(recording.config.configuration.rateProfile.axes.roll.rate, 90);
        await page.evaluate(
          async ({ root, recording }) => {
            const { replayAdvancedRecording } = await import(
              new URL('optional-practice/civilian-fpv/advanced-simulation.mjs', root).href
            );
            await replayAdvancedRecording(recording);
          },
          { root: root.href, recording },
        );
        await pane.getByRole('button', { name: 'Return to tuning', exact: true }).click();
        await page.waitForFunction(
          () => window.publicWorkerState.created === window.publicWorkerState.terminated,
        );
        assert.deepEqual(errors, []);
        report.packages.push({
          id,
          profile,
          oldWorkerRevision: saved.oldWorkerRevision,
          currentWorkerRevision: waiting.revision,
          naturalActivation: true,
          resumedAfterPreviouslyObservedActivation: resumedActivation,
          activationObservedAt: saved.activation.observedAt,
          browserRestartedOffline: true,
          legacySettingsPreserved: true,
          migratedCamera: { tilt: 27, verticalFov: 108 },
          backupCheck,
          cliPatchRateDegreesPerSecond: 880,
          expectedWorkerURL,
          recordingPath,
          recordingSha256: sha(recordingBytes),
          missionTicks: recording.missionTicks,
          finalHash: recording.finalHash,
          replayVerified: true,
          scored: false,
          workerCleanup: await page.evaluate(() => ({ ...window.publicWorkerState })),
          retainedCaches,
          pageErrors: errors,
        });
      }
      await context.close();
      context = null;
    }
    const after = await publicBinding(root, expectedRevision);
    assert.equal(
      after.manifestSha256,
      binding.manifestSha256,
      'Deployment changed during acceptance',
    );
    assert.equal(
      after.metadataSha256,
      binding.metadataSha256,
      'Deployment metadata changed during acceptance',
    );
    report.passed = true;
  } catch (error) {
    report.failure = redact(error.stack);
  } finally {
    await context?.close();
    report.runnerStable = sha(await readFile(runner)) === report.runnerSha256;
    report.passed &&= report.runnerStable;
    await jsonWrite(output, report);
  }
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === runner) {
  const [mode, publicRoot, expectedRevision, statePath, output, playwrightModule] =
    process.argv.slice(2);
  assert.equal(
    process.argv.length,
    8,
    'Usage: node scripts/smoke-fpv-public-update.mjs prepare|complete HTTPS_ROOT EXPECTED_SHA STATE.json REPORT.json PLAYWRIGHT_MODULE',
  );
  const report = await smokeFPVPublicUpdate({
    mode,
    publicRoot,
    expectedRevision,
    statePath,
    output,
    playwrightModule,
  });
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        mode,
        expectedRevision,
        packages: report.packages.map(({ id }) => id),
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  process.exitCode = report.passed ? 0 : 1;
}
