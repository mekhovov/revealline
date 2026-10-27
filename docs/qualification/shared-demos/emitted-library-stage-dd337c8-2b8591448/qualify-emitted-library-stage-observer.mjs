/* global document, window, location, IDBObjectStore, getComputedStyle */
import assert from 'node:assert/strict';
import { fingerprintDemoSources } from '../scripts/demo-source-fingerprint.mjs';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { finishQualification, writeQualificationReport } from '../scripts/shared-demo-browser-report.mjs';
import {
  playerPersistenceMutations,
  mutationSignatures,
  unexpectedBootMutations,
  restoredFromBFCache,
  browserErrorDescription,
  restorationDiagnosticGate,
} from '../scripts/demo-restoration-observation.mjs';
import { startProductionPreview } from '../scripts/serve-production-preview.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const split = arg.indexOf('=');
    return [arg.slice(2, split), arg.slice(split + 1)];
  }),
);
assert.equal(args.run, 'approved');
assert.equal(args.browser, 'webkit');
assert.equal(args.mode, 'solo');
assert.ok(args['emitted-preview']);
const engine = args.browser;
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'Choose a supported browser.');
assert.ok(
  args.runtime && args.executable && args.report,
  'Supply runtime, executable and a new report path.',
);
const port = Number(args.port ?? 8771);
assert.ok(Number.isSafeInteger(port) && port > 1024 && port <= 65535);
const ordinaryReloads = Number(args['ordinary-reloads'] ?? 1);
assert.ok(Number.isSafeInteger(ordinaryReloads) && ordinaryReloads >= 1 && ordinaryReloads <= 8);
assert.ok(!args.mode || ['solo', 'snake', 'sim', 'survival'].includes(args.mode));
if (Object.hasOwn(args, 'emitted-preview'))
  assert.ok(args['emitted-preview'], 'Supply a nonempty emitted-preview directory.');
const base = `http://127.0.0.1:${port}`;
const reportPath = args.report;
try {
  await lstat(reportPath);
  throw new Error('Refusing to replace an existing qualification receipt. Use a new report path.');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const sha = (value) => createHash('sha256').update(value).digest('hex');
const manifestPath = 'docs/qualification/shared-demos/source-freeze-latest.json';
const manifest = JSON.parse(await readFile(manifestPath));
const observerPreparation = JSON.parse(await readFile('.cache/emitted-library-stage-observer/preparation.json'));
const projections = new Map();
for (const pin of observerPreparation.projections) {
  const body = await readFile(pin.projection.path);
  assert.equal(sha(body), pin.projection.sha256);
  assert.equal(body.length, pin.projection.bytes);
  projections.set('/' + pin.path, { body, pin });
}
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), observerPreparation.head);
assert.equal(args['emitted-preview'], observerPreparation.capture, 'Use the explicitly projected capture.');
assert.equal(sha(await readFile(observerPreparation.capture + '/manifest.json')), observerPreparation.captureManifestSHA256);
assert.equal(sha(await readFile(observerPreparation.durableHarness.path)), observerPreparation.durableHarness.sha256);
const runtimeBefore = await fingerprintDemoSources(process.cwd());
assert.equal(runtimeBefore.sha256, manifest.sourceFingerprint);
assert.equal(runtimeBefore.files, manifest.files);
assert.equal(runtimeBefore.bytes, manifest.bytes);
const manifestBytesBefore = await readFile(manifestPath);
const report = {
  diagnosticOnly: true, observerPreparation, runtimeBefore, projectionResponses: [],
  format: 'SharedDemoEmittedLibraryStageDiagnosticV1',
  engine,
  started: new Date().toISOString(),
  complete: false,
  source: {
    binding:
      'The declared frozen manifest is checked before and after; this probe does not independently recompute the complete source tree fingerprint.',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    manifestPath,
    ...manifest,
  },
  probe: {
    path: '.cache/qualify-emitted-library-stage-observer.mjs',
    sha256: sha(await readFile(new URL(import.meta.url))),
    helperSHA256: sha(
      await readFile(new URL('../scripts/demo-restoration-observation.mjs', import.meta.url)),
    ),
  },
  functionalComplete: false,
  strictDiagnosticGate: false,
  checks: [],
  errors: [],
  bfcache: [],
  instrumentation:
    'Ephemeral init observers wrap Storage mutations and IndexedDB object-store writes without changing arguments/results. A context binding retains bounded mutation/lifecycle metadata across reload. A separate task-owned preview serves ' +
    (args['emitted-preview'] ? 'the verified emitted inventory' : 'unchanged frozen runtime') +
    ' with fixture credentials and public,max-age=0,must-revalidate headers. No Playwright routing is installed; a minimal away page is served by this test-only server.',
  limitations: [
    ...(args['emitted-preview']
      ? [
          'The preview serves the verified emitted inventory, with only the declared local HTML access-credential exception. This run does not establish offline HTML integrity; service workers are observed, never blocked or unregistered.',
        ]
      : []),
    'Reload is not browser discard; no actual discard is claimed.',
    'BFCache is proved only by pageshow.persisted=true and the original document identity; failed admission is reported separately.',
    'Solo explicitly suspends Demo on pagehide, including persisted history navigation, in inherited upstream app.mjs behavior. A paused watching return documents that policy; it does not prove preservation of playing intent through freeze/resume.',
    'Fresh ephemeral test profiles exercise ordinary entry and compare a control reload. This does not replay every possible saved-game recovery state.',
    'Read/write observers detect API calls, not every browser-internal storage mechanism. Existing persistence and saved-flight tests remain complementary.',
    'Background managed-media asset-cache writes (game/managed-media-store.mjs) are recorded separately from player progress, saves, recovery and tuning; the ordinary app can preload those assets independently of Demo.',
  ],
};
report.instrumentation += ' Diagnostic-only exception: the three response bodies listed in observerPreparation are replaced by synchronous observation projections of their exact emitted originals. Native calls, results, thrown values and original readiness/test deadlines are unchanged. This is not an uninstrumented qualification pass.';
report.limitations.unshift(...observerPreparation.limits);
const entries = [
  { mode: 'solo', url: '/game/?journey=legacy', button: '#shell-demo' },
  {
    mode: 'snake',
    url: '/game/snake/play.html?level=classic-snake-open-loop&ready=1',
    button: '#demo-button',
  },
  { mode: 'sim', url: '/optional-practice/fpv-worlds/index.html', button: '#demo-button' },
  {
    mode: 'survival',
    url: '/game/overflight/play.html?layout=field-crossing-shelterbelt-gaps',
    button: '#demo-button',
  },
];
let browser, page, context, timer, preview;
let stage = 'boot',
  currentMode = null;
