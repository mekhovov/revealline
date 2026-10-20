/** Narrow offline motion witness; parent owns admitted bytes, restart and profile. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
export const OFFLINE_FLIGHT_MODE = 'all-three-en';
export const OFFLINE_FLIGHT_IDS = Object.freeze(['civilian-flight', 'civilian-fpv', 'fpv-worlds']);
export const OFFLINE_FLIGHT_ROUTES = Object.freeze([
  'browser-process-restart-launcher',
  'browser-process-restart-standalone',
]);
export function selectOfflineFlightMode(value, options = {}) {
  if (value === undefined) return false;
  assert.equal(value, OFFLINE_FLIGHT_MODE);
  assert.equal(options.importedWorld, true);
  assert.equal(options.worldSeed, true);
  for (const key of [
    'historical',
    'previousBundle',
    'migration',
    'activeSession',
    'activeWindow',
    'quota',
    'quotaPackages',
    'download',
    'verificationCancel',
    'diagnostics',
  ])
    assert(
      options[key] === undefined || options[key] === false,
      `Offline flight cannot mix with ${key}.`,
    );
  assert(
    Object.keys(options).every((k) =>
      [
        'importedWorld',
        'worldSeed',
        'historical',
        'previousBundle',
        'migration',
        'activeSession',
        'activeWindow',
        'quota',
        'quotaPackages',
        'download',
        'verificationCancel',
        'diagnostics',
      ].includes(k),
    ),
  );
  return true;
}
export function offlineFlightAuthority(entries) {
  const rows = [];
  for (const id of OFFLINE_FLIGHT_IDS.slice(0, 2)) {
    const files = entries.get(id);
    assert(files instanceof Map);
    for (const name of ['app.mjs', 'model.mjs', 'catalogue.mjs']) {
      const path = `optional-practice/${id}/${name}`,
        bytes = files.get(path);
      assert(Buffer.isBuffer(bytes) && bytes.length);
      rows.push({
        packageId: id,
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
  return rows;
}
export function validateOfflineFlightURL(value, id) {
  assert(['civilian-flight', 'civilian-fpv'].includes(id));
  assert(typeof value === 'string' && value.length <= 2048);
  const u = new URL(value);
  assert.equal(u.href, value);
  assert.equal(u.protocol, 'http:');
  assert.equal(u.hostname, '127.0.0.1');
  assert(!u.username && !u.password && !u.hash);
  assert(
    new RegExp(
      `^/revealline/practice/${id}/releases/[A-Za-z0-9._-]+/site/optional-practice/${id}/index\\.html$`,
    ).test(u.pathname),
  );
  assert(value === `${u.origin}${u.pathname}?lang=en`);
  return value;
}
/** Only rendered measurements; course/form/phase are distinctly UI identity metadata. */
export function readOfflineFlightDOM(id) {
  const d = globalThis.document,
    q = (s) => d.querySelector(s),
    gym = id === 'civilian-flight';
  const visible = (n) => {
    if (!n || n.closest('[hidden]')) return false;
    const c = globalThis.getComputedStyle(n),
      b = n.getBoundingClientRect();
    return (
      c.display !== 'none' &&
      c.visibility !== 'hidden' &&
      Number(c.opacity) !== 0 &&
      b.width > 0 &&
      b.height > 0 &&
      b.bottom > 0 &&
      b.right > 0 &&
      b.top < globalThis.innerHeight &&
      b.left < globalThis.innerWidth
    );
  };
  const arena = q(gym ? '#arena' : '#viewport'),
    details = q(gym ? '#readout' : '[data-sim-hud="flight"] [data-hud-part="details"]'),
    gauge = q('[data-sim-hud="flight"] [data-hud-part="gauge-name"]');
  return {
    locale: d.documentElement.lang,
    visible: visible(arena) && visible(details) && (gym || visible(gauge)),
    focused:
      d.hasFocus() && !d.hidden && (d.activeElement === arena || arena?.contains(d.activeElement)),
    phase: gym
      ? q('[data-mode-play-shell="gym-shell"]')?.dataset.phase
      : q('#flight-app')?.dataset.flightState,
    details: details?.textContent,
    gauge: gym ? null : gauge?.textContent,
    drill: gym ? q('#drill')?.value : null,
    title: gym ? null : q('#course-title')?.textContent,
    courseNumber: gym ? null : q('#course-number')?.textContent,
    source: gym ? null : q('#input-source')?.value,
    preset: gym ? null : q('#keyboard-preset')?.value,
    mode: gym ? null : q('#mode')?.value,
  };
}
export function parseOfflineFlightHUD(raw, id, { paused = false } = {}) {
  assert.equal(raw.locale, 'en');
  assert.equal(raw.visible, true);
  assert.equal(raw.phase, paused ? 'paused' : id === 'civilian-flight' ? 'playing' : 'active');
  if (!paused) assert.equal(raw.focused, true);
  assert(typeof raw.details === 'string' && raw.details.length <= 256);
  let height;
  if (id === 'civilian-flight') {
    assert.equal(raw.drill, 'lift-and-land');
    const n = raw.details.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
    assert.equal(n?.length, 4);
    assert(n.every(Number.isFinite));
    assert.equal(n[0], 10);
    assert.equal(n[1], 16);
    assert.equal(n[3], 0);
    height = n[2];
  } else {
    assert.equal(id, 'civilian-fpv');
    assert.equal(raw.title?.trim(), 'Lift and land');
    assert(/^01\s*\/\s*\d+\s*·/.test(raw.courseNumber));
    assert.equal(raw.source, 'keyboard');
    assert.equal(raw.preset, 'two-stick');
    assert.equal(raw.mode, 'self-level');
    assert.equal(raw.gauge?.trim(), 'Height');
    const match = raw.details.trim().match(/^Height (\d+(?:\.\d+)?) m · 1\.2–2\.4 m$/);
    assert(match);
    height = Number(match[1]);
  }
  assert(
    height >= 0 && height < 0.8,
    'Short offline flight must stay below the first completion target.',
  );
  return {
    height,
    phase: raw.phase,
    visible: true,
    focused: raw.focused,
    at: performance.now(),
  };
}
export function assertOfflineFlightMatrix(receipt, importedWorld, browserRestart) {
  assert(receipt.sourceStable && receipt.runtime?.length === 6 && browserRestart.passed);
  const expected = OFFLINE_FLIGHT_ROUTES.flatMap((route) =>
    OFFLINE_FLIGHT_IDS.slice(0, 2).map((id) => `${route}:${id}`),
  );
  assert.deepEqual(
    receipt.flights.map((f) => `${f.route}:${f.packageId}`),
    expected,
  );
  for (const f of receipt.flights) {
    assert(
      f.passed &&
        f.cleanup?.completed &&
        !f.cleanup.errors.length &&
        /^[a-f0-9]{64}$/.test(f.screenshot?.sha256),
    );
    assert.equal(f.replay, false);
    assert(f.explicitStart && f.explicitPause && f.networkProbeFailed && f.processRestartConfirmed);
    assert.equal(f.before.height, 0);
    assert(f.after.height >= 0.2 && f.after.height < 0.8);
    assert.equal(f.paused.length, 4);
    assert(
      f.paused.every(
        (s, index) => Number.isFinite(s.at) && (index === 0 || s.at >= f.paused[index - 1].at),
      ),
    );
    assert(
      f.paused.every((s) => s.phase === 'paused' && s.visible && s.height === f.paused[0].height),
    );
    const ms = f.paused.at(-1).at - f.paused[0].at;
    assert(ms >= 600 && ms <= 2000);
  }
  assert(importedWorld.passed && importedWorld.flights.length === 2);
  assert.deepEqual(
    importedWorld.flights.map((f) => f.label),
    OFFLINE_FLIGHT_ROUTES,
  );
  assert(
    importedWorld.flights.every(
      (f) => f.passed && f.cleanup?.completed && f.networkProbeFailed && f.processRestartConfirmed,
    ),
  );
  return true;
}
export async function observeOfflineFlight(
  page,
  {
    packageId,
    expectedURL,
    deadlineAt,
    requireActive,
    signal,
    receipt,
    capture,
    restartConfirmed,
    networkProbeFailed,
    cleanupMs = 1500,
  },
) {
  validateOfflineFlightURL(expectedURL, packageId);
  assert.equal(restartConfirmed, true);
  assert.equal(networkProbeFailed, true);
  assert(Number.isInteger(cleanupMs) && cleanupMs > 0 && cleanupMs <= 1500);
  assert(Number.isFinite(deadlineAt) && deadlineAt > Date.now());
  assert.equal(typeof requireActive, 'function');
  assert.equal(typeof capture, 'function');
  const end = performance.now() + Math.min(30000, deadlineAt - Date.now()),
    gym = packageId === 'civilian-flight',
    shell = gym ? 'gym-shell' : 'academy-shell';
  let stopped = false,
    pending = 0,
    uncertain = false;
  const keys = new Set();
  Object.assign(receipt, {
    packageId,
    expectedURL,
    actions: [],
    samples: [],
    paused: [],
    explicitStart: false,
    explicitPause: false,
    replay: false,
    networkProbeFailed,
    processRestartConfirmed: restartConfirmed,
    cleanup: { completed: false, errors: [] },
    exerciseCompleted: false,
  });
  const check = () => {
    assert(!stopped);
    signal?.throwIfAborted();
    requireActive();
    assert(Date.now() < deadlineAt && performance.now() < end);
    assert.equal(page.url(), expectedURL);
  };
  async function op(fn, cleanup = false) {
    if (!cleanup) check();
    const ms = cleanup
      ? cleanupMs
      : Math.min(8000, deadlineAt - Date.now(), end - performance.now());
    assert(ms > 0);
    const operationEnd = performance.now() + ms;
    let timer;
    pending++;
    const task = Promise.resolve()
      .then(() => {
        if (!cleanup) check();
        return fn();
      })
      .finally(() => pending--);
    try {
      const result = await Promise.race([
        task,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            uncertain = true;
            reject(Error('Offline flight operation timed out.'));
          }, ms);
        }),
      ]);
      if (performance.now() >= operationEnd) {
        uncertain = true;
        throw Error('Offline flight operation exceeded its absolute deadline.');
      }
      if (!cleanup) check();
      return result;
    } finally {
      clearTimeout(timer);
    }
  }
  async function action(selector, method = 'press', value = 'Enter') {
    const n = page.locator(selector);
    await op(() => n.waitFor({ state: 'visible', timeout: 8000 }));
    check();
    assert(await op(() => n.isEnabled()));
    check();
    await op(() => n[method](value));
    receipt.actions.push({ selector, method, value });
  }
  async function sample(paused = false) {
    const s = parseOfflineFlightHUD(
      await op(() => page.evaluate(readOfflineFlightDOM, packageId)),
      packageId,
      { paused },
    );
    assert(receipt.samples.length < 260);
    receipt.samples.push(s);
    return s;
  }
  try {
    if (!gym) {
      await action('#academy-shell-action-settings');
      for (const [tab, fields] of [
        ['gameplay', [['#mode', 'self-level']]],
        [
          'controls',
          [
            ['#input-source', 'keyboard'],
            ['#keyboard-preset', 'two-stick'],
          ],
        ],
        [
          'accessibility',
          [['#academy-settings-panel-accessibility [data-hud-preference="mode"]', 'detailed']],
        ],
      ]) {
        await action(`#academy-settings-tab-${tab}`);
        for (const [selector, value] of fields) await action(selector, 'selectOption', value);
      }
      for (let i = 0; i < 5; i++) {
        if (
          (await op(() => page.locator('#academy-shell-settings-dialog').getAttribute('open'))) ===
          null
        )
          break;
        await action('#academy-shell-action-settings-back');
      }
      assert.equal(
        await op(() => page.locator('#academy-shell-settings-dialog').getAttribute('open')),
        null,
      );
    }
    await action(`#${shell}-action-primary`);
    receipt.explicitStart = true;
    // Native Start resolves renderer preparation before active state; bounded UI
    // polling does not inspect sceneReady or activate any internal callback.
    const phaseSelector = gym ? '[data-mode-play-shell="gym-shell"]' : '#flight-app',
      phaseAttr = gym ? 'data-phase' : 'data-flight-state';
    const readyEnd = performance.now() + 8000;
    while (
      (await op(() => page.locator(phaseSelector).getAttribute(phaseAttr))) !==
      (gym ? 'playing' : 'active')
    ) {
      assert(performance.now() < readyEnd);
      await op(() => page.waitForTimeout(50));
    }
    await action(gym ? '#arena' : '#viewport', 'click', { timeout: 8000 });
    receipt.before = await sample();
    assert.equal(receipt.before.height, 0, 'Refuse a recovered or non-ground initial flight.');
    const key = gym ? 'r' : 'w';
    check();
    keys.add(key);
    await op(async () => {
      await page.keyboard.down(key);
      if (stopped || signal?.aborted || performance.now() >= end) await page.keyboard.up(key);
    });
    const motionEnd = performance.now() + 12000;
    do {
      await op(() => page.waitForTimeout(50));
      receipt.after = await sample();
      assert(performance.now() < motionEnd);
    } while (receipt.after.height - receipt.before.height < 0.2 - 1e-9);
    await op(() => page.keyboard.up(key));
    keys.delete(key);
    if (gym) await action('#gym-shell-action-pause', 'click', { timeout: 8000 });
    else await op(() => page.keyboard.press('Space'));
    receipt.explicitPause = true;
    for (let i = 0; i < 4; i++) {
      if (i) await op(() => page.waitForTimeout(210));
      receipt.paused.push(await sample(true));
    }
    assert(receipt.paused.every((s) => s.height === receipt.paused[0].height));
    const duration = receipt.paused.at(-1).at - receipt.paused[0].at;
    assert(duration >= 600 && duration <= 2000);
    receipt.screenshot = await op(() => capture());
    receipt.passed = true;
  } finally {
    stopped = true;
    const pendingAtStart = pending;
    for (const key of keys) {
      try {
        await op(() => page.keyboard.up(key), true);
      } catch (e) {
        receipt.cleanup.errors.push(e.message);
      }
    }
    receipt.cleanup.completed =
      !uncertain && !pendingAtStart && !pending && !receipt.cleanup.errors.length;
  }
  assert(receipt.cleanup.completed);
  return receipt;
}
