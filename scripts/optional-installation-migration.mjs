/** Strict, migration-only protocol. Admission and owned resource cleanup stay in the caller. */
import assert from 'node:assert/strict';
import { setTimeout as pause } from 'node:timers/promises';
import {
  INSTALLATION_WORLD_TITLE,
  assertInstallationWorldSeed,
} from './optional-installation-world-seed.mjs';

export const MIGRATION_MODE = 'all-three-98ad851';
export const MIGRATION_IDS = Object.freeze(['civilian-fpv', 'civilian-flight', 'fpv-worlds']);
export function selectHistoricalMigration(value, options) {
  if (value === undefined) return false;
  assert.equal(value, MIGRATION_MODE, 'Unsupported historical migration protocol.');
  assert.equal(options.historical, true, 'Migration requires exact historical admission.');
  assert.equal(options.worldSeed, true, 'Migration requires the public saved-world seed.');
  for (const key of ['download', 'quota', 'quotaPackages', 'activeSession', 'activeWindow'])
    assert.equal(options[key], undefined, `Migration must run separately from ${key}.`);
  return true;
}

/** Exact pointer/worker/cache assertions. Full dependency hashes are checked separately. */
export function assertMigrationOwnership(state, references, keyFor, launchers = []) {
  assert.deepEqual(Object.keys(references).sort(), [...MIGRATION_IDS].sort());
  for (const id of MIGRATION_IDS) {
    const expected = references[id];
    const pointer = JSON.parse(state.keys[keyFor(id)]);
    const publicReference = (ref) =>
      ref && {
        id,
        version: ref.version,
        scope: ref.scope,
        entry: `optional-practice/${id}/index.html`,
      };
    assert.deepEqual(pointer, {
      active: publicReference(expected.active),
      ...(expected.previous ? { previous: publicReference(expected.previous) } : {}),
    });
    for (const ref of [expected.active, expected.previous].filter(Boolean)) {
      assert(state.caches.includes(ref.cacheName), `Missing retained cache: ${id}`);
      assert(
        state.workers.some(
          (worker) => worker.scope === ref.workerScope && worker.active === 'activated',
        ),
        `Missing activated retained worker: ${id}`,
      );
    }
  }
  const owned = [
    ...Object.values(references).flatMap((row) => [row.active, row.previous].filter(Boolean)),
    ...launchers,
  ];
  assert.deepEqual(
    [...state.caches].sort(),
    [
      ...Object.values(references).flatMap((row) =>
        [row.active, row.previous].filter(Boolean).map((ref) => ref.cacheName),
      ),
      ...launchers.flatMap((ref) => ref.cacheNames ?? [ref.cacheName]),
    ].sort(),
    'Unexpected or missing prepared cache.',
  );
  assert.deepEqual(
    state.workers
      .map((row) => ({ scope: row.scope, active: row.active }))
      .sort((a, b) => a.scope.localeCompare(b.scope)),
    owned
      .map((ref) => ({ scope: ref.workerScope, active: 'activated' }))
      .sort((a, b) => a.scope.localeCompare(b.scope)),
    'Unexpected, inactive or missing owned worker.',
  );
}

/** Stable launcher workers retain exactly one previous shell cache. Both caches
 * are admitted and hashed by the caller; only the current worker owns the scope. */
export function assertMigrationLauncherReady(state, expected) {
  assert.deepEqual(state.caches, [...expected.cacheNames].sort());
  assert.equal(state.registrations, 1);
  assert.equal(state.active?.state, 'activated');
  assert.equal(state.active?.scriptURL, new URL('worker.js', expected.scope).href);
  assert.equal(state.installing, null);
  assert.equal(state.waiting, null);
  assert.equal(state.sameActive, true);
  assert.equal(state.reply?.type, 'practice-status');
  assert.equal(state.reply?.scope, expected.scope);
  assert.equal(state.reply?.revision, expected.revision);
  assert.equal(state.reply?.ready, true);
  assert(
    state.reply?.status === 'ready' ||
      (expected.legacyStatus === true && state.reply?.statusPresent === false),
  );
  return true;
}

