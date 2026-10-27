import { installFinalOwnerObserver, OWNER_MARKER } from "file:///Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/.cache/webkit-blob-owner-emitted-71a0ac38a/projection.mjs";
/* global document, window, location, IDBObjectStore, getComputedStyle */
import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { finishQualification, writeQualificationReport } from 'file:///Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/scripts/shared-demo-browser-report.mjs';
import {
  playerPersistenceMutations,
  mutationSignatures,
  unexpectedBootMutations,
  restoredFromBFCache,
  browserErrorDescription,
  restorationDiagnosticGate,
} from 'file:///Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/scripts/demo-restoration-observation.mjs';
import { startProductionPreview } from 'file:///Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/scripts/serve-production-preview.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const split = arg.indexOf('=');
    return [arg.slice(2, split), arg.slice(split + 1)];
  }),
);
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
const projectionPins = [{"name":"game/presentation/host.mjs","original":{"path":"docs/qualification/shared-demos/webkit-blob-owner-emitted-71a0ac38a.artifacts/game__presentation__host.mjs.original.txt","bytes":29538,"sha256":"ae0ee1270b586807f0c96987988f970c0048c1844a085d748efe31e4de43b623"},"projected":{"path":"docs/qualification/shared-demos/webkit-blob-owner-emitted-71a0ac38a.artifacts/game__presentation__host.mjs.projected.mjs","bytes":30826,"sha256":"1fbc71672ff1b3d8702b2e77c8d9f6ebd46e415cafeb0b6cc1698b71d1e6f2ec"},"absolute":"/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/docs/qualification/shared-demos/webkit-blob-owner-emitted-71a0ac38a.artifacts/game__presentation__host.mjs.projected.mjs","syntaxVerified":true},{"name":"game/app.mjs","original":{"path":"docs/qualification/shared-demos/webkit-blob-owner-emitted-71a0ac38a.artifacts/game__app.mjs.original.txt","bytes":492495,"sha256":"8110efdf57db9a88236c0c293451db4ac3e4ea9369036bd538d15164f51d8ba7"},"projected":{"path":"docs/qualification/shared-demos/webkit-blob-owner-emitted-71a0ac38a.artifacts/game__app.mjs.projected.mjs","bytes":492717,"sha256":"a73cb60cae926cd7809e3a0d04d7e3faec7b9a11cab1ef7f3157bfa5cfd3637b"},"absolute":"/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/docs/qualification/shared-demos/webkit-blob-owner-emitted-71a0ac38a.artifacts/game__app.mjs.projected.mjs","syntaxVerified":true}];
const projectedBodies = new Map(await Promise.all(projectionPins.map(async p => ["/" + p.name, { pin: p, body: await readFile(p.absolute) }])));
for (const {pin, body} of projectedBodies.values()) assert.equal(sha(body), pin.projected.sha256);
const report = {
  diagnosticOnly: true, projectionPins, ownerTrace: [], nativeConsole: [], requestEvents: [], rawPageErrors: [], ownerOverflow: 0, nativeConsoleOverflow: 0, requestOverflow: 0,

  format: 'SharedDemoExistingOwnerObservationV1',
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
    path: "docs/qualification/shared-demos/webkit-blob-owner-emitted-71a0ac38a.artifacts/derived-qualifier.mjs",
    derivedFrom: {"path":"scripts/qualify-demo-restoration-browser.mjs","bytes":23633,"sha256":"13d80135cff69674fe569f991df674d1e633ecaa138eded41ce78207bb59ce83"},
    sha256: sha(await readFile(new URL(import.meta.url))),
    helperSHA256: sha(
      await readFile(new URL('file:///Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/shared-game-demos/scripts/demo-restoration-observation.mjs', import.meta.url)),
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
    'Declared emitted host/app projections add observation only. Native calls, original errors/returns and qualification gates remain unchanged; historical failures are not upgraded.',
    'Decode labels bind the validated asset identity and existing main submission to its existing catch; they do not expose or infer a browser-internal blob URL. No Blob bytes are read again.',
    'Only a DOM error/rejection carrying the same JavaScript object can share the observer WeakMap identity. Protocol/pageerror text, even a unique blob URL with matching target/document timing, supplies correlation rather than exact object identity.',
    'Bounded observed prefixes cannot prove an old document had no undelivered final tail. Missing catches, ambiguous requests and observer failures remain unresolved.',
    'All native diagnostics still fail the strict gate; there is no automatic adjudication or filtering.',
    'The diagnostic adds read-only error/rejection and beforeunload observers for chronology. This is a reload-only probe and makes no BFCache admission claim.',
    ...(args['emitted-preview']
      ? [
          'The preview is derived from the verified emitted inventory, with declared local HTML access credentials and the two hashed diagnostic JavaScript projections. This run does not establish offline HTML integrity; service workers are observed, never blocked or unregistered.',
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
      ownerObservation: globalThis.__demoFinalOwnerObserver?.snapshot() ?? null,
      documentId: window.demoRestorationObservation.id,
      open: d?.open ?? false,
      practice: d?.classList.contains('is-practice') ?? false,
      phase: d?.dataset.demoPhase ?? null,
      mode: d?.dataset.demoMode ?? null,
      tick: d?.dataset.demoTick ?? null,
      bodyState: document.body.dataset.flightState ?? null,
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
    const projected = projectedBodies.get(request.url.split('?')[0]);
    if (projected && ['GET', 'HEAD'].includes(request.method)) {
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
    await context.addInitScript(installFinalOwnerObserver);
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
    page.on('console', message => {
      const row = { receivedAt: new Date().toISOString(), stage, type: message.type(), text: message.text(), location: message.location() };
      if (row.text.startsWith(OWNER_MARKER)) {
        if (report.ownerTrace.length >= 5000) report.ownerOverflow++;
        else {
          try { report.ownerTrace.push({ receivedAt: row.receivedAt, stage, ...JSON.parse(row.text.slice(OWNER_MARKER.length)) }); }
          catch { report.ownerOverflow++; }
        }
      } else if (report.nativeConsole.length < 200) report.nativeConsole.push(row);
      else report.nativeConsoleOverflow++;
    });
    for (const kind of ['request', 'requestfinished', 'requestfailed'])
      page.on(kind, request => {
        if (!request.url().includes('/game/presentation/compiled/')) return;
        if (report.requestEvents.length >= 1500) { report.requestOverflow++; return; }
        report.requestEvents.push({ kind, url: request.url(), resourceType: request.resourceType(), failure: request.failure(), receivedAt: new Date().toISOString(), stage });
      });
    page.on('pageerror', error => {
      if (report.rawPageErrors.length >= 48) { report.nativeConsoleOverflow++; return; }
      report.rawPageErrors.push({ name: error.name, message: error.message, stack: error.stack, receivedAt: new Date().toISOString(), stage });
    });
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
    report.failedState = await Promise.race([
      snapshot(),
      new Promise((_, reject) => setTimeout(() => reject(Error('Snapshot timeout')), 1000)),
    ]);
  } catch {}
} finally {
  clearTimeout(timer);
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
      try {
        assert.equal(report.ownerOverflow, 0, 'Ownership collection overflow.');
        assert.equal(report.nativeConsoleOverflow, 0, 'Native console collection overflow.');
        assert.equal(report.requestOverflow, 0, 'Request collection overflow.');
        assert.ok(!report.ownerTrace.some(row => row.kind === 'observer-overflow'));
        const states = report.checks.flatMap(check => [check.state, check.active, check.restored]).filter(Boolean);
        for (const state of states) {
          const observation = state.ownerObservation;
          assert.ok(observation, 'Checked document requires its observer.');
          assert.equal(observation.observerFailures, 0);
          assert.equal(observation.overflow, 0);
          const received = report.ownerTrace.filter(row => row.documentIdentity === observation.documentIdentity);
          for (const row of observation.rows)
            assert.ok(received.some(item => item.sequence === row.sequence && item.kind === row.kind), 'Observed prefix must be delivered completely.');
        }
        report.observationPrefixComplete = true;
        report.strictDiagnosticGate = restorationDiagnosticGate(report.errors, events);
        assert.equal(report.strictDiagnosticGate, true, 'Late native/DOM diagnostic remains a strict failure.');
      } catch (error) {
        report.complete = false;
        report.failure ??= browserErrorDescription(error);
        report.observationFailure = browserErrorDescription(error);
      }
      await writeQualificationReport(...writeArgs);
    },
  });
  if (!result.complete) process.exitCode = 1;
}
