// Actual Team host and normal controller frame; finite DOM/storage boundaries.
// This does not qualify native layout, physical input, offline files or iOS export.
import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { RUNNING_ENEMY_PREFERENCES_KEY } from '../hunt/running-enemy-preferences.mjs';
import { TEAM_HUNT_ATTEMPT_KEY } from '../coop/hunt-attempts.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function pad(index) {
  return {
    index,
    id: `private-team-device-${index}`,
    connected: true,
    mapping: 'standard',
    timestamp: 1,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}
async function fixture(t, { storageAPI = {}, hunt = false } = {}) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(locale, { persist: false }));
  const storage = memoryStorage(
    hunt
      ? {
          [RUNNING_ENEMY_PREFERENCES_KEY]: JSON.stringify({
            format: 'RunningEnemyPreferencesV1',
            enabled: true,
          }),
        }
      : {},
  );
  let reads = 0,
    unavailable = false;
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    beforeImport({ install, doc }) {
      doc.documentElement.dataset.buildVersion = '0.151.1';
      const originalPads = navigator.getGamepads;
      install('localStorage', { value: storage });
      // Capability inspection is allowed; no database exists or is opened.
      install('indexedDB', { value: undefined });
      install('navigator', {
        value: {
          storage: storageAPI,
          getGamepads() {
            reads++;
            if (unavailable) throw new Error('private-read-failure');
            return originalPads();
          },
        },
      });
    },
  });
  assert.ok(f.$('coop-support-summary-root'), 'The native Data panel owns one support view.');
  return {
    ...f,
    storage,
    get reads() {
      return reads;
    },
    failReads(value) {
      unavailable = value;
    },
  };
}
function open(f) {
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-data').click();
  assert.equal(f.$('coop-options').open, true);
  assert.equal(f.$('coop-settings-panel-data').hidden, false);
}
const report = (f) => JSON.parse(f.$('support-summary-json').textContent);
async function prepare(f) {
  f.$('support-summary-prepare').focus();
  f.$('support-summary-prepare').click();
  await waitFor(
    () => !f.$('support-summary-download').disabled,
    () =>
      JSON.stringify({
        status: f.$('support-summary-status').textContent,
        settings: f.$('coop-options').open,
        hiddenOwner: f.$('coop-support-summary-root').closest('[hidden],[inert]')?.id,
        active: f.doc.activeElement?.id,
      }),
  );
  return report(f);
}

test('Team support has no controller observation until a normal frame and never obtains save permission from storage success', async (t) => {
  const f = await fixture(t, {
    storageAPI: { persisted: async () => true, estimate: async () => ({ usage: 5, quota: 100 }) },
  });
  open(f);
  const reads = f.reads,
    writes = [...f.storage.writes];
  const value = await prepare(f);
  assert.equal(value.scope, 'team-game-shell');
  assert.equal(value.game.host, 'capture-team');
  assert.equal(value.game.state, 'idle');
  assert.deepEqual(value.build, { version: '0.151.1', sourceRevision: null, packaged: null });
  assert.equal(value.environment.platform, 'browser');
  assert.equal(value.controller.freshness, 'unavailable');
  assert.equal(value.controller.assigned, null);
  assert.equal(value.controller.neutral, null);
  assert.equal(value.controller.confirmBlocked, null);
  assert.equal(value.game.saving.writable, null);
  assert.equal(value.game.saving.reason, 'unavailable');
  assert.equal(value.storage.retention, 'granted');
  assert.equal(f.reads, reads);
  assert.deepEqual(f.storage.writes, writes);
  assert.equal(f.doc.activeElement, f.$('support-summary-prepare'));
});

test('paused Team support reuses physical presence and aggregate assignment without exporting seats or changing the native checkpoint', async (t) => {
  const f = await fixture(t, { hunt: true });
  const first = pad(0),
    second = pad(1);
  let physicalButtonReads = 0;
  for (const device of [first, second]) {
    const buttons = device.buttons;
    Object.defineProperty(device, 'buttons', {
      get() {
        physicalButtonReads++;
        return buttons;
      },
    });
  }
  f.pads.push(first, second);
  // Assign through native Controls after the ordinary frame discovers the pads.
  f.$('coop-settings-open').click();
  f.$('coop-settings-tab-controls').click();
  f.tick(8);
  const join = f.doc.querySelector('[data-controller-action="join1"]');
  assert.equal(join.disabled, false);
  join.click();
  f.$('coop-options').close();
  f.$('coop-start').click();
  f.tick(120);
  f.$('coop-pause').click();
  open(f);
  f.tick();
  const saved = f.storage.getItem(TEAM_HUNT_ATTEMPT_KEY);
  assert.ok(saved, 'A native paused hunt owns a checkpoint.');
  const clock = f.$('coop-clock').textContent,
    writes = [...f.storage.writes],
    reads = f.reads,
    buttonReads = physicalButtonReads;
  const value = await prepare(f);
  assert.equal(value.game.state, 'paused');
  assert.equal(value.controller.status, 'connected');
  assert.equal(value.controller.assigned, true);
  assert.equal(value.controller.freshness, 'recent');
  assert.equal(value.controller.neutral, null);
  assert.equal(value.controller.confirmBlocked, null);
  assert.equal(value.controller.confirmReason, 'unavailable');
  assert.equal(value.game.saving.writable, null);
  assert.equal(f.reads, reads);
  assert.equal(
    physicalButtonReads,
    buttonReads,
    'Preparing support adds no physical button/edge observation.',
  );
  assert.equal(f.$('coop-clock').textContent, clock);
  assert.equal(f.storage.getItem(TEAM_HUNT_ATTEMPT_KEY), saved);
  assert.deepEqual(f.storage.writes, writes);
  assert.doesNotMatch(
    JSON.stringify(value),
    /private-team|private-read|buttons|axes|seats|profile|device|timestamp/i,
  );
  f.pads.length = 0;
  f.tick();
  assert.equal((await prepare(f)).controller.status, 'disconnected');
  f.failReads(true);
  f.tick();
  assert.equal((await prepare(f)).controller.status, 'unavailable');
});