const events = [];
const snapshot = () =>
  page.evaluate(() => {
    const d = document.querySelector('#demo-dialog');
    return {
      documentId: window.demoRestorationObservation.id,
      open: d?.open ?? false,
      practice: d?.classList.contains('is-practice') ?? false,
      phase: d?.dataset.demoPhase ?? null,
      mode: d?.dataset.demoMode ?? null,
      tick: d?.dataset.demoTick ?? null,
      bodyState: document.body.dataset.flightState ?? null,
      bootState: document.documentElement.dataset.bootState ?? null,
      bootStatus: document.querySelector('#boot-status')?.textContent?.slice(0,1000) ?? null,
      activeElement: document.activeElement?.id ?? null,
      warning: document.querySelector('#warning')?.textContent?.slice(0,1000) ?? null,
      libraryStages: window.demoLibraryStageRows ?? [],
      menus: ['shell-menu','overlay-menu'].map(id => {
        const node = document.getElementById(id), rect = node?.getBoundingClientRect();
        return { id, rect: rect?.toJSON() ?? null, display: node ? getComputedStyle(node).display : null, visibility: node ? getComputedStyle(node).visibility : null, hit: rect ? document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.id ?? null : null };
      }),
      dialogs: [...document.querySelectorAll('dialog[open]')].map((n) => n.id).sort(),
      nativeSurfaces: document.querySelectorAll('.demo-native-surface').length,
      ...(window.demoRestorationServiceWorkers
        ? {
            serviceWorkers: {
              ...window.demoRestorationServiceWorkers,
              controller: window.navigator.serviceWorker?.controller
                ? {
                    scriptURL: window.navigator.serviceWorker.controller.scriptURL,
                    state: window.navigator.serviceWorker.controller.state,
                  }
                : null,
            },
          }
        : {}),
      lifecycle: window.demoRestorationObservation.lifecycle,
      navigation: performance.getEntriesByType('navigation').map((n) => ({
        type: n.type,
        notRestoredReasons: n.notRestoredReasons?.toJSON?.() ?? null,
      })),
    };
  });
