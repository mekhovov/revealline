/* global document, location, getComputedStyle */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  executeSharedModePublicReturn,
  assessSharedModePublicReturn,
} from './solo-qualification-shared-mode.mjs';

const planPath = new URL(
  '../docs/performance/solo-published-pages-smoke-plan.json',
  import.meta.url,
);
export const PAGES_ROOT = 'https://mekhovov.github.io/revealline/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function validatePagesSmokePlan(plan) {
  assert.equal(plan.format, 'RevealLinePublishedPagesSmokeV1');
  assert.equal(plan.root, PAGES_ROOT);
  assert.equal(plan.expectedDeployment, 'manual-main-github.sha');
  assert.equal(plan.ownerTimeoutMs, 600000);
  assert.equal(plan.outerTimeoutSeconds, 720);
  assert.equal(plan.jobTimeoutMinutes, 32);
  assert.equal(plan.flowTimeoutMs, 570000);
  assert.equal(plan.cleanupTimeoutMs, 10000);
  assert.equal(plan.sharedModeTimeoutMs, 180000);
  assert.equal(plan.reportBytes, 262144);
  assert.equal(plan.maximumEvents, 128);
  assert.equal(plan.retries, 0);
  assert.equal(plan.performanceExcluded, true);
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.deepEqual(plan.engines, ['chromium', 'webkit']);
  assert.equal(plan.profile, 'fresh-ephemeral');
  assert.equal(plan.credential, 'REVEALLINE_PAGES_TEST_PASSWORD');
  assert.equal(plan.credentialEntry, 'ordinary-public-password-form');
  assert.equal(plan.rssBytes, 6 * 1024 ** 3);
  assert.equal(plan.privateOutputBytes, 1024 ** 2);
  assert.equal(plan.privateEvidenceBytes, 4 * 1024 ** 2);
  assert.equal(plan.artifactBytes, 4 * 1024 ** 2);
  assert.equal(plan.metadataBytes, 16384);
  assert.equal(plan.manifestBytes, 1048576);
  assert.equal(plan.assetBytes, 2097152);
  assert.deepEqual(plan.assets, [
    'game/index.html',
    'game/access-gate.mjs',
    'game/app.mjs',
    'game/couch/index.html',
    'game/couch/relay-rescue.html',
  ]);
  assert.deepEqual(plan.flows, [
    'solo-direct-start-pause-resume',
    'missions-current-selection',
    'settings-demo-return',
    'team-versus-public-return',
  ]);
  return plan;
}
export async function pagesSmokePlan() {
  return validatePagesSmokePlan(JSON.parse(await readFile(planPath, 'utf8')));
}
export function redactPagesText(value, password, cap = 2048) {
  let text = String(value);
  if (password) {
    const variants = new Set([
      password,
      JSON.stringify(password).slice(1, -1),
      encodeURIComponent(password),
      encodeURI(password),
      Buffer.from(password).toString('base64'),
    ]);
    for (const item of [...variants].sort((a, b) => b.length - a.length))
      if (item) text = text.split(item).join('[redacted]');
  }
  return text.slice(0, cap);
}
export function safePagesURL(value, password) {
  try {
    const url = new URL(value);
    return redactPagesText(url.origin + url.pathname, password, 400);
  } catch {
    return '[invalid-url]';
  }
}
export function encodePagesReport(value, password, maximum = 262144) {
  // Redact before serialization so escaped call-log/form values cannot evade it.
  const clean = (item) => {
    if (typeof item === 'string') return redactPagesText(item, password, Number.MAX_SAFE_INTEGER);
    if (Array.isArray(item)) return item.map(clean);
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item).map(([key, child]) => [
          redactPagesText(key, password, 512),
          clean(child),
        ]),
      );
    return item;
  };
  const result = JSON.stringify(clean(value), null, 2) + '\n';
  assert(Buffer.byteLength(result) <= maximum, 'Pages smoke report byte cap');
  return result;
}
export function createPagesDiagnostics(page, password, maximum = 128) {
  const result = { events: [], total: 0, overflow: false };
  const add = (event) => {
    result.total++;
    if (result.events.length >= maximum) {
      result.overflow = true;
      return;
    }
    result.events.push(event);
  };
  const handlers = {
    pageerror: (error) =>
      add({ kind: 'pageerror', message: redactPagesText(error?.message, password, 1024) }),
    console: (message) => {
      if (['error', 'warning'].includes(message.type()))
        // Console arguments/text can contain arbitrary user state; retain only the type.
        add({ kind: 'console', type: message.type() });
    },
    requestfailed: (request) =>
      add({
        kind: 'requestfailed',
        url: safePagesURL(request.url(), password),
        resourceType: redactPagesText(request.resourceType(), password, 40),
        error: redactPagesText(request.failure()?.errorText ?? 'unavailable', password, 512),
      }),
    response: (response) => {
      if (response.status() >= 400)
        add({
          kind: 'http',
          status: response.status(),
          url: safePagesURL(response.url(), password),
        });
    },
  };
  for (const [name, handler] of Object.entries(handlers)) page.on(name, handler);
  return {
    result,
    detach() {
      for (const [name, handler] of Object.entries(handlers)) page.off(name, handler);
    },
  };
}
export function pagesBudget(timeoutMs, now = () => performance.now()) {
  const deadline = now() + timeoutMs;
  let stopped = false;
  const remaining = () => {
    assert(!stopped && now() < deadline, 'Pages smoke deadline expired');
    return deadline - now();
  };
  return {
    deadline,
    now,
    remaining,
    async step(label, work, cap = 10000) {
      const budget = Math.min(cap, remaining());
      let timer;
      try {
        const value = await Promise.race([
          Promise.resolve().then(() => {
            remaining();
            return work(budget);
          }),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              stopped = true;
              reject(new Error('Pages operation expired: ' + label));
            }, budget);
          }),
        ]);
        remaining();
        return value;
      } catch (error) {
        stopped = true;
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
async function boundedPublicRead(relative, cap, budget, fetchImpl) {
  return budget.step(
    'public identity ' + relative,
    async (timeout) => {
      const response = await fetchImpl(new URL(relative, PAGES_ROOT), {
        cache: 'no-store',
        redirect: 'error',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
        signal: AbortSignal.timeout(Math.max(1, Math.floor(timeout))),
      });
      assert.equal(response.status, 200, 'Public identity HTTP status');
      assert.equal(response.url, new URL(relative, PAGES_ROOT).href, 'Public identity redirect');
      let bytes = 0;
      const chunks = [];
      for await (const data of response.body) {
        bytes += data.length;
        assert(bytes <= cap, 'Public identity byte cap');
        chunks.push(data);
      }
      return Buffer.concat(chunks);
    },
    30000,
  );
}
export async function readPagesBinding(expected, budget, fetchImpl = fetch) {
  assert.match(expected, /^[a-f0-9]{40}$/);
  const metadataBytes = await boundedPublicRead('main-deployment.json', 16384, budget, fetchImpl);
  const metadata = JSON.parse(metadataBytes);
  assert.equal(metadata.format, 'revealline-main-deployment.v1');
  assert.equal(metadata.channel, 'main');
  assert.equal(metadata.sourceRevision, expected, 'Published source does not match this dispatch');
  assert.equal(metadata.buildVersion, 'main-' + expected.slice(0, 12));
  assert.equal(metadata.play, 'game/');
  const manifestBytes = await boundedPublicRead('manifest.json', 1048576, budget, fetchImpl);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.sourceRevision, expected);
  assert(Array.isArray(manifest.files) && manifest.files.length <= 10000);
  const plan = await pagesSmokePlan();
  const assets = [];
  for (const path of plan.assets) {
    const entries = manifest.files.filter((entry) => entry.path === path);
    assert.equal(entries.length, 1, 'Unique public inventory entry required');
    const entry = entries[0];
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= 2097152);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    const bytes = await boundedPublicRead(path, 2097152, budget, fetchImpl);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(hash(bytes), entry.sha256, 'Published critical asset digest');
    assets.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  return {
    sourceRevision: expected,
    buildVersion: metadata.buildVersion,
    metadata: { bytes: metadataBytes.length, sha256: hash(metadataBytes) },
    manifest: { bytes: manifestBytes.length, sha256: hash(manifestBytes) },
    assets,
    scope:
      'Five critical public files checked against this public manifest; not a full payload readback.',
  };
}
export function readPagesPublicState() {
  const visible = (element) =>
    Boolean(
      element &&
        element.isConnected &&
        !element.hidden &&
        !element.closest('[hidden]') &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden' &&
        element.getClientRects().length,
    );
  const text = (id) => (document.getElementById(id)?.textContent ?? '').trim().slice(0, 256);
  const control = (id) => {
    const element = document.getElementById(id);
    return {
      visible: visible(element),
      enabled: Boolean(element && !element.disabled),
      open: Boolean(element?.open),
    };
  };
  const ids = [
    'shell-home',
    'shell-featured',
    'mission-replace-dialog',
    'mode-leave-dialog',
    'journey-chooser',
    'journey-back',
    'shell-play',
    'start-button',
    'pause-button',
    'shell-menu',
    'settings-dialog',
    'settings-tab-extras',
    'shell-demo',
    'demo-dialog',
    'demo-back',
  ];
  const current = [...document.querySelectorAll('.journey-card[data-current="true"]')]
    .filter(visible)
    .map((element) => ({
      enabled: !element.disabled,
      availability: element.dataset.availabilityState,
    }));
  return {
    href: location.href,
    hidden: document.hidden,
    focused: document.hasFocus(),
    bootState: document.documentElement.dataset.bootState,
    bootHidden: document.getElementById('boot-screen')?.hidden === true,
    access: document.documentElement.dataset.accessState,
    flightState: document.body.dataset.flightState,
    time: text('time'),
    lives: text('lives'),
    coverage: text('coverage'),
    controls: Object.fromEntries(ids.map((id) => [id, control(id)])),
    journeyMode: document.getElementById('journey-mode')?.value,
    current,
    demoScene: document.getElementById('demo-dialog')?.dataset.scene,
    demoLevel: text('demo-level'),
    demoStatus: text('demo-status'),
  };
}
function foreground(state) {
  assert.equal(state.hidden, false, 'Public document hidden');
  assert.equal(state.focused, true, 'Public document not focused');
}
export async function executePagesSoloFlows(page, budget, record) {
  const read = async (cap = 10000) => {
    const state = await budget.step(
      'public state',
      () => page.evaluate(readPagesPublicState),
      Math.min(10000, cap),
    );
    foreground(state);
    assert(
      !state.controls['mission-replace-dialog'].open && !state.controls['mode-leave-dialog'].open,
      'Unexpected replacement/departure confirmation',
    );
    record.lastPublicState = state;
    return state;
  };
  const until = async (label, accept, cap = 60000) => {
    const end = Math.min(budget.deadline, budget.now() + cap);
    for (;;) {
      assert(budget.now() < end, 'Public state deadline: ' + label);
      const state = await read(end - budget.now());
      assert(budget.now() < end, 'Public state deadline: ' + label);
      if (accept(state)) return state;
      const remaining = end - budget.now();
      await budget.step(
        'public state wait',
        () => page.waitForTimeout(Math.min(100, remaining)),
        Math.min(1000, remaining),
      );
    }
  };
  const click = async (selector) => {
    await budget.step('public click ' + selector, (timeout) =>
      page.locator(selector).click({ timeout }),
    );
    record.actions.push(selector);
  };
  const visibleOpen = (s, id) => s.controls[id].visible && s.controls[id].open;
  const ready = await until(
    'Home',
    (s) => s.bootState === 'ready' && s.bootHidden && visibleOpen(s, 'shell-home'),
    120000,
  );
  record.samples.push({ phase: 'home', state: ready });
  assert(
    ready.controls['shell-featured'].visible && ready.controls['shell-featured'].enabled,
    'Fresh Home Direct Start required',
  );
  await click('#shell-featured');
  const running = await until(
    'Solo running',
    (s) => s.flightState === 'running' && !s.controls['start-button'].visible,
  );
  record.samples.push({
    phase: 'solo-running',
    state: await until(
      'Solo clock advancement',
      (s) => s.flightState === 'running' && s.time.length > 0 && s.time !== running.time,
    ),
  });
  await click('#pause-button');
  const paused = await until(
    'Solo paused',
    (s) => s.flightState === 'paused' && s.controls['start-button'].visible,
  );
  await budget.step('paused observation', () => page.waitForTimeout(500), 1500);
  const still = await read();
  assert.equal(still.flightState, 'paused');
  assert.equal(still.time, paused.time, 'Paused clock changed');
  assert.equal(still.lives, paused.lives);
  record.samples.push({ phase: 'solo-paused', state: still });
  await click('#start-button');
  const resumed = await until('Solo resumed', (s) => s.flightState === 'running');
  record.samples.push({
    phase: 'solo-resumed',
    state: await until(
      'Resumed clock advancement',
      (s) => s.flightState === 'running' && s.time !== resumed.time,
    ),
  });
  await click('#pause-button');
  await until('Pause for Missions', (s) => s.flightState === 'paused');
  await click('#shell-menu');
  await until('Home from pause', (s) => visibleOpen(s, 'shell-home'));
  await click('#shell-play');
  await until('Missions', (s) => visibleOpen(s, 'journey-chooser') && s.journeyMode === 'solo');
  await click('#journey-back');
  await until(
    'Missions return',
    (s) => !s.controls['journey-chooser'].open && visibleOpen(s, 'shell-home'),
  );
  await click('#shell-play');
  const chooser = await until(
    'Current mission',
    (s) => visibleOpen(s, 'journey-chooser') && s.current.length > 0,
  );
  assert.equal(chooser.current.length, 1, 'Exactly one current visible mission required');
  assert.equal(chooser.current[0].enabled, true);
  assert(
    ['included', 'ready'].includes(chooser.current[0].availability),
    'Current mission is not available',
  );
  await click('.journey-card[data-current="true"]:visible');
  const briefing = (s) =>
    !s.controls['journey-chooser'].open &&
    !s.controls['shell-home'].open &&
    !s.controls['mission-replace-dialog'].open &&
    s.flightState === 'briefing' &&
    s.controls['start-button'].visible &&
    s.controls['start-button'].enabled;
  record.samples.push({
    phase: 'mission-briefing',
    state: await until('Mission briefing', briefing),
  });
  await click('#shell-menu');
  await until('Home from briefing', (s) => visibleOpen(s, 'shell-home'));
  await click('#shell-options');
  const parent = await until('Settings', (s) => visibleOpen(s, 'settings-dialog'));
  assert(['briefing', 'paused'].includes(parent.flightState), 'Settings parent must be inactive');
  await click('#settings-tab-extras');
  await click('#shell-demo');
  const demo = await until(
    'Demo playing',
    (s) =>
      visibleOpen(s, 'demo-dialog') &&
      s.demoScene === 'playing' &&
      s.demoLevel.length > 0 &&
      s.demoStatus.length > 0,
  );
  record.samples.push({
    phase: 'demo-advanced',
    state: await until(
      'Demo public readout',
      (s) =>
        visibleOpen(s, 'demo-dialog') &&
        s.demoScene === 'playing' &&
        s.demoStatus !== demo.demoStatus,
    ),
  });
  await click('#demo-back');
  record.samples.push({
    phase: 'settings-restored',
    state: await until(
      'Settings restored',
      (s) =>
        !s.controls['demo-dialog'].open &&
        visibleOpen(s, 'settings-dialog') &&
        s.flightState === parent.flightState &&
        s.time === parent.time &&
        s.lives === parent.lives,
    ),
  });
}
export async function observePagesSmoke({
  engine,
  expectedRevision,
  password,
  browserType,
  checkpoint = async () => {},
  binding = readPagesBinding,
  soloFlows = executePagesSoloFlows,
  sharedFlows = executeSharedModePublicReturn,
  sharedAssessment = assessSharedModePublicReturn,
  now = () => performance.now(),
}) {
  assert(['chromium', 'webkit'].includes(engine), 'Fixed browser engine required');
  assert.match(expectedRevision, /^[a-f0-9]{40}$/);
  assert(
    typeof password === 'string' &&
      password.length > 0 &&
      password.length <= 512 &&
      !password.includes('\0'),
    'Protected Pages credential required',
  );
  const plan = await pagesSmokePlan();
  const budget = pagesBudget(plan.flowTimeoutMs, now);
  const report = {
    format: 'RevealLinePublishedPagesSmokeReportV1',
    status: 'incomplete',
    expectedRevision,
    engine,
    root: PAGES_ROOT,
    performanceExcluded: true,
    profile: 'fresh-ephemeral',
    scope: plan.limitations,
    stages: [],
    pages: [],
    cleanup: { context: 'not-created', browser: 'not-created' },
  };
  let browser, context;
  const observers = [];
  const retain = async () => checkpoint(JSON.parse(encodePagesReport(report, password)));
  const cleanup = async (name, work) => {
    let timer;
    try {
      await Promise.race([
        Promise.resolve().then(work),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(name + ' cleanup deadline')),
            plan.cleanupTimeoutMs,
          );
        }),
      ]);
      report.cleanup[name] = 'closed';
    } catch (error) {
      report.cleanup[name] = 'failed';
      report.cleanupFailure = redactPagesText(error?.message ?? error, password);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    report.bindingBefore = await binding(expectedRevision, budget);
    await retain();
    const env = { ...process.env };
    for (const key of [
      'REVEALLINE_PAGES_TEST_PASSWORD',
      'FPV_LIVE_TEST_PASSWORD',
      'DEBUG',
      'PWDEBUG',
      'NODE_OPTIONS',
    ])
      delete env[key];
    browser = await budget.step(
      'fresh browser',
      (timeout) =>
        browserType.launch({
          headless: true,
          timeout,
          env,
        }),
      60000,
    );
    report.cleanup.browser = 'pending';
    report.browserVersion = browser.version();
    assert(
      typeof report.browserVersion === 'string' &&
        report.browserVersion.length > 0 &&
        report.browserVersion.length <= 128,
      'Bounded actual browser version required',
    );
    context = await budget.step('fresh context', () =>
      browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
      }),
    );
    report.cleanup.context = 'pending';
    assert.equal(context.pages().length, 0, 'Fresh context unexpectedly contains a page');
    const page = await budget.step('new Solo page', () => context.newPage());
    assert.deepEqual(context.pages(), [page], 'Solo page ownership is ambiguous');
    const diagnostic = createPagesDiagnostics(page, password);
    observers.push(diagnostic);
    report.pages.push(diagnostic.result);
    await budget.step(
      'published Solo',
      (timeout) =>
        page.goto(PAGES_ROOT + 'game/?journey=whole-spatial-v25', {
          timeout,
          waitUntil: 'domcontentloaded',
        }),
      60000,
    );
    const field = page.locator('#access-gate input[type="password"]');
    await budget.step(
      'ordinary password form',
      (timeout) => field.waitFor({ state: 'visible', timeout }),
      60000,
    );
    assert.equal(
      page.url(),
      PAGES_ROOT + 'game/?journey=whole-spatial-v25',
      'Credential document changed before entry',
    );
    await budget.step('ordinary password entry', (timeout) => field.fill(password, { timeout }));
    assert.equal(
      page.url(),
      PAGES_ROOT + 'game/?journey=whole-spatial-v25',
      'Credential document changed before submission',
    );
    await budget.step('ordinary password submission', (timeout) =>
      page.locator('#access-gate button[type="submit"]').click({ timeout }),
    );
    await budget.step(
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
    report.solo = { actions: [], samples: [] };
    await soloFlows(page, budget, report.solo);
    report.stages.push(...plan.flows.slice(0, 3));
    await retain();
    await budget.step('close Solo page', () => page.close());
    assert.equal(context.pages().length, 0, 'Solo page did not close');
    const sharedPage = await budget.step('new shared-route page', () => context.newPage());
    assert.deepEqual(context.pages(), [sharedPage], 'Shared page ownership is ambiguous');
    const sharedDiagnostic = createPagesDiagnostics(sharedPage, password);
    observers.push(sharedDiagnostic);
    report.pages.push(sharedDiagnostic.result);
    await budget.step(
      'published shared starting route',
      (timeout) =>
        sharedPage.goto(PAGES_ROOT + 'game/?journey=legacy', {
          timeout,
          waitUntil: 'domcontentloaded',
        }),
      60000,
    );
    report.shared = {};
    await sharedFlows({
      page: sharedPage,
      deadline: Math.min(budget.deadline, now() + plan.sharedModeTimeoutMs),
      record: report.shared,
      now,
    });
    report.sharedAssessment = sharedAssessment(report.shared);
    report.stages.push('team-versus-public-return');
    await retain();
    report.bindingAfter = await binding(expectedRevision, budget);
    assert.deepEqual(
      report.bindingAfter,
      report.bindingBefore,
      'Published deployment changed during smoke',
    );
    assert(
      report.pages.every((item) => item.total === 0 && !item.overflow),
      'Page/resource/console diagnostics require review',
    );
    report.controlsComplete = true;
  } catch (error) {
    report.failure = redactPagesText(error?.message ?? error, password);
  } finally {
    if (context) await cleanup('context', () => context.close());
    if (browser) await cleanup('browser', () => browser.close());
    for (const observer of observers) observer.detach();
    if (!report.pages.every((item) => item.total === 0 && !item.overflow))
      report.failure ??= 'Page/resource/console diagnostics require review';
    report.status =
      report.controlsComplete && !report.failure && !report.cleanupFailure
        ? 'passed-controls'
        : 'failed';
    await retain();
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [expectedRevision, engine, playwrightPath, output] = process.argv.slice(2);
  const password = process.env.REVEALLINE_PAGES_TEST_PASSWORD;
  delete process.env.REVEALLINE_PAGES_TEST_PASSWORD;
  for (const key of ['DEBUG', 'PWDEBUG', 'NODE_OPTIONS']) delete process.env[key];
  try {
    const playwright = await import(pathToFileURL(playwrightPath).href);
    const report = await observePagesSmoke({
      expectedRevision,
      engine,
      password,
      browserType: playwright[engine],
      checkpoint: (value) => writeFile(output, encodePagesReport(value, password), { mode: 0o600 }),
    });
    process.exitCode = report.status === 'passed-controls' ? 0 : 1;
  } catch (error) {
    const failure = {
      format: 'RevealLinePublishedPagesSmokeReportV1',
      engine,
      status: 'failed',
      failure: redactPagesText(error?.message ?? error, password),
      controlsComplete: false,
    };
    try {
      await writeFile(output, encodePagesReport(failure, password), { mode: 0o600 });
    } catch {
      /* Parent retains missing report as failure. */
    }
    process.exitCode = 1;
  }
}
