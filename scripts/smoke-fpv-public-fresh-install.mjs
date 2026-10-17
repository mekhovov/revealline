/* global window, document, localStorage, navigator */
/** Fresh public HTTPS installation only; isolated profiles and ordinary visible controls. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const runner = fileURLToPath(import.meta.url);
const ids = ['civilian-fpv', 'fpv-worlds'];
const libraryKey = 'revealline.fpv.tuning.v1';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const jsonWrite = (target, value) =>
  writeFile(target, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });

async function bounded(promise, milliseconds, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function publicBinding(root, expected) {
  const read = async (relative) => {
    const url = new URL(relative, root);
    url.searchParams.set('fpv-fresh-install', `${Date.now()}`);
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    assert.ok(response.ok, `Public HTTP ${response.status}: ${relative}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const metadataBytes = await read('main-deployment.json');
  const metadata = JSON.parse(metadataBytes);
  assert.equal(metadata.format, 'revealline-main-deployment.v1');
  assert.equal(metadata.channel, 'main');
  assert.equal(metadata.sourceRevision, expected);
  assert.equal(metadata.buildVersion, `main-${expected.slice(0, 12)}`);
  const manifestBytes = await read('manifest.json');
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.sourceRevision, expected);
  const inventory = new Map(manifest.files.map((entry) => [entry.path, entry]));
  const pins = {},
    workers = {};
  const names = [
    'game/access-gate.mjs',
    ...[
      'app.mjs',
      'world-app.mjs',
      'tuning-ui.mjs',
      'tuning-library.mjs',
      'rates.mjs',
      'advanced-simulation.mjs',
      'advanced-practice.mjs',
      'advanced-regional.mjs',
      'betaflight-import.mjs',
    ].map((name) => `optional-practice/civilian-fpv/${name}`),
    ...ids.flatMap((id) =>
      ['index.html', 'worker.js', 'advanced-worker.mjs'].map(
        (name) => `optional-practice/${id}/${name}`,
      ),
    ),
  ];
  for (const name of names) {
    const pin = inventory.get(name);
    assert.ok(pin, `Missing public manifest entry: ${name}`);
    const bytes = await read(name);
    assert.equal(bytes.length, pin.bytes, `Public byte count differs: ${name}`);
    assert.equal(sha(bytes), pin.sha256, `Public hash differs: ${name}`);
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

// Observe only bounded startup metadata. Never read form values, storage, request
// bodies, headers, query strings, fragments, or page text into the report.
export async function observeFPVStartup(
  page,
  evidence,
  stage,
  action,
  { redact = String, now = () => performance.now(), captureTimeoutMs = 3000 } = {},
) {
  const started = now();
  const elapsed = () => Math.max(0, Math.round(now() - started));
  const resource = (value) => {
    try {
      const url = new URL(value);
      return ['https:', 'http:'].includes(url.protocol)
        ? redact(url.pathname).slice(0, 256)
        : `[${url.protocol} resource]`;
    } catch {
      return '[invalid resource URL]';
    }
  };
  const report = { stage, passed: false, requestsSeen: 0, requestsOmitted: 0, requests: [] };
  (evidence.startups ??= []).push(report);
  const requests = new Map();
  const request = (item) => {
    report.requestsSeen++;
    if (requests.size >= 256) {
      report.requestsOmitted++;
      return;
    }
    const entry = {
      resource: resource(item.url()),
      type: item.resourceType(),
      startedMs: elapsed(),
    };
    requests.set(item, entry);
    report.requests.push(entry);
  };
  const response = (item) => {
    const entry = requests.get(item.request());
    if (entry) entry.status = item.status();
  };
  const finished = (item) => {
    const entry = requests.get(item);
    if (entry) entry.finishedMs = elapsed();
  };
  const failed = (item) => {
    const entry = requests.get(item);
    if (entry) {
      entry.failedMs = elapsed();
      entry.failure = redact(item.failure()?.errorText ?? 'request failed').slice(0, 256);
    }
  };
  const listeners = { request, response, requestfinished: finished, requestfailed: failed };
  for (const [event, handler] of Object.entries(listeners)) page.on(event, handler);
  try {
    const result = await action();
    report.passed = true;
    return result;
  } finally {
    report.elapsedMs = elapsed();
    for (const [event, handler] of Object.entries(listeners)) page.off(event, handler);
    try {
      report.state = await bounded(
        page.evaluate(() => ({
          access: ['locked', 'unlocked', 'failed'].includes(
            document.documentElement.dataset.accessState,
          )
            ? document.documentElement.dataset.accessState
            : 'unknown',
          documentReady: document.readyState,
          shellPending: !!document.documentElement.dataset.modeShellPending,
          settingsPresent: !!document.querySelector('[data-mode-action="settings"]'),
          passwordFormPresent: !!document.querySelector('#access-gate input[type="password"]'),
          inertScriptCount: document.querySelectorAll('script[data-access-type]').length,
          serviceWorkerControlled: !!navigator.serviceWorker?.controller,
        })),
        captureTimeoutMs,
        'Startup state capture timed out',
      );
    } catch (error) {
      report.captureFailure = redact(error.message).slice(0, 256);
    }
    report.pendingRequests = report.requests.filter(
      (entry) => entry.finishedMs === undefined && entry.failedMs === undefined,
    ).length;
  }
}

async function launch(chromium, profile, offline) {
  const env = { ...process.env };
  delete env.FPV_LIVE_TEST_PASSWORD;
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    env,
    timeout: 60000,
  });
  await context.setOffline(offline);
  await context.addInitScript(() => {
    const Original = window.Worker;
    window.freshInstallWorkers = { created: 0, terminated: 0, tick: 0 };
    window.Worker = class extends Original {
      constructor(...args) {
        super(...args);
        const sequence = ++window.freshInstallWorkers.created;
        window.freshInstallWorkers.tick = 0;
        this.addEventListener('message', ({ data }) => {
          if (
            sequence === window.freshInstallWorkers.created &&
            data?.result?.telemetry?.missionTick !== undefined
          )
            window.freshInstallWorkers.tick = data.result.telemetry.missionTick;
        });
      }
      terminate() {
        window.freshInstallWorkers.terminated++;
        return super.terminate();
      }
    };
  });
  return context;
}

async function workerStatus(page, base) {
  return page.evaluate(async (base) => {
    const registration = await navigator.serviceWorker.getRegistration(base);
    const worker = registration?.active;
    if (!worker) throw new Error('No active installed service worker');
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const timer = setTimeout(() => {
        channel.port1.close();
        reject(new Error('Worker status timed out'));
      }, 30000);
      channel.port1.onmessage = ({ data }) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve({
          revision: data.revision,
          ready: data.ready,
          state: worker.state,
          scope: registration.scope,
          controllerURL: navigator.serviceWorker.controller?.scriptURL,
        });
      };
      worker.postMessage({ type: 'practice-status' }, [channel.port2]);
    });
  }, base);
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

async function installThroughUI(page, id) {
  const academy = id === 'civilian-fpv';
  await page.locator('[data-mode-action="settings"]:visible').click();
  await page
    .getByRole('tab', {
      name: academy ? 'Help & Extras' : 'Content & Offline',
      exact: true,
    })
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

export async function smokeFPVPublicFreshInstall({
  publicRoot,
  expectedRevision,
  output,
  playwrightModule,
}) {
  const password = process.env.FPV_LIVE_TEST_PASSWORD;
  delete process.env.FPV_LIVE_TEST_PASSWORD;
  const redact = (value) =>
    password ? String(value).split(password).join('[redacted]') : String(value);
  const report = {
    format: 'FPVPublicFreshInstallEvidence.v1',
    generatedAt: new Date().toISOString(),
    expectedRevision,
    publicRoot,
    runnerSha256: sha(await readFile(runner)),
    passed: false,
    packages: [],
    phase: 'validate',
    authentication:
      'Ordinary public password form; no unlock injection; credential excluded from browser subprocess environment.',
    limits: [
      'Fresh isolated persistent Chrome profiles on one desktop; not OS-installed PWAs, other browsers, storage eviction or physical-device qualification.',
      'Visible production controls create/save rates and prepare offline content. Same browser profile is reopened offline in a new browser process.',
      'Advanced reference practice is optional and unscored. Short neutral-input recordings test offline worker loading/export/replay/disposal, not flight fidelity, Regional streaming or throughput.',
      'Replay verification calls the published production evaluator. This is not coverage of the recording import interface or all profile transfer workflows.',
      'No existing user profiles, production mutations, forced service-worker activation or cache clearing. Test profiles and short recordings are retained for diagnosis.',
      'Startup diagnostics retain at most 256 request paths and coarse browser state per stage; timing is observer elapsed time, not physical input latency. Truncation is explicit and no credential, request body, headers, query or page text is captured.',
    ],
  };
  let context;
  try {
    assert.ok(password, 'FPV_LIVE_TEST_PASSWORD is required for the normal password form');
    assert.match(expectedRevision, /^[a-f0-9]{40}$/);
    const root = new URL(publicRoot.endsWith('/') ? publicRoot : `${publicRoot}/`);
    assert.equal(root.protocol, 'https:');
    assert.equal(root.username, '');
    assert.equal(root.password, '');
    assert.equal(root.search, '');
    assert.equal(root.hash, '');
    report.publicRoot = root.href;
    report.phase = 'bind-public-source';
    const binding = await publicBinding(root, expectedRevision);
    report.publicBinding = binding;
    const { chromium } = await import(pathToFileURL(path.resolve(playwrightModule)));
    for (const id of ids) {
      const base = new URL(`optional-practice/${id}/`, root).href;
      const profile = await mkdtemp(path.join(os.tmpdir(), `fpv-public-fresh-${id}-`));
      const evidence = { id, base, profile, passed: false, pageErrors: [] };
      report.packages.push(evidence);
      report.phase = `${id}:fresh-password`;
      context = await launch(chromium, profile, false);
      report.browser = { engine: 'chrome', version: context.browser().version() };
      let page = context.pages()[0];
      page.setDefaultTimeout(60000);
      page.on('pageerror', (error) => evidence.pageErrors.push(redact(error.message)));
      await observeFPVStartup(
        page,
        evidence,
        'fresh-password',
        async () => {
          await page.goto(`${base}index.html?lang=en`);
          await page.locator('#access-gate').waitFor();
          assert.equal(await page.locator('html').getAttribute('data-access-state'), 'locked');
          evidence.initiallyLocked = true;
          await page.locator('#access-gate input[type="password"]').fill(password);
          await page
            .locator('#access-gate')
            .getByRole('button', { name: 'Unlock', exact: true })
            .click();
          await ready(page);
        },
        { redact },
      );
      evidence.passwordFormAccepted = true;
      report.phase = `${id}:save-rates`;
      await openTuning(page);
      await page.getByRole('button', { name: 'New Actual profile', exact: true }).click();
      await page.waitForFunction(
        (key) => JSON.parse(localStorage.getItem(key))?.profiles.length === 2,
        libraryKey,
      );
      const profileName = 'Fresh public offline acceptance';
      await page.getByLabel('Profile name', { exact: true }).fill(profileName);
      await page
        .getByRole('group', { name: 'Roll', exact: true })
        .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
        .fill('900');
      await page.getByRole('button', { name: 'Save for next flight', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Saved for the next flight' }).waitFor();
      const saved = await page.evaluate(
        ({ key, name }) =>
          JSON.parse(localStorage.getItem(key)).profiles.find((item) => item.name === name),
        { key: libraryKey, name: profileName },
      );
      assert.equal(saved.response.rates.axes.roll.rate, 90);
      evidence.savedProfile = { id: saved.id, name: saved.name, rollDegreesPerSecond: 900 };
      await observeFPVStartup(
        page,
        evidence,
        'saved-profile-reload',
        async () => {
          await page.reload();
          await ready(page);
        },
        { redact },
      );
      report.phase = `${id}:visible-install`;
      evidence.installation = await installThroughUI(page, id);
      await observeFPVStartup(
        page,
        evidence,
        'installed-worker-reload',
        async () => {
          await page.reload();
          await ready(page);
        },
        { redact },
      );
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      evidence.installedWorker = await workerStatus(page, base);
      assert.equal(evidence.installedWorker.revision, binding.workers[id]);
      assert.equal(evidence.installedWorker.ready, true);
      assert.equal(evidence.installedWorker.scope, base);
      await context.close();
      context = null;
      report.phase = `${id}:offline-process-reopen`;
      context = await launch(chromium, profile, true);
      page = context.pages()[0];
      page.setDefaultTimeout(60000);
      page.on('pageerror', (error) => evidence.pageErrors.push(redact(error.message)));
      await observeFPVStartup(
        page,
        evidence,
        'offline-process-reopen',
        async () => {
          const response = await page.goto(`${base}index.html?lang=en`);
          assert.equal(
            response.fromServiceWorker(),
            true,
            'Offline navigation did not come from installed worker',
          );
          await ready(page);
        },
        { redact },
      );
      evidence.offlineWorker = await workerStatus(page, base);
      assert.equal(evidence.offlineWorker.revision, binding.workers[id]);
      assert.equal(evidence.offlineWorker.ready, true);
      assert.equal(evidence.offlineWorker.scope, base);
      evidence.browserRestartedOffline = true;
      evidence.offlineNavigationFromServiceWorker = true;
      await openTuning(page);
      await page.getByLabel('Rate profile', { exact: true }).selectOption(saved.id);
      assert.equal(
        await page
          .getByRole('group', { name: 'Roll', exact: true })
          .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
          .inputValue(),
        '900',
      );
      evidence.ratesPersisted = true;
      report.phase = `${id}:offline-advanced-practice`;
      await page
        .getByRole('button', { name: 'Advanced reference quad · experimental', exact: true })
        .click();
      const pane = page.locator('.fpv-advanced-practice');
      await pane.getByRole('button', { name: 'Start practice', exact: true }).click();
      await page.waitForFunction(() => window.freshInstallWorkers.tick >= 10);
      await pane.getByRole('button', { name: 'Pause', exact: true }).click();
      const expectedWorkerURL = new URL('advanced-worker.mjs', base).href;
      assert.deepEqual(
        page.workers().map((worker) => worker.url()),
        [expectedWorkerURL],
      );
      const pending = page.waitForEvent('download');
      await pane.getByRole('button', { name: 'Export practice recording', exact: true }).click();
      const download = await pending;
      const recordingBytes = await readFile(await download.path());
      assert.ok(recordingBytes.length <= 1024 * 1024, 'Short acceptance recording exceeds 1 MiB');
      const recording = JSON.parse(recordingBytes);
      const recordingPath = `${output.replace(/\.json$/, '')}-${id}-recording.json`;
      await writeFile(recordingPath, recordingBytes, { mode: 0o600 });
      evidence.recording = {
        path: recordingPath,
        bytes: recordingBytes.length,
        sha256: sha(recordingBytes),
        missionTicks: recording.missionTicks,
        finalHash: recording.finalHash,
        scored: recording.scored,
      };
      assert.equal(recording.format, 'AdvancedRecording.v1');
      assert.equal(recording.scored, false);
      assert.ok(
        recording.missionTicks >= 10 && recording.missionTicks <= 1000,
        'Practice duration outside acceptance bounds',
      );
      assert.equal(recording.config.configuration.rateProfile.axes.roll.rate, 90);
      report.phase = `${id}:offline-replay-disposal`;
      await bounded(
        page.evaluate(
          async ({ root, recording }) => {
            const { replayAdvancedRecording } = await import(
              new URL('optional-practice/civilian-fpv/advanced-simulation.mjs', root).href
            );
            await replayAdvancedRecording(recording);
          },
          { root: root.href, recording },
        ),
        60000,
        'Short offline replay timed out',
      );
      evidence.replayVerified = true;
      await pane.getByRole('button', { name: 'Return to tuning', exact: true }).click();
      await page.waitForFunction(
        () => window.freshInstallWorkers.created === window.freshInstallWorkers.terminated,
      );
      evidence.workerCleanup = await page.evaluate(() => ({ ...window.freshInstallWorkers }));
      assert.deepEqual(page.workers(), []);
      assert.deepEqual(evidence.pageErrors, []);
      evidence.expectedWorkerURL = expectedWorkerURL;
      evidence.passed = true;
      await context.close();
      context = null;
    }
    report.phase = 'recheck-public-source';
    const after = await publicBinding(new URL(report.publicRoot), expectedRevision);
    assert.equal(
      after.manifestSha256,
      report.publicBinding.manifestSha256,
      'Deployment changed during acceptance',
    );
    assert.equal(
      after.metadataSha256,
      report.publicBinding.metadataSha256,
      'Deployment metadata changed during acceptance',
    );
    report.publicBindingStable = true;
    report.passed = true;
    report.phase = 'complete';
  } catch (error) {
    report.failure = redact(error.stack ?? error);
  } finally {
    try {
      await context?.close();
    } catch (error) {
      report.cleanupFailure = redact(error.stack ?? error);
      report.passed = false;
    }
    report.runnerFinalSha256 = sha(await readFile(runner));
    report.runnerStable = report.runnerFinalSha256 === report.runnerSha256;
    report.passed &&= report.runnerStable;
    report.completedAt = new Date().toISOString();
    await jsonWrite(output, JSON.parse(redact(JSON.stringify(report))));
  }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === runner) {
  const [publicRoot, expectedRevision, output, playwrightModule] = process.argv.slice(2);
  assert.equal(
    process.argv.length,
    6,
    'Usage: node scripts/smoke-fpv-public-fresh-install.mjs HTTPS_ROOT EXPECTED_SHA REPORT.json PLAYWRIGHT_MODULE',
  );
  const report = await smokeFPVPublicFreshInstall({
    publicRoot,
    expectedRevision,
    output,
    playwrightModule,
  });
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        phase: report.phase,
        expectedRevision,
        packages: report.packages.map(({ id, passed }) => ({ id, passed })),
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  process.exitCode = report.passed ? 0 : 1;
}
