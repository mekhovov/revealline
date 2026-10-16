/** Historical Academy public-UI continuity, not background-flight qualification. */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

const MODE = 'academy-v0.142.4-98ad851';
const guards = new WeakSet();
export function selectHistoricalActiveSession(value) {
  if (value === undefined) return false;
  assert.equal(
    value,
    MODE,
    'Active-session observation needs the explicit pinned historical mode.',
  );
  return true;
}

export function validateHistoricalSessionURL(value) {
  const url = new URL(value);
  assert(url.protocol === 'http:' && url.hostname === '127.0.0.1');
  assert(!url.username && !url.password && !url.hash && url.href === value);
  assert(
    /^\/(?:[A-Za-z0-9_-]+\/)*practice\/civilian-fpv\/releases\/v0\.142\.4\/site\/optional-practice\/civilian-fpv\/index\.html$/.test(
      url.pathname,
    ),
  );
  assert(!url.search || url.search === '?lang=en');
  return url.href;
}

export function parseVisibleHistoricalHUD(raw, phase, { foreground = true } = {}) {
  assert(raw && raw.locale === 'en' && raw.viewportVisible && raw.hudVisible && raw.detailsVisible);
  assert.equal(raw.courseIdentity, 'Lift and land', 'Require the first lesson identity metadata.');
  assert.equal(raw.modeIdentity, 'self-level');
  assert.equal(
    raw.gauge,
    'Height',
    'Only the maintained visible Height gauge is a motion witness.',
  );
  assert.equal(raw.phase, phase);
  assert.equal(raw.shellPhase, phase === 'active' ? 'playing' : 'paused');
  assert(raw.toolbarVisible && raw.toolbarEnabled);
  assert.equal(raw.toolbar, phase === 'active' ? 'Pause' : 'Resume');
  if (foreground) assert(raw.focused && raw.visibility === 'visible');
  if (phase === 'active') assert(raw.viewportFocused, 'Native flight keys require viewport focus.');
  const match = /^Height\s+(\d+(?:\.\d+)?)\s+m\s*·\s*1\.2[–-]2\.4\s+m$/.exec(raw.details.trim());
  assert(match, 'Require visible first-lesson Height and its exact target band.');
  const height = Number(match[1]);
  assert(
    Number.isFinite(height) && height >= 0 && height <= 1.1,
    'Flight exceeds the bounded vertical witness.',
  );
  return { ...raw, height };
}

// Read-only DOM snapshot. Legacy #height/#speed/#power/#step-progress are never queried.
export function historicalHUDSnapshot() {
  const doc = globalThis.document;
  const $ = (selector) => doc.querySelector(selector);
  const visible = (node) =>
    Boolean(
      node &&
        node.getClientRects().length &&
        globalThis.getComputedStyle(node).visibility !== 'hidden' &&
        globalThis.getComputedStyle(node).display !== 'none',
    );
  const viewport = $('#viewport'),
    hud = $('[data-sim-hud="flight"]');
  const details = hud?.querySelector('[data-hud-part="details"]');
  const toolbar = $('#academy-shell-action-pause');
  return {
    locale: doc.documentElement.lang,
    // Identity metadata only; these fields are never used as flight measurements.
    courseIdentity: $('#course-title')?.textContent.trim(),
    modeIdentity: $('#mode')?.value,
    viewportVisible: visible(viewport),
    hudVisible: visible(hud),
    detailsVisible: visible(details),
    gauge: hud?.querySelector('[data-hud-part="gauge-name"]')?.textContent.trim(),
    details: details?.textContent ?? '',
    action: hud?.querySelector('[data-hud-part="action"]')?.textContent ?? '',
    phase: $('#flight-app')?.dataset.flightState,
    shellPhase: $('[data-mode-play-shell="academy-shell"]')?.dataset.phase,
    toolbarVisible: visible(toolbar),
    toolbarEnabled: !toolbar?.disabled,
    toolbar: toolbar?.textContent.trim(),
    focused: doc.hasFocus(),
    visibility: doc.visibilityState,
    viewportFocused: Boolean(viewport?.contains(doc.activeElement)),
  };
}

