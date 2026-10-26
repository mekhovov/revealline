/* global document, window, MutationObserver, PerformanceObserver, requestAnimationFrame */
import { pbkdf2Sync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { arch, release, loadavg } from 'node:os';
import { createObservationStop } from './solo-observation-lifecycle.mjs';

// Timing observations use public UI, not simulation state mutation. Keep traces,
// screenshots and allocation profilers in separate runs. Playwright is supplied
// by the caller; it is not a production dependency.
const [address, output, ...flags] = process.argv.slice(2);
if (!address || !output || !process.env.PLAYWRIGHT_MODULE)
  throw new Error(
    'Usage: PLAYWRIGHT_MODULE=<path> [CHROME_EXECUTABLE=<path>] node scripts/observe-solo-performance.mjs <Solo URL> <report.json> [--browser=webkit] [--runs=3] [--duration=30000] [--cpu=1] [--fixture-access|--server-fixture-access] [--warm] [--inputs|--input-probe] [--diagnostics=0] [--work-probe] [--quality-probe] [--source-revision=<commit>]',
  );
const option = (key, fallback) =>
  flags.find((flag) => flag.startsWith(`--${key}=`))?.split('=')[1] ?? fallback;
const engine = option('browser', 'chromium');
const duration = Number(option('duration', '30000'));
const runs = Number(option('runs', '3'));
const cpu = Number(option('cpu', '1'));
if (
  !['chromium', 'webkit'].includes(engine) ||
  !Number.isFinite(duration) ||
  duration < 1000 ||
  !Number.isInteger(runs) ||
  runs < 1 ||
  runs > 20 ||
  !Number.isFinite(cpu) ||
  cpu < 1 ||
  cpu > 20
)
  throw new Error('Invalid observation options.');
const fixtureAccess = flags.includes('--fixture-access');
const serverFixtureAccess = flags.includes('--server-fixture-access');
const qualityProbe = flags.includes('--quality-probe');
if (qualityProbe && !flags.includes('--work-probe'))
  throw new Error('The quality witness requires the independent work probe.');
if (fixtureAccess && serverFixtureAccess) throw new Error('Choose one access fixture owner.');
const url = new URL(address);
if (
  flags.includes('--input-probe') &&
  (flags.includes('--inputs') || url.searchParams.get('journey') !== 'opening')
)
  throw new Error('The input probe requires the opening route and excludes capture inputs.');
if ((fixtureAccess || serverFixtureAccess) && !['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('The explicit access fixture is restricted to local test servers.');
url.searchParams.set('performance', option('diagnostics', '1'));
const playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const results = [];
const stop = createObservationStop();
const sigterm = () => stop.request('SIGTERM');
const sigint = () => stop.request('SIGINT');
process.on('SIGTERM', sigterm);
process.on('SIGINT', sigint);
await mkdir(dirname(resolve(output)), { recursive: true });
let browser;
try {
  browser = await playwright[engine].launch({
    ...(engine === 'chromium' ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
    headless: true,
    // This observer owns graceful signal handling so existing samples can be
    // exported before close. Playwright otherwise closes the browser on either
    // signal: https://playwright.dev/docs/api/class-browsertype#browser-type-launch
    handleSIGINT: false,
    handleSIGTERM: false,
  });
  for (let pass = 0; pass < runs; pass++) {
    stop.throwIfRequested();
    const observedAt = new Date().toISOString(),
      initialHostLoad = loadavg();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    const errors = [],
      failedResponses = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400)
        failedResponses.push({ status: response.status(), url: response.url() });
    });
    if (fixtureAccess)
      await page.route(url.href, async (route) => {
        const response = await route.fetch();
        const body = (await response.text())
          .replace(
            /(name="revealline-access-salt"\s+content=")[^"]+/,
            '$1' + Buffer.from('performance-fixture').toString('base64url'),
          )
          .replace(
            /(name="revealline-access-verifier"\s+content=")[^"]+/,
            '$1' +
              pbkdf2Sync('fixture-password', 'performance-fixture', 150000, 32, 'sha256').toString(
                'base64url',
              ),
          );
        await route.fulfill({ response, body });
      });
    await page.addInitScript(
      ({ workProbe, qualityProbe }) => {
        const names = ['boot', 'briefing', 'running', 'paused', 'result', 'picture', 'other'];
        const bounds = [8.34, 10, 16.8, 20, 25, 33.34, 40, 50, 100, 250, Infinity];
        // Phase x (count, total, maximum, thresholds, histogram). Recent samples
        // and task records are rings; lifetime counters retain every interval.
        const width = 7 + bounds.length;
        const totals = new Float64Array(names.length * width);
        const workBounds = [0.25, 0.5, 1, 2, 4, 6, 8.34, 10, 16.67, 25, 50, 100, Infinity];
        const workWidth = 3 + workBounds.length;
        const workTotals = new Float64Array(names.length * workWidth);
        const workSamples = new Float64Array(5000 * 2);
        const qualitySamples = [];
        let droppedQualitySamples = 0;
        let observedGame,
          workStarted,
          workCount = 0,
          workSubscribed = false;
        const samples = new Float64Array(1800 * 3),
          tasks = new Float64Array(256 * 3);
        let phase = 0,
          previousPhase = 0,
          last = performance.now(),
          count = 0,
          taskCount = 0;
        if (workProbe) {
          // Use identical independent numeric instrumentation in diagnostics-on
          // and diagnostics-off comparisons. The public Phaser frame events
          // bracket application update through canvas submission; no run state
          // or simulation timing is changed. Keep this probe out of ordinary runs.
          let phaser;
          Object.defineProperty(window, 'Phaser', {
            configurable: true,
            get: () => phaser,
            set(value) {
              phaser = value;
              const Game = value.Game;
              value.Game = class extends Game {
                constructor(...args) {
                  super(...args);
                  observedGame = this;
                }
              };
            },
          });
        }
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            new MutationObserver(() => {
              const index = names.indexOf(document.body.dataset.flightState);
              phase = index < 0 ? names.length - 1 : index;
            }).observe(document.body, { attributes: true, attributeFilter: ['data-flight-state'] });
          },
          { once: true },
        );
        function frame(now) {
          const dt = now - last,
            offset = previousPhase * width,
            recent = (count++ % 1800) * 3;
          totals[offset]++;
          totals[offset + 1] += dt;
          totals[offset + 2] = Math.max(totals[offset + 2], dt);
          if (dt > 33.34) totals[offset + 3]++;
          if (dt > 50) totals[offset + 4]++;
          if (dt > 100) totals[offset + 5]++;
          if (dt > 250) totals[offset + 6]++;
          let bucket = 0;
          while (dt > bounds[bucket]) bucket++;
          totals[offset + 7 + bucket]++;
          samples[recent] = now;
          samples[recent + 1] = dt;
          samples[recent + 2] = previousPhase;
          last = now;
          previousPhase = phase;
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const offset = (taskCount++ % 256) * 3;
              tasks[offset] = entry.startTime;
              tasks[offset + 1] = entry.duration;
              tasks[offset + 2] = phase;
            }
          }).observe({ type: 'longtask', buffered: true });
        window.soloTimingProbe = {
          sampleQuality(label) {
            if (!qualityProbe) return;
            if (qualitySamples.length >= 1024) {
              droppedQualitySamples++;
              return;
            }
            // Read the already submitted presentation record; do not call
            // drawOptions, lease.pin or any runtime/simulation method.
            const scene = observedGame?.scene?.scenes?.find((scene) => scene.lastPaint);
            qualitySamples.push({
              label,
              at: performance.now(),
              flight: document.body.dataset.flightState,
              quality: scene?.lastPaint?.quality ?? null,
            });
          },
          startWorkProbe() {
            if (!workProbe || workSubscribed) return;
            if (!observedGame) throw new Error('Phaser game was not observed.');
            workSubscribed = true;
            // Subscribe after ready scene creation so POST_RENDER also includes
            // the application's diagnostic collection at the end of the frame.
            observedGame.events.on(window.Phaser.Core.Events.PRE_STEP, () => {
              workStarted = performance.now();
            });
            observedGame.events.on(window.Phaser.Core.Events.POST_RENDER, () => {
              if (workStarted === undefined) return;
              const elapsed = performance.now() - workStarted;
              workStarted = undefined;
              const offset = phase * workWidth;
              workTotals[offset]++;
              workTotals[offset + 1] += elapsed;
              workTotals[offset + 2] = Math.max(workTotals[offset + 2], elapsed);
              let bucket = 0;
              while (elapsed > workBounds[bucket]) bucket++;
              workTotals[offset + 3 + bucket]++;
              const sample = (workCount++ % 5000) * 2;
              workSamples[sample] = elapsed;
              workSamples[sample + 1] = phase;
            });
          },
          export: () => ({
            names,
            bounds,
            width,
            totals: Array.from(totals),
            frameCount: count,
            recent: Array.from(samples.subarray(0, Math.min(count, 1800) * 3)),
            taskCount,
            tasks: Array.from(tasks.subarray(0, Math.min(taskCount, 256) * 3)),
            qualityProbe: qualityProbe
              ? { samples: qualitySamples, dropped: droppedQualitySamples }
              : null,
            workProbe: workProbe
              ? {
                  bounds: workBounds,
                  width: workWidth,
                  totals: Array.from(workTotals),
                  count: workCount,
                  recent: Array.from(workSamples.subarray(0, Math.min(workCount, 5000) * 2)),
                }
              : null,
          }),
        };
      },
      { workProbe: flags.includes('--work-probe'), qualityProbe },
    );
    let failure = null,
      launchAt = null,
      firstActiveAt = null,
      beforePause = null,
      interruptionCleanupFailure = null,
      evidence = null;
    try {
      if (engine === 'chromium' && cpu !== 1) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      }
      const open = async () => {
        await page.goto(url.href);
        if (
          (fixtureAccess || serverFixtureAccess) &&
          (await page.locator('input[name=password]').isVisible())
        ) {
          await page.locator('input[name=password]').fill('fixture-password');
          await page.getByRole('button', { name: 'Unlock', exact: true }).click();
        }
        await page.waitForFunction(
          () => document.documentElement.dataset.bootState === 'ready',
          null,
          { timeout: 120000 },
        );
      };
      await open();
      stop.throwIfRequested();
      if (flags.includes('--warm')) await open();
      await stop.wait(1500);
      stop.throwIfRequested();
      if (flags.includes('--work-probe'))
        await page.evaluate(() => window.soloTimingProbe.startWorkProbe());
      if (qualityProbe)
        await page.evaluate(() => window.soloTimingProbe.sampleQuality('before-start'));
      launchAt = await page.evaluate(() => performance.now());
      await page.locator('#shell-featured').click();
      await page.waitForFunction(() => document.body.dataset.flightState === 'running', null, {
        timeout: 60000,
      });
      firstActiveAt = await page.evaluate(() => performance.now());
      if (qualityProbe)
        await page.evaluate(() => window.soloTimingProbe.sampleQuality('active-start'));
      console.log(JSON.stringify({ pass, phase: 'running', firstActiveAt }));
      if (flags.includes('--inputs') && !stop.requested) {
        // First-return's legal opening: public directional edges create a long
        // cut and capture. Wall time intentionally does not spoof simulation ticks.
        await page.keyboard.press('ArrowRight');
        if (await stop.wait(1358)) await page.keyboard.press('ArrowDown');
      }
      if (flags.includes('--input-probe') || qualityProbe) {
        // First-return starts on its revealed top edge. Repeated horizontal
        // direction edges exercise input-to-submission without making a cut.
        const until = performance.now() + duration - (flags.includes('--inputs') ? 1358 : 0);
        let edge = 0;
        while (!stop.requested && performance.now() < until) {
          if (flags.includes('--input-probe'))
            await page.keyboard.press(edge++ % 2 ? 'ArrowRight' : 'ArrowLeft');
          if (qualityProbe)
            await page.evaluate(() => window.soloTimingProbe.sampleQuality('active'));
          await stop.wait(Math.min(250, Math.max(0, until - performance.now())));
        }
      } else {
        await stop.wait(Math.max(0, duration - (flags.includes('--inputs') ? 1358 : 0)));
      }
      beforePause = await page.evaluate(() => ({
        flight: document.body.dataset.flightState,
        time: document.getElementById('time').textContent,
        warning: document.getElementById('run-message').textContent,
      }));
      if (qualityProbe)
        await page.evaluate(() => window.soloTimingProbe.sampleQuality('before-pause'));
      if (beforePause.flight !== 'running' && !flags.includes('--inputs'))
        failure = `Active observation interrupted: ${beforePause.flight}`;
      if (beforePause.flight === 'running')
        await page.locator('#pause-button').click({ timeout: 1000 });
      await stop.wait(100);
    } catch (error) {
      failure = error.message;
    }
    if (stop.requested) {
      failure ??= stop.message;
      process.exitCode = 1;
      try {
        // A signal may arrive between an action and its normal Pause boundary.
        // Recheck the public phase once, then export only after a best-effort
        // Pause; a hung browser remains bounded by the parent's hard kill.
        const current = await page.evaluate(() => ({
          flight: document.body.dataset.flightState,
          time: document.getElementById('time')?.textContent,
          warning: document.getElementById('run-message')?.textContent,
        }));
        beforePause ??= current;
        if (current.flight === 'running')
          await page.locator('#pause-button').click({ timeout: 1000 });
      } catch (error) {
        interruptionCleanupFailure = error.message;
      }
    }
    try {
      evidence = await page.evaluate(() => ({
        external: window.soloTimingProbe?.export(),
        application: window.RevealLineSoloPerformance?.export(),
      }));
    } catch (error) {
      failure ??= error.message;
      evidence = await page
        .evaluate(() => ({ external: window.soloTimingProbe?.export() }))
        .catch(() => null);
    }
    results.push({
      observedAt,
      host: {
        arch: arch(),
        osRelease: release(),
        initialLoad: initialHostLoad,
        finalLoad: loadavg(),
        note: option('note', 'unspecified'),
      },
      pass,
      status: stop.requested ? 'interrupted' : failure ? 'failed' : 'observed',
      interruption: stop.interruption,
      interruptionCleanupFailure,
      address: url.href,
      sourceRevision: option('source-revision', null),
      browser: `${engine} ${browser.version()}`,
      viewport: { width: 1280, height: 800 },
      diagnostics: option('diagnostics', '1') === '1',
      independentWorkProbe: flags.includes('--work-probe'),
      qualityProbe,
      cpuRate: cpu,
      cpuCalibration: 'requested desktop stress factor; not a physical-device equivalent',
      profile: flags.includes('--warm') ? 'fresh profile, second navigation' : 'fresh profile',
      httpCache: fixtureAccess
        ? 'disabled by Playwright route fixture; repeat navigation is not an HTTP-cache qualification'
        : 'controlled by browser and server headers',
      audio: 'default preferences',
      fixtureAccess,
      serverFixtureAccess,
      requestedActiveMs: duration,
      inputs: flags.includes('--inputs')
        ? 'right, 1358ms, down'
        : flags.includes('--input-probe')
          ? 'alternating left/right on revealed opening border, at least 250ms apart'
          : 'stationary',
      launchAt,
      firstActiveAt,
      beforePause,
      failure,
      errors,
      failedResponses,
      ...evidence,
    });
    await writeFile(output, JSON.stringify(results, null, 2));
    console.log(JSON.stringify({ pass, firstActiveAt, beforePause, failure, errors }));
    await context.close();
  }
} catch (error) {
  // Launch/context failures occur outside the per-page observation block. Keep
  // every requested pass explicit instead of silently losing the remaining runs.
  const failure = String(error?.message ?? error);
  if (results.length) results.at(-1).batchFailure = failure;
  while (results.length < runs)
    results.push({
      pass: results.length,
      status: 'not-observed',
      interruption: stop.interruption,
      observedAt: null,
      address: url.href,
      sourceRevision: option('source-revision', null),
      browser: `${engine} ${browser?.version() ?? 'not launched'}`,
      diagnostics: option('diagnostics', '1') === '1',
      independentWorkProbe: flags.includes('--work-probe'),
      qualityProbe,
      cpuRate: cpu,
      fixtureAccess,
      serverFixtureAccess,
      requestedActiveMs: duration,
      failure,
      application: null,
      external: null,
    });
  await writeFile(output, JSON.stringify(results, null, 2));
  console.error(failure);
  process.exitCode = 1;
} finally {
  await browser?.close();
  process.off('SIGTERM', sigterm);
  process.off('SIGINT', sigint);
}
