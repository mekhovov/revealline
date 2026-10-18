#!/usr/bin/env node
/* global window, document, CSS */
import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  captureCDPListeners,
  diffCDPListeners,
  installPausedOriginProbe,
} from './shared-demo-listener-probe.mjs';
import { finishQualification } from './shared-demo-browser-report.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const equals = arg.indexOf('=');
    return [arg.slice(2, equals), arg.slice(equals + 1)];
  }),
);
const baseURL = args.url ?? 'http://127.0.0.1:8769';
const reportPath = args.report ?? 'docs/qualification/shared-demos/listener-cleanup-final.json';
const runtime = args.runtime ?? 'playwright';
const modes = ['sim', 'snake', 'solo', 'survival'];
const started = Date.now();
const report = {
  format: 'SharedDemoDirectListenerQualificationV1',
  started: new Date(started).toISOString(),
  complete: false,
  declaredRuntimeFingerprint: args.fingerprint ?? null,
  checks: [],
  errors: [],
  samples: [],
  instrumentation: {
    observer: 'scripts/shared-demo-listener-probe.mjs',
    methods: ['install', 'read'],
    ownership:
      'One Phaser constructor observer retains only a WeakRef to the first ordinary game and reads its existing lastPaint.run through authoritativeCheckpoint. No listeners, painter wrappers, scheduling hooks or demo-world references are added.',
    baseline:
      'Closed after all four modes have played, including persistent host/module initialization and the observer.',
    CDP: 'DOMDebugger.getEventListeners on window, document, body and every stable element with an ID in the demo panel, plus ordinary canvases. Node backend IDs filter out descendants. Every root and handler object handle is released after inspection.',
  },
  limitations: [
    'Direct attached-target listeners and explicit owner counters only; detached nodes, browser internals and driver/GPU allocations are not exhaustively measured.',
    'No heap dump, forced garbage collection, video, trace or memory total is used.',
    'Normal initialized host listeners and the originating paused game remain intentionally owned.',
  ],
};
let browser, context, page, protocol, timer;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const paths = [
  'game/app.mjs',
  'game/ui/demo-host.mjs',
  'game/ui/demo-entry.mjs',
  'game/demo-director.mjs',
  'game/ui/demo-clock.mjs',
  'game/demo-rotation.mjs',
  'game/demo-prefetch.mjs',
  'game/demo-registry.mjs',
  'game/ui/demo-input.mjs',
  'game/demo-modes/solo.mjs',
  'game/demo-modes/solo-view.mjs',
  'game/demo-modes/snake.mjs',
  'game/demo-modes/sim.mjs',
  'game/demo-modes/survival.mjs',
  'game/overflight/renderer.mjs',
  'game/ui/owned-phaser-game.mjs',
  'scripts/qualify-shared-demo-listeners.mjs',
  'scripts/shared-demo-listener-probe.mjs',
];
const fingerprint = async () => {
  const files = [];
  for (const path of paths) {
    const bytes = await readFile(new URL(`../${path}`, import.meta.url));
    files.push({ path, bytes: bytes.length, sha256: sha(bytes) });
  }
  return {
    scope:
      'Principal shared runtime/adapter modules and this probe; full reviewed runtime fingerprint, when supplied, is declared separately.',
    sha256: sha(JSON.stringify(files)),
    files,
  };
};
const readStorage = () =>
  page.evaluate(() =>
    Object.fromEntries(
      ['localStorage', 'sessionStorage'].map((name) => [
        name,
        Object.fromEntries(
          Object.keys(window[name])
            .sort()
            .map((key) => [key, window[name].getItem(key)]),
        ),
      ]),
    ),
  );
const summarizeStorage = (value) => ({
  sha256: sha(JSON.stringify(value)),
  keys: Object.fromEntries(
    Object.entries(value).map(([name, items]) => [name, Object.keys(items)]),
  ),
});
const ordinary = () => page.evaluate(() => window.sharedDemoPausedOriginProbe.read());
const snapshot = () =>
  page.evaluate(() => {
    const dialog = document.getElementById('demo-dialog');
    return {
      open: dialog.open,
      mode: dialog.dataset.demoMode,
      source: dialog.dataset.demoSource,
      phase: dialog.dataset.demoPhase,
      tick: dialog.dataset.demoTick,
      failure: dialog.dataset.demoFailure,
      resources: JSON.parse(dialog.dataset.demoResources ?? '{}'),
      nativeSurfaces: document.querySelectorAll('.demo-native-surface').length,
      canvases: [...document.querySelectorAll('canvas')].map((canvas) => ({
        id: canvas.id,
        width: canvas.width,
        height: canvas.height,
        insideDemo: !!canvas.closest('#demo-dialog'),
      })),
    };
  });
