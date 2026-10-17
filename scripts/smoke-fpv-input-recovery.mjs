/* global window, document */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixture = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>Local Advanced input recovery qualification</title><body><main></main>
<script type="module">
import { mountAdvancedPractice } from '/optional-practice/civilian-fpv/advanced-practice.mjs';
window.qualificationControls = null;
window.qualificationPractice = mountAdvancedPractice({
  container: document.querySelector('main'), window,
  locale: new URL(location.href).searchParams.get('locale'),
  getControls: () => window.qualificationControls,
  workerURL: new URL('/optional-practice/fpv-worlds/advanced-worker.mjs', location.href),
});
</script></body></html>`;
const labels = {
  en: {
    start: 'Start practice',
    pause: 'Pause',
    restart: 'Restart practice',
    record: 'Export practice recording',
    input: 'Input source',
    comparison: 'Unscored comparison',
    import: 'Import comparison recording',
    unavailable:
      'Input unavailable. Practice is paused. Reconnect the radio or choose Keyboard / touch, then start explicitly. Your recording is retained.',
  },
  uk: {
    start: 'Почати практику',
    pause: 'Пауза',
    restart: 'Почати заново',
    record: 'Експортувати запис практики',
    input: 'Джерело керування',
    comparison: 'Порівняння без заліку',
    import: 'Імпортувати запис для порівняння',
    unavailable:
      'Керування недоступне. Практику призупинено. Підключіть пульт знову або виберіть «Клавіатура / дотик», потім почніть вручну. Запис збережено.',
  },
};

async function runLocale(browser, url, locale, evidence) {
  const copy = labels[locale],
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on('pageerror', (error) => evidence.errors.push(error.message));
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      window.qualificationWorkers = [];
      window.qualificationVerified = [];
      window.Worker = class extends NativeWorker {
        constructor(...args) {
          super(...args);
          this.requests = new Map();
          this.record = {
            id: window.qualificationWorkers.length,
            url: String(args[0]),
            terminated: false,
            pendingSteps: 0,
            sequences: [],
          };
          window.qualificationWorkers.push(this.record);
          this.addEventListener('message', ({ data }) => {
            const type = this.requests.get(data.id);
            if (type === 'step') this.record.pendingSteps--;
            if (type === 'verify-recording' && data.result)
              window.qualificationVerified.push({
                verified: data.result.verified,
                missionTicks: data.result.missionTicks,
                samples: data.result.path.length,
              });
            this.requests.delete(data.id);
          });
        }
        postMessage(message, ...args) {
          this.requests.set(message.id, message.type);
          if (message.type === 'step') {
            this.record.pendingSteps++;
            this.record.sequences.push(message.sample.sequence);
          }
          return super.postMessage(message, ...args);
        }
        terminate() {
          this.record.terminated = true;
          return super.terminate();
        }
      };
    });
    await page.goto(`${url}?locale=${locale}`);
    const button = (key) => page.getByRole('button', { name: copy[key], exact: true });
    const status = page.locator('.fpv-advanced-practice > [role="status"]');
    const input = page.getByRole('combobox', { name: new RegExp(`^${copy.input}`) });
    const state = () =>
      page.evaluate(() => ({
        telemetry: window.qualificationPractice.getTelemetry(),
        workers: structuredClone(window.qualificationWorkers),
      }));
    const settled = () =>
      page.waitForFunction(() =>
        window.qualificationWorkers.every((worker) => worker.pendingSteps === 0),
      );
    const pausedAvailable = async () => {
      await settled();
      assert.equal(await button('start').isEnabled(), true, 'Explicit resume unavailable');
      assert.equal(await button('pause').isDisabled(), true, 'Input loss did not pause');
      assert.equal(await button('restart').isEnabled(), true, 'Healthy worker cannot restart');
      assert.equal(await button('record').isEnabled(), true, 'Accepted recording cannot export');
      assert.equal(
        await page.evaluate(
          () => window.qualificationWorkers.filter((worker) => !worker.terminated).length,
        ),
        1,
        'Input loss replaced or disabled the healthy worker',
      );
    };
    const unchangedForObservation = async (before) => {
      // Negative recovery assertion only; this delay is not a performance measurement.
      await page.waitForTimeout(300);
      assert.deepEqual(await state(), before, 'Paused input recovery advanced or replaced state');
    };
    const exportAndVerify = async (scenario) => {
      const downloadEvent = page.waitForEvent('download');
      await button('record').click();
      const download = await downloadEvent,
        bytes = await readFile(await download.path()),
        recording = JSON.parse(bytes),
        expectedTick = (await state()).telemetry.missionTick,
        previousChecks = await page.evaluate(() => window.qualificationVerified.length);
      assert.equal(recording.missionTicks, expectedTick);
      assert.equal(recording.scored, false);
      const summary = page.locator('summary').filter({ hasText: copy.comparison });
      if (!(await summary.evaluate((node) => node.parentElement.open))) await summary.click();
      await page.getByLabel(copy.import, { exact: true }).setInputFiles({
        name: `${scenario}.json`,
        mimeType: 'application/json',
        buffer: bytes,
      });
      await page.waitForFunction(
        (count) => window.qualificationVerified.length === count + 1,
        previousChecks,
      );
      await page.waitForFunction(
        () => window.qualificationWorkers.filter((worker) => !worker.terminated).length === 1,
      );
      const replay = await page.evaluate(() => window.qualificationVerified.at(-1));
      assert.equal(replay.verified, true);
      assert.equal(replay.missionTicks, recording.missionTicks);
      assert.equal(replay.samples, recording.missionTicks + 1);
      evidence.recordings.push({
        scenario,
        bytes: bytes.length,
        sha256: sha(bytes),
        missionTicks: recording.missionTicks,
        finalHash: recording.finalHash,
        replay,
      });
    };
    await page.waitForFunction(
      () => window.qualificationPractice?.getTelemetry()?.missionTick === 0,
    );
    assert.equal(await button('start').isEnabled(), true);
    await button('start').click();
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
      () =>
        window.qualificationPractice.getTelemetry().missionTick >= 5 &&
        window.qualificationPractice.getTelemetry().requestedRates.roll > 0,
    );
    await page.keyboard.up('ArrowRight');
    await button('pause').click();
    await settled();
    const beforeUnavailableStart = await state();
    await input.selectOption('radio');
    await button('start').click();
    await status.filter({ hasText: copy.unavailable }).waitFor();
    await pausedAvailable();
    assert.deepEqual(await state(), beforeUnavailableStart);
    await unchangedForObservation(beforeUnavailableStart);
    evidence.checks.unavailableStartRetainsFlight = {
      missionTick: beforeUnavailableStart.telemetry.missionTick,
      message: await status.textContent(),
    };
    await exportAndVerify('unavailable-start');

    await input.selectOption('keyboard');
    await button('start').click();
    await page.waitForFunction(
      (tick) => window.qualificationPractice.getTelemetry().missionTick >= tick + 5,
      beforeUnavailableStart.telemetry.missionTick,
    );
    await button('pause').click();
    await settled();
    evidence.checks.keyboardResumesSameFlight = (await state()).telemetry.missionTick;
    assert.equal((await state()).workers[0].terminated, false);

    await page.evaluate(() => {
      window.qualificationControls = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
    });
    await input.selectOption('radio');
    const beforeRadio = (await state()).telemetry.missionTick;
    await button('start').click();
    await page.waitForFunction(
      (tick) => window.qualificationPractice.getTelemetry().missionTick >= tick + 5,
      beforeRadio,
    );
    await page.evaluate(() => {
      window.qualificationControls = null;
    });
    await status.filter({ hasText: copy.unavailable }).waitFor();
    await pausedAvailable();
    const stopped = await state();
    await unchangedForObservation(stopped);
    evidence.checks.midFlightInputLossRetainsFlight = {
      missionTick: stopped.telemetry.missionTick,
      message: await status.textContent(),
    };
    await exportAndVerify('input-lost');

    await page.evaluate(() => {
      window.qualificationControls = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
    });
    const returned = await state();
    await unchangedForObservation(returned);
    evidence.checks.returnedInputRequiresExplicitStart = true;
    await button('start').click();
    await page.waitForFunction(
      (tick) => window.qualificationPractice.getTelemetry().missionTick >= tick + 5,
      stopped.telemetry.missionTick,
    );
    await button('pause').click();
    await settled();
    await exportAndVerify('resumed-flight');
    const resumed = await state(),
      sequences = resumed.workers[0].sequences;
    assert.equal(resumed.workers[0].terminated, false);
    assert.deepEqual(
      sequences,
      Array.from({ length: sequences.length }, (_, index) => index),
    );
    evidence.checks.acceptedInputSequenceContinuous = true;

    await input.selectOption('keyboard');
    await button('restart').click();
    await page.waitForFunction(
      () =>
        window.qualificationPractice.getTelemetry().missionTick === 0 &&
        window.qualificationWorkers[0].terminated,
    );
    evidence.checks.explicitRestartCreatesNewFlight = true;
    await page.evaluate(() => window.qualificationPractice.dispose());
    evidence.workers = await page.evaluate(() => window.qualificationWorkers);
    assert.equal(
      evidence.workers.every((worker) => worker.terminated),
      true,
    );
    assert.equal(await page.locator('canvas').count(), 0);
    assert.deepEqual(evidence.errors, []);
    evidence.pass = true;
  } finally {
    await context.close();
  }
}

/** Isolated component fixture with the production renderer and module workers.
 * Only the availability of the supplied getControls callback is simulated. */
export async function smokeFpvInputRecovery({ playwrightModule, output } = {}) {
  const startedAt = new Date().toISOString(),
    playwright = await import(pathToFileURL(path.resolve(playwrightModule)).href),
    sources = new Map(),
    changed = new Set(),
    cases = [];
  sources.set(
    'scripts/smoke-fpv-input-recovery.mjs',
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
    version = null,
    failure = null;
  try {
    browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
    version = browser.version();
    for (const locale of ['en', 'uk']) {
      const evidence = { locale, pass: false, checks: {}, recordings: [], errors: [] };
      cases.push(evidence);
      await runLocale(
        browser,
        `http://127.0.0.1:${server.address().port}/qualification.html`,
        locale,
        evidence,
      );
    }
  } catch (error) {
    failure = error.stack;
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
  const sourceRecords = [];
  for (const [name, bytes] of [...sources].sort(([a], [b]) => a.localeCompare(b))) {
    sourceRecords.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
    if (sha(await readFile(path.join(root, name))) !== sha(bytes)) changed.add(name);
  }
  const report = {
    format: 'FpvInputRecoveryBrowserQualification.v1',
    startedAt,
    completedAt: new Date().toISOString(),
    engine: 'chromium',
    channel: 'chrome',
    version,
    fixture:
      'Isolated loopback Advanced reference-practice component, real WebGL renderer and dedicated production module workers. getControls availability is simulated. Worker instrumentation observes requests and responses without altering them. Production authentication and application HTML are untouched.',
    limits: [
      'One desktop Chrome runtime, English and Ukrainian; no physical radio, touch device, calibration, native wrapper or platform-matrix qualification.',
      'Short unscored flights verify input-loss retention, explicit recovery, recording replay and disposal; not aircraft fidelity, Regional streaming, maximum-duration storage or throughput.',
      'Exported bytes are replayed through the production comparison import UI. Their byte hashes and replay summaries are retained; temporary browser downloads are not durable artifacts.',
    ],
    cases,
    failure,
    sources: sourceRecords,
    sourceStable: changed.size === 0,
    changedSources: [...changed],
    pass: !failure && cases.length === 2 && cases.every((item) => item.pass) && changed.size === 0,
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
  const report = await smokeFpvInputRecovery(options);
  console.log(
    JSON.stringify(
      {
        pass: report.pass,
        sourceStable: report.sourceStable,
        cases: report.cases,
        failure: report.failure,
      },
      null,
      2,
    ),
  );
  if (!report.pass) process.exitCode = 1;
}
