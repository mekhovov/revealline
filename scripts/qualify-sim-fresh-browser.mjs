#!/usr/bin/env node
/** Local exact-source SIM Fresh regression with isolated custom aircraft tuning. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  diagnoseQualificationFailure,
  finishQualification,
} from './shared-demo-browser-report.mjs';
import {
  createTuningLibraryStore,
  TUNING_LIBRARY_KEY,
} from '../optional-practice/civilian-fpv/tuning-library.mjs';
import { pathToFileURL } from 'node:url';
import { pbkdf2Sync } from 'node:crypto';
import { readQualificationJSONDownload } from './shared-demo-download.mjs';

// Uses a supplied, already installed Playwright runtime; never installs browsers.
const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, '').split('=')),
);
const runtime = args.runtime ?? 'playwright';
const engine = args.browser ?? 'chromium';
const reportPath = args.report ?? `.cache/sim-fresh-${engine}.json`;
const report = {
  engine,
  started: new Date().toISOString(),
  checks: [],
  errors: [],
  complete: false,
};
let browser, page;
try {
  const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
  browser = await playwright[engine].launch({
    headless: true,
    ...(args.executable ? { executablePath: args.executable } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const savedValues = new Map();
  const tuning = createTuningLibraryStore({
    storage: {
      getItem: (key) => savedValues.get(key) ?? null,
      setItem: (key, value) => savedValues.set(key, value),
    },
  });
  await tuning.createPresetSetup({
    presetId: 'meteor75-analog-2022',
    setupId: 'custom-aircraft',
    profileId: 'starter-rates',
    rates: 'defaults',
  });
  const custom = tuning.effective();
  custom.response.rates.axes.roll.rate = 73;
  await tuning.saveAircraftConfiguration({
    setupId: 'custom-aircraft',
    newProfileId: 'custom-rates',
    advanced: custom.advanced,
    response: custom.response,
    camera: custom.camera,
  });
  const savedTuning = tuning.export();
  await context.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: TUNING_LIBRARY_KEY, value: savedTuning },
  );
  const catalog = JSON.parse(
    await readFile('optional-practice/civilian-fpv/demo-data/index.json'),
  ).entries;
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
  const snapshot = () =>
    page.locator('#demo-dialog').evaluate((node) => ({
      mode: node.dataset.demoMode,
      source: node.dataset.demoSource,
    }));
  const ready = () =>
    page.waitForFunction(
      () => globalThis.document.querySelector('#demo-dialog')?.dataset.demoPhase === 'playing',
      null,
      { timeout: 35000 },
    );
  for (const origin of ['sim', 'solo']) {
    await page.goto(
      `${baseURL}${origin === 'sim' ? '/optional-practice/fpv-worlds/index.html' : '/game/?journey=legacy'}`,
    );
    if (await page.getByLabel('Password', { exact: true }).isVisible()) {
      await page.getByLabel('Password', { exact: true }).fill('fixture-password');
      await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    }
    const button = origin === 'sim' ? '#demo-button' : '#shell-demo-all';
    await page.locator(button).waitFor({ state: 'visible', timeout: 30000 });
    await page.locator(button).click();
    await ready();
    for (let i = 0; i < 8 && (await snapshot()).mode !== 'sim'; i++) {
      const previous = (await snapshot()).source;
      await page.locator('#demo-next').click();
      await page.waitForFunction(
        (previous) =>
          globalThis.document.querySelector('#demo-dialog')?.dataset.demoSource !== previous,
        previous,
      );
      await ready();
    }
    const source = await snapshot();
    assert.equal(source.mode, 'sim');
    await page.locator('#demo-interrupt').click();
    await page.locator('#demo-fresh').click();
    if (origin === 'solo') await page.waitForURL('**/optional-practice/fpv-worlds/index.html?**');
    await page.waitForFunction(
      () => {
        const snapshot = globalThis.fpvWorldStudio?.snapshot();
        return (
          snapshot?.state?.status === 'disarmed' &&
          globalThis.document.querySelector('#flight-dialog')?.open
        );
      },
      null,
      { timeout: 30000 },
    );
    const fresh = await page.evaluate(() => globalThis.fpvWorldStudio.snapshot());
    assert.equal(fresh.state.ticks, 0);
    assert.equal(fresh.replay, null);
    assert.ok(source.source.includes(fresh.course));
    await page.waitForTimeout(750);
    const after = await page.evaluate(() => globalThis.fpvWorldStudio.snapshot());
    assert.equal(after.state.ticks, 0);
    assert.equal(after.state.status, 'disarmed');
    const exported = await readQualificationJSONDownload({
      page,
      trigger: () => page.locator('#export-flight').evaluate((node) => node.click()),
    });
    const proof = exported.records[0].proof;
    const expected = catalog.find((row) => `sim:${row.id}` === source.source).proof;
    assert.equal(proof.courseIdentity, expected.courseIdentity);
    assert.equal(proof.mode, expected.mode);
    assert.equal(proof.responseIdentity, expected.responseIdentity);
    assert.deepEqual(proof.response, expected.response);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), TUNING_LIBRARY_KEY),
      savedTuning,
    );
    report.checks.push({
      type: 'fresh-start-exact-authored-setup-ready-disarmed',
      origin,
      course: fresh.course,
      mode: proof.mode,
      ticks: after.state.ticks,
      courseIdentity: proof.courseIdentity,
      responseIdentity: proof.responseIdentity,
      savedCustomAircraftTuningUnchanged: true,
    });
  }
  assert.equal(report.errors.length, 0, report.errors.join('\n'));
  report.complete = true;
} catch (error) {
  await diagnoseQualificationFailure({
    report,
    error,
    page,
    screenshotPath: reportPath.replace(/\.json$/, '.png'),
  });
} finally {
  await finishQualification({ report, reportPath, browser });
}
if (!report.complete) process.exitCode = 1;
