/** Fixed native-zoom software observations. Never human/AT/device qualification. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { mkdir, mkdtemp, readFile, writeFile, rm, stat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  NATIVE_ZOOM_FIXTURE,
  NATIVE_ZOOM_POLICY,
  selectNativeZoom,
  readNativeZoomMetrics,
  validateZoomMetrics,
  verifyNativeZoomSequence,
} from './practice-native-zoom-capability.mjs';

export const A11Y_CASES = Object.freeze(
  ['en', 'uk'].flatMap((locale) =>
    ['civilian-flight', 'civilian-fpv', 'fpv-worlds'].map((id) =>
      Object.freeze({ id: `${locale}-${id}`, package: id, locale }),
    ),
  ),
);
export const A11Y_POLICY = Object.freeze({
  id: 'practice-directory-native-zoom-a11y.v3',
  caseMs: 90000,
  overallMs: 600000,
  actionMs: 10000,
  cleanupMs: 5000,
  maxTabs: 32,
  maxEvidenceBytes: 64 * 1024 * 1024,
});
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pin = (name, bytes) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) });
/** Source previews have no generated release identity. Retain every original
 * failure; classify only these exact optional probes, never missing app assets. */
export function classifyNativeSourceRequests(
  failures,
  { sourceShellOnly, productionQualification, buildInfoAbsent },
) {
  assert(Array.isArray(failures));
  assert.equal(typeof sourceShellOnly, 'boolean');
  assert.equal(typeof productionQualification, 'boolean');
  assert.equal(typeof buildInfoAbsent, 'boolean');
  const expected = [],
    unexpected = [];
  let builds = 0,
    icons = 0;
  for (const [index, row] of failures.entries()) {
    let reason;
    if (
      sourceShellOnly &&
      !productionQualification &&
      buildInfoAbsent &&
      row.path === '/revealline/game/build-info.json' &&
      row.message === 'Not a committed regular file.' &&
      ++builds <= A11Y_CASES.length * 2
    )
      reason = 'Absent generated release identity in committed source preview';
    else if (
      sourceShellOnly &&
      !productionQualification &&
      row.path === '/favicon.ico' &&
      row.message === 'Outside local fixture root.' &&
      ++icons <= A11Y_CASES.length * 2
    )
      reason = 'Browser default icon probe outside fixture root';
    (reason ? expected : unexpected).push({ index, ...row, ...(reason ? { reason } : {}) });
  }
  return {
    policy: 'bounded-source-preview-probes.v1',
    sourceShellOnly,
    productionQualification,
    buildInfoAbsent,
    expected,
    unexpected,
  };
}
export function validateNativeA11yPlan(plan) {
  assert.deepEqual(
    Object.keys(plan).sort(),
    [
      'format',
      'protocol',
      'repository',
      'shellRevision',
      'shellTree',
      'bundle',
      'envelopeSha256',
      'sourceRevision',
      'sourceTree',
      'packageRevision',
      'cases',
    ].sort(),
  );
  assert.equal(plan.format, 'revealline-practice-directory-native-a11y-plan.v1');
  assert.equal(plan.protocol, A11Y_POLICY.id);
  for (const key of ['repository', 'bundle'])
    assert(
      typeof plan[key] === 'string' &&
        path.isAbsolute(plan[key]) &&
        plan[key] === path.resolve(plan[key]) &&
        plan[key].length < 4096,
    );
  for (const key of ['shellRevision', 'shellTree', 'sourceRevision', 'sourceTree'])
    assert.match(plan[key], /^[a-f0-9]{40}$/);
  for (const key of ['envelopeSha256', 'packageRevision'])
    assert.match(plan[key], /^[a-f0-9]{64}$/);
  assert.deepEqual(
    plan.cases,
    A11Y_CASES.map((x) => x.id),
  );
  return plan;
}

/** Every operation remains tracked after caller timeout until native settlement. */
export function nativeA11yScope({
  overallMs = A11Y_POLICY.overallMs,
  actionMs = A11Y_POLICY.actionMs,
} = {}) {
  assert(Number.isFinite(overallMs) && overallMs > 0 && overallMs <= A11Y_POLICY.overallMs);
  assert(Number.isFinite(actionMs) && actionMs > 0 && actionMs <= A11Y_POLICY.actionMs);
  const end = performance.now() + overallMs,
    pending = new Set();
  let stopped = false;
  const check = () => assert(!stopped && performance.now() < end, 'Native a11y scope ended.');
  const run = async (label, work) => {
    check();
    const expires = Math.min(end, performance.now() + actionMs);
    let timer;
    const task = Promise.resolve().then(() => {
      check();
      return work();
    });
    pending.add(task);
    void task.then(
      () => pending.delete(task),
      () => pending.delete(task),
    );
    try {
      const value = await Promise.race([
        task,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(Error(`${label} timed out`)),
            Math.max(1, expires - performance.now()),
          );
        }),
      ]);
      check();
      assert(performance.now() < expires, `${label} exceeded absolute deadline`);
      return value;
    } finally {
      clearTimeout(timer);
    }
  };
  return {
    run,
    check,
    remaining: () => Math.max(0, end - performance.now()),
    stop: () => {
      stopped = true;
    },
    pending: () => pending.size,
    settled: () => Promise.allSettled([...pending]),
  };
}

