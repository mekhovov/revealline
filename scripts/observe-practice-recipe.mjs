/** Opt-in browser companion to the unpublished fourth-package recipe test.
 * Uses the existing builder/publisher's real outputs, never creates a release.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { startServer } from './game-cli.mjs';
import { boundedOperation, closeAllPages } from './optional-installation-observer-helpers.mjs';

export async function observePracticeRecipe({
  modulePath,
  output,
  fixture,
  preview,
  previous,
  current,
  retired,
  sourceRevision,
}) {
  if (!output || !path.isAbsolute(output))
    throw new Error('Browser recipe requires an absolute PRACTICE_RECIPE_BROWSER_REPORT path.');
  const { chromium } = await import(pathToFileURL(path.resolve(modulePath)).href);
  const root = path.join(fixture, '.cache/browser-site');
  const overlayHash = (overlay) =>
    createHash('sha256')
      .update(
        JSON.stringify(
          [...overlay]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([name, bytes]) => ({
              name,
              bytes: bytes.length,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            })),
        ),
      )
      .digest('hex');
  const report = {
    format: 'revealline-practice-recipe-browser.v1',
    publicEligible: false,
    sourceRevision,
    sourceBinding: 'Working-tree fixture based on this commit; not a frozen release candidate.',
    overlaySha256: {
      previous: overlayHash(previous),
      current: overlayHash(current),
      retired: overlayHash(retired),
    },
    fixtureBuilderSha256: createHash('sha256')
      .update(await readFile(new URL('./test-bundle-optional-practice.mjs', import.meta.url)))
      .digest('hex'),
    manifests: [...current]
      .filter(([name]) => name.endsWith('/optional-package.json'))
      .map(([name, bytes]) => ({ name, sha256: createHash('sha256').update(bytes).digest('hex') })),
    harnessSha256: createHash('sha256')
      .update(await readFile(new URL(import.meta.url)))
      .digest('hex'),
    startedAt: new Date().toISOString(),
    checkpoints: [],
    screenshots: [],
    errors: [],
    limitations: [
      'Local unpublished sample cloned from Gym; synthetic review records are not release approval.',
      'Browser-emulated network loss, not a physical network or OS restart.',
      'No physical controller, touch device, screen reader, human learning or performance qualification.',
    ],
  };
  let browser, server, previewServer;
  const write = async (name, bytes) => {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  };
  const stage = async (overlay) => {
    for (const [name, bytes] of overlay) await write('revealline/' + name, bytes);
  };
  const record = (name) => report.checkpoints.push(name);
  try {
    previewServer = await startServer({ root: preview, port: 0 });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    report.browser = await browser.version();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    context.on('page', (page) =>
      page.on('pageerror', (error) => report.errors.push(error.message)),
    );
    let page = await context.newPage();
    page.setDefaultTimeout(30000);
    await page.goto(new URL('practice/', previewServer.url).href);
    assert.equal(await page.locator('article').count(), 4);
    await page.locator('#locale').selectOption('uk');
    const card = page
      .locator('article')
      .filter({ has: page.locator('a[href*="sample-flight/app/"]') });
    await card.locator('[data-launch="play"]').waitFor();
    assert.match(await card.locator('[data-launch="play"]').getAttribute('href'), /lang=uk/);
    await page.locator('#locale').selectOption('en');
    const launched = context.waitForEvent('page');
    await card.locator('[data-launch="play"]').click();
    const app = await launched;
    const unlock = async (target) => {
      await target.waitForLoadState('domcontentloaded');
      await target.waitForFunction(
        () =>
          globalThis.document.documentElement.dataset.accessState === 'unlocked' ||
          globalThis.document.querySelector('#access-gate input[name="password"]'),
      );
      if (await target.locator('#access-gate input[name="password"]').isVisible()) {
        await target.getByLabel('Password', { exact: true }).fill('practice-recipe-fixture-only');
        await target.getByRole('button', { name: 'Unlock', exact: true }).click();
        await target.waitForFunction(
          () => globalThis.document.documentElement.dataset.accessState === 'unlocked',
        );
      }
    };
    await unlock(app);
    await app.waitForURL(
      '**/sample-flight/releases/v1.2.3/site/optional-practice/sample-flight/index.html?lang=en',
    );
    await app.locator('#gym-shell-action-primary').click();
    await app.locator('#gym-shell-action-pause').click();
    const screenshot = output.replace(/\.json$/, '') + '-sample-paused.png';
    await mkdir(path.dirname(screenshot), { recursive: true });
    const screenshotBytes = await app.screenshot({ path: screenshot });
    report.screenshots.push({
      path: screenshot,
      sha256: createHash('sha256').update(screenshotBytes).digest('hex'),
    });
    assert.match(await app.locator('#status').textContent(), /Paused/i);
    await app.locator('#gym-shell-action-pause-restart').click();
    await app.locator('#gym-shell-action-pause').click();
    assert.match(await app.locator('#status').textContent(), /Paused/i);
    record('four cards; EN/UK launch links; one Play opens sample; explicit start/pause/retry');
    await app.close();
    await page.close();
    await stage(previous);
    await write('.xonix-build.json', JSON.stringify({ tool: 'xonix-game-cli', formatVersion: 1 }));
    server = await startServer({ root, port: 0 });
    const launcher = new URL('revealline/practice/sample-flight/app/', server.url).href;
    page = await context.newPage();
    const prepare = async (version) => {
      await page.goto(launcher);
      await unlock(page);
      await page.locator('#prepare').waitFor({ state: 'visible' });
      assert.match(
        await page.locator('#prepare').getAttribute('href'),
        new RegExp(version.replaceAll('.', '\\.')),
      );
      await page.locator('#download').click();
      await page
        .locator('#status')
        .filter({ hasText: /^Ready offline$/ })
        .waitFor({ timeout: 60000 });
    };
    await prepare('v1.2.2');
    record('previous version prepared through stable launcher');
    await stage(current);
    await prepare('v1.2.3');
    await page.locator('#previous').waitFor({ state: 'visible' });
    assert.match(await page.locator('#previous').getAttribute('href'), /v1\.2\.2/);
    record('update preserves previous prepared version');
    await closeAllPages(context);
    await context.setOffline(true);
    const probe = await context.newPage();
    await write('network-probe.txt', 'uncached offline verification');
    await assert.rejects(probe.goto(new URL('network-probe.txt', server.url).href));
    await probe.close();
    page = await context.newPage();
    await page.goto(launcher + '?action=play&lang=en');
    await page.waitForURL(
      '**/releases/v1.2.3/site/optional-practice/sample-flight/index.html?lang=en',
    );
    await page.locator('#gym-shell-action-primary').waitFor({ state: 'visible' });
    record('all tabs closed; stable launcher reopens prepared current app with network disabled');
    await context.setOffline(false);
    await stage(previous);
    await page.goto(launcher + '?action=play&lang=en');
    await page.waitForURL(
      '**/releases/v1.2.2/site/optional-practice/sample-flight/index.html?lang=en',
    );
    await page.locator('#gym-shell-action-primary').waitFor({ state: 'visible' });
    record('retained-version rollback launches previous bytes');
    await stage(retired);
    // Existing publisher retires the stable entry on a fresh assembly. Remove
    // only this fixture's generated stable files to model that exact result.
    await rm(path.join(root, 'revealline/practice/sample-flight/app'), { recursive: true });
    await page.goto(new URL('revealline/practice/', server.url).href);
    assert.equal(await page.locator('article').count(), 0);
    assert.match(await page.locator('body').textContent(), /No reviewed packages/);
    await page.goto(
      new URL(
        'revealline/practice/sample-flight/releases/v1.2.2/site/optional-practice/sample-flight/index.html?lang=en',
        server.url,
      ).href,
    );
    await page.locator('#gym-shell-action-primary').waitFor({ state: 'visible' });
    record('retirement removes discovery while retaining immutable previous app');
    assert.deepEqual(report.errors, []);
    assert.equal(
      createHash('sha256')
        .update(await readFile(new URL(import.meta.url)))
        .digest('hex'),
      report.harnessSha256,
      'Observer changed during the run.',
    );
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.failure = error.message;
    throw error;
  } finally {
    const cleanupErrors = [];
    for (const cleanup of [
      () => browser?.close(),
      () => server && new Promise((resolve) => server.server.close(resolve)),
      () => previewServer && new Promise((resolve) => previewServer.server.close(resolve)),
    ]) {
      try {
        await boundedOperation('Recipe cleanup', cleanup);
      } catch (error) {
        cleanupErrors.push(error.message);
      }
    }
    report.cleanup = { errors: cleanupErrors };
    if (cleanupErrors.length) report.passed = false;
    report.finishedAt = new Date().toISOString();
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    if (cleanupErrors.length)
      throw new Error('Recipe browser cleanup failed: ' + cleanupErrors.join('; '));
  }
  return report;
}
