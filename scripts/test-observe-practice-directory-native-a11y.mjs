import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {
  A11Y_CASES,
  A11Y_POLICY,
  validateNativeA11yPlan,
  nativeA11yScope,
  assertNativeFocusWitness,
  nativeFocusGeometry,
  classifyNativeSourceRequests,
  keyboardReach,
  readNativeFocusWitness,
  trackNativeServerRequests,
  runNativeA11yCase,
  nativeProfileRemovalAllowed,
  selectMainSettingsLocale,
} from './observe-practice-directory-native-a11y.mjs';
const zoom = { dpr: 4, outerWidth: 1280, innerWidth: 640 };
function witness() {
  return {
    text: 'Player guide',
    active: true,
    focusVisible: true,
    visible: true,
    centerHit: true,
    rect: { x: 20, y: 20, width: 200, height: 44 },
    viewport: {
      width: 640,
      height: 378,
      dpr: 4,
      visualScale: 1,
      outerWidth: 1280,
      visualWidth: 640,
      visualHeight: 378,
      visualOffsetLeft: 0,
      visualOffsetTop: 0,
    },
    outline: { width: '3px', style: 'solid', color: 'rgb(255, 216, 92)' },
    motion: { animationName: 'none', transitionDuration: '0s', scrollBehavior: 'auto' },
    reducedMotion: true,
    documentWidth: 640,
  };
}
function plan() {
  return {
    format: 'revealline-practice-directory-native-a11y-plan.v1',
    protocol: A11Y_POLICY.id,
    repository: '/tmp/repo',
    shellRevision: 'a'.repeat(40),
    shellTree: 'b'.repeat(40),
    bundle: '/tmp/candidate',
    envelopeSha256: 'c'.repeat(64),
    sourceRevision: 'd'.repeat(40),
    sourceTree: 'e'.repeat(40),
    packageRevision: 'f'.repeat(64),
    cases: A11Y_CASES.map((x) => x.id),
  };
}
test('strict six-case plan rejects arbitrary selectors, missing locales and production substitution', () => {
  validateNativeA11yPlan(plan());
  for (const mutate of [
    (p) => p.cases.pop(),
    (p) => p.cases.reverse(),
    (p) => (p.protocol = 'production'),
    (p) => (p.protocol = 'practice-directory-native-zoom-a11y.v1'),
    (p) => (p.protocol = 'practice-directory-native-zoom-a11y.v2'),
    (p) => (p.distribution = '/tmp/dist'),
    (p) => (p.script = 'anything'),
    (p) => (p.repository = 'relative'),
    (p) => (p.shellRevision = 'main'),
  ]) {
    const p = plan();
    mutate(p);
    assert.throws(() => validateNativeA11yPlan(p));
  }
});
test('only exact bounded source-only absent-build and browser-icon probes are expected', () => {
  const build = {
    path: '/revealline/game/build-info.json',
    message: 'Not a committed regular file.',
  };
  const icon = { path: '/favicon.ico', message: 'Outside local fixture root.' };
  const context = { sourceShellOnly: true, productionQualification: false, buildInfoAbsent: true };
  const rows = [build, icon];
  const decision = classifyNativeSourceRequests(rows, context);
  assert.equal(decision.expected.length, 2);
  assert.deepEqual(decision.unexpected, []);
  assert.deepEqual(rows, [build, icon], 'Raw failures must remain unchanged.');
  for (const bad of [
    { ...build, path: '/revealline/practice/civilian-flight/build-info.json' },
    { ...build, path: '/revealline/game/build-info.json?ignore=1' },
    { ...build, path: '/revealline/game/build-info.json/' },
    { ...build, path: '/revealline/game/app.mjs' },
    { ...build, message: 'Hash mismatch' },
    { ...icon, path: '/revealline/favicon.ico' },
    { ...icon, message: 'Directory server stopped.' },
  ])
    assert.equal(classifyNativeSourceRequests([bad], context).unexpected.length, 1);
  for (const altered of [
    { ...context, sourceShellOnly: false },
    { ...context, productionQualification: true },
    { ...context, buildInfoAbsent: false },
  ])
    assert.equal(classifyNativeSourceRequests([build], altered).unexpected.length, 1);
  assert.equal(classifyNativeSourceRequests(Array(13).fill(build), context).unexpected.length, 1);
  assert.equal(classifyNativeSourceRequests(Array(13).fill(icon), context).unexpected.length, 1);
});
test('fixed matrix covers EN/UK and all three packages once', () => {
  assert.equal(A11Y_CASES.length, 6);
  assert.equal(new Set(A11Y_CASES.map((x) => x.id)).size, 6);
  assert.deepEqual(
    A11Y_CASES.map((x) => x.locale),
    ['en', 'en', 'en', 'uk', 'uk', 'uk'],
  );
});
test('focus witness requires native geometry, outline, keyboard visibility, bounded edges and reduced media', () => {
  assertNativeFocusWitness(witness(), zoom);
  for (const mutate of [
    (w) => (w.active = false),
    (w) => (w.focusVisible = false),
    (w) => (w.centerHit = false),
    (w) => (w.visible = false),
    (w) => (w.text = ''),
    (w) => (w.rect.y = 370),
    (w) => (w.rect.x = -1),
    (w) => (w.outline.width = '0px'),
    (w) => (w.outline.color = 'transparent'),
    (w) => (w.motion.animationName = 'pulse'),
    (w) => (w.motion.transitionDuration = '0s, 1s'),
    (w) => (w.reducedMotion = false),
    (w) => (w.viewport.dpr = 2),
    (w) => (w.viewport.visualScale = 2),
    (w) => (w.documentWidth = 800),
  ]) {
    const w = witness();
    mutate(w);
    assert.throws(() => assertNativeFocusWitness(w, zoom));
  }
});
test('fractional native viewport retains raw overflow and accepts less than half a physical pixel only', () => {
  const w = witness();
  w.rect = { x: 32, y: 350.6015625, width: 576, height: 55.99609375 };
  Object.assign(w.viewport, { height: 406, visualHeight: 406.5 });
  const geometry = nativeFocusGeometry(w, zoom);
  assert.equal(geometry.policy, 'visual-viewport-half-device-pixel.v1');
  assert.equal(geometry.bottomOverflowCss, 0.09765625);
  assert.equal(geometry.bottomOverflowDevicePixels, 0.390625);
  assert.equal(geometry.allowanceCss, 0.125);
  assert.equal(geometry.legacyIntegerBoundsPassed, false);
  assert.equal(geometry.withinPrecision, true);
  assertNativeFocusWitness(w, zoom);
  for (const excess of [0.125, 0.25, 1, 10]) {
    w.rect.y = w.viewport.visualHeight + excess - w.rect.height;
    assert.throws(() => assertNativeFocusWitness(w, zoom), /Focused control is clipped/);
  }
});
test('native geometry rejects missing or inconsistent viewports and never substitutes integer bounds', () => {
  for (const mutate of [
    (w) => delete w.viewport.visualHeight,
    (w) => (w.viewport.visualWidth = null),
    (w) => (w.viewport.visualHeight = NaN),
    (w) => (w.viewport.visualWidth = Infinity),
    (w) => (w.viewport.visualHeight = 0),
    (w) => (w.viewport.visualWidth = -1),
    (w) => (w.viewport.height = 378.5),
    (w) => (w.viewport.width = 640.5),
    (w) => (w.viewport.visualHeight = 379),
    (w) => (w.viewport.visualWidth = 641),
    (w) => (w.viewport.visualOffsetTop = 0.01),
    (w) => (w.viewport.visualOffsetLeft = 0.01),
    (w) => (w.viewport.dpr = 0.5),
    (w) => (w.viewport.dpr = Infinity),
    (w) => (w.viewport.visualScale = 2),
  ]) {
    const w = witness();
    mutate(w);
    assert.throws(() => assertNativeFocusWitness(w, zoom));
  }
  const w = witness(),
    fractionalZoom = { ...zoom, dpr: 2.5 };
  w.viewport.dpr = 2.5;
  w.rect = { x: 20, y: 334.199, width: 200, height: 44 };
  assertNativeFocusWitness(w, fractionalZoom);
  w.rect.y = 334.2;
  assert.throws(() => assertNativeFocusWitness(w, fractionalZoom), /Focused control is clipped/);
  w.rect = { x: 440.2, y: 20, width: 200, height: 44 };
  assert.throws(() => assertNativeFocusWitness(w, fractionalZoom), /Focused control is clipped/);
});
test('Tab reachability uses real keyboard events and stops on verified focus', async () => {
  let tabs = 0;
  const receipt = [],
    page = {
      keyboard: {
        press: async (key) => {
          assert.equal(key, 'Tab');
          tabs++;
        },
      },
    },
    target = { evaluate: async (fn) => (fn === readNativeFocusWitness ? witness() : tabs === 3) };
  await keyboardReach(page, target, async (_, work) => work(), receipt, zoom);
  assert.equal(tabs, 3);
  assert.equal(receipt[0].tabs, 3);
  assert.equal(receipt[0].passed, true);
});
test('failed focus retains exact target geometry, precision residual and reason', async () => {
  const receipt = [],
    w = witness();
  w.id = 'prepare';
  w.rect = { x: 32, y: 350.75, width: 576, height: 56 };
  w.viewport.height = 406;
  w.viewport.visualHeight = 406.5;
  await assert.rejects(
    keyboardReach(
      { keyboard: { press: async () => {} } },
      { evaluate: async (fn) => (fn === readNativeFocusWitness ? w : true) },
      async (_, work) => work(),
      receipt,
      zoom,
    ),
    /Focused control is clipped/,
  );
  assert.equal(receipt.length, 1);
  assert.equal(receipt[0].id, 'prepare');
  assert.deepEqual(receipt[0].rect, w.rect);
  assert.equal(receipt[0].viewport.visualHeight, 406.5);
  assert.equal(receipt[0].geometry.bottomOverflowDevicePixels, 1);
  assert.equal(receipt[0].passed, false);
  assert.equal(receipt[0].failure, 'Focused control is clipped.');
});
function localeFixture({
  initial = 'en',
  responds = true,
  count = 1,
  compact = true,
  backCloses = true,
} = {}) {
  let lang = initial,
    selected = initial,
    open = false,
    view = 'categories';
  const actions = [];
  return {
    actions,
    page: {
      locator(selector) {
        if (selector === 'html') return { getAttribute: async () => lang };
        // Home has no language control after maintained native-menu relocation.
        // Hidden duplicated mounts remain inside Settings; only one is visible.
        assert.notEqual(selector, '#shell-home[open] [data-language-select]');
        const waits = ['#settings-dialog[open]', '#settings-panel-display', '#shell-home[open]'];
        if (waits.includes(selector))
          return {
            waitFor: async (opts) => {
              assert.deepEqual(opts, { state: 'visible', timeout: 10000 });
              if (selector === '#settings-dialog[open]') assert(open);
              if (selector === '#settings-panel-display') assert(open && view === 'panel');
              // Underlying Home stays visible even while Settings is a blocking modal.
              actions.push(selector);
            },
          };
        if (selector === '#settings-dialog')
          return { getAttribute: async (name) => (name === 'open' ? (open ? '' : null) : view) };
        const clicks = [
          '#shell-options',
          '#settings-tab-display',
          '#settings-dialog[open] [data-close="settings-dialog"]',
        ];
        if (clicks.includes(selector))
          return {
            click: async (opts) => {
              assert.deepEqual(opts, { timeout: 10000 });
              actions.push(selector);
              if (selector === '#shell-options') open = true;
              else if (selector === '#settings-tab-display') {
                assert(open);
                view = 'panel';
              } else if (compact && view === 'panel') view = 'categories';
              else if (backCloses) open = false;
            },
          };
        assert.equal(selector, '#settings-dialog[open] [data-language-select]:visible');
        return {
          count: async () => {
            assert(open && view === 'panel');
            return count;
          },
          waitFor: async (opts) => {
            assert.deepEqual(opts, { state: 'visible', timeout: 10000 });
            actions.push('visible');
          },
          inputValue: async () => selected,
          selectOption: async (value, opts) => {
            assert.deepEqual(opts, { timeout: 10000 });
            actions.push(['select', value]);
            if (responds) lang = selected = value;
          },
        };
      },
      waitForFunction: async (_, arg, opts) => {
        assert.equal(arg.selector, '#settings-dialog[open] [data-language-select]');
        assert.deepEqual(opts, { timeout: 10000 });
        actions.push('observe');
      },
    },
  };
}
test('relocated visible Settings language selects Ukrainian, ignores hidden duplicates, and returns through compact Back twice', async () => {
  const f = localeFixture(),
    receipt = {};
  await selectMainSettingsLocale(f.page, 'uk', async (_, work) => work(), receipt);
  assert.equal(receipt.before, 'en');
  assert.equal(receipt.action, 'ordinary-select-option');
  assert.equal(receipt.after, 'uk');
  assert.equal(receipt.controlAfter, 'uk');
  assert.equal(receipt.settingsOpened, true);
  assert.equal(receipt.settingsClosed, true);
  assert.deepEqual(receipt.route, [
    '#shell-options',
    '#settings-tab-display',
    '#settings-dialog[open] [data-close="settings-dialog"]',
    '#settings-dialog[open] [data-close="settings-dialog"]',
  ]);
  assert.deepEqual(receipt.back, [
    { open: true, view: 'categories' },
    { open: false, view: 'categories' },
  ]);
  assert(f.actions.some((x) => Array.isArray(x) && x[0] === 'select' && x[1] === 'uk'));
});
test('matching actual document locale does not require a nonexistent Home control or open Settings', async () => {
  const f = localeFixture({ initial: 'uk' }),
    receipt = {};
  await selectMainSettingsLocale(f.page, 'uk', async (_, work) => work(), receipt);
  assert.equal(receipt.action, 'none');
  assert.equal(receipt.after, 'uk');
  assert.equal(receipt.settingsOpened, false);
  assert.deepEqual(f.actions, []);
});
test('language UI failure or ambiguous control cannot pass using query locale alone', async () => {
  for (const options of [{ responds: false }, { count: 2 }, { count: 0 }]) {
    const f = localeFixture(options),
      receipt = {};
    await assert.rejects(
      selectMainSettingsLocale(f.page, 'uk', async (_, work) => work(), receipt),
    );
    assert.equal(receipt.before, 'en');
  }
  await assert.rejects(selectMainSettingsLocale({}, 'fr', async (_, work) => work(), {}));
});
test('wide Settings closes in one native Back and can select English from saved Ukrainian', async () => {
  const f = localeFixture({ initial: 'uk', compact: false }),
    receipt = {};
  await selectMainSettingsLocale(f.page, 'en', async (_, work) => work(), receipt);
  assert.equal(receipt.after, 'en');
  assert.equal(receipt.back.length, 1);
  assert.equal(receipt.settingsClosed, true);
});
test('underlying visible Home cannot hide a Settings modal that remains open after two Back presses', async () => {
  const f = localeFixture({ backCloses: false }),
    receipt = {};
  await assert.rejects(selectMainSettingsLocale(f.page, 'uk', async (_, work) => work(), receipt));
  assert.equal(receipt.back.length, 2);
  assert.equal(receipt.settingsClosed, undefined);
});
test('unreachable target is a bounded failure, not direct focus injection', async () => {
  let tabs = 0;
  await assert.rejects(
    keyboardReach(
      { keyboard: { press: async () => tabs++ } },
      { evaluate: async () => false },
      async (_, work) => work(),
      [],
      zoom,
    ),
    /within32/,
  );
  assert.equal(tabs, 32);
});
test('absolute action boundary rejects synchronous completion after timer deadline', async () => {
  const scope = nativeA11yScope({ overallMs: 100, actionMs: 5 });
  await assert.rejects(
    scope.run('slow', () => {
      const until = performance.now() + 20;
      while (performance.now() < until) {}
      return 'late';
    }),
    /absolute deadline/,
  );
  assert.equal(scope.pending(), 0);
});
test('underlying timeout remains owned until settlement; stopped scope rejects fresh work', async () => {
  const scope = nativeA11yScope({ overallMs: 100, actionMs: 5 });
  let release;
  await assert.rejects(
    scope.run(
      'pending',
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    ),
    /timed out/,
  );
  assert.equal(scope.pending(), 1);
  scope.stop();
  await assert.rejects(
    scope.run('late', () => assert.fail('must not start')),
    /ended/,
  );
  release();
  await scope.settled();
  assert.equal(scope.pending(), 0);
});
test('scope refuses increased global or per-action budgets', () => {
  assert.throws(() => nativeA11yScope({ overallMs: 600001 }));
  assert.throws(() => nativeA11yScope({ actionMs: 10001 }));
});
test('timed-out Chrome launch cannot release its profile before underlying launch and late close settle', async () => {
  const scope = nativeA11yScope({ overallMs: 100, actionMs: 5 });
  let finishLaunch,
    context,
    lateClosed = false,
    removed = false;
  const launchAttempted = true;
  const launch = scope.run('launch', async () => {
    await new Promise((resolve) => {
      finishLaunch = resolve;
    });
    context = {
      close: async () => {
        lateClosed = true;
      },
    };
    await context.close();
  });
  await assert.rejects(launch, /timed out/);
  assert.equal(context, undefined);
  if (nativeProfileRemovalAllowed({ lateCreation: true, stopped: true, launchAttempted }))
    removed = true;
  assert.equal(removed, false);
  assert.equal(
    nativeProfileRemovalAllowed({
      pendingOperations: scope.pending(),
      resourcesClosed: false,
      cleanupComplete: true,
      zoomResetVerified: true,
    }),
    false,
  );
  finishLaunch();
  await scope.settled();
  assert(lateClosed);
  assert.equal(
    nativeProfileRemovalAllowed({
      pendingOperations: 0,
      resourcesClosed: false,
      cleanupComplete: true,
      zoomResetVerified: true,
    }),
    false,
  );
  assert(
    nativeProfileRemovalAllowed({
      pendingOperations: 0,
      resourcesClosed: true,
      cleanupComplete: true,
      zoomResetVerified: true,
    }),
  );
  assert(
    nativeProfileRemovalAllowed({ lateCreation: true, stopped: true, launchAttempted: false }),
  );
  assert.equal(
    nativeProfileRemovalAllowed({ lateCreation: true, stopped: false, launchAttempted: false }),
    false,
  );
});
test('final integrity checks cannot accept a response beyond overall observation deadline', async () => {
  const scope = nativeA11yScope({ overallMs: 5, actionMs: 5 });
  let passed = false;
  await assert.rejects(
    (async () => {
      await scope.run('Final source identity', () => {
        const end = performance.now() + 20;
        while (performance.now() < end) {}
      });
      scope.check();
      passed = true;
    })(),
    /ended|deadline/,
  );
  assert.equal(passed, false);
});
test('server adapter preserves maintained internal pending-read ownership when already available', () => {
  const owned = {
    pending: () => 1,
    settled: async () => {},
    stop: () => {},
    server: {
      listeners() {
        assert.fail('must not rewrap maintained listener');
      },
    },
  };
  assert.equal(trackNativeServerRequests(owned), owned);
});
test('source server adapter retains its original handler and joins delayed reads after socket close', async () => {
  let release;
  const server = createServer(async (_req, res) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    if (!res.destroyed) res.end('original');
  });
  const owned = trackNativeServerRequests({ server });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const request = fetch(`http://127.0.0.1:${server.address().port}/`).catch(() => null);
  while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(owned.pending(), 1);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  release();
  await owned.settled();
  await request;
  assert.equal(owned.pending(), 0);
});