test('Team controller sample becomes unknown on Settings category clear and inactive page lifecycle', async (t) => {
  const f = await fixture(t);
  open(f);
  f.pads.push(pad(0));
  f.tick();
  assert.equal((await prepare(f)).controller.status, 'connected');
  f.$('coop-settings-tab-display').click();
  f.$('coop-settings-tab-data').click();
  assert.equal((await prepare(f)).controller.freshness, 'unavailable');
  f.doc.hidden = true;
  f.doc.emit('visibilitychange');
  assert.equal(f.$('support-summary-download').disabled, true);
  assert.equal(f.$('support-summary-json').textContent, '');
  const reads = f.reads;
  f.$('support-summary-prepare').click();
  await tick();
  assert.equal(f.reads, reads);
  f.doc.hidden = false;
  f.doc.emit('visibilitychange');
  assert.equal(f.$('support-summary-download').disabled, true);
  // The native Confirm owner requires a normal neutral frame after returning.
  // Diagnostics must not bypass that gate to obtain an earlier observation.
  f.tick();
  assert.equal((await prepare(f)).controller.freshness, 'recent');
  f.win.emit('pagehide', { persisted: true });
  assert.equal(f.$('support-summary-download').disabled, true);
  f.win.emit('pageshow', { persisted: true });
});

test('closing native Team Settings retires a pending observation without publishing its late result or reclaiming focus', async (t) => {
  let finish;
  const held = new Promise((resolve) => {
    finish = resolve;
  });
  const f = await fixture(t, { storageAPI: { persisted: () => held } });
  open(f);
  f.$('support-summary-prepare').focus();
  f.$('support-summary-prepare').click();
  await tick();
  f.$('coop-options').close();
  f.$('coop-start').focus();
  finish(true);
  await tick();
  await tick();
  assert.equal(f.$('support-summary-download').disabled, true);
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.doc.activeElement, f.$('coop-start'));
  open(f);
  assert.equal(f.$('support-summary-json').textContent, '');
  await prepare(f);
});

test('a pending Team observation cannot publish after native foreground loss or move the newer focus', async (t) => {
  let finish;
  const held = new Promise((resolve) => {
    finish = resolve;
  });
  const f = await fixture(t, { storageAPI: { persisted: () => held } });
  open(f);
  f.$('support-summary-prepare').focus();
  f.$('support-summary-prepare').click();
  await tick();
  f.doc.focused = false;
  f.win.emit('blur');
  f.$('coop-start').focus();
  const reads = f.reads,
    writes = [...f.storage.writes];
  finish(true);
  await tick();
  await tick();
  assert.equal(f.$('support-summary-download').disabled, true);
  assert.equal(f.$('support-summary-json').textContent, '');
  assert.equal(f.doc.activeElement, f.$('coop-start'));
  assert.equal(f.reads, reads);
  assert.deepEqual(f.storage.writes, writes);
  f.doc.focused = true;
  f.win.emit('focus');
  f.tick(8);
  assert.equal((await prepare(f)).environment.focused, true);
});

test('native Team preview equals the explicit browser export and EN/UK translation keeps focus and JSON unchanged', async (t) => {
  const f = await fixture(t);
  open(f);
  f.tick();
  const value = await prepare(f);
  const json = f.$('support-summary-json').textContent;
  const blobs = [];
  t.mock.method(URL, 'createObjectURL', (blob) => {
    blobs.push(blob);
    return 'blob:team-summary';
  });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) =>
    schedule(callback, delay === 60000 ? 0 : delay, ...args),
  );
  assert.equal(blobs.length, 0);
  f.$('support-summary-download').focus();
  f.$('support-summary-download').click();
  await waitFor(() => blobs.length === 1);
  assert.deepEqual(JSON.parse(await blobs[0].text()), value);
  assert.match(f.$('support-summary-status').textContent, /Download requested/);
  setLocale('uk', { persist: false });
  assert.match(f.$('support-summary-title').textContent, /Локальний звіт/);
  assert.equal(f.doc.activeElement, f.$('support-summary-download'));
  assert.equal(f.$('support-summary-json').textContent, json);
  assert.doesNotMatch(
    f.$('coop-support-summary-root').textContent,
    /interface:|supportSummary\.|\{\{/,
  );
});
