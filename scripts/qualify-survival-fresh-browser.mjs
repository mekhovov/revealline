#!/usr/bin/env node
/** Local native Fresh regression; uses an installed browser and isolated storage. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import {
  survivalDemoInventory,
  survivalDemoCompiled,
  survivalDemoLaunchURL,
  SURVIVAL_DEMO_SEED,
} from '../game/demo-modes/survival-catalog.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const baseURL = args.url ?? 'http://127.0.0.1:8768';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname));
const runtime = args.runtime ?? 'playwright';
const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
const engine = args.browser ?? 'chromium';
const browser = await playwright[engine].launch({
  headless: true,
  ...(args.executable ? { executablePath: args.executable } : {}),
});
const report = {
  engine,
  started: new Date().toISOString(),
  checks: [],
  errors: [],
  events: [],
  complete: false,
};
const key = 'revealline.overflight.options.v1';
const saved = JSON.stringify({
  difficulty: 'veteran',
  airframes: 1,
  slowResume: false,
  characterId: 'interceptor',
  flightTraits: true,
});
try {
  const context = await browser.newContext();
  await context.exposeBinding('recordSurvivalFreshEvent', (...args) => {
    if (report.events.length < 64) report.events.push(args[1]);
  });
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
  await context.addInitScript(
    ({ key, saved }) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, saved);
      for (const type of ['error', 'unhandledrejection'])
        globalThis.addEventListener(type, (event) => {
          void globalThis
            .recordSurvivalFreshEvent({
              type,
              at: new Date().toISOString(),
              url: globalThis.location.href,
              message: String(event.reason?.stack ?? event.reason ?? event.message ?? ''),
            })
            .catch(() => {});
        });
    },
    { key, saved },
  );
  const page = await context.newPage();
  page.on('pageerror', (error) => {
    report.errors.push(String(error.stack ?? error));
    report.events.push({
      type: 'pageerror',
      at: new Date().toISOString(),
      message: String(error.stack ?? error),
    });
  });
  page.on('framenavigated', (frame) => {
    if (frame.parentFrame() === null)
      report.events.push({ type: 'navigation', at: new Date().toISOString(), url: frame.url() });
  });
  const snapshot = () => page.evaluate(() => globalThis.RevealLineOverflight.snapshot());
  const checkReady = async (entry) => {
    await page.waitForFunction(
      () => globalThis.RevealLineOverflight?.snapshot().phase === 'ready',
      null,
      { timeout: 30000 },
    );
    const state = await snapshot();
    assert.equal(state.summary.tick, 0);
    assert.equal(state.summary.projectIdentity, survivalDemoCompiled(entry).projectIdentity);
    assert.equal(state.summary.seed, SURVIVAL_DEMO_SEED);
    assert.equal(state.summary.airframes, 3);
    assert.equal(state.summary.flight.id, 'balanced');
    assert.equal(await page.locator('#difficulty').inputValue(), 'standard');
    assert.equal(await page.locator('#airframes').inputValue(), '3');
    assert.equal(await page.locator('#slow-resume').isChecked(), true);
    assert.equal(await page.locator('#flight-traits').isChecked(), false);
    assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), saved);
    return state.summary;
  };
  await page.goto(
    `${baseURL}/game/overflight/play.html?layout=${survivalDemoInventory()[0].levelId}&seed=42`,
  );
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await page.locator('#demo-button').waitFor({ state: 'visible', timeout: 30000 });
  const origin = await snapshot();
  assert.equal(origin.summary.seed, 42);
  assert.equal(origin.summary.airframes, 1);
  assert.equal(origin.summary.flight.id, 'interceptor');
  await page.locator('[data-mode-action="primary"]').click();
  if ((await snapshot()).phase === 'ready')
    await page.locator('[data-mode-action="start"]').click();
  await page.waitForFunction(() => globalThis.RevealLineOverflight.snapshot().phase === 'playing');
  await page.keyboard.press('Escape');
  await page.locator('#demo-button').waitFor({ state: 'visible' });
  const retained = await snapshot();
  await page.locator('#demo-button').click();
  await page.waitForFunction(
    () => globalThis.document.querySelector('#demo-dialog')?.dataset.demoPhase === 'playing',
    null,
    { timeout: 35000 },
  );
  const sourceId = await page.locator('#demo-dialog').getAttribute('data-demo-source');
  const entry = survivalDemoInventory().find((entry) => entry.id === sourceId);
  assert.ok(entry);
  await page.locator('#demo-interrupt').click();
  await page.locator('#demo-fresh').click();
  await page.locator('#overflight-change-cancel').click();
  const stayed = await snapshot();
  assert.deepEqual(stayed.summary, retained.summary);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), saved);
  report.checks.push({ type: 'stay-retains-original-sortie', ...stayed.summary });
  await page.locator('#demo-fresh').click();
  await page.locator('#overflight-change-accept').click();
  await page.waitForFunction(() => !globalThis.document.querySelector('#demo-dialog').open, null, {
    timeout: 30000,
  });
  report.checks.push({ type: 'same-page-standard-ready', ...(await checkReady(entry)) });
  // Normal Start must retain the effective session options instead of rebuilding
  // the Ready world from the saved veteran/one-airframe profile.
  await page.locator('[data-mode-action="primary"]').click();
  if ((await snapshot()).phase === 'ready')
    await page.locator('[data-mode-action="start"]').click();
  await page.waitForFunction(() => globalThis.RevealLineOverflight.snapshot().phase === 'playing');
  const started = await snapshot();
  assert.equal(started.summary.projectIdentity, survivalDemoCompiled(entry).projectIdentity);
  assert.equal(started.summary.seed, SURVIVAL_DEMO_SEED);
  assert.equal(started.summary.airframes, 3);
  assert.equal(started.summary.flight.id, 'balanced');
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), key), saved);
  report.checks.push({ type: 'manual-start-retains-standard', ...started.summary });
  const destination = new URL(survivalDemoLaunchURL(entry));
  report.events.push({ type: 'cross-page-navigation-request', at: new Date().toISOString() });
  await page.goto(`${baseURL}/game/overflight/play.html${destination.search}&seed=99`);
  await page.locator('#demo-button').waitFor({ state: 'visible', timeout: 30000 });
  report.checks.push({ type: 'cross-page-standard-ready', ...(await checkReady(entry)) });
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (error) {
  report.error = String(error.stack ?? error);
} finally {
  await browser.close();
}
report.finished = new Date().toISOString();
const path = args.report ?? `.cache/survival-fresh-${engine}.json`;
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    path,
    complete: report.complete,
    error: report.error,
    checks: report.checks.length,
  }),
);
if (!report.complete) process.exitCode = 1;
