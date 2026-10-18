#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import {
  writeQualificationReport,
  diagnoseQualificationFailure,
  finishQualification,
} from './shared-demo-browser-report.mjs';
import { pathToFileURL } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';

// Uses a supplied, already installed Playwright runtime; never installs browsers.
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const runtime = args.runtime ?? 'playwright';
const engine = args.browser ?? 'chromium';
const duration = Number(args.seconds ?? 0);
const nativeEntries = {
  snake: '/game/snake/play.html?level=classic-snake-open-loop&ready=1',
  sim: '/optional-practice/fpv-worlds/index.html',
  survival: '/game/overflight/play.html?layout=field-crossing-shelterbelt-gaps',
};
const currentModeOnly = args.scope === 'current' || args.idle === 'true';
const startButton = args.entry
  ? currentModeOnly
    ? '#demo-button'
    : '#demo-all-button'
  : currentModeOnly
    ? '#shell-demo'
    : '#shell-demo-all';
const reportPath = args.report ?? `.cache/shared-demo-${engine}.json`;
const report = {
  engine,
  requestedDurationSeconds: duration,
  scope: currentModeOnly ? 'current' : 'all',
  idleEntry: args.idle === 'true',
  started: new Date().toISOString(),
  checks: [],
  samples: [],
  errors: [],
  complete: false,
};
let browser, context, page;
const snapshot = () =>
  page.locator('#demo-dialog').evaluate((node) => ({
    mode: node.dataset.demoMode,
    source: node.dataset.demoSource,
    phase: node.dataset.demoPhase,
    failure: node.dataset.demoFailure,
    failureDetails: JSON.parse(node.dataset.demoFailureDetails ?? 'null'),
    tick: node.dataset.demoTick,
    canvases: node.querySelectorAll('canvas').length,
    nativeSurfaces: node.querySelectorAll('.demo-native-surface').length,
    title: node.querySelector('#demo-level').textContent,
    resources: JSON.parse(node.dataset.demoResources ?? '{}'),
  }));
const storage = () =>
  page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key)]),
    ),
  );
const ready = (timeout = 35000) =>
  page.waitForFunction(
    () => globalThis.document.querySelector('#demo-dialog')?.dataset.demoPhase === 'playing',
    null,
    { timeout },
  );
