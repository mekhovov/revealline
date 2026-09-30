import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { readEditionZip } from '../publishing/edition-zip.mjs';
import { validateOptionalPackageAdmission } from '../publishing/optional-package-admission.mjs';
import { startServer } from './game-cli.mjs';

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
  priorVersion = previous?.envelope.version ?? 'v0.0.0',
  failedFixture = 'v0.0.1';
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
async function stage(id, selected, files = entries.get(id)) {
  for (const [name, bytes] of files) await put(site(id, selected) + name, bytes);
}
async function stageLauncher(id, files = entries.get(id)) {
  for (const [name, bytes] of files)
    if (name.startsWith('launcher/')) await put(relativeRoot(id) + 'app/' + name.slice(9), bytes);
}
try {
  for (const id of [fpv, gym]) {
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
  await pointer(fpv, priorVersion);
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
    await page
      .getByRole('button', {
        name: 'Export verified flight proofs',
        exact: true,
      })
      .click();
    const value = await page
      .getByRole('textbox', { name: 'Flight proof backup JSON', exact: true })
      .inputValue();
    await page.locator('[data-close="notebook-dialog"]').click();
    return value;
  }
  async function exportedProfiles() {
    await page.locator('#setup').click();
    await page.getByRole('button', { name: 'Export profiles', exact: true }).click();
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
      path.join(root, site(fpv, priorVersion), 'optional-practice/civilian-fpv/demonstrations.mjs'),
    ).href
  );
  const proof = structuredClone(demonstrations.FLIGHT_DEMONSTRATIONS[0]);
  proof.session = 'practice';
  await page.locator('#notebook-button').click();
  await page.getByRole('textbox', { name: 'Flight proof backup JSON', exact: true }).fill(
    JSON.stringify({
      format: 'FlightProofBackup.v1',
      packageId: fpv,
      attempts: [proof],
    }),
  );
  await page.getByRole('button', { name: 'Import and reverify proofs', exact: true }).click();
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
  await page.locator('#setup').click();
  await page
    .getByRole('textbox', { name: 'Profile JSON', exact: true })
    .fill(JSON.stringify(profileFixture));
  await page.getByRole('button', { name: 'Import profiles', exact: true }).click();
  await page.locator('[data-close="setup-dialog"]').click();
  const savedProfiles = await exportedProfiles();
  assert.deepEqual(JSON.parse(savedProfiles), profileFixture);
  await open(gym);
  await prepare(gym);
  const both = await inspect('both-prepared');
  assert.equal(installed(both, fpv).active.version, priorVersion);
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
      await cdp.send('PWA.changeAppUserSettings', {
        manifestId,
        displayMode: 'standalone',
      });
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
      assert.equal(app.window.standalone, true, 'Installed launcher must run in standalone mode.');
    } catch (error) {
      app.error = error.message;
    }
  }
  await context.setOffline(true);
  await open(gym);
  await open(fpv, priorVersion);
  assert.equal(await exportedProof(), savedProof);
  assert.equal(await exportedProfiles(), savedProfiles);
  await inspect('both-open-offline');
  await context.setOffline(false);
  await stageLauncher(fpv);
  await pointer(fpv, version);
  await page.goto(url(relativeRoot(fpv) + 'app/'));
  await page.locator('#check').click();
  await page.locator('#prepare').click();
  await page.waitForURL(url(entry(fpv)));
  assert.equal(page.url(), url(entry(fpv)));
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
  assert.equal(installed(rolledBack, fpv).active.version, priorVersion);
  assert.equal(rolledBack.keys[keyFor(gym)], both.keys[keyFor(gym)]);
  await context.setOffline(true);
  await page.goto(url(relativeRoot(fpv) + 'app/'));
  await page.locator('#open').click();
  await page.waitForURL(url(entry(fpv, priorVersion)));
  assert.equal(page.url(), url(entry(fpv, priorVersion)));
  assert.equal(await exportedProof(), savedProof);
  assert.equal(await exportedProfiles(), savedProfiles);
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
  await open(fpv, priorVersion);
  assert.equal(await exportedProof(), savedProof);
  assert.equal(await exportedProfiles(), savedProfiles);
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
    passed:
      errors.length === 0 &&
      osInstallationStatus === 'passed' &&
      standaloneWindowStatus === 'passed' &&
      harnessStable,
    browserPreparationPassed: true,
    osInstallationStatus,
    standaloneWindowStatus,
    harnessStable,
    createdAt: new Date().toISOString(),
    browser: context.browser()?.version() ?? 'Chrome persistent context',
    scope:
      'Isolated local persistent Chrome profile, admitted frozen runtime bytes and ordinary offline/profile/backup UI. ' +
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
} catch (error) {
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