const storage = () =>
  page.evaluate(() =>
    Object.fromEntries(
      ['localStorage', 'sessionStorage'].map((name) => [
        name,
        Object.fromEntries(
          Object.keys(window[name])
            .sort()
            .map((k) => [k, window[name].getItem(k)]),
        ),
      ]),
    ),
  );
const summarizedStorage = (value) => ({
  sha256: sha(JSON.stringify(value)),
  keys: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Object.keys(v)])),
});
const mutations = (start) => events.slice(start).filter((e) => e.kind === 'mutation');
const playerMutations = playerPersistenceMutations;
const signature = mutationSignatures;
const setStage = async (value) => {
  stage = value;
  await page.evaluate(() => Promise.resolve());
};
async function ordinaryEntry(entry, { openMenu = false } = {}) {
  const password = page.getByLabel('Password', { exact: true });
  if (await password.isVisible()) {
    await password.fill('fixture-password');
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  }
  const menu = {
    solo: '#shell-menu',
    snake: '#snake-action-menu',
    sim: '#worlds-shell-action-menu',
    survival: '#overflight-action-menu',
  }[entry.mode];
  await page.waitForFunction(
    ({ button, menu }) => {
      if (globalThis.RevealLineBoot && document.documentElement.dataset.bootState !== 'ready')
        return false;
      const visible = (node) =>
        !!node?.getClientRects().length && getComputedStyle(node).visibility !== 'hidden';
      return (
        visible(document.querySelector(button)) ||
        (visible(document.querySelector(menu)) && !document.querySelector('dialog[open]'))
      );
    },
    { button: entry.button, menu },
    { timeout: 30000 },
  );
  if (openMenu && !(await page.locator(entry.button).isVisible())) {
    try {
      await page.locator(menu).click({ timeout: 3000 });
    } catch (error) {
      if (!(await page.locator(entry.button).isVisible())) throw error;
    }
  }
  if (openMenu) await page.locator(entry.button).waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(450);
  const state = await snapshot();
  assert.equal(state.open, false, 'Reload must enter ordinary mode, not resume Demo.');
  assert.equal(state.practice, false, 'Reload must not reconstruct practice.');
  assert.equal(state.nativeSurfaces, 0, 'No demo native scene survives reload.');
  return state;
}
async function startDemo(entry, practice) {
  await ordinaryEntry(entry, { openMenu: true });
  await page.locator(entry.button).click();
  await page.waitForFunction(
    () => document.querySelector('#demo-dialog')?.dataset.demoPhase === 'playing',
    null,
    { timeout: 31000 },
  );
  const shown = await snapshot();
  assert.equal(shown.mode, entry.mode);
  await page.waitForFunction(
    (tick) => document.querySelector('#demo-dialog')?.dataset.demoTick !== tick,
    shown.tick,
    { timeout: 3500 },
  );
  if (practice) {
    await page.locator('#demo-interrupt').click();
    await page.locator('#demo-takeover').click();
    await page.waitForFunction(
      () => document.querySelector('#demo-dialog')?.classList.contains('is-practice'),
      null,
      { timeout: 15000 },
    );
    const fork = await snapshot();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(
      (tick) => document.querySelector('#demo-dialog')?.dataset.demoTick !== tick,
      fork.tick,
      { timeout: 3500 },
    );
  }
  return snapshot();
}
try {
  preview = await startProductionPreview({
    root: process.cwd(),
    port,
    fixtureAccess: true,
    cache: 'revalidate',
    emittedPreview: args['emitted-preview'],
    verifyEmittedSource: !!args['emitted-preview'],
  });
  const originalHandlers = preview.server.listeners('request');
  preview.server.removeAllListeners('request');
  preview.server.on('request', (request, response) => {
    const projected = projections.get(request.url.split('?')[0]);
    if (projected && ['GET', 'HEAD'].includes(request.method)) {
      if (report.projectionResponses.length < 40)
        report.projectionResponses.push({ path: projected.pin.path, at: Date.now(), sha256: projected.pin.projection.sha256 });
      response.writeHead(200, { ...preview.headers, 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' });
      response.end(request.method === 'HEAD' ? undefined : projected.body);
    } else if (request.url.startsWith('/demo-restoration-away')) {
      response.writeHead(200, {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      });
      response.end(
        '<!doctype html><title>Restoration probe away page</title><p>Temporary qualification page.</p>',
      );
    } else for (const handle of originalHandlers) handle(request, response);
  });
  report.preview = {
    port,
    cache: preview.cache,
    mode: preview.mode,
    headers: preview.headers,
    fixtureAccess: preview.fixtureAccess,
    ...(preview.emittedPreview ? { emittedPreview: preview.emittedPreview } : {}),
  };
  if (args['emitted-preview']) {
    assert.ok(preview.emittedPreview, 'The requested emitted preview must be admitted.');
    assert.equal(preview.emittedPreview.sourceVerified, true, 'Emitted source must be verified.');
  }
  const response = await fetch(base + '/game/');
  assert.equal(response.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  report.preview.observedCacheControl = response.headers.get('cache-control');
  const { [engine]: launcher } = await import(pathToFileURL(args.runtime).href);
  browser = await launcher.launch({
    headless: true,
    executablePath: args.executable,
    ...(engine === 'chromium'
      ? {
          ignoreDefaultArgs: ['--disable-back-forward-cache'],
          args: ['--disk-cache-size=1048576', '--media-cache-size=1048576'],
        }
      : {}),
  });
  report.browserVersion = browser.version();
  timer = setTimeout(() => {
    report.failure ??= 'Restoration qualification exceeded 240 seconds.';
    void browser.close();
  }, 240000);
  for (const entry of entries.filter((entry) => !args.mode || entry.mode === args.mode)) {
    currentMode = entry.mode;
    stage = 'boot';
    context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    await context.exposeBinding('reportDemoRestorationEvent', (_source, event) => {
      if (events.length < 3000) events.push({ mode: currentMode, stage, ...event });
      else report.eventOverflow = (report.eventOverflow ?? 0) + 1;
    });
    if (args['emitted-preview'])
      await context.addInitScript(() => {
        const serviceWorker = window.navigator.serviceWorker;
        const observation = {
          supported: !!serviceWorker,
          pending: false,
          observedAt: null,
          registrations: null,
          error: null,
        };
        window.demoRestorationServiceWorkers = observation;
        const observe = () => {
          if (!serviceWorker || observation.pending) return;
          observation.pending = true;
          void serviceWorker.getRegistrations().then(
            (registrations) => {
              observation.pending = false;
              observation.observedAt = Date.now();
              observation.registrations = registrations.map((registration) => ({
                scope: registration.scope,
                installing: registration.installing?.scriptURL ?? null,
                waiting: registration.waiting?.scriptURL ?? null,
                active: registration.active?.scriptURL ?? null,
              }));
              observation.error = null;
            },
            (error) => {
              observation.pending = false;
              observation.observedAt = Date.now();
              observation.error = `${error.name}: ${error.message}`.slice(0, 1000);
            },
          );
        };
        observe();
        window.addEventListener('pageshow', observe);
        serviceWorker?.addEventListener('controllerchange', observe);
      });
    await context.addInitScript(() => {
      const id = `${Date.now()}-${Math.random()}`;
      const lifecycle = [];
      window.demoRestorationObservation = { id, lifecycle };
      const stageRows = [];
      window.demoLibraryStageRows = stageRows;
      window.__demoLibraryStage = (label, phase, detail = null) => {
        try {
          if (stageRows.length >= 160) return;
          const row = { label, phase, detail, monotonic: performance.now(), bootState: document.documentElement.dataset.bootState ?? null };
          stageRows.push(row);
          send({ kind: 'library-stage', ...row });
        } catch {}
      };
      window.__demoLibraryStageSync = (label, work) => {
        window.__demoLibraryStage(label, 'enter');
        let completed = false;
        try { const result = work(); completed = true; return result; }
        finally { window.__demoLibraryStage(label, completed ? 'settled' : 'threw'); }
      };
      const send = (event) =>
        void window
          .reportDemoRestorationEvent({ id, path: location.pathname, at: Date.now(), ...event })
          .catch(() => {});
      window.addEventListener('error', (e) =>
        send({
          kind: 'window-error',
          message: e.message,
          source: e.filename,
          line: e.lineno,
          column: e.colno,
          stack: String(e.error?.stack ?? '').slice(0, 2000),
        }),
      );
      window.addEventListener('unhandledrejection', (e) =>
        send({
          kind: 'unhandledrejection',
          message: String(e.reason?.stack ?? e.reason).slice(0, 2000),
        }),
      );
      window.addEventListener('rejectionhandled', (e) =>
        send({
          kind: 'rejectionhandled',
          message: String(e.reason?.stack ?? e.reason).slice(0, 2000),
        }),
      );
      for (const type of ['pageshow', 'pagehide', 'freeze', 'resume'])
        (['freeze', 'resume'].includes(type) ? document : window).addEventListener(type, (e) => {
          const row = { type, persisted: e.persisted ?? null };
          lifecycle.push(row);
          send({ kind: 'lifecycle', ...row });
        });
      for (const method of ['setItem', 'removeItem', 'clear']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (...args) {
          const absentRemoval = method === 'removeItem' && this.getItem(args[0]) === null;
          const result = Reflect.apply(original, this, args);
          send({
            kind: 'mutation',
            api: 'Storage',
            owner: this === localStorage ? 'localStorage' : 'sessionStorage',
            method,
            key: args[0] === undefined ? null : String(args[0]),
            absentRemoval,
          });
          return result;
        };
      }
      for (const method of ['add', 'put', 'delete', 'clear']) {
        const original = IDBObjectStore.prototype[method];
        IDBObjectStore.prototype[method] = function (...args) {
          const result = Reflect.apply(original, this, args);
          send({
            kind: 'mutation',
            api: 'IndexedDB',
            owner: `${this.transaction.db.name}/${this.name}`,
            method,
            key:
              method === 'delete'
                ? String(args[0])
                : args[1] === undefined
                  ? null
                  : String(args[1]),
          });
          return result;
        };
      }
    });
    page = await context.newPage();
    page.on('pageerror', (error) => {
      if (report.errors.length < 24)
        report.errors.push({
          mode: currentMode,
          stage,
          receivedAt: new Date().toISOString(),
          message: browserErrorDescription(error),
        });
    });
    await page.goto(`${base}${entry.url}`);
    await ordinaryEntry(entry);
    let controlWrites;
    for (let iteration = 1; iteration <= ordinaryReloads; iteration++) {
      await setStage(`ordinary-control-reload-${iteration}`);
      const controlStart = events.length;
      const saved = await storage();
      await page.reload();
      const control = await ordinaryEntry(entry);
      assert.deepEqual(await storage(), saved, 'Ordinary control reload preserves saved values.');
      const writes = signature(playerMutations(mutations(controlStart)));
      controlWrites ??= writes;
      assert.deepEqual(
        writes.filter((key) => !controlWrites.includes(key)),
        [],
        'Repeated ordinary startup introduces no new persistence writes.',
      );
      report.checks.push({
        type: 'ordinary-control-reload',
        iteration,
        mode: entry.mode,
        state: control,
        storage: summarizedStorage(saved),
        mutationSignatures: writes,
      });
    }
    for (const practice of args.reload === 'false' ? [] : [false, true]) {
      const stateName = practice ? 'practice' : 'watching';
      const saved = await storage();
      await setStage(stateName);
      const activeStart = events.length;
      const active = await startDemo(entry, practice);
      assert.deepEqual(await storage(), saved, `${entry.mode} ${stateName} must preserve storage.`);
      const activeWrites = mutations(activeStart);
      assert.deepEqual(
        playerMutations(activeWrites),
        [],
        `${entry.mode} ${stateName} cannot write player persistence.`,
      );
      await setStage(`reload-from-${stateName}`);
      const reloadStart = events.length;
      await page.reload();
      const restored = await ordinaryEntry(entry);
      assert.notEqual(restored.documentId, active.documentId, 'Reload creates a new document.');
      assert.deepEqual(
        await storage(),
        saved,
        `${entry.mode} reload must preserve ordinary saved values.`,
      );
      const reloadWrites = signature(playerMutations(mutations(reloadStart)));
      assert.deepEqual(
        unexpectedBootMutations(mutations(reloadStart), controlWrites),
        [],
        'Demo reload must not introduce persistence writes absent in the ordinary control reload.',
      );
      report.checks.push({
        type: 'reload-from-demo',
        mode: entry.mode,
        stateName,
        active,
        restored,
        storage: summarizedStorage(saved),
        activeMutations: activeWrites,
        reloadMutationSignatures: reloadWrites,
        workers: page.workers().length,
      });
    }
    if (args.bfcache === 'true' && entry.mode === 'solo')
      for (const practice of [false, true]) {
        const stateName = practice ? 'practice' : 'watching';
        const saved = await storage();
        await setStage(`bfcache-${stateName}`);
        const active = await startDemo(entry, practice);
        await page.goto(`${base}/demo-restoration-away?from=${stateName}`);
        await page.goBack({ waitUntil: 'commit' });
        await page.waitForTimeout(500);
        const restored = await snapshot();
        const admitted = restoredFromBFCache(active, restored);
        if (admitted) {
          assert.equal(
            restored.phase,
            'paused',
            'Solo history navigation explicitly suspends Demo, including watching.',
          );
          const held = restored.tick;
          await page.waitForTimeout(400);
          assert.equal(
            (await snapshot()).tick,
            held,
            'Solo history navigation leaves Demo paused until fresh intent.',
          );
          await page.locator('#demo-back').click();
        } else await ordinaryEntry(entry);
        assert.deepEqual(await storage(), saved, 'Away/back cannot persist Demo or practice.');
        report.bfcache.push({
          stateName,
          admitted,
          playbackObservation: admitted
            ? practice
              ? 'practice-returned-paused'
              : 'watching-returned-paused-under-Solo-pagehide-policy'
            : 'not-restored-from-bfcache',
          classification: admitted
            ? 'actual-bfcache-restoration'
            : 'not-admitted; ordinary-navigation-only',
          active,
          restored,
        });
      }
    await context.close();
    context = page = null;
  }
  assert.deepEqual(
    JSON.parse(await readFile(manifestPath)),
    manifest,
    'Source declaration remains frozen.',
  );
  assert.equal(report.eventOverflow ?? 0, 0, 'Bounded observations must not silently omit events.');
  report.functionalComplete = true;
  report.strictDiagnosticGate = restorationDiagnosticGate(report.errors, events);
  assert.equal(
    report.strictDiagnosticGate,
    true,
    JSON.stringify({
      pageErrors: report.errors,
      domErrors: events.filter((event) =>
        ['window-error', 'unhandledrejection'].includes(event.kind),
      ),
    }),
  );
  report.events = events;
  report.complete = true;
} catch (error) {
  process.exitCode = 1;
  report.complete = false;
  report.failure ??= browserErrorDescription(error);
  report.activeStage = { mode: currentMode, stage };
  report.events = events;
  try {
    report.failedScreenshot = args.report.replace(/\.json$/, '-failed.png');
    try { await page.screenshot({ path: report.failedScreenshot, timeout: 1000 }); }
    catch (error) { report.failedScreenshotError = browserErrorDescription(error); }
    report.failedState = await Promise.race([
      snapshot(),
      new Promise((_, reject) => setTimeout(() => reject(Error('Snapshot timeout')), 1000)),
    ]);
  } catch {}
} finally {
  clearTimeout(timer);
  try {
    report.runtimeAfter = await fingerprintDemoSources(process.cwd());
    assert.deepEqual(report.runtimeAfter, runtimeBefore);
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), observerPreparation.head);
    assert.equal(sha(await readFile(manifestPath)), sha(manifestBytesBefore));
    assert.equal(sha(await readFile(observerPreparation.capture + '/manifest.json')), observerPreparation.captureManifestSHA256);
    assert.equal(sha(await readFile(observerPreparation.durableHarness.path)), observerPreparation.durableHarness.sha256);
    report.sourceUnchangedAtExit = true;
  } catch (error) { report.sourceUnchangedAtExit = false; report.complete = false; report.failure ??= browserErrorDescription(error); }

  const result = await finishQualification({
    report,
    reportPath,
    browser,
    writeReport: async (...writeArgs) => {
      if (preview) {
        if (preview.emittedPreview) report.preview.fixtureResponses = preview.fixtureResponses;
        try {
          preview.server.closeAllConnections();
          await new Promise((resolve, reject) => {
            const closeTimer = setTimeout(
              () => reject(new Error('Preview cleanup exceeded 2000ms.')),
              2000,
            );
            preview.server.close((error) => {
              clearTimeout(closeTimer);
              if (error) reject(error);
              else resolve();
            });
          });
          report.previewClosed = true;
        } catch (error) {
          report.previewClosed = false;
          report.complete = false;
          report.failure ??= browserErrorDescription(error);
        }
      }
      await writeQualificationReport(...writeArgs);
    },
  });
  if (!result.complete) process.exitCode = 1;
}
