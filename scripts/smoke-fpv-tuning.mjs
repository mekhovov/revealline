/* global window, document, navigator, Storage, localStorage, DOMException */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const fixture = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Local FPV tuning qualification</title>
<link rel="stylesheet" href="/optional-practice/civilian-fpv/tuning.css">
<body><script type="module">
import { mountFlightTuning } from '/optional-practice/civilian-fpv/tuning-ui.mjs';
import { createTuningLibraryStore } from '/optional-practice/civilian-fpv/tuning-library.mjs';
window.qualificationLocale = 'en';
window.qualificationEvents = { tests: [], applies: [], saved: [], advanced: [] };
window.qualificationStore = createTuningLibraryStore({ storage: localStorage, locks: navigator.locks });
window.qualificationUI = mountFlightTuning({ document, window, store: window.qualificationStore,
  locale: () => window.qualificationLocale,
  onTest: value => window.qualificationEvents.tests.push(value),
  onApply: value => window.qualificationEvents.applies.push(value),
  onAdvanced: value => window.qualificationEvents.advanced.push(value),
  onSaved: value => window.qualificationEvents.saved.push(value) });
window.qualificationUI.button(document.body).id = 'open';
window.qualificationReady = true;
</script></body></html>`;

async function editorScenario(browser, { touch = false } = {}) {
  const context = await browser.newContext({
    viewport: touch ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    hasTouch: touch,
    acceptDownloads: true,
    reducedMotion: 'reduce',
  });
  const errors = [],
    page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
  return { context, page, errors };
}

/** Component-level browser checks use real dialogs, storage, Web Locks, file
 * downloads and input events. No production access gate is changed or skipped. */
export async function smokeFpvTuning({ playwrightModule, output } = {}) {
  const playwright = await import(pathToFileURL(path.resolve(playwrightModule)).href),
    sources = new Map(),
    changedDuringRun = new Set(),
    results = [];
  sources.set('scripts/smoke-fpv-tuning.mjs', await readFile(fileURLToPath(import.meta.url)));
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1);
      if (name === 'qualification.html') {
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        response.end(fixture);
        return;
      }
      const filename = path.resolve(root, name);
      if (
        !filename.startsWith(`${root}${path.sep}`) ||
        !['.mjs', '.js', '.css'].includes(path.extname(name)) ||
        name.split('/').some((part) => part.startsWith('.'))
      ) {
        response.writeHead(404);
        response.end();
        return;
      }
      const bytes = await readFile(filename);
      if (sources.has(name) && !sources.get(name).equals(bytes)) changedDuringRun.add(name);
      if (!sources.has(name)) sources.set(name, bytes);
      response.writeHead(200, {
        'Content-Type': name.endsWith('.css') ? 'text/css' : 'text/javascript',
        'Cache-Control': 'no-store',
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/qualification.html`;
  const presetFolder = await mkdtemp(path.join(tmpdir(), 'fpv-tuning-preset-'));
  try {
    await writeFile(
      path.join(presetFolder, 'main.txt'),
      'set yaw_srate = 80\n#$ OPTION BEGIN (CHECKED): Fast yaw\n#$ OPTION END\n#$ INCLUDE: included.txt\n',
    );
    await writeFile(
      path.join(presetFolder, 'included.txt'),
      '#$ OPTION BEGIN (UNCHECKED): FAST YAW\nset yaw_srate = 90\n#$ OPTION END\n',
    );
    await writeFile(path.join(presetFolder, 'other.txt'), 'set roll_srate = 72\n');
    for (const engine of ['chromium', 'firefox', 'webkit']) {
      let browser;
      try {
        browser = await playwright[engine].launch({
          headless: true,
          ...(engine === 'chromium' ? { channel: 'chrome' } : {}),
        });
        for (const touch of [false, true]) {
          const { context, page, errors } = await editorScenario(browser, { touch });
          const evidence = { engine, version: browser.version(), touch, checks: {} };
          try {
            await page.goto(url);
            await page.waitForFunction(() => window.qualificationReady);
            const button = (name) => page.getByRole('button', { name, exact: true });
            const section = (name) => button(name).click();
            const libraryActions = new Set([
              'New Actual profile',
              'Duplicate',
              'Make player default',
              'Delete & reassign',
              'Restore revision to draft',
              'Preview import',
              'Save import as new profile',
              'Resolve preset and review options',
              'Export SIM rates',
              'Export rate-only CLI',
              'Download file',
              'Backup complete library',
              'Restore library backup',
              'Refresh library',
              'Use rate profile in draft',
              'Use saved setup in draft',
            ]);
            const click = async (name) => {
              if (libraryActions.has(name)) await section('Library');
              if (name === 'Duplicate drone setup') await section('Aircraft');
              if (name === 'Advanced reference quad · experimental')
                await section('Flight response / PID');
              await button(name).click();
            };
            const useProfile = async (id) => {
              await section('Library');
              await page.getByLabel('Rate profile', { exact: true }).selectOption(id);
              await click('Use rate profile in draft');
            };

            if (touch) await button('Aircraft, rates & throttle').tap();
            else {
              await button('Aircraft, rates & throttle').focus();
              await page.keyboard.press('Enter');
            }
            await page.getByRole('dialog', { name: 'Setup workbench', exact: true }).waitFor();
            check(
              await page.locator('h2').evaluate((node) => node === document.activeElement),
              'Heading did not receive keyboard focus',
            );
            await click('New Actual profile');
            await page.waitForFunction(
              () => window.qualificationStore.snapshot().profiles.length === 2,
            );
            await page
              .getByLabel('When saving edited rates', { exact: true })
              .selectOption('update');
            await section('Library');
            await page.getByLabel('Profile name', { exact: true }).fill('Race practice');
            await section('Rates & throttle');
            await page.getByLabel('Link roll and pitch edits', { exact: true }).check();
            const roll = page.getByRole('group', {
              name: 'Roll',
              exact: true,
              includeHidden: true,
            });
            const pitch = page.getByRole('group', {
              name: 'Pitch',
              exact: true,
              includeHidden: true,
            });
            await roll
              .getByRole('spinbutton', {
                name: 'Maximum rate (°/s)',
                exact: true,
                includeHidden: true,
              })
              .fill('895');
            check(
              (await roll
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '895',
              'An unfinished number was snapped before committing',
            );
            await page.keyboard.press('Tab');
            check(
              (await roll
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '900' &&
                (await roll
                  .getByRole('slider', { name: 'Maximum rate (°/s)', exact: true })
                  .inputValue()) === '900',
              'Blur did not align the displayed number and slider with representable rates',
            );
            check(
              (await pitch
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '900',
              'Linked pitch did not update',
            );
            await pitch
              .getByRole('spinbutton', {
                name: 'Maximum rate (°/s)',
                exact: true,
                includeHidden: true,
              })
              .fill('670');
            check(
              (await roll
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '670',
              'Returning the peer to its original rate left the linked draft stale',
            );
            await roll
              .getByRole('spinbutton', {
                name: 'Maximum rate (°/s)',
                exact: true,
                includeHidden: true,
              })
              .fill('900');
            await section('Rates & throttle');
            await page.getByLabel('Rate algorithm', { exact: true }).selectOption('quick');
            await section('Rates & throttle');
            await page.getByLabel('Rate algorithm', { exact: true }).selectOption('betaflight');
            const rcRate = roll.getByRole('spinbutton', { name: 'RC rate', exact: true });
            for (const [typed, committed] of [
              ['1.235', '1.24'],
              ['0.25', '0.25'],
            ]) {
              await rcRate.fill('');
              await rcRate.pressSequentially(typed);
              check(
                (await rcRate.inputValue()) === typed,
                'Sequential typing lost the decimal or a digit',
              );
              await page.keyboard.press('Tab');
              check(
                (await rcRate.inputValue()) === committed,
                'RC rate did not commit supported units',
              );
            }
            await section('Rates & throttle');
            await page.getByLabel('Rate algorithm', { exact: true }).selectOption('actual');
            check(
              (await roll
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '900',
              'Algorithm draft was reinterpreted',
            );
            const unfinishedRate = roll.getByRole('spinbutton', {
                name: 'Maximum rate (°/s)',
                exact: true,
              }),
              unfinishedProfile = await page
                .getByLabel('Rate profile', { exact: true })
                .inputValue(),
              beforeUnfinishedRate = await page.evaluate(() => window.qualificationStore.export());
            await section('Rates & throttle');
            await unfinishedRate.fill('');
            const checkUnfinishedRate = async (transition) => {
              check(
                (await unfinishedRate.inputValue()) === '' &&
                  (await unfinishedRate.getAttribute('aria-invalid')) === 'true',
                `${transition} discarded the unfinished rate entry`,
              );
              for (const action of ['Save for next flight', 'Test draft · unscored']) {
                await click(action);
                await page.getByRole('status').filter({ hasText: 'enter a value' }).waitFor();
              }
              check(
                (await page.evaluate(() => window.qualificationStore.export())) ===
                  beforeUnfinishedRate &&
                  (await page.evaluate(() =>
                    Object.values(window.qualificationEvents).every(
                      (events) => events.length === 0,
                    ),
                  )),
                `${transition} allowed saving or flying the previous hidden rate`,
              );
            };
            await section('Rates & throttle');
            await page.getByLabel('Rate algorithm', { exact: true }).selectOption('quick');
            await section('Rates & throttle');
            await page.getByLabel('Rate algorithm', { exact: true }).selectOption('actual');
            await checkUnfinishedRate('Algorithm navigation');
            await useProfile('legacy-feel');
            await useProfile(unfinishedProfile);
            await checkUnfinishedRate('Profile navigation');
            await click('Close');
            await click('Aircraft, rates & throttle');
            await checkUnfinishedRate('Editor reopening');
            await page.evaluate(() => {
              window.qualificationLocale = 'uk';
              window.qualificationUI.refresh();
            });
            check(
              (await page
                .getByRole('group', { name: 'Крен', exact: true })
                .getByRole('spinbutton', { name: 'Максимальний рейт (°/с)', exact: true })
                .inputValue()) === '',
              'Language change discarded the unfinished rate entry',
            );
            await page.evaluate(() => {
              window.qualificationLocale = 'en';
              window.qualificationUI.refresh();
            });
            await checkUnfinishedRate('Language round trip');
            await section('Rates & throttle');
            await unfinishedRate.fill('900');
            await page.keyboard.press('Tab');
            evidence.checks.unfinishedRateDraftNavigation = true;
            await section('Library');
            await page
              .getByText('Import / export · Betaflight and backups', { exact: true })
              .click();
            await click('Export SIM rates');
            const digestTransfer = page.getByLabel('Paste CLI or a SIM rate profile', {
                exact: true,
              }),
              digestCandidate = JSON.parse(await digestTransfer.inputValue());
            digestCandidate.profile.axes.roll.rate = 88;
            await section('Library');
            await digestTransfer.fill(JSON.stringify(digestCandidate));
            // Hold only this component's next digest completion, then use the
            // real WebCrypto implementation. This tests asynchronous admission,
            // not a claim that ordinary digest timing is observable by pilots.
            await page.evaluate(() => {
              const subtle = crypto.subtle,
                original = subtle.digest;
              subtle.digest = function (...args) {
                return new Promise((resolve, reject) => {
                  window.qualificationReleaseDigest = () => {
                    subtle.digest = original;
                    original.apply(subtle, args).then(resolve, reject);
                  };
                });
              };
            });
            await click('Preview import');
            await page.getByRole('status').filter({ hasText: 'Checking import source' }).waitFor();
            await section('Rates & throttle');
            await unfinishedRate.fill('');
            await page.evaluate(() => window.qualificationReleaseDigest());
            await page.getByRole('status').filter({ hasText: 'Import changed' }).waitFor();
            await click('Save import as new profile');
            await page
              .getByRole('status')
              .filter({ hasText: 'Preview the import first' })
              .waitFor();
            check(
              (await unfinishedRate.inputValue()) === '' &&
                (await page.evaluate(() => window.qualificationStore.export())) ===
                  beforeUnfinishedRate,
              'Late import preview replaced or saved a newer unfinished edit',
            );
            await section('Rates & throttle');
            await unfinishedRate.fill('900');
            await page.keyboard.press('Tab');
            evidence.checks.pendingImportPreservesNewerNumericText = true;
            await section('Library');
            await page
              .getByText('Import / export · Betaflight and backups', { exact: true })
              .click();
            await section('Camera');
            const cameraTilt = page.getByRole('spinbutton', {
                name: 'Camera tilt (degrees)',
                exact: true,
                includeHidden: true,
              }),
              cameraFov = page.getByRole('spinbutton', {
                name: 'Vertical FOV (degrees)',
                exact: true,
                includeHidden: true,
              });
            await section('Camera');
            await cameraTilt.fill('');
            const beforeInvalidCamera = await page.evaluate(() =>
              window.qualificationStore.export(),
            );
            for (const action of [
              'Save for next flight',
              'Apply & restart',
              'Duplicate drone setup',
              'Test draft · unscored',
              'Advanced reference quad · experimental',
            ]) {
              await click(action);
              await page.getByRole('status').filter({ hasText: 'enter a value' }).waitFor();
              check(
                (await cameraTilt.inputValue()) === '' &&
                  (await page.evaluate(() => window.qualificationStore.export())) ===
                    beforeInvalidCamera &&
                  (await page.evaluate(() =>
                    Object.values(window.qualificationEvents).every(
                      (events) => events.length === 0,
                    ),
                  )),
                `${action} accepted an incomplete camera value`,
              );
            }
            await section('Aircraft');
            await page.getByLabel('Drone name', { exact: true }).fill('Pending camera setup');
            const draftProfileId = await page
              .getByLabel('Rate profile', { exact: true })
              .inputValue();
            await useProfile('legacy-feel');
            await useProfile(draftProfileId);
            check(
              (await cameraTilt.inputValue()) === '',
              'Changing profiles coerced a blank camera draft',
            );
            await click('Close');
            await click('Aircraft, rates & throttle');
            check((await cameraTilt.inputValue()) === '', 'Reopening coerced a blank camera draft');
            await section('Camera');
            await cameraTilt.pressSequentially('35.25');
            await section('Camera');
            await cameraFov.fill('999');
            await click('Test draft · unscored');
            await page.getByRole('status').filter({ hasText: 'enter a value' }).waitFor();
            check(
              await page.evaluate(() => window.qualificationEvents.tests.length === 0),
              'Out-of-range FOV escaped into a draft flight',
            );
            await section('Camera');
            await cameraFov.fill('100.5');
            await useProfile('legacy-feel');
            await useProfile(draftProfileId);
            check(
              (await page
                .getByRole('spinbutton', {
                  name: 'Camera tilt (degrees)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '35.25' &&
                (await page
                  .getByRole('spinbutton', {
                    name: 'Vertical FOV (degrees)',
                    exact: true,
                    includeHidden: true,
                  })
                  .inputValue()) === '100.5' &&
                (await page.getByLabel('Drone name', { exact: true }).inputValue()) ===
                  'Pending camera setup',
              'Selecting a rate profile discarded the independent drone draft',
            );
            const beforeDraft = await page.evaluate(() => window.qualificationStore.export());
            await click('Test draft · unscored');
            await page.waitForFunction(() => window.qualificationEvents.tests.length === 1);
            check(
              await page.evaluate(
                () => window.qualificationEvents.tests[0].response.rates.axes.roll.rate === 90,
              ),
              'Test callback did not freeze edited Actual rates',
            );
            check(
              await page.evaluate(() => {
                const camera = window.qualificationEvents.tests[0].camera;
                return camera.tilt === 35.25 && camera.verticalFov === 100.5;
              }),
              'Draft testing changed continuous camera degrees',
            );
            check(
              (await page.evaluate(() => window.qualificationStore.export())) === beforeDraft,
              'Testing wrote the saved library',
            );
            await page.getByRole('button', { name: /^Return to tuning/ }).click();
            check(
              (await roll
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '900',
              'Returning lost draft',
            );
            await click('Save for next flight');
            await page
              .getByRole('status')
              .filter({ hasText: 'Saved for the next flight' })
              .waitFor();
            const profileId = await page.getByLabel('Rate profile', { exact: true }).inputValue();
            await section('Aircraft');
            await page
              .getByLabel('Rates used by this drone', { exact: true })
              .selectOption(profileId);
            await click('Save for next flight');
            await page.waitForFunction(
              (id) => window.qualificationStore.effective().profileId === id,
              profileId,
            );
            evidence.checks.keyboardOrTouchEntry = true;
            evidence.checks.linkedAxesAndAlgorithmDrafts = true;
            evidence.checks.testReturnSave = true;
            evidence.checks.droneAssignmentCamera = true;
            evidence.checks.numericCommitMatchesSavedUnits = true;
            evidence.checks.independentSetupDraftAcrossProfiles = true;
            evidence.checks.cameraValidationAndRawDraftPreservation = true;
            evidence.checks.fractionalCameraDegrees = true;
            await section('Library');
            await page
              .getByText('Import / export · Betaflight and backups', { exact: true })
              .click();
            await click('Export SIM rates');
            const transfer = page.getByLabel('Paste CLI or a SIM rate profile', { exact: true });
            const native = await transfer.inputValue();
            check(JSON.parse(native).profile.axes.roll.rate === 90, 'Native export lost rates');
            const downloadPromise = page.waitForEvent('download');
            await click('Download file');
            const download = await downloadPromise;
            const contents = await readFile(await download.path(), 'utf8');
            check(
              JSON.stringify(JSON.parse(contents)) === JSON.stringify(JSON.parse(native)) &&
                download.suggestedFilename().endsWith('.json'),
              'Browser export differs from preview',
            );
            // A name-only save gives history the same evaluated rates. Restoring
            // it must cancel older import intent even though value comparison
            // alone cannot distinguish the two drafts.
            await section('Library');
            await page.getByLabel('Profile name', { exact: true }).fill('Race practice history');
            await click('Save for next flight');
            await page.waitForFunction(
              (id) =>
                window.qualificationStore.snapshot().profiles.find((profile) => profile.id === id)
                  ?.name === 'Race practice history',
              profileId,
            );
            const beforeHistoryImport = await page.evaluate(() =>
                window.qualificationStore.export(),
              ),
              historyCandidate = JSON.parse(native);
            historyCandidate.profile.axes.roll.rate = 88;
            await section('Library');
            await transfer.fill(JSON.stringify(historyCandidate));
            await page.evaluate(() => {
              const subtle = crypto.subtle,
                original = subtle.digest;
              subtle.digest = function (...args) {
                subtle.digest = original;
                return new Promise((resolve, reject) => {
                  window.qualificationReleaseHistoryDigest = async () => {
                    try {
                      resolve(await original.apply(subtle, args));
                    } catch (error) {
                      reject(error);
                    }
                    // Let the preview's continuation run before assertions.
                    await new Promise((done) => setTimeout(done, 0));
                  };
                });
              };
            });
            await click('Preview import');
            await page.waitForFunction(
              () => typeof window.qualificationReleaseHistoryDigest === 'function',
            );
            await click('Restore revision to draft');
            check(
              (await page.getByLabel('Profile name', { exact: true }).inputValue()) ===
                'Race practice',
              'History did not restore the earlier profile name',
            );
            await page.evaluate(() => window.qualificationReleaseHistoryDigest());
            check(
              (await roll
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '900' &&
                (await page.getByLabel('Profile name', { exact: true }).inputValue()) ===
                  'Race practice' &&
                (await page.evaluate(() => window.qualificationStore.export())) ===
                  beforeHistoryImport,
              'Late import replaced restored same-rate history or changed the saved library',
            );
            await click('Save import as new profile');
            await page
              .getByRole('status')
              .filter({ hasText: 'Preview the import first' })
              .waitFor();
            check(
              (await page.evaluate(() => window.qualificationStore.export())) ===
                beforeHistoryImport,
              'Cancelled history import remained eligible to save',
            );
            await click('Save for next flight');
            await page
              .getByRole('status')
              .filter({ hasText: 'Saved for the next flight' })
              .waitFor();
            evidence.checks.historyRestoreCancelsPendingImport = true;
            const firmware = page.getByLabel('Source / export firmware version', { exact: true });
            await firmware.selectOption('4.5.2');
            await click('Export rate-only CLI');
            await page
              .getByRole('status')
              .filter({ hasText: 'different throttle curve' })
              .waitFor();
            const includeThrottle = page.getByLabel('Include throttle settings in CLI export', {
              exact: true,
            });
            await includeThrottle.uncheck();
            await click('Export rate-only CLI');
            const rotationOnly = await transfer.inputValue();
            check(
              !/set (?:thr_|throttle_)/.test(rotationOnly) &&
                rotationOnly.includes('throttle settings are omitted'),
              'Explicit rotation-only export retained throttle',
            );
            await page.getByRole('status').filter({ hasText: 'rotation rates only' }).waitFor();
            await includeThrottle.check();
            await firmware.selectOption('');
            await page.getByLabel('Patch baseline', { exact: true }).selectOption('defaults');
            await section('Library');
            await transfer.fill('# Betaflight 4.5.2\nset roll_srate = 81');
            await click('Preview import');
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await click('Save import as new profile');
            await page.waitForFunction(
              () => window.qualificationStore.snapshot().profiles.length === 3,
            );
            check(
              await page.evaluate(() => {
                const imported = window.qualificationStore.snapshot().profiles.at(-1);
                return (
                  imported.provenance.firmware.origin === 'header' &&
                  imported.provenance.firmware.version === '4.5.2' &&
                  imported.provenance.baseline.kind === 'firmware-defaults'
                );
              }),
              'Header-inferred firmware defaults did not reach the saved receipt',
            );
            await page
              .getByLabel('Replacement when deleting', { exact: true })
              .selectOption(profileId);
            await click('Delete & reassign');
            await page.waitForFunction(
              () => window.qualificationStore.snapshot().profiles.length === 2,
            );
            await page.getByLabel('Patch baseline', { exact: true }).selectOption('draft');
            const beforeImport = await page.evaluate(() => window.qualificationStore.export());
            await page
              .getByLabel('Source / export firmware version', { exact: true })
              .selectOption('2025.12.5');
            await section('Library');
            await transfer.fill('set roll_rc_rate = not-a-number');
            await click('Preview import');
            await page.getByRole('status').filter({ hasText: 'Could not apply' }).waitFor();
            check(
              (await page.evaluate(() => window.qualificationStore.export())) === beforeImport,
              'Malformed import changed storage',
            );
            for (const version of ['3.5.7', '2025.12.5-dev', '2025.12.5+local.1']) {
              await section('Library');
              await transfer.fill(
                `# Betaflight / STM32F405 (S405) ${version} (abcdef)\nset roll_srate = 83`,
              );
              await click('Preview import');
              await page
                .getByRole('status')
                .filter({ hasText: 'conflicts with the file header' })
                .waitFor();
              await click('Save import as new profile');
              await page
                .getByRole('status')
                .filter({ hasText: 'Preview the import first' })
                .waitFor();
              check(
                (await page.evaluate(() => window.qualificationStore.export())) === beforeImport,
                `Unsupported header ${version} changed the library`,
              );
            }
            evidence.checks.unsupportedFirmwareHeadersRejectedAtomically = true;
            const importSource = 'set roll_rc_rate = 12\nset yaw_expo = 30\nset p_roll = 80';
            await section('Library');
            await transfer.fill(importSource);
            await click('Preview import');
            // SHA-256 source receipts finish asynchronously; never click Save
            // merely because the pointer action itself has completed.
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await section('Rates & throttle');
            await roll
              .getByRole('spinbutton', {
                name: 'Maximum rate (°/s)',
                exact: true,
                includeHidden: true,
              })
              .fill('990');
            await click('Save import as new profile');
            await page.getByRole('status').filter({ hasText: 'changed' }).waitFor();
            check(
              await page.evaluate(() => window.qualificationStore.snapshot().profiles.length === 2),
              'Stale import preview saved an obsolete curve',
            );
            check(
              (await roll
                .getByRole('spinbutton', {
                  name: 'Maximum rate (°/s)',
                  exact: true,
                  includeHidden: true,
                })
                .inputValue()) === '990',
              'Rejecting stale preview discarded the visible edit',
            );
            await click('Preview import');
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await click('Save import as new profile');
            await page.waitForFunction(
              () => window.qualificationStore.snapshot().profiles.length === 3,
            );
            check(
              await page.evaluate(
                (id) => window.qualificationStore.effective().profileId === id,
                profileId,
              ),
              'Import silently reassigned the drone',
            );
            const imported = await page.evaluate(() =>
              window.qualificationStore.snapshot().profiles.at(-1),
            );
            const sourceHash = createHash('sha256').update(importSource).digest('hex');
            check(
              imported.provenance?.source.sha256 === sourceHash &&
                imported.provenance.firmware.origin === 'manual' &&
                imported.provenance.firmware.version === '2025.12.5' &&
                imported.provenance.operation === 'patch' &&
                imported.provenance.baseline.profileId === profileId &&
                imported.provenance.review.ignored.entries.some((item) => item.includes('p_roll')),
              'Import did not persist the selected firmware/baseline/source receipt',
            );
            await page.getByText('Import receipt', { exact: true }).click();
            check(
              (await page.locator('details[open] pre').filter({ hasText: sourceHash }).count()) > 0,
              'Saved import receipt is not visible as inert text',
            );
            await click('Backup complete library');
            const receiptBackup = JSON.parse(await transfer.inputValue());
            check(
              receiptBackup.profiles.find((profile) => profile.id === imported.id).provenance.source
                .sha256 === sourceHash,
              'Complete library backup dropped the receipt',
            );
            await click('Restore library backup');
            await page.waitForFunction(
              (revision) => window.qualificationStore.snapshot().revision > revision,
              receiptBackup.revision,
            );
            evidence.checks.importReceipt = {
              sourceSha256: sourceHash,
              sourceBytes: Buffer.byteLength(importSource),
              firmware: imported.provenance.firmware,
              operation: imported.provenance.operation,
              ignoredSettings: imported.provenance.review.ignored.total,
              backupRestore: true,
            };
            evidence.checks.importAtomicAndExplicitAssignment = true;
            evidence.checks.headerInferredDefaults = true;
            evidence.checks.staleImportPreviewRejected = true;
            evidence.checks.explicitRotationOnlyCliExport = true;
            evidence.checks.download = true;

            await page
              .getByLabel('Local preset folder', { exact: true })
              .setInputFiles(presetFolder);
            const presetEntry = page.getByLabel('Preset entry path within folder', { exact: true });
            await presetEntry.fill('main.txt');
            await click('Resolve preset and review options');
            const fastYaw = page.getByLabel('Fast yaw', { exact: true });
            await fastYaw.waitFor();
            check(
              (await transfer.inputValue()).includes('set yaw_srate = 90'),
              'Checked root option did not select a differently cased included option',
            );
            evidence.checks.presetIncludeOptionCaseCompatibility = true;
            await click('Preview import');
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await fastYaw.uncheck();
            const beforePresetSave = await page.evaluate(() => window.qualificationStore.export());
            await click('Preview import');
            await page
              .getByRole('status')
              .filter({ hasText: 'Resolve the preset again before previewing' })
              .waitFor();
            await click('Save import as new profile');
            await page
              .getByRole('status')
              .filter({ hasText: 'Preview the import first' })
              .waitFor();
            check(
              (await page.evaluate(() => window.qualificationStore.export())) === beforePresetSave,
              'Changed preset options saved the obsolete resolved text',
            );
            await click('Resolve preset and review options');
            await click('Preview import');
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await click('Save import as new profile');
            await page.waitForFunction(
              () =>
                window.qualificationStore.snapshot().profiles.at(-1).provenance?.source.kind ===
                'preset',
            );
            check(
              await page.evaluate(() => {
                const profile = window.qualificationStore.snapshot().profiles.at(-1);
                return (
                  profile.response.rates.axes.yaw.rate === 80 &&
                  profile.provenance.preset.options.entries.some((entry) =>
                    entry.includes('"checked":false'),
                  )
                );
              }),
              'Resolved preset did not retain the chosen option and its receipt',
            );
            await presetEntry.fill('other.txt');
            check((await fastYaw.count()) === 0, 'Entry change retained obsolete option controls');
            await click('Preview import');
            await page
              .getByRole('status')
              .filter({ hasText: 'Resolve the preset again before previewing' })
              .waitFor();
            await click('Resolve preset and review options');
            await click('Preview import');
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await click('Save import as new profile');
            await page.waitForFunction(
              () =>
                window.qualificationStore.snapshot().profiles.at(-1).provenance?.preset?.entry ===
                'other.txt',
            );
            check(
              await page.evaluate(() => {
                const profile = window.qualificationStore.snapshot().profiles.at(-1);
                return (
                  profile.response.rates.axes.roll.rate === 72 &&
                  profile.provenance.preset.options.total === 0
                );
              }),
              'Entry change kept choices from the previous preset',
            );
            evidence.checks.stalePresetResolutionRejected = true;
            evidence.checks.presetEntryClearsPriorOptions = true;

            await useProfile(profileId);
            await click('Revert draft');
            const firstSetup = await page.getByLabel('Drone setup', { exact: true }).inputValue();
            const beforeDuplicate = await page.evaluate(() => {
              window.qualificationSetupWrites = { calls: 0, reject: true };
              window.qualificationSetItem = Storage.prototype.setItem;
              Storage.prototype.setItem = function (key, value) {
                if (this === localStorage && key === 'revealline.fpv.tuning.v1') {
                  const probe = window.qualificationSetupWrites;
                  probe.calls++;
                  if (probe.reject || probe.calls > 1)
                    throw new DOMException('Injected setup quota failure', 'QuotaExceededError');
                }
                return window.qualificationSetItem.call(this, key, value);
              };
              return {
                saved: localStorage.getItem('revealline.fpv.tuning.v1'),
                library: window.qualificationStore.export(),
              };
            });
            await click('Duplicate drone setup');
            const secondSetup = await page.getByLabel('Drone setup', { exact: true }).inputValue();
            check(secondSetup !== firstSetup, 'Duplicate did not create a detached setup draft');
            check(
              await page.evaluate(
                (before) =>
                  window.qualificationSetupWrites.calls === 0 &&
                  window.qualificationStore.export() === before.library,
                beforeDuplicate,
              ),
              'Draft duplication wrote the library before Save',
            );
            await click('Save for next flight');
            await page
              .getByRole('status')
              .filter({ hasText: 'Injected setup quota failure' })
              .waitFor();
            check(
              await page.evaluate(
                ({ before, draftId }) =>
                  localStorage.getItem('revealline.fpv.tuning.v1') === before.saved &&
                  window.qualificationStore.export() === before.library &&
                  document.querySelector('[aria-label="Drone setup"]').value === draftId,
                { before: beforeDuplicate, draftId: secondSetup },
              ),
              'Rejected save changed the saved library or discarded the duplicate draft',
            );
            await page.evaluate(() => {
              window.qualificationSetupWrites = { calls: 0, reject: false };
            });
            await click('Save for next flight');
            await page.waitForFunction(
              (id) => window.qualificationStore.snapshot().selectedSetupId === id,
              secondSetup,
            );
            const duplicateWrites = await page.evaluate(() => {
              Storage.prototype.setItem = window.qualificationSetItem;
              return window.qualificationSetupWrites.calls;
            });
            check(duplicateWrites === 1, 'Duplicate save and selection used multiple writes');
            evidence.checks.duplicateIsDraftUntilSave = true;
            evidence.checks.failedDuplicateSavePreservesLibraryAndDraft = true;
            evidence.checks.duplicateCreationAndSelectionUseOneWrite = true;
            evidence.checks.successfulDuplicateRetryClearsFailure = true;
            await section('Library');
            await page.getByLabel('Drone setup', { exact: true }).selectOption(firstSetup);
            await click('Use saved setup in draft');
            await click('Save for next flight');
            await page.waitForFunction(
              (id) => window.qualificationStore.snapshot().selectedSetupId === id,
              firstSetup,
            );
            await section('Aircraft');
            await page.getByLabel('Drone name', { exact: true }).fill('Unsaved selection draft');
            const other = await context.newPage();
            await other.goto(url);
            await other.waitForFunction(() => window.qualificationReady);
            await other
              .getByRole('button', { name: 'Aircraft, rates & throttle', exact: true })
              .click();
            await other.getByRole('button', { name: 'Library', exact: true }).click();
            await other.getByRole('button', { name: 'New Actual profile', exact: true }).click();
            await page.getByRole('status').filter({ hasText: 'Another tab changed' }).waitFor();
            await section('Library');
            await page.getByLabel('Drone setup', { exact: true }).selectOption(secondSetup);
            check(
              (await page.getByLabel('Drone name', { exact: true }).inputValue()) ===
                'Unsaved selection draft',
              'Browsing a saved setup changed the current edited draft',
            );
            await click('Save for next flight');
            await page.getByRole('status').filter({ hasText: 'Could not apply' }).waitFor();
            check(
              (await page.getByLabel('Drone name', { exact: true }).inputValue()) ===
                'Unsaved selection draft',
              'Rejected stale save discarded its draft',
            );
            evidence.checks.browsingKeepsCurrentDraft = true;
            evidence.checks.realCrossTabStaleEdit = true;
            await other.close();
            await page.reload();
            await page.waitForFunction(() => window.qualificationReady);
            await click('Aircraft, rates & throttle');
            check(
              await page.evaluate((id) => {
                const config = window.qualificationStore.effective();
                return (
                  config.profileId === id &&
                  config.camera.tilt === 35.25 &&
                  config.camera.verticalFov === 100.5
                );
              }, profileId),
              'Reload lost profile assignment or camera',
            );
            evidence.checks.reloadPersistence = true;
            const restoredReceipt = await page.evaluate(
              (id) =>
                window.qualificationStore.snapshot().profiles.find((profile) => profile.id === id)
                  .provenance,
              imported.id,
            );
            check(
              isDeepStrictEqual(restoredReceipt, imported.provenance),
              'Reload lost or changed the exact import receipt',
            );
            evidence.checks.importReceipt.reloadPersistence = true;
            await page.evaluate(() => {
              window.qualificationLocale = 'uk';
              window.qualificationUI.refresh();
            });
            await page
              .getByRole('dialog', { name: 'Майстерня налаштувань', exact: true })
              .waitFor();
            await section('Рейти й газ');
            await page.getByLabel('Алгоритм рейтів', { exact: true }).waitFor();
            const size = await page.locator('dialog').evaluate((node) => ({
              clientWidth: node.clientWidth,
              scrollWidth: node.scrollWidth,
              left: node.getBoundingClientRect().left,
              right: node.getBoundingClientRect().right,
              viewport: window.innerWidth,
            }));
            check(
              size.scrollWidth <= size.clientWidth + 1 &&
                size.left >= 0 &&
                size.right <= size.viewport,
              `Dialog overflows viewport: ${JSON.stringify(size)}`,
            );
            evidence.checks.localizedResponsiveLayout = true;
            await page.keyboard.press('Escape');
            check(
              await page.locator('#open').evaluate((node) => node === document.activeElement),
              'Close did not restore opener focus',
            );
            evidence.checks.focusReturn = true;
            check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
            results.push({ ...evidence, status: 'passed', errors });
          } catch (error) {
            results.push({ ...evidence, status: 'failed', reason: error.stack, errors });
          } finally {
            await context.close();
          }
        }
      } catch (error) {
        results.push({ engine, status: 'unavailable', reason: error.message });
      } finally {
        await browser?.close();
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(presetFolder, { recursive: true, force: true });
  }
  const sourceRecords = [],
    changedSources = [...changedDuringRun];
  for (const [name, bytes] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    const hash = (value) => createHash('sha256').update(value).digest('hex');
    const sha256 = hash(bytes);
    sourceRecords.push({ path: name, sha256 });
    if (hash(await readFile(path.join(root, name))) !== sha256 && !changedDuringRun.has(name))
      changedSources.push(name);
  }
  const report = {
    format: 'FpvTuningBrowserQualification.v1',
    createdAt: new Date().toISOString(),
    fixture:
      'Production tuning component and store in an isolated loopback-only component harness. Host flight is represented by captured callbacks; touch is browser emulation, not physical-device qualification.',
    sources: sourceRecords,
    sourceStable: changedSources.length === 0,
    changedSources,
    results,
    pass:
      results.length === 6 &&
      results.every((result) => result.status === 'passed') &&
      changedSources.length === 0,
  };
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {},
    args = process.argv.slice(2);
  while (args.length) {
    const flag = args.shift(),
      value = args.shift();
    if (!value) throw new Error(`${flag} requires a value`);
    if (flag === '--playwright') options.playwrightModule = value;
    else if (flag === '--write') options.output = value;
    else throw new Error(`Unknown option ${flag}`);
  }
  const report = await smokeFpvTuning(options);
  console.log(
    JSON.stringify(
      { pass: report.pass, sourceStable: report.sourceStable, results: report.results },
      null,
      2,
    ),
  );
  if (!report.pass) process.exitCode = 1;
}