const ready = () =>
  page.waitForFunction(
    () => document.getElementById('demo-dialog')?.dataset.demoPhase === 'playing',
    null,
    { timeout: 31000 },
  );
const assertPlaying = async (label) => {
  await ready();
  const value = await snapshot();
  assert.ok(modes.includes(value.mode), 'Only the four eligible modes are observed.');
  assert.ok(value.nativeSurfaces <= 1);
  assert.ok(value.resources.ownedNativeScenes <= 1);
  assert.equal(value.resources.practiceWorlds, 0);
  // Every adopted surface must demonstrate an actually advancing native clock.
  await page.waitForFunction(
    (tick) => document.getElementById('demo-dialog')?.dataset.demoTick !== tick,
    value.tick,
    { timeout: 3000 },
  );
  report.samples.push({
    label,
    ...(await snapshot()),
    workers: page.workers().map((worker) => worker.url()),
  });
  return value.mode;
};
const close = async () => {
  await page.locator('#demo-back').click();
  await page.waitForFunction(
    () => {
      const dialog = document.getElementById('demo-dialog');
      if (dialog?.open || dialog?.querySelector('.demo-native-surface')) return false;
      let demo;
      try {
        demo = window.RevealLineSoloPerformance?.export()?.resources?.demo;
      } catch {
        return false;
      }
      return (
        demo &&
        demo.scenes === 0 &&
        demo.practiceWorlds === 0 &&
        demo.pendingSourceLoads === 0 &&
        demo.pendingPreparations === 0 &&
        demo.workers.observedHandles === 0
      );
    },
    null,
    { timeout: 6000 },
  );
};
const targets = async () =>
  page.evaluate(() => {
    const result = [
      { label: 'window', expression: 'window' },
      { label: 'document', expression: 'document', node: true },
      { label: 'body', expression: 'document.body', node: true },
    ];
    const nodes = [
      ...document.querySelectorAll(
        '#demo-dialog, #demo-dialog [id], canvas:not(#demo-dialog canvas)',
      ),
    ];
    for (const node of nodes) {
      const parts = [];
      let current = node;
      while (current && !current.id) {
        parts.unshift(
          `${current.tagName.toLowerCase()}:nth-child(${[...current.parentElement.children].indexOf(current) + 1})`,
        );
        current = current.parentElement;
      }
      if (!current) throw Error('Listener owner lacks a stable attached ancestor.');
      parts.unshift(`#${CSS.escape(current.id)}`);
      const selector = parts.join(' > ');
      result.push({
        label: selector,
        expression: `document.querySelector(${JSON.stringify(selector)})`,
        node: true,
      });
    }
    return result;
  });
const closedSnapshot = async (label, owners) => ({
  label,
  at: new Date().toISOString(),
  listeners: await captureCDPListeners(protocol, owners),
  ordinary: await ordinary(),
  view: await snapshot(),
  owned: await page.evaluate(() => window.RevealLineSoloPerformance.export().resources.demo),
  workers: page.workers().map((worker) => worker.url()),
  storage: summarizeStorage(await readStorage()),
});