async function bound(work, ms, label) {
  assert(ms > 0, `Deadline exceeded: ${label}`);
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(`Deadline exceeded: ${label}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function remaining(g) {
  assert(guards.has(g) && !g.closed && !g.failed, 'Session guard is unavailable.');
  const ms = g.deadline - performance.now();
  assert(ms > 0, 'Historical active-session procedure exceeded 30 seconds, including update.');
  return Math.min(ms, 5000);
}
async function operation(g, label, work) {
  try {
    return await bound(work, remaining(g), label);
  } catch (error) {
    g.failed = true;
    g.receipt.failure = label;
    throw error;
  }
}
async function read(g, phase, foreground = true) {
  return parseVisibleHistoricalHUD(
    await operation(g, 'read visible historical HUD', () => g.page.evaluate(historicalHUDSnapshot)),
    phase,
    { foreground },
  );
}
function remember(g, kind, snapshot) {
  assert(g.receipt.witnesses.length < 32);
  g.receipt.witnesses.push({
    kind,
    elapsedMs: Math.round(performance.now() - g.started),
    ...snapshot,
  });
}
async function publicControl(g, selector, action, value, { waitEnabled = false } = {}) {
  await operation(g, `public ${selector}`, async () => {
    const control = g.page.locator(selector);
    await control.waitFor({ state: 'visible', timeout: remaining(g) });
    remaining(g);
    for (;;) {
      const enabled = await control.isEnabled();
      remaining(g);
      if (enabled) break;
      assert(waitEnabled, `Disabled public control: ${selector}`);
      await delay(50);
      remaining(g);
    }
    const timeout = remaining(g);
    g.pendingOwned++;
    try {
      // No await occurs between the final liveness check and this native action.
      if (action === 'select') await control.selectOption(value, { timeout });
      else await control.press('Enter', { timeout });
      remaining(g);
    } catch (error) {
      if (g.closed || g.failed) g.lateOwnershipFailure = true;
      throw error;
    } finally {
      g.pendingOwned--;
    }
  });
  g.receipt.actions.push({ selector, action, ...(value ? { value } : {}) });
}
async function down(g, key) {
  remaining(g);
  g.keys.add(key);
  g.pendingOwned++;
  const pending = g.page.keyboard.down(key);
  // A late key-down must be released even if the procedure has already failed.
  void pending
    .then(() => {
      if (g.closed || g.failed) return g.page.keyboard.up(key);
    })
    .catch(() => {
      g.lateOwnershipFailure = true;
    })
    .finally(() => {
      g.pendingOwned--;
    });
  await operation(g, `key down ${key}`, () => pending);
}
async function up(g, key) {
  await operation(g, `key up ${key}`, () => g.page.keyboard.up(key));
  g.keys.delete(key);
}
async function space(g) {
  await down(g, 'Space');
  await up(g, 'Space');
  g.receipt.actions.push({
    key: 'Space',
    action: 'ordinary press on focused viewport',
  });
}
export function historicalHeightIncreased(initial, current, minimum = 0.1) {
  assert([initial, current, minimum].every(Number.isFinite));
  assert(initial >= 0 && current >= 0 && initial <= 1.1 && current <= 1.1);
  assert(minimum > 0 && minimum <= 0.2);
  // A gravity-driven fall or reset is not resumed upward control.
  return current - initial >= minimum - 1e-9;
}
async function moving(g, initial, minimum = 0.1) {
  await down(g, 'w');
  try {
    for (;;) {
      const snapshot = await read(g, 'active');
      if (historicalHeightIncreased(initial, snapshot.height, minimum)) return snapshot;
      await operation(g, 'wait for visible height movement', () => delay(50));
    }
  } finally {
    // Failure paths are released by independent disposal, never skipped for a failed deadline.
    if (!g.failed) await up(g, 'w');
  }
}
async function stablePause(g, initial, foreground = true) {
  await operation(g, 'real paused observation interval', () => delay(600));
  const after = await read(g, 'paused', foreground);
  assert.equal(after.height, initial.height, 'Paused public height changed.');
  return after;
}
async function assertIdentity(g) {
  assert.equal(g.page.url(), g.expectedURL, 'Historical immutable URL changed.');
  assert.equal(g.navigations, 0, 'Historical main frame navigated.');
  assert(
    await operation(g, 'retained document identity', () =>
      g.document.evaluate((node) => node === globalThis.document.documentElement),
    ),
    'Historical document was replaced.',
  );
  assert.equal(
    await operation(g, 'retained time origin', () =>
      g.page.evaluate(() => globalThis.performance.timeOrigin),
    ),
    g.timeOrigin,
  );
}

export async function disposeHistoricalAcademySession(g) {
  assert(guards.has(g));
  if (g.closed) return g.receipt.cleanup;
  g.closed = true;
  const tasks = [...g.keys].map((key) => [`release ${key}`, () => g.page.keyboard.up(key)]);
  tasks.push(['remove navigation listener', () => g.page.off('framenavigated', g.onNavigation)]);
  if (g.document) tasks.push(['dispose document handle', () => g.document.dispose()]);
  const results = await Promise.all(
    tasks.map(async ([name, work]) => {
      try {
        await bound(work, 1000, name);
        return { name, passed: true };
      } catch {
        return { name, passed: false };
      }
    }),
  );
  g.receipt.cleanup = {
    completed:
      results.every((row) => row.passed) && g.pendingOwned === 0 && !g.lateOwnershipFailure,
    pendingOwned: g.pendingOwned,
    lateOwnershipFailure: g.lateOwnershipFailure,
    results,
  };
  if (!g.receipt.cleanup.completed || g.failed) g.receipt.passed = false;
  return g.receipt.cleanup;
}

export async function prepareHistoricalAcademySession(
  page,
  { expectedURL, receipt, mode, timeoutMs = 30000 } = {},
) {
  assert(selectHistoricalActiveSession(mode), 'Explicit active-session opt-in required.');
  expectedURL = validateHistoricalSessionURL(expectedURL);
  assert.equal(page.url(), expectedURL);
  assert(receipt && typeof receipt === 'object');
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000);
  const started = performance.now();
  const g = {
    page,
    receipt,
    expectedURL,
    started,
    deadline: started + timeoutMs,
    keys: new Set(),
    navigations: 0,
    failed: false,
    closed: false,
    stage: 'preparing',
    pendingOwned: 0,
    lateOwnershipFailure: false,
  };
  guards.add(g);
  Object.assign(receipt, {
    format: 'HistoricalAcademyActiveSession.v1',
    mode,
    passed: false,
    qualified: false,
    exactTickContinuity: false,
    uninterruptedBackgroundFlight: false,
    expectedURL,
    actions: [],
    witnesses: [],
    deadlineMs: timeoutMs,
  });
  g.onNavigation = (frame) => {
    if (frame === page.mainFrame()) g.navigations++;
  };
  page.on('framenavigated', g.onNavigation);
  try {
    g.pendingOwned++;
    const acquisition = page.evaluateHandle(() => globalThis.document.documentElement);
    void acquisition
      .then((handle) => {
        if (g.closed || g.failed) return handle.dispose();
      })
      .catch(() => {
        g.lateOwnershipFailure = true;
      })
      .finally(() => {
        g.pendingOwned--;
      });
    g.document = await operation(g, 'capture document identity', () => acquisition);
    g.timeOrigin = await operation(g, 'capture time origin', () =>
      page.evaluate(() => globalThis.performance.timeOrigin),
    );
    await operation(g, 'foreground old Academy', () => page.bringToFront());
    await publicControl(g, '#academy-shell-action-settings', 'press');
    await publicControl(g, '#input-source', 'select', 'keyboard');
    await publicControl(g, '#mode', 'select', 'self-level');
    await publicControl(g, '#keyboard-preset', 'select', 'two-stick');
    await publicControl(g, '[data-hud-preference="mode"]', 'select', 'detailed');
    await publicControl(g, '#academy-shell-action-settings-back', 'press');
    await publicControl(g, '#academy-shell-action-primary', 'press');
    await publicControl(g, '#academy-shell-action-start', 'press');
    const startedUI = await operation(g, 'observe result of explicit Start', () =>
      page.evaluate(historicalHUDSnapshot),
    );
    receipt.startAttempt = {
      phase: startedUI.phase,
      additionalArmRequired: startedUI.phase === 'disarmed',
    };
    if (startedUI.phase === 'disarmed') {
      // Old native Start can precede renderer readiness. Preserve that attempt,
      // then wait for the visible Arm button itself to become enabled.
      await publicControl(g, '#academy-flight-resume', 'press', undefined, { waitEnabled: true });
      receipt.startAttempt.additionalArmActivated = true;
    } else assert.equal(startedUI.phase, 'active', 'Unexpected result of explicit Start.');
    const initial = await read(g, 'active');
    assert.equal(initial.height, 0, 'Require a fresh ground-level first exercise.');
    remember(g, 'started', initial);
    remember(g, 'genuine visible motion', await moving(g, initial.height, 0.2));
    await space(g);
    const paused = await read(g, 'paused');
    remember(g, 'explicit pause stable for 600ms', await stablePause(g, paused));
    await space(g);
    remember(g, 'explicit resumed motion before update', await moving(g, paused.height));
    await assertIdentity(g);
    g.stage = 'running-before-transfer';
    return g;
  } catch (error) {
    g.failed = true;
    await disposeHistoricalAcademySession(g);
    throw error;
  }
}

export async function snapshotPausedAfterTransfer(g) {
  assert.equal(g.stage, 'running-before-transfer');
  try {
    // Caller foregrounds B naturally. Do not blur A by script or silently pause it here.
    const transferDeadline = performance.now() + 1500;
    g.receipt.transferDiagnostics = { attempts: 0, maximumWaitMs: 1500 };
    for (;;) {
      assert(
        performance.now() < transferDeadline,
        'Native focus transfer did not pause within 1500ms.',
      );
      const raw = await operation(g, 'wait for natural background pause', () =>
        bound(
          () => g.page.evaluate(historicalHUDSnapshot),
          transferDeadline - performance.now(),
          'read transfer snapshot within 1500ms',
        ),
      );
      g.receipt.transferDiagnostics.attempts++;
      g.receipt.transferDiagnostics.lastElapsedMs = Math.round(performance.now() - g.started);
      g.receipt.transferDiagnostics.lastSnapshot = Object.fromEntries(
        Object.entries(raw).map(([key, value]) => [
          key,
          typeof value === 'string' ? value.slice(0, 512) : value,
        ]),
      );
      if (raw.phase === 'paused') {
        assert(
          !raw.focused || raw.visibility === 'hidden',
          'Require a real focus/visibility transfer.',
        );
        g.transfer = parseVisibleHistoricalHUD(raw, 'paused', {
          foreground: false,
        });
        break;
      }
      parseVisibleHistoricalHUD(raw, 'active', { foreground: false });
      await operation(g, 'wait for blur pause', () => delay(50));
    }
    await assertIdentity(g);
    remember(g, 'natural transfer paused baseline (background DOM observation)', g.transfer);
    g.stage = 'paused-during-update';
    return g.transfer;
  } catch (error) {
    g.failed = true;
    throw error;
  }
}

export async function verifyHistoricalSessionAfterUpdate(g) {
  assert.equal(g.stage, 'paused-during-update');
  try {
    await assertIdentity(g);
    await operation(g, 'return old Academy to foreground', () => g.page.bringToFront());
    const paused = await read(g, 'paused');
    assert.equal(paused.height, g.transfer.height, 'Paused session height changed across update.');
    remember(g, 'return focus did not resume for 600ms', await stablePause(g, paused));
    await space(g);
    remember(g, 'explicit resumed motion after update', await moving(g, paused.height));
    await space(g);
    remember(g, 'final explicit pause', await read(g, 'paused'));
    await assertIdentity(g);
    g.receipt.passed = true;
    g.stage = 'verified';
    return g.receipt;
  } catch (error) {
    g.failed = true;
    throw error;
  }
}
