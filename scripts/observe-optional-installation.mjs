import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readEditionZip } from '../publishing/edition-zip.mjs';
import { validateOptionalPackageAdmission } from '../publishing/optional-package-admission.mjs';
import { startServer } from './game-cli.mjs';
import { installOptionalStatusDiagnostics } from './optional-installation-diagnostics.mjs';
import { withOptionalQuotaDeny } from './optional-installation-quota-probe.mjs';
import {
  OBSERVED_PACKAGES,
  OPERATION_TIMEOUT_MS,
  OBSERVATION_TIMEOUT_MS,
  activateOfflineAction,
  trackObservedResource,
  resourceCleanupIssues,
  boundedOperation,
  closeAllPages,
  closeBrowserForRestart,
  unlockObservedPage,
  matchesLaunchedAppURL,
  revealFPVOffline,
  revealFPVProfiles,
  expectedImportedProfileExport,
} from './optional-installation-observer-helpers.mjs';

function selectQuotaPackages(mode) {
  if (mode === undefined) return ['civilian-fpv'];
  if (mode === 'all') return ['civilian-fpv', 'civilian-flight', 'fpv-worlds'];
  throw new Error('OPTIONAL_INSTALLATION_QUOTA_PACKAGES must be omitted or all.');
}
function quotaRetryPrevious(id, version, priorVersion) {
  if (id === 'civilian-fpv') return priorVersion;
  if (id === 'civilian-flight') return undefined;
  if (id === 'fpv-worlds') return version;
  throw new Error('Unknown quota retry package.');
}
function assertQuotaPointers(state, baseline, ids, keyFor, except) {
  for (const id of ids)
    if (id !== except) assert.equal(state.keys[keyFor(id)], baseline.keys[keyFor(id)]);
}
function assertQuotaFailedScopeAbsent(state, scope) {
  assert.ok(
    state.caches.every((name) => !name.includes(scope)),
    'Denied preparation must remove its incomplete staging cache.',
  );
  assert.ok(
    state.workers.every((worker) => !worker.scope.includes(scope)),
    'Denied preparation must not leave its worker registered.',
  );
}

const [
  modulePath,
  bundlePath,
  output = '/tmp/optional-installation-observation.json',
  previousBundlePath,
] = process.argv.slice(2);
if (!modulePath || !bundlePath)
  throw new Error(
    'Pass external Playwright module, frozen optional bundle, output JSON and optional previous frozen bundle.',
  );
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function admitBundle(directory) {
  const bundle = path.resolve(directory),
    envelopeBytes = await readFile(path.join(bundle, 'optional-packages.json')),
    envelope = JSON.parse(envelopeBytes),
    admittedBytes = new Map();
  await validateOptionalPackageAdmission(envelope, {
    read: async (row) => {
      if (!admittedBytes.has(row.path))
        admittedBytes.set(row.path, await readFile(path.join(bundle, row.path)));
      return admittedBytes.get(row.path);
    },
  });
  return { envelopeBytes, envelope, admittedBytes };
}
const { envelopeBytes, envelope, admittedBytes } = await admitBundle(bundlePath);
const previous = previousBundlePath ? await admitBundle(previousBundlePath) : null;
const version = envelope.version,
  fpv = 'civilian-fpv',
  gym = 'civilian-flight',
  worlds = 'fpv-worlds',
  packageIds = Object.keys(OBSERVED_PACKAGES),
  priorVersion = previous?.envelope.version ?? 'v0.0.0',
  failedFixture = 'v0.0.1';
const quotaPackageIds = selectQuotaPackages(process.env.OPTIONAL_INSTALLATION_QUOTA_PACKAGES);
assert.ok(
  new Set([version, priorVersion, failedFixture]).size === 3,
  'Candidate, previous and failed-fixture versions must differ.',
);
if (previous) {
  assert.notEqual(
    previous.envelope.sourceRevision,
    envelope.sourceRevision,
    'Candidates need distinct commits.',
  );
  assert.notEqual(
    previous.envelope.sourceTree,
    envelope.sourceTree,
    'Candidates need distinct source trees.',
  );
  const priorItem = previous.envelope.packages.find((row) => row.id === fpv),
    nextItem = envelope.packages.find((row) => row.id === fpv);
  assert.ok(priorItem && nextItem, 'Both frozen candidates must include civilian-fpv.');
  assert.notEqual(
    priorItem.distribution.sha256,
    nextItem.distribution.sha256,
    'Candidates need distinct FPV archives.',
  );
}
const { chromium } = await import(pathToFileURL(path.resolve(modulePath)).href);
const harnessSha256 = sha(await readFile(fileURLToPath(import.meta.url)));
const helperURL = new URL('./optional-installation-observer-helpers.mjs', import.meta.url);
const helperSha256 = sha(await readFile(helperURL));
const password = process.env.OPTIONAL_INSTALLATION_PASSWORD;
const transition = {
  kind: previous ? 'distinct-frozen-candidates' : 'same-payload-path-fixture',
  fromVersion: priorVersion,
  toVersion: version,
  changedFiles: null,
  previous: previous
    ? {
        envelopeSha256: sha(previous.envelopeBytes),
        sourceRevision: previous.envelope.sourceRevision,
        sourceTree: previous.envelope.sourceTree,
        package: previous.envelope.packages.find((row) => row.id === fpv),
      }
    : null,
};
const work = await mkdtemp(path.join(tmpdir(), 'optional-installation-'));
const root = path.join(work, 'site'),
  profile = path.join(work, 'browser');
