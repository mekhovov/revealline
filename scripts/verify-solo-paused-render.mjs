/* global document, window, requestAnimationFrame, navigator, crypto, Event */
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PUBLIC_SECURITY_HEADERS } from './game-cli.mjs';

// Native Canvas correctness only. The caller launches this separately from all
// timing captures: pixel readbacks and draw interception perturb rendering.
const [address, output, ...flags] = process.argv.slice(2);
const engine = flags.find((flag) => flag.startsWith('--browser='))?.slice(10) ?? 'chromium';
if (
  !address ||
  !output ||
  !process.env.PLAYWRIGHT_MODULE ||
  !['chromium', 'webkit'].includes(engine) ||
  flags.some((flag) => flag !== '--fixture-access' && flag !== `--browser=${engine}`)
)
  throw new Error(
    'Usage: PLAYWRIGHT_MODULE=<path> [CHROME_EXECUTABLE=<path>] node scripts/verify-solo-paused-render.mjs <Solo URL> <report.json> [--browser=webkit] [--fixture-access]',
  );
const url = new URL(address),
  fixtureAccess = flags.includes('--fixture-access');
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP(S) Solo URL.');
if (fixtureAccess && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('The explicit access fixture is restricted to localhost.');
const playwright = await import(pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href);
const report = {
  kind: 'Native paused Canvas pixel retention and draw suppression; not performance qualification',
  address: url.href,
  engine,
  fixtureAccess,
  status: 'failed',
  pageErrors: [],
};
let browser;
try {
  browser = await playwright[engine].launch({
    headless: true,
    ...(engine === 'chromium'
      ? { executablePath: process.env.CHROME_EXECUTABLE, args: ['--disable-accelerated-2d-canvas'] }
      : {}),
  });
  report.browser = browser.version();
  report.rasterScope =
    engine === 'chromium' ? 'native software Canvas2D' : 'native WebKit Canvas2D';
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => report.pageErrors.push(error.message));
  if (fixtureAccess)
    await page.route(url.href, async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      for (const [name, value] of [
        ['salt', Buffer.from('performance-fixture').toString('base64url')],
        [
          'verifier',
          pbkdf2Sync('fixture-password', 'performance-fixture', 150000, 32, 'sha256').toString(
            'base64url',
          ),
        ],
      ]) {
        const pattern = new RegExp(`(name="revealline-access-${name}"\\s+content=")[^"]+`, 'g');
        assert.equal([...body.matchAll(pattern)].length, 1, `Expected one access ${name}.`);
        body = body.replace(pattern, `$1${value}`);
      }
      await route.fulfill({ response, body });
    });
  const response = await page.goto(url.href);
  report.csp = (await response.allHeaders())['content-security-policy'];
  assert.equal(report.csp, PUBLIC_SECURITY_HEADERS['Content-Security-Policy']);
  if (fixtureAccess && (await page.locator('input[name=password]').isVisible())) {
    await page.locator('input[name=password]').fill('fixture-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  }
  await page.waitForFunction(() => document.documentElement.dataset.bootState === 'ready', null, {
    timeout: 120000,
  });
  await page.locator('#shell-featured').click();
  await page.waitForFunction(() => document.body.dataset.flightState === 'running', null, {
    timeout: 60000,
  });
  await page.locator('#pause-button').click();
  report.observation = await page.evaluate(async () => {
    const canvas = document.querySelector('#game-canvas canvas'),
      context = canvas.getContext('2d');
    const frames = (count) =>
      new Promise((resolve) => {
        const next = () => (--count <= 0 ? resolve() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      });
    const originals = new Map();
    let draws = 0,
      clears = 0,
      polls = 0;
    for (const name of ['drawImage', 'clearRect']) {
      originals.set(name, Object.getOwnPropertyDescriptor(context, name));
      const original = context[name];
      context[name] = function (...args) {
        if (name === 'drawImage') draws++;
        else clears++;
        return original.apply(this, args);
      };
    }
    const padDescriptor = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    const getGamepads = navigator.getGamepads;
    if (typeof getGamepads === 'function')
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value() {
          polls++;
          return getGamepads.call(this);
        },
      });
    const pixels = async () => {
      const bytes = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('');
      const colors = new Set();
      for (let index = 0; index < bytes.length && colors.size < 16; index += 4)
        colors.add(`${bytes[index]},${bytes[index + 1]},${bytes[index + 2]},${bytes[index + 3]}`);
      return { hash, colors: colors.size, width: canvas.width, height: canvas.height };
    };
    const cases = [];
    const retained = async (name, settling = false) => {
      await frames(8);
      const before = await pixels();
      draws = clears = polls = 0;
      await frames(18);
      const after = await pixels();
      cases.push({ name, settling, before, after, draws, clears, polls });
    };
    try {
      // Preserve the original early observation. Late asynchronous artwork/HUD
      // readiness or layout invalidation may correctly repaint this startup
      // window; it is not evidence of a steady unchanged display yet.
      await retained('paused-initial-settling', true);
      draws = clears = polls = 0;
      const settlingStartedAt = performance.now();
      let settlingFrames = 0;
      while (settlingFrames < 60 || performance.now() - settlingStartedAt < 1000) {
        await frames(1);
        settlingFrames++;
      }
      cases.push({
        name: 'startup-settling',
        settling: true,
        frames: settlingFrames,
        elapsedMs: performance.now() - settlingStartedAt,
        draws,
        clears,
        polls,
      });
      await retained('paused');
      document.querySelector('#settings-button').click();
      await retained('covered-by-settings');
      document.querySelector('[data-close="settings-dialog"]').click();
      await frames(8);
      draws = clears = 0;
      window.dispatchEvent(new Event('resize'));
      await frames(4);
      cases.push({ name: 'resize-invalidation', draws, clears, pixels: await pixels() });
      draws = clears = 0;
      document.querySelector('#start-button').click();
      const deadline = performance.now() + 60000;
      while (document.body.dataset.flightState !== 'running') {
        if (performance.now() > deadline) throw new Error('Resume did not become ready.');
        await frames(1);
      }
      await frames(4);
      cases.push({ name: 'resumed', draws, clears, state: document.body.dataset.flightState });
      document.querySelector('#pause-button').click();
      return { cases, gamepadPollingAvailable: typeof getGamepads === 'function' };
    } finally {
      for (const [name, descriptor] of originals)
        if (descriptor) Object.defineProperty(context, name, descriptor);
        else delete context[name];
      if (typeof getGamepads === 'function') {
        if (padDescriptor) Object.defineProperty(navigator, 'getGamepads', padDescriptor);
        else delete navigator.getGamepads;
      }
    }
  });
  for (const item of report.observation.cases) {
    if (item.settling) continue;
    if (item.before) {
      assert.ok(item.before.colors > 1, `${item.name}: board must contain drawn content`);
      assert.equal(item.after.hash, item.before.hash, `${item.name}: retained pixels differ`);
      assert.equal(item.draws, 0, `${item.name}: unchanged canvas was composited`);
      assert.equal(item.clears, 0, `${item.name}: retained canvas was cleared`);
      if (report.observation.gamepadPollingAvailable)
        assert.ok(item.polls >= 18, `${item.name}: controller polling stopped`);
    } else {
      assert.ok(
        item.draws > 0 && item.clears > 0,
        `${item.name}: ordinary rendering did not resume`,
      );
      if (item.pixels) assert.ok(item.pixels.colors > 1, `${item.name}: board is blank`);
    }
  }
  assert.deepEqual(report.pageErrors, []);
  report.status = 'passed';
} catch (error) {
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(
  JSON.stringify({ status: report.status, output: resolve(output), error: report.error }),
);