/** Read-only, serializable witness. No focus/style/scroll mutation. */
export function readNativeFocusWitness(el) {
  const rect = el.getBoundingClientRect(),
    style = globalThis.getComputedStyle(el),
    doc = globalThis.document;
  const center = doc.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return {
    tag: el.tagName,
    id: el.id,
    text: (el.innerText ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 300),
    href: el.getAttribute('href'),
    active: doc.activeElement === el,
    focusVisible: el.matches(':focus-visible'),
    visible: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
    centerHit: center === el || el.contains(center),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    viewport: {
      width: globalThis.innerWidth,
      height: globalThis.innerHeight,
      dpr: globalThis.devicePixelRatio,
      visualScale: globalThis.visualViewport?.scale ?? null,
      visualWidth: globalThis.visualViewport?.width ?? null,
      visualHeight: globalThis.visualViewport?.height ?? null,
      visualOffsetLeft: globalThis.visualViewport?.offsetLeft ?? null,
      visualOffsetTop: globalThis.visualViewport?.offsetTop ?? null,
      outerWidth: globalThis.outerWidth,
      outerHeight: globalThis.outerHeight,
    },
    outline: { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor },
    motion: {
      animationName: style.animationName,
      transitionDuration: style.transitionDuration,
      scrollBehavior: style.scrollBehavior,
    },
    reducedMotion: globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
    documentWidth: doc.documentElement.scrollWidth,
  };
}
/** Approximate border-box geometry only, not complete painted-outline visibility.
 * Native integer innerHeight can omit a fractional visual viewport remainder.
 * Keep both raw measurements and the old decision; allow strictly less than half
 * one device pixel beyond the measured visual edge, never half a CSS pixel. */
