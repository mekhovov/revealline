/** Finite historical public-UI continuity, not background-flight qualification. */
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

const MODES = Object.freeze({
  'academy-v0.142.4-98ad851': 'civilian-fpv',
  'gym-v0.142.4-98ad851': 'civilian-flight',
  'worlds-v0.142.4-98ad851': 'fpv-worlds',
});
export function historicalSessionPackage(mode) {
  assert(
    typeof mode === 'string' && Object.hasOwn(MODES, mode),
    'Active-session observation needs an explicit pinned historical mode.',
  );
  return MODES[mode];
}
const guards = new WeakSet();
export function selectHistoricalActiveSession(value) {
  if (value === undefined) return false;
  historicalSessionPackage(value);
  return true;
}

export function validateHistoricalSessionURL(value, packageId = 'civilian-fpv') {
  assert(Object.values(MODES).includes(packageId), 'Unknown historical session package.');
  const url = new URL(value);
  assert(url.protocol === 'http:' && url.hostname === '127.0.0.1');
  assert(!url.username && !url.password && !url.hash && url.href === value);
  assert(
    new RegExp(
      `^/(?:[A-Za-z0-9_-]+/)*practice/${packageId}/releases/v0\\.142\\.4/site/optional-practice/${packageId}/index\\.html$`,
    ).test(url.pathname),
  );
  assert(!url.search || url.search === '?lang=en');
  return url.href;
}

export function parseVisibleHistoricalHUD(
  raw,
  phase,
  { foreground = true, packageId = 'civilian-fpv' } = {},
) {
  assert(Object.values(MODES).includes(packageId));
  const gym = packageId === 'civilian-flight';
  assert(raw && raw.locale === 'en' && raw.viewportVisible && raw.hudVisible && raw.detailsVisible);
  assert.equal(
    raw.courseIdentity,
    gym ? 'lift-and-land' : 'Lift and land',
    'Require the first exercise identity metadata.',
  );
  assert.equal(raw.modeIdentity, gym ? 'assisted' : 'self-level');
  if (packageId !== 'civilian-fpv')
    assert.equal(raw.homeVisible, false, 'A menu must not cover the measured flight.');
  if (packageId === 'fpv-worlds')
    assert.deepEqual(
      raw.blockingDialogs,
      [],
      'A native overlay must not block historical Worlds arming.',
    );
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
  const match = (
    gym
      ? /^Position 10\.0, 16\.0 m · Height (\d+(?:\.\d+)?) m · Heading 0°$/
      : /^Height\s+(\d+(?:\.\d+)?)\s+m\s*·\s*1\.2[–-]2\.4\s+m$/
  ).exec(raw.details.trim());
  assert(match, 'Require visible first-lesson Height and its exact target band.');
  const height = Number(match[1]);
  assert(
    Number.isFinite(height) && height >= 0 && height <= 1.1,
    'Flight exceeds the bounded vertical witness.',
  );
  return { ...raw, height };
}

