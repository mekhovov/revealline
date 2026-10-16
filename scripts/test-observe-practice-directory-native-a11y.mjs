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
  keyboardReach,
  readNativeFocusWitness,
  trackNativeServerRequests,
  runNativeA11yCase,
  nativeProfileRemovalAllowed,
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
    viewport: { width: 640, height: 378, dpr: 4, visualScale: 1, outerWidth: 1280 },
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
test('fixed matrix covers EN/UK and all three packages once', () => {
  assert.equal(A11Y_CASES.length, 6);
  assert.equal(new Set(A11Y_CASES.map((x) => x.id)).size, 6);
  assert.deepEqual(
    A11Y_CASES.map((x) => x.locale),
    ['en', 'en', 'en', 'uk', 'uk', 'uk'],
  );
});
test('focus witness requires native geometry, outline, keyboard visibility, no clipping and reduced media', () => {
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

function journeyFixture() {
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
          if (name === 'lang') return 'en';
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
  assert(f.launcher.closed);
  assert(f.actions.some((x) => x[1] === 'Enter' && x[2] === 'DETAILS'));
  assert(!f.actions.some((x) => x[1] === 'Enter' && x[2] === 'PLAY'));
  assert.equal(result.directoryStatus.spoken, false);
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
