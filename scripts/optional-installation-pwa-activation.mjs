/** Separate installed-PWA activation diagnostic. Never minimizes or synthesizes events. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as pause } from 'node:timers/promises';
import { validateHistoricalSessionURL } from './optional-installation-active-session.mjs';
const FOCUS_SOURCE_SHA256 = '9393fa79e1c67c74edc26b610d65a4f7ed73d345a762465cc88340a33a2454ac';

export const PWA_ACTIVATION_MODE = 'owned-pwa-target-activation-98ad851';
const guards = new WeakSet();
function live(g) {
  assert(guards.has(g) && !g.closed && !g.failed, 'PWA activation guard unavailable.');
  assert(performance.now() < g.end, 'PWA activation deadline exceeded.');
}
async function bounded(work, ms) {
  assert(ms > 0, 'PWA activation deadline exceeded.');
  const end = performance.now() + ms;
  let timer;
  try {
    const value = await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('PWA activation operation timed out.')), ms);
      }),
    ]);
    assert(performance.now() < end, 'PWA activation response arrived after its deadline.');
    return value;
  } finally {
    clearTimeout(timer);
  }
}
async function operation(g, name, work, capture, late) {
  live(g);
  const row = { name, pending: true };
  g.receipt.operations.push(row);
  const task = Promise.resolve()
    .then(() => {
      live(g);
      return work();
    })
    .then(async (value) => {
      capture?.(value); // Transfer ownership before any post-resolution deadline check.
      if (g.closed || g.failed) await late?.(value);
      return value;
    })
    .finally(() => {
      row.pending = false;
    });
  void task.catch(() => {
    row.failed = true;
  });
  try {
    const result = await bounded(() => task, Math.min(g.timeoutMs, g.end - performance.now()));
    live(g);
    return result;
  } catch (error) {
    g.failed = true;
    g.receipt.failure = name;
    throw error;
  }
}
async function send(g, session, method, params) {
  return operation(g, method, () => {
    g.receipt.commands.push({ method, params });
    return session.send(method, params);
  });
}
function detach(g, session) {
  if (!g.detaches.has(session))
    g.detaches.set(
      session,
      Promise.resolve().then(() => session.detach()),
    );
  return g.detaches.get(session);
}
function closeWitness(g, handle) {
  if (!g.witnessCloses.has(handle))
    g.witnessCloses.set(
      handle,
      (async () => {
        try {
          await handle.evaluate((value) => value.close());
        } finally {
          await handle.dispose();
        }
      })(),
    );
  return g.witnessCloses.get(handle);
}
/** An observer-owned closure, not a global property or application-state hook. */
export function installTrustedBlurWitness() {
  const events = [];
  const armedAt = globalThis.performance.now();
  let closed = false;
  const listener = (event) => {
    if (!closed && events.length < 8)
      events.push({
        trusted: event.isTrusted,
        at: globalThis.performance.now(),
        focused: globalThis.document.hasFocus(),
        visibility: globalThis.document.visibilityState,
      });
  };
  globalThis.addEventListener('blur', listener);
  return {
    snapshot: () => ({
      armedAt,
      events: events.map((value) => ({ ...value })),
      focused: globalThis.document.hasFocus(),
      visibility: globalThis.document.visibilityState,
    }),
    close: () => {
      closed = true;
      globalThis.removeEventListener('blur', listener);
    },
  };
}
export function assertTrustedActivationBlur(value) {
  assert(
    Number.isFinite(value?.armedAt) && Array.isArray(value.events) && value.events.length <= 8,
  );
  assert.equal(value.focused, false, 'PWA must actually lose focus.');
  assert(
    value.events.some(
      (e) =>
        e.trusted === true && e.focused === false && Number.isFinite(e.at) && e.at >= value.armedAt,
    ),
    'Fresh trusted native blur required.',
  );
}
export async function configureHistoricalPWAActivation({
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
  assert.equal(mode, PWA_ACTIVATION_MODE);
  assert.equal(playwrightSourceSha256, FOCUS_SOURCE_SHA256);
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 5000);
  validateHistoricalSessionURL(expectedPreviousURL);
  const a = new URL(expectedPreviousURL),
    b = new URL(expectedUpdateURL);
  assert(
    b.href === expectedUpdateURL &&
      b.origin === a.origin &&
      b.pathname === a.pathname &&
      !b.username &&
      !b.password &&
      !b.hash &&
      (!b.search || b.search === '?lang=en'),
  );
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
    end: performance.now() + timeoutMs,
    closed: false,
    failed: false,
    stage: 'configuring',
    detaches: new Map(),
    witnessCloses: new Map(),
    focusTouched: new Set(),
  };
  guards.add(g);
  Object.assign(receipt, {
    format: 'HistoricalPWAActivation.v1',
    mode,
    configured: false,
    activated: false,
    returned: false,
    qualified: false,
    physicalDeviceQualified: false,
    minimizationQualified: false,
    operations: [],
    commands: [],
    scope:
      'One owned installed historical Academy window, native target activation only; no synthetic blur, minimization, OS reboot or physical-device qualification.',
  });
  try {
    assert.equal(
      await operation(g, 'verify installed A display mode', () =>
        previousPage.evaluate(() => globalThis.matchMedia('(display-mode: standalone)').matches),
      ),
      true,
    );
    receipt.standaloneObserved = true;
    for (const [key, page, url] of [
      ['a', previousPage, expectedPreviousURL],
      ['b', updatePage, expectedUpdateURL],
    ]) {
      const session = await operation(
        g,
        'acquire owned ' + key + ' session',
        () => context.newCDPSession(page),
        (s) => {
          g[key + 'Session'] = s;
        },
        (s) => detach(g, s),
      );
      const { targetInfo } = await send(g, session, 'Target.getTargetInfo', {});
      assert.equal(targetInfo.type, 'page');
      assert.equal(targetInfo.url, url);
      assert(typeof targetInfo.targetId === 'string' && targetInfo.targetId.length > 0);
      const window = await send(g, session, 'Browser.getWindowForTarget', {
        targetId: targetInfo.targetId,
      });
      assert(Number.isInteger(window.windowId));
      assert.equal(window.bounds?.windowState, 'normal');
      receipt[key] = {
        targetId: targetInfo.targetId,
        browserContextId: targetInfo.browserContextId ?? null,
        url,
        windowId: window.windowId,
        bounds: window.bounds,
      };
    }
    assert.notEqual(receipt.a.targetId, receipt.b.targetId);
    assert.notEqual(receipt.a.windowId, receipt.b.windowId);
    assert.equal(receipt.a.browserContextId, receipt.b.browserContextId);
    for (const session of [g.aSession, g.bSession]) {
      g.focusTouched.add(session);
      await send(g, session, 'Emulation.setFocusEmulationEnabled', {
        enabled: false,
      });
    }
    g.stage = 'configured';
    receipt.configured = true;
    return g;
  } catch (error) {
    g.failed = true;
    await disposeHistoricalPWAActivation(g);
    throw error;
  }
}
export async function activateHistoricalPWAUpdater(
  g,
  { sessionDeadlineAt, observePaused, transferMs = 1500 },
) {
  assert.equal(g.stage, 'configured');
  assert(Number.isFinite(sessionDeadlineAt) && sessionDeadlineAt > performance.now());
  assert(sessionDeadlineAt <= performance.now() + 30000);
  assert(Number.isInteger(transferMs) && transferMs > 0 && transferMs <= 1500);
  g.end = sessionDeadlineAt;
  try {
    assert.equal(g.a.url(), g.receipt.a.url);
    assert.equal(g.b.url(), g.receipt.b.url);
    assert.equal(
      await operation(g, 'verify A focused before activation', () =>
        g.a.evaluate(() => globalThis.document.hasFocus()),
      ),
      true,
    );
    await operation(
      g,
      'capture fresh trusted blur listener',
      () => g.a.evaluateHandle(installTrustedBlurWitness),
      (handle) => {
        g.witness = handle;
      },
      (handle) => closeWitness(g, handle),
    );
    const initial = await operation(g, 'verify fresh focused blur witness', () =>
      g.witness.evaluate((w) => w.snapshot()),
    );
    assert.equal(initial.focused, true);
    assert.deepEqual(initial.events, []);
    const started = performance.now(),
      end = Math.min(g.end, started + transferMs);
    const originalEnd = g.end;
    g.end = end;
    g.receipt.transfer = {
      limitMs: transferMs,
      observations: [],
      passed: false,
    };
    await send(g, g.bSession, 'Target.activateTarget', {
      targetId: g.receipt.b.targetId,
    });
    // Do not call bringToFront, minimize, focus(), pause handlers or dispatchEvent here.
    for (;;) {
      const value = await operation(g, 'observe fresh native blur', () =>
        g.witness.evaluate((w) => w.snapshot()),
      );
      assert(g.receipt.transfer.observations.length < 32);
      g.receipt.transfer.observations.push({
        elapsedMs: Math.round(performance.now() - started),
        ...value,
      });
      if (
        !value.focused &&
        value.events.some((e) => e.trusted === true && !e.focused && e.at >= value.armedAt)
      ) {
        assertTrustedActivationBlur(value);
        break;
      }
      await operation(g, 'wait for native blur', () =>
        pause(Math.min(50, Math.max(1, end - performance.now()))),
      );
    }
    // The existing maintained HUD/identity gate must also finish inside this same 1500ms.
    await operation(g, 'observe native paused HUD', observePaused);
    live(g);
    g.receipt.transfer.elapsedMs = Math.round(performance.now() - started);
    g.receipt.transfer.passed = true;
    g.receipt.activated = true;
    g.stage = 'activated';
    g.end = originalEnd;
  } catch (error) {
    g.failed = true;
    throw error;
  }
}
export async function returnHistoricalPWAWindow(g, { returnMs = 1500 } = {}) {
  assert.equal(g.stage, 'activated');
  live(g);
  assert(Number.isInteger(returnMs) && returnMs > 0 && returnMs <= 1500);
  assert.equal(g.a.url(), g.receipt.a.url);
  const originalEnd = g.end,
    started = performance.now();
  g.end = Math.min(g.end, started + returnMs);
  const result = {
    limitMs: returnMs,
    beforeFocused: null,
    observations: [],
    passed: false,
  };
  g.receipt.returnObservation = result;
  try {
    result.beforeFocused = await operation(g, 'verify A unfocused before native return', () =>
      g.a.evaluate(() => globalThis.document.hasFocus()),
    );
    assert.equal(result.beforeFocused, false, 'Already-focused A cannot prove native return.');
    await send(g, g.aSession, 'Target.activateTarget', {
      targetId: g.receipt.a.targetId,
    });
    for (;;) {
      const focused = await operation(g, 'observe native A focus return', () =>
        g.a.evaluate(() => globalThis.document.hasFocus()),
      );
      assert.equal(typeof focused, 'boolean');
      assert(result.observations.length < 32);
      result.observations.push({
        elapsedMs: Math.round(performance.now() - started),
        focused,
      });
      if (focused) break;
      await operation(g, 'wait for native A focus return', () =>
        pause(Math.min(50, Math.max(1, g.end - performance.now()))),
      );
    }
    live(g);
    result.passed = true;
    g.receipt.returned = true;
    g.stage = 'returned';
    g.end = originalEnd;
    // Only now may the unchanged verifier bring A forward and check retained
    // document/timeOrigin, stable pause and explicit positive-motion resume.
  } catch (error) {
    g.failed = true;
    throw error;
  }
}
export async function disposeHistoricalPWAActivation(g) {
  assert(guards.has(g));
  if (g.closed) return g.receipt.cleanup;
  g.closed = true;
  const pendingAtStart = g.receipt.operations.filter((x) => x.pending).map((x) => x.name),
    results = [];
  async function attempt(name, work) {
    try {
      await bounded(work, g.timeoutMs);
      results.push({ name, passed: true });
    } catch {
      results.push({ name, passed: false });
    }
  }
  if (g.witness)
    await attempt('remove owned blur listener and dispose handle', () =>
      closeWitness(g, g.witness),
    );
  for (const [key, session] of [
    ['A', g.aSession],
    ['B', g.bSession],
  ])
    if (session) {
      if (g.focusTouched.has(session))
        await attempt('restore ' + key + ' focus emulation', () =>
          session.send('Emulation.setFocusEmulationEnabled', { enabled: true }),
        );
      await attempt('detach owned ' + key + ' session', () => detach(g, session));
    }
  const pending = g.receipt.operations.filter((x) => x.pending).map((x) => x.name);
  g.receipt.cleanup = {
    completed: !pendingAtStart.length && !pending.length && results.every((r) => r.passed),
    pendingAtStart,
    pending,
    results,
  };
  return g.receipt.cleanup;
}
