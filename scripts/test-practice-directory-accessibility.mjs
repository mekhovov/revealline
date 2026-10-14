/** Opt-in real-browser checks of the production directory renderer and panel.
 * No simulator, password gate, publisher or installation is replaced/bypassed.
 * Fixture catalogue metadata is explicitly not a release qualification.
 */
/* global document, matchMedia, getComputedStyle, innerWidth */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, open, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  practiceDirectoryHTML,
  PRACTICE_DIRECTORY_SCRIPT,
} from '../publishing/practice-directory.mjs';
import { boundedOperation } from './optional-installation-observer-helpers.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const modulePath = process.env.PRACTICE_DIRECTORY_BROWSER_MODULE;
const output = process.env.PRACTICE_DIRECTORY_BROWSER_REPORT;

test(
  'directory browser: focus, responsive reflow, locales and catalogue failure recovery',
  {
    skip: !modulePath && 'Set PRACTICE_DIRECTORY_BROWSER_MODULE to opt in.',
    timeout: 120000,
  },
  async () => {
    assert.ok(output && path.isAbsolute(output), 'An absolute report path is required.');
    const { chromium } = await import(pathToFileURL(path.resolve(modulePath)).href);
    const ids = ['civilian-flight', 'civilian-fpv', 'fpv-worlds'];
    const packages = [],
      details = [];
    for (const id of ids) {
      const description = JSON.parse(
        await readFile(path.join(repo, 'optional-practice', id, 'package-info.json')),
      );
      packages.push({
        id,
        name: description.copy.en.name,
        href: `${id}/app/`,
        version: 'v9.0.0',
        revision: 'browser-fixture',
      });
      details.push({
        id,
        revision: 'browser-fixture',
        description,
        preview: `${id}/releases/v9.0.0/site/optional-practice/${id}/preview.png`,
        guide: `${id}/releases/v9.0.0/site/optional-practice/${id}/guide.html`,
        downloadBytes: 1000000,
        offlineBytes: 2000000,
      });
    }
    const report = {
      format: 'revealline-practice-directory-browser.v1',
      publicEligible: false,
      sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repo,
        encoding: 'utf8',
      }).trim(),
      sourceBinding:
        'Current production renderer/panel with an unpublished three-card metadata fixture; not an admitted package or public release.',
      startedAt: new Date().toISOString(),
      checkpoints: [],
      findings: [],
      screenshots: [],
      errors: [],
      cleanupErrors: [],
      dialogFocus: [],
      harnessSha256: createHash('sha256')
        .update(await readFile(fileURLToPath(import.meta.url)))
        .digest('hex'),
      limitations: [
        'No physical controller, touchscreen, screen reader or human usability qualification.',
        '640 CSS-pixel viewport approximates 200% zoom reflow from 1280 CSS pixels; it is not native browser zoom.',
        'Launcher destinations are inspected, not unlocked or played; sizes/version are synthetic fixture metadata.',
      ],
    };
    for (const name of [
      'publishing/practice-directory.mjs',
      'game/ui/optional-practice-panel.mjs',
      'game/ui/optional-practice-panel.css',
      'optional-practice/navigation.mjs',
      'scripts/optional-installation-observer-helpers.mjs',
      ...ids.flatMap((id) => [
        `optional-practice/${id}/package-info.json`,
        `optional-practice/${id}/preview.png`,
      ]),
    ]) {
      (report.sourceFiles ??= []).push({
        path: name,
        sha256: createHash('sha256')
          .update(await readFile(path.join(repo, name)))
          .digest('hex'),
      });
    }
    // Reserve this run's receipt before opening resources. Existing evidence is
    // never replaced, even when two runs accidentally choose the same filename.
    await mkdir(path.dirname(output), { recursive: true });
    const reportFile = await open(output, 'wx');
    const persistReport = async () => {
      const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
      await reportFile.truncate(0);
      let offset = 0;
      while (offset < bytes.length) {
        const { bytesWritten } = await reportFile.write(
          bytes,
          offset,
          bytes.length - offset,
          offset,
        );
        if (!bytesWritten) throw new Error('Report write made no progress.');
        offset += bytesWritten;
      }
    };
    let mode = 'ready';
    const requests = [];
    const server = createServer(async (request, response) => {
      try {
        const pathname = new URL(request.url, 'http://localhost').pathname;
        requests.push(pathname);
        const send = (type, data, status = 200) => {
          response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
          response.end(data);
        };
        if (pathname === '/revealline/practice/')
          return send('text/html', practiceDirectoryHTML(packages, details));
        if (pathname === '/revealline/practice/empty/')
          return send('text/html', practiceDirectoryHTML([], []));
        if (pathname.endsWith('/directory.mjs'))
          return send('text/javascript', PRACTICE_DIRECTORY_SCRIPT);
        if (pathname === '/revealline/practice/index.json') {
          if (mode === 'failed') return send('application/json', '{}', 503);
          return send(
            'application/json',
            JSON.stringify({
              format: 'revealline-optional-package-launchers.v1',
              packages: mode === 'empty' ? [] : packages,
            }),
          );
        }
        if (pathname === '/revealline/practice/details.json')
          return send(
            'application/json',
            JSON.stringify(
              mode === 'bad-details'
                ? {}
                : { format: 'revealline-practice-details.v1', packages: details },
            ),
          );
        if (pathname === '/revealline/game/panel-test.html')
          return send(
            'text/html',
            `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="./ui/optional-practice-panel.css"><style>body{font:16px/1.5 system-ui;background:#0b1e2b;color:#f4f2e8}button{font:inherit}</style><nav id="host"></nav><script type="module">import { mountOptionalPracticePanel } from './ui/optional-practice-panel.mjs'; import { setLocale } from './i18n/index.mjs'; setLocale(new URL(location.href).searchParams.get('lang')==='uk'?'uk':'en'); mountOptionalPracticePanel({document,container:document.getElementById('host'),href:location.href,pause(){},timeoutMs:2000});</script></html>`,
          );
        const preview =
          /\/practice\/([a-z-]+)\/releases\/v9\.0\.0\/site\/optional-practice\/\1\/preview\.png$/.exec(
            pathname,
          );
        const relative = preview
          ? `optional-practice/${preview[1]}/preview.png`
          : pathname.replace(/^\/revealline\//, '');
        const file = path.resolve(repo, relative);
        if (
          !file.startsWith(repo) ||
          !/^(game|optional-practice)\//.test(relative) ||
          !/\.(mjs|js|css|png)$/.test(file)
        )
          return send('text/plain', 'Not part of this component fixture.', 404);
        const types = {
          '.mjs': 'text/javascript',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
        };
        const bytes = await readFile(file);
        if (!report.sourceFiles.some((source) => source.path === relative)) {
          report.sourceFiles.push({
            path: relative,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          });
        }
        return send(types[path.extname(file)], bytes);
      } catch {
        response.writeHead(404);
        response.end();
      }
    });
    let browser, runError;
    const record = (name) => report.checkpoints.push(name);
    try {
      report.result = 'running';
      await persistReport();
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${server.address().port}/revealline/`;
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      report.browser = browser.version();
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      page.on('pageerror', (error) => report.errors.push(error.message));
      const screenshot = async (suffix) => {
        const filename = output.replace(/\.json$/, '') + '-' + suffix + '.png';
        await mkdir(path.dirname(filename), { recursive: true });
        const bytes = await page.screenshot({ path: filename, fullPage: true });
        report.screenshots.push({
          path: filename,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      };
      await page.goto(base + 'practice/');
      await page.locator('article').first().waitFor();
      assert.equal(await page.locator('article').count(), 3);
      assert.equal(
        await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        true,
      );
      for (const locale of ['en', 'uk']) {
        await page.locator('#locale').selectOption(locale);
        assert.equal(await page.locator('html').getAttribute('lang'), locale);
        for (const [index, id] of ids.entries()) {
          const article = page.locator('article').nth(index);
          assert.equal(
            await article.locator('h2').textContent(),
            details[index].description.copy[locale].name,
          );
          for (const action of ['play', 'details']) {
            const link = article.locator(`[data-launch="${action}"]`);
            const href = new URL(await link.getAttribute('href'));
            assert.equal(href.pathname, `/revealline/practice/${id}/app/`);
            assert.equal(href.searchParams.get('lang'), locale);
            assert.equal(href.searchParams.get('action'), action === 'play' ? 'play' : null);
            assert.equal(await link.getAttribute('target'), '_blank');
            assert.match(await link.getAttribute('rel'), /noopener/);
          }
        }
        const navLinks = await page
          .locator('nav a')
          .evaluateAll((links) => links.map((link) => link.href));
        assert.deepEqual(
          navLinks.map((href) => new URL(href).pathname),
          ['/revealline/game/', '/revealline/optional-practice/civilian-fpv/guide.html'],
        );
        for (const href of navLinks) {
          assert.equal(
            new URL(href).searchParams.get('lang'),
            locale,
            'Help/main-game navigation preserves locale.',
          );
        }
      }
      record(
        'All three cards render localized descriptions and safe same-origin Play/details links in EN/UK.',
      );
      await page.locator('#locale').selectOption('en');
      await page.keyboard.press('Tab');
      const focus = [];
      for (let i = 0; i < 9; i++) {
        const state = await page.evaluate(() => {
          const el = document.activeElement,
            css = getComputedStyle(el);
          return {
            tag: el.tagName,
            text: el.textContent.trim().slice(0, 60),
            outline: css.outlineStyle,
            width: css.outlineWidth,
          };
        });
        assert.ok(['A', 'SELECT'].includes(state.tag));
        assert.notEqual(state.outline, 'none');
        assert.ok(parseFloat(state.width) >= 3);
        focus.push(state);
        await page.keyboard.press('Tab');
      }
      report.keyboardFocus = focus;
      record('Nine consecutive keyboard stops have a visible 3px focus outline.');
      for (const [width, height, name] of [
        [1280, 900, 'desktop'],
        [375, 812, 'narrow'],
        [640, 450, 'zoom-equivalent'],
      ]) {
        await page.setViewportSize({ width, height });
        await page.locator('#locale').selectOption('uk');
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          name + ' no horizontal page overflow',
        );
        const columns = await page
          .locator('main')
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
        if (width === 375) assert.equal(columns, 1);
        assert.equal(
          await page.evaluate(
            () =>
              document.getAnimations().filter((animation) => animation.playState === 'running')
                .length,
          ),
          0,
        );
        await screenshot(name);
      }
      record(
        '1280px, 375px single-column and 640px zoom-equivalent layouts fit without horizontal overflow; reduced motion has no running animations.',
      );
      assert.equal(
        await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
        0,
      );
      assert.equal(
        requests.some((url) => /\/(app|world-app|flight-app)\.mjs$/.test(url)),
        false,
      );
      record('Browsing the directory loads no simulator entry module and registers no worker.');
      await page.goto(base + 'practice/empty/?lang=uk');
      await page.waitForFunction(() => document.documentElement.lang === 'uk');
      assert.equal(await page.locator('article').count(), 0);
      assert.match(await page.locator('.notice').textContent(), /FPV/);
      assert.equal(await page.locator('nav a').count(), 2);
      record('Empty directory retains FPV/main-game and player-guide navigation.');
      await page.setViewportSize({ width: 375, height: 812 });
      for (const locale of ['en', 'uk']) {
        await page.goto(base + `game/panel-test.html?lang=${locale}`);
        await page.locator('#shell-optional-practice').click();
        await page.waitForFunction(
          () => !document.getElementById('optional-practice-refresh').disabled,
        );
        assert.equal(await page.locator('.optional-practice-packages > li').count(), 3);
        const status = page.locator('[role="status"]');
        assert.equal(await status.getAttribute('aria-live'), 'polite');
        assert.equal(
          await page.evaluate(() => document.activeElement.id),
          'optional-practice-close',
        );
        for (let step = 0; step < 12; step++) {
          await page.keyboard.press('Tab');
          const focusState = await page.evaluate(() => ({
            inDialog: Boolean(document.activeElement.closest('dialog[open]')),
            hasPageFocus: document.hasFocus(),
            tag: document.activeElement.tagName,
            id: document.activeElement.id,
          }));
          report.dialogFocus.push({ locale, step, ...focusState });
          // Native Tab can leave web content for browser chrome; that is not
          // background-page focus and must not be trapped by application code.
          if (!focusState.hasPageFocus) continue;
          assert.equal(focusState.inDialog, true, JSON.stringify({ step, ...focusState }));
          assert.equal(
            await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle),
            'solid',
          );
        }
        assert.ok(
          report.dialogFocus.filter((state) => state.locale === locale && state.hasPageFocus)
            .length >= 10,
          'Each locale must exercise at least ten page-focus stops.',
        );
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
        );
        const beforeFailure = await status.textContent();
        mode = 'failed';
        await page.locator('#optional-practice-refresh').click();
        await page.waitForFunction(
          () => !document.getElementById('optional-practice-refresh').disabled,
        );
        assert.equal(await page.locator('.optional-practice-packages > li').count(), 3);
        assert.notEqual(await status.textContent(), beforeFailure);
        assert.match(await status.textContent(), /\d{4}-\d\d-\d\dT/);
        await screenshot(`cached-${locale}`);
        mode = 'bad-details';
        await page.locator('#optional-practice-refresh').click();
        await page.waitForFunction(
          () => !document.getElementById('optional-practice-refresh').disabled,
        );
        assert.equal(await page.locator('.optional-practice-packages > li').count(), 3);
        assert.equal(await page.locator('.optional-practice-packages img').count(), 0);
        mode = 'empty';
        await page.locator('#optional-practice-refresh').click();
        await page.waitForFunction(
          () => !document.getElementById('optional-practice-refresh').disabled,
        );
        assert.equal(await page.locator('.optional-practice-packages > li').count(), 0);
        assert.equal(await page.locator('.optional-practice-fallback').count(), 2);
        assert.notEqual(await status.textContent(), beforeFailure);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('optional-practice-dialog').open);
        assert.equal(
          await page.evaluate(() => document.activeElement.id),
          'shell-optional-practice',
        );
        mode = 'ready';
      }
      record(
        'EN/UK in-game panel: polite status, close-button focus, dated cached catalogue after failure, bad-details basic cards, empty fallback links and Escape focus restoration.',
      );
      mode = 'failed';
      await page.goto(base + 'game/panel-test.html?lang=en');
      await page.evaluate(() => localStorage.clear());
      await page.locator('#shell-optional-practice').click();
      await page.waitForFunction(
        () => !document.getElementById('optional-practice-refresh').disabled,
      );
      assert.equal(await page.locator('.optional-practice-packages > li').count(), 0);
      assert.doesNotMatch(await page.locator('[role="status"]').textContent(), /\d{4}-\d\d-\d\dT/);
      assert.equal(await page.locator('.optional-practice-fallback').count(), 2);
      await screenshot('request-failed');
      mode = 'ready';
      await page.locator('#optional-practice-refresh').click();
      await page.waitForFunction(
        () => !document.getElementById('optional-practice-refresh').disabled,
      );
      assert.equal(await page.locator('.optional-practice-packages > li').count(), 3);
      record(
        'Cold request failure retains retry/navigation; successful retry restores all three cards. Twelve Tab steps per locale keep page-focus stops inside the dialog with visible outlines; browser-chrome focus is allowed.',
      );
      assert.deepEqual(report.errors, []);
      report.result = report.findings.length ? 'passed-with-findings' : 'passed';
    } catch (error) {
      report.result = 'failed';
      report.failure = error.message;
      runError = error;
    } finally {
      // A stuck browser must not prevent closing the server or retaining the
      // failure receipt. Each owned resource has its own independent deadline.
      await Promise.all(
        [
          [
            'browser',
            async () => {
              await browser?.close();
            },
          ],
          [
            'server',
            async () => {
              server.closeAllConnections();
              if (server.listening)
                await new Promise((resolve, reject) =>
                  server.close((error) => (error ? reject(error) : resolve())),
                );
            },
          ],
        ].map(async ([resource, operation]) => {
          try {
            await boundedOperation(`Close directory ${resource}`, operation, 5000);
          } catch (error) {
            report.cleanupErrors.push({ resource, error: error.message });
          }
        }),
      );
      report.sourceRecheck = { checked: 0, errors: [] };
      for (const source of [
        ...report.sourceFiles,
        { path: path.relative(repo, fileURLToPath(import.meta.url)), sha256: report.harnessSha256 },
      ]) {
        try {
          const actual = createHash('sha256')
            .update(await readFile(path.join(repo, source.path)))
            .digest('hex');
          if (actual !== source.sha256) throw new Error('Source bytes changed during observation.');
          report.sourceRecheck.checked++;
        } catch (error) {
          report.sourceRecheck.errors.push({ path: source.path, error: error.message });
        }
      }
      if (report.cleanupErrors.length || report.sourceRecheck.errors.length) {
        report.result = 'failed';
        runError ??= new Error(
          'Directory observation cleanup or source recheck failed; see retained report.',
        );
      }
      report.finishedAt = new Date().toISOString();
      try {
        await persistReport();
      } finally {
        await reportFile.close();
      }
    }
    if (runError) throw runError;
  },
);
