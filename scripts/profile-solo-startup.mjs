/* global document, window, performance, MutationObserver, location, navigator */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadavg } from 'node:os';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';
import { createQualificationCpuProfile } from './solo-qualification-cpu-profile.mjs';
import {
  analyzeStartupTrace,
  retainStartupTrace,
  startupDeadline,
  summarizeStartupResources,
} from './solo-startup-evidence.mjs';

const [address, output, ...flags] = process.argv.slice(2);
const revision = flags.find((flag) => flag.startsWith('--source-revision='))?.slice(18);
assert(
  address && output && process.env.PLAYWRIGHT_MODULE && /^[0-9a-f]{40}$/.test(revision ?? ''),
  'Usage: PLAYWRIGHT_MODULE=<path> CHROME_EXECUTABLE=<path> node scripts/profile-solo-startup.mjs <Solo URL> <new-report.json> --source-revision=<40-hex> [--server-fixture-access] [--warm]',
);
assert(
  flags.every((flag) =>
    ['--server-fixture-access', '--warm', `--source-revision=${revision}`].includes(flag),
  ),
  'Unknown startup profile option',
);
const url = new URL(address),
  target = resolve(output),
  warm = flags.includes('--warm');
assert(['http:', 'https:'].includes(url.protocol), 'HTTP(S) production entry required');
const fixture = flags.includes('--server-fixture-access');
if (fixture)
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Local access fixture only');
await mkdir(dirname(target), { recursive: true });
for (const file of [target, target + '.cpuprofile', target + '.trace.json']) {
  try {
    await access(file);
    throw new Error(`Refusing to overwrite ${file}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const report = {
  format: 'SoloStartupProfileV1',
  sourceRevision: revision,
  address: url.href,
  status: 'running',
  performanceGateStatus: 'excluded-startup-profiling',
  startedAt: new Date().toISOString(),
  warm,
  serverFixtureAccess: fixture,
  environment: { node: process.version, initialLoad: loadavg() },
  documents: [],
  pageErrors: [],
  failedResponses: [],
  policyErrors: [],
  limitations: [
    'Separate Chromium diagnostic with CPU sampling and timeline tracing; no timing pass or physical-device conclusion.',
    'Fresh browser context; optional reload reuses that context. No request routing, cache disabling, service-worker override, CPU throttling or security-policy changes.',
    'ResourceTiming sizes are browser observations, not a transfer/evaluation speed comparison. Module graph/source byte counts are different measures.',
    'CPU profile and trace spans overlap. Main-thread profiling does not fully represent workers, native decoders, GPU work or network waiting.',
    'The 180-second watchdog requests stop; CDP/browser scheduling may extend the recording. Any partial, capped or missing trace remains incomplete.',
  ],
};
await writeFile(target, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
const save = () => writeFile(target, JSON.stringify(report, null, 2) + '\n');
let browser,
  context,
  page,
  cdp,
  cpuRecorder,
  traceStarted = false;
async function identity() {
  const identityURL = new URL('./build-info.json', url);
  const response = await fetch(identityURL, { signal: AbortSignal.timeout(10000) });
  assert(response.ok, `Build identity HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert(bytes.length <= 65536, 'Build identity too large');
  const parsed = JSON.parse(bytes);
  assert.equal(parsed.sourceRevision, revision, 'Artifact source revision mismatch');
  return {
    url: identityURL.href,
    ...parsed,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
async function snapshot(label) {
  const value = await page.evaluate((name) => {
    performance.mark(`solo-startup:${name}`);
    return window.soloStartupEvidence.read(name);
  }, label);
  value.resourceSummary = summarizeStartupResources(value);
  report.documents.push(value);
  return value;
}
try {
  report.buildIdentity = await identity();
  const { chromium } = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_EXECUTABLE,
  });
  report.environment.browser = browser.version();
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  page = await context.newPage();
  page.on('pageerror', (error) => {
    if (report.pageErrors.length < 64) report.pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && report.failedResponses.length < 128)
      report.failedResponses.push({ url: response.url(), status: response.status() });
  });
  page.on('console', (message) => {
    if (
      /content security policy|content-security-policy/i.test(message.text()) &&
      report.policyErrors.length < 64
    )
      report.policyErrors.push(message.text());
  });
  await page.addInitScript(() => {
    if (window !== window.top) return;
    const maximumEntries = 8192;
    performance.setResourceTimingBufferSize(maximumEntries);
    let resourceBufferFull = 0;
    performance.addEventListener('resourcetimingbufferfull', () => {
      resourceBufferFull++;
    });
    performance.mark('solo-startup:document');
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        performance.mark('solo-startup:dom-content-loaded');
        let previous = null;
        const update = () => {
          const phase = document.body?.dataset.flightState ?? 'boot';
          if (phase !== previous) {
            previous = phase;
            performance.mark(`solo-startup:phase-${phase}`);
          }
        };
        update();
        if (document.body)
          new MutationObserver(update).observe(document.body, {
            attributes: true,
            attributeFilter: ['data-flight-state'],
          });
      },
      { once: true },
    );
    window.soloStartupEvidence = {
      read(label) {
        const resources = performance.getEntriesByType('resource');
        return {
          label,
          url: location.href,
          timeOrigin: performance.timeOrigin,
          atMs: performance.now(),
          state: document.body?.dataset.flightState,
          boot: document.documentElement.dataset.bootState,
          serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
          navigation: performance.getEntriesByType('navigation').map((entry) => entry.toJSON()),
          resourceBufferFull,
          resourcesTruncated: resources.length > maximumEntries,
          resources: resources.slice(0, maximumEntries).map((entry) => entry.toJSON()),
        };
      },
    };
  });
  cdp = await context.newCDPSession(page);
  await startupDeadline(
    cdp.send('Tracing.start', {
      categories: 'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline',
      transferMode: 'ReturnAsStream',
    }),
    'Trace start',
  );
  traceStarted = true;
  cpuRecorder = createQualificationCpuProfile(cdp, {
    file: target + '.cpuprofile',
    maximumMs: 180000,
    onLimit: async () => {
      report.deadlineReached = true;
      await context.close().catch(() => {});
    },
  });
  report.cpuProfile = cpuRecorder.report;
  await cpuRecorder.start();
  async function navigate(reload = false) {
    const response = await (reload
      ? page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 })
      : page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 120000 }));
    assert.equal(
      response.headers()['content-security-policy'],
      PUBLIC_SECURITY_HEADERS['Content-Security-Policy'],
      'Exact production CSP required',
    );
    const headers = {
      csp: response.headers()['content-security-policy'],
      cacheControl: response.headers()['cache-control'] ?? null,
    };
    if (fixture && (await page.locator('input[name=password]').isVisible())) {
      await page.locator('input[name=password]').fill('fixture-password');
      await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    }
    await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
      timeout: 120000,
    });
    const ready = await snapshot(reload ? 'reload-ready' : 'cold-ready');
    ready.headers = headers;
  }
  await navigate();
  if (warm) await navigate(true);
  await page.locator('#shell-featured').waitFor({ state: 'visible', timeout: 30000 });
  await page.evaluate(() => performance.mark('solo-startup:public-start-request'));
  await page.locator('#shell-featured').click({ timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.flightState === 'running', null, {
    timeout: 60000,
  });
  // No frame hooks or busy polling: retain the first five seconds of ordinary
  // startup work, then use the public pause control before evidence readback.
  await page.waitForTimeout(5000);
  await page.locator('#pause-button').click({ timeout: 10000 });
  await page.waitForFunction(() => document.body.dataset.flightState === 'paused', null, {
    timeout: 10000,
  });
  await snapshot('paused-after-start');
  assert.equal(report.pageErrors.length, 0, 'Uncaught page errors observed');
  report.status = 'observed';
} catch (error) {
  report.status = 'failed';
  report.failure = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  if (page && !page.isClosed() && report.status === 'failed') {
    try {
      if ((await page.locator('body').getAttribute('data-flight-state')) === 'running')
        await page.keyboard.press('Escape');
      await startupDeadline(snapshot('failed-attempt'), 'Partial startup snapshot');
    } catch (error) {
      report.partialReadFailure = String(error.message);
    }
  }
  if (cpuRecorder) {
    await cpuRecorder.stop(
      report.status === 'failed' ? 'scenario-failure' : 'startup-observation-ended',
    );
    if (report.cpuProfile.status !== 'retained' || report.cpuProfile.limitReached) {
      if (report.status !== 'failed') report.status = 'incomplete';
      process.exitCode = 1;
    }
  }
  if (traceStarted) {
    try {
      const complete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
      await startupDeadline(cdp.send('Tracing.end'), 'Trace end');
      const { stream } = await startupDeadline(complete, 'Trace completion');
      assert(stream, 'Trace stream unavailable');
      report.trace = await retainStartupTrace(cdp, stream, target + '.trace.json');
      if (report.trace.status !== 'complete') {
        if (report.status !== 'failed') report.status = 'incomplete';
        process.exitCode = 1;
      }
    } catch (error) {
      report.traceFailure = String(error.stack ?? error);
      if (report.status !== 'failed') report.status = 'incomplete';
      process.exitCode = 1;
    }
  }
  await context?.close().catch(() => {});
  await browser?.close().catch(() => {});
  report.browserClosed = !browser || !browser.isConnected();
  if (report.trace?.status === 'complete') {
    try {
      report.evaluation = analyzeStartupTrace(
        JSON.parse(await readFile(report.trace.file, 'utf8')),
      );
    } catch (error) {
      report.evaluation = { status: 'unobserved', failure: String(error.stack ?? error) };
    }
  }
  try {
    const after = await identity();
    assert.deepEqual(after, report.buildIdentity, 'Artifact changed during observation');
    report.identityAfter = after;
  } catch (error) {
    report.identityFailure = String(error.stack ?? error);
    report.status = 'failed';
    process.exitCode = 1;
  }
  if (
    report.evaluation?.status !== 'observed' ||
    report.documents.some((row) => row.resourceSummary.status !== 'observed')
  ) {
    if (report.status === 'observed') report.status = 'incomplete';
    process.exitCode = 1;
  }
  report.completedAt = new Date().toISOString();
  report.environment.finalLoad = loadavg();
  await save();
}