function journeyFixture({ mainReturnLocale = 'en' } = {}) {
  const root = 'http://127.0.0.1:1234/revealline/',
    spec = A11Y_CASES[0],
    version = 'v0.1.0';
  const urls = {
    main: root + 'game/?lang=en',
    directory: root + 'practice/?lang=en',
    guide:
      root +
      'practice/civilian-flight/releases/' +
      version +
      '/site/optional-practice/civilian-flight/guide.html?lang=en',
    details: root + 'practice/civilian-flight/app/?lang=en',
    play: root + 'practice/civilian-flight/app/?action=play&lang=en',
  };
  const actions = [];
  function makePage(kind) {
    const p = {
      kind,
      currentURL: kind === 'main' ? urls.main : urls.details,
      active: '',
      closed: false,
      on() {},
      async bringToFront() {},
      async emulateMedia(v) {
        assert.deepEqual(v, { reducedMotion: 'reduce' });
      },
      async goto(url) {
        p.currentURL = url;
      },
      async waitForURL(url) {
        assert.equal(p.currentURL, url);
      },
      async waitForFunction() {},
      async close() {
        p.closed = true;
      },
      async evaluate() {
        return p.active;
      },
      waitForEvent: async () => launcher,
    };
    const order = () =>
      kind === 'main'
        ? ['#optional-practice-close', '#optional-practice-refresh', 'PLAY', 'DETAILS']
        : p.currentURL === urls.directory
          ? ['NAV']
          : ['#check', '#prepare', '#directory', '#game', '#guide'];
    p.keyboard = {
      press: async (key) => {
        actions.push([kind, key, p.active]);
        if (key === 'Tab') {
          const keys = order();
          p.active = keys[(keys.indexOf(p.active) + 1) % keys.length];
        } else if (key === 'Escape') {
          p.active = 'shell-home-practice';
        } else if (key === 'Enter') {
          if (p.active === '#guide') p.currentURL = urls.guide;
          else if (p.active === 'NAV') p.currentURL = urls.main;
        }
      },
    };
    function locator(key) {
      return {
        locator: (sub) => locator(sub === 'a' ? 'LINKS' : sub === 'h3' ? 'TITLE' : sub),
        nth: (n) => locator(key === 'LINKS' ? (n === 0 ? 'PLAY' : 'DETAILS') : 'ROW'),
        first: () => locator('NAV'),
        waitFor: async () => {},
        count: async () => 3,
        innerText: async () => (key === '#firstFlight' ? 'Start from Home' : 'Gym'),
        evaluate: async (fn) =>
          fn === readNativeFocusWitness ? { ...witness(), id: key } : p.active === key,
        getAttribute: async (name) => {
          if (name === 'lang')
            return kind === 'launcher' && p.currentURL === urls.main ? mainReturnLocale : 'en';
          if (name === 'aria-live') return 'polite';
          if (name === 'role') return 'status';
          if (name === 'open') return null;
          if (name === 'href')
            return {
              PLAY: urls.play,
              DETAILS: urls.details,
              '#guide': urls.guide,
              '#directory': urls.directory,
              '#game': urls.main,
            }[key];
          return null;
        },
        click: async () => {
          actions.push([kind, 'click', key]);
          if (key === '#directory') p.currentURL = urls.directory;
        },
      };
    }
    p.locator = locator;
    return p;
  }
  const main = makePage('main'),
    launcher = makePage('launcher');
  return {
    main,
    launcher,
    spec,
    actions,
    fixture: {
      url: 'http://127.0.0.1:1234/',
      version,
      packages: [{ id: 'civilian-flight' }, { id: 'civilian-fpv' }, { id: 'fpv-worlds' }],
      details: [
        {
          id: 'civilian-flight',
          description: { copy: { en: { name: 'Gym', firstFlight: 'Start from Home' } } },
        },
      ],
    },
  };
}
test('bounded matrix adapter follows ordinary Details/guide/return/Escape route without starting flight', async () => {
  const f = journeyFixture(),
    report = { cases: [] };
  const result = await runNativeA11yCase({
    page: f.main,
    spec: f.spec,
    fixture: f.fixture,
    run: async (_, work) => work(),
    report,
    capture: async (_, name) => ({ path: name }),
    unlock: async () => false,
    openPractice: async (page, click) => click(page, '#shell-home-practice'),
    assertLink: (href, { play }) => {
      assert.equal(new URL(href).searchParams.get('action'), play ? 'play' : null);
      return { href };
    },
    zoom,
    password: undefined,
    acquire: async (_, work) => work(),
  });
  assert.equal(result.failure, undefined);
  assert(result.passed && result.guideAndReturn);
  assert.equal(result.focus.length, 10);
  assert.equal(result.escapeFocus, 'shell-home-practice');
  assert.equal(result.escapeFocusWitness.focusVisible, true);
  assert.equal(result.onboarding, 'Start from Home');
  assert.equal(result.mainReturnLocale, 'en');
  assert(f.launcher.closed);
  assert(f.actions.some((x) => x[1] === 'Enter' && x[2] === 'DETAILS'));
  assert(!f.actions.some((x) => x[1] === 'Enter' && x[2] === 'PLAY'));
  assert.equal(result.directoryStatus.spoken, false);
});
test('matching return query cannot hide an incorrect actual main document language', async () => {
  const f = journeyFixture({ mainReturnLocale: 'uk' });
  const result = await runNativeA11yCase({
    page: f.main,
    spec: f.spec,
    fixture: f.fixture,
    run: async (_, work) => work(),
    report: { cases: [] },
    capture: async (_, name) => ({ path: name }),
    unlock: async () => false,
    openPractice: async (page, click) => click(page, '#shell-home-practice'),
    assertLink: (href) => ({ href }),
    zoom,
    password: undefined,
    acquire: async (_, work) => work(),
  });
  assert.equal(new URL(f.launcher.currentURL).searchParams.get('lang'), 'en');
  assert.equal(result.mainReturnLocale, 'uk');
  assert.equal(result.passed, false);
  assert.match(result.failure, /Main return must retain requested language/);
});
test('observer explicitly uses headed owned profile, native zoom and source-only server with no override hooks', async () => {
  const source = await readFile(
    new URL('./observe-practice-directory-native-a11y.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /headless: false/);
  assert.match(source, /viewport: null/);
  assert.match(source, /selectNativeZoom/);
  assert.match(source, /await total.run\(\s*'Load maintained source and admission helpers'/);
  assert.match(source, /directoryJourneyServer\(overlay.files, tree, report\)/);
  assert.doesNotMatch(
    source,
    /force:\s*true|\.focus\(|setViewportSize|Emulation\.setPageScaleFactor|localStorage\.setItem/,
  );
  assert.match(source, /profileRemoved/);
  assert.match(source, /visuallyReviewed: false/);
  assert.match(source, /await realpath\(process.argv\[1\]\)/);
});
