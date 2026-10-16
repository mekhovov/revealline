/* global document, window */
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectMP3 } from '../game/mp3-inspection.mjs';

// This is a correctness smoke check, not a timing qualification. It opens the
// real entry and starts Solo through its public UI. Worker construction, imports,
// validation and CSP are unchanged; only explicit localhost access fixtures may
// substitute the gate's verifier, using the ordinary unlock form.
const [address, output, ...flags] = process.argv.slice(2);
if (!address || !output || !process.env.PLAYWRIGHT_MODULE)
  throw new Error(
    'Usage: PLAYWRIGHT_MODULE=<path> [CHROME_EXECUTABLE=<path>] node scripts/verify-solo-mp3-worker.mjs <Solo URL> <report.json> [--browser=webkit] [--fixture-access]',
  );
const engine = flags.find((flag) => flag.startsWith('--browser='))?.slice(10) ?? 'chromium';
if (
  !['chromium', 'webkit'].includes(engine) ||
  flags.some((flag) => flag !== '--fixture-access' && flag !== `--browser=${engine}`)
)
  throw new Error('Invalid MP3 smoke options.');
const fixtureAccess = flags.includes('--fixture-access');
const url = new URL(address);
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP(S) Solo URL.');
if (fixtureAccess && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('The explicit access fixture is restricted to local test servers.');
// Same complete MPEG fixture used by game/test/helpers/soundtrack-fixtures.mjs.
const fixture = await readFile(
  new URL('../game/test/fixtures/audio/silence-mpeg1-layer3.mp3', import.meta.url),
);
const expected = await inspectMP3(new Blob([fixture]));
const playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const report = {
  kind: 'real static MP3 worker correctness smoke; not a performance measurement',
  address: url.href,
  engine,
  fixtureAccess,
  status: 'failed',
  workerURLs: [],
  pageErrors: [],
  policyErrors: [],
};
let browser;
try {
  browser = await playwright[engine].launch({
    ...(engine === 'chromium' ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
    headless: true,
  });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on('worker', (worker) => report.workerURLs.push(worker.url()));
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  page.on('console', (message) => {
    if (/content security policy|content-security-policy|refused to.*worker/i.test(message.text()))
      report.policyErrors.push(message.text());
  });
  if (fixtureAccess)
    await page.route(url.href, async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      const substitutions = [
        ['salt', Buffer.from('performance-fixture').toString('base64url')],
        [
          'verifier',
          pbkdf2Sync('fixture-password', 'performance-fixture', 150000, 32, 'sha256').toString(
            'base64url',
          ),
        ],
      ];
      for (const [name, value] of substitutions) {
        const pattern = new RegExp(`(name="revealline-access-${name}"\\s+content=")[^"]+`, 'g');
        assert.equal([...body.matchAll(pattern)].length, 1, `Expected one access ${name}.`);
        body = body.replace(pattern, `$1${value}`);
      }
      await route.fulfill({ response, body });
    });
  const response = await page.goto(url.href);
  report.cspHeader = (await response.allHeaders())['content-security-policy'] ?? null;
  if (fixtureAccess && (await page.locator('input[name=password]').isVisible())) {
    await page.locator('input[name=password]').fill('fixture-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  }
  await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
    timeout: 120000,
  });
  report.cspMeta = await page
    .locator('meta[http-equiv="Content-Security-Policy" i]')
    .evaluateAll((elements) => elements.map((element) => element.content));
  report.expectedWorkerURL = await page.evaluate(
    () => new URL('./mp3-inspection-worker.mjs', document.baseURI).href,
  );
  assert.ok(report.cspHeader || report.cspMeta.length, 'The entry must serve its real CSP.');
  await page.locator('#shell-featured').click();
  await page.waitForFunction(() => document.body.dataset.flightState === 'running', null, {
    timeout: 60000,
  });
  report.active = await page.evaluate(async (bytes) => {
    const [{ createMediaPreparation }, { createMP3Inspector }] = await Promise.all([
      import(new URL('./ui/media-preparation.mjs', document.baseURI).href),
      import(new URL('./ui/mp3-inspector.mjs', document.baseURI).href),
    ]);
    const preparation = createMediaPreparation();
    preparation.setPhase('playing');
    // A bounded transport watchdog keeps unavailable implementations reviewable.
    // This timeout does not make any claim about gameplay/frame performance.
    const inspector = createMP3Inspector({ preparation, timeoutMs: 10000 });
    const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/mpeg' });
    const cases = [];
    const flightBefore = document.body.dataset.flightState;
    const completed = (async () => {
      for (const [name, source] of [
        ['valid', blob],
        ['malformed', new Blob(['junk', blob])],
        ['truncated', blob.slice(0, -1)],
      ]) {
        try {
          cases.push({ name, status: 'fulfilled', value: await inspector.inspect(source) });
        } catch (error) {
          cases.push({
            name,
            status: 'rejected',
            error: { name: error.name, message: error.message },
          });
        }
      }
    })();
    const snapshot = () => ({
      cases,
      admission: preparation.snapshot(),
      inspector: inspector.snapshot(),
      flightBefore,
      flightAfter: document.body.dataset.flightState,
    });
    window.soloMP3Smoke = { preparation, inspector, completed, snapshot };
    let timer;
    const settled = await Promise.race([
      completed.then(() => true),
      new Promise((resolve) => (timer = setTimeout(() => resolve(false), 12000))),
    ]);
    clearTimeout(timer);
    return { settled, ...snapshot() };
  }, Array.from(fixture));
  report.mode = report.active.settled ? 'worker' : 'unavailable-or-timed-out';
  if (!report.active.settled) {
    // The real unavailable-worker path must park its main-thread scan during
    // play and complete only after the public pause action and phase handoff.
    await page.locator('#pause-button').click();
    await page.waitForFunction(() => document.body.dataset.flightState === 'paused');
    report.pausedFallback = await page.evaluate(async () => {
      const { preparation, completed, snapshot } = window.soloMP3Smoke;
      preparation.setPhase('paused');
      let timer;
      try {
        await Promise.race([
          completed,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Paused fallback did not finish.')), 10000);
          }),
        ]);
        return snapshot();
      } finally {
        clearTimeout(timer);
      }
    });
    report.mode = 'paused-fallback';
  }
  const checks = report.pausedFallback ?? report.active;
  const [valid, malformed, truncated] = checks.cases;
  assert.equal(valid?.status, 'fulfilled', 'Valid MP3 must pass complete structural inspection.');
  assert.deepEqual(valid.value, expected, 'Worker and canonical inspection metadata must match.');
  assert.equal(malformed?.status, 'rejected');
  assert.match(malformed.error.message, /malformed|Unsupported/);
  assert.equal(truncated?.status, 'rejected');
  assert.match(truncated.error.message, /Truncated/);
  assert.equal(checks.inspector.pendingRequests, 0);
  assert.equal(checks.inspector.workerOwnedBytes, 0);
  assert.equal(checks.admission.queued, 0);
  report.validationPassed = true;
  if (report.pausedFallback) {
    assert.equal(report.active.cases.length, 0, 'Fallback must not finish during play.');
    assert.equal(report.active.admission.active.main, 0);
    assert.equal(report.active.admission.queued, 1);
    report.fallbackDeferredUntilPaused = true;
  }
  assert.equal(report.active.flightBefore, 'running');
  assert.equal(report.active.flightAfter, 'running', 'Game must remain active during inspection.');
  assert.equal(
    report.mode,
    'worker',
    'Real worker unavailable; safe fallback recorded separately.',
  );
  assert.ok(
    report.workerURLs.includes(report.expectedWorkerURL),
    'Expected the unchanged static worker URL.',
  );
  assert.equal(report.active.admission.phase, 'playing');
  assert.equal(report.active.admission.active.main, 0);
  report.status = 'passed';
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify({ status: report.status, mode: report.mode, report: resolve(output) }),
  );
}