// Read-only DOM snapshot. Legacy #height/#speed/#power/#step-progress are never queried.
export function historicalHUDSnapshot(packageId = 'civilian-fpv') {
  const doc = globalThis.document;
  const $ = (selector) => doc.querySelector(selector);
  const visible = (node) =>
    Boolean(
      node &&
        node.getClientRects().length &&
        globalThis.getComputedStyle(node).visibility !== 'hidden' &&
        globalThis.getComputedStyle(node).display !== 'none',
    );
  const gym = packageId === 'civilian-flight',
    worlds = packageId === 'fpv-worlds';
  const prefix = gym ? 'gym' : worlds ? 'worlds' : 'academy';
  const shell = $(`[data-mode-play-shell="${prefix}-shell"]`);
  const viewport = $(gym ? '#arena' : worlds ? '#world-viewport' : '#viewport'),
    hud = gym ? $('#readout') : $('[data-sim-hud="flight"]');
  const details = gym ? hud : hud?.querySelector('[data-hud-part="details"]');
  const toolbar = $(`#${prefix}-shell-action-pause`);
  return {
    locale: doc.documentElement.lang,
    // Identity metadata only; these fields are never used as flight measurements.
    courseIdentity: gym
      ? $('#drill')?.value
      : $(worlds ? '#flight-title' : '#course-title')?.textContent.trim(),
    modeIdentity: gym ? 'assisted' : $(worlds ? '#flight-mode' : '#mode')?.value,
    ...(packageId === 'civilian-fpv'
      ? {}
      : { homeVisible: visible($(`#${prefix}-shell-home-dialog`)) }),
    ...(worlds
      ? {
          blockingDialogs: [...doc.querySelectorAll('dialog[open]:not(#flight-dialog)')].map(
            (node) => node.id,
          ),
        }
      : {}),
    viewportVisible: visible(viewport),
    hudVisible: visible(hud),
    detailsVisible: visible(details),
    gauge: gym ? 'Height' : hud?.querySelector('[data-hud-part="gauge-name"]')?.textContent.trim(),
    details: details?.textContent ?? '',
    action: gym
      ? ($('#status')?.textContent ?? '')
      : (hud?.querySelector('[data-hud-part="action"]')?.textContent ?? ''),
    phase: gym
      ? shell?.dataset.phase === 'playing'
        ? 'active'
        : shell?.dataset.phase
      : $(worlds ? '#flight-dialog' : '#flight-app')?.dataset.flightState,
    shellPhase: shell?.dataset.phase,
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
  const deadline = performance.now() + ms;
  let timer;
  try {
    const result = await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(`Deadline exceeded: ${label}`)), ms);
      }),
    ]);
    if (performance.now() >= deadline) throw Error(`Deadline exceeded: ${label}`);
    return result;
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
  const raw = await operation(g, 'read visible historical HUD', () =>
    g.page.evaluate(historicalHUDSnapshot, g.packageId),
  );
  try {
    return parseVisibleHistoricalHUD(raw, phase, { foreground, packageId: g.packageId });
  } catch (error) {
    g.receipt.invalidHUD = raw;
    throw error;
  }
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
  assert(['select', 'press', 'click'].includes(action));
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
      else if (action === 'click') await control.click({ timeout });
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
  const throttle = g.packageId === 'civilian-flight' ? 'r' : 'w';
  await down(g, throttle);
  try {
    for (;;) {
      const snapshot = await read(g, 'active');
      if (historicalHeightIncreased(initial, snapshot.height, minimum)) return snapshot;
      await operation(g, 'wait for visible height movement', () => delay(50));
    }
  } finally {
    // Failure paths are released by independent disposal, never skipped for a failed deadline.
    if (!g.failed) await up(g, throttle);
  }
}
async function stablePause(g, initial, foreground = true) {
  await operation(g, 'real paused observation interval', () => delay(600));
  const after = await read(g, 'paused', foreground);
  assert.equal(after.height, initial.height, 'Paused public height changed.');
  return after;
}
async function menuPause(g, { resume = true } = {}) {
  assert(['civilian-flight', 'fpv-worlds'].includes(g.packageId));
  const prefix = g.packageId === 'civilian-flight' ? 'gym' : 'worlds';
  await publicControl(g, `#${prefix}-shell-action-pause`, 'click');
  const snapshot = () =>
    operation(g, 'read visible native pause menu', () =>
      g.page.evaluate((prefix) => {
        const home = globalThis.document.querySelector(`#${prefix}-shell-home-dialog`);
        const primary = globalThis.document.querySelector(`#${prefix}-shell-action-primary`);
        const visible = (node) =>
          Boolean(
            node?.getClientRects().length &&
              globalThis.getComputedStyle(node).visibility !== 'hidden',
          );
        return {
          homeVisible: visible(home),
          continueVisible: visible(primary),
          continueEnabled: !primary?.disabled,
          label: primary?.textContent.trim(),
          phase: globalThis.document.querySelector(`[data-mode-play-shell="${prefix}-shell"]`)
            ?.dataset.phase,
        };
      }, prefix),
    );
  const assertMenu = (value) => {
    assert(value.homeVisible && value.continueVisible && value.continueEnabled);
    assert.equal(value.phase, 'paused');
    assert(/\bContinue\b/.test(value.label));
  };
  const before = await snapshot();
  (g.receipt.menuAttempts ??= []).push({ before, numericMeasurement: false });
  assertMenu(before);
  await operation(g, 'native pause-menu observation interval', () => delay(600));
  const after = await snapshot();
  assertMenu(after);
  assert.deepEqual(after, before);
  (g.receipt.menuPauses ??= []).push({
    before,
    after,
    intervalMs: 600,
    numericMeasurement: false,
    scope: 'The visible menu covers the flight. No hidden numeric metric is accepted here.',
  });
  if (resume) {
    await publicControl(g, `#${prefix}-shell-action-primary`, 'click');
    return read(g, 'active');
  }
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

export async function prepareHistoricalPracticeSession(
  page,
  { expectedURL, receipt, mode, timeoutMs = 30000 } = {},
) {
  assert(selectHistoricalActiveSession(mode), 'Explicit active-session opt-in required.');
  const packageId = historicalSessionPackage(mode);
  expectedURL = validateHistoricalSessionURL(expectedURL, packageId);
  assert.equal(page.url(), expectedURL);
  assert(receipt && typeof receipt === 'object');
  assert(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000);
  const started = performance.now();
  const g = {
    page,
    packageId,
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
    format:
      packageId === 'civilian-fpv'
        ? 'HistoricalAcademyActiveSession.v1'
        : 'HistoricalPracticeActiveSession.v1',
    packageId,
    mode,
    passed: false,
    qualified: false,
    exactTickContinuity: false,
    uninterruptedBackgroundFlight: false,
    expectedURL,
    actions: [],
    witnesses: [],
    deadlineMs: timeoutMs,
    inputRoute:
      packageId === 'civilian-fpv'
        ? 'Existing native Academy keyboard route.'
        : 'Native keyboard movement and form selections, with ordinary pointer pause/Continue and Arm/resume controls. Not controller/touch or general keyboard-menu qualification.',
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
        // Retain ownership even if the operation's post-await deadline check fails.
        g.document = handle;
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
    await operation(g, 'foreground owned historical flight', () => page.bringToFront());
    if (packageId === 'civilian-flight') {
      await publicControl(g, '#gym-shell-action-primary', 'press');
      await publicControl(g, '#gym-shell-action-start', 'press');
    } else if (packageId === 'fpv-worlds') {
      await publicControl(g, '#worlds-shell-action-settings', 'click');
      await publicControl(g, '#flight-source', 'select', 'keyboard');
      await publicControl(g, '#flight-keyboard-preset', 'select', 'two-stick');
      await publicControl(g, '[data-hud-preference="mode"]', 'select', 'detailed');
      await publicControl(g, '#close-sim-settings', 'click');
      await publicControl(g, '#worlds-shell-action-missions', 'click');
      await publicControl(g, '#first-flight-mode', 'select', 'self-level');
      await publicControl(g, '#try-first-flight', 'click');
      // One explicit public Arm action only. If the historical app remains
      // disarmed, retain its visible diagnostic and fail; do not retry or arm
      // through its hidden owner. This route has not passed native qualification.
      await publicControl(g, '#world-flight-resume', 'click', undefined, { waitEnabled: true });
    } else {
      await publicControl(g, '#academy-shell-action-settings', 'press');
      await publicControl(g, '#input-source', 'select', 'keyboard');
      await publicControl(g, '#mode', 'select', 'self-level');
      await publicControl(g, '#keyboard-preset', 'select', 'two-stick');
      await publicControl(g, '[data-hud-preference="mode"]', 'select', 'detailed');
      await publicControl(g, '#academy-shell-action-settings-back', 'press');
      await publicControl(g, '#academy-shell-action-primary', 'press');
      await publicControl(g, '#academy-shell-action-start', 'press');
      const startedUI = await operation(g, 'observe result of explicit Start', () =>
        page.evaluate(historicalHUDSnapshot, packageId),
      );
      receipt.startAttempt = {
        phase: startedUI.phase,
        additionalArmRequired: startedUI.phase === 'disarmed',
      };
      if (startedUI.phase === 'disarmed') {
        // Old native Start can precede renderer readiness. Preserve that attempt,
        // then wait for the visible Arm button itself to become enabled.
        await publicControl(g, '#academy-flight-resume', 'press', undefined, {
          waitEnabled: true,
        });
        receipt.startAttempt.additionalArmActivated = true;
      } else assert.equal(startedUI.phase, 'active', 'Unexpected result of explicit Start.');
    }
    const initial = await read(g, 'active');
    assert.equal(initial.height, 0, 'Require a fresh ground-level first exercise.');
    remember(g, 'started', initial);
    remember(g, 'genuine visible motion', await moving(g, initial.height, 0.2));
    if (packageId === 'civilian-fpv') {
      await space(g);
      const paused = await read(g, 'paused');
      remember(g, 'explicit pause stable for 600ms', await stablePause(g, paused));
      await space(g);
      remember(g, 'explicit resumed motion before update', await moving(g, paused.height));
    } else {
      const resumed = await menuPause(g);
      remember(g, 'visible return from explicit pause menu', resumed);
      remember(g, 'explicit resumed motion before update', await moving(g, resumed.height));
    }
    await assertIdentity(g);
    g.stage = 'running-before-transfer';
    return g;
  } catch (error) {
    g.failed = true;
    await disposeHistoricalAcademySession(g);
    throw error;
  }
}

// Keep the existing observer entry point and its guard lifetime compatible.
export const prepareHistoricalAcademySession = prepareHistoricalPracticeSession;

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
          () => g.page.evaluate(historicalHUDSnapshot, g.packageId),
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
          packageId: g.packageId,
        });
        break;
      }
      parseVisibleHistoricalHUD(raw, 'active', { foreground: false, packageId: g.packageId });
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
    await operation(g, 'return owned historical flight to foreground', () => g.page.bringToFront());
    const paused = await read(g, 'paused');
    assert.equal(paused.height, g.transfer.height, 'Paused session height changed across update.');
    remember(g, 'return focus did not resume for 600ms', await stablePause(g, paused));
    if (g.packageId === 'civilian-fpv') await space(g);
    else
      await publicControl(
        g,
        g.packageId === 'civilian-flight' ? '#gym-shell-action-pause' : '#world-flight-resume',
        'click',
        undefined,
        { waitEnabled: true },
      );
    remember(g, 'explicit resumed motion after update', await moving(g, paused.height));
    if (g.packageId === 'civilian-fpv') {
      await space(g);
      remember(g, 'final explicit pause', await read(g, 'paused'));
    } else await menuPause(g, { resume: false });
    await assertIdentity(g);
    g.receipt.passed = true;
    g.stage = 'verified';
    return g.receipt;
  } catch (error) {
    g.failed = true;
    throw error;
  }
}