async function run() {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname));
  report.source = await fingerprint();
  const freezePath = args.manifest ?? 'docs/qualification/shared-demos/source-freeze-latest.json';
  report.freezeManifest = JSON.parse(await readFile(freezePath, 'utf8'));
  if (args.fingerprint) assert.equal(report.freezeManifest.sourceFingerprint, args.fingerprint);
  await mkdir(dirname(reportPath), { recursive: true });
  const playwright = await import(runtime.startsWith('/') ? pathToFileURL(runtime).href : runtime);
  browser = await playwright.chromium.launch({
    headless: true,
    timeout: 15000,
    ...(args.executable ? { executablePath: args.executable } : {}),
    args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'],
  });
  report.browserVersion = browser.version();
  context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  context.setDefaultTimeout(10000);
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
    if (report.errors.length < 32) report.errors.push(String(error.stack ?? error).slice(0, 2000));
  });
  await page.addInitScript(installPausedOriginProbe);
  await page.goto(`${baseURL}/game/?journey=legacy&performance=1`);
  await page.getByLabel('Password', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await page.locator('#shell-featured').waitFor({ state: 'visible', timeout: 30000 });
  await page.evaluate(async () => {
    const { authoritativeCheckpoint } = await import('/game/replay.mjs');
    window.sharedDemoPausedOriginProbe.install(authoritativeCheckpoint);
  });
  await page.locator('#shell-featured').click();
  await page.waitForFunction(() => document.body.dataset.flightState === 'running');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.dataset.flightState === 'paused');
  await page.locator('#shell-menu').click();
  await page.locator('#shell-demo-all').waitFor({ state: 'visible' });
  const origin = await ordinary();
  assert.equal(origin.phase, 'paused');
  assert.ok(origin.tick > 0, 'A real ordinary run must advance before being paused.');
  const saved = await readStorage();
  protocol = await context.newCDPSession(page);
  await page.locator('#shell-demo-all').click();
  const warmModes = new Set();
  for (let count = 0; count < 12 && warmModes.size < 4; count++) {
    if (count) await page.locator('#demo-next').click();
    warmModes.add(await assertPlaying(`warm-${count}`));
  }
  assert.deepEqual([...warmModes].sort(), modes);
  await close();
  const owners = await targets();
  const baseline = await closedSnapshot('warmed-baseline', owners);
  assert.deepEqual(baseline.ordinary, origin);
  assert.deepEqual(await readStorage(), saved);
  assert.equal(baseline.owned.scenes, 0);
  assert.equal(baseline.owned.practiceWorlds, 0);
  report.baseline = baseline;
  report.checks.push({
    type: 'all-four-modes-warmed',
    modes: [...warmModes].sort(),
    targets: owners.length,
  });
  const observedModes = new Set();
  for (let cycle = 0; cycle < 3; cycle++) {
    await page.locator('#shell-demo-all').click();
    observedModes.add(await assertPlaying(`cycle-${cycle}-open`));
    for (let transition = 0; transition < 4; transition++) {
      await page.locator('#demo-next').click();
      observedModes.add(await assertPlaying(`cycle-${cycle}-next-${transition}`));
    }
    await close();
    const after = await closedSnapshot(`cycle-${cycle}-closed`, owners);
    const listenerDelta = diffCDPListeners(baseline.listeners, after.listeners);
    report.checks.push({ type: 'closed-baseline-comparison', cycle, listenerDelta, ...after });
    assert.deepEqual(
      listenerDelta,
      [],
      'Direct attached-owner listener signatures must return to the warmed baseline.',
    );
    // The retained Solo display resizes for the last authored board. Its
    // owner/count must persist, while every ordinary canvas keeps its size.
    const canvasOwners = (rows) =>
      rows.map(({ width, height, ...row }) => (row.insideDemo ? row : { ...row, width, height }));
    assert.deepEqual(canvasOwners(after.view.canvases), canvasOwners(baseline.view.canvases));
    assert.equal(after.view.nativeSurfaces, 0);
    assert.equal(after.owned.scenes, 0);
    assert.equal(after.owned.practiceWorlds, 0);
    assert.equal(after.owned.pendingSourceLoads, 0);
    assert.equal(after.owned.pendingPreparations, 0);
    assert.equal(after.owned.ownedHostListeners, baseline.owned.ownedHostListeners);
    assert.equal(after.owned.workers.observedHandles, 0);
    assert.deepEqual(after.workers, baseline.workers);
    assert.deepEqual(
      after.ordinary,
      origin,
      'The exact paused ordinary checkpoint and owner must survive every cycle.',
    );
    assert.deepEqual(
      await readStorage(),
      saved,
      'Demo use cannot change local or session persistence.',
    );
  }
  assert.deepEqual([...observedModes].sort(), modes);
  assert.deepEqual(
    await fingerprint(),
    report.source,
    'Observed runtime/probe files changed during qualification.',
  );
  assert.deepEqual(
    JSON.parse(await readFile(freezePath, 'utf8')),
    report.freezeManifest,
    'Reviewed runtime freeze changed during qualification.',
  );
  assert.deepEqual(report.errors, []);
  report.transitionsAfterWarmup = 12;
  report.observedModesAfterWarmup = [...observedModes].sort();
  report.elapsedMs = Date.now() - started;
  report.complete = true;
}
try {
  await Promise.race([
    run(),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Listener qualification exceeded its 170-second budget.')),
        170000,
      );
    }),
  ]);
} catch (error) {
  process.exitCode = 1;
  report.complete = false;
  report.failure = String(error.stack ?? error).slice(0, 8192);
} finally {
  clearTimeout(timer);
  const summary = await finishQualification({ report, reportPath, browser });
  if (!summary.complete) process.exitCode = 1;
}