export function nativeFocusGeometry(w, zoom) {
  const v = w.viewport;
  assert(Number.isInteger(v.width) && v.width > 0);
  assert(Number.isInteger(v.height) && v.height > 0);
  assert(Number.isFinite(v.visualWidth) && v.visualWidth > 0);
  assert(Number.isFinite(v.visualHeight) && v.visualHeight > 0);
  assert(Number.isFinite(v.dpr) && v.dpr >= 1);
  assert.equal(v.visualScale, 1);
  assert.equal(v.visualOffsetLeft, 0);
  assert.equal(v.visualOffsetTop, 0);
  assert(Math.abs(v.visualWidth - v.width) < 1);
  assert(Math.abs(v.visualHeight - v.height) < 1);
  assert(Math.abs(v.dpr - zoom.dpr) < 0.01);
  const { x, y, width, height } = w.rect;
  assert([x, y, width, height].every(Number.isFinite));
  const rightOverflowCss = Math.max(0, x + width - v.visualWidth),
    bottomOverflowCss = Math.max(0, y + height - v.visualHeight),
    rightOverflowDevicePixels = rightOverflowCss * v.dpr,
    bottomOverflowDevicePixels = bottomOverflowCss * v.dpr;
  return {
    policy: 'visual-viewport-half-device-pixel.v1',
    allowanceCss: 0.5 / v.dpr,
    rightOverflowCss,
    bottomOverflowCss,
    rightOverflowDevicePixels,
    bottomOverflowDevicePixels,
    legacyIntegerBoundsPassed:
      x >= 0 &&
      y >= 0 &&
      width > 0 &&
      height > 0 &&
      x + width <= v.width + 0.5 &&
      y + height <= v.height + 0.5,
    toleranceUsed: rightOverflowCss > 0 || bottomOverflowCss > 0,
    // Tiny inward guard makes an exact half-pixel fail despite IEEE rounding.
    withinPrecision:
      x >= 0 &&
      y >= 0 &&
      width > 0 &&
      height > 0 &&
      rightOverflowDevicePixels < 0.5 - 1e-9 &&
      bottomOverflowDevicePixels < 0.5 - 1e-9,
  };
}
export function assertNativeFocusWitness(w, zoom) {
  assert(
    w.active && w.focusVisible && w.visible && w.centerHit,
    'Focused control must be visible, active and unobscured.',
  );
  assert(w.text, 'Focused control needs visible/accessible text witness.');
  assert(nativeFocusGeometry(w, zoom).withinPrecision, 'Focused control is clipped.');
  assert(
    parseFloat(w.outline.width) > 0 &&
      !['none', 'hidden'].includes(w.outline.style) &&
      !['transparent', 'rgba(0, 0, 0, 0)'].includes(w.outline.color),
    'A computed outline witness is required; not a contrast/readability claim.',
  );
  assert(w.reducedMotion, 'Browser media override must be observed.');
  assert.equal(w.motion.animationName, 'none');
  assert(w.motion.transitionDuration.split(',').every((x) => parseFloat(x) === 0));
  assert.equal(w.viewport.visualScale, 1);
  assert(Math.abs(w.viewport.dpr - zoom.dpr) < 0.01);
  assert(Math.abs(w.viewport.outerWidth - zoom.outerWidth) <= 2);
  assert(Math.abs(w.viewport.width - zoom.innerWidth) <= 2);
  assert(w.documentWidth <= w.viewport.width + 1, 'Document has horizontal overflow.');
  return w;
}
export async function keyboardReach(page, target, run, receipt, zoom) {
  for (let i = 0; i < A11Y_POLICY.maxTabs; i++) {
    await run('Native keyboard Tab', () => page.keyboard.press('Tab'));
    if (
      await run('Read target keyboard focus', () =>
        target.evaluate((el) => globalThis.document.activeElement === el),
      )
    ) {
      const witness = await run('Read visible keyboard focus', () =>
        target.evaluate(readNativeFocusWitness),
      );
      const entry = { tabs: i + 1, ...witness, passed: false };
      receipt.push(entry);
      try {
        entry.geometry = nativeFocusGeometry(witness, zoom);
        assertNativeFocusWitness(witness, zoom);
        entry.passed = true;
      } catch (error) {
        entry.failure = error.message;
        throw error;
      }
      return witness;
    }
  }
  throw Error('Target was not reachable within32 ordinary Tab actions.');
}
/** Native menus reparent Language into Settings > Display; boot/Home mounts are not stable. */
export async function selectMainSettingsLocale(page, locale, run, receipt) {
  assert(['en', 'uk'].includes(locale));
  const selector = '#settings-dialog[open] [data-language-select]',
    control = page.locator(`${selector}:visible`),
    settings = page.locator('#settings-dialog');
  const click = async (selector) => {
    receipt.route.push(selector);
    await run('Ordinary visible locale route ' + selector, () =>
      page.locator(selector).click({ timeout: 10000 }),
    );
  };
  receipt.requested = locale;
  receipt.selector = `${selector}:visible`;
  receipt.route = [];
  receipt.before = await run('Read initial main locale', () =>
    page.locator('html').getAttribute('lang'),
  );
  receipt.action = 'none';
  if (receipt.before === locale) {
    receipt.after = receipt.before;
    receipt.settingsOpened = false;
    return;
  }
  await click('#shell-options');
  await run('Locale Settings actually open', () =>
    page.locator('#settings-dialog[open]').waitFor({ state: 'visible', timeout: 10000 }),
  );
  receipt.settingsOpened = true;
  await click('#settings-tab-display');
  await run('Display language panel visible', () =>
    page.locator('#settings-panel-display').waitFor({ state: 'visible', timeout: 10000 }),
  );
  assert.equal(await run('Unique visible Settings language control', () => control.count()), 1);
  await run('Visible Settings language control', () =>
    control.waitFor({ state: 'visible', timeout: 10000 }),
  );
  receipt.controlBefore = await run('Read Settings language value', () => control.inputValue());
  receipt.action = 'ordinary-select-option';
  await run('Select public Settings language', () =>
    control.selectOption(locale, { timeout: 10000 }),
  );
  await run('Observe selected main language', () =>
    page.waitForFunction(
      ({ selector, locale }) => {
        const visible = [...globalThis.document.querySelectorAll(selector)].filter((el) =>
          el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
        );
        return (
          globalThis.document.documentElement.lang === locale &&
          visible.length === 1 &&
          visible[0].value === locale
        );
      },
      { selector, locale },
      { timeout: 10000 },
    ),
  );
  receipt.after = await run('Read selected main locale', () =>
    page.locator('html').getAttribute('lang'),
  );
  receipt.controlAfter = await run('Read selected Settings language value', () =>
    control.inputValue(),
  );
  assert.equal(receipt.after, locale);
  assert.equal(receipt.controlAfter, locale);
  receipt.back = [];
  for (let i = 0; i < 2; i++) {
    await click('#settings-dialog[open] [data-close="settings-dialog"]');
    const open = await run('Read actual Settings open state', () => settings.getAttribute('open'));
    const view = await run('Read Settings navigation state', () =>
      settings.getAttribute('data-settings-view'),
    );
    receipt.back.push({ open: open !== null, view });
    if (open === null) break;
    assert.equal(view, 'categories', 'Back must leave the panel before closing Settings.');
  }
  assert.equal(
    await run('Settings modal actually closed', () => settings.getAttribute('open')),
    null,
  );
  await run('Home restored after locale selection', () =>
    page.locator('#shell-home[open]').waitFor({ state: 'visible', timeout: 10000 }),
  );
  receipt.settingsClosed = true;
}
const closeServer = async (owned) => {
  owned.stop?.();
  owned.server.closeAllConnections?.();
  await new Promise((resolve, reject) =>
    owned.server.close((error) => (error ? reject(error) : resolve())),
  );
  await owned.settled?.();
};
export function trackNativeServerRequests(owned) {
  // Newer maintained servers already own their internal async reads.
  if (typeof owned.pending === 'function' && typeof owned.settled === 'function') return owned;
  const handlers = owned.server.listeners('request');
  assert.equal(handlers.length, 1);
  const pending = new Set();
  owned.server.removeListener('request', handlers[0]);
  owned.server.on('request', (req, res) => {
    const work = Promise.resolve().then(() => handlers[0](req, res));
    pending.add(work);
    void work.then(
      () => pending.delete(work),
      () => pending.delete(work),
    );
  });
  return { ...owned, pending: () => pending.size, settled: () => Promise.allSettled([...pending]) };
}
export function nativeProfileRemovalAllowed({
  lateCreation = false,
  stopped = false,
  launchAttempted = false,
  pendingOperations = 0,
  resourcesClosed = false,
  cleanupComplete = false,
  zoomResetVerified = false,
}) {
  if (lateCreation) return stopped && !launchAttempted;
  return pendingOperations === 0 && resourcesClosed && cleanupComplete && zoomResetVerified;
}
async function metricServer() {
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/native-zoom') {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    });
    res.end(NATIVE_ZOOM_FIXTURE);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/native-zoom` };
}

export async function runNativeA11yCase({
  page,
  spec,
  fixture,
  run,
  report,
  capture,
  unlock,
  openPractice,
  assertLink,
  zoom,
  password,
  acquire,
}) {
  const result = {
    ...spec,
    passed: false,
    focus: [],
    access: [],
    screenshots: [],
    errors: [],
    motionScope: 'Browser reduced-motion emulation; sampled visible controls only.',
  };
  report.cases.push(result);
  const root = new URL('revealline/', fixture.url),
    main = new URL(`game/?lang=${spec.locale}`, root).href;
  let launcher;
  const normalAccess = async (p, label) =>
    result.access.push({
      surface: label,
      submitted: await run('Normal access form', () => unlock(p, password)),
    });
  const click = async (p, selector) =>
    run('Ordinary visible control ' + selector, () =>
      p.locator(selector).click({ timeout: 10000 }),
    );
  const focus = async (p, locator) => keyboardReach(p, locator, run, result.focus, zoom);
  const observe = (p) =>
    p.on('pageerror', (e) => {
      if (result.errors.length < 20) result.errors.push(e.message.slice(0, 1024));
    });
  observe(page);
  try {
    await run('Emulate reduced motion on main page', () =>
      page.emulateMedia({ reducedMotion: 'reduce' }),
    );
    await run('Open localized main game', () =>
      page.goto(main, { waitUntil: 'domcontentloaded', timeout: 10000 }),
    );
    await normalAccess(page, 'main');
    await run('Main Home visible', () =>
      page.locator('#shell-home[open]').waitFor({ state: 'visible', timeout: 10000 }),
    );
    result.mainLocaleSelection = {};
    await selectMainSettingsLocale(page, spec.locale, run, result.mainLocaleSelection);
    await openPractice(page, click);
    const dialog = page.locator('#optional-practice-dialog[open]'),
      rows = dialog.locator('.optional-practice-packages > li');
    await run('Three published cards', () =>
      page.waitForFunction(
        () =>
          globalThis.document.querySelectorAll(
            '#optional-practice-dialog .optional-practice-packages > li',
          ).length === 3,
        null,
        { timeout: 10000 },
      ),
    );
    const index = fixture.packages.findIndex((x) => x.id === spec.package),
      row = rows.nth(index),
      copy = fixture.details.find((x) => x.id === spec.package).description.copy[spec.locale];
    assert.equal(
      (await run('Localized package title', () => row.locator('h3').innerText())).trim(),
      copy.name,
    );
    result.localizedTitle = copy.name;
    const status = dialog.locator('[role="status"]');
    assert.equal(
      await run('Directory status live semantics', () => status.getAttribute('aria-live')),
      'polite',
    );
    result.directoryStatus = { role: 'status', live: 'polite', spoken: false };
    await focus(page, page.locator('#optional-practice-refresh'));
    await focus(page, row.locator('a').nth(0));
    result.playLink = assertLink(
      await run('Read Play destination', () => row.locator('a').nth(0).getAttribute('href')),
      { origin: root.origin, id: spec.package, locale: spec.locale, play: true },
    );
    const details = row.locator('a').nth(1);
    await focus(page, details);
    assertLink(await run('Read Details destination', () => details.getAttribute('href')), {
      origin: root.origin,
      id: spec.package,
      locale: spec.locale,
      play: false,
    });
    result.screenshots.push(
      await capture(details, spec.id + '-directory-focus'),
      await capture(page, spec.id + '-directory-page'),
    );
    launcher = await acquire(
      'Details popup ' + spec.id,
      async () => {
        const popup = page.waitForEvent('popup', { timeout: 10000 });
        void popup.catch(() => {});
        await run('Activate focused Details link', () => page.keyboard.press('Enter'));
        return popup;
      },
      (p) => p.close(),
    );
    observe(launcher);
    await run('Show owned launcher tab', () => launcher.bringToFront());
    await run('Emulate reduced motion on launcher', () =>
      launcher.emulateMedia({ reducedMotion: 'reduce' }),
    );
    await normalAccess(launcher, 'launcher');
    await run('Launcher details available', () =>
      launcher.locator('#guide').waitFor({ state: 'visible', timeout: 10000 }),
    );
    assert.equal(
      await run('Launcher locale', () => launcher.locator('html').getAttribute('lang')),
      spec.locale,
    );
    result.onboarding = (
      await run('Localized launcher first-flight instructions', () =>
        launcher.locator('#firstFlight').innerText(),
      )
    ).trim();
    assert.equal(result.onboarding, copy.firstFlight);
    assert.equal(
      await run('Launcher status live semantics', () =>
        launcher.locator('#status').getAttribute('aria-live'),
      ),
      'polite',
    );
    assert.equal(
      await run('Launcher status role', () => launcher.locator('#status').getAttribute('role')),
      'status',
    );
    result.launcherStatus = { role: 'status', live: 'polite', spoken: false };
    for (const id of ['check', 'prepare', 'directory', 'game', 'guide'])
      await focus(launcher, launcher.locator('#' + id));
    const guide = new URL(
        `practice/${spec.package}/releases/${fixture.version}/site/optional-practice/${spec.package}/guide.html?lang=${spec.locale}`,
        root,
      ).href,
      directory = new URL(`practice/?lang=${spec.locale}`, root).href;
    assert.equal(
      await run('Guide route', () => launcher.locator('#guide').getAttribute('href')),
      guide,
    );
    assert.equal(
      await run('Directory route', () => launcher.locator('#directory').getAttribute('href')),
      directory,
    );
    assert.equal(
      await run('Main route', () => launcher.locator('#game').getAttribute('href')),
      main,
    );
    result.screenshots.push(await capture(launcher.locator('#guide'), spec.id + '-launcher-focus'));
    await run('Open guide by keyboard', () => launcher.keyboard.press('Enter'));
    await run('Localized guide URL', () => launcher.waitForURL(guide, { timeout: 10000 }));
    await normalAccess(launcher, 'guide');
    await run('Localized guide heading', () =>
      launcher
        .locator(`section[lang="${spec.locale}"] h1`)
        .waitFor({ state: 'visible', timeout: 10000 }),
    );
    assert.equal(
      await run('Guide locale', () => launcher.locator('html').getAttribute('lang')),
      spec.locale,
    );
    // Guide style is outside this sampled focus contract; ordinary link action still proves reachability.
    await click(launcher, '#directory');
    await run('Standalone directory URL', () => launcher.waitForURL(directory, { timeout: 10000 }));
    assert.equal(await run('Standalone card count', () => launcher.locator('article').count()), 3);
    await focus(launcher, launcher.locator('nav a[data-locale]').first());
    await run('Return to main by keyboard', () => launcher.keyboard.press('Enter'));
    await run('Main return route', () => launcher.waitForURL(main, { timeout: 10000 }));
    await normalAccess(launcher, 'main return');
    await run('Main return Home', () =>
      launcher.locator('#shell-home[open]').waitFor({ state: 'visible', timeout: 10000 }),
    );
    result.mainReturnLocale = await run('Read actual main return language', () =>
      launcher.locator('html').getAttribute('lang'),
    );
    assert.equal(
      result.mainReturnLocale,
      spec.locale,
      'Main return must retain requested language.',
    );
    await run('Close owned details tab', () => launcher.close());
    launcher = null;
    await run('Return to original directory', () => page.bringToFront());
    await focus(page, page.locator('#optional-practice-close'));
    await run('Escape directory', () => page.keyboard.press('Escape'));
    await run('Wait for native opener focus restoration', () =>
      page.waitForFunction(
        () => globalThis.document.activeElement?.id === 'shell-home-practice',
        null,
        { timeout: 10000 },
      ),
    );
    assert.equal(
      await run('Directory closed', () =>
        page.locator('#optional-practice-dialog').getAttribute('open'),
      ),
      null,
    );
    result.escapeFocus = await run('Read restored opener', () =>
      page.evaluate(() => globalThis.document.activeElement?.id),
    );
    assert.equal(result.escapeFocus, 'shell-home-practice');
    result.escapeFocusWitness = await run('Read visible restored opener focus', () =>
      page.locator('#shell-home-practice').evaluate(readNativeFocusWitness),
    );
    result.escapeFocusGeometry = nativeFocusGeometry(result.escapeFocusWitness, zoom);
    assertNativeFocusWitness(result.escapeFocusWitness, zoom);
    result.guideAndReturn = true;
    result.passed = result.errors.length === 0;
  } catch (error) {
    result.failure = error.message;
  }
  return result;
}

export async function observeNativeDirectoryA11y({
  plan,
  playwrightModule,
  output,
  password = process.env.OPTIONAL_INSTALLATION_PASSWORD,
}) {
  validateNativeA11yPlan(plan);
  assert(path.isAbsolute(playwrightModule) && path.isAbsolute(output));
  await mkdir(output);
  const report = {
    format: 'PracticeDirectoryNativeZoomA11yObservation.v1',
    protocol: A11Y_POLICY,
    plan,
    passed: false,
    qualified: false,
    publicEligible: false,
    sourceShellOnly: true,
    productionQualification: false,
    reducedMotion: 'Playwright media override, not OS preference',
    cases: [],
    authority: [],
    servedSources: [],
    requestFailures: [],
    resources: [],
    cleanup: [],
    zoomSteps: [],
    zoomActions: [],
    limitations: [
      'Computed outlines, hit testing and media styles do not establish human readability, contrast quality or spoken screen-reader announcements.',
      'Border-box edge measurements use the fractional visual viewport with strictly less than half a device pixel tolerance; residuals and legacy decisions are retained. This is not literal zero clipping or complete painted-outline visibility.',
      'Keyboard Tab only; no human, physical controller, touch, VoiceOver or OS preference/device qualification.',
      'Native zoom screenshots can be cropped by the browser; locator images and page corroboration require independent visual review.',
      'Full committed source shell plus admitted package overlay only, never a production build fallback. Play destinations are inspected but no flight is started.',
    ],
  };
  const total = nativeA11yScope(),
    resources = [],
    scopes = [total];
  let context,
    settings,
    metric,
    server,
    profile,
    stopped = false,
    launchAttempted = false,
    evidenceBytes = 0;
  const cleanup = async (label, work) => {
    const scope = nativeA11yScope({ overallMs: 5000, actionMs: 5000 });
    scopes.push(scope);
    try {
      await scope.run(label, work);
      report.cleanup.push({ label, closed: true });
      return true;
    } catch (error) {
      report.cleanup.push({ label, closed: false, message: error.message });
      return false;
    } finally {
      scope.stop();
    }
  };
  const acquire = async (label, work, release, run = total.run) => {
    const row = { label, pending: true, acquired: false, late: false, closed: false };
    report.resources.push(row);
    return run(label, async () => {
      let value;
      try {
        value = await work();
      } finally {
        row.pending = false;
      }
      row.acquired = true;
      const owned = {
        row,
        release: async () => {
          if (!row.closed) {
            await release(value);
            row.closed = true;
          }
        },
      };
      resources.push(owned);
      if (stopped || row.expired) {
        row.late = true;
        await cleanup('Late ' + label, owned.release);
        throw Error('Resource arrived after observation stopped.');
      }
      return value;
    }).catch((error) => {
      row.expired = true;
      row.error = error.message;
      throw error;
    });
  };
  const capture = async (target, name) =>
    total.run('Capture ' + name, async () => {
      const bytes = await target.screenshot({ timeout: 5000 });
      evidenceBytes += bytes.length;
      assert(evidenceBytes <= A11Y_POLICY.maxEvidenceBytes);
      await writeFile(path.join(output, name + '.png'), bytes, { flag: 'wx' });
      return {
        ...pin(name + '.png', bytes),
        pixelWidth: bytes.readUInt32BE(16),
        pixelHeight: bytes.readUInt32BE(20),
        visuallyReviewed: false,
      };
    });
  try {
    const load = (name) => import(pathToFileURL(path.join(plan.repository, 'scripts', name)).href);
    const [helpers, frozen, { unlockObservedPage }] = await total.run(
      'Load maintained source and admission helpers',
      () =>
        Promise.all([
          load('observe-practice-directory-journey.mjs'),
          load('frozen-source.mjs'),
          load('optional-installation-observer-helpers.mjs'),
        ]),
    );
    const source = () =>
      assert.deepEqual(frozen.frozenSource(plan.repository), {
        sourceRevision: plan.shellRevision,
        sourceTree: plan.shellTree,
      });
    await total.run('Verify initial clean source identity', source);
    const sourceNames = [
      'scripts/observe-practice-directory-journey.mjs',
      'scripts/optional-installation-observer-helpers.mjs',
      'scripts/fpv-observation-artifact.mjs',
      'scripts/frozen-source.mjs',
      'scripts/game-cli.mjs',
      'publishing/edition-zip.mjs',
      'publishing/optional-package-admission.mjs',
      'publishing/practice-directory.mjs',
    ];
    for (const name of sourceNames)
      report.authority.push(
        pin(
          name,
          await total.run('Read authority ' + name, () =>
            readFile(path.join(plan.repository, name)),
          ),
        ),
      );
    report.observer = pin(
      'observe-practice-directory-native-a11y.mjs',
      await total.run('Read observer authority', () => readFile(fileURLToPath(import.meta.url))),
    );
    report.zoomHelper = pin(
      'practice-native-zoom-capability.mjs',
      await total.run('Read zoom helper authority', () =>
        readFile(new URL('./practice-native-zoom-capability.mjs', import.meta.url)),
      ),
    );
    const tree = await total.run('Read committed source tree', () =>
        frozen.committedInputMap(plan.repository),
      ),
      overlay = await total.run('Admit original packages', () =>
        helpers.directoryJourneyOverlay(plan),
      );
    report.artifact = overlay.loaded.binding;
    report.admission = overlay.loaded.admission;
    report.overlay = [...overlay.files].map(([name, bytes]) => pin(name, bytes));
    server = await acquire(
      'Owned source shell server',
      async () =>
        trackNativeServerRequests(
          await helpers.directoryJourneyServer(overlay.files, tree, report),
        ),
      closeServer,
    );
    metric = await acquire('Owned metric fixture server', metricServer, closeServer);
    profile = await acquire(
      'Create owned profile',
      () => mkdtemp(path.join(tmpdir(), 'practice-native-a11y-')),
      async (value) => {
        // Ordinary release defers deletion until all native operations have settled.
        // A late profile with no browser use can be removed immediately and safely.
        if (nativeProfileRemovalAllowed({ lateCreation: true, stopped, launchAttempted })) {
          await rm(value, { recursive: true });
          report.profileRemoved = true;
        }
      },
    );
    report.profilePath = profile;
    const { chromium } = await total.run(
      'Load existing Playwright runtime',
      () => import(pathToFileURL(playwrightModule).href),
    );
    total.check();
    launchAttempted = true;
    report.browserLaunchAttempted = true;
    context = await acquire(
      'Owned headed Chrome',
      () =>
        chromium.launchPersistentContext(profile, {
          channel: 'chrome',
          headless: false,
          viewport: null,
          locale: 'en-US',
          args: ['--window-size=1280,900'],
          timeout: 10000,
        }),
      (c) => c.close(),
    );
    settings = await acquire(
      'Owned native Settings tab',
      () => context.newPage(),
      (p) => p.close(),
    );
    const metricsPage = await acquire(
      'Owned metric tab',
      () => context.newPage(),
      (p) => p.close(),
    );
    const cdp = await acquire(
      'Read-only browser version session',
      () => context.newCDPSession(metricsPage),
      (s) => s.detach(),
    );
    report.browser = await total.run('Actual Chrome version', () => cdp.send('Browser.getVersion'));
    await total.run('Open native Settings', () =>
      settings.goto(NATIVE_ZOOM_POLICY.settingsURL, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      }),
    );
    const zoomStep = async (value) => {
      const control = await selectNativeZoom(settings, value, total.run, report.zoomActions);
      await total.run('Show metric fixture', () => metricsPage.bringToFront());
      await total.run('Load metric fixture', () =>
        metricsPage.goto(metric.url, { waitUntil: 'domcontentloaded', timeout: 10000 }),
      );
      const metrics = validateZoomMetrics(
        await total.run('Actual native geometry', () =>
          metricsPage.evaluate(readNativeZoomMetrics),
        ),
      );
      report.zoomSteps.push({ requested: value, control, metrics });
      return metrics;
    };
    await zoomStep('1');
    const zoom = await zoomStep('2');
    const fixture = {
      ...server,
      packages: overlay.packages,
      details: overlay.details,
      version: overlay.loaded.binding.version,
    };
    for (const spec of A11Y_CASES) {
      total.check();
      const scope = nativeA11yScope({
        overallMs: Math.min(A11Y_POLICY.caseMs, total.remaining()),
        actionMs: 10000,
      });
      scopes.push(scope);
      const run = (label, work) => {
        total.check();
        return scope.run(label, work);
      };
      let page;
      const resourceStart = resources.length;
      try {
        page = await acquire(
          'Main case ' + spec.id,
          () => context.newPage(),
          (p) => p.close(),
          run,
        );
        await runNativeA11yCase({
          page,
          spec,
          fixture,
          run,
          report,
          capture: (target, name) => run('Case screenshot ' + name, () => capture(target, name)),
          unlock: unlockObservedPage,
          openPractice: helpers.openMainGamePractice,
          assertLink: helpers.assertDirectoryLink,
          zoom,
          password,
          acquire: (label, work, release) => acquire(label, work, release, run),
        });
      } finally {
        scope.stop();
        for (const owned of resources.slice(resourceStart).reverse())
          await cleanup('Close case ' + spec.id + ' ' + owned.row.label, owned.release);
        await cleanup('Join case ' + spec.id, () => scope.settled());
      }
    }
    await zoomStep('1');
    report.zoomVerified = verifyNativeZoomSequence(report.zoomSteps);
    report.zoomResetVerified = true;
    for (const owned of [...resources].reverse())
      await cleanup('Release before source recheck ' + owned.row.label, owned.release);
    if (server) {
      await cleanup('Join source server requests', () => server.settled());
      assert.equal(server.pending(), 0);
    }
    await total.run('Verify source after browser closure', source);
    for (const row of report.servedSources) {
      const bytes = await total.run('Recheck served source ' + row.path, () =>
        readFile(path.join(plan.repository, row.path)),
      );
      assert.equal(sha(bytes), row.sha256);
      frozen.verifyCommittedInputs(new Map([[row.path, bytes]]), tree);
    }
    const again = await total.run('Re-admit unchanged package artifacts', () =>
      helpers.directoryJourneyOverlay(plan),
    );
    assert.deepEqual(
      [...again.files].map(([name, bytes]) => pin(name, bytes)),
      report.overlay,
    );
    for (const row of report.authority)
      assert.equal(
        sha(
          await total.run('Recheck authority ' + row.path, () =>
            readFile(path.join(plan.repository, row.path)),
          ),
        ),
        row.sha256,
      );
    assert.equal(
      sha(
        await total.run('Recheck observer authority', () =>
          readFile(fileURLToPath(import.meta.url)),
        ),
      ),
      report.observer.sha256,
    );
    assert.equal(
      sha(
        await total.run('Recheck zoom helper authority', () =>
          readFile(new URL('./practice-native-zoom-capability.mjs', import.meta.url)),
        ),
      ),
      report.zoomHelper.sha256,
    );
    await total.run('Final clean source identity', source);
    total.check();
    report.sourceStable = true;
    report.requestClassification = classifyNativeSourceRequests(report.requestFailures, {
      sourceShellOnly: report.sourceShellOnly,
      productionQualification: report.productionQualification,
      buildInfoAbsent: !tree.has('game/build-info.json'),
    });
    report.passed =
      report.cases.length === 6 &&
      report.cases.every((x) => x.passed) &&
      report.requestClassification.unexpected.length === 0;
  } catch (error) {
    report.failure = error.message;
  } finally {
    stopped = true;
    total.stop();
    if (settings && !report.zoomResetVerified) {
      const scope = nativeA11yScope({ overallMs: 5000, actionMs: 5000 });
      scopes.push(scope);
      try {
        await selectNativeZoom(settings, '1', scope.run, report.zoomActions);
        report.zoomResetVerified = true;
      } catch (error) {
        report.cleanup.push({ label: 'Reset native zoom', closed: false, message: error.message });
      } finally {
        scope.stop();
      }
    }
    for (const owned of [...resources].reverse())
      await cleanup('Release ' + owned.row.label, owned.release);
    if (server) await cleanup('Join source server requests', () => server.settled());
    for (const scope of scopes.slice())
      await cleanup('Join underlying operations', () => scope.settled());
    report.pendingOperations =
      scopes.reduce((n, s) => n + s.pending(), 0) + (server?.pending() ?? 0);
    // Reclassify after every request/native operation settles; a late unexpected
    // request cannot escape the earlier success calculation.
    if (report.requestClassification) {
      report.requestClassification = classifyNativeSourceRequests(report.requestFailures, {
        sourceShellOnly: report.sourceShellOnly,
        productionQualification: report.productionQualification,
        buildInfoAbsent: report.requestClassification.buildInfoAbsent,
      });
      report.passed &&= report.requestClassification.unexpected.length === 0;
    }
    report.profileRemoved ??= false;
    if (
      profile &&
      nativeProfileRemovalAllowed({
        pendingOperations: report.pendingOperations,
        cleanupComplete: report.cleanup.every((x) => x.closed),
        resourcesClosed: report.resources.every((x) => !x.pending && (!x.acquired || x.closed)),
        zoomResetVerified: Boolean(report.zoomResetVerified),
      })
    ) {
      report.profileRemoved = await cleanup('Remove owned profile', () =>
        rm(profile, { recursive: true }),
      );
    }
    report.passed &&= Boolean(
      report.zoomResetVerified &&
        report.profileRemoved &&
        !report.pendingOperations &&
        report.cleanup.every((x) => x.closed),
    );
    await writeFile(path.join(output, 'observation.json'), JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
    });
  }
  return report;
}
if (process.argv[1] && (await realpath(process.argv[1])) === fileURLToPath(import.meta.url)) {
  assert.equal(process.env.PRACTICE_NATIVE_DIRECTORY_A11Y, '1');
  assert.equal(process.argv.length, 5);
  assert((await stat(process.argv[2])).size <= 65536);
  const plan = JSON.parse(await readFile(process.argv[2], 'utf8'));
  const report = await observeNativeDirectoryA11y({
    plan,
    playwrightModule: process.argv[3],
    output: process.argv[4],
  });
  console.log(
    JSON.stringify({
      passed: report.passed,
      qualified: false,
      failure: report.failure,
      cases: report.cases.map((x) => ({ id: x.id, passed: x.passed, failure: x.failure })),
    }),
  );
  process.exitCode = report.passed ? 0 : 1;
}
