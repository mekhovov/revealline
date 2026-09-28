import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readEditionZip } from '../publishing/edition-zip.mjs';
import { validateOptionalPackageAdmission } from '../publishing/optional-package-admission.mjs';
import { startServer } from './game-cli.mjs';

const [modulePath, bundlePath, output = '/tmp/optional-installation-observation.json'] =
  process.argv.slice(2);
if (!modulePath || !bundlePath)
  throw new Error('Pass external Playwright module, frozen optional bundle and output JSON.');
const { chromium } = await import(pathToFileURL(path.resolve(modulePath)).href);
const bundle = path.resolve(bundlePath),
  sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const envelopeBytes = await readFile(path.join(bundle, 'optional-packages.json'));
const envelope = JSON.parse(envelopeBytes);
const harnessSha256 = sha(await readFile(fileURLToPath(import.meta.url)));
const admittedBytes = new Map();
await validateOptionalPackageAdmission(envelope, {
  read: async (row) => {
    if (!admittedBytes.has(row.path))
      admittedBytes.set(row.path, await readFile(path.join(bundle, row.path)));
    return admittedBytes.get(row.path);
  },
});
const version = envelope.version,
  fpv = 'civilian-fpv',
  gym = 'civilian-flight';
const priorFixture = 'v0.0.0',
  failedFixture = 'v0.0.1';
assert.ok(
  ![priorFixture, failedFixture].includes(version),
  'Fixture paths must differ from candidate.',
);
const work = await mkdtemp(path.join(tmpdir(), 'optional-installation-'));
const root = path.join(work, 'site'),
  profile = path.join(work, 'browser');
const entries = new Map(),
  manifests = new Map(),
  checkpoints = [],
  errors = [],
  osApps = [];