/** Read-only native worker status request. No register/update/skipWaiting/cache-open. */
export async function readMigrationLauncherState({ scope }) {
  const prefix = `:${new URL(scope).pathname}:`;
  const caches = (await globalThis.caches.keys()).filter((name) => name.includes(prefix)).sort();
  const registrations = (await globalThis.navigator.serviceWorker.getRegistrations()).filter(
    (registration) => registration.scope === scope,
  );
  const registration = registrations[0],
    worker = registration?.active;
  const identify = (value) => (value ? { state: value.state, scriptURL: value.scriptURL } : null);
  let reply = null;
  if (worker) {
    reply = await new Promise((resolve) => {
      const channel = new MessageChannel();
      let timer,
        finished = false;
      const finish = (value) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        channel.port1.onmessage = null;
        channel.port1.onmessageerror = null;
        channel.port1.close();
        channel.port2.close();
        resolve(value);
      };
      timer = setTimeout(() => finish(null), 1000);
      channel.port1.onmessage = ({ data }) =>
        finish({
          type: data?.type === 'practice-status' ? data.type : null,
          scope: typeof data?.scope === 'string' && data.scope.length <= 2048 ? data.scope : null,
          revision:
            typeof data?.revision === 'string' && /^[a-f0-9]{64}$/.test(data.revision)
              ? data.revision
              : null,
          ready: data?.ready === true,
          statusPresent: data != null && Object.hasOwn(data, 'status'),
          status: ['ready', 'unknown', 'unavailable'].includes(data?.status) ? data.status : null,
        });
      channel.port1.onmessageerror = () => finish(null);
      try {
        worker.postMessage({ type: 'practice-status' }, [channel.port2]);
      } catch {
        finish(null);
      }
    });
  }
  return {
    caches,
    registrations: registrations.length,
    active: identify(registration?.active),
    waiting: identify(registration?.waiting),
    installing: identify(registration?.installing),
    sameActive: Boolean(worker && registration?.active === worker),
    reply,
  };
}

export async function waitForMigrationLauncher(
  page,
  expected,
  receipt,
  { requireActive = () => {}, timeoutMs = 30000 } = {},
) {
  const url = new URL(expected.scope);
  assert(
    url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
  );
  assert(
    /^\/(?:[a-zA-Z0-9_-]+\/)*practice\/(civilian-flight|civilian-fpv|fpv-worlds)\/app\/$/.test(
      url.pathname,
    ),
  );
  assert.match(expected.revision, /^[a-f0-9]{64}$/);
  assert.equal(typeof expected.legacyStatus, 'boolean');
  assert(expected.cacheNames.length >= 1 && expected.cacheNames.length <= 2);
  assert.equal(new Set(expected.cacheNames).size, expected.cacheNames.length);
  const namespace = url.pathname.endsWith('/civilian-flight/app/') ? 'civilian-flight' : 'package';
  const prefix = `revealline.optional.${namespace}.v1:${url.pathname}:`;
  for (const name of expected.cacheNames)
    assert(name.startsWith(prefix) && /^[a-f0-9]{64}$/.test(name.slice(prefix.length)));
  assert(expected.cacheNames.includes(prefix + expected.revision));
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 30000);
  receipt.expected = structuredClone(expected);
  receipt.snapshots = [];
  const deadline = Date.now() + timeoutMs;
  let previous;
  while (Date.now() < deadline) {
    requireActive();
    const state = await page.evaluate(readMigrationLauncherState, { scope: expected.scope });
    requireActive();
    const serialized = JSON.stringify(state);
    if (serialized !== previous) {
      if (receipt.snapshots.length < 64) receipt.snapshots.push(state);
      else receipt.dropped = (receipt.dropped ?? 0) + 1;
      previous = serialized;
    }
    try {
      assertMigrationLauncherReady(state, expected);
      if (Date.now() >= deadline) break;
      receipt.ready = true;
      return state;
    } catch (error) {
      if (error.code !== 'ERR_ASSERTION') throw error;
    }
    await pause(Math.min(50, Math.max(0, deadline - Date.now())));
  }
  throw new Error('Admitted stable launcher did not reach exact revision-bound readiness.');
}
export function assertMigrationUnrelated(before, after, selected, keyFor) {
  assert(MIGRATION_IDS.includes(selected));
  for (const id of MIGRATION_IDS.filter((value) => value !== selected)) {
    assert.equal(
      after.keys[keyFor(id)],
      before.keys[keyFor(id)],
      `Unrelated pointer changed: ${id}`,
    );
    const marker = `/practice/${id}/`;
    assert.deepEqual(
      after.caches.filter((name) => name.includes(marker)),
      before.caches.filter((name) => name.includes(marker)),
      `Unrelated cache ownership changed: ${id}`,
    );
    assert.deepEqual(
      after.workers.filter((row) => row.scope.includes(marker)),
      before.workers.filter((row) => row.scope.includes(marker)),
      `Unrelated workers changed: ${id}`,
    );
  }
}
export function assertMigrationWorldRetention(receipt) {
  assert.equal(receipt.preparedBeforeInstallation, true);
  const labels = [
    'historical-baseline',
    ...MIGRATION_IDS.map((id) => `after-upgrade:${id}`),
    ...MIGRATION_IDS.map((id) => `after-rollback:${id}`),
  ];
  assert.deepEqual(
    receipt.checks.map((row) => row.label),
    labels,
  );
  assertInstallationWorldSeed(receipt.baseline);
  for (const state of receipt.checks) assertInstallationWorldSeed(state, receipt.baseline);
  return true;
}

