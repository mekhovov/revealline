/** Imported-world observation: ordinary UI only; parent owns admitted bytes/profile/restart. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  PACK,
  verifyC4ImportBytes,
  assertC4ImportedWorld,
  assertC4OfflineFlight,
} from './practice-imported-world-check.mjs';
export const IMPORTED_WORLD_MODE = 'roadworks-offline-flight';
export function validateImportedWorldEntryURL(observed, admittedEntry) {
  for (const value of [observed, admittedEntry]) {
    assert(typeof value === 'string' && value.length > 0 && value.length <= 2048);
    const parsed = new URL(value);
    assert.equal(parsed.href, value, 'Require a canonical URL.');
    assert(parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1');
    assert(!parsed.username && !parsed.password && !parsed.hash);
  }
  const actual = new URL(observed),
    expected = new URL(admittedEntry);
  assert.equal(expected.search, '', 'Admitted entry must not contain a query.');
  assert.equal(admittedEntry, `${expected.origin}${expected.pathname}`);
  assert(
    /^\/revealline\/practice\/fpv-worlds\/releases\/[A-Za-z0-9._-]+\/site\/optional-practice\/fpv-worlds\/index\.html$/.test(
      expected.pathname,
    ),
  );
  assert.equal(actual.origin, expected.origin);
  assert.equal(actual.pathname, expected.pathname);
  assert(
    actual.search === '' || actual.search === '?lang=en',
    'Only the direct entry or exact English launcher query is allowed.',
  );
  assert(observed === admittedEntry || observed === `${admittedEntry}?lang=en`);
  return observed;
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function selectImportedWorldMode(
  value,
  { worldSeed, historical, migration, activeSession, quota, download, verificationCancel } = {},
) {
  if (value === undefined) return false;
  assert.equal(value, IMPORTED_WORLD_MODE);
  assert.equal(worldSeed, true, 'Imported-world lane requires the existing public template seed.');
  assert.equal(
    verificationCancel,
    undefined,
    'Imported-world lane must run separately from final verification cancellation.',
  );
  assert(
    !historical && !migration && !activeSession && !quota && !download,
    'Imported-world lane must run separately from historical migration and fault lanes.',
  );
  return true;
}
export function importedWorldAuthority(files, packBytes) {
  verifyC4ImportBytes(packBytes);
  const paths = [
    'optional-practice/civilian-fpv/world-app.mjs',
    'optional-practice/civilian-fpv/world-content.mjs',
    'optional-practice/civilian-fpv/world-store.mjs',
    'optional-practice/civilian-fpv/sim-presentation.mjs',
  ];
  return {
    pack: PACK,
    runtime: paths.map((path) => {
      const bytes = files.get(path);
      assert(Buffer.isBuffer(bytes) && bytes.length > 0, `Missing admitted source: ${path}`);
      return { path, bytes: bytes.length, sha256: digest(bytes) };
    }),
  };
}
function scope(page, options, report) {
  const { deadlineAt, signal, requireActive, expectedURL } = options;
  assert(Number.isFinite(deadlineAt) && deadlineAt > Date.now());
  assert.equal(typeof requireActive, 'function');
  const parsed = new URL(expectedURL);
  assert(
    parsed.protocol === 'http:' &&
      parsed.hostname === '127.0.0.1' &&
      !parsed.username &&
      !parsed.password &&
      !parsed.hash,
  );
  assert(
    /\/practice\/fpv-worlds\/releases\/[^/]+\/site\/optional-practice\/fpv-worlds\/index\.html$/.test(
      parsed.pathname,
    ),
  );
  assert(parsed.search === '' || parsed.search === '?lang=en');
  validateImportedWorldEntryURL(expectedURL, `${parsed.origin}${parsed.pathname}`);
  let packsAuthorized = options.libraryAlreadyOpen === true;
  const end = performance.now() + Math.min(30000, deadlineAt - Date.now());
  let stopped = false,
    pending = 0,
    uncertain = false;
  const keys = new Set();
  report.actions = [];
  report.cleanup = { completed: false, errors: [] };
  const check = () => {
    assert(!stopped, 'Imported-world operation already ended.');
    signal?.throwIfAborted();
    requireActive();
    assert(
      Date.now() < deadlineAt && performance.now() < end,
      'Imported-world shared deadline exceeded.',
    );
    const actualURL = page.url();
    assert(
      actualURL === expectedURL || (packsAuthorized && actualURL === `${expectedURL}#packs`),
      'Imported-world page navigated away.',
    );
  };
  async function run(action, { cleanup = false } = {}) {
    if (!cleanup) check();
    const limit = cleanup ? 1500 : Math.min(8000, end - performance.now(), deadlineAt - Date.now());
    assert(limit > 0);
    let timer, listener;
    pending++;
    const task = Promise.resolve()
      .then(() => {
        if (!cleanup) check();
        return action();
      })
      .finally(() => {
        pending--;
      });
    try {
      const result = await Promise.race([
        task,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            uncertain = true;
            reject(new Error('Imported-world operation timed out.'));
          }, limit);
          if (!cleanup && signal) {
            listener = () => {
              uncertain = true;
              reject(new Error('Imported-world aborted.'));
            };
            signal.addEventListener('abort', listener, { once: true });
          }
        }),
      ]);
      if (!cleanup) check();
      return result;
    } finally {
      clearTimeout(timer);
      if (listener) signal.removeEventListener('abort', listener);
    }
  }
  async function control(selector, action = 'press', value = 'Enter') {
    const item = typeof selector === 'string' ? page.locator(selector) : selector;
    await run(() => item.waitFor({ state: 'visible', timeout: 8000 }));
    check();
    assert(await run(() => item.isEnabled()), 'Public control is disabled.');
    check();
    await run(() => item[action](value));
    report.actions.push({
      selector: typeof selector === 'string' ? selector : 'exact installed card Fly',
      action,
      value: action === 'setInputFiles' ? PACK.path : value,
    });
  }
  async function down(key) {
    check();
    keys.add(key);
    await run(async () => {
      await page.keyboard.down(key);
      if (stopped || signal?.aborted || performance.now() >= end) await page.keyboard.up(key);
    });
  }
  async function up(key) {
    await run(() => page.keyboard.up(key));
    keys.delete(key);
  }
  async function finish() {
    stopped = true;
    const inFlight = pending;
    for (const key of keys) {
      try {
        await run(() => page.keyboard.up(key), { cleanup: true });
      } catch (error) {
        report.cleanup.errors.push(error.message);
      }
    }
    report.cleanup.completed = !uncertain && !inFlight && !pending && !report.cleanup.errors.length;
  }
  async function openPacks() {
    check();
    // Authorize only the exact fragment written by this ordinary Library action.
    packsAuthorized = true;
    await control('[data-tab="packs"]');
    assert.equal(page.url(), `${expectedURL}#packs`, 'Require the native Library route.');
    report.libraryURL = page.url();
  }
  return { check, run, control, down, up, finish, report, openPacks };
}
async function library(g, page) {
  for (const selector of ['#worlds-shell-action-settings', '#worlds-settings-tab-content'])
    await g.control(selector);
  await g.openPacks();
  await g.run(() => page.locator('#packs').waitFor({ state: 'visible', timeout: 8000 }));
}
async function cardState(g, page, readDatabase) {
  const selector = '#installed-packs [data-pack-id="cc0-road-lab"]',
    card = page.locator(selector);
  await g.run(() => card.waitFor({ state: 'visible', timeout: 8000 }));
  assert.equal(await g.run(() => card.count()), 1);
  const text = await g.run(() => card.locator('small').innerText());
  assert.equal(text.trim(), `1 challenges · ${PACK.sha256.slice(0, 12)}`);
  return {
    card: {
      id: await g.run(() => card.getAttribute('data-pack-id')),
      title: await g.run(() => card.locator('strong').innerText()),
      digestPrefix: PACK.sha256.slice(0, 12),
    },
    database: await g.run(() => readDatabase(page)),
  };
}
export async function importRetainedC4World(page, options) {
  const { packBytes, readDatabase, receipt } = options;
  verifyC4ImportBytes(packBytes);
  const g = scope(page, options, receipt);
  try {
    await library(g, page);
    assert.equal(
      await g.run(() => page.locator('#installed-packs [data-pack-id="cc0-road-lab"]').count()),
      0,
      'Do not overwrite an existing imported world.',
    );
    // The native file input is intentionally display:none. Activate its visible
    // associated label, then supply bytes to the resulting real file chooser.
    const pendingChooser = g
      .run(() => page.waitForEvent('filechooser', { timeout: 8000 }))
      .then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
    await g.control('label:has(#import-pack)', 'click', { timeout: 8000 });
    const chooser = await pendingChooser;
    if (chooser.error) throw chooser.error;
    g.check();
    await g.run(() =>
      chooser.value.setFiles({
        name: 'cc0-road-lab.r1.rlpack',
        mimeType: 'application/octet-stream',
        buffer: packBytes,
      }),
    );
    receipt.actions.push({
      selector: 'label:has(#import-pack)',
      action: 'native file chooser setFiles',
      path: PACK.path,
    });
    receipt.baseline = await cardState(g, page, readDatabase);
    assertC4ImportedWorld(receipt.baseline);
    receipt.screenshot = await g.run(() => options.capture('import-ready'));
    receipt.imported = true;
  } finally {
    await g.finish();
  }
  assert(receipt.cleanup.completed, 'Import cleanup unverified.');
  return receipt.baseline;
}
export async function verifyRetainedC4World(page, options) {
  const { readDatabase, baseline, receipt } = options,
    g = scope(page, options, receipt);
  try {
    if (options.libraryAlreadyOpen !== true) await library(g, page);
    else await g.run(() => page.locator('#packs').waitFor({ state: 'visible', timeout: 8000 }));
    receipt.state = await cardState(g, page, readDatabase);
    assertC4ImportedWorld(receipt.state, baseline);
    receipt.passed = true;
  } finally {
    await g.finish();
  }
  assert(receipt.cleanup.completed);
  return receipt.state;
}
/** Read only maintained rendered HUD and ordinary form/UI metadata, never app/model state. */
export function readImportedWorldDOM() {
  const d = globalThis.document,
    find = (s) => d.querySelector(s);
  const visible = (n) => {
    if (!n) return false;
    const s = globalThis.getComputedStyle(n),
      r = n.getBoundingClientRect();
    return (
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      Number(s.opacity) !== 0 &&
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < globalThis.innerHeight &&
      r.left < globalThis.innerWidth
    );
  };
  const hud = '[data-sim-hud="flight"]',
    details = find(`${hud} [data-hud-part="details"]`),
    gauge = find(`${hud} [data-hud-part="gauge-name"]`),
    viewport = find('#world-viewport');
  return {
    details: details?.textContent,
    gauge: gauge?.textContent,
    visible: visible(details) && visible(gauge) && visible(viewport),
    phase: find('#flight-dialog')?.dataset.flightState,
    focused:
      d.hasFocus() &&
      !d.hidden &&
      (d.activeElement === viewport || viewport?.contains(d.activeElement)),
    locale: d.documentElement.lang,
    title: find('#flight-title')?.textContent,
    source: find('#flight-source')?.value,
    preset: find('#flight-keyboard-preset')?.value,
    mode: find('#flight-mode')?.value,
    status: find('#flight-status')?.textContent,
  };
}
export function parseImportedWorldHUD(raw) {
  assert.equal(raw.locale, 'en');
  assert.equal(raw.source, 'keyboard');
  assert.equal(raw.preset, 'two-stick');
  assert.equal(raw.mode, 'self-level');
  assert.equal(raw.title?.trim(), 'Roadworks Practice Park · discovery');
  assert(raw.visible && raw.focused);
  assert.equal(raw.gauge?.trim(), 'Height');
  assert(typeof raw.details === 'string' && raw.details.length <= 128);
  const matched = raw.details.trim().match(/^Height (\d+(?:\.\d+)?) m · 3–5 m$/);
  assert(matched, 'Expected the imported course visible height, not legacy telemetry.');
  const height = Number(matched[1]);
  assert(height >= 0 && height < 1, 'Imported-world smoke exceeded sub-metre envelope.');
  assert(['active', 'paused', 'disarmed', 'ready'].includes(raw.phase));
  return { height, phase: raw.phase, visible: true, gauge: 'Height', at: performance.now() };
}
export async function flyRetainedC4WorldOffline(page, options) {
  const { receipt, restartConfirmed, networkProbeFailed, readDatabase, baseline } = options,
    g = scope(page, options, receipt);
  assert.equal(restartConfirmed, true);
  assert.equal(networkProbeFailed, true);
  receipt.samples = [];
  receipt.networkProbeFailed = true;
  receipt.processRestartConfirmed = true;
  receipt.replay = false;
  try {
    await g.control('#worlds-shell-action-settings');
    for (const [tab, selections] of [
      ['gameplay', [['#flight-mode', 'self-level']]],
      [
        'controls',
        [
          ['#flight-source', 'keyboard'],
          ['#flight-keyboard-preset', 'two-stick'],
        ],
      ],
      [
        'accessibility',
        [['#worlds-settings-panel-accessibility [data-hud-preference="mode"]', 'detailed']],
      ],
    ]) {
      await g.control(`#worlds-settings-tab-${tab}`);
      for (const [selector, value] of selections) await g.control(selector, 'selectOption', value);
    }
    for (let step = 0; step < 5; step++) {
      if ((await g.run(() => page.locator('#sim-settings').getAttribute('open'))) === null) break;
      await g.control('#close-sim-settings');
    }
    assert.equal(await g.run(() => page.locator('#sim-settings').getAttribute('open')), null);
    await library(g, page);
    const state = await cardState(g, page, readDatabase);
    assertC4ImportedWorld(state, baseline);
    const card = page.locator('#installed-packs [data-pack-id="cc0-road-lab"]');
    await g.control(card.getByRole('button', { name: 'Fly', exact: true }));
    const readyEnd = performance.now() + 8000;
    while (true) {
      const status = await g.run(() => page.locator('#flight-status').innerText());
      if (status.trim() === 'Ready. Choose your controls, then arm.') break;
      assert(performance.now() < readyEnd, 'Imported scene did not become ready.');
      await g.run(() => page.waitForTimeout(100));
    }
    await g.run(() => page.locator('#world-viewport').click({ timeout: 8000 }));
    const sample = async () => {
      const value = parseImportedWorldHUD(await g.run(() => page.evaluate(readImportedWorldDOM)));
      assert(receipt.samples.length < 200);
      receipt.samples.push(value);
      return value;
    };
    receipt.before = await sample();
    assert(['paused', 'disarmed', 'ready'].includes(receipt.before.phase));
    await g.run(() => page.keyboard.press('Space'));
    receipt.explicitArm = true;
    const motionEnd = performance.now() + 12000;
    await g.down('w');
    try {
      do {
        await g.run(() => page.waitForTimeout(50));
        receipt.after = await sample();
        assert.equal(receipt.after.phase, 'active');
        assert(performance.now() < motionEnd, 'No bounded offline lift.');
      } while (receipt.after.height - receipt.before.height < 0.2 - 1e-9);
    } finally {
      await g.up('w');
    }
    await g.run(() => page.keyboard.press('Space'));
    receipt.explicitPause = true;
    receipt.paused = [];
    for (let i = 0; i < 4; i++) {
      if (i) await g.run(() => page.waitForTimeout(210));
      receipt.paused.push(await sample());
    }
    receipt.acceptance = assertC4OfflineFlight(receipt);
    receipt.screenshot = await g.run(() => options.capture('paused-flight'));
    // Content comparison is separate from the legitimate live recovery/session writes.
    assert.deepEqual(await g.run(() => readDatabase(page)), baseline.database);
    receipt.passed = true;
  } finally {
    await g.finish();
  }
  assert(receipt.cleanup.completed, 'Offline-flight cleanup unverified.');
  return receipt;
}