let served, context, cdp, report;
const appWindows = new Map();
const relativeRoot = (id) => `revealline/practice/${id}/`;
const site = (id, selected = version) => `${relativeRoot(id)}releases/${selected}/site/`;
const entry = (id, selected = version) => site(id, selected) + `optional-practice/${id}/index.html`;
async function put(name, bytes) {
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
async function stage(id, selected) {
  for (const [name, bytes] of entries.get(id)) {
    await put(site(id, selected) + name, bytes);
    if (name.startsWith('launcher/')) await put(relativeRoot(id) + 'app/' + name.slice(9), bytes);
  }
}
try {
  for (const id of [fpv, gym]) {
    const item = envelope.packages.find((row) => row.id === id);
    assert.ok(item, `Frozen bundle must include ${id}.`);
    entries.set(id, readEditionZip(admittedBytes.get(item.distribution.path)));
    manifests.set(id, JSON.parse(entries.get(id).get('launcher/app.webmanifest')));
    assert.equal(manifests.get(id).id, '/' + relativeRoot(id));
    await stage(id, version);
  }
  await stage(fpv, priorFixture);
  await stage(fpv, failedFixture);
  await pointer(fpv, priorFixture);
  await pointer(gym, version);
  await put('.xonix-build.json', JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }));
  served = await startServer({ root, port: 0 });
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  page.on('pageerror', (error) => errors.push(error.message));
  cdp = await context.newCDPSession(page);
  const url = (name) => new URL(name, served.url).href;
  async function open(id, selected = version) {
    await page.goto(url(entry(id, selected)));
    await page.locator('#help').waitFor();
    // Wait for the ordinary application mount, not merely the static HTML.
    await page.waitForFunction(
      () => globalThis.document.getElementById('help').textContent.trim().length > 0,
    );
  }
  async function prepare(id) {
    await page.locator('#help').click();
    await page.locator(id === fpv ? '#install-offline' : '#offline').click();
    const status = page.locator(id === fpv ? '#transfer-status' : '#package-status');
    await status
      .filter({ hasText: /ready offline|ready for offline|prepared offline/i })
      .waitFor({ timeout: 20000 });
    await page.locator(id === fpv ? '[data-close="help-dialog"]' : '#close-help').click();
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
    await page.locator('#notebook-button').click();
    await page.getByRole('button', { name: 'Export verified flight proofs', exact: true }).click();
    const value = await page
      .getByRole('textbox', { name: 'Flight proof backup JSON', exact: true })
      .inputValue();
    await page.locator('[data-close="notebook-dialog"]').click();
    return value;
  }
  await open(fpv, priorFixture);
  await prepare(fpv);
  const demonstrations = await import(
    pathToFileURL(
      path.join(root, site(fpv, priorFixture), 'optional-practice/civilian-fpv/demonstrations.mjs'),
    ).href
  );
  const proof = structuredClone(demonstrations.FLIGHT_DEMONSTRATIONS[0]);
  proof.session = 'practice';
  await page.locator('#notebook-button').click();
  await page
    .getByRole('textbox', { name: 'Flight proof backup JSON', exact: true })
    .fill(JSON.stringify({ format: 'FlightProofBackup.v1', packageId: fpv, attempts: [proof] }));
  await page.getByRole('button', { name: 'Import and reverify proofs', exact: true }).click();
  await page
    .locator('#flight-notebook')
    .getByRole('status')
    .filter({ hasText: 'Saved on this device' })
    .waitFor();
  await page.locator('[data-close="notebook-dialog"]').click();
  const savedProof = await exportedProof();
  assert.equal(JSON.parse(savedProof).attempts.length, 1);
  await open(gym);
  await prepare(gym);
  const both = await inspect('both-prepared');
  assert.equal(installed(both, fpv).active.version, priorFixture);
  assert.equal(installed(both, gym).active.version, version);
  for (const id of [fpv, gym]) {
    const manifestId = url(manifests.get(id).id),
      installUrlOrBundleUrl = url(relativeRoot(id) + 'app/');
    await page.goto(installUrlOrBundleUrl);
    await page.waitForFunction(
      () => globalThis.document.getElementById('title').textContent.length > 0,
    );
    const app = { id, manifestId, installed: false };
    osApps.push(app);
    try {
      await cdp.send('PWA.install', { manifestId, installUrlOrBundleUrl });
      app.installed = true;
      app.state = await cdp.send('PWA.getOsAppState', { manifestId });
      await cdp.send('PWA.changeAppUserSettings', { manifestId, displayMode: 'standalone' });
      const pendingWindow = context.waitForEvent('page', { timeout: 10000 }).catch(() => null);
      app.launch = await cdp.send('PWA.launch', { manifestId });
      const appWindow = await pendingWindow;
      assert.ok(appWindow, 'PWA.launch must create its app window.');
      appWindows.set(id, appWindow);
      await appWindow.waitForLoadState('domcontentloaded');
      app.window = await appWindow.evaluate(() => ({
        standalone: globalThis.matchMedia('(display-mode: standalone)').matches,
        url: globalThis.location.href,
      }));
      assert.equal(app.window.url, installUrlOrBundleUrl);
    } catch (error) {
      app.error = error.message;
    }
  }
  await context.setOffline(true);
  await open(gym);
  await open(fpv, priorFixture);
  assert.equal(await exportedProof(), savedProof);
  await inspect('both-open-offline');
  await context.setOffline(false);
  await pointer(fpv, version);
  await page.goto(url(relativeRoot(fpv) + 'app/'));
  await page.locator('#check').click();
  await page.locator('#prepare').click();
  await page.waitForURL(url(entry(fpv)));
  assert.equal(page.url(), url(entry(fpv)));
  await prepare(fpv);
  assert.equal(await exportedProof(), savedProof);
  const upgraded = await inspect('candidate-installed-over-alternate-path');
  assert.equal(installed(upgraded, fpv).active.version, version);
  assert.equal(installed(upgraded, fpv).previous.version, priorFixture);
  assert.equal(upgraded.keys[keyFor(gym)], both.keys[keyFor(gym)]);
  const failureFile = site(fpv, failedFixture) + 'optional-practice/civilian-fpv/README.md';
  await put(failureFile, 'Truncated dependency fixture');
  await open(fpv, failedFixture);
  await page.locator('#help').click();
  await page.locator('#install-offline').click();
  await page
    .locator('#transfer-status')
    .filter({ hasText: /verification failed|timed out/ })
    .waitFor({ timeout: 20000 });
  const failed = await inspect('failed-install-preserves-pointers');
  assert.equal(failed.keys[keyFor(fpv)], upgraded.keys[keyFor(fpv)]);
  assert.equal(failed.keys[keyFor(gym)], upgraded.keys[keyFor(gym)]);
  assert.ok(failed.caches.every((name) => !name.includes('/' + site(fpv, failedFixture))));
  await open(fpv);
  await page.locator('#help').click();
  await page.locator('#remove-offline').click();
  await page
    .locator('#transfer-status')
    .filter({ hasText: /removed/i })
    .waitFor();
  const rolledBack = await inspect('candidate-removed-retained-path-restored');
  assert.equal(installed(rolledBack, fpv).active.version, priorFixture);
  assert.equal(rolledBack.keys[keyFor(gym)], both.keys[keyFor(gym)]);
  await context.setOffline(true);
  await page.goto(url(relativeRoot(fpv) + 'app/'));
  await page.locator('#open').click();
  await page.waitForURL(url(entry(fpv, priorFixture)));
  assert.equal(page.url(), url(entry(fpv, priorFixture)));
  assert.equal(await exportedProof(), savedProof);
  await open(gym);
  await inspect('rollback-and-other-package-work-offline');
  await context.setOffline(false);
  await page.locator('#help').click();
  await page.locator('#remove-offline').click();
  await page
    .locator('#package-status')
    .filter({ hasText: /removed/i })
    .waitFor();
  const afterGymRemoval = await inspect('gym-cache-removal-preserves-fpv');
  assert.equal(afterGymRemoval.keys[keyFor(fpv)], rolledBack.keys[keyFor(fpv)]);
  assert.deepEqual(
    afterGymRemoval.caches.filter((name) => name.includes('/practice/civilian-fpv/')),
    rolledBack.caches.filter((name) => name.includes('/practice/civilian-fpv/')),
  );
  const installedGym = osApps.find((item) => item.id === gym && item.installed);
  const installedFPV = osApps.find((item) => item.id === fpv && item.installed);
  if (installedGym && installedFPV) {
    await cdp.send('PWA.uninstall', { manifestId: installedGym.manifestId });
    installedGym.uninstalled = true;
    installedFPV.afterOtherUninstall = await cdp.send('PWA.getOsAppState', {
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
  await open(fpv, priorFixture);
  assert.equal(await exportedProof(), savedProof);
  const osInstallationStatus = osApps.every(
    (app) => app.installed && app.launch?.targetId && !app.error,
  )
    ? 'passed'
    : 'unverified';
  const standaloneWindowStatus = osApps.every((app) => app.window?.standalone)
    ? 'passed'
    : 'unverified';
  const harnessStable = harnessSha256 === sha(await readFile(fileURLToPath(import.meta.url)));
  report = {
    format: 'OptionalInstallationObservation.v1',
    passed: errors.length === 0 && osInstallationStatus === 'passed' && harnessStable,
    browserPreparationPassed: true,
    osInstallationStatus,
    standaloneWindowStatus,
    harnessStable,
    createdAt: new Date().toISOString(),
    browser: context.browser()?.version() ?? 'Chrome persistent context',
    scope:
      'Isolated local persistent Chrome profile, exact downloaded CI runtime bytes and ordinary offline/backup UI. v0.0.0/v0.0.1 are same-payload path fixtures, not allocated releases or actual model upgrades. Progress comes from an explicitly scripted verified input import, not a human flight. No public deployment or physical radio claim.',
    envelopeSha256: sha(envelopeBytes),
    sourceRevision: envelope.sourceRevision,
    sourceTree: envelope.sourceTree,
    artifacts: envelope.packages.map(({ id, distribution, manifest }) => ({
      id,
      distribution,
      manifest,
    })),
    harnessSha256,
    proof: {
      input: 'first frozen demonstration frames under an explicit synthetic practice session',
      sha256: sha(savedProof),
      attempts: 1,
    },
    osApps,
    checkpoints,
    errors,
  };
} catch (error) {
  report = {
    format: 'OptionalInstallationObservation.v1',
    passed: false,
    browserPreparationPassed: false,
    createdAt: new Date().toISOString(),
    sourceRevision: envelope.sourceRevision,
    envelopeSha256: sha(envelopeBytes),
    harnessSha256,
    failure: error.message,
    osApps,
    checkpoints,
    errors,
  };
} finally {
  const cleanupErrors = [];
  try {
    for (const app of osApps.filter((row) => row.installed && !row.uninstalled)) {
      try {
        await cdp.send('PWA.uninstall', { manifestId: app.manifestId });
        app.uninstalled = true;
      } catch (error) {
        cleanupErrors.push({ id: app.id, error: error.message });
      }
    }
    await context?.close();
  } catch (error) {
    cleanupErrors.push({ error: error.message });
  } finally {
    try {
      if (served) await new Promise((resolve) => served.server.close(resolve));
    } finally {
      if (!cleanupErrors.length) await rm(work, { recursive: true, force: true });
    }
  }
  report.cleanup = {
    errors: cleanupErrors,
    ...(cleanupErrors.length ? { retainedDirectory: work } : { temporaryProfileRemoved: true }),
  };
  report.passed &&= !cleanupErrors.length;
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