/** Only called after exact URL binding to the admitted historical release. */
export async function openHistoricalMigrationSurface(
  page,
  id,
  surface,
  expectedURL,
  { requireActive = () => {} } = {},
) {
  assert(['civilian-flight', 'fpv-worlds'].includes(id));
  assert(id === 'civilian-flight' ? surface === 'offline' : ['creator', 'packs'].includes(surface));
  const expected = new URL(expectedURL),
    actual = new URL(page.url());
  assert.equal(expected.hostname, '127.0.0.1');
  assert.equal(expected.protocol, 'http:');
  assert.equal(actual.origin, expected.origin);
  assert.equal(actual.pathname, expected.pathname);
  assert(expected.pathname.endsWith(`/releases/v0.142.4/site/optional-practice/${id}/index.html`));
  const end = Date.now() + 30000;
  function timeout() {
    requireActive();
    assert(Date.now() < end, 'Historical public navigation deadline exceeded.');
    return end - Date.now();
  }
  async function press(selector) {
    const target = page.locator(selector);
    await target.waitFor({ state: 'visible', timeout: timeout() });
    assert(await target.isEnabled(), `Historical control disabled: ${selector}`);
    await target.press('Enter', { timeout: timeout() });
  }
  timeout();
  const dialogs = await page
    .locator('dialog[open]')
    .evaluateAll((nodes) => nodes.map((node) => node.id));
  const allowed =
    id === 'civilian-flight'
      ? ['gym-shell-home-dialog', 'gym-shell-settings-dialog', 'help-dialog']
      : ['worlds-shell-home-dialog', 'worlds-shell-missions-dialog'];
  assert(
    dialogs.length <= 3 && dialogs.every((name) => allowed.includes(name)),
    'Unexpected modal blocks historical public navigation.',
  );
  if (id === 'civilian-flight') {
    if (!dialogs.includes('help-dialog')) {
      if (!dialogs.includes('gym-shell-settings-dialog')) await press('#gym-shell-action-settings');
      await press('#gym-shell-action-help');
    }
    await page
      .locator('#help-dialog[open] #offline')
      .waitFor({ state: 'visible', timeout: timeout() });
  } else {
    if (!dialogs.includes('worlds-shell-missions-dialog'))
      await press('#worlds-shell-action-missions');
    await press(`[data-tab="${surface}"]`);
    await page.locator(`#${surface}`).waitFor({ state: 'visible', timeout: timeout() });
  }
}

export async function seedHistoricalMigrationWorld(
  page,
  readDatabase,
  expectedURL,
  { requireActive = () => {} } = {},
) {
  const deadline = Date.now() + 30000;
  const check = () => {
    requireActive();
    assert(Date.now() < deadline, 'Historical world seed deadline exceeded.');
  };
  check();
  const before = await readDatabase(page);
  check();
  for (const name of ['projects', 'revisions'])
    assert.equal(before?.stores?.find((row) => row.name === name)?.count ?? 0, 0);
  await openHistoricalMigrationSurface(page, 'fpv-worlds', 'creator', expectedURL, {
    requireActive: check,
  });
  check();
  const template = await page.locator('#creator-template').evaluate((node) => ({
    value: node.value,
    label: node.selectedOptions[0]?.textContent ?? '',
  }));
  assert(
    typeof template.value === 'string' && template.value.length > 0 && template.value.length <= 256,
  );
  assert(
    typeof template.label === 'string' &&
      template.label.length > 0 &&
      template.label.length <= 2048,
  );
  for (const selector of ['#clone-challenge', '#creator-title', '#install-project']) {
    check();
    const target = page.locator(selector);
    await target.waitFor({ state: 'visible' });
    assert(await target.isEnabled());
    check();
    if (selector === '#creator-title') {
      await target.fill(INSTALLATION_WORLD_TITLE);
      check();
      await target.press('Tab');
    } else await target.press('Enter');
  }
  await page.locator('#studio-status').waitFor({ state: 'visible' });
  check();
  await page.waitForFunction(
    () =>
      globalThis.document.querySelector('#studio-status')?.textContent ===
      'World pack is ready to fly.',
  );
  return { template };
}
