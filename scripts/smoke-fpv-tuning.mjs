/* global window, document, navigator */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
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
window.qualificationEvents = { tests: [], applies: [], saved: [] };
window.qualificationStore = createTuningLibraryStore({ storage: localStorage, locks: navigator.locks });
window.qualificationUI = mountFlightTuning({ document, window, store: window.qualificationStore,
  locale: () => window.qualificationLocale,
  onTest: value => window.qualificationEvents.tests.push(value),
  onApply: value => window.qualificationEvents.applies.push(value),
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
  try {
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
            if (touch) await button('Rates & throttle').tap();
            else {
              await button('Rates & throttle').focus();
              await page.keyboard.press('Enter');
            }
            await page.getByRole('dialog', { name: 'Rates & throttle', exact: true }).waitFor();
            check(
              await page.locator('h2').evaluate((node) => node === document.activeElement),
              'Heading did not receive keyboard focus',
            );
            await button('New Actual profile').click();
            await page.waitForFunction(
              () => window.qualificationStore.snapshot().profiles.length === 2,
            );
            await page.getByLabel('Profile name', { exact: true }).fill('Race practice');
            await page.getByLabel('Link roll and pitch edits', { exact: true }).check();
            const roll = page.getByRole('group', { name: 'Roll', exact: true });
            const pitch = page.getByRole('group', { name: 'Pitch', exact: true });
            await roll
              .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
              .fill('895');
            check(
              (await roll
                .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
                .inputValue()) === '895',
              'An unfinished number was snapped before committing',
            );
            await page.keyboard.press('Tab');
            check(
              (await roll
                .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
                .inputValue()) === '900' &&
                (await roll
                  .getByRole('slider', { name: 'Maximum rate (°/s)', exact: true })
                  .inputValue()) === '900',
              'Blur did not align the displayed number and slider with representable rates',
            );
            check(
              (await pitch
                .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
                .inputValue()) === '900',
              'Linked pitch did not update',
            );
            await pitch
              .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
              .fill('670');
            check(
              (await roll
                .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
                .inputValue()) === '670',
              'Returning the peer to its original rate left the linked draft stale',
            );
            await roll
              .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
              .fill('900');
            await page.getByLabel('Rate algorithm', { exact: true }).selectOption('quick');
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
            await page.getByLabel('Rate algorithm', { exact: true }).selectOption('actual');
            check(
              (await roll
                .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
                .inputValue()) === '900',
              'Algorithm draft was reinterpreted',
            );
            await page.getByLabel('Camera tilt (degrees)', { exact: true }).fill('35');
            await page.getByLabel('Vertical FOV (degrees)', { exact: true }).fill('100');
            await page.getByLabel('Drone name', { exact: true }).fill('Pending camera setup');
            const draftProfileId = await page
              .getByLabel('Rate profile', { exact: true })
              .inputValue();
            await page.getByLabel('Rate profile', { exact: true }).selectOption('legacy-feel');
            await page.getByLabel('Rate profile', { exact: true }).selectOption(draftProfileId);
            check(
              (await page.getByLabel('Camera tilt (degrees)', { exact: true }).inputValue()) ===
                '35' &&
                (await page.getByLabel('Vertical FOV (degrees)', { exact: true }).inputValue()) ===
                  '100' &&
                (await page.getByLabel('Drone name', { exact: true }).inputValue()) ===
                  'Pending camera setup',
              'Selecting a rate profile discarded the independent drone draft',
            );
            const beforeDraft = await page.evaluate(() => window.qualificationStore.export());
            await button('Test draft · unscored').click();
            await page.waitForFunction(() => window.qualificationEvents.tests.length === 1);
            check(
              await page.evaluate(
                () => window.qualificationEvents.tests[0].response.rates.axes.roll.rate === 90,
              ),
              'Test callback did not freeze edited Actual rates',
            );
            check(
              (await page.evaluate(() => window.qualificationStore.export())) === beforeDraft,
              'Testing wrote the saved library',
            );
            await page.getByRole('button', { name: /^Return to tuning/ }).click();
            check(
              (await roll
                .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
                .inputValue()) === '900',
              'Returning lost draft',
            );
            await button('Save for next flight').click();
            await page
              .getByRole('status')
              .filter({ hasText: 'Saved for the next flight' })
              .waitFor();
            const profileId = await page.getByLabel('Rate profile', { exact: true }).inputValue();
            await page
              .getByLabel('Rates used by this drone', { exact: true })
              .selectOption(profileId);
            await button('Save drone assignment & camera').click();
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
            await page
              .getByText('Import / export · Betaflight and backups', { exact: true })
              .click();
            await button('Export SIM rates').click();
            const transfer = page.getByLabel('Paste CLI or a SIM rate profile', { exact: true });
            const native = await transfer.inputValue();
            check(JSON.parse(native).profile.axes.roll.rate === 90, 'Native export lost rates');
            const downloadPromise = page.waitForEvent('download');
            await button('Download file').click();
            const download = await downloadPromise;
            const contents = await readFile(await download.path(), 'utf8');
            check(
              JSON.stringify(JSON.parse(contents)) === JSON.stringify(JSON.parse(native)) &&
                download.suggestedFilename().endsWith('.json'),
              'Browser export differs from preview',
            );
            const firmware = page.getByLabel('Source / export firmware version', { exact: true });
            await firmware.selectOption('4.5.2');
            await button('Export rate-only CLI').click();
            await page
              .getByRole('status')
              .filter({ hasText: 'different throttle curve' })
              .waitFor();
            const includeThrottle = page.getByLabel('Include throttle settings in CLI export', {
              exact: true,
            });
            await includeThrottle.uncheck();
            await button('Export rate-only CLI').click();
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
            await transfer.fill('# Betaflight 4.5.2\nset roll_srate = 81');
            await button('Preview import').click();
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await button('Save import as new profile').click();
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
            await button('Delete & reassign').click();
            await page.waitForFunction(
              () => window.qualificationStore.snapshot().profiles.length === 2,
            );
            await page.getByLabel('Patch baseline', { exact: true }).selectOption('draft');
            const beforeImport = await page.evaluate(() => window.qualificationStore.export());
            await page
              .getByLabel('Source / export firmware version', { exact: true })
              .selectOption('2025.12.5');
            await transfer.fill('set roll_rc_rate = not-a-number');
            await button('Preview import').click();
            await page.getByRole('status').filter({ hasText: 'Could not apply' }).waitFor();
            check(
              (await page.evaluate(() => window.qualificationStore.export())) === beforeImport,
              'Malformed import changed storage',
            );
            const importSource = 'set roll_rc_rate = 12\nset yaw_expo = 30\nset p_roll = 80';
            await transfer.fill(importSource);
            await button('Preview import').click();
            // SHA-256 source receipts finish asynchronously; never click Save
            // merely because the pointer action itself has completed.
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await roll
              .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
              .fill('990');
            await button('Save import as new profile').click();
            await page.getByRole('status').filter({ hasText: 'changed' }).waitFor();
            check(
              await page.evaluate(() => window.qualificationStore.snapshot().profiles.length === 2),
              'Stale import preview saved an obsolete curve',
            );
            check(
              (await roll
                .getByRole('spinbutton', { name: 'Maximum rate (°/s)', exact: true })
                .inputValue()) === '990',
              'Rejecting stale preview discarded the visible edit',
            );
            await button('Preview import').click();
            await page.getByRole('status').filter({ hasText: 'Preview only' }).waitFor();
            await button('Save import as new profile').click();
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
            await button('Backup complete library').click();
            const receiptBackup = JSON.parse(await transfer.inputValue());
            check(
              receiptBackup.profiles.find((profile) => profile.id === imported.id).provenance.source
                .sha256 === sourceHash,
              'Complete library backup dropped the receipt',
            );
            await button('Restore library backup').click();
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

            const other = await context.newPage();
            await other.goto(url);
            await other.waitForFunction(() => window.qualificationReady);
            await other.getByRole('button', { name: 'Rates & throttle', exact: true }).click();
            await other.getByRole('button', { name: 'New Actual profile', exact: true }).click();
            await page.getByRole('status').filter({ hasText: 'Another tab changed' }).waitFor();
            await button('Save for next flight').click();
            await page.getByRole('status').filter({ hasText: 'Could not apply' }).waitFor();
            evidence.checks.realCrossTabStaleEdit = true;
            await other.close();
            await page.reload();
            await page.waitForFunction(() => window.qualificationReady);
            await button('Rates & throttle').click();
            check(
              await page.evaluate((id) => {
                const config = window.qualificationStore.effective();
                return (
                  config.profileId === id &&
                  config.camera.tilt === 35 &&
                  config.camera.verticalFov === 100
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
            await page.getByRole('dialog', { name: 'Рейти й газ', exact: true }).waitFor();
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