try {
  const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
  await mkdir(new URL('../.cache/', import.meta.url), { recursive: true });
  browser = await playwright[engine].launch({
    headless: true,
    ...(args.executable ? { executablePath: args.executable } : {}),
  });
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // Same test-only credential as access-gate-runtime.test.mjs. Route rewriting is
  // confined to this ephemeral local test context; production files are untouched.
  const baseURL = args.url ?? 'http://127.0.0.1:8768';
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname));
  const salt = Buffer.from('password-gate-test');
  const verifier = pbkdf2Sync('fixture-password', salt, 150000, 32, 'sha256').toString('base64url');
  await context.route(`${baseURL}/**`, async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    let body = await response.text();
    for (const [name, value] of [
      ['salt', salt.toString('base64url')],
      ['verifier', verifier],
      ['id', 'demo-browser-fixture'],
    ])
      body = body.replace(
        new RegExp(`(name="revealline-access-${name}"\\s+content=")[^"]+`),
        `$1${value}`,
      );
    await route.fulfill({ response, body });
  });
  page = await context.newPage();
  page.on('pageerror', (error) => {
    if (report.errors.length < 64) report.errors.push(String(error.stack ?? error));
  });
  await page.goto(`${baseURL}${nativeEntries[args.entry] ?? '/game/?journey=legacy'}`);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  if (args.entry === 'snake') await page.locator('#snake-action-menu').click();
  await page.locator(startButton).waitFor({ state: 'visible', timeout: 30000 });
  const before = await storage();
  const baselineWorkers = page.workers().length;
  const enteredAt = Date.now();
  if (args.idle === 'true') {
    await ready(95000);
    assert.ok(Date.now() - enteredAt >= 59000, 'Idle entry must allow sixty eligible seconds.');
    report.checks.push({ type: 'idle-current-mode-entry', elapsedMs: Date.now() - enteredAt });
  } else await page.locator(startButton).click();
  const modes = new Set();
  const modeCount = currentModeOnly ? 1 : 4;
  for (let i = 0; i < modeCount; i++) {
    await ready();
    const first = await snapshot();
    modes.add(first.mode);
    assert.equal(first.nativeSurfaces, first.mode === 'solo' ? 0 : 1);
    await page.waitForFunction(
      (tick) => globalThis.document.querySelector('#demo-dialog')?.dataset.demoTick !== tick,
      first.tick,
      { timeout: 3000 },
    );
    const second = await snapshot();
    assert.notEqual(second.tick, first.tick, `The ${first.mode} simulation must advance.`);
    report.checks.push({ type: 'native-playback', ...second });
    if (args.localeCheck === 'true') {
      await page.evaluate(async () =>
        (await import('/game/i18n/index.mjs')).setLocale('uk', { persist: false }),
      );
      assert.equal(await page.locator('#demo-back').textContent(), 'Назад');
      const caption = await page.locator('#demo-caption').textContent();
      assert.match(caption, /[А-Яа-яІіЇїЄє]/u);
      report.checks.push({ type: 'live-localization', mode: first.mode, caption });
      await page.evaluate(async () =>
        (await import('/game/i18n/index.mjs')).setLocale('en', { persist: false }),
      );
    }
    if (args.practice === 'true') {
      await page.locator('#demo-interrupt').click();
      const checkpoint = await snapshot();
      await page.locator('#demo-takeover').click();
      await page.waitForFunction(() =>
        globalThis.document.querySelector('#demo-dialog').classList.contains('is-practice'),
      );
      assert.equal(
        (await snapshot()).tick,
        checkpoint.tick,
        'Practice must reconstruct the displayed native checkpoint.',
      );
      await page.keyboard.press('ArrowRight');
      // The retained readout publishes whole-second changes. Wait for its
      // observable checkpoint instead of assuming a per-frame DOM write.
      await page.waitForFunction(
        (tick) => globalThis.document.querySelector('#demo-dialog')?.dataset.demoTick !== tick,
        checkpoint.tick,
        { timeout: 3000 },
      );
      const practiced = await snapshot();
      assert.notEqual(
        practiced.tick,
        checkpoint.tick,
        `${first.mode} practice accepts fresh input.`,
      );
      await page.locator('#demo-return').click();
      await ready();
      assert.equal(
        (await snapshot()).source,
        checkpoint.source,
        'Returning resumes the original recorded performance.',
      );
      report.checks.push({ type: 'takeover-and-return', mode: first.mode });
    }
    if (i < modeCount - 1) await page.locator('#demo-next').click();
  }
  assert.deepEqual(
    [...modes].sort(),
    currentModeOnly ? [args.entry ?? 'solo'] : ['sim', 'snake', 'solo', 'survival'],
  );
  if (args.fault === 'graphics') {
    for (let attempt = 0; (await snapshot()).mode !== 'sim' && attempt < 12; attempt++) {
      await page.locator('#demo-next').click();
      await ready();
    }
    assert.equal((await snapshot()).mode, 'sim');
    const lost = await page.locator('.demo-native-surface canvas').evaluate((canvas) => {
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      const extension = gl?.getExtension('WEBGL_lose_context');
      extension?.loseContext();
      return !!extension;
    });
    assert.equal(lost, true, 'The browser must actually lose its graphics context.');
    await page.waitForFunction(
      () => {
        const node = globalThis.document.querySelector('#demo-dialog');
        return node.dataset.demoMode !== 'sim' && node.dataset.demoPhase === 'playing';
      },
      null,
      { timeout: 31000 },
    );
    assert.ok((await snapshot()).nativeSurfaces <= 1);
    report.checks.push({ type: 'real-webgl-loss-recovery', ...(await snapshot()) });
  }
  await page.locator('#demo-watch-pause').click();
  const paused = await snapshot();
  await page.waitForTimeout(750);
  assert.equal((await snapshot()).tick, paused.tick);
  report.checks.push({ type: 'pause', mode: paused.mode });
  await page.locator('#demo-watch-pause').click();
  if (args.lifecycle === 'true' && engine === 'chromium') {
    const protocol = await context.newCDPSession(page);
    const held = await snapshot();
    await protocol.send('Page.setWebLifecycleState', { state: 'frozen' });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await protocol.send('Page.setWebLifecycleState', { state: 'active' });
    assert.equal((await snapshot()).phase, held.phase, 'Freeze preserves playback intent.');
    await page.waitForFunction(
      (tick) => globalThis.document.querySelector('#demo-dialog')?.dataset.demoTick !== tick,
      held.tick,
      { timeout: 3000 },
    );
    assert.notEqual((await snapshot()).tick, held.tick, 'Resume rebases the running clock.');
    await page.locator('#demo-watch-pause').click();
    const pausedCheckpoint = await snapshot();
    await protocol.send('Page.setWebLifecycleState', { state: 'frozen' });
    await new Promise((resolve) => setTimeout(resolve, 800));
    await protocol.send('Page.setWebLifecycleState', { state: 'active' });
    await page.waitForTimeout(300);
    assert.equal((await snapshot()).tick, pausedCheckpoint.tick, 'Explicit pause survives freeze.');
    await page.locator('#demo-watch-pause').click();
    report.checks.push({ type: 'browser-freeze-resume-and-paused-intent' });
    await protocol.detach();
  }
  for (let cycle = 0; cycle < Number(args.cycles ?? 0); cycle++) {
    await page.locator('#demo-next').click();
    await ready();
    const value = await snapshot();
    assert.ok(value.nativeSurfaces <= 1);
    report.checks.push({
      type: 'scene-retirement',
      cycle,
      workers: page.workers().length,
      ...value,
    });
  }
  if (args.practice === 'true') {
    const beforeResize = await snapshot();
    await page.setViewportSize({ width: 390, height: 844 });
    // Canvas resizing clears its bitmap. Capture after the common scheduler
    // has advanced and the browser has had a paint opportunity at the new size.
    await page.waitForFunction(
      (tick) => {
        const dialog = globalThis.document.querySelector('#demo-dialog');
        return dialog?.dataset.demoTick !== tick || dialog?.dataset.demoPhase === 'complete';
      },
      beforeResize.tick,
      { timeout: 3000 },
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
        ),
    );
    assert.equal(await page.locator('#demo-back').isVisible(), true);
    assert.equal(await page.locator('#demo-watch-pause').isVisible(), true);
    await page.screenshot({ path: reportPath.replace(/\.json$/, '-narrow.png') });
    await page.setViewportSize({ width: 1280, height: 800 });
    report.checks.push({ type: 'narrow-controls' });
  }
  if (args.fault === 'offline') {
    await context.setOffline(true);
    for (let attempt = 0; attempt < 3; attempt++) {
      const began = Date.now();
      await page.locator('#demo-next').click();
      await page.waitForFunction(
        () =>
          ['playing', 'unavailable'].includes(
            globalThis.document.querySelector('#demo-dialog').dataset.demoPhase,
          ),
        null,
        { timeout: 31000 },
      );
      const result = await snapshot();
      assert.ok(result.nativeSurfaces <= 1);
      assert.ok(Date.now() - began < 31000);
      if (result.phase === 'unavailable')
        assert.equal(await page.locator('#demo-retry').isVisible(), true);
      report.checks.push({
        type: 'offline-recovery-budget',
        loadingMs: Date.now() - began,
        ...result,
      });
      if (result.phase === 'unavailable') break;
    }
    await context.setOffline(false);
  }
  const until = Date.now() + duration * 1000;
  report.enduranceStarted = new Date().toISOString();
  let lastProgress = Date.now(),
    previousSignature = '';
  while (Date.now() < until) {
    await page.waitForTimeout(Math.min(10000, until - Date.now()));
    const value = await snapshot();
    assert.ok(value.nativeSurfaces <= 1, 'Only one native scene may remain mounted.');
    assert.ok(value.resources.ownedNativeScenes <= 1, 'Only one native scene may remain owned.');
    assert.equal(value.resources.practiceWorlds, 0, 'Watching cannot retain a practice world.');
    assert.notEqual(
      value.phase,
      'unavailable',
      'The rotation must keep demonstrating available modes.',
    );
    const signature = `${value.source}:${value.phase}:${value.tick}`;
    if (signature !== previousSignature) lastProgress = Date.now();
    assert.ok(Date.now() - lastProgress < 45000, 'Playback or recovery must keep making progress.');
    previousSignature = signature;
    report.samples.push({ at: new Date().toISOString(), workers: page.workers().length, ...value });
    if (report.samples.length > 800) report.samples.shift();
    if (report.samples.length % 6 === 0) await writeQualificationReport(reportPath, report);
  }
  report.enduranceFinished = new Date().toISOString();
  await page.locator('#demo-back').click();
  await page.waitForFunction(
    () => {
      const dialog = globalThis.document.querySelector('#demo-dialog');
      const resources = JSON.parse(dialog?.dataset.demoResources ?? '{}');
      return (
        !dialog?.querySelector('.demo-native-surface') &&
        resources.ownedNativeScenes === 0 &&
        resources.practiceWorlds === 0
      );
    },
    null,
    { timeout: 6000 },
  );
  assert.deepEqual(await storage(), before, 'Watching and return preserve player persistence.');
  assert.equal(await page.locator('.demo-native-surface').count(), 0);
  const retired = await snapshot();
  assert.equal(retired.resources.ownedNativeScenes, 0);
  assert.equal(retired.resources.practiceWorlds, 0);
  assert.equal(page.workers().length, baselineWorkers);
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  report.checks.push({
    type: 'return-and-persistence',
    workers: page.workers().length,
    resources: retired.resources,
  });
  report.complete = true;
} catch (error) {
  process.exitCode = 1;
  await diagnoseQualificationFailure({
    report,
    error,
    page,
    screenshotPath: reportPath.replace(/\.json$/, '.png'),
  });
} finally {
  const summary = await finishQualification({ report, reportPath, browser });
  if (!summary.complete) process.exitCode = 1;
}
