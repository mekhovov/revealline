/* global document, location, getComputedStyle */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { startProductionPreview } from './serve-production-preview.mjs';
import {
  createPagesDiagnostics,
  pagesBudget,
  encodePagesReport,
  redactPagesText,
} from './solo-pages-smoke.mjs';
import {
  TARGET,
  CURRENT_ID,
  RETAINED_IDS,
  STAGES,
  assertLoopback,
} from './compiled-menu-browser-contract.mjs';

export function readCompiledMenuPublicState() {
  const visible = (x) =>
    Boolean(
      x &&
        !x.hidden &&
        !x.closest('[hidden]') &&
        x.getClientRects().length &&
        getComputedStyle(x).display !== 'none' &&
        getComputedStyle(x).visibility !== 'hidden',
    );
  const text = (x) => {
    const s = (x?.textContent ?? '').trim();
    return s.length <= 512 ? s : '[public text over limit]';
  };
  const control = (id) => {
    const x = document.getElementById(id);
    return {
      visible: visible(x),
      enabled: Boolean(x && !x.disabled),
      open: Boolean(x?.open),
      text: text(x),
    };
  };
  const nodes = [...document.querySelectorAll('#journey-cards .journey-card')];
  if (nodes.length > 1024) throw new Error('Public card evidence limit');
  return {
    href: location.href,
    hidden: document.hidden,
    focused: document.hasFocus(),
    lang: document.documentElement.lang,
    focusedId: document.activeElement?.id ?? '',
    boot: document.documentElement.dataset.bootState,
    access: document.documentElement.dataset.accessState,
    flight: document.body.dataset.flightState,
    time: text(document.getElementById('time')),
    lives: text(document.getElementById('lives')),
    coverage: text(document.getElementById('coverage')),
    controls: Object.fromEntries(
      [
        'shell-home',
        'shell-play',
        'shell-options',
        'journey-chooser',
        'journey-back',
        'start-button',
        'pause-button',
        'shell-menu',
        'settings-dialog',
        'mission-replace-dialog',
        'mode-leave-dialog',
      ].map((id) => [id, control(id)]),
    ),
    cards: nodes.map((x) => ({
      id: x.dataset.missionId,
      visible: visible(x),
      enabled: !x.disabled,
    })),
  };
}
async function fingerprint(file) {
  const p = await realpath(file),
    info = await lstat(p);
  assert(info.isFile() && !info.isSymbolicLink());
  const h = createHash('sha256');
  for await (const chunk of createReadStream(p)) h.update(chunk);
  return {
    path: p,
    bytes: info.size,
    sha256: h.digest('hex'),
    dev: info.dev,
    ino: info.ino,
    mode: info.mode,
  };
}
export async function observeCompiledMenu({
  root,
  playwrightPath,
  output,
  toolingRevision,
  password,
}) {
  const report = {
    format: 'RevealLineCompiledMenuBrowserReportV1',
    status: 'failed',
    target: TARGET,
    toolingRevision,
    engine: 'chromium',
    profile: 'fresh-ephemeral',
    performanceExcluded: true,
    stages: [],
    localeEvidence: [],
    samples: [],
    cleanup: { context: 'absent', browser: 'absent', server: 'absent' },
  };
  const budget = pagesBudget(570000);
  const step = (...args) => {
    report.activeStep = args[0];
    return budget.step(...args);
  };
  let server, browser, context, diagnostics;
  const retain = async () =>
    writeFile(join(output, 'report.json'), encodePagesReport(report, password), { mode: 0o600 });
  const closeWithin = async (label, work) => {
    let timer;
    try {
      await Promise.race([
        work(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(label + ' cleanup deadline')), 10000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    assert.equal(process.versions.node, '22.22.2');
    assert(/^[a-f0-9]{40}$/.test(toolingRevision));
    assert(
      typeof password === 'string' &&
        password.length > 0 &&
        password.length <= 512 &&
        !password.includes('\0'),
    );
    assert(playwrightPath.endsWith('/node_modules/playwright/index.mjs'));
    const { chromium } = await import(pathToFileURL(playwrightPath).href);
    report.binaryBefore = await fingerprint(chromium.executablePath());
    assert(report.binaryBefore.path.includes('chromium-1234/'));
    const preview = await startProductionPreview({
      root,
      port: 0,
      fixtureAccess: false,
      cache: 'no-store',
    });
    server = preview.server;
    report.cleanup.server = 'pending';
    assert.equal(preview.mode, 'generated-build');
    assert.equal(preview.fixtureAccess, false);
    assert.equal(preview.headers, 'generated _headers (verified)');
    const origin = assertLoopback(preview.url).href;
    report.preview = { mode: preview.mode, headers: preview.headers, fixtureAccess: false, origin };
    browser = await step('launch', () =>
      chromium.launch({ headless: true, executablePath: report.binaryBefore.path, timeout: 30000 }),
    );
    report.cleanup.browser = 'pending';
    report.browserVersion = browser.version();
    assert.equal(report.browserVersion, '151.0.7922.34');
    context = await step('fresh context', () =>
      browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' }),
    );
    report.cleanup.context = 'pending';
    assert.equal(context.pages().length, 0);
    const page = await step('new page', () => context.newPage());
    await page.bringToFront();
    diagnostics = createPagesDiagnostics(page, password, 128);
    report.diagnostics = diagnostics.result;
    report.navigationResponses = [];
    report.navigationOverflow = false;
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (
        url.origin === new URL(origin).origin &&
        url.pathname === '/game/content-design/runtime/navigation-whole-spatial-v25.json'
      ) {
        if (report.navigationResponses.length >= 8) {
          report.navigationOverflow = true;
          return;
        }
        report.navigationResponses.push({ path: url.pathname, status: response.status() });
      }
    });
    const url = origin + 'game/?journey=whole-spatial-v25';
    await step(
      'game document',
      (timeout) => page.goto(url, { waitUntil: 'domcontentloaded', timeout }),
      60000,
    );
    const field = page.locator('#access-gate input[type="password"]');
    await step(
      'ordinary access form',
      (timeout) => field.waitFor({ state: 'visible', timeout }),
      60000,
    );
    assert.equal(page.url(), url);
    await step('ordinary password entry', (timeout) => field.fill(password, { timeout }));
    assert.equal(page.url(), url);
    await step('ordinary password submission', (timeout) =>
      page.locator('#access-gate button[type="submit"]').click({ timeout }),
    );
    await step(
      'ordinary password accepted',
      (timeout) =>
        page.waitForFunction(
          () =>
            document.documentElement.dataset.accessState === 'unlocked' &&
            !document.querySelector('#access-gate'),
          null,
          { timeout },
        ),
      60000,
    );
    report.stages.push('ordinary-password-accepted');
    await retain();
    const read = async () => {
      const s = await step('read public DOM', () => page.evaluate(readCompiledMenuPublicState));
      assert.equal(new URL(s.href).origin, new URL(origin).origin);
      assert.equal(s.hidden, false);
      assert.equal(s.focused, true);
      assert(
        !s.controls['mission-replace-dialog'].open && !s.controls['mode-leave-dialog'].open,
        'Unexpected discard guard',
      );
      return s;
    };
    const until = async (label, predicate, cap = 60000) => {
      const end = Math.min(budget.deadline, budget.now() + cap);
      for (;;) {
        assert(budget.now() < end, 'Compiled controls deadline: ' + label);
        const s = await read();
        if (predicate(s)) return s;
        await step(
          'public observation interval',
          () => page.waitForTimeout(100),
          Math.min(1000, end - budget.now()),
        );
      }
    };
    const click = async (selector) =>
      step('native click ' + selector, (timeout) => page.locator(selector).click({ timeout }));
    const screenshot = async (name) => {
      assert.equal(await page.locator('#access-gate').count(), 0);
      const bytes = await step('bounded screenshot', () =>
        page.screenshot({ type: 'jpeg', quality: 45, fullPage: false, timeout: 10000 }),
      );
      assert(bytes.length <= 512 * 1024, 'Screenshot cap');
      await writeFile(join(output, name + '.jpg'), bytes, { flag: 'wx', mode: 0o600 });
    };
    await until('Home', (s) => s.boot === 'ready' && s.controls['shell-home'].open, 120000);
    assert.equal((await read()).lang, 'en');
    report.stages.push('en-home');
    await screenshot('en-home');
    const filter = async (id, value) => {
      const control = page.locator('#' + id);
      if (!(await control.isVisible())) await click('#journey-filter-summary');
      await step('native filter ' + id, (timeout) => control.selectOption(value, { timeout }));
    };
    const browse = async (locale) => {
      await click('#shell-play');
      await until(
        'visible Missions',
        (s) => s.controls['journey-chooser'].open && s.controls['journey-chooser'].visible,
      );
      await filter('journey-mode', 'solo');
      await filter('journey-collection', 'Journey');
      await filter('journey-lifecycle', 'current');
      let s = await until('current source', (s) =>
        s.cards.some((x) => x.id === CURRENT_ID && x.visible && x.enabled),
      );
      const current = s.cards.filter((x) => JSON.parse(x.id)[1] === 'whole-spatial-v25');
      assert.equal(current.length, 91);
      assert.equal(new Set(current.map((x) => x.id)).size, 91);
      await filter('journey-lifecycle', 'archive');
      s = await until('retained source', (s) =>
        RETAINED_IDS.every((id) => s.cards.some((x) => x.id === id && x.visible && x.enabled)),
      );
      assert.deepEqual(
        s.cards
          .filter((x) => JSON.parse(x.id)[1] === 'whole-spatial-v24')
          .map((x) => x.id)
          .sort(),
        [...RETAINED_IDS].sort(),
      );
      await filter('journey-lifecycle', 'current');
      await until('current restored', (s) => s.cards.some((x) => x.id === CURRENT_ID));
      await screenshot(locale + '-missions');
      await click('#journey-back');
      s = await until(
        'Missions return focus',
        (s) =>
          !s.controls['journey-chooser'].open &&
          s.controls['shell-home'].open &&
          s.focusedId === 'shell-play',
      );
      const expected = locale === 'en' ? 'Select Mission' : 'Вибрати місію';
      assert.equal(s.controls['shell-play'].text, expected);
      report.localeEvidence.push({
        locale,
        currentCount: current.length,
        currentId: CURRENT_ID,
        retainedIds: [...RETAINED_IDS],
        backFocus: s.focusedId,
        missionsLabel: s.controls['shell-play'].text,
      });
      report.stages.push(locale + '-current-and-retained', locale + '-browse-back-focus');
      await retain();
    };
    await browse('en');
    await click('#shell-play');
    let s = await until('exact current visible', (s) =>
      s.cards.some((x) => x.id === CURRENT_ID && x.visible && x.enabled),
    );
    const index = s.cards.findIndex((x) => x.id === CURRENT_ID);
    const card = page.locator('#journey-cards .journey-card').nth(index);
    assert.equal(await card.getAttribute('data-mission-id'), CURRENT_ID);
    await step('real exact mission card', (timeout) => card.click({ timeout }));
    s = await until(
      'accepted briefing',
      (s) =>
        s.flight === 'briefing' &&
        !s.controls['journey-chooser'].open &&
        !s.controls['shell-home'].open &&
        s.controls['start-button'].visible &&
        s.controls['start-button'].enabled,
    );
    assert.equal(new URL(s.href).searchParams.get('library-mission'), CURRENT_ID);
    assert.equal(new URL(s.href).searchParams.get('journey'), 'whole-spatial-v25');
    report.stages.push('exact-current-briefing');
    await click('#start-button');
    const running = await until('running', (s) => s.flight === 'running');
    await until(
      'real clock advances',
      (s) => s.flight === 'running' && s.time && s.time !== running.time,
    );
    await click('#pause-button');
    const paused = await until(
      'paused',
      (s) => s.flight === 'paused' && s.controls['start-button'].visible,
    );
    await step('paused observation', () => page.waitForTimeout(500), 1500);
    s = await read();
    assert.equal(s.time, paused.time);
    assert.equal(s.lives, paused.lives);
    assert.equal(s.coverage, paused.coverage);
    report.visiblePauseValuesStable = true;
    report.samples.push({ phase: 'paused', time: s.time, lives: s.lives, coverage: s.coverage });
    await click('#start-button');
    const resumed = await until('resumed', (s) => s.flight === 'running');
    await until('resumed clock advances', (s) => s.flight === 'running' && s.time !== resumed.time);
    await click('#pause-button');
    await until('pause before Home', (s) => s.flight === 'paused');
    report.stages.push('native-start-pause-resume');
    await click('#shell-menu');
    await until('Home', (s) => s.controls['shell-home'].open);
    await click('#shell-options');
    await until('Settings', (s) => s.controls['settings-dialog'].open);
    await click('#settings-tab-display');
    const languages = page.locator('#settings-dialog [data-language-select]:visible');
    assert.equal(await languages.count(), 1);
    await step('native Ukrainian language', (timeout) => languages.selectOption('uk', { timeout }));
    await until('Ukrainian locale', (s) => s.lang === 'uk');
    assert.equal(
      (await page.locator('#settings-tab-display').textContent()).trim(),
      'Екран і мова',
    );
    await click('#settings-dialog [data-close="settings-dialog"]');
    s = await until(
      'Settings return focus',
      (s) =>
        !s.controls['settings-dialog'].open &&
        s.controls['shell-home'].open &&
        s.focusedId === 'shell-options',
    );
    assert.equal(s.controls['shell-options'].text, 'Налаштування');
    report.settingsBackFocus = s.focusedId;
    report.stages.push('native-uk-settings-back-focus');
    await screenshot('uk-home');
    await browse('uk');
    assert.deepEqual(report.stages, STAGES);
    assert.equal(report.diagnostics.total, 0);
    assert.equal(report.diagnostics.overflow, false);
    assert(
      !report.navigationOverflow &&
        report.navigationResponses.length > 0 &&
        report.navigationResponses.every((x) => x.status === 200),
      'Actual compiled navigation response required',
    );
    report.status = 'passed-controls';
  } catch (error) {
    report.failure = redactPagesText(error?.message ?? error, password);
    report.failureDetails = {
      name: typeof error?.name === 'string' ? error.name : 'Error',
      step: report.activeStep ?? null,
      completedStages: [...report.stages],
      message: report.failure,
    };
  } finally {
    diagnostics?.detach();
    try {
      if (context) {
        await closeWithin('context', () => context.close());
        report.cleanup.context = 'closed';
      }
    } catch (error) {
      report.cleanupFailure = redactPagesText(error.message, password);
    }
    try {
      if (browser) {
        await closeWithin('browser', () => browser.close());
        report.cleanup.browser = 'closed';
      }
    } catch (error) {
      report.cleanupFailure = redactPagesText(error.message, password);
    }
    try {
      if (server) {
        await closeWithin(
          'server',
          () =>
            new Promise((resolve, reject) => {
              server.close((error) => (error ? reject(error) : resolve()));
              server.closeAllConnections();
            }),
        );
        report.cleanup.server = 'closed';
      }
    } catch (error) {
      report.cleanupFailure = redactPagesText(error.message, password);
    }
    if (report.binaryBefore) {
      try {
        report.binaryAfter = await fingerprint(report.binaryBefore.path);
      } catch (error) {
        report.cleanupFailure = redactPagesText(error.message, password);
      }
    }
    if (
      report.failure ||
      report.cleanupFailure ||
      Object.values(report.cleanup).some((x) => x !== 'closed')
    )
      report.status = 'failed';
    await retain();
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [root, playwrightPath, output, toolingRevision] = process.argv.slice(2);
  const result = await observeCompiledMenu({
    root,
    playwrightPath,
    output,
    toolingRevision,
    password: process.env.REVEALLINE_PAGES_TEST_PASSWORD,
  });
  if (result.status !== 'passed-controls') process.exitCode = 1;
}
