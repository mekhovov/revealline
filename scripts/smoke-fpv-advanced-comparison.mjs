/* global window, document */
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fixture = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Local Advanced comparison qualification</title>
<body style="margin:0;background:#07121b"><main></main><script type="module">
import { mountAdvancedPractice } from '/optional-practice/civilian-fpv/advanced-practice.mjs';
import { createRateProfile } from '/optional-practice/civilian-fpv/rates.mjs';
window.qualificationControls = {roll:0,pitch:0,yaw:0,throttle:0};
window.qualificationSaves = [];
window.qualificationHoldSave = false;
window.qualificationMount = (rate = 67) => {
  window.qualificationPractice?.dispose();
  window.qualificationPractice = mountAdvancedPractice({container: document.querySelector('main'), window,
    profile: createRateProfile({axes:{roll:{rate}}}),
    workerURL: new URL('/optional-practice/fpv-worlds/advanced-worker.mjs', location.href),
    getControls: () => window.qualificationControls,
    onSaveConfiguration: (configuration) => {
      window.qualificationSaves.push(structuredClone(configuration));
      if (window.qualificationHoldSave)
        return new Promise((resolve) => { window.qualificationFinishSave = resolve; });
    } });
};
window.qualificationMount();
</script></body></html>`;

/** Real renderer, UI and dedicated production workers. This component harness
 * has no production access gate and does not alter authenticated application HTML. */
export async function smokeAdvancedComparison({ playwrightModule, output } = {}) {
  const playwright = await import(pathToFileURL(path.resolve(playwrightModule)).href);
  const sources = new Map(),
    changed = new Set(),
    errors = [],
    checks = {};
  sources.set(
    'scripts/smoke-fpv-advanced-comparison.mjs',
    await readFile(fileURLToPath(import.meta.url)),
  );
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).slice(1);
      if (name === 'qualification.html') {
        response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
        response.end(fixture);
        return;
      }
      const filename = path.resolve(root, name),
        extension = path.extname(name);
      if (
        !filename.startsWith(`${root}${path.sep}`) ||
        name.split('/').some((part) => part.startsWith('.')) ||
        !['.mjs', '.js', '.wasm', '.css'].includes(extension)
      ) {
        response.writeHead(404);
        response.end();
        return;
      }
      const bytes = await readFile(filename);
      if (sources.has(name) && !sources.get(name).equals(bytes)) changed.add(name);
      if (!sources.has(name)) sources.set(name, bytes);
      response.writeHead(200, {
        'Content-Type':
          extension === '.wasm'
            ? 'application/wasm'
            : extension === '.css'
              ? 'text/css'
              : 'text/javascript',
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
  let browser,
    failure = null,
    version = null;
  try {
    browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
    version = browser.version();
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    page.setDefaultTimeout(20000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      window.qualificationWorkers = { created: 0, terminated: 0, live: 0 };
      window.qualificationInitializations = [];
      window.qualificationVerified = [];
      window.qualificationHoldVerification = false;
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          this.requests = new Map();
          this.closed = false;
          window.qualificationWorkers.created++;
          window.qualificationWorkers.live++;
          this.addEventListener('message', ({ data }) => {
            if (this.requests.get(data.id) === 'verify-recording' && data.result)
              window.qualificationVerified.push(data.result);
            this.requests.delete(data.id);
          });
        }
        postMessage(message, ...args) {
          this.requests.set(message.id, message.type);
          if (message.type === 'init')
            window.qualificationInitializations.push(structuredClone(message.options));
          // Explicit fault injection holds transport, not simulation results.
          // All accepted and tampered comparisons use real worker verification.
          if (message.type === 'verify-recording' && window.qualificationHoldVerification) {
            window.qualificationHeldVerification = true;
            return;
          }
          return super.postMessage(message, ...args);
        }
        terminate() {
          if (!this.closed) {
            this.closed = true;
            window.qualificationWorkers.terminated++;
            window.qualificationWorkers.live--;
          }
          return super.terminate();
        }
      };
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/qualification.html`);
    const button = (name) => page.getByRole('button', { name, exact: true });
    const ready = () =>
      page.waitForFunction(
        () =>
          window.qualificationPractice?.getTelemetry()?.missionTick === 0 &&
          ![...document.querySelectorAll('button')].find(
            (node) => node.textContent === 'Start practice',
          )?.disabled,
      );
    await ready();
    await page.getByRole('combobox', { name: /^Input source/ }).selectOption('radio');
    await page.getByRole('combobox', { name: /^Repeatable practice/ }).selectOption('turn');
    await button('Start practice').click();
    await page.evaluate(() => {
      window.qualificationControls.throttle = 0.5;
      window.qualificationControls.yaw = 0.15;
    });
    await page.waitForFunction(
      () => window.qualificationPractice.getTelemetry()?.missionTick >= 80,
    );
    await button('Pause').click();
    const downloadPromise = page.waitForEvent('download');
    await button('Export practice recording').click();
    const download = await downloadPromise,
      bytes = await readFile(await download.path()),
      recording = JSON.parse(bytes);
    check(
      recording.missionTicks >= 80 && recording.scored === false,
      'Export did not capture real unscored practice',
    );
    checks.recording = {
      missionTicks: recording.missionTicks,
      bytes: bytes.length,
      sha256: hash(bytes),
      finalHash: recording.finalHash,
    };
    await page.getByText('Unscored comparison', { exact: true }).click();
    await button('Keep this practice as reference').click();
    await page.getByRole('status').filter({ hasText: 'Verified reference ready' }).waitFor();
    const comparison = await page.evaluate(() => window.qualificationPractice.getComparison());
    check(
      comparison?.verified &&
        comparison.scored === false &&
        comparison.samples === recording.missionTicks + 1,
      'Kept reference did not completely verify',
    );
    check(
      (await page.evaluate(() => window.qualificationWorkers)).live === 1,
      'Verification worker leaked after success',
    );
    checks.keepReference = comparison;
    await page.evaluate(() => {
      window.qualificationControls = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
    });
    await button('Restart practice').click();
    await ready();
    await button('Start practice').click();
    await page.waitForFunction(
      () => window.qualificationPractice.getTelemetry()?.missionTick >= 35,
    );
    await button('Pause').click();
    await page.waitForFunction(() => {
      const current = window.qualificationPractice.getTelemetry(),
        ghost = window.qualificationPractice.getComparison();
      const point =
        window.qualificationVerified.at(-1)?.path[
          Math.min(current?.missionTick ?? 0, ghost?.missionTicks ?? 0)
        ];
      return (
        ghost?.visible &&
        point &&
        ghost.position.x === point[1] &&
        ghost.position.y === point[2] &&
        ghost.position.z === point[3]
      );
    });
    checks.sameMissionTick = await page.evaluate(() => ({
      missionTick: window.qualificationPractice.getTelemetry().missionTick,
      ghost: window.qualificationPractice.getComparison(),
      verifiedPathSamples: window.qualificationVerified.at(-1).path.length,
    }));
    await page.getByLabel('Show verified ghost', { exact: true }).uncheck();
    check(
      !(await page.evaluate(() => window.qualificationPractice.getComparison())).visible,
      'Ghost visibility preference was ignored',
    );
    await page.getByLabel('Show verified ghost', { exact: true }).check();
    const altered = structuredClone(recording);
    altered.finalHash = altered.finalHash === '00000000' ? '11111111' : '00000000';
    await page.getByLabel('Import comparison recording', { exact: true }).setInputFiles({
      name: 'tampered.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(altered)),
    });
    await page.getByRole('status').filter({ hasText: 'Comparison unavailable:' }).waitFor();
    check(
      (await page.evaluate(() => window.qualificationPractice.getComparison())).missionTicks ===
        comparison.missionTicks,
      'Rejected import replaced the previous reference',
    );
    checks.tamperedRecordingRejected = true;
    await button('Clear reference').click();
    check(
      (await page.evaluate(() => window.qualificationPractice.getComparison())) === null,
      'Clear did not remove reference',
    );
    await page
      .getByLabel('Import comparison recording', { exact: true })
      .setInputFiles({ name: 'practice.json', mimeType: 'application/json', buffer: bytes });
    await page.getByRole('status').filter({ hasText: 'Verified reference ready' }).waitFor();
    checks.exportImportVerified = true;
    await page.getByText('Aircraft and controller tuning', { exact: true }).click();
    await page.getByLabel('Mass (kg)', { exact: true }).fill('0.8');
    await button('Restart practice').click();
    await ready();
    await page
      .getByText('This aircraft setup uses a different comparison class.', { exact: false })
      .waitFor();
    check(
      !(await page.evaluate(() => window.qualificationPractice.getComparison())).visible,
      'Incompatible aircraft kept visible ghost',
    );
    await button('Revert aircraft draft').click();
    await button('Restart practice').click();
    await ready();
    check(
      (await page.evaluate(() => window.qualificationPractice.getComparison())).visible,
      'Restoring compatible aircraft did not restore ghost',
    );
    checks.aircraftClassFiltering = true;
    await page.evaluate(() => {
      window.qualificationHoldVerification = true;
      window.qualificationHeldVerification = false;
    });
    await page
      .getByLabel('Import comparison recording', { exact: true })
      .setInputFiles({ name: 'held.json', mimeType: 'application/json', buffer: bytes });
    await page.waitForFunction(() => window.qualificationHeldVerification);
    check(
      (await page.evaluate(() => window.qualificationWorkers)).live === 2,
      'Held verifier did not create dedicated worker',
    );
    await button('Cancel verification').click();
    await page.getByRole('status').filter({ hasText: 'Verification cancelled' }).waitFor();
    check(
      (await page.evaluate(() => window.qualificationWorkers)).live === 1,
      'Cancel did not terminate verifier',
    );
    check(
      (await page.evaluate(() => window.qualificationPractice.getComparison())).verified,
      'Cancel discarded the previous verified reference',
    );
    checks.cancelDisposesVerifier = true;
    await page.evaluate(() => {
      window.qualificationHoldVerification = false;
      window.qualificationMount(95);
    });
    await ready();
    await page.getByText('Unscored comparison', { exact: true }).click();
    await page.getByLabel('Import comparison recording', { exact: true }).setInputFiles({
      name: 'different-personal-rates.json',
      mimeType: 'application/json',
      buffer: bytes,
    });
    await page.getByRole('status').filter({ hasText: 'Verified reference ready' }).waitFor();
    check(
      (await page.evaluate(() => window.qualificationPractice.getComparison())).comparisonClass ===
        comparison.comparisonClass,
      'Personal rotation rates split comparison class',
    );
    checks.personalRatesRemainComparable = true;
    await page.getByText('Aircraft and controller tuning', { exact: true }).click();
    const mass = page.getByLabel('Mass (kg)', { exact: true }),
      saveAircraft = button('Save aircraft for next flight'),
      initializationCount = await page.evaluate(() => window.qualificationInitializations.length);
    await mass.fill('0.8');
    await page.evaluate(() => {
      window.qualificationHoldSave = true;
    });
    await saveAircraft.click();
    check(await saveAircraft.isDisabled(), 'Pending aircraft save allowed duplicate activation');
    await mass.fill('0.9');
    await saveAircraft.evaluate((node) => node.click());
    check(
      (await page.evaluate(() => window.qualificationSaves.length)) === 1,
      'Pending aircraft save accepted a duplicate request',
    );
    await page.evaluate(() => window.qualificationFinishSave());
    await page.waitForFunction(
      () =>
        ![...document.querySelectorAll('button')].find(
          (node) => node.textContent === 'Save aircraft for next flight',
        ).disabled,
    );
    await page.getByRole('status').filter({ hasText: 'Draft changed. Restart practice' }).waitFor();
    check((await mass.inputValue()) === '0.9', 'Completing a save discarded later aircraft edits');
    checks.delayedAircraftSave = await page.evaluate(() => ({
      savedMass: window.qualificationSaves[0].aircraft.mass,
      activeMass: window.qualificationInitializations.at(-1).aircraft.mass,
      initializationCount: window.qualificationInitializations.length,
      saveRequests: window.qualificationSaves.length,
      draftMass: Number(
        [...document.querySelectorAll('label')]
          .find((node) => node.textContent.startsWith('Mass (kg)'))
          .querySelector('input').value,
      ),
    }));
    check(
      checks.delayedAircraftSave.savedMass === 0.8 &&
        checks.delayedAircraftSave.activeMass === 0.65 &&
        checks.delayedAircraftSave.initializationCount === initializationCount,
      'Saving changed the active worker or lost the captured aircraft values',
    );
    await button('Revert aircraft draft').click();
    check((await mass.inputValue()) === '0.8', 'Revert did not use the newly saved baseline');
    await button('Restart practice').click();
    await ready();
    checks.delayedAircraftSave.restartedMass = await page.evaluate(
      () => window.qualificationInitializations.at(-1).aircraft.mass,
    );
    check(
      checks.delayedAircraftSave.restartedMass === 0.8,
      'Explicit restart did not apply the reverted saved aircraft',
    );
    await page.evaluate(() => window.qualificationPractice.dispose());
    checks.workers = await page.evaluate(() => window.qualificationWorkers);
    check(
      checks.workers.live === 0 && checks.workers.created === checks.workers.terminated,
      'Disposed practice left workers running',
    );
    check((await page.locator('canvas').count()) === 0, 'Disposed practice left renderer canvas');
    check(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  } catch (error) {
    failure = error.stack;
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
  const sourceRecords = [];
  for (const [name, bytes] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    const sha256 = hash(bytes);
    sourceRecords.push({ path: name, sha256 });
    if (hash(await readFile(path.join(root, name))) !== sha256) changed.add(name);
  }
  const report = {
    format: 'FpvAdvancedComparisonBrowserQualification.v1',
    createdAt: new Date().toISOString(),
    engine: 'chromium',
    version,
    fixture:
      'Production arena component, actual renderer and dedicated workers in isolated loopback harness; production access gates untouched. Cancellation deliberately holds only one verification request before transport. The aircraft save race holds its callback promise; it does not qualify real browser-lock contention or storage. Touch/physical radio and native hardware are not qualified here.',
    checks,
    errors,
    failure,
    sources: sourceRecords,
    sourceStable: changed.size === 0,
    changedSources: [...changed],
    pass: !failure && errors.length === 0 && changed.size === 0,
  };
  if (output) await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {},
    args = process.argv.slice(2);
  while (args.length) {
    const key = args.shift(),
      value = args.shift();
    if (!value) throw new Error(`${key} needs a value`);
    if (key === '--playwright') options.playwrightModule = value;
    else if (key === '--write') options.output = value;
    else throw new Error(`Unknown option ${key}`);
  }
  const report = await smokeAdvancedComparison(options);
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        sourceStable: report.sourceStable,
        checks: report.checks,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  if (!report.pass) process.exitCode = 1;
}
