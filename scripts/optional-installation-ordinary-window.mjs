/** Explicit normal-window C5 diagnostic; never opens user profiles or authenticates. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { validateHistoricalSessionURL } from './optional-installation-active-session.mjs';
export const ORDINARY_WINDOW_MODE = 'ordinary-browser-minimize-98ad851';
const owned = new WeakSet();
export function selectHistoricalOrdinaryWindow(value) {
  return value === ORDINARY_WINDOW_MODE;
}
async function bounded(work, ms) {
  const end = performance.now() + ms;
  let timer;
  try {
    const value = await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('Ordinary-window operation timed out.')), ms);
      }),
    ]);
    assert(performance.now() < end, 'Ordinary-window response arrived late.');
    return value;
  } finally {
    clearTimeout(timer);
  }
}
function check(g) {
  assert(owned.has(g) && !g.closed && !g.failed);
  g.signal?.throwIfAborted();
  assert(
    Date.now() < g.deadlineAt && performance.now() < g.end,
    'Ordinary-window acquisition deadline exceeded.',
  );
}
async function operation(g, name, work, late, onResolved, lateReject) {
  check(g);
  const row = { name, pending: true };
  g.receipt.operations.push(row);
  const task = Promise.resolve()
    .then(() => {
      check(g);
      return work();
    })
    .then(async (value) => {
      // Transfer ownership inside fulfillment, before any awaited return/deadline
      // check can fail. A later microtask stall must not orphan this resource.
      onResolved?.(value);
      if (
        g.closed ||
        g.failed ||
        g.signal?.aborted ||
        Date.now() >= g.deadlineAt ||
        performance.now() >= g.end
      ) {
        g.failed = true;
        if (late) {
          try {
            await late(value);
          } catch (error) {
            row.lateCleanupFailed = true;
            throw error;
          }
        }
      }
      return value;
    })
    .catch(async (error) => {
      if (
        lateReject &&
        (g.closed ||
          g.failed ||
          g.signal?.aborted ||
          Date.now() >= g.deadlineAt ||
          performance.now() >= g.end)
      ) {
        try {
          await lateReject();
        } catch {
          row.lateCleanupFailed = true;
        }
      }
      throw error;
    })
    .finally(() => {
      row.pending = false;
    });
  void task.catch((error) => {
    row.error = error.message;
  });
  try {
    const value = await bounded(
      () => task,
      Math.min(g.timeoutMs, g.end - performance.now(), g.deadlineAt - Date.now()),
    );
    check(g);
    return value;
  } catch (error) {
    g.failed = true;
    g.receipt.failure = name;
    throw error;
  }
}
async function closeExactTarget(g, id) {
  if (g.receipt.targetClosed) return;
  if (!g.closeTargetPromise)
    g.closeTargetPromise = (async () => {
      const result = await bounded(
        () => g.control.send('Target.closeTarget', { targetId: id }),
        g.timeoutMs,
      );
      assert.equal(result.success, true, 'Owned target did not confirm closure.');
      g.receipt.targetClosed = true;
    })();
  return g.closeTargetPromise;
}
function detachSession(g, session) {
  if (!g.detaches.has(session))
    g.detaches.set(
      session,
      bounded(() => session.detach(), g.timeoutMs),
    );
  return g.detaches.get(session);
}
export async function acquireHistoricalOrdinaryWindow({
  context,
  updatePage,
  expectedURL,
  mode,
  receipt,
  deadlineAt,
  signal,
  timeoutMs = 5000,
}) {
  assert.equal(mode, ORDINARY_WINDOW_MODE);
  validateHistoricalSessionURL(expectedURL);
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 5000);
  assert(Number.isFinite(deadlineAt) && deadlineAt > Date.now());
  assert(context.pages().includes(updatePage) && updatePage.context() === context);
  assert.equal(new URL(updatePage.url()).origin, new URL(expectedURL).origin);
  const g = {
    context,
    updatePage,
    expectedURL,
    receipt,
    timeoutMs,
    deadlineAt,
    signal,
    end: performance.now() + Math.min(timeoutMs, deadlineAt - Date.now()),
    closed: false,
    failed: false,
    sessions: [],
    detaches: new Map(),
    priorPages: new Set(context.pages()),
  };
  owned.add(g);
  Object.assign(receipt, {
    format: 'HistoricalOrdinaryBrowserWindow.v1',
    mode,
    expectedURL,
    created: false,
    qualificationScope:
      'One newly owned normal browser window; installed PWA continuity remains unqualified.',
    standaloneQualified: false,
    physicalDeviceQualified: false,
    operations: [],
  });
  try {
    await operation(
      g,
      'acquire owned updater control session',
      () => context.newCDPSession(updatePage),
      (session) => detachSession(g, session),
      (session) => {
        g.control = session;
        g.sessions.push(session);
      },
    );
    const updateInfo = (
      await operation(g, 'validate owned updater target', () =>
        g.control.send('Target.getTargetInfo'),
      )
    ).targetInfo;
    assert.equal(updateInfo.url, updatePage.url());
    assert.equal(updateInfo.type, 'page');
    const parameters = {
      url: expectedURL,
      newWindow: true,
      ...(updateInfo.browserContextId ? { browserContextId: updateInfo.browserContextId } : {}),
    };
    receipt.createTarget = { method: 'Target.createTarget', parameters };
    const result = await operation(
      g,
      'create owned ordinary target',
      () => g.control.send('Target.createTarget', parameters),
      async (value) => {
        try {
          await closeExactTarget(g, value.targetId);
          receipt.lateTargetClosed = true;
        } catch (error) {
          receipt.lateCleanupError = error.message;
        } finally {
          try {
            await detachSession(g, g.control);
          } catch (error) {
            receipt.lateDetachError = error.message;
          }
        }
      },
      (value) => {
        assert(typeof value.targetId === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(value.targetId));
        g.targetId = value.targetId;
        receipt.targetId = value.targetId;
      },
      () => detachSession(g, g.control),
    );
    assert.equal(result.targetId, g.targetId);
    while (!g.page) {
      check(g);
      for (const page of context.pages()) {
        if (g.priorPages.has(page) || page.url() !== expectedURL) continue;
        const session = await operation(
          g,
          'identify new ordinary page',
          () => context.newCDPSession(page),
          (value) => detachSession(g, value),
          (value) => g.sessions.push(value),
        );
        const info = (
          await operation(g, 'read new target identity', () => session.send('Target.getTargetInfo'))
        ).targetInfo;
        if (info.targetId !== g.targetId) {
          await operation(g, 'detach unrelated page inspection', () => detachSession(g, session));
          g.sessions = g.sessions.filter((s) => s !== session);
          continue;
        }
        assert.equal(page.context(), context);
        assert.equal(info.url, expectedURL);
        assert.equal(info.type, 'page');
        assert.equal(info.browserContextId, updateInfo.browserContextId);
        g.page = page;
        g.pageSession = session;
        receipt.target = info;
        break;
      }
      if (!g.page) await operation(g, 'wait for owned page', () => pause(25));
    }
    await operation(g, 'owned page document load', () =>
      g.page.waitForLoadState('domcontentloaded', { timeout: Math.min(5000, timeoutMs) }),
    );
    assert.equal(g.page.url(), expectedURL);
    const display = await operation(g, 'ordinary display-mode witness', () =>
      g.page.evaluate(() => ({
        standalone: globalThis.matchMedia('(display-mode: standalone)').matches,
        url: globalThis.location.href,
      })),
    );
    assert.equal(display.url, expectedURL);
    assert.equal(
      display.standalone,
      false,
      'Normal-browser mode must not use installed display mode.',
    );
    const a = await operation(g, 'owned ordinary window bounds', () =>
      g.control.send('Browser.getWindowForTarget', { targetId: g.targetId }),
    );
    const b = await operation(g, 'owned updater window bounds', () =>
      g.control.send('Browser.getWindowForTarget', { targetId: updateInfo.targetId }),
    );
    assert(Number.isInteger(a.windowId) && Number.isInteger(b.windowId));
    assert.notEqual(a.windowId, b.windowId);
    assert.equal(a.bounds.windowState, 'normal');
    for (const key of ['left', 'top', 'width', 'height'])
      assert(Number.isSafeInteger(a.bounds[key]));
    assert(a.bounds.width > 0 && a.bounds.height > 0);
    receipt.display = display;
    receipt.window = a;
    receipt.updaterWindowId = b.windowId;
    receipt.created = true;
    return g;
  } catch (error) {
    g.failed = true;
    await disposeHistoricalOrdinaryWindow(g);
    throw error;
  }
}
export async function disposeHistoricalOrdinaryWindow(g) {
  assert(owned.has(g));
  if (g.closed) return g.receipt.cleanup;
  g.closed = true;
  const pendingAtStart = g.receipt.operations.filter((r) => r.pending).map((r) => r.name),
    results = [];
  async function attempt(name, work) {
    try {
      await bounded(work, g.timeoutMs);
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
    }
  }
  if (g.targetId && g.control)
    await attempt('close exact owned normal target', () => closeExactTarget(g, g.targetId));
  if (g.page)
    await attempt('verify owned page closed', async () => {
      const end = performance.now() + g.timeoutMs;
      while (!g.page.isClosed()) {
        assert(performance.now() < end, 'Owned page did not close.');
        await pause(25);
      }
    });
  for (const session of g.sessions) {
    // An unresolved create owns this control session until its late-result closer.
    if (session === g.control && pendingAtStart.includes('create owned ordinary target')) continue;
    await attempt('detach owned CDP session', () => detachSession(g, session));
  }
  const pending = g.receipt.operations.filter((r) => r.pending).map((r) => r.name);
  g.receipt.cleanup = {
    completed:
      pendingAtStart.length === 0 &&
      pending.length === 0 &&
      !g.receipt.operations.some((r) => r.lateCleanupFailed) &&
      !g.receipt.lateCleanupError &&
      !g.receipt.lateDetachError &&
      results.every((r) => r.passed),
    pendingAtStart,
    pending,
    results,
  };
  return g.receipt.cleanup;
}
