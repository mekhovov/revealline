/** Opt-in desktop-software minimization diagnostic; never synthesizes DOM events. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { validateHistoricalSessionURL } from './optional-installation-active-session.mjs';
import { ORDINARY_WINDOW_MODE } from './optional-installation-ordinary-window.mjs';
export const ACTIVE_WINDOW_MODE = 'owned-window-minimize-98ad851';
export const FOCUS_SOURCE_SHA256 =
  '9393fa79e1c67c74edc26b610d65a4f7ed73d345a762465cc88340a33a2454ac';
const owned = new WeakSet();
export function selectHistoricalWindowMode(value) {
  if (value === undefined) return false;
  assert([ACTIVE_WINDOW_MODE, ORDINARY_WINDOW_MODE].includes(value));
  return true;
}
async function deadline(work, ms) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Owned-window operation deadline exceeded')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function call(g, name, work, acquire = false, timeoutMs = g.timeoutMs) {
  assert(owned.has(g) && !g.closed && !g.failed, 'Owned-window guard unavailable.');
  const row = { name, pending: true };
  g.operations.push(row);
  const promise = Promise.resolve()
    .then(() => {
      assert(!g.closed && !g.failed);
      return work();
    })
    .then(async (result) => {
      if (acquire && (g.closed || g.failed)) await result.detach();
      return result;
    })
    .finally(() => {
      row.pending = false;
    });
  void promise.catch(() => {
    row.failed = true;
  });
  try {
    return await deadline(() => promise, timeoutMs);
  } catch (error) {
    g.failed = true;
    g.receipt.failure = name;
    throw error;
  }
}
async function send(g, session, method, params) {
  g.receipt.commands.push({ method, params });
  return call(g, method, () => session.send(method, params));
}
function normalBounds(value) {
  assert.equal(value.windowState, 'normal', 'Owned windows must start normal, not user-minimized.');
  for (const key of ['left', 'top', 'width', 'height']) assert(Number.isSafeInteger(value[key]));
  assert(value.width > 0 && value.height > 0);
  return { left: value.left, top: value.top, width: value.width, height: value.height };
}
async function waitForBounds(g, expected, { geometry = false, cleanup = false } = {}) {
  const started = performance.now(),
    limit = Math.min(1500, g.timeoutMs),
    end = started + limit;
  const observation = { expected, geometry, cleanup, limitMs: limit, passed: false, samples: [] };
  (g.receipt.windowTransitions ??= []).push(observation);
  try {
    for (;;) {
      const left = end - performance.now();
      assert(left > 0, `Native window did not reach ${expected} within ${limit}ms.`);
      let result;
      if (cleanup) {
        const row = { name: 'cleanup bounds read', pending: true };
        g.operations.push(row);
        const read = Promise.resolve()
          .then(() => g.sa.send('Browser.getWindowBounds', { windowId: g.aWindow }))
          .finally(() => {
            row.pending = false;
          });
        result = await deadline(() => read, left);
      } else {
        result = await call(
          g,
          `observe native ${expected} bounds`,
          () => g.sa.send('Browser.getWindowBounds', { windowId: g.aWindow }),
          false,
          left,
        );
      }
      assert(performance.now() < end, `Native ${expected} observation arrived beyond ${limit}ms.`);
      const bounds = result.bounds;
      assert(['normal', 'minimized', 'maximized', 'fullscreen'].includes(bounds?.windowState));
      assert(observation.samples.length < 32);
      observation.samples.push({
        elapsedMs: Math.round(performance.now() - started),
        bounds: { ...bounds },
      });
      if (
        bounds.windowState === expected &&
        (!geometry ||
          ['left', 'top', 'width', 'height'].every((key) => bounds[key] === g.aBounds[key]))
      ) {
        observation.passed = true;
        return bounds;
      }
      const wait = Math.min(50, end - performance.now());
      assert(wait > 0, `Native window did not reach ${expected} within ${limit}ms.`);
      await pause(wait);
    }
  } catch (error) {
    observation.failure = error.message;
    if (!cleanup) {
      g.failed = true;
      g.receipt.failure = `native ${expected} transition`;
    }
    throw error;
  }
}
export async function configureHistoricalSessionWindow({
  context,
  previousPage,
  updatePage,
  expectedPreviousURL,
  expectedUpdateURL,
  mode,
  playwrightSourceSha256,
  receipt,
  timeoutMs = 5000,
}) {
  assert(selectHistoricalWindowMode(mode), 'Explicit owned-window opt-in required.');
  assert.equal(
    playwrightSourceSha256,
    FOCUS_SOURCE_SHA256,
    'Caller must hash the installed Playwright focus-default source.',
  );
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 5000);
  assert(receipt && typeof receipt === 'object');
  validateHistoricalSessionURL(expectedPreviousURL);
  const aURL = new URL(expectedPreviousURL),
    bURL = new URL(expectedUpdateURL);
  assert.equal(bURL.origin, aURL.origin);
  assert(!bURL.username && !bURL.password && !bURL.hash && bURL.href === expectedUpdateURL);
  const packageRoot = aURL.pathname.split('/releases/')[0] + '/';
  assert(bURL.pathname.startsWith(packageRoot) && (!bURL.search || bURL.search === '?lang=en'));
  assert(
    previousPage !== updatePage &&
      previousPage.context() === context &&
      updatePage.context() === context,
  );
  assert(context.pages().includes(previousPage) && context.pages().includes(updatePage));
  assert.equal(previousPage.url(), expectedPreviousURL);
  assert.equal(updatePage.url(), expectedUpdateURL);
  const g = {
    context,
    a: previousPage,
    b: updatePage,
    receipt,
    timeoutMs,
    operations: [],
    stage: 'configuring',
    closed: false,
    failed: false,
  };
  owned.add(g);
  Object.assign(receipt, {
    format:
      mode === ORDINARY_WINDOW_MODE
        ? 'HistoricalOrdinaryWindowMinimization.v1'
        : 'HistoricalOwnedWindowMinimization.v1',
    mode,
    configured: false,
    ordinaryWindowSwitchQualified: false,
    physicalDeviceQualified: false,
    playwrightSourceSha256,
    focusSourceLines: [37392, 37400],
    commands: [],
  });
  try {
    if (mode === ORDINARY_WINDOW_MODE) {
      assert.equal(
        await call(g, 'verify normal browser display mode', () =>
          previousPage.evaluate(() => globalThis.matchMedia('(display-mode: standalone)').matches),
        ),
        false,
      );
      receipt.standaloneQualified = false;
      receipt.scope =
        'Owned ordinary browser window only; installed-PWA minimization failures remain unqualified.';
    }
    g.sa = await call(
      g,
      'acquire owned A session',
      () => context.newCDPSession(previousPage),
      true,
    );
    g.sb = await call(g, 'acquire owned B session', () => context.newCDPSession(updatePage), true);
    for (const [key, session, expected] of [
      ['a', g.sa, expectedPreviousURL],
      ['b', g.sb, expectedUpdateURL],
    ]) {
      const { targetInfo } = await send(g, session, 'Target.getTargetInfo', {});
      assert.equal(targetInfo.url, expected);
      const result = await send(g, session, 'Browser.getWindowForTarget', {
        targetId: targetInfo.targetId,
      });
      assert(Number.isInteger(result.windowId));
      const originalBounds = normalBounds(result.bounds);
      g[key + 'Window'] = result.windowId;
      g[key + 'Bounds'] = originalBounds;
      receipt[key] = {
        targetId: targetInfo.targetId,
        url: expected,
        windowId: result.windowId,
        originalBounds: g[key + 'Bounds'],
      };
    }
    assert.notEqual(g.aWindow, g.bWindow, 'A and B must be distinct owned windows.');
    for (const session of [g.sa, g.sb])
      await send(g, session, 'Emulation.setFocusEmulationEnabled', { enabled: false });
    g.stage = 'configured';
    receipt.configured = true;
    return g;
  } catch (error) {
    g.failed = true;
    await disposeHistoricalSessionWindow(g);
    throw error;
  }
}
export async function minimizeHistoricalSessionWindow(g) {
  assert.equal(g.stage, 'configured');
  assert.equal(g.a.url(), g.receipt.a.url, 'Pinned A URL changed before minimization.');
  // Caller must have completed the genuine public-UI flight preparation first.
  g.windowTouched = true;
  await send(g, g.sa, 'Browser.setWindowBounds', {
    windowId: g.aWindow,
    bounds: { windowState: 'minimized' },
  });
  await waitForBounds(g, 'minimized');
  g.stage = 'minimized';
  g.receipt.minimized = true;
  // This alone is NOT a pause witness; caller must capture native phase/focus afterward.
}
export async function restoreHistoricalSessionWindow(g) {
  assert.equal(g.stage, 'minimized');
  await send(g, g.sa, 'Browser.setWindowBounds', {
    windowId: g.aWindow,
    bounds: { windowState: 'normal' },
  });
  await waitForBounds(g, 'normal');
  await send(g, g.sa, 'Browser.setWindowBounds', { windowId: g.aWindow, bounds: g.aBounds });
  await waitForBounds(g, 'normal', { geometry: true });
  await call(g, 'foreground restored A', () => g.a.bringToFront());
  g.stage = 'restored';
  g.receipt.restored = true;
}
export async function disposeHistoricalSessionWindow(g) {
  assert(owned.has(g));
  if (g.closed) return g.receipt.cleanup;
  g.closed = true;
  const pendingAtStart = g.operations.filter((row) => row.pending).map((row) => row.name);
  const results = [];
  async function attempt(name, work) {
    try {
      await deadline(work, g.timeoutMs);
      results.push({ name, passed: true });
    } catch {
      results.push({ name, passed: false });
    }
  }
  // Each cleanup attempt is independent. A failed restore cannot skip defaults or detach.
  if (g.windowTouched && g.sa && g.aWindow !== undefined) {
    await attempt('restore A normal state', () =>
      g.sa.send('Browser.setWindowBounds', {
        windowId: g.aWindow,
        bounds: { windowState: 'normal' },
      }),
    );
    await attempt('verify A normal state', () => waitForBounds(g, 'normal', { cleanup: true }));
    if (g.aBounds)
      await attempt('restore A original bounds', () =>
        g.sa.send('Browser.setWindowBounds', { windowId: g.aWindow, bounds: g.aBounds }),
      );
    await attempt('verify A original normal bounds', () =>
      waitForBounds(g, 'normal', { cleanup: true, geometry: true }),
    );
  }
  for (const [name, session] of [
    ['A', g.sa],
    ['B', g.sb],
  ])
    if (session) {
      await attempt(`restore ${name} default focus emulation`, () =>
        session.send('Emulation.setFocusEmulationEnabled', { enabled: true }),
      );
      await attempt(`detach ${name}`, () => session.detach());
    }
  const pending = g.operations.filter((row) => row.pending).map((row) => row.name);
  g.receipt.cleanup = {
    completed:
      results.every((row) => row.passed) && pending.length === 0 && pendingAtStart.length === 0,
    pendingAtStart,
    pending,
    results,
  };
  return g.receipt.cleanup;
}