const entries = new Map(),
  manifests = new Map(),
  checkpoints = [],
  errors = [],
  osApps = [];
let served, context, cdp, report;
let currentStep = 'staging admitted packages';
const acquiringResources = { pending: new Set(), errors: [] };
const coldRelaunchRounds = Number(process.env.OPTIONAL_INSTALLATION_COLD_RELAUNCHES ?? '1');
assert.ok(
  Number.isInteger(coldRelaunchRounds) && coldRelaunchRounds >= 1 && coldRelaunchRounds <= 5,
  'Cold relaunch repetitions must be an integer from one to five.',
);
const statusDiagnosticsEnabled = process.env.OPTIONAL_INSTALLATION_DIAGNOSTICS === '1';
const statusDiagnostics = { events: [], dropped: 0 };
const diagnosticURL = new URL('./optional-installation-diagnostics.mjs', import.meta.url);
const diagnosticSha256 = statusDiagnosticsEnabled ? sha(await readFile(diagnosticURL)) : null;
const quotaProbeEnabled = process.env.OPTIONAL_INSTALLATION_QUOTA_PROBE === '1';
const quotaProbeURL = new URL('./optional-installation-quota-probe.mjs', import.meta.url);
const quotaProbeSha256 = quotaProbeEnabled ? sha(await readFile(quotaProbeURL)) : null;
let quotaProbeReport = null;
const quotaProbePerPackage = {};
const quotaCheckpoint = (label, id) => (quotaPackageIds.length === 1 ? label : `${label}:${id}`);
function recordStatusDiagnostic(event) {
  if (statusDiagnostics.events.length < 4096)
    statusDiagnostics.events.push({ step: currentStep, receivedAt: Date.now(), ...event });
  else statusDiagnostics.dropped++;
}
const observationDeadline = Date.now() + OBSERVATION_TIMEOUT_MS;
function requireObservationTime() {
  if (Date.now() >= observationDeadline)
    throw new Error('Installation observation deadline exceeded.');
}
const appWindows = new Map();
const browserRestart = { attempted: false, passed: false };
async function launchBrowser(offline = false) {
  requireObservationTime();
  await trackObservedResource(acquiringResources, 'Browser', async () => {
    const launchedContext = await chromium.launchPersistentContext(profile, {
      channel: 'chrome',
      headless: true,
      locale: 'en-US',
      viewport: { width: 1280, height: 900 },
      offline,
    });
    if (Date.now() >= observationDeadline) {
      await boundedOperation('Late browser cleanup', () => launchedContext.close());
      requireObservationTime();
    }
    context = launchedContext;
  });
  context.setDefaultTimeout(OPERATION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(OPERATION_TIMEOUT_MS);
  if (statusDiagnosticsEnabled) {
    await context.exposeBinding('__optionalStatusDiagnostic', ({ frame }, event) => {
      recordStatusDiagnostic({ documentURL: frame.url(), event });
    });
    await context.addInitScript(installOptionalStatusDiagnostics);
    const diagnosticPage = context.pages()[0] ?? (await context.newPage());
    const diagnosticSession = await context.newCDPSession(diagnosticPage);
    diagnosticSession.on('ServiceWorker.workerErrorReported', ({ errorMessage }) => {
      recordStatusDiagnostic({
        workerError: {
          versionId: errorMessage.versionId,
          sourceURL: errorMessage.sourceURL,
          errorMessage: errorMessage.errorMessage?.slice(0, 1000),
          lineNumber: errorMessage.lineNumber,
        },
      });
    });
    diagnosticSession.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
      for (const worker of versions)
        recordStatusDiagnostic({
          workerVersion: {
            versionId: worker.versionId,
            scriptURL: worker.scriptURL,
            status: worker.status,
            runningStatus: worker.runningStatus,
          },
        });
    });
    await diagnosticSession.send('ServiceWorker.enable');
  }
  context.on('page', (newPage) => newPage.on('pageerror', (error) => errors.push(error.message)));
}
const relativeRoot = (id) => `revealline/practice/${id}/`;
const site = (id, selected = version) => `${relativeRoot(id)}releases/${selected}/site/`;
const entry = (id, selected = version) => site(id, selected) + `optional-practice/${id}/index.html`;
async function put(name, bytes) {
  requireObservationTime();
  const file = path.join(root, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}
async function pointer(id, selected) {
  await put(
    relativeRoot(id) + 'app/current.json',
    JSON.stringify({
      id,
      version: selected,
      scope: `../releases/${selected}/site/`,
      entry: `optional-practice/${id}/index.html`,
    }),
  );
}
async function stage(id, selected, files = entries.get(id)) {
  for (const [name, bytes] of files) await put(site(id, selected) + name, bytes);
}
async function stageLauncher(id, files = entries.get(id)) {
  for (const [name, bytes] of files)
    if (name.startsWith('launcher/')) await put(relativeRoot(id) + 'app/' + name.slice(9), bytes);
}
try {
  await boundedOperation(
    'Complete installation observation',
    async () => {
      for (const id of packageIds) {
        const item = envelope.packages.find((row) => row.id === id);
        assert.ok(item, `Frozen bundle must include ${id}.`);
        entries.set(id, readEditionZip(admittedBytes.get(item.distribution.path)));
        manifests.set(id, JSON.parse(entries.get(id).get('launcher/app.webmanifest')));
        assert.equal(manifests.get(id).id, '/' + relativeRoot(id));
        await stage(id, version);
        await stageLauncher(id);
      }
      const priorItem = previous?.envelope.packages.find((row) => row.id === fpv),
        priorEntries = previous
          ? readEditionZip(previous.admittedBytes.get(priorItem.distribution.path))
          : entries.get(fpv);
      assert.deepEqual(
        JSON.parse(priorEntries.get('launcher/app.webmanifest')),
        manifests.get(fpv),
        'This observer requires the same stable launcher manifest across candidates.',
      );
      const changedFiles = [...new Set([...priorEntries.keys(), ...entries.get(fpv).keys()])]
        .filter(
          (name) =>
            !priorEntries.has(name) ||
            !entries.get(fpv).has(name) ||
            !priorEntries.get(name).equals(entries.get(fpv).get(name)),
        )
        .sort();
      transition.changedFiles = changedFiles;
      await stage(fpv, priorVersion, priorEntries);
      await stageLauncher(fpv, priorEntries);
      await stage(fpv, failedFixture);
      if (quotaProbeEnabled)
        for (const id of quotaPackageIds) if (id !== fpv) await stage(id, failedFixture);
      await pointer(fpv, priorVersion);
      await pointer(gym, version);
      await pointer(worlds, version);
      await put('.xonix-build.json', JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }));
      requireObservationTime();
      await trackObservedResource(acquiringResources, 'Local server', async () => {
        served = await startServer({ root, port: 0 });
        if (Date.now() >= observationDeadline) {
          served.server.closeAllConnections?.();
          await boundedOperation(
            'Late server cleanup',
            () =>
              new Promise((resolve, reject) =>
                served.server.close((error) => (error ? reject(error) : resolve())),
              ),
          );
          requireObservationTime();
        }
      });
      await launchBrowser();
      let page = context.pages()[0] ?? (await context.newPage());
      page.on('pageerror', (error) => errors.push(error.message));
      cdp = await context.newCDPSession(page);
      const send = (method, parameters) =>
        boundedOperation(method, () => cdp.send(method, parameters));
      const url = (name) => new URL(name, served.url).href;
      async function openPrepared(target, id) {
        currentStep = `offline launcher: ${id}`;
        await target.goto(url(relativeRoot(id) + 'app/'));
        const networkUnavailable = await target.evaluate(async () => {
          try {
            await globalThis.fetch('/offline-network-probe-unowned-by-any-worker', {
              cache: 'no-store',
            });
            return false;
          } catch {
            return true;
          }
        });
        assert.equal(
          networkUnavailable,
          true,
          'An uncached network probe must fail during offline relaunch.',
        );
        await target.locator('#open').click();
        await target.waitForURL((observed) =>
          matchesLaunchedAppURL(observed, url(entry(id, id === fpv ? priorVersion : version))),
        );
        await unlockObservedPage(target, password);
        await target.locator(OBSERVED_PACKAGES[id].mounted).waitFor();
      }
      async function revealControl(id, selector, category = 'extras') {
        if (await page.locator(selector).isVisible()) return;
        const prefix = OBSERVED_PACKAGES[id].settingsPrefix;
        const tab = page.locator(`#${prefix}-settings-tab-${category}`);
        if (!(await tab.isVisible()))
          await page.locator(`#${prefix}-shell-action-settings`).click();
        await tab.click();
      }
      async function clickFPV(selector, category = 'extras') {
        await revealControl(fpv, selector, category);
        await page.locator(selector).click();
      }
      async function open(id, selected = version) {
        currentStep = `open ${id} ${selected}`;
        await page.goto(url(entry(id, selected)));
        await unlockObservedPage(page, password);
        const selector = OBSERVED_PACKAGES[id].mounted;
        await page.locator(selector).waitFor();
        // Wait for the ordinary application mount, not merely the static HTML.
        await page.waitForFunction(
          (selector) => globalThis.document.querySelector(selector)?.textContent.trim().length > 0,
          selector,
        );
      }
      async function revealOfflineUI(id) {
        const adapter = OBSERVED_PACKAGES[id];
        if (id === fpv) await revealFPVOffline(page, () => clickFPV('#help'));
        else {
          await revealControl(id, adapter.panel, 'content');
          await page.locator(adapter.panel).click();
        }
      }
      async function revealOfflineRemoval(id) {
        await revealOfflineUI(id);
        if (id === worlds) {
          // Settings exposes preparation, but removal remains in Library.
          const library = page.locator('[data-tab="packs"]');
          await library.waitFor({ state: 'visible' });
          await library.press('Enter');
          await page.locator('#packs').waitFor({ state: 'visible' });
        }
        const button = id === worlds ? '#remove-runtime' : '#remove-offline';
        await page.locator(button).waitFor({ state: 'visible' });
        return button;
      }
      async function prepare(id) {
        currentStep = `prepare ${id}`;
        const adapter = OBSERVED_PACKAGES[id];
        await revealOfflineUI(id);
        await activateOfflineAction(page, {
          button: adapter.prepare,
          status: adapter.status,
          expected:
            /ready offline|ready for offline|prepared offline|offline runtime preparation completed/i,
        });
        await page.locator(adapter.close).click();
      }
      async function inspect(label) {
        const state = await page.evaluate(async () => ({
          keys: Object.fromEntries(
            Object.entries(globalThis.localStorage).filter(([key]) =>
              key.startsWith('revealline.optional-installed.'),
            ),
          ),
          caches: (await globalThis.caches.keys()).sort(),
          workers: (await globalThis.navigator.serviceWorker.getRegistrations())
            .map((row) => ({ scope: row.scope, active: row.active?.state ?? null }))
            .sort((a, b) => a.scope.localeCompare(b.scope)),
        }));
        checkpoints.push({ label, ...state });
        return state;
      }
      const keyFor = (id) =>
        `revealline.optional-installed.${id}.${encodeURIComponent('/' + relativeRoot(id))}.v1`;
      const installed = (state, id) => JSON.parse(state.keys[keyFor(id)]);
      async function exportedProof() {
        await clickFPV('#notebook-button', 'data');
        await page
          .getByRole('button', {
            name: 'Export verified flight proofs',
            exact: true,
          })
          .press('Enter');
        const value = await page
          .getByRole('textbox', { name: 'Flight proof backup JSON', exact: true })
          .inputValue();
        await page.locator('[data-close="notebook-dialog"]').click();
        return value;
      }
      async function exportedProfiles() {
        await revealFPVProfiles(page, () => clickFPV('#setup', 'controls'));
        await page.getByRole('button', { name: 'Export profiles', exact: true }).press('Enter');
        const value = await page
          .getByRole('textbox', { name: 'Profile JSON', exact: true })
          .inputValue();
        await page.locator('[data-close="setup-dialog"]').click();
        return value;
      }
      await open(fpv, priorVersion);
      await prepare(fpv);
      const demonstrations = await import(
        pathToFileURL(
          path.join(
            root,
            site(fpv, priorVersion),
            'optional-practice/civilian-fpv/demonstrations.mjs',
          ),
        ).href
      );
      const proof = structuredClone(demonstrations.FLIGHT_DEMONSTRATIONS[0]);
      proof.session = 'practice';
      await clickFPV('#notebook-button', 'data');
      await page.getByRole('textbox', { name: 'Flight proof backup JSON', exact: true }).fill(
        JSON.stringify({
          format: 'FlightProofBackup.v1',
          packageId: fpv,
          attempts: [proof],
        }),
      );
      await page
        .getByRole('button', { name: 'Import and reverify proofs', exact: true })
        .press('Enter');
      await page
        .locator('#flight-notebook')
        .getByRole('status')
        .filter({ hasText: 'Saved on this device' })
        .waitFor();
      await page.locator('[data-close="notebook-dialog"]').click();
      const savedProof = await exportedProof();
      assert.equal(JSON.parse(savedProof).attempts.length, 1);
      const profileFixture = {
        format: 'FlightProfiles.v1',
        radio: {
          format: 'RadioProfile.v1',
          id: 'installation-observer-v1',
          name: 'Synthetic persistence fixture',
          device: {
            id: 'Installation observer — no physical device',
            mapping: '',
            axes: 4,
            buttons: 0,
          },
          stickMode: 3,
          throttleStyle: 'full-travel',
          verified: false,
          channels: Object.fromEntries(
            [
              ['roll', 2],
              ['pitch', 0],
              ['yaw', 3],
              ['throttle', 1],
            ].map(([name, axis]) => [
              name,
              {
                axis,
                min: -1,
                max: 1,
                center: name === 'throttle' ? null : 0,
                deadZone: name === 'throttle' ? 0 : 0.04,
                invert: name === 'pitch',
              },
            ]),
          ),
          switches: { arm: null, pause: null, reset: null },
        },
        response: {
          format: 'FlightResponseProfile.v1',
          id: 'installation-observer-v1',
          name: 'Persistence fixture',
          maxRate: 300,
          maxTilt: 35,
          expo: 40,
          responseTicks: 10,
        },
      };
      await revealFPVProfiles(page, () => clickFPV('#setup', 'controls'));
      await page
        .getByRole('textbox', { name: 'Profile JSON', exact: true })
        .fill(JSON.stringify(profileFixture));
      await page.getByRole('button', { name: 'Import profiles', exact: true }).press('Enter');
      await page.locator('[data-close="setup-dialog"]').click();
      const savedProfiles = await exportedProfiles();
      const importedProfiles = JSON.parse(savedProfiles);
      assert.deepEqual(
        importedProfiles,
        expectedImportedProfileExport(importedProfiles.format, profileFixture),
      );
      await open(gym);
      await prepare(gym);
      await open(worlds);
      await prepare(worlds);
      const both = await inspect('all-three-prepared');
      assert.equal(installed(both, fpv).active.version, priorVersion);
      assert.equal(installed(both, gym).active.version, version);
      assert.equal(installed(both, worlds).active.version, version);
      for (const id of packageIds) {
        const manifestId = url(manifests.get(id).id),
          installUrlOrBundleUrl = url(relativeRoot(id) + 'app/');
        await page.goto(installUrlOrBundleUrl);
        await page.waitForFunction(
          () => globalThis.document.getElementById('title').textContent.length > 0,
        );
        const app = { id, manifestId, installed: false };
        osApps.push(app);
        try {
          await send('PWA.install', { manifestId, installUrlOrBundleUrl });
          app.installed = true;
          app.state = await send('PWA.getOsAppState', { manifestId });
          await send('PWA.changeAppUserSettings', {
            manifestId,
            displayMode: 'standalone',
          });
          const pendingWindow = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
          app.launch = await send('PWA.launch', { manifestId });
          const appWindow = await pendingWindow;
          assert.ok(appWindow, 'PWA.launch must create its app window.');
          appWindows.set(id, appWindow);
          await appWindow.waitForLoadState('domcontentloaded');
          app.window = await appWindow.evaluate(() => ({
            standalone: globalThis.matchMedia('(display-mode: standalone)').matches,
            url: globalThis.location.href,
          }));
          assert.equal(app.window.url, installUrlOrBundleUrl);
          assert.equal(
            app.window.standalone,
            true,
            'Installed launcher must run in standalone mode.',
          );
        } catch (error) {
          app.error = error.message;
        }
      }
      await context.setOffline(true);
      const coldRounds = [];
      for (let round = 1; round <= coldRelaunchRounds; round++) {
        const closedPageCount = await closeAllPages(context);
        page = await context.newPage();
        cdp = await context.newCDPSession(page);
        for (const id of packageIds) {
          currentStep = `offline window relaunch: ${id} (round ${round})`;
          await page.goto(url(relativeRoot(id) + 'app/'));
          const networkUnavailable = await page.evaluate(async () => {
            try {
              await globalThis.fetch('/offline-network-probe-unowned-by-any-worker', {
                cache: 'no-store',
              });
              return false;
            } catch {
              return true;
            }
          });
          assert.equal(
            networkUnavailable,
            true,
            'An uncached network probe must fail during offline relaunch.',
          );
          await page.locator('#open').click();
          await page.waitForURL((observed) =>
            matchesLaunchedAppURL(observed, url(entry(id, id === fpv ? priorVersion : version))),
          );
          await unlockObservedPage(page, password);
          await page.locator(OBSERVED_PACKAGES[id].mounted).waitFor();
        }
        coldRounds.push({ round, closedPageCount, packages: packageIds, passed: true });
      }
      const closedTabsRelaunch = {
        passed: true,
        closedPageCount: coldRounds[0].closedPageCount,
        rounds: coldRounds,
        packages: packageIds,
        networkProbeFailed: true,
      };
      await inspect('all-three-relaunched-offline-after-all-windows-closed');
      // Reopen installed windows while still offline. These are new windows, not
      // surviving documents whose in-memory modules could hide missing cache files.
      for (const app of osApps.filter((row) => row.installed)) {
        const pendingWindow = context
          .waitForEvent('page', { timeout: OPERATION_TIMEOUT_MS })
          .catch(() => null);
        app.offlineLaunch = await send('PWA.launch', { manifestId: app.manifestId });
        const appWindow = await pendingWindow;
        assert.ok(appWindow, 'Offline PWA.launch must create a new app window.');
        appWindows.set(app.id, appWindow);
        await appWindow.waitForLoadState('domcontentloaded');
        await appWindow.locator('#open').click();
        await appWindow.waitForURL((observed) =>
          matchesLaunchedAppURL(
            observed,
            url(entry(app.id, app.id === fpv ? priorVersion : version)),
          ),
        );
        await unlockObservedPage(appWindow, password);
        await appWindow.locator(OBSERVED_PACKAGES[app.id].mounted).waitFor();
        app.offlineWindow = await appWindow.evaluate(() => ({
          standalone: globalThis.matchMedia('(display-mode: standalone)').matches,
          url: globalThis.location.href,
        }));
        assert.equal(app.offlineWindow.standalone, true);
      }
      await open(gym);
      await open(fpv, priorVersion);
      assert.equal(await exportedProof(), savedProof);
      assert.equal(await exportedProfiles(), savedProfiles);
      await inspect('all-three-open-offline');
      // Persistent-context close exits its browser. Relaunch the same disk
      // profile offline before navigating to any prepared application.
      browserRestart.attempted = true;
      Object.assign(browserRestart, await closeBrowserForRestart(context));
      context = null;
      cdp = null;
      appWindows.clear();
      await launchBrowser(true);
      assert.ok(
        context.pages().every((item) => item.url() === 'about:blank'),
        'Restart must not restore application pages before observation.',
      );
      page = context.pages()[0] ?? (await context.newPage());
      page.on('pageerror', (error) => errors.push(error.message));
      cdp = await context.newCDPSession(page);
      for (const id of packageIds) await openPrepared(page, id);
      for (const app of osApps.filter((row) => row.installed)) {
        const pendingWindow = context
          .waitForEvent('page', { timeout: OPERATION_TIMEOUT_MS })
          .catch(() => null);
        app.restartLaunch = await send('PWA.launch', { manifestId: app.manifestId });
        const appWindow = await pendingWindow;
        assert.ok(appWindow, 'Restarted PWA.launch must create an installed window.');
        appWindows.set(app.id, appWindow);
        await openPrepared(appWindow, app.id);
        app.restartedOfflineWindow = await appWindow.evaluate(() => ({
          standalone: globalThis.matchMedia('(display-mode: standalone)').matches,
          url: globalThis.location.href,
        }));
        assert.equal(app.restartedOfflineWindow.standalone, true);
      }
      await open(fpv, priorVersion);
      assert.equal(await exportedProof(), savedProof);
      assert.equal(await exportedProfiles(), savedProfiles);
      Object.assign(browserRestart, {
        passed: true,
        packages: packageIds,
        networkProbeFailed: true,
      });
      await inspect('all-three-offline-after-browser-process-restart');
      await context.setOffline(false);
      await stageLauncher(fpv);
      await pointer(fpv, version);
      await page.goto(url(relativeRoot(fpv) + 'app/'));
      await page.locator('#check').click();
      await page.locator('#prepare').click();
      await page.waitForURL((observed) => matchesLaunchedAppURL(observed, url(entry(fpv))));
      assert.ok(matchesLaunchedAppURL(page.url(), url(entry(fpv))));
      await prepare(fpv);
      assert.equal(await exportedProof(), savedProof);
      assert.equal(await exportedProfiles(), savedProfiles);
      const upgraded = await inspect(
        previous
          ? 'candidate-installed-over-previous-candidate'
          : 'candidate-installed-over-alternate-path',
      );
      assert.equal(installed(upgraded, fpv).active.version, version);
      assert.equal(installed(upgraded, fpv).previous.version, priorVersion);
      assert.equal(upgraded.keys[keyFor(gym)], both.keys[keyFor(gym)]);
      assert.equal(upgraded.keys[keyFor(worlds)], both.keys[keyFor(worlds)]);
      if (quotaProbeEnabled) {
        // The pristine alternate path is not installed. Unlock it before quota
        // denial, so authentication writes are not mistaken for install errors.
        for (const quotaId of quotaPackageIds) {
          const adapter = OBSERVED_PACKAGES[quotaId];
          await open(quotaId, failedFixture);
          await revealOfflineUI(quotaId);
          currentStep = `controlled origin quota denial during ordinary preparation: ${quotaId}`;
          const result = await withOptionalQuotaDeny({
            cdp,
            origin: new URL(served.url).origin,
            run: async ({ signal }) => {
              await activateOfflineAction(page, {
                button: adapter.prepare,
                status: adapter.status,
                expected: /failed|timed out|denied|quota|not available|not supported/i,
              });
              signal.throwIfAborted();
              const denied = await inspect(
                quotaCheckpoint('controlled-quota-denial-preserves-all-pointers', quotaId),
              );
              assertQuotaPointers(denied, upgraded, packageIds, keyFor);
              assertQuotaFailedScopeAbsent(denied, '/' + site(quotaId, failedFixture));
            },
          });
          quotaProbePerPackage[quotaId] = result;
          if (quotaId === fpv) quotaProbeReport = result;
          result.status = await page.locator(adapter.status).textContent();
          assert.equal(result.completed, true, 'Controlled quota probe or reset failed.');
          await open(fpv);
          assert.equal(await exportedProof(), savedProof);
          assert.equal(await exportedProfiles(), savedProfiles);
          await inspect(
            quotaCheckpoint('quota-reset-preserves-imported-proof-and-profile', quotaId),
          );
        }
      }
      const failureFile = site(fpv, failedFixture) + 'optional-practice/civilian-fpv/README.md';
      await put(failureFile, 'Truncated dependency fixture');
      await open(fpv, failedFixture);
      await revealFPVOffline(page, () => clickFPV('#help'));
      await activateOfflineAction(page, {
        button: '#install-offline',
        status: '#transfer-status',
        expected: /verification failed|timed out/i,
      });
      const failed = await inspect('failed-install-preserves-pointers');
      assert.equal(failed.keys[keyFor(fpv)], upgraded.keys[keyFor(fpv)]);
      assert.equal(failed.keys[keyFor(gym)], upgraded.keys[keyFor(gym)]);
      assert.equal(failed.keys[keyFor(worlds)], upgraded.keys[keyFor(worlds)]);
      assert.ok(failed.caches.every((name) => !name.includes('/' + site(fpv, failedFixture))));
      await open(fpv);
      await revealFPVOffline(page, () => clickFPV('#help'));
      await activateOfflineAction(page, {
        button: '#remove-offline',
        status: '#transfer-status',
        expected: /removed/i,
      });
      const rolledBack = await inspect('candidate-removed-retained-path-restored');
      assert.equal(installed(rolledBack, fpv).active.version, priorVersion);
      assert.equal(rolledBack.keys[keyFor(gym)], both.keys[keyFor(gym)]);
      assert.equal(rolledBack.keys[keyFor(worlds)], both.keys[keyFor(worlds)]);
      await context.setOffline(true);
      await page.goto(url(relativeRoot(fpv) + 'app/'));
      await page.locator('#open').click();
      await page.waitForURL((observed) =>
        matchesLaunchedAppURL(observed, url(entry(fpv, priorVersion))),
      );
      assert.ok(matchesLaunchedAppURL(page.url(), url(entry(fpv, priorVersion))));
      assert.equal(await exportedProof(), savedProof);
      assert.equal(await exportedProfiles(), savedProfiles);
      await open(gym);
      await inspect('rollback-and-other-package-work-offline');
      await context.setOffline(false);
      await revealControl(gym, '#remove-offline', 'content');
      await activateOfflineAction(page, {
        button: '#remove-offline',
        status: '#package-status',
        expected: /removed/i,
      });
      const afterGymRemoval = await inspect('gym-cache-removal-preserves-fpv-and-worlds');
      assert.equal(afterGymRemoval.keys[keyFor(fpv)], rolledBack.keys[keyFor(fpv)]);
      assert.equal(afterGymRemoval.keys[keyFor(worlds)], rolledBack.keys[keyFor(worlds)]);
      assert.deepEqual(
        afterGymRemoval.caches.filter((name) => name.includes('/practice/civilian-fpv/')),
        rolledBack.caches.filter((name) => name.includes('/practice/civilian-fpv/')),
      );
      if (quotaProbeEnabled) {
        // Retry only after ordinary rollback restored the prior-only pointer.
        // Earlier success would replace the single retained-version slot and
        // invalidate the existing rollback scenario. Never inject pointer data.
        for (const quotaId of quotaPackageIds) {
          const adapter = OBSERVED_PACKAGES[quotaId];
          await stage(quotaId, failedFixture);
          await open(quotaId, failedFixture);
          await prepare(quotaId);
          const repaired = await inspect(
            quotaCheckpoint('quota-restored-pristine-retry-prepared', quotaId),
          );
          assert.equal(installed(repaired, quotaId).active.version, failedFixture);
          assert.equal(
            installed(repaired, quotaId).previous?.version,
            quotaRetryPrevious(quotaId, version, priorVersion),
          );
          if (quotaId === gym) assert.equal(installed(repaired, quotaId).previous, undefined);
          assertQuotaPointers(repaired, afterGymRemoval, packageIds, keyFor, quotaId);
          if (quotaId === fpv) {
            assert.equal(await exportedProof(), savedProof);
            assert.equal(await exportedProfiles(), savedProfiles);
          }
          const removeButton = await revealOfflineRemoval(quotaId);
          await activateOfflineAction(page, {
            button: removeButton,
            status: adapter.status,
            expected: /removed/i,
          });
          const restored = await inspect(
            quotaCheckpoint('quota-retry-removal-restores-prior-installation', quotaId),
          );
          assertQuotaPointers(restored, afterGymRemoval, packageIds, keyFor);
          quotaProbePerPackage[quotaId].retryPreparedAndRemoved = true;
        }
      }
      const installedGym = osApps.find((item) => item.id === gym && item.installed);
      const installedFPV = osApps.find((item) => item.id === fpv && item.installed);
      if (installedGym && installedFPV) {
        await send('PWA.uninstall', { manifestId: installedGym.manifestId });
        installedGym.uninstalled = true;
        installedFPV.afterOtherUninstall = await send('PWA.getOsAppState', {
          manifestId: installedFPV.manifestId,
        });
        assert.equal(appWindows.get(fpv)?.isClosed(), false);
        if (installedGym.window?.standalone) {
          await appWindows
            .get(gym)
            ?.waitForEvent('close', { timeout: 1000 })
            .catch(() => {});
          assert.equal(appWindows.get(gym)?.isClosed(), true);
        }
      }
      await context.setOffline(true);
      await open(fpv, priorVersion);
      assert.equal(await exportedProof(), savedProof);
      assert.equal(await exportedProfiles(), savedProfiles);
      const osInstallationStatus = osApps.every(
        (app) => app.installed && app.launch?.targetId && !app.error,
      )
        ? 'passed'
        : 'unverified';
      const standaloneWindowStatus = osApps.every(
        (app) =>
          app.window?.standalone &&
          app.offlineWindow?.standalone &&
          app.restartedOfflineWindow?.standalone,
      )
        ? 'passed'
        : 'unverified';
      const harnessStable =
        harnessSha256 === sha(await readFile(fileURLToPath(import.meta.url))) &&
        helperSha256 === sha(await readFile(helperURL));
      // A late hash read must not replace the timeout failure during cleanup.
      requireObservationTime();
      report = {
        format: 'OptionalInstallationObservation.v1',
        passed:
          errors.length === 0 &&
          osInstallationStatus === 'passed' &&
          standaloneWindowStatus === 'passed' &&
          browserRestart.passed &&
          harnessStable,
        browserPreparationPassed: true,
        osInstallationStatus,
        standaloneWindowStatus,
        closedTabsRelaunch,
        browserRestart,
        harnessStable,
        createdAt: new Date().toISOString(),
        browser: context.browser()?.version() ?? 'Chrome persistent context',
        scope:
          'All three apps in an isolated local persistent Chrome profile, admitted frozen runtime bytes and ordinary offline/profile/backup UI. All tabs/windows close before offline launcher and standalone app reopening; the persistent browser then closes and relaunches the same profile with browser-context offline enabled before app navigation. This is not an OS reboot or machine-wide airplane-mode claim. ' +
          (previous
            ? 'Two distinct frozen candidates with original versions and source bindings; changed files are listed. '
            : 'v0.0.0 holds the same candidate payload at an alternate path. ') +
          'v0.0.1 is a deliberately damaged local path fixture. No release is allocated. Progress comes from a scripted verified input import, not a human flight. No public deployment, arbitrary historical-model migration or physical radio claim.',
        transition,
        envelopeSha256: sha(envelopeBytes),
        sourceRevision: envelope.sourceRevision,
        sourceTree: envelope.sourceTree,
        artifacts: envelope.packages.map(({ id, distribution, manifest }) => ({
          id,
          distribution,
          manifest,
        })),
        harnessSha256,
        helperSha256,
        inputRoute: {
          academyOfflineDisclosure: 'Native summary keyboard Enter',
          academyProfileTransfer: 'Native summary and import/export button keyboard Enter',
          academyProofTransfer: 'Native import/export button keyboard Enter',
          offlineActions: 'Native button keyboard Enter with fresh status/progress observation',
          limitation:
            'This observer uses the native keyboard route and does not qualify pointer interaction.',
        },
        proof: {
          input: 'first frozen demonstration frames under an explicit synthetic practice session',
          sha256: sha(savedProof),
          attempts: 1,
        },
        profiles: {
          input:
            'synthetic unverified radio mapping and independent simulator response imported through Setup',
          sha256: sha(savedProfiles),
          radioVerified: false,
        },
        osApps,
        checkpoints,
        errors,
      };
    },
    OBSERVATION_TIMEOUT_MS,
  );
} catch (error) {
  // Read only the isolated test pages' status/link state, never form values or
  // storage credentials. Preserve the actual failure before owned cleanup.
  const diagnostics = await Promise.all(
    (context?.pages() ?? []).slice(0, 8).map(async (item) => {
      try {
        return await boundedOperation(
          'Read failed page status',
          () =>
            item.evaluate(() => ({
              url: globalThis.location.href,
              access: globalThis.document.documentElement.dataset.accessState ?? null,
              status: globalThis.document.querySelector('#status')?.textContent ?? null,
              open: (() => {
                const link = globalThis.document.querySelector('#open');
                return link ? { hidden: link.hidden, href: link.href } : null;
              })(),
              check: (() => {
                const button = globalThis.document.querySelector('#check');
                return button ? { disabled: button.disabled, text: button.textContent } : null;
              })(),
            })),
          3000,
        );
      } catch (diagnosticError) {
        return { error: diagnosticError.message };
      }
    }),
  );
  report = {
    format: 'OptionalInstallationObservation.v1',
    passed: false,
    browserPreparationPassed: false,
    createdAt: new Date().toISOString(),
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    envelopeSha256: sha(envelopeBytes),
    artifacts: envelope.packages,
    transition,
    browserRestart,
    harnessSha256,
    helperSha256,
    inputRoute: {
      academyOfflineDisclosure: 'Native summary keyboard Enter',
      academyProfileTransfer: 'Native summary and import/export button keyboard Enter',
      academyProofTransfer: 'Native import/export button keyboard Enter',
      offlineActions: 'Native button keyboard Enter with fresh status/progress observation',
      limitation:
        'This observer uses the native keyboard route and does not qualify pointer interaction.',
    },
    failure: error.message,
    currentStep,
    diagnostics,
    osApps,
    checkpoints,
    errors,
  };
} finally {
  const cleanupErrors = [];
  try {
    for (const app of osApps.filter((row) => row.installed && !row.uninstalled)) {
      try {
        await boundedOperation('PWA.uninstall cleanup', () =>
          cdp.send('PWA.uninstall', { manifestId: app.manifestId }),
        );
        app.uninstalled = true;
      } catch (error) {
        cleanupErrors.push({ id: app.id, error: error.message });
      }
    }
    if (context) await boundedOperation('Browser cleanup', () => context.close());
  } catch (error) {
    cleanupErrors.push({ error: error.message });
  } finally {
    try {
      if (served) {
        served.server.closeIdleConnections?.();
        try {
          await boundedOperation(
            'Local server cleanup',
            () => new Promise((resolve) => served.server.close(resolve)),
          );
        } catch (error) {
          served.server.closeAllConnections?.();
          cleanupErrors.push({ error: error.message });
        }
      }
    } finally {
      cleanupErrors.push(...resourceCleanupIssues(acquiringResources));
      if (!cleanupErrors.length) await rm(work, { recursive: true, force: true });
    }
  }
  report.cleanup = {
    errors: cleanupErrors,
    ...(cleanupErrors.length ? { retainedDirectory: work } : { temporaryProfileRemoved: true }),
  };
  report.passed &&= !cleanupErrors.length;
  if (quotaProbeEnabled) {
    report.quotaProbe = {
      enabled: true,
      sourceSha256: quotaProbeSha256,
      sourceStable: quotaProbeSha256 === sha(await readFile(quotaProbeURL)),
      result: quotaProbeReport,
      selectedIDs: quotaPackageIds,
      perPackage: quotaProbePerPackage,
      scope: `${quotaPackageIds.length === 1 ? 'Academy only' : 'All three apps, sequentially'}; isolated Chromium origin-wide CDP quota override. Not physical storage exhaustion, eviction or proof of the exact failing cache API. The retry uses a same-payload path fixture, not a distinct release.`,
    };
    report.passed &&=
      report.quotaProbe.sourceStable &&
      quotaPackageIds.every(
        (id) =>
          quotaProbePerPackage[id]?.completed === true &&
          quotaProbePerPackage[id]?.retryPreparedAndRemoved === true,
      );
  }
  if (statusDiagnosticsEnabled) {
    report.statusDiagnostics = {
      ...statusDiagnostics,
      sourceSha256: diagnosticSha256,
      sourceStable: diagnosticSha256 === sha(await readFile(diagnosticURL)),
      limitation:
        'Opt-in observer wrappers forward original message/registration calls and capture bounded status, registration and page lifecycle events, with first-page CDP worker lifecycle/errors. The CDP session detaches when its page closes. Admitted package files are unchanged; API instrumentation can affect scheduling, so this is diagnostic evidence rather than an uninstrumented acceptance run.',
    };
    report.passed &&= report.statusDiagnostics.sourceStable;
  }
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify({
      passed: report.passed,
      failure: report.failure,
      checkpoints: checkpoints.length,
      osApps,
      cleanup: report.cleanup,
    }),
  );
  if (!report.passed) process.exitCode = 1;
}
